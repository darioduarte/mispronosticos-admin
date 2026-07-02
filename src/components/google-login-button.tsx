'use client';

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, loginWithGoogle } from '@/lib/api';
import { LoginErrorToast } from '@/components/login-error-toast';
import type { LoginDiagnostic } from '@/lib/login-diagnostics';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export function GoogleLoginButton() {
  const router = useRouter();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<LoginDiagnostic | null>(null);
  const [loading, setLoading] = useState(false);

  if (!clientId) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Google no está configurado en este despliegue (
        <code className="text-amber-100">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>).
      </p>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="flex flex-col items-center gap-4">
        {loading ? (
          <p className="text-sm text-slate-400">Verificando acceso…</p>
        ) : (
          <GoogleLogin
            onSuccess={async (res) => {
              if (!res.credential) return;
              setLoading(true);
              setInlineError(null);
              setDiagnostic(null);
              try {
                await loginWithGoogle(res.credential);
                router.replace('/dashboard');
              } catch (e) {
                if (e instanceof ApiError) {
                  setInlineError(e.message);
                  setDiagnostic(e.diagnostic ?? null);
                } else {
                  setInlineError('No se pudo iniciar sesión');
                }
              } finally {
                setLoading(false);
              }
            }}
            onError={() => {
              setInlineError('Google no pudo autenticar en el navegador');
            }}
            theme="filled_black"
            size="large"
            text="signin_with"
            shape="pill"
          />
        )}
        {inlineError && (
          <p className="max-w-sm text-center text-sm text-red-400" role="alert">
            {inlineError}
          </p>
        )}
      </div>
      <LoginErrorToast diagnostic={diagnostic} onClose={() => setDiagnostic(null)} />
    </GoogleOAuthProvider>
  );
}
