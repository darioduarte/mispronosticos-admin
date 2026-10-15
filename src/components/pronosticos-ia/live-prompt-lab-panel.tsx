'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fetchLivePromptLabTemplate } from '@/lib/api';
import {
  composeDemoRules,
  composeLiveLabPrompt,
  LIVE_DEMO_VERSION,
  parseDemoPicks,
  readLabDraft,
  readLabNote,
  splitLiveStoredPrompt,
  writeLabDraft,
  writeLabNote,
  type DemoPick,
} from '@/lib/live-prompt-lab';
import type { LiveAnalysisPick, LivePromptLabTemplate } from '@/lib/types';

type Props = {
  runId: string;
  prompt: string | null | undefined;
  picks: LiveAnalysisPick[];
};

function browserStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function LivePromptLabPanel({ runId, prompt, picks }: Props) {
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
              placeholder="Pega aquí el JSON completo que devolvió el sandbox."
              className="mt-1 h-24 w-full resize-y rounded-lg border border-white/10 bg-[#06080c] p-3 text-xs leading-relaxed text-slate-300 placeholder:text-slate-600"
            />
          </label>
          <DemoCompare generated={picks} pasted={note} />
        </>
      )}
    </section>
  );
}

function DemoCompare({ generated, pasted }: { generated: LiveAnalysisPick[]; pasted: string }) {
  const parsed = parseDemoPicks(pasted);
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <PickColumn
        title="Generados en la app"
        empty="Este minuto no publicó pronósticos."
        picks={generated.map((pick) => ({
          tipo: pick.tipo,
          probabilidad: pick.probabilidad,
          cuota: pick.cuota_decimal,
          explicacion: pick.explicacion,
        }))}
      />
      <PickColumn
        title="Demo pegada"
        empty={parsed.error || 'Pega el JSON del sandbox para verlos aquí.'}
        picks={parsed.picks}
        accent
      />
    </div>
  );
}

function PickColumn({
  title,
  empty,
  picks,
  accent = false,
}: {
  title: string;
  empty: string;
  picks: DemoPick[];
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'border-violet-400/30 bg-violet-500/5' : 'border-white/10 bg-[#0b0f14]'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
        <span className="ml-2 text-slate-500">{picks.length}</span>
      </p>
      {picks.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {picks.map((pick, index) => (
            <li key={`${pick.tipo}-${index}`} className="rounded-md border border-white/5 bg-[#151b24] p-2">
              <p className="text-xs font-medium text-white">{pick.tipo}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {pick.probabilidad != null ? `${pick.probabilidad}%` : 'sin probabilidad'}
                {pick.cuota != null ? ` · cuota ${pick.cuota}` : ''}
              </p>
              {pick.explicacion && (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{pick.explicacion}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
