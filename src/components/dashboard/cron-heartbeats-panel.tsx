'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCronHeartbeats, rerunCronJob } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/admin-toast';
import type { CronHeartbeatRow, CronSlotStatus } from '@/lib/types';

function statusCls(status?: string | null) {
  const s = String(status || '');
  if (s === 'success' || s === 'ok' || s === 'ran') return 'text-emerald-300';
  if (s === 'failed' || s === 'missed') return 'text-red-300';
  if (s === 'running' || s === 'waiting') return 'text-amber-300';
  if (s === 'pending') return 'text-sky-300';
  return 'text-slate-400';
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', { hour12: false });
  } catch {
    return String(iso);
  }
}

function slotLabel(status?: string | null) {
  const map: Record<string, string> = {
    ran: 'Se ejecutó',
    running: 'En curso',
    failed: 'Falló',
    missed: 'No se ejecutó',
    waiting: 'Esperando heartbeat',
    pending: 'Aún no toca',
    not_today: 'No dispara hoy',
    unknown: 'Sin datos',
  };
  return map[String(status || '')] || status || '—';
}

function rerunButtonLabel(status?: string | null) {
  if (status === 'running') return 'En curso…';
  if (status === 'missed' || status === 'waiting' || status === 'failed') {
    return 'Reiniciar cron IA';
  }
  if (status === 'pending') return 'Lanzar ahora';
  if (status === 'ran') return 'Volver a ejecutar (faltantes)';
  return 'Reiniciar cron';
}

export function CronHeartbeatsPanel() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['cron-heartbeats'],
    queryFn: fetchCronHeartbeats,
    refetchInterval: 15_000,
  });

  const rerunMut = useMutation({
    mutationFn: (payload: { jobKey: string; force?: boolean }) =>
      rerunCronJob(payload.jobKey, { force: payload.force }),
    onSuccess: (res) => {
      toastSuccess(
        'Cron IA prepartido',
        res.message || (res.dispatched ? 'Encolado en el worker' : 'Relanzado'),
      );
      void qc.invalidateQueries({ queryKey: ['cron-heartbeats'] });
    },
    onError: (err) => toastError('Reiniciar cron', err),
  });

  function confirmAndRerun(job: Pick<CronHeartbeatRow, 'jobKey' | 'label' | 'todaySlotStatus'>) {
    const alreadyRan = job.todaySlotStatus === 'ran';
    const running = job.todaySlotStatus === 'running';
    const msg = running
      ? `El cron «${job.label}» figura en curso. ¿Forzar un relanzamiento? Solo si el worker se reinició a media corrida.`
      : alreadyRan
        ? `El cron «${job.label}» ya corrió hoy. ¿Volver a lanzarlo? Solo genera análisis faltantes.`
        : `¿Relanzar «${job.label}» ahora en el worker? Útil si al escalar se saltó el tick de las 19:15.`;
    if (!window.confirm(msg)) return;
    rerunMut.mutate({ jobKey: job.jobKey, force: running });
  }

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">Cargando heartbeats de crons…</p>;
  }

  if (query.isError || !query.data?.success) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        No se pudieron cargar los crons. Verifica{' '}
        <code className="text-xs">/api/admin/dashboard/cron-heartbeats</code>.
      </p>
    );
  }

  const crons = query.data.crons || [];
  const featured = query.data.featured;
  const attention = crons.filter((c) =>
    ['failed', 'missed', 'running', 'waiting'].includes(String(c.todaySlotStatus || c.lastStatus || '')),
  );
  const aiStatus = (featured?.todaySlotStatus || featured?.lastStatus || '') as CronSlotStatus | string;
  const needsRerun = ['missed', 'waiting', 'failed'].includes(String(aiStatus));
  const process = featured?.process;
  const progressPct = process?.progress?.percentage;
  const progressText =
    process?.progress && process.progress.total
      ? `${process.progress.current ?? 0}/${process.progress.total}`
      : null;

  return (
    <div className="space-y-4">
      {featured && (
        <section
          className={`rounded-xl border p-4 ${
            needsRerun
              ? 'border-amber-500/40 bg-amber-500/10'
              : aiStatus === 'running'
                ? 'border-sky-500/40 bg-sky-500/10'
                : aiStatus === 'ran'
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-white/10 bg-[#111827]'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">IA prepartido</p>
              <h2 className="text-lg font-semibold text-slate-100">{featured.label}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Tick de hoy 19:15 Bogotá · análisis del día siguiente
                {process?.targetDate ? ` (${process.targetDate})` : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={rerunMut.isPending || (aiStatus === 'running' && rerunMut.isPending)}
              onClick={() => confirmAndRerun(featured)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                needsRerun
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                  : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
              } disabled:opacity-50`}
            >
              {rerunMut.isPending ? 'Relanzando…' : rerunButtonLabel(String(aiStatus))}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Hoy</p>
              <p className={`text-base font-semibold ${statusCls(aiStatus)}`}>{slotLabel(aiStatus)}</p>
              <p className="text-[11px] text-slate-500">
                Programado: {formatWhen(featured.todayFireAt)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Arranque</p>
              <p className="text-sm font-medium text-slate-200">{formatWhen(featured.lastStartedAt)}</p>
              <p className="text-[11px] text-slate-500">Heartbeat lastStatus: {featured.lastStatus || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Último éxito</p>
              <p className="text-sm font-medium text-slate-200">{formatWhen(featured.lastSuccessAt)}</p>
              <p className="text-[11px] text-slate-500">
                {featured.lastDurationMs != null
                  ? `${Math.round(featured.lastDurationMs / 60000)} min`
                  : 'sin duración'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Proceso GPT</p>
              <p className={`text-sm font-medium ${statusCls(process?.status)}`}>
                {process?.status || 'sin registro'}
              </p>
              <p className="text-[11px] text-slate-500">
                {progressText
                  ? `${progressText}${progressPct != null ? ` (${progressPct}%)` : ''}`
                  : process?.lastUpdatedAt
                    ? formatWhen(process.lastUpdatedAt)
                    : '—'}
              </p>
            </div>
          </div>

          {featured.lastError ? (
            <p className="mt-3 text-xs text-red-300/90">{featured.lastError}</p>
          ) : null}
          {needsRerun ? (
            <p className="mt-3 text-xs text-amber-100/90">
              Si acabas de escalar el worker después de las 19:15, node-cron no recupera el tick
              perdido. Usa el botón para correr el mismo job en el worker.
            </p>
          ) : null}
        </section>
      )}

      <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Crons del worker</h2>
            <p className="text-xs text-slate-500">
              Heartbeats MySQL · cada 15s · {crons.length} jobs
              {attention.length > 0 ? ` · ${attention.length} requieren atención` : ''}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 text-left">Job</th>
                <th className="pb-2 text-left">Cron</th>
                <th className="pb-2 text-left">Hoy</th>
                <th className="pb-2 text-left">Último éxito</th>
                <th className="pb-2 text-right">Duración</th>
                <th className="pb-2 text-left">Error</th>
                <th className="pb-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {crons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-500">
                    Aún no hay heartbeats (el worker debe haber ejecutado al menos un cron envuelto).
                  </td>
                </tr>
              ) : (
                crons.map((c) => (
                  <tr key={c.jobKey}>
                    <td className="py-2">
                      <p className="text-slate-200">{c.label}</p>
                      <p className="text-[11px] text-slate-500">{c.jobKey}</p>
                    </td>
                    <td className="py-2 font-mono text-xs text-slate-400">{c.cronExpr || '—'}</td>
                    <td className={`py-2 text-xs font-medium ${statusCls(c.todaySlotStatus || c.lastStatus)}`}>
                      {slotLabel(c.todaySlotStatus || c.lastStatus)}
                    </td>
                    <td className="py-2 text-xs text-slate-400">{formatWhen(c.lastSuccessAt)}</td>
                    <td className="py-2 text-right text-xs text-slate-400">
                      {c.lastDurationMs != null ? `${c.lastDurationMs} ms` : '—'}
                    </td>
                    <td className="max-w-[280px] py-2 text-xs text-red-300/90">{c.lastError || ''}</td>
                    <td className="py-2 text-right">
                      {c.canRerun ? (
                        <button
                          type="button"
                          disabled={rerunMut.isPending}
                          onClick={() => confirmAndRerun(c)}
                          className="rounded border border-white/15 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10 disabled:opacity-50"
                        >
                          Reiniciar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
