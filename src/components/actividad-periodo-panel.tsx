'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchDashboardActividad } from '@/lib/api';
import { RenewalSyncPanel } from '@/components/renewal-sync-panel';
import type { DashboardActividadHoy } from '@/lib/types';

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

function ActividadTable({ actividad }: { actividad: DashboardActividadHoy }) {
  const totalLabel = actividad.esUnDia === false ? 'Total período' : 'Total día';
  const title =
    actividad.esUnDia === false
      ? `Actividad (${actividad.fechaDesde} — ${actividad.fechaHasta})`
      : `Actividad del día (${actividad.fecha})`;

  const rows = [
    {
      label: 'Compras',
      ios: actividad.compras.ios,
      android: actividad.compras.android,
      total: actividad.compras.total,
      cls: 'text-emerald-300',
    },
    {
      label: 'Renovaciones',
      ios: actividad.renovaciones.ios,
      android: actividad.renovaciones.android,
      total: actividad.renovaciones.total,
      cls: 'text-sky-300',
    },
    {
      label: totalLabel,
      ios: actividad.total.ios,
      android: actividad.total.android,
      total: actividad.total.all,
      cls: 'text-white font-semibold',
    },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="text-xs text-slate-500">Zona horaria: America/Bogotá</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-2 text-left">Tipo</th>
              <th className="pb-2 text-right">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> iOS
                </span>
              </th>
              <th className="pb-2 text-right">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Android
                </span>
              </th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-2.5 text-slate-300">{row.label}</td>
                <td className={`py-2.5 text-right ${row.cls}`}>{fmt(row.ios)}</td>
                <td className={`py-2.5 text-right ${row.cls}`}>{fmt(row.android)}</td>
                <td className={`py-2.5 text-right ${row.cls}`}>{fmt(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-600">{actividad.nota}</p>
    </div>
  );
}

export function ActividadPeriodoPanel({ initialFecha }: { initialFecha?: string }) {
  const hoy = initialFecha || todayBogota();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [applied, setApplied] = useState({ desde: hoy, hasta: hoy });

  const query = useQuery({
    queryKey: ['dashboard-actividad', applied.desde, applied.hasta],
    queryFn: () => fetchDashboardActividad(applied.desde, applied.hasta),
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

      {query.isLoading && <p className="text-sm text-slate-500">Consultando actividad…</p>}
      {query.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {query.error instanceof ApiError ? query.error.message : 'Error al cargar actividad'}
        </p>
      )}
      {query.data?.actividad && (
        <>
          <ActividadTable actividad={query.data.actividad} />
          <RenewalSyncPanel />
        </>
      )}
    </div>
  );
}
