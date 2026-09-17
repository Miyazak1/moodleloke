#!/usr/bin/env node

const cp = require('node:child_process');
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

function asNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function firstJsonObject(output) {
  const text = String(output ?? '');
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`No JSON object found in output: ${text.slice(0, 240)}`);
  return JSON.parse(text.slice(start));
}

function runJson(script, args = []) {
  const output = cp.execFileSync(process.execPath, [path.resolve(__dirname, script), ...args, '--json'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return firstJsonObject(output);
}

function hoursSince(value) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return null;
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0) return null;
  return Number((ageMs / 3_600_000).toFixed(3));
}

function mathScorecardSummary(scorecard) {
  const subject = arrayFrom(scorecard?.subjects).find((item) => cleanText(item.subject) === 'math') || {};
  const funnel = subject.fourFunnel || {};
  return {
    runId: subject.runId ?? null,
    runStatus: subject.runStatus ?? null,
    scorecardStatus: subject.scorecardStatus ?? null,
    published: funnel.cappedPublishedTotal ?? null,
    target: funnel.targetTotal ?? null,
    open: funnel.computedOpenTotal ?? null,
    generatedToApprovedYield: funnel.generatedToApprovedYield ?? null,
    attemptToApprovedYield: funnel.attemptToApprovedYield ?? null,
    throughputStatus: subject.throughputEfficiency?.status ?? null,
    throughputReasons: subject.throughputEfficiency?.reasons ?? []
  };
}

function schedulerAdherenceFor(evidence) {
  return evidence?.task?.result?.schedulerAdherence
    || evidence?.generationJob?.schedulerHintAdherence
    || null;
}

function pushRequirement(requirements, condition, requirement, evidence) {
  requirements.push({
    requirement,
    status: condition ? 'satisfied' : 'missing',
    evidence
  });
}

function evaluateMathObservationCompletion({ evidence, scorecard = null, targetRunId = 156, targetCellId = 350, freshnessWindowHours = 24 }) {
  const task = evidence?.task || {};
  const job = evidence?.generationJob || {};
  const question = evidence?.question || {};
  const interpretation = evidence?.interpretation || {};
  const uniqueness = evidence?.uniqueness || {};
  const gatewayBinding = evidence?.gatewayCandidateLogs?.binding ?? null;
  const schedulerAdherence = schedulerAdherenceFor(evidence) || {};
  const chemistry = evidence?.isolation?.latestChemistryRun || {};
  const studentPublication = evidence?.studentPublication || {};
  const completedAt = task.completedAt ?? task.updatedAt ?? null;
  const completedAgeHours = hoursSince(completedAt);
  const freshEnough = completedAgeHours != null && completedAgeHours <= freshnessWindowHours;
  const generatedQuestionId = asNumber(task.result?.generatedQuestionId ?? question.id, 0);
  const suppressStudentPublication = studentPublication.suppressStudentPublication === true;
  const notPublishedToStudentPool = studentPublication.studentPoolStatus === 'not_published_to_student_pool'
    && Number(studentPublication.specialPracticeQuestionCount) === 0;
  const requirements = [];

  pushRequirement(requirements, evidence?.mode === 'read_only_observation_evidence', 'read_only_observation_evidence_loaded', evidence?.mode ?? null);
  pushRequirement(requirements, task.status === 'succeeded', 'observation_task_succeeded', { status: task.status, error: task.error ?? null });
  pushRequirement(requirements, task.subject === 'math', 'observation_subject_is_math', task.subject ?? null);
  pushRequirement(requirements, Number(task.productionRunId) === Number(targetRunId), 'observation_run_matches_target', task.productionRunId ?? null);
  pushRequirement(requirements, Number(task.productionCellId) === Number(targetCellId), 'observation_cell_matches_target', task.productionCellId ?? null);
  pushRequirement(requirements, freshEnough, 'observation_completed_within_freshness_window', { completedAt, completedAgeHours, freshnessWindowHours });
  pushRequirement(requirements, interpretation.noCandidate === false, 'observation_produced_candidate', interpretation.noCandidate ?? null);
  pushRequirement(requirements, !interpretation.deliveryFailure, 'no_provider_delivery_failure_for_observation', interpretation.deliveryFailure ?? null);
  pushRequirement(requirements, uniqueness.oneObservationJobForTask === true, 'exactly_one_generation_job_for_observation_task', uniqueness.observationJobCountForTask ?? null);
  pushRequirement(requirements, job.status === 'succeeded', 'generation_job_succeeded', { id: job.id ?? null, status: job.status ?? null });
  pushRequirement(requirements, job.workClass === 'observation', 'generation_job_marked_observation_work_class', job.workClass ?? null);
  pushRequirement(requirements, cleanText(job.observationTaskId) === cleanText(evidence?.taskId), 'generation_job_bound_to_observation_task', { jobObservationTaskId: job.observationTaskId ?? null, taskId: evidence?.taskId ?? null });
  pushRequirement(requirements, Number(job.productionRunId) === Number(targetRunId), 'generation_job_run_matches_target', job.productionRunId ?? null);
  pushRequirement(requirements, Number(job.productionCellId) === Number(targetCellId), 'generation_job_cell_matches_target', job.productionCellId ?? null);
  pushRequirement(requirements, gatewayBinding === 'direct_gateway_metadata_observationTaskId', 'direct_gateway_observation_binding_visible', gatewayBinding);
  pushRequirement(requirements, generatedQuestionId > 0, 'generated_question_id_visible', generatedQuestionId || null);
  pushRequirement(requirements, ['pending_review', 'review_failed', 'approved'].includes(question.status), 'generated_question_recorded_for_gate_evidence', question.status ?? null);
  pushRequirement(requirements, question.gateDecision === 'publishable', 'generated_question_gate_publishable', {
    gateDecision: question.gateDecision ?? null,
    gateReasons: question.gateReasons ?? null
  });
  pushRequirement(requirements, suppressStudentPublication, 'observation_student_publication_suppressed', studentPublication);
  pushRequirement(requirements, notPublishedToStudentPool, 'observation_not_published_to_student_pool', studentPublication);
  pushRequirement(requirements, schedulerAdherence.status === 'preferred_family_match', 'scheduler_hint_preferred_family_matched', schedulerAdherence);
  pushRequirement(requirements, schedulerAdherence.avoidedFamilyHit === false, 'scheduler_hint_avoided_family_not_hit', schedulerAdherence);
  pushRequirement(requirements, chemistry.status === 'running' && !chemistry.blockedReason, 'chemistry_latest_run_still_unblocked', {
    id: chemistry.id ?? null,
    status: chemistry.status ?? null,
    blockedReason: chemistry.blockedReason ?? null,
    published: chemistry.published ?? null,
    open: chemistry.open ?? null
  });

  const missingRequirements = requirements.filter((item) => item.status !== 'satisfied');
  const scorecardSummary = scorecard ? mathScorecardSummary(scorecard) : null;
  const observationQualityPassed = missingRequirements.length === 0;
  const efficiencyStatus = scorecardSummary?.throughputStatus ?? 'not_checked';
  const efficiencyAcceptable = ['acceptable', 'acceptable_with_operator_actions', 'closed_or_no_open_work'].includes(efficiencyStatus);
  const taskWaiting = ['queued', 'running'].includes(cleanText(task.status));
  const status = taskWaiting
    ? 'waiting_for_observation_terminal_result'
    : observationQualityPassed && efficiencyAcceptable
      ? 'passed'
      : observationQualityPassed
        ? 'passed_fresh_quality_evidence_efficiency_still_needs_scale'
        : 'incomplete';

  return {
    mode: 'math_observation_completion_gate',
    status,
    productionImpact: 'none_read_only_observation_evidence_gate',
    providerImpact: 'none_no_provider_call',
    dbImpact: scorecard ? 'read_only_evidence_and_scorecard' : 'read_only_evidence_only',
    target: {
      subject: 'math',
      productionRunId: targetRunId,
      productionCellId: targetCellId
    },
    freshnessWindowHours,
    observationQualityPassed,
    efficiencyAcceptable,
    efficiencyStatus,
    completionSatisfied: status === 'passed',
    taskId: evidence?.taskId ?? null,
    generatedQuestionId: generatedQuestionId || null,
    completedAt,
    completedAgeHours,
    missingRequirements: missingRequirements.map((item) => item.requirement),
    requirements,
    scorecard: scorecardSummary,
    doesNotProve: [
      ...efficiencyAcceptable ? [] : ['math_generation_efficiency_at_scale'],
      'full_three_subject_long_run_stability',
      'future_provider_delivery_success'
    ]
  };
}

function makePassingFixture() {
  const now = new Date().toISOString();
  return {
    mode: 'read_only_observation_evidence',
    taskId: '11111111-1111-4111-8111-111111111111',
    task: {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'succeeded',
      action: 'math_scheduler_v2',
      subject: 'math',
      productionRunId: 156,
      productionCellId: 350,
      result: {
        noCandidate: false,
        deliveryFailure: null,
        schedulerAdherence: {
          status: 'preferred_family_match',
          observedFamily: 'elementary_function_exp_log_ordering',
          preferredFamily: 'elementary_function_exp_log_ordering',
          avoidedFamilyHit: false
        },
        generatedQuestionId: 9001
      },
      completedAt: now,
      updatedAt: now
    },
    generationJob: {
      id: 8001,
      status: 'succeeded',
      questionId: 9001,
      workClass: 'observation',
      observationTaskId: '11111111-1111-4111-8111-111111111111',
      productionRunId: '156',
      productionCellId: '350'
    },
    uniqueness: {
      observationJobCountForTask: 1,
      oneObservationJobForTask: true
    },
    question: {
      id: 9001,
      status: 'pending_review',
      gateDecision: 'publishable',
      gateReasons: []
    },
    studentPublication: {
      suppressStudentPublication: true,
      publicationPolicy: 'observation_gate_evidence_only_no_student_publication',
      specialPracticeQuestionCount: 0,
      sourceQuestionId: null,
      studentPoolStatus: 'not_published_to_student_pool'
    },
    gatewayCandidateLogs: {
      binding: 'direct_gateway_metadata_observationTaskId'
    },
    isolation: {
      latestChemistryRun: {
        id: 200,
        status: 'running',
        blockedReason: null,
        published: 39,
        open: 11
      }
    },
    interpretation: {
      noCandidate: false,
      deliveryFailure: null
    }
  };
}

function makeScorecardFixture(throughputStatus = 'acceptable_with_operator_actions') {
  return {
    subjects: [
      {
        subject: 'math',
        runId: 156,
        runStatus: 'running',
        scorecardStatus: 'monitoring_required',
        fourFunnel: {
          cappedPublishedTotal: 1,
          targetTotal: 30,
          computedOpenTotal: 29,
          generatedToApprovedYield: 0.4,
          attemptToApprovedYield: 0.3
        },
        throughputEfficiency: {
          status: throughputStatus,
          reasons: []
        }
      }
    ]
  };
}

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTest() {
  const passing = evaluateMathObservationCompletion({
    evidence: makePassingFixture(),
    scorecard: makeScorecardFixture()
  });
  const staleEvidence = makePassingFixture();
  staleEvidence.task.completedAt = '2026-08-13T02:29:04.425Z';
  staleEvidence.task.updatedAt = staleEvidence.task.completedAt;
  const stale = evaluateMathObservationCompletion({
    evidence: staleEvidence,
    scorecard: makeScorecardFixture()
  });
  const deliveryFailureEvidence = makePassingFixture();
  deliveryFailureEvidence.interpretation.deliveryFailure = 'provider_error';
  deliveryFailureEvidence.task.result.deliveryFailure = 'provider_error';
  const deliveryFailure = evaluateMathObservationCompletion({
    evidence: deliveryFailureEvidence,
    scorecard: makeScorecardFixture()
  });
  const duplicateEvidence = makePassingFixture();
  duplicateEvidence.uniqueness.observationJobCountForTask = 2;
  duplicateEvidence.uniqueness.oneObservationJobForTask = false;
  const duplicate = evaluateMathObservationCompletion({
    evidence: duplicateEvidence,
    scorecard: makeScorecardFixture()
  });
  const efficiencyNeedsScale = evaluateMathObservationCompletion({
    evidence: makePassingFixture(),
    scorecard: makeScorecardFixture('below_acceptable_efficiency')
  });
  const waitingEvidence = makePassingFixture();
  waitingEvidence.task.status = 'running';
  const waiting = evaluateMathObservationCompletion({
    evidence: waitingEvidence,
    scorecard: makeScorecardFixture()
  });

  assertSelfTest(passing.status === 'passed', `Passing fixture should pass, got ${passing.status}`);
  assertSelfTest(stale.missingRequirements.includes('observation_completed_within_freshness_window'), 'Stale fixture must fail freshness requirement.');
  assertSelfTest(deliveryFailure.missingRequirements.includes('no_provider_delivery_failure_for_observation'), 'Delivery failure fixture must fail delivery requirement.');
  assertSelfTest(duplicate.missingRequirements.includes('exactly_one_generation_job_for_observation_task'), 'Duplicate fixture must fail uniqueness requirement.');
  assertSelfTest(efficiencyNeedsScale.status === 'passed_fresh_quality_evidence_efficiency_still_needs_scale', 'Fresh quality evidence must not claim scale efficiency when scorecard remains below threshold.');
  assertSelfTest(waiting.status === 'waiting_for_observation_terminal_result', 'Running task fixture must report waiting status.');

  return {
    mode: 'math_observation_completion_gate_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    cases: [
      { label: 'passing', status: passing.status },
      { label: 'stale', status: stale.status, missingRequirements: stale.missingRequirements },
      { label: 'delivery_failure', status: deliveryFailure.status, missingRequirements: deliveryFailure.missingRequirements },
      { label: 'duplicate_job', status: duplicate.status, missingRequirements: duplicate.missingRequirements },
      { label: 'efficiency_needs_scale', status: efficiencyNeedsScale.status },
      { label: 'waiting', status: waiting.status }
    ]
  };
}

function main() {
  const json = hasFlag('json');
  if (hasFlag('self-test')) {
    const report = runSelfTest();
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log('Math observation completion gate self-test passed.');
    return;
  }

  const subject = cleanText(argValue('subject', 'math')) || 'math';
  const taskId = cleanText(argValue('task', ''));
  const targetRunId = asNumber(argValue('run', '156'), 156);
  const targetCellId = asNumber(argValue('cell', '350'), 350);
  const freshnessWindowHours = Math.max(1, Math.min(168, asNumber(argValue('freshness-window-hours', '24'), 24)));
  const evidenceArgs = [`--subject=${subject}`];
  if (taskId) evidenceArgs.push(`--task=${taskId}`);
  const evidence = runJson('csca-subject-practice-observation-evidence.cjs', evidenceArgs);
  const scorecard = runJson('csca-subject-practice-quality-scorecard.cjs', [
    '--subjects=math',
    `--math-run=${targetRunId}`,
    '--sample=80'
  ]);
  const report = evaluateMathObservationCompletion({
    evidence,
    scorecard,
    targetRunId,
    targetCellId,
    freshnessWindowHours
  });

  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Math observation completion gate: ${report.status}`);
    console.log(`- task=${report.taskId ?? 'none'} question=${report.generatedQuestionId ?? 'none'} completedAgeHours=${report.completedAgeHours ?? 'n/a'}`);
    console.log(`- qualityPassed=${report.observationQualityPassed} efficiency=${report.efficiencyStatus}`);
    if (report.missingRequirements.length) console.log(`- missing=${report.missingRequirements.join(', ')}`);
  }
  if (hasFlag('require-complete') && !report.completionSatisfied) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: 'math_observation_completion_gate',
    message: error instanceof Error ? error.message : String(error),
    providerImpact: 'none_no_provider_call'
  }, null, 2));
  process.exitCode = 1;
}
