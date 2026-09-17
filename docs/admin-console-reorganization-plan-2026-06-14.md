# Admin Console Reorganization Plan

Date: 2026-06-14

## Background

The current admin area has grown from a set of brand-page-style admin screens into a mixed operational console. The implementation now combines CMS editing, school data maintenance, learning resource management, AI generation operations, observability, readiness evidence, organization governance, and user management under one visual shell.

The result is functional but hard to reason about. The biggest issue is not only width. The admin area is currently organized as a flat set of pages, while the actual product has become several distinct workspaces with different operator mental models.

This plan reorganizes the admin area into a practical full-width backend console, with clearer domain ownership and an execution path that can be done safely in stages.

## Current Findings

### Page Size And Responsibility

The largest admin pages show that responsibility boundaries are blurred:

| File | Approx. lines | Current role |
| --- | ---: | --- |
| `frontend/src/pages/AdminAuditPage.tsx` | 7460 | Audit overview, adaptive observability, Enterprise AI organization controls, AI questioning operations, readiness evidence, quality governance, trends, reviews |
| `frontend/src/pages/AdminSchoolsPage.tsx` | 1743 | School directory, school editor, CSCA requirements, rules, programs, scholarships, change logs |
| `frontend/src/pages/AdminContentPage.tsx` | 1261 | CMS block editing, locale management, schedule editing, subject vocabulary shortcuts |
| `frontend/src/pages/AdminCscaSyllabusPage.tsx` | 1036 | CSCA syllabus management |
| `frontend/src/pages/AdminOrganizationsPage.tsx` | 1031 | Organization creation, members, cohorts, invites, CSV import, AI settings |

The most problematic page is `AdminAuditPage.tsx`. It is named and navigated as an overview, but it now contains several full operational products:

- Adaptive AI observability
- AI provider readiness and cost configuration status
- Enterprise AI organization configuration
- AI questioning blueprint coverage
- Topic health
- Generation jobs and queue controls
- Pregeneration actions
- Question review and approval
- Syllabus governance and JSON imports
- Quality governance
- Misconception and remediation workflows
- Readiness evidence downloads

This creates a mismatch between navigation labels and user intent.

### Duplicate Domain Entrypoints

Organization-related work currently exists in at least two places:

- `AdminOrganizationsPage.tsx`: institution/team/member/invite operations.
- `AdminAuditPage.tsx`: Enterprise AI organizations, members, credit pools, provider configuration.

Operators cannot infer which page owns the organization lifecycle. This also risks duplicated UI logic and inconsistent permission/validation behavior.

### Navigation Model

`AdminNavActions.tsx` currently groups modules horizontally:

- Overview
- Content
- Training
- Operations

That grouping is directionally useful, but the surface is still a page switcher rather than a backend navigation system. It does not express workspace hierarchy or submodule context. As pages become denser, the operator loses orientation inside the admin area.

### Layout Model

The admin pages use `AdminPageShell`, which is good. However, the outer app shell still applies public-site width constraints through `.site-main`, currently capped around `1240px`.

Public pages benefit from this width. Admin pages do not. Admin pages need wider table, editor, queue, and split-panel layouts.

### CSS Organization

Admin styling is split between:

- `frontend/src/styles/admin.css`
- `frontend/src/styles/admin-work.css`
- `frontend/src/styles/admin-work.part-01.css`
- `frontend/src/styles/admin-work.part-02.css`
- `frontend/src/styles/admin-work.part-03.css`

The admin work CSS is large and selector-heavy. Some class names are semantically tied to one domain but reused in another, for example `school-stat-strip` being used by mock exam and special practice pages. This makes future changes risky because layout intent is hidden inside historical class names.

## Product Direction

The admin area should become a real console, not a public-site page variant.

The public site should optimize for trust, brand, reading, and conversion. The admin console should optimize for:

- Density
- Fast scanning
- Stable work areas
- Batch operations
- Error recovery
- Operational confidence
- Clear domain ownership

## Target Information Architecture

The admin console should be organized into five primary workspaces.

### 1. Operations Overview

Purpose: give admins a high-level view and direct them to work, without becoming the place where every operation is performed.

Owns:

- System/admin KPI summary
- Recent admin audit events
- Pending review counts
- Data quality alerts
- AI/training health summaries
- Shortcuts into deeper workspaces

Does not own:

- AI generation workflows
- Organization configuration forms
- Long tables
- Syllabus imports
- Queue processing controls

Suggested route:

- `/admin`
- or keep `/admin/audit` initially as the backward-compatible overview route

### 2. Content And Admissions Data

Purpose: manage public content and admissions-related structured data.

Owns:

- CMS content blocks
- Locale content editing
- School directory and detail editing
- Scholarships
- City guides
- Application timeline windows

Suggested routes:

- `/admin/content`
- `/admin/schools`
- `/admin/scholarships`
- `/admin/city-guides`
- `/admin/timeline-windows`

Common layout:

- Full-width workbench
- KPI/status strip
- Left directory/filter panel
- Main editor panel
- Sticky save/publish/archive action area

### 3. Learning Resources

Purpose: manage learning-facing resources and manually curated question banks.

Owns:

- Mock exam papers
- Past paper PDF resources
- Special practice topics
- CSCA syllabus content

Suggested routes:

- `/admin/learning/mock-exams` or keep `/admin/mock-exams`
- `/admin/learning/past-papers` or keep `/admin/past-papers`
- `/admin/learning/special-practice` or keep `/admin/special-practice`
- `/admin/learning/csca-syllabus` or keep `/admin/csca-syllabus`

Common layout:

- Resource list/sidebar
- Main editor
- Question/resource editor
- Import/validate panel
- Release readiness warnings

### 4. AI Training Operations

Purpose: own AI generation, AI question quality, adaptive observability, syllabus governance, and remediation workflows.

This is the biggest extraction from `AdminAuditPage.tsx`.

Owns:

- Adaptive AI observability
- AI provider readiness summary
- AI questioning blueprint coverage
- Topic health
- Generation jobs and queue processing
- Pregeneration actions
- Question review and approval
- Syllabus governance and JSON imports
- Quality governance
- Misconceptions
- Remediation/concept cards
- Readiness evidence

Suggested route group:

- `/admin/ai`
- `/admin/ai/overview`
- `/admin/ai/observability`
- `/admin/ai/questioning`
- `/admin/ai/generation`
- `/admin/ai/quality`
- `/admin/ai/syllabus`
- `/admin/ai/remediation`
- `/admin/ai/readiness`

Initial implementation can keep one route with internal tabs:

- `/admin/ai`

Then split routes later if needed.

Common layout:

- Full-width operational console
- Subject/status/provider filters at top
- Tabs or side subnav
- Tables for queues/reviews
- Action bars for bulk operations
- Strong disabled/loading/error states

### 5. Accounts And Organizations

Purpose: manage people, organizations, invites, cohorts, permissions, credit pools, and BYOK/provider configuration.

Owns:

- Users
- Organizations
- Members
- Cohorts/groups
- Invites
- CSV member import
- Organization AI credit pools
- Organization provider configuration/BYOK

Suggested routes:

- `/admin/organizations`
- `/admin/users`

Enterprise AI organization settings should move out of `AdminAuditPage.tsx` and into `AdminOrganizationsPage.tsx` or a subview under organizations.

Common layout:

- Organization selector/list
- Organization detail dashboard
- Members table
- Cohorts and invites
- AI settings
- Audit trail

## Target Navigation

Replace the current horizontal module switcher with a backend console navigation model.

### Primary Navigation

Use a persistent left sidebar on desktop:

- Overview
- Content & Admissions
- Learning Resources
- AI Operations
- Accounts & Organizations

Each primary item expands or reveals child links.

### Secondary Navigation

Inside each workspace, use either:

- Top tabs for 3-6 closely related subviews
- A secondary side rail for larger workspaces such as AI Operations

### Top Bar

Use a compact top bar for:

- Current workspace title
- Global admin search, later if useful
- Refresh
- Current user/account actions
- Environment/status indicator, later if useful

### Mobile Behavior

Below tablet width:

- Sidebar collapses into a drawer or top module selector
- Workbench layouts stack vertically
- Tables retain horizontal scroll where necessary

## Target Layout System

### App Shell

Add an admin-specific main class in `App.tsx`.

Current behavior:

- Public pages use `.site-main`.
- `.site-main` constrains content width.

Target behavior:

- Admin routes use `.site-main.site-main-admin`.
- `.site-main-admin` is full-width with console padding.

Example target CSS:

```css
.site-main-admin {
  width: 100%;
  max-width: none;
  padding: 16px 20px 96px;
}

@media (max-width: 640px) {
  .site-main-admin {
    padding-inline: 12px;
  }
}
```

### Admin Shell

Introduce or evolve a shell component that handles the console frame:

- `AdminConsoleShell`
- `AdminWorkspaceLayout`
- `AdminPageShell` can remain temporarily for compatibility

Target responsibilities:

- Admin-only page frame
- Sidebar
- Top bar
- Workspace title
- Permission gate
- Common loading/error/empty states

`AdminPageShell` currently mixes hero-style page heading with module nav. That made sense for early admin pages, but the console should move toward smaller headers and denser content.

### Common Workbench Patterns

Create reusable layout primitives:

- `AdminStatsStrip`
- `AdminSplitWorkbench`
- `AdminDirectoryPanel`
- `AdminEditorPanel`
- `AdminDataTable`
- `AdminFilterBar`
- `AdminActionBar`
- `AdminStatusNotice`
- `AdminSubnav`

These should replace domain-leaking class names over time, such as using `school-stat-strip` for non-school pages.

## Route Strategy

To reduce risk, avoid breaking existing URLs in the first pass.

### Phase 1 Routes

Keep current routes:

- `/admin/audit`
- `/admin/content`
- `/admin/city-guides`
- `/admin/timeline-windows`
- `/admin/schools`
- `/admin/scholarships`
- `/admin/mock-exams`
- `/admin/past-papers`
- `/admin/special-practice`
- `/admin/csca-syllabus`
- `/admin/organizations`
- `/admin/users`

Add new route:

- `/admin/ai`

`/admin/audit` remains the overview but loses deep AI operational sections after migration.

### Phase 2 Routes

Optionally introduce grouped aliases:

- `/admin/content/schools`
- `/admin/content/scholarships`
- `/admin/learning/mock-exams`
- `/admin/learning/special-practice`

Keep old routes as redirects or aliases until usage stabilizes.

## Component Refactor Plan

### New Components

Create:

- `frontend/src/components/admin/AdminConsoleShell.tsx`
- `frontend/src/components/admin/AdminSidebar.tsx`
- `frontend/src/components/admin/AdminTopBar.tsx`
- `frontend/src/components/admin/AdminWorkspaceHeader.tsx`
- `frontend/src/components/admin/AdminSubnav.tsx`
- `frontend/src/components/admin/AdminStatsStrip.tsx`
- `frontend/src/components/admin/AdminWorkbench.tsx`
- `frontend/src/components/admin/AdminTable.tsx`

Do not migrate every page immediately. Start by making the shell and navigation support both old and new pages.

### Existing Components To Keep Initially

Keep:

- `AdminPageShell`
- `AdminAuthGate`
- `AdminNavActions`

But progressively reduce their responsibility.

### Target End State

`AdminPageShell` can either:

- become a compatibility wrapper around `AdminConsoleShell`, or
- be retired after all admin pages migrate.

## CSS Refactor Plan

### Phase 1

Add new admin console CSS:

- `frontend/src/styles/admin-console.css`

Import it from the admin shell or global style entry.

Keep existing CSS untouched except for minimal overrides:

- `.site-main-admin`
- admin shell layout
- sidebar/topbar

### Phase 2

Move reusable console primitives into:

- `admin-console.css`
- or split later into `admin-layout.css`, `admin-components.css`, `admin-tables.css`

### Phase 3

Gradually retire misleading or over-specific classes:

- Replace `school-stat-strip` with `admin-stats-strip`.
- Replace duplicated panel styles with `admin-panel`.
- Replace scattered inline form classes with one consistent admin form system.

## AI Operations Extraction Plan

This is the largest and highest-value cleanup.

### Current Source

Most AI operations live inside:

- `frontend/src/pages/AdminAuditPage.tsx`

### Target

Create:

- `frontend/src/pages/AdminAIOperationsPage.tsx`

Initial route:

- `/admin/ai`

### First Extraction Scope

Move these sections from `AdminAuditPage.tsx`:

- `admin-audit-observability`
- adaptive observability summary
- AI provider readiness/cost summary
- AI questioning controls
- generation jobs/queue health
- blueprint coverage
- topic health
- syllabus governance
- quality governance
- misconception/remediation
- readiness evidence

Keep in `AdminAuditPage.tsx`:

- high-level KPI cards
- recent audit events
- links into AI Operations
- links into Organizations/Users/Content workspaces

### Implementation Approach

Because `AdminAuditPage.tsx` is very large, do not try to rewrite it in one edit.

Recommended sequence:

1. Create `AdminAIOperationsPage.tsx`.
2. Move pure constants/types/helpers related to AI operations into a local module:
   - `frontend/src/pages/admin-ai/AdminAIOperationsTypes.ts`
   - or `frontend/src/pages/admin-ai/admin-ai-helpers.ts`
3. Move section components one by one.
4. Keep data fetching behavior equivalent.
5. Once `/admin/ai` works, remove those sections from `AdminAuditPage.tsx`.

## Organization Consolidation Plan

### Current Issue

Organization governance and Enterprise AI organization configuration are split across:

- `AdminOrganizationsPage.tsx`
- `AdminAuditPage.tsx`

### Target

`AdminOrganizationsPage.tsx` owns all organization operations:

- Organization creation/selection
- Members
- Cohorts
- Invites
- CSV import
- AI credit pool
- Provider/BYOK configuration

`AdminAuditPage.tsx` only displays organization health summaries and links.

### UI Structure

Inside Organizations:

- Overview
- Members
- Cohorts & Invites
- AI Settings
- Audit Log

This can be implemented as tabs within the same route first.

## Page-Specific Recommendations

### Admin Audit / Overview

Rename conceptually from "Audit Overview" to "Operations Overview".

Keep it short:

- KPI strip
- Pending actions
- Recent changes
- Health summaries
- Quick links

Remove:

- complex forms
- generation actions
- long queues
- organization AI provider forms

### Admin Content

This page has a good workbench shape:

- stat strip
- sidebar list
- editor

Improve:

- Make it full width.
- Convert locale controls into a compact top action area.
- Keep subject vocabulary as a separate shortcut or subview if it grows.

### Admin Schools

This page is a strong candidate for the standard editor workbench:

- directory panel
- detail editor
- save/publish/archive actions
- quality checklist

Improve:

- Use admin console width.
- Rename generic reusable classes.
- Consider internal anchors/tabs for long school detail sections:
  - Summary
  - Basic Info
  - Requirements
  - CSCA Rules
  - Programs
  - Scholarships
  - Change Log

### Admin Mock Exams And Special Practice

These two pages share a very similar content model.

Improve:

- Extract shared resource/question editor primitives later.
- Use common `AdminResourceWorkbench`.
- Keep import/validate panels consistent.

### Admin Csca Syllabus

Should live under Learning Resources unless it is specifically part of AI syllabus governance.

Distinguish:

- CSCA syllabus content management: Learning Resources.
- AI syllabus governance/import/recovery: AI Operations.

### Admin Organizations

Should become the only owner of organization operations.

Add internal tabs:

- Overview
- Members
- Cohorts
- Invites
- AI Settings

### Admin Users

Keep separate from organizations, but link clearly:

- User identity/account status belongs here.
- Organization membership belongs in Organizations.
- AI unit grants can remain here if individual-level, but organization pool grants belong in Organizations.

## Execution Phases

### Phase 0: Baseline And Safety

Goal: document current behavior and avoid accidental regressions.

Tasks:

- Confirm admin routes in `routes.ts`.
- Confirm route rendering in `AppRouteRenderer.tsx`.
- Run TypeScript build before changes.
- Capture screenshots of key admin pages if a browser is available:
  - `/admin/audit`
  - `/admin/schools`
  - `/admin/content`
  - `/admin/organizations`
  - `/admin/mock-exams`

Acceptance:

- Baseline build/test status recorded.
- No behavior changes.

### Phase 1: Full-Width Admin Shell

Goal: make admin pages use practical console width without changing domain behavior.

Tasks:

- Add admin route detection in `App.tsx`.
- Apply `site-main-admin` class to admin routes.
- Add CSS for full-width admin content.
- Keep public route widths unchanged.
- Verify desktop and mobile layout.

Acceptance:

- Public pages still use existing constrained layout.
- Admin pages use full available width.
- Existing admin pages remain usable at desktop and mobile breakpoints.

### Phase 2: Console Shell And Navigation

Goal: introduce the new shell while preserving current pages.

Tasks:

- Add `AdminConsoleShell`.
- Add sidebar navigation grouped by workspace.
- Keep `AdminPageShell` as compatibility layer.
- Update `AdminPageShell` to render inside/through the console shell if practical.
- Replace horizontal `AdminNavActions` only after the sidebar is stable.

Acceptance:

- Admin has persistent workspace navigation.
- Current route still highlighted.
- No page loses admin auth protection.
- Keyboard and mobile navigation remain usable.

### Phase 3: Operations Overview Cleanup

Goal: make `AdminAuditPage` become a real overview.

Tasks:

- Rename UI copy from "audit" framing toward "operations overview" where appropriate.
- Keep KPI summary and recent activity.
- Add clear cards linking to AI Operations and Organizations.
- Do not remove deep sections until the replacement route exists.

Acceptance:

- Overview is scannable within one or two screens.
- Deep workflows are discoverable through links, not embedded directly.

### Phase 4: Create AI Operations Workspace

Goal: extract deep AI operations from `AdminAuditPage`.

Tasks:

- Add route `/admin/ai`.
- Add `AdminAIOperationsPage.tsx`.
- Move AI observability first.
- Move AI questioning generation/quality/syllabus/remediation sections incrementally.
- Preserve API calls from `api-admin.ts`.
- Add subnav/tabs inside AI Operations.

Acceptance:

- `/admin/ai` can run the same core AI operational workflows.
- `/admin/audit` links to `/admin/ai`.
- TypeScript build passes.

### Phase 5: Consolidate Organizations

Goal: make Organizations own all organization and Enterprise AI organization settings.

Tasks:

- Move Enterprise AI organization controls out of `AdminAuditPage`.
- Add AI Settings section/tab to `AdminOrganizationsPage`.
- Reuse existing organization API functions.
- Ensure member/cohort/invite/credit/provider controls share one selected organization context.

Acceptance:

- Organization work has one obvious entrypoint.
- `/admin/audit` only summarizes organization status.
- No duplicated organization forms remain in overview.

### Phase 6: Normalize Workbench Components

Goal: reduce CSS and markup drift across admin pages.

Tasks:

- Add reusable admin layout primitives.
- Migrate Content, Schools, Mock Exams, Special Practice one by one.
- Rename semantically misleading classes.
- Keep changes visually conservative.

Acceptance:

- Shared workbench pages use common primitives.
- CSS selectors become less domain-leaky.
- No major visual regressions.

### Phase 7: Route Aliases And Long-Term IA

Goal: optionally introduce grouped URLs once the console is stable.

Tasks:

- Add grouped aliases for Content, Learning, AI, and Accounts.
- Keep old routes as redirects/aliases.
- Update navigation to use preferred routes.

Acceptance:

- Existing bookmarked routes still work.
- New route structure matches the console IA.

## Verification Plan

Run after each implementation phase:

- `npm exec tsc -b --pretty false`
- `npm --prefix frontend run build`

When visual shell changes are made:

- Start the frontend dev server.
- Inspect admin pages in browser at:
  - desktop width
  - tablet width
  - mobile width

Key routes to verify:

- `/admin/audit`
- `/admin/content`
- `/admin/schools`
- `/admin/organizations`
- `/admin/mock-exams`
- `/admin/special-practice`
- `/admin/ai` once created

Manual checks:

- Admin auth gate still blocks non-admin users.
- Current nav item highlights correctly.
- Sidebar/mobile nav does not overlap content.
- Tables do not force page-level horizontal overflow except inside table scroll containers.
- Sticky sidebars/action bars remain usable.
- Public pages are visually unchanged.

## Risks And Mitigations

### Risk: Large `AdminAuditPage` extraction causes regressions

Mitigation:

- Extract one section at a time.
- Keep API calls unchanged initially.
- Use route-level smoke checks after each move.

### Risk: CSS changes unexpectedly affect public pages

Mitigation:

- Scope new console CSS under `.site-main-admin` or `.admin-console`.
- Do not modify public layout classes except to add admin-specific override.

### Risk: Navigation rewrite breaks route handling

Mitigation:

- Keep route constants unchanged in Phase 1-2.
- Use existing `onNavigate` pattern or existing `navigateTo` behavior.
- Add new routes only after shell is stable.

### Risk: Admin users lose familiar paths

Mitigation:

- Preserve old URLs.
- Add redirects/aliases later.
- Use labels that describe actual work, not internal architecture.

## Proposed First Implementation Ticket

Start with the lowest-risk, highest-leverage change:

### Ticket: Full-Width Admin Shell

Scope:

- Detect admin routes in `App.tsx`.
- Add `site-main-admin`.
- Add admin-specific full-width CSS.
- Keep existing `AdminPageShell` and pages unchanged.

Files likely touched:

- `frontend/src/App.tsx`
- `frontend/src/styles/layout.css`

Acceptance:

- `/admin/*` pages are full-width.
- Public pages remain unchanged.
- TypeScript/build passes.

This gives immediate usability improvement while keeping the larger IA refactor separate.

## Proposed Second Implementation Ticket

### Ticket: Admin Console Navigation Foundation

Scope:

- Add `AdminConsoleShell`.
- Add grouped sidebar navigation.
- Wrap current admin pages without changing their internal content.

Files likely touched:

- `frontend/src/components/admin/AdminConsoleShell.tsx`
- `frontend/src/components/admin/AdminSidebar.tsx`
- `frontend/src/components/AdminPageShell.tsx`
- `frontend/src/styles/admin-console.css`

Acceptance:

- Admin pages have persistent workspace navigation.
- Current module is highlighted.
- Mobile layout remains usable.

## Proposed Third Implementation Ticket

### Ticket: Extract AI Operations Route

Scope:

- Add `/admin/ai`.
- Create `AdminAIOperationsPage`.
- Move adaptive observability and AI provider readiness first.
- Link from overview to AI Operations.

Files likely touched:

- `frontend/src/lib/routes.ts`
- `frontend/src/components/AppRouteRenderer.tsx`
- `frontend/src/pages/AdminAuditPage.tsx`
- `frontend/src/pages/AdminAIOperationsPage.tsx`
- `frontend/src/lib/api-admin.ts` only if route support requires it

Acceptance:

- `/admin/ai` exists.
- Overview no longer has to act as the only AI operational surface.
- Existing audit overview still loads.

## Decision Needed Before Execution

Before implementation, choose one route strategy:

1. Conservative route strategy:
   - Keep all current routes.
   - Add only `/admin/ai`.
   - Use navigation grouping visually.

2. Structured route strategy:
   - Add grouped aliases like `/admin/learning/mock-exams`.
   - Keep old routes as redirects/aliases.
   - More complete IA, but larger change.

Recommended: start with conservative route strategy. It gives most of the clarity with lower risk.

