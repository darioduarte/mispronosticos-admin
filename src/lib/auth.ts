'use client';

import type { AdminUser, AuthSession } from './types';

const ACCESS_KEY = 'mp_admin_access_token';
const REFRESH_KEY = 'mp_admin_refresh_token';
const USER_KEY = 'mp_admin_user';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ACCESS_KEY);
  if (!raw) return null;
  const token = raw.trim();
  return token.length > 0 ? token : null;
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(REFRESH_KEY);
  if (!raw) return null;
  const token = raw.trim();
  return token.length > 0 ? token : null;
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
