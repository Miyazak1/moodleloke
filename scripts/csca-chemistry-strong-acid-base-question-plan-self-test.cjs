#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  buildSubjectPracticeQuestionPlan,
  validateSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const { solveSubjectPracticeChemistryAcidBase } = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-solver');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const taskFamily = 'ph_dilution_strong_acid_base_neutralization';
const plan = buildSubjectPracticeQuestionPlan({
  subject: 'chemistry',
  topicTitle: '溶液浓度与pH计算',
  productionCellId: '41',
  targetDifficulty: 'medium',
  taskFamily
});
assert(plan, 'Expected the exact strong-acid/base QuestionPlan.');
assert(plan.planTemplate === 'chemistry_strong_acid_base_single_relation_v1', 'Unexpected chemistry plan template.');
const validation = validateSubjectPracticeQuestionPlan(plan);
assert(validation.valid, `QuestionPlan validation failed: ${validation.failureCodes.join(',')}`);

const candidate = {
  subject: 'chemistry',
  topicId: 642,
  blueprintId: 41,
  sourceType: 'ai',
  designedDifficulty: 'medium',
  questionType: 'single_choice',
  prompt: '0.1 mol/L 盐酸 10 mL 稀释到 100 mL，pH 约为',
  options: [
    { id: 'A', text: '1' },
    { id: 'B', text: '2' },
    { id: 'C', text: '3' },
    { id: 'D', text: '4' }
  ],
  correctAnswer: 'B',
  explanation: '稀释后浓度为 0.01 mol/L，因此 pH=2。',
  knowledgeTags: ['pH', '强酸稀释'],
  optionMetadata: [],
  syllabusVersion: '2025'
};
const adherence = subjectPracticeQuestionPlanAdherenceFor(plan, candidate);
assert(adherence.adheres, `Candidate adherence failed: ${adherence.failureCodes.join(',')}`);
const verified = solveSubjectPracticeChemistryAcidBase(candidate, { taskFamily, questionPlan: plan });
assert(verified.status === 'verified' && verified.verificationScope.matched, 'Exact-plan candidate must verify in scope.');

const multiRelationPlan = { ...plan, renderConstraints: { ...plan.renderConstraints, maxIndependentRelations: 2 } };
const multiRelationEvidence = solveSubjectPracticeChemistryAcidBase(candidate, { taskFamily, questionPlan: multiRelationPlan });
assert(!multiRelationEvidence.verificationScope.matched, 'A multi-relation plan must fail closed.');
const wrongDifficultyPlan = { ...plan, targetDifficulty: 'hard' };
const wrongDifficultyEvidence = solveSubjectPracticeChemistryAcidBase(candidate, { taskFamily, questionPlan: wrongDifficultyPlan });
assert(!wrongDifficultyEvidence.verificationScope.matched, 'A wrong-difficulty plan must fail closed.');

const report = {
  mode: 'chemistry_strong_acid_base_question_plan_self_test',
  status: 'passed',
  sampleCount: 4,
  planTemplate: plan.planTemplate,
  taskFamily,
  exactScopeId: verified.verificationScope.scopeId,
  rejectionCases: ['multi_relation_plan', 'wrong_difficulty_plan'],
  productionImpact: 'none_fixture_only',
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection'
};

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else console.log(`Chemistry strong-acid/base QuestionPlan self-test: ${report.status}`);
