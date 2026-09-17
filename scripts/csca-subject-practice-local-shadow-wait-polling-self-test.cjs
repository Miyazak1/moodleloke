#!/usr/bin/env node

const {
  WAIT_POLLING_POLICY,
  waitForTask
} = require('./csca-subject-practice-local-shadow-three-subject-run.cjs');

function runtimeFor(statuses) {
  let currentMs = 0;
  let requestCount = 0;
  const sleeps = [];
  return {
    now: () => currentMs,
    sleep: async (delayMs) => {
      sleeps.push(delayMs);
      currentMs += delayMs;
    },
    requestJson: async () => {
      const status = statuses[Math.min(requestCount, statuses.length - 1)];
      requestCount += 1;
      return { task: { id: 'fixture-task', status } };
    },
    metrics: () => ({ currentMs, requestCount, sleeps })
  };
}

async function rejectsAsync(fn, pattern) {
  try {
    await fn();
    return false;
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
}

async function main() {
  const immediateRuntime = runtimeFor(['succeeded']);
  const immediate = await waitForTask('http://fixture', 'fixture-task', 'token', 5_000, immediateRuntime);

  const fastRuntime = runtimeFor(['running', 'succeeded']);
  const fast = await waitForTask('http://fixture', 'fixture-task', 'token', 5_000, fastRuntime);

  const slowRuntime = runtimeFor([
    'queued', 'running', 'running', 'running', 'running', 'running', 'succeeded'
  ]);
  const slow = await waitForTask('http://fixture', 'fixture-task', 'token', 10_000, slowRuntime);

  const timeoutRuntime = runtimeFor(['running']);
  const timeoutRejected = await rejectsAsync(
    () => waitForTask('http://fixture', 'fixture-task', 'token', 1_000, timeoutRuntime),
    /Timed out waiting/
  );

  const immediateMetrics = immediateRuntime.metrics();
  const fastMetrics = fastRuntime.metrics();
  const slowMetrics = slowRuntime.metrics();
  const timeoutMetrics = timeoutRuntime.metrics();
  const checks = {
    terminalFirstPollReturnsWithoutSleep:
      immediate.task.status === 'succeeded'
      && immediateMetrics.requestCount === 1
      && immediateMetrics.sleeps.length === 0,
    fastTaskRecheckedAfterQuarterSecond:
      fast.task.status === 'succeeded'
      && fastMetrics.requestCount === 2
      && fastMetrics.sleeps.join(',') === String(WAIT_POLLING_POLICY.initialDelayMs),
    slowTaskUsesMonotonicBoundedBackoff:
      slow.task.status === 'succeeded'
      && slowMetrics.sleeps.length === 6
      && slowMetrics.sleeps.every((delay, index, values) =>
        delay <= WAIT_POLLING_POLICY.maximumDelayMs
        && (index === 0 || delay >= values[index - 1]))
      && slowMetrics.sleeps.at(-1) === WAIT_POLLING_POLICY.maximumDelayMs,
    timeoutUsesExactRemainingBudget:
      timeoutRejected
      && timeoutMetrics.currentMs === 1_000
      && timeoutMetrics.sleeps.reduce((sum, delay) => sum + delay, 0) === 1_000,
    policyReducesFastTaskMinimumWaitByAtLeastOneSecond:
      1_500 - WAIT_POLLING_POLICY.initialDelayMs >= 1_000
  };
  const report = {
    mode: 'subject_practice_local_shadow_wait_polling_self_test',
    reportVersion: 'subject-practice-local-shadow-wait-polling-self-test-v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    policy: WAIT_POLLING_POLICY,
    checks,
    fixtureMetrics: {
      immediate: immediateMetrics,
      fast: fastMetrics,
      slow: slowMetrics,
      timeout: timeoutMetrics
    },
    providerImpact: 'none_fixture_only',
    databaseImpact: 'none',
    publicationImpact: 'none'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
