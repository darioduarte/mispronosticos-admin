'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  fetchLivePipelineMonitor,
  triggerLiveAnalysisManual,
} from '@/lib/api';
import { formatCaughtError, toastError, toastSuccess } from '@/lib/admin-toast';
import type { LivePipelineFixtureRow } from '@/lib/types';

function attentionCls(a: string) {
  if (a === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (a === 'warn') return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
  if (a === 'off') return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
}

function attentionLabel(a: string) {
  if (a === 'critical') return 'Atención';
  if (a === 'warn') return 'Aviso';
  if (a === 'off') return 'Off';
  return 'OK';
}

function OnOff({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${on ? 'text-emerald-300' : 'text-amber-300'}`}>
        {on ? 'ON' : 'OFF'}
      </p>
    </div>
  );
}

function PhaseChips({
  completed,
  missed,
  due,
  queued,
}: {
  completed: string[];
  missed: string[];
  due: string | null;
  queued: string[];
}) {
  const phases = ['min30', 'ht', 'min60'] as const;
  const labels: Record<string, string> = { min30: "30'", ht: 'HT', min60: "60'" };
  return (
    <div className="flex flex-wrap gap-1">
      {phases.map((p) => {
        let cls = 'bg-white/5 text-slate-500';
        let title = 'Pendiente / fuera de ventana';
        if (completed.includes(p)) {
          cls = 'bg-emerald-500/20 text-emerald-300';
          title = 'Completada';
        } else if (missed.includes(p)) {
          cls = 'bg-red-500/20 text-red-300';
          title = 'Ventana perdida';
        } else if (due === p) {
          cls = 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/40';
          title = 'Lista para disparar';
        } else if (queued.includes(p)) {
          cls = 'bg-sky-500/20 text-sky-300';
          title = 'En cola';
        }
        return (
          <span
            key={p}
            title={title}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
          >
            {labels[p]}
          </span>
        );
      })}
    </div>
  );
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('es-CO', { hour12: false });
  } catch {
    return iso;
  }
}

export function LivePipelineMonitorPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'critical' | 'warn' | 'ok'>('all');
  const [triggeringId, setTriggeringId] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ['live-pipeline-monitor'],
    queryFn: fetchLivePipelineMonitor,
    refetchInterval: 8_000,
  });

  const triggerMut = useMutation({
    mutationFn: (fixtureId: number) => triggerLiveAnalysisManual(fixtureId),
    onMutate: (fixtureId) => setTriggeringId(fixtureId),
    onSettled: () => setTriggeringId(null),
    onSuccess: (res) => {
      if (res.ok) {
        toastSuccess(res.message || 'Análisis disparado');
      } else {
        toastError(res.message || res.reason || 'No se pudo generar');
      }
      void qc.invalidateQueries({ queryKey: ['live-pipeline-monitor'] });
    },
    onError: (err) => toastError(formatCaughtError(err)),
  });

  const data = query.data;
  const fixtures = useMemo(() => {
    const list = data?.fixtures || [];
    if (filter === 'all') return list;
    if (filter === 'ok') return list.filter((f) => f.attention === 'ok');
    return list.filter((f) => f.attention === filter);
  }, [data?.fixtures, filter]);

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">Cargando radar de análisis en vivo…</p>;
  }

  if (query.isError || !data?.success) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        No se pudo cargar el pipeline Luna. Verifica{' '}
        <code className="text-xs">/api/admin/pronosticos-ia/live-pipeline/monitor</code>.
      </p>
    );
  }

  const pipe = data.pipeline;
  const counts = data.counts;

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Radar análisis en vivo (Luna)</h2>
          <p className="text-xs text-slate-500">
            Partidos destacados en vivo · fases min30 / HT / min60 · actualización cada 8s
            {data.generatedAt ? ` · ${formatWhen(data.generatedAt)}` : ''}
          </p>
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
      </div>

      {data.note && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
          {data.note}
        </p>
      )}

      {pipe && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <OnOff on={pipe.enabled} label="Pipeline Luna" />
          <OnOff on={pipe.gptEnabled} label="GPT vivo" />
          <OnOff on={pipe.hotPollTrigger} label="Hot poll trigger" />
          <OnOff on={pipe.hotPathEnabled} label="Hot path" />
          <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Cola pendiente</p>
            <p
              className={`mt-1 text-sm font-semibold ${
                (pipe.pendingQueueSize ?? 0) > 0 ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {pipe.pendingQueueSize ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Poll / safety</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {pipe.pollSeconds ?? '?'}s / {pipe.safetyCronMinutes ?? '?'}m
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Fases</p>
            <p className="mt-1 text-xs font-medium text-slate-300">{pipe.phaseSchedule}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="pb-2 pr-3 text-left">Estado</th>
              <th className="pb-2 pr-3 text-left">Partido</th>
              <th className="pb-2 pr-3 text-left">Min</th>
              <th className="pb-2 pr-3 text-left">Fases</th>
              <th className="pb-2 pr-3 text-left">Último run</th>
              <th className="pb-2 pr-3 text-left">Diagnóstico</th>
              <th className="pb-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {fixtures.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-slate-500">
                  No hay partidos destacados en vivo ahora
                  {filter !== 'all' ? ' con este filtro' : ''}.
                </td>
              </tr>
            ) : (
              fixtures.map((f) => (
                <FixtureRow
                  key={f.fixtureId}
                  f={f}
                  busy={triggeringId === f.fixtureId}
                  onTrigger={() => triggerMut.mutate(f.fixtureId)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Eventos recientes del worker
          </h3>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {(data.recentEvents || []).length === 0 ? (
              <p className="text-xs text-slate-500">
                Sin eventos aún (aparecen al encolar, fallar o publicar).
              </p>
            ) : (
              (data.recentEvents || []).map((e, i) => (
                <div
                  key={`${e.at}-${i}`}
                  className="rounded border border-white/5 bg-[#0b0f14] px-2 py-1.5 text-xs text-slate-300"
                >
                  <span className="text-slate-500">{formatWhen(e.at)}</span>
                  {e.fixtureId != null && (
                    <span className="ml-2 text-slate-400">#{e.fixtureId}</span>
                  )}
                  {e.phaseKey && (
                    <span className="ml-2 text-indigo-300">{e.phaseKey}</span>
                  )}
                  <span className="ml-2">{e.message || e.reason || e.kind}</span>
                  {e.published != null && (
                    <span className="ml-2 text-emerald-400">picks={e.published}</span>
                  )}
                  {e.oddsStatus && e.oddsStatus !== 'ok' && (
                    <span className="ml-2 text-amber-300">odds={e.oddsStatus}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Crons live (heartbeats)
          </h3>
          <div className="max-h-48 overflow-y-auto">
            {(data.crons || []).length === 0 ? (
              <p className="text-xs text-slate-500">Sin heartbeats de crons live registrados.</p>
            ) : (
              <table className="min-w-full text-xs">
                <tbody className="divide-y divide-white/5">
                  {(data.crons || []).map((c) => (
                    <tr key={c.jobKey}>
                      <td className="py-1.5 text-slate-300">{c.label}</td>
                      <td className="py-1.5">
                        <StatusPill status={c.lastStatus} />
                      </td>
                      <td className="py-1.5 text-slate-500">
                        {formatWhen(c.lastSuccessAt || c.lastStartedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const s = String(status || '—');
  const cls =
    s === 'success'
      ? 'text-emerald-300'
      : s === 'failed' || s === 'missed'
        ? 'text-red-300'
        : s === 'running'
          ? 'text-amber-300'
          : 'text-slate-400';
  return <span className={cls}>{s}</span>;
}

function FixtureRow({
  f,
  busy,
  onTrigger,
}: {
  f: LivePipelineFixtureRow;
  busy: boolean;
  onTrigger: () => void;
}) {
  const last = f.lastRun;
  return (
    <tr className="align-top">
      <td className="py-2.5 pr-3">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${attentionCls(f.attention)}`}
        >
          {attentionLabel(f.attention)}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <p className="font-medium text-slate-200">
          {f.homeTeam}{' '}
          <span className="text-slate-500">
            {f.scoreHome ?? '—'}–{f.scoreAway ?? '—'}
          </span>{' '}
          {f.awayTeam}
        </p>
        <p className="text-[11px] text-slate-500">
          {f.league} · #{f.fixtureId}
        </p>
      </td>
      <td className="py-2.5 pr-3 text-slate-300">{f.statusLabel}</td>
      <td className="py-2.5 pr-3">
        <PhaseChips
          completed={f.completedPhases}
          missed={f.missedPhases}
          due={f.duePhase}
          queued={f.queuedPhases}
        />
      </td>
      <td className="py-2.5 pr-3 text-xs text-slate-400">
        {last ? (
          <>
            <p>
              {last.phaseKey || last.windowKey} · picks={last.publishedCount}
            </p>
            <p>
              odds={last.oddsStatus || (last.hasOdds ? 'ok' : '—')}
              {last.noStats ? ' · sin stats' : ''}
            </p>
            <p className="text-slate-500">{formatWhen(last.createdAt)}</p>
          </>
        ) : (
          <span className="text-slate-500">Sin runs</span>
        )}
      </td>
      <td className="max-w-[220px] py-2.5 pr-3 text-xs text-slate-300">{f.detail}</td>
      <td className="py-2.5 text-right">
        <button
          type="button"
          disabled={!f.canRetrigger || busy}
          onClick={onTrigger}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? '…' : 'Re-ejecutar'}
        </button>
      </td>
    </tr>
  );
}
