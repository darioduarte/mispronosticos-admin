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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/api/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearSession();
    return null;
  }

  const data = (await res.json()) as { accessToken: string };
  const user = getStoredUser();
  if (user && getRefreshToken()) {
    saveSession({
      accessToken: data.accessToken,
      refreshToken: getRefreshToken()!,
      user,
    });
  } else {
    localStorage.setItem('mp_admin_access_token', data.accessToken);
  }
  return data.accessToken;
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  let token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    token = await refreshAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      const retryRes = await fetch(`${API_BASE}${path}`, { ...init, headers });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}));
        throw new ApiError(
          (err as { error?: string }).error || retryRes.statusText,
          retryRes.status,
        );
      }
      return retryRes.json() as Promise<T>;
    }
    throw new ApiError('Sesión expirada', 401);
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
  const res = await fetch(`${API_BASE}/api/admin/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Error al iniciar sesión', res.status);
  }

  const session: AuthSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
  saveSession(session);
  return session;
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Error al iniciar sesión', res.status);
  }

  const session: AuthSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
  saveSession(session);
  return session;
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
