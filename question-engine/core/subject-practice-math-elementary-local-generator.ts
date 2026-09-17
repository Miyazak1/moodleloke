import { GeneratedQuestionCandidate, QuestionGenerationBlueprint, QuestionOption, SubjectPracticeQuestionPlanValidation } from './types';
import { solveElementaryFunctionDirectProperty, SubjectPracticeMathSolverEvidence } from './subject-practice-math-solver';

export const SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION = 'math-elementary-local-generator-v6-formula-evidence';

type LocalGeneratorStatus = 'generated_and_self_verified' | 'unsupported_question_plan' | 'self_verification_failed';

export type SubjectPracticeMathElementaryLocalGenerationResult = {
  generatorVersion: string;
  status: LocalGeneratorStatus;
  candidate: GeneratedQuestionCandidate | null;
  verification: SubjectPracticeMathSolverEvidence | null;
  seed: number;
  scopeId: string | null;
  providerImpact: 'none_no_provider_call';
  estimatedCostUsd: 0;
  productionImpact: 'none_shadow_only';
  reasonCodes: string[];
};

type BilingualOption = { zh: string; en: string; intent: string };

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

function signedTerm(value: number) {
  if (value === 0) return '';
  return value > 0 ? `+${value}` : String(value);
}

function shiftedX(boundary: number) {
  return boundary === 0 ? 'x' : boundary > 0 ? `x-${boundary}` : `x+${Math.abs(boundary)}`;
}

function lowerInterval(boundary: number, closed: boolean) {
  return `${closed ? '[' : '('}${boundary},+∞)`;
}

function upperInterval(boundary: number, closed: boolean) {
  return `(-∞,${boundary}${closed ? ']' : ')'}`;
}

function buildOptions(options: BilingualOption[], correctIndex: number) {
  const correct = options[0];
  const ordered = [...options.slice(1)];
  ordered.splice(correctIndex, 0, correct);
  const zh: QuestionOption[] = ordered.map((option, index) => ({ id: String.fromCharCode(65 + index), text: option.zh }));
  const en: QuestionOption[] = ordered.map((option, index) => ({ id: String.fromCharCode(65 + index), text: option.en }));
  return {
    zh,
    en,
    correctAnswer: zh[correctIndex].id,
    optionMetadata: ordered.map((option, index) => ({
      optionId: zh[index].id,
      distractorIntent: option.intent,
      misconceptionTags: option === correct ? [] : [option.intent]
    }))
  };
}

function candidateForSlot(input: {
  blueprint: QuestionGenerationBlueprint;
  functionClass: string;
  propertyTarget: string;
  seed: number;
}): GeneratedQuestionCandidate | null {
  const { blueprint, functionClass, propertyTarget, seed } = input;
  const correctIndex = seed % 4;
  const variant = seed;
  let prompt = '';
  let promptEn = '';
  let explanation = '';
  let explanationEn = '';
  let knowledgeTags: string[] = [];
  let options: ReturnType<typeof buildOptions> | null = null;

  if (functionClass === 'logarithmic' && propertyTarget === 'domain') {
    const base = pick([0.2, 0.25, 0.5, 2, 3, 5], variant);
    const boundary = (Math.floor(variant / 6) % 22) - 10;
    const argument = shiftedX(boundary);
    prompt = `已知函数 f(x)=log_${base}(${argument})，请选择它的定义域。`;
    promptEn = `For f(x)=log_${base}(${argument}), choose its domain.`;
    explanation = `真数必须大于 0，所以 ${argument}>0，即 x>${boundary}。`;
    explanationEn = `The logarithm argument must be positive, so ${argument}>0 and x>${boundary}.`;
    options = buildOptions([
      { zh: `按真数约束，定义域为 ${lowerInterval(boundary, false)}`, en: `From the argument constraint, the domain is ${lowerInterval(boundary, false)}`, intent: 'correct_domain' },
      { zh: `按真数约束，定义域为 ${lowerInterval(boundary, true)}`, en: `From the argument constraint, the domain is ${lowerInterval(boundary, true)}`, intent: 'included_forbidden_boundary' },
      { zh: `按真数约束，定义域为 ${upperInterval(boundary, false)}`, en: `From the argument constraint, the domain is ${upperInterval(boundary, false)}`, intent: 'reversed_domain_inequality' },
      { zh: '忽略真数约束时会误判定义域为 R', en: 'Ignoring the argument constraint would incorrectly give domain R', intent: 'ignored_logarithm_domain_restriction' }
    ], correctIndex);
    knowledgeTags = ['基本初等函数', '对数函数', '定义域'];
  } else if (functionClass === 'exponential' && propertyTarget === 'range') {
    const base = variant % 128 < 64
      ? Number((0.11 + (variant % 64) * 0.01).toFixed(2))
      : Number((1.1 + (variant % 64) * 0.1).toFixed(1));
    prompt = `函数关系 f(x)=${base}^x 给出每个实数输入的输出；这些输出组成哪一个值域？`;
    promptEn = `The rule f(x)=${base}^x maps real inputs to outputs. Which set is its range?`;
    explanation = `先作零值与负值检验：方程 ${base}^x=0 无实数解，且 f(x)>0。再任取 y>0，令 x=log_${base}(y)，便有 f(x)=y。输出集合因此是 (0,+∞)。`;
    explanationEn = `First test nonpositive outputs: ${base}^x=0 has no real solution and f(x)>0. Next take any y>0 and set x=log_${base}(y); then f(x)=y. The range is therefore (0,+∞).`;
    options = buildOptions([
      { zh: `由 ${base}^x 始终为正，值域为 (0,+∞)`, en: `Because ${base}^x stays positive, the range is (0,+∞)`, intent: 'correct_range' },
      { zh: `若误把极限值 0 算作可取值，会得到值域为 [0,+∞)`, en: `Incorrectly counting the limiting value 0 would give range [0,+∞)`, intent: 'included_unattained_zero' },
      { zh: `若把底数 ${base} 的输入集合混作输出集合，会误写成 (-∞,+∞)`, en: `For base ${base}, confusing the input set with outputs would give (-∞,+∞)`, intent: 'confused_domain_with_range' },
      { zh: `若误认 ${base}^0=1 是下界，会得到值域为 (1,+∞)`, en: `Mistaking ${base}^0=1 for a lower bound would give range (1,+∞)`, intent: 'incorrect_lower_bound_one' }
    ], correctIndex);
    knowledgeTags = ['基本初等函数', '指数函数', '值域'];
  } else if (functionClass === 'radical' && propertyTarget === 'monotonicity') {
    const coefficient = pick([-31, -29, -23, 23, 29, 31], variant);
    const boundaryIndex = Math.floor(variant / 6) % 22;
    const boundary = boundaryIndex < 11 ? boundaryIndex - 70 : boundaryIndex + 49;
    const offset = -coefficient * boundary;
    const expression = `${coefficient}x${signedTerm(offset)}`;
    const increasing = coefficient > 0;
    prompt = `已知函数 f(x)=√(${expression})，判断它在给定区间上的单调性。`;
    promptEn = `For f(x)=sqrt(${expression}), determine its monotonicity on the stated interval.`;
    explanation = increasing
      ? `可取输入由 ${expression}≥0 确定，即 ${lowerInterval(boundary, true)}。任选 u<v，内部量从 u 到 v 的增量是 ${coefficient}(v-u)>0；再开平方仍保持先后，故在该区间单调递增。`
      : `可取输入由 ${expression}≥0 确定，即 ${upperInterval(boundary, true)}。任选 u<v，内部量从 u 到 v 的增量是 ${coefficient}(v-u)<0；再开平方仍保持先后，故在该区间单调递减。`;
    explanationEn = increasing
      ? `Allowed x: ${lowerInterval(boundary, true)}. For u<v: delta-r=${coefficient}(v-u)>0 -> f(u)<f(v). f: increasing; ${lowerInterval(boundary, true)}.`
      : `Allowed x: ${upperInterval(boundary, true)}. For u<v: delta-r=${coefficient}(v-u)<0 -> f(u)>f(v). f: decreasing; ${upperInterval(boundary, true)}.`;
    options = buildOptions(increasing ? [
      { zh: `因内部斜率 ${coefficient}>0，函数在定义域内单调递增`, en: `With inner slope ${coefficient}>0, the function is increasing on its domain`, intent: 'correct_monotonicity' },
      { zh: `若反转内部斜率 ${coefficient} 的作用，会误判为在定义域内单调递减`, en: `Reversing the effect of inner slope ${coefficient} would incorrectly make it decreasing on its domain`, intent: 'reversed_monotonicity' },
      { zh: `若忽略根号约束（内部斜率 ${coefficient}），会误写成在 R 上单调递增`, en: `With inner slope ${coefficient}, ignoring the radical constraint would incorrectly claim increasing on R`, intent: 'ignored_radical_domain' },
      { zh: `忽略可行输入约束，断言函数在 ${upperInterval(boundary, true)} 上单调递增`, en: `Ignoring feasible inputs, claim that the function is increasing on ${upperInterval(boundary, true)}`, intent: 'interval_outside_domain' }
    ] : [
      { zh: `因内部斜率 ${coefficient}<0，函数在定义域内单调递减`, en: `With inner slope ${coefficient}<0, the function is decreasing on its domain`, intent: 'correct_monotonicity' },
      { zh: `若反转内部斜率 ${coefficient} 的作用，会误判为在定义域内单调递增`, en: `Reversing the effect of inner slope ${coefficient} would incorrectly make it increasing on its domain`, intent: 'reversed_monotonicity' },
      { zh: `若忽略根号约束（内部斜率 ${coefficient}），会误写成在 R 上单调递减`, en: `With inner slope ${coefficient}, ignoring the radical constraint would incorrectly claim decreasing on R`, intent: 'ignored_radical_domain' },
      { zh: `忽略可行输入约束，断言函数在 ${lowerInterval(boundary, true)} 上单调递减`, en: `Ignoring feasible inputs, claim that the function is decreasing on ${lowerInterval(boundary, true)}`, intent: 'interval_outside_domain' }
    ], correctIndex);
    knowledgeTags = ['基本初等函数', '根式函数', '单调性'];
  } else if (functionClass === 'power' && propertyTarget === 'function_value') {
    const exponent = pick([1, 2, 3, 4, 5, 6, 7, 8], variant);
    const point = pick([-16, -15, -14, -13, -12, -11, -10, -9, 9, 10, 11, 12, 13, 14, 15, 16], Math.floor(variant / 8));
    const answer = point ** exponent;
    prompt = `对幂函数 f(x)=x^${exponent}，把 x=${point} 代入后，哪一条函数值等式成立？`;
    promptEn = `For the rule f(x)=x^${exponent}, substitute x=${point}; which function-value equation is valid?`;
    explanation = `本题只需完成一次整数幂运算。代入 x=${point} 后，f(${point})=${point}^${exponent}=${answer}；${point < 0 ? `指数 ${exponent} 为${exponent % 2 === 0 ? '偶数，结果取正号' : '奇数，结果保留负号'}` : '底数为正，结果也为正'}。`;
    explanationEn = `Only one integer-power calculation is needed. Substitute x=${point}: f(${point})=${point}^${exponent}=${answer}; ${point < 0 ? `the exponent ${exponent} is ${exponent % 2 === 0 ? 'even, so the result is positive' : 'odd, so the negative sign remains'}` : 'the base is positive, so the result is positive'}.`;
    options = buildOptions([
      { zh: `f(${point})=${answer}`, en: `f(${point})=${answer}`, intent: 'correct_function_value' },
      { zh: `f(${point})=${answer + 1}`, en: `f(${point})=${answer + 1}`, intent: 'arithmetic_plus_one' },
      { zh: `f(${point})=${answer - 1}`, en: `f(${point})=${answer - 1}`, intent: 'arithmetic_minus_one' },
      { zh: `f(${point})=${-answer}`, en: `f(${point})=${-answer}`, intent: 'sign_error' }
    ], correctIndex);
    knowledgeTags = ['基本初等函数', '幂函数', '函数值'];
  }
  if (!options) return null;
  return {
    subject: 'math',
    topicId: blueprint.topicId,
    blueprintId: blueprint.id,
    sourceType: 'ai',
    designedDifficulty: 'basic',
    questionType: 'single_choice',
    prompt,
    options: options.zh,
    correctAnswer: options.correctAnswer,
    explanation,
    knowledgeTags,
    optionMetadata: options.optionMetadata,
    localizations: {
      zh: { prompt, options: options.zh, explanation, knowledgeTags },
      en: { prompt: promptEn, options: options.en, explanation: explanationEn, knowledgeTags: ['Elementary functions'] }
    },
    syllabusVersion: blueprint.syllabusVersion
  };
}

export function createSubjectPracticeMathElementaryLocalGenerator(
  validateSubjectPracticeQuestionPlan: (plan: unknown) => SubjectPracticeQuestionPlanValidation
) {
  return function generateSubjectPracticeMathElementaryLocally(input: {
    blueprint: QuestionGenerationBlueprint;
    questionPlan: unknown;
    seed: number;
  }): SubjectPracticeMathElementaryLocalGenerationResult {
  const seed = normalizedSeed(input.seed);
  const plan = recordFrom(input.questionPlan);
  const constraints = recordFrom(plan?.renderConstraints);
  const functionClass = clean(constraints?.requiredElementaryFunctionClass).toLowerCase();
  const propertyTarget = clean(constraints?.requiredSinglePropertyTarget).toLowerCase();
  const planSupported = clean(input.blueprint.subject).toLowerCase() === 'math'
    && clean(input.blueprint.difficulty).toLowerCase() === 'basic'
    && clean(input.blueprint.questionType).toLowerCase() === 'single_choice'
    && clean(plan?.schemaVersion) === 'subject-practice-question-plan-v1'
    && clean(plan?.policyVersion) === 'subject-practice-question-plan-policy-v1'
    && clean(plan?.subject).toLowerCase() === 'math'
    && clean(plan?.targetDifficulty).toLowerCase() === 'basic'
    && clean(plan?.taskFamily) === 'elementary_function_direct_property'
    && clean(plan?.planTemplate) === 'math_elementary_function_relation_v1'
    && validateSubjectPracticeQuestionPlan(input.questionPlan).valid
    && clean(constraints?.singlePropertyTargetContractVersion) === 'math-basic-elementary-single-property-target-v1'
    && constraints?.forbidCrossPropertyDistractors === true
    && Number(constraints?.maxIndependentRelations) === 1
    && Number(constraints?.maxFunctionObjects) === 1;
  if (!planSupported) {
    return {
      generatorVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
      status: 'unsupported_question_plan',
      candidate: null,
      verification: null,
      seed,
      scopeId: null,
      providerImpact: 'none_no_provider_call',
      estimatedCostUsd: 0,
      productionImpact: 'none_shadow_only',
      reasonCodes: ['math_elementary_local_generator_question_plan_not_supported']
    };
  }
  const candidate = candidateForSlot({ blueprint: input.blueprint, functionClass, propertyTarget, seed });
  if (!candidate) {
    return {
      generatorVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
      status: 'unsupported_question_plan',
      candidate: null,
      verification: null,
      seed,
      scopeId: null,
      providerImpact: 'none_no_provider_call',
      estimatedCostUsd: 0,
      productionImpact: 'none_shadow_only',
      reasonCodes: ['math_elementary_local_generator_rotation_pair_not_supported']
    };
  }
  const verification = solveElementaryFunctionDirectProperty(candidate, { questionPlan: input.questionPlan });
  const verified = verification.status === 'verified' && verification.verificationScope.status === 'matched';
  return {
    generatorVersion: SUBJECT_PRACTICE_MATH_ELEMENTARY_LOCAL_GENERATOR_VERSION,
    status: verified ? 'generated_and_self_verified' : 'self_verification_failed',
    candidate: verified ? candidate : null,
    verification,
    seed,
    scopeId: verification.verificationScope.scopeId,
    providerImpact: 'none_no_provider_call',
    estimatedCostUsd: 0,
    productionImpact: 'none_shadow_only',
    reasonCodes: verified ? [] : ['math_elementary_local_generator_self_verification_failed', ...verification.reasonCodes, ...verification.verificationScope.reasonCodes]
  };
  };
}
