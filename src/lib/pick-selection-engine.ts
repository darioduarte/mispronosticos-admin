/**
 * Motor de selección de picks prepartido.
 * Probabilidad corregida + categoría (eje principal) + torneo (secundario).
 * Funciones puras; umbrales en CFG.
 */

export type PickLabel = 'seleccionable' | 'dudoso' | 'descartar';

export type PickInput = {
  id: string;
  fixtureId: number;
  categoria: string;
  torneo: string;
  probabilidad: number;
  cuota: number;
};

export type HistStat = { rate: number; n: number };

export type ScoredPick = {
  id: string;
  fixtureId: number;
  label: PickLabel;
  score: number;
  pRaw: number;
  pCorr: number;
  qImpl: number;
  edgeCorr: number;
  ev: number;
  reasons: string[];
  factors: {
    fEv: number;
    fEdge: number;
    fCat: number;
    fTor: number;
    fCalib: number;
    penEdge: number;
    penSample: number;
  };
};

export type SelectPicksResult = {
  ranked: ScoredPick[];
  selected: ScoredPick[];
  rejectedSameFixture: ScoredPick[];
  counts: { seleccionable: number; dudoso: number; descartar: number };
};

export const CFG = {
  minOdds: 1.4,
  minEdge: 0.015,
  sweetEdgeMax: 0.06,
  extremeEdge: 0.12,
  minPCorr: 0.52,
  scoreSelect: 72,
  scoreDoubt: 55,
  catPrior: 0.55,
  catPriorStrength: 40,
  torPrior: 0.62,
  torPriorStrength: 50,
  minNCatTrust: 50,
  minNTorTrust: 40,
} as const;

/** Anclas calibración: prob. modelo → realizado histórico */
const CALIB: [number, number][] = [
  [0.5, 0.279],
  [0.55, 0.439],
  [0.65, 0.571],
  [0.75, 0.757],
  [0.85, 0.779],
  [0.95, 0.924],
];

/** Hard veto: evidencia de bajo acierto o n insuficiente + tasa pésima */
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

export const CAT_HIST: Record<string, HistStat> = {
  goles_visitante_under: { rate: 0.882, n: 246 },
  goles_local_under: { rate: 0.871, n: 85 },
  corners_visitante_under: { rate: 0.864, n: 22 },
  doble_oportunidad: { rate: 0.814, n: 172 },
  corners_under: { rate: 0.782, n: 170 },
  faltas_over: { rate: 0.778, n: 243 },
  goles_local_over: { rate: 0.767, n: 116 },
  goles_over: { rate: 0.753, n: 89 },
  tarjetas_under: { rate: 0.742, n: 151 },
  goles_under: { rate: 0.73, n: 196 },
  corners_visitante_over: { rate: 0.576, n: 33 },
  tarjetas_visitante_under: { rate: 0.517, n: 29 },
  ambos_no_marcan: { rate: 0.476, n: 63 },
  ambos_marcan: { rate: 0.471, n: 17 },
  corners_local_under: { rate: 0.444, n: 9 },
  resultado_local: { rate: 0.375, n: 8 },
  resultado_visitante: { rate: 0.333, n: 6 },
  tarjetas_over: { rate: 0.258, n: 31 },
};

/** Claves = fragmento de "pais · liga" (match por includes; gana la más larga) */
export const TOR_HIST: Record<string, HistStat> = {
  'austria · bundesliga': { rate: 0.861, n: 36 },
  austria: { rate: 0.861, n: 36 },
  'brazil · serie b': { rate: 0.813, n: 128 },
  'serie b': { rate: 0.813, n: 128 },
  'italy · coppa': { rate: 0.8, n: 60 },
  'coppa italia': { rate: 0.8, n: 60 },
  'brazil · serie a': { rate: 0.775, n: 80 },
  'champions league': { rate: 0.769, n: 39 },
  libertadores: { rate: 0.767, n: 60 },
  eredivisie: { rate: 0.767, n: 60 },
  'primeira liga': { rate: 0.766, n: 64 },
  'major league soccer': { rate: 0.757, n: 177 },
  mls: { rate: 0.757, n: 177 },
  'spain · la liga': { rate: 0.738, n: 65 },
  'la liga': { rate: 0.738, n: 65 },
  'liga profesional': { rate: 0.733, n: 131 },
  'peru ·': { rate: 0.667, n: 40 },
  sudamericana: { rate: 0.638, n: 40 },
  'ecuador ·': { rate: 0.632, n: 40 },
  'france · ligue 1': { rate: 0.611, n: 40 },
  'ligue 1': { rate: 0.611, n: 40 },
};

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

/** Calibración piecewise lineal modelo → p* */
export function calibrateProb(pModel: number): number {
  const p = clip(normProb(pModel), 0, 1);
  if (p <= CALIB[0][0]) return CALIB[0][1];
  const last = CALIB[CALIB.length - 1];
  if (p >= last[0]) return last[1];
  for (let i = 0; i < CALIB.length - 1; i++) {
    const [x0, y0] = CALIB[i];
    const [x1, y1] = CALIB[i + 1];
    if (p >= x0 && p <= x1) {
      const t = (p - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return p;
}

function empiricalBayes(
  stat: HistStat | undefined,
  prior: number,
  n0: number,
): { r: number; n: number; known: boolean } {
  if (!stat || stat.n <= 0) return { r: prior, n: 0, known: false };
  const w = stat.n / (stat.n + n0);
  return { r: w * stat.rate + (1 - w) * prior, n: stat.n, known: true };
}

function mapRateToUnit(r: number, lo: number, hi: number): number {
  return clip((r - lo) / (hi - lo), 0, 1);
}

function fEdge(e: number): number {
  if (e <= 0) return 0;
  if (e < CFG.minEdge) return (e / CFG.minEdge) * 0.5;
  if (e <= CFG.sweetEdgeMax) return 1;
  if (e >= CFG.extremeEdge) return 0.25;
  const t = (e - CFG.sweetEdgeMax) / (CFG.extremeEdge - CFG.sweetEdgeMax);
  return 1 - 0.75 * t;
}

function fCalibZone(pRaw: number): number {
  const p = normProb(pRaw);
  if (p >= 0.75) return 1;
  if (p <= 0.55) return 0.35;
  if (p < 0.65) return 0.35 + ((p - 0.55) / 0.1) * 0.25;
  return 0.6 + ((p - 0.65) / 0.1) * 0.4;
}

export function lookupTorneo(name: string): HistStat | undefined {
  const hay = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  if (!hay) return undefined;
  // Preferir match más específico (clave más larga)
  let best: { key: string; stat: HistStat } | null = null;
  for (const [key, stat] of Object.entries(TOR_HIST)) {
    if (!hay.includes(key)) continue;
    if (!best || key.length > best.key.length) best = { key, stat };
  }
  return best?.stat;
}

type Metrics = {
  pRaw: number;
  pCorr: number;
  qImpl: number;
  edgeCorr: number;
  ev: number;
};

function fail(pick: PickInput, reason: string, m?: Partial<Metrics>): ScoredPick {
  return {
    id: pick.id,
    fixtureId: pick.fixtureId,
    label: 'descartar',
    score: 0,
    pRaw: m?.pRaw ?? (Number.isFinite(normProb(pick.probabilidad)) ? normProb(pick.probabilidad) : 0),
    pCorr: m?.pCorr ?? 0,
    qImpl: m?.qImpl ?? 0,
    edgeCorr: m?.edgeCorr ?? 0,
    ev: m?.ev ?? 0,
    reasons: [reason],
    factors: {
      fEv: 0,
      fEdge: 0,
      fCat: 0,
      fTor: 0,
      fCalib: 0,
      penEdge: 0,
      penSample: 0,
    },
  };
}

/** Evalúa un pick (sin descorrelación entre fixtures). */
export function scorePick(pick: PickInput): ScoredPick {
  const reasons: string[] = [];
  const cat = normalizeCatKey(pick.categoria);
  const pRaw = normProb(pick.probabilidad);
  const cuota = pick.cuota;

  if (!Number.isFinite(pRaw) || pRaw <= 0 || pRaw >= 1) {
    return fail(pick, 'Probabilidad inválida');
  }
  if (!Number.isFinite(cuota) || cuota < 1.01) {
    return fail(pick, 'Cuota inválida o ausente');
  }

  const pCorr = calibrateProb(pRaw);
  const qImpl = 1 / cuota;
  const edgeCorr = pCorr - qImpl;
  const ev = pCorr * (cuota - 1) - (1 - pCorr);
  const metrics: Metrics = { pRaw, pCorr, qImpl, edgeCorr, ev };

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
  if (pCorr < CFG.minPCorr) {
    return fail(
      pick,
      `p* ${pct(pCorr)} < mínimo ${pct(CFG.minPCorr)} tras calibración`,
      metrics,
    );
  }
  if (ev <= 0) {
    return fail(pick, `EV ≤ 0 (${(ev * 100).toFixed(1)}%)`, metrics);
  }
  if (edgeCorr < CFG.minEdge) {
    return fail(
      pick,
      `Edge corregido ${pp(edgeCorr)} < mínimo ${pp(CFG.minEdge)}`,
      metrics,
    );
  }

  const catEb = empiricalBayes(CAT_HIST[cat], CFG.catPrior, CFG.catPriorStrength);
  const torEb = empiricalBayes(lookupTorneo(pick.torneo), CFG.torPrior, CFG.torPriorStrength);

  if (!catEb.known) {
    reasons.push('Categoría sin histórico: prior conservador 55%');
  } else if (catEb.n < CFG.minNCatTrust) {
    reasons.push(`Categoría n=${catEb.n} < ${CFG.minNCatTrust}: shrink aplicado`);
  }

  if (catEb.r < 0.58 && catEb.n >= 20) {
    return fail(
      pick,
      `Categoría débil tras shrink (${pct(catEb.r)}, n=${catEb.n})`,
      metrics,
    );
  }

  const fEv = clip(ev / 0.12, 0, 1);
  const fEd = fEdge(edgeCorr);
  const fCat = mapRateToUnit(catEb.r, 0.55, 0.88);
  const fTor = mapRateToUnit(torEb.r, 0.6, 0.86);
  const fCal = fCalibZone(pRaw);

  let penEdge = 0;
  if (edgeCorr > CFG.extremeEdge) {
    penEdge = 15;
    reasons.push(`Edge extremo ${pp(edgeCorr)}: −15 (histórico peor)`);
  } else if (edgeCorr > CFG.sweetEdgeMax) {
    penEdge =
      5 *
      ((edgeCorr - CFG.sweetEdgeMax) / (CFG.extremeEdge - CFG.sweetEdgeMax));
    reasons.push(`Edge sobre sweet spot: −${penEdge.toFixed(1)}`);
  }

  let penSample = 0;
  if (catEb.n > 0 && catEb.n < CFG.minNCatTrust) penSample += 10;
  if (torEb.n > 0 && torEb.n < CFG.minNTorTrust) penSample += 5;
  if (torEb.known && torEb.r < 0.65 && torEb.n >= 30) {
    penSample += 6;
    reasons.push(`Torneo flojo (${pct(torEb.r)}): −6`);
  }

  let score =
    100 * (0.35 * fEv + 0.25 * fEd + 0.25 * fCat + 0.1 * fTor + 0.05 * fCal) -
    penEdge -
    penSample;
  score = clip(score, 0, 100);

  reasons.push(`p modelo ${pct(pRaw)} → p* ${pct(pCorr)}`);
  reasons.push(
    `q ${pct(qImpl)}; edge* ${pp(edgeCorr)}; EV ${(ev * 100).toFixed(1)}%`,
  );
  reasons.push(
    `cat ${fCat.toFixed(2)} (r̃=${pct(catEb.r)}, n=${catEb.n || 0})`,
  );
  reasons.push(
    `tor ${fTor.toFixed(2)} (r̃=${pct(torEb.r)}, n=${torEb.n || 0}) — secundario`,
  );

  let label: PickLabel = 'descartar';
  if (score >= CFG.scoreSelect) {
    label = 'seleccionable';
    reasons.push(`Score ${score.toFixed(1)} ≥ ${CFG.scoreSelect} → seleccionable`);
  } else if (score >= CFG.scoreDoubt) {
    label = 'dudoso';
    reasons.push(
      `Score ${score.toFixed(1)} dudoso [${CFG.scoreDoubt}, ${CFG.scoreSelect})`,
    );
  } else {
    reasons.push(`Score ${score.toFixed(1)} < ${CFG.scoreDoubt} → descartar`);
  }

  return {
    id: pick.id,
    fixtureId: pick.fixtureId,
    label,
    score: round1(score),
    pRaw,
    pCorr,
    qImpl,
    edgeCorr,
    ev,
    reasons,
    factors: {
      fEv,
      fEdge: fEd,
      fCat,
      fTor,
      fCalib: fCal,
      penEdge,
      penSample,
    },
  };
}

/** Ranking + máx. 1 seleccionable por fixture */
export function selectPicks(picks: PickInput[]): SelectPicksResult {
  const ranked = picks
    .map(scorePick)
    .sort((a, b) => b.score - a.score || b.ev - a.ev);

  const seen = new Set<number>();
  const selected: ScoredPick[] = [];
  const rejectedSameFixture: ScoredPick[] = [];

  for (const row of ranked) {
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

  // Ajustar counts con correlacionados como descartar
  const rejectedIds = new Set(rejectedSameFixture.map((r) => r.id));
  const counts = { seleccionable: 0, dudoso: 0, descartar: 0 };
  for (const r of ranked) {
    if (rejectedIds.has(r.id)) counts.descartar += 1;
    else counts[r.label] += 1;
  }

  return {
    ranked,
    selected,
    rejectedSameFixture,
    counts,
  };
}

/** Markdown de seleccionables (máx. 1/partido) para pegar en LLM / banco */
export function buildSelectedPicksMarkdown(
  selected: ScoredPick[],
  extras?: Map<string, { local: string; visitante: string; liga: string; tipo: string; pronostico: string }>,
): string {
  const headers = [
    'Score',
    'p*',
    'Cuota',
    'Edge*',
    'EV%',
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
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];
  for (const s of selected) {
    const ex = extras?.get(s.id);
    const motivo = s.reasons[0] || '—';
    const cells = [
      s.score.toFixed(1),
      pct(s.pCorr),
      (1 / s.qImpl).toFixed(2),
      pp(s.edgeCorr),
      (s.ev * 100).toFixed(1),
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
