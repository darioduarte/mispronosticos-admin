'use client';

import { useEffect, useState } from 'react';
import {
  dismissAdminToast,
  subscribeAdminToasts,
  type AdminToast,
} from '@/lib/admin-toast';

const TONE_STYLES: Record<
  AdminToast['tone'],
  { border: string; bg: string; title: string; button: string }
> = {
  error: {
    border: 'border-red-500/40',
    bg: 'bg-[#1a1014]',
    title: 'text-red-200',
    button: 'border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-[#1a1410]',
    title: 'text-amber-200',
    button: 'border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20',
  },
  success: {
    border: 'border-emerald-500/40',
    bg: 'bg-[#0f1a14]',
    title: 'text-emerald-200',
    button: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20',
  },
  info: {
    border: 'border-sky-500/40',
    bg: 'bg-[#0f141a]',
    title: 'text-sky-200',
    button: 'border-sky-500/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20',
  },
};

function ToastCard({ toast }: { toast: AdminToast }) {
  const [copied, setCopied] = useState(false);
  const styles = TONE_STYLES[toast.tone];

  async function copy() {
    try {
      await navigator.clipboard.writeText(toast.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`rounded-xl border ${styles.border} ${styles.bg} p-4 shadow-2xl shadow-black/50`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${styles.title}`}>{toast.title}</p>
          <p className="mt-1 break-words text-sm text-slate-200/90">{toast.message}</p>
          {toast.detail ? (
            <p className="mt-2 break-all font-mono text-[11px] text-slate-400">{toast.detail}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => dismissAdminToast(toast.id)}
          className="shrink-0 rounded px-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          aria-label="Cerrar"
        >
          ?
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${styles.button}`}
        >
          {copied ? 'Copiado' : 'Copiar error'}
        </button>
        <button
          type="button"
          onClick={() => dismissAdminToast(toast.id)}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/5"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function AdminToastHost() {
  const [items, setItems] = useState<AdminToast[]>([]);

  useEffect(() => subscribeAdminToasts(setItems), []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-end gap-2 p-4 sm:p-6">
      {items.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-lg">
          <ToastCard toast={toast} />
        </div>
      ))}
    </div>
  );
}
