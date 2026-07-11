'use client';

import { useEffect, useState } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  text: string;
  loading?: boolean;
  loadingLabel?: string;
  onClose: () => void;
};

export function TextModal({ title, subtitle, text, loading, loadingLabel, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151b24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="text-modal-title"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="text-modal-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyText}
              disabled={loading || !text}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 p-4">
          {loading ? (
            <p className="text-sm text-slate-400">{loadingLabel || 'Cargando…'}</p>
          ) : (
            <textarea
              readOnly
              value={text}
              className="h-[min(70vh,560px)] w-full resize-none rounded-lg border border-white/10 bg-[#0b0f14] p-3 font-mono text-xs leading-relaxed text-slate-200"
            />
          )}
        </div>
      </div>
    </div>
  );
}
