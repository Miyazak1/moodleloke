#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
  SUBJECT_PRACTICE_MATH_ELEMENTARY_VERIFICATION_SCOPE_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-solver');
const {
  SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  SUBJECT_PRACTICE_MATH_ELEMENTARY_REQUIRED_MUTATION_TYPES,
  subjectPracticeVerificationReleaseDecision
} = require('../backend/src/ai-questioning/subject-practice-verification-release-benchmark-policy');
const { report: programmatic } = require('./csca-subject-practice-math-elementary-solver-benchmark.cjs');
const { report: sourceAudit } = require('./csca-subject-practice-math-elementary-official-holdout-audit.cjs');

const expectedBinding = {
  subject: 'math',
  taskFamily: 'elementary_function_direct_property',
  solverVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_SOLVER_VERSION,
  verificationScopeVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_VERIFICATION_SCOPE_VERSION,
  questionPlanPolicyVersion: SUBJECT_PRACTICE_QUESTION_PLAN_POLICY_VERSION,
  benchmarkVersion: programmatic.benchmarkVersion
};
const expectedScopeIds = [
  'math-basic-elementary-rotation-v1:logarithmic:domain',
  'math-basic-elementary-rotation-v1:exponential:range',
  'math-basic-elementary-rotation-v1:radical:monotonicity',
  'math-basic-elementary-rotation-v1:power:function_value'
];

const evidence = {
  binding: { ...expectedBinding },
  isolation: {
    sealedBeforeSolverVersion: false,
    answersHiddenDuringDevelopment: false,
    developmentFixturesExcluded: false,
    immutableContentHashesPresent: sourceAudit.fileEvidence.every((item) => Boolean(item.contentSha256))
  },
  programmatic: {
    goldTotal: programmatic.goldCaseCount,
    goldPassed: programmatic.goldVerifiedCount,
    scopedGoldTotal: programmatic.scopedRotationGoldCaseCount,
    scopedGoldPassed: programmatic.scopedRotationGoldMatchedCount
  },
  mutation: {
    total: programmatic.mutationCaseCount,
    detected: programmatic.mutationDetectedCount,
    falseAccepts: programmatic.mutationFalseAcceptCount,
    scopedFalseAccepts: programmatic.scopedRotationMutationFalseAcceptCount,
    mutationTypes: Object.keys(programmatic.mutationTypeCounts)
  },
  officialHoldout: {
    total: 0,
    verified: 0,
    abstained: 0,
    falseAccepts: 0,
    perScopeCounts: {}
  }
};

const decision = subjectPracticeVerificationReleaseDecision({
  expectedBinding,
  expectedScopeIds,
  requiredMutationTypes: [...SUBJECT_PRACTICE_MATH_ELEMENTARY_REQUIRED_MUTATION_TYPES],
  evidence
});
const report = {
  mode: 'subject_practice_verification_release_benchmark',
  status: decision.status,
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_read_only_and_fixture_only',
  publicationGateImpact: 'none_benchmark_not_connected_to_production_gate',
  expectedBinding,
  expectedScopeIds,
  evidence,
  decision,
  sourceAuditSummary: {
    sourceFileCount: sourceAudit.sourceFileCount,
    trustedQuestionCount: sourceAudit.fileEvidence.reduce((sum, item) => sum + item.trustedQuestionCount, 0),
    discoveredCandidateCount: sourceAudit.discoveredCandidateCount,
    releaseQualification: sourceAudit.releaseQualification
  }
};

if (require.main === module) {
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--require-qualified') && !decision.qualified) process.exitCode = 1;
}

module.exports = { report };
