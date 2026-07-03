'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  fetchPartidoPromedios,
  fetchPartidoPromediosMuestra,
  recalculatePartidoPromedios,
} from '@/lib/api';
import type { PromedioMetricRow } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

type Tab = 'resumen' | 'muestra' | 'origen';

export function PromediosModal({ fixtureId, matchLabel, onClose }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('resumen');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState('');
  const [recalcOk, setRecalcOk] = useState<boolean | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['partido-promedios', fixtureId],
    queryFn: () => fetchPartidoPromedios(fixtureId),
  });

  const metrics = summaryQuery.data?.metrics ?? [];
  const homeMetrics = useMemo(() => metrics.filter((m) => m.side === 'home'), [metrics]);
  const awayMetrics = useMemo(() => metrics.filter((m) => m.side === 'away'), [metrics]);

  const muestraQuery = useQuery({
    queryKey: ['partido-promedios-muestra', fixtureId, selectedMetric],
    queryFn: () => fetchPartidoPromediosMuestra(fixtureId, selectedMetric!),
    enabled: tab === 'muestra' && Boolean(selectedMetric),
  });

  function openMuestra(key: string) {
    setSelectedMetric(key);
    setTab('muestra');
  }

  async function handleRecalcular() {
    setRecalcBusy(true);
    setRecalcMsg('');
    setRecalcOk(null);
    try {
      const result = await recalculatePartidoPromedios(fixtureId);
      if (!result.success) {
        setRecalcOk(false);
        setRecalcMsg(result.error || 'No se pudo recalcular');
        return;
      }
      const parts = [
        result.created ? 'Registro creado' : 'Registro actualizado',
        `${result.metricsCount ?? 0} métricas`,
      ];
      if (result.integrity?.removedTeams || result.integrity?.removedData) {
        parts.push(
          `limpieza: ${result.integrity.removedTeams ?? 0} ST + ${result.integrity.removedData ?? 0} STD dup`,
        );
      }
      setRecalcOk(true);
      setRecalcMsg(parts.join(' · '));
      await queryClient.invalidateQueries({ queryKey: ['partido-promedios', fixtureId] });
      await queryClient.invalidateQueries({ queryKey: ['partido-promedios-muestra', fixtureId] });
    } catch (e) {
      setRecalcOk(false);
      setRecalcMsg((e as Error).message);
    } finally {
      setRecalcBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Promedios especiales</h2>
              <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
              {summaryQuery.data?.procedure && (
                <p className="mt-1 font-mono text-xs text-violet-300/80">
                  SP: {summaryQuery.data.procedure}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <TabBtn active={tab === 'resumen'} onClick={() => setTab('resumen')}>
                  Resumen
                </TabBtn>
                <TabBtn active={tab === 'muestra'} onClick={() => setTab('muestra')}>
                  Muestra (5 partidos)
                </TabBtn>
                <TabBtn active={tab === 'origen'} onClick={() => setTab('origen')}>
                  Origen
                </TabBtn>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={handleRecalcular}
                disabled={recalcBusy}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {recalcBusy ? 'Recalculando…' : 'Recalcular y guardar'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
          {recalcMsg && (
            <p
              className={`mt-2 text-xs ${recalcOk ? 'text-emerald-300' : 'text-red-300'}`}
            >
              {recalcMsg}
            </p>
          )}
        </div>

        <div className="max-h-[calc(92vh-160px)] overflow-y-auto p-5">
          {summaryQuery.isLoading && (
            <p className="text-sm text-slate-400">Calculando promedios con el SP de producción…</p>
          )}
          {summaryQuery.isError && (
            <p className="text-sm text-red-300">{(summaryQuery.error as Error).message}</p>
          )}

          {summaryQuery.data && tab === 'resumen' && (
            <ResumenTab
              local={summaryQuery.data.fixture?.local ?? 'Local'}
              visitante={summaryQuery.data.fixture?.visitante ?? 'Visitante'}
              hasStored={summaryQuery.data.hasStored}
              storedAt={summaryQuery.data.storedAt}
              homeMetrics={homeMetrics}
              awayMetrics={awayMetrics}
              onOpenMuestra={openMuestra}
            />
          )}

          {tab === 'muestra' && (
            <MuestraTab
              metrics={metrics}
              selectedMetric={selectedMetric}
              onSelectMetric={setSelectedMetric}
              query={muestraQuery}
            />
          )}

          {summaryQuery.data?.fuente && tab === 'origen' && (
            <OrigenTab fuente={summaryQuery.data.fuente} fixture={summaryQuery.data.fixture} />
          )}
        </div>
      </div>
    </div>
  );
}

function ResumenTab({
  local,
  visitante,
  hasStored,
  storedAt,
  homeMetrics,
  awayMetrics,
  onOpenMuestra,
}: {
  local: string;
  visitante: string;
  hasStored?: boolean;
  storedAt?: string | null;
  homeMetrics: PromedioMetricRow[];
  awayMetrics: PromedioMetricRow[];
  onOpenMuestra: (key: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 text-sm text-slate-400">
        <span className="text-slate-300">En vivo (SP)</span> = recalculado ahora con{' '}
        <code className="text-violet-300">GetAveragesForFixtureSimple</code>.
        {' '}
        <span className="text-slate-300">Guardado</span> = fila en{' '}
        <code className="text-violet-300">PredictionAverageLastFixture</code>.
        {hasStored && storedAt && (
          <span className="ml-2 text-xs text-slate-500">
            Última persistencia: {new Date(storedAt).toLocaleString('es-CO')}
          </span>
        )}
        {!hasStored && (
          <span className="ml-2 text-xs text-amber-300">Sin fila guardada para este fixture.</span>
        )}
      </div>

      <MetricTable title={`Local — ${local}`} rows={homeMetrics} onOpenMuestra={onOpenMuestra} />
      <MetricTable
        title={`Visitante — ${visitante}`}
        rows={awayMetrics}
        onOpenMuestra={onOpenMuestra}
      />
    </div>
  );
}

function MetricTable({
  title,
  rows,
  onOpenMuestra,
}: {
  title: string;
  rows: PromedioMetricRow[];
  onOpenMuestra: (key: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-200">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#0c1017] text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Métrica</th>
              <th className="px-3 py-2 text-left">Stat API</th>
              <th className="px-3 py-2 text-right">En vivo</th>
              <th className="px-3 py-2 text-right">Guardado</th>
              <th className="px-3 py-2 text-center">Δ</th>
              <th className="px-3 py-2 text-right">Muestra</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.key} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2 text-slate-200">{m.label}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {m.statType}
                  <span className="ml-1 text-slate-600">
                    ({m.teamScope === 'self' ? 'propio' : 'rival'})
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-emerald-300">
                  {fmt(m.live)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">{fmt(m.stored)}</td>
                <td className="px-3 py-2 text-center">
                  {m.delta != null && !m.aligned ? (
                    <span className="text-xs text-amber-300">{m.delta > 0 ? '+' : ''}{m.delta}</span>
                  ) : (
                    <span className="text-xs text-emerald-500/70">✓</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onOpenMuestra(m.key)}
                    className="rounded border border-violet-500/30 px-2 py-0.5 text-xs text-violet-300 hover:bg-violet-500/10"
                  >
                    Ver 5
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MuestraTab({
  metrics,
  selectedMetric,
  onSelectMetric,
  query,
}: {
  metrics: PromedioMetricRow[];
  selectedMetric: string | null;
  onSelectMetric: (key: string | null) => void;
  query: ReturnType<typeof useQuery>;
}) {
  const data = query.data as import('@/lib/types').PromediosMuestraResponse | undefined;

  return (
    <div className="space-y-4">
      <label className="block text-sm text-slate-400">
        Métrica
        <select
          value={selectedMetric ?? ''}
          onChange={(e) => onSelectMetric(e.target.value || null)}
          className="mt-1 w-full max-w-md rounded-lg border border-white/10 bg-[#0c1017] px-3 py-2 text-sm text-white"
        >
          <option value="">Selecciona…</option>
          {metrics.map((m) => (
            <option key={m.key} value={m.key}>
              {m.side === 'home' ? 'Local' : 'Visitante'} — {m.label} ({m.key})
            </option>
          ))}
        </select>
      </label>

      {!selectedMetric && (
        <p className="text-sm text-slate-500">
          Elige una métrica para ver los últimos 5 partidos que alimentan el promedio.
        </p>
      )}

      {selectedMetric && query.isLoading && (
        <p className="text-sm text-slate-400">Cargando muestra…</p>
      )}
      {selectedMetric && query.isError && (
        <p className="text-sm text-red-300">{(query.error as Error).message}</p>
      )}

      {data?.metric && (
        <>
          <div className="rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 text-sm">
            <p className="text-slate-200">
              <strong>{data.metric.label}</strong> — {data.metric.sideLabel},{' '}
              {data.metric.teamScopeLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Tipo stat: <code>{data.metric.statType}</code>
            </p>
            <div className="mt-3 flex flex-wrap gap-4 font-mono text-sm">
              <span>
                Promedio 5 partidos:{' '}
                <strong className="text-emerald-300">{fmt(data.promedioCalculado)}</strong>
              </span>
              <span>
                Réplica JOIN del SP:{' '}
                <strong className="text-cyan-300">{fmt(data.promedioSpReplica)}</strong>
                {data.spJoinRows != null && (
                  <span className="ml-1 text-xs text-slate-500">({data.spJoinRows} filas join)</span>
                )}
              </span>
              <span>
                SP en vivo:{' '}
                <strong className="text-violet-300">{fmt(data.liveFromProcedure)}</strong>
              </span>
              <span>
                BD guardada:{' '}
                <strong className="text-slate-400">{fmt(data.storedInDb)}</strong>
              </span>
              {data.integrityOk != null && (
                <span className={data.integrityOk ? 'text-emerald-400' : 'text-amber-300'}>
                  {data.integrityOk ? 'Réplica SP = SP en vivo ✓' : 'Réplica SP ≠ SP en vivo'}
                </span>
              )}
            </div>
            {data.integrityNote && (
              <p className="mt-2 text-xs text-amber-300/90">{data.integrityNote}</p>
            )}
            {data.hasDuplicateStats && (
              <p className="mt-1 text-xs text-amber-400">
                ⚠ Partidos con filas duplicadas en StatisticsTeams/StatisticsByTeamData marcados en la tabla.
              </p>
            )}
            {data.muestraCriterio && (
              <div className="mt-3 rounded border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-slate-400">
                <p className="text-violet-200">{data.muestraCriterio.descripcion}</p>
                <p className="mt-1">teamId: {data.muestraCriterio.teamId} · rol: {data.muestraCriterio.rolRequerido}</p>
                <p className="mt-1 text-amber-200/90">{data.muestraCriterio.notaCopas}</p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[#0c1017] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Fixture</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Partido</th>
                  <th className="px-3 py-2 text-left">Rival</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-center">Filas stat</th>
                </tr>
              </thead>
              <tbody>
                {(data.muestra ?? []).map((r) => (
                  <tr
                    key={r.fixtureid}
                    className={`border-t border-white/5 ${r.duplicateStatRows ? 'bg-amber-500/5' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.fixtureid}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-400">{r.fecha ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-300">{r.partido}</td>
                    <td className="px-3 py-2 text-slate-400">{r.rival}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-300">{r.valor}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      {(r.statRowsMatched ?? 1) > 1 ? (
                        <span className="text-amber-300" title="Duplicados en BD afectan el AVG del SP">
                          {r.statRowsMatched} dup
                        </span>
                      ) : (
                        <span className="text-slate-600">1</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(data.muestra ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Sin partidos previos en la muestra.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600">
            {data.sampleSize ?? 0} partido(s) únicos — mismo criterio que TempLastFiveHome/Away del SP (
            fixturedate &lt; NOW(), LIMIT 5). Valor = bloque canónico StatisticsTeams (id más alto).
          </p>

          {(data.diagnosticoReciente?.length ?? 0) > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 text-sm font-semibold text-slate-200">
                Historial reciente del equipo (local + visitante)
              </h4>
              <p className="mb-2 text-xs text-slate-500">
                Filas resaltadas = entran en la muestra de esta métrica. Las demás explican por qué un partido
                reciente (p. ej. Mundial jun/2026) no aparece en córners local.
              </p>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-[#0c1017] uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Fixture</th>
                      <th className="px-2 py-2 text-left">Fecha</th>
                      <th className="px-2 py-2 text-left">Partido</th>
                      <th className="px-2 py-2 text-left">Rol BD</th>
                      <th className="px-2 py-2 text-left">Estado</th>
                      <th className="px-2 py-2 text-left">En muestra</th>
                      <th className="px-2 py-2 text-left">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.diagnosticoReciente!.map((d) => (
                      <tr
                        key={d.fixtureid}
                        className={`border-t border-white/5 ${
                          d.enMuestraActual
                            ? 'bg-emerald-500/10'
                            : !d.cumpleRolMetrica
                              ? 'bg-amber-500/5'
                              : ''
                        }`}
                      >
                        <td className="px-2 py-2 font-mono text-slate-500">{d.fixtureid}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-slate-400">{d.fecha ?? '—'}</td>
                        <td className="px-2 py-2 text-slate-300">{d.partido}</td>
                        <td className="px-2 py-2 capitalize text-slate-400">{d.rolEnPartido}</td>
                        <td className="px-2 py-2 text-slate-500">{d.estado}</td>
                        <td className="px-2 py-2">
                          {d.enMuestraActual ? (
                            <span className="text-emerald-400">Sí</span>
                          ) : (
                            <span className="text-slate-600">No</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-slate-500">{d.exclusionReason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrigenTab({
  fuente,
  fixture,
}: {
  fuente: NonNullable<import('@/lib/types').PromediosSummaryResponse['fuente']>;
  fixture?: import('@/lib/types').PromediosSummaryResponse['fixture'];
}) {
  return (
    <div className="space-y-4 text-sm text-slate-300">
      <p>{fuente.resumen}</p>
      <p>
        <strong className="text-slate-200">Tablas:</strong> {fuente.tablas.join(', ')}
      </p>
      <p>{fuente.muestraRegla}</p>
      {fixture && (
        <div className="rounded-lg border border-white/10 bg-[#0c1017] p-4 font-mono text-xs text-slate-400">
          <p>fixtureid: {fixture.fixtureid}</p>
          <p>teamshomeid: {fixture.teamshomeid}</p>
          <p>teamsawayid: {fixture.teamsawayid}</p>
          <p>
            {fixture.local} vs {fixture.visitante}
          </p>
        </div>
      )}
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-slate-400">
        <p className="mb-2 font-semibold text-violet-300">Procedimientos en MySQL</p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <code>GetAveragesForFixtureSimple(fixture_id)</code> — usado aquí (local + visitante)
          </li>
          <li>
            <code>GetAveragesHomeFixture(teamshomeid)</code> — solo agregado local (fallback cron)
          </li>
          <li>
            <code>GetAveragesAwayFixture(teamsawayid)</code> — solo agregado visitante
          </li>
          <li>
            <code>GetAveragesAllFixtures(JSON)</code> — batch masivo (no usado en este modal)
          </li>
        </ul>
      </div>
    </div>
  );
}

function fmt(v: number | null | undefined) {
  if (v == null) return '—';
  return Number(v).toFixed(2);
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
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'bg-violet-600 text-white'
          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
