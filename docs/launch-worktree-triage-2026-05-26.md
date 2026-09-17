# Launch Worktree Triage - 2026-05-26

## Purpose

This document records Phase 0 of the backend, architecture, and account-security launch plan: classify the current dirty worktree into release review groups before running broad release gates.

The frontend style primitive cleanup was committed separately as `9ed0dbf Refine frontend style primitives`. The remaining worktree still contains multiple feature and infrastructure lines. Do not commit all remaining files together.

## Current Groups

### Group A - Backend, Schema, Past Papers

Status: automated validation passed; needs product scope approval and manual QA before release inclusion.

Files:

- `backend/prisma/schema.prisma`
- `backend/src/app.module.ts`
- `backend/src/past-papers/`
- `frontend/src/lib/api-past-papers.ts`
- `frontend/src/pages/AdminPastPapersPage.tsx`
- `frontend/src/pages/PastPaperPages.tsx`
- `frontend/src/styles/past-papers.css`
- `scripts/seed-past-papers.cjs`
- `docs/mock-exam-past-paper-resource-plan.md`

What changed:

- Adds `PastPaper`, `PastPaperFile`, and `PastPaperDownload` Prisma models.
- Wires a new Nest `PastPapersModule`.
- Adds frontend public and admin past-paper pages.
- Adds seed support.
- Adds restricted `/uploads/past-papers` static serving through the backend.

Release decision:

- Treat as a new product/data feature, not a small backend cleanup.
- Include only if migration, file serving, access control, download logging, seed data, and manual admin/public QA pass review.
- Otherwise defer the entire group rather than partially shipping schema and route hooks.

Progress on 2026-05-26:

- Added the missing `0024_past_papers` Prisma migration for `past_papers`, `past_paper_files`, and `past_paper_downloads`.
- Restricted static file serving to the Past Papers upload directory instead of exposing the whole uploads root.
- Added hashed IP and user-agent capture for download audit rows; raw IP/user-agent values are not stored.
- Confirmed admin write routes are guarded by `RequiredAdminGuard`.
- Confirmed public listing/detail/download paths only resolve published, non-deleted papers.
- Confirmed uploaded file names are generated server-side and uploads are constrained to PDF-looking files.
- Added Playwright coverage for Past Papers public list, detail, download flow, public route smoke, and admin login gate.
- Added a backend service-level Past Papers smoke for download audit hashing, unpublished/file-mismatch rejection, and upload path traversal guards.
- Remaining product decision: public downloads currently require the paper to be published, but do not separately block `isFree = false`; keep all published Past Papers free for this release, or add entitlement/payment enforcement before enabling paid resources.

Required validation:

```bash
npm run prisma:validate
npm run backend:build
npm --prefix frontend run build
npm run verify:backend
```

Passed on 2026-05-26:

```bash
npm run prisma:validate
npm run backend:build
npm run verify:backend
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
node scripts/past-papers-smoke.cjs
npm exec nest build
```

Note: later local reruns of `npm run backend:build` returned success but Prisma generate reported a Windows file lock while replacing `backend/node_modules/.prisma/client/query_engine-windows.dll.node`, then continued with the existing generated client. A separate `npm exec nest build` from `backend/` passed. Stop the local backend or any process holding Prisma's query engine before the final pre-commit build.

Extra review:

- Manually create a draft paper, upload a PDF, publish it, download it from the public page, then archive it and confirm the public page no longer serves it.
- Confirm seeded Past Paper content is real, licensed/allowed, and does not imply official endorsement if it is not official.
- Decide whether `isFree = false` is out of scope for launch or must be enforced before release.

### Group B - Payments, Orders, Gumroad

Status: automated validation passed after fixes; still needs product decision on whether Gumroad checkout is in launch scope.

Files:

- `backend/src/payments/payments.controller.ts`
- `backend/src/payments/payments.service.ts`
- `backend/src/payments/payments.types.ts`
- `backend/src/health/health.controller.ts`
- `.env.example`
- `.env.production.example`
- `docs/ops-runbook.md`

What changed:

- Adds Gumroad checkout and callback support.
- Adds health visibility for Gumroad checkout and verification configuration.
- Adds free-order path and provider labels.

Release decision:

- If commercial checkout is not in this release, keep this group out or feature-disabled.
- If included, it needs dedicated security and replay testing before release.

Required validation:

```bash
npm run verify:backend
npm run verify:concurrency
npm run verify:ops
```

Progress on 2026-05-26:

- Fixed Gumroad verification so boolean `refunded`, `chargebacked`, and `disputed` values reject the sale instead of being ignored.
- Made the zero-dollar/free payment path update payment and order in a single transaction.
- Added callback logging for Gumroad sale verification fetch failures.
- Added a service-level Gumroad payment smoke covering successful verification, disputed-sale rejection, missing verification token rejection, and free-order transaction behavior.

Passed on 2026-05-26:

```bash
node scripts/payments-gumroad-smoke.cjs
npm run verify:backend
npm run verify:ops
npm run verify:concurrency
```

Extra review:

- Confirm callback verification uses Gumroad API before marking orders paid.
- Confirm callback replay is idempotent.
- Confirm callback logs do not store secrets.
- Confirm amount, order ID, refunded, chargebacked, and disputed states are handled.
- Confirm public UI copy does not imply unsupported commercial checkout.

### Group C - Account, Auth, Admin Shell

Status: automated validation passed; keep in release scope with final staging auth smoke.

Files:

- `frontend/src/lib/use-auth-session.ts`
- `frontend/src/components/AdminAuthGate.tsx`
- `frontend/src/components/AdminNavActions.tsx`
- `frontend/src/components/SiteHeader.tsx`
- `frontend/src/pages/PublicAuthPage.tsx`
- `frontend/src/components/ConfirmDialog.tsx`
- `frontend/src/components/ErrorBanner.tsx`

What changed:

- Account/session and admin shell behavior changed alongside other frontend work.

Release decision:

- Include only after account/session smoke passes.
- This group should be verified before broader UI polish groups because failed auth behavior blocks staging QA.

Required validation:

```bash
npm run verify:cookie-only
npm run verify:ops
npm run frontend:build
```

Progress on 2026-05-26:

- Reviewed frontend auth/session changes: duplicate `/me` probes are coalesced by token, failed probes clear stale local tokens, and admin gates still rely on backend-protected APIs rather than frontend visibility alone.
- Public route e2e covers admin unauthenticated gate, non-admin permission gate, expired-token refresh, cookie refresh CSRF, legacy bearer refresh rejection, revoked refresh cleanup, and weak registration/login feedback.

Passed on 2026-05-26:

```bash
npm run verify:cookie-only
npm run verify:ops
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts -g "mock exam free paper flows from overview to report|mock exam all free subjects can create an attempt|subject learning pages route users into subject tools|subject vocabulary pages support search filters and related navigation"
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts -g "past papers list detail and download flow"
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts -g "/past-papers renders without console errors"
```

Extra review:

- Confirm normal user cannot access admin APIs.
- Confirm logout clears cookies/local storage state.
- Confirm expired-token refresh does not loop.
- Confirm admin gate is not only a frontend visibility check.

### Group D - Route Loading, Navigation, And Public Shell

Status: automated validation passed; still needs manual route-transition visual QA.

Files:

- `frontend/src/App.tsx`
- `frontend/src/components/AppRouteRenderer.tsx`
- `frontend/src/lib/app-navigation.ts`
- `frontend/src/lib/routes.ts`
- `frontend/src/lib/app-nav-items.ts`
- `frontend/src/components/SiteFooter.tsx`
- `frontend/src/components/SiteHeader.tsx`
- `frontend/src/styles/public-shell.css`
- `docs/route-loading-flicker-mitigation-plan.md`

What changed:

- Adds idle route chunk preloading.
- Removes visible Suspense loading fallback in several route branches.
- Normalizes `/zh/*` paths for selected routes.
- Adds past-paper route wiring.

Release decision:

- Include only after public route e2e and manual route-flicker QA.
- Be careful: this group overlaps with Group A past-paper route exposure.

Required validation:

```bash
npm run frontend:build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
```

Progress on 2026-05-26:

- Reviewed canonical route consistency: `/csca-mock-exam` remains the primary mock-exam route, while `/zh/mock-exam` is treated only as a compatibility alias if encountered.
- Confirmed Past Papers public/admin routes are included in known route, brand shell, preload, and public route smoke coverage; `/past-papers` is the primary public route, while `/zh/past-papers` remains a compatibility alias.
- Confirmed public route e2e now covers route transitions for mock exam, subject pages, auth/account/admin gates, Past Papers, and commerce actions.

Passed on 2026-05-26:

```bash
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
```

Manual QA:

- Navigate desktop and mobile through home, schools, school detail, mock exam, special practice, subject pages, account, admin.
- Confirm no blank page during lazy transitions.
- Confirm direct `/csca-mock-exam` works and `/zh/mock-exam` compatibility does not become the primary navigation path.

### Group E - I18n Debt And Content Parity

Status: automated validation passed after baseline gating and i18n smoke fixes; should be separately committed.

Files:

- `frontend/src/i18n/messages/en.ts`
- `frontend/src/i18n/messages/zh-CN.ts`
- `frontend/e2e/i18n-smoke.spec.ts`
- `frontend/scripts/check-i18n-debt.cjs`
- `frontend/scripts/check-i18n-content-parity.cjs`
- `frontend/package.json`
- `docs/i18n-technical-debt-audit-and-maturity-plan.md`

What changed:

- Adds i18n debt and content parity checks.
- Expands i18n smoke coverage and message catalogs.

Release decision:

- Include if the checks pass and public copy is stable.
- Keep separate from route and content-seed changes.

Required validation:

```bash
npm --prefix frontend run test:i18n
npm --prefix frontend run test:i18n-debt
npm --prefix frontend run test:i18n-content
```

Progress on 2026-05-26:

- Changed the i18n debt check to baseline high-density locale branching in existing special-practice visualizer files instead of allowing unlimited growth; new high-density files or increases over baseline still fail.
- Added missing Past Papers navigation messages so English pages do not render the Chinese fallback label.
- Fixed narrow home-header navigation alignment so English mobile dropdown buttons remain tappable.
- Fixed the school detail hero mark to use the English school name initial when `locale = en`.

Passed on 2026-05-26:

```bash
npm --prefix frontend run test:i18n-debt
npm --prefix frontend run test:i18n-content
npm --prefix frontend run test:i18n
npm --prefix frontend run build
```

### Group F - Mock Exam And Special Practice Content Expansion

Status: automated content validation passed; still needs product signoff on expanded/free content scope.

Files:

- `scripts/seed-mock-exams.cjs`
- `scripts/validate-mock-exams.cjs`
- `scripts/seed-special-practice.cjs`
- `frontend/src/pages/CscaMockExamPage.tsx`
- `frontend/src/pages/CscaPracticePage.tsx`
- `frontend/src/pages/CscaSubjectPage.tsx`
- `frontend/src/pages/CscaSubjectVocabularyPage.tsx`
- `frontend/src/components/NewtonSecondLawCanvas.tsx`
- `frontend/src/styles/mock-exam.css`
- `frontend/src/styles/mock-exam-maturity.css`
- `frontend/src/styles/mock-exam-subject.css`
- `frontend/src/styles/practice.css`

What changed:

- Expands mock exam published/free paper seeding.
- Greatly expands special-practice question generation.
- Adds or changes subject and practice UI.

Release decision:

- Include only if content validation passes and the product scope accepts making all published mock papers free.
- Keep seed/content changes separate from backend security and payment work.

Required validation:

```bash
npm run mock-exams:validate
npm run special-practice:validate
npm run frontend:build
```

Passed on 2026-05-26:

```bash
npm run mock-exams:validate
npm run special-practice:validate
npm --prefix frontend run build
```

Validation notes:

- `mock-exams:validate` confirmed 22 free mock papers with 48 questions each.
- `special-practice:validate` confirmed CSCA special practice topics and questions.
- Product still needs to approve making all validated published mock papers free for launch.

Extra review:

- Confirm no public copy claims official real exam content.
- Confirm generated explanations and answers are internally consistent.
- Confirm locked/free state matches launch scope.

### Group G - School, Scholarship, Search, And Seed Data

Status: public route validation passed; school import intentionally skipped for this release.

Files:

- `backend/src/schools/schools.service.ts`
- `backend/src/schools/schools.types.ts`
- `frontend/src/pages/PublicSchoolsPage.tsx`
- `frontend/src/pages/ScholarshipPages.tsx`
- `frontend/src/pages/SearchPage.tsx`
- `frontend/src/styles/search.css`
- `frontend/src/styles/scholarships.css`
- `scripts/seed-*.cjs`

What changed:

- School/service behavior changed.
- Many new school seed scripts were added.
- Public search and scholarship styling changed.

Release decision:

- Include after seed/import validation and public route checks.
- Keep large seed additions separate from code changes when possible.

Required validation:

```bash
npm run schools:import
npm run frontend:build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
```

Passed on 2026-05-26:

```bash
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
```

Skipped by launch decision:

- `npm run schools:import` writes/upserts database rows and reads the configured school source JSON. It is intentionally not part of this release gate; current school data remains the launch dataset.

### Group H - Frontend Base Styles And Split CSS

Status: automated public-route validation passed; still needs final manual visual QA.

Files:

- `frontend/src/styles/base.css`
- `frontend/src/styles/brand.css`
- `frontend/src/styles/index.css`
- `frontend/src/styles/layout.css`
- `frontend/src/styles/prep-consulting.css`
- `frontend/src/styles/study-china.css`
- `frontend/src/styles/subject-learning.css`
- deleted `frontend/src/styles/responsive.css`
- deleted `frontend/src/styles/school-overview.css`
- new split style files such as `compare.css`, `public-shell.css`, `practice.css`, `search.css`
- `docs/frontend-style-architecture.md`

What changed:

- Large CSS reorganization remains after the committed style-primitives pass.
- Some old CSS files are deleted.

Release decision:

- Include only after public route visual checks and no-horizontal-overflow checks.
- Keep separate from backend/security groups.

Required validation:

```bash
npm run frontend:build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
```

Passed on 2026-05-26:

```bash
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
```

Manual QA:

- Check 390px, 430px, tablet, and desktop.
- Check home, schools, study China, mock exam, special practice, subject pages, auth, account, admin.

### Group I - Dev Tooling And Local Environment

Status: low release risk if limited to local dev, but should not hide production behavior.

Files:

- `.gitignore`
- `backend/package.json`
- `backend/scripts/start-dev.cjs`
- `frontend/index.html`
- `frontend/vite.config.mjs`

What changed:

- Local dev server behavior changed.
- Vite dev cache behavior changed.
- Git ignore list changed.

Release decision:

- Include only if it helps current verification and does not affect production build output.
- Verify build output remains stable.

Required validation:

```bash
npm run frontend:build
npm run backend:build
```

## Recommended Commit Order

1. Commit this launch plan and triage documentation.
2. Backend/account/security review fixes only.
3. Past papers, if accepted as release scope.
4. Payments/Gumroad, only if accepted as release scope.
5. Route loading and public shell.
6. I18n debt checks.
7. Mock/special-practice content expansion.
8. School/search/seed data.
9. Base CSS split and visual QA changes.
10. Dev tooling cleanup.

## Immediate Next Step

Phase 1 through Phase 3 automated gates have now been run against the current worktree.

Passed on 2026-05-26:

```bash
npm run prisma:validate
npm run backend:build
npm run verify:backend
npm run verify:security
npm run verify:cookie-only
npm run verify:ops
npm run verify:release-concurrency
```

During this pass, `npm run verify:security` first failed because backend production audit reported moderate findings for `express` and `qs`. The backend lockfile was updated so backend production audit now reports 0 moderate/high findings.

Next decision point:

- Decide whether Group A Past Papers is in release scope.
- Decide whether Group B Gumroad/payment changes are in release scope.
- If either group is included, review its security and data-flow details before staging.
- If either group is deferred, keep the whole group out of the release instead of shipping partial route/schema hooks.
- Use `docs/launch-scope-decisions-2026-05-26.md` as the decision checklist before final release gates.

## Final Local Gate Update - 2026-05-26

Launch scope decisions applied:

- Gumroad/payment is deferred and should not block launch.
- Past Papers are free for this release.
- Mock exam papers are free for this release.
- `schools:import` is intentionally skipped; use the current school database as the launch dataset.

Fixes made during final gate execution:

- `scripts/launch-smoke.cjs` now creates public school fixtures with a cleanup-safe `s18-public-*` marker and cleans both before and after launch smoke.
- `scripts/cleanup-s18-smoke-data.cjs` now removes both `s18-smoke-*` and `s18-public-*` temporary users, schools, child rows, and audit logs.
- `scripts/verify-release-window-local.cjs` no longer injects `LOCAL_STAGING_BASE_URL` into the pre-Docker release candidate phase, so optional staging checks skip until the local Docker staging gate is running.
- `frontend/e2e/style-primitives.spec.ts` now checks that at least one matched element has a usable visible box, avoiding false failures when a broad locator also matches zero-size placeholders.
- `frontend/src/pages/special-practice/PhysicsEnergyConservationVisualizerView.tsx` localizes the SVG title/note text in English mode.
- `frontend/src/pages/CscaSpecialPracticePage.tsx` localizes the report explanation heading in English mode.

Passed on 2026-05-26:

```bash
npm run verify:release
npm --prefix frontend run test:e2e -- e2e/i18n-smoke.spec.ts -g "energy-conservation"
npm --prefix frontend run test:e2e -- e2e/style-primitives.spec.ts -g "commerce SurfaceCard"
npm --prefix frontend run test:e2e -- e2e/i18n-smoke.spec.ts -g "sessions/701/report"
npm run verify:release-window:local
```

Release-window notes:

- `verify:release-window:local` passed after running the release candidate gate, full local Docker staging verification, Docker database backup, and Docker restore drill.
- Docker staging was left running by `verify-docker-staging-local.cjs` for inspection. Stop it with `docker compose -p cscalite-verify -f deploy/docker-compose.prod.yml down` when no longer needed.
- Restore drill evidence was written under `.tmp/release-evidence/`, and the tested Docker backup was written under `.tmp/backups/`.
