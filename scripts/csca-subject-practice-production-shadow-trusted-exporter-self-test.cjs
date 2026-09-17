#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  createSubjectPracticeProductionShadowExporterAttestation,
  scoreSubjectPracticeProductionShadowEvidence,
  verifySubjectPracticeProductionShadowExporterAttestation
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-evidence-policy');
const {
  SUBJECT_PRACTICE_PRODUCTION_SHADOW_TRUSTED_EXPORTER_VERSION,
  buildSubjectPracticeProductionShadowEvidenceBatch,
  subjectPracticeProductionShadowCandidateContentSha256,
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion
} = require('../backend/src/ai-questioning/subject-practice-production-shadow-trusted-exporter');
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
const {
  SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-local-generator');
const crypto = require('node:crypto');

function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

function sha256Canonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalJsonValue(value))).digest('hex');
}

const secret = 'fixture-only-shadow-attestation-secret-0001';
const wrongSecret = 'fixture-only-shadow-attestation-secret-wrong';
const expectedScopeIds = ['scope:a', 'scope:b'];
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

function snapshot(index) {
  return {
    source: {
      readModelVersion: 'subject-practice-production-shadow-read-model-v4',
      environment: 'production',
      table: 'csca_questions',
      transactionSnapshotId: 'fixture-transaction-snapshot-1',
      candidatePersisted: true
    },
    candidate: {
      id: index + 1,
      occurredAt: new Date(Date.UTC(2026, 8, 13, 1, index, 0)).toISOString(),
      content: {
        prompt: `Question ${index + 1}`,
        options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }],
        correctAnswer: 'A',
        explanation: 'Verified explanation.',
        localizations: { zh: { prompt: `题目 ${index + 1}` } }
      }
    },
    binding: {
      ...expectedBinding,
      scopeId: expectedScopeIds[index % 2],
      sourceIsolationProviderProjectionSha256: crypto.createHash('sha256').update(`projection-${index}`).digest('hex')
    },
    verification: {
      deterministicStatus: 'verified',
      explanationStatus: 'verified',
      oracleStatus: 'verified',
      questionPlanAdherent: true,
      validatorBlockingFree: true,
      wouldPublish: true,
      publicationSuppressed: true,
      publicationAttempted: false,
      reasonCodes: [],
      candidateLeakage: {
        policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
        status: 'clear',
        scannedRevisionCount: 100,
        blockedRevisionCount: 0,
        ambiguousRevisionCount: 0,
        revisionMatchSetSha256: crypto.createHash('sha256').update(`matches-${index}`).digest('hex'),
        revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
        structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
        normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
        sourceCorpusSnapshotSha256: crypto.createHash('sha256').update('source-corpus').digest('hex'),
        sourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
        sourceCorpusRevisionCount: 100,
        sourceCorpusInventoryComplete: true,
        sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
        failClosed: true,
        sourceContentExposedToGenerator: false
      },
      scenario: {
        policyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
        status: 'consistent',
        scenarioMode: 'abstract',
        scenarioFamilyId: 'math_abstract_function_object',
        scenarioDomain: 'pure_mathematics',
        scenarioEntity: 'function_object',
        scenarioAction: 'logarithmic:domain',
        informationForm: 'symbolic_text',
        scenarioFingerprint: `scenario-${crypto.createHash('sha256').update(`scenario-${index}`).digest('hex').slice(0, 20)}`,
        contextNecessity: 'not_applicable',
        contractValid: true,
        surfaceMatched: true,
        relationEvidenceMatched: true,
        contextNecessityVerified: true,
        physicalPlausibilityMatched: true,
        chemistryPlausibilityMatched: true,
        informationParticipationMatched: true,
        sourceContentExposedToGenerator: false,
        productionGateImpact: 'none_shadow_only'
      }
    }
  };
}

const snapshots = Array.from({ length: 200 }, (_, index) => snapshot(index));
const batch = buildSubjectPracticeProductionShadowEvidenceBatch({
  batchId: 'fixture-trusted-exporter-batch-1',
  generatedAt: '2026-09-13T05:00:00.000Z',
  snapshots
});
const attestation = createSubjectPracticeProductionShadowExporterAttestation({
  batch,
  exporterId: SUBJECT_PRACTICE_PRODUCTION_SHADOW_TRUSTED_EXPORTER_VERSION,
  issuedAt: '2026-09-13T05:01:00.000Z',
  secret
});
const trustedProof = verifySubjectPracticeProductionShadowExporterAttestation({ batch, attestation, secret });
const trustedScore = scoreSubjectPracticeProductionShadowEvidence(batch, {
  expectedScopeIds,
  expectedBinding,
  trustedExporterProof: trustedProof ?? undefined
});
const wrongKeyProof = verifySubjectPracticeProductionShadowExporterAttestation({ batch, attestation, secret: wrongSecret });
const forgedPlainObjectScore = scoreSubjectPracticeProductionShadowEvidence(batch, {
  expectedScopeIds,
  expectedBinding,
  trustedExporterProof: {
    exporterId: attestation.exporterId,
    batchId: batch.batchId,
    payloadSha256: batch.payloadSha256,
    issuedAt: attestation.issuedAt
  }
});
const mutatedBatch = {
  ...batch,
  events: batch.events.map((event, index) => index === 0 ? { ...event, scopeId: 'scope:b' } : event)
};
const mutationProof = verifySubjectPracticeProductionShadowExporterAttestation({ batch: mutatedBatch, attestation, secret });
const reorderedContent = {
  explanation: snapshots[0].candidate.content.explanation,
  correctAnswer: snapshots[0].candidate.content.correctAnswer,
  options: snapshots[0].candidate.content.options,
  prompt: snapshots[0].candidate.content.prompt,
  localizations: snapshots[0].candidate.content.localizations
};
let untrustedSourceRejected = false;
try {
  buildSubjectPracticeProductionShadowEvidenceBatch({
    batchId: 'untrusted-source',
    generatedAt: '2026-09-13T05:00:00.000Z',
    snapshots: [{ ...snapshots[0], source: { ...snapshots[0].source, environment: 'staging' } }]
  });
} catch (error) {
  untrustedSourceRejected = String(error?.message).includes('source_not_trusted');
}
let duplicateCandidateRejected = false;
try {
  buildSubjectPracticeProductionShadowEvidenceBatch({
    batchId: 'duplicate-candidate',
    generatedAt: '2026-09-13T05:00:00.000Z',
    snapshots: [snapshots[0], snapshots[0]]
  });
} catch (error) {
  duplicateCandidateRejected = String(error?.message).includes('duplicate_candidate');
}
const persistedFormalBundle = {
  orchestratorVersion: 'subject-practice-formal-verification-orchestrator-v2',
  status: 'verified', subject: 'math', taskFamily: expectedBinding.taskFamily,
  planTemplate: expectedBinding.planTemplate, scopeId: 'scope:a', scopeMatchedAcrossVerifiers: true,
  plannedScopeId: 'scope:a', oracleScopeId: 'scope:a',
  solverVersion: expectedBinding.solverVersion,
  explanationVerifierVersion: expectedBinding.explanationVerifierVersion,
  independentOracleVersion: expectedBinding.independentOracleVersion,
  solverEvidence: { status: 'verified', verificationScope: { scopeVersion: expectedBinding.verificationScopeVersion } },
  explanationEvidence: { status: 'verified', verifierVersion: expectedBinding.explanationVerifierVersion },
  independentOracleEvidence: { status: 'verified', oracleVersion: expectedBinding.independentOracleVersion },
  reasonCodes: []
};
const persistedProviderProjection = [
  { role: 'system', content: 'Safe aggregate-only generator contract.' },
  { role: 'user', content: JSON.stringify({ subject: 'math', difficulty: 'basic' }) }
];
const persistedRow = {
  id: 9001, subject: 'math', sourceType: 'ai',
  prompt: snapshots[0].candidate.content.prompt,
  options: snapshots[0].candidate.content.options,
  correctAnswer: snapshots[0].candidate.content.correctAnswer,
  explanation: snapshots[0].candidate.content.explanation,
  localizations: snapshots[0].candidate.content.localizations,
  createdAt: snapshots[0].candidate.occurredAt,
  generationMetadata: {
    workClass: 'observation', suppressStudentPublication: true,
    publicationPolicy: 'observation_gate_evidence_only_no_student_publication',
    questionPlan: { policyVersion: expectedBinding.questionPlanPolicyVersion },
    generator: 'local-deterministic', model: expectedBinding.generatorVersion,
    reviewProviderMode: 'deterministic_only',
    sourceIsolationEvidence: {
      policyVersion: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
      status: 'enforced_structural_projection',
      boundary: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
      allowedInput: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
      originalQuestionContentOmitted: true,
      reversibleSourceFieldsOmitted: true,
      developerUnseenRequired: false,
      officialHoldoutRequiredForGeneratorIsolation: false,
      sourceLinkageIdentifiersOmitted: true,
      profileAggregationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
      profileMinimumSampleSize: SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
      profileProjectionMode: SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE,
      providerProjectionReplayable: true,
      knownSourceCorpusComparisonStatus: 'passed',
      knownSourceFragmentCount: 1,
      knownSourceLeakMatchCount: 0,
      providerProjection: persistedProviderProjection,
      providerProjectionSha256: sha256Canonical(persistedProviderProjection)
    },
    localShadowGeneration: {
      status: 'generated_and_self_verified', generatorVersion: expectedBinding.generatorVersion,
      routingVersion: expectedBinding.localShadowRoutingVersion,
      providerCallCount: 0, estimatedCostUsd: 0
    },
    questionPlanAdherence: { adheres: true },
    automatedCandidateLeakageGate: {
      policyVersion: SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
      status: 'clear',
      scannedRevisionCount: 100,
      blockedRevisionCount: 0,
      ambiguousRevisionCount: 0,
      revisionMatchSetSha256: crypto.createHash('sha256').update('persisted-matches').digest('hex'),
      revisionMatchDigestVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
      structuredCorpusSchemaVersion: SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION,
      normalizationVersion: SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION,
      sourceCorpusSnapshotSha256: crypto.createHash('sha256').update('persisted-source-corpus').digest('hex'),
      sourceCorpusSnapshotVersion: SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
      sourceCorpusRevisionCount: 100,
      sourceCorpusInventoryComplete: true,
      sourceCorpusInventoryMode: 'all_active_subject_source_questions_at_statement_snapshot',
      failClosed: true,
      sourceContentExposedToGenerator: false
    },
    scenarioEvidence: { ...snapshots[0].verification.scenario },
    formalVerificationBundle: persistedFormalBundle
  },
  reviewMetadata: {
    formalVerificationBundle: persistedFormalBundle,
    provider: { provider: 'deterministic', status: 'skipped' },
    sources: ['deterministic'], issues: [], gate: { publishable: true, reasons: [] }
  },
  studentPublicationCount: 0,
  publicationAttemptCount: 0
};
const mappedSnapshot = subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
  row: persistedRow,
  transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
});
const derivativeScopeId = 'math-basic-derivative-v1:direct_polynomial_value';
const derivativeFormalBundle = {
  ...persistedFormalBundle,
  subject: 'math',
  taskFamily: 'derivative_direct_evaluation',
  planTemplate: 'math_derivative_condition_chain_v1',
  scopeId: derivativeScopeId,
  plannedScopeId: derivativeScopeId,
  oracleScopeId: derivativeScopeId,
  scopeMatchedAcrossVerifiers: true
};
const derivativeGenerationMetadata = {
  ...persistedRow.generationMetadata,
  questionPlan: {
    ...persistedRow.generationMetadata.questionPlan,
    subject: 'math',
    taskFamily: 'derivative_direct_evaluation',
    planTemplate: 'math_derivative_condition_chain_v1',
    targetDifficulty: 'basic',
    renderConstraints: { exactDerivativeScope: 'direct_polynomial_value' }
  },
  model: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION,
  localShadowGeneration: {
    ...persistedRow.generationMetadata.localShadowGeneration,
    status: 'generated_and_triple_verified',
    generatorVersion: SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
  },
  formalVerificationBundle: derivativeFormalBundle
};
const derivativePersistedRow = {
  ...persistedRow,
  generationMetadata: derivativeGenerationMetadata,
  reviewMetadata: { ...persistedRow.reviewMetadata, formalVerificationBundle: derivativeFormalBundle }
};
const mappedDerivativeSnapshot = subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
  row: derivativePersistedRow,
  transactionSnapshotId: 'fixture-db-transaction-snapshot-derivative-1'
});
let tripleVerifiedWrongScopeRejected = false;
try {
  const wrongScopeBundle = {
    ...derivativeFormalBundle,
    scopeId: 'math-basic-derivative-v1:unsupported',
    plannedScopeId: 'math-basic-derivative-v1:unsupported'
  };
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...derivativePersistedRow,
      generationMetadata: { ...derivativeGenerationMetadata, formalVerificationBundle: wrongScopeBundle },
      reviewMetadata: { ...derivativePersistedRow.reviewMetadata, formalVerificationBundle: wrongScopeBundle }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-derivative-wrong-scope'
  });
} catch (error) {
  tripleVerifiedWrongScopeRejected = String(error?.message).includes('zero_provider_route_invalid');
}
let tripleVerifiedWrongGeneratorRejected = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...derivativePersistedRow,
      generationMetadata: {
        ...derivativeGenerationMetadata,
        localShadowGeneration: {
          ...derivativeGenerationMetadata.localShadowGeneration,
          generatorVersion: 'untrusted-derivative-generator'
        }
      }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-derivative-wrong-generator'
  });
} catch (error) {
  tripleVerifiedWrongGeneratorRejected = String(error?.message).includes('zero_provider_route_invalid');
}
const conflictFormalBundle = {
  ...persistedFormalBundle,
  status: 'conflict', scopeId: null, scopeMatchedAcrossVerifiers: false,
  solverEvidence: { ...persistedFormalBundle.solverEvidence, status: 'conflict' },
  independentOracleEvidence: { ...persistedFormalBundle.independentOracleEvidence, status: 'conflict' },
  reasonCodes: ['formal_verification_conflict']
};
const mappedConflictSnapshot = subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
  row: {
    ...persistedRow,
    generationMetadata: { ...persistedRow.generationMetadata, formalVerificationBundle: conflictFormalBundle },
    reviewMetadata: {
      ...persistedRow.reviewMetadata,
      formalVerificationBundle: conflictFormalBundle,
      gate: { publishable: false, reasons: ['formal_verification_conflict'] }
    }
  },
  transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
});
let publicationEvidenceRequired = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: { ...persistedRow, studentPublicationCount: 1 }, transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
  });
} catch (error) {
  publicationEvidenceRequired = String(error?.message).includes('publication_suppression_not_proven');
}
let duplicatedBundleMustMatch = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...persistedRow,
      reviewMetadata: { ...persistedRow.reviewMetadata, formalVerificationBundle: { ...persistedFormalBundle, status: 'conflict' } }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
  });
} catch (error) {
  duplicatedBundleMustMatch = String(error?.message).includes('formal_bundle_mismatch');
}
let paidReviewerRejected = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...persistedRow,
      reviewMetadata: { ...persistedRow.reviewMetadata, provider: { provider: 'deepseek', status: 'success' } }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
  });
} catch (error) {
  paidReviewerRejected = String(error?.message).includes('reviewer_not_zero_provider');
}
let incompleteGeneratorIsolationRejected = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...persistedRow,
      generationMetadata: {
        ...persistedRow.generationMetadata,
        sourceIsolationEvidence: {
          ...persistedRow.generationMetadata.sourceIsolationEvidence,
          providerProjectionSha256: null
        }
      }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
  });
} catch (error) {
  incompleteGeneratorIsolationRejected = String(error?.message).includes('source_isolation_missing');
}
let projectionHashMismatchRejected = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...persistedRow,
      generationMetadata: {
        ...persistedRow.generationMetadata,
        sourceIsolationEvidence: {
          ...persistedRow.generationMetadata.sourceIsolationEvidence,
          providerProjection: [
            ...persistedProviderProjection,
            { role: 'user', content: 'tampered after hashing' }
          ]
        }
      }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
  });
} catch (error) {
  projectionHashMismatchRejected = String(error?.message).includes('source_isolation_missing');
}
let missingCandidateLeakageEvidenceRejected = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...persistedRow,
      generationMetadata: { ...persistedRow.generationMetadata, automatedCandidateLeakageGate: null }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
  });
} catch (error) {
  missingCandidateLeakageEvidenceRejected = String(error?.message).includes('candidate_leakage_evidence_missing');
}
let incompleteCandidateCorpusSnapshotRejected = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...persistedRow,
      generationMetadata: {
        ...persistedRow.generationMetadata,
        automatedCandidateLeakageGate: {
          ...persistedRow.generationMetadata.automatedCandidateLeakageGate,
          sourceCorpusInventoryComplete: false
        }
      }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
  });
} catch (error) {
  incompleteCandidateCorpusSnapshotRejected = String(error?.message).includes('candidate_leakage_evidence_missing');
}
let missingScenarioEvidenceRejected = false;
try {
  subjectPracticeProductionShadowSnapshotFromPersistedQuestion({
    row: {
      ...persistedRow,
      generationMetadata: { ...persistedRow.generationMetadata, scenarioEvidence: null }
    },
    transactionSnapshotId: 'fixture-db-transaction-snapshot-1'
  });
} catch (error) {
  missingScenarioEvidenceRejected = String(error?.message).includes('scenario_evidence_missing');
}

const checks = {
  hmacAttestationQualifiesExactProductionBatch: trustedProof !== null
    && trustedScore.status === 'valid_trusted_production_evidence'
    && trustedScore.qualifiesAsFormalProductionShadowEvidence,
  wrongSecretRejected: wrongKeyProof === null,
  plainObjectCannotForgeOpaqueProof: forgedPlainObjectScore.status === 'valid_nonqualifying'
    && !forgedPlainObjectScore.qualifiesAsFormalProductionShadowEvidence,
  signedBatchMutationRejected: mutationProof === null,
  canonicalContentHashIgnoresObjectKeyOrder:
    subjectPracticeProductionShadowCandidateContentSha256(reorderedContent)
      === subjectPracticeProductionShadowCandidateContentSha256(snapshots[0].candidate.content),
  exactScopeCountsPreserved: trustedScore.perScopeCounts['scope:a'] === 100
    && trustedScore.perScopeCounts['scope:b'] === 100,
  untrustedSourceRejected,
  duplicateCandidateRejected,
  persistedReadModelMapsWithoutCallerSuppliedHash: mappedSnapshot.candidate.id === persistedRow.id
    && mappedSnapshot.binding.solverVersion === expectedBinding.solverVersion
    && mappedSnapshot.verification.wouldPublish === true,
  exactMathDerivativeTripleVerifiedRouteAccepted:
    mappedDerivativeSnapshot.binding.scopeId === derivativeScopeId
    && mappedDerivativeSnapshot.binding.generatorVersion === SUBJECT_PRACTICE_MATH_DERIVATIVE_LOCAL_GENERATOR_VERSION
    && mappedDerivativeSnapshot.verification.deterministicStatus === 'verified'
    && mappedDerivativeSnapshot.verification.explanationStatus === 'verified'
    && mappedDerivativeSnapshot.verification.oracleStatus === 'verified',
  tripleVerifiedRouteRejectsWrongScope: tripleVerifiedWrongScopeRejected,
  tripleVerifiedRouteRejectsWrongGenerator: tripleVerifiedWrongGeneratorRejected,
  conflictRowsRemainInObservationDenominator: mappedConflictSnapshot.binding.scopeId === 'scope:a'
    && mappedConflictSnapshot.verification.deterministicStatus === 'conflict'
    && mappedConflictSnapshot.verification.wouldPublish === false,
  publicationSuppressionRequiresReadModelCounts: publicationEvidenceRequired,
  generationAndReviewBundlesMustMatch: duplicatedBundleMustMatch,
  deterministicOnlyReviewerRequired: paidReviewerRejected,
  completeGeneratorInvocationIsolationRequired: incompleteGeneratorIsolationRejected,
  persistedProjectionHashIsRecomputed: projectionHashMismatchRejected,
  persistedCandidateLeakageEvidenceRequired: missingCandidateLeakageEvidenceRejected,
  completeCandidateCorpusSnapshotRequired: incompleteCandidateCorpusSnapshotRejected,
  persistedScenarioEvidenceRequired: missingScenarioEvidenceRejected,
  secretNotSerialized: !JSON.stringify({ batch, attestation }).includes(secret)
};

const report = {
  mode: 'subject_practice_production_shadow_trusted_exporter_self_test',
  reportVersion: 'subject-practice-production-shadow-trusted-exporter-self-test-v9',
  exporterVersion: SUBJECT_PRACTICE_PRODUCTION_SHADOW_TRUSTED_EXPORTER_VERSION,
  status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
  checks,
  trustedScore,
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_fixture_read_model_only',
  productionImpact: 'none_no_production_connection_or_gate_change'
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report };
