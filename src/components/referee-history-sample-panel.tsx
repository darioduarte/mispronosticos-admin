'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { syncPartidoStats } from '@/lib/api';
import type { RefereeHistoryMatch } from '@/lib/types';

function formatStatCell(val: number | string | null | undefined) {
  if (val == null || val === '') return '—';
  return String(val);
}

export function parseFixtureId(id: number | string | undefined): number | null {
  const n = typeof id === 'number' ? id : parseInt(String(id ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function matchHasStats(m: RefereeHistoryMatch) {
  if (m.hasStats === true) return true;
  if (m.hasStats === false) return false;
  return m.yellowTotal != null || m.redTotal != null || m.foulsTotal != null;
}

export function matchNeedsStats(m: RefereeHistoryMatch) {
  return !matchHasStats(m);
}

type Props = {
  matches: RefereeHistoryMatch[];
  summaryLabel?: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  /** Query keys a invalidar tras sincronizar (p. ej. ['referee-history', fixtureId, name]) */
  invalidateQueryKeys?: unknown[][];
  showAliasColumn?: boolean;
};

export function RefereeHistorySamplePanel({
  matches,
  summaryLabel,
  isLoading,
  emptyMessage = 'Sin partidos finalizados previos con este nombre en BD.',
  invalidateQueryKeys = [],
  showAliasColumn = false,
}: Props) {
  const queryClient = useQueryClient();
  const [statsSyncBusy, setStatsSyncBusy] = useState<number | 'bulk' | null>(null);
  const [statsSyncMsg, setStatsSyncMsg] = useState('');

  const withoutStats = matches.filter(matchNeedsStats).length;
  const withStats = matches.length - withoutStats;

  async function handleSampleStatsSync(targetIds?: number[]) {
    const fixtureIds = targetIds?.length
      ? targetIds
      : matches
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
      for (const key of invalidateQueryKeys) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
      setStatsSyncMsg(
        `FLB: ${ok}/${fixtureIds.length} sincronizado(s)${failed ? ` · ${failed} fallo(s)` : ''}`,
      );
    } catch (e) {
      setStatsSyncMsg((e as Error).message);
    } finally {
      setStatsSyncBusy(null);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Cargando historial…</p>;
  }

  return (
    <div className="space-y-3">
      {summaryLabel ? (
        <p className="rounded-lg border border-white/10 bg-[#0c1017] px-3 py-2 text-sm text-slate-300">
          {summaryLabel}
        </p>
      ) : null}

      {matches.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#0b0f14] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-300">
              <span className="font-medium text-slate-100">
                {withStats}/{matches.length}
              </span>{' '}
              partidos con estadísticas en BD
              {withoutStats > 0 ? (
                <span className="block text-xs text-amber-300 sm:inline sm:ml-2">
                  · {withoutStats} sin estadísticas
                </span>
              ) : null}
            </div>
            <button
              type="button"
              disabled={statsSyncBusy !== null}
              onClick={() => handleSampleStatsSync()}
              className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50 sm:w-auto sm:text-sm"
            >
              {statsSyncBusy === 'bulk'
                ? 'Sincronizando muestra…'
                : withoutStats > 0
                  ? `Sincronizar ${withoutStats} sin stats (FLB)`
                  : 'Sincronizar muestra (FLB)'}
            </button>
          </div>

          {statsSyncMsg ? (
            <p
              className={`text-xs ${
                statsSyncMsg.includes('fallo') && !statsSyncMsg.startsWith('FLB: 0/')
                  ? 'text-amber-300'
                  : 'text-emerald-400'
              }`}
            >
              {statsSyncMsg}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-[#0c1017] text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-left">Partido</th>
                  {showAliasColumn ? <th className="px-2 py-2 text-left">Alias</th> : null}
                  <th className="px-2 py-2 text-center">🟨</th>
                  <th className="px-2 py-2 text-center">🟥</th>
                  <th className="px-2 py-2 text-center">Faltas</th>
                  <th className="px-2 py-2 text-center">Estadísticas</th>
                  <th className="px-2 py-2 text-right">Sync</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => {
                  const fid = parseFixtureId(m.fixtureId);
                  const hasStats = matchHasStats(m);
                  const rowSyncing =
                    statsSyncBusy === 'bulk' || (fid != null && statsSyncBusy === fid);
                  return (
                    <tr key={String(m.fixtureId ?? i)} className="border-t border-white/5">
                      <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                        {m.dateTimeDisplay || m.dateDisplay || '—'}
                      </td>
                      <td className="max-w-[240px] px-2 py-2 text-slate-300">
                        <span>
                          {m.homeTeam || '—'} vs {m.awayTeam || '—'}
                          {m.score ? <span className="text-emerald-300"> ({m.score})</span> : null}
                        </span>
                        {m.league ? (
                          <span className="mt-0.5 block text-[10px] text-slate-500">{m.league}</span>
                        ) : null}
                        {fid != null ? (
                          <span className="mt-0.5 block text-[10px] text-slate-600">ID {fid}</span>
                        ) : null}
                      </td>
                      {showAliasColumn ? (
                        <td className="px-2 py-2 text-violet-300">{m.aliasUsed || '—'}</td>
                      ) : null}
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
                        {hasStats ? (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                            Sí
                          </span>
                        ) : (
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {fid != null ? (
                          <button
                            type="button"
                            disabled={rowSyncing}
                            onClick={() => handleSampleStatsSync([fid])}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            {rowSyncing ? '…' : 'FLB'}
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
        </>
      ) : (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
}
