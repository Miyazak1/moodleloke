import { type AuthResult, type User } from './api';
import {
  API_BASE,
  AUTH_CHANGE_EVENT,
  beginLogout,
  buildCsrfHeaders,
  clearStoredAuthTokens,
  finishLogout,
  readStoredRefreshToken,
  readStoredToken,
  refreshStoredAccessToken,
  requestJson,
  storeAuthTokens,
  TOKEN_KEY
} from './request';

export { AUTH_CHANGE_EVENT } from './request';

function emitAuthChange() {
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

function isJwtExpired(token: string) {
  const [, payload] = token.split('.');
  if (!payload) return false;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const body = JSON.parse(window.atob(padded)) as { exp?: number };
    return typeof body.exp === 'number' && body.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

export function getStoredToken() {
  const token = readStoredToken();
  if (token && isJwtExpired(token)) {
    clearStoredAuthTokens();
    return null;
  }
  return token;
}

export function storeToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  emitAuthChange();
}

export function startGoogleLogin(redirectTo?: string) {
  clearStoredAuthTokens();
  const url = new URL(`${API_BASE}/api/v1/auth/google/start`, window.location.origin);
  if (redirectTo) url.searchParams.set('redirect', redirectTo);
  window.location.assign(url.toString());
}

export async function startGoogleLink(redirectTo = '/me?section=settings') {
  const url = new URL('/api/v1/auth/google/link/start', window.location.origin);
  url.searchParams.set('redirect', redirectTo);
  const result = await requestJson<{ authorizationUrl: string }>(`${url.pathname}${url.search}`, {
    method: 'POST',
    credentials: 'include',
    withAuth: true
  });
  window.location.assign(result.authorizationUrl);
}

export async function logout() {
  beginLogout();
  const refreshToken = readStoredRefreshToken();
  try {
    if (refreshToken) {
      await requestJson<{ revoked: true }>('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${refreshToken}`, ...buildCsrfHeaders() },
        skipAuthRefresh: true
      });
    } else {
      await requestJson<{ revoked: true }>('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: buildCsrfHeaders(),
        skipAuthRefresh: true
      });
    }
  } catch {
    // Local logout should still complete even if the network is unavailable.
  } finally {
    clearStoredAuthTokens();
    finishLogout();
  }
}

export async function login(email: string, password: string) {
  const result = await requestJson<AuthResult>('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  storeAuthTokens(result.tokens);
  return result;
}

export async function register(email: string, password: string) {
  const result = await requestJson<AuthResult>('/api/v1/auth/register', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  storeAuthTokens(result.tokens);
  return result;
}

export async function getMe() {
  let token = getStoredToken();
  if (!token) {
    token = await refreshStoredAccessToken();
  }
  if (!token) {
    return Promise.reject(new Error('请先登录。'));
  }
  return requestJson<User>('/api/v1/auth/me', { withAuth: true });
}

export async function updateMeProfile(payload: { displayName: string }) {
  const token = getStoredToken();
  if (!token) {
    return Promise.reject(new Error('请先登录。'));
  }
  const user = await requestJson<User>('/api/v1/auth/me/profile', {
    method: 'PATCH',
    withAuth: true,
    body: JSON.stringify(payload)
  });
  emitAuthChange();
  return user;
}

export function updateMePassword(payload: { currentPassword?: string; newPassword: string }) {
  const token = getStoredToken();
  if (!token) {
    return Promise.reject(new Error('请先登录。'));
  }
  return requestJson<{ updated: true }>('/api/v1/auth/me/password', {
    method: 'PATCH',
    withAuth: true,
    body: JSON.stringify(payload)
  });
}

export function resendEmailVerification() {
  const token = getStoredToken();
  if (!token) {
    return Promise.reject(new Error('请先登录。'));
  }
  return requestJson<{ sent: boolean; alreadyVerified: boolean }>('/api/v1/auth/email/verification/resend', {
    method: 'POST',
    withAuth: true
  });
}

export function forgotPassword(email: string) {
  return requestJson<{ sent: true }>('/api/v1/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export function resetPassword(token: string, password: string) {
  return requestJson<{ reset: true }>('/api/v1/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password })
  });
}
