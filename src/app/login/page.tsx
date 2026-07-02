'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { PasswordLoginForm } from '@/components/password-login-form';
import { GoogleLoginButton } from '@/components/google-login-button';
import { LoginConnectionStatus } from '@/components/login-connection-status';

export default function LoginPage() {
  const router = useRouter();
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/pronosticos-ia');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0f14] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151b24] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
            Mis Pronósticos
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Panel administrativo</h1>
          <p className="mt-2 text-sm text-slate-400">
            Acceso solo para administradores autorizados.
          </p>
        </div>

        <PasswordLoginForm />

        <LoginConnectionStatus />

        {googleEnabled && (
          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="mb-4 text-center text-xs text-slate-500">O continúa con Google</p>
            <GoogleLoginButton />
          </div>
        )}
      </div>
    </div>
  );
}
