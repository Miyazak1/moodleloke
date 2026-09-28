const assert = require('node:assert/strict');
const { QuestionGeneratorProviderService } = require('../dist/backend/src/ai-questioning/question-generator-provider.service.js');
const { QuestionReviewerProviderService } = require('../dist/backend/src/ai-questioning/question-reviewer-provider.service.js');
const { QuestionTopicMapperProviderService } = require('../dist/backend/src/ai-questioning/question-topic-mapper-provider.service.js');
const { BuiltinAIQuestioningAdapter } = require('../dist/backend/src/question-engine-plugin/builtin-ai-questioning.adapter.js');
const { QuestionEnginePluginRegistryService } = require('../dist/backend/src/question-engine-plugin/question-engine-plugin-registry.service.js');

Object.assign(process.env, {
  CSCA_SUBJECT_PRACTICE_LOCAL_GENERATOR_SHADOW_ENABLED: 'false',
  CSCA_AI_QUESTION_BLIND_REVIEW_ENABLED: 'true',
  QUESTION_ENGINE_PLUGIN_ENABLED: 'true',
  QUESTION_ENGINE_PLUGIN_ID: 'moodlelike-ai-questioning',
  QUESTION_ENGINE_EXECUTION_MODE: 'sidecar',
  QUESTION_ENGINE_SIDECAR_URL: 'http://question-engine-worker:3100/v1/tasks/execute',
  QUESTION_ENGINE_SIDECAR_ACTIVATION_ENABLED: 'true',
  QUESTION_ENGINE_TASK_HMAC_SECRET: 'test-sidecar-routing-secret-1234567890',
  QUESTION_ENGINE_TASK_KEY_ID: 'routing-test',
  QUESTION_ENGINE_NONCE_REDIS_URL: 'redis://redis:6379',
  QUESTION_ENGINE_WORKER_CAPABILITIES: 'question.generate,question.review,question.topic-map',
  QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: '1.0.0',
  CSCA_AI_QUESTION_GENERATION_ENABLED: 'true',
  CSCA_AI_QUESTION_REVIEW_ENABLED: 'true',
  CSCA_AI_TOPIC_MAPPING_ENABLED: 'true',
  CSCA_SUBJECT_PRACTICE_PRODUCTION_ENABLED: 'true',
  AI_DEFAULT_PROVIDER: 'deepseek',
  DEEPSEEK_BACKGROUND_DEFAULT_MODEL: 'deepseek-chat',
  DEEPSEEK_BACKGROUND_API_KEYS: 'sk-test'
});

const calls = [];
const transport = {
  execute: async ({ capability, payload }) => {
    calls.push({ capability, payload });
    return { routed: capability, operation: payload.operation };
  }
};
const registry = new QuestionEnginePluginRegistryService(new BuiltinAIQuestioningAdapter(), transport);
const gateway = {
  hasConfiguredKey: () => { throw new Error('host_gateway_must_not_be_read_in_sidecar_mode'); },
  complete: async () => { throw new Error('host_gateway_must_not_execute_in_sidecar_mode'); }
};
const promptBuilder = {
  build: () => ({ messages: [], metadata: { promptVersion: 'test' } })
};
const blueprint = {
  id: 42, subject: 'math', topicId: 7, topicTitle: 'Functions', syllabusVersion: '2026',
  difficulty: 'medium', questionType: 'single_choice', allowedQuestionTypes: ['single_choice'],
  constraints: {}, knowledgeTags: [], learningObjectives: []
};
const candidate = {
  subject: 'math', topicId: 7, blueprintId: 42, sourceType: 'ai', designedDifficulty: 'medium',
  questionType: 'single_choice', prompt: '1+1=?',
  options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }, { id: 'D', text: '4' }],
  correctAnswer: 'B', explanation: '1+1=2', knowledgeTags: ['addition'], syllabusVersion: '2026'
};

(async () => {
  assert.equal(registry.getProductionReadiness().status, 'ready');
  assert.equal(registry.allowsProductionCapability('question.generate'), true);
  const generator = new QuestionGeneratorProviderService(promptBuilder, gateway, registry);
  assert.deepEqual(await generator.generate(blueprint, candidate), { routed: 'question.generate', operation: 'generate' });

  const reviewer = new QuestionReviewerProviderService(gateway, registry);
  assert.deepEqual(await reviewer.review(candidate, { subject: 'math', topicId: 7 }), { routed: 'question.review', operation: 'review' });
  assert.deepEqual(await reviewer.reviewBlindAnswer(candidate, {
    subject: 'math', topicId: 7, generatorAgent: { provider: 'deepseek', model: 'model-a' }
  }), { routed: 'question.review', operation: 'reviewBlindAnswer' });

  const mapper = new QuestionTopicMapperProviderService(gateway, registry);
  const question = { id: 1, subject: 'math', questionNumber: '1', promptText: '1+1=?', options: candidate.options, correctAnswer: 'B', explanation: '1+1=2', analysis: null };
  const topics = [{ id: 7, code: 'MATH.ADD', title: 'Addition', module: null, examScope: null, description: null, skills: [], aliases: [], excludedScope: [] }];
  assert.deepEqual(await mapper.suggest(question, topics), { routed: 'question.topic-map', operation: 'suggest' });

  assert.deepEqual(calls.map((item) => `${item.capability}:${item.payload.operation}`), [
    'question.generate:generate',
    'question.review:review',
    'question.review:reviewBlindAnswer',
    'question.topic-map:suggest'
  ]);
  console.log('Question-engine provider sidecar routing tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
