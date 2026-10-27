'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, syncStorePaymentsByDate } from '@/lib/api';
import type { StorePaymentSyncItem, StorePaymentSyncResponse } from '@/lib/types';

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  would_create: { label: 'Se crearía', cls: 'text-sky-300' },
  created: { label: 'Creada', cls: 'text-emerald-300' },
  would_extend: { label: 'Se renovaría', cls: 'text-amber-300' },
  extended: { label: 'Renovada', cls: 'text-emerald-300' },
  sin_usuario: { label: 'Sin usuario', cls: 'text-red-300' },
  conflicto_usuario: { label: 'Conflicto', cls: 'text-red-300' },
  skip: { label: 'Omitida', cls: 'text-slate-500' },
  error: { label: 'Error', cls: 'text-red-400' },
};

function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function Pill({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg bg-[#0b0f14] px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${accent || 'text-slate-200'}`}>{value}</p>
    </div>
  );
}

function ResultTable({ items }: { items: StorePaymentSyncItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">Nada pendiente en esa fecha.</p>;
  }
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-white/10">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-[#0b0f14] text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Acción</th>
            <th className="px-3 py-2 text-left">Tienda</th>
            <th className="px-3 py-2 text-left">Usuario</th>
            <th className="px-3 py-2 text-left">Pedido</th>
            <th className="px-3 py-2 text-left">Vigencia</th>
            <th className="px-3 py-2 text-left">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((item, index) => {
            const meta = ACTION_LABELS[item.action] || ACTION_LABELS.error;
            return (
              <tr key={`${item.store}-${item.orderId ?? 'sin'}-${item.action}-${index}`} className="align-top">
                <td className={`px-3 py-2 font-medium ${meta.cls}`}>{meta.label}</td>
                <td className="px-3 py-2 uppercase text-slate-400">{item.store}</td>
                <td className="px-3 py-2 text-slate-300">
                  <div>{item.userEmail || '—'}</div>
                  {item.userName && <div className="text-[10px] text-slate-500">{item.userName}</div>}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  <div>{item.orderId || '—'}</div>
                  <div className="text-[10px]">{item.productId || '—'}</div>
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {item.start || '—'} → {item.end || '—'}
                </td>
                <td className="px-3 py-2 text-slate-500">{item.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StorePaymentSyncPanel() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(bogotaToday);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<StorePaymentSyncResponse | null>(null);

  async function run(dryRun: boolean) {
    if (!date) {
      setError('Elige una fecha.');
      return;
    }
    if (!dryRun) {
      const ok = window.confirm(
        `Se guardarán las compras y renovaciones del ${date} que ya traen usuario de la app. Las que no tengan usuario no se crean.`,
      );
      if (!ok) return;
    }
    setBusy(dryRun ? 'preview' : 'apply');
    setError('');
    try {
      const data = await syncStorePaymentsByDate({ date, dryRun });
      setResult(data);
      if (!dryRun) {
        queryClient.invalidateQueries({ queryKey: ['suscripciones'] });
      }
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : 'No se pudo sincronizar.');
    } finally {
      setBusy(null);
    }
  }

  const summary = result?.summary;

  return (
    <section className="mb-4 rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Sincronizar pagos del día</p>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Compara los avisos de Google Play y Apple de esa fecha con la base. Una compra nueva
            solo se guarda si la tienda trae el usuario de la app.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Fecha (Colombia)</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <button
            type="button"
            onClick={() => run(true)}
            disabled={busy !== null}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            {busy === 'preview' ? 'Analizando…' : 'Analizar'}
          </button>
          <button
            type="button"
            onClick={() => run(false)}
            disabled={busy !== null}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy === 'apply' ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && summary && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Pill label={result.dryRun ? 'Por crear' : 'Creadas'} value={result.dryRun ? summary.wouldCreate : summary.created} accent="text-emerald-300" />
            <Pill label={result.dryRun ? 'Por renovar' : 'Renovadas'} value={result.dryRun ? summary.wouldExtend : summary.extended} accent="text-amber-300" />
            <Pill label="Sin usuario" value={summary.sinUsuario} accent="text-red-300" />
            <Pill label="Conflictos" value={summary.conflicto} />
            <Pill label="Omitidas" value={summary.skipped} />
            <Pill label="Ya al día" value={summary.unchanged} />
          </div>
          <p className="text-xs text-slate-500">
            {result.nota}
            {result.truncated ? ' Se procesaron como máximo 200 avisos por tienda.' : ''}
            {' '}
            Avisos: Android {result.scanned.google}, pases {result.scanned.prepaid}, Apple {result.scanned.apple}.
            {!result.dryRun && summary.acknowledged > 0 ? ` Confirmadas en Play: ${summary.acknowledged}.` : ''}
          </p>
          <ResultTable items={result.items} />
        </div>
      )}
    </section>
  );
}
