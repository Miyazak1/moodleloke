#!/usr/bin/env node

const {
  buildReadOnlyNoveltyEvidenceRoots
} = require('./csca-subject-practice-observation-batch-novelty-diagnostic.cjs');

const hash = (character) => character.repeat(64);
const revisions = [
  {
    sourceQuestionRevisionId: hash('a'), lineageHash: hash('b'), documentIdentityHash: hash('c'),
    fieldHashes: { rawContentSha256: hash('d') }, canonicalTaskParameterFingerprint: null
  },
  {
    sourceQuestionRevisionId: hash('e'), lineageHash: hash('f'), documentIdentityHash: hash('1'),
    fieldHashes: { rawContentSha256: hash('2') }, canonicalTaskParameterFingerprint: 'task-2'
  }
];
const entries = [
  {
    candidateId: 'scope-a:1', scopeId: 'scope-a',
    evidence: {
      policyVersion: 'novelty-v1', status: 'clear', reasonCodes: [], scannedRevisionCount: 2,
      revisionMatchSetSha256: hash('3')
    }
  },
  {
    candidateId: 'scope-b:1', scopeId: 'scope-b',
    evidence: {
      policyVersion: 'novelty-v1', status: 'clear', reasonCodes: [], scannedRevisionCount: 2,
      revisionMatchSetSha256: hash('4')
    }
  }
];

function evidenceFor(overrides = {}) {
  return buildReadOnlyNoveltyEvidenceRoots({
    subject: 'physics', generatorVersion: 'generator-v1', revisions, entries, ...overrides
  });
}

function main() {
  const baseline = evidenceFor();
  const reordered = evidenceFor({ revisions: [...revisions].reverse(), entries: [...entries].reverse() });
  const sourceTampered = evidenceFor({
    revisions: revisions.map((entry, index) => index === 0
      ? { ...entry, fieldHashes: { rawContentSha256: hash('5') } }
      : entry)
  });
  const candidateTampered = evidenceFor({
    entries: entries.map((entry, index) => index === 0
      ? { ...entry, evidence: { ...entry.evidence, revisionMatchSetSha256: hash('6') } }
      : entry)
  });
  const incomplete = evidenceFor({
    entries: entries.map((entry, index) => index === 0
      ? { ...entry, evidence: { ...entry.evidence, scannedRevisionCount: 1 } }
      : entry)
  });
  const checks = {
    rootsAreDeterministicAndOrderInvariant:
      baseline.evidenceDigest === reordered.evidenceDigest,
    sourceContentHashChangesSnapshotAndEvidence:
      baseline.sourceCorpusSnapshotSha256 !== sourceTampered.sourceCorpusSnapshotSha256
      && baseline.evidenceDigest !== sourceTampered.evidenceDigest,
    candidateMatchSetChangesCandidateRootAndEvidence:
      baseline.candidateEvidenceRootSha256 !== candidateTampered.candidateEvidenceRootSha256
      && baseline.evidenceDigest !== candidateTampered.evidenceDigest,
    everyCandidateMustScanCompleteSnapshot:
      baseline.allCandidatesBoundToCompleteRevisionMatchSet === true
      && incomplete.allCandidatesBoundToCompleteRevisionMatchSet === false,
    outputContainsOnlyHashesCountsAndVersions:
      !JSON.stringify(baseline).includes('prompt')
      && !JSON.stringify(baseline).includes('explanation'),
    remainsExplicitlyNonqualifying:
      baseline.formalQualificationEligible === false
      && baseline.attestationClass === 'repeatable_read_local_untrusted_nonqualifying'
  };
  const report = {
    mode: 'subject_practice_read_only_novelty_evidence_self_test',
    reportVersion: 'subject-practice-read-only-db-novelty-evidence-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call', databaseImpact: 'none_fixture_only', publicationImpact: 'none'
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();
