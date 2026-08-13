'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchOddsReferencia } from '@/lib/api';
import type { MelbetOddItem } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

export function OddsReferenciaModal({ fixtureId, matchLabel, onClose }: Props) {
  const query = useQuery({
    queryKey: ['odds-referencia', fixtureId],
    queryFn: () => fetchOddsReferencia(fixtureId),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Cuotas referencia partido</h2>
            <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-5">
          {query.isLoading && <p className="text-sm text-slate-400">Cargando cuotas…</p>}
          {query.isError && (
            <p className="text-sm text-red-300">{(query.error as Error).message}</p>
          )}
          {query.data && !query.data.success && (
            <p className="text-sm text-red-300">{query.data.error || 'Error al cargar cuotas'}</p>
          )}
          {query.data?.success && query.data.odds && (
            <OddsSections odds={query.data.odds} />
          )}
        </div>
      </div>
    </div>
  );
}

export type OddsHighlightHint = {
  cuota?: number | null;
  tipo?: string | null;
  bookmaker?: string | null;
};

export function OddsSections({
  odds,
  highlight,
}: {
  odds: Record<string, unknown>;
  highlight?: OddsHighlightHint | null;
}) {
  const entries = Object.entries(odds).filter(([, v]) => Array.isArray(v) && (v as unknown[]).length);
  if (entries.length === 0) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
        {JSON.stringify(odds, null, 2)}
      </pre>
    );
  }

  const scored = entries.flatMap(([section, items]) =>
    (items as MelbetOddItem[]).map((item, i) => ({
      key: `${section}-${i}`,
      section,
      item,
      score: scoreOddsItem(item, section, highlight),
    })),
  );
  const maxScore = scored.reduce((m, x) => Math.max(m, x.score), 0);
  const hitKeys = new Set(
    scored
      .filter((x) => maxScore >= 6 && x.score >= maxScore - 2 && x.score >= 6)
      .map((x) => x.key),
  );

  return (
    <div className="space-y-3">
      {entries.map(([section, items]) => {
        const sectionHit = (items as MelbetOddItem[]).some((_, i) =>
          hitKeys.has(`${section}-${i}`),
        );
        return (
          <section
            key={section}
            className={`rounded-lg border bg-[#0b0f14] p-3 ${
              sectionHit
                ? 'border-amber-400/50 border-l-4 border-l-amber-400'
                : 'border-white/10 border-l-4 border-l-indigo-500/60'
            }`}
          >
            <h3 className="mb-2 text-sm font-semibold capitalize text-slate-200">
              {section.replace(/_/g, ' ')}
            </h3>
            <div className="space-y-1">
              {(items as MelbetOddItem[]).map((item, i) => {
                const hit = hitKeys.has(`${section}-${i}`);
                return (
                  <div
                    key={i}
                    className={`flex justify-between gap-2 rounded px-1.5 py-0.5 text-sm ${
                      hit ? 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/40' : ''
                    }`}
                  >
                    <span className={hit ? 'text-amber-50' : 'text-slate-300'}>
                      {item.linea ?? item.value}
                      {item.betName && (
                        <span className="ml-1 text-xs text-slate-500">({item.betName})</span>
                      )}
                      {hit && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                          cuota del error
                        </span>
                      )}
                    </span>
                    <span className={hit ? 'text-amber-200' : 'text-indigo-300'}>
                      {item.odd ?? 'N/A'}
                      {item.bookmaker && (
                        <span className="ml-1 text-xs text-slate-500">({item.bookmaker})</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function scoreOddsItem(
  item: MelbetOddItem,
  section: string,
  highlight?: OddsHighlightHint | null,
): number {
  if (!highlight) return 0;
  const haystack = [item.linea, item.value, item.betName, item.bookmaker, section]
    .filter(Boolean)
    .join(' ');
  return scoreCuotaHaystack(haystack, item.odd, highlight);
}

export function parseCuotaNum(val: string | number | null | undefined): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

export function scoreCuotaHaystack(
  haystack: string,
  odd: string | number | null | undefined,
  highlight: OddsHighlightHint,
): number {
  const text = normalizeText(haystack);
  if (!text) return 0;
  let score = 0;
  const cuota = highlight.cuota != null ? Number(highlight.cuota) : parseCuotaNum(odd);
  const oddNum = parseCuotaNum(odd);
  if (highlight.cuota != null && Number.isFinite(highlight.cuota)) {
    if (oddNum != null && Math.abs(oddNum - highlight.cuota) < 0.02) score += 10;
    else if (oddNum != null && Math.abs(oddNum - highlight.cuota) < 0.08) score += 4;
    else if (textHasCuota(text, highlight.cuota)) score += 8;
  } else if (cuota != null && textHasCuota(text, cuota)) {
    score += 2;
  }

  const bm = String(highlight.bookmaker || '').trim();
  if (bm && bm !== '—' && text.includes(normalizeText(bm))) score += 5;

  const tokens = tipoTokens(highlight.tipo);
  let hits = 0;
  for (const t of tokens) {
    if (text.includes(t)) hits += 1;
  }
  score += hits * 2;
  if (tokens.length >= 2 && hits >= 2) score += 3;

  const wantsUnder = tokens.includes('under') || tokens.includes('menos');
  const wantsOver = tokens.includes('over') || tokens.includes('mas');
  const hasUnder = /\bunder\b|\bmenos\b/.test(text);
  const hasOver = /\bover\b|\bmas\b/.test(text);
  if (wantsUnder && !wantsOver) {
    if (hasUnder) score += 14;
    if (hasOver && !hasUnder) score -= 18;
  }
  if (wantsOver && !wantsUnder) {
    if (hasOver) score += 14;
    if (hasUnder && !hasOver) score -= 18;
  }
  return score;
}

function textHasCuota(text: string, cuota: number): boolean {
  const variants = [
    cuota.toFixed(2),
    cuota.toFixed(1),
    String(cuota),
    cuota.toFixed(2).replace('.', ','),
    cuota.toFixed(1).replace('.', ','),
  ];
  return variants.some((v) => new RegExp(`(?<![\\d])${escapeReg(v)}(?![\\d])`).test(text));
}

function tipoTokens(tipo: string | null | undefined): string[] {
  const raw = normalizeText(tipo || '');
  if (!raw) return [];
  const stop = new Set([
    'de',
    'del',
    'la',
    'el',
    'los',
    'las',
    'un',
    'una',
    'y',
    'o',
    'en',
    'al',
    'a',
    'con',
    'por',
    'para',
    'que',
    'se',
    'su',
    'es',
    'the',
  ]);
  const base = raw
    .split(/[^a-z0-9.]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
  const extra: string[] = [];
  for (const t of base) {
    if (t === 'mas' || t === 'over') extra.push('mas', 'over');
    if (t === 'menos' || t === 'under') extra.push('menos', 'under');
    if (t === 'si' || t === 'yes') extra.push('si', 'yes');
    if (t === 'no') extra.push('no');
    if (t === 'ambos' || t === 'btts' || t === 'gg') extra.push('ambos', 'btts', 'both', 'gg');
    if (t === 'empate' || t === 'draw' || t === 'x') extra.push('empate', 'draw', 'x');
    if (t === 'local' || t === 'home' || t === '1') extra.push('local', 'home');
    if (t === 'visitante' || t === 'away' || t === '2') extra.push('visitante', 'away');
  }
  return [...new Set([...base, ...extra])];
}

function normalizeText(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/más/g, 'mas')
    .trim();
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
