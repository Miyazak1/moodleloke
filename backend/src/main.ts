import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { getPastPaperUploadDir } from './past-papers/past-paper-storage';
import { AppModule } from './app.module';
import { getCspMode, recordRequestMetrics } from './common/ops-metrics';
import { runWithRequestContext } from './common/request-context';
import { StructuredErrorFilter } from './common/structured-error.filter';

const logger = new Logger('Bootstrap');
const express = require('express');
const { json, urlencoded } = express;

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.CSC_ENV === 'production';
}

function getAuthSecretConfigured() {
  return Boolean(process.env.AUTH_SECRET || process.env.JWT_SECRET);
}

function parseCorsOrigins() {
  return (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function assertProductionEnv() {
  if (!isProductionRuntime()) return;
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!getAuthSecretConfigured()) missing.push('AUTH_SECRET');
  if (!process.env.PAYMENT_CALLBACK_SECRET) missing.push('PAYMENT_CALLBACK_SECRET');
  if (!parseCorsOrigins().length) missing.push('CORS_ORIGINS');
  if (missing.length) {
    throw new Error(`Production startup blocked; missing required env: ${missing.join(', ')}`);
  }

  const unsafeValues = [
    process.env.AUTH_SECRET,
    process.env.JWT_SECRET,
    process.env.PAYMENT_CALLBACK_SECRET
  ].filter(Boolean);
  const knownLocalOrPlaceholderSecrets = new Set([
    'cscalite-local-rebuild-secret',
    'cscalite-local-payment-callback-secret',
    'local-dev-rebuild-secret-change-before-production',
    'local-s18-launch-secret-change-before-production',
    'replace-with-a-long-random-auth-secret',
    'replace-with-a-long-random-payment-callback-secret',
    'REPLACE_WITH_PRODUCTION_AUTH_SECRET',
    'REPLACE_WITH_PRODUCTION_PAYMENT_CALLBACK_SECRET'
  ]);
  if (unsafeValues.some((value) => knownLocalOrPlaceholderSecrets.has(value as string))) {
    throw new Error('Production startup blocked; local or placeholder secrets are not allowed.');
  }

  try {
    const databaseUrl = new URL(process.env.DATABASE_URL as string);
    const host = databaseUrl.hostname.toLowerCase();
    const localHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (localHost && process.env.ALLOW_LOCAL_DATABASE_IN_PRODUCTION !== '1') {
      throw new Error('Production startup blocked; DATABASE_URL points to a local database host.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Production startup blocked')) {
      throw error;
    }
    throw new Error('Production startup blocked; DATABASE_URL is not a valid URL.');
  }
}

function isLocalDevOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function buildCorsOriginChecker() {
  const configuredOrigins = parseCorsOrigins();
  const production = isProductionRuntime();
  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (configuredOrigins.includes(origin) || (!production && isLocalDevOrigin(origin))) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

function shouldUseJsonLogs() {
  return process.env.LOG_FORMAT?.toLowerCase() === 'json';
}

function sanitizeRequestUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'http://cscalite.local');
    for (const [key] of parsed.searchParams) {
      if (/token|password|secret|signature/i.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return rawUrl.replace(/([?&][^=]*(?:token|password|secret|signature)[^=]*=)[^&]*/gi, '$1[redacted]');
  }
}

function logRequest(entry: { method: string; url: string; statusCode: number; durationMs: number; requestId: string }) {
  if (shouldUseJsonLogs()) {
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'http_request',
        method: entry.method,
        path: sanitizeRequestUrl(entry.url),
        status: entry.statusCode,
        durationMs: entry.durationMs,
        requestId: entry.requestId,
        timestamp: new Date().toISOString()
      })
    );
    return;
  }
  logger.log(`${entry.method} ${sanitizeRequestUrl(entry.url)} ${entry.statusCode} ${entry.durationMs}ms requestId=${entry.requestId}`);
}

function buildCspPolicy() {
  const cspMode = getCspMode();
  if (cspMode === 'off') return null;
  const origins = new Set<string>(["'self'"]);
  for (const origin of parseCorsOrigins()) origins.add(origin);
  if (process.env.PUBLIC_APP_ORIGIN) origins.add(process.env.PUBLIC_APP_ORIGIN);
  if (!isProductionRuntime()) {
    origins.add('http://localhost:*');
    origins.add('http://127.0.0.1:*');
    origins.add('ws://localhost:*');
    origins.add('ws://127.0.0.1:*');
  }
  const reportUri = process.env.CSP_REPORT_URI || '/api/v1/ops/csp-report';
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${Array.from(origins).join(' ')}`,
    `report-uri ${reportUri}`
  ].join('; ');
}

function buildEmbeddableDocumentCspPolicy() {
  const ancestors = new Set<string>(["'self'"]);
  for (const origin of parseCorsOrigins()) ancestors.add(origin);
  if (process.env.PUBLIC_APP_ORIGIN) ancestors.add(process.env.PUBLIC_APP_ORIGIN);
  if (!isProductionRuntime()) {
    ancestors.add('http://localhost:*');
    ancestors.add('http://127.0.0.1:*');
  }
  return `default-src 'none'; frame-ancestors ${Array.from(ancestors).join(' ')}`;
}

async function bootstrap() {
  assertProductionEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
  app.use(urlencoded({ extended: false, limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
  app.useGlobalFilters(new StructuredErrorFilter());
  app.enableCors({
    origin: buildCorsOriginChecker(),
    credentials: true
  });
  app.use((_request: any, response: any, next: () => void) => {
    const cspPolicy = buildCspPolicy();
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('cross-origin-resource-policy', 'same-site');
    if (cspPolicy) {
      response.setHeader(getCspMode() === 'enforce' ? 'content-security-policy' : 'content-security-policy-report-only', cspPolicy);
    }
    next();
  });
  app.use((request: any, response: any, next: () => void) => {
    const startedAt = Date.now();
    const existingRequestId = request.headers['x-request-id'];
    const requestId = Array.isArray(existingRequestId) ? existingRequestId[0] : existingRequestId || randomUUID();
    request.requestId = requestId;
    request.startedAt = startedAt;
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      recordRequestMetrics(response.statusCode, durationMs);
      logRequest({
        method: request.method,
        url: request.originalUrl || request.url,
        statusCode: response.statusCode,
        durationMs,
        requestId
      });
    });
    runWithRequestContext({ requestId }, next);
  });
  app.use('/uploads/past-papers', express.static(getPastPaperUploadDir(), {
    fallthrough: false,
    setHeaders(response: any) {
      // Published past-paper PDFs are intentionally rendered inside the Agent
      // workspace. Keep API pages non-embeddable, but allow these documents to
      // be framed by the configured web application origins.
      response.removeHeader('x-frame-options');
      response.removeHeader('content-security-policy');
      response.removeHeader('content-security-policy-report-only');
      const cspMode = getCspMode();
      if (cspMode !== 'off') {
        response.setHeader(
          cspMode === 'enforce' ? 'content-security-policy' : 'content-security-policy-report-only',
          buildEmbeddableDocumentCspPolicy()
        );
      }
      response.setHeader('x-content-type-options', 'nosniff');
      response.setHeader('cross-origin-resource-policy', 'same-site');
      response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    }
  }));
  app.setGlobalPrefix('');
  await app.listen(Number(process.env.PORT || 3000));
}

void bootstrap();
