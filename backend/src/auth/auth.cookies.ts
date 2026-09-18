import { ForbiddenException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { isProductionRuntime } from '../common/runtime-environment';

const REFRESH_COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60;
const OAUTH_STATE_COOKIE_TTL_SECONDS = 10 * 60;

function parseCorsOrigins() {
  return (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalDevOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function normalizeCookieName(value: string | undefined) {
  const name = value?.trim() || 'moodlelike_refresh';
  return /^[A-Za-z0-9._-]+$/.test(name) ? name : 'moodlelike_refresh';
}

function normalizeCsrfCookieName(value: string | undefined) {
  const name = value?.trim() || 'moodlelike_csrf';
  return /^[A-Za-z0-9._-]+$/.test(name) ? name : 'moodlelike_csrf';
}

function normalizeCsrfHeaderName(value: string | undefined) {
  const name = value?.trim().toLowerCase() || 'x-csrf-token';
  return /^[a-z0-9-]+$/.test(name) ? name : 'x-csrf-token';
}

function normalizeOAuthStateCookieName(value: string | undefined) {
  const name = value?.trim() || 'moodlelike_oauth_state';
  return /^[A-Za-z0-9._-]+$/.test(name) ? name : 'moodlelike_oauth_state';
}

function getHeaderValue(headers: Record<string, string | string[] | undefined> | undefined, name: string) {
  const value =
    headers?.[name] ??
    headers?.[name.toLowerCase()] ??
    Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  return Array.isArray(value) ? value[0] : value;
}

function encodeCookieValue(value: string) {
  return encodeURIComponent(value).replace(/[!'()]/g, escape);
}

export function isRefreshCookieEnabled() {
  return process.env.AUTH_REFRESH_COOKIE_ENABLED !== 'false';
}

export function isLegacyRefreshFallbackEnabled() {
  return process.env.AUTH_LEGACY_REFRESH_FALLBACK_ENABLED !== 'false';
}

export function getRefreshCookieName() {
  return normalizeCookieName(process.env.AUTH_REFRESH_COOKIE_NAME);
}

export function getCsrfCookieName() {
  return normalizeCsrfCookieName(process.env.AUTH_CSRF_COOKIE_NAME);
}

export function getCsrfHeaderName() {
  return normalizeCsrfHeaderName(process.env.AUTH_CSRF_HEADER_NAME);
}

export function getOAuthStateCookieName() {
  return normalizeOAuthStateCookieName(process.env.AUTH_GOOGLE_STATE_COOKIE_NAME);
}

export function getRefreshCookieMaxAgeSeconds() {
  return REFRESH_COOKIE_TTL_SECONDS;
}

function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rest.join('=') || '');
    }
  }
  return undefined;
}

export function readRefreshCookie(cookieHeader?: string) {
  if (!isRefreshCookieEnabled()) return undefined;
  return readCookie(cookieHeader, getRefreshCookieName());
}

export function readCsrfCookie(cookieHeader?: string) {
  return readCookie(cookieHeader, getCsrfCookieName());
}

export function readOAuthStateCookie(cookieHeader?: string) {
  return readCookie(cookieHeader, getOAuthStateCookieName());
}

function isCookieSecure() {
  return (
    process.env.AUTH_COOKIE_SECURE === 'true' ||
    (process.env.AUTH_COOKIE_SECURE !== 'false' && isProductionRuntime())
  );
}

export function buildRefreshCookie(token: string) {
  if (!isRefreshCookieEnabled()) return undefined;
  const parts = [
    `${getRefreshCookieName()}=${encodeCookieValue(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${REFRESH_COOKIE_TTL_SECONDS}`
  ];
  if (isCookieSecure()) parts.push('Secure');
  if (process.env.AUTH_COOKIE_DOMAIN) parts.push(`Domain=${process.env.AUTH_COOKIE_DOMAIN.trim()}`);
  return parts.join('; ');
}

export function buildClearRefreshCookie() {
  if (!isRefreshCookieEnabled()) return undefined;
  const parts = [`${getRefreshCookieName()}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (isCookieSecure()) parts.push('Secure');
  if (process.env.AUTH_COOKIE_DOMAIN) parts.push(`Domain=${process.env.AUTH_COOKIE_DOMAIN.trim()}`);
  return parts.join('; ');
}

export function buildCsrfCookie(token = randomBytes(24).toString('base64url')) {
  if (!isRefreshCookieEnabled()) return undefined;
  const parts = [
    `${getCsrfCookieName()}=${encodeCookieValue(token)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${REFRESH_COOKIE_TTL_SECONDS}`
  ];
  if (isCookieSecure()) parts.push('Secure');
  if (process.env.AUTH_COOKIE_DOMAIN) parts.push(`Domain=${process.env.AUTH_COOKIE_DOMAIN.trim()}`);
  return { cookie: parts.join('; '), token };
}

export function buildClearCsrfCookie() {
  if (!isRefreshCookieEnabled()) return undefined;
  const parts = [`${getCsrfCookieName()}=`, 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (isCookieSecure()) parts.push('Secure');
  if (process.env.AUTH_COOKIE_DOMAIN) parts.push(`Domain=${process.env.AUTH_COOKIE_DOMAIN.trim()}`);
  return parts.join('; ');
}

export function buildOAuthStateCookie(value: string) {
  const parts = [
    `${getOAuthStateCookieName()}=${encodeCookieValue(value)}`,
    'HttpOnly',
    'Path=/api/v1/auth/google',
    'SameSite=Lax',
    `Max-Age=${OAUTH_STATE_COOKIE_TTL_SECONDS}`
  ];
  if (isCookieSecure()) parts.push('Secure');
  if (process.env.AUTH_COOKIE_DOMAIN) parts.push(`Domain=${process.env.AUTH_COOKIE_DOMAIN.trim()}`);
  return parts.join('; ');
}

export function buildClearOAuthStateCookie() {
  const parts = [`${getOAuthStateCookieName()}=`, 'HttpOnly', 'Path=/api/v1/auth/google', 'SameSite=Lax', 'Max-Age=0'];
  if (isCookieSecure()) parts.push('Secure');
  if (process.env.AUTH_COOKIE_DOMAIN) parts.push(`Domain=${process.env.AUTH_COOKIE_DOMAIN.trim()}`);
  return parts.join('; ');
}

function tokenValuesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function assertCookieCsrf(headers: Record<string, string | string[] | undefined> | undefined) {
  const cookieToken = readCsrfCookie(getHeaderValue(headers, 'cookie'));
  const headerToken = getHeaderValue(headers, getCsrfHeaderName());
  if (!cookieToken || !headerToken || !tokenValuesMatch(cookieToken, headerToken)) {
    throw new ForbiddenException('安全校验失败，请刷新页面后重试。');
  }
}

export function assertTrustedCookieOrigin(headers: Record<string, string | string[] | undefined> | undefined) {
  const origin = getHeaderValue(headers, 'origin');
  const referer = getHeaderValue(headers, 'referer');
  let candidate = origin;
  if (!candidate && referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      throw new ForbiddenException('请求来源不被允许。');
    }
  }
  if (!candidate) return;

  const allowed = new Set(parseCorsOrigins());
  if (process.env.PUBLIC_APP_ORIGIN) allowed.add(process.env.PUBLIC_APP_ORIGIN);
  if (allowed.has(candidate)) return;
  if (!isProductionRuntime() && isLocalDevOrigin(candidate)) return;
  throw new ForbiddenException('请求来源不被允许。');
}
