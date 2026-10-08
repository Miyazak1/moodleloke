# Release D — First-party observability and conversion loop

Date: 2026-10-08

## Outcome

CSCAPilot now records a small, privacy-bounded set of product events in its own database and exposes only aggregated public-site conversion data in the existing admin operations overview.

No third-party analytics SDK, advertising identifier, fingerprint, email address, password, question text, answer, free-form error message, stack trace, or URL query string is collected by this feature.

## Events

The public endpoint accepts only these event names:

- `public_page_view`
- `public_cta_click`
- `auth_started`
- `auth_completed`
- `email_verification_result`
- `agent_entry`
- `public_client_error`

Every dimension is a server-side allowlisted enum. Unknown fields are rejected. A random UUID is generated in `sessionStorage` for the current browser tab session; it is not derived from device attributes and is discarded when the session ends. Browsers with Do Not Track enabled are not measured.

## Endpoint and storage

- Ingestion: `POST /api/v1/public/telemetry`
- Storage: existing `csca_training_events` table
- Source discriminator: `public_site`
- Rate limit: 120 events per temporary visit ID per 15 minutes
- Authentication: optional; when a valid account session is present, the server may attach the account ID. The client never sends an email address or account ID in the event body.

No Prisma migration is required for this release.

## Admin reporting

The existing admin endpoint `/api/v1/admin/csca-special-practice/adaptive/events/observability` now includes `publicSite` aggregates:

- anonymous visit sessions and page views
- sessions entering the Learning Agent and entry rate
- account-flow starts, completions, and completion rate
- completed registrations
- email-verification success/failure totals
- public client-error total
- event, route, and daily distributions

Raw `public_site` rows are deliberately excluded from `recentEvents`. The admin audit overview displays summary cards, a compact conversion funnel, and route distribution only.

## Runtime controls

Telemetry is enabled by default only in production builds. Set:

```env
VITE_PUBLIC_TELEMETRY_ENABLED=false
```

to disable public client collection at build time. Development builds do not send events.

## Verification

Run:

```bash
npm run public-telemetry:test
npm run frontend:build
npm --prefix frontend run test:public-seo
npm --prefix frontend run test:standalone-shell
npm --prefix frontend run test:i18n-messages
npm --prefix frontend run test:i18n-debt
npm --prefix frontend run test:minimal
```

The telemetry contract self-test verifies accepted fields, rejection of sensitive/unknown fields, enum and UUID validation, and aggregate funnel calculations.

## Deployment check

After deploying frontend and backend, use the site normally once, then sign in as an administrator and open the backend overview. The public funnel starts from zero for this release and accumulates only new events; historical visits cannot be reconstructed.
