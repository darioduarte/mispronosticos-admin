'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminNotifications, sendAdminNotificationTest } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/admin-toast';
import type { AdminLiveNotificationRow, AdminNotificationOutboxRow } from '@/lib/types';

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CO', { hour12: false });
  } catch {
    return String(iso);
  }
}

function statusCls(status?: string | null) {
  const s = String(status || '').toLowerCase();
  if (s === 'sent') return 'text-emerald-300';
  if (s === 'pending' || s === 'sending') return 'text-amber-300';
  if (s === 'failed') return 'text-red-300';
  return 'text-slate-400';
}

function OnOffBadge({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        on ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'
      }`}
    >
      {label}: {on ? 'ON' : 'OFF'}
    </span>
  );
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
  accent?: 'indigo' | 'emerald' | 'amber' | 'sky';
}) {
  const border =
    accent === 'emerald'
      ? 'border-emerald-500/30'
      : accent === 'amber'
        ? 'border-amber-500/30'
        : accent === 'sky'
          ? 'border-sky-500/30'
          : 'border-indigo-500/30';
  return (
    <div className={`rounded-xl border bg-[#111827] p-4 ${border}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function LiveNotificationsTable({ rows }: { rows: AdminLiveNotificationRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="pb-2 text-left">Notificado</th>
            <th className="pb-2 text-left">Partido</th>
            <th className="pb-2 text-left">Fase</th>
            <th className="pb-2 text-left">Marcador</th>
            <th className="pb-2 text-left">Picks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-slate-500">
                Aún no hay pronósticos en vivo notificados a admins.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.runId}>
                <td className="py-2 text-xs text-slate-400">{formatWhen(row.notifiedAt)}</td>
                <td className="py-2">
                  <p className="text-slate-200">
                    {row.homeTeam || 'Local'} vs {row.awayTeam || 'Visitante'}
                  </p>
                  <p className="text-[11px] text-slate-500">Fixture #{row.fixtureid}</p>
                </td>
                <td className="py-2 text-xs text-slate-300">
                  {row.windowKey}
                  {row.minute != null ? ` · ${row.minute}'` : ''}
                </td>
                <td className="py-2 font-mono text-xs text-slate-400">
                  {row.scoreHome ?? 0}-{row.scoreAway ?? 0}
                </td>
                <td className="py-2 text-xs text-slate-300">
                  <span className="text-slate-400">{row.picksNotified} · </span>
                  {row.picksSummary || '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function OutboxTable({ rows }: { rows: AdminNotificationOutboxRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="pb-2 text-left">Creado</th>
            <th className="pb-2 text-left">Tipo</th>
            <th className="pb-2 text-left">Asunto</th>
            <th className="pb-2 text-left">Estado</th>
            <th className="pb-2 text-left">Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-slate-500">
                Sin alertas en la cola reciente.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="py-2 text-xs text-slate-400">{formatWhen(row.createdAt)}</td>
                <td className="py-2 text-xs text-slate-300">
                  <p>{row.kind}</p>
                  {row.jobKey ? <p className="text-[11px] text-slate-500">{row.jobKey}</p> : null}
                </td>
                <td className="max-w-xs truncate py-2 text-xs text-slate-300" title={row.subject}>
                  {row.subject}
                </td>
                <td className={`py-2 text-xs font-medium ${statusCls(row.status)}`}>
                  {row.status}
                  {row.sentAt ? (
                    <p className="text-[11px] font-normal text-slate-500">{formatWhen(row.sentAt)}</p>
                  ) : null}
                </td>
                <td className="max-w-xs truncate py-2 text-xs text-red-300/80" title={row.lastError || ''}>
                  {row.lastError || '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function NotificationsView() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('Prueba de notificación admin');
  const [body, setBody] = useState(
    'Si recibes este push, las alertas dirigidas a administradores están operativas.',
  );
  const [channel, setChannel] = useState<'push' | 'both'>('push');

  const query = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => fetchAdminNotifications(40),
    refetchInterval: 30_000,
  });

  const testMutation = useMutation({
    mutationFn: () => sendAdminNotificationTest({ channel, title, body }),
    onSuccess: (res) => {
      if (res.success) {
        const sent = res.push?.sent ?? 0;
        toastSuccess(
          channel === 'both'
            ? `Prueba enviada · push ${sent} · email ${res.email?.sent ?? 0}`
            : `Push de prueba enviado a ${sent} dispositivo(s) admin`,
        );
      } else {
        toastError(res.push?.reason || res.error || 'No se pudo enviar la prueba');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (err: Error) => toastError(err.message || 'Error al enviar prueba'),
  });

  const data = query.data;
  const diag = data?.diagnostics;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Notificaciones</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitorea alertas a administradores, pronósticos en vivo notificados y envía pruebas FCM.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
        >
          {query.isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {query.isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          No se pudo cargar el panel de notificaciones.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Tokens FCM admin"
          value={diag?.fcmTokenCount ?? '—'}
          hint={`${diag?.adminsFoundInDb ?? 0} admins en BD`}
          accent="indigo"
        />
        <KpiCard
          label="Alertas pendientes"
          value={data?.outbox.pending ?? '—'}
          hint="Cola AlertOutbox"
          accent="amber"
        />
        <KpiCard
          label="Alertas enviadas hoy"
          value={data?.outbox.sentToday ?? '—'}
          hint="Correo ops / cron"
          accent="emerald"
        />
        <KpiCard
          label="SMTP"
          value={diag?.smtpConfigured ? 'Configurado' : 'No configurado'}
          hint={diag?.smtpConfigured ? 'Email + push en prueba "ambos"' : 'Solo push disponible'}
          accent="sky"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <OnOffBadge on={data?.channels.adminPushEnabled ?? false} label="Push admin en vivo" />
        <OnOffBadge on={data?.channels.userLivePushEnabled ?? false} label="Push usuarios en vivo" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <h2 className="text-sm font-semibold text-slate-200">Destinatarios admin</h2>
          <p className="mt-1 text-xs text-slate-500">
            Emails con acceso a alertas y tokens FCM registrados.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {(diag?.adminEmails || []).map((email) => (
              <li
                key={email}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2"
              >
                <span className="text-slate-300">{email}</span>
                <span className="text-xs text-slate-500">
                  {(diag?.fcmByEmail?.[email] ?? 0) > 0
                    ? `${diag?.fcmByEmail?.[email]} token(s)`
                    : 'sin token'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
          <h2 className="text-sm font-semibold text-slate-200">Probar notificación</h2>
          <p className="mt-1 text-xs text-slate-500">
            Envía un push (o push + correo) solo a administradores.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Canal</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'push' | 'both')}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              >
                <option value="push">Solo push FCM</option>
                <option value="both">Push + correo</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Título</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Mensaje</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-200"
              />
            </div>
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !title.trim() || !body.trim()}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {testMutation.isPending ? 'Enviando prueba…' : 'Enviar prueba a admins'}
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Pronósticos en vivo notificados</h2>
            <p className="text-xs text-slate-500">Runs con push admin enviado (notifiedAt).</p>
          </div>
          {data?.generatedAt ? (
            <span className="text-[11px] text-slate-500">Actualizado {formatWhen(data.generatedAt)}</span>
          ) : null}
        </div>
        <LiveNotificationsTable rows={data?.liveAdmin.recent || []} />
      </section>

      <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-200">Cola de alertas (ops)</h2>
          <p className="text-xs text-slate-500">Correos de cron, errores IA y alertas del sistema.</p>
        </div>
        <OutboxTable rows={data?.outbox.recent || []} />
      </section>
    </div>
  );
}
