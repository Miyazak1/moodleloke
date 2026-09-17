import { GeneratedQuestionCandidate } from './types';
import {
  solveElementaryFunctionDirectProperty,
  SubjectPracticeMathSolverEvidence
} from './subject-practice-math-solver';

export const SUBJECT_PRACTICE_MATH_ELEMENTARY_EXPLANATION_VERIFIER_VERSION = 'math-elementary-explanation-verifier-v3-formula-evidence';

type ExplanationCheck = {
  language: 'zh' | 'en';
  derivationMatched: boolean;
  conclusionMatched: boolean;
  reasonCodes: string[];
};

export type SubjectPracticeMathElementaryExplanationEvidence = {
  verifierVersion: string;
  status: 'verified' | 'failed' | 'unparsed';
  solverEvidence: SubjectPracticeMathSolverEvidence;
  recomputedWithoutGeneratorExplanation: true;
  formulaInputsUnitsAndConclusionChecked: true;
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
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

function parseLogContract(prompt: string) {
  const match = normalized(prompt).match(/log_?[0-9.]+\((x(?:[+-]\d+(?:\.\d+)?)?)\)/);
  if (!match) return null;
  const argument = match[1];
  const shift = argument.match(/^x([+-])(\d+(?:\.\d+)?)$/);
  const boundary = !shift ? 0 : shift[1] === '-' ? Number(shift[2]) : -Number(shift[2]);
  return { argument, boundary: String(boundary) };
}

function parseRadicalContract(prompt: string) {
  const match = normalized(prompt).match(/(?:√|sqrt)\(([+-]?\d+(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?\)/);
  if (!match) return null;
  const coefficient = Number(match[1]);
  const offset = Number(match[2] ?? 0);
  if (!Number.isFinite(coefficient) || coefficient === 0 || !Number.isFinite(offset)) return null;
  const boundary = -offset / coefficient;
  return {
    coefficient: String(coefficient),
    interval: coefficient > 0 ? `[${boundary},+∞)` : `(-∞,${boundary}]`,
    directionZh: coefficient > 0 ? '单调递增' : '单调递减',
    directionEn: coefficient > 0 ? 'increasing' : 'decreasing',
    radicandDirectionZh: coefficient > 0 ? '根号内一次式随x增大而增大' : '根号内一次式随x增大而减小',
    radicandDirectionEn: coefficient > 0 ? 'radicandincreaseswithx' : 'radicanddecreaseswithx'
  };
}

function parsePowerContract(prompt: string) {
  const source = normalized(prompt);
  const exponent = source.match(/f\(x\)=x\^(\d+)/)?.[1];
  const point = source.match(/f\(([+-]?\d+(?:\.\d+)?)\)/)?.[1]
    ?? source.match(/(?:把)?x=([+-]?\d+(?:\.\d+)?)(?:代入|intothepowerfunction)/)?.[1]
    ?? source.match(/substitutex=([+-]?\d+(?:\.\d+)?)/)?.[1];
  if (!exponent || point === undefined) return null;
  const expected = Number(point) ** Number(exponent);
  return Number.isFinite(expected) ? { exponent, point, expected: String(expected) } : null;
}

function checkExplanation(input: {
  language: 'zh' | 'en';
  text: string;
  prompt: string;
  scope: SubjectPracticeMathSolverEvidence['verificationScope'];
}): ExplanationCheck {
  const text = normalized(input.text);
  let derivationMatched = false;
  let conclusionMatched = false;
  if (input.scope.plannedFunctionClass === 'logarithmic' && input.scope.plannedPropertyTarget === 'domain') {
    const contract = parseLogContract(input.prompt);
    derivationMatched = Boolean(contract
      && text.includes(contract.argument)
      && (input.language === 'zh' ? text.includes('真数必须大于0') : text.includes('argumentmustbepositive')));
    conclusionMatched = Boolean(contract && text.includes(`${contract.argument}>0`) && text.includes(`x>${contract.boundary}`));
  } else if (input.scope.plannedFunctionClass === 'exponential' && input.scope.plannedPropertyTarget === 'range') {
    derivationMatched = input.language === 'zh'
      ? (text.includes('函数值恒为正') && text.includes('所有正实数'))
        || (text.includes('f(x)>0') && (text.includes('每个正实数') || text.includes('任取y>0')))
      : (text.includes('alwayspositive') && text.includes('everypositiverealvalue'))
        || (text.includes('f(x)>0') && (text.includes('everypositiverealnumber') || text.includes('takeanyy>0')));
    conclusionMatched = text.includes('(0,+∞)');
  } else if (input.scope.plannedFunctionClass === 'radical' && input.scope.plannedPropertyTarget === 'monotonicity') {
    const contract = parseRadicalContract(input.prompt);
    derivationMatched = Boolean(contract && (
      text.includes(input.language === 'zh' ? contract.radicandDirectionZh : contract.radicandDirectionEn)
      || text.includes(`${contract.coefficient}(x2-x1)`)
      || text.includes(`${contract.coefficient}(v-u)`)
      || (input.language === 'zh'
        ? text.includes(`内部一次式斜率${contract.coefficient}`)
        : text.includes(`innerlinearslope${contract.coefficient}`))
    ));
    conclusionMatched = Boolean(contract
      && text.includes(normalized(contract.interval))
      && text.includes(input.language === 'zh' ? contract.directionZh : contract.directionEn));
  } else if (input.scope.plannedFunctionClass === 'power' && input.scope.plannedPropertyTarget === 'function_value') {
    const contract = parsePowerContract(input.prompt);
    derivationMatched = Boolean(contract
      && (input.language === 'zh' ? text.includes(`代入x=${contract.point}`) : text.includes(`substitutex=${contract.point}`)));
    conclusionMatched = Boolean(contract
      && text.includes(`f(${contract.point})=${contract.point}^${contract.exponent}=${contract.expected}`));
  }
  const reasonCodes: string[] = [];
  if (!derivationMatched) reasonCodes.push(`math_explanation_${input.language}_derivation_missing_or_wrong`);
  if (!conclusionMatched) reasonCodes.push(`math_explanation_${input.language}_conclusion_missing_or_wrong`);
  return { language: input.language, derivationMatched, conclusionMatched, reasonCodes };
}

export function verifySubjectPracticeMathElementaryExplanation(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathElementaryExplanationEvidence {
  const solverEvidence = solveElementaryFunctionDirectProperty(candidate, context);
  const english = candidate.localizations?.en;
  const checks = [
    checkExplanation({
      language: 'zh', text: candidate.explanation, prompt: candidate.prompt, scope: solverEvidence.verificationScope
    }),
    checkExplanation({
      language: 'en', text: english?.explanation ?? '', prompt: english?.prompt ?? candidate.prompt, scope: solverEvidence.verificationScope
    })
  ];
  const reasonCodes = checks.flatMap((check) => check.reasonCodes);
  if (solverEvidence.status !== 'verified' || !solverEvidence.verificationScope.matched) {
    reasonCodes.unshift('math_explanation_answer_recomputation_not_verified');
  }
  const status = solverEvidence.status === 'unparsed'
    ? 'unparsed'
    : reasonCodes.length === 0
      ? 'verified'
      : 'failed';
  return {
    verifierVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_EXPLANATION_VERIFIER_VERSION,
    status,
    solverEvidence,
    recomputedWithoutGeneratorExplanation: true,
    formulaInputsUnitsAndConclusionChecked: true,
    checks,
    mismatchCount: reasonCodes.length,
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}
