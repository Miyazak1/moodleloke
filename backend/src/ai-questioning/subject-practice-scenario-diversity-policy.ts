import { createHash } from 'node:crypto';

export const SUBJECT_PRACTICE_SCENARIO_CONTRACT_SCHEMA_VERSION = 'subject-practice-scenario-contract-v1';
export const SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION_V1 =
  'subject-practice-scenario-diversity-shadow-v1';
export const SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION =
  'subject-practice-scenario-diversity-shadow-v2-multi-evidence-status';

export type SubjectPracticeScenarioMode =
  | 'abstract'
  | 'real_world'
  | 'experimental'
  | 'hypothetical'
  | 'not_applicable';

export type SubjectPracticeScenarioContextNecessity =
  | 'required_for_solution'
  | 'decorative'
  | 'not_applicable';

export type SubjectPracticeScenarioContract = {
  schemaVersion: typeof SUBJECT_PRACTICE_SCENARIO_CONTRACT_SCHEMA_VERSION;
  policyVersion: typeof SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION;
  stage: 'shadow_only_thresholds_not_frozen';
  scenarioMode: SubjectPracticeScenarioMode;
  scenarioFamilyId: string;
  scenarioDomain: string;
  scenarioEntity: string;
  scenarioAction: string;
  informationForm: string;
  scenarioFingerprint: string;
  contextNecessity: SubjectPracticeScenarioContextNecessity;
  requiredInformationFields: string[];
  solverRelevantFields: string[];
  surface: {
    zhEntity: string;
    enEntity: string;
    zhSetting: string;
    enSetting: string;
    cueTokens: string[];
  };
  plausibility: Record<string, unknown>;
  sourceIsolation: {
    officialQuestionContentUsed: false;
    reversibleSourceFieldsUsed: false;
    selectionBasis: 'controlled_catalog_and_sealed_ordinal_only';
  };
};

type ScenarioCatalogEntry = {
  scenarioMode: Exclude<SubjectPracticeScenarioMode, 'abstract' | 'not_applicable'>;
  scenarioFamilyId: string;
  scenarioDomain: string;
  scenarioEntity: string;
  informationForm: string;
  zhEntity: string;
  enEntity: string;
  zhSetting: string;
  enSetting: string;
  cueTokens: string[];
  allowedScopes?: string[];
};

const PHYSICS_SCENARIOS: ScenarioCatalogEntry[] = [
  { scenarioMode: 'experimental', scenarioFamilyId: 'physics_lab_cart_track', scenarioDomain: 'mechanics_laboratory', scenarioEntity: 'wheeled_vehicle', informationForm: 'numeric_text', zhEntity: '实验小车', enEntity: 'laboratory cart', zhSetting: '水平直轨实验', enSetting: 'a horizontal straight-track experiment', cueTokens: ['实验小车', 'laboratory cart'] },
  { scenarioMode: 'real_world', scenarioFamilyId: 'physics_warehouse_robot_aisle', scenarioDomain: 'warehouse_logistics', scenarioEntity: 'mobile_robot', informationForm: 'numeric_text', zhEntity: '搬运机器人', enEntity: 'warehouse robot', zhSetting: '仓库直线通道', enSetting: 'a straight warehouse aisle', cueTokens: ['搬运机器人', 'warehouse robot'] },
  { scenarioMode: 'real_world', scenarioFamilyId: 'physics_train_straight_segment', scenarioDomain: 'rail_transport', scenarioEntity: 'rail_vehicle', informationForm: 'numeric_text', zhEntity: '列车', enEntity: 'train', zhSetting: '平直轨道区间', enSetting: 'a straight level track segment', cueTokens: ['列车', 'train'] },
  { scenarioMode: 'real_world', scenarioFamilyId: 'physics_elevator_vertical_shaft', scenarioDomain: 'building_transport', scenarioEntity: 'elevator_car', informationForm: 'numeric_text', zhEntity: '电梯轿厢', enEntity: 'elevator car', zhSetting: '竖直井道', enSetting: 'a vertical shaft', cueTokens: ['电梯轿厢', 'elevator car'] },
  { scenarioMode: 'real_world', scenarioFamilyId: 'physics_athlete_straight_track', scenarioDomain: 'sports_motion', scenarioEntity: 'athlete', informationForm: 'numeric_text', zhEntity: '运动员', enEntity: 'athlete', zhSetting: '直线跑道', enSetting: 'a straight running track', cueTokens: ['运动员', 'athlete'] },
  { scenarioMode: 'real_world', scenarioFamilyId: 'physics_drone_straight_route', scenarioDomain: 'aviation_motion', scenarioEntity: 'drone', informationForm: 'numeric_text', zhEntity: '无人机', enEntity: 'drone', zhSetting: '无风直线路段', enSetting: 'a windless straight route', cueTokens: ['无人机', 'drone'] }
];

const CHEMISTRY_SCENARIOS: ScenarioCatalogEntry[] = [
  { scenarioMode: 'experimental', scenarioFamilyId: 'chemistry_lab_solution_dilution', scenarioDomain: 'chemistry_laboratory', scenarioEntity: 'reagent_solution', informationForm: 'numeric_procedure_text', zhEntity: '试剂溶液', enEntity: 'reagent solution', zhSetting: '实验室稀释操作', enSetting: 'a laboratory dilution', cueTokens: ['试剂溶液', 'reagent solution'], allowedScopes: ['strong_acid_dilution', 'strong_base_dilution'] },
  { scenarioMode: 'real_world', scenarioFamilyId: 'chemistry_quality_control_dilution', scenarioDomain: 'quality_control', scenarioEntity: 'quality_control_sample', informationForm: 'numeric_procedure_text', zhEntity: '质控样品', enEntity: 'quality-control sample', zhSetting: '浓度复核前的定量稀释', enSetting: 'a quantitative dilution before concentration verification', cueTokens: ['质控样品', 'quality-control sample'], allowedScopes: ['strong_acid_dilution', 'strong_base_dilution'] },
  { scenarioMode: 'experimental', scenarioFamilyId: 'chemistry_calibration_solution', scenarioDomain: 'instrument_calibration', scenarioEntity: 'calibration_solution', informationForm: 'numeric_procedure_text', zhEntity: '校准溶液', enEntity: 'calibration solution', zhSetting: '酸碱检测仪校准', enSetting: 'acid-base meter calibration', cueTokens: ['校准溶液', 'calibration solution'], allowedScopes: ['strong_acid_dilution', 'strong_base_dilution'] },
  { scenarioMode: 'experimental', scenarioFamilyId: 'chemistry_lab_neutralization_test', scenarioDomain: 'chemistry_laboratory', scenarioEntity: 'acid_base_aliquots', informationForm: 'numeric_procedure_text', zhEntity: '酸碱试样', enEntity: 'acid and base aliquots', zhSetting: '实验室定量混合', enSetting: 'a quantitative laboratory mixing test', cueTokens: ['酸碱试样', 'acid and base aliquots'], allowedScopes: ['strong_acid_base_neutralization'] },
  { scenarioMode: 'real_world', scenarioFamilyId: 'chemistry_wastewater_bench_neutralization', scenarioDomain: 'environmental_treatment', scenarioEntity: 'simulated_wastewater_sample', informationForm: 'numeric_procedure_text', zhEntity: '模拟废水样品', enEntity: 'simulated wastewater sample', zhSetting: '小试中和处理', enSetting: 'a bench-scale neutralization treatment', cueTokens: ['模拟废水样品', 'simulated wastewater sample'], allowedScopes: ['strong_acid_base_neutralization'] },
  { scenarioMode: 'real_world', scenarioFamilyId: 'chemistry_process_neutralization_check', scenarioDomain: 'process_quality_control', scenarioEntity: 'process_sample', informationForm: 'numeric_procedure_text', zhEntity: '工艺样品', enEntity: 'process sample', zhSetting: '中和后酸碱性复核', enSetting: 'an acid-base check after neutralization', cueTokens: ['工艺样品', 'process sample'], allowedScopes: ['strong_acid_base_neutralization'] }
];

const ENTITY_SYNONYMS: Record<string, string> = {
  '汽车': 'wheeled_vehicle', '小车': 'wheeled_vehicle', '车辆': 'wheeled_vehicle', '实验小车': 'wheeled_vehicle',
  car: 'wheeled_vehicle', cart: 'wheeled_vehicle', automobile: 'wheeled_vehicle', vehicle: 'wheeled_vehicle',
  'laboratory cart': 'wheeled_vehicle', laboratory_cart: 'wheeled_vehicle', wheeled_vehicle: 'wheeled_vehicle'
};

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function sameStringArray(actual: unknown, expected: string[]) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => clean(value) === clean(expected[index]));
}

function normalizedRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizedRecord);
  const record = recordFrom(value);
  if (!record) return typeof value === 'string' ? clean(value) : value;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, normalizedRecord(record[key])]));
}

function sameRecord(actual: unknown, expected: unknown) {
  return JSON.stringify(normalizedRecord(actual)) === JSON.stringify(normalizedRecord(expected));
}

function normalizedSeed(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.trunc(number)) : 0;
}

function canonicalToken(value: unknown) {
  const cleaned = clean(value)
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/\b(?:km\/h|m\/s(?:\^?2)?|mol\/l|mmol\/l|ml|kg|km|cm|mm|g|s|m|l)\b/gi, 'unit')
    .replace(/[#_\-\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ENTITY_SYNONYMS[clean(value)] ?? ENTITY_SYNONYMS[cleaned] ?? cleaned;
}

export function subjectPracticeScenarioFingerprintFor(input: {
  scenarioDomain?: unknown;
  scenarioEntity?: unknown;
  scenarioAction?: unknown;
  informationForm?: unknown;
}) {
  const canonical = [
    canonicalToken(input.scenarioDomain),
    canonicalToken(input.scenarioEntity),
    canonicalToken(input.scenarioAction),
    canonicalToken(input.informationForm)
  ].join('|');
  return `scenario-${createHash('sha256').update(canonical).digest('hex').slice(0, 20)}`;
}

function contractFromEntry(entry: ScenarioCatalogEntry, scenarioAction: string): SubjectPracticeScenarioContract {
  return {
    schemaVersion: SUBJECT_PRACTICE_SCENARIO_CONTRACT_SCHEMA_VERSION,
    policyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
    stage: 'shadow_only_thresholds_not_frozen',
    scenarioMode: entry.scenarioMode,
    scenarioFamilyId: entry.scenarioFamilyId,
    scenarioDomain: entry.scenarioDomain,
    scenarioEntity: entry.scenarioEntity,
    scenarioAction,
    informationForm: entry.informationForm,
    scenarioFingerprint: subjectPracticeScenarioFingerprintFor({ ...entry, scenarioAction }),
    contextNecessity: 'required_for_solution',
    requiredInformationFields: ['scenarioAction', 'motion_or_reaction_condition', 'quantities_with_units'],
    solverRelevantFields: ['scenarioAction', 'motion_or_reaction_condition', 'quantities_with_units'],
    surface: {
      zhEntity: entry.zhEntity,
      enEntity: entry.enEntity,
      zhSetting: entry.zhSetting,
      enSetting: entry.enSetting,
      cueTokens: entry.cueTokens
    },
    plausibility: entry.scenarioDomain.includes('chemistry') || entry.scenarioFamilyId.startsWith('chemistry_')
      ? { temperatureC: 25, completeDissociationOnly: true, visibleConcentrationAndVolumeUnits: true }
      : { straightLineMotion: true, siUnitsRequired: true, signedVelocityAndAccelerationAllowed: true },
    sourceIsolation: {
      officialQuestionContentUsed: false,
      reversibleSourceFieldsUsed: false,
      selectionBasis: 'controlled_catalog_and_sealed_ordinal_only'
    }
  };
}

export function subjectPracticeScenarioContractFor(input: {
  subject?: unknown;
  taskFamily?: unknown;
  planTemplate?: unknown;
  exactScope?: unknown;
  seed?: unknown;
  scenarioFamilyId?: unknown;
}): SubjectPracticeScenarioContract | null {
  const subject = clean(input.subject);
  const taskFamily = clean(input.taskFamily);
  const planTemplate = clean(input.planTemplate);
  const exactScope = clean(input.exactScope) || 'unspecified_scope';
  const seed = normalizedSeed(input.seed);
  if (subject === 'math' && [
    'elementary_function_direct_property', 'math_line_relation_direct', 'derivative_direct_evaluation'
  ].includes(taskFamily) && [
    'math_elementary_function_relation_v1', 'math_line_relation_direct_v1', 'math_derivative_condition_chain_v1'
  ].includes(planTemplate)) {
    const scenarioEntity = taskFamily === 'math_line_relation_direct'
      ? 'line_object'
      : taskFamily === 'derivative_direct_evaluation'
        ? 'derivative_function_object'
        : 'function_object';
    const scenarioAction = exactScope;
    return {
      schemaVersion: SUBJECT_PRACTICE_SCENARIO_CONTRACT_SCHEMA_VERSION,
      policyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
      stage: 'shadow_only_thresholds_not_frozen',
      scenarioMode: 'abstract',
      scenarioFamilyId: `math_abstract_${scenarioEntity}`,
      scenarioDomain: 'pure_mathematics',
      scenarioEntity,
      scenarioAction,
      informationForm: 'symbolic_text',
      scenarioFingerprint: subjectPracticeScenarioFingerprintFor({
        scenarioDomain: 'pure_mathematics', scenarioEntity, scenarioAction, informationForm: 'symbolic_text'
      }),
      contextNecessity: 'not_applicable',
      requiredInformationFields: [],
      solverRelevantFields: [],
      surface: { zhEntity: '', enEntity: '', zhSetting: '', enSetting: '', cueTokens: [] },
      plausibility: { externalContextForbidden: true },
      sourceIsolation: {
        officialQuestionContentUsed: false,
        reversibleSourceFieldsUsed: false,
        selectionBasis: 'controlled_catalog_and_sealed_ordinal_only'
      }
    };
  }
  if (subject === 'physics'
    && taskFamily === 'kinematics_basic_direct_relation'
    && planTemplate === 'physics_kinematics_basic_relation_v1') {
    const requestedFamilyId = clean(input.scenarioFamilyId);
    const selected = requestedFamilyId
      ? PHYSICS_SCENARIOS.find((entry) => entry.scenarioFamilyId === requestedFamilyId)
      : PHYSICS_SCENARIOS[seed % PHYSICS_SCENARIOS.length];
    return selected ? contractFromEntry(selected, exactScope) : null;
  }
  if (subject === 'chemistry'
    && taskFamily === 'ph_dilution_strong_acid_base_neutralization'
    && planTemplate === 'chemistry_strong_acid_base_single_relation_v1') {
    const eligible = CHEMISTRY_SCENARIOS.filter((entry) => entry.allowedScopes?.includes(exactScope));
    if (!eligible.length) return null;
    const requestedFamilyId = clean(input.scenarioFamilyId);
    const selected = requestedFamilyId
      ? eligible.find((entry) => entry.scenarioFamilyId === requestedFamilyId)
      : eligible[seed % eligible.length];
    return selected ? contractFromEntry(selected, exactScope) : null;
  }
  return null;
}

export function validateSubjectPracticeScenarioContract(input: { questionPlan?: unknown }) {
  const plan = recordFrom(input.questionPlan);
  const contract = recordFrom(plan?.scenarioContract);
  const renderConstraints = recordFrom(plan?.renderConstraints);
  const template = clean(plan?.planTemplate);
  const expectedAction = template === 'math_line_relation_direct_v1'
    ? clean(renderConstraints?.exactLineRelationScope) || 'slope_from_two_distinct_points'
    : template === 'math_derivative_condition_chain_v1'
      ? clean(renderConstraints?.exactDerivativeScope) || 'direct_polynomial_value'
    : template === 'physics_kinematics_basic_relation_v1'
      ? clean(renderConstraints?.exactPhysicsKinematicsScope) || 'unspecified_scope'
      : template === 'chemistry_strong_acid_base_single_relation_v1'
        ? clean(renderConstraints?.exactChemistryRelationKind) || 'unspecified_scope'
        : template === 'math_elementary_function_relation_v1'
          ? [clean(renderConstraints?.requiredElementaryFunctionClass) || 'unspecified_function', clean(renderConstraints?.requiredSinglePropertyTarget) || 'unspecified_property'].join(':')
          : clean(contract?.scenarioAction);
  const expected = subjectPracticeScenarioContractFor({
    subject: plan?.subject,
    taskFamily: plan?.taskFamily,
    planTemplate: plan?.planTemplate,
    exactScope: expectedAction,
    scenarioFamilyId: contract?.scenarioFamilyId
  });
  const valid = Boolean(expected
    && contract?.schemaVersion === expected.schemaVersion
    && contract?.policyVersion === expected.policyVersion
    && contract?.stage === expected.stage
    && clean(contract?.scenarioMode) === expected.scenarioMode
    && clean(contract?.scenarioFamilyId) === expected.scenarioFamilyId
    && clean(contract?.scenarioDomain) === expected.scenarioDomain
    && clean(contract?.scenarioEntity) === expected.scenarioEntity
    && clean(contract?.scenarioAction) === expectedAction
    && clean(contract?.informationForm) === expected.informationForm
    && clean(contract?.scenarioFingerprint) === expected.scenarioFingerprint
    && clean(contract?.contextNecessity) === expected.contextNecessity
    && sameStringArray(contract?.requiredInformationFields, expected.requiredInformationFields)
    && sameStringArray(contract?.solverRelevantFields, expected.solverRelevantFields)
    && sameRecord(contract?.surface, expected.surface)
    && sameRecord(contract?.plausibility, expected.plausibility)
    && recordFrom(contract?.sourceIsolation)?.officialQuestionContentUsed === false
    && recordFrom(contract?.sourceIsolation)?.reversibleSourceFieldsUsed === false
    && recordFrom(contract?.sourceIsolation)?.selectionBasis === 'controlled_catalog_and_sealed_ordinal_only');
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
    valid,
    failureCodes: valid ? [] : ['scenario_contract_missing_or_invalid']
  };
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function subjectPracticeScenarioEvidenceFor(input: { questionPlan?: unknown; candidate?: unknown }) {
  const plan = recordFrom(input.questionPlan);
  const contract = recordFrom(plan?.scenarioContract);
  const candidate = recordFrom(input.candidate);
  const localizations = recordFrom(candidate?.localizations);
  const en = recordFrom(localizations?.en);
  const text = [candidate?.prompt, candidate?.explanation, en?.prompt, en?.explanation].map(clean).join(' ');
  const mode = clean(contract?.scenarioMode);
  const surface = recordFrom(contract?.surface);
  const cueTokens = Array.isArray(surface?.cueTokens) ? surface.cueTokens.map(clean).filter(Boolean) : [];
  const expectedFingerprint = subjectPracticeScenarioFingerprintFor({
    scenarioDomain: contract?.scenarioDomain,
    scenarioEntity: contract?.scenarioEntity,
    scenarioAction: contract?.scenarioAction,
    informationForm: contract?.informationForm
  });
  const abstractMath = clean(plan?.subject) === 'math' && ['abstract', 'not_applicable'].includes(mode);
  const surfaceMatched = abstractMath || cueTokens.some((token) => text.includes(token));
  const relationEvidenceMatched = abstractMath
    || (clean(plan?.subject) === 'physics'
      ? /m\/s|m\/s\^2|m\/s²|位移|速度|加速度|speed|velocity|acceleration|displacement/i.test(text)
      : /mol\/l|ml|ph|稀释|混合|dilut|mix/i.test(text));
  const action = clean(contract?.scenarioAction);
  const physicsActionEvidenceMatched = abstractMath || clean(plan?.subject) !== 'physics'
    || (action === 'uniform_speed'
      ? /位移|displacement/.test(text) && /用时|time|in \d/.test(text) && /速度|speed/.test(text)
      : action === 'acceleration_from_velocity_change'
        ? /初速度|initial velocity/.test(text) && /末速度|final velocity|reaches/.test(text) && /加速度|acceleration/.test(text)
        : action === 'final_velocity_from_initial_acceleration_time'
          ? /初速度|initial velocity/.test(text) && /加速度|acceleration/.test(text) && /最终速度|final velocity/.test(text)
          : action === 'displacement_from_initial_acceleration_time'
            ? /初速度|initial velocity/.test(text) && /加速度|acceleration/.test(text) && /位移|displacement/.test(text)
            : false);
  const chemistryActionEvidenceMatched = abstractMath || clean(plan?.subject) !== 'chemistry'
    || (['strong_acid_dilution', 'strong_base_dilution'].includes(action)
      ? /稀释|dilut/.test(text)
        && /mol\/l/i.test(text)
        && /ml/i.test(text)
        && (action === 'strong_acid_dilution'
          ? /hcl|hno3|盐酸|硝酸/i.test(text)
          : /naoh|koh|氢氧化钠|氢氧化钾/i.test(text))
      : action === 'strong_acid_base_neutralization'
        ? /hcl/i.test(text) && /naoh/i.test(text) && /混合|mix/.test(text) && /ml/i.test(text)
        : false);
  const numericValues = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  const physicalPlausibilityMatched = abstractMath || clean(plan?.subject) !== 'physics'
    || (recordFrom(contract?.plausibility)?.straightLineMotion === true
      && /直线|straight|轨道|track|井道|shaft|跑道|route|通道|aisle/.test(text)
      && /m\/s|m\/s\^2|m\/s²/.test(text)
      && numericValues.length >= 3
      && numericValues.every((value) => Math.abs(value) <= 100000));
  const chemistryPlausibilityMatched = abstractMath || clean(plan?.subject) !== 'chemistry'
    || (recordFrom(contract?.plausibility)?.temperatureC === 25
      && recordFrom(contract?.plausibility)?.completeDissociationOnly === true
      && /25\s*°?\s*c/i.test([candidate?.explanation, en?.explanation].map(String).join(' '))
      && chemistryActionEvidenceMatched);
  const informationParticipationMatched = abstractMath || Boolean(
    surfaceMatched
    && relationEvidenceMatched
    && physicsActionEvidenceMatched
    && chemistryActionEvidenceMatched
  );
  const contractValid = contract?.schemaVersion === SUBJECT_PRACTICE_SCENARIO_CONTRACT_SCHEMA_VERSION
    && contract?.policyVersion === SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION
    && clean(contract?.scenarioFingerprint) === expectedFingerprint
    && contract?.sourceIsolation && recordFrom(contract.sourceIsolation)?.officialQuestionContentUsed === false;
  const contextNecessityVerified = abstractMath
    ? clean(contract?.contextNecessity) === 'not_applicable'
    : clean(contract?.contextNecessity) === 'required_for_solution' && relationEvidenceMatched;
  const consistent = Boolean(contractValid
    && surfaceMatched
    && relationEvidenceMatched
    && contextNecessityVerified
    && physicsActionEvidenceMatched
    && chemistryActionEvidenceMatched
    && physicalPlausibilityMatched
    && chemistryPlausibilityMatched
    && informationParticipationMatched);
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
    stage: 'shadow_only_thresholds_not_frozen',
    status: consistent ? 'consistent' : 'inconsistent',
    scenarioMode: mode || null,
    scenarioFamilyId: clean(contract?.scenarioFamilyId) || null,
    scenarioDomain: clean(contract?.scenarioDomain) || null,
    scenarioEntity: clean(contract?.scenarioEntity) || null,
    scenarioAction: clean(contract?.scenarioAction) || null,
    informationForm: clean(contract?.informationForm) || null,
    scenarioFingerprint: clean(contract?.scenarioFingerprint) || null,
    contextNecessity: clean(contract?.contextNecessity) || null,
    surfaceEntity: clean(surface?.zhEntity || surface?.enEntity) || null,
    contractValid,
    surfaceMatched,
    relationEvidenceMatched,
    contextNecessityVerified,
    physicsActionEvidenceMatched,
    chemistryActionEvidenceMatched,
    physicalPlausibilityMatched,
    chemistryPlausibilityMatched,
    informationParticipationMatched,
    sourceContentExposedToGenerator: false,
    productionGateImpact: 'none_shadow_only'
  };
}

export function subjectPracticeScenarioDiversityBatchMetrics(input: { expectedCount?: unknown; evidence?: unknown[] }) {
  const expectedCount = Math.max(0, Math.trunc(Number(input.expectedCount) || 0));
  const evidence = (input.evidence ?? []).map(recordFrom).filter((item): item is Record<string, unknown> => Boolean(item));
  const applicable = evidence.filter((item) => !['abstract', 'not_applicable'].includes(clean(item.scenarioMode)));
  const familyCounts = applicable.reduce<Record<string, number>>((counts, item) => {
    const key = clean(item.scenarioFamilyId) || 'missing';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const fingerprintGroups = applicable.reduce<Record<string, Record<string, number>>>((groups, item) => {
    const fingerprint = clean(item.scenarioFingerprint) || 'missing';
    const surface = clean(item.surfaceEntity) || 'missing';
    groups[fingerprint] ??= {};
    groups[fingerprint][surface] = (groups[fingerprint][surface] ?? 0) + 1;
    return groups;
  }, {});
  const uniqueFingerprints = Object.keys(fingerprintGroups).filter((key) => key !== 'missing').length;
  const duplicateFingerprintCount = Math.max(0, applicable.length - uniqueFingerprints);
  const renameOnlyCount = Object.values(fingerprintGroups).reduce((sum, surfaces) => {
    const variants = Object.keys(surfaces).filter((key) => key !== 'missing');
    return sum + (variants.length > 1 ? Object.values(surfaces).reduce((a, b) => a + b, 0) : 0);
  }, 0);
  const maximumFamilyCount = Math.max(0, ...Object.values(familyCounts));
  const evidenceConsistent = (item: Record<string, unknown>) => {
    const status = clean(item.status);
    if (status === 'consistent') return true;
    if (status !== 'shadow_candidate_evidence_complete') return false;
    const blockers = Array.isArray(item.blockers) ? item.blockers.filter(Boolean) : [];
    const subject = clean(item.subject);
    return blockers.length === 0
      && item.contextNecessityVerified === true
      && item.informationParticipationMatched === true
      && item.generatorSelfVerified === true
      && item.planAdherent === true
      && item.solverVerified === true
      && (subject !== 'physics' || item.physicsRelationMatched === true)
      && (subject !== 'chemistry'
        || (item.chemistryRelationMatched === true && item.chemistryPlausibilityMatched === true));
  };
  const inconsistencyCount = evidence.filter((item) => !evidenceConsistent(item)).length;
  const decorativeBackgroundCount = evidence.filter((item) =>
    clean(item.contextNecessity) === 'decorative' || item.contextNecessityVerified !== true).length;
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_DIVERSITY_POLICY_VERSION,
    stage: 'shadow_only_thresholds_not_frozen',
    expectedCount,
    observedEvidenceCount: evidence.length,
    applicableScenarioCount: applicable.length,
    abstractOrNotApplicableCount: evidence.length - applicable.length,
    scenarioFamilyCoverageCount: Object.keys(familyCounts).filter((key) => key !== 'missing').length,
    scenarioFingerprintCoverageCount: uniqueFingerprints,
    scenarioFamilyCounts: familyCounts,
    singleScenarioFamilyMaximumShare: applicable.length ? maximumFamilyCount / applicable.length : null,
    scenarioFingerprintDuplicateRate: applicable.length ? duplicateFingerprintCount / applicable.length : null,
    renameOnlyStructureRate: applicable.length ? renameOnlyCount / applicable.length : null,
    decorativeBackgroundRate: evidence.length ? decorativeBackgroundCount / evidence.length : null,
    scenarioConsistencyFailureRate: evidence.length ? inconsistencyCount / evidence.length : null,
    completeEvidenceCoverage: evidence.length === expectedCount,
    thresholdsFrozen: false,
    releaseQualification: false,
    productionGateImpact: 'none_shadow_only'
  };
}
