'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { OddsSections } from '@/components/pronosticos-ia/odds-referencia-modal';
import { fetchCuotasMomento } from '@/lib/api';
import type { ErrorCuotaIaRow } from '@/lib/types';

type Props = {
  row: ErrorCuotaIaRow;
  onClose: () => void;
};

function matchLabel(row: ErrorCuotaIaRow) {
  return `${row.equipo_local || '—'} vs ${row.equipo_visitante || '—'}`;
}

function highlightTipo(text: string, tipo: string | null | undefined) {
  const needle = String(tipo || '').trim();
  if (!needle || needle.length < 3) return text;
  try {
    const re = new RegExp(
      `(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'ig',
    );
    return text.replace(re, '«$1»');
  } catch {
    return text;
  }
}

export function CuotasMomentoModal({ row, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: [
      'cuotas-momento',
      row.fuente,
      row.fixtureid,
      row.liveRunId || '',
      row.windowKey || '',
    ],
    queryFn: () =>
      fetchCuotasMomento({
        fuente: row.fuente,
        fixtureId: row.fixtureid,
        liveRunId: row.liveRunId,
        windowKey: row.windowKey,
      }),
  });

  const data = query.data;
  const isLive = row.fuente === 'vivo';
  const title = isLive ? 'Cuotas live de ese momento' : 'Cuotas prepartido';
  const subtitle = [
    matchLabel(row),
    isLive
      ? `${row.windowLabel || row.windowKey || 'fase'}${
          row.run_minute != null ? ` · min ${row.run_minute}` : ''
        }`
      : null,
    row.tipo ? `Mercado: ${row.tipo}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            {data?.source === 'prompt' && (
              <p className="mt-1 text-xs text-amber-200/80">
                {isLive
                  ? 'Tomadas del prompt guardado (no se consulta el API live).'
                  : 'Tomadas del prompt guardado del análisis.'}
              </p>
            )}
            {data?.source === 'api' && (
              <p className="mt-1 text-xs text-slate-500">Fuente: API-Football prepartido.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-5">
          {query.isLoading && <p className="text-sm text-slate-400">Cargando cuotas…</p>}
          {query.isError && (
            <p className="text-sm text-red-300">{(query.error as Error).message}</p>
          )}
          {data && !data.success && (
            <p className="text-sm text-red-300">
              {data.error || 'No se pudieron cargar las cuotas'}
            </p>
          )}
          {data?.success && data.message && (
            <p className="mb-3 text-xs text-amber-200/90">{data.message}</p>
          )}
          {data?.success && data.odds && <OddsSections odds={data.odds} />}
          {data?.success && data.oddsText && (
            <div>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void copyText(data.oddsText || '')}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
                >
                  {copied ? 'Copiado' : 'Copiar bloque'}
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs leading-relaxed text-slate-300">
                {highlightTipo(data.oddsText, row.tipo)}
              </pre>
            </div>
          )}
          {data?.success && !data.odds && !data.oddsText && (
            <p className="text-sm text-slate-400">
              {data.message || 'No hay cuotas para mostrar.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
