import { Injectable } from '@nestjs/common';
import { GeneratedQuestionCandidate, ReviewContext, ReviewDimension, ReviewProfileAlignment, ReviewResult, ValidationIssue } from './ai-questioning.types';
import { QuestionReviewerProviderService } from './question-reviewer-provider.service';
import { QuestionValidatorService } from './question-validator.service';
import { verifySubjectPracticeFormalCandidate } from './subject-practice-formal-verification-orchestrator';
import { subjectPracticeClassifyTaskFamily } from './subject-practice-task-family-policy';
import { SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION } from './subject-practice-difficulty-evidence-policy-version';

export { SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION } from './subject-practice-difficulty-evidence-policy-version';

const MATH_LOGARITHMIC_DOMAIN_DIFFICULTY_EVIDENCE_PATCH_VERSION = 'math-logarithmic-domain-difficulty-evidence-patch-v1';
const MATH_EXP_LOG_ORDERING_DIFFICULTY_EVIDENCE_PATCH_VERSION = 'math-exp-log-ordering-difficulty-evidence-patch-v1';
const MATH_FUNCTION_PROPERTY_JUDGEMENT_DIFFICULTY_EVIDENCE_PATCH_VERSION = 'math-function-property-judgement-difficulty-evidence-patch-v1';
const MATH_FUNCTION_PARAMETER_CONSTRAINT_DIFFICULTY_EVIDENCE_PATCH_VERSION = 'math-function-parameter-constraint-difficulty-evidence-patch-v1';
const MATH_MULTI_TOPIC_QUESTION_PLAN_DIFFICULTY_EVIDENCE_PATCH_VERSION = 'math-multi-topic-question-plan-difficulty-evidence-patch-v1';

const DIMENSION_ORDER: ReviewDimension['key'][] = [
  'syllabus_alignment',
  'single_correct_answer',
  'option_mutual_exclusion',
  'explanation_supports_answer',
  'difficulty_match',
  'prompt_leakage',
  'duplicate_risk',
  'distractor_quality',
  'domain_sanity'
];

function severityRank(status: ReviewDimension['status']) {
  if (status === 'failed') return 3;
  if (status === 'warning') return 2;
  if (status === 'passed') return 1;
  return 0;
}

function mergeIssues(first: ValidationIssue[], second: ValidationIssue[]) {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const issue of [...first, ...second]) {
    const key = `${issue.severity}:${issue.code}:${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }
  return issues;
}

function mergeDimensions(first: ReviewDimension[], second: ReviewDimension[]): ReviewDimension[] {
  const byKey = new Map<ReviewDimension['key'], ReviewDimension>();
  for (const dimension of [...first, ...second]) {
    const current = byKey.get(dimension.key);
    if (!current || severityRank(dimension.status) >= severityRank(current.status)) {
      byKey.set(dimension.key, dimension);
    }
  }
  return DIMENSION_ORDER.map((key): ReviewDimension => byKey.get(key) ?? { key, status: 'not_checked', note: 'Not checked.' });
}

function statusFrom(issues: ValidationIssue[], dimensions: ReviewDimension[]): ReviewResult['status'] {
  if (issues.some((issue) => issue.severity === 'error') || dimensions.some((dimension) => dimension.status === 'failed')) return 'failed';
  if (issues.length || dimensions.some((dimension) => dimension.status === 'warning' || dimension.status === 'not_checked')) return 'needs_review';
  return 'passed';
}

function guardedStatus(status: ReviewResult['status'], providerStatus?: string): ReviewResult['status'] {
  if (status !== 'passed') return status;
  return providerStatus === 'success' ? 'passed' : 'needs_review';
}

function scoreFromDimension(dimensions: ReviewDimension[], key: ReviewDimension['key']) {
  const status = dimensions.find((dimension) => dimension.key === key)?.status ?? 'not_checked';
  if (status === 'passed') return 92;
  if (status === 'warning') return 72;
  if (status === 'failed') return 35;
  return 65;
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function reviewSubject(value: unknown) {
  const subject = cleanString(value).toLowerCase();
  if (process.env.CSCA_ALLOW_SMOKE_SUBJECTS === 'true') {
    const fixtureSubject = /^smoke_(math|physics|chemistry)_/.exec(subject)?.[1];
    if (fixtureSubject) return fixtureSubject;
  }
  return subject;
}

function optionalStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanString(recordFrom(item).key ?? item)).filter(Boolean)));
}

function localizationHasCompleteOptions(value: unknown, optionIds: string[]) {
  const options = Array.isArray(value) ? value.map(recordFrom) : [];
  const ids = new Set(options.map((option) => cleanString(option.id)).filter(Boolean));
  return optionIds.length === 4 && optionIds.every((id) => ids.has(id));
}

function candidateHasCompleteBilingualLocalization(candidate: GeneratedQuestionCandidate) {
  const optionIds = candidate.options.map((option) => cleanString(option.id)).filter(Boolean);
  const localizations = recordFrom(candidate.localizations);
  const zh = recordFrom(localizations.zh);
  const en = recordFrom(localizations.en);
  return Boolean(
    cleanString(zh.prompt)
    && cleanString(zh.explanation)
    && localizationHasCompleteOptions(zh.options, optionIds)
    && cleanString(en.prompt)
    && cleanString(en.explanation)
    && localizationHasCompleteOptions(en.options, optionIds)
  );
}

function bilingualLocalizationIssues(candidate: GeneratedQuestionCandidate): ValidationIssue[] {
  return candidateHasCompleteBilingualLocalization(candidate)
    ? []
    : [{
      code: 'missing_bilingual_localization',
      severity: 'warning',
      message: 'Subject-practice and online mock exam AI questions require complete Chinese and English prompt/options/explanation before publication.'
    }];
}

function normalizedChemistryIonText(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[＋﹢]/g, '+')
    .replace(/[－﹣−–—]/g, '-');
}

function answerMarksIonAsPresent(text: string, ionPattern: RegExp) {
  const ion = `(?:${ionPattern.source})`;
  return new RegExp(`(?:一定含有|一定含|确定含有|确定含|必含|一定存在|definitelycontains|mustcontain)[^。；;]*${ion}`, 'i').test(text)
    || new RegExp(`${ion}[^。；;]*(?:一定含有|一定含|确定含有|确定含|必含|一定存在|definitelycontains|mustcontain)`, 'i').test(text);
}

function answerMarksIonAsUncertain(text: string, ionPattern: RegExp) {
  const ion = `(?:${ionPattern.source})`;
  return text.split(/[。；;，,]/).some((clause) => (
    new RegExp(`(?:可能含有|可能存在|不能确定|无法确定|无法判断|来源无法判断|是否存在不能确定|maycontain|cannotdetermine|undetermined)[^。；;，,]*${ion}`, 'i').test(clause)
    || new RegExp(`${ion}[^。；;，,]*(?:可能含有|可能存在|不能确定|无法确定|无法判断|来源无法判断|是否存在不能确定|maycontain|cannotdetermine|undetermined)`, 'i').test(clause)
  ));
}

function chemistryAnswerConclusionText(correctOptionText: string, explanation: string) {
  const normalizedExplanation = normalizedChemistryIonText(explanation);
  const conclusionSentences = normalizedExplanation
    .split(/[。；;.!?？]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence
      && /(综上|因此|所以|故|答案|正确|应选|选[a-d]|correct|answer)/i.test(sentence)
      && !/^[a-d][错误]|[a-d]错|错误[:：]/i.test(sentence));
  return normalizedChemistryIonText([correctOptionText, ...conclusionSentences].join(' '));
}

function chemistryIonCoexistenceAnswerIssues(candidate: GeneratedQuestionCandidate, context: ReviewContext): ValidationIssue[] {
  if (reviewSubject(context.subject) !== 'chemistry') return [];
  const topicText = normalizedChemistryIonText(`${context.topicTitle ?? ''} ${context.examScope ?? ''} ${candidate.knowledgeTags.join(' ')}`);
  const correctOptionText = normalizedChemistryIonText(
    candidate.options.find((option) => cleanString(option.id).toUpperCase() === cleanString(candidate.correctAnswer).toUpperCase())?.text
  );
  const conclusionText = chemistryAnswerConclusionText(correctOptionText, candidate.explanation);
  const answerText = normalizedChemistryIonText([
    correctOptionText,
    candidate.explanation
  ].join(' '));
  if (!/(离子|ion|共存|检验|推断|沉淀|溶液)/i.test(`${topicText} ${answerText}`)) return [];

  const ba = /ba(?:2\+|²\+)?|钡离子|ba2/;
  const sulfate = /so(?:4|₄)(?:2-|²-)?|硫酸根/;
  const carbonate = /co(?:3|₃)(?:2-|²-)?|碳酸根/;
  const issues: ValidationIssue[] = [];
  if (answerMarksIonAsUncertain(conclusionText, ba)
    && (answerMarksIonAsPresent(answerText, sulfate) || answerMarksIonAsPresent(answerText, carbonate))) {
    issues.push({
      code: 'chemistry_ion_coexistence_answer_contradiction',
      severity: 'error',
      message: 'Correct answer leaves Ba2+ as possible even though it asserts sulfate/carbonate in the original solution; this contradicts high-school ion coexistence rules for a clear solution.'
    });
  }
  return issues;
}

function weightedKeys(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    const keys = value.map((item) => cleanString(recordFrom(item).key ?? item)).filter(Boolean);
    return keys.length ? Array.from(new Set(keys)) : fallback;
  }
  const record = recordFrom(value);
  const keys = Object.entries(record)
    .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0) || left[0].localeCompare(right[0]))
    .map(([key]) => cleanString(key))
    .filter(Boolean);
  return keys.length ? keys : fallback;
}

function normalizeLoad(value: unknown) {
  return cleanString(value).toLowerCase();
}

function loadBandDistance(first: string, second: string) {
  const rank: Record<string, number> = { none: 0, low: 1, light: 1, medium: 2, high: 3, heavy: 3 };
  const left = rank[first];
  const right = rank[second];
  if (left === undefined || right === undefined) return Number.POSITIVE_INFINITY;
  return Math.abs(left - right);
}

function normalizeDifficultyBand(value: unknown) {
  const normalized = cleanString(value).toLowerCase();
  if (['basic', 'easy', 'foundation', '基础', '入门', 'l1'].includes(normalized)) return 'basic';
  if (['medium', 'normal', 'intermediate', '中等', '中级', 'l2'].includes(normalized)) return 'medium';
  if (['hard', 'advanced', 'difficult', '较难', '提高', '挑战', 'l3'].includes(normalized)) return 'hard';
  return normalized;
}

function normalizeQuestionForm(value: unknown) {
  const normalized = cleanString(value).toLowerCase();
  const aliases: Record<string, string> = {
    calculation_application: 'formula_calculation',
    calculation: 'formula_calculation',
    compute: 'formula_calculation',
    graph_interpretation: 'graph_interpretation',
    diagram_interpretation: 'graph_interpretation',
    diagram_context: 'graph_interpretation',
    concept_check: 'concept_identification',
    concept_judgement: 'concept_identification',
    concept_discrimination: 'concept_identification',
    definition_check: 'definition'
  };
  return aliases[normalized] ?? normalized;
}

function normalizeCognitiveSkill(value: unknown) {
  const normalized = cleanString(value).toLowerCase();
  const aliases: Record<string, string> = {
    standard_application: 'calculation',
    calculation_application: 'calculation',
    multi_step_reasoning: 'calculation',
    problem_solving: 'calculation',
    concept_discrimination: 'concept_identification',
    concept_judgement: 'concept_identification',
    judgement: 'concept_identification',
    application: 'calculation'
  };
  return aliases[normalized] ?? normalized;
}

function isMathLogarithmicDomainConceptJudgement(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'math') return false;
  if (!/(log|lg|ln|\\log|对数)/i.test(bodyText)) return false;
  if (!/(定义域|domain|等价|化简|合并|恒等|解集|方程|不等式|equivalent|simplif|solution set|equation|inequality)/i.test(bodyText)) return false;
  if (!/(下列|以下|哪一|哪项|判断|正确|错误|小华|小丽|小王|which|statement|claim)/i.test(promptText)) return false;
  if (/(大小关系|大小顺序|排序|由大到小|由小到大|比较大小|order|ordering|rank|ranking|compare values)/i.test(bodyText)
    && !/(定义域|domain|等价|化简|合并|恒等|解集|方程|不等式|equivalent|simplif|solution set|equation|inequality)/i.test(promptText)) return false;
  return !/(参数|任意实数|所有实数|证明|讨论|分类讨论|分段|导数|切线|极值|最值|单调区间|integral|prove|parameter|derivative|case)/i.test(bodyText);
}

function isMathExpLogPowerValueOrdering(subject: string, promptText: string, bodyText: string, optionText: string) {
  if (subject !== 'math') return false;
  if (!/(log|lg|ln|\\log|对数|指数|幂|sqrt|\\sqrt|√|\^\s*\d|\d\s*\^)/i.test(bodyText)) return false;
  const namedValueCount = (promptText.match(/\b[a-d]\s*=/gi) ?? []).length;
  const optionOrderingChain = /\b[a-d]\s*[<＞>]\s*[a-d]\s*[<＞>]\s*[a-d]\b/i.test(optionText);
  const expressionOrderingChain = (optionText.match(/[<＜>＞]/g) ?? []).length >= 3
    && /(log|lg|ln|\\log|对数|sqrt|\\sqrt|√|\^\s*\d|\d\s*\^)/i.test(optionText);
  if (namedValueCount < 3 && !optionOrderingChain && !expressionOrderingChain) return false;
  const hasOrderingIntent = /(比较(?:大小)?|大小关系|大小顺序|排序|由大到小|由小到大|order|ordering|rank|ranking|compare values)/i.test(bodyText);
  if (!hasOrderingIntent && !optionOrderingChain && !expressionOrderingChain) return false;
  if (/(参数|任意实数|所有实数|证明|讨论|分类讨论|分段|导数|切线|极值|最值|单调区间|integral|prove|parameter|derivative|case)/i.test(bodyText)) return false;
  const equationOrDomainIntent = /(定义域|domain|等价|化简|合并|恒等|解集|方程|不等式|equivalent|simplif|solution set|equation|inequality)/i.test(promptText);
  return !equationOrDomainIntent || hasOrderingIntent || optionOrderingChain || expressionOrderingChain;
}

function isMathBasicElementaryDirectIdentity(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'math') return false;
  if (!/(计算|求.{0,8}值|化简|calculate|simplif)/i.test(promptText)) return false;
  if (/(比较|大小关系|排序|下列判断|定义域|值域|单调|奇偶|参数|方程|不等式|证明|讨论|classification|ordering|domain|range|monotonic|parameter|equation|inequality|prove)/i.test(bodyText)) return false;
  const directExpLogInverse = /(?:\d+|[a-z])\s*\^\s*\{\s*\\?log[_\{]?\s*(?:\d+|[a-z])|(?:\d+|[a-z])\s*\^\s*\\?log[_\{]?\s*(?:\d+|[a-z])|(?:\d+|[a-z])\s*\^\s*log[_\d]*\s*(?:\d+|[a-z])|[a-z]\s*\^\s*log_[a-z]\s*[a-z]/i.test(bodyText);
  const directRootOrPowerIdentity = /(?:√|\\sqrt)\s*\{\s*\d+\s*\^?2?\s*\}|(?:√|\\sqrt)\s*\d+\s*\^?2|(?:\d+)\s*\^\s*1\s*\/\s*2/i.test(bodyText);
  const compactPrompt = promptText.length <= 90 && (promptText.match(/[=<>≤≥+\-*/^√]|\\frac|\\sqrt|log|ln/gi) ?? []).length <= 4;
  return compactPrompt && (directExpLogInverse || directRootOrPowerIdentity);
}

function isMathMediumCappedDifficultyEvidenceReason(reason: string) {
  return [
    'logarithmic_domain_equivalence_judgement_medium_cap',
    'exp_log_power_value_ordering_medium_cap',
    'function_property_composite_judgement_medium_cap',
    'function_parameter_constraint_judgement_medium_cap'
  ].includes(reason) || /^math_.*_medium_cap$/.test(reason);
}

function isMathHardDifficultyEvidenceReason(reason: string) {
  return /^math_.*_hard_evidence$/.test(reason);
}

function isMathFunctionPropertyCompositeJudgement(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'math') return false;
  if (!/(函数|function|f\s*\()/i.test(bodyText)) return false;
  if (!/(下列|以下|哪一|哪项|判断|正确|错误|which|statement|claim)/i.test(promptText)) return false;
  const propertyCount = [
    /定义域|domain/i,
    /值域|range/i,
    /单调|递增|递减|monotonic|increasing|decreasing/i,
    /奇偶|奇函数|偶函数|parity|odd function|even function/i,
    /对称|关于原点|关于.*轴|symmetr/i,
    /周期|period/i,
    /最值|最大值|最小值|maximum|minimum/i
  ].reduce((count, pattern) => count + (pattern.test(bodyText) ? 1 : 0), 0);
  if (propertyCount < 2) return false;
  return !/(参数|任意实数|所有实数|证明|讨论|分类讨论|分段|导数|切线|极值|integral|prove|parameter|derivative|case)/i.test(bodyText)
    && !/(?:其中|设)?\s*[a-z]\s*,\s*[a-z]\s*∈\s*r|(?:其中|设)?\s*[a-z]\s*,\s*[a-z]\s*\\in\s*r|求出\s*[a-z]\s*,\s*[a-z]|判别式.{0,24}顶点|顶点.{0,24}判别式/i.test(bodyText);
}

function isMathBasicElementarySinglePropertyFromPlan(
  subject: string,
  promptText: string,
  bodyText: string,
  context?: ReviewContext,
  studentFacingText?: string
) {
  if (subject !== 'math' || !context || !isSubjectPracticeContext(context, 'math')) return false;
  const questionPlan = recordFrom(context?.questionPlan);
  if (cleanString(questionPlan?.planTemplate) !== 'math_elementary_function_relation_v1'
    || cleanString(questionPlan?.taskFamily) !== 'elementary_function_direct_property') return false;
  const renderConstraints = recordFrom(questionPlan?.renderConstraints);
  const explicitPropertyTarget = cleanString(renderConstraints?.requiredSinglePropertyTarget).toLowerCase();
  if (explicitPropertyTarget && !['domain', 'range', 'monotonicity', 'function_value'].includes(explicitPropertyTarget)) return false;
  if (Number(renderConstraints?.maxIndependentRelations) !== 1
    || (renderConstraints?.maxFunctionObjects != null && Number(renderConstraints.maxFunctionObjects) !== 1)
    || (renderConstraints?.forbidCrossPropertyDistractors != null && renderConstraints.forbidCrossPropertyDistractors !== true)) return false;
  const targetProfile = recordFrom(context?.targetProfile);
  if (normalizeDifficultyBand(targetProfile?.difficultyBand) !== 'basic') return false;
  if (!/(?:f\s*\(\s*x\s*\)\s*=|y\s*=).{0,100}(?:log|lg|ln|对数|\^\s*x|x\s*\^|指数|幂|sqrt|\\sqrt|√|根式|根号)/i.test(promptText)) return false;
  const propertyEvidenceText = studentFacingText || bodyText;
  if (/(比较|大小关系|排序|方程|求\s*x|参数|证明|讨论|分段|导数|compare|ordering|equation|solve|parameter|prove|piecewise|derivative)/i.test(propertyEvidenceText)) return false;
  const propertyEvidencePatterns = {
    domain: /定义域|domain/i,
    range: /值域|range/i,
    monotonicity: /单调|递增|递减|monotonic|increasing|decreasing/i,
    function_value: /函数值(?!域)|f\s*\(\s*-?\d+(?:\.\d+)?\s*\)|function value/i
  };
  const promptPropertyTargets = Object.entries(propertyEvidencePatterns)
    .filter(([, pattern]) => pattern.test(promptText))
    .map(([propertyTarget]) => propertyTarget);
  const requiredPropertyTarget = explicitPropertyTarget || (promptPropertyTargets.length === 1 ? promptPropertyTargets[0] : '');
  if (!requiredPropertyTarget) return false;
  const requiredPropertyEvidence = propertyEvidencePatterns[requiredPropertyTarget as keyof typeof propertyEvidencePatterns];
  return requiredPropertyEvidence.test(propertyEvidenceText);
}

function isMathBasicDerivativeDirectFromPlan(
  subject: string,
  promptText: string,
  context?: ReviewContext,
  studentFacingText?: string
) {
  if (subject !== 'math' || !context || !isSubjectPracticeContext(context, 'math')) return false;
  const questionPlan = recordFrom(context.questionPlan);
  if (cleanString(questionPlan.planTemplate) !== 'math_derivative_condition_chain_v1'
    || cleanString(questionPlan.taskFamily) !== 'derivative_direct_evaluation') return false;
  const renderConstraints = recordFrom(questionPlan.renderConstraints);
  if (cleanString(renderConstraints.exactDerivativeScope) !== 'direct_polynomial_value'
    || renderConstraints.forbidBasicDerivativeComplexity !== true
    || renderConstraints.forbidBasicDerivativeDomainTrap !== true
    || Number(renderConstraints.maxBasicDerivativeReasoningMoves) !== 1) return false;
  const targetProfile = recordFrom(context.targetProfile);
  if (normalizeDifficultyBand(targetProfile.difficultyBand) !== 'basic') return false;
  const visible = studentFacingText || promptText;
  if (!/(?:f\s*\(\s*x\s*\)\s*=).{1,90}(?:x\s*(?:\^\s*[23]|[²³])|x).{0,40}f\s*['′]\s*[（(]\s*-?\d+\s*[)）]/i.test(promptText)) return false;
  if (/(切线|斜率|法线|单调|递增|递减|极值|最值|区间|参数|范围|存在|恒成立|分段|定义域|不可导|链式|复合|隐函数|高阶|sin|cos|tan|ln|log|sqrt|根式|根号|tangent|slope|normal line|monotonic|extremum|interval|parameter|range|piecewise|domain|chain rule|implicit|higher derivative)/i.test(visible)) return false;
  return promptText.length <= 140;
}

function isPhysicsDirectLinearVtGraphConceptJudgement(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'physics') return false;
  if (!/(?:v\s*[-–—]?\s*t|速度\s*[-–—]?\s*时间).{0,12}(?:图像|图|graph)/i.test(bodyText)) return false;
  if (!/(直线|均匀增大|均匀减小|匀变速|斜率|加速度恒定|linear|uniform|constant acceleration)/i.test(bodyText)) return false;
  if (!/(判断|下列|正确|错误|说明|可知|which|statement|infer)/i.test(promptText)) return false;
  return !/(分段|折线|曲线|面积|位移.{0,12}(?:求|计算|多少)|多物体|两物体|追及|相遇|数值|坐标|table|piecewise|area|calculate|how much|two objects)/i.test(promptText);
}

function isPhysicsDirectLinearStGraphConceptJudgement(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'physics') return false;
  if (!/(?:s\s*[-–—]?\s*t|x\s*[-–—]?\s*t|位移\s*[-–—]?\s*时间|位置\s*[-–—]?\s*时间).{0,12}(?:图像|图|graph)/i.test(bodyText)) return false;
  if (!/(直线|过原点|斜率|匀速|linear|straight line|slope|constant velocity)/i.test(bodyText)) return false;
  if (!/(判断|下列|正确|错误|说明|可知|which|statement|infer)/i.test(promptText)) return false;
  return !/(分段|折线|曲线|面积|加速度.{0,12}(?:求|计算|多少)|追及|相遇|表格|table|piecewise|curve|area|acceleration.{0,12}(?:calculate|find)|catch up|meet)/i.test(promptText);
}

function isChemistryQualitativePhPaperWettingJudgement(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'chemistry') return false;
  if (!/(?:p\s*h|ph)\s*试纸|试纸.{0,12}(?:p\s*h|ph)/i.test(bodyText)) return false;
  if (!/(蒸馏水.{0,12}润湿|润湿.{0,12}(?:试纸|p\s*h)|先.{0,12}润湿|wet.{0,20}(?:paper|strip)|moisten)/i.test(bodyText)) return false;
  if (!/(偏大|偏小|不变|实际值|测得|读数|larger|smaller|unchanged|reading)/i.test(bodyText)) return false;
  return !/(滴定|容量瓶|定容|物质的量|质量分数|误差上限|误差下限|不确定度|\d+(?:\.\d+)?\s*(?:mol|mmol|ml|l)\b|titration|volumetric|uncertainty)/i.test(promptText);
}

function isChemistryBasicVolumetricPreparationErrorJudgement(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'chemistry') return false;
  if (!/(配制|容量瓶|定容|移液|洗涤烧杯|volumetric|prepare.{0,20}solution)/i.test(bodyText)) return false;
  if (!/(浓度|p\s*h|concentration).{0,24}(?:偏高|偏低|增大|减小|higher|lower|increase|decrease)|(?:偏高|偏低|增大|减小|higher|lower).{0,24}(?:浓度|p\s*h|concentration)/i.test(bodyText)) return false;
  if (!/(下列|以下|哪一|哪项|正确|错误|导致|which|statement|operation)/i.test(promptText)) return false;
  return !/(求得|计算结果|准确计算|滴定曲线|缓冲容量|不确定度|误差上限|误差下限|calculate the exact|titration curve|buffer capacity|uncertainty)/i.test(promptText);
}

function isMathBasicDirectFunctionPointMembership(subject: string, promptText: string, optionText: string, bodyText: string) {
  if (subject !== 'math') return false;
  if (!/(?:已知|设).{0,12}(?:函数|f\s*\()|f\s*\(\s*x\s*\)\s*=/i.test(promptText)) return false;
  if (!/(?:点|坐标).{0,18}(?:图像|图象)上|(?:图像|图象)上.{0,18}(?:点|坐标)|point.{0,20}(?:graph|function)/i.test(promptText)) return false;
  const coordinateOptionCount = (optionText.match(/[（(]\s*[+-]?\d+(?:\.\d+)?\s*[,，]\s*[+-]?\d+(?:\.\d+)?\s*[)）]/g) ?? []).length;
  if (coordinateOptionCount < 3) return false;
  return !/(参数|分段|复合函数|反函数|交点个数|切线|导数|不等式组|含参不等式|二次不等式|联立不等式|任意|所有|恒成立|parameter|piecewise|composite|inverse|tangent|derivative|system of inequalities|parametric inequality|quadratic inequality|for all)/i.test(bodyText);
}

function isMathBasicDirectQuadraticSingleProperty(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'math') return false;
  if (!/(?:二次函数|quadratic function).{0,20}f\s*\(\s*x\s*\)|f\s*\(\s*x\s*\)\s*=.{0,40}(?:x²|x\s*\^\s*2)/i.test(promptText)) return false;
  if (!/(下列|以下|哪一|哪项|判断|正确|错误|which|statement)/i.test(promptText)) return false;
  const propertyCount = countRegexHits(promptText, [
    /对称轴|axis of symmetry|symmetry axis/i,
    /开口(?:方向|向上|向下)|opens? (?:up|down)|opening direction/i,
    /顶点|vertex/i,
    /零点|根(?:是|为|等于)|zeros?|roots?/i,
    /定义域|domain/i,
    /值域|range/i,
    /最值|最大值|最小值|maximum|minimum/i,
    /单调|递增|递减|monotonic|increasing|decreasing/i
  ]);
  if (propertyCount !== 1) return false;
  return !/(参数|任意.{0,12}(?:参数|实数)|分类讨论|分段|复合函数|对数|指数函数|\blog\b|\bln\b|导数|切线|恒成立|存在.{0,16}(?:参数|范围)|parameter|case analysis|piecewise|composite|logarithm|exponential function|derivative|tangent|for all)/i.test(bodyText);
}

function isMathFunctionParameterConstraintJudgement(subject: string, promptText: string, bodyText: string) {
  if (subject !== 'math') return false;
  if (!/(函数|function|f\s*\(|g\s*\(|log|lg|ln|\\log|二次函数|quadratic|x²|x\^2)/i.test(bodyText)) return false;
  if (!/(下列|以下|哪一|哪项|判断|正确|错误|which|statement|claim)/i.test(promptText)) return false;
  const hasParameter = /(参数|parameter|a\s*[,，、]\s*b\s*(?:[∈∊]\s*r|为实数|是实数|in\s*r)|a\s*[∈∊]\s*r|b\s*[∈∊]\s*r|其中\s*[a-z]\s*,\s*[a-z]\s*∈\s*r)/i.test(bodyText);
  if (!hasParameter) return false;
  const propertyCount = [
    /定义域|domain/i,
    /值域|range/i,
    /单调|递增|递减|monotonic|increasing|decreasing/i,
    /对称|对称轴|关于.*轴|axis|symmetr/i,
    /顶点|vertex/i,
    /判别式|discriminant/i,
    /最值|最大值|最小值|maximum|minimum/i
  ].reduce((count, pattern) => count + (pattern.test(bodyText) ? 1 : 0), 0);
  if (propertyCount < 2) return false;
  return !/(证明|讨论|分类讨论|分段|导数|切线|极值|integral|prove|derivative|case analysis|piecewise|tangent)/i.test(bodyText);
}

function countRegexHits(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

function mathProbabilityQuestionPlanEvidence(evidenceText: string, namedConditionCount: number) {
  const empty = { reason: '', hard: false, medium: false };
  const normalFrame = /(正态分布|标准正态|标准化|z\s*=|z[-_ ]?score|normal distribution|standard normal|standardi[sz])/i.test(evidenceText);
  const probabilityFrame = normalFrame || /(概率|古典概型|随机|样本空间|抽取|放回|不放回|摸球|掷|骰子|硬币|卡片|排列|组合|binomial|probability|sample space|draw)/i.test(evidenceText);
  if (!probabilityFrame) return empty;
  if (normalFrame) {
    const normalRelationHits = countRegexHits(evidenceText, [
      /正态分布|标准正态|normal distribution|standard normal/i,
      /标准化|z\s*=|z[-_ ]?score|standardi[sz]/i,
      /Φ\s*\(|分位数|临界值|quantile|critical value/i,
      /双尾|单尾|尾概率|对称性|two[- ]?tail|one[- ]?tail|tail probability|symmetry/i,
      /均值|标准差|μ|σ|mu|sigma|mean|standard deviation/i,
      /低于|高于|超过|不少于|不超过|less than|greater than|above|below/i
    ]);
    const normalHardStructure = normalRelationHits >= 4
      && (/(双尾|单尾|尾概率|分位数|反标准化|求.{0,12}(?:均值|标准差|μ|σ)|two[- ]?tail|one[- ]?tail|tail probability|quantile|inverse standardi[sz]ation|mean|standard deviation)/i.test(evidenceText)
        || namedConditionCount >= 3);
    if (normalRelationHits >= 3) return {
      reason: normalHardStructure ? 'math_probability_multi_event_relation_hard_evidence' : 'math_probability_multi_event_relation_medium_cap',
      hard: normalHardStructure,
      medium: true
    };
  }
  const eventLabelCount = (evidenceText.match(/事件\s*[ABCD]|事件[一二三四]|event\s*[ABCD]/gi) ?? []).length;
  const hasSampleFrame = /(样本空间|总数|所有可能|基本事件|从.{0,12}(?:中|里).{0,12}(?:选|取|抽)|共有|总共有|\d+\s*(?:个|张|球|人|次|件)|c\s*[\(（]|a\s*[\(（]|sample space|total outcomes?)/i.test(evidenceText);
  const relationHits = countRegexHits(evidenceText, [
    /至少|至多|恰好|不少于|不超过|不多于|exactly|at least|at most/i,
    /条件概率|给定|已知.*发生|在.*条件下|conditional|given/i,
    /互斥|独立|相互独立|并|交|补|complement|intersection|union|independent|mutually exclusive/i,
    /先.*(?:再|后)|第[一二三四1-4]次|连续|不放回|放回|without replacement|with replacement/i,
    /分类|分情况|情况[一二三四]|\bcases?\b|case split/i,
    /关系|比较|大小|比值|条件|限制|relation|compare|restriction/i
  ]) + Math.min(eventLabelCount, 2);
  if (!hasSampleFrame || relationHits < 2) return empty;

  const hardCaseOrComplement = /(分类|分情况|情况[一二三四]|\bcases?\b|case split|补事件|补集|complement)/i.test(evidenceText);
  const hardConditionalRestriction = /(条件概率|给定|conditional|given)/i.test(evidenceText)
    && /(独立|互斥|不放回|先.*(?:再|后)|连续|限制|without replacement|restriction)/i.test(evidenceText)
    && relationHits >= 4;
  const hardStructure = (hardCaseOrComplement || hardConditionalRestriction || namedConditionCount >= 5)
    && (relationHits >= 3 || namedConditionCount >= 4);
  return {
    reason: hardStructure ? 'math_probability_multi_event_relation_hard_evidence' : 'math_probability_multi_event_relation_medium_cap',
    hard: hardStructure,
    medium: true
  };
}

function mathDerivativeQuestionPlanEvidence(evidenceText: string, promptText: string, namedConditionCount: number) {
  const empty = { reason: '', hard: false, medium: false };
  const derivativeFrame = /(导数|导函数|求导|微分|f\s*['′]\s*\(|derivative|differentiat)/i.test(evidenceText);
  if (!derivativeFrame) return empty;
  const directDerivativeOnly = /(求|计算|what is|find).{0,20}f\s*['′]\s*[\(（][^)）]+[\)）]/i.test(promptText)
    && !/(切线|斜率|单调|递增|递减|极值|最值|区间|参数|范围|存在|tangent|slope|monotonic|extremum|interval|parameter|range)/i.test(promptText);
  if (directDerivativeOnly) return empty;
  const derivativeRelationHits = countRegexHits(evidenceText, [
    /f\s*['′]\s*\(|导函数|求导|derivative|differentiat/i,
    /切线|斜率|法线|tangent|slope|normal line/i,
    /单调|递增|递减|增区间|减区间|区间|monotonic|increasing|decreasing|interval/i,
    /极值|最值|最大值|最小值|maximum|minimum|extremum/i,
    /参数|范围|存在|恒成立|取值|parameter|range|exists/i,
    /符号|正负|零点|临界点|sign chart|critical point/i
  ]);
  const hasDerivativeLinkedCondition = /(切线|斜率|单调|递增|递减|极值|最值|区间|参数|范围|存在|恒成立|tangent|slope|monotonic|extremum|interval|parameter|range)/i.test(evidenceText);
  if (!hasDerivativeLinkedCondition || derivativeRelationHits < 2) return empty;

  const hasSignIntervalEvidence = /(单调|递增|递减|区间|符号|正负|零点|临界点|sign chart|monotonic|interval|critical point)/i.test(evidenceText);
  const hasConstraintEvidence = /(参数|范围|存在|恒成立|极值|最值|切线|斜率|parameter|range|exists|extremum|maximum|minimum|tangent|slope)/i.test(evidenceText);
  const hasParameterOrRangeConstraint = /(参数|范围|恒成立|取值|parameter|range)/i.test(evidenceText);
  const hasExistenceExtremumConstraint = /(存在|exists).{0,40}(极值|最值|maximum|minimum|extremum)|(?:极值|最值|maximum|minimum|extremum).{0,40}(存在|exists)/i.test(evidenceText)
    && /(参数|范围|取值|零点|符号区间|parameter|range|critical point|sign chart|a\s*=|b\s*=)/i.test(evidenceText);
  const hasHardConstraintEvidence = hasParameterOrRangeConstraint
    || hasExistenceExtremumConstraint
    || (namedConditionCount >= 5 && /(极值|最值|maximum|minimum|extremum)/i.test(evidenceText));
  const hardStructure = hasSignIntervalEvidence
    && hasConstraintEvidence
    && hasHardConstraintEvidence
    && (derivativeRelationHits >= 3 || namedConditionCount >= 4);
  return {
    reason: hardStructure ? 'math_derivative_condition_chain_hard_evidence' : 'math_derivative_condition_chain_medium_cap',
    hard: hardStructure,
    medium: true
  };
}

function mathTopicQuestionPlanEvidence(subject: string, promptText: string, bodyText: string) {
  const empty = { reason: '', hard: false, medium: false };
  if (subject !== 'math') return empty;
  const evidenceText = `${promptText} ${bodyText}`;
  const optionJudgement = /(下列|以下|哪一|哪项|判断|正确|错误|关系|比较|which|statement|claim|relation|compare)/i.test(evidenceText);
  const namedConditionCount = (promptText.match(/[①②③④⑤⑥]|\b[ABCD]\s*[:：]|事件\s*[ABCD]|条件|已知|若|设|其中|分别|同时|满足/g) ?? []).length;
  const relationCount = (evidenceText.match(/=|≤|≥|<|>|∈|⊥|∥|≈|≠|相等|大于|小于|递增|递减|单调|垂直|平行|切线|相切|方差|平均数|概率|期望|夹角|距离|长度/g) ?? []).length;
  const hardCue = /(参数|任意|所有|存在|范围|最值|最大|最小|分类|讨论|证明|综合|隐藏|多条件|多约束|multi.?constraint|parameter|range|maximum|minimum|prove|case)/i.test(evidenceText)
    || namedConditionCount >= 5;
  const probabilityEvidence = mathProbabilityQuestionPlanEvidence(evidenceText, namedConditionCount);
  if (probabilityEvidence.reason) return probabilityEvidence;
  const vectorComplexAnchor = /(向量|复数|模长|模为|点积|数量积|单位向量|共线|虚部|实部|argument|complex|vector|dot product|norm)/i.test(evidenceText)
    || (/(坐标|coordinate)/i.test(evidenceText) && /(向量|复数|复平面|vector|complex|\([^)]+[,，][^)]+\))/i.test(evidenceText));
  const vectorComplexRelation = vectorComplexAnchor
    && countRegexHits(evidenceText, [/坐标|\(|（|-?\d+[,，]-?\d+|复平面/i, /模|长度|norm|absolute/i, /点积|数量积|夹角|垂直|平行|共线|angle|dot|parallel|perpendicular/i]) >= 2;
  if (vectorComplexRelation) return {
    reason: hardCue ? 'math_vector_complex_multi_relation_hard_evidence' : 'math_vector_complex_relation_medium_cap',
    hard: hardCue,
    medium: true
  };
  const derivativeEvidence = mathDerivativeQuestionPlanEvidence(evidenceText, promptText, namedConditionCount);
  if (derivativeEvidence.reason) return derivativeEvidence;
  const analyticGeometryRelation = /(解析几何|圆|直线|椭圆|抛物线|双曲线|弦|切线|圆心|半径|距离|斜率|coordinate geometry|circle|line|chord|tangent)/i.test(evidenceText)
    && countRegexHits(evidenceText, [/圆|circle|圆心|半径/i, /直线|line|斜率|slope/i, /弦|距离|相切|交点|tangent|chord|distance|intersection/i]) >= 2;
  if (analyticGeometryRelation) return {
    reason: hardCue ? 'math_analytic_geometry_multi_relation_hard_evidence' : 'math_analytic_geometry_relation_medium_cap',
    hard: hardCue,
    medium: true
  };
  const sequenceRelation = /(数列|等差|等比|通项|递推|前n项|前 n 项|a_n|an\b|aₙ|a1|a_1|公差|公比|sequence|arithmetic|geometric)/i.test(evidenceText)
    && countRegexHits(evidenceText, [/a_?1|首项|first term/i, /公差|公比|d\s*=|q\s*=|common difference|common ratio/i, /a_?n|通项|前n项|s_?n|递推|recurrence/i, /两个|两项|条件|联立|solve|求/i]) >= 2;
  if (sequenceRelation) return {
    reason: hardCue ? 'math_sequence_multi_constraint_hard_evidence' : 'math_sequence_condition_relation_medium_cap',
    hard: hardCue,
    medium: true
  };
  const statisticsRelation = /(统计|平均数|均值|方差|标准差|中位数|数据|样本|频率|正态分布|期望|variance|mean|standard deviation|normal distribution|dataset)/i.test(evidenceText)
    && countRegexHits(evidenceText, [/平均数|均值|mean/i, /方差|标准差|variance|standard deviation/i, /数据|样本|频率|正态|区间|dataset|normal/i]) >= 2;
  if (statisticsRelation) return {
    reason: hardCue ? 'math_statistics_multi_step_inference_hard_evidence' : 'math_statistics_relation_medium_cap',
    hard: hardCue,
    medium: true
  };
  const spatialGeometryRelation = /(空间|立体几何|空间直角坐标|平面|直线|点到|线面角|二面角|法向量|空间向量|投影|spatial|solid geometry|plane|normal vector|projection)/i.test(evidenceText)
    && countRegexHits(evidenceText, [/空间|平面|直线|spatial|plane|line/i, /坐标|向量|法向量|normal vector|coordinate/i, /距离|夹角|投影|垂直|平行|distance|angle|projection|perpendicular|parallel/i]) >= 2;
  if (spatialGeometryRelation) return {
    reason: hardCue ? 'math_spatial_geometry_multi_constraint_hard_evidence' : 'math_spatial_geometry_relation_medium_cap',
    hard: hardCue,
    medium: true
  };
  if (optionJudgement && namedConditionCount >= 3 && relationCount >= 4) {
    return {
      reason: hardCue ? 'math_multi_condition_judgement_hard_evidence' : 'math_multi_condition_judgement_medium_cap',
      hard: hardCue,
      medium: true
    };
  }
  return empty;
}

function inferQuestionShape(candidate: GeneratedQuestionCandidate) {
  const subject = reviewSubject(candidate.subject);
  const prompt = cleanString(candidate.prompt);
  const optionText = candidate.options.map((option) => cleanString(option.text)).join(' ');
  const correctOptionText = cleanString(candidate.options.find((option) => cleanString(option.id).toUpperCase() === cleanString(candidate.correctAnswer).toUpperCase())?.text);
  const explanation = cleanString(candidate.explanation);
  const text = `${prompt} ${optionText} ${explanation}`.toLowerCase();
  const promptText = prompt.toLowerCase();
  const mathBasicDirectFunctionPointMembership = isMathBasicDirectFunctionPointMembership(subject, promptText, optionText, text);
  const mathBasicDirectQuadraticSingleProperty = isMathBasicDirectQuadraticSingleProperty(subject, promptText, text);
  const coordinateTuplePattern = /[a-zA-Z\u4e00-\u9fa5]?\s*[\(（]\s*-?\d+(?:\s*[,，]\s*-?\d+){1,3}\s*[\)）]/g;
  const coordinateTupleCount = (prompt.match(coordinateTuplePattern) ?? []).length;
  const promptForConditionCount = prompt
    .replace(coordinateTuplePattern, '(坐标)')
    .replace(/(\d)\.(\d)/g, '$1·$2');
  const hasNumbers = /\d/.test(text);
  const hasFormula = /[=<>≤≥+\-*/^√]|\\frac|\\sqrt|sin|cos|tan|log|ln|mol|ph|j\b|n\b|v\b|a\b|f\b|p\b/.test(text);
  const hasDiagram = /图像|图形|示意图|函数图像|坐标图|image|diagram|graph/.test(text);
  const hasTable = /表格|数据表|统计表|table|dataset/.test(text);
  const hasScenario = /实验|情境|实际|应用|experiment|scenario|given|已知/.test(promptText);
  const asksJudgement = /正确|不正确|错误|符合|不符合|which|statement|best|判断|原因|预计|预测|观察到的现象|现象是/.test(text);
  const explicitJudgementPrompt = /下列|以下|哪一|哪项|哪步|哪一步|哪个|正确|不正确|错误|符合|不符合|判断|预计|预测|观察到的现象|现象是|which|statement|best/.test(promptText);
  const explicitErrorDiagnosis = /第一个错误|错误出现|哪步|哪一步|first invalid|first error|invalid step/.test(promptText);
  const chemistryEquilibriumQuantitativeSignal = (
    /(反应商|平衡常数|转化率|产率|浓度商|\bq\b|\bk\b|q\s*[<=>]|[<=>]\s*k|q\s*与.{0,12}k|k\s*与.{0,12}q)/i.test(promptText)
    && /(关系|比较|判断|移动|方向|变化|增大|减小|浓度|物质的量|压强|体积|温度|equilibrium|shift|constant|quotient|yield|conversion)/i.test(promptText)
  ) || (
    subject === 'chemistry'
    && /(平衡|可逆反应|勒夏特列|equilibrium|reversible reaction|le chatelier|⇌|↔|<=>)/i.test(promptText)
    && /\d/.test(promptText)
    && /(?:反应商|平衡常数|Kc|Qc|\bQ\b|\bK\b)\s*[=＝]\s*[^。；;，,]*(?:\d|\(|（|×|\/|\*)/i.test(text)
    && /(?:反应商|\bQ\b|Qc).{0,80}(?:>|<|=|大于|小于|等于).{0,40}(?:平衡常数|\bK\b|Kc)|(?:平衡常数|\bK\b|Kc).{0,80}(?:>|<|=|大于|小于|等于).{0,40}(?:反应商|\bQ\b|Qc)/i.test(text)
    && /(计算|比较|判断|移动|方向|变化|转化率|产率|催化剂|calculate|compare|shift|conversion|yield|catalyst)/i.test(text)
  );
  const chemistryEquilibriumRateRatioSignal = /(平衡|反应商|平衡常数|速率|分压|浓度|体积|equilibrium|quotient|rate|partial pressure|concentration|volume)/i.test(text)
    && /(减半|加倍|倍|同倍|1\/2|1\/4|2倍|二倍|half|double|quarter|times)/i.test(text)
    && /(q|k|反应商|平衡常数|浓度|分压|速率|正、逆|正逆|正反应速率|逆反应速率|equilibrium|rate)/i.test(text);
  const calculationCommand = /解方程|解不等式|求解|求|计算|solve|calculate|find|多少|值|计算结果|结果(?:为|是|等于)|大小|示数|读数|概率/.test(promptText)
    || /(?:求|计算|测定|determine|find).{0,16}(浓度|体积|速度|加速度|物质的量|质量|速率|平衡常数|转化率|产率|concentration|volume|rate|mass|yield)/i.test(promptText)
    || /(浓度|体积|速度|加速度|物质的量|质量|电子数|转移.{0,8}电子|速率|平衡常数|转化率|产率|concentration|volume|rate|mass|yield|amount).{0,18}(?:为|是|等于|=|多少|\?|？|\（|\()/i.test(promptText);
  const quantitativeReasoningCommand = /推算|预测|估算|换算|比较|差值|变化量|最接近|约为|predict|estimate|compare/.test(promptText);
  const formulaTask = hasFormula && /方程|不等式|函数|表达式|式子|equation|inequality|function|expression/.test(promptText);
  const chemistryEquationChoiceSignal = /(离子方程式|化学方程式|方程式|反应式|ionic equation|chemical equation|equation).{0,24}(正确|表示|写出|选择|是|应为|which|represents|correct)/i.test(promptText)
    || /(正确|表示|写出|选择|是|应为|which|represents|correct).{0,24}(离子方程式|化学方程式|方程式|反应式|ionic equation|chemical equation|equation)/i.test(promptText);
  const judgementLikeSignal = asksJudgement || chemistryEquationChoiceSignal || mathBasicDirectFunctionPointMembership || mathBasicDirectQuadraticSingleProperty;
  const explicitJudgementLikePrompt = explicitJudgementPrompt || chemistryEquationChoiceSignal;
  const chemistryFormulaContextJudgementSignal = judgementLikeSignal
    && explicitJudgementLikePrompt
    && !calculationCommand
    && /(⇌|→|化学|反应|平衡|离子|沉淀|气体|溶液|酸|碱|盐|so2|so3|co2|na|ca|ba|cl|oh|hco3|chem|reaction|equilibrium|ion|precipitate|solution)/i.test(promptText);
  const chemistryCatalystConceptJudgementSignal = subject === 'chemistry'
    && judgementLikeSignal
    && explicitJudgementLikePrompt
    && /(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(text)
    && /(催化剂|v₂o₅|v2o5|catalyst)/i.test(text)
    && /(速率|反应速率|正反应速率|逆反应速率|先达到平衡|达到平衡.{0,12}(?:先|快|慢|时间)|所需时间|rate|time to equilibrium)/i.test(text)
    && !/(反应商|平衡常数.{0,12}(?:计算|求|为|=|多少|大小|比较)|Kc|Qc|\bQ\b|\bK\b|计算|求|是多少|图|表|曲线|转化率|产率|reaction quotient|equilibrium constant.{0,24}(?:calculate|compare|value)|calculate|graph|curve|table|conversion|yield)/i.test(text);
  const chemistryRateTimeIntervalCount = subject === 'chemistry'
    ? (promptText.match(/\d+\s*(?:～|~|至|到|-|–|—)\s*\d+\s*(?:min|分钟)/gi) ?? []).length
    : 0;
  const chemistrySegmentedAverageRateData = subject === 'chemistry'
    && chemistryRateTimeIntervalCount >= 2
    && /(反应速率|速率|平均反应速率|平均速率|生成h₂|生成h2|h₂|h2|气体|体积|ml\b|mL\b|volume|rate)/i.test(text);
  const chemistryEquilibriumConceptJudgementSignal = subject === 'chemistry'
    && judgementLikeSignal
    && explicitJudgementLikePrompt
    && /(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(text)
    && /(压缩|体积|压强|分子数|气体计量数|正、逆|正逆|正反应速率|逆反应速率|平衡移动|不移动|移动方向|volume|pressure|mole|rate|shift)/i.test(text)
    && !/(计算|求|是多少|数值|平衡常数.{0,12}(?:为|=|多少)|反应商.{0,12}(?:为|=|多少)|转化率.{0,12}(?:为|=|多少)|calculate|value|how much)/i.test(promptText)
    && !chemistryEquilibriumQuantitativeSignal
    && !hasTable;
  const chemistryRateControlObservationSignal = subject === 'chemistry'
    && judgementLikeSignal
    && explicitJudgementLikePrompt
    && /(反应速率|化学反应速率|速率|rate of reaction|reaction rate)/i.test(text)
    && /(比较|影响|因素|快|慢|更快|更慢|剧烈|气泡|现象|观察|compare|factor|faster|slower|vigorous|bubble|observation)/i.test(text)
    && /(实验|试管|对照|相同|等体积|等浓度|同浓度|等量|同量|同时|加入|投入|镁|铁|锌|金属|盐酸|酸|过氧化氢|h₂o₂|h2o2|双氧水|二氧化锰|mno₂|mno2|水浴|冷水|热水|温度|浓度|催化剂|接触面积|表面积|粉末|块状|test tube|same|equal|simultaneously|magnesium|iron|zinc|acid|hydrogen peroxide|catalyst|temperature)/i.test(promptText)
    && !/(计算|求|是多少|数值|平均速率.{0,12}(?:为|=|多少)|速率常数|rate constant|calculate|value|how much)/i.test(promptText)
    && !chemistrySegmentedAverageRateData
    && !chemistryEquilibriumQuantitativeSignal
    && !chemistryEquilibriumRateRatioSignal
    && !hasTable;
  const chemistrySingleVariableRateObservationLoadCap = chemistryRateControlObservationSignal
    && prompt.length <= 220
    && !/(①|②|③|步骤|分成|表格|数据表|平均速率|速率常数|反应商|平衡常数|转化率|产率|Q|K|step|table|average rate|rate constant|reaction quotient|equilibrium constant|conversion|yield)/i.test(promptText);
  const quantitativeDataSignal = hasNumbers
    && (calculationCommand || quantitativeReasoningCommand || chemistryEquilibriumQuantitativeSignal)
    && /(已知|数据|分别为|如下|表|table|dataset|℃|°c|kj|mol|g\/mol|%|沸点|熔点|汽化热|焓变|键能|电离能|原子序数|质子数|中子数|电子数|质量数|丰度|相对原子质量|相对分子质量|boiling point|melting point|enthalpy|bond energy|atomic number|abundance)/i.test(text);
  const mathExpLogPowerValueOrdering = isMathExpLogPowerValueOrdering(subject, promptText, text, optionText.toLowerCase());
  const mathFunctionPropertyCompositeJudgement = isMathFunctionPropertyCompositeJudgement(subject, promptText, text);
  const mathFunctionParameterConstraintJudgement = isMathFunctionParameterConstraintJudgement(subject, promptText, text);
  const physicsDirectLinearVtGraphConceptJudgement = isPhysicsDirectLinearVtGraphConceptJudgement(subject, promptText, text);
  const physicsDirectLinearStGraphConceptJudgement = isPhysicsDirectLinearStGraphConceptJudgement(subject, promptText, text);
  const chemistryQualitativePhPaperWettingJudgement = isChemistryQualitativePhPaperWettingJudgement(subject, promptText, text);
  const chemistryBasicVolumetricPreparationErrorJudgement = isChemistryBasicVolumetricPreparationErrorJudgement(subject, promptText, text);
  const asksCalculation = !mathExpLogPowerValueOrdering
    && !mathFunctionPropertyCompositeJudgement
    && !mathFunctionParameterConstraintJudgement
    && !mathBasicDirectFunctionPointMembership
    && !mathBasicDirectQuadraticSingleProperty
    && !physicsDirectLinearVtGraphConceptJudgement
    && !physicsDirectLinearStGraphConceptJudgement
    && !chemistryQualitativePhPaperWettingJudgement
    && !chemistryBasicVolumetricPreparationErrorJudgement
    && !chemistryCatalystConceptJudgementSignal
    && !chemistryEquilibriumConceptJudgementSignal
    && !chemistryRateControlObservationSignal
    && (calculationCommand || quantitativeDataSignal || chemistryEquilibriumQuantitativeSignal || chemistryEquilibriumRateRatioSignal || (formulaTask && !explicitJudgementLikePrompt));
  const multiObservationExperimentalChain = judgementLikeSignal
    && explicitJudgementLikePrompt
    && /(①|②|第一份|第二份|分成|步骤|step|滴加|加入|过量|不再|出现|产生|沉淀|气体|颜色|浑浊|澄清|检验|除尽|interference|excess|precipitate|gas)/i.test(promptText)
    && /(实验|观察|现象|检验|滴加|加入|沉淀|气体|颜色|浑浊|澄清|溶液|reagent|observation|precipitate|gas)/i.test(promptText);
  const observationJudgementSignal = chemistryQualitativePhPaperWettingJudgement || chemistryBasicVolumetricPreparationErrorJudgement || (judgementLikeSignal
    && explicitJudgementLikePrompt
    && !asksCalculation
    && (chemistryRateControlObservationSignal || multiObservationExperimentalChain || /(实验|观察|现象|测得|检验|滴加|加入|熔点|沸点|导电|导电性|水溶液|固态|熔融|颜色|沉淀|气体|酸性|碱性|experiment|observe|observation|measured|property|conductivity|melting|boiling)/i.test(promptText)));
  const conditionCount = Math.max(1, (promptForConditionCount.match(/[，,；;。.]|given|where|if/g) ?? []).length);
  const formulaCount = hasFormula ? Math.max(1, (promptText.match(/[=<>≤≥+\-*/^√]|\\frac|\\sqrt/g) ?? []).length) : 0;
  const mathLogarithmicDomainConceptJudgement = isMathLogarithmicDomainConceptJudgement(subject, promptText, text);
  const mathMediumCappedConceptJudgement = mathLogarithmicDomainConceptJudgement || mathExpLogPowerValueOrdering || mathFunctionPropertyCompositeJudgement || mathFunctionParameterConstraintJudgement;
  const effectiveConditionCount = mathMediumCappedConceptJudgement ? Math.min(conditionCount, 5) : conditionCount;
  const effectiveFormulaCount = mathMediumCappedConceptJudgement ? Math.min(formulaCount, 4) : formulaCount;
  const spatialCoordinateComputation = calculationSignalCandidate(promptText, coordinateTupleCount);
  const readingLoad = (mathBasicDirectFunctionPointMembership || mathBasicDirectQuadraticSingleProperty) && prompt.length <= 220 && !hasTable
    ? 'medium'
    : (chemistryCatalystConceptJudgementSignal || chemistrySingleVariableRateObservationLoadCap || physicsDirectLinearVtGraphConceptJudgement || physicsDirectLinearStGraphConceptJudgement || chemistryQualitativePhPaperWettingJudgement || chemistryBasicVolumetricPreparationErrorJudgement) && prompt.length <= 220 && !hasTable
    ? 'low'
    : prompt.length > 260 || effectiveConditionCount >= 5 || hasTable
    ? 'high'
    : prompt.length > 120 || effectiveConditionCount >= 4 || hasScenario
      ? 'medium'
      : 'low';
  const calculationSignal = asksCalculation
    || mathBasicDirectFunctionPointMembership
    || mathBasicDirectQuadraticSingleProperty
    || (judgementLikeSignal && explicitJudgementLikePrompt && !chemistryEquilibriumConceptJudgementSignal && !chemistryRateControlObservationSignal && (quantitativeDataSignal || (hasFormula && !chemistryEquationChoiceSignal && !multiObservationExperimentalChain && !chemistryFormulaContextJudgementSignal)));
  const candidateDifficulty = normalizeDifficultyBand(candidate.designedDifficulty);
  const calculationLoad = chemistryBasicVolumetricPreparationErrorJudgement
    ? 'none'
    : physicsDirectLinearStGraphConceptJudgement
      ? 'light'
    : explicitErrorDiagnosis && effectiveFormulaCount <= 3
    ? 'none'
    : (mathBasicDirectFunctionPointMembership || mathBasicDirectQuadraticSingleProperty)
      ? 'light'
    : calculationSignal && candidateDifficulty === 'hard' && (hasFormula || quantitativeDataSignal || chemistryEquilibriumRateRatioSignal)
      ? 'medium'
    : calculationSignal && spatialCoordinateComputation
      ? 'medium'
    : calculationSignal && effectiveFormulaCount > 5
    ? 'heavy'
    : calculationSignal && effectiveFormulaCount > 3
      ? 'medium'
      : calculationSignal && hasNumbers
        ? 'light'
        : 'none';
  const questionForm = asksCalculation
    ? 'formula_calculation'
    : observationJudgementSignal
      ? 'experimental_judgement'
    : judgementLikeSignal && explicitJudgementLikePrompt
      ? 'concept_identification'
    : hasDiagram
      ? 'graph_interpretation'
    : hasTable
      ? 'table_interpretation'
    : hasScenario
      ? 'scenario_application'
    : judgementLikeSignal
      ? 'concept_identification'
    : 'definition';
  return {
    questionForm,
    cognitiveSkill: asksCalculation ? 'calculation' : observationJudgementSignal ? 'application' : judgementLikeSignal && explicitJudgementLikePrompt ? 'concept_identification' : hasScenario ? 'application' : judgementLikeSignal ? 'concept_identification' : 'recall',
    readingLoad,
    calculationLoad,
    distractorTypes: Array.from(new Set(candidate.optionMetadata.flatMap((item) => [
      cleanString(item.distractorIntent),
      ...optionalStringArray(item.misconceptionTags)
    ]).filter(Boolean))),
    conditionCount: effectiveConditionCount,
    formulaCount: effectiveFormulaCount,
    hasDiagram,
    hasTable
  };
}

function inferActualDifficultyBand(candidate: GeneratedQuestionCandidate, shape: ReturnType<typeof inferQuestionShape>, context?: ReviewContext) {
  const prompt = cleanString(candidate.prompt);
  const optionText = candidate.options.map((option) => cleanString(option.text)).join(' ');
  const correctOptionText = cleanString(candidate.options.find((option) => cleanString(option.id).toUpperCase() === cleanString(candidate.correctAnswer).toUpperCase())?.text);
  const explanation = cleanString(candidate.explanation);
  const body = `${prompt} ${optionText} ${explanation}`.toLowerCase();
  const promptText = prompt.toLowerCase();
  const promptAndExplanation = `${prompt} ${explanation}`.toLowerCase();
  const candidateRecord = candidate as unknown as Record<string, unknown>;
  const topicText = [
    context?.topicTitle,
    context?.examScope,
    optionalStringArray(context?.excludedScope).join(' '),
    cleanString(candidateRecord.topicTitle),
    optionalStringArray(candidate.knowledgeTags).join(' ')
  ].join(' ').toLowerCase();
  const excludedScopeText = optionalStringArray(context?.excludedScope).join(' ').toLowerCase();
  const electrolyteScopeExcludesComplexEquilibrium = /(复杂酸碱平衡|缓冲溶液|溶度积|电化学电极反应|complex acid.?base equilibrium|buffer|ksp|electrochemical electrode)/i.test(excludedScopeText);
  const subject = reviewSubject(candidate.subject);
  const reasons: string[] = [];
  const mathLogarithmicDomainConceptJudgement = isMathLogarithmicDomainConceptJudgement(subject, promptText, body);
  const mathExpLogPowerValueOrdering = isMathExpLogPowerValueOrdering(subject, promptText, body, optionText.toLowerCase());
  const mathFunctionPropertyCompositeJudgement = isMathFunctionPropertyCompositeJudgement(subject, promptText, body);
  const mathFunctionParameterConstraintJudgement = isMathFunctionParameterConstraintJudgement(subject, promptText, body);
  const mathBasicDirectFunctionPointMembership = isMathBasicDirectFunctionPointMembership(subject, promptText, optionText, body);
  const mathBasicDirectQuadraticSingleProperty = isMathBasicDirectQuadraticSingleProperty(subject, promptText, body);
  const mathBasicElementarySinglePropertyFromPlan = isMathBasicElementarySinglePropertyFromPlan(
    subject,
    promptText,
    body,
    context,
    `${promptText} ${optionText.toLowerCase()}`
  );
  const mathBasicDerivativeDirectFromPlan = isMathBasicDerivativeDirectFromPlan(
    subject,
    promptText,
    context,
    `${promptText} ${optionText.toLowerCase()}`
  );
  const physicsDirectLinearVtGraphConceptJudgement = isPhysicsDirectLinearVtGraphConceptJudgement(subject, promptText, body);
  const physicsDirectLinearStGraphConceptJudgement = isPhysicsDirectLinearStGraphConceptJudgement(subject, promptText, body);
  const chemistryQualitativePhPaperWettingJudgement = isChemistryQualitativePhPaperWettingJudgement(subject, promptText, body);
  const chemistryBasicVolumetricPreparationErrorJudgement = isChemistryBasicVolumetricPreparationErrorJudgement(subject, promptText, body);
  const mathQuestionPlanEvidence = mathBasicDirectQuadraticSingleProperty || mathBasicDerivativeDirectFromPlan
    ? { reason: '', hard: false, medium: false }
    : mathTopicQuestionPlanEvidence(subject, promptText, body);
  const chemistryRateTimeIntervalCount = subject === 'chemistry'
    ? (promptText.match(/\d+\s*(?:～|~|至|到|-|–|—)\s*\d+\s*(?:min|分钟)/gi) ?? []).length
    : 0;
  const chemistrySegmentedAverageRateData = subject === 'chemistry'
    && chemistryRateTimeIntervalCount >= 2
    && /(反应速率|速率|平均反应速率|平均速率|生成h₂|生成h2|h₂|h2|气体|体积|ml\b|mL\b|volume|rate)/i.test(body);
  const oneStepProportionalPrompt = /(保持其他条件不变|其他条件不变|all else equal|unchanged).*(增大|减小|变为|加倍|减半|倍|double|half|proportional)/i.test(promptText)
    && /(变为多少|是多少|为多少|how many|what is|what will)/i.test(promptText);
  const multiplierOptions = candidate.options.filter((option) => /^(?:\d+(?:\.\d+)?|[一二三四五六七八九十]+)?\s*(?:倍|x|×)?\s*(?:delta|Δ|△|原|same|[a-z]\w*)/i.test(cleanString(option.text))).length;
  const directFormulaSignals = [
    /直接(?:代入|套用)|套用公式|one-step|single-step|direct substitution/i,
    /\b(?:f\s*=\s*ma|v\s*=\s*s\/t|w\s*=\s*fs|p\s*=\s*ui|u\s*=\s*ir|qed|q\s*e\s*d|pv\s*=\s*nrt|n\s*=\s*m\/m)\b/i,
    /\ba\s*=\s*\(?\s*(?:v\s*[-−]\s*u|[Δ△]v)\s*\)?\s*\/\s*t\b|\bv\s*=\s*u\s*\+\s*a\s*t\b|\bs\s*=\s*u\s*t\s*\+\s*(?:1\s*\/\s*2|0\.5|½)\s*a\s*t(?:\s*\^?\s*2|²)\b/i,
    /p\s*=\s*i(?:\^?2|²)\s*r|p\s*=\s*u(?:\^?2|²)\s*\/\s*r/i,
    /f\s*=\s*b\s*i\s*l|f\s*=\s*b\s*i\s*l\s*sin|f\s*=\s*q\s*v\s*b|e\s*=\s*b\s*l\s*v/i
  ];
  const subjectBareFormula = subject === 'physics'
    ? /(裸公式|公式代入|qed|电场力做功|欧姆定律|焦耳定律|匀速|速度公式|牛顿第二定律|法拉第|感应电动势|磁通量变化|切割磁感线|导体棒切割|安培力|洛伦兹力|磁感应强度.*大小|通电导线.*磁场)/i.test(body)
    : subject === 'chemistry'
      ? /(摩尔质量|物质的量|质量分数|浓度|气体体积|化学计量|limiting reagent|molar|mole)/i.test(body)
      : /(方差|平均数|概率|一次函数|代入|解方程|linear transform|variance)/i.test(body);
  const directFormula = directFormulaSignals.some((pattern) => pattern.test(body)) || subjectBareFormula;
  const noInterpretiveAsset = !shape.hasDiagram && !shape.hasTable;
  const compactOperation = shape.formulaCount <= 3 && shape.conditionCount <= 6;
  const physicsQuestionPlan = recordFrom(context?.questionPlan);
  const physicsPlanRenderConstraints = recordFrom(physicsQuestionPlan?.renderConstraints);
  const physicsBasicDirectKinematicsPlan = subject === 'physics'
    && isSubjectPracticeContext(context ?? {}, 'physics')
    && cleanString(physicsQuestionPlan?.planTemplate) === 'physics_kinematics_basic_relation_v1'
    && cleanString(physicsQuestionPlan?.taskFamily) === 'kinematics_basic_direct_relation'
    && normalizeDifficultyBand(physicsQuestionPlan?.targetDifficulty) === 'basic'
    && normalizeDifficultyBand(candidate.designedDifficulty) === 'basic'
    && Number(physicsPlanRenderConstraints?.maxIndependentRelations) <= 1
    && physicsPlanRenderConstraints?.forbidMultiStageModelChain === true;
  const planBoundCompactDirectFormula = physicsBasicDirectKinematicsPlan && directFormula && noInterpretiveAsset;
  const chemistryEquilibriumConditionContrast = subject === 'chemistry'
    && /(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction)/i.test(body)
    && /(恒容|恒压|constant volume|constant pressure)/i.test(body)
    && /(惰性气体|不反应的气体|氦气|氩气|inert gas|helium|argon|分压|partial pressure)/i.test(body);
  const chemistryInertGasConditionContrast = chemistryEquilibriumConditionContrast
    && /(惰性气体|不反应的气体|氦气|氩气|inert gas|helium|argon)/i.test(body)
    && !/(平均摩尔质量|体积分数|物质的量分数|转化率|p0|p₀|p1|p₁|initial composition|average molar mass|conversion)/i.test(body);
  const chemistryEquilibriumPressureMoleReasoning = subject === 'chemistry'
    && /(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(body)
    && /(压强|压力|压缩|体积|pressure|compress|volume)/i.test(body)
    && /(气体分子数|气体物质的量|气体体积|气体计量数|计量数不变|δn|Δn|分子数(?:增大|减少|变多|变少|相等|相同|不变)|gas moles?|moles? of gas)/i.test(body);
  const chemistryEqualGasMolePressureNoShift = chemistryEquilibriumPressureMoleReasoning
    && /(反应前后气体分子数(?:相等|相同|均为|都是)|气体分子数(?:相等|相同|均为|都是|不变)|气体物质的量(?:相等|相同)|气体计量数不变|计量数不变|δn\s*=\s*0|Δn\s*=\s*0|same number of gas molecules|same gas moles)/i.test(body)
    && /(平衡(?:不移动|不发生移动)|不移动|无影响|不改变平衡|does not shift|no shift|no effect on equilibrium)/i.test(body)
    && !/(同时|既.*又|正、逆|正逆|正反应速率|逆反应速率|反应速率|速率均|速率.*增大|rate|转化率|产率|反应商|平衡常数|Kc|Qc|\bQ\b|\bK\b|计算|求|是多少|conversion|yield|reaction quotient|equilibrium constant|calculate)/i.test(body);
  const chemistryEquilibriumTaskText = `${promptText} ${correctOptionText}`;
  const chemistryEquilibriumEvidenceText = `${promptText} ${correctOptionText} ${explanation}`.toLowerCase();
  const chemistryDirectCatalystNoShift = subject === 'chemistry'
    && /(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(body)
    && /(催化剂|v₂o₅|v2o5|catalyst)/i.test(body)
    && /(速率|反应速率|正反应速率|逆反应速率|rate)/i.test(body)
    && /(平衡(?:不移动|不发生移动)|不改变平衡|平衡常数不变|no shift|does not shift|no effect on equilibrium)/i.test(body)
    && !/(图|表|曲线|转化率|产率|反应商|平衡常数.{0,12}(?:计算|求|为|=|多少|大小|比较)|Kc|Qc|\bQ\b|\bK\b|计算|求|是多少|conversion|yield|reaction quotient|equilibrium constant.{0,24}(?:calculate|compare|value)|calculate|graph|curve|table)/i.test(body)
    && noInterpretiveAsset;
  const chemistryDirectConcentrationShiftJudgement = subject === 'chemistry'
    && /(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(body)
    && /(加入|充入|增大|增加|滴加|add|increase)/i.test(promptText)
    && !/(催化剂|catalyst|mn[o0][₂2]|二氧化锰)/i.test(body)
    && /(浓度|反应物|生成物|颜色|变深|变浅|scn|fe\(scn\)|so₂|so2|o₂|o2|n₂|n2|h₂|h2)/i.test(body)
    && /(正向|逆向|移动|颜色|变深|变浅|shift|deepen|lighter)/i.test(body)
    && !/(图|表|曲线|转化率|产率|反应商|平衡常数|Kc|Qc|\bQ\b|\bK\b|计算|求|是多少|压强|压力|压缩|体积|分压|conversion|yield|reaction quotient|equilibrium constant|calculate|graph|curve|table|pressure|volume|compress)/i.test(chemistryEquilibriumTaskText)
    && noInterpretiveAsset;
  const chemistryEquilibriumSecondaryInference = subject === 'chemistry'
    && /(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(chemistryEquilibriumTaskText)
    && (
      (
        /(naoh|氢氧化钠|oh[⁻-]|沉淀|fe\(oh\)|去除|precipitat|remove)/i.test(promptText)
        && /(fe³|fe3|scn|fe\(scn\)|红色|血红|变浅|变深|颜色)/i.test(promptAndExplanation)
        && /(平衡|正向|逆向|移动|shift)/i.test(promptAndExplanation)
      )
      || (
        /(升高温度|升温|降低温度|降温|temperature\s+(?:increase|decrease)|(?:increase|decrease).{0,24}temperature)/i.test(promptAndExplanation)
        && /(吸热|放热|endothermic|exothermic|正、逆|正逆|正反应速率|逆反应速率|速率)/i.test(promptAndExplanation)
        && /(颜色|变蓝|变红|变浅|变深|移动|shift)/i.test(promptAndExplanation)
      )
    );
  const chemistryEquilibriumQuotientCalculation = subject === 'chemistry'
    && /(平衡|可逆反应|equilibrium|reversible reaction|⇌|↔|<=>)/i.test(chemistryEquilibriumTaskText)
    && /(反应商|平衡常数|Kc|Qc|\bQ\b|\bK\b|reaction quotient|equilibrium constant)/i.test(chemistryEquilibriumEvidenceText)
    && /(计算|比较|判断|移动方向|正向|逆向|calculate|compare|shift direction|forward|reverse|q\s*[<=>]|[<=>]\s*k)/i.test(chemistryEquilibriumEvidenceText);
  const chemistryEquilibriumConstantCalculation = subject === 'chemistry'
    && /(平衡|可逆反应|equilibrium|reversible reaction|⇌|↔|<=>)/i.test(chemistryEquilibriumTaskText)
    && /(平衡常数|Kc|equilibrium constant)/i.test(chemistryEquilibriumEvidenceText)
    && /(平衡时|起始|初始|浓度|设.*x|解得|求|是多少|calculate|concentration|solve)/i.test(chemistryEquilibriumEvidenceText);
  const chemistryEquilibriumDirectConstantSubstitution = chemistryEquilibriumConstantCalculation
    && /(平衡(?:浓度|时)|测得|已知).{0,80}(?:浓度|mol\/l|mol·l|mol l|moll)/i.test(chemistryEquilibriumTaskText)
    && !/(起始|初始|设.*x|解得|不加入|ice table|extent)/i.test(chemistryEquilibriumTaskText);
  const chemistryEquilibriumUnknownExtentCalculation = chemistryEquilibriumConstantCalculation && !chemistryEquilibriumDirectConstantSubstitution;
  const chemistryEquilibriumMarkerJudgement = subject === 'chemistry'
    && /(平衡|可逆反应|equilibrium|reversible reaction|⇌|↔|<=>)/i.test(body)
    && /(达到平衡的标志|平衡标志|说明.{0,12}达到平衡|能.{0,12}说明.{0,12}平衡|不能.{0,12}说明.{0,12}平衡|has reached equilibrium|equilibrium indicator)/i.test(promptText)
    && !/(反应商|平衡常数|Kc|Qc|\bQ\b|\bK\b|计算|求|是多少|转化率|产率|conversion|yield|calculate|reaction quotient|equilibrium constant)/i.test(chemistryEquilibriumTaskText);
  const chemistryGasEquilibriumExtentMixtureInference = subject === 'chemistry'
    && /(平衡|可逆反应|equilibrium|reversible reaction|⇌|↔|<=>)/i.test(body)
    && /(气体|混合气体|\(g\)|总压|压强|分压|pressure|partial pressure)/i.test(body)
    && /(初始|起始|反应前|达到平衡|平均摩尔质量|体积分数|物质的量分数|组成|转化率|p0|p₀|p1|p₁|extent|conversion|initial|average molar mass)/i.test(body)
    && /(总压|压强|分压|pressure|partial pressure).{0,80}(变为|降至|升至|为|=|0\.\d+\s*p|p[01₀₁])|(?:变为|降至|升至|为|=|0\.\d+\s*p|p[01₀₁]).{0,80}(总压|压强|分压|pressure|partial pressure)/i.test(body)
    && /(平均摩尔质量|体积分数|物质的量分数|组成|混合气体|道尔顿|分压|n\([^)]+\)\s*:\s*n\([^)]+\)|反应前.{0,30}(?:平均|组成|比例|分压)|initial composition|average molar mass|partial pressure|dalton)/i.test(body)
    && !chemistryEquilibriumDirectConstantSubstitution
    && !chemistryInertGasConditionContrast
    && !chemistryEquilibriumMarkerJudgement;
  const chemistryGasEquilibriumDirectPressureConversion = subject === 'chemistry'
    && /(平衡|可逆反应|equilibrium|reversible reaction|⇌|↔|<=>)/i.test(body)
    && /(气体|\(g\)|总压|压强|pressure)/i.test(body)
    && /(转化率|反应程度|extent|conversion)/i.test(body)
    && /(总压|压强|pressure).{0,80}(变为|为|=|0\.\d+\s*p|p[01₀₁])|(?:变为|为|=|0\.\d+\s*p|p[01₀₁]).{0,80}(总压|压强|pressure)/i.test(body)
    && !chemistryGasEquilibriumExtentMixtureInference
    && !chemistryEquilibriumDirectConstantSubstitution;
  const chemistryEquilibriumHardConstraintCount = [
    /先.*(?:再|后)|待重新平衡|重新达到平衡|再次达到平衡|分步|two-stage|then|after equilibrium/i,
    /转化率|产率|反应程度|conversion|yield|extent/i,
    /催化剂|catalyst/i,
    /正、逆|正逆|正反应速率|逆反应速率|速率.*(?:不改变|同等|均)|rate/i,
    /充入|加入|移去|减少|增大|减小|浓度|物质的量|压强|体积|add|remove|increase|decrease|concentration|pressure|volume/i
  ].reduce((count, pattern) => count + (pattern.test(chemistryEquilibriumEvidenceText) ? 1 : 0), 0);
  const chemistryHardEquilibriumMultiConstraintApplication = subject === 'chemistry'
    && (chemistryEquilibriumQuotientCalculation || chemistryEquilibriumConstantCalculation)
    && chemistryEquilibriumHardConstraintCount >= 3
    && !chemistryEquilibriumDirectConstantSubstitution
    && !chemistryEquilibriumMarkerJudgement;
  const chemistryPermanganateOxalateRateExperiment = subject === 'chemistry'
    && /(草酸|乙二酸|oxalic)/i.test(body)
    && /(酸性高锰酸钾|高锰酸钾|kmno4|kmno₄|mno4|mno₄|紫红色|褪色|decolor)/i.test(body)
    && /(反应速率|速率|快慢|单位时间|温度|水浴|冷水|热水|更快|更慢|rate)/i.test(body)
    && /(比较|控制变量|变量|等体积|等浓度|同浓度|等量|同量|温度|水浴|冷水|热水|更快|更慢|compare|control)/i.test(body);
  const chemistryReactionRateVariableControlExperiment = subject === 'chemistry'
    && (chemistryPermanganateOxalateRateExperiment || /(反应速率|速率|快慢|单位时间|气泡|产生氢气|产生氧气|金属活动性|接触面积|表面积|温度|催化剂|浓度|rate)/i.test(body))
    && (chemistryPermanganateOxalateRateExperiment || /(稀盐酸|盐酸|稀硫酸|金属|镁|铁|锌|铝|过氧化氢|h₂o₂|h2o2|双氧水|二氧化锰|mno₂|mno2|碳酸钙|caco₃|caco3|硫代硫酸钠|na₂s₂o₃|na2s2o3|水浴|冷水|热水|mg|fe|zn|al|hydrochloric acid|sulfuric acid|hydrogen peroxide)/i.test(body))
    && /(比较|控制变量|变量|等体积|等浓度|同浓度|等量|同量|浓度不同|温度|水浴|冷水|热水|催化剂|表面积|接触面积|粉末|块状|更快|更慢|compare|control)/i.test(body)
    && (chemistryPermanganateOxalateRateExperiment || !/(pH|H\+|OH-|氢离子|氢氧根|中和|滴定|neutralization|titration)/i.test(body));
  const chemistryRateTwoFactorIndeterminateComparison = subject === 'chemistry'
    && /(反应速率|化学反应速率|速率|快慢|出现浑浊|气泡|rate)/i.test(`${topicText} ${body}`)
    && /(无法判断|无法确定|不能判断|不能确定|不能比较|无法比较|cannot determine|undetermined|not enough information)/i.test(body)
    && /(比较|哪组|哪个|先|更快|更慢|影响更大|快慢|compare|which|faster|slower)/i.test(body)
    && [
      /浓度|mol[·.\s-]*l|concentration/i,
      /温度|℃|°c|temperature/i,
      /催化剂|catalyst|mno₂|mno2/i,
      /表面积|接触面积|粉末|块状|颗粒|surface area|powder/i,
      /酸的种类|金属种类|反应物种类|reactant type/i
    ].reduce((count, pattern) => count + (pattern.test(promptAndExplanation) ? 1 : 0), 0) >= 2;
  const chemistryAcidBaseDilutionNeutralizationCalculation = subject === 'chemistry'
    && !chemistryQualitativePhPaperWettingJudgement
    && /(ph|pH|H\+|OH-|氢离子|氢氧根|中和|滴定|氢氧化钠|NaOH|HCl|盐酸|neutralization|titration)/i.test(body)
    && /(稀释|加水|容量瓶|转移|混合|等体积|中和|neutralization|dilution|mix)/i.test(body)
    && /(计算|判断|酸性|碱性|中性|多少|浓度|物质的量|mol|pH|H\+|OH-|calculate|determine)/i.test(body)
    && !chemistryReactionRateVariableControlExperiment
    && !/(氧化还原|氧化剂|还原剂|化合价|电子)/i.test(body);
  const chemistryElectrolyteConductivityReasoning = subject === 'chemistry'
    && !chemistryQualitativePhPaperWettingJudgement
    && /(电解质|导电性|导电能力|电离|灯泡|电导|conductivity|conductance|electrolyte|ionization)/i.test(`${topicText} ${body}`)
    && /(强电解质|弱电解质|盐酸|醋酸|氨水|氢氧化钠|氯化钠|ha|hb|hcl|ch3cooh|ch₃cooh|nh3|nh₃|naoh|nacl|strong electrolyte|weak electrolyte)/i.test(body)
    && /(比较|判断|推断|解释|稀释|加水|相同条件|等浓度|等体积|灯泡|导电能力|conductivity|dilution|compare|determine|infer)/i.test(body);
  const chemistryElectrolyteDirectStrongWeakComparison = subject === 'chemistry'
    && /(强电解质|完全电离|盐酸|hcl|弱电解质|部分电离|醋酸|ch3cooh|ch₃cooh|氨水|nh3|nh₃)/i.test(body)
    && /(自由移动离子|离子总(?:物质的量|浓度)|离子数|导电性|导电能力|电导|灯泡|conductivity|conductance|ions?)/i.test(body)
    && /(比较|相比|大小|更大|更强|相等|判断|compare|larger|greater|same)/i.test(body)
    && !/(稀释|加水|混合后|所得混合|滴加|逐滴|pH|ka|kb|水解|缓冲|共同离子|电荷守恒|物料守恒|溶度积|ksp|dilut|mix|hydrolysis|buffer|common ion)/i.test(body);
  const chemistryElectrolyteMultiEquilibriumSignalCount = [
    /弱酸|弱碱|电离平衡|盐类水解|缓冲|共同离子|酸碱平衡|ka|kb|ksp|溶度积|离子积|hydrolysis|buffer|common ion/i,
    /混合|滴加|加入|稀释|等体积|过量|少量|逐滴|分步|mix|titrate|dilute/i,
    /pH|c\(h|c\(oh|氢离子|氢氧根|电荷守恒|物料守恒|质子守恒|平衡常数|电离常数|charge balance|mass balance/i,
    /沉淀|转化|开始沉淀|完全沉淀|离子浓度|导电性|电导率|precipitation|threshold/i,
    /推断|判断|正确|错误|描述|顺序|关系|范围|最接近|大小关系|先.*再|竞争|限制|隐藏|infer|range|closest/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistryElectrolyteHardConstraintCount = [
    /弱酸|弱碱|氨水|醋酸|ch3cooh|ch₃cooh|nh3|nh₃|电离平衡|ka|kb|电离常数|酸碱平衡/i,
    /盐类水解|水解|hydrolysis/i,
    /缓冲|共同离子|common ion|buffer/i,
    /ksp|溶度积|离子积|开始沉淀|完全沉淀|precipitation|threshold/i,
    /电荷守恒|物料守恒|质子守恒|charge balance|mass balance/i,
    /pka|n\([^)]*(?:ha|a|hcl|oh|酸|碱)[^)]*\)|ha\/a|a-\/ha|比值|物质的量比|mole ratio/i,
    /混合|滴加|加入|等体积|过量|少量|逐滴|分步|先.*再|mix|titrate/i,
    /竞争|限制|共存|除去|分离|competing|removal|coexist/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistryElectrolyteTransparentWeakAcidBaseIonicEquation = subject === 'chemistry'
    && /(离子方程式|离子反应式|ionic equation|net ionic)/i.test(body)
    && /(弱酸|弱碱|醋酸|ch3cooh|ch₃cooh|氨水|nh3|nh₃|weak acid|weak base|weak electrolyte)/i.test(body)
    && /(naoh|氢氧化钠|hcl|盐酸|oh[⁻-]|h[⁺+]|强酸|强碱|strong acid|strong base)/i.test(body)
    && /(恰好|褪去|中和|旁观离子|不能拆|弱电解质|spectator|neutralization|not split)/i.test(body)
    && !/(缓冲|共同离子|pka|ka\s*=|kb\s*=|ksp|溶度积|电荷守恒|物料守恒|质子守恒|离子浓度|浓度关系|大小关系|排序|过量|剩余|分步|先.*再|buffer|common ion|mass balance|charge balance|ranking)/i.test(body);
  const chemistryElectrolyteDirectSingleEquilibriumTemplate = subject === 'chemistry'
    && (
      chemistryElectrolyteTransparentWeakAcidBaseIonicEquation
      ||
      /(hcl|盐酸|强酸).{0,80}(醋酸|ch3cooh|ch₃cooh|弱酸).{0,80}(ka|电离|抑制)|(?:ka|电离|抑制).{0,80}(hcl|盐酸|强酸).{0,80}(醋酸|ch3cooh|ch₃cooh|弱酸)/i.test(body)
      || /(醋酸|ch3cooh|ch₃cooh|弱酸).{0,80}(等体积|等浓度|完全|恰好).{0,80}(naoh|氢氧化钠|强碱).{0,80}(ch3coo|ch₃coo|水解|离子浓度|大小关系)|(?:naoh|氢氧化钠|强碱).{0,80}(等体积|等浓度|完全|恰好).{0,80}(醋酸|ch3cooh|ch₃cooh|弱酸).{0,80}(ch3coo|ch₃coo|水解|离子浓度|大小关系)/i.test(body)
      || /(醋酸|ch3cooh|ch₃cooh|弱酸).{0,120}(naoh|氢氧化钠|强碱).{0,120}(过量|剩余|0\.\d+\s*mol|浓度|物质的量).{0,80}(离子浓度|浓度关系|大小关系|排序)|(?:naoh|氢氧化钠|强碱).{0,120}(醋酸|ch3cooh|ch₃cooh|弱酸).{0,120}(过量|剩余|0\.\d+\s*mol|浓度|物质的量).{0,80}(离子浓度|浓度关系|大小关系|排序)/i.test(body)
      || (/(醋酸|ch3cooh|ch₃cooh|弱酸)/i.test(body)
        && /(naoh|氢氧化钠|强碱)/i.test(body)
        && /(离子浓度|浓度关系|大小关系|排序)/i.test(body)
        && /(过量|剩余|0\.2\s*mol|0\.200|2\s*倍|浓度.*(?:不同|更大)|不同浓度)/i.test(body))
      || /(氨水|nh3|nh₃|弱碱).{0,120}(hcl|盐酸|强酸).{0,120}(过量|剩余|体积比|1\s*[:：]\s*2|2\s*倍|0\.\d+\s*mol|浓度|物质的量).{0,80}(离子浓度|浓度关系|大小关系|大小顺序|排序)|(?:hcl|盐酸|强酸).{0,120}(氨水|nh3|nh₃|弱碱).{0,120}(过量|剩余|体积比|1\s*[:：]\s*2|2\s*倍|0\.\d+\s*mol|浓度|物质的量).{0,80}(离子浓度|浓度关系|大小关系|大小顺序|排序)/i.test(body)
      || (/(氨水|nh3|nh₃|弱碱)/i.test(body)
        && /(hcl|盐酸|强酸)/i.test(body)
        && /(离子浓度|浓度关系|大小关系|大小顺序|排序)/i.test(body)
        && /(过量|剩余|体积比|1\s*[:：]\s*2|2\s*倍|浓度.*(?:不同|更大)|不同浓度)/i.test(body))
      || /(醋酸铵|nh4ch3coo|nh₄ch₃coo|弱酸弱碱盐).{0,80}(ka\s*=\s*kb|呈中性|水解程度相等)|(?:ka\s*=\s*kb|呈中性|水解程度相等).{0,80}(醋酸铵|nh4ch3coo|nh₄ch₃coo|弱酸弱碱盐)/i.test(body)
      || /(冰醋酸|醋酸).{0,80}(不断|持续)?(?:加水|稀释).{0,80}(h\+|氢离子|变化趋势)/i.test(body)
      || /(水电离出的?\s*h|水的电离|水电离).{0,80}(排序|顺序|大小|由大到小|由小到大)/i.test(body)
    )
    && !/(缓冲|pka|naa|a⁻|a-|n\(ha|n\(a|ha\/a|a-\/ha|比值|物质的量比)/i.test(body)
    && (chemistryElectrolyteTransparentWeakAcidBaseIonicEquation || !/(分步|先.*再|逐滴|滴加|再加入|加入少量)/i.test(promptText))
    && chemistryElectrolyteHardConstraintCount < 4;
  const chemistryDirectMetalWeakAcidIonicEquationContext = subject === 'chemistry'
    && /(离子方程式|离子反应式|ionic equation|net ionic)/i.test(body)
    && /(弱酸|醋酸|ch3cooh|ch₃cooh|弱电解质|weak acid|weak electrolyte)/i.test(body)
    && /(铁片|铁粉|铁屑|fe\b|锌片|锌粒|zn\b|镁条|mg\b|金属).{0,80}(溶解|气泡|h₂|h2|氢气|浅绿色|fe²|fe2|zn²|zn2|mg²|mg2)|(?:溶解|气泡|h₂|h2|氢气|浅绿色|fe²|fe2|zn²|zn2|mg²|mg2).{0,80}(铁片|铁粉|铁屑|fe\b|锌片|锌粒|zn\b|镁条|mg\b|金属)/i.test(body)
    && !/(未知|可能含有|混合|依次|先.*再|逐滴|少量|限量|竞争|共存|除杂|分离|排序|强弱|氧化性|还原性|电子转移数|物质的量|浓度|质量|计算|ka|pka|ksp|电荷守恒|物料守恒|质子守恒)/i.test(promptText);
  const chemistryDirectMetalWeakAcidIonicEquationSelection = chemistryDirectMetalWeakAcidIonicEquationContext
    && (
      /(?:下列|以下|哪一|哪项)?.{0,36}(表示|书写|选择).{0,36}正确|正确.{0,18}(?:表示|书写|选择)|反应实质.{0,18}离子方程式|离子方程式.{0,24}(?:正确|表示|书写)/i.test(promptText)
    );
  const chemistryElectrolyteIndependentStatementSet = subject === 'chemistry'
    && /(下列|以下).{0,12}(有关|关于).{0,20}(电解质|电离|弱酸|弱碱|盐类水解|离子浓度|酸碱).{0,16}(说法|叙述|判断).{0,10}(正确|错误)/i.test(promptText)
    && !/(同一|同种|该溶液|上述|混合后|所得溶液|溶液甲|溶液乙|m\b|n\b|先.*再|分步|滴加|逐滴|过量|少量|ksp|溶度积|电荷守恒|物料守恒)/i.test(promptText)
    && [
      /醋酸|ch3cooh|ch₃cooh/i,
      /氨水|nh3|nh₃/i,
      /nh4cl|nh₄cl|铵盐/i,
      /naoh|氢氧化钠/i,
      /nacl|氯化钠/i,
      /稀释|加水/i,
      /水解|hydrolysis/i
    ].reduce((count, pattern) => count + (pattern.test(optionText) ? 1 : 0), 0) >= 3;
  const chemistryElectrolyteRankedCaseCount = new Set((body.match(/[①②③④⑤⑥]|(?:^|\s)[1-6][).、]/g) ?? [])).size;
  const chemistryElectrolyteMultiSpeciesAcidBaseRanking = subject === 'chemistry'
    && !electrolyteScopeExcludesComplexEquilibrium
    && chemistryElectrolyteRankedCaseCount >= 3
    && /(ka|kb|kw|电离常数|水的离子积)/i.test(body)
    && /(ph|c\(h|c\(oh|h\+|oh-|氢离子|氢氧根|酸性|碱性|大小关系|大小排序|由大到小|由小到大)/i.test(body)
    && /(弱酸|弱碱|盐|水解|ch3coona|ch₃coona|nh4|nh₄|ch3coonh4|ch₃coonh₄|nh3|nh₃)/i.test(body)
    && /(sqrt|√|kw\s*\/\s*ka|kw\s*\/\s*kb|水解|中性|hydrolysis|neutral)/i.test(body);
  const chemistryElectrolyteMultiEquilibriumInference = subject === 'chemistry'
    && !electrolyteScopeExcludesComplexEquilibrium
    && /(电解质|电离|弱酸|弱碱|盐类水解|离子积|溶度积|ksp|ka|kb|缓冲|共同离子|电荷守恒|物料守恒|electrolyte|ionization|hydrolysis|buffer|common ion|ionic product|precipitation)/i.test(`${topicText} ${body}`)
    && chemistryElectrolyteMultiEquilibriumSignalCount >= 4
    && chemistryElectrolyteHardConstraintCount >= 3
    && !chemistryElectrolyteDirectSingleEquilibriumTemplate
    && !chemistryElectrolyteIndependentStatementSet
    && !(/(导电性|导电能力|灯泡|电导|conductivity|conductance|bulb)/i.test(body) && chemistryElectrolyteMultiEquilibriumSignalCount < 5)
    && !/(仅|只|直接).{0,16}(强电解质|弱电解质|完全电离|部分电离|导电性)/i.test(body);
  const chemistryElectrolyteInScopeHardSignalCount = [
    /水溶液|溶于水|熔融|固态|固体|液态|aqueous|molten|solid/i,
    /电离方程式|完全电离|部分电离|自由移动离子|离子数目|离子浓度|formula units?|ion particles?|free-moving ions/i,
    /导电性|导电能力|电导|灯泡|conductivity|conductance/i,
    /等物质的量|等浓度|相同体积|浓度|体积|物质的量|particle-count|mol|mol\/l/i,
    /甲|乙|丙|丁|①|②|③|④|四份|三种|多种|competing|cases/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistryElectrolyteStateContrastCount = [
    /水溶液|溶于水|aqueous/i,
    /熔融|molten/i,
    /固态|固体|solid/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistryElectrolyteCorrectOptionCaseCount = new Set((correctOptionText.match(/[①②③④⑤⑥]|甲|乙|丙|丁/g) ?? [])).size;
  const chemistryElectrolyteInScopeMultiCaseIonizationInference = subject === 'chemistry'
    && /(电解质|电离|导电性|导电能力|自由移动离子|electrolyte|ionization|conductivity|free-moving ions)/i.test(`${topicText} ${body}`)
    && chemistryElectrolyteInScopeHardSignalCount >= 4
    && (chemistryElectrolyteStateContrastCount >= 2 || chemistryElectrolyteRankedCaseCount >= 3 || /(甲|乙|丙|丁|四份|三种|多种)/i.test(promptText))
    && (chemistryElectrolyteCorrectOptionCaseCount >= 3 || /(排序|顺序|由大到小|由小到大|[>＞<＜=]|均|都|全部|只有|不能同时|分组|最多.*最少|most.*least)/i.test(correctOptionText))
    && /(推断|判断|正确|错误|比较|最多|最少|identify|infer|compare|determine)/i.test(body)
    && !/(ka|kb|ksp|缓冲|共同离子|盐类水解|溶度积|电极|hydrolysis|buffer|common ion|solubility product|electrode)/i.test(body)
    && !(chemistryElectrolyteDirectStrongWeakComparison && chemistryElectrolyteInScopeHardSignalCount < 4);
  const chemistryEquationReactantSignatures = new Set(candidate.options
    .map((option) => cleanString(option.text).split(/->|→|=/)[0] ?? '')
    .map((left) => left
      .replace(/[₀０]/g, '0').replace(/[₁１]/g, '1').replace(/[₂２]/g, '2').replace(/[₃３]/g, '3')
      .replace(/[₄４]/g, '4').replace(/[₅５]/g, '5').replace(/[₆６]/g, '6').replace(/[₇７]/g, '7')
      .replace(/[₈８]/g, '8').replace(/[₉９]/g, '9')
      .replace(/\b\d+\s*/g, '')
      .replace(/\s+/g, '')
      .toLowerCase())
    .filter((left) => left.includes('+')));
  const chemistryMultipleEquationSystems = chemistryEquationReactantSignatures.size > 2;
  const chemistryDirectEquationSelection = subject === 'chemistry'
    && /(化学方程式|反应方程式|方程式|反应式).{0,18}(?:书写)?(?:正确|配平|系数)|下列.{0,24}(?:化学方程式|反应方程式|方程式|反应式).{0,18}(?:正确|配平)/i.test(body)
    && !/(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(body)
    && !/(?:[A-D]|甲乙丙丁|①②③|一二三).{0,12}(?:能使|现象|沉淀|颜色|气体|溶液|鉴别)|推断|判断.*(?:物质|组成|成分)/i.test(promptText)
    && !chemistryMultipleEquationSystems
    && noInterpretiveAsset;
  const chemistryDirectNotationSelection = subject === 'chemistry'
    && /(离子符号|化学式|名称对应|化学符号|离子式|化合价).{0,24}(?:书写)?(?:正确|错误|对应|符合)|下列.{0,24}(?:离子符号|化学式|名称对应|化学符号|离子式|化合价).{0,24}(?:正确|错误|对应|符合)/i.test(body)
    && !/(推断|鉴别|未知|样品|实验|现象|沉淀|气体|颜色|依次|先.*再|过量|少量|滤液|混合|计算|质量守恒|原子守恒|电荷守恒|方程式|反应式|equation|infer|identify|unknown|experiment)/i.test(promptText)
    && noInterpretiveAsset;
  const chemistrySimpleAcidCarbonateEquationSelection = subject === 'chemistry'
    && /(离子方程式|化学方程式|反应方程式|方程式|反应式).{0,24}(?:正确|书写|表示)|下列.{0,24}(?:离子方程式|化学方程式|反应方程式|方程式|反应式).{0,24}(?:正确|书写|表示)/i.test(body)
    && /(碳酸钙|caco₃|caco3|碳酸钠|na₂co₃|na2co3|碳酸氢钠|nahco₃|nahco3|碳酸盐|碳酸氢盐)/i.test(body)
    && /(盐酸|hcl|强酸|稀酸|h\+)/i.test(body)
    && /(气泡|co₂|co2|二氧化碳|气体)/i.test(body)
    && !/(醋酸|ch₃cooh|ch3cooh|弱酸|未知|[a-z]\s*(?:中|与|为|是|可能|含有)|固体\s*[a-z]|溶液\s*[a-z]|可能含有|一定含有|鉴别|推断|依次|先.*再|再滴加|滤液|混合物|多种|实验方案|kscn|h₂o₂|h2o2|无明显变化|变红)/i.test(promptText)
    && noInterpretiveAsset;
  const chemistryDirectCopperSaltDisplacementEquationSelection = subject === 'chemistry'
    && /(离子方程式|化学方程式|反应方程式|方程式|反应式).{0,24}(?:正确|书写|表示)|下列.{0,24}(?:离子方程式|化学方程式|反应方程式|方程式|反应式).{0,24}(?:正确|书写|表示)/i.test(body)
    && /(硫酸铜|cuso₄|cuso4|cu²⁺|cu2\+)/i.test(body)
    && /(铁|fe|锌|zn|金属)/i.test(body)
    && /(反应实质|红色固体|析出.*铜|蓝色.*变浅|滤液.*无色|浅绿色|置换|金属活动性|锌比铜活泼|cu²⁺|cu2\+)/i.test(body)
    && !/(未知|可能含有|一定含有|鉴别|推断|排序|强弱|氧化性|还原性|过量.*(?:滤液|剩余|先)|少量.*(?:滤液|剩余|先)|多种|混合|电子转移|转移.*电子|化合价)/i.test(promptText)
    && noInterpretiveAsset;
  const chemistryBicarbonatePrecipitateDissolutionBoundary = subject === 'chemistry'
    && /(离子方程式|化学方程式|反应方程式|方程式|反应式|化学用语|沉淀|precipitate|ionic equation|chemical equation)/i.test(body)
    && /(澄清石灰水|石灰水|碳酸钙|caco₃|caco3|ca\(hco₃\)₂|ca\(hco3\)2|碳酸氢钙|碳酸氢盐|hco₃|hco3)/i.test(body)
    && /(持续通入|继续通入|过量.{0,12}(?:co₂|co2|二氧化碳)|继续.{0,12}(?:co₂|co2|二氧化碳)|沉淀.{0,16}(?:消失|溶解)|(?:消失|溶解).{0,16}沉淀|转化为可溶|生成.{0,12}碳酸氢|bicarbonate)/i.test(body)
    && !/(直接|只需|单纯|仅由.{0,12}生成沉淀|滴加碳酸钠|硫酸钠.*氯化钡|氯化钡.*硫酸钠)/i.test(promptText);
  const chemistryDirectSinglePrecipitationIonicEquationSelection = subject === 'chemistry'
    && !chemistryBicarbonatePrecipitateDissolutionBoundary
    && /(离子方程式|化学方程式|反应方程式|方程式|反应式).{0,24}(?:正确|书写|表示)|下列.{0,24}(?:离子方程式|化学方程式|反应方程式|方程式|反应式).{0,24}(?:正确|书写|表示)/i.test(body)
    && /(沉淀|白色沉淀|氯化银|agcl|硫酸钡|baso₄|baso4|碳酸钙|caco₃|caco3|氢氧化镁|mg\(oh\)₂|mg\(oh\)2)/i.test(body)
    && /(溶液|滴加|加入|混合)/i.test(promptText)
    && !/(醋酸|ch₃cooh|ch3cooh|弱酸|悬浊液|未知|可能含有|一定含有|鉴别|推断|依次|先.*再|再滴加|滤液|混合物|多种|过量.*(?:再|滤液|沉淀|溶解|co₂|co2|二氧化碳)|少量.*(?:再|滤液|沉淀|溶解)|继续.*(?:通入|加入|滴加)|沉淀.*(?:消失|溶解)|hco₃|hco3|碳酸氢|双沉淀|同时生成.*沉淀|两种沉淀|两性|部分溶解)/i.test(promptText)
    && noInterpretiveAsset;
  const chemistrySingleNotationRuleStatementSelection = subject === 'chemistry'
    && /(离子方程式|化学方程式|方程式|化学用语|书写规则|ionic equation|chemical notation)/i.test(body)
    && /(关于|下列|以下|哪一|哪项|说法|叙述|判断|rule|statement|which)/i.test(promptText)
    && /(弱酸|弱碱|难溶|不溶|气体|水|弱电解质|保留化学式|写分子式|不能拆|不应拆|拆写|旁观离子|删去|spectator|not split|insoluble|weak acid|gas)/i.test(correctOptionText)
    && !/(完整|同时|两个|两条|均|都|全部|组合|综合|推断|鉴别|未知|可能含有|一定含有|依次|先.*再|再滴加|滤液|混合物|多种|过量.*(?:再|滤液|沉淀|溶解|剩余)|少量.*(?:再|滤液|沉淀|溶解|剩余)|电荷守恒.*质量守恒|质量守恒.*电荷守恒|多步|步骤[①②③④⑤⑥])/i.test(promptText)
    && !/(→|=|->).{0,80}(→|=|->)/i.test(correctOptionText)
    && noInterpretiveAsset;
  const chemistryDirectConfirmedSinglePrecipitationEquationSelection = subject === 'chemistry'
    && /(离子方程式|ionic equation)/i.test(body)
    && /(沉淀|白色沉淀|agcl|氯化银|baso₄|baso4|硫酸钡)/i.test(body)
    && /(稀硝酸|hno₃|hno3|酸化|acid)/i.test(promptText)
    && /(不消失|不溶|仍存在|沉淀不溶|does not dissolve|insoluble)/i.test(promptText)
    && !/(可能|未知|样品|混合|工业盐|鉴别|推断|排除|无明显|未见气泡|多种|multiple|unknown|infer)/i.test(promptText)
    && noInterpretiveAsset;
  const chemistrySinglePrecipitationInterferenceScreen = subject === 'chemistry'
    && /(离子方程式|ionic equation)/i.test(body)
    && /(可能|未知|样品|工业盐|鉴别|推断|排除|无明显|未见气泡|multiple|unknown|infer)/i.test(promptText)
    && /(先加入|再滴入|再滴加|过量稀盐酸|白色沉淀)/i.test(promptText)
    && /(SO₄|SO4|硫酸根|CO₃|CO3|碳酸根|BaCl₂|BaCl2|Ba²|Ba\^?2|BaSO₄|BaSO4|Ag\+|Ag⁺|银离子|Cl-|Cl⁻|氯离子)/i.test(promptText)
    && /(沉淀生成|白色沉淀|↓)/i.test(body)
    && !/(未知.{0,12}(?:多种|多步|推断)|步骤[①②③④⑤⑥].*步骤[①②③④⑤⑥].*步骤[①②③④⑤⑥]|定量|计算|物质的量|浓度|质量|多种离子共存|interference chain)/i.test(body);
  const chemistryMultiEquationSystemDiscrimination = subject === 'chemistry'
    && chemistryMultipleEquationSystems
    && /(化学方程式|反应方程式|方程式|反应式).{0,18}(?:书写)?(?:正确|配平)|下列.{0,24}(?:化学方程式|反应方程式|方程式|反应式).{0,18}(?:正确|配平)/i.test(body)
    && noInterpretiveAsset;
  const chemistryObservationSignalCount = [
    '现象', '沉淀', '气体', '颜色', '红棕', '红褐', '蓝色', '白色', '无色', '澄清',
    '浑浊', '溶解', '褪色', '刺激性', '滴加', '加入', '加热', '过量', '少量'
  ].reduce((count, signal) => count + (body.includes(signal) ? 1 : 0), 0);
  const chemistryEquationEvidenceExplicitStepCount = (promptText.match(/[①②③④⑤⑥]|\b[1-6][.)、]|先|再|然后|另取|过滤|滤液/g) ?? []).length;
  const chemistryEquationEvidenceHasUnknownOrSample = /(未知|推断|鉴别|样品|可能含有|一定含有|不能含有|原溶液|滤液|混合物|甲|乙|丙|丁|溶液\s*[XYZ]|固体\s*[XYZ]|\b[XYZ]\b|unknown|infer|identify|mixture|filtrate|introduced)/i.test(promptText);
  const chemistryEquationEvidenceHasMultiStepControl = chemistryEquationEvidenceExplicitStepCount >= 2
    && /(过量|少量|依次|部分溶解|无明显变化|变红|褪色|干扰|排除|竞争|引入|不能共存|excess|interference|competing|introduced)/i.test(promptText);
  const chemistryEquationEvidenceChainHiddenInference = chemistryEquationEvidenceHasUnknownOrSample || chemistryEquationEvidenceHasMultiStepControl;
  const chemistryEquationEvidenceChainDiscrimination = subject === 'chemistry'
    && chemistryMultipleEquationSystems
    && /(化学方程式|反应方程式|方程式|反应式|离子方程式)/i.test(body)
    && chemistryEquationEvidenceChainHiddenInference
    && chemistryObservationSignalCount >= 2
    && noInterpretiveAsset;
  const chemistryQualitativeIonObservationChain = subject === 'chemistry'
    && /(离子|ion|溶液|无色|酚酞|bacl|氯化钡|盐酸|沉淀|气泡|褪色|颜色|指示剂)/i.test(body)
    && chemistryObservationSignalCount >= 3
    && /(一定含有|可能含有|推断|判断|鉴别|identify|infer|which ions?)/i.test(body)
    && !/(平衡常数|反应商|转移.*电子|k[cq]?|q[cq]?)/i.test(body);
  const chemistryIonExperimentStepCount = (promptText.match(/[①②③④⑤⑥]|\b[1-6][.)、]/g) ?? []).length;
  const chemistryIonConclusionText = `${correctOptionText} ${explanation}`.toLowerCase();
  const chemistryHardIonInterferenceConclusionChain = chemistryQualitativeIonObservationChain
    && chemistryIonExperimentStepCount >= 3
    && /(一定含有|一定含|必含|must contain|definitely contains)/i.test(chemistryIonConclusionText)
    && /(一定不含|不含|不能含|不能共存|must not contain|absent|incompatible)/i.test(chemistryIonConclusionText)
    && /(可能含有|无法确定|不能确定|试剂|引入|原溶液|共存|不能共存|过量|过滤|另取|excess|filtrate|introduced|original solution|coexist)/i.test(chemistryIonConclusionText);
  const chemistryInorganicPropertiesSignal = subject === 'chemistry'
    && /(常见无机物性质|无机物性质|物质性质|common inorganic|inorganic properties)/i.test(topicText);
  const chemistryDirectInorganicStoichiometryDomain = chemistryInorganicPropertiesSignal
    || (subject === 'chemistry'
      && !/(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(body)
      && !/(有机|organic|烃|醇|醛|羧酸|酯|官能团|functional group|溴水|银镜)/i.test(body)
      && !/(氧化还原|氧化剂|还原剂|被氧化|被还原|化合价|电子|转移|oxidation|reduction|redox|oxidant|reductant)/i.test(body));
  const chemistryPromptDirectInorganicStoichiometry = subject === 'chemistry'
    && /(摩尔质量|物质的量|mol|g\b|质量|molar mass|stoichiometr)/i.test(promptAndExplanation)
    && /(金属|mg|al|zn|fe|碳酸盐|碳酸氢盐|nahco₃|nahco3|na₂co₃|na2co3|caco₃|caco3|mgco₃|mgco3|盐酸|hcl|稀酸|acid)/i.test(promptAndExplanation)
    && /(h₂|h2|co₂|co2|氢气|二氧化碳|气体|gas)/i.test(promptAndExplanation)
    && !/(有机|organic|烃|醇|醛|羧酸|酯|官能团|functional group|溴水|银镜|金属钠)/i.test(promptAndExplanation)
    && !/(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(promptAndExplanation)
    && !/(氧化还原|氧化剂|还原剂|被氧化|被还原|化合价|电子|转移|oxidation|reduction|redox|oxidant|reductant)/i.test(promptAndExplanation)
    && !/(混合|可能含有|一定含有|推断|鉴别|依次|先.*再|过量.*剩余|剩余.*过量|滤液|沉淀.*溶解|颜色变化|实验方案|interference|competing|conversion)/i.test(promptText);
  const chemistryAtomicInorganicStoichiometry = subject === 'chemistry'
    && /(摩尔质量|物质的量|mol|molar mass)/i.test(promptAndExplanation)
    && /(h₂|h2|co₂|co2|氢气|二氧化碳)/i.test(promptAndExplanation)
    && /(金属|mg|al|zn|fe|碳酸|nahco₃|nahco3|na₂co₃|na2co3|caco₃|caco3|mgco₃|mgco3|盐酸|hcl|稀酸|acid)/i.test(promptAndExplanation)
    && !/(有机|organic|烃|醇|醛|羧酸|酯|官能团|functional group|溴水|银镜|金属钠|nahco₃|nahco3)/i.test(promptAndExplanation)
    && !/(平衡|勒夏特列|可逆反应|equilibrium|le chatelier|reversible reaction|⇌|↔|<=>)/i.test(promptAndExplanation)
    && !/(氧化还原|氧化剂|还原剂|被氧化|被还原|化合价|电子|转移|oxidation|reduction|redox|oxidant|reductant)/i.test(promptAndExplanation)
    && !/(混合|可能含有|一定含有|推断|鉴别|依次|先.*再|过量.*剩余|剩余.*过量|滤液|沉淀.*溶解|颜色变化|实验方案|反应链|conversion|competing|interference)/i.test(promptText);
  const chemistryTopicAtomicInorganicStoichiometry = chemistryInorganicPropertiesSignal
    && /(摩尔质量|物质的量|mol|molar mass)/i.test(promptAndExplanation)
    && /(h₂|h2|co₂|co2|氢气|二氧化碳)/i.test(promptAndExplanation)
    && /(金属|mg|al|zn|fe|碳酸|nahco₃|nahco3|na₂co₃|na2co3|caco₃|caco3|mgco₃|mgco3|盐酸|hcl|稀酸|acid)/i.test(promptAndExplanation)
    && !/(混合|可能含有|一定含有|推断|鉴别|依次|先.*再|过量.*剩余|剩余.*过量|滤液|沉淀.*溶解|颜色变化|实验方案|反应链|conversion|competing|interference)/i.test(promptText);
  const chemistryDirectInorganicStoichiometry = (chemistryDirectInorganicStoichiometryDomain || chemistryPromptDirectInorganicStoichiometry)
    && /(摩尔质量|物质的量|mol|g\b|质量|化学计量|molar mass|stoichiometr)/i.test(body)
    && /(金属|mg|al|zn|fe|碳酸盐|碳酸氢盐|nahco₃|nahco3|na₂co₃|na2co3|caco₃|caco3|mgco₃|mgco3|盐酸|hcl|稀酸|acid)/i.test(body)
    && /(h₂|h2|co₂|co2|气体|gas)/i.test(body)
    && chemistryObservationSignalCount <= 2
    && !/(混合|可能含有|一定含有|推断|鉴别|依次|先.*再|过量.*剩余|剩余.*过量|滤液|沉淀.*溶解|颜色变化|实验方案|interference|competing|conversion)/i.test(promptText)
    && noInterpretiveAsset;
  const chemistryStandardMixtureGasStoichiometry = subject === 'chemistry'
    && /(混合物|混合|mixture)/i.test(body)
    && /(mg|al|zn|fe|铁|铝|锌|镁|金属)/i.test(body)
    && /(盐酸|硫酸|稀酸|hcl|h₂so₄|h2so4|acid)/i.test(body)
    && /(h₂|h2|氢气|标准状况|气体体积|gas volume)/i.test(body)
    && /(足量|完全反应|充分反应|过量|excess|complete)/i.test(body)
    && !/(先.*再|依次|过滤|滤液|洗涤|灼烧|沉淀.*溶解|颜色变化|推断|鉴别|未知|naoh|氢氧化钠|interference|competing|conversion|amphoteric|两性)/i.test(promptText)
    && noInterpretiveAsset;
  const chemistryTransparentLimitingReagentStoichiometry = subject === 'chemistry'
    && /(反应|→|->|=)/i.test(body)
    && /(加入|混合|充分反应|完全反应|限量|过量|足量)/i.test(promptText)
    && /(充分反应|完全反应|限量|过量|足量|剩余|不足|恰好|limiting reagent|excess|complete)/i.test(body)
    && /(?:\d+(?:\.\d+)?\s*(?:g|克|mol|mol\/l|mol·l|mL|ml|l\b)|质量|体积|浓度|物质的量)/i.test(body)
    && /(下列|以下|哪项|哪一|说法|叙述|正确|错误|求|计算|多少|determine|calculate)/i.test(promptText)
    && !/(先.*再|依次|过滤|滤液|洗涤|灼烧|沉淀.*溶解|颜色变化|推断|鉴别|未知|naoh|氢氧化钠|interference|competing|conversion|amphoteric|两性|选择.*反应路径|竞争反应)/i.test(promptText)
    && !chemistryReactionRateVariableControlExperiment
    && noInterpretiveAsset;
  const chemistryStandardStoichiometrySystem = chemistryStandardMixtureGasStoichiometry || chemistryTransparentLimitingReagentStoichiometry;
  const chemistryStoichiometrySeparationEvidenceChain = subject === 'chemistry'
    && /(混合物|混合|合金|样品|mixture|alloy)/i.test(body)
    && /(mg|al|zn|fe|铁|铝|锌|镁|金属)/i.test(body)
    && /(h₂|h2|氢气|标准状况|气体体积|gas volume)/i.test(body)
    && /(naoh|氢氧化钠|过滤|滤液|洗涤|灼烧|沉淀|两性|amphoteric|redissolution)/i.test(body)
    && /(质量分数|含量|组成|组分|剩余|沉淀|固体|mass fraction|composition)/i.test(body)
    && noInterpretiveAsset;
  const chemistryOrganicCombustionFunctionalInference = subject === 'chemistry'
    && /(有机|organic|烃|醇|醛|羧酸|酯|官能团|functional group)/i.test(body)
    && /(完全燃烧|燃烧生成|combustion|co₂|co2|h₂o|h2o)/i.test(body)
    && /(质量|g\b|mol|物质的量|最简式|分子式|empirical formula|molecular formula)/i.test(body)
    && /(nahco₃|nahco3|碳酸氢钠|酸性|羧酸|醛|醇|酯|放出co₂|放出co2|气体)/i.test(body);
  const chemistryOrganicContext = subject === 'chemistry'
    && /(有机|organic|烃|醇|醛|羧酸|酯|官能团|functional group|有机化合物|有机物|含c、h、o|含c,h,o|分子式.{0,12}c\d*h\d*o?|c\d+h\d+o\d*)/i.test(body);
  const chemistryOrganicSignal = chemistryOrganicContext
    && /(有机|organic|烃|醇|醛|羧酸|酯|官能团|functional group|溴水|银镜|金属钠|nahco₃|nahco3)/i.test(body);
  const chemistryOrganicEvidenceSignalCount = [
    /完全燃烧|燃烧生成|combustion|co₂|co2|h₂o|h2o/i,
    /金属钠|与Na反应|生成[^。；;，,]*H₂(?!O)|生成[^。；;，,]*H2(?!O)|放出[^。；;，,]*(?:H₂|H2|氢气)/i,
    /nahco₃|nahco3|碳酸氢钠|放出co₂|放出co2/i,
    /溴水|溴的四氯化碳|br2|褪色/i,
    /银镜|斐林|fehling|醛/i,
    /水解|酯化|氧化|取代|加成/i
  ].reduce((count, pattern) => count + (pattern.test(promptAndExplanation) ? 1 : 0), 0);
  const chemistryOrganicNonCombustionEvidenceSignalCount = [
    /金属钠|与Na反应|生成[^。；;，,]*H₂(?!O)|生成[^。；;，,]*H2(?!O)|放出[^。；;，,]*(?:H₂|H2|氢气)/i,
    /nahco₃|nahco3|碳酸氢钠|放出co₂|放出co2/i,
    /溴水|溴的四氯化碳|br2|褪色/i,
    /银镜|斐林|fehling|醛/i,
    /水解|酯化|氧化|取代|加成/i
  ].reduce((count, pattern) => count + (pattern.test(promptAndExplanation) ? 1 : 0), 0);
  const chemistryDirectOrganicFunctionalIdentification = chemistryOrganicSignal
    && /(分子式|化学式|formula|C₂H₆O|C2H6O|C₂H₄|C2H4|C₂H₂|C2H2)/i.test(body)
    && chemistryOrganicEvidenceSignalCount <= 2
    && /(属于|一定是|推断|结构简式|官能团|哪种化合物|which compound|functional group)/i.test(body)
    && !/(完全燃烧|燃烧生成|co₂|co2|h₂o|h2o|混合物|未知.*[XYZA]|A.*B.*C|产物.*推断|同分异构|isomer)/i.test(body);
  const chemistryOrganicQuantitativeMultiEvidenceInference = chemistryOrganicSignal
    && chemistryOrganicEvidenceSignalCount >= 3
    && chemistryOrganicNonCombustionEvidenceSignalCount >= 2
    && /(完全燃烧|燃烧生成|co₂|co2|h₂o|h2o|物质的量|质量|mol|g\b|相对分子质量|分子式)/i.test(promptAndExplanation)
    && /(官能团|结构简式|组合|推断|同分异构|isomer|product inference|银镜|溴水|金属钠|nahco₃|nahco3|水解|酯化|氧化|取代|加成)/i.test(promptAndExplanation)
    && !chemistryDirectOrganicFunctionalIdentification;
  const chemistryRedoxTopicSignal = subject === 'chemistry'
    && /(氧化还原|氧化剂|还原剂|电子转移|redox|oxidation|reduction|oxidant|reductant)/i.test(topicText);
  const chemistryExplicitRedoxSignal = subject === 'chemistry'
    && /(氧化还原|氧化剂|还原剂|被氧化|被还原|电子转移|转移[^。；;，,]*电子|redox|oxidation|reduction|oxidant|reductant)/i.test(body);
  const chemistryRedoxPropertySignal = subject === 'chemistry'
    && /(氧化性|还原性|氧化数|oxidizing|reducing|(?:化合价|价态|valence)[^。；;，,]*(?:升高|降低|变化|改变|转移|氧化|还原|电子)|(?:升高|降低|变化|改变)[^。；;，,]*(?:化合价|价态|valence))/i.test(body)
    && /(反应|方程式|试剂|实验|现象|滴加|溶液|生成|产物|→|->|⇌|<=>|reaction|reagent|product)/i.test(body);
  const chemistryRedoxSignal = chemistryRedoxTopicSignal || chemistryExplicitRedoxSignal || chemistryRedoxPropertySignal;
  const chemistryRedoxEquationCount = (body.match(/→|->|⇌|<=>/g) ?? []).length;
  const chemistryBasicRedoxOptionPairJudgement = chemistryRedoxSignal
    && chemistryRedoxEquationCount <= 1
    && /(下列|以下|说法|叙述|正确|错误|判断|statement)/i.test(promptText)
    && /(失去电子|得到电子|得电子|失电子|loses? electrons?|gains? electrons?)/i.test(body)
    && /(被氧化|被还原|氧化反应|还原反应|oxidized|reduced)/i.test(body)
    && !/(mol|mmol|物质的量|体积|标准状况|22\.4|恰好|完全|足量|不足|限量|优先|先氧化|全部被氧化|全部被还原|既作|又作|歧化|归中|理论上|比值|之比|计算|排序|强弱|未知|推断|①|②|③|Ⅰ|Ⅱ|I\)|II\)|compare|rank|infer)/i.test(`${promptText} ${optionText} ${explanation}`);
  const chemistryBasicRedoxSingleSpeciesJudgement = chemistryRedoxSignal
    && chemistryRedoxEquationCount <= 1
    && (
      (
        /(氧化剂是|还原剂是|被氧化的物质是|被还原的物质是|哪种元素.{0,12}化合价升高|哪种元素.{0,12}化合价降低|作用是|作用是什么|发生了哪种变化|发生氧化|发生还原|是（|oxidant|reductant|oxidized|reduced)/i.test(promptText)
        && !/(下列|以下|说法|叙述|正确|错误|每生成|转移|全部|既作|只作|未知|推断|排序|强弱|先.*再|过量|少量|限量|①|②|③|Ⅰ|Ⅱ|I\)|II\)|多种|若干|混合|compare|rank|infer)/i.test(promptText)
      )
      || chemistryBasicRedoxOptionPairJudgement
    );
  const chemistryDirectRedoxSingleReactionJudgement = chemistryRedoxSignal
    && chemistryRedoxEquationCount <= 1
    && /(下列|以下|哪项|哪一|说法|叙述|正确|错误|判断|statement)/i.test(promptText)
    && !/(未知|推断|排序|强弱|氧化性|还原性|先.*再|过量|少量|限量|实验|现象|滴加|颜色|气体|①|②|③|Ⅰ|Ⅱ|I\)|II\))/i.test(promptText);
  const chemistryRedoxMolQuantityCount = (body.match(/\d+(?:\.\d+)?\s*(?:mol|mmol|mmol⁻¹|mmol-1)|\d+(?:\.\d+)?\s*(?:L|mL|ml)\b/gi) ?? []).length;
  const chemistryRedoxQuantitativeConstraintChain = chemistryRedoxSignal
    && !chemistryBasicRedoxSingleSpeciesJudgement
    && shape.calculationLoad !== 'none'
    && (
      (
        chemistryRedoxMolQuantityCount >= 2
        && /(充分反应|完全反应|恰好|耗尽|不足|过量|限量|剩余|若要使|全部氧化|全部还原|转移电子|electron transfer)/i.test(body)
        && /(反应式|方程式|→|=|被氧化|被还原|转移|电子|氧化为|还原为|oxidized|reduced)/i.test(body)
      )
      || (
        chemistryRedoxMolQuantityCount >= 1
        && /(分别|两种|V\/n|体积为V|消耗.{0,12}物质的量为n|mL·mmol|标准状况)/i.test(body)
        && /(Cl₂|Cl2|KMnO₄|KMnO4|MnO₄|MnO4|Fe²|Fe2|Fe3|Fe³|Mn²|Mn2)/i.test(body)
      )
      || (
        chemistryRedoxEquationCount >= 2
        && /(物质的量|体积|标准状况|转移电子|mol|mmol|mL|L\b)/i.test(body)
      )
    );
  const chemistrySingleHalogenDisplacementObservationBasicCap = subject === 'chemistry'
    && /(原子结构|元素周期律|周期表|非金属性|卤素|periodic|halogen|nonmetallic)/i.test(`${topicText} ${body}`)
    && /(氯水|溴水|碘水|cl₂|cl2|br₂|br2|i₂|i2|kbr|ki|nabr|nai|碘化钾|溴化钾|溴化钠|碘化钠|卤素)/i.test(body)
    && /(置换|生成.{0,12}(?:br₂|br2|i₂|i2|溴|碘)|橙黄|橙红|棕黄|紫色|无明显变化|displacement|turns orange|turns brown)/i.test(promptText)
    && /(非金属性|氧化性|更易得电子|activity|nonmetallic|oxidizing)/i.test(`${correctOptionText} ${explanation}`)
    && shape.calculationLoad === 'none'
    && !shape.hasTable
    && !shape.hasDiagram
    && prompt.length <= 180
    && chemistryRedoxEquationCount <= 1
    && !/(未知|推断.*(?:多种|组成)|排序|强弱顺序|依次|先.*再|限量|①|②|③|Ⅰ|Ⅱ|I\)|II\)|多种|混合|计算|物质的量|浓度)/i.test(promptText);
  const chemistryRedoxEvidenceChainDiscrimination = chemistryRedoxSignal
    && !chemistryBasicRedoxSingleSpeciesJudgement
    && !chemistryDirectMetalWeakAcidIonicEquationSelection
    && !chemistrySingleHalogenDisplacementObservationBasicCap
    && (chemistryRedoxQuantitativeConstraintChain || chemistryRedoxEquationCount >= 2 || /(未知|推断|排序|强弱|氧化性|还原性|先.*再|过量|少量|限量|实验|现象|滴加|颜色|气体|①|②|③|Ⅰ|Ⅱ|I\)|II\))/i.test(promptText))
    && (
      chemistryRedoxTopicSignal
      || chemistryRedoxEquationCount >= 2
      || /(电子|电子转移|转移[^。；;，,]*电子|化合价|氧化数|氧化剂|还原剂|被氧化|被还原|oxidizing agent|reducing agent|electron|valence)/i.test(body)
    );
  const chemistryPeriodicSignal = subject === 'chemistry'
    && /(原子结构|元素周期律|周期表|短周期|主族|电子排布|最外层电子|原子半径|离子半径|电负性|第一电离能|最高价氧化物|氢化物|periodic|atomic structure|electron configuration|ionization energy|electronegativity)/i.test(`${topicText} ${body}`);
  const chemistryPeriodicUnknownLabelCount = new Set((promptText.match(/\b[X-ZW]\b|甲|乙|丙|丁/g) ?? [])).size;
  const chemistryPeriodicPropertySignalCount = [
    /电子层结构|电子排布|最外层电子|质子数|核外电子|同周期|同主族|短周期|主族/i,
    /原子半径|离子半径|半径/i,
    /电负性|非金属性|金属性|第一电离能|电离能/i,
    /最高价氧化物|水化物|酸性|碱性|氢化物|气态氢化物/i,
    /化合价|氧化数|阴离子|阳离子|稳定结构/i,
    /同位素|质量数|中子数|质子数|原子序数|丰度|相对原子质量|isotope|mass number|neutron|proton|atomic number|abundance/i,
    /离子.*电子|电子数|核外电子数|ion electron|electron count/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistryPeriodicQuantitativeConstraintCount = [
    /同位素|质量数|中子数|质子数|原子序数|丰度|相对原子质量|isotope|mass number|neutron|proton|atomic number|abundance/i,
    /离子.*电子|电子数|核外电子数|ion electron|electron count/i,
    /阴离子|阳离子|[²³⁺⁻+-]|2-|2\+|3-|3\+|charge/i,
    /质量数.*(?:和|差|比|分别)|中子数.*(?:和|差|比|分别)|原子序数.*(?:和|差|比|分别)|sum|difference|ratio/i,
    /求|计算|多少|推断|determine|calculate|find/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistrySameElectronIonTokenCount = (body.match(/(?:[A-Z][a-z]?|[A-Z])\s*(?:\d?[+\-]|[²³]?[⁺⁻])|[A-Z][a-z]?[²³]?[⁺⁻]/g) ?? []).length;
  const chemistrySameElectronTwoIonRadiusBasicCap = chemistryPeriodicSignal
    && /(等电子|相同电子|同电子|电子层结构相同|电子排布相同|核外电子排布相同|与\s*ne\s*原子.{0,12}相同|same electron)/i.test(body)
    && /(离子半径|半径|radius)/i.test(body)
    && /(大于|小于|依次|测得|比较|判断|结论|larger|smaller|compare|observed)/i.test(body)
    && shape.calculationLoad === 'none'
    && !shape.hasTable
    && !shape.hasDiagram
    && !/(三种|3种|three|排序|由大到小|由小到大|依次减小|依次增大)/i.test(promptText)
    && chemistrySameElectronIonTokenCount <= 2;
  const chemistryPeriodicOxideHydrateAcidBaseBasicCap = chemistryPeriodicSignal
    && /(最高价氧化物|氧化物.{0,12}水化物|水化物|oxide hydrate|oxide.*hydrate)/i.test(body)
    && /(酸性|碱性|石蕊|变红|变蓝|强酸|强碱|acidic|basic|litmus)/i.test(body)
    && /(金属性|非金属性|周期表|主族|左侧|右侧|metallic|nonmetallic|periodic)/i.test(`${correctOptionText} ${explanation}`)
    && shape.calculationLoad === 'none'
    && !shape.hasTable
    && !shape.hasDiagram
    && chemistryPeriodicUnknownLabelCount <= 1
    && !/(X、Y|X,Y|甲、乙|三种|多种|排序|强弱顺序|依次|①|②|③|Ⅰ|Ⅱ|I\)|II\)|计算|物质的量|浓度)/i.test(promptText);
  const chemistryPeriodicMultiClueInference = chemistryPeriodicSignal
    && (
      (
        (chemistryPeriodicUnknownLabelCount >= 3 || /(X、Y、Z|X,Y,Z|甲、乙、丙)/i.test(promptText))
        && chemistryPeriodicPropertySignalCount >= 3
        && /(推断|比较|排序|判断|正确|错误|identify|infer|compare|rank)/i.test(body)
        && /(一定|可能|下列|选项|说法|叙述|大小|强弱|酸性|碱性|半径|电离能|电负性)/i.test(body)
      )
      || (
        chemistryPeriodicQuantitativeConstraintCount >= 4
        && shape.calculationLoad !== 'none'
        && /(求|计算|多少|质量数|中子数|质子数|原子序数|相对原子质量|determine|calculate|find|mass number|neutron|proton|atomic number)/i.test(promptAndExplanation)
      )
    );
  const chemistryBondForceTopicSignal = subject === 'chemistry'
    && /(化学键|分子间作用力|氢键|色散力|范德华|极性|离子晶体|分子晶体|晶格|键能|汽化热|沸点|熔点|bond|intermolecular|hydrogen bond|dispersion|polarity|lattice|enthalpy|boiling point|melting point)/i.test(`${topicText} ${body}`);
  const chemistryBondForceDataSignalCount = [
    /已知|数据|分别为|table|dataset/i,
    /沸点|熔点|汽化热|键能|半径|摩尔质量|分子量|boiling point|melting point|enthalpy|bond energy|radius|molar mass/i,
    /预测|推算|外推|比较|差值|偏差|异常|高于|低于|predict|estimate|extrapolat|compare|difference|deviation|anomaly/i,
    /实际|测得|actual|observed/i,
    /氢键|色散力|范德华|极性|离子键|晶格|分子间作用力|hydrogen bond|dispersion|polarity|ionic|lattice|intermolecular/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistryBondForceNumericCount = (body.match(/\d+(?:\.\d+)?\s*(?:°c|℃|kj\/mol|kj|pm|g\/mol|mol|%|kJ\/mol)/gi) ?? []).length;
  const chemistryHardBondForceDataAnomalyCalculation = chemistryBondForceTopicSignal
    && chemistryBondForceDataSignalCount >= 4
    && chemistryBondForceNumericCount >= 4
    && shape.calculationLoad !== 'none'
    && /(预测|推算|外推|比较|差值|偏差|异常|高于|低于|predict|estimate|extrapolat|compare|difference|deviation|anomaly)/i.test(promptAndExplanation);
  const chemistryDirectClassificationOrChangeJudgement = subject === 'chemistry'
    && /(物质分类|状态变化|物理变化|化学变化|纯净物|混合物|单质|化合物|氧化物|classification|state change|physical change|chemical change)/i.test(`${topicText} ${body}`)
    && /(属于|不属于|是|不是|哪一|哪项|哪些|判断|分类|物理变化|化学变化|纯净物|混合物|单质|化合物|氧化物|category|classify|physical|chemical)/i.test(body)
    && !/(计算|求|质量|物质的量|浓度|ph|mol|g\b|平衡|可逆|氧化还原|氧化剂|还原剂|化合价|电子|推断.*组成|未知.*物质|鉴别)/i.test(body)
    && noInterpretiveAsset;
  const chemistryDirectLabSafetyOrInstrumentOperation = subject === 'chemistry'
    && /(实验室安全|仪器使用|实验操作|安全操作|酒精灯|试管|量筒|滴管|砝码|托盘天平|闻气体|扇闻|加热|读数|凹液面|灯帽|镊子|lab safety|instrument)/i.test(`${topicText} ${body}`)
    && /(正确|错误|操作|方法|读数|使用|倾斜|盖灭|扇闻|which|statement)/i.test(body)
    && !/(误差|偏大|偏小|上限|下限|最大|最小|配制|浓度|物质的量|mol|容量瓶|滴定|定容|转移|实验方案|探究|分离|鉴别|推断|计算|求|calculate|titration|error)/i.test(body)
    && noInterpretiveAsset
    && shape.formulaCount === 0
    && shape.conditionCount <= 4;
  const chemistryDirectClassificationConditionCount = (promptText.match(/①|②|③|④|步骤|先|再|然后|过滤|蒸发|加热|研磨|加入|滴加|step/g) ?? []).length;
  const chemistrySingleStepNotationIdentityJudgement = subject === 'chemistry'
    && /(化学用语|方程式书写|化学式|离子符号|chemical notation|equation writing|formula writing)/i.test(topicText)
    && /(化学式|沉淀|物质|产物|生成物|盐|硫酸盐|碳酸盐|离子).{0,18}(?:是|为|化学式|名称|identify|formula)|(?:该|此|生成的).{0,16}(?:白色|红褐色|蓝色|灰绿色|黑色)?(?:沉淀|物质|产物|生成物|盐|硫酸盐|碳酸盐|化合物).{0,16}(?:是|为|化学式)/i.test(promptText)
    && /(加入|滴加|溶液|沉淀|颜色|白色|红褐色|灰绿色|蓝色|无色|naoh|氢氧化钠)/i.test(promptText)
    && !/(离子方程式|化学方程式|反应方程式|方程式|反应式|配平|电荷守恒|质量守恒|原子守恒|过量.*(?:再|滤液|沉淀|溶解)|少量.*(?:再|滤液|沉淀|溶解)|滤液|混合|未知|可能含有|一定含有|推断|鉴别|依次|先.*再.*再|多步|步骤[①②③④⑤⑥])/i.test(promptText)
    && noInterpretiveAsset;
  const chemistryExperimentalQuantitativeErrorPropagation = subject === 'chemistry'
    && !chemistryQualitativePhPaperWettingJudgement
    && /(实验|配制|容量瓶|量筒|滴定管|移液管|托盘天平|称量|稀释|定容|读数|误差|experiment|volumetric|dilution|titration|error)/i.test(body)
    && /(误差|上限|下限|最大值|最小值|偏大|偏小|不确定度|±|读数误差|error|maximum|minimum|upper|lower)/i.test(body)
    && /(两步|多步|先.*再|连续|最终|所得|传递|累计|step|successive|final)/i.test(body)
    && /(浓度|物质的量浓度|质量分数|体积|mol\/l|mol·l|mol\s*l|calculate|求|多少|是多少)/i.test(body);
  const chemistrySeparationSolubilityCrystallizationCalculation = subject === 'chemistry'
    && /(分离|提纯|重结晶|结晶|析晶|粗品|杂质|separation|purification|recrystallization|crystallization)/i.test(`${topicText} ${body}`)
    && /(溶解度|冷却|析出|母液|蒸发浓缩|饱和|solubility|mother liquor|cooling)/i.test(body)
    && /(g\b|克|质量|理论上|可获得|求|计算|多少|℃|°c|mol|calculate)/i.test(body)
    && !/(吸附|表面附着|夹带|包裹|二次|两次|再次|连续|损失|yield|impurity mass fraction)/i.test(body);
  const chemistrySeparationRouteTopic = subject === 'chemistry'
    && /(分离|提纯|重结晶|结晶|萃取|蒸馏|过滤|升华|洗涤|干燥|粗品|杂质|separation|purification|recrystallization|crystallization|extraction|distillation|filtration|sublimation)/i.test(`${topicText} ${body}`);
  const chemistrySeparationOperationSignalCount = [
    /过滤|抽滤|趁热过滤|filter|filtration/i,
    /蒸发|结晶|冷却结晶|重结晶|析晶|母液|crystallization|recrystallization|mother liquor/i,
    /蒸馏|分馏|沸点|distillation|boiling point/i,
    /萃取|分液|有机层|水层|extraction|separatory/i,
    /升华|sublimation/i,
    /洗涤|干燥|吸附|活性炭|除杂|purification|drying|adsorption/i,
    /溶解|酸溶|碱溶|反应除去|沉淀|dissolve|precipitation/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistrySeparationTradeoffSignalCount = [
    /损失|回收率|产物损失|夹带|包裹|吸附|母液|product loss|yield|mother liquor|occlusion/i,
    /杂质|纯度|混入|残留|未除尽|带入|impurity|carryover|contamination/i,
    /溶解度|温度|冷却|趁热|饱和|solubility|temperature/i,
    /沸点|挥发|升华|密度|分层|相|boiling point|volatile|phase|density/i,
    /先.*再|顺序|路线|方案|步骤|operation order|route|sequence/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistrySeparationRouteRejectionText = `${correctOptionText} ${explanation}`;
  const chemistrySeparationRouteRejection = /(不宜|不能|不可|错误|不合理|否则|会导致|导致|因为|应先|再|若先|直接.*会|路线|方案|排除|reject|because|otherwise|tempting)/i.test(chemistrySeparationRouteRejectionText)
    && /(损失|夹带|混入|残留|未除尽|带入|杂质|纯度|母液|吸附|分层|乳化|沸点|升华|溶解度|顺序|product loss|impurity|carryover|order)/i.test(chemistrySeparationRouteRejectionText);
  const chemistryHardSeparationRouteElimination = chemistrySeparationRouteTopic
    && chemistrySeparationOperationSignalCount >= 3
    && chemistrySeparationTradeoffSignalCount >= 3
    && chemistrySeparationRouteRejection
    && !/(分配系数.*计算|回收率.*(?:多少|计算|%)|纯度.*(?:多少|计算|%)|yield.*calculate|recovery.*calculate)/i.test(body);
  const chemistryGasPreparationPurificationObservationChain = subject === 'chemistry'
    && /(气体|o₂|o2|h₂|h2|co₂|co2|cl₂|cl2|nh₃|nh3|氧气|氢气|二氧化碳|氯气|氨气|gas)/i.test(`${topicText} ${body}`)
    && /(气体.{0,20}(制备|检验|收集|干燥|除杂)|制备|发生装置|收集|检验|除杂|干燥|饱和食盐水|浓硫酸|石蕊|澄清石灰水|木条|通入|通过|preparation|collection|test|purification|drying|litmus|limewater)/i.test(`${topicText} ${promptText}`)
    && (shape.conditionCount >= 4 || /(依次|先.*后|随后|再|然后|through|then|subsequently)/i.test(body))
    && /(现象|观察到|变红|变蓝|褪色|浑浊|复燃|爆鸣|phenomenon|observe|turns|bleaches|cloudy)/i.test(body);
  const chemistryGasProcedureStepCount = (promptText.match(/[①②③④⑤⑥]|\b[1-6][.)、]/g) ?? []).length
    + (promptText.match(/→|->/g) ?? []).length;
  const chemistryGasProcedureStageSignalCount = [
    /制取|制备|生成|分解|发生装置|加热|prepar|generate/i,
    /除杂|除去|除尽|吸收|洗气|饱和食盐水|naoh|碱石灰|purif|remove|absorb/i,
    /干燥|水蒸气|h2o|浓硫酸|无水|dry|moisture/i,
    /收集|排空气|排水|collection|collect/i,
    /检验|验满|木条|石蕊|澄清石灰水|浓盐酸|白烟|爆鸣|复燃|test|verify|litmus|limewater/i,
    /干扰|排除|竞争|杂质|混有|原气体|混合气|含.{0,24}(?:co2|h2o|nh3|二氧化碳|水蒸气|氨气)|除.*干扰|interference|competing|impurity/i
  ].reduce((count, pattern) => count + (pattern.test(promptText) ? 1 : 0), 0);
  const chemistryGasConclusionText = `${correctOptionText} ${explanation}`.toLowerCase();
  const chemistryGasIntegratedClaimCount = [
    /so₂|so2|二氧化硫|品红|kmno₄|kmno4|高锰酸钾/i,
    /co₂|co2|二氧化碳|澄清石灰水|石灰水/i,
    /h₂o|h2o|水蒸气|无水cuso₄|无水cuso4|干燥|浓硫酸/i,
    /hcl|氯化氢|盐酸|酸雾|酸性气体|饱和食盐水|饱和nahco₃|饱和nahco3/i,
    /naoh|氢氧化钠|碱石灰|浓硫酸|无水cacl₂|无水cacl2|干燥管|吸收剂|洗气/i,
    /h₂|h2|氢气|爆鸣|燃着木条|o₂|o2|氧气|带火星|复燃|nh₃|nh3|氨气|红色石蕊|白烟|cl₂|cl2|氯气|淀粉碘化钾|ki/i,
    /除去|除尽|吸收|足量|不褪色|再次|purif|remove|absorb|excess/i,
    /干扰|排除|竞争|必须|顺序|先.*后|interference|competing|order/i
  ].reduce((count, pattern) => count + (pattern.test(chemistryGasConclusionText) ? 1 : 0), 0);
  const chemistryGasIndependentTestSignalCount = [
    /湿润红色石蕊|红色石蕊.{0,12}变蓝|litmus/i,
    /浓盐酸|白烟|hcl.{0,20}white smoke|white smoke/i,
    /澄清石灰水|石灰水.{0,12}(?:浑浊|不变浑浊)|limewater/i,
    /带火星木条|木条.{0,12}复燃|glowing splint/i,
    /燃着木条|爆鸣|pop sound|burning splint/i,
    /品红.{0,12}褪色|品红.{0,12}不褪色|fuchsin/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistryHardGasAcidMoistureInterferenceChain = chemistryGasPreparationPurificationObservationChain
    && /(co₂|co2|二氧化碳|hcl|氯化氢|盐酸|酸性气体|水蒸气|h₂o|h2o|moisture|acid gas)/i.test(body)
    && /(饱和nahco₃|饱和nahco3|碳酸氢钠|naoh|氢氧化钠|浓h₂so₄|浓h2so4|浓硫酸|无水cuso₄|无水cuso4|干燥|吸收|除去|除杂)/i.test(body)
    && /(浓h₂so₄|浓h2so4|浓硫酸|无水cuso₄|无水cuso4|干燥|水蒸气|h₂o|h2o|湿润.{0,18}干燥|干燥.{0,18}湿润|干冷烧杯|水珠|重新带水|moisture|dry)/i.test(body)
    && /(依次|先.*后|随后|再|然后|顺序|前移|颠倒|省去|若省略|若.*放在|through|then|order)/i.test(body)
    && (chemistryGasIndependentTestSignalCount >= 2 || /(干燥.{0,12}石蕊|湿润.{0,12}石蕊|干冷烧杯|水珠|不变浑浊|变浑浊|石灰水|limewater|litmus)/i.test(body))
    && /(干扰|排除|顺序|重新带水|湿润.*变|干燥.*不变|若省略|若.*前|否则|不能.*浑浊|先.*除|再.*干燥|interference|order)/i.test(chemistryGasConclusionText);
  const chemistryHardGasImpurityControlChain = chemistryGasPreparationPurificationObservationChain
    && Math.max(chemistryGasProcedureStepCount, chemistryGasProcedureStageSignalCount) >= 5
    && (chemistryGasIntegratedClaimCount >= 4 || (chemistryGasIntegratedClaimCount >= 3 && chemistryGasIndependentTestSignalCount >= 2))
    && /(除去|除尽|吸收|干扰|排除|竞争|再次|不褪色|足量|remove|interference|competing|confirm)/i.test(chemistryGasConclusionText);
  const chemistryBasicGasSingleFactOrOperationCap = subject === 'chemistry'
    && /(常见气体制备与检验|气体.{0,12}(制备|检验|收集)|gas preparation|gas collection|gas test)/i.test(topicText)
    && /(气体|o₂|o2|h₂|h2|co₂|co2|cl₂|cl2|nh₃|nh3|氧气|氢气|二氧化碳|氯气|氨气|gas)/i.test(body)
    && /(棉花|排水法|排空气法|向上排空气|向下排空气|验满|验纯|木条|石蕊|澄清石灰水|干燥剂|收集|检验|collection|litmus|limewater|drying agent|splint)/i.test(body)
    && noInterpretiveAsset
    && shape.calculationLoad === 'none'
    && !chemistryHardGasImpurityControlChain
    && chemistryGasProcedureStageSignalCount <= 3
    && chemistryGasProcedureStepCount <= 2
    && !/(依次.{0,20}(?:通过|通入|再|然后)|先.{0,20}再.{0,20}(?:再|然后)|除杂.{0,24}干燥|干燥.{0,24}除杂|干扰.{0,24}排除|competing|interference)/i.test(promptText);
  const chemistryBasicIonCompoundUnitConversionSignals = [
    /样品|sample|粉末|固体|质量|mass|g\b|克/i,
    /气体|co₂|co2|nh₃|nh3|体积|volume|ml\b|mL\b|\bL\b|标准状况|stp|22\.4/i,
    /摩尔质量|molar mass|相对分子质量|relative molecular mass/i,
    /溶液|solution|浓度|mol\/l|mol·l|mol\s*l|物质的量浓度/i,
    /哪一种|最可能|金属离子|identify|which|unknown/i
  ].reduce((count, pattern) => count + (pattern.test(body) ? 1 : 0), 0);
  const chemistryBasicIonCompoundUnitConversionChain = subject === 'chemistry'
    && /(离子反应|离子检验|离子鉴别|ion identification|qualitative ion|precipitation test)/i.test(topicText)
    && chemistryBasicIonCompoundUnitConversionSignals >= 3
    && /(求|多少|是多少|浓度|物质的量|哪一种|最可能|金属离子|calculate|identify|which)/i.test(body);
  if (oneStepProportionalPrompt && multiplierOptions >= 3 && noInterpretiveAsset) reasons.push('one_step_proportional_relation');
  if (directFormula && (compactOperation || planBoundCompactDirectFormula) && noInterpretiveAsset && ['light', 'medium'].includes(shape.calculationLoad)) reasons.push('direct_formula_substitution');
  if (chemistryDirectEquationSelection && compactOperation) reasons.push('direct_chemistry_equation_selection');
  if (chemistryDirectNotationSelection) reasons.push('direct_chemistry_notation_selection');
  if (chemistrySimpleAcidCarbonateEquationSelection) reasons.push('simple_acid_carbonate_equation_basic_cap');
  if (chemistryDirectCopperSaltDisplacementEquationSelection) reasons.push('direct_copper_salt_displacement_basic_cap');
  if (chemistryDirectSinglePrecipitationIonicEquationSelection) reasons.push('direct_single_precipitation_equation_basic_cap');
  if (chemistryBicarbonatePrecipitateDissolutionBoundary) reasons.push('bicarbonate_precipitation_dissolution_boundary');
  if (chemistrySingleNotationRuleStatementSelection) reasons.push('single_notation_rule_statement_basic_cap');
  if (chemistrySinglePrecipitationInterferenceScreen) reasons.push('single_precipitation_interference_screen_medium_cap');
  if (chemistrySingleStepNotationIdentityJudgement) reasons.push('single_step_notation_identity_basic_cap');
  if (shape.readingLoad === 'low' && shape.calculationLoad === 'none' && !chemistryEquilibriumSecondaryInference) reasons.push('recall_or_single_fact');
  if (chemistryEquilibriumConditionContrast) reasons.push('equilibrium_condition_contrast');
  if (chemistryEquilibriumPressureMoleReasoning) reasons.push('equilibrium_pressure_mole_reasoning');
  if (chemistryDirectCatalystNoShift) reasons.push('direct_catalyst_no_shift_basic_cap');
  if (chemistryDirectConcentrationShiftJudgement) reasons.push('direct_concentration_shift_basic_cap');
  if (chemistryEquilibriumSecondaryInference) reasons.push('equilibrium_secondary_inference_medium_cap');
  if (chemistryReactionRateVariableControlExperiment) reasons.push('reaction_rate_variable_control_basic_cap');
  if (chemistryRateTwoFactorIndeterminateComparison) reasons.push('rate_two_factor_indeterminate_comparison_medium_cap');
  if (chemistrySegmentedAverageRateData) reasons.push('reaction_rate_segmented_average_rate_data');
  if (chemistryEquilibriumQuotientCalculation) reasons.push('equilibrium_quotient_calculation');
  if (chemistryEquilibriumConstantCalculation) reasons.push(chemistryEquilibriumDirectConstantSubstitution ? 'equilibrium_constant_direct_substitution' : 'equilibrium_constant_calculation');
  if (chemistryHardEquilibriumMultiConstraintApplication) reasons.push('hard_equilibrium_multi_constraint_application');
  if (chemistryEquilibriumMarkerJudgement) reasons.push('equilibrium_marker_judgement_medium_cap');
  if (chemistryGasEquilibriumExtentMixtureInference) reasons.push('gas_equilibrium_extent_mixture_inference');
  if (chemistryGasEquilibriumDirectPressureConversion) reasons.push('gas_equilibrium_direct_pressure_conversion');
  if (chemistryAcidBaseDilutionNeutralizationCalculation) reasons.push('acid_base_dilution_neutralization_calculation');
  if (chemistryElectrolyteConductivityReasoning) reasons.push('electrolyte_conductivity_reasoning');
  if (chemistryElectrolyteDirectStrongWeakComparison) reasons.push('electrolyte_direct_strong_weak_comparison');
  if (chemistryElectrolyteTransparentWeakAcidBaseIonicEquation) reasons.push('electrolyte_transparent_weak_acid_base_ionic_equation');
  if (chemistryElectrolyteDirectSingleEquilibriumTemplate) reasons.push('electrolyte_direct_single_equilibrium_template');
  if (chemistryDirectMetalWeakAcidIonicEquationSelection) reasons.push('direct_metal_weak_acid_ionic_equation_medium_cap');
  if (chemistryElectrolyteIndependentStatementSet) reasons.push('electrolyte_independent_statement_set');
  if (chemistryElectrolyteMultiSpeciesAcidBaseRanking) reasons.push('electrolyte_multi_species_acid_base_ranking');
  if (chemistryElectrolyteMultiEquilibriumInference) reasons.push('electrolyte_multi_equilibrium_inference');
  if (chemistryElectrolyteInScopeMultiCaseIonizationInference) reasons.push('electrolyte_in_scope_multi_case_ionization_inference');
  if (chemistryMultiEquationSystemDiscrimination) reasons.push('multi_equation_system_discrimination');
  if (chemistryEquationEvidenceChainDiscrimination) reasons.push('equation_evidence_chain_discrimination');
  if (chemistryQualitativeIonObservationChain) reasons.push('qualitative_ion_observation_chain');
  if (chemistryHardIonInterferenceConclusionChain) reasons.push('hard_ion_interference_conclusion_chain');
  if (chemistryAtomicInorganicStoichiometry || chemistryTopicAtomicInorganicStoichiometry) reasons.push('atomic_inorganic_stoichiometry');
  if (chemistryDirectInorganicStoichiometry) reasons.push('direct_inorganic_stoichiometry_substitution');
  if (chemistryStandardMixtureGasStoichiometry) reasons.push('standard_mixture_gas_stoichiometry');
  if (chemistryTransparentLimitingReagentStoichiometry) reasons.push('transparent_limiting_reagent_stoichiometry');
  if (chemistryStoichiometrySeparationEvidenceChain) reasons.push('stoichiometry_separation_evidence_chain');
  if (chemistryOrganicCombustionFunctionalInference) reasons.push('organic_combustion_functional_group_inference');
  if (chemistryDirectOrganicFunctionalIdentification) reasons.push('direct_organic_functional_group_identification');
  if (chemistryOrganicQuantitativeMultiEvidenceInference) reasons.push('organic_quantitative_multi_evidence_inference');
  if (chemistryBasicRedoxSingleSpeciesJudgement) reasons.push('basic_redox_single_species_judgement');
  if (chemistryDirectRedoxSingleReactionJudgement) reasons.push('direct_redox_single_reaction_judgement');
  if (chemistryRedoxQuantitativeConstraintChain) reasons.push('redox_quantitative_constraint_chain');
  if (chemistrySingleHalogenDisplacementObservationBasicCap) reasons.push('single_halogen_displacement_observation_basic_cap');
  if (chemistryRedoxEvidenceChainDiscrimination) reasons.push('redox_evidence_chain_discrimination');
  if (chemistrySameElectronTwoIonRadiusBasicCap) reasons.push('same_electron_two_ion_radius_basic_cap');
  if (chemistryPeriodicOxideHydrateAcidBaseBasicCap) reasons.push('periodic_oxide_hydrate_acid_base_basic_cap');
  if (chemistryPeriodicMultiClueInference) reasons.push('periodic_multi_clue_property_inference');
  if (chemistryHardBondForceDataAnomalyCalculation) reasons.push('bond_force_data_anomaly_calculation');
  if (chemistryDirectClassificationOrChangeJudgement) reasons.push('direct_classification_or_change_judgement');
  if (chemistryDirectLabSafetyOrInstrumentOperation) reasons.push('direct_lab_safety_or_instrument_operation');
  if (chemistryExperimentalQuantitativeErrorPropagation) reasons.push('experimental_quantitative_error_propagation');
  if (chemistrySeparationSolubilityCrystallizationCalculation) reasons.push('separation_solubility_crystallization_calculation');
  if (chemistryHardSeparationRouteElimination) reasons.push('hard_separation_route_elimination');
  if (chemistryGasPreparationPurificationObservationChain) reasons.push('gas_preparation_purification_observation_chain');
  if (chemistryHardGasAcidMoistureInterferenceChain) reasons.push('hard_gas_acid_moisture_interference_chain');
  if (chemistryHardGasImpurityControlChain) reasons.push('hard_gas_impurity_control_chain');
  if (chemistryBasicGasSingleFactOrOperationCap) reasons.push('basic_gas_single_fact_or_operation_cap');
  if (chemistryBasicIonCompoundUnitConversionChain) reasons.push('basic_ion_compound_unit_conversion_chain');
  if (physicsDirectLinearVtGraphConceptJudgement) reasons.push('direct_linear_vt_graph_concept_basic_cap');
  if (physicsDirectLinearStGraphConceptJudgement) reasons.push('direct_linear_st_graph_concept_basic_cap');
  if (chemistryQualitativePhPaperWettingJudgement) reasons.push('ph_paper_wetting_qualitative_basic_cap');
  if (chemistryBasicVolumetricPreparationErrorJudgement) reasons.push('volumetric_preparation_error_judgement_basic_cap');
  if (mathBasicDirectFunctionPointMembership) reasons.push('direct_function_point_membership_basic_cap');
  if (mathBasicDirectQuadraticSingleProperty) reasons.push('direct_quadratic_single_property_basic_cap');
  if (mathBasicElementarySinglePropertyFromPlan) reasons.push('elementary_single_property_plan_basic_cap');
  if (mathBasicDerivativeDirectFromPlan) reasons.push('derivative_direct_polynomial_value_plan_basic_cap');
  if (mathLogarithmicDomainConceptJudgement) reasons.push('logarithmic_domain_equivalence_judgement_medium_cap');
  if (mathExpLogPowerValueOrdering) reasons.push('exp_log_power_value_ordering_medium_cap');
  if (mathFunctionPropertyCompositeJudgement) reasons.push('function_property_composite_judgement_medium_cap');
  if (mathFunctionParameterConstraintJudgement) reasons.push('function_parameter_constraint_judgement_medium_cap');
  if (mathQuestionPlanEvidence.reason) reasons.push(mathQuestionPlanEvidence.reason);
  const chemistryEquilibriumMediumReasoning = chemistryEquilibriumConditionContrast || chemistryEquilibriumPressureMoleReasoning || chemistryEquilibriumSecondaryInference || chemistryEquilibriumQuotientCalculation || chemistryEquilibriumConstantCalculation || chemistryEquilibriumMarkerJudgement;
  const chemistryMediumReasoning = chemistryEquilibriumMediumReasoning || chemistryRateTwoFactorIndeterminateComparison || chemistrySegmentedAverageRateData || chemistryGasEquilibriumDirectPressureConversion || chemistryAcidBaseDilutionNeutralizationCalculation || chemistryElectrolyteTransparentWeakAcidBaseIonicEquation || chemistryDirectMetalWeakAcidIonicEquationSelection || (chemistryElectrolyteConductivityReasoning && !chemistryElectrolyteDirectStrongWeakComparison) || chemistryMultiEquationSystemDiscrimination || chemistryBicarbonatePrecipitateDissolutionBoundary || chemistryQualitativeIonObservationChain || chemistryOrganicCombustionFunctionalInference || chemistryDirectOrganicFunctionalIdentification || (chemistryDirectRedoxSingleReactionJudgement && !chemistryBasicRedoxSingleSpeciesJudgement) || chemistryStandardStoichiometrySystem || chemistrySeparationSolubilityCrystallizationCalculation || chemistryGasPreparationPurificationObservationChain || chemistryBasicIonCompoundUnitConversionChain;
  const chemistryHardReasoning = chemistryEquationEvidenceChainDiscrimination || chemistryRedoxEvidenceChainDiscrimination || chemistryPeriodicMultiClueInference || chemistryHardBondForceDataAnomalyCalculation || chemistryElectrolyteMultiEquilibriumInference || chemistryElectrolyteMultiSpeciesAcidBaseRanking || chemistryElectrolyteInScopeMultiCaseIonizationInference || chemistryOrganicQuantitativeMultiEvidenceInference || chemistryEquilibriumUnknownExtentCalculation || chemistryGasEquilibriumExtentMixtureInference || chemistryHardEquilibriumMultiConstraintApplication || chemistryStoichiometrySeparationEvidenceChain || chemistryExperimentalQuantitativeErrorPropagation || chemistryHardIonInterferenceConclusionChain || chemistryHardGasImpurityControlChain || chemistryHardGasAcidMoistureInterferenceChain || chemistryHardSeparationRouteElimination;
  if (physicsDirectLinearVtGraphConceptJudgement || physicsDirectLinearStGraphConceptJudgement || chemistryQualitativePhPaperWettingJudgement || chemistryBasicVolumetricPreparationErrorJudgement || mathBasicDirectFunctionPointMembership || mathBasicDirectQuadraticSingleProperty || mathBasicElementarySinglePropertyFromPlan || mathBasicDerivativeDirectFromPlan) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistryDirectMetalWeakAcidIonicEquationSelection && !chemistryHardReasoning) {
    return { difficultyBand: 'medium', reasons };
  }
  if (chemistryDirectEquationSelection && !chemistryEquationEvidenceChainDiscrimination && !chemistryQualitativeIonObservationChain && !chemistryHardReasoning) {
    reasons.push('direct_equation_selection_basic_cap');
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistryDirectNotationSelection && !chemistryEquationEvidenceChainDiscrimination && !chemistryQualitativeIonObservationChain && !chemistryHardReasoning) {
    reasons.push('direct_notation_selection_basic_cap');
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistrySimpleAcidCarbonateEquationSelection || chemistryDirectCopperSaltDisplacementEquationSelection || chemistryDirectSinglePrecipitationIonicEquationSelection) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistrySingleNotationRuleStatementSelection && !chemistryEquationEvidenceChainDiscrimination && !chemistryHardReasoning) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistryDirectConfirmedSinglePrecipitationEquationSelection && !chemistryHardReasoning) {
    reasons.push('direct_confirmed_single_precipitation_basic_cap');
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistrySingleStepNotationIdentityJudgement && !chemistryEquationEvidenceChainDiscrimination && !chemistryHardReasoning) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistryInertGasConditionContrast && !chemistryEquilibriumUnknownExtentCalculation) {
    reasons.push('inert_gas_condition_contrast_medium_cap');
    return { difficultyBand: 'medium', reasons };
  }
  if (chemistryEqualGasMolePressureNoShift && !chemistryHardReasoning) {
    reasons.push('equal_gas_mole_pressure_no_shift_basic_cap');
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistryEquilibriumSecondaryInference && !chemistryHardReasoning) {
    return { difficultyBand: 'medium', reasons };
  }
  if (chemistryDirectCatalystNoShift && !chemistryHardReasoning) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistryDirectConcentrationShiftJudgement && !chemistryHardReasoning && !chemistryEquilibriumSecondaryInference) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistrySegmentedAverageRateData && !chemistryHardReasoning) {
    return { difficultyBand: 'medium', reasons };
  }
  if (chemistryRateTwoFactorIndeterminateComparison && !chemistryHardReasoning) {
    return { difficultyBand: 'medium', reasons };
  }
  if (chemistryReactionRateVariableControlExperiment && !chemistryHardReasoning && !chemistryEquilibriumSecondaryInference) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistrySingleHalogenDisplacementObservationBasicCap && !chemistryHardReasoning) {
    return { difficultyBand: 'basic', reasons };
  }
  if ((chemistrySameElectronTwoIonRadiusBasicCap || chemistryPeriodicOxideHydrateAcidBaseBasicCap) && !chemistryHardReasoning) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistryBasicGasSingleFactOrOperationCap && !chemistryHardReasoning) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistrySinglePrecipitationInterferenceScreen && !chemistryHardIonInterferenceConclusionChain) {
    return { difficultyBand: 'medium', reasons };
  }
  if (!mathQuestionPlanEvidence.hard && !mathQuestionPlanEvidence.medium && !chemistryHardReasoning && !chemistryMediumReasoning && (reasons.includes('one_step_proportional_relation') || reasons.includes('direct_formula_substitution') || reasons.includes('direct_chemistry_equation_selection') || reasons.includes('atomic_inorganic_stoichiometry') || reasons.includes('direct_inorganic_stoichiometry_substitution') || reasons.includes('recall_or_single_fact') || reasons.includes('basic_redox_single_species_judgement'))) {
    return { difficultyBand: 'basic', reasons };
  }
  if (chemistryDirectClassificationOrChangeJudgement) {
    return {
      difficultyBand: chemistryDirectClassificationConditionCount >= 3 || shape.conditionCount >= 4 ? 'medium' : 'basic',
      reasons
    };
  }
  if (chemistryDirectLabSafetyOrInstrumentOperation) {
    return { difficultyBand: 'basic', reasons };
  }
  if (mathLogarithmicDomainConceptJudgement) {
    return { difficultyBand: 'medium', reasons };
  }
  if (mathExpLogPowerValueOrdering) {
    return { difficultyBand: 'medium', reasons };
  }
  if (mathFunctionPropertyCompositeJudgement) {
    return { difficultyBand: 'medium', reasons };
  }
  if (mathFunctionParameterConstraintJudgement) {
    return { difficultyBand: 'medium', reasons };
  }
  if (mathQuestionPlanEvidence.hard) {
    return { difficultyBand: 'hard', reasons };
  }
  if (mathQuestionPlanEvidence.medium) {
    return { difficultyBand: 'medium', reasons };
  }
  if (shape.formulaCount > 5 || shape.conditionCount >= 6 || shape.hasTable || shape.hasDiagram) reasons.push('multi_condition_or_visual_reasoning');
  if (chemistryHardReasoning) {
    return { difficultyBand: 'hard', reasons };
  }
  const chemistryHeavySurfaceEvidence = shape.calculationLoad === 'heavy'
    || shape.hasTable
    || shape.hasDiagram
    || (shape.formulaCount > 5 && shape.calculationLoad !== 'none');
  if (subject === 'chemistry'
    && !chemistryEquilibriumDirectConstantSubstitution
    && !chemistryQualitativeIonObservationChain
    && !chemistryOrganicCombustionFunctionalInference
    && !chemistryDirectOrganicFunctionalIdentification
    && !chemistryDirectRedoxSingleReactionJudgement
    && !chemistryStandardStoichiometrySystem
    && chemistryHeavySurfaceEvidence) {
    return { difficultyBand: 'hard', reasons };
  }
  if (chemistryMediumReasoning) {
    return { difficultyBand: 'medium', reasons };
  }
  if (subject === 'chemistry'
    && reasons.length === 0
    && noInterpretiveAsset
    && shape.formulaCount === 0
    && shape.calculationLoad === 'none'
    && shape.conditionCount <= 3) {
    return { difficultyBand: 'basic', reasons: ['surface_scenario_single_fact'] };
  }
  if (shape.calculationLoad === 'medium' || shape.readingLoad === 'medium' || shape.readingLoad === 'high') {
    return { difficultyBand: 'medium', reasons };
  }
  return { difficultyBand: 'basic', reasons: reasons.length ? reasons : ['low_visible_complexity'] };
}

function calculationSignalCandidate(promptText: string, coordinateTupleCount: number) {
  if (coordinateTupleCount < 3) return false;
  return /空间直角坐标|三维坐标|空间坐标|点到.*(?:平面|直线)|直线.*平面|平面.*距离|线面角|夹角|投影|垂直|平行|向量|plane|line|angle|distance|projection|perpendicular|parallel/.test(promptText);
}

const CHEMISTRY_SOFT_PROFILE_ALIGNMENT_REASONS = new Set([
  'question_form_mismatch',
  'cognitive_skill_mismatch',
  'reading_load_mismatch',
  'calculation_load_mismatch',
  'calculation_load_band_mismatch'
]);

const PHYSICS_SURFACE_PROFILE_ALIGNMENT_REASONS = new Set([
  'question_form_mismatch',
  'cognitive_skill_mismatch',
  'reading_load_mismatch',
  'calculation_load_mismatch',
  'calculation_load_band_mismatch'
]);

function isSubjectPracticeContext(context: ReviewContext, subject: string) {
  return reviewSubject(context.subject) === subject
    && cleanString(context.intendedUse).toLowerCase() === 'subject_practice';
}

function physicsTopicAllowsSoftCalculationLoad(context: ReviewContext) {
  const targetProfile = recordFrom(context.targetProfile);
  const topicText = [
    context.topicTitle,
    context.examScope,
    targetProfile.topicTitle,
    targetProfile.topicCode,
    targetProfile.gapKey
  ].map((item) => cleanString(item).toLowerCase()).filter(Boolean).join(' ');
  if (['概念', '现象', '实验', '测量', '误差', '图像', '图表', '波', '光', '透镜', '折射', '反射'].some((keyword) => topicText.includes(keyword))) return true;
  return /(概念|现象|实验|测量|误差|图像|图表|波|光|透镜|折射|反射|concept|phenomenon|experiment|measurement|error|graph|chart|wave|optics|lens|refraction|reflection)/i.test(topicText);
}

function physicsTopicRequiresHardCalculationLoad(context: ReviewContext) {
  const targetProfile = recordFrom(context.targetProfile);
  const topicText = [
    context.topicTitle,
    context.examScope,
    targetProfile.topicTitle,
    targetProfile.topicCode,
    targetProfile.gapKey
  ].map((item) => cleanString(item).toLowerCase()).filter(Boolean).join(' ');
  return /(定量|计算|运动学|牛顿|力与运动|quantitative|calculation|kinematics|newton)/i.test(topicText);
}

function subjectPracticeSoftProfileAlignmentReasons(context: ReviewContext) {
  if (isSubjectPracticeContext(context, 'chemistry')) return CHEMISTRY_SOFT_PROFILE_ALIGNMENT_REASONS;
  if (isSubjectPracticeContext(context, 'physics')) {
    const softReasons = new Set(PHYSICS_SURFACE_PROFILE_ALIGNMENT_REASONS);
    if (physicsTopicRequiresHardCalculationLoad(context) && !physicsTopicAllowsSoftCalculationLoad(context)) {
      softReasons.delete('calculation_load_mismatch');
      softReasons.delete('calculation_load_band_mismatch');
    }
    return softReasons;
  }
  return null;
}

function requiredStemPatternMatchesCandidate(pattern: string, candidate: GeneratedQuestionCandidate) {
  const normalizedPattern = cleanString(pattern);
  if (!normalizedPattern) return true;
  const promptText = cleanString(candidate.prompt).toLowerCase();
  const explanationText = cleanString(candidate.explanation).toLowerCase();
  const fullText = `${promptText} ${candidate.options.map((option) => cleanString(option.text)).join(' ')} ${explanationText}`;
  if (normalizedPattern === 'equilibrium_two_stage_perturbation_quantitative_application') {
    const hasEquilibriumContext = /(平衡|可逆反应|勒夏特列|equilibrium|reversible reaction|le chatelier|⇌|↔|<=>)/i.test(fullText);
    const hasQuantitativeAnchor = /(反应商|平衡常数|\bq\b|\bk\b|q\s*[<=>]|[<=>]\s*k|转化率|产率|物质的量分数|浓度比|分压|conversion|yield|reaction quotient|equilibrium constant|partial pressure)/i.test(fullText);
    const hasTwoStageCue = /(①|②|先|再|随后|然后|另取|分别|两次|达平衡后|平衡后|重新平衡后|再次平衡后|压缩.*(?:后|并)|体积.*(?:压缩|减半).*催化剂|two-stage|first|then|subsequently|separately)/i.test(promptText);
    const hasSecondConclusionCue = /(温度|升温|降温|催化剂|速率|正、逆|正逆|物质的量分数|转化率|产率|heat|temperature|catalyst|rate|conversion|yield|amount fraction)/i.test(fullText);
    const explanationNamesIntermediate = /(反应商|平衡常数|\bq\b|\bk\b|转化率|产率|浓度|分压|conversion|yield|reaction quotient|partial pressure)/i.test(explanationText)
      && /(因此|故|所以|说明|再|同时|separate|therefore|thus|then)/i.test(explanationText);
    return hasEquilibriumContext
      && hasQuantitativeAnchor
      && hasTwoStageCue
      && hasSecondConclusionCue
      && explanationNamesIntermediate;
  }
  if (normalizedPattern === 'single_periodic_observation_to_trend_judgement') {
    const asksPureStatementList = /(下列|which).*(说法|叙述|statement).*(正确|不正确|correct|incorrect)/i.test(promptText);
    const hasPromptObservation = /(观察到|现象|实验|比较|反应|置换|颜色|酸性|碱性|半径|电子层|电子排布|活动性|金属性|非金属性|电负性|observation|experiment|displacement|radius|electron configuration|reactivity|metallic|nonmetallic|electronegativity)/i.test(promptText);
    const sameElectronIonRanking = /(等电子|相同电子|同电子|same electron)/i.test(promptText)
      && (/(三种|3种|three)/i.test(promptText)
        || ((promptText.match(/[a-z][a-z]?\s*(?:\d?[+\-]|[²³]?[+\-])/gi) ?? []).length >= 3));
    const hasOneConclusionCue = /(推出|说明|判断|结论|因此|所以|follows|conclude|indicate|therefore)/i.test(fullText);
    return hasPromptObservation
      && hasOneConclusionCue
      && !asksPureStatementList
      && !sameElectronIonRanking;
  }
  if (normalizedPattern === 'single_property_observation_to_bond_or_force_judgement') {
    const asksPureStatementList = /(下列|which).*(说法|叙述|statement).*(正确|不正确|correct|incorrect)/i.test(promptText);
    const hasPromptObservation = /(观察到|现象|表现为|常温|固体|液态|气态|熔点|沸点|导电|溶解|沉淀|颜色|conduct|conductivity|melting|boiling|sublim|liquid|solid|gas)/i.test(promptText);
    return hasPromptObservation && !asksPureStatementList;
  }
  if (normalizedPattern === 'two_property_or_structure_comparison_to_bond_force_discrimination') {
    const asksPureStatementList = /(下列|which).*(说法|叙述|statement).*(正确|不正确|correct|incorrect)/i.test(promptText);
    const propertyMatches = promptText.match(/(熔点|沸点|导电|溶解|升华|液态|气态|固态|水溶液|熔融|氢键|分子间作用力|离子键|共价键|melting|boiling|conduct|conductivity|sublim|aqueous|molten|hydrogen bond|intermolecular|ionic|covalent)/gi) ?? [];
    const hasComparisonCue = /(比较|相比|均|都|而|但|分别|两种|两者|versus|while|whereas|compared)/i.test(promptText);
    return propertyMatches.length >= 2 && hasComparisonCue && !asksPureStatementList;
  }
  if (normalizedPattern === 'two_observation_periodic_trend_comparison') {
    const asksPureStatementList = /(下列|which).*(说法|叙述|statement).*(正确|不正确|correct|incorrect)/i.test(promptText);
    const periodicMatches = promptText.match(/(周期|同主族|同周期|半径|金属性|非金属性|电负性|活动性|置换|氧化物|酸性|碱性|period|group|radius|electronegativity|reactivity|displacement|oxide|acidic|basic)/gi) ?? [];
    const hasComparisonCue = /(比较|相比|递变|增强|减弱|大于|小于|高于|低于|而|但|分别|两种|两者|trend|increase|decrease|while|whereas|compared)/i.test(promptText);
    return periodicMatches.length >= 2 && hasComparisonCue && !asksPureStatementList;
  }
  return true;
}

function profileAlignmentHasOnlySoftReasons(alignment: ReviewProfileAlignment, context: ReviewContext) {
  const softReasons = subjectPracticeSoftProfileAlignmentReasons(context);
  return Boolean(softReasons)
    && alignment.reasons.length > 0
    && alignment.reasons.every((reason) => softReasons?.has(reason));
}

function physicsProfileAlignmentHasOnlySurfaceReasons(alignment: ReviewProfileAlignment, context: ReviewContext) {
  const surfaceReasons = new Set([
    'question_form_mismatch',
    'cognitive_skill_mismatch',
    'difficulty_complexity_mismatch',
    'reading_load_mismatch',
    'calculation_load_mismatch',
    'calculation_load_band_mismatch'
  ]);
  return reviewSubject(context.subject) === 'physics'
    && !physicsTopicRequiresHardCalculationLoad(context)
    && alignment.reasons.length > 0
    && alignment.reasons.every((reason) => surfaceReasons.has(reason));
}

function profileAlignmentHasBlockingMismatch(alignment: ReviewProfileAlignment, context: ReviewContext) {
  if (alignment.status === 'failed') return true;
  if (alignment.status !== 'warning') return false;
  if (physicsProfileAlignmentHasOnlySurfaceReasons(alignment, context)) return false;
  const score = typeof alignment.score === 'number' ? alignment.score : 0;
  const reasons = new Set(alignment.reasons);
  const softReasons = subjectPracticeSoftProfileAlignmentReasons(context);
  const defaultHardReasons = [
    'question_form_mismatch',
    'cognitive_skill_mismatch',
    'difficulty_band_mismatch',
    'distractor_alignment_missing',
    'distractor_evidence_missing',
    'style_profile_low_confidence'
  ];
  const subjectPracticeHardReasons = [
    'question_form_mismatch',
    'cognitive_skill_mismatch',
    'reading_load_mismatch',
    'calculation_load_mismatch',
    'calculation_load_band_mismatch',
    'difficulty_band_mismatch',
    'required_stem_pattern_mismatch',
    'distractor_alignment_missing',
    'distractor_evidence_missing',
    'style_profile_low_confidence'
  ];
  const hardReasons = softReasons
    ? subjectPracticeHardReasons.filter((reason) => !softReasons.has(reason))
    : defaultHardReasons;
  if (hardReasons.some((reason) => reasons.has(reason))) return true;
  if (profileAlignmentHasOnlySoftReasons(alignment, context)) return false;
  return score < 90;
}

function profileTargetFromContext(context: ReviewContext) {
  const explicit = recordFrom(context.targetProfile);
  if (Object.keys(explicit).length) return explicit;
  const styleProfile = recordFrom(context.styleProfile);
  const profile = recordFrom(styleProfile.profile);
  if (!Object.keys(profile).length) return {};
  const optionPatterns = recordFrom(profile.optionPatterns);
  return {
    questionForm: weightedKeys(profile.questionFormDistribution, weightedKeys(profile.commonQuestionForms))[0],
    cognitiveSkill: weightedKeys(profile.cognitiveSkillDistribution, weightedKeys(profile.commonCognitiveSkills))[0],
    difficultyBand: weightedKeys(profile.difficultyDistribution)[0],
    readingLoad: weightedKeys(profile.readingLoadDistribution)[0],
    calculationLoad: weightedKeys(profile.calculationLoadDistribution)[0],
    distractorTypes: weightedKeys(optionPatterns.commonDistractorTypes)
  };
}

function profileAlignmentFor(candidate: GeneratedQuestionCandidate, context: ReviewContext): ReviewProfileAlignment {
  const styleProfile = recordFrom(context.styleProfile);
  const targetProfile = profileTargetFromContext(context);
  const styleProfileUsed = Boolean(Object.keys(styleProfile).length);
  if (!styleProfileUsed && !Object.keys(targetProfile).length) {
    return {
      status: 'not_checked',
      score: null,
      reasons: ['profile_absent'],
      targetProfile: null,
      evidence: { styleProfileUsed: false, actualDistractorTypes: [] }
    };
  }
  let inferred = inferQuestionShape(candidate);
  const reasons: string[] = [];
  let score = 100;
  const softProfileReasons = subjectPracticeSoftProfileAlignmentReasons(context);
  const profileReasonPenalty = (reason: string, hardPenalty: number, softPenalty: number) => (
    softProfileReasons?.has(reason) ? softPenalty : hardPenalty
  );
  const confidence = cleanString(styleProfile.confidence);
  const rawTargetSkill = cleanString(targetProfile.cognitiveSkill).toLowerCase();
  const targetForm = normalizeQuestionForm(targetProfile.questionForm);
  let targetSkill = normalizeCognitiveSkill(targetProfile.cognitiveSkill);
  const targetDifficulty = normalizeDifficultyBand(targetProfile.difficultyBand ?? targetProfile.difficulty);
  const candidateDifficulty = normalizeDifficultyBand(candidate.designedDifficulty);
  const targetReading = normalizeLoad(targetProfile.readingLoad);
  const targetCalculation = normalizeLoad(targetProfile.calculationLoad);
  const targetDistractors = optionalStringArray(targetProfile.distractorTypes);
  const targetGenerationStrategy = recordFrom(targetProfile.generationStrategy);
  const requiredStemPattern = cleanString(targetGenerationStrategy.requiredStemPattern);
  const contextualNotationDiscrimination = requiredStemPattern === 'contextual_observation_plus_notation_or_equation_discrimination';
  const basicRedoxSingleSpeciesJudgementPattern = requiredStemPattern === 'single_reaction_valence_or_agent_judgement';
  if (targetForm === 'experimental_judgement' && ['multi_step_reasoning', 'standard_application', 'application'].includes(rawTargetSkill)) {
    targetSkill = 'application';
  }
  if (targetForm === 'concept_identification' && [
    'multi_step_reasoning',
    'standard_application',
    'concept_discrimination',
    'concept_judgement',
    'concept_check',
    'judgement'
  ].includes(rawTargetSkill)) {
    targetSkill = 'concept_identification';
  }
  const conceptualJudgementPattern = [
    'concept_statement_judgement',
    'equivalence_judgement',
    'error_diagnosis',
    'solution_set_comparison'
  ].includes(requiredStemPattern);
  if (conceptualJudgementPattern && ['concept_identification', 'mixed', 'unknown', ''].includes(targetForm)) {
    inferred = {
      ...inferred,
      questionForm: 'concept_identification',
      cognitiveSkill: 'concept_identification',
      readingLoad: targetReading === 'medium' && inferred.readingLoad === 'high' ? 'medium' : inferred.readingLoad,
      calculationLoad: targetCalculation === 'none'
        ? 'none'
        : targetCalculation === 'light' && ['medium', 'heavy'].includes(inferred.calculationLoad)
          ? 'light'
        : targetCalculation === 'medium' && inferred.calculationLoad === 'heavy'
          ? 'medium'
          : inferred.calculationLoad
    };
    if (['multi_step_reasoning', 'standard_application', 'concept_discrimination', 'concept_judgement'].includes(rawTargetSkill)) {
      targetSkill = 'concept_identification';
    }
  } else if (requiredStemPattern === 'error_diagnosis') {
    inferred = {
      ...inferred,
      calculationLoad: targetCalculation === 'none'
        ? 'none'
        : targetCalculation === 'light' && ['medium', 'heavy'].includes(inferred.calculationLoad)
          ? 'light'
        : targetCalculation === 'medium' && inferred.calculationLoad === 'heavy'
          ? 'medium'
          : inferred.calculationLoad
    };
  }
  const actualDifficulty = inferActualDifficultyBand(candidate, inferred, context);
  const questionPlan = recordFrom(context.questionPlan);
  const questionPlanRenderConstraints = recordFrom(questionPlan.renderConstraints);
  const mathBasicDirectPlanProfileOverride = isSubjectPracticeContext(context, 'math')
    && targetDifficulty === 'basic'
    && actualDifficulty.difficultyBand === 'basic'
    && ((cleanString(questionPlan.planTemplate) === 'math_elementary_function_relation_v1'
      && cleanString(questionPlan.taskFamily) === 'elementary_function_direct_property'
      && Number(questionPlanRenderConstraints.maxIndependentRelations) <= 1)
      || isMathBasicDerivativeDirectFromPlan(
        reviewSubject(candidate.subject),
        cleanString(candidate.prompt).toLowerCase(),
        context,
        `${cleanString(candidate.prompt)} ${candidate.options.map((option) => cleanString(option.text)).join(' ')}`.toLowerCase()
      ));
  const mathExpLogOrderingApplicationCompatible = isSubjectPracticeContext(context, 'math')
    && actualDifficulty.reasons.includes('exp_log_power_value_ordering_medium_cap')
    && targetForm === 'formula_calculation'
    && targetSkill === 'calculation'
    && inferred.questionForm === 'concept_identification'
    && inferred.cognitiveSkill === 'concept_identification'
    && inferred.calculationLoad !== 'none';
  const mathMediumCappedSurfaceBandSoft = isSubjectPracticeContext(context, 'math')
    && targetDifficulty === 'medium'
    && actualDifficulty.difficultyBand === 'medium'
    && actualDifficulty.reasons.some(isMathMediumCappedDifficultyEvidenceReason);
  const mathHardEvidenceSurfaceBandSoft = isSubjectPracticeContext(context, 'math')
    && targetDifficulty === 'hard'
    && actualDifficulty.difficultyBand === 'hard'
    && actualDifficulty.reasons.some(isMathHardDifficultyEvidenceReason);
  if (!requiredStemPatternMatchesCandidate(requiredStemPattern, candidate)) {
    reasons.push('required_stem_pattern_mismatch');
    score -= 20;
  }
  if (confidence === 'low') {
    reasons.push('style_profile_low_confidence');
    score -= 8;
  }
  const questionFormMatches = inferred.questionForm === targetForm
    || mathExpLogOrderingApplicationCompatible
    || (mathBasicDirectPlanProfileOverride
      && ['concept_check', 'concept_identification', 'concept_judgement'].includes(targetForm)
      && ['formula_calculation', 'concept_identification'].includes(inferred.questionForm))
    || (contextualNotationDiscrimination
      && targetForm === 'concept_identification'
      && inferred.questionForm === 'experimental_judgement')
    || (basicRedoxSingleSpeciesJudgementPattern
      && targetForm === 'experimental_judgement'
      && inferred.questionForm === 'concept_identification');
  const cognitiveSkillMatches = inferred.cognitiveSkill === targetSkill
    || mathExpLogOrderingApplicationCompatible
    || (mathBasicDirectPlanProfileOverride
      && targetSkill === 'concept_identification'
      && ['calculation', 'concept_identification'].includes(inferred.cognitiveSkill))
    || (contextualNotationDiscrimination
      && ['concept_identification', 'application'].includes(targetSkill)
      && ['concept_identification', 'application'].includes(inferred.cognitiveSkill))
    || (basicRedoxSingleSpeciesJudgementPattern
      && ['standard_application', 'application'].includes(rawTargetSkill)
      && inferred.cognitiveSkill === 'concept_identification');
  if (targetForm && targetForm !== 'mixed' && targetForm !== 'unknown' && !questionFormMatches) {
    reasons.push('question_form_mismatch');
    score -= profileReasonPenalty('question_form_mismatch', 14, 2);
  }
  if (targetSkill && targetSkill !== 'mixed' && targetSkill !== 'unknown' && !cognitiveSkillMatches) {
    reasons.push('cognitive_skill_mismatch');
    score -= profileReasonPenalty('cognitive_skill_mismatch', 12, 2);
  }
  if (targetDifficulty && targetDifficulty !== 'mixed' && targetDifficulty !== 'unknown' && candidateDifficulty && candidateDifficulty !== targetDifficulty) {
    reasons.push('difficulty_band_mismatch');
    score -= 18;
  }
  if (targetDifficulty && targetDifficulty !== 'mixed' && targetDifficulty !== 'unknown' && actualDifficulty.difficultyBand !== targetDifficulty) {
    const targetRank = targetDifficulty === 'hard' ? 3 : targetDifficulty === 'medium' ? 2 : targetDifficulty === 'basic' ? 1 : 0;
    const actualRank = actualDifficulty.difficultyBand === 'hard' ? 3 : actualDifficulty.difficultyBand === 'medium' ? 2 : 1;
    const rankGap = Math.abs(targetRank - actualRank);
    if (rankGap >= 2
      || (targetDifficulty === 'hard' && actualDifficulty.difficultyBand !== 'hard')
      || (targetDifficulty === 'basic' && actualDifficulty.difficultyBand !== 'basic')
      || (targetDifficulty !== 'basic' && actualDifficulty.difficultyBand === 'basic')) {
      reasons.push('difficulty_complexity_mismatch');
      score -= targetDifficulty === 'hard' && actualDifficulty.difficultyBand === 'basic'
        ? 50
        : targetDifficulty === 'hard' && actualDifficulty.difficultyBand === 'medium'
          ? 18
          : 24;
    }
  }
  const mathMediumCappedReadingBandSoft = mathMediumCappedSurfaceBandSoft
    && loadBandDistance(targetReading, inferred.readingLoad) <= 1;
  const mathHardEvidenceReadingBandSoft = mathHardEvidenceSurfaceBandSoft
    && loadBandDistance(targetReading, inferred.readingLoad) <= 1;
  if (targetReading && targetReading !== 'unknown' && inferred.readingLoad !== targetReading && !mathBasicDirectPlanProfileOverride && !mathMediumCappedReadingBandSoft && !mathHardEvidenceReadingBandSoft) {
    reasons.push('reading_load_mismatch');
    score -= profileReasonPenalty('reading_load_mismatch', 10, 1);
  }
  const mathBasicDirectIdentityCalculationSoft = isSubjectPracticeContext(context, 'math')
    && targetDifficulty === 'basic'
    && actualDifficulty.difficultyBand === 'basic'
    && inferred.calculationLoad === 'light'
    && isMathBasicElementaryDirectIdentity(reviewSubject(candidate.subject), cleanString(candidate.prompt).toLowerCase(), `${cleanString(candidate.prompt)} ${candidate.options.map((option) => cleanString(option.text)).join(' ')} ${cleanString(candidate.explanation)}`.toLowerCase());
  const mathMediumCappedCalculationBandSoft = mathMediumCappedSurfaceBandSoft
    && (loadBandDistance(targetCalculation, inferred.calculationLoad) <= 1
      || (targetCalculation !== 'none' && inferred.calculationLoad !== 'none'));
  if (targetCalculation && targetCalculation !== 'unknown' && inferred.calculationLoad !== targetCalculation && !mathBasicDirectPlanProfileOverride && !mathBasicDirectIdentityCalculationSoft && !mathMediumCappedCalculationBandSoft) {
    const expectedCalculation = new Set(['light', 'medium', 'heavy']).has(targetCalculation);
    const actualCalculation = inferred.calculationLoad !== 'none';
    const reason = expectedCalculation !== actualCalculation ? 'calculation_load_mismatch' : 'calculation_load_band_mismatch';
    reasons.push(reason);
    score -= profileReasonPenalty(reason, expectedCalculation !== actualCalculation ? 16 : 8, 1);
  }
  if (targetDistractors.length && inferred.distractorTypes.length) {
    const actual = new Set(inferred.distractorTypes.map((item) => item.toLowerCase()));
    const overlap = targetDistractors.some((item) => actual.has(item.toLowerCase()));
    if (!overlap) {
      reasons.push('distractor_alignment_missing');
      score -= 10;
    }
  } else if (targetDistractors.length) {
    reasons.push('distractor_evidence_missing');
    score -= 8;
  }
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    status: finalScore < 55 ? 'failed' : reasons.length ? 'warning' : 'passed',
    score: finalScore,
    reasons,
    targetProfile,
    evidence: {
      styleProfileUsed,
      styleProfileConfidence: confidence || null,
      inferredQuestionForm: inferred.questionForm,
      inferredCognitiveSkill: inferred.cognitiveSkill,
      inferredDifficultyBand: actualDifficulty.difficultyBand,
      difficultyEvidencePolicyVersion: SUBJECT_PRACTICE_DIFFICULTY_EVIDENCE_POLICY_VERSION,
      difficultyEvidencePatchVersion: actualDifficulty.reasons.includes('logarithmic_domain_equivalence_judgement_medium_cap')
        ? MATH_LOGARITHMIC_DOMAIN_DIFFICULTY_EVIDENCE_PATCH_VERSION
        : actualDifficulty.reasons.includes('exp_log_power_value_ordering_medium_cap')
          ? MATH_EXP_LOG_ORDERING_DIFFICULTY_EVIDENCE_PATCH_VERSION
            : actualDifficulty.reasons.includes('function_property_composite_judgement_medium_cap')
            ? MATH_FUNCTION_PROPERTY_JUDGEMENT_DIFFICULTY_EVIDENCE_PATCH_VERSION
            : actualDifficulty.reasons.includes('function_parameter_constraint_judgement_medium_cap')
              ? MATH_FUNCTION_PARAMETER_CONSTRAINT_DIFFICULTY_EVIDENCE_PATCH_VERSION
              : actualDifficulty.reasons.some((reason) => /^math_/.test(reason))
                ? MATH_MULTI_TOPIC_QUESTION_PLAN_DIFFICULTY_EVIDENCE_PATCH_VERSION
                : null,
      designedDifficultyBand: candidateDifficulty,
      actualDifficultyReasons: actualDifficulty.reasons,
      inferredReadingLoad: inferred.readingLoad,
      inferredCalculationLoad: inferred.calculationLoad,
      actualDistractorTypes: inferred.distractorTypes
    }
  };
}

export function subjectPracticeDeterministicProfileReviewForCandidate(
  candidate: GeneratedQuestionCandidate,
  context: ReviewContext
) {
  const profileAlignment = profileAlignmentFor(candidate, context);
  const issue: ValidationIssue | null = profileAlignment.status === 'failed'
    && !profileAlignmentHasOnlySoftReasons(profileAlignment, context)
    && !physicsProfileAlignmentHasOnlySurfaceReasons(profileAlignment, context)
    ? { code: 'profile_alignment_failed', severity: 'error', message: 'Candidate does not match the target past-paper profile closely enough.' }
    : profileAlignmentHasBlockingMismatch(profileAlignment, context)
      ? { code: 'profile_alignment_warning', severity: 'warning', message: 'Candidate needs quality-attention handling against the target past-paper profile.' }
      : null;
  return { profileAlignment, issue };
}

function fallbackRubric(issues: ValidationIssue[], dimensions: ReviewDimension[], profileAlignment?: ReviewProfileAlignment): NonNullable<ReviewResult['rubric']> {
  const errorPenalty = issues.some((issue) => issue.severity === 'error') ? 20 : 0;
  const warningPenalty = Math.min(10, issues.filter((issue) => issue.severity === 'warning').length * 2);
  const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value - errorPenalty - warningPenalty)));
  return {
    syllabusAlignment: clamp(scoreFromDimension(dimensions, 'syllabus_alignment')),
    answerCorrectness: clamp(scoreFromDimension(dimensions, 'single_correct_answer')),
    optionQuality: clamp(Math.min(scoreFromDimension(dimensions, 'option_mutual_exclusion'), scoreFromDimension(dimensions, 'distractor_quality'))),
    explanationQuality: clamp(scoreFromDimension(dimensions, 'explanation_supports_answer')),
    difficultyMatch: clamp(scoreFromDimension(dimensions, 'difficulty_match')),
    languageQuality: clamp(issues.some((issue) => issue.code.includes('prompt_leakage')) ? 55 : 86),
    styleAlignment: clamp(profileAlignment?.score ?? (issues.some((issue) => issue.code.includes('style')) ? 72 : 84)),
    examLikeDifficulty: clamp(scoreFromDimension(dimensions, 'difficulty_match')),
    pastPaperSimilarityRisk: issues.some((issue) => issue.code.includes('duplicate') || issue.code.includes('similarity')) ? 65 : 12
  };
}

function averageRubricScore(rubric: NonNullable<ReviewResult['rubric']>) {
  const values = [
    rubric.syllabusAlignment,
    rubric.answerCorrectness,
    rubric.optionQuality,
    rubric.explanationQuality,
    rubric.difficultyMatch,
    rubric.languageQuality,
    rubric.styleAlignment,
    rubric.examLikeDifficulty
  ].filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  return values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : 0;
}

function decisionFrom(status: ReviewResult['status'], score: number, issues: ValidationIssue[]): ReviewResult['decision'] {
  if (status === 'failed' || issues.some((issue) => issue.severity === 'error')) return 'regenerate';
  if (score < 70) return 'regenerate';
  if (score < 80 || status === 'needs_review') return 'quality_attention';
  return 'approve';
}

@Injectable()
export class QuestionReviewerService {
  constructor(
    private readonly validator: QuestionValidatorService,
    private readonly provider: QuestionReviewerProviderService
  ) {}

  async review(candidate: GeneratedQuestionCandidate, context: ReviewContext = {}): Promise<ReviewResult> {
    const deterministic = this.validator.review(candidate, context);
    const plannedTaskFamily = cleanString(recordFrom(context.questionPlan).taskFamily);
    const classifiedTaskFamily = plannedTaskFamily || subjectPracticeClassifyTaskFamily({
      subject: candidate.subject,
      topicTitle: context.topicTitle,
      prompt: candidate.prompt,
      options: candidate.options,
      explanation: ''
    });
    const formalVerificationBundle = verifySubjectPracticeFormalCandidate({
      candidate,
      taskFamily: classifiedTaskFamily,
      questionPlan: context.questionPlan
    });
    const deterministicAnswerVerification = formalVerificationBundle?.solverEvidence;
    const deterministicOnly = context.reviewProviderMode === 'deterministic_only';
    const blindAnswerReview = deterministicOnly ? undefined : await this.provider.reviewBlindAnswer(candidate, context);
    const llm = deterministicOnly
      ? {
        issues: [] as ValidationIssue[],
        dimensions: [] as ReviewDimension[],
        provider: { provider: 'deterministic', model: 'policy-migration', status: 'skipped' },
        rubric: undefined,
        score: undefined,
        decision: undefined
      }
      : await this.provider.review(candidate, context);
    const deterministicProfileReview = subjectPracticeDeterministicProfileReviewForCandidate(candidate, context);
    const profileAlignment = deterministicProfileReview.profileAlignment;
    const profileIssues: ValidationIssue[] = deterministicProfileReview.issue ? [deterministicProfileReview.issue] : [];
    const issues = mergeIssues(
      mergeIssues(
        mergeIssues(mergeIssues(deterministic.issues, llm.issues), bilingualLocalizationIssues(candidate)),
        chemistryIonCoexistenceAnswerIssues(candidate, context)
      ),
      profileIssues
    );
    const dimensions = mergeDimensions(deterministic.dimensions, llm.dimensions);
    const rubric = llm.rubric ?? fallbackRubric(issues, dimensions, profileAlignment);
    const score = llm.score ?? averageRubricScore(rubric);
    const status = deterministicOnly
      ? statusFrom(issues, dimensions)
      : guardedStatus(statusFrom(issues, dimensions), llm.provider.status);
    return {
      status,
      issues,
      dimensions,
      sources: llm.provider.status === 'success' ? ['deterministic', 'llm'] : ['deterministic'],
      agent: deterministicOnly
        ? { role: 'reviewer', name: 'question-reviewer-deterministic-policy', provider: 'deterministic', model: 'policy-migration', promptVersion: 'deterministic-policy-migration' }
        : this.provider.agentIdentity(llm.provider),
      decision: llm.decision ?? decisionFrom(status, score, issues),
      score,
      rubric,
      profileAlignment,
      provider: llm.provider,
      ...(blindAnswerReview ? { blindAnswerReview } : {}),
      ...(deterministicAnswerVerification ? { deterministicAnswerVerification } : {}),
      ...(formalVerificationBundle ? { formalVerificationBundle } : {}),
      checkedAt: new Date().toISOString()
    };
  }
}
