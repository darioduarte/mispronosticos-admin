/**
 * Tests de stats/filtros de pronósticos IA (sin red).
 *   npx tsx --test src/lib/pronosticos-ia-stats.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MATCH_SETTLE_MINUTE,
  buildMarkdownTable,
  buildPronosticosAnalisisExportMarkdown,
  categoriaKey,
  computeApuestasSimuladas,
  computeCapitalSimultaneo,
  computePronosticosIaStats,
  filterPronosticosRows,
  formatCategoriaLabel,
  formatFixtureFechaHora,
  formatWilson,
  isPickValor,
  parseCuotaDecimal,
  parseFixtureDateMs,
  parseProb,
  sortPronosticosRows,
  torneoKey,
  wilson95,
  type PronosticosIaFilters,
} from './pronosticos-ia-stats';
import type { PronosticoIaRow } from './types';

function row(
  partial: Partial<PronosticoIaRow> & Pick<PronosticoIaRow, 'pronostico_id'>,
): PronosticoIaRow {
  return {
    fixtureid: 1,
    fecha: '2026-01-01',
    fixturedate: '2026-01-01 20:00:00',
    pais: 'Spain',
    liga: 'La Liga',
    equipo_local: 'Barcelona',
    equipo_visitante: 'Madrid',
    teamshomename: 'Barcelona',
    teamsawayname: 'Madrid',
    pronostico_tipo: 'Under 2.5',
    pronostico: 'Menos de 2.5 goles',
    categoria_pronostico: 'goles',
    categoria_normalizada: 'goles_under',
    linea_normalizada: '2.5',
    equipo_normalizado: null,
    probabilidad: 70,
    resultado_acertado: null,
    resultado_mensaje: null,
    resultado_clase: 'pendiente',
    estado_partido: 'NS',
    goalshome: null,
    goalsaway: null,
    cuota_display: '1.80',
    cuota_decimal: 1.8,
    cuota_llm_decimal: null,
    ...partial,
  };
}

const defaultFilters = (): PronosticosIaFilters => ({
  search: '',
  categorias: null,
  torneo: '',
  resultado: 'all',
  pickScope: 'all',
  probMin: 0,
  probMax: 100,
  minCuota: '',
  maxCuota: '',
});

describe('parseos de fecha, probabilidad y cuota', () => {
  it('parseFixtureDateMs acepta MySQL e ISO y falla a 0', () => {
    assert.ok(parseFixtureDateMs('2026-01-01 20:00:00') > 0);
    assert.ok(parseFixtureDateMs('2026-01-01T20:00:00Z') > 0);
    assert.equal(parseFixtureDateMs(''), 0);
    assert.equal(parseFixtureDateMs(null), 0);
  });

  it('formatFixtureFechaHora usa HH:mm o cae a fecha', () => {
    assert.equal(
      formatFixtureFechaHora({ fixturedate: '2026-03-10 18:45:00', fecha: '10 mar' }),
      '2026-03-10 18:45',
    );
    assert.equal(formatFixtureFechaHora({ fecha: '10 mar' }), '10 mar');
    assert.equal(formatFixtureFechaHora({}), '—');
  });

  it('parseProb y parseCuotaDecimal cubren %, coma y mínimo 1.01', () => {
    assert.equal(parseProb('72%'), 72);
    assert.equal(parseProb('0,55'), 0.55);
    assert.equal(parseProb(''), null);
    assert.equal(parseCuotaDecimal(row({ pronostico_id: 'c1', cuota_display: '1,90' })), 1.9);
    assert.equal(parseCuotaDecimal(row({ pronostico_id: 'c2', cuota_display: '1.00', cuota_decimal: 1 })), null);
  });
});

describe('claves de categoría y torneo', () => {
  it('isPickValor solo con PICK_VALOR', () => {
    assert.equal(isPickValor(row({ pronostico_id: 'v', categoria_pronostico: 'PICK_VALOR' })), true);
    assert.equal(
      isPickValor(row({ pronostico_id: 'v2', categoria_pronostico: 'pick valor' })),
      true,
    );
    assert.equal(isPickValor(row({ pronostico_id: 'n', categoria_pronostico: 'goles' })), false);
  });

  it('torneoKey y categoriaKey tienen fallback', () => {
    assert.equal(torneoKey(row({ pronostico_id: 't' })), 'Spain · La Liga');
    assert.equal(
      torneoKey(row({ pronostico_id: 't2', pais: null, liga: null })),
      'Sin torneo',
    );
    assert.equal(categoriaKey(row({ pronostico_id: 'c' })), 'goles_under');
    assert.equal(
      categoriaKey(row({ pronostico_id: 'c2', categoria_normalizada: '  ' })),
      'otros',
    );
    assert.equal(formatCategoriaLabel('goles_under'), 'goles under');
  });
});

describe('wilson95', () => {
  it('devuelve intervalo 0–100 y formatWilson lo imprime', () => {
    const w = wilson95(8, 10);
    assert.ok(w);
    assert.ok(w!.low < 80 && w!.high > 80);
    assert.equal(wilson95(1, 0), null);
    assert.match(formatWilson(8, 10), /^\d+–\d+%$/);
    assert.equal(formatWilson(0, 0), '—');
  });
});

describe('filterPronosticosRows', () => {
  const rows = [
    row({
      pronostico_id: 'a',
      categoria_normalizada: 'goles_under',
      resultado_clase: 'acertado',
      probabilidad: 80,
      cuota_decimal: 1.7,
      cuota_display: '1.70',
    }),
    row({
      pronostico_id: 'b',
      categoria_normalizada: 'corners_over',
      categoria_pronostico: 'PICK_VALOR',
      resultado_clase: 'fallido',
      probabilidad: 55,
      cuota_decimal: 2.2,
      cuota_display: '2.20',
      liga: 'Premier',
      pais: 'England',
      pronostico: 'Más corners',
    }),
    row({
      pronostico_id: 'c',
      resultado_clase: 'pendiente',
      probabilidad: null,
      cuota_display: null,
      cuota_decimal: null,
      categoria_normalizada: 'ambos_marcan',
    }),
  ];

  it('categorias null=todas, []=ninguna, lista=subset', () => {
    assert.equal(filterPronosticosRows(rows, defaultFilters()).length, 3);
    assert.equal(
      filterPronosticosRows(rows, { ...defaultFilters(), categorias: [] }).length,
      0,
    );
    assert.deepEqual(
      filterPronosticosRows(rows, {
        ...defaultFilters(),
        categorias: ['goles_under'],
      }).map((r) => r.pronostico_id),
      ['a'],
    );
  });

  it('filtra resultado, pick de valor, probabilidad y cuota', () => {
    assert.equal(
      filterPronosticosRows(rows, { ...defaultFilters(), resultado: 'acertado' })[0]
        .pronostico_id,
      'a',
    );
    assert.equal(
      filterPronosticosRows(rows, { ...defaultFilters(), pickScope: 'valor' })[0]
        .pronostico_id,
      'b',
    );
    assert.deepEqual(
      filterPronosticosRows(rows, { ...defaultFilters(), probMin: 70, probMax: 90 }).map(
        (r) => r.pronostico_id,
      ),
      ['a'],
    );
    assert.deepEqual(
      filterPronosticosRows(rows, { ...defaultFilters(), minCuota: '2,00' }).map(
        (r) => r.pronostico_id,
      ),
      ['b'],
    );
  });

  it('busca en texto del pick', () => {
    assert.equal(
      filterPronosticosRows(rows, { ...defaultFilters(), search: 'corners' })[0]
        .pronostico_id,
      'b',
    );
  });
});

describe('sortPronosticosRows', () => {
  it('ordena por probabilidad sin mutar none', () => {
    const rows = [
      row({ pronostico_id: 'lo', probabilidad: 40 }),
      row({ pronostico_id: 'hi', probabilidad: 90 }),
    ];
    assert.equal(sortPronosticosRows(rows, 'none'), rows);
    const desc = sortPronosticosRows(rows, 'prob_desc');
    assert.equal(desc[0].pronostico_id, 'hi');
    assert.equal(rows[0].pronostico_id, 'lo');
  });
});

describe('computePronosticosIaStats', () => {
  it('agrega aciertos, calibración y picks de valor', () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const old = new Date(now - 40 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const rows = [
      row({
        pronostico_id: '1',
        resultado_clase: 'acertado',
        probabilidad: 80,
        fixturedate: recent,
        categoria_pronostico: 'PICK_VALOR',
      }),
      row({
        pronostico_id: '2',
        fixtureid: 2,
        resultado_clase: 'fallido',
        probabilidad: 55,
        fixturedate: old,
        categoria_normalizada: 'corners_over',
      }),
      row({
        pronostico_id: '3',
        fixtureid: 3,
        resultado_clase: 'pendiente',
        probabilidad: 70,
      }),
    ];
    const stats = computePronosticosIaStats(rows, {
      minEvalRanking: 1,
      minEvalSegments: 2,
      rollingDays: 7,
    });
    assert.equal(stats.total, 3);
    assert.equal(stats.ac, 1);
    assert.equal(stats.fa, 1);
    assert.equal(stats.pe, 1);
    assert.equal(stats.resolved, 2);
    assert.equal(stats.rateResolved, 50);
    assert.equal(stats.pickValorCount, 1);
    assert.equal(stats.uniqueFixtures, 3);
    assert.equal(stats.rolling.recent.ac, 1);
    assert.equal(stats.rolling.older.fa, 1);
    const under = stats.categorias.find((c) => c.label === 'goles_under');
    assert.ok(under);
    assert.equal(under!.ac, 1);
    const calib80 = stats.calibracion.find((c) => c.label === '80–90%');
    assert.ok(calib80);
    assert.equal(calib80!.eval, 1);
    assert.equal(calib80!.rate, 100);
  });
});

describe('markdown y apuestas simuladas', () => {
  it('buildMarkdownTable escapa pipes', () => {
    const md = buildMarkdownTable(['A', 'B'], [['x|y', null]]);
    assert.match(md, /\\|/);
    assert.match(md, /—/);
  });

  it('computeApuestasSimuladas calcula ROI con wins/losses', () => {
    const rows = [
      row({
        pronostico_id: 'w',
        resultado_clase: 'acertado',
        cuota_decimal: 2,
        cuota_display: '2.00',
        probabilidad: 50,
      }),
      row({
        pronostico_id: 'l',
        resultado_clase: 'fallido',
        cuota_decimal: 2,
        cuota_display: '2.00',
        probabilidad: 50,
      }),
      row({
        pronostico_id: 'p',
        resultado_clase: 'pendiente',
        cuota_display: null,
        cuota_decimal: null,
      }),
    ];
    const sim = computeApuestasSimuladas(rows, 10);
    assert.equal(sim.conCuota, 2);
    assert.equal(sim.sinCuota, 1);
    assert.equal(sim.apostadoResuelto, 20);
    assert.equal(sim.retorno, 20);
    assert.equal(sim.beneficio, 0);
    assert.equal(sim.roi, 0);
    assert.equal(sim.cuotaMedia, 2);
  });

  it('export markdown incluye el título y el resumen', () => {
    const md = buildPronosticosAnalisisExportMarkdown(
      [row({ pronostico_id: 'e', resultado_clase: 'acertado' })],
      { minEvalRanking: 1, minEvalSegments: 1, rollingDays: 7 },
      { title: 'Export test', desde: '2026-01-01', hasta: '2026-01-02' },
    );
    assert.match(md, /# Export test/);
    assert.match(md, /Rango: 2026-01-01 → 2026-01-02/);
    assert.match(md, /## Resumen/);
  });
});

describe('computeCapitalSimultaneo', () => {
  it('suma picks solapados hasta el minuto de cierre', () => {
    const kickoff = Date.parse('2026-06-01T18:00:00Z');
    const rows = [
      row({
        pronostico_id: 'p1',
        fixtureid: 10,
        fixturedate: '2026-06-01T18:00:00Z',
        cuota_decimal: 1.8,
        cuota_display: '1.80',
      }),
      row({
        pronostico_id: 'p2',
        fixtureid: 10,
        fixturedate: '2026-06-01T18:00:00Z',
        cuota_decimal: 1.9,
        cuota_display: '1.90',
      }),
    ];
    const mid = kickoff + 60 * 60_000;
    const sim = computeCapitalSimultaneo(rows, 5, mid);
    assert.equal(MATCH_SETTLE_MINUTE, 105);
    assert.equal(sim.pico, 10);
    assert.equal(sim.picoPicks, 2);
    assert.equal(sim.picoPartidos, 1);
    assert.equal(sim.capitalAhora, 10);
    assert.equal(sim.picksAhora, 2);
  });
});
