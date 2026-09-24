# CSCAlite Ops Runbook

> **Archived compatibility document.** This runbook describes the former CSCAlite release and operations chain. Its release, staging and Docker commands are intentionally blocked in Moodlelike and must not be used as current instructions. Start with [`../LOCAL_DELIVERY.md`](../LOCAL_DELIVERY.md), [`../LIVE_GOLDEN_PATH.md`](../LIVE_GOLDEN_PATH.md) and [`../COMPATIBILITY_OPERATIONS.md`](../COMPATIBILITY_OPERATIONS.md). See [`ARCHIVED_CSCA_OPERATIONS.md`](ARCHIVED_CSCA_OPERATIONS.md) for the retirement boundary.

## Release Gate

Run the same gate locally and in CI:

```bash
npm run verify:ci
npm run verify:release-concurrency
npm run verify:ops
npm run verify:supply-chain
npm run verify:staging
npm run verify:cookie-only
```

This validates Prisma schema, frontend build, minimal frontend checks, backend build, backend security tests, E2E smoke, concurrency/idempotency smoke, admin stale-edit smoke, dependency audit, and production env documentation.

`verify:local` includes `npm run verify:csca-ai-questioning`. This AI-questioning gate first builds the backend and frontend, then runs the AI questioning rule tests, the DB-backed AI question-production smoke, and the frontend admin-audit summary check. The smoke writes temporary CSCA exam topics, blueprints, generated candidates, quality metrics, misconceptions, concept cards, variants, adaptive sessions, syllabus imports, and bridge practice questions, then cleans them up. It proves the core loop from blueprint coverage through generation queue, human-review gate, approval/publish, adaptive selection, quality feedback, replacement governance, stale-syllabus filtering, syllabus JSON import/apply, recovery-draft creation, and readiness/recovery audit writeback. The frontend check proves the admin readiness/audit labels, filters, CSV/JSON exports, stable anchors, latest-audit display, recovery-draft summaries, and visible audit-list insertion remain wired. Run it only against a local or disposable verification database, not a shared production database.

`verify:local` also includes `npm run verify:governance`. This governance gate first runs `npm run governance-gates:rules` to make sure the required governance/security sub-checks have not been dropped from `package.json` or this runbook. It then builds the backend and frontend, runs the organization governance DB smoke, the organization-scoped admin-audit filter smoke, and the frontend export/summary checks for organization invites, organization governance digest, admin-audit templates, and syllabus import reports. It proves the operational layer around "team onboarding + team governance + syllabus JSON import" is not just documented: CSV invite import, generated invite links, invite acceptance, member/cohort changes, organization audit filtering, reusable audit templates, organization summary copy, and syllabus preview/export helpers all stay wired. Run it against a local or disposable verification database because the smoke creates and cleans temporary organization records.

`verify:security` includes `npm run csca-byok:security` and `npm run organization-permissions:rules`. By default it checks BYOK key-management configuration without touching the database, then verifies the organization role matrix that controls who may consume the organization AI pool or route through organization BYOK. Set `CSCA_BYOK_SECURITY_CHECK_DB=1` during release verification to read active `OrganizationLlmProviderConfig` rows and fail if active BYOK providers exist without `CSCA_ORG_LLM_KEY_SECRET`, `AUTH_SECRET`, or `JWT_SECRET`. Set `CSCA_BYOK_BLOCK_LEGACY_SECRET_STORAGE=1` after migrating old rows to fail release verification when active BYOK providers still use legacy `plain:`, `base64:`, or raw key storage.

## CSCA Syllabus Recovery Drill

Run this drill before enabling a new syllabus import workflow in staging, after changing syllabus import/recovery code, or during an incident review when operators need evidence that the recovery path still works:

```bash
npm run csca-syllabus:recovery-drill
```

The drill runs the DB-backed AI-questioning smoke against the configured local or disposable verification database and writes a sanitized evidence file to `RELEASE_EVIDENCE_DIR`, defaulting to `.tmp/release-evidence/`.

The evidence proves these recovery controls still execute:

- upload/preview/save/apply a `csca-syllabus-v1` JSON import;
- mark stale approved questions back to `pending_review` with import governance metadata;
- generate a syllabus reverse plan in dry-run mode;
- rebuild a recovery draft from the saved import JSON and re-preview current impact;
- write compact admin audit events for `reverse_plan` and `recovery_draft`;
- avoid storing full reverse-plan operation snapshots in admin audit logs.

Safety boundary:

- Run the drill only against local, staging, or disposable verification databases.
- The reverse plan is dry-run only; it must not mutate topics or questions.
- Recovery draft is the supported re-apply path. It copies the saved JSON and recalculates impact against current data.
- Do not automatically approve questions that moved to `pending_review`; they remain manual-review items.
- Do not add a destructive rollback executor until a separate per-operation confirmation model, transaction plan, before/after evidence export, and rehearsal runbook exist.

Operational review checklist after the drill:

1. Confirm the command exits successfully.
2. Open the generated `csca-syllabus-recovery-drill-*.json` evidence file.
3. Confirm `status` is `passed`.
4. Confirm `scope` includes `syllabus_reverse_plan_dry_run`, `syllabus_recovery_draft`, and `admin_audit_recovery_and_reverse_plan`.
5. If it fails, inspect `stdoutTail` and `stderrTail`, fix the underlying smoke failure, and rerun the drill rather than relying on manual UI checks.

`verify:release-concurrency` runs the public write race smoke and the admin conflict smoke. It covers cart add, checkout idempotency, compare-list overflow, payment callback idempotency, mock exam submit, special-practice submit, stale admin edits, and concurrent admin status changes.

`verify:ops` starts the built backend with production env, checks health/ready, security headers, CSP, metrics access control, CSP report handling, and backup dry-run.

`verify:supply-chain` checks root, frontend, and backend production dependency audit output. Backend production exceptions must be recorded in `security/audit-exceptions.json` with a reason, mitigation, and expiry date; dev-only audit findings are reported separately.

`verify:staging` requires `STAGING_BASE_URL` and checks the deployed frontend, `/api/v1/health`, `/api/v1/ops/ready`, security headers, CSP, and metrics access control through the same origin that browsers use.

`verify:staging:full` is the release-window staging gate. It requires HTTPS, a metrics token, and cookie-only refresh behavior. It writes sanitized evidence to `RELEASE_EVIDENCE_DIR`, defaulting to `.tmp/release-evidence/`.

`verify:cookie-only` starts the built backend locally with `AUTH_LEGACY_REFRESH_FALLBACK_ENABLED=false` and proves cookie refresh, CSRF rejection, cross-origin rejection, logout, and Bearer refresh rejection.

`verify:release-window:local` is the Docker-based local release rehearsal. It runs the local release-candidate gate, starts the `cscalite-verify` compose stack, verifies local staging at `http://127.0.0.1:18080`, creates a database dump from the Docker Postgres container, and performs a restore drill.

`verify:local` also runs `npm run csca-readiness:release-gate`. This keeps the CSCA readiness sampled-threshold release gate in the standard local verification path.

## Docker Deployment

The single-host production rehearsal lives under `deploy/`.

```bash
copy .env.production.example .env
docker compose --env-file .env -f deploy/docker-compose.prod.yml up -d --build
```

Services:

- `db`: PostgreSQL with persistent volume.
- `migrate`: one-shot Prisma migration runner.
- `redis`: shared rate-limit store for multi-instance backend readiness.
- `backend`: Nest backend with healthcheck and backup volume.
- `frontend`: nginx static frontend and same-origin `/api` reverse proxy.

Run `npm run verify:docker` before using the compose stack as a staging baseline.

Docker container groups used by this project:

- `cscalite`: local development database from the repo root compose file.
- `cscalite-verify`: production-style local staging rehearsal from `deploy/docker-compose.prod.yml`.
- `scripts`: historical Prisma/E2E test containers from `scripts/`.

Run `npm run verify:docker:status` to classify containers by compose labels. It is read-only and does not stop or remove services. Do not apply cleanup commands to unrelated projects such as `clawfabric`.

Run `npm run verify:docker:staging-local` to start or refresh the `cscalite-verify` stack and run a full local staging smoke. The script intentionally leaves the stack running for browser inspection.

## Production Startup

Production startup is blocked unless these are configured:

- `DATABASE_URL`
- `AUTH_SECRET`
- `CORS_ORIGINS`

`PAYMENT_CALLBACK_SECRET` remains required only when the current simulated payment callback flow is enabled.

For Gumroad hosted checkout, configure `GUMROAD_PRODUCT_URL` and `GUMROAD_ACCESS_TOKEN`. Point the Gumroad sale ping/webhook to `/api/v1/commerce/payments/gumroad/callback`; callbacks are recorded but will not mark orders paid unless the backend can verify the sale through the Gumroad API token.

The production compose stack includes Redis and defaults backend rate limiting to `RATE_LIMIT_STORE=redis` with `RATE_LIMIT_REDIS_URL=redis://redis:6379`. `/api/v1/ops/ready` should report `rateLimit.store` as `redis` and `rateLimit.shared` as `true`. Keep the memory store only for local development or a deliberate single-instance launch.

## AI Coach LLM Rollout

AI Coach uses `rule-fallback` by default. Real LLM calls are optional and must be enabled deliberately from the backend environment only; never expose `CSCA_AI_API_KEY` to frontend build variables.

Safe rollout sequence:

1. Configure `CSCA_AI_COACH_ENABLED=true`, `CSCA_AI_PROVIDER`, `CSCA_AI_MODEL`, `CSCA_AI_API_KEY`, and `CSCA_AI_BASE_URL`, but keep `CSCA_AI_ROLLOUT_PERCENT=0`.
2. Restart the backend and run `npm run ai-provider:smoke`. This validates readiness and fallback behavior without spending provider tokens.
3. Set `AI_PROVIDER_SMOKE_ALLOW_EXTERNAL=1` and run `npm run ai-provider:smoke` only when you intentionally want one live AI Coach call. If admin credentials are configured, the smoke also checks admin observability, rollout health, and the low-feedback review queue for the temporary interaction.
4. Increase `CSCA_AI_ROLLOUT_PERCENT` gradually, such as `1`, `5`, `25`, then `100`, while watching admin AI observability for fallback rate, provider errors, rejected outputs, feedback, cost estimates, and ledger entries.
5. Return `CSCA_AI_ROLLOUT_PERCENT=0` to disable live LLM calls immediately without removing provider credentials.

The admin AI observability panel computes rollout health from:

- `CSCA_AI_ROLLOUT_MIN_INTERACTIONS`, default `20`.
- `CSCA_AI_ROLLOUT_MIN_FEEDBACK`, default `5`.
- `CSCA_AI_ROLLOUT_MAX_ERROR_RATE`, default `0.05`.
- `CSCA_AI_ROLLOUT_MAX_REJECTION_RATE`, default `0.02`.
- `CSCA_AI_ROLLOUT_MAX_LOW_FEEDBACK_RATE`, default `0.2`.
- `CSCA_AI_ROLLOUT_MIN_AVERAGE_RATING`, default `3.5`.

If rollout health says `pause_rollout`, set `CSCA_AI_ROLLOUT_PERCENT=0` first, then inspect provider errors, prompt guard rejections, low-rated samples, and ledger entries before trying again.

Planner Assistant can optionally use the same controlled provider path after the AI Coach rollout is healthy:

- Keep `CSCA_PLANNER_ASSISTANT_AI_ENABLED=false` by default.
- When enabled, the provider must return structured JSON for `planner_assistant`; invalid schema, wrong language, unsafe output, or provider failure falls back to the local rule suggestion.
- The LLM can only suggest ordering, one-level difficulty shifts, and clearer reasons inside the rule planner candidates. `PlannerAssistantService` Rule Guard remains the final authority and rejects invented topics or unsafe difficulty jumps.
- Planner Assistant calls are recorded in the adaptive round planner snapshot and training-event metadata through `plannerAssistant.provider`, `status`, `differences`, and `rejectedReasons`.
- Run `node scripts/csca-adaptive-rules-test.cjs` after changing this path; the test covers provider-backed suggestions, language propagation, guard rejection, and fallback-safe behavior without live provider calls.

Recommended production defaults before live rollout:

- `CSCA_AI_COACH_ENABLED=false`
- `CSCA_AI_PROVIDER=rule-fallback`
- `CSCA_AI_ROLLOUT_PERCENT=0`
- `CSCA_PLANNER_ASSISTANT_AI_ENABLED=false`
- `CSCA_AI_PROMPT_VERSION=coach-v2-safety`
- `CSCA_ORG_LLM_KEY_SECRET` set to a long random secret if organization BYOK will be enabled.

## AI Question Production Scheduler

AI question production has an optional backend scheduler. It is disabled by default and should stay disabled until platform review staffing, provider credentials, and admin monitoring are ready.

Default posture:

- `CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false`
- `CSCA_AI_QUESTIONING_SCHEDULER_RUN_ON_STARTUP=false`
- `CSCA_AI_QUESTIONING_SCHEDULER_INTERVAL_MINUTES=30`
- `CSCA_AI_QUESTIONING_SCHEDULER_PROCESS_LIMIT=10`
- `CSCA_AI_QUESTIONING_SCHEDULER_BACKFILL_LIMIT=10`
- `CSCA_AI_QUESTIONING_SCHEDULER_PER_TOPIC=1`
- `CSCA_AI_QUESTIONING_SCHEDULER_RETRY_FAILED=false`

Each scheduler cycle:

1. Processes existing queued generation jobs, bounded by `CSCA_AI_QUESTIONING_SCHEDULER_PROCESS_LIMIT`.
2. Scans topic-bank health for missing blueprints or missing candidates.
3. Enqueues and processes a small backfill batch, bounded by `CSCA_AI_QUESTIONING_SCHEDULER_BACKFILL_LIMIT` and `CSCA_AI_QUESTIONING_SCHEDULER_PER_TOPIC`.

Important guardrails:

- The scheduler creates candidates only. It does not auto-publish questions into learner practice.
- Candidates still pass the deterministic validator, optional AI Reviewer, and admin approval gate.
- Keep `CSCA_AI_QUESTIONING_SCHEDULER_RETRY_FAILED=false` during early rollout so repeated provider or prompt failures do not loop automatically.
- Watch Admin Audit for generation queue health, candidate review backlog, quality review backlog, and `admin_audit_logs` for AI-questioning mutations.

Enablement:

1. Confirm `npm run verify:csca-ai-questioning` passes against a disposable or staging database.
2. Confirm platform generation/review provider credentials are configured, or that deterministic fallback generation is acceptable for the environment.
3. Confirm admins can review the expected daily candidate volume.
4. Set `CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=true`.
5. Start with `CSCA_AI_QUESTIONING_SCHEDULER_INTERVAL_MINUTES=60`, `BACKFILL_LIMIT=5`, `PER_TOPIC=1`, and `PROCESS_LIMIT=5`.
6. Restart backend and watch scheduler logs plus Admin Audit for at least one interval.

Rollback:

1. Set `CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false`.
2. Restart backend.
3. In Admin Audit, archive or process any queued/failed generation jobs deliberately.
4. Leave already generated candidates in review queues; they are not learner-visible unless approved.

## CSCA Source Profile + Mock Exam AI Generation Rollout

This rollout covers the 2026-07-03 CSCA questioning architecture:

- `docs/csca-ai-questioning-source-of-truth-2026-07-03.md`
- `docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`
- `docs/subject-training-profile-adaptation-implementation-spec-2026-07-03.md`
- `docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md`

Default production posture:

- The CSCA applied syllabus baseline is shared by subject-practice AI generation and online-mock AI generation.
- Source-question JSON and source-question profile v2 are a shared upstream source. Business code must read the normalized profile shape instead of relying on ad hoc legacy `analysis` JSON.
- After shared preparation, AI production splits into two governed lines:
  - Subject-practice line: coverage gaps and topic blueprints produce review-required subject-practice candidates; approved candidates enter the subject-practice question asset flow.
  - Online-mock line: source-paper profile and mock blueprint slots produce review-required online-mock candidates; approved candidates enter the mock candidate pool and can be assembled into hidden draft mock papers.
- Manual authoring remains a separate channel. Manual special-practice questions and subject-practice AI candidates can both feed the learner subject-practice experience. Manual mock papers/questions and online-mock AI draft papers can both feed the learner mock-exam experience after admin review and publish.
- Subject-practice AI candidates and online-mock AI candidates may share `csca_questions` as a staging table, but they must be separated by `generation_metadata.sourceKind`, `generation_metadata.generationMode`, and admin `useCase` filters.
- Mock-exam candidates must not publish into `special_practice_questions`.
- The manual mock-exam bank page remains for manual paper/question editing and final draft publish. Online-mock AI generation controls live in the Admin AI Question Bank online-mock line, not in the manual mock-exam bank page.
- Legacy mock-exam AI candidates without `generation_metadata.sourceKind = mock_exam_blueprint_slot` or `generation_metadata.generationMode = online_mock_exam_candidate` are not compatible with the clean assembly path. Regenerate them through the new generation job flow in the online-mock generation line instead of adding compatibility branches.

Preflight:

1. Confirm the working database is local, staging, or the planned production window target.
2. Take a backup before any production deployment:

```bash
npm run db:backup
```

3. Confirm migrations are pending/ready:

```bash
npm run db:migrate:status
npm run prisma:validate
```

4. Run the rollout gate:

```bash
npm run verify:csca-source-profile-rollout
```

5. Run build gates:

```bash
npm run backend:build
npm --prefix frontend run build
```

Deploy sequence:

1. Deploy backend and frontend code with the scheduler disabled.
2. Apply database migrations:

```bash
npm run db:migrate
```

3. Restart the backend and confirm `/api/v1/ops/ready` is healthy.
4. Dry-run source-question profile backfill:

```bash
npm run csca:source-question-profile:backfill -- --limit=500
```

5. If the dry-run result has `failed = 0`, execute the backfill in bounded batches:

```bash
npm run csca:source-question-profile:backfill -- --execute --limit=500
```

6. For large banks, repeat by subject to keep each batch easy to inspect:

```bash
npm run csca:source-question-profile:backfill -- --execute --subject=math --limit=500
npm run csca:source-question-profile:backfill -- --execute --subject=physics --limit=500
npm run csca:source-question-profile:backfill -- --execute --subject=chemistry --limit=500
```

7. In Admin AI Question Bank, confirm the workflow is split into `共用准备`, `科目训练线`, and `在线模考线`.
8. In shared preparation, confirm new source samples show `source-question-profile-v2` and active style profiles include reading load, calculation load, estimated time, stem pattern, option pattern, and similarity-risk signals.
9. In the subject-practice line, generate a small candidate batch for one low-risk topic. Confirm generation metadata records `sourceKind = syllabus_and_past_paper_profile` when a usable profile exists, and `sourceKind = syllabus` when no usable profile exists.
10. In subject training, confirm AI-generated profile-backed questions display as `AI生成题 · 大纲+真题画像`.
11. Run the mock-exam AI generation DB smoke against local or staging:

```bash
npm run csca-mock-exam-ai-generation:smoke
npm --prefix frontend run test:admin-mock-exam-ai-generation-ui
```

12. In the online-mock line of Admin AI Question Bank, create or load a mock blueprint, confirm its slots, create a background generation job, and watch the job move through slot progress.
13. Review generated online-mock candidates in the online-mock candidate queue. Approve only candidates that pass review. Approval for online-mock candidates should mark them as available for mock assembly and should not create special-practice questions.
14. Assemble a draft mock paper from the approved generation job. Confirm the paper remains `draft` and is not learner-visible.
15. Manually review the assembled paper in the mock-exam management flow, then publish through the normal mock-exam publishing workflow.

Operational checks:

- `mock_exam_blueprints` has the expected subject/status rows.
- `mock_exam_blueprint_slots.slot_results` records generated candidate IDs and assembled question IDs.
- `mock_exam_generation_jobs.status` reaches `assembled_draft` only after approved candidates exist.
- Approved mock candidates retain `generation_metadata.sourceKind = mock_exam_blueprint_slot` or `generationMode = online_mock_exam_candidate`.
- No mock-only candidate creates or links a `special_practice_questions` row.
- Existing subject training sessions still start when no source profile is available.
- Candidate review counts for subject practice and online mock are filtered by `useCase`; a large online-mock candidate pool must not inflate the subject-practice review queue.
- Admin Mock Exam should not expose online-mock AI generation buttons. It may show and publish draft papers, including drafts assembled by the online-mock AI line after review.
- Old queued/running/failed AI generation jobs that predate applied-syllabus/profile metadata should be archived or allowed to fail closed. Do not keep retrying old physics/chemistry jobs that have no source profile, no applied syllabus mapping, or no compatible online-mock metadata.

Production SQL spot checks:

```sql
SELECT COUNT(*) AS online_mock_candidates
FROM csca_questions
WHERE generation_metadata->>'generationMode' = 'online_mock_exam_candidate'
   OR generation_metadata->>'sourceKind' = 'mock_exam_blueprint_slot';

SELECT id
FROM csca_questions
WHERE (
    generation_metadata->>'generationMode' = 'online_mock_exam_candidate'
    OR generation_metadata->>'sourceKind' = 'mock_exam_blueprint_slot'
  )
  AND source_question_id IS NOT NULL
LIMIT 20;

SELECT id, status, error, updated_at
FROM mock_exam_generation_jobs
ORDER BY updated_at DESC
LIMIT 20;
```

Real Provider acceptance:

This is deliberately not part of `verify:csca-source-profile-rollout` because it calls the external question-generation provider and may consume paid tokens. Run it only on staging or during an explicit production verification window:

```bash
npm run csca-mock-exam-ai-generation:live-smoke
```

The live smoke creates a temporary one-slot online-mock blueprint, calls the configured real Provider, verifies the candidate carries `online_mock_exam_candidate` / `mock_exam_blueprint_slot` metadata, verifies pre-approval assembly is blocked, approves the candidate, verifies no `special_practice_questions` row is created, assembles a hidden draft mock paper, and cleans up the temporary records.

Required environment:

- `DATABASE_URL`
- `CSCA_AI_QUESTION_GENERATION_ENABLED=true`
- `CSCA_AI_QUESTION_GENERATION_PROVIDER` or `CSCA_AI_PROVIDER`, not `rule-fallback`
- `CSCA_AI_QUESTION_GENERATION_MODEL` or `CSCA_AI_MODEL`
- `CSCA_AI_QUESTION_GENERATION_API_KEY` or `CSCA_AI_API_KEY`

Optional environment:

- `CSCA_MOCK_EXAM_AI_LIVE_SMOKE_SUBJECT=math`
- `CSCA_MOCK_EXAM_AI_LIVE_SMOKE_ACTOR_ID=1`

Rollback:

1. Disable AI question production scheduler if it was enabled:

```bash
CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false
```

2. Stop creating new subject-practice or online-mock AI generation jobs from the admin UI.
3. Leave generated AI candidates in review/approved state; they are not learner-visible until explicitly published into subject practice or assembled/published into mock exams.
4. Leave draft mock papers unpublished. Draft papers are hidden from learners.
5. Keep manual special-practice and manual mock-exam content online unless the rollback specifically concerns those manually published assets.
6. If source-profile backfill introduced bad profile metadata, rerun the backfill with `--force` after fixing the normalizer, or restore the database backup if the production window requires a hard rollback.
7. Do not delete the new blueprint/job tables during application rollback. Keeping them is safer than losing admin provenance; old application code will ignore them.

## CSCA Readiness Sampled Threshold Rollout

CSCA readiness uses conservative static high-difficulty thresholds by default. Sampled thresholds can make the exam-ready gate more realistic, but they must be enabled deliberately because they can change whether a user is considered ready.

Final handoff for this feature line lives in `docs/readiness-final-handoff.md`.

Default production posture:

- `CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE=static`
- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_MATH=""`
- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_PHYSICS=""`
- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_CHEMISTRY=""`
- `CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS=5`

Preflight before enabling sampled thresholds:

1. Run `npm.cmd run csca-readiness:release-gate` locally. On non-Windows shells, `npm run csca-readiness:release-gate` is equivalent.
2. Run the normal local gate with `npm.cmd run verify:local` before release. This now includes the readiness release gate.
3. In Admin Audit, refresh readiness calibration snapshots.
4. Confirm "Maturity calibration health" is healthy or only watching.
5. Confirm "Sampled threshold rollout" says ready to launch. Do not enable sampled mode if the checklist reports blocked sample size, blocked calibration health, or impact over the configured limit.
6. Generate a pre-rollout evidence file:

```bash
CSCA_READINESS_EVIDENCE_PHASE=pre_rollout npm run csca-readiness:evidence
```

For live Admin API evidence, set `CSCA_READINESS_EVIDENCE_BASE_URL` and either `CSCA_READINESS_EVIDENCE_TOKEN` or `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`. Without credentials, the script writes a fixture-shaped template only.

Enablement:

1. Keep any single-subject overrides empty unless a deliberate emergency override is needed.
2. Set `CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE=sampled`.
3. Restart the backend.
4. Open Admin Audit and confirm the threshold distribution source is `sampled_distribution` for all eligible subjects.
5. Generate a post-rollout evidence file:

```bash
CSCA_READINESS_EVIDENCE_PHASE=post_rollout npm run csca-readiness:evidence
```

6. Compare pre-rollout and post-rollout evidence files in `RELEASE_EVIDENCE_DIR`, default `.tmp/release-evidence/`.
   Use explicit files when running a release review:

```bash
npm run csca-readiness:evidence:compare -- --before=.tmp/release-evidence/csca-readiness-pre_rollout-...json --after=.tmp/release-evidence/csca-readiness-post_rollout-...json
```

   The compare command returns non-zero when the after evidence is blocked, calibration health is blocked or needs attention, impact exceeds the configured limit, or post-rollout evidence is not launchable.
   Add `--write` to save a sanitized comparison file in `RELEASE_EVIDENCE_DIR` for release approval records.
   Admin Audit also lists recent readiness evidence and comparison files, with JSON download links for release review.
7. Watch impacted user-subject count, calibration alerts, readiness stage distribution changes, and readiness support tickets during the first release window.

Rollback:

1. Set `CSCA_READINESS_HIGH_DIFFICULTY_THRESHOLD_MODE=static`.
2. Restart the backend.
3. Confirm Admin Audit shows static/default threshold mode.
4. Generate a rollback evidence file:

```bash
CSCA_READINESS_EVIDENCE_PHASE=rollback npm run csca-readiness:evidence
```

5. Compare the post-rollout file against the rollback file:

```bash
npm run csca-readiness:evidence:compare -- --before=.tmp/release-evidence/csca-readiness-post_rollout-...json --after=.tmp/release-evidence/csca-readiness-rollback-...json --allow-blocked
```

6. Add `--write` if the rollback comparison should be kept as a release-window artifact.
7. Leave calibration snapshots intact; they are historical evidence and remain useful for later analysis.

Rollback immediately if any of these are true:

- sampled rollout status is `blocked`.
- calibration health becomes `needs_attention` or `blocked`.
- impacted user-subject count exceeds `CSCA_READINESS_SAMPLED_THRESHOLD_MAX_IMPACT_USER_SUBJECTS`.
- a subject loses sampled distribution eligibility.
- user/support feedback shows readiness conclusions became confusing or less trusted.

Use single-subject overrides only as a narrow emergency control:

- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_MATH`
- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_PHYSICS`
- `CSCA_READINESS_HIGH_DIFFICULTY_REQUIRED_CHEMISTRY`

If an override is set, Admin Audit should show `env_override` for that subject. Remove the override after the incident is understood, otherwise sampled distribution data for that subject will not drive the live threshold.

## Logging

Set `LOG_FORMAT=json` in production. Request logs include `requestId`, `method`, `path`, `status`, and `durationMs`. Sensitive query parameters such as token, password, secret, and signature are redacted.

## CSP And Metrics

Start staging with `CSP_MODE=report-only`. Watch `/api/v1/ops/csp-report` logs until violations are clean, then switch production to `CSP_MODE=enforce`.

Set `OPS_METRICS_ENABLED=true` only when the endpoint is reachable from trusted infrastructure. If `OPS_METRICS_TOKEN` is set, call `/api/v1/ops/metrics` with `Authorization: Bearer <token>`. Add `?format=prometheus` or `Accept: text/plain` for Prometheus-style text output.

Production `/api/v1/health` returns a minimal liveness payload by default. Set `OPS_HEALTH_DETAILS_ENABLED=true` only when the endpoint is private or otherwise trusted.

If `OPS_READY_TOKEN` is set, `/api/v1/ops/ready` requires `Authorization: Bearer <token>`. Keep it unset only when the endpoint is already private, or when release/staging smoke checks intentionally need unauthenticated readiness.

## Refresh Sessions

`AUTH_REFRESH_COOKIE_ENABLED=true` enables HttpOnly refresh cookies while keeping the JSON token response compatible. Production should use `AUTH_COOKIE_SECURE=true`; local Docker over plain HTTP may set it to `false`.

Cookie refresh and logout use a double-submit CSRF token. The backend sets a readable `cscalite_csrf` cookie and requires the same value in `X-CSRF-Token` for cookie-based refresh/logout. If you customize `AUTH_CSRF_COOKIE_NAME` or `AUTH_CSRF_HEADER_NAME`, build the frontend with matching `VITE_AUTH_CSRF_COOKIE_NAME` and `VITE_AUTH_CSRF_HEADER_NAME`.

The frontend stores only the access token in localStorage when cookie mode is active. Legacy Bearer refresh tokens are accepted only as a fallback during migration and are cleared after a successful refresh. Staging/production should run with `AUTH_LEGACY_REFRESH_FALLBACK_ENABLED=false`; local development may keep it `true` for compatibility testing.

## Release Evidence

Release-window scripts write sanitized JSON summaries to `.tmp/release-evidence/` unless `RELEASE_EVIDENCE_DIR` is set. Evidence may include route statuses, health/ready snapshots, metrics access status, cookie-only auth smoke status, backup file size, and restore target host/database. Do not commit this directory.

## Health Checks

- `/api/v1/health`: liveness only in production by default; optional configuration visibility for private trusted checks.
- `/api/v1/ops/ready`: readiness for launch smoke and operations checks, including a short non-sensitive database ping. Can be Bearer-token protected with `OPS_READY_TOKEN`.
- `/api/v1/ops/metrics`: optional non-sensitive process/request counters.

## Security Data Cleanup

`npm run db:cleanup-security` is dry-run by default and prints the records that would be removed. It covers expired or used auth email tokens, revoked or expired refresh sessions, and old payment callback logs.

Run a dry-run first:

```bash
npm run db:cleanup-security
```

Run deletion only after reviewing the dry-run:

```bash
npm run db:cleanup-security -- --execute
```

Retention windows are controlled by:

- `CLEANUP_AUTH_EMAIL_TOKEN_DAYS`, default `7`.
- `CLEANUP_REFRESH_SESSION_DAYS`, default `30`.
- `CLEANUP_PAYMENT_CALLBACK_LOG_DAYS`, default `90`.

## Practice-question Q&A lifecycle

Practice-question conversations are temporary assistance context, not learning evidence. The backend archives inactive practice Q&A after 30 days and permanently removes it after 90 days. Empty conversations abandoned before the first message are eligible after 24 hours. Independent subject-Q&A history and learning-context conversations are outside this policy.

The lifecycle worker runs every six hours by default. It skips conversations with queued/running Agent runs, pending outbox events, or attachments linked to verified exam evidence. Deleting a practice conversation cascades its messages, completed runs, artifacts, and processed outbox rows; mastery, wrong-answer records, adaptive-round answers, and learning evidence are stored separately and are not selected by this cleanup.

Review a dry-run before manual cleanup:

```bash
npm run backend:build
npm --prefix backend run agent:conversation-lifecycle
```

Apply one reviewed batch explicitly:

```bash
npm --prefix backend run agent:conversation-lifecycle -- --apply --confirm=PURGE_PRACTICE_QA --batch-size=100
```

Configuration:

- `AGENT_CONVERSATION_LIFECYCLE_ENABLED`, default `true`.
- `AGENT_CONVERSATION_LIFECYCLE_INTERVAL_MS`, default `21600000` (six hours).
- `AGENT_PRACTICE_QA_ARCHIVE_DAYS`, default `30`.
- `AGENT_PRACTICE_QA_PURGE_DAYS`, default `90` and always at least one day longer than the archive window.
- `AGENT_PRACTICE_QA_ABANDONED_HOURS`, default `24`.

Apply database migrations before starting a backend containing this worker. Monitor the structured lifecycle summary for archived, purged, and blocked counts. A blocked count is expected while a response is active; persistent blocked IDs require inspection rather than forced deletion.

## Emergency Rollback

1. Stop the new backend process.
2. Redeploy the previous artifact or image.
3. Check `/api/v1/ops/ready`.
4. Restore the database only when a migration or data write requires it; follow `docs/backup-restore.md`.
