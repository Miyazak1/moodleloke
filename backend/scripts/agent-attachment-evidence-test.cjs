const assert = require('node:assert/strict');
const { AgentAttachmentEvidenceService } = require('../dist/backend/src/agent/agent-attachment-evidence.service');

function baseCandidate(overrides = {}) {
  return {
    id: 'candidate-1', userId: 7, conversationId: 'conversation-1', analysisId: 'analysis-1', analysisItemId: null, attachmentId: 'attachment-1',
    status: 'pending_confirmation', subjectCode: 'chemistry', suggestedTopicId: 11, confirmedTopicId: null,
    outcome: 'incorrect', confidence: 0.5, gateReasons: [], evidenceId: null,
    sourceSnapshot: { analysis: { completedAt: new Date().toISOString(), promptVersion: 'v1' }, availableTopics: [{ id: 11, code: 'acid', title: 'Acid' }] },
    createdAt: new Date(), updatedAt: new Date(), ...overrides
  };
}

function serviceWith(candidate, trustedMatch = null) {
  const state = { candidate, messages: [], writtenEvidence: null };
  const db = {
    agentAttachmentEvidenceCandidate: {
      findFirst: async ({ where }) => state.candidate && state.candidate.id === where.id && state.candidate.userId === where.userId ? state.candidate : null,
      updateMany: async ({ where, data }) => {
        if (state.candidate.id !== where.id || state.candidate.status !== where.status) return { count: 0 };
        state.candidate = { ...state.candidate, ...data }; return { count: 1 };
      },
      update: async ({ data }) => (state.candidate = { ...state.candidate, ...data }),
      findMany: async () => state.candidate ? [state.candidate] : []
    },
    cscaExamTopic: { findFirst: async ({ where }) => where.id === 11 && where.subject.equals === 'chemistry' ? { id: 11, code: 'acid', title: 'Acid', syllabusVersion: 'v1' } : null },
    agentAttachmentQuestionMatch: { findFirst: async () => trustedMatch },
    learningDecisionCurrent: { findFirst: async () => null },
    learningEvidenceRetraction: { upsert: async () => ({}) },
    agentMessage: { findFirst: async () => null, upsert: async ({ create }) => (state.messages.push(create), create), update: async () => ({}) },
    agentConversation: { update: async () => ({}) }
  };
  const prisma = { ...db, $transaction: async (callback) => callback(db) };
  const writer = { appendInTransaction: async (_tx, evidence) => {
    state.writtenEvidence = evidence;
    assert.equal(evidence.sourceType, 'verified_handwriting');
    assert.equal(evidence.metadata.verification.assessment, trustedMatch ? 'deterministic_answer_key_comparison' : 'student_confirmed_ai_assessment');
    assert.equal(evidence.metadata.isolation.automaticQuestionGenerationInvoked, false);
    return { evidenceId: 'evidence-1', adaptationPending: true, duplicate: false };
  } };
  const projector = { processPending: async () => ({ processed: 1 }), replayUserSubject: async () => ({ events: 0 }) };
  const decisions = { recompute: async () => ({ versionHash: 'decision-2', prescription: { reasonSummary: 'next plan' } }) };
  const service = new AgentAttachmentEvidenceService(prisma, { isWebEnabled: () => true, isAttachmentEvidenceEnabled: () => true }, { isEnabled: () => true }, writer, projector, decisions);
  return { service, state };
}

(async () => {
  {
    const analysis = { id: 'analysis-guided', userId: 7, status: 'completed', inputSnapshot: { evidenceCandidateAllowed: false }, attachment: {}, items: [] };
    const service = new AgentAttachmentEvidenceService(
      { agentAttachmentAnalysis: { findFirst: async () => analysis } },
      { isWebEnabled: () => true, isAttachmentEvidenceEnabled: () => true },
      { isEnabled: () => true }, {}, {}, {}, {}
    );
    assert.deepEqual(await service.ensureForAnalysis(7, analysis.id), []);
    assert.equal(await service.getForAnalysis(7, analysis.id), null);
  }
  {
    const state = { candidates: [], matcherItems: [], message: { id: 'message-multi', content: { schemaVersion: '1', text: '分析完成' } } };
    const analysis = {
      id: 'analysis-multi', userId: 7, conversationId: 'conversation-1', attachmentId: 'attachment-1', status: 'completed',
      result: { subject: 'math', assessment: 'not_assessable' }, model: 'vision-test', promptVersion: 'v2', completedAt: new Date(),
      attachment: { id: 'attachment-1', originalName: 'two-questions.png', sha256: 'sha', pageCount: 1 },
      items: [
        { id: 'item-1', ordinal: 1, subjectCode: 'math', questionNumber: '1', questionText: 'question one long enough', studentAnswer: 'A', assessment: 'correct', errors: [], guidance: [], citations: [{ pageNumber: 1 }], pageNumber: 1, region: { pageNumber: 1, x: .1, y: .1, width: .8, height: .3, coordinateSpace: 'normalized' } },
        { id: 'item-2', ordinal: 2, subjectCode: 'math', questionNumber: '2', questionText: 'question two long enough', studentAnswer: 'B', assessment: 'incorrect', errors: [], guidance: [], citations: [{ pageNumber: 1 }], pageNumber: 1, region: null }
      ]
    };
    const db = {
      agentAttachmentAnalysis: { findFirst: async () => analysis },
      agentAttachmentEvidenceCandidate: {
        findFirst: async ({ where }) => state.candidates.find((row) => row.analysisItemId === where.analysisItemId) || null,
        create: async ({ data }) => { const row = { id: `candidate-${state.candidates.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data }; state.candidates.push(row); return row; }
      },
      cscaExamTopic: { findMany: async () => [{ id: 11, code: 'algebra', title: 'Algebra', module: null }] },
      agentMessage: { findFirst: async () => state.message, update: async ({ data }) => (state.message = { ...state.message, ...data }) },
      agentConversation: { update: async () => ({}) }
    };
    const matcher = { ensure: async (_userId, _analysis, item) => { state.matcherItems.push(item.id); return { status: 'no_match', promptScore: 0, matchSnapshot: {} }; } };
    const service = new AgentAttachmentEvidenceService(db, { isWebEnabled: () => true, isAttachmentEvidenceEnabled: () => true, isTrustedQuestionMatchEnabled: () => true }, { isEnabled: () => true }, {}, {}, {}, matcher);
    const rows = await service.ensureForAnalysis(7, 'analysis-multi');
    assert.equal(rows.length, 2);
    assert.deepEqual(state.matcherItems, ['item-1', 'item-2']);
    assert.equal(rows[0].analysisItemId, 'item-1');
    assert.equal(rows[0].sourceSnapshot.analysis.region.x, .1);
    assert.equal(rows[1].sourceSnapshot.analysis.region, null);
    assert.equal(state.message.content.evidenceCandidates.length, 2);
    assert.equal('evidenceCandidate' in state.message.content, false);
  }

  const success = serviceWith(baseCandidate());
  const confirmed = await success.service.confirm(7, 'candidate-1', { clientRequestId: 'request-confirm-1', topicId: 11, confirmRecognition: true, confirmAssessment: true });
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.evidenceId, 'evidence-1');
  assert.equal(confirmed.decisionChanged, true);
  assert.equal(success.state.writtenEvidence.questionQualityConfidence, 0.5);

  const trustedMatch = { status: 'verified_answer', sourceType: 'csca_source_question', sourceId: '81', sourceVersion: 1, sourceTitle: 'CSCA 真题 · 12', subjectCode: 'chemistry', topicId: 11, promptScore: 0.94, correctAnswerHash: 'abcdef1234567890abcdef', verifiedOutcome: 'correct', matcherVersion: 'agent-question-match-v1', matchSnapshot: { selectedTrustTier: 'governed_auto_approved' } };
  const trusted = serviceWith(baseCandidate({ outcome: 'correct', confidence: 0.94 }), trustedMatch);
  const trustedConfirmed = await trusted.service.confirm(7, 'candidate-1', { clientRequestId: 'request-trusted-1', topicId: 11, confirmRecognition: true, confirmAssessment: true });
  assert.equal(trustedConfirmed.status, 'confirmed');
  assert.equal(trusted.state.writtenEvidence.questionId, 'csca_source_question:81');
  assert.match(trusted.state.writtenEvidence.answerKeyVersion, /^trusted:csca_source_question:81:v1:/);
  assert.equal(trusted.state.writtenEvidence.questionQualityConfidence, 0.88);
  assert.equal(trusted.state.writtenEvidence.metadata.verification.tier, 'trusted_answer_key');
  assert.equal(trusted.state.writtenEvidence.metadata.verification.sourceGovernance, 'governed_auto_approved');

  const trustedWrongTopic = serviceWith(baseCandidate(), trustedMatch);
  await assert.rejects(() => trustedWrongTopic.service.confirm(7, 'candidate-1', { clientRequestId: 'request-trusted-2', topicId: 12, confirmRecognition: true, confirmAssessment: true }), /must match the trusted question source/i);

  const wrongOwner = serviceWith(baseCandidate());
  await assert.rejects(() => wrongOwner.service.confirm(8, 'candidate-1', { clientRequestId: 'request-confirm-2', topicId: 11, confirmRecognition: true, confirmAssessment: true }), /not found/i);

  const rejected = serviceWith(baseCandidate());
  const firstReject = await rejected.service.reject(7, 'candidate-1', { clientRequestId: 'request-reject-1' });
  const secondReject = await rejected.service.reject(7, 'candidate-1', { clientRequestId: 'request-reject-2' });
  assert.equal(firstReject.status, 'rejected');
  assert.equal(secondReject.status, 'rejected');

  const invalidTopic = serviceWith(baseCandidate());
  await assert.rejects(() => invalidTopic.service.confirm(7, 'candidate-1', { clientRequestId: 'request-confirm-3', topicId: 99, confirmRecognition: true, confirmAssessment: true }), /published topic/i);

  const revoked = serviceWith(baseCandidate({ status: 'confirmed', evidenceId: 'evidence-1' }));
  const result = await revoked.service.revoke(7, 'candidate-1', { clientRequestId: 'request-revoke-1' });
  assert.equal(result.status, 'revoked');
  assert.equal(result.decisionChanged, true);

  console.log('agent attachment evidence tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
