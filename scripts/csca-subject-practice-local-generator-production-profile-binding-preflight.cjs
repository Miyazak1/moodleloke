#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const path = require('node:path');
const { loadEnv } = require('./load-env.cjs');
loadEnv(path.resolve(__dirname, '..'));

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const {
  POLICY_VERSION,
  bindings,
  projectedTargetProfile,
  bindingDigest
} = require('./lib/csca-subject-practice-local-generator-production-profile-bindings.cjs');

function comparableCell(cell) {
  return {
    subject: String(cell.subject ?? ''),
    productionRunId: Number(cell.runId ?? 0),
    productionCellId: Number(cell.id ?? 0),
    topicId: Number(cell.topicId ?? 0),
    topicCode: String(cell.topicCode ?? ''),
    topicTitle: String(cell.topicTitle ?? ''),
    difficultyBand: String(cell.difficultyBand ?? ''),
    targetProfile: projectedTargetProfile(cell.targetProfile)
  };
}

function reasonsFor(expected, actual) {
  if (!actual) return ['production_cell_missing'];
  const reasons = [];
  for (const field of ['subject', 'productionRunId', 'productionCellId', 'topicId', 'topicCode', 'topicTitle', 'difficultyBand']) {
    if (expected[field] !== actual[field]) reasons.push(`${field}_mismatch`);
  }
  for (const [field, value] of Object.entries(expected.targetProfile)) {
    if (JSON.stringify(value) !== JSON.stringify(actual.targetProfile[field])) reasons.push(`target_profile_${field}_mismatch`);
  }
  return reasons;
}

function selfTest() {
  const expected = bindings.math;
  const matching = comparableCell({
    id: expected.productionCellId,
    runId: expected.productionRunId,
    subject: expected.subject,
    topicId: expected.topicId,
    topicCode: expected.topicCode,
    topicTitle: expected.topicTitle,
    difficultyBand: expected.difficultyBand,
    targetProfile: expected.targetProfile
  });
  const profileDrift = {
    ...matching,
    targetProfile: { ...matching.targetProfile, cognitiveSkill: 'concept_discrimination' }
  };
  const identityDrift = { ...matching, topicId: matching.topicId + 1 };
  const checks = {
    exactBindingAccepted: reasonsFor(expected, matching).length === 0,
    profileDriftRejected: reasonsFor(expected, profileDrift).includes('target_profile_cognitiveSkill_mismatch'),
    identityDriftRejected: reasonsFor(expected, identityDrift).includes('topicId_mismatch'),
    missingCellRejected: reasonsFor(expected, null).includes('production_cell_missing'),
    digestChangesWithProfile: bindingDigest(matching) !== bindingDigest(profileDrift),
    digestChangesWithIdentity: bindingDigest(matching) !== bindingDigest(identityDrift)
  };
  return {
    mode: 'subject_practice_local_generator_production_profile_binding_self_test',
    policyVersion: POLICY_VERSION,
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    checks,
    providerImpact: 'none_no_provider_call',
    databaseImpact: 'none_fixture_only',
    studentPublicationImpact: 'none'
  };
}

async function execute() {
  const expected = Object.values(bindings);
  if (!String(process.env.DATABASE_URL ?? '').trim()) {
    return {
      mode: 'subject_practice_local_generator_production_profile_binding_preflight',
      policyVersion: POLICY_VERSION,
      status: 'configuration_required',
      reason: 'database_url_missing',
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'none_not_connected',
      studentPublicationImpact: 'none'
    };
  }
  const prisma = new PrismaClient();
  try {
    const cells = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return tx.cscaSubjectPracticeProductionCell.findMany({
        where: { id: { in: expected.map((item) => item.productionCellId) } },
        select: {
          id: true, runId: true, subject: true, topicId: true, topicCode: true,
          topicTitle: true, difficultyBand: true, targetProfile: true
        },
        orderBy: { id: 'asc' }
      });
    }, { isolationLevel: 'RepeatableRead' });
    const results = expected.map((binding) => {
      const cell = cells.find((item) => item.id === binding.productionCellId);
      const actual = cell ? comparableCell(cell) : null;
      const reasons = reasonsFor(binding, actual);
      return {
        subject: binding.subject,
        productionRunId: binding.productionRunId,
        productionCellId: binding.productionCellId,
        expectedBindingDigest: binding.bindingDigest,
        actualBindingDigest: actual ? bindingDigest(actual) : null,
        current: reasons.length === 0,
        reasons
      };
    });
    return {
      mode: 'subject_practice_local_generator_production_profile_binding_preflight',
      policyVersion: POLICY_VERSION,
      status: results.every((item) => item.current) ? 'current' : 'drift_detected',
      checkedCount: results.length,
      currentCount: results.filter((item) => item.current).length,
      results,
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'read_only_repeatable_read',
      studentPublicationImpact: 'none'
    };
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  const operation = process.argv.includes('--self-test') ? Promise.resolve(selfTest()) : execute();
  operation.then((report) => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (process.argv.includes('--require-current') && report.status !== 'current') process.exitCode = 1;
    if (process.argv.includes('--self-test') && report.status !== 'passed') process.exitCode = 1;
  }).catch((error) => {
    const report = {
      mode: 'subject_practice_local_generator_production_profile_binding_preflight',
      policyVersion: POLICY_VERSION,
      status: 'database_unavailable',
      reason: error instanceof Error ? error.message : String(error),
      providerImpact: 'none_no_provider_call',
      databaseImpact: 'read_only_attempt_failed',
      studentPublicationImpact: 'none'
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (process.argv.includes('--require-current')) process.exitCode = 1;
  });
}

module.exports = { execute, selfTest, comparableCell, reasonsFor };
