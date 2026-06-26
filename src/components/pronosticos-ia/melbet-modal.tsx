'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMelbetOdds, fetchMelbetStatistics } from '@/lib/api';
import type { MelbetOddItem, MelbetOddsStructured } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

const SECTION_LABELS: Record<string, string> = {
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

export function MelbetModal({ fixtureId, matchLabel, onClose }: Props) {
  const oddsQuery = useQuery({
    queryKey: ['melbet-odds', fixtureId],
    queryFn: () => fetchMelbetOdds(fixtureId),
  });

  const statsQuery = useQuery({
    queryKey: ['melbet-stats', fixtureId],
    queryFn: () => fetchMelbetStatistics(fixtureId),
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
            <h2 className="text-lg font-semibold text-white">Cuotas Melbet</h2>
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

        <div className="max-h-[calc(90vh-72px)] space-y-4 overflow-y-auto p-5">
          {statsQuery.isLoading && (
            <p className="text-sm text-slate-500">Cargando estadísticas Melbet…</p>
          )}
          {statsQuery.data && (
            <MelbetStatsBlock data={statsQuery.data} />
          )}

          {oddsQuery.isLoading && (
            <p className="text-sm text-slate-400">Cargando cuotas…</p>
          )}
          {oddsQuery.isError && (
            <p className="text-sm text-red-300">{(oddsQuery.error as Error).message}</p>
          )}
          {oddsQuery.data && (
            <>
              {oddsQuery.data.link && (
                <a
                  href={oddsQuery.data.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-sm text-teal-400 hover:underline"
                >
                  Ver en Melbet →
                </a>
              )}
              {oddsQuery.data.matched && oddsQuery.data.oddsStructured ? (
                <OddsStructuredView structured={oddsQuery.data.oddsStructured} />
              ) : oddsQuery.data.matched ? (
                <pre className="overflow-x-auto rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-300">
                  {JSON.stringify(oddsQuery.data.odds, null, 2)}
                </pre>
              ) : (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {oddsQuery.data.reason || 'No se encontraron cuotas Melbet'}
                </div>
              )}
              {oddsQuery.data.debug && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer text-teal-400">Debug</summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-[#0b0f14] p-2">
                    {JSON.stringify(oddsQuery.data.debug, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OddsStructuredView({ structured }: { structured: MelbetOddsStructured }) {
  return (
    <div className="space-y-3">
      {Object.entries(SECTION_LABELS).map(([key, label]) => {
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
                <OddLine key={i} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function OddLine({ item }: { item: MelbetOddItem }) {
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

function MelbetStatsBlock({ data }: { data: Record<string, unknown> }) {
  const success = data.success !== false;
  if (!success) {
    return (
      <p className="text-sm text-amber-300">
        {(data.error as string) || 'Sin estadísticas Melbet'}
      </p>
    );
  }
  const summary = data.summary as Record<string, unknown> | undefined;
  if (!summary) return null;
  return (
    <section className="rounded-lg border border-white/10 bg-[#0c1017] p-3 text-sm">
      <h3 className="mb-2 font-semibold text-slate-200">Estadísticas / árbitros (Melbet)</h3>
      <pre className="overflow-x-auto text-xs text-slate-400">
        {JSON.stringify(summary, null, 2)}
      </pre>
    </section>
  );
}
