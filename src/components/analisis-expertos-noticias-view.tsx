'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ApiError,
  createExpertNoticia,
  fetchExpertNoticias,
  updateExpertNoticia,
} from '@/lib/api';
import type { ExpertNoticiaRow } from '@/lib/types';

const empty = {
  urlImagen: '',
  autor: '',
  titulo: '',
  descripcion: '',
  fecha: '',
};

export function AnalisisExpertosNoticiasView() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<ExpertNoticiaRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const query = useQuery({
    queryKey: ['expert-noticias'],
    queryFn: () => fetchExpertNoticias({ limit: 100 }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        fecha: form.fecha ? form.fecha.replace('T', ' ') : form.fecha,
      };
      if (editing) return updateExpertNoticia(editing.id, payload);
      return createExpertNoticia(payload);
    },
    onSuccess: async () => {
      setForm(empty);
      setEditing(null);
      setShowForm(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['expert-noticias'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Noticias</h1>
          <p className="mt-1 text-sm text-slate-500">Contenido editorial de la app.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(empty);
            setShowForm(true);
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Crear noticia
        </button>
      </header>

      <div className="space-y-3">
        {(query.data?.data || []).map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-100">{item.titulo || '(Sin título)'}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {item.autor} · {item.fecha}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-400">{item.descripcion}</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300"
                onClick={() => {
                  setEditing(item);
                  setForm({
                    urlImagen: item.urlImagen || '',
                    autor: item.autor || '',
                    titulo: item.titulo || '',
                    descripcion: item.descripcion || '',
                    fecha: String(item.fecha || '').slice(0, 16).replace(' ', 'T'),
                  });
                  setShowForm(true);
                }}
              >
                Editar
              </button>
            </div>
          </article>
        ))}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-xl border border-white/10 bg-[#151b24] p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">
              {editing ? 'Editar noticia' : 'Crear noticia'}
            </h2>
            <div className="grid gap-3">
              {(
                [
                  ['urlImagen', 'URL imagen'],
                  ['autor', 'Autor'],
                  ['titulo', 'Título'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-sm">
                  <span className="mb-1 block text-slate-400">{label}</span>
                  <input
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </label>
              ))}
              <label className="text-sm">
                <span className="mb-1 block text-slate-400">Descripción</span>
                <textarea
                  className="min-h-28 w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-400">Fecha</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                />
              </label>
            </div>
            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
