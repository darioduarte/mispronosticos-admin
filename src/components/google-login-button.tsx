'use client';

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, loginWithGoogle } from '@/lib/api';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export function GoogleLoginButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!clientId) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Configura <code className="text-amber-100">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> en{' '}
        <code className="text-amber-100">.env.local</code>
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
              setError(null);
              try {
                await loginWithGoogle(res.credential);
                router.replace('/pronosticos-ia');
              } catch (e) {
                const msg =
                  e instanceof ApiError ? e.message : 'No se pudo iniciar sesión';
                setError(msg);
              } finally {
                setLoading(false);
              }
            }}
            onError={() => setError('Google no pudo autenticar')}
            theme="filled_black"
            size="large"
            text="signin_with"
            shape="pill"
          />
        )}
        {error && (
          <p className="max-w-sm text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}
