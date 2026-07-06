'use client';

import type { PromediosRecalcPlanFixture } from '@/lib/types';

export type PromediosRangeProgressState = {
  phase: 'planning' | 'recalculating' | 'done' | 'cancelled';
  total: number;
  current: number;
  ok: number;
  failed: number;
  currentFixture: PromediosRecalcPlanFixture | null;
  recentLog: string[];
  isPausing?: boolean;
  pauseMs?: number;
};

type Props = {
  progress: PromediosRangeProgressState;
  desde: string;
  hasta: string;
  onlyStale: boolean;
  pauseMs: number;
  onCancel: () => void;
};

export function PromediosRangeProgressModal({
  progress,
  desde,
  hasta,
  onlyStale,
  pauseMs,
  onCancel,
}: Props) {
  const pct =
    progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;
  const busy = progress.phase === 'planning' || progress.phase === 'recalculating';
  const label = progress.isPausing
    ? `Pausa ${formatPauseMs(progress.pauseMs ?? 0)} antes del siguiente…`
    : progress.currentFixture
      ? `${progress.currentFixture.homeTeam} vs ${progress.currentFixture.awayTeam}`
      : progress.phase === 'planning'
        ? 'Preparando lista de partidos…'
        : '—';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        role="dialog"
        aria-labelledby="promedios-range-title"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 id="promedios-range-title" className="text-lg font-semibold text-white">
            Recalculando promedios especiales
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {desde} → {hasta}
            {onlyStale ? ' · solo desactualizados' : ' · todos los destacados'}
            {(progress.pauseMs ?? pauseMs) > 0 && (
              <span className="block text-xs text-slate-500 sm:inline sm:ml-2">
                · pausa {formatPauseMs(progress.pauseMs ?? pauseMs)} entre partidos
              </span>
            )}
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-300">
                {progress.phase === 'planning'
                  ? 'Calculando partidos…'
                  : `${progress.current} / ${progress.total} partidos`}
              </span>
              <span className="font-mono text-violet-300">{busy ? `${pct}%` : '100%'}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#0b0f14]">
              <div
                className="h-full rounded-full bg-violet-600 transition-all duration-300 ease-out"
                style={{ width: `${busy && progress.phase === 'planning' ? 8 : pct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-[#0b0f14]/80 px-4 py-3">
            <p className="text-xs text-slate-500">Partido actual</p>
            <p className="mt-1 truncate text-sm font-medium text-white">{label}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
            <Stat label="OK" value={progress.ok} className="text-emerald-400" />
            <Stat label="Fallos" value={progress.failed} className="text-red-400" />
            <Stat label="Total" value={progress.total} className="text-slate-300" />
          </div>

          {progress.recentLog.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Registro reciente
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/5 bg-[#0b0f14]/60 p-3 font-mono text-xs">
                {progress.recentLog.map((line, i) => (
                  <li
                    key={`${i}-${line.slice(0, 24)}`}
                    className={
                      line.startsWith('✗')
                        ? 'text-red-300'
                        : line.startsWith('✓')
                          ? 'text-emerald-300'
                          : 'text-slate-400'
                    }
                  >
                    {line}
                  </li>
                ))}
              </ul>
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
              className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
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

function formatPauseMs(ms: number) {
  if (ms <= 0) return '0 s';
  if (ms < 1000) return `${ms} ms`;
  return `${ms / 1000} s`;
}
