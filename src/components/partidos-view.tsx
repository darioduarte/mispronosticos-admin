'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PartidoStatsModal } from '@/components/partidos/stats-modal';
import { PromediosModal } from '@/components/partidos/promedios-modal';
import { RefereeModal } from '@/components/partidos/referee-modal';
import {
  SyncRangeProgressModal,
  type SyncRangeProgressState,
} from '@/components/partidos/sync-range-progress';
import { LiveOddsModal } from '@/components/pronosticos-ia/live-odds-modal';
import {
  fetchPartidos,
  fetchSyncStatsPlan,
  repairPartidosReferees,
  syncPartidoStats,
} from '@/lib/api';
import {
  DEFAULT_PARTIDOS_FILTERS,
  filterPartidosRows,
  sortPartidosRows,
  type PartidosClientFilters,
  type PartidosSortMode,
} from '@/lib/partidos-filters';
import type { PartidoRow } from '@/lib/types';

function defaultDesde() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function defaultHasta() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

type RowModal = {
  fixtureId: number;
  label: string;
  referee: string;
};

export function PartidosView() {
  const queryClient = useQueryClient();
  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(defaultHasta);
  const [sinArbitro, setSinArbitro] = useState(false);
  const [sinStats, setSinStats] = useState(false);
  const [applied, setApplied] = useState({
    desde: defaultDesde(),
    hasta: defaultHasta(),
    sinArbitro: false,
    sinStats: false,
  });
  const [filters, setFilters] = useState<PartidosClientFilters>(DEFAULT_PARTIDOS_FILTERS);
  const [sortMode, setSortMode] = useState<PartidosSortMode>('fecha_asc');
  const [syncOnlyMissing, setSyncOnlyMissing] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncProgress, setSyncProgress] = useState<SyncRangeProgressState | null>(null);
  const syncCancelRef = useRef(false);
  const [syncRowId, setSyncRowId] = useState<number | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairMsg, setRepairMsg] = useState('');
  const [statsModal, setStatsModal] = useState<Omit<RowModal, 'referee'> | null>(null);
  const [promediosModal, setPromediosModal] = useState<Omit<RowModal, 'referee'> | null>(null);
  const [refereeModal, setRefereeModal] = useState<RowModal | null>(null);
  const [liveOddsModal, setLiveOddsModal] = useState<Omit<RowModal, 'referee'> | null>(null);

  const query = useQuery({
    queryKey: ['partidos', applied],
    queryFn: () =>
      fetchPartidos({
        desde: applied.desde,
        hasta: applied.hasta,
        sinArbitro: applied.sinArbitro,
        sinStats: applied.sinStats,
      }),
  });

  const filtered = useMemo(() => {
    const rows = query.data?.data ?? [];
    const f = filterPartidosRows(rows, filters);
    return sortPartidosRows(f, sortMode);
  }, [query.data?.data, filters, sortMode]);

  const meta = query.data?.meta;
  const allRows = query.data?.data ?? [];

  const quickCounts = useMemo(() => {
    let live = 0;
    let ft = 0;
    let ns = 0;
    let sinArb = 0;
    let sinSt = 0;
    for (const r of allRows) {
      const e = String(r.estado).toUpperCase();
      if (['1H', '2H', 'HT', 'ET', 'LIVE', 'P', 'BT'].includes(e)) live++;
      else if (['FT', 'AET', 'PEN'].includes(e)) ft++;
      else if (e === 'NS' || e === 'TBD') ns++;
      if (r.sinArbitro) sinArb++;
      if (!r.tieneEstadisticas) sinSt++;
    }
    return { live, ft, ns, sinArb, sinSt };
  }, [allRows]);

  function applyServerFilters() {
    setApplied({ desde, hasta, sinArbitro, sinStats });
  }

  function patchFilter(patch: Partial<PartidosClientFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function handleSyncRange() {
    if (
      !confirm(
        `¿Sincronizar estadísticas (FLB) de ligas destacadas del ${applied.desde} al ${applied.hasta}? Se procesará partido por partido con barra de progreso.`,
      )
    ) {
      return;
    }
    setSyncBusy(true);
    setSyncMsg('');
    syncCancelRef.current = false;
    setSyncProgress({
      phase: 'planning',
      total: 0,
      current: 0,
      ok: 0,
      failed: 0,
      currentFixture: null,
      recentLog: [],
    });

    try {
      const plan = await fetchSyncStatsPlan({
        desde: applied.desde,
        hasta: applied.hasta,
        onlyMissing: syncOnlyMissing,
      });
      if (!plan.success) {
        setSyncMsg(plan.error || 'No se pudo planificar la sincronización');
        setSyncProgress(null);
        return;
      }

      const fixtures = plan.fixtures ?? [];
      if (!fixtures.length) {
        setSyncMsg('No hay partidos pendientes de sincronizar en ese rango.');
        setSyncProgress(null);
        return;
      }

      setSyncProgress({
        phase: 'syncing',
        total: fixtures.length,
        current: 0,
        ok: 0,
        failed: 0,
        currentFixture: fixtures[0] ?? null,
        recentLog: [`Plan: ${fixtures.length} partido(s) en ${plan.days ?? 0} día(s)`],
      });

      let ok = 0;
      let failed = 0;
      const recentLog: string[] = [`Plan: ${fixtures.length} partido(s)`];

      for (let i = 0; i < fixtures.length; i += 1) {
        if (syncCancelRef.current) {
          setSyncProgress({
            phase: 'cancelled',
            total: fixtures.length,
            current: i,
            ok,
            failed,
            currentFixture: fixtures[i] ?? null,
            recentLog: recentLog.slice(-8),
          });
          setSyncMsg(`Cancelado: ${ok}/${i} sincronizado(s) antes de detener.`);
          break;
        }

        const fx = fixtures[i];
        setSyncProgress({
          phase: 'syncing',
          total: fixtures.length,
          current: i,
          ok,
          failed,
          currentFixture: fx,
          recentLog: recentLog.slice(-8),
        });

        try {
          const result = await syncPartidoStats(fx.fixtureId);
          if (result.success && result.statisticsPersisted !== false) {
            ok += 1;
            recentLog.push(`✓ ${fx.fixtureId} ${fx.homeTeam} vs ${fx.awayTeam}`);
          } else {
            failed += 1;
            recentLog.push(
              `✗ ${fx.fixtureId} ${result.error || result.message || 'sin stats'}`,
            );
          }
        } catch (e) {
          failed += 1;
          recentLog.push(`✗ ${fx.fixtureId} ${(e as Error).message}`);
        }

        setSyncProgress({
          phase: 'syncing',
          total: fixtures.length,
          current: i + 1,
          ok,
          failed,
          currentFixture: fixtures[i + 1] ?? null,
          recentLog: recentLog.slice(-8),
        });
      }

      if (!syncCancelRef.current) {
        setSyncProgress({
          phase: 'done',
          total: fixtures.length,
          current: fixtures.length,
          ok,
          failed,
          currentFixture: null,
          recentLog: recentLog.slice(-8),
        });
        setSyncMsg(
          `FLB: ${ok}/${fixtures.length} sincronizado(s)${failed ? ` · ${failed} fallo(s)` : ''}`,
        );
      }

      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
    } catch (e) {
      setSyncMsg((e as Error).message);
      setSyncProgress(null);
    } finally {
      setSyncBusy(false);
    }
  }

  function handleSyncProgressCancel() {
    if (syncProgress?.phase === 'planning' || syncProgress?.phase === 'syncing') {
      syncCancelRef.current = true;
      return;
    }
    setSyncProgress(null);
  }

  async function handleSyncOne(fixtureId: number) {
    setSyncRowId(fixtureId);
    try {
      const result = await syncPartidoStats(fixtureId);
      if (!result.success) {
        window.alert(result.error || result.message || 'Error al sincronizar');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      const src = result.statisticsSource || result.statsSource || 'flb';
      window.alert(
        result.message ||
          (src === 'flb'
            ? 'Estadísticas sincronizadas desde Live-Football-Data'
            : `Sincronizado (fuente: ${src})`),
      );
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setSyncRowId(null);
    }
  }

  async function handleRepairReferees() {
    if (
      !confirm(
        `¿Reparar árbitros faltantes del ${applied.desde} al ${applied.hasta}? (consulta API-Football por día)`,
      )
    ) {
      return;
    }
    setRepairBusy(true);
    setRepairMsg('');
    try {
      const result = await repairPartidosReferees({
        desde: applied.desde,
        hasta: applied.hasta,
      });
      if (!result.success) {
        setRepairMsg(result.error || 'Error al reparar árbitros');
      } else {
        setRepairMsg(
          `Actualizados: ${result.totalUpdated ?? 0} / ${result.totalCandidates ?? 0} candidatos (${result.daysProcessed ?? 0} días)`,
        );
        await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      }
    } catch (e) {
      setRepairMsg((e as Error).message);
    } finally {
      setRepairBusy(false);
    }
  }

  function toggleQuickFilter(patch: Partial<PartidosClientFilters>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      const key = Object.keys(patch)[0] as keyof PartidosClientFilters;
      const val = patch[key];
      if (prev[key] === val) {
        if (key === 'estado') next.estado = '';
        else if (key === 'stats') next.stats = 'all';
        else if (key === 'arbitro') next.arbitro = 'all';
      }
      return next;
    });
  }

  return (
    <div className="p-3 pb-6 sm:p-6 lg:p-8">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold text-white sm:text-2xl">Partidos</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
          Ligas destacadas · estadísticas vía{' '}
          <strong className="font-medium text-emerald-400/90">Live-Football-Data (FLB)</strong>
          {' '}con nombres canónicos en BD. Marcador y árbitro siguen en API-Football.
        </p>
      </header>

      {/* Filtros servidor */}
      <section className="mb-4 rounded-xl border border-white/10 bg-[#111827]/80 p-3 sm:p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Rango y filtros de carga
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <DateField label="Desde" value={desde} onChange={setDesde} />
          <DateField label="Hasta" value={hasta} onChange={setHasta} />
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={sinArbitro}
              onChange={(e) => setSinArbitro(e.target.checked)}
              className="rounded border-white/20"
            />
            Solo sin árbitro
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={sinStats}
              onChange={(e) => setSinStats(e.target.checked)}
              className="rounded border-white/20"
            />
            Solo sin estadísticas
          </label>
          <button
            type="button"
            onClick={applyServerFilters}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
          >
            Buscar
          </button>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs text-slate-500">
            Sincronizar estadísticas FLB del rango visible (ligas destacadas, partido a partido con
            progreso)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={syncOnlyMissing}
                onChange={(e) => setSyncOnlyMissing(e.target.checked)}
                className="rounded border-white/20"
              />
              Solo partidos sin estadísticas
            </label>
            <button
              type="button"
              onClick={handleSyncRange}
              disabled={syncBusy}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 sm:w-auto"
            >
              {syncBusy ? 'Sincronizando rango…' : 'Sincronizar rango (FLB)'}
            </button>
            <button
              type="button"
              onClick={handleRepairReferees}
              disabled={repairBusy}
              className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 sm:w-auto"
            >
              {repairBusy ? 'Reparando…' : 'Reparar árbitros'}
            </button>
            {syncMsg && <span className="text-xs text-slate-400">{syncMsg}</span>}
            {repairMsg && <span className="text-xs text-amber-300">{repairMsg}</span>}
          </div>
        </div>
      </section>

      {/* Resumen */}
      {meta && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Pill>
            Periodo: <strong>{meta.desde}</strong> → <strong>{meta.hasta}</strong>
          </Pill>
          <Pill>
            Mostrando: <strong>{filtered.length}</strong>
            {filtered.length !== meta.total && (
              <span className="text-slate-500"> / {meta.total} cargados</span>
            )}
          </Pill>
          <Pill warn>
            Sin árbitro: <strong>{meta.sinArbitroCount}</strong>
          </Pill>
          <Pill warn>
            Sin stats: <strong>{meta.sinStatsCount}</strong>
          </Pill>
          {meta.totalEnRango !== meta.total && (
            <Pill>
              En rango total: <strong>{meta.totalEnRango}</strong>
            </Pill>
          )}
        </div>
      )}

      {!query.isLoading && allRows.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <QuickChip
            active={filters.estado === 'live'}
            onClick={() => toggleQuickFilter({ estado: 'live' })}
            label={`En vivo (${quickCounts.live})`}
          />
          <QuickChip
            active={filters.estado === 'ft'}
            onClick={() => toggleQuickFilter({ estado: 'ft' })}
            label={`Finalizados (${quickCounts.ft})`}
          />
          <QuickChip
            active={filters.estado === 'ns'}
            onClick={() => toggleQuickFilter({ estado: 'ns' })}
            label={`Por jugar (${quickCounts.ns})`}
          />
          <QuickChip
            active={filters.arbitro === 'without'}
            onClick={() => toggleQuickFilter({ arbitro: 'without' })}
            label={`Sin árbitro (${quickCounts.sinArb})`}
          />
          <QuickChip
            active={filters.stats === 'without'}
            onClick={() => toggleQuickFilter({ stats: 'without' })}
            label={`Sin stats (${quickCounts.sinSt})`}
          />
        </div>
      )}

      {/* Filtros cliente */}
      <section className="mb-4 rounded-xl border border-white/10 bg-[#0c1017]/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Búsqueda y filtros en tabla
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className="col-span-full flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
            Buscar
            <input
              type="search"
              value={filters.search}
              onChange={(e) => patchFilter({ search: e.target.value })}
              placeholder="Equipo, liga, árbitro, ID…"
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <SelectFilter
            label="Liga"
            value={filters.liga}
            onChange={(v) => patchFilter({ liga: v })}
            options={[
              { value: '', label: 'Todas' },
              ...(meta?.ligas ?? []).map((l) => ({ value: l, label: l })),
            ]}
          />
          <SelectFilter
            label="País"
            value={filters.pais}
            onChange={(v) => patchFilter({ pais: v })}
            options={[
              { value: '', label: 'Todos' },
              ...(meta?.paises ?? []).map((p) => ({ value: p, label: p })),
            ]}
          />
          <SelectFilter
            label="Estado"
            value={filters.estado}
            onChange={(v) => patchFilter({ estado: v })}
            options={[
              { value: '', label: 'Todos' },
              { value: 'ns', label: 'Por jugar' },
              { value: 'live', label: 'En vivo' },
              { value: 'ft', label: 'Finalizado' },
              { value: 'other', label: 'Otros' },
            ]}
          />
          <SelectFilter
            label="Stats BD"
            value={filters.stats}
            onChange={(v) => patchFilter({ stats: v as PartidosClientFilters['stats'] })}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'with', label: 'Con stats' },
              { value: 'without', label: 'Sin stats' },
            ]}
          />
          <SelectFilter
            label="Árbitro"
            value={filters.arbitro}
            onChange={(v) => patchFilter({ arbitro: v as PartidosClientFilters['arbitro'] })}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'with', label: 'Asignado' },
              { value: 'without', label: 'Sin asignar' },
            ]}
          />
          <SelectFilter
            label="Orden"
            value={sortMode}
            onChange={(v) => setSortMode(v as PartidosSortMode)}
            options={[
              { value: 'fecha_asc', label: 'Fecha ↑' },
              { value: 'fecha_desc', label: 'Fecha ↓' },
              { value: 'partido_asc', label: 'Partido A-Z' },
              { value: 'liga_asc', label: 'Liga A-Z' },
              { value: 'estado_asc', label: 'Estado' },
            ]}
          />
        </div>
        {(filters.search ||
          filters.liga ||
          filters.pais ||
          filters.estado ||
          filters.stats !== 'all' ||
          filters.arbitro !== 'all') && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_PARTIDOS_FILTERS)}
            className="mt-3 text-xs text-indigo-400 hover:underline"
          >
            Limpiar filtros de tabla
          </button>
        )}
      </section>

      {query.isLoading && (
        <p className="py-12 text-center text-slate-500">Cargando partidos…</p>
      )}
      {query.isError && (
        <p className="py-8 text-center text-red-300">{(query.error as Error).message}</p>
      )}

      {!query.isLoading && !query.isError && (
        <>
          {/* Vista móvil: tarjetas */}
          <div className="space-y-3 md:hidden">
            {filtered.map((row) => (
              <PartidoMobileCard
                key={row.fixtureid}
                row={row}
                dateRange={applied}
                onStats={() =>
                  setStatsModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                  })
                }
                onPromedios={() =>
                  setPromediosModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                  })
                }
                onReferee={() =>
                  setRefereeModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                    referee: row.fixturereferee,
                  })
                }
                onLiveOdds={() =>
                  setLiveOddsModal({
                    fixtureId: row.fixtureid,
                    label: matchLabel(row),
                  })
                }
                showLiveOdds={row.estadoBadgeClass === 'live'}
                onSyncFlb={() => handleSyncOne(row.fixtureid)}
                syncBusy={syncRowId === row.fixtureid}
              />
            ))}
            {filtered.length === 0 && (
              <p className="rounded-xl border border-white/10 px-4 py-10 text-center text-slate-500">
                Sin partidos para los filtros seleccionados.
              </p>
            )}
          </div>

          {/* Vista desktop: tabla */}
          <div className="hidden overflow-x-auto rounded-xl border border-white/10 md:block">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-[#0c1017] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-3 text-left">ID</th>
                  <th className="px-3 py-3 text-left">Fecha</th>
                  <th className="px-3 py-3 text-left">Partido</th>
                  <th className="px-3 py-3 text-left">Liga</th>
                  <th className="px-3 py-3 text-left">Marcador</th>
                  <th className="px-3 py-3 text-left">Estado</th>
                  <th className="px-3 py-3 text-left">Árbitro</th>
                  <th className="px-3 py-3 text-left">Stats</th>
                  <th className="px-3 py-3 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <PartidoTableRow
                    key={row.fixtureid}
                    row={row}
                    dateRange={applied}
                    onStats={() =>
                      setStatsModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                      })
                    }
                    onPromedios={() =>
                      setPromediosModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                      })
                    }
                    onReferee={() =>
                      setRefereeModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                        referee: row.fixturereferee,
                      })
                    }
                    onLiveOdds={() =>
                      setLiveOddsModal({
                        fixtureId: row.fixtureid,
                        label: matchLabel(row),
                      })
                    }
                    showLiveOdds={row.estadoBadgeClass === 'live'}
                    onSyncFlb={() => handleSyncOne(row.fixtureid)}
                    syncBusy={syncRowId === row.fixtureid}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      Sin partidos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {statsModal && (
        <PartidoStatsModal
          fixtureId={statsModal.fixtureId}
          matchLabel={statsModal.label}
          onClose={() => setStatsModal(null)}
          onSynced={() => queryClient.invalidateQueries({ queryKey: ['partidos'] })}
        />
      )}
      {promediosModal && (
        <PromediosModal
          fixtureId={promediosModal.fixtureId}
          matchLabel={promediosModal.label}
          onClose={() => setPromediosModal(null)}
        />
      )}
      {refereeModal && (
        <RefereeModal
          fixtureId={refereeModal.fixtureId}
          matchLabel={refereeModal.label}
          currentReferee={refereeModal.referee}
          onClose={() => setRefereeModal(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['partidos'] })}
        />
      )}
      {liveOddsModal && (
        <LiveOddsModal
          fixtureId={liveOddsModal.fixtureId}
          matchLabel={liveOddsModal.label}
          onClose={() => setLiveOddsModal(null)}
        />
      )}
      {syncProgress && (
        <SyncRangeProgressModal
          progress={syncProgress}
          desde={applied.desde}
          hasta={applied.hasta}
          onlyMissing={syncOnlyMissing}
          onCancel={handleSyncProgressCancel}
        />
      )}
    </div>
  );
}

function matchLabel(row: PartidoRow) {
  return `${row.local} vs ${row.visitante}`;
}

function PartidoMobileCard({
  row,
  dateRange,
  onStats,
  onPromedios,
  onReferee,
  onLiveOdds,
  onSyncFlb,
  syncBusy,
  showLiveOdds,
}: {
  row: PartidoRow;
  dateRange: { desde: string; hasta: string };
  onStats: () => void;
  onPromedios: () => void;
  onReferee: () => void;
  onLiveOdds: () => void;
  onSyncFlb: () => void;
  syncBusy?: boolean;
  showLiveOdds?: boolean;
}) {
  const iaHref = `/pronosticos-ia?search=${row.fixtureid}&desde=${dateRange.desde}&hasta=${dateRange.hasta}`;

  return (
    <article className="rounded-xl border border-white/10 bg-[#111827] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug text-slate-100">
            {row.local} <span className="text-slate-600">vs</span> {row.visitante}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {row.fechaDisplay} · ID {row.fixtureid}
          </p>
        </div>
        <EstadoBadge estado={row.estado} badgeClass={row.estadoBadgeClass} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MobileField label="Marcador" value={row.marcador} />
        <MobileField
          label="Stats"
          value={
            row.tieneEstadisticas ? (
              <span className="text-emerald-300">Sí</span>
            ) : (
              <span className="text-red-300">No</span>
            )
          }
        />
        <MobileField label="Liga" value={row.liga} className="col-span-2" />
        <MobileField
          label="Árbitro"
          value={row.sinArbitro ? 'Sin asignar' : row.fixturereferee}
          className="col-span-2"
          valueClassName={row.sinArbitro ? 'text-red-300' : 'text-slate-300'}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
        <ActionBtn label={syncBusy ? '…' : 'Sync FLB'} onClick={onSyncFlb} disabled={syncBusy} />
        <ActionBtn label="Stats" onClick={onStats} />
        <ActionBtn label="Promedios" onClick={onPromedios} />
        <ActionBtn label="Árbitro" onClick={onReferee} />
        {showLiveOdds && <ActionBtn label="Cuotas live" onClick={onLiveOdds} />}
        <Link
          href={iaHref}
          className="rounded border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:border-violet-500/40 hover:text-violet-300"
        >
          IA
        </Link>
      </div>
    </article>
  );
}

function MobileField({
  label,
  value,
  className = '',
  valueClassName = 'text-slate-300',
}: {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`mt-0.5 truncate ${valueClassName}`}>{value}</p>
    </div>
  );
}

function PartidoTableRow({
  row,
  dateRange,
  onStats,
  onPromedios,
  onReferee,
  onLiveOdds,
  onSyncFlb,
  syncBusy,
  showLiveOdds,
}: {
  row: PartidoRow;
  dateRange: { desde: string; hasta: string };
  onStats: () => void;
  onPromedios: () => void;
  onReferee: () => void;
  onLiveOdds: () => void;
  onSyncFlb: () => void;
  syncBusy?: boolean;
  showLiveOdds?: boolean;
}) {
  const iaHref = `/pronosticos-ia?search=${row.fixtureid}&desde=${dateRange.desde}&hasta=${dateRange.hasta}`;

  return (
    <tr className="border-b border-white/5 align-top hover:bg-indigo-500/5">
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">
        {row.fixtureid}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-400">{row.fechaDisplay}</td>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-200">
          {row.local} <span className="text-slate-600">vs</span> {row.visitante}
        </div>
      </td>
      <td className="max-w-[140px] px-3 py-2 text-slate-400">
        <div className="truncate">{row.liga}</div>
        {row.pais && <div className="truncate text-xs text-slate-600">{row.pais}</div>}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-200">{row.marcador}</td>
      <td className="px-3 py-2">
        <EstadoBadge estado={row.estado} badgeClass={row.estadoBadgeClass} />
      </td>
      <td
        className={`max-w-[160px] px-3 py-2 text-sm ${
          row.sinArbitro ? 'text-red-300' : 'text-slate-300'
        }`}
      >
        {row.sinArbitro ? 'Sin asignar' : row.fixturereferee}
      </td>
      <td className="px-3 py-2">
        {row.tieneEstadisticas ? (
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
            Sí
          </span>
        ) : (
          <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
            No
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <ActionBtn label={syncBusy ? '…' : 'Sync FLB'} onClick={onSyncFlb} disabled={syncBusy} />
          <ActionBtn label="Stats" onClick={onStats} />
          <ActionBtn label="Promedios" onClick={onPromedios} />
          <ActionBtn label="Árbitro" onClick={onReferee} />
          {showLiveOdds && <ActionBtn label="Cuotas live" onClick={onLiveOdds} />}
          <Link
            href={iaHref}
            className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-400 hover:border-violet-500/40 hover:text-violet-300"
          >
            IA
          </Link>
        </div>
      </td>
    </tr>
  );
}

function EstadoBadge({
  estado,
  badgeClass,
}: {
  estado: string;
  badgeClass: PartidoRow['estadoBadgeClass'];
}) {
  const styles = {
    ns: 'bg-slate-500/20 text-slate-300',
    ft: 'bg-emerald-500/20 text-emerald-300',
    live: 'bg-amber-500/20 text-amber-300',
    other: 'bg-indigo-500/20 text-indigo-300',
  }[badgeClass];
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {estado}
    </span>
  );
}

function Pill({
  children,
  warn,
}: {
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs text-slate-300 ${
        warn ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-[#111827]'
      }`}
    >
      {children}
    </span>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
      />
    </label>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-2 text-sm text-slate-200"
      >
        {options.map((o) => (
          <option key={o.value || 'all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50 sm:px-2 sm:py-0.5 sm:text-[10px]"
    >
      {label}
    </button>
  );
}

function QuickChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-indigo-500/50 bg-indigo-600/25 text-indigo-200'
          : 'border-white/10 bg-[#111827] text-slate-400 hover:border-white/20 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
