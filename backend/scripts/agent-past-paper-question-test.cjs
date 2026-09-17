const assert = require('node:assert/strict');
const { AgentPastPaperQuestionService } = require('../dist/backend/src/agent/agent-past-paper-question.service');

function paper(overrides = {}) {
  return {
    slug: 'chemistry-2026-01', title: 'CSCA 2026 Chemistry', subject: 'chemistry',
    hasAnswers: true, hasSolutions: true,
    sourceDocument: {
      id: 51, status: 'active', sourceLabel: 'January 2026 official paper',
      usagePolicy: { allowQuestionDisplay: true, allowPromptRawText: true, allowExplanationReuse: true },
      questions: [
        { id: 502, questionNumber: '10', pageNumber: 5, promptText: 'Question ten', options: [], correctAnswer: 'B', explanation: 'Verified ten', topicCodes: [] },
        { id: 501, questionNumber: '2', pageNumber: 2, promptText: 'Question two', options: [{ key: 'A', text: 'Alpha' }], correctAnswer: 'A', explanation: 'Verified two', topicCodes: ['chemistry.atomic'] }
      ]
    },
    ...overrides
  };
}

function serviceFor(value) {
  return new AgentPastPaperQuestionService({ pastPaper: { async findFirst() { return value; } } });
}

async function main() {
  const service = serviceFor(paper());
  const index = await service.index('chemistry-2026-01');
  assert.equal(index.status, 'ready');
  assert.deepEqual(index.questions.map((item) => item.questionNumber), ['2', '10']);
  assert.equal(index.questions[0].pageNumber, 2);

  const question = await service.question('chemistry-2026-01', 501);
  assert.equal(question.question.questionNumber, '2');
  assert.equal(question.question.correctAnswer, 'A');
  assert.equal(question.citation.pageNumber, 2);

  await assert.rejects(() => service.question('chemistry-2026-01', 999), /不属于当前真题/);

  const unbound = await serviceFor(paper({ sourceDocument: null })).index('chemistry-2026-01');
  assert.equal(unbound.status, 'unavailable');
  assert.equal(unbound.reasonCode, 'source_not_bound');

  const restrictedPaper = paper();
  restrictedPaper.sourceDocument.usagePolicy.allowQuestionDisplay = false;
  const restricted = await serviceFor(restrictedPaper).index('chemistry-2026-01');
  assert.equal(restricted.reasonCode, 'source_display_not_allowed');
  await assert.rejects(() => serviceFor(restrictedPaper).question('chemistry-2026-01', 501), /不允许展示/);

  console.log('Agent past-paper question tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
