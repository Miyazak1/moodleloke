#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const fs = require('node:fs');
const path = require('node:path');
const {
  subjectPracticeScenarioBlueprintFeedbackFor
} = require('../backend/src/ai-questioning/subject-practice-scenario-blueprint-feedback-policy');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8'));
}

function main() {
  const requestPack = readJson('artifacts/ai-questioning/chemistry-dynamic-scenario-v3-context-compatible-request-pack.json');
  const executionReceipt = readJson('artifacts/ai-questioning/chemistry-dynamic-scenario-v3-context-compatible-response-pack.json');
  const accepted = subjectPracticeScenarioBlueprintFeedbackFor({ ideationPack: requestPack, executionReceipt });
  const secondRequestPack = readJson('artifacts/ai-questioning/chemistry-dynamic-scenario-v8-feedback-compact-request-pack.json');
  const secondExecutionReceipt = readJson('artifacts/ai-questioning/chemistry-dynamic-scenario-v8-feedback-compact-response-pack.json');
  const secondAccepted = subjectPracticeScenarioBlueprintFeedbackFor({
    ideationPack: secondRequestPack, executionReceipt: secondExecutionReceipt
  });
  const tamperedReceipt = subjectPracticeScenarioBlueprintFeedbackFor({
    ideationPack: requestPack,
    executionReceipt: { ...executionReceipt, actualCostUsd: Number(executionReceipt.actualCostUsd) + 0.000001 }
  });
  const tamperedPack = subjectPracticeScenarioBlueprintFeedbackFor({
    ideationPack: { ...requestPack, expectedTaskCount: Number(requestPack.expectedTaskCount) + 1 },
    executionReceipt
  });
  const scopes = Object.keys(accepted.historySummaryByExactScope ?? {}).sort();
  const firstHistory = accepted.historySummaryByExactScope?.[scopes[0]];
  const serialized = JSON.stringify(accepted);
  const checks = {
    sealedRejectedExecutionProducesFeedback:
      accepted.status === 'structural_feedback_ready'
      && accepted.sourceEvidence.executionReceiptSha256 === executionReceipt.executionReceiptSha256,
    compatibleProviderGroupCoversAllThreeScopes:
      JSON.stringify(scopes) === JSON.stringify([
        'strong_acid_base_neutralization', 'strong_acid_dilution', 'strong_base_dilution'
      ]),
    feedbackKeepsOnlySpecificCompactSignals:
      firstHistory.failureReasonCodes.includes('avoid_unsupported_solution_methods')
      && firstHistory.failureReasonCodes.includes('require_single_sample_only')
      && firstHistory.failureReasonCodes.includes('avoid_numbers_and_number_words')
      && !firstHistory.failureReasonCodes.includes('scenario_blueprint_chemistry_context_incompatible')
      && firstHistory.concentrationWarnings.length === 0
      && /^[a-f0-9]{64}$/.test(accepted.sourceEvidence.detailedFailureCodesSha256),
    feedbackContainsNoRawProviderContent:
      accepted.rawResponseIncluded === false
      && !serialized.includes('unknown liquid sample')
      && !serialized.includes('rejectedRawResponse'),
    secondLiveFailureBecomesOneActionableMethodSignal:
      secondAccepted.status === 'structural_feedback_ready'
      && Object.values(secondAccepted.historySummaryByExactScope).every((history) =>
        JSON.stringify(history.failureReasonCodes) === JSON.stringify(['avoid_unsupported_solution_methods']))
      && secondAccepted.sourceEvidence.executionReceiptSha256 === secondExecutionReceipt.executionReceiptSha256,
    feedbackAuthorizesNothing:
      accepted.providerCallAuthorized === false
      && accepted.observationTaskWriteAuthorized === false
      && accepted.candidateWriteAuthorized === false
      && accepted.publicationAuthorized === false,
    receiptTamperFailsClosed:
      tamperedReceipt.blockers.includes('scenario_blueprint_feedback_execution_receipt_digest_invalid'),
    requestPackTamperFailsClosed:
      tamperedPack.blockers.includes('scenario_blueprint_feedback_request_pack_digest_invalid')
  };
  const report = {
    mode: 'subject_practice_scenario_blueprint_feedback_self_test',
    reportVersion: 'subject-practice-scenario-blueprint-feedback-self-test-v2-two-live-rejections',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_fixture_only',
    databaseImpact: 'none_no_database_connection',
    publicationImpact: 'none'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

if (require.main === module) main();
