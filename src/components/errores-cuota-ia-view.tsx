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
        isLive
          ? 'bg-orange-500/20 text-orange-300'
          : 'bg-sky-500/20 text-sky-300'
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
  const [search, setSearch] = useState('');
  const [resultado, setResultado] = useState<ResultFilter>('all');
  const [statsOpen, setStatsOpen] = useState(true);

  const query = useQuery({
    queryKey: ['errores-cuota-ia', applied.desde, applied.hasta, applied.fuente],
    queryFn: () => fetchErroresCuotaIa(applied.desde, applied.hasta, applied.fuente),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (resultado !== 'all' && row.resultado_clase !== resultado) return false;
      if (!q) return true;
      const haystack = [
        row.equipo_local,
        row.equipo_visitante,
        row.liga,
        row.pais,
        row.tipo,
        row.bookmaker_display,
        row.explicacion,
        String(row.fixtureid),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, resultado]);

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
            Aplicar filtros
          </button>
        </form>
      </section>

      {statsOpen ? (
        <section className="mb-4 space-y-4 rounded-xl border border-white/10 bg-[#151b24] p-4 sm:mb-6 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Indicadores</h2>
            <p className="mt-1 text-xs text-slate-500">
              Calculados sobre las filas visibles (rango + fuente + búsqueda/resultado).
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
            <StatCard label="Prepartido" value={String(indicators.prepartido)} accent="text-sky-300" />
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

      <section className="mb-4 rounded-xl border border-white/10 bg-[#151b24] p-3 sm:mb-6 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-400">
            Buscar
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Equipo, liga, mercado, fixture…"
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
            Resultado
            <select
              value={resultado}
              onChange={(e) => setResultado(e.target.value as ResultFilter)}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">Todos</option>
              <option value="acertado">Acertados</option>
              <option value="fallido">Fallidos</option>
              <option value="pendiente">Pendientes</option>
            </select>
          </label>
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
          No hay errores de cuota en este rango
          {applied.fuente !== 'ambos'
            ? ` (${applied.fuente === 'vivo' ? 'en vivo' : 'prepartido'})`
            : ''}
          .
          <p className="mt-2 text-xs text-slate-500">
            Los de en vivo aparecen tras análisis live posteriores a la migración SQL de{' '}
            <code className="text-slate-400">PredictionAILiveOddsError</code>.
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
      <td className="px-3 py-3 whitespace-nowrap">
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
            {row.categoria_normalizada}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-200">
        {row.cuota_casa_display}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sky-300/90">
        {row.bookmaker_display}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-300">
        {row.prob_implicita_display}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-300">
        {row.prob_real_display}
      </td>
      <td className="px-3 py-3 text-right">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold tabular-nums ${
            row.diff_alta
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-white/5 text-slate-400'
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
