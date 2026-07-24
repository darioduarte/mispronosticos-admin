'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchSuggestions } from '@/lib/api';
import type { SuggestionRow } from '@/lib/types';

const CATEGORIAS = [
  { value: 'todas', label: 'Todas' },
  { value: 'nueva_funcion', label: 'Nueva función' },
  { value: 'mejora', label: 'Mejora' },
  { value: 'bug', label: 'Reportar bug' },
  { value: 'otro', label: 'Otro' },
];

const PLATAFORMAS = [
  { value: 'todas', label: 'Todas' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
];

const CATEGORY_COLORS: Record<string, string> = {
  nueva_funcion: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  mejora: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  bug: 'bg-red-500/15 text-red-300 border-red-500/30',
  otro: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

function CategoryBadge({ row }: { row: SuggestionRow }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        CATEGORY_COLORS[row.categoria] || 'border-white/10 text-slate-400'
      }`}
    >
      {row.categoriaLabel}
    </span>
  );
}

function truncate(text: string, max = 120) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function DetailModal({
  row,
  onClose,
}: {
  row: SuggestionRow;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Sugerencia</h2>
            <p className="mt-1 text-sm text-slate-400">
              {row.createdAtDisplay || '—'} · {row.platform || 'plataforma ?'}
              {row.appVersion ? ` · v${row.appVersion}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ?
          </button>
        </div>
        <div className="space-y-4 p-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge row={row} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Usuario</p>
            <p className="mt-1 text-slate-200">{row.userName || '—'}</p>
            <p className="text-slate-400">{row.userEmail || row.userId}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mensaje</p>
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 text-slate-200">
              {row.mensaje}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SugerenciasView() {
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [platform, setPlatform] = useState('todas');
  const [applied, setApplied] = useState({
    email: '',
    search: '',
    categoria: 'todas',
    platform: 'todas',
  });
  const [selected, setSelected] = useState<SuggestionRow | null>(null);

  const query = useQuery({
    queryKey: ['suggestions', applied],
    queryFn: () =>
      fetchSuggestions({
        email: applied.email || undefined,
        search: applied.search || undefined,
        categoria: applied.categoria,
        platform: applied.platform,
        limit: 100,
      }),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const byCategory = meta?.byCategory ?? {};

  function applyFilters() {
    setApplied({
      email: email.trim().toLowerCase(),
      search: search.trim(),
      categoria,
      platform,
    });
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Sugerencias</h1>
        <p className="mt-1 text-sm text-slate-500">
          Opiniones y reportes enviados desde el buzón de sugerencias de la app.
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Email exacto</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="email, nombre, mensaje…"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Categoría</span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Plataforma</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {PLATAFORMAS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
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
        {CATEGORIAS.filter((c) => c.value !== 'todas').map((c) => (
          <span
            key={c.value}
            className={`rounded-full border px-3 py-1 ${CATEGORY_COLORS[c.value] || 'border-white/10 text-slate-400'}`}
          >
            {c.label}: {byCategory[c.value] ?? 0}
          </span>
        ))}
      </div>

      {query.isLoading && <p className="text-slate-400">Cargando sugerencias…</p>}
      {query.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Error al cargar. ¿Desplegaste el backend con `/api/admin/suggestions`?
        </p>
      )}

      {!query.isLoading && !query.isError && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#111827] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Mensaje</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#0b0f14]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Sin sugerencias con estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {row.createdAtDisplay || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px]">
                        <p className="truncate text-slate-200">{row.userName || '—'}</p>
                        <p className="truncate text-xs text-slate-500">
                          {row.userEmail || row.userId}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge row={row} />
                    </td>
                    <td className="max-w-[360px] px-4 py-3 text-slate-300">
                      {truncate(row.mensaje)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {row.platform || '—'}
                      {row.appVersion ? ` · v${row.appVersion}` : ''}
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
