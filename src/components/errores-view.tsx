'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchErrors } from '@/lib/api';
import type { ErrorLogRow } from '@/lib/types';

const SOURCES = [
  { value: 'todas', label: 'Todas' },
  { value: 'client', label: 'Cliente' },
  { value: 'server', label: 'Servidor' },
];

const SOURCE_COLORS: Record<string, string> = {
  client: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  server: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  unknown: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

function SourceBadge({ row }: { row: ErrorLogRow }) {
  const key = row.source || 'unknown';
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        SOURCE_COLORS[key] || SOURCE_COLORS.unknown
      }`}
    >
      {row.sourceLabel}
    </span>
  );
}

function truncate(text: string, max = 140) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function DetailModal({
  row,
  onClose,
}: {
  row: ErrorLogRow;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Detalle del error</h2>
            <p className="mt-1 text-sm text-slate-400">{row.createdAtDisplay || '—'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge row={row} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vista</p>
              <p className="mt-1 break-all text-slate-200">{row.vista || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Componente</p>
              <p className="mt-1 break-all text-slate-200">{row.componente || '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ID</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-400">{row.id}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Error</p>
            <pre className="mt-2 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 font-mono text-xs text-slate-200">
              {row.error || '—'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErroresView() {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('todas');
  const [vista, setVista] = useState('');
  const [componente, setComponente] = useState('');
  const [applied, setApplied] = useState({
    search: '',
    source: 'todas',
    vista: '',
    componente: '',
  });
  const [selected, setSelected] = useState<ErrorLogRow | null>(null);

  const query = useQuery({
    queryKey: ['errors', applied],
    queryFn: () =>
      fetchErrors({
        search: applied.search || undefined,
        source: applied.source,
        vista: applied.vista || undefined,
        componente: applied.componente || undefined,
        limit: 100,
      }),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const bySource = meta?.bySource ?? {};

  function applyFilters() {
    setApplied({
      search: search.trim(),
      source,
      vista: vista.trim(),
      componente: componente.trim(),
    });
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Errores</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registro de errores de cliente y servidor (tabla ErrorLog).
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="vista, componente, mensaje…"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Origen</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Vista</span>
            <input
              type="text"
              value={vista}
              onChange={(e) => setVista(e.target.value)}
              placeholder="ej. Rewarded, cron…"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Componente</span>
            <input
              type="text"
              value={componente}
              onChange={(e) => setComponente(e.target.value)}
              placeholder="módulo o job…"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Buscar
          </button>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-[#111827] px-3 py-1 text-slate-400">
          Total: <strong className="text-slate-200">{meta?.total ?? '—'}</strong>
        </span>
        {SOURCES.filter((s) => s.value !== 'todas').map((s) => (
          <span
            key={s.value}
            className={`rounded-full border px-3 py-1 ${SOURCE_COLORS[s.value] || 'border-white/10 text-slate-400'}`}
          >
            {s.label}: {bySource[s.value] ?? 0}
          </span>
        ))}
        {(bySource.unknown ?? 0) > 0 ? (
          <span className={`rounded-full border px-3 py-1 ${SOURCE_COLORS.unknown}`}>
            Sin origen: {bySource.unknown}
          </span>
        ) : null}
      </div>

      {query.isLoading && <p className="text-slate-400">Cargando errores…</p>}
      {query.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Error al cargar. ¿Desplegaste el backend con `/api/admin/errors`?
        </p>
      )}

      {!query.isLoading && !query.isError && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#111827] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Vista</th>
                <th className="px-4 py-3">Componente</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#0b0f14]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Sin errores con estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {row.createdAtDisplay || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge row={row} />
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-300">
                      {row.vista || '—'}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-300">
                      {row.componente || '—'}
                    </td>
                    <td className="max-w-[380px] px-4 py-3 font-mono text-xs text-slate-400">
                      {truncate(row.error)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected ? <DetailModal row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
