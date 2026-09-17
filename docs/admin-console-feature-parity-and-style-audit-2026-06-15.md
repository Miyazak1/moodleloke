# Admin Console Feature Parity And Style Audit

Date: 2026-06-15

## Purpose

This document is the correction layer for `docs/admin-console-reorganization-plan-2026-06-14.md`.

The reorganization direction is still valid: the admin area should become wider and more practical. The correction is that the admin panel must not become a separate visual product, and no original operational block should disappear during the split.

The target is:

- Full-width admin layout.
- Same visual language as the rest of the site.
- Clearer information architecture.
- Feature parity before removal.
- AI questioning and CSCA syllabus treated as one operational domain.

## Current Assessment

The current admin implementation has now been reorganized with feature-parity restoration for the AI-questioning workflows identified in this audit:

- `frontend/src/components/admin/AdminConsoleShell.tsx` now provides a left navigation shell.
- `frontend/src/lib/routes.ts` includes grouped aliases for content, learning, AI, organizations, and users.
- `frontend/src/components/AppRouteRenderer.tsx` renders separate admin pages for AI operations, AI question bank, CSCA syllabus, organizations, users, and content/resource modules.
- `frontend/src/pages/AdminAuditPage.tsx` has restored observability blocks including LLM usage, provider status, cost, trends, review queue, recent failures, and AI generated question ledger.

The important correction is that detailed AI-questioning operations now have visible owners outside `AdminAuditPage.tsx`: AI Operations, AI Question Bank, and AI CSCA Questioning Syllabus. Audit can remain a high-level observability and shortcut surface.

This means the problem was not primarily backend loss. It was UI ownership and migration incompleteness, and the missing workflow panels have now been restored into their target pages.

## Feature Parity Matrix

| Original capability | Current evidence in code | Current visible location | Status | Required action |
| --- | --- | --- | --- | --- |
| Admin KPI / audit overview | Audit summary state and rendered metric cards | Audit page | Kept | Keep in Audit as the overview surface. |
| LLM usage | `aiObservability.summary.externalInteractions`, rendered as `LLM 使用量` | Audit page | Kept | Keep in Audit and AI operations. |
| AI provider readiness and blockers | `aiProviderConfig`, provider blocker rendering | Audit page | Kept | Keep summary in Audit; detailed operations belong in AI Operations. |
| AI cost estimate | Provider usage meter rendering | Audit page | Kept | Keep summary in Audit. |
| AI trends / event trends | `AdminTrendChart` rendering | Audit page | Kept | Keep overview charts in Audit. |
| Review queue summary | `aiReviewQueue` rendering | Audit page | Kept | Keep count in Audit; detailed queue belongs in AI Question Bank or AI Operations. |
| Recent AI failures | `recentFailures` rendering | Audit page | Kept | Keep in Audit and expose deeper handling in AI Operations. |
| AI generated question ledger | `admin-ai-questioning-question-ledger` rendering | Audit page and AI Question Bank ledger tab | Restored | AI Question Bank is the canonical detail page; Audit can keep a summary/link. |
| AI questioning operational readiness | State, copy, export logic, action target helpers still exist | AI Operations readiness tab | Restored | Readiness summary, dimensions, training evidence, calibration, rollout checklist, readiness CSV/JSON export, evidence files, and evidence download are now in AI Operations. |
| Daily governance workflow | `aiQuestioningDailyWorkflow` still computed | AI Operations overview | Restored | AI Operations now shows the daily governance order across syllabus, blueprint coverage, topic bank, generation queue, and quality governance. |
| Blueprint coverage | `aiQuestioningBlueprintCoverage` state and copy still exist | AI Question Bank coverage tab | Restored | AI Question Bank now owns blueprint coverage, coverage actions, and topic drill-in entry points. |
| Topic health | `aiQuestioningTopicHealth` state and topic actions still exist | AI Question Bank coverage tab | Restored | Topic health rows and topic actions are restored in AI Question Bank. |
| Per-topic inline generation jobs | Inline job copy and handlers still exist | AI Operations generation tab | Restored | Recent generation jobs now show subject, topic title/ID, blueprint, failure category, provider failure category, and retry action. |
| Generation job queue | `aiQuestioningGenerationJobs`, generation health, retry/archive/process actions | AI Operations generation tab | Restored | Queue health, blocked/stale IDs, failure breakdowns, recent jobs, retry single job, process queue, retry failed, archive failed, ensure coverage, enqueue, and pregeneration are in AI Operations. |
| Pregeneration / auto restock | Pregeneration copy and action feedback still exist | AI Operations generation tab | Restored | Pregeneration and queue processing actions are restored under generation operations. |
| Candidate review queue | Candidate filters, recommendations, selection, exports, approve/reject/archive handlers | AI Question Bank candidate tab | Restored | AI Question Bank owns candidate review; Audit should only link/count. |
| Candidate bulk actions | Bulk approve/reject/archive/review handlers still exist | AI Question Bank candidate tab | Restored | Bulk review, approve, reject, and archive actions are restored in the candidate queue. |
| Candidate manual edit | Question edit draft state and save handlers still exist | AI Question Bank candidate queue | Restored | Candidate rows now expose an inline manual edit form for prompt, options, answer, explanation, tags, option metadata, and note. |
| Quality governance groups | `aiQuestioningQualityGovernance` state, filters, action groups, exports | AI Question Bank quality tab | Restored | Quality grouping, quality metrics, refresh, export, send-to-review, resolve, reduce exposure, manual fix, regenerate, archive, and bulk send/regenerate are now in AI Question Bank. |
| Quality trend | `aiQuestioningQualityTrend` copy and state exist | AI Question Bank quality tab | Restored | Subject trend and summary metrics are shown with the quality governance queue. |
| Quality calibration / replacement candidates | Calibration and replacement copy/handlers still exist | AI Question Bank quality tab | Restored | Quality calibration summary and replacement candidate follow-up are now visible with the quality governance queue. |
| CSCA syllabus governance | `AdminCscaSyllabusPage.tsx` is under the AI navigation group and copy now frames it as AI-questioning scope control | AI CSCA Questioning Syllabus page | Restored | Keep as an AI questioning syllabus/blueprint module, not a Learning Resources page. |
| Syllabus JSON import and preview | Syllabus page includes template download, file/text import, preview, save draft, apply, archive, recovery draft, reverse plan, CSV/JSON preview export, stale/unpublished filters, and affected-question review | AI CSCA Questioning Syllabus page | Restored | Keep compatibility routes, but the canonical mental model is AI questioning. |
| Misconception dictionary | `aiQuestioningMisconceptions`, drafts, merge handlers | AI Question Bank remediation tab | Restored | Governance suggestions, mark-for-review, create concept card, create variant, edit, merge, archive, and restore are now in AI Question Bank. |
| Remediation / concept cards / variants | `aiQuestioningRemediation` state and workflow counts | AI Question Bank remediation tab | Restored | Remediation summary, items, concept-card editing, publish, archive, and variant creation are now in AI Question Bank. |
| Readiness evidence files | Evidence file state and download helpers | AI Operations readiness tab | Restored | Evidence file list and JSON download are now in AI Operations. |
| Readiness calibration | Calibration state, feedback, refresh action | AI Operations readiness tab | Restored | Calibration health and manual refresh are now in AI Operations. |
| Organization AI provider / BYOK | `AdminOrganizationsPage.tsx` includes organization workspace tabs, credit pool form, BYOK provider form, members, cohorts/invites, member import/export, and governance log | Organizations page | Restored | Organizations page is canonical; Audit should only summarize or link if needed. |
| Users | `AdminUsersPage.tsx` route exists | Users page | Kept | Keep in Accounts group. |
| Content CMS | `AdminContentPage.tsx` route exists | Content page | Kept | Keep in Content & Admissions group. |
| Schools | `AdminSchoolsPage.tsx` route exists | Schools page | Kept | Keep in Content & Admissions group. |
| Scholarships | `AdminScholarshipsPage.tsx` route exists | Scholarships page | Kept | Keep in Content & Admissions group. |
| City guides | `AdminCityGuidesPage.tsx` route exists | City guides page | Kept | Keep in Content & Admissions group. |
| Timeline windows | `AdminTimelineWindowsPage.tsx` route exists | Timeline page | Kept | Keep in Content & Admissions group. |
| Mock exams | `AdminMockExamPage.tsx` route exists | Mock exam page | Kept | Keep in Learning Resources group. |
| Past papers | `AdminPastPapersPage.tsx` route exists | Past papers page | Kept | Keep in Learning Resources group. |
| Special practice | `AdminSpecialPracticePage.tsx` route exists | Special practice page | Kept | Keep in Learning Resources group. |

## Main Finding

If the comparison is route-level, the admin area still has the major destinations.

If the comparison is original operator workflow-level, the biggest prior gap was the AI questioning workbench. Those workflows are now visible in the new target pages:

- AI Operations owns readiness, daily governance order, generation queue, provider status, LLM usage, and readiness evidence.
- AI Question Bank owns blueprint/topic health, candidate review, manual candidate edit, quality governance, quality calibration, replacement candidates, remediation, misconceptions, and ledger.
- AI CSCA Questioning Syllabus owns syllabus import, preview, apply, recovery draft, reverse plan, stale/unpublished review, and affected-question review.

No old panel should be deleted from Audit until one of these is true:

- It is still intentionally present in Audit.
- It has an equivalent or better implementation in a new page.
- The new page is wired from navigation and tested.
- The old page has a visible link to the new owner during the transition.

## Corrected Information Architecture

### Operations Overview

Route:

- `/admin/audit`

Owns:

- Admin KPI summary.
- LLM usage summary.
- AI cost summary.
- Provider readiness summary.
- AI quality and rollout health summary.
- Recent failures.
- Recent audit events.
- Shortcuts into detailed workspaces.

Does not own:

- Candidate review.
- Generation queue processing.
- Blueprint editing.
- Syllabus import.
- Misconception merge/edit.
- Organization BYOK forms.

### AI Operations

Routes:

- `/admin/ai`
- `/admin/ai-question-bank`
- `/admin/ai/csca-syllabus`

Owns:

- Provider operations and readiness.
- Generation queue.
- Daily governance workflow.
- Blueprint coverage.
- Topic health.
- Candidate review.
- AI generated question ledger.
- Quality governance.
- Misconception remediation.
- Readiness evidence and calibration.
- CSCA syllabus governance as upstream structure for AI-generated questions.

CSCA syllabus should not be presented as an isolated admin island. It should appear as part of the AI generation chain:

`CSCA syllabus -> blueprint coverage -> candidate generation -> candidate review -> practice question ledger -> quality/remediation feedback`.

### Content And Admissions

Routes:

- `/admin/content`
- `/admin/schools`
- `/admin/scholarships`
- `/admin/city-guides`
- `/admin/timeline-windows`

Owns public content and structured admissions data.

### Learning Resources

Routes:

- `/admin/mock-exams`
- `/admin/past-papers`
- `/admin/special-practice`

Owns manually curated student-facing learning resources.

CSCA syllabus should not be primarily displayed here, even if compatibility aliases are kept.

### Accounts And Organizations

Routes:

- `/admin/organizations`
- `/admin/users`

Owns:

- Users.
- Organizations.
- Members.
- Cohorts.
- Invites.
- CSV imports.
- Organization credit pools.
- Organization provider/BYOK configuration.

## Style Direction

The user requirement is:

> Admin panel style should remain consistent with the whole site, except for width/layout.

This means full-width does not mean a separate visual product.

### Keep

- `brand-page`
- `page-stack`
- site typography scale
- site button/chip language
- existing `process-list` / `process-row` patterns where appropriate
- existing color tokens and restrained palette
- site-level spacing rhythm, adjusted for dense admin tables

### Change

- `.site-main-admin` can stay full width.
- Admin content should use wide tables, split panes, and dense controls.
- Long text and headings should still have readable max-widths inside full-width pages.
- The sidebar should feel like a site-native admin navigation rail, not a separate SaaS dashboard skin.
- The topbar should be flattened or merged into the page header/action row unless it provides real operational value.

### Avoid

- Creating a separate dashboard visual system.
- Heavy floating sidebar/topbar cards.
- Nested cards inside cards.
- Large radius/shadow differences from the public site.
- English labels in Chinese admin navigation unless they are product terms.
- Removing old panels before feature parity is proven.

## Current Style Risks

| Area | Risk | Recommendation |
| --- | --- | --- |
| `AdminConsoleShell` | Sidebar/topbar can drift into a separate console skin if future changes add heavy shadows/radius. | Keep the current site-native surface treatment and avoid reintroducing a separate dashboard skin. |
| `.site-main-admin` | Full width is correct, but all content can become too wide. | Full-width shell, constrained text blocks, wide data surfaces. |
| Mixed workbench classes | Pages still use `cms-workbench`, `school-workbench`, `mock-admin-workbench`, `admin-shell`, `admin-editor-panel`. | Gradually migrate to shared AdminWorkbench primitives. |
| Audit density | Restored blocks are useful but too many concerns live together. | Keep overview summaries and move deep actions only after parity pages exist. |
| CSCA placement | Compatibility routes can make it look standalone. | Keep navigation and page copy under AI questioning; current nav label is `CSCA 出题大纲`. |

## Execution Plan

### Phase 0: Freeze Destructive Simplification

Do not remove any current Audit block, state, API call, or handler until the parity matrix marks it as moved or intentionally retired.

### Phase 1: Verify Feature Ownership

For every row that was marked missing, degraded, or needing parity check:

1. Identify the old state/API/action handler.
2. Identify the target page.
3. Confirm whether the target page already renders equivalent controls.
4. If not, restore the panel in the target page before deleting old UI.

Priority order:

1. Daily governance workflow. Restored in AI Operations overview.
2. Generation queue and queue health. Restored in AI Operations generation tab.
3. Candidate review queue and bulk actions. Restored in AI Question Bank candidate tab.
4. Blueprint coverage and topic health. Restored in AI Question Bank coverage tab.
5. Quality governance and quality trend. Restored in AI Question Bank quality tab.
6. Misconception remediation. Restored in AI Question Bank remediation tab.
7. Readiness evidence and calibration. Restored in AI Operations readiness tab.
8. CSCA syllabus import parity. Restored in AI CSCA Questioning Syllabus page.
9. Organization BYOK parity. Restored in Organizations page.

### Phase 2: Correct Navigation Semantics

Keep full-width layout, but update IA labels:

- `AI Operations` -> `AI 运维`
- `AI 生成题库` remains under AI.
- `CSCA 出题大纲` remains under AI.
- Content and learning groups should not imply CSCA syllabus is standalone.

### Phase 3: Restored AI Workflow Ownership

Implemented ownership:

| Workflow | Target page |
| --- | --- |
| Provider readiness / cost / rollout | AI Operations |
| Daily governance workflow | AI Operations |
| Generation queue | AI Operations |
| Blueprint coverage | AI Question Bank or AI Operations |
| Topic health | AI Question Bank |
| Candidate review | AI Question Bank |
| Question ledger | AI Question Bank |
| Quality governance | AI Question Bank |
| Misconception remediation | AI Operations or AI Question Bank subview |
| Readiness evidence | AI Operations |
| CSCA syllabus governance | CSCA Syllabus under AI |

### Phase 4: Style Reconciliation

Feature parity is now stable enough to keep style work focused on the existing site language:

1. Keep `.site-main-admin` full width.
2. Restyle `AdminConsoleShell` to match site-native surfaces.
3. Normalize admin page headings, buttons, chips, filters, tables, and panels.
4. Migrate old page-specific workbench classes to shared admin primitives.
5. Verify desktop and mobile layouts visually.

## Acceptance Criteria

The admin reorganization is acceptable only when:

- LLM usage, cost, trends, provider health, failures, review queue, and recent audit events are visible from Audit.
- All AI-questioning workflows from the old Audit workbench are either visible in Audit or visible in their new target page.
- CSCA syllabus is visibly part of the AI questioning/generation domain.
- Organization AI/BYOK settings are owned by Organizations.
- No major admin page uses a visual style that feels detached from the rest of the site.
- The only deliberate layout difference is width and admin-appropriate density.
- Existing routes continue to work or redirect through compatibility aliases.

## Verification Status

The implementation now has two verification layers:

- Static parity guard: `npm --prefix frontend run test:admin-console-parity`
- Authenticated mock-admin e2e guard: `cd frontend && npm run test:e2e -- e2e/admin-console-parity.spec.ts --project=desktop`

The e2e guard opens:

- `/admin/ai`
- `/admin/ai-question-bank`
- `/admin/ai/csca-syllabus`

It verifies that LLM usage, readiness, generation queue failure breakdowns, candidate review, quality calibration, remediation, ledger, and CSCA syllabus import/review workflows render for an admin user. A final product pass should still use real admin data to check dense table readability, long text wrapping, and action feedback after API mutations.
