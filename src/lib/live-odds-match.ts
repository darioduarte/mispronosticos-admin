export type LiveOddSide = 'over' | 'under';

export type LiveOddMatch = {
  section: string;
  side: LiveOddSide;
  linea: number;
  odd: number;
  oppositeOdd: number | null;
  swapped: boolean;
};

function almostEqual(a: number, b: number, eps = 0.04) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
}

export function normalizeOddsText(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function isCuotaSospechosa(row: {
  tipo?: string | null;
  categoria_normalizada?: string | null;
  cuota_casa?: string | number | null;
  cuota_casa_display?: string | null;
}): boolean {
  const cuota = parseFloat(
    String(row.cuota_casa ?? row.cuota_casa_display ?? '')
      .replace(',', '.')
      .replace(/[^\d.+-]/g, ''),
  );
  if (!Number.isFinite(cuota)) return false;
  const t = normalizeOddsText(`${row.tipo || ''} ${row.categoria_normalizada || ''}`);
  const isUnder = /\b(menos|under)\b/.test(t);
  const isOver = /\b(mas|over)\b/.test(t);
  if (isUnder && cuota >= 4) return true;
  if (isOver && cuota <= 1.08) return true;
  if (cuota >= 8) return true;
  return false;
}

export function inferTipoSide(tipo: string | null | undefined): LiveOddSide | null {
  const t = normalizeOddsText(tipo || '');
  if (/\b(menos|under)\b/.test(t)) return 'under';
  if (/\b(mas|over)\b/.test(t)) return 'over';
  return null;
}

function inferTipoLine(tipo: string | null | undefined): number | null {
  const m = String(tipo || '').match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function inferTipoScope(
  tipo: string | null | undefined,
  homeTeam?: string | null,
  awayTeam?: string | null,
): 'home' | 'away' | 'match' {
  const t = normalizeOddsText(tipo || '');
  const home = normalizeOddsText(homeTeam || '');
  const away = normalizeOddsText(awayTeam || '');
  if (away && t.includes(away)) return 'away';
  if (home && t.includes(home)) return 'home';
  if (/\bvisitante|away\b/.test(t)) return 'away';
  if (/\blocal|home\b/.test(t)) return 'home';
  return 'match';
}

function sectionMatchesScope(sectionName: string, scope: 'home' | 'away' | 'match') {
  const n = normalizeOddsText(sectionName);
  if (scope === 'away') return /\baway\b|\bvisitante\b/.test(n) && /\bgoal|gol/.test(n);
  if (scope === 'home') return /\bhome\b|\blocal\b/.test(n) && /\bgoal|gol/.test(n);
  return (
    (/\bmatch\b|\btotal\b|\bpartido\b/.test(n) && /\bgoal|gol/.test(n)) ||
    /^goals?$/.test(n) ||
    /^goles$/.test(n) ||
    /\bgoals over\/under\b/.test(n)
  );
}

type LiveSection = {
  name: string;
  lines: { side: LiveOddSide; line: number; odd: number }[];
};

export function parseLiveOddsSections(oddsText: string): LiveSection[] {
  const sections: LiveSection[] = [];
  let current: LiveSection | null = null;
  for (const raw of String(oddsText || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const item =
      line.match(/^[-•*]\s*(Over|Under)\s*\(?\s*(\d+(?:[.,]\d+)?)\s*\)?\s*:\s*(\d+(?:[.,]\d+)?)/i) ||
      line.match(/^(Over|Under)\s*\(?\s*(\d+(?:[.,]\d+)?)\s*\)?\s*:\s*(\d+(?:[.,]\d+)?)/i);
    if (item) {
      if (!current) {
        current = { name: 'Goals', lines: [] };
        sections.push(current);
      }
      current.lines.push({
        side: item[1].toLowerCase() as LiveOddSide,
        line: parseFloat(String(item[2]).replace(',', '.')),
        odd: parseFloat(String(item[3]).replace(',', '.')),
      });
      continue;
    }
    const header = line.match(/^(?![-•*]|Over\b|Under\b)(.+?):\s*$/i);
    if (header) {
      current = { name: header[1].trim(), lines: [] };
      sections.push(current);
    }
  }
  return sections;
}

export function findLiveOddForTipo(params: {
  tipo?: string | null;
  oddsText?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  storedCuota?: number | null;
}): LiveOddMatch | null {
  const { tipo, oddsText, homeTeam, awayTeam, storedCuota } = params;
  const side = inferTipoSide(tipo);
  const linea = inferTipoLine(tipo);
  if (!side || linea == null || !oddsText) return null;
  const scope = inferTipoScope(tipo, homeTeam, awayTeam);
  const sections = parseLiveOddsSections(oddsText);
  const candidates = sections.filter((s) => sectionMatchesScope(s.name, scope));
  const pool = candidates.length ? candidates : sections;
  for (const section of pool) {
    const over = section.lines.find((l) => l.side === 'over' && almostEqual(l.line, linea, 0.02));
    const under = section.lines.find((l) => l.side === 'under' && almostEqual(l.line, linea, 0.02));
    if (!over && !under) continue;
    const wanted = side === 'over' ? over : under;
    const opposite = side === 'over' ? under : over;
    if (!wanted) continue;
    const stored = storedCuota != null ? Number(storedCuota) : null;
    const swapped = Boolean(
      stored != null &&
        opposite &&
        almostEqual(stored, opposite.odd) &&
        !almostEqual(stored, wanted.odd),
    );
    return {
      section: section.name,
      side,
      linea,
      odd: wanted.odd,
      oppositeOdd: opposite ? opposite.odd : null,
      swapped,
    };
  }
  return null;
}

export function promptLineSectionMap(oddsText: string): string[] {
  const lines = String(oddsText || '').replace(/\r\n/g, '\n').split('\n');
  let current = '';
  return lines.map((raw) => {
    const line = raw.trim();
    const header = line.match(/^(?![-•*]|Over\b|Under\b)(.+?):\s*$/i);
    if (header && !/^(Over|Under)\b/i.test(line)) current = header[1].trim();
    return current;
  });
}
