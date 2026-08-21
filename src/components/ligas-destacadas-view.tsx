'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchLigasDestacadasDia, fetchRefereeHistory } from '@/lib/api';
import type {
  LigaDestacadaLeague,
  LigaDestacadaMatch,
  LigaDestacadaRefereeStats,
  LigaDestacadaSort,
  LigaDestacadaTopReferee,
} from '@/lib/types';
import { RefereeHistorySamplePanel } from '@/components/referee-history-sample-panel';

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type StatsSection = 'arbitros';

const STAT_SECTIONS: { id: StatsSection; label: string }[] = [
  { id: 'arbitros', label: 'Árbitros' },
];

const SORT_OPTIONS: { id: LigaDestacadaSort; label: string; hint: string }[] = [
  { id: 'fouls', label: 'Faltas', hint: 'Promedio de faltas totales por partido' },
  { id: 'yellow', label: 'Amarillas', hint: 'Promedio de tarjetas amarillas por partido' },
  { id: 'red', label: 'Rojas', hint: 'Promedio de tarjetas rojas por partido' },
];

function metricOf(row: { avgFouls: number | null; avgYellow: number | null; avgRed: number | null }, sort: LigaDestacadaSort) {
  if (sort === 'fouls') return row.avgFouls;
  if (sort === 'red') return row.avgRed;
  return row.avgYellow;
}

function sortByMetric<T extends { canonicalName?: string | null; name?: string | null; avgFouls: number | null; avgYellow: number | null; avgRed: number | null }>(
  rows: T[],
  sort: LigaDestacadaSort,
): T[] {
  return [...rows].sort((a, b) => {
    const av = metricOf(a, sort);
    const bv = metricOf(b, sort);
    if (av == null && bv == null) {
      return String(a.canonicalName || a.name || '').localeCompare(String(b.canonicalName || b.name || ''), 'es');
    }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (bv !== av) return bv - av;
    return String(a.canonicalName || a.name || '').localeCompare(String(b.canonicalName || b.name || ''), 'es');
  });
}

function fmtAvg(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function profileStyle(profile: string) {
  if (profile === 'estricto') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  if (profile === 'permisivo') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (profile === 'neutral') return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  return 'bg-white/5 text-slate-400 border-white/10';
}

function profileLabel(profile: string) {
  if (profile === 'estricto') return 'Estricto';
  if (profile === 'permisivo') return 'Permisivo';
  if (profile === 'neutral') return 'Neutral';
  return 'Sin datos';
}

function normalizeSearch(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function LigasDestacadasView() {
  const [section, setSection] = useState<StatsSection>('arbitros');
  const [date, setDate] = useState(todayBogota);
  const [appliedDate, setAppliedDate] = useState(todayBogota);
  const [sort, setSort] = useState<LigaDestacadaSort>('yellow');
  const [search, setSearch] = useState('');
  const [selectedReferee, setSelectedReferee] = useState<LigaDestacadaTopReferee | null>(null);

  const query = useQuery({
    queryKey: ['ligas-destacadas', appliedDate],
    queryFn: () => fetchLigasDestacadasDia({ date: appliedDate }),
  });

  const leagues = query.data?.leagues ?? [];
  const topReferees = query.data?.topReferees ?? [];
  const meta = query.data?.meta;

  const q = normalizeSearch(search);

  const filteredLeagues = useMemo(() => {
    if (!q) return leagues;
    return leagues
      .map((league) => {
        const leagueHit = normalizeSearch(`${league.name} ${league.country}`).includes(q);
        const matches = leagueHit
          ? league.matches
          : league.matches.filter((m) =>
              normalizeSearch(
                `${m.local} ${m.visitante} ${m.referee.canonicalName || ''} ${m.referee.name || ''}`,
              ).includes(q),
            );
        return { ...league, matches, matchCount: matches.length };
      })
      .filter((league) => league.matches.length > 0);
  }, [leagues, q]);

  const sortedLeagues = useMemo(
    () =>
      filteredLeagues.map((league) => ({
        ...league,
        matches: sortByMetric(
          league.matches.map((m) => ({
            ...m,
            avgFouls: m.referee.avgFouls,
            avgYellow: m.referee.avgYellow,
            avgRed: m.referee.avgRed,
            canonicalName: m.referee.canonicalName,
            name: m.referee.name,
          })),
          sort,
        ),
      })),
    [filteredLeagues, sort],
  );

  const sortedTop = useMemo(() => {
    const rows = q
      ? topReferees.filter((r) =>
          normalizeSearch(
            `${r.canonicalName || ''} ${r.name} ${r.country || ''} ${r.matches.map((m) => `${m.liga} ${m.local} ${m.visitante}`).join(' ')}`,
          ).includes(q),
        )
      : topReferees;
    return sortByMetric(rows, sort).map((row, index) => ({ ...row, rank: index + 1 }));
  }, [topReferees, sort, q]);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Estadísticas ligas destacadas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Métricas del día para ligas outstanding. Hoy: árbitros. Aquí irán más bloques
          (equipos, goles, etc.) sin salir de este menú.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {STAT_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              section === item.id
                ? 'bg-indigo-600 text-white'
                : 'border border-white/10 text-slate-300 hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="mb-6 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Fecha (Bogotá)</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Buscar liga, partido o árbitro</label>
            <input
              type="search"
              placeholder="Premier League, Martínez, Barcelona…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </div>
          <button
            type="button"
            onClick={() => setAppliedDate(date)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Ver día
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Ordenar top de árbitros por
          </p>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.hint}
                onClick={() => setSort(opt.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  sort === opt.id
                    ? 'bg-indigo-600 text-white'
                    : 'border border-white/10 text-slate-300 hover:bg-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {meta ? (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Pill>Ligas: {meta.leagueCount}</Pill>
          <Pill>Partidos: {meta.matchCount}</Pill>
          <Pill>Árbitros: {meta.refereeCount}</Pill>
          <Pill warn={meta.sinArbitroCount > 0}>Sin árbitro: {meta.sinArbitroCount}</Pill>
        </div>
      ) : null}

      {query.isLoading ? (
        <p className="text-sm text-slate-400">Cargando estadísticas de ligas destacadas…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-300">{(query.error as Error).message}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="xl:col-span-5">
            <div className="rounded-xl border border-white/10 bg-[#111827]">
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-medium text-slate-200">
                  Top árbitros · {SORT_OPTIONS.find((o) => o.id === sort)?.label}
                </h2>
                <p className="text-xs text-slate-500">
                  {sortedTop.length} colegiados del día · últimos {meta?.historyLimit ?? 10} PT · mayor
                  promedio primero
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-[#0c1017] text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Árbitro</th>
                      <th className={`px-3 py-2 text-right ${sort === 'fouls' ? 'text-indigo-300' : ''}`}>
                        Faltas
                      </th>
                      <th className={`px-3 py-2 text-right ${sort === 'yellow' ? 'text-indigo-300' : ''}`}>
                        Amar.
                      </th>
                      <th className={`px-3 py-2 text-right ${sort === 'red' ? 'text-indigo-300' : ''}`}>
                        Rojas
                      </th>
                      <th className="px-3 py-2 text-right">Hoy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTop.map((row) => (
                      <tr
                        key={row.key}
                        className="cursor-pointer border-t border-white/5 hover:bg-white/[0.03]"
                        onClick={() => setSelectedReferee(row)}
                      >
                        <td className="px-3 py-2 font-mono text-slate-500">{row.rank}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-100">{row.canonicalName || row.name}</p>
                          <p className="text-xs text-slate-500">
                            {row.country || '—'} · {row.prevCount} PT
                            {row.profile && row.profile !== 'sin_datos' ? ` · ${profileLabel(row.profile)}` : ''}
                          </p>
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${sort === 'fouls' ? 'font-semibold text-indigo-200' : 'text-slate-300'}`}>
                          {fmtAvg(row.avgFouls)}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${sort === 'yellow' ? 'font-semibold text-amber-200' : 'text-slate-300'}`}>
                          {fmtAvg(row.avgYellow)}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${sort === 'red' ? 'font-semibold text-rose-200' : 'text-slate-300'}`}>
                          {fmtAvg(row.avgRed)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">{row.matchCount}</td>
                      </tr>
                    ))}
                    {sortedTop.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                          No hay árbitros asignados este día.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="space-y-4 xl:col-span-7">
            {sortedLeagues.map((league) => (
              <LeagueCard
                key={league.leagueId || league.name}
                league={league}
                sort={sort}
                onSelectReferee={(match) => {
                  const top = sortedTop.find(
                    (r) =>
                      (match.referee.refereeId && r.refereeId === match.referee.refereeId) ||
                      r.name === match.referee.name ||
                      r.canonicalName === match.referee.canonicalName,
                  );
                  if (top) setSelectedReferee(top);
                }}
              />
            ))}
            {sortedLeagues.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#111827] px-4 py-10 text-center text-sm text-slate-500">
                No hay partidos de ligas destacadas para {appliedDate}.
              </p>
            ) : null}
          </section>
        </div>
      )}

      {selectedReferee ? (
        <RefereeDetailDrawer
          referee={selectedReferee}
          date={appliedDate}
          onClose={() => setSelectedReferee(null)}
        />
      ) : null}
    </div>
  );
}

function LeagueCard({
  league,
  sort,
  onSelectReferee,
}: {
  league: LigaDestacadaLeague;
  sort: LigaDestacadaSort;
  onSelectReferee: (match: LigaDestacadaMatch) => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#111827]">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        {league.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={league.logo} alt="" className="h-8 w-8 object-contain" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-[10px] text-slate-500">
            —
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-slate-100">{league.name}</h3>
          <p className="truncate text-xs text-slate-500">
            {league.country || '—'} · {league.matchCount} partido{league.matchCount === 1 ? '' : 's'} ·{' '}
            {league.refereeCount} árbitro{league.refereeCount === 1 ? '' : 's'}
            {league.sinArbitroCount > 0 ? ` · ${league.sinArbitroCount} sin colegiado` : ''}
          </p>
        </div>
      </header>
      <ul className="divide-y divide-white/5">
        {league.matches.map((match) => (
          <li key={match.fixtureid} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-100">
                  {match.local} <span className="text-slate-500">vs</span> {match.visitante}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {match.fechaDisplay} · {match.marcador}
                </p>
              </div>
              <EstadoBadge estado={match.estado} badgeClass={match.estadoBadgeClass} />
            </div>
            <RefereeLine referee={match.referee} sort={sort} onClick={() => onSelectReferee(match)} />
          </li>
        ))}
      </ul>
    </article>
  );
}

function RefereeLine({
  referee,
  sort,
  onClick,
}: {
  referee: LigaDestacadaRefereeStats;
  sort: LigaDestacadaSort;
  onClick: () => void;
}) {
  if (referee.sinArbitro) {
    return <p className="mt-2 text-xs text-amber-300/90">Sin árbitro asignado</p>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex w-full flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-[#0b0f14] px-2.5 py-2 text-left hover:border-white/15"
    >
      <span className="text-sm text-slate-200">{referee.canonicalName || referee.name}</span>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${profileStyle(referee.profile)}`}>
        {profileLabel(referee.profile)}
      </span>
      <span className="ml-auto flex flex-wrap gap-3 text-xs tabular-nums text-slate-400">
        <StatChip active={sort === 'fouls'} label="Faltas" value={fmtAvg(referee.avgFouls)} />
        <StatChip active={sort === 'yellow'} label="Amar." value={fmtAvg(referee.avgYellow)} accent="amber" />
        <StatChip active={sort === 'red'} label="Rojas" value={fmtAvg(referee.avgRed)} accent="rose" />
      </span>
    </button>
  );
}

function StatChip({
  label,
  value,
  active,
  accent = 'indigo',
}: {
  label: string;
  value: string;
  active?: boolean;
  accent?: 'indigo' | 'amber' | 'rose';
}) {
  const activeClass =
    accent === 'amber'
      ? 'text-amber-200'
      : accent === 'rose'
        ? 'text-rose-200'
        : 'text-indigo-200';
  return (
    <span className={active ? `font-semibold ${activeClass}` : ''}>
      {label} {value}
    </span>
  );
}

function RefereeDetailDrawer({
  referee,
  date,
  onClose,
}: {
  referee: LigaDestacadaTopReferee;
  date: string;
  onClose: () => void;
}) {
  const historyQuery = useQuery({
    queryKey: ['ligas-destacadas-history', referee.name, referee.matches[0]?.fixtureid],
    queryFn: () => fetchRefereeHistory(referee.name, referee.matches[0]?.fixtureid),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Cerrar" className="absolute inset-0" onClick={onClose} />
      <div
        className="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-2xl border border-white/10 bg-[#151b24] shadow-2xl sm:rounded-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{referee.canonicalName || referee.name}</h2>
            <p className="text-sm text-slate-400">
              {referee.country || 'País no registrado'} · {referee.prevCount} PT previos · {date}
            </p>
            {referee.summaryLabel ? (
              <p className="mt-1 text-xs text-emerald-300/90">{referee.summaryLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-slate-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[75vh] overflow-auto p-5">
          <div className="mb-4 grid grid-cols-3 gap-2">
            <AvgCard label="Faltas / PT" value={fmtAvg(referee.avgFouls)} hint={`${referee.foulDataMatches} con dato`} />
            <AvgCard label="Amarillas / PT" value={fmtAvg(referee.avgYellow)} hint={`${referee.yellowDataMatches} con dato`} />
            <AvgCard label="Rojas / PT" value={fmtAvg(referee.avgRed)} hint={`${referee.redDataMatches} con dato`} />
          </div>

          <h3 className="mb-2 text-sm font-medium text-slate-300">
            Partidos de hoy ({referee.matches.length})
          </h3>
          <ul className="mb-6 space-y-2">
            {referee.matches.map((m) => (
              <li key={m.fixtureid} className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm">
                <p className="text-slate-200">
                  {m.local} vs {m.visitante}
                </p>
                <p className="text-xs text-slate-500">
                  {m.liga} · {m.fechaDisplay} · {m.estado}
                </p>
              </li>
            ))}
          </ul>

          <h3 className="mb-2 text-sm font-medium text-slate-300">Historial disciplinario</h3>
          <RefereeHistorySamplePanel
            matches={historyQuery.data?.matches ?? []}
            summaryLabel={historyQuery.data?.summaryLabel}
            isLoading={historyQuery.isLoading}
            invalidateQueryKeys={[['ligas-destacadas-history', referee.name, referee.matches[0]?.fixtureid]]}
            emptyMessage="Sin historial previo en BD para este árbitro"
          />
        </div>
      </div>
    </div>
  );
}

function AvgCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function EstadoBadge({
  estado,
  badgeClass,
}: {
  estado: string;
  badgeClass: LigaDestacadaMatch['estadoBadgeClass'];
}) {
  const styles = {
    ns: 'bg-slate-500/20 text-slate-300',
    ft: 'bg-emerald-500/20 text-emerald-300',
    live: 'bg-amber-500/20 text-amber-300',
    other: 'bg-indigo-500/20 text-indigo-300',
  }[badgeClass];
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${styles}`}>{estado}</span>
  );
}

function Pill({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        warn ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-white/5 text-slate-300'
      }`}
    >
      {children}
    </span>
  );
}
