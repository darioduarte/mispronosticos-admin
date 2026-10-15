/**
 * Separa el prompt guardado de un minuto y arma la copia de laboratorio.
 * El marcador es el mismo que en modules/live/app/livePromptLab.js.
 */

export type LivePromptSplit = {
  context: string;
  rules: string;
  split: boolean;
};

const RULES_WITH_BANNER = /(?:^|\n)(?:[-═=]{8,}[^\n]*\n)BLOQUE\s*6\b/;
const RULES_BARE = /(?:^|\n)BLOQUE\s*6\b/;

function rulesStartIndex(text: string, match: RegExpMatchArray | null) {
  if (!match || match.index == null) return -1;
  const start = match.index;
  return text[start] === '\n' ? start + 1 : start;
}

export function splitLiveStoredPrompt(prompt: string | null | undefined): LivePromptSplit {
  const text = String(prompt || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return { context: '', rules: '', split: false };
  let start = rulesStartIndex(text, text.match(RULES_WITH_BANNER));
  if (start < 0) start = rulesStartIndex(text, text.match(RULES_BARE));
  if (start < 0) return { context: text.trim(), rules: '', split: false };
  return {
    context: text.slice(0, start).trim(),
    rules: text.slice(start).trim(),
    split: true,
  };
}

export function composeLiveLabPrompt(
  context: string,
  rules: string,
  preamble: string,
  edited = false,
) {
  const ctx = context.trim();
  const body = rules.trim();
  const head = preamble.trim();
  const banner = edited && head ? `${head}\nIncluye ediciones guardadas en este navegador.` : head;
  const tail = [banner, body].filter(Boolean).join('\n\n');
  if (!ctx) return tail;
  if (!tail) return ctx;
  return `${ctx}\n\n${tail}`;
}

export const LAB_DRAFT_KEY = 'mp-live-prompt-lab-draft';
export const LAB_NOTES_KEY = 'mp-live-prompt-lab-notes';

export type LabDraft = { version: string; rules: string };

export function readLabDraft(storage: Pick<Storage, 'getItem'> | null): LabDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LAB_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LabDraft>;
    if (!parsed || typeof parsed.rules !== 'string' || !parsed.rules.trim()) return null;
    return { version: String(parsed.version || ''), rules: parsed.rules };
  } catch {
    return null;
  }
}

export function writeLabDraft(
  storage: Pick<Storage, 'setItem'> | null,
  draft: LabDraft,
) {
  if (!storage) return;
  storage.setItem(LAB_DRAFT_KEY, JSON.stringify(draft));
}

export function readLabNote(
  storage: Pick<Storage, 'getItem'> | null,
  runId: string,
) {
  if (!storage) return '';
  try {
    const raw = storage.getItem(LAB_NOTES_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const note = parsed?.[runId];
    return typeof note === 'string' ? note : '';
  } catch {
    return '';
  }
}

export function writeLabNote(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  runId: string,
  note: string,
) {
  if (!storage) return;
  let parsed: Record<string, string> = {};
  try {
    const raw = storage.getItem(LAB_NOTES_KEY);
    const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    for (const [key, value] of Object.entries(current)) {
      if (typeof value === 'string') parsed[key] = value;
    }
  } catch {
    parsed = {};
  }
  parsed[runId] = note;
  storage.setItem(LAB_NOTES_KEY, JSON.stringify(parsed));
}
