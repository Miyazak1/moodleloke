# Frontend Style Architecture

This project currently uses global CSS imported from `frontend/src/styles/index.css`.
Keep the cascade shallow and keep each selector in the file that owns the feature.

## Import Layers

1. `base.css`
   - Design tokens, CSS reset, base element rules, reusable low-level utilities.
   - No feature-specific page selectors.

2. `layout.css`
   - Shared app shell, generic page containers, tables, KPI grids, process rows.
   - No subject-specific or admin-module-specific rules.

3. `brand.css`
   - Public brand theme overlays and shared chrome such as header and footer.
   - It may theme shared components inside `.brand-work-page`, but should not own admin page layout.

4. `admin.css`
   - Reusable admin components: forms, fields, panels, list items, action rows, checkboxes, admin program cards.
   - Avoid page shell width, route-level layout, and feature-specific page styling here.

5. `admin-work.css`
   - Admin page shell and admin workbench layout.
   - Owns `.admin-work-page`, `.admin-module-nav`, common admin workbench widths, sticky sidebars, and admin responsive layout.

6. Feature files such as `mock-exam.css`, `past-papers.css`, `school.css`, `special-practice.css`
   - Own only their feature pages and feature-specific admin refinements.
   - Do not style selectors from another feature. For example, `mock-exam.css` must not define `.admin-past-paper-page`.

7. `responsive.css`
   - Cross-feature responsive fixes only when a rule genuinely spans multiple features.
   - Prefer local responsive rules in the feature file when the rule is feature-specific.

## Admin Page Contract

New admin pages should use:

- Root: `page-stack brand-page brand-work-page admin-work-page [feature-admin-page]`
- Hero: `page-hero` with `page-kicker`, `h1`, and `page-body`
- Navigation: `AdminNavActions` / `admin-module-nav`
- Workbench: `admin-shell` for list/editor layouts, or feature-owned `*-workbench` when the module needs a custom layout
- Forms: `admin-form-grid`, `admin-form-field`, `admin-actions`
- Lists: `admin-list-panel`, `admin-list-stack`, `admin-list-item`

Do not reintroduce legacy page shells such as `admin-page`, `admin-hero`, `admin-two-column`, `admin-list-row`, or `admin-panel-head`.

## Cleanup Rules

- If a class is not referenced by JSX, a component, or documented dynamic generation, delete it.
- If a selector belongs to another feature, move it to the owning feature file.
- Avoid broad compatibility selectors. Migrate JSX to the current contract instead.
- Avoid high-specificity fixes unless they are scoped to a feature root.
- Keep page width decisions in shell/layout files, not individual feature cards.
