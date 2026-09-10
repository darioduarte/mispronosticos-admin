'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ApiError,
  createExpertDeporte,
  fetchExpertDeportes,
  updateExpertDeporte,
} from '@/lib/api';
import type { ExpertCatalogItem } from '@/lib/types';

export function AnalisisExpertosDeportesView() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [editing, setEditing] = useState<ExpertCatalogItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['expert-deportes'],
    queryFn: fetchExpertDeportes,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return updateExpertDeporte(editing.id, { nombre });
      return createExpertDeporte({ nombre });
    },
    onSuccess: async () => {
      setNombre('');
      setEditing(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['expert-deportes'] });
      await queryClient.invalidateQueries({ queryKey: ['expert-catalogos'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Deportes</h1>
        <p className="mt-1 text-sm text-slate-500">Catálogo usado por los tipsters de expertos.</p>
      </header>

      <form
        className="mb-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <label className="min-w-[240px] flex-1 text-sm">
          <span className="mb-1 block text-slate-400">
            {editing ? 'Editar nombre' : 'Nuevo deporte'}
          </span>
          <input
            className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Fútbol"
          />
        </label>
        <button
          type="submit"
          disabled={saveMutation.isPending || !nombre.trim()}
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
            }}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300"
          >
            Cancelar
          </button>
        ) : null}
      </form>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <ul className="divide-y divide-white/5">
          {(query.data?.data || []).map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03]"
            >
              <span className="text-slate-200">{item.nombre}</span>
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300"
                onClick={() => {
                  setEditing(item);
                  setNombre(item.nombre);
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
