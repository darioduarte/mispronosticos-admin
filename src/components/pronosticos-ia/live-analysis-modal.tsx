'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchLiveAnalysisRuns, triggerLiveAnalysisManual } from '@/lib/api';
import type { LiveAnalysisRun } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

function formatWindowKey(key: string) {
  const map: Record<string, string> = {
    min30: 'Min 30',
    HT: 'Medio tiempo',
    min60: 'Min 60',
    min80: 'Min 80',
  };
  if (map[key]) return map[key];
  if (key.startsWith('manual_')) return `Manual (${key.replace(/^manual_/, '')})`;
  return key;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function RunCard({ run, defaultOpen }: { run: LiveAnalysisRun; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const score =
    run.scoreHome != null && run.scoreAway != null
      ? `${run.scoreHome}–${run.scoreAway}`
      : '—';

  return (
    <article className="rounded-lg border border-white/10 bg-[#0b0f14]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-200">
              {formatWindowKey(run.windowKey)}
            </span>
            {run.minute != null && (
              <span className="text-xs text-slate-400">min {run.minute}&apos;</span>
            )}
            <span className="text-xs text-slate-500">{score}</span>
            {run.status && (
              <span className="text-xs text-slate-600">{run.status}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(run.createdAt)} · {run.publishedCount} pick(s)
          </p>
          {run.analysisSummary && !open && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">{run.analysisSummary}</p>
          )}
        </div>
        <span className="shrink-0 text-slate-500">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="border-t border-white/5 px-4 pb-4 pt-2">
          {run.analysisSummary && (
            <p className="mb-3 text-sm leading-relaxed text-slate-300">{run.analysisSummary}</p>
          )}
          {run.picks.length === 0 ? (
            <p className="text-sm text-slate-500">Sin picks publicados en esta ejecución.</p>
          ) : (
            <ul className="space-y-3">
              {run.picks.map((pick) => (
                <li
                  key={pick.id}
                  className="rounded-lg border border-white/5 bg-[#151b24] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{pick.tipo}</span>
                    {pick.probabilidad != null && (
                      <span className="text-xs text-indigo-300">{pick.probabilidad}%</span>
                    )}
                    {pick.cuota_decimal != null && (
                      <span className="text-xs text-slate-400">@{pick.cuota_decimal}</span>
                    )}
                    <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                      {pick.categoria_pronostico}
                    </span>
                    {pick.minute != null && (
                      <span className="text-[10px] text-slate-600">min {pick.minute}&apos;</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{pick.explicacion}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

export function LiveAnalysisModal({ fixtureId, matchLabel, onClose }: Props) {
  const qc = useQueryClient();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['live-analysis-runs', fixtureId],
    queryFn: () => fetchLiveAnalysisRuns(fixtureId),
    refetchInterval: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: () => triggerLiveAnalysisManual(fixtureId),
    onSuccess: async (data) => {
      setStatusMsg(
        data.ok
          ? data.message || `Generados ${data.published ?? 0} pick(s)`
          : data.message || data.reason || data.error || 'No se pudo generar',
      );
      await qc.invalidateQueries({ queryKey: ['live-analysis-runs', fixtureId] });
    },
    onError: (err: Error) => setStatusMsg(err.message),
  });

  const data = query.data;
  const fixture = data?.fixture;
  const runs = data?.runs ?? [];

  const liveLabel =
    fixture?.teamshomename && fixture?.teamsawayname
      ? `${fixture.teamshomename} vs ${fixture.teamsawayname}`
      : matchLabel;

  const liveStatus =
    fixture?.fixturestatusshort != null
      ? `${fixture.fixturestatusshort}${
          fixture.fixturestatuselapsed != null ? ` ${fixture.fixturestatuselapsed}'` : ''
        } · ${fixture.goalshome ?? 0}–${fixture.goalsaway ?? 0}`
      : null;

  function handleGenerate() {
    if (
      !window.confirm(
        `¿Generar análisis IA en vivo AHORA para fixture ${fixtureId}?\n\nIgnora ventanas min30/HT/min60. Puede tardar 30–90 s (GPT).`,
      )
    ) {
      return;
    }
    setStatusMsg(null);
    generateMutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="live-analysis-title"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="live-analysis-title" className="text-lg font-semibold text-white">
              Análisis IA en vivo
            </h2>
            <p className="mt-1 text-sm text-slate-400">{liveLabel}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Fixture {fixtureId}
              {liveStatus && <span className="ml-2 text-emerald-400/90">{liveStatus}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3">
          <button
            type="button"
            disabled={generateMutation.isPending}
            onClick={handleGenerate}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {generateMutation.isPending ? 'Generando… (30–90 s)' : 'Generar análisis IA'}
          </button>
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            {query.isFetching ? 'Actualizando…' : 'Actualizar lista'}
          </button>
          {data && (
            <span className="text-xs text-slate-500">
              {data.totalRuns} ejecución(es) · {data.totalPicks} pick(s)
            </span>
          )}
        </div>

        {statusMsg && (
          <p className="mx-5 mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
            {statusMsg}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {query.isLoading && (
            <p className="text-sm text-slate-400">Cargando análisis en vivo…</p>
          )}
          {query.isError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {(query.error as Error).message}
            </p>
          )}
          {!query.isLoading && !query.isError && runs.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Aún no hay análisis en vivo para este partido.</p>
              <p className="mt-1 text-xs text-slate-500">
                Usa el botón de arriba para generar uno manualmente.
              </p>
            </div>
          )}
          {runs.length > 0 && (
            <div className="space-y-3">
              {runs.map((run, i) => (
                <RunCard key={run.id} run={run} defaultOpen={i === 0} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
