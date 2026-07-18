'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchPreMatchAnalysis, triggerPreMatchAnalysisManual } from '@/lib/api';
import type { PreMatchAnalysisPick } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function PickCard({ pick }: { pick: PreMatchAnalysisPick }) {
  const cuota =
    pick.cuota_decimal != null
      ? pick.cuota_decimal
      : pick.cuota_llm_decimal != null
        ? pick.cuota_llm_decimal
        : null;

  return (
    <li className="rounded-lg border border-white/5 bg-[#0b0f14] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-white">{pick.tipo}</span>
        {pick.probabilidad != null && (
          <span className="text-xs text-indigo-300">{pick.probabilidad}%</span>
        )}
        {cuota != null && <span className="text-xs text-slate-400">@{cuota}</span>}
        {pick.categoria_pronostico && (
          <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
            {pick.categoria_pronostico}
          </span>
        )}
      </div>
      {pick.pronostico ? (
        <p className="mt-1 text-xs text-slate-500">{pick.pronostico}</p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{pick.explicacion}</p>
    </li>
  );
}

export function PreMatchAnalysisModal({ fixtureId, matchLabel, onClose }: Props) {
  const qc = useQueryClient();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['pre-match-analysis', fixtureId],
    queryFn: () => fetchPreMatchAnalysis(fixtureId),
  });

  const generateMutation = useMutation({
    mutationFn: (force: boolean) => triggerPreMatchAnalysisManual(fixtureId, force),
    onSuccess: async (data) => {
      if (data.skipped && data.reason === 'already_exists') {
        setStatusMsg(data.message || 'Ya existe análisis. Usa regenerar para sobrescribir.');
        return;
      }
      setStatusMsg(
        data.ok
          ? data.message || `Generados ${data.published ?? 0} pick(s)`
          : data.message || data.reason || data.error || 'No se pudo generar',
      );
      await qc.invalidateQueries({ queryKey: ['pre-match-analysis', fixtureId] });
    },
    onError: (err: Error) => setStatusMsg(err.message),
  });

  const data = query.data;
  const fixture = data?.fixture;
  const analysis = data?.analysis;
  const hasAnalysis = Boolean(analysis);

  const label =
    fixture?.teamshomename && fixture?.teamsawayname
      ? `${fixture.teamshomename} vs ${fixture.teamsawayname}`
      : matchLabel;

  const statusLabel =
    fixture?.fixturestatusshort != null
      ? `${fixture.fixturestatusshort}${
          fixture.fixturestatuselapsed != null ? ` ${fixture.fixturestatuselapsed}'` : ''
        }`
      : null;

  function handleGenerate() {
    const force = hasAnalysis;
    const confirmMsg = force
      ? `¿Regenerar análisis IA PREPARTIDO para fixture ${fixtureId}?\n\nSe borrará el análisis actual y se generará uno nuevo. Puede tardar 30–90 s.`
      : `¿Generar análisis IA PREPARTIDO para fixture ${fixtureId}?\n\nPuede tardar 30–90 s (mismo pipeline que el cron de la noche).`;

    if (!window.confirm(confirmMsg)) return;
    setStatusMsg(null);
    generateMutation.mutate(force);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="pre-match-analysis-title"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="pre-match-analysis-title" className="text-lg font-semibold text-white">
              Análisis IA prepartido
            </h2>
            <p className="mt-1 text-sm text-slate-400">{label}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Fixture {fixtureId}
              {statusLabel && <span className="ml-2 text-sky-400/90">{statusLabel}</span>}
              {fixture?.leaguename && (
                <span className="ml-2 text-slate-600">{fixture.leaguename}</span>
              )}
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

        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3">
          <button
            type="button"
            disabled={generateMutation.isPending}
            onClick={handleGenerate}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {generateMutation.isPending
              ? 'Generando… (30–90 s)'
              : hasAnalysis
                ? 'Regenerar análisis IA'
                : 'Generar análisis IA'}
          </button>
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            {query.isFetching ? 'Actualizando…' : 'Actualizar'}
          </button>
          {analysis && (
            <span className="text-xs text-slate-500">
              {analysis.publishedCount} pick(s) · {formatDate(analysis.updatedAt || analysis.createdAt)}
            </span>
          )}
        </div>

        {statusMsg && (
          <p className="mx-5 mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
            {statusMsg}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {query.isLoading && (
            <p className="text-sm text-slate-400">Cargando análisis prepartido…</p>
          )}
          {query.isError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {(query.error as Error).message}
            </p>
          )}
          {!query.isLoading && !query.isError && !analysis && (
            <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">Aún no hay análisis prepartido para este partido.</p>
              <p className="mt-1 text-xs text-slate-500">
                Usa el botón de arriba para generarlo manualmente (sin esperar al cron).
              </p>
            </div>
          )}
          {analysis && (
            <div className="space-y-4">
              {analysis.analysis && (
                <section className="rounded-lg border border-white/10 bg-[#0b0f14] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Análisis general
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                    {analysis.analysis}
                  </p>
                </section>
              )}
              {analysis.picks.length === 0 ? (
                <p className="text-sm text-slate-500">Sin picks publicados.</p>
              ) : (
                <ul className="space-y-3">
                  {analysis.picks.map((pick) => (
                    <PickCard key={String(pick.id)} pick={pick} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
