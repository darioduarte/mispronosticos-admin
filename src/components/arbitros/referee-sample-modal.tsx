'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRefereeHistory } from '@/lib/api';
import type { RefereeHistoryMatch } from '@/lib/types';

type Props = {
  refereeName: string;
  fixtureCount?: number;
  onClose: () => void;
};

function formatStatCell(val: number | string | null | undefined) {
  if (val == null || val === '') return '—';
  return String(val);
}

function matchHasStats(m: RefereeHistoryMatch) {
  if (m.hasStats === true) return true;
  if (m.hasStats === false) return false;
  return m.yellowTotal != null || m.redTotal != null || m.foulsTotal != null;
}

export function RefereeSampleModal({ refereeName, fixtureCount, onClose }: Props) {
  const historyQuery = useQuery({
    queryKey: ['referee-sample', refereeName],
    queryFn: () => fetchRefereeHistory(refereeName),
    enabled: refereeName.length > 0,
  });

  const matches = historyQuery.data?.matches ?? [];
  const withStats = matches.filter((m) => matchHasStats(m)).length;

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
        aria-labelledby="referee-sample-title"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="referee-sample-title" className="text-lg font-semibold text-white">
                Muestra de partidos
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Árbitro: <strong className="text-slate-200">{refereeName}</strong>
                {fixtureCount != null ? (
                  <span className="text-slate-500"> · {fixtureCount} en BD con este nombre exacto</span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-140px)] overflow-y-auto p-5">
          {historyQuery.isLoading ? (
            <p className="text-sm text-slate-500">Cargando historial…</p>
          ) : historyQuery.isError ? (
            <p className="text-sm text-red-300">{(historyQuery.error as Error).message}</p>
          ) : (
            <>
              {historyQuery.data?.summaryLabel ? (
                <p className="mb-4 rounded-lg border border-white/10 bg-[#0c1017] px-3 py-2 text-sm text-slate-300">
                  {historyQuery.data.summaryLabel}
                </p>
              ) : null}

              {matches.length > 0 ? (
                <>
                  <p className="mb-3 text-xs text-slate-500">
                    Últimos {matches.length} partidos finalizados con este nombre en BD
                    {withStats < matches.length ? (
                      <span className="text-amber-300">
                        {' '}
                        · {matches.length - withStats} sin estadísticas de tarjetas/faltas
                      </span>
                    ) : null}
                  </p>
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
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((m, i) => {
                          const hasStats = matchHasStats(m);
                          return (
                            <tr key={String(m.fixtureId ?? i)} className="border-t border-white/5">
                              <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                                {m.dateTimeDisplay || m.dateDisplay || '—'}
                              </td>
                              <td className="max-w-[260px] px-2 py-2 text-slate-300">
                                <span>
                                  {m.homeTeam || '—'} vs {m.awayTeam || '—'}
                                  {m.score ? (
                                    <span className="text-emerald-300"> ({m.score})</span>
                                  ) : null}
                                </span>
                                {m.league ? (
                                  <span className="mt-0.5 block text-[10px] text-slate-500">{m.league}</span>
                                ) : null}
                                {m.fixtureId != null ? (
                                  <span className="mt-0.5 block text-[10px] text-slate-600">ID {m.fixtureId}</span>
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
                                {hasStats ? (
                                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                    OK
                                  </span>
                                ) : (
                                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                                    Sin stats
                                  </span>
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
                <p className="text-sm text-slate-500">
                  Sin partidos finalizados previos con este nombre exacto en BD.
                </p>
              )}
            </>
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
