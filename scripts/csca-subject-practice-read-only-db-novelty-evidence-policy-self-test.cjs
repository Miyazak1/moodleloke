#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeReadOnlyDbNoveltyAggregateDigestFor,
  verifySubjectPracticeReadOnlyDbNoveltyEvidence
} = require('../backend/src/ai-questioning/subject-practice-read-only-db-novelty-evidence-policy');

const hash = (character) => character.repeat(64);
const subjects = ['math', 'physics', 'chemistry'].map((subject, index) => ({
  subject,
  generatorVersion: `${subject}-generator-v1`,
  sourceRevisionCount: 10 + index,
  evaluatedCandidateCount: 20 + index,
  candidateStatusCounts: { clear: 20 + index },
  sourceCorpusSnapshotSha256: hash(String(index + 1)),
  candidateEvidenceRootSha256: hash(String(index + 4)),
  evidenceDigest: hash(index === 0 ? 'a' : index === 1 ? 'b' : 'c')
}));
const core = {
  evidenceVersion: 'subject-practice-three-subject-read-only-db-novelty-evidence-v1',
  capturedAt: '2026-09-14T00:00:00.000Z',
  status: 'completed_nonqualifying_read_only_preflight',
  subjects,
  allCandidatesClear: true,
  allSourceRevisionsContentBoundByHash: true,
  allCandidatesBoundToCompleteRevisionMatchSet: true,
  noveltyPolicyVersion: 'novelty-v1',
  transactionMode: 'repeatable_read_read_only_fetch_then_in_memory_evaluation',
  attestationClass: 'repeatable_read_local_untrusted_nonqualifying',
  formalQualificationEligible: false,
  providerImpact: 'none_no_provider_call',
  databaseImpact: 'read_only',
  publicationImpact: 'none'
};
const valid = { ...core, aggregateEvidenceDigest: subjectPracticeReadOnlyDbNoveltyAggregateDigestFor(core) };

function main() {
  const verified = verifySubjectPracticeReadOnlyDbNoveltyEvidence(valid);
  const digestTampered = verifySubjectPracticeReadOnlyDbNoveltyEvidence({
    ...valid, subjects: valid.subjects.map((entry, index) => index === 0
      ? { ...entry, evaluatedCandidateCount: entry.evaluatedCandidateCount + 1 }
      : entry)
  });
  const forgedClear = { ...valid, subjects: valid.subjects.map((entry, index) => index === 0
    ? { ...entry, candidateStatusCounts: { clear: entry.evaluatedCandidateCount - 1, ambiguous: 1 } }
    : entry) };
  forgedClear.aggregateEvidenceDigest = subjectPracticeReadOnlyDbNoveltyAggregateDigestFor(forgedClear);
  const forgedClearResult = verifySubjectPracticeReadOnlyDbNoveltyEvidence(forgedClear);
  const qualificationDrift = { ...valid, formalQualificationEligible: true };
  qualificationDrift.aggregateEvidenceDigest = subjectPracticeReadOnlyDbNoveltyAggregateDigestFor(qualificationDrift);
  const qualificationDriftResult = verifySubjectPracticeReadOnlyDbNoveltyEvidence(qualificationDrift);
  const checks = {
    exactEvidenceVerifiesAsNonqualifying: verified.status === 'verified_nonqualifying_read_only_evidence',
    aggregateDigestBindsSubjectMeasurements:
      digestTampered.blockers.includes('read_only_db_novelty_evidence_aggregate_digest_invalid'),
    recomputedDigestCannotHideNonClearCandidate:
      forgedClearResult.blockers.includes('read_only_db_novelty_evidence_subject_invalid:math'),
    recomputedDigestCannotPromoteQualification:
      qualificationDriftResult.blockers.includes('read_only_db_novelty_evidence_safety_boundary_invalid'),
    verifierNeverAuthorizesPublication:
      verified.formalQualificationEligible === false && verified.publicationAuthorized === false
  };
  const report = {
    mode: 'subject_practice_read_only_db_novelty_evidence_policy_self_test',
    reportVersion: 'subject-practice-read-only-db-novelty-evidence-policy-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call', databaseImpact: 'none_fixture_only', publicationImpact: 'none'
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();
