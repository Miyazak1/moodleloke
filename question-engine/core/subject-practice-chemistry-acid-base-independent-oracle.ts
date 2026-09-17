import { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION = 'chemistry-acid-base-independent-oracle-v5-dynamic-context';

type RelationKind = 'strong_acid_dilution' | 'strong_base_dilution' | 'strong_acid_base_neutralization';
type AnswerTarget = 'ph_value' | 'acid_base_character';
type Character = 'acidic' | 'neutral' | 'basic';
type Model = { relationKind: RelationKind; answerTarget: AnswerTarget; expectedPh: number; expectedCharacter: Character };

export type SubjectPracticeChemistryAcidBaseIndependentOracleEvidence = {
  oracleVersion: string;
  status: 'verified' | 'conflict' | 'unparsed';
  relationKind: RelationKind | null;
  answerTarget: AnswerTarget | null;
  expectedPh: number | null;
  expectedCharacter: Character | null;
  optionVerdicts: Array<{ optionId: string; verdict: 'true' | 'false' | 'unknown' }>;
  trueOptionIds: string[];
  selectedOptionId: string | null;
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  scopeId: string | null;
  scopeMatched: boolean;
  evidenceBoundary: 'prompt_and_visible_options_only';
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/[−－]/g, '-').replace(/[＝]/g, '=').replace(/\s+/g, ' ').trim();
}

function numeric(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundedPh(value: number) {
  return Math.round(value * 100) / 100;
}

function characterFor(ph: number): Character {
  if (Math.abs(ph - 7) <= 1e-9) return 'neutral';
  return ph < 7 ? 'acidic' : 'basic';
}

function planSupports(questionPlan: unknown, relationKind: RelationKind, answerTarget: AnswerTarget) {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const relations = Array.isArray(constraints?.allowedRelationKinds) ? constraints.allowedRelationKinds.map(clean) : [];
  const targets = Array.isArray(constraints?.allowedAnswerTargets) ? constraints.allowedAnswerTargets.map(clean) : [];
  const species = Array.isArray(constraints?.allowedSpecies) ? constraints.allowedSpecies.map(clean) : [];
  return Boolean(plan
    && clean(plan.schemaVersion) === 'subject-practice-question-plan-v1'
    && clean(plan.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && clean(plan.subject).toLowerCase() === 'chemistry'
    && clean(plan.taskFamily) === 'ph_dilution_strong_acid_base_neutralization'
    && clean(plan.planTemplate) === 'chemistry_strong_acid_base_single_relation_v1'
    && clean(plan.targetDifficulty).toLowerCase() === 'medium'
    && constraints?.completeDissociationOnly === true
    && constraints?.requireTemperatureConvention25C === true
    && constraints?.forbidWeakPolyproticBufferHydrolysisActivityAndTitration === true
    && Number(constraints?.maxIndependentRelations) === 1
    && constraints?.forbidMultiStageModelChain === true
    && ['HCl', 'HNO3', 'NaOH', 'KOH'].every((item) => species.includes(item))
    && relations.includes(relationKind)
    && targets.includes(answerTarget));
}

function targetFromPrompt(prompt: string): AnswerTarget | null {
  const asksPh = /(?:^|[,，。;；?？\s])pH\s*(?:约为|为多少|是多少|=\s*\?|is\s+what)|what\s+is.{0,12}pH|find.{0,12}pH/i.test(prompt);
  const asksCharacter = /(?:所得|混合后)?溶液.{0,10}酸碱性(?:如何|怎样|是什么)|is\s+the\s+solution\s+(?:acidic|basic|neutral)/i.test(prompt);
  if (asksPh === asksCharacter) return null;
  return asksPh ? 'ph_value' : 'acid_base_character';
}

function parsePrompt(prompt: string): Model | null {
  const source = clean(prompt);
  const answerTarget = targetFromPrompt(source);
  if (!answerTarget) return null;
  const dilution = source.match(/^(?:在[^，]{1,40}中，将作为[^，]{1,30}的 )?([0-9]+(?:\.[0-9]+)?) mol\/L (盐酸|硝酸|氢氧化钠|氢氧化钾) ([0-9]+(?:\.[0-9]+)?) mL 稀释到 ([0-9]+(?:\.[0-9]+)?) mL[，,]/)
    ?? source.match(/量取\s*([0-9]+(?:\.[0-9]+)?) mol\/L (盐酸|硝酸|氢氧化钠|氢氧化钾) ([0-9]+(?:\.[0-9]+)?) mL[，,]?\s*加水定容至 ([0-9]+(?:\.[0-9]+)?) mL/);
  const reverseDilution = source.match(/目标终体积为\s*([0-9]+(?:\.[0-9]+)?) mL[；;].*?取样体积为\s*([0-9]+(?:\.[0-9]+)?) mL.*?浓度为\s*([0-9]+(?:\.[0-9]+)?) mol\/L (盐酸|硝酸|氢氧化钠|氢氧化钾)/);
  if (dilution || reverseDilution) {
    const concentration = numeric(dilution?.[1] ?? reverseDilution?.[3]);
    const species = dilution?.[2] ?? reverseDilution?.[4];
    const initialVolume = numeric(dilution?.[3] ?? reverseDilution?.[2]);
    const finalVolume = numeric(dilution?.[4] ?? reverseDilution?.[1]);
    if (concentration === null || concentration <= 0 || initialVolume === null || initialVolume <= 0
      || finalVolume === null || finalVolume <= initialVolume) return null;
    const finalConcentration = concentration * initialVolume / finalVolume;
    const acid = species === '盐酸' || species === '硝酸';
    const expectedPh = acid ? -Math.log10(finalConcentration) : 14 + Math.log10(finalConcentration);
    if (!Number.isFinite(expectedPh) || expectedPh < 0 || expectedPh > 14) return null;
    const relationKind: RelationKind = acid ? 'strong_acid_dilution' : 'strong_base_dilution';
    return { relationKind, answerTarget, expectedPh: roundedPh(expectedPh), expectedCharacter: characterFor(expectedPh) };
  }
  const neutralization = source.match(/(?:将作为[^，]{1,40}的 |将 )([0-9]+(?:\.[0-9]+)?) mL ([0-9]+(?:\.[0-9]+)?) mol\/L HCl 与 ([0-9]+(?:\.[0-9]+)?) mL ([0-9]+(?:\.[0-9]+)?) mol\/L NaOH 混合，/);
  if (!neutralization) return null;
  const acidVolume = numeric(neutralization[1]);
  const acidConcentration = numeric(neutralization[2]);
  const baseVolume = numeric(neutralization[3]);
  const baseConcentration = numeric(neutralization[4]);
  if ([acidVolume, acidConcentration, baseVolume, baseConcentration].some((item) => item === null || item <= 0)) return null;
  const acidMoles = acidConcentration! * acidVolume! / 1000;
  const baseMoles = baseConcentration! * baseVolume! / 1000;
  const excess = acidMoles - baseMoles;
  const totalVolumeLitres = (acidVolume! + baseVolume!) / 1000;
  let expectedPh = 7;
  if (Math.abs(excess) > 1e-12) {
    const excessConcentration = Math.abs(excess) / totalVolumeLitres;
    expectedPh = excess > 0 ? -Math.log10(excessConcentration) : 14 + Math.log10(excessConcentration);
  }
  if (!Number.isFinite(expectedPh) || expectedPh < 0 || expectedPh > 14) return null;
  return {
    relationKind: 'strong_acid_base_neutralization',
    answerTarget,
    expectedPh: roundedPh(expectedPh),
    expectedCharacter: characterFor(expectedPh)
  };
}

function numericOption(text: string) {
  const match = clean(text).match(/^(?:pH=|所得溶液的\s*pH\s*为\s*|The resulting solution has pH\s*)?([0-9]+(?:\.[0-9]+)?)(?:\.)?$/i);
  return numeric(match?.[1]);
}

function characterOption(text: string): Character | 'indeterminate' | null {
  const source = clean(text);
  if (source === '溶液呈酸性') return 'acidic';
  if (source === '溶液呈中性') return 'neutral';
  if (source === '溶液呈碱性') return 'basic';
  if (source === '无法判断') return 'indeterminate';
  return null;
}

export function verifySubjectPracticeChemistryAcidBaseWithIndependentOracle(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeChemistryAcidBaseIndependentOracleEvidence {
  const model = clean(candidate.subject).toLowerCase() === 'chemistry' ? parsePrompt(candidate.prompt) : null;
  const planMatched = Boolean(model && planSupports(context.questionPlan, model.relationKind, model.answerTarget));
  const optionVerdicts = candidate.options.map((option) => {
    if (!model) return { optionId: option.id, verdict: 'unknown' as const };
    if (model.answerTarget === 'ph_value') {
      const parsed = numericOption(option.text);
      return { optionId: option.id, verdict: parsed === null ? 'unknown' as const : Math.abs(parsed - model.expectedPh) <= 1e-9 ? 'true' as const : 'false' as const };
    }
    const parsed = characterOption(option.text);
    return { optionId: option.id, verdict: parsed === null ? 'unknown' as const : parsed === model.expectedCharacter ? 'true' as const : 'false' as const };
  });
  const hasUnknown = optionVerdicts.some((option) => option.verdict === 'unknown');
  const trueOptionIds = optionVerdicts.filter((option) => option.verdict === 'true').map((option) => option.optionId);
  const uniqueAnswer = Boolean(model) && !hasUnknown && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = uniqueAnswer && selectedOptionId === candidate.correctAnswer;
  const reasonCodes: string[] = [];
  if (!model) reasonCodes.push('chemistry_independent_oracle_prompt_unparsed');
  if (model && !planMatched) reasonCodes.push('chemistry_independent_oracle_plan_scope_mismatch');
  if (hasUnknown) reasonCodes.push('chemistry_independent_oracle_option_unparsed');
  if (model && !hasUnknown && trueOptionIds.length !== 1) reasonCodes.push(trueOptionIds.length ? 'chemistry_independent_oracle_multiple_true_options' : 'chemistry_independent_oracle_no_true_option');
  if (uniqueAnswer && !agreesWithGenerator) reasonCodes.push('chemistry_independent_oracle_generator_disagreement');
  const status = !model || !planMatched || hasUnknown
    ? 'unparsed'
    : uniqueAnswer && agreesWithGenerator ? 'verified' : 'conflict';
  return {
    oracleVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_INDEPENDENT_ORACLE_VERSION,
    status,
    relationKind: model?.relationKind ?? null,
    answerTarget: model?.answerTarget ?? null,
    expectedPh: model?.expectedPh ?? null,
    expectedCharacter: model?.expectedCharacter ?? null,
    optionVerdicts,
    trueOptionIds,
    selectedOptionId,
    uniqueAnswer,
    agreesWithGenerator,
    scopeId: model && planMatched ? `chemistry-strong-acid-base-v3:${model.relationKind}:${model.answerTarget}` : null,
    scopeMatched: Boolean(model && planMatched),
    evidenceBoundary: 'prompt_and_visible_options_only',
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes
  };
}
