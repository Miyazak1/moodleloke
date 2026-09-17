# AI adaptive questioning closure audit - 2026-06-11

This audit checks the original 10 open areas against the current codebase. It distinguishes between:

- Product loop: the feature can run end to end with guarded behavior.
- Governance loop: admins can see, review, approve, reject, archive, or repair outputs.
- Production maturity: the system is robust enough for higher-volume, lower-supervision operation.

## Executive conclusion

The earlier "not implemented" list is now partly outdated.

The codebase now has a real platform layer for AI question production and governance: `backend/src/ai-questioning`, unified question/blueprint/quality/misconception/concept-card models, generation queues, review gates, syllabus governance, quality metrics, admin actions, planner assistant observability, concept-card remediation, variants, and organization AI pools/BYOK.

However, it is not yet fair to call the whole system production-complete. The remaining gap is no longer "nothing exists"; it is mainly "depth, automation, and operational confidence":

- Reviewer/validator depth is still first-generation and only partially domain-specific.
- Planner Assistant is guarded and observable; it now has an optional provider-backed structured suggestion path behind `CSCA_PLANNER_ASSISTANT_AI_ENABLED`, while Rule Guard remains final authority.
- Syllabus governance exists, but source verification/import workflow is still basic.
- Admin governance exists, but needs UI polish, role segmentation, and stronger audit views before high-volume operation.

This audit did run the core DB-backed AI questioning smoke on 2026-06-11:

```text
npm run csca-ai-questioning:smoke
CSCA AI questioning smoke passed.
```

That smoke proves the main platform loop: blueprint coverage, pregeneration, queue processing, candidate review, approval gate, publishing to the adaptive practice pool, adaptive question selection, quality feedback, misconception governance, concept cards, variants, quality replacement, and syllabus-stale filtering.

The smoke and admin operational UI checks have also been promoted into the local verification gate:

```text
npm run verify:csca-ai-questioning
backend build passed.
frontend build passed.
CSCA AI questioning rules passed.
CSCA AI questioning smoke passed.
Admin audit summary check passed.
```

`verify:local` now calls `verify:csca-ai-questioning`, so local release verification covers backend/frontend buildability, the rule-level checks, the DB-backed production loop, and the frontend admin readiness/audit wiring.

## 10-area status matrix

| Area | Current status | Evidence | Remaining work |
| --- | --- | --- | --- |
| 1. AI question production pipeline | Mostly implemented | `AIQuestioningModule`, generator, provider, prompt builder, structured JSON normalization, generation jobs, request hash cache, retry metadata, provider error taxonomy, process/bulk/health endpoints, optional scheduler, DB-backed smoke passed | Add staged scheduler rollout evidence |
| 2. Unified question model | Mostly implemented | `CscaQuestionBlueprint`, `CscaQuestion`, `sourceType`, `blueprintId`, `generatedVariantOf`, `designedDifficulty`, `empiricalDifficulty`, `difficultyConfidence`, `optionMetadata`, `syllabusVersion`; adaptive selection and topic health now treat approved current-syllabus unified-bank questions as practice-ready | Continue legacy import/mapping migration and reduce bridge dependency in reporting |
| 3. Syllabus governance | Mostly implemented | `CscaExamTopic.syllabusVersion/sourceUrl/sourceLabel/lastVerifiedAt/verifiedBy`; stale question report and refresh; topic update preview/apply; verified source/reviewer display in admin UI; planner filters current syllabus AI questions; DB-backed smoke covers stale filtering | Add bulk import/version workflow and richer outdated-topic review screens |
| 4. AI Reviewer + deterministic validator | Partially implemented | reviewer service/provider, validation dimensions, JSON schema guard, duplicate/prompt leakage/explanation conflict/distractor quality, initial math/physics/chem domain sanity checks | Add stronger CAS/unit/chemistry validators, deeper syllabus/out-of-scope classifier, reviewer regression set |
| 5. Option-level misconception metadata | Mostly implemented | `optionMetadata`, distractor intent, misconception tags, merge/migrate tags, orphan/duplicate warnings, auto-upsert from option stats | Add richer authoring UI and feedback-based tag confidence calibration |
| 6. Data feedback for question quality | Mostly implemented | `CscaQuestionQualityMetric`, empirical difficulty, difficulty confidence, option selection stats, needs-review queue, variant effect warnings, high-exposure anomaly monitoring, governance/bulk actions, reviewer assignment/claim workflow, quality trend API/admin view, SLA/escalation counters, reviewer workload ownership grouping, reviewer/reason drill-down filters | Add richer drill-down quality charts and workflow-specific reviewer pages |
| 7. Admin management | Partially to mostly implemented | admin routes for blueprints, generation jobs, questions, syllabus, remediation, misconceptions, quality, concept cards, org AI; frontend admin sections; AI-questioning mutation audit logs | UI is dense; needs information architecture polish, role permissions, and workflow-specific pages |
| 8. Planner Assistant | Mostly implemented | `PlannerAssistantService`, optional provider-backed structured JSON suggestions, rule guard, differences/rejected reasons, training event observability | Needs staged rollout, adoption-rate dashboard, and real provider evaluation data |
| 9. Concept-card and variant loop | Mostly implemented | `CscaConceptCard`, repeated wrong-pattern trigger, completion endpoint/event, misconception-to-card, misconception-to-variant, variant effect observability, weak variant review | Tune trigger thresholds, improve learner UI insertion timing, add review UI for generated variants |
| 10. Organization AI pool and BYOK | Mostly implemented | `Organization`, members, credit pool, provider config, org-first reservation, per-user daily limit, provider routing, admin APIs and UI, AES-GCM storage helper for organization API keys | KMS-backed key management, key rotation workflow, org-level reporting, contract/package model |

## Product loop check

The following product loops are present:

1. Blueprint to generation candidate:
   `CscaQuestionBlueprint -> CscaAiGenerationJob -> QuestionGeneratorProvider -> QuestionReviewer -> CscaQuestion(pending_review/review_failed)`.

2. Candidate to approved practice item:
   `approveQuestion` reruns review gate and marks the unified `CscaQuestion` as approved. A bridge `SpecialPracticeQuestion` can still be created for legacy compatibility, but unified approved questions are now counted as practice-ready in topic health.

3. Adaptive training selection:
   `AdaptiveQuestionProviderService` picks approved current-syllabus `CscaQuestion` first, falls back to mapped `SpecialPracticeQuestion`, and records exposure.

4. Feedback to quality:
   adaptive submit refreshes question quality metrics, empirical difficulty, option stats, and review reasons.

5. Misconception remediation:
   repeated wrong patterns can surface concept cards and variants; admins can create cards/variants from misconception tags.

6. Organization AI usage:
   AI Coach can reserve from an organization pool first and route through organization provider config.

## Important remaining risks

### 1. "Implemented" does not mean "safe to auto-publish"

Generated questions still require human approval. This is correct. The reviewer is a gate, not a replacement for editorial review.

### 2. Domain validation is shallow

The current deterministic validator catches obvious cases, but it is not a complete math solver, unit analysis engine, or chemistry validator. It reduces bad output; it does not prove all generated questions are correct.

### 3. Planner Assistant is AI-assisted only behind a guarded rollout switch

The assistant now supports provider-backed structured suggestions behind `CSCA_PLANNER_ASSISTANT_AI_ENABLED`. This remains deliberately constrained: provider output must be valid JSON, can only work inside the rule planner's candidate topics, and is always passed through Rule Guard before becoming the final plan. Production readiness still depends on staged rollout evidence and adoption/rejection monitoring.

### 4. Legacy and unified question banks coexist

This is acceptable for migration. The adaptive provider already prefers approved current-syllabus `CscaQuestion` rows, and topic health now separates unified-bank readiness from legacy bridge counts. Long term, legacy special-practice questions should either be mapped/imported into the unified bank or treated as historical content.

### 5. Admin UX is operational, not polished

The backend actions are broad, but the admin page is dense. It needs workflow-level pages or tabs before daily operations feel mature.

### 6. BYOK is encrypted locally, but not yet KMS-operated

Organization provider keys now use a shared secret-backed AES-GCM storage format when `CSCA_ORG_LLM_KEY_SECRET`, `AUTH_SECRET`, or `JWT_SECRET` is configured. Legacy `plain:` and `base64:` keys remain readable for migration. A production-grade deployment should still add KMS/HSM-backed envelope encryption, key rotation, and a re-encryption job.

## Next executable plan

### PR A: Put live end-to-end smoke into required verification - done

- Added `npm run verify:csca-ai-questioning`.
- `verify:csca-ai-questioning` runs `backend:build`, `frontend build`, `csca-ai-questioning:rules`, `csca-ai-questioning:smoke`, and `npm --prefix frontend run test:admin-audit-summaries`.
- `verify:local` now includes `verify:csca-ai-questioning`.
- `docs/ops-runbook.md` documents the temporary DB writes, cleanup behavior, and local/disposable database requirement.
- Acceptance: `npm run verify:csca-ai-questioning` passed on 2026-06-12 after adding the frontend admin-audit summary check.

### PR A2: Scheduled AI question production worker - done

- Added `AIQuestioningSchedulerService`, wired into `AIQuestioningModule`.
- Scheduler is environment-gated and defaults off with `CSCA_AI_QUESTIONING_SCHEDULER_ENABLED=false`.
- Each cycle processes queued generation jobs, then runs bounded topic-health backfill for missing blueprints or missing candidates.
- Scheduler does not auto-publish questions; generated candidates still require validator/reviewer/admin approval before learner exposure.
- Added env templates for interval, startup run, process limit, backfill limit, per-topic count, and failed-job retry behavior.
- `docs/ops-runbook.md` now documents enablement, guardrails, monitoring, and rollback.
- Acceptance: backend `tsc --noEmit` and `npm run verify:csca-ai-questioning` passed on 2026-06-11.

### PR A3: Provider error taxonomy and fallback observability - done

- Generator provider HTTP failures are now categorized into auth, timeout, conflict, rate-limited, unavailable, bad-request, or generic HTTP statuses.
- Generator provider exceptions now distinguish timeout, network, and generic provider errors.
- Reviewer provider uses the same taxonomy in reviewer issue codes and provider status.
- Queue generation metadata records `providerStatus`, `providerFailureCategory`, and `fallbackUsed`, so fallback-generated candidates still expose provider instability.
- Question generation metadata records the same provider failure category for later audit and quality review.
- Generation queue health now groups `byProviderFailureCategory` separately from failed-job categories.
- Admin Audit displays provider fallback categories as a read-only queue-health signal.
- Acceptance verified: `node scripts/csca-ai-questioning-rules-test.cjs`, backend `tsc --noEmit`, and `npm --prefix frontend run build` passed on 2026-06-11.

### PR B: Reviewer maturity hardening

- Expand deterministic domain validators.
- Add fixture-based reviewer regression tests for common bad generations.
- Acceptance: invalid answer key, duplicate/equivalent options, prompt leakage, explanation conflicts, out-of-scope topic, wrong unit, and unbalanced equation all fail or require review.

Progress on 2026-06-11:

- Added deterministic physics speed calculation sanity for prompts that provide distance and time.
- Added regression coverage for speed answer-key mismatch.
- Added deterministic physics acceleration sanity for prompts with initial velocity, final velocity, and time, including `m/s^2` and `cm/s^2` equivalent-unit matching.
- Added regression coverage for acceleration answer-key mismatch and equivalent-unit non-regression.
- Added deterministic arithmetic-sequence nth-term sanity for prompts with first term, common difference, and target term.
- Added regression coverage for arithmetic-sequence answer-key mismatch and a matching-answer non-regression case.
- Added deterministic linear-equation sanity for simple `ax + b = c` prompts.
- Added regression coverage for linear-equation answer-key mismatch and a matching-answer non-regression case.
- Added deterministic physics density sanity for mass/volume prompts, including kg/m^3 and g/cm^3 equivalent-unit matching.
- Added regression coverage for density answer-key mismatch and equivalent-unit non-regression.
- Upgraded deterministic chemistry equation balancing to parse parenthesized groups such as `Ca(OH)2`.
- Added regression coverage for unbalanced parenthesized equations and balanced parenthesized non-regression.
- Added a compact Reviewer/Validator gold regression fixture harness covering passable linear-function candidates, answer leakage, explanation-answer conflicts, out-of-scope question type, and weak syllabus-signal review routing.
- `npm run verify:csca-ai-questioning` still passes after the stricter validator.

### PR B2: Question quality feedback hardening

- Add explicit high-exposure anomaly detection to quality feedback.
- Feed anomaly reasons into quality governance grouping and bulk-action recommendations.
- Acceptance: high-exposure abnormal questions enter review, show high severity, and recommend an exposure-reducing disposition before editorial review.

Progress on 2026-06-11:

- Added `high_exposure_anomaly` for questions with at least 80 attempts plus abnormal correct rate, unanswered rate, or dominant distractor signal.
- `reviewReasonForMetric` now returns the anomaly reason so refresh jobs can mark these questions for review.
- `qualitySummary` now exposes the anomaly reason, treats it as high severity, and recommends `reduce_exposure`.
- `summarizeQualityGovernance` groups the anomaly reason and action for admin queues.
- Added `POST /api/v1/admin/ai-questioning/quality/:questionId/assign` so quality-review items can be assigned or claimed instead of remaining an anonymous queue.
- Assignment writes `qualityGovernance.status = assigned`, assignee/assigner ids, timestamp, reason, and note into question review metadata, and keeps approved questions out of the active pool by moving them to `pending_review`.
- The DB-backed smoke now covers assignment metadata after quality review routing.
- Admin Audit now exposes a "Claim review" action for quality items and shows the assigned reviewer metadata inline.
- Added `GET /api/v1/admin/ai-questioning/quality/trend`, aggregating recent AI-backed adaptive attempts by day and subject with attempt count, correct/unanswered rates, review workload, high-severity workload, assigned review count, and regeneration count.
- The trend query covers both directly selected unified-bank questions and approved AI questions published into the special-practice bridge pool.
- DB-backed smoke now verifies the quality trend summary, by-subject grouping, and by-day grouping from seeded adaptive attempts.
- Admin Audit now loads the quality trend API, shows a quality-trend KPI, renders daily AI-question attempt trend, and lists subject-level accuracy/review/high-risk workload.
- Added SLA/escalation counters to quality governance: stale unassigned review items, stale assigned review items, due-soon items, escalation total, and sample overdue question ids.
- Admin Audit now shows SLA pressure in the quality-governance KPI and quality-governance section, so operators can distinguish unclaimed overdue work from assigned-but-stale work.
- Rule tests now cover quality SLA escalation behavior for unassigned overdue, assigned overdue, and due-soon review items.
- Added by-assignee quality governance grouping with an explicit unassigned bucket, needs-review workload, high-risk workload, overdue count, due-soon count, and sample question ids.
- Admin Audit now shows reviewer ownership rows inside the quality-governance section, so the team can see whether review pressure is unassigned or sitting with a specific reviewer.
- Rule tests now cover assigned and unassigned workload grouping in quality governance.
- Quality metric listing now supports filters for assignee, unassigned items, review reason, recommended action, severity, and limit.
- Admin Audit reviewer ownership chips and reason rows now drill the quality list into the matching concrete work items, with a visible filtered-list state and clear-all action.
- Acceptance verified so far: `node scripts/csca-ai-questioning-rules-test.cjs`, backend `tsc --noEmit`, `npm run verify:csca-ai-questioning`, and `npm --prefix frontend run build` passed on 2026-06-11.

### PR C: Admin workflow polish

- Split admin AI governance into clearer sections: production queue, review queue, quality queue, remediation, org AI.
- Add empty/loading/error states and clearer action labels.
- Add mutation audit evidence for production, review, quality, syllabus, remediation, and concept-card governance actions.
- Acceptance: an admin can complete the daily review flow without reading implementation terms, and each high-impact governance action leaves an admin audit event.

Progress on 2026-06-11:

- Added an admin "daily governance order" panel for AI question production.
- The panel prioritizes generation blockers, candidate review, quality review, and misconception remediation using current queue counts.
- Each workflow row reuses existing bulk actions so admins can start the next operational step from one place.
- Added bilingual copy and scoped CSS for the workflow panel.
- AI Questioning controller now records `admin_audit_logs` for key mutation actions: blueprint creation/status/generation, queue processing/retry/bulk actions, pregeneration, topic actions, syllabus apply/refresh, misconception edits/merge/remediation actions, quality refresh/bulk/assignment/disposition, concept-card edits/status changes, and candidate review/approve/reject/archive.
- Audit payloads store compressed result summaries rather than full prompts, explanations, or provider output.
- Acceptance verified so far: backend `tsc --noEmit` and `npm --prefix frontend run build` passed on 2026-06-11.

### PR D: Syllabus governance workflow

- Add admin update/import action for topic source and version fields.
- Add "mark outdated questions for review" action with preview.
- Acceptance: changing a topic syllabus version reliably moves old approved questions out of adaptive eligibility.

Progress on 2026-06-11:

- Added topic-level syllabus update preview and apply services.
- Added admin endpoints:
  - `POST /api/v1/admin/ai-questioning/syllabus-governance/topics/:topicId/preview`
  - `POST /api/v1/admin/ai-questioning/syllabus-governance/topics/:topicId/apply`
- Added bulk syllabus update preview/apply services and admin endpoints:
  - `POST /api/v1/admin/ai-questioning/syllabus-governance/bulk-preview`
  - `POST /api/v1/admin/ai-questioning/syllabus-governance/bulk-apply`
- Apply updates `syllabusVersion`, `sourceUrl`, `sourceLabel`, `lastVerifiedAt`, `verifiedBy`, and topic status.
- Apply marks impacted non-archived questions as needing review when the topic version/status makes them stale.
- `npm run verify:csca-ai-questioning` covers single-topic preview/apply, bulk preview/apply, and stale adaptive filtering.
- Admin Audit now has a topic-level syllabus change form: enter topic id, version, source metadata and status, preview impacted questions, then apply the change.
- The same Admin Audit form now accepts comma/newline-separated bulk topic ids and calls the bulk preview/apply endpoints, showing aggregate impact plus sample topic impact.
- Syllabus governance summary now returns topic title, source URL/label, last verified date, verified-by user id, and verified-by email for affected questions.
- Admin Audit now shows current syllabus-review samples with topic, version transition, source, verification date, verifier, and source link before admins apply new changes.
- `npm --prefix frontend run build` passed after wiring the UI.

### PR E: Real Planner Assistant integration

- Add provider-backed structured Planner Assistant behind feature flag.
- Keep existing Rule Guard as final authority.
- Record suggested vs final plan differences and adoption rate.
- Acceptance: LLM failure or unsafe suggestion cannot block training or override rules.

Progress on 2026-06-11:

- Added `CSCA_PLANNER_ASSISTANT_AI_ENABLED`; default remains off in local and production env examples.
- Added `planner_assistant` structured JSON prompt instructions to the AI Coach provider prompt builder.
- Added provider output validation for planner JSON before the suggestion can be consumed.
- `PlannerAssistantService` now tries the provider only when enabled, preserves the session question language, parses the structured suggestion, then always applies Rule Guard.
- Rule Guard rejects invented topics and unsafe difficulty jumps; missing slots are filled from the rule planner.
- Planner snapshots continue to store provider, status, suggested topics, final topics, differences, and rejected reasons.
- Acceptance verified so far: `node scripts/csca-adaptive-rules-test.cjs` and backend `tsc --noEmit` passed on 2026-06-11.

### PR F: BYOK production key operations

- Move organization API key encryption from shared-secret AES-GCM to KMS/envelope encryption.
- Add key version metadata and a rotate/re-encrypt admin operation.
- Add a release check that blocks active BYOK providers when no production key-management secret is configured.
- Acceptance: raw, `plain:`, and `base64:` legacy values can be migrated; new keys never persist as plaintext; rotation can re-encrypt active provider configs without exposing secrets.

Progress on 2026-06-11:

- Added `backend/src/csca-special-practice/ai-secret-store.ts`.
- New organization API keys are stored as `enc:v1` AES-GCM values whenever a storage secret is configured.
- Legacy `plain:`, `base64:`, and raw values remain readable by runtime routing.
- Admin summaries and audit logs still mask raw provider secrets.
- Added `npm run csca-byok:security`; `verify:security` now includes it.
- `CSCA_BYOK_SECURITY_CHECK_DB=1` enables a read-only release check for active BYOK provider rows and fails if active providers exist without a storage secret.
- `CSCA_BYOK_BLOCK_LEGACY_SECRET_STORAGE=1` can fail release verification when active BYOK providers still use legacy key storage after migration.
- Acceptance verified so far: `node scripts/csca-adaptive-rules-test.cjs` and backend `tsc --noEmit` passed on 2026-06-11.

### PR G: Unified-bank migration hardening

- Make unified `CscaQuestion` approval the main readiness signal for AI-generated practice content.
- Keep the legacy special-practice bridge visible as migration/compatibility evidence, not as the only definition of "published".
- Acceptance: topic health, admin UI, and smoke checks distinguish approved unified-bank practice-ready questions from bridge-published legacy rows.

Progress on 2026-06-11:

- `AIQuestioningService.topicQuestionBankHealth` now counts every approved current topic question as approved/published readiness, while exposing `bridgeQuestionCount` separately for legacy migration tracking.
- Admin Audit topic health rows now show `unified` and `bridge` counts separately, so operators can see whether a topic is ready in the unified bank or only covered through compatibility rows.
- `AdminAIQuestioningTopicHealth` frontend types now include `bridgeQuestionCount`.
- The DB-backed AI questioning smoke now asserts both unified practice readiness and bridge migration tracking.
- Acceptance verified: `npm run verify:csca-ai-questioning` and `npm --prefix frontend run build` passed on 2026-06-11.

## Confirmation against the user's provided checklist

The checklist is directionally right as an architectural target, but it is no longer accurate as a current implementation report. Items 1, 2, 5, 6, 9, and 10 have substantial implementations. Items 3, 4, 7, and 8 are implemented at a first useful level but still need maturity work.

The correct current summary is:

Already available: adaptive training loop, AI Coach, structured explanation, feedback observability, wrong-question review, readiness dashboard, AI question production foundation, unified question bank foundation, review queue, generation queue, quality metrics, misconception governance, concept cards, variants, and organization BYOK/credit-pool foundation.

Still not production-complete: deep domain validation, polished admin workflows, mature syllabus import/version operations, Planner Assistant rollout/adoption monitoring, and KMS-grade key rotation/operations.
