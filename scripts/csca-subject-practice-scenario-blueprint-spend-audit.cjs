#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});
const {
  subjectPracticeObservationScenarioBlueprintExecutionReceiptSha256For
} = require('../backend/src/ai-questioning/subject-practice-observation-scenario-blueprint-execution-policy');

const AUDIT_VERSION = 'subject-practice-scenario-blueprint-spend-audit-v2-receipt-digest-verified';

function finiteMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function money(value) {
  return Number(Number(value || 0).toFixed(8));
}

function receiptAssessment(receipt, fileName = '') {
  const failures = Array.isArray(receipt?.failures) ? receipt.failures : [];
  const providerCalls = Array.isArray(receipt?.providerCalls) ? receipt.providerCalls : [];
  const transportAttemptFieldPresent = Object.prototype.hasOwnProperty.call(
    receipt || {}, 'providerTransportAttemptCount'
  );
  const providerTransportAttemptCount = Number(receipt?.providerTransportAttemptCount);
  const actualCostUsd = finiteMoney(receipt?.actualCostUsd);
  const maximumTotalCostUsd = finiteMoney(receipt?.maximumTotalCostUsd);
  const usageBearingFailures = failures.filter((failure) =>
    finiteMoney(failure?.actualCostUsd) !== null
    && Number.isFinite(Number(failure?.promptTokens))
    && Number.isFinite(Number(failure?.completionTokens))
    && failure?.billedUsageRecorded === true);
  const failureCostUsd = money(usageBearingFailures.reduce(
    (sum, failure) => sum + Number(failure.actualCostUsd), 0));
  const authorizationDigest = String(receipt?.authorizationDigest || '').trim().toLowerCase();
  const fileMatchesAuthorization = !fileName
    || fileName === `${authorizationDigest}.json`;
  const structuralIssues = [];
  if (!/^[a-f0-9]{64}$/.test(authorizationDigest)) structuralIssues.push('authorization_digest_invalid');
  if (!fileMatchesAuthorization) structuralIssues.push('authorization_filename_mismatch');
  if (!transportAttemptFieldPresent
    || !Number.isInteger(providerTransportAttemptCount) || providerTransportAttemptCount < 0) {
    structuralIssues.push('provider_transport_attempt_count_invalid');
  }
  const recordedReceiptSha256 = String(receipt?.executionReceiptSha256 || '').trim().toLowerCase();
  const recomputedReceiptSha256 = subjectPracticeObservationScenarioBlueprintExecutionReceiptSha256For(receipt);
  if (!/^[a-f0-9]{64}$/.test(recordedReceiptSha256)
    || recordedReceiptSha256 !== recomputedReceiptSha256) {
    structuralIssues.push('execution_receipt_digest_invalid');
  }
  if (actualCostUsd === null) structuralIssues.push('actual_cost_missing_or_invalid');
  if (actualCostUsd !== null && providerTransportAttemptCount === 0 && actualCostUsd > 0) {
    structuralIssues.push('positive_cost_without_provider_transport_attempt');
  }
  if (actualCostUsd !== null && failureCostUsd > actualCostUsd + Number.EPSILON) {
    structuralIssues.push('failure_cost_exceeds_receipt_actual_cost');
  }
  if (providerCalls.some((call) => finiteMoney(call?.actualCostUsd) === null)) {
    structuralIssues.push('provider_call_cost_missing_or_invalid');
  }

  const confirmedZero = structuralIssues.length === 0
    && providerTransportAttemptCount === 0
    && actualCostUsd === 0;
  const exactRecorded = structuralIssues.length === 0
    && providerTransportAttemptCount > 0
    && actualCostUsd !== null
    && (actualCostUsd > 0 || usageBearingFailures.length > 0 || providerCalls.length > 0);
  const legacyUnresolved = structuralIssues.length === 0
    && providerTransportAttemptCount > 0
    && actualCostUsd === 0
    && usageBearingFailures.length === 0
    && providerCalls.length === 0;
  const costEvidenceStatus = structuralIssues.length
    ? 'invalid_receipt_cost_evidence'
    : confirmedZero
      ? 'confirmed_zero_before_provider_transport'
      : exactRecorded
        ? 'exact_cost_recorded'
        : legacyUnresolved
          ? 'legacy_provider_attempt_cost_unresolved'
          : 'cost_evidence_incomplete';
  return {
    authorizationDigest,
    requestPackSha256: String(receipt?.requestPackSha256 || '').trim().toLowerCase() || null,
    policyVersion: String(receipt?.policyVersion || '').trim() || null,
    status: String(receipt?.status || '').trim() || null,
    providerTransportAttemptCount,
    gatewayRequestCount: Number(receipt?.gatewayRequestCount || 0),
    executionReceiptDigestVerified: recordedReceiptSha256 === recomputedReceiptSha256,
    recordedActualCostUsd: actualCostUsd,
    authorizedMaximumCostUsd: maximumTotalCostUsd,
    costEvidenceStatus,
    structuralIssues,
    responseContentIncluded: false
  };
}

function auditReceipts(rows) {
  const assessments = rows.map(({ receipt, fileName }) => receiptAssessment(receipt, fileName));
  const digests = assessments.map((item) => item.authorizationDigest).filter(Boolean);
  const duplicateDigests = [...new Set(digests.filter((digest, index) => digests.indexOf(digest) !== index))];
  const unresolved = assessments.filter((item) =>
    item.costEvidenceStatus === 'legacy_provider_attempt_cost_unresolved'
    || item.costEvidenceStatus === 'cost_evidence_incomplete');
  const invalid = assessments.filter((item) => item.costEvidenceStatus === 'invalid_receipt_cost_evidence');
  const recordedActualCostUsd = money(assessments.reduce(
    (sum, item) => sum + Number(item.recordedActualCostUsd || 0), 0));
  const unresolvedAuthorizedEnvelopeUsd = money(unresolved.reduce(
    (sum, item) => sum + Number(item.authorizedMaximumCostUsd || 0), 0));
  const status = duplicateDigests.length || invalid.length
    ? 'invalid_receipt_set'
    : unresolved.length
      ? 'manual_legacy_cost_reconciliation_required'
      : 'fully_reconciled';
  return {
    auditVersion: AUDIT_VERSION,
    status,
    summary: {
      authorizationReceiptCount: assessments.length,
      providerTransportAttemptCount: assessments.reduce(
        (sum, item) => sum + item.providerTransportAttemptCount, 0),
      exactCostRecordedCount: assessments.filter((item) => item.costEvidenceStatus === 'exact_cost_recorded').length,
      confirmedZeroCount: assessments.filter((item) =>
        item.costEvidenceStatus === 'confirmed_zero_before_provider_transport').length,
      unresolvedLegacyCostCount: unresolved.length,
      invalidReceiptCount: invalid.length,
      recordedActualCostUsd,
      unresolvedAuthorizedEnvelopeUsd,
      conservativeRecordedPlusUnresolvedEnvelopeUsd: money(recordedActualCostUsd + unresolvedAuthorizedEnvelopeUsd),
      duplicateAuthorizationDigests: duplicateDigests
    },
    receipts: assessments,
    interpretation: unresolved.length
      ? 'Recorded actual cost is a lower bound. The conservative envelope adds each unresolved authorization cap; it is not a claim that this amount was billed.'
      : 'All discovered authorization receipts have explicit cost evidence.',
    providerCallAuthorized: false,
    databaseImpact: 'none_read_only_local_receipts',
    candidateContentIncluded: false,
    publicationAuthorized: false
  };
}

function runSelfTest() {
  const digest = (character) => character.repeat(64);
  const sealed = (receipt) => ({
    ...receipt,
    executionReceiptSha256: subjectPracticeObservationScenarioBlueprintExecutionReceiptSha256For(receipt)
  });
  const report = auditReceipts([
    { fileName: `${digest('a')}.json`, receipt: sealed({
      authorizationDigest: digest('a'), status: 'stopped_on_first_failure',
      providerTransportAttemptCount: 0, gatewayRequestCount: 1, actualCostUsd: 0,
      maximumTotalCostUsd: 0.0025, failures: [{ reasonCode: 'gateway_no_key_available' }]
    }) },
    { fileName: `${digest('b')}.json`, receipt: sealed({
      authorizationDigest: digest('b'), status: 'stopped_on_first_failure',
      providerTransportAttemptCount: 1, gatewayRequestCount: 1, actualCostUsd: 0,
      maximumTotalCostUsd: 0.0025, failures: [{ reasonCode: 'provider_schema_invalid' }], providerCalls: []
    }) },
    { fileName: `${digest('c')}.json`, receipt: sealed({
      authorizationDigest: digest('c'), status: 'stopped_on_first_failure',
      providerTransportAttemptCount: 1, gatewayRequestCount: 1, actualCostUsd: 0.0017,
      maximumTotalCostUsd: 0.0025, failures: [{ reasonCode: 'provider_schema_invalid',
        promptTokens: 400, completionTokens: 1200, actualCostUsd: 0.0017, billedUsageRecorded: true }],
      providerCalls: []
    }) }
  ]);
  const checks = {
    noKeyFailureIsConfirmedZero: report.summary.confirmedZeroCount === 1,
    legacyAttemptIsNotMisreportedAsZero: report.summary.unresolvedLegacyCostCount === 1,
    billedFailureIsExactCost: report.summary.exactCostRecordedCount === 1
      && report.summary.recordedActualCostUsd === 0.0017,
    unresolvedEnvelopeIsSeparateFromActual: report.summary.unresolvedAuthorizedEnvelopeUsd === 0.0025
      && report.summary.conservativeRecordedPlusUnresolvedEnvelopeUsd === 0.0042,
    outputExcludesCandidateContent: report.candidateContentIncluded === false
      && report.publicationAuthorized === false,
    everyAcceptedReceiptDigestIsVerified:
      report.receipts.every((receipt) => receipt.executionReceiptDigestVerified === true)
  };
  return {
    mode: 'scenario_blueprint_spend_audit_self_test', auditVersion: AUDIT_VERSION,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed', checks,
    providerCallCount: 0, databaseImpact: 'none_fixture_only', publicationImpact: 'none'
  };
}

function main() {
  if (process.argv.includes('--self-test')) {
    const result = runSelfTest();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== 'passed') process.exitCode = 1;
    return;
  }
  const directory = path.resolve(process.argv.find((value) => value.startsWith('--receipts-dir='))
    ?.slice('--receipts-dir='.length)
    || path.join(__dirname, '../artifacts/ai-questioning/scenario-blueprint-executions'));
  const rows = fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => ({
        fileName: entry.name,
        receipt: JSON.parse(fs.readFileSync(path.join(directory, entry.name), 'utf8'))
      }))
    : [];
  process.stdout.write(`${JSON.stringify(auditReceipts(rows), null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { AUDIT_VERSION, auditReceipts, receiptAssessment };
