'use client';

import { useEffect, useState } from 'react';
import type { AiPrematchProcessStatus } from '@/lib/types';

type Props = {
  process: AiPrematchProcessStatus | null | undefined;
  label: string;
  waitingForLaunch?: boolean;
  onClose: () => void;
};

function formatDuration(ms: number) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const STAGES = [
  { id: 'count', label: 'Inicio' },
  { id: 'averages', label: 'Promedios' },
  { id: 'warm', label: 'Caché' },
  { id: 'gpt', label: 'IA' },
  { id: 'done', label: 'Listo' },
] as const;

export type AiPrematchStageId = (typeof STAGES)[number]['id'];

export function aiPrematchStage(process: AiPrematchProcessStatus | null | undefined): AiPrematchStageId {
  if (!process) return 'count';
  if (process.status === 'completed' || process.status === 'failed' || process.phase === 'done') return 'done';
  if (process.phase === 'gpt' || process.phase === 'queued' || process.step === 'gpt') return 'gpt';
  if (process.step === 'warm') return 'warm';
  if (process.step === 'averages') return 'averages';
  return 'count';
}

function phaseTitle(stage: AiPrematchStageId, failed: boolean) {
  if (stage === 'done') return failed ? 'Terminado con error' : 'Terminado';
  if (stage === 'gpt') return 'Generando análisis';
  if (stage === 'warm') return 'Armando caché de prompts';
  if (stage === 'averages') return 'Revisando promedios';
  return 'Contando destacados';
}

export function AiPrematchStageRail({
  process,
}: {
  process: AiPrematchProcessStatus | null | undefined;
}) {
  const stage = aiPrematchStage(process);
  const active = STAGES.findIndex((item) => item.id === stage);
  return (
    <ol className="flex flex-wrap gap-2">
      {STAGES.map((item, index) => {
        const state = index < active ? 'done' : index === active ? 'current' : 'pending';
        return (
          <li
            key={item.id}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              state === 'current'
                ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                : state === 'done'
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 text-slate-500'
            }`}
          >
            {index + 1}. {item.label}
          </li>
        );
      })}
    </ol>
  );
}

export function AiPrematchCronProgressModal({ process, label, waitingForLaunch, onClose }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const busy = process?.status === 'processing';

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const total = process?.progress?.total || 0;
  const current = process?.progress?.current || 0;
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : process?.progress?.percentage || 0;
  const started = process?.runStartedAt || process?.startedAt;
  const elapsedMs = started ? Math.max(0, nowMs - new Date(started).getTime()) : 0;
  const prepare = process?.prepare;
  const stage = aiPrematchStage(process);
  const counting = stage === 'count';
  const remaining = Math.max(0, total - current);
  const etaMs = stage === 'gpt' && current > 0 && remaining > 0 ? Math.round((elapsedMs / current) * remaining) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" role="presentation">
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        role="dialog"
        aria-labelledby="ai-cron-progress-title"
        aria-busy={busy}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="ai-cron-progress-title" className="text-lg font-semibold text-white">
              {waitingForLaunch ? 'Lanzando análisis IA' : phaseTitle(stage, process?.status === 'failed')}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {label}
              {process?.targetDate ? ` · ${process.targetDate}` : ''}
              {process?.source ? ` · ${process.source}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {waitingForLaunch ? (
            <p className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
              El worker está tomando el cron. Esta ventana se actualiza sola en cuanto reporte el
              primer paso: conteo, promedios, caché o el envío de cada partido.
            </p>
          ) : null}
          <AiPrematchStageRail process={waitingForLaunch ? null : process} />
          <div>
            <div className="mb-2 flex items-end justify-between gap-2 text-sm">
              <p className="text-slate-300">
                {waitingForLaunch
                  ? 'Esperando el primer avance de esta corrida…'
                  : stage === 'count'
                  ? 'Contando partidos destacados…'
                  : stage === 'averages'
                    ? process?.message || 'Revisando promedios del día…'
                    : stage === 'warm'
                      ? `Caché ${prepare?.warmHits ?? 0} hit · ${prepare?.warmBuilt ?? 0} armados${
                          total > 0 ? ` · ${current} de ${total}` : ''
                        }`
                      : stage === 'gpt'
                        ? total > 0
                          ? `${current} de ${total} · quedan ${remaining}`
                          : 'Arrancando la IA…'
                        : process?.message || 'Proceso cerrado'}
              </p>
              <span className="font-mono text-2xl font-semibold text-indigo-300">
                {waitingForLaunch || counting ? '…' : `${pct}%`}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#0b0f14]">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${waitingForLaunch || counting ? 12 : pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Transcurrido: {formatDuration(elapsedMs)}
              {process?.minutesSinceUpdate != null
                ? ` · último avance hace ${Math.round(process.minutesSinceUpdate)} min`
                : ''}
              {etaMs != null ? ` · quedan ~${formatDuration(etaMs)}` : ''}
              {process?.stale ? ' · sin avance' : ''}
            </p>
          </div>

          {process?.message ? (
            <p className="rounded-lg border border-white/5 bg-[#0b0f14]/80 px-4 py-3 text-sm text-slate-200">
              {process.message}
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Cache hit" value={prepare?.warmHits ?? 0} className="text-cyan-300" />
            <Stat label="Cache armados" value={prepare?.warmBuilt ?? 0} className="text-sky-300" />
            <Stat label="Cache fallos" value={prepare?.warmFailed ?? 0} className="text-amber-300" />
          </div>

          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <Stat label="GPT" value={process?.processed ?? 0} className="text-emerald-400" />
            <Stat label="Omitidos" value={process?.skipped ?? 0} className="text-slate-400" />
            <Stat label="Errores" value={process?.errors ?? 0} className="text-red-400" />
            <Stat
              label="Pendiente caché"
              value={prepare?.warmRemaining ?? '—'}
              className="text-slate-300"
            />
          </div>

          {prepare?.averagesSummary ? (
            <p className="text-xs text-slate-500">{prepare.averagesSummary}</p>
          ) : null}
          {process?.errorMessage ? (
            <p className="text-xs text-red-300">{process.errorMessage}</p>
          ) : null}
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
  value: number | string;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0b0f14]/80 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${className}`}>{value}</p>
    </div>
  );
}
