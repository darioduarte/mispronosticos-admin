'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  OddsSections,
  parseCuotaNum,
  scoreCuotaHaystack,
  type OddsHighlightHint,
} from '@/components/pronosticos-ia/odds-referencia-modal';
import { fetchCuotasMomento } from '@/lib/api';
import { findLiveOddForTipo, promptLineSectionMap } from '@/lib/live-odds-match';
import type { ErrorCuotaIaRow } from '@/lib/types';

type Props = {
  row: ErrorCuotaIaRow;
  onClose: () => void;
};

function matchLabel(row: ErrorCuotaIaRow) {
  return `${row.equipo_local || '—'} vs ${row.equipo_visitante || '—'}`;
}

function highlightHintFromRow(
  row: ErrorCuotaIaRow,
  preferredCuota?: number | null,
): OddsHighlightHint {
  const bm = String(row.cuota_bookmaker || row.bookmaker_display || '').trim();
  return {
    cuota: preferredCuota ?? parseCuotaNum(row.cuota_casa ?? row.cuota_casa_display),
    tipo: [row.tipo, row.categoria_normalizada].filter(Boolean).join(' '),
    bookmaker: bm && bm !== '—' ? bm : null,
  };
}

function scorePromptLine(line: string, section: string, hint: OddsHighlightHint): number {
  const oddMatch = line.match(/(?:cuota\s*)?(\d+[.,]\d{1,3})\b/i);
  return scoreCuotaHaystack(`${section} ${line}`, oddMatch?.[1], hint);
}

export function CuotasMomentoModal({ row, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const query = useQuery({
    queryKey: [
      'cuotas-momento',
      row.fuente,
      row.fixtureid,
      row.liveRunId || '',
      row.windowKey || '',
    ],
    queryFn: () =>
      fetchCuotasMomento({
        fuente: row.fuente,
        fixtureId: row.fixtureid,
        liveRunId: row.liveRunId,
        windowKey: row.windowKey,
      }),
  });

  const data = query.data;
  const isLive = row.fuente === 'vivo';
  const liveMatch = useMemo(
    () =>
      findLiveOddForTipo({
        tipo: row.tipo,
        oddsText: data?.oddsText,
        homeTeam: row.equipo_local,
        awayTeam: row.equipo_visitante,
        storedCuota: parseCuotaNum(row.cuota_casa ?? row.cuota_casa_display),
      }),
    [data?.oddsText, row],
  );
  const hint = useMemo(
    () => highlightHintFromRow(row, liveMatch?.swapped ? liveMatch.odd : null),
    [row, liveMatch],
  );
  const title = isLive ? 'Cuotas live de ese momento' : 'Cuotas prepartido';
  const subtitle = [
    matchLabel(row),
    isLive
      ? `${row.windowLabel || row.windowKey || 'fase'}${
          row.run_minute != null ? ` · min ${row.run_minute}` : ''
        }`
      : null,
    row.tipo ? `Mercado: ${row.tipo}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const promptLines = useMemo(() => {
    if (!data?.oddsText) return [];
    const lines = data.oddsText.replace(/\r\n/g, '\n').split('\n');
    const sections = promptLineSectionMap(data.oddsText);
    const scored = lines.map((line, index) => ({
      index,
      line,
      score: scorePromptLine(line, sections[index] || '', hint),
    }));
    const maxScore = scored.reduce((m, x) => Math.max(m, x.score), 0);
    const hitIndexes = new Set(
      scored
        .filter((x) => maxScore >= 6 && x.score >= maxScore - 2 && x.score >= 6)
        .map((x) => x.index),
    );
    return scored.map((x) => ({ ...x, hit: hitIndexes.has(x.index) }));
  }, [data?.oddsText, hint]);

  const firstHitIndex = promptLines.find((l) => l.hit)?.index ?? -1;

  useEffect(() => {
    if (firstHitIndex < 0) return;
    const id = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(id);
  }, [firstHitIndex, data?.oddsText]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            {data?.source === 'prompt' && (
              <p className="mt-1 text-xs text-amber-200/80">
                {isLive
                  ? 'Tomadas del prompt guardado (no se consulta el API live).'
                  : 'Tomadas del prompt guardado del análisis.'}
              </p>
            )}
            {data?.source === 'api' && (
              <p className="mt-1 text-xs text-slate-500">Fuente: API-Football prepartido.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-5">
          <ErrorCuotaHint row={row} liveMatch={liveMatch} />
          {query.isLoading && <p className="text-sm text-slate-400">Cargando cuotas…</p>}
          {query.isError && (
            <p className="text-sm text-red-300">{(query.error as Error).message}</p>
          )}
          {data && !data.success && (
            <p className="text-sm text-red-300">
              {data.error || 'No se pudieron cargar las cuotas'}
            </p>
          )}
          {data?.success && data.message && (
            <p className="mb-3 text-xs text-amber-200/90">{data.message}</p>
          )}
          {data?.success && data.odds && <OddsSections odds={data.odds} highlight={hint} />}
          {data?.success && data.oddsText && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {firstHitIndex >= 0
                    ? liveMatch?.swapped
                      ? 'Resaltado: cuota correcta del mercado (la IA copió el Over/Under contrario).'
                      : 'Resaltado: línea que coincide con la cuota del error.'
                    : 'No se encontró una línea clara para esa cuota; revisa el bloque.'}
                </p>
                <button
                  type="button"
                  onClick={() => void copyText(data.oddsText || '')}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
                >
                  {copied ? 'Copiado' : 'Copiar bloque'}
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 font-mono text-xs leading-relaxed">
                {promptLines.map((item) => (
                  <div
                    key={item.index}
                    ref={item.index === firstHitIndex ? highlightRef : undefined}
                    className={
                      item.hit
                        ? 'rounded bg-amber-400/25 px-1.5 py-0.5 font-semibold text-amber-100 ring-1 ring-amber-400/40'
                        : 'px-1.5 text-slate-300'
                    }
                  >
                    {item.line || '\u00a0'}
                    {item.hit ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        cuota del error
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data?.success && !data.odds && !data.oddsText && (
            <p className="text-sm text-slate-400">
              {data.message || 'No hay cuotas para mostrar.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorCuotaHint({
  row,
  liveMatch,
}: {
  row: ErrorCuotaIaRow;
  liveMatch: ReturnType<typeof findLiveOddForTipo>;
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">
          Cuota tomada en este error
        </p>
        <p className="mt-1 font-medium">
          {row.tipo || 'Mercado'} · @{row.cuota_casa_display}
          {row.bookmaker_display && row.bookmaker_display !== '—'
            ? ` · ${row.bookmaker_display}`
            : ''}
        </p>
      </div>
      {liveMatch?.swapped ? (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-300">
            Cuota invertida Over/Under
          </p>
          <p className="mt-1">
            El tipo es <span className="font-semibold">{liveMatch.side}</span> {liveMatch.linea}{' '}
            ({liveMatch.section}), pero la IA guardó @{row.cuota_casa_display} (lado contrario
            {liveMatch.oppositeOdd != null ? ` ${liveMatch.oppositeOdd}` : ''}). La cuota del
            BLOQUE 5 para ese mercado es <span className="font-semibold">@{liveMatch.odd}</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
