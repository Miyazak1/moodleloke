export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || (import.meta.env.DEV ? 'http://localhost:3000' : '');
export const TOKEN_KEY = 'cscalite.accessToken';
export const REFRESH_TOKEN_KEY = 'cscalite.refreshToken';
export const AUTH_CHANGE_EVENT = 'cscalite:auth-changed';
export const EMAIL_UNVERIFIED_EVENT = 'cscalite:email-unverified';
const CSRF_COOKIE_NAME = (import.meta.env.VITE_AUTH_CSRF_COOKIE_NAME as string | undefined)?.trim() || 'cscalite_csrf';
const CSRF_HEADER_NAME = (import.meta.env.VITE_AUTH_CSRF_HEADER_NAME as string | undefined)?.trim() || 'X-CSRF-Token';

type JsonRequestOptions = RequestInit & {
  withAuth?: boolean;
  skipAuthRefresh?: boolean;
  preserveAuthOnUnauthorized?: boolean;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<string | null> | null = null;
let isLoggingOut = false;
const pendingJsonRequests = new Map<string, Promise<unknown>>();

function emitAuthChange() {
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export function readStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function readStoredRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuthTokens(tokens: TokenPair) {
  window.localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  emitAuthChange();
}

export function clearStoredAuthTokens() {
  const hadStoredTokens = Boolean(window.localStorage.getItem(TOKEN_KEY) || window.localStorage.getItem(REFRESH_TOKEN_KEY));
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  if (hadStoredTokens) emitAuthChange();
}

export function beginLogout() {
  isLoggingOut = true;
}

export function finishLogout() {
  isLoggingOut = false;
}

function readCookieValue(name: string) {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export function buildCsrfHeaders() {
  const token = readCookieValue(CSRF_COOKIE_NAME);
  if (!token) return {};
  try {
    return { [CSRF_HEADER_NAME]: decodeURIComponent(token) };
  } catch {
    return { [CSRF_HEADER_NAME]: token };
  }
}

async function parseErrorMessage(response: Response) {
  let message = `Request failed: ${response.status}`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join('；');
    else if (body.message) message = body.message;
  } catch {
    // Keep the HTTP fallback if the backend response is not JSON.
  }
  return message;
}

async function parseApiError(response: Response) {
  let code: string | undefined;
  let message = `Request failed: ${response.status}`;
  try {
    const body = (await response.clone().json()) as { code?: string; message?: string | string[] };
    code = body.code;
    if (Array.isArray(body.message)) message = body.message.join(' ');
    else if (body.message) message = body.message;
  } catch {
    message = await parseErrorMessage(response);
  }
  return new ApiError(message, response.status, code);
}

export function isEmailUnverifiedError(error: unknown) {
  return error instanceof ApiError && error.code === 'email_unverified';
}

export async function refreshStoredAccessToken(options: { clearOnFailure?: boolean } = {}) {
  const shouldClearOnFailure = options.clearOnFailure !== false;
  if (isLoggingOut) {
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfHeaders = buildCsrfHeaders();
      if (Object.keys(csrfHeaders).length > 0) {
        const cookieResponse = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...csrfHeaders
          }
        });
        if (cookieResponse.ok) {
          const body = (await cookieResponse.json()) as { tokens?: Partial<TokenPair> };
          if (body.tokens?.accessToken) {
            window.localStorage.setItem(TOKEN_KEY, body.tokens.accessToken);
            window.localStorage.removeItem(REFRESH_TOKEN_KEY);
            emitAuthChange();
            return body.tokens.accessToken;
          }
        }
      }

      const refreshToken = readStoredRefreshToken();
      if (!refreshToken) {
        if (shouldClearOnFailure) clearStoredAuthTokens();
        return null;
      }

      const bearerResponse = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshToken}`
        }
      });
      if (!bearerResponse.ok) {
        if (shouldClearOnFailure) clearStoredAuthTokens();
        return null;
      }
      const body = (await bearerResponse.json()) as { tokens?: Partial<TokenPair> };
      if (!body.tokens?.accessToken) {
        if (shouldClearOnFailure) clearStoredAuthTokens();
        return null;
      }
      window.localStorage.setItem(TOKEN_KEY, body.tokens.accessToken);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      emitAuthChange();
      return body.tokens.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function jsonRequestDedupeKey(path: string, options: JsonRequestOptions) {
  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET' || options.body) return null;
  const token = options.withAuth ? readStoredToken() ?? '' : '';
  return [
    method,
    path,
    options.withAuth ? 'auth' : 'public',
    options.skipAuthRefresh ? 'skip-refresh' : 'refresh',
    options.preserveAuthOnUnauthorized ? 'preserve-401' : 'clear-401',
    token
  ].join('|');
}

export async function requestJson<T>(path: string, options: JsonRequestOptions = {}, isRetry = false): Promise<T> {
  const dedupeKey = isRetry ? null : jsonRequestDedupeKey(path, options);
  if (dedupeKey) {
    const pending = pendingJsonRequests.get(dedupeKey);
    if (pending) return pending as Promise<T>;
    const request = requestJsonInternal<T>(path, options, isRetry).finally(() => {
      pendingJsonRequests.delete(dedupeKey);
    });
    pendingJsonRequests.set(dedupeKey, request);
    return request;
  }
  return requestJsonInternal<T>(path, options, isRetry);
}

async function requestJsonInternal<T>(path: string, options: JsonRequestOptions = {}, isRetry = false): Promise<T> {
  const { withAuth, skipAuthRefresh, preserveAuthOnUnauthorized, headers, ...fetchOptions } = options;
  let token = withAuth ? readStoredToken() : null;
  if (withAuth && !token && !skipAuthRefresh) {
    token = await refreshStoredAccessToken({ clearOnFailure: !preserveAuthOnUnauthorized });
  }
  if (withAuth && !token) {
    throw new ApiError('请先登录。', 401, 'auth_required');
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    credentials: fetchOptions.credentials,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {})
    }
  });

  if (response.status === 401 && withAuth && !skipAuthRefresh && !isRetry) {
    const latestToken = readStoredToken();
    if (token && latestToken && latestToken !== token) {
      return requestJson<T>(path, options, true);
    }
    const refreshedToken = await refreshStoredAccessToken({ clearOnFailure: !preserveAuthOnUnauthorized });
    if (refreshedToken) {
      return requestJson<T>(path, options, true);
    }
  }

  if (!response.ok) {
    const error = await parseApiError(response);
    if (withAuth && response.status === 401 && !preserveAuthOnUnauthorized) {
      clearStoredAuthTokens();
    }
    if (error.code === 'email_unverified' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EMAIL_UNVERIFIED_EVENT, { detail: { message: error.message } }));
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function toQueryString(params: Record<string, string | number | boolean | undefined | null> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}
