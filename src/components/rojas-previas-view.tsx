'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRojasPrevias } from '@/lib/api';
import type { PreviousRedMatch, PreviousRedSide } from '@/lib/types';

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function hasDoubleRed(row: PreviousRedMatch) {
  return row.localPrevio.rojas >= 2 || row.visitantePrevio.rojas >= 2;
}

function formatPlayers(side: PreviousRedSide) {
  if (!side.jugadores.length) {
    return side.fuente === 'stats' ? 'Conteo de estadísticas, sin nombres' : 'Sin nombre de jugador';
  }
  return side.jugadores
    .map((player) => (player.minuto ? `${player.nombre} ${player.minuto}'` : player.nombre))
    .join(', ');
}

function RedCount({ count }: { count: number }) {
  const label = count === 1 ? '1 roja' : `${count} rojas`;
  const tone = count >= 2
    ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
    : 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function PreviousCell({ side, team }: { side: PreviousRedSide; team: string }) {
  return (
    <div className="min-w-[220px]">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <RedCount count={side.rojas} />
        <span className="text-xs text-slate-500">
          jugó de {side.condicion}
        </span>
      </div>
      <p className="text-sm text-slate-100">
        {team} vs {side.rival}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">
        {side.fechaDisplay} · {side.marcador}
        {side.liga ? ` · ${side.liga}` : ''}
      </p>
      <p className="mt-1 text-xs text-slate-300">{formatPlayers(side)}</p>
    </div>
  );
}

export function RojasPreviasView() {
  const [fecha, setFecha] = useState(todayBogota);
  const [search, setSearch] = useState('');
  const [onlyDoubles, setOnlyDoubles] = useState(false);

  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  const query = useQuery({
    queryKey: ['rojas-previas', fecha],
    queryFn: () => fetchRojasPrevias(fecha),
    enabled: fechaValida,
  });

  const rows = query.data?.data ?? [];
  const visible = useMemo(() => {
    const needle = normalizeSearch(search);
    return rows.filter((row) => {
      if (onlyDoubles && !hasDoubleRed(row)) return false;
      if (!needle) return true;
      const haystack = normalizeSearch(
        [row.local, row.visitante, row.liga, row.pais, row.localPrevio.rival, row.visitantePrevio.rival].join(' '),
      );
      return haystack.includes(needle);
    });
  }, [onlyDoubles, rows, search]);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Rojas del partido anterior</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Partidos del día en los que el local y el visitante recibieron al menos una tarjeta roja
          en el partido anterior que jugó cada uno. Si uno tuvo dos rojas y el otro también tuvo
          roja, entra en la lista. La doble amarilla cuenta como roja.
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFecha((current) => shiftDate(current, -1))}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Día anterior
            </button>
            <button
              type="button"
              onClick={() => setFecha(todayBogota())}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setFecha((current) => shiftDate(current, 1))}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Día siguiente
            </button>
          </div>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-slate-400">
            Buscar equipo o liga
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre"
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={onlyDoubles}
              onChange={(event) => setOnlyDoubles(event.target.checked)}
              className="accent-rose-400"
            />
            Algún equipo con 2 o más
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {query.data
            ? `${query.data.total} partidos con roja en ambos anteriores, de ${query.data.revisados} revisados el ${fecha}.`
            : 'La fecha es el día en Colombia.'}
          {query.data && visible.length !== rows.length ? ` Mostrando ${visible.length}.` : ''}
        </p>
      </section>

      {query.isLoading ? (
        <p className="text-sm text-slate-400">Buscando partidos…</p>
      ) : null}

      {query.isError ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {(query.error as Error).message || 'No se pudo cargar el listado'}
        </p>
      ) : null}

      {query.data && visible.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-[#111827] px-4 py-8 text-center text-sm text-slate-400">
          {rows.length === 0
            ? 'Ningún partido de este día tiene roja en el anterior del local y del visitante.'
            : 'Ningún partido coincide con el filtro.'}
        </p>
      ) : null}

      {visible.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#111827] text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Partido</th>
                <th className="px-3 py-3 font-medium">Anterior del local</th>
                <th className="px-3 py-3 font-medium">Anterior del visitante</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={String(row.fixtureid)} className="border-t border-white/10 bg-[#0b0f14] align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-100">
                      {row.local}
                      <span className="mx-1 text-slate-500">vs</span>
                      {row.visitante}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {row.fechaDisplay}
                      {row.estado ? ` · ${row.estado}` : ''}
                      {row.marcador !== '—' ? ` · ${row.marcador}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.pais ? `${row.pais} · ` : ''}
                      {row.liga}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <PreviousCell side={row.localPrevio} team={row.local} />
                  </td>
                  <td className="px-3 py-3">
                    <PreviousCell side={row.visitantePrevio} team={row.visitante} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
