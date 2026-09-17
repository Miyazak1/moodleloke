const path = require('node:path');
const { execFileSync } = require('node:child_process');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runJsonCheck(check) {
  const scriptPath = path.resolve(__dirname, check.script);
  const stdout = execFileSync(process.execPath, [scriptPath, ...check.args, '--json'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${check.label} did not emit valid JSON: ${error.message}\n${stdout.slice(0, 400)}`);
  }
  assert(report.mode === check.mode, `${check.label} mode drifted: ${report.mode}`);
  assert(report.status === 'passed', `${check.label} did not pass: ${report.status}`);
  assert(report.productionImpact === 'none_fixture_only', `${check.label} must remain fixture-only, got ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `${check.label} must remain no-provider, got ${report.providerImpact}`);
  return {
    label: check.label,
    mode: report.mode,
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    sampleCount: Number(report.sampleCount ?? report.fixtureCount ?? report.fixtures ?? report.samples?.length ?? report.summary?.sampleCount ?? 0)
  };
}

function main() {
  const checks = [
    {
      label: 'math_question_plan_shadow',
      script: 'csca-subject-practice-production-audit.cjs',
      args: ['--self-test-math-question-plan-shadow'],
      mode: 'math_question_plan_shadow_self_test'
    },
    {
      label: 'physics_question_plan_shadow',
      script: 'csca-subject-practice-production-audit.cjs',
      args: ['--self-test-physics-question-plan-shadow'],
      mode: 'physics_question_plan_shadow_self_test'
    },
    {
      label: 'math_question_plan_calibration',
      script: 'csca-subject-practice-question-plan-calibration.cjs',
      args: ['--self-test-math'],
      mode: 'question_plan_calibration_math_self_test'
    },
    {
      label: 'chemistry_current_question_plan_calibration',
      script: 'csca-subject-practice-question-plan-calibration.cjs',
      args: ['--self-test-chemistry-current'],
      mode: 'question_plan_calibration_chemistry_current_self_test'
    },
    {
      label: 'chemistry_basic_ph_question_plan',
      script: 'csca-subject-practice-production-audit.cjs',
      args: ['--self-test-chemistry-basic-ph-question-plan-calibration'],
      mode: 'chemistry_basic_ph_question_plan_calibration_self_test'
    },
    {
      label: 'chemistry_strong_acid_base_question_plan',
      script: 'csca-chemistry-strong-acid-base-question-plan-self-test.cjs',
      args: [],
      mode: 'chemistry_strong_acid_base_question_plan_self_test'
    },
    {
      label: 'current_open_cell_question_plans',
      script: 'csca-current-open-cell-question-plan-self-test.cjs',
      args: [],
      mode: 'current_open_cell_question_plan_self_test'
    },
    {
      label: 'chemistry_question_plan_execution',
      script: 'csca-subject-practice-production-audit.cjs',
      args: ['--self-test-question-plan-execution'],
      mode: 'question_plan_execution_self_test'
    },
    {
      label: 'question_plan_repair_budget',
      script: 'csca-question-plan-repair-budget-self-test.cjs',
      args: [],
      mode: 'question_plan_repair_budget_self_test'
    },
    {
      label: 'owner_candidate_content_inspection',
      script: 'csca-subject-practice-owner-candidate-inspection.cjs',
      args: ['--self-test'],
      mode: 'subject_practice_owner_candidate_inspection_self_test'
    },
    {
      label: 'owner_revalidation_content_precondition',
      script: 'csca-subject-practice-owner-revalidation-apply.cjs',
      args: ['--self-test-content-precondition'],
      mode: 'owner_revalidation_content_precondition_self_test'
    },
    {
      label: 'output_token_calibration',
      script: 'csca-subject-practice-output-token-calibration.cjs',
      args: ['--self-test'],
      mode: 'subject_practice_output_token_calibration_self_test'
    }
  ];
  const results = checks.map(runJsonCheck);
  const report = {
    mode: 'question_plan_no_provider_acceptance',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    checks: results
  };
  if (hasFlag('json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`QuestionPlan no-provider acceptance: ${report.status}`);
    for (const result of results) {
      console.log(`- ${result.label}: ${result.status}, samples=${result.sampleCount}`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
