import { createHash } from 'node:crypto';

export const SUBJECT_PRACTICE_THREE_SUBJECT_READ_ONLY_DB_NOVELTY_EVIDENCE_VERSION =
  'subject-practice-three-subject-read-only-db-novelty-evidence-v1';
export const SUBJECT_PRACTICE_READ_ONLY_DB_NOVELTY_EVIDENCE_POLICY_VERSION =
  'subject-practice-read-only-db-novelty-evidence-verification-v1';

type RecordValue = Record<string, unknown>;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function evidenceCoreFrom(value: RecordValue) {
  return {
    evidenceVersion: value.evidenceVersion,
    capturedAt: value.capturedAt,
    status: value.status,
    subjects: value.subjects,
    allCandidatesClear: value.allCandidatesClear,
    allSourceRevisionsContentBoundByHash: value.allSourceRevisionsContentBoundByHash,
    allCandidatesBoundToCompleteRevisionMatchSet: value.allCandidatesBoundToCompleteRevisionMatchSet,
    noveltyPolicyVersion: value.noveltyPolicyVersion,
    transactionMode: value.transactionMode,
    attestationClass: value.attestationClass,
    formalQualificationEligible: value.formalQualificationEligible,
    providerImpact: value.providerImpact,
    databaseImpact: value.databaseImpact,
    publicationImpact: value.publicationImpact
  };
}

export function subjectPracticeReadOnlyDbNoveltyAggregateDigestFor(value: unknown) {
  const evidence = recordFrom(value);
  return evidence ? sha256(evidenceCoreFrom(evidence)) : '';
}

export function verifySubjectPracticeReadOnlyDbNoveltyEvidence(value: unknown) {
  const evidence = recordFrom(value);
  const subjects = Array.isArray(evidence?.subjects) ? evidence.subjects.map(recordFrom) : [];
  const blockers: string[] = [];
  const shaPattern = /^[a-f0-9]{64}$/;
  if (!evidence
    || evidence.evidenceVersion !== SUBJECT_PRACTICE_THREE_SUBJECT_READ_ONLY_DB_NOVELTY_EVIDENCE_VERSION
    || evidence.status !== 'completed_nonqualifying_read_only_preflight') {
    blockers.push('read_only_db_novelty_evidence_header_invalid');
  }
  const expectedSubjects = ['chemistry', 'math', 'physics'];
  const observedSubjects = subjects.map((entry) => clean(entry?.subject).toLowerCase()).sort();
  if (subjects.length !== 3 || JSON.stringify(observedSubjects) !== JSON.stringify(expectedSubjects)) {
    blockers.push('read_only_db_novelty_evidence_subject_set_invalid');
  }
  for (const subject of subjects) {
    const evaluated = Number(subject?.evaluatedCandidateCount);
    const sourceCount = Number(subject?.sourceRevisionCount);
    const statusCounts = recordFrom(subject?.candidateStatusCounts);
    if (!subject || !clean(subject.generatorVersion)
      || !Number.isInteger(evaluated) || evaluated <= 0
      || !Number.isInteger(sourceCount) || sourceCount <= 0
      || Object.keys(statusCounts ?? {}).length !== 1
      || Number(statusCounts?.clear) !== evaluated
      || !shaPattern.test(clean(subject.sourceCorpusSnapshotSha256))
      || !shaPattern.test(clean(subject.candidateEvidenceRootSha256))
      || !shaPattern.test(clean(subject.evidenceDigest))) {
      blockers.push(`read_only_db_novelty_evidence_subject_invalid:${clean(subject?.subject).toLowerCase() || 'unknown'}`);
    }
  }
  if (evidence?.allCandidatesClear !== true
    || evidence?.allSourceRevisionsContentBoundByHash !== true
    || evidence?.allCandidatesBoundToCompleteRevisionMatchSet !== true
    || evidence?.transactionMode !== 'repeatable_read_read_only_fetch_then_in_memory_evaluation'
    || evidence?.attestationClass !== 'repeatable_read_local_untrusted_nonqualifying'
    || evidence?.formalQualificationEligible !== false
    || evidence?.providerImpact !== 'none_no_provider_call'
    || evidence?.databaseImpact !== 'read_only'
    || evidence?.publicationImpact !== 'none') {
    blockers.push('read_only_db_novelty_evidence_safety_boundary_invalid');
  }
  const expectedDigest = evidence ? subjectPracticeReadOnlyDbNoveltyAggregateDigestFor(evidence) : '';
  if (!evidence || clean(evidence.aggregateEvidenceDigest) !== expectedDigest) {
    blockers.push('read_only_db_novelty_evidence_aggregate_digest_invalid');
  }
  const uniqueBlockers = [...new Set(blockers)];
  return {
    policyVersion: SUBJECT_PRACTICE_READ_ONLY_DB_NOVELTY_EVIDENCE_POLICY_VERSION,
    status: uniqueBlockers.length ? 'rejected' : 'verified_nonqualifying_read_only_evidence',
    blockers: uniqueBlockers,
    aggregateEvidenceDigest: expectedDigest || null,
    subjectCount: subjects.length,
    totalEvaluatedCandidateCount: subjects.reduce((sum, entry) =>
      sum + (Number.isInteger(Number(entry?.evaluatedCandidateCount)) ? Number(entry?.evaluatedCandidateCount) : 0), 0),
    formalQualificationEligible: false,
    publicationAuthorized: false
  };
}
