/**
 * Tests de filtros/orden de partidos (sin red).
 *   npx tsx --test src/lib/partidos-filters.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_PARTIDOS_FILTERS,
  estadoLabel,
  filterPartidosRows,
  normalizeSearch,
  sortPartidosRows,
  type PartidosClientFilters,
} from './partidos-filters';
import type { PartidoRow } from './types';

function partido(
  partial: Partial<PartidoRow> & Pick<PartidoRow, 'fixtureid' | 'local' | 'visitante'>,
): PartidoRow {
  return {
    fechaDisplay: '2026-01-01',
    liga: 'La Liga',
    pais: 'Spain',
    estado: 'NS',
    estadoBadgeClass: 'ns',
    marcador: '—',
    fixturereferee: 'Pérez',
    sinArbitro: false,
    tieneEstadisticas: true,
    fixturedate: '2026-01-01 20:00:00',
    ...partial,
  };
}

const baseFilters = (): PartidosClientFilters => ({ ...DEFAULT_PARTIDOS_FILTERS });

describe('normalizeSearch', () => {
  it('quita diacríticos y pasa a minúsculas', () => {
    assert.equal(normalizeSearch('  Atlético  '), 'atletico');
  });
});

describe('filterPartidosRows', () => {
  const rows = [
    partido({
      fixtureid: 1,
      local: 'Barcelona',
      visitante: 'Madrid',
      liga: 'La Liga',
      pais: 'Spain',
      estado: '1H',
      tieneEstadisticas: true,
      sinArbitro: false,
      fixturereferee: 'Mateu Lahoz',
    }),
    partido({
      fixtureid: 2,
      local: 'Milan',
      visitante: 'Inter',
      liga: 'Serie A',
      pais: 'Italy',
      estado: 'FT',
      tieneEstadisticas: false,
      sinArbitro: true,
      fixturereferee: '',
    }),
    partido({
      fixtureid: 3,
      local: 'Nacional',
      visitante: 'Millonarios',
      liga: 'Liga BetPlay',
      pais: 'Colombia',
      estado: 'NS',
      tieneEstadisticas: true,
      sinArbitro: false,
    }),
    partido({
      fixtureid: 4,
      local: 'A',
      visitante: 'B',
      liga: 'Friendly',
      pais: 'World',
      estado: 'CANC',
    }),
  ];

  it('filtra por liga y país', () => {
    const got = filterPartidosRows(rows, { ...baseFilters(), liga: 'Serie A', pais: 'Italy' });
    assert.deepEqual(
      got.map((r) => r.fixtureid),
      [2],
    );
  });

  it('agrupa estados live / ft / ns / other', () => {
    assert.deepEqual(
      filterPartidosRows(rows, { ...baseFilters(), estado: 'live' }).map((r) => r.fixtureid),
      [1],
    );
    assert.deepEqual(
      filterPartidosRows(rows, { ...baseFilters(), estado: 'ft' }).map((r) => r.fixtureid),
      [2],
    );
    assert.deepEqual(
      filterPartidosRows(rows, { ...baseFilters(), estado: 'ns' }).map((r) => r.fixtureid),
      [3],
    );
    assert.deepEqual(
      filterPartidosRows(rows, { ...baseFilters(), estado: 'other' }).map((r) => r.fixtureid),
      [4],
    );
  });

  it('filtra stats y árbitro', () => {
    assert.deepEqual(
      filterPartidosRows(rows, { ...baseFilters(), stats: 'without' }).map((r) => r.fixtureid),
      [2],
    );
    assert.deepEqual(
      filterPartidosRows(rows, { ...baseFilters(), arbitro: 'without' }).map((r) => r.fixtureid),
      [2],
    );
    assert.equal(
      filterPartidosRows(rows, { ...baseFilters(), stats: 'with', arbitro: 'with' }).length,
      3,
    );
  });

  it('busca en equipos, liga y referee ignorando tildes', () => {
    const got = filterPartidosRows(rows, { ...baseFilters(), search: 'lahóz' });
    assert.deepEqual(
      got.map((r) => r.fixtureid),
      [1],
    );
  });
});

describe('sortPartidosRows', () => {
  const rows = [
    partido({
      fixtureid: 1,
      local: 'Zeta',
      visitante: 'A',
      fixturedate: '2026-01-02',
      liga: 'B Liga',
      pais: 'Spain',
      estado: 'FT',
    }),
    partido({
      fixtureid: 2,
      local: 'Alfa',
      visitante: 'B',
      fixturedate: '2026-01-01',
      liga: 'A Liga',
      pais: 'Italy',
      estado: 'NS',
    }),
  ];

  it('ordena por fecha y por partido sin mutar el original', () => {
    const original = rows.map((r) => r.fixtureid);
    const byDate = sortPartidosRows(rows, 'fecha_asc');
    assert.deepEqual(
      byDate.map((r) => r.fixtureid),
      [2, 1],
    );
    const byMatch = sortPartidosRows(rows, 'partido_asc');
    assert.equal(byMatch[0].local, 'Alfa');
    assert.deepEqual(
      rows.map((r) => r.fixtureid),
      original,
    );
  });
});

describe('estadoLabel', () => {
  it('mapea NS/FT/live y deja el resto tal cual', () => {
    assert.equal(estadoLabel('NS'), 'Por jugar');
    assert.equal(estadoLabel('tbd'), 'Por jugar');
    assert.equal(estadoLabel('AET'), 'Finalizado');
    assert.equal(estadoLabel('2H'), 'En vivo');
    assert.equal(estadoLabel('CANC'), 'CANC');
  });
});
