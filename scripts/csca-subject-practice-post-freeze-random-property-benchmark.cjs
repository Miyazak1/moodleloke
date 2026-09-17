#!/usr/bin/env node

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' }
});

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('./fixtures/subject-practice-post-freeze-random-manifest-v6-five-family-engine-core.cjs');
const { QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service');
const {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAdherenceFor
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  generateSubjectPracticeMathElementaryLocally
} = require('../backend/src/ai-questioning/subject-practice-math-elementary-local-generator');
const {
  generateSubjectPracticeChemistryAcidBaseLocally
} = require('../backend/src/ai-questioning/subject-practice-chemistry-acid-base-local-generator');
const {
  generateSubjectPracticePhysicsKinematicsLocally
} = require('../backend/src/ai-questioning/subject-practice-physics-kinematics-local-generator');
const {
  generateSubjectPracticeMathDerivativeLocally
} = require('../backend/src/ai-questioning/subject-practice-math-derivative-local-generator');

const workspaceRoot = path.resolve(__dirname, '..');
const validator = new QuestionValidatorService();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function committedSeed(subjectManifest, scopeId, index) {
  const digest = sha256(`${subjectManifest.seedNamespace}\n${scopeId}\n${index}`);
  return (Number.parseInt(digest.slice(0, 12), 16) % 1000000) + 1000;
}

function facadeTargetsCanonical(source, expectedTarget) {
  if (!expectedTarget) return true;
  const escapedTarget = expectedTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`export\\s+\\*\\s+from\\s+['\"]${escapedTarget}['\"]\\s*;`).test(source);
}

function validateFreeze(subjectManifest) {
  const solverPath = path.resolve(workspaceRoot, subjectManifest.solverPath);
  const actualSolverSha256 = sha256(fs.readFileSync(solverPath));
  const actualSeedCommitmentSha256 = sha256(subjectManifest.seedNamespace);
  const compatibilityFacadeSource = subjectManifest.compatibilityFacadePath
    ? fs.readFileSync(path.resolve(workspaceRoot, subjectManifest.compatibilityFacadePath), 'utf8')
    : null;
  const compatibilityFacadeTargetMatched = compatibilityFacadeSource === null
    ? true
    : facadeTargetsCanonical(compatibilityFacadeSource, subjectManifest.compatibilityFacadeExportTarget);
  const negativeControlRejectedWrongFacadeTarget = subjectManifest.compatibilityFacadeExportTarget
    ? !facadeTargetsCanonical(
      `export * from '${subjectManifest.compatibilityFacadeExportTarget}-tampered';`,
      subjectManifest.compatibilityFacadeExportTarget
    )
    : true;
  const actualGeneratorSha256 = subjectManifest.generatorPath
    ? sha256(fs.readFileSync(path.resolve(workspaceRoot, subjectManifest.generatorPath)))
    : null;
  const generatorHashMatched = actualGeneratorSha256 === null
    ? true
    : actualGeneratorSha256 === subjectManifest.generatorSha256;
  const generatorFacadeSource = subjectManifest.generatorFacadePath
    ? fs.readFileSync(path.resolve(workspaceRoot, subjectManifest.generatorFacadePath), 'utf8')
    : null;
  const generatorFacadeTargetMatched = generatorFacadeSource === null
    ? true
    : generatorFacadeSource.includes(`from '${subjectManifest.generatorFacadeImportTarget}'`);
  const negativeControlRejectedWrongGeneratorTarget = subjectManifest.generatorFacadeImportTarget
    ? !`from '${subjectManifest.generatorFacadeImportTarget}-tampered'`
      .includes(`from '${subjectManifest.generatorFacadeImportTarget}'`)
    : true;
  return {
    identityOwner: subjectManifest.identityOwner ?? 'legacy_backend_solver',
    solverPath: subjectManifest.solverPath,
    expectedSolverSha256: subjectManifest.solverSha256,
    actualSolverSha256,
    solverHashMatched: actualSolverSha256 === subjectManifest.solverSha256,
    compatibilityFacadePath: subjectManifest.compatibilityFacadePath ?? null,
    compatibilityFacadeExportTarget: subjectManifest.compatibilityFacadeExportTarget ?? null,
    compatibilityFacadeTargetMatched,
    negativeControlRejectedWrongFacadeTarget,
    generatorPath: subjectManifest.generatorPath ?? null,
    expectedGeneratorSha256: subjectManifest.generatorSha256 ?? null,
    actualGeneratorSha256,
    generatorHashMatched,
    generatorFacadePath: subjectManifest.generatorFacadePath ?? null,
    generatorFacadeImportTarget: subjectManifest.generatorFacadeImportTarget ?? null,
    generatorFacadeTargetMatched,
    negativeControlRejectedWrongGeneratorTarget,
    expectedSeedCommitmentSha256: subjectManifest.seedCommitmentSha256,
    actualSeedCommitmentSha256,
    seedCommitmentMatched: actualSeedCommitmentSha256 === subjectManifest.seedCommitmentSha256
  };
}

const mathBlueprint = {
  id: 16, subject: 'math', topicId: 69, topicCode: 'M-FUN-002', topicModule: '函数',
  topicTitle: '基本初等函数', syllabusVersion: '2025',
  examScope: '幂函数、指数函数、对数函数和根式函数的基本性质。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'], excludedScope: [],
  difficulty: 'basic', questionType: 'single_choice', skill: 'concept_identification', constraints: {}
};
const mathSlots = [
  ['logarithmic', 'domain'],
  ['exponential', 'range'],
  ['radical', 'monotonicity'],
  ['power', 'function_value']
];

function runMath() {
  const freeze = validateFreeze(manifest.subjects.math);
  const results = [];
  for (const [functionClass, propertyTarget] of mathSlots) {
    const plan = buildSubjectPracticeQuestionPlan({
      subject: 'math', topicId: 69, topicTitle: mathBlueprint.topicTitle, productionCellId: 16,
      targetDifficulty: 'basic', taskFamily: 'elementary_function_direct_property',
      requiredElementaryFunctionClass: functionClass, requiredSinglePropertyTarget: propertyTarget
    });
    const scopeId = `math-basic-elementary-rotation-v1:${functionClass}:${propertyTarget}`;
    for (let index = 0; index < manifest.casesPerScope; index += 1) {
      const seed = committedSeed(manifest.subjects.math, scopeId, index);
      const generated = generateSubjectPracticeMathElementaryLocally({ blueprint: mathBlueprint, questionPlan: plan, seed });
      const review = generated.candidate ? validator.review(generated.candidate, {
        subject: 'math', intendedUse: 'subject_practice', topicId: 69,
        topicTitle: mathBlueprint.topicTitle, syllabusVersion: '2025', questionPlan: plan
      }) : null;
      const adherence = generated.candidate ? subjectPracticeQuestionPlanAdherenceFor(plan, generated.candidate) : null;
      const passed = generated.status === 'generated_and_self_verified'
        && generated.scopeId === scopeId
        && review !== null
        && !review.issues.some((issue) => issue.severity === 'error')
        && adherence?.adheres === true;
      results.push({ scopeId, index, seed, passed, status: generated.status, reasonCodes: generated.reasonCodes });
    }
  }
  return summarize('math', freeze, results);
}

const chemistryBlueprint = {
  id: 41, subject: 'chemistry', topicId: 642, topicCode: 'C-BASIC-003', topicModule: '溶液',
  topicTitle: '溶液浓度与pH计算', syllabusVersion: '2025',
  examScope: '一元强酸强碱的稀释、中和、pH与酸碱性判断。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['medium'],
  excludedScope: ['weak_acid_base', 'polyprotic', 'buffer', 'hydrolysis', 'activity', 'titration_curve'],
  difficulty: 'medium', questionType: 'single_choice', skill: 'standard_application', constraints: {}
};
const chemistryRelations = ['strong_acid_dilution', 'strong_base_dilution', 'strong_acid_base_neutralization'];
const chemistryTargets = ['ph_value', 'acid_base_character'];

function runChemistry() {
  const freeze = validateFreeze(manifest.subjects.chemistry);
  const results = [];
  for (const relationKind of chemistryRelations) {
    for (const answerTarget of chemistryTargets) {
      const plan = buildSubjectPracticeQuestionPlan({
        subject: 'chemistry', topicId: 642, topicTitle: chemistryBlueprint.topicTitle, productionCellId: 41,
        targetDifficulty: 'medium', taskFamily: 'ph_dilution_strong_acid_base_neutralization',
        exactChemistryRelationKind: relationKind,
        exactChemistryAnswerTarget: answerTarget
      });
      const scopeId = `chemistry-strong-acid-base-v3:${relationKind}:${answerTarget}`;
      for (let index = 0; index < manifest.casesPerScope; index += 1) {
        const seed = committedSeed(manifest.subjects.chemistry, scopeId, index);
        const generated = generateSubjectPracticeChemistryAcidBaseLocally({
          blueprint: chemistryBlueprint, questionPlan: plan, seed, relationKind, answerTarget
        });
        const review = generated.candidate ? validator.review(generated.candidate, {
          subject: 'chemistry', intendedUse: 'subject_practice', topicId: 642,
          topicTitle: chemistryBlueprint.topicTitle, syllabusVersion: '2025', questionPlan: plan
        }) : null;
        const adherence = generated.candidate ? subjectPracticeQuestionPlanAdherenceFor(plan, generated.candidate) : null;
        const passed = generated.status === 'generated_and_self_verified'
          && generated.scopeId === scopeId
          && review !== null
          && !review.issues.some((issue) => issue.severity === 'error')
          && adherence?.adheres === true;
        results.push({ scopeId, index, seed, passed, status: generated.status, reasonCodes: generated.reasonCodes });
      }
    }
  }
  return summarize('chemistry', freeze, results);
}

const physicsBlueprint = {
  id: 24, subject: 'physics', topicId: 8, topicCode: 'P-MECH-001', topicModule: '力学',
  topicTitle: 'Kinematics', syllabusVersion: '2025',
  examScope: '直线运动中位移、时间、速度和加速度的基本关系。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'],
  excludedScope: ['graph', 'piecewise_motion', 'multi_stage_model'],
  difficulty: 'basic', questionType: 'single_choice', skill: 'direct_application', constraints: {}
};
const physicsRelations = [
  'uniform_speed',
  'acceleration_from_velocity_change',
  'final_velocity_from_initial_acceleration_time',
  'displacement_from_initial_acceleration_time'
];

function runPhysics() {
  const freeze = validateFreeze(manifest.subjects.physics);
  const results = [];
  for (const relationKind of physicsRelations) {
    const plan = buildSubjectPracticeQuestionPlan({
      subject: 'physics', topicId: 8, topicTitle: physicsBlueprint.topicTitle, productionCellId: 24,
      targetDifficulty: 'basic', taskFamily: 'kinematics_basic_direct_relation',
      exactPhysicsKinematicsScope: relationKind
    });
    const scopeId = `physics-basic-kinematics-v2:${relationKind}`;
    for (let index = 0; index < manifest.casesPerScope; index += 1) {
      const seed = committedSeed(manifest.subjects.physics, scopeId, index);
      const generated = generateSubjectPracticePhysicsKinematicsLocally({
        blueprint: physicsBlueprint, questionPlan: plan, seed, relationKind
      });
      const review = generated.candidate ? validator.review(generated.candidate, {
        subject: 'physics', intendedUse: 'subject_practice', topicId: 8,
        topicTitle: physicsBlueprint.topicTitle, syllabusVersion: '2025', questionPlan: plan
      }) : null;
      const adherence = generated.candidate ? subjectPracticeQuestionPlanAdherenceFor(plan, generated.candidate) : null;
      const passed = generated.status === 'generated_and_self_verified'
        && generated.scopeId === scopeId
        && review !== null
        && !review.issues.some((issue) => issue.severity === 'error')
        && adherence?.adheres === true;
      results.push({ scopeId, index, seed, passed, status: generated.status, reasonCodes: generated.reasonCodes });
    }
  }
  return summarize('physics', freeze, results);
}

const mathDerivativeBlueprint = {
  id: 10, subject: 'math', topicId: 71, topicCode: 'M-CALC-001', topicModule: '微积分',
  topicTitle: '导数与微积分初步', syllabusVersion: '2025',
  examScope: '多项式函数的直接求导与指定点导数值。',
  allowedQuestionTypes: ['single_choice'], difficultyRange: ['basic'],
  excludedScope: ['domain_trap', 'piecewise_function', 'implicit_differentiation', 'higher_derivative'],
  difficulty: 'basic', questionType: 'single_choice', skill: 'multi_step_reasoning', constraints: {}
};

function runMathDerivative() {
  const subjectManifest = manifest.subjects.mathDerivative;
  const freeze = validateFreeze(subjectManifest);
  const scopeId = 'math-basic-derivative-v1:direct_polynomial_value';
  const plan = buildSubjectPracticeQuestionPlan({
    subject: 'math', topicId: 71, topicTitle: mathDerivativeBlueprint.topicTitle, productionCellId: 10,
    targetDifficulty: 'basic', taskFamily: 'derivative_direct_evaluation',
    planTemplate: 'math_derivative_condition_chain_v1',
    exactDerivativeScope: 'direct_polynomial_value'
  });
  const results = [];
  for (let index = 0; index < manifest.casesPerScope; index += 1) {
    const seed = committedSeed(subjectManifest, scopeId, index);
    const generated = generateSubjectPracticeMathDerivativeLocally({
      blueprint: mathDerivativeBlueprint,
      questionPlan: plan,
      seed
    });
    const review = generated.candidate ? validator.review(generated.candidate, {
      subject: 'math', intendedUse: 'subject_practice', topicId: 71,
      topicTitle: mathDerivativeBlueprint.topicTitle, syllabusVersion: '2025', questionPlan: plan
    }) : null;
    const adherence = generated.candidate ? subjectPracticeQuestionPlanAdherenceFor(plan, generated.candidate) : null;
    const passed = generated.status === 'generated_and_triple_verified'
      && generated.scopeId === scopeId
      && review !== null
      && !review.issues.some((issue) => issue.severity === 'error')
      && adherence?.adheres === true;
    results.push({ scopeId, index, seed, passed, status: generated.status, reasonCodes: generated.reasonCodes });
  }
  return summarize('math_derivative', freeze, results);
}

function summarize(subject, freeze, results) {
  const perScopeCounts = {};
  for (const result of results) {
    if (result.passed) perScopeCounts[result.scopeId] = (perScopeCounts[result.scopeId] ?? 0) + 1;
  }
  const failed = results.filter((result) => !result.passed);
  const freezeValid = freeze.solverHashMatched
    && freeze.seedCommitmentMatched
    && freeze.compatibilityFacadeTargetMatched
    && freeze.negativeControlRejectedWrongFacadeTarget
    && freeze.generatorHashMatched
    && freeze.generatorFacadeTargetMatched
    && freeze.negativeControlRejectedWrongGeneratorTarget;
  return {
    subject,
    status: freezeValid && failed.length === 0 ? 'passed' : 'failed',
    generatedAfterSolverFreeze: freezeValid,
    seedCommitmentPresent: freeze.seedCommitmentMatched,
    freeze,
    total: results.length,
    passed: results.length - failed.length,
    failedCount: failed.length,
    perScopeCounts,
    failures: failed.slice(0, 12)
  };
}

const subjects = {
  math: runMath(),
  physics: runPhysics(),
  chemistry: runChemistry(),
  mathDerivative: runMathDerivative()
};
const report = {
  mode: 'subject_practice_post_freeze_random_property_benchmark',
  reportVersion: 'subject-practice-post-freeze-random-property-benchmark-v6-five-family-engine-core',
  manifestVersion: manifest.manifestVersion,
  casesPerScope: manifest.casesPerScope,
  status: Object.values(subjects).every((entry) => entry.status === 'passed') ? 'passed' : 'failed',
  providerImpact: 'none_no_provider_call',
  dbImpact: 'none_no_database_connection',
  productionImpact: 'none_fixture_only_shadow',
  subjects
};

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}

module.exports = { report };
