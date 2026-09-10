'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createExpertPronostico,
  fetchExpertCatalogos,
  fetchExpertPronostico,
  fetchExpertPronosticos,
  updateExpertPronostico,
} from '@/lib/api';
import type { ExpertPronosticoRow, ExpertPronosticoSavePayload } from '@/lib/types';

const TIPO_ANUNCIO = ['INTERSTITIAL', 'REWARDED', 'PREMIUM'];

const emptyForm: ExpertPronosticoSavePayload = {
  local: '',
  visitante: '',
  idDeporte: '',
  idCampeonato: '',
  tipoDeApuesta: '',
  explicacion: '',
  idEstadoPronostico: '',
  idTipoPronostico: '',
  fechaEvento: '',
  cuota: '',
  tipoAnuncio: 'INTERSTITIAL',
  storie: false,
  maximaConfianza: false,
  resultadoLocal: '',
  resultadoVisitante: '',
};

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value).slice(0, 16).replace(' ', 'T');
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function rowToForm(row: ExpertPronosticoRow): ExpertPronosticoSavePayload {
  return {
    local: row.local || '',
    visitante: row.visitante || '',
    idDeporte: row.idDeporte || '',
    idCampeonato: row.idCampeonato || '',
    tipoDeApuesta: row.tipoDeApuesta || '',
    explicacion: row.explicacion || '',
    idEstadoPronostico: row.idEstadoPronostico || '',
    idTipoPronostico: row.idTipoPronostico || '',
    fechaEvento: toDatetimeLocal(row.fechaEvento),
    cuota: row.cuota ?? '',
    tipoAnuncio: row.tipoAnuncio || 'INTERSTITIAL',
    storie: !!row.storie,
    maximaConfianza: !!row.maximaConfianza,
    resultadoLocal: row.resultadoLocal || '',
    resultadoVisitante: row.resultadoVisitante || '',
  };
}

export function AnalisisExpertosPronosticosView() {
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpertPronosticoSavePayload>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const listQuery = useQuery({
    queryKey: ['expert-pronosticos', fecha],
    queryFn: () => fetchExpertPronosticos(fecha || undefined),
  });

  const catalogosQuery = useQuery({
    queryKey: ['expert-catalogos'],
    queryFn: fetchExpertCatalogos,
  });

  useEffect(() => {
    const first = listQuery.data?.meta?.fecha;
    if (!fecha && first) setFecha(first);
  }, [listQuery.data?.meta?.fecha, fecha]);

  const fechas = listQuery.data?.meta?.fechas ?? [];
  const rows = listQuery.data?.data ?? [];
  const catalogos = catalogosQuery.data?.data;
  const campeonatosFiltrados = useMemo(() => {
    const all = catalogos?.campeonatos ?? [];
    if (!form.idDeporte) return all;
    return all.filter((c) => c.idDeporte === form.idDeporte);
  }, [catalogos?.campeonatos, form.idDeporte]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: ExpertPronosticoSavePayload = {
        ...form,
        fechaEvento: form.fechaEvento.replace('T', ' '),
      };
      if (editingId) return updateExpertPronostico(editingId, payload);
      return createExpertPronostico(payload);
    },
    onSuccess: async () => {
      setFormError(null);
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: ['expert-pronosticos'] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    },
  });

  async function openEdit(id: string) {
    setFormError(null);
    setEditingId(id);
    setShowForm(true);
    try {
      const res = await fetchExpertPronostico(id);
      setForm(rowToForm(res.data));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo cargar');
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      fechaEvento: fecha ? `${fecha}T18:00` : '',
    });
    setFormError(null);
    setShowForm(true);
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Pronósticos de expertos</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tipsters publicados en la app (antes gestionados desde Cuenta móvil).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Crear pronóstico
        </button>
      </header>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {fechas.map((f) => (
          <button
            key={f.date}
            type="button"
            onClick={() => setFecha(f.date)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${
              fecha === f.date
                ? 'border-teal-500/50 bg-teal-500/20 text-teal-200'
                : 'border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            {f.date}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : listQuery.isError ? (
        <p className="text-sm text-red-400">
          {(listQuery.error as Error)?.message || 'Error al cargar'}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No hay pronósticos para esta fecha.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Apuesta</th>
                <th className="px-4 py-3">Cuota</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200">
                      {row.local}
                      {row.visitante ? ` vs ${row.visitante}` : ''}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.campeonato?.nombre || '—'} · {row.fechaEventoDisplay || row.fechaEvento}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.tipoDeApuesta}</td>
                  <td className="px-4 py-3 text-slate-300">{row.cuota}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {row.estadoPronostico?.nombre || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(row.id)}
                      className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-[#151b24] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingId ? 'Editar pronóstico' : 'Crear pronóstico'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Deporte</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.idDeporte}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, idDeporte: e.target.value, idCampeonato: '' }))
                  }
                >
                  <option value="">Seleccionar</option>
                  {(catalogos?.deportes || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Campeonato</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.idCampeonato}
                  onChange={(e) => setForm((f) => ({ ...f, idCampeonato: e.target.value }))}
                >
                  <option value="">Seleccionar</option>
                  {campeonatosFiltrados.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Local</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.local}
                  onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Visitante</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.visitante || ''}
                  onChange={(e) => setForm((f) => ({ ...f, visitante: e.target.value }))}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-400">Tipo de apuesta</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.tipoDeApuesta}
                  onChange={(e) => setForm((f) => ({ ...f, tipoDeApuesta: e.target.value }))}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-400">Explicación</span>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.explicacion || ''}
                  onChange={(e) => setForm((f) => ({ ...f, explicacion: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Cuota</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={String(form.cuota ?? '')}
                  onChange={(e) => setForm((f) => ({ ...f, cuota: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Fecha evento</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.fechaEvento}
                  onChange={(e) => setForm((f) => ({ ...f, fechaEvento: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Tipo pronóstico</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.idTipoPronostico}
                  onChange={(e) => setForm((f) => ({ ...f, idTipoPronostico: e.target.value }))}
                >
                  <option value="">Seleccionar</option>
                  {(catalogos?.tiposPronostico || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Estado</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.idEstadoPronostico}
                  onChange={(e) => setForm((f) => ({ ...f, idEstadoPronostico: e.target.value }))}
                >
                  <option value="">Seleccionar</option>
                  {(catalogos?.estados || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Tipo anuncio</span>
                <select
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.tipoAnuncio || 'INTERSTITIAL'}
                  onChange={(e) => setForm((f) => ({ ...f, tipoAnuncio: e.target.value }))}
                >
                  {TIPO_ANUNCIO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Resultado local</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.resultadoLocal || ''}
                  onChange={(e) => setForm((f) => ({ ...f, resultadoLocal: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Resultado visitante</span>
                <input
                  className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2"
                  value={form.resultadoVisitante || ''}
                  onChange={(e) => setForm((f) => ({ ...f, resultadoVisitante: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={!!form.storie}
                  onChange={(e) => setForm((f) => ({ ...f, storie: e.target.checked }))}
                />
                Storie
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={!!form.maximaConfianza}
                  onChange={(e) => setForm((f) => ({ ...f, maximaConfianza: e.target.checked }))}
                />
                Máxima confianza
              </label>
            </div>

            {formError ? <p className="mt-3 text-sm text-red-400">{formError}</p> : null}

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
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
