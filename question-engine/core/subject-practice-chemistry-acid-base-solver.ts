import { GeneratedQuestionCandidate } from './types';

export const SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION = 'chemistry-strong-acid-base-solver-v4-context-token-boundaries';
export const SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SCOPE_VERSION = 'chemistry-strong-acid-base-verification-scope-v3';

type RelationKind = 'strong_acid_dilution' | 'strong_base_dilution' | 'strong_acid_base_neutralization';
type AnswerTarget = 'ph_value' | 'acid_base_character';
type AcidBaseCharacter = 'acidic' | 'neutral' | 'basic';
type ParsedCharacterOption = AcidBaseCharacter | 'indeterminate';

type ParsedRelation = {
  kind: RelationKind;
  answerTarget: AnswerTarget;
  expectedPh: number;
  expectedCharacter: AcidBaseCharacter;
  inputs: Record<string, number | string>;
};

export type SubjectPracticeChemistryAcidBaseOptionVerdict = {
  optionId: string;
  verdict: 'true' | 'false' | 'unknown';
  parsedTarget: AnswerTarget | null;
  parsedValue: number | ParsedCharacterOption | null;
  reasonCode: string;
};

export type SubjectPracticeChemistryAcidBaseScope = {
  scopeVersion: string;
  scopeId: string | null;
  status: 'matched' | 'mismatch' | 'missing_plan_contract';
  matched: boolean;
  relationKind: RelationKind | null;
  answerTarget: AnswerTarget | null;
  reasonCodes: string[];
};

export type SubjectPracticeChemistryAcidBaseSolverEvidence = {
  solverVersion: string;
  taskFamily: 'ph_dilution_strong_acid_base_neutralization';
  status: 'verified' | 'conflict' | 'unparsed';
  parsed: boolean;
  relationKind: RelationKind | null;
  answerTarget: AnswerTarget | null;
  expectedPh: number | null;
  expectedCharacter: AcidBaseCharacter | null;
  canonicalTask: {
    relationKind: RelationKind;
    answerTarget: AnswerTarget;
    expectedPh: number;
    expectedCharacter: AcidBaseCharacter;
    inputs: Record<string, number | string>;
  } | null;
  optionVerdicts: SubjectPracticeChemistryAcidBaseOptionVerdict[];
  trueOptionIds: string[];
  selectedOptionId: string | null;
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean;
  evidenceBoundary: 'prompt_and_visible_options_only';
  assumptions: ['aqueous_solution_25_celsius', 'complete_dissociation', 'monoprotic_strong_acid_or_monohydroxide_strong_base', 'additive_solution_volumes'];
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
  verificationScope: SubjectPracticeChemistryAcidBaseScope;
};

function normalized(value: unknown) {
  return String(value ?? '')
    .replace(/[−－]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[＝]/g, '=')
    .replace(/[，]/g, ',')
    .replace(/升/g, 'L')
    .replace(/毫升/g, 'mL')
    .replace(/摩尔\s*\/\s*升/g, 'mol/L')
    .replace(/\s+/g, ' ')
    .trim();
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(normalized).filter(Boolean) : [];
}

function sameNumber(left: number, right: number, tolerance = 0.011) {
  return Math.abs(left - right) <= tolerance;
}

function characterForPh(ph: number): AcidBaseCharacter {
  if (sameNumber(ph, 7, 1e-9)) return 'neutral';
  return ph < 7 ? 'acidic' : 'basic';
}

function answerTargetFor(source: string): AnswerTarget | null {
  if (/(?:判断|求|确定).{0,16}酸碱性|酸碱性.{0,12}(?:如何|怎样|是什么)|what.{0,16}(?:nature|character).{0,12}solution|is the solution (?:acidic|basic|neutral)/i.test(source)) return 'acid_base_character';
  if (/pH.{0,12}(?:是多少|为多少|约为|为(?=\s|$|[?？]))|what.{0,12}pH|find.{0,12}pH/i.test(source)) return 'ph_value';
  return null;
}

function volumeInLiters(value: string, unit: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * (unit.toLowerCase() === 'ml' ? 0.001 : 1) : Number.NaN;
}

function parseConcentrationVolumeDilution(source: string, target: AnswerTarget): ParsedRelation | null {
  const match = source.match(/([0-9]+(?:\.[0-9]+)?)\s*mol\s*\/\s*L\s*(HCl|HNO3|NaOH|KOH|盐酸|硝酸|氢氧化钠|氢氧化钾)\s*([0-9]+(?:\.[0-9]+)?)\s*(mL|L)\s*(?:稀释|diluted?)\s*(?:到|至|to)\s*([0-9]+(?:\.[0-9]+)?)\s*(mL|L)/i)
    ?? source.match(/量取\s*([0-9]+(?:\.[0-9]+)?)\s*mol\s*\/\s*L\s*(HCl|HNO3|NaOH|KOH|盐酸|硝酸|氢氧化钠|氢氧化钾)\s*([0-9]+(?:\.[0-9]+)?)\s*(mL|L)[，,]?\s*加水定容(?:到|至)\s*([0-9]+(?:\.[0-9]+)?)\s*(mL|L)/i);
  const reverse = source.match(/目标终体积为\s*([0-9]+(?:\.[0-9]+)?)\s*(mL|L)[；;].*?取样体积为\s*([0-9]+(?:\.[0-9]+)?)\s*(mL|L).*?浓度为\s*([0-9]+(?:\.[0-9]+)?)\s*mol\s*\/\s*L\s*(HCl|HNO3|NaOH|KOH|盐酸|硝酸|氢氧化钠|氢氧化钾)/i);
  if (!match && !reverse) return null;
  const concentration = Number(match?.[1] ?? reverse?.[5]);
  const species = String(match?.[2] ?? reverse?.[6]);
  const initialVolume = volumeInLiters(String(match?.[3] ?? reverse?.[3]), String(match?.[4] ?? reverse?.[4]));
  const finalVolume = volumeInLiters(String(match?.[5] ?? reverse?.[1]), String(match?.[6] ?? reverse?.[2]));
  const acid = /^(?:HCl|HNO3|盐酸|硝酸)$/i.test(species);
  const base = /^(?:NaOH|KOH|氢氧化钠|氢氧化钾)$/i.test(species);
  if (!Number.isFinite(concentration) || concentration <= 0 || concentration > 1
    || !Number.isFinite(initialVolume) || !Number.isFinite(finalVolume)
    || initialVolume <= 0 || finalVolume <= initialVolume || acid === base) return null;
  const finalConcentration = concentration * initialVolume / finalVolume;
  const expectedPh = acid ? -Math.log10(finalConcentration) : 14 + Math.log10(finalConcentration);
  if (!Number.isFinite(expectedPh) || expectedPh < 0 || expectedPh > 14) return null;
  return {
    kind: acid ? 'strong_acid_dilution' : 'strong_base_dilution',
    answerTarget: target,
    expectedPh,
    expectedCharacter: characterForPh(expectedPh),
    inputs: { concentrationMolPerLiter: concentration, initialVolumeLiters: initialVolume, finalVolumeLiters: finalVolume, species }
  };
}

function parseDilution(source: string): ParsedRelation | null {
  if (!/(稀释|dilut)/i.test(source) || /(混合(?!液)|中和|\bmix(?:ed|es|ing)?\b|\bneutraliz\w*)/i.test(source)) return null;
  const phMatch = source.match(/pH\s*(?:=|为|是)?\s*([0-9]+(?:\.[0-9]+)?)/i);
  const factorMatch = source.match(/(?:稀释|diluted?)(?:\s*by)?[^0-9]{0,18}([0-9]+(?:\.[0-9]+)?)\s*(?:倍|times?|fold|factor)?/i)
    ?? source.match(/(?:factor\s+of)\s*([0-9]+(?:\.[0-9]+)?)/i);
  const target = answerTargetFor(source);
  if (target) {
    const volumeDilution = parseConcentrationVolumeDilution(source, target);
    if (volumeDilution) return volumeDilution;
  }
  if (!phMatch || !factorMatch || !target) return null;
  const initialPh = Number(phMatch[1]);
  const factor = Number(factorMatch[1]);
  if (!Number.isFinite(initialPh) || !Number.isFinite(factor) || initialPh < 0 || initialPh > 14 || factor <= 1) return null;
  const acid = /(盐酸|HCl|硝酸|HNO3|强酸|strong acid)/i.test(source);
  const base = /(氢氧化钠|NaOH|氢氧化钾|KOH|强碱|strong base)/i.test(source);
  if (acid === base) return null;
  const logFactor = Math.log10(factor);
  const expectedPh = acid ? initialPh + logFactor : initialPh - logFactor;
  if (expectedPh <= 0 || expectedPh >= 14) return null;
  return {
    kind: acid ? 'strong_acid_dilution' : 'strong_base_dilution',
    answerTarget: target,
    expectedPh,
    expectedCharacter: characterForPh(expectedPh),
    inputs: { initialPh, dilutionFactor: factor, speciesClass: acid ? 'strong_acid' : 'strong_base' }
  };
}

function solutionEntries(source: string) {
  const entries: Array<{ volumeLiters: number; concentrationMolPerLiter: number; role: 'acid' | 'base'; species: string }> = [];
  const pattern = /([0-9]+(?:\.[0-9]+)?)\s*(mL|L)\s*(?:、|的|of)?\s*([0-9]+(?:\.[0-9]+)?)\s*mol\s*\/\s*L\s*(HCl|HNO3|NaOH|KOH)/gi;
  for (const match of source.matchAll(pattern)) {
    const volume = Number(match[1]) * (match[2].toLowerCase() === 'ml' ? 0.001 : 1);
    const concentration = Number(match[3]);
    const species = match[4].toUpperCase();
    if (!Number.isFinite(volume) || !Number.isFinite(concentration) || volume <= 0 || concentration <= 0) continue;
    entries.push({ volumeLiters: volume, concentrationMolPerLiter: concentration, role: species === 'HCL' || species === 'HNO3' ? 'acid' : 'base', species });
  }
  return entries;
}

function parseNeutralization(source: string): ParsedRelation | null {
  if (!/(混合(?!液)|中和|\bmix(?:ed|es|ing)?\b|\bneutraliz\w*)/i.test(source)) return null;
  const target = answerTargetFor(source);
  const entries = solutionEntries(source);
  if (!target || entries.length !== 2 || entries.filter((entry) => entry.role === 'acid').length !== 1 || entries.filter((entry) => entry.role === 'base').length !== 1) return null;
  const acid = entries.find((entry) => entry.role === 'acid')!;
  const base = entries.find((entry) => entry.role === 'base')!;
  const acidMoles = acid.volumeLiters * acid.concentrationMolPerLiter;
  const baseMoles = base.volumeLiters * base.concentrationMolPerLiter;
  const totalVolume = acid.volumeLiters + base.volumeLiters;
  const excess = acidMoles - baseMoles;
  let expectedPh = 7;
  if (Math.abs(excess) > 1e-12) {
    const excessConcentration = Math.abs(excess) / totalVolume;
    expectedPh = excess > 0 ? -Math.log10(excessConcentration) : 14 + Math.log10(excessConcentration);
  }
  if (!Number.isFinite(expectedPh) || expectedPh < 0 || expectedPh > 14) return null;
  return {
    kind: 'strong_acid_base_neutralization',
    answerTarget: target,
    expectedPh,
    expectedCharacter: characterForPh(expectedPh),
    inputs: {
      acidSpecies: acid.species,
      baseSpecies: base.species,
      acidMoles,
      baseMoles,
      totalVolumeLiters: totalVolume
    }
  };
}

function parseRelation(prompt: string): ParsedRelation | null {
  const source = normalized(prompt);
  if (/(醋酸|乙酸|CH3COOH|氨水|NH3|弱酸|弱碱|buffer|缓冲|H2SO4|硫酸|多元酸)/i.test(source)) return null;
  return parseNeutralization(source) ?? parseDilution(source);
}

function parseCharacter(source: string): ParsedCharacterOption | null {
  const matches = [
    { value: 'acidic' as const, match: /(呈酸性|酸性溶液|acidic)/i.test(source) },
    { value: 'neutral' as const, match: /(呈中性|中性溶液|neutral)/i.test(source) },
    { value: 'basic' as const, match: /(呈碱性|碱性溶液|basic|alkaline)/i.test(source) },
    { value: 'indeterminate' as const, match: /(无法判断|不能确定|cannot determine|insufficient information)/i.test(source) }
  ].filter((item) => item.match);
  return matches.length === 1 ? matches[0].value : null;
}

function parseOption(optionId: string, rawText: string, relation: ParsedRelation): SubjectPracticeChemistryAcidBaseOptionVerdict {
  const source = normalized(rawText);
  if (relation.answerTarget === 'ph_value') {
    const match = source.match(/pH\s*(?:=|为|是)?\s*([0-9]+(?:\.[0-9]+)?)/i)
      ?? source.match(/^([0-9]+(?:\.[0-9]+)?)$/);
    if (!match) return { optionId, verdict: 'unknown', parsedTarget: null, parsedValue: null, reasonCode: 'chemistry_solver_ph_option_unparsed' };
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value < 0 || value > 14) return { optionId, verdict: 'unknown', parsedTarget: null, parsedValue: null, reasonCode: 'chemistry_solver_ph_option_out_of_range' };
    const correct = sameNumber(value, relation.expectedPh);
    return { optionId, verdict: correct ? 'true' : 'false', parsedTarget: 'ph_value', parsedValue: value, reasonCode: correct ? 'chemistry_solver_ph_matches' : 'chemistry_solver_ph_mismatch' };
  }
  const value = parseCharacter(source);
  if (!value) return { optionId, verdict: 'unknown', parsedTarget: null, parsedValue: null, reasonCode: 'chemistry_solver_character_option_unparsed' };
  const correct = value === relation.expectedCharacter;
  return { optionId, verdict: correct ? 'true' : 'false', parsedTarget: 'acid_base_character', parsedValue: value, reasonCode: correct ? 'chemistry_solver_character_matches' : 'chemistry_solver_character_mismatch' };
}

function verificationScopeFor(taskFamily: unknown, questionPlan: unknown, relation: ParsedRelation | null): SubjectPracticeChemistryAcidBaseScope {
  const plan = recordFrom(questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const familyMatches = normalized(taskFamily) === 'ph_dilution_strong_acid_base_neutralization';
  const planContractPresent = Boolean(
    plan
    && normalized(plan.schemaVersion) === 'subject-practice-question-plan-v1'
    && normalized(plan.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && normalized(plan.planTemplate) === 'chemistry_strong_acid_base_single_relation_v1'
    && normalized(plan.taskFamily) === 'ph_dilution_strong_acid_base_neutralization'
    && normalized(plan.targetDifficulty).toLowerCase() === 'medium'
    && constraints?.completeDissociationOnly === true
    && constraints?.requireVisibleQuantitiesAndUnits === true
    && constraints?.requireTemperatureConvention25C === true
    && constraints?.forbidWeakPolyproticBufferHydrolysisActivityAndTitration === true
    && constraints?.maxIndependentRelations === 1
    && constraints?.forbidMultiStageModelChain === true
  );
  const relationAllowed = Boolean(relation
    && stringArray(constraints?.allowedRelationKinds).includes(relation.kind)
    && stringArray(constraints?.allowedAnswerTargets).includes(relation.answerTarget));
  const reasonCodes: string[] = [];
  if (!familyMatches) reasonCodes.push('chemistry_solver_family_contract_missing');
  if (!planContractPresent) reasonCodes.push('chemistry_solver_verification_scope_plan_contract_missing');
  if (familyMatches && planContractPresent && !relation) reasonCodes.push('chemistry_solver_relation_unparsed');
  if (familyMatches && planContractPresent && relation && !relationAllowed) reasonCodes.push('chemistry_solver_relation_outside_plan_allowlist');
  const matched = familyMatches && planContractPresent && Boolean(relation) && relationAllowed;
  return {
    scopeVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SCOPE_VERSION,
    scopeId: matched && relation ? `chemistry-strong-acid-base-v3:${relation.kind}:${relation.answerTarget}` : null,
    status: !familyMatches || !planContractPresent ? 'missing_plan_contract' : matched ? 'matched' : 'mismatch',
    matched,
    relationKind: relation?.kind ?? null,
    answerTarget: relation?.answerTarget ?? null,
    reasonCodes
  };
}

export function solveSubjectPracticeChemistryAcidBase(
  candidate: GeneratedQuestionCandidate,
  context: { taskFamily?: unknown; questionPlan?: unknown } = {}
): SubjectPracticeChemistryAcidBaseSolverEvidence {
  const relation = parseRelation(candidate.prompt);
  const verificationScope = verificationScopeFor(context.taskFamily, context.questionPlan, relation);
  const optionVerdicts = relation
    ? candidate.options.map((option) => parseOption(option.id, option.text, relation))
    : candidate.options.map((option) => ({ optionId: option.id, verdict: 'unknown' as const, parsedTarget: null, parsedValue: null, reasonCode: 'chemistry_solver_relation_unparsed' }));
  const hasUnknown = optionVerdicts.some((item) => item.verdict === 'unknown');
  const trueOptionIds = optionVerdicts.filter((item) => item.verdict === 'true').map((item) => item.optionId);
  const uniqueAnswer = !hasUnknown && trueOptionIds.length === 1;
  const selectedOptionId = uniqueAnswer ? trueOptionIds[0] : null;
  const agreesWithGenerator = uniqueAnswer && selectedOptionId === candidate.correctAnswer;
  const reasonCodes: string[] = [];
  if (!relation) reasonCodes.push('chemistry_solver_relation_unparsed');
  if (hasUnknown) reasonCodes.push('chemistry_solver_option_unparsed');
  if (!hasUnknown && trueOptionIds.length !== 1) reasonCodes.push(trueOptionIds.length === 0 ? 'chemistry_solver_no_true_option' : 'chemistry_solver_multiple_true_options');
  if (uniqueAnswer && !agreesWithGenerator) reasonCodes.push('chemistry_solver_generator_answer_disagrees');
  const status = !relation || hasUnknown ? 'unparsed' : uniqueAnswer && agreesWithGenerator ? 'verified' : 'conflict';
  return {
    solverVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_SOLVER_VERSION,
    taskFamily: 'ph_dilution_strong_acid_base_neutralization',
    status,
    parsed: Boolean(relation) && !hasUnknown,
    relationKind: relation?.kind ?? null,
    answerTarget: relation?.answerTarget ?? null,
    expectedPh: relation?.expectedPh ?? null,
    expectedCharacter: relation?.expectedCharacter ?? null,
    canonicalTask: relation ? {
      relationKind: relation.kind,
      answerTarget: relation.answerTarget,
      expectedPh: relation.expectedPh,
      expectedCharacter: relation.expectedCharacter,
      inputs: { ...relation.inputs }
    } : null,
    optionVerdicts,
    trueOptionIds,
    selectedOptionId,
    uniqueAnswer,
    agreesWithGenerator,
    evidenceBoundary: 'prompt_and_visible_options_only',
    assumptions: ['aqueous_solution_25_celsius', 'complete_dissociation', 'monoprotic_strong_acid_or_monohydroxide_strong_base', 'additive_solution_volumes'],
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes,
    verificationScope
  };
}
