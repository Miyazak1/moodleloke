const assert = require('node:assert/strict');
const {
  AgentTrustedQuestionMatcherService,
  normalizeQuestionText,
  trustedQuestionSimilarity,
  verifyExtractedAnswer
} = require('../dist/backend/src/agent/agent-trusted-question-matcher.service');

function source(id, prompt, answer = 'B') {
  return {
    id, questionNumber: String(id), promptText: prompt,
    options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }, { id: 'D', text: '4' }],
    correctAnswer: answer, subject: 'math', topicId: 11, reviewStatus: 'auto_approved', updatedAt: new Date(), document: { title: 'CSCA 2026 真题' }
  };
}

function matcherWith(sources, approved = []) {
  let saved = null;
  const calls = [];
  const prisma = {
    agentAttachmentQuestionMatch: {
      findFirst: async () => saved,
      create: async ({ data }) => (saved = { id: 'match-1', createdAt: new Date(), updatedAt: new Date(), ...data })
    },
    cscaSourceQuestion: { findMany: async (args) => (calls.push(args), sources.filter((row) => row.subject === args.where.subject.equals)) },
    cscaQuestion: { findMany: async (args) => (calls.push(args), approved.filter((row) => row.subject === args.where.subject.equals)) }
  };
  return { matcher: new AgentTrustedQuestionMatcherService(prisma), calls, saved: () => saved };
}

(async () => {
  const prompt = '若函数 f(x)=x²+1，则 f(1) 的值为多少？';
  assert.equal(normalizeQuestionText(`  ${prompt}\n`), normalizeQuestionText(prompt));
  assert.equal(trustedQuestionSimilarity(prompt, prompt), 1);
  assert.ok(trustedQuestionSimilarity('若函数f(x) = x² + 1, 则f(1)的值为多少?', prompt) > 0.82);
  assert.ok(trustedQuestionSimilarity(`${prompt} A. 1 B. 2 C. 3 D. 4`, prompt) > 0.82);
  assert.ok(trustedQuestionSimilarity('计算一辆汽车的加速度', prompt) < 0.45);
  assert.equal(verifyExtractedAnswer('B', 'B', []), 'correct');
  assert.equal(verifyExtractedAnswer('3', 'B', source(1, prompt).options), 'incorrect');
  assert.equal(verifyExtractedAnswer('', 'B', []), null);

  const verifiedStore = matcherWith([source(1, prompt), source(2, '完全不同的概率统计题目，求事件发生概率。', 'A')]);
  const verified = await verifiedStore.matcher.ensure(7, { id: 'analysis-1', result: { subject: 'math', questionText: prompt, studentAnswer: 'B' } });
  assert.equal(verified.status, 'verified_answer');
  assert.equal(verified.sourceType, 'csca_source_question');
  assert.equal(verified.sourceId, '1');
  assert.equal(verified.verifiedOutcome, 'correct');
  assert.equal(verifiedStore.saved().correctAnswer, undefined, 'raw answer keys must not be copied to match audit rows');
  assert.equal(verifiedStore.saved().matchSnapshot.automaticQuestionGenerationInvoked, false);
  assert.deepEqual(verifiedStore.calls[0].where.reviewStatus.in, ['approved', 'auto_approved']);
  assert.equal(verifiedStore.calls[0].where.document.status, 'active');
  assert.equal(verifiedStore.calls[1].where.status, 'approved');

  const ambiguousStore = matcherWith([source(1, prompt), source(2, prompt)]);
  const ambiguous = await ambiguousStore.matcher.ensure(7, { id: 'analysis-2', result: { subject: 'math', questionText: prompt, studentAnswer: 'B' } });
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.sourceId, null);

  const missingAnswerStore = matcherWith([source(1, prompt)]);
  const missingAnswer = await missingAnswerStore.matcher.ensure(7, { id: 'analysis-3', result: { subject: 'math', questionText: prompt, studentAnswer: '' } });
  assert.equal(missingAnswer.status, 'answer_missing');

  const unknownSubjectStore = matcherWith([source(1, prompt)]);
  const unknownSubject = await unknownSubjectStore.matcher.ensure(7, { id: 'analysis-4', result: { subject: 'unknown', questionText: prompt, studentAnswer: 'B' } });
  assert.equal(unknownSubject.status, 'verified_answer');
  assert.equal(unknownSubject.subjectCode, 'math');
  assert.equal(unknownSubjectStore.saved().matchSnapshot.subjectResolution, 'trusted_source_match');
  assert.equal(unknownSubjectStore.calls.length, 6, 'unknown subjects must search all three governed subject corpora');

  const unknownNoMatchStore = matcherWith([]);
  const unknownNoMatch = await unknownNoMatchStore.matcher.ensure(7, { id: 'analysis-5', result: { subject: 'unknown', questionText: 'This is a sufficiently long unmatched prompt.', studentAnswer: 'B' } });
  assert.equal(unknownNoMatch.status, 'no_match');
  assert.equal(unknownNoMatch.subjectCode, null);

  console.log('agent trusted question match tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
