const assert = require('node:assert/strict');
const { AgentPastPaperAttemptService } = require('../dist/backend/src/agent/agent-past-paper-attempt.service');

const context = {
  paper: { id: 71, slug: 'chemistry-2026-01', title: 'CSCA Chemistry', subject: 'chemistry', version: 2 },
  source: { id: 7, sourceLabel: 'Verified source' },
  question: {
    id: 51, questionNumber: '2', pageNumber: 3, promptText: 'Which substance is the acid?',
    options: [{ key: 'A', text: 'Hydrochloric acid' }, { key: 'B', text: 'Sodium chloride' }],
    correctAnswer: 'A', explanation: 'Verified explanation', topicCodes: ['chemistry.acid-base'],
    promptHash: 'prompt-hash', topicId: 12, syllabusVersion: 'v1', reviewStatus: 'approved', analysisConfidence: 0.9
  }
};

function harness(assistance = [], answerableIds = [51, 52]) {
  let attempt = null;
  let evidenceWrites = 0;
  const prisma = {
    agentConversation: { async findFirst() { return { id: 'conversation-1' }; } },
    pastPaper: { async findFirst() { return { id: context.paper.id, slug: context.paper.slug, title: context.paper.title, subject: context.paper.subject }; } },
    agentPastPaperAttempt: {
      async findMany() {
        return attempt ? [{ ...attempt, sourceQuestion: { ...context.question, topic: { id: 12, code: 'chemistry.acid-base', title: 'Acid-base reactions' } } }] : [];
      },
      async findUnique() { return attempt; },
      async findFirst(args) {
        if (args?.where?.id) return attempt && attempt.id === args.where.id ? { ...attempt, pastPaper: context.paper, sourceQuestion: { ...context.question, document: context.source } } : null;
        return null;
      },
      async findFirstOrThrow() { return { ...attempt, pastPaper: context.paper, sourceQuestion: { ...context.question, document: context.source } }; },
      async create({ data }) {
        attempt = { id: 'attempt-1', ...data, status: 'in_progress', selectedAnswer: null, outcome: null, usedAssistance: false, maxAssistanceLevel: null, timeSpentSeconds: null, evidenceStatus: 'pending', evidenceReasonCode: null, evidenceId: null, clientSubmitRequestId: null, startedAt: new Date(Date.now() - 5000), submittedAt: null };
        return attempt;
      },
      async updateMany({ where, data }) {
        if (!attempt || attempt.status !== where.status) return { count: 0 };
        attempt = { ...attempt, ...data };
        return { count: 1 };
      },
      async update({ data }) { attempt = { ...attempt, ...data }; return attempt; }
    },
    agentToolCall: { async findMany() { return assistance; } },
    async $transaction(operation) { return typeof operation === 'function' ? operation(prisma) : Promise.all(operation); }
  };
  const writer = { async appendInTransaction(_tx, input) { evidenceWrites += 1; assert.equal(input.sourceType, 'past_paper'); assert.equal(input.outcome, 'correct'); return { evidenceId: 'evidence-1', eventId: input.eventId, evidenceVersion: '1', projectedStateVersion: null, adaptationPending: true, duplicate: false }; } };
  const service = new AgentPastPaperAttemptService(prisma, {
    async gradableQuestion() { return context; },
    async index() {
      return {
        questions: [
          { id: 51, questionNumber: '2', canAnswer: answerableIds.includes(51) },
          { id: 52, questionNumber: '3', canAnswer: answerableIds.includes(52) },
          { id: 53, questionNumber: '4', canAnswer: false }
        ]
      };
    }
  }, { isEnabled() { return true; } }, writer, { async processPending() {} }, {
    async getLearningPrescription() {
      return {
        status: 'ready',
        prescription: {
          prescriptionId: 'rx-review', reasonSummary: 'Review the highest-priority gap.', confidence: 'high', estimatedMinutes: 15,
          tasks: [{ type: 'review', subject: 'chemistry', topicIds: [12], questionCount: 5, priority: 1 }]
        }
      };
    }
  });
  return { service, evidenceWrites: () => evidenceWrites };
}

async function main() {
  const independent = harness();
  const emptyProgress = await independent.service.progress(42, context.paper.slug, 'conversation-1');
  assert.equal(emptyProgress.status, 'not_started');
  assert.equal(emptyProgress.answerableQuestions, 2);
  assert.equal(emptyProgress.nextQuestionId, 51);
  const started = await independent.service.start(42, context.paper.slug, '51', { clientRequestId: 'start-1', conversationId: 'conversation-1' });
  assert.equal(started.attempt.status, 'in_progress');
  assert.equal(started.question.options.length, 2);
  const submitted = await independent.service.submit(42, started.attempt.id, { clientRequestId: 'submit-1', selectedAnswer: 'A' });
  assert.equal(submitted.attempt.outcome, 'correct');
  assert.equal(submitted.attempt.evidenceStatus, 'recorded');
  assert.equal(independent.evidenceWrites(), 1);
  const progress = await independent.service.progress(42, context.paper.slug, 'conversation-1');
  assert.equal(progress.status, 'in_progress');
  assert.equal(progress.submittedCount, 1);
  assert.equal(progress.correctCount, 1);
  assert.equal(progress.evidenceCount, 1);
  assert.equal(progress.nextQuestionId, 52);
  assert.equal(progress.items.find((item) => item.questionId === 53).canAnswer, false);
  await assert.rejects(() => independent.service.review(42, context.paper.slug, 'conversation-1'), /完成全部可作答题/);

  const completed = harness([], [51]);
  const completedStart = await completed.service.start(42, context.paper.slug, '51', { clientRequestId: 'start-review', conversationId: 'conversation-1' });
  await completed.service.submit(42, completedStart.attempt.id, { clientRequestId: 'submit-review', selectedAnswer: 'A' });
  const review = await completed.service.review(42, context.paper.slug, 'conversation-1');
  assert.equal(review.summary.accuracy, 100);
  assert.equal(review.summary.independentCount, 1);
  assert.equal(review.focusTopics.length, 0);
  assert.equal(review.decision.primaryTask.type, 'review');
  assert.equal(review.provenance.automaticQuestionGenerationInvoked, false);

  const assisted = harness([{ input: { slug: context.paper.slug, questionId: 51 }, output: { action: 'next_step_hint', level: 'A2' } }], [51]);
  const assistedStart = await assisted.service.start(42, context.paper.slug, '51', { clientRequestId: 'start-2', conversationId: 'conversation-1' });
  const assistedResult = await assisted.service.submit(42, assistedStart.attempt.id, { clientRequestId: 'submit-2', selectedAnswer: 'B' });
  assert.equal(assistedResult.attempt.outcome, 'incorrect');
  assert.equal(assistedResult.attempt.evidenceStatus, 'not_eligible');
  assert.equal(assistedResult.attempt.evidenceReasonCode, 'ASSISTANCE_USED');
  assert.equal(assistedResult.attempt.maxAssistanceLevel, 'A2');
  assert.equal(assisted.evidenceWrites(), 0);
  const assistedReview = await assisted.service.review(42, context.paper.slug, 'conversation-1');
  assert.equal(assistedReview.summary.incorrectCount, 1);
  assert.equal(assistedReview.summary.assistedCount, 1);
  assert.deepEqual(assistedReview.focusTopics[0], {
    topicId: 12, code: 'chemistry.acid-base', title: 'Acid-base reactions', attemptedCount: 1, incorrectCount: 1, assistedCount: 1
  });

  console.log('Agent past-paper attempt tests passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
