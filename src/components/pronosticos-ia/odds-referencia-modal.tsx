'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchOddsReferencia } from '@/lib/api';
import type { MelbetOddItem } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

export function OddsReferenciaModal({ fixtureId, matchLabel, onClose }: Props) {
  const query = useQuery({
    queryKey: ['odds-referencia', fixtureId],
    queryFn: () => fetchOddsReferencia(fixtureId),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Cuotas referencia partido</h2>
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

        <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-5">
          {query.isLoading && <p className="text-sm text-slate-400">Cargando cuotas…</p>}
          {query.isError && (
            <p className="text-sm text-red-300">{(query.error as Error).message}</p>
          )}
          {query.data && !query.data.success && (
            <p className="text-sm text-red-300">{query.data.error || 'Error al cargar cuotas'}</p>
          )}
          {query.data?.success && query.data.odds && (
            <OddsSections odds={query.data.odds} />
          )}
        </div>
      </div>
    </div>
  );
}

function OddsSections({ odds }: { odds: Record<string, unknown> }) {
  const entries = Object.entries(odds).filter(([, v]) => Array.isArray(v) && (v as unknown[]).length);
  if (entries.length === 0) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
        {JSON.stringify(odds, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([section, items]) => (
        <section
          key={section}
          className="rounded-lg border border-white/10 border-l-4 border-l-indigo-500/60 bg-[#0b0f14] p-3"
        >
          <h3 className="mb-2 text-sm font-semibold capitalize text-slate-200">
            {section.replace(/_/g, ' ')}
          </h3>
          <div className="space-y-1">
            {(items as MelbetOddItem[]).map((item, i) => (
              <div key={i} className="flex justify-between gap-2 text-sm">
                <span className="text-slate-300">
                  {item.linea ?? item.value}
                  {item.betName && (
                    <span className="ml-1 text-xs text-slate-500">({item.betName})</span>
                  )}
                </span>
                <span className="text-indigo-300">
                  {item.odd ?? 'N/A'}
                  {item.bookmaker && (
                    <span className="ml-1 text-xs text-slate-500">({item.bookmaker})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
