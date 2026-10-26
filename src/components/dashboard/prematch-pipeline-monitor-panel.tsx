'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchPrematchPipelineMonitor } from '@/lib/api';
import { bogotaCalendarDate } from '@/lib/prematch-monitor-date';
import type { PrematchCheckState, PrematchPipelineCheck } from '@/lib/types';

type DayChoice = 'tomorrow' | 'today';
type AttentionFilter = 'all' | 'critical' | 'warn' | 'ok';

function attentionCls(attention: string) {
  if (attention === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (attention === 'warn') return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
  return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
}

function attentionLabel(attention: string) {
  if (attention === 'critical') return 'Atención';
  if (attention === 'warn') return 'Aviso';
  return 'OK';
}

function checkCls(state: PrematchCheckState, severity: string) {
  if (state === 'ok') return 'bg-emerald-500/15 text-emerald-300';
  if (state === 'pending' || severity === 'info') return 'bg-white/5 text-slate-500';
  if (severity === 'critical') return 'bg-red-500/20 text-red-300';
  return 'bg-amber-500/20 text-amber-200';
}

function stageCls(status?: string | null) {
  if (status === 'ran' || status === 'running') return 'border-emerald-500/30 text-emerald-200';
  if (status === 'failed' || status === 'missed') return 'border-red-500/40 text-red-200';
  if (status === 'waiting' || status === 'pending') return 'border-white/10 text-slate-400';
  return 'border-white/10 text-slate-500';
}

function kickoffLabel(value?: string | null) {
  if (!value) return '—';
  const match = String(value).match(/(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Checks({ checks }: { checks: PrematchPipelineCheck[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {checks.map((check) => (
        <span
          key={check.key}
          title={check.detail}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${checkCls(check.state, check.severity)}`}
        >
          {check.label}
        </span>
      ))}
    </div>
  );
}

export function PrematchPipelineMonitorPanel() {
  const [day, setDay] = useState<DayChoice>('tomorrow');
  const [filter, setFilter] = useState<AttentionFilter>('all');
  const date = bogotaCalendarDate(new Date(), day === 'tomorrow' ? 1 : 0);

  const query = useQuery({
    queryKey: ['prematch-pipeline-monitor', date],
    queryFn: () => fetchPrematchPipelineMonitor(date),
    retry: 4,
    retryDelay: (attempt) => Math.min(4_000, 700 * 2 ** attempt),
    refetchInterval: (q) => (q.state.status === 'error' ? 8_000 : 20_000),
  });

  const data = query.data;

  const fixtures = useMemo(() => {
    const list = data?.fixtures || [];
    if (filter === 'all') return list;
    return list.filter((fixture) => fixture.attention === filter);
  }, [data?.fixtures, filter]);

  if (!data?.success) {
    if (query.isPending) {
      return <p className="text-sm text-slate-500">Cargando la preparación prepartido…</p>;
    }
    const detail = query.error instanceof Error ? query.error.message : data?.error || '';
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        No se pudo cargar el radar prepartido{detail ? `: ${detail}` : '.'}
      </p>
    );
  }

  const counts = data.counts;
  const active = counts?.active || counts?.total || 0;
  const run = data.analysisRun;
  const progress = run?.progress;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Preparación prepartido</h2>
          <p className="text-xs text-slate-500">
            {data.phase?.label || 'Partidos destacados'} · {data.date} · se actualiza cada 20s
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['tomorrow', `Mañana (${data.tomorrow || '—'})`],
              ['today', `Hoy (${data.today || '—'})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDay(key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                day === key
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                  : 'border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.note ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
          {data.note}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Destacados" value={String(counts?.total ?? 0)} hint={`${active} en preparación`} />
        <Stat label="Promedios" value={`${counts?.withAverages ?? 0}/${active}`} />
        <Stat label="H2H" value={`${counts?.withH2h ?? 0}/${active}`} />
        <Stat label="Árbitro" value={`${counts?.withReferee ?? 0}/${active}`} />
        <Stat label="Prompt" value={`${counts?.withPrompt ?? 0}/${active}`} />
        <Stat label="Análisis" value={`${counts?.withAnalysis ?? 0}/${active}`} hint={`${data.storiesCount ?? 0} stories`} />
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Cadena del día previo</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(data.stages || []).map((stage) => (
            <div
              key={stage.jobKey}
              title={stage.lastError || stage.lastStatus || stage.todaySlotStatus || ''}
              className={`min-w-[7.5rem] rounded-lg border bg-[#0b0f14] px-2.5 py-2 ${stageCls(stage.todaySlotStatus)}`}
            >
              <p className="text-[10px] text-slate-500">{stage.at}</p>
              <p className="text-xs font-medium">{stage.label}</p>
              <p className="mt-1 text-[10px] uppercase">{stage.todaySlotStatus || 'unknown'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-300">
        <span className="text-slate-500">Corrida IA · </span>
        {run?.status || 'sin corrida'}
        {run?.message ? ` · ${run.message}` : ''}
        {progress?.total ? ` · ${progress.current ?? 0}/${progress.total}` : ''}
        {run?.errorMessage ? <span className="text-red-300"> · {run.errorMessage}</span> : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            ['all', `Todos (${counts?.total ?? 0})`],
            ['critical', `Atención (${counts?.critical ?? 0})`],
            ['warn', `Avisos (${counts?.warn ?? 0})`],
            ['ok', `OK (${counts?.ok ?? 0})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1 ${
              filter === key
                ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
                : 'border-white/10 text-slate-400 hover:border-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {fixtures.length === 0 ? (
          <p className="text-sm text-slate-500">No hay partidos destacados para esta fecha.</p>
        ) : (
          fixtures.map((fixture) => (
            <article
              key={fixture.fixtureId}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {fixture.homeTeam} vs {fixture.awayTeam}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {kickoffLabel(fixture.kickoff)} · {fixture.league} · {fixture.status || '—'} · #{fixture.fixtureId}
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${attentionCls(fixture.attention)}`}>
                  {attentionLabel(fixture.attention)}
                </span>
              </div>
              <div className="mt-2">
                <Checks checks={fixture.checks} />
              </div>
              <p className="mt-2 text-xs text-slate-400">{fixture.detail}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Bajas {fixture.injuries} · cuotas guardadas {fixture.oddsRows}
                {fixture.referee ? ` · árbitro ${fixture.referee}` : ''}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
