#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const {
  QuestionGeneratorProviderService,
  SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ROUTING_VERSION,
  subjectPracticeLocalGeneratorShadowPlanSupported,
  subjectPracticeReviewProviderModeForGeneration
} =
  require('../backend/src/ai-questioning/question-generator-provider.service');
const { QuestionPromptBuilderService } = require('../backend/src/ai-questioning/question-prompt-builder.service');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanScopeRotationFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  applySubjectPracticeAutomatedCandidateLeakageGate,
  SUBJECT_PRACTICE_ZERO_PROVIDER_OBSERVATION_COST_POLICY_VERSION,
  subjectPracticeObservationCostReservationValid,
  subjectPracticeObservationGenerationJobCostReservationValid,
  subjectPracticeObservationRouteReadinessFor,
  subjectPracticeProductionCellRetryFeedback
} = require('../backend/src/ai-questioning/ai-questioning.service');
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
  assertSubjectPracticeLocalShadowCandidateSeedBinding,
  subjectPracticeLocalShadowCandidateSeedBindingFor,
  SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-local-shadow-candidate-seed-policy');
const {
  assertRuntime: assertLocalShadowBatchRuntime,
  digestFor: localShadowBatchDigestFor,
  selectTargets: selectLocalShadowBatchTargets,
  summarizeResults: summarizeLocalShadowBatchResults
} = require('./csca-subject-practice-local-shadow-three-subject-run.cjs');

let gatewayCallCount = 0;
const gateway = {
  hasConfiguredKey: () => true,
  complete: async () => {
    gatewayCallCount += 1;
    throw new Error('Local shadow routing must never call the Provider gateway.');
  }
};
const provider = new QuestionGeneratorProviderService(new QuestionPromptBuilderService(), gateway);

const blueprints = {
  math: {
    id: 16, subject: 'math', topicId: 69, topicCode: 'M-FUN-002', topicModule: '函数', topicTitle: '基本初等函数',
    syllabusVersion: '2025', examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。', allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['basic'], excludedScope: [], difficulty: 'basic', questionType: 'single_choice', skill: 'concept_identification', constraints: {}
  },
  mathLine: {
    id: 91001, subject: 'math', topicId: 92001, topicCode: 'M-LINE-SHADOW-001', topicModule: '解析几何', topicTitle: 'Line relation',
    syllabusVersion: '2025', examScope: '两点斜率、精确倾角、平行垂直和点斜式。', allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['basic'], excludedScope: ['figure', 'intersection_chain'], difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
  },
  mathDerivative: {
    id: 93001, subject: 'math', topicId: 94001, topicCode: 'M-DER-SHADOW-001', topicModule: '导数', topicTitle: '导数与微积分初步',
    syllabusVersion: '2025', examScope: '基础多项式在一点的导数值。', allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['basic'], excludedScope: ['chain_rule', 'piecewise'], difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
  },
  physics: {
    id: 24, subject: 'physics', topicId: 8, topicCode: 'P-MECH-001', topicModule: '力学', topicTitle: 'Kinematics',
    syllabusVersion: '2025', examScope: '直线运动中位移、时间、速度和加速度的基本关系。', allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['basic'], excludedScope: ['graph'], difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
  },
  chemistry: {
    id: 41, subject: 'chemistry', topicId: 642, topicCode: 'C-BASIC-003', topicModule: '溶液', topicTitle: '溶液浓度与pH计算',
    syllabusVersion: '2025', examScope: '一元强酸强碱稀释和中和。', allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['medium'], excludedScope: ['weak_acid_base'], difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {}
  }
};

function fallback(blueprint) {
  return {
    subject: blueprint.subject, topicId: blueprint.topicId, blueprintId: blueprint.id, sourceType: 'ai',
    designedDifficulty: blueprint.difficulty, questionType: 'single_choice', prompt: 'fallback',
    options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: id })), correctAnswer: 'A', explanation: 'fallback',
    knowledgeTags: [], optionMetadata: [], syllabusVersion: blueprint.syllabusVersion
  };
}

function withPlan(blueprint, plan) {
  return { ...blueprint, constraints: { expansion: { questionPlan: plan } } };
}

function metadata(jobId, {
  observationBatchId = 'local-shadow-0123456789abcdefabcd',
  taskOrdinal = 1,
  productionRunId = 1,
  productionCellId = 1
} = {}) {
  const observationCandidateSeedBinding = subjectPracticeLocalShadowCandidateSeedBindingFor({
    observationBatchId,
    taskOrdinal,
    productionRunId,
    productionCellId
  });
  return {
    workClass: 'observation', observationTaskId: 'fixture-observation-task', generationJobId: jobId,
    productionRunId, productionCellId, observationCandidateSeedBinding, suppressStudentPublication: true,
    publicationPolicy: 'observation_gate_evidence_only_no_student_publication'
  };
}

async function run() {
  const previousLocal = process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED;
  const previousExternal = process.env.CSCA_AI_QUESTION_GENERATION_ENABLED;
  process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED = 'true';
  delete process.env.CSCA_AI_QUESTION_GENERATION_ENABLED;
  try {
    const plans = {
      math: buildSubjectPracticeQuestionPlan({
        subject: 'math', topicId: 69, topicTitle: '基本初等函数', productionCellId: 16,
        targetDifficulty: 'basic', taskFamily: 'elementary_function_direct_property',
        requiredElementaryFunctionClass: 'logarithmic', requiredSinglePropertyTarget: 'domain'
      }),
      mathLine: buildSubjectPracticeQuestionPlan({
        subject: 'math', topicId: 92001, topicTitle: 'Line relation', productionCellId: 'line-relation-shadow-v1',
        targetDifficulty: 'basic', taskFamily: 'math_line_relation_direct', planTemplate: 'math_line_relation_direct_v1',
        exactLineRelationScope: 'identify_parallel_or_perpendicular_line'
      }),
      mathDerivative: buildSubjectPracticeQuestionPlan({
        subject: 'math', topicId: 94001, topicTitle: '导数与微积分初步', productionCellId: 10,
        targetDifficulty: 'basic', taskFamily: 'derivative_direct_evaluation',
        planTemplate: 'math_derivative_condition_chain_v1', exactDerivativeScope: 'direct_polynomial_value'
      }),
      physics: buildSubjectPracticeQuestionPlan({
        subject: 'physics', topicId: 8, topicTitle: 'Kinematics', productionCellId: 24,
        targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
        exactPhysicsKinematicsScope: 'final_velocity_from_initial_acceleration_time'
      }),
      chemistry: buildSubjectPracticeQuestionPlan({
        subject: 'chemistry', topicId: 642, topicTitle: '溶液浓度与pH计算', productionCellId: 41,
        targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
        exactChemistryRelationKind: 'strong_acid_base_neutralization',
        exactChemistryAnswerTarget: 'acid_base_character'
      })
    };
    const results = [];
    for (const subject of ['math', 'mathLine', 'mathDerivative', 'physics', 'chemistry']) {
      const blueprint = withPlan(blueprints[subject], plans[subject]);
      results.push(await provider.generate(blueprint, fallback(blueprint), { gatewayMetadata: metadata(`job-${subject}`) }));
    }
    const repeatBlueprint = withPlan(blueprints.math, plans.math);
    const repeatA = await provider.generate(repeatBlueprint, fallback(repeatBlueprint), { gatewayMetadata: metadata('repeat-job') });
    const repeatB = await provider.generate(repeatBlueprint, fallback(repeatBlueprint), { gatewayMetadata: metadata('repeat-job') });
    const databaseIdentityIndependentRepeat = await provider.generate(repeatBlueprint, fallback(repeatBlueprint), {
      gatewayMetadata: { ...metadata('different-generation-job'), observationTaskId: 'different-observation-task' }
    });
    const rotatedSeedMetadata = metadata('rotated-seed-job', { taskOrdinal: 2 });
    let tamperedSeedRejected = false;
    try {
      assertSubjectPracticeLocalShadowCandidateSeedBinding({
        ...rotatedSeedMetadata.observationCandidateSeedBinding,
        seed: rotatedSeedMetadata.observationCandidateSeedBinding.seed + 1
      });
    } catch {
      tamperedSeedRejected = true;
    }
    const unregisteredPlan = { ...plans.math, taskFamily: 'unregistered_family' };
    const unregisteredBlueprint = withPlan(blueprints.math, unregisteredPlan);
    const unregistered = await provider.generate(unregisteredBlueprint, fallback(unregisteredBlueprint), { gatewayMetadata: metadata('unregistered-job') });
    const missingPhysicsScopePlan = {
      ...plans.physics,
      renderConstraints: { ...plans.physics.renderConstraints, exactPhysicsKinematicsScope: undefined }
    };
    const missingPhysicsScopeBlueprint = withPlan(blueprints.physics, missingPhysicsScopePlan);
    const missingPhysicsScope = await provider.generate(
      missingPhysicsScopeBlueprint,
      fallback(missingPhysicsScopeBlueprint),
      { gatewayMetadata: metadata('missing-physics-scope-job') }
    );
    const missingDerivativeScopePlan = {
      ...plans.mathDerivative,
      renderConstraints: { ...plans.mathDerivative.renderConstraints, exactDerivativeScope: undefined }
    };
    const missingDerivativeScopeBlueprint = withPlan(blueprints.mathDerivative, missingDerivativeScopePlan);
    const missingDerivativeScope = await provider.generate(
      missingDerivativeScopeBlueprint,
      fallback(missingDerivativeScopeBlueprint),
      { gatewayMetadata: metadata('missing-derivative-scope-job') }
    );
    const missingChemistryScopePlan = {
      ...plans.chemistry,
      renderConstraints: {
        ...plans.chemistry.renderConstraints,
        exactChemistryRelationKind: undefined,
        exactChemistryAnswerTarget: undefined
      }
    };
    const missingChemistryScopeBlueprint = withPlan(blueprints.chemistry, missingChemistryScopePlan);
    const missingChemistryScope = await provider.generate(
      missingChemistryScopeBlueprint,
      fallback(missingChemistryScopeBlueprint),
      { gatewayMetadata: metadata('missing-chemistry-scope-job') }
    );
    const unsuppressed = await provider.generate(repeatBlueprint, fallback(repeatBlueprint), {
      gatewayMetadata: { ...metadata('unsuppressed-job'), suppressStudentPublication: false }
    });
    const rotationFixtures = {
      mathLine: Array.from({ length: 8 }, (_, currentCandidateCount) => subjectPracticeQuestionPlanScopeRotationFor({
        subject: 'math', topicTitle: 'Line relation', productionCellId: 'line-relation-shadow-v1', targetDifficulty: 'basic', currentCandidateCount
      })?.lineRelationScope),
      physics: Array.from({ length: 8 }, (_, currentCandidateCount) => subjectPracticeQuestionPlanScopeRotationFor({
        subject: 'physics', topicTitle: 'Kinematics', productionCellId: 24, targetDifficulty: 'basic', currentCandidateCount
      })?.physicsKinematicsScope),
      chemistry: Array.from({ length: 12 }, (_, currentCandidateCount) => subjectPracticeQuestionPlanScopeRotationFor({
        subject: 'chemistry', topicTitle: '溶液浓度与pH计算', productionCellId: 41, targetDifficulty: 'medium', currentCandidateCount
      })).map((slot) => `${slot?.chemistryRelationKind}:${slot?.chemistryAnswerTarget}`)
    };
    const physicsFeedback = subjectPracticeProductionCellRetryFeedback({
      productionRunId: 2,
      productionCellId: 24,
      subject: 'physics',
      topicTitle: 'Kinematics',
      reasonCodes: [],
      targetProfile: { difficultyBand: 'basic', calculationLoad: 'light' },
      rejectedCount: 0,
      currentCandidateCount: 6
    });
    const mathLineFeedback = subjectPracticeProductionCellRetryFeedback({
      productionRunId: 1,
      productionCellId: 91001,
      subject: 'math',
      topicTitle: 'Line relation',
      reasonCodes: [],
      targetProfile: { difficultyBand: 'basic', calculationLoad: 'light' },
      rejectedCount: 0,
      currentCandidateCount: 3
    });
    const chemistryFeedback = subjectPracticeProductionCellRetryFeedback({
      productionRunId: 3,
      productionCellId: 41,
      subject: 'chemistry',
      topicTitle: '溶液浓度与pH计算',
      reasonCodes: [],
      targetProfile: { difficultyBand: 'medium', calculationLoad: 'medium' },
      rejectedCount: 0,
      currentCandidateCount: 10
    });
    const localOnlyReadiness = subjectPracticeObservationRouteReadinessFor({
      taskEnabled: true,
      executionEnabled: true,
      singletonConfirmed: true,
      observationOnlyMode: true,
      localGeneratorShadowEnabled: true,
      questionPlanEnabled: true,
      globalConcurrency: 1,
      realtimeConcurrency: 1,
      backgroundConcurrency: 1,
      eligibleKeySlots: 0
    });
    const localUnsafeReadiness = subjectPracticeObservationRouteReadinessFor({
      taskEnabled: true,
      executionEnabled: true,
      singletonConfirmed: true,
      observationOnlyMode: false,
      localGeneratorShadowEnabled: true,
      questionPlanEnabled: true,
      globalConcurrency: 1,
      realtimeConcurrency: 1,
      backgroundConcurrency: 1,
      eligibleKeySlots: 0
    });
    const batchTargets = selectLocalShadowBatchTargets({
      families: [
        { subject: 'math', status: 'batch_plan_ready', runId: 1, cellId: 16, taskFamily: 'elementary_function_direct_property', planTemplate: 'math_elementary_function_relation_v1', items: [{ scopeId: 'math-scope' }] },
        { subject: 'physics', status: 'batch_plan_ready', runId: 2, cellId: 24, taskFamily: 'kinematics_basic_direct_relation', planTemplate: 'physics_kinematics_basic_relation_v1', items: [{ scopeId: 'physics-scope' }] },
        { subject: 'chemistry', status: 'batch_plan_ready', runId: 3, cellId: 41, taskFamily: 'ph_dilution_strong_acid_base_neutralization', planTemplate: 'chemistry_strong_acid_base_single_relation_v1', items: [{ scopeId: 'chemistry-scope' }] }
      ]
    }, ['math', 'physics', 'chemistry'], 1);
    let batchRuntimeAccepted = false;
    try {
      assertLocalShadowBatchRuntime({
        ...localOnlyReadiness,
        observationOnlyMode: true,
        localGeneratorShadowEnabled: true,
        questionPlanEnabled: true,
        questionPlanCellAllowlist: '16,24,41'
      }, batchTargets);
      batchRuntimeAccepted = true;
    } catch {
      batchRuntimeAccepted = false;
    }
    const batchScorecard = summarizeLocalShadowBatchResults([
      { subject: 'math', status: 'succeeded', result: { generatedQuestionId: 1, gateDecision: 'publishable', automatedCandidateLeakageGate: { status: 'clear', scannedRevisionCount: 10 } } },
      { subject: 'physics', status: 'succeeded', result: { generatedQuestionId: 2, gateDecision: 'needs_review', automatedCandidateLeakageGate: { status: 'ambiguous', scannedRevisionCount: 10 } } },
      { subject: 'chemistry', status: 'failed', result: { generatedQuestionId: null, gateDecision: null } }
    ]);
    const reviewFixture = {
      status: 'passed', issues: [], dimensions: [], sources: ['deterministic'], decision: 'approve', checkedAt: '2026-09-14T00:00:00.000Z'
    };
    const clearLeakageReview = applySubjectPracticeAutomatedCandidateLeakageGate(reviewFixture, {
      policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
      status: 'clear', scannedRevisionCount: 10,
      blockedRevisionCount: 0, ambiguousRevisionCount: 0, reasonCodes: [],
      revisionMatchSetSha256: 'a'.repeat(64),
      revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
      structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
      normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
      sourceCorpusSnapshotSha256: 'b'.repeat(64),
      sourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
      sourceCorpusRevisionCount: 10,
      sourceCorpusInventoryComplete: true,
      sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
      failClosed: true, sourceContentExposedToGenerator: false
    });
    const incompleteClearLeakageReview = applySubjectPracticeAutomatedCandidateLeakageGate(reviewFixture, {
      policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
      status: 'clear', scannedRevisionCount: 10,
      blockedRevisionCount: 0, ambiguousRevisionCount: 0, reasonCodes: [],
      revisionMatchSetSha256: 'a'.repeat(64),
      revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
      structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
      normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
      sourceCorpusSnapshotSha256: null,
      sourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
      sourceCorpusRevisionCount: 10,
      sourceCorpusInventoryComplete: false,
      sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
      failClosed: true, sourceContentExposedToGenerator: false
    });
    const missingLeakageReview = applySubjectPracticeAutomatedCandidateLeakageGate(reviewFixture, {
      policyVersion: 'fixture', status: 'missing_corpus', scannedRevisionCount: 0,
      blockedRevisionCount: 0, ambiguousRevisionCount: 0, reasonCodes: ['current_known_source_corpus_empty'],
      revisionMatchSetSha256: null, failClosed: true, sourceContentExposedToGenerator: false
    });
    const checks = {
      registeredFamiliesUseLocalDeterministicRoute: results.length === 5 && results.every((result) => result.status === 'success'
        && result.provider === 'local-deterministic'
        && result.agent.provider === 'local-deterministic'),
      zeroProviderCalls: gatewayCallCount === 0 && results.every((result) => result.gatewayAttempts?.length === 0),
      zeroCostAuditRecorded: results.every((result) => result.promptMetadata.localShadowGeneration?.providerCallCount === 0
        && result.promptMetadata.localShadowGeneration?.estimatedCostUsd === 0),
      sourceIsolationAuditRetained: results.every((result) => result.promptMetadata.promptAudit?.sourceIsolation?.policyVersion === 'question-generator-source-isolation-v3'
        && result.promptMetadata.promptAudit?.sourceIsolation?.boundary === 'single_generator_invocation_input'
        && result.promptMetadata.promptAudit?.sourceIsolation?.sourceLinkageIdentifiersOmitted === true
        && result.promptMetadata.promptAudit?.sourceIsolation?.providerProjectionReplayable === true
        && /^[a-f0-9]{64}$/.test(String(result.promptMetadata.promptAudit?.sourceIsolation?.providerProjectionSha256 ?? ''))),
      deterministicSeedIsReplayable: JSON.stringify(repeatA.candidate) === JSON.stringify(repeatB.candidate)
        && repeatA.promptMetadata.localShadowGeneration.seed === repeatB.promptMetadata.localShadowGeneration.seed,
      seedIsIndependentOfDatabaseGeneratedIds:
        JSON.stringify(repeatA.candidate) === JSON.stringify(databaseIdentityIndependentRepeat.candidate)
        && repeatA.promptMetadata.localShadowGeneration.seed
          === databaseIdentityIndependentRepeat.promptMetadata.localShadowGeneration.seed,
      sealedTaskOrdinalRotatesSeed:
        repeatA.promptMetadata.localShadowGeneration.seed
          !== rotatedSeedMetadata.observationCandidateSeedBinding.seed,
      tamperedSeedBindingFailsClosed: tamperedSeedRejected,
      candidateSeedPolicyRecorded: results.every((result) =>
        result.promptMetadata.localShadowGeneration?.candidateSeedPolicyVersion
          === SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION
        && result.promptMetadata.localShadowGeneration?.candidateSeedBinding?.databaseIdentityIndependent === true),
      unregisteredScopeFailsWithoutProviderFallback: unregistered.status === 'local_generator_verification_failed'
        && unregistered.error.includes('exact_scope_not_registered'),
      missingPhysicsScopeFailsBeforeGeneratorFallback:
        missingPhysicsScope.status === 'local_generator_verification_failed'
        && missingPhysicsScope.error.includes('exact_physics_scope_missing_or_invalid'),
      missingDerivativeScopeFailsClosedWithoutProviderFallback:
        missingDerivativeScope.status === 'local_generator_verification_failed'
        && missingDerivativeScope.error.includes('math_derivative_local_generator_question_plan_not_supported'),
      missingChemistryScopeFailsBeforeGeneratorFallback:
        missingChemistryScope.status === 'local_generator_verification_failed'
        && missingChemistryScope.error.includes('exact_chemistry_scope_missing_or_invalid'),
      publicationSuppressionIsMandatory: unsuppressed.status === 'generator_disabled'
        && unsuppressed.provider !== 'local-deterministic',
      routingVersionRecorded: results.every((result) => result.promptMetadata.localShadowGeneration?.routingVersion
        === SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ROUTING_VERSION),
      explicitPhysicsScopeOverridesHashedSeed: results.find((result) => result.candidate.subject === 'physics')
        ?.promptMetadata.localShadowGeneration?.scopeId === 'physics-basic-kinematics-v2:final_velocity_from_initial_acceleration_time',
      explicitMathLineScopeOverridesDefault: results.find((result) => result.candidate.blueprintId === blueprints.mathLine.id)
        ?.promptMetadata.localShadowGeneration?.scopeId === 'math-basic-line-relation-v1:identify_parallel_or_perpendicular_line',
      explicitMathDerivativeScopeUsesFormalDeterministicRoute: results.find((result) => result.candidate.blueprintId === blueprints.mathDerivative.id)
        ?.promptMetadata.localShadowGeneration?.scopeId === 'math-basic-derivative-v1:direct_polynomial_value',
      explicitChemistryScopeOverridesHashedSeed: results.find((result) => result.candidate.subject === 'chemistry')
        ?.promptMetadata.localShadowGeneration?.scopeId === 'chemistry-strong-acid-base-v3:strong_acid_base_neutralization:acid_base_character',
      physicsScopeRotationIsBalancedAndRepeats: JSON.stringify(rotationFixtures.physics) === JSON.stringify([
        'uniform_speed', 'acceleration_from_velocity_change', 'final_velocity_from_initial_acceleration_time', 'displacement_from_initial_acceleration_time',
        'uniform_speed', 'acceleration_from_velocity_change', 'final_velocity_from_initial_acceleration_time', 'displacement_from_initial_acceleration_time'
      ]),
      mathLineScopeRotationIsBalancedAndRepeats: JSON.stringify(rotationFixtures.mathLine) === JSON.stringify([
        'slope_from_two_distinct_points', 'inclination_angle_from_line', 'identify_parallel_or_perpendicular_line', 'line_equation_from_point_and_slope',
        'slope_from_two_distinct_points', 'inclination_angle_from_line', 'identify_parallel_or_perpendicular_line', 'line_equation_from_point_and_slope'
      ]),
      chemistryScopeRotationIsBalancedAndRepeats: JSON.stringify(rotationFixtures.chemistry) === JSON.stringify([
        'strong_acid_dilution:ph_value', 'strong_acid_dilution:acid_base_character',
        'strong_base_dilution:ph_value', 'strong_base_dilution:acid_base_character',
        'strong_acid_base_neutralization:ph_value', 'strong_acid_base_neutralization:acid_base_character',
        'strong_acid_dilution:ph_value', 'strong_acid_dilution:acid_base_character',
        'strong_base_dilution:ph_value', 'strong_base_dilution:acid_base_character',
        'strong_acid_base_neutralization:ph_value', 'strong_acid_base_neutralization:acid_base_character'
      ]),
      productionFeedbackPersistsPhysicsScope: physicsFeedback.questionPlanRotation?.physicsKinematicsScope
        === 'final_velocity_from_initial_acceleration_time',
      productionFeedbackPersistsMathLineScope: mathLineFeedback.questionPlanRotation?.lineRelationScope
        === 'line_equation_from_point_and_slope',
      productionFeedbackPersistsChemistryScope: chemistryFeedback.questionPlanRotation?.chemistryRelationKind
        === 'strong_acid_base_neutralization'
        && chemistryFeedback.questionPlanRotation?.chemistryAnswerTarget === 'ph_value',
      exactPlanSupportRejectsNearMiss: subjectPracticeLocalGeneratorShadowPlanSupported({
        subject: 'physics', taskFamily: 'kinematics_basic_direct_relation', planTemplate: 'physics_kinematics_basic_relation_v1'
      }) && !subjectPracticeLocalGeneratorShadowPlanSupported({
        subject: 'physics', taskFamily: 'kinematics_basic_direct_relation', planTemplate: 'math_elementary_function_relation_v1'
      }),
      zeroProviderCostContractAcceptsOnlyExactZeros: subjectPracticeObservationCostReservationValid({
        route: 'local_deterministic_zero_provider',
        policyVersion: SUBJECT_PRACTICE_ZERO_PROVIDER_OBSERVATION_COST_POLICY_VERSION,
        maxEstimatedCostUsd: 0,
        storedMaximumReservedCostUsd: 0,
        currentMaximumReservedCostUsd: 0
      }) && !subjectPracticeObservationCostReservationValid({
        route: 'local_deterministic_zero_provider',
        policyVersion: SUBJECT_PRACTICE_ZERO_PROVIDER_OBSERVATION_COST_POLICY_VERSION,
        maxEstimatedCostUsd: 0.001,
        storedMaximumReservedCostUsd: 0,
        currentMaximumReservedCostUsd: 0
      }),
      providerCostContractCannotMasqueradeAsZeroProvider: !subjectPracticeObservationCostReservationValid({
        route: 'local_deterministic_zero_provider',
        policyVersion: 'guarded-observation-cost-reservation-v1',
        maxEstimatedCostUsd: 0,
        storedMaximumReservedCostUsd: 0,
        currentMaximumReservedCostUsd: 0
      }),
      generationJobAdmissionAcceptsExactZeroProviderContract:
        subjectPracticeObservationGenerationJobCostReservationValid({
          route: 'local_deterministic_zero_provider',
          policyVersion: SUBJECT_PRACTICE_ZERO_PROVIDER_OBSERVATION_COST_POLICY_VERSION,
          maxEstimatedCostUsd: 0,
          maximumReservedCostUsd: 0
        }),
      generationJobAdmissionRejectsUnknownRouteAndCrossedPolicy:
        !subjectPracticeObservationGenerationJobCostReservationValid({
          route: 'local_zero_provider_typo',
          policyVersion: SUBJECT_PRACTICE_ZERO_PROVIDER_OBSERVATION_COST_POLICY_VERSION,
          maxEstimatedCostUsd: 0,
          maximumReservedCostUsd: 0
        })
        && !subjectPracticeObservationGenerationJobCostReservationValid({
          route: 'local_deterministic_zero_provider',
          policyVersion: 'guarded-observation-cost-reservation-v1',
          maxEstimatedCostUsd: 0,
          maximumReservedCostUsd: 0
        }),
      localZeroProviderReadinessDoesNotRequireProviderKeysOrGatewayCapacity:
        localOnlyReadiness.readyForLocalZeroProviderExecution === true
        && localOnlyReadiness.readyForExecution === false
        && localOnlyReadiness.localZeroProviderReasons.length === 0
        && localOnlyReadiness.providerReasons.includes('eligible_background_key_slots_below_two'),
      localZeroProviderReadinessStillRequiresIsolation:
        localUnsafeReadiness.readyForLocalZeroProviderExecution === false
        && localUnsafeReadiness.localZeroProviderReasons.includes('observation_only_mode_required'),
      localShadowBatchSelectsOneExactFamilyPerSubject:
        batchTargets.length === 3
        && batchTargets.every((target) => target.status === 'selected' && target.count === 1),
      localShadowBatchRuntimeAcceptsNoProviderCapacityWhenExactCellsAllowed: batchRuntimeAccepted,
      localShadowBatchAuthorizationDigestIsDeterministic:
        localShadowBatchDigestFor(batchTargets) === localShadowBatchDigestFor(batchTargets)
        && localShadowBatchDigestFor(batchTargets) !== localShadowBatchDigestFor(batchTargets.slice(0, 2)),
      localShadowBatchScorecardSeparatesYieldAndPublishableRate:
        batchScorecard.overall.candidateCount === 2
        && batchScorecard.overall.publishableCount === 1
        && batchScorecard.overall.candidateYieldRate === 2 / 3
        && batchScorecard.overall.publishableRate === 1 / 3
        && batchScorecard.overall.leakageClearCount === 1
        && batchScorecard.overall.leakageBlockedCount === 1
        && batchScorecard.overall.leakageClearRate === 1 / 3
        && batchScorecard.overall.providerCallCount === 0
        && batchScorecard.overall.studentPublicationCount === 0,
      clearAutomatedLeakageEvidencePreservesDeterministicReview: clearLeakageReview === reviewFixture,
      incompleteClearAutomatedLeakageEvidenceFailsClosed:
        incompleteClearLeakageReview.status === 'failed'
        && incompleteClearLeakageReview.decision === 'regenerate'
        && incompleteClearLeakageReview.issues.some((issue) => issue.code === 'candidate_known_source_corpus_missing'),
      missingAutomatedLeakageCorpusFailsClosedBeforePublication:
        missingLeakageReview.status === 'failed'
        && missingLeakageReview.decision === 'regenerate'
        && missingLeakageReview.issues.some((issue) => issue.code === 'candidate_known_source_corpus_missing'),
      localObservationSkipsPaidReviewer: results.every((result) => subjectPracticeReviewProviderModeForGeneration({
        isObservationJob: true,
        generatorProvider: result.provider
      }) === 'deterministic_only'),
      nonLocalOrNonObservationKeepsDefaultReviewer:
        subjectPracticeReviewProviderModeForGeneration({ isObservationJob: false, generatorProvider: 'local-deterministic' }) === 'default'
        && subjectPracticeReviewProviderModeForGeneration({ isObservationJob: true, generatorProvider: 'deepseek' }) === 'default'
    };
    return {
      mode: 'subject_practice_local_generator_shadow_routing_self_test',
      reportVersion: 'subject-practice-local-generator-shadow-routing-self-test-v3-math-derivative',
      routingVersion: SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ROUTING_VERSION,
      candidateSeedPolicyVersion: SUBJECT_PRACTICE_LOCAL_SHADOW_CANDIDATE_SEED_POLICY_VERSION,
      status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
      checks,
      generatedSubjects: results.map((result) => ({
        subject: result.candidate.subject,
        model: result.model,
        status: result.status,
        provider: result.provider,
        agentProvider: result.agent?.provider,
        error: result.error ?? null,
        scopeId: result.promptMetadata.localShadowGeneration.scopeId
      })),
      providerCallCount: gatewayCallCount,
      estimatedCostUsd: 0,
      dbImpact: 'none_no_database_connection',
      productionImpact: 'none_default_disabled_fixture_only'
    };
  } finally {
    if (previousLocal === undefined) delete process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED;
    else process.env.CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED = previousLocal;
    if (previousExternal === undefined) delete process.env.CSCA_AI_QUESTION_GENERATION_ENABLED;
    else process.env.CSCA_AI_QUESTION_GENERATION_ENABLED = previousExternal;
  }
}

if (require.main === module) {
  run().then((report) => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'passed') process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { runSelfTest: run };
