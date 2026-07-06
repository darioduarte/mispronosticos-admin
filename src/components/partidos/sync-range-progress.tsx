'use client';

import { useState } from 'react';
import type { SyncStatsPlanFixture } from '@/lib/types';
import type { SyncRangeResultEntry, SyncRangeSourceBreakdown } from '@/lib/sync-stats-source';

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
  sourceBreakdown: SyncRangeSourceBreakdown;
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
  const [showFlbList, setShowFlbList] = useState(false);
  const [showApifList, setShowApifList] = useState(true);
  const bd = progress.sourceBreakdown;
  const flbCount = bd.flb.length;
  const apifCount = bd.apiFootball.length;
  const noneCount = bd.none.length;
  const failedCount = bd.failed.length;

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
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
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

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
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

          <div className="flex flex-wrap gap-2 text-xs">
            <SourcePill tone="flb" label="FLB" count={flbCount} />
            <SourcePill tone="apif" label="API-Football" count={apifCount} />
            <SourcePill tone="none" label="Sin stats" count={noneCount} />
            <SourcePill tone="fail" label="Fallos" count={failedCount} />
          </div>

          {(flbCount > 0 || apifCount > 0) && (
            <div className="space-y-2">
              {flbCount > 0 && (
                <BreakdownSection
                  title={`FLB (${flbCount})`}
                  open={showFlbList}
                  onToggle={() => setShowFlbList((v) => !v)}
                  tone="flb"
                  entries={bd.flb}
                />
              )}
              {apifCount > 0 && (
                <BreakdownSection
                  title={`API-Football — fallback (${apifCount})`}
                  open={showApifList}
                  onToggle={() => setShowApifList((v) => !v)}
                  tone="apif"
                  entries={bd.apiFootball}
                  showReason
                />
              )}
            </div>
          )}

          {progress.recentLog.length > 0 && (
            <div className="max-h-24 overflow-y-auto rounded-lg border border-white/5 bg-[#0b0f14] p-2">
              {progress.recentLog.map((line, i) => (
                <p
                  key={`${i}-${line}`}
                  className={`truncate font-mono text-[10px] ${
                    line.startsWith('✓ FLB')
                      ? 'text-emerald-500'
                      : line.startsWith('◆ APIF')
                        ? 'text-amber-400'
                        : line.startsWith('✗')
                          ? 'text-red-400'
                          : 'text-slate-500'
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          )}

          {progress.phase === 'done' && (
            <p className="text-sm text-emerald-400">
              Completado: {flbCount} FLB · {apifCount} API-Football
              {noneCount > 0 ? ` · ${noneCount} sin stats` : ''}
              {failedCount > 0 ? ` · ${failedCount} fallo(s)` : ''}.
            </p>
          )}
          {progress.phase === 'cancelled' && (
            <p className="text-sm text-amber-300">
              Cancelado: {flbCount} FLB · {apifCount} API-Football · {failedCount} fallo(s).
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

function SourcePill({
  tone,
  label,
  count,
}: {
  tone: 'flb' | 'apif' | 'none' | 'fail';
  label: string;
  count: number;
}) {
  const styles = {
    flb: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    apif: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    none: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
    fail: 'border-red-500/30 bg-red-500/10 text-red-300',
  }[tone];
  return (
    <span className={`rounded-full border px-2.5 py-1 font-medium ${styles}`}>
      {label}: {count}
    </span>
  );
}

function BreakdownSection({
  title,
  open,
  onToggle,
  tone,
  entries,
  showReason = false,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  tone: 'flb' | 'apif';
  entries: SyncRangeResultEntry[];
  showReason?: boolean;
}) {
  const border = tone === 'flb' ? 'border-emerald-500/20' : 'border-amber-500/20';
  return (
    <div className={`rounded-lg border ${border} bg-[#0b0f14]`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:bg-white/5"
      >
        <span>{title}</span>
        <span className="text-slate-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="max-h-40 overflow-y-auto border-t border-white/5 px-2 py-1">
          {entries.map((e) => (
            <li key={e.fixtureId} className="border-b border-white/5 py-1.5 last:border-0">
              <p className="text-xs text-slate-200">
                <span className="font-mono text-slate-500">{e.fixtureId}</span> {e.label}
              </p>
              {showReason && e.reasonLabel && (
                <p className="mt-0.5 text-[10px] text-amber-300/90">↳ {e.reasonLabel}</p>
              )}
              {e.detail && <p className="mt-0.5 text-[10px] text-slate-500">{e.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatPauseMs(ms: number) {
  if (ms <= 0) return '0 s';
  if (ms % 1000 === 0) return `${ms / 1000} s`;
  return `${(ms / 1000).toFixed(1)} s`;
}
