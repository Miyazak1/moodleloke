const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient, Prisma } = require('../backend/node_modules/@prisma/client');

const DEFAULT_DIVERSITY_QUALITY_AUDIT_LEDGER_PATH = 'docs/ai-questioning-diversity-quality-audit-ledger-2026-08-07.json';

let subjectPracticeClassifyTaskFamily = null;
let subjectPracticeBuildQuestionFingerprint = null;
let subjectPracticeBuildSchedulerHint = null;
let subjectPracticeMathDifficultyAudit = null;
let subjectPracticePhysicsDifficultyAudit = null;
let subjectPracticeEvaluateDiversityWindow = null;
let subjectPracticeDiversityFamilyWindowScope = null;
let subjectPracticeNearDuplicateSignal = null;
let subjectPracticeTaskFamilyDiversityBlock = null;
let subjectPracticeCurrentPolicyBlockReasons = null;
let SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION = null;
let QuestionReviewerProviderService = null;
let QuestionReviewerService = null;
let QuestionValidatorService = null;
try {
  require('../backend/node_modules/ts-node').register({
    transpileOnly: true,
    compilerOptions: {
      module: 'commonjs',
      moduleResolution: 'node'
    }
  });
  ({
    subjectPracticeClassifyTaskFamily,
    subjectPracticeBuildQuestionFingerprint,
    subjectPracticeBuildSchedulerHint,
    subjectPracticeMathDifficultyAudit,
    subjectPracticePhysicsDifficultyAudit,
    subjectPracticeEvaluateDiversityWindow,
    subjectPracticeDiversityFamilyWindowScope,
    subjectPracticeNearDuplicateSignal,
    subjectPracticeTaskFamilyDiversityBlock,
    subjectPracticeCurrentPolicyBlockReasons,
    SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION
  } = require('../backend/src/ai-questioning/subject-practice-task-family-policy'));
  ({ QuestionReviewerProviderService } = require('../backend/src/ai-questioning/question-reviewer-provider.service'));
  ({ QuestionReviewerService } = require('../backend/src/ai-questioning/question-reviewer.service'));
  ({ QuestionValidatorService } = require('../backend/src/ai-questioning/question-validator.service'));
} catch {
  subjectPracticeClassifyTaskFamily = null;
  subjectPracticeBuildQuestionFingerprint = null;
  subjectPracticeBuildSchedulerHint = null;
  subjectPracticeMathDifficultyAudit = null;
  subjectPracticePhysicsDifficultyAudit = null;
  subjectPracticeEvaluateDiversityWindow = null;
  subjectPracticeDiversityFamilyWindowScope = null;
  subjectPracticeNearDuplicateSignal = null;
  subjectPracticeTaskFamilyDiversityBlock = null;
  subjectPracticeCurrentPolicyBlockReasons = null;
  SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION = null;
  QuestionReviewerProviderService = null;
  QuestionReviewerService = null;
  QuestionValidatorService = null;
}

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

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const value = projectEnvValue('DATABASE_URL');
  if (value) process.env.DATABASE_URL = value;
}

function projectEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return '';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => new RegExp(`^${escaped}=`).test(item));
  return line ? line.replace(new RegExp(`^${escaped}=`), '').trim().replace(/^"|"$/g, '') : '';
}

function envPositiveMs(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function subjectPracticeStaleRunningMs() {
  return Math.max(
    3 * 60 * 1000,
    Math.min(
      10 * 60 * 1000,
      envPositiveMs('CSCA_AI_QUESTION_GENERATION_TIMEOUT_MS', 90_000) * 3
        + envPositiveMs('CSCA_AI_QUESTION_REVIEW_TIMEOUT_MS', 30_000) * 3
        + envPositiveMs('AI_GATEWAY_BACKGROUND_KEY_WAIT_TIMEOUT_MS', 120_000)
    )
  );
}

function subjectPracticeActiveJobLimit() {
  const value = Number(projectEnvValue('CSCA_SUBJECT_PRACTICE_ACTIVE_JOB_LIMIT') || projectEnvValue('AI_GATEWAY_BACKGROUND_CONCURRENCY') || 1);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.min(12, Math.round(value))) : 1;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function qualityAuditDisplayReason(value) {
  const reason = cleanText(value);
  if (reason === 'gate_decision_human_review') return 'gate_decision_needs_quality_attention';
  if (reason === 'reviewer_human_review') return 'reviewer_needs_quality_attention';
  if (reason === 'replacement_requires_human_review') return 'replacement_requires_quality_attention';
  if (reason === 'variant_requires_human_review') return 'variant_requires_quality_attention';
  return reason;
}

function qualityAuditDisplayGateDecision(value) {
  const decision = cleanText(value);
  if (decision === 'human_review') return 'quality_attention';
  return decision;
}

function recordFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayFrom(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueRowsById(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of arrayFrom(rows)) {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    unique.push(row);
  }
  return unique;
}

function questionPlanTargetCellIdsForSubject(subject) {
  const normalizedSubject = cleanText(subject).toLowerCase();
  if (normalizedSubject === 'math') {
    return ['352', '351', '350', '355', '354', '353', '361', '360', '359', '340', '339', '338', '349', '348', '347', '343', '342', '341', '358', '357', '356', '364', '363', '362', '367', '366', '365', '346', '345', '344'];
  }
  if (normalizedSubject === 'chemistry') {
    return ['41', '592', '593', '596', '607', '608', '610', '611'];
  }
  return [];
}

function disabledReviewerGateway() {
  return {
    hasConfiguredKey: () => false,
    complete: async () => {
      throw new Error('Disabled AI Gateway should not be called during deterministic audit replay.');
    }
  };
}

const QUESTION_PLAN_CALIBRATION_TERMS = {
  operations: ['\u52a0\u70ed', '\u91cf\u53d6', '\u79f0\u91cf', '\u7a00\u91ca', '\u8bfb\u53d6', '\u6ef4\u52a0', '\u8f6c\u5165', '\u51b7\u5374', '\u6405\u62cc', '\u9884\u70ed', '\u6d17\u6da4', '\u8fc7\u6ee4', '\u84b8\u998f', '\u8403\u53d6', '\u632f\u8361', '\u8865\u52a0', '\u5939\u6301', '\u5012\u5165', '\u6ce8\u5165'],
  observations: ['\u89c2\u5bdf', '\u73b0\u8c61', '\u98de\u6e85', '\u53d8\u8272', '\u6c89\u6dc0', '\u6c14\u6ce1', '\u70eb\u624b', '\u53d1\u70ed', '\u892a\u8272', '\u94f6\u955c', '\u653e\u51fa', '\u751f\u6210', '\u589e\u91cd'],
  hypotheses: ['\u539f\u56e0', '\u4e3b\u56e0', '\u8bf4\u660e', '\u5bf9\u6bd4', '\u6392\u9664', '\u5047\u8bbe', '\u63a2\u7a76', '\u7ade\u4e89', '\u63a7\u5236\u53d8\u91cf', '\u53cd\u8bc1'],
  directRules: ['\u6b63\u786e\u7684\u662f', '\u7b26\u5408\u89c4\u8303', '\u4e0d\u5bf9\u7740', '\u4e0d\u80fd', '\u5e94', '\u9519\u8bef', '\u5b89\u5168\u89c4\u8303'],
  reasoning: ['\u7531', '\u7ed3\u5408', '\u8bf4\u660e', '\u6392\u9664', '\u56e0\u6b64', '\u6545', '\u53ef\u5f97', '\u63a8\u5f97', '\u8bc1\u660e', '\u540c\u65f6\u6ee1\u8db3', '\u5bf9\u6bd4'],
  quantitativeChinese: ['\u76f8\u5bf9\u5206\u5b50\u8d28\u91cf', '\u8d28\u91cf\u5206\u6570', '\u71c3\u70e7', '\u500d'],
  reactionChinese: ['\u78b3\u9178\u6c22\u94a0', '\u6eb4', '\u94f6\u955c', '\u4e0e\u94a0', '\u916f\u5316', '\u6c34\u89e3', '\u9ad8\u9530\u9178\u94be', '\u892a\u8272'],
  gasControl: ['\u9664\u6742', '\u5e72\u71e5', '\u6536\u96c6', '\u9a8c\u6ee1', '\u68c0\u9a8c', '\u5c3e\u6c14', '\u6d17\u6c14', '\u6392\u7a7a\u6c14', '\u6392\u6c34', '\u9664\u53bb', '\u6d53\u786b\u9178', '\u78b1\u77f3\u7070', '\u77f3\u7070\u6c34', '\u6e7f\u6da6', '\u77f3\u854a'],
  redoxConcepts: ['\u6c27\u5316\u8fd8\u539f', '\u7535\u5b50\u8f6c\u79fb', '\u8f6c\u79fb\u7535\u5b50', '\u5316\u5408\u4ef7', '\u4ef7\u6001', '\u6c27\u5316\u5242', '\u8fd8\u539f\u5242', '\u88ab\u6c27\u5316', '\u88ab\u8fd8\u539f', '\u6c27\u5316\u4e3a', '\u8fd8\u539f\u4e3a', '\u914d\u5e73', '\u7cfb\u6570'],
  redoxQuantChain: ['\u7269\u8d28\u7684\u91cf', '\u8f6c\u79fb\u7535\u5b50', '\u7535\u5b50\u6570', '\u6469\u5c14', '\u6bd4\u4e3a', '\u4e4b\u6bd4', '\u5b8c\u5168\u53cd\u5e94', '\u6070\u597d', '\u8fc7\u91cf', '\u8017\u5c3d', '\u6d88\u8017', '\u751f\u6210', '\u6807\u51c6\u72b6\u51b5']
};

function countQuestionPlanTerms(text, terms) {
  return terms.reduce((sum, term) => sum + text.split(term).length - 1, 0);
}

function countQuestionPlanPattern(text, pattern) {
  return (text.match(pattern) || []).length;
}

function questionPlanCandidateFeatures(question) {
  const text = `${question.prompt || ''}\n${question.explanation || ''}\n${JSON.stringify(question.options || [])}`;
  return {
    operationWords: countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.operations),
    observationWords: countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.observations),
    quantitativeMarkers: countQuestionPlanPattern(text, /(\d+(?:\.\d+)?\s*(?:mL|mol|g|L|%)|CO2|H2O|NaHCO3|Br2|H2|O2)/gi)
      + countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.quantitativeChinese),
    reactionClues: countQuestionPlanPattern(text, /(NaHCO3|Br2|Na|KMnO4|CCl4|CO2|H2)/gi)
      + countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.reactionChinese),
    hypothesisMarkers: countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.hypotheses),
    directRuleMarkers: countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.directRules),
    reasoningConnectors: countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.reasoning),
    gasSpeciesMarkers: countQuestionPlanPattern(text, /(Cl2|Cl\u2082|NH3|NH\u2083|CO2|CO\u2082|O2|O\u2082|H2|H\u2082|SO2|SO\u2082|NO2|NO\u2082|NO|HCl)/gi),
    gasControlMarkers: countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.gasControl),
    redoxReactionMarkers: countQuestionPlanPattern(text, /(Fe|Cu|Pb|MnO2|MnO\u2082|Cl2|Cl\u2082|H2S|H\u2082S|SO2|SO\u2082|I2|I\u2082|Br2|Br\u2082|KMnO4|KMnO\u2084|KClO3|KClO\u2083|H2SO4|H\u2082SO\u2084|HCl|e[-\u2212])/gi),
    redoxConceptMarkers: countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.redoxConcepts),
    redoxQuantitativeChainMarkers: countQuestionPlanPattern(text, /(\d+(?:\.\d+)?\s*(?:mol|mmol|mL|L)|mol\s*[A-Za-z]|e[-\u2212]|n\s*\(|V\/n|\/n|\u2192|\u2191|>|<)/gi)
      + countQuestionPlanTerms(text, QUESTION_PLAN_CALIBRATION_TERMS.redoxQuantChain),
    phConceptMarkers: countQuestionPlanPattern(text, /(pH|pOH|H\+|OH[-\u2212]|氢离子|氢氧根|酸性|碱性|酸碱|浓度|稀释)/gi),
    phMeasurementErrorMarkers: countQuestionPlanPattern(text, /(pH试纸|容量瓶|移液管|量筒|滴定管|刻度线|定容|润湿|洗涤|仰视|俯视|偏高|偏低|误差|配制|测定|volumetric|pipette|burette|meniscus|measurement error)/gi)
  };
}

function questionPlanCalibrationTargetFor(question) {
  const cellId = cleanText(get(question.generationMetadata, 'productionCellId'));
  const topicTitle = cleanText(question.topicTitle).toLowerCase();
  const difficulty = cleanText(question.difficulty).toLowerCase();
  if (cellId === '41' || ((topicTitle.includes('ph') || topicTitle.includes('pH') || topicTitle.includes('酸碱') || topicTitle.includes('溶液浓度')) && difficulty === 'basic')) {
    return { seedCellId: '41', taskFamily: 'basic_ph_measurement_or_preparation_error_judgement', planTemplate: 'basic_ph_measurement_preparation_error_v1', productionTemplate: true, requiresExplicitAllowlist: true };
  }
  if (cellId === '592' || ((topicTitle.includes('lab') || topicTitle.includes('experiment') || topicTitle.includes('实验') || topicTitle.includes('仪器')) && difficulty === 'medium')) {
    return { seedCellId: '592', taskFamily: 'medium_lab_two_operation_evidence', planTemplate: 'two_linked_operations_causal_propagation_v1' };
  }
  if (cellId === '593' || ((topicTitle.includes('lab') || topicTitle.includes('experiment') || topicTitle.includes('实验') || topicTitle.includes('仪器')) && difficulty === 'hard')) {
    return { seedCellId: '593', taskFamily: 'hard_experimental_evidence_chain', planTemplate: 'competing_hypothesis_discrimination_v1' };
  }
  if (cellId === '596' || ((topicTitle.includes('organic') || topicTitle.includes('有机')) && difficulty === 'hard')) {
    return { seedCellId: '596', taskFamily: 'hard_organic_combustion_reaction_evidence_calculation', planTemplate: 'organic_formula_reaction_unique_structure_v1' };
  }
  if (cellId === '607' || ((topicTitle.includes('gas') || topicTitle.includes('气体')) && difficulty === 'hard')) {
    return { seedCellId: '607', taskFamily: 'hard_gas_impurity_elimination', planTemplate: 'gas_impurity_control_competing_elimination_v1', productionTemplate: true };
  }
  if (cellId === '608' || ((topicTitle.includes('gas') || topicTitle.includes('气体')) && difficulty === 'basic')) {
    return { seedCellId: '608', taskFamily: 'basic_gas_collection_test_rule', planTemplate: 'basic_gas_collection_test_calibration_v1', productionTemplate: false };
  }
  if (cellId === '610' || ((topicTitle.includes('redox') || topicTitle.includes('氧化还原')) && difficulty === 'hard')) {
    return { seedCellId: '610', taskFamily: 'hard_redox_electron_transfer_quantitative_chain', planTemplate: 'redox_electron_transfer_quantitative_chain_v1', productionTemplate: true };
  }
  if (cellId === '611' || ((topicTitle.includes('redox') || topicTitle.includes('氧化还原')) && difficulty === 'basic')) {
    return { seedCellId: '611', taskFamily: 'basic_redox_single_species_judgement', planTemplate: 'basic_redox_single_reaction_valence_rule_v1', productionTemplate: true };
  }
  return null;
}

function questionPlanCalibrationVerdict(target, features) {
  if (target?.seedCellId === '41') {
    return (features.phConceptMarkers >= 2 && features.phMeasurementErrorMarkers >= 2)
      ? 'candidate_matches_basic_ph_measurement_error_plan_shape'
      : 'needs_basic_ph_measurement_error_plan_calibration';
  }
  if (target?.seedCellId === '592') {
    return (features.operationWords >= 4 && features.reasoningConnectors >= 2 && features.hypothesisMarkers >= 1)
      ? 'maybe_two_operation_plan'
      : 'likely_single_rule_or_single_operation';
  }
  if (target?.seedCellId === '593') {
    return (features.observationWords >= 4 && features.hypothesisMarkers >= 2 && features.reasoningConnectors >= 3)
      ? 'maybe_competing_evidence_chain'
      : 'likely_insufficient_hard_evidence_chain';
  }
  if (target?.seedCellId === '596') {
    return (features.quantitativeMarkers >= 5 && features.reactionClues >= 3 && features.reasoningConnectors >= 4)
      ? 'maybe_hard_organic_plan'
      : 'likely_insufficient_independent_clues_or_quant_shape';
  }
  if (target?.seedCellId === '607') {
    return (features.gasSpeciesMarkers >= 2 && features.gasControlMarkers >= 3)
      ? 'maybe_hard_gas_impurity_control_plan'
      : 'likely_direct_gas_property_or_single_control_rule';
  }
  if (target?.seedCellId === '608') {
    return (features.gasSpeciesMarkers >= 1 && features.gasControlMarkers >= 1)
      ? 'candidate_matches_basic_gas_collection_or_test_rule'
      : 'needs_basic_gas_rule_calibration';
  }
  if (target?.seedCellId === '610') {
    if (features.redoxReactionMarkers >= 2 && features.redoxConceptMarkers >= 3 && features.quantitativeMarkers >= 1 && features.reasoningConnectors >= 2) {
      return 'maybe_hard_redox_electron_balance_plan';
    }
    if (features.redoxReactionMarkers >= 2 && features.quantitativeMarkers >= 3 && features.redoxQuantitativeChainMarkers >= 2 && features.reasoningConnectors >= 1) {
      return 'maybe_hard_redox_quant_chain_but_profile_mismatch';
    }
    return 'likely_direct_valence_judgement_missing_quant_chain';
  }
  if (target?.seedCellId === '611') {
    return (features.redoxReactionMarkers >= 1 && features.redoxConceptMarkers >= 2)
      ? 'candidate_matches_basic_redox_valence_rule'
      : 'needs_basic_redox_rule_calibration';
  }
  return 'unknown_cell';
}

function questionPlanCalibrationFor(candidates, subject, perCell = 10) {
  const normalizedSubject = cleanText(subject).toLowerCase();
  if (!['chemistry', 'math'].includes(normalizedSubject)) return null;
  const perCellCount = Math.max(1, Math.min(30, Number(perCell) || 10));
  const byCell = new Map();
  for (const candidate of candidates) {
    const cellId = cleanText(get(candidate.generationMetadata, 'productionCellId'));
    const target = normalizedSubject === 'math'
      ? mathQuestionPlanShadowTargetFor({
        ...candidate,
        family: promptFamily(candidate.prompt, candidate),
        parameterInferenceRisk: mathQuestionPlanShadowFeatures(candidate).parameterInferenceRisk
      })
      : questionPlanCalibrationTargetFor(candidate);
    if (!target) continue;
    if (!byCell.has(cellId)) byCell.set(cellId, []);
    if (byCell.get(cellId).length < perCellCount) byCell.get(cellId).push(candidate);
  }
  const samples = Array.from(byCell.entries()).flatMap(([cellId, rows]) => rows.map((candidate) => {
    const features = normalizedSubject === 'math'
      ? mathQuestionPlanShadowFeatures(candidate)
      : questionPlanCandidateFeatures(candidate);
    const target = normalizedSubject === 'math'
      ? mathQuestionPlanShadowTargetFor({
        ...candidate,
        family: promptFamily(candidate.prompt, candidate),
        parameterInferenceRisk: features.parameterInferenceRisk
      })
      : questionPlanCalibrationTargetFor(candidate);
    return {
      id: Number(candidate.id),
      cellId,
      seedCellId: target?.seedCellId ?? null,
      taskFamily: target?.taskFamily ?? null,
      planTemplate: target?.planTemplate ?? null,
      status: candidate.status,
      difficulty: candidate.difficulty,
      verdict: normalizedSubject === 'math'
        ? mathQuestionPlanShadowVerdict(target, features)
        : questionPlanCalibrationVerdict(target, features),
      features,
      gateReasons: arrayFrom(get(candidate.reviewMetadata, 'gate.reasons')).map(qualityAuditDisplayReason),
      profileReasons: arrayFrom(get(candidate.reviewMetadata, 'profileAlignment.reasons')),
      prompt: short(candidate.prompt, 180)
    };
  }));
  const summary = {};
  for (const sample of samples) {
    if (!summary[sample.cellId]) summary[sample.cellId] = { total: 0, verdicts: {}, gateReasons: {} };
    summary[sample.cellId].total += 1;
    summary[sample.cellId].verdicts[sample.verdict] = (summary[sample.cellId].verdicts[sample.verdict] || 0) + 1;
    for (const reason of sample.gateReasons) {
      summary[sample.cellId].gateReasons[reason] = (summary[sample.cellId].gateReasons[reason] || 0) + 1;
    }
  }
  return {
    mode: 'audit_only_question_plan_calibration',
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'excluded_from_plan_quality_calibration',
    targetCells: questionPlanTargetCellIdsForSubject(normalizedSubject),
    targetMatching: normalizedSubject === 'math'
      ? 'math_multi_topic_seed_cell_or_topic_difficulty'
      : 'topic_difficulty_with_seed_cell_fallback',
    sampleCount: samples.length,
    summary,
    samples
  };
}

function questionPlanRetryMemoryFor(candidates, subject) {
  const samples = arrayFrom(candidates).flatMap((candidate) => {
    if (cleanText(candidate.status) === 'approved') return [];
    const generation = recordFrom(candidate.generationMetadata);
    const adherence = recordFrom(generation.questionPlanAdherence);
    const failureRoute = recordFrom(generation.questionPlanFailureRoute);
    const attempt = recordFrom(generation.questionPlanAttempt);
    const budget = recordFrom(attempt.budget);
    const review = recordFrom(candidate.reviewMetadata);
    const autoRegenerate = recordFrom(review.subjectPracticeAutoRegenerate);
    if (cleanText(failureRoute.stage) === 'delivery') return [];
    const reasonCodes = Array.from(new Set([
      ...arrayFrom(adherence.failureCodes),
      ...arrayFrom(failureRoute.reasonCodes),
      cleanText(autoRegenerate.reasonCode)
    ].map((reason) => cleanText(reason).toLowerCase()).filter((reason) => /^(candidate_plan_|question_plan_)/.test(reason))));
    if (!reasonCodes.length) return [];
    const routeAction = cleanText(failureRoute.action);
    const repairKind = routeAction === 'repair_plan' ? 'plan' : routeAction === 'repair_candidate_rendering' ? 'candidate' : null;
    const repairUsed = repairKind === 'plan'
      ? Number(budget.planRepairCount) || 0
      : repairKind === 'candidate'
        ? Number(budget.candidateRepairCount) || 0
        : 0;
    const repairMaximum = repairKind === 'plan'
      ? Number(budget.maxPlanRepairs) || 0
      : repairKind === 'candidate'
        ? Number(budget.maxCandidateRepairs) || 0
        : 0;
    const repairBudgetKnown = repairKind == null || repairMaximum > 0;
    const repairBudgetStatus = repairKind == null
      ? 'not_applicable'
      : !repairBudgetKnown
        ? 'repair_budget_unknown_legacy'
      : repairUsed < repairMaximum
        ? 'repair_available'
        : 'repair_budget_exhausted';
    return [{
      id: Number(candidate.id),
      status: candidate.status,
      cellId: cleanText(get(candidate.generationMetadata, 'productionCellId')),
      topicTitle: candidate.topicTitle,
      difficulty: candidate.difficulty,
      routeStage: cleanText(failureRoute.stage) || null,
      routeAction: routeAction || null,
      attemptIndex: Number(attempt.attemptIndex) || null,
      repairKind,
      repairUsed,
      repairMaximum,
      repairBudgetKnown,
      repairBudgetStatus,
      autoRegenerateReasonCode: cleanText(autoRegenerate.reasonCode) || null,
      reasonCodes,
      prompt: short(candidate.prompt, 180)
    }];
  });
  const reasonCounts = samples.reduce((map, sample) => {
    for (const reason of sample.reasonCodes) map.set(reason, (map.get(reason) ?? 0) + 1);
    return map;
  }, new Map());
  return {
    mode: 'audit_only_question_plan_retry_memory',
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    subject: cleanText(subject).toLowerCase(),
    candidateCount: arrayFrom(candidates).length,
    contributorCount: samples.length,
    repairAvailableCount: samples.filter((sample) => sample.repairBudgetStatus === 'repair_available').length,
    repairBudgetExhaustedCount: samples.filter((sample) => sample.repairBudgetStatus === 'repair_budget_exhausted').length,
    repairBudgetUnknownLegacyCount: samples.filter((sample) => sample.repairBudgetStatus === 'repair_budget_unknown_legacy').length,
    repairBudgetPolicy: 'lineage_counts_are_carried_and_hard_capped_before_provider_job_enqueue',
    reasonCodes: topEntries(reasonCounts, 10).map(([reasonCode, count]) => ({ reasonCode, count })),
    samples: samples.slice(0, 12)
  };
}

function questionPlanApplicabilityFor(cells, subject) {
  const normalizedSubject = cleanText(subject).toLowerCase();
  const featureFlag = 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED';
  const cellAllowlistFlag = 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST';
  const featureFlagEnabled = cleanText(process.env[featureFlag]).toLowerCase() === 'true';
  const rawCellAllowlist = cleanText(process.env[cellAllowlistFlag]);
  const cellAllowlist = rawCellAllowlist.split(/[,;\s]+/).map(cleanText).filter(Boolean);
  const cellAllowlistConfigured = cellAllowlist.length > 0;
  const cellAllowedByFlag = (cellId, seedCellId) => {
    if (!cellAllowlistConfigured) return true;
    return cellAllowlist.includes('*') || cellAllowlist.includes(cleanText(cellId)) || cellAllowlist.includes(cleanText(seedCellId));
  };
  const cellRows = arrayFrom(cells).map((cell) => {
    const target = normalizedSubject === 'chemistry'
      ? questionPlanCalibrationTargetFor({
        topicTitle: cell.topicTitle,
        difficulty: cell.difficulty,
        generationMetadata: { productionCellId: cell.id }
      })
      : null;
    const productionTemplate = Boolean(target && target.productionTemplate !== false);
    const requiresExplicitAllowlist = Boolean(target?.requiresExplicitAllowlist);
    const cellAllowed = !productionTemplate || (!requiresExplicitAllowlist || cellAllowlistConfigured) && cellAllowedByFlag(cell.id, target?.seedCellId);
    const effectivePlanRequired = productionTemplate && featureFlagEnabled && cellAllowed;
    return {
      cellId: cleanText(cell.id),
      topicTitle: cell.topicTitle,
      difficulty: cell.difficulty,
      applicable: productionTemplate,
      seedCellId: target?.seedCellId ?? null,
      taskFamily: target?.taskFamily ?? null,
      planTemplate: target?.planTemplate ?? null,
      calibrationOnly: Boolean(target && !productionTemplate),
      requiresExplicitAllowlist,
      cellAllowed,
      gateModeWithCurrentFlag: productionTemplate
        ? (featureFlagEnabled
          ? cellAllowed
            ? 'plan_required_when_enabled'
            : 'disabled_shadow_cell_not_enabled'
          : 'disabled_shadow')
        : 'not_applicable_generation_allowed',
      productionImpactWithCurrentFlag: effectivePlanRequired
        ? 'fail_closed_when_enabled'
        : 'none_audit_only'
    };
  });
  const applicableCells = cellRows.filter((cell) => cell.applicable);
  return {
    mode: 'audit_only_question_plan_applicability',
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    providerFailurePolicy: 'not_recorded_no_provider_call',
    featureFlag,
    featureFlagEnabled,
    cellAllowlistFlag,
    cellAllowlistConfigured,
    cellAllowlist,
    subjectBoundary: normalizedSubject === 'chemistry'
      ? 'chemistry_mvp_templates_only'
      : 'subject_isolated_not_applicable_in_phase_1',
    targetMatching: 'topic_difficulty_with_seed_cell_fallback',
    cellCount: cellRows.length,
    applicableCount: applicableCells.length,
    enabledApplicableCount: applicableCells.filter((cell) => cell.cellAllowed && featureFlagEnabled).length,
    applicableCells: applicableCells.map((cell) => ({
      cellId: cell.cellId,
      topicTitle: cell.topicTitle,
      difficulty: cell.difficulty,
      seedCellId: cell.seedCellId,
      taskFamily: cell.taskFamily,
      planTemplate: cell.planTemplate,
      requiresExplicitAllowlist: cell.requiresExplicitAllowlist,
      cellAllowed: cell.cellAllowed,
      gateModeWithCurrentFlag: cell.gateModeWithCurrentFlag,
      productionImpactWithCurrentFlag: cell.productionImpactWithCurrentFlag
    })),
    cells: cellRows
  };
}

function incrementCount(target, key) {
  const cleanKey = cleanText(key) || 'unknown';
  target[cleanKey] = (target[cleanKey] || 0) + 1;
}

function questionPlanExecutionFor(candidates, subject) {
  if (cleanText(subject).toLowerCase() !== 'chemistry') return null;
  const sampleLimit = 12;
  const samples = [];
  const attemptStatusCounts = {};
  const routeStageCounts = {};
  const routeActionCounts = {};
  const cellCounts = {};
  let observedCount = 0;
  let adheresCount = 0;
  let needsRepairCount = 0;
  let deliveryRouteCount = 0;
  let deterministicPlanRepairCount = 0;
  let deterministicPlanRepairAttemptCount = 0;
  for (const candidate of candidates.slice(0, 200)) {
    const generationMetadata = recordFrom(candidate.generationMetadata);
    const attempt = recordFrom(generationMetadata.questionPlanAttempt);
    const adherence = recordFrom(generationMetadata.questionPlanAdherence);
    const route = recordFrom(generationMetadata.questionPlanFailureRoute);
    const plan = recordFrom(generationMetadata.questionPlan);
    const planRepair = recordFrom(generationMetadata.questionPlanRepair);
    if (!Object.keys(attempt).length && !Object.keys(adherence).length && !Object.keys(route).length && !Object.keys(plan).length) continue;
    observedCount += 1;
    const cellId = cleanText(generationMetadata.productionCellId);
    const attemptStatus = cleanText(attempt.status) || 'attempt_missing';
    const routeStage = cleanText(route.stage) || 'route_missing';
    const routeAction = cleanText(route.action) || 'action_missing';
    const adheres = adherence.adheres === true;
    if (adheres) adheresCount += 1;
    if (routeStage === 'candidate_plan_adherence') needsRepairCount += 1;
    if (routeStage === 'delivery') deliveryRouteCount += 1;
    if (cleanText(planRepair.status) === 'repaired') {
      deterministicPlanRepairCount += 1;
      deterministicPlanRepairAttemptCount += Number(get(planRepair, 'budget.used')) || 0;
    }
    incrementCount(attemptStatusCounts, attemptStatus);
    incrementCount(routeStageCounts, routeStage);
    incrementCount(routeActionCounts, routeAction);
    incrementCount(cellCounts, cellId || 'unknown_cell');
    if (samples.length < sampleLimit) {
      samples.push({
        id: Number(candidate.id),
        cellId,
        status: candidate.status,
        difficulty: candidate.difficulty,
        attemptStatus,
        adheres,
        routeStage,
        routeAction,
        taskFamily: cleanText(attempt.taskFamily || plan.taskFamily) || null,
        planTemplate: cleanText(attempt.planTemplate || plan.planTemplate) || null,
        planRepairStatus: cleanText(planRepair.status) || null,
        planRepairAttemptsUsed: Number(get(planRepair, 'budget.used')) || 0,
        failureCodes: arrayFrom(adherence.failureCodes).concat(arrayFrom(route.reasonCodes)).slice(0, 8),
        gateReasons: arrayFrom(get(candidate.reviewMetadata, 'gate.reasons')).map(qualityAuditDisplayReason).slice(0, 8),
        prompt: short(candidate.prompt, 180)
      });
    }
  }
  if (!observedCount) return null;
  return {
    mode: 'audit_only_question_plan_execution',
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'delivery_failures_excluded_from_plan_quality_memory',
    studentConsumableScope: 'current_production_candidates_only_not_student_visible',
    candidateCount: candidates.length,
    observedCount,
    sampleCount: samples.length,
    sampleLimit,
    adheresCount,
    needsRepairCount,
    deliveryRouteCount,
    deterministicPlanRepairCount,
    deterministicPlanRepairAttemptCount,
    attemptStatusCounts,
    routeStageCounts,
    routeActionCounts,
    cellCounts,
    samples
  };
}

function mathQuestionPlanShadowTargetFor(row) {
  const cellId = cleanText(get(row.generationMetadata, 'productionCellId'));
  const topicTitle = cleanText(row.topicTitle).toLowerCase();
  const difficulty = cleanText(row.difficulty).toLowerCase();
  const family = cleanText(row.family || row.taskFamily || promptFamily(row.prompt, row));
  const parameterInferenceRisk = row.parameterInferenceRisk === true;
  const functionTopic = /函数|function|logarithm|exponential|对数|指数/.test(topicTitle);
  const elementaryTopic = /基本初等函数|初等函数|elementary function/.test(topicTitle);
  const derivativeTopic = /导数|微积分|derivative|calculus/.test(topicTitle);
  if (['352', '351'].includes(cellId) || (!elementaryTopic && /函数|function/.test(topicTitle) && ['basic', 'hard'].includes(difficulty))) {
    return {
      seedCellId: difficulty === 'hard' ? '351' : '352',
      taskFamily: difficulty === 'hard' ? 'hard_function_multi_condition_property' : 'basic_function_direct_property',
      planTemplate: 'math_function_property_by_difficulty_v1',
      targetDifficulty: difficulty || null
    };
  }
  if (['355', '354', '353'].includes(cellId) || elementaryTopic) {
    return {
      seedCellId: difficulty === 'basic' ? '355' : difficulty === 'hard' ? '354' : '353',
      taskFamily: difficulty === 'hard' ? 'hard_elementary_function_parameter_or_inequality' : difficulty === 'basic' ? 'elementary_function_direct_property' : 'elementary_function_exp_log_ordering',
      planTemplate: 'math_elementary_function_relation_v1',
      targetDifficulty: difficulty || null
    };
  }
  if (
    cellId === '350'
    || (!derivativeTopic && functionTopic && difficulty === 'medium' && [
      'function_monotonicity_parity_statement',
      'elementary_function_exp_log_ordering',
      'logarithmic_equation_domain_solution',
      'quadratic_function_properties',
      'function_quadratic_parameter_property'
    ].includes(family))
  ) {
    if (parameterInferenceRisk || family === 'function_quadratic_parameter_property') {
      return {
        seedCellId: '350',
        taskFamily: 'function_quadratic_parameter_property',
        planTemplate: 'math_medium_function_parameter_constraint_v1'
      };
    }
    if (['elementary_function_exp_log_ordering', 'logarithmic_equation_domain_solution'].includes(family)) {
      return {
        seedCellId: '350',
        taskFamily: 'elementary_function_exp_log_ordering',
        planTemplate: 'math_medium_exp_log_ordering_chain_v1'
      };
    }
    return {
      seedCellId: '350',
      taskFamily: family || 'medium_function_property_combination',
      planTemplate: 'math_medium_function_two_move_reasoning_v1'
    };
  }
  if (/概率|排列组合|正态分布|probability|combinatorics|normal distribution/.test(topicTitle) || ['probability_multi_event_counting', 'normal_distribution_z_score_probability'].includes(family)) {
    const normalDistributionTarget = /正态分布|normal distribution|standard normal|z[-_ ]?score/.test(topicTitle)
      || family === 'normal_distribution_z_score_probability';
    return {
      seedCellId: normalDistributionTarget
        ? difficulty === 'basic' ? '367' : difficulty === 'hard' ? '366' : '365'
        : difficulty === 'basic' ? '361' : difficulty === 'hard' ? '360' : '359',
      taskFamily: normalDistributionTarget ? 'normal_distribution_z_score_probability' : 'probability_multi_event_counting',
      planTemplate: 'math_probability_counting_relation_v1',
      targetDifficulty: difficulty || null
    };
  }
  if (/向量|复数|vector|complex/.test(topicTitle) || ['vector_coordinate_norm_dot_angle', 'complex_mod_vector_dot_product', 'complex_conjugate_linear_equation_solve'].includes(family)) {
    return {
      seedCellId: difficulty === 'basic' ? '340' : difficulty === 'hard' ? '339' : '338',
      taskFamily: 'vector_coordinate_norm_dot_angle',
      planTemplate: 'math_vector_complex_relation_v1',
      targetDifficulty: difficulty || null
    };
  }
  if (derivativeTopic || ['derivative_direct_evaluation', 'derivative_tangent_constraint'].includes(family)) {
    return {
      seedCellId: difficulty === 'basic' ? '349' : difficulty === 'hard' ? '348' : '347',
      taskFamily: difficulty === 'basic' ? 'derivative_direct_evaluation' : 'derivative_tangent_constraint',
      planTemplate: 'math_derivative_condition_chain_v1',
      targetDifficulty: difficulty || null
    };
  }
  if (/平面解析几何|解析几何|圆锥曲线|直线|圆|analytic geometry|conic|circle|line/.test(topicTitle) || ['circle_line_chord_length', 'conic_shared_focus_relation'].includes(family)) {
    return {
      seedCellId: difficulty === 'basic' ? '343' : difficulty === 'hard' ? '342' : '341',
      taskFamily: 'circle_line_chord_length',
      planTemplate: 'math_analytic_geometry_relation_v1',
      targetDifficulty: difficulty || null
    };
  }
  if (['358', '357', '356'].includes(cellId) || /数列|sequence|等差|等比|递推/.test(topicTitle) || ['arithmetic_sequence_two_condition_solve_a1_d', 'geometric_sequence_two_condition_solve_q'].includes(family)) {
    return {
      seedCellId: difficulty === 'basic' ? '358' : difficulty === 'hard' ? '357' : '356',
      taskFamily: difficulty === 'hard' ? 'hard_sequence_multi_constraint_reasoning' : 'arithmetic_sequence_two_condition_solve_a1_d',
      planTemplate: 'math_sequence_condition_relation_v1',
      targetDifficulty: difficulty || null
    };
  }
  if (['364', '363', '362'].includes(cellId) || /数据|统计|数字特征|平均数|方差|statistics|data|mean|variance/.test(topicTitle) || ['combined_variance', 'mean_removed_value', 'direct_variance_formula'].includes(family)) {
    return {
      seedCellId: difficulty === 'basic' ? '364' : difficulty === 'hard' ? '363' : '362',
      taskFamily: difficulty === 'hard' ? 'hard_statistics_multi_step_inference' : difficulty === 'basic' ? 'direct_variance_formula' : 'combined_variance',
      planTemplate: 'math_statistics_relation_v1',
      targetDifficulty: difficulty || null
    };
  }
  if (['346', '345', '344'].includes(cellId) || /空间几何|立体几何|空间|spatial geometry|solid geometry/.test(topicTitle) || ['spatial_coordinate_direct_metric', 'coordinate_geometry_point_to_plane_distance', 'spatial_line_plane_concept_judgement', 'spatial_vector_angle_cosine'].includes(family)) {
    return {
      seedCellId: difficulty === 'basic' ? '346' : difficulty === 'hard' ? '345' : '344',
      taskFamily: difficulty === 'hard' ? 'hard_spatial_multi_constraint_vector_reasoning' : difficulty === 'basic' ? 'spatial_coordinate_direct_metric' : 'medium_geometry_coordinate_vector_reasoning',
      planTemplate: 'math_spatial_geometry_relation_v1',
      targetDifficulty: difficulty || null
    };
  }
  return null;
}

function mathQuestionPlanShadowFeatures(question) {
  const text = `${question.prompt || ''}\n${question.explanation || ''}\n${JSON.stringify(question.options || [])}`;
  const promptOnly = cleanText(question.prompt || '');
  const promptAndExplanation = `${question.prompt || ''}\n${question.explanation || ''}`;
  const lower = text.toLowerCase();
  const propertySignals = [
    /定义域|domain/.test(lower),
    /(根式|根号|分母|不为\s*0|不能为\s*0|不等于\s*0|√|sqrt|radical|denominator)/i.test(text),
    /值域|range/.test(lower),
    /单调|递增|递减|monotonic|increasing|decreasing/.test(lower),
    /奇偶|奇函数|偶函数|对称|symmetry|parity|odd function|even function/.test(lower),
    /周期|period/.test(lower),
    /最大值|最小值|极值|maximum|minimum|extremum/.test(lower)
  ].filter(Boolean).length;
  const statementMarkers = countQuestionPlanPattern(text, /[①②③④⑤⑥]|\b[1-6][\).、]/g);
  const transformationSignals = [
    /代入|定义|比较|排除|结合|合并|分组|加权|标准化|转化|列式|联立|因此|故|可得|because|therefore|combine|standardize|transform|compare|exclude/.test(lower),
    /f\(-?x\)|f\s*\(\s*-x\s*\)|奇函数|偶函数|对称/.test(lower),
    /导数|配方|判别式|图像|区间|derivative|complete square|discriminant|graph|interval/.test(lower)
  ].filter(Boolean).length;
  const orderingSignals = countQuestionPlanPattern(text, /(比较|大小|排序|由小到大|由大到小|>|<|log_|sqrt|√|\^|指数|对数|幂)/gi);
  const probabilitySignals = countQuestionPlanPattern(text, /(概率|事件|样本空间|抽取|取法|排列|组合|恰好|至少|至多|互斥|独立|条件|正态分布|标准正态|p\s*\(|probability|event|sample space|combination|permutation|conditional|independent|normal distribution|standardize|z-score)/gi);
  const probabilityEventLabelCount = countQuestionPlanPattern(promptAndExplanation, /事件\s*[ABCD]|事件[一二三四]|event\s*[ABCD]|p\s*\(\s*[ABCD]|(?:^|[；;。:：\s])(?:[ABCD])\s*[:：]/gi);
  const probabilityNormalHardInteractionCueCount = countQuestionPlanPattern(promptAndExplanation, /(双尾|单尾|尾概率|分位数|反标准化|标准化|对称性|标准正态分布函数|Φ\s*\(|z\s*=|均值\s*[μmu]|标准差\s*[σsigma]|求.{0,12}(?:均值|标准差|μ|σ)|低于.{0,24}占.{0,80}高于.{0,24}占|高于.{0,24}占.{0,80}低于.{0,24}占|two[- ]?tail|one[- ]?tail|tail probability|quantile|inverse standardi[sz]ation|standardi[sz]ation|symmetry|standard normal|z[-_ ]?score|mean.{0,20}standard deviation|standard deviation.{0,20}mean)/gi);
  const probabilityHardInteractionCueCount = countQuestionPlanPattern(promptAndExplanation, /(分类|分情况|情况[一二三四]|按.{0,12}分类|补事件|补集|条件概率|给定|交集|并集|互斥|独立|限制|不放回.{0,20}(?:顺序|依次|先|后)|case split|complement|conditional|given|intersection|union|mutually exclusive|independent|restriction)/gi)
    + probabilityNormalHardInteractionCueCount;
  const probabilitySingleResultRisk = probabilitySignals > 0
    && probabilityEventLabelCount < 2
    && probabilityHardInteractionCueCount < 1
    && /(概率是多少|概率为多少|求.{0,8}概率|what is.{0,20}probability|probability.{0,20}of)/i.test(promptAndExplanation);
  const probabilityEventListOnlyRisk = probabilitySignals > 0
    && probabilityEventLabelCount >= 3
    && probabilityHardInteractionCueCount < 1
    && !/(分别计数|分别统计|联立|交集|并集|条件概率|补事件|分类|分情况|calculate p|compute p|case split|intersection|conditional|complement)/i.test(promptAndExplanation);
  const probabilityConcreteFrameSignals = countQuestionPlanPattern(promptAndExplanation, /([0-9０-９]\s*个|[0-9０-９]\s*张|[0-9０-９]\s*次|[0-9０-９]\s*名|袋中|盒中|球|骰子|硬币|扑克牌|编号|随机抽取|无放回|有放回|掷|取出|从.{0,20}中|共有|总数|样本空间为|N\s*\(|normal\s*\(|z\s*=|Φ\s*\()/gi);
  const probabilityNormalMediumNoEventRisk = /(正态分布|标准正态|N\s*\(|normal distribution|standard normal|Φ\s*\()/i.test(promptAndExplanation)
    && /(说法|判断|正确|下列|which statement|correct)/i.test(promptAndExplanation)
    && !/(P\s*\(|概率|大于|小于|高于|低于|超过|不超过|介于|之间|落在|至少|至多|z\s*=|分位数|tail|above|below|greater than|less than|between|probability|quantile)/i.test(promptOnly);
  const probabilityNormalReferenceTableRisk = /(正态分布|标准正态|normal distribution|standard normal)/i.test(promptAndExplanation)
    && /(参考|函数值|table|lookup)/i.test(promptAndExplanation)
    && countQuestionPlanPattern(promptAndExplanation, /Φ\s*\([^)）]{1,18}[)）]\s*=/gi) >= 3;
  const probabilityConceptOnlyRisk = probabilitySignals > 0
    && ((probabilityConcreteFrameSignals < 1 && /(关于|说法|概念|要求|条件|特征|which statement|concept|definition)/i.test(promptAndExplanation))
      || /(适合|适用).{0,12}(?:古典概型|概率)|(?:古典概型|概率).{0,12}(?:适合|适用)|直接计算概率/i.test(promptAndExplanation));
  const derivativeSignals = countQuestionPlanPattern(text, /(导数|微积分|切线|斜率|单调|极值|最值|参数|区间|f'\s*\(|derivative|calculus|tangent|slope|monotonic|extremum|parameter|interval)/gi);
  const vectorComplexSignals = countQuestionPlanPattern(text, /(向量|复数|坐标|数量积|点积|夹角|模长|共轭|实部|虚部|平行|垂直|投影|轨迹|vector|complex|coordinate|dot product|angle|modulus|conjugate|real part|imaginary part|parallel|perpendicular|projection|locus)/gi);
  const vectorComplexBasicDefinitionOnlyRisk = vectorComplexSignals > 0
    && /(定义|概念|以下结论|结论正确|关于.{0,16}(?:复数相等|向量).{0,16}(?:定义|结论)|若复数\s*a\+bi\s*=\s*c\+di|definition|concept|which statement)/i.test(promptAndExplanation)
    && !/[0-9０-９]/.test(promptOnly)
    && !/(求|计算|模长|数量积|点积|夹角|共轭|实部|虚部|平行|垂直|坐标为|z\s*=|find|compute|modulus|dot product|conjugate|real part|imaginary part|parallel|perpendicular)/i.test(promptOnly);
  const geometrySignals = countQuestionPlanPattern(text, /(直线|圆|圆锥曲线|椭圆|抛物线|双曲线|斜率|距离|中点|切线|弦|交点|方程|参数|对称|line|circle|conic|ellipse|parabola|hyperbola|slope|distance|midpoint|tangent|chord|intersection|equation|parameter|symmetry)/gi);
  const analyticGeometryDefinitionOnlyRisk = geometrySignals > 0
    && /(下列方程|哪个方程|表示.{0,16}(?:椭圆|抛物线|双曲线|圆)|焦点.{0,12}[xy]\s*轴|which equation|represents? an? (?:ellipse|parabola|hyperbola|circle))/i.test(promptOnly)
    && !/(已知|求|计算|距离|斜率|中点|切线|弦|交点|联立|参数|对称|find|compute|distance|slope|midpoint|tangent|chord|intersection|parameter|symmetry)/i.test(promptOnly);
  const analyticGeometryBasicGeneralCircleRisk = geometrySignals > 0
    && /(圆的一般方程|x[²^]\s*\+?\s*y[²^]|x\^2\s*\+\s*y\^2|general equation of (?:a )?circle)/i.test(promptAndExplanation)
    && /(圆心|半径|center|radius)/i.test(promptAndExplanation)
    && /(配方|complete square|completing square|x[²^].{0,40}[+-]\s*\d+\s*x.{0,40}y[²^].{0,40}[+-]\s*\d+\s*y)/i.test(promptAndExplanation);
  const elementaryFunctionSignals = countQuestionPlanPattern(text, /(初等函数|指数|对数|幂函数|根式|定义域|值域|单调|图像|交点|不等式|elementary function|exponential|logarithm|power function|radical|domain|range|monotonic|graph|intersection|inequality)/gi);
  const sequenceSignals = countQuestionPlanPattern(text, /(数列|等差|等比|通项|递推|前\s*n\s*项和|公差|公比|单调|求和|sequence|arithmetic sequence|geometric sequence|recurrence|common difference|common ratio|partial sum)/gi);
  const statisticsSignals = countQuestionPlanPattern(text, /(平均数|中位数|众数|方差|标准差|极差|频数|频率|样本|数据|加权|mean|median|mode|variance|standard deviation|range|frequency|sample|data|weighted)/gi);
  const spatialSignals = countQuestionPlanPattern(text, /(空间|立体|平面|线面|面面|长方体|棱锥|棱柱|法向量|二面角|体积|投影|垂直|平行|夹角|space|spatial|solid geometry|plane|line-plane|normal vector|dihedral|volume|projection|perpendicular|parallel|angle)/gi);
  const hasExplicitParameterWord = /(参数|parameter)/i.test(promptAndExplanation);
  const hasParameterVariable = /(a\s*[,，、]\s*b\s*(?:[∈∊]\s*r|为实数|是实数|in\s*r)|a\s*[∈∊]\s*r|b\s*[∈∊]\s*r)/i.test(promptAndExplanation);
  const hasParameterSolving = /(求出\s*[ab]|求\s*[ab]|[ab]\s*=|判别式|顶点|vertex|discriminant)/i.test(promptAndExplanation);
  const parameterInferenceRisk = hasExplicitParameterWord || (hasParameterVariable && hasParameterSolving);
  const enumeratedConditionCount = countQuestionPlanPattern(promptAndExplanation, /[①②③④⑤⑥⑦⑧⑨]|\b[1-9]\s*[.)、]/g);
  const functionPropertyStackCount = countQuestionPlanPattern(promptAndExplanation, /(定义域|值域|单调|递增|递减|奇函数|偶函数|奇偶|对称|有界|最值|极值|domain|range|monotonic|increasing|decreasing|parity|odd function|even function|symmetric|bounded|extremum)/gi);
  const functionObjectSignals = countQuestionPlanPattern(promptAndExplanation, /(设函数|已知函数|函数\s*[fgh]\s*\(|[fgh]\s*\(\s*x\s*\)\s*=|[fgh]\s*\(x\)\s*=|y\s*=|log[_\d]*|ln|sqrt|√|x\^|x²|x\^2|二次函数|指数函数|对数函数|幂函数|区间\s*[\[（(]|interval)/gi);
  const functionBasicMultiConstraintDomainRisk = /(定义域|domain)/i.test(promptAndExplanation)
    && /(√|sqrt|根式|根号|radical)/i.test(promptAndExplanation)
    && /(1\s*\/|分母|denominator|不能为\s*0|不为\s*0|≠\s*0|!=\s*0)/i.test(promptAndExplanation);
  const pureFunctionExternalContextRisk = (propertySignals > 0 || orderingSignals > 0 || elementaryFunctionSignals > 0)
    && /(实验|传感器|响应值|输入信号|信号处理|建模|模型输出|建模拟合|拟合|测量|描点法|小组用|sensor|experiment|measurement|signal[- ]?processing|model[- ]?fitting|input signal|model output)/i.test(promptAndExplanation);
  const hardFunctionGenericConceptRisk = /(关于.{0,12}函数性质|函数性质.{0,12}命题|函数性质.{0,12}说法|which statement|which proposition)/i.test(promptOnly)
    && countQuestionPlanPattern(promptOnly, /(设函数|已知函数|函数\s*[fgh]\s*\(|[fgh]\s*\(\s*x\s*\)\s*=|[fgh]\s*\(x\)\s*=|y\s*=|log[_\d]*|ln|sqrt|√|x\^|x²|x\^2|二次函数|指数函数|对数函数|幂函数|区间\s*[\[（(]|interval)/gi) < 1;
  const sequenceGenericClassificationRisk = /(下列.{0,12}数列|通项公式.{0,16}(?:表示|是).{0,8}(?:等差|等比)数列|哪个.{0,8}(?:是|表示).{0,8}(?:等差|等比)数列|which sequence|which formula)/i.test(promptOnly)
    && !/(已知|设|a_?\s*\d+|a_\{?\s*n\s*\}?|S_?\s*\d+|S_\{?\s*n\s*\}?|公差\s*[d=]|公比\s*[q=]|求|计算|find|compute)/i.test(promptOnly);
  const elementaryFunctionGenericClassificationRisk = elementaryFunctionSignals > 0
    && /(下列函数中|哪个函数|哪一个函数|which function)/i.test(promptOnly)
    && /(奇函数|偶函数|增函数|减函数|单调|定义域|值域|odd function|even function|increasing|decreasing|monotonic|domain|range)/i.test(promptOnly)
    && !/(已知|设|f\s*\(\s*x\s*\)\s*=|f\(x\)\s*=|y\s*=|求|计算|比较|交点|不等式|given|find|compute|compare|intersection|inequality)/i.test(promptOnly);
  const statisticsBasicMultiStatisticComparisonRisk = statisticsSignals >= 4
    && /(两个|两组|甲班|乙班|甲组|乙组|A组|B组|class\s*[AB]|group\s*[AB])/i.test(promptAndExplanation)
    && /(?:均值|平均数|mean).{0,120}(?:方差|标准差|variance|standard deviation)|(?:方差|标准差|variance|standard deviation).{0,120}(?:均值|平均数|mean)/i.test(promptAndExplanation)
    && /(判断|说法|正确|下列|which statement|correct)/i.test(promptAndExplanation);
  const hardConditionStack = enumeratedConditionCount >= 4
    && /(满足|条件|若|已知[^。？]*满足|given[^.?!]*(?:satisfies|conditions?))/i.test(promptAndExplanation);
  const heavyPropertyStack = functionPropertyStackCount >= 8
    && /(分段|任意|所有|恒成立|参数|讨论|分类讨论|piecewise|for all|parameter|case)/i.test(promptAndExplanation);
  const mediumFunctionPropertyOverComplex = hardConditionStack
    || heavyPropertyStack
    || /(分段|piecewise|当\s*x\s*[<>≤≥=]|x\s*[<>≤≥]\s*0.{0,80}x\s*[<>≤≥]\s*0)/i.test(promptAndExplanation)
    || /(任意|所有|恒成立|对任意|for all|any real|all real)/i.test(promptAndExplanation);
  const derivativeBasicDomainTrapRisk = /(无定义|不存在|不可导|定义域|间断|undefined|does not exist|domain|discontinu)/i.test(promptAndExplanation)
    || /1\s*\/\s*\(\s*x\s*[-−]\s*[0-9]+\s*\).{0,80}x\s*=\s*[0-9]+/i.test(promptAndExplanation);
  const derivativeBasicOverComplexRisk = /导数|微积分|切线|斜率|单调|极值|最值|参数|区间|f'\s*\(|derivative|calculus|tangent|slope|monotonic|extremum|parameter|interval/i.test(text)
    && (mediumFunctionPropertyOverComplex
      || parameterInferenceRisk
      || enumeratedConditionCount >= 2
      || /(左右导数|连续性|可导性|连续.*可导|可导.*连续|left[- ]?hand|right[- ]?hand|continuity|differentiability)/i.test(promptAndExplanation));
  const derivativeMediumDefinitionOnlyRisk = derivativeSignals > 0
    && /(导数的定义|几何意义|可导|以下结论|必然成立|definition of derivative|geometric meaning|differentiable|must be true)/i.test(promptAndExplanation)
    && !/(已知函数|设函数|f\s*\(\s*x\s*\)\s*=|f\(x\)\s*=|求|计算|切线方程|斜率为|单调区间|极值|最值|参数|区间\s*[\[（(]|given function|find|compute|tangent line|slope is|monotonic interval|extremum|parameter)/i.test(promptOnly);
  const derivativeHardCoefficientSolveOnlyRisk = derivativeSignals > 0
    && /(求\s*[a-z](?:\s*[,，]\s*[a-z]){1,3}\s*的值|求出\s*[a-z](?:\s*[,，]\s*[a-z]){1,3}|solve for\s*[a-z](?:\s*,\s*[a-z]){1,3})/i.test(promptAndExplanation)
    && /(经过点|切线斜率|斜率分别|passes through|tangent slopes?)/i.test(promptAndExplanation)
    && !/(单调|递增|递减|极值|最值|恒成立|取值范围|参数范围|不等式|区间.{0,20}(?:成立|单调|递增|递减)|sign chart|monotonic|extremum|range of|for all|inequality)/i.test(promptAndExplanation);
  const vectorComplexCoordinateGeometryDriftRisk = /(点\s*[A-ZＰＱP-Q]|直线\s*[a-zl]|点到直线|过\s*[A-Z].{0,8}[A-Z]|投影点|projection point|point-to-line|line through)/i.test(promptAndExplanation)
    && (/(距离|斜率|交点|垂足|直线方程|distance|slope|intersection|foot of perpendicular|line equation)/i.test(promptAndExplanation)
      || /(方向向量|点\s*[A-ZＰＱP-Q].{0,24}在\s*(?:直线\s*)?[a-zl]|p\s*q\s*[·.]\s*d\s*=\s*0|projection|direction vector)/i.test(promptAndExplanation));
  const vectorComplexHardDirectMetricRisk = /(向量|复数|坐标|数量积|点积|夹角|模长|共轭|实部|虚部|平行|垂直|vector|complex|coordinate|dot product|angle|modulus|conjugate|real part|imaginary part|parallel|perpendicular|\|[^|\n]{0,40}\|)/i.test(text)
    && /(等于多少|求|计算|find|compute|equals?)/i.test(promptAndExplanation)
    && /(数量积|点积|模长|模|长度|dot product|modulus|norm|length|\|[^|\n]{0,40}\|)/i.test(promptAndExplanation)
    && !/(轨迹|交点|参数|取值范围|辐角|幅角|平行|垂直|argument|locus|intersection|parameter|range of|parallel|perpendicular)/i.test(promptAndExplanation);
  const analyticGeometryHardConicRelationOnlyRisk = geometrySignals > 0
    && /(相同的焦点|共享焦点|离心率|∠|夹角|same foc(?:us|i)|eccentricit)/i.test(promptAndExplanation)
    && /(e_?1|e1|e_?2|e2|离心率)/i.test(promptAndExplanation)
    && !/(参数|取值范围|范围|切线|弦长|面积|最值|最大|最小|定点|轨迹|parameter|range|max|min|tangent|chord|area|locus)/i.test(promptAndExplanation);
  const statisticsHardDirectCombinedVarianceRisk = statisticsSignals > 0
    && /(甲组|乙组|两个|两组|class\s*[AB]|group\s*[AB])/i.test(promptAndExplanation)
    && /(合并后.{0,12}方差|合并.{0,20}方差|combined variance|pooled variance)/i.test(promptAndExplanation)
    && !/(缺失|未知|调整|删除|新增|加入|移除|最大|最小|取值范围|使得|至少|至多|missing|unknown|adjust|remove|add|range|min|max|at least|at most)/i.test(promptAndExplanation);
  const statisticsMediumPureLinearTransformRisk = statisticsSignals > 0
    && /(线性变换|每个数据|每个数|y[_ᵢi]?\s*=|y_i\s*=|yᵢ\s*=|linear transform|each data)/i.test(promptAndExplanation)
    && /(?:均值|平均数|mean).{0,120}(?:方差|标准差|variance|standard deviation)|(?:方差|标准差|variance|standard deviation).{0,120}(?:均值|平均数|mean)/i.test(promptAndExplanation)
    && !/(缺失|未知|调整|删除|新增|加入|移除|替换|比较|两组|两个|甲组|乙组|取值范围|参数|使得|missing|unknown|adjust|remove|add|replace|compare|two groups|parameter|range)/i.test(promptAndExplanation);
  const spatialHardConceptOnlyRisk = spatialSignals > 0
    && (/(下列关于空间几何位置关系|关于.{0,24}空间.{0,24}位置关系|说法正确|命题中|position relations?)/i.test(promptAndExplanation)
      || /(对称关系|对称变换|symmetry relation|symmetric transformation)/i.test(promptAndExplanation))
    && !/(距离|夹角|体积|法向量|数量积|点积|二面角|投影|参数|求|计算|distance|angle|volume|normal vector|dot product|dihedral|projection|parameter|find|compute)/i.test(promptAndExplanation);
  const spatialMediumMultiPropositionOvercomplexRisk = spatialSignals > 0
    && /(四面体|长方体|棱锥|棱柱|顶点坐标分别|tetrahedron|cuboid|pyramid|prism|vertices)/i.test(promptAndExplanation)
    && /(四个命题|命题中|下列关于|说法正确|which statement)/i.test(promptAndExplanation)
    && !/(距离|夹角|体积|法向量|数量积|点积|二面角|投影|参数|求|计算|distance|angle|volume|normal vector|dot product|dihedral|projection|parameter|find|compute)/i.test(promptOnly);
  return {
    propertySignals,
    statementMarkers,
    transformationSignals,
    orderingSignals,
    probabilitySignals,
    probabilityEventLabelCount,
    probabilityNormalHardInteractionCueCount,
    probabilityHardInteractionCueCount,
    probabilityConcreteFrameSignals,
    probabilityNormalMediumNoEventRisk,
    probabilityNormalReferenceTableRisk,
    probabilityConceptOnlyRisk,
    probabilitySingleResultRisk,
    probabilityEventListOnlyRisk,
    derivativeSignals,
    vectorComplexSignals,
    vectorComplexBasicDefinitionOnlyRisk,
    geometrySignals,
    analyticGeometryDefinitionOnlyRisk,
    analyticGeometryBasicGeneralCircleRisk,
    elementaryFunctionSignals,
    elementaryFunctionGenericClassificationRisk,
    sequenceSignals,
    sequenceGenericClassificationRisk,
    statisticsSignals,
    statisticsBasicMultiStatisticComparisonRisk,
    spatialSignals,
    vectorComplexCoordinateGeometryDriftRisk,
    vectorComplexHardDirectMetricRisk,
    derivativeBasicDomainTrapRisk,
    derivativeBasicOverComplexRisk,
    derivativeMediumDefinitionOnlyRisk,
    derivativeHardCoefficientSolveOnlyRisk,
    parameterInferenceRisk,
    optionJudgement: /(下列|判断|正确|错误|选项|（\s*）|\(\s*\)|which|statement)/i.test(text),
    enumeratedConditionCount,
    functionPropertyStackCount,
    functionObjectSignals,
    functionBasicMultiConstraintDomainRisk,
    pureFunctionExternalContextRisk,
    hardFunctionGenericConceptRisk,
    mediumFunctionPropertyOverComplex,
    analyticGeometryHardConicRelationOnlyRisk,
    statisticsHardDirectCombinedVarianceRisk,
    statisticsMediumPureLinearTransformRisk,
    spatialHardConceptOnlyRisk,
    spatialMediumMultiPropositionOvercomplexRisk
  };
}

function mathQuestionPlanShadowVerdict(target, features) {
  const difficulty = cleanText(target?.targetDifficulty);
  if (target?.seedCellId === '350' && features.pureFunctionExternalContextRisk) {
    return 'needs_pure_function_external_context_repair';
  }
  if (target?.planTemplate === 'math_medium_function_parameter_constraint_v1' && features.parameterInferenceRisk) {
    return 'candidate_matches_parameter_constraint_plan_shape';
  }
  if (target?.planTemplate === 'math_medium_function_two_move_reasoning_v1') {
    if (features.mediumFunctionPropertyOverComplex) return 'needs_medium_function_complexity_calibration';
    return features.propertySignals >= 3 && (features.statementMarkers >= 1 || features.transformationSignals >= 1) && features.optionJudgement
      ? 'candidate_matches_function_property_plan_shape'
      : 'needs_plan_evidence_slot_calibration';
  }
  if (target?.planTemplate === 'math_medium_exp_log_ordering_chain_v1') {
    return features.orderingSignals >= 3 && features.transformationSignals >= 1
      ? 'candidate_matches_exp_log_ordering_plan_shape'
      : 'needs_plan_evidence_slot_calibration';
  }
  if (target?.planTemplate === 'math_probability_counting_relation_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 5 : 4;
    const effectiveProbabilitySignals = features.probabilitySignals + Math.min(features.probabilityNormalHardInteractionCueCount || 0, 3);
    if (difficulty === 'basic' && features.probabilityConceptOnlyRisk) return 'needs_basic_probability_concept_only_repair';
    if (difficulty === 'medium' && features.probabilitySingleResultRisk) return 'needs_probability_single_result_repair';
    if (difficulty === 'medium' && features.probabilityNormalMediumNoEventRisk) return 'needs_medium_normal_probability_no_event_repair';
    if (difficulty === 'hard' && features.probabilityEventListOnlyRisk) return 'needs_hard_probability_event_list_repair';
    if (difficulty === 'hard' && features.probabilityNormalReferenceTableRisk) return 'needs_hard_normal_reference_table_repair';
    if (difficulty === 'hard' && features.probabilityHardInteractionCueCount < 1) return 'needs_hard_probability_interaction_repair';
    return effectiveProbabilitySignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1 || features.probabilityNormalHardInteractionCueCount >= 2)
      ? 'candidate_matches_probability_counting_plan_shape'
      : 'needs_probability_event_relation_calibration';
  }
  if (target?.planTemplate === 'math_vector_complex_relation_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
    if (difficulty === 'basic' && features.vectorComplexBasicDefinitionOnlyRisk) return 'needs_basic_vector_complex_definition_only_repair';
    if (difficulty === 'medium' && features.vectorComplexCoordinateGeometryDriftRisk) return 'needs_vector_complex_coordinate_geometry_drift_repair';
    if (difficulty === 'hard' && features.vectorComplexHardDirectMetricRisk) return 'needs_hard_vector_complex_direct_metric_repair';
    return features.vectorComplexSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
      ? 'candidate_matches_vector_complex_relation_plan_shape'
      : 'needs_vector_complex_relation_calibration';
  }
  if (target?.planTemplate === 'math_derivative_condition_chain_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
    if (difficulty === 'basic' && features.derivativeBasicOverComplexRisk) return 'needs_basic_derivative_complexity_repair';
    if (difficulty === 'basic' && features.derivativeBasicDomainTrapRisk) return 'needs_basic_derivative_domain_trap_repair';
    if (difficulty === 'medium' && features.derivativeMediumDefinitionOnlyRisk) return 'needs_medium_derivative_definition_only_repair';
    if (difficulty === 'hard' && features.derivativeHardCoefficientSolveOnlyRisk) return 'needs_hard_derivative_coefficient_solve_only_repair';
    return features.derivativeSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
      ? 'candidate_matches_derivative_condition_plan_shape'
      : 'needs_derivative_condition_calibration';
  }
  if (target?.planTemplate === 'math_analytic_geometry_relation_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
    if (difficulty === 'basic' && features.analyticGeometryBasicGeneralCircleRisk) return 'needs_basic_analytic_geometry_general_circle_repair';
    if (difficulty !== 'basic' && features.analyticGeometryDefinitionOnlyRisk) return 'needs_medium_analytic_geometry_definition_only_repair';
    if (difficulty === 'hard' && features.analyticGeometryHardConicRelationOnlyRisk) return 'needs_hard_analytic_geometry_conic_relation_only_repair';
    return features.geometrySignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
      ? 'candidate_matches_analytic_geometry_relation_plan_shape'
      : 'needs_analytic_geometry_relation_calibration';
  }
  if (target?.planTemplate === 'math_function_property_by_difficulty_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : 4;
    if (difficulty === 'basic' && features.functionBasicMultiConstraintDomainRisk) return 'needs_basic_function_multi_constraint_domain_repair';
    if (difficulty === 'hard' && features.hardFunctionGenericConceptRisk) return 'needs_hard_function_generic_concept_repair';
    return features.propertySignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
      ? 'candidate_matches_function_property_by_difficulty_plan_shape'
      : 'needs_function_property_by_difficulty_calibration';
  }
  if (target?.planTemplate === 'math_elementary_function_relation_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
    if (difficulty === 'medium' && features.elementaryFunctionGenericClassificationRisk) return 'needs_medium_elementary_function_generic_classification_repair';
    return features.elementaryFunctionSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
      ? 'candidate_matches_elementary_function_relation_plan_shape'
      : 'needs_elementary_function_relation_calibration';
  }
  if (target?.planTemplate === 'math_sequence_condition_relation_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
    if (difficulty === 'basic' && features.sequenceGenericClassificationRisk) return 'needs_basic_sequence_generic_classification_repair';
    return features.sequenceSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
      ? 'candidate_matches_sequence_condition_relation_plan_shape'
      : 'needs_sequence_condition_relation_calibration';
  }
  if (target?.planTemplate === 'math_statistics_relation_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
    if (difficulty === 'basic' && features.statisticsBasicMultiStatisticComparisonRisk) return 'needs_basic_statistics_multi_statistic_comparison_repair';
    if (difficulty === 'medium' && features.statisticsMediumPureLinearTransformRisk) return 'needs_medium_statistics_pure_linear_transform_repair';
    if (difficulty === 'hard' && features.statisticsHardDirectCombinedVarianceRisk) return 'needs_hard_statistics_direct_combined_variance_repair';
    return features.statisticsSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
      ? 'candidate_matches_statistics_relation_plan_shape'
      : 'needs_statistics_relation_calibration';
  }
  if (target?.planTemplate === 'math_spatial_geometry_relation_v1') {
    const minimumSignals = difficulty === 'basic' ? 2 : difficulty === 'hard' ? 4 : 3;
    if (difficulty === 'medium' && features.spatialMediumMultiPropositionOvercomplexRisk) return 'needs_medium_spatial_multi_proposition_overcomplex_repair';
    if (difficulty === 'hard' && features.spatialHardConceptOnlyRisk) return 'needs_hard_spatial_concept_only_repair';
    return features.spatialSignals >= minimumSignals && (difficulty === 'basic' || features.transformationSignals >= 1)
      ? 'candidate_matches_spatial_geometry_relation_plan_shape'
      : 'needs_spatial_geometry_relation_calibration';
  }
  return 'unknown_math_cell';
}

function mathQuestionPlanShadowFor(cells, candidates, subject) {
  if (cleanText(subject).toLowerCase() !== 'math') return null;
  const applicableCells = arrayFrom(cells).map((cell) => {
    const target = mathQuestionPlanShadowTargetFor({
      topicTitle: cell.topicTitle,
      difficulty: cell.difficulty,
      generationMetadata: { productionCellId: cell.id },
      prompt: cell.topicTitle,
      family: ''
    });
    return target ? {
      cellId: cleanText(cell.id),
      topicTitle: cell.topicTitle,
      difficulty: cell.difficulty,
      seedCellId: target.seedCellId,
      taskFamily: target.taskFamily,
      planTemplate: target.planTemplate
    } : null;
  }).filter(Boolean);
  const samples = candidates.slice(0, 120).flatMap((candidate) => {
    const family = promptFamily(candidate.prompt, candidate);
    const features = mathQuestionPlanShadowFeatures(candidate);
    const target = mathQuestionPlanShadowTargetFor({ ...candidate, family, parameterInferenceRisk: features.parameterInferenceRisk });
    if (!target) return [];
    const verdict = mathQuestionPlanShadowVerdict(target, features);
    return [{
      id: Number(candidate.id),
      status: candidate.status,
      cellId: cleanText(get(candidate.generationMetadata, 'productionCellId')),
      topicTitle: candidate.topicTitle,
      difficulty: candidate.difficulty,
      family,
      seedCellId: target.seedCellId,
      taskFamily: target.taskFamily,
      planTemplate: target.planTemplate,
      verdict,
      features,
      gateDecision: qualityAuditDisplayGateDecision(get(candidate.reviewMetadata, 'gate.decision')) || null,
      gateReasons: arrayFrom(get(candidate.reviewMetadata, 'gate.reasons')).map(qualityAuditDisplayReason),
      prompt: short(candidate.prompt, 180)
    }];
  });
  const verdictCounts = samples.reduce((map, sample) => {
    map.set(sample.verdict, (map.get(sample.verdict) ?? 0) + 1);
    return map;
  }, new Map());
  return {
    mode: 'audit_only_math_question_plan_shadow',
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    providerFailurePolicy: 'not_recorded_no_provider_call',
    subjectBoundary: 'math_guarded_allowlist_available_default_off',
    gateApplicability: 'guarded_allowlist_available_subjectPracticeQuestionPlanGateFor',
    featureFlag: 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED',
    cellAllowlistFlag: 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST',
    featureFlagEnabled: false,
    targetMatching: 'math_multi_topic_seed_cell_or_topic_difficulty',
    applicableCellCount: applicableCells.length,
    applicableCells,
    sampleCount: samples.length,
    verdictCounts: topEntries(verdictCounts, 8).map(([verdict, count]) => ({ verdict, count })),
    samples: samples.slice(0, 12)
  };
}

function assertQuestionPlanExecutionSelfTest(condition, message) {
  if (!condition) throw new Error(`question-plan execution self-test failed: ${message}`);
}

function assertMathQuestionPlanShadowSelfTest(condition, message) {
  if (!condition) throw new Error(`math question-plan shadow self-test failed: ${message}`);
}

function physicsQuestionPlanShadowTargetFor(row) {
  const cellId = cleanText(get(row.generationMetadata, 'productionCellId'));
  const topicTitle = cleanText(row.topicTitle).toLowerCase();
  const difficulty = cleanText(row.difficulty).toLowerCase();
  const family = cleanText(row.family || row.taskFamily || promptFamily(row.prompt, row));
  const targetByFamily = (taskFamily) => ({
    seedCellId: cellId || 'physics-shadow',
    taskFamily,
    planTemplate: taskFamily === 'kinematics_basic_direct_relation'
      ? 'physics_kinematics_basic_relation_v1'
      : taskFamily === 'kinematics_motion_graph_interpretation'
      ? 'physics_motion_graph_evidence_slots_shadow_v1'
      : /^circuit_/.test(taskFamily)
        ? 'physics_circuit_topology_constraints_shadow_v1'
        : /energy|momentum|collision|impulse/.test(taskFamily)
          ? 'physics_conservation_chain_shadow_v1'
          : 'physics_representation_constraint_shadow_v1'
  });
  if (family === 'kinematics_motion_graph_interpretation' && difficulty === 'basic') {
    return targetByFamily('kinematics_basic_direct_relation');
  }
  if ([
    'kinematics_motion_graph_interpretation',
    'circuit_ohm_kirchhoff_resistor_network',
    'circuit_power_internal_resistance',
    'work_energy_conservation',
    'work_energy_nonconservative_loss',
    'momentum_impulse_conservation',
    'momentum_collision_1d_2d'
  ].includes(family)) return targetByFamily(family);
  if (/运动图像|motion graph|v[-\s]?t|s[-\s]?t|x[-\s]?t/.test(topicTitle)) return targetByFamily('kinematics_motion_graph_interpretation');
  if (/运动学|kinematics/.test(topicTitle) && difficulty === 'basic') return targetByFamily('kinematics_basic_direct_relation');
  if (/电路|circuit|电阻|欧姆|基尔霍夫/.test(topicTitle)) return targetByFamily('circuit_ohm_kirchhoff_resistor_network');
  if (/能量|动量|碰撞|冲量|energy|momentum|collision|impulse/.test(topicTitle) && ['medium', 'hard'].includes(difficulty)) {
    return targetByFamily(/动量|碰撞|冲量|momentum|collision|impulse/.test(topicTitle)
      ? 'momentum_impulse_conservation'
      : 'work_energy_conservation');
  }
  return null;
}

function physicsQuestionPlanShadowFeatures(question) {
  const text = `${question.prompt || ''}\n${question.explanation || ''}\n${JSON.stringify(question.options || [])}`;
  const lower = text.toLowerCase();
  return {
    kinematicsSignals: countQuestionPlanPattern(text, /(运动学|位移|路程|位置|速度|速率|加速度|匀速|匀变速|斜率|端点|kinematics|displacement|distance|position|velocity|speed|acceleration|uniform motion|slope|endpoint)/gi),
    graphSignals: countQuestionPlanPattern(text, /(?:^|[^A-Za-z])(?:v|s|x|a)[-\s]?t(?![A-Za-z])|运动图像|图像|斜率|面积|交点|graph|slope|area|intersection/gi),
    circuitSignals: countQuestionPlanPattern(text, /(电路|电阻|串联|并联|欧姆|基尔霍夫|电流|电压|等效电阻|circuit|resistor|series|parallel|ohm|kirchhoff|current|voltage)/gi),
    conservationSignals: countQuestionPlanPattern(text, /(机械能|能量守恒|动能定理|摩擦|损失|动量|冲量|碰撞|反冲|energy conservation|work[-\s]?energy|friction|momentum|impulse|collision|recoil)/gi),
    representationSignals: countQuestionPlanPattern(text, /(如图|图像|电路图|示意图|v[-\s]?t|s[-\s]?t|x[-\s]?t|graph|diagram|circuit diagram)/gi),
    multiStepSignals: countQuestionPlanPattern(text, /(由|因此|故|再|先|结合|联立|代入|可得|because|therefore|then|combine|substitute|derive)/gi),
    unitSignals: countQuestionPlanPattern(text, /(?:\d+(?:\.\d+)?\s*(?:m\/s(?:\^2|²)?|s|m|kg|n|j|w|v|a|ω|ohm|Ω))(?![A-Za-z])|(?:^|[^A-Za-z])(?:m\/s(?:\^2|²)?|kg|N|J|V|A|Ω)(?![A-Za-z])/gi),
    equationSignals: countQuestionPlanPattern(text, /(=|>|<|Δ|mv|1\/2|v\^2|i\s*=|u\s*=|r\s*=|p\s*=|e\s*=)/gi)
  };
}

function physicsQuestionPlanShadowFor(cells, candidates, subject) {
  if (cleanText(subject).toLowerCase() !== 'physics') return null;
  const applicableCells = arrayFrom(cells).map((cell) => {
    const target = physicsQuestionPlanShadowTargetFor({
      topicTitle: cell.topicTitle,
      difficulty: cell.difficulty,
      generationMetadata: { productionCellId: cell.id },
      prompt: cell.topicTitle,
      family: ''
    });
    return target ? {
      cellId: cleanText(cell.id),
      topicTitle: cell.topicTitle,
      difficulty: cell.difficulty,
      seedCellId: target.seedCellId,
      taskFamily: target.taskFamily,
      planTemplate: target.planTemplate
    } : null;
  }).filter(Boolean);
  const samples = candidates.slice(0, 120).flatMap((candidate) => {
    const family = promptFamily(candidate.prompt, candidate);
    const target = physicsQuestionPlanShadowTargetFor({ ...candidate, family });
    if (!target) return [];
    const features = physicsQuestionPlanShadowFeatures(candidate);
    const verdict = target.planTemplate === 'physics_kinematics_basic_relation_v1'
      ? features.kinematicsSignals >= 2 && (features.unitSignals >= 1 || features.graphSignals >= 1)
        ? 'candidate_matches_basic_kinematics_relation_plan_shape'
        : 'requires_basic_kinematics_relation_plan'
      : target.planTemplate === 'physics_motion_graph_evidence_slots_shadow_v1'
      ? features.graphSignals >= 2 && features.multiStepSignals >= 1
        ? 'candidate_matches_motion_graph_plan_shape'
        : 'requires_motion_graph_representation_plan'
      : target.planTemplate === 'physics_circuit_topology_constraints_shadow_v1'
        ? features.circuitSignals >= 3 && features.unitSignals >= 2
          ? 'candidate_matches_circuit_constraint_plan_shape'
          : 'requires_circuit_topology_constraint_plan'
        : target.planTemplate === 'physics_conservation_chain_shadow_v1'
          ? features.conservationSignals >= 2 && features.multiStepSignals >= 1 && features.unitSignals >= 2
            ? 'candidate_matches_conservation_chain_plan_shape'
            : 'requires_conservation_chain_plan'
          : 'needs_physics_plan_family_calibration';
    return [{
      id: Number(candidate.id),
      status: candidate.status,
      cellId: cleanText(get(candidate.generationMetadata, 'productionCellId')),
      topicTitle: candidate.topicTitle,
      difficulty: candidate.difficulty,
      family,
      seedCellId: target.seedCellId,
      taskFamily: target.taskFamily,
      planTemplate: target.planTemplate,
      verdict,
      features,
      gateDecision: qualityAuditDisplayGateDecision(get(candidate.reviewMetadata, 'gate.decision')) || null,
      gateReasons: arrayFrom(get(candidate.reviewMetadata, 'gate.reasons')).map(qualityAuditDisplayReason),
      prompt: short(candidate.prompt, 180)
    }];
  });
  const verdictCounts = samples.reduce((map, sample) => {
    map.set(sample.verdict, (map.get(sample.verdict) ?? 0) + 1);
    return map;
  }, new Map());
  return {
    mode: 'audit_only_physics_question_plan_shadow',
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    providerFailurePolicy: 'not_recorded_no_provider_call',
    subjectBoundary: 'physics_basic_kinematics_guarded_allowlist_available_other_families_shadow',
    gateApplicability: 'basic_kinematics_guarded_allowlist_available_subjectPracticeQuestionPlanGateFor_other_families_shadow',
    featureFlag: 'CSCA_SUBJECT_PRACTICE_QUESTION_PLAN_ENABLED',
    featureFlagEnabled: false,
    targetMatching: 'physics_basic_kinematics_motion_graph_circuit_conservation_topic_or_family',
    applicableCellCount: applicableCells.length,
    applicableCells,
    sampleCount: samples.length,
    verdictCounts: topEntries(verdictCounts, 8).map(([verdict, count]) => ({ verdict, count })),
    samples: samples.slice(0, 12)
  };
}

function assertPhysicsQuestionPlanShadowSelfTest(condition, message) {
  if (!condition) throw new Error(`physics question-plan shadow self-test failed: ${message}`);
}

function runMathQuestionPlanShadowSelfTest() {
  const cells = [
    { id: '350', topicTitle: '函数的概念与性质', difficulty: 'medium' },
    { id: '359', topicTitle: '古典概型与概率计算', difficulty: 'medium' },
    { id: '338', topicTitle: '向量与复数', difficulty: 'medium' },
    { id: '347', topicTitle: '导数与微积分初步', difficulty: 'medium' },
    { id: '341', topicTitle: '平面解析几何', difficulty: 'medium' }
  ];
  const candidates = [
    {
      id: 16233,
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '已知函数 f(x)=x/(x^2+1)，给出如下四个判断：① 定义域为 R；② 图象关于原点对称；③ 在 [0,1] 上单调递增；④ 值域为 [-1/2,1/2]。下列选项正确的是（ ）',
      correctAnswer: 'C',
      explanation: '定义域为 R，且 f(-x)=-f(x)，所以为奇函数。由 f(x)=x/(x^2+1) 可用导数判断在 [0,1] 上递增；值域可由 y=x/(x^2+1) 转化为 yx^2-x+y=0 并由判别式得到 -1/2<=y<=1/2。',
      generationMetadata: { productionCellId: '350' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_difficulty_evidence_mismatch'] } }
    },
    {
      id: 16211,
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '某探究小组记录三个函数 f(x)=log_2 x, g(x)=2^x, h(x)=x^{1/2}（即√x）在指定点的取值：a=f(3), b=g(0.6), c=h(2.5)。现要比较 a,b,c 的大小，下列判断正确的是（ ）',
      correctAnswer: 'B',
      explanation: '需要分别估计对数、指数与根式的大小，再比较 a,b,c 的顺序。',
      generationMetadata: { productionCellId: '350' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_difficulty_evidence_mismatch'] } }
    },
    {
      id: 16338,
      status: 'approved',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '为比较指数、对数与幂函数值的大小，设 a=log_2 3，b=2^(1/2)，c=log_3 4；且 2^(3/2)=2√2<3，3^(4/3)=3∛3>4，4/3<√2。下列排序正确的是？',
      correctAnswer: 'A',
      explanation: '由 2^(3/2)<3 得 log_2 3>3/2；由 3^(4/3)>4 得 log_3 4<4/3。又 4/3<√2<3/2，所以 a>3/2>√2>4/3>c，即 a>b>c。',
      generationMetadata: { productionCellId: '350' },
      reviewMetadata: { gate: { decision: 'publishable', reasons: [] } }
    },
    {
      id: 15527,
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '设 g(x)=x^2-ax+b，f(x)=log_2 g(x)，其中 a,b∈R。已知 f 满足：①定义域为 R；②值域为 [0,+∞)；③图象关于直线 x=1 对称；④g(x) 的最小值为 m。下列判断正确的是（ ）',
      correctAnswer: 'A',
      explanation: '由 g(x)=(x-a/2)^2+b-a^2/4 的顶点与判别式条件求 a,b,m，再判断 f 的单调性与最值。',
      generationMetadata: { productionCellId: '350' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_difficulty_evidence_mismatch'] } }
    },
    {
      id: 15938,
      status: 'pending_review',
      difficulty: 'medium',
      topicTitle: '函数的概念与性质',
      prompt: '比较 a=log_3 5，b=3^0.8，c=sqrt(7) 的大小。下列判断正确的是（ ）',
      correctAnswer: 'D',
      explanation: '结合对数、指数和根式的估算区间，逐步比较三者大小。',
      generationMetadata: { productionCellId: '350' },
      reviewMetadata: { gate: { decision: 'human_review', reasons: ['reviewer_human_review'] } }
    },
    {
      id: 17001,
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '古典概型与概率计算',
      prompt: '从含 3 个红球、2 个白球的袋中不放回抽取 2 个，设事件 A 为恰好一个红球，事件 B 为至少一个白球。下列概率关系正确的是（ ）',
      correctAnswer: 'A',
      explanation: '先确定样本空间，再分别计数事件 A、B 及交集，由条件和互斥关系比较概率。',
      generationMetadata: { productionCellId: '359' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_difficulty_evidence_mismatch'] } }
    },
    {
      id: 17002,
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '向量与复数',
      prompt: '已知向量 a=(1,2), b=(t,-1)，且 a 与 b 垂直。求参数 t 后判断 |a+b| 的取值正确的是（ ）',
      correctAnswer: 'B',
      explanation: '由数量积为 0 得参数 t，再代入坐标计算向量 a+b 的模长，因此排除错误选项。',
      generationMetadata: { productionCellId: '338' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_difficulty_evidence_mismatch'] } }
    },
    {
      id: 17003,
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '导数与微积分初步',
      prompt: '已知 f(x)=x^3-3x+a，若曲线在 x=1 处切线斜率为 0，并要求 f(x) 在区间 [-1,1] 的单调性判断正确。下列选项正确的是（ ）',
      correctAnswer: 'A',
      explanation: '先求导数 f\'(x)，用切线斜率条件确定关系，再结合导数符号判断区间单调性。',
      generationMetadata: { productionCellId: '347' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_difficulty_evidence_mismatch'] } }
    },
    {
      id: 17004,
      status: 'review_failed',
      difficulty: 'medium',
      topicTitle: '平面解析几何',
      prompt: '已知直线 l: y=kx+1 与圆 x^2+y^2=5 相交成弦 AB，若圆心到直线的距离为 1，判断弦长 AB 的取值正确的是（ ）',
      correctAnswer: 'A',
      explanation: '由直线方程求圆心到直线距离，再结合半径与弦心距关系计算弦长，因此只有一个选项满足。',
      generationMetadata: { productionCellId: '341' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_difficulty_evidence_mismatch'] } }
    }
  ];

  const summary = mathQuestionPlanShadowFor(cells, candidates, 'math');
  assertMathQuestionPlanShadowSelfTest(summary, 'summary should be emitted for math #350 fixtures');
  assertMathQuestionPlanShadowSelfTest(summary.mode === 'audit_only_math_question_plan_shadow', 'mode must remain audit-only');
  assertMathQuestionPlanShadowSelfTest(summary.productionImpact === 'none_audit_only', 'production impact must remain none');
  assertMathQuestionPlanShadowSelfTest(summary.providerImpact === 'none_no_provider_call', 'provider impact must remain none');
  assertMathQuestionPlanShadowSelfTest(summary.gateApplicability === 'guarded_allowlist_available_subjectPracticeQuestionPlanGateFor', 'shadow must show guarded production gate availability');
  assertMathQuestionPlanShadowSelfTest(summary.applicableCellCount === 5, 'math shadow must cover function, probability, vector/complex, derivative, and analytic-geometry cells');
  const verdictCounts = new Map(summary.verdictCounts.map((entry) => [entry.verdict, entry.count]));
  assertMathQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_function_property_plan_shape') === 1, 'function-property fixture should match exactly once');
  assertMathQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_exp_log_ordering_plan_shape') === 3, 'exp/log ordering fixtures should match three times');
  assertMathQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_parameter_constraint_plan_shape') === 1, 'parameter inference fixture should match exactly once');
  assertMathQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_probability_counting_plan_shape') === 1, 'probability fixture should match exactly once');
  assertMathQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_vector_complex_relation_plan_shape') === 1, 'vector/complex fixture should match exactly once');
  assertMathQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_derivative_condition_plan_shape') === 1, 'derivative fixture should match exactly once');
  assertMathQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_analytic_geometry_relation_plan_shape') === 1, 'analytic geometry fixture should match exactly once');
  const functionSample = summary.samples.find((sample) => sample.id === 16233);
  assertMathQuestionPlanShadowSelfTest(functionSample?.verdict === 'candidate_matches_function_property_plan_shape', '#16233 must remain a function-property fixture');
  assertMathQuestionPlanShadowSelfTest(functionSample?.features?.parameterInferenceRisk === false, '#16233 discriminant-in-range evidence must not be treated as parameter inference');
  const proPublishableSample = summary.samples.find((sample) => sample.id === 16338);
  assertMathQuestionPlanShadowSelfTest(proPublishableSample?.verdict === 'candidate_matches_exp_log_ordering_plan_shape', '#16338 must remain an exp/log ordering fixture');
  assertMathQuestionPlanShadowSelfTest(proPublishableSample?.gateDecision === 'publishable', '#16338 must remain a publishable positive fixture');
  const qualityAttentionSample = summary.samples.find((sample) => sample.id === 15938);
  assertMathQuestionPlanShadowSelfTest(qualityAttentionSample?.gateDecision === 'quality_attention', 'legacy human_review gate decision should display as quality_attention');
  assertMathQuestionPlanShadowSelfTest(qualityAttentionSample?.gateReasons?.includes('reviewer_needs_quality_attention'), 'legacy reviewer_human_review reason should display as quality attention');
  assertMathQuestionPlanShadowSelfTest(mathQuestionPlanShadowFor(cells, candidates, 'chemistry') === null, 'math shadow must not emit for chemistry');

  return {
    mode: 'math_question_plan_shadow_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    verdictCounts: summary.verdictCounts,
    sampleCount: summary.sampleCount
  };
}

function runPhysicsQuestionPlanShadowSelfTest() {
  const cells = [
    { id: '700', topicTitle: '运动学', difficulty: 'basic' },
    { id: '701', topicTitle: '运动图像与匀变速直线运动', difficulty: 'medium' },
    { id: '702', topicTitle: '电路与欧姆定律', difficulty: 'medium' },
    { id: '703', topicTitle: '机械能守恒与动量', difficulty: 'hard' }
  ];
  const candidates = [
    {
      id: 17000,
      status: 'pending_review',
      subject: 'physics',
      difficulty: 'basic',
      topicTitle: '运动学',
      prompt: '某物体的 s-t 图像是一条直线，0 s 时位置为 2 m，4 s 时位置为 10 m。下列关于该物体速度的判断正确的是？',
      explanation: '由位置变化量与时间间隔之比，或直接由 s-t 图像斜率，可得物体做匀速直线运动且速度为 2 m/s。',
      generationMetadata: { productionCellId: '700' },
      reviewMetadata: { gate: { decision: 'publishable', reasons: [] } }
    },
    {
      id: 17001,
      status: 'pending_review',
      subject: 'physics',
      difficulty: 'medium',
      topicTitle: '运动图像与匀变速直线运动',
      prompt: '某物体的 v-t 图像由两段直线组成。0-2 s 内速度由 0 增至 4 m/s，2-4 s 内保持 4 m/s。下列关于位移和加速度的判断正确的是？',
      explanation: '先由 v-t 图像斜率判断加速度，再由图线与时间轴围成面积求位移，因此需要图像斜率和面积两步证据。',
      generationMetadata: { productionCellId: '701' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_difficulty_evidence_mismatch'] } }
    },
    {
      id: 17002,
      status: 'pending_review',
      subject: 'physics',
      difficulty: 'medium',
      topicTitle: '电路与欧姆定律',
      prompt: '如图电路中 R1=2 Ω 与 R2=4 Ω 串联后接在 6 V 电源两端，求电流和 R2 两端电压的关系。下列判断正确的是？',
      explanation: '先求串联等效电阻，再由欧姆定律 I=U/R 得电流，最后用 U2=IR2 得电压。',
      generationMetadata: { productionCellId: '702' },
      reviewMetadata: { gate: { decision: 'publishable', reasons: [] } }
    },
    {
      id: 17003,
      status: 'review_failed',
      subject: 'physics',
      difficulty: 'hard',
      topicTitle: '机械能守恒与动量',
      prompt: '质量 2 kg 的物块从高处下滑后与另一物块碰撞。已知碰前速度 4 m/s，碰后共同运动速度 2 m/s，判断能量损失和动量关系。',
      explanation: '先用动量守恒比较碰撞前后 mv，再用动能 1/2mv^2 比较机械能损失，因此需要守恒量和能量变化两条证据。',
      generationMetadata: { productionCellId: '703' },
      reviewMetadata: { gate: { decision: 'reject', reasons: ['profile_hard_multistep_evidence_missing'] } }
    }
  ];
  const summary = physicsQuestionPlanShadowFor(cells, candidates, 'physics');
  assertPhysicsQuestionPlanShadowSelfTest(summary, 'summary should be emitted for physics fixtures');
  assertPhysicsQuestionPlanShadowSelfTest(summary.mode === 'audit_only_physics_question_plan_shadow', 'mode must remain audit-only');
  assertPhysicsQuestionPlanShadowSelfTest(summary.productionImpact === 'none_audit_only', 'production impact must remain none');
  assertPhysicsQuestionPlanShadowSelfTest(summary.providerImpact === 'none_no_provider_call', 'provider impact must remain none');
  assertPhysicsQuestionPlanShadowSelfTest(summary.gateApplicability === 'basic_kinematics_guarded_allowlist_available_subjectPracticeQuestionPlanGateFor_other_families_shadow', 'basic kinematics must expose guarded production availability while other physics families remain shadow-only');
  const verdictCounts = new Map(summary.verdictCounts.map((entry) => [entry.verdict, entry.count]));
  assertPhysicsQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_basic_kinematics_relation_plan_shape') === 1, 'basic kinematics fixture should match exactly once');
  assertPhysicsQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_motion_graph_plan_shape') === 1, 'motion-graph fixture should match exactly once');
  assertPhysicsQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_circuit_constraint_plan_shape') === 1, 'circuit fixture should match exactly once');
  assertPhysicsQuestionPlanShadowSelfTest(verdictCounts.get('candidate_matches_conservation_chain_plan_shape') === 1, 'conservation fixture should match exactly once');
  assertPhysicsQuestionPlanShadowSelfTest(physicsQuestionPlanShadowFor(cells, candidates, 'math') === null, 'physics shadow must not emit for math');
  return {
    mode: 'physics_question_plan_shadow_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    verdictCounts: summary.verdictCounts,
    sampleCount: summary.sampleCount
  };
}

function runChemistryBasicPhQuestionPlanCalibrationSelfTest() {
  const candidates = [
    {
      id: 17101,
      status: 'pending_review',
      subject: 'chemistry',
      difficulty: 'basic',
      topicTitle: '溶液浓度与 pH 计算',
      prompt: '配制 NaOH 溶液时，定容俯视容量瓶刻度线，会使所得溶液的浓度和 pH 如何变化？',
      explanation: '俯视定容会使溶液体积偏小，浓度偏高，因此碱性增强且 pH 偏高。',
      generationMetadata: { productionCellId: '41' },
      reviewMetadata: { gate: { decision: 'publishable', reasons: [] } }
    },
    {
      id: 17102,
      status: 'pending_review',
      subject: 'chemistry',
      difficulty: 'basic',
      topicTitle: '溶液浓度与 pH 计算',
      prompt: '用蒸馏水润湿的 pH 试纸测定稀盐酸，测得的 pH 与实际值相比如何？',
      explanation: '润湿会稀释待测酸液，使氢离子浓度降低，所以测得 pH 偏高。',
      generationMetadata: { productionCellId: '41' },
      reviewMetadata: { gate: { decision: 'publishable', reasons: [] } }
    }
  ];
  const summary = questionPlanCalibrationFor(candidates, 'chemistry', 10);
  assertQuestionPlanExecutionSelfTest(summary?.productionImpact === 'none_audit_only', 'basic pH calibration must remain audit-only');
  assertQuestionPlanExecutionSelfTest(summary?.sampleCount === 2, 'basic pH calibration should include both fixtures');
  assertQuestionPlanExecutionSelfTest(summary.samples.every((sample) => sample.planTemplate === 'basic_ph_measurement_preparation_error_v1'), 'basic pH fixtures must use the promoted pH template');
  assertQuestionPlanExecutionSelfTest(summary.samples.every((sample) => sample.verdict === 'candidate_matches_basic_ph_measurement_error_plan_shape'), 'basic pH fixtures should match the measurement-error plan shape');
  const applicability = questionPlanApplicabilityFor([
    { id: '41', topicTitle: '溶液浓度与 pH 计算', difficulty: 'basic' }
  ], 'chemistry');
  assertQuestionPlanExecutionSelfTest(applicability.applicableCount === 1, 'basic pH must be visible as a guarded production template');
  assertQuestionPlanExecutionSelfTest(applicability.cells[0]?.calibrationOnly === false, 'basic pH cell must no longer be labelled calibration-only');
  assertQuestionPlanExecutionSelfTest(applicability.cells[0]?.requiresExplicitAllowlist === true, 'basic pH production template must visibly require an explicit allowlist');
  assertQuestionPlanExecutionSelfTest(applicability.cells[0]?.cellAllowed === false, 'basic pH production template must stay disabled when no cell allowlist is configured');
  return {
    mode: 'chemistry_basic_ph_question_plan_calibration_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    sampleCount: summary.sampleCount,
    verdicts: summary.summary['41']?.verdicts ?? {}
  };
}

function runQuestionPlanExecutionSelfTest() {
  const candidates = Array.from({ length: 15 }, (_, index) => {
    const routeStage = index === 14
      ? 'delivery'
      : index % 3 === 0
        ? 'candidate_plan_adherence'
        : 'none';
    const adheres = routeStage === 'none';
    return {
      id: 9000 + index,
      status: index % 2 === 0 ? 'review_failed' : 'pending_review',
      difficulty: index < 8 ? 'hard' : 'medium',
      prompt: `QuestionPlan synthetic candidate ${index}`,
      generationMetadata: {
        productionCellId: index < 8 ? '593' : '592',
        questionPlan: {
          taskFamily: index < 8 ? 'hard_experimental_evidence_chain' : 'medium_lab_two_operation_evidence',
          planTemplate: index < 8 ? 'competing_hypothesis_discrimination_v1' : 'two_linked_operations_causal_propagation_v1'
        },
        questionPlanRepair: index === 1
          ? {
            status: 'repaired',
            policyVersion: 'subject-practice-question-plan-deterministic-repair-v1',
            budget: { used: 1, maximum: 2 }
          }
          : null,
        questionPlanAttempt: {
          status: routeStage === 'delivery' ? 'delivery_failed' : adheres ? 'candidate_adheres' : 'candidate_needs_repair',
          attemptIndex: routeStage === 'candidate_plan_adherence' && index === 0 ? 2 : 1,
          taskFamily: index < 8 ? 'hard_experimental_evidence_chain' : 'medium_lab_two_operation_evidence',
          planTemplate: index < 8 ? 'competing_hypothesis_discrimination_v1' : 'two_linked_operations_causal_propagation_v1',
          budget: {
            planRepairCount: 0,
            candidateRepairCount: routeStage === 'candidate_plan_adherence' && index === 0 ? 1 : 0,
            maxPlanRepairs: 2,
            maxCandidateRepairs: 1
          }
        },
        questionPlanAdherence: {
          adheres,
          failureCodes: adheres ? [] : ['candidate_plan_evidence_not_visible']
        },
        questionPlanFailureRoute: {
          stage: routeStage,
          action: routeStage === 'delivery'
            ? 'record_delivery_only'
            : routeStage === 'candidate_plan_adherence'
              ? 'repair_candidate_rendering'
              : 'none',
          reasonCodes: routeStage === 'delivery' ? ['provider_empty_output'] : []
        }
      },
      reviewMetadata: {
        gate: {
          reasons: adheres ? [] : ['profile_difficulty_evidence_mismatch']
        }
      }
    };
  });
  candidates.push({
    id: 9999,
    status: 'review_failed',
    difficulty: 'hard',
    prompt: 'Unplanned synthetic candidate',
    generationMetadata: {},
    reviewMetadata: {}
  });

  const summary = questionPlanExecutionFor(candidates, 'chemistry');
  assertQuestionPlanExecutionSelfTest(summary, 'summary should be emitted for chemistry candidates with QuestionPlan metadata');
  assertQuestionPlanExecutionSelfTest(summary.observedCount === 15, `observedCount should include all planned candidates, got ${summary.observedCount}`);
  assertQuestionPlanExecutionSelfTest(summary.sampleCount === 12, `sampleCount should be capped at 12, got ${summary.sampleCount}`);
  assertQuestionPlanExecutionSelfTest(summary.sampleLimit === 12, `sampleLimit should be 12, got ${summary.sampleLimit}`);
  assertQuestionPlanExecutionSelfTest(summary.candidateCount === 16, `candidateCount should include the unplanned control candidate, got ${summary.candidateCount}`);
  assertQuestionPlanExecutionSelfTest(summary.deliveryRouteCount === 1, `deliveryRouteCount should be 1, got ${summary.deliveryRouteCount}`);
  assertQuestionPlanExecutionSelfTest(summary.deterministicPlanRepairCount === 1, `deterministicPlanRepairCount should be 1, got ${summary.deterministicPlanRepairCount}`);
  assertQuestionPlanExecutionSelfTest(summary.deterministicPlanRepairAttemptCount === 1, `deterministicPlanRepairAttemptCount should be 1, got ${summary.deterministicPlanRepairAttemptCount}`);
  assertQuestionPlanExecutionSelfTest(summary.needsRepairCount === 5, `needsRepairCount should be 5, got ${summary.needsRepairCount}`);
  assertQuestionPlanExecutionSelfTest(summary.adheresCount === 9, `adheresCount should be 9, got ${summary.adheresCount}`);
  assertQuestionPlanExecutionSelfTest(summary.providerFailurePolicy === 'delivery_failures_excluded_from_plan_quality_memory', 'provider failure policy must exclude delivery failures from plan quality memory');
  const retryMemory = questionPlanRetryMemoryFor(candidates, 'chemistry');
  assertQuestionPlanExecutionSelfTest(retryMemory.contributorCount === 5, `retry memory should include five candidate-plan failures and exclude delivery, got ${retryMemory.contributorCount}`);
  assertQuestionPlanExecutionSelfTest(retryMemory.reasonCodes[0]?.reasonCode === 'candidate_plan_evidence_not_visible', 'retry memory must expose candidate-plan failure codes');
  assertQuestionPlanExecutionSelfTest(!retryMemory.samples.some((sample) => sample.id === 9014), 'delivery failure must not enter QuestionPlan retry memory');
  assertQuestionPlanExecutionSelfTest(retryMemory.repairAvailableCount === 4, `retry memory should expose four candidates with one bounded rerender available, got ${retryMemory.repairAvailableCount}`);
  assertQuestionPlanExecutionSelfTest(retryMemory.repairBudgetExhaustedCount === 1, `retry memory should expose one exhausted rerender lineage, got ${retryMemory.repairBudgetExhaustedCount}`);
  assertQuestionPlanExecutionSelfTest(retryMemory.repairBudgetUnknownLegacyCount === 0, 'current QuestionPlan retry fixtures must carry explicit repair budgets');
  assertQuestionPlanExecutionSelfTest(questionPlanExecutionFor(candidates, 'math') === null, 'math should not emit chemistry QuestionPlan execution summary in Phase 1');
  return {
    mode: 'question_plan_execution_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    summary
  };
}

function qualityAuditSamplesFrom(value) {
  const record = recordFrom(value);
  return Array.isArray(record.samples) ? record.samples : arrayFrom(record.reviews);
}

const DIVERSITY_QUALITY_AUDIT_ALLOWED_SUBJECTS = new Set(['math', 'physics']);
const DIVERSITY_QUALITY_AUDIT_ALLOWED_TYPES = new Set([
  'math_soft_cap_incremental_sample',
  'math_scheduler_hint_observation_sample',
  'physics_difficulty_watch_sample'
]);
const DIVERSITY_QUALITY_AUDIT_PROVIDER_BOUNDARY_TOKENS = [
  'provider_empty_output',
  'provider_timeout',
  'provider_schema_invalid',
  'provider_network_error',
  'provider_rate_limited',
  'provider_unavailable',
  'provider_quota_exceeded',
  'gateway_key_cooldown',
  'gateway_concurrency_timeout',
  'gateway_key_concurrency_saturated',
  'gateway_key_rate_limited',
  'gateway_no_key_available',
  'gateway_unknown_error',
  'no_key_available',
  'provider_or_schema'
];

function diversityQualityAuditProviderTokenHits(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return [];
  return DIVERSITY_QUALITY_AUDIT_PROVIDER_BOUNDARY_TOKENS.filter((token) => text.includes(token));
}

function validateDiversityQualityAuditLedgerShape(parsed, resolvedPath) {
  const errors = [];
  const record = recordFrom(parsed);
  const version = cleanText(record.version);
  const scope = cleanText(record.scope);
  const samples = qualityAuditSamplesFrom(record);
  if (version !== 'subject-practice-diversity-quality-audit-ledger-v1') errors.push('ledger_version_mismatch');
  if (scope !== 'audit_only') errors.push('ledger_scope_must_be_audit_only');
  if (!Array.isArray(record.samples) && !Array.isArray(record.reviews)) errors.push('ledger_samples_must_be_array');
  samples.forEach((reviewValue, index) => {
    const review = recordFrom(reviewValue);
    const prefix = `samples[${index}]`;
    const subject = cleanText(review.subject).toLowerCase();
    const reviewType = cleanText(review.reviewType);
    const decision = cleanText(review.decision);
    const evidence = recordFrom(review.evidence);
    const questionId = Number(review.questionId);
    if (!DIVERSITY_QUALITY_AUDIT_ALLOWED_SUBJECTS.has(subject)) errors.push(`${prefix}.subject_invalid`);
    if (!DIVERSITY_QUALITY_AUDIT_ALLOWED_TYPES.has(reviewType)) errors.push(`${prefix}.reviewType_invalid`);
    if (!Number.isInteger(questionId) || questionId <= 0) errors.push(`${prefix}.questionId_invalid`);
    if (!decision) errors.push(`${prefix}.decision_missing`);
    if (!cleanText(review.reviewedAt)) errors.push(`${prefix}.reviewedAt_missing`);
    if (!review.evidence || typeof review.evidence !== 'object' || Array.isArray(review.evidence)) errors.push(`${prefix}.evidence_missing`);
    if (reviewType === 'math_soft_cap_incremental_sample') {
      const nearestQuestionId = Number(review.nearestQuestionId);
      if (!Number.isInteger(nearestQuestionId) || nearestQuestionId <= 0) errors.push(`${prefix}.nearestQuestionId_required_for_math_soft_cap`);
      if (!cleanText(evidence.taskFamily)) errors.push(`${prefix}.evidence.taskFamily_required`);
      if (!cleanText(evidence.nearDuplicateSource)) errors.push(`${prefix}.evidence.nearDuplicateSource_required`);
    }
    if (reviewType === 'math_scheduler_hint_observation_sample') {
      if (!cleanText(evidence.preferredFamily)) errors.push(`${prefix}.evidence.preferredFamily_required`);
      if (!cleanText(evidence.taskFamily)) errors.push(`${prefix}.evidence.taskFamily_required`);
    }
    if (reviewType === 'physics_difficulty_watch_sample') {
      if (!cleanText(evidence.taskFamily)) errors.push(`${prefix}.evidence.taskFamily_required`);
      if (!cleanText(evidence.issueCode)) errors.push(`${prefix}.evidence.issueCode_required`);
    }
    const providerTokenHits = [
      ...diversityQualityAuditProviderTokenHits(reviewType).map((token) => `reviewType:${token}`),
      ...diversityQualityAuditProviderTokenHits(decision).map((token) => `decision:${token}`),
      ...diversityQualityAuditProviderTokenHits(evidence.issueCode).map((token) => `evidence.issueCode:${token}`),
      ...diversityQualityAuditProviderTokenHits(evidence.failureCategory).map((token) => `evidence.failureCategory:${token}`),
      ...diversityQualityAuditProviderTokenHits(evidence.errorCode).map((token) => `evidence.errorCode:${token}`)
    ];
    if (providerTokenHits.length) errors.push(`${prefix}.provider_failure_boundary_token:${providerTokenHits.join('|')}`);
  });
  if (errors.length) {
    throw new Error(`Invalid diversity quality-audit ledger at ${resolvedPath}: ${errors.slice(0, 8).join(', ')}`);
  }
  return {
    validationStatus: 'valid',
    validationIssueCount: 0
  };
}

function loadDiversityQualityAuditLedger(ledgerPath = DEFAULT_DIVERSITY_QUALITY_AUDIT_LEDGER_PATH) {
  const requestedPath = cleanText(ledgerPath) || DEFAULT_DIVERSITY_QUALITY_AUDIT_LEDGER_PATH;
  if (['none', 'off', 'false'].includes(requestedPath.toLowerCase())) {
    return {
      version: 'none',
      path: null,
      validationStatus: 'skipped',
      validationIssueCount: 0,
      sampleCount: 0,
      reviewCount: 0,
      samples: []
    };
  }
  const resolvedPath = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(__dirname, '..', requestedPath);
  if (!fs.existsSync(resolvedPath)) {
    return {
      version: 'missing',
      path: resolvedPath,
      validationStatus: 'missing',
      validationIssueCount: 0,
      sampleCount: 0,
      reviewCount: 0,
      samples: []
    };
  }
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const validation = validateDiversityQualityAuditLedgerShape(parsed, resolvedPath);
  const samples = qualityAuditSamplesFrom(parsed);
  return {
    ...recordFrom(parsed),
    path: resolvedPath,
    ...validation,
    sampleCount: samples.length,
    reviewCount: samples.length,
    samples
  };
}

function diversityQualityAuditLedgerSummary(ledger) {
  const record = recordFrom(ledger);
  return {
    version: cleanText(record.version) || 'unknown',
    path: record.path ?? null,
    validationStatus: cleanText(record.validationStatus) || 'unknown',
    validationIssueCount: Number(record.validationIssueCount) || 0,
    sampleCount: Number(record.sampleCount) || qualityAuditSamplesFrom(record).length,
    reviewCount: Number(record.reviewCount) || Number(record.sampleCount) || qualityAuditSamplesFrom(record).length
  };
}

function get(value, pathText) {
  return pathText.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, value);
}

function asNumber(value) {
  return Number(value ?? 0) || 0;
}

function difficultyAliases(difficulty) {
  const normalized = cleanText(difficulty).toLowerCase();
  if (normalized === 'basic' || normalized === '基础') return new Set(['basic', '基础']);
  if (normalized === 'medium' || normalized === '中等') return new Set(['medium', '中等']);
  if (normalized === 'hard' || normalized === '困难') return new Set(['hard', '困难']);
  return new Set([normalized]);
}

function short(text, max = 140) {
  const value = cleanText(text);
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function answerMentionedInExplanation(explanation) {
  const text = cleanText(explanation).toUpperCase();
  const direct = /(?:故选|答案(?:是|为)?|正确答案(?:是|为)?|因此选)\s*([A-D])/.exec(text);
  return direct?.[1] ?? null;
}

function optionTexts(options) {
  return arrayFrom(options).map((option) => cleanText(recordFrom(option).text)).filter(Boolean);
}

function containsVisualDependency(question) {
  const text = [question.prompt, question.explanation, ...optionTexts(question.options)].join(' ');
  return /(如图|图中|下图|右图|左图|figure|diagram|shown in the figure)/i.test(text);
}

function subjectPracticeFormalQuestion(question) {
  const reviewMetadata = recordFrom(question.reviewMetadata);
  return cleanText(get(reviewMetadata, 'subjectPracticeAutoApproval.status')) === 'published_to_subject_practice'
    && cleanText(get(reviewMetadata, 'subjectPracticeAutoApproval.targetUseCase')) === 'subject_practice';
}

function gatewayStatusFromJobError(error) {
  const text = cleanText(error);
  const match = /status=([a-z0-9_]+)/i.exec(text);
  if (match) return match[1];
  if (/max_attempts_exhausted/i.test(text)) return 'max_attempts_exhausted';
  if (/source_profile_missing/i.test(text)) return 'source_profile_missing';
  return text ? short(text, 80) : 'none';
}

function promptFamily(prompt, question = {}) {
  const text = cleanText(prompt);
  const subject = cleanText(question.subject).toLowerCase();
  const centralFamily = subjectPracticeClassifyTaskFamily?.({
    subject: question.subject,
    topicTitle: question.topicTitle,
    prompt,
    options: question.options,
    explanation: question.explanation
  });
  if (centralFamily) return centralFamily;
  if (subject !== 'chemistry') {
  if (/(等差数列|arithmetic sequence)/i.test(text) && /(?:s[₀-₉0-9]+|前\s*n\s*项和|前n项和|a[₀-₉0-9]+\s*[+＋]|公差|\bd\b|首项|求.*a[₀-₉0-9]+)/i.test(text)) return 'arithmetic_sequence_two_condition_solve_a1_d';
  if (/(等比数列|geometric sequence)/i.test(text) && /(?:s[₀-₉0-9]+|前\s*n\s*项和|前n项和|a[₀-₉0-9]+|公比|\bq\b|求.*a[₀-₉0-9]+)/i.test(text)) return 'geometric_sequence_two_condition_solve_q';
  if (/(全集|集合|set).{0,220}(区间|并集|交集|补集|描述法|x²|x\^2|不等式|interval|union|intersection)|(?:区间|并集|交集|补集|描述法|interval|union|intersection).{0,220}(全集|集合|set)/i.test(text)) return 'interval_set_operation_solution';
  if (/(平均数|mean|average).{0,120}(去掉|删除|剩余|removed|remaining)|(?:去掉|删除|剩余|removed|remaining).{0,120}(平均数|mean|average)/i.test(text)) return 'mean_removed_value';
  if (/(合并|两组|combined|pooled).{0,160}(方差|variance|平均数|mean)|(?:方差|variance).{0,160}(合并|两组|combined|pooled)/i.test(text)) return 'combined_variance';
  if (/(点到平面|distance from .* point .* plane|point .* distance .* plane|法向量|normal vector).{0,180}(距离|平面|plane)|(?:平面|plane).{0,180}(点到平面|法向量|normal vector|原点|点\s*o|o\s*\().{0,100}(距离|distance)|(?:原点|点\s*o|o\s*\().{0,160}(平面|plane).{0,100}(距离|distance)/i.test(text)) return 'coordinate_geometry_point_to_plane_distance';
  if (/(椭圆|双曲线|抛物线|圆锥曲线|ellipse|hyperbola|parabola|conic).{0,180}(共焦点|焦点|focus|foci|直角三角形|离心率|渐近线|准线|参数|标准方程|asymptote|eccentricity|directrix|parameter)|(?:共焦点|焦点|focus|foci|渐近线|asymptote|离心率|eccentricity).{0,180}(椭圆|双曲线|抛物线|圆锥曲线|ellipse|hyperbola|parabola|conic)/i.test(text)) return 'conic_shared_focus_relation';
  if (/(空间|立体几何|space geometry|solid geometry|space).{0,180}(向量|\\vec|vector|点积|数量积|夹角|余弦|cos)|(?:向量|\\vec|vector|点积|数量积|夹角|余弦|cos).{0,180}(空间|立体几何|space geometry|solid geometry|space)|(?:[a-z]{1,2}|[A-Z]{1,2}).{0,20}(?:与|and).{0,20}(?:[a-z]{1,2}|[A-Z]{1,2}).{0,120}(夹角|余弦|cos)/i.test(text)) return 'spatial_vector_angle_cosine';
  if (/(空间|立体几何|space geometry|solid geometry).{0,180}(直线|线|平面|面).{0,180}(平行|垂直|命题|判断|parallel|perpendicular)|(?:直线|线|平面|面).{0,180}(平行|垂直|parallel|perpendicular).{0,180}(命题|判断|正确|incorrect)/i.test(text)) return 'spatial_line_plane_concept_judgement';
  if (!/(二次函数|quadratic|对称轴|开口|顶点|axis|vertex)/i.test(text) && /(x\^y\s*=\s*y\^x|ln\s*t\s*\/\s*t|\\ln|单调性|monotonicity).{0,180}(当且仅当|奇偶|命题|判断|statement)|(?:函数|function).{0,180}(奇偶|偶函数|奇函数|单调|定义域|值域|命题|判断|parity|monotonicity)/i.test(text)) return 'function_monotonicity_parity_statement';
  if (/(log|lg|ln|对数).{0,180}(方程|定义域|解得|x\s*的值|x\\?\)?\s*=|equation|domain|solve)|(?:方程|定义域|解得|x\s*的值|equation|domain|solve).{0,180}(log|lg|ln|对数)/i.test(text)) return 'logarithmic_equation_domain_solution';
  if (/(指数|对数|幂|log|lg|exponential|logarithm).{0,180}(比较|大小|排序|由小到大|由大到小|a\s*=|b\s*=|c\s*=|order)|(?:比较|大小|排序|由小到大|由大到小|order).{0,180}(指数|对数|幂|log|lg|exponential|logarithm)/i.test(text)) return 'elementary_function_exp_log_ordering';
  if (/(不等式|inequality).{0,220}(一定成立|恒成立|命题|正确|错误|反例|保号|同向|反向|倒数|counterexample|a\s*>|b\s*>|c\s*>|d\s*>)|(?:一定成立|恒成立|命题|正确|错误|反例|保号|同向|反向|倒数|counterexample).{0,220}(不等式|inequality|a\s*>|b\s*>|c\s*>|d\s*>)/i.test(text)) return 'inequality_order_property_counterexample';
  if (/(导数|derivative|f'\(|切线|tangent).{0,180}(交点|约束|参数|斜率|constraint|slope)|(?:交点|约束|参数|斜率|constraint|slope).{0,180}(导数|derivative|f'\(|切线|tangent)/i.test(text)) return 'derivative_tangent_constraint';
  if (/(二次函数|quadratic).{0,180}(对称轴|开口|顶点|最小值|最大值|单调|值域|性质|axis|vertex)|(?:对称轴|开口|顶点|最小值|最大值|axis|vertex).{0,180}(二次函数|quadratic|x\^2|x²)|(?:x\^2|x²).{0,120}(对称轴|开口|顶点|axis|vertex)/i.test(text)) return 'quadratic_function_properties';
  if (/(概率|probability|事件|event|随机|抽取|取法).{0,180}(至少|至多|恰好|排列|组合|计数|互斥|独立|不考虑顺序|构成.*(?:等比数列|等差数列)|counting|combination)|(?:排列|组合|计数|不考虑顺序|构成.*(?:等比数列|等差数列)|counting|combination).{0,180}(概率|probability|事件|event|随机|抽取|取法)/i.test(text)) return 'probability_multi_event_counting';
  if (/(复数|complex).{0,180}(共轭|四则运算|实部|虚部|overline|conjugate|real part|imaginary part)|(?:共轭|四则运算|实部|虚部|overline|conjugate|real part|imaginary part).{0,180}(复数|complex)/i.test(text)) return 'complex_conjugate_linear_equation_solve';
  if (/(复数|complex).{0,180}(模长|模|向量|数量积|dot product)/i.test(text)) return 'complex_mod_vector_dot_product';
  if (/(向量|\\vec|vector).{0,180}(坐标|数量积|点积|夹角|模长|求\||cos|norm|dot)|(?:坐标|数量积|点积|夹角|模长|求\||cos|norm|dot).{0,180}(向量|\\vec|vector)/i.test(text)) return 'vector_coordinate_norm_dot_angle';
  if (/(分式不等式|不等式|inequality).{0,180}(解集|区间|分母|端点|solution set)|(?:解集|区间|solution set).{0,180}(分式不等式|不等式|inequality)/i.test(text)) return 'rational_inequality_solution_boundary';
  }
  if (subject === 'math') return 'other';
  const topicTitle = cleanText(question.topicTitle).toLowerCase();
  if (/气体.*(?:制备|检验|收集)|gas preparation|gas identification|gas collection/.test(topicTitle)) {
    if (
      /(cl2|cl₂|氯气)/i.test(text)
      && /(hcl|氯化氢|水蒸气|饱和食盐水|浓硫酸|除杂|干燥|净化|purify|dry)/i.test(text)
      && /(湿润.*蓝色石蕊|蓝色石蕊|hclo|次氯酸|漂白|褪色|先变红|chlorine water|bleach)/i.test(text)
    ) return 'gas_chlorine_impurity_drying_litmus_bleaching';
    if (
      /(nh3|nh₃|氨气|氨)/i.test(text)
      && /(氯化铵|nh4cl|nh₄cl|氢氧化钙|ca\(oh\)2|ca\\?\(oh\\?\)2|向下排空气|红色石蕊|变蓝)/i.test(text)
      && /(制取|收集|检验|瓶口|湿润|identify|test|collection)/i.test(text)
    ) return 'gas_ammonia_preparation_red_litmus';
    if (
      /(co2|co₂|二氧化碳)/i.test(text)
      && /(收集满|验满|集满|充满|逸出瓶口|瓶口|瓶口处|collected full|full collection)/i.test(text)
      && /(燃着.*木条|木条.*熄灭|火焰.*熄灭|熄灭|burning splint|extinguish)/i.test(text)
    ) return 'gas_carbon_dioxide_collection_full_splint';
    if (
      /(co2|co₂|二氧化碳)/i.test(text)
      && /(澄清石灰水|石灰水|ca\(oh\)2|ca\\?\(oh\\?\)2|caco3|caco₃|碳酸钙|limewater)/i.test(text)
      && /(检验|鉴别|证明|判断|是否为|变浑浊|白色沉淀|特征现象|identify|test|milky)/i.test(text)
    ) return 'gas_carbon_dioxide_limewater';
  }
  if (
    /(氧化还原|电子转移|化合价|氧化剂|还原剂|被氧化|被还原|redox|oxidizing agent|reducing agent)/i.test(text)
    && /(pb|pbo2|pbo₂|铅蓄电池|cl2|cl₂|hclo|fecl3|fecl₂|fecl2|cu|单反应|反应)/i.test(text)
    && /(升至|降至|价升|价降|0价|\+2价|\+4价|作氧化剂|作还原剂|oxidized|reduced)/i.test(text)
  ) return 'redox_single_reaction_valence_agent_judgement';
  if (/为探究|探究/.test(text)) {
    if (/催化剂|MNO2|二氧化锰/i.test(text)) return 'rate_catalyst_experiment';
    if (/温度|热水|冷水|加热/.test(text)) return 'rate_temperature_experiment';
    if (/接触面积|粉末|块状|铁粉|铁片|颗粒|表面积/.test(text)) return 'rate_surface_area_experiment';
    if (/浓度|较浓|较稀/.test(text)) return 'rate_concentration_experiment';
    return 'rate_controlled_variable_experiment';
  }
  const equilibriumLike = /恒温|恒容|恒压|充入|压缩|扩大容器|扩大为|体积|Q\s*[<=>]|平衡常数|转化率|产率|可逆反应|⇌/.test(text);
  if (equilibriumLike) {
    const hasQk = /反应商|平衡常数|\bQ\b|\bK\b|Q\s*[<=>]|[<=>]\s*K/i.test(text);
    const hasCatalyst = /催化剂|catalyst/i.test(text);
    const hasVolume = /压缩|扩大容器|扩大为|体积.*(?:半|倍|减小|增大)|容积.*(?:不变|改变|扩大|压缩)/.test(text);
    const hasTemperature = /升温|降温|温度|T[₀-₉0-9]|ΔH|吸热|放热/.test(text);
    const hasInertGas = /惰性气体|He|氦气|总压|分压|恒压|恒容充/i.test(text);
    const hasConcentrationPerturbation = /再充入|加入.*(?:mol|浓度|少量)|移走|通入.*(?:反应物|生成物|SO2|O2|CO2|Cl2|H2|I2|NO2)/i.test(text);
    if (hasInertGas) return 'equilibrium_inert_gas_partial_pressure';
    if (hasTemperature && /(K[₀-₉0-9]?\s*[=＝]|平衡常数|升温|降温|T[₀-₉0-9])/.test(text)) return 'equilibrium_temperature_k_or_heat_shift';
    if (hasVolume && hasQk && hasCatalyst) return 'equilibrium_volume_qk_catalyst_two_stage';
    if (hasVolume && hasQk) return 'equilibrium_volume_qk_perturbation';
    if (hasConcentrationPerturbation && hasQk && hasCatalyst) return 'equilibrium_concentration_qk_catalyst_two_stage';
    if (hasConcentrationPerturbation && hasQk) return 'equilibrium_concentration_qk_perturbation';
    if (hasCatalyst) return 'equilibrium_catalyst_rate_contrast';
    return 'equilibrium_perturbation_application';
  }
  if (/(正戊烷|新戊烷|异丁烷|正丁烷|同分异构|支链|烷烃|isomer|alkane).{0,140}(沸点|汽化焓|色散力|接触面积|boiling|vap|dispersion|surface)|(?:沸点|汽化焓|色散力|接触面积|boiling|vap|dispersion|surface).{0,140}(正戊烷|新戊烷|异丁烷|正丁烷|同分异构|支链|烷烃|isomer|alkane)/i.test(text)) return 'bond_isomer_branching_dispersion_data';
  if (/(乙醇|二甲醚|甲醇|甲硫醇|ch3oh|ch₃oh|ch3sh|ch₃sh|methanol|methanethiol).{0,180}(汽化焓|气化热|沸点|贡献|氢键|色散力|boiling|vap|hydrogen|dispersion)|(?:汽化焓|气化热|沸点|贡献|氢键|色散力|boiling|vap|hydrogen|dispersion).{0,180}(乙醇|二甲醚|甲醇|甲硫醇|ch3oh|ch₃oh|ch3sh|ch₃sh|methanol|methanethiol)/i.test(text)) return 'bond_hydrogen_bond_data_anomaly';
  if (/(键能|键焓|断键|成键|bond energy|bond enthalpy|enthalpy).{0,180}(差值|异常|比较|计算|汽化焓|气化热|能量)|(?:差值|异常|比较|计算|汽化焓|气化热|能量).{0,180}(键能|键焓|断键|成键|bond energy|bond enthalpy|enthalpy)/i.test(text)) return 'bond_energy_enthalpy_data_anomaly';
  if (/(离子晶体|离子化合物|分子晶体|分子固体|ionic solid|molecular solid).{0,160}(熔点|沸点|导电|硬度|数据|异常|melting|boiling|conductivity)|(?:熔点|沸点|导电|硬度|数据|异常|melting|boiling|conductivity).{0,160}(离子晶体|离子化合物|分子晶体|分子固体|ionic solid|molecular solid)/i.test(text)) return 'bond_ionic_molecular_solid_data_anomaly';
  if (/(?:极性|偶极|色散力|范德华力|polarity|dipole|dispersion).{0,180}(?:沸点|熔点|汽化焓|气化热|数据|异常|比较|boiling|melting|vap)|(?:沸点|熔点|汽化焓|气化热|数据|异常|比较|boiling|melting|vap).{0,180}(?:极性|偶极|色散力|范德华力|polarity|dipole|dispersion)/i.test(text)) return 'bond_polarity_hbond_dispersion_data';
  if (/(卤素|氯水|溴水|碘水|cl2|cl₂|br2|br₂|i2|i₂|ki|kbr|nabr|nai|碘化钾|溴化钾|溴化钠|碘化钠).{0,140}(半径|电负性|非金属性|同主族|趋势|radius|electronegativity|nonmetallic)|(?:半径|电负性|非金属性|同主族|趋势|radius|electronegativity|nonmetallic).{0,140}(卤素|氯水|溴水|碘水|cl2|cl₂|br2|br₂|i2|i₂|ki|kbr|nabr|nai|碘化钾|溴化钾|溴化钠|碘化钠)/i.test(text)) return 'periodic_halogen_displacement_plus_trend';
  if (/(金属活动性|金属性|钠|镁|铝|na|mg|al).{0,140}(氧化物|水化物|酸性|碱性|两性|oxide|hydrate|acidic|basic|amphoteric)|(?:氧化物|水化物|酸性|碱性|两性|oxide|hydrate|acidic|basic|amphoteric).{0,140}(金属活动性|金属性|钠|镁|铝|na|mg|al)/i.test(text)) return 'periodic_metal_activity_oxide_dual_evidence';
  if (/(电离能|第一电离能|ionization energy).{0,160}(异常|例外|半满|全满|p轨道|exception|anomaly)|(?:异常|例外|半满|全满|p轨道|exception|anomaly).{0,160}(电离能|第一电离能|ionization energy)/i.test(text)) return 'periodic_ionization_energy_exception';
  if (/(未知元素|元素x|元素y|x、y、z|x,y,z|甲、乙、丙|短周期).{0,180}(电子排布|电子层|氢化物|氧化物|化合物|价态|半径|unknown element|electron configuration|hydride|oxide|compound formula)|(?:电子排布|电子层|氢化物|氧化物|化合物|价态|半径|unknown element|electron configuration|hydride|oxide|compound formula).{0,180}(未知元素|元素x|元素y|x、y、z|x,y,z|甲、乙、丙|短周期)/i.test(text)) return /化合物|compound formula|价态|valence/i.test(text)
    ? 'periodic_compound_formula_property_ranking'
    : 'periodic_unknown_element_electron_hydride_clue';
  if (/(氧化物|水化物|oxide|hydrate).{0,160}(半径|价态|电子层|核电荷|消去|排除|radius|valence|electron layer)|(?:半径|价态|电子层|核电荷|消去|排除|radius|valence|electron layer).{0,160}(氧化物|水化物|oxide|hydrate)/i.test(text)) return 'periodic_oxide_radius_valence_elimination';
  if (/(同周期|同主族|same period|same group).{0,120}(半径|电负性|金属性|非金属性|氧化物|radius|electronegativity|metallic|nonmetallic|oxide)|(?:半径|电负性|金属性|非金属性|氧化物|radius|electronegativity|metallic|nonmetallic|oxide).{0,120}(同周期|同主族|same period|same group)/i.test(text)) return 'periodic_same_period_group_dual_clue';
  if (/(氯水|溴水|碘水|卤素|cl2|cl₂|br2|br₂|i2|i₂|ki|kbr|nabr|nacl|碘化钾|溴化钾|溴化钠|氯化钠|halogen).{0,100}(置换|无明显变化|橙红|橙黄|棕黄|碘单质|溴单质|生成.*(?:br2|br₂|i2|i₂|溴|碘)|非金属性|氧化性|activity|displacement|brown|yellow)|(?:置换|无明显变化|橙红|橙黄|棕黄|碘单质|溴单质|生成.*(?:br2|br₂|i2|i₂|溴|碘)|非金属性|氧化性|activity|displacement|brown|yellow).{0,100}(氯水|溴水|碘水|卤素|cl2|cl₂|br2|br₂|i2|i₂|ki|kbr|nabr|nacl|碘化钾|溴化钾|溴化钠|氯化钠|halogen)/i.test(text)) return 'periodic_halogen_displacement_observation';
  if (/可逆反应|⇌|平衡体系|红色|变浅|变蓝/.test(text)) return 'equilibrium_observation_shift';
  if (/(钠|镁|铝|na|mg|al|金属).{0,80}(水|酸|反应|气泡|剧烈|活动性|金属性|reactivity|metallic)|(?:反应|气泡|剧烈|活动性|金属性|reactivity|metallic).{0,80}(钠|镁|铝|na|mg|al|金属)/i.test(text)) return 'periodic_metal_activity_observation';
  if (/(氧化物|最高价氧化物|水化物|oxide).{0,80}(酸性|碱性|两性|acidic|basic|amphoteric)|(?:酸性|碱性|两性|acidic|basic|amphoteric).{0,80}(氧化物|最高价氧化物|水化物|oxide)/i.test(text)) return 'periodic_oxide_property_observation';
  if (/(等电子|相同电子|同电子|same electron|核电荷|nuclear charge|离子半径|ion radius)/i.test(text)) return 'periodic_same_electron_ion_radius';
  if (/(nh4cl|氯化铵|铵盐|固态|熔融|水溶液|导电|conductivity|conduct).{0,80}(不导电|能导电|导电|自由移动|离子|ionic)|(?:不导电|能导电|导电|自由移动|离子|ionic).{0,80}(nh4cl|氯化铵|铵盐|固态|熔融|水溶液|conductivity|conduct)/i.test(text)) return 'bond_ionic_solid_conductivity';
  if (/(干冰|co2|二氧化碳|碘|升华|低熔点|sublim|low melting).{0,80}(升华|直接变为|气体|分子|分子间|molecular|intermolecular)|(?:升华|直接变为|气体|分子|分子间|molecular|intermolecular).{0,80}(干冰|co2|二氧化碳|碘|低熔点|sublim|low melting)/i.test(text)) return 'bond_molecular_solid_sublimation';
  if (/(氢键|hydrogen bond).{0,80}(气化热|汽化焓|沸点|熔点|溶解|boiling|melting|solubility|vap)|(?:气化热|汽化焓|沸点|熔点|溶解|boiling|melting|solubility|vap).{0,80}(氢键|hydrogen bond)|(?:水|h2o|h₂o).{0,120}(?:h2s|h₂s|硫化氢).{0,120}(?:沸点|相对分子质量|反常|高于|低于)|(?:h2s|h₂s|硫化氢).{0,120}(?:水|h2o|h₂o).{0,120}(?:沸点|相对分子质量|反常|高于|低于)/i.test(text)) return 'bond_hydrogen_bond_anomaly';
  if (/(nh4|铵盐|铵根|ammonium).{0,80}(离子键|共价键|ionic|covalent)|(?:离子键|共价键|ionic|covalent).{0,80}(nh4|铵盐|铵根|ammonium)/i.test(text)) return 'bond_mixed_bond_salt_fact';
  if (/离子方程式|化学方程式|化学式|配平|电荷守恒|原子守恒/.test(text)) return 'notation_expression_selection';
  if (/逐滴加入|继续滴加|过量|沉淀.*溶解|持续通入/.test(text)) return 'reagent_sequence_notation';
  if (/放入|加入|通入|滴加/.test(text)) return 'single_reagent_observation';
  return 'other';
}

function questionFingerprint(question, family = '') {
  return subjectPracticeBuildQuestionFingerprint?.({
    subject: question.subject,
    topicId: question.topicId,
    topicTitle: question.topicTitle,
    difficulty: question.difficulty,
    taskFamily: family || promptFamily(question.prompt, question),
    prompt: question.prompt,
    options: question.options,
    explanation: question.explanation
  }) ?? {
    subject: cleanText(question.subject),
    topicId: asNumber(question.topicId) || null,
    difficulty: cleanText(question.difficulty).toLowerCase(),
    taskFamily: family || promptFamily(question.prompt, question),
    representationType: 'text',
    quantitativeShape: 'multi_step',
    answerForm: 'option_judgement',
    objects: [],
    subjectExtension: {},
    policyVersion: 'audit-fallback'
  };
}

function mathDifficultyAudit(question, family) {
  const audit = subjectPracticeMathDifficultyAudit?.({
    difficulty: question.difficulty,
    taskFamily: family
  });
  if (audit) return audit;
  const difficulty = cleanText(question.difficulty).toLowerCase();
  if ((difficulty === 'hard' || difficulty === '困难') && [
    'arithmetic_sequence_two_condition_solve_a1_d',
    'geometric_sequence_two_condition_solve_q',
    'mean_removed_value',
    'quadratic_function_properties',
    'spatial_line_plane_concept_judgement',
    'rational_inequality_solution_boundary'
  ].includes(family)) {
    return {
      severity: 'P1',
      reasonCode: 'math_hard_simple_task_family',
      taskFamily: family,
      message: 'Hard math production candidate uses a task family that is usually a direct concept or short formula application; offline difficulty audit is required.'
    };
  }
  if ((difficulty === 'medium' || difficulty === '中等') && family === 'mean_removed_value') {
    return {
      severity: 'P2',
      reasonCode: 'math_medium_basic_task_family',
      taskFamily: family,
      message: 'Medium math production candidate looks like a basic one-step statistics shell; track it as a difficulty-stability warning.'
    };
  }
  return null;
}

function physicsDifficultyAudit(question, family) {
  return subjectPracticePhysicsDifficultyAudit?.({
    difficulty: question.difficulty,
    taskFamily: family
  }) ?? null;
}

function mathDifficultyRetirementCoverage(question) {
  const productionRunId = cleanText(get(question.generationMetadata, 'productionRunId'));
  if (productionRunId) return 'production_run_refresh';
  return 'runless_formal_question_needs_offline_or_global_cleanup';
}

function mathDifficultyFindingsFor(questions, subject) {
  if (subject !== 'math') return [];
  return questions.flatMap((question) => {
    const family = promptFamily(question.prompt, question);
    const audit = mathDifficultyAudit(question, family);
    return audit ? [{
      id: Number(question.id),
      subject,
      topicTitle: question.topicTitle,
      difficulty: question.difficulty,
      family,
      severity: audit.severity,
      reasonCode: audit.reasonCode,
      message: audit.message,
      prompt: short(question.prompt, 180),
      sourceQuestionId: asNumber(question.sourceQuestionId),
      productionRunId: cleanText(get(question.generationMetadata, 'productionRunId')),
      productionCellId: cleanText(get(question.generationMetadata, 'productionCellId')),
      retirementCoverage: mathDifficultyRetirementCoverage(question),
      createdAt: question.createdAt
    }] : [];
  });
}

function physicsDifficultyFindingsFor(questions, subject) {
  if (subject !== 'physics') return [];
  return questions.flatMap((question) => {
    const family = promptFamily(question.prompt, question);
    const audit = physicsDifficultyAudit(question, family);
    return audit ? [{
      id: Number(question.id),
      subject,
      topicTitle: question.topicTitle,
      difficulty: question.difficulty,
      family,
      severity: audit.severity,
      reasonCode: audit.reasonCode,
      message: audit.message,
      prompt: short(question.prompt, 180),
      sourceQuestionId: asNumber(question.sourceQuestionId),
      productionRunId: cleanText(get(question.generationMetadata, 'productionRunId')),
      productionCellId: cleanText(get(question.generationMetadata, 'productionCellId')),
      retirementCoverage: 'audit_only_visibility',
      createdAt: question.createdAt
    }] : [];
  });
}

function dbStudentPoolStatusForVisibility(visibility) {
  if (!visibility?.sourceQuestionId) return 'no_published_practice_row';
  if (visibility.practiceStatus !== 'published') return 'no_published_practice_row';
  if (visibility.adaptiveEligibleMappingCount > 0) return 'adaptive_candidate_visible';
  return 'published_practice_row_but_not_adaptive_visible';
}

function studentPoolStatusForVisibility(visibility, options = {}) {
  const dbStatus = dbStudentPoolStatusForVisibility(visibility);
  if (dbStatus === 'adaptive_candidate_visible' && options.currentPolicyBlocked) {
    return 'blocked_by_current_policy_at_adaptive_selection';
  }
  return dbStatus;
}

async function practiceVisibilityForDifficultyFindings(prisma, findings) {
  const ids = Array.from(new Set(findings.map((finding) => Number(finding.id)).filter((id) => Number.isInteger(id) && id > 0)));
  if (!ids.length) return new Map();
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT q."id" AS "questionId",
           q."source_question_id" AS "sourceQuestionId",
           spq."status" AS "practiceStatus",
           spq."difficulty" AS "practiceDifficulty",
           spq."topic_id" AS "specialPracticeTopicId",
           spt."status" AS "specialPracticeTopicStatus",
           spt."title" AS "specialPracticeTopicTitle",
           COUNT(mapping."id")::int AS "mappingCount",
           COUNT(mapping."id") FILTER (WHERE exam_topic."status" = 'published')::int AS "publishedExamTopicMappingCount",
           COUNT(mapping."id") FILTER (
             WHERE exam_topic."id" = q."topic_id"
               AND exam_topic."status" = 'published'
               AND exam_topic."syllabus_version" = q."syllabus_version"
           )::int AS "adaptiveEligibleMappingCount",
           STRING_AGG(DISTINCT CONCAT(exam_topic."id", ':', exam_topic."title", ':', exam_topic."status"), '; ') AS "mappedExamTopics"
    FROM "csca_questions" q
    LEFT JOIN "special_practice_questions" spq ON spq."id" = q."source_question_id"
    LEFT JOIN "special_practice_topics" spt ON spt."id" = spq."topic_id"
    LEFT JOIN "csca_topic_mappings" mapping
      ON mapping."source_type" = 'special_practice_question'
     AND mapping."source_id" = spq."id"
    LEFT JOIN "csca_exam_topics" exam_topic ON exam_topic."id" = mapping."topic_id"
    WHERE q."id" IN (${Prisma.join(ids)})
    GROUP BY q."id", spq."id", spt."id"
  `);
  return new Map(rows.map((row) => {
    const visibility = {
      sourceQuestionId: asNumber(row.sourceQuestionId),
      practiceStatus: cleanText(row.practiceStatus) || null,
      practiceDifficulty: cleanText(row.practiceDifficulty) || null,
      specialPracticeTopicId: asNumber(row.specialPracticeTopicId),
      specialPracticeTopicStatus: cleanText(row.specialPracticeTopicStatus) || null,
      specialPracticeTopicTitle: cleanText(row.specialPracticeTopicTitle) || null,
      mappingCount: asNumber(row.mappingCount),
      publishedExamTopicMappingCount: asNumber(row.publishedExamTopicMappingCount),
      adaptiveEligibleMappingCount: asNumber(row.adaptiveEligibleMappingCount),
      mappedExamTopics: cleanText(row.mappedExamTopics) || null
    };
    return [Number(row.questionId), {
      ...visibility,
      dbStudentPoolStatus: dbStudentPoolStatusForVisibility(visibility)
    }];
  }));
}

function withPracticeVisibility(findings, visibilityByQuestionId, options = {}) {
  return findings.map((finding) => {
    const visibility = visibilityByQuestionId.get(Number(finding.id)) ?? {
      sourceQuestionId: asNumber(finding.sourceQuestionId),
      practiceStatus: null,
      practiceDifficulty: null,
      specialPracticeTopicId: 0,
      specialPracticeTopicStatus: null,
      specialPracticeTopicTitle: null,
      mappingCount: 0,
      publishedExamTopicMappingCount: 0,
      adaptiveEligibleMappingCount: 0,
      mappedExamTopics: null,
      dbStudentPoolStatus: 'no_published_practice_row',
      studentPoolStatus: 'no_published_practice_row'
    };
    const findingSubject = cleanText(finding.subject).toLowerCase();
    const currentPolicyBlockReasons = options.currentPolicyBlocks === true
      ? findingSubject === 'math' && finding.reasonCode
        ? [finding.reasonCode]
        : subjectPracticeCurrentPolicyBlockReasons
          ? subjectPracticeCurrentPolicyBlockReasons({
            subject: finding.subject,
            designedDifficulty: finding.difficulty,
            prompt: finding.prompt
          })
          : []
      : [];
    const currentPolicyBlocked = currentPolicyBlockReasons.length > 0;
    const studentPoolStatus = studentPoolStatusForVisibility(visibility, { currentPolicyBlocked });
    return {
      ...finding,
      currentPolicyBlockReasons,
      studentPoolStatus,
      practiceVisibility: {
        ...visibility,
        studentPoolStatus
      }
    };
  });
}

function summarizeRetirementCoverage(findings) {
  return topEntries(findings.reduce((map, finding) => {
    const key = cleanText(finding.retirementCoverage) || 'unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map()), 8).map(([retirementCoverage, count]) => ({ retirementCoverage, count }));
}

function summarizeStudentPoolImpact(findings) {
  const visible = findings.filter((finding) => finding.studentPoolStatus === 'adaptive_candidate_visible');
  const currentPolicyBlocked = findings.filter((finding) => finding.studentPoolStatus === 'blocked_by_current_policy_at_adaptive_selection');
  const dbEligible = findings.filter((finding) => finding.practiceVisibility.dbStudentPoolStatus === 'adaptive_candidate_visible');
  return {
    visibleDifficultyBlockerCount: visible.length,
    visibleRunlessDifficultyBlockerCount: visible.filter((finding) => finding.retirementCoverage === 'runless_formal_question_needs_offline_or_global_cleanup').length,
    visibleProductionRunRefreshBlockerCount: visible.filter((finding) => finding.retirementCoverage === 'production_run_refresh').length,
    currentPolicyBlockedDifficultyBlockerCount: currentPolicyBlocked.length,
    currentPolicyBlockedRunlessDifficultyBlockerCount: currentPolicyBlocked.filter((finding) => finding.retirementCoverage === 'runless_formal_question_needs_offline_or_global_cleanup').length,
    dbAdaptiveEligibleDifficultyBlockerCount: dbEligible.length,
    dbAdaptiveEligibleRunlessDifficultyBlockerCount: dbEligible.filter((finding) => finding.retirementCoverage === 'runless_formal_question_needs_offline_or_global_cleanup').length,
    byStudentPoolStatus: topEntries(findings.reduce((map, finding) => {
      const key = cleanText(finding.studentPoolStatus) || 'unknown';
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map()), 8).map(([studentPoolStatus, count]) => ({ studentPoolStatus, count })),
    byDatabaseEligibleTopicDifficulty: topEntries(dbEligible.reduce((map, finding) => {
      const key = `${cleanText(finding.topicTitle)}|${cleanText(finding.difficulty)}`;
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map()), 12).map(([key, count]) => {
      const [topicTitle, difficulty] = key.split('|');
      return { topicTitle, difficulty, count };
    })
  };
}

function recentFamilySignalsFor(questions, subject) {
  const byFamily = new Map();
  for (const question of questions) {
    const family = promptFamily(question.prompt, question);
    if (!family || family === 'other') continue;
    const key = `${cleanText(question.topicTitle)}|${cleanText(question.difficulty)}|${family}`;
    const entry = byFamily.get(key) ?? {
      topicTitle: question.topicTitle,
      difficulty: question.difficulty,
      family,
      count: 0,
      runIds: new Set(),
      cellIds: new Set(),
      sampleIds: [],
      latestCreatedAt: null
    };
    entry.count += 1;
    const runId = cleanText(get(question.generationMetadata, 'productionRunId'));
    const cellId = cleanText(get(question.generationMetadata, 'productionCellId'));
    if (runId) entry.runIds.add(runId);
    if (cellId) entry.cellIds.add(cellId);
    if (entry.sampleIds.length < 8) entry.sampleIds.push(Number(question.id));
    if (!entry.latestCreatedAt || new Date(question.createdAt).getTime() > new Date(entry.latestCreatedAt).getTime()) {
      entry.latestCreatedAt = question.createdAt;
    }
    byFamily.set(key, entry);
  }
  return Array.from(byFamily.values())
    .map((entry) => {
      const warningReasons = [];
      if (entry.count >= 2 && entry.runIds.size >= 2) warningReasons.push('cross_run_repeated_task_family');
      if (entry.count >= 3) warningReasons.push('recent_repeated_task_family');
      if (entry.count >= 3 && entry.cellIds.size <= 1) warningReasons.push('same_cell_repeated_task_family');
      const diversityGateBlock = subjectPracticeTaskFamilyDiversityBlock?.({
        candidateFamily: entry.family,
        acceptedFamilies: Array.from({ length: entry.count }, () => entry.family),
        targetCount: 8
      });
      const diversityWindowDecision = subjectPracticeEvaluateDiversityWindow?.({
        candidateFamily: entry.family,
        acceptedFamilies: Array.from({ length: entry.count }, () => entry.family),
        targetCount: 8
      });
      return {
        topicTitle: entry.topicTitle,
        difficulty: entry.difficulty,
        family: entry.family,
        count: entry.count,
        runCount: entry.runIds.size,
        cellCount: entry.cellIds.size,
        sampleIds: entry.sampleIds,
        latestCreatedAt: entry.latestCreatedAt,
        warningReasons,
        diversityGateReason: diversityGateBlock?.reasonCode ?? null,
        diversityWindowDecision: diversityWindowDecision?.decision ?? null,
        diversityWindowReasons: Array.isArray(diversityWindowDecision?.reasons) ? diversityWindowDecision.reasons : []
      };
    })
    .filter((entry) => entry.warningReasons.length)
    .sort((left, right) => right.count - left.count || right.runCount - left.runCount || left.family.localeCompare(right.family))
    .slice(0, 20);
}

function familyCoverageSummaryFor(questions, subject) {
  const byFamily = new Map();
  const byDifficulty = new Map();
  const otherClusters = new Map();
  const otherFamilySuggestions = new Map();
  const otherSamples = [];
  const familyWindowScopes = new Map();
  for (const question of questions) {
    const difficulty = cleanText(question.difficulty) || 'unknown';
    const family = cleanText(promptFamily(question.prompt, question)) || 'unclassified';
    byFamily.set(family, (byFamily.get(family) ?? 0) + 1);
    const windowScope = subjectPracticeDiversityFamilyWindowScope
      ? subjectPracticeDiversityFamilyWindowScope(family)
      : null;
    if (family && family !== 'other' && family !== 'unclassified' && windowScope) {
      familyWindowScopes.set(family, windowScope);
    }
    const difficultyEntry = byDifficulty.get(difficulty) ?? {
      difficulty,
      totalQuestionCount: 0,
      knownFamilyCount: 0,
      families: new Map()
    };
    difficultyEntry.totalQuestionCount += 1;
    if (family !== 'other' && family !== 'unclassified') difficultyEntry.knownFamilyCount += 1;
    difficultyEntry.families.set(family, (difficultyEntry.families.get(family) ?? 0) + 1);
    byDifficulty.set(difficulty, difficultyEntry);
    if (family === 'other' || family === 'unclassified') {
      const clusterKey = `${cleanText(question.topicTitle)}|${difficulty}`;
      const clusterEntry = otherClusters.get(clusterKey) ?? {
        topicTitle: question.topicTitle,
        difficulty,
        count: 0,
        sampleIds: []
      };
      clusterEntry.count += 1;
      if (clusterEntry.sampleIds.length < 6) clusterEntry.sampleIds.push(Number(question.id));
      otherClusters.set(clusterKey, clusterEntry);
      const suggestion = auditOnlyOtherFamilySuggestionFor(question, subject);
      if (suggestion) {
        const suggestionKey = `${suggestion.suggestedFamily}|${cleanText(question.topicTitle)}|${difficulty}`;
        const suggestionEntry = otherFamilySuggestions.get(suggestionKey) ?? {
          mode: 'audit_only',
          subject,
          suggestedFamily: suggestion.suggestedFamily,
          reasonCode: suggestion.reasonCode,
          topicTitle: question.topicTitle,
          difficulty,
          count: 0,
          sampleIds: [],
          productionImpact: 'none_audit_only'
        };
        suggestionEntry.count += 1;
        if (suggestionEntry.sampleIds.length < 6) suggestionEntry.sampleIds.push(Number(question.id));
        otherFamilySuggestions.set(suggestionKey, suggestionEntry);
      }
      if (otherSamples.length < 8) otherSamples.push({
        id: Number(question.id),
        topicTitle: question.topicTitle,
        difficulty,
        prompt: short(question.prompt, 160)
      });
    }
  }
  const totalQuestionCount = questions.length;
  const otherCount = (byFamily.get('other') ?? 0) + (byFamily.get('unclassified') ?? 0);
  const knownFamilyCount = Math.max(0, totalQuestionCount - otherCount);
  return {
    mode: 'audit_only',
    policyVersion: 'subject-practice-family-coverage-audit-v1',
    subject,
    totalQuestionCount,
    distinctFamilyCount: byFamily.size,
    knownFamilyCount,
    otherCount,
    knownFamilyRatio: Number((knownFamilyCount / Math.max(1, totalQuestionCount)).toFixed(3)),
    otherRatio: Number((otherCount / Math.max(1, totalQuestionCount)).toFixed(3)),
    topFamilies: topEntries(byFamily, 12).map(([family, count]) => ({ family, count })),
    familyWindowScopes: topEntries(byFamily, 20)
      .filter(([family]) => family && family !== 'other' && family !== 'unclassified')
      .map(([family, count]) => ({
        family,
        count,
        windowScope: familyWindowScopes.get(family) ?? 'unknown',
        productionImpact: familyWindowScopes.get(family) === 'legacy_gated'
          ? 'existing_gate_only'
          : 'none_audit_only'
      })),
    byDifficulty: Array.from(byDifficulty.values())
      .map((entry) => {
        const otherDifficultyCount = (entry.families.get('other') ?? 0) + (entry.families.get('unclassified') ?? 0);
        return {
          difficulty: entry.difficulty,
          totalQuestionCount: entry.totalQuestionCount,
          knownFamilyCount: entry.knownFamilyCount,
          otherCount: otherDifficultyCount,
          knownFamilyRatio: Number((entry.knownFamilyCount / Math.max(1, entry.totalQuestionCount)).toFixed(3)),
          topFamilies: topEntries(entry.families, 8).map(([family, count]) => ({ family, count }))
        };
      })
      .sort((left, right) => cleanText(left.difficulty).localeCompare(cleanText(right.difficulty))),
    otherClusters: Array.from(otherClusters.values())
      .sort((left, right) => right.count - left.count || cleanText(left.topicTitle).localeCompare(cleanText(right.topicTitle)))
      .slice(0, 12),
    otherFamilySuggestions: Array.from(otherFamilySuggestions.values())
      .sort((left, right) => right.count - left.count || cleanText(left.suggestedFamily).localeCompare(cleanText(right.suggestedFamily)))
      .slice(0, 12),
    otherSamples
  };
}

function auditOnlyOtherFamilySuggestionFor(question, subject) {
  if (cleanText(subject).toLowerCase() !== 'math') return null;
  const text = cleanText(`${question.prompt} ${optionTexts(question.options).join(' ')} ${question.explanation}`).toLowerCase();
  if (!text) return null;
  if (/(向量|\\vec|vector).{0,180}(坐标|数量积|点积|夹角|模长|求\||cos|norm|dot)|(?:坐标|数量积|点积|夹角|模长|求\||cos|norm|dot).{0,180}(向量|\\vec|vector)/i.test(text)) {
    return {
      reasonCode: 'audit_only_math_other_family_suggestion',
      suggestedFamily: 'vector_coordinate_norm_dot_angle'
    };
  }
  if (/(指数|对数|幂|log|lg|exponential|logarithm).{0,180}(比较|大小|排序|由小到大|由大到小|a\s*=|b\s*=|c\s*=|order)|(?:比较|大小|排序|由小到大|由大到小|order).{0,180}(指数|对数|幂|log|lg|exponential|logarithm)/i.test(text)) {
    return {
      reasonCode: 'audit_only_math_other_family_suggestion',
      suggestedFamily: 'elementary_function_exp_log_ordering'
    };
  }
  if (/(不等式|inequality).{0,220}(一定成立|命题|正确|反例|counterexample|a\s*>|b\s*>|c\s*>|d\s*>)|(?:一定成立|命题|正确|反例|counterexample).{0,220}(不等式|inequality|a\s*>|b\s*>|c\s*>|d\s*>)/i.test(text)) {
    return {
      reasonCode: 'audit_only_math_other_family_suggestion',
      suggestedFamily: 'inequality_order_property_counterexample'
    };
  }
  if (/(全集|集合|set).{0,220}(区间|并集|交集|补集|描述法|x²|x\^2|不等式|interval|union|intersection)|(?:区间|并集|交集|补集|描述法|interval|union|intersection).{0,220}(全集|集合|set)/i.test(text)) {
    return {
      reasonCode: 'audit_only_math_other_family_suggestion',
      suggestedFamily: 'interval_set_operation_solution'
    };
  }
  if (/(空间|立体几何|space).{0,180}(向量|坐标|点积|夹角|余弦|cos|vector)|(?:向量|坐标|点积|夹角|余弦|cos|vector).{0,180}(空间|立体几何|space)/i.test(text)) {
    return {
      reasonCode: 'audit_only_math_other_family_suggestion',
      suggestedFamily: 'spatial_vector_angle_cosine'
    };
  }
  return null;
}

function nearDuplicateSignalsFor(questions, subject) {
  if (!subjectPracticeNearDuplicateSignal) return [];
  const scoped = questions
    .slice(0, 160)
    .map((question) => {
      const family = promptFamily(question.prompt, question);
      return {
        ...question,
        taskFamily: family,
        fingerprint: questionFingerprint(question, family)
      };
    });
  const signals = [];
  for (let index = 0; index < scoped.length; index += 1) {
    const candidate = scoped[index];
    const signal = subjectPracticeNearDuplicateSignal({
      candidate,
      recent: scoped.slice(index + 1),
      minTokenJaccard: 0.72
    });
    if (signal?.decision !== 'warn') continue;
    signals.push({
      policyVersion: signal.policyVersion,
      nearDuplicatePolicyVersion: signal.nearDuplicatePolicyVersion,
      decision: signal.decision,
      reasonCode: signal.reasonCode,
      candidateId: Number(candidate.id),
      nearestId: signal.nearestId === null ? null : Number(signal.nearestId),
      subject,
      topicTitle: candidate.topicTitle,
      difficulty: candidate.difficulty,
      family: signal.candidateFamily,
      nearestFamily: signal.nearestFamily,
      similarity: signal.similarity,
      similaritySource: signal.similaritySource,
      textSimilarity: signal.textSimilarity,
      expressionSimilarity: signal.expressionSimilarity,
      sharedFamily: signal.sharedFamily,
      comparedCount: signal.comparedCount,
      prompt: short(candidate.prompt, 160)
    });
  }
  return signals
    .sort((left, right) => right.similarity - left.similarity || left.candidateId - right.candidateId)
    .slice(0, 20);
}

function nearDuplicateCalibrationFor(signals, subject, evaluatedCount) {
  const bySource = signals.reduce((map, signal) => {
    const key = cleanText(signal.similaritySource || 'unknown');
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  const byFamily = signals.reduce((map, signal) => {
    const key = cleanText(signal.family || 'unknown');
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  const maxSimilarity = signals.reduce((max, signal) => Math.max(max, Number(signal.similarity) || 0), 0);
  const expressionSignatureCount = signals.filter((signal) => signal.similaritySource === 'expression_signature').length;
  const tokenJaccardCount = signals.filter((signal) => signal.similaritySource === 'token_jaccard').length;
  const recommendationCode = signals.length
    ? 'keep_audit_only_feed_scheduler_review'
    : 'no_near_duplicate_pressure_detected';
  return {
    mode: 'audit_only_calibration',
    subject,
    evaluatedCount,
    signalCount: signals.length,
    signalRatio: Number((signals.length / Math.max(1, evaluatedCount)).toFixed(3)),
    maxSimilarity: Number(maxSimilarity.toFixed(3)),
    expressionSignatureCount,
    tokenJaccardCount,
    bySource: topEntries(bySource, 6).map(([similaritySource, count]) => ({ similaritySource, count })),
    byFamily: topEntries(byFamily, 8).map(([family, count]) => ({ family, count })),
    comparisonScope: 'same_subject_and_shared_family_or_same_topic_difficulty',
    otherFallbackPolicy: 'excluded_from_near_duplicate_warning',
    providerFailurePolicy: 'excluded_provider_and_schema_failures_not_compared_or_recorded_as_memory',
    studentConsumableScope: 'formal_published_subject_practice_window_only',
    productionImpact: 'none_audit_only',
    currentPolicyImpact: 'none',
    recommendationCode,
    recommendation: recommendationCode === 'keep_audit_only_feed_scheduler_review'
      ? 'Keep near-duplicate checks audit-only; use corroborated repeated shells to tune scheduler pools or family rubrics before any blocker is considered.'
      : 'No near-duplicate pressure in this window; continue audit-only monitoring.',
    samples: signals.slice(0, 8).map((signal) => ({
      candidateId: signal.candidateId,
      nearestId: signal.nearestId,
      topicTitle: signal.topicTitle,
      difficulty: signal.difficulty,
      family: signal.family,
      similarity: signal.similarity,
      similaritySource: signal.similaritySource,
      sharedFamily: signal.sharedFamily,
      reasonCode: signal.reasonCode,
      prompt: signal.prompt
    }))
  };
}

function nearDuplicateRecommendationsFor(signals, subject) {
  const grouped = new Map();
  for (const signal of signals) {
    const key = [
      cleanText(signal.topicTitle),
      cleanText(signal.difficulty),
      cleanText(signal.family),
      cleanText(signal.similaritySource)
    ].join('|');
    const entry = grouped.get(key) ?? {
      mode: 'audit_only',
      subject,
      topicTitle: signal.topicTitle,
      difficulty: signal.difficulty,
      family: signal.family,
      similaritySource: signal.similaritySource,
      count: 0,
      samplePairs: [],
      maxSimilarity: 0,
      textSimilarityTotal: 0,
      expressionSimilarityTotal: 0,
      recommendationCode: signal.similaritySource === 'expression_signature'
        ? 'scheduler_rotate_expression_template'
        : 'review_repeated_prompt_shell',
      productionImpact: 'none_audit_only',
      featureFlagRequired: null
    };
    entry.count += 1;
    if (entry.samplePairs.length < 5) entry.samplePairs.push(`${signal.candidateId}~${signal.nearestId}`);
    entry.maxSimilarity = Math.max(entry.maxSimilarity, Number(signal.similarity) || 0);
    entry.textSimilarityTotal += Number(signal.textSimilarity) || 0;
    entry.expressionSimilarityTotal += Number(signal.expressionSimilarity) || 0;
    grouped.set(key, entry);
  }
  return Array.from(grouped.values())
    .map((entry) => ({
      mode: entry.mode,
      subject: entry.subject,
      topicTitle: entry.topicTitle,
      difficulty: entry.difficulty,
      family: entry.family,
      similaritySource: entry.similaritySource,
      count: entry.count,
      samplePairs: entry.samplePairs,
      maxSimilarity: Number(entry.maxSimilarity.toFixed(3)),
      avgTextSimilarity: Number((entry.textSimilarityTotal / Math.max(1, entry.count)).toFixed(3)),
      avgExpressionSimilarity: Number((entry.expressionSimilarityTotal / Math.max(1, entry.count)).toFixed(3)),
      recommendationCode: entry.recommendationCode,
      recommendedAction: entry.recommendationCode === 'scheduler_rotate_expression_template'
        ? 'Prefer a different expression or formula skeleton before regenerating this cell.'
        : 'Prefer a different task family or prompt shell before regenerating this cell.',
      productionImpact: entry.productionImpact,
      featureFlagRequired: entry.featureFlagRequired
    }))
    .sort((left, right) => (
      right.count - left.count
      || right.maxSimilarity - left.maxSimilarity
      || cleanText(left.topicTitle).localeCompare(cleanText(right.topicTitle))
      || cleanText(left.family).localeCompare(cleanText(right.family))
    ))
    .slice(0, 12);
}

function schedulerHintPromptBudgetFor(hints) {
  const budgetChars = 520;
  const samples = arrayFrom(hints).map((hint) => {
    const preferredFamily = cleanText(hint.preferredFamily);
    const preferredFamilyLabel = cleanText(hint.preferredFamilyLabel);
    const preferredFamilyInstruction = cleanText(hint.preferredFamilyInstruction);
    const reason = cleanText(hint.reason);
    const targetProfileQuestionForm = cleanText(hint.targetProfileQuestionForm);
    const targetProfileCompatibility = cleanText(hint.targetProfileCompatibility);
    const avoidFamilies = arrayFrom(hint.avoidFamilies).map(cleanText).filter(Boolean).slice(0, 4);
    const avoidFamilyLabels = arrayFrom(hint.avoidFamilyLabels).map(cleanText).filter(Boolean).slice(0, 4);
    const preferredInstruction = preferredFamily
      ? `Scheduler hint: prefer ${preferredFamilyLabel || preferredFamily} (${preferredFamily})${reason ? ` because ${reason}` : ''}.`
      : '';
    const requiredSchedulerShape = preferredFamilyInstruction
      ? `Required scheduler shape: ${preferredFamilyInstruction}.`
      : '';
    const avoidInstruction = avoidFamilies.length
      ? `Scheduler hint: avoid recently covered families ${(avoidFamilyLabels.length ? avoidFamilyLabels : avoidFamilies).join(', ')}.`
      : '';
    const estimatedInstructionChars = cleanText(`${preferredInstruction} ${requiredSchedulerShape} ${avoidInstruction}`).length;
    const preferredAvoidConflict = Boolean(preferredFamily) && avoidFamilies.includes(preferredFamily);
    const targetProfileInstructionConflict = Boolean(targetProfileQuestionForm)
      && /judg(e)?ment/i.test(targetProfileQuestionForm)
      && /not a property-judg(e)?ment statement/i.test(preferredFamilyInstruction);
    const targetProfileCompatibilityMissing = Boolean(targetProfileQuestionForm)
      && targetProfileCompatibility !== 'target_profile_primary_scheduler_shape_secondary';
    return {
      topicTitle: hint.topicTitle,
      difficulty: hint.difficulty,
      preferredFamily,
      preferredFamilyLabel,
      targetProfileQuestionForm: targetProfileQuestionForm || null,
      targetProfileCompatibility: targetProfileCompatibility || null,
      avoidFamilyCount: avoidFamilies.length,
      estimatedInstructionChars,
      preferredAvoidConflict,
      targetProfileInstructionConflict,
      targetProfileCompatibilityMissing
    };
  });
  const overBudgetSamples = samples.filter((sample) => sample.estimatedInstructionChars > budgetChars);
  const conflictSamples = samples.filter((sample) => sample.preferredAvoidConflict);
  const targetProfileConflictSamples = samples.filter((sample) => sample.targetProfileInstructionConflict || sample.targetProfileCompatibilityMissing);
  return {
    mode: 'audit_only',
    budgetChars,
    maxEstimatedInstructionChars: samples.reduce((max, sample) => Math.max(max, sample.estimatedInstructionChars), 0),
    maxAvoidFamilyCount: samples.reduce((max, sample) => Math.max(max, sample.avoidFamilyCount), 0),
    overBudgetCount: overBudgetSamples.length,
    preferredAvoidConflictCount: conflictSamples.length,
    targetProfileConflictCount: targetProfileConflictSamples.length,
    productionImpact: 'none_audit_only',
    samples: [
      ...overBudgetSamples,
      ...conflictSamples.filter((sample) => !overBudgetSamples.includes(sample)),
      ...targetProfileConflictSamples.filter((sample) => !overBudgetSamples.includes(sample) && !conflictSamples.includes(sample))
    ].slice(0, 8)
  };
}

function schedulerHintDryRunFor(questions, subject, candidates = []) {
  if (subject !== 'math' || !subjectPracticeBuildSchedulerHint) return null;
  const groups = new Map();
  for (const question of questions.slice(0, 200)) {
    const topicTitle = cleanText(question.topicTitle);
    const difficulty = cleanText(question.difficulty);
    if (!topicTitle || !difficulty) continue;
    const key = `${topicTitle}|${difficulty}`;
    const entry = groups.get(key) ?? {
      mode: 'audit_only',
      subject,
      topicTitle,
      difficulty,
      acceptedCount: 0,
      acceptedFamilies: []
    };
    const targetProfile = recordFrom(recordFrom(question.generationMetadata)?.targetProfile);
    if (targetProfile && !entry.targetProfile) entry.targetProfile = targetProfile;
    entry.acceptedCount += 1;
    entry.acceptedFamilies.push(promptFamily(question.prompt, question));
    groups.set(key, entry);
  }
  for (const candidate of candidates.slice(0, 120)) {
    const topicTitle = cleanText(candidate.topicTitle);
    const difficulty = cleanText(candidate.difficulty);
    if (!topicTitle || !difficulty) continue;
    const key = `${topicTitle}|${difficulty}`;
    const entry = groups.get(key) ?? {
      mode: 'audit_only',
      subject,
      topicTitle,
      difficulty,
      acceptedCount: 0,
      acceptedFamilies: [],
      candidateFamilies: []
    };
    entry.candidateFamilies ??= [];
    const targetProfile = recordFrom(recordFrom(candidate.generationMetadata)?.targetProfile);
    if (targetProfile && !entry.targetProfile) entry.targetProfile = targetProfile;
    const family = promptFamily(candidate.prompt, candidate);
    if (family && family !== 'other' && family !== 'unclassified') entry.candidateFamilies.push(family);
    groups.set(key, entry);
  }
  const hints = [];
  for (const entry of groups.values()) {
    const hint = subjectPracticeBuildSchedulerHint({
      subject,
      topicTitle: entry.topicTitle,
      difficulty: entry.difficulty,
      targetProfile: entry.targetProfile ?? null,
      recentAcceptedFamilies: entry.acceptedFamilies,
      recentCandidateFamilies: entry.candidateFamilies ?? []
    });
    if (!hint) continue;
    hints.push({
      ...entry,
      schedulerPolicyVersion: hint.schedulerPolicyVersion,
      preferredFamily: hint.preferredFamily,
      preferredFamilyLabel: hint.preferredFamilyLabel,
      preferredFamilyInstruction: hint.preferredFamilyInstruction,
      targetProfileQuestionForm: hint.targetProfileQuestionForm,
      targetProfileCompatibility: hint.targetProfileCompatibility,
      avoidFamilies: hint.avoidFamilies,
      avoidFamilyLabels: hint.avoidFamilyLabels,
      reason: hint.reason,
      candidatePressureCount: arrayFrom(entry.candidateFamilies).length,
      candidatePressureFamilies: topEntries(arrayFrom(entry.candidateFamilies).reduce((map, family) => {
        const key = cleanText(family);
        if (key) map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map()), 6).map(([family, count]) => ({ family, count })),
      productionImpact: 'none_audit_only',
      providerFailurePolicy: 'not_used_recent_formal_published_families_only'
    });
  }
  return {
    mode: 'audit_only',
    subject,
    schedulerHintCount: hints.length,
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'not_used_recent_formal_published_families_only',
    promptBudget: schedulerHintPromptBudgetFor(hints),
    hints: hints
      .sort((left, right) => (
        right.acceptedCount - left.acceptedCount
        || cleanText(left.topicTitle).localeCompare(cleanText(right.topicTitle))
        || cleanText(left.difficulty).localeCompare(cleanText(right.difficulty))
      ))
      .slice(0, 12)
  };
}

function schedulerHintAdherenceFor(candidates, subject) {
  const scopedSubject = cleanText(subject).toLowerCase();
  if (scopedSubject !== 'math') return null;
  const currentSchedulerPolicyVersion = cleanText(SUBJECT_PRACTICE_SCHEDULER_POLICY_VERSION) || null;
  const observations = [];
  for (const candidate of candidates.slice(0, 200)) {
    const generationMetadata = recordFrom(candidate.generationMetadata);
    const schedulerHint = recordFrom(generationMetadata.schedulerHint);
    const preferredFamily = cleanText(schedulerHint.preferredFamily);
    if (!preferredFamily) continue;
    const avoidFamilies = arrayFrom(schedulerHint.avoidFamilies).map(cleanText).filter(Boolean);
    const family = promptFamily(candidate.prompt, candidate);
    if (!family || family === 'other' || family === 'unclassified') continue;
    const matchedPreferred = family === preferredFamily;
    const hitAvoidFamily = avoidFamilies.includes(family);
    const schedulerPolicyVersion = cleanText(schedulerHint.schedulerPolicyVersion) || cleanText(schedulerHint.policyVersion) || null;
    observations.push({
      id: Number(candidate.id),
      status: candidate.status,
      topicTitle: candidate.topicTitle,
      difficulty: candidate.difficulty,
      family,
      preferredFamily,
      avoidFamilies,
      matchedPreferred,
      hitAvoidFamily,
      schedulerPolicyVersion,
      currentSchedulerPolicyVersion,
      currentSchedulerPolicy: !currentSchedulerPolicyVersion || schedulerPolicyVersion === currentSchedulerPolicyVersion,
      reason: cleanText(schedulerHint.reason) || null,
      prompt: short(candidate.prompt, 180)
    });
  }
  const currentObservations = observations.filter((item) => item.currentSchedulerPolicy);
  const legacyObservations = observations.filter((item) => !item.currentSchedulerPolicy);
  const hintedCandidateCount = currentObservations.length;
  const preferredMatchCount = currentObservations.filter((item) => item.matchedPreferred).length;
  const avoidedFamilyHitCount = currentObservations.filter((item) => item.hitAvoidFamily).length;
  const preferredMatchRatio = hintedCandidateCount > 0
    ? Number((preferredMatchCount / hintedCandidateCount).toFixed(3))
    : 0;
  const avoidedFamilyHitRatio = hintedCandidateCount > 0
    ? Number((avoidedFamilyHitCount / hintedCandidateCount).toFixed(3))
    : 0;
  return {
    mode: 'audit_only',
    subject: 'math',
    candidateCount: candidates.length,
    currentSchedulerPolicyVersion,
    totalHintedCandidateCount: observations.length,
    hintedCandidateCount,
    legacyHintedCandidateCount: legacyObservations.length,
    preferredMatchCount,
    preferredMatchRatio,
    avoidedFamilyHitCount,
    avoidedFamilyHitRatio,
    status: hintedCandidateCount === 0
      ? 'pending_observation'
      : avoidedFamilyHitRatio >= 0.5
        ? 'needs_prompt_tuning'
        : 'observing',
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'provider_failures_do_not_emit_candidate_scheduler_adherence',
    studentConsumableScope: 'current_production_candidates_only_not_student_visible',
    samples: [
      ...currentObservations.filter((item) => item.hitAvoidFamily),
      ...currentObservations.filter((item) => item.matchedPreferred),
      ...currentObservations.filter((item) => !item.hitAvoidFamily && !item.matchedPreferred)
    ].slice(0, 12),
    legacySamples: [
      ...legacyObservations.filter((item) => item.hitAvoidFamily),
      ...legacyObservations.filter((item) => item.matchedPreferred),
      ...legacyObservations.filter((item) => !item.hitAvoidFamily && !item.matchedPreferred)
    ].slice(0, 8)
  };
}

function storedDiversityObservationSummaryFor(questions, subject) {
  const scopedSubject = cleanText(subject).toLowerCase();
  const observations = questions
    .map((question) => {
      const observation = recordFrom(recordFrom(question.reviewMetadata).subjectPracticeDiversityObservation);
      const decision = recordFrom(observation.taskFamilyDiversity);
      if (!Object.keys(decision).length) return null;
      return {
        id: Number(question.id),
        subject: scopedSubject,
        topicTitle: question.topicTitle,
        difficulty: question.difficulty,
        observedAt: observation.observedAt ?? null,
        source: cleanText(observation.source) || null,
        candidateFamily: cleanText(decision.candidateFamily) || null,
        reasonCode: cleanText(decision.reasonCode) || null,
        diversityWindowDecision: cleanText(decision.diversityWindowDecision) || null,
        diversityWindowReasons: arrayFrom(decision.diversityWindowReasons).map(cleanText).filter(Boolean),
        productionAction: cleanText(decision.productionAction) || null,
        productionDecisionScope: cleanText(decision.productionDecisionScope) || null,
        wouldRegenerateIfFlagEnabled: decision.wouldRegenerateIfFlagEnabled === true,
        featureFlag: cleanText(decision.featureFlag) || null,
        featureFlagEnabled: decision.featureFlagEnabled === true,
        providerFailurePolicy: cleanText(decision.providerFailurePolicy) || null,
        studentConsumableScope: cleanText(decision.studentConsumableScope) || null
      };
    })
    .filter(Boolean);
  const byAction = observations.reduce((map, observation) => {
    const key = observation.productionAction || 'unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  const byDecision = observations.reduce((map, observation) => {
    const key = observation.diversityWindowDecision || 'unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  return {
    mode: 'audit_only',
    subject: scopedSubject,
    observedCount: observations.length,
    observeOnlyCount: observations.filter((item) => item.productionAction === 'observe_only').length,
    regenerateActionCount: observations.filter((item) => item.productionAction === 'regenerate').length,
    wouldRegenerateIfFlagEnabledCount: observations.filter((item) => item.wouldRegenerateIfFlagEnabled).length,
    featureFlagEnabledCount: observations.filter((item) => item.featureFlagEnabled).length,
    productionImpact: 'none_audit_only_for_reporting',
    providerFailurePolicy: observations.find((item) => item.providerFailurePolicy)?.providerFailurePolicy
      ?? 'excluded_provider_and_schema_failures_not_counted_as_family_quality',
    byAction: topEntries(byAction, 8).map(([productionAction, count]) => ({ productionAction, count })),
    byDecision: topEntries(byDecision, 8).map(([decision, count]) => ({ decision, count })),
    samples: observations.slice(0, 12)
  };
}

function mathCandidateDiversityObservationReplayFor(candidates, acceptedQuestions, subject) {
  const featureFlag = 'CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED';
  const scopedSubject = cleanText(subject).toLowerCase();
  if (scopedSubject !== 'math' || !subjectPracticeEvaluateDiversityWindow) return null;
  const acceptedScoped = acceptedQuestions.slice(0, 500).map((question) => {
    const family = promptFamily(question.prompt, question);
    return {
      ...question,
      family,
      fingerprint: questionFingerprint(question, family)
    };
  }).filter((question) => question.family && question.family !== 'other' && question.family !== 'unclassified');
  const featureFlagEnabled = cleanText(process.env[featureFlag]).toLowerCase() === 'true';
  const observations = [];
  for (const candidate of candidates.slice(0, 120)) {
    const candidateFamily = promptFamily(candidate.prompt, candidate);
    if (!candidateFamily || candidateFamily === 'other' || candidateFamily === 'unclassified') continue;
    const candidateFingerprint = questionFingerprint(candidate, candidateFamily);
    const acceptedWindow = acceptedScoped.filter((item) => (
      cleanText(item.topicTitle) === cleanText(candidate.topicTitle)
      && cleanText(item.difficulty) === cleanText(candidate.difficulty)
    ));
    if (!acceptedWindow.length) continue;
    const decision = subjectPracticeEvaluateDiversityWindow({
      candidateFamily,
      acceptedFamilies: acceptedWindow.map((item) => item.family),
      candidateReasoningPath: candidateFingerprint.reasoningPath,
      acceptedReasoningPaths: acceptedWindow.map((item) => item.fingerprint.reasoningPath),
      targetCount: 8
    });
    const blockingReasons = arrayFrom(decision?.reasons).filter((reason) => cleanText(reason) === 'task_family_recent_window_cap');
    const wouldRegenerateIfFlagEnabled = decision?.decision === 'regenerate' && blockingReasons.length > 0;
    observations.push({
      id: Number(candidate.id),
      status: candidate.status,
      topicTitle: candidate.topicTitle,
      difficulty: candidate.difficulty,
      family: candidateFamily,
      acceptedCount: decision.acceptedCount,
      acceptedFamilyCount: decision.acceptedFamilyCount,
      recentFamilyCount: decision.recentFamilyCount,
      nextFamilyShare: decision.nextFamilyShare,
      diversityWindowDecision: decision.decision,
      diversityWindowReasons: decision.reasons,
      blockingReasons,
      auditOnlyReasons: arrayFrom(decision.reasons).filter((reason) => cleanText(reason) === 'reasoning_path_repeated'),
      repeatedReasoningPath: decision.repeatedReasoningPath,
      wouldRegenerateIfFlagEnabled,
      productionActionWithCurrentFlag: wouldRegenerateIfFlagEnabled && featureFlagEnabled ? 'regenerate' : 'observe_only',
      featureFlag,
      featureFlagEnabled,
      productionDecisionScope: 'task_family_recent_window_cap_only',
      providerFailurePolicy: 'excluded_provider_and_schema_failures_not_counted_as_family_quality',
      studentConsumableScope: 'formal_published_subject_practice_window_only',
      prompt: short(candidate.prompt, 180)
    });
  }
  const byAction = observations.reduce((map, observation) => {
    const key = observation.productionActionWithCurrentFlag || 'unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  const byDecision = observations.reduce((map, observation) => {
    const key = observation.diversityWindowDecision || 'unknown';
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  return {
    mode: 'audit_only',
    subject: 'math',
    featureFlag,
    featureFlagEnabled,
    candidateCount: candidates.length,
    evaluatedCount: observations.length,
    wouldRegenerateIfFlagEnabledCount: observations.filter((item) => item.wouldRegenerateIfFlagEnabled).length,
    currentFlagRegenerateCount: observations.filter((item) => item.productionActionWithCurrentFlag === 'regenerate').length,
    observeOnlyCount: observations.filter((item) => item.productionActionWithCurrentFlag === 'observe_only').length,
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'excluded_provider_and_schema_failures_not_counted_as_family_quality',
    studentConsumableScope: 'formal_published_subject_practice_window_only',
    byAction: topEntries(byAction, 8).map(([productionActionWithCurrentFlag, count]) => ({ productionActionWithCurrentFlag, count })),
    byDecision: topEntries(byDecision, 8).map(([decision, count]) => ({ decision, count })),
    samples: [
      ...observations.filter((item) => item.wouldRegenerateIfFlagEnabled),
      ...observations.filter((item) => !item.wouldRegenerateIfFlagEnabled)
    ].slice(0, 12)
  };
}

function diversityEngineReadinessFor(input) {
  const subject = cleanText(input.subject);
  const familyCoverage = input.familyCoverage ?? {};
  const knownFamilyRatio = Number(familyCoverage.knownFamilyRatio) || 0;
  const otherCount = Number(familyCoverage.otherCount) || 0;
  const totalQuestionCount = Number(familyCoverage.totalQuestionCount) || 0;
  const familyCoverageSource = cleanText(familyCoverage.coverageSource) || 'recent_formal_window';
  const p0p1 = arrayFrom(input.p0p1);
  const operationalP0P1 = p0p1.filter((item) => /^stored_active_job_count_/i.test(cleanText(item)));
  const qualityP0P1 = p0p1.filter((item) => !/^stored_active_job_count_/i.test(cleanText(item)));
  const studentPoolImpact = input.studentPoolImpact ?? {};
  const difficultyAuditFindings = arrayFrom(input.difficultyAuditFindings);
  const physicsDifficultyQualityAudit = input.physicsDifficultyQualityAudit ?? null;
  const mathSchedulerHintQualityAudit = input.mathSchedulerHintQualityAudit ?? null;
  const mathQuestionPlanShadow = input.mathQuestionPlanShadow ?? null;
  const physicsQuestionPlanShadow = input.physicsQuestionPlanShadow ?? null;
  const physicsQuestionPlanShadowSamples = arrayFrom(physicsQuestionPlanShadow?.samples);
  const physicsQuestionPlanShadowClassifiedCount = physicsQuestionPlanShadowSamples.filter((sample) => {
    const family = cleanText(sample?.family);
    const verdict = cleanText(sample?.verdict);
    return family && family !== 'other' && /^candidate_matches_/.test(verdict);
  }).length;
  const physicsQuestionPlanShadowClassifierReady = physicsQuestionPlanShadowSamples.length >= 3
    && physicsQuestionPlanShadowClassifiedCount === physicsQuestionPlanShadowSamples.length;
  const phases = [];
  phases.push({
    phase: 'phase_1_family_visibility',
    status: totalQuestionCount === 0
      ? 'insufficient_window'
      : knownFamilyRatio >= 0.95 && otherCount === 0
        ? 'ready'
        : knownFamilyRatio >= 0.9
          ? 'monitor'
          : 'needs_classifier_work',
    evidence: {
      knownFamilyRatio,
      otherCount,
      totalQuestionCount,
      coverageSource: familyCoverageSource
    }
  });
  if (subject === 'chemistry') {
    phases.push({
      phase: 'phase_3_chemistry_regression_protection',
      status: qualityP0P1.length ? 'needs_attention' : 'protected',
      evidence: {
        p0p1,
        operationalP0P1,
        qualityP0P1,
        currentPolicyImpact: 'none_from_math_physics_changes'
      }
    });
  }
  if (subject === 'physics') {
    const physicsDifficultyFindingCount = difficultyAuditFindings.length;
    const visiblePhysicsDifficultyFindingCount = Number(studentPoolImpact.visibleDifficultyBlockerCount) || 0;
    const currentPolicyBlockedPhysicsDifficultyFindingCount = Number(studentPoolImpact.currentPolicyBlockedDifficultyBlockerCount) || 0;
    const hardDirectFormulaFindingCount = difficultyAuditFindings.filter((finding) => cleanText(finding.reasonCode) === 'physics_hard_direct_formula_task_family').length;
    phases.push({
      phase: 'phase_4_physics_visibility',
      status: totalQuestionCount > 0 && knownFamilyRatio >= 0.98 && otherCount === 0
        ? 'ready'
        : totalQuestionCount === 0 && physicsQuestionPlanShadowClassifierReady
          ? 'needs_guarded_observation_window'
          : 'needs_classifier_work',
      evidence: {
        knownFamilyRatio,
        otherCount,
        totalQuestionCount,
        coverageSource: familyCoverageSource,
        shadowSampleCount: physicsQuestionPlanShadowSamples.length,
        shadowClassifiedCount: physicsQuestionPlanShadowClassifiedCount,
        shadowClassifierReady: physicsQuestionPlanShadowClassifierReady,
        evidenceBoundary: totalQuestionCount === 0
          ? 'guarded_shadow_candidates_only_no_formal_window'
          : 'formal_subject_practice_window',
        blockerPolicy: 'audit_only_visibility'
      }
    });
    phases.push({
      phase: 'phase_4_physics_difficulty_watch',
      status: physicsDifficultyFindingCount > 0
        ? Number(physicsDifficultyQualityAudit?.reviewedCount) >= physicsDifficultyFindingCount
          ? Number(physicsDifficultyQualityAudit?.truePositiveCount) > 0
            ? 'quality_sampling_complete_with_findings'
            : 'quality_sampling_complete_no_confirmed_issue'
          : Number(physicsDifficultyQualityAudit?.reviewedCount) > 0
            ? 'quality_sampling_in_progress'
          : 'quality_sampling_required'
        : 'clear',
      evidence: {
        difficultyFindingCount: physicsDifficultyFindingCount,
        hardDirectFormulaFindingCount,
        visibleDifficultyFindingCount: visiblePhysicsDifficultyFindingCount,
        currentPolicyBlockedDifficultyFindingCount: currentPolicyBlockedPhysicsDifficultyFindingCount,
        qualityAuditSampledCount: Number(physicsDifficultyQualityAudit?.reviewedCount) || 0,
        qualityAuditTruePositiveCount: Number(physicsDifficultyQualityAudit?.truePositiveCount) || 0,
        qualityAuditFalsePositiveCount: Number(physicsDifficultyQualityAudit?.falsePositiveCount) || 0,
        qualityAuditCorrectnessIssueCount: Number(physicsDifficultyQualityAudit?.correctnessIssueCount) || 0,
        qualityAuditUsabilityIssueCount: Number(physicsDifficultyQualityAudit?.usabilityIssueCount) || 0,
        qualityAuditHardRubricIssueCount: Number(physicsDifficultyQualityAudit?.hardRubricIssueCount) || 0,
        hardRubricCalibration: physicsDifficultyQualityAudit?.hardRubricCalibration ?? null,
        nextActions: arrayFrom(physicsDifficultyQualityAudit?.nextActions).map((action) => action.code).filter(Boolean),
        enablementGuardrails: physicsDifficultyQualityAudit?.enablementGuardrails ?? null,
        productionImpact: 'none_audit_only',
        blockerPolicy: 'audit_only_visibility',
        studentConsumableScope: 'adaptive_candidate_visible_audit_only_not_current_policy_blocked'
      }
    });
    phases.push({
      phase: 'phase_7_physics_question_plan_shadow',
      status: physicsQuestionPlanShadow
        && physicsQuestionPlanShadow.productionImpact === 'none_audit_only'
        && physicsQuestionPlanShadow.providerImpact === 'none_no_provider_call'
        && physicsQuestionPlanShadow.subjectBoundary === 'physics_basic_kinematics_guarded_allowlist_available_other_families_shadow'
        && physicsQuestionPlanShadow.gateApplicability === 'basic_kinematics_guarded_allowlist_available_subjectPracticeQuestionPlanGateFor_other_families_shadow'
          ? 'audit_ready'
          : 'missing_shadow',
      evidence: physicsQuestionPlanShadow
        ? {
          mode: physicsQuestionPlanShadow.mode,
          featureFlag: physicsQuestionPlanShadow.featureFlag,
          featureFlagEnabled: physicsQuestionPlanShadow.featureFlagEnabled,
          applicableCellCount: physicsQuestionPlanShadow.applicableCellCount,
          sampleCount: physicsQuestionPlanShadow.sampleCount,
          targetMatching: physicsQuestionPlanShadow.targetMatching,
          productionImpact: physicsQuestionPlanShadow.productionImpact,
          providerImpact: physicsQuestionPlanShadow.providerImpact,
          subjectBoundary: physicsQuestionPlanShadow.subjectBoundary,
          gateApplicability: physicsQuestionPlanShadow.gateApplicability,
          providerFailurePolicy: physicsQuestionPlanShadow.providerFailurePolicy,
          verdictCounts: physicsQuestionPlanShadow.verdictCounts ?? []
        }
        : {}
    });
  }
  if (subject === 'math') {
    const softCapCalibration = input.mathSoftCapDryRun?.calibration ?? null;
    const candidateReplay = input.candidateDiversityObservationReplay ?? null;
    const candidateReplayEvaluatedCount = Number(candidateReplay?.evaluatedCount) || 0;
    const candidateReplayWouldRegenerateCount = Number(candidateReplay?.wouldRegenerateIfFlagEnabledCount) || 0;
    const candidateReplayRatio = candidateReplayEvaluatedCount > 0
      ? Number((candidateReplayWouldRegenerateCount / candidateReplayEvaluatedCount).toFixed(3))
      : 0;
    phases.push({
      phase: 'phase_2_math_soft_cap',
      status: softCapCalibration
        ? softCapCalibration.productionFlagEnabled
          ? 'enabled_observe'
          : softCapCalibration.incrementalUnreviewedCount > 0
            ? 'calibrated_default_off_quality_audit_required'
            : 'eligible_for_guarded_default_off_smoke'
        : 'missing_calibration',
      evidence: softCapCalibration
        ? {
          featureFlag: softCapCalibration.featureFlag,
          productionFlagEnabled: softCapCalibration.productionFlagEnabled,
          incrementalCount: softCapCalibration.incrementalCount,
          incrementalReviewedCount: softCapCalibration.incrementalReviewedCount,
          incrementalUnreviewedCount: softCapCalibration.incrementalUnreviewedCount,
          incrementalNearDuplicateSupportCount: softCapCalibration.incrementalNearDuplicateSupportCount,
          recommendationCode: softCapCalibration.recommendationCode
        }
        : {}
    });
    phases.push({
      phase: 'phase_2_math_candidate_replay_guardrail',
      status: candidateReplay
        ? candidateReplay.currentFlagRegenerateCount > 0
          ? 'needs_attention'
          : candidateReplayEvaluatedCount > 0 && candidateReplayRatio >= 0.5
            ? 'observe_before_flag_enable'
            : 'ready_for_guarded_flag_smoke'
        : 'missing_calibration',
      evidence: candidateReplay
        ? {
          candidateCount: candidateReplay.candidateCount,
          evaluatedCount: candidateReplayEvaluatedCount,
          wouldRegenerateIfFlagEnabledCount: candidateReplayWouldRegenerateCount,
          wouldRegenerateIfFlagEnabledRatio: candidateReplayRatio,
          currentFlagRegenerateCount: candidateReplay.currentFlagRegenerateCount,
          productionImpact: candidateReplay.productionImpact,
          providerFailurePolicy: candidateReplay.providerFailurePolicy
        }
        : {}
    });
    phases.push({
      phase: 'phase_5_math_scheduler_hint',
      status: input.schedulerHintDryRun?.productionImpact === 'none_audit_only'
        ? Number(input.schedulerHintDryRun?.promptBudget?.overBudgetCount) > 0
          || Number(input.schedulerHintDryRun?.promptBudget?.preferredAvoidConflictCount) > 0
            ? 'needs_prompt_tuning'
            : 'audit_ready'
        : 'missing_dry_run',
      evidence: input.schedulerHintDryRun
        ? {
          schedulerHintCount: input.schedulerHintDryRun.schedulerHintCount,
          promptBudget: input.schedulerHintDryRun.promptBudget ?? null,
          productionImpact: input.schedulerHintDryRun.productionImpact,
          providerFailurePolicy: input.schedulerHintDryRun.providerFailurePolicy
        }
        : {}
    });
    phases.push({
      phase: 'phase_5_math_scheduler_hint_adherence',
      status: input.schedulerHintAdherence?.productionImpact === 'none_audit_only'
        ? input.schedulerHintAdherence.status
        : 'missing_calibration',
      evidence: input.schedulerHintAdherence
        ? {
          candidateCount: input.schedulerHintAdherence.candidateCount,
          currentSchedulerPolicyVersion: input.schedulerHintAdherence.currentSchedulerPolicyVersion ?? null,
          totalHintedCandidateCount: input.schedulerHintAdherence.totalHintedCandidateCount ?? input.schedulerHintAdherence.hintedCandidateCount,
          hintedCandidateCount: input.schedulerHintAdherence.hintedCandidateCount,
          legacyHintedCandidateCount: input.schedulerHintAdherence.legacyHintedCandidateCount ?? 0,
          preferredMatchCount: input.schedulerHintAdherence.preferredMatchCount,
          preferredMatchRatio: input.schedulerHintAdherence.preferredMatchRatio,
          avoidedFamilyHitCount: input.schedulerHintAdherence.avoidedFamilyHitCount,
          avoidedFamilyHitRatio: input.schedulerHintAdherence.avoidedFamilyHitRatio,
          qualityAuditSampledCount: Number(mathSchedulerHintQualityAudit?.reviewedCount) || 0,
          qualityAuditMechanismPositiveCount: Number(mathSchedulerHintQualityAudit?.mechanismPositiveCount) || 0,
          qualityAuditGateHeldCount: Number(mathSchedulerHintQualityAudit?.gateHeldCount) || 0,
          productionImpact: input.schedulerHintAdherence.productionImpact,
          providerFailurePolicy: input.schedulerHintAdherence.providerFailurePolicy
        }
        : {}
    });
    phases.push({
      phase: 'phase_7_math_question_plan_shadow',
      status: mathQuestionPlanShadow
        && mathQuestionPlanShadow.productionImpact === 'none_audit_only'
        && mathQuestionPlanShadow.providerImpact === 'none_no_provider_call'
        && mathQuestionPlanShadow.gateApplicability === 'guarded_allowlist_available_subjectPracticeQuestionPlanGateFor'
          ? 'audit_ready'
          : 'missing_shadow',
      evidence: mathQuestionPlanShadow
        ? {
          mode: mathQuestionPlanShadow.mode,
          featureFlag: mathQuestionPlanShadow.featureFlag,
          featureFlagEnabled: mathQuestionPlanShadow.featureFlagEnabled,
          applicableCellCount: mathQuestionPlanShadow.applicableCellCount,
          sampleCount: mathQuestionPlanShadow.sampleCount,
          targetMatching: mathQuestionPlanShadow.targetMatching,
          productionImpact: mathQuestionPlanShadow.productionImpact,
          providerImpact: mathQuestionPlanShadow.providerImpact,
          subjectBoundary: mathQuestionPlanShadow.subjectBoundary,
          gateApplicability: mathQuestionPlanShadow.gateApplicability,
          providerFailurePolicy: mathQuestionPlanShadow.providerFailurePolicy,
          verdictCounts: mathQuestionPlanShadow.verdictCounts ?? []
        }
        : {}
    });
  }
  const nearDuplicateCalibration = input.nearDuplicateCalibration ?? null;
  phases.push({
    phase: 'phase_6_near_duplicate_fallback',
    status: nearDuplicateCalibration
      && nearDuplicateCalibration.productionImpact === 'none_audit_only'
      && nearDuplicateCalibration.currentPolicyImpact === 'none'
      ? 'audit_ready'
      : 'missing_calibration',
    evidence: nearDuplicateCalibration
      ? {
        signalCount: nearDuplicateCalibration.signalCount,
        signalRatio: nearDuplicateCalibration.signalRatio,
        maxSimilarity: nearDuplicateCalibration.maxSimilarity,
        productionImpact: nearDuplicateCalibration.productionImpact,
        currentPolicyImpact: nearDuplicateCalibration.currentPolicyImpact,
        providerFailurePolicy: nearDuplicateCalibration.providerFailurePolicy
      }
      : {}
  });
  if (subject === 'math') {
    const visibleDifficultyBlockerCount = Number(studentPoolImpact.visibleDifficultyBlockerCount) || 0;
    const currentPolicyBlockedDifficultyBlockerCount = Number(studentPoolImpact.currentPolicyBlockedDifficultyBlockerCount) || 0;
    const dbAdaptiveEligibleDifficultyBlockerCount = Number(studentPoolImpact.dbAdaptiveEligibleDifficultyBlockerCount) || 0;
    phases.push({
      phase: 'student_consumable_current_policy_boundary',
      status: visibleDifficultyBlockerCount > 0
        ? 'needs_attention'
        : currentPolicyBlockedDifficultyBlockerCount > 0
          ? 'protected_by_current_policy'
          : 'clear',
      evidence: {
        visibleDifficultyBlockerCount,
        currentPolicyBlockedDifficultyBlockerCount,
        dbAdaptiveEligibleDifficultyBlockerCount,
        studentConsumableScope: 'adaptive_candidate_visible_after_current_policy_filter',
        formalPublishedScope: 'formal_published_subject_practice_window'
      }
    });
  }
  const blockingStatuses = new Set(['needs_classifier_work', 'missing_calibration', 'needs_attention']);
  const status = phases.some((phase) => blockingStatuses.has(phase.status))
    ? 'needs_work'
    : phases.some((phase) => /quality_audit|required|observe|prompt_tuning/.test(phase.status))
      ? 'calibrated_with_guardrails'
      : 'ready_for_next_phase';
  return {
    mode: 'audit_only',
    subject,
    status,
    productionImpact: 'none_audit_only',
    providerFailurePolicy: 'excluded_from_diversity_quality_memory',
    phases
  };
}

function mathSoftCapDryRunFor(questions, subject, nearDuplicateSignals = [], qualityAuditLedger = null) {
  const featureFlag = 'CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED';
  if (subject !== 'math' || !subjectPracticeEvaluateDiversityWindow) return null;
  const scoped = questions.slice(0, 200).map((question) => {
    const family = promptFamily(question.prompt, question);
    return {
      ...question,
      family,
      fingerprint: questionFingerprint(question, family)
    };
  });
  const { signals, evaluatedCount } = mathSoftCapSignalsForScoped(scoped, featureFlag);
  return summarizeMathSoftCapDryRun(signals, evaluatedCount, featureFlag, nearDuplicateSignals, qualityAuditLedger);
}

function mathSoftCapSignalsForScoped(scoped, featureFlag) {
  const signals = [];
  let evaluatedCount = 0;
  for (let index = 0; index < scoped.length; index += 1) {
    const candidate = scoped[index];
    if (!candidate.family || candidate.family === 'other') continue;
    const olderSameWindow = scoped.slice(index + 1).filter((item) => (
      cleanText(item.topicTitle) === cleanText(candidate.topicTitle)
      && cleanText(item.difficulty) === cleanText(candidate.difficulty)
      && item.family
      && item.family !== 'other'
    ));
    if (!olderSameWindow.length) continue;
    evaluatedCount += 1;
    const decision = subjectPracticeEvaluateDiversityWindow({
      candidateFamily: candidate.family,
      acceptedFamilies: olderSameWindow.map((item) => item.family),
      candidateReasoningPath: candidate.fingerprint.reasoningPath,
      acceptedReasoningPaths: olderSameWindow.map((item) => item.fingerprint.reasoningPath),
      targetCount: 8
    });
    const softCapReasons = arrayFrom(decision?.reasons).filter((reason) => [
      'task_family_recent_window_cap',
      'reasoning_path_repeated'
    ].includes(cleanText(reason)));
    if (decision?.decision !== 'regenerate' || !softCapReasons.length) continue;
    const productionSoftCapReasons = softCapReasons.filter((reason) => reason === 'task_family_recent_window_cap');
    const legacyGateReason = arrayFrom(decision.reasons).includes('task_family_overrepresented')
      ? 'subject_practice_task_family_overrepresented'
      : null;
    signals.push({
      id: Number(candidate.id),
      topicTitle: candidate.topicTitle,
      difficulty: candidate.difficulty,
      family: candidate.family,
      acceptedCount: decision.acceptedCount,
      acceptedFamilyCount: decision.acceptedFamilyCount,
      recentFamilyCount: decision.recentFamilyCount,
      nextFamilyShare: decision.nextFamilyShare,
      decision: decision.decision,
      reasons: decision.reasons,
      softCapReasons,
      productionSoftCapReasons,
      legacyGateReason,
      incrementalIfFlagEnabled: !legacyGateReason && productionSoftCapReasons.length > 0,
      repeatedReasoningPath: decision.repeatedReasoningPath,
      featureFlag,
      wouldRegenerateIfFlagEnabled: productionSoftCapReasons.length > 0,
      prompt: short(candidate.prompt, 180)
    });
  }
  return { signals, evaluatedCount };
}

function summarizeMathSoftCapDryRun(signals, evaluatedCount, featureFlag, nearDuplicateSignals = [], qualityAuditLedger = null) {
  const byReason = signals.reduce((map, signal) => {
    for (const reason of signal.softCapReasons) map.set(reason, (map.get(reason) ?? 0) + 1);
    return map;
  }, new Map());
  const byTopicDifficulty = signals.reduce((map, signal) => {
    const key = `${cleanText(signal.topicTitle)}|${cleanText(signal.difficulty)}`;
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  return {
    mode: 'audit_only',
    featureFlag,
    productionFlagEnabled: cleanText(process.env[featureFlag]).toLowerCase() === 'true',
    evaluatedCount,
    auditSignalCount: signals.length,
    wouldRegenerateCount: signals.filter((signal) => signal.wouldRegenerateIfFlagEnabled).length,
    legacyRegenerateCount: signals.filter((signal) => signal.legacyGateReason && signal.wouldRegenerateIfFlagEnabled).length,
    incrementalWouldRegenerateCount: signals.filter((signal) => signal.incrementalIfFlagEnabled).length,
    byReason: topEntries(byReason, 8).map(([reason, count]) => ({ reason, count })),
    byTopicDifficulty: topEntries(byTopicDifficulty, 10).map(([key, count]) => {
      const [topicTitle, difficulty] = key.split('|');
      return { topicTitle, difficulty, count };
    }),
    signals: [
      ...signals.filter((signal) => signal.incrementalIfFlagEnabled),
      ...signals.filter((signal) => !signal.incrementalIfFlagEnabled)
    ].slice(0, 20),
    calibration: mathSoftCapCalibrationFor(signals, evaluatedCount, featureFlag, nearDuplicateSignals, qualityAuditLedger)
  };
}

function mathSchedulerHintQualityAuditByQuestionId(qualityAuditLedger) {
  const samplesByQuestionId = new Map();
  for (const reviewValue of qualityAuditSamplesFrom(qualityAuditLedger)) {
    const review = recordFrom(reviewValue);
    if (cleanText(review.subject).toLowerCase() !== 'math') continue;
    if (cleanText(review.reviewType) !== 'math_scheduler_hint_observation_sample') continue;
    const questionId = Number(review.questionId);
    if (!Number.isFinite(questionId)) continue;
    samplesByQuestionId.set(questionId, {
      subject: 'math',
      reviewType: 'math_scheduler_hint_observation_sample',
      questionId,
      decision: cleanText(review.decision),
      reviewedAt: cleanText(review.reviewedAt) || null,
      evidence: recordFrom(review.evidence),
      notes: short(review.notes, 220)
    });
  }
  return samplesByQuestionId;
}

function mathSchedulerHintQualityAuditSummary(schedulerHintAdherence, qualityAuditLedger) {
  const adherence = recordFrom(schedulerHintAdherence);
  if (!adherence || cleanText(adherence.subject) !== 'math') return null;
  const qualityAuditByQuestionId = mathSchedulerHintQualityAuditByQuestionId(qualityAuditLedger);
  const samples = arrayFrom(adherence.samples).map((sample) => ({
    sample: recordFrom(sample),
    qualityAudit: qualityAuditByQuestionId.get(Number(recordFrom(sample)?.id)) ?? null
  }));
  const reviewed = samples.filter((item) => item.qualityAudit);
  const mechanismPositiveDecisions = new Set([
    'true_positive_preferred_family_match_gate_held',
    'true_positive_preferred_family_match_published',
    'acceptable_preferred_family_match'
  ]);
  const gateHeldDecisions = new Set([
    'true_positive_preferred_family_match_gate_held',
    'acceptable_preferred_family_match_gate_held'
  ]);
  return {
    mode: 'audit_only_quality_sampling',
    reviewType: 'math_scheduler_hint_observation_sample',
    qualityAuditLedger: diversityQualityAuditLedgerSummary(qualityAuditLedger),
    hintedCandidateCount: Number(adherence.hintedCandidateCount) || 0,
    reviewedCount: reviewed.length,
    unreviewedCount: Math.max(0, (Number(adherence.hintedCandidateCount) || 0) - reviewed.length),
    mechanismPositiveCount: reviewed.filter((item) => mechanismPositiveDecisions.has(cleanText(item.qualityAudit.decision))).length,
    gateHeldCount: reviewed.filter((item) => gateHeldDecisions.has(cleanText(item.qualityAudit.decision))).length,
    productionImpact: 'none_audit_only',
    studentConsumableScope: 'current_production_candidates_only_not_student_visible',
    samples: reviewed.slice(0, 8).map((item) => ({
      id: Number(item.sample?.id) || null,
      status: cleanText(item.sample?.status) || null,
      topicTitle: item.sample?.topicTitle ?? null,
      difficulty: item.sample?.difficulty ?? null,
      family: item.sample?.family ?? null,
      preferredFamily: item.sample?.preferredFamily ?? null,
      avoidFamilies: arrayFrom(item.sample?.avoidFamilies),
      matchedPreferred: item.sample?.matchedPreferred === true,
      hitAvoidFamily: item.sample?.hitAvoidFamily === true,
      qualityAudit: item.qualityAudit,
      prompt: item.sample?.prompt ?? null
    }))
  };
}

function nearDuplicateSupportByQuestionId(signals) {
  const support = new Map();
  for (const signal of signals) {
    for (const id of [Number(signal.candidateId), Number(signal.nearestId)]) {
      if (!Number.isFinite(id)) continue;
      const entries = support.get(id) ?? [];
      if (entries.length < 4) {
        entries.push({
          candidateId: signal.candidateId,
          nearestId: signal.nearestId,
          similarity: signal.similarity,
          similaritySource: signal.similaritySource,
          family: signal.family,
          reasonCode: signal.reasonCode
        });
      }
      support.set(id, entries);
    }
  }
  return support;
}

function mathSoftCapQualityAuditByQuestionId(qualityAuditLedger) {
  const samplesByQuestionId = new Map();
  for (const reviewValue of qualityAuditSamplesFrom(qualityAuditLedger)) {
    const review = recordFrom(reviewValue);
    if (cleanText(review.subject).toLowerCase() !== 'math') continue;
    if (cleanText(review.reviewType) !== 'math_soft_cap_incremental_sample') continue;
    const questionId = Number(review.questionId);
    if (!Number.isFinite(questionId)) continue;
    samplesByQuestionId.set(questionId, {
      subject: 'math',
      reviewType: 'math_soft_cap_incremental_sample',
      questionId,
      nearestQuestionId: Number.isFinite(Number(review.nearestQuestionId)) ? Number(review.nearestQuestionId) : null,
      decision: cleanText(review.decision),
      reviewedAt: cleanText(review.reviewedAt) || null,
      evidence: recordFrom(review.evidence),
      notes: short(review.notes, 220)
    });
  }
  return samplesByQuestionId;
}

function mathSoftCapQualityAuditAccepted(review) {
  return new Set([
    'true_positive_repeated_shell',
    'true_positive_overrepresented_family',
    'acceptable_to_guarded_smoke'
  ]).has(cleanText(recordFrom(review).decision));
}

function physicsDifficultyQualityAuditByQuestionId(qualityAuditLedger) {
  const samplesByQuestionId = new Map();
  for (const reviewValue of qualityAuditSamplesFrom(qualityAuditLedger)) {
    const review = recordFrom(reviewValue);
    if (cleanText(review.subject).toLowerCase() !== 'physics') continue;
    if (cleanText(review.reviewType) !== 'physics_difficulty_watch_sample') continue;
    const questionId = Number(review.questionId);
    if (!Number.isFinite(questionId)) continue;
    samplesByQuestionId.set(questionId, {
      subject: 'physics',
      reviewType: 'physics_difficulty_watch_sample',
      questionId,
      decision: cleanText(review.decision),
      reviewedAt: cleanText(review.reviewedAt) || null,
      evidence: recordFrom(review.evidence),
      notes: short(review.notes, 220)
    });
  }
  return samplesByQuestionId;
}

function physicsHardRubricCalibrationFor(reviewedHardRubricIssues, reviewedFalsePositives) {
  const truePositiveFamilyCounts = reviewedHardRubricIssues.reduce((map, item) => {
    const family = cleanText(item.finding.family) || 'other';
    map.set(family, (map.get(family) ?? 0) + 1);
    return map;
  }, new Map());
  const falsePositiveFamilyCounts = reviewedFalsePositives.reduce((map, item) => {
    const family = cleanText(item.finding.family) || 'other';
    map.set(family, (map.get(family) ?? 0) + 1);
    return map;
  }, new Map());
  const truePositiveIssueCounts = reviewedHardRubricIssues.reduce((map, item) => {
    const issueCode = cleanText(item.qualityAudit?.evidence?.issueCode) || cleanText(item.finding.reasonCode) || 'unknown';
    map.set(issueCode, (map.get(issueCode) ?? 0) + 1);
    return map;
  }, new Map());
  return {
    mode: 'audit_only_physics_hard_rubric_calibration',
    productionImpact: 'none_audit_only',
    blockerPolicy: 'no_physics_difficulty_blocking_without_subject_flag_and_pool_impact_smoke',
    truePositiveHardRubricIssueCount: reviewedHardRubricIssues.length,
    falsePositiveAcceptableHardCount: reviewedFalsePositives.length,
    highRiskFamilies: topEntries(truePositiveFamilyCounts, 8).map(([family, count]) => ({ family, count })),
    acceptableDirectFormulaFamilies: topEntries(falsePositiveFamilyCounts, 8).map(([family, count]) => ({ family, count })),
    truePositiveIssueCodes: topEntries(truePositiveIssueCounts, 8).map(([issueCode, count]) => ({ issueCode, count })),
    hardEvidenceRequired: [
      'multi_step_model_construction',
      'nontrivial_constraint_combination',
      'direction_or_sign_reasoning',
      'graph_or_experiment_interpretation_beyond_one_read',
      'cross_topic_energy_momentum_field_or_circuit_reasoning'
    ],
    directFormulaWarningOnly: 'A direct-formula physics family is an audit warning, not a blocker, unless offline samples show it lacks hard evidence and a later subject-specific feature flag passes pool-impact smoke.',
    providerFailurePolicy: 'provider_and_gateway_delivery_failures_excluded_from_physics_rubric_memory'
  };
}

function physicsDifficultyQualityAuditSummary(findings, qualityAuditLedger) {
  const qualityAuditByQuestionId = physicsDifficultyQualityAuditByQuestionId(qualityAuditLedger);
  const findingsWithReview = findings.map((finding) => ({
    finding,
    qualityAudit: qualityAuditByQuestionId.get(Number(finding.id)) ?? null
  }));
  const reviewed = findingsWithReview.filter((item) => item.qualityAudit);
  const truePositiveDecisions = new Set([
    'true_positive_hard_too_simple',
    'true_positive_physics_model_error',
    'true_positive_unbacked_visual_reference',
    'true_positive_difficulty_drift'
  ]);
  const falsePositiveDecisions = new Set([
    'false_positive_hard_multistep_acceptable',
    'false_positive_hard_context_acceptable'
  ]);
  const reviewedTruePositives = reviewed.filter((item) => truePositiveDecisions.has(cleanText(item.qualityAudit.decision)));
  const reviewedFalsePositives = reviewed.filter((item) => falsePositiveDecisions.has(cleanText(item.qualityAudit.decision)));
  const reviewedCorrectnessIssues = reviewed.filter((item) => cleanText(item.qualityAudit.decision) === 'true_positive_physics_model_error');
  const reviewedUsabilityIssues = reviewed.filter((item) => cleanText(item.qualityAudit.decision) === 'true_positive_unbacked_visual_reference');
  const reviewedHardRubricIssues = reviewedTruePositives.filter((item) => [
    'true_positive_hard_too_simple',
    'true_positive_difficulty_drift'
  ].includes(cleanText(item.qualityAudit.decision)));
  const hardRubricCalibration = physicsHardRubricCalibrationFor(reviewedHardRubricIssues, reviewedFalsePositives);
  const familyCounts = reviewedTruePositives.reduce((map, item) => {
    const family = cleanText(item.finding.family) || 'other';
    map.set(family, (map.get(family) ?? 0) + 1);
    return map;
  }, new Map());
  const topTruePositiveFamilies = topEntries(familyCounts, 8).map(([family, count]) => ({ family, count }));
  const nextActions = [];
  if (reviewedHardRubricIssues.length > 0) {
    nextActions.push({
      code: 'physics_hard_rubric_calibration',
      priority: 'P2',
      findingCount: reviewedHardRubricIssues.length,
      topFamilies: topTruePositiveFamilies,
      recommendation: 'draft_physics_hard_rubric_before_blocking',
      productionImpact: 'none_audit_only'
    });
  }
  if (reviewedCorrectnessIssues.length > 0) {
    nextActions.push({
      code: 'physics_current_policy_keep_isolated',
      priority: 'P1',
      findingCount: reviewedCorrectnessIssues.length,
      currentPolicyIsolatedCount: findings.filter((finding) => arrayFrom(finding.currentPolicyBlockReasons).length > 0).length,
      recommendation: 'keep_deterministic_current_policy_blockers_enabled',
      productionImpact: 'current_policy_isolation_only'
    });
  }
  if (reviewedUsabilityIssues.length > 0) {
    nextActions.push({
      code: 'physics_visual_remediation_backlog',
      priority: 'P2',
      findingCount: reviewedUsabilityIssues.length,
      recommendation: 'rewrite_or_regenerate_text_complete_items_before_enabling_visual_current_policy',
      productionImpact: 'none_audit_only'
    });
  }
  return {
    mode: 'audit_only_quality_sampling',
    reviewType: 'physics_difficulty_watch_sample',
    qualityAuditLedger: diversityQualityAuditLedgerSummary(qualityAuditLedger),
    findingCount: findings.length,
    reviewedCount: reviewed.length,
    unreviewedCount: Math.max(0, findings.length - reviewed.length),
    truePositiveCount: reviewedTruePositives.length,
    falsePositiveCount: reviewedFalsePositives.length,
    correctnessIssueCount: reviewedCorrectnessIssues.length,
    usabilityIssueCount: reviewedUsabilityIssues.length,
    hardRubricIssueCount: reviewedHardRubricIssues.length,
    topTruePositiveFamilies,
    hardRubricCalibration,
    currentPolicyIsolatedCount: findings.filter((finding) => arrayFrom(finding.currentPolicyBlockReasons).length > 0).length,
    productionImpact: 'none_audit_only',
    blockerPolicy: 'audit_only_visibility',
    nextActions,
    enablementGuardrails: {
      hardDifficultyWatchPolicy: 'audit_only_until_physics_subject_rubric_is_sampled',
      visualCurrentPolicyFlag: 'CSCA_SUBJECT_PRACTICE_PHYSICS_VISUAL_CURRENT_POLICY_ENABLED',
      visualCurrentPolicyDefault: 'disabled_until_pool_impact_has_zero_empty_cells',
      providerFailurePolicy: 'provider_schema_timeout_empty_output_excluded_from_family_quality_memory',
      currentPolicyScope: 'deterministic_physics_correctness_or_flagged_usability_only'
    },
    samples: findingsWithReview
      .filter((item) => item.qualityAudit)
      .slice(0, 8)
      .map((item) => ({
        id: item.finding.id,
        topicTitle: item.finding.topicTitle,
        difficulty: item.finding.difficulty,
        family: item.finding.family,
        studentPoolStatus: item.finding.studentPoolStatus,
        currentPolicyBlockReasons: item.finding.currentPolicyBlockReasons,
        qualityAudit: item.qualityAudit,
        prompt: item.finding.prompt
      }))
  };
}

function mathSoftCapCalibrationFor(signals, evaluatedCount, featureFlag, nearDuplicateSignals = [], qualityAuditLedger = null) {
  const productionFlagEnabled = cleanText(process.env[featureFlag]).toLowerCase() === 'true';
  const productionSignals = signals.filter((signal) => signal.wouldRegenerateIfFlagEnabled);
  const legacyCoveredSignals = productionSignals.filter((signal) => signal.legacyGateReason);
  const incrementalSignals = productionSignals.filter((signal) => signal.incrementalIfFlagEnabled);
  const nearDuplicateSupport = nearDuplicateSupportByQuestionId(nearDuplicateSignals);
  const qualityAuditByQuestionId = mathSoftCapQualityAuditByQuestionId(qualityAuditLedger);
  const incrementalReviewStates = incrementalSignals.map((signal) => ({
    signal,
    qualityAudit: qualityAuditByQuestionId.get(Number(signal.id)) ?? null
  }));
  const incrementalReviewedCount = incrementalReviewStates.filter((item) => item.qualityAudit).length;
  const incrementalUnreviewedCount = incrementalReviewStates.filter((item) => !item.qualityAudit).length;
  const incrementalReviewedAcceptedCount = incrementalReviewStates.filter((item) => mathSoftCapQualityAuditAccepted(item.qualityAudit)).length;
  const incrementalReviewedRejectedCount = incrementalReviewStates.filter((item) => item.qualityAudit && !mathSoftCapQualityAuditAccepted(item.qualityAudit)).length;
  const incrementalByTopicDifficulty = incrementalSignals.reduce((map, signal) => {
    const key = `${cleanText(signal.topicTitle)}|${cleanText(signal.difficulty)}`;
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  const maxIncrementalPerTopicDifficulty = Array.from(incrementalByTopicDifficulty.values()).reduce((max, value) => Math.max(max, value), 0);
  const blockers = [];
  if (productionFlagEnabled) blockers.push('production_flag_already_enabled');
  if (incrementalUnreviewedCount > 0) blockers.push('quality_audit_sample_incremental_soft_cap_before_enable');
  if (incrementalReviewedRejectedCount > 0) blockers.push('quality_audit_found_soft_cap_false_positive');
  if (maxIncrementalPerTopicDifficulty > 2) blockers.push('possible_topic_starvation_from_incremental_soft_cap');
  const recommendationCode = productionFlagEnabled
    ? 'observe_enabled_flag_with_quality_audit'
    : blockers.length
      ? 'do_not_enable_until_incremental_samples_reviewed'
      : incrementalSignals.length > 0
        ? 'eligible_for_guarded_default_off_flag_smoke_after_quality_audit'
        : 'eligible_for_limited_default_off_flag_smoke';
  return {
    mode: 'audit_only_calibration',
    subject: 'math',
    featureFlag,
    productionFlagEnabled,
    evaluatedCount,
    productionDecisionScope: 'task_family_recent_window_cap_only',
    auditOnlyReasons: ['reasoning_path_repeated'],
    providerFailurePolicy: 'excluded_provider_and_schema_failures_not_counted_as_family_quality',
    studentConsumableScope: 'formal_published_subject_practice_window_only',
    productionSignalCount: productionSignals.length,
    legacyCoveredCount: legacyCoveredSignals.length,
    incrementalCount: incrementalSignals.length,
    qualityAuditLedger: diversityQualityAuditLedgerSummary(qualityAuditLedger),
    incrementalReviewedCount,
    incrementalUnreviewedCount,
    incrementalReviewedAcceptedCount,
    incrementalReviewedRejectedCount,
    incrementalNearDuplicateSupportCount: incrementalSignals.filter((signal) => nearDuplicateSupport.has(Number(signal.id))).length,
    incrementalRatio: Number((incrementalSignals.length / Math.max(1, evaluatedCount)).toFixed(3)),
    maxIncrementalPerTopicDifficulty,
    blockerReasons: blockers,
    recommendationCode,
    recommendation: recommendationCode === 'do_not_enable_until_incremental_samples_reviewed'
      ? 'Keep the math soft-cap flag disabled and collect offline sampling evidence for incremental samples before any limited production smoke.'
      : recommendationCode === 'eligible_for_guarded_default_off_flag_smoke_after_quality_audit'
        ? 'Incremental samples have offline quality-audit coverage; a guarded default-off math soft-cap smoke can be considered without changing the production flag default.'
      : recommendationCode === 'eligible_for_limited_default_off_flag_smoke'
        ? 'No incremental production soft-cap hits in this window; a controlled default-off smoke can be considered after one more audit.'
        : 'Flag is enabled; inspect incremental samples and student pool health before expanding scope.',
    incrementalSamples: incrementalSignals.slice(0, 8).map((signal) => ({
      id: signal.id,
      topicTitle: signal.topicTitle,
      difficulty: signal.difficulty,
      family: signal.family,
      acceptedFamilyCount: signal.acceptedFamilyCount,
      acceptedCount: signal.acceptedCount,
      productionSoftCapReasons: signal.productionSoftCapReasons,
      nearDuplicateSupport: nearDuplicateSupport.has(Number(signal.id)),
      nearDuplicateSignals: (nearDuplicateSupport.get(Number(signal.id)) ?? []).slice(0, 3),
      qualityAudit: qualityAuditByQuestionId.get(Number(signal.id)) ?? null,
      prompt: signal.prompt
    }))
  };
}

function mathOtherFamilyPromotionDryRunFor(questions, subject) {
  const featureFlag = 'CSCA_SUBJECT_PRACTICE_MATH_DIVERSITY_SOFT_CAP_ENABLED';
  if (subject !== 'math' || !subjectPracticeEvaluateDiversityWindow) return null;
  const baseScoped = questions.slice(0, 200).map((question) => {
    const family = promptFamily(question.prompt, question);
    return {
      ...question,
      family,
      fingerprint: questionFingerprint(question, family),
      promotedFromOther: false,
      suggestedFamily: null
    };
  });
  const promotedScoped = questions.slice(0, 200).map((question) => {
    const baseFamily = promptFamily(question.prompt, question);
    const suggestion = (baseFamily === 'other' || baseFamily === 'unclassified')
      ? auditOnlyOtherFamilySuggestionFor(question, subject)
      : null;
    const family = suggestion?.suggestedFamily ?? baseFamily;
    return {
      ...question,
      family,
      fingerprint: questionFingerprint(question, family),
      promotedFromOther: Boolean(suggestion),
      suggestedFamily: suggestion?.suggestedFamily ?? null
    };
  });
  const baseKnownFamilyCount = baseScoped.filter((item) => item.family && item.family !== 'other' && item.family !== 'unclassified').length;
  const promotedKnownFamilyCount = promotedScoped.filter((item) => item.family && item.family !== 'other' && item.family !== 'unclassified').length;
  const promotedQuestions = promotedScoped.filter((item) => item.promotedFromOther);
  const baseDryRun = mathSoftCapSignalsForScoped(baseScoped, featureFlag);
  const promotedDryRun = mathSoftCapSignalsForScoped(promotedScoped, featureFlag);
  const baseSignalIds = new Set(baseDryRun.signals.map((signal) => Number(signal.id)));
  const promotedSignalById = new Map(promotedDryRun.signals.map((signal) => [Number(signal.id), signal]));
  const bySuggestedFamily = promotedQuestions.reduce((map, question) => {
    const key = cleanText(question.suggestedFamily) || 'unknown';
    const entry = map.get(key) ?? {
      suggestedFamily: key,
      windowScope: subjectPracticeDiversityFamilyWindowScope
        ? subjectPracticeDiversityFamilyWindowScope(key)
        : 'unknown',
      count: 0,
      sampleIds: [],
      wouldRegenerateIfPromotedCount: 0
    };
    entry.count += 1;
    if (entry.sampleIds.length < 6) entry.sampleIds.push(Number(question.id));
    const promotedSignal = promotedSignalById.get(Number(question.id));
    if (promotedSignal?.wouldRegenerateIfFlagEnabled) entry.wouldRegenerateIfPromotedCount += 1;
    map.set(key, entry);
    return map;
  }, new Map());
  const incrementalSignals = promotedDryRun.signals.filter((signal) => !baseSignalIds.has(Number(signal.id)));
  return {
    mode: 'audit_only',
    policyVersion: 'subject-practice-math-family-promotion-dry-run-v1',
    productionImpact: 'none_audit_only',
    featureFlag,
    productionFlagEnabled: cleanText(process.env[featureFlag]).toLowerCase() === 'true',
    totalQuestionCount: baseScoped.length,
    baseKnownFamilyCount,
    promotedKnownFamilyCount,
    coverageGainCount: Math.max(0, promotedKnownFamilyCount - baseKnownFamilyCount),
    baseKnownFamilyRatio: Number((baseKnownFamilyCount / Math.max(1, baseScoped.length)).toFixed(3)),
    promotedKnownFamilyRatio: Number((promotedKnownFamilyCount / Math.max(1, promotedScoped.length)).toFixed(3)),
    promotedQuestionCount: promotedQuestions.length,
    promotedFamilyWindowScopes: Array.from(new Set(promotedQuestions.map((question) => cleanText(question.suggestedFamily)).filter(Boolean)))
      .sort()
      .map((family) => ({
        family,
        windowScope: subjectPracticeDiversityFamilyWindowScope
          ? subjectPracticeDiversityFamilyWindowScope(family)
          : 'unknown',
        productionImpact: subjectPracticeDiversityFamilyWindowScope?.(family) === 'legacy_gated'
          ? 'existing_gate_only'
          : 'none_audit_only'
      })),
    baseWouldRegenerateCount: baseDryRun.signals.filter((signal) => signal.wouldRegenerateIfFlagEnabled).length,
    promotedWouldRegenerateCount: promotedDryRun.signals.filter((signal) => signal.wouldRegenerateIfFlagEnabled).length,
    incrementalWouldRegenerateCount: incrementalSignals.filter((signal) => signal.wouldRegenerateIfFlagEnabled).length,
    incrementalSignalCount: incrementalSignals.length,
    bySuggestedFamily: Array.from(bySuggestedFamily.values())
      .sort((left, right) => right.count - left.count || cleanText(left.suggestedFamily).localeCompare(cleanText(right.suggestedFamily)))
      .slice(0, 12),
    incrementalSignals: incrementalSignals.slice(0, 12)
  };
}

function formalQuestionBlockers(question) {
  const reasons = [];
  const generationMetadata = recordFrom(question.generationMetadata);
  const reviewMetadata = recordFrom(question.reviewMetadata);
  const gateDecision = qualityAuditDisplayGateDecision(get(reviewMetadata, 'gate.decision'));
  const approvalStatus = cleanText(get(reviewMetadata, 'subjectPracticeAutoApproval.status'));
  const approvalUseCase = cleanText(get(reviewMetadata, 'subjectPracticeAutoApproval.targetUseCase'));
  const fallbackUsed = generationMetadata.fallbackUsed === true
    || cleanText(generationMetadata.generator) === 'rule-fallback'
    || /smoke/i.test(cleanText(generationMetadata.sourceKind))
    || /smoke/i.test(cleanText(generationMetadata.generationSource));
  if (fallbackUsed) reasons.push('fallback_or_smoke_formal_question');
  if (approvalStatus !== 'published_to_subject_practice' || approvalUseCase !== 'subject_practice') {
    reasons.push('missing_subject_practice_formal_publish_metadata');
  }
  if (gateDecision && gateDecision !== 'publishable') reasons.push(`gate_not_publishable:${gateDecision}`);
  const validatorIssues = [
    ...arrayFrom(get(reviewMetadata, 'validator.issues')),
    ...arrayFrom(reviewMetadata.validationIssues)
  ];
  if (validatorIssues.some((issue) => cleanText(recordFrom(issue).severity) === 'error')) reasons.push('validator_error_issue');
  if (containsVisualDependency(question)) reasons.push('visual_dependency_without_asset_check');
  const family = promptFamily(question.prompt, question);
  const difficultyAudit = mathDifficultyAudit(question, family);
  if (difficultyAudit) reasons.push(difficultyAudit.reasonCode);
  const mentionedAnswer = answerMentionedInExplanation(question.explanation);
  if (mentionedAnswer && mentionedAnswer !== cleanText(question.correctAnswer).toUpperCase()) {
    reasons.push(`explanation_mentions_different_answer:${mentionedAnswer}`);
  }
  const inferredDifficulty = cleanText(
    get(reviewMetadata, 'profileAlignment.evidence.inferredDifficultyBand')
      ?? get(reviewMetadata, 'difficultyEvidence.inferredDifficulty')
      ?? get(reviewMetadata, 'profileAlignment.inferredDifficulty')
  );
  if (inferredDifficulty && !difficultyAliases(question.difficulty).has(inferredDifficulty.toLowerCase())) {
    reasons.push(`difficulty_evidence_mismatch:${inferredDifficulty}`);
  }
  return reasons;
}

function prePublicationUniquenessEvidenceFor(questions) {
  const policyVersion = 'subject-practice-prepublication-uniqueness-v1';
  const scopedQuestions = arrayFrom(questions).filter((question) => (
    cleanText(get(question.generationMetadata, 'workClass')) !== 'observation'
  ));
  const totals = {
    checkedCount: 0,
    passedCount: 0,
    blockedCount: 0,
    unknownEvidenceCount: 0,
    legacyMissingEligibleEvidenceCount: 0,
    notReachedFormalGateCount: 0
  };
  const byCell = new Map();
  const samples = [];
  for (const question of scopedQuestions) {
    const cellId = cleanText(get(question.generationMetadata, 'productionCellId')) || 'unknown';
    const entry = byCell.get(cellId) ?? {
      cellId: Number(cellId) || null,
      checkedCount: 0,
      passedCount: 0,
      blockedCount: 0,
      unknownEvidenceCount: 0,
      legacyMissingEligibleEvidenceCount: 0,
      notReachedFormalGateCount: 0
    };
    const evidence = recordFrom(get(question.reviewMetadata, 'prePublicationUniqueness'));
    const evidencePolicyVersion = cleanText(evidence.policyVersion);
    const evidenceStatus = cleanText(evidence.status);
    const hasEvidence = Boolean(evidencePolicyVersion);
    const blocked = hasEvidence && (evidence.blocked === true || evidenceStatus === 'blocked_near_duplicate');
    const passed = hasEvidence && !blocked && evidenceStatus === 'passed';
    const gateDecision = qualityAuditDisplayGateDecision(get(question.reviewMetadata, 'gate.decision'));
    const gatePublishable = get(question.reviewMetadata, 'gate.publishable') === true;
    const approvedAndPublished = cleanText(question.status) === 'approved' && Number(question.sourceQuestionId) > 0;
    const otherwiseEligibleForPrePublication = gatePublishable && gateDecision === 'publishable';
    let category;
    if (blocked) category = 'blockedCount';
    else if (passed) category = 'passedCount';
    else if (hasEvidence) category = 'unknownEvidenceCount';
    else if (approvedAndPublished || otherwiseEligibleForPrePublication) category = 'legacyMissingEligibleEvidenceCount';
    else category = 'notReachedFormalGateCount';
    entry[category] += 1;
    totals[category] += 1;
    if (hasEvidence) {
      entry.checkedCount += 1;
      totals.checkedCount += 1;
    }
    byCell.set(cellId, entry);
    if (samples.length < 12 && (hasEvidence || category === 'legacyMissingEligibleEvidenceCount')) {
      samples.push({
        id: Number(question.id),
        cellId: Number(cellId) || null,
        topicTitle: cleanText(question.topicTitle),
        difficulty: cleanText(question.difficulty),
        questionStatus: cleanText(question.status),
        evidenceStatus: evidenceStatus || 'legacy_missing',
        evidencePolicyVersion: evidencePolicyVersion || null,
        blocked,
        reasonCode: cleanText(evidence.reasonCode) || null,
        nearestId: Number(get(evidence, 'signal.nearestId')) || null,
        similarity: Number(get(evidence, 'signal.similarity')) || null,
        comparedEligiblePriorCount: Number(evidence.comparedEligiblePriorCount) || 0
      });
    }
  }
  const evidenceEligibleCount = totals.checkedCount + totals.legacyMissingEligibleEvidenceCount;
  return {
    mode: 'subject_practice_prepublication_uniqueness_evidence',
    policyVersion,
    scope: 'same_run_production_candidates_and_formal_questions_observation_work_excluded',
    productionImpact: 'none_audit_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_existing_review_metadata',
    questionCount: scopedQuestions.length,
    excludedObservationQuestionCount: arrayFrom(questions).length - scopedQuestions.length,
    ...totals,
    evidenceEligibleCount,
    evidenceCoverage: evidenceEligibleCount > 0
      ? Number((totals.checkedCount / evidenceEligibleCount).toFixed(3))
      : null,
    checkedBlockRate: totals.checkedCount > 0
      ? Number((totals.blockedCount / totals.checkedCount).toFixed(3))
      : null,
    legacyMissingEvidenceIsNotRetroactiveFailure: true,
    byCell: Array.from(byCell.values()).sort((left, right) => (left.cellId ?? Number.MAX_SAFE_INTEGER) - (right.cellId ?? Number.MAX_SAFE_INTEGER)),
    samples
  };
}

function topEntries(map, limit = 5) {
  return Array.from(map.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, limit);
}

function profileDifficultyPatchEvidenceSummaryFor(questions) {
  const samples = questions
    .map((question) => {
      const evidence = recordFrom(recordFrom(question.reviewMetadata).profileAlignment).evidence;
      const evidenceRecord = recordFrom(evidence);
      const patchVersion = cleanText(evidenceRecord.difficultyEvidencePatchVersion);
      if (!patchVersion) return null;
      return {
        id: Number(question.id),
        status: cleanText(question.status),
        topicTitle: cleanText(question.topicTitle),
        difficulty: cleanText(question.difficulty),
        patchVersion,
        policyVersion: cleanText(evidenceRecord.difficultyEvidencePolicyVersion) || null,
        inferredDifficultyBand: cleanText(evidenceRecord.inferredDifficultyBand) || null,
        inferredCalculationLoad: cleanText(evidenceRecord.inferredCalculationLoad) || null,
        actualDifficultyReasons: arrayFrom(evidenceRecord.actualDifficultyReasons).map(cleanText).filter(Boolean),
        prompt: cleanText(question.prompt).slice(0, 220)
      };
    })
    .filter(Boolean);
  const patchCounts = topEntries(samples.reduce((map, sample) => {
    map.set(sample.patchVersion, (map.get(sample.patchVersion) ?? 0) + 1);
    return map;
  }, new Map()), 8).map(([patchVersion, count]) => ({ patchVersion, count }));
  return {
    scope: 'production_candidates',
    productionImpact: 'none_audit_only',
    observedCount: samples.length,
    patchCounts,
    samples: samples.slice(0, 8)
  };
}

function runProfileDifficultyPatchEvidenceSelfTest() {
  const summary = profileDifficultyPatchEvidenceSummaryFor([
    {
      id: 15989,
      status: 'pending_review',
      topicTitle: '函数的概念与性质',
      difficulty: 'medium',
      prompt: '函数 f(x)=log_2(x^2-1)-log_2(x-1)，D 为定义域。下列判断正确的是（ ）',
      reviewMetadata: {
        profileAlignment: {
          evidence: {
            difficultyEvidencePolicyVersion: 'subject-practice-difficulty-evidence-v58',
            difficultyEvidencePatchVersion: 'math-logarithmic-domain-difficulty-evidence-patch-v1',
            inferredDifficultyBand: 'medium',
            inferredCalculationLoad: 'medium',
            actualDifficultyReasons: ['logarithmic_domain_equivalence_judgement_medium_cap']
          }
        }
      }
    },
    {
      id: 16000,
      status: 'pending_review',
      topicTitle: '函数的概念与性质',
      difficulty: 'medium',
      prompt: '函数 f(x)=x^2+2x-3，下列说法正确的是？',
      reviewMetadata: {
        profileAlignment: {
          evidence: {
            difficultyEvidencePolicyVersion: 'subject-practice-difficulty-evidence-v58',
            inferredDifficultyBand: 'medium'
          }
        }
      }
    },
    {
      id: 16338,
      status: 'approved',
      topicTitle: '函数的概念与性质',
      difficulty: 'medium',
      prompt: '为比较指数、对数与幂函数值的大小，设 a=log_2 3，b=2^(1/2)，c=log_3 4；且 2^(3/2)=2√2<3，3^(4/3)=3∛3>4，4/3<√2。下列排序正确的是？',
      reviewMetadata: {
        profileAlignment: {
          evidence: {
            difficultyEvidencePolicyVersion: 'subject-practice-difficulty-evidence-v58',
            difficultyEvidencePatchVersion: 'math-exp-log-ordering-difficulty-evidence-patch-v1',
            inferredDifficultyBand: 'medium',
            inferredCalculationLoad: 'medium',
            actualDifficultyReasons: ['exp_log_power_value_ordering_medium_cap']
          }
        }
      }
    }
  ]);
  const patchCounts = new Map(summary.patchCounts.map((entry) => [entry.patchVersion, entry.count]));
  const byId = new Map(summary.samples.map((sample) => [sample.id, sample]));
  const passed = summary.observedCount === 2
    && summary.patchCounts.length === 2
    && patchCounts.get('math-logarithmic-domain-difficulty-evidence-patch-v1') === 1
    && patchCounts.get('math-exp-log-ordering-difficulty-evidence-patch-v1') === 1
    && summary.samples[0]?.policyVersion === 'subject-practice-difficulty-evidence-v58'
    && summary.samples[0]?.inferredDifficultyBand === 'medium'
    && byId.get(16338)?.actualDifficultyReasons?.includes('exp_log_power_value_ordering_medium_cap')
    && summary.productionImpact === 'none_audit_only';
  return {
    status: passed ? 'passed' : 'failed',
    summary
  };
}

function reviewerCandidateFromQuestion(question) {
  const options = arrayFrom(question.options).map((option, index) => ({
    id: cleanText(recordFrom(option).id) || String.fromCharCode(65 + index),
    text: cleanText(recordFrom(option).text ?? option)
  })).filter((option) => option.id && option.text);
  return {
    subject: cleanText(question.subject),
    topicId: Number(question.topicId) || 0,
    blueprintId: 0,
    sourceType: 'ai',
    designedDifficulty: cleanText(question.difficulty),
    questionType: 'single_choice',
    prompt: cleanText(question.prompt),
    options,
    correctAnswer: cleanText(question.correctAnswer).toUpperCase(),
    explanation: cleanText(question.explanation),
    knowledgeTags: [],
    optionMetadata: [],
    syllabusVersion: '2026',
    localizations: recordFrom(question.localizations)
  };
}

async function currentReviewerProfileReplayFor(questions, cells, subject) {
  if (!QuestionReviewerService || !QuestionReviewerProviderService || !QuestionValidatorService) {
    return {
      status: 'unavailable',
      reason: 'reviewer_modules_unavailable',
      productionImpact: 'none_audit_only',
      providerPolicy: 'not_started'
    };
  }
  const scopedQuestions = questions.slice(0, 30);
  const cellById = new Map(cells.map((cell) => [String(cell.id), cell]));
  const reviewer = new QuestionReviewerService(
    new QuestionValidatorService(),
    new QuestionReviewerProviderService(disabledReviewerGateway())
  );
  const samples = [];
  for (const question of scopedQuestions) {
    const generationMetadata = recordFrom(question.generationMetadata);
    const cell = cellById.get(cleanText(generationMetadata.productionCellId));
    try {
      const review = await reviewer.review(reviewerCandidateFromQuestion(question), {
        subject,
        intendedUse: 'subject_practice',
        topicId: Number(question.topicId) || undefined,
        topicTitle: cleanText(question.topicTitle),
        syllabusVersion: '2026',
        topicStatus: 'published',
        styleProfile: { confidence: 'high', profile: {} },
        targetProfile: cell?.targetProfile ?? {},
        reviewProviderMode: 'deterministic_only'
      });
      const storedEvidence = recordFrom(recordFrom(question.reviewMetadata).profileAlignment).evidence;
      const currentEvidence = recordFrom(recordFrom(review.profileAlignment).evidence);
      samples.push({
        id: Number(question.id),
        status: cleanText(question.status),
        topicTitle: cleanText(question.topicTitle),
        difficulty: cleanText(question.difficulty),
        storedGateDecision: qualityAuditDisplayGateDecision(get(question.reviewMetadata, 'gate.decision')) || null,
        storedDifficultyBand: cleanText(recordFrom(storedEvidence).inferredDifficultyBand) || null,
        storedCalculationLoad: cleanText(recordFrom(storedEvidence).inferredCalculationLoad) || null,
        storedPatchVersion: cleanText(recordFrom(storedEvidence).difficultyEvidencePatchVersion) || null,
        currentReviewStatus: cleanText(review.status),
        currentDecision: cleanText(review.decision),
        currentProfileStatus: cleanText(recordFrom(review.profileAlignment).status),
        currentProfileReasons: arrayFrom(recordFrom(review.profileAlignment).reasons).map(cleanText).filter(Boolean),
        currentDifficultyBand: cleanText(currentEvidence.inferredDifficultyBand) || null,
        currentCalculationLoad: cleanText(currentEvidence.inferredCalculationLoad) || null,
        currentPatchVersion: cleanText(currentEvidence.difficultyEvidencePatchVersion) || null,
        currentDifficultyReasons: arrayFrom(currentEvidence.actualDifficultyReasons).map(cleanText).filter(Boolean),
        providerStatus: cleanText(get(review, 'provider.status')) || null,
        prompt: cleanText(question.prompt).slice(0, 220)
      });
    } catch (error) {
      samples.push({
        id: Number(question.id),
        status: cleanText(question.status),
        topicTitle: cleanText(question.topicTitle),
        difficulty: cleanText(question.difficulty),
        error: cleanText(error?.message ?? error),
        prompt: cleanText(question.prompt).slice(0, 220)
      });
    }
  }
  const currentPatchCounts = topEntries(samples.reduce((map, sample) => {
    const patchVersion = cleanText(sample.currentPatchVersion);
    if (patchVersion) map.set(patchVersion, (map.get(patchVersion) ?? 0) + 1);
    return map;
  }, new Map()), 8).map(([patchVersion, count]) => ({ patchVersion, count }));
  return {
    status: samples.some((sample) => sample.error) ? 'warning' : 'completed',
    scope: 'production_candidates_current_code_replay',
    reviewedCount: samples.filter((sample) => !sample.error).length,
    errorCount: samples.filter((sample) => sample.error).length,
    productionImpact: 'none_audit_only',
    providerPolicy: 'deterministic_only_disabled_gateway_no_provider_calls',
    currentPatchCounts,
    samples: [
      ...samples.filter((sample) => sample.currentPatchVersion),
      ...samples.filter((sample) => !sample.currentPatchVersion)
    ].slice(0, 8)
  };
}

function mergeCountRows(rows, keyField, limit = 5) {
  const merged = rows.reduce((map, row) => {
    const key = keyField === 'reason'
      ? qualityAuditDisplayReason(row[keyField])
      : cleanText(row[keyField]);
    if (!key) return map;
    map.set(key, (map.get(key) ?? 0) + asNumber(row.count));
    return map;
  }, new Map());
  return topEntries(merged, limit).map(([key, count]) => ({ [keyField]: key, count }));
}

function jsonReplacer(_key, value) {
  if (typeof value === 'bigint') return Number(value);
  return value;
}

function primaryCellBottleneckFor(input) {
  if (input.storedOpenCount <= 0) return 'none_detected';
  if (input.hasPublishedCountMismatch && input.reconciledOpenCount < input.storedOpenCount) {
    return 'published_count_reconciliation';
  }
  if (input.topGateReasonCount > 0 && input.rejectedGeneratedCount >= Math.max(1, input.approvedGeneratedCount)) {
    return 'content_gate';
  }
  if (input.unclassifiedRejectedCount > 0 && input.rejectedGeneratedCount >= Math.max(1, input.approvedGeneratedCount)) {
    return 'unclassified_candidate_rejection';
  }
  if (input.topJobErrorCount > 0 || (input.generatedQuestionCount === 0 && input.jobAttemptCount > 0)) {
    return 'provider_or_schema';
  }
  return 'none_detected';
}

function runProductionDiagnosticsSelfTest() {
  const base = {
    storedOpenCount: 4,
    reconciledOpenCount: 4,
    hasPublishedCountMismatch: false,
    topGateReasonCount: 0,
    rejectedGeneratedCount: 4,
    approvedGeneratedCount: 0,
    unclassifiedRejectedCount: 0,
    topJobErrorCount: 0,
    generatedQuestionCount: 4,
    jobAttemptCount: 4
  };
  const cases = [
    [{ ...base, unclassifiedRejectedCount: 4 }, 'unclassified_candidate_rejection'],
    [{ ...base, topGateReasonCount: 2 }, 'content_gate'],
    [{ ...base, rejectedGeneratedCount: 0, generatedQuestionCount: 0, topJobErrorCount: 1 }, 'provider_or_schema'],
    [{ ...base, rejectedGeneratedCount: 0, generatedQuestionCount: 4, approvedGeneratedCount: 0,
      publishablePendingGeneratedCount: 4, unclassifiedRejectedCount: 0 }, 'none_detected'],
    [{ ...base, storedOpenCount: 0, reconciledOpenCount: 0 }, 'none_detected']
  ];
  for (const [input, expected] of cases) {
    const actual = primaryCellBottleneckFor(input);
    if (actual !== expected) throw new Error(`Production diagnostics fixture expected ${expected}, got ${actual}.`);
  }
  const uniqueness = prePublicationUniquenessEvidenceFor([
    {
      id: 1, status: 'approved', sourceQuestionId: 101, topicTitle: '基本初等函数', difficulty: 'basic',
      generationMetadata: { productionCellId: 16 },
      reviewMetadata: { gate: { decision: 'publishable', publishable: true }, prePublicationUniqueness: { policyVersion: 'subject-practice-prepublication-uniqueness-v1', status: 'passed', blocked: false } }
    },
    {
      id: 2, status: 'pending_review', sourceQuestionId: null, topicTitle: '基本初等函数', difficulty: 'basic',
      generationMetadata: { productionCellId: 16 },
      reviewMetadata: { gate: { decision: 'regenerate', publishable: false }, prePublicationUniqueness: { policyVersion: 'subject-practice-prepublication-uniqueness-v1', status: 'blocked_near_duplicate', blocked: true, reasonCode: 'subject_practice_prepublication_near_duplicate', signal: { nearestId: 1, similarity: 0.91 } } }
    },
    {
      id: 3, status: 'approved', sourceQuestionId: 103, topicTitle: '基本初等函数', difficulty: 'basic',
      generationMetadata: { productionCellId: 16 },
      reviewMetadata: { gate: { decision: 'publishable', publishable: true } }
    },
    {
      id: 4, status: 'review_failed', sourceQuestionId: null, topicTitle: '基本初等函数', difficulty: 'basic',
      generationMetadata: { productionCellId: 16 },
      reviewMetadata: { gate: { decision: 'regenerate', publishable: false } }
    },
    {
      id: 5, status: 'pending_review', sourceQuestionId: null, topicTitle: '基本初等函数', difficulty: 'basic',
      generationMetadata: { productionCellId: 16, workClass: 'observation' },
      reviewMetadata: { prePublicationUniqueness: { policyVersion: 'subject-practice-prepublication-uniqueness-v1', status: 'passed', blocked: false } }
    }
  ]);
  if (uniqueness.questionCount !== 4
    || uniqueness.excludedObservationQuestionCount !== 1
    || uniqueness.checkedCount !== 2
    || uniqueness.passedCount !== 1
    || uniqueness.blockedCount !== 1
    || uniqueness.legacyMissingEligibleEvidenceCount !== 1
    || uniqueness.notReachedFormalGateCount !== 1
    || uniqueness.evidenceCoverage !== 0.667) {
    throw new Error('Production diagnostics pre-publication uniqueness fixture failed.');
  }
  return {
    mode: 'subject_practice_production_diagnostics_self_test',
    status: 'passed',
    productionImpact: 'none_fixture_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_no_database_connection',
    prePublicationUniquenessCaseCount: 1,
    caseCount: cases.length + 1
  };
}

async function main() {
  if (hasFlag('self-test-production-diagnostics')) {
    const report = runProductionDiagnosticsSelfTest();
    console.log(JSON.stringify(report, jsonReplacer, 2));
    return;
  }
  if (hasFlag('self-test-math-question-plan-shadow')) {
    const report = runMathQuestionPlanShadowSelfTest();
    if (hasFlag('json')) console.log(JSON.stringify(report, jsonReplacer, 2));
    else console.log(`Math QuestionPlan shadow self-test: ${report.status}, samples=${report.sampleCount}`);
    return;
  }
  if (hasFlag('self-test-physics-question-plan-shadow')) {
    const report = runPhysicsQuestionPlanShadowSelfTest();
    if (hasFlag('json')) console.log(JSON.stringify(report, jsonReplacer, 2));
    else console.log(`Physics QuestionPlan shadow self-test: ${report.status}, samples=${report.sampleCount}`);
    return;
  }
  if (hasFlag('self-test-chemistry-basic-ph-question-plan-calibration')) {
    const report = runChemistryBasicPhQuestionPlanCalibrationSelfTest();
    if (hasFlag('json')) console.log(JSON.stringify(report, jsonReplacer, 2));
    else console.log(`Chemistry basic pH QuestionPlan calibration self-test: ${report.status}, samples=${report.sampleCount}`);
    return;
  }
  if (hasFlag('self-test-question-plan-execution')) {
    const report = runQuestionPlanExecutionSelfTest();
    if (hasFlag('json')) console.log(JSON.stringify(report, jsonReplacer, 2));
    else console.log(`QuestionPlan execution self-test: ${report.status}, observed=${report.summary.observedCount}, samples=${report.summary.sampleCount}`);
    return;
  }
  if (hasFlag('self-test-profile-difficulty-patch-evidence')) {
    const report = runProfileDifficultyPatchEvidenceSelfTest();
    if (hasFlag('json')) console.log(JSON.stringify(report, jsonReplacer, 2));
    else console.log(`Profile difficulty patch evidence self-test: ${report.status}, observed=${report.summary.observedCount}, patches=${report.summary.patchCounts.length}`);
    if (report.status !== 'passed') process.exitCode = 2;
    return;
  }
  const subject = cleanText(argValue('subject', 'chemistry')) || 'chemistry';
  const sampleLimit = Math.max(1, Math.min(50, Number(argValue('sample', '16')) || 16));
  const runArg = cleanText(argValue('run', 'latest'));
  const days = Math.max(1, Math.min(60, Number(argValue('days', '3')) || 3));
  const json = hasFlag('json');
  const readinessOnly = hasFlag('readiness');
  const qualityAuditLedgerPath = argValue('quality-audit-ledger', argValue('manual-review-ledger', DEFAULT_DIVERSITY_QUALITY_AUDIT_LEDGER_PATH));
  const qualityAuditLedger = loadDiversityQualityAuditLedger(qualityAuditLedgerPath);
  if (hasFlag('validate-quality-audit-ledger') || hasFlag('validate-manual-review-ledger')) {
    const report = {
      mode: 'read_only_quality_audit_ledger_validation',
      productionImpact: 'none_audit_only',
      providerFailurePolicy: 'provider_failures_must_not_be_quality_audit_family_evidence',
      qualityAuditLedger: diversityQualityAuditLedgerSummary(qualityAuditLedger)
    };
    if (json) {
      console.log(JSON.stringify(report, jsonReplacer, 2));
    } else {
      console.log(`Diversity offline quality-audit ledger validation: ${report.qualityAuditLedger.validationStatus}`);
      console.log(`- samples=${report.qualityAuditLedger.sampleCount}, issues=${report.qualityAuditLedger.validationIssueCount}, path=${report.qualityAuditLedger.path ?? 'n/a'}`);
    }
    return;
  }
  loadDatabaseUrl();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Set it in the environment or project .env.');
  }
  const prisma = new PrismaClient();
  const failOnP0 = hasFlag('fail-on-p0');
  try {
    const runRows = runArg === 'latest'
      ? await prisma.$queryRaw(Prisma.sql`
        SELECT "id", "subject", "status", "trigger_type" AS "triggerType",
               "target_total" AS "targetTotal", "published_total" AS "publishedTotal",
               "candidate_total" AS "candidateTotal", "failed_total" AS "failedTotal",
               "open_total" AS "openTotal", "blocked_reason_code" AS "blockedReasonCode",
               "blocked_message" AS "blockedMessage", "started_at" AS "startedAt",
               "updated_at" AS "updatedAt", "completed_at" AS "completedAt"
        FROM "csca_subject_practice_production_runs"
        WHERE "subject" = ${subject}
        ORDER BY CASE WHEN "blocked_reason_code" = 'duplicate_subject_production_run' THEN 1 ELSE 0 END,
                 "updated_at" DESC, "id" DESC
        LIMIT 1
      `)
      : await prisma.$queryRaw(Prisma.sql`
        SELECT "id", "subject", "status", "trigger_type" AS "triggerType",
               "target_total" AS "targetTotal", "published_total" AS "publishedTotal",
               "candidate_total" AS "candidateTotal", "failed_total" AS "failedTotal",
               "open_total" AS "openTotal", "blocked_reason_code" AS "blockedReasonCode",
               "blocked_message" AS "blockedMessage", "started_at" AS "startedAt",
               "updated_at" AS "updatedAt", "completed_at" AS "completedAt"
        FROM "csca_subject_practice_production_runs"
        WHERE "id" = ${Number(runArg)}
        LIMIT 1
      `);
    const run = runRows[0];
    if (!run) throw new Error(`No subject-practice production run found for subject=${subject} run=${runArg}.`);
    const runId = Number(run.id);
    const staleRunningBefore = new Date(Date.now() - subjectPracticeStaleRunningMs());
    const cells = await prisma.$queryRaw(Prisma.sql`
      SELECT "id", "topic_id" AS "topicId", "topic_title" AS "topicTitle",
             "difficulty_band" AS "difficulty", "status", "target_count" AS "targetCount",
             "published_count" AS "publishedCount", "candidate_count" AS "candidateCount",
             "running_job_count" AS "storedRunningJobCount", "failed_count" AS "failedCount",
             "failure_code" AS "failureCode", "failure_message" AS "failureMessage",
             "target_profile" AS "targetProfile", "updated_at" AS "updatedAt"
      FROM "csca_subject_practice_production_cells"
      WHERE "run_id" = ${runId}
      ORDER BY "topic_title", "difficulty_band", "id"
    `);
    const activeRunningRows = await prisma.$queryRaw(Prisma.sql`
      SELECT "prompt_metadata"->>'productionCellId' AS "cellId",
             COUNT(*) FILTER (WHERE "status" = 'running')::int AS "rawRunning",
             COUNT(*) FILTER (
               WHERE "status" = 'running'
                 AND COALESCE(NULLIF("prompt_metadata"->>'processingStartedAt', '')::timestamp, "created_at") >= ${staleRunningBefore}
             )::int AS "activeRunning",
             COUNT(*) FILTER (
               WHERE "status" = 'running'
                 AND COALESCE(NULLIF("prompt_metadata"->>'processingStartedAt', '')::timestamp, "created_at") < ${staleRunningBefore}
             )::int AS "staleRunning",
             COUNT(*) FILTER (WHERE "status" = 'queued')::int AS "queued"
      FROM "csca_ai_generation_jobs"
      WHERE "prompt_metadata"->>'productionRunId' = ${String(runId)}
      GROUP BY "prompt_metadata"->>'productionCellId'
    `);
    const runningByCell = new Map(activeRunningRows.map((row) => [String(row.cellId), row]));
    const approvedQuestions = await prisma.$queryRaw(Prisma.sql`
      SELECT q."id", q."subject", q."topic_id" AS "topicId", t."title" AS "topicTitle",
             q."designed_difficulty" AS "difficulty", q."status", q."source_question_id" AS "sourceQuestionId",
             q."prompt", q."options", q."correct_answer" AS "correctAnswer", q."explanation",
             q."generation_metadata" AS "generationMetadata", q."review_metadata" AS "reviewMetadata",
             q."created_at" AS "createdAt"
      FROM "csca_questions" q
      JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
      WHERE q."subject" = ${subject}
        AND q."generation_metadata"->>'productionRunId' = ${String(runId)}
        AND q."status" = 'approved'
      ORDER BY q."created_at" DESC, q."id" DESC
    `);
    const formalQuestions = approvedQuestions.filter(subjectPracticeFormalQuestion);
    const recentApprovedQuestions = await prisma.$queryRaw(Prisma.sql`
      SELECT q."id", q."subject", q."topic_id" AS "topicId", t."title" AS "topicTitle",
             q."designed_difficulty" AS "difficulty", q."status", q."source_question_id" AS "sourceQuestionId",
             q."prompt", q."options", q."correct_answer" AS "correctAnswer", q."explanation",
             q."generation_metadata" AS "generationMetadata", q."review_metadata" AS "reviewMetadata",
             q."created_at" AS "createdAt"
      FROM "csca_questions" q
      JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
      WHERE q."subject" = ${subject}
        AND q."source_type" = 'ai'
        AND q."status" = 'approved'
        AND q."created_at" >= NOW() - (${days} * INTERVAL '1 day')
      ORDER BY q."created_at" DESC, q."id" DESC
      LIMIT 500
    `);
    const recentFormalQuestions = recentApprovedQuestions.filter(subjectPracticeFormalQuestion);
    const latestSample = formalQuestions.slice(0, sampleLimit);
    const productionCandidateQuestions = await prisma.$queryRaw(Prisma.sql`
      SELECT q."id", q."subject", q."topic_id" AS "topicId", t."title" AS "topicTitle",
             q."designed_difficulty" AS "difficulty", q."status", q."source_question_id" AS "sourceQuestionId",
             q."prompt", q."options", q."correct_answer" AS "correctAnswer", q."explanation",
             q."generation_metadata" AS "generationMetadata", q."review_metadata" AS "reviewMetadata",
             q."created_at" AS "createdAt", q."updated_at" AS "updatedAt"
      FROM "csca_questions" q
      JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
      WHERE q."subject" = ${subject}
        AND q."source_type" = 'ai'
        AND q."generation_metadata"->>'productionRunId' = ${String(runId)}
        AND q."status" IN ('draft', 'pending_review', 'review_failed')
      ORDER BY q."updated_at" DESC, q."id" DESC
      LIMIT 200
    `);
    const prePublicationUniqueness = prePublicationUniquenessEvidenceFor([
      ...approvedQuestions,
      ...productionCandidateQuestions
    ]);
    const prePublicationUniquenessByCell = new Map(
      prePublicationUniqueness.byCell.map((entry) => [String(entry.cellId ?? 'unknown'), entry])
    );
    const questionPlanTargetCellIds = questionPlanTargetCellIdsForSubject(subject);
    const questionPlanCandidateSupplement = questionPlanTargetCellIds.length
      ? await prisma.$queryRaw(Prisma.sql`
        WITH ranked AS (
          SELECT q."id", q."subject", q."topic_id" AS "topicId", t."title" AS "topicTitle",
                 q."designed_difficulty" AS "difficulty", q."status", q."source_question_id" AS "sourceQuestionId",
                 q."prompt", q."options", q."correct_answer" AS "correctAnswer", q."explanation",
                 q."generation_metadata" AS "generationMetadata", q."review_metadata" AS "reviewMetadata",
                 q."created_at" AS "createdAt", q."updated_at" AS "updatedAt",
                 ROW_NUMBER() OVER (
                   PARTITION BY q."generation_metadata"->>'productionCellId'
                   ORDER BY q."updated_at" DESC, q."id" DESC
                 ) AS "questionPlanRank"
          FROM "csca_questions" q
          JOIN "csca_exam_topics" t ON t."id" = q."topic_id"
          WHERE q."subject" = ${subject}
            AND q."source_type" = 'ai'
            AND q."generation_metadata"->>'productionRunId' = ${String(runId)}
            AND q."generation_metadata"->>'productionCellId' IN (${Prisma.join(questionPlanTargetCellIds)})
            AND q."status" <> 'approved'
        )
        SELECT "id", "subject", "topicId", "topicTitle", "difficulty", "status", "sourceQuestionId",
               "prompt", "options", "correctAnswer", "explanation", "generationMetadata",
               "reviewMetadata", "createdAt", "updatedAt"
        FROM ranked
        WHERE "questionPlanRank" <= 10
        ORDER BY "updatedAt" DESC, "id" DESC
      `)
      : [];
    const questionPlanCandidateQuestions = uniqueRowsById([
      ...productionCandidateQuestions,
      ...questionPlanCandidateSupplement
    ]);
    const questionCounts = await prisma.$queryRaw(Prisma.sql`
      SELECT q."generation_metadata"->>'productionCellId' AS "cellId", q."designed_difficulty" AS "difficulty",
             q."status", COUNT(*)::int AS "count"
      FROM "csca_questions" q
      WHERE q."subject" = ${subject}
        AND q."generation_metadata"->>'productionRunId' = ${String(runId)}
      GROUP BY q."generation_metadata"->>'productionCellId', q."designed_difficulty", q."status"
      ORDER BY q."generation_metadata"->>'productionCellId', q."designed_difficulty", q."status"
    `);
    const candidateCohorts = await prisma.$queryRaw(Prisma.sql`
      SELECT q."generation_metadata"->>'productionCellId' AS "cellId",
             COALESCE(
               q."generation_metadata"->>'generatorVersion',
               q."generation_metadata"->>'localGeneratorVersion',
               q."review_metadata"->'gate'->>'generatorVersion',
               'missing'
             ) AS "generatorVersion",
             COALESCE(q."generation_metadata"->>'questionPlanPolicyVersion', 'missing') AS "questionPlanPolicyVersion",
             COALESCE(q."review_metadata"->'gate'->>'policyVersion', 'missing') AS "gatePolicyVersion",
             q."status" AS "status",
             COALESCE(q."review_metadata"->'gate'->>'decision', 'missing') AS "gateDecision",
             COALESCE(q."review_metadata"->'gate'->'reasons', '[]'::jsonb)
               ? 'profile_difficulty_evidence_mismatch' AS "profileDifficultyMismatch",
             COUNT(*)::int AS "count",
             MIN(q."created_at") AS "firstCreatedAt",
             MAX(q."created_at") AS "lastCreatedAt"
      FROM "csca_questions" q
      WHERE q."subject" = ${subject}
        AND q."generation_metadata"->>'productionRunId' = ${String(runId)}
      GROUP BY q."generation_metadata"->>'productionCellId',
               "generatorVersion", "questionPlanPolicyVersion", "gatePolicyVersion",
               q."status", "gateDecision", "profileDifficultyMismatch"
      ORDER BY q."generation_metadata"->>'productionCellId', MAX(q."created_at") DESC
    `);
    const jobErrors = await prisma.$queryRaw(Prisma.sql`
      SELECT "status", COALESCE("error", '') AS "error", COUNT(*)::int AS "count", MAX("updated_at") AS "latestUpdatedAt"
      FROM "csca_ai_generation_jobs"
      WHERE "prompt_metadata"->>'productionRunId' = ${String(runId)}
      GROUP BY "status", COALESCE("error", '')
      ORDER BY COUNT(*) DESC, "status"
    `);
    const gatewayErrors = await prisma.$queryRaw(Prisma.sql`
      SELECT "status",
             CASE
               WHEN COALESCE("error_code", 'none') = 'provider_bad_request'
                 AND COALESCE("error_message", '') ILIKE '%insufficient balance%'
                 THEN 'provider_quota_exceeded'
               ELSE COALESCE("error_code", 'none')
             END AS "errorCode",
             COUNT(*)::int AS "count", MAX("created_at") AS "latestCreatedAt"
      FROM "ai_gateway_call_logs"
      WHERE "created_at" >= NOW() - (${days} * INTERVAL '1 day')
        AND ("task_type" LIKE '%question%' OR "metadata"::text LIKE '%subject_practice%')
      GROUP BY "status",
        CASE
          WHEN COALESCE("error_code", 'none') = 'provider_bad_request'
            AND COALESCE("error_message", '') ILIKE '%insufficient balance%'
            THEN 'provider_quota_exceeded'
          ELSE COALESCE("error_code", 'none')
        END
      ORDER BY COUNT(*) DESC, "status"
      LIMIT 20
    `);
    const gatewayHardStopSamples = await prisma.$queryRaw(Prisma.sql`
      SELECT "id",
             "request_id" AS "requestId",
             "task_type" AS "taskType",
             "source_module" AS "sourceModule",
             "provider_id" AS "providerId",
             "model",
             "status",
             CASE
               WHEN COALESCE("error_code", 'none') = 'provider_bad_request'
                 AND COALESCE("error_message", '') ILIKE '%insufficient balance%'
                 THEN 'provider_quota_exceeded'
               ELSE COALESCE("error_code", 'none')
             END AS "errorCode",
             LEFT(regexp_replace(COALESCE("error_message", ''), '\\s+', ' ', 'g'), 140) AS "errorMessagePreview",
             "metadata"->>'subject' AS "subject",
             "metadata"->>'topicId' AS "topicId",
             "metadata"->>'blueprintId' AS "blueprintId",
             "metadata"->>'generationTier' AS "generationTier",
             "metadata"->>'questionType' AS "questionType",
             "metadata"->>'observationTaskId' AS "observationTaskId",
             "created_at" AS "createdAt"
      FROM "ai_gateway_call_logs"
      WHERE "created_at" >= NOW() - (${days} * INTERVAL '1 day')
        AND ("task_type" LIKE '%question%' OR "metadata"::text LIKE '%subject_practice%')
        AND (
          COALESCE("error_code", 'none') IN ('provider_auth_error', 'provider_quota_exceeded', 'gateway_key_disabled')
          OR (
            COALESCE("error_code", 'none') = 'provider_bad_request'
            AND COALESCE("error_message", '') ILIKE '%insufficient balance%'
          )
        )
      ORDER BY "created_at" DESC, "id" DESC
      LIMIT 8
    `);
    const cellJobOutcomes = await prisma.$queryRaw(Prisma.sql`
      SELECT "prompt_metadata"->>'productionCellId' AS "cellId",
             "status",
             CASE
               WHEN COALESCE("error", '') ~* 'status=([a-z0-9_]+)' THEN regexp_replace(COALESCE("error", ''), '^.*status=([a-z0-9_]+).*$' ,'\\1')
               WHEN COALESCE("error", '') ~* 'max_attempts_exhausted' THEN 'max_attempts_exhausted'
               WHEN COALESCE("error", '') = '' THEN 'none'
               ELSE left(regexp_replace(COALESCE("error", ''), '\\s+', ' ', 'g'), 80)
             END AS "errorCode",
             COUNT(*)::int AS "count",
             MAX("updated_at") AS "latestUpdatedAt"
      FROM "csca_ai_generation_jobs"
      WHERE "prompt_metadata"->>'productionRunId' = ${String(runId)}
      GROUP BY "prompt_metadata"->>'productionCellId', "status", "errorCode"
      ORDER BY COUNT(*) DESC, "status"
    `);
    const cellGateReasons = await prisma.$queryRaw(Prisma.sql`
      SELECT q."generation_metadata"->>'productionCellId' AS "cellId",
             reason."value" AS "reason",
             COUNT(*)::int AS "count",
             MAX(q."updated_at") AS "latestUpdatedAt"
      FROM "csca_questions" q
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(q."review_metadata"->'gate'->'reasons', '[]'::jsonb)) AS reason("value")
      WHERE q."subject" = ${subject}
        AND q."generation_metadata"->>'productionRunId' = ${String(runId)}
        AND q."status" <> 'approved'
      GROUP BY q."generation_metadata"->>'productionCellId', reason."value"
      ORDER BY COUNT(*) DESC, reason."value"
    `);
    const cellCandidateOutcomes = await prisma.$queryRaw(Prisma.sql`
      WITH candidate_outcomes AS (
        SELECT q."generation_metadata"->>'productionCellId' AS "cellId",
               q."status" AS "status",
               COALESCE(q."review_metadata"->'gate'->>'decision', '') AS "gateDecision",
               COALESCE(q."review_metadata"->'gate'->>'publishable', '') AS "gatePublishable",
               CASE
                 WHEN jsonb_typeof(q."review_metadata"->'gate'->'reasons') = 'array'
                   THEN jsonb_array_length(q."review_metadata"->'gate'->'reasons')
                 ELSE 0
               END AS "gateReasonCount"
        FROM "csca_questions" q
        WHERE q."subject" = ${subject}
          AND q."generation_metadata"->>'productionRunId' = ${String(runId)}
      )
      SELECT "cellId",
             COUNT(*) FILTER (WHERE "status" <> 'approved')::int AS "nonApprovedCount",
             COUNT(*) FILTER (WHERE "status" = 'pending_review')::int AS "pendingReviewCount",
             COUNT(*) FILTER (WHERE "status" = 'draft')::int AS "draftCount",
             COUNT(*) FILTER (WHERE
               "status" = 'review_failed'
               OR "gateDecision" IN ('reject', 'regenerate', 'review_failed')
               OR "gatePublishable" = 'false'
               OR "gateReasonCount" > 0
             )::int AS "rejectedCount",
             COUNT(*) FILTER (WHERE
               "status" <> 'approved'
               AND "gateReasonCount" = 0
               AND ("gateDecision" = 'publishable' OR "gatePublishable" = 'true')
             )::int AS "publishablePendingCount",
             COUNT(*) FILTER (WHERE
               (
                 "status" = 'review_failed'
                 OR "gateDecision" IN ('reject', 'regenerate', 'review_failed')
                 OR "gatePublishable" = 'false'
               )
               AND "gateReasonCount" = 0
             )::int AS "unclassifiedRejectedCount",
             COUNT(*) FILTER (WHERE
               "status" <> 'approved'
               AND "status" <> 'review_failed'
               AND "gateDecision" NOT IN ('reject', 'regenerate', 'review_failed', 'publishable')
               AND "gatePublishable" NOT IN ('true', 'false')
               AND "gateReasonCount" = 0
             )::int AS "unclassifiedNonApprovedCount"
      FROM candidate_outcomes
      GROUP BY "cellId"
    `);
    const rawPublishedTotal = cells.reduce((sum, cell) => sum + asNumber(cell.publishedCount), 0);
    const cappedPublishedTotal = cells.reduce((sum, cell) => sum + Math.min(asNumber(cell.publishedCount), asNumber(cell.targetCount)), 0);
    const overflowTotal = cells.reduce((sum, cell) => sum + Math.max(0, asNumber(cell.publishedCount) - asNumber(cell.targetCount)), 0);
    const computedOpenTotal = cells.reduce((sum, cell) => sum + Math.max(0, asNumber(cell.targetCount) - asNumber(cell.publishedCount)), 0);
    const cellJobOutcomeMap = cellJobOutcomes.reduce((map, row) => {
      const cellId = cleanText(row.cellId);
      if (!map.has(cellId)) map.set(cellId, []);
      map.get(cellId).push({
        status: row.status,
        errorCode: row.errorCode,
        count: asNumber(row.count),
        latestUpdatedAt: row.latestUpdatedAt
      });
      return map;
    }, new Map());
    const cellGateReasonMap = cellGateReasons.reduce((map, row) => {
      const cellId = cleanText(row.cellId);
      if (!map.has(cellId)) map.set(cellId, []);
      map.get(cellId).push({
        reason: row.reason,
        count: asNumber(row.count),
        latestUpdatedAt: row.latestUpdatedAt
      });
      return map;
    }, new Map());
    const cellCandidateOutcomeMap = cellCandidateOutcomes.reduce((map, row) => {
      map.set(cleanText(row.cellId), row);
      return map;
    }, new Map());
    const candidateCohortMap = candidateCohorts.reduce((map, row) => {
      const cellId = cleanText(row.cellId);
      if (!map.has(cellId)) map.set(cellId, []);
      map.get(cellId).push({
        generatorVersion: cleanText(row.generatorVersion) || 'missing',
        questionPlanPolicyVersion: cleanText(row.questionPlanPolicyVersion) || 'missing',
        gatePolicyVersion: cleanText(row.gatePolicyVersion) || 'missing',
        status: cleanText(row.status) || 'missing',
        gateDecision: qualityAuditDisplayGateDecision(row.gateDecision) || cleanText(row.gateDecision) || 'missing',
        profileDifficultyMismatch: row.profileDifficultyMismatch === true,
        count: asNumber(row.count),
        firstCreatedAt: row.firstCreatedAt,
        lastCreatedAt: row.lastCreatedAt
      });
      return map;
    }, new Map());
    const formalPublishedQuestionCountByCell = formalQuestions.reduce((map, question) => {
      const cellId = cleanText(get(question.generationMetadata, 'productionCellId'));
      if (!cellId) return map;
      map.set(cellId, (map.get(cellId) ?? 0) + 1);
      return map;
    }, new Map());
    const cellSummaries = cells.map((cell) => {
      const running = runningByCell.get(String(cell.id)) ?? {};
      const strategy = recordFrom(recordFrom(cell.targetProfile).generationStrategy);
      const jobOutcomes = cellJobOutcomeMap.get(String(cell.id)) ?? [];
      const topJobErrors = mergeCountRows(
        jobOutcomes.filter((item) => item.errorCode && item.errorCode !== 'none'),
        'errorCode',
        5
      );
      const topGateReasons = mergeCountRows(cellGateReasonMap.get(String(cell.id)) ?? [], 'reason', 5);
      const jobAttemptCount = jobOutcomes.reduce((sum, item) => sum + item.count, 0);
      const generatedQuestionCount = questionCounts
        .filter((row) => cleanText(row.cellId) === String(cell.id))
        .reduce((sum, row) => sum + asNumber(row.count), 0);
      const approvedGeneratedCount = questionCounts
        .filter((row) => cleanText(row.cellId) === String(cell.id) && cleanText(row.status) === 'approved')
        .reduce((sum, row) => sum + asNumber(row.count), 0);
      const candidateOutcome = cellCandidateOutcomeMap.get(String(cell.id)) ?? {};
      const nonApprovedGeneratedCount = asNumber(candidateOutcome.nonApprovedCount);
      const pendingReviewGeneratedCount = asNumber(candidateOutcome.pendingReviewCount);
      const draftGeneratedCount = asNumber(candidateOutcome.draftCount);
      const rejectedGeneratedCount = asNumber(candidateOutcome.rejectedCount);
      const publishablePendingGeneratedCount = asNumber(candidateOutcome.publishablePendingCount);
      const unclassifiedRejectedCount = Math.min(rejectedGeneratedCount, asNumber(candidateOutcome.unclassifiedRejectedCount));
      const unclassifiedNonApprovedCount = asNumber(candidateOutcome.unclassifiedNonApprovedCount);
      const gatePassedGeneratedCount = approvedGeneratedCount + publishablePendingGeneratedCount;
      const storedPublishedCount = asNumber(cell.publishedCount);
      const formalPublishedQuestionCount = asNumber(formalPublishedQuestionCountByCell.get(String(cell.id)));
      const reconciledPublishedCount = Math.max(storedPublishedCount, formalPublishedQuestionCount);
      const storedOpenCount = Math.max(0, asNumber(cell.targetCount) - storedPublishedCount);
      const reconciledOpenCount = Math.max(0, asNumber(cell.targetCount) - reconciledPublishedCount);
      const hasPublishedCountMismatch = formalPublishedQuestionCount > storedPublishedCount;
      const primaryBottleneck = primaryCellBottleneckFor({
        storedOpenCount,
        reconciledOpenCount,
        hasPublishedCountMismatch,
        topGateReasonCount: topGateReasons.length,
        rejectedGeneratedCount,
        approvedGeneratedCount,
        unclassifiedRejectedCount,
        topJobErrorCount: topJobErrors.length,
        generatedQuestionCount,
        jobAttemptCount
      });
      const cellPrePublicationUniqueness = prePublicationUniquenessByCell.get(String(cell.id)) ?? {
        cellId: Number(cell.id),
        checkedCount: 0,
        passedCount: 0,
        blockedCount: 0,
        unknownEvidenceCount: 0,
        legacyMissingEligibleEvidenceCount: 0,
        notReachedFormalGateCount: 0
      };
      return {
        id: Number(cell.id),
        topicTitle: cell.topicTitle,
        difficulty: cell.difficulty,
        status: cell.status,
        failureCode: cleanText(cell.failureCode),
        failureMessage: cleanText(cell.failureMessage),
        targetCount: asNumber(cell.targetCount),
        publishedCount: storedPublishedCount,
        formalPublishedQuestionCount,
        reconciledPublishedCount,
        storedOpenCount,
        openCount: storedOpenCount,
        reconciledOpenCount,
        publishedCountReconciliation: hasPublishedCountMismatch
          ? {
            status: 'stored_published_count_lags_formal_subject_practice_publication',
            storedPublishedCount,
            formalPublishedQuestionCount,
            reconciledPublishedCount,
            storedOpenCount,
            reconciledOpenCount,
            productionImpact: 'none_audit_only',
            dbImpact: 'read_only_reconciliation_signal'
          }
          : null,
        candidateCount: asNumber(cell.candidateCount),
        failedCount: asNumber(cell.failedCount),
        storedRunningJobCount: asNumber(cell.storedRunningJobCount),
        queuedJobCount: asNumber(running.queued),
        rawRunningJobCount: asNumber(running.rawRunning),
        activeRunningJobCount: asNumber(running.activeRunning),
        activeJobCount: asNumber(running.queued) + asNumber(running.activeRunning),
        staleRunningJobCount: asNumber(running.staleRunning),
        topicFamily: cleanText(strategy.topicFamily),
        requiredStemPattern: cleanText(strategy.requiredStemPattern),
        minimumDiversityAxesPerRetry: strategy.minimumDiversityAxesPerRetry,
        productionDiagnostics: {
          jobAttemptCount,
          generatedQuestionCount,
          approvedGeneratedCount,
          nonApprovedGeneratedCount,
          pendingReviewGeneratedCount,
          draftGeneratedCount,
          rejectedGeneratedCount,
          publishablePendingGeneratedCount,
          gatePassedGeneratedCount,
          classifiedRejectedCount: Math.max(0, rejectedGeneratedCount - unclassifiedRejectedCount),
          unclassifiedRejectedCount,
          unclassifiedNonApprovedCount,
          publishYield: generatedQuestionCount > 0 ? Number((approvedGeneratedCount / generatedQuestionCount).toFixed(3)) : null,
          gatePassYield: generatedQuestionCount > 0 ? Number((gatePassedGeneratedCount / generatedQuestionCount).toFixed(3)) : null,
          candidateCohorts: candidateCohortMap.get(String(cell.id)) ?? [],
          topJobErrors,
          topGateReasons,
          prePublicationUniqueness: cellPrePublicationUniqueness,
          primaryBottleneck,
          nextDiagnosticAction: primaryBottleneck === 'unclassified_candidate_rejection'
            ? 'inspect_candidate_review_metadata_and_replay_current_gate_before_more_provider_spend'
            : null
        }
      };
    });
    const terminalIncompleteOpenTotal = cellSummaries
      .filter((cell) => cell.status === 'blocked' && cell.failureCode === 'pro_candidate_limit_reached')
      .reduce((sum, cell) => sum + cell.openCount, 0);
    const reconciledPublishedTotal = cellSummaries.reduce((sum, cell) => sum + Math.min(asNumber(cell.reconciledPublishedCount), asNumber(cell.targetCount)), 0);
    const reconciledOpenTotal = cellSummaries.reduce((sum, cell) => sum + asNumber(cell.reconciledOpenCount), 0);
    const reconciledTerminalIncompleteOpenTotal = cellSummaries
      .filter((cell) => cell.status === 'blocked' && cell.failureCode === 'pro_candidate_limit_reached')
      .reduce((sum, cell) => sum + asNumber(cell.reconciledOpenCount), 0);
    const dispatchableOpenTotal = Math.max(0, computedOpenTotal - terminalIncompleteOpenTotal);
    const reconciledDispatchableOpenTotal = Math.max(0, reconciledOpenTotal - reconciledTerminalIncompleteOpenTotal);
    const formalBlockers = approvedQuestions.flatMap((question) => {
      const reasons = formalQuestionBlockers(question);
      return reasons.length ? [{
        id: Number(question.id),
        topicTitle: question.topicTitle,
        difficulty: question.difficulty,
        reasons,
        prompt: short(question.prompt, 180)
      }] : [];
    });
    const rawDifficultyAuditFindings = [
      ...mathDifficultyFindingsFor(formalQuestions, subject),
      ...physicsDifficultyFindingsFor(formalQuestions, subject)
    ];
    const rawRecentDifficultyAuditFindings = [
      ...mathDifficultyFindingsFor(recentFormalQuestions, subject),
      ...physicsDifficultyFindingsFor(recentFormalQuestions, subject)
    ];
    const difficultyVisibilityByQuestionId = await practiceVisibilityForDifficultyFindings(
      prisma,
      [...rawDifficultyAuditFindings, ...rawRecentDifficultyAuditFindings]
    );
    const difficultyAuditFindings = withPracticeVisibility(rawDifficultyAuditFindings, difficultyVisibilityByQuestionId, {
      currentPolicyBlocks: subject === 'math' || subject === 'physics'
    });
    const recentDifficultyAuditFindings = withPracticeVisibility(rawRecentDifficultyAuditFindings, difficultyVisibilityByQuestionId, {
      currentPolicyBlocks: subject === 'math' || subject === 'physics'
    });
    const recentFamilySignals = recentFamilySignalsFor(recentFormalQuestions, subject);
    const recentFamilyCoverage = {
      ...familyCoverageSummaryFor(recentFormalQuestions, subject),
      coverageSource: 'recent_formal_window'
    };
    const currentRunFamilyCoverage = {
      ...familyCoverageSummaryFor(formalQuestions, subject),
      coverageSource: 'current_run_formal_questions'
    };
    const readinessFamilyCoverage = subject === 'physics'
      && Number(recentFamilyCoverage.totalQuestionCount) === 0
      && Number(currentRunFamilyCoverage.totalQuestionCount) > 0
        ? {
          ...currentRunFamilyCoverage,
          coverageSource: 'current_run_formal_fallback_after_empty_recent_window',
          fallbackFrom: 'recent_formal_window_empty'
        }
        : recentFamilyCoverage;
    const recentNearDuplicateSignals = nearDuplicateSignalsFor(recentFormalQuestions, subject);
    const recentNearDuplicateRecommendations = nearDuplicateRecommendationsFor(recentNearDuplicateSignals, subject);
    const recentNearDuplicateCalibration = nearDuplicateCalibrationFor(recentNearDuplicateSignals, subject, recentFormalQuestions.length);
    const schedulerHintDryRun = schedulerHintDryRunFor(recentFormalQuestions, subject, productionCandidateQuestions);
    const schedulerHintAdherence = schedulerHintAdherenceFor(productionCandidateQuestions, subject);
    const profileDifficultyPatchEvidence = profileDifficultyPatchEvidenceSummaryFor(productionCandidateQuestions);
    const currentReviewerProfileReplay = await currentReviewerProfileReplayFor(productionCandidateQuestions, cells, subject);
    const mathSchedulerHintQualityAudit = subject === 'math'
      ? mathSchedulerHintQualityAuditSummary(schedulerHintAdherence, qualityAuditLedger)
      : null;
    const mathSoftCapDryRun = mathSoftCapDryRunFor(recentFormalQuestions, subject, recentNearDuplicateSignals, qualityAuditLedger);
    const mathOtherFamilyPromotionDryRun = mathOtherFamilyPromotionDryRunFor(recentFormalQuestions, subject);
    const physicsDifficultyQualityAudit = subject === 'physics'
      ? physicsDifficultyQualityAuditSummary(recentDifficultyAuditFindings, qualityAuditLedger)
      : null;
    const storedDiversityObservationSummary = storedDiversityObservationSummaryFor(recentFormalQuestions, subject);
    const candidateDiversityObservationReplay = mathCandidateDiversityObservationReplayFor(productionCandidateQuestions, recentFormalQuestions, subject);
    const questionPlanApplicability = questionPlanApplicabilityFor(cellSummaries, subject);
    const questionPlanCalibration = questionPlanCalibrationFor(questionPlanCandidateQuestions, subject, 10);
    const questionPlanExecution = questionPlanExecutionFor(questionPlanCandidateQuestions, subject);
    const questionPlanRetryMemory = questionPlanRetryMemoryFor(questionPlanCandidateQuestions, subject);
    const mathQuestionPlanShadow = mathQuestionPlanShadowFor(cellSummaries, questionPlanCandidateQuestions, subject);
    const physicsQuestionPlanShadow = physicsQuestionPlanShadowFor(cellSummaries, questionPlanCandidateQuestions, subject);
    const sampleItems = latestSample.map((question) => {
      const family = promptFamily(question.prompt, question);
      const fingerprint = questionFingerprint(question, family);
      const storedFingerprint = recordFrom(get(question.generationMetadata, 'questionFingerprint'));
      const storedTaskFamily = cleanText(storedFingerprint?.taskFamily);
      const storedFingerprintPolicyVersion = cleanText(storedFingerprint?.fingerprintPolicyVersion ?? storedFingerprint?.policyVersion);
      const recomputedFingerprintPolicyVersion = cleanText(fingerprint.fingerprintPolicyVersion ?? fingerprint.policyVersion);
      const sameFingerprintPolicy = Boolean(storedFingerprintPolicyVersion)
        && storedFingerprintPolicyVersion === recomputedFingerprintPolicyVersion;
      return {
        id: Number(question.id),
        topicTitle: question.topicTitle,
        difficulty: question.difficulty,
        correctAnswer: question.correctAnswer,
        family,
        fingerprintSource: storedFingerprint ? (sameFingerprintPolicy ? 'stored_and_recomputed' : 'stored_policy_drift') : 'recomputed_only',
        storedFingerprintPolicyVersion: storedFingerprintPolicyVersion || null,
        recomputedFingerprintPolicyVersion: recomputedFingerprintPolicyVersion || null,
        fingerprintMatchesStored: storedFingerprint && sameFingerprintPolicy ? storedTaskFamily === cleanText(fingerprint.taskFamily) : null,
        fingerprint: {
          taskFamily: fingerprint.taskFamily,
          representationType: fingerprint.representationType,
          quantitativeShape: fingerprint.quantitativeShape,
          answerForm: fingerprint.answerForm,
          objects: fingerprint.objects,
          subjectExtension: fingerprint.subjectExtension,
          policyVersion: fingerprint.policyVersion
        },
        difficultyAudit: subject === 'math'
          ? mathDifficultyAudit(question, family)
          : subject === 'physics'
            ? physicsDifficultyAudit(question, family)
            : null,
        prompt: short(question.prompt, 180),
        explanation: short(question.explanation, 220)
      };
    });
    const diversityByCell = new Map();
    for (const question of formalQuestions) {
      const cellId = cleanText(get(question.generationMetadata, 'productionCellId'));
      const entry = diversityByCell.get(cellId) ?? {
        cellId,
        topicTitle: question.topicTitle,
        difficulty: question.difficulty,
        count: 0,
        families: new Map(),
        answerShapes: new Map()
      };
      entry.count += 1;
      const family = promptFamily(question.prompt, question);
      entry.families.set(family, (entry.families.get(family) ?? 0) + 1);
      entry.answerShapes.set(cleanText(question.correctAnswer), (entry.answerShapes.get(cleanText(question.correctAnswer)) ?? 0) + 1);
      diversityByCell.set(cellId, entry);
    }
    const diversitySignals = Array.from(diversityByCell.values()).map((entry) => {
      const topFamily = topEntries(entry.families, 1)[0] ?? ['none', 0];
      const topAnswer = topEntries(entry.answerShapes, 1)[0] ?? ['none', 0];
      const warningReasons = [];
      if (entry.count >= 3 && topFamily[1] >= 2 && topFamily[1] / entry.count >= 0.6) warningReasons.push('early_repeated_task_family');
      if (entry.count >= 5 && entry.families.size < 3) warningReasons.push('low_task_family_variety');
      if (entry.count >= 5 && topFamily[1] / entry.count >= 0.7) warningReasons.push('dominant_task_family');
      if (entry.count >= 8 && topAnswer[1] / entry.count >= 0.7) warningReasons.push('dominant_correct_answer_shape');
      return {
        cellId: entry.cellId,
        topicTitle: entry.topicTitle,
        difficulty: entry.difficulty,
        count: entry.count,
        familyCount: entry.families.size,
        topFamilies: topEntries(entry.families),
        topAnswers: topEntries(entry.answerShapes),
        warningReasons
      };
    });
    const jobErrorSummary = topEntries(jobErrors.reduce((map, row) => {
      const key = gatewayStatusFromJobError(row.error);
      map.set(key, (map.get(key) ?? 0) + asNumber(row.count));
      return map;
    }, new Map()), 12).map(([errorCode, count]) => ({ errorCode, count }));
    const p0p1 = [];
    if (formalBlockers.length) p0p1.push(`formal_question_blockers:${formalBlockers.length}`);
    const p1DifficultyFindings = difficultyAuditFindings.filter((item) => item.severity === 'P1');
    if (subject === 'math' && p1DifficultyFindings.length) p0p1.push(`math_hard_simple_task_family:${p1DifficultyFindings.length}`);
    const recentP1DifficultyFindings = recentDifficultyAuditFindings.filter((item) => item.severity === 'P1');
    if (subject === 'math' && recentP1DifficultyFindings.length > p1DifficultyFindings.length) {
      p0p1.push(`recent_math_hard_simple_task_family:${recentP1DifficultyFindings.length}`);
    }
    const recentStudentPoolImpact = summarizeStudentPoolImpact(recentDifficultyAuditFindings);
    if (subject === 'math' && recentStudentPoolImpact.visibleDifficultyBlockerCount > difficultyAuditFindings.filter((item) => item.studentPoolStatus === 'adaptive_candidate_visible').length) {
      p0p1.push(`recent_visible_math_difficulty_gate_blockers:${recentStudentPoolImpact.visibleDifficultyBlockerCount}`);
    }
    if (subject === 'math' && recentStudentPoolImpact.visibleRunlessDifficultyBlockerCount) {
      p0p1.push(`visible_runless_math_difficulty_gate_blockers:${recentStudentPoolImpact.visibleRunlessDifficultyBlockerCount}`);
    }
    if (subject === 'math' && recentStudentPoolImpact.dbAdaptiveEligibleRunlessDifficultyBlockerCount) {
      p0p1.push(`db_published_runless_math_difficulty_gate_blockers:${recentStudentPoolImpact.dbAdaptiveEligibleRunlessDifficultyBlockerCount}`);
    }
    const storedActiveMismatch = cellSummaries.filter((cell) => cell.storedRunningJobCount !== cell.activeJobCount);
    const safeStoredActiveUndercount = storedActiveMismatch.filter((cell) => (
      cell.staleRunningJobCount === 0
      && cell.activeJobCount > cell.storedRunningJobCount
    ));
    const unsafeStoredActiveMismatch = storedActiveMismatch.filter((cell) => !safeStoredActiveUndercount.includes(cell));
    if (unsafeStoredActiveMismatch.length) p0p1.push(`stored_active_job_count_needs_refresh:${unsafeStoredActiveMismatch.length}`);
    const storedActiveWarnings = safeStoredActiveUndercount.length
      ? [`stored_active_job_count_safe_active_undercount:${safeStoredActiveUndercount.length}`]
      : [];
    const openCellsWithoutActiveJobs = cellSummaries.filter((cell) => (
      cell.reconciledOpenCount > 0
      && cell.activeJobCount === 0
      && !(cell.status === 'blocked' && cell.failureCode === 'pro_candidate_limit_reached')
    ));
    const activeJobLimit = subjectPracticeActiveJobLimit();
    const activeProductionCells = cellSummaries
      .filter((cell) => cell.activeJobCount > 0)
      .sort((left, right) => right.activeJobCount - left.activeJobCount || left.id - right.id);
    const activeProductionJobCount = activeProductionCells.reduce((sum, cell) => sum + cell.activeJobCount, 0);
    const activeCapacityRemaining = Math.max(0, activeJobLimit - activeProductionJobCount);
    const activeCapacityStatus = activeCapacityRemaining > 0 ? 'capacity_available' : 'capacity_exhausted';
    const openCellsWaitingForDispatch = openCellsWithoutActiveJobs.map((cell) => ({
      id: cell.id,
      topicTitle: cell.topicTitle,
      difficulty: cell.difficulty,
      openCount: cell.reconciledOpenCount,
      storedOpenCount: cell.openCount,
      reconciledOpenCount: cell.reconciledOpenCount,
      candidateCount: cell.candidateCount,
      failedCount: cell.failedCount,
      primaryBottleneck: cell.productionDiagnostics.primaryBottleneck,
      unclassifiedRejectedCount: cell.productionDiagnostics.unclassifiedRejectedCount,
      dispatchWaitReason: cell.productionDiagnostics.primaryBottleneck === 'unclassified_candidate_rejection'
        ? 'unclassified_candidate_rejection_requires_diagnostics'
        : activeCapacityRemaining > 0
          ? 'runner_or_manual_process_required'
          : 'active_capacity_exhausted_by_existing_jobs',
      nextSafeAction: cell.productionDiagnostics.primaryBottleneck === 'unclassified_candidate_rejection'
        ? 'inspect_candidate_review_metadata_and_replay_current_gate_before_more_provider_spend'
        : activeCapacityRemaining > 0
          ? 'process_subject_practice_run_or_enqueue_exact_scoped_job_after_authorization'
          : 'let_or_authorize_existing_active_jobs_finish_before_enqueueing_more'
    }));
    const providerLikeErrors = new Set([
      'provider_auth_error',
      'provider_bad_request',
      'provider_empty_output',
      'provider_timeout',
      'provider_schema_invalid',
      'provider_network_error',
      'provider_rate_limited',
      'provider_unavailable',
      'provider_quota_exceeded',
      'gateway_key_cooldown',
      'gateway_concurrency_timeout',
      'gateway_key_concurrency_saturated',
      'gateway_key_rate_limited',
      'gateway_key_disabled',
      'gateway_no_key_available',
      'gateway_unknown_error',
      'no_key_available'
    ]);
    const providerErrors = jobErrorSummary.filter((item) => providerLikeErrors.has(item.errorCode));
    const diversityEngineReadiness = diversityEngineReadinessFor({
      subject,
      familyCoverage: readinessFamilyCoverage,
      nearDuplicateCalibration: recentNearDuplicateCalibration,
      schedulerHintDryRun,
      schedulerHintAdherence,
      profileDifficultyPatchEvidence,
      currentReviewerProfileReplay,
      mathSchedulerHintQualityAudit,
      mathQuestionPlanShadow,
      physicsQuestionPlanShadow,
      mathSoftCapDryRun,
      candidateDiversityObservationReplay,
      studentPoolImpact: recentStudentPoolImpact,
      difficultyAuditFindings: recentDifficultyAuditFindings,
      physicsDifficultyQualityAudit,
      p0p1
    });
    const report = {
      run: {
        id: runId,
        subject,
        status: run.status,
        targetTotal: asNumber(run.targetTotal),
        storedPublishedTotal: asNumber(run.publishedTotal),
        cappedPublishedTotal,
        rawPublishedTotal,
        overflowTotal,
        storedOpenTotal: asNumber(run.openTotal),
        computedOpenTotal,
        reconciledPublishedTotal,
        reconciledOpenTotal,
        dispatchableOpenTotal,
        reconciledDispatchableOpenTotal,
        terminalIncompleteOpenTotal,
        reconciledTerminalIncompleteOpenTotal,
        openTotalSemantics: 'computedOpenTotal=stored_cell_gap; reconciledOpenTotal=formal_subject_practice_publish_count_reconciled_gap; storedOpenTotal=dispatchable_gap_excluding_terminal_incomplete_cells',
        blockedReasonCode: run.blockedReasonCode,
        updatedAt: run.updatedAt
      },
      cells: cellSummaries,
      questionCounts,
      latestSample: sampleItems,
      quality: {
        approvedQuestionCount: approvedQuestions.length,
        formalQuestionCount: formalQuestions.length,
        sampledCount: latestSample.length,
        formalBlockers,
        difficultyAuditFindings,
        storedActiveWarnings,
        p0p1
      },
      prePublicationUniqueness,
      diversity: {
        signals: diversitySignals,
        warnings: diversitySignals.filter((item) => item.warningReasons.length)
      },
      recentFormalWindow: {
        days,
        approvedQuestionCount: recentApprovedQuestions.length,
        formalQuestionCount: recentFormalQuestions.length,
        difficultyAuditFindings: recentDifficultyAuditFindings,
        difficultyGateRetirementCoverage: summarizeRetirementCoverage(recentDifficultyAuditFindings),
        studentPoolImpact: summarizeStudentPoolImpact(recentDifficultyAuditFindings),
        familyCoverage: recentFamilyCoverage,
        familySignals: recentFamilySignals,
        nearDuplicateSignals: recentNearDuplicateSignals,
        nearDuplicateRecommendations: recentNearDuplicateRecommendations,
        nearDuplicateCalibration: recentNearDuplicateCalibration,
        schedulerHintDryRun,
        schedulerHintAdherence,
        profileDifficultyPatchEvidence,
        currentReviewerProfileReplay,
        mathSchedulerHintQualityAudit,
        mathSoftCapDryRun,
        mathOtherFamilyPromotionDryRun,
        physicsDifficultyQualityAudit,
        storedDiversityObservationSummary,
        candidateDiversityObservationReplay,
        questionPlanApplicability,
        questionPlanCalibration,
        questionPlanExecution,
        questionPlanRetryMemory,
        mathQuestionPlanShadow,
        physicsQuestionPlanShadow,
        qualityAuditLedger: diversityQualityAuditLedgerSummary(qualityAuditLedger),
        diversityEngineReadiness
      },
      productionDiagnosticsSemantics: {
        version: 'subject-practice-production-diagnostics-funnel-v2-gate-outcome-aware',
        approvedGeneratedCount: 'question_status_approved',
        rejectedGeneratedCount: 'distinct_nonapproved_candidate_with_review_failed_status_or_explicit_gate_reject_regenerate_false_or_reason',
        publishablePendingGeneratedCount: 'nonapproved_candidate_with_empty_gate_reasons_and_publishable_true_or_decision',
        nonApprovedGeneratedCount: 'all_generated_candidates_whose_status_is_not_approved',
        gatePassedGeneratedCount: 'approved_plus_publishable_pending',
        publishYield: 'approved_divided_by_generated',
        gatePassYield: 'gate_passed_divided_by_generated',
        pendingReviewIsNotAutomaticallyRejected: true
      },
      productionDiagnostics: cellSummaries.map((cell) => ({
        cellId: cell.id,
        topicTitle: cell.topicTitle,
        difficulty: cell.difficulty,
        ...cell.productionDiagnostics
      })),
      provider: {
        jobErrorSummary,
        gatewayErrors,
        gatewayHardStopSamples,
        providerErrors,
        openCellsWithoutActiveJobs,
        dispatchCapacity: {
          activeJobLimit,
          activeProductionJobCount,
          activeCapacityRemaining,
          activeCapacityStatus,
          activeProductionCells: activeProductionCells.map((cell) => ({
            id: cell.id,
            topicTitle: cell.topicTitle,
            difficulty: cell.difficulty,
            queuedJobCount: cell.queuedJobCount,
            activeRunningJobCount: cell.activeRunningJobCount,
            activeJobCount: cell.activeJobCount,
            openCount: cell.openCount,
            primaryBottleneck: cell.productionDiagnostics.primaryBottleneck
          })),
          openCellsWaitingForDispatch
        }
      }
    };
    if (readinessOnly) {
      console.log(JSON.stringify(report.recentFormalWindow.diversityEngineReadiness, jsonReplacer, 2));
    } else if (json) {
      console.log(JSON.stringify(report, jsonReplacer, 2));
    } else {
      console.log(`Subject-practice production audit: ${subject} run #${runId}`);
      console.log(`Progress: capped ${cappedPublishedTotal}/${run.targetTotal}, raw formal ${rawPublishedTotal}, overflow ${overflowTotal}, totalGap=${computedOpenTotal}, dispatchable=${asNumber(run.openTotal)}, terminalIncomplete=${terminalIncompleteOpenTotal}`);
      console.log(`Status: ${run.status}${run.blockedReasonCode ? `, blocked=${run.blockedReasonCode}` : ''}`);
      console.log('\nCells');
      for (const cell of cellSummaries) {
        console.log(`- #${cell.id} ${cell.topicTitle} ${cell.difficulty}: ${cell.publishedCount}/${cell.targetCount}, open=${cell.openCount}, status=${cell.status}${cell.failureCode ? `(${cell.failureCode})` : ''}, queued=${cell.queuedJobCount}, activeRunning=${cell.activeRunningJobCount}, activeJobs=${cell.activeJobCount}, staleRunning=${cell.staleRunningJobCount}, failed=${cell.failedCount}, strategy=${cell.topicFamily}/${cell.requiredStemPattern}`);
      }
      console.log('\nQuality');
      console.log(`- approved questions: ${approvedQuestions.length}; formal questions: ${formalQuestions.length}; sampled latest: ${latestSample.length}; blockers: ${formalBlockers.length}`);
      console.log(`- pre-publication uniqueness: checked=${prePublicationUniqueness.checkedCount}, passed=${prePublicationUniqueness.passedCount}, blocked=${prePublicationUniqueness.blockedCount}, legacyMissingEligible=${prePublicationUniqueness.legacyMissingEligibleEvidenceCount}, coverage=${prePublicationUniqueness.evidenceCoverage ?? 'n/a'}`);
      for (const blocker of formalBlockers.slice(0, 8)) {
        console.log(`  - #${blocker.id} ${blocker.topicTitle} ${blocker.difficulty}: ${blocker.reasons.join(', ')} :: ${blocker.prompt}`);
      }
      if (difficultyAuditFindings.length) {
        console.log(`- ${subject} difficulty findings: ${difficultyAuditFindings.length}`);
        for (const finding of difficultyAuditFindings.slice(0, 10)) {
          console.log(`  - [${finding.severity}] #${finding.id} retire=${finding.retirementCoverage} pool=${finding.studentPoolStatus} spq=${finding.practiceVisibility.sourceQuestionId || 'n/a'} ${finding.topicTitle} ${finding.difficulty}: ${finding.reasonCode}/${finding.family} :: ${finding.prompt}`);
        }
      }
      console.log('\nDiversity');
      for (const signal of diversitySignals) {
        const warning = signal.warningReasons.length ? ` WARN ${signal.warningReasons.join(',')}` : '';
        console.log(`- cell ${signal.cellId} ${signal.difficulty}: families=${signal.familyCount}/${signal.count}, top=${signal.topFamilies.map(([name, count]) => `${name}:${count}`).join(', ')}${warning}`);
      }
      if (['chemistry', 'math', 'physics'].includes(subject)) {
        console.log(`\nRecent Formal ${subject} Window (${days}d)`);
        console.log(`- approved AI questions: ${recentApprovedQuestions.length}; formal subject-practice questions: ${recentFormalQuestions.length}`);
        console.log(`- family coverage: known=${recentFamilyCoverage.knownFamilyCount}/${recentFamilyCoverage.totalQuestionCount} (${recentFamilyCoverage.knownFamilyRatio}), other=${recentFamilyCoverage.otherCount}, distinct=${recentFamilyCoverage.distinctFamilyCount}`);
        if (recentFamilyCoverage.topFamilies.length) {
          console.log(`  - top families: ${recentFamilyCoverage.topFamilies.map((item) => `${item.family}:${item.count}`).join(', ')}`);
        }
        if (recentFamilyCoverage.otherClusters.length) {
          console.log(`  - other clusters: ${recentFamilyCoverage.otherClusters.map((item) => `${item.topicTitle}/${item.difficulty}:${item.count}`).join(', ')}`);
        }
        if (recentFamilyCoverage.otherFamilySuggestions.length) {
          console.log(`  - audit-only other-family suggestions: ${recentFamilyCoverage.otherFamilySuggestions.map((item) => `${item.suggestedFamily}/${item.topicTitle}/${item.difficulty}:${item.count}`).join(', ')}`);
        }
        if (recentFamilyCoverage.otherSamples.length) {
          console.log(`  - other samples: ${recentFamilyCoverage.otherSamples.map((item) => `#${item.id} ${item.topicTitle}/${item.difficulty}`).join(', ')}`);
        }
        if (recentDifficultyAuditFindings.length) {
          console.log(`- difficulty findings: ${recentDifficultyAuditFindings.length}`);
          const coverageText = summarizeRetirementCoverage(recentDifficultyAuditFindings)
            .map((item) => `${item.retirementCoverage}:${item.count}`)
            .join(', ');
          if (coverageText) console.log(`- difficulty retirement coverage: ${coverageText}`);
          if (subject === 'math') {
            const poolImpact = summarizeStudentPoolImpact(recentDifficultyAuditFindings);
            const poolText = poolImpact.byStudentPoolStatus.map((item) => `${item.studentPoolStatus}:${item.count}`).join(', ');
            if (poolText) console.log(`- student pool impact: currentVisible=${poolImpact.visibleDifficultyBlockerCount}, blockedByCurrentPolicy=${poolImpact.currentPolicyBlockedDifficultyBlockerCount}, dbAdaptiveEligible=${poolImpact.dbAdaptiveEligibleDifficultyBlockerCount}, dbRunless=${poolImpact.dbAdaptiveEligibleRunlessDifficultyBlockerCount}; ${poolText}`);
            if (poolImpact.byDatabaseEligibleTopicDifficulty.length) {
              console.log(`- db-published blocker topics: ${poolImpact.byDatabaseEligibleTopicDifficulty.map((item) => `${item.topicTitle}/${item.difficulty}:${item.count}`).join(', ')}`);
            }
          }
          for (const finding of recentDifficultyAuditFindings.slice(0, 10)) {
            console.log(`  - [${finding.severity}] #${finding.id} run=${finding.productionRunId || 'n/a'} retire=${finding.retirementCoverage} pool=${finding.studentPoolStatus} spq=${finding.practiceVisibility.sourceQuestionId || 'n/a'} ${finding.topicTitle} ${finding.difficulty}: ${finding.reasonCode}/${finding.family} :: ${finding.prompt}`);
          }
          if (subject === 'physics' && physicsDifficultyQualityAudit) {
            console.log(`- physics difficulty offline quality audit: sampled=${physicsDifficultyQualityAudit.reviewedCount}/${physicsDifficultyQualityAudit.findingCount}, truePositive=${physicsDifficultyQualityAudit.truePositiveCount}, falsePositive=${physicsDifficultyQualityAudit.falsePositiveCount}, correctnessIssues=${physicsDifficultyQualityAudit.correctnessIssueCount}, usabilityIssues=${physicsDifficultyQualityAudit.usabilityIssueCount}, currentPolicyIsolated=${physicsDifficultyQualityAudit.currentPolicyIsolatedCount}`);
            if (physicsDifficultyQualityAudit.nextActions.length) {
              console.log(`  - next actions: ${physicsDifficultyQualityAudit.nextActions.map((action) => `${action.code}:${action.recommendation}`).join(', ')}`);
            }
            if (physicsDifficultyQualityAudit.enablementGuardrails) {
              console.log(`  - enablement guardrails: hard=${physicsDifficultyQualityAudit.enablementGuardrails.hardDifficultyWatchPolicy}, visual=${physicsDifficultyQualityAudit.enablementGuardrails.visualCurrentPolicyDefault}, providerFailures=${physicsDifficultyQualityAudit.enablementGuardrails.providerFailurePolicy}`);
            }
            for (const sample of physicsDifficultyQualityAudit.samples.slice(0, 5)) {
              console.log(`  - audit sample #${sample.id}: decision=${sample.qualityAudit.decision}, pool=${sample.studentPoolStatus}, reasons=${arrayFrom(sample.currentPolicyBlockReasons).join(',') || 'none'} :: ${sample.qualityAudit.notes}`);
            }
          }
        }
        if (recentFamilySignals.length) {
          console.log(`- repeated family signals: ${recentFamilySignals.length}`);
          for (const signal of recentFamilySignals.slice(0, 10)) {
            const gate = signal.diversityGateReason ? ` gate=${signal.diversityGateReason}` : '';
            const windowDecision = signal.diversityWindowDecision ? ` window=${signal.diversityWindowDecision}` : '';
            const windowReasons = signal.diversityWindowReasons?.length ? ` windowReasons=${signal.diversityWindowReasons.join(',')}` : '';
            console.log(`  - ${signal.topicTitle} ${signal.difficulty}: ${signal.family} count=${signal.count}, runs=${signal.runCount}, cells=${signal.cellCount}, samples=${signal.sampleIds.join(',')} WARN ${signal.warningReasons.join(',')}${gate}${windowDecision}${windowReasons}`);
          }
        }
        if (recentNearDuplicateSignals.length) {
          console.log(`- near-duplicate audit signals: ${recentNearDuplicateSignals.length}`);
          for (const signal of recentNearDuplicateSignals.slice(0, 10)) {
            console.log(`  - ${signal.topicTitle} ${signal.difficulty}: ${signal.family} #${signal.candidateId}~#${signal.nearestId} similarity=${signal.similarity} source=${signal.similaritySource} text=${signal.textSimilarity} expr=${signal.expressionSimilarity} sharedFamily=${signal.sharedFamily} ${signal.reasonCode} :: ${signal.prompt}`);
          }
        }
        if (recentNearDuplicateRecommendations.length) {
          console.log(`- near-duplicate recommendations: ${recentNearDuplicateRecommendations.length}`);
          for (const recommendation of recentNearDuplicateRecommendations.slice(0, 8)) {
            console.log(`  - ${recommendation.topicTitle} ${recommendation.difficulty}: ${recommendation.family} source=${recommendation.similaritySource} count=${recommendation.count}, action=${recommendation.recommendationCode}, samples=${recommendation.samplePairs.join(',')}`);
          }
        }
        if (recentNearDuplicateCalibration) {
          console.log(`- near-duplicate calibration: ${recentNearDuplicateCalibration.recommendationCode}, signals=${recentNearDuplicateCalibration.signalCount}/${recentNearDuplicateCalibration.evaluatedCount}, productionImpact=${recentNearDuplicateCalibration.productionImpact}, currentPolicyImpact=${recentNearDuplicateCalibration.currentPolicyImpact}`);
          console.log(`  - scope=${recentNearDuplicateCalibration.comparisonScope}, providerFailures=${recentNearDuplicateCalibration.providerFailurePolicy}, otherFallback=${recentNearDuplicateCalibration.otherFallbackPolicy}`);
        }
        if (schedulerHintDryRun) {
          console.log(`- scheduler hint dry-run: hints=${schedulerHintDryRun.schedulerHintCount}, productionImpact=${schedulerHintDryRun.productionImpact}, providerFailures=${schedulerHintDryRun.providerFailurePolicy}`);
          for (const hint of schedulerHintDryRun.hints.slice(0, 8)) {
            const candidatePressure = hint.candidatePressureCount
              ? `, candidatePressure=${hint.candidatePressureFamilies.map((item) => `${item.family}:${item.count}`).join(',')}`
              : '';
            console.log(`  - ${hint.topicTitle} ${hint.difficulty}: preferred=${hint.preferredFamily}, avoid=${hint.avoidFamilies.join(',') || 'none'}, accepted=${hint.acceptedCount}, reason=${hint.reason}${candidatePressure}`);
          }
        }
        if (schedulerHintAdherence) {
          console.log(`- scheduler hint adherence: status=${schedulerHintAdherence.status}, hinted=${schedulerHintAdherence.hintedCandidateCount}/${schedulerHintAdherence.candidateCount}, preferredMatch=${schedulerHintAdherence.preferredMatchCount} (${schedulerHintAdherence.preferredMatchRatio}), avoidHits=${schedulerHintAdherence.avoidedFamilyHitCount} (${schedulerHintAdherence.avoidedFamilyHitRatio}), productionImpact=${schedulerHintAdherence.productionImpact}`);
          for (const sample of schedulerHintAdherence.samples.slice(0, 6)) {
            console.log(`  - #${sample.id} ${sample.status} ${sample.topicTitle} ${sample.difficulty}: family=${sample.family}, preferred=${sample.preferredFamily}, avoid=${sample.avoidFamilies.join(',') || 'none'}, matched=${sample.matchedPreferred}, avoidHit=${sample.hitAvoidFamily} :: ${sample.prompt}`);
          }
          if (mathSchedulerHintQualityAudit?.reviewedCount) {
            console.log(`  - offline scheduler audit: sampled=${mathSchedulerHintQualityAudit.reviewedCount}/${mathSchedulerHintQualityAudit.hintedCandidateCount}, mechanismPositive=${mathSchedulerHintQualityAudit.mechanismPositiveCount}, gateHeld=${mathSchedulerHintQualityAudit.gateHeldCount}, productionImpact=${mathSchedulerHintQualityAudit.productionImpact}`);
            for (const sample of mathSchedulerHintQualityAudit.samples.slice(0, 4)) {
              console.log(`    - audit sample #${sample.id}: decision=${sample.qualityAudit.decision}, matched=${sample.matchedPreferred}, gateHeld=${qualityAuditDisplayGateDecision(sample.qualityAudit.evidence?.gateDecision) || 'n/a'} :: ${sample.qualityAudit.notes}`);
            }
          }
        }
        if (profileDifficultyPatchEvidence?.observedCount) {
          console.log(`- profile difficulty patch evidence: observed=${profileDifficultyPatchEvidence.observedCount}, scope=${profileDifficultyPatchEvidence.scope}, productionImpact=${profileDifficultyPatchEvidence.productionImpact}`);
          if (profileDifficultyPatchEvidence.patchCounts.length) {
            console.log(`  - patch versions: ${profileDifficultyPatchEvidence.patchCounts.map((item) => `${item.patchVersion}:${item.count}`).join(', ')}`);
          }
          for (const sample of profileDifficultyPatchEvidence.samples.slice(0, 5)) {
            console.log(`  - #${sample.id} ${sample.status} ${sample.topicTitle} ${sample.difficulty}: patch=${sample.patchVersion}, policy=${sample.policyVersion || 'none'}, inferred=${sample.inferredDifficultyBand || 'unknown'}/${sample.inferredCalculationLoad || 'unknown'}, reasons=${sample.actualDifficultyReasons.join(',') || 'none'} :: ${sample.prompt}`);
          }
        }
        if (currentReviewerProfileReplay?.currentPatchCounts?.length || currentReviewerProfileReplay?.errorCount) {
          console.log(`- current reviewer profile replay: status=${currentReviewerProfileReplay.status}, reviewed=${currentReviewerProfileReplay.reviewedCount}, errors=${currentReviewerProfileReplay.errorCount}, productionImpact=${currentReviewerProfileReplay.productionImpact}, providerPolicy=${currentReviewerProfileReplay.providerPolicy}`);
          if (currentReviewerProfileReplay.currentPatchCounts?.length) {
            console.log(`  - current patch versions: ${currentReviewerProfileReplay.currentPatchCounts.map((item) => `${item.patchVersion}:${item.count}`).join(', ')}`);
          }
          for (const sample of currentReviewerProfileReplay.samples.slice(0, 5)) {
            if (sample.error) {
              console.log(`  - #${sample.id} ${sample.status} ${sample.topicTitle} ${sample.difficulty}: replay_error=${sample.error} :: ${sample.prompt}`);
            } else {
              console.log(`  - #${sample.id} ${sample.status} ${sample.topicTitle} ${sample.difficulty}: stored=${sample.storedDifficultyBand || 'unknown'}/${sample.storedCalculationLoad || 'unknown'}/${sample.storedPatchVersion || 'no_patch'}, current=${sample.currentDifficultyBand || 'unknown'}/${sample.currentCalculationLoad || 'unknown'}/${sample.currentPatchVersion || 'no_patch'}, gate=${sample.storedGateDecision || 'none'}, provider=${sample.providerStatus || 'unknown'} :: ${sample.prompt}`);
            }
          }
        }
        if (storedDiversityObservationSummary.observedCount) {
          console.log(`- stored diversity observations: observed=${storedDiversityObservationSummary.observedCount}, observeOnly=${storedDiversityObservationSummary.observeOnlyCount}, regenerateAction=${storedDiversityObservationSummary.regenerateActionCount}, wouldRegenerateIfFlagEnabled=${storedDiversityObservationSummary.wouldRegenerateIfFlagEnabledCount}, providerFailures=${storedDiversityObservationSummary.providerFailurePolicy}`);
        }
        if (candidateDiversityObservationReplay) {
          console.log(`- candidate diversity observation replay: candidates=${candidateDiversityObservationReplay.candidateCount}, evaluated=${candidateDiversityObservationReplay.evaluatedCount}, wouldRegenerateIfFlagEnabled=${candidateDiversityObservationReplay.wouldRegenerateIfFlagEnabledCount}, currentFlagRegenerate=${candidateDiversityObservationReplay.currentFlagRegenerateCount}, productionImpact=${candidateDiversityObservationReplay.productionImpact}`);
          for (const sample of candidateDiversityObservationReplay.samples.slice(0, 6)) {
            const reasons = sample.diversityWindowReasons.length ? sample.diversityWindowReasons.join(',') : 'none';
            console.log(`  - #${sample.id} ${sample.status} ${sample.topicTitle} ${sample.difficulty}: ${sample.family} action=${sample.productionActionWithCurrentFlag}, wouldRegenerate=${sample.wouldRegenerateIfFlagEnabled}, reasons=${reasons} :: ${sample.prompt}`);
          }
        }
        if (questionPlanApplicability) {
          console.log(`- question-plan applicability: applicable=${questionPlanApplicability.applicableCount}/${questionPlanApplicability.cellCount}, flag=${questionPlanApplicability.featureFlagEnabled ? 'enabled' : 'disabled'}, subjectBoundary=${questionPlanApplicability.subjectBoundary}, productionImpact=${questionPlanApplicability.productionImpact}`);
          for (const cell of questionPlanApplicability.applicableCells.slice(0, 8)) {
            console.log(`  - cell #${cell.cellId} ${cell.topicTitle} ${cell.difficulty}: seed=${cell.seedCellId}, family=${cell.taskFamily}, template=${cell.planTemplate}, gate=${cell.gateModeWithCurrentFlag}, impact=${cell.productionImpactWithCurrentFlag}`);
          }
        }
        if (questionPlanCalibration) {
          console.log(`- question-plan calibration: samples=${questionPlanCalibration.sampleCount}, productionImpact=${questionPlanCalibration.productionImpact}, providerFailures=${questionPlanCalibration.providerFailurePolicy}`);
          for (const [cellId, cellSummary] of Object.entries(questionPlanCalibration.summary)) {
            const verdicts = Object.entries(cellSummary.verdicts).map(([verdict, count]) => `${verdict}:${count}`).join(', ');
            console.log(`  - cell #${cellId}: total=${cellSummary.total}, ${verdicts}`);
          }
          for (const sample of questionPlanCalibration.samples.slice(0, 6)) {
            console.log(`  - plan sample #${sample.id} cell=${sample.cellId} ${sample.status}: ${sample.verdict} :: ${sample.prompt}`);
          }
        }
        if (questionPlanExecution) {
          console.log(`- question-plan execution: observed=${questionPlanExecution.observedCount}/${questionPlanExecution.candidateCount}, adheres=${questionPlanExecution.adheresCount}, needsRepair=${questionPlanExecution.needsRepairCount}, deliveryRoutes=${questionPlanExecution.deliveryRouteCount}, productionImpact=${questionPlanExecution.productionImpact}, providerFailures=${questionPlanExecution.providerFailurePolicy}`);
          for (const sample of questionPlanExecution.samples.slice(0, 6)) {
            const codes = sample.failureCodes.length ? ` codes=${sample.failureCodes.join(',')}` : '';
            console.log(`  - plan execution #${sample.id} cell=${sample.cellId} ${sample.status}: attempt=${sample.attemptStatus}, adheres=${sample.adheres}, route=${sample.routeStage}/${sample.routeAction}${codes} :: ${sample.prompt}`);
          }
        }
        if (mathQuestionPlanShadow) {
          console.log(`- math question-plan shadow: cells=${mathQuestionPlanShadow.applicableCellCount}, samples=${mathQuestionPlanShadow.sampleCount}, boundary=${mathQuestionPlanShadow.subjectBoundary}, productionImpact=${mathQuestionPlanShadow.productionImpact}`);
          for (const cell of mathQuestionPlanShadow.applicableCells.slice(0, 4)) {
            console.log(`  - cell #${cell.cellId} ${cell.topicTitle} ${cell.difficulty}: template=${cell.planTemplate}, family=${cell.taskFamily}`);
          }
          for (const sample of mathQuestionPlanShadow.samples.slice(0, 6)) {
            console.log(`  - math plan shadow #${sample.id} cell=${sample.cellId} ${sample.status}: family=${sample.family}, verdict=${sample.verdict}, gate=${qualityAuditDisplayGateDecision(sample.gateDecision) || 'none'} :: ${sample.prompt}`);
          }
        }
        if (physicsQuestionPlanShadow) {
          console.log(`- physics question-plan shadow: cells=${physicsQuestionPlanShadow.applicableCellCount}, samples=${physicsQuestionPlanShadow.sampleCount}, boundary=${physicsQuestionPlanShadow.subjectBoundary}, productionImpact=${physicsQuestionPlanShadow.productionImpact}`);
          for (const cell of physicsQuestionPlanShadow.applicableCells.slice(0, 4)) {
            console.log(`  - cell #${cell.cellId} ${cell.topicTitle} ${cell.difficulty}: template=${cell.planTemplate}, family=${cell.taskFamily}`);
          }
          for (const sample of physicsQuestionPlanShadow.samples.slice(0, 6)) {
            console.log(`  - physics plan shadow #${sample.id} cell=${sample.cellId} ${sample.status}: family=${sample.family}, verdict=${sample.verdict}, gate=${qualityAuditDisplayGateDecision(sample.gateDecision) || 'none'} :: ${sample.prompt}`);
          }
        }
        if (mathSoftCapDryRun) {
          console.log(`- math soft-cap dry-run: evaluated=${mathSoftCapDryRun.evaluatedCount}, auditSignals=${mathSoftCapDryRun.auditSignalCount}, wouldRegenerate=${mathSoftCapDryRun.wouldRegenerateCount}, legacy=${mathSoftCapDryRun.legacyRegenerateCount}, incremental=${mathSoftCapDryRun.incrementalWouldRegenerateCount}, productionFlagEnabled=${mathSoftCapDryRun.productionFlagEnabled}`);
          if (mathSoftCapDryRun.calibration) {
            const calibration = mathSoftCapDryRun.calibration;
            console.log(`  - calibration: ${calibration.recommendationCode}, incrementalRatio=${calibration.incrementalRatio}, scope=${calibration.productionDecisionScope}, providerFailures=${calibration.providerFailurePolicy}`);
            if (calibration.blockerReasons.length) {
              console.log(`  - calibration blockers: ${calibration.blockerReasons.join(', ')}`);
            }
            console.log(`  - calibration near-duplicate support: ${calibration.incrementalNearDuplicateSupportCount}/${calibration.incrementalCount}`);
            for (const sample of calibration.incrementalSamples.slice(0, 4)) {
              const nearDuplicateText = sample.nearDuplicateSupport
                ? ` nearDuplicate=${sample.nearDuplicateSignals.map((signal) => `${signal.candidateId}~${signal.nearestId}:${signal.similarity}`).join(',')}`
                : ' nearDuplicate=none';
              console.log(`  - calibration sample #${sample.id} ${sample.topicTitle} ${sample.difficulty}: ${sample.family} acceptedFamily=${sample.acceptedFamilyCount}/${sample.acceptedCount}${nearDuplicateText} :: ${sample.prompt}`);
            }
          }
          if (mathSoftCapDryRun.byReason.length) {
            console.log(`  - reasons: ${mathSoftCapDryRun.byReason.map((item) => `${item.reason}:${item.count}`).join(', ')}`);
          }
          for (const signal of mathSoftCapDryRun.signals.slice(0, 8)) {
            const increment = signal.incrementalIfFlagEnabled ? 'incremental' : 'legacy-covered';
            const productionReasons = signal.productionSoftCapReasons.length ? signal.productionSoftCapReasons.join(',') : 'audit_only';
            console.log(`  - #${signal.id} ${signal.topicTitle} ${signal.difficulty}: ${signal.family} acceptedFamily=${signal.acceptedFamilyCount}/${signal.acceptedCount}, ${increment}, productionReasons=${productionReasons}, auditReasons=${signal.softCapReasons.join(',')} :: ${signal.prompt}`);
          }
        }
        if (mathOtherFamilyPromotionDryRun) {
          console.log(`- math other-family promotion dry-run: coverageGain=${mathOtherFamilyPromotionDryRun.coverageGainCount}, known=${mathOtherFamilyPromotionDryRun.baseKnownFamilyCount}/${mathOtherFamilyPromotionDryRun.totalQuestionCount}->${mathOtherFamilyPromotionDryRun.promotedKnownFamilyCount}/${mathOtherFamilyPromotionDryRun.totalQuestionCount}, wouldRegenerate=${mathOtherFamilyPromotionDryRun.baseWouldRegenerateCount}->${mathOtherFamilyPromotionDryRun.promotedWouldRegenerateCount}, incremental=${mathOtherFamilyPromotionDryRun.incrementalWouldRegenerateCount}, productionImpact=${mathOtherFamilyPromotionDryRun.productionImpact}`);
          if (mathOtherFamilyPromotionDryRun.promotedFamilyWindowScopes.length) {
            console.log(`  - promoted family window scopes: ${mathOtherFamilyPromotionDryRun.promotedFamilyWindowScopes.map((item) => `${item.family}:${item.windowScope}/${item.productionImpact}`).join(', ')}`);
          }
          if (mathOtherFamilyPromotionDryRun.bySuggestedFamily.length) {
            console.log(`  - promoted families: ${mathOtherFamilyPromotionDryRun.bySuggestedFamily.map((item) => `${item.suggestedFamily}:${item.count}/scope=${item.windowScope}/regen=${item.wouldRegenerateIfPromotedCount}`).join(', ')}`);
          }
          for (const signal of mathOtherFamilyPromotionDryRun.incrementalSignals.slice(0, 6)) {
            console.log(`  - promotion signal #${signal.id} ${signal.topicTitle} ${signal.difficulty}: ${signal.family} productionReasons=${signal.productionSoftCapReasons.join(',') || 'audit_only'} auditReasons=${signal.softCapReasons.join(',')} :: ${signal.prompt}`);
          }
        }
        if (!recentDifficultyAuditFindings.length && !recentFamilySignals.length && !recentNearDuplicateSignals.length && !mathSoftCapDryRun?.wouldRegenerateCount && !mathOtherFamilyPromotionDryRun?.incrementalSignalCount) {
          console.log('- no difficulty, repeated-family, or near-duplicate signals in the recent formal window');
        }
      }
      console.log('\nCell Diagnostics');
      for (const cell of cellSummaries) {
        const diag = cell.productionDiagnostics;
        const jobErrorsText = diag.topJobErrors.length
          ? diag.topJobErrors.map((item) => `${item.errorCode}:${item.count}`).join(', ')
          : 'none';
        const gateReasonsText = diag.topGateReasons.length
          ? diag.topGateReasons.map((item) => `${item.reason}:${item.count}`).join(', ')
          : 'none';
        console.log(`- #${cell.id} ${cell.difficulty}: jobs=${diag.jobAttemptCount}, generated=${diag.generatedQuestionCount}, approved=${diag.approvedGeneratedCount}, rejected=${diag.rejectedGeneratedCount}, publishablePending=${diag.publishablePendingGeneratedCount}, publishYield=${diag.publishYield ?? 'n/a'}, gatePassYield=${diag.gatePassYield ?? 'n/a'}, bottleneck=${diag.primaryBottleneck}, jobErrors=${jobErrorsText}, gate=${gateReasonsText}`);
      }
      console.log('\nProvider/Key');
      for (const item of providerErrors.length ? providerErrors : jobErrorSummary.slice(0, 6)) {
        console.log(`- ${item.errorCode}: ${item.count}`);
      }
      const staleTotal = cellSummaries.reduce((sum, cell) => sum + cell.staleRunningJobCount, 0);
      if (staleTotal) console.log(`- stale running jobs still present in DB: ${staleTotal}; they should be recovered by processing and no longer count as active budget.`);
      const dispatchCapacity = report.provider.dispatchCapacity;
      console.log(`- dispatch capacity: ${dispatchCapacity.activeProductionJobCount}/${dispatchCapacity.activeJobLimit} active job slots used (${dispatchCapacity.activeCapacityStatus})`);
      for (const waiting of dispatchCapacity.openCellsWaitingForDispatch.slice(0, 6)) {
        console.log(`  - waiting #${waiting.id} ${waiting.topicTitle} ${waiting.difficulty}: open=${waiting.openCount}, reason=${waiting.dispatchWaitReason}, next=${waiting.nextSafeAction}`);
      }
      if (openCellsWithoutActiveJobs.length && providerErrors.length) {
        console.log(`- boundary hint: ${openCellsWithoutActiveJobs.length} open cell(s) currently have no active running jobs while recent failures are provider/key shaped; process/retry capacity is still worth observing.`);
      }
      if (p0p1.length) console.log(`\nP0/P1 attention: ${p0p1.join('; ')}`);
      else console.log(`\nP0/P1 attention: none detected by automated audit; offline ${subject} quality sampling may still be required for final accuracy judgment.`);
    }
    if (failOnP0 && p0p1.length) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
