'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchErroresCuotaIa } from '@/lib/api';
import type { ErrorCuotaIaFuente, ErrorCuotaIaRow } from '@/lib/types';

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultHasta() {
  return new Date().toISOString().slice(0, 10);
}

type ResultFilter = 'all' | 'acertado' | 'fallido' | 'pendiente';
type DiffScope = 'all' | 'alta' | 'normal';

type SortMode =
  | 'fecha_desc'
  | 'fecha_asc'
  | 'diff_desc'
  | 'diff_asc'
  | 'cuota_desc'
  | 'cuota_asc'
  | 'cuota_ia_desc'
  | 'cuota_ia_asc'
  | 'prob_real_desc'
  | 'prob_real_asc'
  | 'prob_impl_desc'
  | 'prob_impl_asc'
  | 'partido'
  | 'mercado'
  | 'resultado';

type ErroresCuotaFilters = {
  search: string;
  categoria: string;
  torneo: string;
  resultado: ResultFilter;
  diffScope: DiffScope;
  probRealMin: number;
  probRealMax: number;
  probImplMin: number;
  probImplMax: number;
  minCuota: string;
  maxCuota: string;
  minCuotaIa: string;
  maxCuotaIa: string;
  minDiff: string;
  maxDiff: string;
};

const DEFAULT_FILTERS: ErroresCuotaFilters = {
  search: '',
  categoria: '',
  torneo: '',
  resultado: 'all',
  diffScope: 'all',
  probRealMin: 0,
  probRealMax: 100,
  probImplMin: 0,
  probImplMax: 100,
  minCuota: '',
  maxCuota: '',
  minCuotaIa: '',
  maxCuotaIa: '',
  minDiff: '',
  maxDiff: '',
};

function parseNum(val: string | number | null | undefined): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/%/g, '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

function parseOptionalBound(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function torneoKey(row: ErrorCuotaIaRow): string {
  const pais = String(row.pais ?? '').trim();
  const liga = String(row.liga ?? '').trim();
  return [pais, liga].filter(Boolean).join(' · ') || 'Sin torneo';
}

function categoriaKey(row: ErrorCuotaIaRow): string {
  const c = row.categoria_normalizada;
  return c && String(c).trim() ? String(c) : 'otros';
}

function formatCategoriaLabel(cat: string): string {
  return String(cat).replace(/_/g, ' ');
}

function resultadoRank(clase: string): number {
  if (clase === 'acertado') return 0;
  if (clase === 'fallido') return 1;
  return 2;
}

function filterErroresRows(rows: ErrorCuotaIaRow[], f: ErroresCuotaFilters): ErrorCuotaIaRow[] {
  const q = f.search.trim().toLowerCase();
  const minC = parseOptionalBound(f.minCuota);
  const maxC = parseOptionalBound(f.maxCuota);
  const minCia = parseOptionalBound(f.minCuotaIa);
  const maxCia = parseOptionalBound(f.maxCuotaIa);
  const minDiff = parseOptionalBound(f.minDiff);
  const maxDiff = parseOptionalBound(f.maxDiff);

  return rows.filter((row) => {
    if (f.categoria && categoriaKey(row) !== f.categoria) return false;
    if (f.torneo && torneoKey(row) !== f.torneo) return false;
    if (f.resultado !== 'all' && row.resultado_clase !== f.resultado) return false;
    if (f.diffScope === 'alta' && !row.diff_alta) return false;
    if (f.diffScope === 'normal' && row.diff_alta) return false;

    const probReal = parseNum(row.probabilidad_real_estimada);
    if (probReal != null && (probReal < f.probRealMin || probReal > f.probRealMax)) return false;
    if (probReal == null && (f.probRealMin > 0 || f.probRealMax < 100)) return false;

    const probImpl = parseNum(row.probabilidad_implicita);
    if (probImpl != null && (probImpl < f.probImplMin || probImpl > f.probImplMax)) return false;
    if (probImpl == null && (f.probImplMin > 0 || f.probImplMax < 100)) return false;

    const cuota = parseNum(row.cuota_casa);
    if (minC != null && (cuota == null || cuota < minC)) return false;
    if (maxC != null && (cuota == null || cuota > maxC)) return false;

    const cuotaIa = parseNum(row.cuota_estimada_por_ia);
    if (minCia != null && (cuotaIa == null || cuotaIa < minCia)) return false;
    if (maxCia != null && (cuotaIa == null || cuotaIa > maxCia)) return false;

    const diff = row.diff_pp != null ? Number(row.diff_pp) : parseNum(row.diff_pp_display);
    if (minDiff != null && (diff == null || diff < minDiff)) return false;
    if (maxDiff != null && (diff == null || diff > maxDiff)) return false;

    if (!q) return true;
    const haystack = [
      row.equipo_local,
      row.equipo_visitante,
      row.liga,
      row.pais,
      row.tipo,
      row.categoria_normalizada,
      row.bookmaker_display,
      row.explicacion,
      row.fuente_label,
      row.windowKey,
      row.windowLabel,
      String(row.fixtureid),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

function sortErroresRows(rows: ErrorCuotaIaRow[], mode: SortMode): ErrorCuotaIaRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const da = a.fixturedate ? Date.parse(String(a.fixturedate)) : 0;
    const db = b.fixturedate ? Date.parse(String(b.fixturedate)) : 0;
    const diffA = a.diff_pp != null ? Number(a.diff_pp) : -1;
    const diffB = b.diff_pp != null ? Number(b.diff_pp) : -1;
    const cuotaA = parseNum(a.cuota_casa) ?? -1;
    const cuotaB = parseNum(b.cuota_casa) ?? -1;
    const cuotaIaA = parseNum(a.cuota_estimada_por_ia) ?? -1;
    const cuotaIaB = parseNum(b.cuota_estimada_por_ia) ?? -1;
    const pRealA = parseNum(a.probabilidad_real_estimada) ?? -1;
    const pRealB = parseNum(b.probabilidad_real_estimada) ?? -1;
    const pImplA = parseNum(a.probabilidad_implicita) ?? -1;
    const pImplB = parseNum(b.probabilidad_implicita) ?? -1;
    const partidoA = `${a.equipo_local || ''} ${a.equipo_visitante || ''}`.toLowerCase();
    const partidoB = `${b.equipo_local || ''} ${b.equipo_visitante || ''}`.toLowerCase();
    const mercadoA = String(a.tipo || '').toLowerCase();
    const mercadoB = String(b.tipo || '').toLowerCase();

    switch (mode) {
      case 'fecha_asc':
        return da - db || String(a.error_id).localeCompare(String(b.error_id));
      case 'diff_desc':
        return diffB - diffA || db - da;
      case 'diff_asc':
        return diffA - diffB || db - da;
      case 'cuota_desc':
        return cuotaB - cuotaA || diffB - diffA;
      case 'cuota_asc':
        return cuotaA - cuotaB || diffB - diffA;
      case 'cuota_ia_desc':
        return cuotaIaB - cuotaIaA || diffB - diffA;
      case 'cuota_ia_asc':
        return cuotaIaA - cuotaIaB || diffB - diffA;
      case 'prob_real_desc':
        return pRealB - pRealA || diffB - diffA;
      case 'prob_real_asc':
        return pRealA - pRealB || diffB - diffA;
      case 'prob_impl_desc':
        return pImplB - pImplA || diffB - diffA;
      case 'prob_impl_asc':
        return pImplA - pImplB || diffB - diffA;
      case 'partido':
        return partidoA.localeCompare(partidoB, 'es') || db - da;
      case 'mercado':
        return mercadoA.localeCompare(mercadoB, 'es') || db - da;
      case 'resultado':
        return (
          resultadoRank(a.resultado_clase) - resultadoRank(b.resultado_clase) || db - da
        );
      case 'fecha_desc':
      default:
        return db - da || String(a.error_id).localeCompare(String(b.error_id));
    }
  });
  return copy;
}

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

function FuenteBadge({ fuente }: { fuente: 'prepartido' | 'vivo' }) {
  const isLive = fuente === 'vivo';
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isLive ? 'bg-orange-500/20 text-orange-300' : 'bg-sky-500/20 text-sky-300'
      }`}
    >
      {isLive ? 'En vivo' : 'Prepartido'}
    </span>
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

function pct(n: number | null | undefined) {
  return n != null && Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
}

export function ErroresCuotaIaView() {
  const [desde, setDesde] = useState(defaultDesde());
  const [hasta, setHasta] = useState(defaultHasta());
  const [fuente, setFuente] = useState<ErrorCuotaIaFuente>('ambos');
  const [applied, setApplied] = useState({
    desde: defaultDesde(),
    hasta: defaultHasta(),
    fuente: 'ambos' as ErrorCuotaIaFuente,
  });
  const [filters, setFilters] = useState<ErroresCuotaFilters>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>('diff_desc');
  const [statsOpen, setStatsOpen] = useState(true);

  const query = useQuery({
    queryKey: ['errores-cuota-ia', applied.desde, applied.hasta, applied.fuente],
    queryFn: () => fetchErroresCuotaIa(applied.desde, applied.hasta, applied.fuente),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const categorias = useMemo(() => {
    const fromMeta = meta?.categorias ?? [];
    if (fromMeta.length) return fromMeta;
    return [...new Set(rows.map(categoriaKey))].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' }),
    );
  }, [meta?.categorias, rows]);

  const torneos = useMemo(() => {
    const fromMeta = meta?.torneos ?? [];
    if (fromMeta.length) return fromMeta.map((t) => t.key);
    return [...new Set(rows.map(torneoKey))].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' }),
    );
  }, [meta?.torneos, rows]);

  const filtered = useMemo(() => {
    return sortErroresRows(filterErroresRows(rows, filters), sortMode);
  }, [rows, filters, sortMode]);

  const indicators = useMemo(() => {
    const ac = filtered.filter((r) => r.resultado_clase === 'acertado').length;
    const fa = filtered.filter((r) => r.resultado_clase === 'fallido').length;
    const pe = filtered.filter((r) => r.resultado_clase === 'pendiente').length;
    const total = filtered.length;
    const resolved = ac + fa;
    const rateResolved = resolved > 0 ? (ac / resolved) * 100 : null;
    const rateTotal = total > 0 ? (ac / total) * 100 : null;
    const rateFail = resolved > 0 ? (fa / resolved) * 100 : null;
    const ratePend = total > 0 ? (pe / total) * 100 : null;
    const barTotal = Math.max(total, 1);
    return {
      ac,
      fa,
      pe,
      total,
      rateResolved,
      rateTotal,
      rateFail,
      ratePend,
      bar: {
        ac: (ac / barTotal) * 100,
        fa: (fa / barTotal) * 100,
        pe: (pe / barTotal) * 100,
      },
      fixturesUnicos: new Set(filtered.map((r) => r.fixtureid)).size,
      prepartido: filtered.filter((r) => r.fuente === 'prepartido').length,
      vivo: filtered.filter((r) => r.fuente === 'vivo').length,
    };
  }, [filtered]);

  function patchFilter(patch: Partial<ErroresCuotaFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="p-3 pb-6 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Errores de cuota IA
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            Discrepancias detectadas por la IA entre la probabilidad implícita de la cuota y la
            probabilidad real estimada (prepartido y en vivo).
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
            setApplied({ desde, hasta, fuente });
          }}
        >
          <DateField label="Desde" value={desde} onChange={setDesde} />
          <DateField label="Hasta" value={hasta} onChange={setHasta} />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
            Fuente
            <select
              value={fuente}
              onChange={(e) => setFuente(e.target.value as ErrorCuotaIaFuente)}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              <option value="ambos">Ambos</option>
              <option value="prepartido">Prepartido</option>
              <option value="vivo">En vivo</option>
            </select>
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 sm:w-auto"
          >
            Aplicar rango
          </button>
        </form>
      </section>

      {statsOpen ? (
        <section className="mb-4 space-y-4 rounded-xl border border-white/10 bg-[#151b24] p-4 sm:mb-6 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Indicadores</h2>
            <p className="mt-1 text-xs text-slate-500">
              Calculados sobre las filas visibles (rango + filtros + orden).
              {meta
                ? ` Servidor: ${meta.total} errores · ${meta.fixturesUnicos} partidos.`
                : null}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="% aciertos / evaluados"
              value={pct(indicators.rateResolved)}
              accent="text-indigo-300"
            />
            <StatCard label="Total visibles" value={String(indicators.total)} />
            <StatCard
              label="Acertados"
              value={String(indicators.ac)}
              accent="text-emerald-400"
            />
            <StatCard label="Fallidos" value={String(indicators.fa)} accent="text-red-400" />
            <StatCard
              label="Pendientes"
              value={String(indicators.pe)}
              accent="text-slate-400"
            />
            <StatCard label="% aciertos / total" value={pct(indicators.rateTotal)} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="% fallidos / evaluados" value={pct(indicators.rateFail)} />
            <StatCard label="% pendientes" value={pct(indicators.ratePend)} />
            <StatCard
              label="Prepartido"
              value={String(indicators.prepartido)}
              accent="text-sky-300"
            />
            <StatCard label="En vivo" value={String(indicators.vivo)} accent="text-orange-300" />
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-500">Distribución del resultado</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
              <div className="bg-emerald-500/80" style={{ width: `${indicators.bar.ac}%` }} />
              <div className="bg-red-500/70" style={{ width: `${indicators.bar.fa}%` }} />
              <div className="bg-slate-500/50" style={{ width: `${indicators.bar.pe}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {indicators.bar.ac.toFixed(0)}% aciertos · {indicators.bar.fa.toFixed(0)}% fallos ·{' '}
              {indicators.bar.pe.toFixed(0)}% pendientes
            </p>
          </div>
        </section>
      ) : null}

      <section className="mb-4 space-y-3 rounded-xl border border-white/10 bg-[#151b24] p-3 sm:mb-6 sm:p-4">
        <h2 className="text-sm font-semibold text-slate-200">Filtros</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <input
            type="search"
            placeholder="Buscar…"
            value={filters.search}
            onChange={(e) => patchFilter({ search: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200 sm:min-w-[180px] sm:flex-1"
          />
          <SelectFilter
            label="Categoría"
            value={filters.categoria}
            onChange={(v) => patchFilter({ categoria: v })}
            options={[
              { value: '', label: 'Todas' },
              ...categorias.map((c) => ({ value: c, label: formatCategoriaLabel(c) })),
            ]}
          />
          <SelectFilter
            label="Torneo"
            value={filters.torneo}
            onChange={(v) => patchFilter({ torneo: v })}
            options={[
              { value: '', label: 'Todos' },
              ...torneos.map((t) => ({ value: t, label: t })),
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
            label="Δ pp"
            value={filters.diffScope}
            onChange={(v) => patchFilter({ diffScope: v as DiffScope })}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'alta', label: 'Alta (≥15)' },
              { value: 'normal', label: 'Normal (<15)' },
            ]}
          />
          <SelectFilter
            label="Orden"
            value={sortMode}
            onChange={(v) => setSortMode(v as SortMode)}
            options={[
              { value: 'diff_desc', label: 'Δ pp ↓' },
              { value: 'diff_asc', label: 'Δ pp ↑' },
              { value: 'fecha_desc', label: 'Fecha ↓' },
              { value: 'fecha_asc', label: 'Fecha ↑' },
              { value: 'cuota_desc', label: 'Cuota ↓' },
              { value: 'cuota_asc', label: 'Cuota ↑' },
              { value: 'cuota_ia_desc', label: 'Cuota IA ↓' },
              { value: 'cuota_ia_asc', label: 'Cuota IA ↑' },
              { value: 'prob_real_desc', label: 'P. real ↓' },
              { value: 'prob_real_asc', label: 'P. real ↑' },
              { value: 'prob_impl_desc', label: 'P. implícita ↓' },
              { value: 'prob_impl_asc', label: 'P. implícita ↑' },
              { value: 'partido', label: 'Partido A–Z' },
              { value: 'mercado', label: 'Mercado A–Z' },
              { value: 'resultado', label: 'Resultado' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <SmallNumber
            label="P. real mín %"
            value={filters.probRealMin}
            onChange={(v) => patchFilter({ probRealMin: v })}
          />
          <SmallNumber
            label="P. real máx %"
            value={filters.probRealMax}
            onChange={(v) => patchFilter({ probRealMax: v })}
          />
          <SmallNumber
            label="P. impl. mín %"
            value={filters.probImplMin}
            onChange={(v) => patchFilter({ probImplMin: v })}
          />
          <SmallNumber
            label="P. impl. máx %"
            value={filters.probImplMax}
            onChange={(v) => patchFilter({ probImplMax: v })}
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
          <SmallText
            label="Cuota IA mín"
            value={filters.minCuotaIa}
            onChange={(v) => patchFilter({ minCuotaIa: v })}
          />
          <SmallText
            label="Cuota IA máx"
            value={filters.maxCuotaIa}
            onChange={(v) => patchFilter({ maxCuotaIa: v })}
          />
          <SmallText
            label="Δ pp mín"
            value={filters.minDiff}
            onChange={(v) => patchFilter({ minDiff: v })}
          />
          <SmallText
            label="Δ pp máx"
            value={filters.maxDiff}
            onChange={(v) => patchFilter({ maxDiff: v })}
          />
          <span className="col-span-2 self-end text-sm text-slate-500 sm:col-span-1">
            {filtered.length} filas visibles
          </span>
          <button
            type="button"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setSortMode('diff_desc');
            }}
            className="col-span-2 self-end rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 sm:col-span-1"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {query.isLoading ? (
        <p className="text-sm text-slate-400">Cargando errores de cuota…</p>
      ) : query.isError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {(query.error as Error)?.message || 'No se pudieron cargar los errores de cuota'}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#151b24] px-6 py-12 text-center text-sm text-slate-400">
          No hay errores de cuota para los filtros seleccionados
          {applied.fuente !== 'ambos'
            ? ` (${applied.fuente === 'vivo' ? 'en vivo' : 'prepartido'})`
            : ''}
          .
          <p className="mt-2 text-xs text-slate-500">
            Prueba ampliar el rango, limpiar filtros o regenerar análisis IA.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#151b24]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#111827] text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-semibold">Fecha</th>
                <th className="px-3 py-3 font-semibold">Fuente</th>
                <th className="px-3 py-3 font-semibold">Partido</th>
                <th className="px-3 py-3 font-semibold">Torneo</th>
                <th className="px-3 py-3 font-semibold">Mercado</th>
                <th className="px-3 py-3 font-semibold text-right">Cuota</th>
                <th className="px-3 py-3 font-semibold">Casa</th>
                <th className="px-3 py-3 font-semibold text-right">P. impl.</th>
                <th className="px-3 py-3 font-semibold text-right">P. real</th>
                <th className="px-3 py-3 font-semibold text-right">Δ pp</th>
                <th className="px-3 py-3 font-semibold text-right">Cuota IA</th>
                <th className="px-3 py-3 font-semibold">Resultado</th>
                <th className="px-3 py-3 font-semibold">Explicación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <ErrorRow key={`${row.fuente}-${row.error_id}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function ErrorRow({ row }: { row: ErrorCuotaIaRow }) {
  return (
    <tr className="border-t border-white/5 align-top hover:bg-white/[0.03]">
      <td className="whitespace-nowrap px-3 py-3">
        <div className="text-slate-200">{row.fecha}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {row.estado_partido || '—'}
          {row.marcador ? ` · ${row.marcador}` : ''}
        </div>
        {row.fuente === 'vivo' && (row.windowLabel || row.windowKey) ? (
          <div className="mt-0.5 text-xs text-orange-300/80">
            {row.windowLabel || row.windowKey}
            {row.run_minute != null ? ` · min ${row.run_minute}` : ''}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <FuenteBadge fuente={row.fuente} />
      </td>
      <td className="px-3 py-3">
        <div className="font-medium text-slate-100">
          {row.equipo_local || '—'} — {row.equipo_visitante || '—'}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">ID {row.fixtureid}</div>
      </td>
      <td className="px-3 py-3">
        <div className="text-slate-200">{row.pais || '—'}</div>
        <div className="mt-0.5 text-xs text-slate-500">{row.liga || '—'}</div>
      </td>
      <td className="max-w-[16rem] px-3 py-3">
        <div className="font-medium text-amber-200/90">{row.tipo}</div>
        {row.categoria_normalizada ? (
          <span className="mt-1 inline-block rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
            {formatCategoriaLabel(row.categoria_normalizada)}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-200">
        {row.cuota_casa_display}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sky-300/90">{row.bookmaker_display}</td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-300">
        {row.prob_implicita_display}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-300">
        {row.prob_real_display}
      </td>
      <td className="px-3 py-3 text-right">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold tabular-nums ${
            row.diff_alta ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-400'
          }`}
        >
          {row.diff_pp_display}
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-200">
        {row.cuota_ia_display}
      </td>
      <td className="px-3 py-3">
        <ResultBadge clase={row.resultado_clase || 'pendiente'} />
        {row.resultado_mensaje ? (
          <p className="mt-1 max-w-[12rem] text-xs leading-snug text-slate-500">
            {row.resultado_mensaje}
          </p>
        ) : null}
      </td>
      <td className="max-w-[18rem] px-3 py-3 text-xs leading-relaxed text-slate-400">
        {row.explicacion || '—'}
      </td>
    </tr>
  );
}
