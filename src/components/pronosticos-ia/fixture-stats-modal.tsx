'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchFixtureStatistics, fetchMelbetStatistics, syncPartidoStats } from '@/lib/api';

type Props = {
  fixtureId: number | null;
  matchLabel: string;
  onClose: () => void;
};

type Tab = 'bd' | 'melbet';

export function FixtureStatsModal({ fixtureId, matchLabel, onClose }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('bd');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const bdQuery = useQuery({
    queryKey: ['fixture-stats', fixtureId],
    queryFn: () => fetchFixtureStatistics(fixtureId!),
    enabled: fixtureId != null && tab === 'bd',
  });

  const melbetQuery = useQuery({
    queryKey: ['melbet-stats-modal', fixtureId],
    queryFn: () => fetchMelbetStatistics(fixtureId!),
    enabled: fixtureId != null && tab === 'melbet',
  });

  async function handleSync() {
    if (fixtureId == null) return;
    setSyncBusy(true);
    setSyncMsg('');
    try {
      const result = await syncPartidoStats(fixtureId);
      if (!result.success) {
        setSyncMsg(result.error || 'Error al sincronizar');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['fixture-stats', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partido-stats', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      const src = result.statisticsSource || result.statsSource;
      setSyncMsg(
        src === 'flb'
          ? 'Sincronizado desde Live-Football-Data (FLB)'
          : result.message || 'Sincronizado',
      );
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }

  if (fixtureId == null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="fixture-stats-title"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="fixture-stats-title" className="text-lg font-semibold text-white">
              Estadísticas del partido
            </h2>
            <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
            <div className="mt-3 flex gap-2">
              <TabBtn active={tab === 'bd'} onClick={() => setTab('bd')}>
                BD
              </TabBtn>
              <TabBtn active={tab === 'melbet'} onClick={() => setTab('melbet')}>
                Melbet
              </TabBtn>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(85vh-120px)] overflow-y-auto p-5">
          {tab === 'bd' && (
            <>
              {bdQuery.isLoading && <p className="text-sm text-slate-400">Cargando estadísticas…</p>}
              {bdQuery.isError && (
                <p className="text-sm text-red-300">{(bdQuery.error as Error).message}</p>
              )}
              {bdQuery.data && (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatChip label="Estado" value={bdQuery.data.marcador?.estado ?? '—'} />
                    <StatChip label="Marcador" value={bdQuery.data.marcador?.marcadorFinal ?? '—'} />
                    <StatChip label="Descanso" value={bdQuery.data.marcador?.marcadorDescanso ?? '—'} />
                    <StatChip label="Árbitro" value={bdQuery.data.fixturereferee ?? '—'} />
                  </div>
                  <p className="mb-2 text-xs text-slate-500">
                    Fuente: BD ({bdQuery.data.dataSource ?? 'database'}) · Fixture {bdQuery.data.fixtureId}
                  </p>
                  {bdQuery.data.rows.length === 0 ? (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-center text-sm text-amber-200/80">
                      Sin estadísticas en BD. Usa «Sincronizar stats (FLB)» abajo.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-white/10">
                      <table className="w-full text-sm">
                        <thead className="bg-[#0c1017] text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-3 py-2 text-left">Métrica</th>
                            <th className="px-3 py-2 text-left">{bdQuery.data.homeTeam}</th>
                            <th className="px-3 py-2 text-left">{bdQuery.data.awayTeam}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bdQuery.data.rows.map((r) => (
                            <tr key={r.tipo} className="border-t border-white/5">
                              <td className="px-3 py-2 text-slate-300">{r.tipo}</td>
                              <td className="px-3 py-2 text-slate-400">{r.local}</td>
                              <td className="px-3 py-2 text-slate-400">{r.visitante}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'melbet' && (
            <>
              {melbetQuery.isLoading && (
                <p className="text-sm text-slate-400">Cargando estadísticas Melbet…</p>
              )}
              {melbetQuery.isError && (
                <p className="text-sm text-red-300">{(melbetQuery.error as Error).message}</p>
              )}
              {melbetQuery.data && (
                <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
                  {JSON.stringify(melbetQuery.data, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <div className="min-h-[1.25rem] text-xs text-slate-500">
            {syncMsg && (
              <span className={syncMsg.startsWith('Sincronizado') ? 'text-emerald-400' : 'text-red-300'}>
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
      <p className="mt-0.5 text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}
