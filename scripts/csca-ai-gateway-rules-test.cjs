require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const { AiGatewayConfigService } = require('../backend/src/ai-gateway/ai-gateway-config.service');
const { AiGatewayConcurrencyService } = require('../backend/src/ai-gateway/ai-gateway-concurrency.service');
const { AiGatewayCostService } = require('../backend/src/ai-gateway/ai-gateway-cost.service');
const { AiGatewayKeyPoolService } = require('../backend/src/ai-gateway/ai-gateway-key-pool.service');
const { AiGatewayMonitorService } = require('../backend/src/ai-gateway/ai-gateway-monitor.service');
const { AiGatewayService, createStandaloneAiGatewayService } = require('../backend/src/ai-gateway/ai-gateway.service');
const { openAiCompatibleChatCompletion } = require('../backend/src/ai-gateway/providers/openai-compatible-http');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, got ${actual}.`);
}

async function withEnv(env, fn) {
  const keys = [
    'AI_GATEWAY_ENABLED',
    'AI_GATEWAY_LEDGER_ENABLED',
    'AI_GATEWAY_GLOBAL_CONCURRENCY',
    'AI_GATEWAY_REALTIME_CONCURRENCY',
    'AI_GATEWAY_BACKGROUND_CONCURRENCY',
    'AI_GATEWAY_QUEUE_TIMEOUT_MS',
    'AI_GATEWAY_REALTIME_QUEUE_TIMEOUT_MS',
    'AI_GATEWAY_BACKGROUND_QUEUE_TIMEOUT_MS',
    'AI_GATEWAY_REALTIME_KEY_WAIT_TIMEOUT_MS',
    'AI_GATEWAY_BACKGROUND_KEY_WAIT_TIMEOUT_MS',
    'DEEPSEEK_API_KEYS',
    'DEEPSEEK_BACKGROUND_API_KEYS',
    'DEEPSEEK_PERSONAL_API_KEYS',
    'DEEPSEEK_BASE_URL',
    'DEEPSEEK_BACKGROUND_BASE_URL',
    'DEEPSEEK_PERSONAL_BASE_URL',
    'DEEPSEEK_DEFAULT_MODEL',
    'DEEPSEEK_BACKGROUND_DEFAULT_MODEL',
    'DEEPSEEK_PERSONAL_DEFAULT_MODEL',
    'DEEPSEEK_KEY_CONCURRENCY',
    'DEEPSEEK_BACKGROUND_KEY_CONCURRENCY',
    'DEEPSEEK_PERSONAL_KEY_CONCURRENCY',
    'DEEPSEEK_REQUESTS_PER_MINUTE',
    'DEEPSEEK_BACKGROUND_REQUESTS_PER_MINUTE',
    'DEEPSEEK_PERSONAL_REQUESTS_PER_MINUTE',
    'DEEPSEEK_REQUESTS_PER_DAY',
    'DEEPSEEK_BACKGROUND_REQUESTS_PER_DAY',
    'DEEPSEEK_PERSONAL_REQUESTS_PER_DAY',
    'AI_GATEWAY_COST_CURRENCY',
    'AI_GATEWAY_DISPLAY_CURRENCY',
    'AI_GATEWAY_USD_CNY_RATE',
    'DEEPSEEK_V4_FLASH_INPUT_COST_PER_1M_TOKENS',
    'DEEPSEEK_V4_FLASH_OUTPUT_COST_PER_1M_TOKENS',
    'DEEPSEEK_V4_PRO_INPUT_COST_PER_1M_TOKENS',
    'DEEPSEEK_V4_PRO_OUTPUT_COST_PER_1M_TOKENS',
    'DEEPSEEK_CHAT_INPUT_COST_PER_1M_TOKENS',
    'DEEPSEEK_CHAT_OUTPUT_COST_PER_1M_TOKENS',
    'DEEPSEEK_REASONER_INPUT_COST_PER_1M_TOKENS',
    'DEEPSEEK_REASONER_OUTPUT_COST_PER_1M_TOKENS',
    'CSCA_AI_API_KEY',
    'CSCA_AI_MODEL',
    'CSCA_AI_BASE_URL',
    'CSCA_AI_QUESTION_GENERATION_API_KEY',
    'CSCA_AI_QUESTION_GENERATION_MODEL',
    'CSCA_AI_QUESTION_GENERATION_BASE_URL'
  ];
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, env);
  try {
    await fn();
  } finally {
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    global.fetch = originalFetch;
  }
}

async function testConfigParsing() {
  await withEnv({
    DEEPSEEK_BACKGROUND_API_KEYS: 'background-a, background-b',
    DEEPSEEK_PERSONAL_API_KEYS: 'personal-a',
    DEEPSEEK_BACKGROUND_BASE_URL: 'https://background.deepseek.test/',
    DEEPSEEK_PERSONAL_BASE_URL: 'https://personal.deepseek.test/',
    DEEPSEEK_BACKGROUND_DEFAULT_MODEL: 'deepseek-background',
    DEEPSEEK_PERSONAL_DEFAULT_MODEL: 'deepseek-personal',
    DEEPSEEK_BACKGROUND_KEY_CONCURRENCY: '4',
    DEEPSEEK_PERSONAL_KEY_CONCURRENCY: '1',
    DEEPSEEK_BACKGROUND_REQUESTS_PER_MINUTE: '80',
    DEEPSEEK_PERSONAL_REQUESTS_PER_MINUTE: '30'
  }, async () => {
    const config = new AiGatewayConfigService();
    const backgroundKeys = config.platformKeysForTask('question_generation');
    const topicMappingKeys = config.platformKeysForTask('topic_mapping');
    const personalKeys = config.platformKeysForTask('ai_coach_hint');
    assertEqual(backgroundKeys.length, 2, 'Background AI tasks must use the dedicated background key pool.');
    assertEqual(topicMappingKeys.length, 2, 'Source topic mapping must use the dedicated background key pool.');
    assertEqual(personalKeys.length, 1, 'Student personal AI tasks must use the dedicated personal key pool.');
    assertEqual(backgroundKeys[0].apiKey, 'background-a', 'Question generation must not consume personal DeepSeek keys.');
    assertEqual(topicMappingKeys[0].apiKey, 'background-a', 'Source topic mapping must not consume personal DeepSeek keys.');
    assertEqual(personalKeys[0].apiKey, 'personal-a', 'AI Coach must not consume background DeepSeek keys.');
    assertEqual(backgroundKeys[0].pool, 'background', 'Background keys must expose their pool for observability.');
    assertEqual(topicMappingKeys[0].pool, 'background', 'Topic mapping keys must expose the background pool for observability.');
    assertEqual(personalKeys[0].pool, 'personal', 'Personal keys must expose their pool for observability.');
    assert(backgroundKeys[0].keyId.includes('env-background'), 'Background key ids must include the pool without exposing raw keys.');
    assert(personalKeys[0].keyId.includes('env-personal'), 'Personal key ids must include the pool without exposing raw keys.');
    assertEqual(backgroundKeys[0].baseUrl, 'https://background.deepseek.test', 'Background pool must use its own base URL.');
    assertEqual(personalKeys[0].baseUrl, 'https://personal.deepseek.test', 'Personal pool must use its own base URL.');
    assertEqual(backgroundKeys[0].model, 'deepseek-background', 'Background pool must use its own default model.');
    assertEqual(personalKeys[0].model, 'deepseek-personal', 'Personal pool must use its own default model.');
    assertEqual(backgroundKeys[0].maxConcurrency, 4, 'Background pool must use its own key concurrency.');
    assertEqual(personalKeys[0].maxConcurrency, 1, 'Personal pool must use its own key concurrency.');
    assertEqual(backgroundKeys[0].requestsPerMinute, 80, 'Background pool must use its own RPM limit.');
    assertEqual(personalKeys[0].requestsPerMinute, 30, 'Personal pool must use its own RPM limit.');
  });

  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a, deepseek-b',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test/',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    DEEPSEEK_KEY_CONCURRENCY: '3'
  }, async () => {
    const config = new AiGatewayConfigService();
    const keys = config.platformKeysForTask('question_generation');
    assertEqual(keys.length, 2, 'Gateway must parse comma-separated DeepSeek key pools.');
    assertEqual(keys[0].baseUrl, 'https://api.deepseek.test', 'Gateway must normalize DeepSeek base URL.');
    assertEqual(keys[0].model, 'deepseek-chat', 'Gateway must apply DeepSeek default model.');
    assertEqual(keys[0].maxConcurrency, 3, 'Gateway must apply key concurrency from env.');
    assertEqual(keys[0].pool, 'legacy', 'Global DEEPSEEK_API_KEYS must remain a legacy compatibility pool.');
    assert(!keys[0].keyId.includes('deepseek-a'), 'Gateway keyId must not expose the raw API key.');
  });

  await withEnv({
    CSCA_AI_QUESTION_GENERATION_API_KEY: 'legacy-generation-key',
    CSCA_AI_QUESTION_GENERATION_MODEL: 'legacy-model',
    CSCA_AI_QUESTION_GENERATION_BASE_URL: 'https://legacy.example.test/v1'
  }, async () => {
    const config = new AiGatewayConfigService();
    const keys = config.platformKeysForTask('question_generation');
    assertEqual(keys.length, 1, 'Gateway must keep legacy question generation key compatibility.');
    assertEqual(keys[0].model, 'legacy-model', 'Gateway must keep legacy question generation model compatibility.');
    assertEqual(keys[0].baseUrl, 'https://legacy.example.test/v1', 'Gateway must keep legacy base URL compatibility.');
  });

  await withEnv({
    AI_GATEWAY_QUEUE_TIMEOUT_MS: '5000'
  }, async () => {
    const config = new AiGatewayConfigService();
    assertEqual(config.realtimeQueueTimeoutMs(), 5000, 'Realtime AI queue should keep the short default wait.');
    assertEqual(config.backgroundQueueTimeoutMs(), 120000, 'Background AI queue should not inherit the realtime 5s wait.');
  });

  await withEnv({
    AI_GATEWAY_BACKGROUND_QUEUE_TIMEOUT_MS: '45000'
  }, async () => {
    const config = new AiGatewayConfigService();
    assertEqual(config.backgroundQueueTimeoutMs(), 45000, 'Background AI queue wait must be configurable independently.');
  });

  await withEnv({
    AI_GATEWAY_BACKGROUND_KEY_WAIT_TIMEOUT_MS: '90000',
    AI_GATEWAY_REALTIME_KEY_WAIT_TIMEOUT_MS: '1500'
  }, async () => {
    const config = new AiGatewayConfigService();
    assertEqual(config.backgroundKeyWaitTimeoutMs(), 90000, 'Background AI key-pool wait must be configurable separately from task chunk size.');
    assertEqual(config.realtimeKeyWaitTimeoutMs(), 1500, 'Realtime AI key-pool wait must stay independently configurable.');
  });
}

async function testCostEstimation() {
  await withEnv({
    AI_GATEWAY_USD_CNY_RATE: '7.2',
    DEEPSEEK_V4_FLASH_INPUT_COST_PER_1M_TOKENS: '0.44',
    DEEPSEEK_V4_FLASH_OUTPUT_COST_PER_1M_TOKENS: '1.32',
    DEEPSEEK_V4_PRO_INPUT_COST_PER_1M_TOKENS: '1.32',
    DEEPSEEK_V4_PRO_OUTPUT_COST_PER_1M_TOKENS: '3.96',
    DEEPSEEK_CHAT_INPUT_COST_PER_1M_TOKENS: '0.25',
    DEEPSEEK_CHAT_OUTPUT_COST_PER_1M_TOKENS: '1.25',
    DEEPSEEK_REASONER_INPUT_COST_PER_1M_TOKENS: '0.5',
    DEEPSEEK_REASONER_OUTPUT_COST_PER_1M_TOKENS: '2'
  }, async () => {
    const cost = new AiGatewayCostService();
    const chat = cost.estimate({ model: 'deepseek-chat', promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assert(chat, 'Gateway cost service must estimate cost when token usage exists.');
    assertEqual(chat.estimatedCostUsd, 1.5, 'Gateway must estimate chat USD cost from configured per-1M prices.');
    assertEqual(chat.estimatedCostDisplay, 10.8, 'Gateway must convert chat USD cost to display currency.');
    assertEqual(chat.displayCurrency, 'CNY', 'Gateway display currency should default to CNY.');

    const reasoner = cost.estimate({ model: 'deepseek-reasoner', promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assert(reasoner, 'Gateway cost service must estimate reasoner cost.');
    assertEqual(reasoner.estimatedCostUsd, 2.5, 'Gateway must select reasoner pricing for reasoner models.');
    assertEqual(reasoner.estimatedCostDisplay, 18, 'Gateway must convert reasoner USD cost to display currency.');

    const flash = cost.estimate({ model: 'deepseek-v4-flash', promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assert(flash, 'Gateway cost service must estimate DeepSeek V4 Flash cost.');
    assertEqual(flash.estimatedCostUsd, 1.76, 'Gateway must select peak V4 Flash pricing for V4 Flash models.');

    const canonicalFlash = cost.estimate({ model: 'deepseek-flash', promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assert(canonicalFlash, 'Gateway cost service must estimate canonical DeepSeek Flash cost.');
    assertEqual(canonicalFlash.estimatedCostUsd, 1.76, 'Gateway must select peak Flash pricing for the canonical Flash model name.');

    const pro = cost.estimate({ model: 'deepseek-v4-pro', promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assert(pro, 'Gateway cost service must estimate DeepSeek V4 Pro cost.');
    assertEqual(pro.estimatedCostUsd, 5.28, 'Gateway must select peak V4 Pro pricing for V4 Pro models.');

    const missingTokens = cost.estimate({ model: 'deepseek-chat', promptTokens: null, completionTokens: 1000 });
    assertEqual(missingTokens, null, 'Gateway must not guess cost when token usage is incomplete.');
  });
}

async function testKeyPool() {
  const pool = new AiGatewayKeyPoolService();
  const key = {
    keyId: 'deepseek-env-test',
    providerId: 'deepseek',
    source: 'env',
    pool: 'legacy',
    apiKey: 'secret',
    baseUrl: 'https://api.deepseek.test',
    model: 'deepseek-chat',
    enabled: true,
    maxConcurrency: 1
  };
  const first = pool.reserve([key]);
  assert(first, 'Key pool must reserve a healthy key.');
  const second = pool.reserve([key]);
  assertEqual(second, null, 'Key pool must enforce per-key concurrency.');
  const saturated = pool.reserveWithDiagnostics([key]);
  assertEqual(saturated.miss.reason, 'all_keys_at_concurrency', 'Key pool must explain local concurrency saturation instead of returning an opaque no-key.');
  assertEqual(saturated.miss.retryable, true, 'Local key concurrency saturation must be treated as retryable inside the gateway.');
  await first.release({ status: 'success', latencyMs: 25 });
  const third = pool.reserve([key]);
  assert(third, 'Key pool must release concurrency after success.');
  await third.release({ status: 'failed', latencyMs: 25, errorCode: 'provider_rate_limited' });
  const cooled = pool.reserve([key]);
  assertEqual(cooled, null, 'Key pool must cooldown a rate-limited key.');
  const cooldown = pool.reserveWithDiagnostics([key]);
  assertEqual(cooldown.miss.reason, 'all_keys_cooling_down', 'Key pool must distinguish cooldown from missing keys.');

  const rpmPool = new AiGatewayKeyPoolService();
  const rpmKey = { ...key, keyId: 'deepseek-env-rpm-test', maxConcurrency: 2, requestsPerMinute: 1 };
  const rpmFirst = rpmPool.reserve([rpmKey]);
  assert(rpmFirst, 'Key pool must reserve the first request in the minute bucket.');
  await rpmFirst.release({ status: 'success', latencyMs: 25 });
  const rpmLimited = rpmPool.reserveWithDiagnostics([rpmKey]);
  assertEqual(rpmLimited.miss.reason, 'all_keys_rate_limited_minute', 'Key pool must distinguish local RPM saturation from absent provider keys.');
  assertEqual(rpmLimited.miss.retryable, true, 'Local RPM saturation must be retryable inside the gateway.');
}

async function testMonitorAggregationMapping() {
  await withEnv({
    AI_GATEWAY_USD_CNY_RATE: '7.2'
  }, async () => {
    const rowsByCall = [
      [{
        calls: 10,
        successCalls: 8,
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        averageLatencyMs: 1250,
        estimatedCostUsd: 0.5
      }],
      [{
        taskType: 'question_generation',
        sourceModule: 'ai-questioning',
        providerId: 'deepseek',
        model: 'deepseek-chat',
        calls: 5,
        successCalls: 4,
        totalTokens: 700,
        averageLatencyMs: 900,
        estimatedCostUsd: 0.2
      }],
      [{
        providerId: 'deepseek',
        keyId: 'deepseek-env-1-abcd1234',
        calls: 4,
        successCalls: 3,
        totalTokens: 600,
        averageLatencyMs: 800,
        estimatedCostUsd: 0.1,
        latestErrorCode: 'provider_rate_limited',
        latestErrorAt: new Date('2026-07-10T00:00:00.000Z')
      }],
      [{
        id: 7,
        requestId: 'request-7',
        taskType: 'question_generation',
        sourceModule: 'ai-questioning',
        providerId: 'deepseek',
        model: 'deepseek-chat',
        keyId: 'deepseek-env-1-abcd1234',
        status: 'provider_unavailable',
        errorCode: 'gateway_no_key_available',
        errorMessage: 'No AI provider key is available.',
        latencyMs: 0,
        createdAt: new Date('2026-07-10T01:00:00.000Z')
      }]
    ];
    const prisma = {
      $queryRaw: async () => rowsByCall.shift()
    };
    const monitor = new AiGatewayMonitorService(prisma, new AiGatewayCostService());

    const summary = await monitor.summary({ days: '7' });
    assertEqual(summary.summary.calls, 10, 'Gateway summary must expose call count.');
    assertEqual(summary.summary.failedCalls, 2, 'Gateway summary must derive failed calls.');
    assertEqual(summary.summary.successRate, 0.8, 'Gateway summary must derive success rate.');
    assertEqual(summary.summary.estimatedCostDisplay, 3.6, 'Gateway summary must convert USD cost to display currency.');

    const byTask = await monitor.byTask({ days: '7' });
    assertEqual(byTask.items[0].failedCalls, 1, 'Gateway task aggregation must derive failed calls.');
    assertEqual(byTask.items[0].estimatedCostDisplay, 1.44, 'Gateway task aggregation must convert display cost.');

    const byKey = await monitor.byKey({ days: '7' });
    assertEqual(byKey.items[0].keyId, 'deepseek-env-1-abcd1234', 'Gateway key aggregation must keep masked key ids.');
    assertEqual(byKey.items[0].latestErrorAt, '2026-07-10T00:00:00.000Z', 'Gateway key aggregation must serialize latest error timestamps.');

    const errors = await monitor.errors({ days: '7', limit: '10' });
    assertEqual(errors.items[0].errorCode, 'gateway_no_key_available', 'Gateway errors endpoint must expose provider error code.');
    assertEqual(errors.items[0].createdAt, '2026-07-10T01:00:00.000Z', 'Gateway errors endpoint must serialize error timestamps.');
  });
}

async function testOpenAiCompatibleErrors() {
  await withEnv({}, async () => {
    global.fetch = async () => ({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: 'slow down' } })
    });
    const response = await openAiCompatibleChatCompletion({
      requestId: 'error-map',
      taskType: 'question_generation',
      messages: [{ role: 'user', content: 'test' }],
      model: 'deepseek-chat',
      apiKey: 'secret',
      baseUrl: 'https://api.deepseek.test',
      timeoutMs: 100
    });
    assertEqual(response.status, 'failed', 'HTTP 429 must fail the provider response.');
    assertEqual(response.errorCode, 'provider_rate_limited', 'HTTP 429 must map to provider_rate_limited.');
    assertEqual(response.errorMessage, 'slow down', 'Provider error message should be surfaced without keys.');

    global.fetch = async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: 'Insufficient Balance' } })
    });
    const quotaResponse = await openAiCompatibleChatCompletion({
      requestId: 'quota-error-map',
      taskType: 'question_generation',
      messages: [{ role: 'user', content: 'test' }],
      model: 'deepseek-chat',
      apiKey: 'secret',
      baseUrl: 'https://api.deepseek.test',
      timeoutMs: 100
    });
    assertEqual(quotaResponse.status, 'failed', 'Provider quota failures must fail the provider response.');
    assertEqual(quotaResponse.errorCode, 'provider_quota_exceeded', 'Insufficient Balance must map to provider_quota_exceeded, not provider_bad_request.');
    assertEqual(quotaResponse.errorMessage, 'Insufficient Balance', 'Provider quota message should be preserved for operator diagnosis.');

    const networkError = new TypeError('fetch failed for https://api.deepseek.test/chat/completions');
    networkError.cause = Object.assign(new Error('connect ECONNRESET 1.2.3.4:443'), { code: 'ECONNRESET' });
    global.fetch = async () => { throw networkError; };
    const networkResponse = await openAiCompatibleChatCompletion({
      requestId: 'network-error-diagnostic',
      taskType: 'question_generation',
      messages: [{ role: 'user', content: 'test' }],
      model: 'deepseek-chat',
      apiKey: 'sk-secret-value',
      baseUrl: 'https://api.deepseek.test',
      timeoutMs: 100
    });
    assertEqual(networkResponse.status, 'failed', 'Fetch exceptions must fail the provider response.');
    assertEqual(networkResponse.errorCode, 'provider_network_error', 'Fetch exceptions with ECONN cause must map to provider_network_error.');
    assert(
      networkResponse.errorMessage.includes('TypeError')
        && networkResponse.errorMessage.includes('ECONNRESET')
        && !networkResponse.errorMessage.includes('https://api.deepseek.test')
        && !networkResponse.errorMessage.includes('sk-secret-value'),
      'Provider network diagnostics must expose sanitized exception shape without leaking URL or key material.'
    );
  });
}

async function testOpenAiCompatibleContentShapesAndEmptyFinalDiagnostics() {
  await withEnv({}, async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: { content: [{ type: 'text', text: '{"ok":true}' }] } }],
        usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 }
      })
    });
    const arrayContentResponse = await openAiCompatibleChatCompletion({
      requestId: 'array-content',
      taskType: 'question_generation',
      messages: [{ role: 'user', content: 'Return JSON.' }],
      model: 'deepseek-chat',
      apiKey: 'secret',
      baseUrl: 'https://api.deepseek.test',
      timeoutMs: 100
    });
    assertEqual(arrayContentResponse.status, 'success', 'OpenAI-compatible content arrays with text parts must be accepted.');
    assertEqual(arrayContentResponse.content, '{"ok":true}', 'Content-array text parts must be joined into the final answer.');

    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{
          finish_reason: 'length',
          message: { content: null, reasoning_content: 'internal reasoning without a final JSON answer' }
        }]
      })
    });
    const reasoningOnlyResponse = await openAiCompatibleChatCompletion({
      requestId: 'reasoning-without-final',
      taskType: 'question_generation',
      messages: [{ role: 'user', content: 'Return JSON.' }],
      model: 'deepseek-reasoner',
      apiKey: 'secret',
      baseUrl: 'https://api.deepseek.test',
      timeoutMs: 100
    });
    assertEqual(reasoningOnlyResponse.status, 'failed', 'Reasoning-only output must not be treated as a publishable final answer.');
    assertEqual(reasoningOnlyResponse.errorCode, 'provider_empty_output', 'Reasoning-only output must keep the retryable delivery taxonomy.');
    assert(
      reasoningOnlyResponse.errorMessage.includes('finishReason=length')
        && reasoningOnlyResponse.errorMessage.includes('reasoningContentWithoutFinal='),
      'Empty-final diagnostics must distinguish output-budget exhaustion from provider/key unavailability.'
    );
  });
}

async function testOpenAiCompatibleJsonDeliveryGuardIsJsonOnly() {
  await withEnv({}, async () => {
    let capturedBody;
    global.fetch = async (_url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: 'plain text answer' } }],
          usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }
        })
      };
    };
    const textResponse = await openAiCompatibleChatCompletion({
      requestId: 'text-without-json-guard',
      taskType: 'ai_coach_hint',
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Give a hint.' }
      ],
      model: 'deepseek-chat',
      apiKey: 'secret',
      baseUrl: 'https://api.deepseek.test',
      responseFormat: 'text',
      timeoutMs: 100
    });
    assertEqual(textResponse.status, 'success', 'Text provider responses must remain successful.');
    assertEqual(textResponse.content, 'plain text answer', 'Text provider responses must preserve plain content.');
    assertEqual(capturedBody.response_format, undefined, 'Text requests must not request JSON object response format.');
    assertEqual(capturedBody.messages[0].content, 'Be concise.', 'Text requests must not append the JSON final-delivery guard to system prompts.');
    assert(
      !JSON.stringify(capturedBody.messages).includes('Final delivery contract')
        && !JSON.stringify(capturedBody.messages).includes('reasoning_content without a final JSON object'),
      'JSON final-delivery guard must be isolated to JSON requests only.'
    );
  });
}

async function testGatewaySuccess() {
  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    AI_GATEWAY_GLOBAL_CONCURRENCY: '2',
    AI_GATEWAY_BACKGROUND_CONCURRENCY: '1'
  }, async () => {
    let captured;
    global.fetch = async (url, options) => {
      captured = { url, body: JSON.parse(options.body), headers: options.headers };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 }
        })
      };
    };
    const gateway = createStandaloneAiGatewayService();
    const response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'gateway_rules',
      responseFormat: 'json',
      thinking: 'enabled',
      reasoningEffort: 'low',
      messages: [{ role: 'user', content: 'Return JSON.' }]
    });
    assertEqual(response.status, 'success', 'Gateway complete must return success for valid provider output.');
    assertEqual(response.providerId, 'deepseek', 'Gateway must route platform calls to DeepSeek in Phase 1.');
    assertEqual(response.model, 'deepseek-chat', 'Gateway must use configured DeepSeek model.');
    assertEqual(response.usage.totalTokens, 8, 'Gateway must preserve provider token usage.');
    assertEqual(captured.url, 'https://api.deepseek.test/chat/completions', 'Gateway provider must call the OpenAI-compatible chat endpoint.');
    assertEqual(captured.body.response_format.type, 'json_object', 'Gateway must request JSON object format for JSON tasks.');
    assertEqual(captured.body.thinking.type, 'enabled', 'Gateway must forward an explicit DeepSeek thinking-mode selection.');
    assertEqual(captured.body.reasoning_effort, 'low', 'Gateway must forward an explicit DeepSeek reasoning-effort selection.');
    assertEqual(captured.body.messages[0].role, 'system', 'Gateway JSON requests must include a provider-level final delivery system guard.');
    assert(
      captured.body.messages[0].content.includes('message.content')
        && captured.body.messages[0].content.includes('Do not return reasoning_content without a final JSON object'),
      'Gateway JSON requests must explicitly require the final JSON in message.content, not reasoning-only output.'
    );
    assert(
      captured.body.messages.some((message) => message.role === 'user' && message.content === 'Return JSON.'),
      'Gateway JSON final delivery guard must preserve the original caller messages.'
    );
    assertEqual(captured.headers.authorization, 'Bearer deepseek-a', 'Gateway provider must pass the selected key only inside provider transport.');
  });
}

async function testGatewayRetriesEmptyFinalOutputWithinExistingPolicy() {
  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a,deepseek-b',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    AI_GATEWAY_GLOBAL_CONCURRENCY: '2',
    AI_GATEWAY_BACKGROUND_CONCURRENCY: '1'
  }, async () => {
    const authorizationHeaders = [];
    const capturedBodies = [];
    let callCount = 0;
    global.fetch = async (_url, options) => {
      callCount += 1;
      authorizationHeaders.push(options.headers.authorization);
      capturedBodies.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        text: async () => callCount === 1
          ? JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '' } }] })
          : JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 }
          })
      };
    };
    const gateway = createStandaloneAiGatewayService();
    const response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'gateway_empty_output_retry_rules',
      responseFormat: 'json',
      messages: [{ role: 'user', content: 'Return JSON.' }]
    });
    assertEqual(response.status, 'success', 'A transient empty final output must recover inside the existing question-generation retry policy.');
    assertEqual(callCount, 2, 'Empty final output recovery must use one bounded retry, not an unbounded loop.');
    assertEqual(response.attempts.length, 2, 'Gateway observability must retain the failed empty-output attempt and successful retry.');
    assertEqual(response.attempts[0].errorCode, 'provider_empty_output', 'The first attempt must retain the delivery failure taxonomy.');
    assert(authorizationHeaders[0] !== authorizationHeaders[1], 'With two healthy keys, the existing key-pool scoring should rotate the retry away from the failed key.');
    assert(
      !capturedBodies[0].messages.some((message) => String(message.content).includes('Retry delivery contract')),
      'The first provider attempt must not carry retry-only delivery instructions.'
    );
    assert(
      capturedBodies[1].messages.some((message) => String(message.content).includes('Retry delivery contract')
        && String(message.content).includes('empty final output')
        && String(message.content).includes('message.content')),
      'A retry after provider_empty_output must carry a focused final JSON delivery guard.'
    );
  });
}

async function testGatewayRetriesTruncatedJsonWithinExistingPolicy() {
  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a,deepseek-b',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    AI_GATEWAY_GLOBAL_CONCURRENCY: '2',
    AI_GATEWAY_BACKGROUND_CONCURRENCY: '1'
  }, async () => {
    const capturedBodies = [];
    let callCount = 0;
    global.fetch = async (_url, options) => {
      callCount += 1;
      capturedBodies.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        text: async () => callCount === 1
          ? JSON.stringify({
            choices: [{ finish_reason: 'length', message: { content: '{"prompt":"truncated"' } }],
            usage: { prompt_tokens: 7346, completion_tokens: 8000, total_tokens: 15346 }
          })
          : JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 }
          })
      };
    };
    const gateway = createStandaloneAiGatewayService();
    const ledgerRecords = [];
    gateway.ledger = {
      async providerHardStopState() { return { active: false, providerId: 'deepseek' }; },
      async record(entry) { ledgerRecords.push(entry); }
    };
    const response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'gateway_truncated_json_retry_rules',
      responseFormat: 'json',
      messages: [{ role: 'user', content: 'Return JSON.' }]
    });
    assertEqual(response.status, 'success', 'A truncated JSON response must recover inside the existing bounded question-generation retry policy.');
    assertEqual(callCount, 2, 'Truncated JSON recovery must use one bounded retry, not an unbounded loop.');
    assertEqual(response.attempts[0].errorCode, 'provider_schema_invalid', 'The first attempt must retain schema-invalid delivery taxonomy.');
    assertEqual(ledgerRecords.length, 1, 'A retried gateway request must write one aggregate ledger record.');
    assertEqual(ledgerRecords[0].promptTokens, 7350, 'Gateway ledger prompt tokens must include failed and successful billed attempts.');
    assertEqual(ledgerRecords[0].completionTokens, 8006, 'Gateway ledger completion tokens must include failed and successful billed attempts.');
    assertEqual(ledgerRecords[0].totalTokens, 15356, 'Gateway ledger total tokens must include every billed Provider attempt.');
    assertEqual(ledgerRecords[0].metadata.gatewayProviderAttemptCount, 2, 'Gateway ledger metadata must expose the real Provider attempt count.');
    assert(
      capturedBodies[1].messages.some((message) => String(message.content).includes('Retry delivery contract')
        && String(message.content).includes('truncated or invalid final JSON')
        && String(message.content).includes('shorter complete valid JSON')),
      'A retry after truncated JSON must carry a focused compact-final-JSON delivery guard.'
    );
  });
}

async function testGatewayHonorsSingleProviderAttemptOverride() {
  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a,deepseek-b',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    AI_GATEWAY_GLOBAL_CONCURRENCY: '2',
    AI_GATEWAY_BACKGROUND_CONCURRENCY: '1'
  }, async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '' } }] })
      };
    };
    const gateway = createStandaloneAiGatewayService();
    const response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'gateway_single_provider_attempt_rules',
      responseFormat: 'json',
      maxProviderAttempts: 1,
      messages: [{ role: 'user', content: 'Return JSON.' }]
    });
    assertEqual(response.status, 'failed', 'A single-attempt guarded request must surface its first retriable delivery failure.');
    assertEqual(response.errorCode, 'provider_empty_output', 'A single-attempt guarded request must preserve the first provider delivery taxonomy.');
    assertEqual(callCount, 1, 'maxProviderAttempts=1 must prevent the ordinary question-generation retry policy from issuing a second Provider request.');
    assertEqual(response.attempts.length, 1, 'Single-attempt gateway evidence must contain exactly one Provider attempt.');
  });
}

async function testGatewayProviderQuotaStopsRetries() {
  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    AI_GATEWAY_GLOBAL_CONCURRENCY: '2',
    AI_GATEWAY_BACKGROUND_CONCURRENCY: '1'
  }, async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;
      return {
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'Insufficient Balance' } })
      };
    };
    const gateway = createStandaloneAiGatewayService();
    const response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'gateway_quota_rules',
      responseFormat: 'json',
      messages: [{ role: 'user', content: 'Return JSON.' }]
    });
    assertEqual(response.status, 'provider_unavailable', 'Provider quota exhaustion must surface as provider unavailable for operations.');
    assertEqual(response.errorCode, 'provider_quota_exceeded', 'Gateway must preserve provider quota exhaustion taxonomy.');
    assertEqual(callCount, 1, 'Provider quota exhaustion must not retry the same exhausted key.');
  });
}

async function testGatewayProviderHardStopLedgerFailFastForBackgroundPool() {
  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    AI_GATEWAY_GLOBAL_CONCURRENCY: '2',
    AI_GATEWAY_BACKGROUND_CONCURRENCY: '1'
  }, async () => {
    const config = new AiGatewayConfigService();
    const ledger = {
      records: [],
      providerHardStopCalls: 0,
      async providerHardStopState() {
        this.providerHardStopCalls += 1;
        return {
          active: true,
          providerId: 'deepseek',
          latestHardStopAt: new Date('2026-09-03T07:11:48.249Z'),
          errorCode: 'provider_quota_exceeded',
          errorMessage: 'Insufficient Balance',
          sourceModule: 'question_generator',
          taskType: 'question_generation',
          subject: 'chemistry',
          topicId: '642',
          blueprintId: '585'
        };
      },
      async record(entry) {
        this.records.push(entry);
      }
    };
    const fakeProvider = {
      calls: 0,
      async complete() {
        this.calls += 1;
        return { status: 'success', content: '{"ok":true}' };
      }
    };
    const gateway = new AiGatewayService(
      config,
      new AiGatewayConcurrencyService(config),
      new AiGatewayKeyPoolService(),
      ledger,
      new AiGatewayCostService(),
      fakeProvider
    );

    const response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'gateway_hard_stop_rules',
      responseFormat: 'json',
      messages: [{ role: 'user', content: 'Return JSON.' }],
      metadata: { subject: 'math', topicId: '338', blueprintId: '156' }
    });

    assertEqual(response.status, 'provider_unavailable', 'Ledger hard-stop must surface as provider unavailable.');
    assertEqual(response.errorCode, 'gateway_key_cooldown', 'Ledger hard-stop must not write a fresh quota/auth hard-stop error.');
    assertEqual(response.attempts.length, 0, 'Ledger hard-stop must fail before reserving a provider key.');
    assertEqual(fakeProvider.calls, 0, 'Ledger hard-stop must not call the provider transport.');
    assertEqual(ledger.providerHardStopCalls, 1, 'Background platform calls must inspect the provider hard-stop ledger once.');
    assertEqual(ledger.records.length, 1, 'Ledger hard-stop decisions must remain observable.');
    assertEqual(ledger.records[0].errorCode, 'gateway_key_cooldown', 'Ledger records must preserve cooldown taxonomy instead of refreshing quota.');
    assertEqual(ledger.records[0].metadata.subject, 'math', 'Caller metadata must be preserved on the fail-fast ledger record.');
    assertEqual(ledger.records[0].metadata.providerHardStopLedger.subject, 'chemistry', 'Fail-fast ledger metadata must expose the source hard-stop subject.');
  });
}

async function testGatewayProviderHardStopLedgerDoesNotBlockOverrides() {
  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    AI_GATEWAY_GLOBAL_CONCURRENCY: '2',
    AI_GATEWAY_BACKGROUND_CONCURRENCY: '1'
  }, async () => {
    const config = new AiGatewayConfigService();
    const ledger = {
      records: [],
      providerHardStopCalls: 0,
      async providerHardStopState() {
        this.providerHardStopCalls += 1;
        return { active: true, providerId: 'deepseek', errorCode: 'provider_quota_exceeded' };
      },
      async record(entry) {
        this.records.push(entry);
      }
    };
    const fakeProvider = {
      calls: 0,
      async complete(request) {
        this.calls += 1;
        return {
          status: 'success',
          content: '{"ok":true}',
          usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
          raw: { model: request.model }
        };
      }
    };
    const gateway = new AiGatewayService(
      config,
      new AiGatewayConcurrencyService(config),
      new AiGatewayKeyPoolService(),
      ledger,
      new AiGatewayCostService(),
      fakeProvider
    );

    const response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'gateway_hard_stop_override_rules',
      responseFormat: 'json',
      messages: [{ role: 'user', content: 'Return JSON.' }],
      providerConfigOverride: {
        source: 'override',
        model: 'override-model',
        apiKey: 'override-key',
        baseUrl: 'https://override.deepseek.test'
      }
    });

    assertEqual(response.status, 'success', 'Explicit provider overrides must not be blocked by the platform background ledger.');
    assertEqual(fakeProvider.calls, 1, 'Explicit provider overrides must still reach the selected provider transport.');
    assertEqual(ledger.providerHardStopCalls, 0, 'Override calls must not inspect the platform background hard-stop ledger.');
    assertEqual(ledger.records[0].status, 'success', 'Override success must still write the normal ledger record.');
  });
}

async function testGatewayProviderHardStopLedgerAllowsExplicitRecoveryProbeBypass() {
  await withEnv({
    DEEPSEEK_API_KEYS: 'deepseek-a',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.test',
    DEEPSEEK_DEFAULT_MODEL: 'deepseek-chat',
    AI_GATEWAY_GLOBAL_CONCURRENCY: '2',
    AI_GATEWAY_BACKGROUND_CONCURRENCY: '1'
  }, async () => {
    const config = new AiGatewayConfigService();
    const ledger = {
      records: [],
      providerHardStopCalls: 0,
      async providerHardStopState() {
        this.providerHardStopCalls += 1;
        return { active: true, providerId: 'deepseek', errorCode: 'provider_quota_exceeded' };
      },
      async record(entry) {
        this.records.push(entry);
      }
    };
    const fakeProvider = {
      calls: 0,
      lastRequest: null,
      async complete(request) {
        this.calls += 1;
        this.lastRequest = request;
        return {
          status: 'success',
          content: '{"ok":true}',
          usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 }
        };
      }
    };
    const gateway = new AiGatewayService(
      config,
      new AiGatewayConcurrencyService(config),
      new AiGatewayKeyPoolService(),
      ledger,
      new AiGatewayCostService(),
      fakeProvider
    );

    const response = await gateway.complete({
      taskType: 'question_generation',
      sourceModule: 'gateway_provider_recovery_probe',
      responseFormat: 'json',
      bypassProviderHardStopLedger: true,
      messages: [{ role: 'user', content: 'Return JSON.' }],
      metadata: { purpose: 'provider_recovery_probe' }
    });

    assertEqual(response.status, 'success', 'Explicit recovery probes must be able to prove provider recovery.');
    assertEqual(fakeProvider.calls, 1, 'Explicit recovery probes must reach the platform provider transport once.');
    assertEqual(fakeProvider.lastRequest.apiKey, 'deepseek-a', 'Explicit recovery probes must use the normal platform background key.');
    assertEqual(ledger.providerHardStopCalls, 0, 'Explicit recovery probes must bypass the hard-stop ledger pre-check.');
    assertEqual(ledger.records[0].status, 'success', 'Explicit recovery probes must write a success ledger entry to clear stale hard-stops.');
    assertEqual(ledger.records[0].metadata.purpose, 'provider_recovery_probe', 'Recovery probe ledger records must keep audit metadata.');
  });
}

async function main() {
  await testConfigParsing();
  await testCostEstimation();
  await testKeyPool();
  await testMonitorAggregationMapping();
  await testOpenAiCompatibleErrors();
  await testOpenAiCompatibleContentShapesAndEmptyFinalDiagnostics();
  await testOpenAiCompatibleJsonDeliveryGuardIsJsonOnly();
  await testGatewaySuccess();
  await testGatewayRetriesEmptyFinalOutputWithinExistingPolicy();
  await testGatewayRetriesTruncatedJsonWithinExistingPolicy();
  await testGatewayHonorsSingleProviderAttemptOverride();
  await testGatewayProviderQuotaStopsRetries();
  await testGatewayProviderHardStopLedgerFailFastForBackgroundPool();
  await testGatewayProviderHardStopLedgerDoesNotBlockOverrides();
  await testGatewayProviderHardStopLedgerAllowsExplicitRecoveryProbeBypass();
  console.log('CSCA AI Gateway rules passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
