import { createHash } from 'node:crypto';
import {
  assertSubjectPracticeHistoricalObservationBatchEnvelope,
  subjectPracticeHistoricalObservationBatchEnvelopeFor,
  SubjectPracticeObservationBatchManifest,
  SUBJECT_PRACTICE_OBSERVATION_OUTPUT_IDENTITY_POLICY_VERSION
} from './subject-practice-observation-batch-manifest-policy';
import { subjectPracticeScenarioDiversityBatchMetrics } from './subject-practice-scenario-diversity-policy';
import {
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION,
  SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION,
  SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
} from './subject-practice-candidate-output-novelty-policy';
import { SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION } from './subject-practice-source-corpus-scan-policy';

export const SUBJECT_PRACTICE_OBSERVATION_BATCH_EVIDENCE_POLICY_VERSION =
  'subject-practice-observation-batch-evidence-v4-candidate-corpus-snapshot-bound';

export type SubjectPracticeObservationBatchTaskReadModel = {
  id: string;
  subject: string | null;
  resourceType: string | null;
  resourceId: string | null;
  filterSnapshot: unknown;
  status: string;
  requested: number;
  succeeded: number;
  skipped: number;
  failed: number;
  result: unknown;
  error: string | null;
};

function clean(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function recordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function validSha256(value: unknown) {
  return /^[a-f0-9]{64}$/.test(clean(value));
}

function sha256Json(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function exactPlanKey(task: SubjectPracticeObservationBatchManifest['tasks'][number]) {
  return `${task.subject}:${task.taskFamily}:${task.planTemplate}`;
}

export function scoreSubjectPracticeObservationBatchEvidence(input: {
  manifest: SubjectPracticeObservationBatchManifest;
  tasks: SubjectPracticeObservationBatchTaskReadModel[];
}) {
  const expectedEnvelope = input.manifest.tasks.length
    ? assertSubjectPracticeHistoricalObservationBatchEnvelope({
      envelope: subjectPracticeHistoricalObservationBatchEnvelopeFor({ manifest: input.manifest, taskOrdinal: 1 }),
      currentTask: input.manifest.tasks[0]
    })
    : null;
  const reasons: string[] = [];
  const rows = Array.isArray(input.tasks) ? input.tasks : [];
  const seenOrdinals = new Set<number>();
  const normalized = rows.map((row) => {
    const snapshot = recordFrom(row.filterSnapshot);
    const sealed = recordFrom(snapshot.sealedObservationBatch);
    const ordinal = Number(sealed.taskOrdinal);
    let envelopeValid = false;
    try {
      // Evidence scoring is a read-only audit path. It accepts explicitly known
      // historical manifest policy versions while the submission path remains
      // pinned to the current manifest validator.
      const verified = assertSubjectPracticeHistoricalObservationBatchEnvelope({
        envelope: sealed,
        currentTask: {
          subject: clean(row.subject) as 'math' | 'physics' | 'chemistry',
          productionRunId: Number(row.resourceType === 'production_run' ? row.resourceId : snapshot.productionRunId),
          productionCellId: Number(snapshot.productionCellId),
          taskFamily: clean(snapshot.requestedTaskFamily),
          planTemplate: clean(snapshot.requestedPlanTemplate)
        }
      });
      envelopeValid = Boolean(expectedEnvelope
        && verified.batchId === expectedEnvelope.batchId
        && verified.manifestSha256 === expectedEnvelope.manifestSha256
        && verified.expectedTaskCount === expectedEnvelope.expectedTaskCount);
    } catch {
      envelopeValid = false;
    }
    if (seenOrdinals.has(ordinal)) reasons.push('observation_batch_duplicate_ordinal');
    seenOrdinals.add(ordinal);
    const descriptor = input.manifest.tasks[ordinal - 1];
    const result = recordFrom(row.result);
    const scenarioEvidence = result.scenarioEvidence
      && typeof result.scenarioEvidence === 'object'
      && !Array.isArray(result.scenarioEvidence)
      ? result.scenarioEvidence as Record<string, unknown>
      : null;
    const leakage = recordFrom(result.automatedCandidateLeakageGate);
    const terminal = ['succeeded', 'failed', 'cancelled'].includes(clean(row.status));
    const candidatePresent = Number(result.generatedQuestionId) > 0;
    const expectedGeneratorVersion = descriptor?.expectedGeneratorVersion ?? null;
    const exactOutputBinding = !candidatePresent || Boolean(descriptor
      && expectedGeneratorVersion
      && clean(result.plannedTaskFamily) === descriptor.taskFamily
      && clean(result.observedPlanTemplate) === descriptor.planTemplate
      && clean(result.observedScopeId) === descriptor.plannedScopeId
      && clean(result.generatorProvider) === 'local-deterministic'
      && clean(result.generatorVersion) === expectedGeneratorVersion
      && Number(result.providerAttemptLimit) === 0);
    const leakageClear = candidatePresent
      && clean(leakage.status) === 'clear'
      && Number(leakage.scannedRevisionCount) > 0
      && Number(leakage.sourceCorpusRevisionCount) === Number(leakage.scannedRevisionCount)
      && Number(leakage.blockedRevisionCount) === 0
      && Number(leakage.ambiguousRevisionCount) === 0
      && validSha256(leakage.revisionMatchSetSha256)
      && validSha256(leakage.sourceCorpusSnapshotSha256)
      && leakage.policyVersion === SUBJECT_PRACTICE_CANDIDATE_OUTPUT_NOVELTY_POLICY_VERSION
      && leakage.revisionMatchDigestVersion === SUBJECT_PRACTICE_CANDIDATE_NOVELTY_MATCH_DIGEST_VERSION
      && leakage.sourceCorpusSnapshotVersion === SUBJECT_PRACTICE_CANDIDATE_NOVELTY_CORPUS_SNAPSHOT_VERSION
      && leakage.structuredCorpusSchemaVersion === SUBJECT_PRACTICE_STRUCTURED_SOURCE_CORPUS_SCHEMA_VERSION
      && leakage.normalizationVersion === SUBJECT_PRACTICE_SOURCE_CORPUS_NORMALIZATION_VERSION
      && leakage.sourceCorpusInventoryComplete === true
      && leakage.sourceCorpusInventoryMode === 'all_active_subject_source_questions_at_statement_snapshot'
      && leakage.failClosed === true
      && leakage.sourceContentExposedToGenerator === false;
    const publishable = candidatePresent && clean(result.gateDecision) === 'publishable'
      && exactOutputBinding && leakageClear;
    return {
      id: clean(row.id),
      ordinal,
      exactPlanKey: descriptor ? exactPlanKey(descriptor) : null,
      expectedGeneratorVersion,
      plannedScopeId: descriptor?.plannedScopeId ?? null,
      status: clean(row.status),
      terminal,
      envelopeValid,
      candidatePresent,
      exactOutputBinding,
      leakageClear,
      candidateLeakageEvidence: candidatePresent ? {
        policyVersion: clean(leakage.policyVersion),
        status: clean(leakage.status),
        scannedRevisionCount: Number(leakage.scannedRevisionCount),
        blockedRevisionCount: Number(leakage.blockedRevisionCount),
        ambiguousRevisionCount: Number(leakage.ambiguousRevisionCount),
        revisionMatchSetSha256: clean(leakage.revisionMatchSetSha256),
        revisionMatchDigestVersion: clean(leakage.revisionMatchDigestVersion),
        structuredCorpusSchemaVersion: clean(leakage.structuredCorpusSchemaVersion),
        normalizationVersion: clean(leakage.normalizationVersion),
        sourceCorpusSnapshotSha256: clean(leakage.sourceCorpusSnapshotSha256),
        sourceCorpusSnapshotVersion: clean(leakage.sourceCorpusSnapshotVersion),
        sourceCorpusRevisionCount: Number(leakage.sourceCorpusRevisionCount),
        sourceCorpusInventoryComplete: leakage.sourceCorpusInventoryComplete === true,
        sourceCorpusInventoryMode: clean(leakage.sourceCorpusInventoryMode)
      } : null,
      scenarioEvidence,
      publishable,
      unexpectedFailure: clean(row.status) === 'failed' && !clean(row.error).startsWith('unsupported_')
    };
  });
  if (!expectedEnvelope) reasons.push('observation_batch_manifest_empty');
  if (rows.length !== input.manifest.tasks.length) reasons.push('observation_batch_task_count_mismatch');
  if (seenOrdinals.size !== input.manifest.tasks.length
    || input.manifest.tasks.some((task) => !seenOrdinals.has(task.ordinal))) {
    reasons.push('observation_batch_ordinal_coverage_incomplete');
  }
  if (normalized.some((row) => !row.envelopeValid)) reasons.push('observation_batch_envelope_invalid');
  if (normalized.some((row) => !row.terminal)) reasons.push('observation_batch_non_terminal_task');
  if (normalized.some((row) => row.candidatePresent && !row.exactOutputBinding)) {
    reasons.push('observation_batch_candidate_binding_mismatch');
  }
  const groupKeys = Array.from(new Set(input.manifest.tasks.map(exactPlanKey)));
  const perExactPlan = Object.fromEntries(groupKeys.map((key) => {
    const expected = input.manifest.tasks.filter((task) => exactPlanKey(task) === key);
    const actual = normalized.filter((row) => row.exactPlanKey === key);
    const perScopeCounts = Object.fromEntries(expected.map((task) => [
      task.plannedScopeId,
      actual.filter((row) => row.plannedScopeId === task.plannedScopeId && row.candidatePresent).length
    ]));
    const candidateCount = actual.filter((row) => row.candidatePresent).length;
    const publishableCount = actual.filter((row) => row.publishable).length;
    const scenarioDiversity = subjectPracticeScenarioDiversityBatchMetrics({
      expectedCount: expected.length,
      evidence: actual.map((row) => row.scenarioEvidence)
    });
    return [key, {
      requestedCount: expected.length,
      terminalCount: actual.filter((row) => row.terminal).length,
      candidateCount,
      publishableCount,
      leakageClearCount: actual.filter((row) => row.leakageClear).length,
      candidateLeakageEvidenceRootSha256: sha256Json(actual
        .filter((row) => row.candidatePresent)
        .map((row) => ({ ordinal: row.ordinal, evidence: row.candidateLeakageEvidence }))
        .sort((left, right) => left.ordinal - right.ordinal)),
      scopeBindingFailureCount: actual.filter((row) => row.candidatePresent && !row.exactOutputBinding).length,
      unexpectedFailureCount: actual.filter((row) => row.unexpectedFailure).length,
      candidateYieldRate: expected.length ? candidateCount / expected.length : null,
      publishableRate: expected.length ? publishableCount / expected.length : null,
      scenarioDiversity,
      perScopeCounts
    }];
  }));
  return {
    policyVersion: SUBJECT_PRACTICE_OBSERVATION_BATCH_EVIDENCE_POLICY_VERSION,
    outputIdentityPolicyVersion: SUBJECT_PRACTICE_OBSERVATION_OUTPUT_IDENTITY_POLICY_VERSION,
    batchId: expectedEnvelope?.batchId ?? null,
    manifestSha256: expectedEnvelope?.manifestSha256 ?? null,
    expectedTaskCount: input.manifest.tasks.length,
    observedTaskCount: rows.length,
    complete: reasons.length === 0,
    status: reasons.length === 0 ? 'complete_terminal_batch' : 'invalid_or_incomplete_batch',
    reasons: Array.from(new Set(reasons)),
    perExactPlan,
    scenarioDiversity: subjectPracticeScenarioDiversityBatchMetrics({
      expectedCount: input.manifest.tasks.length,
      evidence: normalized.map((row) => row.scenarioEvidence)
    }),
    tasks: normalized,
    candidateLeakageEvidenceRootSha256: sha256Json(normalized
      .filter((row) => row.candidatePresent)
      .map((row) => ({ ordinal: row.ordinal, evidence: row.candidateLeakageEvidence }))
      .sort((left, right) => left.ordinal - right.ordinal)),
    selectionBiasControls: {
      manifestSealedBeforeExecution: true,
      allManifestOrdinalsRequired: true,
      failedAndCancelledTasksRemainInDenominator: true,
      candidateIdCherryPickingAllowed: false
    }
  };
}
