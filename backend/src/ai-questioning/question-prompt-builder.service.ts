import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanSupportsTaskFamily
} from './subject-practice-question-plan-policy';
import {
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_FORBIDDEN_SOURCE_FIELDS,
  SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
  SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE
} from './subject-practice-generator-source-isolation-policy';

export type QuestionGenerationBlueprint = {
  id: number;
  subject: string;
  topicId: number;
  topicCode?: string | null;
  topicModule?: string | null;
  topicTitle: string;
  syllabusVersion: string;
  examScope?: string | null;
  allowedQuestionTypes?: unknown;
  difficultyRange?: unknown;
  excludedScope?: unknown;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  difficulty: string;
  questionType: string;
  skill: string | null;
  constraints: unknown;
};

const GUARDED_QUESTION_PROMPT_CHARACTER_BUDGETS: Readonly<Record<string, number>> = Object.freeze({
  math_medium_exp_log_ordering_chain_v1: 15000,
  math_elementary_function_relation_v1: 15000,
  chemistry_medium_classification_evidence_v1: 15000,
  physics_medium_optics_two_relation_v1: 15000
});
const DEFAULT_QUESTION_PLAN_PROMPT_CHARACTER_BUDGET = 20000;
const DEFAULT_QUESTION_GENERATION_PROMPT_CHARACTER_BUDGET = 24000;

export function questionPromptCharacterBudgetForPlanTemplate(value: unknown) {
  const planTemplate = String(value ?? '').trim();
  if (!planTemplate) return DEFAULT_QUESTION_GENERATION_PROMPT_CHARACTER_BUDGET;
  return GUARDED_QUESTION_PROMPT_CHARACTER_BUDGETS[planTemplate]
    ?? DEFAULT_QUESTION_PLAN_PROMPT_CHARACTER_BUDGET;
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanText(item)).filter(Boolean)));
}

function constraintsRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJsonValue(entry)]));
  }
  return value;
}

const FORBIDDEN_SOURCE_TEXT_KEYS = new Set([
  'rawSourceQuestion', 'sourceQuestion', 'originalQuestion', 'sourcePrompt', 'sourceText',
  'rawExample', 'originalPrompt', 'originalOptions', 'correctAnswer', 'originalAnswer',
  'originalExplanation', 'sourcePayload', 'reversibleSourcePayload',
  'generationGuidelines', 'reviewerGuidelines', 'similarityRiskSignals'
]);

function collectKnownSourceTextFragments(value: unknown, depth = 0, collect = false): string[] {
  if (depth > 6 || value === null || value === undefined) return [];
  if (typeof value === 'string') return collect && cleanText(value).length >= 12 ? [cleanText(value)] : [];
  if (Array.isArray(value)) return value.flatMap((entry) => collectKnownSourceTextFragments(entry, depth + 1, collect));
  if (typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
    collectKnownSourceTextFragments(entry, depth + 1, collect || FORBIDDEN_SOURCE_TEXT_KEYS.has(key)));
}

function normalizedLeakComparisonText(value: unknown) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, '');
}

function containsSourceTextWindow(providerText: string, sourceText: string) {
  const source = normalizedLeakComparisonText(sourceText);
  if (source.length < 12) return false;
  const windowSize = Math.min(24, source.length);
  for (let index = 0; index <= source.length - windowSize; index += 1) {
    if (providerText.includes(source.slice(index, index + windowSize))) return true;
  }
  return false;
}

function safeStructuralToken(value: unknown, maximumLength = 80) {
  const text = cleanText(value);
  return text.length > 0
    && text.length <= maximumLength
    && /^[a-z0-9_.:+/-]+$/i.test(text)
    ? text
    : null;
}

function safeStructuralTokenArray(value: unknown, maximumItems = 8) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .map((item) => safeStructuralToken(item))
    .filter((item): item is string => Boolean(item))))
    .slice(0, maximumItems);
}

const CONTROLLED_PROFILE_TOKENS = new Set([
  'basic', 'medium', 'hard', 'low', 'high', 'light', 'heavy', 'none',
  'concept_check', 'concept_judgement', 'concept_identification', 'concept_discrimination',
  'calculation', 'formula_calculation', 'calculation_application', 'direct_application', 'standard_application',
  'comparison_judgement', 'derivative_judgement', 'equation_selection', 'parameter_judgement',
  'probability_judgement', 'property_judgement', 'scenario_application',
  'spatial_geometry_judgement', 'statistic_judgement',
  'multi_step_reasoning', 'proof_reasoning', 'experimental_judgement',
  'experimental_design', 'data_interpretation', 'graph_interpretation',
  'classification', 'ordering', 'transformation', 'application',
  'analysis', 'synthesis', 'evaluation', 'reasoning', 'basic_recall',
  'evidence_chain_discrimination', 'notation_application',
  'inference', 'interpretation', 'proof', 'mixed', 'subject', 'topic', 'global'
]);

function controlledProfileToken(value: unknown) {
  const token = safeStructuralToken(value);
  return token && CONTROLLED_PROFILE_TOKENS.has(token.toLowerCase()) ? token.toLowerCase() : null;
}

function controlledProfileTokenArray(value: unknown, maximumItems = 8) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(controlledProfileToken).filter((item): item is string => Boolean(item))))
    .slice(0, maximumItems);
}

const CONTROLLED_RUNTIME_TOKENS = new Set([
  'subject_practice', 'online_mock_exam', 'mock_exam_blueprint_slot',
  'subject_practice_candidate', 'subject_practice_production_matrix',
  'subject_practice_production_matrix_observation', 'online_mock_exam_candidate',
  'expand_candidates', 'zh', 'en', 'bilingual', 'zh-cn', 'en-us'
]);

function controlledRuntimeToken(value: unknown) {
  const token = safeStructuralToken(value);
  return token && CONTROLLED_RUNTIME_TOKENS.has(token.toLowerCase()) ? token.toLowerCase() : null;
}

function aggregateLoadDistribution(value: unknown) {
  const source = constraintsRecord(value);
  return Object.fromEntries(['low', 'medium', 'high']
    .map((key) => [key, finiteBoundedNumber(source[key], 0, 1)] as const)
    .filter(([, entry]) => entry !== null));
}

function finiteBoundedNumber(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : null;
}

function structuralRecord(value: unknown, depth = 0): Record<string, unknown> {
  if (depth > 2) return {};
  const source = constraintsRecord(value);
  const entries: Array<[string, unknown]> = [];
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = safeStructuralToken(rawKey, 48);
    if (!key) continue;
    if (typeof rawValue === 'boolean') {
      entries.push([key, rawValue]);
      continue;
    }
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      entries.push([key, rawValue]);
      continue;
    }
    if (typeof rawValue === 'string') {
      const token = safeStructuralToken(rawValue);
      if (token) entries.push([key, token]);
      continue;
    }
    if (Array.isArray(rawValue)) {
      const tokens = safeStructuralTokenArray(rawValue);
      if (tokens.length) entries.push([key, tokens]);
      continue;
    }
    const nested = structuralRecord(rawValue, depth + 1);
    if (Object.keys(nested).length) entries.push([key, nested]);
  }
  return Object.fromEntries(entries);
}

function sourceIsolatedTargetProfile(value: unknown) {
  const profile = constraintsRecord(value);
  return Object.fromEntries(Object.entries({
    questionForm: controlledProfileToken(profile.questionForm),
    cognitiveSkill: controlledProfileToken(profile.cognitiveSkill),
    difficultyBand: controlledProfileToken(profile.difficultyBand),
    readingLoad: controlledProfileToken(profile.readingLoad),
    calculationLoad: controlledProfileToken(profile.calculationLoad),
    estimatedTimeSeconds: finiteBoundedNumber(profile.estimatedTimeSeconds, 1, 3600),
  }).filter(([, item]) => item !== null && (!Array.isArray(item) || item.length > 0)));
}

function sourceIsolatedPromptConstraints(value: unknown) {
  const constraints = constraintsRecord(value);
  const mockExamSlot = constraintsRecord(constraints.mockExamSlot);
  const projectedMockSlot = Object.fromEntries(Object.entries({
    slotNumber: finiteBoundedNumber(mockExamSlot.slotNumber, 1, 1000)
  }).filter(([, item]) => item !== null));
  return Object.fromEntries(Object.entries({
    intendedUse: controlledRuntimeToken(constraints.intendedUse),
    generationSource: controlledRuntimeToken(constraints.generationSource),
    targetUseCase: controlledRuntimeToken(constraints.targetUseCase),
    roundSize: finiteBoundedNumber(constraints.roundSize, 1, 1000),
    language: controlledRuntimeToken(constraints.language),
    locale: controlledRuntimeToken(constraints.locale),
    requiresBilingualLocalization: typeof constraints.requiresBilingualLocalization === 'boolean'
      ? constraints.requiresBilingualLocalization
      : null,
    mockExamSlot: Object.keys(projectedMockSlot).length ? projectedMockSlot : null
  }).filter(([, item]) => item !== null));
}

function canonicalQuestionPlanForPrompt(value: unknown, blueprint: QuestionGenerationBlueprint) {
  const plan = constraintsRecord(value);
  const renderConstraints = constraintsRecord(plan.renderConstraints);
  const scenarioContract = constraintsRecord(plan.scenarioContract);
  if (!Object.keys(plan).length) return {};
  return constraintsRecord(buildSubjectPracticeQuestionPlan({
    subject: safeStructuralToken(plan.subject) ?? blueprint.subject,
    topicId: blueprint.topicId,
    topicTitle: blueprint.topicTitle,
    productionCellId: finiteBoundedNumber(plan.productionCellId, 1, Number.MAX_SAFE_INTEGER),
    targetDifficulty: safeStructuralToken(plan.targetDifficulty) ?? blueprint.difficulty,
    taskFamily: safeStructuralToken(plan.taskFamily),
    planTemplate: safeStructuralToken(plan.planTemplate),
    requiredSinglePropertyTarget: safeStructuralToken(renderConstraints.requiredSinglePropertyTarget),
    requiredElementaryFunctionClass: safeStructuralToken(renderConstraints.requiredElementaryFunctionClass),
    exactLineRelationScope: safeStructuralToken(renderConstraints.exactLineRelationScope),
    exactPhysicsKinematicsScope: safeStructuralToken(renderConstraints.exactPhysicsKinematicsScope),
    exactChemistryRelationKind: safeStructuralToken(renderConstraints.exactChemistryRelationKind),
    exactChemistryAnswerTarget: safeStructuralToken(renderConstraints.exactChemistryAnswerTarget),
    requestedScenarioFamilyId: safeStructuralToken(scenarioContract.scenarioFamilyId)
  }));
}

function sourceIsolatedStyleReference(styleProfileValue: unknown, targetProfile: Record<string, unknown>) {
  const styleProfile = constraintsRecord(styleProfileValue);
  const profile = constraintsRecord(styleProfile.profile);
  return {
    policy: 'structural_profile_only_source_unseen',
    sampleSize: finiteBoundedNumber(styleProfile.sampleSize, 0, 100000),
    scopeType: controlledProfileToken(styleProfile.scopeType),
    commonQuestionForms: controlledProfileTokenArray(profile.commonQuestionForms),
    commonCognitiveSkills: controlledProfileTokenArray(profile.commonCognitiveSkills),
    readingLoadDistribution: aggregateLoadDistribution(profile.readingLoadDistribution),
    calculationLoadDistribution: aggregateLoadDistribution(profile.calculationLoadDistribution),
    estimatedTimeSeconds: finiteBoundedNumber(profile.estimatedTimeSeconds, 1, 3600),
    targetProfile: Object.keys(targetProfile).length ? targetProfile : null
  };
}

function excludedScopeFromConstraints(value: unknown) {
  const record = constraintsRecord(value);
  return stringArray(record.excludedScope ?? record.exclusions ?? record.exclude);
}

function isMockExamGeneration(value: unknown) {
  const record = constraintsRecord(value);
  const expansion = constraintsRecord(record.expansion);
  const generationMode = cleanText(expansion.generationMode);
  return cleanText(record.generationSource) === 'mock_exam_blueprint_slot' ||
    generationMode === 'online_mock_exam_candidate' ||
    generationMode.startsWith('online_mock_candidate_') ||
    Object.keys(constraintsRecord(record.mockExamSlot)).length > 0;
}

function mockExamSubjectGuard(subject: string) {
  if (subject === 'math') return 'For math candidates, do not use chemistry, physics, biology, finance, or lab-experiment wrappers unless the syllabusScope explicitly requires that context.';
  if (subject === 'physics') return 'For physics candidates, keep the stem in a physics situation; do not use chemistry reaction or pure math wrappers unless the syllabusScope explicitly requires them.';
  if (subject === 'chemistry') return 'For chemistry candidates, keep the stem in chemistry concepts, substances, reactions, or lab reasoning; do not use pure math wrappers unless the syllabusScope explicitly requires them.';
  return 'Keep the stem inside the selected subject; do not use unrelated cross-subject wrappers.';
}

function mockExamTargetProfileContract(targetProfile: Record<string, unknown>) {
  if (!Object.keys(targetProfile).length) return '';
  const generationStrategy = constraintsRecord(targetProfile.generationStrategy);
  const requiredStemPattern = cleanText(generationStrategy.requiredStemPattern);
  const requiredStemPatternInstruction = cleanText(generationStrategy.requiredStemPatternInstruction);
  const bannedStemPatterns = stringArray(generationStrategy.bannedStemPatterns);
  const promptChecklist = stringArray(generationStrategy.promptChecklist);
  return [
    'For online mock exam candidates, targetProfile is a hard contract, not a loose hint.',
    'The generated item must satisfy targetProfile.questionForm, targetProfile.cognitiveSkill, targetProfile.difficultyBand, targetProfile.readingLoad, and targetProfile.calculationLoad at the same time.',
    'If targetProfile.questionForm or targetProfile.cognitiveSkill cannot be met with the current problem idea, discard that idea and generate a different problem rather than simplifying it.',
    requiredStemPattern
      ? `You must follow targetProfile.generationStrategy.requiredStemPattern=${requiredStemPattern}. ${requiredStemPatternInstruction}`
      : '',
    bannedStemPatterns.length
      ? `Do not use these banned stem patterns: ${bannedStemPatterns.join(', ')}.`
      : '',
    promptChecklist.length
      ? `Generation checklist: ${promptChecklist.join(' ')}`
      : '',
    'For concept_check or concept_judgement, ask students to judge/compare/select a valid statement, transformation, condition, graph feature, or reasoning claim; do not ask a plain numeric solve.',
    'For calculation_application, include enough conditions and operations to match the requested calculationLoad; avoid single-step substitution unless calculationLoad is explicitly light and difficultyBand is basic.',
    'For standard_application or multi_step_reasoning, require a recognizable reasoning path with connected conditions, not isolated arithmetic or definition recall.',
    'For medium/hard difficulty, avoid atomic prompts such as direct powers, direct definition questions, or one-line inequality solving unless the slot profile explicitly asks for that low-complexity form.'
  ].join(' ');
}

function subjectPracticeGenerationStrategyContract(targetProfile: Record<string, unknown>) {
  const generationStrategy = constraintsRecord(targetProfile.generationStrategy);
  if (!Object.keys(generationStrategy).length) return '';
  const requiredStemPattern = cleanText(generationStrategy.requiredStemPattern);
  const requiredStemPatternInstruction = cleanText(generationStrategy.requiredStemPatternInstruction);
  const bannedStemPatterns = stringArray(generationStrategy.bannedStemPatterns);
  const promptChecklist = stringArray(generationStrategy.promptChecklist);
  const reviewerEvidenceTargets = stringArray(generationStrategy.reviewerEvidenceTargets);
  const diversityAxes = stringArray(generationStrategy.diversityAxes);
  const minimumDiversityAxesPerRetryRaw = Number(generationStrategy.minimumDiversityAxesPerRetry);
  const minimumDiversityAxesPerRetry = diversityAxes.length
    ? Number.isInteger(minimumDiversityAxesPerRetryRaw) && minimumDiversityAxesPerRetryRaw > 0
      ? Math.min(minimumDiversityAxesPerRetryRaw, diversityAxes.length)
      : Math.min(3, diversityAxes.length)
    : 0;
  return [
    'For subject-practice production, targetProfile.generationStrategy is a hard generation contract for this cell.',
    requiredStemPattern
      ? `You must follow targetProfile.generationStrategy.requiredStemPattern=${requiredStemPattern}. ${requiredStemPatternInstruction}`
      : '',
    bannedStemPatterns.length
      ? `Do not use these banned stem patterns: ${bannedStemPatterns.join('; ')}.`
      : '',
    reviewerEvidenceTargets.length
      ? `The finished item must visibly contain these reviewer evidence targets: ${reviewerEvidenceTargets.join('; ')}.`
      : '',
    promptChecklist.length
      ? `Before returning JSON, verify this checklist: ${promptChecklist.join('; ')}.`
      : '',
    diversityAxes.length
      ? `Across retries, vary at least ${minimumDiversityAxesPerRetry} of these axes instead of only changing numbers or option order: ${diversityAxes.join('; ')}.`
      : ''
  ].filter(Boolean).join(' ');
}

function subjectPracticeQuestionPlanContract(questionPlan: Record<string, unknown>) {
  if (!Object.keys(questionPlan).length) return '';
  const renderConstraints = constraintsRecord(questionPlan.renderConstraints);
  const renderGuidance: string[] = [];
  const scaffoldGuidance = subjectPracticeQuestionPlanScaffoldGuidance(questionPlan);
  const failureAvoidanceGuidance = subjectPracticeQuestionPlanFailureAvoidanceGuidance(questionPlan);
  if (renderConstraints.pureMathStemOnly === true || renderConstraints.externalContextAllowed === false) {
    renderGuidance.push('When questionPlan.renderConstraints conflict with targetProfile surface fields, the renderConstraints win: keep the stem self-contained and do not add real-world contexts, figure dependence, or five-plus condition chains merely to satisfy readingLoad; use table or frequency data only when the QuestionPlan evidence slots explicitly require data/statistics.');
  }
  if (Number(renderConstraints.maxVectorOrComplexObjects) > 0) {
    renderGuidance.push(`Use at most ${Number(renderConstraints.maxVectorOrComplexObjects)} vector/complex objects.`);
  }
  if (Number(renderConstraints.maxIndependentRelations) > 0) {
    renderGuidance.push(`Use at most ${Number(renderConstraints.maxIndependentRelations)} independent relations.`);
  }
  if (Number(renderConstraints.maxFunctionObjects) > 0) {
    renderGuidance.push(`Use at most ${Number(renderConstraints.maxFunctionObjects)} explicit function or expression objects; never introduce extra f/g/h function families to inflate readingLoad.`);
  }
  if (Number(renderConstraints.maxFunctionPropertyStack) > 0) {
    renderGuidance.push(`Use at most ${Number(renderConstraints.maxFunctionPropertyStack)} function-property categories in the stem and answer options.`);
  }
  if (Number(renderConstraints.minMediumFunctionVisibleMoves) >= 2 || renderConstraints.forbidMediumFunctionPropertyStackInflation === true) {
    renderGuidance.push('For medium function-property plans, require exactly two visible moves: one function property plus one short interval, value, discriminant, or counterexample check; do not inflate into parameter inference, universal proof, piecewise cases, or four-or-more property stacks.');
  }
  if (renderConstraints.forbidMediumFunctionExternalContextWrapper === true) {
    renderGuidance.push('For medium function-property plans, do not use real-world wrappers such as profit, cost, sales, population, water-level, temperature, sensor, experiment, biology, or finance scenarios.');
  }
  if (renderConstraints.forbidHardFunctionGenericConceptOnly === true || Number(renderConstraints.minHardFunctionVisibleConstraints) >= 2) {
    renderGuidance.push('For hard function-property plans, do not ask generic function-property propositions without a concrete function, interval, parameter, discriminant, inverse, counterexample, or second visible constraint; hard difficulty must be visible in the stem.');
  }
  if (Number(renderConstraints.maxEnumeratedConditions) > 0) {
    renderGuidance.push(`Use at most ${Number(renderConstraints.maxEnumeratedConditions)} enumerated given conditions; avoid ①②③④-style condition stacks beyond that cap.`);
  }
  if (renderConstraints.forbidPiecewise === true || renderConstraints.forbidDomainSplitDefinitions === true) {
    renderGuidance.push('Do not use piecewise functions, domain-split definitions, absolute-value piecewise expansion, or separate cases by x ranges.');
  }
  if (renderConstraints.forbidGenericFunctionListClassification === true) {
    renderGuidance.push('Do not use bare function-list classification prompts such as "which of the following functions is odd/even/increasing/decreasing"; give a concrete expression, interval, bound, or comparison relation in the stem.');
  }
  if (renderConstraints.requireConcreteSampleSpaceForBasic === true) {
    renderGuidance.push('For basic probability, include explicit sample-space or distribution numbers plus one named event/threshold/interval; do not ask concept-only applicability or definition questions.');
  }
  if (renderConstraints.forbidBasicProbabilityTargetProfileInflation === true) {
    renderGuidance.push('For basic probability, do not obey targetProfile concept_check, high-reading, or multi_step surface fields by writing abstract applicability, definition, or general "which statement is correct" items; keep finite objects, the total count, one named event, and one visible favorable-count/probability relation.');
  }
  if (renderConstraints.forbidSingleResultOnly === true) {
    renderGuidance.push('Do not make probability medium as a single favorable-count result; include two connected event/counting/probability relations before option judgement.');
  }
  if (Number(renderConstraints.minProbabilityReasoningLayers) >= 3 || renderConstraints.requireHardProbabilityRestrictionRoundTrip === true) {
    renderGuidance.push('For hard probability, require at least three visible reasoning layers: sample space or distribution, case split/complement/conditional relation, and an interacting restriction round-trip; do not rely on event labels, large numbers, or option wording to imply hard difficulty.');
  }
  if (renderConstraints.requireHardInteractionCue === true || renderConstraints.forbidEventListOnly === true) {
    renderGuidance.push('For hard probability, include case split, complement, conditional, without-replacement order, at-least/at-most, dependence, or parameter interaction; do not merely list events A/B/C/D.');
  }
  if (renderConstraints.forbidLargeNormalReferenceTable === true) {
    renderGuidance.push('Do not use a large normal reference table; use one or two stated Phi/z/symmetry values and a visible standardization or inverse-standardization relation.');
  }
  if (renderConstraints.requireNormalDistributionEvidence === true || renderConstraints.requireVisibleStandardizationOrPhiRelation === true) {
    renderGuidance.push('For normal-distribution probability, include N(mu,sigma^2) or standard-normal notation plus a concrete threshold/interval event; medium and hard items must show a z-score, Phi value, symmetry, standardization, or inverse-standardization relation before option judgement.');
  }
  if (renderConstraints.selfContainedCoordinatesOrComplexExpression === true || renderConstraints.requireVisibleCoordinateModulusDotConjugateOrAngleRelation === true) {
    renderGuidance.push('For vector/complex plans, give self-contained coordinates or z=a+bi data and visibly use modulus, conjugate, real/imaginary part, dot product, angle, perpendicular, or parallel relations.');
  }
  if (renderConstraints.forbidHiddenDiagramDependency === true || renderConstraints.forbidLocusOrParameterChain === true || renderConstraints.forbidOneStepFormulaOnly === true || renderConstraints.forbidHardDirectMetricOnly === true) {
    renderGuidance.push('Do not use vector/complex shortcut shells: no hidden diagram dependency, no medium locus/parameter chain, no one-step formula-only item for medium/hard, and no direct metric-only hard item.');
  }
  if (renderConstraints.forbidCoordinateGeometryDistanceProjectionShell === true) {
    renderGuidance.push('Do not convert vector/complex tasks into analytic-geometry point-line/projection shells: no point P/Q on line l, point-to-line distance, projection point, foot of perpendicular, line equation, or slope/intersection as the main task.');
  }
  if (renderConstraints.requireHardVectorComplexTwoVisibleRelations === true) {
    renderGuidance.push('For hard vector/complex plans, combine two visible vector/complex relations such as modulus plus conjugate, perpendicular plus parameter, or argument plus real/imaginary constraint before option elimination; a single dot product, modulus, or coordinate result is not enough.');
  }
  if (renderConstraints.forbidBasicFunctionMixedRadicalAndDenominatorDomain === true) {
    renderGuidance.push('For basic function-domain plans, use either one radical constraint or one reciprocal-denominator constraint, not both in the same item; keep the answer to one direct domain/value/property judgement.');
  }
  if (renderConstraints.forbidBasicDerivativeComplexity === true || renderConstraints.forbidBasicDerivativeDomainTrap === true || renderConstraints.forbidPiecewiseParameterContinuityChain === true) {
    renderGuidance.push('Do not use derivative shortcut shells: basic must avoid piecewise, parameters, continuity/left-right derivative traps, undefined-domain traps, quotient/product/chain-rule, trig/log/root, and second derivative; medium/hard must avoid unsupported piecewise-parameter continuity chains.');
  }
  if (renderConstraints.forbidBasicDerivativeTargetProfileInflation === true || Number(renderConstraints.maxBasicDerivativeReasoningMoves) === 1) {
    renderGuidance.push('For basic derivative, do not obey targetProfile high-reading, multi_step, or medium-calculation surface fields by adding parameters, multiple conditions, piecewise/domain traps, second derivative moves, or advanced derivative rules; use one visible derivative value, tangent slope, or one-interval sign fact only.');
  }
  if (renderConstraints.forbidMediumDerivativeDefinitionOnly === true || Number(renderConstraints.minDerivativeLinkedMoves) >= 2) {
    renderGuidance.push('For medium derivative, do not write definition-only differentiability or geometric-meaning questions; require exactly two visible derivative-linked moves before option judgement, such as differentiating f(x) and applying one tangent, monotonicity, extremum, sign, or interval condition.');
  }
  if (renderConstraints.forbidDerivativeOneStepOnly === true || renderConstraints.requireVisibleDerivativeConditionChain === true) {
    renderGuidance.push('Do not use derivative one-step-only prompts for medium/hard; show derivative evidence plus a visible tangent, monotonicity, extremum, sign, interval, parameter, or option-elimination condition chain.');
  }
  if (renderConstraints.forbidDefinitionOnlyConicClassification === true) {
    renderGuidance.push('Do not use definition-only conic classification; include a point, line, circle/conic equation, tangent, chord, distance, intersection, parameter, or symmetry relation.');
  }
  if (renderConstraints.requireHardAnalyticGeometrySecondConstraint === true || renderConstraints.forbidHardAnalyticGeometryConicRelationOnly === true) {
    renderGuidance.push('For hard analytic-geometry plans, require a second visible tangent, chord, range, parameter, distance, area, or intersection constraint before option judgement; a shared-focus, eccentricity, or direct conic equation relation alone is not hard.');
  }
  if (renderConstraints.forbidGenericSequenceClassification === true) {
    renderGuidance.push('Do not ask generic arithmetic/geometric sequence classification; give explicit term, sum, common-difference/common-ratio, or recurrence data.');
  }
  if (renderConstraints.forbidBasicSequenceTargetProfileInflation === true) {
    renderGuidance.push('For basic sequence plans, do not obey targetProfile concept_check or medium-reading surface fields by writing definition-only arithmetic/geometric classification; give one visible sequence model, one term/sum/common-ratio/common-difference datum, and one direct requested value or relation.');
  }
  if (renderConstraints.forbidBasicMultiStatisticComparison === true || renderConstraints.forbidPureLinearTransformOnly === true || renderConstraints.forbidHardDirectCombinedVarianceOnly === true) {
    renderGuidance.push('Do not use statistics shortcut shells such as two-group mean-plus-variance comparison for basic, pure y=ax+b variance transform for medium, or direct combined-variance-only calculation for hard.');
  }
  if (renderConstraints.requireMediumStatisticsChangedSampleOrSecondRelation === true) {
    renderGuidance.push('For medium statistics plans, require one changed-sample, grouped/frequency, missing-value, weighted, comparison, or second-statistic relation before option judgement; do not use pure linear transform y=ax+b as the whole item.');
  }
  if (renderConstraints.requireHardStatisticsSecondIndependentConstraint === true) {
    renderGuidance.push('For hard statistics plans, add a second independent condition such as a missing value, changed sample, weighted/frequency table, range constraint, or parameter condition before judging the answer; do not stop at a direct combined-variance calculation.');
  }
  if (renderConstraints.forbidHardStatisticsDirectFormulaOnly === true) {
    renderGuidance.push('For hard statistics plans, do not rely on a direct formula-only variance or mean computation; the hard evidence must include an independent missing, changed-data, grouped, weighted, range, or parameter constraint.');
  }
  if (renderConstraints.forbidMediumMultiPropositionSolid === true || renderConstraints.forbidHardConceptOnlyPositionStatement === true || renderConstraints.forbidHardDirectCoordinateOnly === true) {
    renderGuidance.push('Do not use spatial-geometry shortcut shells: no four-proposition solid scan for medium, no generic line-plane concept statement for hard, and no direct symmetry-coordinate request as a hard item.');
  }
  if (renderConstraints.requireHardSpatialSecondRelation === true) {
    renderGuidance.push('For hard spatial-geometry plans, require a second visible line/plane/vector/angle/distance/volume/parameter relation before option judgement; a generic position-relation concept statement or one direct coordinate substitution is not hard.');
  }
  if (renderConstraints.forbidElementaryFunctionExternalContextWrapper === true) {
    renderGuidance.push('For elementary-function plans, do not wrap exponential, logarithmic, or power-function tasks in experiments, sensors, finance, population, biology, or other non-math contexts.');
  }
  if (renderConstraints.requireMediumElementaryConcreteExpressionRelation === true) {
    renderGuidance.push('For medium elementary-function plans, require concrete exponential, logarithmic, or power expressions plus a visible domain, monotonicity, inequality, bound, inverse, graph-intersection, or interval relation; do not use bare "which of the following functions" classification lists.');
  }
  if (renderConstraints.requireBasicElementarySingleObjectSingleTarget === true || renderConstraints.forbidBasicElementaryTargetProfileInflation === true) {
    const requiredFunctionClass = cleanText(renderConstraints.requiredElementaryFunctionClass);
    const requiredPropertyTarget = cleanText(renderConstraints.requiredSinglePropertyTarget);
    const targetOptionShape = requiredPropertyTarget === 'domain'
      ? 'Every option must be a candidate domain set for x; no option may state a range, monotonicity claim, or function value.'
      : requiredPropertyTarget === 'range'
        ? 'Every option must be a candidate range set for y or f(x); no option may state a domain, monotonicity claim, or point value.'
        : requiredPropertyTarget === 'monotonicity'
          ? 'Every option must be a monotonicity claim on an interval; no option may state a domain, range, or point value.'
          : requiredPropertyTarget === 'function_value'
            ? 'Every option must be a candidate value of the same function at the same input; no option may state a domain, range, or monotonicity claim.'
            : '';
    renderGuidance.push(requiredFunctionClass && requiredPropertyTarget
      ? `Mandatory slot: functionClass=${requiredFunctionClass}, propertyTarget=${requiredPropertyTarget}. One function, one target, same-shape A-D, exactly one true; no other property/function/equation/parameter/story. ${targetOptionShape}`
      : 'For basic elementary-function plans, use exactly one explicit exponential/log/power/root function; test one target: value, domain, range, or monotonicity. A-D use the same form and exactly one is true. No second property/function, equation, parameter, comparison chain, or story. Do not inflate targetProfile reading/calculation/multi-step fields.');
  }
  if (renderConstraints.requireExpLogOrderingArchetypeRotation === true) {
    const archetypes = Array.isArray(renderConstraints.expLogOrderingArchetypes)
      ? renderConstraints.expLogOrderingArchetypes.map((item) => cleanText(item)).filter(Boolean).slice(0, 4)
      : [];
    renderGuidance.push([
      'Select exactly one exp/log ordering archetype for this candidate and rotate away from the structure used by recent candidates or retries.',
      archetypes.length ? `Allowed archetypes: ${archetypes.join(' | ')}.` : '',
      `Change at least ${Math.max(2, Number(renderConstraints.minimumStructuralAxesChanged) || 0)} structural axes among expression composition, comparison anchor, transformation method, and distractor misconception; changing only constants, labels, or option order does not count.`,
      renderConstraints.forbidRepeatedMixedLogRootPowerTriple === true
        ? 'Do not default again to the repeated shell a=log base 2 of an integer, b=a fractional power, c=a cube root with three interval estimates; use that composition only when it is demonstrably absent from the recent-candidate context.'
        : ''
    ].filter(Boolean).join(' '));
  }
  if (renderConstraints.requirePhysicsSituation === true || renderConstraints.requireUnitOrGraphEvidence === true) {
    renderGuidance.push('For basic kinematics plans, state one self-contained motion situation and exactly one direct displacement/time/velocity/acceleration relation, with units or a complete textual s-t/v-t graph description. Ask for one value, direction, slope, or motion fact; do not add a second model or multi-stage calculation chain.');
  }
  if (renderConstraints.requirePhMeasurementOrPreparationOperation === true || renderConstraints.requireOperationToConcentrationToPhCausalChain === true) {
    renderGuidance.push('For basic pH measurement/preparation error plans, state exactly one visible pH-paper or volumetric-preparation operation deviation. The solution must trace operation -> solution volume/concentration or H+/OH- direction -> pH higher/lower/unchanged. Ask for one qualitative bias judgement; do not turn it into direct pH arithmetic, acid-base mixing, or neutralization.');
  }
  if (typeof renderConstraints.finalAnswerShape === 'string' && renderConstraints.finalAnswerShape.trim()) {
    renderGuidance.push(`Final answer shape: ${renderConstraints.finalAnswerShape.trim()}.`);
  }
  if (Array.isArray(renderConstraints.preferredPromptSkeletons) && renderConstraints.preferredPromptSkeletons.length > 0) {
    const skeletons = renderConstraints.preferredPromptSkeletons
      .map((item) => cleanText(item))
      .filter(Boolean)
      .slice(0, 3)
      .join(' | ');
    if (skeletons) renderGuidance.push(`Preferred low-waste prompt skeletons: ${skeletons}`);
  }
  return [
    'A validated subject-practice QuestionPlan is provided for this production job. Treat it as a hard structural contract for the problem skeleton.',
    'The finished item must visibly satisfy questionPlan.taskFamily, questionPlan.planTemplate, questionPlan.representationType, questionPlan.evidenceSlots, questionPlan.reasoningSteps, questionPlan.quantitativeRelations, questionPlan.answerDerivation, questionPlan.uniquenessConditions, and questionPlan.renderConstraints when present.',
    ...renderGuidance,
    scaffoldGuidance,
    failureAvoidanceGuidance,
    'Do not simplify the item into a direct recall, one-step calculation, or generic concept judgement if the QuestionPlan requires multiple independent evidence slots, competing hypotheses, causal propagation, or quantitative relations.',
    'If an idea cannot satisfy the QuestionPlan, discard the idea and generate a different candidate that does.'
  ].filter(Boolean).join(' ');
}

function questionPlanPromptPayload(questionPlan: Record<string, unknown>) {
  if (!Object.keys(questionPlan).length) return null;
  const scenario = constraintsRecord(questionPlan.scenarioContract);
  const scenarioSurface = constraintsRecord(scenario.surface);
  return {
    schemaVersion: questionPlan.schemaVersion ?? null,
    policyVersion: questionPlan.policyVersion ?? null,
    subject: questionPlan.subject ?? null,
    productionCellId: questionPlan.productionCellId ?? null,
    targetDifficulty: questionPlan.targetDifficulty ?? null,
    taskFamily: questionPlan.taskFamily ?? null,
    planTemplate: questionPlan.planTemplate ?? null,
    representationType: questionPlan.representationType ?? null,
    reasoningSteps: Array.isArray(questionPlan.reasoningSteps) ? questionPlan.reasoningSteps : [],
    evidenceSlots: Array.isArray(questionPlan.evidenceSlots) ? questionPlan.evidenceSlots : [],
    quantitativeRelations: Array.isArray(questionPlan.quantitativeRelations) ? questionPlan.quantitativeRelations : [],
    hypotheses: Array.isArray(questionPlan.hypotheses) ? questionPlan.hypotheses : [],
    misconceptionTargets: Array.isArray(questionPlan.misconceptionTargets) ? questionPlan.misconceptionTargets : [],
    answerDerivation: Array.isArray(questionPlan.answerDerivation) ? questionPlan.answerDerivation : [],
    uniquenessConditions: Array.isArray(questionPlan.uniquenessConditions) ? questionPlan.uniquenessConditions : [],
    renderConstraints: constraintsRecord(questionPlan.renderConstraints),
    scenarioContract: Object.keys(scenario).length ? {
      schemaVersion: safeStructuralToken(scenario.schemaVersion),
      policyVersion: safeStructuralToken(scenario.policyVersion),
      stage: safeStructuralToken(scenario.stage),
      scenarioMode: safeStructuralToken(scenario.scenarioMode),
      scenarioFamilyId: safeStructuralToken(scenario.scenarioFamilyId),
      scenarioDomain: safeStructuralToken(scenario.scenarioDomain),
      scenarioEntity: safeStructuralToken(scenario.scenarioEntity),
      scenarioAction: safeStructuralToken(scenario.scenarioAction),
      informationForm: safeStructuralToken(scenario.informationForm),
      scenarioFingerprint: safeStructuralToken(scenario.scenarioFingerprint),
      contextNecessity: safeStructuralToken(scenario.contextNecessity),
      requiredInformationFields: safeStructuralTokenArray(scenario.requiredInformationFields),
      solverRelevantFields: safeStructuralTokenArray(scenario.solverRelevantFields),
      surface: structuralRecord(scenarioSurface),
      plausibility: structuralRecord(scenario.plausibility),
      sourceIsolation: structuralRecord(scenario.sourceIsolation)
    } : null
  };
}

function subjectPracticeTargetProfileSummary(blueprint: QuestionGenerationBlueprint, targetProfile: Record<string, unknown>) {
  if (!Object.keys(targetProfile).length) return '';
  if (blueprint.subject === 'chemistry') {
    return 'For chemistry subject-practice candidates, syllabus topic and examScope are the hard contract. TargetProfile is topic-aware style guidance, but targetProfile.difficultyBand is a hard production target and must match the actual student-facing complexity.';
  }
  if (blueprint.subject === 'physics') {
    return 'For physics subject-practice candidates, physical model, situation, variables, unit/dimension consistency, formula applicability, syllabus topic, and examScope are the hard contract; targetProfile is a topic-aware style hint. However targetProfile.difficultyBand is a hard production target and must match the actual student-facing complexity.';
  }
  return 'Match targetProfile when provided, especially questionForm, cognitiveSkill, difficultyBand, readingLoad, and calculationLoad.';
}

function questionPlanSuppressesMathHighReadingLoad(questionPlan: Record<string, unknown>) {
  const renderConstraints = constraintsRecord(questionPlan.renderConstraints);
  const planTemplate = cleanText(questionPlan.planTemplate);
  return renderConstraints.pureMathStemOnly === true
    || (renderConstraints.externalContextAllowed === false && (planTemplate.startsWith('math_') || (
      Number(renderConstraints.maxVectorOrComplexObjects) > 0
      || Number(renderConstraints.maxFunctionObjects) > 0
      || Number(renderConstraints.maxIndependentRelations) > 0
    )));
}

function questionPlanKeepsMathBasicSingleTarget(questionPlan: Record<string, unknown>) {
  const renderConstraints = constraintsRecord(questionPlan.renderConstraints);
  return cleanText(questionPlan.subject).toLowerCase() === 'math'
    && cleanText(questionPlan.targetDifficulty).toLowerCase() === 'basic'
    && Number(renderConstraints.maxFunctionPropertyStack) === 1
    && cleanText(renderConstraints.finalAnswerShape) === 'one_direct_function_property_or_value';
}

function subjectPracticeQuestionPlanScaffoldGuidance(questionPlan: Record<string, unknown>) {
  const subject = cleanText(questionPlan.subject).toLowerCase();
  const planTemplate = cleanText(questionPlan.planTemplate);
  const targetDifficulty = cleanText(questionPlan.targetDifficulty).toLowerCase();
  const taskFamily = cleanText(questionPlan.taskFamily);
  if (subject === 'chemistry' && planTemplate === 'basic_ph_measurement_preparation_error_v1') {
    return 'For basic_ph_measurement_preparation_error_v1 basic, use one concrete operation such as wetting pH paper, changing sampling, reading the meniscus, over/under-filling a volumetric flask, incomplete transfer, or omitted washing. Ask only whether measured pH or prepared concentration/pH is higher, lower, or unchanged. The explanation must explicitly connect the operation to dilution/volume/solute loss, then to H+/OH- or concentration direction, then to pH direction. Do not ask for a numeric pH, mix acid and base, add a titration chain, or combine multiple independent operation errors.';
  }
  if (subject === 'chemistry' && planTemplate === 'chemistry_medium_classification_evidence_v1') {
    return 'For chemistry_medium_classification_evidence_v1 medium, name a concrete material, mixture, or two-step process and expose at least two useful facts: composition before/after, an observable change, or evidence that a new substance did or did not form. Apply one explicit classification rule (pure substance/mixture, element/compound, oxide/acid/base/salt, or physical/chemical change) and use the second fact to eliminate a tempting option. Do not ask a definition-only "which substance belongs to" item or merely count how many listed changes are physical or chemical.';
  }
  if (subject === 'physics' && planTemplate === 'physics_kinematics_basic_relation_v1') {
    return 'For physics_kinematics_basic_relation_v1 basic, use one object or one motion segment and one direct kinematics relation. Either provide two quantities with units and ask for the third, or fully describe one straight s-t/v-t segment in text and ask for its slope, direction, or speed meaning. Keep it to one relation and one answer target; do not depend on an unseen figure, omit units, mix distance with displacement, or add a second-stage force/energy model.';
  }
  if (subject === 'physics' && planTemplate === 'physics_medium_optics_two_relation_v1') {
    return 'For physics_medium_optics_two_relation_v1 medium, make the optical setup complete in text and combine exactly two linked relations. Prefer either (a) focal length + object-distance region + object movement, then infer image type and image-distance/size change, or (b) incident/refracting media + angle or refractive-index relation, then infer bending direction and one angle/wavelength change. Include a lens or Snell-law round-trip check in the explanation. Do not depend on an unseen figure, stop at one memorized optics rule, or mix unrelated interference and lens models.';
  }
  if (subject !== 'math') return '';
  if (planTemplate === 'math_vector_complex_relation_v1') {
    if (targetDifficulty === 'medium') {
      return 'For math_vector_complex_relation_v1 medium, use one compact concept-judgement scaffold: define one complex number z=a+bi and its vector form (a,b), or define exactly two 2D vectors a,b; state one visible relation such as perpendicular/parallel, |z|, conjugate, real part, argument, or dot product; then ask which option statement about the relation/property is correct. The stem must visibly include two vector/complex facts, one relation check, and explicit option-judgement wording such as which statement is correct. The answer options should be short claims, not raw coordinate-only or naked numeric results. Do not use 求/计算/find wording, point-to-plane distance, 2D point-to-line distance, projection point Q, generic spatial line-plane concept-only wording, or coordinate-geometry distance as the main task.';
    }
    if (targetDifficulty === 'hard') {
      return 'For math_vector_complex_relation_v1 hard, combine at least two visible vector/complex constraints before option elimination: modulus plus conjugate plus an argument/real-imaginary restriction, parameter plus perpendicular/parallel, locus plus metric, or argument plus real/imaginary constraint. A direct numeric result from only norm/modulus/dot-product equations is medium, not hard.';
    }
    return 'For math_vector_complex_relation_v1 basic, use exactly one direct vector or complex operation with numeric coordinates or complex expressions visible in the stem. Do not ask definition-only items about vector or complex-number concepts, such as complex equality definitions without numbers.';
  }
  if (planTemplate === 'math_probability_counting_relation_v1') {
    const probabilityTopicText = [cleanText(questionPlan.topicTitle), taskFamily].join(' ').toLowerCase();
    const normalDistributionPlan = /normal|正态|z[-_ ]?score|standard/i.test(probabilityTopicText);
    if (normalDistributionPlan) {
      if (targetDifficulty === 'basic') {
        return 'For normal-distribution basic probability plans, state N(mu,sigma^2) or a standard normal value plus one threshold/interval event, then ask which short probability, z-score, symmetry, or area claim is correct. Keep the calculation light and visible. Do not ask a generic concept-only "which statement is correct" item without numbers, distribution notation, or an event, and do not ask for an unframed raw value only.';
      }
      if (targetDifficulty === 'medium') {
        return 'For normal-distribution medium probability plans, include mu, sigma, one visible standardization step such as z=(x-mu)/sigma, and one table/symmetry value or interval relation before option judgement. Do not only list Phi values and ask which statement is correct without a probability event, interval, threshold, or z-score target. Avoid generic graph-description items and avoid hard two-tail inverse-parameter solving.';
      }
      return 'For normal-distribution hard probability plans, combine two visible probability constraints, tail/symmetry relations, or inverse standardization before solving for a threshold, mean, or standard deviation; include the round-trip probability check in the explanation.';
    }
    if (targetDifficulty === 'hard') return 'For math_probability_counting_relation_v1 hard, require three visible layers before the final probability: define the sample space or distribution, split cases or use complement/conditional reasoning, and check an interacting restriction such as without-replacement order, at-least/at-most, independence/dependence, or a parameter. Do not merely list events A/B/C/D and ask which probability relation is correct unless the explanation computes a case split, conditional, complement, or restriction relation.';
    if (targetDifficulty === 'medium') return 'For math_probability_counting_relation_v1 medium, include exactly two connected counting/event facts such as A and B, A∩B, complement, conditional probability, independence check, or two cases before selecting the relation or value. The stem or explanation must visibly show both the total/sample frame and the second relation; use finite objects such as balls/cards/dice with counts. Do not ask a single-event or same-color favorable-count probability only.';
    return 'For math_probability_counting_relation_v1 basic, state a finite sample space with explicit counts and one event condition with visible numbers, then ask which short probability/counting claim is correct. Use a concrete skeleton such as "袋中有 m 个红球和 n 个白球，随机取 1 个，判断关于取到红球概率的说法哪项正确"; do not generate generic concept-only statements, applicability judgements, definition checks without an event and count, or unframed raw-value-only prompts.';
  }
  if (planTemplate === 'math_derivative_condition_chain_v1') {
    if (targetDifficulty === 'basic') return 'For math_derivative_condition_chain_v1 basic, ask exactly one direct derivative value, tangent slope, or one-interval monotonic sign judgement with a visible polynomial or similarly direct function, for example "已知 f(x)=...，求 f\'(a)" or "判断 f(x) 在一个给定区间的单调性". Do not use piecewise definitions, parameters, continuity/left-right derivative checks, undefined-domain traps such as 1/(x-a) at x=a, quotient/product/chain-rule functions, logarithmic, trigonometric, square-root, second-derivative, or hidden second-condition shells.';
    if (targetDifficulty === 'medium') return 'For math_derivative_condition_chain_v1 medium, require two visible derivative-linked moves: differentiate or read f\'(x), then use one tangent point/slope, monotonic interval, extremum, or sign condition before option elimination. Prefer "已知 f(x)=...，先由 f\'(x) 判断区间/极值，再判断选项" or "切线斜率条件 + 区间单调性" skeletons. Do not ask only for f\'(a), a raw slope, a one-step substitution, or definition-only statements about differentiability/geometric meaning.';
    return 'For math_derivative_condition_chain_v1 hard, require at least three visible derivative-linked moves, such as derivative sign chart plus interval conclusion plus parameter/extremum/tangent constraint. A single derivative, single tangent slope, direct coefficient solving from point/slope conditions, or direct monotonicity statement is not hard.';
  }
  if (planTemplate === 'math_analytic_geometry_relation_v1') {
    if (targetDifficulty === 'basic') return 'For math_analytic_geometry_relation_v1 basic, ask one direct slope, distance, midpoint, intercept, chord, or point-substitution calculation with all equations visible. Do not require completing the square from a general circle equation to find the center or radius.';
    return 'For math_analytic_geometry_relation_v1 medium/hard, combine an equation object with a position/metric relation such as tangent, chord, intersection, symmetry, parameter, or line-circle distance before selecting the answer; no unseen diagram dependency. Do not ask definition-only conic classification items such as which equation represents an ellipse with focus on an axis. For hard conic items, add a parameter/range/tangent/chord/area/locus constraint beyond a shared-focus or eccentricity relation.';
  }
  if (planTemplate === 'math_function_property_by_difficulty_v1' || planTemplate === 'math_medium_function_two_move_reasoning_v1') {
    if (targetDifficulty === 'basic') return 'For function-property basic plans, use one explicit function and one direct domain, range, value, monotonicity, parity, vertex, or interval property. Keep it as a one-property or one-value judgement. If using point-on-graph membership, put exactly one candidate coordinate in each answer option and do not introduce two named points, a parameter point P(a,b), or a solve-for-parameter step in the stem. The student-facing stem must state the mathematical givens and question only; do not teach the solving procedure with phrases such as "first check", "then calculate", or "按上述方法". Do not combine radical and reciprocal-denominator domain constraints, stacked properties, parameters, piecewise cases, or multi-step traps in one basic item.';
    if (targetDifficulty === 'medium') {
      return 'For math_medium_function_two_move_reasoning_v1 medium, use one explicit non-piecewise function and exactly two visible moves in the stem: first a domain/range/monotonicity/parity/vertex/intersection property, then one short interval, value, discriminant, or counterexample check. Keep the calculation evidence visible with 4-5 formula/operator symbols or two connected algebraic steps; use a pure math "已知函数 f(x)=... 在区间 I 上..." skeleton. Do not ask only f(a), do not infer a parameter, do not use real-world wrappers such as profit, cost, sales, population, water-level, temperature, sensor, experiment, biology, or finance scenarios, avoid absolute-value piecewise expansion or multiple point-value lists, and do not combine four or more property categories such as parity, monotonicity, range, boundedness, and point values in one item.';
    }
    return 'For function-property hard plans, combine one visible concrete function object with a nontrivial interval, parameter, discriminant, inverse, or counterexample chain; the hard evidence must be visible in the stem rather than hidden only in the explanation. Do not ask a generic function-property proposition such as "which statement about function properties is correct" without a concrete function, interval, or parameter constraint.';
  }
  if (planTemplate === 'math_elementary_function_relation_v1' || planTemplate === 'math_medium_exp_log_ordering_chain_v1') {
    if (planTemplate === 'math_medium_exp_log_ordering_chain_v1') {
      return 'For math_medium_exp_log_ordering_chain_v1 medium, compare three visible exponential/logarithmic/power/root expressions using separated interval bounds or monotonic transformations, then ask for one strict order or one correct comparison statement. Include the bounding evidence in the stem or explanation with at least one inequality chain. Rotate among reference-interval anchors, common-base/common-exponent transforms, inverse exp-log bridges, and exact pairwise identities plus an independent bound; do not merely rename a repeated log2 + fractional-power + cube-root shell. Do not turn the task into a logarithmic equation, decimal-only approximation, real-world context, or parameter problem.';
    }
    if (targetDifficulty === 'basic') {
      return 'For math_elementary_function_relation_v1 basic, state exactly one concrete function such as f(x)=2^x, f(x)=log_2 x, f(x)=x^3, or f(x)=sqrt(x-2), then ask exactly one direct value, domain, range, or monotonicity target. The selected target must be the only function-property category named anywhere in the prompt, options, explanation, and localization: do not volunteer a domain when asking monotonicity, and do not say that range/monotonicity is not being asked. Use one rule application plus one short verification in the explanation. Do not compare values, solve an equation, infer a parameter, list several candidate functions, combine properties, or add external context. Emit the final JSON immediately and keep each localization explanation to at most two short sentences.';
    }
    return 'For elementary-function relation plans, keep the item pure math: compare exponential/logarithmic/power expressions with visible bounds, domains, inverse relations, graph intersections, or inequalities. For medium plans, use a concrete given expression, interval, bound, or comparison relation; do not ask only which option function is odd/even/increasing/decreasing without a visible expression or relation in the stem, and do not use bare "which of the following functions" classification lists. Do not wrap the task in experiments, sensors, finance, or other non-math contexts.';
  }
  if (planTemplate === 'math_medium_function_parameter_constraint_v1') {
    return 'For math_medium_function_parameter_constraint_v1 medium, state one parameter condition and one visible function-property constraint such as vertex, discriminant, domain, monotonic interval, or intersection count, then require option elimination or substitution back to a unique parameter statement. The stem must expose the property evidence, not merely ask to solve for a; avoid multiple unrelated parameters, piecewise definitions, or hard universal-proof wording.';
  }
  if (planTemplate === 'math_sequence_condition_relation_v1') {
    if (targetDifficulty === 'basic') return 'For sequence basic plans, give an explicit arithmetic/geometric formula or adjacent-term relation and ask one term, common difference/ratio, or short sum. Prefer "已知等差/等比数列的首项和公差/公比，求 a_n 或 S_n" skeletons. Do not ask a generic classification item such as "which sequence is arithmetic/geometric" or "which general term formula represents an arithmetic/geometric sequence".';
    return 'For sequence medium/hard plans, require two linked sequence facts such as term plus sum, recurrence plus substitution, missing parameter plus target value, index symmetry, or formula choice; prefer "由 a_m 与 S_n 先求参数，再判断 a_k 或 S_k" or "递推关系 + 初值 + 指定项/和" skeletons; avoid direct a1/d/q substitution as the whole task.';
  }
  if (planTemplate === 'math_statistics_relation_v1') {
    if (targetDifficulty === 'basic') {
      return 'For statistics basic plans, give a short data set, frequency table, or one summary statistic relation with visible numbers, then ask exactly one mean, median, mode, range, variance, standard deviation, or missing value. Do not ask a generic definition-only statistics concept item, and do not compare two classes/groups across both mean and variance in one basic item.';
    }
    if (targetDifficulty === 'medium') {
      return 'For statistics medium plans, include one visible data/statistic object plus one second relation such as a changed sample, missing value, grouped/weighted mean, frequency adjustment, two-statistic comparison, or combined group. Avoid pure variance linear-transform templates like y=ax+b as the whole task; if a transform appears, add a changed sample or comparison condition before option judgement.';
    }
    return 'For statistics hard plans, combine at least two statistic conditions or one statistic plus a missing/group-change/weighted-table constraint before elimination. A direct two-group combined-variance calculation, direct variance formula, direct linear transform of variance, or one-step mean total subtraction is not hard unless another independent missing/changed-data/range condition is visible.';
  }
  if (planTemplate === 'math_spatial_geometry_relation_v1') {
    if (targetDifficulty === 'basic') return 'For spatial-geometry basic plans, use self-contained coordinates or one simple line/plane/solid relation and ask one direct metric or judgement.';
    return 'For spatial-geometry medium/hard plans, state a self-contained configuration with points, lines, planes, vectors, projections, angles, or perpendicular/parallel relations, then combine at least two visible relations before selecting the answer. Prefer "平面方程/法向量 + 直线方向向量 + 距离或夹角条件" or "空间向量坐标 + 垂直/平行 + 角度/体积/距离" skeletons. For medium items, do not use a multi-vertex solid with four proposition judgements unless the stem names the specific metric/vector/angle/volume target. For hard items, do not stop at generic line-plane position statements, direct coordinate/symmetry-point requests, or point-symmetry judgements without a metric/vector/angle/volume constraint.';
  }
  return taskFamily ? `For this math QuestionPlan, make the stem visibly instantiate taskFamily=${taskFamily} instead of a generic textbook question.` : '';
}

function subjectPracticeQuestionPlanFailureAvoidanceGuidance(questionPlan: Record<string, unknown>) {
  const subject = cleanText(questionPlan.subject).toLowerCase();
  const planTemplate = cleanText(questionPlan.planTemplate);
  if (subject === 'chemistry' && planTemplate === 'basic_ph_measurement_preparation_error_v1') return 'Keep the chemistry causal direction visible and internally consistent: operation error -> concentration or H+/OH- change -> pH bias. Distractors should reverse one link or incorrectly claim no effect, without creating another valid answer.';
  if (subject === 'physics') return 'Make the physical model, variable meanings, applicable relation, and units visible; the explanation must check the chosen value or graph interpretation against the same relation.';
  if (subject !== 'math') return '';
  return 'These math scaffolds are designed to prevent the current high-frequency gates profile_difficulty_evidence_mismatch, style_alignment_low, and profile_alignment_warning: make the evidence visible in the stem, keep the topic pure, and ensure the explanation explicitly uses every visible relation before the answer.';
}

function targetProfileOperationalGuidance(subject: string, targetProfile: Record<string, unknown>, questionPlan: Record<string, unknown> = {}) {
  if (!Object.keys(targetProfile).length) return '';
  const difficultyBand = cleanText(targetProfile.difficultyBand).toLowerCase();
  if (subject === 'chemistry') {
    const guidance = [
      'For chemistry subject-practice candidates, automatic profile alignment is a guardrail, but the chemistry syllabus topic and examScope stay primary.',
      'Do not force calculationLoad or questionForm if that would move the item outside the topic or turn a qualitative chemistry topic into repeated arithmetic.',
      'Use targetProfile as topic-aware guidance for length and reasoning density; resolve conflicts in favor of chemically meaningful content, while still satisfying targetProfile.difficultyBand.'
    ];
    if (difficultyBand === 'hard') {
      guidance.push('For targetProfile.difficultyBand=hard, the item must contain real hard evidence: at least two linked chemistry reasoning moves, a competing-hypothesis elimination path, a multi-observation experiment inference, a non-direct equilibrium/acid-base setup, or a reaction/conversion evidence chain. A long stem, many listed steps, direct classification, or one-step dilution/neutralization is not enough.');
    } else if (difficultyBand === 'medium') {
      guidance.push('For targetProfile.difficultyBand=medium, use a moderate two-move task or one meaningful chemistry inference; avoid both direct recall and hard-style evidence chains.');
    } else if (difficultyBand === 'basic') {
      guidance.push('For targetProfile.difficultyBand=basic, use one clear concept or one short calculation, and avoid multi-observation inference chains.');
    }
    return guidance.join(' ');
  }
  if (subject === 'physics') {
    return [
      'For physics subject-practice candidates, automatic profile alignment is a guardrail, but the physical model, situation, variables, units, formula applicability, syllabus topic, and examScope stay primary.',
      'targetProfile.difficultyBand is not soft: basic must remain a low-complexity physics task, medium must show moderate reasoning or calculation, and hard must require a visibly nontrivial model/relation path.',
      'Do not force questionForm, readingLoad, or calculationLoad if that would remove the needed physical context, diagram or graph interpretation, experiment logic, or formula-applicability condition.',
      'Use targetProfile as a topic-aware style hint for length, difficulty, and reasoning density; quantitative mechanics, electricity, and thermal topics may need visible calculation, while concept, graph, phenomenon, and experiment topics may use calculation only as supporting evidence.'
    ].join(' ');
  }
  const readingLoad = cleanText(targetProfile.readingLoad).toLowerCase();
  const calculationLoad = cleanText(targetProfile.calculationLoad).toLowerCase();
  const suppressHighReadingLoad = subject === 'math'
    && readingLoad === 'high'
    && questionPlanSuppressesMathHighReadingLoad(questionPlan);
  const guidance = [
    'Automatic profile alignment uses deterministic surface checks, so satisfy these operational targets rather than only the semantic intent.'
  ];
  if (readingLoad === 'low') {
    guidance.push('readingLoad=low: keep the main Chinese prompt within 120 characters, use at most two condition separators, and avoid story, scenario, table, or multi-clause context wording.');
  } else if (readingLoad === 'medium') {
    guidance.push('readingLoad=medium: use a compact 121-260 character prompt or three to four short conditions; avoid tables or five-plus condition chains.');
  } else if (readingLoad === 'high' && !suppressHighReadingLoad) {
    guidance.push('readingLoad=high: include a real context, table-style data, or at least five linked conditions, while staying concise and answerable.');
  } else if (readingLoad === 'high') {
    guidance.push('readingLoad=high is subordinate to the validated math QuestionPlan renderConstraints: keep the item pure, compact, and self-contained; do not add a story, table, external context, or five-plus condition chain.');
  }
  if (calculationLoad === 'none') {
    guidance.push('calculationLoad=none: use judgement, concept comparison, definition, or reasoning-claim selection; avoid solve/calculate/find/求/计算 wording and avoid numeric formula computation.');
  } else if (calculationLoad === 'light') {
    guidance.push('calculationLoad=light: include numbers and a calculation cue, but keep the main prompt to at most three visible formula/operator symbols; use one short substitution, comparison, or direct computation.');
  } else if (calculationLoad === 'medium') {
    const questionForm = cleanText(targetProfile.questionForm).toLowerCase();
    if (subject === 'math' && /concept/.test(questionForm)) {
      guidance.push('calculationLoad=medium with questionForm=concept_judgement: use visible algebraic or quantitative relation evidence inside short option statements, but phrase the stem as a correct-statement judgement; avoid direct 求/计算/find wording that makes deterministic profile alignment infer formula_calculation.');
    } else {
      guidance.push('calculationLoad=medium: include a calculation cue and four to five visible formula/operator symbols in the main prompt, or two connected algebraic/statistical/geometric steps; avoid a one-step substitution.');
    }
  } else if (calculationLoad === 'heavy') {
    guidance.push('calculationLoad=heavy: include more than five visible formula/operator symbols or several linked operations in the main prompt; make the path visibly nontrivial without adding irrelevant reading load.');
  }
  if (readingLoad === 'low' && ['medium', 'heavy'].includes(calculationLoad)) {
    guidance.push('When readingLoad is low but calculationLoad is medium/heavy, use a compact symbolic or numeric stem with visible operators in the stem; do not rely on a short natural-language "求方差/求距离" request whose computation is only visible in the explanation.');
  }
  return guidance.join(' ');
}

function targetProfileOperationalTargets(subject: string, targetProfile: Record<string, unknown>, questionPlan: Record<string, unknown> = {}) {
  if (!Object.keys(targetProfile).length) return null;
  const readingLoad = cleanText(targetProfile.readingLoad).toLowerCase();
  const calculationLoad = cleanText(targetProfile.calculationLoad).toLowerCase();
  const suppressHighReadingLoad = subject === 'math'
    && readingLoad === 'high'
    && questionPlanSuppressesMathHighReadingLoad(questionPlan);
  const keepsBasicSingleTarget = subject === 'math'
    && questionPlanKeepsMathBasicSingleTarget(questionPlan);
  if (subject === 'chemistry') {
    return {
      readingLoad,
      calculationLoad,
      targetProfileMode: 'soft_style_hint',
      hardContract: 'syllabus topic and examScope',
      taskFamilyPriority: 'chemically meaningful task form before targetProfile surface fields',
      calculationLoadInterpretation: 'use as reasoning-density guidance; do not force formula/operator counts outside quantitative topics',
      conflictResolution: 'topic and examScope override questionForm/calculationLoad when they conflict'
    };
  }
  if (subject === 'physics') {
    return {
      readingLoad,
      calculationLoad,
      targetProfileMode: 'physics_model_first',
      hardContract: 'physical model, situation, variables, unit/dimension consistency, formula applicability, syllabus topic and examScope',
      taskFamilyPriority: 'physically valid task form before targetProfile surface fields',
      calculationLoadInterpretation: 'topic-aware; quantitative topics may follow calculationLoad, but concept, graph, phenomenon, and experiment topics should not force formula/operator counts',
      conflictResolution: 'physics model and examScope override questionForm/readingLoad/calculationLoad surface fields when they conflict'
    };
  }
  return {
    readingLoad,
    calculationLoad,
    promptLength:
      readingLoad === 'low' ? 'main Chinese prompt <=120 characters'
      : readingLoad === 'medium' ? 'main Chinese prompt 121-260 characters or 3-4 compact conditions'
      : readingLoad === 'high' && suppressHighReadingLoad ? 'pure compact self-contained math stem; do not add real context/table/five-plus conditions just for readingLoad'
      : readingLoad === 'high' ? 'real context/table-style data or at least 5 linked conditions'
      : 'match targetProfile.readingLoad',
    conditionSeparators:
      readingLoad === 'low' ? 'at most 2'
      : readingLoad === 'medium' ? '3-4 preferred; avoid 5+'
      : readingLoad === 'high' && suppressHighReadingLoad ? 'bounded by questionPlan.renderConstraints; avoid five-plus condition chains'
      : readingLoad === 'high' ? '5+ allowed when needed'
      : 'match targetProfile.readingLoad',
    formulaOperatorSymbols:
      calculationLoad === 'none' ? 'avoid calculation cues and numeric formula computation'
      : calculationLoad === 'light' ? 'calculation cue with <=3 visible formula/operator symbols'
      : calculationLoad === 'medium' && subject === 'math' && /concept/.test(cleanText(targetProfile.questionForm).toLowerCase()) ? 'concept-judgement phrasing with visible algebraic relation evidence in the stem/options; avoid direct solve/calculate/find wording'
      : calculationLoad === 'medium' ? 'calculation cue with 4-5 visible formula/operator symbols, or two connected operations'
      : calculationLoad === 'heavy' ? '>5 visible formula/operator symbols or several linked operations'
      : 'match targetProfile.calculationLoad',
    conflictResolution: suppressHighReadingLoad && keepsBasicSingleTarget
      ? 'validated QuestionPlan renderConstraints override targetProfile.readingLoad and multi_step_reasoning complexity when they conflict'
      : suppressHighReadingLoad
      ? 'validated QuestionPlan renderConstraints override targetProfile.readingLoad when they conflict'
      : keepsBasicSingleTarget
      ? 'validated basic QuestionPlan single-target renderConstraints override targetProfile multi_step_reasoning complexity when they conflict'
      : readingLoad === 'low' && ['medium', 'heavy'].includes(calculationLoad)
      ? 'compact symbolic/numeric stem with visible operators; avoid explanation-only computation'
      : 'satisfy readingLoad and calculationLoad together'
  };
}

function chemistryTopicProfileGuidance(blueprint: QuestionGenerationBlueprint, targetProfile: Record<string, unknown>) {
  if (!Object.keys(targetProfile).length) return '';
  const difficultyBand = cleanText(targetProfile.difficultyBand ?? blueprint.difficulty).toLowerCase();
  const topicText = [
    blueprint.topicTitle,
    blueprint.topicCode,
    blueprint.topicModule,
    blueprint.examScope,
    stringArray(blueprint.excludedScope).join(' '),
    stringArray(blueprint.allowedQuestionTypes).join(' ')
  ].map((item) => cleanText(item).toLowerCase()).filter(Boolean).join(' ');
  const topicTitleText = [blueprint.topicTitle, blueprint.topicCode]
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean)
    .join(' ');
  const excludedText = stringArray(blueprint.excludedScope).join(' ').toLowerCase();
  const electrolyteScopeExcludesComplexEquilibrium = /(复杂酸碱平衡|缓冲溶液|溶度积|电化学电极反应|complex acid.?base equilibrium|buffer|ksp|electrochemical electrode)/i.test(excludedText);
  const guidance: string[] = [
    'For chemistry subject-practice candidates, use topic-first generation: syllabus topic and examScope define the required knowledge, while targetProfile shapes style and target difficulty.',
    'Prioritize chemically meaningful task forms: property judgement, phenomenon prediction, substance or ion identification, reaction selection, conversion chain, experiment inference, impurity removal, and acid/base/salt reaction phenomena.',
    'Change the chemical task family, reaction system, and reasoning structure across retries; do not only swap numbers, substances, or option order.'
  ];
  const bannedPatterns: string[] = [];
  const requiredPatterns: string[] = [];
  if (difficultyBand === 'hard') {
    guidance.push('Hard chemistry cells must be generated from a hard-evidence template that the automatic reviewer can recognize; do not rely on reading length, condition count, or option wording to create difficulty.');
    guidance.push('For hard experimental chemistry, the correct answer must require at least two non-obvious intermediate conclusions plus one interference, exception, impurity, or reagent-order control; a direct operation order, direct ion list, or single property lookup is only medium/basic.');
    bannedPatterns.push(
      'direct physical/chemical change classification or counting as the whole task',
      'direct pH dilution, direct strong acid/base neutralization, or one-step concentration substitution as the whole task',
      'generic stems such as 下列说法正确的是 without an evidence chain or competing cases',
      'pure separation-operation ordering from listed properties without a competing-method rejection',
      'only changing numbers, substances, or option order after a hard-cell profile mismatch'
    );
    requiredPatterns.push(
      'multi-observation experiment inference',
      'unknown substance or ion identification with competing hypotheses',
      'reaction or conversion evidence chain',
      'equilibrium or acid-base setup that is not a direct substitution',
      'mixture, limiting, purity, or consecutive-reaction reasoning when the topic is quantitative'
    );
  }
  const gasPreparationOrTestTopic = /(气体|gas)/i.test(topicTitleText)
    && /(制备|检验|收集|干燥|除杂|preparation|test|collection|drying|impurity)/i.test(topicText);
  if (difficultyBand === 'hard' && gasPreparationOrTestTopic) {
    guidance.push('For hard gas-preparation/detection cells, use an impurity-removal plus competing-gas elimination chain: collection method, drying or absorption reagent purpose, at least two gas tests, and a conclusion that would be wrong if one reagent/order detail is ignored. Avoid direct volume/yield calculation as the whole task.');
    requiredPatterns.push('gas preparation hard skeleton: impurity removal + competing gas elimination + reagent/order purpose');
  }
  if (difficultyBand === 'hard' && /(分离|提纯|萃取|蒸馏|结晶|过滤|separation|purification|extraction|distillation|crystallization|filtration)/i.test(topicText)) {
    guidance.push('For hard separation/purification cells, combine at least three component constraints such as solubility temperature trend, boiling point, density/phase, sublimation, impurity reactivity, or product loss; the answer should select and justify a route while rejecting a tempting wrong route. A simple “filter then evaporate/crystallize/distil” order is not hard.');
    requiredPatterns.push('separation hard skeleton: three component constraints + route choice + tempting-route rejection');
  }
  if (difficultyBand === 'hard' && /(物质分类|状态变化|physical change|chemical change|classification|state change)/i.test(topicText)) {
    guidance.push('For hard material-classification/state-change cells, avoid asking only how many changes are physical/chemical or whether one step is physical/chemical. Use an unknown sample or transformation chain where observations must eliminate alternatives and classify the substances or changes.');
  }
  if (difficultyBand === 'hard' && /(离子反应|离子检验|离子鉴别|沉淀|ion identification|qualitative ion|precipitation test)/i.test(topicText)) {
    guidance.push('For hard ion-identification cells, reagent order is part of correctness: never introduce chloride-containing reagents such as HCl or BaCl2 before using AgNO3/AgCl evidence to infer original Cl-. If chloride is tested, test it before chloride reagents, or use HNO3 and Ba(NO3)2 for carbonate/sulfate steps.');
    guidance.push('For hard ion-identification cells, require a real interference-control step: competing ion hypotheses, reagent-order justification, excess/remainder effect, incompatible ion elimination, or a final conclusion that depends on combining at least two observations without reagent contamination.');
    guidance.push('For hard ion-identification cells, the correct option must integrate at least two original-ion conclusions and one uncertainty/insufficiency statement, or distinguish original ions from reagent-introduced ions. A standard acid/Ba2+/Ag+ three-step precipitate item with a direct ion list is only medium.');
    bannedPatterns.push(
      'using HCl or BaCl2 and then treating a later AgNO3 white precipitate as proof of original Cl-',
      'direct one-observation-to-one-ion listing without interference or reagent-order reasoning'
    );
    requiredPatterns.push(
      'non-contaminating reagent sequence such as HNO3/Ba(NO3)2 before AgNO3 when chloride is in play',
      'explicit interference-control or reagent-order reasoning'
    );
  }
  if (difficultyBand === 'hard' && /(ph|pH|酸|碱|中和|溶液浓度|acid|base|neutralization|solution concentration)/i.test(topicText)) {
    guidance.push('For hard pH/acid-base cells, avoid direct strong-acid/strong-base dilution or equal-volume neutralization. Use weak/strong acid comparison, staged dilution plus excess analysis, titration/indicator reasoning, buffer-like qualitative reasoning, or competing cases that require elimination.');
  }
  if (difficultyBand === 'hard' && /(电解质|电离|导电性|离子浓度|离子积|盐类水解|溶度积|electrolyte|ionization|conductivity|ionic product|hydrolysis|ksp)/i.test(topicText)) {
    if (electrolyteScopeExcludesComplexEquilibrium) {
      guidance.push('For this hard electrolyte-solution cell, excludedScope forbids complex acid-base equilibrium, buffers, Ksp/solubility-product, and electrochemical electrode reactions. Do not use Ka/Kb/Ksp data, buffer/common-ion HA/A-, weak-acid/weak-base salt hydrolysis constants, precipitation thresholds, or electrode reactions to create difficulty.');
      guidance.push('For this hard electrolyte-solution cell, stay inside the topic contract: strong/weak electrolyte classification, ionization equations, free-moving-ion particle counts, conductivity under controlled changes, molten vs aqueous state, and multi-case elimination about electrolyte/non-electrolyte behavior.');
      guidance.push('Hardness must come from at least two linked in-scope constraints, such as substance state plus ionization equation, concentration/volume particle-count comparison plus complete/partial ionization, or competing solution cases that require eliminating non-electrolytes and weak electrolytes. Do not make the answer a direct strong/weak label or a one-step conductivity comparison.');
      guidance.push('For this scope-limited hard electrolyte cell, choose one concrete hard skeleton: (1) three substances compared across aqueous, molten, and solid states; (2) three formula-unit cases requiring conversion to free-ion particle counts plus state eligibility; or (3) electrolyte/non-electrolyte elimination across molecular solutes, ionic solids, acids/bases, and molten/aqueous conditions. A pure aqueous "which has the most free-moving ions" item is not hard unless it also includes a state contrast and an ionization-equation elimination step.');
      guidance.push('For this scope-limited hard electrolyte cell, the correct option must integrate at least three cases or give a ranking/grouping; a single pairwise statement such as "case 2 is stronger than case 3" is only medium even if other cases appear in the stem.');
      requiredPatterns.push(
        'visible in-scope electrolyte evidence: state/ionization/free-moving-ion/conductivity case comparison',
        'a hidden intermediate before final conductivity, ion-count, electrolyte/non-electrolyte, or ionization-equation judgement',
        'at least three competing substances or cases with aqueous/molten/solid state evidence when targeting hard',
        'a correct option that ranks, groups, or jointly constrains at least three cases'
      );
      bannedPatterns.push(
        'Ka/Kb/Ksp, buffer/common-ion, weak-acid/weak-base salt hydrolysis constants, precipitation threshold, or electrode reaction as the difficulty source',
        'pure aqueous free-moving-ion count or conductivity ranking as the whole hard task',
        'simple weak-acid dilution trend as the whole task',
        'direct conductivity comparison as the whole task',
        'one-step strong/weak acid/base mixing or neutralization ion ranking'
      );
    } else {
      guidance.push('For hard electrolyte-solution cells, the prompt must visibly contain at least two hard evidence anchors allowed by examScope: Ka/Kb/Ksp data, buffer/common-ion HA/A- or NH4+/NH3 relation, charge/material balance, staged titration/mixing, precipitation-threshold reasoning, or competing ion-removal/coexistence cases.');
      guidance.push('For hard electrolyte-solution cells, do not generate simple CH3COOH/CH3COONa/HCl dilution, direct conductivity comparison, direct strong/weak electrolyte comparison, or one-step neutralization ion ranking; those are medium/basic even if the wording is long.');
      requiredPatterns.push(
        'visible Ka/Kb/Ksp or balance-equation evidence in the stem',
        'a hidden intermediate before final ion concentration, pH, conductivity, precipitation, or coexistence judgement'
      );
      bannedPatterns.push(
        'simple weak-acid dilution trend as the whole task',
        'direct conductivity comparison as the whole task',
        'one-step strong/weak acid/base mixing or neutralization ion ranking'
      );
    }
  }
  if (/(物质的量|化学计量|stoichiometry|amount of substance|mole|molar|gas volume|solution concentration)/i.test(topicText)) {
    guidance.push('For amount-of-substance or stoichiometry topics, calculation is allowed, but rotate skeletons instead of repeating the same reaction equation.');
    bannedPatterns.push(
      'repeating the same 2H2 + O2 -> 2H2O water-formation skeleton across retries',
      'only changing numbers in a mass-to-mole, mol-to-mass, or gas-volume substitution',
      'using one reaction family repeatedly after profile_alignment_warning failures'
    );
    requiredPatterns.push(
      'limiting reagent',
      'yield or purity',
      'mixture composition',
      'gas volume',
      'solution concentration',
      'consecutive reactions',
      'titration or neutralization relation',
      'reaction selection before calculation'
    );
    guidance.push('Every retry for a stoichiometry cell must switch both reaction system and question form, such as limiting reagent, yield, mixture composition, gas volume, solution concentration, consecutive reaction, titration/neutralization, or reaction selection before calculation.');
  }
  if (/(常见无机物性质|无机物性质|inorganic|酸|碱|盐|oxide|ion|离子|物质性质)/i.test(topicText)) {
    guidance.push('For common inorganic properties, the main task must be chemistry reasoning rather than mol/L, mass, volume, or yield calculation.');
    bannedPatterns.push(
      'main stem asks only for mol/L concentration, mass, volume, or yield',
      'stoichiometric arithmetic as the central task for common inorganic properties',
      'generic metal-acid or carbonate-acid calculation when the topic expects properties or phenomena'
    );
    requiredPatterns.push(
      'property judgement',
      'phenomenon prediction',
      'ion or substance identification',
      'impurity removal',
      'conversion-chain reasoning',
      'experiment inference',
      'acid/base/salt reaction phenomenon'
    );
    guidance.push('Use calculation only as auxiliary evidence for inorganic properties; the answer should depend on substance properties, reactions, observable phenomena, or experimental reasoning.');
  }
  if (bannedPatterns.length) guidance.push(`Chemistry hard banned patterns: ${bannedPatterns.join('; ')}.`);
  if (requiredPatterns.length) guidance.push(`Chemistry required acceptable patterns: ${requiredPatterns.join('; ')}.`);
  return guidance.join(' ');
}

function physicsTopicProfileGuidance(blueprint: QuestionGenerationBlueprint, targetProfile: Record<string, unknown>) {
  if (!Object.keys(targetProfile).length) return '';
  const difficultyBand = cleanText(targetProfile.difficultyBand ?? blueprint.difficulty).toLowerCase();
  const questionForm = cleanText(targetProfile.questionForm).toLowerCase();
  const cognitiveSkill = cleanText(targetProfile.cognitiveSkill).toLowerCase();
  const readingLoad = cleanText(targetProfile.readingLoad).toLowerCase();
  const calculationLoad = cleanText(targetProfile.calculationLoad).toLowerCase();
  const topicText = [
    blueprint.topicTitle,
    blueprint.topicCode,
    blueprint.topicModule,
    blueprint.examScope,
    stringArray(blueprint.allowedQuestionTypes).join(' ')
  ].map((item) => cleanText(item).toLowerCase()).filter(Boolean).join(' ');
  const guidance: string[] = [
    'For physics subject-practice candidates, use physics-model-first generation: examScope, physical situation, variables, units, and formula applicability define the required task; targetProfile shapes style and difficulty.',
    'Prioritize physically meaningful task forms: model selection, force/energy/momentum relation, circuit relation, graph interpretation, phenomenon prediction, experiment inference, unit/dimension reasoning, and proportional-relation judgement.',
    'Change the physical situation, variable relation, and reasoning structure across retries; do not only swap numbers, object names, or option order.'
  ];
  const bannedPatterns: string[] = [];
  const requiredPatterns: string[] = [];
  if (difficultyBand === 'medium') {
    guidance.push('For medium physics cells, aim for exactly two connected reasoning moves: one physical relation plus one condition, comparison, direction, phase, topology, or proportional-change judgement. Avoid both single-fact recall and hard-style multi-condition synthesis.');
    if (questionForm.includes('concept') || cognitiveSkill.includes('concept')) {
      guidance.push('For medium concept-judgement physics, do not ask a generic "which statement is correct" recall item. Anchor the judgement in a concrete state change, spatial relation, circuit topology, wave phase relation, field direction, or optical setup, but keep it to one main condition plus one inference.');
    }
    if (readingLoad === 'medium') guidance.push('For medium readingLoad physics, keep the stem compact: three short clauses is ideal; avoid five-plus named points, multiple simultaneous particles, or hidden diagram dependence.');
    if (calculationLoad === 'light') guidance.push('For medium difficulty with light calculation, use proportional or sign/direction reasoning with a short formula cue; do not turn it into full numeric substitution or pure definition recall.');
    bannedPatterns.push(
      'pure definition or formula-name recall for a medium cell',
      'one-step proportional/fact judgement with no concrete condition',
      'five-plus condition wave/field/optics synthesis that should be hard',
      'unattached diagram references such as 如图所示, 图中, figure, or diagram'
    );
    requiredPatterns.push(
      'one concrete physical setup or state change',
      'one explicit relation to apply',
      'one inference about direction, phase, topology, sign, proportional change, or qualitative result'
    );
  }
  if (/(力|运动|机械|牛顿|能量|动量|功|motion|mechanic|newton|force|energy|momentum)/i.test(topicText)) {
    guidance.push('For mechanics topics, calculation is allowed when the model needs it, but the problem must depend on a physical model or relation choice before arithmetic.');
    bannedPatterns.push(
      'one-step v=s/t, F=ma, W=Fs, or power substitution as the whole task',
      'only changing free-fall, block-on-plane, or friction numbers across retries',
      'asking only for a raw formula result without model selection, force relation, energy relation, or condition judgement'
    );
    requiredPatterns.push(
      'force diagram or model selection',
      'energy or momentum conservation',
      'multi-stage motion',
      'graph relation',
      'friction, normal force, or constraint reasoning',
      'vector component or unit/dimension check'
    );
  }
  if (/(电|电路|欧姆|电流|电压|电阻|电功率|circuit|electric|ohm|current|voltage|resistance|power)/i.test(topicText)) {
    guidance.push('For electricity or circuit topics, the core task should be circuit-state or relation reasoning before numerical substitution.');
    bannedPatterns.push(
      'bare Ohm-law substitution as the whole task',
      'only changing resistor numbers in a series/parallel calculation',
      'power formula plug-in without circuit topology, switch state, meter reading, or graph reasoning'
    );
    requiredPatterns.push(
      'circuit topology reasoning',
      'series/parallel equivalent relation',
      'power or energy relation',
      'meter reading',
      'graph slope or switch-state change',
      'internal resistance or proportional-relation judgement'
    );
  }
  if (/(波|光|透镜|折射|反射|wave|optics|lens|refraction|reflection)/i.test(topicText)) {
    guidance.push('For waves or optics topics, use calculation only when required; prioritize image formation, path reasoning, phase/frequency/wavelength relation, and qualitative phenomenon prediction.');
    if (difficultyBand === 'medium') {
      guidance.push('For medium wave/optics cells, use a text-complete setup such as half/quarter-wavelength phase comparison, wave-direction plus slope-to-velocity judgement, lens movement plus image-change judgement, or one refractive-index relation. Keep the required inference to two linked steps and do not require an unseen drawing.');
    }
    bannedPatterns.push(
      'pure formula substitution detached from wave or optical phenomenon',
      'changing only focal length, distance, wavelength, or frequency numbers across retries'
    );
    requiredPatterns.push(
      'image formation',
      'ray/path reasoning',
      'phase, frequency, or wavelength relation',
      'qualitative phenomenon prediction'
    );
  }
  if (/(实验|测量|误差|图像|图表|experiment|measurement|error|graph|chart)/i.test(topicText)) {
    guidance.push('For experiment, measurement, or graph topics, readingLoad and calculationLoad are soft; the item must center on experimental variable control, graph slope/intercept, error source, instrument reading, or conclusion from data.');
    bannedPatterns.push(
      'pure formula substitution detached from the experiment or graph',
      'generic recall of an instrument name without a measurement conclusion',
      'calculation as the central task when the topic expects variable-control or graph interpretation'
    );
    requiredPatterns.push(
      'experimental variable control',
      'graph slope or intercept interpretation',
      'error-source judgement',
      'instrument reading',
      'conclusion from data'
    );
  }
  if (bannedPatterns.length) guidance.push(`Physics hard banned patterns: ${bannedPatterns.join('; ')}.`);
  if (requiredPatterns.length) guidance.push(`Physics required acceptable patterns: ${requiredPatterns.join('; ')}.`);
  return guidance.join(' ');
}

function mathTopicProfileGuidance(blueprint: QuestionGenerationBlueprint, targetProfile: Record<string, unknown>) {
  if (blueprint.subject !== 'math' || !Object.keys(targetProfile).length) return '';
  const topicText = [
    blueprint.topicTitle,
    blueprint.topicCode,
    blueprint.topicModule,
    blueprint.examScope,
    stringArray(blueprint.allowedQuestionTypes).join(' ')
  ].map((item) => cleanText(item).toLowerCase()).filter(Boolean).join(' ');
  const difficultyBand = cleanText(targetProfile.difficultyBand ?? blueprint.difficulty).toLowerCase();
  const calculationLoad = cleanText(targetProfile.calculationLoad).toLowerCase();
  const readingLoad = cleanText(targetProfile.readingLoad).toLowerCase();
  const questionForm = cleanText(targetProfile.questionForm).toLowerCase();
  const cognitiveSkill = cleanText(targetProfile.cognitiveSkill).toLowerCase();
  const isBasic = difficultyBand === 'basic';
  const isMediumOrHard = difficultyBand === 'medium' || difficultyBand === 'hard';
  const needsNonTrivialWork = isMediumOrHard || calculationLoad === 'medium' || calculationLoad === 'heavy';
  const targetCalculationApplication = questionForm === 'calculation_application'
    || questionForm === 'calculation'
    || cognitiveSkill === 'standard_application'
    || cognitiveSkill === 'calculation_application';
  const targetConceptCheck = questionForm === 'concept_check'
    || questionForm === 'concept_judgement'
    || questionForm === 'concept_discrimination'
    || cognitiveSkill === 'concept_discrimination'
    || cognitiveSkill === 'concept_judgement';
  const guidance: string[] = [];
  const bannedPatterns: string[] = [];
  const requiredPatterns: string[] = [];
  if (targetCalculationApplication) {
    guidance.push('For calculation_application targets, phrase the stem as a concrete computation using 求/计算/值/结果; avoid "下列/哪个/哪项/正确" judgement wording because it is classified as concept_identification by the automatic profile checker.');
  }
  if (targetConceptCheck) {
    guidance.push('For concept_check or concept_discrimination targets, phrase the stem as a judgement/claim-selection task and keep calculation only as light supporting evidence.');
  }
  if (needsNonTrivialWork) {
    guidance.push('For medium/hard subject-practice math cells, do not use an atomic formula-substitution prompt; include enough connected conditions for the automatic profile checks to see the intended reasoning and calculation load.');
    bannedPatterns.push('one-sentence template calculation with only one given fact and one requested value');
    requiredPatterns.push('at least two connected facts, transformations, or reasoning moves visible in the prompt and explanation');
  }
  if (/(函数|function|对数|logarithm|指数|exponential|基本初等函数)/i.test(topicText)) {
    bannedPatterns.push(
      'lab, experiment, sensor, signal-processing, finance, biology, or model-fitting wrappers for pure function-property or exp/log ordering items',
      'phrasing exp/log comparisons as outputs of several artificial models instead of direct mathematical values or expressions'
    );
    requiredPatterns.push(
      'a pure math stem using 已知/设/给出函数 or 给出函数值 a,b,c before asking for a correct judgement',
      'for exp/log ordering, compare named values or expressions directly and show interval/bound evidence in the explanation'
    );
    guidance.push('For function, logarithm, and exponential math cells, keep the stem in a pure examination-math form. Do not wrap the item in experiments, sensors, signal processing, model fitting, finance, biology, or other cross-subject scenarios unless syllabusScope explicitly requires that external context.');
    if (targetConceptCheck) {
      guidance.push('For medium function concept-judgement targets, prefer "已知/设函数... 下列判断正确的是" with domain, range, monotonicity, parity, symmetry, parameter, or ordering claims; avoid words like 实验、传感器、输入信号、建模、模型输出 because they are classified as experimental/application style by the automatic checker.');
    }
    if (isBasic) {
      guidance.push('For basic function cells, use one elementary function or one direct exp/log comparison. Ask for one value, immediate domain/range condition, vertex/axis property, or one clearly evidenced judgement; avoid piecewise definitions, universal quantifiers, parameters, or stacked condition lists.');
    }
  }
  if (/(数列|sequence|arithmetic sequence|geometric sequence)/i.test(topicText)) {
    if (isBasic) {
      bannedPatterns.push(
        'definition-only arithmetic/geometric sequence recognition without any computed term or sum',
        'medium/hard recurrence, proof, or multi-parameter sequence conditions in a basic cell'
      );
      requiredPatterns.push(
        'an explicit nth-term formula, common difference/ratio, adjacent-term relation, or one visible sum formula',
        'one requested term, common difference/ratio, or short partial sum with the calculation shown'
      );
      guidance.push('For basic sequence targets, allow one direct arithmetic/geometric sequence calculation when the formula, common difference/ratio, or adjacent-term relation is explicit. Keep it to one visible substitution or one short parameter step; do not inflate it into recurrence proof or multi-condition reasoning.');
    } else {
      bannedPatterns.push(
        '等比数列只给 a1/q 或 a2/a5 and ask directly for S4, S8, a7, or a8',
        '等差数列只给 a1/d or two adjacent terms and ask directly for one term or common difference',
        'single-step sequence substitution where the explanation is only applying a_n or S_n'
      );
      requiredPatterns.push(
        'recurrence relation with at least two substitutions',
        'index-sum symmetry or middle-term relation',
        'partial-sum relation plus term relation',
        'missing parameter inferred before computing the target',
        'observed-term pattern requiring a formula choice'
      );
      guidance.push('For sequence targets, HARD BAN direct templates such as giving only a1/q/d or a2/a5 and asking for S4, S8, a7, a8, or one common difference. Prefer recurrence, index-sum symmetry, partial-sum relations, missing parameters, or choosing a valid formula from observed terms.');
    }
    if (!isBasic && needsNonTrivialWork) {
      guidance.push('For medium/hard sequence targets, the stem must require at least two linked sequence facts or transformations before selecting the answer; a one-line arithmetic/geometric substitution will fail the profile and must not be generated.');
    }
  }
  if (/(空间几何|立体几何|空间直角坐标|solid geometry|three-dimensional|3d|coordinate geometry|geometry)/i.test(topicText)) {
    if (isBasic) {
      bannedPatterns.push(
        'unseen diagram-dependent geometry stem',
        'abstract line-plane theorem recall without coordinates or a self-contained configuration'
      );
      requiredPatterns.push(
        'explicit coordinates, one line/circle equation, or one simple spatial configuration',
        'one distance, midpoint, slope, vector, symmetry coordinate, or substitution calculation'
      );
      guidance.push('For basic geometry targets, a direct coordinate metric is acceptable: distance, midpoint, slope, simple symmetry coordinate, or one line/circle substitution. Keep the diagram information self-contained and avoid abstract theorem-only statements.');
    } else {
      bannedPatterns.push(
        'asking only for distance between two 3D points',
        'asking only for raw vector AB or coordinates of a symmetric point',
        'single coordinate substitution without a line-plane, angle, perpendicular, projection, or spatial relation'
      );
      requiredPatterns.push(
        'a self-contained spatial configuration with multiple named points, lines, or planes',
        'a relation involving parallel/perpendicular, angle, projection, midpoint, plane, or vector condition',
        'a conclusion or selection that depends on the spatial relation, not only one formula'
      );
      guidance.push('For spatial-geometry targets, HARD BAN pure two-point distance, raw vector AB, coordinate symmetry only, or single coordinate substitution questions. Use a relation among points, lines, planes, vectors, angles, perpendicular/parallel conditions, projection, midpoint, or a self-contained spatial configuration.');
    }
    if (targetCalculationApplication && calculationLoad === 'medium' && readingLoad === 'low') {
      guidance.push('For low-reading medium-calculation spatial geometry, use a compact vector computation such as 求 AB·AC, |AB|^2+|AC|^2, a parameter from perpendicular/parallel conditions, or a projection length; include coordinates/operators in the stem and do not ask which statement is correct.');
    }
    if (targetConceptCheck) {
      guidance.push('For spatial concept-check targets, use claim selection about perpendicular/parallel, projection, plane symmetry, or vector direction, not a raw coordinate value request.');
    }
    if (readingLoad !== 'low') {
      guidance.push('For medium/high reading-load spatial geometry, include a compact configuration with multiple named objects or conditions; do not depend on an unseen diagram.');
    }
  }
  if (/(古典概型|概率|排列组合|probability|combinatorics|normal distribution|正态分布)/i.test(topicText)) {
    if (/正态分布|normal distribution/i.test(topicText)) {
      bannedPatterns.push(
        'using a generic bell-curve definition recall item as medium or hard',
        'asking a hard normal-distribution cell with only one symmetry lookup'
      );
      requiredPatterns.push(
        'normal-distribution symmetry or standardization evidence visible in the stem',
        'one interval/probability relation for basic, two linked interval relations or one parameter relation for medium/hard'
      );
      guidance.push('For normal-distribution math cells, match difficulty by evidence: basic is one symmetry or interval lookup, medium uses standardization or two interval-probability relations, and hard must include a parameter, transformation, or combined interval condition. Do not inflate difficulty with wording alone.');
      if (readingLoad === 'low' || difficultyBand === 'hard') {
        bannedPatterns.push('three or more Phi/standard-normal lookup values listed as a reference table');
        guidance.push('For hard or low-reading normal-distribution cells, use at most two Phi/z lookup anchors in the stem. Prefer tail percentages that map to simple z values, and avoid a mini reference table with three or more Phi values.');
      }
    } else {
      bannedPatterns.push(
        'plain probability definition recall without a concrete finite sample space',
        'hard probability generated as a direct one-count classical-probability fraction',
        'hard probability that lists events A/B/C/D but gives no case split, conditional, complement, or restriction computation'
      );
      requiredPatterns.push(
        'a visible finite sample space, counting condition, or event relation',
        'for medium/hard, at least two counting cases, a complement relation, conditional relation, or independence relation before the final answer'
      );
      guidance.push('For probability cells, basic should be a clean finite-sample-space or one-step counting probability. Medium should require two connected counting cases, complement counting, conditional probability, or independence. Hard should require case splitting, restriction interaction, or a parameter/conditional relation; do not label a direct favorable/total count as hard.');
    }
  }
  if (/(向量|复数|vector|complex)/i.test(topicText)) {
    if (isBasic) {
      bannedPatterns.push(
        'locus, parameter, projection-chain, or multi-condition vector/complex system in a basic cell',
        'concept-only vector or complex-number property recall with no concrete operation'
      );
      requiredPatterns.push(
        'one direct vector norm/dot product/coordinate operation or one complex modulus/conjugate/real-imaginary calculation'
      );
    } else {
      bannedPatterns.push(
        'hard vector or complex-number cells that ask only for one direct coordinate, modulus, dot product, or arithmetic result',
        'medium/hard items where all computation is hidden in the explanation rather than visible in the stem'
      );
      requiredPatterns.push(
        'for medium/hard, a relation such as parallel/perpendicular, modulus, conjugate, argument, locus, or parameter constraint',
        'a conclusion that depends on combining at least two vector or complex-number facts'
      );
    }
    guidance.push('For vector and complex-number cells, basic may use one direct operation. Medium needs a relation plus a computation or judgement, such as perpendicular/parallel, modulus/conjugate/argument, dot product, or parameter substitution. Hard must combine multiple constraints or a locus/intersection/parameter condition; a single dot product or |z| calculation is not hard.');
  }
  if (/(导数|微积分|derivative|calculus)/i.test(topicText)) {
    bannedPatterns.push(
      'basic derivative cells inflated into long multi-condition tangent or parameter problems',
      'basic derivative cells built as piecewise, continuity, left-right derivative, or undefined-domain trick questions',
      'hard derivative cells that only ask for f\'(a), a tangent slope, or one monotonic interval'
    );
    requiredPatterns.push(
      'basic: one derivative value, tangent slope, or monotonic sign judgement',
      'medium/hard: derivative sign plus interval/extremum/tangent/parameter evidence before option elimination'
    );
    guidance.push('For derivative and introductory-calculus cells, basic should stay one derivative/tangent/monotonicity fact with no piecewise, parameter, continuity, left-right derivative, or undefined-domain trap. Medium should combine derivative sign with an interval, extremum, tangent, or parameter condition. Hard needs at least two linked derivative conditions or a parameter/extremum/tangent system; do not use a direct derivative value as hard.');
  }
  if (/(平面解析几何|解析几何|圆锥曲线|直线|圆|parabola|ellipse|hyperbola|analytic geometry)/i.test(topicText)) {
    bannedPatterns.push(
      'asking only for distance, midpoint, slope, or substituting one point into a line/circle equation as medium or hard',
      'unseen diagram-dependent geometry stems'
    );
    requiredPatterns.push(
      'for medium/hard, combine an equation relation with position, tangent, chord, distance, symmetry, parameter, or intersection evidence',
      'a self-contained algebraic geometry setup that is answerable without a diagram'
    );
    guidance.push('For plane analytic-geometry cells, basic may be one slope, distance, midpoint, or substitution. Medium needs two connected facts such as line-circle position, tangent condition, chord relation, symmetry, or parameter. Hard must combine multiple constraints or conic/parameter reasoning; never depend on an unseen diagram.');
    if (isBasic) {
      requiredPatterns.push('for basic, ask one direct slope, distance, midpoint, intercept, or point-substitution calculation');
    }
  }
  if (/(数据的数字特征|统计|statistics|data)/i.test(topicText)) {
    if (isBasic) {
      bannedPatterns.push(
        'definition-only statistic identification without data',
        'multi-group pooled variance, changed-sample chain, or two-statistic inference in a basic cell'
      );
      requiredPatterns.push(
        'a short concrete data set or one average/count relation',
        'one mean, median, range, variance, standard deviation, or removed/added value calculation'
      );
      guidance.push('For basic data/statistics targets, use one short concrete data set or one average/count relation, then compute exactly one statistic or one missing added/removed value. Do not use definition-only questions, pooled variance, or multi-stage changed-sample reasoning.');
    } else {
      bannedPatterns.push(
        'asking only for the mean or variance of a short raw list such as 2,4,6,8,10',
        'single formula substitution for variance or average without any comparison, change, or missing value',
        'repeating only the variance transformation template y=ax+b and asking for the new variance',
        'the recycled 2,4,6,8,10 or x1,...,x10 variance family without a second constraint or decision',
        'known variance, multiply every data item by k and add b, find variance',
        'giving old mean/variance and applying y=2x+b or y=kx+b to every item as the whole problem',
        'known x1,x2,...,x10 mean/variance followed by "multiply every item by k then add/subtract b; find the new variance"'
      );
      requiredPatterns.push(
        'a missing value, changed sample, grouped/weighted mean, or comparison constraint that must be inferred before the final statistic',
        'comparison among mean, median, range, variance, or standard deviation with a concrete reason',
        'interpretation with a concrete computable answer and at least two visible statistical quantities',
        'a compact low-reading medium-calculation stem with one unknown or one sample change before the final statistic'
      );
      guidance.push('For data/statistics targets, HARD BAN only asking the mean or variance of a short raw list. Also HARD BAN repeating the pure y=ax+b variance-transformation template as the main idea, including x1,x2,...,x10 variants that give old mean/variance and then multiply every item by k plus/minus b. Prefer missing-value inference, changed samples with two statistics, grouped/weighted mean, comparison of mean/median/range/variance, or an interpretation that still has a concrete computable answer.');
    }
    if (targetCalculationApplication && calculationLoad === 'medium' && readingLoad === 'low') {
      guidance.push('For low-reading medium-calculation data/statistics, keep the stem short but make the calculation visible: use 4-5 formula/operator symbols and two connected operations, such as deriving an unknown from mean before variance, replacing/deleting one value before comparing a statistic, or combining range/mean with variance. Do not ask a plain "known variance, multiply every data item by k and add b, find variance" question. This also bans old-mean/old-variance variants with add/subtract b.');
      guidance.push('For tail data/statistics cells, use one compact skeleton per attempt: unknown-from-mean-then-variance; replace/delete one value then compare mean plus variance/range; grouped two-frequency weighted mean; or median/range plus one missing value. Avoid "下列/哪个/哪项/正确" judgement wording when targetProfile.questionForm is calculation_application.');
    }
    if (isMediumOrHard || calculationLoad === 'medium') {
      guidance.push('For medium data/statistics cells, rotate problem skeletons across missing-value inference, grouped average, statistic comparison, and changed-sample effects; do not keep regenerating the same variance-linear-transform family after failures.');
    }
  }
  if (bannedPatterns.length) guidance.push(`Hard banned patterns: ${bannedPatterns.join('; ')}.`);
  if (requiredPatterns.length) guidance.push(`Required acceptable patterns: ${requiredPatterns.join('; ')}.`);
  return guidance.join(' ');
}

function subjectPracticeTopicProfileGuidance(blueprint: QuestionGenerationBlueprint, targetProfile: Record<string, unknown>) {
  if (blueprint.subject === 'chemistry') return chemistryTopicProfileGuidance(blueprint, targetProfile);
  if (blueprint.subject === 'physics') return physicsTopicProfileGuidance(blueprint, targetProfile);
  return mathTopicProfileGuidance(blueprint, targetProfile);
}

function subjectPracticeTopicProfileTargets(blueprint: QuestionGenerationBlueprint, targetProfile: Record<string, unknown>) {
  const guidance = subjectPracticeTopicProfileGuidance(blueprint, targetProfile);
  const generationStrategy = constraintsRecord(targetProfile.generationStrategy);
  if (!guidance && !Object.keys(generationStrategy).length) return null;
  return {
    topicTitle: blueprint.topicTitle,
    targetDifficulty: cleanText(targetProfile.difficultyBand ?? blueprint.difficulty),
    guidance,
    generationStrategy: Object.keys(generationStrategy).length ? generationStrategy : null
  };
}

function subjectPracticeTargetProfileContract(blueprint: QuestionGenerationBlueprint, targetProfile: Record<string, unknown>, questionPlan: Record<string, unknown> = {}) {
  if (!Object.keys(targetProfile).length) return '';
  const operationalGuidance = targetProfileOperationalGuidance(blueprint.subject, targetProfile, questionPlan);
  const mathQuestionPlanSuppressesHighReadingLoad = blueprint.subject === 'math'
    && cleanText(targetProfile.readingLoad).toLowerCase() === 'high'
    && questionPlanSuppressesMathHighReadingLoad(questionPlan);
  const mathQuestionPlanKeepsBasicSingleTarget = blueprint.subject === 'math'
    && questionPlanKeepsMathBasicSingleTarget(questionPlan);
  if (blueprint.subject === 'chemistry') {
    return [
      'For chemistry subject-practice candidates, syllabus topic and examScope are the hard contract.',
      'targetProfile is a soft style hint. Do not force calculationLoad or questionForm if it pushes the item outside the topic.',
      operationalGuidance,
      subjectPracticeGenerationStrategyContract(targetProfile),
      'Choose a chemically meaningful task form before optimizing targetProfile surface fields.',
      'For qualitative chemistry topics, prefer property judgement, phenomenon prediction, substance or ion identification, reaction selection, conversion chain, experiment inference, and impurity-removal reasoning.',
      'For quantitative chemistry topics, calculation is allowed, but the reaction family, reasoning structure, and question form must vary across retries.',
      'Do not generate generic textbook recall unless the target topic and examScope genuinely require recall.'
    ].join(' ');
  }
  if (blueprint.subject === 'physics') {
    return [
      'For physics subject-practice candidates, physical model, situation, variables, unit/dimension consistency, formula applicability, syllabus topic, and examScope are the hard contract.',
      'targetProfile is a topic-aware style hint. Its questionForm, readingLoad, and calculationLoad fields may be subject-aware, but targetProfile.difficultyBand is a hard production target.',
      'For targetProfile.difficultyBand=basic, use one clear physics relation or one concept judgement; avoid multi-stage electromagnetic induction, direction-plus-magnitude double tasks, and long condition chains. For hard, include a genuine model choice, circuit/topology relation, direction law plus calculation, graph/experiment inference, or multiple linked variables.',
      'Do not force questionForm, readingLoad, or calculationLoad if it breaks the physical model, removes required context, or turns a concept/experiment/graph topic into bare algebra.',
      operationalGuidance,
      'Choose a physically meaningful task form before optimizing targetProfile surface fields.',
      'For quantitative physics topics, include enough conditions for the formula, relation, or conservation law to be applicable, and vary the physical situation and reasoning path across retries.',
      'For conceptual, graph, phenomenon, or experiment topics, prefer model selection, proportional reasoning, graph interpretation, variable-control reasoning, unit/dimension checks, and phenomenon prediction.',
      'Do not generate generic textbook recall unless the target topic and examScope genuinely require recall.'
    ].join(' ');
  }
  return [
    'For subject-practice production candidates, targetProfile is a hard contract, not a loose hint.',
    'The generated item must satisfy targetProfile.questionForm, targetProfile.cognitiveSkill, targetProfile.difficultyBand, targetProfile.readingLoad, and targetProfile.calculationLoad at the same time.',
    operationalGuidance,
    'Before choosing a problem idea, map the targetProfile into the stem shape: concept_check/concept_judgement requires a statement, condition, transformation, or reasoning-claim judgement; calculation_application requires a concrete value, interval, expression, probability, or result.',
    mathQuestionPlanKeepsBasicSingleTarget
      ? 'If targetProfile.cognitiveSkill is multi_step_reasoning but the validated basic QuestionPlan requires one direct function target, treat one property rule plus one short option check as the reasoning path; do not add a second property, named point, parameter, or condition chain.'
      : 'If targetProfile.cognitiveSkill is multi_step_reasoning, require at least two connected conditions or reasoning moves in the stem and explanation; do not produce one-step recall.',
    mathQuestionPlanSuppressesHighReadingLoad
      ? 'If targetProfile.readingLoad is high but questionPlan.renderConstraints require a pure compact math item, do not add context, tables, or five-plus conditions; satisfy the QuestionPlan skeleton and keep targetProfile.difficultyBand correct.'
      : 'If targetProfile.readingLoad is high, include a compact but real context or multiple conditions; if it is low, keep the stem short.',
    'If targetProfile.calculationLoad is heavy, include enough algebraic, geometric, statistical, or probability operations to make the calculation path visibly nontrivial; if it is light, avoid overcomplicating.',
    'If the current problem idea cannot meet the targetProfile exactly enough to pass automatic profile alignment, discard it and generate a different problem idea.',
    'For repeated production cells, change the problem skeleton, mathematical object, condition pattern, and distractor misconceptions; do not merely swap numbers or paraphrase a previous candidate.',
    'Do not generate generic textbook recall such as "Which is a basic property of..." when targetProfile expects application, judgement, or multi-step reasoning.'
  ].join(' ');
}

function mockExamAntiPatternGuard(subject: string) {
  return [
    mockExamSubjectGuard(subject),
    'Do not mention diagrams, figures, images, tables, or "shown below" unless the blueprint explicitly includes image evidence for this slot.',
    'Do not create fake diagram-dependent questions when no image is provided.',
    'Do not generate generic textbook recall such as "Which is a basic property of..." when the targetProfile expects application or reasoning.',
    'Do not create options that overlap after simplification, such as equivalent inequalities, equivalent intervals, duplicate radicals/fractions, or the same value in different notation.',
    'Do not reuse the same problem skeleton with only numbers changed after a failed attempt.'
  ].join(' ');
}

function automaticFeedbackInstruction(repairFeedback: Record<string, unknown>, questionPlan: Record<string, unknown> = {}) {
  const mode = cleanText(repairFeedback.repairMode ?? repairFeedback.strategy);
  const fieldsToRepair = Array.isArray(repairFeedback.fieldsToRepair)
    ? repairFeedback.fieldsToRepair.map((item) => cleanText(item)).filter(Boolean)
    : [];
  const fieldInstruction = fieldsToRepair.length
    ? `Modify only repairFeedback.fieldsToRepair unless a direct dependency requires it: ${fieldsToRepair.join(', ')}.`
    : 'Modify only the fields needed to satisfy repairFeedback.';
  if (!Object.keys(repairFeedback).length) return '';
  if (mode === 'fresh_subject_practice_cell_candidate_after_recent_failures') {
    const compactItems = (value: unknown, limit: number, maxLength = 260) => stringArray(value)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .map((item) => (item.length > maxLength ? `${item.slice(0, maxLength - 1)}...` : item))
      .slice(0, limit);
    const retryInstructionPriority = (item: string) => {
      if (/(questionplan|candidate_plan_math|question-plan)/i.test(item)) return 0;
      if (/(hard experimental|hard organic|hard periodic|hard equilibrium|hard math|hard physics|two trials|scheduler-selected|selected task-family|task-family variant|required reasoning moves|difficulty rubric)/i.test(item)) return 0;
      if (/(targetprofile|syllabus|chemistry|physics|math|subject-specific|topic-and-difficulty)/i.test(item)) return 1;
      return 2;
    };
    const priorityCompactItems = (value: unknown, limit: number, maxLength = 260) => stringArray(value)
      .map((item, index) => ({ item: cleanText(item), index }))
      .filter((entry) => Boolean(entry.item))
      .sort((left, right) => retryInstructionPriority(left.item) - retryInstructionPriority(right.item) || left.index - right.index)
      .map((entry) => (entry.item.length > maxLength ? `${entry.item.slice(0, maxLength - 1)}...` : entry.item))
      .slice(0, limit);
    const rawSchedulerHint = constraintsRecord(repairFeedback.schedulerHint);
    const rawSchedulerPreferredFamily = cleanText(rawSchedulerHint.preferredFamily);
    const schedulerHintAllowed = !Object.keys(questionPlan).length
      || !rawSchedulerPreferredFamily
      || subjectPracticeQuestionPlanSupportsTaskFamily(questionPlan, rawSchedulerPreferredFamily);
    const allReasonCodes = stringArray(repairFeedback.reasonCodes)
      .map((item) => cleanText(item).toLowerCase())
      .filter(Boolean);
    const reasonCodes = compactItems(repairFeedback.reasonCodes, 8, 120);
    const mathQuestionPlanReasonCodes = allReasonCodes.filter((code) => code.startsWith('candidate_plan_math_'));
    const hasMathQuestionPlanReason = (items: string[]) => mathQuestionPlanReasonCodes.some((code) => items.some((item) => code.includes(item)));
    const questionPlanTargetDifficulty = cleanText(questionPlan.targetDifficulty).toLowerCase();
    const mathQuestionPlanChecklist: string[] = [];
    if (mathQuestionPlanReasonCodes.length) {
      if (hasMathQuestionPlanReason(['probability'])) mathQuestionPlanChecklist.push('probability: use concrete sample space/events plus a second relation for medium/hard.');
      if (hasMathQuestionPlanReason(['function', 'parameter', 'exp_log', 'elementary'])) {
        mathQuestionPlanChecklist.push(questionPlanTargetDifficulty === 'basic'
          ? 'functions (basic): use exactly one explicit function and ask exactly one direct property, value, or one-point membership question; do not add a second named point, parameter inference, mixed property stack, or two-step condition chain.'
          : 'functions (medium/hard): keep pure algebraic context and show the linked property, constraint, or ordering moves required by the plan.');
      }
      if (hasMathQuestionPlanReason(['vector_complex'])) mathQuestionPlanChecklist.push('vector/complex: use explicit objects and two vector/complex relations without geometry drift or object stacks.');
      if (hasMathQuestionPlanReason(['derivative'])) mathQuestionPlanChecklist.push('derivative: connect derivative evidence with tangent/monotonicity/extremum/sign constraints.');
      if (hasMathQuestionPlanReason(['analytic_geometry'])) mathQuestionPlanChecklist.push('analytic geometry: connect two point/line/circle/conic relations before option judgement.');
      if (hasMathQuestionPlanReason(['sequence'])) mathQuestionPlanChecklist.push('sequence: state recurrence/term/sum evidence and add a second relation for medium/hard.');
      if (hasMathQuestionPlanReason(['statistics'])) mathQuestionPlanChecklist.push('statistics: connect two data/statistic relations instead of one-step mean/variance transforms.');
      if (hasMathQuestionPlanReason(['spatial_geometry', 'spatial'])) mathQuestionPlanChecklist.push('spatial geometry: use self-contained points/lines/planes/vectors with at least two visible relations.');
      if (hasMathQuestionPlanReason(['option_judgement'])) mathQuestionPlanChecklist.push('option judgement: make options short mathematical claims, not raw values.');
    }
    const targetedInstructions = priorityCompactItems(repairFeedback.targetedInstructions, 6, 320)
      .filter((instruction) => schedulerHintAllowed || !/scheduler-selected math task-family|selected math task-family/i.test(instruction));
    const blockedPatterns = priorityCompactItems(repairFeedback.blockedPatterns, 5, 320);
    const recentAcceptedScenarioHints = compactItems(repairFeedback.recentAcceptedScenarioHints, 4, 180);
    const recentAcceptedPatternHints = compactItems(repairFeedback.recentAcceptedPatternHints, 6, 80);
    const currentCandidatePatternHints = compactItems(repairFeedback.currentCandidatePatternHints, 4, 80);
    const taskFamilyPolicy = constraintsRecord(repairFeedback.taskFamilyPolicy);
    const schedulerHint = schedulerHintAllowed ? rawSchedulerHint : {};
    const schedulerPreferredFamily = cleanText(schedulerHint.preferredFamily);
    const schedulerPreferredLabel = cleanText(schedulerHint.preferredFamilyLabel);
    const schedulerPreferredInstruction = cleanText(schedulerHint.preferredFamilyInstruction);
    const schedulerAvoidFamilies = compactItems(schedulerHint.avoidFamilies, 4, 80);
    const schedulerAvoidFamilyLabels = compactItems(schedulerHint.avoidFamilyLabels, 4, 100);
    const schedulerReason = cleanText(schedulerHint.reason);
    const policyTaskFamily = cleanText(taskFamilyPolicy.taskFamily);
    const policyVariant = cleanText(taskFamilyPolicy.selectedVariantLabel ?? taskFamilyPolicy.selectedVariant);
    const policyRequiredMoves = compactItems(taskFamilyPolicy.requiredReasoningMoves, 5, 160);
    const policyDifficultyRubric = compactItems(taskFamilyPolicy.difficultyRubric, 5, 180);
    const policyBannedShortcut = cleanText(taskFamilyPolicy.bannedMediumShortcut);
    return [
      'This is a fresh subject-practice production candidate for a cell with recent production history.',
      'Use repairFeedback only as aggregate negative feedback; do not copy, paraphrase, or depend on any previous candidate.',
      'Also use repairFeedback as aggregate diversity memory for accepted scenarios already covered in this cell.',
      'The new candidate must satisfy the same syllabus topic and targetProfile while avoiding repeated failure patterns and already-covered accepted scenarios.',
      schedulerPreferredFamily ? `Scheduler hint: prefer ${schedulerPreferredLabel || schedulerPreferredFamily} (${schedulerPreferredFamily})${schedulerReason ? ` because ${schedulerReason}` : ''}.` : '',
      schedulerPreferredInstruction ? `Required scheduler shape: ${schedulerPreferredInstruction}.` : '',
      schedulerAvoidFamilies.length ? `Scheduler hint: avoid recently covered families ${(schedulerAvoidFamilyLabels.length ? schedulerAvoidFamilyLabels : schedulerAvoidFamilies).join(', ')}.` : '',
      policyTaskFamily ? `Structured task-family policy: taskFamily=${policyTaskFamily}.` : '',
      policyVariant ? `Use this selected task-family variant for the new candidate: ${policyVariant}.` : '',
      policyRequiredMoves.length ? `Required reasoning moves that must be visible in the stem and explanation: ${policyRequiredMoves.join(' -> ')}.` : '',
      policyDifficultyRubric.length ? `Difficulty rubric for this retry: ${policyDifficultyRubric.join(' ')}` : '',
      policyBannedShortcut ? `Do not use this medium shortcut: ${policyBannedShortcut}.` : '',
      reasonCodes.length ? `Recent failed reason codes to avoid: ${reasonCodes.join(', ')}.` : '',
      mathQuestionPlanChecklist.length ? `Math QuestionPlan failure checklist: ${mathQuestionPlanChecklist.join(' ')}` : '',
      blockedPatterns.length ? `Hard banned patterns for this retry: ${blockedPatterns.join('; ')}.` : '',
      recentAcceptedPatternHints.length ? `Recently accepted pattern families already covered: ${recentAcceptedPatternHints.join(', ')}.` : '',
      currentCandidatePatternHints.length ? `Current candidate pool already overuses these pattern families; generate a different family: ${currentCandidatePatternHints.join(', ')}.` : '',
      recentAcceptedScenarioHints.length ? `Do not reuse these recently accepted scenario skeletons, substances, objects, or case systems: ${recentAcceptedScenarioHints.join('; ')}.` : '',
      targetedInstructions.length ? `Targeted retry instructions: ${targetedInstructions.join(' ')}` : '',
      'The new candidate must pass automatic profile alignment and the quality gate without requiring offline sampling evidence.'
    ].filter(Boolean).join(' ');
  }
  if (mode === 'regenerate_variant_after_gate_failure' || mode === 'fresh_candidate_after_gate_failure') {
    return [
      'This is an automatic retry after a failed online mock exam candidate.',
      'Use repairFeedback as hard negative feedback.',
      'Generate a fresh replacement candidate for the same slot; do not revise, paraphrase, number-swap, translate, or reuse the failed candidate.',
      'Respect repairFeedback.blockedPatterns and targetedInstructions exactly.',
      'The new candidate must pass the automatic quality gate without requiring offline sampling evidence.'
    ].join(' ');
  }
  return [
    'This is an automatic repair job for a failed candidate.',
    'Use repairFeedback as hard correction requirements.',
    'When repairFeedback.repairMode is revise_candidate_in_place, revise the supplied previousCandidate in place: preserve the same syllabus scope, topic intent, mock slot, and usable problem skeleton, but fix local defects such as wrong answer, multiple correct answers, option equivalence, weak distractors, explanation conflict, weak syllabus signal, or missing bilingual localization.',
    fieldInstruction,
    'For option equivalence, rewrite the incorrect options so every option is mathematically distinct and non-overlapping after simplification.',
    'Only change wording, numbers, options, answer, explanation, distractor metadata, or localizations as needed to pass the gate.'
  ].join(' ');
}

@Injectable()
export class QuestionPromptBuilderService {
  build(blueprint: QuestionGenerationBlueprint) {
    const mockExamGeneration = isMockExamGeneration(blueprint.constraints);
    const baseSchema = {
      prompt: 'string',
      options: [
        { id: 'A', text: 'string' },
        { id: 'B', text: 'string' },
        { id: 'C', text: 'string' },
        { id: 'D', text: 'string' }
      ],
      correctAnswer: 'A|B|C|D',
      explanation: 'string',
      knowledgeTags: ['string'],
      optionMetadata: [
        { optionId: 'B', distractorIntent: 'string', misconceptionTags: ['string'] }
      ]
    };
    const schema = {
      ...baseSchema,
      localizations: {
        zh: {
          prompt: 'string',
          options: [
            { id: 'A', text: 'string' },
            { id: 'B', text: 'string' },
            { id: 'C', text: 'string' },
            { id: 'D', text: 'string' }
          ],
          explanation: 'string',
          knowledgeTags: ['string']
        },
        en: {
          prompt: 'string',
          options: [
            { id: 'A', text: 'string' },
            { id: 'B', text: 'string' },
            { id: 'C', text: 'string' },
            { id: 'D', text: 'string' }
          ],
          explanation: 'string',
          knowledgeTags: ['string']
        }
      }
    };
    const syllabusScope = {
      subject: blueprint.subject,
      topicId: blueprint.topicId,
      topicCode: blueprint.topicCode ?? null,
      topicModule: blueprint.topicModule ?? null,
      topicTitle: blueprint.topicTitle,
      syllabusVersion: blueprint.syllabusVersion,
      examScope: blueprint.examScope ?? null,
      allowedQuestionTypes: stringArray(blueprint.allowedQuestionTypes),
      difficultyRange: stringArray(blueprint.difficultyRange),
      excludedScope: stringArray(blueprint.excludedScope).length
        ? stringArray(blueprint.excludedScope)
        : excludedScopeFromConstraints(blueprint.constraints),
      sourceLabel: blueprint.sourceLabel ?? null,
      sourceUrl: blueprint.sourceUrl ?? null
    };
    const providerSyllabusScope = {
      subject: syllabusScope.subject,
      topicId: syllabusScope.topicId,
      topicCode: syllabusScope.topicCode,
      topicModule: syllabusScope.topicModule,
      topicTitle: syllabusScope.topicTitle,
      syllabusVersion: syllabusScope.syllabusVersion,
      examScope: syllabusScope.examScope,
      allowedQuestionTypes: syllabusScope.allowedQuestionTypes,
      difficultyRange: syllabusScope.difficultyRange,
      excludedScope: syllabusScope.excludedScope
    };
    const metadata = {
      promptVersion: 'question-generator-v3-syllabus-style-profile',
      subject: blueprint.subject,
      topicId: blueprint.topicId,
      topicTitle: blueprint.topicTitle,
      syllabusVersion: blueprint.syllabusVersion,
      syllabusScope,
      difficulty: blueprint.difficulty,
      questionType: blueprint.questionType,
      skill: blueprint.skill,
      constraints: blueprint.constraints,
      schema
    };
    const expansion = constraintsRecord(constraintsRecord(blueprint.constraints).expansion);
    const repairFeedback = constraintsRecord(expansion.repairFeedback);
    const rawQuestionPlan = constraintsRecord(expansion.questionPlan);
    const questionPlan = canonicalQuestionPlanForPrompt(rawQuestionPlan, blueprint);
    const promptQuestionPlan = questionPlanPromptPayload(questionPlan);
    const styleProfile = constraintsRecord(constraintsRecord(blueprint.constraints).styleProfile);
    const rawTargetProfile = constraintsRecord(constraintsRecord(blueprint.constraints).targetProfile);
    const targetProfile = sourceIsolatedTargetProfile(rawTargetProfile);
    const hasRepairFeedback = Object.keys(repairFeedback).length > 0;
    const compactAuthoritativeQuestionPlan = [
      'math_medium_exp_log_ordering_chain_v1',
      'math_elementary_function_relation_v1',
      'physics_medium_optics_two_relation_v1',
      'chemistry_medium_classification_evidence_v1'
    ].includes(cleanText(questionPlan.planTemplate));
    const compactRepairReasonCodes = stringArray(repairFeedback.reasonCodes)
      .map((item) => safeStructuralToken(item, 80))
      .filter((item): item is string => Boolean(item))
      .slice(0, 2)
      .map((item) => item.slice(0, 80));
    const feedbackInstruction = hasRepairFeedback && compactAuthoritativeQuestionPlan
      ? [
        'Recent failures apply; the validated QuestionPlan is authoritative.',
        'Use a fresh surface form; follow the QuestionPlan exactly.'
      ].filter(Boolean).join(' ')
      : automaticFeedbackInstruction(repairFeedback, questionPlan);
    const promptRepairFeedback = hasRepairFeedback
      ? compactAuthoritativeQuestionPlan
        ? {
          reasonCodes: compactRepairReasonCodes,
          promptMemoryPolicy: 'validated_question_plan_authoritative_compact_failure_codes_only'
        }
        : {
          strategy: safeStructuralToken(repairFeedback.strategy),
          repairMode: safeStructuralToken(repairFeedback.repairMode),
          productionCellId: finiteBoundedNumber(repairFeedback.productionCellId, 1, Number.MAX_SAFE_INTEGER),
          reasonCodes: safeStructuralTokenArray(repairFeedback.reasonCodes),
          promptMemoryPolicy: 'bounded_system_instruction_is_authoritative_full_feedback_retained_in_metadata'
        }
      : null;
    const promptExpansion = Object.keys(expansion).length
      ? {
        generationMode: controlledRuntimeToken(expansion.generationMode),
        expansionIndex: finiteBoundedNumber(expansion.expansionIndex, 0, Number.MAX_SAFE_INTEGER),
        repairFeedback: promptRepairFeedback,
        ...(promptQuestionPlan ? { questionPlan: promptQuestionPlan } : {})
      }
      : null;
    // `expansion` is already sent as a top-level provider payload field below.
    // Keeping it inside `constraints` duplicated the full QuestionPlan (and repair
    // summary) on every request without adding any generation signal.
    const {
      expansion: _metadataOnlyExpansion,
      targetProfile: _metadataOnlyTargetProfile,
      styleProfile: _metadataOnlyStyleProfile,
      generationProfile: _metadataOnlyGenerationProfile,
      ...promptConstraintBase
    } = constraintsRecord(blueprint.constraints);
    const promptConstraints = {
      ...sourceIsolatedPromptConstraints(promptConstraintBase)
    };
    const targetProfileSummaryInstruction = subjectPracticeTargetProfileSummary(blueprint, targetProfile);
    const mockExamTargetProfileInstruction = mockExamGeneration ? mockExamTargetProfileContract(targetProfile) : '';
    const subjectPracticeTargetProfileInstruction = !mockExamGeneration
      ? subjectPracticeTargetProfileContract(blueprint, targetProfile, questionPlan)
      : '';
    const questionPlanInstruction = subjectPracticeQuestionPlanContract(questionPlan);
    const questionPlanSupersedesTopicGuidance = !mockExamGeneration
      && Boolean(promptQuestionPlan)
      && compactAuthoritativeQuestionPlan;
    const questionPlanSupersedesStyleReference = !mockExamGeneration
      && Boolean(promptQuestionPlan)
      && compactAuthoritativeQuestionPlan;
    const styleProfileSampleSize = finiteBoundedNumber(styleProfile.sampleSize, 0, 100000) ?? 0;
    const includeStyleReference = Object.keys(styleProfile).length > 0
      && styleProfileSampleSize >= SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE
      && !questionPlanSupersedesStyleReference;
    const promptTargetProfile = targetProfile;
    const subjectPracticeTopicInstruction = !mockExamGeneration && !questionPlanSupersedesTopicGuidance
      ? subjectPracticeTopicProfileGuidance(blueprint, targetProfile)
      : '';
    const mockExamAntiPatternInstruction = mockExamGeneration ? mockExamAntiPatternGuard(blueprint.subject) : '';
    const messages = [
      {
        role: 'system',
        content: [
          'You are a CSCA exam question writer.',
          'Return JSON only. No markdown.',
          'Return one JSON object with these root keys only: prompt, options, correctAnswer, explanation, knowledgeTags, optionMetadata, localizations.',
          'Do not wrap the object inside question, candidate, result, data, choices, or any other envelope.',
          'Create exactly one multiple-choice practice question that follows the requested blueprint.',
          'The question must have four mutually exclusive options A-D and exactly one correct answer.',
          'Use the supplied syllabusScope as the hard boundary for content.',
          'The prompt, options, and explanation must test the examScope directly and must not test excludedScope.',
          'The questionType must be one of allowedQuestionTypes when that list is not empty.',
          'The designed difficulty must be compatible with difficultyRange when that list is not empty.',
          'Make the syllabus signal visible: the prompt or explanation must clearly connect to topicTitle and examScope without copying those labels mechanically.',
          targetProfileSummaryInstruction,
          mockExamTargetProfileInstruction,
          subjectPracticeTargetProfileInstruction,
          questionPlanInstruction,
          subjectPracticeTopicInstruction,
          mockExamAntiPatternInstruction,
          'If targetProfile.questionForm is concept_check or concept_judgement, write a judgement/selection stem such as identifying a correct statement or transformation; do not turn it into a plain solve-the-equation calculation.',
          'If targetProfile.questionForm is calculation_application, ask for a concrete value, interval, expression, probability, or result and make the calculation path visible enough to match the requested calculationLoad.',
          'All four options must be mutually exclusive after mathematical simplification. Do not provide options that are algebraically equivalent, overlapping intervals, duplicate sets, or the same value written in different forms.',
          'Each incorrect option must represent a distinct misconception path; avoid near-duplicates like equivalent inequalities, interval notation variants, or same expression with only formatting changes.',
          'Include option-level distractor metadata for every incorrect option.',
          'The explanation must explicitly name the correct option ID or repeat the correct option content, then briefly explain why it is correct.',
          'Keep prompt <= 260 Chinese characters, each option <= 80 Chinese characters, explanation <= 220 Chinese characters, and each distractorIntent <= 60 Chinese characters.',
          'Write the main prompt/options/explanation in concise Chinese, and also include complete localizations.zh and localizations.en. localizations.zh must mirror the main Chinese question. localizations.en must be a faithful English version of the same question with the same option IDs and same correctAnswer.',
          'localizations.zh may copy the root Chinese prompt/options/explanation exactly. Keep localizations.en concise; do not add extra teaching notes.',
          'For both subject-practice and online mock exam candidates, English localization is required for approval. Do not omit localizations.en; keep mathematical notation equivalent across languages.',
          'Keep the explanation concise but sufficient; avoid showing long hidden derivations.',
          'Do not spend tokens on step-by-step reasoning; produce the final JSON object directly. Never repeat, preface, or analyze the schema before the JSON.',
          includeStyleReference
            ? 'A past-paper styleProfile is provided. Use it only as an abstract style, difficulty, and distractor guide. Do not copy, paraphrase, translate, number-swap, or reconstruct any source question.'
            : questionPlanSupersedesStyleReference
              ? 'For this calibrated task, the validated QuestionPlan replaces the verbose style reference; follow its task family, evidence chain, and render constraints exactly.'
              : 'No past-paper styleProfile is available. Generate from syllabus and blueprint only; keep style confidence conservative.',
          hasRepairFeedback ? feedbackInstruction : '',
          expansion.generationMode === 'expand_candidates' && !hasRepairFeedback
            ? 'This is an expansion job for a reusable blueprint: create a fresh variant and do not reuse old wording, numbers, examples, contexts, option order, or the same surface problem form.'
            : '',
          'Do not mention that the question is AI-generated.',
          `Return this JSON schema: ${JSON.stringify(schema)}`
        ].filter(Boolean).join(' ')
      },
      {
        role: 'user',
        content: JSON.stringify({
          subject: blueprint.subject,
          topicTitle: blueprint.topicTitle,
          syllabusVersion: blueprint.syllabusVersion,
          syllabusScope: providerSyllabusScope,
          designedDifficulty: blueprint.difficulty,
          questionType: blueprint.questionType,
          targetSkill: blueprint.skill,
          constraints: promptConstraints,
          expansion: promptExpansion,
          targetProfile: Object.keys(promptTargetProfile).length ? promptTargetProfile : null,
          profileAlignmentOperationalTargets: targetProfileOperationalTargets(blueprint.subject, targetProfile, questionPlan),
          subjectPracticeTopicProfileTargets: !mockExamGeneration && !compactAuthoritativeQuestionPlan
            ? subjectPracticeTopicProfileTargets(blueprint, targetProfile)
            : null,
          styleReference: includeStyleReference
            ? sourceIsolatedStyleReference(styleProfile, targetProfile)
            : null
        })
      }
    ];
    const systemPromptLength = String(messages[0]?.content ?? '').length;
    const userPromptLength = String(messages[1]?.content ?? '').length;
    const providerProjectionSha256 = createHash('sha256')
      .update(JSON.stringify(canonicalJsonValue(messages)))
      .digest('hex');
    const knownSourceTextFragments = Array.from(new Set([
      ...collectKnownSourceTextFragments(blueprint.constraints),
      ...collectKnownSourceTextFragments({ sourceText: blueprint.sourceLabel }),
      ...collectKnownSourceTextFragments({ sourceText: blueprint.sourceUrl })
    ]));
    const normalizedProviderProjection = normalizedLeakComparisonText(messages.map((message) => message.content).join('\n'));
    const knownSourceLeakMatchCount = knownSourceTextFragments
      .filter((fragment) => containsSourceTextWindow(normalizedProviderProjection, fragment)).length;
    if (knownSourceLeakMatchCount > 0) {
      throw new Error('question_generator_source_isolation_known_source_fragment_detected');
    }
    const dynamicSystemSections = {
      targetProfileSummary: targetProfileSummaryInstruction.length,
      mockExamTargetProfileContract: mockExamTargetProfileInstruction.length,
      subjectPracticeTargetProfileContract: subjectPracticeTargetProfileInstruction.length,
      questionPlanContract: questionPlanInstruction.length,
      subjectPracticeTopicGuidance: subjectPracticeTopicInstruction.length,
      mockExamAntiPatternGuard: mockExamAntiPatternInstruction.length,
      repairFeedbackInstruction: hasRepairFeedback ? feedbackInstruction.length : 0
    };
    const dynamicSystemCharacterCount = Object.values(dynamicSystemSections)
      .reduce((sum, length) => sum + Number(length || 0), 0);
    const removedDuplicateConstraintCharacters = [
      promptExpansion ? ['expansion', promptExpansion] : null,
      Object.keys(rawTargetProfile).length ? ['targetProfile', rawTargetProfile] : null,
      Object.keys(styleProfile).length ? ['styleProfile', styleProfile] : null
    ].filter(Boolean).reduce((sum, entry) => {
      const [key, value] = entry as [string, unknown];
      return sum + JSON.stringify(value).length + `,"${key}":`.length;
    }, 0);
    return {
      metadata: {
        ...metadata,
        promptAudit: {
          policyVersion: 'question-generator-prompt-audit-v1',
          systemPromptLength,
          userPromptLength,
          totalPromptCharacters: systemPromptLength + userPromptLength,
          expansionPlacement: promptExpansion ? 'top_level_only_no_constraints_duplicate' : 'absent',
          targetProfilePlacement: Object.keys(rawTargetProfile).length
            ? Object.keys(targetProfile).length
              ? compactAuthoritativeQuestionPlan
                ? 'compact_top_level_only_full_profile_in_metadata'
                : 'source_isolated_top_level_only_full_profile_in_metadata'
              : 'metadata_only_untrusted_free_text_omitted'
            : 'absent',
          generationProfilePlacement: Object.keys(constraintsRecord(constraintsRecord(blueprint.constraints).generationProfile)).length
            ? 'metadata_only_not_provider_prompt'
            : 'absent',
          sourceIsolation: {
            policyVersion: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_POLICY_VERSION,
            status: 'enforced_structural_projection',
            boundary: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_BOUNDARY,
            allowedInput: SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_ALLOWED_INPUT,
            forbiddenSourceFields: [...SUBJECT_PRACTICE_GENERATOR_SOURCE_ISOLATION_FORBIDDEN_SOURCE_FIELDS],
            originalQuestionContentOmitted: true,
            reversibleSourceFieldsOmitted: true,
            developerUnseenRequired: false,
            officialHoldoutRequiredForGeneratorIsolation: false,
            sourceLinkageIdentifiersOmitted: true,
            profileAggregationPolicyVersion: SUBJECT_PRACTICE_GENERATOR_PROFILE_AGGREGATION_POLICY_VERSION,
            profileMinimumSampleSize: SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
            profileProjectionMode: SUBJECT_PRACTICE_GENERATOR_PROFILE_PROJECTION_MODE,
            lowSampleStyleProfileOmitted: Object.keys(styleProfile).length > 0
              && styleProfileSampleSize < SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE,
            providerProjectionReplayable: true,
            knownSourceCorpusComparisonStatus: knownSourceTextFragments.length > 0
              ? 'passed'
              : 'no_known_source_fields_present',
            knownSourceFragmentCount: knownSourceTextFragments.length,
            knownSourceLeakMatchCount,
            providerProjection: messages,
            providerProjectionSha256,
            providerConstraintsMode: 'explicit_allowlist',
            providerTargetProfileMode: 'categorical_and_numeric_fields_only',
            providerStyleReferenceMode: includeStyleReference
              ? 'controlled_enums_and_aggregate_numbers_only'
              : Object.keys(styleProfile).length > 0 && styleProfileSampleSize < SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE
                ? 'omitted_below_minimum_aggregate_sample_size'
                : 'absent',
            providerQuestionPlanMode: promptQuestionPlan ? 'canonical_registered_plan_rebuilt_from_identifiers' : 'absent',
            sourceIdentityOmitted: true,
            rawRuntimeMetadataRetainedOutsideProviderMessages: true
          },
          styleProfilePlacement: includeStyleReference
            ? 'style_reference_only_no_constraints_duplicate'
            : questionPlanSupersedesStyleReference && Object.keys(styleProfile).length
              ? 'omitted_calibrated_question_plan_authoritative'
              : Object.keys(styleProfile).length > 0 && styleProfileSampleSize < SUBJECT_PRACTICE_GENERATOR_PROFILE_MINIMUM_SAMPLE_SIZE
                ? 'omitted_below_minimum_aggregate_sample_size'
              : 'absent',
          removedDuplicateConstraintCharacters,
          estimatedLegacyUserPromptLength: userPromptLength + removedDuplicateConstraintCharacters,
          questionPlanSupersedesTopicGuidance,
          questionPlanSupersedesStyleReference,
          questionPlanUsesCompactRepairFeedback: hasRepairFeedback && compactAuthoritativeQuestionPlan,
          dynamicSystemSections,
          staticAndSharedSystemCharacters: Math.max(0, systemPromptLength - dynamicSystemCharacterCount)
        }
      },
      messages
    };
  }
}
