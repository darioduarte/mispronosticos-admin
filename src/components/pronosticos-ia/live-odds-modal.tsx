'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchLiveOdds } from '@/lib/api';

type Tab =
  | 'prompt'
  | 'melbetPrompt'
  | 'melbetObject'
  | 'oddsLive'
  | 'oddsLiveBets';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

const TAB_LABELS: Record<Tab, string> = {
  prompt: 'Prompt API-F',
  melbetPrompt: 'Prompt Melbet',
  melbetObject: 'Objeto Melbet',
  oddsLive: 'JSON /odds/live',
  oddsLiveBets: 'JSON /odds/live/bets',
};

export function LiveOddsModal({ fixtureId, matchLabel, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('prompt');
  const [copiedTab, setCopiedTab] = useState<Tab | null>(null);

  const query = useQuery({
    queryKey: ['live-odds', fixtureId],
    queryFn: () => fetchLiveOdds(fixtureId),
  });

  const data = query.data;
  const minuteLabel = data?.minute != null ? `${data.minute}'` : '—';

  function getTabText(target: Tab): string {
    if (!data?.success) return '';
    if (target === 'prompt') {
      return data.oddsBlock || 'Sin bloque de cuotas API-Football para este partido.';
    }
    if (target === 'melbetPrompt') {
      return data.melbetOddsBlock || data.melbet?.oddsBlock || 'Sin bloque Melbet.';
    }
    if (target === 'melbetObject') {
      return JSON.stringify(
        {
          matched: data.melbet?.matched ?? false,
          hasOdds: data.melbet?.hasOdds ?? false,
          melbetSportEventId: data.melbet?.melbetSportEventId ?? null,
          opponent1: data.melbet?.opponent1 ?? null,
          opponent2: data.melbet?.opponent2 ?? null,
          oddsStructured: data.melbet?.oddsStructured ?? null,
          odds: data.melbet?.odds ?? null,
          reason: data.melbet?.reason ?? null,
          conclusion: data.melbet?.conclusion ?? null,
          debugMarketSummary: data.melbet?.debugMarketSummary ?? null,
          error: data.melbet?.error ?? null,
        },
        null,
        2,
      );
    }
    if (target === 'oddsLive') {
      return JSON.stringify(data.apiFootball?.oddsLive ?? {}, null, 2);
    }
    return JSON.stringify(data.apiFootball?.oddsLiveBets ?? {}, null, 2);
  }

  async function copyTab(target: Tab) {
    const text = getTabText(target);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(target);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch {
      /* ignore */
    }
  }

  const tabs = (
    [
      ['prompt', TAB_LABELS.prompt],
      ['melbetPrompt', TAB_LABELS.melbetPrompt],
      ['melbetObject', TAB_LABELS.melbetObject],
      ['oddsLive', TAB_LABELS.oddsLive],
      ['oddsLiveBets', TAB_LABELS.oddsLiveBets],
    ] as const
  );

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
                  <span className="ml-2 text-emerald-400">API-F con cuotas</span>
                ) : (
                  <span className="ml-2 text-amber-400">API-F sin cuotas</span>
                )}
                {data.hasMelbetOdds ? (
                  <span className="ml-2 text-emerald-400">Melbet con cuotas</span>
                ) : (
                  <span className="ml-2 text-amber-400">Melbet sin cuotas</span>
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
                <span className={data.marketsSummary.liveCards ? 'text-emerald-400' : 'text-amber-400'}>
                  Tarjetas en vivo: {data.marketsSummary.liveCards ? 'sí' : 'no'}
                </span>
              </p>
            )}
            {data?.melbet?.matched && (
              <p className="mt-1 text-[10px] text-slate-500">
                Melbet: {data.melbet.opponent1 || '?'} vs {data.melbet.opponent2 || '?'}
                {data.melbet.melbetSportEventId != null
                  ? ` · id ${data.melbet.melbetSportEventId}`
                  : ''}
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

        <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 pt-2">
          {tabs.map(([id, label]) => (
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

        {data?.success && (
          <div className="flex flex-wrap gap-2 border-b border-white/10 bg-[#0b0f14]/50 px-4 py-2">
            {tabs.map(([id]) => (
              <button
                key={id}
                type="button"
                onClick={() => copyTab(id)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                  copiedTab === id
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : tab === id
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
                      : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {copiedTab === id ? 'Copiado ✓' : `Copiar ${TAB_LABELS[id]}`}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {query.isLoading && (
            <p className="text-sm text-slate-400">Consultando API-Football y Melbet…</p>
          )}
          {query.isError && (
            <p className="text-sm text-red-300">{(query.error as Error).message}</p>
          )}
          {data?.success === false && (
            <p className="text-sm text-red-300">{data.error || 'Error al cargar cuotas'}</p>
          )}

          {data?.success && (tab === 'prompt' || tab === 'melbetPrompt') && (
            <textarea
              readOnly
              value={getTabText(tab)}
              className="h-[min(60vh,480px)] w-full resize-none rounded-lg border border-white/10 bg-[#0b0f14] p-3 font-mono text-xs text-slate-200"
            />
          )}

          {data?.success &&
            (tab === 'melbetObject' || tab === 'oddsLive' || tab === 'oddsLiveBets') && (
              <pre className="overflow-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
                {getTabText(tab)}
              </pre>
            )}
        </div>
      </div>
    </div>
  );
}
