const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const {
  buildQuestionSupplyEvaluation,
  buildQuestionSupplyAcceptanceReport,
  buildQuestionSupplySanitizedExport,
  questionSupplyExportCsv
} = require('../dist/backend/src/agent/question-supply-evaluation.service');

const from = new Date('2026-08-15T00:00:00.000Z');
const to = new Date('2026-09-14T00:00:00.000Z');

function rows(count, overrides = {}) {
  const requests = [];
  const plans = [];
  const checks = [];
  const confirmations = [];
  const events = [];
  for (let index = 0; index < count; index += 1) {
    const requestId = `request-${index}`;
    const subjectCode = index % 3 ? 'math' : 'physics';
    requests.push({ id: requestId, cycle: 1, observationCount: index % 2 ? 2 : 1, source: 'agent_today_plan', subjectCode, topicIds: [index + 1], requestedCount: 3, availableCount: 1 });
    plans.push({
      requestId, requestCycle: 1, status: 'completed', attemptCount: 1,
      createdAt: new Date(from.getTime() + index * 60_000),
      completedAt: new Date(from.getTime() + index * 60_000 + 3_600_000),
      request: { source: index % 2 ? 'intervention_verification' : 'agent_today_plan', subjectCode, topicIds: [index + 1], requestedCount: 3, availableCount: 1, observationCount: 1 }
    });
    checks.push({ requestId, requestCycle: 1, result: 'still_short', availableCount: 1, checkerVersion: 'test-v1', checkedAt: new Date(from.getTime() + index * 60_000) });
    confirmations.push({ requestId, requestCycle: 1, confirmationKind: 'domain_preflight_passed', subjectCode, confirmedAt: to });
    events.push({ action: 'shadow_dispatched', createdAt: from, plan: { request: { subjectCode } } });
  }
  return { requests, plans, checks, confirmations, events, ...overrides };
}

function testInsufficientSampleNeverAuthorizesAdapter() {
  const result = buildQuestionSupplyEvaluation(rows(3), { days: 30, from, to });
  assert.equal(result.gate.status, 'insufficient_sample');
  assert.equal(result.gate.realAdapterAuthorized, false);
  assert.equal(result.summary.shortageConfirmationRate, 1);
  assert.equal(result.summary.recoveryExecutableRate, 1);
}

function testQualifiedShadowEvidenceStillRequiresSeparateApproval() {
  const result = buildQuestionSupplyEvaluation(rows(30), { days: 30, from, to });
  assert.equal(result.gate.status, 'shadow_evidence_ready');
  assert.equal(result.gate.realAdapterAuthorized, false);
  assert.equal(result.summary.recoveryP90Hours, 1);
  assert.equal(result.breakdown.length, 4);
}

function testPoorExecutionRecoveryHolds() {
  const fixture = rows(30);
  fixture.confirmations = fixture.confirmations.slice(0, 20);
  fixture.events.push(...Array.from({ length: 5 }, () => ({ action: 'dispatch_failed', createdAt: from })));
  const result = buildQuestionSupplyEvaluation(fixture, { days: 30, from, to });
  assert.equal(result.gate.status, 'hold');
  assert.equal(result.gate.blockers.includes('RECOVERY_EXECUTABLE_RATE_LOW'), true);
  assert.equal(result.gate.blockers.includes('DISPATCH_FAILURE_RATE_HIGH'), true);
}

function testPerSubjectReportNeverAuthorizesAdapter() {
  const result = buildQuestionSupplyAcceptanceReport(rows(30), { days: 30, from, to });
  assert.deepEqual(result.subjects.map((item) => item.subjectCode), ['math', 'physics', 'chemistry']);
  assert.equal(result.subjects.every((item) => item.evaluation.gate.realAdapterAuthorized === false), true);
  assert.equal(result.subjects.find((item) => item.subjectCode === 'chemistry').evaluation.gate.status, 'insufficient_sample');
}

function testSanitizedExportContainsNoInternalIdentity() {
  const payload = buildQuestionSupplySanitizedExport(rows(3), { days: 30, from, to });
  assert.equal(payload.sanitized, true);
  assert.equal(payload.samples.length, 3);
  assert.equal(payload.samples[0].sampleKey.length, 20);
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /request-0|userId|sourceEntityId|actorUserId/);
  const csv = questionSupplyExportCsv(payload);
  assert.match(csv, /sampleKey/);
  assert.doesNotMatch(csv, /request-0|userId|sourceEntityId|actorUserId/);
}

testInsufficientSampleNeverAuthorizesAdapter();
testQualifiedShadowEvidenceStillRequiresSeparateApproval();
testPoorExecutionRecoveryHolds();
testPerSubjectReportNeverAuthorizesAdapter();
testSanitizedExportContainsNoInternalIdentity();
const source = readFileSync(require.resolve('../dist/backend/src/agent/question-supply-evaluation.service'), 'utf8');
assert.doesNotMatch(source, /ai-questioning|AIQuestioningService|generateQuestion|requestPracticeGeneration/i);
console.log('QUESTION_SUPPLY_EVALUATION_OK');
