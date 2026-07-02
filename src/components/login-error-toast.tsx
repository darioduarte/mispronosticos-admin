'use client';

import { useEffect, useState } from 'react';
import type { LoginDiagnostic } from '@/lib/login-diagnostics';
import { formatLoginDiagnostic } from '@/lib/login-diagnostics';

type Props = {
  diagnostic: LoginDiagnostic | null;
  onClose: () => void;
};

export function LoginErrorToast({ diagnostic, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!diagnostic) return;
    setCopied(false);
  }, [diagnostic]);

  if (!diagnostic) return null;

  const text = formatLoginDiagnostic(diagnostic);

  async function copyDiagnostic() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg"
      role="alert"
      aria-live="assertive"
    >
      <div className="rounded-xl border border-amber-500/40 bg-[#1a1410] p-4 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-200">No se pudo iniciar sesión</p>
            <p className="mt-1 text-sm text-amber-100/90">{diagnostic.message}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded px-1.5 text-amber-400/80 hover:bg-white/5 hover:text-amber-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {diagnostic.hint && (
          <p className="mt-2 text-xs text-amber-200/80">{diagnostic.hint}</p>
        )}

        {(diagnostic.code || diagnostic.detail) && (
          <dl className="mt-2 space-y-1 rounded-lg bg-black/30 p-2.5 font-mono text-[10px] text-slate-400">
            {diagnostic.code && (
              <div className="flex gap-2">
                <dt className="text-slate-500">Código</dt>
                <dd className="text-amber-200">{diagnostic.code}</dd>
              </div>
            )}
            {diagnostic.stage && (
              <div className="flex gap-2">
                <dt className="text-slate-500">Etapa</dt>
                <dd>{diagnostic.stage}</dd>
              </div>
            )}
            {diagnostic.detail && (
              <div className="flex gap-2">
                <dt className="text-slate-500">Detalle</dt>
                <dd className="break-all text-red-200/90">{diagnostic.detail}</dd>
              </div>
            )}
          </dl>
        )}

        <dl className="mt-3 space-y-1 rounded-lg bg-black/30 p-2.5 font-mono text-[10px] text-slate-400">
          <div className="flex gap-2">
            <dt className="text-slate-500">API</dt>
            <dd className="break-all text-slate-300">{diagnostic.apiBase}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-500">Ruta</dt>
            <dd>{diagnostic.method} {diagnostic.endpoint}</dd>
          </div>
          {diagnostic.status != null && (
            <div className="flex gap-2">
              <dt className="text-slate-500">HTTP</dt>
              <dd>{diagnostic.status}</dd>
            </div>
          )}
          {diagnostic.networkError && (
            <div className="flex gap-2">
              <dt className="text-slate-500">Red</dt>
              <dd className="break-all text-red-300">{diagnostic.networkError}</dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyDiagnostic}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
          >
            {copied ? 'Copiado' : 'Copiar diagnóstico'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
