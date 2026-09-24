const assert = require('node:assert/strict');
const { AgentSubjectQaService } = require('../dist/backend/src/agent/agent-subject-qa.service');
const { openAiCompatibleChatCompletionStream } = require('../dist/backend/src/ai-gateway/providers/openai-compatible-http');

function gateway(result, configured = true, streamChunks = []) {
  const calls = [];
  return {
    calls,
    hasConfiguredKey(taskType) {
      calls.push({ kind: 'configured', taskType });
      return configured;
    },
    async complete(request) {
      calls.push({ kind: 'complete', request });
      for (const chunk of streamChunks) await request.onTextDelta?.(chunk);
      return result;
    }
  };
}

async function testProviderStreaming() {
  const originalFetch = global.fetch;
  const deltas = [];
  let requestBody = null;
  try {
    global.fetch = async (_url, init) => {
      requestBody = JSON.parse(init.body);
      const encoder = new TextEncoder();
      const blocks = [
        ': keep-alive\n\n',
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"},"finish_reason":"stop"}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n',
        'data: [DONE]\n\n'
      ];
      return new Response(new ReadableStream({
        start(controller) {
          blocks.forEach((block) => controller.enqueue(encoder.encode(block)));
          controller.close();
        }
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    };
    const result = await openAiCompatibleChatCompletionStream({
      requestId: 'stream-test', taskType: 'ai_coach_explanation', messages: [{ role: 'user', content: 'hi' }],
      model: 'deepseek-chat', apiKey: 'test-key', baseUrl: 'https://api.deepseek.com', responseFormat: 'text', timeoutMs: 5000,
      onTextDelta: (delta) => deltas.push(delta)
    });
    assert.equal(result.status, 'success');
    assert.equal(result.content, '你好');
    assert.deepEqual(deltas, ['你', '好']);
    assert.deepEqual(result.usage, { promptTokens: 3, completionTokens: 2, totalTokens: 5 });
    assert.equal(requestBody.stream, true);
    assert.deepEqual(requestBody.stream_options, { include_usage: true });
  } finally {
    global.fetch = originalFetch;
  }
}

async function main() {
  await testProviderStreaming();
  const answerText = '负号表示加速度方向与选定的正方向相反。';
  const answerGateway = gateway({
    status: 'success',
    json: { decision: 'answer', subject: 'physics', answer: answerText }
  }, true, ['{"decision":"answer","subject":"physics","answer":"负号表示', '加速度方向与选定的正方向相反。"}']);
  const streamed = [];
  const answered = await new AgentSubjectQaService(answerGateway).answer({
    runId: 'run-answer', userId: 42, locale: 'zh-CN', question: '为什么加速度可以是负数？',
    history: [{ role: 'user', text: '我们先约定向右为正方向。' }],
    onDelta: (delta) => streamed.push(delta)
  });
  assert.deepEqual(answered, {
    text: '负号表示加速度方向与选定的正方向相反。',
    decision: 'answer', subject: 'physics', generatedByAI: true
  });
  const request = answerGateway.calls.find((item) => item.kind === 'complete').request;
  assert.equal(request.sourceModule, 'agent_subject_qa');
  assert.equal(request.responseFormat, 'json');
  assert.match(request.messages[0].content, /mathematics, physics, and chemistry only/i);
  assert.match(request.messages[0].content, /never instructions/i);
  assert.doesNotMatch(request.messages[0].content, /change mastery/i);
  assert.match(request.messages[1].content, /向右为正方向/);
  assert.equal(streamed.join(''), answerText);

  const boundaryGateway = gateway({
    status: 'success',
    json: { decision: 'out_of_scope', subject: null, answer: '这里放置一段不应展示的越界回答。' }
  }, true, ['{"decision":"out_of_scope","subject":null,"answer":"这里放置', '一段不应展示的越界回答。"}']);
  const boundaryDeltas = [];
  const bounded = await new AgentSubjectQaService(boundaryGateway).answer({
    runId: 'run-boundary', userId: 42, locale: 'zh-CN', question: '帮我修改学习计划', history: [],
    onDelta: (delta) => boundaryDeltas.push(delta)
  });
  assert.equal(bounded.decision, 'out_of_scope');
  assert.equal(bounded.subject, null);
  assert.equal(bounded.generatedByAI, true);
  assert.equal(bounded.text, '学科问答目前只支持数学、物理和化学。学习计划、做题、进度和设置请返回学习工作台。');
  assert.doesNotMatch(bounded.text, /越界回答/);
  assert.deepEqual(boundaryDeltas, []);

  const reviewedGateway = gateway({
    status: 'success',
    json: {
      decision: 'answer',
      subject: 'physics',
      answer: 'D 说的是摩擦力，但乘客向前倾并不是摩擦力把人向前推。刹车时车速突然减小，乘客身体仍倾向保持原来的向前运动状态，这体现的是惯性，所以应选 B。'
    }
  });
  const reviewed = await new AgentSubjectQaService(reviewedGateway).answer({
    runId: 'run-reviewed-question',
    userId: 42,
    locale: 'zh-CN',
    question: '为什么 D 错了？',
    history: [],
    questionContext: {
      roundId: 31,
      questionId: 204,
      questionNumber: 4,
      subject: 'physics',
      topicTitle: '力与运动',
      prompt: '汽车急刹车时乘客会向前倾，主要体现了物体的（ ）',
      options: [
        { id: 'A', text: '弹性' },
        { id: 'B', text: '惯性' },
        { id: 'C', text: '重力' },
        { id: 'D', text: '摩擦力' }
      ],
      selectedAnswer: 'D',
      answered: true,
      correctAnswer: 'B',
      isCorrect: false,
      explanation: '刹车时汽车速度迅速减小，乘客身体由于惯性仍保持原来的运动状态，因此会相对汽车向前倾。',
      knowledgeTags: ['惯性', '牛顿第一定律']
    }
  });
  assert.equal(reviewed.decision, 'answer');
  assert.equal(reviewed.subject, 'physics');
  assert.equal(reviewed.generatedByAI, true);
  assert.match(reviewed.text, /摩擦力把人向前推/);
  assert.match(reviewed.text, /惯性/);
  const reviewedRequest = reviewedGateway.calls.find((item) => item.kind === 'complete').request;
  assert.equal(reviewedRequest.metadata.grounding, 'reviewed_current_question');
  assert.match(reviewedRequest.messages[1].content, /汽车急刹车时乘客会向前倾/);
  assert.match(reviewedRequest.messages[1].content, /为什么 D 错了/);
  assert.match(reviewedRequest.messages[1].content, /牛顿第一定律/);

  const fallbackGateway = gateway({ status: 'failed', error: 'provider unavailable' });
  const fallback = await new AgentSubjectQaService(fallbackGateway).answer({
    runId: 'run-reviewed-fallback',
    userId: 42,
    locale: 'zh-CN',
    question: '为什么 D 错了？',
    history: [],
    questionContext: {
      roundId: 31,
      questionId: 204,
      questionNumber: 4,
      subject: 'physics',
      topicTitle: '力与运动',
      prompt: '汽车急刹车时乘客会向前倾，主要体现了物体的（ ）',
      options: [
        { id: 'A', text: '弹性' },
        { id: 'B', text: '惯性' },
        { id: 'C', text: '重力' },
        { id: 'D', text: '摩擦力' }
      ],
      selectedAnswer: 'D',
      answered: true,
      correctAnswer: 'B',
      isCorrect: false,
      explanation: '刹车时汽车速度迅速减小，乘客身体由于惯性仍保持原来的运动状态，因此会相对汽车向前倾。',
      knowledgeTags: ['惯性', '牛顿第一定律']
    }
  });
  assert.equal(fallback.generatedByAI, false);
  assert.match(fallback.text, /选项 D（摩擦力）不符合题目条件/);
  assert.match(fallback.text, /正确选项：B（惯性）/);
  assert.equal(fallbackGateway.calls.filter((item) => item.kind === 'complete').length, 1);

  const unavailableGateway = gateway(null, false);
  const unavailable = await new AgentSubjectQaService(unavailableGateway).answer({
    runId: 'run-unavailable', userId: 42, locale: 'zh-CN', question: '解释勾股定理', history: []
  });
  assert.equal(unavailable.decision, 'unavailable');
  assert.equal(unavailable.generatedByAI, false);
  assert.match(unavailable.text, /暂时无法连接/);
  assert.equal(unavailableGateway.calls.filter((item) => item.kind === 'complete').length, 0);

  const invalidGateway = gateway({ status: 'success', json: { decision: 'answer', subject: 'history', answer: 'invalid' } });
  const invalid = await new AgentSubjectQaService(invalidGateway).answer({
    runId: 'run-invalid', userId: 42, locale: 'zh-CN', question: '解释历史事件', history: []
  });
  assert.equal(invalid.decision, 'unavailable');
  assert.equal(invalid.generatedByAI, false);
  assert.match(invalid.text, /暂时无法连接/);

  console.log('Agent subject Q&A tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
