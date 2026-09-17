import {
  GeneratedQuestionCandidate,
  QuestionGenerationBlueprint,
  QuestionOption,
  SubjectPracticeQuestionPlanAdherence,
  SubjectPracticeQuestionPlanPorts
} from './types';
import {
  MathLineRelationScope,
  solveSubjectPracticeMathLineRelation,
  SubjectPracticeMathLineRelationSolverEvidence
} from './subject-practice-math-line-relation-solver';
import {
  verifySubjectPracticeMathLineRelationWithIndependentOracle,
  SubjectPracticeMathLineRelationIndependentOracleEvidence
} from './subject-practice-math-line-relation-independent-oracle';
import {
  verifySubjectPracticeMathLineRelationExplanation,
  SubjectPracticeMathLineRelationExplanationEvidence
} from './subject-practice-math-line-relation-explanation-verifier';

export const SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION =
  'math-line-relation-local-generator-v3';

export type SubjectPracticeMathLineRelationLocalGenerationResult = {
  generatorVersion: string;
  status: 'generated_and_triple_verified' | 'unsupported_question_plan' | 'self_verification_failed';
  candidate: GeneratedQuestionCandidate | null;
  solverEvidence: SubjectPracticeMathLineRelationSolverEvidence | null;
  oracleEvidence: SubjectPracticeMathLineRelationIndependentOracleEvidence | null;
  explanationEvidence: SubjectPracticeMathLineRelationExplanationEvidence | null;
  adherence: SubjectPracticeQuestionPlanAdherence | null;
  seed: number;
  exactScope: MathLineRelationScope | null;
  scopeId: string | null;
  providerImpact: 'none_no_provider_call';
  estimatedCostUsd: 0;
  productionImpact: 'none_shadow_only';
  automaticPublicationEligible: false;
  reasonCodes: string[];
};

type RenderedOption = { zh: string; en: string; intent: string };

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedSeed(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.trunc(number)) : 0;
}

function gcd(left: number, right: number): number {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function fractionText(numerator: number, denominator: number) {
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  const n = sign * numerator / divisor;
  const d = Math.abs(denominator) / divisor;
  return d === 1 ? `${n}` : `${n}/${d}`;
}

function equationText(a: number, b: number, c: number) {
  const term = (coefficient: number, variable: string, first: boolean) => {
    if (coefficient === 0) return '';
    const sign = coefficient < 0 ? '-' : first ? '' : '+';
    const magnitude = Math.abs(coefficient);
    return `${sign}${magnitude === 1 ? '' : magnitude}${variable}`;
  };
  let body = term(a, 'x', true);
  body += term(b, 'y', body.length === 0);
  if (c !== 0) body += `${c > 0 && body ? '+' : ''}${c}`;
  return `${body}=0`;
}

function orderedOptions(values: RenderedOption[], correctIndex: number) {
  const correct = values[0];
  const ordered = values.slice(1);
  ordered.splice(correctIndex, 0, correct);
  const build = (language: 'zh' | 'en'): QuestionOption[] => ordered.map((value, index) => ({
    id: String.fromCharCode(65 + index),
    text: value[language]
  }));
  const zh = build('zh');
  const en = build('en');
  return {
    zh,
    en,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    optionMetadata: ordered.map((value, index) => ({
      optionId: String.fromCharCode(65 + index),
      distractorIntent: value.intent,
      misconceptionTags: value === correct ? [] : [value.intent]
    }))
  };
}

function uniqueFractionOptions(numerator: number, denominator: number): RenderedOption[] {
  const correct = fractionText(numerator, denominator);
  const candidates = [
    { value: fractionText(denominator, numerator), intent: 'delta_x_delta_y_reversed' },
    { value: fractionText(-numerator, denominator), intent: 'slope_sign_error' },
    { value: fractionText(numerator + denominator, denominator), intent: 'slope_add_one_error' },
    { value: fractionText(numerator - denominator, denominator), intent: 'slope_subtract_one_error' },
    { value: '0', intent: 'horizontal_line_assumption' }
  ];
  const seen = new Set([correct]);
  const distractors = candidates.filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  }).slice(0, 3);
  return [{ zh: correct, en: correct, intent: 'correct_slope' }, ...distractors.map((item) => ({ zh: item.value, en: item.value, intent: item.intent }))];
}

function scopeFromPlan(
  questionPlan: unknown,
  validateSubjectPracticeQuestionPlan: SubjectPracticeQuestionPlanPorts['validate']
): MathLineRelationScope | null {
  const plan = object(questionPlan);
  const constraints = object(plan?.renderConstraints);
  const scope = clean(constraints?.exactLineRelationScope) as MathLineRelationScope;
  const allowed: MathLineRelationScope[] = [
    'slope_from_two_distinct_points',
    'inclination_angle_from_line',
    'identify_parallel_or_perpendicular_line',
    'line_equation_from_point_and_slope'
  ];
  return clean(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && clean(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && clean(plan?.subject).toLowerCase() === 'math'
    && clean(plan?.taskFamily) === 'math_line_relation_direct'
    && clean(plan?.planTemplate) === 'math_line_relation_direct_v1'
    && clean(plan?.targetDifficulty).toLowerCase() === 'basic'
    && constraints?.forbidFigureDependency === true
    && constraints?.forbidMultiStageIntersection === true
    && validateSubjectPracticeQuestionPlan(questionPlan).valid
    && allowed.includes(scope)
    ? scope
    : null;
}

function candidateFor(input: {
  blueprint: QuestionGenerationBlueprint;
  seed: number;
  scope: MathLineRelationScope;
}): GeneratedQuestionCandidate {
  const { blueprint, seed, scope } = input;
  const correctIndex = seed % 4;
  let prompt = '';
  let promptEn = '';
  let explanation = '';
  let explanationEn = '';
  let values: RenderedOption[] = [];

  if (scope === 'slope_from_two_distinct_points') {
    const x1 = seed % 7 - 3;
    const y1 = Math.floor(seed / 7) % 7 - 3;
    const dx = [2, 3, 4, 5][Math.floor(seed / 49) % 4];
    const dy = [1, 2, 3, -1, -2, -3][Math.floor(seed / 196) % 6];
    const x2 = x1 + dx;
    const y2 = y1 + dy;
    const slope = fractionText(dy, dx);
    prompt = `已知两点 P(${x1},${y1}) 和 Q(${x2},${y2})，求直线 PQ 的斜率。`;
    promptEn = `Given points P(${x1},${y1}) and Q(${x2},${y2}), find the slope of line PQ.`;
    explanation = `方向增量为 (${dx},${dy})，所以斜率为 Δy/Δx=${dy}/${dx}=${slope}。`;
    explanationEn = `The direction change is (${dx},${dy}), so the slope is Δy/Δx=${dy}/${dx}=${slope}.`;
    values = uniqueFractionOptions(dy, dx);
  } else if (scope === 'inclination_angle_from_line') {
    const slope = [0, 1, -1][Math.floor(seed / 4) % 3];
    const intercept = Math.floor(seed / 12) % 43 - 21;
    const a = -slope; const b = 1; const c = -intercept;
    const expected = slope === 0 ? 0 : slope === 1 ? 45 : 135;
    const orderedAngles = [expected, ...[0, 45, 90, 135].filter((item) => item !== expected)];
    const line = equationText(a, b, c);
    prompt = `直线 l: ${line} 的倾斜角是多少？`;
    promptEn = `What is the inclination angle of line l: ${line}?`;
    explanation = `将直线化为 y=kx+b，得到斜率 k=${slope}，故倾斜角为 ${expected}°。`;
    explanationEn = `Writing the line as y=kx+b gives k=${slope}, so its inclination angle is ${expected}°.`;
    values = orderedAngles.map((angle, index) => ({ zh: `${angle}°`, en: `${angle}°`, intent: index === 0 ? 'correct_exact_angle' : `standard_angle_distractor_${angle}` }));
  } else if (scope === 'identify_parallel_or_perpendicular_line') {
    const pairs = [[1, 2], [2, -1], [3, 1], [1, -3], [2, 3], [3, -2], [4, 1], [1, -4]];
    const [a, b] = pairs[Math.floor(seed / 8) % pairs.length];
    const c = Math.floor(seed / 64) % 8 - 4;
    const relation = Math.floor(seed / 4) % 2 === 0 ? 'parallel' : 'perpendicular';
    const reference = equationText(a, b, c);
    const correct = relation === 'parallel' ? equationText(a, b, c + 1 || 1) : equationText(b, -a, c + 2);
    const coincident = equationText(2 * a, 2 * b, 2 * c);
    const oppositeRelation = relation === 'parallel' ? equationText(b, -a, c - 2) : equationText(a, b, c + 1 || 1);
    const unrelated = equationText(a + b, b - a || 1, c + 3);
    const relationZh = relation === 'parallel' ? '平行' : '垂直';
    prompt = `下列哪条直线与直线 l: ${reference} ${relationZh}？`;
    promptEn = `Which line is ${relation} to line l: ${reference}?`;
    explanation = relation === 'parallel'
      ? '平行直线的法向量成比例，但常数项不能使两直线重合。'
      : '垂直直线的法向量点积为 0。';
    explanationEn = relation === 'parallel'
      ? 'Parallel lines have proportional normal vectors, while the constant term keeps the lines distinct.'
      : 'The normal vectors of perpendicular lines have dot product 0.';
    values = [
      { zh: correct, en: correct, intent: `correct_${relation}_relation` },
      { zh: coincident, en: coincident, intent: 'coincident_not_distinct_parallel' },
      { zh: oppositeRelation, en: oppositeRelation, intent: relation === 'parallel' ? 'negative_reciprocal_confusion' : 'parallel_confusion' },
      { zh: unrelated, en: unrelated, intent: 'unrelated_coefficient_change' }
    ];
  } else {
    const slopes = [[1, 2], [-1, 2], [2, 1], [-2, 1]];
    const [p, q] = slopes[Math.floor(seed / 4) % slopes.length];
    const x = Math.floor(seed / 16) % 7 - 3;
    const y = Math.floor(seed / 112) % 7 - 3;
    const c = q * y - p * x;
    const correct = equationText(p, -q, c);
    const slope = fractionText(p, q);
    const constantError = equationText(p, -q, c + 1);
    const reciprocalError = equationText(q, -p, p * y - q * x);
    const signError = equationText(p, q, -(p * x + q * y));
    prompt = `下列哪一个方程表示经过点 P(${x},${y}) 且斜率为 ${slope} 的直线？`;
    promptEn = `Which equation represents the line through P(${x},${y}) with slope ${slope}?`;
    explanation = `用点斜式 y-${y}=${slope}(x-${x})，整理得到 ${correct}。`;
    explanationEn = `Using point-slope form y-${y}=${slope}(x-${x}) and rearranging gives ${correct}.`;
    values = [
      { zh: correct, en: correct, intent: 'correct_point_slope_equation' },
      { zh: constantError, en: constantError, intent: 'constant_term_sign_or_offset_error' },
      { zh: reciprocalError, en: reciprocalError, intent: 'slope_reciprocal_error' },
      { zh: signError, en: signError, intent: 'slope_sign_error' }
    ];
  }

  const options = orderedOptions(values, correctIndex);
  return {
    subject: 'math', topicId: blueprint.topicId, blueprintId: blueprint.id, sourceType: 'ai',
    designedDifficulty: 'basic', questionType: 'single_choice', prompt, options: options.zh,
    correctAnswer: options.correctAnswer, explanation,
    knowledgeTags: ['解析几何', '直线关系', scope], optionMetadata: options.optionMetadata,
    localizations: {
      zh: { prompt, options: options.zh, explanation, knowledgeTags: ['解析几何', '直线关系'] },
      en: { prompt: promptEn, options: options.en, explanation: explanationEn, knowledgeTags: ['Analytic geometry', 'Line relations'] }
    },
    syllabusVersion: blueprint.syllabusVersion
  };
}

export function createSubjectPracticeMathLineRelationLocalGenerator(ports: SubjectPracticeQuestionPlanPorts) {
  return function generateSubjectPracticeMathLineRelationLocally(input: {
    blueprint: QuestionGenerationBlueprint;
    questionPlan: unknown;
    seed: number;
  }): SubjectPracticeMathLineRelationLocalGenerationResult {
  const seed = normalizedSeed(input.seed);
  const exactScope = scopeFromPlan(input.questionPlan, ports.validate);
  const blueprintSupported = clean(input.blueprint.subject).toLowerCase() === 'math'
    && clean(input.blueprint.difficulty).toLowerCase() === 'basic'
    && clean(input.blueprint.questionType).toLowerCase() === 'single_choice';
  if (!exactScope || !blueprintSupported) {
    return {
      generatorVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION,
      status: 'unsupported_question_plan', candidate: null, solverEvidence: null, oracleEvidence: null, explanationEvidence: null, adherence: null,
      seed, exactScope, scopeId: null, providerImpact: 'none_no_provider_call', estimatedCostUsd: 0,
      productionImpact: 'none_shadow_only', automaticPublicationEligible: false,
      reasonCodes: ['math_line_relation_local_generator_question_plan_not_supported']
    };
  }
  const candidate = candidateFor({ blueprint: input.blueprint, seed, scope: exactScope });
  const context = { questionPlan: input.questionPlan };
  const solverEvidence = solveSubjectPracticeMathLineRelation(candidate, context);
  const oracleEvidence = verifySubjectPracticeMathLineRelationWithIndependentOracle(candidate, context);
  const explanationEvidence = verifySubjectPracticeMathLineRelationExplanation(candidate, context);
  const adherence = ports.adherenceFor(input.questionPlan, candidate);
  const tripleVerified = solverEvidence.status === 'verified'
    && oracleEvidence.status === 'verified'
    && explanationEvidence.status === 'verified'
    && adherence.adheres
    && solverEvidence.scopeId === oracleEvidence.scopeId
    && solverEvidence.selectedOptionId === oracleEvidence.selectedOptionId;
  return {
    generatorVersion: SUBJECT_PRACTICE_MATH_LINE_RELATION_LOCAL_GENERATOR_VERSION,
    status: tripleVerified ? 'generated_and_triple_verified' : 'self_verification_failed',
    candidate: tripleVerified ? candidate : null,
    solverEvidence,
    oracleEvidence,
    explanationEvidence,
    adherence,
    seed,
    exactScope,
    scopeId: tripleVerified ? solverEvidence.scopeId : null,
    providerImpact: 'none_no_provider_call',
    estimatedCostUsd: 0,
    productionImpact: 'none_shadow_only',
    automaticPublicationEligible: false,
    reasonCodes: tripleVerified ? [] : Array.from(new Set([
      'math_line_relation_local_generator_triple_verification_failed',
      ...solverEvidence.reasonCodes,
      ...oracleEvidence.reasonCodes,
      ...explanationEvidence.reasonCodes,
      ...adherence.failureCodes
    ]))
  };
  };
}
