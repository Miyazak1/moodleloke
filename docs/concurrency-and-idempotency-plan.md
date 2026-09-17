# CSCAlite Concurrency And Idempotency Plan

## Purpose

This document defines the concurrency strategy CSCAlite should use before production launch. The goal is to make user-facing writes predictable under double-clicks, retries, multiple browser tabs, webhook redelivery, and concurrent admin edits.

The first production release can stay on a single backend instance, but the implementation should avoid designs that break when the service later moves to multiple processes or containers.

## Implementation Status - 2026-05-18

Phase 1 P0 backend hardening is implemented locally:

- Added cart dedupe keys and a database uniqueness invariant for logical cart lines.
- Added checkout idempotency storage through `Order.checkoutKey`.
- Added short PostgreSQL advisory locks around cart mutation, checkout, mock exam attempt mutation, and special-practice session mutation.
- Moved checkout cart read, pricing, order creation, and cart clearing into one transaction.
- Hardened payment callback handling so duplicate terminal callbacks are idempotent and a paid order is not regressed by a later failed callback.
- Added version fields to mock exam attempts and special-practice sessions.
- Added optional `expectedVersion` support to mock exam and special-practice autosave payloads.
- Made mock exam and special-practice submit paths idempotent under the same attempt/session lock.
- Added frontend checkout `Idempotency-Key` generation for the active checkout intent.
- Added frontend `expectedVersion` use for mock exam and special-practice autosave payloads.
- Added `npm run verify:concurrency`, backed by `scripts/concurrency-smoke.cjs`.

Phase 2 admin conflict safety has started:

- Added `version` fields to `MockExamPaper`, `MockExamQuestion`, `SpecialPracticeTopic`, and `SpecialPracticeQuestion`.
- Added migration `0019_admin_resource_versioning`.
- Added migration `0020_content_study_china_versioning`.
- Added migration `0021_school_scholarship_versioning`.
- Admin mock-exam and special-practice summaries now return `version`.
- Admin mock-exam and special-practice update, publish, and archive paths accept `expectedVersion`.
- Content blocks, city guides, and application timeline windows now return `version`.
- Content blocks, city guides, and application timeline windows now accept `expectedVersion` for update, publish, and archive.
- Schools, school programs, school CSCA rules, school scholarships, and independent scholarships now return `version`.
- Schools, school programs, school CSCA rules, school scholarships, and independent scholarships now accept `expectedVersion` for update and archive.
- Publish operations validate and update in the same transaction with a conditional `version` update.
- Stale admin edits return `409 Conflict` with `code: VERSION_CONFLICT` and the current server version.
- Admin mock-exam and special-practice pages send the loaded version for save, publish, archive, and question updates.
- Admin content, city guide, and timeline pages send the loaded version for save, publish/archive, and enable/disable operations.
- Admin school and scholarship pages send the loaded version for save and archive operations.
- Added `npm run verify:admin-concurrency`, backed by `scripts/admin-stale-edit-smoke.cjs`, to simulate stale admin edits and assert `VERSION_CONFLICT` responses.
- Admin user status changes now run under a transaction-scoped PostgreSQL advisory lock, so concurrent attempts cannot disable every active admin.
- Compare-list add/remove operations now run under a user-scoped PostgreSQL advisory lock, so concurrent adds cannot exceed the four-school limit.

Phase 3 multi-instance readiness has started:

- Auth rate limiting now supports a Redis-backed shared store for multi-instance deployments. Local development can continue using the in-memory store.
- Local and production Docker compose files now include Redis service definitions. The production compose backend defaults to `RATE_LIMIT_STORE=redis`.

## Principles

- Prefer database constraints for invariants that must never be violated.
- Make public write APIs idempotent where browser retries or double submissions are expected.
- Keep read-check-write sequences inside transactions when the check affects what is written.
- Use optimistic concurrency for admin editing flows where two operators may edit the same record.
- Use short-lived user-level locks only for operations that cannot be expressed cleanly as constraints or idempotent writes.
- Treat in-memory coordination as local-development-only unless deployment is explicitly single-process.
- Return stable, user-friendly conflict responses instead of silently overwriting data.

## Risk Matrix

| Area | Current Risk | Expected Guarantee | Priority |
| --- | --- | --- | --- |
| Checkout | Double-click or retry can create duplicate orders from the same cart snapshot. | One checkout intent creates at most one pending order. | P0 |
| Cart | Concurrent add can create duplicate cart rows or lost quantity updates. | One logical item per user/type/school, quantity updates are atomic. | P0 |
| Payment callback | Provider retry or parallel callback can race order/payment status updates. | Callback handling is idempotent and terminal statuses cannot regress. | P0 |
| Mock exam attempts | Autosave and submit from multiple tabs can race. | Once submitted, answers and score are stable. | P0 |
| Special practice sessions | Save-progress and submit can race. | Once completed, answers and report are stable. | P0 |
| Admin publish/import | Validation can become stale while another admin edits the same paper/topic/content. | Publish validates and writes atomically against the current version. | P1 |
| Compare list | Concurrent add can exceed the four-school limit. | Implemented with a user-scoped advisory lock and in-transaction count. | P1 |
| Auth rate limit | In-memory limit does not work across multiple instances. | Production multi-instance deployments use shared rate limiting. | P1 |
| Admin user status | Two admins can race while disabling the last active admin. | At least one active admin remains. | P1 |

## Data Model Changes

### Cart Items

Add uniqueness for logical cart lines.

Recommended shape:

```prisma
model CartItem {
  // existing fields

  @@unique([userId, type, schoolId], map: "uq_cart_items_user_type_school")
}
```

For `ADVISOR_PACKAGE`, `schoolId` is null. PostgreSQL allows multiple null values in a unique constraint, so use one of these approaches:

- Add a normalized `dedupeKey` column and unique `@@unique([userId, dedupeKey])`.
- Split advisor and school-service logic into separate explicit unique constraints via raw SQL partial unique indexes.

Recommended implementation for simplicity:

- Add `dedupeKey String @map("dedupe_key")`.
- Set `dedupeKey` to `SCHOOL_SERVICE:<schoolId>` or `ADVISOR_PACKAGE`.
- Add `@@unique([userId, dedupeKey], map: "uq_cart_items_user_dedupe")`.

### Checkout Idempotency

Add a checkout idempotency key on orders.

Recommended fields:

```prisma
model Order {
  // existing fields
  checkoutKey String? @map("checkout_key") @db.VarChar(120)

  @@unique([userId, checkoutKey], map: "uq_orders_user_checkout_key")
}
```

The frontend should generate a key per checkout click and preserve it while retrying the same request. The backend should also accept an `Idempotency-Key` header.

### Attempt And Session Versions

Add optimistic concurrency fields:

```prisma
model MockExamAttempt {
  // existing fields
  version Int @default(1)
}

model SpecialPracticeSession {
  // existing fields
  version Int @default(1)
}
```

Patch requests include `expectedVersion`. Updates use `updateMany` with `{ id, submittedAt: null, version: expectedVersion }` and increment `version`. If no row updates, return `409 Conflict` and the latest server state.

### Admin Editable Versions

Add `version Int @default(1)` to admin-edited resources that need conflict detection:

- `PublicContentBlock`
- `CityGuide`
- `ApplicationTimelineWindow`
- `School`
- `SchoolProgram`
- `SchoolCscaRule`
- `SchoolScholarship`
- `Scholarship`
- `MockExamPaper`
- `MockExamQuestion`
- `SpecialPracticeTopic`
- `SpecialPracticeQuestion`

Admin update requests should include the version the operator loaded. If the version is stale, return `409 Conflict` with the current record summary.

## API Concurrency Rules

### Cart Add

Use an atomic upsert keyed by `userId + dedupeKey`.

Expected behavior:

- Same school service added concurrently becomes one line.
- Quantity increments use database-side atomic increment.
- The response returns the latest cart after the write.

Implementation pattern:

```ts
await prisma.cartItem.upsert({
  where: { userId_dedupeKey: { userId, dedupeKey } },
  create: { userId, type, schoolId, quantity, dedupeKey },
  update: { quantity: { increment: quantity } }
});
```

### Checkout

Move the full cart read, pricing, order creation, and cart clearing into one transaction.

Expected behavior:

- If the same `Idempotency-Key` is reused, return the existing order.
- If the cart is already consumed, return the existing order for the same key or a clear empty-cart response.
- Do not create a second order from the same cart snapshot.

Transaction pattern:

1. Check for an existing order by `userId + checkoutKey`.
2. Read current cart items inside the transaction.
3. Create order and order items.
4. Delete cart items only after the order is created.
5. Return the created or existing order.

For stronger protection without a checkout key, use a short user-level advisory lock around checkout in PostgreSQL.

### Payment Callback

Payment callbacks must be idempotent and monotonic.

Rules:

- `SUCCEEDED` is terminal and must not be overwritten by `FAILED`.
- Duplicate `SUCCEEDED` callbacks return success without changing state.
- Duplicate `FAILED` callbacks return success if the payment is already failed.
- Amount mismatch and invalid signature are logged but do not mutate order/payment state.
- Callback logs are append-only.

Implementation pattern:

- Re-read payment and order inside the transaction.
- Update with conditional guards, for example `where: { id, status: { not: 'SUCCEEDED' } }`.
- Prefer a state transition helper that rejects invalid regressions.

### Mock Exam Autosave And Submit

Rules:

- Autosave must not update a submitted attempt.
- Submit must be idempotent.
- Submit should calculate score from the latest accepted answers.
- After submit, reports use the attempt snapshot and cannot change when questions are edited.

Implementation pattern:

- `PATCH /attempts/:id` includes `expectedVersion`.
- The update condition includes `submittedAt: null`.
- `POST /attempts/:id/submit` uses a transaction:
  1. Re-read attempt.
  2. If already submitted, return report.
  3. Calculate score from current answers and question snapshot.
  4. Conditional update with `submittedAt: null`.
  5. If the conditional update fails, re-read and return the submitted report.

### Special Practice Save And Submit

Use the same rules as mock exams:

- Conditional autosave with `completedAt: null`.
- Submit is idempotent.
- Report is based on the session question snapshot.
- Stale patch after completion returns `409 Conflict` or the completed session state.

### Admin Publish

Admin publish must validate the current database state inside the same transaction that changes status.

Rules:

- Re-read the paper/topic/content inside the transaction.
- Validate required fields and question counts after re-read.
- Update status only if the record version matches.
- Increment version on publish/archive/edit.
- Record audit inside the same transaction where feasible.

For large imports, keep the existing transaction approach, but add version checks for updating existing published or draft records.

### Compare List

Implemented approach:

- Keep the existing primary key on `userId + schoolId`.
- Use a transaction.
- Take a short PostgreSQL advisory lock on `compare:<userId>` for add/remove operations.
- Re-check the user's compare rows immediately before insert.
- If the limit is reached, return `400`.

The lock is intentionally scoped to one user so different users can update compare lists concurrently.

## Locking Strategy

Use locks sparingly.

Recommended database-first order:

1. Unique constraints.
2. Idempotency keys.
3. Conditional updates with version checks.
4. Transactions.
5. PostgreSQL advisory locks for user-scoped operations that span multiple rows.

Candidate advisory lock scopes:

- `checkout:<userId>`
- `compare:<userId>`
- `admin-user-status`
- `admin-publish:mock-paper:<paperId>`
- `admin-publish:special-topic:<topicId>`

Avoid long locks around network calls, file operations, or external providers. Payment provider calls should happen before or after the transaction, not while holding a lock.

## Multi-Instance Readiness

The in-memory rate limiter is acceptable for local development and a deliberate single backend process. It is not sufficient for multi-instance production because each instance would keep its own counters.

Before scaling beyond one backend instance:

- Set `RATE_LIMIT_STORE=redis` and configure `RATE_LIMIT_REDIS_URL` or `REDIS_URL`.
- Keep Redis close to the backend region and set `RATE_LIMIT_REDIS_TIMEOUT_MS` to a small value such as `500`.
- Confirm `/api/v1/ops/ready` reports `rateLimit.store: "redis"` and `rateLimit.shared: true`.
- Confirm session state is database-backed only. Refresh sessions already use the database.
- Confirm metrics are per-instance or aggregated by the monitoring system.
- Confirm background jobs, if introduced later, use a single-owner queue or leases.

## Error Semantics

Use consistent HTTP responses:

- `200 OK`: idempotent retry returned an existing successful result.
- `201 Created`: first successful creation.
- `400 Bad Request`: business rule rejected the request, such as compare limit reached.
- `401 Unauthorized`: invalid or expired auth.
- `403 Forbidden`: authenticated but not allowed.
- `404 Not Found`: resource unavailable to this user.
- `409 Conflict`: stale version, submitted/completed state changed, or admin edit conflict.
- `429 Too Many Requests`: rate limit exceeded.

Conflict responses should include enough current state for the frontend to recover:

```json
{
  "message": "内容已被其他操作更新，请刷新后再继续。",
  "code": "VERSION_CONFLICT",
  "currentVersion": 7
}
```

## Test Plan

### Automated Unit Or Integration Tests

Add tests for:

- Concurrent cart add of the same school service produces one row.
- Concurrent checkout with the same idempotency key returns one order.
- Concurrent checkout without a key does not create two orders from the same cart.
- Duplicate payment callback does not regress order/payment status.
- `FAILED` callback after `SUCCEEDED` does not mark a paid order failed.
- Mock exam autosave after submit is rejected or ignored deterministically.
- Two concurrent submit calls return the same report.
- Special practice follows the same submit/autosave guarantees.
- Admin publish fails with stale version.
- Compare add cannot exceed four rows.

### Manual Browser Checks

Run these before release:

- Double-click checkout button quickly.
- Open the same mock exam attempt in two tabs, save in one tab, submit in the other.
- Open the same special practice session in two tabs, save in one tab, submit in the other.
- Open the same admin paper/topic in two admin sessions, edit in both, publish from both.
- Retry a payment callback payload twice.

### Load And Race Smoke

The repository includes `scripts/concurrency-smoke.cjs` to run controlled parallel requests against a local backend.

Minimum scenarios:

- 10 parallel cart-add requests.
- 5 parallel checkout requests.
- 5 parallel attempt-submit requests.
- 5 duplicate payment callbacks.

Run it with:

```bash
npm run verify:concurrency
```

It should be included in `verify:ci` or `verify:release-candidate` after the team confirms the target release database always has migration `0018_concurrency_idempotency` applied before backend startup.

## Rollout Plan

### Phase 1 - P0 Public Write Safety

- Add cart dedupe key and atomic upsert.
- Add checkout idempotency key.
- Move checkout read/pricing/create/delete into a single transaction.
- Harden payment callback state transitions.
- Add mock exam and special practice versioned save/submit behavior.
- Add automated tests or smoke coverage for these paths.

Exit criteria:

- Parallel cart add and checkout cannot create duplicate logical results.
- Duplicate payment callbacks are safe.
- Attempt/session reports remain stable after submit.

### Phase 2 - Admin Conflict Safety

- Add version fields to admin-edited resources.
  - Done for mock-exam papers/questions, special-practice topics/questions, content blocks, city guides, and timeline windows.
  - Pending for schools and scholarships.
- Enforce expected-version checks on edit/publish/archive.
  - Done for mock-exam, special-practice, content, city guides, and timeline windows.
- Move publish validation and status updates into single transactions.
  - Done for mock-exam and special-practice publish; content/study-China status changes use conditional versioned updates.
- Improve frontend conflict handling for admin pages.
  - Basic conflict feedback is surfaced through existing admin error panels; a dedicated refresh prompt is still pending.

Exit criteria:

- Two admins editing the same resource cannot silently overwrite each other.
- Publish always validates the same version it publishes.

### Phase 3 - Multi-Instance Readiness

- Replace in-memory auth rate limit with shared rate limiting.
  - Done as an optional Redis store behind `RATE_LIMIT_STORE=redis`; memory remains the local default.
- Document production instance count and rate-limit owner.
- Add advisory locks where constraints/idempotency do not cover multi-row invariants.
  - Done for compare-list add/remove and admin user status changes.
- Add load/race smoke to release gates.
  - Done for cart, checkout, compare-list overflow, payments, mock exam submit, and special-practice submit through `npm run verify:concurrency`.
  - Done for release candidates through `npm run verify:release-concurrency`, which is now part of `npm run verify:release-candidate`.

Exit criteria:

- The app can safely run more than one backend instance for public write flows.
- Release evidence includes concurrency smoke output.

## Release Gate Additions

Add these checks to the release checklist after Phase 1:

- `npm run verify:concurrency` passes locally.
- `npm run verify:release-concurrency` passes locally and in the release-candidate gate.
- Double-click checkout creates one order.
- Duplicate payment callbacks are idempotent.
- Mock exam and special practice submit are idempotent.
- Autosave after submit does not mutate completed reports.
- Concurrent compare-list overflow leaves at most four schools.

Add these checks after Phase 2:

- `npm run verify:admin-concurrency` passes locally.
- Admin stale edit returns `409 Conflict`.
- Concurrent admin status changes cannot leave zero active admins.
- Admin publish validates and publishes atomically.
- Concurrent admin publish attempts leave a valid final state and audit trail.
- Multi-instance deployments set `RATE_LIMIT_STORE=redis` and `/api/v1/ops/ready` reports the shared limiter.

## Open Decisions

- Whether production launch will run one backend instance or multiple.
- Whether idempotency keys should be generated only by the frontend or also by backend fallback.
- Whether advisory locks are acceptable in the Prisma layer or should be wrapped by raw SQL helper functions.
- Whether checkout remains in the free-learning scope or is hidden until real payment is ready.
- Whether admin conflict handling should block all stale saves or offer an explicit overwrite flow.
