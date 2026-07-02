'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, loginWithPassword } from '@/lib/api';
import { LoginErrorToast } from '@/components/login-error-toast';
import type { LoginDiagnostic } from '@/lib/login-diagnostics';

export function PasswordLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<LoginDiagnostic | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setInlineError(null);
    setDiagnostic(null);
    try {
      await loginWithPassword(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setInlineError(err.message);
        setDiagnostic(err.diagnostic ?? null);
      } else {
        const message = err instanceof Error ? err.message : 'No se pudo iniciar sesión';
        setInlineError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Email admin</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ADMIN_PANEL_PASSWORD del backend"
            className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
          />
        </label>
        {inlineError && (
          <p
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {inlineError}
            {diagnostic?.hint && (
              <span className="mt-1 block text-xs text-red-200/80">{diagnostic.hint}</span>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? 'Entrando…' : 'Entrar al panel'}
        </button>
        <p className="text-center text-xs text-slate-500">
          Usa un email admin registrado en la app y la contraseña{' '}
          <code className="text-slate-400">ADMIN_PANEL_PASSWORD</code> del backend (producción
          DigitalOcean, no la de Google).
        </p>
      </form>
      <LoginErrorToast diagnostic={diagnostic} onClose={() => setDiagnostic(null)} />
    </>
  );
}
