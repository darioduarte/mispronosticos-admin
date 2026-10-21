/**
 * Relleno del formulario de expertos a partir de un partido.
 *   npx tsx --test src/lib/expert-fixture-form.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyExpertFixtureSelection, toFixtureDatetimeLocal } from './expert-fixture-form';
import type { ExpertPronosticoSavePayload } from './types';

const catalogs = {
  deportes: [{ id: 'fut', nombre: 'Fútbol' }, { id: 'bas', nombre: 'Baloncesto' }],
  campeonatos: [
    { id: 'bet', nombre: 'Liga BetPlay', idDeporte: 'fut' },
    { id: 'nba', nombre: 'NBA', idDeporte: 'bas' },
  ],
  estados: [{ id: 'pen', nombre: 'Pendiente' }, { id: 'gan', nombre: 'Ganada' }],
  tiposPronostico: [{ id: 'pre', nombre: 'Pre partido' }, { id: 'live', nombre: 'En vivo' }],
};

const empty: ExpertPronosticoSavePayload = {
  local: '',
  visitante: '',
  idDeporte: '',
  idCampeonato: '',
  tipoDeApuesta: '',
  idEstadoPronostico: '',
  idTipoPronostico: '',
  fechaEvento: '',
  cuota: '',
};

describe('applyExpertFixtureSelection', () => {
  it('completa nombres, liga, fecha, deporte y campeonato', () => {
    const result = applyExpertFixtureSelection(empty, {
      fixtureid: 88,
      teamshomename: 'Millonarios',
      teamsawayname: 'Santa Fe',
      leaguename: 'Liga BetPlay',
      leaguecountry: 'Colombia',
      fixturedate: '2026-10-10 19:30:00',
      fixturestatusshort: 'NS',
    }, catalogs);
    assert.equal(result.patch.local, 'Millonarios');
    assert.equal(result.patch.visitante, 'Santa Fe');
    assert.equal(result.patch.fixtureId, 88);
    assert.equal(result.patch.idDeporte, 'fut');
    assert.equal(result.patch.idCampeonato, 'bet');
    assert.equal(result.patch.fechaEvento, '2026-10-10T19:30');
    assert.equal(result.patch.idTipoPronostico, 'pre');
    assert.equal(result.patch.idEstadoPronostico, 'pen');
    assert.equal(result.patch.resultadoLocal, '');
    assert.equal(result.missingCampeonato, null);
  });

  it('marca el campeonato que hay que crear y el tipo en vivo', () => {
    const result = applyExpertFixtureSelection(empty, {
      fixtureid: 90,
      teamshomename: 'Junior',
      teamsawayname: 'Cali',
      leaguename: 'Copa Colombia',
      fixturestatusshort: '1H',
      goalshome: 1,
      goalsaway: 0,
      fixturedate: '2026-10-10T23:00:00.000Z',
    }, catalogs);
    assert.deepEqual(result.missingCampeonato, { nombre: 'Copa Colombia', idDeporte: 'fut' });
    assert.equal(result.patch.idCampeonato, undefined);
    assert.equal(result.patch.idTipoPronostico, 'live');
    assert.equal(result.patch.resultadoLocal, '1');
    assert.equal(result.patch.resultadoVisitante, '0');
    assert.equal(result.patch.fechaEvento, '2026-10-10T18:00');
  });

  it('no pisa tipo ni estado si ya estaban elegidos', () => {
    const result = applyExpertFixtureSelection({
      ...empty,
      idTipoPronostico: 'pre',
      idEstadoPronostico: 'gan',
    }, {
      fixtureid: 91,
      teamshomename: 'A',
      teamsawayname: 'B',
      leaguename: 'Liga BetPlay',
      fixturestatusshort: '2H',
    }, catalogs);
    assert.equal(result.patch.idTipoPronostico, undefined);
    assert.equal(result.patch.idEstadoPronostico, undefined);
  });

  it('usa el nombre de League cuando el fixture trae otro texto', () => {
    const result = applyExpertFixtureSelection(empty, {
      fixtureid: 92,
      teamshomename: 'Nacional',
      teamsawayname: 'Medellín',
      leaguename: 'Primera A',
      leaguecatalogname: 'Liga BetPlay',
      leaguecatalogcountry: 'Colombia',
      fixturestatusshort: 'NS',
    }, catalogs);
    assert.equal(result.patch.idCampeonato, 'bet');
    assert.equal(result.patch.idDeporte, 'fut');
    assert.equal(result.missingCampeonato, null);
  });

  it('reutiliza el campeonato de un pronóstico anterior del mismo partido', () => {
    const result = applyExpertFixtureSelection(empty, {
      fixtureid: 93,
      teamshomename: 'Junior',
      teamsawayname: 'Cali',
      leaguename: 'Copa Colombia',
      leaguecatalogname: 'Copa Colombia',
      previousIdCampeonato: 'bet',
      fixturestatusshort: 'NS',
    }, catalogs);
    assert.equal(result.patch.idCampeonato, 'bet');
    assert.equal(result.patch.idDeporte, 'fut');
    assert.equal(result.missingCampeonato, null);
  });

  it('si no hay partido previo, usa el campeonato ya usado en esa liga', () => {
    const result = applyExpertFixtureSelection(empty, {
      fixtureid: 94,
      teamshomename: 'Once Caldas',
      teamsawayname: 'Pereira',
      leaguename: 'Primera A',
      leagueSuggestedIdCampeonato: 'bet',
      fixturestatusshort: 'NS',
    }, catalogs);
    assert.equal(result.patch.idCampeonato, 'bet');
    assert.equal(result.patch.idDeporte, 'fut');
  });

  it('empareja LaLiga con La Liga y no elige si hay dos iguales', () => {
    const matched = applyExpertFixtureSelection(empty, {
      fixtureid: 95,
      leaguename: 'La Liga',
      leaguecountry: 'Spain',
      fixturestatusshort: 'NS',
    }, {
      ...catalogs,
      campeonatos: [{ id: 'laliga', nombre: 'LaLiga', idDeporte: 'fut' }],
    });
    assert.equal(matched.patch.idCampeonato, 'laliga');

    const tied = applyExpertFixtureSelection(empty, {
      fixtureid: 96,
      leaguename: 'Serie A',
      leaguecountry: 'Italy',
      fixturestatusshort: 'NS',
    }, {
      ...catalogs,
      campeonatos: [
        { id: 'it', nombre: 'Serie A', idDeporte: 'fut' },
        { id: 'br', nombre: 'Serie A', idDeporte: 'fut' },
      ],
    });
    assert.equal(tied.patch.idCampeonato, undefined);
    assert.deepEqual(tied.missingCampeonato, { nombre: 'Serie A', idDeporte: 'fut' });
  });
});

describe('toFixtureDatetimeLocal', () => {
  it('deja la hora plana y convierte UTC a Bogotá', () => {
    assert.equal(toFixtureDatetimeLocal('2026-10-10 19:30:00'), '2026-10-10T19:30');
    assert.equal(toFixtureDatetimeLocal('2026-10-10T23:00:00.000Z'), '2026-10-10T18:00');
    assert.equal(toFixtureDatetimeLocal(''), '');
  });
});
