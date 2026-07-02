'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchRuntimeSettings,
  killLiveRuntime,
  resumeLivePredictionsRuntime,
  resumeLiveRuntime,
  updateRuntimeSettings,
} from '@/lib/api';
import type { RuntimeSettingField, RuntimeSettingsSnapshot } from '@/lib/types';

const GROUP_LABELS: Record<string, string> = {
  master: 'Interruptor maestro',
  live: 'Servicios en vivo',
  client: 'App móvil',
  advanced: 'Avanzado',
};

function FlagBanner({ snapshot }: { snapshot: RuntimeSettingsSnapshot }) {
  const { flags } = snapshot;
  const items: { label: string; active: boolean; detail?: string }[] = [
    { label: 'LIVE_EMERGENCY_OFF (.env)', active: flags.emergencyEnvOff },
    { label: 'Kill switch Redis', active: flags.killSwitch },
    {
      label: 'Auto-pausa (pool)',
      active: flags.autoPaused,
      detail: flags.autoPausedReason || undefined,
    },
  ].filter((i) => i.active);

  if (!items.length) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        Sin bloqueos operativos activos. Valores efectivos abajo reflejan la config guardada.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
      <p className="text-sm font-medium text-red-200">Live bloqueado o degradado</p>
      <ul className="mt-2 space-y-1 text-xs text-red-300/90">
        {items.map((i) => (
          <li key={i.label}>
            {i.label}
            {i.detail ? ` — ${i.detail}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? 'bg-indigo-500' : 'bg-slate-600'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

function FieldRow({
  field,
  effective,
  saving,
  onChange,
}: {
  field: RuntimeSettingField;
  effective: RuntimeSettingsSnapshot['effective'];
  saving: boolean;
  onChange: (key: string, value: boolean | number) => void;
}) {
  const eff = effective[field.key];
  const effectiveOff = field.type === 'bool' && eff === false && field.value === true;

  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-200">{field.label}</p>
        {field.description && (
          <p className="mt-0.5 text-xs text-slate-500">{field.description}</p>
        )}
        {effectiveOff && (
          <p className="mt-1 text-xs text-amber-400">Guardado ON, efectivo OFF (bloqueo activo)</p>
        )}
      </div>
      {field.type === 'bool' ? (
        <Toggle
          checked={!!field.value}
          disabled={saving}
          onChange={(v) => onChange(field.key, v)}
        />
      ) : (
        <input
          type="number"
          min={field.min}
          max={field.max}
          disabled={saving}
          value={field.value as number}
          onChange={(e) => onChange(field.key, parseInt(e.target.value, 10))}
          className="w-24 rounded-lg border border-white/10 bg-[#0b0f14] px-2 py-1 text-right text-sm text-slate-200"
        />
      )}
    </div>
  );
}

export function LiveRuntimePanel() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['runtime-settings'],
    queryFn: fetchRuntimeSettings,
    refetchInterval: 15_000,
  });

  const patchMutation = useMutation({
    mutationFn: (settings: Record<string, boolean | number>) =>
      updateRuntimeSettings(settings),
    onSuccess: (data) => {
      qc.setQueryData(['runtime-settings'], data);
    },
  });

  const killMutation = useMutation({
    mutationFn: killLiveRuntime,
    onSuccess: (data) => qc.setQueryData(['runtime-settings'], data),
  });

  const resumeMutation = useMutation({
    mutationFn: resumeLiveRuntime,
    onSuccess: (data) => qc.setQueryData(['runtime-settings'], data),
  });

  const resumePredictionsMutation = useMutation({
    mutationFn: resumeLivePredictionsRuntime,
    onSuccess: (data) => qc.setQueryData(['runtime-settings'], data),
  });

  const snapshot = query.data;
  const saving =
    patchMutation.isPending ||
    killMutation.isPending ||
    resumeMutation.isPending ||
    resumePredictionsMutation.isPending;

  function handleFieldChange(key: string, value: boolean | number) {
    patchMutation.mutate({ [key]: value });
  }

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">Cargando parámetros en vivo…</p>;
  }

  if (query.isError || !snapshot) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        No se pudo cargar. Verifica `/api/admin/runtime-settings` en el backend.
      </p>
    );
  }

  const groups = ['master', 'live', 'client', 'advanced'];
  const byGroup = groups.map((g) => ({
    id: g,
    label: GROUP_LABELS[g] || g,
    fields: snapshot.fields.filter((f) => f.group === g),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Parámetros en vivo</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Cambios instantáneos vía Redis. MySQL se actualiza en segundo plano. Usa el botón
            rojo si el pool MySQL se satura.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Redis: {snapshot.redisAvailable ? 'conectado' : 'NodeCache local (dev)'}
            {snapshot.meta.updatedAt && (
              <> · Última edición: {new Date(snapshot.meta.updatedAt).toLocaleString('es-CO')}</>
            )}
            {snapshot.meta.updatedBy && <> · por {snapshot.meta.updatedBy}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (
                window.confirm(
                  '¿Activar pronósticos IA en vivo?\n\nEnciende: interruptor maestro, hot path (marcadores) y GPT en fases min30/HT/min60/min80.\nDeja apagado: stats hot, sockets y polling en app.',
                )
              ) {
                resumePredictionsMutation.mutate();
              }
            }}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Activar pronósticos IA
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (window.confirm('¿Apagar TODO el live ahora? (kill switch Redis)')) {
                killMutation.mutate();
              }
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            Apagar live
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => resumeMutation.mutate()}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            Reanudar fase 1 (sin IA)
          </button>
        </div>
      </div>

      <FlagBanner snapshot={snapshot} />

      {(patchMutation.isError ||
        killMutation.isError ||
        resumeMutation.isError ||
        resumePredictionsMutation.isError) && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {patchMutation.error?.message ||
            killMutation.error?.message ||
            resumeMutation.error?.message ||
            resumePredictionsMutation.error?.message ||
            'Error al guardar.'}
          {patchMutation.error instanceof Error &&
          patchMutation.error.message.includes('Sesión') ? (
            <span className="block mt-1 text-xs">Vuelve a iniciar sesión en el panel.</span>
          ) : (
            <span className="block mt-1 text-xs text-red-300/80">
              Si el toggle no guarda, suele ser CORS (PATCH bloqueado) o sesión expirada — revisa la pestaña Network del navegador.
            </span>
          )}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {byGroup.map(({ id, label, fields }) =>
          fields.length ? (
            <section
              key={id}
              className="rounded-xl border border-white/10 bg-[#111827] p-4"
            >
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </h2>
              {fields.map((field) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  effective={snapshot.effective}
                  saving={saving}
                  onChange={handleFieldChange}
                />
              ))}
            </section>
          ) : null,
        )}
      </div>

      <section className="rounded-xl border border-white/10 bg-[#111827] p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Valores efectivos ahora
        </h2>
        <pre className="overflow-x-auto text-xs text-slate-400">
          {JSON.stringify(snapshot.effective, null, 2)}
        </pre>
      </section>
    </div>
  );
}
