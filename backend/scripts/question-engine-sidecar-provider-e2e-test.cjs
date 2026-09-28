const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { BUILTIN_QUESTION_ENGINE_PLUGIN_DESCRIPTOR: plugin } = require('../dist/backend/src/question-engine-plugin/builtin-ai-questioning.adapter.js');
const { QuestionEngineSidecarTransportService } = require('../dist/backend/src/question-engine-plugin/question-engine-sidecar-transport.service.js');
const { createQuestionEngineWorkerCapabilityHandler } = require('../dist/backend/src/question-engine-worker/capability-handler.js');
const { createQuestionEngineWorkerServer } = require('../dist/backend/src/question-engine-worker/main.js');

const secret = 'question-engine-provider-e2e-secret-1234567890';
const keyId = 'provider-e2e';

class MemoryStore {
  constructor() { this.nonces = new Set(); this.results = new Map(); }
  async claim(key) { if (this.nonces.has(key)) return false; this.nonces.add(key); return true; }
  async getCompletedResult(taskId) { return this.results.get(taskId) ?? null; }
  async cacheCompletedResult(taskId, value) { this.results.set(taskId, value); return true; }
}

function providerOutput(systemPrompt) {
  if (systemPrompt.includes('Solve this CSCA multiple-choice question independently')) {
    return {
      selectedOptionId: 'B',
      optionVerdicts: [
        { optionId: 'A', verdict: 'false', reason: 'One is not the sum.' },
        { optionId: 'B', verdict: 'true', reason: 'One plus one equals two.' },
        { optionId: 'C', verdict: 'false', reason: 'Three is too large.' },
        { optionId: 'D', verdict: 'false', reason: 'Four is too large.' }
      ],
      solution: 'Add the two unit quantities.', confidence: 0.99, abstainReason: null
    };
  }
  if (systemPrompt.includes('strict CSCA question reviewer')) {
    const passed = ['syllabus_alignment', 'single_correct_answer', 'option_mutual_exclusion', 'explanation_supports_answer',
      'difficulty_match', 'prompt_leakage', 'duplicate_risk', 'distractor_quality', 'domain_sanity'];
    return {
      decision: 'approve', score: 96, issues: [],
      rubric: {
        syllabusAlignment: 96, answerCorrectness: 100, optionQuality: 92, explanationQuality: 95,
        difficultyMatch: 95, languageQuality: 96, styleAlignment: 94, examLikeDifficulty: 94, pastPaperSimilarityRisk: 5
      },
      dimensions: passed.map((key) => ({ key, status: 'passed', note: 'Contract fixture passed.' }))
    };
  }
  if (systemPrompt.includes('map CSCA past-paper questions')) {
    return { suggestions: [{ topicCode: 'MATH.ADD', confidence: 0.98, reason: 'The item directly tests addition.' }] };
  }
  return {
    prompt: 'What is 1 + 1?',
    options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }, { id: 'C', text: '3' }, { id: 'D', text: '4' }],
    correctAnswer: 'B', explanation: 'Adding one and one gives two.', knowledgeTags: ['addition']
  };
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  server.close();
  await once(server, 'close');
}

async function main() {
  let providerCalls = 0;
  const provider = http.createServer(async (request, response) => {
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/chat/completions');
    assert.equal(request.headers.authorization, 'Bearer sk-local-contract-only');
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const systemPrompt = String(body.messages?.find((message) => message.role === 'system')?.content ?? '');
    providerCalls += 1;
    const content = JSON.stringify(providerOutput(systemPrompt));
    const serialized = JSON.stringify({
      id: `fake-${providerCalls}`, object: 'chat.completion', model: body.model,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }],
      usage: { prompt_tokens: 20, completion_tokens: 20, total_tokens: 40 }
    });
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(serialized) });
    response.end(serialized);
  });
  const providerBaseUrl = await listen(provider);

  Object.assign(process.env, {
    AI_GATEWAY_ENABLED: 'true', AI_GATEWAY_LEDGER_ENABLED: 'false', AI_DEFAULT_PROVIDER: 'deepseek',
    DEEPSEEK_BACKGROUND_API_KEYS: 'sk-local-contract-only', DEEPSEEK_BACKGROUND_DEFAULT_MODEL: 'deepseek-chat',
    CSCA_AI_QUESTION_GENERATION_ENABLED: 'true', CSCA_AI_QUESTION_REVIEW_ENABLED: 'true',
    CSCA_AI_QUESTION_BLIND_REVIEW_ENABLED: 'true', CSCA_AI_TOPIC_MAPPING_ENABLED: 'true',
    CSCA_AI_QUESTION_GENERATION_BASE_URL: providerBaseUrl,
    CSCA_AI_QUESTION_REVIEW_BASE_URL: providerBaseUrl,
    CSCA_AI_TOPIC_MAPPING_BASE_URL: providerBaseUrl,
    QUESTION_ENGINE_TASK_HMAC_SECRET: secret, QUESTION_ENGINE_TASK_KEY_ID: keyId,
    QUESTION_ENGINE_WORKER_ID: 'provider-e2e-worker', QUESTION_ENGINE_WORKER_VERSION: '1.0.0',
    QUESTION_ENGINE_ACCEPTED_WORKER_VERSIONS: '1.0.0'
  });

  const worker = createQuestionEngineWorkerServer({
    store: new MemoryStore(),
    supportedCapabilities: ['question.generate', 'question.review', 'question.topic-map'],
    handler: createQuestionEngineWorkerCapabilityHandler()
  });
  const workerBaseUrl = await listen(worker);
  Object.assign(process.env, {
    QUESTION_ENGINE_EXECUTION_MODE: 'sidecar', QUESTION_ENGINE_SIDECAR_URL: `${workerBaseUrl}/v1/tasks/execute`,
    QUESTION_ENGINE_SIDECAR_TIMEOUT_MS: '3000'
  });
  const hostResultNonces = new Set();
  const transport = new QuestionEngineSidecarTransportService({
    claim: async (key) => { if (hostResultNonces.has(key)) return false; hostResultNonces.add(key); return true; }
  });
  const blueprint = {
    id: 42, subject: 'math', topicId: 7, topicTitle: 'Addition', syllabusVersion: '2026',
    difficulty: 'easy', questionType: 'single_choice', allowedQuestionTypes: ['single_choice'],
    constraints: {}, knowledgeTags: ['addition'], learningObjectives: ['Add small integers']
  };
  const fallback = {
    subject: 'math', topicId: 7, blueprintId: 42, sourceType: 'ai', designedDifficulty: 'easy',
    questionType: 'single_choice', prompt: 'Fallback prompt',
    options: [{ id: 'A', text: '0' }, { id: 'B', text: '1' }, { id: 'C', text: '2' }, { id: 'D', text: '3' }],
    correctAnswer: 'C', explanation: 'Fallback explanation', knowledgeTags: ['addition'], syllabusVersion: '2026'
  };
  try {
    const generated = await transport.execute({
      capability: 'question.generate', plugin,
      payload: { operation: 'generate', blueprint, fallback, options: { maxProviderAttempts: 1 } }
    });
    assert.equal(generated.status, 'success');
    assert.equal(generated.provider, 'deepseek');
    assert.equal(generated.candidate.correctAnswer, 'B');
    assert.equal(generated.candidate.prompt, 'What is 1 + 1?');

    const candidate = generated.candidate;
    const reviewed = await transport.execute({
      capability: 'question.review', plugin,
      payload: { operation: 'review', candidate, context: { subject: 'math', topicId: 7 } }
    });
    assert.equal(reviewed.provider.status, 'success');
    assert.equal(reviewed.decision, 'approve');
    assert.equal(reviewed.dimensions.length, 9);

    const blind = await transport.execute({
      capability: 'question.review', plugin,
      payload: { operation: 'reviewBlindAnswer', candidate, context: { subject: 'math', topicId: 7, generatorAgent: { provider: 'fixture-generator', model: 'fixture-model' } } }
    });
    assert.equal(blind.status, 'completed');
    assert.equal(blind.selectedOptionId, 'B');
    assert.equal(blind.agreesWithGenerator, true);

    const mapped = await transport.execute({
      capability: 'question.topic-map', plugin,
      payload: {
        operation: 'suggest',
        question: { id: 1, subject: 'math', questionNumber: '1', promptText: candidate.prompt, options: candidate.options, correctAnswer: 'B', explanation: candidate.explanation, analysis: null },
        topics: [{ id: 7, code: 'MATH.ADD', title: 'Addition', module: null, examScope: null, description: null, skills: [], aliases: [], excludedScope: [] }]
      }
    });
    assert.equal(mapped.status, 'success');
    assert.equal(mapped.suggestions[0].topicCode, 'MATH.ADD');
    assert.equal(providerCalls, 4);
    console.log('Question-engine sidecar fake-provider E2E contract tests passed.');
  } finally {
    await close(worker);
    await close(provider);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
