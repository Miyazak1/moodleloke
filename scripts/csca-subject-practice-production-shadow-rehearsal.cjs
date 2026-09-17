#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const { generateSubjectPracticeMathElementaryLocally } = require('../backend/src/ai-questioning/subject-practice-math-elementary-local-generator');
const { solveElementaryFunctionDirectProperty } = require('../backend/src/ai-questioning/subject-practice-math-solver');
const { verifySubjectPracticeMathElementaryExplanation } = require('../backend/src/ai-questioning/subject-practice-math-elementary-explanation-verifier');
const { verifySubjectPracticeMathElementaryWithIndependentOracle } = require('../backend/src/ai-questioning/subject-practice-math-elementary-independent-oracle');
const { generateSubjectPracticePhysicsKinematicsLocally } = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-local-generator');
const { solveSubjectPracticePhysicsKinematics } = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-solver');
const { verifySubjectPracticePhysicsKinematicsExplanation } = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-explanation-verifier');
const { verifySubjectPracticePhysicsKinematicsWithIndependentOracle } = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-independent-oracle');
const { generateSubjectPracticeChemistryAcidBaseLocally } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const { solveSubjectPracticeChemistryAcidBase } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-solver');
const { verifySubjectPracticeChemistryAcidBaseExplanation } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-explanation-verifier');
const { verifySubjectPracticeChemistryAcidBaseWithIndependentOracle } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-independent-oracle');
const {
  SUBJECT_PRACTICE_FORMAL_VERIFICATION_ORCHESTRATOR_VERSION,
  verifySubjectPracticeFormalCandidate
} = require('../backend/src/ai-questioning/subject-practice-formal-verification-orchestrator');

const validator = new QuestionValidatorService();
const clone = (value) => JSON.parse(JSON.stringify(value));

const blueprints = {
  math: {
    id: 16, subject: 'math', topicId: 69, topicCode: 'M-FUN-002', topicModule: '函数', topicTitle: '基本初等函数',
    syllabusVersion: '2025', examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。', allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['basic'], excludedScope: [], difficulty: 'basic', questionType: 'single_choice', skill: 'concept_identification', constraints: {}
  },
  physics: {
    id: 24, subject: 'physics', topicId: 8, topicCode: 'P-MECH-001', topicModule: '力学', topicTitle: 'Kinematics',
    syllabusVersion: '2025', examScope: '直线运动中位移、时间、速度和加速度的基本关系。', allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['basic'], excludedScope: ['graph', 'piecewise_motion', 'multi_stage_model'], difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
  },
  chemistry: {
    id: 41, subject: 'chemistry', topicId: 642, topicCode: 'C-BASIC-003', topicModule: '溶液', topicTitle: '溶液浓度与pH计算',
    syllabusVersion: '2025', examScope: '一元强酸强碱的稀释、中和、pH与酸碱性判断。', allowedQuestionTypes: ['single_choice'],
    difficultyRange: ['medium'], excludedScope: ['weak_acid_base', 'buffer', 'hydrolysis', 'titration_curve'], difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {}
  }
};

function mathSamples() {
  const slots = [['logarithmic', 'domain'], ['exponential', 'range'], ['radical', 'monotonicity'], ['power', 'function_value']];
  return slots.flatMap(([functionClass, propertyTarget]) => {
    const plan = buildSubjectPracticeQuestionPlan({
      subject: 'math', topicId: 69, topicTitle: '基本初等函数', productionCellId: 16,
      targetDifficulty: 'basic', taskFamily: 'elementary_function_direct_property',
      requiredElementaryFunctionClass: functionClass, requiredSinglePropertyTarget: propertyTarget
    });
    return Array.from({ length: 32 }, (_, seed) => {
      const generated = generateSubjectPracticeMathElementaryLocally({ blueprint: blueprints.math, questionPlan: plan, seed });
      return {
        subject: 'math', plan, candidate: generated.candidate, expectedScopeId: generated.scopeId,
        solve: (candidate, nextPlan) => solveElementaryFunctionDirectProperty(candidate, { questionPlan: nextPlan }),
        explain: (candidate, nextPlan) => verifySubjectPracticeMathElementaryExplanation(candidate, { questionPlan: nextPlan }),
        oracle: (candidate, nextPlan) => verifySubjectPracticeMathElementaryWithIndependentOracle(candidate, { questionPlan: nextPlan })
      };
    });
  });
}

function physicsSamples() {
  const relations = ['uniform_speed', 'acceleration_from_velocity_change', 'final_velocity_from_initial_acceleration_time', 'displacement_from_initial_acceleration_time'];
  return relations.flatMap((relationKind) => {
    const plan = buildSubjectPracticeQuestionPlan({
      subject: 'physics', topicId: 8, topicTitle: 'Kinematics', productionCellId: 24,
      targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
      exactPhysicsKinematicsScope: relationKind
    });
    return Array.from({ length: 128 }, (_, seed) => {
    const generated = generateSubjectPracticePhysicsKinematicsLocally({ blueprint: blueprints.physics, questionPlan: plan, seed, relationKind });
    return {
      subject: 'physics', plan, candidate: generated.candidate, expectedScopeId: generated.scopeId,
      solve: (candidate, nextPlan) => solveSubjectPracticePhysicsKinematics(candidate, { questionPlan: nextPlan }),
      explain: (candidate, nextPlan) => verifySubjectPracticePhysicsKinematicsExplanation(candidate, { questionPlan: nextPlan }),
      oracle: (candidate, nextPlan) => verifySubjectPracticePhysicsKinematicsWithIndependentOracle(candidate, { questionPlan: nextPlan })
    };
    });
  });
}

function chemistrySamples() {
  const relations = ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'];
  const targets = ['ph_value', 'acid_base_character'];
  return relations.flatMap((relationKind) => targets.flatMap((answerTarget) => {
    const plan = buildSubjectPracticeQuestionPlan({
      subject: 'chemistry', topicId: 642, topicTitle: '溶液浓度与pH计算', productionCellId: 41,
      targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
      exactChemistryRelationKind: relationKind,
      exactChemistryAnswerTarget: answerTarget
    });
    return Array.from({ length: 32 }, (_, seed) => {
    const generated = generateSubjectPracticeChemistryAcidBaseLocally({ blueprint: blueprints.chemistry, questionPlan: plan, seed, relationKind, answerTarget });
    return {
      subject: 'chemistry', plan, candidate: generated.candidate, expectedScopeId: generated.scopeId,
      solve: (candidate, nextPlan) => solveSubjectPracticeChemistryAcidBase(candidate, {
        taskFamily: 'ph_dilution_strong_acid_base_neutralization', questionPlan: nextPlan
      }),
      explain: (candidate, nextPlan) => verifySubjectPracticeChemistryAcidBaseExplanation(candidate, {
        taskFamily: 'ph_dilution_strong_acid_base_neutralization', questionPlan: nextPlan
      }),
      oracle: (candidate, nextPlan) => verifySubjectPracticeChemistryAcidBaseWithIndependentOracle(candidate, { questionPlan: nextPlan })
    };
    });
  }));
}

function verificationScope(evidence) {
  return evidence.verificationScope ?? { matched: evidence.scopeMatched, scopeId: evidence.scopeId };
}

function evaluate(sample, candidate, plan = sample.plan) {
  if (!candidate) return { eligible: false, reasonCodes: ['candidate_missing'] };
  const taskFamily = sample.subject === 'math'
    ? 'elementary_function_direct_property'
    : sample.subject === 'physics'
      ? 'kinematics_basic_direct_relation'
      : 'ph_dilution_strong_acid_base_neutralization';
  const formalVerification = verifySubjectPracticeFormalCandidate({ candidate, taskFamily, questionPlan: plan });
  const adherence = subjectPracticeQuestionPlanAdherenceFor(plan, candidate);
  const review = validator.review(candidate, {
    subject: sample.subject, intendedUse: 'subject_practice', topicId: candidate.topicId,
    syllabusVersion: candidate.syllabusVersion, questionPlan: plan
  });
  const reasonCodes = [];
  if (!formalVerification || formalVerification.status !== 'verified') {
    reasonCodes.push(`formal_verification_${formalVerification?.status ?? 'unsupported'}`);
  }
  if (!formalVerification?.scopeMatchedAcrossVerifiers || formalVerification.scopeId !== sample.expectedScopeId) reasonCodes.push('exact_scope_mismatch');
  if (!adherence.adheres) reasonCodes.push('question_plan_adherence_failed');
  if (review.issues.some((issue) => issue.severity === 'error')) reasonCodes.push('validator_blocking_error');
  return { eligible: reasonCodes.length === 0, reasonCodes, formalVerification };
}

const samples = [...mathSamples(), ...physicsSamples(), ...chemistrySamples()];
const observations = samples.map((sample) => ({ sample, evidence: evaluate(sample, sample.candidate) }));
const mutations = samples.flatMap((sample) => {
  if (!sample.candidate) {
    return [{ type: 'candidate_missing_before_mutation', evidence: evaluate(sample, null) }];
  }
  const answerFlip = clone(sample.candidate);
  answerFlip.correctAnswer = answerFlip.correctAnswer === 'A' ? 'B' : 'A';
  const explanationConflict = clone(sample.candidate);
  explanationConflict.explanation = '错误解析。';
  if (explanationConflict.localizations?.en) explanationConflict.localizations.en.explanation = 'Incorrect explanation.';
  const unsupportedPrompt = clone(sample.candidate);
  unsupportedPrompt.prompt = '使用未提供的图像和多阶段模型综合判断。';
  const wrongPlan = { ...sample.plan, taskFamily: 'out_of_scope_mutation' };
  return [
    { type: 'generator_answer_flip', evidence: evaluate(sample, answerFlip) },
    { type: 'explanation_conflict', evidence: evaluate(sample, explanationConflict) },
    { type: 'unsupported_prompt', evidence: evaluate(sample, unsupportedPrompt) },
    { type: 'question_plan_scope_leak', evidence: evaluate(sample, sample.candidate, wrongPlan) }
  ];
});

const observedBySubject = ['math', 'physics', 'chemistry'].map((subject) => {
  const subjectObservations = observations.filter((item) => item.sample.subject === subject);
  return {
    subject,
    observedCount: subjectObservations.length,
    eligibleAndPublicationSuppressedCount: subjectObservations.filter((item) => item.evidence.eligible).length,
    unexpectedConflictCount: subjectObservations.filter((item) => !item.evidence.eligible).length,
    scopeLeakageCount: subjectObservations.filter((item) => item.evidence.reasonCodes.includes('exact_scope_mismatch')).length
  };
});
const mutationCounts = mutations.reduce((counts, item) => {
  counts[item.type] = (counts[item.type] ?? 0) + 1;
  return counts;
}, {});
const mutationFalseAcceptCount = mutations.filter((item) => item.evidence.eligible).length;
const rehearsalPassed = observations.every((item) => item.evidence.eligible) && mutationFalseAcceptCount === 0;
const report = {
  mode: 'subject_practice_offline_production_shadow_rehearsal',
  reportVersion: 'subject-practice-production-shadow-rehearsal-v3',
  formalVerificationOrchestratorVersion: SUBJECT_PRACTICE_FORMAL_VERIFICATION_ORCHESTRATOR_VERSION,
  status: rehearsalPassed ? 'passed' : 'failed',
  qualificationBoundary: {
    qualifiesAsProductionShadowEvidence: false,
    reason: 'fixture_only_rehearsal_has_no_real_production_traffic_or_database_observation',
    formalProductionShadowObservedCount: 0
  },
  publicationSuppressed: true,
  publicationAttemptCount: 0,
  observedCount: observations.length,
  eligibleAndPublicationSuppressedCount: observations.filter((item) => item.evidence.eligible).length,
  unexpectedConflictCount: observations.filter((item) => !item.evidence.eligible).length,
  scopeLeakageCount: observations.filter((item) => item.evidence.reasonCodes.includes('exact_scope_mismatch')).length,
  mutationCaseCount: mutations.length,
  mutationFalseAcceptCount,
  mutationCounts,
  observedBySubject,
  providerImpact: 'none_no_provider_call',
  providerCallCount: 0,
  estimatedCostUsd: 0,
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_fixture_only_rehearsal'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!rehearsalPassed) process.exitCode = 1;
}

module.exports = { report };
