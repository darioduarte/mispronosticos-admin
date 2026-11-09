'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOpsDayReport } from '@/lib/api';
import type { OpsDayCron, OpsDayEvent, OpsDayLiveEvent } from '@/lib/types';

const TYPE_LABELS: Record<string, string> = {
  pool_circuit_open: 'Circuit breaker abierto',
  pool_critical: 'Pool crítico',
  client_latency: 'Pantalla lenta',
  pool_defer: 'Job diferido',
  job_mutex_skip: 'Job bloqueado',
  ops_alert: 'Alerta',
  cron_missed: 'Cron perdido',
  admin_request_blocked: 'Admin bloqueado',
};

function when(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function tone(severity?: string) {
  if (severity === 'critical' || severity === 'error') return 'bg-red-400';
  if (severity === 'warn') return 'bg-amber-400';
  return 'bg-slate-400';
}

function EventRow({ row }: { row: OpsDayEvent }) {
  const ms = row.durationMs != null ? `${Math.round(row.durationMs)} ms` : null;
  return (
    <li className="border-b border-white/5 py-2 last:border-0">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone(row.severity)}`} />
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">
            {when(row.at)} · {TYPE_LABELS[row.type] || row.type}
            {ms ? ` · ${ms}` : ''}
          </p>
          <p className="text-sm text-slate-200">{row.message || '—'}</p>
          {row.why ? <p className="text-xs text-slate-400">{row.why}</p> : null}
          {row.jobs?.length ? (
            <p className="text-[11px] text-slate-500">Corría: {row.jobs.join(', ')}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children || <p className="text-sm text-slate-500">{empty}</p>}
    </section>
  );
}

function CronList({ rows, note }: { rows: OpsDayCron[]; note?: string | null }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">{note || 'Ningún cron marcado en esta ventana.'}</p>;
  }
  return (
    <ul>
      {note ? <li className="pb-1 text-xs text-amber-200">{note}</li> : null}
      {rows.map((row) => (
        <li key={row.jobKey || row.label} className="border-b border-white/5 py-2 text-sm last:border-0">
          <span className="text-slate-200">{row.label || row.jobKey}</span>
          <span className="text-slate-500"> · {row.status || '—'}</span>
          <p className="text-[11px] text-slate-500">Último éxito {when(row.lastSuccessAt)}</p>
          {row.lastError ? <p className="text-xs text-red-300">{row.lastError}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function LiveList({ rows, note }: { rows: OpsDayLiveEvent[]; note?: string | null }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">{note || 'Sin eventos recientes de publicación en vivo.'}</p>;
  }
  return (
    <ul>
      {note ? <li className="pb-1 text-xs text-amber-200">{note}</li> : null}
      {rows.map((row, index) => (
        <li key={`${row.at}-${row.fixtureId}-${index}`} className="border-b border-white/5 py-2 text-sm last:border-0">
          <p className="text-[11px] text-slate-500">
            {when(row.at)}
            {row.phaseKey ? ` · ${row.phaseKey}` : ''}
            {row.fixtureId != null ? ` · partido ${row.fixtureId}` : ''}
          </p>
          <p className="text-slate-200">{row.reason || row.message || row.kind || 'evento'}</p>
        </li>
      ))}
    </ul>
  );
}

export function OpsDayDrawer({ hours, onClose }: { hours: number; onClose: () => void }) {
  const [copyMsg, setCopyMsg] = useState('');
  const query = useQuery({
    queryKey: ['ops-day-report', hours],
    queryFn: () => fetchOpsDayReport({ hours }),
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copyReport() {
    setCopyMsg('');
    try {
      await navigator.clipboard.writeText(query.data?.report || '');
      setCopyMsg('Panorama copiado. Pégalo en el chat para revisarlo.');
    } catch (error) {
      setCopyMsg((error as Error).message || 'No se pudo copiar');
    }
  }

  const day = query.data?.day;
  const summary = query.data?.summary;
  const timeline = [...(day?.timeline || [])].reverse();
  const latency = [...(day?.latency || [])].reverse();
  const interrupted = [...(day?.interrupted || [])].reverse();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="presentation">
      <button type="button" aria-label="Cerrar panorama" className="absolute inset-0" onClick={onClose} />
      <aside
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#0f141c] shadow-2xl"
        role="dialog"
        aria-labelledby="ops-day-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="ops-day-title" className="text-base font-semibold text-white">
              Panorama del día
            </h2>
            <p className="text-xs text-slate-400">
              Últimas {hours} h · hora Bogotá · API y worker
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {query.isLoading ? <p className="text-sm text-slate-500">Armando el día…</p> : null}
          {query.isError ? (
            <p className="text-sm text-red-300">{(query.error as Error).message}</p>
          ) : null}

          {summary ? (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Eventos" value={summary.events} />
              <Stat label="Pantallas lentas" value={summary.latency} />
              <Stat label="Frenados" value={summary.interrupted} />
            </div>
          ) : null}

          {day ? (
            <>
              <Section title="Pantallas lentas" empty="Ninguna guardada en esta ventana.">
                {latency.length ? (
                  <ul>{latency.map((row) => <EventRow key={row.id || row.at} row={row} />)}</ul>
                ) : null}
              </Section>
              <Section title="Procesos frenados" empty="Ninguno guardado en esta ventana.">
                {interrupted.length ? (
                  <ul>{interrupted.map((row) => <EventRow key={row.id || row.at} row={row} />)}</ul>
                ) : null}
              </Section>
              <Section title="Crons que piden atención" empty="">
                <CronList rows={day.crons} note={day.cronNote} />
              </Section>
              <Section title="Pronósticos en vivo" empty="">
                <LiveList rows={day.liveEvents} note={day.liveNote} />
              </Section>
              <Section title="Línea de tiempo" empty="Todavía no hay eventos en esta ventana.">
                {timeline.length ? (
                  <ul>{timeline.map((row) => <EventRow key={`${row.id}-${row.at}`} row={row} />)}</ul>
                ) : null}
              </Section>
            </>
          ) : query.data?.report ? (
            <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-300">{query.data.report}</pre>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <p className="text-xs text-emerald-300">{copyMsg}</p>
          <button
            type="button"
            onClick={copyReport}
            disabled={!query.data?.report}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            Copiar texto
          </button>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
