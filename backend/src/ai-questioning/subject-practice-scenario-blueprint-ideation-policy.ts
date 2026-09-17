import { createHash } from 'node:crypto';

export const SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION =
  'subject-practice-scenario-blueprint-ideation-request-v11-method-neutral-chemistry';

type RecordValue = Record<string, unknown>;

const BINDING_KEYS = new Set([
  'subject', 'taskFamily', 'planTemplate', 'exactScope', 'difficultyBand', 'targetCognitiveSkill'
]);
const HISTORY_KEYS = new Set([
  'dimensionCounts', 'underrepresentedDimensions', 'concentrationWarnings', 'failureReasonCodes'
]);
const DIMENSION_KEYS = new Set([
  'scenarioMode', 'scenarioDomain', 'scenarioEntity', 'environment',
  'scenarioAction', 'informationForm', 'questionPurpose', 'contextNecessity'
]);
const PROVIDER_CANDIDATE_KEYS = [
  'scenarioMode', 'scenarioDomain', 'scenarioEntity', 'environment', 'scenarioAction',
  'informationForm', 'questionPurpose', 'contextNecessity', 'surface'
] as const;
const PROVIDER_SURFACE_KEYS = ['zhEntity', 'enEntity', 'zhSetting', 'enSetting'] as const;
const SAFE_CODE = /^[a-z0-9_:-]{1,100}$/;

function recordFrom(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function containsForbiddenContentKey(value: unknown): boolean {
  const record = recordFrom(value);
  if (!record) return false;
  return Object.entries(record).some(([key, child]) =>
    /^(?:prompt|question|questiontext|questioncontent|answer|correctanswer|option|options|choice|choices|solution|explanation|source.*text|official.*content|题干|答案|选项|解析|真题)$/i.test(key)
    || containsForbiddenContentKey(child));
}

function supportedBinding(binding: RecordValue | null) {
  const subject = lower(binding?.subject);
  return (subject === 'physics'
      && lower(binding?.taskFamily) === 'kinematics_basic_direct_relation'
      && lower(binding?.planTemplate) === 'physics_kinematics_basic_relation_v1')
    || (subject === 'chemistry'
      && lower(binding?.taskFamily) === 'ph_dilution_strong_acid_base_neutralization'
      && lower(binding?.planTemplate) === 'chemistry_strong_acid_base_single_relation_v1');
}

function safeStringArray(value: unknown) {
  return Array.isArray(value)
    && value.length <= 40
    && value.every((item) => typeof item === 'string' && SAFE_CODE.test(lower(item)));
}

function safeDimensionRecord(value: unknown, numericValues: boolean) {
  const record = recordFrom(value);
  return Boolean(record)
    && Object.keys(record as RecordValue).every((key) => DIMENSION_KEYS.has(key))
    && Object.values(record as RecordValue).every((item) => numericValues
      ? Number.isInteger(Number(item)) && Number(item) >= 0
      : safeStringArray(item));
}

export function subjectPracticeScenarioBlueprintIdeationRequestFor(input: {
  binding?: unknown;
  historySummary?: unknown;
  requestedCandidateCount?: unknown;
}) {
  const binding = recordFrom(input.binding);
  const history = recordFrom(input.historySummary);
  const requestedCandidateCount = Number(input.requestedCandidateCount ?? 3);
  const failureCodes: string[] = [];
  if (!binding || Object.keys(binding).some((key) => !BINDING_KEYS.has(key)) || !supportedBinding(binding)) {
    failureCodes.push('scenario_ideation_binding_invalid_or_unsupported');
  }
  if (!clean(binding?.exactScope) || !clean(binding?.difficultyBand) || !clean(binding?.targetCognitiveSkill)) {
    failureCodes.push('scenario_ideation_binding_field_missing');
  }
  if (!history || Object.keys(history).some((key) => !HISTORY_KEYS.has(key))) {
    failureCodes.push('scenario_ideation_history_summary_invalid');
  }
  if (history && (!safeDimensionRecord(history.dimensionCounts, true)
    || !safeDimensionRecord(history.underrepresentedDimensions, false)
    || !safeStringArray(history.concentrationWarnings)
    || !safeStringArray(history.failureReasonCodes))) {
    failureCodes.push('scenario_ideation_history_summary_not_structural');
  }
  if (containsForbiddenContentKey(input.binding) || containsForbiddenContentKey(input.historySummary)) {
    failureCodes.push('scenario_ideation_question_or_source_content_forbidden');
  }
  if (!Number.isInteger(requestedCandidateCount) || requestedCandidateCount < 2 || requestedCandidateCount > 6) {
    failureCodes.push('scenario_ideation_candidate_count_out_of_bounds');
  }
  if (failureCodes.length) {
    return {
      policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION,
      status: 'rejected',
      failureCodes: [...new Set(failureCodes)],
      providerCallAuthorized: false,
      productionGenerationAuthorized: false,
      publicationAuthorized: false
    };
  }
  const dimensionCounts = recordFrom(history?.dimensionCounts) as RecordValue;
  const underrepresentedDimensions = recordFrom(history?.underrepresentedDimensions) as RecordValue;
  const canonicalHistorySummary = {
    dimensionCounts: Object.fromEntries([...DIMENSION_KEYS]
      .filter((key) => Object.prototype.hasOwnProperty.call(dimensionCounts, key))
      .sort()
      .map((key) => [key, Number(dimensionCounts[key])])),
    underrepresentedDimensions: Object.fromEntries([...DIMENSION_KEYS]
      .filter((key) => Object.prototype.hasOwnProperty.call(underrepresentedDimensions, key))
      .sort()
      .map((key) => [key, [...(underrepresentedDimensions[key] as string[])].map(lower).sort()])),
    concentrationWarnings: [...(history?.concentrationWarnings as string[])].map(lower).sort(),
    failureReasonCodes: [...(history?.failureReasonCodes as string[])].map(lower).sort()
  };
  const safePayload = {
    binding: {
      subject: lower(binding?.subject),
      taskFamily: lower(binding?.taskFamily),
      planTemplate: lower(binding?.planTemplate),
      exactScope: lower(binding?.exactScope),
      difficultyBand: lower(binding?.difficultyBand),
      targetCognitiveSkill: lower(binding?.targetCognitiveSkill)
    },
    historySummary: canonicalHistorySummary,
    requestedCandidateCount
  };
  const systemPrompt = [
    'You propose scenario blueprints for a deterministic educational question generator.',
    'Return raw JSON only; no question, answer, options, explanation, formula, number, quantity, or parameter.',
    'Scientific truth belongs to the downstream deterministic solver and oracle.',
    'Stay solver-neutral: omit the exact quantity, relation, formula, and answer-target variable.',
    'Make structures distinct after ignoring entity, location, person, and number changes.',
    'Use only structural coverage; no official or historical question content is provided.'
  ].join(' ');
  const providerContext = safePayload.binding.subject === 'physics'
    ? { subject: 'physics', scenarioContextClass: 'motion_observation_context' }
    : { subject: 'chemistry', scenarioContextClass: 'solution_experiment_context' };
  const fieldRules = safePayload.binding.subject === 'physics' ? {
    everyValue: 'concrete nonempty string <=120 chars; no digits/number words; never copy contract text',
    scenarioAction: 'generic context action, e.g. deliver supplies, inspect route, monitor equipment, transport materials',
    questionPurpose: 'specific scenario decision/check/compare/explanation tied to action and information form',
    purposeBan: 'generic; calculated target; without naming; solver-neutral; exact quantity',
    forbiddenMeaning: 'speed, velocity, acceleration, displacement, distance, elapsed time, rate of motion, change in position, formulas, quantities, and Chinese equivalents',
    surface: 'entity and setting labels only; no measurement target or scientific relation'
  } : {
    everyValue: 'nonempty string <=120 chars; no digits, number words, or copied rule text',
    scenarioEntity: 'exactly one liquid solution/sample/aliquot/mixture/water/reagent; no solid, organism, landscape, line, specimen, or batch',
    scenarioAction: 'assess/prepare/adjust one liquid using recorded solution data; no named test method, added reagent/solid, visual change, time series, or sample comparison',
    questionPurpose: 'specific chemical or solution-property decision/check/explanation tied to the action and information form; omit the exact relation and answer target',
    scopeBoundary: 'no titration, endpoint, indicator, buffer, weak/polyprotic system, hydrolysis, equilibrium, replicate, or pair',
    purposeBan: 'generic; calculated target; without naming; solver-neutral; exact quantity',
    forbiddenMeaning: 'pH, concentration, volume, dilution, neutralization, acid, base, mixing ratio, formula, quantity, and Chinese equivalents',
    surface: 'entity and setting labels only; no measurement target or chemical relation'
  };
  const userPrompt = JSON.stringify({
    task: 'propose_structurally_distinct_scenario_blueprints',
    providerContext,
    historySummary: safePayload.historySummary,
    requestedCandidateCount: safePayload.requestedCandidateCount,
    fieldRules,
    outputContract: {
      rawJsonOnly: 'object only; no markdown/fences/comments/prose',
      topLevelKeys: 'candidates only',
      candidateCount: safePayload.requestedCandidateCount,
      exactCandidateKeys: PROVIDER_CANDIDATE_KEYS.join(','),
      exactSurfaceKeys: PROVIDER_SURFACE_KEYS.join(','),
      fixedValues: {
        scenarioMode: 'exactly one of real_world, experimental, hypothetical',
        contextNecessity: 'exactly required_for_solution'
      },
      purposeRule: safePayload.binding.subject === 'chemistry'
        ? 'scenario-specific decision/check/explain for one sample; never compare samples or copy instruction text'
        : 'scenario-specific decision/check/compare/explain; never instruction text',
      batchUniqueness: 'structurally distinct even after ignoring entity names'
    }
  });
  const promptCharacterCount = systemPrompt.length + userPrompt.length;
  if (promptCharacterCount > 6_000) {
    return {
      policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION,
      status: 'rejected',
      failureCodes: ['scenario_ideation_prompt_budget_exceeded'],
      providerCallAuthorized: false,
      productionGenerationAuthorized: false,
      publicationAuthorized: false
    };
  }
  return {
    policyVersion: SUBJECT_PRACTICE_SCENARIO_BLUEPRINT_IDEATION_POLICY_VERSION,
    status: 'ready_for_separately_authorized_shadow_ideation',
    requestDigest: createHash('sha256').update(JSON.stringify(safePayload)).digest('hex'),
    requestPayload: safePayload,
    providerVisibleBindingProjection: providerContext,
    binding: safePayload.binding,
    systemPrompt,
    userPrompt,
    requestedCandidateCount,
    promptCharacterCount,
    maximumPromptCharacters: 6_000,
    recommendedMaximumOutputTokens: 1_000,
    maximumResponseCharacters: 24_000,
    samplingIntent: 'divergent_independent_ideation',
    officialQuestionContentIncluded: false,
    historicalQuestionContentIncluded: false,
    modelScientificAuthority: false,
    providerCallAuthorized: false,
    productionGenerationAuthorized: false,
    publicationAuthorized: false,
    productionGateImpact: 'none_shadow_only'
  };
}
