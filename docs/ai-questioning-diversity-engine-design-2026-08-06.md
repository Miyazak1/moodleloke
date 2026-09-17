# AI Questioning Diversity Engine Design - 2026-08-06

This document records the proposed mechanism for improving AI-generated question diversity in CSCAlite. It is based on recent chemistry production acceptance work, the first math assessment, and coordination with task `019fd60f-a504-78b2-9afa-6b4b2f2179f4`.

The design target is all three current core subjects: chemistry, math, and physics.

## Executive Summary

CSCAlite should not keep relying mainly on prompt instructions and reviewer regex patches to make AI-generated questions diverse.

The recommended direction is a lightweight structured diversity engine:

```text
TaskFamily classifier
  -> QuestionFingerprint
  -> DiversityWindow
  -> SchedulerHint
  -> reviewer/gate feedback memory
```

The goal is to make question shells visible, measurable, and schedulable. The first version should be engineering-simple, not a large ML system.

The engine should be shared across subjects, but the subject strategy must be isolated. The shared layer should not know what "arithmetic sequence", "gas-solid equilibrium", or "Kirchhoff circuit" means. It should only know that a task family and fingerprint are overrepresented or underrepresented in a recent window.

Product boundary: this design does not add a required human-review workflow. The formal production path remains automatic generation -> reviewer/validator/gate -> approved/published. Quality-audit ledger entries, offline sampling evidence, and sampled calibration notes are R&D/operations acceptance evidence only; they must not be required for ordinary student-pool publication, and they must not create a reviewer-permission product surface by default.

## Current State

Chemistry already has an early task-family governance layer:

- Recent pattern hints.
- Accepted scenario hints.
- Task-family policy.
- `subject_practice_task_family_overrepresented` gate.
- Partial audit visibility for chemistry families.
- Retry feedback that can tell generation to avoid recent shells.

Math is not at the same stage:

- Math audit and metadata still show many `other` families.
- `taskFamilyPolicy` has been absent or incomplete for many math questions.
- Existing math validation mainly checks selected answer correctness for some simple formula families.
- It does not yet reliably identify repeated shells such as arithmetic-sequence two-condition solving, spatial concept judgement, direct variance formula, or function-property judgement.

Therefore, chemistry is around an early structured-family stage, while math still needs family visibility and difficulty-rubric work.

Physics has not yet had the same focused assessment. It should be treated as a first-class target for visibility, not as an afterthought. Without a physics family catalog, a three-subject diversity engine would likely leave physics as mostly `other`, especially for graph, circuit, force-diagram, and experiment-style items.

## Why Prompt-Only Diversity Fails

Prompt text such as "make the question diverse" is not enough because:

- The model can change numbers and names while preserving the same underlying task shell.
- The reviewer may see the answer is correct but miss short-window family repetition.
- Embedding similarity can miss structurally identical questions written differently.
- Long retry feedback increases prompt thickness and can reduce generation quality.
- Repetition is cell-local: the same family may be acceptable globally but overrepresented in one `subject + topic + difficulty` cell.

The system needs a structured memory of what it has recently published and rejected.

## Core Abstractions

### 1. TaskFamily

`TaskFamily` is the stable question-shell label. It should describe the solving structure, not surface wording.

Examples:

- `arithmetic_sequence_two_condition_solve_a1_d`
- `geometric_sequence_two_condition_solve_q`
- `quadratic_function_properties`
- `spatial_line_plane_concept_judgement`
- `halogen_displacement_plus_periodic_trend`
- `equilibrium_q_or_k_shift_judgement`
- `organic_combustion_unsaturation_functional_group_inference`

### 2. QuestionFingerprint

`QuestionFingerprint` is a structured signature for each candidate or published question.

MVP fields:

```json
{
  "subject": "math",
  "topicId": 632,
  "difficulty": "medium",
  "taskFamily": "arithmetic_sequence_two_condition_solve_a1_d",
  "reasoningPath": ["translate_conditions", "solve_linear_system", "compute_term"],
  "representationType": "equation",
  "quantitativeShape": "multi_step",
  "answerForm": "numeric",
  "objects": ["arithmetic_sequence", "S3", "S6", "a4"],
  "subjectExtension": {
    "sequenceType": "arithmetic",
    "requestedQuantity": "a4"
  },
  "policyVersion": "subject-practice-diversity-v1"
}
```

Later fields can include:

- `distractorShape`
- `caseSystem`
- `canonicalPromptSkeleton`
- `canonicalOptionSkeleton`
- `canonicalExplanationSkeleton`
- `fingerprintHash`

Do not require the first version to perfectly fill every field.

Fingerprint field inference must keep provenance boundaries explicit. `taskFamily`, objects, and subject extensions may use the prompt, options, and explanation because the explanation can expose the actual reasoning shell. Presentation fields must not: infer `representationType` from the prompt and options, and infer `answerForm` primarily from the prompt plus option shape. Explanation text such as `A is correct`, `reason`, or `therefore` must not turn a multiple-choice item into `equation` or `explanation`. Any change to these inference rules must bump the fingerprint policy version so stored metadata remains replayable instead of being silently reinterpreted.

`representationType` should support at least:

- `text`
- `equation`
- `table`
- `graph`
- `diagram`
- `circuit`
- `experiment`

`quantitativeShape` should support at least:

- `direct_formula`
- `multi_step`
- `parameter_constraint`
- `comparison`
- `proof_like`

`answerForm` should support at least:

- `numeric`
- `expression`
- `option_judgement`
- `ranking`
- `explanation`

`subjectExtension` is the subject-specific container:

- Chemistry: reactions, species, phases, condition changes, observable phenomena.
- Math: functions, sequence type, geometry objects, probability model, statistic type.
- Physics: physical model, graph type, circuit topology, conserved quantity, experimental apparatus.

### 3. DiversityWindow

`DiversityWindow` is the recent history for a production cell.

Recommended key:

```text
subject + topicId + difficulty + productionCellId
```

Typical metrics:

- family counts in the latest N accepted/published questions.
- consecutive same-family count.
- consecutive same-reasoning-path count.
- hard-window family coverage.
- accepted versus rejected family trend.

MVP caps:

- Latest 5 accepted/published questions: the same family should not exceed 2.
- Do not publish consecutive questions with the same family and same reasoning path.
- Hard windows should not be dominated by one simple family.

### 4. SchedulerHint

`SchedulerHint` is a compact instruction generated before candidate creation.

Example:

```json
{
  "preferredFamily": "probability_multi_event_counting",
  "avoidFamilies": ["arithmetic_sequence_two_condition_solve_a1_d"],
  "reasoningPathHint": "combine two event counts before comparing options",
  "policyVersion": "subject-practice-diversity-v1"
}
```

The prompt should receive short structured hints, not a long growing list of previous failures.

## Recommended Algorithm

```text
1. Build cell diversity window from recent accepted/published questions.
2. Classify recent rejected candidates separately.
3. Score available families for the target topic and difficulty.
4. Select preferred family:
   - prioritize low coverage;
   - avoid overrepresented family;
   - avoid recently rejected family only when rejection was quality-related;
   - never let provider/schema failures poison family memory.
5. Generate candidate with SchedulerHint.
6. Classify candidate and build fingerprint.
7. Run diversity gate:
   - reject/regenerate if over cap;
   - warn if near cap;
   - pass if fresh enough.
8. Run existing reviewer/domain gate.
9. Publish only if both quality and diversity pass.
10. Store fingerprint and decision metadata for audit and future scheduling.
```

## Recommended Rollout

### Phase 1: Three-Subject Visibility Only

Goal: make question shells visible in audit.

Implement or expand:

- subject-specific `TaskFamily` classifiers.
- lightweight `QuestionFingerprint` derived at review/audit time.
- audit output for family distribution, known/other coverage ratio, repeated shells, `other` topic/difficulty clusters, and a small set of `other` samples for classifier gap triage.
- static fixtures for known chemistry, math, and physics samples.

Do not aggressively block in this phase except for existing proven blockers.

Success in this phase means that math and physics no longer appear as broad `other` buckets in audit, while chemistry audit behavior remains stable.

For math, be careful when reducing `other`: the central classifier is already consumed by production diversity checks. New math families should first appear as audit-only `otherFamilySuggestions` with `productionImpact: none_audit_only`; promote them into the central classifier only after a dry-run shows the coverage gain and any soft-cap impact are acceptable.

The math promotion dry-run should report `baseKnownFamilyCount`, `promotedKnownFamilyCount`, `coverageGainCount`, base vs promoted `wouldRegenerate` counts, `incrementalWouldRegenerateCount`, and sample incremental signals. A suggested family should not be promoted if most of its added visibility immediately becomes noisy soft-cap pressure or if it would create topic starvation.

Initial promoted math families after zero-increment/no-new-blocking dry-runs and direct `other` sample triage: `interval_set_operation_solution`, `elementary_function_exp_log_ordering`, `vector_coordinate_norm_dot_angle`, `inequality_order_property_counterexample`, `spatial_vector_angle_cosine`, `logarithmic_equation_domain_solution`, and `complex_conjugate_linear_equation_solve`. Existing families such as `coordinate_geometry_point_to_plane_distance` and `probability_multi_event_counting` should also be broadened narrowly when real `other` samples are only wording variants. They improve visibility only; do not add them to hard/medium difficulty blocker sets until separate difficulty evidence justifies that.

Classifier visibility and window governance are separate promotion steps. Every classified family should report a machine-readable window scope: `legacy_gated` for families already covered by the current diversity window, `classifier_visible_audit_only` for newly promoted math visibility families, `fallback_other` for unknown/other, and `ungated` for known families that have not entered window governance. Audit output should include this scope in `familyCoverage.familyWindowScopes` and promotion dry-runs. This prevents a scheduler-visible family from being mistaken for an active soft-cap family, and it prevents Phase 1 classifier work from silently expanding production blocking.

### Phase 2: Math Governance And Soft Caps

Goal: prevent obvious short-window repetition without starving cells.

Add:

- warning-level diversity decisions.
- same-family short-window caps.
- same-reasoning-path consecutive cap.
- `subject_practice_task_family_overrepresented` style reasons.

Use cap or regenerate, not permanent hard banning.

Math should be first because its observed risks are strongest: hard items can be too simple, medium items can be basic, and repeated shells are currently under-visible.

Implementation boundary: the first Phase 2 step should expose a shared `DiversityWindow` evaluator and audit-visible `pass/warn/regenerate` decisions. Latest-window and reasoning-path caps may be reported before they expand production blocking. Existing production block behavior should stay limited to the already-proven overrepresentation condition until isolation smoke and offline sampling evidence show the soft-cap signal is precise enough.

When production soft caps are introduced, start with a default-off math-only feature flag such as `CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED`. With the flag disabled, the production gate should keep the legacy overrepresentation behavior. With the flag enabled, only math candidates may convert the calibrated latest-window family cap, `task_family_recent_window_cap`, into a regenerate decision. Keep `reasoning_path_repeated` audit-only until the reasoning-path fingerprint is more specific; early dry-run evidence shows it can be too broad. Chemistry and physics remain isolated until their own audit samples justify activation.

Before enabling the flag, run an audit-only dry-run that replays recent formal math questions against their prior same-topic+difficulty window. The report should show `auditSignalCount`, `wouldRegenerateIfFlagEnabled`, legacy-covered count, incremental count, reason counts, and sample question ids. Do not enable the production flag if the dry-run suggests broad topic starvation or mostly harmless repetition.

The audit should also emit a `calibration` block with a machine-readable recommendation. It must state that provider/schema/key failures are excluded from family quality memory, identify the student-consumable scope used for the replay, list incremental samples that would be newly regenerated, and return `do_not_enable_until_incremental_samples_reviewed` whenever any incremental production soft-cap hit lacks offline sampling evidence. The same block should surface near-duplicate corroboration for each incremental sample when available, so quality-audit sampling can distinguish likely true-positive repeated shells from broad family-cap false positives. This keeps Phase 2 default-off until the specific added blockers have offline audit coverage.

The production approval path should also write a shadow `review_metadata.subjectPracticeDiversityObservation` for math production-cell candidates. This observation must be computed from the same helper used by the production block, include `productionAction`, `wouldRegenerateIfFlagEnabled`, `featureFlagEnabled`, `productionDecisionScope`, provider-failure policy, and student-consumable scope, and stay `observe_only` while the flag is disabled. This gives Phase 2 real-candidate evidence without changing the publish gate.

The audit should additionally replay current math production candidates in `draft`, `pending_review`, and `review_failed` status against the recent formal-published math window. This candidate replay is read-only and should report `candidateCount`, `evaluatedCount`, `wouldRegenerateIfFlagEnabledCount`, `currentFlagRegenerateCount`, and sample decisions. With the default-off flag, `currentFlagRegenerateCount` must remain zero even when `wouldRegenerateIfFlagEnabledCount` is non-zero.

If candidate replay shows that at least half of evaluated candidates would regenerate under the flag, readiness should surface `phase_2_math_candidate_replay_guardrail=observe_before_flag_enable`. This is not a production failure while `currentFlagRegenerateCount=0`; it means do not turn the flag on yet. First use scheduler hints and repair feedback to rotate candidates toward lower-coverage families, then rerun the smoke.

Scheduler hints should include current math candidate-family pressure as well as recent accepted coverage. A family that is already repeated in `draft`, `pending_review`, or `review_failed` candidates for the same production cell should be eligible for `avoidFamilies`, and the hint reason should show `low_coverage_math_family_with_candidate_pressure`. This remains prompt guidance only; it must not change publish decisions while the soft-cap flag is disabled.

After readiness reports `eligible_for_guarded_default_off_smoke`, run the dedicated read-only smoke before any flag change:

```powershell
npm.cmd run csca-ai-questioning:math-diversity-soft-cap-smoke -- --chemistry-run=195
```

This smoke must fail unless math Phase 1 visibility is ready, math soft-cap calibration has zero unreviewed incremental samples, the math soft-cap feature flag remains disabled, scheduler and near-duplicate evidence remain audit-only, the student-consumable/current-policy boundary has no visible blocker, chemistry regression is protected, and physics visibility is still ready. Passing this smoke means the system is eligible for a small default-off observation run; it does not authorize turning the flag on broadly.

### Phase 3: Chemistry Regression Protection And Incremental Expansion

Goal: keep chemistry stable while the shared engine grows.

Add:

- chemistry isolation smoke for every math or physics blocker change, using the latest active chemistry run as the operational baseline and a recent completed run as historical regression evidence.
- a few missing chemistry family fixtures only when current audit evidence shows a real repeated shell.
- no broad rewrite of chemistry prompt policy while #195-style production remains provider-bound.

### Phase 4: Physics Visibility And Fixtures

Goal: make physics graph/circuit/force/experiment shells visible before applying blockers.

Add:

- first physics family catalog.
- physics task-family fixtures.
- physics difficulty-rubric fixtures.
- audit output for physics family distribution.

Do not attach physics blockers until sampled evidence shows repeated shells or real-difficulty mismatch in formal published items.

Physics readiness should distinguish visibility from governance. `phase_4_physics_visibility` may be `ready` when the family classifier covers the recent window, but direct-formula hard items must still surface in a separate audit-only `phase_4_physics_difficulty_watch`. When visible P2 physics findings exist, report `quality_sampling_required` with counts for `physics_hard_direct_formula_task_family` and adaptive-visible findings. This must not create current-policy blockers in Phase 4; it is the evidence queue for deciding whether physics needs a later subject-specific difficulty gate.

Once all sampled physics difficulty-watch findings have offline quality-audit evidence, report `quality_sampling_complete_with_findings` or `quality_sampling_complete_no_confirmed_issue` instead of keeping the phase in progress. This completion status still has `productionImpact: none_audit_only`; it only says the current audit sample is calibrated enough to inform a later physics-specific rubric or scheduler pass.

The physics offline quality-audit summary should also emit machine-readable `nextActions`, `enablementGuardrails`, and `hardRubricCalibration`. `physics_hard_rubric_calibration` means draft a subject-specific hard rubric before any blocking. `hardRubricCalibration` should remain `productionImpact: none_audit_only`, list true-positive high-risk families, list false-positive acceptable direct-formula families, and publish the minimum hard-evidence requirements: multi-step model construction, nontrivial constraint combination, direction/sign reasoning, graph or experiment interpretation beyond one read, or cross-topic energy/momentum/field/circuit reasoning. A direct-formula physics family is only an audit warning until a later physics-specific feature flag and pool-impact smoke prove that blocking will not empty student-consumable cells. `physics_visual_remediation_backlog` means rewrite or regenerate text-incomplete visual items before enabling visual current-policy isolation. `physics_current_policy_keep_isolated` means deterministic model errors should remain filtered. These actions are recommendations, not scheduler or publish-gate inputs, unless a later phase adds a subject-specific feature flag and pool-impact smoke.

Deterministic physics correctness or usability errors are different from P2 difficulty watch signals. A published item whose physical model contradicts its requested quantity, such as a horizontal electric field with horizontal initial velocity and no vertical force source while asking for vertical deflection, may enter `subjectPracticeCurrentPolicyBlockReasons` immediately under a physics-owned reason such as `physics_field_deflection_axis_conflict`. A physics item that explicitly depends on an unattached figure, for example `如图所示` or `shown in the figure` in the current text-only subject-practice schema, should first surface as an audit/offline-sampling signal. Student-side isolation under `unbacked_visual_reference` must stay behind `CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED` until a pool-impact dry-run proves it will not empty topic+difficulty cells. This is not a physics difficulty gate and must not imply that all `physics_hard_direct_formula_task_family` findings are blocked. Readiness should report how many physics difficulty findings remain adaptive-visible and how many are current-policy isolated.

### Phase 5: Generation-Time Scheduling

Goal: stop asking the model to "be diverse" and instead tell it what family to generate.

Add:

- low-coverage family selection.
- `preferredFamily` and `avoidFamilies` in retry feedback / prompt metadata.
- family rotation after repeated quality rejections.

Keep the prompt compact.

Implementation boundary: start with a compact `SchedulerHint` object in `repairFeedback`, not a new queue scheduler. The first enabled subject should be math only, using recent accepted family coverage to choose one low-coverage `preferredFamily` and a short `avoidFamilies` list. Chemistry and physics should remain scheduler-hint disabled until isolation and audit sampling justify enabling them. Provider/key failures must not affect preferred-family selection.

The audit should include a scheduler-hint dry-run before any stronger scheduling change. It should replay recent formal published math questions by topic+difficulty, emit the `preferredFamily`, `avoidFamilies`, scheduler policy version, and explicitly mark `productionImpact: none_audit_only`. The replay must state that provider failures are not used as scheduler evidence; only student-consumable accepted/published family coverage should influence the hint.

Scheduler pools must be narrower than broad production prompt targets. For example, a derivative topic must not recommend a generic quadratic-function family, an inequality topic must not recommend derivative families, spatial geometry must not recommend plane-circle shells, and plane analytic geometry must not recommend point-to-plane distance. `avoidFamilies` must also exclude the selected `preferredFamily`; otherwise the prompt receives contradictory scheduler guidance.

The audit should also report scheduler-hint adherence for current math production candidates that actually carry a stored `schedulerHint`. This is an observation metric only: count hinted candidates, compare the classified candidate family with `preferredFamily`, report avoided-family hits, and mark `productionImpact: none_audit_only`. Missing adherence samples should be `pending_observation`, not a failure, because existing candidates may have been generated before scheduler hints were stored. Provider failures must not emit adherence samples.

Scheduler hints must also expose the target-profile fields that constrain the selected shell. In particular, `targetProfileQuestionForm`, `targetProfileCalculationLoad`, and a machine-readable `targetProfileConstraintPressure` should be stored with the hint. For math, a medium `concept_judgement`/`concept_check` profile with `calculationLoad=heavy` is an internally over-constrained surface contract: normalize it to `calculationLoad=medium` before generation while preserving medium difficulty and multi-step reasoning. This normalization is math-only and must not change chemistry or physics profiles.

Scheduler-hint adherence samples should also support audit-only offline quality sampling in `docs/ai-questioning-diversity-quality-audit-ledger-2026-08-07.json` with `reviewType: math_scheduler_hint_observation_sample`. A positive scheduler sample may still be gate-held or pending automatic gate resolution; that is evidence that the diversity mechanism selected the intended family, not evidence that the candidate should publish. Readiness should distinguish mechanism-positive audit evidence and gate-held evidence from production approval.

### Phase 6: Near-Duplicate Fallback

Goal: catch surface near-duplicates that fingerprints miss.

Add:

- audit-only prompt/option/explanation skeleton similarity.
- a stable `fingerprint_near_duplicate` warning reason.
- nearest-question id, similarity score, shared-family flag, and policy version in audit JSON.
- similarity source fields such as `token_jaccard` or `expression_signature`, plus component scores.
- optional embedding checks only after the rule-based signal is stable.

Implementation boundary: Phase 6 should start without a vector database. Use deterministic text skeleton normalization and fingerprint-scoped similarity first, with `pass/warn` decisions only. It must not publish-block, modify current-policy, or update family memory. Candidate comparison should require same subject and either the same task family or the same topic+difficulty. Embedding should remain a later offline audit or fallback scorer, not the primary diversity algorithm.

For math and physics, include a narrow expression-signature fallback in the audit signal: if two questions share the same normalized function, equation, or direct formula expression inside the same family/window, mark `fingerprint_near_duplicate`. This is still audit-only; formula-template repetition should feed scheduler/rubric work before it becomes any production blocker.

Audit should also aggregate repeated near-duplicate signals into non-blocking recommendations such as `scheduler_rotate_expression_template` or `review_repeated_prompt_shell`. These recommendations are evidence for later scheduler tuning only and must stay `productionImpact: none_audit_only` until a dry-run shows low false positives and a subject-specific feature flag is enabled.

The near-duplicate audit should emit a calibration block similar to the math soft-cap calibration. It must include the evaluated formal-published count, signal count and ratio, max similarity, source breakdown, family breakdown, comparison scope, `other` fallback policy, provider-failure policy, student-consumable scope, `productionImpact: none_audit_only`, and `currentPolicyImpact: none`. This proves Phase 6 is adding observability and scheduler evidence only, not a hidden publish gate.

### Phase 7: Scoring Or Bandit

Only after enough production events exist, add coverage and quality scoring:

- family success rate.
- rejection rate by family.
- average reviewer score by family.
- recent coverage deficit.
- provider failure excluded from quality score.

This is not MVP.

## Cross-Subject Versus Subject-Specific Layers

Cross-subject generic layer:

- public interfaces for classifier, fingerprint builder, window evaluator, scheduler hint builder, and diversity event recorder.
- fingerprint schema.
- diversity window computation.
- cap/quota algorithm.
- scheduler hint protocol.
- gate decision format.
- audit output format.
- policy versioning.
- feature flags.

Subject-specific strategy layer:

- family catalog.
- classifier rules.
- difficulty rubric.
- family allowed for topic/difficulty.
- family-specific prompt hint.
- family-specific banned shortcut.
- subject-specific validation rules.

Keep subject isolation strict. A math policy update must not change chemistry behavior.

Recommended stable shared interfaces:

```ts
classifyTaskFamily(question, context): TaskFamilyResult
buildQuestionFingerprint(question, classification): QuestionFingerprint
evaluateDiversityWindow(cell, fingerprint, recentItems): DiversityDecision
buildSchedulerHint(cell, memory, target): SchedulerHint
evaluateNearDuplicate(candidate, recentItems): NearDuplicateSignal
recordDiversityEvent(candidate, decision, policyVersion): void
auditDiversity(subject, window): DiversityAuditReport
```

The shared engine should call these interfaces; it should not import subject-specific rule internals directly.

### Target Profile Compatibility Boundary

`SchedulerHint` may narrow a compatible family choice, but it must never override the immutable syllabus topic or force a task shape that contradicts `targetProfile`. Add a shared pre-prompt resolver with a subject-owned compatibility matrix:

```ts
resolveTargetProfileCompatibility({
  subject,
  topic,
  targetProfile,
  preferredFamily,
  syllabusScope
}): TargetProfileCompatibilityResult
```

The result should preserve the requested profile, record normalized fields and explicit adjustments, expose `compatible | adjusted | incompatible`, and return a bounded fallback family when the preferred family is incompatible. Subject strategy libraries own allowed `questionForm + cognitiveSkill + calculationLoad + difficulty + taskFamily` combinations; the shared engine only applies the result and records the audit trace.

This resolver runs before prompt construction and scheduler-hint persistence. It must prevent contradictions such as a concept-judgement target paired with a calculation-heavy family, or a non-numeric hard experimental chemistry target paired with a mandatory quantitative cue. `incompatible` should yield to another compatible family or an observe-only diagnostic, not hard-ban the whole cell. Readiness should aggregate adjustment and incompatibility counts by subject/topic/profile so repeated normalization pressure becomes visible without silently changing published history.

Generation-profile readiness failures are separate from provider delivery failures. `generation_profile_missing`, `generation_profile_stale`, `generation_profile_source_snapshot_stale`, and `generation_profile_syllabus_snapshot_stale` should be classified explicitly, excluded from provider retry loops, and recovered through profile refresh/run readiness logic. They must not be stored as family rejection evidence.

## Chemistry Strategy Notes

Chemistry already has early family handling. Continue toward a cleaner strategy library rather than expanding prompt bans.

Important chemistry families include:

- halogen displacement plus periodic trend.
- metal activity plus oxide acidity/basicity.
- Q/K or reaction quotient equilibrium judgement.
- gas-solid equilibrium pressure shift.
- ion identification with interference control.
- gas preparation or impurity control.
- chemical-bond or intermolecular-force data anomaly.
- laboratory heating-failure diagnosis, multi-operation error diagnosis, and waste-mixing hazard evidence chains.
- notation families that distinguish direct formula identification, ionic-species splitting, balanced evidence chains, and redox-equation evidence.
- controlled-variable reaction-rate families for temperature, concentration, surface area, catalyst, reactant nature, and competing-factor indeterminacy.

Chemistry-specific risks:

- explanation contradicts equilibrium direction.
- gas/solid phase handling mistakes.
- Unicode subscript and phase parsing.
- inorganic facts that look plausible but are false.
- overusing halogen displacement shells.
- broad chemistry regexes leaking periodic, bond, or laboratory labels into an incompatible syllabus topic.

Chemistry classification must therefore be topic-compatible, not only subject-compatible. The fingerprint and recent-cell memory should resolve `topicTitle` from the stored target profile first and fall back to the immutable syllabus scope. A known family that conflicts with the resolved chemistry topic domain must become `other` with an auditable incompatibility reason; legacy pattern aliases must pass the same compatibility check before entering accepted/rejected memory.

Hard experimental chemistry is a non-numeric hard archetype when `questionForm=experimental_judgement` and `calculationLoad=none`. Its difficulty evidence should be two linked observations plus a competing hypothesis, interference, reagent-order, or controlled-variable elimination. Retry feedback must not simultaneously require a calculation cue, and the hard-shape gate must not treat every experimental form as one-step merely because no numeric calculation is present. The ordinary difficulty reviewer still has to infer `hard`; this compatibility rule does not promote medium observation questions.

## Math Strategy Notes

Math needs family visibility and difficulty governance first.

Recommended first math families:

- `arithmetic_sequence_two_condition_solve_a1_d`
- `geometric_sequence_two_condition_solve_q`
- `quadratic_function_properties`
- `function_parity_monotonicity_statement`
- `spatial_line_plane_concept_judgement`
- `spatial_coordinate_direct_metric`
- `coordinate_geometry_point_to_plane_distance`
- `mean_removed_value`
- `direct_variance_formula`
- `combined_variance`
- `finite_set_cardinality_complement`
- `probability_multi_event_counting`
- `conic_shared_focus_relation`
- `derivative_tangent_constraint`
- `derivative_direct_evaluation`
- `normal_distribution_z_score_probability`

Math difficulty rubric:

- Hard should require multi-step constraints, hidden conditions, parameter or structural reasoning, case classification, proof-like judgement, or combined counting.
- A single concept judgement should not publish as hard unless it has genuinely subtle quantifiers or counterexamples and reviewer evidence names them.
- Medium should require at least two reasoning moves or one non-direct condition transformation.
- One-formula, one-property, or one-step recall should be basic.

Observed math risks:

- hard spatial concept judgement published as hard.
- medium direct average or variance formula published as medium.
- repeated arithmetic-sequence two-condition shells.
- repeated function property judgement shells.
- fragile statement semantics in parity/monotonicity items.

## Physics Strategy Notes

Physics needs first-pass family visibility before any blocking policy. Many physics repetitions are not text-near-duplicates: the same `v-t` graph area task, the same inclined-plane force balance, or the same series/parallel reduction can appear with different numbers and wording.

Recommended first physics families:

- `kinematics_constant_acceleration_direct`
- `kinematics_motion_graph_interpretation`
- `projectile_motion_component_solve`
- `relative_motion_frame_transform`
- `newton_force_equilibrium_diagram`
- `newton_inclined_plane_friction`
- `newton_connected_bodies_tension`
- `circular_motion_centripetal_force`
- `work_energy_conservation`
- `work_energy_nonconservative_loss`
- `momentum_impulse_conservation`
- `momentum_collision_1d_2d`
- `circuit_ohm_kirchhoff_resistor_network`
- `circuit_power_internal_resistance`
- `electrostatics_field_potential_force`
- `magnetism_lorentz_force_motion`
- `electromagnetic_induction_flux_lenz`
- `waves_optics_interference_refraction`
- `experiment_graph_slope_intercept`
- `measurement_uncertainty_significant_figures`

Phase 1 visibility can also include these high-frequency physics shells when audit evidence shows they are common in the formal pool:

- `kinematics_displacement_velocity_scalar_vector_concept`
- `thermodynamics_ideal_gas_state_process`
- `thermodynamics_first_law_heat_work`
- `newton_static_kinetic_friction_transition`
- `newton_action_reaction_balance_concept`
- `optics_interference_diffraction_pattern`
- `optics_polarization_malus_law`
- `optics_wave_particle_evidence_judgement`
- `photoelectric_effect_threshold_energy`
- `nuclear_mass_defect_energy_release`
- `nuclear_decay_alpha_beta_half_life_concept`
- `charge_conservation_electrostatic_induction_concept`
- `coulomb_law_direct_calculation`
- `uniform_electric_field_potential_relation`
- `ampere_force_direct_calculation`
- `mechanical_wave_basic_relation`
- `mechanical_wave_phase_state_judgement`
- `mechanical_wave_equation_phase_calculation`
- `simple_harmonic_motion_basic_quantity`
- `magnetism_charged_particle_helical_motion`
- `atomic_energy_level_spectrum_transition`
- `atomic_structure_ground_excited_ionization_concept`
- `kinetic_molecular_temperature_energy_motion`
- `kinetic_molecular_gas_pressure_micro_model`

Latest physics `other` triage added these narrow visibility families from real 30-day formal samples:

- `nuclear_isotope_nucleon_composition_concept`
- `nuclear_reaction_charge_mass_conservation`
- `kinetic_molecular_force_potential_graph`
- `kinetic_molecular_size_density_avogadro_estimation`
- `kinetic_molecular_rms_speed_calculation`
- `optics_diffraction_grating_order_angle`

These are still visibility families. They should not create current-policy blockers until a separate physics sampling pass shows formal published quality or difficulty failures that need enforcement.

Physics difficulty rubric:

- Basic: one formula, one concept, one graph read, or direct unit conversion.
- Medium: two physical relations must be linked, or the student must select a model before calculating.
- Hard: multi-stage process, limiting condition, conservation plus dynamics coupling, graph/experiment data modeling, parameter reasoning, piecewise cases, or explicit vector decomposition.
- Hard forbidden shortcuts: only constant-acceleration substitution, direct Ohm-law substitution, one energy-conservation equation, or one graph slope/area read.

Physics-specific risks:

- graph slope/area tasks repeated with changed labels.
- circuit topology changes that are only numeric surface changes.
- hard dynamics questions that are only one free-body diagram plus one equation.
- experiment items whose graph slope/intercept meaning is underspecified.
- vector direction/sign errors in electric/magnetic force and potential-energy explanations.

## Metadata And Storage

MVP should avoid new large tables.

Prefer existing metadata:

- candidate/question: `generation_metadata.questionFingerprint`
- candidate/question: `generation_metadata.taskFamilyPolicy`
- job: `prompt_metadata.repairFeedback.taskFamilyPolicy`
- review/gate: `review_metadata.gate.reasons`
- review/gate: `review_metadata.diversity`
- policy version: included in fingerprint and gate decision
- audit: recompute and compare against stored metadata

After MVP stabilizes, consider an event table:

```text
subject_practice_diversity_events
  questionId
  generationJobId
  productionRunId
  productionCellId
  subject
  topicId
  difficulty
  taskFamily
  fingerprintHash
  decision
  reasons
  policyVersion
  createdAt
```

Prefer event history over mutable opaque cell memory. Memory can be derived from events, replayed, and audited.

## Gate Semantics

Diversity should produce explicit decisions:

- `pass`
- `warn`
- `regenerate`
- `block_current_policy`

Suggested reason codes:

- `task_family_overrepresented`
- `reasoning_path_repeated`
- `fingerprint_near_duplicate`
- `hard_simple_task_family`
- `medium_basic_task_family`
- `scheduler_family_exhausted`

Provider failures must not become diversity failures.

Distinguish these three publishing states:

- candidate accepted by generator/reviewer.
- formal published to subject practice.
- student-consumable under current policy.

Diversity windows for scheduling should generally use formal published and current-policy-consumable items. The primary accepted-family window is scoped to the same `subject + topic + difficulty`; sibling production cells from another difficulty must not be presented as accepted evidence for the current cell. Rejected candidate memory should only include quality or diversity rejections, not provider/schema/timeouts.

Recent rejected families are rotation and cooldown evidence, not a blanket hard-ban list. The scheduler may prefer an under-covered compatible family, but when a narrow topic has exhausted its known families it must be allowed to reuse the least-recent family while changing scenario, reasoning path, misconception set, and answer skeleton. Exact overrepresentation remains a separate sliding-window decision with policy version and feature-flag scope.

## Current-Policy Isolation

Every subject-specific blocker must have an explicit subject guard.

Required guardrails:

- Math blocker changes must not create chemistry or physics current-policy blockers.
- Physics blocker changes must not create chemistry or math current-policy blockers.
- Chemistry blocker changes must not create math or physics current-policy blockers.
- Shared engine changes must be able to run in audit-only mode per subject.

Every subject policy change should report:

- sampled count by subject.
- `blockedByCurrentPolicy` by subject.
- newly blocked question ids.
- whether each newly blocked id is caused by the edited subject policy.

For chemistry, keep a dedicated isolation check against both the latest active production run and a recent completed run such as #195. A completed historical run proves regression stability but does not prove that the current runner has no stale work. A math or physics change should prove chemistry remains either `blockedByCurrentPolicy=0` or only blocked by chemistry-owned policy reasons.

### Published Profile Immutability

A production cell profile may be normalized or replanned for future candidates, but a formal published question remains bound to the target profile and policy evidence it passed at publication time. A later cell change in `questionForm`, `cognitiveSkill`, `readingLoad`, or `calculationLoad` must not by itself trigger retrospective archival.

Published revalidation may still run for a real review-gate policy version change, difficulty-evidence policy version change, generation-lineage mismatch, or deterministic current-policy correctness blocker. During that revalidation, use the question's stored generation target profile first. Cell replanning is a forward-generation contract, not a bulk retirement command.

If a policy change accidentally reduces the formal pool, stop the runner, identify the exact affected ids, and restore only samples whose answer, explanation, difficulty, and student-consumable boundaries still pass offline quality audit. Keep genuine difficulty drift archived and record the remediation evidence.

## Student-Consumable Accounting

Do not collapse question lifecycle states into one count.

Track these states separately:

- `generated`: model produced a candidate.
- `accepted`: candidate passed generator normalization and entered review.
- `formal_published`: question was approved and published to subject practice.
- `adaptive_eligible`: question is selectable for adaptive practice.
- `student_consumable`: question passes current policy, version governance, use-case, mock/fallback exclusion, and frontend eligibility.

Audit and scheduler reports should label which state they are using. A completed production run is not enough evidence that students can consume those questions.

Recommended defaults:

- Diversity scheduling window: use `formal_published` plus current-policy eligibility when available.
- Student pool health: use `student_consumable`.
- Candidate-family rejection analysis: use only quality/diversity rejections, not provider failures.

## Provider Failure Memory Exclusion

Provider-layer failures must not poison family memory.

Exclude these from rejected-family quality memory:

- `provider_empty_output`
- `provider_timeout`
- `provider_schema_invalid`
- `provider_network_error`
- `provider_rate_limited`
- `provider_unavailable`
- `provider_quota_exceeded`
- `gateway_key_cooldown`
- `gateway_concurrency_timeout`
- `gateway_key_concurrency_saturated`
- `gateway_key_rate_limited`
- `gateway_no_key_available`
- `gateway_unknown_error`
- `no_key_available`

These failures can appear in provider/key observability, scheduler-hint delivery evidence, and short operational cooldowns for observation runs. They should not reduce a family quality score, update rejected-family memory, create a current-policy blocker, or count as scheduler adherence. The same family may be perfectly valid once the provider returns a real candidate.

Math observation execution follows the later backend-owned durable-task design in `subject-practice-observation-backend-owned-execution-architecture-assessment-2026-08-10.md`. It does not require chemistry to become fully idle. The singleton backend submits the one-job observation through the same background FIFO semaphore and key pool, so existing chemistry calls are not interrupted and total concurrency is not exceeded. While the observation holds one background slot, chemistry and other background work may temporarily lose that slot; readiness must report this bounded throughput impact honestly. Capacity wait remains operational evidence, not provider-health or family-quality memory.

An HTTP 200 response with no final `message.content` is still a delivery failure, not proof that the provider account or key is unavailable. The OpenAI-compatible adapter should accept standard string content and text-part arrays, and should record bounded diagnostics such as `finish_reason` and the presence/length of reasoning-only output. Reasoning content must never be treated as the publishable final answer. These diagnostics distinguish output-budget/schema-shape problems from balance, authentication, key-pool, and concurrency problems without storing chain-of-thought in diversity memory.

`provider_empty_output` should use the gateway's existing bounded retry budget for question generation. It must not create a separate unbounded retry loop or a family-quality penalty. With more than one healthy key, normal key-pool scoring may rotate the retry away from the failed attempt; with one key, the same global attempt cap still applies.

Only these should affect family memory:

- reviewer/gate quality rejection.
- domain validator failure.
- diversity overrepresentation.
- difficulty-rubric mismatch.
- current-policy blocker.

## Feature Flags And Policy Versioning

The engine should be controlled per subject and per phase.

Example flags:

```text
diversityEngine.enabled
diversityEngine.chemistry.enabled
diversityEngine.math.enabled
diversityEngine.physics.enabled
diversityEngine.chemistry.visibilityOnly
diversityEngine.math.visibilityOnly
diversityEngine.physics.visibilityOnly
diversityEngine.scheduler.enabled
```

Every stored fingerprint, scheduler hint, diversity decision, gate reason, and audit report should include policy version.

Suggested version fields:

- `fingerprintPolicyVersion`
- `taskFamilyPolicyVersion`
- `diversityWindowPolicyVersion`
- `schedulerPolicyVersion`
- `gatePolicyVersion`

Policy versioning is required for replay, regression comparison, and rollback.

## Rollback Strategy

The first implementation must be reversible without data surgery.

Rollback levels:

1. Subject audit-only:
   - keep classification and audit.
   - disable gate blocking and scheduler hints.

2. Subject diversity disabled:
   - stop classifier/gate from influencing production.
   - leave stored metadata for audit.

3. Scheduler disabled:
   - keep reviewer/gate.
   - stop generation-time family selection.

4. Current-policy blocker disabled:
   - stop hiding newly identified blocker class from student pool.
   - use only if a blocker misfires and no bad content risk remains.

Rollback triggers:

- subject pool drops unexpectedly.
- production cell cannot dispatch because caps are too strict.
- offline quality sampling shows a false-positive blocker.
- chemistry #195-style production state regresses after math/physics changes.
- the latest active chemistry run develops stale jobs, count drift, or loses formal published questions after a shared-engine/profile change.
- student-consumable count diverges from formal published count without expected current-policy reason.

Prefer lowering to audit-only over deleting metadata.

## Test And Acceptance Matrix

Minimum tests before enabling blocking:

Classifier fixtures:

- chemistry known samples classify into expected families.
- math known samples classify into expected families.
- physics known samples classify into expected families.
- unknown or ambiguous samples fall back to `other` without blocking.

Difficulty rubric fixtures:

- math hard-simple samples are detected.
- physics direct-formula hard samples are detected.
- chemistry known equilibrium-direction conflicts remain blocked.
- valid hard samples are not downgraded by simple surface cues.

Isolation smoke:

- math policy changes do not create chemistry blockers.
- physics policy changes do not create chemistry or math blockers.
- chemistry policy changes do not create math or physics blockers.
- backend-owned math observation does not interrupt fresh chemistry work, never exceeds shared background capacity, and starts at most one job through the singleton FIFO gateway path.

Provider boundary:

- provider failures are counted as provider/key issues.
- provider failures do not enter rejected-family quality memory.
- scheduler does not avoid a family because of provider empty output.

Scheduler safety:

- caps cannot make a cell permanently undispatchable when eligible families exist.
- when all preferred families are capped, scheduler can relax to warning or rotate to fallback.
- prompt hint size stays bounded.

Student pool:

- current-policy blocked items are not student-consumable.
- formal published count and student-consumable count are reported separately.
- pool exhaustion still returns the replenishing state rather than provider internals.
- cell profile replanning does not retrospectively archive already-published questions solely because profile fields changed.

## Pitfalls To Avoid

- Do not use embedding as the primary duplicate detector.
- Do not require a vector database for MVP; reserve an optional embedding adapter behind the near-duplicate interface.
- Do not hard-ban too many families; use caps, cooldowns, and scheduling.
- Do not let prompt feedback grow without bound.
- Keep full retry feedback in audit/replay metadata, but send the provider only one bounded projection. Within that budget, subject/difficulty contracts and scheduler/task-family requirements outrank generic diversity narration; do not duplicate the raw feedback inside both `constraints.expansion` and the provider-facing repair block.
- Do not let rejected provider/schema failures poison family memory.
- Do not mix scheduler policy version, classifier policy version, and gate policy version.
- Do not let math rules affect chemistry.
- Do not let physics graph/circuit rules affect math or chemistry.
- Do not let a future-cell target-profile normalization become a retrospective published-pool retirement rule.
- Do not rely only on run completion; inspect published pool and student-consumable eligibility.
- Do not mix candidate accepted, formal published, and student-consumable counts in one metric.
- Do not treat all repeated family appearances as bad; the issue is short-window overrepresentation and same-shell repetition.
- Do not build a complex bandit before enough production data exists.

## MVP Acceptance Criteria

Phase 1 can be considered successful when:

- Math audit no longer reports most sampled items as `other`.
- Physics audit no longer reports most sampled graph/circuit/force/experiment items as `other`.
- Known sample questions classify into expected families.
- Chemistry audit behavior does not regress.
- No new student-visible behavior changes.

Phase 2 can be considered successful when:

- Same-cell short-window repeated family is visible and can be warned or regenerated.
- Approved/published pool avoids obvious repeated shells.
- Provider/key errors remain classified as provider boundary, not quality or diversity failure.
- The dedicated math soft-cap smoke passes while `CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED` remains disabled.

Phase 3 can be considered successful when:

- The latest active chemistry audit/runner state and a recent completed chemistry run are both stable after math/physics policy work.
- Chemistry published pool has no new current-policy blocker created by shared engine changes.

Phase 5 can be considered successful when:

- Retry feedback contains compact scheduler hints.
- New generated candidates shift toward low-coverage families.
- Prompt size does not grow materially across retries.
- Offline quality sampling confirms no increase in wrong-answer rate; this is acceptance evidence, not a production human-review step.

Phase 6 can be considered successful when:

- Audit output identifies same-shell near duplicates with changed numbers.
- The signal remains subject-isolated and does not warn on `other` fallback families.
- No production gate, current-policy helper, student-consumable query, or provider-failure memory changes are introduced by near-duplicate work.

The audit readiness summary should also report the student-consumable/current-policy boundary. For math, historical formal-published difficulty findings may remain in the database, but readiness must distinguish `adaptive_candidate_visible_after_current_policy_filter` from the formal-published window. A finding that is blocked by current policy is a protected legacy item, not a student-visible failure.

Math soft-cap readiness should not depend on chat memory. When the audit reports incremental soft-cap samples that would be newly affected by `CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED`, offline quality-audit examples must be recorded in `docs/ai-questioning-diversity-quality-audit-ledger-2026-08-07.json`.

The ledger is offline audit-only evidence, not a production review queue. Its top-level evidence array should be `samples`; older `reviews` arrays may be read only as a compatibility fallback. Each sample must include `subject`, `reviewType`, `questionId`, `nearestQuestionId`, `decision`, `reviewedAt`, and concise evidence fields such as `taskFamily`, `nearDuplicateSimilarity`, `nearDuplicateSource`, and the core repeated structure. The `reviewType` and `reviewedAt` names are legacy field names for audit sample classification and timestamping; they must not imply a production human-review workflow. Audit readiness may move from `calibrated_default_off_quality_audit_required` to `eligible_for_guarded_default_off_smoke` when all incremental samples in the current window have quality-audit sampling coverage, but this still does not enable the production flag.

Provider/key failures, schema invalid output, timeout, and empty output must never be added to this ledger as family-quality evidence. The ledger records offline quality-audit diversity observations for formal published samples only.

For staged rollout checks, use the audit's readiness-only mode instead of manually extracting JSON fields:

```powershell
npm.cmd run --silent csca-ai-questioning:subject-diversity-readiness -- --chemistry-run=195
npm.cmd run csca-ai-questioning:diversity-ledger-smoke
npm.cmd run --silent csca-ai-questioning:subject-production-audit -- --subject=math --sample=40 --days=30 --readiness
npm.cmd run --silent csca-ai-questioning:subject-production-audit -- --subject=physics --sample=40 --days=30 --readiness
npm.cmd run --silent csca-ai-questioning:subject-production-audit -- --subject=chemistry --run=<latest-active-chemistry-run-id> --sample=30 --days=1 --readiness
npm.cmd run csca-ai-questioning:math-diversity-soft-cap-smoke -- --chemistry-run=<latest-active-chemistry-run-id>
npm.cmd run csca-ai-questioning:math-diversity-observation-preflight -- --json --base-url=http://127.0.0.1:3000
npm.cmd run csca-ai-questioning:subject-diversity-rollout-gate -- --chemistry-run=<latest-active-chemistry-run-id>
npm.cmd run backend:dev:observation -- --port=3001
npm.cmd run csca-ai-questioning:math-diversity-observation-preflight -- --json --base-url=http://127.0.0.1:3001
npm.cmd run csca-ai-questioning:math-diversity-observation-run -- --apply --confirm-math-diversity-observation-run --wait --json --run=156 --cell=350 --timeout-ms=900000
npm.cmd run csca-ai-questioning:math-diversity-observation-evidence -- --task=<taskId> --json
```

Use the three-subject command as the first readiness gate; use the single-subject commands when a phase needs drill-down evidence. The rollout gate aggregates quality-audit ledger validation, readiness, math guarded smoke, current-policy isolation/pool impact, physics visual-policy flag-on pool-impact dry-run, and math observation preflight into one read-only decision. It may return `passed_with_operational_wait` for operational cooldown or capacity conditions; that is not a diversity failure and should not update family memory. If the physics visual flag-on dry-run would empty cells, the rollout gate should emit a guardrail warning and keep `CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED` disabled; that warning is not permission to enable the flag. Run the ordinary-backend math observation preflight after the guarded smoke and before any small default-off math observation run; `ready_after_observation_only_backend_start` means the normal backend is healthy but the isolated validation backend still needs to be started. A live apply pass requires a temporary backend with `SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE=true`, a `3001` preflight status of `eligible_for_backend_owned_observation_submission`, and a fresh explicit one-task authorization. The apply command submits at most one durable backend-owned observation task against existing math run `#156/#350`; it does not create another duplicate run, enable math soft-cap blockers, or bypass the backend gateway. Fresh chemistry work is reported as a bounded throughput-sharing warning, not an idle-capacity prerequisite. The CLI wrapper defaults to dry-run and must never instantiate a standalone provider.

Recent provider/schema failures remain delivery diagnostics and may be surfaced in observation status, but they do not make a funded/configured provider globally unavailable and do not enter family memory. Observation submission is instead bounded by the durable-task global/subject cooldown, singleton readiness, and background/key capacity checks. Any capacity timeout or delivery failure ends the one-job task with delivery evidence; it must not update diversity memory, family scores, current-policy blockers, or scheduler avoid lists.

When a failed provider job already contains a stored `schedulerHint`, report it separately as scheduler-hint delivery evidence. It is not an adherence sample because no candidate was produced, and it must not count as a family-quality rejection. Adherence starts only at candidate generation.

## Explanation For Leadership

The goal is not to keep tuning prompts. The goal is to add a question-type scheduling layer.

Simple explanation:

```text
First, the system identifies what type of question each AI item really is.
Then it tracks what types were recently published in each topic and difficulty.
Before generating the next question, it chooses an underrepresented type.
After review, the result feeds back into the scheduler.
```

This turns diversity from a prompt wish into a measurable engineering mechanism.

The approach is:

- visible: every question has a family and fingerprint;
- controllable: each cell has caps and quotas;
- auditable: every reject or publish decision has a reason;
- extensible: chemistry, math, and physics can share the engine while keeping subject-specific strategy libraries;
- safe: student-facing practice remains protected by the replenishing state.
