import { API_BASE, readStoredToken } from './request';

export type PublicTelemetryRoute = 'home' | 'about' | 'csca_prep' | 'auth' | 'agent' | 'me' | 'onboarding';
export type PublicTelemetryTarget = PublicTelemetryRoute | 'official_csca';
export type PublicTelemetryEvent = {
  eventType: 'public_page_view' | 'public_cta_click' | 'auth_started' | 'auth_completed' | 'email_verification_result' | 'agent_entry' | 'public_client_error';
  route?: PublicTelemetryRoute;
  locale?: 'zh-CN' | 'en' | 'vi';
  target?: PublicTelemetryTarget;
  method?: 'email' | 'google' | 'session';
  mode?: 'login' | 'register' | 'forgot' | 'reset' | 'verify';
  result?: 'success' | 'failure' | 'cancelled' | 'pending' | 'continued_unverified';
  reason?: 'api_error' | 'invalid_or_expired' | 'not_verified' | 'send_failed' | 'resend_success' | 'google_failed' | 'google_denied' | 'account_disabled' | 'admin_google_binding_required' | 'google_not_configured' | 'google_email_unverified' | 'unknown';
  component?: 'route' | 'auth' | 'content' | 'agent_entry';
};

const VISIT_KEY = 'cscapilot.publicVisitId';
const PAGE_PREFIX = 'cscapilot.pageView.';

function telemetryEnabled() {
  if (typeof window === 'undefined' || import.meta.env.DEV) return false;
  if ((import.meta.env.VITE_PUBLIC_TELEMETRY_ENABLED as string | undefined)?.trim() === 'false') return false;
  return navigator.doNotTrack !== '1' && window.doNotTrack !== '1';
}

function visitId() {
  const existing = window.sessionStorage.getItem(VISIT_KEY);
  if (existing) return existing;
  const next = window.crypto.randomUUID();
  window.sessionStorage.setItem(VISIT_KEY, next);
  return next;
}

export function trackPublicEvent(event: PublicTelemetryEvent) {
  if (!telemetryEnabled()) return;
  const token = readStoredToken();
  void fetch(`${API_BASE}/api/v1/public/telemetry`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ ...event, visitId: visitId() })
  }).catch(() => undefined);
}

export function trackPublicPageView(route: PublicTelemetryRoute, locale: 'zh-CN' | 'en' | 'vi') {
  if (!telemetryEnabled()) return;
  const key = `${PAGE_PREFIX}${visitId()}.${route}.${locale}`;
  if (window.sessionStorage.getItem(key)) return;
  window.sessionStorage.setItem(key, '1');
  trackPublicEvent({ eventType: 'public_page_view', route, locale, component: 'route' });
}
