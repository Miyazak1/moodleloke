# Backend Architecture And Account Security Launch Plan - 2026-05-26

## Purpose

This document turns the backend, architecture, and account-security launch work into an ordered execution plan. It complements `docs/release-checklist.md`, `docs/ops-runbook.md`, `docs/backup-restore.md`, and `docs/concurrency-and-idempotency-plan.md`.

Current frontend style consistency work has been committed, but the repository still contains many unstaged backend, routing, i18n, payment, seed, and data-model changes. Before launch, those changes must be grouped, verified, and either committed or explicitly deferred.

## Launch Readiness Position

Soft launch is plausible after a focused backend/security/release-gate pass. Production launch should wait until real staging, backup restore, migration, account-security, and release-evidence gates are complete.

Do not add new product scope during this pass unless it fixes a blocker. The goal is to reduce launch risk, not expand the release.

## Execution Status - 2026-05-26

Completed in this pass:

- Phase 0 worktree triage was documented in `docs/launch-worktree-triage-2026-05-26.md`.
- `npm run prisma:validate` passed.
- `npm run backend:build` passed.
- `npm run verify:backend` passed.
- `npm run verify:security` initially failed on backend production supply-chain findings for `express` and `qs`; the backend lockfile was updated to resolve the audit findings, then `npm run verify:security` passed.
- `npm run verify:cookie-only` passed, including CSRF rejection, cross-origin rejection, Bearer refresh rejection, logout, and after-logout refresh rejection.
- `npm run verify:ops` passed, including readiness, security headers, protected metrics access, CSP report handling, backup dry-run, and production env smoke.
- `npm run verify:release-concurrency` passed, including public write race smoke and admin stale-edit smoke.

Current next step:

- Review and decide the release scope for the grouped remaining work, especially Past Papers and Gumroad/payment changes, before staging or committing those code groups.

## Phase 0 - Freeze And Triage The Worktree

Goal: make the remaining work reviewable and releasable.

Checklist:

- Split current unstaged changes by concern: backend/API, Prisma/migrations, payments/orders, i18n, route loading, past papers, seeds/content, frontend shell, and release scripts.
- For each group, decide one of three outcomes: include in this release, commit behind a disabled path, or defer/revert with explicit approval.
- Keep generated evidence and Playwright output out of git.
- Avoid broad commits that mix backend, content seeds, and frontend behavior.

Suggested checks:

```bash
git status --short
git diff --stat
git diff --name-only
```

Exit criteria:

- Every remaining change has an owner category.
- Release-bound changes are staged and committed in reviewable groups.
- Non-release changes are either left clearly unstaged or moved out of the release branch/worktree.

## Phase 1 - Backend Build, Schema, And Core Security Gate

Goal: prove the backend can build, the Prisma schema is valid, and baseline backend security tests pass.

Status: passed on 2026-05-26 after resolving the backend production supply-chain findings.

Required commands:

```bash
npm run prisma:validate
npm run backend:build
npm run verify:backend
npm run verify:security
```

Review targets:

- `backend/src/main.ts` for global security middleware, CORS, request logging, and production-only behavior.
- `backend/src/health/health.controller.ts` for non-sensitive health/readiness output.
- `backend/src/app.module.ts` for module wiring and accidental exposure of unfinished modules.
- Prisma schema and migrations for destructive or launch-sensitive changes.

Exit criteria:

- Backend build is clean.
- Security tests pass.
- Production env smoke passes.
- Health/readiness endpoints do not leak secrets.

## Phase 2 - Account And Session Security

Goal: make login, refresh, logout, role authorization, and admin protection safe enough for staging/production.

Status: automated cookie-only and ops gates passed on 2026-05-26. Manual role-boundary QA is still pending.

Required checks:

```bash
npm run verify:cookie-only
npm run verify:ops
```

Account-security checklist:

- Production/staging uses `AUTH_REFRESH_COOKIE_ENABLED=true`.
- HTTPS environments use `AUTH_COOKIE_SECURE=true`.
- Staging/production uses `AUTH_LEGACY_REFRESH_FALLBACK_ENABLED=false`.
- Refresh and logout require CSRF double-submit protection.
- Frontend build-time CSRF names match backend settings when customized.
- CORS allows only expected origins; do not use wildcard production origins.
- Access tokens and refresh tokens are not logged.
- Logout clears refresh cookie, CSRF cookie, and stale localStorage refresh tokens.
- Expired access token refresh does not create a 401 loop.
- Admin-only frontend routes are backed by backend role checks, not only UI hiding.
- A normal user token cannot call admin APIs.
- Unauthenticated requests cannot reach protected APIs.
- Two admins cannot concurrently disable all active admins.

Manual QA:

- Login, refresh, logout, then reload.
- Try refresh/logout from a cross-origin request and confirm rejection.
- Try admin pages and admin APIs as a normal user.
- Try disabling admins from two sessions and confirm at least one active admin remains.

Exit criteria:

- Cookie-only smoke passes.
- Admin and protected API authorization boundaries are verified.
- No known token, password, secret, or signature value appears in logs.

## Phase 3 - Concurrency, Idempotency, And Data Integrity

Goal: prevent double-submit, retry, stale-edit, and webhook replay bugs before launch.

Status: `npm run verify:release-concurrency` passed on 2026-05-26. Manual two-browser stale-edit QA is still pending.

Required commands:

```bash
npm run verify:concurrency
npm run verify:admin-concurrency
npm run verify:release-concurrency
```

Risk areas:

- Cart add and checkout should be idempotent.
- Payment callbacks should be replay-safe.
- Compare list limits should hold under concurrent adds.
- Mock exam and special-practice submit should not create inconsistent duplicate records.
- Admin stale edits should return conflicts instead of silently overwriting.
- Admin school, scholarship, content, city guide, timeline, mock exam, and special-practice resources should carry expected version fields where relevant.

Exit criteria:

- Public write race smoke passes.
- Admin stale-edit smoke passes.
- Manual two-browser stale-edit QA passes for major admin resources.

## Phase 4 - Payments, Orders, And Commercial Scope

Goal: decide whether commerce is launch scope or explicitly non-launch scope.

If commerce is not part of this release:

- Keep public copy clear that paid unlock/commercial checkout is not supported.
- Avoid UI states that imply completed real payment if the backend is still simulated or Gumroad-only.
- Keep order/payment admin views useful for internal testing but not marketed as production commerce.

If commerce is part of this release:

- Verify hosted checkout settings such as `GUMROAD_PRODUCT_URL` and `GUMROAD_ACCESS_TOKEN`.
- Verify callback endpoint ownership and replay behavior.
- Confirm sale verification happens through the provider API before marking orders paid.
- Confirm duplicate callbacks are idempotent.
- Confirm failed, pending, paid, and canceled states have clear transitions.
- Add or update payment-focused smoke tests before release.

Exit criteria:

- Commerce scope is written into release notes/checklist.
- Payment state transitions and callback replay are verified or clearly deferred.

## Phase 5 - Deployment Architecture And Ops Readiness

Goal: prove the app can run in the intended deployment shape with correct readiness, logging, Redis, CSP, and metrics controls.

Required commands:

```bash
npm run verify:docker:status
npm run verify:docker
npm run verify:docker:staging-local
npm run verify:ops
```

Configuration checklist:

- `DATABASE_URL` is set and points to the intended database.
- `AUTH_SECRET` is strong and not reused from local examples.
- `CORS_ORIGINS` contains only expected frontend origins.
- `PUBLIC_APP_ORIGIN` matches the deployed frontend origin.
- `LOG_FORMAT=json` is set for production.
- `CSP_MODE=report-only` is used at staging first.
- `RATE_LIMIT_STORE=redis` and `RATE_LIMIT_REDIS_URL` or `REDIS_URL` are set for staging/production.
- `/api/v1/ops/ready` reports Redis-backed shared rate limiting when Redis is required.
- `/api/v1/ops/metrics` is protected by token or private network access.
- Docker production stack has healthy `db`, `redis`, `migrate`, `backend`, and `frontend` services.

Exit criteria:

- Local Docker staging rehearsal passes.
- Readiness and metrics do not expose secrets.
- Logs include request IDs and redact sensitive query fields.

## Phase 6 - Database Migration, Backup, And Restore Drill

Goal: make database changes and rollback survivable.

Required commands:

```bash
npm run db:migrate:status
npm run db:backup -- --dry-run
npm run db:backup
npm run db:restore:smoke -- <backup-file> --dry-run
npm run verify:backup-restore-drill -- <backup-file>
```

Migration checklist:

- Confirm target database migration order.
- Confirm migrations `0018` through `0021` are applied before enabling the related concurrency/admin flows.
- Confirm new schema fields are compatible with existing data and seed scripts.
- Confirm no destructive migration is being hidden inside a broad release.

Exit criteria:

- A real backup exists outside the repo and outside the public web root.
- A restore drill succeeds against a disposable restore target.
- Migration status is captured as release evidence.

## Phase 7 - Staging And Release Candidate Gate

Goal: run the release the same way users and operators will experience it.

Required commands:

```bash
npm run verify:release-candidate
STAGING_BASE_URL=https://staging.example.com npm run verify:staging
STAGING_BASE_URL=https://staging.example.com OPS_METRICS_TOKEN=... npm run verify:staging:full
```

Manual staging QA:

- Homepage and public navigation.
- Login, refresh, logout, and protected account route.
- Schools list, school detail, compare, and saved schools.
- Mock exam happy path and report snapshot.
- Special practice happy path and visualizer routes.
- Admin login, admin audit, content edit, school edit, mock exam edit, and special-practice edit.
- Cart/checkout route behavior according to the commerce scope decision.
- Desktop, tablet, and mobile layouts with no horizontal overflow.

Exit criteria:

- Release candidate gate passes.
- Staging full gate passes.
- Manual QA results and evidence are archived outside the repo.

## Recommended Execution Order

1. Worktree triage and grouped commits.
2. Backend build/schema/security gate.
3. Account/session security audit.
4. Concurrency and admin stale-edit gates.
5. Commerce scope decision.
6. Docker/ops readiness.
7. Backup and restore drill.
8. Release-candidate gate.
9. Real staging full gate.
10. Final release checklist signoff.

## Blockers Before Soft Launch

- Dirty worktree contains release-bound backend or schema changes that are not grouped and verified.
- `verify:backend`, `verify:security`, `verify:cookie-only`, or `verify:release-concurrency` fails.
- Staging/production account security cannot run with HttpOnly refresh cookies and CSRF protection.
- Target database migration status is unknown.
- No usable backup and restore drill evidence exists.
- Admin role checks or protected API boundaries are not verified.

## Non-Blocking But Important Follow-Ups

- Split large frontend chunks, especially Three.js visualizer chunks.
- Continue i18n debt cleanup after release-bound user-facing copy is stable.
- Expand account analytics only after core account/session security is stable.
- Add richer payment-provider integration tests if commercial checkout enters scope.
- Move CSP from report-only to enforce only after staging reports are clean.
