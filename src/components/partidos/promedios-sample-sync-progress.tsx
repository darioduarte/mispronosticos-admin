'use client';

import { useEffect, useState } from 'react';
import type {
  PromediosSampleSyncPlanFixture,
  PromediosSampleSyncMissing,
} from '@/lib/types';
import { copyTextToClipboard } from '@/lib/sync-stats-source';

export type PromediosSampleSyncProgressState = {
  phase:
    | 'planning'
    | 'syncing_samples'
    | 'recalculating'
    | 'done'
    | 'cancelled'
    | 'error';
  syncTotal: number;
  syncCurrent: number;
  syncOk: number;
  syncFailed: number;
  recalcTotal: number;
  recalcCurrent: number;
  recalcOk: number;
  recalcFailed: number;
  currentSample: PromediosSampleSyncMissing | null;
  currentFixture: PromediosSampleSyncPlanFixture | null;
  recentLog: string[];
  isPausing?: boolean;
  pauseMs?: number;
  startedAtMs?: number;
  errorMessage?: string | null;
  errorDetail?: string | null;
  errorCopyText?: string | null;
};

type Props = {
  progress: PromediosSampleSyncProgressState;
  desde: string;
  hasta: string;
  pauseMs: number;
  onCancel: () => void;
};

export function PromediosSampleSyncProgressModal({
  progress,
  desde,
  hasta,
  pauseMs,
  onCancel,
}: Props) {
  const [errorCopied, setErrorCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const busy =
    progress.phase === 'planning' ||
    progress.phase === 'syncing_samples' ||
    progress.phase === 'recalculating';

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const inSync = progress.phase === 'syncing_samples';
  const inRecalc = progress.phase === 'recalculating';
  const phaseTotal = inSync
    ? progress.syncTotal
    : inRecalc
      ? progress.recalcTotal
      : progress.syncTotal + progress.recalcTotal;
  const phaseCurrent = inSync
    ? progress.syncCurrent
    : inRecalc
      ? progress.recalcCurrent
      : progress.syncCurrent + progress.recalcCurrent;
  const overallTotal = progress.syncTotal + progress.recalcTotal;
  const overallCurrent = progress.syncCurrent + progress.recalcCurrent;
  const pct =
    overallTotal > 0
      ? Math.min(100, Math.round((overallCurrent / overallTotal) * 100))
      : progress.phase === 'planning'
        ? 0
        : 100;

  const elapsedMs =
    progress.startedAtMs != null ? Math.max(0, nowMs - progress.startedAtMs) : 0;

  const label = progress.isPausing
    ? `Pausa ${formatPauseMs(progress.pauseMs ?? pauseMs)}…`
    : inSync && progress.currentSample
      ? `${progress.currentSample.homeTeam} vs ${progress.currentSample.awayTeam}`
      : inRecalc && progress.currentFixture
        ? `${progress.currentFixture.homeTeam} vs ${progress.currentFixture.awayTeam}`
        : progress.phase === 'planning'
          ? 'Analizando muestras de promedios…'
          : progress.phase === 'done'
            ? 'Proceso finalizado'
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
        aria-labelledby="promedios-sample-sync-title"
        aria-busy={busy}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="promedios-sample-sync-title" className="text-lg font-semibold text-white">
              Sync muestras + recalcular promedios
            </h2>
            <PhaseBadge phase={progress.phase} isPausing={progress.isPausing} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {desde} → {hasta}
            {(progress.pauseMs ?? pauseMs) > 0 && (
              <span className="block text-xs text-slate-500 sm:inline sm:ml-2">
                · pausa sync {formatPauseMs(progress.pauseMs ?? pauseMs)}
              </span>
            )}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            1) Sincroniza stats FLB de partidos de la muestra sin estadísticas · 2) Recalcula y
            guarda promedios de los partidos del rango afectados.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2 text-sm">
              <div>
                <p className="font-medium text-slate-200">{phaseTitle(progress.phase)}</p>
                <p className="mt-0.5 text-slate-400">
                  {progress.phase === 'planning'
                    ? 'Buscando muestras sin stats…'
                    : inSync
                      ? `Sync muestra ${progress.syncCurrent}/${progress.syncTotal}`
                      : inRecalc
                        ? `Recalc ${progress.recalcCurrent}/${progress.recalcTotal}`
                        : `Sync ${progress.syncOk}/${progress.syncTotal} · Recalc ${progress.recalcOk}/${progress.recalcTotal}`}
                </p>
              </div>
              <span className="font-mono text-2xl font-semibold text-teal-300">
                {busy && progress.phase === 'planning' ? '…' : `${busy ? pct : 100}%`}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#0b0f14]">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-300 ease-out"
                style={{
                  width: `${busy && progress.phase === 'planning' ? 10 : pct}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Transcurrido: {formatDuration(elapsedMs)}
              {phaseTotal > 0 && busy && phaseCurrent > 0
                ? ` · fase ${phaseCurrent}/${phaseTotal}`
                : ''}
            </p>
          </div>

          <div className="rounded-lg border border-white/5 bg-[#0b0f14]/80 px-4 py-3">
            <p className="text-xs text-slate-500">
              {inSync ? 'Muestra a sincronizar' : inRecalc ? 'Promedios a recalcular' : 'Actual'}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white">{label}</p>
            {inSync && progress.currentSample?.fixtureId != null && (
              <p className="mt-1 text-xs text-slate-600">
                ID {progress.currentSample.fixtureId}
                {progress.currentSample.league
                  ? ` · ${progress.currentSample.league}`
                  : ''}
              </p>
            )}
            {inRecalc && progress.currentFixture?.fixtureId != null && (
              <p className="mt-1 text-xs text-slate-600">
                ID {progress.currentFixture.fixtureId}
                {progress.currentFixture.league
                  ? ` · ${progress.currentFixture.league}`
                  : ''}
                {progress.currentFixture.missingCount != null
                  ? ` · ${progress.currentFixture.missingCount} muestra(s) sync`
                  : ''}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <Stat label="Sync OK" value={progress.syncOk} className="text-emerald-400" />
            <Stat label="Sync fallos" value={progress.syncFailed} className="text-red-400" />
            <Stat label="Recalc OK" value={progress.recalcOk} className="text-teal-300" />
            <Stat label="Recalc fallos" value={progress.recalcFailed} className="text-red-400" />
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
                          : line.startsWith('→')
                            ? 'text-teal-300'
                            : 'text-slate-400'
                    }
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {progress.phase === 'error' && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-3">
              <p className="text-sm font-semibold text-red-200">Error en el proceso</p>
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

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          {busy ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600"
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
  phase: PromediosSampleSyncProgressState['phase'];
  isPausing?: boolean;
}) {
  const text = isPausing
    ? 'Pausa'
    : phase === 'planning'
      ? 'Planificando'
      : phase === 'syncing_samples'
        ? 'Sync FLB'
        : phase === 'recalculating'
          ? 'Recalculando'
          : phase === 'done'
            ? 'Listo'
            : phase === 'cancelled'
              ? 'Cancelado'
              : 'Error';
  const cls = isPausing
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    : phase === 'planning' || phase === 'syncing_samples' || phase === 'recalculating'
      ? 'border-teal-500/30 bg-teal-500/10 text-teal-200'
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

function phaseTitle(phase: PromediosSampleSyncProgressState['phase']) {
  if (phase === 'planning') return 'Preparando plan';
  if (phase === 'syncing_samples') return 'Sincronizando estadísticas de la muestra';
  if (phase === 'recalculating') return 'Recalculando y guardando promedios';
  if (phase === 'done') return 'Completado';
  if (phase === 'cancelled') return 'Cancelado';
  return 'Error';
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
