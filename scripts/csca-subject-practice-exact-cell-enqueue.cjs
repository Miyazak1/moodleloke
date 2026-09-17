#!/usr/bin/env node

const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');

require('../backend/node_modules/ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  }
});

const {
  SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG,
  SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG,
  buildSubjectPracticeQuestionPlan,
  subjectPracticeQuestionPlanAttemptFor,
  subjectPracticeQuestionPlanGateFor,
  subjectPracticeQuestionPlanSupportsTaskFamily
} = require('../backend/src/ai-questioning/subject-practice-question-plan-policy');
const {
  subjectPracticeBuildSchedulerHint
} = require('../backend/src/ai-questioning/subject-practice-task-family-policy');
const {
  QuestionPromptBuilderService,
  questionPromptCharacterBudgetForPlanTemplate
} = require('../backend/src/ai-questioning/question-prompt-builder.service');
const {
  questionGenerationMaxTokensForBlueprint,
  questionGenerationModelForBlueprint,
  questionGenerationReasoningPolicyFor
} = require('../backend/src/ai-questioning/question-generator-provider.service');
const { AiGatewayCostService } = require('../backend/src/ai-gateway/ai-gateway-cost.service');
const {
  normalizeSubjectPracticeProductionTargetProfile
} = require('../backend/src/ai-questioning/ai-questioning.service');

function loadProjectEnv() {
  try {
    const text = fs.readFileSync('.env', 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch {
    // Environment loading is best-effort; Prisma/backend calls will surface missing config.
  }
}

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function positiveInt(name, fallback) {
  const value = Number(argValue(name, fallback));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function asNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function compactQuestionPlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  return {
    schemaVersion: plan.schemaVersion ?? null,
    policyVersion: plan.policyVersion ?? null,
    subject: plan.subject ?? null,
    topicId: plan.topicId ?? null,
    topicTitle: plan.topicTitle ?? null,
    productionCellId: plan.productionCellId ?? null,
    targetDifficulty: plan.targetDifficulty ?? null,
    taskFamily: plan.taskFamily ?? null,
    planTemplate: plan.planTemplate ?? null,
    representationType: plan.representationType ?? null,
    renderConstraints: plan.renderConstraints ?? null,
    budget: plan.budget ?? null
  };
}

function compactQuestionPlanGate(gate) {
  if (!gate || typeof gate !== 'object') return null;
  return {
    policyVersion: gate.policyVersion ?? null,
    schemaVersion: gate.schemaVersion ?? null,
    enabled: Boolean(gate.enabled),
    applicable: Boolean(gate.applicable),
    cellAllowed: Boolean(gate.cellAllowed),
    mode: gate.mode ?? null,
    generationAllowed: Boolean(gate.generationAllowed),
    productionImpact: gate.productionImpact ?? null,
    providerImpact: gate.providerImpact ?? null,
    subject: gate.subject ?? null,
    productionCellId: gate.productionCellId ?? null,
    targetDifficulty: gate.targetDifficulty ?? null,
    taskFamily: gate.taskFamily ?? null,
    planTemplate: gate.planTemplate ?? null,
    validation: gate.validation ?? null,
    targetProfileCompatibility: gate.targetProfileCompatibility ?? null,
    reasonCodes: Array.isArray(gate.reasonCodes) ? gate.reasonCodes : []
  };
}

function compactQuestionPlanAttempt(attempt) {
  if (!attempt || typeof attempt !== 'object') return null;
  return {
    lifecycleVersion: attempt.lifecycleVersion ?? null,
    policyVersion: attempt.policyVersion ?? null,
    schemaVersion: attempt.schemaVersion ?? null,
    phase: attempt.phase ?? null,
    status: attempt.status ?? null,
    planSource: attempt.planSource ?? null,
    planTemplate: attempt.planTemplate ?? null,
    taskFamily: attempt.taskFamily ?? null,
    budget: attempt.budget ?? null,
    route: attempt.route ?? null,
    productionImpact: attempt.productionImpact ?? null,
    providerImpact: attempt.providerImpact ?? null
  };
}

function promptContractRequiredPhrasesFor({ questionPlan, targetProfile }) {
  const renderConstraints = questionPlan.renderConstraints && typeof questionPlan.renderConstraints === 'object'
    ? questionPlan.renderConstraints
    : {};
  const planTemplate = cleanText(questionPlan.planTemplate);
  const difficulty = cleanText(questionPlan.targetDifficulty).toLowerCase();
  const taskFamily = cleanText(questionPlan.taskFamily);
  const phrases = [
    'A validated subject-practice QuestionPlan is provided',
    'renderConstraints win'
  ];
  if (String(planTemplate).startsWith('math_') && (renderConstraints.pureMathStemOnly === true || renderConstraints.externalContextAllowed === false)) {
    phrases.push('do not add real-world contexts');
  }
  if (planTemplate === 'math_vector_complex_relation_v1') {
    if (renderConstraints.selfContainedCoordinatesOrComplexExpression === true || renderConstraints.requireVisibleCoordinateModulusDotConjugateOrAngleRelation === true) {
      phrases.push('self-contained coordinates or z=a+bi data');
    }
    if (renderConstraints.forbidHiddenDiagramDependency === true || renderConstraints.forbidLocusOrParameterChain === true || renderConstraints.forbidOneStepFormulaOnly === true || renderConstraints.forbidHardDirectMetricOnly === true) {
      phrases.push('no hidden diagram dependency');
    }
    if (renderConstraints.forbidCoordinateGeometryDistanceProjectionShell === true) {
      phrases.push('Do not convert vector/complex tasks into analytic-geometry point-line/projection shells');
    }
    if (renderConstraints.forbidOneStepFormulaOnly === true) phrases.push('no one-step formula-only item for medium/hard');
    if (difficulty === 'medium') {
      phrases.push('For math_vector_complex_relation_v1 medium');
      phrases.push('answer options should be short claims');
      phrases.push('Do not use 求/计算/find wording');
      phrases.push('no medium locus/parameter chain');
    }
    if (difficulty === 'hard') {
      phrases.push('For math_vector_complex_relation_v1 hard');
      phrases.push('A direct numeric result from only norm/modulus/dot-product equations is medium, not hard.');
    }
  }
  if (planTemplate === 'math_probability_counting_relation_v1') {
    if (/normal|正态|z[-_ ]?score|standard/i.test(`${questionPlan.topicTitle || ''} ${taskFamily}`)) {
      phrases.push('For normal-distribution probability, include N(mu,sigma^2) or standard-normal notation');
      if (difficulty === 'basic') phrases.push('For normal-distribution basic probability plans');
      if (difficulty === 'medium') phrases.push('For normal-distribution medium probability plans');
      if (difficulty === 'hard') phrases.push('For normal-distribution hard probability plans');
    } else {
      if (difficulty === 'basic') phrases.push('For basic probability, include explicit sample-space');
      if (difficulty === 'basic' && renderConstraints.forbidBasicProbabilityTargetProfileInflation === true) {
        phrases.push('For basic probability, do not obey targetProfile concept_check');
      }
      if (difficulty === 'medium') phrases.push('include two connected event/counting/probability relations');
      if (difficulty === 'hard') phrases.push('For hard probability, include case split');
      if (difficulty === 'hard' && (renderConstraints.forbidEventListOnly === true || renderConstraints.requireHardProbabilityRestrictionRoundTrip === true || Number(renderConstraints.minProbabilityReasoningLayers) >= 3)) {
        phrases.push('do not merely list events A/B/C/D');
        phrases.push('require at least three visible reasoning layers');
      }
    }
  }
  if (planTemplate === 'math_function_property_by_difficulty_v1') {
    if (difficulty === 'basic') {
      phrases.push('For function-property basic plans');
      phrases.push('treat one property rule plus one short option check as the reasoning path');
      phrases.push('do not introduce two named points, a parameter point P(a,b), or a solve-for-parameter step');
      if (renderConstraints.forbidBasicFunctionSolutionScaffold === true) {
        phrases.push('do not teach the solving procedure');
      }
      if (renderConstraints.forbidBasicFunctionMixedRadicalAndDenominatorDomain === true) {
        phrases.push('For basic function-domain plans, use either one radical constraint or one reciprocal-denominator constraint');
      }
    }
    if (difficulty === 'hard') phrases.push('For function-property hard plans');
    if (difficulty === 'hard' && (renderConstraints.forbidHardFunctionGenericConceptOnly === true || Number(renderConstraints.minHardFunctionVisibleConstraints) >= 2)) {
      phrases.push('do not ask generic function-property propositions');
      phrases.push('hard difficulty must be visible in the stem');
    }
  }
  if (planTemplate === 'math_medium_function_two_move_reasoning_v1') {
    phrases.push('For math_medium_function_two_move_reasoning_v1 medium');
    if (Number(renderConstraints.minMediumFunctionVisibleMoves) >= 2 || renderConstraints.forbidMediumFunctionPropertyStackInflation === true) {
      phrases.push('require exactly two visible moves');
      phrases.push('do not inflate into parameter inference');
    }
    if (renderConstraints.forbidMediumFunctionExternalContextWrapper === true) {
      phrases.push('do not use real-world wrappers');
    }
  }
  if (planTemplate === 'math_elementary_function_relation_v1') {
    if (difficulty === 'basic') {
      phrases.push('For math_elementary_function_relation_v1 basic');
      phrases.push('state exactly one concrete function');
      if (renderConstraints.requireBasicElementarySingleObjectSingleTarget === true || renderConstraints.forbidBasicElementaryTargetProfileInflation === true) {
        phrases.push('For basic elementary-function plans, use exactly one explicit exponential');
        phrases.push('Do not inflate targetProfile reading/calculation/multi-step fields');
      }
    } else {
      phrases.push('For elementary-function relation plans');
    }
    if (renderConstraints.forbidElementaryFunctionExternalContextWrapper === true) {
      phrases.push('For elementary-function plans, do not wrap exponential');
    }
    if (difficulty === 'medium' && renderConstraints.requireMediumElementaryConcreteExpressionRelation === true) {
      phrases.push('For medium elementary-function plans, require concrete exponential');
      phrases.push('do not use bare "which of the following functions" classification lists');
    }
  }
  if (planTemplate === 'math_derivative_condition_chain_v1') {
    if (difficulty === 'basic') {
      phrases.push('For math_derivative_condition_chain_v1 basic');
      if (renderConstraints.forbidBasicDerivativeComplexity === true || renderConstraints.forbidBasicDerivativeDomainTrap === true || renderConstraints.forbidPiecewiseParameterContinuityChain === true) {
        phrases.push('Do not use derivative shortcut shells');
      }
      if (renderConstraints.forbidBasicDerivativeTargetProfileInflation === true || Number(renderConstraints.maxBasicDerivativeReasoningMoves) === 1) {
        phrases.push('For basic derivative, do not obey targetProfile high-reading');
      }
    }
    if (difficulty !== 'basic') phrases.push('Do not use derivative one-step-only prompts for medium/hard');
    if (difficulty === 'medium' && (renderConstraints.forbidMediumDerivativeDefinitionOnly === true || Number(renderConstraints.minDerivativeLinkedMoves) >= 2)) {
      phrases.push('do not write definition-only differentiability or geometric-meaning questions');
      phrases.push('require exactly two visible derivative-linked moves');
    }
  }
  if (planTemplate === 'math_analytic_geometry_relation_v1') {
    if (renderConstraints.forbidDefinitionOnlyConicClassification === true) {
      phrases.push('Do not use definition-only conic classification');
    }
    if (difficulty === 'hard' && (renderConstraints.requireHardAnalyticGeometrySecondConstraint === true || renderConstraints.forbidHardAnalyticGeometryConicRelationOnly === true)) {
      phrases.push('For hard analytic-geometry plans, require a second visible tangent');
      phrases.push('direct conic equation relation alone is not hard');
    }
  }
  if (planTemplate === 'math_sequence_condition_relation_v1') {
    if (renderConstraints.forbidGenericSequenceClassification === true) {
      phrases.push('Do not ask generic arithmetic/geometric sequence classification');
    }
    if (difficulty === 'basic' && renderConstraints.forbidBasicSequenceTargetProfileInflation === true) {
      phrases.push('For basic sequence plans, do not obey targetProfile concept_check');
    }
    if (difficulty === 'basic') phrases.push('For sequence basic plans');
    if (difficulty !== 'basic') phrases.push('For sequence medium/hard plans');
  }
  if (planTemplate === 'math_statistics_relation_v1') {
    if (renderConstraints.forbidBasicMultiStatisticComparison === true || renderConstraints.forbidPureLinearTransformOnly === true || renderConstraints.forbidHardDirectCombinedVarianceOnly === true) {
      phrases.push('Do not use statistics shortcut shells');
    }
    if (difficulty === 'basic') phrases.push('For statistics basic plans');
    if (difficulty === 'medium') phrases.push('For statistics medium plans');
    if (difficulty === 'medium' && renderConstraints.requireMediumStatisticsChangedSampleOrSecondRelation === true) {
      phrases.push('For medium statistics plans, require one changed-sample');
      phrases.push('do not use pure linear transform y=ax+b as the whole item');
    }
    if (difficulty === 'hard') phrases.push('For statistics hard plans');
    if (difficulty === 'hard') phrases.push('For hard statistics plans, add a second independent condition');
    if (difficulty === 'hard' && renderConstraints.forbidHardStatisticsDirectFormulaOnly === true) {
      phrases.push('For hard statistics plans, do not rely on a direct formula-only variance');
    }
  }
  if (planTemplate === 'math_spatial_geometry_relation_v1') {
    if (renderConstraints.forbidMediumMultiPropositionSolid === true || renderConstraints.forbidHardConceptOnlyPositionStatement === true || renderConstraints.forbidHardDirectCoordinateOnly === true) {
      phrases.push('Do not use spatial-geometry shortcut shells');
    }
    if (difficulty === 'basic') phrases.push('For spatial-geometry basic plans');
    if (difficulty !== 'basic') phrases.push('For spatial-geometry medium/hard plans');
    if (difficulty === 'hard' && renderConstraints.requireHardSpatialSecondRelation === true) {
      phrases.push('For hard spatial-geometry plans, require a second visible line/plane/vector/angle/distance/volume/parameter relation');
    }
  }
  if (planTemplate === 'math_medium_exp_log_ordering_chain_v1') {
    phrases.push('For math_medium_exp_log_ordering_chain_v1 medium');
    phrases.push('compare three visible exponential/logarithmic/power/root expressions');
    phrases.push('Include the bounding evidence in the stem or explanation with at least one inequality chain');
    phrases.push('Do not turn the task into a logarithmic equation, decimal-only approximation, real-world context, or parameter problem');
  }
  if (planTemplate === 'physics_kinematics_basic_relation_v1') {
    phrases.push('For basic kinematics plans');
    phrases.push('one self-contained motion situation');
    phrases.push('exactly one direct displacement/time/velocity/acceleration relation');
    if (renderConstraints.requireUnitOrGraphEvidence === true) {
      phrases.push('with units or a complete textual s-t/v-t graph description');
    }
  }
  if (planTemplate === 'basic_ph_measurement_preparation_error_v1') {
    phrases.push('For basic pH measurement/preparation error plans');
    phrases.push('exactly one visible pH-paper or volumetric-preparation operation deviation');
    phrases.push('operation -> solution volume/concentration or H+/OH- direction -> pH higher/lower/unchanged');
    if (renderConstraints.forbidDirectPhCalculation === true) {
      phrases.push('do not turn it into direct pH arithmetic');
    }
  }
  return Array.from(new Set(phrases));
}

function promptContractPreviewFor({ subject, run, cell, blueprint, body, questionPlanPreview }) {
  if (!blueprint || !questionPlanPreview || !questionPlanPreview.questionPlan) return null;
  const blueprintConstraints = blueprint.constraints && typeof blueprint.constraints === 'object'
    ? blueprint.constraints
    : {};
  const targetProfile = body.targetProfile && typeof body.targetProfile === 'object' ? body.targetProfile : {};
  const expansion = {
    ...(blueprintConstraints.expansion && typeof blueprintConstraints.expansion === 'object' ? blueprintConstraints.expansion : {}),
    generationMode: body.generationMode,
    batchId: body.batchId,
    subjectPracticeGenerationTier: body.subjectPracticeGenerationTier,
    productionRunId: body.productionRunId,
    productionCellId: body.productionCellId,
    generationProfileId: body.generationProfileId,
    productionGapKey: body.productionGapKey,
    questionPlan: questionPlanPreview.questionPlan
  };
  const promptBlueprint = {
    id: asNumber(blueprint.id),
    subject,
    topicId: asNumber(blueprint.topicId),
    topicCode: blueprint.topicCode || cell?.topicCode || null,
    topicModule: blueprint.topicModule || null,
    topicTitle: blueprint.topicTitle || cell?.topicTitle || '',
    syllabusVersion: blueprint.syllabusVersion || run?.syllabusVersion || '2025',
    examScope: blueprint.examScope || null,
    allowedQuestionTypes: blueprint.allowedQuestionTypes || [],
    difficultyRange: blueprint.difficultyRange || [],
    excludedScope: blueprint.excludedScope || [],
    sourceLabel: blueprint.sourceLabel || null,
    sourceUrl: blueprint.sourceUrl || null,
    difficulty: blueprint.difficulty || cell?.difficultyBand || '',
    questionType: blueprint.questionType || 'single_choice',
    skill: blueprint.skill || null,
    constraints: {
      ...blueprintConstraints,
      targetProfile,
      subjectPracticeGenerationTier: body.subjectPracticeGenerationTier,
      expansion
    }
  };
  const builtPrompt = new QuestionPromptBuilderService().build(promptBlueprint);
  const systemText = cleanText(builtPrompt.messages?.[0]?.content || '');
  const rawSystemText = String(builtPrompt.messages?.[0]?.content || '');
  const rawUserText = String(builtPrompt.messages?.[1]?.content || '');
  let userPayload = {};
  try {
    userPayload = JSON.parse(builtPrompt.messages?.[1]?.content || '{}');
  } catch {
    userPayload = {};
  }
  const payloadQuestionPlan = userPayload?.expansion?.questionPlan || userPayload?.constraints?.expansion?.questionPlan || null;
  const operationalTargets = userPayload?.profileAlignmentOperationalTargets || {};
  const requiredPhrases = promptContractRequiredPhrasesFor({
    questionPlan: questionPlanPreview.questionPlan,
    targetProfile
  });
  const missingRequiredPhrases = requiredPhrases.filter((phrase) => !systemText.includes(phrase));
  const totalPromptCharacters = rawSystemText.length + rawUserText.length;
  const promptCharacterBudget = questionPromptCharacterBudgetForPlanTemplate(questionPlanPreview.questionPlan?.planTemplate);
  const promptBudgetStatus = promptCharacterBudget == null || totalPromptCharacters <= promptCharacterBudget
    ? 'passed'
    : 'exceeded';
  const selectedModel = questionGenerationModelForBlueprint(promptBlueprint);
  const reasoningPolicy = questionGenerationReasoningPolicyFor(promptBlueprint, selectedModel);
  const outputTokenCeiling = questionGenerationMaxTokensForBlueprint(promptBlueprint, selectedModel);
  const maxPromptTokenReservation = promptCharacterBudget ?? totalPromptCharacters;
  const maximumCostEstimate = new AiGatewayCostService().estimate({
    model: selectedModel,
    promptTokens: maxPromptTokenReservation,
    completionTokens: outputTokenCeiling
  });
  const guardedLowReasoning = reasoningPolicy.thinking === 'enabled'
    && reasoningPolicy.reasoningEffort === 'low'
    && reasoningPolicy.temperature == null;
  const compactBasicDirect = reasoningPolicy.thinking === 'disabled'
    && reasoningPolicy.reasoningEffort == null
    && reasoningPolicy.policyVersion === 'question-generation-reasoning-effort-v3'
    && outputTokenCeiling === 3000;
  const executionCostPolicy = {
    status: compactBasicDirect ? 'guarded_compact_non_thinking_policy_active' : guardedLowReasoning ? 'guarded_low_reasoning_policy_active' : 'provider_default_reasoning_policy',
    model: selectedModel,
    thinkingMode: reasoningPolicy.thinking ?? 'provider_default',
    reasoningEffort: reasoningPolicy.reasoningEffort ?? 'provider_default',
    temperature: reasoningPolicy.temperature ?? null,
    temperaturePolicy: reasoningPolicy.temperature == null ? 'omitted_for_thinking_mode' : 'explicit',
    outputTokenCeiling,
    reasoningPolicyVersion: reasoningPolicy.policyVersion,
    reasoningPolicyReason: reasoningPolicy.reason,
    costReservation: maximumCostEstimate ? {
      policyVersion: 'guarded-observation-cost-reservation-v1',
      accountingBasis: 'prompt_characters_as_conservative_input_token_upper_bound_plus_full_output_token_ceiling',
      maximumReservedCostUsd: maximumCostEstimate.estimatedCostUsd,
      maxPromptTokenReservation,
      maxCompletionTokenReservation: outputTokenCeiling,
      pricing: maximumCostEstimate.pricing
    } : null
  };
  return {
    productionImpact: 'none_prompt_preview_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'none_uses_already_loaded_preview_data',
    promptVersion: builtPrompt.metadata?.promptVersion ?? null,
    messageCount: Array.isArray(builtPrompt.messages) ? builtPrompt.messages.length : null,
    systemPromptLength: rawSystemText.length,
    userPromptLength: rawUserText.length,
    totalPromptCharacters,
    promptCharacterBudget,
    promptBudgetStatus,
    executionCostPolicy,
    promptAudit: builtPrompt.metadata?.promptAudit ?? null,
    userPayloadHasQuestionPlan: Boolean(payloadQuestionPlan),
    userPayloadQuestionPlanTaskFamily: payloadQuestionPlan?.taskFamily ?? null,
    userPayloadQuestionPlanTemplate: payloadQuestionPlan?.planTemplate ?? null,
    conflictResolution: operationalTargets.conflictResolution ?? null,
    promptLengthTarget: operationalTargets.promptLength ?? null,
    requiredPhrases,
    missingRequiredPhrases,
    status: missingRequiredPhrases.length === 0 && Boolean(payloadQuestionPlan) && promptBudgetStatus === 'passed'
      ? 'passed'
      : 'needs_attention'
  };
}

function questionPlanPreviewFor({ subject, cell, blueprint, targetProfile }) {
  const cellId = asNumber(cell && cell.id);
  const topicId = asNumber(cell && cell.topicId) || asNumber(blueprint && blueprint.topicId) || null;
  const topicTitle = cleanText(cell && cell.topicTitle);
  const targetDifficulty = cleanText(cell && cell.difficultyBand || blueprint && blueprint.difficulty);
  const storedSchedulerHint = targetProfile && targetProfile.schedulerHint && typeof targetProfile.schedulerHint === 'object'
    ? targetProfile.schedulerHint
    : {};
  const rawSchedulerHint = cleanText(storedSchedulerHint.preferredFamily)
    ? storedSchedulerHint
    : subjectPracticeBuildSchedulerHint({
      subject,
      topicTitle,
      difficulty: targetDifficulty,
      targetProfile,
      recentAcceptedFamilies: [],
      recentCandidateFamilies: [],
      recentDeliveryFailedFamilies: []
    }) ?? {};
  const baseInput = {
    subject,
    topicId,
    topicTitle,
    productionCellId: cellId || null,
    targetDifficulty
  };
  const basePlan = buildSubjectPracticeQuestionPlan(baseInput);
  const rawSchedulerFamily = cleanText(rawSchedulerHint.preferredFamily);
  const schedulerHint = rawSchedulerFamily && basePlan && subjectPracticeQuestionPlanSupportsTaskFamily(basePlan, rawSchedulerFamily)
    ? rawSchedulerHint
    : {};
  const rejectedSchedulerHint = rawSchedulerFamily && !schedulerHint.preferredFamily
    ? {
      preferredFamily: rawSchedulerFamily,
      reason: basePlan ? 'preferred_family_not_supported_by_question_plan' : 'base_question_plan_missing',
      basePlanTaskFamily: basePlan && basePlan.taskFamily ? basePlan.taskFamily : null,
      basePlanTemplate: basePlan && basePlan.planTemplate ? basePlan.planTemplate : null
    }
    : null;
  const rawTaskFamilyHint = cleanText(schedulerHint.preferredFamily || (targetProfile && targetProfile.taskFamily) || (targetProfile && targetProfile.preferredFamily));
  const taskFamilyHint = rawTaskFamilyHint && basePlan && subjectPracticeQuestionPlanSupportsTaskFamily(basePlan, rawTaskFamilyHint)
    ? rawTaskFamilyHint
    : '';
  const hintedPlan = taskFamilyHint
    ? buildSubjectPracticeQuestionPlan({ ...baseInput, taskFamily: taskFamilyHint })
    : null;
  const questionPlan = hintedPlan ?? basePlan;
  const currentGate = subjectPracticeQuestionPlanGateFor({
    ...baseInput,
    taskFamily: questionPlan && questionPlan.taskFamily,
    planTemplate: questionPlan && questionPlan.planTemplate,
    questionPlan,
    targetProfile
  });
  const exactObservationEnv = {
    ...process.env,
    [SUBJECT_PRACTICE_QUESTION_PLAN_FEATURE_FLAG]: 'true',
    [SUBJECT_PRACTICE_QUESTION_PLAN_CELL_ALLOWLIST_FLAG]: String(cellId || '')
  };
  const exactObservationGate = subjectPracticeQuestionPlanGateFor({
    ...baseInput,
    taskFamily: questionPlan && questionPlan.taskFamily,
    planTemplate: questionPlan && questionPlan.planTemplate,
    questionPlan,
    targetProfile,
    env: exactObservationEnv
  });
  const exactObservationAttempt = subjectPracticeQuestionPlanAttemptFor({
    phase: 'enqueue',
    gate: exactObservationGate,
    questionPlan
  });
  return {
    productionImpact: 'none_preview_only',
    providerImpact: 'none_no_provider_call',
    dbImpact: 'read_only_preview',
    source: hintedPlan
      ? (cleanText(storedSchedulerHint.preferredFamily) ? 'stored_scheduler_hint_when_compatible' : 'scheduler_hint_dry_run_when_compatible')
      : rawSchedulerFamily
        ? 'policy_template_fallback_incompatible_scheduler_hint'
      : 'policy_template_fallback',
    schedulerHint: taskFamilyHint ? schedulerHint : null,
    rejectedSchedulerHint,
    questionPlan: compactQuestionPlan(questionPlan),
    currentEnvGate: compactQuestionPlanGate(currentGate),
    exactObservationGate: compactQuestionPlanGate(exactObservationGate),
    exactObservationAttempt: compactQuestionPlanAttempt(exactObservationAttempt)
  };
}

function difficultyAliases(value) {
  const difficulty = cleanText(value).toLowerCase();
  if (difficulty === 'basic' || difficulty === '基础') return ['basic', '基础'];
  if (difficulty === 'medium' || difficulty === '中等') return ['medium', '中等'];
  if (difficulty === 'hard' || difficulty === '困难' || difficulty === '高难') return ['hard', '困难', '高难'];
  return difficulty ? [difficulty] : [];
}

function openCountFor(cell) {
  return Math.max(0, asNumber(cell.targetCount) - Math.max(
    asNumber(cell.publishedCount),
    asNumber(cell.formalPublishedQuestionCount),
    asNumber(cell.reconciledPublishedCount)
  ));
}

function subjectPracticeActiveJobLimit() {
  const value = Number(process.env.CSCA_SUBJECT_PRACTICE_ACTIVE_JOB_LIMIT || process.env.AI_GATEWAY_BACKGROUND_CONCURRENCY || 1);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.min(12, Math.round(value))) : 1;
}

function compactCell(cell, activeJobs = [], blueprints = []) {
  return {
    id: asNumber(cell.id),
    subject: cell.subject,
    topicId: asNumber(cell.topicId),
    topicTitle: cell.topicTitle,
    difficultyBand: cell.difficultyBand,
    openCount: openCountFor(cell),
    storedPublishedCount: asNumber(cell.publishedCount),
    formalPublishedQuestionCount: asNumber(cell.formalPublishedQuestionCount),
    reconciledPublishedCount: Math.max(
      asNumber(cell.publishedCount),
      asNumber(cell.formalPublishedQuestionCount),
      asNumber(cell.reconciledPublishedCount)
    ),
    candidateCount: asNumber(cell.candidateCount),
    failedCount: asNumber(cell.failedCount),
    status: cell.status,
    activeJobs: activeJobs.map((job) => ({ id: asNumber(job.id), status: job.status })),
    activeBlueprintIds: blueprints.map((blueprint) => asNumber(blueprint.id))
  };
}

function selectBlueprintForCell(cell, blueprints) {
  const aliases = difficultyAliases(cell.difficultyBand);
  const matching = blueprints.filter((blueprint) => aliases.includes(cleanText(blueprint.difficulty).toLowerCase()));
  const candidates = matching.length ? matching : blueprints;
  return candidates.slice().sort((left, right) => {
    const leftSource = cleanText(left.source) === 'topic_health_action' ? 0 : 1;
    const rightSource = cleanText(right.source) === 'topic_health_action' ? 0 : 1;
    return leftSource - rightSource || asNumber(right.id) - asNumber(left.id);
  })[0] || null;
}

async function requestJson(baseUrl, path, token, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

async function adminToken(baseUrl) {
  const configured = process.env.CSCA_OBSERVATION_ADMIN_TOKEN || process.env.CSCA_READINESS_EVIDENCE_TOKEN;
  if (configured) return configured;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) throw new Error('Admin token or ADMIN_BOOTSTRAP_EMAIL/PASSWORD is required.');
  const login = await requestJson(baseUrl, '/api/v1/auth/login', '', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  const token = login.tokens && login.tokens.accessToken;
  if (!token) throw new Error('Admin login did not return an access token.');
  return token;
}

async function loadCell(prisma, cellId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT cell.id, cell.run_id AS "runId", cell.subject, cell.topic_id AS "topicId",
            cell.topic_title AS "topicTitle", cell.difficulty_band AS "difficultyBand",
            cell.target_count AS "targetCount", cell.published_count AS "publishedCount",
            COALESCE(formal."formalPublishedQuestionCount", 0)::int AS "formalPublishedQuestionCount",
            GREATEST(cell.published_count, COALESCE(formal."formalPublishedQuestionCount", 0))::int AS "reconciledPublishedCount",
            cell.candidate_count AS "candidateCount", cell.failed_count AS "failedCount",
            cell.target_profile AS "targetProfile", cell.status
       FROM csca_subject_practice_production_cells cell
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS "formalPublishedQuestionCount"
           FROM csca_questions q
          WHERE q.subject = cell.subject
            AND q.status = 'approved'
            AND q.generation_metadata->>'productionRunId' = cell.run_id::text
            AND q.generation_metadata->>'productionCellId' = cell.id::text
            AND q.review_metadata->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
            AND q.review_metadata->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
       ) formal ON true
      WHERE cell.id = $1`,
    cellId
  );
  return rows[0] || null;
}

async function loadOpenCells(prisma, runId, subject) {
  return prisma.$queryRawUnsafe(
    `SELECT *
       FROM (
         SELECT cell.id, cell.run_id AS "runId", cell.subject, cell.topic_id AS "topicId",
                cell.topic_title AS "topicTitle", cell.difficulty_band AS "difficultyBand",
                cell.target_count AS "targetCount", cell.published_count AS "publishedCount",
                COALESCE(formal."formalPublishedQuestionCount", 0)::int AS "formalPublishedQuestionCount",
                GREATEST(cell.published_count, COALESCE(formal."formalPublishedQuestionCount", 0))::int AS "reconciledPublishedCount",
                cell.candidate_count AS "candidateCount", cell.failed_count AS "failedCount",
                cell.target_profile AS "targetProfile", cell.status
           FROM csca_subject_practice_production_cells cell
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS "formalPublishedQuestionCount"
               FROM csca_questions q
              WHERE q.subject = cell.subject
                AND q.status = 'approved'
                AND q.generation_metadata->>'productionRunId' = cell.run_id::text
                AND q.generation_metadata->>'productionCellId' = cell.id::text
                AND q.review_metadata->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
                AND q.review_metadata->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
           ) formal ON true
          WHERE cell.run_id = $1 AND cell.subject = $2
       ) scoped
      WHERE "targetCount" > "reconciledPublishedCount"
      ORDER BY ("targetCount" - "reconciledPublishedCount") DESC, "failedCount" DESC, id ASC`,
    runId,
    subject
  );
}

async function loadActiveJobsForCell(prisma, runId, cellId) {
  return prisma.$queryRawUnsafe(
    'SELECT id, status, question_id AS "questionId", provider, model, updated_at AS "updatedAt" FROM csca_ai_generation_jobs WHERE prompt_metadata->>\'productionRunId\' = $1 AND prompt_metadata->>\'productionCellId\' = $2 AND status IN (\'queued\', \'running\') ORDER BY id ASC',
    String(runId),
    String(cellId)
  );
}

async function loadActiveBlueprintsForCell(prisma, subject, topicId) {
  return prisma.$queryRawUnsafe(
    `SELECT bp.id,
            bp.subject,
            bp.topic_id AS "topicId",
            topic.code AS "topicCode",
            topic.module AS "topicModule",
            topic.title AS "topicTitle",
            topic.syllabus_version AS "syllabusVersion",
            topic.exam_scope AS "examScope",
            topic.allowed_question_types AS "allowedQuestionTypes",
            topic.difficulty_range AS "difficultyRange",
            topic.excluded_scope AS "excludedScope",
            topic.source_label AS "sourceLabel",
            topic.source_url AS "sourceUrl",
            bp.difficulty,
            bp.question_type AS "questionType",
            bp.skill,
            bp.source,
            bp.constraints,
            bp.status
       FROM csca_question_blueprints bp
       JOIN csca_exam_topics topic ON topic.id = bp.topic_id
      WHERE bp.subject = $1 AND bp.topic_id = $2 AND bp.status = 'active'
      ORDER BY bp.id ASC`,
    subject,
    topicId
  );
}

async function loadRunActiveJobs(prisma, runId, subject) {
  return prisma.$queryRawUnsafe(
    'SELECT job.id, job.status, job.prompt_metadata->>\'productionCellId\' AS "productionCellId", bp.subject, bp.topic_id AS "topicId", topic.title AS "topicTitle" FROM csca_ai_generation_jobs job JOIN csca_question_blueprints bp ON bp.id = job.blueprint_id JOIN csca_exam_topics topic ON topic.id = bp.topic_id WHERE job.prompt_metadata->>\'productionRunId\' = $1 AND bp.subject = $2 AND job.status IN (\'queued\', \'running\') ORDER BY job.id ASC',
    String(runId),
    subject
  );
}

async function loadActiveGenerationProfile(prisma, subject, syllabusVersion) {
  if (!subject || !syllabusVersion) return null;
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, subject, syllabus_version AS "syllabusVersion", use_case AS "useCase", title, series_profile_id AS "seriesProfileId", source_style_profile_id AS "sourceStyleProfileId", sample_size AS "sampleSize", confidence, status, generated_at AS "generatedAt", updated_at AS "updatedAt" FROM csca_generation_profiles WHERE subject = $1 AND syllabus_version = $2 AND use_case = $3 AND status = $4 ORDER BY generated_at DESC, id DESC LIMIT 1',
    subject,
    syllabusVersion,
    'subject_practice',
    'active'
  );
  return rows[0] || null;
}

async function selectTarget({ prisma, subject, runId, requestedCellId, requestedBlueprintId }) {
  const consideredCells = [];
  const explicitCell = requestedCellId ? await loadCell(prisma, requestedCellId) : null;
  const cells = explicitCell ? [explicitCell] : await loadOpenCells(prisma, runId, subject);
  for (const cell of cells) {
    const activeJobs = await loadActiveJobsForCell(prisma, runId, asNumber(cell.id));
    const blueprints = await loadActiveBlueprintsForCell(prisma, subject, asNumber(cell.topicId));
    const selectedBlueprint = requestedBlueprintId
      ? blueprints.find((blueprint) => asNumber(blueprint.id) === requestedBlueprintId) || null
      : selectBlueprintForCell(cell, blueprints);
    const compact = {
      ...compactCell(cell, activeJobs, blueprints),
      selectedBlueprintId: selectedBlueprint ? asNumber(selectedBlueprint.id) : null,
      selectable: openCountFor(cell) > 0 && activeJobs.length === 0 && Boolean(selectedBlueprint)
    };
    consideredCells.push(compact);
    if (explicitCell || compact.selectable) {
      return { cell, activeJobs, blueprints, blueprint: selectedBlueprint, consideredCells };
    }
  }
  return { cell: explicitCell, activeJobs: [], blueprints: [], blueprint: null, consideredCells };
}

function compactJob(job) {
  const metadata = job && job.promptMetadata && typeof job.promptMetadata === 'object' ? job.promptMetadata : {};
  const gate = metadata.questionPlanGate && typeof metadata.questionPlanGate === 'object' ? metadata.questionPlanGate : null;
  const attempt = metadata.questionPlanAttempt && typeof metadata.questionPlanAttempt === 'object' ? metadata.questionPlanAttempt : null;
  return {
    id: job.id,
    status: job.status,
    blueprintId: job.blueprintId,
    subject: job.subject,
    topicId: job.topicId,
    topicTitle: job.topicTitle,
    productionRunId: metadata.productionRunId ?? null,
    productionCellId: metadata.productionCellId ?? null,
    generationProfileId: metadata.generationProfileId ?? null,
    productionGapKey: metadata.productionGapKey ?? null,
    questionPlanGate: gate ? {
      mode: gate.mode,
      enabled: gate.enabled,
      applicable: gate.applicable,
      cellAllowed: gate.cellAllowed,
      generationAllowed: gate.generationAllowed,
      taskFamily: gate.taskFamily,
      planTemplate: gate.planTemplate
    } : null,
    questionPlanAttempt: attempt ? {
      status: attempt.status,
      taskFamily: attempt.taskFamily,
      planTemplate: attempt.planTemplate
    } : null
  };
}

async function main() {
  loadProjectEnv();
  const subject = argValue('subject', 'chemistry');
  const runId = positiveInt('run', 200);
  const requestedCellId = positiveInt('cell', 0);
  const requestedBlueprintId = positiveInt('blueprint', 0);
  const baseUrl = argValue('base-url', process.env.CSCA_OBSERVATION_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
  const apply = hasFlag('apply');
  const prisma = new PrismaClient();
  try {
    const [run] = await prisma.$queryRawUnsafe(
      'SELECT id, subject, status, plan, syllabus_version AS "syllabusVersion" FROM csca_subject_practice_production_runs WHERE id = $1',
      runId
    );
    const selection = await selectTarget({ prisma, subject, runId, requestedCellId, requestedBlueprintId });
    const { cell, blueprint, activeJobs, consideredCells } = selection;
    const cellId = asNumber(cell && cell.id);
    const blueprintId = asNumber(blueprint && blueprint.id);
    const requestedGenerationProfileId = positiveInt('generation-profile', 0);
    const runGenerationProfileId = Number(run && run.plan && run.plan.generationProfileLineage && run.plan.generationProfileLineage.generationProfileId) || 0;
    const activeGenerationProfile = requestedGenerationProfileId || runGenerationProfileId
      ? null
      : await loadActiveGenerationProfile(prisma, subject, run && run.syllabusVersion);
    const activeGenerationProfileId = asNumber(activeGenerationProfile && activeGenerationProfile.id);
    const generationProfileId = requestedGenerationProfileId || runGenerationProfileId || activeGenerationProfileId;
    const generationProfileSource = requestedGenerationProfileId
      ? 'operator_argument'
      : runGenerationProfileId
        ? 'run_generation_profile_lineage'
        : activeGenerationProfileId
          ? 'active_subject_practice_generation_profile'
          : 'missing';
    const failures = [];
    if (!run) failures.push('run_missing');
    if (!cell) failures.push('cell_missing');
    if (!blueprint) failures.push('blueprint_missing');
    if (run && cleanText(run.status).toLowerCase() !== 'running') failures.push(`run_not_running:${run.status}`);
    if (run && run.subject !== subject) failures.push(`run_subject_mismatch:${run.subject}`);
    if (cell && cell.runId !== runId) failures.push(`cell_run_mismatch:${cell.runId}`);
    if (cell && cell.subject !== subject) failures.push(`cell_subject_mismatch:${cell.subject}`);
    if (cell && !(Number(cell.targetCount) > Number(cell.publishedCount))) failures.push('cell_has_no_open_capacity');
    if (blueprint && blueprint.subject !== subject) failures.push(`blueprint_subject_mismatch:${blueprint.subject}`);
    if (blueprint && cell && Number(blueprint.topicId) !== Number(cell.topicId)) failures.push(`blueprint_topic_mismatch:${blueprint.topicId}`);
    if (blueprint && requestedBlueprintId && Number(blueprint.id) !== requestedBlueprintId) failures.push(`blueprint_id_mismatch:${blueprint.id}`);
    if (blueprint && blueprint.status !== 'active') failures.push(`blueprint_not_active:${blueprint.status}`);
    if (activeJobs.length) failures.push(`cell_already_has_active_job:${activeJobs.map((job) => job.id).join(',')}`);
    if (!generationProfileId) failures.push('generation_profile_id_missing');

    const storedTargetProfile = cell && cell.targetProfile && typeof cell.targetProfile === 'object' ? cell.targetProfile : {};
    const targetProfile = cell && Object.keys(storedTargetProfile).length
      ? normalizeSubjectPracticeProductionTargetProfile({
        subject,
        topicId: asNumber(cell.topicId),
        topicTitle: cleanText(cell.topicTitle),
        targetProfile: storedTargetProfile
      })
      : storedTargetProfile;
    const questionPlanPreview = questionPlanPreviewFor({ subject, cell, blueprint, targetProfile });
    if (questionPlanPreview.exactObservationGate && questionPlanPreview.exactObservationGate.generationAllowed !== true) {
      const planReasons = Array.isArray(questionPlanPreview.exactObservationGate.reasonCodes)
        ? questionPlanPreview.exactObservationGate.reasonCodes
        : [];
      failures.push(`question_plan_not_ready:${planReasons.join(',') || 'unknown'}`);
    }
    const body = {
      blueprintIds: [blueprintId],
      limit: 1,
      force: true,
      expand: true,
      count: 1,
      perBlueprint: 1,
      batchId: `subject-production-${runId}-${cellId}-${Date.now()}`,
      generationMode: 'subject_practice_production_matrix',
      subjectPracticeGenerationTier: 'standard',
      productionRunId: runId,
      productionCellId: cellId,
      generationProfileId,
      productionGapKey: targetProfile.gapKey || null,
      targetProfile
    };

    const report = {
      mode: apply ? 'exact_subject_practice_cell_enqueue_apply' : 'exact_subject_practice_cell_enqueue_preview',
      productionImpact: apply ? 'one_queued_generation_job_db_write_if_confirmed' : 'none_preview_only',
      providerImpact: 'none_no_provider_call',
      dbImpact: apply ? 'writes_one_generation_job_if_confirmed' : 'read_only_preview',
      requested: {
        subject,
        runId,
        runStatus: run ? cleanText(run.status) : null,
        cellId: requestedCellId || null,
        blueprintId: requestedBlueprintId || null,
        generationProfileId,
        generationProfileSource,
        hasGenerationProfileLineage: Boolean(runGenerationProfileId),
        hasActiveGenerationProfileFallback: Boolean(activeGenerationProfileId),
        activeGenerationProfile: activeGenerationProfile ? {
          id: asNumber(activeGenerationProfile.id),
          subject: activeGenerationProfile.subject,
          syllabusVersion: activeGenerationProfile.syllabusVersion,
          useCase: activeGenerationProfile.useCase,
          title: activeGenerationProfile.title,
          sampleSize: asNumber(activeGenerationProfile.sampleSize),
          confidence: activeGenerationProfile.confidence,
          status: activeGenerationProfile.status,
          generatedAt: activeGenerationProfile.generatedAt,
          updatedAt: activeGenerationProfile.updatedAt
        } : null
      },
      selection: {
        mode: requestedCellId ? 'explicit_cell' : 'auto_next_open_cell',
        requestedCellId: requestedCellId || null,
        requestedBlueprintId: requestedBlueprintId || null,
        selectedCellId: cellId || null,
        selectedBlueprintId: blueprintId || null,
        rationale: requestedCellId
          ? 'operator_supplied_cell_with_auto_blueprint_when_blueprint_omitted'
      : 'largest_reconciled_open_cell_without_queued_or_running_job_and_with_active_matching_blueprint',
        consideredCells
      },
      questionPlanPreview,
      promptContractPreview: null,
      dispatchCapacity: null,
      preflight: {
        status: failures.length ? 'not_ready' : 'ready_for_exact_cell_enqueue',
        failures,
        activeJobs: activeJobs.map((job) => ({ id: job.id, status: job.status }))
      },
      enqueueBody: body,
      result: null
    };
    if (hasFlag('include-prompt-contract')) {
      report.promptContractPreview = promptContractPreviewFor({
        subject,
        run,
        cell,
        blueprint,
        body,
        questionPlanPreview
      });
    }
    const activeJobLimit = subjectPracticeActiveJobLimit();
    const runActiveJobs = await loadRunActiveJobs(prisma, runId, subject);
    const activeProductionCellIds = Array.from(new Set(
      runActiveJobs.map((job) => asNumber(job.productionCellId)).filter((value) => value > 0)
    )).sort((left, right) => left - right);
    report.dispatchCapacity = {
      activeJobLimit,
      activeProductionJobCount: activeProductionCellIds.length,
      activeCapacityRemaining: Math.max(0, activeJobLimit - activeProductionCellIds.length),
      activeCapacityStatus: activeProductionCellIds.length >= activeJobLimit ? 'active_capacity_exhausted_by_existing_jobs' : 'capacity_available',
      activeJobs: runActiveJobs.map((job) => ({
        id: asNumber(job.id),
        status: job.status,
        productionCellId: asNumber(job.productionCellId),
        topicTitle: job.topicTitle
      }))
    };
    if (activeProductionCellIds.length >= activeJobLimit) {
      failures.push('active_capacity_exhausted_by_existing_jobs');
      report.preflight.status = 'not_ready';
    }

    if (apply) {
      if (!hasFlag('confirm-exact-cell-enqueue')) throw new Error('Apply requires --confirm-exact-cell-enqueue.');
      if (argValue('confirm-cell') !== String(cellId)) throw new Error(`Apply requires --confirm-cell=${cellId}.`);
      if (failures.length) throw new Error(`Preflight not ready: ${failures.join(', ')}`);
      const token = await adminToken(baseUrl);
      const result = await requestJson(baseUrl, '/api/v1/admin/ai-questioning/generation-jobs/enqueue', token, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      report.result = {
        requested: result.requested,
        requestedJobs: result.requestedJobs,
        enqueued: result.enqueued,
        skipped: result.skipped,
        mode: result.mode,
        batchId: result.batchId,
        items: Array.isArray(result.items) ? result.items.map(compactJob) : []
      };
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
