import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
} from './subject-practice-generator-source-isolation-policy';
import {
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} from './subject-practice-candidate-output-novelty-policy';
import { SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION } from './subject-practice-source-corpus-scan-policy';
import {
  SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
  subjectPracticeScenarioDiversityBatchMetrics
} from './subject-practice-scenario-diversity-policy';

export const SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION = 'subject-practice-production-shadow-evidence-v9-corpus-snapshot-bound';
export const SUBJECT_PRACTICE_PRODUCTION_SHADOW_EXPORTER_ATTESTATION_VERSION = 'subject-practice-production-shadow-exporter-attestation-v1';

const TRUSTED_EXPORTER_PROOF = Symbol('subject-practice-production-shadow-trusted-exporter-proof');

export type SubjectPracticeProductionShadowEvent = {
  eventId: string;
  occurredAt: string;
  environment: 'production' | 'staging' | 'fixture';
  candidateId: number | null;
  candidateContentSha256: string;
  candidateLeakagePolicyVersion: string;
  candidateLeakageStatus: 'clear' | 'blocked' | 'ambiguous' | 'missing_corpus';
  candidateLeakageScannedRevisionCount: number;
  candidateLeakageBlockedRevisionCount: number;
  candidateLeakageAmbiguousRevisionCount: number;
  candidateLeakageRevisionMatchSetSha256: string;
  candidateLeakageRevisionMatchDigestVersion: string;
  candidateLeakageStructuredCorpusSchemaVersion: string;
  candidateLeakageNormalizationVersion: string;
  candidateLeakageSourceCorpusSnapshotSha256: string;
  candidateLeakageSourceCorpusSnapshotVersion: string;
  candidateLeakageSourceCorpusRevisionCount: number;
  candidateLeakageSourceCorpusInventoryComplete: boolean;
  candidateLeakageSourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot';
  candidateLeakageFailClosed: boolean;
  candidateLeakageSourceContentExposedToGenerator: boolean;
  scenarioPolicyVersion: string;
  scenarioStatus: 'consistent' | 'inconsistent';
  scenarioMode: string;
  scenarioFamilyId: string;
  scenarioDomain: string;
  scenarioEntity: string;
  scenarioAction: string;
  scenarioInformationForm: string;
  scenarioFingerprint: string;
  scenarioContextNecessity: string;
  scenarioContractValid: boolean;
  scenarioSurfaceMatched: boolean;
  scenarioRelationEvidenceMatched: boolean;
  scenarioContextNecessityVerified: boolean;
  scenarioPhysicalPlausibilityMatched: boolean;
  scenarioChemistryPlausibilityMatched: boolean;
  scenarioInformationParticipationMatched: boolean;
  scenarioSourceContentExposedToGenerator: boolean;
  scenarioProductionGateImpact: 'none_shadow_only';
  subject: 'math' | 'physics' | 'chemistry';
  taskFamily: string;
  planTemplate: string;
  questionPlanPolicyVersion: string;
  scopeId: string;
  verificationScopeVersion: string;
  generatorVersion: string;
  solverVersion: string;
  explanationVerifierVersion: string;
  independentOracleVersion: string;
  sourceIsolationPolicyVersion: string;
  sourceIsolationBoundary: string;
  sourceIsolationAllowedInput: string;
  sourceIsolationOriginalQuestionContentOmitted: boolean;
  sourceIsolationReversibleSourceFieldsOmitted: boolean;
  sourceIsolationDeveloperUnseenRequired: boolean;
  sourceIsolationOfficialHoldoutRequired: boolean;
  sourceIsolationSourceLinkageIdentifiersOmitted: boolean;
  sourceIsolationProfileAggregationPolicyVersion: string;
  sourceIsolationProfileMinimumSampleSize: number;
  sourceIsolationProfileProjectionMode: string;
  sourceIsolationProjectionHashRecomputed: boolean;
  sourceIsolationKnownSourceCorpusComparisonPassed: boolean;
  sourceIsolationKnownSourceLeakMatchCount: number;
  sourceIsolationProviderProjectionSha256: string;
  formalVerificationOrchestratorVersion: string;
  localShadowRoutingVersion: string;
  deterministicStatus: 'verified' | 'conflict' | 'unparsed';
  explanationStatus: 'verified' | 'failed' | 'missing';
  oracleStatus: 'verified' | 'conflict' | 'unparsed' | 'missing';
  questionPlanAdherent: boolean;
  validatorBlockingFree: boolean;
  wouldPublish: boolean;
  publicationSuppressed: boolean;
  publicationAttempted: boolean;
  reasonCodes: string[];
};

export type SubjectPracticeProductionShadowEvidenceBatch = {
  schemaVersion: 'subject-practice-production-shadow-evidence-batch-v9';
  protocolVersion: string;
  batchId: string;
  generatedAt: string;
  captureMode: 'publication_suppressed';
  events: SubjectPracticeProductionShadowEvent[];
  payloadSha256: string;
};

export type SubjectPracticeProductionShadowExporterAttestation = {
  schemaVersion: typeof SUBJECT_PRACTICE_PRODUCTION_SHADOW_EXPORTER_ATTESTATION_VERSION;
  exporterId: string;
  batchId: string;
  payloadSha256: string;
  issuedAt: string;
  signatureHmacSha256: string;
};

export type SubjectPracticeProductionShadowTrustedExporterProof = {
  readonly [TRUSTED_EXPORTER_PROOF]: true;
  readonly exporterId: string;
  readonly batchId: string;
  readonly payloadSha256: string;
  readonly issuedAt: string;
};

export type SubjectPracticeProductionShadowEvidenceScore = {
  protocolVersion: string;
  status: 'invalid' | 'valid_nonqualifying' | 'valid_trusted_production_evidence';
  evidenceValid: boolean;
  qualifiesAsFormalProductionShadowEvidence: boolean;
  observedCount: number;
  eligibleSuppressedCount: number;
  falseAccepts: number;
  scopeLeakageCount: number;
  unexpectedConflictCount: number;
  candidateLeakageFailureCount: number;
  scenarioEvidenceFailureCount: number;
  scenarioDiversity: ReturnType<typeof subjectPracticeScenarioDiversityBatchMetrics>;
  duplicateEventIdCount: number;
  invalidEventCount: number;
  bindingMismatchCount: number;
  perScopeCounts: Record<string, number>;
  payloadHashMatched: boolean;
  reasonCodes: string[];
  trustBoundary: 'trusted_exporter_attestation_required_outside_payload';
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function exporterAttestationMessage(input: Omit<SubjectPracticeProductionShadowExporterAttestation, 'signatureHmacSha256'>) {
  return JSON.stringify(input);
}

export function createSubjectPracticeProductionShadowExporterAttestation(input: {
  batch: SubjectPracticeProductionShadowEvidenceBatch;
  exporterId: string;
  issuedAt: string;
  secret: string;
}): SubjectPracticeProductionShadowExporterAttestation {
  const unsigned: Omit<SubjectPracticeProductionShadowExporterAttestation, 'signatureHmacSha256'> = {
    schemaVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_EXPORTER_ATTESTATION_VERSION,
    exporterId: clean(input.exporterId),
    batchId: clean(input.batch.batchId),
    payloadSha256: clean(input.batch.payloadSha256),
    issuedAt: clean(input.issuedAt)
  };
  if (!unsigned.exporterId || !validIsoTimestamp(unsigned.issuedAt) || !validSha256(unsigned.payloadSha256)) {
    throw new Error('production_shadow_exporter_attestation_input_invalid');
  }
  const secret = clean(input.secret);
  if (secret.length < 32) throw new Error('production_shadow_exporter_attestation_secret_too_short');
  return {
    ...unsigned,
    signatureHmacSha256: createHmac('sha256', secret).update(exporterAttestationMessage(unsigned)).digest('hex')
  };
}

export function verifySubjectPracticeProductionShadowExporterAttestation(input: {
  batch: SubjectPracticeProductionShadowEvidenceBatch;
  attestation: SubjectPracticeProductionShadowExporterAttestation;
  secret: string;
}): SubjectPracticeProductionShadowTrustedExporterProof | null {
  const attestation = input.attestation;
  const secret = clean(input.secret);
  const batchPayload = input.batch ? {
    schemaVersion: input.batch.schemaVersion,
    protocolVersion: input.batch.protocolVersion,
    batchId: input.batch.batchId,
    generatedAt: input.batch.generatedAt,
    captureMode: input.batch.captureMode,
    events: input.batch.events
  } : null;
  if (!attestation
    || !batchPayload
    || subjectPracticeProductionShadowPayloadSha256(batchPayload) !== clean(input.batch.payloadSha256)
    || attestation.schemaVersion !== SUBJECT_PRACTICE_PRODUCTION_SHADOW_EXPORTER_ATTESTATION_VERSION
    || !clean(attestation.exporterId)
    || !validIsoTimestamp(attestation.issuedAt)
    || !validSha256(attestation.payloadSha256)
    || !validSha256(attestation.signatureHmacSha256)
    || secret.length < 32
    || clean(attestation.batchId) !== clean(input.batch.batchId)
    || clean(attestation.payloadSha256) !== clean(input.batch.payloadSha256)) return null;
  const unsigned = {
    schemaVersion: attestation.schemaVersion,
    exporterId: clean(attestation.exporterId),
    batchId: clean(attestation.batchId),
    payloadSha256: clean(attestation.payloadSha256),
    issuedAt: clean(attestation.issuedAt)
  };
  const expected = Buffer.from(createHmac('sha256', secret).update(exporterAttestationMessage(unsigned)).digest('hex'), 'hex');
  const actual = Buffer.from(attestation.signatureHmacSha256, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return {
    [TRUSTED_EXPORTER_PROOF]: true,
    exporterId: unsigned.exporterId,
    batchId: unsigned.batchId,
    payloadSha256: unsigned.payloadSha256,
    issuedAt: unsigned.issuedAt
  };
}

export function subjectPracticeProductionShadowPayloadSha256(
  batch: Omit<SubjectPracticeProductionShadowEvidenceBatch, 'payloadSha256'>
) {
  return sha256(JSON.stringify(batch));
}

function validIsoTimestamp(value: unknown) {
  const text = clean(value);
  return Boolean(text && Number.isFinite(Date.parse(text)) && new Date(text).toISOString() === text);
}

function validSha256(value: unknown) {
  return /^[a-f0-9]{64}$/.test(clean(value));
}

function eventStructurallyValid(event: SubjectPracticeProductionShadowEvent) {
  return Boolean(
    clean(event.eventId)
    && validIsoTimestamp(event.occurredAt)
    && ['production', 'staging', 'fixture'].includes(event.environment)
    && (event.candidateId === null || (Number.isInteger(event.candidateId) && Number(event.candidateId) > 0))
    && validSha256(event.candidateContentSha256)
    && event.candidateLeakagePolicyVersion === SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION
    && ['clear', 'blocked', 'ambiguous', 'missing_corpus'].includes(event.candidateLeakageStatus)
    && Number.isInteger(event.candidateLeakageScannedRevisionCount)
    && event.candidateLeakageScannedRevisionCount >= 0
    && Number.isInteger(event.candidateLeakageBlockedRevisionCount)
    && event.candidateLeakageBlockedRevisionCount >= 0
    && Number.isInteger(event.candidateLeakageAmbiguousRevisionCount)
    && event.candidateLeakageAmbiguousRevisionCount >= 0
    && validSha256(event.candidateLeakageRevisionMatchSetSha256)
    && event.candidateLeakageRevisionMatchDigestVersion === SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION
    && event.candidateLeakageStructuredCorpusSchemaVersion === SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
    && event.candidateLeakageNormalizationVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
    && validSha256(event.candidateLeakageSourceCorpusSnapshotSha256)
    && event.candidateLeakageSourceCorpusSnapshotVersion === SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION
    && Number.isInteger(event.candidateLeakageSourceCorpusRevisionCount)
    && event.candidateLeakageSourceCorpusRevisionCount > 0
    && event.candidateLeakageSourceCorpusRevisionCount === event.candidateLeakageScannedRevisionCount
    && event.candidateLeakageSourceCorpusInventoryComplete === true
    && event.candidateLeakageSourceCorpusInventoryMode === 'all_active_subject_source_questions_at_statement_snapshot'
    && event.candidateLeakageFailClosed === true
    && event.candidateLeakageSourceContentExposedToGenerator === false
    && event.scenarioPolicyVersion === SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION
    && ['consistent', 'inconsistent'].includes(event.scenarioStatus)
    && clean(event.scenarioMode)
    && clean(event.scenarioFamilyId)
    && clean(event.scenarioDomain)
    && clean(event.scenarioEntity)
    && clean(event.scenarioAction)
    && clean(event.scenarioInformationForm)
    && /^scenario-[a-f0-9]{20}$/.test(clean(event.scenarioFingerprint))
    && clean(event.scenarioContextNecessity)
    && typeof event.scenarioContractValid === 'boolean'
    && typeof event.scenarioSurfaceMatched === 'boolean'
    && typeof event.scenarioRelationEvidenceMatched === 'boolean'
    && typeof event.scenarioContextNecessityVerified === 'boolean'
    && typeof event.scenarioPhysicalPlausibilityMatched === 'boolean'
    && typeof event.scenarioChemistryPlausibilityMatched === 'boolean'
    && typeof event.scenarioInformationParticipationMatched === 'boolean'
    && event.scenarioSourceContentExposedToGenerator === false
    && event.scenarioProductionGateImpact === 'none_shadow_only'
    && ['math', 'physics', 'chemistry'].includes(event.subject)
    && clean(event.taskFamily)
    && clean(event.planTemplate)
    && clean(event.questionPlanPolicyVersion)
    && clean(event.scopeId)
    && clean(event.verificationScopeVersion)
    && clean(event.generatorVersion)
    && clean(event.solverVersion)
    && clean(event.explanationVerifierVersion)
    && clean(event.independentOracleVersion)
    && event.sourceIsolationPolicyVersion === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION
    && event.sourceIsolationBoundary === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY
    && event.sourceIsolationAllowedInput === SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT
    && event.sourceIsolationOriginalQuestionContentOmitted === true
    && event.sourceIsolationReversibleSourceFieldsOmitted === true
    && event.sourceIsolationDeveloperUnseenRequired === false
    && event.sourceIsolationOfficialHoldoutRequired === false
    && event.sourceIsolationSourceLinkageIdentifiersOmitted === true
    && event.sourceIsolationProfileAggregationPolicyVersion === SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION
    && event.sourceIsolationProfileMinimumSampleSize === SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE
    && event.sourceIsolationProfileProjectionMode === SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
    && event.sourceIsolationProjectionHashRecomputed === true
    && event.sourceIsolationKnownSourceCorpusComparisonPassed === true
    && event.sourceIsolationKnownSourceLeakMatchCount === 0
    && validSha256(event.sourceIsolationProviderProjectionSha256)
    && clean(event.formalVerificationOrchestratorVersion)
    && clean(event.localShadowRoutingVersion)
    && ['verified', 'conflict', 'unparsed'].includes(event.deterministicStatus)
    && ['verified', 'failed', 'missing'].includes(event.explanationStatus)
    && ['verified', 'conflict', 'unparsed', 'missing'].includes(event.oracleStatus)
    && typeof event.questionPlanAdherent === 'boolean'
    && typeof event.validatorBlockingFree === 'boolean'
    && typeof event.wouldPublish === 'boolean'
    && Array.isArray(event.reasonCodes)
    && event.reasonCodes.every((reasonCode) => Boolean(clean(reasonCode)))
    && event.publicationSuppressed === true
    && event.publicationAttempted === false
  );
}

function fullyVerified(event: SubjectPracticeProductionShadowEvent) {
  return event.deterministicStatus === 'verified'
    && event.explanationStatus === 'verified'
    && event.oracleStatus === 'verified'
    && event.questionPlanAdherent
    && event.validatorBlockingFree
    && event.candidateLeakageStatus === 'clear'
    && event.candidateLeakageScannedRevisionCount > 0
    && event.candidateLeakageBlockedRevisionCount === 0
    && event.candidateLeakageAmbiguousRevisionCount === 0;
}

export function scoreSubjectPracticeProductionShadowEvidence(
  input: unknown,
  context: {
    expectedScopeIds: string[];
    expectedBinding?: {
      subject: SubjectPracticeProductionShadowEvent['subject'];
      taskFamily: string;
      planTemplate: string;
      questionPlanPolicyVersion: string;
      generatorVersion: string;
      solverVersion: string;
      verificationScopeVersion: string;
      explanationVerifierVersion: string;
      independentOracleVersion: string;
      sourceIsolationPolicyVersion: string;
      sourceIsolationBoundary: string;
      sourceIsolationAllowedInput: string;
      sourceIsolationOriginalQuestionContentOmitted: boolean;
      sourceIsolationReversibleSourceFieldsOmitted: boolean;
      sourceIsolationDeveloperUnseenRequired: boolean;
      sourceIsolationOfficialHoldoutRequired: boolean;
      sourceIsolationSourceLinkageIdentifiersOmitted: boolean;
      sourceIsolationProfileAggregationPolicyVersion: string;
      sourceIsolationProfileMinimumSampleSize: number;
      sourceIsolationProfileProjectionMode: string;
      sourceIsolationProjectionHashRecomputed: boolean;
      sourceIsolationKnownSourceCorpusComparisonPassed: boolean;
      sourceIsolationKnownSourceLeakMatchCount: number;
      formalVerificationOrchestratorVersion: string;
      localShadowRoutingVersion: string;
    };
    trustedExporterProof?: SubjectPracticeProductionShadowTrustedExporterProof | null;
  }
): SubjectPracticeProductionShadowEvidenceScore {
  const batch = (input && typeof input === 'object') ? input as SubjectPracticeProductionShadowEvidenceBatch : null;
  const expectedScopeIds = new Set((context.expectedScopeIds ?? []).map(clean).filter(Boolean));
  const reasonCodes: string[] = [];
  const headerValid = Boolean(batch
    && batch.schemaVersion === 'subject-practice-production-shadow-evidence-batch-v9'
    && batch.protocolVersion === SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION
    && clean(batch.batchId)
    && validIsoTimestamp(batch.generatedAt)
    && batch.captureMode === 'publication_suppressed'
    && Array.isArray(batch.events));
  if (!headerValid) reasonCodes.push('production_shadow_evidence_header_invalid');
  const events = headerValid ? batch!.events : [];
  const payloadHashMatched = Boolean(headerValid && subjectPracticeProductionShadowPayloadSha256({
    schemaVersion: batch!.schemaVersion,
    protocolVersion: batch!.protocolVersion,
    batchId: batch!.batchId,
    generatedAt: batch!.generatedAt,
    captureMode: batch!.captureMode,
    events
  }) === batch!.payloadSha256);
  if (!payloadHashMatched) reasonCodes.push('production_shadow_evidence_payload_hash_mismatch');
  const eventIds = events.map((event) => clean(event.eventId)).filter(Boolean);
  const duplicateEventIdCount = eventIds.length - new Set(eventIds).size;
  if (duplicateEventIdCount > 0) reasonCodes.push('production_shadow_evidence_duplicate_event_id');
  const invalidEventCount = events.filter((event) => !eventStructurallyValid(event)).length;
  if (invalidEventCount > 0) reasonCodes.push('production_shadow_evidence_event_invalid');
  const bindingMismatchCount = context.expectedBinding
    ? events.filter((event) => Object.entries(context.expectedBinding!).some(([key, expected]) =>
      clean(event[key as keyof SubjectPracticeProductionShadowEvent]) !== clean(expected))).length
    : events.length;
  if (bindingMismatchCount > 0 || !context.expectedBinding) reasonCodes.push('production_shadow_evidence_binding_mismatch');
  const scopeLeakageCount = events.filter((event) => !expectedScopeIds.has(clean(event.scopeId))).length;
  const perScopeCounts = Object.fromEntries(Array.from(expectedScopeIds)
    .map((scopeId) => [scopeId, events.filter((event) => clean(event.scopeId) === scopeId).length]));
  const falseAccepts = events.filter((event) => event.wouldPublish && !fullyVerified(event)).length;
  const candidateLeakageFailureCount = events.filter((event) => event.candidateLeakageStatus !== 'clear'
    || event.candidateLeakageScannedRevisionCount <= 0
    || event.candidateLeakageBlockedRevisionCount > 0
    || event.candidateLeakageAmbiguousRevisionCount > 0
    || event.candidateLeakageSourceCorpusRevisionCount !== event.candidateLeakageScannedRevisionCount
    || event.candidateLeakageSourceCorpusInventoryComplete !== true
    || !validSha256(event.candidateLeakageSourceCorpusSnapshotSha256)
    || !validSha256(event.candidateLeakageRevisionMatchSetSha256)).length;
  const scenarioEvidenceFailureCount = events.filter((event) => event.scenarioStatus !== 'consistent').length;
  const scenarioDiversity = subjectPracticeScenarioDiversityBatchMetrics({
    expectedCount: events.length,
    evidence: events.map((event) => ({
      status: event.scenarioStatus,
      scenarioMode: event.scenarioMode,
      scenarioFamilyId: event.scenarioFamilyId,
      scenarioDomain: event.scenarioDomain,
      scenarioEntity: event.scenarioEntity,
      scenarioAction: event.scenarioAction,
      informationForm: event.scenarioInformationForm,
      scenarioFingerprint: event.scenarioFingerprint,
      contextNecessity: event.scenarioContextNecessity,
      surfaceEntity: event.scenarioEntity,
      contractValid: event.scenarioContractValid,
      surfaceMatched: event.scenarioSurfaceMatched,
      relationEvidenceMatched: event.scenarioRelationEvidenceMatched,
      contextNecessityVerified: event.scenarioContextNecessityVerified,
      physicalPlausibilityMatched: event.scenarioPhysicalPlausibilityMatched,
      chemistryPlausibilityMatched: event.scenarioChemistryPlausibilityMatched,
      informationParticipationMatched: event.scenarioInformationParticipationMatched
    }))
  });
  const unexpectedConflictCount = events.filter((event) => !event.wouldPublish || !fullyVerified(event)).length;
  const eligibleSuppressedCount = events.filter((event) => event.wouldPublish && fullyVerified(event)
    && event.publicationSuppressed && !event.publicationAttempted && expectedScopeIds.has(clean(event.scopeId))).length;
  if (expectedScopeIds.size === 0) reasonCodes.push('production_shadow_evidence_expected_scope_missing');
  if (scopeLeakageCount > 0) reasonCodes.push('production_shadow_evidence_scope_leakage');
  if (falseAccepts > 0) reasonCodes.push('production_shadow_evidence_false_accept');
  if (candidateLeakageFailureCount > 0) reasonCodes.push('production_shadow_evidence_candidate_leakage_failed');
  if (unexpectedConflictCount > 0) reasonCodes.push('production_shadow_evidence_unexpected_conflict');
  const evidenceValid = headerValid && payloadHashMatched && duplicateEventIdCount === 0 && invalidEventCount === 0;
  const allProduction = events.length > 0 && events.every((event) => event.environment === 'production' && event.candidateId !== null);
  const qualifiesAsFormalProductionShadowEvidence = evidenceValid
    && context.trustedExporterProof?.[TRUSTED_EXPORTER_PROOF] === true
    && context.trustedExporterProof.batchId === batch!.batchId
    && context.trustedExporterProof.payloadSha256 === batch!.payloadSha256
    && allProduction
    && bindingMismatchCount === 0
    && scopeLeakageCount === 0
    && falseAccepts === 0
    && candidateLeakageFailureCount === 0
    && unexpectedConflictCount === 0;
  if (evidenceValid && context.trustedExporterProof?.[TRUSTED_EXPORTER_PROOF] !== true) reasonCodes.push('production_shadow_trusted_exporter_attestation_missing');
  if (evidenceValid && !allProduction) reasonCodes.push('production_shadow_real_production_rows_missing');
  return {
    protocolVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION,
    status: !evidenceValid
      ? 'invalid'
      : qualifiesAsFormalProductionShadowEvidence
        ? 'valid_trusted_production_evidence'
        : 'valid_nonqualifying',
    evidenceValid,
    qualifiesAsFormalProductionShadowEvidence,
    observedCount: events.length,
    eligibleSuppressedCount,
    falseAccepts,
    scopeLeakageCount,
    unexpectedConflictCount,
    candidateLeakageFailureCount,
    scenarioEvidenceFailureCount,
    scenarioDiversity,
    duplicateEventIdCount,
    invalidEventCount,
    bindingMismatchCount,
    perScopeCounts,
    payloadHashMatched,
    reasonCodes: Array.from(new Set(reasonCodes)),
    trustBoundary: 'trusted_exporter_attestation_required_outside_payload'
  };
}
