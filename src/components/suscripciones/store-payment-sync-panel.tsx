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

function isSelectable(item: StorePaymentSyncItem) {
  return (item.action === 'would_create' || item.action === 'would_extend') && Boolean(item.orderId);
}

function itemKey(item: StorePaymentSyncItem) {
  return `${item.store}|${item.orderId}`;
}

function ResultTable({
  items,
  checked,
  onToggle,
}: {
  items: StorePaymentSyncItem[];
  checked: Set<string>;
  onToggle: (item: StorePaymentSyncItem) => void;
}) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">Nada pendiente en esa fecha.</p>;
  }
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-white/10">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-[#0b0f14] text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Incluir</th>
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
            const selectable = isSelectable(item);
            return (
              <tr key={`${item.store}-${item.orderId ?? 'sin'}-${item.action}-${index}`} className="align-top">
                <td className="px-3 py-2">
                  {selectable ? (
                    <input
                      type="checkbox"
                      checked={checked.has(itemKey(item))}
                      onChange={() => onToggle(item)}
                      aria-label={`Incluir ${item.orderId}`}
                      className="accent-indigo-500"
                    />
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
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

type ApplyMode = 'all' | 'create' | 'renew' | 'custom';

function keysFor(items: StorePaymentSyncItem[], mode: 'all' | 'create' | 'renew') {
  return items.filter((item) => {
    if (!isSelectable(item)) return false;
    if (mode === 'create') return item.action === 'would_create';
    if (mode === 'renew') return item.action === 'would_extend';
    return true;
  }).map(itemKey);
}

export function StorePaymentSyncPanel() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(bogotaToday);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<StorePaymentSyncResponse | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ApplyMode>('all');

  const selected = (result?.items || []).filter(
    (item) => isSelectable(item) && checked.has(itemKey(item)),
  );
  const selectedCreates = selected.filter((item) => item.action === 'would_create').length;
  const selectedRenews = selected.filter((item) => item.action === 'would_extend').length;

  function choose(next: 'all' | 'create' | 'renew') {
    if (!result) return;
    setMode(next);
    setChecked(new Set(keysFor(result.items, next)));
  }

  function toggle(item: StorePaymentSyncItem) {
    setMode('custom');
    setChecked((current) => {
      const next = new Set(current);
      const key = itemKey(item);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function run(dryRun: boolean) {
    if (!date) {
      setError('Elige una fecha.');
      return;
    }
    if (!dryRun && selected.length === 0) {
      setError('Analiza la fecha y marca al menos una compra nueva o una renovación.');
      return;
    }
    if (!dryRun) {
      const message = mode === 'create'
        ? `Se guardarán solo las compras nuevas del ${date} (${selectedCreates}). Las renovaciones no se tocan.`
        : mode === 'renew'
          ? `Se alargarán solo las renovaciones del ${date} (${selectedRenews}). No se crean compras nuevas.`
          : mode === 'custom'
            ? `Se guardarán ${selectedCreates} compras nuevas y ${selectedRenews} renovaciones marcadas del ${date}.`
            : `Se guardarán las compras nuevas (${selectedCreates}) y las renovaciones (${selectedRenews}) del ${date} que ya traen usuario.`;
      if (!window.confirm(message)) return;
    }
    setBusy(dryRun ? 'preview' : 'apply');
    setError('');
    try {
      const data = dryRun
        ? await syncStorePaymentsByDate({ date, dryRun: true })
        : mode === 'create'
          ? await syncStorePaymentsByDate({ date, dryRun: false, scope: 'create' })
          : mode === 'renew'
            ? await syncStorePaymentsByDate({ date, dryRun: false, scope: 'renew' })
            : mode === 'custom'
              ? await syncStorePaymentsByDate({
                date,
                dryRun: false,
                selection: selected.map((item) => ({
                  store: item.store,
                  orderId: item.orderId || '',
                })),
              })
              : await syncStorePaymentsByDate({ date, dryRun: false });
      setResult(data);
      if (dryRun) {
        setMode('all');
        setChecked(new Set(keysFor(data.items, 'all')));
      } else {
        setMode('custom');
        setChecked(new Set());
        queryClient.invalidateQueries({ queryKey: ['suscripciones'] });
      }
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : 'No se pudo sincronizar.');
    } finally {
      setBusy(null);
    }
  }

  const syncLabel = mode === 'create'
    ? 'Sincronizar por crear'
    : mode === 'renew'
      ? 'Sincronizar renovaciones'
      : mode === 'custom'
        ? 'Sincronizar marcadas'
        : 'Sincronizar todas';

  const summary = result?.summary;

  return (
    <section className="mb-4 rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">Sincronizar pagos del día</p>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Compara los avisos de Google Play y Apple de esa fecha con la base. Puedes guardar
            solo las compras nuevas, solo las renovaciones, o las filas que marques.
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
            disabled={busy !== null || selected.length === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy === 'apply' ? 'Sincronizando…' : syncLabel}
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
            {!result.dryRun && summary.wouldCreate > 0 && (
              <Pill label="Aún por crear" value={summary.wouldCreate} accent="text-sky-300" />
            )}
            {!result.dryRun && summary.wouldExtend > 0 && (
              <Pill label="Aún por renovar" value={summary.wouldExtend} accent="text-amber-300" />
            )}
            <Pill label="Sin usuario" value={summary.sinUsuario} accent="text-red-300" />
            <Pill label="Conflictos" value={summary.conflicto} />
            <Pill label="Omitidas" value={summary.skipped} />
            <Pill label="Ya al día" value={summary.unchanged} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => choose('all')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === 'all' ? 'bg-indigo-600 text-white' : 'border border-white/10 text-slate-300'}`}>Todas</button>
            <button type="button" onClick={() => choose('create')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === 'create' ? 'bg-indigo-600 text-white' : 'border border-white/10 text-slate-300'}`}>Por crear</button>
            <button type="button" onClick={() => choose('renew')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === 'renew' ? 'bg-indigo-600 text-white' : 'border border-white/10 text-slate-300'}`}>Renovaciones</button>
          </div>
          <p className="text-xs text-slate-500">
            {result.nota}
            {result.truncated ? ' Se procesaron como máximo 200 avisos por tienda.' : ''}
            {' '}
            Avisos: Android {result.scanned.google}, pases {result.scanned.prepaid}, Apple {result.scanned.apple}.
            {!result.dryRun && summary.acknowledged > 0 ? ` Confirmadas en Play: ${summary.acknowledged}.` : ''}
          </p>
          <ResultTable items={result.items} checked={checked} onToggle={toggle} />
        </div>
      )}
    </section>
  );
}
