import type { PartidoRow } from './types';

export type PartidosClientFilters = {
  search: string;
  liga: string;
  pais: string;
  estado: string;
  stats: 'all' | 'with' | 'without';
  arbitro: 'all' | 'with' | 'without';
};

export type PartidosSortMode =
  | 'fecha_asc'
  | 'fecha_desc'
  | 'partido_asc'
  | 'liga_asc'
  | 'estado_asc';

export const DEFAULT_PARTIDOS_FILTERS: PartidosClientFilters = {
  search: '',
  liga: '',
  pais: '',
  estado: '',
  stats: 'all',
  arbitro: 'all',
};

const LIVE_STATES = new Set(['1H', '2H', 'HT', 'ET', 'LIVE', 'P', 'BT']);
const FT_STATES = new Set(['FT', 'AET', 'PEN']);

export function normalizeSearch(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function filterPartidosRows(
  rows: PartidoRow[],
  filters: PartidosClientFilters,
): PartidoRow[] {
  const q = normalizeSearch(filters.search);

  return rows.filter((row) => {
    if (filters.liga && row.liga !== filters.liga) return false;
    if (filters.pais && row.pais !== filters.pais) return false;

    if (filters.estado) {
      const e = String(row.estado).toUpperCase();
      if (filters.estado === 'live' && !LIVE_STATES.has(e)) return false;
      if (filters.estado === 'ft' && !FT_STATES.has(e)) return false;
      if (filters.estado === 'ns' && e !== 'NS' && e !== 'TBD') return false;
      if (filters.estado === 'other' && (LIVE_STATES.has(e) || FT_STATES.has(e) || e === 'NS' || e === 'TBD')) {
        return false;
      }
    }

    if (filters.stats === 'with' && !row.tieneEstadisticas) return false;
    if (filters.stats === 'without' && row.tieneEstadisticas) return false;
    if (filters.arbitro === 'with' && row.sinArbitro) return false;
    if (filters.arbitro === 'without' && !row.sinArbitro) return false;

    if (q) {
      const haystack = normalizeSearch(
        [
          row.fixtureid,
          row.local,
          row.visitante,
          row.liga,
          row.pais,
          row.fixturereferee,
          row.estado,
          row.marcador,
        ].join(' '),
      );
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function sortPartidosRows(rows: PartidoRow[], mode: PartidosSortMode): PartidoRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (mode) {
      case 'fecha_desc':
        return String(b.fixturedate || '').localeCompare(String(a.fixturedate || ''));
      case 'partido_asc':
        return `${a.local} vs ${a.visitante}`.localeCompare(`${b.local} vs ${b.visitante}`, 'es');
      case 'liga_asc':
        return a.liga.localeCompare(b.liga, 'es') || a.pais.localeCompare(b.pais, 'es');
      case 'estado_asc':
        return a.estado.localeCompare(b.estado, 'es');
      case 'fecha_asc':
      default:
        return String(a.fixturedate || '').localeCompare(String(b.fixturedate || ''));
    }
  });
  return copy;
}

export function estadoLabel(estado: string) {
  const e = String(estado).toUpperCase();
  if (e === 'NS' || e === 'TBD') return 'Por jugar';
  if (FT_STATES.has(e)) return 'Finalizado';
  if (LIVE_STATES.has(e)) return 'En vivo';
  return estado;
}
