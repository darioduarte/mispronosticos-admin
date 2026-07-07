'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchOpsIncidents, fetchOpsIncidentsReport, downloadOpsIncidentsLog } from '@/lib/api';
import type { OpsIncidentRow } from '@/lib/types';

const TYPE_LABELS: Record<string, string> = {
  pool_circuit_open: 'Circuit breaker abierto',
  pool_critical: 'Pool crítico',
  pool_defer: 'Job diferido (pool)',
  job_mutex_skip: 'Job en paralelo bloqueado',
  ops_alert: 'Alerta ops',
  admin_request_blocked: 'Admin bloqueado',
};

function severityClass(severity?: string) {
  if (severity === 'critical') return 'border-red-500/50 bg-red-500/10 text-red-200';
  if (severity === 'error') return 'border-orange-500/50 bg-orange-500/10 text-orange-200';
  if (severity === 'warn') return 'border-amber-500/50 bg-amber-500/10 text-amber-100';
  return 'border-slate-500/40 bg-slate-500/10 text-slate-200';
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', { hour12: false });
  } catch {
    return iso;
  }
}

function IncidentCard({ inc }: { inc: OpsIncidentRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border-l-2 px-3 py-2 text-xs ${severityClass(inc.severity)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-wide opacity-80">{inc.severity}</span>
            {inc.open ? (
              <span className="rounded bg-red-600/30 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                ABIERTO
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">
                {inc.durationSec != null ? `${inc.durationSec}s` : 'cerrado'}
              </span>
            )}
            <span className="text-[10px] text-slate-500">
              {TYPE_LABELS[inc.type] || inc.type}
            </span>
          </div>
          <p className="mt-1 text-sm">{inc.message}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            {formatWhen(inc.startedAt)}
            {inc.instanceId ? ` · ${inc.instanceId}` : ''}
          </p>
        </div>
        {inc.context ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-[10px] text-indigo-300 hover:underline"
          >
            {open ? 'Ocultar' : 'Detalle'}
          </button>
        ) : null}
      </div>
      {open && inc.context ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/30 p-2 text-[10px] text-slate-300">
          {JSON.stringify(inc.context, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export function OpsIncidentsPanel() {
  const [hours, setHours] = useState(24);
  const [typeFilter, setTypeFilter] = useState('');
  const [copyMsg, setCopyMsg] = useState('');

  const query = useQuery({
    queryKey: ['ops-incidents', hours, typeFilter],
    queryFn: () =>
      fetchOpsIncidents({
        hours,
        limit: 100,
        type: typeFilter || undefined,
      }),
    refetchInterval: 30_000,
  });

  const incidents = query.data?.data ?? [];
  const meta = query.data?.meta;
  const openCount = useMemo(() => incidents.filter((i) => i.open).length, [incidents]);

  const types = useMemo(() => {
    const set = new Set(incidents.map((i) => i.type));
    return [...set].sort();
  }, [incidents]);

  async function handleCopyReport() {
    setCopyMsg('');
    try {
      const report = await fetchOpsIncidentsReport({ hours, type: typeFilter || undefined });
      await navigator.clipboard.writeText(report.report || '');
      setCopyMsg('Informe copiado al portapapeles');
    } catch (e) {
      setCopyMsg((e as Error).message || 'No se pudo copiar');
    }
  }

  async function handleDownloadLog() {
    setCopyMsg('');
    try {
      await downloadOpsIncidentsLog(hours);
      setCopyMsg('Log descargado');
    } catch (e) {
      setCopyMsg((e as Error).message || 'No se pudo descargar');
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Incidentes operacionales
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Log en archivo del servidor (sin MySQL) — saturación, circuit breaker, jobs diferidos y bloqueos.
            {meta ? ` · últimas ${meta.hours}h` : ''}
            {meta?.logPath ? (
              <span className="block text-[11px] text-slate-500">Archivo: {meta.logPath}</span>
            ) : null}
            {openCount > 0 ? (
              <span className="ml-2 font-medium text-red-300">{openCount} abierto(s)</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-xs text-slate-200"
          >
            <option value={6}>6 horas</option>
            <option value={24}>24 horas</option>
            <option value={72}>3 días</option>
            <option value={168}>7 días</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">Todos los tipos</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] || t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCopyReport}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
          >
            Copiar informe
          </button>
          <button
            type="button"
            onClick={handleDownloadLog}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Descargar log
          </button>
        </div>
      </div>

      {copyMsg ? <p className="mb-3 text-xs text-emerald-300">{copyMsg}</p> : null}

      {query.isLoading ? (
        <p className="text-sm text-slate-500">Cargando incidentes…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-300">{(query.error as Error).message}</p>
      ) : incidents.length === 0 ? (
        <p className="text-sm text-slate-500">
          Sin incidentes registrados en este período. Cuando el pool se sature o un job se difiera, aparecerán aquí.
        </p>
      ) : (
        <div className="max-h-[28rem] space-y-2 overflow-y-auto">
          {incidents.map((inc) => (
            <IncidentCard key={inc.id} inc={inc} />
          ))}
        </div>
      )}
    </section>
  );
}
