'use client';

import { useState } from 'react';

type Props = {
  text: string | null | undefined;
  /** Texto adicional para el botón «Copiar caso» (bloque completo). */
  caseText?: string | null;
  clampClassName?: string;
  className?: string;
};

function looksLong(value: string) {
  return value.length > 42 || value.split(/\s+/).filter(Boolean).length > 6;
}

export function ExpandableText({
  text,
  caseText,
  clampClassName = 'line-clamp-2',
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<'text' | 'case' | null>(null);
  const value = text != null ? String(text).trim() : '';

  if (!value) {
    return <span className="text-slate-600">—</span>;
  }

  const canExpand = looksLong(value);
  const caseValue = caseText != null ? String(caseText).trim() : '';

  async function copy(kind: 'text' | 'case', payload: string) {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={className}>
      <div
        className={`break-words text-slate-300 ${expanded || !canExpand ? 'whitespace-normal' : clampClassName}`}
      >
        {value}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium text-indigo-300 hover:text-indigo-200"
          >
            {expanded ? 'Ver menos' : 'Ver más'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => copy('text', value)}
          className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
        >
          {copied === 'text' ? 'Copiado' : 'Copiar'}
        </button>
        {caseValue ? (
          <button
            type="button"
            onClick={() => copy('case', caseValue)}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
            title="Copia fecha, partido, liga y pronóstico para pegarlo en el chat"
          >
            {copied === 'case' ? 'Caso copiado' : 'Copiar caso'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function buildPronosticoCaseText(parts: {
  fecha?: string | null;
  local?: string | null;
  visitante?: string | null;
  liga?: string | null;
  pais?: string | null;
  fase?: string | null;
  minuto?: string | number | null;
  tipo?: string | null;
  pronostico?: string | null;
  categoria?: string | null;
}) {
  const match = [parts.local, parts.visitante].filter(Boolean).join(' vs ');
  const faseLine =
    parts.fase || parts.minuto != null
      ? `${parts.fase || ''}${parts.minuto != null && parts.minuto !== '' ? `\t${parts.minuto}` : ''}`.trim()
      : '';
  const tipo = parts.tipo != null ? String(parts.tipo).trim() : '';
  const pron = parts.pronostico != null ? String(parts.pronostico).trim() : '';
  const pickLines =
    tipo && pron && tipo !== pron ? [tipo, pron] : [tipo || pron].filter(Boolean);

  return [
    parts.fecha,
    match || null,
    parts.liga,
    parts.pais,
    faseLine || null,
    ...pickLines,
    parts.categoria || null,
  ]
    .map((x) => (x == null ? '' : String(x).trim()))
    .filter(Boolean)
    .join('\n');
}
