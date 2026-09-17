const { execFileSync } = require('node:child_process');
const path = require('node:path');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

const {
  subjectPracticeBuildQuestionFingerprint,
  subjectPracticeClassifyTaskFamily,
  subjectPracticeCurrentPolicyBlockReasons,
  subjectPracticeMathDifficultyAudit,
  subjectPracticeNearDuplicateSignal,
  subjectPracticePhysicsDifficultyAudit,
  SUBJECT_PRACTICE_QUESTION_FINGERPRINT_POLICY_VERSION,
  SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION
} = require('../backend/src/ai-questioning/subject-practice-task-family-policy');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function scriptPath(name) {
  return path.resolve(__dirname, name);
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${error.message}\n${stdout.slice(0, 400)}`);
  }
}

function runNodeJson(args, label) {
  const stdout = execFileSync(process.execPath, args, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return parseJson(stdout, label);
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function runTaskFamilyFingerprintFixedEval() {
  const fixtures = [
    {
      label: 'math_sequence_two_condition',
      subject: 'math',
      topicTitle: '数列',
      difficulty: 'medium',
      prompt: '已知等差数列{an}中，S3=12，S6=42，求a4的值。',
      options: ['A.8', 'B.9', 'C.10', 'D.11'],
      explanation: '由S3和S6列方程求首项和公差。',
      expectedFamily: 'arithmetic_sequence_two_condition_solve_a1_d',
      expectedObject: 'sequence'
    },
    {
      label: 'math_function_property_composite',
      subject: 'math',
      topicTitle: '函数的概念与性质',
      difficulty: 'medium',
      prompt: '已知函数 f(x)=x/(x^2+1)，判断定义域、奇偶性和在[0,1]上的单调性，下列正确的是？',
      options: ['A', 'B', 'C', 'D'],
      explanation: '定义域R，奇函数，在[0,1]递增，值域[-1/2,1/2]。',
      expectedFamily: 'function_monotonicity_parity_statement',
      expectedObject: 'function'
    },
    {
      label: 'math_elementary_function_direct_property',
      subject: 'math',
      topicTitle: '基本初等函数',
      difficulty: 'basic',
      prompt: '已知函数 f(x)=log_2 x，则 f(x) 的定义域是（ ）',
      options: ['A.(0,+∞)', 'B.[0,+∞)', 'C.(-∞,0)', 'D.R'],
      explanation: '对数函数的真数必须大于0，因此定义域为(0,+∞)，选A。',
      expectedFamily: 'elementary_function_direct_property',
      expectedObject: 'function'
    },
    {
      label: 'physics_kinematics_direct_formula',
      subject: 'physics',
      topicTitle: '运动学',
      difficulty: 'hard',
      prompt: '物体做匀加速直线运动，初速度2 m/s，加速度3 m/s^2，求4 s后的速度。',
      options: ['A.14 m/s', 'B.12 m/s', 'C.10 m/s', 'D.8 m/s'],
      explanation: '直接代入v=v0+at。',
      expectedFamily: 'kinematics_constant_acceleration_direct',
      expectedObject: 'motion'
    },
    {
      label: 'physics_circuit_series',
      subject: 'physics',
      topicTitle: '电路',
      difficulty: 'medium',
      prompt: '两个电阻R1和R2串联接入电路，电源电压已知，判断总电阻和电流关系。',
      options: ['A', 'B', 'C', 'D'],
      explanation: '串联电阻相加，电流相同。',
      expectedFamily: 'circuit_ohm_kirchhoff_resistor_network',
      expectedObject: 'circuit'
    },
    {
      label: 'physics_optics_lens_two_relation',
      subject: 'physics',
      topicTitle: '几何光学',
      difficulty: 'medium',
      prompt: '凸透镜焦距为10 cm，物距由30 cm减小到25 cm，判断实像的像距和大小如何变化。',
      options: ['A.像距增大且像变大', 'B.像距减小且像变小', 'C', 'D'],
      explanation: '先由物距大于二倍焦距判断成倒立实像，再由透镜公式判断物体靠近时像距增大、像变大。',
      expectedFamily: 'waves_optics_interference_refraction'
    },
    {
      label: 'chemistry_gas_limewater',
      subject: 'chemistry',
      topicTitle: '气体的制备与检验',
      difficulty: 'medium',
      prompt: '实验室制取CO2后通入澄清石灰水，观察到变浑浊，下列说法正确的是？',
      options: ['A', 'B', 'C', 'D'],
      explanation: 'CO2使澄清石灰水变浑浊。',
      expectedFamily: 'gas_carbon_dioxide_limewater',
      expectedObject: 'experiment'
    },
    {
      label: 'chemistry_basic_ph_operation_error',
      subject: 'chemistry',
      topicTitle: '溶液浓度与 pH 计算',
      difficulty: 'basic',
      prompt: '用 pH 试纸测定稀盐酸时，若先用蒸馏水润湿试纸，测得 pH 与实际值相比如何？',
      options: ['A.偏高', 'B.偏低', 'C.不变', 'D.无法判断'],
      explanation: '润湿使待测液被稀释，H+ 浓度降低，因此测得 pH 偏高。',
      expectedFamily: 'basic_ph_measurement_or_preparation_error_judgement',
      expectedObject: 'experiment',
      expectedRepresentationType: 'experiment',
      expectedQuantitativeShape: 'comparison',
      expectedAnswerForm: 'option_judgement',
      expectedChemistryModel: 'ph_measurement_or_preparation_error',
      expectedConditionChange: 'paper_wetting'
    },
    {
      label: 'chemistry_classification_state_change_evidence',
      subject: 'chemistry',
      topicTitle: '物质分类与状态变化',
      difficulty: 'medium',
      prompt: '冰熔化后仍为水，通电分解后产生氢气和氧气，结合是否生成新物质和组成判断变化类别及水的物质分类。',
      options: ['A.先物理变化后化学变化，水是化合物', 'B.均为物理变化，水是混合物', 'C', 'D'],
      explanation: '熔化没有生成新物质；通电分解形成两种新物质。水是由两种元素组成的纯净物，属于化合物。',
      expectedFamily: 'classification_state_change_evidence_judgement'
    },
    {
      label: 'chemistry_basic_ph_preparation_error',
      subject: 'chemistry',
      topicTitle: '溶液浓度与 pH 计算',
      difficulty: 'basic',
      prompt: '配制 NaOH 溶液时，定容后俯视容量瓶刻度线，所得溶液的 pH 与准确值相比如何？',
      options: ['A.偏高', 'B.偏低', 'C.不变', 'D.无法判断'],
      explanation: '俯视使实际加水体积偏小，NaOH 浓度和 OH- 浓度偏高，因此 pH 偏高。',
      expectedFamily: 'basic_ph_measurement_or_preparation_error_judgement',
      expectedObject: 'solution_preparation',
      expectedRepresentationType: 'experiment',
      expectedQuantitativeShape: 'comparison',
      expectedAnswerForm: 'option_judgement',
      expectedChemistryModel: 'ph_measurement_or_preparation_error',
      expectedConditionChange: 'meniscus_or_final_volume'
    },
    {
      label: 'chemistry_organic_reaction_evidence',
      subject: 'chemistry',
      topicTitle: '有机化学基础',
      difficulty: 'hard',
      prompt: '某有机物完全燃烧生成CO2和H2O，并能与乙醇发生酯化反应，据此推断官能团和分子式。',
      options: ['A', 'B', 'C', 'D'],
      explanation: '由燃烧计量和酯化反应独立确定结构。',
      expectedFamily: 'organic_alcohol_aldehyde_acid_ester_conversion'
    }
  ];

  const samples = fixtures.map((fixture) => {
    const taskFamily = subjectPracticeClassifyTaskFamily(fixture);
    const fingerprint = subjectPracticeBuildQuestionFingerprint(fixture);
    assert(taskFamily === fixture.expectedFamily, `${fixture.label} classified as ${taskFamily}, expected ${fixture.expectedFamily}`);
    assert(fingerprint.taskFamily === fixture.expectedFamily, `${fixture.label} fingerprint family drifted to ${fingerprint.taskFamily}`);
    assert(fingerprint.subject === fixture.subject, `${fixture.label} fingerprint subject drifted to ${fingerprint.subject}`);
    assert(fingerprint.topicCompatibility?.compatible === true, `${fixture.label} topic compatibility must pass.`);
    assert(fingerprint.taskFamilyPolicyVersion === SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION, `${fixture.label} task-family policy version drifted.`);
    assert(fingerprint.fingerprintPolicyVersion === SUBJECT_PRACTICE_QUESTION_FINGERPRINT_POLICY_VERSION, `${fixture.label} fingerprint policy version drifted.`);
    if (fixture.expectedObject) {
      assert(fingerprint.objects.includes(fixture.expectedObject), `${fixture.label} fingerprint objects must include ${fixture.expectedObject}.`);
    }
    if (fixture.expectedRepresentationType) {
      assert(fingerprint.representationType === fixture.expectedRepresentationType, `${fixture.label} representation type drifted to ${fingerprint.representationType}.`);
    }
    if (fixture.expectedQuantitativeShape) {
      assert(fingerprint.quantitativeShape === fixture.expectedQuantitativeShape, `${fixture.label} quantitative shape drifted to ${fingerprint.quantitativeShape}.`);
    }
    if (fixture.expectedAnswerForm) {
      assert(fingerprint.answerForm === fixture.expectedAnswerForm, `${fixture.label} answer form drifted to ${fingerprint.answerForm}.`);
    }
    if (fixture.expectedChemistryModel) {
      assert(fingerprint.subjectExtension?.chemistryModel === fixture.expectedChemistryModel, `${fixture.label} chemistry model drifted to ${fingerprint.subjectExtension?.chemistryModel}.`);
    }
    if (fixture.expectedConditionChange) {
      assert(fingerprint.subjectExtension?.conditionChange === fixture.expectedConditionChange, `${fixture.label} condition change drifted to ${fingerprint.subjectExtension?.conditionChange}.`);
    }
    return {
      label: fixture.label,
      subject: fixture.subject,
      taskFamily,
      representationType: fingerprint.representationType,
      quantitativeShape: fingerprint.quantitativeShape,
      answerForm: fingerprint.answerForm
    };
  });

  const subjectGuardSamples = [
    {
      label: 'math_must_not_claim_chemistry_gas_family',
      subject: 'math',
      topicTitle: '函数',
      prompt: '实验室制取CO2后通入澄清石灰水。'
    },
    {
      label: 'physics_must_not_claim_math_sequence_family',
      subject: 'physics',
      topicTitle: '运动学',
      prompt: '已知等差数列{an}中，S3=12，S6=42，求a4的值。'
    },
    {
      label: 'chemistry_must_not_claim_math_sequence_family',
      subject: 'chemistry',
      topicTitle: '元素周期律',
      prompt: '已知等差数列{an}中，S3=12，S6=42，求a4的值。'
    }
  ].map((sample) => {
    const taskFamily = subjectPracticeClassifyTaskFamily(sample);
    assert(taskFamily === 'other', `${sample.label} should fall back to other, got ${taskFamily}`);
    return { label: sample.label, subject: sample.subject, taskFamily };
  });

  const incompatibleFingerprint = subjectPracticeBuildQuestionFingerprint({
    subject: 'chemistry',
    topicTitle: '实验安全与基本操作',
    difficulty: 'medium',
    taskFamily: 'gas_carbon_dioxide_limewater',
    prompt: '实验室制取CO2后通入澄清石灰水。'
  });
  assert(incompatibleFingerprint.taskFamily === 'other', 'Topic-incompatible chemistry fingerprint must fall back to other.');
  assert(
    incompatibleFingerprint.topicCompatibility?.reasonCode === 'subject_practice_task_family_topic_incompatible',
    'Topic-incompatible chemistry fingerprint must expose the compatibility reason.'
  );

  const mathDifficultyAudit = subjectPracticeMathDifficultyAudit({
    difficulty: 'hard',
    taskFamily: 'spatial_line_plane_concept_judgement'
  });
  assert(mathDifficultyAudit?.reasonCode === 'math_hard_simple_task_family', 'Hard-simple math difficulty audit must stay visible.');
  const physicsDifficultyAudit = subjectPracticePhysicsDifficultyAudit({
    difficulty: 'hard',
    taskFamily: 'kinematics_constant_acceleration_direct'
  });
  assert(physicsDifficultyAudit?.reasonCode === 'physics_hard_direct_formula_task_family', 'Hard direct-formula physics difficulty audit must stay visible.');

  const originalPhysicsVisualFlag = process.env.CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED;
  process.env.CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED = 'false';
  const physicsVisualDefaultReasons = subjectPracticeCurrentPolicyBlockReasons({
    subject: 'physics',
    designedDifficulty: 'medium',
    prompt: '如图所示，小球沿斜面下滑，判断速度变化。'
  });
  if (originalPhysicsVisualFlag == null) {
    delete process.env.CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED;
  } else {
    process.env.CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED = originalPhysicsVisualFlag;
  }
  assert(!physicsVisualDefaultReasons.includes('unbacked_visual_reference'), 'Physics visual current-policy must remain flag-gated by default.');
  const chemistryCurrentPolicyReasons = subjectPracticeCurrentPolicyBlockReasons({
    subject: 'chemistry',
    designedDifficulty: 'hard',
    prompt: '已知等差数列{an}中，S3=12，S6=42，求a4的值。'
  });
  assert(chemistryCurrentPolicyReasons.length === 0, 'Math/physics current-policy helpers must not block chemistry fixtures.');

  const nearDuplicate = subjectPracticeNearDuplicateSignal({
    candidate: {
      id: 2,
      subject: 'math',
      topicId: 350,
      topicTitle: '函数的概念与性质',
      difficulty: 'medium',
      taskFamily: 'function_monotonicity_parity_statement',
      prompt: '已知函数 f(x)=x/(x^2+1)，判断定义域、奇偶性、单调性和值域。'
    },
    recent: [
      {
        id: 1,
        subject: 'math',
        topicId: 350,
        topicTitle: '函数的概念与性质',
        difficulty: 'medium',
        taskFamily: 'function_monotonicity_parity_statement',
        prompt: '已知函数 f(x)=x/(x^2+1)，判断定义域、奇偶性、在[0,1]上的单调性和值域。'
      }
    ]
  });
  assert(nearDuplicate.decision === 'warn', 'Near-duplicate fallback must warn for same-expression same-family math fixtures.');
  assert(nearDuplicate.reasonCode === 'fingerprint_near_duplicate', 'Near-duplicate fallback must expose a stable reason code.');

  return {
    label: 'task_family_fingerprint_fixed_eval',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    sampleCount: samples.length,
    subjectGuardSampleCount: subjectGuardSamples.length,
    policyVersion: SUBJECT_PRACTICE_TASK_FAMILY_POLICY_VERSION,
    fingerprintPolicyVersion: SUBJECT_PRACTICE_QUESTION_FINGERPRINT_POLICY_VERSION,
    difficultyAuditReasons: [
      mathDifficultyAudit.reasonCode,
      physicsDifficultyAudit.reasonCode
    ],
    nearDuplicateDecision: nearDuplicate.decision,
    samples
  };
}

function runQuestionPlanFixedEval() {
  const report = runNodeJson([scriptPath('csca-question-plan-no-provider-acceptance.cjs'), '--json'], 'QuestionPlan fixed eval');
  assert(report.mode === 'question_plan_no_provider_acceptance', `QuestionPlan fixed eval mode drifted: ${report.mode}`);
  assert(report.status === 'passed', `QuestionPlan fixed eval did not pass: ${report.status}`);
  assert(report.productionImpact === 'none_fixture_only', `QuestionPlan fixed eval must remain fixture-only, got ${report.productionImpact}`);
  assert(report.providerImpact === 'none_no_provider_call', `QuestionPlan fixed eval must remain no-provider, got ${report.providerImpact}`);
  assert(report.dbImpact === 'none_fixture_only', `QuestionPlan fixed eval must remain DB-free, got ${report.dbImpact}`);
  return {
    label: 'question_plan_fixed_eval',
    status: report.status,
    productionImpact: report.productionImpact,
    providerImpact: report.providerImpact,
    dbImpact: report.dbImpact,
    checkCount: arrayFrom(report.checks).length,
    checks: arrayFrom(report.checks).map((check) => ({
      label: check.label,
      status: check.status,
      sampleCount: Number(check.sampleCount) || Number(check.samples) || null
    }))
  };
}

function runProfileDifficultyPatchFixedEval() {
  const report = runNodeJson([
    scriptPath('csca-subject-practice-production-audit.cjs'),
    '--self-test-profile-difficulty-patch-evidence',
    '--json'
  ], 'profile difficulty patch fixed eval');
  const summary = report.summary && typeof report.summary === 'object' ? report.summary : {};
  const patchCounts = arrayFrom(summary.patchCounts);
  const patchCountByVersion = new Map(patchCounts.map((entry) => [String(entry.patchVersion || ''), Number(entry.count) || 0]));
  assert(report.status === 'passed', `Profile difficulty patch fixed eval did not pass: ${report.status}`);
  assert(summary.productionImpact === 'none_audit_only', `Profile difficulty patch fixed eval must remain audit-only, got ${summary.productionImpact}`);
  assert(Number(summary.observedCount) >= 2, `Profile difficulty patch fixed eval must cover at least two patch fixtures, got ${summary.observedCount}`);
  assert(patchCountByVersion.get('math-logarithmic-domain-difficulty-evidence-patch-v1') >= 1, 'Profile fixed eval must cover math logarithmic-domain patch evidence.');
  assert(patchCountByVersion.get('math-exp-log-ordering-difficulty-evidence-patch-v1') >= 1, 'Profile fixed eval must cover math exp/log ordering patch evidence.');
  return {
    label: 'profile_difficulty_patch_fixed_eval',
    status: report.status,
    productionImpact: summary.productionImpact,
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    observedCount: Number(summary.observedCount) || 0,
    patchCounts
  };
}

function main() {
  const checks = [
    runTaskFamilyFingerprintFixedEval(),
    runQuestionPlanFixedEval(),
    runProfileDifficultyPatchFixedEval()
  ];
  const report = {
    mode: 'subject_practice_fixed_eval',
    status: checks.every((check) => check.status === 'passed') ? 'passed' : 'failed',
    scope: 'fixture_and_static_subject_practice_quality_eval',
    productionImpact: 'none_fixture_or_audit_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_fixture_only',
    observationImpact: 'none_no_observation_task_submission',
    studentConsumableImpact: 'none_does_not_publish_or_reclassify',
    checks
  };
  if (hasFlag('json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Subject-practice fixed eval: ${report.status}`);
  for (const check of checks) {
    const count = check.observedCount ?? check.checkCount ?? null;
    console.log(`- ${check.label}: ${check.status}${count == null ? '' : `, count=${count}`}`);
  }
}

try {
  main();
} catch (error) {
  if (hasFlag('json')) {
    console.log(JSON.stringify({
      mode: 'subject_practice_fixed_eval',
      status: 'failed',
      error: error?.message ?? String(error),
      productionImpact: 'none_fixture_or_audit_only',
      providerImpact: 'none_no_provider_call',
      dbImpact: 'none_fixture_only'
    }, null, 2));
  } else {
    console.error(error?.stack ?? error);
  }
  process.exitCode = 1;
}
