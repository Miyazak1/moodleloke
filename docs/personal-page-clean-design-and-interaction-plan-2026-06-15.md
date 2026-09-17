# Personal Page Clean Design And Interaction Plan

Date: 2026-06-15

Scope:

- `/zh/me` account personal page
- public account overview, settings, saved schools, comparison, practice history, wrong-question review, orders, AI credits, and learning dashboard
- frontend files currently centered around `frontend/src/pages/PublicMePage.tsx` and `frontend/src/styles/account.css`

## Purpose

The account personal page already contains valuable product capability, but its current presentation is too visually busy and not clean enough for the current CSCAlite site direction.

The target is not to remove capability. The target is to reorganize the page into a mature, quiet, practical user workbench:

- cleaner visual language
- stronger information hierarchy
- fewer decorative treatments
- clearer user actions
- reusable account-page component styles
- interaction behavior that feels stable and predictable

The admin console cleanup is a useful reference point. The personal page should not look like an admin backend, but it should borrow the same discipline: restrained surfaces, clear grouping, consistent typography, practical controls, and limited visual noise.

## Current Assessment

The personal page has strong feature coverage:

- identity and profile state
- email verification
- admin shortcut
- AI credits
- learning profile metrics
- readiness and learning dashboard
- review queue
- wrong-question dashboard
- wrong-question review packs
- wrong-question filters and expanded review
- special practice records
- mock exam records
- saved schools
- comparison schools
- account settings
- password update
- orders

The problem is not feature absence. The problem is that the page reads like multiple product surfaces layered together:

- student learning dashboard
- wrong-question workbench
- admissions asset center
- account settings
- order center
- AI usage panel

All of these are useful, but they currently compete for attention. The page therefore feels heavy, less fresh, and less clean than the recently improved admin panel.

## Design Diagnosis

### 1. Visual Noise Is Too High

The account styles use many decorative treatments:

- repeated gradients
- large pill shapes
- high-radius buttons and badges
- multiple colored emphasis surfaces
- several large dashboard cards
- viewport-scaled headings inside workbench content
- shadows used as emphasis rather than structure

This makes the page feel more like a promotional dashboard than a clean personal workspace.

Required direction:

- reduce gradients to near zero in workbench content
- use flat white or very light neutral surfaces
- use thin borders for grouping
- use smaller, consistent radii
- avoid pill buttons except for small status chips where the shape has semantic value
- make primary actions obvious by placement and hierarchy, not by heavy decoration

### 2. Information Hierarchy Is Not Decisive Enough

The current overview tries to answer too many questions at once:

- who am I?
- what is my learning state?
- what should I do next?
- how many schools have I saved?
- how many schools am I comparing?
- how many practice records do I have?
- what is my wrong-question state?
- what are my trends?
- what orders do I have?

These are not equal-priority questions.

The first screen should answer only:

1. What is my current status?
2. What is the most important next action?
3. What changed recently?
4. Where can I continue working?

Everything else should sit below or inside a clearly named section.

### 3. The Page Is Functionally Rich But Structurally Overloaded

`PublicMePage.tsx` currently owns too much:

- route-level page state
- data loading state
- error state
- profile form state
- password form state
- section navigation state
- wrong-question filter state
- learning dashboard rendering
- settings rendering
- school list rendering
- practice and mock rendering
- orders rendering
- localized page copy

This makes style improvement risky because visual changes are tightly coupled to business logic and rendering branches.

Required direction:

- split account page into product sections
- extract reusable account components
- keep visual primitives out of route logic
- move copy and data-shaping helpers away from the main route component when practical

### 4. Navigation Feels Like Tabs But Behaves Like Local State

The page reads `?section=` as initial state, but section clicks currently change only React state and scroll to content.

This weakens the workbench feel:

- refresh may not preserve the clicked section
- sharing a section URL is not natural
- browser back does not move through meaningful account sections
- assistive semantics are closer to tabs than the current button navigation expresses

Required direction:

- make section changes update `?section=overview|settings|saved|compare|practice|orders`
- use either a real tablist pattern or page-section navigation with correct `aria-current="page"`
- preserve filter query parameters for wrong-question views
- ensure section state, URL state, and rendered state stay aligned

### 5. The Personal Page Should Be User-Facing, Not Marketing-Like

The account page should feel warmer than the admin panel, but not decorative.

It should be:

- clean
- calm
- practical
- readable
- action-oriented
- consistent with the rest of the site

It should not feel like:

- a landing page
- a data wall
- a colorful analytics demo
- a separate visual product from CSCAlite

## Target Product Structure

The account page should be organized around four product areas.

### Overview

Purpose:

- give the user a clear status and next action

Owns:

- profile summary
- email verification alert when needed
- AI credit summary if relevant
- readiness or learning status summary
- next recommended action
- recent activity snapshot
- links into deeper sections

Does not own:

- full wrong-question filters
- full trend analysis
- full school cards
- full order list
- password settings

### Learning Review

Purpose:

- help students continue CSCA preparation and repair mistakes

Owns:

- readiness details
- learning trend
- review queue
- wrong-question review packs
- wrong-question list
- special practice records
- mock exam records

Default view should emphasize:

- due review
- high-frequency weak areas
- latest mistakes
- latest mock/practice record

Advanced filters should be available, but not visually dominate the first view.

### Application Assets

Purpose:

- collect and compare admissions-related assets

Owns:

- saved schools
- comparison schools
- school detail entry points
- application-related prompts

This area should feel like an organized list, not a dashboard.

### Account And Services

Purpose:

- manage account, security, orders, and service state

Owns:

- display name
- email status
- role
- password setup/update
- orders
- service entry points

This area should use form and table/list components, with minimal decoration.

## Target First Screen

The first screen should be lighter than the current implementation.

Recommended composition:

1. Compact profile header
   - display name or email
   - role/status
   - email verification state
   - no oversized hero treatment

2. Next action panel
   - one primary recommendation
   - one primary button
   - optional secondary link

3. Key metrics row
   - 3 to 4 metrics maximum
   - learning state, review due, saved schools, active service/order if relevant

4. Section navigation
   - clean segmented or horizontal navigation
   - no heavy pill styling
   - active state by background or text weight, not strong borders plus shadows

The first screen should not show all charts and long diagnostic modules at once.

## Visual Language

### Keep

- `brand-page`
- `brand-work-page`
- site-level typography tokens
- site-level form/input behavior
- thin bordered surfaces
- white and near-white work areas
- restrained blue/teal accents
- practical icon usage where it improves scanning

### Reduce

- gradient panels
- pill buttons
- oversized dashboard headings
- heavy shadows
- large decorative cards
- too many accent colors in one viewport
- nested card-on-card compositions

### Avoid

- large marketing-style hero blocks inside the logged-in account workspace
- viewport-scaled font sizes inside compact workbench panels
- gradients as default card backgrounds
- active states that rely on thick borders or strong shadows
- multiple competing primary buttons in the same region

## Component Architecture

Create an account component layer similar in spirit to the admin component cleanup.

Suggested components:

- `AccountShell`
- `AccountHeader`
- `AccountSectionNav`
- `AccountSection`
- `AccountSectionHeader`
- `AccountMetricCard`
- `AccountActionPanel`
- `AccountDataCard`
- `AccountDataList`
- `AccountFilterBar`
- `AccountEmptyState`
- `AccountFeedback`

Suggested CSS files:

- `frontend/src/styles/account.css`
  - import aggregator only

- `frontend/src/styles/account-layout.css`
  - page shell, account width, section layout, responsive behavior

- `frontend/src/styles/account-components.css`
  - reusable account cards, nav, metrics, panels, filters, empty states

- `frontend/src/styles/account-learning.css`
  - learning dashboard, wrong-question review, heatmaps, trends

- `frontend/src/styles/account-settings.css`
  - profile, security, orders, account forms

Style ownership rule:

- route-specific CSS should not define generic button systems
- learning-specific CSS should not restyle account settings
- account components should use shared site tokens instead of inventing new visual language

## Route And Code Architecture

Recommended React split:

- `PublicMePage.tsx`
  - route owner, authentication gate, section state, high-level composition

- `account/useMePageData.ts`
  - data loading, errors, derived counts

- `account/mePageCopy.ts`
  - localized account page copy

- `account/AccountOverview.tsx`
  - first-screen and summary content

- `account/AccountLearningReview.tsx`
  - readiness, learning dashboard, wrong-question review

- `account/AccountApplicationAssets.tsx`
  - saved and comparison schools

- `account/AccountSettingsAndServices.tsx`
  - settings, password, orders, account service state

- `account/components/*`
  - reusable account UI components

This split should happen without removing any existing capability.

## Interaction Rules

### Section Navigation

- Section clicks update `?section=...`.
- Browser back and forward restore the section.
- Direct URLs open the expected section.
- Section navigation remains visible enough for orientation, but should not dominate.
- Use correct accessible semantics:
  - tablist/tabpanel if sections behave like tabs
  - `aria-current="page"` if sections are treated as navigable page sections

### Overview Actions

- Show one primary next action.
- Secondary actions should be quiet links or small buttons.
- Do not place multiple equal-weight primary actions in the same panel.

### Wrong-Question Review

- Default to action-oriented views:
  - due review
  - high-frequency pattern
  - latest wrong questions

- Put advanced filters behind a compact filter bar.
- Keep expanded question review readable:
  - prompt
  - user's answer
  - correct answer
  - explanation
  - knowledge tags
  - repair action

### Settings

- Settings should look like a clean form, not a dashboard.
- Feedback messages should use consistent site alert styles.
- Password update should have clear validation and disabled states.

### Empty States

Every empty state should answer:

- what is empty
- why it matters
- what the user can do next

Empty states should be calm and compact.

## Implementation Plan

### Phase 1: Audit And Guardrails

Deliverables:

- inventory of current account page sections and CSS selectors
- list of all existing user-facing capabilities
- visual debt list for gradients, pill buttons, oversized typography, and duplicated button styles
- regression checklist for saved schools, compare, practice, wrong questions, settings, orders, and AI credits

Exit criteria:

- no capability is removed during cleanup
- current page behavior is documented before edits

### Phase 2: Visual Cleanup Without Structural Rewrite

Deliverables:

- reduce gradients and heavy shadows in account workbench content
- normalize card radius, border, spacing, and typography
- make nav active state cleaner
- simplify primary and secondary button treatment
- make overview first screen quieter

Exit criteria:

- account page visually aligns with the cleaned admin direction while still feeling user-facing
- no large decorative dashboard treatment remains in normal account panels

### Phase 3: Component Extraction

Deliverables:

- introduce reusable account components
- move repeated card, metric, nav, filter, empty-state styles into `account-components.css`
- keep learning-specific chart and wrong-question styles in account learning CSS

Exit criteria:

- new account sections can be built without writing one-off card/button styles
- route component is smaller and easier to reason about

### Phase 4: Navigation And Interaction Maturity

Deliverables:

- URL-backed account section navigation
- correct browser back/forward behavior
- accessible section navigation semantics
- wrong-question filters remain shareable through query parameters

Exit criteria:

- `/zh/me?section=practice` opens practice reliably
- clicking sections updates URL
- browser back restores the previous section/filter state

### Phase 5: Final Verification

Deliverables:

- desktop visual check
- mobile visual check
- interaction check for every section
- build/type check
- focused regression checks for account workflows

Exit criteria:

- no missing existing panel
- no broken section navigation
- no unstyled native controls
- no obvious text overflow
- no visual style regression against the current site direction

## Acceptance Criteria

The redesign is acceptable only when all of the following are true:

- The account page looks cleaner than the current implementation.
- The page still feels part of CSCAlite, not a separate product.
- The logged-in first screen has one clear primary next action.
- Gradients are not used as default workbench card backgrounds.
- Large pill buttons are not the default button language.
- Typography inside panels uses stable sizes rather than viewport-scaled display type.
- Section navigation is URL-backed and accessible.
- Saved schools, comparison, practice records, wrong-question review, settings, password update, orders, AI credits, and admin shortcut remain available.
- Empty, loading, error, disabled, and success states are styled consistently.
- CSS ownership is clear enough that future account features do not require one-off styling.

## Non-Goals

This plan does not require:

- removing learning analytics
- removing wrong-question review
- removing admissions assets
- making the account page identical to the admin console
- changing backend APIs
- changing pricing, order, or AI credit logic

The goal is a cleaner frontend presentation and a more mature account-page architecture.

## Recommended Direction

Use the cleaned admin panel as the discipline reference, not as the visual clone.

The personal page should become:

- lighter than the current account dashboard
- warmer than the admin console
- calmer than a marketing page
- more structured than a general profile page

In short:

> A clean personal workbench for learning, application assets, and account services.

