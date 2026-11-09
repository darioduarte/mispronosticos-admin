'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchOpsDayTimeline } from '@/lib/api';
import type { OpsDayTimelineSpan } from '@/lib/types';

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function statusColor(status: string) {
  if (status === 'failed') return 'bg-red-500/80';
  if (status === 'skipped' || status === 'deferred') return 'bg-amber-500/70';
  if (status === 'running') return 'bg-sky-500/70';
  return 'bg-emerald-500/70';
}

function formatHourBogota(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function spanTitle(span: OpsDayTimelineSpan) {
  const dur =
    span.durationMs >= 60000
      ? `${(span.durationMs / 60000).toFixed(1)} min`
      : `${Math.round(span.durationMs / 1000)} s`;
  return `${span.label} · ${span.status} · ${dur}${span.reason ? `\n${span.reason}` : ''}`;
}

function GanttChart({
  lanes,
  windowStart,
  windowEnd,
}: {
  lanes: { id: string; label: string; spans: OpsDayTimelineSpan[] }[];
  windowStart: string;
  windowEnd: string;
}) {
  const startMs = new Date(windowStart).getTime();
  const endMs = Math.max(new Date(windowEnd).getTime(), startMs + 60_000);
  const total = endMs - startMs;

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let t = startMs; t <= endMs; t += 60 * 60 * 1000) {
      out.push(t);
    }
    if (out.length === 0) out.push(startMs);
    return out;
  }, [startMs, endMs]);

  if (!lanes.length) {
    return <p className="text-sm text-slate-500">Sin corridas en esta ventana todavía.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[52rem]">
        <div className="relative mb-2 ml-36 h-4 border-b border-white/5">
          {hours.map((t) => {
            const left = ((t - startMs) / total) * 100;
            return (
              <div
                key={t}
                className="absolute top-0 -translate-x-1/2 text-[10px] text-slate-500"
                style={{ left: `${left}%` }}
              >
                {formatHourBogota(new Date(t).toISOString())}
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          {lanes.map((lane) => (
            <div key={lane.id} className="flex items-center gap-3">
              <div className="w-36 shrink-0 truncate text-xs text-slate-400" title={lane.label}>
                {lane.label}
              </div>
              <div className="relative h-7 flex-1 rounded bg-white/5">
                {lane.spans.map((span) => {
                  const s = new Date(span.start).getTime();
                  const e = new Date(span.end).getTime();
                  const left = Math.max(0, ((s - startMs) / total) * 100);
                  const width = Math.max(0.6, ((Math.max(e, s + 30_000) - s) / total) * 100);
                  return (
                    <div
                      key={span.id}
                      title={spanTitle(span)}
                      className={`absolute top-1 h-5 rounded-sm ${statusColor(span.status)}`}
                      style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OpsDayTimelinePanel() {
  const [date, setDate] = useState(todayBogota);
  const [hours, setHours] = useState(24);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ops-day-timeline', date, hours],
    queryFn: () => fetchOpsDayTimeline({ date, hours }),
    refetchInterval: 60_000,
  });

  const coverage = data?.coverage;
  const sla = coverage?.sla;

  return (
    <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Timeline del día
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Carriles de crons, deferrals y cobertura D+1 (hora Bogotá). Enlace a{' '}
            <Link href="/control-crons" className="text-indigo-300 hover:underline">
              control de crons
            </Link>{' '}
            y{' '}
            <Link href="/control-analisis-vivo" className="text-indigo-300 hover:underline">
              análisis vivo
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDate(shiftDays(date, -1))}
            className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/5"
          >
            ←
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-xs text-slate-200"
          />
          <button
            type="button"
            onClick={() => setDate(shiftDays(date, 1))}
            className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/5"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setDate(todayBogota())}
            className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/5"
          >
            Hoy
          </button>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-xs text-slate-200"
          >
            <option value={12}>12 h</option>
            <option value={24}>24 h</option>
            <option value={48}>48 h</option>
          </select>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            {isFetching ? '…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {coverage ? (
        <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-300">
          <span>
            D+1 <span className="text-slate-100">{coverage.targetDate || '—'}</span>
          </span>
          <span>
            Fixtures destacados: {coverage.fixturesCount ?? '—'} · Promedios:{' '}
            {coverage.averagesCount ?? '—'}
          </span>
          {coverage.checkpoint ? (
            <span>
              Checkpoint:{' '}
              {coverage.checkpoint.saved}/{coverage.checkpoint.expected} (omitidos{' '}
              {coverage.checkpoint.skipped})
            </span>
          ) : null}
          {sla ? (
            <span className={sla.ready ? 'text-emerald-300' : 'text-amber-300'}>
              SLA pre-GPT: {sla.ready ? 'listo' : 'incompleto'} (
              {(sla.fixturesCoverage * 100).toFixed(0)}% fixtures /{' '}
              {(sla.averagesRatio * 100).toFixed(0)}% promedios)
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-emerald-500/70" /> success
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-red-500/80" /> failed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-amber-500/70" /> skipped/deferred
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-sky-500/70" /> running
        </span>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Cargando timeline…</p> : null}
      {error ? (
        <p className="text-sm text-red-300">{(error as Error).message || 'Error al cargar'}</p>
      ) : null}
      {data?.window ? (
        <GanttChart
          lanes={data.lanes || []}
          windowStart={data.window.start}
          windowEnd={data.window.end}
        />
      ) : null}
    </section>
  );
}
