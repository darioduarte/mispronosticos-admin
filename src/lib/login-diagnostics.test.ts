/**
 * Tests de diagnóstico de login (sin red, sin secretos).
 *   npx tsx --test src/lib/login-diagnostics.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatLoginDiagnostic, type LoginDiagnostic } from './login-diagnostics';

describe('formatLoginDiagnostic', () => {
  it('incluye cabecera, API y campos opcionales', () => {
    const d: LoginDiagnostic = {
      message: 'Unauthorized',
      status: 401,
      hint: 'Revisa la clave admin',
      code: 'AUTH_FAILED',
      stage: 'password',
      detail: 'invalid credentials',
      apiBase: 'http://localhost:3000',
      endpoint: '/api/admin/auth/login',
      method: 'POST',
      responseBody: '{"ok":false}',
      networkError: undefined,
      at: '2026-01-01T00:00:00.000Z',
    };
    const text = formatLoginDiagnostic(d);
    assert.match(text, /=== Diagnóstico login admin ===/);
    assert.match(text, /API: http:\/\/localhost:3000/);
    assert.match(text, /POST \/api\/admin\/auth\/login/);
    assert.match(text, /HTTP: 401/);
    assert.match(text, /Código: AUTH_FAILED/);
    assert.match(text, /Hint: Revisa la clave admin/);
    assert.doesNotMatch(text, /password=|token=/i);
  });

  it('marca HTTP sin respuesta si no hay status', () => {
    const text = formatLoginDiagnostic({
      message: 'fetch failed',
      apiBase: 'http://127.0.0.1:3000',
      endpoint: '/health',
      method: 'GET',
      networkError: 'ECONNREFUSED',
      at: '2026-01-02T00:00:00.000Z',
    });
    assert.match(text, /HTTP: \(sin respuesta\)/);
    assert.match(text, /Red: ECONNREFUSED/);
  });
});
