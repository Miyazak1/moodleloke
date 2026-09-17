#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const path = require('node:path');

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function positiveInt(name, fallback) {
  const value = Number(argValue(name, fallback));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function round(value, digits = 6) {
  return Number(Number(value || 0).toFixed(digits));
}

function percentileNearestRank(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index];
}

function roundUp(value, step) {
  return Math.ceil(value / step) * step;
}

function calibrateOutputCeiling(samples, policy = {}) {
  const currentCeiling = Number(policy.currentCeiling ?? 8000);
  const minimumDeliveredSamples = Number(policy.minimumDeliveredSamples ?? 5);
  const floor = Number(policy.floor ?? 4000);
  const roundStep = Number(policy.roundStep ?? 500);
  const percentileHeadroom = Number(policy.percentileHeadroom ?? 1.2);
  const maximumHeadroom = Number(policy.maximumHeadroom ?? 1.1);
  const nearCeilingRatio = Number(policy.nearCeilingRatio ?? 0.85);
  const minimumReductionTokens = Number(policy.minimumReductionTokens ?? 1000);
  const outputPricePer1MTokens = Number(policy.outputPricePer1MTokens ?? 0.28);
  const completionTokens = samples
    .filter((sample) => sample?.providerDelivered === true)
    .map((sample) => Number(sample.completionTokens))
    .filter((value) => Number.isFinite(value) && value > 0);
  const deliveredSampleCount = completionTokens.length;
  const maximumObserved = deliveredSampleCount ? Math.max(...completionTokens) : null;
  const p95 = percentileNearestRank(completionTokens, 0.95);
  const nearCeilingObserved = maximumObserved != null && maximumObserved >= currentCeiling * nearCeilingRatio;
  const rawCandidate = maximumObserved == null
    ? currentCeiling
    : Math.max(p95 * percentileHeadroom, maximumObserved * maximumHeadroom, floor);
  const candidateCeiling = Math.min(currentCeiling, roundUp(rawCandidate, roundStep));
  const possibleReductionTokens = Math.max(0, currentCeiling - candidateCeiling);
  let status = 'keep_current_ceiling';
  let reason = 'candidate_reduction_below_materiality_floor';
  let recommendedCeiling = currentCeiling;
  if (deliveredSampleCount < minimumDeliveredSamples) {
    status = 'insufficient_delivered_samples_keep_current_ceiling';
    reason = 'minimum_delivered_sample_count_not_met';
  } else if (nearCeilingObserved) {
    status = 'near_ceiling_usage_keep_current_ceiling';
    reason = 'maximum_observed_completion_tokens_too_close_to_current_ceiling';
  } else if (possibleReductionTokens >= minimumReductionTokens) {
    status = 'lower_ceiling_candidate_ready_for_policy_review';
    reason = 'sample_and_headroom_requirements_passed';
    recommendedCeiling = candidateCeiling;
  }
  return {
    status,
    reason,
    currentCeiling,
    recommendedCeiling,
    deliveredSampleCount,
    completionTokens,
    maximumObserved,
    p95CompletionTokens: p95,
    maximumObservedRatio: maximumObserved == null ? null : round(maximumObserved / currentCeiling, 4),
    candidateCeiling,
    possibleReductionTokens,
    estimatedMaximumCostSavingsPerCallUsd: round((possibleReductionTokens / 1_000_000) * outputPricePer1MTokens, 9),
    policy: {
      minimumDeliveredSamples,
      floor,
      roundStep,
      percentileHeadroom,
      maximumHeadroom,
      nearCeilingRatio,
      minimumReductionTokens,
      outputPricePer1MTokens
    },
    evidenceLimit: 'historical_delivered_completion_usage_only_not_future_truncation_proof'
  };
}

function runScorecard(subject, runId, cellId, taskFamily) {
  const args = [
    path.resolve(__dirname, 'csca-subject-practice-observation-scorecard.cjs'),
    `--subject=${subject}`,
    `--run=${runId}`,
    `--cell=${cellId}`,
    '--json'
  ];
  if (taskFamily) args.push(`--task-family=${taskFamily}`);
  const output = execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(output);
}

function selfTest() {
  const sample = (completionTokens) => ({ providerDelivered: true, completionTokens });
  const insufficient = calibrateOutputCeiling([sample(4700), sample(5100), sample(5900)]);
  if (insufficient.status !== 'insufficient_delivered_samples_keep_current_ceiling' || insufficient.recommendedCeiling !== 8000) {
    throw new Error('Insufficient-sample fixture must keep the current ceiling.');
  }
  const lower = calibrateOutputCeiling([sample(2500), sample(2700), sample(2800), sample(3000), sample(3100)]);
  if (lower.status !== 'lower_ceiling_candidate_ready_for_policy_review' || lower.recommendedCeiling !== 4000) {
    throw new Error('Stable low-usage fixture should recommend the guarded floor.');
  }
  const near = calibrateOutputCeiling([sample(5000), sample(5600), sample(6100), sample(6900), sample(7200)]);
  if (near.status !== 'near_ceiling_usage_keep_current_ceiling' || near.recommendedCeiling !== 8000) {
    throw new Error('Near-ceiling fixture must keep the current ceiling.');
  }
  return {
    mode: 'subject_practice_output_token_calibration_self_test',
    status: 'passed',
    sampleCount: 3,
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection'
  };
}

function main() {
  if (hasFlag('self-test')) {
    console.log(JSON.stringify(selfTest(), null, 2));
    return;
  }
  const subject = cleanText(argValue('subject')).toLowerCase();
  const runId = positiveInt('run', 0);
  const cellId = positiveInt('cell', 0);
  const currentCeiling = positiveInt('current-ceiling', 8000);
  const minimumDeliveredSamples = positiveInt('minimum-delivered-samples', 5);
  const taskFamily = cleanText(argValue('task-family')) || null;
  if (!['math', 'physics', 'chemistry'].includes(subject)) throw new Error('--subject=math|physics|chemistry is required.');
  if (!runId) throw new Error('--run=<productionRunId> is required.');
  if (!cellId) throw new Error('--cell=<productionCellId> is required.');
  const scorecard = runScorecard(subject, runId, cellId, taskFamily);
  const calibration = calibrateOutputCeiling(scorecard.samples || [], { currentCeiling, minimumDeliveredSamples });
  const report = {
    mode: 'subject_practice_output_token_calibration',
    subject,
    productionRunId: runId,
    productionCellId: cellId,
    requestedTaskFamily: taskFamily,
    evidenceScope: taskFamily ? 'exact_requested_task_family' : 'all_task_families_in_subject_run_cell',
    productionImpact: 'none_read_only_calibration',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_via_observation_scorecard',
    doesNotAuthorizeExecution: true,
    scorecardStatus: scorecard.status,
    taskFamilyCounts: Object.entries((scorecard.samples || []).reduce((counts, sampleRow) => {
      const family = cleanText(sampleRow.taskFamily) || 'unknown';
      counts[family] = (counts[family] || 0) + 1;
      return counts;
    }, {})).map(([taskFamily, count]) => ({ taskFamily, count })),
    calibration
  };
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}

module.exports = { calibrateOutputCeiling };
