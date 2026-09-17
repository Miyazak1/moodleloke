require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { readFileSync: readFileSyncRaw } = require('node:fs');
const { resolve } = require('node:path');
const { AiGatewayConcurrencyService } = require('../backend/src/ai-gateway/ai-gateway-concurrency.service');
const { AiGatewayKeyPoolService } = require('../backend/src/ai-gateway/ai-gateway-key-pool.service');

function readFileSync(...args) {
  const value = readFileSyncRaw(...args);
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, got ${actual}.`);
}

const root = resolve(__dirname, '..');
const service = readFileSync(resolve(root, 'backend/src/ai-questioning/ai-questioning.service.ts'), 'utf8');
const controller = readFileSync(resolve(root, 'backend/src/ai-questioning/ai-questioning.controller.ts'), 'utf8');
const generatorProvider = readFileSync(resolve(root, 'backend/src/ai-questioning/question-generator-provider.service.ts'), 'utf8');
const migration = readFileSync(resolve(root, 'backend/prisma/migrations/0070_subject_practice_observation_tasks/migration.sql'), 'utf8');
const cli = readFileSync(resolve(root, 'scripts/csca-subject-practice-math-diversity-observation-run.cjs'), 'utf8');
const oneShotHarness = readFileSync(resolve(root, 'scripts/csca-subject-practice-math-one-shot-harness.cjs'), 'utf8');
const boundedMathFamilyValidation = readFileSync(resolve(root, 'scripts/csca-subject-practice-math-bounded-family-validation.cjs'), 'utf8');
const observationScorecard = readFileSync(resolve(root, 'scripts/csca-subject-practice-observation-scorecard.cjs'), 'utf8');
const observationFailureClassification = readFileSync(resolve(root, 'scripts/lib/subject-practice-observation-failure-classification.cjs'), 'utf8');
const validationProtocolSource = readFileSync(resolve(root, 'scripts/lib/subject-practice-validation-protocol.cjs'), 'utf8');
const guardedMathFamilySelector = readFileSync(resolve(root, 'scripts/csca-subject-practice-math-guarded-family-selector.cjs'), 'utf8');
const evidenceCli = readFileSync(resolve(root, 'scripts/csca-subject-practice-observation-evidence.cjs'), 'utf8');
const preflight = readFileSync(resolve(root, 'scripts/csca-subject-practice-diversity-observation-preflight.cjs'), 'utf8');
const mathPostfixEfficiencyGateSource = readFileSync(resolve(root, 'scripts/csca-subject-practice-math-postfix-efficiency-gate.cjs'), 'utf8');
const envExample = readFileSync(resolve(root, '.env.example'), 'utf8');
const packageSource = readFileSync(resolve(root, 'package.json'), 'utf8');
const startObservationBackendDevSource = readFileSync(resolve(root, 'scripts/start-observation-backend-dev.cjs'), 'utf8');
const localShadowThreeSubjectRunSource = readFileSync(resolve(root, 'scripts/csca-subject-practice-local-shadow-three-subject-run.cjs'), 'utf8');
const localShadowFamilyQualificationRunSource = readFileSync(resolve(root, 'scripts/csca-subject-practice-local-shadow-family-qualification-run.cjs'), 'utf8');
const observationScopeBindingPolicySource = readFileSync(resolve(root, 'backend/src/ai-questioning/subject-practice-observation-scope-binding-policy.ts'), 'utf8');
const observationBatchManifestPolicySource = readFileSync(resolve(root, 'backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy.ts'), 'utf8');
const subjectPracticeFixedEvalSource = readFileSync(resolve(root, 'scripts/csca-subject-practice-fixed-eval.cjs'), 'utf8');
const subjectPracticeNoProviderAcceptanceSource = readFileSync(resolve(root, 'scripts/csca-subject-practice-no-provider-acceptance.cjs'), 'utf8');
const mathObservationCompletionGateSource = readFileSync(resolve(root, 'scripts/csca-subject-practice-math-observation-completion-gate.cjs'), 'utf8');
const observationStatusDoc = readFileSync(resolve(root, 'docs/subject-practice-observation-execution-status-2026-08-11.md'), 'utf8');
const observationArchitectureDoc = readFileSync(resolve(root, 'docs/subject-practice-observation-backend-owned-execution-architecture-assessment-2026-08-10.md'), 'utf8');
const questionPlanExecutablePlanDoc = readFileSync(resolve(root, 'docs/ai-questioning-question-plan-evidence-slots-executable-plan-2026-08-10.md'), 'utf8');

assert(
  envExample.includes('SUBJECT_PRACTICE_OBSERVATION_TASK_ENABLED="false"')
    && envExample.includes('SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ENABLED="false"')
    && envExample.includes('SUBJECT_PRACTICE_OBSERVATION_SINGLETON_CONFIRMED="false"')
    && envExample.includes('SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE="false"'),
  'Observation submit, execution, singleton, and observation-only isolation flags must default off.'
);
assert(
  packageSource.includes('"backend:dev:observation": "node scripts/start-observation-backend-dev.cjs"')
    && packageSource.includes('"backend:dev:observation:local-shadow": "node scripts/start-observation-backend-dev.cjs --local-shadow-qualification"')
    && startObservationBackendDevSource.includes("CSCA_OBSERVATION_BACKEND_PORT || '3001'")
    && startObservationBackendDevSource.includes("SUBJECT_PRACTICE_OBSERVATION_TASK_ENABLED: 'true'")
    && startObservationBackendDevSource.includes("SUBJECT_PRACTICE_OBSERVATION_EXECUTION_ENABLED: 'true'")
    && startObservationBackendDevSource.includes("SUBJECT_PRACTICE_OBSERVATION_SINGLETON_CONFIRMED: 'true'")
    && startObservationBackendDevSource.includes("SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE: 'true'")
    && startObservationBackendDevSource.includes("hasFlag('enable-question-plan')")
    && startObservationBackendDevSource.includes("hasFlag('enable-local-generator-shadow')")
    && startObservationBackendDevSource.includes("hasFlag('local-shadow-qualification')")
    && startObservationBackendDevSource.includes('--local-shadow-qualification requires --question-plan-cell-allowlist=<exact cell id list>')
    && startObservationBackendDevSource.includes("argValue('cell-allowlist'")
    && startObservationBackendDevSource.includes('CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED')
    && startObservationBackendDevSource.includes('CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST')
    && startObservationBackendDevSource.includes('ordinary subject-practice production and predictive runners stay disabled')
    && !startObservationBackendDevSource.includes('/api/v1/admin/ai-questioning/subject-practice-observation-tasks')
    && !startObservationBackendDevSource.includes('--confirm-math-diversity-observation-run')
    && !startObservationBackendDevSource.includes('createStandaloneAiGatewayService'),
  'Observation backend helper must start only an isolated backend process with observation flags; it must not submit tasks or construct a standalone provider.'
);
assert(
  localShadowFamilyQualificationRunSource.includes('backend:dev:observation:local-shadow')
    && localShadowFamilyQualificationRunSource.includes('--question-plan-cell-allowlist=${productionCellId}'),
  'Local shadow family apply failures must provide the exact safe one-command observation backend startup mode.'
);
assert(
  packageSource.includes('"csca-ai-questioning:local-shadow-three-subject-run": "node scripts/csca-subject-practice-local-shadow-three-subject-run.cjs"')
    && localShadowThreeSubjectRunSource.includes("hasFlag('confirm-zero-provider-shadow-batch')")
    && localShadowThreeSubjectRunSource.includes("argValue('confirm-plan-digest')")
    && localShadowThreeSubjectRunSource.includes("providerAttemptLimit: 0")
    && localShadowThreeSubjectRunSource.includes("maximumEstimatedCostUsd: 0")
    && localShadowThreeSubjectRunSource.includes("suppressStudentPublication: true")
    && localShadowThreeSubjectRunSource.includes("if (!apply)")
    && !localShadowThreeSubjectRunSource.includes('subjectPracticeObservationRuntimeProbe')
    && !localShadowThreeSubjectRunSource.includes('createStandaloneAiGatewayService'),
  'Local shadow three-subject runner must default to preview and require an exact digest before serial zero-Provider observation submissions.'
);
assert(
  packageSource.includes('"csca-ai-questioning:local-shadow-family-qualification-run": "node scripts/csca-subject-practice-local-shadow-family-qualification-run.cjs"')
    && localShadowFamilyQualificationRunSource.includes("hasFlag('confirm-zero-provider-qualification-batch')")
    && localShadowFamilyQualificationRunSource.includes("argValue('confirm-batch-id')")
    && localShadowFamilyQualificationRunSource.includes("argValue('confirm-plan-digest')")
    && localShadowFamilyQualificationRunSource.includes("status: 'not_executed_authorization_mismatch'")
    && localShadowFamilyQualificationRunSource.includes("executionStarted: false")
    && localShadowFamilyQualificationRunSource.includes("observationTasksCreated: 0")
    && localShadowFamilyQualificationRunSource.includes("candidatesWritten: 0")
    && localShadowFamilyQualificationRunSource.includes("String(SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.minimumRealShadowCasesPerScope)")
    && localShadowFamilyQualificationRunSource.includes("failurePolicy: 'strictly_serial_continue_after_ordinary_quality_failure_pause_after_three_identical_systemic_failures'")
    && localShadowFamilyQualificationRunSource.includes('providerAttemptLimit: 0')
    && localShadowFamilyQualificationRunSource.includes('maximumEstimatedCostUsd: 0')
    && localShadowFamilyQualificationRunSource.includes('suppressStudentPublication: true')
    && !localShadowFamilyQualificationRunSource.includes('createStandaloneAiGatewayService'),
  'Family qualification runner must bind both batch id and plan digest, report stale authorization as not executed, remain zero-Provider, and continue terminal failures into the denominator.'
);
assert(
  observationScopeBindingPolicySource.includes('subjectPracticeProductionShadowScopeContractFor')
    && observationScopeBindingPolicySource.includes('independentOfPriorCandidateSuccess: true')
    && service.includes('subjectPracticeObservationScopeBindingFor')
    && service.includes('subjectPracticeObservationQuestionPlanRotationInputFor(submissionScopeBinding)')
    && service.includes('observationSubmissionPlanPolicyVersion')
    && service.includes('observation_scope_binding_snapshot_mismatch')
    && service.includes('sealedExecutionScopeBinding.rotation'),
  'Every local qualification task must rebuild its exact scope from the sealed manifest instead of depending on prior candidate success.'
);
assert(
  packageSource.includes('"csca-ai-questioning:subject-practice-no-provider-acceptance": "node scripts/csca-subject-practice-no-provider-acceptance.cjs"')
    && packageSource.includes('"csca-ai-questioning:subject-practice-completion-gate": "node scripts/csca-subject-practice-no-provider-acceptance.cjs --require-complete"')
    && packageSource.includes('"csca-ai-questioning:math-observation-completion-gate": "node scripts/csca-subject-practice-math-observation-completion-gate.cjs"')
    && packageSource.includes('"csca-ai-questioning:math-postfix-efficiency-gate": "node scripts/csca-subject-practice-math-postfix-efficiency-gate.cjs"')
    && packageSource.includes('"csca-ai-questioning:subject-practice-fixed-eval": "node scripts/csca-subject-practice-fixed-eval.cjs"')
    && subjectPracticeFixedEvalSource.includes("mode: 'subject_practice_fixed_eval'")
    && subjectPracticeFixedEvalSource.includes("scope: 'fixture_and_static_subject_practice_quality_eval'")
    && subjectPracticeFixedEvalSource.includes("providerImpact: 'none_no_provider_call'")
    && subjectPracticeFixedEvalSource.includes("dbImpact: 'none_fixture_only'")
    && subjectPracticeFixedEvalSource.includes("observationImpact: 'none_no_observation_task_submission'")
    && subjectPracticeFixedEvalSource.includes("studentConsumableImpact: 'none_does_not_publish_or_reclassify'")
    && subjectPracticeFixedEvalSource.includes('csca-question-plan-no-provider-acceptance.cjs')
    && subjectPracticeFixedEvalSource.includes('csca-subject-practice-production-audit.cjs')
    && subjectPracticeFixedEvalSource.includes('--self-test-profile-difficulty-patch-evidence')
    && subjectPracticeFixedEvalSource.includes("label: 'task_family_fingerprint_fixed_eval'")
    && subjectPracticeFixedEvalSource.includes('subjectPracticeBuildQuestionFingerprint')
    && subjectPracticeFixedEvalSource.includes('subjectPracticeClassifyTaskFamily')
    && subjectPracticeFixedEvalSource.includes('subjectPracticeNearDuplicateSignal')
    && subjectPracticeFixedEvalSource.includes('subjectPracticeMathDifficultyAudit')
    && subjectPracticeFixedEvalSource.includes('subjectPracticePhysicsDifficultyAudit')
    && subjectPracticeFixedEvalSource.includes('math_sequence_two_condition')
    && subjectPracticeFixedEvalSource.includes('physics_kinematics_direct_formula')
    && subjectPracticeFixedEvalSource.includes('chemistry_gas_limewater')
    && subjectPracticeFixedEvalSource.includes('math_must_not_claim_chemistry_gas_family')
    && subjectPracticeFixedEvalSource.includes('subject_practice_task_family_topic_incompatible')
    && subjectPracticeFixedEvalSource.includes('unbacked_visual_reference')
    && subjectPracticeFixedEvalSource.includes('fingerprint_near_duplicate')
    && subjectPracticeFixedEvalSource.includes("label: 'question_plan_fixed_eval'")
    && subjectPracticeFixedEvalSource.includes("label: 'profile_difficulty_patch_fixed_eval'")
    && subjectPracticeFixedEvalSource.includes('math-logarithmic-domain-difficulty-evidence-patch-v1')
    && subjectPracticeFixedEvalSource.includes('math-exp-log-ordering-difficulty-evidence-patch-v1')
    && subjectPracticeNoProviderAcceptanceSource.includes('csca-subject-practice-fixed-eval.cjs')
    && subjectPracticeNoProviderAcceptanceSource.includes('csca-subject-practice-next-action.cjs')
    && subjectPracticeNoProviderAcceptanceSource.includes("label: 'subject_practice_fixed_eval'")
    && subjectPracticeNoProviderAcceptanceSource.includes("label: 'subject_practice_next_action_throughput'")
    && subjectPracticeNoProviderAcceptanceSource.includes('fixedEval.taskFamilyFingerprint?.status')
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'task_family_fingerprint_fixed_eval_visible'")
    && subjectPracticeNoProviderAcceptanceSource.includes('fixedEval.profileDifficultyPatch?.status')
    && subjectPracticeNoProviderAcceptanceSource.includes('csca-subject-practice-observation-task-rules-test.cjs')
    && subjectPracticeNoProviderAcceptanceSource.includes('csca-subject-practice-diversity-observation-preflight.cjs')
    && subjectPracticeNoProviderAcceptanceSource.includes('csca-subject-practice-observation-evidence.cjs')
    && subjectPracticeNoProviderAcceptanceSource.includes('function runMathExactCellPreview')
    && subjectPracticeNoProviderAcceptanceSource.includes('csca-subject-practice-exact-cell-enqueue.cjs')
    && subjectPracticeNoProviderAcceptanceSource.includes("label: 'math_exact_cell_enqueue_preview'")
    && subjectPracticeNoProviderAcceptanceSource.includes('questionPlanPreviewSource: questionPlanPreview.source')
    && subjectPracticeNoProviderAcceptanceSource.includes('schedulerHint: questionPlanPreview.schedulerHint')
    && subjectPracticeNoProviderAcceptanceSource.includes("const requestedMathObservationCellId = Number(argValue('math-observation-cell', String(mathBasicFunctionCellId))) || mathBasicFunctionCellId")
    && subjectPracticeNoProviderAcceptanceSource.includes('const mathObservationCellId = requestedMathObservationCellId || Number(mathExactCellCheck.selectedCellId) || 350')
    && subjectPracticeNoProviderAcceptanceSource.includes('const preflightCheck = runObservationPreflight(observationBaseUrl, mathObservationCellId)')
    && subjectPracticeNoProviderAcceptanceSource.includes('--allow-missing-latest-task')
    && subjectPracticeNoProviderAcceptanceSource.includes("label: 'math_observation_evidence'")
    && subjectPracticeNoProviderAcceptanceSource.includes('function runBoundedMathFamilyValidationSelfTest()')
    && subjectPracticeNoProviderAcceptanceSource.includes("label: 'math_bounded_family_validation_self_test'")
    && subjectPracticeNoProviderAcceptanceSource.includes('boundedMathFamilyValidationSelfTestCheck')
    && subjectPracticeNoProviderAcceptanceSource.includes('csca-subject-practice-diversity-rollout-gate.cjs')
    && subjectPracticeNoProviderAcceptanceSource.includes("mode: 'subject_practice_no_provider_acceptance'")
    && subjectPracticeNoProviderAcceptanceSource.includes("acceptanceScope: 'mechanism_readiness_no_provider'")
    && subjectPracticeNoProviderAcceptanceSource.includes("goalCompletionStatus: completionSatisfied")
    && subjectPracticeNoProviderAcceptanceSource.includes("function observationBackendBaseUrl")
    && subjectPracticeNoProviderAcceptanceSource.includes("argValue('base-url'")
    && subjectPracticeNoProviderAcceptanceSource.includes('function observationBaseUrlArgs')
    && subjectPracticeNoProviderAcceptanceSource.includes('...observationBaseUrlArgs(baseUrl)')
    && subjectPracticeNoProviderAcceptanceSource.includes('process.env.CSCA_OBSERVATION_BASE_URL = baseUrl')
    && subjectPracticeNoProviderAcceptanceSource.includes('const observationAdmission = runtimeState.observationAdmission')
    && subjectPracticeNoProviderAcceptanceSource.includes('observationAdmission.taskEnabled === true')
    && subjectPracticeNoProviderAcceptanceSource.includes('observationAdmission.executionEnabled === true')
    && subjectPracticeNoProviderAcceptanceSource.includes('observationAdmission.singletonConfirmed === true')
    && subjectPracticeNoProviderAcceptanceSource.includes('observationAdmission.observationOnlyMode === true')
    && subjectPracticeNoProviderAcceptanceSource.includes('preflight.questionPlanReadyForTarget === true')
    && subjectPracticeNoProviderAcceptanceSource.includes('questionPlanReadyForTarget: backendReadiness.questionPlanReadyForTarget === true')
    && subjectPracticeNoProviderAcceptanceSource.includes("const mathObservationReadyForFreshAuthorization = preflight.status === 'eligible_for_backend_owned_observation_submission'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'submit_guarded_math_observation_after_fresh_exact_authorization'")
    && subjectPracticeNoProviderAcceptanceSource.includes('nextStep,')
    && subjectPracticeNoProviderAcceptanceSource.includes('observationBaseUrl: observationBaseUrl || null')
    && subjectPracticeNoProviderAcceptanceSource.includes('mathObservationPreflightStatus: preflight.status ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('mathObservationReadyForFreshAuthorization')
    && subjectPracticeNoProviderAcceptanceSource.includes('const mathObservationFreshAuthorizationText = [')
    && subjectPracticeNoProviderAcceptanceSource.includes('Authorize exactly one backend-owned math observation task for production run #${mathObservationRunId}, cell #${mathObservationCellId}')
    && subjectPracticeNoProviderAcceptanceSource.includes("'validated_cell_select_next_guarded_family'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'validated_cell_closed_next_guarded_family_locally_calibrated'")
    && subjectPracticeNoProviderAcceptanceSource.includes('const hasFreshBoundedMathStageEvidence =')
    && subjectPracticeNoProviderAcceptanceSource.includes('const hasFreshCompleteSingleTaskMathEvidence = hasFreshLiveMathGateEvidence')
    && subjectPracticeNoProviderAcceptanceSource.includes('const mathStageValidationSatisfied = hasFreshCompleteSingleTaskMathEvidence || hasFreshBoundedMathStageEvidence')
    && subjectPracticeNoProviderAcceptanceSource.includes('const validatedObservationCell = mathStageValidationSatisfied && mathPostfixEfficiencySatisfied')
    && subjectPracticeNoProviderAcceptanceSource.includes("'ready_for_fresh_exact_authorization'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'requires_fresh_exact_authorization'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'none_select_next_family_with_read_only_calibration'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'none_until_fresh_exact_authorization_then_one_backend_owned_math_observation_task'")
    && subjectPracticeNoProviderAcceptanceSource.includes("mode: 'audit_only_math_single_run_readiness'")
    && subjectPracticeNoProviderAcceptanceSource.includes("studentConsumableImpact: 'none_does_not_publish_to_student_pool'")
    && subjectPracticeNoProviderAcceptanceSource.includes('acceptableEfficiencyStillUnproven: !mathStageValidationSatisfied')
    && subjectPracticeNoProviderAcceptanceSource.includes("'provider_recovery_not_proven_after_hard_stop'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'runtime_process_cleanup_or_elevated_audit_required'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'live_math_stage_gate_evidence_missing'")
    && subjectPracticeNoProviderAcceptanceSource.includes('observationBackendReadiness:')
    && subjectPracticeNoProviderAcceptanceSource.includes('questionPlanReadyForTarget: preflight.questionPlanReadyForTarget ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('targetProductionCellId: preflight.targetProductionCellId ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('preflight:observation_question_plan_backend_start_required')
    && subjectPracticeNoProviderAcceptanceSource.includes("'observation_backend_readiness_skipped_for_preview'")
    && subjectPracticeNoProviderAcceptanceSource.includes('preflight_warning:')
    && subjectPracticeNoProviderAcceptanceSource.includes('mathSingleRunReadiness,')
    && subjectPracticeNoProviderAcceptanceSource.includes('previewObservationTask: `npm.cmd run csca-ai-questioning:math-diversity-observation-run -- --run=${mathObservationRunId} --cell=${mathObservationCellId}')
    && subjectPracticeNoProviderAcceptanceSource.includes('targetPromptContractSelfTest: `npm.cmd run csca-ai-questioning:math-observation-target-prompt-contract-self-test -- --run=${mathObservationRunId} --cell=${mathObservationCellId} --json`')
    && subjectPracticeNoProviderAcceptanceSource.includes("runtimePrecheckOnly: 'npm.cmd run csca-ai-gateway:provider-recovery-probe -- --runtime-precheck-only --json'")
    && subjectPracticeNoProviderAcceptanceSource.includes('mathObservationNextAction,')
    && subjectPracticeNoProviderAcceptanceSource.includes('mathObservationFreshAuthorizationText,')
    && subjectPracticeNoProviderAcceptanceSource.includes('mathObservationOperatorCommands: mathObservationNextAction.operatorCommands')
    && subjectPracticeNoProviderAcceptanceSource.includes('--question-plan-cell-allowlist=${mathObservationCellId}')
    && subjectPracticeNoProviderAcceptanceSource.includes('preflight: `npm.cmd run csca-ai-questioning:math-diversity-observation-preflight --${mathObservationCommandBaseUrlArg} --cell=${mathObservationCellId} --json`')
    && subjectPracticeNoProviderAcceptanceSource.includes("providerImpact: 'none_no_provider_call'")
    && subjectPracticeNoProviderAcceptanceSource.includes("actualRuntimeImpact: 'none_no_mutation_no_provider_call'")
    && subjectPracticeNoProviderAcceptanceSource.includes("liveSubmissionImpactNotExercised: 'bounded_one_background_slot_backend_owned'")
    && subjectPracticeNoProviderAcceptanceSource.includes("dbImpact: 'read_only_runtime_state_or_fixture_only'")
    && subjectPracticeNoProviderAcceptanceSource.includes('liveObservationSubmitted: false')
    && subjectPracticeNoProviderAcceptanceSource.includes("mathPublishableEvidence: mathStageValidationSatisfied")
    && subjectPracticeNoProviderAcceptanceSource.includes("'fresh_bounded_stage_gate_pass'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'latest_single_task_scheduler_adherence_metadata_consistency'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'fresh_live_publishable_gate_pass'")
    && subjectPracticeNoProviderAcceptanceSource.includes('completionGateAfterTerminalTask')
    && mathObservationCompletionGateSource.includes("mode: 'math_observation_completion_gate'")
    && mathObservationCompletionGateSource.includes("mode: 'math_observation_completion_gate_self_test'")
    && mathObservationCompletionGateSource.includes("providerImpact: 'none_no_provider_call'")
    && mathObservationCompletionGateSource.includes("productionImpact: 'none_read_only_observation_evidence_gate'")
    && mathObservationCompletionGateSource.includes('observation_completed_within_freshness_window')
    && mathObservationCompletionGateSource.includes('exactly_one_generation_job_for_observation_task')
    && mathObservationCompletionGateSource.includes('direct_gateway_metadata_observationTaskId')
    && mathObservationCompletionGateSource.includes('preferred_family_match')
    && mathObservationCompletionGateSource.includes('passed_fresh_quality_evidence_efficiency_still_needs_scale')
    && mathObservationCompletionGateSource.includes('math_generation_efficiency_at_scale')
    && mathPostfixEfficiencyGateSource.includes("mode: 'math_postfix_efficiency_gate'")
    && mathPostfixEfficiencyGateSource.includes("mode: 'math_postfix_efficiency_gate_self_test'")
    && mathPostfixEfficiencyGateSource.includes("providerImpact: 'none_no_provider_call'")
    && mathPostfixEfficiencyGateSource.includes("productionImpact: 'none_read_only_postfix_observation_efficiency_gate'")
    && mathPostfixEfficiencyGateSource.includes("dbImpact: 'read_only_observation_tasks_generation_jobs_questions'")
    && mathPostfixEfficiencyGateSource.includes("status !== 'sample_quality_passed_needs_more_scale'")
    && mathPostfixEfficiencyGateSource.includes("status !== 'failed_student_publication_detected'")
    && oneShotHarness.includes('csca-subject-practice-math-postfix-efficiency-gate.cjs')
    && oneShotHarness.includes('postfixEfficiencyPreview')
    && oneShotHarness.includes('postfixEfficiencyStatus')
    && oneShotHarness.includes('continue_scaled_math_observation_until_postfix_efficiency_gate_passes')
    && subjectPracticeNoProviderAcceptanceSource.includes('const preflightWaitCodes = arrayFrom(preflight.waitReasons).map((reason) => `preflight:${reason}`)')
    && subjectPracticeNoProviderAcceptanceSource.includes('const operationalWaitCodes = uniqueStrings([')
    && subjectPracticeNoProviderAcceptanceSource.includes('operationalWaitCodes,')
    && subjectPracticeNoProviderAcceptanceSource.includes('const activeObservationTaskCount = Math.max(')
    && subjectPracticeNoProviderAcceptanceSource.includes('const activeObservationJobCount = Math.max(')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestObservationTaskId: observationEvidence.taskId ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestObservationGateDecision: observationEvidence.gateDecision ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('const observationJobCountForTask = Number(report.uniqueness?.observationJobCountForTask) || 0')
    && subjectPracticeNoProviderAcceptanceSource.includes('const oneObservationJobForTask = report.uniqueness?.oneObservationJobForTask === true')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestObservationGatewayBinding: observationEvidence.gatewayBinding ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestObservationJobCountForTask: observationEvidence.observationJobCountForTask ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestObservationOneJobForTask: observationEvidence.oneObservationJobForTask ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes("const latestChemistryRun = isolation.latestChemistryRun && typeof isolation.latestChemistryRun === 'object'")
    && subjectPracticeNoProviderAcceptanceSource.includes('latestChemistryRunId: latestChemistryRun.id ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestChemistryRunStatus: latestChemistryRun.status ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestChemistryRunPublished: Number(latestChemistryRun.published) || 0')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestChemistryRunBlockedReason: latestChemistryRun.blockedReason ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestChemistryRunId: observationEvidence.latestChemistryRunId ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('latestChemistryRunStatus: observationEvidence.latestChemistryRunStatus ?? null')
    && subjectPracticeNoProviderAcceptanceSource.includes('const completionAudit = [')
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'no_provider_no_submission_stage_acceptance'")
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'profile_difficulty_patch_fixed_eval_visible'")
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'backend_owned_observation_uniqueness_visible'")
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'observation_gateway_binding_visible'")
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'no_active_observation_work_leftover'")
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'chemistry_current_run_not_blocked'")
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'subject_practice_next_action_throughput_efficiency_visible'")
    && subjectPracticeNoProviderAcceptanceSource.includes("requirement: 'live_math_stage_gate_evidence'")
    && subjectPracticeNoProviderAcceptanceSource.includes("mode === 'subject_practice_next_action_preview'")
    && subjectPracticeNoProviderAcceptanceSource.includes("report.throughputEfficiency?.mode === 'audit_only_next_action_throughput_efficiency'")
    && subjectPracticeNoProviderAcceptanceSource.includes("report.actionQueue?.mode === 'ordered_subject_practice_next_action_queue'")
    && subjectPracticeNoProviderAcceptanceSource.includes("report.actionQueue?.productionImpact === 'none_read_only_action_queue'")
    && subjectPracticeNoProviderAcceptanceSource.includes('subjectPracticeNextActionStatus')
    && subjectPracticeNoProviderAcceptanceSource.includes('subjectPracticeNextActionAuthorizationText')
    && subjectPracticeNoProviderAcceptanceSource.includes('subjectPracticeCapacityFillAuthorizationText')
    && subjectPracticeNoProviderAcceptanceSource.includes('subjectPracticeActionQueue')
    && subjectPracticeNoProviderAcceptanceSource.includes('subjectPracticeThroughputEfficiencyStatus')
    && subjectPracticeNoProviderAcceptanceSource.includes('nextEfficiencyLever')
    && subjectPracticeNoProviderAcceptanceSource.includes("const hasFreshLiveMathGateEvidence = observationEvidence.mathPublishableEvidence === 'fresh_live_publishable_gate_pass'")
    && subjectPracticeNoProviderAcceptanceSource.includes("status: mathStageValidationSatisfied ? 'satisfied' : 'missing'")
    && subjectPracticeNoProviderAcceptanceSource.includes('completionAudit,')
    && subjectPracticeNoProviderAcceptanceSource.includes('const nextLiveValidation = {')
    && subjectPracticeNoProviderAcceptanceSource.includes('requiresFreshAuthorization: selectedFamilyNeedsLiveValidation || !validatedObservationCell')
    && subjectPracticeNoProviderAcceptanceSource.includes('allowedScope: selectedFamilyLocalRepairComplete')
    && subjectPracticeNoProviderAcceptanceSource.includes("'future_exact_selected_family_bounded_observation_only_after_fresh_authorization'")
    && subjectPracticeNoProviderAcceptanceSource.includes('executionAllowed: false')
    && subjectPracticeNoProviderAcceptanceSource.includes('currentProtocolContinuationStatus: selectedFamilyCurrentProtocolContinuationStatus || null')
    && subjectPracticeNoProviderAcceptanceSource.includes('productionRunId: mathObservationRunId')
    && subjectPracticeNoProviderAcceptanceSource.includes('productionCellId: mathObservationCellId')
    && subjectPracticeNoProviderAcceptanceSource.includes("'rerun_preflight_until_eligible_for_backend_owned_observation_submission'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'active_observation_task_count_zero'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'active_observation_job_count_zero'")
    && subjectPracticeNoProviderAcceptanceSource.includes("stopAfter: selectedFamilyNeedsLiveValidation")
    && subjectPracticeNoProviderAcceptanceSource.includes("'three_effective_provider_samples_or_earlier_coordinator_stop_condition'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'standalone_provider_execution'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'multiple_observation_tasks'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'provider_delivery_failure_written_to_family_quality_memory'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'student_pool_publication_without_automatic_gate_pass'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'chemistry_latest_run_still_not_blocked_after_task'")
    && subjectPracticeNoProviderAcceptanceSource.includes('nextLiveValidation,')
    && subjectPracticeNoProviderAcceptanceSource.includes('console.log(`Next live validation: ${nextLiveValidation.allowedScope}')
    && subjectPracticeNoProviderAcceptanceSource.includes("const completionSatisfied = completionAudit.every((item) => item.status === 'satisfied')")
    && subjectPracticeNoProviderAcceptanceSource.includes("const readinessCommand = 'npm.cmd run csca-ai-questioning:subject-practice-no-provider-acceptance'")
    && subjectPracticeNoProviderAcceptanceSource.includes("const completionGateCommand = 'npm.cmd run csca-ai-questioning:subject-practice-completion-gate'")
    && subjectPracticeNoProviderAcceptanceSource.includes('completionSatisfied,')
    && subjectPracticeNoProviderAcceptanceSource.includes('readinessCommand,')
    && subjectPracticeNoProviderAcceptanceSource.includes('completionGateCommand,')
    && subjectPracticeNoProviderAcceptanceSource.includes("hasFlag('require-complete') && !completionSatisfied")
    && subjectPracticeNoProviderAcceptanceSource.includes('console.log(`Readiness command: ${readinessCommand}`)')
    && subjectPracticeNoProviderAcceptanceSource.includes('console.log(`Completion gate command: ${completionGateCommand}`)')
    && subjectPracticeNoProviderAcceptanceSource.includes('fresh live math gate evidence is still missing')
    && subjectPracticeNoProviderAcceptanceSource.includes('function auditEvidenceText')
    && subjectPracticeNoProviderAcceptanceSource.includes('console.log(`Completion status: ${report.goalCompletionStatus}`)')
    && subjectPracticeNoProviderAcceptanceSource.includes('for (const item of completionAudit)')
    && subjectPracticeNoProviderAcceptanceSource.includes('console.log(`- ${item.requirement}: ${item.status}${suffix}`)')
    && subjectPracticeNoProviderAcceptanceSource.includes('mathPublishableEvidence: hasFreshPublishableGateEvidence')
    && !subjectPracticeFixedEvalSource.includes("method: 'POST'")
    && !subjectPracticeFixedEvalSource.includes('--apply')
    && !subjectPracticeFixedEvalSource.includes('confirm-math-diversity-observation-run')
    && !subjectPracticeFixedEvalSource.includes('createStandaloneAiGatewayService')
    && !subjectPracticeFixedEvalSource.includes('QuestionGeneratorProviderService')
    && !subjectPracticeFixedEvalSource.includes('PrismaClient')
    && !subjectPracticeFixedEvalSource.includes('DATABASE_URL')
    && !subjectPracticeFixedEvalSource.includes('complete(')
    && !subjectPracticeNoProviderAcceptanceSource.includes("method: 'POST'")
    && !subjectPracticeNoProviderAcceptanceSource.includes('--apply')
    && !subjectPracticeNoProviderAcceptanceSource.includes('createStandaloneAiGatewayService')
    && !subjectPracticeNoProviderAcceptanceSource.includes('complete(')
    && !mathObservationCompletionGateSource.includes("method: 'POST'")
    && !mathObservationCompletionGateSource.includes('--apply')
    && !mathObservationCompletionGateSource.includes('confirm-math-diversity-observation-run')
    && !mathObservationCompletionGateSource.includes('createStandaloneAiGatewayService')
    && !mathObservationCompletionGateSource.includes('QuestionGeneratorProviderService')
    && !mathObservationCompletionGateSource.includes('PrismaClient')
    && !mathObservationCompletionGateSource.includes('INSERT INTO')
    && !mathPostfixEfficiencyGateSource.includes("method: 'POST'")
    && !mathPostfixEfficiencyGateSource.includes('--apply')
    && !mathPostfixEfficiencyGateSource.includes('confirm-math-diversity-observation-run')
    && !mathPostfixEfficiencyGateSource.includes('createStandaloneAiGatewayService')
    && !mathPostfixEfficiencyGateSource.includes('QuestionGeneratorProviderService')
    && !mathPostfixEfficiencyGateSource.includes('INSERT INTO')
    && !mathPostfixEfficiencyGateSource.includes('UPDATE ')
    && !mathPostfixEfficiencyGateSource.includes('DELETE FROM')
    && !mathObservationCompletionGateSource.includes('UPDATE ')
    && !mathObservationCompletionGateSource.includes('DELETE FROM'),
  'Stage-level no-provider acceptance must cover observation rules/preflight/rollout without task submission, standalone providers, or provider calls.'
);
assert(
  observationArchitectureDoc.includes('latest read-only observation evidence')
    && observationArchitectureDoc.includes('completionAudit')
    && observationArchitectureDoc.includes('nextLiveValidation')
    && observationArchitectureDoc.includes('csca-ai-questioning:subject-practice-completion-gate')
    && observationArchitectureDoc.includes('does not submit observation tasks, does not call providers')
    && questionPlanExecutablePlanDoc.includes('latest read-only observation evidence')
    && questionPlanExecutablePlanDoc.includes('completionAudit')
    && questionPlanExecutablePlanDoc.includes('csca-ai-questioning:subject-practice-completion-gate')
    && questionPlanExecutablePlanDoc.includes('在 fresh live math gate evidence 缺失时非 0 退出')
    && questionPlanExecutablePlanDoc.includes('goalCompletionStatus=complete')
    && questionPlanExecutablePlanDoc.includes('不证明全数学题池都已达到 student-consumable 长期质量'),
  'Observation and QuestionPlan architecture docs must describe the current no-provider acceptance, completion audit, completion gate, and no-provider/no-submission boundary.'
);
assert(
  observationStatusDoc.includes('## Next Live Observation Runbook')
    && observationStatusDoc.includes('No additional live observation should be submitted without a new authorization.')
    && observationStatusDoc.includes('Use this only after explicit authorization for one live observation task.')
    && observationStatusDoc.includes('not a shared-backend bypass')
    && observationStatusDoc.includes('Required status: `eligible_for_backend_owned_observation_submission`.')
    && observationStatusDoc.includes('Submit exactly one task and wait for terminal status')
    && observationStatusDoc.includes('--apply --confirm-math-diversity-observation-run --wait --json --run=156 --cell=350')
    && observationStatusDoc.includes('`admission.observationOnlyMode=true` and `sharedProductionBackendOverride=false`')
    && observationStatusDoc.includes('`workClass=observation`, `observationTaskId`, `productionRunId=156`, and `productionCellId=350`')
    && observationStatusDoc.includes('not as family quality memory')
    && observationStatusDoc.includes('Another active observation task or strict observation-owned active generation job exists.')
    && observationStatusDoc.includes('do not use that override for this acceptance pass')
    && observationStatusDoc.includes('record it and stop rather than retrying immediately'),
  'Live observation runbook must preserve one-task authorization, observation-only admission, audit-only ownership, delivery-vs-quality separation, and stop/no-go boundaries.'
);
assert(
  observationStatusDoc.includes('## Current Acceptance Matrix')
    && observationStatusDoc.includes('| Backend-owned observation execution | Verified for mechanism |')
    && observationStatusDoc.includes('| Chemistry regression baseline | Protected |')
    && observationStatusDoc.includes('| Cross-subject isolation | Verified no-provider |')
    && observationStatusDoc.includes('| QuestionPlan/EvidenceSlots | Shadow/audit only |')
    && observationStatusDoc.includes('| Provider failure accounting | Protected |')
    && observationStatusDoc.includes('| Student-consumable boundary | Protected |')
    && observationStatusDoc.includes('| Stage-level no-provider acceptance | Complete for bounded MVP goal |')
    && observationStatusDoc.includes('| Math live product-quality evidence | Bounded #156/#350 positive sample exists |')
    && observationStatusDoc.includes('99ca1383-a27f-4478-ab9c-01c6f553e934')
    && observationStatusDoc.includes('generatedQuestionId=16338')
    && observationStatusDoc.includes('model `deepseek-v4-pro`')
    && observationStatusDoc.includes('mathPublishableEvidence=fresh_live_publishable_gate_pass')
    && observationStatusDoc.includes('481bf155-67a2-4659-a7d8-59f3bc6308c7')
    && observationStatusDoc.includes('56de9be1-c3dd-4314-9619-3a6bdb341a55')
    && observationStatusDoc.includes('b757a7c5-58b5-4cd2-a664-5e2ddf0ffc04')
    && observationStatusDoc.includes('ended in delivery failure before candidate/gate evidence')
    && observationStatusDoc.includes('Does not prove future math candidates are always publishable.')
    && observationStatusDoc.includes('it does not prove broad math candidates are always publishable or student-consumable.'),
  'Acceptance matrix must distinguish verified mechanism/isolation evidence from still-gated math product-quality evidence.'
);
assert(
  migration.includes('uq_csca_ai_questioning_tasks_active_observation')
    && migration.includes("status\" IN ('queued', 'running')")
    && migration.includes('uq_csca_ai_generation_jobs_observation_task'),
  'Database constraints must cap active tasks and enforce one generation job per observation task.'
);
assert(
  guardedMathFamilySelector.includes("'bounded_coordinator_ready_for_authorization_review_not_authorized'")
    && guardedMathFamilySelector.includes("'bounded_three_sample_coordinator_ready_for_authorization_review'")
    && guardedMathFamilySelector.includes("'selected_versioned_validation_protocol_ready_for_authorization_review'")
    && guardedMathFamilySelector.includes("'bounded_versioned_three_sample_coordinator_ready_for_authorization_review'")
    && guardedMathFamilySelector.includes("'selected_requires_local_repair_after_bounded_failure'")
    && guardedMathFamilySelector.includes("'repair_selected_family_after_bounded_quality_failure'")
    && guardedMathFamilySelector.includes("'blocked_bounded_quality_threshold_not_met_local_repair_required'")
    && guardedMathFamilySelector.includes('authorizationRequired: versionedProtocolReady || !historicalProtocolQualityStopped')
    && guardedMathFamilySelector.includes('applyAfterFreshAuthorization: versionedProtocolReady || !historicalProtocolQualityStopped')
    && guardedMathFamilySelector.includes("'bounded_coordinator_preview_matches_exact_family_and_cost_limits'")
    && guardedMathFamilySelector.includes('maximumTotalEstimatedCostUsd: 0.02')
    && guardedMathFamilySelector.includes('maximumEstimatedCostUsdPerCall: 0.006')
    && guardedMathFamilySelector.includes("'npm.cmd run csca-ai-questioning:math-bounded-family-validation --'")
    && guardedMathFamilySelector.includes("'--confirm-bounded-math-family-validation'")
    && guardedMathFamilySelector.includes('`--confirm-task-family=${selected.taskFamily}`')
    && guardedMathFamilySelector.includes('`--confirm-validation-protocol-version=${selectedValidationProtocolVersion}`')
    && guardedMathFamilySelector.includes('effectiveProviderSampleCount ?? funnels.providerAttemptedTaskCount')
    && guardedMathFamilySelector.includes('excludedLocalPreProviderDiagnosticCount')
    && guardedMathFamilySelector.includes('`--confirm-excluded-local-pre-provider-diagnostics=${selectedLocalPreProviderDiagnosticCount}`')
    && subjectPracticeNoProviderAcceptanceSource.includes("executionProtocol: selectedFamilyRequiresLocalRepair")
    && subjectPracticeNoProviderAcceptanceSource.includes("'math_bounded_family_validation_strictly_serial_three_sample'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'three_effective_provider_samples_or_earlier_coordinator_stop_condition'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'repair_selected_guarded_math_family_locally_after_bounded_quality_failure'")
    && subjectPracticeNoProviderAcceptanceSource.includes('&& !selectedFamilyRequiresLocalRepair')
    && subjectPracticeNoProviderAcceptanceSource.includes("'none_selected_family_requires_local_repair_before_any_future_live_validation'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'parallel_or_unbounded_observation_tasks'")
    && subjectPracticeNoProviderAcceptanceSource.includes('selectedFutureLiveValidationPlan.operatorCommands')
    && subjectPracticeNoProviderAcceptanceSource.includes("'exact_family_exact_validation_protocol_effective_provider_sample_count_equals_three'")
    && subjectPracticeNoProviderAcceptanceSource.includes("'student_publication_count_zero'"),
  'The selected guarded math family must expose the bounded three-sample coordinator as the only future authorization path, with exact per-call and aggregate cost limits.'
);
assert(
  service.includes('const SUBJECT_PRACTICE_OBSERVATION_ACTIONS = {')
    && service.includes("physics: 'physics_scheduler_v2'")
    && service.includes("chemistry: 'chemistry_scheduler_v2'")
    && service.includes('guarded_non_math_observation_requires_observation_only_mode')
    && service.includes('guarded_observation_requires_exact_cell_and_task_family')
    && service.includes('subject_practice_observation_cost_cap_invalid')
    && service.includes('subject_practice_observation_server_cost_reservation_exceeds_declared_cap')
    && service.includes('subject_practice_observation_server_cost_reservation_unavailable')
    && service.includes('clientDeclaredMaximumReservedCostUsd')
    && service.includes("MATH_ELEMENTARY_DIRECT_PROPERTY_VALIDATION_PROTOCOL = 'math-elementary-direct-property-rotation-v3'")
    && service.includes('guarded_observation_validation_protocol_invalid')
    && service.includes('observation_validation_protocol_invalid')
    && service.includes('validationProtocolVersion: cleanString(snapshot.validationProtocolVersion) || null')
    && service.includes('subject_practice_observation_backend_not_ready')
    && service.includes("commonReasons.push('observation_execution_disabled')")
    && service.includes('readyForLocalZeroProviderExecution')
    && service.includes("localZeroProviderReasons.push('observation_only_mode_required')")
    && service.includes("providerReasons.push('eligible_background_key_slots_below_two')")
    && service.includes("\"filter_snapshot\"->>'observationExecutionRoute' = 'local_deterministic_zero_provider'")
    && service.includes('subjectPracticeObservationCostReservationValid')
    && service.includes("'guarded-observation-zero-provider-cost-reservation-v1'")
    && service.includes("policyVersion: 'guarded-observation-provider-boundary-v2'")
    && service.includes("executionRoute: localZeroProviderRoute ? 'local_deterministic_zero_provider' : 'provider_guarded'")
    && service.includes('providerAttemptLimit: localZeroProviderRoute ? 0 : 1')
    && service.includes('subjectPracticeAutomatedCandidateLeakageGate(candidate)')
    && service.includes('applySubjectPracticeAutomatedCandidateLeakageGate(baseReview, candidateLeakageGate)')
    && service.includes("status: 'missing_corpus'")
    && service.includes('sourceContentExposedToGenerator: false')
    && service.includes('providerAttemptLimit: Number(observationCostAdmission?.providerAttemptLimit)')
    && service.includes('const outputTokenCeiling = questionGenerationMaxTokensForBlueprint(blueprint, selectedModel)')
    && service.includes("reasoningPolicy.policyVersion === 'question-generation-reasoning-effort-v3'")
    && service.includes("guardedReasoningPolicyKind: localZeroProviderRoute")
    && service.includes('observation_provider_cost_admission_failed')
    && service.includes('observationCostAdmission')
    && service.includes('maxProviderAttempts: isObservationJob ? 1 : undefined')
    && service.includes('const batchId = cleanString(query.batchId)')
    && service.includes('/^local-shadow-[a-f0-9]{20}$/')
    && service.includes('SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT : 50')
    && service.includes("\"filter_snapshot\"->'sealedObservationBatch'->>'batchId'"),
  'Three-subject observation tasks must be exact-scoped, isolated for non-math subjects, and fail before Provider when the guarded cost policy or explicit cap drifts.'
);
assert(
  service.includes('const batchId = cleanString(query.batchId)')
    && service.includes("/^local-shadow-[a-f0-9]{20}$/.test(batchId)")
    && service.includes('SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT')
    && service.includes("\"filter_snapshot\"->'sealedObservationBatch'->>'batchId' = ${batchId || null}"),
  'Observation task listing must support an exact validated sealed-batch filter and return the full bounded manifest for safe resume planning.'
);
assert(
  observationBatchManifestPolicySource.includes('subject-practice-observation-batch-manifest-v10-production-profile-bound')
    && observationBatchManifestPolicySource.includes('productionProfileBindingPolicyVersion')
    && observationBatchManifestPolicySource.includes('productionProfileBindingDigest')
    && observationBatchManifestPolicySource.includes('subjectPracticeLocalGeneratorProductionProfileBindingForCell')
    && service.includes('subjectPracticeLocalGeneratorProductionProfileBindingDigest')
    && service.includes("throw new Error('observation_batch_production_profile_binding_stale')"),
  'A sealed zero-provider observation batch must bind the exact production cell profile and recheck it before task creation.'
);
assert(
  service.includes("SET \"status\" = 'running'")
    && service.includes('"execution_attempt_token" = ${attemptToken}::uuid')
    && service.includes("\"status\" = 'queued'\n          OR (\"status\" = 'running'"),
  'Observation task claim must be an atomic queued/stale-running to running update with a fresh token.'
);
assert(
  service.includes('observation_execution_fence_lost')
    && service.includes('heartbeatSubjectPracticeObservationJob')
    && service.includes('SUBJECT_PRACTICE_OBSERVATION_HEARTBEAT_MS'),
  'Task/job heartbeat and owner-token fencing must guard recovery.'
);
assert(
  service.includes("schedulerHintAdherence: {")
    && service.includes("policyVersion: 'subject-practice-observation-adherence-v1'")
    && service.includes("COALESCE(q.\"generation_metadata\"->'schedulerHint', job.\"prompt_metadata\"->'repairFeedback'->'schedulerHint') AS \"schedulerHint\""),
  'Observation task result scheduler adherence must also be persisted to the generated question metadata for audit replay.'
);
assert(
  service.includes('if (Number(affected) === 1) return;')
    && service.includes("if (current && !['queued', 'running'].includes(cleanString(current.status))) return;"),
  'Observation job heartbeat must tolerate a terminal job after provider/review completion without logging false fence loss.'
);
assert(
  service.includes("COALESCE(job.\"prompt_metadata\"->>'workClass', 'production') <> ${SUBJECT_PRACTICE_OBSERVATION_WORK_CLASS}")
    && service.includes('subjectPracticeProductionCellActiveInFlightJobCount('),
  'Ordinary selectors must exclude observation jobs while shared cell occupancy remains active.'
);
assert(
  service.includes("COALESCE(q.\"generation_metadata\"->>'workClass', 'production') <> ${SUBJECT_PRACTICE_OBSERVATION_WORK_CLASS}")
    && service.includes("if (cleanString(metadata.workClass) === SUBJECT_PRACTICE_OBSERVATION_WORK_CLASS) return;"),
  'Observation questions must not mutate production completion counters or run lifecycle state.'
);
assert(
  service.includes('const suppressStudentPublication = body.suppressStudentPublication !== false && body.allowStudentPublication !== true;')
    && service.includes('observation_gate_evidence_only_no_student_publication')
    && service.includes('const autoApproved = suppressStudentPublication ? null : await this.maybeAutoApproveSubjectPracticeQuestion(question);')
    && service.includes('if (!autoApproved && !suppressStudentPublication)')
    && service.includes('generation.suppressStudentPublication !== false')
    && cli.includes('suppressStudentPublication: true')
    && cli.includes('studentPublicationPolicy')
    && evidenceCli.includes('studentPublication')
    && evidenceCli.includes('special_practice_questions')
    && evidenceCli.includes('not_published_to_student_pool')
    && evidenceCli.includes('providerUsageAndCost')
    && evidenceCli.includes('gatewayProviderAttemptCount')
    && evidenceCli.includes('providerAttemptLimitRespected')
    && evidenceCli.includes('costWithinAuthorizedCap')
    && evidenceCli.includes("costEvidenceStatus: directlyBoundGatewayEvidence ? 'directly_bound' : 'ambiguous_or_missing'")
    && mathObservationCompletionGateSource.includes('observation_student_publication_suppressed')
    && mathObservationCompletionGateSource.includes('observation_not_published_to_student_pool')
    && mathObservationCompletionGateSource.includes('generated_question_recorded_for_gate_evidence')
    && !mathObservationCompletionGateSource.includes('generated_question_approved'),
  'Observation gate/evidence runs must suppress student publication by default and prove the generated sample did not enter the student pool.'
);
assert(
  service.includes("if (cleanString(generation.workClass) === SUBJECT_PRACTICE_OBSERVATION_WORK_CLASS) return null;")
    && service.includes("if (cleanString(recordFrom(question.generationMetadata)?.workClass) === SUBJECT_PRACTICE_OBSERVATION_WORK_CLASS) return null;"),
  'Observation gate failures must not spawn repair or regenerate jobs beyond the unique generation side effect.'
);
assert(
  service.includes('cancel_requested_at')
    && service.includes("CASE WHEN \"status\" = 'queued' THEN 'cancelled'")
    && service.includes('observation_cancelled_at_generation_boundary'),
  'Queued cancellation must be immediate and running cancellation must stop at a provider boundary.'
);
assert(
  controller.includes('subject-practice-observation-tasks')
    && packageSource.includes('"csca-ai-questioning:math-diversity-observation-apply-scope-self-test": "node scripts/csca-subject-practice-math-diversity-observation-run.cjs --self-test-apply-scope"')
    && packageSource.includes('"csca-ai-questioning:math-observation-target-prompt-contract-self-test": "node scripts/csca-subject-practice-math-diversity-observation-run.cjs --self-test-target-prompt-contract"')
    && cli.includes('standaloneProviderExecution: false')
    && cli.includes('/api/v1/admin/ai-questioning/subject-practice-observation-tasks')
    && cli.includes('assertApplyAdmission')
    && cli.includes('function assertApplyAdmissionStatus')
    && cli.includes('function assertBackendProviderNetworkProbe')
    && cli.includes('subject-practice-observation-runtime-probe')
    && cli.includes("billingImpact !== 'none_no_tokens_or_provider_request'")
    && cli.includes('readyForSubmission=false')
    && cli.includes('readyForExecution=false')
    && cli.includes('function assertTargetPromptContractReady')
    && cli.includes('Target prompt-contract precheck must not call provider')
    && cli.includes("hasFlag('self-test-target-prompt-contract')")
    && cli.includes("mode: 'subject_practice_observation_target_prompt_contract_self_test'")
    && cli.includes("networkImpact: 'none_no_http_request'")
    && cli.includes('function admissionEvidence')
    && cli.includes('readyForSubmission')
    && cli.includes('readyForExecution')
    && cli.includes('observationOnlyMode=true')
    && cli.includes('allow-shared-production-backend')
    && cli.includes('admission: admissionReport')
    && !cli.includes('createStandaloneAiGatewayService')
    && !cli.includes('QuestionGeneratorProviderService')
    && !cli.includes('processSubjectPracticeProductionRun'),
  'CLI/Admin must submit and query durable tasks without constructing a provider or production service, and apply must verify observation-only admission unless explicitly overridden.'
);
assert(
  controller.includes("@Post(['api/v1/admin/ai-questioning/subject-practice-observation-runtime-probe'])")
    && service.includes('async subjectPracticeObservationRuntimeProbe()')
    && service.includes("status: 'passed_backend_provider_network_reachable'")
    && service.includes("status: 'blocked_backend_provider_network_unreachable'")
    && service.includes("providerImpact: 'tls_handshake_only_no_provider_api_request'")
    && service.includes("billingImpact: 'none_no_tokens_or_provider_request'")
    && service.includes("process.env.CSCA_AI_QUESTION_GENERATION_BASE_URL")
    && !service.includes("subjectPracticeObservationRuntimeProbe(body"),
  'Observation apply must probe the configured Provider host from the backend process with a TLS handshake only, without accepting a user-controlled target or issuing a billable API request.'
);
assert(
  cli.includes('subject-practice-observation-tasks?subject=${encodeURIComponent(subject)}&limit=5')
    && cli.includes("mode: 'submit-preview'")
    && cli.includes('requestedTargetExistingTaskCount')
    && cli.includes('requestedTargetExistingTasks')
    && cli.includes('historicalTaskCount')
    && cli.includes('Preview only. Add --apply --confirm-subject-practice-guarded-observation-run')
    && cli.includes('function assertExactApplyScope')
    && cli.includes('function runApplyScopeSelfTest')
    && cli.includes("hasFlag('self-test-apply-scope')")
    && cli.includes("mode: 'math_observation_apply_scope_self_test'")
    && cli.includes("networkImpact: 'none_no_http_request'")
    && cli.includes("hasFlag('confirm-subject-practice-guarded-observation-run')")
    && cli.includes("hasFlag('confirm-math-diversity-observation-run')")
    && cli.includes("const confirmedRunId = Number(argValue('confirm-run', ''))")
    && cli.includes("const confirmedCellId = Number(argValue('confirm-cell', ''))")
    && cli.includes("throw new Error(`Apply requires --confirm-run=${productionRunId}.`)")
    && cli.includes("throw new Error(`Apply requires --confirm-cell=${productionCellId}.`)")
    && cli.includes('function assertExactTaskFamilyConfirmation')
    && cli.includes('Apply requires the exact-cell prompt contract to resolve a task family.')
    && cli.includes('Apply requires --confirm-task-family=${resolvedTaskFamily}.')
    && cli.includes("const confirmedTaskFamily = cleanText(argValue('confirm-task-family', ''))")
    && cli.includes('assertExactTaskFamilyConfirmation(promptContractAdmission.questionPlanTaskFamily, confirmedTaskFamily);')
    && cli.includes('assertExactApplyScope({ productionRunId, productionCellId, confirmedRunId, confirmedCellId });')
    && cli.includes('function providerReadinessEvidenceFor')
    && cli.includes('function assertProviderReadinessEvidence')
    && cli.includes('csca-ai-gateway-provider-recovery-state.cjs')
    && cli.includes('provider_hard_stop_not_clear')
    && cli.includes('no_enabled_question_generation_key')
    && cli.includes('does not match guarded execution model')
    && cli.includes('const promptContractAdmission = assertTargetPromptContractReady({ subject, productionRunId, productionCellId });')
    && cli.includes('assertEstimatedCostCap(')
    && cli.includes('maxEstimatedCostUsd')
    && cli.includes('promptContractAdmission')
    && cli.includes('const admission = await assertApplyAdmission(token);')
    && /report = await requestJson\('\/api\/v1\/admin\/ai-questioning\/subject-practice-observation-tasks', token, \{\s+method: 'POST'/.test(cli)
    && cli.indexOf("hasFlag('confirm-subject-practice-guarded-observation-run')") < cli.indexOf("method: 'POST'", cli.indexOf("report = await requestJson('/api/v1/admin/ai-questioning/subject-practice-observation-tasks', token"))
    && cli.indexOf("const confirmedRunId = Number(argValue('confirm-run', ''))") < cli.indexOf("method: 'POST'", cli.indexOf("report = await requestJson('/api/v1/admin/ai-questioning/subject-practice-observation-tasks', token"))
    && cli.indexOf("const confirmedCellId = Number(argValue('confirm-cell', ''))") < cli.indexOf("method: 'POST'", cli.indexOf("report = await requestJson('/api/v1/admin/ai-questioning/subject-practice-observation-tasks', token"))
    && cli.indexOf('assertExactApplyScope({ productionRunId, productionCellId, confirmedRunId, confirmedCellId });') < cli.indexOf('const token = await resolveAdminToken();', cli.indexOf('} else if (apply) {'))
    && cli.indexOf('const providerReadinessEvidence = assertProviderReadinessEvidence();') < cli.indexOf('const token = await resolveAdminToken();', cli.indexOf('} else if (apply) {'))
    && cli.indexOf('const promptContractAdmission = assertTargetPromptContractReady({ subject, productionRunId, productionCellId });') < cli.indexOf('const token = await resolveAdminToken();', cli.indexOf('} else if (apply) {'))
    && cli.indexOf('assertEstimatedCostCap(') < cli.indexOf('const token = await resolveAdminToken();', cli.indexOf('} else if (apply) {'))
    && cli.indexOf('const promptContractAdmission = assertTargetPromptContractReady({ subject, productionRunId, productionCellId });') < cli.indexOf("method: 'POST'", cli.indexOf("report = await requestJson('/api/v1/admin/ai-questioning/subject-practice-observation-tasks', token"))
    && cli.indexOf('const admission = await assertApplyAdmission(token);') < cli.indexOf("method: 'POST'", cli.indexOf("report = await requestJson('/api/v1/admin/ai-questioning/subject-practice-observation-tasks', token"))
    && /else if \(apply\) \{[\s\S]*confirm-subject-practice-guarded-observation-run[\s\S]*assertExactApplyScope\(\{ productionRunId, productionCellId, confirmedRunId, confirmedCellId \}\);[\s\S]*assertTargetPromptContractReady\(\{ subject, productionRunId, productionCellId \}\);[\s\S]*assertEstimatedCostCap\([\s\S]*const admission = await assertApplyAdmission\(token\);[\s\S]*method: 'POST'[\s\S]*\} else \{[\s\S]*subject-practice-observation-tasks\?subject=\$\{encodeURIComponent\(subject\)\}&limit=5[\s\S]*mode: 'submit-preview'/.test(cli),
  'Observation CLI preview must stay read-only, while POST submission must remain gated behind --apply, exact run/cell confirmation, and admission validation.'
);
assert(
  packageSource.includes('"csca-ai-questioning:math-one-shot-harness": "node scripts/csca-subject-practice-math-one-shot-harness.cjs"')
    && oneShotHarness.includes("mode: 'math_one_shot_harness_preview'")
    && oneShotHarness.includes("mode: 'math_one_shot_harness'")
    && oneShotHarness.includes("mode: 'math_one_shot_harness_self_test'")
    && oneShotHarness.includes('One-shot harness is preview-only unless --apply is present.')
    && oneShotHarness.includes('One-shot apply requires --confirm-one-math-observation-harness.')
    && oneShotHarness.includes('One-shot apply requires --confirm-runtime-clean immediately before submission.')
    && oneShotHarness.includes('One-shot apply requires --confirm-provider-recovery after a successful provider recovery probe.')
    && oneShotHarness.includes('One-shot apply requires --confirm-no-student-publication.')
    && oneShotHarness.includes('One-shot apply requires a resolved exact-cell task family.')
    && oneShotHarness.includes('One-shot apply requires --confirm-task-family=${taskFamily}.')
    && oneShotHarness.includes('csca-subject-practice-exact-cell-enqueue.cjs')
    && oneShotHarness.includes("'--include-prompt-contract'")
    && oneShotHarness.includes('taskFamily: exactTargetPlan.taskFamily')
    && oneShotHarness.includes('`--confirm-task-family=${exactTargetPlan.taskFamily')
    && oneShotHarness.includes('One-shot apply requires a positive --max-estimated-cost-usd.')
    && oneShotHarness.includes('`--max-estimated-cost-usd=${maxEstimatedCostUsd}`')
    && oneShotHarness.includes('async function resolveSharedObservationAdminToken')
    && oneShotHarness.includes('single_harness_admin_login_reused_for_child_processes')
    && oneShotHarness.includes('preview_does_not_login_with_admin_password')
    && oneShotHarness.includes("const previewAuth = await resolveSharedObservationAdminToken(baseUrl, { allowLogin: false })")
    && oneShotHarness.includes("await resolveSharedObservationAdminToken(baseUrl, { allowLogin: true })")
    && oneShotHarness.includes('CSCA_OBSERVATION_BACKEND_READINESS_SKIP')
    && oneShotHarness.includes("tokenValueHidden: sharedAuth.status === 'available'")
    && oneShotHarness.includes('One-shot apply requires an admin token before submission')
    && oneShotHarness.includes('csca-ai-gateway-provider-recovery-probe.cjs')
    && oneShotHarness.includes("'--runtime-precheck-only'")
    && oneShotHarness.includes("runtimePrecheck.status === 'runtime_precheck_passed_live_provider_not_called'")
    && oneShotHarness.includes('Runtime precheck must pass immediately before one-shot apply')
    && oneShotHarness.includes('function mathAllExactPromptContractsReady')
    && oneShotHarness.includes('mathAllExactPromptContractsReadyForApply')
    && oneShotHarness.includes('One-shot apply requires all math exact-cell QuestionPlan prompt contracts to pass no-provider acceptance before provider spend.')
    && oneShotHarness.indexOf('One-shot apply requires all math exact-cell QuestionPlan prompt contracts to pass no-provider acceptance before provider spend.') < oneShotHarness.indexOf('await resolveSharedObservationAdminToken(baseUrl, { allowLogin: true })')
    && oneShotHarness.includes('Provider recovery state must show a successful post-hard-stop recovery before one-shot apply.')
    && oneShotHarness.includes('Preflight must be eligible before apply')
    && !oneShotHarness.includes("source: 'reused_no_provider_acceptance_preflight_summary'")
    && oneShotHarness.includes("preflightSource: preflight.source ?? 'direct_target_cell_preflight'")
    && oneShotHarness.includes('preflightObservationBackendReadiness')
    && oneShotHarness.includes('observationBackendReadiness: acceptance.observationBackendReadiness ?? null')
    && oneShotHarness.includes('const singleShotPreEvidence = {')
    && oneShotHarness.includes('mathQuestionPlanRetryFeedbackCoverageStatus: acceptance.mathQuestionPlanRetryFeedbackCoverageStatus ?? null')
    && oneShotHarness.includes('mathQuestionPlanRetryFeedbackCoverage')
    && oneShotHarness.includes('mathQuestionPlanSkeletonCoverageStatus: mathQuestionPlanSkeletonCoverage?.status ?? null')
    && oneShotHarness.includes('mathQuestionPlanSkeletonCoverage')
    && oneShotHarness.includes('mathAllExactCellQuestionPlanReadiness')
    && oneShotHarness.includes('promptContractPassedCount')
    && oneShotHarness.includes('promptContractIssueCount')
    && oneShotHarness.includes("studentPublicationPolicy: 'observation_only_no_student_pool_publication'")
    && oneShotHarness.includes('singleShotPreEvidence,')
    && oneShotHarness.includes('csca-subject-practice-math-diversity-observation-run.cjs')
    && oneShotHarness.includes('csca-subject-practice-observation-evidence.cjs')
    && oneShotHarness.includes('csca-subject-practice-math-observation-completion-gate.cjs')
    && oneShotHarness.includes("'--confirm-math-diversity-observation-run'")
    && oneShotHarness.includes("'--confirm-runtime-clean'")
    && oneShotHarness.includes("'--confirm-provider-recovery'")
    && oneShotHarness.includes('`--confirm-task-family=${exactTargetPlan.taskFamily}`')
    && oneShotHarness.includes('confirm-validation-protocol-version')
    && oneShotHarness.includes("'--wait'")
    && oneShotHarness.includes("studentConsumableImpact: 'none_does_not_publish_to_student_pool'")
    && oneShotHarness.includes('standaloneProviderExecution: false')
    && !oneShotHarness.includes('createStandaloneAiGatewayService')
    && !oneShotHarness.includes('QuestionGeneratorProviderService')
    && !oneShotHarness.includes('PrismaClient')
    && oneShotHarness.indexOf('assertApplyAuthorization({') < oneShotHarness.indexOf("runNodeJson('csca-subject-practice-math-diversity-observation-run.cjs'")
    && oneShotHarness.indexOf("runNodeJson('csca-subject-practice-math-diversity-observation-run.cjs'") < oneShotHarness.indexOf("runNodeJson('csca-subject-practice-observation-evidence.cjs'")
    && oneShotHarness.indexOf("runNodeJson('csca-subject-practice-observation-evidence.cjs'") < oneShotHarness.indexOf("runNodeJson('csca-subject-practice-math-observation-completion-gate.cjs'"),
  'Math one-shot harness must stay preview-only by default and, when explicitly applied, submit exactly one backend-owned observation before evidence and completion gate checks without direct provider construction or student publication.'
);
assert(
  packageSource.includes('"csca-ai-questioning:math-bounded-family-validation": "node scripts/csca-subject-practice-math-bounded-family-validation.cjs"')
    && packageSource.includes('"csca-ai-questioning:math-bounded-family-validation-self-test": "node scripts/csca-subject-practice-math-bounded-family-validation.cjs --self-test"')
    && boundedMathFamilyValidation.includes("mode: 'math_bounded_family_validation_preview'")
    && boundedMathFamilyValidation.includes("mode: 'math_bounded_family_validation'")
    && boundedMathFamilyValidation.includes("mode: 'math_bounded_family_validation_self_test'")
    && boundedMathFamilyValidation.includes("config.maximumProviderCalls === 3")
    && boundedMathFamilyValidation.includes("executionShape: 'strictly_serial_one_terminal_task_before_next'")
    && boundedMathFamilyValidation.includes("baseline.effectiveProviderSampleCount < config.maximumProviderCalls")
    && boundedMathFamilyValidation.includes("'--current-protocol-cohort'")
    && boundedMathFamilyValidation.includes("'--minimum-delivery-yield=1'")
    && boundedMathFamilyValidation.includes('`--minimum-question-plan-adherence-yield=${2 / 3}`')
    && boundedMathFamilyValidation.includes('minimumDeliveryYield: 1')
    && boundedMathFamilyValidation.includes('minimumQuestionPlanAdherenceYield: 2 / 3')
    && boundedMathFamilyValidation.includes('current.effectiveProviderSampleCount - input.baseline.effectiveProviderSampleCount')
    && boundedMathFamilyValidation.includes('confirm-excluded-local-pre-provider-diagnostics')
    && boundedMathFamilyValidation.includes('confirm-existing-effective-provider-samples')
    && boundedMathFamilyValidation.includes('countedTerminalSampleDespiteChildExit')
    && boundedMathFamilyValidation.includes('serialIterationIntegrity')
    && boundedMathFamilyValidation.includes("status: 'stop_serial_observation_task_delta_invalid'")
    && boundedMathFamilyValidation.includes("status: 'stop_serial_effective_provider_sample_delta_invalid'")
    && boundedMathFamilyValidation.includes("status: 'stop_serial_iteration_cost_cap_exceeded'")
    && boundedMathFamilyValidation.includes('observedTaskDelta !== 1')
    && boundedMathFamilyValidation.includes('effectiveProviderSampleDelta !== 1')
    && boundedMathFamilyValidation.includes('iterationIntegrityFailure')
    && boundedMathFamilyValidation.includes('fewer_than_target_current_protocol_effective_provider_samples_and_no_active_task')
    && observationScorecard.includes('effectiveProviderSampleCount: effectiveProviderSamples.length')
    && observationScorecard.includes('localPreProviderDiagnosticCount: localPreProviderDiagnostics.length')
    && observationScorecard.includes('localPreProviderFailuresExcludedFromEffectiveSampleAndDeliveryDenominator: true')
    && observationFailureClassification.includes("return 'connect_eacces_443_local_network_denial'")
    && boundedMathFamilyValidation.includes('batchCostUsd + input.maximumPerCallCostUsd > input.maximumTotalCostUsd')
    && boundedMathFamilyValidation.includes('studentPublicationViolationCount')
    && boundedMathFamilyValidation.includes("'--confirm-no-student-publication'")
    && boundedMathFamilyValidation.includes('`--confirm-task-family=${exactPlan.taskFamily}`')
    && boundedMathFamilyValidation.includes('`--validation-protocol-version=${config.validationProtocolVersion}`')
    && boundedMathFamilyValidation.includes('`--confirm-validation-protocol-version=${config.validationProtocolVersion}`')
    && validationProtocolSource.includes("MATH_ELEMENTARY_DIRECT_PROPERTY_VALIDATION_PROTOCOL = 'math-elementary-direct-property-rotation-v3'")
    && validationProtocolSource.includes('Number(productionRunId) === 1')
    && validationProtocolSource.includes('Number(productionCellId) === 16')
    && observationScorecard.includes('validationProtocolCohortFor')
    && observationScorecard.includes("protocolCohort: requestedValidationProtocolVersion")
    && boundedMathFamilyValidation.includes('`--confirm-max-provider-calls=${config.maximumProviderCalls}`')
    && boundedMathFamilyValidation.includes('`--confirm-max-total-estimated-cost-usd=${config.maximumTotalCostUsd}`')
    && boundedMathFamilyValidation.includes('`--confirm-max-estimated-cost-usd-per-call=${config.maximumPerCallCostUsd}`')
    && boundedMathFamilyValidation.includes("status: 'stop_one_shot_child_failed'")
    && boundedMathFamilyValidation.includes('childFailure,')
    && boundedMathFamilyValidation.includes("runNodeJson('csca-subject-practice-math-one-shot-harness.cjs'")
    && boundedMathFamilyValidation.includes("runNodeJson('csca-subject-practice-observation-scorecard.cjs'")
    && !boundedMathFamilyValidation.includes('QuestionGeneratorProviderService')
    && !boundedMathFamilyValidation.includes('PrismaClient'),
  'Bounded math-family validation must remain preview-only by default and execute at most three strictly serial backend-owned observations under exact family, per-iteration integrity, aggregate cost, and no-publication gates.'
);
assert(
  packageSource.includes('"csca-ai-questioning:math-diversity-observation-evidence": "node scripts/csca-subject-practice-observation-evidence.cjs"')
    && evidenceCli.includes("mode: 'read_only_observation_evidence'")
    && evidenceCli.includes("status: 'skipped_no_observation_task'")
    && evidenceCli.includes('allow-missing-latest-task')
    && evidenceCli.includes('FROM csca_ai_questioning_tasks')
    && evidenceCli.includes('FROM csca_ai_generation_jobs')
    && evidenceCli.includes('FROM ai_gateway_call_logs')
    && evidenceCli.includes("metadata->>'observationTaskId' = ${taskId}")
    && evidenceCli.includes("'direct_gateway_metadata_observationTaskId'")
    && evidenceCli.includes("'time_window_subject_taskType_sourceModule_candidate_not_unique_request_binding'")
    && evidenceCli.includes('activeObservationJobCount')
    && evidenceCli.includes("prompt_metadata->>'workClass' = 'observation'")
    && evidenceCli.includes("NULLIF(prompt_metadata->>'observationTaskId', '') IS NOT NULL")
    && evidenceCli.includes('providerFailuresAreDeliveryEvidenceOnly: true')
    && evidenceCli.includes('studentConsumableNotProvenByThisReport: true')
    && !evidenceCli.includes("method: 'POST'")
    && !evidenceCli.includes('requestJson(')
    && !evidenceCli.includes('createStandaloneAiGatewayService')
    && !evidenceCli.includes('QuestionGeneratorProviderService')
    && !evidenceCli.includes('processSubjectPracticeProductionRun')
    && !evidenceCli.includes('INSERT INTO')
    && !evidenceCli.includes('UPDATE ')
    && !evidenceCli.includes('DELETE FROM'),
  'Observation evidence collector must remain read-only DB evidence tooling and must not submit tasks, call HTTP admin endpoints, construct providers, or mutate production state.'
);
assert(
  generatorProvider.includes('type QuestionGeneratorProviderOptions')
    && generatorProvider.includes('gatewayMetadata?: Record<string, unknown>')
    && generatorProvider.includes('options: QuestionGeneratorProviderOptions = {}')
    && generatorProvider.includes('...(options.gatewayMetadata ?? {})')
    && service.includes('observationEvidenceBinding')
    && service.includes("'direct_gateway_metadata'")
    && service.includes('generationJobId: jobId')
    && service.includes('observationTaskId: jobObservationTaskId')
    && service.includes('workClass: SUBJECT_PRACTICE_OBSERVATION_WORK_CLASS'),
  'Observation generation must pass task/job/workClass metadata into the gateway ledger so future evidence can bind gateway logs directly instead of relying only on time windows.'
);
assert(
  service.includes('background_capacity_below_two')
    && service.includes('eligible_background_key_slots_below_two')
    && service.includes('child_capacity_exceeds_global_capacity'),
  'Readiness must enforce two background/key slots and valid global child-capacity accounting.'
);
assert(
  service.includes('private subjectPracticeObservationOnlyModeEnabled()')
    && service.includes("this.envEnabled('SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE')")
    && service.includes('if (this.subjectPracticeObservationOnlyModeEnabled()) return false;')
    && service.includes('const generalStartupRecoveryEnabled = recoveryEnabled && !this.subjectPracticeObservationOnlyModeEnabled();')
    && service.includes('AI questioning startup generation recovery skipped by SUBJECT_PRACTICE_OBSERVATION_ONLY_MODE.')
    && service.includes('recoveryEnabled && !this.subjectPracticeObservationOnlyModeEnabled()')
    && service.includes("if (!this.subjectPracticeObservationOnlyModeEnabled()) {\n          void this.reconcileSubjectPracticeProductionLifecycle('startup_lifecycle_reconcile')")
    && service.includes("!this.envEnabled('CSCA_SUBJECT_PRACTICE_LIFECYCLE_RECONCILIATION_DISABLED') && !this.subjectPracticeObservationOnlyModeEnabled()")
    && service.includes('const skipStartupNormalizationForExplicitObservationOnlyJob')
    && service.includes("if (useCase !== 'online_mock_exam' && !skipStartupNormalizationForExplicitObservationOnlyJob)")
    && service.includes('observationOnlyMode: this.subjectPracticeObservationOnlyModeEnabled()')
    && service.includes('questionPlanEnabled: subjectPracticeQuestionPlanEnabled()')
    && service.includes('questionPlanCellAllowlist')
    && service.includes('questionPlanCellAllowlistFlag: SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG')
    && preflight.includes('observationOnlyMode')
    && service.includes('observation_only_mode_subject_practice_production_disabled'),
  'Observation-only mode must default off while disabling subject-practice production/predictive autorun, startup production queue processing, generic startup generation recovery, and production lifecycle reconciliation when explicitly enabled.'
);
assert(
  preflight.includes('eligible_for_backend_owned_observation_submission')
    && preflight.includes('ready_after_observation_only_backend_start')
    && preflight.includes('ready_after_observation_only_question_plan_backend_start')
    && preflight.includes('ready_after_observation_question_plan_backend_start')
    && preflight.includes('observation_question_plan_not_enabled_for_target_cell')
    && preflight.includes('observation_question_plan_target_cell_missing')
    && preflight.includes('questionPlanReadyForTarget')
    && preflight.includes('questionPlanCellAllowedFor')
    && preflight.includes('wait_for_provider_network_recovery')
    && preflight.includes('provider_network_delivery_recovery')
    && preflight.includes('observationNetworkRecoveryState')
    && preflight.includes('observationBackendBaseUrl')
    && preflight.includes('requestObservationBackendJson')
    && preflight.includes('loadObservationBackendAdmission')
    && preflight.includes('target_backend_readiness')
    && preflight.includes('observation_backend_readiness_unavailable')
    && preflight.includes('observationCooldownStateFor')
    && preflight.includes('observationCooldownState')
    && preflight.includes('observationCooldown:')
    && preflight.includes('chemistryRegressionTransientRefreshState')
    && preflight.includes('onlyStoredCountRefresh')
    && preflight.includes('chemistry_stored_count_refresh_transient_verified_clear')
    && preflight.includes('safeActiveUndercount')
    && preflight.includes('stored_count_refresh_safe_active_undercount')
    && preflight.includes('chemistry_stored_count_refresh_safe_active_undercount')
    && preflight.includes('actualActive > storedRunning')
    && preflight.includes('staleRunning === 0')
    && preflight.includes('chemistryRegressionOriginalStatus')
    && preflight.includes('observation_only_mode_not_enabled_start_validation_backend_before_apply')
    && preflight.includes('const hasActiveWorkWait = waitReasons.some')
    && preflight.includes('const hasCooldownWait = waitReasons.includes')
    && preflight.includes('const hasProviderNetworkRecoveryWait = waitReasons.includes')
    && preflight.includes('wait_for_observation_cooldown')
    && preflight.includes('Wait for the observation cooldown to clear before submitting another explicitly authorized task.')
    && preflight.includes('Wait for provider network delivery recovery after consecutive observation network failures before submitting another live task.')
    && preflight.includes('bounded_one_background_slot_backend_owned')
    && preflight.includes('chemistry_throughput_will_temporarily_share_one_background_slot')
    && preflight.includes('function skipObservationBackendReadiness')
    && preflight.includes("process.env.CSCA_OBSERVATION_BACKEND_READINESS_SKIP === '1'")
    && preflight.includes("'target_backend_readiness_skipped'")
    && preflight.includes('backendReadinessSkipped: Boolean(backendReadinessSkipped)')
    && preflight.includes("warnings.push('observation_backend_readiness_skipped')")
    && preflight.includes('observation_task_cooldown')
    && preflight.includes("local_pre_provider_job.\"provider\" = 'prompt-budget-gate'")
    && service.includes("local_pre_provider_job.\"provider\" = 'prompt-budget-gate'")
    && preflight.includes("'observation_provider_cost_admission_failed'")
    && service.includes("'observation_provider_cost_admission_failed'")
    && observationFailureClassification.includes("return 'provider_cost_admission_failed_before_gateway'")
    && preflight.includes("'connect EACCES [^ ]+:443'")
    && service.includes("'connect EACCES [^ ]+:443'")
    && preflight.includes('cooldownRemainingSeconds')
    && preflight.includes('activeObservationJobCount')
    && preflight.includes("NULLIF(\"prompt_metadata\"->>'observationTaskId', '') IS NOT NULL")
    && preflight.includes('latestObservationJobUpdatedAt')
    && preflight.includes('observation_job_already_active')
    && !preflight.includes("waitReasons.push('chemistry_production_in_flight_wait_before_math_observation')")
    && !preflight.includes("waitReasons.push('math_provider_recent_failures_wait_for_recovery')"),
  'Preflight must use durable backend admission without requiring chemistry to become idle or treating provider delivery failures as family blockers.'
);
assert(
  oneShotHarness.includes('requiredObservationBackendCommandBeforeApply')
    && oneShotHarness.includes('--enable-question-plan')
    && oneShotHarness.includes('--question-plan-cell-allowlist=${target.cellId}')
    && oneShotHarness.includes('`--cell=${target.cellId}`')
    && oneShotHarness.includes('directPreflightBlockers')
    && oneShotHarness.includes('observation_question_plan_not_ready_for_target_cell'),
  'Math one-shot harness preview/apply must require an observation backend started with QuestionPlan enabled for the exact target cell.'
);
assert(
  /const postfixEfficiencyPreview = runNodeJson\('csca-subject-practice-math-postfix-efficiency-gate\.cjs', \[[\s\S]*`--run=\$\{target\.runId\}`,[\s\S]*`--cell=\$\{target\.cellId\}`,[\s\S]*'--hours=72'/.test(oneShotHarness),
  'Math one-shot harness post-fix efficiency preview must be scoped to the exact target cell instead of mixing unrelated math cells.'
);
assert(
  service.includes("workClass: SUBJECT_PRACTICE_OBSERVATION_WORK_CLASS")
    && service.includes("observationTaskId: taskId")
    && service.includes("generationMode: 'subject_practice_production_matrix_observation'"),
  'Observation jobs must carry explicit work class, task ownership, and execution mode metadata.'
);
assert(
  service.includes('const sanitizedObservationTargetProfile = sanitizeTargetProfile(cell.targetProfile);')
    && service.includes('const observationTargetProfile = {')
    && service.includes('targetProfile: observationTargetProfile, ...(retryFeedback ? { repairFeedback: retryFeedback } : {})')
    && service.includes('const processingTargetProfile = freshTargetProfile')
    && service.includes('? normalizeSubjectPracticeProductionTargetProfile({')
    && service.includes('targetProfile: processingTargetProfile ?? freshCell.targetProfile')
    && service.includes("metadataNormalization: 'subject_practice_observation_process_profile_refreshed'"),
  'Observation jobs must normalize legacy cell target profiles during enqueue and process-time cell refresh before scheduler and prompt construction.'
);

function fakeGatewayConfig(overrides = {}) {
  return {
    globalConcurrency: () => 5,
    realtimeConcurrency: () => 3,
    backgroundConcurrency: () => 2,
    realtimeQueueTimeoutMs: () => 500,
    backgroundQueueTimeoutMs: () => 500,
    ...overrides
  };
}

async function testObservationSharesBackgroundFifo() {
  const concurrency = new AiGatewayConcurrencyService(fakeGatewayConfig());
  const background = { runtimeClass: 'background' };
  const chemistryOne = await concurrency.reserve(background);
  const chemistryTwo = await concurrency.reserve(background);
  const acquisitionOrder = [];
  const observationPromise = concurrency.reserve(background).then((reservation) => {
    acquisitionOrder.push('observation');
    return reservation;
  });
  await new Promise((resolve) => setImmediate(resolve));
  const laterChemistryPromise = concurrency.reserve(background).then((reservation) => {
    acquisitionOrder.push('later_chemistry');
    return reservation;
  });
  await new Promise((resolve) => setImmediate(resolve));

  let snapshot = concurrency.snapshot();
  assertEqual(snapshot.backgroundRunning, 2, 'Two chemistry calls must fill, but never exceed, background capacity.');
  assertEqual(snapshot.backgroundQueued, 2, 'Observation and later chemistry must wait in one shared FIFO.');

  chemistryOne.release();
  const observation = await observationPromise;
  snapshot = concurrency.snapshot();
  assertEqual(acquisitionOrder[0], 'observation', 'A queued observation must acquire the next naturally released background slot.');
  assertEqual(snapshot.backgroundRunning, 2, 'Observation admission must not interrupt the other running chemistry call.');
  assertEqual(snapshot.backgroundQueued, 1, 'Later chemistry must remain behind the earlier observation request.');

  chemistryTwo.release();
  const laterChemistry = await laterChemistryPromise;
  assertEqual(acquisitionOrder.join(','), 'observation,later_chemistry', 'Later chemistry must not jump the observation FIFO position.');
  observation.release();
  laterChemistry.release();
  snapshot = concurrency.snapshot();
  assertEqual(snapshot.backgroundRunning, 0, 'Background capacity must return after observation completion.');
  assertEqual(snapshot.backgroundQueued, 0, 'No background waiter may remain after the fake workload drains.');
}

async function testObservationDoesNotConsumeRealtimePool() {
  const concurrency = new AiGatewayConcurrencyService(fakeGatewayConfig());
  const background = { runtimeClass: 'background' };
  const realtime = { runtimeClass: 'realtime' };
  const backgroundReservations = [
    await concurrency.reserve(background),
    await concurrency.reserve(background)
  ];
  const realtimeReservations = [
    await concurrency.reserve(realtime),
    await concurrency.reserve(realtime),
    await concurrency.reserve(realtime)
  ];
  const snapshot = concurrency.snapshot();
  assertEqual(snapshot.backgroundRunning, 2, 'Observation-class work must remain inside the background pool.');
  assertEqual(snapshot.realtimeRunning, 3, 'Realtime capacity must remain independently available up to its configured pool.');
  for (const reservation of [...backgroundReservations, ...realtimeReservations]) reservation.release();
}

async function testObservationSharesPerKeyConcurrency() {
  const keyPool = new AiGatewayKeyPoolService();
  const keys = ['a', 'b'].map((suffix) => ({
    keyId: `deepseek-background-${suffix}`,
    providerId: 'deepseek',
    source: 'env',
    pool: 'background',
    apiKey: `secret-${suffix}`,
    baseUrl: 'https://api.deepseek.test',
    model: 'deepseek-chat',
    enabled: true,
    maxConcurrency: 1
  }));
  const chemistryOne = keyPool.reserve(keys);
  const chemistryTwo = keyPool.reserve(keys);
  assert(chemistryOne && chemistryTwo, 'Two background keys must admit two concurrent chemistry calls.');
  assert(
    chemistryOne.key.keyId !== chemistryTwo.key.keyId,
    'Shared key-pool state must assign concurrent calls to different one-slot keys.'
  );
  const observationWhileFull = keyPool.reserveWithDiagnostics(keys);
  assertEqual(observationWhileFull.reservation, undefined, 'Observation must not overbook a key already used by chemistry.');
  assertEqual(observationWhileFull.miss.reason, 'all_keys_at_concurrency', 'Full per-key capacity must remain visible as retryable delivery pressure.');
  chemistryOne.release({ status: 'success', latencyMs: 10 });
  const observation = keyPool.reserve(keys);
  assert(observation, 'Observation may claim the key only after chemistry naturally releases it.');
  observation.release({ status: 'success', latencyMs: 10 });
  chemistryTwo.release({ status: 'success', latencyMs: 10 });
  assert(
    keyPool.snapshot('deepseek').every((state) => state.currentConcurrency === 0),
    'Per-key capacity must be fully returned after the observation workload drains.'
  );
}

async function testBackgroundQueueTimeoutDoesNotLeakCapacity() {
  const concurrency = new AiGatewayConcurrencyService(fakeGatewayConfig({
    backgroundQueueTimeoutMs: () => 20
  }));
  const background = { runtimeClass: 'background' };
  const chemistryOne = await concurrency.reserve(background);
  const chemistryTwo = await concurrency.reserve(background);
  let timeoutError = null;
  try {
    await concurrency.reserve(background);
  } catch (error) {
    timeoutError = error;
  }
  assertEqual(timeoutError?.message, 'gateway_concurrency_timeout', 'A bounded observation wait must surface the gateway delivery timeout code.');
  let snapshot = concurrency.snapshot();
  assertEqual(snapshot.backgroundRunning, 2, 'A timed-out waiter must not change the running capacity count.');
  assertEqual(snapshot.backgroundQueued, 0, 'A timed-out waiter must be removed from the shared FIFO.');
  chemistryOne.release();
  chemistryTwo.release();
  snapshot = concurrency.snapshot();
  assertEqual(snapshot.backgroundRunning, 0, 'Queue timeout cleanup must not leak background capacity.');
}

async function testGenerationAndReviewReenterFifo() {
  const concurrency = new AiGatewayConcurrencyService(fakeGatewayConfig());
  const background = { runtimeClass: 'background' };
  const chemistry = await concurrency.reserve(background);
  const generation = await concurrency.reserve(background);
  const acquisitionOrder = [];
  const unrelatedPromise = concurrency.reserve(background).then((reservation) => {
    acquisitionOrder.push('unrelated_background');
    return reservation;
  });
  await new Promise((resolve) => setImmediate(resolve));
  generation.release();
  const unrelated = await unrelatedPromise;

  const reviewerPromise = concurrency.reserve(background).then((reservation) => {
    acquisitionOrder.push('reviewer');
    return reservation;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assertEqual(concurrency.snapshot().backgroundQueued, 1, 'Reviewer must reacquire through the shared FIFO after generation releases its slot.');
  unrelated.release();
  const reviewer = await reviewerPromise;
  assertEqual(
    acquisitionOrder.join(','),
    'unrelated_background,reviewer',
    'Generation and review must not hold a background slot continuously across the unrelated queued call.'
  );
  reviewer.release();
  chemistry.release();
  assertEqual(concurrency.snapshot().backgroundRunning, 0, 'Generation/review fake work must return all background capacity.');
}

async function main() {
  await testObservationSharesBackgroundFifo();
  await testObservationDoesNotConsumeRealtimePool();
  await testObservationSharesPerKeyConcurrency();
  await testBackgroundQueueTimeoutDoesNotLeakCapacity();
  await testGenerationAndReviewReenterFifo();
  console.log('Subject-practice backend-owned observation task rules passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
