'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ApiError,
  createExpertCampeonato,
  fetchExpertCampeonatos,
  fetchExpertDeportes,
  updateExpertCampeonato,
} from '@/lib/api';
import type { ExpertCatalogItem } from '@/lib/types';

export function AnalisisExpertosCampeonatosView() {
  const queryClient = useQueryClient();
  const [filterDeporte, setFilterDeporte] = useState('');
  const [nombre, setNombre] = useState('');
  const [idDeporte, setIdDeporte] = useState('');
  const [editing, setEditing] = useState<ExpertCatalogItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deportesQuery = useQuery({
    queryKey: ['expert-deportes'],
    queryFn: fetchExpertDeportes,
  });
  const query = useQuery({
    queryKey: ['expert-campeonatos', filterDeporte],
    queryFn: () => fetchExpertCampeonatos(filterDeporte || undefined),
  });

  const deporteMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of deportesQuery.data?.data || []) map.set(d.id, d.nombre);
    return map;
  }, [deportesQuery.data?.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateExpertCampeonato(editing.id, {
          nombre,
          idDeporte: idDeporte || editing.idDeporte,
        });
      }
      return createExpertCampeonato({ nombre, idDeporte });
    },
    onSuccess: async () => {
      setNombre('');
      setIdDeporte('');
      setEditing(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['expert-campeonatos'] });
      await queryClient.invalidateQueries({ queryKey: ['expert-catalogos'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Campeonatos</h1>
        <p className="mt-1 text-sm text-slate-500">Competiciones asociadas a cada deporte.</p>
      </header>

      <div className="mb-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-400">Filtrar por deporte</span>
          <select
            className="rounded-lg border border-white/10 bg-[#111827] px-3 py-2"
            value={filterDeporte}
            onChange={(e) => setFilterDeporte(e.target.value)}
          >
            <option value="">Todos</option>
            {(deportesQuery.data?.data || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-slate-400">Nombre</span>
          <input
            className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-400">Deporte</span>
          <select
            className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2"
            value={idDeporte}
            onChange={(e) => setIdDeporte(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {(deportesQuery.data?.data || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending || !nombre.trim() || !idDeporte}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {editing ? 'Actualizar' : 'Crear'}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setNombre('');
                setIdDeporte('');
              }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <ul className="divide-y divide-white/5">
          {(query.data?.data || []).map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03]"
            >
              <div>
                <div className="text-slate-200">{item.nombre}</div>
                <div className="text-xs text-slate-500">
                  {deporteMap.get(item.idDeporte || '') || item.idDeporte || '—'}
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                onClick={() => {
                  setEditing(item);
                  setNombre(item.nombre);
                  setIdDeporte(item.idDeporte || '');
                }}
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
