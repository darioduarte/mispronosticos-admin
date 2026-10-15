'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fetchLivePromptLabTemplate } from '@/lib/api';
import {
  composeDemoRules,
  composeLiveLabPrompt,
  LIVE_DEMO_VERSION,
  readLabDraft,
  readLabNote,
  splitLiveStoredPrompt,
  writeLabDraft,
  writeLabNote,
} from '@/lib/live-prompt-lab';
import type { LivePromptLabTemplate } from '@/lib/types';

type Props = {
  runId: string;
  prompt: string | null | undefined;
};

function browserStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function LivePromptLabPanel({ runId, prompt }: Props) {
  const templateQuery = useQuery({
    queryKey: ['live-prompt-lab-template'],
    queryFn: () => fetchLivePromptLabTemplate(),
    staleTime: 60_000,
  });
  const template = templateQuery.data?.success ? templateQuery.data : null;
  const parts = useMemo(() => splitLiveStoredPrompt(prompt), [prompt]);
  const [rules, setRules] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState<'lab' | 'context' | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRules(null);
    setNote(readLabNote(browserStorage(), runId));
    setHydrated(true);
  }, [runId]);

  useEffect(() => {
    if (!hydrated || rules != null) return;
    const draft = readLabDraft(browserStorage());
    if (draft?.version === LIVE_DEMO_VERSION) {
      setDraftVersion(draft.version);
      setRules(draft.rules);
      return;
    }
    setDraftVersion(LIVE_DEMO_VERSION);
    setRules(composeDemoRules(parts.rules));
  }, [hydrated, rules, parts.rules]);

  const baseline =
    draftVersion === 'minuto-original'
      ? parts.rules
      : template && draftVersion === template.version
        ? template.rules
        : composeDemoRules(parts.rules);
  const edited = rules != null && rules.trim() !== baseline.trim();
  const staleDraft = Boolean(
    template &&
      draftVersion &&
      draftVersion !== LIVE_DEMO_VERSION &&
      draftVersion !== 'minuto-original' &&
      draftVersion !== template.version,
  );

  const labPrompt = useMemo(() => {
    if (rules == null || !parts.context) return '';
    const preamble = template?.preamble || 'Prompt live demo. No se publica en la app.';
    return composeLiveLabPrompt(parts.context, rules, preamble, edited);
  }, [template, rules, parts.context, edited]);

  function persistRules(next: string, version: string) {
    setRules(next);
    setDraftVersion(version);
    writeLabDraft(browserStorage(), { version, rules: next });
  }

  async function copyText(text: string, kind: 'lab' | 'context') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
      <p className="text-xs font-semibold text-violet-100">Prompt live demo</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Arma una copia de este minuto con las reglas D de prueba delante de los bloques 6 a 8.
        El prompt de producción no cambia y esto no se publica en la app. Cópialo al sandbox
        y pega aquí el JSON que devuelva.
      </p>

      {templateQuery.isLoading && (
        <p className="mt-2 text-xs text-slate-500">Cargando reglas de prueba…</p>
      )}
      {templateQuery.isError && (
        <p className="mt-2 text-xs text-red-300">
          {(templateQuery.error as Error).message}
        </p>
      )}
      {template && draftVersion === template.version && <LabChanges template={template} />}
      {!parts.split && (
        <p className="mt-2 text-xs text-amber-200">
          Este prompt guardado no trae el bloque 6. Se puede copiar entero, pero no separar
          el partido de las reglas.
        </p>
      )}

      {hydrated && rules != null && (
        <>
          {staleDraft && (
            <p className="mt-2 text-xs text-amber-200">
              El borrador del navegador es de {draftVersion}. La plantilla actual es {template?.version}.
            </p>
          )}
          <label className="mt-3 block text-[11px] uppercase tracking-wide text-slate-500">
            Reglas de prueba
            <textarea
              value={rules}
              onChange={(event) => persistRules(event.target.value, draftVersion || LIVE_DEMO_VERSION)}
              className="mt-1 h-40 w-full resize-y rounded-lg border border-white/10 bg-[#06080c] p-3 font-mono text-[11px] leading-relaxed text-slate-300"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!labPrompt}
              onClick={() => void copyText(labPrompt, 'lab')}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
            >
              {copied === 'lab' ? 'Prompt demo copiado' : 'Copiar prompt demo'}
            </button>
            <button
              type="button"
              disabled={!parts.context}
              onClick={() => void copyText(parts.context, 'context')}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40"
            >
              {copied === 'context' ? 'Contexto copiado' : 'Copiar solo el partido'}
            </button>
            <button
              type="button"
              onClick={() => persistRules(composeDemoRules(parts.rules), LIVE_DEMO_VERSION)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
            >
              Cargar demo de ritmo
            </button>
            <button
              type="button"
              disabled={!parts.rules}
              onClick={() => persistRules(parts.rules, 'minuto-original')}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40"
            >
              Reglas originales del minuto
            </button>
            {template && (
              <button
                type="button"
                onClick={() => persistRules(template.rules, template.version)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
              >
                Restaurar {template.version}
              </button>
            )}
          </div>
          <label className="mt-3 block text-[11px] uppercase tracking-wide text-slate-500">
            Resultado del sandbox
            <textarea
              value={note}
              onChange={(event) => {
                const next = event.target.value;
                setNote(next);
                writeLabNote(browserStorage(), runId, next);
              }}
              placeholder="Pega el JSON del sandbox y una línea de si te parece mejor o peor que los picks de arriba."
              className="mt-1 h-24 w-full resize-y rounded-lg border border-white/10 bg-[#06080c] p-3 text-xs leading-relaxed text-slate-300 placeholder:text-slate-600"
            />
          </label>
        </>
      )}
    </section>
  );
}

function LabChanges({ template }: { template: LivePromptLabTemplate }) {
  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium text-violet-200">
        {template.title}
        <span className="ml-2 text-slate-500">{template.note}</span>
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-slate-400">
        {template.changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
    </div>
  );
}
