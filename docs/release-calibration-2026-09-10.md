# CSCAPilot Release Calibration - 2026-09-10

## Current Decision

The public release is a fixed-question-bank CSCA learning product. AI automatic question generation remains an isolated internal workstream and is not a blocker for this release unless its dormant code affects the fixed-bank path.

## Calibrated Findings

- Frontend and backend production builds pass.
- The former frontend minimal contract was stale: it required deleted school/admin-school pages and retired search/commerce markers.
- The backend security implementation was not shown broken by the failing test. Its fake Prisma client lacked the newer `oAuthAccount.count` dependency.
- The adaptive rule expectation was stale. When governance removes one of two declared questions, the safe behavior is to return a replenishing conflict and refuse a partial student session.
- AI complexity and broad model-quality proof remain future engineering work, not current fixed-bank release scope.
- The release documentation and browser route matrix still contained retired school, scholarship and commerce requirements and needed recalibration.

## Fixed-Bank Boundary

- Student special-practice sessions are enabled.
- AI Coach, AI question generation, AI review and scheduler rollout are disabled.
- Subject-practice automatic production and predictive replenishment are disabled.
- Startup task recovery and production lifecycle reconciliation are disabled in the public deployment.
- Observation submission and execution are disabled.
- Student requests consume only visible, published and governance-safe fixed questions. Pool shortages do not call a model inline.

## Verification Boundary

`npm run verify:fixed-bank` is the code-level gate. It includes the current public-route, onboarding, i18n, interaction-stability and style Playwright suites on desktop and mobile. `npm run verify:e2e` remains the broader development suite and still includes the isolated AI administration workstream; it is not the fixed-bank release gate. Database-backed release verification additionally requires mock-exam and special-practice validation and staging checks with PostgreSQL and Redis.

The AI observation documents remain authoritative for the separate internal AI workstream. They must not be used to claim broad student-consumable AI question quality.

## Local PostgreSQL/Redis Release Rehearsal

- The development PostgreSQL database reports all 71 migrations applied, including `0071_student_onboarding_profile`.
- The development database initially had no published mock papers and an incomplete special-practice bank. Running the fixed-bank seed produced 22 free mock papers with 48 questions each and a valid three-subject special-practice bank.
- Cookie-only authentication passed against PostgreSQL and Redis, including CSRF enforcement, rejection of bearer refresh fallback, cross-origin rejection, logout and refresh-session revocation.
- The earlier production migration-container rehearsal successfully applied migrations through `0070` to an isolated empty database. The release window must repeat this rehearsal with `0071_student_onboarding_profile` before deployment.
- A deployment gap was found and fixed: `deploy-migrate-and-seed.cjs` ensured mock exams but did not ensure special practice. It now seeds special practice only when no published topics exist, and otherwise validates the existing bank without overwriting it.
- A real Docker backup was restored into a disposable PostgreSQL database. The restored fixed bank contained 22 mock papers, 1,056 mock questions, 48 special-practice topics and 960 special-practice questions; both bank validators passed after restore.
- Restore smoke now treats the four fixed-bank tables as key tables and runs both fixed-bank validators, so an empty or invalid learning bank cannot pass a restore drill.
- On this Windows host, port `56379` belongs to an excluded TCP range. The local compose port is now configurable through `CSC_REDIS_PORT`; this workspace uses `6380`, matching its local `REDIS_URL`. Production/container networking is unaffected.

## Remaining Environment Notes

- SMTP is not configured locally, so the authentication smoke verifies registration/session security but not delivery of a real verification email.
- The local backend may lock Prisma's Windows query-engine DLL while it is running. Builds safely use the current generated client in that case; stop the backend before intentionally regenerating Prisma Client.
- The real staging/production host, TLS proxy, production secrets and external email provider still require environment-specific verification.
