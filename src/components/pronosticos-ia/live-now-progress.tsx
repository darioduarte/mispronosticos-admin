'use client';

import { useEffect, useState } from 'react';
import type { LiveNowJobFailure, LiveNowPlanFixture } from '@/lib/types';
import { copyTextToClipboard } from '@/lib/sync-stats-source';

export type LiveNowProgressState = {
  phase: 'planning' | 'generating' | 'done' | 'cancelled' | 'error';
  total: number;
  current: number;
  ok: number;
  skipped: number;
  failed: number;
  currentFixture: LiveNowPlanFixture | null;
  recentLog: string[];
  isPausing?: boolean;
  pauseMs?: number;
  startedAtMs?: number;
  llmProvider?: string | null;
  errorMessage?: string | null;
  errorDetail?: string | null;
  errorCopyText?: string | null;
  failures?: LiveNowJobFailure[];
};

type Props = {
  progress: LiveNowProgressState;
  pauseMs: number;
  onCancel: () => void;
  onMinimize?: () => void;
};

export function LiveNowProgressModal({ progress, pauseMs, onCancel, onMinimize }: Props) {
  const [errorCopied, setErrorCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const busy = progress.phase === 'planning' || progress.phase === 'generating';

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const pct =
    progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;
  const remaining = Math.max(0, progress.total - progress.current);
  const elapsedMs =
    progress.startedAtMs != null ? Math.max(0, nowMs - progress.startedAtMs) : 0;
  const etaMs =
    progress.phase === 'generating' && progress.current > 0 && remaining > 0
      ? Math.round((elapsedMs / progress.current) * remaining)
      : null;

  const fx = progress.currentFixture;
  const label = progress.isPausing
    ? `Pausa ${formatPauseMs(progress.pauseMs ?? 0)} entre partidos…`
    : fx
      ? `${fx.homeTeam} vs ${fx.awayTeam}`
      : progress.phase === 'planning'
        ? 'Buscando partidos en vivo…'
        : progress.phase === 'done'
          ? 'Generación finalizada'
          : progress.phase === 'cancelled'
            ? 'Cancelado'
            : '—';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        role="dialog"
        aria-labelledby="live-now-title"
        aria-busy={busy}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="live-now-title" className="text-lg font-semibold text-white">
              Generando análisis IA en vivo
            </h2>
            <PhaseBadge phase={progress.phase} isPausing={progress.isPausing} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Partidos en juego ahora (minuto 1+ / HT / ET)
            {(progress.pauseMs ?? pauseMs) > 0 && (
              <span className="block text-xs text-slate-500 sm:ml-2 sm:inline">
                · pausa {formatPauseMs(progress.pauseMs ?? pauseMs)} entre partidos
              </span>
            )}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Corre en el servidor, en cola: un partido a la vez. Puedes salir de esta página y el
            proceso sigue. Cada llamada al LLM puede tardar 30–90s
            {progress.llmProvider ? ` · proveedor: ${progress.llmProvider}` : ''}.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2 text-sm">
              <div>
                <p className="font-medium text-slate-200">
                  {progress.isPausing
                    ? 'Esperando antes del siguiente'
                    : progress.phase === 'planning'
                      ? 'Planificando'
                      : progress.phase === 'generating'
                        ? 'Generando con IA'
                        : progress.phase === 'done'
                          ? 'Completado'
                          : progress.phase === 'cancelled'
                            ? 'Cancelado'
                            : 'Error'}
                </p>
                <p className="mt-0.5 text-slate-400">
                  {progress.phase === 'planning'
                    ? 'Listando partidos en vivo…'
                    : progress.total > 0
                      ? `${progress.current} de ${progress.total} · quedan ${remaining}`
                      : 'Sin partidos en el plan'}
                </p>
              </div>
              <span className="font-mono text-2xl font-semibold text-orange-300">
                {busy && progress.phase === 'planning' ? '…' : `${busy ? pct : 100}%`}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#0b0f14]">
              <div
                className="h-full rounded-full bg-orange-600 transition-all duration-300 ease-out"
                style={{
                  width: `${busy && progress.phase === 'planning' ? 12 : pct}%`,
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Transcurrido: {formatDuration(elapsedMs)}</span>
              {etaMs != null && busy && <span>ETA restante: ~{formatDuration(etaMs)}</span>}
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-[#0b0f14]/80 px-4 py-3">
            <p className="text-xs text-slate-500">Partido actual</p>
            <p className="mt-1 truncate text-sm font-medium text-white">{label}</p>
            {fx?.fixtureId != null && (
              <p className="mt-1 text-xs text-slate-600">
                ID {fx.fixtureId}
                {fx.statusLabel ? ` · ${fx.statusLabel}` : ''}
                {fx.scoreHome != null && fx.scoreAway != null
                  ? ` · ${fx.scoreHome}–${fx.scoreAway}`
                  : ''}
                {fx.league ? ` · ${fx.league}` : ''}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <Stat label="OK" value={progress.ok} className="text-emerald-400" />
            <Stat label="Omitidos" value={progress.skipped} className="text-slate-400" />
            <Stat label="Fallos" value={progress.failed} className="text-red-400" />
            <Stat label="Total" value={progress.total} className="text-slate-300" />
          </div>

          {progress.recentLog.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Registro reciente
              </p>
              <ul className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-[#0b0f14]/60 p-3 font-mono text-xs">
                {progress.recentLog.map((line, i) => (
                  <li
                    key={`${i}-${line.slice(0, 24)}`}
                    className={
                      line.startsWith('✗')
                        ? 'text-red-300'
                        : line.startsWith('✓')
                          ? 'text-emerald-300'
                          : line.startsWith('○')
                            ? 'text-slate-400'
                            : 'text-slate-500'
                    }
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {progress.failed > 0 && (progress.failures?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Errores por partido
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/10 p-3 font-mono text-xs text-red-200/90">
                {(progress.failures ?? []).map((item) => (
                  <li key={`${item.fixtureId}-${item.error.slice(0, 24)}`}>
                    ✗ {item.fixtureId} {item.homeTeam} vs {item.awayTeam} — {item.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {progress.phase === 'error' && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-3">
              <p className="text-sm font-semibold text-red-200">Error al generar</p>
              <p className="mt-1 break-words text-sm text-red-100/90">
                {progress.errorMessage || 'Error desconocido'}
              </p>
              {progress.errorDetail ? (
                <p className="mt-2 break-all font-mono text-[11px] text-red-200/70">
                  {progress.errorDetail}
                </p>
              ) : null}
              <button
                type="button"
                onClick={async () => {
                  const text =
                    progress.errorCopyText ||
                    [progress.errorMessage, progress.errorDetail].filter(Boolean).join('\n');
                  const ok = await copyTextToClipboard(text);
                  setErrorCopied(ok);
                  window.setTimeout(() => setErrorCopied(false), 2500);
                }}
                className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/20"
              >
                {errorCopied ? 'Copiado' : 'Copiar error'}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
          {busy ? (
            <>
              {onMinimize && (
                <button
                  type="button"
                  onClick={onMinimize}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                >
                  Seguir en segundo plano
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseBadge({
  phase,
  isPausing,
}: {
  phase: LiveNowProgressState['phase'];
  isPausing?: boolean;
}) {
  const text = isPausing
    ? 'Pausa'
    : phase === 'planning'
      ? 'Planificando'
      : phase === 'generating'
        ? 'En curso'
        : phase === 'done'
          ? 'Listo'
          : phase === 'cancelled'
            ? 'Cancelado'
            : 'Error';
  const cls = isPausing
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    : phase === 'planning' || phase === 'generating'
      ? 'border-orange-500/30 bg-orange-500/10 text-orange-200'
      : phase === 'done'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        : phase === 'cancelled'
          ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
          : 'border-red-500/30 bg-red-500/10 text-red-200';
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {text}
    </span>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0b0f14]/60 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${className}`}>{value}</p>
    </div>
  );
}

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatPauseMs(ms: number) {
  if (ms <= 0) return '0 s';
  if (ms < 1000) return `${ms} ms`;
  return `${ms / 1000} s`;
}
