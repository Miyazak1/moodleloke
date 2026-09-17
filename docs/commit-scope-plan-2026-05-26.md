# Commit Scope Plan - 2026-05-26

## Purpose

This document splits the current dirty worktree into reviewable commit scopes. The goal is to avoid shipping one oversized mixed commit and to make it clear which changes are launch-critical, launch-included, deferred, or local tooling only.

Current launch decisions:

- Past Papers launch as free published resources.
- Mock exam papers launch free.
- Gumroad/payment is deferred and must not block public launch flows.
- `schools:import` is skipped for this release.

## Recommended Commit Order

### 1. Launch Planning And Verification Docs

Intent: record decisions, audit trail, and release gate results.

Files:

- `docs/launch-worktree-triage-2026-05-26.md`
- `docs/launch-scope-decisions-2026-05-26.md`
- `docs/frontend-style-architecture.md`
- `docs/i18n-technical-debt-audit-and-maturity-plan.md`
- `docs/mock-exam-past-paper-resource-plan.md`
- `docs/route-loading-flicker-mitigation-plan.md`
- `docs/commit-scope-plan-2026-05-26.md`

Suggested commit message:

```text
docs: record launch scope and commit plan
```

### 2. Release Verification Tooling

Intent: keep the final gate reliable and self-cleaning.

Files:

- `scripts/launch-smoke.cjs`
- `scripts/cleanup-s18-smoke-data.cjs`
- `scripts/verify-release-window-local.cjs`
- `.gitignore`

Notes:

- `launch-smoke` now cleans temporary `s18-smoke-*` and `s18-public-*` fixtures before and after the smoke run.
- `verify-release-window-local` no longer points optional pre-Docker staging checks at a local staging URL before Docker staging is running.

Suggested commit message:

```text
chore: harden release verification gates
```

### 3. Backend Security, Auth, Ops, And Account Reliability

Intent: commit release-critical backend/account behavior before broader product features.

Files:

- `backend/src/main.ts`
- `backend/src/health/health.controller.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/use-auth-session.ts`
- `frontend/src/components/AdminAuthGate.tsx`
- `frontend/src/components/AdminNavActions.tsx`
- `frontend/src/components/ConfirmDialog.tsx`
- `frontend/src/components/ErrorBanner.tsx`
- `frontend/src/pages/PublicAuthPage.tsx`
- `frontend/e2e/public-routes.spec.ts`
- `docs/ops-runbook.md`

Suggested commit message:

```text
fix: tighten auth and ops launch behavior
```

### 4. Past Papers Free Resource Feature

Intent: ship Past Papers as a free launch feature.

Files:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/0024_past_papers/`
- `backend/src/app.module.ts`
- `backend/src/past-papers/`
- `frontend/src/lib/api-past-papers.ts`
- `frontend/src/lib/api-types.ts`
- `frontend/src/pages/AdminPastPapersPage.tsx`
- `frontend/src/pages/PastPaperPages.tsx`
- `frontend/src/styles/past-papers.css`
- `scripts/seed-past-papers.cjs`
- `scripts/past-papers-smoke.cjs`
- related Past Papers route additions in:
  - `frontend/src/components/AppRouteRenderer.tsx`
  - `frontend/src/lib/app-nav-items.ts`
  - `frontend/src/lib/app-navigation.ts`
  - `frontend/src/lib/routes.ts`
  - `frontend/src/components/SiteFooter.tsx`
  - `frontend/src/components/SiteHeader.tsx`
  - `frontend/e2e/public-routes.spec.ts`

Suggested commit message:

```text
feat: add free past papers resource flow
```

### 5. Route Shell And Public Navigation

Intent: separate route loading, aliases, and shell behavior from content/features.

Files:

- `frontend/src/App.tsx`
- `frontend/src/components/AppRouteRenderer.tsx`
- `frontend/src/components/SiteHeader.tsx`
- `frontend/src/components/SiteFooter.tsx`
- `frontend/src/lib/app-nav-items.ts`
- `frontend/src/lib/app-navigation.ts`
- `frontend/src/lib/routes.ts`
- `frontend/src/styles/public-shell.css`
- `frontend/e2e/public-routes.spec.ts`

Notes:

- `/csca-mock-exam` remains canonical.
- `/zh/mock-exam` and `/zh/past-papers` are compatibility aliases, not primary navigation paths.

Suggested commit message:

```text
feat: stabilize public routing and navigation shell
```

### 6. I18n Gates And English Content Fixes

Intent: commit i18n debt checks and visible English-mode fixes together.

Files:

- `frontend/package.json`
- `frontend/scripts/check-i18n-debt.cjs`
- `frontend/scripts/check-i18n-content-parity.cjs`
- `frontend/e2e/i18n-smoke.spec.ts`
- `frontend/src/i18n/messages/en.ts`
- `frontend/src/i18n/messages/zh-CN.ts`
- `frontend/src/pages/SchoolDetailPage.tsx`
- `frontend/src/pages/CscaSpecialPracticePage.tsx`
- `frontend/src/pages/special-practice/PhysicsEnergyConservationVisualizerView.tsx`
- any directly related i18n-only page copy fixes.

Suggested commit message:

```text
test: add i18n launch gates
```

### 7. Mock Exam And Special Practice Free Content

Intent: ship the free mock exam/special practice launch scope as content/product work.

Files:

- `backend/src/csca-mock-exam/csca-mock-exam.service.ts`
- `frontend/src/pages/AdminMockExamPage.tsx`
- `frontend/src/pages/CscaMockExamPage.tsx`
- `frontend/src/pages/CscaPracticePage.tsx`
- `frontend/src/pages/CscaSpecialPracticePage.tsx`
- `frontend/src/pages/CscaSubjectPage.tsx`
- `frontend/src/pages/CscaSubjectVocabularyPage.tsx`
- `frontend/src/components/NewtonSecondLawCanvas.tsx`
- `frontend/src/components/SolidGeometryCanvas.tsx`
- `frontend/src/lib/subject-vocabulary.ts`
- `frontend/src/styles/mock-exam.css`
- `frontend/src/styles/mock-exam-maturity.css`
- `frontend/src/styles/mock-exam-subject.css`
- `frontend/src/styles/practice.css`
- `scripts/seed-mock-exams.cjs`
- `scripts/seed-special-practice.cjs`
- `scripts/validate-mock-exams.cjs`

Suggested commit message:

```text
feat: expand free mock exams and targeted practice
```

### 8. Schools, Scholarships, Search, And Existing Launch Dataset

Intent: keep school/search/scholarship behavior separate from import scripts.

Files:

- `backend/src/schools/schools.service.ts`
- `backend/src/schools/schools.types.ts`
- `frontend/src/pages/PublicSchoolsPage.tsx`
- `frontend/src/pages/ScholarshipPages.tsx`
- `frontend/src/pages/SearchPage.tsx`
- `frontend/src/pages/StudyChinaPages.tsx`
- `frontend/src/pages/AdminScholarshipsPage.tsx`
- `frontend/src/styles/search.css`
- `frontend/src/styles/scholarships.css`
- `frontend/src/styles/study-china.css`

Suggested commit message:

```text
feat: refine school search and scholarship pages
```

### 9. School Seed Scripts - Separate Or Defer

Intent: isolate large data-script changes because `schools:import` is not run for this launch.

Files:

- `scripts/seed-beijing-normal-university.cjs`
- `scripts/seed-fudan-university.cjs`
- `scripts/seed-ocean-university-of-china.cjs`
- `scripts/seed-pku-health-science-center.cjs`
- `scripts/seed-shanghai-jiao-tong-university.cjs`
- `scripts/seed-tianjin-university.cjs`
- `scripts/seed-tongji-university.cjs`
- `scripts/seed-university-of-science-and-technology-beijing.cjs`
- all new `scripts/seed-*.cjs` school scripts not listed under Past Papers or mock/special-practice content.

Recommendation:

- Prefer a separate commit after launch-critical code.
- If the release branch must be minimal, defer this commit because launch explicitly skips `schools:import`.

Suggested commit message:

```text
data: add school seed sources
```

### 10. Frontend Style Split And Visual Polish

Intent: keep the large CSS split reviewable.

Files:

- `frontend/src/styles/base.css`
- `frontend/src/styles/brand.css`
- `frontend/src/styles/index.css`
- `frontend/src/styles/layout.css`
- `frontend/src/styles/prep-consulting.css`
- `frontend/src/styles/study-china.css`
- `frontend/src/styles/subject-learning.css`
- `frontend/src/styles/compare.css`
- `frontend/src/styles/public-shell.css`
- `frontend/src/styles/search.css`
- `frontend/src/styles/practice.css`
- deleted `frontend/src/styles/responsive.css`
- deleted `frontend/src/styles/school-overview.css`
- `frontend/e2e/style-primitives.spec.ts`
- `frontend/src/components/AdminPageShell.tsx`
- `frontend/src/components/CommerceSkeleton.tsx`
- related page class-name/style usage changes:
  - `frontend/src/pages/ConsultingPage.tsx`
  - `frontend/src/pages/CscaExamTimePage.tsx`
  - `frontend/src/pages/CscaPrepPage.tsx`
  - `frontend/src/pages/FeatureComingSoonPage.tsx`
  - `frontend/src/pages/NotFoundPage.tsx`

Suggested commit message:

```text
style: split public styles and stabilize surfaces
```

### 11. Deferred Payment/Gumroad Work

Intent: do not mix deferred paid checkout with the free launch path.

Files:

- `backend/src/payments/payments.controller.ts`
- `backend/src/payments/payments.service.ts`
- `backend/src/payments/payments.types.ts`
- `.env.example`
- `.env.production.example`
- `scripts/payments-gumroad-smoke.cjs`
- related `backend/src/health/health.controller.ts` changes if they only describe Gumroad config.

Recommendation:

- Either keep this as a separate commit marked deferred, or leave it out of the release branch if the deployment process supports selective commits.
- Do not bundle it with Past Papers or mock exam free-resource changes.

Suggested commit message:

```text
feat: prepare Gumroad payment verification
```

### 12. Local Dev Tooling

Intent: isolate local developer experience changes.

Files:

- `backend/scripts/start-dev.cjs`
- `frontend/index.html`
- `frontend/vite.config.mjs`
- any remaining `.gitignore` lines not already included in release tooling.

Suggested commit message:

```text
chore: refine local dev server tooling
```

## Launch-Included Versus Deferred

Launch-included:

- Docs and release verification tooling.
- Auth/account/ops hardening.
- Past Papers as free resources.
- Mock exams as free resources.
- I18n gates and English-mode fixes.
- Public route shell and style stabilization.
- School/search/scholarship code that uses the existing launch dataset.

Deferred or separate:

- Gumroad/payment public launch.
- School import execution.
- Large school seed additions if the launch branch should stay minimal.

## Pre-Commit Validation

Before the final release branch is cut, re-run:

```bash
npm run verify:release
npm run verify:release-window:local
```

If committing one scope at a time, run narrower checks after each high-risk scope:

```bash
npm run prisma:validate
npm run verify:backend
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
npm --prefix frontend run test:i18n
```
