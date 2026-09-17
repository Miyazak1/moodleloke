import { GeneratedQuestionCandidate } from './types';
import {
  solveSubjectPracticeMathLineRelation,
  SubjectPracticeMathLineRelationSolverEvidence
} from './subject-practice-math-line-relation-solver';

export const SUBJECT_PRACTICE_MATH_LINE_RELATION_EXPLANATION_VERIFIER_VERSION =
  'math-line-relation-explanation-verifier-v1';

type LanguageCheck = {
  language: 'zh' | 'en';
  answerRecomputed: boolean;
  derivationMatched: boolean;
  conclusionMatched: boolean;
  reasonCodes: string[];
};

export type SubjectPracticeMathLineRelationExplanationEvidence = {
  verifierVersion: string;
  status: 'verified' | 'failed' | 'unparsed';
  solverEvidence: SubjectPracticeMathLineRelationSolverEvidence;
  recomputedWithoutGeneratorExplanation: true;
  bilingualDerivationAndConclusionChecked: true;
  checks: LanguageCheck[];
  mismatchCount: number;
  providerImpact: 'none_no_provider_call';
  productionGateImpact: 'none_shadow_only';
  reasonCodes: string[];
};

function compact(value: unknown) {
  return String(value ?? '')
    .replace(/[−－]/g, '-')
    .replace(/[＋]/g, '+')
    .replace(/[＝]/g, '=')
    .replace(/[，]/g, ',')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[Δδ]/g, 'd')
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

function localizedCandidate(candidate: GeneratedQuestionCandidate, language: 'zh' | 'en') {
  const localized = candidate.localizations?.[language];
  return {
    ...candidate,
    prompt: localized?.prompt ?? candidate.prompt,
    options: localized?.options ?? candidate.options,
    explanation: localized?.explanation ?? (language === 'zh' ? candidate.explanation : '')
  };
}

function checkLanguage(input: {
  candidate: GeneratedQuestionCandidate;
  language: 'zh' | 'en';
  questionPlan?: unknown;
}): LanguageCheck {
  const candidate = localizedCandidate(input.candidate, input.language);
  const solver = solveSubjectPracticeMathLineRelation(candidate, { questionPlan: input.questionPlan });
  const explanation = compact(candidate.explanation);
  const correctOption = compact(candidate.options.find((option) => option.id === candidate.correctAnswer)?.text);
  const scope = solver.exactScope;
  let derivationMatched = false;
  let conclusionMatched = false;

  if (scope === 'slope_from_two_distinct_points') {
    derivationMatched = explanation.includes('dy/dx')
      || (input.language === 'zh' ? explanation.includes('方向增量') : explanation.includes('directionchange'));
    conclusionMatched = Boolean(correctOption && explanation.includes(correctOption));
  } else if (scope === 'inclination_angle_from_line') {
    derivationMatched = explanation.includes('k=')
      || (input.language === 'zh' ? explanation.includes('斜率') : explanation.includes('slope'));
    conclusionMatched = Boolean(correctOption && explanation.includes(correctOption));
  } else if (scope === 'identify_parallel_or_perpendicular_line') {
    const relation = String(solver.canonicalTask?.relation ?? '');
    derivationMatched = relation === 'parallel'
      ? input.language === 'zh'
        ? explanation.includes('法向量成比例') && explanation.includes('重合')
        : explanation.includes('proportionalnormalvectors') && explanation.includes('distinct')
      : input.language === 'zh'
        ? explanation.includes('法向量点积为0')
        : explanation.includes('normalvectors') && explanation.includes('dotproduct0');
    conclusionMatched = solver.status === 'verified' && solver.selectedOptionId === candidate.correctAnswer;
  } else if (scope === 'line_equation_from_point_and_slope') {
    derivationMatched = input.language === 'zh' ? explanation.includes('点斜式') : explanation.includes('point-slopeform');
    conclusionMatched = Boolean(correctOption && explanation.includes(correctOption));
  }

  const answerRecomputed = solver.status === 'verified';
  const reasonCodes: string[] = [];
  if (!answerRecomputed) reasonCodes.push(`math_line_relation_explanation_${input.language}_answer_recompute_failed`);
  if (!derivationMatched) reasonCodes.push(`math_line_relation_explanation_${input.language}_derivation_missing_or_wrong`);
  if (!conclusionMatched) reasonCodes.push(`math_line_relation_explanation_${input.language}_conclusion_missing_or_wrong`);
  return { language: input.language, answerRecomputed, derivationMatched, conclusionMatched, reasonCodes };
}

export function verifySubjectPracticeMathLineRelationExplanation(
  candidate: GeneratedQuestionCandidate,
  context: { questionPlan?: unknown } = {}
): SubjectPracticeMathLineRelationExplanationEvidence {
  const solverEvidence = solveSubjectPracticeMathLineRelation(candidate, context);
  const checks = (['zh', 'en'] as const).map((language) => checkLanguage({
    candidate,
    language,
    questionPlan: context.questionPlan
  }));
  const reasonCodes = checks.flatMap((check) => check.reasonCodes);
  if (solverEvidence.status !== 'verified') reasonCodes.unshift('math_line_relation_explanation_primary_solver_not_verified');
  const status = solverEvidence.status === 'unparsed'
    ? 'unparsed'
    : reasonCodes.length === 0 ? 'verified' : 'failed';
  return {
    verifierVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_EXPLANATION_VERIFIER_VERSION,
    status,
    solverEvidence,
    recomputedWithoutGeneratorExplanation: true,
    bilingualDerivationAndConclusionChecked: true,
    checks,
    mismatchCount: reasonCodes.length,
    providerImpact: 'none_no_provider_call',
    productionGateImpact: 'none_shadow_only',
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}
