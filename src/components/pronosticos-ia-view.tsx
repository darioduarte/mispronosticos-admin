'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FixtureStatsModal } from '@/components/pronosticos-ia/fixture-stats-modal';
import { ComparadorModal } from '@/components/pronosticos-ia/comparador-modal';
import { MelbetModal } from '@/components/pronosticos-ia/melbet-modal';
import { OddsReferenciaModal } from '@/components/pronosticos-ia/odds-referencia-modal';
import { PromptModal, type PromptKind } from '@/components/pronosticos-ia/prompt-modal';
import { PronosticosIaStatsPanel } from '@/components/pronosticos-ia/stats-panel';
import {
  fetchOddsForPronostico,
  fetchPronosticosIa,
  savePrognosticOdd,
} from '@/lib/api';
import {
  filterPronosticosRows,
  formatCategoriaLabel,
  sortPronosticosRows,
  type PickScope,
  type PronosticosIaFilters,
  type ResultFilter,
  type SortMode,
  type StatsOptions,
} from '@/lib/pronosticos-ia-stats';
import type { PronosticoIaRow } from '@/lib/types';

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
  categoria: '',
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

function rowMatchLabel(row: PronosticoIaRow) {
  return `${row.equipo_local || row.teamshomename} vs ${row.equipo_visitante || row.teamsawayname}`;
}

type RowModal = { fixtureId: number; label: string };

export function PronosticosIaView() {
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
  const [sortMode, setSortMode] = useState<SortMode>('valor_desc');
  const [statsOpts, setStatsOpts] = useState<StatsOptions>(DEFAULT_STATS_OPTS);
  const [statsOpen, setStatsOpen] = useState(true);
  const [statsFixture, setStatsFixture] = useState<RowModal | null>(null);
  const [promptModal, setPromptModal] = useState<(RowModal & { kind: PromptKind }) | null>(null);
  const [melbetModal, setMelbetModal] = useState<RowModal | null>(null);
  const [comparadorModal, setComparadorModal] = useState<RowModal | null>(null);
  const [oddsRefModal, setOddsRefModal] = useState<RowModal | null>(null);
  const [cuotaBusy, setCuotaBusy] = useState<string | null>(null);

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
    queryKey: ['pronosticos-ia', applied.desde, applied.hasta],
    queryFn: () => fetchPronosticosIa(applied.desde, applied.hasta),
  });

  const filtered = useMemo(() => {
    const rows = query.data?.data ?? [];
    const f = filterPronosticosRows(rows, filters);
    return sortPronosticosRows(f, sortMode);
  }, [query.data?.data, filters, sortMode]);

  const meta = query.data?.meta;

  async function handleFetchCuota(row: PronosticoIaRow) {
    setCuotaBusy(row.pronostico_id);
    try {
      const data = await fetchOddsForPronostico(row);
      const oddData = data.odds?.[row.pronostico_id] ?? data.odds?.[String(row.pronostico_id)];
      if (data.success && oddData?.odd) {
        await savePrognosticOdd({
          pronostico_id: row.pronostico_id,
          fixtureId: row.fixtureid,
          odd: oddData.odd,
          bookmaker: oddData.bookmaker,
          value: oddData.value,
          betName: oddData.betName,
        });
        await queryClient.invalidateQueries({ queryKey: ['pronosticos-ia'] });
      }
    } finally {
      setCuotaBusy(null);
    }
  }

  function patchFilter(patch: Partial<PronosticosIaFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Pronósticos IA</h1>
          <p className="mt-1 text-sm text-slate-400">
            Panel de revisión con estadísticas, filtros avanzados y acciones por fila.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStatsOpen((v) => !v)}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          {statsOpen ? 'Ocultar indicadores' : 'Mostrar indicadores'}
        </button>
      </header>

      <section className="mb-6 rounded-xl border border-white/10 bg-[#151b24] p-4">
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ desde, hasta });
          }}
        >
          <DateField label="Desde" value={desde} onChange={setDesde} />
          <DateField label="Hasta" value={hasta} onChange={setHasta} />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Aplicar rango
          </button>
        </form>
      </section>

      {query.isLoading && <p className="text-sm text-slate-400">Cargando pronósticos…</p>}
      {query.isError && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {(query.error as Error).message}
        </p>
      )}

      <section className="mb-4 space-y-3 rounded-xl border border-white/10 bg-[#151b24] p-4">
        <h2 className="text-sm font-semibold text-slate-200">Filtros</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Buscar…"
            value={filters.search}
            onChange={(e) => patchFilter({ search: e.target.value })}
            className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
          />
          <SelectFilter
            label="Categoría"
            value={filters.categoria}
            onChange={(v) => patchFilter({ categoria: v })}
            options={[{ value: '', label: 'Todas' }, ...(meta?.categorias ?? []).map((c) => ({ value: c, label: formatCategoriaLabel(c) }))]}
          />
          <SelectFilter
            label="Torneo"
            value={filters.torneo}
            onChange={(v) => patchFilter({ torneo: v })}
            options={[{ value: '', label: 'Todos' }, ...(meta?.torneos ?? []).map((t) => ({ value: t.key, label: t.key }))]}
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
              { value: 'prob_desc', label: 'Prob. ↓' },
              { value: 'prob_asc', label: 'Prob. ↑' },
              { value: 'cuota_desc', label: 'Cuota ↓' },
              { value: 'cuota_asc', label: 'Cuota ↑' },
              { value: 'none', label: 'Por partido' },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <SmallNumber label="Prob. mín %" value={filters.probMin} onChange={(v) => patchFilter({ probMin: v })} />
          <SmallNumber label="Prob. máx %" value={filters.probMax} onChange={(v) => patchFilter({ probMax: v })} />
          <SmallText label="Cuota mín" value={filters.minCuota} onChange={(v) => patchFilter({ minCuota: v })} />
          <SmallText label="Cuota máx" value={filters.maxCuota} onChange={(v) => patchFilter({ maxCuota: v })} />
          <span className="self-end text-sm text-slate-500">{filtered.length} filas visibles</span>
          <button
            type="button"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setSortMode('valor_desc');
            }}
            className="self-end rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {statsOpen && (
        <PronosticosIaStatsPanel
          rows={filtered}
          options={statsOpts}
          onOptionsChange={(patch) => setStatsOpts((o) => ({ ...o, ...patch }))}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#151b24]">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="border-b border-white/10 bg-[#0c1017] text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Partido</th>
              <th className="px-3 py-3">Liga</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">Pronóstico</th>
              <th className="px-3 py-3">Cat.</th>
              <th className="px-3 py-3">Línea</th>
              <th className="px-3 py-3">Equipo</th>
              <th className="px-3 py-3">Prob.</th>
              <th className="px-3 py-3">Marcador</th>
              <th className="px-3 py-3">Eval.</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Guard.</th>
              <th className="px-3 py-3">Cuota / acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.pronostico_id}
                className="border-b border-white/5 align-top hover:bg-indigo-500/5"
              >
                <td className="whitespace-nowrap px-3 py-2 text-slate-400">{row.fecha}</td>
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
                <td className="max-w-[100px] px-3 py-2 text-slate-400">{row.pronostico_tipo}</td>
                <td className="max-w-[200px] px-3 py-2 text-slate-300">
                  <div className="line-clamp-3">{row.pronostico}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                    {formatCategoriaLabel(row.categoria_normalizada || 'otros')}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">{row.linea_normalizada ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400">{row.equipo_normalizado ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400">{row.probabilidad ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                  {row.goalshome != null && row.goalsaway != null
                    ? `${row.goalshome} - ${row.goalsaway}`
                    : '—'}
                </td>
                <td className="max-w-[160px] px-3 py-2">
                  <ResultBadge clase={row.resultado_clase} />
                  {row.resultado_mensaje && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {row.resultado_mensaje}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{row.estado_partido ?? '—'}</td>
                <td className="px-3 py-2 text-center text-slate-400">
                  {row.totalUsuariosGuardado ?? 0}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-200">{row.cuota_display ?? '—'}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <ActionBtn
                      label={cuotaBusy === row.pronostico_id ? '…' : 'Cuota'}
                      onClick={() => handleFetchCuota(row)}
                      disabled={cuotaBusy === row.pronostico_id}
                    />
                    <ActionBtn
                      label="Stats"
                      onClick={() =>
                        setStatsFixture({
                          fixtureId: row.fixtureid,
                          label: rowMatchLabel(row),
                        })
                      }
                    />
                    <ActionBtn
                      label="Prompt"
                      onClick={() =>
                        setPromptModal({
                          fixtureId: row.fixtureid,
                          label: rowMatchLabel(row),
                          kind: 'pre-match',
                        })
                      }
                    />
                    <ActionBtn
                      label="Live"
                      onClick={() =>
                        setPromptModal({
                          fixtureId: row.fixtureid,
                          label: rowMatchLabel(row),
                          kind: 'live',
                        })
                      }
                    />
                    <ActionBtn
                      label="Melbet"
                      onClick={() =>
                        setMelbetModal({
                          fixtureId: row.fixtureid,
                          label: rowMatchLabel(row),
                        })
                      }
                    />
                    <ActionBtn
                      label="Ref."
                      onClick={() =>
                        setOddsRefModal({
                          fixtureId: row.fixtureid,
                          label: rowMatchLabel(row),
                        })
                      }
                    />
                    <ActionBtn
                      label="Cmp"
                      onClick={() =>
                        setComparadorModal({
                          fixtureId: row.fixtureid,
                          label: rowMatchLabel(row),
                        })
                      }
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!query.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-slate-500">
                  Sin pronósticos para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Labs Gemini/OpenRouter y filtros cruzados con perfiles siguen en{' '}
        <a
          href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/apiFootball/pronosticosAIHTML`}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-400 hover:underline"
        >
          pronosticosAIHTML
        </a>
        .
      </p>

      {statsFixture && (
        <FixtureStatsModal
          fixtureId={statsFixture.fixtureId}
          matchLabel={statsFixture.label}
          onClose={() => setStatsFixture(null)}
        />
      )}
      {promptModal && (
        <PromptModal
          fixtureId={promptModal.fixtureId}
          matchLabel={promptModal.label}
          kind={promptModal.kind}
          onClose={() => setPromptModal(null)}
        />
      )}
      {melbetModal && (
        <MelbetModal
          fixtureId={melbetModal.fixtureId}
          matchLabel={melbetModal.label}
          onClose={() => setMelbetModal(null)}
        />
      )}
      {oddsRefModal && (
        <OddsReferenciaModal
          fixtureId={oddsRefModal.fixtureId}
          matchLabel={oddsRefModal.label}
          onClose={() => setOddsRefModal(null)}
        />
      )}
      {comparadorModal && (
        <ComparadorModal
          fixtureId={comparadorModal.fixtureId}
          matchLabel={comparadorModal.label}
          onClose={() => setComparadorModal(null)}
        />
      )}
    </div>
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
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
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
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-2 text-sm text-slate-200"
      >
        {options.map((o) => (
          <option key={o.value || 'all'} value={o.value}>
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
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      {label}
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
        className="w-20 rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-2 text-sm text-slate-200"
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
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="w-20 rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-2 text-sm text-slate-200"
      />
    </label>
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
      className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-400 hover:border-indigo-500/40 hover:text-indigo-300 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
