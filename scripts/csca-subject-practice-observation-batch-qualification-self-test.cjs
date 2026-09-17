#!/usr/bin/env node

if (!require.extensions['.ts']) {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

const {
  buildSubjectPracticeObservationBatchManifest,
  subjectPracticeObservationBatchEnvelopeFor,
  subjectPracticeObservationExpectedGeneratorVersionFor
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-manifest-policy');
const {
  bindSubjectPracticeObservationBatchQualificationEvidence,
  subjectPracticeObservationCandidateEvidenceBatchId
} = require('../backend/src/ai-questioning/subject-practice-observation-batch-qualification-policy');
const {
  createSubjectPracticeProductionShadowExporterAttestation,
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION,
  subjectPracticeProductionShadowPayloadSha256
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-evidence-policy');
const {
  subjectPracticeProductionShadowScopeContractFor
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-scope-registry');
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

const secret = 'fixture-secret-with-at-least-thirty-two-characters';
const descriptor = {
  ordinal: 1,
  subject: 'math',
  productionRunId: 1,
  productionCellId: 16,
  taskFamily: 'elementary_function_direct_property',
  planTemplate: 'math_elementary_function_relation_v1',
  plannedScopeId: 'math-basic-elementary-rotation-v1:power:function_value'
};
const manifest = buildSubjectPracticeObservationBatchManifest([descriptor]);
const envelope = subjectPracticeObservationBatchEnvelopeFor({ manifest, taskOrdinal: 1 });
const task = {
  id: '00000000-0000-0000-0000-000000000001', subject: 'math', resourceType: 'production_run', resourceId: '1',
  filterSnapshot: {
    productionCellId: 16,
    requestedTaskFamily: descriptor.taskFamily,
    requestedPlanTemplate: descriptor.planTemplate,
    sealedObservationBatch: envelope
  },
  status: 'succeeded', requested: 1, succeeded: 1, skipped: 0, failed: 0, error: null,
  result: {
    generatedQuestionId: 101,
    gateDecision: 'publishable',
    plannedTaskFamily: descriptor.taskFamily,
    classifiedTaskFamily: descriptor.taskFamily,
    observedPlanTemplate: descriptor.planTemplate,
    observedScopeId: descriptor.plannedScopeId,
    generatorProvider: 'local-deterministic',
    generatorVersion: subjectPracticeObservationExpectedGeneratorVersionFor(descriptor),
    providerAttemptLimit: 0,
    automatedCandidateLeakageGate: {
      policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
      status: 'clear', scannedRevisionCount: 1, blockedRevisionCount: 0, ambiguousRevisionCount: 0,
      revisionMatchSetSha256: 'd'.repeat(64),
      revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
      structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
      normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
      sourceCorpusSnapshotSha256: 'e'.repeat(64),
      sourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
      sourceCorpusRevisionCount: 1,
      sourceCorpusInventoryComplete: true,
      sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
      failClosed: true, sourceContentExposedToGenerator: false
    },
    scenarioEvidence: {
      policyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
      status: 'consistent', scenarioMode: 'abstract', scenarioFamilyId: 'math_abstract_function_object',
      scenarioDomain: 'pure_mathematics', scenarioEntity: 'function_object',
      scenarioAction: 'power:function_value', informationForm: 'symbolic_text',
      scenarioFingerprint: `scenario-${'c'.repeat(20)}`, contextNecessity: 'not_applicable',
      surfaceEntity: null, contractValid: true, surfaceMatched: true, relationEvidenceMatched: true,
      contextNecessityVerified: true, physicalPlausibilityMatched: true,
      chemistryPlausibilityMatched: true, informationParticipationMatched: true
    }
  }
};
const contract = subjectPracticeProductionShadowScopeContractFor(
  descriptor.subject,
  descriptor.taskFamily,
  descriptor.planTemplate
);
const exactPlanKey = `${descriptor.subject}:${descriptor.taskFamily}:${descriptor.planTemplate}`;
const event = {
  eventId: 'fixture-event-101',
  occurredAt: '2026-09-11T00:00:00.000Z',
  environment: 'production',
  candidateId: 101,
  candidateContentSha256: 'a'.repeat(64),
  candidateLeakagePolicyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  candidateLeakageStatus: 'clear',
  candidateLeakageScannedRevisionCount: 1,
  candidateLeakageBlockedRevisionCount: 0,
  candidateLeakageAmbiguousRevisionCount: 0,
  candidateLeakageRevisionMatchSetSha256: 'd'.repeat(64),
  candidateLeakageRevisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
  candidateLeakageStructuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
  candidateLeakageNormalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
  candidateLeakageSourceCorpusSnapshotSha256: 'e'.repeat(64),
  candidateLeakageSourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
  candidateLeakageSourceCorpusRevisionCount: 1,
  candidateLeakageSourceCorpusInventoryComplete: true,
  candidateLeakageSourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
  candidateLeakageFailClosed: true,
  candidateLeakageSourceContentExposedToGenerator: false,
  scenarioPolicyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
  scenarioStatus: 'consistent', scenarioMode: 'abstract', scenarioFamilyId: 'math_abstract_function_object',
  scenarioDomain: 'pure_mathematics', scenarioEntity: 'function_object',
  scenarioAction: 'power:function_value', scenarioInformationForm: 'symbolic_text',
  scenarioFingerprint: `scenario-${'c'.repeat(20)}`, scenarioContextNecessity: 'not_applicable',
  scenarioContractValid: true, scenarioSurfaceMatched: true, scenarioRelationEvidenceMatched: true,
  scenarioContextNecessityVerified: true, scenarioPhysicalPlausibilityMatched: true,
  scenarioChemistryPlausibilityMatched: true, scenarioInformationParticipationMatched: true,
  scenarioSourceContentExposedToGenerator: false, scenarioProductionGateImpact: 'none_shadow_only',
  ...contract.expectedBinding,
  sourceIsolationProviderProjectionSha256: 'b'.repeat(64),
  scopeId: descriptor.plannedScopeId,
  deterministicStatus: 'verified',
  explanationStatus: 'verified',
  oracleStatus: 'verified',
  questionPlanAdherent: true,
  validatorBlockingFree: true,
  wouldPublish: true,
  publicationSuppressed: true,
  publicationAttempted: false,
  reasonCodes: []
};
const contentPayload = {
  schemaVersion: 'subject-practice-production-shadow-evidence-batch-v9',
  protocolVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION,
  batchId: subjectPracticeObservationCandidateEvidenceBatchId({ observationBatchId: envelope.batchId, exactPlanKey }),
  generatedAt: '2026-09-11T00:01:00.000Z',
  captureMode: 'publication_suppressed',
  events: [event]
};
const batch = { ...contentPayload, payloadSha256: subjectPracticeProductionShadowPayloadSha256(contentPayload) };
const attestation = createSubjectPracticeProductionShadowExporterAttestation({
  batch,
  exporterId: 'fixture-read-only-exporter',
  issuedAt: '2026-09-11T00:02:00.000Z',
  secret
});
const signedCandidateEvidence = [{ exactPlanKey, batch, attestation }];
const accepted = bindSubjectPracticeObservationBatchQualificationEvidence({
  manifest, tasks: [task], signedCandidateEvidence, exporterHmacSecret: secret
});
const wrongCandidate = structuredClone(signedCandidateEvidence);
wrongCandidate[0].batch.events[0].candidateId = 102;
wrongCandidate[0].batch.payloadSha256 = subjectPracticeProductionShadowPayloadSha256({
  ...wrongCandidate[0].batch,
  payloadSha256: undefined
});
wrongCandidate[0].attestation = createSubjectPracticeProductionShadowExporterAttestation({
  batch: wrongCandidate[0].batch,
  exporterId: 'fixture-read-only-exporter',
  issuedAt: '2026-09-11T00:03:00.000Z',
  secret
});
const candidateMismatch = bindSubjectPracticeObservationBatchQualificationEvidence({
  manifest, tasks: [task], signedCandidateEvidence: wrongCandidate, exporterHmacSecret: secret
});
const leakageMismatchEvidence = structuredClone(signedCandidateEvidence);
leakageMismatchEvidence[0].batch.events[0].candidateLeakageSourceCorpusSnapshotSha256 = 'f'.repeat(64);
leakageMismatchEvidence[0].batch.payloadSha256 = subjectPracticeProductionShadowPayloadSha256({
  ...leakageMismatchEvidence[0].batch,
  payloadSha256: undefined
});
leakageMismatchEvidence[0].attestation = createSubjectPracticeProductionShadowExporterAttestation({
  batch: leakageMismatchEvidence[0].batch,
  exporterId: 'fixture-read-only-exporter',
  issuedAt: '2026-09-11T00:03:30.000Z',
  secret
});
const leakageMismatch = bindSubjectPracticeObservationBatchQualificationEvidence({
  manifest, tasks: [task], signedCandidateEvidence: leakageMismatchEvidence, exporterHmacSecret: secret
});
const badSecret = bindSubjectPracticeObservationBatchQualificationEvidence({
  manifest, tasks: [task], signedCandidateEvidence, exporterHmacSecret: 'wrong-secret-that-is-still-long-enough-000'
});
const omitted = bindSubjectPracticeObservationBatchQualificationEvidence({
  manifest, tasks: [task], signedCandidateEvidence: [], exporterHmacSecret: secret
});

const checks = {
  validTaskAndSignedContentBridgePasses: accepted.readyForFamilyQualification === true,
  exactCandidateSetRequired: candidateMismatch.readyForFamilyQualification === false,
  exactCandidateLeakageEvidenceBindingRequired: leakageMismatch.readyForFamilyQualification === false
    && leakageMismatch.reasons.some((reason) => reason.endsWith(':observation_batch_candidate_leakage_evidence_mismatch')),
  hmacTrustRequired: badSecret.readyForFamilyQualification === false,
  signedContentCannotBeOmitted: omitted.readyForFamilyQualification === false,
  candidateIdsNeverDefineTaskDenominator: accepted.trustBoundary.candidateIdCherryPickingAllowed === false,
  realShadowInputUsesRequestedTaskDenominator:
    accepted.perExactPlan[exactPlanKey].realProductionShadow.requestedCount === 1
};
const report = {
  mode: 'subject_practice_observation_batch_qualification_self_test',
  reportVersion: 'subject-practice-observation-batch-qualification-self-test-v2',
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  acceptedStatus: accepted.status,
  acceptedReasons: accepted.reasons,
  acceptedContentReasonCodes: accepted.perExactPlan[exactPlanKey].contentScore?.reasonCodes,
  candidateMismatchReasons: candidateMismatch.reasons,
  leakageMismatchReasons: leakageMismatch.reasons,
  badSecretReasons: badSecret.reasons,
  omittedReasons: omitted.reasons,
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'none_fixture_only',
  publicationImpact: 'none'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report };
