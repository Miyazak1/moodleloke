const assert = require('node:assert/strict');
const { AgentSubjectQaService } = require('../dist/backend/src/agent/agent-subject-qa.service');

function gateway(result, configured = true) {
  const calls = [];
  return {
    calls,
    hasConfiguredKey(taskType) {
      calls.push({ kind: 'configured', taskType });
      return configured;
    },
    async complete(request) {
      calls.push({ kind: 'complete', request });
      return result;
    }
  };
}

async function main() {
  const answerGateway = gateway({
    status: 'success',
    json: { decision: 'answer', subject: 'physics', answer: '负号表示加速度方向与选定的正方向相反。' }
  });
  const answered = await new AgentSubjectQaService(answerGateway).answer({
    runId: 'run-answer', userId: 42, locale: 'zh-CN', question: '为什么加速度可以是负数？',
    history: [{ role: 'user', text: '我们先约定向右为正方向。' }]
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

  const boundaryGateway = gateway({
    status: 'success',
    json: { decision: 'out_of_scope', subject: null, answer: '这里放置一段不应展示的越界回答。' }
  });
  const bounded = await new AgentSubjectQaService(boundaryGateway).answer({
    runId: 'run-boundary', userId: 42, locale: 'zh-CN', question: '帮我修改学习计划', history: []
  });
  assert.equal(bounded.decision, 'out_of_scope');
  assert.equal(bounded.subject, null);
  assert.equal(bounded.generatedByAI, true);
  assert.equal(bounded.text, '学科问答目前只支持数学、物理和化学。学习计划、做题、进度和设置请返回学习工作台。');
  assert.doesNotMatch(bounded.text, /越界回答/);

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
