#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const crypto = require('node:crypto');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  buildSubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  subjectPracticeObservationScopeBindingFor
} = require('../backend/src/ai-questioning/subject-practice-observation-scope-binding-policy');
const {
  subjectPracticeProductionShadowScopeContracts
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');
const {
  generateSubjectPracticeMathElementaryLocally
} = require('../backend/src/ai-questioning/subject-practice-math-elementary-local-generator');
const {
  generateSubjectPracticeMathLineRelationLocally
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-local-generator');
const {
  generateSubjectPracticeMathDerivativeLocally
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-local-generator');
const {
  generateSubjectPracticePhysicsKinematicsLocally
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-local-generator');
const {
  generateSubjectPracticeChemistryAcidBaseLocally
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const {
  verifySubjectPracticeFormalCandidate
} = require('../backend/src/ai-questioning/subject-practice-formal-verification-orchestrator');
const {
  subjectPracticeScenarioDiversityBatchMetrics,
  subjectPracticeScenarioEvidenceFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-diversity-policy');
const {
  subjectPracticeLocalGeneratorProductionProfileBindingForCell
} = require('../backend/src/ai-questioning/subject-practice-local-generator-production-profile-binding-policy');

const SAMPLES_PER_SCOPE = 8;
const validator = new QuestionValidatorService();
const fixtures = {
  'math:elementary_function_direct_property': {
    productionRunId: 1,
    productionCellId: 16,
    blueprint: {
      id: 16, subject: 'math', topicId: 69, topicCode: 'M-FUN-002', topicModule: '函数',
      topicTitle: '基本初等函数', syllabusVersion: '2025', difficulty: 'basic',
      questionType: 'single_choice', skill: 'concept_identification', constraints: {},
      examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。',
      allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'], excludedScope: []
    }
  },
  'math:math_line_relation_direct': {
    productionRunId: 1,
    productionCellId: 91001,
    blueprint: {
      id: 91001, subject: 'math', topicId: 92001, topicCode: 'M-LINE-001', topicModule: '解析几何',
      topicTitle: 'line relation', syllabusVersion: 'line-relation-shadow-v1', difficulty: 'basic',
      questionType: 'single_choice', skill: 'direct_application', constraints: {},
      examScope: '解析几何中的基础直线关系', allowedQuestionTypes: ['single_choice'],
      difficultyRange: ['basic'], excludedScope: []
    }
  },
  'math:derivative_direct_evaluation': {
    productionRunId: 1,
    productionCellId: 10,
    blueprint: {
      id: 10, subject: 'math', topicId: 71, topicCode: 'M-CALC-001', topicModule: '微积分',
      topicTitle: '导数与微积分初步', syllabusVersion: '2025', difficulty: 'basic',
      questionType: 'single_choice', skill: 'multi_step_reasoning', constraints: {},
      examScope: '多项式函数的直接求导与指定点导数值。',
      allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'],
      excludedScope: ['domain_trap', 'piecewise_function', 'implicit_differentiation', 'higher_derivative']
    }
  },
  'physics:kinematics_basic_direct_relation': {
    productionRunId: 2,
    productionCellId: 24,
    blueprint: {
      id: 24, subject: 'physics', topicId: 8, topicCode: 'P-MECH-001', topicModule: '力学',
      topicTitle: 'Kinematics', syllabusVersion: '2025', difficulty: 'basic',
      questionType: 'single_choice', skill: 'direct_application', constraints: {},
      examScope: '直线运动中位移、时间、速度和加速度的基本关系。',
      allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'],
      excludedScope: ['graph', 'piecewise_motion', 'multi_stage_model']
    }
  },
  'chemistry:ph_dilution_strong_acid_base_neutralization': {
    productionRunId: 3,
    productionCellId: 42,
    blueprint: {
      id: 42, subject: 'chemistry', topicId: 51, topicCode: 'C-BASIC-003', topicModule: '溶液',
      topicTitle: '溶液浓度与 pH 计算', syllabusVersion: '2025', difficulty: 'medium',
      questionType: 'single_choice', skill: 'standard_application', constraints: {},
      examScope: '一元强酸强碱的稀释、中和、pH与酸碱性判断。',
      allowedQuestionTypes: ['single_choice'], difficultyRange: ['medium'],
      excludedScope: ['weak_acid_base', 'polyprotic', 'buffer', 'hydrolysis', 'activity', 'titration_curve']
    }
  }
};

function seedFor(batchId, ordinal) {
  const digest = crypto.createHash('sha256').update(`${batchId}:${ordinal}`).digest('hex');
  return (Number.parseInt(digest.slice(0, 12), 16) % 1000000) + 1000;
}

function planFor(binding, blueprint) {
  return buildSubjectPracticeQuestionPlan({
    subject: binding.subject,
    topicId: blueprint.topicId,
    topicTitle: blueprint.topicTitle,
    productionCellId: blueprint.id,
    targetDifficulty: blueprint.difficulty,
    taskFamily: binding.taskFamily,
    planTemplate: binding.planTemplate,
    requiredElementaryFunctionClass: binding.rotation.functionClass,
    requiredSinglePropertyTarget: binding.rotation.propertyTarget,
    exactLineRelationScope: binding.rotation.lineRelationScope,
    exactDerivativeScope: binding.rotation.derivativeScope,
    exactPhysicsKinematicsScope: binding.rotation.physicsKinematicsScope,
    exactChemistryRelationKind: binding.rotation.chemistryRelationKind,
    exactChemistryAnswerTarget: binding.rotation.chemistryAnswerTarget,
    scenarioSeed: binding.scenarioSeed
  });
}

function generateFor(binding, blueprint, questionPlan, seed) {
  if (binding.subject === 'math' && binding.taskFamily === 'elementary_function_direct_property') {
    return generateSubjectPracticeMathElementaryLocally({ blueprint, questionPlan, seed });
  }
  if (binding.subject === 'math' && binding.taskFamily === 'math_line_relation_direct') {
    return generateSubjectPracticeMathLineRelationLocally({ blueprint, questionPlan, seed });
  }
  if (binding.subject === 'math' && binding.taskFamily === 'derivative_direct_evaluation') {
    return generateSubjectPracticeMathDerivativeLocally({ blueprint, questionPlan, seed });
  }
  if (binding.subject === 'physics') {
    const relationKind = questionPlan?.renderConstraints?.exactPhysicsKinematicsScope;
    return generateSubjectPracticePhysicsKinematicsLocally({
      blueprint, questionPlan, seed, relationKind
    });
  }
  const relationKind = questionPlan?.renderConstraints?.exactChemistryRelationKind;
  const answerTarget = questionPlan?.renderConstraints?.exactChemistryAnswerTarget;
  return generateSubjectPracticeChemistryAcidBaseLocally({
    blueprint,
    questionPlan,
    seed,
    relationKind,
    answerTarget
  });
}

function runContract(contract, options = {}) {
  const fixture = fixtures[`${contract.subject}:${contract.taskFamily}`];
  if (!fixture) {
    throw new Error(`Missing family-qualification rehearsal fixture for ${contract.subject}:${contract.taskFamily}`);
  }
  const samplesPerScope = options.samplesPerScope ?? SAMPLES_PER_SCOPE;
  const tasks = Array.from({ length: samplesPerScope }, () => contract.expectedScopeIds)
    .flat()
    .map((plannedScopeId, index) => ({
      ordinal: index + 1,
      subject: contract.subject,
      productionRunId: fixture.productionRunId,
      productionCellId: fixture.productionCellId,
      taskFamily: contract.taskFamily,
      planTemplate: contract.planTemplate,
      plannedScopeId
    }));
  const manifest = buildSubjectPracticeObservationBatchManifest(tasks);
  const firstEnvelope = subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 });
  const results = tasks.map((task) => {
    const binding = subjectPracticeObservationScopeBindingFor({
      envelope: subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: task.ordinal })
    });
    let questionPlan = planFor(binding, fixture.blueprint);
    if (typeof options.mutateQuestionPlan === 'function') {
      questionPlan = options.mutateQuestionPlan({
        questionPlan,
        task,
        binding,
        fixture,
        manifest
      });
    }
    const generated = generateFor(binding, fixture.blueprint, questionPlan, seedFor(firstEnvelope.batchId, task.ordinal));
    let candidate = generated.candidate;
    if (candidate && typeof options.mutateCandidate === 'function') {
      candidate = options.mutateCandidate({
        candidate: structuredClone(candidate),
        task,
        binding,
        fixture,
        manifest,
        questionPlan
      });
    }
    const formal = candidate ? verifySubjectPracticeFormalCandidate({
      candidate,
      taskFamily: contract.taskFamily,
      questionPlan
    }) : null;
    const review = candidate ? validator.review(candidate, {
      subject: contract.subject,
      intendedUse: 'subject_practice',
      topicId: fixture.blueprint.topicId,
      topicTitle: fixture.blueprint.topicTitle,
      syllabusVersion: fixture.blueprint.syllabusVersion,
      allowedQuestionTypes: ['single_choice'],
      difficultyRange: [fixture.blueprint.difficulty],
      examScope: fixture.blueprint.examScope,
      excludedScope: fixture.blueprint.excludedScope,
      questionPlan
    }) : null;
    const adherence = candidate ? subjectPracticeQuestionPlanAdherenceFor(questionPlan, candidate) : null;
    const scenarioEvidence = candidate
      ? subjectPracticeScenarioEvidenceFor({ questionPlan, candidate })
      : null;
    const passed = Boolean(candidate
      && generated.scopeId === task.plannedScopeId
      && formal?.status === 'verified'
      && formal.scopeId === task.plannedScopeId
      && formal.eligibleForProductionShadowObservation
      && review
      && !review.issues.some((issue) => issue.severity === 'error')
      && adherence?.adheres
      && scenarioEvidence?.status === 'consistent'
      && generated.providerImpact === 'none_no_provider_call'
      && Number(generated.estimatedCostUsd) === 0);
    return {
      ordinal: task.ordinal,
      plannedScopeId: task.plannedScopeId,
      generatedScopeId: generated.scopeId,
      generationStatus: generated.status,
      formalStatus: formal?.status ?? null,
      scenarioEvidence,
      passed,
      reasonCodes: passed ? [] : [
        ...(generated.reasonCodes ?? []),
        ...(formal?.reasonCodes ?? []),
        ...(adherence?.failureCodes ?? []),
        ...(review?.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code) ?? [])
      ]
    };
  });
  const perScopeCounts = Object.fromEntries(contract.expectedScopeIds.map((scopeId) => [
    scopeId,
    results.filter((result) => result.plannedScopeId === scopeId && result.passed).length
  ]));
  const failures = results.filter((result) => !result.passed);
  const scenarioDiversity = subjectPracticeScenarioDiversityBatchMetrics({
    expectedCount: tasks.length,
    evidence: results.map((result) => result.scenarioEvidence).filter(Boolean)
  });
  return {
    exactPlan: `${contract.subject}:${contract.taskFamily}:${contract.planTemplate}`,
    batchId: firstEnvelope.batchId,
    taskCount: tasks.length,
    passedCount: tasks.length - failures.length,
    failedCount: failures.length,
    perScopeCounts,
    scenarioDiversity,
    status: failures.length === 0
      && Object.values(perScopeCounts).every((count) => count === samplesPerScope)
      ? 'passed'
      : 'failed',
    failures: failures.slice(0, 12)
  };
}

const contracts = subjectPracticeProductionShadowScopeContracts();
const eligibleContracts = contracts.filter((contract) => {
  const fixture = fixtures[`${contract.subject}:${contract.taskFamily}`];
  if (!fixture) return false;
  return Boolean(subjectPracticeLocalGeneratorProductionProfileBindingForCell({
    subject: contract.subject,
    productionRunId: fixture.productionRunId,
    productionCellId: fixture.productionCellId
  }));
});
const deferredContracts = contracts.filter((contract) => !eligibleContracts.includes(contract)).map((contract) => ({
  exactPlan: `${contract.subject}:${contract.taskFamily}:${contract.planTemplate}`,
  reason: 'current_production_profile_binding_missing'
}));
const families = eligibleContracts.map(runContract);

function alternateAnswerCandidate({ candidate }) {
  const alternative = candidate.options?.find((option) => String(option?.id) !== String(candidate.correctAnswer));
  return { ...candidate, correctAnswer: alternative?.id ?? '__invalid_answer__' };
}

function blankExplanationCandidate({ candidate }) {
  return {
    ...candidate,
    explanation: '',
    localizations: {
      ...candidate.localizations,
      zh: { ...candidate.localizations?.zh, explanation: '' },
      en: { ...candidate.localizations?.en, explanation: '' }
    }
  };
}

function swappedScopePlan({ fixture, manifest, questionPlan }) {
  if (manifest.tasks.length < 2) {
    return {
      ...questionPlan,
      renderConstraints: {
        ...questionPlan.renderConstraints,
        exactDerivativeScope: questionPlan.renderConstraints?.exactDerivativeScope
          ? '__manifest_scope_mismatch__'
          : questionPlan.renderConstraints?.exactDerivativeScope
      }
    };
  }
  const nextScopeBinding = subjectPracticeObservationScopeBindingFor({
    envelope: subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 2 })
  });
  return planFor(nextScopeBinding, fixture.blueprint);
}

const faultInjection = eligibleContracts.flatMap((contract) => {
  const exactPlan = `${contract.subject}:${contract.taskFamily}:${contract.planTemplate}`;
  return [
    {
      name: 'wrong_correct_answer',
      exactPlan,
      result: runContract(contract, {
        samplesPerScope: 1,
        mutateCandidate: ({ candidate, task }) => task.ordinal === 1
          ? alternateAnswerCandidate({ candidate })
          : candidate
      })
    },
    {
      name: 'blank_bilingual_explanation',
      exactPlan,
      result: runContract(contract, {
        samplesPerScope: 1,
        mutateCandidate: ({ candidate, task }) => task.ordinal === 1
          ? blankExplanationCandidate({ candidate })
          : candidate
      })
    },
    {
      name: 'manifest_scope_plan_swap',
      exactPlan,
      result: runContract(contract, {
        samplesPerScope: 1,
        mutateQuestionPlan: (context) => context.task.ordinal === 1
          ? swappedScopePlan(context)
          : context.questionPlan
      })
    }
  ];
}).map((test) => ({
  name: test.name,
  exactPlan: test.exactPlan,
  detected: test.result.status === 'failed'
    && test.result.failedCount >= 1
    && test.result.failures.some((failure) => failure.ordinal === 1),
  failedCount: test.result.failedCount,
  firstFailure: test.result.failures.find((failure) => failure.ordinal === 1) ?? null
}));

const scenarioCoverageComplete = families.every((family) => {
  if (family.exactPlan.startsWith('physics:') || family.exactPlan.startsWith('chemistry:')) {
    return family.scenarioDiversity.scenarioFamilyCoverageCount === 6
      && family.scenarioDiversity.scenarioConsistencyFailureRate === 0;
  }
  return family.scenarioDiversity.abstractOrNotApplicableCount === family.taskCount
    && family.scenarioDiversity.scenarioConsistencyFailureRate === 0;
});

const report = {
  mode: 'subject_practice_family_qualification_memory_rehearsal',
  reportVersion: 'subject-practice-family-qualification-memory-rehearsal-v5-math-derivative',
  status: families.every((family) => family.status === 'passed')
    && faultInjection.every((test) => test.detected)
    && scenarioCoverageComplete
    ? 'passed'
    : 'failed',
  samplesPerScope: SAMPLES_PER_SCOPE,
  familyCount: families.length,
  deferredFamilyCount: deferredContracts.length,
  deferredContracts,
  totalTaskCount: families.reduce((sum, family) => sum + family.taskCount, 0),
  totalPassedCount: families.reduce((sum, family) => sum + family.passedCount, 0),
  families,
  faultInjection,
  scenarioCoverageComplete,
  officialQuestionContentUsedByGenerator: false,
  candidateLeakageDatabaseGateExercised: false,
  candidateLeakageBoundary: 'must_run_post_generation_in_real_observation_worker',
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}
module.exports = { report, runContract };
