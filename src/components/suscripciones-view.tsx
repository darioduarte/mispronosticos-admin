'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { SuscripcionModal } from '@/components/suscripciones/suscripcion-modal';
import { fetchSuscripcionProductos, fetchSuscripciones } from '@/lib/api';
import type { SuscripcionRow } from '@/lib/types';

const ESTADOS = [
  { value: 'todas', label: 'Todas' },
  { value: 'activa', label: 'Activas' },
  { value: 'expirada', label: 'Expiradas' },
  { value: 'cancelada', label: 'Canceladas' },
];

function StatusBadge({ row }: { row: SuscripcionRow }) {
  const colors: Record<string, string> = {
    activa: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    cancelada: 'bg-red-500/15 text-red-300 border-red-500/30',
    expirada: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    pendiente: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${colors[row.status] || 'border-white/10 text-slate-400'}`}
    >
      {row.status}
    </span>
  );
}

export function SuscripcionesView() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [app, setApp] = useState('todas');
  const [estado, setEstado] = useState('todas');
  const [applied, setApplied] = useState({
    email: '',
    search: '',
    app: 'todas',
    estado: 'todas',
  });
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: SuscripcionRow | null } | null>(
    null,
  );

  const productosQuery = useQuery({
    queryKey: ['suscripcion-productos'],
    queryFn: fetchSuscripcionProductos,
    staleTime: 60_000,
  });

  const query = useQuery({
    queryKey: ['suscripciones', applied],
    queryFn: () =>
      fetchSuscripciones({
        email: applied.email || undefined,
        search: applied.search || undefined,
        app: applied.app,
        estado: applied.estado,
        limit: 100,
      }),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const productos = productosQuery.data?.data ?? {
    android: ['premiumsemanal', 'mensual', 'semanal'],
    ios: ['mensual', 'semanal'],
  };

  const resumen = useMemo(() => {
    let ios = 0;
    let android = 0;
    for (const r of rows) {
      if (r.app === 'ios') ios++;
      else if (r.app === 'android') android++;
    }
    return { ios, android };
  }, [rows]);

  function applyFilters() {
    setApplied({
      email: email.trim().toLowerCase(),
      search: search.trim(),
      app,
      estado,
    });
  }

  function onSaved() {
    queryClient.invalidateQueries({ queryKey: ['suscripciones'] });
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Suscripciones</h1>
          <p className="mt-1 text-sm text-slate-500">
            Consulta, crea y edita suscripciones iOS/Android manualmente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create', row: null })}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + Nueva suscripción
        </button>
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
              placeholder="email, nombre, userId, token…"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Plataforma</span>
            <select
              value={app}
              onChange={(e) => setApp(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              <option value="todas">Todas</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
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
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
          Activas (página): {meta?.activas ?? 0}
        </span>
        <span className="rounded-full border border-white/10 bg-[#111827] px-3 py-1 text-slate-400">
          Android: {resumen.android}
        </span>
        <span className="rounded-full border border-white/10 bg-[#111827] px-3 py-1 text-slate-400">
          iOS: {resumen.ios}
        </span>
      </div>

      {query.isLoading && <p className="text-slate-400">Cargando suscripciones…</p>}
      {query.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Error al cargar. ¿Desplegaste el backend con `/api/admin/suscripciones`?
        </p>
      )}

      {!query.isLoading && !query.isError && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#111827] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Entorno</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#0b0f14]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Sin resultados. Prueba otro filtro o crea una suscripción manual.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{row.userEmail || '—'}</div>
                      <div className="text-xs text-slate-500">{row.userName || row.userId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.productId || '—'}
                      {row.fake && (
                        <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                          fake
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-400">{row.app || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{row.startDateDisplay || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{row.endDateDisplay || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.environment || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setModal({ mode: 'edit', row })}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-indigo-300 hover:bg-indigo-600/10"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <SuscripcionModal
        open={!!modal}
        mode={modal?.mode ?? 'create'}
        row={modal?.row ?? null}
        productos={productos}
        onClose={() => setModal(null)}
        onSaved={onSaved}
      />
    </div>
  );
}
