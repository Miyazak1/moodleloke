const assert = require('node:assert/strict');
const { selectTeachingAssetCandidate, TEACHING_ASSET_SELECTION_POLICY_VERSION } = require('../dist/backend/src/agent/teaching-asset-selection-policy');

function candidate(versionId, overrides = {}) {
  return {
    assetId: `asset-${versionId}`,
    versionId,
    stableKey: `lesson.${versionId}`,
    estimatedMinutes: 6,
    publishedAt: new Date('2026-09-01T00:00:00.000Z'),
    userEvidence: {
      exposureCount: 0, completedCount: 0, skippedCount: 0, lastExposedAt: null,
      independentPassed: 0, independentFailed: 0, stable: 0, notStable: 0,
      ...(overrides.userEvidence || {})
    },
    globalEvidence: {
      exposureContexts: 12, uniqueLearners: 6, completionRate: 0.8,
      conclusiveOutcomes: 5, verificationPassRate: 0.8,
      ...(overrides.globalEvidence || {})
    }
  };
}

const alternate = selectTeachingAssetCandidate({
  userId: 42, topicId: 9, depth: 'guided', at: new Date('2026-09-14T00:00:00.000Z'),
  candidates: [
    candidate('failed', { userEvidence: { exposureCount: 1, completedCount: 1, independentFailed: 1, notStable: 1 } }),
    candidate('fresh')
  ]
});
assert.equal(alternate.candidate.versionId, 'fresh');
assert.equal(alternate.decision.policyVersion, TEACHING_ASSET_SELECTION_POLICY_VERSION);
assert.ok(alternate.decision.reasonCodes.includes('alternate_after_ineffective_asset'));
assert.equal(alternate.decision.eligibleCandidateCount, 1);

const exhausted = selectTeachingAssetCandidate({
  userId: 42, topicId: 9, at: new Date('2026-09-14T00:00:00.000Z'),
  candidates: [
    candidate('failed', { userEvidence: { exposureCount: 1, independentFailed: 1 } }),
    candidate('skipped', { userEvidence: { exposureCount: 1, skippedCount: 1 } })
  ]
});
assert.equal(exhausted, null, 'all known ineffective candidates must fall back to reviewed static content');

let exploration = null;
let exploitation = null;
for (let day = 1; day <= 31 && (!exploration || !exploitation); day += 1) {
  const result = selectTeachingAssetCandidate({
    userId: 77, topicId: 12, at: new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00.000Z`),
    candidates: [candidate('established'), candidate('new', { globalEvidence: { exposureContexts: 0, uniqueLearners: 0, completionRate: null, conclusiveOutcomes: 0, verificationPassRate: null } })]
  });
  if (result.decision.boundedExploration) exploration = result;
  else exploitation = result;
}
assert.equal(exploration.candidate.versionId, 'new');
assert.equal(exploitation.candidate.versionId, 'established');

console.log(JSON.stringify({
  status: 'ok',
  policyVersion: TEACHING_ASSET_SELECTION_POLICY_VERSION,
  alternate: alternate.candidate.versionId,
  exhaustedFallback: exhausted === null,
  boundedExploration: exploration.candidate.versionId,
  normalRouting: exploitation.candidate.versionId
}, null, 2));
