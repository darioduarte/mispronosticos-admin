'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, syncSuscripcionRenewals } from '@/lib/api';
import type { RenewalSyncItem, RenewalSyncResponse } from '@/lib/types';

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  unchanged: { label: 'Sin cambios', cls: 'text-slate-400' },
  would_update: { label: 'Actualizar', cls: 'text-amber-300' },
  would_create: { label: 'Nueva renovación', cls: 'text-sky-300' },
  would_cancel: { label: 'Cancelar', cls: 'text-red-300' },
  skip: { label: 'Omitida', cls: 'text-slate-500' },
  error: { label: 'Error', cls: 'text-red-400' },
  applied_update: { label: 'Actualizada', cls: 'text-emerald-300' },
  applied_cancel: { label: 'Cancelada', cls: 'text-emerald-300' },
};

function SummaryPill({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg bg-[#0b0f14] px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-semibold ${accent || 'text-slate-200'}`}>{value}</p>
    </div>
  );
}

function SyncResultTable({ items }: { items: RenewalSyncItem[] }) {
  const interesting = items.filter((i) => i.action !== 'unchanged' && i.action !== 'skip');
  const display = interesting.length > 0 ? interesting : items.slice(0, 10);

  if (!display.length) {
    return <p className="text-sm text-slate-500">No hay filas que mostrar.</p>;
  }

  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-white/10">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-[#0b0f14] text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Acción</th>
            <th className="px-3 py-2 text-left">Usuario</th>
            <th className="px-3 py-2 text-left">Plan</th>
            <th className="px-3 py-2 text-left">Google</th>
            <th className="px-3 py-2 text-left">BD</th>
            <th className="px-3 py-2 text-left">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {display.map((item) => {
            const meta = ACTION_LABELS[item.action] || ACTION_LABELS.error;
            return (
              <tr key={`${item.subscriptionId}-${item.action}`} className="align-top">
                <td className={`px-3 py-2 font-medium ${meta.cls}`}>{meta.label}</td>
                <td className="px-3 py-2 text-slate-300">
                  <div>{item.userEmail || item.userId.slice(0, 8)}</div>
                  {item.userName && (
                    <div className="text-[10px] text-slate-500">{item.userName}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-400">{item.productId || '—'}</td>
                <td className="px-3 py-2 text-slate-400">
                  {item.google ? (
                    <>
                      <div>{item.google.orderId || '—'}</div>
                      <div className="text-[10px]">
                        fin {item.google.expiryDisplay || '—'}
                        {item.google.autoRenewing ? ' · auto' : ' · sin auto'}
                      </div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {item.database ? (
                    <>
                      <div>{item.database.orderId || '—'}</div>
                      <div className="text-[10px]">
                        fin {item.database.endDate || '—'}
                        {item.database.isCancelled ? ' · cancelada' : ' · activa'}
                      </div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {item.reason}
                  {item.error && (
                    <div className="mt-1 text-[10px] text-red-400">{item.error}</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RenewalSyncPanel() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<'analyze' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenewalSyncResponse | null>(null);
  const [scope, setScope] = useState<'active' | 'all'>('active');

  async function runSync(dryRun: boolean) {
    setLoading(dryRun ? 'analyze' : 'apply');
    setError(null);
    try {
      const data = await syncSuscripcionRenewals({
        dryRun,
        scope,
        limit: 50,
        allowCreate: false,
      });
      setResult(data);
      if (!dryRun) {
        await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al sincronizar');
    } finally {
      setLoading(null);
    }
  }

  const hasApplicable =
    result &&
    (result.summary.would_update > 0 || result.summary.would_cancel > 0);

  return (
    <div className="mt-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-indigo-200">Sincronizar renovaciones Android</p>
          <p className="mt-1 text-xs text-slate-500">
            Consulta Google Play y compara con la BD. Por defecto solo analiza (no inserta ni
            duplica). Las renovaciones nuevas (would_create) se muestran pero no se crean
            automáticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as 'active' | 'all')}
            className="rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1.5 text-xs text-slate-300"
          >
            <option value="active">Solo activas (máx. 50)</option>
            <option value="all">Todas Android (máx. 50)</option>
          </select>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => runSync(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading === 'analyze' ? 'Analizando…' : 'Analizar con Google'}
          </button>
          {hasApplicable && result?.dryRun && (
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => {
                if (
                  !window.confirm(
                    `¿Aplicar ${result.summary.would_update} actualización(es) y ${result.summary.would_cancel} cancelación(es)? No se crearán filas nuevas.`,
                  )
                ) {
                  return;
                }
                runSync(false);
              }}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"
            >
              {loading === 'apply' ? 'Aplicando…' : 'Aplicar cambios seguros'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <SummaryPill label="Analizadas" value={result.scanned} />
            <SummaryPill label="Sin cambio" value={result.summary.unchanged} accent="text-slate-400" />
            <SummaryPill label="Actualizar" value={result.summary.would_update} accent="text-amber-300" />
            <SummaryPill label="Renov. nuevas" value={result.summary.would_create} accent="text-sky-300" />
            <SummaryPill label="Cancelar" value={result.summary.would_cancel} accent="text-red-300" />
            <SummaryPill
              label={result.dryRun ? 'Errores' : 'Aplicadas'}
              value={result.dryRun ? result.summary.error : result.summary.applied}
              accent={result.dryRun ? 'text-red-400' : 'text-emerald-300'}
            />
          </div>
          <p className="mb-3 text-[11px] text-slate-500">{result.nota}</p>
          <SyncResultTable items={result.items} />
        </>
      )}
    </div>
  );
}
