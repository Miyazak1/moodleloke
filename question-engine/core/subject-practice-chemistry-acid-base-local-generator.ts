import {
  GeneratedQuestionCandidate,
  QuestionGenerationBlueprint,
  QuestionOption,
  SubjectPracticeQuestionPlanAdherence,
  SubjectPracticeQuestionPlanPorts,
  SubjectPracticeScenarioBlueprintShadowContext,
  SubjectPracticeScenarioValidation
} from './types';
import {
  solveSubjectPracticeChemistryAcidBase,
  SubjectPracticeChemistryAcidBaseSolverEvidence
} from './subject-practice-chemistry-acid-base-solver';

export const SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION = 'chemistry-strong-acid-base-local-generator-v5-bounded-plausible-values';

type RelationKind = 'strong_acid_dilution' | 'strong_base_dilution' | 'strong_acid_base_neutralization';
type AnswerTarget = 'ph_value' | 'acid_base_character';
type Character = 'acidic' | 'neutral' | 'basic';
type BilingualOption = { zh: string; en: string; intent: string };

export type SubjectPracticeChemistryAcidBaseLocalGenerationResult = {
  generatorVersion: string;
  status: 'generated_and_self_verified' | 'unsupported_question_plan' | 'self_verification_failed';
  candidate: GeneratedQuestionCandidate | null;
  verification: SubjectPracticeChemistryAcidBaseSolverEvidence | null;
  adherence: SubjectPracticeQuestionPlanAdherence | null;
  seed: number;
  relationKind: RelationKind;
  answerTarget: AnswerTarget;
  scopeId: string | null;
  providerImpact: 'none_no_provider_call';
  estimatedCostUsd: 0;
  productionImpact: 'none_shadow_only';
  reasonCodes: string[];
  scenarioRenderMode: 'controlled_catalog' | 'provisional_blueprint_shadow' | 'provisional_blueprint_shadow_rejected';
  provisionalScenarioContractDigest: string | null;
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedSeed(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.trunc(number)) : 0;
}

function pick<T>(values: T[], index: number) {
  return values[((index % values.length) + values.length) % values.length];
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function characterForPh(ph: number): Character {
  if (Math.abs(ph - 7) < 1e-9) return 'neutral';
  return ph < 7 ? 'acidic' : 'basic';
}

function buildOptions(options: BilingualOption[], correctIndex: number) {
  const correct = options[0];
  const ordered = options.slice(1);
  ordered.splice(correctIndex, 0, correct);
  const zh: QuestionOption[] = ordered.map((option, index) => ({ id: String.fromCharCode(65 + index), text: option.zh }));
  const en: QuestionOption[] = ordered.map((option, index) => ({ id: String.fromCharCode(65 + index), text: option.en }));
  return {
    zh,
    en,
    correctAnswer: zh[correctIndex].id,
    optionMetadata: ordered.map((option, index) => ({
      optionId: zh[index].id,
      ...(option === correct ? {} : { distractorIntent: option.intent }),
      misconceptionTags: option === correct ? [] : [option.intent]
    }))
  };
}

function numericOptions(expected: number, correctIndex: number) {
  const value = rounded(expected);
  const candidates = [value, value + 0.5, value - 0.5, value + 1, value - 1, 7, 14 - value]
    .map(rounded)
    .filter((item) => item >= 0 && item <= 14);
  const unique = [...new Set(candidates)];
  if (unique.length < 4) return null;
  return buildOptions(unique.slice(0, 4).map((item, index) => ({
    zh: `所得溶液的 pH 为 ${item}`,
    en: `The resulting solution has pH ${item}.`,
    intent: index === 0 ? 'correct_ph' : `ph_offset_distractor_${index}`
  })), correctIndex);
}

function characterOptions(expected: Character, correctIndex: number) {
  const labels = {
    acidic: { zh: '溶液呈酸性', en: 'The solution is acidic.' },
    neutral: { zh: '溶液呈中性', en: 'The solution is neutral.' },
    basic: { zh: '溶液呈碱性', en: 'The solution is basic.' }
  };
  const correct = labels[expected];
  return buildOptions([
    { ...correct, intent: 'correct_acid_base_character' },
    ...Object.entries(labels).filter(([key]) => key !== expected).map(([key, value]) => ({ ...value, intent: `wrong_character_${key}` })),
    { zh: '无法判断', en: 'It cannot be determined.', intent: 'unnecessary_indeterminate_answer' }
  ], correctIndex);
}

function candidateFor(input: {
  blueprint: QuestionGenerationBlueprint;
  questionPlan: unknown;
  relationKind: RelationKind;
  answerTarget: AnswerTarget;
  seed: number;
  scenarioContractOverride?: unknown;
}): GeneratedQuestionCandidate | null {
  const { blueprint, relationKind, answerTarget, seed } = input;
  const plan = recordFrom(input.questionPlan);
  const scenario = recordFrom(plan?.scenarioContract);
  const scenarioOverride = recordFrom(input.scenarioContractOverride);
  const surface = recordFrom(scenarioOverride?.surface) ?? recordFrom(scenario?.surface);
  const entityZh = clean(surface?.zhEntity) || '溶液样品';
  const entityEn = clean(surface?.enEntity) || 'solution sample';
  const settingZh = clean(surface?.zhSetting) || '定量酸碱操作';
  const settingEn = clean(surface?.enSetting) || 'a quantitative acid-base operation';
  const contextActionEn = clean(scenarioOverride?.contextAction);
  const informationFormEn = clean(scenarioOverride?.informationForm);
  const questionPurposeEn = clean(scenarioOverride?.questionPurpose);
  const scenarioIntroZh = scenarioOverride
    ? `记录显示工作人员在${settingZh}对${entityZh}执行了定量操作。为判断该处理结果，`
    : '';
  const scenarioIntroEn = scenarioOverride
    ? `The ${informationFormEn} records how staff ${contextActionEn}. To ${questionPurposeEn}, `
    : '';
  const correctIndex = seed % 4;
  let prompt = '';
  let promptEn = '';
  let explanation = '';
  let explanationEn = '';
  let expectedPh = 7;

  if (relationKind === 'strong_acid_dilution' || relationKind === 'strong_base_dilution') {
    const acid = relationKind === 'strong_acid_dilution';
    const speciesZh = acid ? pick(['盐酸', '硝酸'], seed) : pick(['氢氧化钠', '氢氧化钾'], seed);
    const speciesEn = acid ? (speciesZh === '盐酸' ? 'HCl' : 'HNO3') : (speciesZh === '氢氧化钠' ? 'NaOH' : 'KOH');
    const concentration = pick([0.01, 0.02, 0.04, 0.05, 0.08, 0.1, 0.2, 0.5], Math.floor(seed / 2));
    const initialVolume = pick([5, 10, 20, 25, 40, 50], Math.floor(seed / 16));
    const factor = pick([10, 20, 25, 50, 100], Math.floor(seed / 96));
    const finalVolume = initialVolume * factor;
    const finalConcentration = concentration / factor;
    expectedPh = acid ? -Math.log10(finalConcentration) : 14 + Math.log10(finalConcentration);
    const questionZh = answerTarget === 'ph_value' ? 'pH 约为' : '所得溶液的酸碱性如何？';
    const questionEn = answerTarget === 'ph_value' ? 'What is the approximate pH?' : 'What is the acid-base character of the resulting solution?';
    prompt = `${scenarioIntroZh}需要判断${entityZh}完成稀释后的结果。在${settingZh}中，目标终体积为 ${finalVolume} mL；取样体积为 ${initialVolume} mL，样品浓度为 ${concentration} mol/L ${speciesZh}。以水补足至目标刻度，假定 25°C 且溶质完全电离，${questionZh}`;
    promptEn = `${scenarioIntroEn}determine the result after processing the ${entityEn}. During ${settingEn}, the target final volume is ${finalVolume} mL. A ${initialVolume} mL portion with concentration ${concentration} mol/L ${speciesEn} is brought to that mark with water. Assume complete dissociation at 25°C. ${questionEn}`;
    const characterZh = expectedPh < 7 ? '酸性' : expectedPh > 7 ? '碱性' : '中性';
    const characterEn = expectedPh < 7 ? 'acidic' : expectedPh > 7 ? 'basic' : 'neutral';
    explanation = acid
      ? `25°C下，c₂=c₁V₁/V₂=${concentration}×${initialVolume}/${finalVolume}=${finalConcentration} mol/L；强酸完全电离，[H+]=c₂，pH=-lg[H+]=${rounded(expectedPh)}${answerTarget === 'acid_base_character' ? `，故溶液呈${characterZh}` : ''}。`
      : `25°C下，c₂=c₁V₁/V₂=${concentration}×${initialVolume}/${finalVolume}=${finalConcentration} mol/L；强碱完全电离，[OH-]=c₂，pOH=-lg[OH-]，pH=14-pOH=${rounded(expectedPh)}${answerTarget === 'acid_base_character' ? `，故溶液呈${characterZh}` : ''}。`;
    explanationEn = acid
      ? `At 25°C, c2=c1V1/V2=${concentration}×${initialVolume}/${finalVolume}=${finalConcentration} mol/L. Complete strong-acid dissociation gives [H+]=c2 and pH=-log[H+]=${rounded(expectedPh)}${answerTarget === 'acid_base_character' ? `, so the solution is ${characterEn}` : ''}.`
      : `At 25°C, c2=c1V1/V2=${concentration}×${initialVolume}/${finalVolume}=${finalConcentration} mol/L. Complete strong-base dissociation gives [OH-]=c2, pOH=-log[OH-], and pH=14-pOH=${rounded(expectedPh)}${answerTarget === 'acid_base_character' ? `, so the solution is ${characterEn}` : ''}.`;
  } else {
    const acidConcentration = pick([0.05, 0.08, 0.1, 0.12, 0.15, 0.2], seed);
    const baseConcentration = pick([0.04, 0.06, 0.1, 0.14, 0.18, 0.25], Math.floor(seed / 6));
    const acidVolume = pick([10, 15, 20, 25, 30, 40, 50], Math.floor(seed / 36));
    let baseVolume = pick([10, 15, 20, 25, 30, 40, 50], Math.floor(seed / 252));
    let acidMoles = acidConcentration * acidVolume * 0.001;
    let baseMoles = baseConcentration * baseVolume * 0.001;
    if (Math.abs(acidMoles - baseMoles) < 1e-12) {
      baseVolume += 5;
      baseMoles = baseConcentration * baseVolume * 0.001;
    }
    const excess = acidMoles - baseMoles;
    const totalVolume = (acidVolume + baseVolume) * 0.001;
    const excessConcentration = Math.abs(excess) / totalVolume;
    expectedPh = excess > 0
      ? -Math.log10(excessConcentration)
      : 14 + Math.log10(excessConcentration);
    const questionZh = answerTarget === 'ph_value' ? '混合后 pH 是多少？' : '混合后溶液的酸碱性如何？';
    const questionEn = answerTarget === 'ph_value' ? 'What is the pH after mixing?' : 'What is the acid-base character after mixing?';
    prompt = `${scenarioIntroZh}在${settingZh}中，将作为${entityZh}的 ${acidVolume} mL ${acidConcentration} mol/L HCl 与 ${baseVolume} mL ${baseConcentration} mol/L NaOH 混合，${questionZh}`;
    promptEn = `${scenarioIntroEn}during ${settingEn}, ${acidVolume} mL of ${acidConcentration} mol/L HCl in the ${entityEn} is mixed with ${baseVolume} mL of ${baseConcentration} mol/L NaOH. ${questionEn}`;
    const characterZh = expectedPh < 7 ? '酸性' : expectedPh > 7 ? '碱性' : '中性';
    const characterEn = expectedPh < 7 ? 'acidic' : expectedPh > 7 ? 'basic' : 'neutral';
    const excessIon = excess > 0 ? 'H+' : 'OH-';
    explanation = `25°C下先分别记账：酸提供 n(H+)=${acidConcentration}×${acidVolume}/1000=${acidMoles} mol；碱提供 n(OH-)=${baseConcentration}×${baseVolume}/1000=${baseMoles} mol。两者相减后 ${excessIon} 过量，再除以合并体积，c=${Math.abs(excess)}/${totalVolume}=${excessConcentration} mol/L。最后由${excess > 0 ? 'pH=-lg[H+]' : 'pOH=-lg[OH-]，pH=14-pOH'}得到结果=${rounded(expectedPh)}${answerTarget === 'acid_base_character' ? `，故溶液呈${characterZh}` : ''}。`;
    explanationEn = `At 25°C, keep separate amount balances. The acid contributes n(H+)=${acidConcentration}×${acidVolume}/1000=${acidMoles} mol; the base contributes n(OH-)=${baseConcentration}×${baseVolume}/1000=${baseMoles} mol. Subtraction leaves excess ${excessIon}; division by the combined volume gives c=${Math.abs(excess)}/${totalVolume}=${excessConcentration} mol/L. Applying ${excess > 0 ? 'pH=-log[H+]' : 'pOH=-log[OH-] and pH=14-pOH'} gives the result=${rounded(expectedPh)}${answerTarget === 'acid_base_character' ? `, so the solution is ${characterEn}` : ''}.`;
  }

  if (!Number.isFinite(expectedPh) || expectedPh < 0 || expectedPh > 14) return null;
  const options = answerTarget === 'ph_value'
    ? numericOptions(expectedPh, correctIndex)
    : characterOptions(characterForPh(expectedPh), correctIndex);
  if (!options) return null;
  explanation = `${explanation} 因此选择 ${options.correctAnswer}。`;
  explanationEn = `${explanationEn} Therefore, choose ${options.correctAnswer}.`;
  return {
    subject: 'chemistry',
    topicId: blueprint.topicId,
    blueprintId: blueprint.id,
    sourceType: 'ai',
    designedDifficulty: 'medium',
    questionType: 'single_choice',
    prompt,
    options: options.zh,
    correctAnswer: options.correctAnswer,
    explanation,
    knowledgeTags: ['溶液浓度与pH计算', '强酸强碱', relationKind],
    optionMetadata: options.optionMetadata,
    localizations: {
      zh: { prompt, options: options.zh, explanation, knowledgeTags: ['溶液浓度与pH计算', '强酸强碱'] },
      en: { prompt: promptEn, options: options.en, explanation: explanationEn, knowledgeTags: ['Strong acid-base pH'] }
    },
    syllabusVersion: blueprint.syllabusVersion
  };
}

export function createSubjectPracticeChemistryAcidBaseLocalGenerator(
  ports: SubjectPracticeQuestionPlanPorts & {
    validateScenario: (input: SubjectPracticeScenarioBlueprintShadowContext) => SubjectPracticeScenarioValidation;
  }
) {
  return function generateSubjectPracticeChemistryAcidBaseLocally(input: {
    blueprint: QuestionGenerationBlueprint;
    questionPlan: unknown;
    seed: number;
    relationKind: RelationKind;
    answerTarget: AnswerTarget;
    scenarioBlueprintShadowContext?: SubjectPracticeScenarioBlueprintShadowContext;
  }): SubjectPracticeChemistryAcidBaseLocalGenerationResult {
  const seed = normalizedSeed(input.seed);
  const plan = recordFrom(input.questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const allowedRelations = Array.isArray(constraints?.allowedRelationKinds) ? constraints.allowedRelationKinds.map(clean) : [];
  const allowedTargets = Array.isArray(constraints?.allowedAnswerTargets) ? constraints.allowedAnswerTargets.map(clean) : [];
  const scenarioValidation = input.scenarioBlueprintShadowContext
    ? ports.validateScenario(input.scenarioBlueprintShadowContext)
    : null;
  const provisionalContract = recordFrom(scenarioValidation?.provisionalScenarioContract);
  const provisionalBinding = recordFrom(input.scenarioBlueprintShadowContext?.binding);
  const provisionalBindingMatches = !input.scenarioBlueprintShadowContext || Boolean(
    scenarioValidation?.valid
    && clean(provisionalBinding?.subject).toLowerCase() === 'chemistry'
    && clean(provisionalBinding?.taskFamily) === clean(plan?.taskFamily)
    && clean(provisionalBinding?.planTemplate) === clean(plan?.planTemplate)
    && clean(provisionalBinding?.exactScope) === input.relationKind
    && clean(provisionalContract?.solverAction) === input.relationKind
  );
  const planSupported = clean(input.blueprint.subject).toLowerCase() === 'chemistry'
    && clean(input.blueprint.difficulty).toLowerCase() === 'medium'
    && clean(input.blueprint.questionType).toLowerCase() === 'single_choice'
    && clean(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && clean(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && clean(plan?.taskFamily) === 'ph_dilution_strong_acid_base_neutralization'
    && clean(plan?.planTemplate) === 'chemistry_strong_acid_base_single_relation_v1'
    && ports.validate(input.questionPlan).valid
    && constraints?.completeDissociationOnly === true
    && constraints?.forbidWeakPolyproticBufferHydrolysisActivityAndTitration === true
    && Number(constraints?.maxIndependentRelations) === 1
    && constraints?.forbidMultiStageModelChain === true
    && clean(constraints?.exactChemistryRelationKind) === input.relationKind
    && clean(constraints?.exactChemistryAnswerTarget) === input.answerTarget
    && allowedRelations.includes(input.relationKind)
    && provisionalBindingMatches
    && allowedTargets.includes(input.answerTarget);
  if (!planSupported) {
    return {
      generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
      status: 'unsupported_question_plan', candidate: null, verification: null, adherence: null,
      seed, relationKind: input.relationKind, answerTarget: input.answerTarget, scopeId: null,
      providerImpact: 'none_no_provider_call', estimatedCostUsd: 0, productionImpact: 'none_shadow_only',
      reasonCodes: [
        'chemistry_acid_base_local_generator_question_plan_not_supported',
        ...(scenarioValidation?.blockers ?? [])
      ],
      scenarioRenderMode: input.scenarioBlueprintShadowContext
        ? 'provisional_blueprint_shadow_rejected'
        : 'controlled_catalog',
      provisionalScenarioContractDigest: null
    };
  }
  const candidate = candidateFor({
    blueprint: input.blueprint, questionPlan: input.questionPlan, relationKind: input.relationKind,
    answerTarget: input.answerTarget, seed, scenarioContractOverride: provisionalContract
  });
  if (!candidate) {
    return {
      generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
      status: 'self_verification_failed', candidate: null, verification: null, adherence: null,
      seed, relationKind: input.relationKind, answerTarget: input.answerTarget, scopeId: null,
      providerImpact: 'none_no_provider_call', estimatedCostUsd: 0, productionImpact: 'none_shadow_only',
      reasonCodes: ['chemistry_acid_base_local_generator_candidate_construction_failed'],
      scenarioRenderMode: provisionalContract ? 'provisional_blueprint_shadow' : 'controlled_catalog',
      provisionalScenarioContractDigest: clean(provisionalContract?.scenarioContractDigest) || null
    };
  }
  const verification = solveSubjectPracticeChemistryAcidBase(candidate, {
    taskFamily: 'ph_dilution_strong_acid_base_neutralization', questionPlan: input.questionPlan
  });
  const adherence = ports.adherenceFor(input.questionPlan, candidate);
  const verified = verification.status === 'verified' && verification.verificationScope.matched && adherence.adheres;
  return {
    generatorVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_LOCAL_GENERATOR_VERSION,
    status: verified ? 'generated_and_self_verified' : 'self_verification_failed',
    candidate: verified ? candidate : null,
    verification,
    adherence,
    seed,
    relationKind: input.relationKind,
    answerTarget: input.answerTarget,
    scopeId: verification.verificationScope.scopeId,
    providerImpact: 'none_no_provider_call',
    estimatedCostUsd: 0,
    productionImpact: 'none_shadow_only',
    reasonCodes: verified ? [] : [
      'chemistry_acid_base_local_generator_self_verification_failed',
      ...verification.reasonCodes,
      ...verification.verificationScope.reasonCodes,
      ...adherence.failureCodes
    ],
    scenarioRenderMode: provisionalContract ? 'provisional_blueprint_shadow' : 'controlled_catalog',
    provisionalScenarioContractDigest: clean(provisionalContract?.scenarioContractDigest) || null
  };
  };
}
