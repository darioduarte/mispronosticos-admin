/**
 * Motor de selección de picks prepartido.
 * Calibración jerárquica walk-forward + shrinkage bayesiano.
 * El score solo ordena; no es una probabilidad.
 */

export type PickLabel = 'seleccionable' | 'dudoso' | 'descartar';

export type RankingMode = 'composite' | 'ev' | 'confianza' | 'riesgo';

export type PickInput = {
  id: string;
  fixtureId: number;
  categoria: string;
  torneo: string;
  probabilidad: number;
  cuota: number;
  /** ms epoch del partido; 0 si desconocido */
  fixtureDateMs: number;
};

/** Caso resuelto usable para calibración / backtest */
export type HistoryCase = {
  id: string;
  fixtureId: number;
  categoria: string;
  torneo: string;
  pModelo: number;
  cuota: number;
  fixtureDateMs: number;
  hit: boolean;
};

export type Ci95 = { low: number; high: number };

export type CalibLevel =
  | 'cat_bin'
  | 'torneo_cat'
  | 'categoria'
  | 'mercado'
  | 'modelo';

export type ScoredPick = {
  id: string;
  fixtureId: number;
  label: PickLabel;
  /** Solo para ordenar (0–100). No es probabilidad. */
  score: number;
  pModelo: number;
  pCalibrada: number;
  qImpl: number;
  edgeVsMarket: number;
  ev: number;
  distSweetSpot: number;
  confianza: number;
  riesgo: number;
  nEff: number;
  ci95: Ci95 | null;
  calibLevel: CalibLevel;
  reasons: string[];
  factors: {
    fEv: number;
    fEdge: number;
    fConf: number;
    fRisk: number;
    penSample: number;
    penEdge: number;
    torDelta: number;
    torBoostBlocked: boolean;
  };
  /** @deprecated alias pModelo */
  pRaw: number;
  /** @deprecated alias pCalibrada */
  pCorr: number;
  /** @deprecated alias edgeVsMarket */
  edgeCorr: number;
};

export type SelectPicksResult = {
  ranked: ScoredPick[];
  rankedByEv: ScoredPick[];
  rankedByConfianza: ScoredPick[];
  rankedByRiesgo: ScoredPick[];
  rankedByComposite: ScoredPick[];
  selected: ScoredPick[];
  rejectedSameFixture: ScoredPick[];
  counts: { seleccionable: number; dudoso: number; descartar: number };
};

export type WalkForwardPoint = {
  id: string;
  fixtureId: number;
  fixtureDateMs: number;
  hit: boolean;
  selected: boolean;
  score: number;
  ev: number;
  pCalibrada: number;
  label: PickLabel;
};

export type WalkForwardSeriesStats = {
  nSelected: number;
  nResolved: number;
  hits: number;
  hitRate: number | null;
  stake: number;
  profit: number;
  roi: number | null;
  maxDrawdown: number;
};

export type WalkForwardBacktest = {
  nHistory: number;
  byComposite: WalkForwardSeriesStats;
  byEv: WalkForwardSeriesStats;
  points: WalkForwardPoint[];
  note: string;
};

export const CFG = {
  minOdds: 1.4,
  minEdge: 0.015,
  sweetEdgeMax: 0.06,
  extremeEdge: 0.12,
  minPCal: 0.52,
  scoreSelect: 72,
  scoreDoubt: 55,
  /** Fuerza de shrinkage bayesiano (configurable) */
  shrinkK: 50,
  /** Mínimo n para que torneo+categoría pueda mejorar el score */
  minNTorneoCat: 30,
  minNTrust: 40,
  wilsonZ: 1.96,
} as const;

/** Hard veto por categoría */
export const CAT_VETO = new Set([
  'tarjetas_over',
  'resultado_local',
  'resultado_visitante',
  'ambos_marcan',
  'ambos_no_marcan',
  'corners_local_under',
  'tarjetas_visitante_under',
  'corners_visitante_over',
]);

function clip(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

function pp(x: number) {
  return `${(x * 100).toFixed(1)} pp`;
}

export function normProb(p: number): number {
  if (!Number.isFinite(p)) return NaN;
  return p > 1 ? p / 100 : p;
}

export function normalizeCatKey(c: string): string {
  return String(c || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_');
}

export function normalizeTorneoKey(t: string): string {
  return String(t || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

/** Tramos de probabilidad del modelo */
export function probBin(pModelo: number): string {
  const p = clip(normProb(pModelo), 0, 1);
  if (p < 0.55) return '50-55';
  if (p < 0.65) return '55-65';
  if (p < 0.75) return '65-75';
  if (p < 0.85) return '75-85';
  return '85-100';
}

/** Shrinkage: (n/(n+k))*p_grupo + (k/(n+k))*p_global */
export function bayesianShrink(
  pGroup: number,
  n: number,
  pParent: number,
  k: number = CFG.shrinkK,
): number {
  if (!Number.isFinite(n) || n <= 0) return pParent;
  const kk = Number.isFinite(k) && k >= 0 ? k : CFG.shrinkK;
  const w = n / (n + kk);
  return w * pGroup + (1 - w) * pParent;
}

/** Wilson score interval (proporciones 0–1) */
export function wilsonCi(
  successes: number,
  trials: number,
  z: number = CFG.wilsonZ,
): Ci95 | null {
  if (trials <= 0) return null;
  const phat = successes / trials;
  const zz = z * z;
  const denom = 1 + zz / trials;
  const center = (phat + zz / (2 * trials)) / denom;
  const half =
    (z / denom) *
    Math.sqrt((phat * (1 - phat)) / trials + zz / (4 * trials * trials));
  return {
    low: clip(center - half, 0, 1),
    high: clip(center + half, 0, 1),
  };
}

type GroupStat = { hits: number; n: number; rate: number };

function emptyStat(): GroupStat {
  return { hits: 0, n: 0, rate: 0 };
}

function addHit(stat: GroupStat, hit: boolean) {
  stat.n += 1;
  if (hit) stat.hits += 1;
  stat.rate = stat.n > 0 ? stat.hits / stat.n : 0;
}

export type CalibrationIndex = {
  market: GroupStat;
  byCat: Map<string, GroupStat>;
  byTorCat: Map<string, GroupStat>;
  byCatBin: Map<string, GroupStat>;
};

export function buildCalibrationIndex(cases: HistoryCase[]): CalibrationIndex {
  const market = emptyStat();
  const byCat = new Map<string, GroupStat>();
  const byTorCat = new Map<string, GroupStat>();
  const byCatBin = new Map<string, GroupStat>();

  for (const c of cases) {
    const cat = normalizeCatKey(c.categoria);
    const tor = normalizeTorneoKey(c.torneo);
    const bin = probBin(c.pModelo);
    const catBinKey = `${cat}|${bin}`;
    const torCatKey = `${tor}|${cat}`;

    addHit(market, c.hit);

    let catStat = byCat.get(cat);
    if (!catStat) {
      catStat = emptyStat();
      byCat.set(cat, catStat);
    }
    addHit(catStat, c.hit);

    let torCatStat = byTorCat.get(torCatKey);
    if (!torCatStat) {
      torCatStat = emptyStat();
      byTorCat.set(torCatKey, torCatStat);
    }
    addHit(torCatStat, c.hit);

    let catBinStat = byCatBin.get(catBinKey);
    if (!catBinStat) {
      catBinStat = emptyStat();
      byCatBin.set(catBinKey, catBinStat);
    }
    addHit(catBinStat, c.hit);
  }

  return { market, byCat, byTorCat, byCatBin };
}

export type HierarchicalCalib = {
  pCalibrada: number;
  nEff: number;
  ci95: Ci95 | null;
  level: CalibLevel;
  pMercado: number;
  pCat: number;
  pTorCat: number | null;
  pCatBin: number | null;
  nTorCat: number;
  torEligible: boolean;
};

/**
 * Cascada: mercado → categoría → (torneo+cat si n≥30) → cat+tramo.
 * Cada nivel shrink hacia el padre.
 */
export function calibrateHierarchical(
  pick: { categoria: string; torneo: string; pModelo: number },
  index: CalibrationIndex,
  k: number = CFG.shrinkK,
): HierarchicalCalib {
  const cat = normalizeCatKey(pick.categoria);
  const tor = normalizeTorneoKey(pick.torneo);
  const bin = probBin(pick.pModelo);
  const pModelo = clip(normProb(pick.pModelo), 0, 1);

  const market = index.market;
  const pMercado =
    market.n > 0 ? bayesianShrink(market.rate, market.n, 0.5, k) : 0.5;

  const catStat = index.byCat.get(cat);
  const pCat = catStat && catStat.n > 0
    ? bayesianShrink(catStat.rate, catStat.n, pMercado, k)
    : pMercado;

  const torCatStat = index.byTorCat.get(`${tor}|${cat}`);
  const nTorCat = torCatStat?.n ?? 0;
  const torEligible = nTorCat >= CFG.minNTorneoCat;
  let pTorCat: number | null = null;
  let parentAfterTor = pCat;
  if (torEligible && torCatStat) {
    pTorCat = bayesianShrink(torCatStat.rate, torCatStat.n, pCat, k);
    parentAfterTor = pTorCat;
  }

  const catBinStat = index.byCatBin.get(`${cat}|${bin}`);
  let pCatBin: number | null = null;
  let pCalibrada: number;
  let nEff: number;
  let level: CalibLevel;
  let ciSource: GroupStat | null = null;

  if (catBinStat && catBinStat.n > 0) {
    pCatBin = bayesianShrink(catBinStat.rate, catBinStat.n, parentAfterTor, k);
    pCalibrada = pCatBin;
    nEff = catBinStat.n;
    level = 'cat_bin';
    ciSource = catBinStat;
  } else if (torEligible && torCatStat) {
    pCalibrada = parentAfterTor;
    nEff = torCatStat.n;
    level = 'torneo_cat';
    ciSource = torCatStat;
  } else if (catStat && catStat.n > 0) {
    pCalibrada = pCat;
    nEff = catStat.n;
    level = 'categoria';
    ciSource = catStat;
  } else if (market.n > 0) {
    pCalibrada = pMercado;
    nEff = market.n;
    level = 'mercado';
    ciSource = market;
  } else {
    pCalibrada = pModelo;
    nEff = 0;
    level = 'modelo';
    ciSource = null;
  }

  // Info torneo insuficiente: rate empírico solo para penalizar (no boost score)
  if (!torEligible && torCatStat && torCatStat.n > 0) {
    pTorCat = bayesianShrink(torCatStat.rate, torCatStat.n, pCat, k);
  }

  const ci95 = ciSource ? wilsonCi(ciSource.hits, ciSource.n) : null;

  return {
    pCalibrada: clip(pCalibrada, 0.01, 0.99),
    nEff,
    ci95,
    level,
    pMercado,
    pCat,
    pTorCat,
    pCatBin,
    nTorCat,
    torEligible,
  };
}

function distToSweetSpot(edge: number): number {
  if (edge >= CFG.minEdge && edge <= CFG.sweetEdgeMax) return 0;
  if (edge < CFG.minEdge) return CFG.minEdge - edge;
  return edge - CFG.sweetEdgeMax;
}

function fEdgeSweet(edge: number): number {
  if (edge <= 0) return 0;
  if (edge < CFG.minEdge) return (edge / CFG.minEdge) * 0.5;
  if (edge <= CFG.sweetEdgeMax) return 1;
  if (edge >= CFG.extremeEdge) return 0.25;
  const t = (edge - CFG.sweetEdgeMax) / (CFG.extremeEdge - CFG.sweetEdgeMax);
  return 1 - 0.75 * t;
}

function computeConfianza(calib: HierarchicalCalib): number {
  if (calib.nEff <= 0 || !calib.ci95) {
    return 0.15;
  }
  const sampleW = calib.nEff / (calib.nEff + CFG.shrinkK);
  const wilsonFloor = calib.ci95.low;
  const levelBoost =
    calib.level === 'cat_bin'
      ? 1
      : calib.level === 'torneo_cat'
        ? 0.95
        : calib.level === 'categoria'
          ? 0.85
          : calib.level === 'mercado'
            ? 0.7
            : 0.4;
  return clip(sampleW * wilsonFloor * levelBoost + (1 - sampleW) * 0.2, 0, 1);
}

function computeRiesgo(
  confianza: number,
  distSweet: number,
  edge: number,
  nEff: number,
): number {
  const extreme =
    edge > CFG.extremeEdge ? 1 : edge > CFG.sweetEdgeMax ? 0.5 : 0;
  const sampleRisk = 1 / (1 + nEff / CFG.shrinkK);
  return clip(
    0.4 * (1 - confianza) +
      0.25 * clip(distSweet / 0.08, 0, 1) +
      0.2 * extreme +
      0.15 * sampleRisk,
    0,
    1,
  );
}

type FailMetrics = {
  pModelo: number;
  pCalibrada: number;
  qImpl: number;
  edgeVsMarket: number;
  ev: number;
  distSweetSpot: number;
  confianza: number;
  riesgo: number;
  nEff: number;
  ci95: Ci95 | null;
  calibLevel: CalibLevel;
  factors: ScoredPick['factors'];
};

function fail(
  pick: PickInput,
  reason: string,
  m?: Partial<FailMetrics>,
): ScoredPick {
  const pModelo = m?.pModelo ?? (Number.isFinite(normProb(pick.probabilidad))
    ? normProb(pick.probabilidad)
    : 0);
  const pCalibrada = m?.pCalibrada ?? 0;
  const edgeVsMarket = m?.edgeVsMarket ?? 0;
  return {
    id: pick.id,
    fixtureId: pick.fixtureId,
    label: 'descartar',
    score: 0,
    pModelo,
    pCalibrada,
    qImpl: m?.qImpl ?? 0,
    edgeVsMarket,
    ev: m?.ev ?? 0,
    distSweetSpot: m?.distSweetSpot ?? 0,
    confianza: m?.confianza ?? 0,
    riesgo: m?.riesgo ?? 1,
    nEff: m?.nEff ?? 0,
    ci95: m?.ci95 ?? null,
    calibLevel: m?.calibLevel ?? 'modelo',
    reasons: [reason],
    factors: m?.factors ?? {
      fEv: 0,
      fEdge: 0,
      fConf: 0,
      fRisk: 1,
      penSample: 0,
      penEdge: 0,
      torDelta: 0,
      torBoostBlocked: false,
    },
    pRaw: pModelo,
    pCorr: pCalibrada,
    edgeCorr: edgeVsMarket,
  };
}

/** Evalúa un pick con índice de calibración (solo pasado). */
export function scorePick(
  pick: PickInput,
  historyOrIndex: HistoryCase[] | CalibrationIndex,
  opts?: { shrinkK?: number },
): ScoredPick {
  const k = opts?.shrinkK ?? CFG.shrinkK;
  const index = Array.isArray(historyOrIndex)
    ? buildCalibrationIndex(historyOrIndex)
    : historyOrIndex;

  const reasons: string[] = [];
  const cat = normalizeCatKey(pick.categoria);
  const pModelo = normProb(pick.probabilidad);
  const cuota = pick.cuota;

  if (!Number.isFinite(pModelo) || pModelo <= 0 || pModelo >= 1) {
    return fail(pick, 'Probabilidad inválida');
  }
  if (!Number.isFinite(cuota) || cuota < 1.01) {
    return fail(pick, 'Cuota inválida o ausente');
  }

  const calib = calibrateHierarchical(
    { categoria: pick.categoria, torneo: pick.torneo, pModelo },
    index,
    k,
  );

  const pCalibrada = calib.pCalibrada;
  const qImpl = 1 / cuota;
  const edgeVsMarket = pCalibrada - qImpl;
  const ev = pCalibrada * cuota - 1;
  const distSweetSpot = distToSweetSpot(edgeVsMarket);
  const confianza = computeConfianza(calib);
  const riesgo = computeRiesgo(confianza, distSweetSpot, edgeVsMarket, calib.nEff);

  const baseFactors: ScoredPick['factors'] = {
    fEv: 0,
    fEdge: 0,
    fConf: confianza,
    fRisk: riesgo,
    penSample: 0,
    penEdge: 0,
    torDelta: 0,
    torBoostBlocked: !calib.torEligible && calib.nTorCat > 0,
  };

  const metrics: FailMetrics = {
    pModelo,
    pCalibrada,
    qImpl,
    edgeVsMarket,
    ev,
    distSweetSpot,
    confianza,
    riesgo,
    nEff: calib.nEff,
    ci95: calib.ci95,
    calibLevel: calib.level,
    factors: baseFactors,
  };

  if (CAT_VETO.has(cat)) {
    return fail(pick, `Categoría vetada: ${cat}`, metrics);
  }
  if (cuota < CFG.minOdds) {
    return fail(
      pick,
      `Cuota ${cuota.toFixed(2)} < mínimo ${CFG.minOdds}`,
      metrics,
    );
  }
  if (pCalibrada < CFG.minPCal) {
    return fail(
      pick,
      `p_cal ${pct(pCalibrada)} < mínimo ${pct(CFG.minPCal)}`,
      metrics,
    );
  }
  if (ev <= 0) {
    return fail(pick, `EV ≤ 0 (${(ev * 100).toFixed(1)}%)`, metrics);
  }
  if (edgeVsMarket < CFG.minEdge) {
    return fail(
      pick,
      `Edge ${pp(edgeVsMarket)} < mínimo ${pp(CFG.minEdge)}`,
      metrics,
    );
  }

  const fEv = clip(ev / 0.12, 0, 1);
  const fEd = fEdgeSweet(edgeVsMarket);
  const fConf = confianza;
  const fRisk = 1 - riesgo;

  let penEdge = 0;
  if (edgeVsMarket > CFG.extremeEdge) {
    penEdge = 15;
    reasons.push(`Edge extremo ${pp(edgeVsMarket)}: −15`);
  } else if (edgeVsMarket > CFG.sweetEdgeMax) {
    penEdge =
      5 *
      ((edgeVsMarket - CFG.sweetEdgeMax) /
        (CFG.extremeEdge - CFG.sweetEdgeMax));
    reasons.push(`Fuera de sweet spot: −${penEdge.toFixed(1)}`);
  }

  let penSample = 0;
  if (calib.nEff < CFG.minNTrust) {
    penSample += 12 * (1 - calib.nEff / CFG.minNTrust);
    reasons.push(`n_eff=${calib.nEff} < ${CFG.minNTrust}: penalización muestra`);
  }

  // Delta torneo vs categoría: solo puede bajar el score si n < 30
  let torDelta = 0;
  let torBoostBlocked = false;
  if (calib.pTorCat != null && calib.nTorCat > 0) {
    const rawDelta = (calib.pTorCat - calib.pCat) * 40; // escala suave a puntos
    if (!calib.torEligible) {
      torBoostBlocked = true;
      torDelta = Math.min(0, rawDelta);
      if (rawDelta > 0) {
        reasons.push(
          `Torneo n=${calib.nTorCat} < ${CFG.minNTorneoCat}: boost bloqueado`,
        );
      } else if (rawDelta < 0) {
        reasons.push(
          `Torneo flojo (n=${calib.nTorCat}): ${torDelta.toFixed(1)} pts`,
        );
      }
    } else {
      torDelta = rawDelta;
      reasons.push(
        `Torneo+cat n=${calib.nTorCat}: ${torDelta >= 0 ? '+' : ''}${torDelta.toFixed(1)} pts`,
      );
    }
  }

  let score =
    100 * (0.35 * fEv + 0.25 * fEd + 0.25 * fConf + 0.15 * fRisk) -
    penEdge -
    penSample +
    torDelta;
  score = clip(score, 0, 100);

  const ciTxt = calib.ci95
    ? `IC95 ${pct(calib.ci95.low)}–${pct(calib.ci95.high)}`
    : 'IC95 —';

  reasons.push(
    `p_modelo ${pct(pModelo)} → p_cal ${pct(pCalibrada)} [${calib.level}]`,
  );
  reasons.push(
    `q_impl ${pct(qImpl)}; edge ${pp(edgeVsMarket)}; EV ${(ev * 100).toFixed(1)}%`,
  );
  reasons.push(
    `sweetΔ ${pp(distSweetSpot)}; n_eff=${calib.nEff}; conf ${(confianza * 100).toFixed(0)}%; riesgo ${(riesgo * 100).toFixed(0)}%; ${ciTxt}`,
  );

  let label: PickLabel = 'descartar';
  if (score >= CFG.scoreSelect) {
    label = 'seleccionable';
    reasons.push(
      `Score compuesto ${score.toFixed(1)} ≥ ${CFG.scoreSelect} → seleccionable (orden, no prob.)`,
    );
  } else if (score >= CFG.scoreDoubt) {
    label = 'dudoso';
    reasons.push(
      `Score compuesto ${score.toFixed(1)} dudoso [${CFG.scoreDoubt}, ${CFG.scoreSelect})`,
    );
  } else {
    reasons.push(
      `Score compuesto ${score.toFixed(1)} < ${CFG.scoreDoubt} → descartar`,
    );
  }

  return {
    id: pick.id,
    fixtureId: pick.fixtureId,
    label,
    score: round1(score),
    pModelo,
    pCalibrada,
    qImpl,
    edgeVsMarket,
    ev,
    distSweetSpot,
    confianza,
    riesgo,
    nEff: calib.nEff,
    ci95: calib.ci95,
    calibLevel: calib.level,
    reasons,
    factors: {
      fEv,
      fEdge: fEd,
      fConf,
      fRisk,
      penSample,
      penEdge,
      torDelta,
      torBoostBlocked,
    },
    pRaw: pModelo,
    pCorr: pCalibrada,
    edgeCorr: edgeVsMarket,
  };
}

function sortByEv(a: ScoredPick, b: ScoredPick) {
  return b.ev - a.ev || b.score - a.score;
}

function sortByConfianza(a: ScoredPick, b: ScoredPick) {
  const aLow = a.ci95?.low ?? 0;
  const bLow = b.ci95?.low ?? 0;
  return b.confianza - a.confianza || bLow - aLow || b.score - a.score;
}

function sortByRiesgo(a: ScoredPick, b: ScoredPick) {
  return a.riesgo - b.riesgo || b.confianza - a.confianza || b.score - a.score;
}

function sortByComposite(a: ScoredPick, b: ScoredPick) {
  return b.score - a.score || b.ev - a.ev;
}

function pickBank(
  rankedComposite: ScoredPick[],
): { selected: ScoredPick[]; rejectedSameFixture: ScoredPick[] } {
  const seen = new Set<number>();
  const selected: ScoredPick[] = [];
  const rejectedSameFixture: ScoredPick[] = [];

  for (const row of rankedComposite) {
    if (row.label !== 'seleccionable') continue;
    if (seen.has(row.fixtureId)) {
      rejectedSameFixture.push({
        ...row,
        label: 'descartar',
        score: 0,
        reasons: [
          ...row.reasons,
          'Correlación: ya hay un seleccionable en este fixture',
        ],
      });
      continue;
    }
    seen.add(row.fixtureId);
    selected.push(row);
  }
  return { selected, rejectedSameFixture };
}

/**
 * Ranking + bank (máx. 1 seleccionable/fixture por score compuesto).
 * `history`: casos resueltos estrictamente anteriores se filtran por pick si
 * se pasa el corpus completo; o pasar ya filtrado / un índice compartido.
 */
export function selectPicks(
  picks: PickInput[],
  history: HistoryCase[] = [],
  opts?: { shrinkK?: number; sharedIndex?: boolean },
): SelectPicksResult {
  const k = opts?.shrinkK ?? CFG.shrinkK;

  // Índice compartido: todo el historial (útil si todos los picks son "ahora"
  // y el historial ya es estrictamente pasado). Si hay fechas, filtramos por pick.
  const hasDates =
    picks.some((p) => p.fixtureDateMs > 0) &&
    history.some((h) => h.fixtureDateMs > 0);

  let ranked: ScoredPick[];
  if (!hasDates || opts?.sharedIndex) {
    const index = buildCalibrationIndex(history);
    ranked = picks.map((p) => scorePick(p, index, { shrinkK: k }));
  } else {
    ranked = picks.map((p) => {
      const past = history.filter(
        (h) =>
          h.fixtureDateMs > 0 &&
          h.fixtureDateMs < p.fixtureDateMs &&
          h.id !== p.id,
      );
      return scorePick(p, past, { shrinkK: k });
    });
  }

  const rankedByComposite = [...ranked].sort(sortByComposite);
  const rankedByEv = [...ranked].sort(sortByEv);
  const rankedByConfianza = [...ranked].sort(sortByConfianza);
  const rankedByRiesgo = [...ranked].sort(sortByRiesgo);

  const { selected, rejectedSameFixture } = pickBank(rankedByComposite);
  const rejectedIds = new Set(rejectedSameFixture.map((r) => r.id));
  const counts = { seleccionable: 0, dudoso: 0, descartar: 0 };
  for (const r of ranked) {
    if (rejectedIds.has(r.id)) counts.descartar += 1;
    else counts[r.label] += 1;
  }

  return {
    ranked: rankedByComposite,
    rankedByEv,
    rankedByConfianza,
    rankedByRiesgo,
    rankedByComposite,
    selected,
    rejectedSameFixture,
    counts,
  };
}

function emptySeries(): WalkForwardSeriesStats {
  return {
    nSelected: 0,
    nResolved: 0,
    hits: 0,
    hitRate: null,
    stake: 0,
    profit: 0,
    roi: null,
    maxDrawdown: 0,
  };
}

function finalizeSeries(s: WalkForwardSeriesStats): WalkForwardSeriesStats {
  return {
    ...s,
    hitRate: s.nResolved > 0 ? s.hits / s.nResolved : null,
    roi: s.stake > 0 ? (100 * s.profit) / s.stake : null,
  };
}

/**
 * Backtest walk-forward: solo información previa a cada fixture.
 * Ordena fixtures por fecha; calibra con resueltos anteriores; elige bank;
 * luego incorpora el fixture al historial.
 */
export function runWalkForwardBacktest(
  cases: HistoryCase[],
  opts?: { shrinkK?: number },
): WalkForwardBacktest {
  const k = opts?.shrinkK ?? CFG.shrinkK;
  const sorted = [...cases]
    .filter((c) => c.fixtureDateMs > 0)
    .sort(
      (a, b) =>
        a.fixtureDateMs - b.fixtureDateMs ||
        a.fixtureId - b.fixtureId ||
        a.id.localeCompare(b.id),
    );

  const byFixture = new Map<number, HistoryCase[]>();
  const fixtureOrder: number[] = [];
  for (const c of sorted) {
    if (!byFixture.has(c.fixtureId)) {
      byFixture.set(c.fixtureId, []);
      fixtureOrder.push(c.fixtureId);
    }
    byFixture.get(c.fixtureId)!.push(c);
  }

  let history: HistoryCase[] = [];
  const points: WalkForwardPoint[] = [];
  const byComposite = emptySeries();
  const byEv = emptySeries();
  let equityC = 0;
  let peakC = 0;
  let equityE = 0;
  let peakE = 0;

  for (const fixtureId of fixtureOrder) {
    const group = byFixture.get(fixtureId)!;
    const index = buildCalibrationIndex(history);

    const scored = group.map((c) =>
      scorePick(
        {
          id: c.id,
          fixtureId: c.fixtureId,
          categoria: c.categoria,
          torneo: c.torneo,
          probabilidad: c.pModelo,
          cuota: c.cuota,
          fixtureDateMs: c.fixtureDateMs,
        },
        index,
        { shrinkK: k },
      ),
    );

    const bestComposite = [...scored]
      .filter((s) => s.label === 'seleccionable')
      .sort(sortByComposite)[0];
    const bestEv = [...scored]
      .filter((s) => s.label === 'seleccionable')
      .sort(sortByEv)[0];

    const applyPick = (
      best: ScoredPick | undefined,
      series: WalkForwardSeriesStats,
      equity: { v: number; peak: number },
      record: boolean,
    ) => {
      if (!best) return;
      const src = group.find((g) => g.id === best.id)!;
      const profit = src.hit ? src.cuota - 1 : -1;
      series.nSelected += 1;
      series.nResolved += 1;
      series.stake += 1;
      series.profit += profit;
      if (src.hit) series.hits += 1;
      equity.v += profit;
      equity.peak = Math.max(equity.peak, equity.v);
      series.maxDrawdown = Math.max(series.maxDrawdown, equity.peak - equity.v);
      if (record) {
        points.push({
          id: best.id,
          fixtureId: best.fixtureId,
          fixtureDateMs: src.fixtureDateMs,
          hit: src.hit,
          selected: true,
          score: best.score,
          ev: best.ev,
          pCalibrada: best.pCalibrada,
          label: best.label,
        });
      }
    };

    const eqC = { v: equityC, peak: peakC };
    const eqE = { v: equityE, peak: peakE };
    applyPick(bestComposite, byComposite, eqC, true);
    applyPick(bestEv, byEv, eqE, false);
    equityC = eqC.v;
    peakC = eqC.peak;
    equityE = eqE.v;
    peakE = eqE.peak;

    // Incorporar fixture al historial DESPUÉS de decidir (sin leakage)
    history = history.concat(group);
  }

  return {
    nHistory: sorted.length,
    byComposite: finalizeSeries(byComposite),
    byEv: finalizeSeries(byEv),
    points,
    note:
      'Walk-forward estricto: cada fixture se calibra solo con partidos anteriores. Con ~15 días el n_eff suele ser bajo; el shrinkage (k) domina.',
  };
}

/** Markdown de seleccionables para pegar en LLM / banco */
export function buildSelectedPicksMarkdown(
  selected: ScoredPick[],
  extras?: Map<
    string,
    {
      local: string;
      visitante: string;
      liga: string;
      tipo: string;
      pronostico: string;
      resultado?: string | null;
      marcador?: string | null;
    }
  >,
): string {
  const headers = [
    'Resultado',
    'Marcador',
    'Score',
    'p_modelo',
    'p_cal',
    'q_impl',
    'Edge',
    'EV%',
    'SweetΔ',
    'Conf',
    'Riesgo',
    'n_eff',
    'IC95',
    'Nivel',
    'Local',
    'Visitante',
    'Liga',
    'Tipo',
    'Pronóstico',
    'Fixture',
    'Motivo principal',
  ];
  const lines = [
    '# Picks seleccionables (motor cuantitativo)',
    '',
    '> Score = orden compuesto (no probabilidad).',
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];
  for (const s of selected) {
    const ex = extras?.get(s.id);
    const motivo = s.reasons[0] || '—';
    const res =
      ex?.resultado === 'acertado'
        ? 'Acertado'
        : ex?.resultado === 'fallido'
          ? 'Fallido'
          : 'Pendiente';
    const ci = s.ci95
      ? `${pct(s.ci95.low)}–${pct(s.ci95.high)}`
      : '—';
    const cells = [
      res,
      ex?.marcador ?? '—',
      s.score.toFixed(1),
      pct(s.pModelo),
      pct(s.pCalibrada),
      pct(s.qImpl),
      pp(s.edgeVsMarket),
      (s.ev * 100).toFixed(1),
      pp(s.distSweetSpot),
      `${(s.confianza * 100).toFixed(0)}%`,
      `${(s.riesgo * 100).toFixed(0)}%`,
      String(s.nEff),
      ci,
      s.calibLevel,
      ex?.local ?? '—',
      ex?.visitante ?? '—',
      ex?.liga ?? '—',
      (ex?.tipo || '—').replace(/\|/g, '/'),
      (ex?.pronostico || '—').replace(/\|/g, '/').replace(/\n/g, ' '),
      String(s.fixtureId),
      motivo.replace(/\|/g, '/'),
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}
