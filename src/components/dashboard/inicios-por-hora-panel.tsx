'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchDashboardIniciosPorHora } from '@/lib/api';
import type { DashboardIniciosPorHoraSlot } from '@/lib/types';

function fmt(n: number | undefined) {
  return (n ?? 0).toLocaleString('es-CO');
}

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

function padHour(hora: number) {
  return `${String(hora).padStart(2, '0')}:00`;
}

function HourlyChart({
  horas,
  pico,
}: {
  horas: DashboardIniciosPorHoraSlot[];
  pico: DashboardIniciosPorHoraSlot;
}) {
  const max = Math.max(1, ...horas.map((h) => h.total));
  const hasData = horas.some((h) => h.total > 0);

  if (!hasData) {
    return <p className="text-sm text-slate-500">Sin inicios de sesión en el período.</p>;
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-[40rem] items-end gap-0.5 sm:min-w-full sm:gap-1">
        {horas.map((slot) => {
          let pctHeight = max ? (slot.total / max) * 100 : 0;
          if (slot.total > 0 && pctHeight < 6) pctHeight = 6;
          const isPeak = slot.hora === pico.hora && pico.total > 0;
          return (
            <div key={slot.hora} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={`text-[8px] tabular-nums leading-none sm:text-[10px] ${
                  isPeak ? 'font-semibold text-amber-300' : 'text-slate-500'
                }`}
              >
                {slot.total > 0 ? fmt(slot.total) : ''}
              </span>
              <div
                className="flex h-28 w-full max-w-8 flex-col justify-end overflow-hidden rounded-sm sm:h-36 sm:max-w-10"
                title={`${padHour(slot.hora)} · ${fmt(slot.total)} inicios`}
              >
                <div
                  className={isPeak ? 'bg-amber-400' : 'bg-indigo-500'}
                  style={{ height: `${pctHeight}%` }}
                />
              </div>
              <span
                className={`whitespace-nowrap text-[8px] sm:text-[10px] ${
                  isPeak ? 'font-semibold text-amber-300' : 'text-slate-500'
                }`}
              >
                {String(slot.hora).padStart(2, '0')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IniciosPorHoraPanel({ initialFecha }: { initialFecha?: string }) {
  const hoy = initialFecha || todayBogota();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [applied, setApplied] = useState({ desde: hoy, hasta: hoy });

  const query = useQuery({
    queryKey: ['dashboard-inicios-por-hora', applied.desde, applied.hasta],
    queryFn: () => fetchDashboardIniciosPorHora(applied.desde, applied.hasta),
  });

  const presets = useMemo(
    () => [
      { label: 'Hoy', desde: hoy, hasta: hoy },
      { label: 'Ayer', desde: shiftDays(hoy, -1), hasta: shiftDays(hoy, -1) },
      { label: '7 días', desde: shiftDays(hoy, -6), hasta: hoy },
      { label: '30 días', desde: shiftDays(hoy, -29), hasta: hoy },
    ],
    [hoy],
  );

  function applyRange(nextDesde: string, nextHasta: string) {
    setDesde(nextDesde);
    setHasta(nextHasta);
    setApplied({ desde: nextDesde, hasta: nextHasta });
  }

  const data = query.data;
  const title =
    data?.esUnDia === false
      ? `Inicios de sesión por hora (${data.fechaDesde} — ${data.fechaHasta})`
      : `Inicios de sesión por hora (${data?.fechaDesde || applied.desde})`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-[#111827] p-4">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
          />
        </label>
        <button
          type="button"
          onClick={() => applyRange(desde, hasta)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Consultar
        </button>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyRange(p.desde, p.hasta)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:border-indigo-500/40 hover:text-indigo-200"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="text-xs text-slate-500">Zona horaria: America/Bogotá</p>
        </div>

        {query.isLoading && <p className="text-sm text-slate-500">Consultando inicios por hora…</p>}
        {query.isError && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {query.error instanceof ApiError ? query.error.message : 'Error al cargar inicios por hora'}
          </p>
        )}

        {data?.success && (
          <>
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <p className="text-slate-300">
                Total período:{' '}
                <span className="font-semibold tabular-nums text-white">{fmt(data.totalPeriodo)}</span>
              </p>
              {data.pico.total > 0 && (
                <p className="text-slate-300">
                  Hora pico:{' '}
                  <span className="font-semibold tabular-nums text-amber-300">
                    {padHour(data.pico.hora)} ({fmt(data.pico.total)})
                  </span>
                </p>
              )}
            </div>
            <HourlyChart horas={data.horas} pico={data.pico} />
            {data.nota && <p className="mt-3 text-xs text-slate-600">{data.nota}</p>}
          </>
        )}
      </div>
    </div>
  );
}
