/**
 * Mismas reglas que el filtro del backend.
 *   npx tsx --test src/lib/average-match-filter.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyAverageFilters, parseThreshold } from './average-match-filter';
import type { AverageMatch } from './types';

function match(local: number | null, away: number | null, id = 1): AverageMatch {
  return {
    fixtureid: id,
    fixturedate: null,
    fechaDisplay: '',
    liga: 'Liga',
    pais: '',
    local: 'Local',
    visitante: 'Visita',
    estado: 'NS',
    marcador: '—',
    promedios: {
      rematesTotales: { local, visitante: away },
    },
  };
}

describe('filtro de promedios', () => {
  it('acepta coma decimal y deja vacío el campo en blanco', () => {
    assert.equal(parseThreshold('12,5'), 12.5);
    assert.equal(parseThreshold('  '), null);
  });

  it('exige el mínimo del local y combina con un máximo', () => {
    const rows = [match(12, 3, 1), match(11, 3, 2), match(13, 9, 3)];
    const filtered = applyAverageFilters(rows, [
      { metric: 'rematesTotales', side: 'local', op: 'gte', value: 12 },
      { metric: 'rematesTotales', side: 'visitante', op: 'lte', value: 4 },
    ]);
    assert.deepEqual(
      filtered.map((row) => row.fixtureid),
      [1],
    );
  });

  it('el rango lo cumple el mismo equipo cuando se elige cualquiera', () => {
    const rows = [match(15, 4, 1), match(30, 4, 2)];
    const filtered = applyAverageFilters(rows, [
      { metric: 'rematesTotales', side: 'cualquiera', op: 'gte', value: 12 },
      { metric: 'rematesTotales', side: 'cualquiera', op: 'lte', value: 20 },
    ]);
    assert.deepEqual(
      filtered.map((row) => row.fixtureid),
      [1],
    );
  });

  it('un promedio vacío no cumple la comparación', () => {
    const filtered = applyAverageFilters([match(null, 20)], [
      { metric: 'rematesTotales', side: 'cualquiera', op: 'gte', value: 10 },
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(
      applyAverageFilters([match(null, null)], [
        { metric: 'rematesTotales', side: 'ambos', op: 'gte', value: 1 },
      ]).length,
      0,
    );
  });
});
