# CSCAlite Route Loading Flicker Mitigation Plan

## Goal

Eliminate visible one-frame route loading flicker in the public site while keeping code splitting, internationalization, and data loading reliable.

The target experience is:

- Top navigation, footer, shell background, and page width remain stable during route changes.
- Fast route transitions do not show a temporary full-page loading state.
- Slow route transitions show a controlled, layout-preserving pending state only when useful.
- Data-heavy pages use local skeletons or section-level loading states instead of replacing the whole page.
- Chinese and English routes behave the same way.

## Current State

The frontend currently uses React, Vite, in-app route state, `React.lazy`, and `Suspense`.

Recent mitigation has already been added:

- Route fallback display is delayed by `ROUTE_FALLBACK_DELAY_MS`.
- Header navigation can prefetch route chunks on hover and focus.
- Main navigation dropdowns are clickable and tested in Chinese and English.

This reduces some flicker, but the user can still observe a brief visual jump on some pages. That means the problem is not only raw chunk loading time. It is likely caused by a mix of:

- A route-level `Suspense` boundary replacing the content area.
- Complete fallback pages being rendered for a very short time.
- Page-level data loading states appearing after the route component mounts.
- Locale-aware content requests changing copy or page data after initial render.
- Fonts or layout metrics settling after the first paint.

## Mature Industry Pattern

Mature React applications usually do not solve this by increasing the loading delay. They avoid full-page replacement during normal navigation.

Recommended pattern:

- Keep the application shell mounted and visually stable.
- Avoid route-level fallback pages for ordinary route chunk loading.
- Preload likely routes before the user clicks.
- Render the target page shell immediately when possible.
- Move loading states closer to the data that is actually pending.
- Use skeletons only for sections whose dimensions are known.
- Preserve the previous route only for transitions that would otherwise show a blank content area.

The key principle is: route transition loading should not be more visually disruptive than the final page.

## Root Cause Categories

### 1. Route Chunk Loading

Lazy-loaded route components may suspend while their JavaScript chunk is fetched and evaluated.

Current mitigation:

- `preloadRouteChunk(route)` exists.
- Header nav invokes prefetch on pointer hover and focus.

Remaining issue:

- Hover prefetch can be too late when the user clicks quickly.
- Some links are not in the header and therefore do not receive prefetch.
- The top-level route `Suspense` can still replace the content area if the new route suspends.

### 2. Full-Page Fallback Replacement

The current route fallback uses `FeatureComingSoonPage` as the loading surface in several places. Even with a delay, when it appears for one frame it changes the page structure, text, and background.

This is the most likely visible flicker source.

Better pattern:

- Use `fallback={null}` or a nearly invisible fallback for route chunk loading.
- Use a separate delayed progress indicator only for genuinely slow navigations.
- Do not use a complete page component as a temporary route fallback.

### 3. Page Data Loading

Several pages render their own loading panels after the route component is already mounted. Examples include schools, school detail, mock exam, practice, cart, checkout, orders, city guides, and scholarships.

This can feel like route flicker even after chunk loading is fixed.

Better pattern:

- Keep page header and primary layout stable.
- Show skeletons inside the list, cards, or detail sections.
- Avoid switching the whole page to an empty-state style loading panel unless there is no meaningful page shell.

### 4. I18n and Locale-Dependent Data

Internationalization introduces possible second-paint changes:

- Locale can be read from URL, storage, or default state.
- Public content and schools are reloaded with `locale`.
- Some pages may render fallback Chinese text before English content arrives.

Better pattern:

- Determine locale synchronously before first app render.
- Keep static UI messages available synchronously.
- Treat backend localized content as data loading, not as shell initialization.
- Avoid rendering one locale and immediately switching to another.

### 5. Fonts and Layout Metrics

The project now loads Inter from Google Fonts for clearer English text. A web font can cause a small text metric shift when it arrives.

Better pattern:

- Keep `display=swap` for readable first paint.
- Use a font stack with similar metrics.
- If font shift remains visible, consider self-hosting Inter or using `font-display: optional` after measuring.

## Recommended Architecture

### Stable Shell

The shell includes:

- `SiteHeader`
- `<main>` container
- `ErrorBanner`
- `SiteFooter`

These should never unmount or visually jump during route transitions.

### Route Boundary

Route-level `Suspense` should not render a full page fallback.

Recommended implementation direction:

```tsx
<Suspense fallback={null}>
  <AppRouteContent />
</Suspense>
```

For slow routes, use a small delayed pending indicator that does not change layout, such as a top progress bar or a subtle content overlay.

### Previous-Screen Preservation

For routes that still blank out because of a lazy chunk, consider keeping the previous successfully rendered route visible until the next route is ready.

This can be implemented with a small `StableRouteView` wrapper:

- Track the last committed route element.
- Start a transition when `route` changes.
- Render the previous route while the next lazy route is still suspended.
- Commit the new route once it resolves.

This is more complex than `fallback={null}`, so it should be Phase 2 if Phase 1 is insufficient.

### Route Preload Registry

The route preload registry should become the single source of truth for lazy chunk imports.

It should support:

- Header hover/focus prefetch.
- Link-level pointer/touch prefetch.
- Idle-time preload for high-frequency routes.
- Manual prefetch before imperative navigation.

High-frequency public routes to idle-preload:

- `/`
- `/study-china`
- `/csca-prep`
- `/csca-subjects`
- `/csca-practice`
- `/csca-mock-exam`
- `/consulting`

Idle preload should be conservative. It should not immediately preload admin pages, large 3D pages, or rarely used deep routes.

### Local Loading States

Data loading should be handled inside the page that owns the data:

- Lists: fixed-card skeleton rows.
- Detail pages: stable heading area plus section skeletons.
- Forms: disabled controls or local spinners near submit actions.
- Reports: keep report layout shell, skeleton charts/tables inside.

Do not use a route fallback as a substitute for data loading UI.

## Phased Execution Plan

### Phase 1: Remove Disruptive Route Fallbacks

Goal: eliminate full-page flicker from lazy route chunk loading.

Actions:

- Replace route-level `FeatureComingSoonPage` loading fallbacks with `null` or a non-layout-changing fallback.
- Keep explicit error and not-found pages unchanged.
- Keep the 3D visualizer canvas fallback, because that is a local component-level fallback.
- Add a delayed global pending affordance only if transitions longer than 300-500 ms need feedback.

Expected result:

- Fast navigation no longer flashes a temporary page.
- Slow lazy imports may briefly keep the current content or show a very subtle pending state.

Verification:

- Run frontend build.
- Run i18n smoke tests.
- Manually test quick clicks across primary nav in Chinese and English.

### Phase 2: Expand Route Prefetch

Goal: reduce the chance that a route suspends after click.

Actions:

- Add idle-time preload for the main public routes after first paint.
- Add link-level prefetch to repeated internal links, cards, CTAs, and footer links.
- Keep admin and large deep feature bundles out of idle preload.
- Add tests for nav dropdown click behavior and route rendering after prefetch.

Expected result:

- Main public routes usually have their chunks ready before click.
- Non-header navigation becomes smoother.

Verification:

- Compare network waterfall before and after.
- Confirm initial page does not eagerly download large admin/3D chunks.
- Run smoke tests on desktop and mobile viewports.

### Phase 3: Page-Level Loading Audit

Goal: distinguish route flicker from data loading flashes.

Actions:

- Audit pages that show full-width loading panels after mount.
- Prioritize:
  - Public schools list
  - School detail
  - Study China city pages
  - Scholarships
  - Mock exam
  - Special practice
  - Cart, checkout, orders
- Convert whole-page loading panels into local skeletons where a stable shell can be rendered.
- Keep copy localized through existing i18n utilities.

Expected result:

- Data fetching feels like content filling in, not page replacement.
- Route transition and data loading become visually separate.

Verification:

- Test slow network throttling in browser DevTools.
- Confirm no Chinese fallback text appears on English pages during loading.
- Add targeted Playwright checks for key English routes.

### Phase 4: I18n Initialization Hardening

Goal: prevent language-related second-paint changes.

Actions:

- Confirm locale is resolved synchronously from URL/storage before first render.
- Confirm message dictionaries for enabled locales are bundled and immediately available.
- Ensure backend localized data requests do not reset already-rendered shell copy.
- Keep URL locale and selector state consistent.

Expected result:

- English routes do not briefly render Chinese shell text.
- Locale changes are intentional and visible only as a user action.

Verification:

- Open `/?lang=en` in a fresh session.
- Hard-refresh English deep routes.
- Confirm header, footer, route title, loading states, and dropdown menus are English on first paint.

### Phase 5: Performance and Visual Regression Guardrails

Goal: make the fix durable.

Actions:

- Add a small Playwright route-transition smoke test that clicks through high-frequency routes and asserts no loading page text appears for fast transitions.
- Add mobile and desktop coverage for nav dropdown routes.
- Track bundle sizes after idle preload changes.
- Add a short release checklist item for route transition flicker.

Expected result:

- Future lazy route changes do not accidentally reintroduce full-page fallback flicker.

Verification:

- `npm --prefix frontend run build`
- `npm --prefix frontend run test:i18n`
- Optional: visual screenshots for `/`, `/study-china`, `/csca-prep`, `/csca-subjects`, `/consulting` in Chinese and English.

## Implementation Notes

### Do First

Start with Phase 1 because it directly addresses the most disruptive source: full-page fallback replacement.

The initial code change should be small:

- Keep `preloadRouteChunk`.
- Keep `DelayedRouteFallback` only if it is used for a subtle non-page fallback.
- Replace route-level `FeatureComingSoonPage` fallback with `null` or a stable progress affordance.
- Do not change page data loading states in the same patch unless a specific page is confirmed as the source.

### Avoid

- Do not increase `ROUTE_FALLBACK_DELAY_MS` as the primary fix.
- Do not preload every route at startup.
- Do not use a large skeleton for every route by default.
- Do not let route loading fallback reuse error, empty-state, or coming-soon page components.
- Do not block first render on backend localized content.

### Good Future Abstractions

Useful abstractions after Phase 1:

- `RouteSuspenseBoundary`
- `useIdleRoutePreload`
- `PrefetchLink`
- `PageSkeleton`
- `SectionSkeleton`
- `StableRouteView`

These should be introduced only when they remove duplication or make behavior more consistent across several pages.

## Acceptance Criteria

The mitigation is complete when:

- Clicking primary navigation items in Chinese and English does not flash a loading or coming-soon page.
- Fast route transitions either keep the current page until ready or switch directly to the target page.
- Slow route transitions show only a subtle, layout-stable pending state.
- Route dropdown menus continue to work in Chinese and English.
- English pages do not briefly render Chinese shell text.
- Build and i18n smoke tests pass.

## Recommended Next Step

Implement Phase 1 immediately:

- Remove route-level full-page loading fallbacks.
- Keep component-level fallbacks for genuinely heavy local widgets such as the 3D visualizer.
- Run build and i18n smoke tests.
- Manually verify the routes where flicker was observed.

If flicker remains after Phase 1, inspect the specific page. At that point the remaining source is likely page data loading, i18n second render, or font metric shift rather than route chunk fallback.

## Execution Log

### 2026-05-19

Completed:

- Replaced route-level full-page `Suspense` fallbacks with `fallback={null}`.
- Kept local heavy-widget fallback for the 3D visualizer.
- Wrapped browser back/forward route updates and imperative `goTo` navigation in `startTransition`.
- Triggered route chunk prefetch before imperative navigation.
- Added idle-time preload for high-frequency public routes:
  - `/study-china`
  - `/csca-prep`
  - `/csca-subjects`
  - `/csca-practice`
  - `/csca-mock-exam`
  - `/services/consulting`
- Replaced the schools list full-width loading message with stable list skeleton cards.
- Replaced the school detail full-page loading hero with a detail-page skeleton that preserves the final page structure.
- Replaced cart, checkout, and orders loading panels with a shared commerce skeleton.
- Replaced the CSCA prep check loading panel with a practice-page skeleton.
- Replaced mock exam loading panels with a mock-exam skeleton.
- Replaced Study China city-detail loading with a city-detail skeleton.
- Replaced My Account initial loading with an account dashboard skeleton.
- Replaced CSCA targeted-practice loading states with a practice-page skeleton.

Verified:

- `npm --prefix frontend run build`
- `npm --prefix frontend run test:i18n -- --workers=1`
- Result: `132 passed`

Remaining likely sources if flicker is still visible:

- Page-level loading states in less-traveled admin/public detail surfaces.
- Font metric shift from the web font loading after first paint.
- Backend localized content replacing already-rendered page copy after a locale-aware request completes.
