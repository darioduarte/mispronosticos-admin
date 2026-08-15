'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { OddsSections } from '@/components/pronosticos-ia/odds-referencia-modal';
import { fetchPrematchOdds } from '@/lib/api';
import type { MelbetOddItem, MelbetOddsStructured } from '@/lib/types';

type Tab =
  | 'refUi'
  | 'refPrompt'
  | 'melbetUi'
  | 'melbetPrompt'
  | 'melbetObject';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

const TAB_LABELS: Record<Tab, string> = {
  refUi: 'Cuotas API-F',
  refPrompt: 'Prompt API-F',
  melbetUi: 'Cuotas Melbet',
  melbetPrompt: 'Prompt Melbet',
  melbetObject: 'Objeto Melbet',
};

const MELBET_SECTION_LABELS: Record<string, string> = {
  ganador_directo: 'Ganador directo',
  doble_oportunidad: 'Doble oportunidad',
  total_goles: 'Total goles',
  corners: 'Corners',
  tiros: 'Tiros',
  faltas: 'Faltas',
  tarjetas: 'Tarjetas',
  ambos_marcan: 'Ambos marcan',
  handicap: 'Handicap',
  otros: 'Otros',
};

export function PrematchOddsModal({ fixtureId, matchLabel, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('refUi');
  const [copiedTab, setCopiedTab] = useState<Tab | null>(null);

  const query = useQuery({
    queryKey: ['prematch-odds', fixtureId],
    queryFn: () => fetchPrematchOdds(fixtureId),
  });

  const data = query.data;

  function getCopyText(target: Tab): string {
    if (!data?.success) return '';
    if (target === 'refPrompt') {
      return data.oddsBlock || 'Sin bloque de cuotas de referencia.';
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
          link: data.melbet?.link ?? null,
          error: data.melbet?.error ?? null,
        },
        null,
        2,
      );
    }
    if (target === 'refUi') {
      return JSON.stringify(data.odds ?? {}, null, 2);
    }
    return JSON.stringify(data.melbet?.oddsStructured ?? {}, null, 2);
  }

  async function copyTab(target: Tab) {
    const text = getCopyText(target);
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
      ['refUi', TAB_LABELS.refUi],
      ['refPrompt', TAB_LABELS.refPrompt],
      ['melbetUi', TAB_LABELS.melbetUi],
      ['melbetPrompt', TAB_LABELS.melbetPrompt],
      ['melbetObject', TAB_LABELS.melbetObject],
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
            <h2 className="text-lg font-semibold text-white">Cuotas prepartido</h2>
            <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
            {data?.success && (
              <p className="mt-1 text-xs text-slate-500">
                Fixture {data.fixtureId}
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
            {data?.melbet?.matched && (
              <p className="mt-1 text-[10px] text-slate-500">
                Melbet: {data.melbet.opponent1 || '?'} vs {data.melbet.opponent2 || '?'}
                {data.melbet.melbetSportEventId != null
                  ? ` · id ${data.melbet.melbetSportEventId}`
                  : ''}
                {data.melbet.link ? (
                  <>
                    {' · '}
                    <a
                      href={data.melbet.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-400 hover:underline"
                    >
                      abrir Melbet
                    </a>
                  </>
                ) : null}
              </p>
            )}
            <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-slate-500">
              El análisis IA prepartido usa el prompt API-F. Si faltan mercados, copia el{' '}
              <span className="text-slate-400">Prompt Melbet</span> o el objeto estructurado para
              comparar / pegar como fuente alternativa.
            </p>
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
            {(
              [
                ['refPrompt', 'Copiar prompt API-F'],
                ['melbetPrompt', 'Copiar prompt Melbet'],
                ['melbetObject', 'Copiar objeto Melbet'],
              ] as const
            ).map(([id, label]) => (
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
                {copiedTab === id ? 'Copiado ✓' : label}
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

          {data?.success && tab === 'refUi' && (
            data.odds ? (
              <OddsSections odds={data.odds} />
            ) : (
              <p className="text-sm text-amber-300">Sin cuotas de referencia API-Football.</p>
            )
          )}

          {data?.success && tab === 'refPrompt' && (
            <textarea
              readOnly
              value={getCopyText('refPrompt')}
              className="h-[min(60vh,480px)] w-full resize-none rounded-lg border border-white/10 bg-[#0b0f14] p-3 font-mono text-xs text-slate-200"
            />
          )}

          {data?.success && tab === 'melbetUi' && (
            data.melbet?.matched && data.melbet.oddsStructured ? (
              <MelbetStructuredView structured={data.melbet.oddsStructured} />
            ) : data.melbet?.matched ? (
              <pre className="overflow-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
                {JSON.stringify(data.melbet.odds ?? {}, null, 2)}
              </pre>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {data.melbet?.conclusion || data.melbet?.reason || 'No se encontraron cuotas Melbet'}
              </div>
            )
          )}

          {data?.success && tab === 'melbetPrompt' && (
            <textarea
              readOnly
              value={getCopyText('melbetPrompt')}
              className="h-[min(60vh,480px)] w-full resize-none rounded-lg border border-white/10 bg-[#0b0f14] p-3 font-mono text-xs text-slate-200"
            />
          )}

          {data?.success && tab === 'melbetObject' && (
            <pre className="overflow-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
              {getCopyText('melbetObject')}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function MelbetStructuredView({ structured }: { structured: MelbetOddsStructured }) {
  return (
    <div className="space-y-3">
      {Object.entries(MELBET_SECTION_LABELS).map(([key, label]) => {
        const items = structured[key];
        if (!items?.length) return null;
        return (
          <section
            key={key}
            className="rounded-lg border border-white/10 border-l-4 border-l-teal-500/60 bg-[#0b0f14] p-3"
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-200">{label}</h3>
            <div className="space-y-1">
              {items.map((item, i) => (
                <MelbetOddLine key={i} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MelbetOddLine({ item }: { item: MelbetOddItem }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-300">
        {item.linea}
        {item.betName && (
          <span className="ml-1 text-xs text-slate-500">({item.betName})</span>
        )}
      </span>
      <span className="whitespace-nowrap text-teal-300">
        {item.odd ?? 'N/A'}
        {item.bookmaker && (
          <span className="ml-1 text-xs text-slate-500">({item.bookmaker})</span>
        )}
      </span>
    </div>
  );
}
