'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  fetchPaymentWebhookEvents,
  replayPaymentWebhookEvent,
  triggerPaymentWebhookRenewal,
} from '@/lib/api';
import type { PaymentWebhookActionResponse, PaymentWebhookEventRow } from '@/lib/types';

function JsonPreview({ value }: { value: unknown }) {
  if (value == null) return <p className="text-sm text-slate-500">Sin datos.</p>;
  return (
    <pre className="max-h-72 overflow-auto rounded-lg bg-[#0b0f14] p-3 text-xs text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function WebhooksPagoView() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('all');
  const [provider, setProvider] = useState('all');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [purchaseToken, setPurchaseToken] = useState('');
  const [productId, setProductId] = useState('');
  const [result, setResult] = useState<PaymentWebhookActionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const eventsQuery = useQuery({
    queryKey: ['payment-webhook-events', status, provider],
    queryFn: () =>
      fetchPaymentWebhookEvents({
        status,
        provider,
        limit: 30,
      }),
  });

  async function runAction(
    fn: () => Promise<PaymentWebhookActionResponse>,
    invalidate = true,
  ) {
    setBusy(true);
    setError('');
    try {
      const data = await fn();
      setResult(data);
      if (invalidate) {
        await queryClient.invalidateQueries({ queryKey: ['payment-webhook-events'] });
      }
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : 'Error ejecutando acción');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Webhooks de pago</h1>
        <p className="mt-1 text-sm text-slate-400">
          Prueba renovaciones reales desde admin: preview primero (dry run) y luego aplicar.
          Android consulta Google Play; iOS usa replay de eventos Apple guardados.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 bg-[#111820] p-4">
        <h2 className="text-sm font-semibold text-slate-200">Renovación Android por suscripción</h2>
        <p className="mt-1 text-xs text-slate-500">
          Pega el ID de la fila en Subscriptions. El panel compara/aplica contra Google Play.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={subscriptionId}
            onChange={(e) => setSubscriptionId(e.target.value)}
            placeholder="subscriptionId (UUID)"
            className="min-w-[280px] flex-1 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
          />
          <button
            type="button"
            disabled={busy || !subscriptionId.trim()}
            onClick={() =>
              runAction(() =>
                triggerPaymentWebhookRenewal({
                  subscriptionId: subscriptionId.trim(),
                  dryRun: true,
                }),
              )
            }
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Analizar
          </button>
          <button
            type="button"
            disabled={busy || !subscriptionId.trim()}
            onClick={() =>
              runAction(() =>
                triggerPaymentWebhookRenewal({
                  subscriptionId: subscriptionId.trim(),
                  dryRun: false,
                }),
              )
            }
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#111820] p-4">
        <h2 className="text-sm font-semibold text-slate-200">Renovación Android RTDN directo</h2>
        <p className="mt-1 text-xs text-slate-500">
          Usa purchaseToken + productId reales. Ejecuta la misma lógica que el webhook Google RENEWED.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            value={purchaseToken}
            onChange={(e) => setPurchaseToken(e.target.value)}
            placeholder="purchaseToken"
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
          />
          <input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="productId (mensual, semanal, ...)"
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !purchaseToken.trim() || !productId.trim()}
            onClick={() =>
              runAction(() =>
                triggerPaymentWebhookRenewal({
                  purchaseToken: purchaseToken.trim(),
                  productId: productId.trim(),
                  dryRun: true,
                }),
              )
            }
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Analizar RTDN
          </button>
          <button
            type="button"
            disabled={busy || !purchaseToken.trim() || !productId.trim()}
            onClick={() =>
              runAction(() =>
                triggerPaymentWebhookRenewal({
                  purchaseToken: purchaseToken.trim(),
                  productId: productId.trim(),
                  dryRun: false,
                }),
              )
            }
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Aplicar RTDN
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <section className="rounded-xl border border-white/10 bg-[#111820] p-4">
          <h2 className="text-sm font-semibold text-slate-200">Resultado</h2>
          {result.note && <p className="mt-1 text-xs text-amber-300">{result.note}</p>}
          <div className="mt-3">
            <JsonPreview value={result.preview ?? result.result ?? result} />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-white/10 bg-[#111820] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-200">PaymentWebhookEvents</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">Todos los estados</option>
              <option value="failed">failed</option>
              <option value="processed">processed</option>
              <option value="processing">processing</option>
            </select>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">Todos</option>
              <option value="google">Google</option>
              <option value="apple">Apple</option>
            </select>
          </div>
        </div>

        {eventsQuery.isLoading && (
          <p className="mt-4 text-sm text-slate-500">Cargando eventos…</p>
        )}
        {eventsQuery.error && (
          <p className="mt-4 text-sm text-red-300">
            Error al cargar. ¿Desplegaste backend + admin con `/api/admin/payment-webhooks`?
          </p>
        )}

        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">Proveedor</th>
                <th className="px-2 py-2 text-left">Estado</th>
                <th className="px-2 py-2 text-left">Event ID</th>
                <th className="px-2 py-2 text-left">Recibido</th>
                <th className="px-2 py-2 text-left">Error</th>
                <th className="px-2 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {(eventsQuery.data?.items || []).map((row: PaymentWebhookEventRow) => (
                <tr key={row.id}>
                  <td className="px-2 py-2">{row.provider}</td>
                  <td className="px-2 py-2">{row.status}</td>
                  <td className="px-2 py-2 font-mono">{row.eventId.slice(0, 24)}…</td>
                  <td className="px-2 py-2">{row.receivedAtDisplay || '—'}</td>
                  <td className="max-w-xs truncate px-2 py-2 text-red-300">
                    {row.lastError || '—'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(() =>
                            replayPaymentWebhookEvent(row.id, { dryRun: true }),
                          )
                        }
                        className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-50"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          runAction(() =>
                            replayPaymentWebhookEvent(row.id, { dryRun: false }),
                          )
                        }
                        className="rounded bg-indigo-600 px-2 py-1 hover:bg-indigo-500 disabled:opacity-50"
                      >
                        Replay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
