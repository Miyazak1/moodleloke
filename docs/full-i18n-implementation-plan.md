# CSCAlite Full Internationalization Implementation Plan

## Goal

Build CSCAlite into a fully multilingual product, starting with a production-shaped architecture instead of a temporary language switcher.

The first release should provide a visible language selector and a complete bilingual path for the most important public flows, while the underlying frontend, backend, admin CMS, and data model are designed for full-site localization.

## Product Scope

Target languages should be configured centrally. The first implementation should ship with:

- Simplified Chinese as the default locale.
- English as the first non-Chinese locale.

The selector can reserve future options aligned with the reference experience:

- `zh-CN` - CN 中文
- `en` - GB English
- `th` - TH ไทย
- `vi` - VN Tiếng Việt
- `ko` - KR 한국어
- `id` - ID Bahasa Indonesia
- `fr` - FR Français
- `de` - DE Deutsch
- `ru` - RU Русский

Only locales with usable content should be enabled for users. Future locales can stay hidden or disabled until translation coverage is high enough.

## Current State

- The frontend is React plus Vite.
- There is no existing i18n library or locale provider.
- Core navigation, account actions, footer links, page headings, empty states, filters, and buttons are mostly hard-coded Chinese in TSX/TS files.
- A scan of `frontend/src` shows Chinese UI text spread across many files, so a single-pass full conversion would be high-risk.
- Home page copy is partially centralized in `frontend/src/content/public-site.ts`.
- Backend public content blocks are stored in `PublicContentBlock`, but the table currently has a unique `key` and no `locale`.
- `/api/v1/content/home` does not accept a locale parameter.
- School, program, scholarship, city guide, timeline, mock exam, and practice content all include user-facing text that will eventually need locale-aware data.

## Guiding Principles

- Do not build a fake or throwaway language switcher.
- Start with the final architecture, but migrate content in phases.
- Chinese remains the canonical fallback until all locales have full coverage.
- Locale selection should be predictable, persistent, and visible.
- Static UI text and backend-authored content should use different localization mechanisms.
- User-generated or source-verification content should not be machine-translated at request time unless a later product decision explicitly allows it.
- Admin workflows must make missing translations visible instead of silently publishing incomplete localized pages.
- Search, filters, and SEO should become locale-aware after the core content model is stable.

## Plan Maturity

This plan is mature enough to guide architecture and sequencing, but the first implementation milestone should still be scoped tightly before coding starts.

Current maturity assessment:

| Area | Maturity | Notes |
| --- | --- | --- |
| Architecture direction | High | Separating static UI messages, CMS content, and structured domain translations is the right long-term shape. |
| Phase order | High | The rollout moves from low-risk global shell work to higher-risk data and SEO work. |
| First milestone execution detail | Medium | Phase 1 and Phase 2 need a concrete implementation brief before work starts. |
| Structured data model | Medium | Translation-table strategy is recommended, but field-by-field tables should be designed per module. |
| Admin workflow detail | Medium | The plan defines required capabilities, but page-level UX still needs design when implemented. |
| Search and SEO | Early | Correctly deferred until localized data and public pages exist. |

The main risk is not the language selector. The main risk is mixing temporary UI translation, CMS localization, and structured data translation into one large change. The rollout should preserve those boundaries.

## Phase Boundary Decisions

The rollout should be phased by user journey and system boundary, not by the number of files translated.

Recommended execution boundaries:

- Phase 1 is frontend-only except for passing locale to existing reads when harmless.
- Phase 2 is backend CMS plus admin content editing.
- Phase 3 migrates public journeys, starting with the highest-value user path.
- Phase 4 handles database-backed domain records module by module.
- Phase 5 handles SEO routes and search after localized content exists.

Phase 1 and Phase 2 can be planned as one product milestone, but they should be implemented as separate code changes where possible:

- Change 1: frontend locale provider, language selector, and global shell localization.
- Change 2: `content_blocks.locale`, localized content API, and admin content editing.

This keeps review and rollback safer.

## Recommended Architecture

### Frontend Locale Layer

Add a global locale provider with:

- Current locale state.
- Supported locale metadata.
- Locale persistence in `localStorage`.
- Optional URL query override, for example `?lang=en`.
- A translation function for static UI strings.
- A fallback chain, starting with current locale and falling back to `zh-CN`.

Recommended files:

```text
frontend/src/i18n/locales.ts
frontend/src/i18n/I18nProvider.tsx
frontend/src/i18n/useI18n.ts
frontend/src/i18n/messages/zh-CN.ts
frontend/src/i18n/messages/en.ts
```

Use structured message namespaces:

```text
common
nav
footer
auth
home
schools
studyChina
scholarships
csca
mockExam
practice
commerce
admin
errors
```

The first implementation can use a small in-repo translation helper. If message formatting, pluralization, date formatting, and extraction become more complex, move to `i18next` or `react-intl`.

### Language Selector

Add a header language selector similar to the reference site:

- Compact trigger showing locale code and native name.
- Dropdown with code, display name, and selected check state.
- Keyboard and outside-click support.
- Responsive behavior that works inside the current header layout.
- Disabled state for not-yet-released locales.

The selector should call `setLocale(locale)` and refresh locale-aware content queries without a full page reload.

### Locale Resolution

Recommended precedence:

1. Explicit query parameter, for example `?lang=en`.
2. Stored preference in `localStorage`.
3. Browser `navigator.languages`.
4. Default `zh-CN`.

Do not infer locale from the user's account role, email, or region.

### Routes

Phase 1 should avoid rewriting every route to locale-prefixed paths. The current router is hand-written, and adding `/en/...` immediately would increase blast radius.

Use query/localStorage locale first:

```text
/schools?lang=en
/csca-mock-exam?lang=en
```

Later SEO phase can add canonical locale-prefixed public routes:

```text
/zh/scholarships
/en/scholarships
/en/study-china/cities
```

When locale-prefixed routes are introduced, keep legacy routes redirecting or resolving safely.

## Backend Content Model

### Public Content Blocks

Change content blocks from globally unique keys to locale-scoped keys.

Recommended Prisma shape:

```prisma
model PublicContentBlock {
  id        String   @id @default(cuid())
  key       String
  locale    String   @default("zh-CN") @db.VarChar(20)
  title     String
  subtitle  String?
  bodyJson  Json     @map("body_json")
  status    String   @default("published")
  sortOrder Int      @default(0) @map("sort_order")
  version   Int      @default(1)
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([key, locale], map: "uq_content_blocks_key_locale")
  @@index([locale, status, sortOrder], map: "idx_content_blocks_locale_status_sort")
  @@map("content_blocks")
}
```

Migration notes:

- Add `locale` with default `zh-CN`.
- Backfill existing rows.
- Replace unique `key` with unique `(key, locale)`.
- Update admin operations to address `(key, locale)` or use a stable row id for edits.

### Content API

Update public content endpoints to accept locale:

```text
GET /api/v1/content/home?locale=en
GET /public-content?locale=en
```

Response behavior:

- Return published blocks for requested locale.
- Fill missing blocks from `zh-CN`.
- Include metadata so the frontend/admin can tell which blocks are fallback content.

Suggested response item fields:

```ts
type PublicContentBlock = {
  key: string;
  locale: string;
  requestedLocale: string;
  isFallback: boolean;
  title: string;
  subtitle?: string;
  body: Record<string, unknown>;
  updatedAt: string;
};
```

### Admin Content API

Admin content should support:

- List by locale.
- Duplicate a locale from `zh-CN`.
- Show translation status per block.
- Edit and publish per locale.
- Keep existing optimistic concurrency with `version`.

Suggested endpoints:

```text
GET /api/v1/admin/content/blocks?locale=en
POST /api/v1/admin/content/blocks/:key/translations
PATCH /api/v1/admin/content/blocks/:key?locale=en
POST /api/v1/admin/content/blocks/:key/publish?locale=en
DELETE /api/v1/admin/content/blocks/:key?locale=en
```

If query-based identity feels fragile, use row ids for update/publish/archive and keep key/locale immutable after creation.

## Data Localization Strategy

Different data families need different treatment.

### Static Product UI

Examples:

- Navigation labels.
- Buttons.
- Filter labels.
- Empty states.
- Validation messages.
- Account menu labels.

Use frontend message files.

### CMS-Owned Public Marketing Content

Examples:

- Home page hero.
- CSCA prep page copy.
- Consulting service copy.
- Release-controlled landing sections.

Use locale-aware `PublicContentBlock`.

### Structured Domain Data

Examples:

- Schools.
- Programs.
- Scholarships.
- City guides.
- Application timeline windows.
- CSCA rules.

Use database translation fields or translation tables. Do not put all structured records into generic content blocks.

Recommended approach:

- Keep canonical source fields, usually Chinese or source-language fields.
- Add translation tables for public display fields.
- Use fallback to canonical fields when translation is missing.

Example:

```prisma
model SchoolTranslation {
  id          String @id @default(cuid())
  schoolId    Int    @map("school_id")
  locale      String @db.VarChar(20)
  name        String?
  summary     String?
  applicationNote String? @map("application_note")

  school School @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@unique([schoolId, locale], map: "uq_school_translations_school_locale")
  @@index([locale], map: "idx_school_translations_locale")
  @@map("school_translations")
}
```

Add equivalent translation tables only when the corresponding module is being migrated.

### Exam And Practice Content

Mock exam papers and practice questions already carry `language` fields in some models. Treat this as content language, not UI locale.

Recommended rule:

- UI locale controls the product shell.
- Paper/question language controls the exam content the user is taking.
- Do not automatically translate exam questions unless the paper has been authored and reviewed in that language.

## Search And Filtering

Search should become locale-aware after public pages and data translations exist.

Initial behavior:

- Search UI text uses frontend i18n.
- Search results use current API data and fallback Chinese content.

Later behavior:

- Accept `locale` on `/api/v1/search`.
- Search translated fields first.
- Search canonical Chinese fields as fallback.
- Return `isFallback` metadata for snippets when useful.
- Localize derived labels like "English-taught", "Scholarship", "Verified", and filter summaries.

## Formatting Rules

Add locale-aware formatting helpers for:

- Dates.
- Month labels.
- Relative deadlines.
- Currency.
- Numbers.
- Lists.

Use `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.ListFormat` where possible.

Examples:

- `2026年6月27日` in Chinese.
- `June 27, 2026` in English.
- `还剩 7 天` versus `7 days left`.
- `¥450 CNY` should stay precise and not be converted unless exchange-rate support is explicitly added.

## Admin Translation Workflow

Admin pages should eventually show translation coverage:

- Locale picker in admin content pages.
- Missing translation badges.
- "Copy from Chinese" action.
- Field-level fallback indicators.
- Publish status per locale.
- Conflict protection through the existing `version` pattern.

Recommended status labels:

- Missing
- Draft
- Published
- Fallback to Chinese
- Outdated

Outdated can be calculated later by comparing source updated time with translation updated time.

## Phased Rollout

### Phase 1 - Architecture And Public Shell

Goal: establish the final i18n skeleton and visible language selector.

Scope:

- Add locale metadata and provider.
- Add translation helper and message files for `zh-CN` and `en`.
- Add header language selector.
- Localize header navigation, account menu, footer, auth entry points, common buttons, and common error/loading states.
- Localize the home page static shell where text is already centralized or low-risk.
- Pass locale into public content fetching only if the API can ignore it safely before Phase 2.
- Keep route structure unchanged.

Exit criteria:

- User can switch between Chinese and English.
- The selected locale persists after refresh.
- Header/footer/nav/auth shell are bilingual.
- Missing messages fall back to Chinese predictably.
- The English header does not overflow desktop or mobile layouts.

Out of scope:

- Locale-prefixed routes.
- Full translation of schools, scholarships, city guides, timeline, exam questions, or practice questions.
- Admin translation workflow.
- Search ranking changes.

### Phase 2 - Locale-Aware CMS Blocks

Goal: make public content blocks truly multilingual.

Scope:

- Add `locale` to `PublicContentBlock`.
- Update migration, Prisma types, backend service, public API, and admin API.
- Add admin locale filtering/editing.
- Seed or duplicate English blocks for home page.
- Update `HOME_COPY` merging to respect requested locale and fallback metadata.

Exit criteria:

- `/api/v1/content/home?locale=en` returns English blocks when available.
- Missing English blocks fall back to Chinese.
- Admin can edit Chinese and English blocks independently.
- Version conflicts still work per localized block.

### Phase 3 - Priority Public Pages

Goal: make the most important public user journey fully bilingual.

Migrate by journey instead of by isolated page count. Recommended first journey:

1. Home page.
2. CSCA prep page.
3. Mock exam listing and attempt shell.
4. Schools listing.
5. School detail.
6. Consulting or registration entry.

Recommended second journey:

1. Subject learning entry pages.
2. Special practice listing and session shell.
3. Study China city pages.
4. Study China timeline pages.
5. Scholarships pages.
6. Commerce pages.

Exit criteria:

- A new English-speaking user can land, understand the product, browse core flows, and start a mock exam without encountering major Chinese UI chrome.
- Remaining untranslated domain data is clearly canonical data, not broken UI.
- Each migrated journey has desktop and mobile visual checks for longer English copy.

### Phase 4 - Structured Data Translations

Goal: localize database-backed domain records.

Scope by module:

- City guides and timeline windows.
- Scholarship records.
- School display content.
- Program display content.
- CSCA rules and application notes.

Use module-specific translation tables rather than a generic blob for everything.

Do not start this phase until each module has a field-level translation map. For example:

- Which fields are canonical and never translated.
- Which fields need human translation.
- Which fields can be derived from localized labels.
- Which fields should remain in the original source language.
- What the fallback behavior is for each field.

Exit criteria:

- Public data-heavy pages can render English display fields from the API.
- Admin can see which records lack translations.
- Fallbacks are consistent and visible to admins.

### Phase 5 - Search, SEO, And Locale Routes

Goal: make multilingual pages discoverable and robust.

Scope:

- Add locale-aware search.
- Add localized metadata and page titles.
- Decide on `/en/...` and `/zh-CN/...` routes.
- Add canonical and alternate links if server-side rendering or static prerendering is introduced later.
- Keep legacy routes functional.

Exit criteria:

- Search prioritizes the current locale.
- Public pages have a durable locale URL strategy.
- SEO pages do not duplicate or cannibalize each other.

## First Milestone Implementation Brief

The first milestone should combine Phase 1 and Phase 2 as a product goal, but keep frontend shell work and backend CMS localization separate in code review.

### Recommended Decisions For Milestone 1

- Use `zh-CN` as the canonical default locale in APIs, storage, and frontend config.
- Use `en` as the first enabled secondary locale.
- Keep future locales configured but disabled until content coverage is ready.
- Start with a lightweight in-repo message helper unless pluralization and extraction needs become urgent.
- Store locale preference in `localStorage`.
- Support `?lang=` as an override.
- Defer server-side user preferred locale until account settings need it.
- Defer `/en/...` routes until Phase 5.

### Frontend Task List

- Add locale config and supported-locale metadata.
- Add `I18nProvider` at the app root.
- Add `useI18n()` and a typed message lookup helper.
- Add `zh-CN` and `en` message files for `common`, `nav`, `footer`, `auth`, `home`, and `errors`.
- Add the header language selector.
- Replace hard-coded text in `SiteHeader`, `SiteFooter`, primary nav construction, and global loading/error states.
- Localize only low-risk home page shell text during this milestone.
- Pass the selected locale into content API calls after the backend supports it.
- Add layout checks for English labels on desktop and mobile.

### Backend Task List

- Add `locale` to `PublicContentBlock`.
- Backfill existing content blocks to `zh-CN`.
- Replace unique `key` with unique `(key, locale)`.
- Update public content mapping to include `locale`, `requestedLocale`, and `isFallback`.
- Update content listing to fetch requested-locale blocks and fill missing blocks from `zh-CN`.
- Update admin content listing and editing to target a locale.
- Preserve version conflict behavior per localized block.
- Seed or create English home blocks.

### Admin Task List

- Add a locale selector to the admin content page.
- Show whether a block is native to the selected locale or falling back to Chinese.
- Add a "copy from Chinese" workflow for a missing translation.
- Keep publish/archive/edit actions scoped to the selected locale.
- Show clear conflict errors when a localized block version is stale.

### Milestone 1 Non-Goals

- Translating every public page.
- Translating school/program/scholarship/city records.
- Translating exam or practice questions.
- Adding SEO route prefixes.
- Reworking search ranking.
- Adding machine translation automation.

## Technical Risks

- Large TSX migration can introduce subtle UI regressions.
- Locale-prefixed routes can break the current hand-written navigation if introduced too early.
- Generic translation blobs can become unmaintainable for schools/programs/scholarships.
- Machine translation without review can damage exam accuracy and admissions trust.
- Search quality can drop if translated fields and fallback fields are mixed without ranking rules.
- Admin users may accidentally publish partial translations unless coverage is visible.

## Test Plan

Frontend:

- Locale selector opens, closes, selects, and persists.
- Header/footer render correctly in Chinese and English.
- Fallback message renders when a key is missing.
- Public pages do not crash when locale changes during a content request.
- Mobile header does not overflow with longer English labels.

Backend:

- Content blocks are unique by `(key, locale)`.
- Public content API returns requested locale when available.
- Public content API falls back to Chinese when translation is missing.
- Admin update/publish/archive respects locale and version.
- Migration preserves existing Chinese content.

E2E:

- Visit home page in Chinese.
- Switch to English.
- Refresh and confirm English persists.
- Navigate across home, schools, CSCA prep, and mock exam entry.
- Switch back to Chinese and confirm content updates.

Visual checks:

- Language dropdown desktop and mobile.
- Long English labels in nav, footer, cards, filters, and buttons.
- Mixed fallback content states.

## Release Gate Additions

Before releasing Phase 1:

- `npm --prefix frontend run build`
- Existing frontend minimal test suite.
- Manual language switch smoke on desktop and mobile.
- Verify no header overflow with English selected.

Before releasing Phase 2:

- Prisma migration applied on a copy of production-like data.
- Existing content blocks are still visible in Chinese.
- English content blocks can be edited and published independently.
- Public home content fallback works when English blocks are missing.

Before releasing later phases:

- Translation coverage report for the target pages.
- E2E smoke for each localized public route.
- Admin review of fallback content.

## Open Decisions

- Whether enabled locale list should be controlled by env config, database config, or frontend constants.
- Whether Phase 1 should use a homegrown message helper or adopt `i18next` immediately.
- Whether user accounts should store a preferred locale server-side.
- Whether public routes should eventually use `/en/...`, `?lang=en`, or both.
- Whether machine translation can be used as a draft-generation tool inside admin workflows.
- Whether translated school/program/scholarship fields should be stored as separate tables or JSON translation maps per record.
- Which locale should be used for Simplified Chinese in URLs and APIs: `zh`, `zh-CN`, or `zh-Hans`.

## Recommended Next Step

Start with Phase 1 and Phase 2 as a single implementation milestone:

- Build the frontend locale provider and language selector.
- Localize the global shell and home page.
- Add locale-aware content blocks on the backend.
- Add admin locale editing for content blocks.

This gives the product a real multilingual foundation while keeping the first implementation small enough to review, test, and release safely.
