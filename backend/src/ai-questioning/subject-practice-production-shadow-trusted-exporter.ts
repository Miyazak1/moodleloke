import { createHash } from 'node:crypto';
import {
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION,
  SubjectPracticeProductionShadowEvidenceBatch,
  SubjectPracticeProductionShadowEvent,
  subjectPracticeProductionShadowPayloadSha256
} from './subject-practice-production-shadow-evidence-policy';
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
import { SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION } from './subject-practice-scenario-diversity-policy';
import { SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION } from './subject-practice-math-derivative-local-generator';

export const SUBJECT_PRACTICE_PRODUCTION_SHADOW_TRUSTED_EXPORTER_VERSION =
  'subject-practice-production-shadow-trusted-exporter-v9-math-derivative-triple-verified';

export type SubjectPracticeProductionShadowTrustedSnapshot = {
  source: {
    readModelVersion: 'subject-practice-production-shadow-read-model-v4';
    environment: 'production';
    table: 'csca_questions';
    transactionSnapshotId: string;
    candidatePersisted: true;
  };
  candidate: {
    id: number;
    occurredAt: string;
    content: {
      prompt: string;
      options: unknown;
      correctAnswer: string;
      explanation: string;
      localizations?: unknown;
    };
  };
  binding: {
    subject: SubjectPracticeProductionShadowEvent['subject'];
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
  };
  verification: {
    deterministicStatus: SubjectPracticeProductionShadowEvent['deterministicStatus'];
    explanationStatus: SubjectPracticeProductionShadowEvent['explanationStatus'];
    oracleStatus: SubjectPracticeProductionShadowEvent['oracleStatus'];
    questionPlanAdherent: boolean;
    validatorBlockingFree: boolean;
    wouldPublish: boolean;
    publicationSuppressed: true;
    publicationAttempted: false;
    reasonCodes: string[];
    candidateLeakage: {
      policyVersion: string;
      status: SubjectPracticeProductionShadowEvent['candidateLeakageStatus'];
      scannedRevisionCount: number;
      blockedRevisionCount: number;
      ambiguousRevisionCount: number;
      revisionMatchSetSha256: string;
      revisionMatchDigestVersion: string;
      structuredCorpusSchemaVersion: string;
      normalizationVersion: string;
      sourceCorpusSnapshotSha256: string;
      sourceCorpusSnapshotVersion: string;
      sourceCorpusRevisionCount: number;
      sourceCorpusInventoryComplete: true;
      sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot';
      failClosed: true;
      sourceContentExposedToGenerator: false;
    };
    scenario: {
      policyVersion: string;
      status: SubjectPracticeProductionShadowEvent['scenarioStatus'];
      scenarioMode: string;
      scenarioFamilyId: string;
      scenarioDomain: string;
      scenarioEntity: string;
      scenarioAction: string;
      informationForm: string;
      scenarioFingerprint: string;
      contextNecessity: string;
      contractValid: boolean;
      surfaceMatched: boolean;
      relationEvidenceMatched: boolean;
      contextNecessityVerified: boolean;
      physicalPlausibilityMatched: boolean;
      chemistryPlausibilityMatched: boolean;
      informationParticipationMatched: boolean;
      sourceContentExposedToGenerator: false;
      productionGateImpact: 'none_shadow_only';
    };
  };
};

export type SubjectPracticeProductionShadowPersistedQuestionReadModel = {
  id: number;
  subject: string;
  sourceType: string;
  prompt: string;
  options: unknown;
  correctAnswer: string;
  explanation: string;
  localizations?: unknown;
  createdAt: string | Date;
  generationMetadata: unknown;
  reviewMetadata: unknown;
  studentPublicationCount: number;
  publicationAttemptCount: number;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalJsonValue(value));
}

function localShadowGenerationStatusAccepted(input: {
  row: SubjectPracticeProductionShadowPersistedQuestionReadModel;
  generation: Record<string, unknown>;
  generationBundle: Record<string, unknown> | null;
  localShadowGeneration: Record<string, unknown> | null;
}) {
  const status = clean(input.localShadowGeneration?.status);
  if (status === 'generated_and_self_verified') return true;
  if (status !== 'generated_and_triple_verified') return false;

  const bundle = input.generationBundle;
  const questionPlan = recordFrom(input.generation.questionPlan);
  const renderConstraints = recordFrom(questionPlan?.renderConstraints);
  const solverEvidence = recordFrom(bundle?.solverEvidence);
  const explanationEvidence = recordFrom(bundle?.explanationEvidence);
  const oracleEvidence = recordFrom(bundle?.independentOracleEvidence);
  const exactScopeId = 'math-basic-derivative-v1:direct_polynomial_value';
  return clean(input.row.subject).toLowerCase() === 'math'
    && clean(bundle?.status) === 'verified'
    && clean(bundle?.subject).toLowerCase() === 'math'
    && clean(bundle?.taskFamily) === 'derivative_direct_evaluation'
    && clean(bundle?.planTemplate) === 'math_derivative_condition_chain_v1'
    && clean(bundle?.scopeId) === exactScopeId
    && clean(bundle?.plannedScopeId) === exactScopeId
    && bundle?.scopeMatchedAcrossVerifiers === true
    && clean(solverEvidence?.status) === 'verified'
    && clean(explanationEvidence?.status) === 'verified'
    && clean(oracleEvidence?.status) === 'verified'
    && clean(questionPlan?.subject).toLowerCase() === 'math'
    && clean(questionPlan?.taskFamily) === 'derivative_direct_evaluation'
    && clean(questionPlan?.planTemplate) === 'math_derivative_condition_chain_v1'
    && clean(questionPlan?.targetDifficulty).toLowerCase() === 'basic'
    && clean(renderConstraints?.exactDerivativeScope) === 'direct_polynomial_value'
    && clean(input.localShadowGeneration?.generatorVersion) === SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION;
}

export function subjectPracticeProductionShadowCandidateContentSha256(
  content: SubjectPracticeProductionShadowTrustedSnapshot['candidate']['content']
) {
  return sha256(JSON.stringify(canonicalJsonValue(content)));
}

export function subjectPracticeProductionShadowSnapshotFromPersistedQuestion(input: {
  row: SubjectPracticeProductionShadowPersistedQuestionReadModel;
  transactionSnapshotId: string;
}): SubjectPracticeProductionShadowTrustedSnapshot {
  const row = input.row;
  const generation = recordFrom(row.generationMetadata);
  const review = recordFrom(row.reviewMetadata);
  const generationBundle = recordFrom(generation?.formalVerificationBundle);
  const reviewBundle = recordFrom(review?.formalVerificationBundle);
  const sourceIsolation = recordFrom(generation?.sourceIsolationEvidence);
  const providerProjection = sourceIsolation?.providerProjection;
  const providerProjectionSha256 = sha256(stableJson(providerProjection));
  const localShadowGeneration = recordFrom(recordFrom(generation?.promptAudit)?.localShadowGeneration)
    ?? recordFrom(generation?.localShadowGeneration);
  const candidateLeakage = recordFrom(generation?.automatedCandidateLeakageGate);
  const scenario = recordFrom(generation?.scenarioEvidence)
    ?? recordFrom(localShadowGeneration?.scenarioEvidence);
  const reviewProvider = recordFrom(review?.provider);
  const gate = recordFrom(review?.gate);
  const issues = Array.isArray(review?.issues) ? review.issues.map(recordFrom).filter(Boolean) as Record<string, unknown>[] : [];
  if (!Number.isInteger(row.id) || row.id <= 0 || clean(row.sourceType) !== 'ai') {
    throw new Error('production_shadow_read_model_candidate_identity_invalid');
  }
  if (!generation || clean(generation.workClass) !== 'observation'
    || generation.suppressStudentPublication !== true
    || clean(generation.publicationPolicy) !== 'observation_gate_evidence_only_no_student_publication') {
    throw new Error('production_shadow_read_model_observation_boundary_invalid');
  }
  if (clean(generation.generator) !== 'local-deterministic'
    || clean(generation.reviewProviderMode) !== 'deterministic_only'
    || !localShadowGenerationStatusAccepted({ row, generation, generationBundle, localShadowGeneration })
    || Number(localShadowGeneration?.providerCallCount) !== 0
    || Number(localShadowGeneration?.estimatedCostUsd) !== 0) {
    throw new Error('production_shadow_read_model_zero_provider_route_invalid');
  }
  if (sourceIsolation?.policyVersion !== SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION
    || sourceIsolation.status !== 'enforced_structural_projection'
    || sourceIsolation.boundary !== SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY
    || sourceIsolation.allowedInput !== SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT
    || sourceIsolation.originalQuestionContentOmitted !== true
    || sourceIsolation.reversibleSourceFieldsOmitted !== true
    || sourceIsolation.developerUnseenRequired !== false
    || sourceIsolation.officialHoldoutRequiredForGeneratorIsolation !== false
    || sourceIsolation.sourceLinkageIdentifiersOmitted !== true
    || sourceIsolation.profileAggregationPolicyVersion !== SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION
    || Number(sourceIsolation.profileMinimumSampleSize) !== SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE
    || sourceIsolation.profileProjectionMode !== SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
    || sourceIsolation.providerProjectionReplayable !== true
    || !['passed', 'no_known_source_fields_present'].includes(clean(sourceIsolation.knownSourceCorpusComparisonStatus))
    || Number(sourceIsolation.knownSourceLeakMatchCount) !== 0
    || !Array.isArray(providerProjection)
    || providerProjection.length !== 2
    || !/^[a-f0-9]{64}$/.test(clean(sourceIsolation.providerProjectionSha256))
    || providerProjectionSha256 !== clean(sourceIsolation.providerProjectionSha256)) {
    throw new Error('production_shadow_read_model_source_isolation_missing');
  }
  if (!generationBundle || !reviewBundle || stableJson(generationBundle) !== stableJson(reviewBundle)) {
    throw new Error('production_shadow_read_model_formal_bundle_mismatch');
  }
  if (candidateLeakage?.policyVersion !== SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION
    || !['clear', 'blocked', 'ambiguous', 'missing_corpus'].includes(clean(candidateLeakage.status))
    || !Number.isInteger(Number(candidateLeakage.scannedRevisionCount))
    || Number(candidateLeakage.scannedRevisionCount) < 0
    || !Number.isInteger(Number(candidateLeakage.blockedRevisionCount))
    || Number(candidateLeakage.blockedRevisionCount) < 0
    || !Number.isInteger(Number(candidateLeakage.ambiguousRevisionCount))
    || Number(candidateLeakage.ambiguousRevisionCount) < 0
    || !/^[a-f0-9]{64}$/.test(clean(candidateLeakage.revisionMatchSetSha256))
    || candidateLeakage.revisionMatchDigestVersion !== SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION
    || candidateLeakage.structuredCorpusSchemaVersion !== SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
    || candidateLeakage.normalizationVersion !== SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
    || !/^[a-f0-9]{64}$/.test(clean(candidateLeakage.sourceCorpusSnapshotSha256))
    || candidateLeakage.sourceCorpusSnapshotVersion !== SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION
    || !Number.isInteger(Number(candidateLeakage.sourceCorpusRevisionCount))
    || Number(candidateLeakage.sourceCorpusRevisionCount) <= 0
    || Number(candidateLeakage.sourceCorpusRevisionCount) !== Number(candidateLeakage.scannedRevisionCount)
    || candidateLeakage.sourceCorpusInventoryComplete !== true
    || candidateLeakage.sourceCorpusInventoryMode !== 'all_active_subject_source_questions_at_statement_snapshot'
    || candidateLeakage.failClosed !== true
    || candidateLeakage.sourceContentExposedToGenerator !== false) {
    throw new Error('production_shadow_read_model_candidate_leakage_evidence_missing');
  }
  if (scenario?.policyVersion !== SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION
    || !['consistent', 'inconsistent'].includes(clean(scenario.status))
    || !clean(scenario.scenarioMode)
    || !clean(scenario.scenarioFamilyId)
    || !clean(scenario.scenarioDomain)
    || !clean(scenario.scenarioEntity)
    || !clean(scenario.scenarioAction)
    || !clean(scenario.informationForm)
    || !/^scenario-[a-f0-9]{20}$/.test(clean(scenario.scenarioFingerprint))
    || !clean(scenario.contextNecessity)
    || typeof scenario.contractValid !== 'boolean'
    || typeof scenario.surfaceMatched !== 'boolean'
    || typeof scenario.relationEvidenceMatched !== 'boolean'
    || typeof scenario.contextNecessityVerified !== 'boolean'
    || typeof scenario.physicalPlausibilityMatched !== 'boolean'
    || typeof scenario.chemistryPlausibilityMatched !== 'boolean'
    || typeof scenario.informationParticipationMatched !== 'boolean'
    || scenario.sourceContentExposedToGenerator !== false
    || scenario.productionGateImpact !== 'none_shadow_only') {
    throw new Error('production_shadow_read_model_scenario_evidence_missing');
  }
  if (!['verified', 'conflict', 'unparsed'].includes(clean(generationBundle.status))) {
    throw new Error('production_shadow_read_model_formal_bundle_status_invalid');
  }
  if (clean(reviewProvider?.provider) !== 'deterministic'
    || clean(reviewProvider?.status) !== 'skipped'
    || !Array.isArray(review?.sources)
    || review.sources.length !== 1
    || review.sources[0] !== 'deterministic') {
    throw new Error('production_shadow_read_model_reviewer_not_zero_provider');
  }
  if (!Number.isInteger(row.studentPublicationCount) || row.studentPublicationCount !== 0
    || !Number.isInteger(row.publicationAttemptCount) || row.publicationAttemptCount !== 0) {
    throw new Error('production_shadow_read_model_publication_suppression_not_proven');
  }
  const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : clean(row.createdAt);
  const blockingIssueCodes = issues
    .filter((issue) => clean(issue.severity) === 'error')
    .map((issue) => clean(issue.code))
    .filter(Boolean);
  const reasonCodes = Array.from(new Set([
    ...stringArray(generationBundle.reasonCodes),
    ...stringArray(gate?.reasons),
    ...blockingIssueCodes
  ])).sort();
  const explanationEvidence = recordFrom(generationBundle.explanationEvidence);
  const oracleEvidence = recordFrom(generationBundle.independentOracleEvidence);
  return {
    source: {
      readModelVersion: 'subject-practice-production-shadow-read-model-v4',
      environment: 'production',
      table: 'csca_questions',
      transactionSnapshotId: clean(input.transactionSnapshotId),
      candidatePersisted: true
    },
    candidate: {
      id: row.id,
      occurredAt: createdAt,
      content: {
        prompt: row.prompt,
        options: row.options,
        correctAnswer: row.correctAnswer,
        explanation: row.explanation,
        localizations: row.localizations
      }
    },
    binding: {
      subject: clean(row.subject).toLowerCase() as SubjectPracticeProductionShadowEvent['subject'],
      taskFamily: clean(generationBundle.taskFamily),
      planTemplate: clean(generationBundle.planTemplate),
      questionPlanPolicyVersion: clean(recordFrom(generation?.questionPlan)?.policyVersion),
      scopeId: clean(generationBundle.scopeId || generationBundle.plannedScopeId) || 'unresolved_scope',
      verificationScopeVersion: clean(recordFrom(recordFrom(generationBundle.solverEvidence)?.verificationScope)?.scopeVersion),
      generatorVersion: clean(localShadowGeneration?.generatorVersion || generation.model),
      solverVersion: clean(generationBundle.solverVersion),
      explanationVerifierVersion: clean(explanationEvidence?.verifierVersion || generationBundle.explanationVerifierVersion),
      independentOracleVersion: clean(oracleEvidence?.oracleVersion || generationBundle.independentOracleVersion),
      sourceIsolationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
      sourceIsolationBoundary: clean(sourceIsolation.boundary),
      sourceIsolationAllowedInput: clean(sourceIsolation.allowedInput),
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
      sourceIsolationProviderProjectionSha256: providerProjectionSha256,
      formalVerificationOrchestratorVersion: clean(generationBundle.orchestratorVersion),
      localShadowRoutingVersion: clean(localShadowGeneration?.routingVersion)
    },
    verification: {
      deterministicStatus: clean(recordFrom(generationBundle.solverEvidence)?.status) as SubjectPracticeProductionShadowEvent['deterministicStatus'],
      explanationStatus: clean(explanationEvidence?.status) as SubjectPracticeProductionShadowEvent['explanationStatus'],
      oracleStatus: clean(oracleEvidence?.status) as SubjectPracticeProductionShadowEvent['oracleStatus'],
      questionPlanAdherent: recordFrom(generation?.questionPlanAdherence)?.adheres === true,
      validatorBlockingFree: blockingIssueCodes.length === 0,
      wouldPublish: gate?.publishable === true && reasonCodes.length === 0,
      publicationSuppressed: true,
      publicationAttempted: false,
      reasonCodes,
      candidateLeakage: {
        policyVersion: clean(candidateLeakage.policyVersion),
        status: clean(candidateLeakage.status) as SubjectPracticeProductionShadowEvent['candidateLeakageStatus'],
        scannedRevisionCount: Number(candidateLeakage.scannedRevisionCount),
        blockedRevisionCount: Number(candidateLeakage.blockedRevisionCount),
        ambiguousRevisionCount: Number(candidateLeakage.ambiguousRevisionCount),
        revisionMatchSetSha256: clean(candidateLeakage.revisionMatchSetSha256),
        revisionMatchDigestVersion: clean(candidateLeakage.revisionMatchDigestVersion),
        structuredCorpusSchemaVersion: clean(candidateLeakage.structuredCorpusSchemaVersion),
        normalizationVersion: clean(candidateLeakage.normalizationVersion),
        sourceCorpusSnapshotSha256: clean(candidateLeakage.sourceCorpusSnapshotSha256),
        sourceCorpusSnapshotVersion: clean(candidateLeakage.sourceCorpusSnapshotVersion),
        sourceCorpusRevisionCount: Number(candidateLeakage.sourceCorpusRevisionCount),
        sourceCorpusInventoryComplete: true,
        sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
        failClosed: true,
        sourceContentExposedToGenerator: false
      },
      scenario: {
        policyVersion: clean(scenario.policyVersion),
        status: clean(scenario.status) as SubjectPracticeProductionShadowEvent['scenarioStatus'],
        scenarioMode: clean(scenario.scenarioMode),
        scenarioFamilyId: clean(scenario.scenarioFamilyId),
        scenarioDomain: clean(scenario.scenarioDomain),
        scenarioEntity: clean(scenario.scenarioEntity),
        scenarioAction: clean(scenario.scenarioAction),
        informationForm: clean(scenario.informationForm),
        scenarioFingerprint: clean(scenario.scenarioFingerprint),
        contextNecessity: clean(scenario.contextNecessity),
        contractValid: scenario.contractValid === true,
        surfaceMatched: scenario.surfaceMatched === true,
        relationEvidenceMatched: scenario.relationEvidenceMatched === true,
        contextNecessityVerified: scenario.contextNecessityVerified === true,
        physicalPlausibilityMatched: scenario.physicalPlausibilityMatched === true,
        chemistryPlausibilityMatched: scenario.chemistryPlausibilityMatched === true,
        informationParticipationMatched: scenario.informationParticipationMatched === true,
        sourceContentExposedToGenerator: false,
        productionGateImpact: 'none_shadow_only'
      }
    }
  };
}

function assertSnapshot(snapshot: SubjectPracticeProductionShadowTrustedSnapshot) {
  if (snapshot.source?.readModelVersion !== 'subject-practice-production-shadow-read-model-v4'
    || snapshot.source.environment !== 'production'
    || snapshot.source.table !== 'csca_questions'
    || snapshot.source.candidatePersisted !== true
    || !clean(snapshot.source.transactionSnapshotId)) {
    throw new Error('production_shadow_snapshot_source_not_trusted');
  }
  if (!Number.isInteger(snapshot.candidate?.id) || snapshot.candidate.id <= 0) {
    throw new Error('production_shadow_snapshot_candidate_id_invalid');
  }
  if (!clean(snapshot.candidate.content?.prompt)
    || !clean(snapshot.candidate.content?.correctAnswer)
    || !clean(snapshot.candidate.content?.explanation)
    || !snapshot.candidate.content?.options) {
    throw new Error('production_shadow_snapshot_candidate_content_invalid');
  }
  const occurredAt = clean(snapshot.candidate.occurredAt);
  if (!occurredAt || !Number.isFinite(Date.parse(occurredAt)) || new Date(occurredAt).toISOString() !== occurredAt) {
    throw new Error('production_shadow_snapshot_occurred_at_invalid');
  }
  if (!clean(snapshot.binding?.taskFamily)
    || !clean(snapshot.binding?.planTemplate)
    || !clean(snapshot.binding?.questionPlanPolicyVersion)
    || !clean(snapshot.binding?.scopeId)
    || !clean(snapshot.binding?.verificationScopeVersion)
    || !clean(snapshot.binding?.generatorVersion)
    || !clean(snapshot.binding?.solverVersion)
    || !clean(snapshot.binding?.explanationVerifierVersion)
    || !clean(snapshot.binding?.independentOracleVersion)
    || snapshot.binding?.sourceIsolationPolicyVersion !== SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION
    || snapshot.binding?.sourceIsolationBoundary !== SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY
    || snapshot.binding?.sourceIsolationAllowedInput !== SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT
    || snapshot.binding?.sourceIsolationOriginalQuestionContentOmitted !== true
    || snapshot.binding?.sourceIsolationReversibleSourceFieldsOmitted !== true
    || snapshot.binding?.sourceIsolationDeveloperUnseenRequired !== false
    || snapshot.binding?.sourceIsolationOfficialHoldoutRequired !== false
    || snapshot.binding?.sourceIsolationSourceLinkageIdentifiersOmitted !== true
    || snapshot.binding?.sourceIsolationProfileAggregationPolicyVersion !== SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION
    || snapshot.binding?.sourceIsolationProfileMinimumSampleSize !== SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE
    || snapshot.binding?.sourceIsolationProfileProjectionMode !== SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
    || snapshot.binding?.sourceIsolationProjectionHashRecomputed !== true
    || snapshot.binding?.sourceIsolationKnownSourceCorpusComparisonPassed !== true
    || snapshot.binding?.sourceIsolationKnownSourceLeakMatchCount !== 0
    || !/^[a-f0-9]{64}$/.test(clean(snapshot.binding?.sourceIsolationProviderProjectionSha256))
    || !clean(snapshot.binding?.formalVerificationOrchestratorVersion)
    || !clean(snapshot.binding?.localShadowRoutingVersion)) {
    throw new Error('production_shadow_snapshot_binding_invalid');
  }
  if (snapshot.verification?.publicationSuppressed !== true
    || snapshot.verification?.publicationAttempted !== false
    || !Array.isArray(snapshot.verification?.reasonCodes)
    || snapshot.verification?.candidateLeakage?.policyVersion !== SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION
    || !['clear', 'blocked', 'ambiguous', 'missing_corpus'].includes(snapshot.verification?.candidateLeakage?.status)
    || !Number.isInteger(snapshot.verification?.candidateLeakage?.scannedRevisionCount)
    || snapshot.verification.candidateLeakage.scannedRevisionCount < 0
    || !Number.isInteger(snapshot.verification?.candidateLeakage?.blockedRevisionCount)
    || snapshot.verification.candidateLeakage.blockedRevisionCount < 0
    || !Number.isInteger(snapshot.verification?.candidateLeakage?.ambiguousRevisionCount)
    || snapshot.verification.candidateLeakage.ambiguousRevisionCount < 0
    || !/^[a-f0-9]{64}$/.test(clean(snapshot.verification?.candidateLeakage?.revisionMatchSetSha256))
    || snapshot.verification?.candidateLeakage?.revisionMatchDigestVersion !== SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION
    || snapshot.verification?.candidateLeakage?.structuredCorpusSchemaVersion !== SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
    || snapshot.verification?.candidateLeakage?.normalizationVersion !== SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
    || !/^[a-f0-9]{64}$/.test(clean(snapshot.verification?.candidateLeakage?.sourceCorpusSnapshotSha256))
    || snapshot.verification?.candidateLeakage?.sourceCorpusSnapshotVersion !== SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION
    || !Number.isInteger(snapshot.verification?.candidateLeakage?.sourceCorpusRevisionCount)
    || snapshot.verification.candidateLeakage.sourceCorpusRevisionCount <= 0
    || snapshot.verification.candidateLeakage.sourceCorpusRevisionCount !== snapshot.verification.candidateLeakage.scannedRevisionCount
    || snapshot.verification?.candidateLeakage?.sourceCorpusInventoryComplete !== true
    || snapshot.verification?.candidateLeakage?.sourceCorpusInventoryMode !== 'all_active_subject_source_questions_at_statement_snapshot'
    || snapshot.verification?.candidateLeakage?.failClosed !== true
    || snapshot.verification?.candidateLeakage?.sourceContentExposedToGenerator !== false) {
    throw new Error('production_shadow_snapshot_publication_boundary_invalid');
  }
  if (snapshot.verification?.scenario?.policyVersion !== SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION
    || !['consistent', 'inconsistent'].includes(snapshot.verification?.scenario?.status)
    || !clean(snapshot.verification?.scenario?.scenarioMode)
    || !clean(snapshot.verification?.scenario?.scenarioFamilyId)
    || !clean(snapshot.verification?.scenario?.scenarioDomain)
    || !clean(snapshot.verification?.scenario?.scenarioEntity)
    || !clean(snapshot.verification?.scenario?.scenarioAction)
    || !clean(snapshot.verification?.scenario?.informationForm)
    || !/^scenario-[a-f0-9]{20}$/.test(clean(snapshot.verification?.scenario?.scenarioFingerprint))
    || !clean(snapshot.verification?.scenario?.contextNecessity)
    || typeof snapshot.verification?.scenario?.contractValid !== 'boolean'
    || typeof snapshot.verification?.scenario?.surfaceMatched !== 'boolean'
    || typeof snapshot.verification?.scenario?.relationEvidenceMatched !== 'boolean'
    || typeof snapshot.verification?.scenario?.contextNecessityVerified !== 'boolean'
    || typeof snapshot.verification?.scenario?.physicalPlausibilityMatched !== 'boolean'
    || typeof snapshot.verification?.scenario?.chemistryPlausibilityMatched !== 'boolean'
    || typeof snapshot.verification?.scenario?.informationParticipationMatched !== 'boolean'
    || snapshot.verification?.scenario?.sourceContentExposedToGenerator !== false
    || snapshot.verification?.scenario?.productionGateImpact !== 'none_shadow_only') {
    throw new Error('production_shadow_snapshot_scenario_evidence_invalid');
  }
}

function eventFromSnapshot(snapshot: SubjectPracticeProductionShadowTrustedSnapshot): SubjectPracticeProductionShadowEvent {
  assertSnapshot(snapshot);
  const candidateContentSha256 = subjectPracticeProductionShadowCandidateContentSha256(snapshot.candidate.content);
  const eventIdentity = {
    exporterVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_TRUSTED_EXPORTER_VERSION,
    transactionSnapshotId: clean(snapshot.source.transactionSnapshotId),
    candidateId: snapshot.candidate.id,
    candidateContentSha256,
    candidateLeakagePolicyVersion: snapshot.verification.candidateLeakage.policyVersion,
    candidateLeakageStatus: snapshot.verification.candidateLeakage.status,
    candidateLeakageScannedRevisionCount: snapshot.verification.candidateLeakage.scannedRevisionCount,
    candidateLeakageBlockedRevisionCount: snapshot.verification.candidateLeakage.blockedRevisionCount,
    candidateLeakageAmbiguousRevisionCount: snapshot.verification.candidateLeakage.ambiguousRevisionCount,
    candidateLeakageRevisionMatchSetSha256: snapshot.verification.candidateLeakage.revisionMatchSetSha256,
    candidateLeakageRevisionMatchDigestVersion: snapshot.verification.candidateLeakage.revisionMatchDigestVersion,
    candidateLeakageStructuredCorpusSchemaVersion: snapshot.verification.candidateLeakage.structuredCorpusSchemaVersion,
    candidateLeakageNormalizationVersion: snapshot.verification.candidateLeakage.normalizationVersion,
    candidateLeakageSourceCorpusSnapshotSha256: snapshot.verification.candidateLeakage.sourceCorpusSnapshotSha256,
    candidateLeakageSourceCorpusSnapshotVersion: snapshot.verification.candidateLeakage.sourceCorpusSnapshotVersion,
    candidateLeakageSourceCorpusRevisionCount: snapshot.verification.candidateLeakage.sourceCorpusRevisionCount,
    candidateLeakageSourceCorpusInventoryComplete: true,
    candidateLeakageSourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
    candidateLeakageFailClosed: true,
    candidateLeakageSourceContentExposedToGenerator: false,
    scenarioPolicyVersion: snapshot.verification.scenario.policyVersion,
    scenarioStatus: snapshot.verification.scenario.status,
    scenarioMode: snapshot.verification.scenario.scenarioMode,
    scenarioFamilyId: snapshot.verification.scenario.scenarioFamilyId,
    scenarioDomain: snapshot.verification.scenario.scenarioDomain,
    scenarioEntity: snapshot.verification.scenario.scenarioEntity,
    scenarioAction: snapshot.verification.scenario.scenarioAction,
    scenarioInformationForm: snapshot.verification.scenario.informationForm,
    scenarioFingerprint: snapshot.verification.scenario.scenarioFingerprint,
    scenarioContextNecessity: snapshot.verification.scenario.contextNecessity,
    scenarioContractValid: snapshot.verification.scenario.contractValid,
    scenarioSurfaceMatched: snapshot.verification.scenario.surfaceMatched,
    scenarioRelationEvidenceMatched: snapshot.verification.scenario.relationEvidenceMatched,
    scenarioContextNecessityVerified: snapshot.verification.scenario.contextNecessityVerified,
    scenarioPhysicalPlausibilityMatched: snapshot.verification.scenario.physicalPlausibilityMatched,
    scenarioChemistryPlausibilityMatched: snapshot.verification.scenario.chemistryPlausibilityMatched,
    scenarioInformationParticipationMatched: snapshot.verification.scenario.informationParticipationMatched,
    scenarioSourceContentExposedToGenerator: false,
    scenarioProductionGateImpact: 'none_shadow_only',
    occurredAt: snapshot.candidate.occurredAt
  };
  return {
    eventId: `prod-shadow-${sha256(JSON.stringify(eventIdentity))}`,
    occurredAt: snapshot.candidate.occurredAt,
    environment: 'production',
    candidateId: snapshot.candidate.id,
    candidateContentSha256,
    candidateLeakagePolicyVersion: snapshot.verification.candidateLeakage.policyVersion,
    candidateLeakageStatus: snapshot.verification.candidateLeakage.status,
    candidateLeakageScannedRevisionCount: snapshot.verification.candidateLeakage.scannedRevisionCount,
    candidateLeakageBlockedRevisionCount: snapshot.verification.candidateLeakage.blockedRevisionCount,
    candidateLeakageAmbiguousRevisionCount: snapshot.verification.candidateLeakage.ambiguousRevisionCount,
    candidateLeakageRevisionMatchSetSha256: snapshot.verification.candidateLeakage.revisionMatchSetSha256,
    candidateLeakageRevisionMatchDigestVersion: snapshot.verification.candidateLeakage.revisionMatchDigestVersion,
    candidateLeakageStructuredCorpusSchemaVersion: snapshot.verification.candidateLeakage.structuredCorpusSchemaVersion,
    candidateLeakageNormalizationVersion: snapshot.verification.candidateLeakage.normalizationVersion,
    candidateLeakageSourceCorpusSnapshotSha256: snapshot.verification.candidateLeakage.sourceCorpusSnapshotSha256,
    candidateLeakageSourceCorpusSnapshotVersion: snapshot.verification.candidateLeakage.sourceCorpusSnapshotVersion,
    candidateLeakageSourceCorpusRevisionCount: snapshot.verification.candidateLeakage.sourceCorpusRevisionCount,
    candidateLeakageSourceCorpusInventoryComplete: true,
    candidateLeakageSourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
    candidateLeakageFailClosed: true,
    candidateLeakageSourceContentExposedToGenerator: false,
    scenarioPolicyVersion: snapshot.verification.scenario.policyVersion,
    scenarioStatus: snapshot.verification.scenario.status,
    scenarioMode: snapshot.verification.scenario.scenarioMode,
    scenarioFamilyId: snapshot.verification.scenario.scenarioFamilyId,
    scenarioDomain: snapshot.verification.scenario.scenarioDomain,
    scenarioEntity: snapshot.verification.scenario.scenarioEntity,
    scenarioAction: snapshot.verification.scenario.scenarioAction,
    scenarioInformationForm: snapshot.verification.scenario.informationForm,
    scenarioFingerprint: snapshot.verification.scenario.scenarioFingerprint,
    scenarioContextNecessity: snapshot.verification.scenario.contextNecessity,
    scenarioContractValid: snapshot.verification.scenario.contractValid,
    scenarioSurfaceMatched: snapshot.verification.scenario.surfaceMatched,
    scenarioRelationEvidenceMatched: snapshot.verification.scenario.relationEvidenceMatched,
    scenarioContextNecessityVerified: snapshot.verification.scenario.contextNecessityVerified,
    scenarioPhysicalPlausibilityMatched: snapshot.verification.scenario.physicalPlausibilityMatched,
    scenarioChemistryPlausibilityMatched: snapshot.verification.scenario.chemistryPlausibilityMatched,
    scenarioInformationParticipationMatched: snapshot.verification.scenario.informationParticipationMatched,
    scenarioSourceContentExposedToGenerator: false,
    scenarioProductionGateImpact: 'none_shadow_only',
    subject: snapshot.binding.subject,
    taskFamily: clean(snapshot.binding.taskFamily),
    planTemplate: clean(snapshot.binding.planTemplate),
    questionPlanPolicyVersion: clean(snapshot.binding.questionPlanPolicyVersion),
    scopeId: clean(snapshot.binding.scopeId),
    verificationScopeVersion: clean(snapshot.binding.verificationScopeVersion),
    generatorVersion: clean(snapshot.binding.generatorVersion),
    solverVersion: clean(snapshot.binding.solverVersion),
    explanationVerifierVersion: clean(snapshot.binding.explanationVerifierVersion),
    independentOracleVersion: clean(snapshot.binding.independentOracleVersion),
    sourceIsolationPolicyVersion: snapshot.binding.sourceIsolationPolicyVersion,
    sourceIsolationBoundary: snapshot.binding.sourceIsolationBoundary,
    sourceIsolationAllowedInput: snapshot.binding.sourceIsolationAllowedInput,
    sourceIsolationOriginalQuestionContentOmitted: snapshot.binding.sourceIsolationOriginalQuestionContentOmitted,
    sourceIsolationReversibleSourceFieldsOmitted: snapshot.binding.sourceIsolationReversibleSourceFieldsOmitted,
    sourceIsolationDeveloperUnseenRequired: snapshot.binding.sourceIsolationDeveloperUnseenRequired,
    sourceIsolationOfficialHoldoutRequired: snapshot.binding.sourceIsolationOfficialHoldoutRequired,
    sourceIsolationSourceLinkageIdentifiersOmitted: snapshot.binding.sourceIsolationSourceLinkageIdentifiersOmitted,
    sourceIsolationProfileAggregationPolicyVersion: snapshot.binding.sourceIsolationProfileAggregationPolicyVersion,
    sourceIsolationProfileMinimumSampleSize: snapshot.binding.sourceIsolationProfileMinimumSampleSize,
    sourceIsolationProfileProjectionMode: snapshot.binding.sourceIsolationProfileProjectionMode,
    sourceIsolationProjectionHashRecomputed: snapshot.binding.sourceIsolationProjectionHashRecomputed,
    sourceIsolationKnownSourceCorpusComparisonPassed: snapshot.binding.sourceIsolationKnownSourceCorpusComparisonPassed,
    sourceIsolationKnownSourceLeakMatchCount: snapshot.binding.sourceIsolationKnownSourceLeakMatchCount,
    sourceIsolationProviderProjectionSha256: snapshot.binding.sourceIsolationProviderProjectionSha256,
    formalVerificationOrchestratorVersion: clean(snapshot.binding.formalVerificationOrchestratorVersion),
    localShadowRoutingVersion: clean(snapshot.binding.localShadowRoutingVersion),
    deterministicStatus: snapshot.verification.deterministicStatus,
    explanationStatus: snapshot.verification.explanationStatus,
    oracleStatus: snapshot.verification.oracleStatus,
    questionPlanAdherent: snapshot.verification.questionPlanAdherent,
    validatorBlockingFree: snapshot.verification.validatorBlockingFree,
    wouldPublish: snapshot.verification.wouldPublish,
    publicationSuppressed: true,
    publicationAttempted: false,
    reasonCodes: Array.from(new Set(snapshot.verification.reasonCodes.map(clean).filter(Boolean))).sort()
  };
}

export function buildSubjectPracticeProductionShadowEvidenceBatch(input: {
  batchId: string;
  generatedAt: string;
  snapshots: SubjectPracticeProductionShadowTrustedSnapshot[];
}): SubjectPracticeProductionShadowEvidenceBatch {
  const batchId = clean(input.batchId);
  const generatedAt = clean(input.generatedAt);
  if (!batchId) throw new Error('production_shadow_batch_id_missing');
  if (!generatedAt || !Number.isFinite(Date.parse(generatedAt)) || new Date(generatedAt).toISOString() !== generatedAt) {
    throw new Error('production_shadow_batch_generated_at_invalid');
  }
  if (!Array.isArray(input.snapshots) || input.snapshots.length === 0) {
    throw new Error('production_shadow_batch_snapshots_missing');
  }
  const events = input.snapshots.map(eventFromSnapshot);
  if (new Set(events.map((event) => event.eventId)).size !== events.length
    || new Set(events.map((event) => event.candidateId)).size !== events.length) {
    throw new Error('production_shadow_batch_duplicate_candidate');
  }
  const payload = {
    schemaVersion: 'subject-practice-production-shadow-evidence-batch-v9' as const,
    protocolVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_EVIDENCE_PROTOCOL_VERSION,
    batchId,
    generatedAt,
    captureMode: 'publication_suppressed' as const,
    events
  };
  return { ...payload, payloadSha256: subjectPracticeProductionShadowPayloadSha256(payload) };
}
