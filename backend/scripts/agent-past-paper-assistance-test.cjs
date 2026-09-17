const assert = require('node:assert/strict');
const { AgentPastPaperAssistanceService } = require('../dist/backend/src/agent/agent-past-paper-assistance.service');
const { RequestPastPaperAssistanceInputSchema } = require('../dist/backend/src/agent/agent.types');

const context = {
  paper: { slug: 'chemistry-2026-01', title: 'CSCA Chemistry', subject: 'chemistry' },
  source: { id: 7, label: 'Verified source' },
  question: {
    id: 51,
    questionNumber: '2',
    pageNumber: 3,
    prompt: 'Which substance is the acid?',
    options: [{ key: 'A', text: 'Hydrochloric acid' }, { key: 'B', text: 'Sodium chloride' }],
    correctAnswer: 'A',
    explanation: 'Hydrochloric acid donates a proton.',
    topicCodes: ['chemistry.acid-base']
  },
  citation: { paperSlug: 'chemistry-2026-01', sourceQuestionId: 51 }
};

async function main() {
  const gateway = { hasConfiguredKey() { return false; } };
  const service = new AgentPastPaperAssistanceService({}, {}, gateway);
  const policy = service.policy(context.question, true);
  assert.deepEqual(policy.availableActions.map((item) => `${item.level}:${item.action}`), [
    'A0:clarify_question', 'A1:recall_concept', 'A2:next_step_hint', 'A3:check_step', 'A6:show_full_solution'
  ]);
  assert.equal(policy.maxAllowedLevel, 'A6');

  const hint = await service.generate(1, 'request-1', 'next_step_hint', 'zh', undefined, context);
  assert.equal(hint.generatedByAI, false);
  assert.doesNotMatch(hint.content, /答案|Hydrochloric acid/);

  const concept = await service.generate(1, 'request-2', 'recall_concept', 'zh', undefined, context);
  assert.match(concept.content, /chemistry\.acid-base/);

  const solution = await service.generate(1, 'request-3', 'show_full_solution', 'zh', undefined, context);
  assert.match(solution.content, /答案：A/);
  assert.match(solution.content, /donates a proton/);

  assert.equal(service.leaksAnswer('答案是 A', 'A', context.question.options), true);
  assert.equal(service.leaksAnswer('Try identifying the proton donor.', 'A', context.question.options), false);

  assert.equal(RequestPastPaperAssistanceInputSchema.safeParse({
    clientRequestId: 'request-4', conversationId: 'conversation-1', action: 'check_step', studentWork: 'My step', language: 'en'
  }).success, true);
  assert.equal(RequestPastPaperAssistanceInputSchema.safeParse({
    clientRequestId: 'request-5', conversationId: 'conversation-1', action: 'invent_answer'
  }).success, false);

  console.log('Agent past-paper assistance tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
