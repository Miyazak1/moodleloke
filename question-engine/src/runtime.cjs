'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const ENGINE_API_VERSION = 'cscalite-question-engine-api-v4-five-family-offline-preview';
const READ_ONLY_OPERATIONS = Object.freeze([
  'capability_catalog',
  'release_readiness',
  'qualification_batch_preview',
  'generate_math_derivative_preview',
  'generate_physics_kinematics_preview',
  'generate_chemistry_acid_base_preview',
  'generate_math_elementary_preview',
  'generate_math_line_relation_preview'
]);

function rootFrom(input = {}) {
  const configured = String(input.root || process.env.CSCALITE_ROOT || '').trim();
  return path.resolve(configured || path.join(__dirname, '..', '..'));
}

function assertRuntimeRoot(root) {
  const required = [
    'backend/node_modules/ts-node',
    'question-engine/adapters/cscalite-host.cjs',
    'backend/src/ai-questioning/subject-practice-production-shadow-scope-registry.ts',
    'scripts/csca-subject-practice-three-subject-release-readiness.cjs',
    'scripts/csca-subject-practice-local-shadow-family-qualification-run.cjs'
  ];
  const missing = required.filter((entry) => !existsSync(path.join(root, entry)));
  if (missing.length) throw new Error(`question_engine_runtime_root_invalid:${missing.join(',')}`);
  return root;
}

function registerTypescript(root) {
  require(path.join(root, 'backend/node_modules/ts-node')).register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
  });
}

function capabilityCatalog(input = {}) {
  const root = assertRuntimeRoot(rootFrom(input));
  registerTypescript(root);
  const registry = require(path.join(
    root,
    'backend/src/ai-questioning/subject-practice-production-shadow-scope-registry.ts'
  ));
  const bindings = require(path.join(
    root,
    'backend/src/ai-questioning/subject-practice-local-generator-production-profile-binding-policy.ts'
  ));
  const hostAdapter = generatorPorts(root);
  const contracts = registry.subjectPracticeProductionShadowScopeContracts();
  return {
    apiVersion: ENGINE_API_VERSION,
    mode: 'read_only_adapter_over_verified_cscalite_runtime',
    migrationStage: 'phase_5_all_five_registered_families_in_engine_core',
    hostAdapterVersion: hostAdapter.adapterVersion,
    hostAdapterCapabilities: hostAdapter.capabilities,
    registryVersion: registry.SUBJECT_PRACTICE_PRODUCTION_SHADOW_SCOPE_REGISTRY_VERSION,
    productionProfileBindingPolicyVersion:
      bindings.SUBJECT_PRACTICE_LOCAL_GENERATOR_PRODUCTION_PROFILE_BINDING_POLICY_VERSION,
    contractCount: contracts.length,
    contracts: contracts.map((contract) => ({
      subject: contract.subject,
      taskFamily: contract.taskFamily,
      planTemplate: contract.planTemplate,
      expectedScopeIds: contract.expectedScopeIds,
      binding: contract.expectedBinding
    })),
    allowedOperations: [...READ_ONLY_OPERATIONS],
    forbiddenOperations: [
      'execute_observation_batch',
      'call_provider',
      'write_candidate',
      'publish_student_content'
    ],
    providerCallsAllowed: false,
    databaseWritesAllowed: false,
    studentPublicationAllowed: false
  };
}

function runJson(root, script, args = [], options = {}) {
  const stdout = execFileSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer || 32 * 1024 * 1024,
    env: process.env
  });
  return JSON.parse(stdout);
}

function releaseReadiness(input = {}) {
  const root = assertRuntimeRoot(rootFrom(input));
  return runJson(root, 'scripts/csca-subject-practice-three-subject-release-readiness.cjs', ['--compact']);
}

function cleanToken(value, name, pattern, maximumLength = 128) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > maximumLength || !pattern.test(normalized)) {
    throw new Error(`question_engine_${name}_invalid`);
  }
  return normalized;
}

function qualificationBatchPreview(input = {}) {
  const root = assertRuntimeRoot(rootFrom(input));
  const catalog = capabilityCatalog({ root });
  const subject = cleanToken(input.subject, 'subject', /^(math|physics|chemistry)$/);
  const taskFamily = cleanToken(input.taskFamily, 'task_family', /^[a-z0-9_]+$/);
  const planTemplate = cleanToken(input.planTemplate, 'plan_template', /^[a-z0-9_]+$/);
  const campaignId = cleanToken(input.campaignId, 'campaign_id', /^[a-zA-Z0-9._-]+$/, 160);
  const samplesPerScope = Number(input.samplesPerScope);
  if (!Number.isInteger(samplesPerScope) || samplesPerScope < 1 || samplesPerScope > 12) {
    throw new Error('question_engine_samples_per_scope_invalid');
  }
  const contract = catalog.contracts.find((entry) => entry.subject === subject
    && entry.taskFamily === taskFamily
    && entry.planTemplate === planTemplate);
  if (!contract) throw new Error('question_engine_exact_plan_not_registered');
  const baseUrl = String(input.baseUrl || 'http://127.0.0.1:3003').trim().replace(/\/+$/, '');
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(baseUrl)) {
    throw new Error('question_engine_preview_base_url_must_be_loopback');
  }
  return runJson(root, 'scripts/csca-subject-practice-local-shadow-family-qualification-run.cjs', [
    `--subject=${subject}`,
    `--task-family=${taskFamily}`,
    `--plan-template=${planTemplate}`,
    `--samples-per-scope=${samplesPerScope}`,
    `--campaign-id=${campaignId}`,
    `--base-url=${baseUrl}`,
    '--compact'
  ]);
}

function generateMathDerivativePreview(input = {}) {
  const root = assertRuntimeRoot(rootFrom(input));
  registerTypescript(root);
  const seed = Number(input.seed);
  if (!Number.isSafeInteger(seed)) throw new Error('question_engine_seed_must_be_safe_integer');
  const generatorModule = require(path.join(
    root,
    'question-engine/core/subject-practice-math-derivative-local-generator.ts'
  ));
  const { ports, buildQuestionPlan, adapterVersion } = generatorPorts(root);
  const generator = generatorModule.createSubjectPracticeMathDerivativeLocalGenerator({
    validate: ports.validate,
    adherenceFor: ports.adherenceFor
  });
  const questionPlan = buildQuestionPlan({
    subject: 'math',
    topicId: 71,
    topicTitle: '导数与微积分初步',
    productionCellId: 10,
    targetDifficulty: 'basic',
    taskFamily: 'derivative_direct_evaluation',
    planTemplate: 'math_derivative_condition_chain_v1',
    exactDerivativeScope: 'direct_polynomial_value'
  });
  const result = generator({
    blueprint: {
      id: 10,
      subject: 'math',
      topicId: 71,
      topicCode: 'M-CALC-001',
      topicModule: '微积分',
      topicTitle: '导数与微积分初步',
      syllabusVersion: '2025',
      difficulty: 'basic',
      questionType: 'single_choice',
      skill: 'multi_step_reasoning',
      constraints: {}
    },
    questionPlan,
    seed
  });
  return {
    apiVersion: ENGINE_API_VERSION,
    mode: 'offline_unpersisted_preview',
    hostAdapterVersion: adapterVersion,
    ...result,
    databaseWrites: 0,
    providerCalls: 0,
    studentPublicationAllowed: false
  };
}

function generatorPorts(root) {
  return require(path.join(root, 'question-engine/adapters/cscalite-host.cjs'))
    .createCscaliteHostAdapter(root);
}

function offlineEnvelope(result, adapterVersion) {
  return {
    apiVersion: ENGINE_API_VERSION,
    mode: 'offline_unpersisted_preview',
    hostAdapterVersion: adapterVersion,
    ...result,
    databaseWrites: 0,
    providerCalls: 0,
    studentPublicationAllowed: false
  };
}

function generatePhysicsKinematicsPreview(input = {}) {
  const root = assertRuntimeRoot(rootFrom(input));
  registerTypescript(root);
  const seed = Number(input.seed);
  if (!Number.isSafeInteger(seed)) throw new Error('question_engine_seed_must_be_safe_integer');
  const relationKind = cleanToken(input.relationKind, 'physics_relation', /^(uniform_speed|acceleration_from_velocity_change|final_velocity_from_initial_acceleration_time|displacement_from_initial_acceleration_time)$/);
  const module = require(path.join(root, 'question-engine/core/subject-practice-physics-kinematics-local-generator.ts'));
  const { ports, buildQuestionPlan, adapterVersion } = generatorPorts(root);
  const plan = buildQuestionPlan({
    subject: 'physics', topicId: 8, topicTitle: 'Kinematics', productionCellId: 24,
    targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
    exactPhysicsKinematicsScope: relationKind
  });
  const generator = module.createSubjectPracticePhysicsKinematicsLocalGenerator(ports);
  return offlineEnvelope(generator({
    blueprint: {
      id: 24, subject: 'physics', topicId: 8, topicCode: 'P-MECH-001', topicModule: '力学',
      topicTitle: 'Kinematics', syllabusVersion: '2025',
      examScope: '直线运动中位移、时间、速度和加速度的基本关系。',
      difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
    },
    questionPlan: plan, seed, relationKind
  }), adapterVersion);
}

function generateChemistryAcidBasePreview(input = {}) {
  const root = assertRuntimeRoot(rootFrom(input));
  registerTypescript(root);
  const seed = Number(input.seed);
  if (!Number.isSafeInteger(seed)) throw new Error('question_engine_seed_must_be_safe_integer');
  const relationKind = cleanToken(input.relationKind, 'chemistry_relation', /^(strong_acid_dilution|strong_base_dilution|strong_acid_base_neutralization)$/);
  const answerTarget = cleanToken(input.answerTarget, 'chemistry_answer_target', /^(ph_value|acid_base_character)$/);
  const module = require(path.join(root, 'question-engine/core/subject-practice-chemistry-acid-base-local-generator.ts'));
  const { ports, buildQuestionPlan, adapterVersion } = generatorPorts(root);
  const plan = buildQuestionPlan({
    subject: 'chemistry', topicId: 51, topicTitle: '溶液浓度与pH计算', productionCellId: 42,
    targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
    exactChemistryRelationKind: relationKind, exactChemistryAnswerTarget: answerTarget
  });
  const generator = module.createSubjectPracticeChemistryAcidBaseLocalGenerator(ports);
  return offlineEnvelope(generator({
    blueprint: {
      id: 42, subject: 'chemistry', topicId: 51, topicCode: 'C-BASIC-003', topicModule: '溶液',
      topicTitle: '溶液浓度与pH计算', syllabusVersion: '2025',
      examScope: '一元强酸强碱的稀释、中和、pH与酸碱性判断。',
      difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {}
    },
    questionPlan: plan, seed, relationKind, answerTarget
  }), adapterVersion);
}

function generateMathElementaryPreview(input = {}) {
  const root = assertRuntimeRoot(rootFrom(input));
  registerTypescript(root);
  const seed = Number(input.seed);
  if (!Number.isSafeInteger(seed)) throw new Error('question_engine_seed_must_be_safe_integer');
  const functionClass = cleanToken(input.functionClass, 'math_function_class', /^(logarithmic|exponential|radical|power)$/);
  const propertyTarget = cleanToken(input.propertyTarget, 'math_property_target', /^(domain|range|monotonicity|function_value)$/);
  const allowedPair = new Set(['logarithmic:domain', 'exponential:range', 'radical:monotonicity', 'power:function_value']);
  if (!allowedPair.has(`${functionClass}:${propertyTarget}`)) throw new Error('question_engine_math_elementary_pair_not_registered');
  const module = require(path.join(root, 'question-engine/core/subject-practice-math-elementary-local-generator.ts'));
  const { ports, buildQuestionPlan, adapterVersion } = generatorPorts(root);
  const plan = buildQuestionPlan({
    subject: 'math', topicId: 69, topicTitle: '基本初等函数', productionCellId: 16,
    targetDifficulty: 'basic', taskFamily: 'elementary_function_direct_property',
    requiredElementaryFunctionClass: functionClass, requiredSinglePropertyTarget: propertyTarget
  });
  const generator = module.createSubjectPracticeMathElementaryLocalGenerator(
    ports.validate
  );
  return offlineEnvelope(generator({
    blueprint: {
      id: 16, subject: 'math', topicId: 69, topicCode: 'M-FUN-002', topicModule: '函数',
      topicTitle: '基本初等函数', syllabusVersion: '2025',
      examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。',
      difficulty: 'basic', questionType: 'single_choice', skill: 'concept_identification', constraints: {}
    },
    questionPlan: plan, seed
  }), adapterVersion);
}

function generateMathLineRelationPreview(input = {}) {
  const root = assertRuntimeRoot(rootFrom(input));
  registerTypescript(root);
  const seed = Number(input.seed);
  if (!Number.isSafeInteger(seed)) throw new Error('question_engine_seed_must_be_safe_integer');
  const exactScope = cleanToken(input.exactScope, 'math_line_relation_scope', /^(slope_from_two_distinct_points|inclination_angle_from_line|identify_parallel_or_perpendicular_line|line_equation_from_point_and_slope)$/);
  const module = require(path.join(root, 'question-engine/core/subject-practice-math-line-relation-local-generator.ts'));
  const { ports, buildQuestionPlan, adapterVersion } = generatorPorts(root);
  const plan = buildQuestionPlan({
    subject: 'math', targetDifficulty: 'basic', topicTitle: 'line relation',
    productionCellId: 'line-relation-shadow-v1', taskFamily: 'math_line_relation_direct',
    planTemplate: 'math_line_relation_direct_v1', exactLineRelationScope: exactScope
  });
  const generator = module.createSubjectPracticeMathLineRelationLocalGenerator(ports);
  return offlineEnvelope(generator({
    blueprint: {
      id: 91001, topicId: 92001, subject: 'math', topicTitle: 'line relation',
      difficulty: 'basic', questionType: 'single_choice', syllabusVersion: 'line-relation-shadow-v1',
      skill: 'direct_application', constraints: {}
    },
    questionPlan: plan, seed
  }), adapterVersion);
}

module.exports = {
  ENGINE_API_VERSION,
  READ_ONLY_OPERATIONS,
  capabilityCatalog,
  generateChemistryAcidBasePreview,
  generateMathDerivativePreview,
  generateMathElementaryPreview,
  generateMathLineRelationPreview,
  generatePhysicsKinematicsPreview,
  qualificationBatchPreview,
  releaseReadiness,
  rootFrom
};
