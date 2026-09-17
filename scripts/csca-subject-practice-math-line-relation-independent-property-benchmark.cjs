#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  GENERATOR_VERSION,
  SCOPES,
  buildIndependentLineRelationCase,
  seedManifest
} = require('./lib/math-line-relation-independent-case-generator.cjs');
const {
  solveSubjectPracticeMathLineRelation,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-solver');
const {
  verifySubjectPracticeMathLineRelationWithIndependentOracle,
  SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle');
const {
  buildSubjectPracticeQuestionPlan
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');

const COUNT_PER_SCOPE = 256;
const root = path.resolve(__dirname, '..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha256 = (relative) => sha256(fs.readFileSync(path.join(root, relative)));

function plan(exactLineRelationScope) {
  return buildSubjectPracticeQuestionPlan({
    subject: 'math',
    targetDifficulty: 'basic',
    topicTitle: 'line relation independent property',
    productionCellId: 'line-relation-shadow-v1',
    taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1',
    exactLineRelationScope
  });
}

function evidence(candidate, questionPlan) {
  const context = { questionPlan };
  const solver = solveSubjectPracticeMathLineRelation(candidate, context);
  const oracle = verifySubjectPracticeMathLineRelationWithIndependentOracle(candidate, context);
  return {
    solver,
    oracle,
    jointlyVerified: solver.status === 'verified'
      && oracle.status === 'verified'
      && solver.selectedOptionId === oracle.selectedOptionId
      && solver.scopeId === oracle.scopeId
  };
}

function wrongDeclaredAnswer(candidate) {
  const answerIndex = candidate.options.findIndex((option) => option.id === candidate.correctAnswer);
  return { ...candidate, correctAnswer: candidate.options[(answerIndex + 1) % candidate.options.length].id };
}

function unknownDistractor(candidate, language) {
  const index = candidate.options.findIndex((option) => option.id !== candidate.correctAnswer);
  const options = candidate.options.map((option, optionIndex) => optionIndex === index
    ? { ...option, text: language === 'zh' ? '无法确定' : 'cannot be determined' }
    : option);
  return { ...candidate, options };
}

function boundaryCandidate(scope) {
  const common = {
    subject: 'math', topicId: 92001, blueprintId: 91003, sourceType: 'ai',
    designedDifficulty: 'basic', questionType: 'single_choice', correctAnswer: 'A',
    explanation: 'out-of-domain exact-integer boundary probe', knowledgeTags: [scope, 'numeric_boundary'],
    optionMetadata: ['A', 'B', 'C', 'D'].map((optionId) => ({ optionId })),
    syllabusVersion: 'line-relation-independent-boundary-v1'
  };
  if (scope === 'slope_from_two_distinct_points') return {
    ...common,
    prompt: 'Given A(0,0) and B(9007199254740992,1), find the slope of their line.',
    options: ['1/9007199254740992', '9007199254740992', '-1/9007199254740992', '0'].map((text, index) => ({ id: String.fromCharCode(65 + index), text }))
  };
  if (scope === 'inclination_angle_from_line') return {
    ...common,
    prompt: 'Determine the inclination angle of line m: 9007199254740992x-9007199254740992y=1.',
    options: ['45°', '0°', '90°', '135°'].map((text, index) => ({ id: String.fromCharCode(65 + index), text }))
  };
  if (scope === 'identify_parallel_or_perpendicular_line') return {
    ...common,
    prompt: 'Which line is parallel to line l: 9007199254740992x+y=1?',
    options: ['9007199254740992x+y=2', '9007199254740992x+y=1', 'x-9007199254740992y=0', 'x+y=0'].map((text, index) => ({ id: String.fromCharCode(65 + index), text }))
  };
  return {
    ...common,
    prompt: 'Which equation is the line through P(0,0) with slope 1/9007199254740992?',
    options: ['x-9007199254740992y=0', 'x+9007199254740992y=0', '9007199254740992x-y=0', 'x-y=0'].map((text, index) => ({ id: String.fromCharCode(65 + index), text }))
  };
}

const generatorSource = fs.readFileSync(path.join(root, 'scripts/lib/math-line-relation-independent-case-generator.cjs'), 'utf8');
const forbiddenDependencies = [
  'subject-practice-math-line-relation-local-generator',
  'subject-practice-math-line-relation-solver',
  'subject-practice-math-line-relation-independent-oracle',
  'subject-practice-formal-verification-orchestrator'
];
const dependencyIsolation = {
  forbiddenDependencies,
  detectedForbiddenDependencies: forbiddenDependencies.filter((dependency) => generatorSource.includes(dependency)),
  onlyNodeCryptoImported: Array.from(generatorSource.matchAll(/require\((['"])(.*?)\1\)/g)).map((match) => match[2]).every((dependency) => dependency === 'node:crypto')
};

const scopeResults = [];
const failures = [];
for (const scope of SCOPES) {
  const questionPlan = plan(scope);
  const counters = {
    mathematicalSamples: COUNT_PER_SCOPE,
    bilingualExecutions: COUNT_PER_SCOPE * 2,
    bilingualAgreementPassed: 0,
    roundTripSamplesPassed: 0,
    wrongAnswerFalseAccepts: 0,
    unknownOptionFalseAccepts: 0,
    unknownOptionAbstentions: 0,
    uniqueWitnesses: new Set(),
    uniqueSurfaces: new Set(),
    answerCounts: { A: 0, B: 0, C: 0, D: 0 },
    featureCounts: {}
  };
  for (let index = 0; index < COUNT_PER_SCOPE; index += 1) {
    const testCase = buildIndependentLineRelationCase(scope, index);
    counters.answerCounts[testCase.zh.correctAnswer] += 1;
    counters.uniqueWitnesses.add(sha256(JSON.stringify(testCase.witness)));
    counters.uniqueSurfaces.add(sha256(JSON.stringify({ prompt: testCase.zh.prompt, options: testCase.zh.options })));
    for (const feature of testCase.features) counters.featureCounts[feature] = (counters.featureCounts[feature] ?? 0) + 1;

    const baseZh = evidence(testCase.zh, questionPlan);
    const baseEn = evidence(testCase.en, questionPlan);
    if (baseZh.jointlyVerified && baseEn.jointlyVerified) counters.bilingualAgreementPassed += 1;
    else failures.push({ scope, index, stage: 'bilingual_agreement', zh: [baseZh.solver.status, baseZh.oracle.status], en: [baseEn.solver.status, baseEn.oracle.status] });

    const roundZh = evidence(testCase.roundTripZh, questionPlan);
    const roundEn = evidence(testCase.roundTripEn, questionPlan);
    if (roundZh.jointlyVerified && roundEn.jointlyVerified) counters.roundTripSamplesPassed += 1;
    else failures.push({ scope, index, stage: 'canonical_round_trip', zh: [roundZh.solver.status, roundZh.oracle.status], en: [roundEn.solver.status, roundEn.oracle.status] });

    const wrongZh = evidence(wrongDeclaredAnswer(testCase.zh), questionPlan);
    const wrongEn = evidence(wrongDeclaredAnswer(testCase.en), questionPlan);
    if (wrongZh.jointlyVerified || wrongEn.jointlyVerified) {
      counters.wrongAnswerFalseAccepts += 1;
      failures.push({ scope, index, stage: 'wrong_declared_answer_false_accept' });
    }

    const unknownZh = evidence(unknownDistractor(testCase.zh, 'zh'), questionPlan);
    const unknownEn = evidence(unknownDistractor(testCase.en, 'en'), questionPlan);
    if (unknownZh.jointlyVerified || unknownEn.jointlyVerified) {
      counters.unknownOptionFalseAccepts += 1;
      failures.push({ scope, index, stage: 'unknown_option_false_accept' });
    }
    if (unknownZh.solver.status === 'unparsed' && unknownZh.oracle.status === 'unparsed'
      && unknownEn.solver.status === 'unparsed' && unknownEn.oracle.status === 'unparsed') counters.unknownOptionAbstentions += 1;
    else failures.push({ scope, index, stage: 'unknown_option_did_not_abstain' });
  }
  const boundary = evidence(boundaryCandidate(scope), questionPlan);
  scopeResults.push({
    scope,
    mathematicalSamples: counters.mathematicalSamples,
    bilingualExecutions: counters.bilingualExecutions,
    bilingualAgreementPassed: counters.bilingualAgreementPassed,
    roundTripSamplesPassed: counters.roundTripSamplesPassed,
    wrongAnswerProbeCount: COUNT_PER_SCOPE,
    wrongAnswerFalseAccepts: counters.wrongAnswerFalseAccepts,
    unknownOptionProbeCount: COUNT_PER_SCOPE,
    unknownOptionFalseAccepts: counters.unknownOptionFalseAccepts,
    unknownOptionAbstentions: counters.unknownOptionAbstentions,
    numericBoundaryProbe: {
      expected: 'joint_verification_forbidden_and_primary_solver_abstains',
      solverStatus: boundary.solver.status,
      oracleStatus: boundary.oracle.status,
      jointlyVerified: boundary.jointlyVerified,
      passed: !boundary.jointlyVerified && boundary.solver.status === 'unparsed'
    },
    uniqueWitnesses: counters.uniqueWitnesses.size,
    uniqueSurfaces: counters.uniqueSurfaces.size,
    answerCounts: counters.answerCounts,
    featureCounts: counters.featureCounts
  });
}

const manifest = seedManifest(COUNT_PER_SCOPE);
const checks = {
  caseGeneratorDependencyIsolated: dependencyIsolation.detectedForbiddenDependencies.length === 0 && dependencyIsolation.onlyNodeCryptoImported,
  fixedSeedManifestBound: manifest.entryCount === SCOPES.length * COUNT_PER_SCOPE,
  atLeast256IndependentMathematicalSamplesPerScope: scopeResults.every((item) => item.mathematicalSamples >= 256),
  allBilingualSurfacesVerifiedWithoutDoubleCounting: scopeResults.every((item) => item.bilingualAgreementPassed === item.mathematicalSamples),
  allCanonicalRoundTripsVerified: scopeResults.every((item) => item.roundTripSamplesPassed === item.mathematicalSamples),
  zeroWrongAnswerFalseAccepts: scopeResults.every((item) => item.wrongAnswerFalseAccepts === 0),
  zeroUnknownOptionFalseAccepts: scopeResults.every((item) => item.unknownOptionFalseAccepts === 0),
  everyUnknownOptionProbeAbstained: scopeResults.every((item) => item.unknownOptionAbstentions === item.unknownOptionProbeCount),
  everyNumericBoundaryProbeBlocked: scopeResults.every((item) => item.numericBoundaryProbe.passed),
  answerPositionsExactlyBalanced: scopeResults.every((item) => Object.values(item.answerCounts).every((count) => count === COUNT_PER_SCOPE / 4)),
  noProviderDatabaseOrPublicationImpact: true
};
const report = {
  mode: 'subject_practice_math_line_relation_independent_property_benchmark',
  reportVersion: 'math-line-relation-independent-property-benchmark-v1',
  status: Object.values(checks).every(Boolean) && failures.length === 0 ? 'passed' : 'failed',
  generatorVersion: GENERATOR_VERSION,
  solverVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_SOLVER_VERSION,
  oracleVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_INDEPENDENT_ORACLE_VERSION,
  seedManifest: manifest,
  dependencyIsolation,
  fixedDenominator: {
    scopes: SCOPES.length,
    mathematicalSamplesPerScope: COUNT_PER_SCOPE,
    mathematicalSamples: SCOPES.length * COUNT_PER_SCOPE,
    bilingualExecutions: SCOPES.length * COUNT_PER_SCOPE * 2,
    roundTripMathematicalSamples: SCOPES.length * COUNT_PER_SCOPE,
    wrongAnswerProbes: SCOPES.length * COUNT_PER_SCOPE,
    unknownOptionProbes: SCOPES.length * COUNT_PER_SCOPE,
    numericBoundaryProbes: SCOPES.length
  },
  checks,
  scopeResults,
  sourceBindings: {
    questionPlanPolicySha256: fileSha256('backend/src/ai-questioning/subject-practice-question-plan-policy.ts'),
    independentCaseGeneratorSha256: fileSha256('scripts/lib/math-line-relation-independent-case-generator.cjs'),
    productionGeneratorSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-local-generator.ts'),
    solverSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-solver.ts'),
    oracleSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-independent-oracle.ts'),
    explanationVerifierSha256: fileSha256('backend/src/ai-questioning/subject-practice-math-line-relation-explanation-verifier.ts'),
    formalOrchestratorSha256: fileSha256('backend/src/ai-questioning/subject-practice-formal-verification-orchestrator.ts'),
    scopeRegistrySha256: fileSha256('backend/src/ai-questioning/subject-practice-production-shadow-scope-registry.ts'),
    domainMutationPolicySha256: fileSha256('scripts/csca-subject-practice-math-line-relation-mutation-benchmark.cjs')
  },
  failures: failures.slice(0, 100),
  failureCount: failures.length,
  evidenceClassification: 'offline_randomized_property_nonqualifying_for_production_shadow',
  providerImpact: 'none_no_provider_call',
  estimatedCostUsd: 0,
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};

if (require.main === module) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'passed') process.exitCode = 1;
module.exports = { report };
