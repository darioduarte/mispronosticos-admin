import type { PronosticoIaRow } from './types';

export type SortMode =
  | 'none'
  | 'prob_desc'
  | 'prob_asc'
  | 'cuota_desc'
  | 'cuota_asc'
  | 'valor_desc';

export type PickScope = 'all' | 'valor' | 'normal';

export type ResultFilter = 'all' | 'acertado' | 'fallido' | 'pendiente';

export type PronosticosIaFilters = {
  search: string;
  categoria: string;
  torneo: string;
  resultado: ResultFilter;
  pickScope: PickScope;
  probMin: number;
  probMax: number;
  minCuota: string;
  maxCuota: string;
};

export type StatsOptions = {
  minEvalRanking: number;
  minEvalSegments: number;
  rollingDays: number;
};

export type SegmentRow = {
  label: string;
  total: number;
  ac: number;
  fa: number;
  pe: number;
  resolved: number;
  rate: number | null;
  avgProb: number | null;
  wilson: string;
  lowSample: boolean;
};

export type CalibRow = {
  label: string;
  eval: number;
  rate: number | null;
  mid: number;
  delta: number | null;
  wilson: string;
};

export type PronosticosIaStats = {
  total: number;
  ac: number;
  fa: number;
  pe: number;
  resolved: number;
  rateResolved: number | null;
  rateTotal: number | null;
  bar: { ac: number; fa: number; pe: number };
  avgProb: number | null;
  pickValorCount: number;
  uniqueFixtures: number;
  rolling: { recent: { ac: number; fa: number }; older: { ac: number; fa: number }; noDate: number };
  categorias: SegmentRow[];
  torneos: (SegmentRow & { pais: string; liga: string })[];
  calibracion: CalibRow[];
  lineas: SegmentRow[];
  edge: (SegmentRow & { implAvg: number | null })[];
};

export function parseProb(val: string | number | null | undefined): number | null {
  if (val == null || val === '') return null;
  const s = String(val).replace(/%/g, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseCuotaDecimal(row: PronosticoIaRow): number | null {
  const raw = row.cuota_display ?? row.cuota_decimal ?? row.cuota_llm_decimal;
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n >= 1.01 ? n : null;
}

export function isPickValor(row: PronosticoIaRow): boolean {
  const n = String(row.categoria_pronostico || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  return n === 'PICK_VALOR';
}

export function torneoKey(row: PronosticoIaRow): string {
  const pais = String(row.pais ?? '').trim();
  const liga = String(row.liga ?? '').trim();
  return [pais, liga].filter(Boolean).join(' · ') || 'Sin torneo';
}

export function categoriaKey(row: PronosticoIaRow): string {
  const c = row.categoria_normalizada;
  return c && String(c).trim() ? String(c) : 'otros';
}

export function formatCategoriaLabel(cat: string): string {
  return String(cat).replace(/_/g, ' ');
}

export function wilson95(successes: number, trials: number): { low: number; high: number } | null {
  if (trials <= 0) return null;
  const z = 1.96;
  const phat = successes / trials;
  const zz = z * z;
  const denom = 1 + zz / trials;
  const center = (phat + zz / (2 * trials)) / denom;
  const half =
    (z / denom) * Math.sqrt((phat * (1 - phat)) / trials + zz / (4 * trials * trials));
  return {
    low: Math.max(0, (center - half) * 100),
    high: Math.min(100, (center + half) * 100),
  };
}

export function formatWilson(ac: number, resolved: number): string {
  if (resolved <= 0) return '—';
  const w = wilson95(ac, resolved);
  if (!w) return '—';
  return `${w.low.toFixed(0)}–${w.high.toFixed(0)}%`;
}

function lineBucket(lv: number | null): string {
  if (lv == null) return 'Sin línea numérica';
  if (lv < 2) return '< 2';
  if (lv < 2.5) return '[2, 2.5)';
  if (lv < 3.5) return '[2.5, 3.5)';
  if (lv < 5.5) return '[3.5, 5.5)';
  if (lv < 10) return '[5.5, 10)';
  return '≥ 10';
}

function edgeBucket(deltaPP: number): string {
  if (!Number.isFinite(deltaPP)) return '[0, 5) p.p.';
  if (deltaPP < -10) return '< −10 p.p.';
  if (deltaPP < -5) return '[−10, −5) p.p.';
  if (deltaPP < 0) return '[−5, 0) p.p.';
  if (deltaPP < 5) return '[0, 5) p.p.';
  if (deltaPP < 10) return '[5, 10) p.p.';
  return '≥ 10 p.p.';
}

function catTier(resolved: number, minEvalRanking: number): number {
  if (resolved >= minEvalRanking) return 2;
  if (resolved >= 1) return 1;
  return 0;
}

type Agg = { ac: number; fa: number; pe: number; ps: number; pn: number };

function emptyAgg(): Agg {
  return { ac: 0, fa: 0, pe: 0, ps: 0, pn: 0 };
}

function bumpAgg(o: Agg, res: string, prob: number | null) {
  if (res === 'acertado') o.ac += 1;
  else if (res === 'fallido') o.fa += 1;
  else o.pe += 1;
  if (prob != null) {
    o.ps += prob;
    o.pn += 1;
  }
}

function aggToSegment(
  label: string,
  o: Agg,
  minEvalSegments: number,
  extra: Partial<SegmentRow> = {},
): SegmentRow {
  const resolved = o.ac + o.fa;
  const total = o.ac + o.fa + o.pe;
  const rate = resolved > 0 ? (100 * o.ac) / resolved : null;
  return {
    label,
    total,
    ac: o.ac,
    fa: o.fa,
    pe: o.pe,
    resolved,
    rate,
    avgProb: o.pn > 0 ? o.ps / o.pn : null,
    wilson: formatWilson(o.ac, resolved),
    lowSample: resolved > 0 && resolved < minEvalSegments,
    ...extra,
  };
}

export function filterPronosticosRows(
  rows: PronosticoIaRow[],
  f: PronosticosIaFilters,
): PronosticoIaRow[] {
  const q = f.search.trim().toLowerCase();
  const minC = f.minCuota.trim() ? parseFloat(f.minCuota.replace(',', '.')) : null;
  const maxC = f.maxCuota.trim() ? parseFloat(f.maxCuota.replace(',', '.')) : null;

  return rows.filter((row) => {
    if (f.categoria && categoriaKey(row) !== f.categoria) return false;
    if (f.torneo && torneoKey(row) !== f.torneo) return false;
    if (f.resultado !== 'all' && row.resultado_clase !== f.resultado) return false;

    if (f.pickScope === 'valor' && !isPickValor(row)) return false;
    if (f.pickScope === 'normal' && isPickValor(row)) return false;

    const prob = parseProb(row.probabilidad);
    if (prob != null && (prob < f.probMin || prob > f.probMax)) return false;
    if (prob == null && (f.probMin > 0 || f.probMax < 100)) return false;

    const cuota = parseCuotaDecimal(row);
    if (minC != null && Number.isFinite(minC) && (cuota == null || cuota < minC)) return false;
    if (maxC != null && Number.isFinite(maxC) && (cuota == null || cuota > maxC)) return false;

    if (!q) return true;
    const haystack = [
      row.pronostico,
      row.pronostico_tipo,
      row.teamshomename,
      row.teamsawayname,
      row.equipo_local,
      row.equipo_visitante,
      row.liga,
      row.pais,
      row.categoria_normalizada,
      row.fixtureid,
      row.pronostico_id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function sortPronosticosRows(
  rows: PronosticoIaRow[],
  mode: SortMode,
): PronosticoIaRow[] {
  if (mode === 'none') return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    const pa = parseProb(a.probabilidad) ?? -1;
    const pb = parseProb(b.probabilidad) ?? -1;
    const ca = parseCuotaDecimal(a) ?? -1;
    const cb = parseCuotaDecimal(b) ?? -1;
    const da = a.fixturedate ? Date.parse(String(a.fixturedate)) : 0;
    const db = b.fixturedate ? Date.parse(String(b.fixturedate)) : 0;

    switch (mode) {
      case 'prob_desc':
        return pb - pa || db - da;
      case 'prob_asc':
        return pa - pb || db - da;
      case 'cuota_desc':
        return cb - ca || pb - pa;
      case 'cuota_asc':
        return ca - cb || pb - pa;
      case 'valor_desc':
        return pb - pa || cb - ca || db - da;
      default:
        return db - da;
    }
  });
  return copy;
}

export function computePronosticosIaStats(
  rows: PronosticoIaRow[],
  options: StatsOptions,
): PronosticosIaStats {
  const { minEvalRanking, minEvalSegments, rollingDays } = options;
  const cutoffMs = Date.now() - rollingDays * 86400000;

  let ac = 0;
  let fa = 0;
  let pe = 0;
  let probSum = 0;
  let probN = 0;
  let pickValorCount = 0;
  const fixtureIds = new Set<number>();

  const catMap = new Map<string, Agg>();
  const torneoMap = new Map<string, Agg & { pais: string; liga: string }>();

  const calibRows = [
    { label: '<50%', lo: 0, hi: 50, mid: 25 },
    { label: '50–60%', lo: 50, hi: 60, mid: 55 },
    { label: '60–70%', lo: 60, hi: 70, mid: 65 },
    { label: '70–80%', lo: 70, hi: 80, mid: 75 },
    { label: '80–90%', lo: 80, hi: 90, mid: 85 },
    { label: '90–100%', lo: 90, hi: 100.0001, mid: 95 },
  ];
  const calibAgg = new Map<string, { ac: number; fa: number }>();
  calibRows.forEach((br) => calibAgg.set(br.label, { ac: 0, fa: 0 }));

  const lineOrder = ['Sin línea numérica', '< 2', '[2, 2.5)', '[2.5, 3.5)', '[3.5, 5.5)', '[5.5, 10)', '≥ 10'];
  const lineAgg = new Map<string, Agg>();
  lineOrder.forEach((k) => lineAgg.set(k, emptyAgg()));

  const edgeOrder = ['< −10 p.p.', '[−10, −5) p.p.', '[−5, 0) p.p.', '[0, 5) p.p.', '[5, 10) p.p.', '≥ 10 p.p.'];
  const edgeAgg = new Map<string, Agg & { implSum: number; implN: number }>();
  edgeOrder.forEach((k) => edgeAgg.set(k, { ...emptyAgg(), implSum: 0, implN: 0 }));

  const rolling = {
    recent: { ac: 0, fa: 0 },
    older: { ac: 0, fa: 0 },
    noDate: 0,
  };

  for (const row of rows) {
    const res = row.resultado_clase;
    if (res === 'acertado') ac += 1;
    else if (res === 'fallido') fa += 1;
    else pe += 1;

    const prob = parseProb(row.probabilidad);
    if (prob != null) {
      probSum += prob;
      probN += 1;
    }
    if (isPickValor(row)) pickValorCount += 1;
    if (row.fixtureid) fixtureIds.add(row.fixtureid);

    const cat = categoriaKey(row);
    if (!catMap.has(cat)) catMap.set(cat, emptyAgg());
    bumpAgg(catMap.get(cat)!, res, prob);

    const tKey = torneoKey(row);
    if (!torneoMap.has(tKey)) {
      torneoMap.set(tKey, {
        ...emptyAgg(),
        pais: String(row.pais ?? '').trim() || '—',
        liga: String(row.liga ?? '').trim() || '—',
      });
    }
    bumpAgg(torneoMap.get(tKey)!, res, prob);

    if (res !== 'pendiente' && prob != null) {
      for (const br of calibRows) {
        if (prob >= br.lo && prob < br.hi) {
          const cg = calibAgg.get(br.label)!;
          if (res === 'acertado') cg.ac += 1;
          else cg.fa += 1;
          break;
        }
      }
      const tms = row.fixturedate ? Date.parse(String(row.fixturedate)) : NaN;
      if (!Number.isFinite(tms)) rolling.noDate += 1;
      else if (tms >= cutoffMs) {
        if (res === 'acertado') rolling.recent.ac += 1;
        else rolling.recent.fa += 1;
      } else {
        if (res === 'acertado') rolling.older.ac += 1;
        else rolling.older.fa += 1;
      }
    }

    const lvRaw = row.linea_normalizada;
    const lv =
      lvRaw != null && String(lvRaw).trim() !== '' && String(lvRaw).trim() !== '-'
        ? parseFloat(String(lvRaw).replace(',', '.'))
        : null;
    const lk = lineBucket(Number.isFinite(lv!) ? lv : null);
    bumpAgg(lineAgg.get(lk)!, res, prob);

    const cuota = parseCuotaDecimal(row);
    if (prob != null && cuota != null) {
      const implPct = 100 / cuota;
      const ek = edgeBucket(prob - implPct);
      const esg = edgeAgg.get(ek)!;
      bumpAgg(esg, res, prob);
      esg.implSum += implPct;
      esg.implN += 1;
    }
  }

  const total = rows.length;
  const resolved = ac + fa;

  const categorias = [...catMap.entries()]
    .map(([cat, o]) => aggToSegment(cat, o, minEvalSegments))
    .sort((a, b) => {
      const ta = catTier(a.resolved, minEvalRanking);
      const tb = catTier(b.resolved, minEvalRanking);
      if (tb !== ta) return tb - ta;
      return (b.rate ?? -1) - (a.rate ?? -1) || b.total - a.total;
    });

  const torneos = [...torneoMap.entries()]
    .map(([key, o]) => ({
      ...aggToSegment(key, o, minEvalSegments),
      pais: o.pais,
      liga: o.liga,
    }))
    .sort((a, b) => {
      const ta = catTier(a.resolved, minEvalRanking);
      const tb = catTier(b.resolved, minEvalRanking);
      if (tb !== ta) return tb - ta;
      return (b.rate ?? -1) - (a.rate ?? -1) || b.total - a.total;
    });

  const calibracion: CalibRow[] = calibRows.map((br) => {
    const cg = calibAgg.get(br.label)!;
    const ev = cg.ac + cg.fa;
    const rate = ev > 0 ? (100 * cg.ac) / ev : null;
    const delta = rate != null ? rate - br.mid : null;
    return {
      label: br.label,
      eval: ev,
      rate,
      mid: br.mid,
      delta,
      wilson: formatWilson(cg.ac, ev),
    };
  });

  const lineas = lineOrder.map((k) => aggToSegment(k, lineAgg.get(k)!, minEvalSegments));

  const edge = edgeOrder.map((k) => {
    const esg = edgeAgg.get(k)!;
    const seg = aggToSegment(k, esg, minEvalSegments);
    return {
      ...seg,
      implAvg: esg.implN > 0 ? esg.implSum / esg.implN : null,
    };
  });

  return {
    total,
    ac,
    fa,
    pe,
    resolved,
    rateResolved: resolved > 0 ? (100 * ac) / resolved : null,
    rateTotal: total > 0 ? (100 * ac) / total : null,
    bar: {
      ac: total > 0 ? (100 * ac) / total : 0,
      fa: total > 0 ? (100 * fa) / total : 0,
      pe: total > 0 ? (100 * pe) / total : 0,
    },
    avgProb: probN > 0 ? probSum / probN : null,
    pickValorCount,
    uniqueFixtures: fixtureIds.size,
    rolling,
    categorias,
    torneos,
    calibracion,
    lineas,
    edge,
  };
}
