# CSCAlite Release Readiness Snapshot - 2026-05-14

## Scope

Release scope is frozen around the current product set: homepage and public visual polish, CSCA mock exams, special practice, subject pages, school library, city guides, application timeline, scholarships, base account flows, and admin management.

Do not add new modules before RC. New school records may continue to be entered if they use the existing school structure.

## Current Change Groups

- Database and backend: Prisma schema updates, migrations `0010` through `0016`, mock exam snapshots, special practice, independent scholarships, city guides, timeline windows, scholarship deadlines, and school display mapping.
- Frontend product pages: homepage, footer, public schools, school detail, mock exam, special practice, subject pages, vocabulary/formula pages, scholarships, Study China pages, account page, and admin pages.
- Admin tools: mock exam import, special practice import, city guides, timeline windows, scholarships, schools, content, users, and audit.
- Release scripts and seeds: mock exam seeding/validation, special practice seeding/validation, school seed helpers and reference school seed scripts, smoke checks, launch smoke, and cleanup scripts.

## Verification Completed Locally

- `npm run db:migrate:status`: passed; 16 migrations applied and database is up to date.
- `npm run prisma:validate`: passed.
- `node scripts/cleanup-s18-smoke-data.cjs`: dry-run passed; no smoke/demo rows found for cleanup.
- `node scripts/seed-mock-exams.cjs`: passed; three free 48-question papers seeded.
- `npm run mock-exams:validate`: passed.
- `npm run special-practice:seed`: passed.
- `npm run special-practice:validate`: passed.
- `npm run frontend:build`: passed; Vite chunk-size warning remains non-blocking.
- `npm --prefix frontend run test:minimal`: passed.
- `npm run backend:build`: passed cleanly after stopping stale local backend/node watchers that were locking Prisma query engine files.
- `npm run verify:e2e`: passed; 101 passed, 1 skipped.
- `npm run verify:backend`: passed.
- `npm run verify:supply-chain`: passed.
- `npm run verify:ops`: passed.
- `npm run verify:cookie-only`: passed.
- `npm run verify:ci`: passed.
- `npm run db:backup -- --dry-run`: passed.
- `npm run db:restore:smoke -- .tmp\backups\cscalite-docker-2026-05-11T04-58-19-307Z.dump --dry-run`: passed.
- `npm run verify:docker:status`: passed; local `cscalite-verify` staging stack was running healthy and evidence was written under `.tmp\release-evidence`.
- `LOCAL_STAGING_BASE_URL=http://127.0.0.1:18080 npm run verify:staging`: passed against the already-running local staging stack.

## Release Blockers

No local automated blocker is currently known after the checks above.

## Release Before Tagging

- Run the full Docker rebuild gate when it is acceptable to rebuild and tear down the local `cscalite-verify` stack: `npm run verify:docker`.
- Run staging gates against the real cloud staging origin: `STAGING_BASE_URL=... npm run verify:staging`, then `STAGING_BASE_URL=... OPS_METRICS_TOKEN=... npm run verify:staging:full`.
- Run a real database backup and a restore drill against a disposable restore database before production cutover.
- Perform browser review on desktop `1922x1042` and mobile `390x844` / `430x932` for homepage, school list/detail, Beijing city guide, timeline, scholarships, subject pages, mock exam, special practice, account, and admin.
- Confirm production/staging env vars: `DATABASE_URL`, `AUTH_SECRET`, `CORS_ORIGINS`, `PUBLIC_APP_ORIGIN`, `LOG_FORMAT=json`, `CSP_MODE=report-only`, refresh-cookie settings, and secure cookies for HTTPS.

## Non-Blocking Notes

- Vite reports large chunks, especially the lazy Three.js solid-geometry bundle and main app bundle. This is recorded as non-blocking unless runtime loading becomes slow on staging.
- Three.js may print a deprecated `PCFSoftShadowMap` warning in development; it is not currently a user-facing blocker.
- Public text scan still finds `smoke/sample` in release scripts, admin-only grouping labels, data filters, and internal verification tooling. No obvious public-page test copy was found in the scan.
