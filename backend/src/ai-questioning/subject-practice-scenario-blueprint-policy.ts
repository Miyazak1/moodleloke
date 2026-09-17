import { createHash } from 'node:crypto';

export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION =
  'subject-practice-scenario-blueprint-proposal-v4-strict-string-bounds';
export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_FINGERPRINT_VERSION =
  'subject-practice-scenario-blueprint-fingerprint-v1';

type RecordValue = Record<string, unknown>;

const PROPOSAL_KEYS = new Set([
  'scenarioMode', 'scenarioDomain', 'scenarioEntity', 'environment', 'scenarioAction',
  'informationForm', 'questionPurpose', 'contextNecessity', 'surface'
]);
const SURFACE_KEYS = new Set(['zhEntity', 'enEntity', 'zhSetting', 'enSetting']);
const REQUIRED_PROPOSAL_STRING_KEYS = [
  'scenarioMode', 'scenarioDomain', 'scenarioEntity', 'environment', 'scenarioAction',
  'informationForm', 'questionPurpose', 'contextNecessity'
];
const REQUIRED_SURFACE_STRING_KEYS = ['zhEntity', 'enEntity', 'zhSetting', 'enSetting'];
const MAXIMUM_BLUEPRINT_FIELD_CHARACTERS = 120;
const HISTORY_KEYS = new Set(['blueprintFingerprint', 'renameInvariantFingerprint']);
const NUMBER_WORD = /\d|[零〇一二三四五六七八九十百千万亿]|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million)\b/i;
const FORBIDDEN_TRUTH_KEY = /answer|option|choice|solution|numeric|quantity|parameter|correct|解析|答案|选项|数值|参数/i;
const FORMULA_LIKE_CONTENT = /[=∆Δ]|\b(?:formula|equation)\b|公式|方程/i;
const PHYSICS_EXACT_SOLVER_CONTENT = /\b(?:speed|velocity|acceleration|displacement|distance|elapsed\s+time|initial\s+(?:speed|velocity)|final\s+(?:speed|velocity)|rate\s+of\s+(?:motion|travel|movement)|change\s+in\s+(?:position|motion)|how\s+quickly|starting\s+motion|ending\s+motion)\b|速度|速率|加速度|位移|路程|时间间隔|初速度|末速度|终速度|匀速|运动快慢|位置变化|运动变化|单位时间/i;
const CHEMISTRY_EXACT_SOLVER_CONTENT = /\b(?:p\s*h|hydrogen\s+ion|hydronium|hydroxide\s+ion|molarity|concentration|volume|dilution|neutralization|acidic|basic|alkaline|acidity|alkalinity|acid|base|amount\s+per\s+(?:liter|litre)|mixing\s+ratio)\b|\bH\s*\+|\bOH\s*-|酸碱度|氢离子|水合氢离子|氢氧根|物质的量浓度|浓度|体积|稀释|中和|强酸|强碱|酸性|碱性|单位体积|混合比例/i;

const ENTITY_CANONICAL: Record<string, string> = {
  car: 'wheeled_vehicle', cart: 'wheeled_vehicle', vehicle: 'wheeled_vehicle', automobile: 'wheeled_vehicle',
  'laboratory cart': 'wheeled_vehicle', '实验小车': 'wheeled_vehicle', '小车': 'wheeled_vehicle', '车辆': 'wheeled_vehicle',
  solution: 'solution_sample', sample: 'solution_sample', 'solution sample': 'solution_sample',
  '溶液': 'solution_sample', '样品': 'solution_sample', '溶液样品': 'solution_sample'
};

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function canonicalToken(value: unknown, entity = false) {
  const token = clean(value)
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return entity ? ENTITY_CANONICAL[clean(value)] ?? ENTITY_CANONICAL[token] ?? token : token;
}

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function stringLeaves(value: unknown, path = 'proposal'): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return [{ path, value }];
  if (!recordFrom(value)) return [];
  return Object.entries(value as RecordValue).flatMap(([key, child]) => stringLeaves(child, `${path}.${key}`));
}

function exactBindingSupported(binding: RecordValue | null) {
  const subject = clean(binding?.subject);
  const taskFamily = clean(binding?.taskFamily);
  const planTemplate = clean(binding?.planTemplate);
  return (subject === 'physics'
      && taskFamily === 'kinematics_basic_direct_relation'
      && planTemplate === 'physics_kinematics_basic_relation_v1')
    || (subject === 'chemistry'
      && taskFamily === 'ph_dilution_strong_acid_base_neutralization'
      && planTemplate === 'chemistry_strong_acid_base_single_relation_v1');
}

export function subjectPracticeScenarioBlueprintProposalFor(input: {
  binding?: unknown;
  proposal?: unknown;
}) {
  const binding = recordFrom(input.binding);
  const proposal = recordFrom(input.proposal);
  const surface = recordFrom(proposal?.surface);
  const failureCodes: string[] = [];
  if (!exactBindingSupported(binding)) failureCodes.push('dynamic_scenario_binding_not_supported');
  if (!clean(binding?.exactScope)) failureCodes.push('scenario_blueprint_exact_scope_missing');
  if (!proposal) failureCodes.push('scenario_blueprint_proposal_missing');
  if (proposal && Object.keys(proposal).some((key) => !PROPOSAL_KEYS.has(key))) {
    failureCodes.push('scenario_blueprint_unknown_or_truth_bearing_field');
  }
  if (!surface || Object.keys(surface).some((key) => !SURFACE_KEYS.has(key))) {
    failureCodes.push('scenario_blueprint_surface_invalid');
  }
  if (REQUIRED_PROPOSAL_STRING_KEYS.some((key) => !clean(proposal?.[key]))) {
    failureCodes.push('scenario_blueprint_required_field_missing');
  }
  if (proposal && REQUIRED_PROPOSAL_STRING_KEYS.some((key) => typeof proposal[key] !== 'string')) {
    failureCodes.push('scenario_blueprint_field_type_invalid');
  }
  if (!['real_world', 'experimental', 'hypothetical'].includes(clean(proposal?.scenarioMode))) {
    failureCodes.push('scenario_blueprint_mode_invalid');
  }
  if (clean(proposal?.contextNecessity) !== 'required_for_solution') {
    failureCodes.push('scenario_blueprint_context_must_be_solution_necessary');
  }
  if (surface && REQUIRED_SURFACE_STRING_KEYS.some((key) => !clean(surface[key]))) {
    failureCodes.push('scenario_blueprint_surface_field_missing');
  }
  if (surface && REQUIRED_SURFACE_STRING_KEYS.some((key) => typeof surface[key] !== 'string')) {
    failureCodes.push('scenario_blueprint_surface_field_type_invalid');
  }
  const leaves = proposal ? stringLeaves(proposal) : [];
  if (leaves.some(({ value }) => value.length > MAXIMUM_BLUEPRINT_FIELD_CHARACTERS)) {
    failureCodes.push('scenario_blueprint_field_length_exceeded');
  }
  if (leaves.some(({ value }) => NUMBER_WORD.test(value))) failureCodes.push('scenario_blueprint_numeric_content_forbidden');
  const subjectExactSolverContent = clean(binding?.subject) === 'physics'
    ? PHYSICS_EXACT_SOLVER_CONTENT
    : CHEMISTRY_EXACT_SOLVER_CONTENT;
  if (leaves.some(({ value }) => FORMULA_LIKE_CONTENT.test(value)
    || subjectExactSolverContent.test(value))) {
    failureCodes.push('scenario_blueprint_exact_solver_semantics_forbidden');
  }
  if (proposal && Object.keys(proposal).some((key) => FORBIDDEN_TRUTH_KEY.test(key))) {
    failureCodes.push('scenario_blueprint_truth_output_forbidden');
  }
  const canonicalDimensions = proposal ? {
    scenarioMode: canonicalToken(proposal.scenarioMode),
    scenarioDomain: canonicalToken(proposal.scenarioDomain),
    scenarioEntity: canonicalToken(proposal.scenarioEntity, true),
    environment: canonicalToken(proposal.environment),
    scenarioAction: canonicalToken(proposal.scenarioAction),
    informationForm: canonicalToken(proposal.informationForm),
    questionPurpose: canonicalToken(proposal.questionPurpose),
    contextNecessity: canonicalToken(proposal.contextNecessity)
  } : null;
  const identity = canonicalDimensions ? {
    fingerprintVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_FINGERPRINT_VERSION,
    subject: clean(binding?.subject),
    taskFamily: clean(binding?.taskFamily),
    planTemplate: clean(binding?.planTemplate),
    exactScope: clean(binding?.exactScope),
    ...canonicalDimensions
  } : null;
  const renameInvariantIdentity = identity ? {
    ...identity,
    scenarioEntity: undefined
  } : null;
  const valid = failureCodes.length === 0;
  const creativeBlueprint = valid ? {
    scenarioMode: clean(proposal?.scenarioMode),
    scenarioDomain: clean(proposal?.scenarioDomain),
    scenarioEntity: clean(proposal?.scenarioEntity),
    environment: clean(proposal?.environment),
    scenarioAction: clean(proposal?.scenarioAction),
    informationForm: clean(proposal?.informationForm),
    questionPurpose: clean(proposal?.questionPurpose),
    contextNecessity: clean(proposal?.contextNecessity),
    // PostgreSQL jsonb does not preserve object key insertion order. Keep this
    // projection explicit so blueprint identity survives a database round trip.
    surface: {
      zhEntity: clean(surface?.zhEntity),
      enEntity: clean(surface?.enEntity),
      zhSetting: clean(surface?.zhSetting),
      enSetting: clean(surface?.enSetting)
    }
  } : null;
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION,
    fingerprintVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_FINGERPRINT_VERSION,
    stage: 'shadow_only_not_connected_to_generation',
    status: valid ? 'provisional_candidate' : 'rejected',
    failureCodes: [...new Set(failureCodes)],
    creativeBlueprint,
    canonicalDimensions: valid ? canonicalDimensions : null,
    blueprintFingerprint: valid ? `blueprint-${sha256(identity).slice(0, 24)}` : null,
    renameInvariantFingerprint: valid ? `blueprint-structure-${sha256(renameInvariantIdentity).slice(0, 24)}` : null,
    blueprintDigest: valid ? sha256({ identity, creativeBlueprint }) : null,
    modelMayChooseScientificTruth: false,
    numericContentAllowedAtProposalStage: false,
    eligibleForProductionGeneration: false,
    eligibleForStablePromotion: false,
    requiresDeterministicCompatibilityValidation: true,
    requiresDeterministicPlausibilityValidation: true,
    requiresSolverOracleValidation: true,
    requiresPublicationSuppressedShadow: true,
    sourceIsolation: {
      officialQuestionContentUsed: false,
      reversibleSourceFieldsUsed: false,
      historicalInput: 'fingerprints_and_distribution_summaries_only'
    }
  };
}

export function subjectPracticeScenarioBlueprintNoveltyFor(input: {
  blueprint?: unknown;
  historicalSummaries?: unknown[];
}) {
  const blueprint = recordFrom(input.blueprint);
  const history = Array.isArray(input.historicalSummaries)
    ? input.historicalSummaries.map(recordFrom)
    : [];
  const historyInputAccepted = Array.isArray(input.historicalSummaries ?? [])
    && history.every((item) => Boolean(item)
    && Object.keys(item as RecordValue).every((key) => HISTORY_KEYS.has(key))
    && clean((item as RecordValue).blueprintFingerprint)
    && clean((item as RecordValue).renameInvariantFingerprint));
  const candidateFingerprint = clean(blueprint?.blueprintFingerprint);
  const candidateStructure = clean(blueprint?.renameInvariantFingerprint);
  const exactDuplicate = historyInputAccepted && history.some((item) =>
    clean(item?.blueprintFingerprint) === candidateFingerprint);
  const renameOnly = historyInputAccepted && !exactDuplicate && history.some((item) =>
    clean(item?.renameInvariantFingerprint) === candidateStructure);
  const validCandidate = clean(blueprint?.status) === 'provisional_candidate'
    && Boolean(candidateFingerprint)
    && Boolean(candidateStructure);
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_POLICY_VERSION,
    status: !historyInputAccepted
      ? 'rejected_history_input_not_structural_only'
      : !validCandidate
        ? 'rejected_invalid_blueprint'
        : exactDuplicate
          ? 'rejected_exact_duplicate'
          : renameOnly
            ? 'rejected_rename_only'
            : 'novel_candidate',
    exactDuplicate,
    renameOnly,
    noveltyScore: !validCandidate || !historyInputAccepted || exactDuplicate ? 0 : renameOnly ? 0.1 : 1,
    historyInputAccepted,
    officialQuestionContentRequired: false,
    candidateContentRequired: false,
    eligibleForStablePromotion: false,
    productionGateImpact: 'none_shadow_only'
  };
}
