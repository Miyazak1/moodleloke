# Database Security Optimization Plan - 2026-05-28

## Purpose

This document records the database security assessment outcome and turns it into an ordered optimization plan for CSCAlite. It complements `docs/backend-architecture-security-launch-plan-2026-05-26.md`, `docs/backup-restore.md`, `docs/ops-runbook.md`, and `docs/release-checklist.md`.

Payment is not real-production scope yet. Payment callback storage and provider verification are therefore tracked as a pre-real-payment hardening item, not as the current launch blocker.

## Current Position

The current backend uses NestJS, Prisma, and PostgreSQL. The main business paths use Prisma's structured query APIs, and no obvious HTTP-facing SQL string concatenation path was found during the static review.

## Execution Status - 2026-05-28

Completed:

- Added production startup guards for local/placeholder secrets and accidental local database URLs.
- Added restore target guard for possible production databases, requiring an additional production restore confirmation.
- Updated production environment examples to show PostgreSQL TLS and restore confirmation variables.
- Added `verify:db-security` to reject unsafe raw SQL calls under `backend/src`.
- Reduced production `/api/v1/health` to minimal liveness by default.
- Added optional Bearer-token protection for `/api/v1/ops/ready` through `OPS_READY_TOKEN`.
- Added a dry-run-first `db:cleanup-security` command for expired auth email tokens, stale refresh sessions, and old payment callback logs.
- Added backend security tests for minimal production health, protected readiness, and production-like restore target blocking.
- Added `docs/database-role-setup-postgresql-template.md` as an operator template for staging/production role setup.
- Documented restore safety, ops endpoint controls, and cleanup usage.

Verified:

- `npm run verify:security` passed.
- `npm run verify:ops` passed.
- `npm run db:cleanup-security` dry-run passed.
- `node backend/scripts/security-tests.cjs` passed after adding the new module-level assertions.
- Production health defaults to a minimal payload when `OPS_HEALTH_DETAILS_ENABLED` is not set.

Remaining:

- Create actual production/staging database roles outside the application code using `docs/database-role-setup-postgresql-template.md`.
- Decide whether `OPS_READY_TOKEN` should be set in staging and production deployment manifests.
- Add a scheduled cleanup runner if the hosting environment supports scheduled jobs.
- Revisit payment callback log whitelisting before real payment becomes launch scope.

Current positive controls:

- Prisma schema uses PostgreSQL through `DATABASE_URL`.
- Production startup blocks when required environment values such as `DATABASE_URL`, auth secret, payment callback secret, and CORS origins are missing.
- Passwords are stored as scrypt hashes.
- Email verification, password reset tokens, and refresh sessions store hashes instead of raw token values.
- Most admin writes are protected by `RequiredAdminGuard`.
- Backup and restore scripts support dry-run modes.
- `.env` is ignored by git, while `.env.example` and `.env.production.example` document expected names.

Primary current risks:

- Production safety still depends heavily on correct `NODE_ENV` or `CSC_ENV` configuration.
- Database restore can target whatever `DATABASE_URL` points at once `ALLOW_DB_RESTORE=1` is set.
- Health and readiness endpoints reveal configuration presence, though not secret values.
- Production database SSL and least-privilege account requirements are not enforced in code.
- Payment callback payload storage may retain sensitive provider/customer data after real payment is enabled.

## Optimization Goals

Target state before public production launch:

- Production cannot start with local fallback secrets or a local-style database connection.
- Production database connections require TLS unless the deployment platform explicitly terminates a private trusted connection.
- Runtime, migration, backup, and restore database roles are separated where the hosting provider allows it.
- Restore commands refuse obvious production targets unless a deliberate production restore procedure is being followed.
- Backups are encrypted or stored only in an encrypted managed backup system.
- Readiness, metrics, and health endpoints expose only the minimum required information publicly.
- Payment callback logs are safe before real payment launches.

## Phase 1 - Production Environment Hardening

Priority: high.

Actions:

- Require `NODE_ENV=production` or `CSC_ENV=production` in every production deployment manifest.
- Add a startup guard that rejects known local fallback secrets in non-local deployments.
- Add a startup guard that rejects local database hosts in production unless explicitly allowed for local release rehearsal.
- Require strong `AUTH_SECRET`; do not rely on `JWT_SECRET` except during migration compatibility.
- Set `AUTH_COOKIE_SECURE=true` and `AUTH_LEGACY_REFRESH_FALLBACK_ENABLED=false` for staging and production.
- Set `CORS_ORIGINS` to exact frontend origins only.
- Update `.env.production.example` to show a TLS database URL, for example `sslmode=require`.

Acceptance:

```bash
npm run verify:release
npm run verify:ops
```

Manual checks:

- Production boot fails if `AUTH_SECRET` is missing.
- Production boot fails if a known local fallback auth or payment secret is used.
- Production boot fails or warns loudly if `DATABASE_URL` points to localhost.

## Phase 2 - Database Role And Connection Policy

Priority: high.

Actions:

- Create a runtime database role with only the privileges needed by the application after migrations.
- Use a separate migration role for Prisma migrations.
- Use a separate backup role where the provider supports it.
- Avoid using the PostgreSQL superuser or owner account in `DATABASE_URL`.
- Require TLS for remote PostgreSQL connections.
- Document connection limits and pooling strategy for the deployment platform.

Recommended role split:

- `cscalite_app`: runtime reads and writes for application tables.
- `cscalite_migrator`: schema migration and DDL privileges.
- `cscalite_backup`: backup/export privileges.
- `postgres` or provider admin: emergency only, not used by the app.

Acceptance:

```bash
npm run db:migrate:status
npm run verify:ops
```

Manual checks:

- The application can run with the runtime role.
- Migration commands use the migration role, not the runtime role.
- Runtime role cannot drop schemas or run broad destructive DDL.

## Phase 3 - Backup And Restore Safety

Priority: high.

Actions:

- Add a restore target guard to `scripts/db-restore.cjs`.
- Refuse restore when the target database name, host, or environment label looks production-like unless a second explicit confirmation value matches the target database name.
- Keep dry-run as the default documented first step.
- Store production backups outside the repo, outside the app container writable layer, and outside the public web root.
- Prefer encrypted managed backups. If using dump files, encrypt them before leaving the database host or trusted backup environment.
- Keep restore drill evidence sanitized and outside the public app surface.

Suggested guard behavior:

- Always allow dry-run.
- Allow real restore to databases whose name contains `test`, `restore`, `staging`, or `dev`.
- Block real restore to names like `cscalite`, `prod`, `production`, or provider production hosts unless `ALLOW_PRODUCTION_DB_RESTORE=1` and `CONFIRM_RESTORE_DATABASE=<database-name>` are set.

Acceptance:

```bash
npm run db:backup -- --dry-run
npm run db:restore -- .tmp/backups/cscalite-example.dump --dry-run
npm run db:restore:smoke -- .tmp/backups/cscalite-example.dump --dry-run
```

Before production release:

```bash
npm run verify:backup-restore-drill -- <real-backup-file>
```

## Phase 4 - Public Ops Endpoint Reduction

Priority: medium.

Actions:

- Keep `/api/v1/health` public but minimal.
- Move detailed readiness information behind private network access or token protection.
- Keep `/api/v1/ops/metrics` disabled by default and token-protected when enabled.
- Avoid exposing database configuration presence to public users if the deployment platform already provides internal health checks.
- Continue redacting `token`, `password`, `secret`, `signature`, `cookie`, and `authorization` values in logs and CSP reports.

Acceptance:

```bash
npm run verify:ops
```

Manual checks:

- Public health output contains no secret values.
- Public health output does not reveal unnecessary infrastructure detail.
- Metrics without token returns 401 or 404 when metrics are enabled.

## Phase 5 - Query And Script Hygiene

Priority: medium.

Actions:

- Keep HTTP-facing business code on Prisma structured APIs.
- Avoid `queryRawUnsafe` and `executeRawUnsafe` in backend request handlers.
- Review seed, smoke, and cleanup scripts that use raw SQL before running against shared environments.
- Convert cleanup raw SQL to parameterized Prisma raw queries if those scripts ever accept operator-provided prefixes.
- Add a lightweight static check that fails when `queryRawUnsafe` or `executeRawUnsafe` appears under `backend/src`.

Acceptance:

```bash
rg -n "\$queryRawUnsafe|\$executeRawUnsafe|queryRawUnsafe|executeRawUnsafe" backend/src
```

Expected result:

- No matches in `backend/src`.

## Phase 6 - Data Retention And Sensitive Field Review

Priority: medium.

Actions:

- Define retention windows for admin audit logs, payment callback logs, refresh sessions, email tokens, and download telemetry.
- Keep refresh sessions and email tokens prunable after expiration.
- Hash or redact IP/user-agent telemetry where practical.
- Review admin audit snapshots for accidental credential, token, or secret fields before adding new admin modules.
- Add cleanup jobs or scripts for expired `AuthEmailToken`, revoked/expired `RefreshSession`, and old callback logs.

Suggested retention defaults:

- `AuthEmailToken`: delete expired or used tokens older than 7 days.
- `RefreshSession`: delete revoked or expired sessions older than 30 days.
- `PaymentCallbackLog`: before real payment, keep as needed for development; after real payment, keep sanitized logs for 90 days unless compliance needs differ.
- `AdminAuditLog`: keep at least 180 days for launch operations, then revisit.
- `PastPaperDownload`: keep aggregated metrics long-term; prune or hash raw request-derived telemetry.

Acceptance:

- Retention policy is documented in `docs/ops-runbook.md` or a dedicated data-retention document.
- Cleanup commands are dry-run capable.

## Phase 7 - Real Payment Pre-Launch Database Hardening

Priority: deferred until real payment is launch scope.

Actions before enabling real payment:

- Replace raw payment callback payload storage with a whitelist.
- Never store provider access tokens, callback signatures, buyer secrets, or full provider API responses.
- Store only fields needed for reconciliation, fraud review, and idempotency.
- Add retention cleanup for payment callback logs.
- Add tests proving failed, replayed, mismatched, and verified callbacks do not leak secrets into database logs.
- Confirm payment endpoints are disabled or unreachable for unsupported providers.

Suggested callback log shape:

- `providerTxnId`
- `paymentId`
- `orderId`
- `result`
- `signatureOk`
- `amountOk`
- `providerEventType`
- `providerCreatedAt`
- `redactedMetadata`

Acceptance before real payment:

```bash
npm run verify:backend
npm run verify:security
npm run verify:release-concurrency
```

Manual checks:

- Inserted callback logs contain no raw access token, callback signature, buyer email unless explicitly approved, or full provider response.
- Replay callbacks stay idempotent.
- Mismatched amount/order callbacks do not mutate paid state.

## Suggested Implementation Order

1. Add production startup guards for fallback secrets and local database URLs.
2. Update `.env.production.example` with TLS and cookie/session hardening defaults.
3. Add restore target guard and documentation.
4. Reduce or protect detailed ops readiness output.
5. Add static raw-query check for `backend/src`.
6. Define and implement retention cleanup scripts.
7. Revisit payment callback storage immediately before real payment becomes launch scope.

## Launch Gate Checklist

Before public production launch:

- `DATABASE_URL` points to the intended database and uses the intended role.
- Remote PostgreSQL uses TLS or a documented private trusted connection.
- Production runtime uses strong `AUTH_SECRET`.
- No local fallback secret is accepted in production.
- Restore has a real dry-run and restore drill record.
- Production backup exists and is stored outside the application host writable layer.
- Health, readiness, and metrics are appropriately public, private, or token-protected.
- `backend/src` has no unsafe raw SQL calls.
- Payment remains explicitly non-production scope, or Phase 7 is complete.
