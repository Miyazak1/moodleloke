import { GeneratedQuestionCandidate } from './types';
import {
  solveSubjectPracticeChemistryAcidBase,
  SubjectPracticeChemistryAcidBaseSolverEvidence
} from './subject-practice-chemistry-acid-base-solver';

export const SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_EXPLANATION_VERIFIER_VERSION = 'chemistry-acid-base-explanation-verifier-v1';

type ExplanationCheck = {
  language: 'zh' | 'en';
  temperatureConventionPresent: boolean;
  relationDerivationMatched: boolean;
  promptInputsCovered: boolean;
  conclusionMatched: boolean;
  answerTargetConclusionMatched: boolean;
  conclusionPh: number | null;
  reasonCodes: string[];
};

export type SubjectPracticeChemistryAcidBaseExplanationEvidence = {
  verifierVersion: string;
  status: 'verified' | 'failed' | 'unparsed';
  solverEvidence: SubjectPracticeChemistryAcidBaseSolverEvidence;
  recomputedWithoutGeneratorExplanation: true;
  formulaInputsUnitsAndConclusionChecked: true;
  chemistryAssumptionsChecked: true;
  checks: ExplanationCheck[];
  mismatchCount: number;
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

function normalized(value: unknown) {
  return String(value ?? '')
    .replace(/[−－]/g, '-')
    .replace(/[＝]/g, '=')
    .replace(/[×·]/g, '*')
    .replace(/[₂₁]/g, (token) => token === '₂' ? '2' : '1')
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) <= 0.011;
}

function promptInputNumbers(prompt: string) {
  const values: string[] = [];
  const pattern = /([0-9]+(?:\.[0-9]+)?)\s*(?:mol\s*\/\s*l|ml|l)(?![a-z])/gi;
  for (const match of prompt.matchAll(pattern)) values.push(String(Number(match[1])));
  return Array.from(new Set(values));
}

function containsNumber(text: string, value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^0-9.])${escaped}(?![0-9.])`).test(text);
}

function lastDerivedNumber(text: string) {
  const matches = Array.from(text.matchAll(/=([+-]?\d+(?:\.\d+)?)/g));
  const value = matches.at(-1)?.[1];
  return value === undefined ? null : Number(value);
}

function expectedCharacterToken(language: 'zh' | 'en', character: SubjectPracticeChemistryAcidBaseSolverEvidence['expectedCharacter']) {
  if (language === 'zh') return character === 'acidic' ? '呈酸性' : character === 'basic' ? '呈碱性' : '呈中性';
  return character === 'acidic' ? 'solutionisacidic' : character === 'basic' ? 'solutionisbasic' : 'solutionisneutral';
}

function relationDerivationMatched(text: string, evidence: SubjectPracticeChemistryAcidBaseSolverEvidence) {
  const logarithm = text.includes('lg[') || text.includes('log[');
  const completeDissociation = text.includes('完全电离') || (text.includes('complete') && text.includes('dissociation'));
  if (evidence.relationKind === 'strong_acid_dilution') {
    return text.includes('c2=c1v1/v2')
      && completeDissociation
      && text.includes('[h+]=c2')
      && text.includes('ph=-')
      && logarithm;
  }
  if (evidence.relationKind === 'strong_base_dilution') {
    return text.includes('c2=c1v1/v2')
      && completeDissociation
      && text.includes('[oh-]=c2')
      && text.includes('poh=-')
      && logarithm
      && text.includes('ph=14-poh');
  }
  if (evidence.relationKind === 'strong_acid_base_neutralization') {
    const common = text.includes('n(h+)=')
      && text.includes('n(oh-)=')
      && (text.includes('过量') || text.includes('excess'))
      && text.includes('c=');
    if (evidence.expectedCharacter === 'acidic') return common && text.includes('ph=-') && logarithm;
    if (evidence.expectedCharacter === 'basic') return common && text.includes('poh=-') && logarithm && text.includes('ph=14-poh');
    return false;
  }
  return false;
}

function checkExplanation(input: {
  language: 'zh' | 'en';
  text: string;
  prompt: string;
  evidence: SubjectPracticeChemistryAcidBaseSolverEvidence;
}): ExplanationCheck {
  const text = normalized(input.text);
  const conclusionPh = lastDerivedNumber(text);
  const temperatureConventionPresent = text.includes('25°c');
  const derivationMatched = relationDerivationMatched(text, input.evidence);
  const inputsCovered = promptInputNumbers(input.prompt).every((value) => containsNumber(text, value));
  const conclusionMatched = input.evidence.expectedPh !== null
    && conclusionPh !== null
    && sameNumber(conclusionPh, input.evidence.expectedPh);
  const answerTargetConclusionMatched = input.evidence.answerTarget !== 'acid_base_character'
    || text.includes(expectedCharacterToken(input.language, input.evidence.expectedCharacter));
  const reasonCodes: string[] = [];
  if (!temperatureConventionPresent) reasonCodes.push(`chemistry_explanation_${input.language}_temperature_convention_missing`);
  if (!derivationMatched) reasonCodes.push(`chemistry_explanation_${input.language}_relation_derivation_missing_or_wrong`);
  if (!inputsCovered) reasonCodes.push(`chemistry_explanation_${input.language}_prompt_input_missing`);
  if (!conclusionMatched) reasonCodes.push(`chemistry_explanation_${input.language}_ph_conclusion_mismatch`);
  if (!answerTargetConclusionMatched) reasonCodes.push(`chemistry_explanation_${input.language}_answer_target_conclusion_missing_or_wrong`);
  return {
    language: input.language,
    temperatureConventionPresent,
    relationDerivationMatched: derivationMatched,
    promptInputsCovered: inputsCovered,
    conclusionMatched,
    answerTargetConclusionMatched,
    conclusionPh,
    reasonCodes
  };
}

export function verifySubjectPracticeChemistryAcidBaseExplanation(
  candidate: GeneratedQuestionCandidate,
  context: { taskFamily?: unknown; questionPlan?: unknown } = {}
): SubjectPracticeChemistryAcidBaseExplanationEvidence {
  const solverEvidence = solveSubjectPracticeChemistryAcidBase(candidate, context);
  const english = candidate.localizations?.en;
  const checks = [
    checkExplanation({ language: 'zh', text: candidate.explanation, prompt: candidate.prompt, evidence: solverEvidence }),
    checkExplanation({
      language: 'en', text: english?.explanation ?? '', prompt: english?.prompt ?? candidate.prompt, evidence: solverEvidence
    })
  ];
  const reasonCodes = checks.flatMap((check) => check.reasonCodes);
  if (solverEvidence.status !== 'verified' || !solverEvidence.verificationScope.matched) {
    reasonCodes.unshift('chemistry_explanation_answer_recomputation_not_verified');
  }
  return {
    verifierVersion: SUBJECT_PRACTICE_CHEMISTRY_ACID_BASE_EXPLANATION_VERIFIER_VERSION,
    status: solverEvidence.status === 'unparsed' ? 'unparsed' : reasonCodes.length === 0 ? 'verified' : 'failed',
    solverEvidence,
    recomputedWithoutGeneratorExplanation: true,
    formulaInputsUnitsAndConclusionChecked: true,
    chemistryAssumptionsChecked: true,
    checks,
    mismatchCount: reasonCodes.length,
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}
