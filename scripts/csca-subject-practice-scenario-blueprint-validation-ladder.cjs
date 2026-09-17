#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const {
  subjectPracticeObservationScenarioBlueprintCostAdmissionFor
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-pack-policy');
const {
  validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-execution-policy');

const POLICY_VERSION =
  'subject-practice-scenario-blueprint-validation-ladder-v1-shared-contract-canary-first';

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function receiptAt(receiptDirectory, authorizationDigest) {
  const receiptPath = path.join(path.resolve(receiptDirectory), `${authorizationDigest}.json`);
  return { receiptPath, receipt: fs.existsSync(receiptPath) ? readJson(receiptPath) : null };
}

function receiptState(pack, receipt) {
  if (!receipt) return { state: 'unconsumed', verified: false, blockers: [] };
  if (receipt.status === 'completed_response_pack_ready_for_materialization') {
    const validation = validateSubjectPracticeObservationScenarioBlueprintExecutionReceipt({
      ideationPack: pack,
      executionReceipt: receipt
    });
    return {
      state: validation.status === 'verified_for_materialization'
        ? 'accepted_and_verified'
        : 'completed_receipt_invalid',
      verified: validation.status === 'verified_for_materialization',
      blockers: validation.blockers ?? []
    };
  }
  if (receipt.status === 'stopped_on_first_failure') {
    return {
      state: 'rejected_or_provider_failed',
      verified: false,
      blockers: (receipt.failures ?? []).flatMap((failure) => [
        failure.reasonCode,
        ...(failure.responseFailureCodes ?? [])
      ]).filter(Boolean)
    };
  }
  return {
    state: 'consumed_nonterminal_or_unknown',
    verified: false,
    blockers: ['scenario_blueprint_execution_receipt_not_terminal']
  };
}

function nextStepFor({ canaryState, followerState }) {
  if (canaryState === 'unconsumed') return 'authorize_canary_only';
  if (canaryState === 'rejected_or_provider_failed') return 'diagnose_and_revise_shared_contract';
  if (canaryState !== 'accepted_and_verified') return 'investigate_canary_receipt';
  if (followerState === 'unconsumed') return 'authorize_follower_after_canary_acceptance';
  if (followerState === 'accepted_and_verified') return 'shared_contract_live_validation_complete';
  if (followerState === 'rejected_or_provider_failed') return 'diagnose_follower_subject_contract';
  return 'investigate_follower_receipt';
}

function exactAuthorizationText(admission) {
  if (admission.status !== 'ready_for_exact_cost_authorization') return null;
  return `授权执行动态场景构思包 ${admission.requestPackSha256}，确认授权摘要 ${admission.authorizationDigest}，模型 ${admission.model}，最多 ${admission.maximumProviderCalls} 次串行请求，单次费用不超过 $${admission.maximumCostUsdPerCall}、总费用不超过 $${admission.maximumTotalCostUsd}；允许一次性本地响应及执行回执写入，禁止观察任务、候选题及学生端发布。`;
}

function selfTest() {
  const checks = {
    freshLadderSelectsOnlyCanary: nextStepFor({
      canaryState: 'unconsumed', followerState: 'unconsumed'
    }) === 'authorize_canary_only',
    rejectedCanaryNeverAdvancesToFollower: nextStepFor({
      canaryState: 'rejected_or_provider_failed', followerState: 'unconsumed'
    }) === 'diagnose_and_revise_shared_contract',
    acceptedCanaryUnlocksFollower: nextStepFor({
      canaryState: 'accepted_and_verified', followerState: 'unconsumed'
    }) === 'authorize_follower_after_canary_acceptance',
    invalidCanaryReceiptFailsClosed: nextStepFor({
      canaryState: 'completed_receipt_invalid', followerState: 'unconsumed'
    }) === 'investigate_canary_receipt',
    bothAcceptedCompletesSharedContractValidation: nextStepFor({
      canaryState: 'accepted_and_verified', followerState: 'accepted_and_verified'
    }) === 'shared_contract_live_validation_complete'
  };
  return {
    mode: 'subject_practice_scenario_blueprint_validation_ladder_self_test',
    policyVersion: POLICY_VERSION,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerCallCount: 0,
    databaseImpact: 'none',
    publicationImpact: 'none'
  };
}

function main() {
  if (process.argv.includes('--self-test')) {
    const report = selfTest();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'passed') process.exitCode = 1;
    return;
  }
  const canaryPack = readJson(argValue('canary-pack'));
  const followerPack = readJson(argValue('follower-pack'));
  const model = argValue('model', 'deepseek-v4-flash');
  const maximumCostUsdPerCall = Number(argValue('max-cost-usd-per-call', '0.0025'));
  const maximumTotalCostUsd = Number(argValue('max-total-cost-usd', '0.0025'));
  const receiptDirectory = argValue(
    'receipt-dir',
    'artifacts/ai-questioning/scenario-blueprint-executions'
  );
  const canaryAdmission = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: canaryPack, model, maximumCostUsdPerCall, maximumTotalCostUsd
  });
  const followerAdmission = subjectPracticeObservationScenarioBlueprintCostAdmissionFor({
    ideationPack: followerPack, model, maximumCostUsdPerCall, maximumTotalCostUsd
  });
  const canaryReceipt = receiptAt(receiptDirectory, canaryAdmission.authorizationDigest);
  const followerReceipt = receiptAt(receiptDirectory, followerAdmission.authorizationDigest);
  const canaryExecution = receiptState(canaryPack, canaryReceipt.receipt);
  const followerExecution = receiptState(followerPack, followerReceipt.receipt);
  const nextStep = nextStepFor({
    canaryState: canaryExecution.state,
    followerState: followerExecution.state
  });
  const selectedAdmission = nextStep === 'authorize_canary_only'
    ? canaryAdmission
    : nextStep === 'authorize_follower_after_canary_acceptance'
      ? followerAdmission
      : null;
  const report = {
    mode: 'subject_practice_scenario_blueprint_validation_ladder',
    policyVersion: POLICY_VERSION,
    status: 'read_only_plan_ready',
    nextStep,
    selectedSubject: nextStep === 'authorize_canary_only'
      ? 'physics'
      : nextStep === 'authorize_follower_after_canary_acceptance'
        ? 'chemistry'
        : null,
    exactAuthorizationText: selectedAdmission ? exactAuthorizationText(selectedAdmission) : null,
    canary: {
      subject: 'physics',
      requestPackSha256: canaryAdmission.requestPackSha256,
      authorizationDigest: canaryAdmission.authorizationDigest,
      maximumEstimatedTotalCostUsd: canaryAdmission.maximumEstimatedTotalCostUsd,
      receiptPath: canaryReceipt.receiptPath,
      ...canaryExecution
    },
    follower: {
      subject: 'chemistry',
      requestPackSha256: followerAdmission.requestPackSha256,
      authorizationDigest: followerAdmission.authorizationDigest,
      maximumEstimatedTotalCostUsd: followerAdmission.maximumEstimatedTotalCostUsd,
      receiptPath: followerReceipt.receiptPath,
      ...followerExecution
    },
    followerProviderCallDeferred: canaryExecution.state !== 'accepted_and_verified',
    avoidedSpeculativeMaximumCostUsd: canaryExecution.state !== 'accepted_and_verified'
      ? followerAdmission.maximumEstimatedTotalCostUsd
      : 0,
    providerCallAuthorized: false,
    providerCallCount: 0,
    databaseImpact: 'none',
    publicationImpact: 'none'
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { receiptState, nextStepFor, exactAuthorizationText, selfTest };
