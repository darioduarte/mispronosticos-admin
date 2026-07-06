'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchLiga, fetchLigas, patchLiga, syncLigaFromApi } from '@/lib/api';
import type { LigaPatchPayload, LigaRow, LigaSeasonRow } from '@/lib/types';

type FilterState = {
  q: string;
  country: string;
  outstanding: string;
  active: string;
  lock: string;
};

const DEFAULT_FILTERS: FilterState = {
  q: '',
  country: '',
  outstanding: '',
  active: '',
  lock: '',
};

export function LigasView() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTERS);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const listQuery = useQuery({
    queryKey: ['ligas', applied],
    queryFn: () =>
      fetchLigas({
        q: applied.q || undefined,
        country: applied.country || undefined,
        outstanding: applied.outstanding || undefined,
        active: applied.active || undefined,
        lock: applied.lock || undefined,
        limit: 200,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['liga-detail', detailId],
    queryFn: () => fetchLiga(detailId!),
    enabled: Boolean(detailId),
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  const countries = meta?.countries ?? [];

  const filteredCount = useMemo(() => rows.length, [rows]);

  async function handleToggle(row: LigaRow, field: keyof LigaPatchPayload, next: boolean) {
    setBusyId(row.id);
    setMsg('');
    try {
      const result = await patchLiga(row.id, { [field]: next });
      if (!result.success) {
        setMsg(result.error || 'No se pudo actualizar');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['ligas'] });
      if (detailId === row.id) {
        await queryClient.invalidateQueries({ queryKey: ['liga-detail', row.id] });
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSyncApi(id: string) {
    setBusyId(id);
    setMsg('');
    try {
      const result = await syncLigaFromApi(id);
      if (!result.success) {
        setMsg(result.error || 'Error al sincronizar');
        return;
      }
      setMsg(result.message || 'Liga sincronizada desde API-Football');
      await queryClient.invalidateQueries({ queryKey: ['ligas'] });
      await queryClient.invalidateQueries({ queryKey: ['liga-detail', id] });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Ligas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Activa, destaca o bloquea ligas. Los cambios se guardan en la tabla{' '}
          <code className="text-violet-300">League</code> de MySQL.
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <input
            type="search"
            placeholder="Buscar nombre, país o ID…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200 lg:col-span-2"
          />
          <select
            value={filters.country}
            onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
          >
            <option value="">Todos los países</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <FilterSelect
            label="Destacada"
            value={filters.outstanding}
            onChange={(v) => setFilters((f) => ({ ...f, outstanding: v }))}
          />
          <FilterSelect
            label="Activa"
            value={filters.active}
            onChange={(v) => setFilters((f) => ({ ...f, active: v }))}
          />
          <FilterSelect
            label="Bloqueada"
            value={filters.lock}
            onChange={(v) => setFilters((f) => ({ ...f, lock: v }))}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setApplied({ ...filters })}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Buscar
          </button>
          {msg && <span className="text-xs text-amber-300">{msg}</span>}
        </div>
      </section>

      {meta?.summary && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Pill>En BD: {meta.summary.totalInDb}</Pill>
          <Pill>Destacadas: {meta.summary.outstanding}</Pill>
          <Pill>Activas: {meta.summary.active}</Pill>
          <Pill>Bloqueadas: {meta.summary.locked}</Pill>
          <Pill>Mostrando: {filteredCount} / {meta.total}</Pill>
        </div>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Cargando ligas…</p>
      ) : listQuery.isError ? (
        <p className="text-sm text-red-300">{(listQuery.error as Error).message}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-[#0c1017] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3 text-left">Liga</th>
                <th className="px-3 py-3 text-left">País</th>
                <th className="px-3 py-3 text-center">Activa</th>
                <th className="px-3 py-3 text-center">Destacada</th>
                <th className="px-3 py-3 text-center">Confiable IA</th>
                <th className="px-3 py-3 text-center">Bloqueada</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.logo} alt="" className="h-6 w-6 object-contain" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-[10px] text-slate-500">
                          —
                        </span>
                      )}
                      <div>
                        <p className="font-medium text-slate-100">{row.name}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {row.id}
                          {row.type ? ` · ${row.type}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{row.countryName}</td>
                  <td className="px-3 py-2 text-center">
                    <Toggle
                      checked={row.active}
                      disabled={busyId === row.id}
                      onChange={(v) => handleToggle(row, 'active', v)}
                      title="active — liga visible en listados con active=1"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Toggle
                      checked={row.outstanding}
                      disabled={busyId === row.id}
                      onChange={(v) => handleToggle(row, 'outstanding', v)}
                      title="outstanding — cron, partidos destacados, promedios"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Toggle
                      checked={row.trusPrediction}
                      disabled={busyId === row.id}
                      onChange={(v) => handleToggle(row, 'trusPrediction', v)}
                      title="trusPrediction — filtros de predicciones confiables"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Toggle
                      checked={row.lock}
                      disabled={busyId === row.id}
                      onChange={(v) => handleToggle(row, 'lock', v)}
                      variant="danger"
                      title="lock — excluye la liga de consultas automáticas"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailId(row.id)}
                        className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5"
                      >
                        Temporadas
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => handleSyncApi(row.id)}
                        className="rounded border border-violet-500/30 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                      >
                        Sync API
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    Sin ligas para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <LigaDetailModal
          loading={detailQuery.isLoading}
          error={detailQuery.isError ? (detailQuery.error as Error).message : null}
          league={detailQuery.data?.league}
          onClose={() => setDetailId(null)}
        />
      )}

      <section className="mt-6 rounded-xl border border-white/5 bg-[#0c1017]/60 p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-400">Qué hace cada parámetro</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <strong className="text-slate-300">Activa</strong> — la liga aparece en listados del día
            (active = 1).
          </li>
          <li>
            <strong className="text-slate-300">Destacada</strong> — entra en crons, partidos del
            admin, promedios y sync FLB (outstanding).
          </li>
          <li>
            <strong className="text-slate-300">Confiable IA</strong> — usada en filtros de
            predicciones (trusPrediction).
          </li>
          <li>
            <strong className="text-slate-300">Bloqueada</strong> — excluida de consultas
            automáticas aunque siga en BD (lock).
          </li>
        </ul>
      </section>
    </div>
  );
}

function LigaDetailModal({
  loading,
  error,
  league,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  league?: { seasons: LigaSeasonRow[] } & LigaRow;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {league?.name || 'Temporadas'}
            </h2>
            <p className="text-sm text-slate-400">
              {league?.countryName} · ID {league?.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-5">
          {loading && <p className="text-sm text-slate-400">Cargando temporadas…</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {league?.seasons?.length ? (
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left">Año</th>
                  <th className="px-2 py-1 text-left">Inicio–Fin</th>
                  <th className="px-2 py-1 text-center">Actual</th>
                  <th className="px-2 py-1 text-center">Stats</th>
                  <th className="px-2 py-1 text-center">Standings</th>
                  <th className="px-2 py-1 text-center">Odds</th>
                </tr>
              </thead>
              <tbody>
                {league.seasons.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="px-2 py-2 font-mono text-slate-200">{s.year}</td>
                    <td className="px-2 py-2 text-slate-400">
                      {s.start || '—'} → {s.end || '—'}
                    </td>
                    <td className="px-2 py-2 text-center">{s.current ? '✓' : '—'}</td>
                    <td className="px-2 py-2 text-center">
                      {s.statisticsFixtures ? '✓' : '—'}
                    </td>
                    <td className="px-2 py-2 text-center">{s.standings ? '✓' : '—'}</td>
                    <td className="px-2 py-2 text-center">{s.odds ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !loading && <p className="text-sm text-slate-500">Sin temporadas en LeagueSeason.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  title,
  variant = 'default',
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  title?: string;
  variant?: 'default' | 'danger';
}) {
  const onClass =
    variant === 'danger'
      ? 'bg-red-600'
      : 'bg-emerald-600';
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? onClass : 'bg-slate-600'
      } disabled:opacity-50`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
    >
      <option value="">{label}: todas</option>
      <option value="1">{label}: sí</option>
      <option value="0">{label}: no</option>
    </select>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
      {children}
    </span>
  );
}
