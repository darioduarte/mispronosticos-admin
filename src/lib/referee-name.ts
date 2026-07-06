/** Misma lógica que mispronosticosBackend/utils/refereeName.js (solo lo necesario en UI). */

function stripRefereeCountrySuffix(name: string | null | undefined) {
  if (name == null || String(name).trim() === '') return null;
  let s = String(name).trim();
  const comma = s.indexOf(',');
  if (comma > 0) s = s.slice(0, comma).trim();
  return s || null;
}

function removeDiacritics(s: string) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeRefereeKey(name: string | null | undefined) {
  const base = stripRefereeCountrySuffix(name);
  if (!base) return null;
  return removeDiacritics(base)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isRefereeNameLinked(
  name: string,
  aliases: { aliasRaw: string; aliasKey?: string }[],
) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return true;
  const key = normalizeRefereeKey(trimmed);
  for (const a of aliases) {
    if (a.aliasRaw === trimmed) return true;
    if (key && (a.aliasKey === key || normalizeRefereeKey(a.aliasRaw) === key)) return true;
  }
  return false;
}
