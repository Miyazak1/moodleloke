#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const {
  SUBJECT_PRACTICE_VERIFICATION_CAPABILITY_POLICY_VERSION,
  subjectPracticeVerificationCapabilityRegistry
} = require('../backend/src/ai-questioning/subject-practice-verification-capability-policy');
const { report: releaseBenchmark } = require('./csca-subject-practice-verification-release-benchmark.cjs');

const capabilities = subjectPracticeVerificationCapabilityRegistry();
const levelCounts = capabilities.reduce((counts, capability) => {
  counts[capability.level] = (counts[capability.level] || 0) + 1;
  return counts;
}, {});
const automaticPublicationEligibleCount = capabilities.filter((capability) => capability.automaticPublicationEligible).length;

const report = {
  mode: 'subject_practice_verification_capability_report',
  status: automaticPublicationEligibleCount > 0 ? 'qualified_families_available' : 'verification_first_baseline_no_qualified_families',
  policyVersion: SUBJECT_PRACTICE_VERIFICATION_CAPABILITY_POLICY_VERSION,
  productionImpact: 'none_read_only_policy_report',
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  publicationGateImpact: 'none_shadow_registry_not_connected_to_production_gate',
  selectivePublicationPrinciple: 'unverified_family_must_remain_unpublished_or_terminal_incomplete',
  registeredFamilyCount: capabilities.length,
  automaticPublicationEligibleCount,
  levelCounts,
  releaseBenchmark: {
    status: releaseBenchmark.status,
    binding: releaseBenchmark.expectedBinding,
    reasonCodes: releaseBenchmark.decision.reasonCodes,
    metrics: releaseBenchmark.decision.metrics,
    thresholds: releaseBenchmark.decision.thresholds
  },
  capabilities
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Subject-practice verification capability: ${report.status}`);
  console.log(`- policy=${report.policyVersion}`);
  console.log(`- registered=${report.registeredFamilyCount}, autoPublishEligible=${report.automaticPublicationEligibleCount}`);
  console.log(`- levels=${Object.entries(report.levelCounts).map(([level, count]) => `${level}:${count}`).join(',')}`);
  console.log(`- releaseBenchmark=${report.releaseBenchmark.status}; reasons=${report.releaseBenchmark.reasonCodes.join(',') || '(none)'}`);
  for (const capability of capabilities) {
    console.log(`- ${capability.subject}/${capability.taskFamily}: ${capability.level}, deterministic=${capability.deterministicCoverage}, benchmark=${capability.benchmarkStatus}, next=${capability.nextRequiredCapability}`);
  }
}
