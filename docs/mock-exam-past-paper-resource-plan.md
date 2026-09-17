# Mock Exam Past Paper Resource Plan

## Context

The mock exam subject pages need a "past papers online" section similar to the reference site. This section is not another mock exam paper. It is a resource/document entry point where each card links to a past paper detail page, usually backed by PDF files and supporting assets.

CSCAlite should make these resources fully open for now: all listed past papers can be viewed and downloaded for free. The implementation should still reserve the structure needed for future access rules, purchase gates, file replacement, and analytics.

## Product Shape

### Public Routes

- `/csca-mock-exam`
  - Main mock exam landing page with Math, Physics, and Chemistry entry cards.
- `/csca-mock-exam/:subject`
  - Subject mock exam page.
  - Shows subject-specific past papers first.
  - Shows complete mock exam papers below.
- `/past-papers`
  - Past paper resource index across all subjects.
- `/past-papers/:slug`
  - Past paper detail page.
  - Shows cover, title, metadata, file details, included materials, and download actions.

### Subject Page Layout

Each subject mock exam page should render:

1. Subject hero and quick stats.
2. "Past Papers Online" section.
   - Shows the newest or featured past papers for the current subject.
   - Cards link to the past paper detail page.
3. Complete mock exam section.
   - Existing CBT-style 48-question mock papers.
4. Free access explanation.
   - Current version: all past papers and mock papers are free.
   - Future-ready copy should not hard-code paid language into data contracts.

### Past Paper Card

A card should display:

- Cover image or generated placeholder.
- Title.
- Subject.
- Year/month or exam session.
- Language.
- Question count or page count.
- Whether answers are included.
- Whether detailed solutions are included.
- Free/download badge.

Card action:

- Opens `/past-papers/:slug`.
- Do not download directly from the listing. The detail page should own the download action.

### Past Paper Detail Page

The detail page should display:

- Cover image.
- Title.
- Subject and exam session.
- File metadata, such as file type and size.
- Included files:
  - Main question paper PDF.
  - Optional answer PDF.
  - Optional solution PDF.
- Download buttons.
- Related papers from the same subject.
- A short note that resources are for practice and review.

Current behavior:

- Every published file is downloadable for free.

Reserved behavior:

- Resources can later require login, payment, or license ownership without changing routes.

## Admin Requirements

### Admin Routes

- `/admin/past-papers`
  - List, search, filter, publish/unpublish.
- `/admin/past-papers/new`
  - Create resource.
- `/admin/past-papers/:id`
  - Edit metadata, manage files, and review download stats.

### Admin List

Filters:

- Subject.
- Year.
- Language.
- Published status.
- Free/locked access status.
- Has answers.
- Has solutions.

Columns:

- Cover thumbnail.
- Title.
- Subject.
- Year/month.
- Language.
- Published status.
- File count.
- Download count.
- Updated date.

Actions:

- Edit.
- Preview public detail page.
- Publish/unpublish.
- Soft delete.

### Admin Editor

Metadata fields:

- Title.
- Slug.
- Subject.
- Exam year.
- Exam month/session.
- Language.
- Question count.
- Page count.
- Has answers.
- Has solutions.
- Description.
- Sort order.
- Featured flag.
- Published flag.
- Free flag.

File fields:

- Cover image.
- Main PDF.
- Answer PDF, optional.
- Solution PDF, optional.

File management:

- Upload new file.
- Replace file.
- Remove optional file.
- Show file size and MIME type.
- Keep `updatedAt` for cache busting and audit visibility.

## Data Model

Use a separate past paper resource model rather than reusing mock exam paper tables. Mock exam papers are interactive CBT attempts; past papers are downloadable document resources.

### `past_papers`

Suggested fields:

```text
id
slug
title
subject
examYear
examMonth
sessionLabel
language
description
questionCount
pageCount
hasAnswers
hasSolutions
coverUrl
isFree
isPublished
isFeatured
sortOrder
downloadCount
createdAt
updatedAt
deletedAt nullable
```

### `past_paper_files`

Use a child table so each past paper can support multiple files.

```text
id
pastPaperId
kind                 // question | answer | solution | extra
label
fileUrl
originalFilename
mimeType
fileSizeBytes
checksum nullable
createdAt
updatedAt
```

### `past_paper_downloads`

Track downloads even while resources are free.

```text
id
pastPaperId
fileId nullable
userId nullable
ipHash nullable
userAgentHash nullable
downloadedAt
```

## API Plan

### Public API

- `GET /api/v1/past-papers`
  - Query params: `subject`, `year`, `language`, `featured`, `page`, `pageSize`.
  - Returns only published resources.
- `GET /api/v1/past-papers/:slug`
  - Returns detail data and downloadable file metadata.
- `POST /api/v1/past-papers/:slug/downloads/:fileId`
  - Records a download and returns a signed or public download URL.

Current implementation can return direct URLs because all files are free.

Future implementation can check login, license, or purchase state before returning a URL.

### Mock Exam API Extension

Extend subject detail:

```json
{
  "subject": {},
  "pastPapers": [],
  "papers": [],
  "bundle": {}
}
```

The subject mock exam page should read `pastPapers` from this response and render the past paper section above mock papers.

### Admin API

- `GET /api/v1/admin/past-papers`
- `POST /api/v1/admin/past-papers`
- `GET /api/v1/admin/past-papers/:id`
- `PATCH /api/v1/admin/past-papers/:id`
- `DELETE /api/v1/admin/past-papers/:id`
- `POST /api/v1/admin/past-papers/:id/files`
- `POST /api/v1/admin/past-papers/:id/files/upload`
- `PATCH /api/v1/admin/past-papers/:id/files/:fileId`
- `DELETE /api/v1/admin/past-papers/:id/files/:fileId`

### Storage Choice

The current implementation uses self-hosted server storage instead of Gumroad-hosted files because the resources are free and should be downloadable without a checkout step.

- Uploaded PDFs are stored under `backend/uploads/past-papers/` by default.
- Public downloads use `/uploads/past-papers/<filename>.pdf`.
- Metadata stays in `PastPaperFile`, including `originalFilename`, `mimeType`, `fileSizeBytes`, and `checksum`.
- `UPLOADS_DIR` can move the storage root when deploying to a cloud server with a mounted persistent volume.
- A future paid flow can add entitlement checks before `recordDownload` returns the file URL without changing the admin upload model.

## Storage Plan

Start with local or existing app storage conventions if the project already has an upload pattern. Keep the storage abstraction narrow:

- Accept upload.
- Validate MIME type.
- Store file.
- Return public or internal URL.
- Store metadata in `past_paper_files`.

Allowed MIME types:

- `application/pdf`
- `image/png`
- `image/jpeg`
- `image/webp`

Validation:

- PDF size limit.
- Image size limit.
- Required main PDF.
- Optional answer and solution PDFs.

## Access Policy

Current:

- All published past papers are free.
- Download does not require purchase.
- Login is optional.

Reserved:

- `isFree` can become false.
- Download endpoint can require auth/license.
- Existing public detail page can show locked state later without route changes.

## Implementation Phases

### Phase 1: Data And Public Read

- Add database tables.
- Add seed data for a few math, physics, and chemistry past papers.
- Add public list/detail APIs.
- Add `pastPapers` to mock exam subject API.

### Phase 2: Frontend Display

- Add past paper section to `/csca-mock-exam/:subject`.
- Add `/past-papers` index page.
- Add `/past-papers/:slug` detail page.
- Wire detail page download actions.

### Phase 3: Admin Management

- Add admin list page.
- Add create/edit form.
- Add file upload and replacement.
- Add publish/unpublish controls.

### Phase 4: Download Analytics

- Record download events.
- Show download counts in admin.
- Add simple public download count if useful.

### Phase 5: Future Access Rules

- Add login/license checks if needed.
- Support paid or restricted resources without changing public routes.

## Risks And Notes

- Do not store past paper PDFs inside the mock exam question model.
- Avoid direct download from listing cards; use detail pages so analytics and future access checks have one path.
- Use soft delete for resources so old links do not break immediately.
- Keep file replacement explicit in admin to avoid accidental loss of existing public PDFs.
- The first implementation should not include payment UI, because the current product direction is fully open access.
