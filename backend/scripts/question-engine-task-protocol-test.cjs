const assert = require('node:assert/strict');
const {
  issueQuestionEngineTaskEnvelope,
  verifyQuestionEngineTaskEnvelope,
  issueQuestionEngineTaskResultEnvelope,
  verifyQuestionEngineTaskResultEnvelope
} = require('../dist/backend/src/question-engine-plugin/question-engine-task-protocol.js');

const secret = 'test-question-engine-task-secret-1234567890';
const plugin = {
  id: 'moodlelike-ai-questioning', displayName: 'Moodlelike AI Questioning', version: '1.0.0', apiVersion: '1',
  capabilities: ['question.generate', 'question.review', 'question.topic-map'], executionBoundary: 'in-process-adapter', activationMode: 'configuration-restart'
};
const payload = { blueprintId: 42, constraints: { subject: 'math', difficulty: 'medium' } };
const now = new Date('2026-09-28T00:00:00.000Z');
const envelope = issueQuestionEngineTaskEnvelope({ capability: 'question.generate', plugin, payload, secret, keyId: 'test-key', now, ttlSeconds: 60 });
assert.equal(envelope.schemaVersion, 'question-engine-task-v1');
assert.equal(envelope.payloadSha256.length, 64);
assert.equal(JSON.stringify(envelope).includes(secret), false);

const claimedNonces = new Set();
const verified = verifyQuestionEngineTaskEnvelope({ envelope, capability: 'question.generate', plugin, payload, secret, keyId: 'test-key', now, claimedNonces });
assert.equal(verified.valid, true);
const replay = verifyQuestionEngineTaskEnvelope({ envelope, capability: 'question.generate', plugin, payload, secret, keyId: 'test-key', now, claimedNonces });
assert.deepEqual(replay, { valid: false, reason: 'task_replayed' });

const reorderedPayload = { constraints: { difficulty: 'medium', subject: 'math' }, blueprintId: 42 };
const reordered = verifyQuestionEngineTaskEnvelope({ envelope, capability: 'question.generate', plugin, payload: reorderedPayload, secret, keyId: 'test-key', now });
assert.equal(reordered.valid, true, 'canonical payload hashing must be independent of object key order');

const tampered = verifyQuestionEngineTaskEnvelope({ envelope, capability: 'question.generate', plugin, payload: { ...payload, blueprintId: 43 }, secret, keyId: 'test-key', now });
assert.deepEqual(tampered, { valid: false, reason: 'payload_digest_mismatch' });
const wrongCapability = verifyQuestionEngineTaskEnvelope({ envelope, capability: 'question.review', plugin, payload, secret, keyId: 'test-key', now });
assert.deepEqual(wrongCapability, { valid: false, reason: 'capability_mismatch' });
const expired = verifyQuestionEngineTaskEnvelope({ envelope, capability: 'question.generate', plugin, payload, secret, keyId: 'test-key', now: new Date(now.getTime() + 61_000) });
assert.deepEqual(expired, { valid: false, reason: 'task_expired' });
const badSignature = verifyQuestionEngineTaskEnvelope({ envelope: { ...envelope, signatureHmacSha256: '0'.repeat(64) }, capability: 'question.generate', plugin, payload, secret, keyId: 'test-key', now });
assert.deepEqual(badSignature, { valid: false, reason: 'signature_invalid' });
assert.throws(() => issueQuestionEngineTaskEnvelope({ capability: 'question.generate', plugin, payload, secret: 'short', keyId: 'test-key', now }), /task_secret_invalid/);
assert.throws(() => issueQuestionEngineTaskEnvelope({ capability: 'question.generate', plugin, payload, secret, keyId: 'test-key', now, ttlSeconds: 301 }), /task_ttl_invalid/);

const result = { candidateId: 'candidate-1', accepted: true };
const resultEnvelope = issueQuestionEngineTaskResultEnvelope({
  task: envelope, capability: 'question.generate', plugin,
  worker: { id: 'question-worker', version: '1.0.0' }, status: 'succeeded', result,
  secret, keyId: 'test-key', now: new Date(now.getTime() + 500)
});
const verifiedResult = verifyQuestionEngineTaskResultEnvelope({
  envelope: resultEnvelope, task: envelope, capability: 'question.generate', plugin,
  result, secret, keyId: 'test-key', now: new Date(now.getTime() + 600)
});
assert.equal(verifiedResult.valid, true);
assert.match(verifiedResult.replayKey, /:result:/);
assert.equal(verifyQuestionEngineTaskResultEnvelope({
  envelope: resultEnvelope, task: envelope, capability: 'question.generate', plugin,
  result: { candidateId: 'tampered' }, secret, keyId: 'test-key', now: new Date(now.getTime() + 600)
}).reason, 'result_digest_mismatch');
assert.equal(verifyQuestionEngineTaskResultEnvelope({
  envelope: { ...resultEnvelope, signatureHmacSha256: 'f'.repeat(64) }, task: envelope,
  capability: 'question.generate', plugin, result, secret, keyId: 'test-key', now: new Date(now.getTime() + 600)
}).reason, 'signature_invalid');
assert.throws(() => issueQuestionEngineTaskResultEnvelope({
  task: envelope, capability: 'question.generate', plugin,
  worker: { id: 'question-worker', version: '1.0.0' }, status: 'failed', result: null,
  secret, keyId: 'test-key', now: new Date(now.getTime() + 500)
}), /result_error_code_missing/);

console.log('Question-engine signed task protocol tests passed.');
