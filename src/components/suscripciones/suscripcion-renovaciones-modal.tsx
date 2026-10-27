'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, fetchSuscripcionRenovaciones } from '@/lib/api';
import type { SuscripcionRow } from '@/lib/types';

const ROLE_LABELS = {
  alta: 'Alta',
  renovacion: 'Renovación',
};

export function SuscripcionRenovacionesModal({
  row,
  onClose,
}: {
  row: SuscripcionRow | null;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ['suscripcion-renovaciones', row?.id],
    queryFn: () => fetchSuscripcionRenovaciones(row?.id || ''),
    enabled: Boolean(row?.id),
  });

  if (!row) return null;
  const data = query.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/10 bg-[#111827] p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Renovaciones</h2>
            <p className="mt-1 text-sm text-slate-300">{row.userEmail || row.userId}</p>
            <p className="text-xs text-slate-500">
              {row.productId || 'Sin plan'} · {(row.app || '').toUpperCase()}
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

        {query.isLoading && <p className="text-sm text-slate-400">Cargando renovaciones…</p>}
        {query.isError && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {query.error instanceof ApiError ? query.error.message : 'No se pudieron cargar las renovaciones.'}
          </p>
        )}

        {data && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">{data.nota}</p>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#0b0f14] text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Pedido</th>
                    <th className="px-3 py-2">Inicio</th>
                    <th className="px-3 py-2">Fin</th>
                    <th className="px-3 py-2">Renovación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.rows.map((item) => (
                    <tr key={item.id} className={item.current ? 'bg-indigo-500/10' : undefined}>
                      <td className="px-3 py-2 text-slate-200">
                        {ROLE_LABELS[item.role]}
                        {item.current && <span className="ml-2 text-[10px] text-indigo-300">esta fila</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{item.orderId || '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{item.start || '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{item.end || '—'}</td>
                      <td className="px-3 py-2 text-slate-400">{item.isCancelled ? 'No renueva' : 'Automática'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-200">Avisos de la tienda</p>
              {data.avisos.length === 0 ? (
                <p className="text-sm text-slate-500">No hay avisos de renovación para esta compra.</p>
              ) : (
                <div className="max-h-64 overflow-auto rounded-lg border border-white/10">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#0b0f14] text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Cuándo</th>
                        <th className="px-3 py-2">Tienda</th>
                        <th className="px-3 py-2">Aviso</th>
                        <th className="px-3 py-2">Pedido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.avisos.map((aviso, index) => (
                        <tr key={`${aviso.at}-${aviso.label}-${index}`}>
                          <td className="px-3 py-2 text-slate-300">{aviso.at || '—'}</td>
                          <td className="px-3 py-2 uppercase text-slate-500">{aviso.store}</td>
                          <td className="px-3 py-2 text-slate-200">{aviso.label}</td>
                          <td className="px-3 py-2 text-slate-500">{aviso.orderId || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.truncated && (
                <p className="mt-2 text-xs text-amber-300">Hay más avisos de los que se pudieron revisar en este periodo.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
