'use strict';

const assert = require('node:assert/strict');
const engine = require('../src/index.cjs');

const catalog = engine.capabilityCatalog();
assert.equal(engine.apiVersion, 'cscalite-question-engine-api-v4-five-family-offline-preview');
assert.equal(catalog.contractCount, 5);
assert.equal(catalog.providerCallsAllowed, false);
assert.equal(catalog.databaseWritesAllowed, false);
assert.equal(catalog.studentPublicationAllowed, false);
assert.equal(catalog.hostAdapterVersion, 'cscalite-question-engine-host-adapter-v1');
assert.equal(catalog.hostAdapterCapabilities.databaseAccess, false);
assert.equal(catalog.hostAdapterCapabilities.providerAccess, false);
assert.equal(catalog.hostAdapterCapabilities.publicationAccess, false);
assert(!catalog.allowedOperations.some((operation) => /execute|write|publish|provider/.test(operation)));
assert(catalog.forbiddenOperations.includes('publish_student_content'));
const offlinePreview = engine.generateMathDerivativePreview({ seed: 20260916 });
assert.equal(offlinePreview.status, 'generated_and_triple_verified');
assert.equal(offlinePreview.scopeId, 'math-basic-derivative-v1:direct_polynomial_value');
assert.equal(offlinePreview.databaseWrites, 0);
assert.equal(offlinePreview.providerCalls, 0);
assert.equal(offlinePreview.studentPublicationAllowed, false);
assert.equal(offlinePreview.hostAdapterVersion, 'cscalite-question-engine-host-adapter-v1');
const physicsPreview = engine.generatePhysicsKinematicsPreview({ seed: 7, relationKind: 'uniform_speed' });
assert.equal(physicsPreview.status, 'generated_and_self_verified');
assert.equal(physicsPreview.databaseWrites, 0);
const chemistryPreview = engine.generateChemistryAcidBasePreview({
  seed: 7, relationKind: 'strong_acid_dilution', answerTarget: 'ph_value'
});
assert.equal(chemistryPreview.status, 'generated_and_self_verified');
assert.equal(chemistryPreview.providerCalls, 0);
const elementaryPreview = engine.generateMathElementaryPreview({
  seed: 7, functionClass: 'logarithmic', propertyTarget: 'domain'
});
assert.equal(elementaryPreview.status, 'generated_and_self_verified');
const linePreview = engine.generateMathLineRelationPreview({ seed: 7, exactScope: 'slope_from_two_distinct_points' });
assert.equal(linePreview.status, 'generated_and_triple_verified');
assert.equal(linePreview.studentPublicationAllowed, false);
const derivative = catalog.contracts.find((entry) =>
  entry.subject === 'math' && entry.taskFamily === 'derivative_direct_evaluation');
assert(derivative);
assert.equal(derivative.planTemplate, 'math_derivative_condition_chain_v1');
assert.deepEqual(derivative.expectedScopeIds, ['math-basic-derivative-v1:direct_polynomial_value']);
assert.equal(
  derivative.binding.generatorVersion,
  'subject-practice-math-derivative-local-generator-v1-direct-polynomial-value'
);
const root = require('node:path').resolve(__dirname, '..', '..');
const canonicalSolver = require('../core/subject-practice-math-derivative-solver.ts');
const compatibilitySolver = require(
  require('node:path').join(root, 'backend/src/ai-questioning/subject-practice-math-derivative-solver.ts')
);
const canonicalOracle = require('../core/subject-practice-math-derivative-independent-oracle.ts');
const compatibilityOracle = require(
  require('node:path').join(root, 'backend/src/ai-questioning/subject-practice-math-derivative-independent-oracle.ts')
);
assert.strictEqual(
  compatibilitySolver.solveSubjectPracticeMathDerivative,
  canonicalSolver.solveSubjectPracticeMathDerivative
);
assert.strictEqual(
  compatibilityOracle.verifySubjectPracticeMathDerivativeWithIndependentOracle,
  canonicalOracle.verifySubjectPracticeMathDerivativeWithIndependentOracle
);
const canonicalGenerator = require('../core/subject-practice-math-derivative-local-generator.ts');
const compatibilityGenerator = require(
  require('node:path').join(root, 'backend/src/ai-questioning/subject-practice-math-derivative-local-generator.ts')
);
const questionPlanPolicy = require(
  require('node:path').join(root, 'backend/src/ai-questioning/subject-practice-question-plan-policy.ts')
);
assert.equal(
  compatibilityGenerator.SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
  canonicalGenerator.SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
);
const boundFromCore = canonicalGenerator.createSubjectPracticeMathDerivativeLocalGenerator({
  validate: questionPlanPolicy.validateSubjectPracticeQuestionPlan,
  adherenceFor: questionPlanPolicy.subjectPracticeQuestionPlanAdherenceFor
});
const derivativePlan = questionPlanPolicy.buildSubjectPracticeQuestionPlan({
  subject: 'math', topicId: 71, topicTitle: '导数与微积分初步', productionCellId: 10,
  targetDifficulty: 'basic', taskFamily: 'derivative_direct_evaluation',
  planTemplate: 'math_derivative_condition_chain_v1', exactDerivativeScope: 'direct_polynomial_value'
});
const derivativeBlueprint = {
  id: 10, subject: 'math', topicId: 71, topicTitle: '导数与微积分初步', syllabusVersion: '2025',
  difficulty: 'basic', questionType: 'single_choice', skill: 'multi_step_reasoning', constraints: {}
};
assert.deepEqual(
  compatibilityGenerator.generateSubjectPracticeMathDerivativeLocally({
    blueprint: derivativeBlueprint, questionPlan: derivativePlan, seed: 20260916
  }),
  boundFromCore({ blueprint: derivativeBlueprint, questionPlan: derivativePlan, seed: 20260916 })
);
let rejectedPortAdherenceCalled = false;
const failClosedGenerator = canonicalGenerator.createSubjectPracticeMathDerivativeLocalGenerator({
  validate: () => ({ valid: false }),
  adherenceFor: () => {
    rejectedPortAdherenceCalled = true;
    return { adheres: true, failureCodes: [] };
  }
});
assert.equal(failClosedGenerator({
  blueprint: derivativeBlueprint, questionPlan: derivativePlan, seed: 1
}).status, 'unsupported_question_plan');
assert.equal(rejectedPortAdherenceCalled, false);
const portable = require('../adapters/portable-host.cjs').createPortableHostAdapter();
assert.equal(portable.capabilities.offlineExactPlanPreview, true);
assert.equal(portable.capabilities.productionQualification, false);
assert.equal(portable.capabilities.databaseAccess, false);
const portableDerivativePlan = portable.buildQuestionPlan({
  subject: 'math', topicId: 71, topicTitle: '导数与微积分初步', productionCellId: 10,
  targetDifficulty: 'basic', taskFamily: 'derivative_direct_evaluation',
  exactDerivativeScope: 'direct_polynomial_value'
});
assert.equal(portable.ports.validate(portableDerivativePlan).valid, true);
assert.equal(portable.ports.validate({ ...portableDerivativePlan, taskFamily: 'unknown' }).valid, false);
const portableDerivativeGenerator = canonicalGenerator.createSubjectPracticeMathDerivativeLocalGenerator(portable.ports);
assert.equal(portableDerivativeGenerator({
  blueprint: derivativeBlueprint, questionPlan: portableDerivativePlan, seed: 20260916
}).status, 'generated_and_triple_verified');
for (const family of [
  ['physics-kinematics', 'solveSubjectPracticePhysicsKinematics', 'verifySubjectPracticePhysicsKinematicsWithIndependentOracle'],
  ['chemistry-acid-base', 'solveSubjectPracticeChemistryAcidBase', 'verifySubjectPracticeChemistryAcidBaseWithIndependentOracle']
]) {
  const [name, solverExport, oracleExport] = family;
  const coreSolver = require(`../core/subject-practice-${name}-solver.ts`);
  const backendSolver = require(require('node:path').join(root, `backend/src/ai-questioning/subject-practice-${name}-solver.ts`));
  const coreOracle = require(`../core/subject-practice-${name}-independent-oracle.ts`);
  const backendOracle = require(require('node:path').join(root, `backend/src/ai-questioning/subject-practice-${name}-independent-oracle.ts`));
  assert.strictEqual(backendSolver[solverExport], coreSolver[solverExport]);
  assert.strictEqual(backendOracle[oracleExport], coreOracle[oracleExport]);
}
process.stdout.write('Question engine read-only contract tests passed.\n');
