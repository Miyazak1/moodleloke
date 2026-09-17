#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  buildSubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor,
  subjectPracticeObservationExpectedGeneratorVersionFor,
  SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  subjectPracticeProductionShadowScopeContractFor,
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');
const {
  subjectPracticeLocalGeneratorShadowRoutingPolicy
} = require('../backend/src/ai-questioning/question-generator-provider.service');
const {
  subjectPracticeObservationBatchResumePlan
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-resume-policy');
const {
  SUBJECT_PRACTICE_OBSERVATION_SUBMISSION_PLAN_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-scope-binding-policy');
const {
  SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION
} = require('../backend/src/ai-questioning/ai-questioning.service');
const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-solver');
const {
  SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-independent-oracle');
const {
  SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-local-generator');
const {
  SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION,
  SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-solver');
const {
  SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-independent-oracle');
const {
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} = require('../backend/src/ai-questioning/subject-practice-candidate-output-novelty-policy');
const {
  SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
} = require('../backend/src/ai-questioning/subject-practice-source-corpus-scan-policy');
const {
  SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-local-shadow-candidate-seed-policy');
const {
  authorizationRefusalFor,
  compactQualificationResult,
  executeResumePlan,
  PROGRESS_PROTOCOL,
  SYSTEMIC_FAILURE_FUSE_POLICY_VERSION,
  qualificationNextActionFor,
  resumeContextFor,
  targetBackendRuntimeFromDirectReadiness,
  targetBackendFailureCodes,
  unsignedQualificationPrecheckFor
} = require('./csca-subject-practice-local-shadow-family-qualification-run.cjs');

const contract = subjectPracticeProductionShadowScopeContractFor(
  'math',
  'elementary_function_direct_property',
  'math_elementary_function_relation_v1'
);
if (!contract) throw new Error('Math elementary direct-property contract fixture is missing.');

const manifest = buildSubjectPracticeObservationBatchManifest(
  Array.from({ length: 8 }, () => contract.expectedScopeIds)
    .flat()
    .map((plannedScopeId, index) => ({
      ordinal: index + 1,
      subject: 'math',
      productionRunId: 1,
      productionCellId: 16,
      taskFamily: contract.taskFamily,
      planTemplate: contract.planTemplate,
      plannedScopeId
    }))
);
const batchId = subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 }).batchId;

function taskFor(ordinal, status = 'succeeded', envelopeOrdinal = ordinal) {
  return {
    id: `runner-task-${ordinal}`,
    status,
    filterSnapshot: {
      sealedObservationBatch: subjectPracticeObservationBatchEnvelopeFor({
        manifest,
        taskOrdinal: envelopeOrdinal
      })
    },
    result: status === 'succeeded' ? { generatedQuestionId: ordinal } : null,
    error: status === 'failed' ? 'fixture_failure' : null
  };
}

async function rejectsAsync(fn, pattern) {
  try {
    await fn();
    return false;
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
}

async function main() {
  const completeTasks = manifest.tasks.map((item) => taskFor(
    item.ordinal,
    item.ordinal === 1 ? 'failed' : 'succeeded'
  ));
  const completeContext = resumeContextFor(batchId, completeTasks);
  const freshSubmittedOrdinals = [];
  const freshProgress = [];
  let freshNowMs = 0;
  let freshWaitCount = 0;
  const fresh = await executeResumePlan({
    context: {
      ...completeContext,
      resumePlan: subjectPracticeObservationBatchResumePlan({ manifest, existingTasks: [] })
    },
    existingTasks: [],
    now: () => freshNowMs,
    onProgress: (event) => freshProgress.push(event),
    waitForExistingTask: async () => {
      freshWaitCount += 1;
      throw new Error('Fresh batch must not wait.');
    },
    submitMissingTask: async (item) => {
      freshSubmittedOrdinals.push(item.ordinal);
      freshNowMs += 100;
      return taskFor(item.ordinal, item.ordinal === 7 ? 'failed' : 'succeeded');
    }
  });
  const systemicSubmittedOrdinals = [];
  const systemicFuse = await executeResumePlan({
    context: {
      ...completeContext,
      resumePlan: subjectPracticeObservationBatchResumePlan({ manifest, existingTasks: [] })
    },
    existingTasks: [],
    waitForExistingTask: async () => {
      throw new Error('Systemic failure fixture must not wait.');
    },
    submitMissingTask: async (item) => {
      systemicSubmittedOrdinals.push(item.ordinal);
      return {
        ...taskFor(item.ordinal, 'failed'),
        error: 'scenario_blueprint_task_envelope_invalid'
      };
    }
  });
  let completeWaitCount = 0;
  let completeSubmitCount = 0;
  const complete = await executeResumePlan({
    context: completeContext,
    existingTasks: completeTasks,
    onProgress: () => {
      throw new Error('Progress observer failures must not alter execution.');
    },
    waitForExistingTask: async () => {
      completeWaitCount += 1;
      throw new Error('Complete batch must not wait.');
    },
    submitMissingTask: async () => {
      completeSubmitCount += 1;
      throw new Error('Complete batch must not submit.');
    }
  });

  const partialTasks = [taskFor(1, 'failed'), taskFor(2, 'running')];
  const partialContext = resumeContextFor(batchId, partialTasks);
  const waitedOrdinals = [];
  const submittedOrdinals = [];
  let partialNowMs = 0;
  const partial = await executeResumePlan({
    context: partialContext,
    existingTasks: partialTasks,
    now: () => partialNowMs,
    waitForExistingTask: async (item) => {
      waitedOrdinals.push(item.ordinal);
      partialNowMs += 400;
      return taskFor(item.ordinal, 'succeeded');
    },
    submitMissingTask: async (item) => {
      submittedOrdinals.push(item.ordinal);
      partialNowMs += 100;
      return taskFor(item.ordinal, 'succeeded');
    }
  });

  let activeSubmitCount = 0;
  const activeRemainsRejected = await rejectsAsync(() => executeResumePlan({
    context: partialContext,
    existingTasks: partialTasks,
    waitForExistingTask: async (item) => taskFor(item.ordinal, 'running'),
    submitMissingTask: async () => {
      activeSubmitCount += 1;
      return taskFor(3, 'succeeded');
    }
  }), /remained active/);

  const oneExisting = [taskFor(1, 'succeeded')];
  const oneExistingContext = resumeContextFor(batchId, oneExisting);
  let tamperedSubmitCount = 0;
  const tamperedSubmissionRejected = await rejectsAsync(() => executeResumePlan({
    context: oneExistingContext,
    existingTasks: oneExisting,
    waitForExistingTask: async () => {
      throw new Error('No active task expected.');
    },
    submitMissingTask: async (item) => {
      tamperedSubmitCount += 1;
      return taskFor(item.ordinal, 'succeeded', item.ordinal + 1);
    }
  }), /sealed terminal verification/);

  const qualifyingResults = manifest.tasks.map((descriptor) => ({
    ordinal: descriptor.ordinal,
    plannedScopeId: descriptor.plannedScopeId,
    taskId: `qualification-task-${descriptor.ordinal}`,
    status: 'succeeded',
    error: null,
    result: {
      generatedQuestionId: 10_000 + descriptor.ordinal,
      gateDecision: 'publishable',
      plannedTaskFamily: descriptor.taskFamily,
      classifiedTaskFamily: descriptor.taskFamily,
      observedPlanTemplate: descriptor.planTemplate,
      observedScopeId: descriptor.plannedScopeId,
      generatorProvider: 'local-deterministic',
      generatorVersion: subjectPracticeObservationExpectedGeneratorVersionFor(descriptor),
      providerAttemptLimit: 0,
      automatedCandidateLeakageGate: {
        policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
        status: 'clear',
        scannedRevisionCount: 151,
        blockedRevisionCount: 0,
        ambiguousRevisionCount: 0,
        revisionMatchSetSha256: 'a'.repeat(64),
        revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
        structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
        normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
        sourceCorpusSnapshotSha256: 'b'.repeat(64),
        sourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
        sourceCorpusRevisionCount: 151,
        sourceCorpusInventoryComplete: true,
        sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
        failClosed: true,
        sourceContentExposedToGenerator: false
      }
    }
  }));
  const qualifyingPrecheck = unsignedQualificationPrecheckFor({ manifest, results: qualifyingResults });
  const oneQualityRejection = structuredClone(qualifyingResults);
  oneQualityRejection[0].result.gateDecision = 'review_failed';
  const oneQualityRejectionPrecheck = unsignedQualificationPrecheckFor({
    manifest,
    results: oneQualityRejection
  });
  const oneLeakageFailure = structuredClone(qualifyingResults);
  oneLeakageFailure[0].result.automatedCandidateLeakageGate.status = 'blocked';
  oneLeakageFailure[0].result.automatedCandidateLeakageGate.blockedRevisionCount = 1;
  const oneLeakageFailurePrecheck = unsignedQualificationPrecheckFor({
    manifest,
    results: oneLeakageFailure
  });
  const oneMissingCandidate = structuredClone(qualifyingResults);
  oneMissingCandidate[0] = {
    ...oneMissingCandidate[0],
    status: 'failed',
    error: 'generation_failed',
    result: { generatedQuestionId: null, noCandidate: true }
  };
  const oneMissingCandidatePrecheck = unsignedQualificationPrecheckFor({
    manifest,
    results: oneMissingCandidate
  });
  const qualifyingNextAction = qualificationNextActionFor({
    batchId,
    unsignedPrecheck: qualifyingPrecheck
  });
  const blockedNextAction = qualificationNextActionFor({
    batchId,
    unsignedPrecheck: oneMissingCandidatePrecheck
  });
  const compactResult = compactQualificationResult({
    mode: 'fixture_apply',
    reportVersion: 'fixture-v1',
    status: 'completed',
    authorizationPlan: completeContext.authorizationPlan,
    resumeDigest: completeContext.resumeDigest,
    resumePlan: completeContext.resumePlan,
    providerImpact: 'none_provider_attempt_limit_zero',
    maximumEstimatedCostUsd: 0,
    databaseImpact: 'fixture_only',
    studentPublicationImpact: 'none_suppressed',
    executionMetrics: complete.executionMetrics,
    scorecard: { overall: { requested: 32, publishableCount: 32 } },
    results: qualifyingResults,
    scenarioDiversity: qualifyingPrecheck.metrics.scenarioDiversity,
    unsignedQualificationPrecheck: qualifyingPrecheck,
    nextAction: qualifyingNextAction,
    nonSuccessCount: 0
  });

  const readyTargetRuntime = {
    observationBackendApiCompatible: true,
    observationBackendReadinessLoaded: true,
    observationOnlyMode: true,
    localGeneratorShadowEnabled: true,
    questionPlanEnabled: true,
    observationSubmissionPlanPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SUBMISSION_PLAN_POLICY_VERSION,
    reviewGatePolicyVersion: SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION,
    chemistryAcidBaseSolverVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION,
    chemistryAcidBaseIndependentOracleVersion:
      SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION,
    candidateOutputNoveltyPolicyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
    candidateNoveltyCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
    candidateNoveltyMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
    structuredSourceCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    sourceCorpusNormalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
    localShadowCandidateSeedPolicyVersion:
      SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
    productionShadowScopeRegistryVersion:
      SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    localGeneratorShadowRoutingVersion:
      subjectPracticeLocalGeneratorShadowRoutingPolicy().routingVersion,
    readyForLocalZeroProviderSubmission: true,
    readyForLocalZeroProviderExecution: true,
    cellAllowlist: '24'
  };
  const readyTargetFailures = targetBackendFailureCodes(readyTargetRuntime, 24);
  const incompatibleTargetFailures = targetBackendFailureCodes({}, 24);
  const wrongCellFailures = targetBackendFailureCodes({ ...readyTargetRuntime, cellAllowlist: '42' }, 24);
  const oldBackendCampaignFailures = targetBackendFailureCodes(readyTargetRuntime, 24, false, true);
  const campaignReadyFailures = targetBackendFailureCodes({
    ...readyTargetRuntime,
    observationManifestPolicyVersionsSupported: [SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION]
  }, 24, false, true);
  const chemistryReadyFailures = targetBackendFailureCodes(readyTargetRuntime, 42, false, false, 'chemistry');
  const staleChemistrySolverFailures = targetBackendFailureCodes({
    ...readyTargetRuntime,
    cellAllowlist: '42',
    chemistryAcidBaseSolverVersion: 'stale-solver'
  }, 42, false, false, 'chemistry');
  const staleChemistryOracleFailures = targetBackendFailureCodes({
    ...readyTargetRuntime,
    cellAllowlist: '42',
    chemistryAcidBaseIndependentOracleVersion: 'stale-oracle'
  }, 42, false, false, 'chemistry');
  const staleNoveltyContractFailures = targetBackendFailureCodes({
    ...readyTargetRuntime,
    candidateOutputNoveltyPolicyVersion: 'stale-novelty-policy'
  }, 24);
  const staleCandidateSeedFailures = targetBackendFailureCodes({
    ...readyTargetRuntime,
    localShadowCandidateSeedPolicyVersion: 'stale-candidate-seed-policy'
  }, 24);
  const derivativeReadyRuntime = {
    ...readyTargetRuntime,
    cellAllowlist: '10',
    mathDerivativeLocalGeneratorVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
    mathDerivativeSolverVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION,
    mathDerivativeScopeVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION,
    mathDerivativeIndependentOracleVersion:
      SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION
  };
  const derivativeReadyFailures = targetBackendFailureCodes(
    derivativeReadyRuntime, 10, false, false, 'math', 'derivative_direct_evaluation'
  );
  const staleDerivativeFailures = targetBackendFailureCodes({
    ...derivativeReadyRuntime,
    mathDerivativeSolverVersion: 'stale-derivative-solver'
  }, 10, false, false, 'math', 'derivative_direct_evaluation');
  const {
    observationBackendApiCompatible: ignoredApiCompatibility,
    observationBackendReadinessLoaded: ignoredReadinessLoaded,
    cellAllowlist: directCellAllowlist,
    ...directReadinessFields
  } = derivativeReadyRuntime;
  const mappedDirectReadiness = targetBackendRuntimeFromDirectReadiness({
    ...directReadinessFields,
    questionPlanCellAllowlist: directCellAllowlist
  });
  const mappedDirectReadinessFailures = targetBackendFailureCodes(
    mappedDirectReadiness, 10, false, false, 'math', 'derivative_direct_evaluation'
  );
  const staleAuthorizationRefusal = authorizationRefusalFor({
    authorizationPlan: {
      subject: 'physics',
      sealedBatchId: 'local-shadow-current-fixture',
      totalTaskCount: 32
    },
    baseUrl: 'http://127.0.0.1:3002',
    providedBatchId: 'local-shadow-stale-fixture',
    providedPlanDigest: 'stale-plan-digest',
    requiredPlanDigest: 'current-plan-digest'
  });

  const checks = {
    previewTargetBackendReadinessIsFailClosed:
      readyTargetFailures.length === 0
      && incompatibleTargetFailures.includes('observation_backend_api_incompatible')
      && incompatibleTargetFailures.includes('observation_backend_readiness_missing')
      && wrongCellFailures.includes('exact_cell_allowlist_incomplete'),
    campaignManifestRequiresExplicitBackendCapability:
      oldBackendCampaignFailures.includes('target_backend_campaign_manifest_not_supported')
      && campaignReadyFailures.length === 0,
    chemistryBackendVersionsAreFailClosed:
      chemistryReadyFailures.includes('exact_cell_allowlist_incomplete')
      && !chemistryReadyFailures.includes('target_backend_chemistry_solver_policy_stale')
      && !chemistryReadyFailures.includes('target_backend_chemistry_independent_oracle_policy_stale')
      && staleChemistrySolverFailures.includes('target_backend_chemistry_solver_policy_stale')
      && staleChemistryOracleFailures.includes('target_backend_chemistry_independent_oracle_policy_stale'),
    candidateNoveltyEvidenceContractIsFailClosed:
      !readyTargetFailures.includes('target_backend_candidate_novelty_evidence_contract_stale')
      && staleNoveltyContractFailures.includes('target_backend_candidate_novelty_evidence_contract_stale'),
    sealedCandidateSeedPolicyIsFailClosed:
      !readyTargetFailures.includes('target_backend_local_shadow_candidate_seed_policy_stale')
      && staleCandidateSeedFailures.includes('target_backend_local_shadow_candidate_seed_policy_stale'),
    derivativeRuntimeBindingIsFailClosed:
      derivativeReadyFailures.length === 0
      && staleDerivativeFailures.includes('target_backend_math_derivative_solver_stale'),
    directAuthenticatedReadinessMapsToRuntimeContract:
      ignoredApiCompatibility === true
      && ignoredReadinessLoaded === true
      && mappedDirectReadiness.observationBackendApiCompatible === true
      && mappedDirectReadiness.observationBackendReadinessLoaded === true
      && mappedDirectReadiness.cellAllowlist === '10'
      && mappedDirectReadinessFailures.length === 0,
    staleAuthorizationIsExplicitlyReportedBeforeExecution:
      staleAuthorizationRefusal.status === 'not_executed_authorization_mismatch'
      && staleAuthorizationRefusal.executionStarted === false
      && staleAuthorizationRefusal.mismatchCodes.join(',') === 'sealed_batch_id_mismatch,plan_digest_mismatch'
      && staleAuthorizationRefusal.observationTasksCreated === 0
      && staleAuthorizationRefusal.candidatesWritten === 0
      && staleAuthorizationRefusal.providerCallCount === 0
      && staleAuthorizationRefusal.studentPublicationCount === 0
      && staleAuthorizationRefusal.requiredAuthorization.exactAuthorizationText.includes('执行物理 batch local-shadow-current-fixture')
      && staleAuthorizationRefusal.requiredAuthorization.exactAuthorizationText.includes('确认计划摘要 current-plan-digest'),
    freshBatchUsesSharedCoreAndSubmitsAllOrdinalsInOrder:
      freshWaitCount === 0
      && freshSubmittedOrdinals.join(',') === manifest.tasks.map((item) => item.ordinal).join(',')
      && fresh.results.length === 32
      && fresh.results.every((item) => item.submittedNow === true),
    freshBatchContinuesAfterTerminalFailureAndPreservesIt:
      fresh.results[6]?.status === 'failed'
      && fresh.results.filter((item) => item.status !== 'succeeded').length === 1
      && freshSubmittedOrdinals.length === 32,
    identicalSystemicFailuresPauseBeforeWastingWholeBatch:
      systemicFuse.systemicFailureFuse.policyVersion === SYSTEMIC_FAILURE_FUSE_POLICY_VERSION
      && systemicFuse.systemicFailureFuse.triggered === true
      && systemicFuse.systemicFailureFuse.failureCode === 'scenario_blueprint_task_envelope_invalid'
      && systemicFuse.systemicFailureFuse.consecutiveFailureCount === 3
      && systemicFuse.systemicFailureFuse.remainingUnsubmittedCount === 29
      && systemicSubmittedOrdinals.join(',') === '1,2,3'
      && systemicFuse.results.length === 3,
    ordinaryTerminalQualityFailureDoesNotTriggerSystemicFuse:
      fresh.systemicFailureFuse.triggered === false
      && fresh.systemicFailureFuse.ordinaryQualityFailuresTriggerFuse === false
      && freshSubmittedOrdinals.length === 32,
    progressEventsAreCompleteOrderedAndContentFree:
      freshProgress.length === 32
      && freshProgress.every((event, index) => event.protocol === PROGRESS_PROTOCOL
        && event.batchId === batchId
        && event.completedCount === index + 1
        && event.expectedTaskCount === 32
        && event.ordinal === index + 1
        && event.ordinalElapsedMs === 100
        && event.batchElapsedMs === (index + 1) * 100
        && event.candidateContentIncluded === false
        && !Object.hasOwn(event, 'result')
        && !Object.hasOwn(event, 'error')),
    progressObserverFailureCannotInterruptBatch:
      complete.results.length === 32,
    freshExecutionMetricsUseOnlySubmittedTaskDurations:
      fresh.executionMetrics.totalElapsedMs === 3_200
      && fresh.executionMetrics.existingWaitElapsedMs === 0
      && fresh.executionMetrics.submittedCount === 32
      && fresh.executionMetrics.reusedCount === 0
      && fresh.executionMetrics.submittedElapsedMs === 3_200
      && fresh.executionMetrics.averageSubmittedElapsedMs === 100,
    completeTerminalBatchPerformsNoWaitOrSubmission:
      completeWaitCount === 0
      && completeSubmitCount === 0
      && complete.results.length === 32
      && complete.results.every((item) => item.submittedNow === false),
    terminalFailureRemainsInCompleteBatchDenominator:
      complete.results[0]?.status === 'failed'
      && complete.results.filter((item) => item.status !== 'succeeded').length === 1,
    resumeAuthorizationPreservesProductionProfileBinding:
      completeContext.authorizationPlan.productionProfileBindingPolicyVersion === manifest.productionProfileBindingPolicyVersion
      && completeContext.authorizationPlan.productionProfileBindingDigest === manifest.tasks[0].productionProfileBindingDigest,
    partialBatchWaitsThenSubmitsOnlyMissingOrdinals:
      waitedOrdinals.join(',') === '2'
      && submittedOrdinals.join(',') === Array.from({ length: 30 }, (_, index) => index + 3).join(',')
      && partial.results.length === 32
      && partial.results.filter((item) => item.submittedNow).length === 30,
    partialBatchPreservesExistingFailure:
      partial.results[0]?.status === 'failed'
      && partial.results[0]?.submittedNow === false,
    partialExecutionMetricsSeparateWaitSubmitAndReuse:
      partial.executionMetrics.totalElapsedMs === 3_400
      && partial.executionMetrics.existingWaitElapsedMs === 400
      && partial.executionMetrics.submittedCount === 30
      && partial.executionMetrics.reusedCount === 2
      && partial.executionMetrics.submittedElapsedMs === 3_000
      && partial.executionMetrics.averageSubmittedElapsedMs === 100,
    stillActiveTaskFailsBeforeAnySubmission:
      activeRemainsRejected && activeSubmitCount === 0,
    submittedTaskMustMatchSealedOrdinalAndBeTerminal:
      tamperedSubmissionRejected && tamperedSubmitCount === 1,
    completeCleanBatchIsReadyOnlyForSignedExport:
      qualifyingPrecheck.status === 'ready_for_hmac_qualification_export'
      && qualifyingPrecheck.blockers.length === 0
      && qualifyingPrecheck.metrics.candidateYieldRate === 1
      && qualifyingPrecheck.metrics.publishableRate === 1
      && qualifyingPrecheck.advisoryOnly === true
      && qualifyingPrecheck.releaseQualification === false
      && qualifyingPrecheck.studentPublicationAuthorized === false,
    publishableThresholdAllowsOneQualityRejectionInThirtyTwo:
      oneQualityRejectionPrecheck.status === 'ready_for_hmac_qualification_export'
      && oneQualityRejectionPrecheck.metrics.publishableRate === 31 / 32,
    anyLeakageFailureBlocksSignedExportPrecheck:
      oneLeakageFailurePrecheck.status === 'not_ready_for_hmac_qualification_export'
      && oneLeakageFailurePrecheck.blockers.includes('unsigned_precheck_candidate_leakage_not_clear'),
    missingCandidateFailsPerScopeYieldAndUnexpectedFailure:
      oneMissingCandidatePrecheck.status === 'not_ready_for_hmac_qualification_export'
      && oneMissingCandidatePrecheck.blockers.includes('unsigned_precheck_per_scope_candidate_threshold_not_met')
      && oneMissingCandidatePrecheck.blockers.includes('unsigned_precheck_unexpected_failure'),
    onlyCleanPrecheckReceivesHmacExportCommand:
      qualifyingNextAction.status === 'run_read_only_hmac_qualification_export'
      && qualifyingNextAction.command.includes(`--batch-id=${batchId}`)
      && qualifyingNextAction.maySelectCandidateIds === false
      && qualifyingNextAction.studentPublicationAuthorized === false,
    failedBatchIsImmutableAndCannotCherryPickOrRetryOrdinals:
      blockedNextAction.status === 'repair_mechanism_before_new_sealed_batch'
      && blockedNextAction.existingBatchMustRemainImmutable === true
      && blockedNextAction.failedOrdinalsMustRemainInDenominator === true
      && blockedNextAction.mayRetryOrReplaceOrdinalsInExistingBatch === false
      && blockedNextAction.maySelectCandidateIds === false
      && blockedNextAction.newBatchAllowedOnlyAfterMechanismChangeAndFreshPreview === true
      && !Object.hasOwn(blockedNextAction, 'command'),
    compactApplyResultIsContentFreeAndKeepsQualificationEvidence:
      compactResult.resultDiagnostics.candidateContentIncluded === false
      && compactResult.resultDiagnostics.terminalResultCount === 32
      && compactResult.resultDiagnostics.gateDecisionCounts.publishable === 32
      && compactResult.resultDiagnostics.leakageStatusCounts.clear === 32
      && compactResult.unsignedQualificationPrecheck.status === 'ready_for_hmac_qualification_export'
      && compactResult.nextAction.status === 'run_read_only_hmac_qualification_export'
      && !Object.hasOwn(compactResult, 'results')
      && !JSON.stringify(compactResult).includes('generatedQuestionId')
  };
  const report = {
    mode: 'subject_practice_local_shadow_family_resume_runner_self_test',
  reportVersion: 'subject-practice-local-shadow-family-resume-runner-self-test-v13-direct-readiness-normalized',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    expectedTaskCount: manifest.tasks.length,
    providerImpact: 'none_callbacks_fixture_only',
    databaseImpact: 'none_no_database_connection',
    publicationImpact: 'none'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
