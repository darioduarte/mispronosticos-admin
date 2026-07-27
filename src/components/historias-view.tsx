'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ApiError,
  deleteStoriesByDate,
  deleteStory,
  fetchStories,
  fetchStory,
  generateStories,
  patchStory,
} from '@/lib/api';
import type {
  StoryGenerateType,
  StoryPatchPayload,
  StoryRow,
} from '@/lib/types';

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const TYPE_FILTERS = [
  { value: 'todas', label: 'Todas' },
  { value: 'PREDICTION_MAX_AVERAGE', label: 'Máximos' },
  { value: 'PREDICTION_MIN_AVERAGE', label: 'Mínimos' },
  { value: 'TOP_INJURIES', label: 'Bajas' },
];

const TYPE_COLORS: Record<string, string> = {
  PREDICTION_MAX_AVERAGE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  PREDICTION_MIN_AVERAGE: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  TOP_INJURIES: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

const GENERATE_LABELS: Record<StoryGenerateType, string> = {
  max: 'Máximos',
  min: 'Mínimos',
  injuries: 'Bajas',
};

type ProgressPhase = 'running' | 'done' | 'error';

type ProgressState = {
  title: string;
  phase: ProgressPhase;
  current: number;
  total: number;
  currentLabel: string;
  log: string[];
  errorMessage?: string | null;
};

function StoriesProgressModal({
  progress,
  onClose,
}: {
  progress: ProgressState;
  onClose: () => void;
}) {
  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : progress.phase === 'running'
        ? 15
        : 100;
  const busy = progress.phase === 'running';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stories-progress-title"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 id="stories-progress-title" className="text-lg font-semibold text-white">
            {progress.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {busy
              ? progress.currentLabel || 'Procesando…'
              : progress.phase === 'done'
                ? 'Proceso completado'
                : 'Hubo un error'}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
              <span>
                {busy ? 'En curso' : progress.phase === 'done' ? 'Listo' : 'Error'}
              </span>
              <span>
                {progress.total > 0
                  ? `${progress.current}/${progress.total} · ${pct}%`
                  : busy
                    ? '…'
                    : '100%'}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress.phase === 'error'
                    ? 'bg-red-500'
                    : progress.phase === 'done'
                      ? 'bg-emerald-500'
                      : 'bg-indigo-500'
                } ${busy && progress.total <= 1 ? 'animate-pulse' : ''}`}
                style={{ width: `${Math.max(pct, busy ? 8 : 0)}%` }}
              />
            </div>
          </div>

          {busy && (
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent"
                aria-hidden
              />
              <span>{progress.currentLabel || 'Espera un momento…'}</span>
            </div>
          )}

          {progress.log.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-xs text-slate-400">
              {progress.log.map((line, i) => (
                <li key={`${i}-${line}`} className="leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          )}

          {progress.errorMessage && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {progress.errorMessage}
            </p>
          )}

          {!busy && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type, label }: { type: string; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        TYPE_COLORS[type] || 'border-white/10 text-slate-400'
      }`}
    >
      {label}
    </span>
  );
}

function DetailModal({
  storyId,
  onClose,
  onChanged,
}: {
  storyId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ['story-detail', storyId],
    queryFn: () => fetchStory(storyId),
  });

  const story = detailQuery.data?.story;
  const ranking = detailQuery.data?.ranking ?? [];
  const prediction = detailQuery.data?.prediction;

  const [miniTitle, setMiniTitle] = useState('');
  const [description, setDescription] = useState('');
  const [orden, setOrden] = useState(0);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!story) return;
    setMiniTitle(story.miniTitle || '');
    setDescription(story.description || '');
    setOrden(story.orden ?? 0);
    setActive(Boolean(story.active));
  }, [story]);

  async function handleSave() {
    if (!story) return;
    setBusy(true);
    setMsg('');
    try {
      const payload: StoryPatchPayload = {
        miniTitle,
        description,
        orden,
        active,
      };
      const result = await patchStory(story.id, payload);
      if (!result.success) {
        setMsg(result.error || 'No se pudo guardar');
        return;
      }
      setMsg('Guardado');
      await queryClient.invalidateQueries({ queryKey: ['story-detail', storyId] });
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!story) return;
    if (!window.confirm(`¿Eliminar la historia "${story.miniTitle || story.id}"?`)) return;
    setBusy(true);
    setMsg('');
    try {
      const result = await deleteStory(story.id);
      if (!result.success) {
        setMsg(result.error || 'No se pudo eliminar');
        return;
      }
      onChanged();
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Detalle de historia</h2>
            {story && (
              <p className="mt-1 text-sm text-slate-400">
                {story.typeLabel} · {story.date || '—'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {detailQuery.isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
          {detailQuery.isError && (
            <p className="text-sm text-red-300">{(detailQuery.error as Error).message}</p>
          )}

          {story && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-400">Mini título</span>
                  <input
                    value={miniTitle}
                    onChange={(e) => setMiniTitle(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-400">Descripción</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-400">Orden</span>
                  <input
                    type="number"
                    value={orden}
                    onChange={(e) => setOrden(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-[#0b0f14]"
                  />
                  <span className="text-sm text-slate-300">Activa</span>
                </label>
              </div>

              {prediction && (
                <p className="text-xs text-slate-500">
                  Ranking: {prediction.title}
                  {prediction.detail ? ` — ${prediction.detail}` : ''}
                </p>
              )}

              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-300">
                  Ranking ({ranking.length})
                </h3>
                {ranking.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin filas de ranking.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-[#111827] text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Partido</th>
                          <th className="px-3 py-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {ranking.map((row, i) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                            <td className="px-3 py-2 text-slate-300">
                              {row.fixture
                                ? `${row.fixture.teamshomename || '?'} vs ${row.fixture.teamsawayname || '?'}`
                                : row.fixtureid || '—'}
                              {row.fixture?.leaguename ? (
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {row.fixture.leaguename}
                                </span>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-200">
                              {row.value != null ? row.value : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSave}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDelete}
                  className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Eliminar
                </button>
                {msg && <span className="text-xs text-amber-300">{msg}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function HistoriasView() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayBogota);
  const [type, setType] = useState('todas');
  const [applied, setApplied] = useState({ date: todayBogota(), type: 'todas' });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const listQuery = useQuery({
    queryKey: ['stories', applied.date, applied.type],
    queryFn: () => fetchStories({ date: applied.date, type: applied.type }),
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  async function invalidateList() {
    await queryClient.invalidateQueries({ queryKey: ['stories'] });
  }

  async function handleGenerate(types: StoryGenerateType[]) {
    setBusy(true);
    setMsg('');
    const labels = types.map((t) => GENERATE_LABELS[t]).join(', ');
    setProgress({
      title: `Generar historias · ${applied.date}`,
      phase: 'running',
      current: 0,
      total: types.length,
      currentLabel: `Iniciando ${labels}…`,
      log: [],
      errorMessage: null,
    });

    try {
      for (let i = 0; i < types.length; i++) {
        const t = types[i];
        const label = GENERATE_LABELS[t];
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                current: i,
                currentLabel: `Generando ${label}…`,
                log: [...prev.log, `▶ ${label}`],
              }
            : prev,
        );

        const result = await generateStories(applied.date, [t]);
        if (!result.success) {
          const err = result.error || `No se pudo generar ${label}`;
          setProgress((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'error',
                  currentLabel: `Error en ${label}`,
                  errorMessage: err,
                  log: [...prev.log, `✗ ${label}: ${err}`],
                }
              : prev,
          );
          setMsg(err);
          return;
        }

        setProgress((prev) =>
          prev
            ? {
                ...prev,
                current: i + 1,
                currentLabel: `${label} listo`,
                log: [...prev.log.slice(0, -1), `✓ ${label}`],
              }
            : prev,
        );
      }

      await invalidateList();
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              phase: 'done',
              current: prev.total,
              currentLabel: 'Todas las historias generadas',
              log: [...prev.log, 'Listo'],
            }
          : prev,
      );
      setMsg(`Historias generadas para ${applied.date}`);
    } catch (e) {
      const err = e as ApiError;
      const message = err.message || 'Error al generar';
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              phase: 'error',
              currentLabel: 'Error',
              errorMessage: message,
              log: [...prev.log, `✗ ${message}`],
            }
          : prev,
      );
      setMsg(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(row: StoryRow) {
    setBusy(true);
    setMsg('');
    try {
      const result = await patchStory(row.id, { active: !row.active });
      if (!result.success) {
        setMsg(result.error || 'No se pudo actualizar');
        return;
      }
      await invalidateList();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteOne(row: StoryRow) {
    if (!window.confirm(`¿Eliminar "${row.miniTitle || row.id}"?`)) return;
    setBusy(true);
    setMsg('');
    setProgress({
      title: 'Eliminar historia',
      phase: 'running',
      current: 0,
      total: 1,
      currentLabel: `Borrando "${row.miniTitle || row.id}"…`,
      log: [],
      errorMessage: null,
    });
    try {
      const result = await deleteStory(row.id);
      if (!result.success) {
        const err = result.error || 'No se pudo eliminar';
        setProgress((prev) =>
          prev
            ? { ...prev, phase: 'error', currentLabel: 'Error', errorMessage: err }
            : prev,
        );
        setMsg(err);
        return;
      }
      await invalidateList();
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              phase: 'done',
              current: 1,
              currentLabel: 'Historia eliminada',
              log: ['✓ Eliminada'],
            }
          : prev,
      );
    } catch (e) {
      const message = (e as Error).message;
      setProgress((prev) =>
        prev
          ? { ...prev, phase: 'error', currentLabel: 'Error', errorMessage: message }
          : prev,
      );
      setMsg(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDay() {
    const label = applied.type === 'todas' ? 'todas las historias' : `historias de tipo filtrado`;
    if (!window.confirm(`¿Eliminar ${label} del ${applied.date}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setBusy(true);
    setMsg('');
    setProgress({
      title: `Borrar historias · ${applied.date}`,
      phase: 'running',
      current: 0,
      total: 1,
      currentLabel: `Eliminando ${label}…`,
      log: [`▶ ${label} (${rows.length} en listado)`],
      errorMessage: null,
    });
    try {
      const result = await deleteStoriesByDate(applied.date, applied.type);
      if (!result.success) {
        const err = result.error || 'No se pudo eliminar';
        setProgress((prev) =>
          prev
            ? { ...prev, phase: 'error', currentLabel: 'Error', errorMessage: err }
            : prev,
        );
        setMsg(err);
        return;
      }
      setMsg(result.message || 'Eliminadas');
      await invalidateList();
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              phase: 'done',
              current: 1,
              currentLabel: result.message || 'Historias eliminadas',
              log: [...(prev.log || []), `✓ ${result.deleted ?? rows.length} eliminadas`],
            }
          : prev,
      );
    } catch (e) {
      const message = (e as Error).message;
      setProgress((prev) =>
        prev
          ? { ...prev, phase: 'error', currentLabel: 'Error', errorMessage: message }
          : prev,
      );
      setMsg(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Historias</h1>
        <p className="mt-1 text-sm text-slate-400">
          Lista, edita y regenera historias de máximos, mínimos y bajas por fecha.
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Tipo</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {TYPE_FILTERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setApplied({ date, type })}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Ver fecha
            </button>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-white/10 bg-[#111827] p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Generar / regenerar para {applied.date}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleGenerate(['max'])}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            Máximos
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleGenerate(['min'])}
            className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
          >
            Mínimos
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleGenerate(['injuries'])}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Bajas
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handleGenerate(['max', 'min', 'injuries'])}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Crear todas
          </button>
          <button
            type="button"
            disabled={busy || rows.length === 0}
            onClick={handleDeleteDay}
            className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            Borrar del día
          </button>
        </div>
        {msg && <p className="mt-3 text-xs text-amber-300">{msg}</p>}
      </section>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-[#111827] px-3 py-1 text-slate-400">
          Total: <strong className="text-slate-200">{meta?.total ?? '—'}</strong>
        </span>
        <span className="rounded-full border border-white/10 bg-[#111827] px-3 py-1 text-slate-400">
          Promedios base:{' '}
          <strong className="text-slate-200">{meta?.averagesCount ?? '—'}</strong>
        </span>
        {TYPE_FILTERS.filter((t) => t.value !== 'todas').map((t) => (
          <span
            key={t.value}
            className={`rounded-full border px-3 py-1 ${TYPE_COLORS[t.value] || 'border-white/10 text-slate-400'}`}
          >
            {t.label}: {meta?.byType?.[t.value] ?? 0}
          </span>
        ))}
      </div>

      {listQuery.isLoading && <p className="text-slate-400">Cargando historias…</p>}
      {listQuery.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {(listQuery.error as Error).message}. ¿Desplegaste el backend con{' '}
          <code>/api/admin/stories</code>?
        </p>
      )}

      {!listQuery.isLoading && !listQuery.isError && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#111827] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-center">Activa</th>
                <th className="px-4 py-3 text-center">Orden</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#0b0f14]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Sin historias para {applied.date}. Usa los botones de generar arriba.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-slate-200">{row.miniTitle || '—'}</p>
                      {row.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={row.type} label={row.typeLabel} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(row)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          row.active
                            ? 'border-emerald-500/40 text-emerald-300'
                            : 'border-slate-500/40 text-slate-500'
                        }`}
                      >
                        {row.active ? 'Sí' : 'No'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">{row.orden}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">{row.date || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailId(row.id)}
                          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteOne(row)}
                          className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <DetailModal
          storyId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={invalidateList}
        />
      )}

      {progress && (
        <StoriesProgressModal progress={progress} onClose={() => setProgress(null)} />
      )}
    </div>
  );
}
