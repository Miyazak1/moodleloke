const assert = require('node:assert/strict');
const {
  QUESTION_ENGINE_CANDIDATE_WRITE_GATE_VERSION,
  evaluateQuestionCandidateWriteGate
} = require('../dist/backend/src/question-engine-plugin/question-candidate-write-gate.js');

const candidate = {
  subject: 'math', topicId: 1, blueprintId: 2, sourceType: 'ai', designedDifficulty: 'medium',
  questionType: 'single_choice', prompt: '若 x + 1 = 2，则 x 等于多少？',
  options: [
    { id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }, { id: 'D', text: '4' }
  ],
  correctAnswer: 'A', explanation: '移项得 x = 1。', knowledgeTags: ['方程'], optionMetadata: [], syllabusVersion: '2026'
};
const review = {
  status: 'passed', issues: [], dimensions: [], sources: ['deterministic'], decision: 'approve', score: 95,
  checkedAt: '2026-09-28T00:00:00.000Z'
};
const sourceIsolationEvidence = {
  status: 'enforced_structural_projection', originalQuestionContentOmitted: true,
  reversibleSourceFieldsOmitted: true, sourceLinkageIdentifiersOmitted: true,
  knownSourceLeakMatchCount: 0, providerProjectionSha256: 'a'.repeat(64)
};
const generationMetadata = {
  generator: 'deepseek', intendedUse: 'subject_practice', sourceIsolationEvidence
};
const evaluate = (overrides = {}) => evaluateQuestionCandidateWriteGate({
  candidate, review, generationMetadata, sourceSimilarity: { checked: true, maxSimilarity: 0.1 }, ...overrides
});

const allowed = evaluate();
assert.equal(allowed.policyVersion, QUESTION_ENGINE_CANDIDATE_WRITE_GATE_VERSION);
assert.equal(allowed.decision, 'allow_candidate_write');

const invalidSchema = evaluate({ candidate: { ...candidate, prompt: '', options: candidate.options.slice(0, 3) } });
assert.equal(invalidSchema.decision, 'block');
assert.ok(invalidSchema.blockers.includes('schema_prompt_missing'));
assert.ok(invalidSchema.blockers.includes('schema_options_insufficient'));

const missingIsolation = evaluate({ generationMetadata: { generator: 'deepseek', intendedUse: 'subject_practice' } });
assert.equal(missingIsolation.decision, 'block');
assert.ok(missingIsolation.blockers.includes('source_isolation_not_enforced'));

const duplicate = evaluate({
  review: { ...review, issues: [{ code: 'near_duplicate_prompt_risk', severity: 'warning', message: 'duplicate' }] }
});
assert.equal(duplicate.decision, 'block');
assert.ok(duplicate.blockers.includes('near_duplicate_prompt_risk'));

const failedQuality = evaluate({
  review: { ...review, status: 'failed', decision: 'regenerate', issues: [{ code: 'invalid_answer', severity: 'error', message: 'bad' }] }
});
assert.equal(failedQuality.decision, 'block');
assert.ok(failedQuality.blockers.includes('quality_review_failed'));

const observation = evaluate({
  generationMetadata: { ...generationMetadata, workClass: 'observation', suppressStudentPublication: true },
  review: { ...review, status: 'failed', decision: 'regenerate', issues: [{ code: 'near_duplicate_prompt_risk', severity: 'warning', message: 'duplicate' }] }
});
assert.equal(observation.decision, 'allow_observation_evidence_write');
assert.equal(observation.persistenceClass, 'observation-evidence');
assert.ok(observation.observedBlockers.includes('near_duplicate_prompt_risk'));
assert.ok(observation.observedBlockers.includes('quality_review_failed'));

const unsafeObservation = evaluate({
  generationMetadata: { generator: 'deepseek', intendedUse: 'subject_practice', workClass: 'observation', suppressStudentPublication: true }
});
assert.equal(unsafeObservation.decision, 'block');
assert.ok(unsafeObservation.blockers.includes('source_isolation_not_enforced'));

async function assertBlockedCandidateDoesNotReachDatabase() {
  const { AIQuestioningService } = require('../dist/backend/src/ai-questioning/ai-questioning.service.js');
  let databaseCalls = 0;
  const service = new AIQuestioningService({
    $queryRaw: async () => {
      databaseCalls += 1;
      throw new Error('database_should_not_be_called');
    }
  }, undefined, undefined, undefined, undefined, undefined, undefined);
  service.sourceSimilarityForCandidate = async () => ({ checked: true, maxSimilarity: 0.1, matches: [] });
  await assert.rejects(
    service.insertQuestion({ ...candidate, prompt: '' }, review, generationMetadata, 'pending_review'),
    /question_engine_candidate_write_blocked:schema_prompt_missing/
  );
  assert.equal(databaseCalls, 0, 'blocked candidate must not reach the Prisma INSERT boundary');
}

assertBlockedCandidateDoesNotReachDatabase()
  .then(() => console.log('Question-engine candidate write gate tests passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
