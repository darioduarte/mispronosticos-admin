'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, createExpertEstado, fetchExpertEstados } from '@/lib/api';

export function AnalisisExpertosEstadosView() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['expert-estados'],
    queryFn: fetchExpertEstados,
  });

  const saveMutation = useMutation({
    mutationFn: () => createExpertEstado({ nombre }),
    onSuccess: async () => {
      setNombre('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['expert-estados'] });
      await queryClient.invalidateQueries({ queryKey: ['expert-catalogos'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear');
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Estados de pronóstico</h1>
        <p className="mt-1 text-sm text-slate-500">
          Estados internos (pendiente, ganado, perdido, etc.).
        </p>
      </header>

      <form
        className="mb-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <label className="min-w-[240px] flex-1 text-sm">
          <span className="mb-1 block text-slate-400">Nuevo estado</span>
          <input
            className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Pendiente"
          />
        </label>
        <button
          type="submit"
          disabled={saveMutation.isPending || !nombre.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Crear
        </button>
      </form>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <ul className="divide-y divide-white/5">
          {(query.data?.data || []).map((item) => (
            <li key={item.id} className="px-4 py-3 text-slate-200">
              {item.nombre}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
