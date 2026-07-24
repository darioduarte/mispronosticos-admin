'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRefereeHistory } from '@/lib/api';
import { RefereeHistorySamplePanel } from '@/components/referee-history-sample-panel';

type Props = {
  refereeName: string;
  fixtureCount?: number;
  onClose: () => void;
};

export function RefereeSampleModal({ refereeName, fixtureCount, onClose }: Props) {
  const historyQuery = useQuery({
    queryKey: ['referee-sample', refereeName],
    queryFn: () => fetchRefereeHistory(refereeName),
    enabled: refereeName.length > 0,
  });

  const matches = historyQuery.data?.matches ?? [];

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
          {historyQuery.isError ? (
            <p className="text-sm text-red-300">{(historyQuery.error as Error).message}</p>
          ) : (
            <RefereeHistorySamplePanel
              matches={matches}
              summaryLabel={historyQuery.data?.summaryLabel}
              isLoading={historyQuery.isLoading}
              showAliasColumn
              invalidateQueryKeys={[['referee-sample', refereeName]]}
              emptyMessage="Sin partidos finalizados previos con este nombre exacto en BD."
            />
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
