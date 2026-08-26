/**
 * Tests del motor de selección (sin runner de proyecto: ejecutar con
 *   npx tsx --test src/lib/pick-selection-engine.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CFG,
  bayesianShrink,
  buildCalibrationIndex,
  calibrateHierarchical,
  runWalkForwardBacktest,
  scorePick,
  selectPicks,
  type HistoryCase,
  type PickInput,
} from './pick-selection-engine';

function caseOf(
  partial: Partial<HistoryCase> & Pick<HistoryCase, 'id' | 'hit' | 'fixtureDateMs'>,
): HistoryCase {
  return {
    fixtureId: partial.fixtureId ?? 1,
    categoria: partial.categoria ?? 'goles_under',
    torneo: partial.torneo ?? 'spain · la liga',
    pModelo: partial.pModelo ?? 0.7,
    cuota: partial.cuota ?? 1.8,
    ...partial,
  };
}

describe('bayesianShrink', () => {
  it('usa k configurable y formula (n/(n+k))*p + (k/(n+k))*parent', () => {
    const k = 50;
    const n = 50;
    const pGroup = 0.8;
    const pParent = 0.5;
    const got = bayesianShrink(pGroup, n, pParent, k);
    assert.equal(got, 0.5 * 0.8 + 0.5 * 0.5);
  });

  it('con n=0 devuelve el padre', () => {
    assert.equal(bayesianShrink(0.9, 0, 0.55, 50), 0.55);
  });
});

describe('EV y métricas', () => {
  it('EV = p_cal * cuota - 1 (no usa el score como probabilidad)', () => {
    const history: HistoryCase[] = [];
    for (let i = 0; i < 80; i++) {
      history.push(
        caseOf({
          id: `h${i}`,
          fixtureId: 100 + i,
          fixtureDateMs: 1_000_000 + i,
          hit: i % 5 !== 0, // ~80%
          categoria: 'goles_under',
          pModelo: 0.72,
          cuota: 1.9,
        }),
      );
    }
    const pick: PickInput = {
      id: 'p1',
      fixtureId: 999,
      categoria: 'goles_under',
      torneo: 'spain · la liga',
      probabilidad: 0.72,
      cuota: 1.9,
      fixtureDateMs: 2_000_000,
    };
    const scored = scorePick(pick, history);
    assert.ok(scored.pCalibrada > 0);
    assert.ok(Math.abs(scored.ev - (scored.pCalibrada * 1.9 - 1)) < 1e-9);
    assert.ok(Math.abs(scored.qImpl - 1 / 1.9) < 1e-9);
    assert.ok(
      Math.abs(scored.edgeVsMarket - (scored.pCalibrada - scored.qImpl)) < 1e-9,
    );
    // score no es probabilidad
    assert.ok(scored.score === 0 || scored.score > 1 || scored.label === 'descartar');
  });
});

describe('torneo n<30 no boost', () => {
  it('bloquea boost de torneo cuando n_tor_cat < 30', () => {
    const history: HistoryCase[] = [];
    // Categoría mediocre global
    for (let i = 0; i < 60; i++) {
      history.push(
        caseOf({
          id: `c${i}`,
          fixtureId: 10 + i,
          fixtureDateMs: 1_000 + i,
          hit: i % 2 === 0, // 50%
          categoria: 'goles_over',
          torneo: 'other league',
          pModelo: 0.7,
          cuota: 2.0,
        }),
      );
    }
    // Torneo estrella pero n=20 < 30
    for (let i = 0; i < 20; i++) {
      history.push(
        caseOf({
          id: `t${i}`,
          fixtureId: 200 + i,
          fixtureDateMs: 2_000 + i,
          hit: true,
          categoria: 'goles_over',
          torneo: 'austria · bundesliga',
          pModelo: 0.7,
          cuota: 2.0,
        }),
      );
    }

    const index = buildCalibrationIndex(history);
    const calib = calibrateHierarchical(
      {
        categoria: 'goles_over',
        torneo: 'austria · bundesliga',
        pModelo: 0.7,
      },
      index,
      CFG.shrinkK,
    );
    assert.equal(calib.torEligible, false);
    assert.ok(calib.nTorCat < CFG.minNTorneoCat);

    const scored = scorePick(
      {
        id: 'x',
        fixtureId: 1,
        categoria: 'goles_over',
        torneo: 'austria · bundesliga',
        probabilidad: 0.75,
        cuota: 1.85,
        fixtureDateMs: 9_000,
      },
      history,
    );
    assert.equal(scored.factors.torBoostBlocked, true);
    assert.ok(scored.factors.torDelta <= 0);
  });
});

describe('walk-forward sin leakage', () => {
  it('no usa resultados futuros para calibrar', () => {
    const cases: HistoryCase[] = [
      caseOf({
        id: 'early-miss',
        fixtureId: 1,
        fixtureDateMs: 100,
        hit: false,
        categoria: 'goles_under',
        pModelo: 0.8,
        cuota: 1.5,
      }),
      caseOf({
        id: 'late-hit',
        fixtureId: 2,
        fixtureDateMs: 200,
        hit: true,
        categoria: 'goles_under',
        pModelo: 0.8,
        cuota: 1.5,
      }),
    ];

    // Al puntuar el primero, historial vacío → nivel modelo
    const first = scorePick(
      {
        id: 'early-miss',
        fixtureId: 1,
        categoria: 'goles_under',
        torneo: 'spain · la liga',
        probabilidad: 0.8,
        cuota: 1.5,
        fixtureDateMs: 100,
      },
      [],
    );
    assert.equal(first.calibLevel, 'modelo');
    assert.equal(first.nEff, 0);

    // Al puntuar el segundo solo con el primero
    const second = scorePick(
      {
        id: 'late-hit',
        fixtureId: 2,
        categoria: 'goles_under',
        torneo: 'spain · la liga',
        probabilidad: 0.8,
        cuota: 1.5,
        fixtureDateMs: 200,
      },
      [cases[0]],
    );
    assert.ok(second.nEff >= 1);
    assert.notEqual(second.calibLevel, 'modelo');

    const bt = runWalkForwardBacktest(cases);
    assert.equal(bt.nHistory, 2);
    // El primer fixture no puede haberse beneficiado del segundo
    const firstPoint = bt.points.find((p) => p.fixtureId === 1);
    if (firstPoint) {
      assert.equal(firstPoint.fixtureDateMs, 100);
    }
  });

  it('selectPicks con fechas filtra historial por pick', () => {
    const history: HistoryCase[] = [
      caseOf({
        id: 'h1',
        fixtureId: 1,
        fixtureDateMs: 500,
        hit: true,
        categoria: 'corners_under',
        pModelo: 0.7,
        cuota: 1.7,
      }),
    ];
    const picks: PickInput[] = [
      {
        id: 'past-pick',
        fixtureId: 2,
        categoria: 'corners_under',
        torneo: 'mls',
        probabilidad: 0.7,
        cuota: 1.7,
        fixtureDateMs: 100, // antes del historial
      },
      {
        id: 'future-pick',
        fixtureId: 3,
        categoria: 'corners_under',
        torneo: 'mls',
        probabilidad: 0.7,
        cuota: 1.7,
        fixtureDateMs: 900,
      },
    ];
    const result = selectPicks(picks, history);
    const past = result.rankedByComposite.find((r) => r.id === 'past-pick')!;
    const fut = result.rankedByComposite.find((r) => r.id === 'future-pick')!;
    assert.equal(past.nEff, 0);
    assert.ok(fut.nEff >= 1);
  });
});

describe('rankings separados', () => {
  it('expone rankedByEv / confianza / riesgo / composite', () => {
    const history: HistoryCase[] = [];
    for (let i = 0; i < 50; i++) {
      history.push(
        caseOf({
          id: `h${i}`,
          fixtureId: i + 1,
          fixtureDateMs: i + 1,
          hit: true,
          categoria: 'doble_oportunidad',
          pModelo: 0.78,
          cuota: 1.55,
        }),
      );
    }
    const picks: PickInput[] = [
      {
        id: 'a',
        fixtureId: 100,
        categoria: 'doble_oportunidad',
        torneo: 'mls',
        probabilidad: 0.8,
        cuota: 1.6,
        fixtureDateMs: 1000,
      },
      {
        id: 'b',
        fixtureId: 101,
        categoria: 'doble_oportunidad',
        torneo: 'mls',
        probabilidad: 0.65,
        cuota: 2.2,
        fixtureDateMs: 1000,
      },
    ];
    const r = selectPicks(picks, history);
    assert.ok(r.rankedByEv.length === 2);
    assert.ok(r.rankedByConfianza.length === 2);
    assert.ok(r.rankedByRiesgo.length === 2);
    assert.ok(r.rankedByComposite.length === 2);
  });
});
