'use client';

import { useEffect, useState } from 'react';
import { probeAdminConnection, getApiBaseUrl } from '@/lib/api';
import type { ConnectionProbe } from '@/lib/login-diagnostics';

export function LoginConnectionStatus() {
  const [probe, setProbe] = useState<ConnectionProbe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await probeAdminConnection();
      if (!cancelled) {
        setProbe(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const apiBase = getApiBaseUrl();

  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-[#0b0f14] p-3 text-xs text-slate-500">
      <p className="font-medium text-slate-400">Conexión con backend</p>
      <p className="mt-1 break-all font-mono text-[10px] text-slate-600">{apiBase}</p>
      {loading && <p className="mt-2 text-slate-500">Comprobando…</p>}
      {!loading && probe && (
        <ul className="mt-2 space-y-1">
          <li className={probe.healthOk ? 'text-emerald-400' : 'text-red-300'}>
            {probe.healthOk ? '✓' : '✗'} /api/admin/health
            {probe.healthStatus != null ? ` (${probe.healthStatus})` : ''}
            {probe.healthError ? ` — ${probe.healthError}` : ''}
          </li>
          <li className="text-slate-400">
            Login password:{' '}
            {probe.authMethods?.password ? (
              <span className="text-emerald-400">activo</span>
            ) : (
              <span className="text-amber-300">no configurado en backend</span>
            )}
          </li>
          <li className="text-slate-400">
            Login Google:{' '}
            {probe.authMethods?.google ? (
              <span className="text-emerald-400">activo</span>
            ) : (
              <span className="text-slate-500">no configurado</span>
            )}
          </li>
        </ul>
      )}
      {apiBase.includes('localhost') && (
        <p className="mt-2 text-amber-300">
          El build apunta a localhost. Configura NEXT_PUBLIC_API_BASE_URL en Vercel y redeploy.
        </p>
      )}
      <p className="mt-2 font-mono text-[10px] text-slate-600">
        Build: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local'}
      </p>
    </div>
  );
}
