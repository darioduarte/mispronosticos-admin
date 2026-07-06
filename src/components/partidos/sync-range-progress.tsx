'use client';

import type { SyncStatsPlanFixture } from '@/lib/types';

export type SyncRangeProgressState = {
  phase: 'planning' | 'syncing' | 'done' | 'cancelled';
  total: number;
  current: number;
  ok: number;
  failed: number;
  currentFixture: SyncStatsPlanFixture | null;
  recentLog: string[];
  isPausing?: boolean;
  pauseMs?: number;
};

type Props = {
  progress: SyncRangeProgressState;
  desde: string;
  hasta: string;
  onlyMissing: boolean;
  pauseMs: number;
  onCancel: () => void;
};

export function SyncRangeProgressModal({
  progress,
  desde,
  hasta,
  onlyMissing,
  pauseMs,
  onCancel,
}: Props) {
  const pct =
    progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;
  const busy = progress.phase === 'planning' || progress.phase === 'syncing';
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
        className="w-full max-w-lg rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        role="dialog"
        aria-labelledby="sync-range-title"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 id="sync-range-title" className="text-lg font-semibold text-white">
            Sincronizando estadísticas (FLB)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {desde} → {hasta}
            {onlyMissing ? ' · solo sin stats' : ' · todos los destacados'}
            {(progress.pauseMs ?? pauseMs) > 0 && (
              <span className="block text-xs text-slate-500 sm:inline sm:ml-2">
                · pausa {formatPauseMs(progress.pauseMs ?? pauseMs)} entre partidos
              </span>
            )}
          </p>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-300">
                {progress.phase === 'planning'
                  ? 'Calculando partidos…'
                  : `${progress.current} / ${progress.total} partidos`}
              </span>
              <span className="font-mono text-emerald-400">{busy ? `${pct}%` : '100%'}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#0b0f14]">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-300 ease-out"
                style={{ width: `${busy && progress.phase === 'planning' ? 8 : pct}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0c1017] px-3 py-2.5">
            <p className="text-xs text-slate-500">Partido actual</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-200">{label}</p>
            {progress.currentFixture?.fixtureId != null && (
              <p className="mt-1 text-xs text-slate-600">ID {progress.currentFixture.fixtureId}</p>
            )}
          </div>

          <div className="flex gap-4 text-sm">
            <span className="text-emerald-400">
              OK: <strong>{progress.ok}</strong>
            </span>
            <span className="text-red-300">
              Fallos: <strong>{progress.failed}</strong>
            </span>
          </div>

          {progress.recentLog.length > 0 && (
            <div className="max-h-28 overflow-y-auto rounded-lg border border-white/5 bg-[#0b0f14] p-2">
              {progress.recentLog.map((line, i) => (
                <p key={`${i}-${line}`} className="truncate font-mono text-[10px] text-slate-500">
                  {line}
                </p>
              ))}
            </div>
          )}

          {progress.phase === 'done' && (
            <p className="text-sm text-emerald-400">
              Completado: {progress.ok} sincronizado(s)
              {progress.failed > 0 ? `, ${progress.failed} fallo(s)` : ''}.
            </p>
          )}
          {progress.phase === 'cancelled' && (
            <p className="text-sm text-amber-300">
              Cancelado tras {progress.current} partido(s). {progress.ok} OK, {progress.failed}{' '}
              fallo(s).
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">
          {busy ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPauseMs(ms: number) {
  if (ms <= 0) return '0 s';
  if (ms % 1000 === 0) return `${ms / 1000} s`;
  return `${(ms / 1000).toFixed(1)} s`;
}
