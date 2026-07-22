'use client';

import { useEffect, useState } from 'react';
import { ApiError, createTrial, updateTrial } from '@/lib/api';
import type { TrialRow, TrialSavePayload } from '@/lib/types';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  row: TrialRow | null;
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

export function TrialModal({ open, mode, row, onClose, onSaved }: Props) {
  const [email, setEmail] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState('2');
  const [useDays, setUseDays] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && row) {
      setEmail(row.userEmail || '');
      setDeviceId(row.deviceId || '');
      setStartDate(toInputDate(row.startDate));
      setEndDate(toInputDate(row.endDate));
      setUseDays(false);
      setIsActive(row.isActive);
    } else {
      setEmail('');
      setDeviceId('');
      setStartDate('');
      setEndDate('');
      setDays('2');
      setUseDays(true);
      setIsActive(true);
    }
  }, [open, mode, row]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: TrialSavePayload = { isActive };
      if (deviceId.trim()) payload.deviceId = deviceId.trim();
      if (startDate) payload.startDate = startDate;
      if (useDays && days.trim()) payload.days = parseInt(days, 10);
      else if (endDate) payload.endDate = endDate;

      if (mode === 'create') {
        if (!email.trim()) throw new ApiError('Email requerido', 400);
        payload.email = email.trim();
        await createTrial(payload);
      } else if (row) {
        await updateTrial(row.id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    if (!row) return;
    if (!window.confirm('¿Desactivar este trial? El usuario perderá el acceso de prueba.')) return;
    setBusy(true);
    setError(null);
    try {
      await updateTrial(row.id, { isActive: false });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo desactivar');
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
              {mode === 'create' ? 'Nuevo trial' : 'Editar trial'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Gestiona trials de prueba gratuita (TrialSubscriptions).
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
              {row.hasSubscriptionHistory && (
                <p className="mt-1 text-xs text-amber-300">
                  Tiene historial de suscripción: en la app el trial efectivo suele verse inactivo.
                </p>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">
              Device ID {mode === 'create' ? '(opcional)' : ''}
            </span>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder={mode === 'create' ? 'Se genera admin-… si se deja vacío' : ''}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
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

          <div className="rounded-lg border border-white/10 p-3">
            <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={useDays}
                onChange={(e) => setUseDays(e.target.checked)}
              />
              Definir duración en días (desde inicio)
            </label>
            {useDays ? (
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              />
            ) : (
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Trial activo (isActive)
          </label>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {mode === 'edit' && row?.isActive ? (
              <button
                type="button"
                disabled={busy}
                onClick={onDeactivate}
                className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                Desactivar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
