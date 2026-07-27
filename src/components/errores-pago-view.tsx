'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, fetchPaymentErrors, resolvePaymentError } from '@/lib/api';
import type { PaymentErrorRow } from '@/lib/types';

const ERROR_TYPES = [
  { value: 'todas', label: 'Todos' },
  { value: 'purchase_failed', label: 'Compra fallida' },
  { value: 'receipt_validation_failed', label: 'Validación de recibo' },
  { value: 'subscription_update_failed', label: 'Actualización de suscripción' },
  { value: 'network_error', label: 'Error de red' },
  { value: 'foreign_key_error', label: 'Error de FK' },
  { value: 'temporary_user_blocked', label: 'Usuario temporal bloqueado' },
  { value: 'unknown_error', label: 'Error desconocido' },
];

const APP_TYPES = [
  { value: 'todas', label: 'Todas' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
];

const RESOLVED_FILTERS = [
  { value: 'todas', label: 'Todos' },
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'resueltos', label: 'Resueltos' },
];

const ENVIRONMENTS = [
  { value: 'todas', label: 'Todos' },
  { value: 'production', label: 'Production' },
  { value: 'development', label: 'Development' },
];

const TYPE_COLORS: Record<string, string> = {
  purchase_failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  receipt_validation_failed: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  subscription_update_failed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  network_error: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  foreign_key_error: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  temporary_user_blocked: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  unknown_error: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

function TypeBadge({ row }: { row: PaymentErrorRow }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
        TYPE_COLORS[row.errorType] || 'border-white/10 text-slate-400'
      }`}
    >
      {row.errorTypeLabel}
    </span>
  );
}

function truncate(text: string, max = 120) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatJson(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DetailModal({
  row,
  busy,
  notes,
  onNotesChange,
  onClose,
  onResolve,
  onReopen,
}: {
  row: PaymentErrorRow;
  busy: boolean;
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onResolve: () => void;
  onReopen: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Error de pago</h2>
            <p className="mt-1 text-sm text-slate-400">
              {row.timestampDisplay || '—'} · {row.appTypeLabel}
              {row.environment ? ` · ${row.environment}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge row={row} />
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                row.resolved
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
              }`}
            >
              {row.resolved ? 'Resuelto' : 'Pendiente'}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Usuario</p>
              <p className="mt-1 text-slate-200">{row.userName || '—'}</p>
              <p className="text-slate-400">{row.userEmail || row.userId || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Producto</p>
              <p className="mt-1 break-all text-slate-200">{row.productId || '—'}</p>
              <p className="break-all text-xs text-slate-500">
                Tx: {row.transactionId || '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mensaje</p>
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 text-slate-200">
              {row.errorMessage || '—'}
            </p>
          </div>

          {row.errorStack ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Stack</p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 font-mono text-xs text-slate-400">
                {row.errorStack}
              </pre>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Request</p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 font-mono text-xs text-slate-400">
                {formatJson(row.requestData)}
              </pre>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Response</p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 font-mono text-xs text-slate-400">
                {formatJson(row.responseData)}
              </pre>
            </div>
          </div>

          {row.deviceInfo ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dispositivo</p>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-[#0c1017] px-4 py-3 font-mono text-xs text-slate-400">
                {formatJson(row.deviceInfo)}
              </pre>
            </div>
          ) : null}

          {row.purchaseToken ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Purchase token
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-400">{row.purchaseToken}</p>
            </div>
          ) : null}

          <div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Notas admin
              </span>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                rows={3}
                placeholder="Notas sobre la revisión o solución…"
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
            {row.resolved ? (
              <button
                type="button"
                disabled={busy}
                onClick={onReopen}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                {busy ? 'Guardando…' : 'Reabrir'}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onResolve}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? 'Guardando…' : 'Marcar resuelto'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErroresPagoView() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [errorType, setErrorType] = useState('todas');
  const [appType, setAppType] = useState('todas');
  const [environment, setEnvironment] = useState('todas');
  const [resolved, setResolved] = useState('pendientes');
  const [applied, setApplied] = useState({
    email: '',
    search: '',
    errorType: 'todas',
    appType: 'todas',
    environment: 'todas',
    resolved: 'pendientes',
  });
  const [selected, setSelected] = useState<PaymentErrorRow | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['payment-errors', applied],
    queryFn: () =>
      fetchPaymentErrors({
        email: applied.email || undefined,
        search: applied.search || undefined,
        errorType: applied.errorType,
        appType: applied.appType,
        environment: applied.environment,
        resolved: applied.resolved,
        limit: 100,
      }),
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const byErrorType = meta?.byErrorType ?? {};

  function applyFilters() {
    setApplied({
      email: email.trim().toLowerCase(),
      search: search.trim(),
      errorType,
      appType,
      environment,
      resolved,
    });
  }

  function openDetail(row: PaymentErrorRow) {
    setSelected(row);
    setNotes(row.notes || '');
    setActionError(null);
  }

  async function saveResolved(nextResolved: boolean) {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await resolvePaymentError(selected.id, {
        notes: notes.trim() || undefined,
        resolved: nextResolved,
      });
      if (res.data) {
        setSelected(res.data);
        setNotes(res.data.notes || '');
      }
      await queryClient.invalidateQueries({ queryKey: ['payment-errors'] });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo actualizar el log');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Errores de pago</h1>
        <p className="mt-1 text-sm text-slate-500">
          Logs de IAP / suscripciones (tabla PaymentErrorLogs).
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Email exacto</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="mensaje, producto, tx…"
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Tipo</span>
            <select
              value={errorType}
              onChange={(e) => setErrorType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {ERROR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Plataforma</span>
            <select
              value={appType}
              onChange={(e) => setAppType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {APP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Estado</span>
            <select
              value={resolved}
              onChange={(e) => setResolved(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {RESOLVED_FILTERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Entorno</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              {ENVIRONMENTS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Buscar
          </button>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-[#111827] px-3 py-1 text-slate-400">
          Total: <strong className="text-slate-200">{meta?.total ?? '—'}</strong>
        </span>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-300">
          Pendientes: {meta?.pendingCount ?? 0}
        </span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
          Resueltos: {meta?.resolvedCount ?? 0}
        </span>
        {ERROR_TYPES.filter((t) => t.value !== 'todas').map((t) =>
          (byErrorType[t.value] ?? 0) > 0 ? (
            <span
              key={t.value}
              className={`rounded-full border px-3 py-1 ${TYPE_COLORS[t.value] || 'border-white/10 text-slate-400'}`}
            >
              {t.label}: {byErrorType[t.value]}
            </span>
          ) : null,
        )}
      </div>

      {actionError ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {actionError}
        </p>
      ) : null}

      {query.isLoading && <p className="text-slate-400">Cargando errores de pago…</p>}
      {query.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          Error al cargar. ¿Desplegaste el backend con `/api/admin/payment-errors`?
        </p>
      )}

      {!query.isLoading && !query.isError && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#111827] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Mensaje</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#0b0f14]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Sin errores de pago con estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {row.timestampDisplay || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[180px]">
                        <p className="truncate text-slate-200">{row.userName || '—'}</p>
                        <p className="truncate text-xs text-slate-500">
                          {row.userEmail || row.userId || '—'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge row={row} />
                    </td>
                    <td className="max-w-[320px] px-4 py-3 text-slate-300">
                      {truncate(row.errorMessage)}
                      {row.productId ? (
                        <p className="mt-1 truncate text-xs text-slate-500">{row.productId}</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {row.appTypeLabel}
                      {row.environment ? ` · ${row.environment}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                          row.resolved
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                            : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {row.resolved ? 'Resuelto' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(row)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <DetailModal
          row={selected}
          busy={busy}
          notes={notes}
          onNotesChange={setNotes}
          onClose={() => setSelected(null)}
          onResolve={() => saveResolved(true)}
          onReopen={() => saveResolved(false)}
        />
      ) : null}
    </div>
  );
}
