# CSCA Free Learning Release Readiness - 2026-05-11

## Status

- Local data, build, CI, ops, supply-chain, cookie-only, and Docker local staging gates passed.
- Real external staging verification is blocked until `STAGING_BASE_URL`, `OPS_METRICS_TOKEN`, target `DATABASE_URL`, and release permissions are available.
- Known non-blocker: Vite reports chunks over 500 kB for the main bundle and `SolidGeometryCanvas`; this is accepted for this release and should be handled later as a performance split.

## Latest Staging Handoff Check

- Rechecked local migration status: 11 migrations applied; database schema is up to date.
- Rechecked mock exam content: 3 free mock papers with 48 questions each.
- Rechecked special practice content: topics and questions validated.
- Attempted `npm run verify:staging` and `npm run verify:staging:full`; both stopped as expected because `STAGING_BASE_URL` is not configured in this environment.
- No real staging database migration, backup, or browser acceptance was run because target `DATABASE_URL`, staging origin, ops token, and release permissions are not available on this machine.

## 2026-05-11 Real Environment Handoff Attempt

- Environment scan found no configured `STAGING_BASE_URL`, target `DATABASE_URL`, `OPS_METRICS_TOKEN`, `PUBLIC_APP_ORIGIN`, or `CORS_ORIGINS` on this host.
- Re-ran local release data checks:
  - `npm run db:migrate:status` passed; 11 migrations applied and schema is up to date.
  - `npm run mock-exams:validate` passed; 3 free mock papers with 48 questions each.
  - `npm run special-practice:validate` passed; CSCA special practice topics and questions validated.
- Re-ran staging gates:
  - `npm run verify:staging` blocked on missing `STAGING_BASE_URL`.
  - `npm run verify:staging:full` blocked on missing `STAGING_BASE_URL`.
- No target database backup, migration, seed, production cutover, or real browser acceptance was attempted without confirmed real environment credentials and permissions.

## Verified Locally

- `npm run prisma:validate`
- `npm run db:migrate:status`
- `node scripts/seed-mock-exams.cjs`
- `npm run mock-exams:validate`
- `npm run special-practice:seed`
- `npm run special-practice:validate`
- `npm run backend:build`
- `cd frontend && npm exec tsc -b --pretty false`
- `npm --prefix frontend run build`
- `npm run verify:ci`
- `npm run verify:ops`
- `npm run verify:supply-chain`
- `npm run verify:cookie-only`
- `npm run verify:docker:status`
- `npm run verify:docker:staging-local`
- `npm run db:backup:docker`

## Evidence

- Latest Docker status evidence: `.tmp/release-evidence/docker-status-2026-05-11T04-55-47-741Z.json`
- Latest local staging full evidence: `.tmp/release-evidence/staging-full-local-2026-05-11T04-55-47-964Z.json`
- Latest Docker database backup evidence: `.tmp/release-evidence/docker-backup-2026-05-11T04-58-19-524Z.json`
- Local Docker staging E2E: 83 passed, 1 skipped.
- Local database migration status: 11 migrations applied; database schema is up to date.
- Mock exam content validation: 3 free mock papers with 48 questions each.
- Special practice content validation: topics and questions validated.
- Native `npm run db:backup` is unavailable on this Windows host because `pg_dump` is not installed; Docker backup succeeded.

## Blockers Before Public Trial Release

- Provide real `STAGING_BASE_URL`.
- Provide staging `OPS_METRICS_TOKEN` or `STAGING_METRICS_TOKEN`.
- Confirm target `DATABASE_URL` and backup/restore permissions.
- Run target database backup before migration.
- Run staging database migration and content validation against the target database.
- Run:
  - `STAGING_BASE_URL=<staging-url> npm run verify:staging`
  - `STAGING_BASE_URL=<staging-url> OPS_METRICS_TOKEN=<token> npm run verify:staging:full`
  - `npm run verify:release-window`

## Manual Acceptance Still Required On Real Staging

- Online mock exam: math, physics, and chemistry complete paths from overview to diagnostic report.
- Special practice: one topic per subject, including continue previous session and restart.
- Math simulations: all available visualizers, formula links, mobile layouts, SVG/canvas non-empty checks.
- Admin mock exam: JSON validate/import, publish check, duplicate, edit, archive, audit log, and historical report snapshot stability.
- Responsive review: desktop, tablet, 390px, and 430px.

## Release Scope

- Supported: free original mock exams, special practice, math interactive simulations, mock exam admin/JSON management, special-practice admin/JSON management, and historical mock/special-practice report snapshots.
- Not supported: real paid unlock, rich-text or image question editing, multi-review publishing flow, version rollback, deep account analytics for special practice, and commercial checkout.
- Known non-blocking items: Vite may warn about the Three.js lazy chunk size; duplicate-prompt warnings from `special-practice:validate` should be reduced during the content cleanup pass.
