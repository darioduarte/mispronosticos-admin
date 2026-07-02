'use client';

import { useEffect, useState } from 'react';
import { ApiError, createSuscripcion, updateSuscripcion } from '@/lib/api';
import type { SuscripcionRow, SuscripcionSavePayload } from '@/lib/types';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  row: SuscripcionRow | null;
  productos: { android: string[]; ios: string[] };
  onClose: () => void;
  onSaved: () => void;
};

function toInputDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SuscripcionModal({ open, mode, row, productos, onClose, onSaved }: Props) {
  const [email, setEmail] = useState('');
  const [app, setApp] = useState<'ios' | 'android'>('android');
  const [productId, setProductId] = useState('premiumsemanal');
  const [environment, setEnvironment] = useState('temporary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState('30');
  const [useDays, setUseDays] = useState(true);
  const [origTxId, setOrigTxId] = useState('');
  const [isCancelled, setIsCancelled] = useState(false);
  const [fake, setFake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && row) {
      setEmail(row.userEmail || '');
      setApp((row.app === 'ios' ? 'ios' : 'android') as 'ios' | 'android');
      setProductId(row.productId || 'premiumsemanal');
      setEnvironment(row.environment || 'temporary');
      setStartDate(toInputDate(row.startDate));
      setEndDate(toInputDate(row.endDate));
      setUseDays(false);
      setOrigTxId(row.orig_tx_id || '');
      setIsCancelled(row.isCancelled);
      setFake(row.fake);
    } else {
      setEmail('');
      setApp('android');
      setProductId('premiumsemanal');
      setEnvironment('temporary');
      setStartDate('');
      setEndDate('');
      setDays('30');
      setUseDays(true);
      setOrigTxId('');
      setIsCancelled(false);
      setFake(false);
    }
  }, [open, mode, row]);

  const planOptions = app === 'ios' ? productos.ios : productos.android;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: SuscripcionSavePayload = {
        app,
        productId,
        environment,
        isCancelled,
        fake,
      };
      if (origTxId.trim()) payload.orig_tx_id = origTxId.trim();
      if (startDate) payload.startDate = startDate;
      if (useDays && days.trim()) payload.days = parseInt(days, 10);
      else if (endDate) payload.endDate = endDate;

      if (mode === 'create') {
        if (!email.trim()) throw new ApiError('Email requerido', 400);
        payload.email = email.trim();
        await createSuscripcion(payload);
      } else if (row) {
        await updateSuscripcion(row.id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#111827] p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {mode === 'create' ? 'Nueva suscripción manual' : 'Editar suscripción'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Crea o ajusta suscripciones iOS/Android sin pasar por la tienda.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'create' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Email del usuario</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@email.com"
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              />
            </label>
          )}

          {mode === 'edit' && row && (
            <div className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-300">
              <p>{row.userEmail || '—'}</p>
              <p className="text-xs text-slate-500">{row.userName || row.userId}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Plataforma</span>
              <select
                value={app}
                onChange={(e) => {
                  const next = e.target.value as 'ios' | 'android';
                  setApp(next);
                  const opts = next === 'ios' ? productos.ios : productos.android;
                  if (!opts.includes(productId)) setProductId(opts[0] || 'mensual');
                }}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              >
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Plan (productId)</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              >
                {planOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Entorno</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              <option value="temporary">temporary (manual)</option>
              <option value="production">production</option>
              <option value="sandbox">sandbox</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Inicio</span>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>

          {mode === 'create' && (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={useDays}
                onChange={(e) => setUseDays(e.target.checked)}
              />
              Calcular fin por días
            </label>
          )}

          {useDays ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Duración (días)</span>
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-400">Fin</span>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">
              ID transacción (opcional)
            </span>
            <input
              type="text"
              value={origTxId}
              onChange={(e) => setOrigTxId(e.target.value)}
              placeholder="manual-… o purchase token"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>

          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isCancelled}
                onChange={(e) => setIsCancelled(e.target.checked)}
              />
              Cancelada
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fake}
                onChange={(e) => setFake(e.target.checked)}
              />
              Fake (excluida de validaciones)
            </label>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy ? 'Guardando…' : mode === 'create' ? 'Crear suscripción' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
