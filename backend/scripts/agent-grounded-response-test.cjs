const assert = require('node:assert/strict');
const { AgentGroundedResponseService } = require('../dist/backend/src/agent/agent-grounded-response.service');

function gateway(result, configured = true) {
  const calls = [];
  return {
    calls,
    hasConfiguredKey() { return configured; },
    async complete(request) { calls.push(request); return result; }
  };
}

async function main() {
  const facts = [{ key: 'a', text: 'Verified A' }, { key: 'b', text: 'Verified B' }];
  const disabledGateway = gateway(null);
  const fallback = await new AgentGroundedResponseService(
    { isLlmGroundedResponseEnabled: () => false }, disabledGateway
  ).plan({ runId: 'r1', userId: 7, locale: 'en', intent: 'learning_status', facts });
  assert.deepEqual(fallback.factKeys, ['a', 'b']);
  assert.equal(fallback.source, 'rule');
  assert.equal(disabledGateway.calls.length, 0);

  const validGateway = gateway({ status: 'success', json: { leadStyle: 'action', factKeys: ['b', 'a'] } });
  const planned = await new AgentGroundedResponseService(
    { isLlmGroundedResponseEnabled: () => true }, validGateway
  ).plan({ runId: 'r2', userId: 7, locale: 'en', intent: 'review_queue', facts });
  assert.deepEqual(planned.factKeys, ['b', 'a']);
  assert.equal(planned.leadStyle, 'action');
  assert.equal(planned.source, 'llm');
  assert.match(validGateway.calls[0].messages[0].content, /do not create, rewrite, infer, or add facts/i);

  const inventedGateway = gateway({ status: 'success', json: { leadStyle: 'overview', factKeys: ['invented'] } });
  const rejected = await new AgentGroundedResponseService(
    { isLlmGroundedResponseEnabled: () => true }, inventedGateway
  ).plan({ runId: 'r3', userId: 7, locale: 'en', intent: 'past_papers', facts });
  assert.deepEqual(rejected.factKeys, ['a', 'b']);
  assert.equal(rejected.source, 'rule');

  console.log('Agent grounded response tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
