#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeFamilyAutomationQualificationDecision
} = require('../backend/src/ai-questioning/subject-practice-family-automation-qualification-policy');

function fixture(overrides = {}) {
  const expectedScopeIds = ['scope-a', 'scope-b'];
  return {
    subject: 'math', taskFamily: 'fixture_family', planTemplate: 'fixture_plan', expectedScopeIds,
    contract: { registered: true, exactBindingMatched: true, localDeterministicRoute: true, providerAttemptLimit: 0 },
    runtimeIsolation: {
      generatorCannotReadOfficialQuestionContent: true, reversibleSourceFieldsOmitted: true,
      sourceLinkageIdentifiersOmitted: true, questionPlanRequired: true, unsupportedInputAbstains: true
    },
    deterministicVerification: {
      solverVerified: true, independentOracleVerified: true, explanationVerified: true,
      uniqueAnswerVerified: true, generatorAnswerAgreementVerified: true
    },
    offlineEvidence: {
      perScopeCounts: { 'scope-a': 128, 'scope-b': 128 }, failedCount: 0,
      mutationPerTypeCounts: { wrong_answer: 32, ambiguous_option: 32 }, mutationFalseAccepts: 0
    },
    automatedLeakageGate: { available: false, failClosed: false, currentKnownCorpusCompared: false, matchedCount: 0 },
    realProductionShadow: {
      publicationSuppressed: true, perScopeCounts: { 'scope-a': 0, 'scope-b': 0 },
      requestedCount: 0, candidateCount: 0, publishableCount: 0,
      falseAccepts: 0, scopeLeakageCount: 0, unexpectedFailureCount: 0
    },
    limitedReleaseControls: {
      exactFamilyAllowlist: false, smallTrafficCap: false, automaticRollback: false, qualityCircuitBreaker: false
    },
    advisoryEvidence: {
      humanBlindAuditComplete: false, corpusTopologyAttested: false,
      corpusConflictResolutionComplete: false, translationCoverageComplete: false
    },
    ...overrides
  };
}

function runSelfTest() {
  const shadow = subjectPracticeFamilyAutomationQualificationDecision(fixture());
  const release = subjectPracticeFamilyAutomationQualificationDecision(fixture({
    automatedLeakageGate: { available: true, failClosed: true, currentKnownCorpusCompared: true, matchedCount: 0 },
    realProductionShadow: {
      publicationSuppressed: true, perScopeCounts: { 'scope-a': 8, 'scope-b': 8 },
      requestedCount: 16, candidateCount: 16, publishableCount: 16,
      falseAccepts: 0, scopeLeakageCount: 0, unexpectedFailureCount: 0
    },
    limitedReleaseControls: {
      exactFamilyAllowlist: true, smallTrafficCap: true, automaticRollback: true, qualityCircuitBreaker: true
    }
  }));
  const leaked = subjectPracticeFamilyAutomationQualificationDecision(fixture({
    automatedLeakageGate: { available: true, failClosed: true, currentKnownCorpusCompared: true, matchedCount: 1 },
    realProductionShadow: {
      publicationSuppressed: true, perScopeCounts: { 'scope-a': 8, 'scope-b': 8 },
      requestedCount: 16, candidateCount: 16, publishableCount: 16,
      falseAccepts: 0, scopeLeakageCount: 0, unexpectedFailureCount: 0
    },
    limitedReleaseControls: {
      exactFamilyAllowlist: true, smallTrafficCap: true, automaticRollback: true, qualityCircuitBreaker: true
    }
  }));
  const sourceExposed = subjectPracticeFamilyAutomationQualificationDecision(fixture({
    runtimeIsolation: { ...fixture().runtimeIsolation, generatorCannotReadOfficialQuestionContent: false }
  }));
  const checks = {
    verifiedFamilyCanEnterAutomaticShadowWithoutHumanReview: shadow.status === 'automatic_shadow_eligible'
      && shadow.automaticShadowEligible === true && shadow.limitedReleaseEligible === false,
    humanTopologyTranslationAndAttestationAreNonBlockingEnhancements:
      shadow.nonBlockingEnhancements.requiredForAutomaticShadow === false
      && shadow.nonBlockingEnhancements.requiredForLimitedRelease === false,
    realShadowAndOperationalControlsCanUnlockLimitedRelease:
      release.status === 'limited_release_eligible' && release.limitedReleaseEligible === true,
    candidateLeakMatchStillBlocksLimitedRelease:
      leaked.automaticShadowEligible === true && leaked.limitedReleaseEligible === false
      && leaked.limitedReleaseBlockers.includes('automated_candidate_leakage_gate_missing_or_failed'),
    formalGenerationSourceExposureBlocksEvenShadow:
      sourceExposed.status === 'blocked'
      && sourceExposed.shadowBlockers.includes('formal_generation_source_isolation_not_proven')
  };
  return {
    mode: 'subject_practice_family_automation_qualification_self_test',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    shadowDecision: shadow,
    releaseDecision: release,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only'
  };
}

if (require.main === module) {
  const report = runSelfTest();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { fixture, runSelfTest };
