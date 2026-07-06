'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchRefereeFromApi,
  fetchRefereeHistory,
  saveFixtureReferee,
  searchReferees,
  syncPartidoStats,
} from '@/lib/api';
import type { RefereeHistoryMatch, RefereeSearchItem } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  currentReferee: string;
  onClose: () => void;
  onSaved: () => void;
};

type Tab = 'assign' | 'review';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

function formatStatCell(val: number | string | null | undefined) {
  if (val == null || val === '') return '—';
  return String(val);
}

function parseFixtureId(id: number | string | undefined): number | null {
  const n = typeof id === 'number' ? id : parseInt(String(id ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

function matchNeedsStats(m: RefereeHistoryMatch) {
  if (m.hasStats === true) return false;
  if (m.hasStats === false) return true;
  return m.yellowTotal == null && m.redTotal == null && m.foulsTotal == null;
}

export function RefereeModal({
  fixtureId,
  matchLabel,
  currentReferee,
  onClose,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('assign');
  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [customName, setCustomName] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err' | ''>('');
  const [busy, setBusy] = useState(false);
  const [statsSyncBusy, setStatsSyncBusy] = useState<number | 'bulk' | null>(null);
  const [statsSyncMsg, setStatsSyncMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const searchQuery = useQuery({
    queryKey: ['referee-search', fixtureId, debouncedQ],
    queryFn: () => searchReferees({ q: debouncedQ, fixtureId, limit: 15 }),
    enabled: debouncedQ.length >= MIN_CHARS,
  });

  const reviewName = selectedName || customName.trim() || currentReferee;
  const historyQuery = useQuery({
    queryKey: ['referee-history', fixtureId, reviewName],
    queryFn: () => fetchRefereeHistory(reviewName, fixtureId),
    enabled: tab === 'review' && reviewName.length > 0,
  });

  const showMsg = useCallback((text: string, type: 'ok' | 'err') => {
    setMsg(text);
    setMsgType(type);
  }, []);

  async function handleFromApi() {
    setBusy(true);
    try {
      const data = await fetchRefereeFromApi(fixtureId);
      if (data.refereeFromApi) {
        setCustomName(data.refereeFromApi);
        setSelectedName('');
        showMsg(`API: ${data.refereeFromApi}`, 'ok');
      } else {
        showMsg('API-Football no devolvió árbitro para este partido', 'err');
      }
    } catch (e) {
      showMsg((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const name = (customName.trim() || selectedName).trim();
    if (!name) {
      showMsg('Escribe o selecciona un árbitro', 'err');
      return;
    }
    setBusy(true);
    try {
      await saveFixtureReferee(fixtureId, name);
      showMsg('Árbitro guardado en BD', 'ok');
      onSaved();
    } catch (e) {
      showMsg((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  function pickReferee(item: RefereeSearchItem) {
    setSelectedName(item.name);
    setCustomName('');
    showMsg(`Seleccionado: ${item.name}`, 'ok');
  }

  const sampleMatches = historyQuery.data?.matches ?? [];
  const sampleWithoutStats = sampleMatches.filter(matchNeedsStats).length;
  const sampleWithStats = sampleMatches.length - sampleWithoutStats;

  async function handleSampleStatsSync(targetIds?: number[]) {
    const fixtureIds = targetIds?.length
      ? targetIds
      : sampleMatches
          .filter(matchNeedsStats)
          .map((m) => parseFixtureId(m.fixtureId))
          .filter((id): id is number => id != null);

    if (!fixtureIds.length) return;

    setStatsSyncBusy(fixtureIds.length === 1 ? fixtureIds[0] : 'bulk');
    setStatsSyncMsg('');

    let ok = 0;
    let failed = 0;
    try {
      for (const fid of fixtureIds) {
        try {
          const result = await syncPartidoStats(fid);
          if (result.success && result.statisticsPersisted !== false) {
            ok += 1;
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }
      await queryClient.invalidateQueries({
        queryKey: ['referee-history', fixtureId, reviewName],
      });
      setStatsSyncMsg(
        `FLB: ${ok}/${fixtureIds.length} sincronizado(s)${failed ? ` · ${failed} fallo(s)` : ''}`,
      );
    } catch (e) {
      setStatsSyncMsg((e as Error).message);
    } finally {
      setStatsSyncBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Árbitro del partido</h2>
              <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <TabBtn active={tab === 'assign'} onClick={() => setTab('assign')}>
              Asignar
            </TabBtn>
            <TabBtn active={tab === 'review'} onClick={() => setTab('review')}>
              Revisar muestra
            </TabBtn>
          </div>
        </div>

        <div className="max-h-[calc(92vh-160px)] overflow-y-auto p-5">
          {tab === 'assign' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                En BD:{' '}
                <strong className={currentReferee ? 'text-white' : 'text-red-300'}>
                  {currentReferee || 'Sin asignar'}
                </strong>
              </p>

              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar árbitro (mín. 3 letras)…"
                  className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleFromApi}
                  disabled={busy}
                  className="rounded-lg border border-teal-500/40 px-3 py-2 text-sm text-teal-300 hover:bg-teal-500/10 disabled:opacity-50"
                >
                  Traer desde API
                </button>
              </div>

              {debouncedQ.length > 0 && debouncedQ.length < MIN_CHARS && (
                <p className="text-xs text-slate-500">Escribe al menos {MIN_CHARS} caracteres.</p>
              )}

              {searchQuery.isLoading && debouncedQ.length >= MIN_CHARS && (
                <p className="text-xs text-slate-500">Buscando…</p>
              )}

              {searchQuery.data?.referees && searchQuery.data.referees.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-[#0b0f14] p-2">
                  {searchQuery.data.referees.map((r) => (
                    <li key={r.name}>
                      <button
                        type="button"
                        onClick={() => pickReferee(r)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-indigo-500/10 ${
                          selectedName === r.name
                            ? 'bg-indigo-600/20 text-indigo-200'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="font-medium">{r.name}</span>
                        {r.disciplineLabel && (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {r.disciplineLabel}
                            {r.lastMatchDateDisplay && ` · último: ${r.lastMatchDateDisplay}`}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {searchQuery.data?.referees?.length === 0 && debouncedQ.length >= MIN_CHARS && !searchQuery.isLoading && (
                <p className="text-xs text-slate-500">Sin coincidencias en BD.</p>
              )}

              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => {
                    setCustomName(e.target.value);
                    setSelectedName('');
                  }}
                  placeholder="Nombre manual (si no está en la lista)"
                  className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Guardar en fixture
                </button>
              </div>

              {msg && (
                <p className={`text-sm ${msgType === 'ok' ? 'text-emerald-400' : 'text-red-300'}`}>
                  {msg}
                </p>
              )}

              <p className="text-xs text-slate-600">
                Cada resultado muestra promedios disciplinarios y fecha del último partido usado.
                En «Revisar muestra» ves el detalle partido a partido.
              </p>
            </div>
          )}

          {tab === 'review' && (
            <div className="space-y-3">
              {!reviewName ? (
                <p className="text-sm text-slate-500">
                  Selecciona o escribe un árbitro en la pestaña Asignar.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-300">
                    Muestra para: <strong className="text-white">{reviewName}</strong>
                  </p>
                  {historyQuery.isLoading && (
                    <p className="text-sm text-slate-500">Cargando historial…</p>
                  )}
                  {historyQuery.data?.summaryLabel && (
                    <p className="rounded-lg border border-white/10 bg-[#0c1017] px-3 py-2 text-sm text-slate-300">
                      {historyQuery.data.summaryLabel}
                    </p>
                  )}
                  {sampleMatches.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#0b0f14] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-300">
                        <span className="font-medium text-slate-100">
                          {sampleWithStats}/{sampleMatches.length}
                        </span>{' '}
                        partidos de la muestra con stats en BD (FLB)
                        {sampleWithoutStats > 0 && (
                          <span className="block text-xs text-amber-300 sm:inline sm:ml-2">
                            · {sampleWithoutStats} sin estadísticas
                          </span>
                        )}
                      </div>
                      {sampleWithoutStats > 0 && (
                        <button
                          type="button"
                          disabled={statsSyncBusy !== null}
                          onClick={() => handleSampleStatsSync()}
                          className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50 sm:w-auto sm:text-sm"
                        >
                          {statsSyncBusy === 'bulk'
                            ? 'Sincronizando muestra…'
                            : `Sincronizar ${sampleWithoutStats} (FLB)`}
                        </button>
                      )}
                    </div>
                  )}
                  {statsSyncMsg && (
                    <p
                      className={`text-xs ${
                        statsSyncMsg.includes('fallo') && !statsSyncMsg.startsWith('FLB: 0/')
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {statsSyncMsg}
                    </p>
                  )}
                  {historyQuery.data?.matches && historyQuery.data.matches.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-white/10">
                      <table className="w-full text-xs">
                        <thead className="bg-[#0c1017] text-slate-400">
                          <tr>
                            <th className="px-2 py-2 text-left">Fecha</th>
                            <th className="px-2 py-2 text-left">Partido</th>
                            <th className="px-2 py-2 text-center">🟨</th>
                            <th className="px-2 py-2 text-center">🟥</th>
                            <th className="px-2 py-2 text-center">Faltas</th>
                            <th className="px-2 py-2 text-center">Stats</th>
                            <th className="px-2 py-2 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyQuery.data.matches.map((m, i) => {
                            const fid = parseFixtureId(m.fixtureId);
                            const needsStats = matchNeedsStats(m);
                            const rowSyncing =
                              statsSyncBusy === 'bulk' ||
                              (fid != null && statsSyncBusy === fid);
                            return (
                              <tr key={m.fixtureId ?? i} className="border-t border-white/5">
                                <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                                  {m.dateTimeDisplay || m.dateDisplay || '—'}
                                </td>
                                <td className="max-w-[220px] px-2 py-2 text-slate-300">
                                  <span>
                                    {m.homeTeam || '—'} vs {m.awayTeam || '—'}
                                    {m.score ? (
                                      <span className="text-emerald-300"> ({m.score})</span>
                                    ) : null}
                                  </span>
                                  {m.league ? (
                                    <span className="mt-0.5 block text-[10px] text-slate-500">
                                      {m.league}
                                    </span>
                                  ) : null}
                                  {fid != null ? (
                                    <span className="mt-0.5 block text-[10px] text-slate-600">
                                      ID {fid}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-2 py-2 text-center text-slate-400">
                                  {formatStatCell(m.yellowTotal)}
                                </td>
                                <td className="px-2 py-2 text-center text-slate-400">
                                  {formatStatCell(m.redTotal)}
                                </td>
                                <td className="px-2 py-2 text-center text-slate-400">
                                  {formatStatCell(m.foulsTotal)}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  {needsStats ? (
                                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                                      Sin stats
                                    </span>
                                  ) : (
                                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                      OK
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  {needsStats && fid != null ? (
                                    <button
                                      type="button"
                                      disabled={rowSyncing}
                                      onClick={() => handleSampleStatsSync([fid])}
                                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                                    >
                                      {rowSyncing ? '…' : 'Sync FLB'}
                                    </button>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : historyQuery.isSuccess ? (
                    <p className="text-sm text-slate-500">
                      Sin partidos finalizados previos con este nombre en BD.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
        active
          ? 'bg-indigo-600 text-white'
          : 'border border-white/10 text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}
