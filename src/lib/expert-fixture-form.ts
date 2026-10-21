import type { ExpertCatalogItem, ExpertFixtureHit, ExpertPronosticoSavePayload } from '@/lib/types';

const LIVE_STATUS = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const NOT_STARTED = new Set(['NS', 'TBD', 'PST']);

export type ExpertFixtureCatalogs = {
  deportes: ExpertCatalogItem[];
  campeonatos: ExpertCatalogItem[];
  estados: ExpertCatalogItem[];
  tiposPronostico: ExpertCatalogItem[];
};

export type ExpertFixtureSelection = {
  patch: Partial<ExpertPronosticoSavePayload>;
  missingCampeonato: { nombre: string; idDeporte: string } | null;
  note: string;
};

function norm(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function toFixtureDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const raw = String(value).trim();
  const plain = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  if (plain && !hasZone) return `${plain[1]}T${plain[2]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return plain ? `${plain[1]}T${plain[2]}` : '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  const hour = read('hour');
  return `${read('year')}-${read('month')}-${read('day')}T${hour === '24' ? '00' : hour}:${read('minute')}`;
}

function pickDeporte(deportes: ExpertCatalogItem[]) {
  const football = deportes.find((item) => /futbol|football|soccer/.test(norm(item.nombre)));
  if (football) return football;
  return deportes.length === 1 ? deportes[0] : null;
}

function compact(value: string) {
  return norm(value).replace(/ /g, '');
}

function uniqueNames(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    const name = String(value || '').trim();
    const key = norm(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function findCatalog(items: ExpertCatalogItem[], id: string | null | undefined) {
  const key = String(id || '').trim();
  if (!key) return null;
  return items.find((item) => item.id === key) || null;
}

function scoreCampeonato(candidate: string, target: string, country: string) {
  const name = norm(candidate);
  const wanted = norm(target);
  if (!name || !wanted) return 0;
  let score = 0;
  if (name === wanted) score = 100;
  else if (compact(candidate) === compact(target)) score = 92;
  else {
    const withCountry = [norm(`${target} ${country}`), norm(`${country} ${target}`)].filter(Boolean);
    if (withCountry.includes(name)) score = 88;
    else if (name.length >= 4 && wanted.length >= 4 && (name.includes(wanted) || wanted.includes(name))) {
      const longer = Math.max(name.length, wanted.length);
      const shorter = Math.min(name.length, wanted.length);
      score = 70 + Math.round((shorter / longer) * 20);
    }
  }
  const countryNorm = norm(country);
  if (score > 0 && countryNorm && name.includes(countryNorm)) score += 5;
  return score;
}

function pickCampeonato(
  campeonatos: ExpertCatalogItem[],
  names: string[],
  leaguecountry: string,
  idDeporte: string,
) {
  if (!names.length) return null;
  const pool = idDeporte ? campeonatos.filter((item) => item.idDeporte === idDeporte) : campeonatos;
  const ranked = pool
    .map((item) => ({
      item,
      score: Math.max(...names.map((name) => scoreCampeonato(item.nombre, name, leaguecountry))),
    }))
    .filter((row) => row.score >= 80)
    .sort((a, b) => b.score - a.score || a.item.nombre.length - b.item.nombre.length);
  if (!ranked.length) return null;
  if (ranked.length === 1 || ranked[0].score > ranked[1].score) return ranked[0].item;
  return null;
}

function pickByName(items: ExpertCatalogItem[], pattern: RegExp) {
  return items.find((item) => pattern.test(norm(item.nombre))) || null;
}

function scoreValue(value: number | string | null | undefined, status: string) {
  if (NOT_STARTED.has(status) || status === 'CANC' || status === 'ABD' || !status) return '';
  if (value == null || value === '') return '';
  return String(value);
}

export function applyExpertFixtureSelection(
  current: ExpertPronosticoSavePayload,
  hit: ExpertFixtureHit,
  catalogs: ExpertFixtureCatalogs,
): ExpertFixtureSelection {
  const status = String(hit.fixturestatusshort || '').toUpperCase().trim();
  const football = pickDeporte(catalogs.deportes);
  const previousCamp = findCatalog(catalogs.campeonatos, hit.previousIdCampeonato);
  const leagueCamp = previousCamp
    ? null
    : findCatalog(catalogs.campeonatos, hit.leagueSuggestedIdCampeonato);
  const reused = previousCamp || leagueCamp;
  const idDeporte = reused?.idDeporte || football?.id || current.idDeporte || '';
  const names = uniqueNames([hit.leaguecatalogname, hit.leaguename]);
  const country = String(hit.leaguecatalogcountry || hit.leaguecountry || '').trim();
  const leagueName = String(hit.leaguecatalogname || hit.leaguename || '').trim();
  const campeonato = reused || pickCampeonato(catalogs.campeonatos, names, country, idDeporte);
  const tipo = LIVE_STATUS.has(status)
    ? pickByName(catalogs.tiposPronostico, /vivo|live|direct/)
    : NOT_STARTED.has(status)
      ? pickByName(catalogs.tiposPronostico, /pre|previo|antes/)
      : null;
  const pendiente = pickByName(catalogs.estados, /^pendiente$/);
  const fechaEvento = toFixtureDatetimeLocal(hit.fixturedate);
  const patch: Partial<ExpertPronosticoSavePayload> = {
    fixtureId: hit.fixtureid,
    local: hit.teamshomename || current.local,
    visitante: hit.teamsawayname || current.visitante || '',
    resultadoLocal: scoreValue(hit.goalshome, status),
    resultadoVisitante: scoreValue(hit.goalsaway, status),
  };
  if (fechaEvento) patch.fechaEvento = fechaEvento;
  if (idDeporte) patch.idDeporte = idDeporte;
  if (campeonato) patch.idCampeonato = campeonato.id;
  if (tipo && !current.idTipoPronostico) patch.idTipoPronostico = tipo.id;
  if (pendiente && !current.idEstadoPronostico) patch.idEstadoPronostico = pendiente.id;

  const missingCampeonato = !campeonato && leagueName && idDeporte
    ? { nombre: leagueName, idDeporte }
    : null;
  const leagueLabel = [leagueName, country].filter(Boolean).join(' · ');
  const note = campeonato
    ? `Listo: ${hit.teamshomename || 'Local'} vs ${hit.teamsawayname || 'Visitante'}${leagueLabel ? ` · ${leagueLabel}` : ''}`
    : missingCampeonato
      ? `Falta el campeonato ${leagueName}. Se puede crear con el deporte elegido.`
      : `Partido ${hit.fixtureid} vinculado.`;

  return { patch, missingCampeonato, note };
}
