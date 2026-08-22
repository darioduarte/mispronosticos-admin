'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCronHeartbeats } from '@/lib/api';

function statusCls(status?: string | null) {
  const s = String(status || '');
  if (s === 'success') return 'text-emerald-300';
  if (s === 'failed' || s === 'missed') return 'text-red-300';
  if (s === 'running') return 'text-amber-300';
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

export function CronHeartbeatsPanel() {
  const query = useQuery({
    queryKey: ['cron-heartbeats'],
    queryFn: fetchCronHeartbeats,
    refetchInterval: 15_000,
  });

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
  const attention = crons.filter((c) =>
    ['failed', 'missed', 'running'].includes(String(c.lastStatus || '')),
  );

  return (
    <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Crons del worker</h2>
          <p className="text-xs text-slate-500">
            Heartbeats MySQL · cada 15s · {crons.length} jobs registrados
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
              <th className="pb-2 text-left">Estado</th>
              <th className="pb-2 text-left">Último éxito</th>
              <th className="pb-2 text-right">Duración</th>
              <th className="pb-2 text-left">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {crons.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 text-slate-500">
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
                  <td className={`py-2 text-xs font-medium ${statusCls(c.lastStatus)}`}>
                    {c.lastStatus || '—'}
                  </td>
                  <td className="py-2 text-xs text-slate-400">
                    {formatWhen(c.lastSuccessAt)}
                  </td>
                  <td className="py-2 text-right text-xs text-slate-400">
                    {c.lastDurationMs != null ? `${c.lastDurationMs} ms` : '—'}
                  </td>
                  <td className="max-w-[280px] py-2 text-xs text-red-300/90">
                    {c.lastError || ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
