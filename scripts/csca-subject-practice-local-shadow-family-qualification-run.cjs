#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const path = require('node:path');
const fs = require('node:fs');
const { loadEnv } = require('./load-env.cjs');
loadEnv(path.resolve(__dirname, '..'));

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const { buildReport } = require('./csca-subject-practice-local-shadow-batch-preflight.cjs');
const { validationProtocolForTarget } = require('./lib/subject-practice-validation-protocol.cjs');
const {
  assertRuntime,
  digestFor,
  requestJson,
  resolveAdminToken,
  summarizeResults,
  waitForTask
} = require('./csca-subject-practice-local-shadow-three-subject-run.cjs');
const {
  buildSubjectPracticeObservationBatchManifest,
  buildSubjectPracticeObservationCampaignManifest,
  subjectPracticeObservationBatchEnvelopeFor,
  subjectPracticeHistoricalObservationBatchEnvelopeFor,
  SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT,
  SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION,
  SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION,
  SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS
} = require('../backend/src/ai-questioning/subject-practice-family-automation-qualification-policy');
const {
  subjectPracticeProductionShadowScopeContractFor,
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');
const {
  subjectPracticeLocalGeneratorShadowRoutingPolicy
} = require('../backend/src/ai-questioning/question-generator-provider.service');
const {
  scopeCounts,
  selectQualificationFamily
} = require('./lib/subject-practice-family-qualification-batch.cjs');
const {
  subjectPracticeObservationBatchResumePlan
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-resume-policy');
const {
  scoreSubjectPracticeObservationBatchEvidence
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-evidence-policy');
const {
  SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
  subjectPracticeScenarioDiversityBatchMetrics
} = require('../backend/src/ai-questioning/subject-practice-scenario-diversity-policy');
const {
  SUBJECT_PRACTICE_OBSERVATION_SUBMISSION_PLAN_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-scope-binding-policy');
const {
  buildSubjectPracticeObservationScenarioBlueprintAddendum,
  assertSubjectPracticeObservationScenarioBlueprintAddendum,
  assertSubjectPracticeHistoricalObservationScenarioBlueprintAddendum,
  subjectPracticeObservationScenarioBlueprintTaskEnvelopeFor,
  SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_ADDENDUM_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-addendum-policy');
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
  SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION,
  subjectPracticeDynamicScenarioQualificationDecision
} = require('../backend/src/ai-questioning/subject-practice-dynamic-scenario-qualification-policy');
const {
  SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-local-shadow-candidate-seed-policy');

function scenarioDiversityForResults(expectedCount, results) {
  return subjectPracticeScenarioDiversityBatchMetrics({
    expectedCount,
    evidence: results.map((item) => recordFrom(item.result)?.scenarioEvidence).filter(Boolean)
  });
}

const ACTIONS = {
  math: 'math_scheduler_v2',
  physics: 'physics_scheduler_v2',
  chemistry: 'chemistry_scheduler_v2'
};
const COST_POLICY = 'guarded-observation-zero-provider-cost-reservation-v1';
const PROGRESS_PROTOCOL = 'subject-practice-local-shadow-family-qualification-progress-v1';
const SYSTEMIC_FAILURE_FUSE_POLICY_VERSION =
  'subject-practice-local-shadow-systemic-failure-fuse-v1-three-consecutive';
const SYSTEMIC_FAILURE_FUSE_THRESHOLD = 3;
const AUTHORIZATION_REFUSAL_REPORT_VERSION =
  'subject-practice-local-shadow-family-authorization-refusal-v1-exact-batch-and-plan';

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function candidateNoveltyPolicyBinding() {
  return {
    candidateOutputNoveltyPolicyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
    candidateNoveltyCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
    candidateNoveltyMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
    structuredSourceCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
    sourceCorpusNormalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
  };
}

function candidateNoveltyPolicyBindingMatches(runtime) {
  const expected = candidateNoveltyPolicyBinding();
  return Object.entries(expected).every(([key, value]) => clean(runtime?.[key]) === value);
}

function authorizationRefusalFor({
  authorizationPlan,
  baseUrl,
  providedBatchId,
  providedPlanDigest,
  requiredPlanDigest
}) {
  const subjectLabels = { math: '数学', physics: '物理', chemistry: '化学' };
  const requiredBatchId = clean(authorizationPlan?.sealedBatchId);
  const batchIdMatched = clean(providedBatchId) === requiredBatchId;
  const planDigestMatched = clean(providedPlanDigest) === clean(requiredPlanDigest);
  const subjectLabel = subjectLabels[clean(authorizationPlan?.subject).toLowerCase()]
    ?? clean(authorizationPlan?.subject)
    ?? '指定科目';
  const exactAuthorizationText =
    `授权在 ${baseUrl} 执行${subjectLabel} batch ${requiredBatchId}，确认计划摘要 ${requiredPlanDigest}，`
    + `允许写入${authorizationPlan.totalTaskCount}个本地观察任务及候选题，Provider调用上限0、费用上限$0，禁止发布学生端。`;
  return {
    mode: 'local_shadow_family_qualification_authorization_refusal',
    reportVersion: AUTHORIZATION_REFUSAL_REPORT_VERSION,
    status: 'not_executed_authorization_mismatch',
    executionStarted: false,
    mismatchCodes: [
      ...(!batchIdMatched ? ['sealed_batch_id_mismatch'] : []),
      ...(!planDigestMatched ? ['plan_digest_mismatch'] : [])
    ],
    providedAuthorization: {
      sealedBatchId: clean(providedBatchId) || null,
      planDigest: clean(providedPlanDigest) || null
    },
    requiredAuthorization: {
      sealedBatchId: requiredBatchId,
      planDigest: clean(requiredPlanDigest),
      exactAuthorizationText
    },
    observationTasksCreated: 0,
    candidatesWritten: 0,
    providerCallCount: 0,
    estimatedCostUsd: 0,
    studentPublicationCount: 0,
    databaseImpact: 'none_read_only_preflight_only'
  };
}

function observationBackendStartCommandFor(baseUrl, productionCellId) {
  let port = '3001';
  try {
    const parsed = new URL(baseUrl);
    if (parsed.port && /^\d+$/.test(parsed.port)) port = parsed.port;
  } catch {
    // The request path will reject an invalid base URL; keep the safe default for operator guidance.
  }
  return `npm.cmd run backend:dev:observation:local-shadow -- --port=${port} --question-plan-cell-allowlist=${productionCellId}`;
}

function targetBackendFailureCodes(
  runtime,
  productionCellId,
  requiresScenarioBlueprintEnvelope = false,
  requiresCampaignManifest = false,
  subject = '',
  taskFamily = ''
) {
  const failures = [];
  if (runtime?.observationBackendApiCompatible !== true) failures.push('observation_backend_api_incompatible');
  if (runtime?.observationBackendReadinessLoaded !== true) failures.push('observation_backend_readiness_missing');
  if (runtime?.observationOnlyMode !== true) failures.push('observation_only_mode_required');
  if (runtime?.localGeneratorShadowEnabled !== true) failures.push('local_generator_shadow_required');
  if (runtime?.questionPlanEnabled !== true) failures.push('question_plan_required');
  if (clean(runtime?.observationSubmissionPlanPolicyVersion)
    !== SUBJECT_PRACTICE_OBSERVATION_SUBMISSION_PLAN_POLICY_VERSION) {
    failures.push('target_backend_submission_plan_policy_stale');
  }
  if (clean(runtime?.reviewGatePolicyVersion) !== SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION) {
    failures.push('target_backend_review_gate_policy_stale');
  }
  if (!candidateNoveltyPolicyBindingMatches(runtime)) {
    failures.push('target_backend_candidate_novelty_evidence_contract_stale');
  }
  if (clean(runtime?.localShadowCandidateSeedPolicyVersion)
    !== SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION) {
    failures.push('target_backend_local_shadow_candidate_seed_policy_stale');
  }
  if (clean(runtime?.productionShadowScopeRegistryVersion)
    !== SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION) {
    failures.push('target_backend_production_shadow_scope_registry_stale');
  }
  if (clean(runtime?.localGeneratorShadowRoutingVersion)
    !== subjectPracticeLocalGeneratorShadowRoutingPolicy().routingVersion) {
    failures.push('target_backend_local_generator_shadow_routing_stale');
  }
  if (clean(subject).toLowerCase() === 'math'
    && clean(taskFamily).toLowerCase() === 'derivative_direct_evaluation') {
    if (clean(runtime?.mathDerivativeLocalGeneratorVersion)
      !== SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION) {
      failures.push('target_backend_math_derivative_generator_stale');
    }
    if (clean(runtime?.mathDerivativeSolverVersion) !== SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION) {
      failures.push('target_backend_math_derivative_solver_stale');
    }
    if (clean(runtime?.mathDerivativeScopeVersion) !== SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION) {
      failures.push('target_backend_math_derivative_scope_stale');
    }
    if (clean(runtime?.mathDerivativeIndependentOracleVersion)
      !== SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION) {
      failures.push('target_backend_math_derivative_independent_oracle_stale');
    }
  }
  if (clean(subject).toLowerCase() === 'chemistry') {
    if (clean(runtime?.chemistryAcidBaseSolverVersion)
      !== SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION) {
      failures.push('target_backend_chemistry_solver_policy_stale');
    }
    if (clean(runtime?.chemistryAcidBaseIndependentOracleVersion)
      !== SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION) {
      failures.push('target_backend_chemistry_independent_oracle_policy_stale');
    }
  }
  if (runtime?.readyForLocalZeroProviderSubmission !== true) failures.push('local_zero_provider_submission_not_ready');
  if (runtime?.readyForLocalZeroProviderExecution !== true) failures.push('local_zero_provider_execution_not_ready');
  const allowlist = clean(runtime?.cellAllowlist).split(/[,;\s]+/).filter(Boolean);
  if (!allowlist.includes('*') && !allowlist.includes(String(productionCellId))) {
    failures.push('exact_cell_allowlist_incomplete');
  }
  if (requiresScenarioBlueprintEnvelope && (
    runtime?.scenarioBlueprintObservationEnvelopeSupported !== true
    || clean(runtime?.scenarioBlueprintObservationEnvelopePolicyVersion)
      !== SUBJECT_PRACTICE_OBSERVATION_SCENARIO_BLUEPRINT_ADDENDUM_POLICY_VERSION
  )) failures.push('target_backend_dynamic_scenario_envelope_not_supported');
  if (requiresCampaignManifest && !(
    Array.isArray(runtime?.observationManifestPolicyVersionsSupported)
    && runtime.observationManifestPolicyVersionsSupported.includes(
      SUBJECT_PRACTICE_OBSERVATION_CAMPAIGN_MANIFEST_POLICY_VERSION
    )
  )) failures.push('target_backend_campaign_manifest_not_supported');
  return [...new Set(failures)];
}

function targetBackendRuntimeFromDirectReadiness(readiness) {
  const value = readiness && typeof readiness === 'object' && !Array.isArray(readiness)
    ? readiness
    : {};
  return {
    ...value,
    observationBackendApiCompatible: true,
    observationBackendReadinessLoaded: Object.keys(value).length > 0,
    cellAllowlist: clean(value.questionPlanCellAllowlist)
  };
}

function compactQualificationPreview(report) {
  const { plannedScopeSequence, ...authorizationPlan } = report.authorizationPlan;
  return {
    mode: report.mode,
    reportVersion: report.reportVersion,
    status: report.status,
    authorizationPlan: {
      ...authorizationPlan,
      plannedScopeSequenceLength: plannedScopeSequence.length,
      plannedScopeSequenceDigest: digestFor(plannedScopeSequence)
    },
    planDigest: report.planDigest,
    sealedObservationBatch: report.sealedObservationBatch ? {
      policyVersion: report.sealedObservationBatch.manifest?.policyVersion ?? null,
      productionProfileBindingPolicyVersion: report.sealedObservationBatch.manifest?.productionProfileBindingPolicyVersion ?? null,
      productionProfileBindingDigest: report.sealedObservationBatch.manifest?.tasks?.[0]?.productionProfileBindingDigest ?? null,
      batchId: report.sealedObservationBatch.batchId,
      manifestSha256: report.sealedObservationBatch.manifestSha256,
      expectedTaskCount: report.sealedObservationBatch.expectedTaskCount,
      scopeCounts: report.sealedObservationBatch.scopeCounts
    } : null,
    manifestArtifact: report.manifestArtifact,
    scenarioBlueprintAddendum: report.scenarioBlueprintAddendum,
    selection: {
      status: report.selection.status,
      reasons: report.selection.reasons,
      unexpectedScopes: report.selection.unexpectedScopes,
      missingOrImbalancedScopes: report.selection.missingOrImbalancedScopes
    },
    activeObservationTaskCount: report.activeObservationTaskCount,
    targetBackend: report.targetBackend,
    requiredConfirmations: report.requiredConfirmations,
    providerImpact: report.providerImpact,
    maximumEstimatedCostUsd: report.maximumEstimatedCostUsd,
    progressProtocol: report.progressProtocol,
    progressOutput: report.progressOutput,
    databaseImpact: report.databaseImpact,
    studentPublicationImpact: report.studentPublicationImpact,
    failurePolicy: report.failurePolicy
  };
}

function compactQualificationResult(report) {
  const terminalEvidence = (report.results ?? []).map((item) => {
    const result = recordFrom(item.result) ?? {};
    const leakage = recordFrom(result.automatedCandidateLeakageGate) ?? {};
    return {
      ordinal: Number(item.ordinal),
      taskId: clean(item.taskId),
      plannedScopeId: clean(item.plannedScopeId),
      status: clean(item.status) || 'unknown',
      candidatePresent: Number(result.generatedQuestionId) > 0 && result.noCandidate !== true,
      gateDecision: clean(result.gateDecision) || 'missing',
      leakageStatus: clean(leakage.status) || 'missing',
      generatorVersion: clean(result.generatorVersion) || 'missing',
      submittedNow: item.submittedNow === true
    };
  });
  const countBy = (selector) => terminalEvidence.reduce((counts, item) => {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const perScope = {};
  for (const item of terminalEvidence) {
    const scope = item.plannedScopeId || 'missing';
    const current = perScope[scope] ?? {
      requested: 0,
      succeeded: 0,
      candidateCount: 0,
      publishableCount: 0,
      leakageClearCount: 0
    };
    current.requested += 1;
    if (item.status === 'succeeded') current.succeeded += 1;
    if (item.candidatePresent) current.candidateCount += 1;
    if (item.gateDecision === 'publishable') current.publishableCount += 1;
    if (item.leakageStatus === 'clear') current.leakageClearCount += 1;
    perScope[scope] = current;
  }
  const compactResumePlan = report.resumePlan ? {
    policyVersion: report.resumePlan.policyVersion,
    batchId: report.resumePlan.batchId,
    manifestSha256: report.resumePlan.manifestSha256,
    expectedTaskCount: report.resumePlan.expectedTaskCount,
    observedExistingTaskCount: report.resumePlan.observedExistingTaskCount,
    status: report.resumePlan.status,
    counts: report.resumePlan.counts,
    terminalFailuresRemainInDenominator: report.resumePlan.terminalFailuresRemainInDenominator
  } : undefined;
  return {
    mode: report.mode,
    reportVersion: report.reportVersion,
    status: report.status,
    authorizationPlan: report.authorizationPlan,
    ...(report.resumeDigest ? { resumeDigest: report.resumeDigest } : {}),
    ...(compactResumePlan ? { resumePlan: compactResumePlan } : {}),
    providerImpact: report.providerImpact,
    maximumEstimatedCostUsd: report.maximumEstimatedCostUsd,
    databaseImpact: report.databaseImpact,
    studentPublicationImpact: report.studentPublicationImpact,
    executionMetrics: report.executionMetrics,
    ...(report.systemicFailureFuse ? { systemicFailureFuse: report.systemicFailureFuse } : {}),
    scorecard: report.scorecard,
    resultDiagnostics: {
      protocol: 'subject-practice-local-shadow-compact-terminal-diagnostics-v1',
      candidateContentIncluded: false,
      terminalResultCount: terminalEvidence.length,
      terminalEvidenceDigest: digestFor(terminalEvidence),
      terminalStatusCounts: countBy((item) => item.status),
      gateDecisionCounts: countBy((item) => item.gateDecision),
      leakageStatusCounts: countBy((item) => item.leakageStatus),
      generatorVersionCounts: countBy((item) => item.generatorVersion),
      perScope
    },
    scenarioDiversity: report.scenarioDiversity,
    unsignedQualificationPrecheck: report.unsignedQualificationPrecheck,
    nextAction: report.nextAction,
    nonSuccessCount: report.nonSuccessCount
  };
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function systemicFailureCodeFor(task) {
  if (clean(task?.status).toLowerCase() === 'succeeded') return null;
  const errorRecord = recordFrom(task?.error);
  const errorText = clean(errorRecord?.code ?? errorRecord?.message ?? task?.error).toLowerCase();
  return [
    'scenario_blueprint_task_envelope_invalid',
    'subject_practice_observation_question_plan_not_ready',
    'observation_execution_fence_lost',
    'local_shadow_generator_not_supported',
    'target_backend_submission_plan_policy_stale'
  ].find((code) => errorText.includes(code)) ?? null;
}

function resumeContextFor(requestedBatchId, existingTasks) {
  if (!Array.isArray(existingTasks) || existingTasks.length < 1) {
    throw new Error('Resume requires at least one existing task from the sealed batch.');
  }
  const snapshot = recordFrom(existingTasks[0].filterSnapshot);
  const manifest = recordFrom(recordFrom(snapshot?.sealedObservationBatch)?.manifest);
  if (!manifest) throw new Error('Existing task does not contain a sealed observation batch manifest.');
  const resumePlan = subjectPracticeObservationBatchResumePlan({ manifest, existingTasks });
  if (resumePlan.batchId !== requestedBatchId) throw new Error('Requested batch id does not match the sealed manifest.');
  const first = manifest.tasks[0];
  const sameFamily = manifest.tasks.every((task) => task.subject === first.subject
    && task.productionRunId === first.productionRunId
    && task.productionCellId === first.productionCellId
    && task.taskFamily === first.taskFamily
    && task.planTemplate === first.planTemplate);
  if (!sameFamily) throw new Error('Resume only supports one exact family per sealed batch.');
  const contract = subjectPracticeProductionShadowScopeContractFor(
    first.subject,
    first.taskFamily,
    first.planTemplate
  );
  if (!contract) throw new Error('Sealed batch exact family is no longer registered.');
  const counts = Object.fromEntries(contract.expectedScopeIds.map((scopeId) => [
    scopeId,
    manifest.tasks.filter((task) => task.plannedScopeId === scopeId).length
  ]));
  const unexpectedScopes = [...new Set(manifest.tasks.map((task) => task.plannedScopeId))]
    .filter((scopeId) => !contract.expectedScopeIds.includes(scopeId));
  const samplesPerScope = counts[contract.expectedScopeIds[0]];
  const balanced = unexpectedScopes.length === 0
    && Number.isInteger(samplesPerScope)
    && samplesPerScope >= SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.minimumRealShadowCasesPerScope
    && samplesPerScope <= 12
    && Object.values(counts).every((count) => count === samplesPerScope)
    && manifest.tasks.length === contract.expectedScopeIds.length * samplesPerScope;
  if (!balanced) throw new Error('Sealed batch is not a balanced full-family qualification manifest.');
  const authorizationPlan = {
    protocol: 'subject-practice-local-shadow-family-qualification-resume-v4-runtime-contract-bound',
    route: 'local_deterministic_zero_provider',
    providerAttemptLimit: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    scenarioDiversityPolicyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
    scenarioSelectionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION,
    candidateNoveltyPolicyBinding: candidateNoveltyPolicyBinding(),
    localShadowCandidateSeedPolicyVersion:
      SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
    productionShadowScopeRegistryVersion:
      SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    localGeneratorShadowRoutingVersion:
      subjectPracticeLocalGeneratorShadowRoutingPolicy().routingVersion,
    mathDerivativeLocalGeneratorVersion: first.taskFamily === 'derivative_direct_evaluation'
      ? SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION : null,
    mathDerivativeSolverVersion: first.taskFamily === 'derivative_direct_evaluation'
      ? SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION : null,
    mathDerivativeScopeVersion: first.taskFamily === 'derivative_direct_evaluation'
      ? SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION : null,
    mathDerivativeIndependentOracleVersion: first.taskFamily === 'derivative_direct_evaluation'
      ? SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION : null,
    chemistryAcidBaseSolverVersion: first.subject === 'chemistry'
      ? SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION
      : null,
    chemistryAcidBaseIndependentOracleVersion: first.subject === 'chemistry'
      ? SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION
      : null,
    productionProfileBindingPolicyVersion: manifest.productionProfileBindingPolicyVersion,
    productionProfileBindingDigest: first.productionProfileBindingDigest,
    batchId: resumePlan.batchId,
    manifestSha256: resumePlan.manifestSha256,
    expectedTaskCount: resumePlan.expectedTaskCount,
    subject: first.subject,
    productionRunId: first.productionRunId,
    productionCellId: first.productionCellId,
    taskFamily: first.taskFamily,
    planTemplate: first.planTemplate,
    samplesPerScope,
    scopeCounts: counts
  };
  return {
    manifest,
    contract,
    resumePlan,
    authorizationPlan,
    resumeDigest: digestFor(authorizationPlan)
  };
}

function unsignedQualificationPrecheckFor({ manifest, results, scenarioBlueprintAddendum = null }) {
  const tasks = results.map((item) => {
    const descriptor = manifest.tasks[item.ordinal - 1];
    return {
      id: clean(item.taskId),
      subject: descriptor?.subject ?? null,
      resourceType: 'production_run',
      resourceId: descriptor ? String(descriptor.productionRunId) : null,
      filterSnapshot: descriptor ? {
        productionCellId: descriptor.productionCellId,
        requestedTaskFamily: descriptor.taskFamily,
        requestedPlanTemplate: descriptor.planTemplate,
        sealedObservationBatch: subjectPracticeHistoricalObservationBatchEnvelopeFor({
          manifest,
          taskOrdinal: descriptor.ordinal
        })
      } : {},
      status: item.status,
      requested: 1,
      succeeded: item.status === 'succeeded' ? 1 : 0,
      skipped: 0,
      failed: item.status === 'failed' ? 1 : 0,
      result: item.result ?? null,
      error: clean(item.error) || null
    };
  });
  const batchEvidence = scoreSubjectPracticeObservationBatchEvidence({ manifest, tasks });
  const exactPlanEntries = Object.entries(batchEvidence.perExactPlan);
  const metrics = exactPlanEntries.length === 1 ? exactPlanEntries[0][1] : null;
  const blockers = [...batchEvidence.reasons];
  const batchId = manifest?.tasks?.length
    ? subjectPracticeHistoricalObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 }).batchId
    : null;
  const dynamicScenarioQualification = scenarioBlueprintAddendum
    ? subjectPracticeDynamicScenarioQualificationDecision({
        batchId,
        metrics: metrics?.scenarioDiversity
      })
    : null;
  if (dynamicScenarioQualification?.status !== 'qualified') {
    blockers.push(...(dynamicScenarioQualification?.reasons ?? []));
  }
  if (exactPlanEntries.length !== 1 || !metrics) blockers.push('unsigned_precheck_exact_plan_count_invalid');
  if (metrics) {
    if (Object.values(metrics.perScopeCounts).some((count) =>
      count < SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.minimumRealShadowCasesPerScope)) {
      blockers.push('unsigned_precheck_per_scope_candidate_threshold_not_met');
    }
    if (metrics.candidateYieldRate === null
      || metrics.candidateYieldRate < SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.minimumRealShadowCandidateYieldRate) {
      blockers.push('unsigned_precheck_candidate_yield_threshold_not_met');
    }
    if (metrics.publishableRate === null
      || metrics.publishableRate < SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.minimumRealShadowPublishableRate) {
      blockers.push('unsigned_precheck_publishable_rate_threshold_not_met');
    }
    if (metrics.leakageClearCount !== metrics.candidateCount) {
      blockers.push('unsigned_precheck_candidate_leakage_not_clear');
    }
    if (metrics.scopeBindingFailureCount > SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.maximumScopeLeakage) {
      blockers.push('unsigned_precheck_scope_binding_failure');
    }
    if (metrics.unexpectedFailureCount > SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.maximumUnexpectedFailures) {
      blockers.push('unsigned_precheck_unexpected_failure');
    }
  }
  const uniqueBlockers = [...new Set(blockers)];
  return {
    protocol: 'subject-practice-local-shadow-unsigned-qualification-precheck-v1',
    status: uniqueBlockers.length === 0
      ? 'ready_for_hmac_qualification_export'
      : 'not_ready_for_hmac_qualification_export',
    blockers: uniqueBlockers,
    exactPlan: exactPlanEntries.length === 1 ? exactPlanEntries[0][0] : null,
    metrics,
    dynamicScenarioQualification,
    batchEvidenceComplete: batchEvidence.complete,
    advisoryOnly: true,
    hmacCandidateContentVerified: false,
    releaseQualification: false,
    studentPublicationAuthorized: false
  };
}

function scenarioBlueprintAddendumFromFile(manifest, filePath, sourceManifestPath = '') {
  if (!filePath) return null;
  if (!manifest) throw new Error('Scenario blueprint addendum requires a valid sealed observation manifest.');
  const absolutePath = path.resolve(filePath);
  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const verifiedSource = parsed?.policyVersion && sourceManifestPath
    ? assertSubjectPracticeHistoricalObservationScenarioBlueprintAddendum({
        manifest: JSON.parse(fs.readFileSync(path.resolve(sourceManifestPath), 'utf8')),
        addendum: parsed
      })
    : null;
  const addendum = verifiedSource
    ? buildSubjectPracticeObservationScenarioBlueprintAddendum({
        manifest,
        entries: verifiedSource.entries.map((entry) => ({
          taskOrdinal: entry.taskOrdinal,
          scenarioBlueprintShadowContext: entry.scenarioBlueprintShadowContext
        }))
      })
    : parsed?.policyVersion
      ? parsed
    : buildSubjectPracticeObservationScenarioBlueprintAddendum({
      manifest,
      entries: Array.isArray(parsed?.entries) ? parsed.entries : []
    });
  return assertSubjectPracticeObservationScenarioBlueprintAddendum({ manifest, addendum });
}

function qualificationNextActionFor({ batchId, unsignedPrecheck }) {
  if (unsignedPrecheck.status === 'ready_for_hmac_qualification_export') {
    return {
      status: 'run_read_only_hmac_qualification_export',
      batchId,
      requiresHmacSecret: 'CSCA_PRODUCTION_SHADOW_EXPORTER_HMAC_SECRET',
      command: `npm.cmd run csca-ai-questioning:observation-batch-qualification-export -- --execute --batch-id=${batchId} --out=artifacts/${batchId}-qualification.json --require-qualified`,
      mayRewriteBatchTasks: false,
      maySelectCandidateIds: false,
      studentPublicationAuthorized: false
    };
  }
  return {
    status: 'repair_mechanism_before_new_sealed_batch',
    batchId,
    blockers: unsignedPrecheck.blockers,
    existingBatchMustRemainImmutable: true,
    failedOrdinalsMustRemainInDenominator: true,
    mayRetryOrReplaceOrdinalsInExistingBatch: false,
    maySelectCandidateIds: false,
    newBatchAllowedOnlyAfterMechanismChangeAndFreshPreview: true,
    studentPublicationAuthorized: false
  };
}

async function executeResumePlan({
  context,
  existingTasks,
  waitForExistingTask,
  submitMissingTask,
  onProgress = null,
  now = Date.now
}) {
  const batchStartedAtMs = now();
  const taskByOrdinal = new Map();
  for (const item of context.resumePlan.items) {
    if (!item.existingTaskId) continue;
    const task = existingTasks.find((candidate) => candidate.id === item.existingTaskId);
    if (task) taskByOrdinal.set(item.ordinal, task);
  }
  const existingWaitStartedAtMs = now();
  for (const item of context.resumePlan.items.filter((entry) => entry.action === 'wait_existing')) {
    const task = await waitForExistingTask(item);
    taskByOrdinal.set(item.ordinal, task);
  }
  const existingWaitElapsedMs = Math.max(0, now() - existingWaitStartedAtMs);
  const executionPlan = subjectPracticeObservationBatchResumePlan({
    manifest: context.manifest,
    existingTasks: [...taskByOrdinal.values()]
  });
  if (executionPlan.items.some((item) => item.action === 'wait_existing')) {
    throw new Error('Resume refused because an existing task remained active after waiting.');
  }
  const results = [];
  let consecutiveSystemicFailureCode = null;
  let consecutiveSystemicFailureCount = 0;
  let systemicFailureFuseTriggered = false;
  for (const item of executionPlan.items) {
    const ordinalStartedAtMs = now();
    let task;
    let submittedNow;
    if (item.action === 'reuse_terminal') {
      task = taskByOrdinal.get(item.ordinal);
      submittedNow = false;
    } else if (item.action === 'submit_missing') {
      task = await submitMissingTask(item);
      const submittedTaskPlan = subjectPracticeObservationBatchResumePlan({
        manifest: context.manifest,
        existingTasks: [task]
      });
      const submittedTaskItem = submittedTaskPlan.items[item.ordinal - 1];
      if (submittedTaskItem?.action !== 'reuse_terminal'
        || submittedTaskItem.existingTaskId !== clean(task?.id)) {
        throw new Error(`Submitted observation task failed sealed terminal verification for ordinal ${item.ordinal}.`);
      }
      submittedNow = true;
    } else {
      throw new Error(`Unsupported resume action for ordinal ${item.ordinal}: ${item.action}.`);
    }
    const executionElapsedMs = Math.max(0, now() - ordinalStartedAtMs);
    results.push({
      subject: context.authorizationPlan.subject,
      ordinal: item.ordinal,
      plannedScopeId: item.plannedScopeId,
      taskId: clean(task?.id ?? item.existingTaskId),
      submittedNow,
      status: clean(task?.status ?? item.existingStatus).toLowerCase() || 'unknown',
      executionElapsedMs,
      result: task?.result ?? item.result ?? null,
      error: task?.error ?? item.error ?? null
    });
    const systemicFailureCode = systemicFailureCodeFor(task ?? item);
    if (systemicFailureCode) {
      consecutiveSystemicFailureCount = systemicFailureCode === consecutiveSystemicFailureCode
        ? consecutiveSystemicFailureCount + 1
        : 1;
      consecutiveSystemicFailureCode = systemicFailureCode;
    } else {
      consecutiveSystemicFailureCode = null;
      consecutiveSystemicFailureCount = 0;
    }
    if (typeof onProgress === 'function') {
      try {
        onProgress({
          protocol: PROGRESS_PROTOCOL,
          batchId: context.resumePlan.batchId,
          completedCount: results.length,
          expectedTaskCount: context.resumePlan.expectedTaskCount,
          ordinal: item.ordinal,
          plannedScopeId: item.plannedScopeId,
          action: item.action,
          submittedNow,
          taskId: clean(task?.id ?? item.existingTaskId),
          status: clean(task?.status ?? item.existingStatus).toLowerCase() || 'unknown',
          ordinalElapsedMs: executionElapsedMs,
          batchElapsedMs: Math.max(0, now() - batchStartedAtMs),
          candidateContentIncluded: false
        });
      } catch {
        // Progress reporting must never change qualification execution semantics.
      }
    }
    if (consecutiveSystemicFailureCount >= SYSTEMIC_FAILURE_FUSE_THRESHOLD) {
      systemicFailureFuseTriggered = true;
      break;
    }
  }
  results.sort((left, right) => left.ordinal - right.ordinal);
  const submittedResults = results.filter((item) => item.submittedNow);
  const submittedElapsedMs = submittedResults.reduce((sum, item) => sum + item.executionElapsedMs, 0);
  return {
    executionPlan,
    results,
    systemicFailureFuse: {
      policyVersion: SYSTEMIC_FAILURE_FUSE_POLICY_VERSION,
      threshold: SYSTEMIC_FAILURE_FUSE_THRESHOLD,
      triggered: systemicFailureFuseTriggered,
      failureCode: systemicFailureFuseTriggered ? consecutiveSystemicFailureCode : null,
      consecutiveFailureCount: systemicFailureFuseTriggered ? consecutiveSystemicFailureCount : 0,
      terminalResultCount: results.length,
      remainingUnsubmittedCount: Math.max(0, context.resumePlan.expectedTaskCount - results.length),
      ordinaryQualityFailuresTriggerFuse: false
    },
    executionMetrics: {
      totalElapsedMs: Math.max(0, now() - batchStartedAtMs),
      existingWaitElapsedMs,
      expectedTaskCount: context.resumePlan.expectedTaskCount,
      terminalResultCount: results.length,
      submittedCount: submittedResults.length,
      reusedCount: results.length - submittedResults.length,
      submittedElapsedMs,
      averageSubmittedElapsedMs: submittedResults.length > 0
        ? Math.round(submittedElapsedMs / submittedResults.length)
        : null
    }
  };
}

async function resumeQualificationBatch({ apply, batchId }) {
  if (!/^local-shadow-[a-f0-9]{20}$/.test(batchId)) {
    throw new Error('A valid --resume-batch-id=local-shadow-<20 hex> is required.');
  }
  const baseUrl = clean(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || 'http://127.0.0.1:3001')).replace(/\/+$/, '');
  const timeoutMs = Math.max(60_000, Math.min(15 * 60_000, Number(argValue('timeout-ms', '300000')) || 300_000));
  const token = await resolveAdminToken(baseUrl);
  const listed = await requestJson(
    baseUrl,
    `/api/v1/admin/ai-questioning/subject-practice-observation-tasks?batchId=${encodeURIComponent(batchId)}&limit=${SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT}`,
    token
  );
  const existingTasks = Array.isArray(listed.items) ? listed.items : [];
  const context = resumeContextFor(batchId, existingTasks);
  const report = {
    mode: apply ? 'local_shadow_family_qualification_resume_apply' : 'local_shadow_family_qualification_resume_preview',
    reportVersion: 'subject-practice-local-shadow-family-qualification-resume-v4-runtime-contract-bound',
    status: apply ? 'applying' : context.resumePlan.status,
    authorizationPlan: context.authorizationPlan,
    resumeDigest: context.resumeDigest,
    resumePlan: context.resumePlan,
    requiredConfirmations: [
      '--apply',
      '--confirm-zero-provider-resume',
      `--confirm-resume-digest=${context.resumeDigest}`
    ],
    providerImpact: 'none_provider_attempt_limit_zero',
    maximumEstimatedCostUsd: 0,
    progressProtocol: PROGRESS_PROTOCOL,
    progressOutput: 'stderr_json_lines_unless_quiet_progress',
    databaseImpact: apply ? 'only_missing_observation_tasks_and_candidates_may_be_written' : 'read_only_batch_query',
    studentPublicationImpact: 'none_suppressed',
    results: []
  };
  if (!apply) {
    if (context.resumePlan.status === 'batch_already_terminal') {
      const terminalResults = context.resumePlan.items.map((item) => ({
        subject: context.authorizationPlan.subject,
        ordinal: item.ordinal,
        plannedScopeId: item.plannedScopeId,
        taskId: clean(item.existingTaskId),
        submittedNow: false,
        status: clean(item.existingStatus).toLowerCase(),
        executionElapsedMs: 0,
        result: item.result ?? null,
        error: item.error ?? null
      }));
      const hasDynamicScenarioEvidence = terminalResults.some((item) =>
        clean(recordFrom(item.result)?.scenarioEvidence?.policyVersion)
          .startsWith('subject-practice-scenario-blueprint-shadow-evidence-'));
      report.scenarioDiversity = scenarioDiversityForResults(
        context.manifest.tasks.length,
        terminalResults
      );
      report.unsignedQualificationPrecheck = unsignedQualificationPrecheckFor({
        manifest: context.manifest,
        results: terminalResults,
        scenarioBlueprintAddendum: hasDynamicScenarioEvidence ? { detectedFromStoredEvidence: true } : null
      });
      report.nextAction = qualificationNextActionFor({
        batchId: context.resumePlan.batchId,
        unsignedPrecheck: report.unsignedQualificationPrecheck
      });
    }
    const compact = {
      ...report,
      resumePlan: {
        policyVersion: context.resumePlan.policyVersion,
        status: context.resumePlan.status,
        expectedTaskCount: context.resumePlan.expectedTaskCount,
        observedExistingTaskCount: context.resumePlan.observedExistingTaskCount,
        counts: context.resumePlan.counts
      }
    };
    process.stdout.write(`${JSON.stringify(hasFlag('compact') ? compact : report, null, 2)}\n`);
    return report;
  }
  if (!hasFlag('confirm-zero-provider-resume')) {
    throw new Error('Resume apply requires --confirm-zero-provider-resume.');
  }
  if (clean(argValue('confirm-resume-digest')) !== context.resumeDigest) {
    throw new Error(`Resume apply requires --confirm-resume-digest=${context.resumeDigest}.`);
  }
  assertRuntime(listed.readiness, [{ productionCellId: context.authorizationPlan.productionCellId }]);
  const resumeRuntimeFailures = targetBackendFailureCodes(
    targetBackendRuntimeFromDirectReadiness(listed.readiness),
    context.authorizationPlan.productionCellId,
    false,
    Boolean(context.manifest.campaignId),
    context.authorizationPlan.subject,
    context.authorizationPlan.taskFamily
  );
  if (resumeRuntimeFailures.length > 0) throw new Error(resumeRuntimeFailures.join(','));

  const executed = await executeResumePlan({
    context,
    existingTasks,
    onProgress: hasFlag('quiet-progress')
      ? null
      : (event) => process.stderr.write(`[qualification-progress] ${JSON.stringify(event)}\n`),
    waitForExistingTask: async (item) => {
      const terminal = await waitForTask(baseUrl, item.existingTaskId, token, timeoutMs);
      return terminal.task;
    },
    submitMissingTask: async (item) => {
      const validationProtocolVersion = validationProtocolForTarget({
        subject: context.authorizationPlan.subject,
        productionRunId: context.authorizationPlan.productionRunId,
        productionCellId: context.authorizationPlan.productionCellId,
        taskFamily: context.authorizationPlan.taskFamily
      });
      const submitted = await requestJson(
        baseUrl,
        '/api/v1/admin/ai-questioning/subject-practice-observation-tasks',
        token,
        {
          method: 'POST',
          body: {
            action: ACTIONS[context.authorizationPlan.subject],
            subject: context.authorizationPlan.subject,
            productionRunId: context.authorizationPlan.productionRunId,
            productionCellId: context.authorizationPlan.productionCellId,
            taskFamily: context.authorizationPlan.taskFamily,
            ...(validationProtocolVersion ? { validationProtocolVersion } : {}),
            validationBatchId: `${context.resumeDigest}-${item.ordinal}`,
            sealedObservationBatch: item.sealedObservationBatch,
            maxEstimatedCostUsd: 0,
            maximumReservedCostUsd: 0,
            costReservationPolicyVersion: COST_POLICY,
            suppressStudentPublication: true
          }
        }
      );
      const taskId = submitted.task?.id;
      if (!taskId) throw new Error(`Observation resume submission did not return a task id for ordinal ${item.ordinal}.`);
      const terminal = await waitForTask(baseUrl, taskId, token, timeoutMs);
      return terminal.task;
    }
  });
  report.results = executed.results;
  report.resumePlan = executed.executionPlan;
  report.executionMetrics = executed.executionMetrics;
  report.systemicFailureFuse = executed.systemicFailureFuse;
  report.scorecard = summarizeResults(report.results);
  report.scenarioDiversity = scenarioDiversityForResults(context.manifest.tasks.length, report.results);
  report.unsignedQualificationPrecheck = unsignedQualificationPrecheckFor({
    manifest: context.manifest,
    results: report.results
  });
  report.nextAction = qualificationNextActionFor({
    batchId: context.resumePlan.batchId,
    unsignedPrecheck: report.unsignedQualificationPrecheck
  });
  const nonSuccessCount = report.results.filter((item) => item.status !== 'succeeded').length;
  report.status = executed.systemicFailureFuse.triggered
    ? 'paused_by_systemic_failure_fuse'
    : nonSuccessCount > 0 ? 'completed_with_terminal_failures' : 'completed';
  report.nonSuccessCount = nonSuccessCount;
  process.stdout.write(`${JSON.stringify(hasFlag('compact') ? compactQualificationResult(report) : report, null, 2)}\n`);
  if (nonSuccessCount > 0) process.exitCode = 2;
  return report;
}

async function main() {
  const apply = hasFlag('apply');
  const resumeBatchId = clean(argValue('resume-batch-id'));
  if (resumeBatchId) return resumeQualificationBatch({ apply, batchId: resumeBatchId });
  const subject = clean(argValue('subject')).toLowerCase();
  const taskFamily = clean(argValue('task-family')).toLowerCase();
  const planTemplate = clean(argValue('plan-template')).toLowerCase();
  const contract = subjectPracticeProductionShadowScopeContractFor(subject, taskFamily, planTemplate);
  if (!contract) {
    throw new Error('Exact --subject/--task-family/--plan-template contract is required; math has more than one registered family.');
  }
  const samplesPerScope = Number(argValue(
    'samples-per-scope',
    String(SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.minimumRealShadowCasesPerScope)
  ));
  if (!Number.isInteger(samplesPerScope)
    || samplesPerScope < SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.minimumRealShadowCasesPerScope
    || samplesPerScope > 12) {
    throw new Error(`--samples-per-scope must be an integer from ${SUBJECT_PRACTICE_FAMILY_AUTOMATION_THRESHOLDS.minimumRealShadowCasesPerScope} to 12.`);
  }
  const totalTaskCount = contract.expectedScopeIds.length * samplesPerScope;
  if (totalTaskCount > SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT) {
    throw new Error(`Qualification batch requires ${totalTaskCount} tasks but manifest maximum is ${SUBJECT_PRACTICE_OBSERVATION_BATCH_MAXIMUM_TASK_COUNT}.`);
  }
  const baseUrl = clean(argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || 'http://127.0.0.1:3001')).replace(/\/+$/, '');
  const timeoutMs = Math.max(60_000, Math.min(15 * 60_000, Number(argValue('timeout-ms', '300000')) || 300_000));
  const prisma = new PrismaClient();
  let preflight;
  try {
    preflight = await buildReport(prisma, totalTaskCount, {
      subject: contract.subject,
      taskFamily: contract.taskFamily
    });
  } finally {
    await prisma.$disconnect();
  }
  const selected = selectQualificationFamily(preflight, contract, samplesPerScope);
  const family = selected.family;
  const campaignId = clean(argValue('campaign-id')).toLowerCase();
  const scenarioBlueprintAddendumPath = clean(argValue('scenario-blueprint-addendum'));
  const scenarioBlueprintSourceManifestPath = clean(argValue('scenario-blueprint-source-manifest'));
  const scenarioBlueprintAddendumOut = clean(argValue('scenario-blueprint-addendum-out'));
  if (scenarioBlueprintAddendumPath && !campaignId) {
    throw new Error('--campaign-id is required with --scenario-blueprint-addendum so a new dynamic observation cannot reuse a prior sealed batch identity.');
  }
  if (scenarioBlueprintSourceManifestPath && !scenarioBlueprintAddendumPath) {
    throw new Error('--scenario-blueprint-source-manifest requires --scenario-blueprint-addendum.');
  }
  if (scenarioBlueprintAddendumOut && apply) {
    throw new Error('--scenario-blueprint-addendum-out is preview-only.');
  }
  const manifestTasks = (family?.items ?? []).map((item, index) => ({
    ordinal: index + 1,
    subject: contract.subject,
    productionRunId: Number(family.runId),
    productionCellId: Number(family.cellId),
    taskFamily: contract.taskFamily,
    planTemplate: contract.planTemplate,
    plannedScopeId: item.scopeId
  }));
  const manifest = selected.status === 'qualification_batch_ready'
    ? (campaignId
      ? buildSubjectPracticeObservationCampaignManifest(manifestTasks, campaignId)
      : buildSubjectPracticeObservationBatchManifest(manifestTasks))
    : null;
  const firstEnvelope = manifest
    ? subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 })
    : null;
  const scenarioBlueprintAddendum = scenarioBlueprintAddendumFromFile(
    manifest,
    scenarioBlueprintAddendumPath,
    scenarioBlueprintSourceManifestPath
  );
  if (scenarioBlueprintAddendumOut) {
    if (!scenarioBlueprintAddendum) throw new Error('Cannot write a scenario blueprint addendum without a validated input addendum.');
    const absoluteAddendumPath = path.resolve(scenarioBlueprintAddendumOut);
    fs.mkdirSync(path.dirname(absoluteAddendumPath), { recursive: true });
    fs.writeFileSync(absoluteAddendumPath, `${JSON.stringify(scenarioBlueprintAddendum, null, 2)}\n`, {
      encoding: 'utf8', flag: 'wx'
    });
  }
  const authorizationPlan = {
    protocol: 'subject-practice-local-shadow-family-qualification-run-v4-runtime-contract-bound',
    route: 'local_deterministic_zero_provider',
    providerAttemptLimit: 0,
    maximumEstimatedCostUsd: 0,
    publicationSuppressed: true,
    manifestPolicyVersion: manifest?.policyVersion ?? SUBJECT_PRACTICE_OBSERVATION_BATCH_MANIFEST_POLICY_VERSION,
    campaignId: manifest?.campaignId ?? null,
    scenarioDiversityPolicyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
    scenarioSelectionPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_SCENARIO_SELECTION_POLICY_VERSION,
    subject: contract.subject,
    productionRunId: Number(family?.runId ?? 0),
    productionCellId: Number(family?.cellId ?? 0),
    taskFamily: contract.taskFamily,
    planTemplate: contract.planTemplate,
    expectedScopeIds: contract.expectedScopeIds,
    samplesPerScope,
    totalTaskCount,
    expectedGeneratorVersion: manifest?.tasks[0]?.expectedGeneratorVersion ?? null,
    reviewGatePolicyVersion: SUBJECT_PRACTICE_REVIEW_GATE_POLICY_VERSION,
    candidateNoveltyPolicyBinding: candidateNoveltyPolicyBinding(),
    localShadowCandidateSeedPolicyVersion:
      SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
    productionShadowScopeRegistryVersion:
      SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    localGeneratorShadowRoutingVersion:
      subjectPracticeLocalGeneratorShadowRoutingPolicy().routingVersion,
    mathDerivativeLocalGeneratorVersion: contract.taskFamily === 'derivative_direct_evaluation'
      ? SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION : null,
    mathDerivativeSolverVersion: contract.taskFamily === 'derivative_direct_evaluation'
      ? SUBJECT_PRACTICE_MATH_DERIVATIVE_SOLVER_VERSION : null,
    mathDerivativeScopeVersion: contract.taskFamily === 'derivative_direct_evaluation'
      ? SUBJECT_PRACTICE_MATH_DERIVATIVE_SCOPE_VERSION : null,
    mathDerivativeIndependentOracleVersion: contract.taskFamily === 'derivative_direct_evaluation'
      ? SUBJECT_PRACTICE_MATH_DERIVATIVE_INDEPENDENT_ORACLE_VERSION : null,
    chemistryAcidBaseSolverVersion: contract.subject === 'chemistry'
      ? SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION
      : null,
    chemistryAcidBaseIndependentOracleVersion: contract.subject === 'chemistry'
      ? SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION
      : null,
    productionProfileBindingPolicyVersion: manifest?.productionProfileBindingPolicyVersion ?? null,
    productionProfileBindingDigest: manifest?.tasks[0]?.productionProfileBindingDigest ?? null,
    sealedBatchId: firstEnvelope?.batchId ?? null,
    manifestSha256: firstEnvelope?.manifestSha256 ?? null,
    scenarioBlueprintAddendumPolicyVersion: scenarioBlueprintAddendum?.policyVersion ?? null,
    dynamicScenarioQualificationPolicyVersion: scenarioBlueprintAddendum
      ? SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION
      : null,
    scenarioBlueprintAddendumSha256: scenarioBlueprintAddendum?.addendumSha256 ?? null,
    scenarioBlueprintRootSha256: scenarioBlueprintAddendum?.scenarioBlueprintRootSha256 ?? null,
    currentCandidateCountBasis: Number(family?.currentCandidateCount ?? 0),
    plannedScopeSequence: (family?.items ?? []).map((item) => item.scopeId)
  };
  const planDigest = digestFor(authorizationPlan);
  const targetBackendFailures = targetBackendFailureCodes(
    preflight.runtime,
    family?.cellId,
    Boolean(scenarioBlueprintAddendum),
    Boolean(campaignId),
    contract.subject,
    contract.taskFamily
  );
  const targetBackend = {
    baseUrl,
    ready: targetBackendFailures.length === 0,
    failureCodes: targetBackendFailures,
    readinessSource: preflight.runtime?.source ?? 'missing',
    apiCompatible: preflight.runtime?.observationBackendApiCompatible === true,
    readinessLoaded: preflight.runtime?.observationBackendReadinessLoaded === true,
    observationOnlyMode: preflight.runtime?.observationOnlyMode === true,
    localGeneratorShadowEnabled: preflight.runtime?.localGeneratorShadowEnabled === true,
    questionPlanEnabled: preflight.runtime?.questionPlanEnabled === true,
    observationSubmissionPlanPolicyVersion:
      clean(preflight.runtime?.observationSubmissionPlanPolicyVersion),
    reviewGatePolicyVersion: clean(preflight.runtime?.reviewGatePolicyVersion),
    chemistryAcidBaseSolverVersion: clean(preflight.runtime?.chemistryAcidBaseSolverVersion),
    chemistryAcidBaseIndependentOracleVersion:
      clean(preflight.runtime?.chemistryAcidBaseIndependentOracleVersion),
    candidateOutputNoveltyPolicyVersion: clean(preflight.runtime?.candidateOutputNoveltyPolicyVersion),
    candidateNoveltyCorpusSnapshotVersion: clean(preflight.runtime?.candidateNoveltyCorpusSnapshotVersion),
    candidateNoveltyMatchDigestVersion: clean(preflight.runtime?.candidateNoveltyMatchDigestVersion),
    structuredSourceCorpusSchemaVersion: clean(preflight.runtime?.structuredSourceCorpusSchemaVersion),
    sourceCorpusNormalizationVersion: clean(preflight.runtime?.sourceCorpusNormalizationVersion),
    localShadowCandidateSeedPolicyVersion:
      clean(preflight.runtime?.localShadowCandidateSeedPolicyVersion),
    productionShadowScopeRegistryVersion:
      clean(preflight.runtime?.productionShadowScopeRegistryVersion),
    localGeneratorShadowRoutingVersion:
      clean(preflight.runtime?.localGeneratorShadowRoutingVersion),
    mathDerivativeLocalGeneratorVersion:
      clean(preflight.runtime?.mathDerivativeLocalGeneratorVersion),
    mathDerivativeSolverVersion: clean(preflight.runtime?.mathDerivativeSolverVersion),
    mathDerivativeScopeVersion: clean(preflight.runtime?.mathDerivativeScopeVersion),
    mathDerivativeIndependentOracleVersion:
      clean(preflight.runtime?.mathDerivativeIndependentOracleVersion),
    scenarioBlueprintObservationEnvelopeSupported:
      preflight.runtime?.scenarioBlueprintObservationEnvelopeSupported === true,
    scenarioBlueprintObservationEnvelopePolicyVersion:
      clean(preflight.runtime?.scenarioBlueprintObservationEnvelopePolicyVersion),
    observationManifestPolicyVersionsSupported:
      Array.isArray(preflight.runtime?.observationManifestPolicyVersionsSupported)
        ? preflight.runtime.observationManifestPolicyVersionsSupported
        : [],
    cellAllowlist: clean(preflight.runtime?.cellAllowlist),
    readyForLocalZeroProviderSubmission: preflight.runtime?.readyForLocalZeroProviderSubmission === true,
    readyForLocalZeroProviderExecution: preflight.runtime?.readyForLocalZeroProviderExecution === true,
    probeFailureCode: preflight.runtime?.observationBackendProbeFailureCode ?? null,
    startCommand: observationBackendStartCommandFor(baseUrl, family?.cellId)
  };
  const manifestOut = clean(argValue('manifest-out'));
  let manifestArtifact = null;
  if (manifestOut) {
    if (apply) throw new Error('--manifest-out is preview-only.');
    if (!manifest || !firstEnvelope) throw new Error('Cannot write a manifest artifact when the qualification manifest is unavailable.');
    const absoluteManifestPath = path.resolve(manifestOut);
    fs.mkdirSync(path.dirname(absoluteManifestPath), { recursive: true });
    fs.writeFileSync(absoluteManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    manifestArtifact = {
      path: absoluteManifestPath,
      manifestSha256: firstEnvelope.manifestSha256,
      batchId: firstEnvelope.batchId,
      campaignId: manifest.campaignId ?? null
    };
  }
  const report = {
    mode: apply ? 'local_shadow_family_qualification_apply' : 'local_shadow_family_qualification_preview',
    reportVersion: 'subject-practice-local-shadow-family-qualification-run-v6-math-derivative-runtime-bound',
    status: selected.status !== 'qualification_batch_ready'
      ? selected.status
      : Number(preflight.activeObservationTaskCount || 0) > 0
        ? 'waiting_for_existing_observation_task'
        : !targetBackend.ready
          ? 'target_backend_not_ready'
          : apply ? 'applying' : 'ready_for_exact_authorization',
    authorizationPlan,
    planDigest,
    sealedObservationBatch: firstEnvelope ? {
      batchId: firstEnvelope.batchId,
      manifestSha256: firstEnvelope.manifestSha256,
      expectedTaskCount: firstEnvelope.expectedTaskCount,
      scopeCounts: selected.scopeCounts,
      manifest
    } : null,
    manifestArtifact,
    scenarioBlueprintAddendum: scenarioBlueprintAddendum ? {
      policyVersion: scenarioBlueprintAddendum.policyVersion,
      addendumSha256: scenarioBlueprintAddendum.addendumSha256,
      scenarioBlueprintRootSha256: scenarioBlueprintAddendum.scenarioBlueprintRootSha256,
      entryCount: scenarioBlueprintAddendum.entries.length,
      familyCounts: scenarioBlueprintAddendum.familyCounts,
      maximumFamilyShare: scenarioBlueprintAddendum.maximumFamilyShare,
      releaseQualification: false
    } : null,
    selection: selected,
    activeObservationTaskCount: Number(preflight.activeObservationTaskCount || 0),
    activeObservationTasks: preflight.activeObservationTasks || [],
    targetBackend,
    requiredConfirmations: [
      '--apply',
      '--confirm-zero-provider-qualification-batch',
      `--confirm-batch-id=${firstEnvelope?.batchId ?? ''}`,
      `--confirm-plan-digest=${planDigest}`
    ],
    providerImpact: 'none_provider_attempt_limit_zero',
    maximumEstimatedCostUsd: 0,
    progressProtocol: PROGRESS_PROTOCOL,
    progressOutput: 'stderr_json_lines_unless_quiet_progress',
    databaseImpact: apply ? 'bounded_observation_tasks_and_candidate_writes' : 'read_only_preflight',
    studentPublicationImpact: 'none_suppressed',
    failurePolicy: 'strictly_serial_continue_after_ordinary_quality_failure_pause_after_three_identical_systemic_failures',
    results: []
  };
  if (!apply) {
    process.stdout.write(`${JSON.stringify(hasFlag('compact') ? compactQualificationPreview(report) : report, null, 2)}\n`);
    return;
  }
  if (selected.status !== 'qualification_batch_ready' || !manifest) {
    throw new Error(`Apply refused because qualification batch is invalid: ${selected.reasons.join(',')}.`);
  }
  if (Number(preflight.activeObservationTaskCount || 0) > 0) {
    throw new Error('Apply refused because an existing queued/running observation task must reach a terminal state first.');
  }
  if (!targetBackend.ready) {
    throw new Error(`Apply refused because target backend is not current and ready: ${targetBackend.failureCodes.join(',')}.`);
  }
  if (!hasFlag('confirm-zero-provider-qualification-batch')) {
    throw new Error('Apply requires --confirm-zero-provider-qualification-batch.');
  }
  const providedBatchId = clean(argValue('confirm-batch-id'));
  const providedPlanDigest = clean(argValue('confirm-plan-digest'));
  if (providedBatchId !== firstEnvelope.batchId || providedPlanDigest !== planDigest) {
    const refusal = authorizationRefusalFor({
      authorizationPlan,
      baseUrl,
      providedBatchId,
      providedPlanDigest,
      requiredPlanDigest: planDigest
    });
    process.stdout.write(`${JSON.stringify(refusal, null, 2)}\n`);
    process.exitCode = 1;
    return refusal;
  }
  const token = await resolveAdminToken(baseUrl);
  const runtime = await requestJson(
    baseUrl,
    '/api/v1/admin/ai-questioning/subject-practice-observation-tasks?limit=1',
    token
  );
  try {
    assertRuntime(runtime.readiness, [{ productionCellId: family.cellId }]);
  } catch (error) {
    const startCommand = observationBackendStartCommandFor(baseUrl, family.cellId);
    throw new Error(`${error instanceof Error ? error.message : String(error)} Start the exact isolated backend with: ${startCommand}`);
  }
  const freshRuntimeFailures = targetBackendFailureCodes(
    targetBackendRuntimeFromDirectReadiness(runtime.readiness),
    family.cellId,
    Boolean(scenarioBlueprintAddendum),
    Boolean(campaignId),
    contract.subject,
    contract.taskFamily
  );
  if (freshRuntimeFailures.length > 0) {
    throw new Error(`Target backend changed after preview: ${freshRuntimeFailures.join(',')}.`);
  }
  const initialExecution = await executeResumePlan({
    context: {
      manifest,
      resumePlan: subjectPracticeObservationBatchResumePlan({ manifest, existingTasks: [] }),
      authorizationPlan
    },
    existingTasks: [],
    onProgress: hasFlag('quiet-progress')
      ? null
      : (event) => process.stderr.write(`[qualification-progress] ${JSON.stringify(event)}\n`),
    waitForExistingTask: async () => {
      throw new Error('A new sealed qualification batch cannot contain an existing active task.');
    },
    submitMissingTask: async (item) => {
      const validationProtocolVersion = validationProtocolForTarget({
        subject: contract.subject,
        productionRunId: family.runId,
        productionCellId: family.cellId,
        taskFamily: contract.taskFamily
      });
      const submitted = await requestJson(
        baseUrl,
        '/api/v1/admin/ai-questioning/subject-practice-observation-tasks',
        token,
        {
          method: 'POST',
          body: {
            action: ACTIONS[contract.subject],
            subject: contract.subject,
            productionRunId: Number(family.runId),
            productionCellId: Number(family.cellId),
            taskFamily: contract.taskFamily,
            ...(validationProtocolVersion ? { validationProtocolVersion } : {}),
            validationBatchId: `${planDigest}-${item.ordinal}`,
            sealedObservationBatch: item.sealedObservationBatch,
            ...(scenarioBlueprintAddendum ? {
              scenarioBlueprintTaskEnvelope: subjectPracticeObservationScenarioBlueprintTaskEnvelopeFor({
                manifest,
                addendum: scenarioBlueprintAddendum,
                taskOrdinal: item.ordinal
              })
            } : {}),
            maxEstimatedCostUsd: 0,
            maximumReservedCostUsd: 0,
            costReservationPolicyVersion: COST_POLICY,
            suppressStudentPublication: true
          }
        }
      );
      const taskId = submitted.task?.id;
      if (!taskId) throw new Error(`Observation submission did not return a task id for ordinal ${item.ordinal}.`);
      const terminal = await waitForTask(baseUrl, taskId, token, timeoutMs);
      return terminal.task;
    }
  });
  report.results = initialExecution.results;
  report.executionMetrics = initialExecution.executionMetrics;
  report.systemicFailureFuse = initialExecution.systemicFailureFuse;
  report.scorecard = summarizeResults(report.results);
  report.scenarioDiversity = scenarioDiversityForResults(manifest.tasks.length, report.results);
  report.unsignedQualificationPrecheck = unsignedQualificationPrecheckFor({
    manifest, results: report.results, scenarioBlueprintAddendum
  });
  report.nextAction = qualificationNextActionFor({
    batchId: firstEnvelope.batchId,
    unsignedPrecheck: report.unsignedQualificationPrecheck
  });
  const nonSuccessCount = report.results.filter((item) => item.status !== 'succeeded').length;
  report.status = initialExecution.systemicFailureFuse.triggered
    ? 'paused_by_systemic_failure_fuse'
    : nonSuccessCount > 0 ? 'completed_with_terminal_failures' : 'completed';
  report.nonSuccessCount = nonSuccessCount;
  process.stdout.write(`${JSON.stringify(hasFlag('compact') ? compactQualificationResult(report) : report, null, 2)}\n`);
  if (nonSuccessCount > 0) process.exitCode = 2;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  authorizationRefusalFor,
  AUTHORIZATION_REFUSAL_REPORT_VERSION,
  compactQualificationPreview,
  compactQualificationResult,
  executeResumePlan,
  SYSTEMIC_FAILURE_FUSE_POLICY_VERSION,
  observationBackendStartCommandFor,
  PROGRESS_PROTOCOL,
  resumeContextFor,
  resumeQualificationBatch,
  targetBackendRuntimeFromDirectReadiness,
  targetBackendFailureCodes,
  qualificationNextActionFor,
  unsignedQualificationPrecheckFor
};
