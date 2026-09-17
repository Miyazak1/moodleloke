const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');

loadEnv();
const base = process.env.AGENT_DEMO_BACKEND_URL || 'http://localhost:3000';

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function request(pathname, { method = 'GET', token, body, expected = [200, 201] } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000)
  });
  const text = await response.text();
  let result;
  try { result = text ? JSON.parse(text) : {}; } catch { result = text; }
  assert(expected.includes(response.status), `${pathname} returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  return result;
}

async function waitRun(token, runId) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const run = await request(`/api/v1/agent/runs/${runId}`, { token });
    if (run.status === 'completed') return run;
    if (run.status === 'failed') throw new Error(`Agent run failed: ${run.errorCode || 'unknown'}`);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error('Agent run timed out.');
}

async function main() {
  const credentialPath = path.resolve(__dirname, '..', '.local', 'agent-demo-credentials.json');
  assert(fs.existsSync(credentialPath), 'Run node scripts/agent-demo-seed.cjs --apply first.');
  const credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  const login = process.env.AGENT_DEMO_ACCESS_TOKEN
    ? null
    : await request('/api/v1/auth/login', { method: 'POST', body: credentials });
  const token = process.env.AGENT_DEMO_ACCESS_TOKEN || login?.tokens?.accessToken;
  assert(token, 'Login did not return an access token.');

  const conversation = await request('/api/v1/agent/conversations', { method: 'POST', token, body: { title: 'PR11G golden path' } });
  const submission = await request(`/api/v1/agent/conversations/${conversation.id}/messages`, {
    method: 'POST', token,
    body: { clientRequestId: randomUUID(), text: '我今天学什么？', locale: 'zh-CN', attachmentIds: [] }
  });
  const run = await waitRun(token, submission.runId);
  const artifact = run.artifacts?.find((item) => item.type === 'learning_plan');
  assert(artifact, `Today-plan run did not create a learning_plan artifact: ${JSON.stringify({ status: run.status, tools: run.toolCalls, artifacts: run.artifacts })}`);
  assert(artifact.snapshot?.canStart === true, `Plan is not startable: ${JSON.stringify(artifact.snapshot?.supply || artifact.snapshot)}`);
  console.log(JSON.stringify({ stage: 'plan', task: artifact.snapshot?.task, supply: artifact.snapshot?.supply }));

  const launch = await request(`/api/v1/agent/artifacts/${artifact.id}/start-practice`, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), questionLanguage: 'zh' }
  });
  const detail = await request(`/api/v1/csca-special-practice/adaptive/rounds/${launch.roundId}?language=zh`, { token });
  assert(detail.questions?.length >= 1, 'Practice round contains no questions.');
  const first = detail.questions[0];

  const available = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, { token });
  assert(available.availableActions?.find((item) => item.action === 'recall_concept')?.enabled, 'Concept recall should be available before answering.');
  await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, {
    method: 'POST', token, expected: [409], body: { clientRequestId: randomUUID(), action: 'show_full_solution', language: 'zh', questionLanguage: 'zh' }
  });
  const recallRequestId = randomUUID();
  const recall = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, {
    method: 'POST', token, body: { clientRequestId: recallRequestId, action: 'recall_concept', language: 'zh', questionLanguage: 'zh' }
  });
  const recallReplay = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, {
    method: 'POST', token, body: { clientRequestId: recallRequestId, action: 'recall_concept', language: 'zh', questionLanguage: 'zh' }
  });
  assert(recallReplay.toolCallId === recall.toolCallId, 'Learning assistance idempotency replay created a second tool call.');
  const hint = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'next_step_hint', language: 'zh', questionLanguage: 'zh' }
  });
  const restored = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, { token });
  assert(restored.history?.some((item) => item.toolCallId === recall.toolCallId && item.action === 'recall_concept'), 'Concept recall was not recoverable from assistance history.');
  assert(restored.history?.some((item) => item.toolCallId === hint.toolCallId && item.action === 'next_step_hint'), 'Hint was not recoverable from assistance history.');
  assert(Object.prototype.hasOwnProperty.call(restored, 'billing'), 'Assistance availability omitted billing semantics.');
  const reportRequestId = randomUUID();
  const report = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance/report`, {
    method: 'POST', token, body: { clientRequestId: reportRequestId, reason: 'unclear', note: 'PR12A golden-path report' }
  });
  const reportReplay = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance/report`, {
    method: 'POST', token, body: { clientRequestId: reportRequestId, reason: 'unclear', note: 'PR12A golden-path report' }
  });
  assert(report.status === 'received' && reportReplay.reportId === report.reportId, 'Content issue report was not idempotent.');

  const answers = Object.fromEntries(detail.questions.map((question) => [String(question.id), question.options[0].id]));
  const saved = await request(`/api/v1/csca-special-practice/adaptive/rounds/${launch.roundId}`, {
    method: 'PATCH', token, body: { answers, timeSpent: Object.fromEntries(detail.questions.map((question) => [String(question.id), 8])), currentQuestion: 1, expectedVersion: detail.round.version }
  });
  await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, {
    method: 'POST', token, expected: [409], body: { clientRequestId: randomUUID(), action: 'next_step_hint', language: 'zh', questionLanguage: 'zh' }
  });
  const solution = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, {
    method: 'POST', token, body: { clientRequestId: randomUUID(), action: 'show_full_solution', language: 'zh', questionLanguage: 'zh' }
  });
  await request(`/api/v1/csca-special-practice/adaptive/rounds/${launch.roundId}/submit?language=zh`, { method: 'POST', token });
  const settled = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/settle`, { method: 'POST', token });
  const followUp = await request(`/api/v1/agent/conversations/${conversation.id}/messages`, {
    method: 'POST', token,
    body: {
      clientRequestId: randomUUID(), text: '我已完成刚才的训练，请根据最新学习证据更新下一步方案。', locale: 'zh-CN', attachmentIds: [],
      pageContext: { route: launch.route, artifactId: artifact.id, entityRef: { type: 'adaptive_round', id: String(launch.roundId) } }
    }
  });
  const followUpRun = await waitRun(token, followUp.runId);
  const after = await request(`/api/v1/agent/practice-rounds/${launch.roundId}/questions/${first.id}/assistance`, { token });
  assert(after.exposures.usedHint && after.exposures.usedExplanation, 'Hint and explanation exposure were not persisted.');
  assert(followUpRun.artifacts?.some((item) => item.type === 'learning_plan'), 'Follow-up Agent run did not produce a refreshed learning plan.');

  console.log(JSON.stringify({
    verdict: 'pass', conversationId: conversation.id, initialRunId: run.id, followUpRunId: followUpRun.id,
    artifactId: artifact.id, roundId: launch.roundId, questionCount: detail.questions.length,
    assistance: { recall: recall.level, hint: hint.level, solution: solution.level, restoredCount: restored.history.length, reportId: report.reportId, exposures: after.exposures },
    settlement: settled.decision, savedVersion: saved.version
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
