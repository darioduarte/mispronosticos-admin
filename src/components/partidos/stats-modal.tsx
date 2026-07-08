'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  fetchPartidoH2H,
  fetchPartidoStatistics,
  fetchPartidoStatisticsFlb,
  fetchPartidoFlbCandidates,
  savePartidoFlbMapping,
  deletePartidoFlbMapping,
  syncPartidoStats,
  syncPartidoH2HStats,
} from '@/lib/api';
import type { FlbCandidateRow, FlbCandidatesResponse, FlbMappingRow, H2HMatchRow } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
  onSynced?: () => void;
  initialTab?: Tab;
};

type Tab = 'bd' | 'flb' | 'h2h';

function formatSyncMessage(result: {
  message?: string;
  statisticsSource?: string;
  statsSource?: string;
  statisticsPersisted?: boolean;
}) {
  if (result.message) return result.message;
  const src = result.statisticsSource || result.statsSource;
  if (src === 'flb') return 'Sincronizado desde Live-Football-Data (FLB)';
  if (src === 'api-football') return 'Stats vía API-Football (fallback FLB)';
  if (result.statisticsPersisted) return 'Sincronizado';
  return 'Sin estadísticas disponibles';
}

export function PartidoStatsModal({ fixtureId, matchLabel, onClose, onSynced, initialTab = 'bd' }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [flbLinkBusy, setFlbLinkBusy] = useState<string | null>(null);
  const [flbLinkMsg, setFlbLinkMsg] = useState('');
  const [h2hSyncBusy, setH2hSyncBusy] = useState<number | 'bulk' | null>(null);
  const [h2hSyncMsg, setH2hSyncMsg] = useState('');

  const bdQuery = useQuery({
    queryKey: ['partido-stats', fixtureId],
    queryFn: () => fetchPartidoStatistics(fixtureId),
    enabled: tab === 'bd',
  });

  const flbQuery = useQuery({
    queryKey: ['partido-stats-flb', fixtureId],
    queryFn: () => fetchPartidoStatisticsFlb(fixtureId),
    enabled: tab === 'flb',
  });

  const flbCandidatesQuery = useQuery({
    queryKey: ['partido-flb-candidates', fixtureId],
    queryFn: () => fetchPartidoFlbCandidates(fixtureId),
    enabled: tab === 'flb',
  });

  const h2hQuery = useQuery({
    queryKey: ['partido-h2h', fixtureId],
    queryFn: () => fetchPartidoH2H(fixtureId),
  });

  async function handleSync() {
    setSyncBusy(true);
    setSyncMsg('');
    try {
      const result = await syncPartidoStats(fixtureId);
      if (!result.success) {
        setSyncMsg(result.error || result.message || 'Error al sincronizar');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['partido-stats', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partido-stats-flb', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partido-flb-candidates', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partido-h2h', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      setSyncMsg(formatSyncMessage(result));
      onSynced?.();
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleFlbLink(candidate: FlbCandidateRow) {
    if (!candidate.eventId) return;
    setFlbLinkBusy(candidate.eventId);
    setFlbLinkMsg('');
    try {
      const result = await savePartidoFlbMapping(fixtureId, {
        flbEventId: candidate.eventId,
        homeFlbName: candidate.home,
        awayFlbName: candidate.away,
      });
      if (!result.success) {
        setFlbLinkMsg(result.error || 'No se pudo guardar la vinculación');
        return;
      }
      setFlbLinkMsg(`Vinculado a eventId ${candidate.eventId}. Sincronizando stats…`);
      await queryClient.invalidateQueries({ queryKey: ['partido-flb-candidates', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partido-stats-flb', fixtureId] });
      const syncResult = await syncPartidoStats(fixtureId);
      if (syncResult.success) {
        setFlbLinkMsg(formatSyncMessage(syncResult));
        await queryClient.invalidateQueries({ queryKey: ['partido-stats', fixtureId] });
        onSynced?.();
      } else {
        setFlbLinkMsg(syncResult.error || syncResult.message || 'Vinculado; error al sincronizar stats');
      }
    } catch (e) {
      setFlbLinkMsg((e as Error).message);
    } finally {
      setFlbLinkBusy(null);
    }
  }

  async function handleFlbUnlink() {
    setFlbLinkBusy('unlink');
    setFlbLinkMsg('');
    try {
      const result = await deletePartidoFlbMapping(fixtureId);
      if (!result.success) {
        setFlbLinkMsg(result.error || 'No se pudo eliminar la vinculación');
        return;
      }
      setFlbLinkMsg(result.message || 'Vinculación eliminada');
      await queryClient.invalidateQueries({ queryKey: ['partido-flb-candidates', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partido-stats-flb', fixtureId] });
    } catch (e) {
      setFlbLinkMsg((e as Error).message);
    } finally {
      setFlbLinkBusy(null);
    }
  }

  async function handleH2HSync(targetIds?: number[]) {
    setH2hSyncBusy(targetIds?.length === 1 ? targetIds[0] : 'bulk');
    setH2hSyncMsg('');
    try {
      const result = await syncPartidoH2HStats(fixtureId, targetIds);
      if (!result.success) {
        setH2hSyncMsg(result.error || 'Error al sincronizar H2H');
        return;
      }
      queryClient.setQueryData(['partido-h2h', fixtureId], result.h2h);
      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      setH2hSyncMsg(
        `H2H (FLB): ${result.syncedOk}/${result.requested} sincronizado(s)${
          result.syncedFailed ? ` · ${result.syncedFailed} fallo(s)` : ''
        }`,
      );
      onSynced?.();
    } catch (e) {
      setH2hSyncMsg((e as Error).message);
    } finally {
      setH2hSyncBusy(null);
    }
  }

  const h2hData = h2hQuery.data;
  const h2hWithoutStats = h2hData?.summary.withoutStats ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl border border-white/10 bg-[#151b24] shadow-2xl sm:max-h-[90vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-white sm:text-lg">Estadísticas del partido</h2>
              <p className="mt-1 truncate text-sm text-slate-400">{matchLabel}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <TabBtn active={tab === 'bd'} onClick={() => setTab('bd')}>
                  Base de datos
                </TabBtn>
                <TabBtn active={tab === 'flb'} onClick={() => setTab('flb')}>
                  FLB / vincular
                </TabBtn>
                <TabBtn active={tab === 'h2h'} onClick={() => setTab('h2h')}>
                  H2H
                  {h2hWithoutStats > 0 && tab !== 'h2h' && (
                    <span className="ml-1 rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-200">
                      {h2hWithoutStats} sin stats
                    </span>
                  )}
                </TabBtn>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === 'bd' && (
            <>
              {bdQuery.isLoading && (
                <p className="text-sm text-slate-400">Cargando estadísticas…</p>
              )}
              {bdQuery.isError && (
                <p className="text-sm text-red-300">{(bdQuery.error as Error).message}</p>
              )}
              {bdQuery.data && (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                    <StatChip label="Estado" value={bdQuery.data.marcador?.estado ?? '—'} />
                    <StatChip label="Marcador" value={bdQuery.data.marcador?.marcadorFinal ?? '—'} />
                    <StatChip label="Descanso" value={bdQuery.data.marcador?.marcadorDescanso ?? '—'} />
                    <StatChip label="Árbitro" value={bdQuery.data.fixturereferee ?? '—'} />
                  </div>
                  <p className="mb-2 text-xs text-slate-500">
                    Fuente: BD (nombres canónicos API-Football) · Fixture {bdQuery.data.fixtureId}
                  </p>
                  {bdQuery.data.rows.length === 0 ? (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-center text-sm text-amber-200/80">
                      Sin estadísticas en BD. Usa «Sincronizar stats (FLB)» o revisa H2H.
                    </p>
                  ) : (
                    <StatsTable
                      home={bdQuery.data.homeTeam}
                      away={bdQuery.data.awayTeam}
                      rows={bdQuery.data.rows}
                    />
                  )}
                </>
              )}
            </>
          )}

          {tab === 'h2h' && (
            <>
              {h2hQuery.isLoading && (
                <p className="text-sm text-slate-400">Cargando historial H2H…</p>
              )}
              {h2hQuery.isError && (
                <p className="text-sm text-red-300">{(h2hQuery.error as Error).message}</p>
              )}
              {h2hData && (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#0b0f14] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-300">
                      <span className="font-medium text-slate-100">
                        {h2hData.summary.withStats}/{h2hData.summary.total}
                      </span>{' '}
                      partidos H2H con stats en BD (FLB)
                      {h2hData.summary.withoutStats > 0 && (
                        <span className="block text-xs text-amber-300 sm:inline sm:ml-2">
                          · {h2hData.summary.withoutStats} sin estadísticas
                        </span>
                      )}
                    </div>
                    {h2hData.summary.withoutStats > 0 && (
                      <button
                        type="button"
                        disabled={h2hSyncBusy !== null}
                        onClick={() => handleH2HSync()}
                        className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50 sm:w-auto sm:text-sm"
                      >
                        {h2hSyncBusy === 'bulk'
                          ? 'Sincronizando H2H…'
                          : `Sincronizar ${h2hData.summary.withoutStats} (FLB)`}
                      </button>
                    )}
                  </div>

                  {h2hSyncMsg && (
                    <p
                      className={`text-xs ${
                        h2hSyncMsg.includes('fallo') && !h2hSyncMsg.includes('0/')
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {h2hSyncMsg}
                    </p>
                  )}

                  <H2HSection
                    title="Enfrentamientos directos"
                    subtitle={`${h2hData.homeTeam} vs ${h2hData.awayTeam}`}
                    rows={h2hData.betweenMatches}
                    syncBusyId={h2hSyncBusy}
                    onSyncOne={(id) => handleH2HSync([id])}
                  />
                  <H2HSection
                    title={`Últimos 5 · ${h2hData.homeTeam}`}
                    rows={h2hData.homeLast5}
                    syncBusyId={h2hSyncBusy}
                    onSyncOne={(id) => handleH2HSync([id])}
                  />
                  <H2HSection
                    title={`Últimos 5 · ${h2hData.awayTeam}`}
                    rows={h2hData.awayLast5}
                    syncBusyId={h2hSyncBusy}
                    onSyncOne={(id) => handleH2HSync([id])}
                  />
                </div>
              )}
            </>
          )}

          {tab === 'flb' && (
            <>
              {(flbQuery.isLoading || flbCandidatesQuery.isLoading) && (
                <p className="text-sm text-slate-400">Consultando Live-Football-Data…</p>
              )}
              {flbQuery.isError && (
                <p className="text-sm text-red-300">{(flbQuery.error as Error).message}</p>
              )}
              {flbCandidatesQuery.data && (
                <FlbLinkingPanel
                  data={flbCandidatesQuery.data}
                  mapping={flbQuery.data?.mapping || flbCandidatesQuery.data.mapping}
                  eventId={flbQuery.data?.eventId}
                  linkBusy={flbLinkBusy}
                  linkMsg={flbLinkMsg}
                  onLink={handleFlbLink}
                  onUnlink={handleFlbUnlink}
                />
              )}
              {flbQuery.data && (
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <p className="text-xs text-slate-500">
                    Respuesta FLB y bloque mapeado a nombres API-Football (lo que se guarda en BD).
                    {flbQuery.data.eventId != null && (
                      <span className="ml-1 text-slate-400">eventId: {flbQuery.data.eventId}</span>
                    )}
                  </p>
                  {flbQuery.data.error && !flbQuery.data.eventId && (
                    <p className="text-sm text-amber-300">{flbQuery.data.error}</p>
                  )}
                  <ApiBlock title="Mapeado (canonical)" data={flbQuery.data.mapped} />
                  <ApiBlock title="FLB crudo" data={flbQuery.data.flbRaw} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <div className="min-h-[1.25rem] text-xs text-slate-500">
            {syncMsg && (
              <span className={syncMsg.startsWith('Sin') ? 'text-amber-300' : 'text-emerald-400'}>
                {syncMsg}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncBusy}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 sm:w-auto"
            >
              {syncBusy ? 'Sincronizando…' : 'Sincronizar stats (FLB)'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 sm:w-auto"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function H2HSection({
  title,
  subtitle,
  rows,
  syncBusyId,
  onSyncOne,
}: {
  title: string;
  subtitle?: string;
  rows: H2HMatchRow[];
  syncBusyId: number | 'bulk' | null;
  onSyncOne: (fixtureId: number) => void;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 rounded-lg border border-white/5 px-3 py-4 text-center text-xs text-slate-500">
          Sin partidos en BD para este bloque.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <H2HMatchCard
              key={row.fixtureid}
              row={row}
              syncing={syncBusyId === row.fixtureid || syncBusyId === 'bulk'}
              onSync={() => onSyncOne(row.fixtureid)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function H2HMatchCard({
  row,
  syncing,
  onSync,
}: {
  row: H2HMatchRow;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0c1017] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">
            {row.local} <span className="text-slate-600">vs</span> {row.visitante}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {row.fechaDisplay} · ID {row.fixtureid} · {row.liga}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-300">{row.marcador}</span>
            <EstadoPill estado={row.estado} badgeClass={row.estadoBadgeClass} />
            {row.tieneEstadisticas ? (
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                Stats OK
              </span>
            ) : (
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                Sin stats
              </span>
            )}
          </div>
        </div>
        {!row.tieneEstadisticas && (
          <button
            type="button"
            disabled={syncing}
            onClick={onSync}
            className="w-full shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 sm:w-auto"
          >
            {syncing ? '…' : 'Sync FLB'}
          </button>
        )}
      </div>
    </div>
  );
}

function EstadoPill({
  estado,
  badgeClass,
}: {
  estado: string;
  badgeClass: H2HMatchRow['estadoBadgeClass'];
}) {
  const styles = {
    ns: 'bg-slate-500/20 text-slate-300',
    ft: 'bg-emerald-500/20 text-emerald-300',
    live: 'bg-amber-500/20 text-amber-300',
    other: 'bg-indigo-500/20 text-indigo-300',
  }[badgeClass];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles}`}>{estado}</span>
  );
}

function StatsTable({
  home,
  away,
  rows,
}: {
  home: string;
  away: string;
  rows: { tipo: string; local: string; visitante: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[280px] text-sm">
        <thead className="bg-[#0c1017] text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">Métrica</th>
            <th className="px-3 py-2 text-left">{home}</th>
            <th className="px-3 py-2 text-left">{away}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.tipo} className="border-t border-white/5">
              <td className="px-3 py-2 text-slate-300">{r.tipo}</td>
              <td className="px-3 py-2 text-slate-400">{r.local}</td>
              <td className="px-3 py-2 text-slate-400">{r.visitante}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function failureReasonLabel(code?: string | null) {
  const map: Record<string, string> = {
    flb_disabled: 'FLB desactivado en el servidor',
    flb_fetch_failed: 'Error al consultar partidos en FLB',
    missing_fixture_date: 'Sin fecha de partido en BD',
    no_flb_matches_for_date: 'FLB no devolvió partidos para esa fecha',
    not_found: 'Ningún candidato por nombre de equipos',
    ambiguous: 'Varios candidatos con score similar (elige manualmente)',
  };
  return (code && map[code]) || code || null;
}

function FlbLinkingPanel({
  data,
  mapping,
  eventId,
  linkBusy,
  linkMsg,
  onLink,
  onUnlink,
}: {
  data: FlbCandidatesResponse;
  mapping?: FlbMappingRow | null;
  eventId?: string | null;
  linkBusy: string | null;
  linkMsg: string;
  onLink: (c: FlbCandidateRow) => void;
  onUnlink: () => void;
}) {
  const activeMapping = mapping?.flbEventId || eventId || null;
  const candidates = data.candidates?.length ? data.candidates : [];
  const dayMatches = data.dayMatches || [];
  const showDayMatches = dayMatches.length > 0;
  const reason = failureReasonLabel(data.failureReason);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-[#0b0f14] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-sm text-slate-300">
            <p className="font-medium text-slate-100">Vinculación FLB</p>
            <p className="mt-1 text-xs text-slate-500">
              API-Football: {data.fixture?.homeTeam} vs {data.fixture?.awayTeam}
            </p>
            {data.fixture?.primaryDate && (
              <p className="text-xs text-slate-400">
                Fecha consultada en FLB:{' '}
                <span className="font-medium text-slate-300">
                  {data.flbQueryDate || data.fixture.primaryDate}
                </span>
                <span className="text-slate-500"> (1 petición GET /matches-by-date)</span>
              </p>
            )}
            <p className="text-xs text-slate-500">
              Partidos devueltos por FLB: {data.flbMatchCount ?? 0}
            </p>
            {activeMapping && (
              <p className="mt-2 text-xs text-emerald-300">
                Vinculado: eventId {activeMapping}
                {mapping?.source && (
                  <span className="ml-1 text-slate-500">({mapping.source})</span>
                )}
                {mapping?.homeFlbName && mapping?.awayFlbName && (
                  <span className="block text-slate-400">
                    {mapping.homeFlbName} vs {mapping.awayFlbName}
                  </span>
                )}
              </p>
            )}
            {reason && !activeMapping && (
              <p className="mt-2 text-xs text-amber-300">Auto-match: {reason}</p>
            )}
            {data.fetchError && (
              <p className="mt-1 text-xs text-red-300">{data.fetchError}</p>
            )}
          </div>
          {activeMapping && (
            <button
              type="button"
              disabled={linkBusy !== null}
              onClick={onUnlink}
              className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              {linkBusy === 'unlink' ? 'Eliminando…' : 'Quitar vínculo'}
            </button>
          )}
        </div>
        {linkMsg && (
          <p
            className={`mt-2 text-xs ${
              linkMsg.includes('error') || linkMsg.includes('No se')
                ? 'text-amber-300'
                : 'text-emerald-400'
            }`}
          >
            {linkMsg}
          </p>
        )}
      </div>

      {candidates.length > 0 && (
        <FlbCandidateList
          title="Candidatos por nombre (mejor score)"
          rows={candidates}
          activeEventId={activeMapping}
          linkBusy={linkBusy}
          onLink={onLink}
        />
      )}

      {showDayMatches && (
        <FlbCandidateList
          title={
            candidates.length
              ? 'Todos los partidos FLB del día (vinculación manual)'
              : 'Partidos FLB del día'
          }
          rows={dayMatches}
          activeEventId={activeMapping}
          linkBusy={linkBusy}
          onLink={onLink}
          collapsed={candidates.length > 0 && dayMatches.length > 12}
        />
      )}

      {!showDayMatches && !data.flbEnabled && (
        <p className="text-sm text-amber-300">FLB no está habilitado en el servidor.</p>
      )}
      {!showDayMatches && data.flbEnabled && !data.fetchError && data.flbQueryDate && (
        <p className="text-sm text-amber-300">
          FLB no devolvió partidos para {data.flbQueryDate}. Puede estar fuera de cobertura o la
          cuota de la API estar agotada.
        </p>
      )}
      {!showDayMatches && data.flbEnabled && !data.fetchError && !data.flbQueryDate && (
        <p className="text-sm text-amber-300">Sin fecha de partido en BD para consultar FLB.</p>
      )}
    </div>
  );
}

function FlbCandidateList({
  title,
  rows,
  activeEventId,
  linkBusy,
  onLink,
  collapsed = false,
}: {
  title: string;
  rows: FlbCandidateRow[];
  activeEventId: string | null;
  linkBusy: string | null;
  onLink: (c: FlbCandidateRow) => void;
  collapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  const visible = expanded ? rows : rows.slice(0, 8);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {collapsed && rows.length > 8 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-indigo-300 hover:text-indigo-200"
          >
            {expanded ? 'Ver menos' : `Ver todos (${rows.length})`}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {visible.map((row) => {
          const isActive = row.eventId != null && row.eventId === activeEventId;
          const busy = row.eventId != null && linkBusy === row.eventId;
          return (
            <div
              key={row.eventId || `${row.home}-${row.away}`}
              className={`flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
                isActive
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-white/10 bg-[#0b0f14]'
              }`}
            >
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-100">
                  {row.home} vs {row.away}
                </p>
                <p className="text-xs text-slate-500">
                  eventId {row.eventId ?? '—'}
                  {row.score > 0 && <span className="ml-2">score {row.score}</span>}
                  {(row.homeScore != null || row.awayScore != null) && (
                    <span className="ml-2">
                      {row.homeScore ?? '?'}–{row.awayScore ?? '?'}
                    </span>
                  )}
                  {row.ongoing && <span className="ml-2 text-amber-300">en vivo</span>}
                </p>
              </div>
              <button
                type="button"
                disabled={!row.eventId || busy || isActive || linkBusy !== null}
                onClick={() => onLink(row)}
                className="w-full shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 sm:w-auto"
              >
                {isActive ? 'Vinculado' : busy ? 'Vinculando…' : 'Vincular'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApiBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-200">{title}</h3>
      <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-[11px] leading-relaxed text-slate-300">
        {JSON.stringify(data, null, 2)}
      </pre>
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
      className={`rounded-lg px-3 py-1 text-xs font-medium ${
        active
          ? 'bg-indigo-600 text-white'
          : 'border border-white/10 text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}
