import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://mispronosticos.com';
const ADMIN_ORIGIN =
  process.env.ADMIN_PANEL_ORIGIN || 'https://mispronosticos-admin.vercel.app';
const UPSTREAM_TIMEOUT_MS = 25_000;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${API_BASE}/api/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ADMIN_ORIGIN,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const aborted = detail.includes('abort') || detail.includes('AbortError');
    return NextResponse.json(
      {
        error: aborted
          ? 'Timeout contactando el backend (proxy Vercel)'
          : 'Error de proxy al contactar el backend',
        code: aborted ? 'ADMIN_LOGIN_PROXY_TIMEOUT' : 'ADMIN_LOGIN_PROXY_ERROR',
        stage: 'vercel_proxy',
        detail,
        hint: 'Revisa DigitalOcean y /api/admin/auth/diagnose en el backend.',
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
