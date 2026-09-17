#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const {
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION,
  scoreSubjectPracticeProductionShadowEvidence,
  subjectPracticeProductionShadowPayloadSha256
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-evidence-policy');
const {
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
} = require('../backend/src/ai-questioning/subject-practice-generator-source-isolation-policy');
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
  SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-scenario-diversity-policy');

const expectedScopeIds = [
  'math-basic-elementary-rotation-v1:logarithmic:domain',
  'math-basic-elementary-rotation-v1:exponential:range',
  'math-basic-elementary-rotation-v1:radical:monotonicity',
  'math-basic-elementary-rotation-v1:power:function_value'
];
const expectedBinding = {
  subject: 'math',
  taskFamily: 'elementary_function_direct_property',
  planTemplate: 'math_elementary_function_relation_v1',
  questionPlanPolicyVersion: 'subject-practice-question-plan-policy-v1',
  generatorVersion: 'math-elementary-local-generator-v2',
  solverVersion: 'math-elementary-direct-property-solver-v1',
  verificationScopeVersion: 'math-elementary-direct-property-verification-scope-v1',
  explanationVerifierVersion: 'math-elementary-explanation-verifier-v1',
  independentOracleVersion: 'math-elementary-independent-oracle-v1',
  sourceIsolationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  sourceIsolationBoundary: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  sourceIsolationAllowedInput: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  sourceIsolationOriginalQuestionContentOmitted: true,
  sourceIsolationReversibleSourceFieldsOmitted: true,
  sourceIsolationDeveloperUnseenRequired: false,
  sourceIsolationOfficialHoldoutRequired: false,
  sourceIsolationSourceLinkageIdentifiersOmitted: true,
  sourceIsolationProfileAggregationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  sourceIsolationProfileMinimumSampleSize: SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  sourceIsolationProfileProjectionMode: SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE,
  sourceIsolationProjectionHashRecomputed: true,
  sourceIsolationKnownSourceCorpusComparisonPassed: true,
  sourceIsolationKnownSourceLeakMatchCount: 0,
  formalVerificationOrchestratorVersion: 'subject-practice-formal-verification-orchestrator-v2',
  localShadowRoutingVersion: 'subject-practice-local-generator-shadow-routing-v2'
};
const events = Array.from({ length: 100 }, (_, index) => ({
  eventId: `fixture-event-${index + 1}`,
  occurredAt: new Date(Date.UTC(2026, 8, 13, 0, index, 0)).toISOString(),
  environment: 'fixture',
  candidateId: null,
  candidateContentSha256: crypto.createHash('sha256').update(`candidate-${index}`).digest('hex'),
  candidateLeakagePolicyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  candidateLeakageStatus: 'clear',
  candidateLeakageScannedRevisionCount: 100,
  candidateLeakageBlockedRevisionCount: 0,
  candidateLeakageAmbiguousRevisionCount: 0,
  candidateLeakageRevisionMatchSetSha256: crypto.createHash('sha256').update(`matches-${index}`).digest('hex'),
  candidateLeakageRevisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
  candidateLeakageStructuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
  candidateLeakageNormalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
  candidateLeakageSourceCorpusSnapshotSha256: crypto.createHash('sha256').update('source-corpus').digest('hex'),
  candidateLeakageSourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
  candidateLeakageSourceCorpusRevisionCount: 100,
  candidateLeakageSourceCorpusInventoryComplete: true,
  candidateLeakageSourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
  candidateLeakageFailClosed: true,
  candidateLeakageSourceContentExposedToGenerator: false,
  scenarioPolicyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
  scenarioStatus: 'consistent',
  scenarioMode: 'abstract',
  scenarioFamilyId: 'math_abstract_function_object',
  scenarioDomain: 'pure_mathematics',
  scenarioEntity: 'function_object',
  scenarioAction: expectedScopeIds[index % expectedScopeIds.length],
  scenarioInformationForm: 'symbolic_text',
  scenarioFingerprint: `scenario-${crypto.createHash('sha256').update(`scenario-${index}`).digest('hex').slice(0, 20)}`,
  scenarioContextNecessity: 'not_applicable',
  scenarioContractValid: true,
  scenarioSurfaceMatched: true,
  scenarioRelationEvidenceMatched: true,
  scenarioContextNecessityVerified: true,
  scenarioPhysicalPlausibilityMatched: true,
  scenarioChemistryPlausibilityMatched: true,
  scenarioInformationParticipationMatched: true,
  scenarioSourceContentExposedToGenerator: false,
  scenarioProductionGateImpact: 'none_shadow_only',
  subject: 'math',
  taskFamily: 'elementary_function_direct_property',
  planTemplate: 'math_elementary_function_relation_v1',
  questionPlanPolicyVersion: expectedBinding.questionPlanPolicyVersion,
  scopeId: expectedScopeIds[index % expectedScopeIds.length],
  verificationScopeVersion: expectedBinding.verificationScopeVersion,
  generatorVersion: 'math-elementary-local-generator-v2',
  solverVersion: 'math-elementary-direct-property-solver-v1',
  explanationVerifierVersion: 'math-elementary-explanation-verifier-v1',
  independentOracleVersion: 'math-elementary-independent-oracle-v1',
  sourceIsolationPolicyVersion: expectedBinding.sourceIsolationPolicyVersion,
  sourceIsolationBoundary: expectedBinding.sourceIsolationBoundary,
  sourceIsolationAllowedInput: expectedBinding.sourceIsolationAllowedInput,
  sourceIsolationOriginalQuestionContentOmitted: true,
  sourceIsolationReversibleSourceFieldsOmitted: true,
  sourceIsolationDeveloperUnseenRequired: false,
  sourceIsolationOfficialHoldoutRequired: false,
  sourceIsolationSourceLinkageIdentifiersOmitted: true,
  sourceIsolationProfileAggregationPolicyVersion: expectedBinding.sourceIsolationProfileAggregationPolicyVersion,
  sourceIsolationProfileMinimumSampleSize: expectedBinding.sourceIsolationProfileMinimumSampleSize,
  sourceIsolationProfileProjectionMode: expectedBinding.sourceIsolationProfileProjectionMode,
  sourceIsolationProjectionHashRecomputed: true,
  sourceIsolationKnownSourceCorpusComparisonPassed: true,
  sourceIsolationKnownSourceLeakMatchCount: 0,
  sourceIsolationProviderProjectionSha256: crypto.createHash('sha256').update(`projection-${index}`).digest('hex'),
  formalVerificationOrchestratorVersion: expectedBinding.formalVerificationOrchestratorVersion,
  localShadowRoutingVersion: expectedBinding.localShadowRoutingVersion,
  deterministicStatus: 'verified',
  explanationStatus: 'verified',
  oracleStatus: 'verified',
  questionPlanAdherent: true,
  validatorBlockingFree: true,
  wouldPublish: true,
  publicationSuppressed: true,
  publicationAttempted: false,
  reasonCodes: []
}));

function batchFor(nextEvents) {
  const payload = {
    schemaVersion: 'subject-practice-production-shadow-evidence-batch-v9',
    protocolVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION,
    batchId: 'fixture-math-100',
    generatedAt: '2026-09-13T00:00:00.000Z',
    captureMode: 'publication_suppressed',
    events: nextEvents
  };
  return { ...payload, payloadSha256: subjectPracticeProductionShadowPayloadSha256(payload) };
}

const scoringContext = { expectedScopeIds, expectedBinding };
const fixtureScore = scoreSubjectPracticeProductionShadowEvidence(batchFor(events), scoringContext);
const forgedTrustInsidePayload = { ...batchFor(events), trustedExporterAttestation: true };
const forgedScore = scoreSubjectPracticeProductionShadowEvidence(forgedTrustInsidePayload, scoringContext);
const tampered = batchFor(events);
tampered.events[0] = { ...tampered.events[0], scopeId: 'out-of-scope' };
const tamperedScore = scoreSubjectPracticeProductionShadowEvidence(tampered, scoringContext);
const duplicateEvents = [...events, { ...events[0] }];
const duplicateScore = scoreSubjectPracticeProductionShadowEvidence(batchFor(duplicateEvents), scoringContext);
const falseAcceptEvents = events.map((event, index) => index === 0
  ? { ...event, oracleStatus: 'conflict', wouldPublish: true }
  : event);
const falseAcceptScore = scoreSubjectPracticeProductionShadowEvidence(batchFor(falseAcceptEvents), scoringContext);
const versionDriftEvents = events.map((event, index) => index === 0
  ? { ...event, solverVersion: 'math-elementary-direct-property-solver-v2' }
  : event);
const versionDriftScore = scoreSubjectPracticeProductionShadowEvidence(batchFor(versionDriftEvents), scoringContext);
const generatorBoundaryDriftEvents = events.map((event, index) => index === 0
  ? { ...event, sourceIsolationDeveloperUnseenRequired: true }
  : event);
const generatorBoundaryDriftScore = scoreSubjectPracticeProductionShadowEvidence(batchFor(generatorBoundaryDriftEvents), scoringContext);
const candidateLeakageFailureEvents = events.map((event, index) => index === 0
  ? { ...event, candidateLeakageStatus: 'blocked', candidateLeakageBlockedRevisionCount: 1, wouldPublish: false }
  : event);
const candidateLeakageFailureScore = scoreSubjectPracticeProductionShadowEvidence(
  batchFor(candidateLeakageFailureEvents),
  scoringContext
);
const incompleteCorpusEvents = events.map((event, index) => index === 0
  ? { ...event, candidateLeakageSourceCorpusInventoryComplete: false }
  : event);
const incompleteCorpusScore = scoreSubjectPracticeProductionShadowEvidence(
  batchFor(incompleteCorpusEvents),
  scoringContext
);
const scenarioFailureEvents = events.map((event, index) => index === 0
  ? { ...event, scenarioStatus: 'inconsistent', scenarioInformationParticipationMatched: false }
  : event);
const scenarioFailureScore = scoreSubjectPracticeProductionShadowEvidence(batchFor(scenarioFailureEvents), scoringContext);

const checks = {
  fixtureValidButNonqualifying: fixtureScore.evidenceValid
    && fixtureScore.status === 'valid_nonqualifying'
    && !fixtureScore.qualifiesAsFormalProductionShadowEvidence,
  payloadCannotSelfAttestTrust: forgedScore.status === 'valid_nonqualifying'
    && !forgedScore.qualifiesAsFormalProductionShadowEvidence,
  tamperDetectedByHash: tamperedScore.status === 'invalid'
    && tamperedScore.reasonCodes.includes('production_shadow_evidence_payload_hash_mismatch'),
  duplicateEventRejected: duplicateScore.status === 'invalid'
    && duplicateScore.duplicateEventIdCount === 1,
  falseAcceptCounted: falseAcceptScore.falseAccepts === 1
    && falseAcceptScore.reasonCodes.includes('production_shadow_evidence_false_accept'),
  exactVersionBindingEnforced: versionDriftScore.bindingMismatchCount === 1
    && versionDriftScore.reasonCodes.includes('production_shadow_evidence_binding_mismatch'),
  generatorInvocationBoundaryEnforced: generatorBoundaryDriftScore.invalidEventCount === 1
    && generatorBoundaryDriftScore.reasonCodes.includes('production_shadow_evidence_event_invalid'),
  candidateLeakageFailureIsCountedAndNonqualifying:
    candidateLeakageFailureScore.candidateLeakageFailureCount === 1
      && candidateLeakageFailureScore.reasonCodes.includes('production_shadow_evidence_candidate_leakage_failed')
      && !candidateLeakageFailureScore.qualifiesAsFormalProductionShadowEvidence,
  incompleteCorpusSnapshotRejected:
    incompleteCorpusScore.invalidEventCount === 1
      && incompleteCorpusScore.reasonCodes.includes('production_shadow_evidence_event_invalid')
      && !incompleteCorpusScore.qualifiesAsFormalProductionShadowEvidence,
  scenarioFailureObservedWithoutPrematureReleaseGate:
    scenarioFailureScore.scenarioEvidenceFailureCount === 1
      && scenarioFailureScore.scenarioDiversity.scenarioConsistencyFailureRate === 0.01
      && scenarioFailureScore.evidenceValid,
  exactScopeCountsReported: Object.values(fixtureScore.perScopeCounts).every((count) => count === 25)
};
const report = {
  mode: 'subject_practice_production_shadow_evidence_self_test',
  reportVersion: 'subject-practice-production-shadow-evidence-self-test-v9',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  fixtureScore,
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_fixture_only_protocol_test'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report };
