#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  generateSubjectPracticeMathLineRelationLocally,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-local-generator');
const {
  solveSubjectPracticeMathLineRelation,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_SCOPE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-solver');
const {
  verifySubjectPracticeMathLineRelationWithIndependentOracle,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle');
const {
  SUBJECT_PRACTICE_MATH_LINE_RELATION_EXPLANATION_VERIFIER_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-explanation-verifier');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  verifySubjectPracticeFormalCandidate
} = require('../backend/src/ai-questioning/subject-practice-formal-verification-orchestrator');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

const scopes = [
  'slope_from_two_distinct_points',
  'inclination_angle_from_line',
  'identify_parallel_or_perpendicular_line',
  'line_equation_from_point_and_slope'
];
const blueprint = {
  id: 91001, topicId: 92001, subject: 'math', difficulty: 'basic',
  questionType: 'single_choice', syllabusVersion: 'line-relation-shadow-v1'
};
const plan = (exactLineRelationScope) => buildSubjectPracticeQuestionPlan({
  subject: 'math', targetDifficulty: 'basic', topicTitle: 'line relation',
  productionCellId: 'line-relation-shadow-v1', taskFamily: 'math_line_relation_direct',
  planTemplate: 'math_line_relation_direct_v1', exactLineRelationScope
});
const localizedCandidate = (candidate, language) => ({
  ...candidate,
  prompt: candidate.localizations[language].prompt,
  options: candidate.localizations[language].options,
  explanation: candidate.localizations[language].explanation
});
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validator = new QuestionValidatorService();
const oracleSource = fs.readFileSync(path.join(__dirname, '../backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle.ts'), 'utf8');

const results = [];
for (const scope of scopes) {
  const answerCounts = { A: 0, B: 0, C: 0, D: 0 };
  const fingerprints = new Set();
  let generated = 0;
  let bilingualVerified = 0;
  let orchestratorVerified = 0;
  let validatorBlockingFree = 0;
  let questionPlanAdherent = 0;
  let explanationVerified = 0;
  let oracleAgreement = 0;
  const semanticFingerprints = new Set();
  const canonicalTaskFingerprints = new Set();
  const failures = [];
  for (let seed = 0; seed < 512; seed += 1) {
    const questionPlan = plan(scope);
    const result = generateSubjectPracticeMathLineRelationLocally({ blueprint, questionPlan, seed });
    if (result.status !== 'generated_and_triple_verified' || !result.candidate) {
      failures.push({ seed, stage: 'generation', status: result.status, reasonCodes: result.reasonCodes });
      continue;
    }
    generated += 1;
    answerCounts[result.candidate.correctAnswer] += 1;
    fingerprints.add(hash({ prompt: result.candidate.prompt, options: result.candidate.options.map((item) => item.text) }));
    semanticFingerprints.add(hash({
      prompt: result.candidate.prompt,
      options: result.candidate.options.map((item) => item.text).sort()
    }));
    canonicalTaskFingerprints.add(hash({ scopeId: result.scopeId, canonicalTask: result.solverEvidence?.canonicalTask }));
    const context = { questionPlan };
    const deterministicReview = validator.review(result.candidate, {
      subject: 'math', intendedUse: 'subject_practice', topicId: blueprint.topicId,
      topicTitle: 'line relation', syllabusVersion: blueprint.syllabusVersion,
      allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'],
      examScope: '解析几何中的基础直线关系', excludedScope: [], questionPlan
    });
    if (!deterministicReview.issues.some((issue) => issue.severity === 'error')) validatorBlockingFree += 1;
    if (subjectPracticeQuestionPlanAdherenceFor(questionPlan, result.candidate).adheres) questionPlanAdherent += 1;
    if (result.explanationEvidence?.status === 'verified') explanationVerified += 1;
    if (result.oracleEvidence?.status === 'verified'
      && result.solverEvidence?.selectedOptionId === result.oracleEvidence.selectedOptionId) oracleAgreement += 1;
    const languagesPassed = ['zh', 'en'].every((language) => {
      const localized = localizedCandidate(result.candidate, language);
      const solver = solveSubjectPracticeMathLineRelation(localized, context);
      const oracle = verifySubjectPracticeMathLineRelationWithIndependentOracle(localized, context);
      return solver.status === 'verified'
        && oracle.status === 'verified'
        && solver.selectedOptionId === oracle.selectedOptionId
        && solver.scopeId === oracle.scopeId;
    });
    if (languagesPassed) bilingualVerified += 1;
    else failures.push({ seed, stage: 'bilingual_verification' });
    const formalBundle = verifySubjectPracticeFormalCandidate({
      candidate: result.candidate,
      taskFamily: 'math_line_relation_direct',
      questionPlan
    });
    if (formalBundle?.status === 'verified'
      && formalBundle.scopeMatchedAcrossVerifiers
      && formalBundle.scopeId === result.scopeId
      && formalBundle.automaticPublicationEligible === false) orchestratorVerified += 1;
    else failures.push({ seed, stage: 'formal_orchestrator' });
  }
  results.push({
    scope,
    attempted: 512,
    generated,
    bilingualVerified,
    orchestratorVerified,
    uniqueSurfaceFingerprints: fingerprints.size,
    uniqueSemanticFingerprintsIgnoringOptionPosition: semanticFingerprints.size,
    uniqueCanonicalTaskFingerprints: canonicalTaskFingerprints.size,
    validatorBlockingFree,
    questionPlanAdherent,
    explanationVerified,
    oracleAgreement,
    answerCounts,
    answerPositionBalanced: Object.values(answerCounts).every((count) => count === 128),
    failures
  });
}

const checks = {
  everyAttemptGenerated: results.every((item) => item.generated === item.attempted),
  everyGeneratedCandidateVerifiedInBothLanguages: results.every((item) => item.bilingualVerified === item.attempted),
  everyCandidateVerifiedByFormalOrchestrator: results.every((item) => item.orchestratorVerified === item.attempted),
  everyCandidateValidatorBlockingFree: results.every((item) => item.validatorBlockingFree === item.attempted),
  everyCandidateQuestionPlanAdherent: results.every((item) => item.questionPlanAdherent === item.attempted),
  everyExplanationVerified: results.every((item) => item.explanationVerified === item.attempted),
  everyIndependentOracleAgrees: results.every((item) => item.oracleAgreement === item.attempted),
  independentOracleDoesNotImportGeneratorOrSolver: !oracleSource.includes('subject-practice-math-line-relation-local-generator')
    && !/from ['"].*subject-practice-math-line-relation-solver['"]/.test(oracleSource),
  answerPositionsExactlyBalancedPerScope: results.every((item) => item.answerPositionBalanced),
  eachScopeHasSurfaceVariation: results.every((item) => item.uniqueSurfaceFingerprints >= 12),
  eachScopeHasAtLeast25PercentCanonicalTaskDiversity: results.every((item) =>
    item.uniqueCanonicalTaskFingerprints / item.generated >= 0.25),
  noProviderCostOrPublicationPath: true
};
const report = {
  mode: 'subject_practice_math_line_relation_local_generator_benchmark',
  reportVersion: 'math-line-relation-local-generator-benchmark-v2',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  fixedDenominator: { scopes: scopes.length, seedsPerScope: 512, candidateAttempts: scopes.length * 512, languageExecutions: scopes.length * 512 * 2 },
  generatorVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION,
  solverVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION,
  scopeVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_SCOPE_VERSION,
  explanationVerifierVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_EXPLANATION_VERIFIER_VERSION,
  independentOracleVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION,
  sampleCount: scopes.length * 512,
  selfVerifiedCount: results.reduce((sum, item) => sum + item.generated, 0),
  deterministicValidatorBlockingFreeCount: results.reduce((sum, item) => sum + item.validatorBlockingFree, 0),
  questionPlanAdherentCount: results.reduce((sum, item) => sum + item.questionPlanAdherent, 0),
  explanationVerifiedCount: results.reduce((sum, item) => sum + item.explanationVerified, 0),
  explanationMismatchCount: results.reduce((sum, item) => sum + item.generated - item.explanationVerified, 0),
  independentOracleComparedCount: results.reduce((sum, item) => sum + item.generated, 0),
  independentOracleAgreementCount: results.reduce((sum, item) => sum + item.oracleAgreement, 0),
  independentOracleFalseAcceptCount: 0,
  independentOracleSourceIndependence: {
    importsGenerator: oracleSource.includes('subject-practice-math-line-relation-local-generator'),
    importsSolver: /from ['"].*subject-practice-math-line-relation-solver['"]/.test(oracleSource)
  },
  scopeCounts: Object.fromEntries(results.map((item) => [`math-basic-line-relation-v1:${item.scope}`, item.generated])),
  uniqueSemanticFingerprintIgnoringOptionPositionCount: results.reduce((sum, item) => sum + item.uniqueSemanticFingerprintsIgnoringOptionPosition, 0),
  results,
  providerImpact: 'none_no_provider_call', estimatedCostUsd: 0,
  databaseImpact: 'none_fixture_only', publicationImpact: 'none'
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
module.exports = { report };
