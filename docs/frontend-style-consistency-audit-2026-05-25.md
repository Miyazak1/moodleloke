# Frontend Style Consistency Audit - 2026-05-25

## Scope

This audit covers the public pages, mock exam pages, special practice pages, past paper pages, and admin pages in `frontend/src/pages`, `frontend/src/components`, and `frontend/src/styles`.

The goal is to identify:

- Style consistency problems across the full site.
- CSS selectors that can leak across features.
- Dead or compatibility style code that should be removed.
- Component boundaries that should be extracted so future pages do not re-create layout by hand.

## Current State

The project already has a mostly consistent page root pattern:

- Public pages usually use `page-stack brand-page`.
- Admin work pages use `page-stack brand-page brand-work-page admin-work-page`.
- Mock exam pages use `page-stack brand-page mock-exam-page`.
- Special practice pages use `page-stack brand-page special-practice-page`.
- Past paper pages use `page-stack brand-page past-paper-page`.

Recent fixes also moved the past paper admin identity card below the admin module navigation and unified the admin navigation item list.

The remaining issues are mostly caused by broad CSS selectors and repeated shell markup.

## Findings

### P1 - `school-overview.css` Is Acting As A Global Public Shell

`frontend/src/styles/school-overview.css` contains shared rules such as:

- `.site-main-public`
- `.site-main-public > .brand-page`
- `.brand-page`
- `.brand-page.page-stack`
- `.brand-page .page-hero`
- `.brand-page .inline-actions button`
- `.brand-page .ghost`

This file name suggests it belongs to school overview pages, but it currently defines the default shell for nearly all public brand pages. Because it is imported before many feature files, later feature CSS can accidentally depend on it or override it in unpredictable ways.

Recommendation:

- Move truly shared page-shell rules to `layout.css` or a new `public-shell.css`.
- Keep school-specific selectors in `school.css`.
- Avoid generic `.brand-page .x` selectors unless `x` is intentionally global.

### P1 - `responsive.css` Contains Feature-Specific Overrides

`frontend/src/styles/responsive.css` currently contains responsive rules for multiple unrelated features, including public shells, school pages, auth pages, admin pages, and other page-specific components.

Because `responsive.css` is imported late, it has broad cascade power. This makes layout bugs hard to reason about: a feature page can look correct in its own file but be changed later by a global responsive override.

Recommendation:

- Move admin responsive rules into `admin-work.css`.
- Move school responsive rules into `school.css`.
- Move auth responsive rules into `account.css`.
- Keep only truly global breakpoints in `responsive.css`, such as top-level shell width and shared navigation behavior.

### P1 - Several Feature Files Use Broad `.brand-page` Selectors

Examples found:

- `school.css`: `.brand-page .school-*`, `.brand-page .practice-*`
- `prep-consulting.css`: `.brand-page .practice-explanation`
- `base.css`: `.brand-page .search-panel`, `.brand-page .search-result-*`

These selectors are safer than bare class selectors, but still too broad because any page under `brand-page` can be affected when it happens to reuse a common class name.

Recommendation:

- Scope school selectors under `.brand-school-library-page`.
- Scope practice selectors under their actual page root, such as `.brand-practice-page` or `.special-practice-page`.
- Scope shared search UI under a dedicated component root, for example `.site-search-panel`, instead of `.brand-page`.

### P1 - Mock Exam CSS Has Layered Override Blocks

`frontend/src/styles/mock-exam.css` has multiple generations of styles for the same page family, including the subject list page, start page, taking page, report page, and final visual unification overrides.

This is the same category of issue that caused the mock exam route to drift visually from the reference. The current selectors are mostly scoped, but the file is long and has repeated definitions near the bottom that override earlier sections.

Recommendation:

- Split mock exam styles by screen:
  - `mock-exam-index.css`
  - `mock-exam-start.css`
  - `mock-exam-taking.css`
  - `mock-exam-report.css`
- Keep the public route replica styles in the owning file, not as late patch blocks.

### P2 - `!important` Is Being Used As A Patch Tool

Non-reset `!important` usage appears in:

- `subject-learning.css`
- `scholarships.css`
- `special-practice.css`

The reset rules in `base.css` for reduced motion are acceptable. The others are signs that selector ownership is unclear.

Recommendation:

- Replace feature-level `!important` with scoped roots and clearer selector order.
- Remove these one file at a time with visual verification.

### P2 - `special-practice.css` Is Too Large

`special-practice.css` is over 220 KB and contains both regular practice flow styles and many topic visualizer styles. This makes it expensive to review and easy to regress.

Recommendation:

- Keep shared special-practice shell and CBT flow in `special-practice.css`.
- Move visualizer groups into files by domain:
  - `special-physics-visualizers.css`
  - `special-chemistry-visualizers.css`
  - `special-math-visualizers.css`

### P2 - Admin Pages Need A Shared `AdminPageShell`

Admin pages currently repeat this structure:

- Root wrapper
- Hero
- `AdminNavActions`
- `AdminAuthGate`
- Metrics/cards
- Workbench body

Even after navigation unification, each admin page can still drift in ordering, width, spacing, and hero composition.

Recommendation:

Create an `AdminPageShell` component that owns:

- Root classes: `page-stack brand-page brand-work-page admin-work-page`.
- Hero block.
- Standard admin navigation.
- Identity/auth gate placement.
- Optional metric strip.
- Standard body slots.

Each admin page should only provide content-specific copy and panels.

### P2 - Card, Button, Pill, And Form Components Are Duplicated

Many pages define local button/card/pill styles rather than using common primitives. This creates subtle inconsistencies in radius, hover, text weight, and spacing.

Recommendation:

Create or standardize these primitives:

- `SurfaceCard`
- `PrimaryButton`
- `GhostButton`
- `StatusPill`
- `MetricCard`
- `AdminFormField`
- `FilterTabs`

Use page-level CSS only for layout and feature-specific composition.

## Recommended Cleanup Order

1. Create shared shells:
   - `PublicPageShell`
   - `AdminPageShell`

2. Move global public shell rules out of `school-overview.css`.

3. Decompose `responsive.css` into owner files.

4. Scope broad `.brand-page .school-*`, `.brand-page .practice-*`, and `.brand-page .search-*` selectors.

5. Split `mock-exam.css` by screen.

6. Split `special-practice.css` by flow and visualizer domain.

7. Remove non-reset `!important` rules after each owning selector is fixed.

8. Add a lightweight visual regression checklist:
   - Home
   - Subject learning page
   - Special practice list/start/taking/report
   - Mock exam list/start/taking
   - Past papers list/detail/admin
   - Admin audit/content/schools/scholarships/mock/special/past/users

## Architecture Target

CSS should follow this ownership model:

1. `base.css`: tokens, reset, typography, app-wide utilities only.
2. `layout.css`: generic page layout primitives only.
3. `public-shell.css`: public page shell and hero defaults.
4. `admin-work.css`: admin shell, admin nav, admin shared workbench primitives.
5. Feature files: only selectors scoped under their page root.
6. Responsive rules live beside their owning feature whenever possible.

No feature CSS should rely on late global overrides to look correct.

## Immediate Next Refactor Candidate

The safest next implementation step is `AdminPageShell`.

Why:

- Admin drift is visible and repeated.
- It does not require rewriting every visual style at once.
- It reduces future inconsistencies immediately.
- It gives a concrete home for nav, identity, and metric placement.

After that, move the global shell rules out of `school-overview.css`, because that is the highest-impact CSS ownership issue.

## Implementation Status - 2026-05-25

Completed:

- Added `AdminPageShell` and migrated admin work pages to the shared hero, navigation, and identity placement.
- Expanded `AdminNavActions` so every admin page uses the same navigation set, including city guides, application months, and past papers.
- Moved shared public page-shell rules from `school-overview.css` into `public-shell.css`.
- Moved auth shell rules into `account.css`, leaving `school-overview.css` as a narrow compatibility file for school/consulting hero selectors only.
- Scoped high-risk `.brand-page .school-*`, `.brand-page .practice-*`, and `.brand-page .search-*` selectors under their owning page roots.
- Moved admin-specific responsive rules out of `responsive.css` and into `admin-work.css`.
- Removed non-reset `!important` rules from subject learning, scholarships, and special-practice styles.
- Moved KaTeX vendor CSS earlier in the style import order so feature math styles can override it through normal cascade order.
- Split mock exam style layers into route-specific ownership, then removed the obsolete `mock-exam-replica.css` import/file and the final replica override block from `mock-exam-maturity.css`.
- Moved the search page styles and its responsive rules out of `base.css`/`responsive.css` into the new scoped `search.css`.
- Moved auth/login styles and responsive rules out of `base.css`/`responsive.css`/`school.css` into scoped `account.css`.
- Moved school library search/list/result responsive rules out of `base.css`/`responsive.css` into scoped `school.css`, and replaced the search page's reused `school-search-field` class with a dedicated `search-field`.
- Moved school detail responsive rules out of `responsive.css` into scoped `school.css`.
- Moved normal practice-page styles and responsive rules out of `base.css`/`school.css`/`prep-consulting.css`/`responsive.css` into the new scoped `practice.css`.
- Moved CSCA prep and consulting responsive rules out of `responsive.css` into their existing owner file `prep-consulting.css`.
- Moved public account dashboard responsive rules into `account.css`.
- Moved commerce and school-compare responsive rules into the new late-imported `work-responsive.css`, and removed the dead `.home-school-grid` responsive rule.
- Split special practice visualizer rules into shared/math, physics, and chemistry files: `special-practice-visualizers.css`, `special-practice-visualizers-physics.css`, and `special-practice-visualizers-chemistry.css`.
- Normalized `/zh/csca-special-practice/...` routes to the existing unprefixed special-practice route tree so localized links do not fall through to the 404 page.
- Verified the split with production build and representative Playwright screenshots for math sequence, physics Newton's second law, and chemistry acid-base neutralization visualizers.
- Continued reducing `CscaSpecialPracticePage.tsx` by extracting physics simulation islands into `pages/special-practice/`: Newton's second law, kinematics graphs, momentum collision, energy conservation, electric field, photoelectric effect, circular motion, circuit series/parallel, electromagnetic induction, thin lens, wave visualization, magnetic force, double-slit interference, ideal gas law, and thermodynamics first law now live in dedicated components.
- Moved the photoelectric effect, circular motion, circuit series/parallel, electromagnetic induction, thin lens, wave visualization, magnetic force, double-slit interference, ideal gas law, and thermodynamics first law styles, including their mobile rules, out of the shared visualizer file and into `special-practice-visualizers-physics.css`.
- Moved the remaining physics and chemistry responsive visualizer rules out of the shared/math visualizer stylesheet and into `special-practice-visualizers-physics.css` and `special-practice-visualizers-chemistry.css`, leaving the shared file to own common and math visualizer rules only.
- Extracted the chemistry visualizer implementations from `CscaSpecialPracticePage.tsx` into `pages/special-practice/ChemistryVisualizers.tsx`; acid-base neutralization, reaction rate, redox cell, pH titration, atomic structure, bonding, ion reaction, and organic hydrocarbon simulations are now owned by a chemistry component module.
- Extracted the math visualizer implementations from `CscaSpecialPracticePage.tsx` into `pages/special-practice/MathVisualizers.tsx`, leaving the main special-practice page to own routing, session flow, and the math simulation list.
- Removed the duplicated/dead math visualizer helper code and the stale solid-geometry canvas boundary from `CscaSpecialPracticePage.tsx` after extraction.
- Reduced `base.css` to design tokens, reset, focus states, and reduced-motion behavior only.
- Added `shared-components.css` for shared UI primitives such as error banners, status panels, inline action rows, ghost buttons, and empty states.
- Added `compare.css` and moved compare-page styles out of broader shared files.
- Moved public account, school detail, commerce, and compare responsive rules into their owning files.
- Moved generic `process-list` and `process-row` primitives into `layout.css`, with public-shell refinements in `public-shell.css`.
- Deleted the late global `responsive.css` layer after migrating its remaining rules into `public-shell.css` and `layout.css`.
- Deleted the legacy `school-overview.css` compatibility file after moving its remaining school and consulting hero rules into `school.css` and `prep-consulting.css`.
- Deleted the temporary `work-responsive.css` layer after moving its commerce and compare rules into `commerce.css` and `compare.css`.
- Moved `commerce-status-grid` base styles out of `layout.css` and into `commerce.css`, so commerce responsive rules are no longer overridden by shared layout import order.
- Reordered the stylesheet entrypoint so `base.css`, `shared-components.css`, `layout.css`, `brand.css`, and `public-shell.css` load before feature-owned style files.
- Moved admin KPI/table/status primitives out of `layout.css` into `admin-work.css`, moved order status pills into `shared-components.css`, and moved `brand-work-page` shell rules into `brand.css`.
- Added shared `AdminFormField` and `StatusPill` UI primitives.
- Migrated the past-paper admin form fields and admin users form/filter fields to `AdminFormField`.
- Migrated admin user status, order status, account dashboard order status, and school/mock/special admin editor status rendering to `StatusPill`, then removed the legacy `admin-status-pill`, `order-status-pill`, and `school-status-pill` style hooks.
- Migrated mock exam, special practice, and scholarship admin editor fields to `AdminFormField`.
- Migrated content admin create/search, exam schedule, vocabulary, and generic content editor fields to `AdminFormField`.
- Migrated the school admin create/search, basic info, CSCA rules, programs, scholarships, cost/link, source review, and import fields to `AdminFormField`.
- Added shared `GhostButton` and `InlineActions` UI primitives.
- Migrated admin user, content, mock exam, special practice, school, past-paper, scholarship, city-guide, timeline-window, confirm-dialog, and admin-auth action rows/buttons to `GhostButton` and `InlineActions`.
- Migrated the remaining public commerce, account, compare, school, search, scholarship, past-paper, Study in China, CSCA prep, subject, vocabulary, mock exam, and special practice ghost buttons/action rows to `GhostButton` and `InlineActions`, including the extracted math/physics/chemistry visualizer components.
- Added shared `MetricCard` and migrated the first repeated KPI/status strips: admin audit, admin city guide metrics, commerce cart/orders status grids, compare status strip, and commerce loading skeleton metrics.
- Added shared `SurfaceCard` for simple card shells and migrated commerce card shells, commerce skeleton cards, public account section/empty cards, and content admin editor/preview cards while preserving their existing classes and element types.
- Reviewed the remaining direct `primary` button classes. They are domain-specific CTA/play/check controls in visualizers and school detail flows, so a shared `PrimaryButton` wrapper is not being introduced for this pass.
- Added `frontend/e2e/style-primitives.spec.ts` to cover the migrated shared surfaces on desktop and mobile: admin content editor/preview cards, account section/empty cards, commerce metric/card/payment surfaces, and special-practice visualizer CTA areas.
- Verified the new style-primitives Playwright coverage against the current Vite app on desktop and mobile with no horizontal overflow detected.

Remaining planned cleanup:

- Keep applying `SurfaceCard` only to simple repeated shell cards; domain-specific school, practice, visualizer, and result cards should stay in their owning feature files.
- Continue opportunistic route-level cleanup when touching pages, but the main shared primitive migration is complete for this audit pass.
