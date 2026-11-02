import type { AverageFilter, AverageMatch, AverageOp, AveragePair, AverageSide } from './types';

const OPS = new Set<AverageOp>(['gte', 'lte', 'gt', 'lt']);
const SIDES = new Set<AverageSide>(['local', 'visitante', 'ambos', 'cualquiera']);

export function parseThreshold(raw: string) {
  const text = raw.trim().replace(',', '.').replace('%', '');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function compareAverage(value: number | null | undefined, op: AverageOp, threshold: number) {
  if (value == null || !Number.isFinite(value) || !Number.isFinite(threshold)) return false;
  if (op === 'gte') return value >= threshold;
  if (op === 'lte') return value <= threshold;
  if (op === 'gt') return value > threshold;
  return value < threshold;
}

function groupPasses(pair: AveragePair | undefined, side: AverageSide, group: AverageFilter[]) {
  const passesAll = (value: number | null | undefined) =>
    group.every((filter) => compareAverage(value, filter.op, filter.value));
  const localOk = passesAll(pair?.local);
  const awayOk = passesAll(pair?.visitante);
  if (side === 'local') return localOk;
  if (side === 'visitante') return awayOk;
  if (side === 'ambos') return localOk && awayOk;
  return localOk || awayOk;
}

export function normalizeAverageFilters(filters: AverageFilter[]) {
  return (filters || []).filter(
    (filter) =>
      Boolean(filter?.metric) &&
      SIDES.has(filter.side) &&
      OPS.has(filter.op) &&
      Number.isFinite(filter.value),
  );
}

export function applyAverageFilters(matches: AverageMatch[], filters: AverageFilter[]) {
  const active = normalizeAverageFilters(filters);
  if (!active.length) return matches;
  const groups = new Map<string, AverageFilter[]>();
  for (const filter of active) {
    const key = `${filter.metric}|${filter.side}`;
    const group = groups.get(key) ?? [];
    group.push(filter);
    groups.set(key, group);
  }
  return matches.filter((match) =>
    [...groups.values()].every((group) => groupPasses(match.promedios?.[group[0].metric], group[0].side, group)),
  );
}
