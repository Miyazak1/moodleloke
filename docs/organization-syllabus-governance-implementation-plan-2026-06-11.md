# Organization and syllabus governance implementation plan - 2026-06-11

## Why this document exists

This document records the product decisions from the 2026-06-11 pause discussion and turns them into an executable implementation plan.

It focuses on three connected gaps:

1. Organization membership cannot stay as one-by-one manual user binding.
2. Organization governance is an operations domain, but it is different from ordinary user operations.
3. CSCA syllabus data should be uploadable and versioned, and AI question generation must use the structured syllabus scope directly.

## Current code reality

### Organization and BYOK

Current code already has the foundation:

- Prisma models:
  - `Organization`
  - `OrganizationMember`
  - `OrganizationAiCreditPool`
  - `OrganizationLlmProviderConfig`
- Backend service:
  - `backend/src/csca-special-practice/ai-entitlement.service.ts`
- Current admin endpoints:
  - list/upsert organizations
  - manually bind a member by `userId`
  - upsert credit pool
  - upsert organization provider config
- Frontend:
  - Admin Audit has an "Organization AI pools and BYOK" section.

Current limitations:

- Members are added manually by numeric `userId`.
- No invitation flow.
- No bulk import.
- No cohort/class grouping.
- Organization roles are plain strings but not yet governed by a clear permission matrix.
- Platform admin and organization admin are not yet separated as distinct operation scopes.

### Syllabus and AI question generation

Current code already has the foundation:

- Prisma `CscaExamTopic` has:
  - `examScope`
  - `syllabusVersion`
  - `sourceUrl`
  - `sourceLabel`
  - `lastVerifiedAt`
  - `verifiedBy`
  - `allowedQuestionTypes`
  - `difficultyRange`
- `CscaQuestion` stores:
  - `topicId`
  - `syllabusVersion`
  - `blueprintId`
  - `sourceType`
- Syllabus governance endpoints already support topic-level and bulk preview/apply for version/source/status updates.
- Adaptive question selection already filters direct unified-bank questions to the current topic syllabus version.

Current status:

- The syllabus JSON upload/import flow is operational: admins can download a template, upload or paste `csca-syllabus-v1` JSON, preview impact, save a draft, apply it, archive drafts, confirm code migrations, export preview/applied evidence, and review affected questions from `/admin/csca-syllabus`.
- AI generation now receives structured `syllabusScope` as first-class input, including exam scope, allowed question types, difficulty range, excluded scope, topic identity, syllabus version, and source metadata.
- `excludedScope` is now persisted on `CscaExamTopic` rather than only living in the uploaded JSON payload. Import apply writes `excluded_scope`, automatic blueprint creation copies the current topic scope into blueprint constraints, prompt building prefers the topic-level `excludedScope`, generation request hashes include it, and generation job metadata records the resolved `syllabusScope`. This makes "uploaded syllabus exclusions -> AI prompt/reviewer boundary" an operational data path instead of a theoretical validation rule.
- Syllabus apply now governs blueprints as well as questions. Affected non-archived blueprints receive a refreshed `constraints.syllabusScope`, top-level `constraints.excludedScope`, and `constraints.syllabusGovernance` audit metadata with the import id and current topic status. If an affected topic is moved out of `published`, active blueprints are paused so they cannot continue producing questions for an unpublished syllabus area. Direct blueprint generation also rejects unpublished topics, which closes the bypass where an operator could call generation by blueprint id after a topic left the active syllabus.
- The admin AI questioning page now surfaces blueprint syllabus governance directly in the blueprint queue and topic detail panel. Operators can see whether a blueprint has been synced to the current syllabus, whether it needs review, how many excluded-scope rules are attached, and when generation is blocked because the topic is no longer published. The generate and force-generate actions are disabled for unpublished-topic blueprints, matching the backend guard.
- Operators can now explicitly confirm blueprint syllabus synchronization from the blueprint queue. The confirmation endpoint reloads the current topic scope into `constraints.syllabusScope`, refreshes `constraints.excludedScope`, records a `syllabusGovernance` decision with the operator note, writes an admin audit event, and pauses active blueprints if the topic is no longer published. This gives the queue a real resolution action instead of only a status label.
- Operators can now edit reviewed blueprint constraints directly from the blueprint queue. The editable fields are intentionally bounded: `difficulty`, `questionType`, `skill`, operator-facing generation instruction, target skill tags, and excluded scope. The backend validates difficulty and question type against the current topic syllabus constraints when present, writes `constraints.blueprintGovernance`, changes the generation request hash through updated constraints, and records an `update_constraints` admin audit event. This means a reviewed blueprint correction becomes visible, traceable, and effective for the next generated candidate without requiring database edits.
- Candidate review now exposes generation provenance, not only question content. The review evidence panel shows the source blueprint id, provider/model/status, fallback state, request hash, syllabus topic/version/question-type/difficulty range, exam scope, excluded scope, and reviewed blueprint instruction/target skills when available. This lets reviewers answer "did this candidate actually follow the current blueprint and syllabus?" before approving it into the practice pool.
- Reviewer issues are now translated into operator-readable guidance in the candidate evidence panel. The raw `code` and reviewer `message` remain visible for auditability, but common structural, syllabus, explanation, distractor-metadata, duplication, leakage, and deterministic sanity-check failures also show a plain-language meaning and a suggested next action such as "fix manually", "adjust blueprint difficulty", "confirm syllabus applicability", "regenerate", or "block publishing". This makes review decisions operational instead of requiring operators to memorize internal validator codes.
- Candidate rows now derive a primary review recommendation from reviewer issues, candidate status, and generation provenance. Recommendations are intentionally advisory and do not bypass the approval gate. They distinguish `manual_fix`, `blueprint`, `syllabus`, `regenerate`, `review`, `publish`, and `monitor` paths so reviewers can triage the queue without reading every raw issue first.
- The candidate review queue can now be filtered by those recommended next actions on top of the existing source/status filters. Operators can focus on "needs manual fix", "fix blueprint", "syllabus first", "regenerate", "human review", "ready to publish", or "monitor" slices, and CSV/JSON exports include the combined filter label so a handoff report preserves exactly which work bucket was exported.
- Active candidate filters are now shown as readable chips with a clear action. If a queue has candidates but the current source/status plus recommendation filter combination matches none, the empty state says the queue is filtered rather than claiming there are no candidates. This prevents operators from mistaking a narrow work-slice view for an empty production queue.
- Reviewer and deterministic validator now use the same structured scope and can flag missing exam scope, excluded-scope overlap, disallowed question type, difficulty mismatch, and weak syllabus alignment.
- The remaining weakness is operational depth: import recovery now supports rebuilding a fresh draft from a saved import and re-previewing impact against the current bank, but destructive one-click rollback is intentionally not a first-class workflow yet because created topics, code migrations, missing-topic status changes, and question review states need an explicit reverse-operation model.

## Product decisions

### 1. Organization membership should support mature onboarding

Manual member binding should remain as a fallback, not the main workflow.

Required onboarding modes:

- Manual add by existing user id or email.
- Email invitation.
- Bulk CSV or Excel import.
- Invite link or invite code.
- Optional email-domain auto-join or approval queue.
- Cohort/class grouping inside an organization.

Recommended first scope:

1. Email invitation.
2. Bulk CSV import.
3. Cohort grouping.

Email-domain auto-join and SSO can be later phases.

### 2. Organization operations is an operations domain, but separate from ordinary user ops

The platform needs two operation scopes:

- User operations:
  ordinary users, orders, personal AI credits, personal practice history, account state.
- Organization operations:
  organizations, members, cohorts, organization roles, AI pool, BYOK provider, organization usage, teacher/coach views, audit logs.

This should be reflected in backend permission checks and frontend information architecture.

### 3. Syllabus should be uploaded as structured JSON

The platform should accept a structured syllabus JSON file in admin, validate it, preview changes, then apply.

The JSON should become the authoritative source for:

- topics
- modules
- version
- source metadata
- exam scope
- allowed question types
- difficulty ranges
- topic weights
- skills
- exclusions
- optional tags and aliases

AI generation should not rely on a vague "符合 CSCA" instruction. It should receive the exact topic scope, constraints, and exclusions from the structured syllabus.

## Data model changes

### Organization onboarding

Add:

```prisma
model OrganizationInvite {
  id             Int      @id @default(autoincrement())
  organizationId Int     @map("organization_id")
  email          String? @db.VarChar(320)
  role           String  @default("student") @db.VarChar(60)
  cohortId       Int?    @map("cohort_id")
  tokenHash      String  @unique @map("token_hash") @db.VarChar(128)
  status         String  @default("pending") @db.VarChar(40)
  maxUses        Int     @default(1) @map("max_uses")
  usedCount      Int     @default(0) @map("used_count")
  expiresAt      DateTime @map("expires_at")
  acceptedBy     Int?    @map("accepted_by")
  acceptedAt     DateTime? @map("accepted_at")
  createdBy      Int?    @map("created_by")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, status], map: "idx_organization_invites_org_status")
  @@index([email, status], map: "idx_organization_invites_email_status")
  @@map("organization_invites")
}
```

Add:

```prisma
model OrganizationCohort {
  id             Int      @id @default(autoincrement())
  organizationId Int     @map("organization_id")
  slug           String  @db.VarChar(120)
  name           String  @db.VarChar(200)
  status         String  @default("active") @db.VarChar(40)
  startsAt       DateTime? @map("starts_at")
  endsAt         DateTime? @map("ends_at")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, slug], map: "uq_organization_cohorts_org_slug")
  @@index([organizationId, status], map: "idx_organization_cohorts_org_status")
  @@map("organization_cohorts")
}
```

Extend `OrganizationMember`:

```prisma
cohortId     Int?      @map("cohort_id")
invitedBy    Int?      @map("invited_by")
joinedAt     DateTime? @map("joined_at")
expiresAt    DateTime? @map("expires_at")
metadata     Json?
```

### Organization permission model

Use explicit role strings first:

- `owner`
- `admin`
- `teacher`
- `coach`
- `student`
- `viewer`

Permission matrix:

| Capability | owner | admin | teacher/coach | viewer | student |
| --- | --- | --- | --- | --- | --- |
| Manage billing/pool | yes | optional | no | no | no |
| Manage BYOK provider | yes | no by default | no | no | no |
| Invite/remove members | yes | yes | no | no | no |
| Manage cohorts | yes | yes | optional | no | no |
| View cohort learning reports | yes | yes | yes | yes | own only |
| Assign practice | yes | yes | yes | no | no |
| Use AI pool | yes | yes | yes | no | yes |

Platform `User.role = admin` remains the global operations role. Organization roles are scoped to one organization and must not grant platform admin rights.

### Syllabus import

The current `CscaExamTopic` can support the first implementation. Optional later model:

```prisma
model CscaSyllabusImport {
  id              Int      @id @default(autoincrement())
  subject         String   @db.VarChar(40)
  syllabusVersion String   @map("syllabus_version") @db.VarChar(60)
  sourceLabel     String?  @map("source_label") @db.VarChar(200)
  sourceUrl       String?  @map("source_url") @db.Text
  status          String   @default("draft") @db.VarChar(40)
  rawJson         Json     @map("raw_json")
  previewSummary  Json?    @map("preview_summary")
  appliedAt       DateTime? @map("applied_at")
  appliedBy       Int?     @map("applied_by")
  createdBy       Int?     @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([subject, syllabusVersion, status], map: "idx_csca_syllabus_import_subject_version_status")
  @@map("csca_syllabus_imports")
}
```

This import table is recommended because it preserves the uploaded source, preview summary, and audit trail.

## Syllabus JSON schema v1

Required top-level shape:

```json
{
  "schemaVersion": "csca-syllabus-v1",
  "subject": "math",
  "syllabusVersion": "2026-v1",
  "sourceLabel": "Official CSCA Math Syllabus 2026",
  "sourceUrl": "https://example.edu/csca/math-2026",
  "verifiedAt": "2026-06-11T00:00:00.000Z",
  "topics": [
    {
      "code": "M-ALG-001",
      "title": "Linear equations",
      "module": "Algebra",
      "examScope": "Solve one-variable linear equations and interpret simple word problems.",
      "allowedQuestionTypes": ["mcq"],
      "difficultyRange": ["basic", "medium"],
      "weight": 3,
      "skills": ["solve", "interpret", "check"],
      "aliases": ["one-variable equations"],
      "excludedScope": ["quadratic equations", "systems of equations"],
      "status": "published"
    }
  ]
}
```

Validation rules:

- `schemaVersion` must equal `csca-syllabus-v1`.
- `subject` must be one of `math`, `physics`, `chemistry`.
- `syllabusVersion` is required and immutable after apply.
- `topics[].code` must be unique within subject and version.
- `topics[].title` and `examScope` are required.
- `allowedQuestionTypes` must be a non-empty subset of supported question types.
- `difficultyRange` must contain known difficulty labels.
- `weight` must be a positive number, defaulting to 1 if omitted.
- `excludedScope`, `skills`, and `aliases` are optional arrays of strings.

Mapping to `CscaExamTopic`:

| JSON field | Database field |
| --- | --- |
| `subject` | `subject` |
| `topics[].code` | `code` |
| `topics[].title` | `title` |
| `topics[].module` | `module` |
| `topics[].examScope` | `examScope` |
| `topics[].allowedQuestionTypes` | `allowedQuestionTypes` |
| `topics[].difficultyRange` | `difficultyRange` |
| `topics[].weight` | `weight` |
| `syllabusVersion` | `syllabusVersion` |
| `sourceUrl` | `sourceUrl` |
| `sourceLabel` | `sourceLabel` |
| `verifiedAt` | `lastVerifiedAt` |
| current admin user | `verifiedBy` |
| `topics[].status` | `status` |

Store `skills`, `aliases`, and `excludedScope` in `examScope` extensions only if no dedicated fields exist yet. Preferred implementation is to add JSON metadata or structured columns later.

## Backend implementation plan

### PR 1: Organization invitation and cohort foundation

Files:

- `backend/prisma/schema.prisma`
- new migration
- `backend/src/csca-special-practice/ai-entitlement.service.ts`
- `backend/src/csca-special-practice/csca-special-practice.controller.ts`
- `frontend/src/lib/api-admin.ts`
- `frontend/src/lib/api-types.ts`
- `frontend/src/pages/AdminAuditPage.tsx` or a new organization admin page

Backend endpoints:

- `GET /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/cohorts`
- `POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/cohorts`
- `POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites`
- `POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites/bulk-preview`
- `POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites/bulk-apply`
- `POST /api/v1/organizations/invites/:token/accept`

Bulk CSV columns:

- `email`
- `role`
- `cohortSlug`
- `cohortName`
- `expiresAt`

Rules:

- Bulk preview must not write data.
- Bulk apply must be idempotent for the same organization/email/cohort.
- Invite tokens must be stored hashed.
- Accepting an invite must require login or complete registration.
- Accepted invite creates or updates `OrganizationMember`.
- All admin mutations must write `admin_audit_logs`.

Acceptance:

- Admin can create a cohort.
- Admin can invite one email.
- Admin can preview and apply a CSV of members.
- A logged-in user can accept an invite and become an active organization member.
- Existing manual `userId` binding still works.

### PR 2: Organization governance as its own admin workflow

Files:

- Prefer new frontend page: `frontend/src/pages/AdminOrganizationsPage.tsx`
- Or split Admin Audit organization section into route-level tabs.

Backend additions:

- Organization role permission helper.
- Organization-scoped report endpoints:
  - members
  - cohorts
  - AI usage by day
  - AI usage by member
  - pool balance and reservation pressure
  - BYOK provider health

Frontend sections:

- Organizations list.
- Organization detail.
- Members.
- Cohorts.
- Invites/imports.
- AI pool and BYOK.
- Usage and audit.

Acceptance:

- Platform admin can manage all organizations.
- Organization owner/admin can manage only their own organization if organization self-service is enabled.
- Teacher/coach can view assigned cohorts but cannot change billing or provider config.
- User operations page remains focused on individual users and does not become the organization control center.

Progress on 2026-06-12:

- Added `backend/src/csca-special-practice/organization-permissions.ts`.
- Standard organization roles are now `owner/admin/teacher/coach/viewer/student`.
- Legacy `manager` input is normalized to `admin`, so older imports or existing rows stay compatible while new UI writes use `admin`.
- The permission matrix is executable through `organizationRoleAllows` and covered by `npm run organization-permissions:rules`.
- `AIEntitlementService` member/import/invite role cleaning now uses the shared normalizer.
- `AIEntitlementService.reserve` and `AICoachProviderService.organizationRuntimeConfig` now use the same matrix before selecting an organization AI pool or BYOK provider, so `viewer` cannot consume organization credits or route through organization BYOK while `student/teacher/coach/admin/owner` can.
- `/admin/organizations` no longer offers `manager` as a new role; it maps legacy `manager` display to `admin` in the selector.
- `npm run verify:governance` includes the permission matrix check, BYOK provider routing role check, and the organization DB smoke now asserts `manager -> admin` during member-import preview, `viewer` not reserving from the organization AI pool, and `student` reserving from the organization AI pool.
- `/admin/audit` now has fixed operation templates for syllabus changes, organization invites, organization members, and bank readiness. They preserve the current organization and result limit, apply the correct event scope, sync to URL filters, and are covered by `npm --prefix frontend run test:admin-audit-summaries`.

### PR 3: Syllabus JSON import preview/apply

Files:

- `backend/prisma/schema.prisma`
- new migration for `CscaSyllabusImport`
- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/ai-questioning.controller.ts`
- `frontend/src/lib/api-admin.ts`
- `frontend/src/lib/api-types.ts`
- Admin UI section or new syllabus governance page
- `scripts/csca-ai-questioning-rules-test.cjs`
- `scripts/csca-ai-questioning-smoke.cjs`

Backend endpoints:

- `POST /api/v1/admin/ai-questioning/syllabus-imports/preview`
- `POST /api/v1/admin/ai-questioning/syllabus-imports`
- `GET /api/v1/admin/ai-questioning/syllabus-imports`
- `GET /api/v1/admin/ai-questioning/syllabus-imports/:id`
- `POST /api/v1/admin/ai-questioning/syllabus-imports/:id/apply`
- `POST /api/v1/admin/ai-questioning/syllabus-imports/:id/archive`

Preview output:

```json
{
  "summary": {
    "subject": "math",
    "syllabusVersion": "2026-v1",
    "topicsInFile": 40,
    "newTopics": 8,
    "updatedTopics": 20,
    "unchangedTopics": 10,
    "missingFromFile": 2,
    "questionsAffected": 156,
    "approvedQuestionsBecomingPendingReview": 24
  },
  "items": [
    {
      "code": "M-ALG-001",
      "action": "update",
      "before": { "title": "Linear equations" },
      "after": { "title": "Linear equations", "examScope": "..." },
      "affectedQuestionCount": 12
    }
  ],
  "errors": []
}
```

Apply behavior:

- Upsert topics by `subject + code`.
- Set topic version/source/verification fields.
- Mark omitted old topics as `draft` or leave unchanged depending on import option:
  - `missingTopicAction = keep | draft | archive`.
- Move approved questions that no longer match current topic syllabus version/status to `pending_review`.
- Store import raw JSON and preview summary.
- Write admin audit event.

Acceptance:

- Invalid JSON fails with actionable errors.
- Preview does not write database rows.
- Apply updates topic scope/version/source metadata.
- Old approved questions become ineligible for adaptive selection.
- Smoke verifies stale filtering after import apply.

Progress on 2026-06-11:

- Added real backend preview endpoint:
  - `POST /api/v1/admin/ai-questioning/syllabus-imports/preview`
- Added `validateCscaSyllabusImportPayload`, which enforces `csca-syllabus-v1`, subject, version, non-empty topic list, unique topic codes, required `examScope`, allowed question types, difficulty range, positive weight, valid status, and HTTP/HTTPS source URL.
- Preview now reads current `csca_exam_topics` and `csca_questions` and returns:
  - topics to create, update, or leave unchanged;
  - current-version topics missing from the uploaded file;
  - affected active question count;
  - approved questions that would become pending review if applied.
- Added frontend API type and client function:
  - `AdminAIQuestioningSyllabusJsonImportPreview`
  - `previewAdminAIQuestioningSyllabusJsonImport`
- Added rules-test coverage for syllabus JSON validation.
- Verification passed:
  - `npm run verify:csca-ai-questioning`
  - `npm run backend:build`
  - `npm --prefix frontend run build`
- Note: `backend:build` reported the known local Windows Prisma query-engine DLL lock during `prisma:generate`, then continued with the existing generated client and completed Nest build successfully. Stop the running backend before a schema-changing Prisma generate.

Remaining for PR 3:

- Add Admin UI upload/preview/apply panel.
- Consider a rollback/re-apply workflow after real operations data.

Additional progress on 2026-06-11:

- Added persistent import model and migration:
  - `CscaSyllabusImport`
  - `backend/prisma/migrations/0048_csca_syllabus_imports/migration.sql`
- Added admin endpoints:
  - `GET /api/v1/admin/ai-questioning/syllabus-imports`
  - `POST /api/v1/admin/ai-questioning/syllabus-imports`
  - `GET /api/v1/admin/ai-questioning/syllabus-imports/:id`
  - `POST /api/v1/admin/ai-questioning/syllabus-imports/:id/apply`
  - `POST /api/v1/admin/ai-questioning/syllabus-imports/:id/archive`
- Saved imports persist the normalized JSON and preview summary before application.
- Applying an import now upserts topics by `code`, updates structured syllabus fields, creates new topics, records verifier metadata, and marks stale approved questions as `pending_review`.
- The stale-question refresh scope is limited to topics touched by the import, plus missing topics explicitly changed by `missingTopicAction`; it does not sweep the entire subject by default.
- Added frontend API types and client functions for list/create/detail/apply/archive.
- Extended DB-backed smoke to verify:
  - JSON preview detects updated and new topics;
  - draft import is saved and list/detail can retrieve it;
  - apply updates an existing topic and creates a new topic;
  - apply records verifier/source metadata;
  - stale approved unified questions return to `pending_review`;
  - stale questions record the import id in governance metadata.
- Verification passed:
  - `npm run verify:csca-ai-questioning`
  - `npm run backend:build`
  - `npm --prefix frontend run build`
  - `npm run prisma:validate`
Additional progress on 2026-06-11:

- Added a working Admin UI panel in `frontend/src/pages/AdminAuditPage.tsx` for syllabus JSON governance.
- The panel supports:
  - paste structured syllabus JSON;
  - preview the database impact before writing;
  - save a draft import with raw JSON and preview summary;
  - view recent imports for the selected subject;
  - apply a selected draft import;
  - archive a selected draft import;
  - choose how to handle current-version topics missing from the uploaded JSON: keep, draft, or archive.
- The UI calls the real admin endpoints instead of using mock state.
- Frontend build verification passed:
  - `npm --prefix frontend run build`

Current limitation:

- The first UI implementation accepts pasted JSON. A file picker can be added on top without changing the backend contract because the backend already receives normalized JSON.

Additional progress on 2026-06-11:

- Added a dedicated frontend route:
  - `/admin/csca-syllabus`
- Added the page component:
  - `frontend/src/pages/AdminCscaSyllabusPage.tsx`
- Added the route to:
  - `frontend/src/lib/routes.ts`
  - `frontend/src/lib/app-navigation.ts`
  - `frontend/src/components/AppRouteRenderer.tsx`
- Added "CSCA 大纲 / CSCA Syllabus" to the admin module navigation.
- The dedicated page supports:
  - subject filter;
  - governance summary metrics;
  - refresh governance status;
  - paste syllabus JSON;
  - choose a local `.json` file and load it into the review form;
  - preview impact;
  - save draft import;
  - select a draft from import history;
  - apply draft with `missingTopicAction`;
  - archive draft;
  - inspect current governance risks;
  - review pending AI-generated questions from the same page;
  - approve, reject, or archive pending-review questions.
- Verification passed:
  - `npm --prefix frontend run build`

Additional progress on 2026-06-11:

- Added a file picker to `/admin/csca-syllabus`.
- Selecting a `.json` file reads it locally into the JSON editor.
- The page validates that the file is JSON before filling the editor.
- The file picker does not apply or save automatically; the admin must still preview, save draft, and apply.
- Verification passed:
  - `npm --prefix frontend run build`

Additional progress on 2026-06-11:

- Added an affected-question review section to `/admin/csca-syllabus`.
- The section loads current `pending_review` AI-questioning candidates for the selected subject.
- Admins can inspect prompt/options/answer/explanation without leaving the syllabus page.
- Admins can approve, reject, or archive a pending-review question from the syllabus workflow.
- This uses existing admin question governance endpoints:
  - `GET /api/v1/admin/ai-questioning/questions?status=pending_review`
  - approve/reject/archive question endpoints
- Verification passed:
  - `npm --prefix frontend run build`

Current limitation:

- The page now supports focused affected-question review actions. Regenerate-from-this-page is still not wired; currently regeneration remains available in the AI questioning/admin audit workflow.

### PR 4: Make AI generation use structured syllabus scope

Files:

- `backend/src/ai-questioning/question-prompt-builder.service.ts`
- `backend/src/ai-questioning/question-generator.service.ts`
- `backend/src/ai-questioning/question-generator-provider.service.ts`
- `backend/src/ai-questioning/question-reviewer.service.ts`
- `backend/src/ai-questioning/question-reviewer-provider.service.ts`
- `backend/src/ai-questioning/question-validator.service.ts`
- tests and smoke scripts

Blueprint type should include:

```ts
examScope: string | null;
allowedQuestionTypes?: string[] | null;
difficultyRange?: string[] | null;
syllabusSkills?: string[];
excludedScope?: string[];
topicCode?: string;
topicModule?: string | null;
sourceLabel?: string | null;
sourceUrl?: string | null;
```

Generator prompt should include:

- exact `examScope`
- allowed question types
- difficulty range
- target skill
- excluded scope
- version/source metadata
- instruction that the candidate must not test outside `examScope`

Reviewer context should include the same fields.

Deterministic validator should add:

- `question_type_out_of_scope`
- `difficulty_out_of_scope`
- `weak_syllabus_signal`
- `excluded_scope_overlap`
- `missing_exam_scope`

LLM reviewer prompt should explicitly ask:

- Does the question test the supplied exam scope?
- Does it avoid excluded scope?
- Does explanation stay within the scope?
- Is the difficulty compatible with the difficulty range?

Acceptance:

- Generated candidate metadata records the syllabus scope snapshot used at generation time.
- A candidate outside `allowedQuestionTypes` fails.
- A candidate mentioning excluded scope fails or needs review.
- A candidate with no visible alignment to `examScope` needs review.
- Existing generation smoke still passes.

Progress on 2026-06-11:

- Generator prompt now includes a structured `syllabusScope` object with topic id/code/module/title, syllabus version, exam scope, allowed question types, difficulty range, excluded scope from blueprint constraints, and source metadata.
- Generator system instructions now treat `syllabusScope` as the hard content boundary.
- Request hash now includes syllabus scope, so a scope/version/source change cannot accidentally reuse an old generated candidate.
- Queued generation now recomputes the canonical hash at processing time from the full topic/blueprint row, which keeps older or partially populated queued jobs compatible with the current hash contract.
- AI question `generation_metadata` now records the syllabus scope snapshot used for generation.
- LLM reviewer prompt now receives the same `syllabusScope` and explicitly checks:
  - outside `examScope`;
  - overlap with `excludedScope`;
  - disallowed question type;
  - difficulty outside range;
  - explanation drifting beyond the supplied scope.
- Deterministic validator now reports:
  - `missing_exam_scope`;
  - `excluded_scope_overlap`;
  - existing `question_type_out_of_scope`, `difficulty_out_of_scope`, and `weak_syllabus_signal`.
- Rule tests now cover prompt scope, scope-sensitive request hash, and excluded-scope rejection.
- Verification passed:
  - `npm run verify:csca-ai-questioning`
  - `npm --prefix backend exec tsc -- -p backend\tsconfig.json --pretty false --noEmit`

Operational note:

- `npm run backend:build` returned success, but local Prisma generate still hit the known Windows query-engine DLL file lock and continued with the existing generated client. Stop the running backend before a clean Prisma generate when schema changes need to be regenerated.

## Frontend implementation plan

### Admin organization page

Recommended route:

- `/admin/organizations`

Main panels:

- Organization profile.
- Members.
- Cohorts.
- Invites.
- Bulk import.
- AI pool.
- BYOK provider.
- Usage.
- Audit log.

UX principle:

- Platform admin language: "机构", "成员", "班级/批次", "额度池", "模型配置", "使用情况".
- Avoid implementation terms like `provider config`, `ledger`, `token hash` in the visible UI.

### Admin syllabus page

Recommended route:

- `/admin/csca-syllabus`

Main panels:

- Current syllabus by subject.
- Upload JSON.
- Preview changes.
- Apply version.
- Affected questions.
- Old syllabus review queue.
- Import history.

UX principle:

- Admin should understand "上传大纲 -> 预览影响 -> 确认应用 -> 旧题进入复核".
- Do not expose raw JSON errors without human-readable messages.

## Testing plan

### Unit/rule tests

Add to `scripts/csca-ai-questioning-rules-test.cjs`:

- syllabus JSON schema valid/invalid cases.
- preview diff rules.
- missing topic behavior.
- prompt builder includes `examScope`.
- validator rejects excluded-scope overlap.
- validator rejects disallowed question type.

Add organization rule tests:

- invite token hashing.
- bulk CSV preview idempotency.
- organization role permission matrix.
- owner/admin/teacher/student capability checks.

### DB-backed smoke

Extend `scripts/csca-ai-questioning-smoke.cjs`:

- create syllabus import preview.
- apply import.
- verify topic fields.
- verify stale question moves out of adaptive eligibility.
- verify new generation job records syllabus scope snapshot.

Add or extend organization smoke:

- create organization.
- create cohort.
- invite member.
- accept invite.
- reserve AI credit through organization pool.
- verify org usage metadata.

Current executable governance gate:

```bash
npm run verify:governance
```

This gate is the default verification command for this document's organization and syllabus-import work. It first runs `governance-gates:rules` to ensure the gate still contains the required governance/security sub-checks, then builds backend and frontend, runs the organization permission matrix, organization governance DB smoke, organization-filtered admin audit smoke, organization invite export checks, organization governance digest checks, admin-audit summary/template checks, and syllabus import export checks. Use the individual scripts only when narrowing a failure.

Progress on 2026-06-12:

- Syllabus import JSON reports now preserve the `apply` block when an applied preview/import is exported.
- `frontend/scripts/check-syllabus-import-export.mjs` covers persisted migration rows in the applied JSON report, so offline review files keep the old-code/new-code audit trail after apply.
- `npm run governance-gates:rules` now checks the `verify:governance`, `verify:security`, `verify:local`, and runbook manifest so critical checks such as organization permissions, admin-audit templates, organization smoke, and syllabus import exports are not silently removed from daily verification.
- `/admin/csca-syllabus` already has JSON file picker upload, template download, preview/save/apply/archive, code-migration confirmation, selected import investigation details, and affected pending-review question actions. `frontend/scripts/check-syllabus-import-export.mjs` now asserts those page-level affordances in addition to CSV/JSON report helpers.
- The affected-question review queue on `/admin/csca-syllabus` now has topic-id, syllabus-status, and source-type filters, so operators can narrow a specific knowledge point, distinguish current-syllabus editorial review from stale/unpublished syllabus drift, and then focus imported/AI/legacy bridge questions before approving, rejecting, or archiving. The same frontend script asserts these filters and the API parameter wiring.
- Saved syllabus imports now have an audited `recovery-draft` flow. Backend `POST /api/v1/admin/ai-questioning/syllabus-imports/:id/recovery-draft` copies the original JSON into a new draft, recalculates the preview against the current topic/question state, and records `preview_summary.recovery.sourceImportId/sourceImportStatus`. `/admin/csca-syllabus` exposes this as "Rebuild draft", then selects the new draft so an operator must review the refreshed impact before applying. This is the supported re-apply path; it is not presented as an automatic rollback.
- Selected recovery drafts on `/admin/csca-syllabus` now show their source import and source status in the investigation panel, and exported JSON reports preserve the `recovery` block for offline review.
- `/admin/audit` now summarizes `syllabus-import.recovery_draft` events with the source import, new draft id, refreshed new/updated topic counts, affected questions, approved-to-review count, and a reminder to review the refreshed impact before applying. `npm --prefix frontend run test:admin-audit-summaries` covers this summary and CSV export.
- `scripts/csca-ai-questioning-smoke.cjs` now exercises the recovery-draft endpoint through the controller against a real database, verifies the new draft import, source recovery metadata, refreshed preview, and `adminAuditLog` writeback, then cleans up the temporary import rows.
- Applied syllabus imports now have an audited dry-run reverse plan. Backend `POST /api/v1/admin/ai-questioning/syllabus-imports/:id/reverse-plan` reads the persisted preview/apply evidence and current topic/question state, then returns a non-mutating plan with topic restore operations, created-topic archive suggestions, code-migration reversal suggestions, missing-topic status restores, drift blockers, and the count of questions tagged by this import's governance metadata.
- The reverse plan deliberately keeps question status restoration as manual review. It does not auto-approve questions that were moved to `pending_review`, because those questions may already have been re-reviewed, edited, or replaced after the import.
- `/admin/csca-syllabus` exposes this as "Reverse plan" only on applied imports. The selected import detail renders the dry-run summary, blockers, auto-plannable operations, manual review load, and a short operator warning. `/admin/audit` summarizes `syllabus-import.reverse_plan` with a compact payload only; full operation snapshots are not stored in audit logs.
- `scripts/csca-ai-questioning-smoke.cjs` now exercises reverse-plan through the controller against a real database and verifies dry-run mode, migration operations, question-review count, manual-review recommendation, actor audit, and compact audit payload. `npm --prefix frontend run test:syllabus-imports` and `npm --prefix frontend run test:admin-audit-summaries` cover the page entry and audit summary.
- Added `npm run csca-syllabus:recovery-drill`. The command runs the DB-backed AI-questioning smoke as a focused syllabus recovery drill and writes sanitized evidence to `RELEASE_EVIDENCE_DIR` or `.tmp/release-evidence/`. The evidence records pass/fail status, covered recovery controls, dry-run safety boundaries, and output tails for incident review.
- `docs/ops-runbook.md` now documents the drill, including when to run it, how to review the generated evidence, and the current non-destructive recovery boundary.

## Release and migration plan

1. Add schema and backend endpoints behind admin-only access.
2. Add preview-only UI first. Completed in the first admin panel version.
3. Enable apply action only after smoke passes. Completed for admin-only use after `verify:csca-ai-questioning` and frontend/backend builds passed.
4. Keep existing manual organization member binding only as an advanced recovery path.
5. Keep existing topic-level syllabus update forms until JSON import is stable.
6. After two successful imports, move topic-level manual update into an advanced/admin escape hatch.
7. After organization invites are stable, hide numeric `userId` binding behind an advanced mode. Completed for `/admin/organizations`: the default CSV workflow is now email invite import, and `userId` is described only under advanced recovery fields.

## Updated status against the original gap list

This plan does not replace the existing AI-questioning closure work. It adds the missing operational layer:

- Organization foundation, onboarding, invite flow, permission matrix, and governance audit are operationally usable, with further polish still possible.
- Syllabus fields and JSON upload/import are operationally usable, including file picker, preview/apply, migration evidence, and affected-question review actions.
- AI generation, reviewer, and validator now use full structured syllabus scope. Saved import investigation and re-apply via recovery draft are operational. The next risk is explicit rollback planning for destructive reverse operations.

## Recommended next PR order

1. PR S6: Optional destructive rollback executor, only after dry-run plans have been proven in drills and a per-operation confirmation model exists.
2. PR Q1/Q2: Continue making AI question production governance operator-friendly, with candidate-review batching, quality-dashboard shortcuts, and calibration summaries.
3. PR S7: Add destructive rollback execution only after the non-destructive recovery and review workload are stable in daily use.

Progress on Q1:

- `/admin/csca-syllabus` affected-question review queue now supports selected-row batching for `review`, `reject`, and `archive`.
- Bulk actions deliberately do not include `approve`; publishing a candidate into the practice bank still requires explicit per-question approval.
- The queue shows a boundary note so operators understand that batch handling is for triage and cleanup, not bulk publishing.
- `npm --prefix frontend run test:syllabus-imports` locks the bulk review/reject/archive entry points and the no-bulk-approve invariant.
- `/admin/audit` quality feedback detail list now supports selecting visible quality metrics and applying selected bulk actions: send to review, resolve, reduce exposure, archive, and regenerate.
- Quality regeneration remains review-gated: it creates replacement candidates that must still pass human approval before publishing.
- `npm --prefix frontend run test:admin-audit-summaries` locks the selected-quality bulk entry points and the review-gated regeneration copy.

Progress on Q2:

- `/admin/audit` now includes a quality calibration summary for the current quality list: total items, difficulty drift, distractor issues, regenerate recommendations, and low-confidence empirical difficulty.
- Operators can jump directly to high-risk items or regenerate recommendations, and can select visible difficulty-drift samples for batch handling.
- The summary is derived from existing `AdminAIQuestioningQualityMetric` fields: `designedDifficulty`, `empiricalDifficulty`, `difficultyConfidence`, `qualitySummary`, `optionSelectionStats`, and problem-option evidence.
- The quality calibration summary can now be exported as CSV or JSON from `/admin/audit`, so operators can hand off the current quality queue with question ids, drift evidence, option-level problem signals, recommended actions, assignment status, and governance disposition.
- Exported quality reports include the operator action target `admin-ai-questioning-quality-governance`, and the page now shows active quality filters as chips with a clear-filter action before batch handling or export.
- The quality queue now has operator action groups for direct handling, manual fix, regenerate candidates, archive cleanup, and monitoring. Each group is derived from the current list's `qualitySummary.recommendedAction` and jumps into the matching quality filter.
- Manual-fix and regeneration flows now show explicit follow-up boundaries in `/admin/audit`: manual-fix items remain pending review until edited and resolved; regeneration creates replacement candidates and does not replace the live question until the candidate is reviewed and published.
- Replacement follow-up is now visible at queue level: `/admin/audit` shows regenerate items that still need candidates, drafted-but-unpublished replacement candidates, and replacements that have been published. Quality exports also include `replacementQuestionId` and `replacementPublishedQuestionId`.
- Replacement candidates are now visible in the candidate-review queue with their low-quality source question id (`generatedVariantOf`) and an explicit review gate. The drafted-unpublished shortcut also jumps operators to the AI candidate review section, so the regenerate path is operational rather than hidden in background state.
- The candidate-review area now behaves like a triage queue rather than a raw recent list: operators can filter all candidates, replacement candidates, pending review, review-failed, approved, and draft candidates, and the drafted-replacement shortcut opens the replacement queue directly.
- Candidate triage now supports explicit visible-selection and bulk review, approve, reject, and archive actions. The page sends selected question ids to the existing bulk endpoint, so operators can clear the current queue slice without relying on broad subject/status filters.
- Candidate bulk actions now report operationally useful results in place: requested, succeeded, failed, and up to three failed question reasons are shown beside the candidate queue controls, so operators can immediately decide whether to retry, inspect, or archive the remaining items.
- Candidate queues can now be exported as CSV or JSON from `/admin/audit` using the current candidate filter. The export includes candidate ids, source/status, replacement source question, designed/empirical difficulty, syllabus version, review status, review issue codes, metadata snapshots, and the operator action target `admin-ai-questioning-candidates`.
- Review-failed candidates now have a manual-fix path in `/admin/audit`: operators can edit prompt, options, correct answer, explanation, knowledge tags, and option-level misconception metadata, then save and rerun review. The backend only allows this for `draft`, `pending_review`, and `review_failed` candidates, records `lastManualEdit` and `manualEditGate`, and returns to `pending_review` or `review_failed`; publishing still requires the separate approve-and-publish gate.
- Quality manual-fix actions now open a dedicated candidate filter. When an operator marks a quality item as `manual_fix`, `/admin/audit` switches to the candidate review section with the `manual_fix` filter, so the operator can immediately use the candidate edit-and-review form instead of hunting through the pending-review queue.
- Quality regenerate actions now open the replacement-candidate queue after creating candidates. This applies to single-row regenerate, selected-row bulk regenerate, quality action-group regenerate, and the drafted-replacement summary shortcut, so the operator's next visible step is candidate review rather than a hidden background state.
- Candidate single-action feedback now explains the operational outcome, not only that a request finished: normal approval says the candidate entered the practice pool; replacement approval says the low-quality source question was archived and quality review was resolved; reject/archive actions say the candidate will not enter the practice pool.
- Candidate bulk-action feedback now reads the returned candidate rows and summarizes actual outcomes: published practice items, replacement publishes, rejected candidates, archived candidates, and failed item reasons. This keeps selected-row bulk approval useful without hiding whether replacement governance actually closed.
- The published-replacement summary shortcut now returns operators to the quality-governance section with regenerate follow-up rows selected, so they can confirm the replacement is resolved from the quality side as well as from the candidate side.
- Single and bulk candidate approvals now detect when a replacement candidate was actually published and automatically return operators to the quality-governance section. This makes the final confirmation step visible after the backend archives the low-quality source question, clears its quality metric, and records replacement approval metadata.
- Candidate review recommendation chips now let operators narrow the candidate queue by actual next action after applying the source/status filter. This turns the recommendation card into an executable work queue: fixable candidates, blueprint problems, syllabus blockers, regeneration candidates, publish-ready candidates, and monitoring-only candidates can be handled separately, and the current recommendation slice is preserved in candidate CSV/JSON export labels.
- Candidate queue filtering now has an explicit active-filter readout and clear action, and the empty state distinguishes "no candidates exist" from "no candidates match this work-slice filter." This keeps recommendation-filter triage usable during daily review, especially when an operator switches between replacement, manual-fix, publish-ready, and monitoring buckets.
- Quality-governance single and bulk actions now return disposition-level feedback instead of a generic completion message. Operators can see whether an item was resolved, sent back to review, assigned, archived, exposure-reduced, moved to manual fix, or regenerated into a replacement candidate; bulk feedback also summarizes failed item reasons. This keeps the quality queue operationally traceable after each action.
- Admin audit records for AI question governance now preserve the fields needed to explain candidate and quality outcomes (`sourceQuestionId`, `generatedVariantOf`, `needsReview`, `questionStatus`, and `qualityGovernance`). The audit summary layer now renders candidate publish/reject/archive/bulk actions and quality resolve/send-review/assign/disposition/bulk actions as business-readable history instead of raw technical action names.
- The same audit summary layer now covers the upstream production path: blueprint coverage ensure, blueprint single/batch generation, generation-job enqueue/process/bulk actions, pregeneration backfill, and topic-health actions. Operators can now read the audit trail as a production history from missing blueprint -> generation queue -> candidate review -> quality replacement.
- The admin audit filters now expose the AI-questioning resource types used by that production history (`generation-job`, `question`, `quality-metric`, `blueprint`, `blueprint-coverage`, `pregeneration`, and `topic`). Quick templates now include question production, candidate review, and quality governance views, so operators can find the new business-readable audit records without editing URL parameters by hand.
- Audit payload summaries now also preserve returned item status counts and generated-candidate counts. Generation queue processing can show whether it actually created pending-review candidates, while bulk candidate/quality actions can show returned status distribution instead of only requested/succeeded/failed totals.
- Returned audit status counts are rendered with operator-readable labels, so history and CSV summaries say things like pending review/published instead of leaking raw database status codes.
- Generation queue bulk results are now handled before generic filtered bulk results in the admin feedback layer. This prevents retry/process/archive generation jobs from being described as quality-governance actions, keeps subject-scoped queue processing on the bulk endpoint, and returns archive-failed actions to the generation queue follow-up.
- Quality replacement follow-up now cross-checks replacement candidate status. Rejected or archived replacement candidates are separated from reviewable unpublished candidates and routed back to regeneration, so operators do not wait on a candidate that can no longer be published.
- Quality metrics now return the current replacement-candidate status from the question bank itself, and audit summaries preserve it. A quality regeneration/replacement audit record can therefore say whether the replacement candidate is pending review, already published, or stale because it was rejected/archived, instead of showing only a candidate id.
- The admin quality replacement summary also uses this metric-level status as a fallback when the candidate queue has not been fully loaded, so archived/rejected replacement candidates are still routed back to regeneration instead of being miscounted as reviewable drafts.
- Per-row quality follow-up text now uses the same stale-candidate status, so a rejected/archived replacement candidate is not described as merely waiting for approval. The operator sees the same next action in the row, summary card, audit trail, and export.
- Top-level candidate bulk review/approve/archive shortcuts now reuse the same replacement-aware candidate wrapper as the candidate queue. Bulk approval of replacement candidates returns operators to the quality-governance follow-up instead of only showing a generic success message.
- Daily workflow candidate and quality actions now route through the same follow-up-aware wrappers as the queue panels. Candidate workflow actions return to candidate review or quality replacement follow-up, while quality workflow/group actions route regenerate results to replacement candidates and manual-fix results to the manual-fix candidate filter.
- Generation queue recovery now treats stale `running` jobs as actionable blockers, not just display-only warnings. Bulk retry, single-job retry, and scheduler-style `retryFailed` processing all select running jobs older than the stale threshold, the daily workflow retry button remains enabled for stale-running-only queues, and the database smoke verifies stale running jobs can be recovered into pending-review candidates through all three paths.
- The generation governance page now shows stale-running-only queues as their own actionable row, even when there is no failed-job category. Operators can see the stale job ids and run the same recovery action from the queue section instead of relying on the daily workflow card.
- Topic-health `review_quality` is now a real quality-governance handoff instead of a candidate-review shortcut. It selects low-quality metrics for the topic, runs the quality `send_to_review` path, writes `qualityGovernance` metadata, preserves the underlying quality action in the result, and leaves destructive decisions such as archive/regenerate to the quality governance queue.
- Syllabus governance now distinguishes syllabus-owned pending review from ordinary candidate review. Only questions with `syllabusGovernance.status = needs_review`, version mismatch, or unpublished-topic drift appear in the syllabus queue; ordinary pending AI candidates stay in the candidate queue. A dedicated "confirm current" action lets operators confirm an existing published question still fits the current syllabus, sync its `syllabusVersion`, mark `syllabusGovernance` as resolved, and return it to the approved practice pool without bypassing candidate-review publishing gates.
- Candidate re-review now preserves existing governance context instead of replacing `reviewMetadata` wholesale. Manual-fix quality decisions, syllabus governance state, and other admin context survive single or bulk review; the latest reviewer output is merged with a `reviewGate`, so replacement candidates can still be published into the correct source-question replacement flow after re-review.
- The database smoke now verifies the same stale-replacement backend invariant: after a quality replacement candidate is archived, applying `regenerate` again creates a fresh pending-review replacement candidate instead of reusing the stale one.
- Candidate archive/reject actions now synchronize the published practice-pool bridge. If an already approved AI question has a `sourceQuestionId`, archiving or rejecting it also archives the linked `special_practice_questions` row, so adaptive practice cannot keep serving a question that governance has removed from the active bank.
- Quality archive disposition now follows the same boundary. When an operator archives a low-quality question from quality governance, the unified question is archived and the linked published practice-pool row is archived as well.
- Quality reduce-exposure disposition now has a real adaptive-training effect. It does not archive the question or falsify user exposure history; instead, the adaptive question provider reads `qualityGovernance.disposition = reduce_exposure` from the unified AI question and applies a strong candidate-ordering penalty, so the question remains an emergency fallback but normal candidates for the same topic are selected first.
- Quality metrics are now aggregated at the unified `CscaQuestion` level across both practice entry points. If the same AI question is answered through the legacy `special_practice_questions` bridge and later through direct unified-bank selection (`question_source = csca_question`), refresh operations merge those attempts, option selections, empirical difficulty, confidence, and review signals instead of letting one source overwrite the other.
- Normal special-practice sessions now respect the same AI question governance boundary. `getTopicStart`, new session snapshots, and no-snapshot session fallback filter AI-backed `special_practice_questions` through the unified `csca_questions` row; a bridge question is visible only when its AI source question is still `approved`, its topic is published, and its syllabus version matches the current topic version. Legacy manually authored special-practice questions remain visible as before.
- Public special-practice counts now use the same currently-practiceable question boundary. Overview and subject pages no longer count an AI-backed published bridge question if its unified AI question is pending review, archived/rejected, stale against the syllabus, or attached to an unpublished topic. This keeps topic cards and subject totals aligned with the actual session snapshot size.
- Admin topic-bank health now separates approved inventory from practice-ready inventory. `approvedQuestionCount` remains the broad approved unified-bank total for governance visibility, while `publishedQuestionCount` and `bridgeQuestionCount` require current syllabus alignment and, for bridge rows, an actually published `special_practice_questions` row. This prevents operators from treating stale approved questions or archived bridges as learner-ready capacity.
- Auto pregeneration also uses this practice-ready capacity boundary. A topic with only stale approved questions or only stale pending candidates is treated as needing new candidates, while a topic with current pending candidates but no current practice-ready question is routed to review/publish work instead of being counted as healthy.
- AI Coach question context now respects that same boundary for `special_practice` source questions. If a published special-practice row is actually an AI-backed bridge whose unified question is pending review, archived, rejected, stale against the syllabus, or attached to an unpublished topic, hint/explanation generation is blocked instead of using governed content as prompt context.
- AI Coach round summaries now separate historical performance from reusable question content. Submitted rounds can still summarize accuracy and weak topics, but the mistake-detail payload sent to AI only includes answer/tag detail for currently approved/current questions. Governed AI-backed special-practice questions are represented without answer or tag detail, while direct unified-bank `csca_question` items are now supported when they are approved and current.
- The personal wrong-question bank and legacy `my-wrong-questions` practice endpoint are now source-aware for learner review. Direct unified-bank adaptive misses (`question_source = csca_question`) are included in the user's wrong-bank review path, while AI-backed `special_practice` bridge misses are excluded from active review if their unified source question is no longer approved/current. This keeps wrong-question review aligned with candidate governance, replacement, and archive decisions without losing direct unified-bank mistakes.
- Wrong-pattern metadata now preserves source-aware question references. Adaptive submit passes each item's `questionSource` into the learning service; `csca_wrong_patterns.metadata` keeps the legacy `recentQuestionIds` for compatibility and also records `lastQuestionSource`, `lastQuestionRef`, and `recentQuestionRefs`. This prevents direct unified-bank questions and legacy bridge questions from being conflated when later review, verification, planner, or analytics code needs to reason about the original question source.
- Misconception remediation planning now consumes those source-aware references. `AdaptivePlannerService` prefers `recentQuestionRefs` when finding approved variants: direct unified-bank refs match `csca_questions.id`, special-practice refs are resolved through `sourceQuestionId`, and legacy metadata without source information gets a conservative compatibility lookup. The planner therefore no longer treats a naked numeric id as both a unified question id and a bridge id unless the record genuinely predates source-aware metadata.
- Adaptive round reports now preserve historical display even after question governance changes. Existing round items are resolved by id without current `published/approved` filters, so a submitted report can still show what the learner actually answered if the underlying AI-backed bridge or unified question was later archived, rejected, or moved to review. This boundary is deliberately different from new selection, normal practice sessions, and AI Coach prompt context, which must respect current governance.
- Misconception remediation variant recommendations now require current syllabus alignment. Repeated-mistake and completed-concept-card flows still use historical wrong-question evidence to find candidate variants, but only approved variants whose `syllabusVersion` matches the current published topic version can become preferred next-round questions or report-level `variantPractice` recommendations.
- Quality replacement approval now retires the old live practice-pool question as well as the old unified-bank question. When a replacement candidate is approved, the replaced source `csca_questions` row is archived, the quality metric is resolved, replacement metadata is recorded, and the old linked `special_practice_questions` row is archived before the new replacement remains as the active practice item.
- `scripts/csca-ai-questioning-smoke.cjs` now verifies these practice-pool invariants against the database: approved-then-archived candidates leave the active pool, approved-then-rejected candidates leave the active pool, quality archive removes the active practice-pool row, reduce-exposure is deprioritized by adaptive picking, and approved quality replacements remove the old published practice question. `scripts/csca-adaptive-rules-test.cjs` additionally verifies normal special-practice session snapshots, AI Coach single-question context, and AI Coach round-summary payloads all filter AI-backed questions that are under governance review, while submitted adaptive reports keep historical governed question content. This closes the operational gap where backend governance could previously look complete while the adaptive trainer, normal special-practice session, or AI Coach still had a published bridge row to use, without breaking learner history.
- Quality calibration CSV/JSON exports now include replacement candidate status and follow-up action (`review_replacement_candidate`, `stale_regenerate_again`, or `published_replacement`) by cross-checking the current candidate queue. Offline handoffs can now distinguish a reviewable replacement from an archived/rejected candidate that must be regenerated.
- Generation actions now have an explicit candidate-review handoff. Single-blueprint generation, batch generation, pregeneration, generation-job processing, and the daily workflow generation retry all inspect their result for created candidate ids; when candidates were created, `/admin/audit` opens the pending candidate queue and the feedback copy tells operators that the next step is candidate review.
- Generation queue actions also handle the non-candidate case explicitly. Enqueue and processing/retry actions now summarize queued/processed jobs, and if no candidate was created yet the page returns operators to the generation-job list instead of showing only a generic completion message.
- Topic-health actions now route to their operational follow-up: creating a missing blueprint returns to topic health with created/skipped counts, generating candidates opens the generation-job queue unless candidates were immediately created, reviewing candidates opens the pending candidate queue, and reviewing quality opens the quality-governance section.
- `npm --prefix frontend run test:admin-audit-summaries` locks the calibration summary and shortcut/filter behavior.
- The same check now locks the quality calibration CSV/JSON report schema, candidate queue CSV/JSON report schema, visible export buttons, and candidate manual-fix review gate.
- `npm run verify:csca-ai-questioning` now also covers the manual-fix path in the database smoke: a review-failed candidate is edited through the audited controller endpoint, rerun through reviewer, returned to pending review, and verified for `lastManualEdit`, `manualEditGate`, and `manual_fix_and_review` audit evidence.

Reasoning:

- Structured syllabus scope is now wired into generation and review, the first safe reverse-operation model exists as dry-run evidence, and a recovery drill command now captures that evidence. The next content-safety risk is less about missing recovery mechanics and more about operator workload: batching review and quality-governance actions so recovery and candidate governance do not become manual bottlenecks.
- Organization governance is important, but it is less likely to corrupt learning content if delayed.
