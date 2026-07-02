'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary, ApiError } from '@/lib/api';

function fmt(n: number | undefined) {
  return (n ?? 0).toLocaleString('es-CO');
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function KpiCard({
  label,
  value,
  hint,
  accent = 'indigo',
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'indigo' | 'emerald' | 'sky' | 'amber';
}) {
  const colors = {
    indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[accent]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {hint && <p className="mt-2 text-xs opacity-70">{hint}</p>}
    </div>
  );
}

function PlatformBar({
  label,
  ios,
  android,
  totalLabel,
}: {
  label: string;
  ios: number;
  android: number;
  totalLabel?: string;
}) {
  const total = ios + android;
  const iosPct = pct(ios, total);
  const androidPct = pct(android, total);
  return (
    <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-sm text-slate-400">
          {totalLabel ?? fmt(total)}
        </p>
      </div>
      <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-[#0b0f14]">
        <div className="bg-sky-500" style={{ width: `${iosPct}%` }} title={`iOS ${iosPct}%`} />
        <div className="bg-emerald-500" style={{ width: `${androidPct}%` }} title={`Android ${androidPct}%`} />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> iOS {fmt(ios)} ({iosPct}%)
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Android {fmt(android)} ({androidPct}%)
        </span>
      </div>
    </div>
  );
}

function ActividadHoyTable({
  actividad,
}: {
  actividad: {
    fecha: string;
    compras: { total: number; ios: number; android: number };
    renovaciones: { total: number; ios: number; android: number };
    total: { ios: number; android: number; all: number };
    nota: string;
  };
}) {
  const rows = [
    {
      label: 'Compras',
      ios: actividad.compras.ios,
      android: actividad.compras.android,
      total: actividad.compras.total,
      cls: 'text-emerald-300',
    },
    {
      label: 'Renovaciones',
      ios: actividad.renovaciones.ios,
      android: actividad.renovaciones.android,
      total: actividad.renovaciones.total,
      cls: 'text-sky-300',
    },
    {
      label: 'Total día',
      ios: actividad.total.ios,
      android: actividad.total.android,
      total: actividad.total.all,
      cls: 'text-white font-semibold',
    },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">
          Actividad del día ({actividad.fecha})
        </p>
        <p className="text-xs text-slate-500">Hora referencia: America/Bogotá</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="pb-2 text-left">Tipo</th>
              <th className="pb-2 text-right">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500" /> iOS
                </span>
              </th>
              <th className="pb-2 text-right">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Android
                </span>
              </th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-2.5 text-slate-300">{row.label}</td>
                <td className={`py-2.5 text-right ${row.cls}`}>{fmt(row.ios)}</td>
                <td className={`py-2.5 text-right ${row.cls}`}>{fmt(row.android)}</td>
                <td className={`py-2.5 text-right ${row.cls}`}>{fmt(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-600">{actividad.nota}</p>
    </div>
  );
}

function TrendChart({ rows }: { rows: { mes: string; app: string; total: number }[] }) {
  const byMes = new Map<string, { ios: number; android: number }>();
  for (const r of rows) {
    if (!byMes.has(r.mes)) byMes.set(r.mes, { ios: 0, android: 0 });
    const bucket = byMes.get(r.mes)!;
    if (r.app === 'ios') bucket.ios += r.total;
    else if (r.app === 'android') bucket.android += r.total;
  }
  const entries = [...byMes.entries()].slice(-6);
  const max = Math.max(1, ...entries.map(([, v]) => v.ios + v.android));

  return (
    <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <p className="mb-4 text-sm font-medium text-slate-200">Nuevas suscripciones (6 meses)</p>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">Sin datos de tendencia.</p>
      ) : (
        <div className="flex items-end gap-3">
          {entries.map(([mes, v]) => {
            const total = v.ios + v.android;
            const h = Math.max(8, Math.round((total / max) * 120));
            const iosH = total ? Math.round((v.ios / total) * h) : 0;
            const androidH = h - iosH;
            return (
              <div key={mes} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500">{fmt(total)}</span>
                <div className="flex w-full max-w-[48px] flex-col justify-end overflow-hidden rounded-md" style={{ height: 120 }}>
                  <div className="bg-sky-500" style={{ height: iosH }} />
                  <div className="bg-emerald-500" style={{ height: androidH }} />
                </div>
                <span className="text-[10px] text-slate-500">{mes.slice(5)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DashboardView() {
  const query = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60_000,
  });

  const d = query.data;

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard administrativo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Usuarios, suscripciones y salud operativa de Mis Pronósticos.
          </p>
          {d?.generatedAt && (
            <p className="mt-1 text-xs text-slate-600">
              Actualizado: {new Date(d.generatedAt).toLocaleString('es-CO')}
            </p>
          )}
        </div>
        <Link
          href="/suscripciones"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-600/10"
        >
          Ver suscripciones →
        </Link>
      </header>

      {query.isLoading && <p className="text-slate-400">Cargando indicadores…</p>}
      {query.isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <p>
            {query.error instanceof ApiError
              ? query.error.message
              : 'No se pudo cargar el dashboard.'}
          </p>
          {query.error instanceof ApiError && query.error.hint && (
            <p className="mt-2 text-xs opacity-90">{query.error.hint}</p>
          )}
          {query.error instanceof ApiError && query.error.status === 401 && (
            <p className="mt-2 text-xs opacity-90">
              Cierra sesión y vuelve a entrar. Si acabas de añadir JWT_SECRET en DigitalOcean, haz
              redeploy completo y limpia la sesión del navegador.
            </p>
          )}
        </div>
      )}

      {d && (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label="Usuarios registrados"
              value={fmt(d.usuarios.registrados)}
              hint={`${fmt(d.usuarios.temporales)} temporales · ${fmt(d.usuarios.eliminados)} eliminados`}
              accent="indigo"
            />
            <KpiCard
              label="Suscripciones hoy"
              value={fmt(d.suscripciones.actividadHoy?.total.all ?? d.suscripciones.nuevasHoy)}
              hint={
                d.suscripciones.actividadHoy
                  ? `${d.suscripciones.fechaReferencia} · ${fmt(d.suscripciones.actividadHoy.compras.total)} compras · ${fmt(d.suscripciones.actividadHoy.renovaciones.total)} renov.`
                  : `${d.suscripciones.fechaReferencia} · iOS ${fmt(d.suscripciones.nuevasHoyPorApp.ios)} · Android ${fmt(d.suscripciones.nuevasHoyPorApp.android)}`
              }
              accent="sky"
            />
            <KpiCard
              label="Suscripciones activas"
              value={fmt(d.suscripciones.activas)}
              hint={`${fmt(d.suscripciones.total)} registros totales`}
              accent="emerald"
            />
            <KpiCard
              label="Activas Android"
              value={fmt(d.suscripciones.activasPorApp.android)}
              hint={`${fmt(d.suscripciones.porApp.android)} históricas`}
              accent="sky"
            />
            <KpiCard
              label="Activas iOS"
              value={fmt(d.suscripciones.activasPorApp.ios)}
              hint={`${fmt(d.suscripciones.porApp.ios)} históricas`}
              accent="amber"
            />
          </section>

          <p className="mb-4 text-xs text-slate-500">{d.usuarios.notaAlcance}</p>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <PlatformBar
              label="Usuarios en app (términos aceptados)"
              ios={d.usuarios.alcanceApp.ios}
              android={d.usuarios.alcanceApp.android}
            />
            <PlatformBar
              label="Suscriptores únicos (histórico)"
              ios={d.usuarios.suscriptoresUnicos.ios}
              android={d.usuarios.suscriptoresUnicos.android}
            />
          </section>

          <section className="mb-6">
            {d.suscripciones.actividadHoy && (
              <ActividadHoyTable actividad={d.suscripciones.actividadHoy} />
            )}
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#111827] p-4 lg:col-span-2">
              <p className="mb-3 text-sm font-medium text-slate-200">Estado de suscripciones</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ['Activas', d.suscripciones.activas, 'text-emerald-300'],
                  ['Inactivas', d.suscripciones.inactivas, 'text-slate-400'],
                  ['Expiradas', d.suscripciones.expiradas, 'text-amber-300'],
                  ['Canceladas', d.suscripciones.canceladas, 'text-red-300'],
                  ['Manuales / temp.', d.suscripciones.manualTemporales, 'text-indigo-300'],
                  ['Marcadas fake', d.suscripciones.fake, 'text-slate-500'],
                ].map(([label, val, cls]) => (
                  <div key={String(label)} className="rounded-lg bg-[#0b0f14] px-3 py-2">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-xl font-semibold ${cls}`}>{fmt(Number(val))}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                <span>Hoy: <strong className="text-emerald-300">{fmt(d.suscripciones.nuevasHoy)}</strong></span>
                <span>Nuevas 7d: <strong className="text-slate-200">{fmt(d.suscripciones.nuevas7d)}</strong></span>
                <span>Nuevas 30d: <strong className="text-slate-200">{fmt(d.suscripciones.nuevas30d)}</strong></span>
                <span>Usuarios con sub: <strong className="text-slate-200">{fmt(d.usuarios.conSuscripcionHistorica)}</strong></span>
              </div>
            </div>

            <TrendChart rows={d.suscripciones.tendenciaMensual} />
          </section>

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
              <p className="mb-3 text-sm font-medium text-slate-200">Top planes</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="pb-2 text-left">Plan</th>
                      <th className="pb-2 text-left">App</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 text-right">Activas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {d.suscripciones.topProductos.map((p) => (
                      <tr key={`${p.productId}-${p.app}`}>
                        <td className="py-2 text-slate-300">{p.productId}</td>
                        <td className="py-2 uppercase text-slate-500">{p.app}</td>
                        <td className="py-2 text-right text-slate-400">{fmt(p.total)}</td>
                        <td className="py-2 text-right text-emerald-300">{fmt(p.activas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
                <p className="mb-3 text-sm font-medium text-slate-200">Trials y soporte</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Trials activos</p>
                    <p className="text-lg font-semibold text-emerald-300">{fmt(d.trials.activos)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Trials totales</p>
                    <p className="text-lg font-semibold text-slate-300">{fmt(d.trials.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Errores pago pendientes</p>
                    <p className="text-lg font-semibold text-amber-300">{fmt(d.soporte.erroresPagoPendientes)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Errores pago total</p>
                    <p className="text-lg font-semibold text-slate-300">{fmt(d.soporte.erroresPagoTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Sugerencias (30d)</p>
                    <p className="text-lg font-semibold text-slate-300">{fmt(d.soporte.sugerencias30d)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Waitlist iOS</p>
                    <p className="text-lg font-semibold text-slate-300">{fmt(d.soporte.waitlistIos)}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
