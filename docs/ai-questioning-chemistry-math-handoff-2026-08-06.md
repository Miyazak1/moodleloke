# AI Questioning Chemistry And Math Handoff - 2026-08-06

This document preserves the latest effective handoff context for CSCAlite AI subject-practice question generation. Use current workspace and database state as authoritative before acting. Do not rely on older conversation conclusions that were later revised.

## Current Decision Boundary

Chemistry production is usable for slow backend replenishment and internal acceptance, but it is not a final claim that AI question quality is fully solved.

Math must not inherit the chemistry conclusion automatically. Math has enough basic correctness evidence to continue internal monitoring, but difficulty stability and task-family diversity need dedicated work.

Do not treat provider/key failures as quality governance completion. Extra keys improve throughput; they do not solve task strategy, diversity, or real difficulty alignment.

## Stop Line

Accept and record without deeper repair:

- Provider slowness, key cooldown, occasional timeout, `provider_empty_output`, or `provider_schema_invalid`, as long as jobs retry or recover and students are shielded.
- Slow pool replenishment, because the student side now has a replenishing state.
- Candidate questions blocked by reviewer or gate.
- A small amount of repeated task type, unless the same production cell repeatedly hits the same shell in a short window and gate publishes it.
- P2/P3 audit noise, metadata noise, or copy noise that does not affect scheduling or key quality decisions.
- Runs not reaching full target immediately, as long as open gaps can decline and queued/running states continue to move.

Repair immediately:

- Student-facing error, blank state, generation loop, or stuck post-practice state.
- Incorrect, ambiguous, or explanation-contradictory questions entering the formal published pool.
- Obvious real-difficulty mismatch entering the formal pool, especially one-step items published as hard.
- Queue fake death: queued jobs never start, running jobs never release, stale jobs never recover.
- Multiple jobs running for the same production cell and racing provider or insertion.
- Old `blocked`, `source_profile_missing`, or stale profile states sticking after readiness is restored.
- Reviewer/audit rules that publish bad items or block nearly all good items.
- Runner requiring repeated manual pokes instead of automatic continuation.
- Provider/key errors becoming permanent production blocks.
- New mechanism changes without tests.

## Chemistry State

Latest effective status:

- Chemistry production pipeline is basically working: run creation, topic+difficulty cell replenishment, generation, review, gate, insertion, and status aggregation all run.
- Accuracy is close but still requires manual sampling.
- Diversity has no clear exact-repeat problem, but structural diversity is not final.
- User added a second DeepSeek background key; the environment previously showed `configuredKeys=2` and `enabledKeys=2`.
- User does not want to change key strategy now.

Run #195:

- Last observed state: `running`, `47/50`, `open=3`, `blockedReason=null`.
- Remaining gap is mainly cell #573 hard periodic.
- Recent failures were provider-layer: `provider_empty_output`, `provider_schema_invalid`, `provider_network_error`, `gateway_key_cooldown`, and `gateway_concurrency_timeout`.
- Jobs continued auto-starting. No queue fake death was observed.
- Same-cell concurrency was not observed; only one fresh running job per cell.

Important chemistry question facts:

- Bad question #15346 about NH3/CO2 gas-solid equilibrium compression had an explanation conflict around Q/K and shift direction. It was removed from the pool and validator coverage was strengthened.
- #15521 hard bond/force NaCl/CCl4 question was manually inspected as correct and hard enough.
- #15523 medium halogen trend question was manually inspected as correct and single-answer, but it remained a halogen-displacement shell from old runtime before the latest task-family changes were loaded.
- #15524 was blocked as `subject_practice_task_family_overrepresented`.
- #15525 had a chemistry inference problem, but it stayed `review_failed` and did not enter the formal pool.

## Completed Code Changes

Relevant files:

- `backend/src/ai-questioning/subject-practice-task-family-policy.ts`
- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/question-validator.service.ts`
- `backend/src/ai-questioning/question-prompt-builder.service.ts`
- `scripts/csca-ai-questioning-rules-test.cjs`
- `scripts/csca-subject-practice-production-audit.cjs`

Key completed changes:

- Added structured subject-practice task-family policy with `SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION = 'subject-practice-task-family-policy-v1'`.
- Added chemistry task-family classification and diversity blocking.
- `chemistryProductionTaskFamilyPolicy` now accepts `recentAcceptedScenarioHints` so accepted scenario skeletons influence variant avoidance.
- `subjectPracticeProductionRecentPatternHints(rows)` calls the central task-family classifier.
- Retry feedback includes `taskFamilyPolicy` for hard equilibrium, basic observation, and structured chemistry production policy.
- `max_attempts_exhausted` is classified as failure so stale recovery does not keep burning provider on exhausted jobs.
- Retry feedback is compressed; full audit stays in metadata.
- Gas-solid equilibrium and Unicode subscript validation was strengthened to catch compression/pressure explanation conflicts.
- Fixed `no_dispatchable_cell` mislabeling: when fresh in-flight production work exists, production run status stays or returns to `running` instead of being marked `blocked/no_dispatchable_cell`.

## Validation Already Run

Passed:

```powershell
npm.cmd run csca-ai-questioning:rules
```

Passed from `D:\CODE\CSCAlite\backend`:

```powershell
npm.cmd exec nest build
```

Backend was restarted and health returned OK:

```text
GET /api/v1/health -> status ok
```

Known Windows issue:

```powershell
npm.cmd --prefix backend run build
```

can hit Prisma `EPERM` on `query_engine-windows.dll.node` if the local backend holds the DLL. The script may continue with the existing generated Prisma client. This is a known Windows lock, not necessarily a TypeScript failure.

## Student Experience Layer

The adaptive-practice pool-exhaustion fallback was completed elsewhere.

Behavior:

- Student requests only consume approved and `published_to_subject_practice` questions.
- If no eligible adaptive question is available and generation is disabled for the student request path, backend returns stable code `ADAPTIVE_PRACTICE_POOL_EXHAUSTED`.
- Frontend shows a friendly replenishing state instead of exposing provider/generation internals.
- Background production can continue, but student requests do not synchronously trigger generation.

Do not reimplement this unless current code contradicts the above.

## Useful Commands

Chemistry production snapshot for #195:

```powershell
@'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const run = await prisma.$queryRawUnsafe(`
    SELECT id,status,published_total AS "published",open_total AS "open",
           no_progress_rounds AS "noProgress",blocked_reason_code AS "blockedReason",
           updated_at AS "updatedAt"
    FROM csca_subject_practice_production_runs WHERE id=195
  `);
  const active = await prisma.$queryRawUnsafe(`
    SELECT id,status,prompt_metadata->>'productionCellId' AS "cellId",
           prompt_metadata->>'processingStartedAt' AS "processingStartedAt",
           prompt_metadata->>'failureCategory' AS "failureCategory",
           prompt_metadata->'repairFeedback'->'taskFamilyPolicy'->>'selectedVariant' AS "selectedVariant",
           updated_at AS "updatedAt"
    FROM csca_ai_generation_jobs
    WHERE prompt_metadata->>'productionRunId'='195' AND status IN ('queued','running')
    ORDER BY updated_at DESC, id DESC LIMIT 10
  `);
  const latestJobs = await prisma.$queryRawUnsafe(`
    SELECT id,status,question_id AS "questionId",prompt_metadata->>'productionCellId' AS "cellId",
           prompt_metadata->>'processingStartedAt' AS "processingStartedAt",prompt_metadata->>'failureCategory' AS "failureCategory",
           prompt_metadata->'repairFeedback'->'taskFamilyPolicy'->>'selectedVariant' AS "selectedVariant",
           LEFT(COALESCE(error,''),140) AS "error",updated_at AS "updatedAt"
    FROM csca_ai_generation_jobs
    WHERE prompt_metadata->>'productionRunId'='195'
    ORDER BY updated_at DESC, id DESC LIMIT 12
  `);
  const latestQuestions = await prisma.$queryRawUnsafe(`
    SELECT id,status,designed_difficulty AS "difficulty",generation_metadata->>'productionCellId' AS "cellId",
           LEFT(prompt,220) AS "prompt",correct_answer AS "correctAnswer",
           LEFT(explanation,220) AS "explanation",
           review_metadata->'gate'->>'decision' AS "gateDecision",
           review_metadata->'gate'->'reasons' AS "gateReasons",
           review_metadata->'subjectPracticeAutoApproval'->>'status' AS "autoApprovalStatus",
           updated_at AS "updatedAt"
    FROM csca_questions
    WHERE generation_metadata->>'productionRunId'='195' AND id > 15523
    ORDER BY id DESC LIMIT 12
  `);
  console.log(JSON.stringify({ now:new Date().toISOString(), run, active, latestJobs, latestQuestions }, null, 2));
})().finally(() => prisma.$disconnect());
'@ | node -
```

Chemistry audit:

```powershell
npm.cmd run csca-ai-questioning:subject-production-audit -- --subject=chemistry --run=195 --sample=30 --days=1
```

Math audit:

```powershell
npm.cmd run csca-ai-questioning:subject-production-audit -- --subject=math --sample=40 --days=30
```

## Math Assessment

Math should be monitored and optimized separately. It cannot inherit the chemistry acceptance conclusion.

Evidence gathered:

- Recent math production runs:
  - #159 completed `4/4`.
  - #158 completed `4/4`.
  - #156 completed `30/30`.
  - #157 and #135 were blocked mainly by `subject_auto_production_disabled`.
- Math audit for #159 had no automated P0/P1.
- Diversity output for math was effectively all `other`, which means the system currently cannot see math task families well.
- In the last 30 days, math had approved questions, but also many `pending_review`, `archived`, and `review_failed` candidates.

Manual sample observations:

- #10753 hard spatial geometry concept judgement: answer correct, but real difficulty is closer to medium than hard. Similar shell to #10707.
- #10754 medium arithmetic sequence from `S3/S6` solving `a1,d`: answer correct, but same shell as #10874.
- #10755 medium mean-after-removal calculation: answer correct, but real difficulty is basic.
- #10766 medium cuboid point-to-plane distance: answer correct and medium reasonable, though reading load is high.
- #10874 medium arithmetic sequence two-condition solve: answer correct, repeated shell with #10754.
- #10875 medium quadratic-function properties: answer correct and medium acceptable.
- #10711 hard ellipse/hyperbola shared-focus relation: good hard item.
- #10712 hard `x^y=y^x` and `ln t/t` monotonicity: good hard item.
- #10713 derivative tangent constraint: correct, hard/medium boundary acceptable.
- #10715 complex modulus/vector dot product: correct, but may be medium rather than hard.
- #10714 geometric sequence `a3/S3` solve `q`: correct, but may be medium rather than hard.
- #10708 probability multi-event relation: good hard item.
- #10706 combined variance: good hard item.
- #10703 function parity/monotonicity proposition: should be treated carefully; statement semantics may be fragile.
- #10696 normal distribution z-value reverse solve: good hard item.

Math risk profile:

- Accuracy has a foundation but needs continued manual sampling.
- Difficulty stability is not yet strong.
- Hard items sometimes collapse into concept judgement or one/two-step formula tasks.
- Medium items sometimes collapse into basic tasks.
- Diversity is weak because math task families are not visible to current classifier/audit.

## Recommended Math Next Steps

Do not start by changing key strategy or adding more prompt bans.

Recommended order:

1. Add a math task-family classifier and audit coverage first.
2. Use existing approved samples as static regression fixtures.
3. Extend diversity audit so math is no longer mostly `other`.
4. Add math difficulty rubric signals.
5. Only after the system can see families, connect math policy to retry feedback/gate.
6. Run a small-budget math production run and manually inspect newly published questions.

Candidate math task families:

- `quadratic_function_properties`
- `function_parity_monotonicity_statement`
- `arithmetic_sequence_two_condition_solve_a1_d`
- `geometric_sequence_two_condition_solve_q`
- `spatial_line_plane_concept_judgement`
- `coordinate_geometry_point_to_plane_distance`
- `mean_removed_value`
- `combined_variance`
- `probability_multi_event_counting`
- `conic_shared_focus_relation`
- `derivative_tangent_constraint`
- `normal_distribution_z_reverse_solve`

Candidate math difficulty rules:

- Hard should require multi-step constraints, hidden conditions, parameter or structural reasoning, case classification, or proof-like judgment.
- A single concept judgement should not publish as hard unless it has genuinely subtle quantifiers/counterexamples and reviewer evidence names them.
- Medium should require at least two reasoning moves or one non-direct transformation.
- One-formula or one-property recall should be basic.

## Current Answer Boundary

If asked whether math is currently enough:

Math has a usable correctness foundation for internal monitoring, but it is not fully accepted. The main missing pieces are math task-family visibility, difficulty evidence, and diversity governance. It should be monitored and optimized like chemistry, but with math-specific families and rubrics.
