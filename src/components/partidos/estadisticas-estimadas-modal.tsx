'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchEstadisticasEstimadas } from '@/lib/api';
import type { EstadisticasEstimadasFormula, EstadisticasEstimadasResponse } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

function fmt(v: number | null | undefined) {
  if (v == null) return '—';
  return Number(v).toFixed(2);
}

export function EstadisticasEstimadasModal({ fixtureId, matchLabel, onClose }: Props) {
  const query = useQuery({
    queryKey: ['partido-estadisticas-estimadas', fixtureId],
    queryFn: () => fetchEstadisticasEstimadas(fixtureId),
  });

  const data = query.data as EstadisticasEstimadasResponse | undefined;
  const formulas = data?.formulas
    ? [
        data.formulas.rematesLocal,
        data.formulas.rematesVisitante,
        data.formulas.faltasLocal,
        data.formulas.faltasVisitante,
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#12161e] shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Estadísticas estimadas</h2>
            <p className="mt-0.5 text-sm text-slate-400">{matchLabel}</p>
            {data?.fixture?.referee && (
              <p className="mt-1 text-xs text-slate-500">Árbitro: {data.fixture.referee}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-sm text-slate-300 hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          {query.isLoading && <p className="text-sm text-slate-400">Calculando estimaciones…</p>}
          {query.isError && (
            <p className="text-sm text-red-300">{(query.error as Error).message}</p>
          )}

          {data && (
            <>
              <section className="grid gap-3 sm:grid-cols-2">
                <ResultCard
                  title="Remates estimados"
                  local={data.estimates?.rematesLocal}
                  visitante={data.estimates?.rematesVisitante}
                  localName={data.fixture?.local}
                  awayName={data.fixture?.visitante}
                />
                <ResultCard
                  title="Faltas estimadas"
                  local={data.estimates?.faltasLocal}
                  visitante={data.estimates?.faltasVisitante}
                  localName={data.fixture?.local}
                  awayName={data.fixture?.visitante}
                />
              </section>

              {data.referee && (
                <div className="rounded-lg border border-white/10 bg-[#0c1017] px-3 py-2 text-xs text-slate-400">
                  Árbitro <span className="text-slate-200">{data.referee.name}</span>
                  {' · '}faltas promedio {fmt(data.referee.avgFouls)}
                  {data.referee.foulDataMatches != null && (
                    <> · {data.referee.foulDataMatches} partido(s) con dato</>
                  )}
                  {data.referee.note && <p className="mt-1 text-slate-500">{data.referee.note}</p>}
                </div>
              )}

              {!!data.warnings?.length && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  <p className="mb-1 font-medium text-amber-200">Avisos</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {data.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Fórmulas aplicadas</h3>
                {formulas.map((f) => (
                  <FormulaBlock key={f.title} formula={f} />
                ))}
              </section>

              <section className="rounded-lg border border-white/10 bg-[#0c1017] px-3 py-3 text-xs text-slate-500">
                <p className="font-medium text-slate-400">Inputs usados (promedios especiales)</p>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  <li>Remates local: {fmt(data.inputs?.rematesLocal)}</li>
                  <li>Remates visitante: {fmt(data.inputs?.rematesVisitante)}</li>
                  <li>Remates recibidos local: {fmt(data.inputs?.rematesRecibidosLocal)}</li>
                  <li>Remates recibidos visitante: {fmt(data.inputs?.rematesRecibidosVisitante)}</li>
                  <li>Faltas local: {fmt(data.inputs?.faltasLocal)}</li>
                  <li>Faltas visitante: {fmt(data.inputs?.faltasVisitante)}</li>
                  <li>Faltas provocadas local: {fmt(data.inputs?.faltasProvocaLocal)}</li>
                  <li>Faltas provocadas visitante: {fmt(data.inputs?.faltasProvocaVisitante)}</li>
                  <li>Faltas árbitro: {fmt(data.inputs?.faltasArbitro)}</li>
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  local,
  visitante,
  localName,
  awayName,
}: {
  title: string;
  local?: number | null;
  visitante?: number | null;
  localName?: string;
  awayName?: string;
}) {
  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-violet-300">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-slate-500">Local{localName ? ` · ${localName}` : ''}</p>
          <p className="font-mono text-2xl text-white">{fmt(local)}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500">
            Visitante{awayName ? ` · ${awayName}` : ''}
          </p>
          <p className="font-mono text-2xl text-white">{fmt(visitante)}</p>
        </div>
      </div>
    </div>
  );
}

function FormulaBlock({ formula }: { formula: EstadisticasEstimadasFormula }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0c1017] px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{formula.title}</p>
        <p className="font-mono text-lg text-emerald-300">{fmt(formula.result)}</p>
      </div>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-violet-200/90">
        {formula.expression}
      </p>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-slate-400">
        = {formula.withValues}
      </p>
      <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
        {formula.parts?.map((p) => (
          <li key={`${formula.title}-${p.key}`}>
            {p.label}: {fmt(p.value)} × {p.weight}
            {p.value != null ? ` → ${(Number(p.value) * p.weight).toFixed(2)}` : ''}
          </li>
        ))}
      </ul>
      {formula.note && <p className="mt-2 text-[11px] text-slate-500">{formula.note}</p>}
    </div>
  );
}
