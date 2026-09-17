#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const assert = require('node:assert/strict');
const {
  buildSubjectPracticeQuestionPlan,
  validateSubjectPracticeQuestionPlan
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
  subjectPracticeScenarioDiversityBatchMetrics,
  subjectPracticeScenarioEvidenceFor,
  subjectPracticeScenarioFingerprintFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-diversity-policy');
const {
  generateSubjectPracticePhysicsKinematicsLocally
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-local-generator');
const {
  generateSubjectPracticeChemistryAcidBaseLocally
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const {
  SUBJECT_PRACTICE_DYNAMIC_SCENARIO_CALIBRATION_BATCH_ID,
  SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION,
  subjectPracticeDynamicScenarioQualificationDecision
} = require('../backend/src/ai-questioning/subject-practice-dynamic-scenario-qualification-policy');

const physicsBlueprint = {
  id: 24, subject: 'physics', topicId: 8, topicCode: 'P-MECH-001', topicModule: '力学',
  topicTitle: 'Kinematics', syllabusVersion: '2025', examScope: '直线运动。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'], excludedScope: [],
  difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
};
const chemistryBlueprint = {
  id: 41, subject: 'chemistry', topicId: 642, topicCode: 'C-BASIC-003', topicModule: '溶液',
  topicTitle: '溶液浓度与pH计算', syllabusVersion: '2025', examScope: '一元强酸强碱。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['medium'], excludedScope: [],
  difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {}
};

const mathPlans = [
  buildSubjectPracticeQuestionPlan({
    subject: 'math', topicId: 69, topicTitle: '基本初等函数', productionCellId: 16,
    targetDifficulty: 'basic', taskFamily: 'elementary_function_direct_property',
    requiredElementaryFunctionClass: 'logarithmic', requiredSinglePropertyTarget: 'domain'
  }),
  buildSubjectPracticeQuestionPlan({
    subject: 'math', topicId: 70, topicTitle: 'line relation', productionCellId: 'line-relation-shadow-v1',
    targetDifficulty: 'basic', taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1',
    exactLineRelationScope: 'slope_from_two_distinct_points'
  })
];
for (const plan of mathPlans) {
  assert.equal(validateSubjectPracticeQuestionPlan(plan).valid, true);
  assert.equal(plan.scenarioContract.scenarioMode, 'abstract');
  assert.equal(plan.scenarioContract.contextNecessity, 'not_applicable');
  assert.equal(plan.scenarioContract.surface.cueTokens.length, 0);
}

const evidence = mathPlans.map((plan) => subjectPracticeScenarioEvidenceFor({
  questionPlan: plan,
  candidate: { prompt: '纯数学题干', explanation: '按定义计算。', localizations: {} }
}));
assert.ok(evidence.every((item) => item.status === 'consistent'));

const physicsFamilies = new Set();
let firstPhysicsCase = null;
for (let seed = 0; seed < 6; seed += 1) {
  const relationKind = 'uniform_speed';
  const plan = buildSubjectPracticeQuestionPlan({
    subject: 'physics', topicId: 8, topicTitle: 'Kinematics', productionCellId: 24,
    targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
    exactPhysicsKinematicsScope: relationKind, scenarioSeed: seed
  });
  const generated = generateSubjectPracticePhysicsKinematicsLocally({
    blueprint: physicsBlueprint, questionPlan: plan, seed: seed + 100, relationKind
  });
  assert.equal(generated.status, 'generated_and_self_verified');
  const item = subjectPracticeScenarioEvidenceFor({ questionPlan: plan, candidate: generated.candidate });
  assert.equal(item.status, 'consistent');
  physicsFamilies.add(item.scenarioFamilyId);
  evidence.push(item);
  firstPhysicsCase ??= { plan, candidate: generated.candidate };
}
assert.equal(physicsFamilies.size, 6);

const chemistryFamilies = new Set();
let firstChemistryCase = null;
for (const relationKind of ['strong_acid_dilution', 'strong_acid_base_neutralization']) {
  for (let seed = 0; seed < 3; seed += 1) {
    const plan = buildSubjectPracticeQuestionPlan({
      subject: 'chemistry', topicId: 642, topicTitle: '溶液浓度与pH计算', productionCellId: 41,
      targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
      exactChemistryRelationKind: relationKind, exactChemistryAnswerTarget: 'ph_value', scenarioSeed: seed
    });
    const generated = generateSubjectPracticeChemistryAcidBaseLocally({
      blueprint: chemistryBlueprint, questionPlan: plan, seed: seed + 20, relationKind, answerTarget: 'ph_value'
    });
    assert.equal(generated.status, 'generated_and_self_verified');
    const item = subjectPracticeScenarioEvidenceFor({ questionPlan: plan, candidate: generated.candidate });
    assert.equal(item.status, 'consistent');
    chemistryFamilies.add(item.scenarioFamilyId);
    evidence.push(item);
    firstChemistryCase ??= { plan, candidate: generated.candidate };
  }
}
assert.equal(chemistryFamilies.size, 6);

const physicsWithoutUnits = JSON.parse(JSON.stringify(firstPhysicsCase.candidate).replace(/m\/s\^2|m\/s²|m\/s/g, 'unit'));
const physicsFailure = subjectPracticeScenarioEvidenceFor({
  questionPlan: firstPhysicsCase.plan,
  candidate: physicsWithoutUnits
});
assert.equal(physicsFailure.status, 'inconsistent');
assert.equal(physicsFailure.physicalPlausibilityMatched, false);

const chemistryWithoutReactionIdentity = JSON.parse(JSON.stringify(firstChemistryCase.candidate).replace(/HCl|盐酸|HNO3|硝酸/g, '溶液A'));
const chemistryFailure = subjectPracticeScenarioEvidenceFor({
  questionPlan: firstChemistryCase.plan,
  candidate: chemistryWithoutReactionIdentity
});
assert.equal(chemistryFailure.status, 'inconsistent');
assert.equal(chemistryFailure.chemistryActionEvidenceMatched, false);

const synonymA = subjectPracticeScenarioFingerprintFor({
  scenarioDomain: 'transport', scenarioEntity: 'car', scenarioAction: 'moves 3 m in 2 s', informationForm: 'numeric text'
});
const synonymB = subjectPracticeScenarioFingerprintFor({
  scenarioDomain: 'transport', scenarioEntity: 'cart', scenarioAction: 'moves 9 km in 4 s', informationForm: 'numeric text'
});
assert.equal(synonymA, synonymB);

const metrics = subjectPracticeScenarioDiversityBatchMetrics({ expectedCount: evidence.length, evidence });
assert.equal(metrics.completeEvidenceCoverage, true);
assert.equal(metrics.scenarioFamilyCoverageCount, 12);
assert.equal(metrics.scenarioConsistencyFailureRate, 0);
assert.equal(metrics.decorativeBackgroundRate, 0);
assert.equal(metrics.thresholdsFrozen, false);
assert.equal(metrics.releaseQualification, false);
assert.equal(metrics.productionGateImpact, 'none_shadow_only');

const diagnosticMetrics = subjectPracticeScenarioDiversityBatchMetrics({
  expectedCount: 3,
  evidence: [
    { ...evidence[2], scenarioFingerprint: 'same', surfaceEntity: 'car' },
    { ...evidence[2], scenarioFingerprint: 'same', surfaceEntity: 'cart' },
    { ...evidence[2], status: 'inconsistent', contextNecessity: 'decorative', contextNecessityVerified: false }
  ]
});
assert.equal(diagnosticMetrics.renameOnlyStructureRate, 2 / 3);
assert.equal(diagnosticMetrics.decorativeBackgroundRate, 1 / 3);
assert.equal(diagnosticMetrics.scenarioConsistencyFailureRate, 1 / 3);

const blueprintShadowMetrics = subjectPracticeScenarioDiversityBatchMetrics({
  expectedCount: 48,
  evidence: Array.from({ length: 48 }, (_, index) => ({
    status: 'shadow_candidate_evidence_complete', blockers: [], subject: 'chemistry',
    scenarioMode: 'real_world', scenarioFamilyId: `family-${index % 12}`,
    scenarioFingerprint: `fingerprint-${index % 12}`, surfaceEntity: `entity-${index % 12}`,
    contextNecessity: 'required_for_solution', contextNecessityVerified: true,
    informationParticipationMatched: true, generatorSelfVerified: true, planAdherent: true,
    solverVerified: true, chemistryRelationMatched: true, chemistryPlausibilityMatched: true
  }))
});
assert.equal(blueprintShadowMetrics.scenarioConsistencyFailureRate, 0);
assert.equal(blueprintShadowMetrics.scenarioFingerprintCoverageCount, 12);
assert.equal(blueprintShadowMetrics.scenarioFingerprintDuplicateRate, 0.75);
const calibrationDecision = subjectPracticeDynamicScenarioQualificationDecision({
  batchId: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_CALIBRATION_BATCH_ID,
  metrics: blueprintShadowMetrics
});
assert.equal(calibrationDecision.status, 'not_qualified');
assert.deepEqual(calibrationDecision.reasons, ['dynamic_scenario_holdout_batch_required']);
const holdoutDecision = subjectPracticeDynamicScenarioQualificationDecision({
  batchId: 'local-shadow-independent-holdout',
  metrics: blueprintShadowMetrics
});
assert.equal(holdoutDecision.status, 'qualified');
assert.equal(holdoutDecision.releaseQualification, true);
const lowCoverageDecision = subjectPracticeDynamicScenarioQualificationDecision({
  batchId: 'local-shadow-independent-holdout',
  metrics: { ...blueprintShadowMetrics, scenarioFingerprintCoverageCount: 11 }
});
assert.ok(lowCoverageDecision.reasons.includes('dynamic_scenario_fingerprint_coverage_below_frozen_minimum'));

const tampered = structuredClone(mathPlans[0]);
tampered.scenarioContract.scenarioAction = 'wrong_scope';
assert.equal(validateSubjectPracticeQuestionPlan(tampered).valid, false);

const tamperedPhysicsSurface = structuredClone(firstPhysicsCase.plan);
tamperedPhysicsSurface.scenarioContract.surface.zhEntity = '伪造实体';
tamperedPhysicsSurface.scenarioContract.surface.cueTokens = ['伪造实体', 'forged entity'];
assert.equal(validateSubjectPracticeQuestionPlan(tamperedPhysicsSurface).valid, false);

const tamperedPhysicsPlausibility = structuredClone(firstPhysicsCase.plan);
tamperedPhysicsPlausibility.scenarioContract.plausibility.straightLineMotion = false;
assert.equal(validateSubjectPracticeQuestionPlan(tamperedPhysicsPlausibility).valid, false);

const tamperedRequiredFields = structuredClone(firstChemistryCase.plan);
tamperedRequiredFields.scenarioContract.requiredInformationFields = ['scenarioAction'];
assert.equal(validateSubjectPracticeQuestionPlan(tamperedRequiredFields).valid, false);

const report = {
  mode: 'subject_practice_scenario_diversity_self_test',
  status: 'passed',
  policyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
  physicsScenarioFamilyCount: physicsFamilies.size,
  chemistryScenarioFamilyCount: chemistryFamilies.size,
  mathScenarioMode: 'abstract',
  fingerprintIgnoresNumbersUnitsAndEntitySynonyms: true,
  physicalPlausibilityFailureRejected: true,
  chemistryInformationParticipationFailureRejected: true,
  diagnosticRatesMeasured: true,
  blueprintShadowSuccessStatusNormalized: true,
  frozenHoldoutQualificationPolicyVersion: SUBJECT_PRACTICE_DYNAMIC_SCENARIO_QUALIFICATION_POLICY_VERSION,
  calibrationBatchCannotSelfQualify: true,
  independentHoldoutCanQualify: true,
  controlledSurfaceTamperRejected: true,
  plausibilityTamperRejected: true,
  requiredFieldTamperRejected: true,
  metrics,
  providerCallCount: 0,
  estimatedCostUsd: 0,
  publicationImpact: 'none',
  releaseQualification: false
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

module.exports = { report };
