import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveSession,
} from './auth';
import type {
  AuthSession,
  ComparadorResponse,
  FixtureStatisticsResponse,
  MelbetOddsResponse,
  OddsReferenciaResponse,
  PartidosResponse,
  PromptResponse,
  LiveOddsResponse,
  LiveAnalysisRunsResponse,
  PronosticoIaRow,
  PronosticosIaResponse,
  RefereeHistoryResponse,
  RefereeSearchResponse,
  RepairRefereesResponse,
  PartidoStatisticsApiResponse,
  SyncStatsResponse,
  SuscripcionesResponse,
  SuscripcionProductosResponse,
  SuscripcionSavePayload,
  SuscripcionMutationResponse,
  SuscripcionRow,
  DashboardSummary,
  OpsSnapshot,
  RuntimeSettingsSnapshot,
} from './types';
import type { ConnectionProbe, LoginDiagnostic } from './login-diagnostics';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export function getApiBaseUrl() {
  return API_BASE;
}

export class ApiError extends Error {
  status: number;
  hint?: string;
  diagnostic?: LoginDiagnostic;

  constructor(message: string, status: number, extra?: { hint?: string; diagnostic?: LoginDiagnostic }) {
    super(message);
    this.status = status;
    this.hint = extra?.hint;
    this.diagnostic = extra?.diagnostic;
  }
}

function buildLoginDiagnostic(
  partial: Omit<LoginDiagnostic, 'at' | 'apiBase'> & { apiBase?: string },
): LoginDiagnostic {
  return {
    apiBase: partial.apiBase ?? API_BASE,
    at: new Date().toISOString(),
    ...partial,
  };
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function isGatewayHtmlResponse(data: Record<string, unknown>): boolean {
  const raw = typeof data.raw === 'string' ? data.raw : '';
  return raw.includes('<!DOCTYPE') || raw.includes('<html');
}

function gatewayErrorHint(status: number): string | undefined {
  if (status === 504) {
    return 'Gateway 504: el proxy cortó la petición antes de recibir JSON del backend. NO significa contraseña incorrecta. Comprueba adminLoginRev en /api/admin/health y redeploy en DigitalOcean.';
  }
  if (status === 502 || status === 503) {
    return 'El backend respondió con error temporal (caché vacía, Redis lento o MySQL ocupado). Espera 20–30 s y reintenta con un email admin precargado.';
  }
  return undefined;
}

function formatLoginMessage(data: Record<string, unknown>, res: Response, isHtml: boolean): string {
  const code = typeof data.code === 'string' ? data.code : undefined;
  const backendError = typeof data.error === 'string' ? data.error : undefined;

  if (backendError && code) {
    return `[${code}] ${backendError}`;
  }
  if (backendError) return backendError;

  if (isHtml) {
    return res.status === 504
      ? 'Gateway 504 — el backend no devolvió JSON'
      : 'Respuesta inválida del gateway (HTML, no JSON)';
  }

  return (
    (typeof data.message === 'string' && data.message) ||
    res.statusText ||
    'Error al iniciar sesión'
  );
}

const LOGIN_RETRY_STATUSES = new Set([502]);
const LOGIN_MAX_ATTEMPTS = 2;
const LOGIN_RETRY_BASE_MS = 1500;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLogin(
  endpoint: string,
  init: RequestInit,
  attempt = 1,
  baseUrl = API_BASE,
): Promise<Response> {
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, init);
    if (attempt < LOGIN_MAX_ATTEMPTS && LOGIN_RETRY_STATUSES.has(res.status)) {
      await sleep(LOGIN_RETRY_BASE_MS * attempt);
      return fetchLogin(endpoint, init, attempt + 1, baseUrl);
    }
    return res;
  } catch (err) {
    if (attempt < LOGIN_MAX_ATTEMPTS) {
      await sleep(LOGIN_RETRY_BASE_MS * attempt);
      return fetchLogin(endpoint, init, attempt + 1, baseUrl);
    }
    throw err;
  }
}

function loginApiError(
  res: Response,
  data: Record<string, unknown>,
  endpoint: string,
  method: string,
): ApiError {
  const isHtml = isGatewayHtmlResponse(data);
  const gatewayHint = gatewayErrorHint(res.status);
  const code = typeof data.code === 'string' ? data.code : isHtml && res.status === 504 ? 'GATEWAY_TIMEOUT' : undefined;
  const stage = typeof data.stage === 'string' ? data.stage : isHtml ? 'proxy' : undefined;
  const detail = typeof data.detail === 'string' ? data.detail : undefined;
  const message = formatLoginMessage(data, res, isHtml);
  const hint =
    (typeof data.hint === 'string' ? data.hint : undefined) || gatewayHint;
  const requestBase = endpoint.startsWith('/api/admin/') ? API_BASE : '(admin Vercel)';
  const diagnostic = buildLoginDiagnostic({
    message,
    hint,
    status: res.status,
    code,
    stage,
    detail,
    apiBase: requestBase,
    endpoint,
    method,
    responseBody: JSON.stringify(data).slice(0, 800),
  });
  return new ApiError(message, res.status, { hint, diagnostic });
}

function networkLoginError(err: unknown, endpoint: string, method: string): ApiError {
  const networkError = err instanceof Error ? err.message : String(err);
  const message = 'No se pudo contactar el backend (error de red o CORS)';
  const diagnostic = buildLoginDiagnostic({
    message,
    endpoint,
    method,
    networkError,
    hint: 'Verifica NEXT_PUBLIC_API_BASE_URL en Vercel y CORS (ADMIN_PANEL_ORIGIN) en el backend.',
  });
  return new ApiError(message, 0, { hint: diagnostic.hint, diagnostic });
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE}/api/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (!res.ok) {
      clearSession();
      return null;
    }

    const data = (await res.json()) as { accessToken?: string | null };
    const accessToken = typeof data.accessToken === 'string' ? data.accessToken.trim() : '';
    if (!accessToken) {
      clearSession();
      return null;
    }

    const user = getStoredUser();
    if (user && getRefreshToken()) {
      saveSession({
        accessToken,
        refreshToken: getRefreshToken()!,
        user,
      });
    } else {
      localStorage.setItem('mp_admin_access_token', accessToken);
    }
    return accessToken;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function buildAuthHeaders(init: RequestInit, token: string | null): Headers {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  let token = getAccessToken();
  let headers = buildAuthHeaders(init, token);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (res.status === 401 && retry) {
    token = await refreshAccessToken();
    if (token) {
      headers = buildAuthHeaders(init, token);
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
      });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}));
        const hint =
          typeof (err as { hint?: string }).hint === 'string'
            ? (err as { hint?: string }).hint
            : undefined;
        throw new ApiError(
          (err as { error?: string }).error || retryRes.statusText,
          retryRes.status,
          { hint },
        );
      }
      return retryRes.json() as Promise<T>;
    }
    throw new ApiError('Sesión expirada — vuelve a iniciar sesión', 401);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(
      (err as { error?: string; message?: string }).error ||
        (err as { message?: string }).message ||
        res.statusText,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

export async function loginWithGoogle(idToken: string): Promise<AuthSession> {
  const endpoint = '/api/admin/auth/google';
  let res: Response;
  try {
    res = await fetchLogin(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (err) {
    throw networkLoginError(err, endpoint, 'POST');
  }

  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw loginApiError(res, data, endpoint, 'POST');
  }

  const session: AuthSession = {
    accessToken: String(data.accessToken),
    refreshToken: String(data.refreshToken),
    user: data.user as AuthSession['user'],
  };
  saveSession(session);
  return session;
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<AuthSession> {
  const endpoint = '/api/admin/auth/login';
  const adminOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://mispronosticos-admin.vercel.app';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  let res: Response;
  let data: Record<string, unknown>;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: adminOrigin,
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
      cache: 'no-store',
    });
    data = await parseJsonSafe(res);
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('abort'));
    const diagnostic = buildLoginDiagnostic({
      message: aborted
        ? 'Timeout al contactar el backend (12 s)'
        : 'No se pudo contactar el backend',
      apiBase: API_BASE,
      endpoint,
      method: 'POST',
      networkError: err instanceof Error ? err.message : String(err),
      hint: aborted
        ? 'El backend tardó demasiado. Verifica en /api/admin/health que adminLoginRev sea direct-mysql-v11-fast-cache tras redeploy DO.'
        : 'Revisa CORS (ADMIN_PANEL_ORIGIN) y que mispronosticos.com responda.',
    });
    throw new ApiError(diagnostic.message, aborted ? 504 : 0, {
      hint: diagnostic.hint,
      diagnostic,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw loginApiError(res, data, endpoint, 'POST');
  }

  const session: AuthSession = {
    accessToken: String(data.accessToken),
    refreshToken: String(data.refreshToken),
    user: data.user as AuthSession['user'],
  };
  saveSession(session);
  return session;
}

export async function probeAdminConnection(): Promise<ConnectionProbe> {
  const checkedAt = new Date().toISOString();
  const base: ConnectionProbe = {
    apiBase: API_BASE,
    healthOk: false,
    checkedAt,
  };

  try {
    const healthRes = await fetch(`${API_BASE}/api/admin/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    base.healthStatus = healthRes.status;
    base.healthOk = healthRes.ok;
    if (healthRes.ok) {
      const health = (await healthRes.json()) as {
        adminLoginRev?: string;
        loginFastPath?: boolean;
      };
      base.adminLoginRev = health.adminLoginRev;
      base.loginFastPath = health.loginFastPath === true;
    }
    if (!healthRes.ok) {
      base.healthError = healthRes.statusText;
    }
  } catch (err) {
    base.healthError = err instanceof Error ? err.message : String(err);
  }

  try {
    const methodsRes = await fetch(`${API_BASE}/api/admin/auth/methods`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (methodsRes.ok) {
      const methods = (await methodsRes.json()) as {
        password?: boolean;
        google?: boolean;
        jwt?: boolean;
      };
      base.authMethods = methods;
    }
  } catch {
    /* ignore */
  }

  return base;
}

export function fetchPronosticosIa(desde: string, hasta: string) {
  const qs = new URLSearchParams({ desde, hasta });
  return adminFetch<PronosticosIaResponse>(
    `/api/admin/pronosticos-ia/rango?${qs}`,
  );
}

export function fetchMe() {
  return adminFetch<{ id: string; email: string; name: string; role: string }>(
    '/api/admin/me',
  );
}

export function fetchFixtureStatistics(fixtureId: number) {
  return adminFetch<FixtureStatisticsResponse>(
    `/api/admin/pronosticos-ia/fixtures/${fixtureId}/statistics`,
  );
}

export function fetchOddsForPronostico(row: PronosticoIaRow) {
  const linea = row.linea_normalizada;
  const lineaNum =
    linea != null && String(linea).trim() !== '' && String(linea).trim() !== '-'
      ? parseFloat(String(linea).replace(',', '.'))
      : null;

  return adminFetch<{ success: boolean; odds: Record<string, { odd: number | string; bookmaker?: string; value?: string; betName?: string }> }>(
    '/api/admin/pronosticos-ia/cuota/fetch',
    {
      method: 'POST',
      body: JSON.stringify({
        fixtureId: row.fixtureid,
        pronosticos: [
          {
            pronostico_id: row.pronostico_id,
            categoria_normalizada: row.categoria_normalizada || 'otros',
            linea_normalizada:
              lineaNum != null && Number.isFinite(lineaNum) ? lineaNum : null,
            equipo_normalizado: row.equipo_normalizado || null,
            pronostico_tipo: row.pronostico_tipo || '',
            pronostico: (row.pronostico || '').trim(),
          },
        ],
      }),
    },
  );
}

export function savePrognosticOdd(payload: {
  pronostico_id: string;
  fixtureId: number;
  odd: string | number;
  bookmaker?: string;
  value?: string;
  betName?: string;
}) {
  return adminFetch<{ success: boolean }>('/api/admin/pronosticos-ia/cuota/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchPreMatchPrompt(fixtureId: number) {
  return adminFetch<PromptResponse>('/api/admin/pronosticos-ia/prompt/pre-match', {
    method: 'POST',
    body: JSON.stringify({ fixtureId }),
  });
}

export function fetchExperimentalPrompt(fixtureId: number) {
  return adminFetch<PromptResponse>('/api/admin/pronosticos-ia/prompt/experimental', {
    method: 'POST',
    body: JSON.stringify({ fixtureId }),
  });
}

export function fetchLivePrompt(fixtureId: number) {
  return adminFetch<PromptResponse>(`/api/admin/pronosticos-ia/prompt/live/${fixtureId}`);
}

export function fetchLiveOdds(fixtureId: number) {
  return adminFetch<LiveOddsResponse>(`/api/admin/pronosticos-ia/live-odds/${fixtureId}`);
}

export function fetchOddsReferencia(fixtureId: number) {
  return adminFetch<OddsReferenciaResponse>('/api/admin/pronosticos-ia/odds-referencia', {
    method: 'POST',
    body: JSON.stringify({ fixtureId }),
  });
}

export function comparePronosticosPegados(fixtureId: number, jsonText: string) {
  return adminFetch<ComparadorResponse>('/api/admin/pronosticos-ia/comparador', {
    method: 'POST',
    body: JSON.stringify({ fixtureId, jsonText }),
  });
}

export function fetchMelbetOdds(fixtureId: number) {
  return adminFetch<MelbetOddsResponse>(`/api/admin/pronosticos-ia/melbet/${fixtureId}/odds`);
}

export function fetchMelbetStatistics(fixtureId: number) {
  return adminFetch<Record<string, unknown>>(
    `/api/admin/pronosticos-ia/melbet/${fixtureId}/statistics`,
  );
}

export function fetchPartidos(params: {
  desde: string;
  hasta: string;
  sinArbitro?: boolean;
  sinStats?: boolean;
}) {
  const qs = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
  if (params.sinArbitro) qs.set('sinArbitro', '1');
  if (params.sinStats) qs.set('sinStats', '1');
  return adminFetch<PartidosResponse>(`/api/admin/partidos/rango?${qs}`);
}

export function syncPartidosStats(payload: {
  desde: string;
  hasta: string;
  onlyMissing?: boolean;
  useFlb?: boolean;
}) {
  return adminFetch<SyncStatsResponse>('/api/admin/partidos/sync-stats', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function repairPartidosReferees(payload: { desde: string; hasta: string }) {
  return adminFetch<RepairRefereesResponse>('/api/admin/partidos/repair-referees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchPartidoStatistics(fixtureId: number) {
  return adminFetch<FixtureStatisticsResponse>(
    `/api/admin/partidos/fixtures/${fixtureId}/statistics`,
  );
}

export function fetchPartidoStatisticsApi(fixtureId: number) {
  return adminFetch<PartidoStatisticsApiResponse>(
    `/api/admin/partidos/fixtures/${fixtureId}/statistics-api`,
  );
}

export function syncPartidoFromApi(fixtureId: number) {
  return adminFetch<{ success: boolean; statistics?: FixtureStatisticsResponse; error?: string }>(
    `/api/admin/partidos/fixtures/${fixtureId}/sync-from-api`,
    { method: 'POST' },
  );
}

export function searchReferees(params: {
  q: string;
  fixtureId?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams({ q: params.q });
  if (params.fixtureId) qs.set('fixtureId', String(params.fixtureId));
  if (params.limit) qs.set('limit', String(params.limit));
  return adminFetch<RefereeSearchResponse>(`/api/admin/partidos/referees/search?${qs}`);
}

export function fetchRefereeHistory(name: string, fixtureId?: number) {
  const qs = new URLSearchParams({ name });
  if (fixtureId) qs.set('fixtureId', String(fixtureId));
  return adminFetch<RefereeHistoryResponse>(
    `/api/admin/partidos/referees/discipline-history?${qs}`,
  );
}

export function fetchRefereeFromApi(fixtureId: number) {
  return adminFetch<{
    success: boolean;
    refereeFromApi?: string | null;
    fixturerefereeInDb?: string | null;
    error?: string;
  }>(`/api/admin/partidos/fixtures/${fixtureId}/referee-from-api`);
}

export function saveFixtureReferee(fixtureId: number, fixturereferee: string) {
  return adminFetch<{ success: boolean; fixturereferee?: string; error?: string }>(
    `/api/admin/partidos/fixtures/${fixtureId}/referee`,
    {
      method: 'POST',
      body: JSON.stringify({ fixturereferee }),
    },
  );
}

export function fetchSuscripcionProductos() {
  return adminFetch<SuscripcionProductosResponse>('/api/admin/suscripciones/productos');
}

export function fetchSuscripciones(params: {
  email?: string;
  search?: string;
  app?: string;
  estado?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params.email) qs.set('email', params.email);
  if (params.search) qs.set('search', params.search);
  if (params.app && params.app !== 'todas') qs.set('app', params.app);
  if (params.estado && params.estado !== 'todas') qs.set('estado', params.estado);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  return adminFetch<SuscripcionesResponse>(`/api/admin/suscripciones?${qs}`);
}

export function createSuscripcion(payload: SuscripcionSavePayload) {
  return adminFetch<SuscripcionMutationResponse>('/api/admin/suscripciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateSuscripcion(id: string, payload: Partial<SuscripcionSavePayload>) {
  return adminFetch<SuscripcionMutationResponse>(`/api/admin/suscripciones/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function fetchDashboardSummary() {
  return adminFetch<DashboardSummary>('/api/admin/dashboard/summary');
}

export function fetchDashboardOps() {
  return adminFetch<OpsSnapshot>('/api/admin/dashboard/ops');
}

export function fetchRuntimeSettings() {
  return adminFetch<RuntimeSettingsSnapshot>('/api/admin/runtime-settings');
}

export function updateRuntimeSettings(settings: Record<string, boolean | number>) {
  return adminFetch<RuntimeSettingsSnapshot>('/api/admin/runtime-settings', {
    method: 'PATCH',
    body: JSON.stringify({ settings }),
  });
}

export function killLiveRuntime() {
  return adminFetch<RuntimeSettingsSnapshot>('/api/admin/runtime-settings/kill-live', {
    method: 'POST',
  });
}

export function resumeLiveRuntime() {
  return adminFetch<RuntimeSettingsSnapshot>('/api/admin/runtime-settings/resume-live', {
    method: 'POST',
  });
}

export type LiveAnalysisTriggerResult = {
  ok: boolean;
  fixtureId?: number;
  minute?: number | null;
  windowKey?: string;
  published?: number;
  runId?: number;
  message?: string;
  reason?: string;
  error?: string;
};

export function triggerLiveAnalysisManual(fixtureId: number) {
  return adminFetch<LiveAnalysisTriggerResult>(
    '/api/admin/pronosticos-ia/live-analysis/trigger',
    {
      method: 'POST',
      body: JSON.stringify({ fixtureId }),
    },
  );
}

export function fetchLiveAnalysisRuns(fixtureId: number) {
  return adminFetch<LiveAnalysisRunsResponse>(
    `/api/admin/pronosticos-ia/live-analysis/${fixtureId}`,
  );
}
