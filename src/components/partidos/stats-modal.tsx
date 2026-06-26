'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  fetchPartidoStatistics,
  fetchPartidoStatisticsApi,
  syncPartidoFromApi,
} from '@/lib/api';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
  onSynced?: () => void;
};

type Tab = 'bd' | 'api';

export function PartidoStatsModal({ fixtureId, matchLabel, onClose, onSynced }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('bd');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const bdQuery = useQuery({
    queryKey: ['partido-stats', fixtureId],
    queryFn: () => fetchPartidoStatistics(fixtureId),
    enabled: tab === 'bd',
  });

  const apiQuery = useQuery({
    queryKey: ['partido-stats-api', fixtureId],
    queryFn: () => fetchPartidoStatisticsApi(fixtureId),
    enabled: tab === 'api',
  });

  async function handleSync() {
    setSyncBusy(true);
    setSyncMsg('');
    try {
      const result = await syncPartidoFromApi(fixtureId);
      if (!result.success) {
        setSyncMsg(result.error || 'Error al sincronizar');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['partido-stats', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partido-stats-api', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partidos'] });
      setSyncMsg('Sincronizado desde API-Football');
      onSynced?.();
    } catch (e) {
      setSyncMsg((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Estadísticas del partido</h2>
              <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
              <div className="mt-3 flex gap-2">
                <TabBtn active={tab === 'bd'} onClick={() => setTab('bd')}>
                  Base de datos
                </TabBtn>
                <TabBtn active={tab === 'api'} onClick={() => setTab('api')}>
                  API crudo
                </TabBtn>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-160px)] overflow-y-auto p-5">
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
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatChip label="Estado" value={bdQuery.data.marcador?.estado ?? '—'} />
                    <StatChip label="Marcador" value={bdQuery.data.marcador?.marcadorFinal ?? '—'} />
                    <StatChip label="Descanso" value={bdQuery.data.marcador?.marcadorDescanso ?? '—'} />
                    <StatChip label="Árbitro" value={bdQuery.data.fixturereferee ?? '—'} />
                  </div>
                  <p className="mb-2 text-xs text-slate-500">
                    Fuente: BD · Fixture {bdQuery.data.fixtureId}
                  </p>
                  {bdQuery.data.rows.length === 0 ? (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-center text-sm text-amber-200/80">
                      Sin estadísticas en BD. Usa «Sincronizar desde API» para traerlas.
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

          {tab === 'api' && (
            <>
              {apiQuery.isLoading && (
                <p className="text-sm text-slate-400">Consultando API-Football…</p>
              )}
              {apiQuery.isError && (
                <p className="text-sm text-red-300">{(apiQuery.error as Error).message}</p>
              )}
              {apiQuery.data && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Respuesta directa de API-Football (sin transformar). Útil para depurar sync.
                  </p>
                  <ApiBlock title="Fixture (v3/fixtures)" data={apiQuery.data.fixtureApi} />
                  {apiQuery.data.statisticsApiError ? (
                    <p className="text-sm text-amber-300">
                      Estadísticas API: {apiQuery.data.statisticsApiError}
                    </p>
                  ) : (
                    <ApiBlock title="Estadísticas (v3/fixtures/statistics)" data={apiQuery.data.statisticsApi} />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <div className="text-xs text-slate-500">
            {syncMsg && (
              <span className={syncMsg.startsWith('Sincronizado') ? 'text-emerald-400' : 'text-red-300'}>
                {syncMsg}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncBusy}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {syncBusy ? 'Sincronizando…' : 'Sincronizar desde API'}
            </button>
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
    </div>
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
      <table className="w-full text-sm">
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
