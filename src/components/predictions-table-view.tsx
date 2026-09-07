'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchPredictionsTable } from '@/lib/api';
import { todayBogota } from '@/lib/dates';
import type { PredictionsTableRow } from '@/lib/types';

function resultClass(row: PredictionsTableRow): string {
  if (row.result?.isCorrect === true) return 'text-emerald-400';
  if (row.result?.isCorrect === false) return 'text-rose-400';
  return 'text-slate-400';
}

export function PredictionsTableView() {
  const [date, setDate] = useState(todayBogota);
  const [applied, setApplied] = useState(todayBogota);
  const [q, setQ] = useState('');

  const query = useQuery({
    queryKey: ['predictions-table', applied],
    queryFn: () => fetchPredictionsTable(applied),
  });

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter((r) => {
      const blob = [
        r.homeTeam,
        r.awayTeam,
        r.league,
        r.country,
        r.prediction?.winner,
        r.prediction?.advice,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(term);
    });
  }, [query.data, q]);

  const legacyHtml =
    typeof process.env.NEXT_PUBLIC_API_BASE_URL === 'string'
      ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/admin/html/predictionsTableHTML/${applied}`
      : null;

  return (
    <div className="space-y-6 p-6 text-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tabla de predicciones</h1>
          <p className="mt-1 text-sm text-slate-400">
            Revisión admin (API JSON). Cuando esta pantalla cubra el uso diario, se retira el HBS
            legacy.
          </p>
        </div>
        {legacyHtml ? (
          <a
            href={legacyHtml}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-indigo-400 hover:underline"
          >
            Abrir HBS legacy
          </a>
        ) : null}
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(date);
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-slate-400">
          Buscar
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Equipo, liga, consejo…"
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Cargar
        </button>
      </form>

      {query.isLoading ? (
        <p className="text-slate-400">Cargando…</p>
      ) : query.isError ? (
        <p className="text-rose-400">
          {(query.error as Error)?.message || 'Error al cargar predicciones'}
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            {applied}: {rows.length} filas
            {query.data?.total != null && rows.length !== query.data.total
              ? ` (filtradas de ${query.data.total})`
              : null}
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Partido</th>
                  <th className="px-3 py-2">Liga</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Marcador</th>
                  <th className="px-3 py-2">Predicción</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.fixtureid} className="border-t border-slate-800/80">
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {row.homeTeam} vs {row.awayTeam}
                      </div>
                      <div className="text-xs text-slate-500">{row.fixtureid}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {[row.country, row.league].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2">{row.status || '—'}</td>
                    <td className="px-3 py-2">{row.result?.score || '—'}</td>
                    <td className="max-w-xs px-3 py-2 text-slate-300">
                      <div>{row.prediction?.winner || '—'}</div>
                      {row.prediction?.advice ? (
                        <div className="line-clamp-2 text-xs text-slate-500">
                          {row.prediction.advice}
                        </div>
                      ) : null}
                    </td>
                    <td className={`px-3 py-2 ${resultClass(row)}`}>
                      {row.result?.message || 'Pendiente'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {row.prediction?.type || '—'}
                      {row.prediction?.hasAI ? ' · AI' : ''}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      Sin predicciones para esta fecha
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
