'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchLigas, patchLiga } from '@/lib/api';
import type { LigaRow } from '@/lib/types';

/**
 * Catálogo visible de ligas con promedios por competencia (spec 123).
 * Lista las activas y permite buscar/activar otras.
 */
export function PromediosCompetenciaView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const activeQuery = useQuery({
    queryKey: ['ligas-competition-averages'],
    queryFn: () =>
      fetchLigas({
        competitionAverages: '1',
        limit: 200,
      }),
  });

  const searchQuery = useQuery({
    queryKey: ['ligas-competition-search', appliedSearch],
    queryFn: () =>
      fetchLigas({
        q: appliedSearch || undefined,
        limit: 50,
      }),
    enabled: appliedSearch.trim().length >= 1,
  });

  const activeRows = activeQuery.data?.data ?? [];
  const searchRows = searchQuery.data?.data ?? [];

  async function handleToggle(row: LigaRow, next: boolean) {
    setBusyId(row.id);
    setMsg('');
    try {
      const result = await patchLiga(row.id, { competitionAverages: next });
      if (!result.success) {
        setMsg(result.error || 'No se pudo actualizar');
        return;
      }
      setMsg(
        next
          ? `Activado: ${row.name} (${row.id})`
          : `Desactivado: ${row.name} (${row.id})`,
      );
      await queryClient.invalidateQueries({ queryKey: ['ligas-competition-averages'] });
      await queryClient.invalidateQueries({ queryKey: ['ligas-competition-search'] });
      await queryClient.invalidateQueries({ queryKey: ['ligas'] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Promedios por competencia</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ligas internacionales de clubes donde el pipeline calcula un segundo promedio solo con
          partidos de ese torneo (además del NORMAL). Seed inicial: Champions (2), Europa League
          (3), Sudamericana (11), Libertadores (13).
        </p>
      </header>

      {msg && (
        <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {msg}
        </p>
      )}

      <section className="mb-8 rounded-xl border border-white/10 bg-[#111827] p-4">
        <h2 className="text-sm font-semibold text-slate-200">Ligas activas</h2>
        <p className="mt-1 text-xs text-slate-500">
          {activeQuery.data?.meta?.summary?.competitionAverages ?? activeRows.length} con flag
          competitionAverages.
        </p>
        {activeQuery.isLoading ? (
          <p className="mt-4 text-sm text-slate-400">Cargando…</p>
        ) : activeQuery.isError ? (
          <p className="mt-4 text-sm text-red-300">{(activeQuery.error as Error).message}</p>
        ) : (
          <LeagueTable
            rows={activeRows}
            busyId={busyId}
            empty="Ninguna liga activa. Activa alguna con la búsqueda de abajo."
            onToggle={handleToggle}
          />
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
        <h2 className="text-sm font-semibold text-slate-200">Buscar y activar</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setAppliedSearch(search.trim());
            }}
            placeholder="Nombre, país o ID (ej. Champions, 848)…"
            className="min-w-[240px] flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
          />
          <button
            type="button"
            onClick={() => setAppliedSearch(search.trim())}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Buscar
          </button>
        </div>
        {appliedSearch && (
          <div className="mt-4">
            {searchQuery.isLoading ? (
              <p className="text-sm text-slate-400">Buscando…</p>
            ) : searchQuery.isError ? (
              <p className="text-sm text-red-300">{(searchQuery.error as Error).message}</p>
            ) : (
              <LeagueTable
                rows={searchRows}
                busyId={busyId}
                empty="Sin resultados."
                onToggle={handleToggle}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function LeagueTable({
  rows,
  busyId,
  empty,
  onToggle,
}: {
  rows: LigaRow[];
  busyId: string | null;
  empty: string;
  onToggle: (row: LigaRow, next: boolean) => void;
}) {
  if (!rows.length) {
    return <p className="mt-4 text-sm text-slate-500">{empty}</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-[#0c1017] text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Liga</th>
            <th className="px-3 py-2 text-left">País</th>
            <th className="px-3 py-2 text-center">Activo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-white/5">
              <td className="px-3 py-2 font-mono text-xs text-violet-300">{row.id}</td>
              <td className="px-3 py-2 text-slate-100">
                <div className="flex items-center gap-2">
                  {row.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.logo} alt="" className="h-5 w-5 object-contain" />
                  ) : null}
                  <span>
                    {row.name}
                    {row.type ? (
                      <span className="ml-1 text-xs text-slate-500">· {row.type}</span>
                    ) : null}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-slate-400">{row.countryName}</td>
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => onToggle(row, !row.competitionAverages)}
                  className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                    row.competitionAverages
                      ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {row.competitionAverages ? 'ON' : 'OFF'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
