'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LiveOddsModal } from '@/components/pronosticos-ia/live-odds-modal';
import { LiveAnalysisModal } from '@/components/pronosticos-ia/live-analysis-modal';
import { PromptModal, type PromptKind } from '@/components/pronosticos-ia/prompt-modal';
import { PronosticosIaStatsPanel } from '@/components/pronosticos-ia/stats-panel';
import { ApuestasSimuladasPanel } from '@/components/pronosticos-ia/apuestas-simuladas-panel';
import { CategoriaChecklist } from '@/components/pronosticos-ia/categoria-checklist';
import {
  ExpandableText,
  buildPronosticoCaseText,
} from '@/components/pronosticos-ia/expandable-text';
import {
  fetchPronosticosIaVivo,
  triggerLiveAnalysisManual,
} from '@/lib/api';
import {
  filterPronosticosRows,
  formatCategoriaLabel,
  formatFixtureFechaHora,
  sortPronosticosRows,
  type PickScope,
  type PronosticosIaFilters,
  type ResultFilter,
  type SortMode,
  type StatsOptions,
} from '@/lib/pronosticos-ia-stats';
import type { PronosticoIaRow, PronosticoIaVivoRow } from '@/lib/types';

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultHasta() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_FILTERS: PronosticosIaFilters = {
  search: '',
  categorias: null,
  torneo: '',
  resultado: 'all',
  pickScope: 'all',
  probMin: 0,
  probMax: 100,
  minCuota: '',
  maxCuota: '',
};

const DEFAULT_STATS_OPTS: StatsOptions = {
  minEvalRanking: 2,
  minEvalSegments: 5,
  rollingDays: 14,
};

function ResultBadge({ clase }: { clase: string }) {
  const styles =
    clase === 'acertado'
      ? 'bg-emerald-500/20 text-emerald-300'
      : clase === 'fallido'
        ? 'bg-red-500/20 text-red-300'
        : 'bg-slate-500/20 text-slate-300';
  const label =
    clase === 'acertado' ? 'Acertado' : clase === 'fallido' ? 'Fallido' : 'Pendiente';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {label}
    </span>
  );
}

function rowMatchLabel(row: PronosticoIaVivoRow) {
  return `${row.equipo_local || row.teamshomename} vs ${row.equipo_visitante || row.teamsawayname}`;
}

function faseLabel(row: PronosticoIaVivoRow) {
  return row.windowLabel || row.windowKey || '-';
}

function rowCaseText(row: PronosticoIaVivoRow) {
  return buildPronosticoCaseText({
    fecha: row.fecha,
    local: row.equipo_local || row.teamshomename,
    visitante: row.equipo_visitante || row.teamsawayname,
    liga: row.liga,
    pais: row.pais,
    fase: faseLabel(row),
    minuto: row.run_minute,
    tipo: row.pronostico_tipo,
    pronostico: row.pronostico,
    categoria: row.categoria_normalizada || 'otros',
  });
}

function scoreRun(row: PronosticoIaVivoRow) {
  if (row.run_score_home == null || row.run_score_away == null) return '-';
  return `${row.run_score_home}-${row.run_score_away}`;
}

function scoreFinal(row: PronosticoIaVivoRow) {
  if (row.goalshome == null || row.goalsaway == null) return '-';
  return `${row.goalshome}-${row.goalsaway}`;
}

type RowModal = { fixtureId: number; label: string };

export function PronosticosIaVivoView() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const urlDesde = searchParams.get('desde');
  const urlHasta = searchParams.get('hasta');
  const urlSearch = searchParams.get('search') ?? '';

  const [desde, setDesde] = useState(urlDesde || defaultDesde());
  const [hasta, setHasta] = useState(urlHasta || defaultHasta());
  const [applied, setApplied] = useState({
    desde: urlDesde || defaultDesde(),
    hasta: urlHasta || defaultHasta(),
  });
  const [filters, setFilters] = useState<PronosticosIaFilters>({
    ...DEFAULT_FILTERS,
    search: urlSearch,
  });
  const [fase, setFase] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('valor_desc');
  const [statsOpts, setStatsOpts] = useState<StatsOptions>(DEFAULT_STATS_OPTS);
  const [statsOpen, setStatsOpen] = useState(true);
  const [stakePorPick, setStakePorPick] = useState(10);
  const [promptModal, setPromptModal] = useState<(RowModal & { kind: PromptKind }) | null>(
    null,
  );
  const [liveOddsModal, setLiveOddsModal] = useState<RowModal | null>(null);
  const [liveAnalysisModal, setLiveAnalysisModal] = useState<RowModal | null>(null);
  const [triggerBusy, setTriggerBusy] = useState<number | null>(null);

  useEffect(() => {
    if (urlDesde) {
      setDesde(urlDesde);
      setApplied((prev) => ({ ...prev, desde: urlDesde }));
    }
    if (urlHasta) {
      setHasta(urlHasta);
      setApplied((prev) => ({ ...prev, hasta: urlHasta }));
    }
    if (urlSearch) {
      setFilters((prev) => ({ ...prev, search: urlSearch }));
    }
  }, [urlDesde, urlHasta, urlSearch]);

  const query = useQuery({
    queryKey: ['pronosticos-ia-vivo', applied.desde, applied.hasta],
    queryFn: () => fetchPronosticosIaVivo(applied.desde, applied.hasta),
  });

  const filtered = useMemo(() => {
    const rows = query.data?.data ?? [];
    const base = filterPronosticosRows(rows as PronosticoIaRow[], filters) as PronosticoIaVivoRow[];
    const byFase = fase
      ? base.filter((r) => String(r.windowKey || '') === fase)
      : base;
    return sortPronosticosRows(byFase as PronosticoIaRow[], sortMode) as PronosticoIaVivoRow[];
  }, [query.data?.data, filters, fase, sortMode]);

  const meta = query.data?.meta;

  const categoriaOptions = useMemo(() => {
    const fromMeta = meta?.categorias ?? [];
    if (fromMeta.length > 0) return [...fromMeta].sort((a, b) => a.localeCompare(b, 'es'));
    const rows = query.data?.data ?? [];
    return [...new Set(rows.map((r) => r.categoria_normalizada || 'otros'))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
  }, [meta?.categorias, query.data?.data]);

  function patchFilter(patch: Partial<PronosticosIaFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function handleTrigger(row: PronosticoIaVivoRow) {
    if (
      !window.confirm(
        `¿Generar análisis IA en vivo para\n${rowMatchLabel(row)} (${row.fixtureid})?`,
      )
    ) {
      return;
    }
    setTriggerBusy(row.fixtureid);
    try {
      const res = await triggerLiveAnalysisManual(row.fixtureid);
      window.alert(
        res.ok
          ? res.message || `Generados ${res.published ?? 0} pick(s)`
          : res.error || res.message || 'No se pudo generar',
      );
      await queryClient.invalidateQueries({ queryKey: ['pronosticos-ia-vivo'] });
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setTriggerBusy(null);
    }
  }

  return (
    <div className="p-3 pb-6 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Pronósticos IA vivo
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            Picks de análisis en vivo por fase (min30 / HT / min60 / manual).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStatsOpen((v) => !v)}
          className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 sm:w-auto"
        >
          {statsOpen ? 'Ocultar indicadores' : 'Mostrar indicadores'}
        </button>
      </header>

      <section className="mb-4 rounded-xl border border-white/10 bg-[#151b24] p-3 sm:mb-6 sm:p-4">
        <form
          className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ desde, hasta });
          }}
        >
          <DateField label="Desde" value={desde} onChange={setDesde} />
          <DateField label="Hasta" value={hasta} onChange={setHasta} />
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 sm:w-auto"
          >
            Aplicar rango
          </button>
        </form>
      </section>

      {query.isLoading && <p className="text-sm text-slate-400">Cargando pronósticos en vivo...</p>}
      {query.isError && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {(query.error as Error).message}
        </p>
      )}

      <section className="mb-4 space-y-3 rounded-xl border border-white/10 bg-[#151b24] p-3 sm:p-4">
        <h2 className="text-sm font-semibold text-slate-200">Filtros</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <input
            type="search"
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => patchFilter({ search: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200 sm:min-w-[180px] sm:flex-1"
          />
          <SelectFilter
            label="Fase"
            value={fase}
            onChange={setFase}
            options={[
              { value: '', label: 'Todas' },
              ...(meta?.fases ?? []).map((f) => ({ value: f, label: f })),
            ]}
          />
          <SelectFilter
            label="Torneo"
            value={filters.torneo}
            onChange={(v) => patchFilter({ torneo: v })}
            options={[
              { value: '', label: 'Todos' },
              ...(meta?.torneos ?? []).map((t) => ({ value: t.key, label: t.key })),
            ]}
          />
          <SelectFilter
            label="Resultado"
            value={filters.resultado}
            onChange={(v) => patchFilter({ resultado: v as ResultFilter })}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'acertado', label: 'Acertados' },
              { value: 'fallido', label: 'Fallidos' },
              { value: 'pendiente', label: 'Pendientes' },
            ]}
          />
          <SelectFilter
            label="Pick"
            value={filters.pickScope}
            onChange={(v) => patchFilter({ pickScope: v as PickScope })}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'valor', label: 'Pick valor' },
              { value: 'normal', label: 'Normal' },
            ]}
          />
          <SelectFilter
            label="Orden"
            value={sortMode}
            onChange={(v) => setSortMode(v as SortMode)}
            options={[
              { value: 'valor_desc', label: 'Valor (prob+cuota)' },
              { value: 'fecha_asc', label: 'Fecha, hora y min ↑' },
              { value: 'fecha_desc', label: 'Fecha, hora y min ↓' },
              { value: 'prob_desc', label: 'Prob. ↓' },
              { value: 'prob_asc', label: 'Prob. ↑' },
              { value: 'cuota_desc', label: 'Cuota ↓' },
              { value: 'cuota_asc', label: 'Cuota ↑' },
              { value: 'none', label: 'Por partido' },
            ]}
          />
        </div>
        <CategoriaChecklist
          options={categoriaOptions}
          selected={filters.categorias}
          onChange={(categorias) => patchFilter({ categorias })}
        />
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <SmallNumber
            label="Prob. mín %"
            value={filters.probMin}
            onChange={(v) => patchFilter({ probMin: v })}
          />
          <SmallNumber
            label="Prob. máx %"
            value={filters.probMax}
            onChange={(v) => patchFilter({ probMax: v })}
          />
          <SmallText
            label="Cuota mín"
            value={filters.minCuota}
            onChange={(v) => patchFilter({ minCuota: v })}
          />
          <SmallText
            label="Cuota máx"
            value={filters.maxCuota}
            onChange={(v) => patchFilter({ maxCuota: v })}
          />
          <span className="col-span-2 self-end text-sm text-slate-500 sm:col-span-1">
            {filtered.length} filas visibles
          </span>
          <button
            type="button"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setFase('');
              setSortMode('valor_desc');
            }}
            className="col-span-2 self-end rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 sm:col-span-1"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {statsOpen && (
        <PronosticosIaStatsPanel
          rows={filtered as PronosticoIaRow[]}
          options={statsOpts}
          onOptionsChange={(patch) => setStatsOpts((o) => ({ ...o, ...patch }))}
        />
      )}

      <ApuestasSimuladasPanel
        rows={filtered as PronosticoIaRow[]}
        stake={stakePorPick}
        onStakeChange={setStakePorPick}
      />

      <div className="space-y-3 md:hidden">
        {filtered.map((row) => (
          <article
            key={row.pronostico_id}
            className="rounded-xl border border-white/10 bg-[#151b24] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug text-slate-100">
                  {row.equipo_local || row.teamshomename} vs{' '}
                  {row.equipo_visitante || row.teamsawayname}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatFixtureFechaHora(row)} · {faseLabel(row)} · min {row.run_minute ?? '-'}
                </p>
              </div>
              <ResultBadge clase={row.resultado_clase} />
            </div>
            <div className="mt-2">
              <ExpandableText
                text={row.pronostico || row.pronostico_tipo}
                caseText={rowCaseText(row)}
                clampClassName="line-clamp-4"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">
                {formatCategoriaLabel(row.categoria_normalizada || 'otros')}
              </span>
              {row.probabilidad != null && (
                <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-indigo-200">
                  {row.probabilidad}%
                </span>
              )}
              {row.cuota_display && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                  @{row.cuota_display}
                </span>
              )}
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-400">
                Run {scoreRun(row)} · FT {scoreFinal(row)}
              </span>
            </div>
            <RowActions
              row={row}
              triggerBusy={triggerBusy}
              onDetalle={() =>
                setLiveAnalysisModal({
                  fixtureId: row.fixtureid,
                  label: rowMatchLabel(row),
                })
              }
              onTrigger={() => handleTrigger(row)}
              onPrompt={(kind) =>
                setPromptModal({
                  fixtureId: row.fixtureid,
                  label: rowMatchLabel(row),
                  kind,
                })
              }
              onLiveOdds={() =>
                setLiveOddsModal({
                  fixtureId: row.fixtureid,
                  label: rowMatchLabel(row),
                })
              }
            />
          </article>
        ))}
        {!query.isLoading && filtered.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-[#151b24] px-4 py-8 text-center text-slate-500">
            Sin picks en vivo para los filtros seleccionados.
          </p>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-white/10 bg-[#151b24] md:block">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="border-b border-white/10 bg-[#0c1017] text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Partido</th>
              <th className="px-3 py-3">Liga</th>
              <th className="px-3 py-3">Fase</th>
              <th className="px-3 py-3">Min</th>
              <th className="px-3 py-3">Pronóstico</th>
              <th className="px-3 py-3">Cat.</th>
              <th className="px-3 py-3">Prob.</th>
              <th className="px-3 py-3">Cuota</th>
              <th className="px-3 py-3">Marc. run / FT</th>
              <th className="px-3 py-3">Eval.</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.pronostico_id}
                className="border-b border-white/5 align-top hover:bg-indigo-500/5"
              >
                <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                  {formatFixtureFechaHora(row)}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-200">
                    {row.equipo_local || row.teamshomename} vs{' '}
                    {row.equipo_visitante || row.teamsawayname}
                  </div>
                </td>
                <td className="max-w-[120px] px-3 py-2 text-slate-400">
                  <div className="truncate">{row.liga}</div>
                  <div className="truncate text-xs text-slate-600">{row.pais}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">{faseLabel(row)}</td>
                <td className="px-3 py-2 text-slate-400">{row.run_minute ?? '-'}</td>
                <td className="max-w-[280px] px-3 py-2">
                  <ExpandableText
                    text={row.pronostico || row.pronostico_tipo}
                    caseText={rowCaseText(row)}
                    clampClassName="line-clamp-3"
                  />
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                    {formatCategoriaLabel(row.categoria_normalizada || 'otros')}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">{row.probabilidad ?? '-'}</td>
                <td className="px-3 py-2 font-medium text-slate-200">
                  {row.cuota_display ?? '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                  {scoreRun(row)} / {scoreFinal(row)}
                </td>
                <td className="max-w-[160px] px-3 py-2">
                  <ResultBadge clase={row.resultado_clase} />
                  {row.resultado_mensaje && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {row.resultado_mensaje}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{row.estado_partido ?? '-'}</td>
                <td className="px-3 py-2">
                  <RowActions
                    row={row}
                    triggerBusy={triggerBusy}
                    onDetalle={() =>
                      setLiveAnalysisModal({
                        fixtureId: row.fixtureid,
                        label: rowMatchLabel(row),
                      })
                    }
                    onTrigger={() => handleTrigger(row)}
                    onPrompt={(kind) =>
                      setPromptModal({
                        fixtureId: row.fixtureid,
                        label: rowMatchLabel(row),
                        kind,
                      })
                    }
                    onLiveOdds={() =>
                      setLiveOddsModal({
                        fixtureId: row.fixtureid,
                        label: rowMatchLabel(row),
                      })
                    }
                  />
                </td>
              </tr>
            ))}
            {!query.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                  Sin picks en vivo para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {promptModal && (
        <PromptModal
          fixtureId={promptModal.fixtureId}
          matchLabel={promptModal.label}
          kind={promptModal.kind}
          onClose={() => setPromptModal(null)}
        />
      )}
      {liveOddsModal && (
        <LiveOddsModal
          fixtureId={liveOddsModal.fixtureId}
          matchLabel={liveOddsModal.label}
          onClose={() => setLiveOddsModal(null)}
        />
      )}
      {liveAnalysisModal && (
        <LiveAnalysisModal
          fixtureId={liveAnalysisModal.fixtureId}
          matchLabel={liveAnalysisModal.label}
          onClose={() => setLiveAnalysisModal(null)}
        />
      )}
    </div>
  );
}

function RowActions({
  row,
  triggerBusy,
  onDetalle,
  onTrigger,
  onPrompt,
  onLiveOdds,
}: {
  row: PronosticoIaVivoRow;
  triggerBusy: number | null;
  onDetalle: () => void;
  onTrigger: () => void;
  onPrompt: (kind: PromptKind) => void;
  onLiveOdds: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1 md:mt-0">
      <ActionBtn label="Detalle" onClick={onDetalle} />
      <ActionBtn
        label={triggerBusy === row.fixtureid ? '...' : 'Generar IA'}
        onClick={onTrigger}
        disabled={triggerBusy === row.fixtureid}
      />
      <ActionBtn label="Prompt Live" onClick={() => onPrompt('live')} />
      <ActionBtn label="Live V2" onClick={() => onPrompt('live-v2')} />
      <ActionBtn label="Cuotas live" onClick={onLiveOdds} />
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-white/10 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200 sm:w-auto"
      />
    </label>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block min-w-[140px] flex-1 text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
      >
        {options.map((o) => (
          <option key={o.value || '__all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SmallNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200 sm:w-24"
      />
    </label>
  );
}

function SmallText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-slate-400">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200 sm:w-24"
      />
    </label>
  );
}
