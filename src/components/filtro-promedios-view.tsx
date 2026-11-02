'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFiltroPromedios } from '@/lib/api';
import { applyAverageFilters, parseThreshold } from '@/lib/average-match-filter';
import type { AverageFilter, AverageMatch, AverageSide } from '@/lib/types';

type Draft = { side: AverageSide; min: string; max: string };

const SIDES: { id: AverageSide; label: string }[] = [
  { id: 'cualquiera', label: 'Cualquiera' },
  { id: 'local', label: 'Local' },
  { id: 'visitante', label: 'Visitante' },
  { id: 'ambos', label: 'Ambos' },
];

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function fmt(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

function draftsToFilters(drafts: Record<string, Draft>): AverageFilter[] {
  const filters: AverageFilter[] = [];
  for (const [metric, draft] of Object.entries(drafts)) {
    const min = parseThreshold(draft.min);
    const max = parseThreshold(draft.max);
    if (min != null) filters.push({ metric, side: draft.side, op: 'gte', value: min });
    if (max != null) filters.push({ metric, side: draft.side, op: 'lte', value: max });
  }
  return filters;
}

function activeMetricKeys(drafts: Record<string, Draft>) {
  return Object.entries(drafts)
    .filter(([, draft]) => parseThreshold(draft.min) != null || parseThreshold(draft.max) != null)
    .map(([key]) => key);
}

export function FiltroPromediosView() {
  const [fecha, setFecha] = useState(todayBogota);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const query = useQuery({
    queryKey: ['filtro-promedios', fecha],
    queryFn: () => fetchFiltroPromedios(fecha),
    enabled: fechaValida,
  });

  const metricas = query.data?.metricas ?? [];
  const filters = useMemo(() => draftsToFilters(drafts), [drafts]);
  const activeKeys = useMemo(() => activeMetricKeys(drafts), [drafts]);

  const visible = useMemo(() => {
    const rows = applyAverageFilters(query.data?.data ?? [], filters);
    const needle = normalizeSearch(search);
    if (!needle) return rows;
    return rows.filter((row) =>
      normalizeSearch([row.local, row.visitante, row.liga, row.pais].join(' ')).includes(needle),
    );
  }, [filters, query.data?.data, search]);

  function draftOf(key: string): Draft {
    return drafts[key] ?? { side: 'cualquiera', min: '', max: '' };
  }

  function patchDraft(key: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const prev = current[key];
      return {
        ...current,
        [key]: {
          side: patch.side ?? prev?.side ?? 'cualquiera',
          min: patch.min ?? prev?.min ?? '',
          max: patch.max ?? prev?.max ?? '',
        },
      };
    });
  }

  function clearDrafts() {
    setDrafts({});
  }

  const dayTotal = query.data?.totalDia ?? query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Filtro de promedios</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Partidos del día según los promedios ya guardados. El local se mira como local y el
          visitante como visitante. Escribe un mínimo, un máximo o los dos, y combínalos entre
          tipos: por ejemplo remates totales desde 12 y córners hasta 8.
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFecha((current) => shiftDate(current, -1))}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Día anterior
            </button>
            <button
              type="button"
              onClick={() => setFecha(todayBogota())}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setFecha((current) => shiftDate(current, 1))}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Día siguiente
            </button>
          </div>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-slate-400">
            Buscar equipo o liga
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre"
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {query.data
            ? `${visible.length} de ${dayTotal} partidos con promedios el ${fecha}.`
            : 'La fecha es el día en Colombia.'}
        </p>
      </section>

      {query.isLoading ? <p className="text-sm text-slate-400">Cargando promedios…</p> : null}
      {query.isError ? (
        <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {(query.error as Error).message || 'No se pudo cargar el día'}
        </p>
      ) : null}

      {metricas.length > 0 ? (
        <section className="mb-4 overflow-x-auto rounded-xl border border-white/10">
          <div className="flex items-center justify-between gap-3 bg-[#111827] px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Promedios</p>
            <button
              type="button"
              onClick={clearDrafts}
              className="text-xs text-slate-300 hover:text-white"
            >
              Limpiar filtros
            </button>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Aplicar a</th>
                <th className="px-3 py-2 font-medium">Mayor o igual</th>
                <th className="px-3 py-2 font-medium">Menor o igual</th>
              </tr>
            </thead>
            <tbody>
              {metricas.map((metric) => {
                const draft = draftOf(metric.key);
                return (
                  <tr key={metric.key} className="border-t border-white/10">
                    <td className="px-3 py-2 text-slate-100">{metric.label}</td>
                    <td className="px-3 py-2">
                      <select
                        value={draft.side}
                        onChange={(event) => patchDraft(metric.key, { side: event.target.value as AverageSide })}
                        className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-sm text-slate-200"
                      >
                        {SIDES.map((side) => (
                          <option key={side.id} value={side.id}>
                            {side.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="decimal"
                        value={draft.min}
                        onChange={(event) => patchDraft(metric.key, { min: event.target.value })}
                        placeholder="Mín."
                        className="w-28 rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-sm text-slate-200"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="decimal"
                        value={draft.max}
                        onChange={(event) => patchDraft(metric.key, { max: event.target.value })}
                        placeholder="Máx."
                        className="w-28 rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-sm text-slate-200"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {query.data && visible.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-[#111827] px-4 py-8 text-center text-sm text-slate-400">
          {dayTotal === 0
            ? 'Este día no tiene partidos con promedios guardados.'
            : 'Ningún partido cumple esos promedios.'}
        </p>
      ) : null}

      {visible.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#111827] text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Partido</th>
                {activeKeys.map((key) => (
                  <th key={key} className="px-3 py-3 font-medium">
                    {metricas.find((metric) => metric.key === key)?.label || key}
                    <span className="mt-0.5 block font-normal normal-case text-slate-600">Local / visitante</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row: AverageMatch) => (
                <tr key={String(row.fixtureid)} className="border-t border-white/10 bg-[#0b0f14] align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-100">
                      {row.local}
                      <span className="mx-1 text-slate-500">vs</span>
                      {row.visitante}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {row.fechaDisplay}
                      {row.estado ? ` · ${row.estado}` : ''}
                      {row.marcador !== '—' ? ` · ${row.marcador}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.pais ? `${row.pais} · ` : ''}
                      {row.liga}
                    </p>
                  </td>
                  {activeKeys.map((key) => {
                    const pair = row.promedios?.[key];
                    return (
                      <td key={key} className="whitespace-nowrap px-3 py-3 text-slate-200">
                        {fmt(pair?.local)}
                        <span className="mx-1 text-slate-600">/</span>
                        {fmt(pair?.visitante)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
