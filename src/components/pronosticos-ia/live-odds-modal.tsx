'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchLiveOdds } from '@/lib/api';

type Tab = 'prompt' | 'oddsLive' | 'oddsLiveBets';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

export function LiveOddsModal({ fixtureId, matchLabel, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('prompt');

  const query = useQuery({
    queryKey: ['live-odds', fixtureId],
    queryFn: () => fetchLiveOdds(fixtureId),
  });

  const data = query.data;
  const minuteLabel = data?.minute != null ? `${data.minute}'` : '—';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Cuotas en vivo</h2>
            <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
            {data && (
              <p className="mt-1 text-xs text-slate-500">
                Fixture {data.fixtureId} · minuto {minuteLabel}
                {data.hasOdds ? (
                  <span className="ml-2 text-emerald-400">con cuotas</span>
                ) : (
                  <span className="ml-2 text-amber-400">sin cuotas en API</span>
                )}
              </p>
            )}
            {data?.marketsSummary && (
              <p className="mt-1 flex flex-wrap gap-2 text-[10px]">
                <span className={data.marketsSummary.liveShots ? 'text-emerald-400' : 'text-amber-400'}>
                  Remates en vivo: {data.marketsSummary.liveShots ? 'sí' : 'no'}
                </span>
                <span className={data.marketsSummary.liveFouls ? 'text-emerald-400' : 'text-amber-400'}>
                  Faltas en vivo: {data.marketsSummary.liveFouls ? 'sí' : 'no'}
                </span>
                {data.marketsSummary.preMatchFouls && (
                  <span className="text-indigo-300">+ faltas pre-partido</span>
                )}
                {data.marketsSummary.preMatchRemates && (
                  <span className="text-indigo-300">+ remates pre-partido</span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/10 px-4 pt-2">
          {(
            [
              ['prompt', 'Bloque prompt'],
              ['oddsLive', 'JSON /odds/live'],
              ['oddsLiveBets', 'JSON /odds/live/bets'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-t-lg px-3 py-2 text-xs font-medium ${
                tab === id
                  ? 'bg-[#0b0f14] text-indigo-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {query.isLoading && <p className="text-sm text-slate-400">Consultando API-Football…</p>}
          {query.isError && (
            <p className="text-sm text-red-300">{(query.error as Error).message}</p>
          )}
          {data?.success === false && (
            <p className="text-sm text-red-300">{data.error || 'Error al cargar cuotas'}</p>
          )}

          {data?.success && tab === 'prompt' && (
            <textarea
              readOnly
              value={data.oddsBlock || 'Sin bloque de cuotas para este partido.'}
              className="h-[min(60vh,480px)] w-full resize-none rounded-lg border border-white/10 bg-[#0b0f14] p-3 font-mono text-xs text-slate-200"
            />
          )}

          {data?.success && tab === 'oddsLive' && (
            <pre className="overflow-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
              {JSON.stringify(data.apiFootball?.oddsLive ?? {}, null, 2)}
            </pre>
          )}

          {data?.success && tab === 'oddsLiveBets' && (
            <pre className="overflow-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
              {JSON.stringify(data.apiFootball?.oddsLiveBets ?? {}, null, 2)}
            </pre>
          )}
        </div>

        {data?.success && data.oddsBlock && (
          <div className="border-t border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(data.oddsBlock || '')}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              Copiar bloque prompt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
