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

export const LIVE_DEMO_VERSION = 'demo-ritmo-v1';

export const LIVE_DEMO_RULES = `DEMO DE PRUEBA — no reemplaza el prompt de producción.
Aplica estas reglas D encima de los bloques 6 a 8. Si una D contradice una R, manda la D.

D1. Publica de 0 a 3 pronósticos. Si un candidato no pasa estas reglas, omítelo. No rellenes para llegar a 3.
D2. No publiques cuota menor a 1.20. La doble oportunidad solo entra si su cuota es al menos 1.20 y el equipo ya va ganando o el marcador y los remates de los últimos 15 minutos la sostienen. Un favorito que acaba de empatar no basta.
D3. Un pick de una fase anterior se repite solo si el tramo más reciente lo confirma. Un gol en los últimos 15 minutos anula la historia escrita antes de ese gol.
D4. Antes de un más de o un menos de, calcula: conteo actual, cuántos faltan para la línea y el ritmo del último tramo (del descanso al minuto actual, o del minuto 28 al 45). Si el ritmo que hace falta es más rápido que el del último tramo, no publiques ese más de.
D5. Córners y remates: usa el bloque de evolución. Si del 45 al minuto actual casi no aumentaron, no proyectes el ritmo del primer tiempo ni el promedio de prepartido.
D6. Tarjetas: si ya hay 4 o más y en los últimos 15 minutos entraron 2 o más, no publiques el menos de una línea que solo admite una o dos tarjetas más.
D7. Un promedio de prepartido sin número de partidos, o un promedio de goles en 0, es dato ausente. No lo uses para un pronóstico. Los últimos partidos con estadísticas mandan sobre ese promedio.
D8. El punto 7 del bloque 6 solo aplica si el equipo va perdiendo de verdad y el prompt trae su puesto en la tabla. Empate no es ir perdiendo.
D9. El error de cuota se puede publicar como pronóstico solo si el conteo en vivo ya lo hace probable. El promedio de prepartido no alcanza.`;

export function composeDemoRules(storedRules: string) {
  const stored = String(storedRules || '').trim();
  if (!stored) return LIVE_DEMO_RULES;
  return `${LIVE_DEMO_RULES}\n\n${stored}`;
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
