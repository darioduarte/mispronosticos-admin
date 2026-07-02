'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchDashboardOps } from '@/lib/api';
import type { OpsSnapshot } from '@/lib/types';

function poolCls(data: OpsSnapshot) {
  const p = data.dbPool?.pending ?? 0;
  if (p > 5000) return 'text-red-300';
  if (p > 500) return 'text-amber-300';
  if ((data.dbPool?.usagePercent ?? 0) > 80) return 'text-amber-300';
  return 'text-emerald-300';
}

function impactBorder(status?: string) {
  if (status === 'critical') return 'border-red-500/40 bg-red-500/10';
  if (status === 'degraded') return 'border-amber-500/40 bg-amber-500/10';
  return 'border-white/10 bg-[#111827]';
}

function OnOffBadge({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        on ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
      }`}
    >
      {on ? 'ON' : 'OFF'}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

export function OpsMonitorPanel() {
  const query = useQuery({
    queryKey: ['dashboard-ops'],
    queryFn: fetchDashboardOps,
    refetchInterval: 5_000,
  });

  const data = query.data;

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">Cargando monitoreo operacional…</p>;
  }

  if (query.isError || !data) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        No se pudo cargar el monitoreo. Verifica `/api/admin/dashboard/ops` en el backend.
      </p>
    );
  }

  const ls = data.liveServices || {};
  const liveRows: [string, boolean, string][] = [
    ['Hot path (API→Redis)', !!ls.hotPathEnabled, `Poll cada ${ls.pollSeconds ?? '?'}s`],
    ['Socket marcador/stats', !!ls.hotSocketEmit, ls.hotSocketEmit ? 'Push automático' : 'Pull manual'],
    ['Persistencia BD inmediata', !!ls.hotImmediateDbPersist, ls.hotImmediateDbPersist ? 'MySQL en cada gol' : 'Cola + cold path'],
    ['Stats en Redis (hot)', !!ls.statsHotEnabled, 'Sin socket si emit off'],
    ['Broadcast global sockets', !!ls.socketBroadcastGlobal, ls.socketBroadcastGlobal ? 'io.emit a todos' : 'Solo room fixture:*'],
    ['Pronósticos en vivo', !!ls.livePredictionEnabled, ls.livePredictionEnabled ? 'Socket + cron' : 'OFF'],
    ['Cron pronósticos GPT', !!ls.livePredictionCron, ls.livePredictionCron ? 'Cada 15 min' : 'Desactivado'],
    ['Socket pronósticos vivo', !!ls.livePredictionSocketEmit, ls.livePredictionSocketEmit ? 'Push al publicar' : 'Refresh manual'],
  ];

  const kpis = [
    {
      label: 'Pool pending',
      value: data.dbPool ? String(data.dbPool.pending) : '—',
      cls: poolCls(data),
    },
    {
      label: 'Pool in use',
      value: data.dbPool ? `${data.dbPool.inUse}/${data.dbPool.max}` : '—',
      cls: poolCls(data),
    },
    {
      label: 'Pool health',
      value: data.poolHealth?.status ?? '—',
      cls:
        data.poolHealth?.status === 'critical'
          ? 'text-red-300'
          : data.poolHealth?.status === 'degraded'
            ? 'text-amber-300'
            : 'text-emerald-300',
    },
    {
      label: 'Event loop max',
      value: `${data.eventLoop.maxMs} ms`,
      cls:
        data.eventLoop.maxMs > 10000
          ? 'text-red-300'
          : data.eventLoop.maxMs > 100
            ? 'text-amber-300'
            : 'text-emerald-300',
    },
    {
      label: 'Sockets',
      value: `${data.sockets.active} / ${data.sockets.max}`,
      cls: data.sockets.active > data.sockets.max * 0.85 ? 'text-amber-300' : 'text-emerald-300',
    },
    {
      label: 'LiveHotPoll',
      value: data.liveHotPoll?.running
        ? 'EN CURSO'
        : data.liveHotPoll?.lastMs != null
          ? `${data.liveHotPoll.lastMs} ms`
          : '—',
      cls: data.liveHotPoll?.running
        ? 'text-amber-300'
        : (data.liveHotPoll?.lastMs ?? 0) >= 60000
          ? 'text-red-300'
          : 'text-emerald-300',
    },
    {
      label: 'Heap',
      value: `${data.memory.heapUsedMb} MB (${data.memory.heapPercent}%)`,
      cls: data.memory.heapPercent > 85 ? 'text-amber-300' : 'text-emerald-300',
    },
    {
      label: 'Cola BD Redis',
      value: String(data.redisQueues?.dbPending ?? '—'),
      cls: 'text-slate-200',
    },
    {
      label: 'P3 cola',
      value: data.prediction3Diagnostics?.limiter
        ? `${data.prediction3Diagnostics.limiter.queued ?? 0} / ${data.prediction3Diagnostics.limiter.max ?? '—'}`
        : '—',
      cls: (data.prediction3Diagnostics?.limiter?.queued ?? 0) > 0 ? 'text-amber-300' : 'text-emerald-300',
    },
    {
      label: 'Circuit',
      value: data.poolBackpressure?.open ? 'ABIERTO' : 'ok',
      cls: data.poolBackpressure?.open ? 'text-red-300' : 'text-emerald-300',
    },
    {
      label: 'Config rev',
      value: data.configRevision != null ? String(data.configRevision) : '—',
      cls: (data.configRevision ?? 0) >= 8 ? 'text-emerald-300' : 'text-amber-300',
    },
    {
      label: 'LIVE_PROFILE',
      value: String(data.runtimeSettings?.live_profile_env ?? '—'),
      cls: 'text-slate-200',
    },
  ];

  const jobs = Object.entries(data.jobs || {}).sort(
    (a, b) => (b[1].lastMs ?? 0) - (a[1].lastMs ?? 0),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Monitoreo operacional</h2>
          <p className="text-xs text-slate-500">
            Mismas métricas que `/admin/ops/dashboard` · actualización cada 5s
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Uptime {Math.floor(data.uptimeSec / 3600)}h ·{' '}
          {new Date(data.generatedAt).toLocaleTimeString('es-CO')}
        </p>
      </div>

      {data.clientImpact && (
        <div className={`rounded-xl border p-4 ${impactBorder(data.poolHealth?.status)}`}>
          <p className="text-sm font-medium text-slate-200">Impacto en clientes</p>
          <p className="mt-2 text-sm text-slate-300">{data.clientImpact.summary || '—'}</p>
          {data.clientImpact.note && (
            <p className="mt-1 text-xs text-slate-500">{data.clientImpact.note}</p>
          )}
          {data.clientImpact.symptoms && data.clientImpact.symptoms.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-xs text-slate-400">
              {data.clientImpact.symptoms.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Sin síntomas detectados</p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</p>
            <p className={`mt-1 text-lg font-semibold ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Diagnóstico de carga">
          {(data.loadDiagnostics?.suspects || []).length === 0 ? (
            <p className="text-sm text-slate-500">Sin sospechosos detectados</p>
          ) : (
            <div className="space-y-2">
              {data.loadDiagnostics!.suspects!.map((s) => (
                <div key={`${s.source}-${s.hint}`} className="rounded-lg bg-[#0b0f14] px-3 py-2 text-sm">
                  <p className="font-medium text-slate-200">{s.source}</p>
                  <p className="text-xs text-slate-400">
                    {s.hint}
                    {s.lastMs != null ? ` (${s.lastMs} ms)` : ''}
                    {s.pending != null ? ` pending=${s.pending}` : ''}
                    {s.queued != null ? ` queued=${s.queued}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Recomendaciones">
          {(data.recommendations || []).length === 0 ? (
            <p className="text-sm text-slate-500">Sin recomendaciones</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-300">
              {data.recommendations!.map((r) => (
                <li key={r} className="border-b border-white/5 pb-2 last:border-0">
                  • {r}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Jobs más lentos">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2 text-left">Job</th>
                  <th className="pb-2 text-right">Duración</th>
                  <th className="pb-2 text-left">Última ejecución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(data.slowJobsRanked || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-2 text-slate-500">
                      Ningún job &gt;5s reciente
                    </td>
                  </tr>
                ) : (
                  data.slowJobsRanked!.map((j) => (
                    <tr key={j.name}>
                      <td className="py-2 text-slate-300">{j.name}</td>
                      <td className="py-2 text-right text-amber-300">{j.lastMs} ms</td>
                      <td className="py-2 text-xs text-slate-500">{j.lastRunAt || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Historial pool (últimas muestras)">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2 text-left">Hora</th>
                  <th className="pb-2 text-right">Pending</th>
                  <th className="pb-2 text-right">In use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...(data.poolHistory || [])].reverse().slice(0, 10).map((h) => (
                  <tr key={h.at}>
                    <td className="py-2 text-slate-400">{h.at?.slice(11, 19) ?? '—'}</td>
                    <td className="py-2 text-right text-slate-300">{h.pending}</td>
                    <td className="py-2 text-right text-slate-300">{h.inUse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section title="Servicios en vivo">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 text-left">Servicio</th>
                <th className="pb-2 text-left">Estado</th>
                <th className="pb-2 text-left">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {liveRows.map(([name, on, note]) => (
                <tr key={name}>
                  <td className="py-2 text-slate-300">{name}</td>
                  <td className="py-2">
                    <OnOffBadge on={on} />
                  </td>
                  <td className="py-2 text-xs text-slate-500">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Análisis AI (prediction3)">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Requests lentos (&gt;5s)</p>
              <p className="text-lg font-semibold text-slate-200">{data.prediction3?.slowCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Queue timeout</p>
              <p className="text-lg font-semibold text-amber-300">{data.prediction3?.queueTimeoutCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Concurrentes</p>
              <p className="text-lg font-semibold text-slate-200">
                {data.prediction3Diagnostics?.limiter?.active ?? '—'} /{' '}
                {data.prediction3Diagnostics?.limiter?.max ??
                  data.prediction3Diagnostics?.config?.maxConcurrent ??
                  '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">En cola interna</p>
              <p className="text-lg font-semibold text-slate-200">
                {data.prediction3Diagnostics?.limiter?.queued ?? '—'}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Crons configurados">
          <div className="space-y-1 text-sm">
            {Object.entries(data.cronSchedules || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-white/5 py-1">
                <span className="text-slate-300">{k}</span>
                <span className="text-slate-500">{v}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Jobs en tiempo real">
        <div className="max-h-64 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-[#111827] text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 text-left">Job</th>
                <th className="pb-2 text-left">Última ejecución</th>
                <th className="pb-2 text-right">Duración</th>
                <th className="pb-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 text-slate-500">
                    Sin ejecuciones registradas
                  </td>
                </tr>
              ) : (
                jobs.map(([name, j]) => (
                  <tr key={name}>
                    <td className="py-2 text-slate-300">{name}</td>
                    <td className="py-2 text-xs text-slate-500">{j.lastRunAt || '—'}</td>
                    <td className="py-2 text-right text-slate-400">{j.lastMs ?? '—'} ms</td>
                    <td className="py-2">
                      {j.skipped ? (
                        <span className="text-xs text-amber-300">skipped</span>
                      ) : j.ok !== false ? (
                        <span className="text-xs text-emerald-300">ok</span>
                      ) : (
                        <span className="text-xs text-red-300">error</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Alertas recientes">
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {(data.alerts || []).length === 0 ? (
            <p className="text-sm text-slate-500">Sin alertas</p>
          ) : (
            data.alerts!.map((a, i) => (
              <div
                key={`${a.at}-${i}`}
                className={`rounded-lg border-l-2 px-3 py-2 text-xs ${
                  a.level === 'error'
                    ? 'border-red-500 bg-red-500/10 text-red-200'
                    : 'border-amber-500 bg-amber-500/10 text-amber-100'
                }`}
              >
                <strong>{a.at}</strong> — {a.message}
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}
