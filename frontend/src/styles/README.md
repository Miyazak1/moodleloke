# Style Architecture

This directory is split into global foundation styles and route or feature styles.

## Global Entry

`index.css` is intentionally small. It may only import:

- `base.css`
- `shared-components.css`
- `layout.css`
- `brand.css`
- `public-shell.css`

Do not add page, admin, commerce, learning, KaTeX, visualizer, mock exam, or account styles to `index.css`.

## Route And Feature CSS

Page styles should be imported by the page module that owns the route:

- Account page: `PublicMePage.tsx` imports `account.css`.
- Schools pages: school pages import `school.css`.
- Learning pages: subject and practice pages import their own learning CSS.
- Commerce pages: cart, checkout, and orders import `commerce.css`.
- Admin pages use `AdminPageShell`, which imports admin CSS.

Heavy feature styles should live with the feature lifecycle. Formula styles are imported by `MathContent`; visualizer category styles are loaded dynamically by `CscaSpecialPracticePage`, and visualizer CSS is split under `visualizers/`.

## Admin Console CSS

Admin pages are allowed to use a full-width operational layout, but the visual language should still match the site system. Keep new admin controls in the component layer:

- `admin-work.css` is the admin CSS aggregator. It imports legacy slices first and `admin-components.css` last.
- `admin-components.css` owns reusable admin primitives: shell navigation, subnav, stat strip, panels, action bars, buttons, and table scroll containers.
- New admin UI should use primitives from `components/admin/AdminWorkbench.tsx` before adding page-specific classes.
- Avoid adding new broad selectors such as `.admin-work-page button` for component behavior. If a legacy selector is unavoidable, exclude `c-admin-*` classes from it.
- Admin component controls should not use gradient button fills or pill-shaped `999px` radii; keep controls quiet, rectangular, and token-driven.

## Account Page CSS

The account page follows the same cleanup pattern:

- `account.css` is the account CSS aggregator. It imports legacy slices first and `account-components.css` last.
- `account-components.css` owns the clean account workbench layer: profile header, section nav, metrics, action panels, cards, filters, empty states, settings rows, and wrong-question review surfaces.
- Existing `account.part-*.css` files are legacy migration slices. Do not add new visual language there unless the same change also moves the affected rules into the account component layer.
- Account component controls should stay quiet and workbench-oriented: no default gradient cards, no `999px` pill buttons, no viewport-scaled `clamp()` typography.
- The account page can be warmer than the admin console, but it should use the same discipline: flat surfaces, thin borders, stable spacing, and clear action hierarchy.

## Size Rules

New CSS files should stay below 1000 lines. If a file crosses that point, split by section or feature before adding more surface area.

Files above 2000 lines are legacy migration targets. Do not add new feature scope to them unless the same change also extracts a meaningful section.

The former page-level large files now stay as small import aggregators. Their ordered `*.part-*.css` siblings preserve the original cascade while keeping each file reviewable.

Visualizer CSS has already been split into:

- `visualizers/math/*.css`
- `visualizers/physics/*.css`
- `visualizers/chemistry/*.css`

## Breakpoints

Prefer these breakpoint bands for new work:

- `980px`: desktop to tablet layout changes.
- `720px`: tablet to mobile layout changes.
- `640px`: compact mobile controls and dense panels.

Avoid adding one-off breakpoints unless a specific component shape requires it.

## Guardrail

Run:

```bash
npm --prefix frontend run test:css-architecture
```

The check keeps `index.css` global-only and reports large CSS files that need follow-up splitting.
