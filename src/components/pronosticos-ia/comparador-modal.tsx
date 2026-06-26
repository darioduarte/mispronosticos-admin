'use client';

import { useState } from 'react';
import { comparePronosticosPegados } from '@/lib/api';
import type { ComparadorResponse, ComparadorRow } from '@/lib/types';

type Props = {
  fixtureId: number;
  matchLabel: string;
  onClose: () => void;
};

export function ComparadorModal({ fixtureId, matchLabel, onClose }: Props) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ComparadorResponse | null>(null);

  async function handleCompare() {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setError('Pega el JSON completo.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const data = await comparePronosticosPegados(fixtureId, trimmed);
      if (!data.success) {
        setError(data.error || 'Error al comparar');
        return;
      }
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Comparador BD vs JSON</h2>
            <p className="mt-1 text-sm text-slate-400">{matchLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-5">
          {!result ? (
            <>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='Pega aquí el JSON de respuesta IA (con clave "pronosticos")…'
                className="h-48 w-full resize-y rounded-lg border border-white/10 bg-[#0b0f14] p-3 font-mono text-xs text-slate-200"
              />
              {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleCompare}
                  disabled={busy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {busy ? 'Comparando…' : 'Comparar'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <ComparadorResultView result={result} onBack={() => setResult(null)} />
          )}
        </div>
      </div>
    </div>
  );
}

function ComparadorResultView({
  result,
  onBack,
}: {
  result: ComparadorResponse;
  onBack: () => void;
}) {
  const meta = result.meta;
  const sp = result.summaryPersisted;
  const sg = result.summaryPegados;

  return (
    <div className="space-y-4">
      {result.analisis_general && (
        <details className="text-sm text-slate-300">
          <summary className="cursor-pointer text-amber-300">Análisis general (JSON)</summary>
          <p className="mt-2 leading-relaxed">{result.analisis_general}</p>
        </details>
      )}

      {meta && (
        <div className="rounded-lg border border-white/10 bg-[#0c1017] px-4 py-2 text-sm text-slate-300">
          <strong>Marcador:</strong> {meta.goalshome ?? '—'} – {meta.goalsaway ?? '—'} ·{' '}
          <strong>Estado:</strong> {meta.estado_partido ?? '—'}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard title="En base de datos" summary={sp} />
        <SummaryCard title="JSON pegado" summary={sg} />
      </div>

      {result.veredicto?.texto && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          <strong>Indicador:</strong> {result.veredicto.texto}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <CompareTable title="BD (guardados)" rows={result.persisted ?? []} />
        <CompareTable title="JSON (prob. descendente)" rows={result.pegados ?? []} />
      </div>

      <button
        type="button"
        onClick={onBack}
        className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
      >
        ← Volver a pegar JSON
      </button>
    </div>
  );
}

function SummaryCard({
  title,
  summary,
}: {
  title: string;
  summary?: { total: number; acertados: number; fallidos: number; pendientes: number };
}) {
  const s = summary ?? { total: 0, acertados: 0, fallidos: 0, pendientes: 0 };
  return (
    <div className="rounded-lg border border-white/10 bg-[#0c1017] p-3 text-sm text-slate-300">
      <strong className="text-slate-200">{title}</strong>
      <p className="mt-1">
        Total: {s.total} · ✓ {s.acertados} · ✗ {s.fallidos} · pend. {s.pendientes}
      </p>
    </div>
  );
}

function CompareTable({ title, rows }: { title: string; rows: ComparadorRow[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-slate-200">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-[#0c1017] text-slate-400">
            <tr>
              <th className="px-2 py-2 text-left">Mercado / texto</th>
              <th className="px-2 py-2 text-left">Prob.</th>
              <th className="px-2 py-2 text-left">Eval.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-4 text-slate-500">
                  Sin datos
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.pronostico_id ?? i} className="border-t border-white/5">
                  <td className="max-w-[180px] px-2 py-2 text-slate-300">
                    <div className="line-clamp-2">{row.pronostico}</div>
                    {row.categoria_normalizada && (
                      <span className="text-[10px] text-slate-500">{row.categoria_normalizada}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-slate-400">{row.probabilidad ?? '—'}</td>
                  <td className="px-2 py-2">
                    <EvalBadge clase={row.resultado_clase} mensaje={row.resultado_mensaje} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EvalBadge({
  clase,
  mensaje,
}: {
  clase?: string;
  mensaje?: string | null;
}) {
  const styles =
    clase === 'acertado'
      ? 'text-emerald-300'
      : clase === 'fallido'
        ? 'text-red-300'
        : 'text-slate-400';
  const label =
    clase === 'acertado' ? '✓' : clase === 'fallido' ? '✗' : '—';
  return (
    <span className={styles} title={mensaje ?? undefined}>
      {label} {mensaje && <span className="block text-[10px] opacity-80">{mensaje}</span>}
    </span>
  );
}
