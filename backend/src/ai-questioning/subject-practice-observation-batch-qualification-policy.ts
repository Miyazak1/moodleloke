import { createHash } from 'node:crypto';
import {
  scoreSubjectPracticeObservationBatchEvidence,
  SubjectPracticeObservationBatchTaskReadModel
} from './subject-practice-observation-batch-evidence-policy';
import { SubjectPracticeObservationBatchManifest } from './subject-practice-observation-batch-manifest-policy';
import {
  scoreSubjectPracticeProductionShadowEvidence,
  SubjectPracticeProductionShadowEvidenceBatch,
  SubjectPracticeProductionShadowExporterAttestation,
  verifySubjectPracticeProductionShadowExporterAttestation
} from './subject-practice-production-shadow-evidence-policy';
import { subjectPracticeProductionShadowScopeContractFor } from './subject-practice-production-shadow-scope-registry';

export const SUBJECT_PRACTICE_OBSERVATION_BATCH_QUALIFICATION_POLICY_VERSION =
  'subject-practice-observation-batch-qualification-v2-candidate-corpus-snapshot-bound';

export type SubjectPracticeObservationBatchSignedCandidateEvidence = {
  exactPlanKey: string;
  batch: SubjectPracticeProductionShadowEvidenceBatch;
  attestation: SubjectPracticeProductionShadowExporterAttestation;
};

function clean(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function recordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function exactPlanKey(input: { subject: unknown; taskFamily: unknown; planTemplate: unknown }) {
  return `${clean(input.subject)}:${clean(input.taskFamily)}:${clean(input.planTemplate)}`;
}

function sortedPositiveIds(values: unknown[]) {
  return values.map(Number).filter((value) => Number.isInteger(value) && value > 0).sort((a, b) => a - b);
}

function arraysEqual(left: unknown[], right: unknown[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function subjectPracticeObservationCandidateEvidenceBatchId(input: {
  observationBatchId: string;
  exactPlanKey: string;
}) {
  const observationBatchId = clean(input.observationBatchId);
  const planKey = clean(input.exactPlanKey);
  if (!/^local-shadow-[a-f0-9]{20}$/.test(observationBatchId) || !planKey) {
    throw new Error('observation_batch_candidate_evidence_identity_invalid');
  }
  const suffix = createHash('sha256').update(`${observationBatchId}:${planKey}`).digest('hex').slice(0, 20);
  return `observation-content-${suffix}`;
}

export function bindSubjectPracticeObservationBatchQualificationEvidence(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  tasks: SubjectPracticeObservationBatchTaskReadModel[];
  signedCandidateEvidence: SubjectPracticeObservationBatchSignedCandidateEvidence[];
  exporterHmacSecret: string;
}) {
  const observationScore = scoreSubjectPracticeObservationBatchEvidence({
    manifest: input.manifest,
    tasks: input.tasks
  });
  const reasons = [...observationScore.reasons];
  const signed = Array.isArray(input.signedCandidateEvidence) ? input.signedCandidateEvidence : [];
  const signedKeys = signed.map((item) => clean(item.exactPlanKey));
  if (new Set(signedKeys).size !== signedKeys.length) reasons.push('observation_batch_candidate_evidence_duplicate_plan');
  const manifestKeys = Array.from(new Set(input.manifest.tasks.map((task) => exactPlanKey(task))));
  if (signedKeys.some((key) => !manifestKeys.includes(key))) reasons.push('observation_batch_candidate_evidence_extra_plan');

  const rowByOrdinal = new Map<number, SubjectPracticeObservationBatchTaskReadModel>();
  for (const row of input.tasks) {
    const ordinal = Number(recordFrom(recordFrom(row.filterSnapshot).sealedObservationBatch).taskOrdinal);
    if (Number.isInteger(ordinal) && ordinal > 0 && !rowByOrdinal.has(ordinal)) rowByOrdinal.set(ordinal, row);
  }
  const allCandidateIds = sortedPositiveIds(input.tasks.map((row) => recordFrom(row.result).generatedQuestionId));
  if (new Set(allCandidateIds).size !== allCandidateIds.length) reasons.push('observation_batch_candidate_id_reused');

  const perExactPlan = Object.fromEntries(manifestKeys.map((key) => {
    const descriptors = input.manifest.tasks.filter((task) => exactPlanKey(task) === key);
    const rows: Array<SubjectPracticeObservationBatchTaskReadModel | undefined> = descriptors
      .map((descriptor) => rowByOrdinal.get(descriptor.ordinal));
    const presentRows = rows.filter((row): row is SubjectPracticeObservationBatchTaskReadModel => Boolean(row));
    const candidatePairs = descriptors.map((descriptor) => ({
      descriptor,
      row: rowByOrdinal.get(descriptor.ordinal)
    })).filter((item) => Number(recordFrom(item.row?.result).generatedQuestionId) > 0);
    const candidateIds = sortedPositiveIds(candidatePairs.map((item) => recordFrom(item.row?.result).generatedQuestionId));
    const evidence = signed.find((item) => clean(item.exactPlanKey) === key);
    const contract = descriptors[0]
      ? subjectPracticeProductionShadowScopeContractFor(
        descriptors[0].subject,
        descriptors[0].taskFamily,
        descriptors[0].planTemplate
      )
      : null;
    const groupReasons: string[] = [];
    if (!contract) groupReasons.push('observation_batch_exact_plan_contract_missing');
    if (candidateIds.length === 0) groupReasons.push('observation_batch_no_candidate_content_to_attest');
    if (candidateIds.length > 0 && !evidence) groupReasons.push('observation_batch_candidate_evidence_missing');
    let contentScore: ReturnType<typeof scoreSubjectPracticeProductionShadowEvidence> | null = null;
    let candidateIdBindingMatched = false;
    let taskOutcomeBindingMatched = false;
    let candidateLeakageBindingMatched = false;
    if (contract && evidence) {
      const expectedContentBatchId = subjectPracticeObservationCandidateEvidenceBatchId({
        observationBatchId: observationScore.batchId ?? '',
        exactPlanKey: key
      });
      if (clean(evidence.batch.batchId) !== expectedContentBatchId) {
        groupReasons.push('observation_batch_candidate_evidence_batch_id_mismatch');
      }
      const proof = verifySubjectPracticeProductionShadowExporterAttestation({
        batch: evidence.batch,
        attestation: evidence.attestation,
        secret: input.exporterHmacSecret
      });
      contentScore = scoreSubjectPracticeProductionShadowEvidence(evidence.batch, {
        expectedScopeIds: contract.expectedScopeIds,
        expectedBinding: contract.expectedBinding,
        trustedExporterProof: proof
      });
      const eventCandidateIds = sortedPositiveIds(evidence.batch.events.map((event) => event.candidateId));
      candidateIdBindingMatched = arraysEqual(candidateIds, eventCandidateIds)
        && new Set(eventCandidateIds).size === eventCandidateIds.length;
      if (!candidateIdBindingMatched) groupReasons.push('observation_batch_candidate_id_set_mismatch');
      const eventByCandidateId = new Map(evidence.batch.events.map((event) => [Number(event.candidateId), event]));
      taskOutcomeBindingMatched = candidatePairs.every(({ descriptor, row }) => {
        const result = recordFrom(row?.result);
        const event = eventByCandidateId.get(Number(result.generatedQuestionId));
        const taskPublishable = clean(result.gateDecision) === 'publishable';
        return Boolean(event
          && clean(event.scopeId) === clean(descriptor.plannedScopeId)
          && event.wouldPublish === taskPublishable
          && event.publicationSuppressed === true
          && event.publicationAttempted === false);
      });
      if (!taskOutcomeBindingMatched) groupReasons.push('observation_batch_candidate_task_outcome_mismatch');
      candidateLeakageBindingMatched = candidatePairs.every(({ row }) => {
        const result = recordFrom(row?.result);
        const leakage = recordFrom(result.automatedCandidateLeakageGate);
        const event = eventByCandidateId.get(Number(result.generatedQuestionId));
        return Boolean(event
          && clean(event.candidateLeakagePolicyVersion) === clean(leakage.policyVersion)
          && clean(event.candidateLeakageStatus) === clean(leakage.status)
          && event.candidateLeakageScannedRevisionCount === Number(leakage.scannedRevisionCount)
          && event.candidateLeakageBlockedRevisionCount === Number(leakage.blockedRevisionCount)
          && event.candidateLeakageAmbiguousRevisionCount === Number(leakage.ambiguousRevisionCount)
          && clean(event.candidateLeakageRevisionMatchSetSha256) === clean(leakage.revisionMatchSetSha256)
          && clean(event.candidateLeakageRevisionMatchDigestVersion) === clean(leakage.revisionMatchDigestVersion)
          && clean(event.candidateLeakageStructuredCorpusSchemaVersion) === clean(leakage.structuredCorpusSchemaVersion)
          && clean(event.candidateLeakageNormalizationVersion) === clean(leakage.normalizationVersion)
          && clean(event.candidateLeakageSourceCorpusSnapshotSha256) === clean(leakage.sourceCorpusSnapshotSha256)
          && clean(event.candidateLeakageSourceCorpusSnapshotVersion) === clean(leakage.sourceCorpusSnapshotVersion)
          && event.candidateLeakageSourceCorpusRevisionCount === Number(leakage.sourceCorpusRevisionCount)
          && event.candidateLeakageSourceCorpusInventoryComplete === (leakage.sourceCorpusInventoryComplete === true)
          && clean(event.candidateLeakageSourceCorpusInventoryMode) === clean(leakage.sourceCorpusInventoryMode));
      });
      if (!candidateLeakageBindingMatched) groupReasons.push('observation_batch_candidate_leakage_evidence_mismatch');
      if (!contentScore.qualifiesAsFormalProductionShadowEvidence) {
        groupReasons.push('observation_batch_candidate_evidence_not_trusted_or_nonqualifying');
      }
    }
    const taskMetrics = observationScore.perExactPlan[key];
    const bridgeComplete = observationScore.complete
      && candidateIds.length > 0
      && candidateIdBindingMatched
      && taskOutcomeBindingMatched
      && candidateLeakageBindingMatched
      && contentScore?.qualifiesAsFormalProductionShadowEvidence === true
      && groupReasons.length === 0;
    if (!bridgeComplete) reasons.push(...groupReasons.map((reason) => `${key}:${reason}`));
    return [key, {
      status: bridgeComplete ? 'trusted_complete' : 'incomplete_or_nonqualifying',
      bridgeComplete,
      requestedCount: descriptors.length,
      taskRowsObserved: presentRows.length,
      candidateIds,
      candidateIdBindingMatched,
      taskOutcomeBindingMatched,
      candidateLeakageBindingMatched,
      candidateLeakageEvidenceRootSha256: taskMetrics?.candidateLeakageEvidenceRootSha256 ?? null,
      contentScore,
      realProductionShadow: {
        publicationSuppressed: bridgeComplete,
        perScopeCounts: contentScore?.perScopeCounts ?? {},
        requestedCount: Number(taskMetrics?.requestedCount ?? descriptors.length),
        candidateCount: Number(taskMetrics?.candidateCount ?? 0),
        publishableCount: Number(taskMetrics?.publishableCount ?? 0),
        falseAccepts: Number(contentScore?.falseAccepts ?? 0),
        scopeLeakageCount: Number(taskMetrics?.scopeBindingFailureCount ?? 0)
          + Number(contentScore?.scopeLeakageCount ?? 0),
        unexpectedFailureCount: Number(taskMetrics?.unexpectedFailureCount ?? 0)
          + Number(contentScore?.unexpectedConflictCount ?? 0)
      },
      reasons: Array.from(new Set(groupReasons))
    }];
  }));
  const allGroupsBound = manifestKeys.length > 0
    && Object.values(perExactPlan).every((entry) => entry.bridgeComplete);
  return {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_BATCH_QUALIFICATION_POLICY_VERSION,
    observationBatchId: observationScore.batchId,
    observationManifestSha256: observationScore.manifestSha256,
    status: observationScore.complete && allGroupsBound && reasons.length === 0
      ? 'trusted_complete_batch_qualification_evidence'
      : 'incomplete_or_nonqualifying',
    readyForFamilyQualification: observationScore.complete && allGroupsBound && reasons.length === 0,
    observationScore,
    perExactPlan,
    reasons: Array.from(new Set(reasons)),
    trustBoundary: {
      taskDenominatorSource: 'sealed_complete_database_observation_batch',
      candidateContentSource: 'hmac_attested_read_only_persisted_question_export',
      candidateIdSetsMustMatchExactly: true,
      candidateLeakageEvidenceMustMatchExactly: true,
      candidateLeakageCorpusSnapshotMustBeCompleteAndHashBound: true,
      candidateIdCherryPickingAllowed: false,
      officialQuestionContentExposedToGenerator: false
    }
  };
}
