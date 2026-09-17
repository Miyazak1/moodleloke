const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { buildQuestionSupplyOperationsHealth } = require('../dist/backend/src/agent/question-supply-operations-health.service');

const now = new Date('2026-09-14T08:00:00.000Z');

function baseRows() {
  return {
    scheduler: {
      enabled: true,
      realAdapterAuthorized: false,
      configuration: { intervalMinutes: 15, batchSize: 25 },
      state: {
        lastStatus: 'succeeded', leaseOwner: null, leaseUntil: null,
        lastCompletedAt: new Date(now.getTime() - 5 * 60_000)
      }
    },
    requests: [], plans: [], checks: [],
    runs: [{ id: 'run-safe', status: 'succeeded', trigger: 'scheduled', summary: {}, errorCode: null, startedAt: now, completedAt: now }]
  };
}

function testHealthyEmptyQueue() {
  const result = buildQuestionSupplyOperationsHealth(baseRows(), now);
  assert.equal(result.status, 'healthy');
  assert.equal(result.realAdapterAuthorized, false);
  assert.equal(result.subjects.length, 3);
}

function testFailuresAndExpiredLeasesAreCritical() {
  const rows = baseRows();
  rows.scheduler.state = {
    lastStatus: 'failed', leaseOwner: 'dead-worker', leaseUntil: new Date(now.getTime() - 1), lastCompletedAt: now
  };
  rows.plans = [{ status: 'leased', leaseUntil: new Date(now.getTime() - 1), request: { subjectCode: 'math' } }];
  rows.checks = Array.from({ length: 5 }, (_, index) => ({
    result: index < 2 ? 'check_failed' : 'still_short', checkedAt: now, request: { subjectCode: 'math' }
  }));
  const result = buildQuestionSupplyOperationsHealth(rows, now);
  assert.equal(result.status, 'critical');
  assert.equal(result.alerts.some((item) => item.code === 'SCHEDULER_LEASE_EXPIRED'), true);
  assert.equal(result.alerts.some((item) => item.code === 'EXPIRED_PLAN_LEASES'), true);
  assert.equal(result.alerts.some((item) => item.code === 'INVENTORY_CHECK_FAILURE_RATE_HIGH'), true);
  assert.doesNotMatch(JSON.stringify(result), /dead-worker|leaseOwner|workerId|userId|requestId/);
}

function testSubjectFreshnessDoesNotCrossSubjects() {
  const rows = baseRows();
  rows.requests = [{ subjectCode: 'physics', lastObservedAt: now }];
  rows.checks = [{ result: 'still_short', checkedAt: now, request: { subjectCode: 'math' } }];
  const result = buildQuestionSupplyOperationsHealth(rows, now);
  assert.equal(result.status, 'warning');
  assert.equal(result.alerts.some((item) => item.code === 'SUBJECT_HAS_NO_RECENT_CHECKS' && item.subjectCode === 'physics'), true);
}

function testDisabledSchedulerIsExplicit() {
  const rows = baseRows();
  rows.scheduler.enabled = false;
  const result = buildQuestionSupplyOperationsHealth(rows, now);
  assert.equal(result.status, 'disabled');
}

testHealthyEmptyQueue();
testFailuresAndExpiredLeasesAreCritical();
testSubjectFreshnessDoesNotCrossSubjects();
testDisabledSchedulerIsExplicit();
const source = readFileSync(require.resolve('../dist/backend/src/agent/question-supply-operations-health.service'), 'utf8');
assert.doesNotMatch(source, /ai-questioning|generateQuestion|publishQuestion/i);
console.log('QUESTION_SUPPLY_OPERATIONS_HEALTH_OK');
