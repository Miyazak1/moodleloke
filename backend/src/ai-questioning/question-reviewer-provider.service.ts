import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { AiGatewayMessage } from '../ai-gateway/ai-gateway.types';
import { BlindAnswerReviewEvidence, GeneratedQuestionCandidate, ReviewContext, ReviewDimension, ReviewResult, ValidationIssue } from './ai-questioning.types';

type ProviderReview = {
  issues: ValidationIssue[];
  dimensions: ReviewDimension[];
  decision?: ReviewResult['decision'];
  score?: number;
  rubric?: ReviewResult['rubric'];
  provider: {
    provider: string;
    model: string;
    status: string;
  };
};

const REVIEWER_AGENT_NAME = process.env.CSCA_AI_QUESTION_REVIEWER_AGENT || 'question-reviewer-v1';
const REVIEWER_PROMPT_VERSION = process.env.CSCA_AI_QUESTION_REVIEWER_PROMPT_VERSION || 'reviewer-rubric-v2-bilingual-gate';
export const BLIND_ANSWER_REVIEW_POLICY_VERSION = 'subject-practice-blind-answer-review-v1';
const BLIND_ANSWER_REVIEW_PROMPT_VERSION = process.env.CSCA_AI_QUESTION_BLIND_REVIEW_PROMPT_VERSION || 'blind-answer-review-v1';
const SUPPORTED_PROVIDERS = new Set(['deepseek', 'openai', 'openai-compatible']);
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_TEMPERATURE = 0.1;
const RULE_MODEL = 'local-reviewer-disabled';

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function providerName() {
  return process.env.AI_DEFAULT_PROVIDER || process.env.CSCA_AI_QUESTION_REVIEW_PROVIDER || process.env.CSCA_AI_PROVIDER || 'rule-fallback';
}

function modelName() {
  return process.env.CSCA_AI_QUESTION_REVIEW_MODEL || process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL || process.env.DEEPSEEK_DEFAULT_MODEL || process.env.CSCA_AI_MODEL || 'deepseek-v4-flash';
}

function blindReviewModelName() {
  return process.env.CSCA_AI_QUESTION_BLIND_REVIEW_MODEL || modelName();
}

function proModelName() {
  return process.env.CSCA_AI_QUESTION_REVIEW_PRO_MODEL
    || process.env.CSCA_SUBJECT_PRACTICE_PRO_REVIEW_MODEL
    || process.env.CSCA_AI_QUESTION_GENERATION_PRO_MODEL
    || process.env.CSCA_SUBJECT_PRACTICE_PRO_MODEL
    || process.env.DEEPSEEK_PRO_MODEL
    || 'deepseek-v4-pro';
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function recordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function reviewTierFromContext(context: ReviewContext = {}) {
  const targetProfile = recordFrom(context.targetProfile);
  return cleanText(
    targetProfile?.subjectPracticeGenerationTier
    || targetProfile?.generationTier
    || targetProfile?.modelTier
    || targetProfile?.preferredModelTier
  );
}

function modelNameForContext(context: ReviewContext = {}) {
  if (process.env.CSCA_AI_QUESTION_REVIEW_MODEL) return process.env.CSCA_AI_QUESTION_REVIEW_MODEL;
  return reviewTierFromContext(context).toLowerCase() === 'pro' ? proModelName() : modelName();
}

function timeoutMs() {
  const value = Number(process.env.CSCA_AI_QUESTION_REVIEW_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function temperature() {
  const value = Number(process.env.CSCA_AI_QUESTION_REVIEW_TEMPERATURE ?? DEFAULT_TEMPERATURE);
  return Number.isFinite(value) && value >= 0 && value <= 2 ? value : DEFAULT_TEMPERATURE;
}

function externalReady(hasConfiguredKey = true) {
  const provider = providerName();
  return enabled(process.env.CSCA_AI_QUESTION_REVIEW_ENABLED)
    && provider !== 'rule-fallback'
    && SUPPORTED_PROVIDERS.has(provider)
    && hasConfiguredKey;
}

function blindReviewEnabled() {
  return enabled(process.env.CSCA_AI_QUESTION_BLIND_REVIEW_ENABLED);
}

function cleanStatus(value: unknown): ReviewDimension['status'] {
  const text = String(value ?? '').trim();
  if (text === 'passed' || text === 'warning' || text === 'failed' || text === 'not_checked') return text;
  return 'not_checked';
}

function cleanIssue(value: unknown): ValidationIssue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const severity = record.severity === 'error' ? 'error' : record.severity === 'warning' ? 'warning' : null;
  const code = String(record.code ?? '').trim();
  const message = String(record.message ?? '').trim();
  return severity && code && message ? { code, severity, message } : null;
}

function cleanDimension(value: unknown): ReviewDimension | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const key = String(record.key ?? '').trim() as ReviewDimension['key'];
  const allowed = new Set<ReviewDimension['key']>([
    'syllabus_alignment',
    'single_correct_answer',
    'option_mutual_exclusion',
    'explanation_supports_answer',
    'difficulty_match',
    'prompt_leakage',
    'duplicate_risk',
    'distractor_quality',
    'domain_sanity'
  ]);
  if (!allowed.has(key)) return null;
  const note = String(record.note ?? '').trim();
  return { key, status: cleanStatus(record.status), note: note || 'No reviewer note.' };
}

function cleanScore(value: unknown) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : undefined;
}

function cleanDecision(value: unknown): ReviewResult['decision'] | undefined {
  const text = String(value ?? '').trim();
  if (text === 'approve' || text === 'revise' || text === 'regenerate' || text === 'human_review' || text === 'quality_attention') return text;
  return undefined;
}

function cleanRubric(value: unknown): ReviewResult['rubric'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return {
    syllabusAlignment: cleanScore(record.syllabusAlignment) ?? 0,
    answerCorrectness: cleanScore(record.answerCorrectness) ?? 0,
    optionQuality: cleanScore(record.optionQuality) ?? 0,
    explanationQuality: cleanScore(record.explanationQuality) ?? 0,
    difficultyMatch: cleanScore(record.difficultyMatch) ?? 0,
    languageQuality: cleanScore(record.languageQuality) ?? 0,
    styleAlignment: cleanScore(record.styleAlignment),
    examLikeDifficulty: cleanScore(record.examLikeDifficulty),
    pastPaperSimilarityRisk: cleanScore(record.pastPaperSimilarityRisk)
  };
}

function averageProviderRubricScore(rubric: NonNullable<ReviewResult['rubric']>) {
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
  return values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : undefined;
}

export function parseProviderReview(output: string): Pick<ProviderReview, 'issues' | 'dimensions' | 'decision' | 'score' | 'rubric'> | null {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const issues = Array.isArray(parsed.issues) ? parsed.issues.map(cleanIssue).filter(Boolean) as ValidationIssue[] : [];
    const dimensions = Array.isArray(parsed.dimensions) ? parsed.dimensions.map(cleanDimension).filter(Boolean) as ReviewDimension[] : [];
    const rubric = cleanRubric(parsed.rubric);
    const rawScore = cleanScore(parsed.score);
    const rubricScore = rubric ? averageProviderRubricScore(rubric) : undefined;
    const hasBlockingReview = issues.some((issue) => issue.severity === 'error')
      || dimensions.some((dimension) => dimension.status === 'failed');
    const score = rawScore !== undefined && !(rawScore < 50 && rubricScore !== undefined && rubricScore >= 70 && !hasBlockingReview)
      ? rawScore
      : rubricScore;
    const decision = cleanDecision(parsed.decision);
    return dimensions.length ? { issues, dimensions, decision, score, rubric } : null;
  } catch {
    return null;
  }
}

type ParsedBlindAnswerReview = Pick<BlindAnswerReviewEvidence, 'selectedOptionId' | 'trueOptionIds' | 'optionVerdicts' | 'solution' | 'confidence' | 'abstainReason' | 'uniqueAnswer'>;

export function parseBlindAnswerReview(output: string, optionIds: string[]): ParsedBlindAnswerReview | null {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const allowedOptionIds = new Set(optionIds.map((id) => cleanText(id)));
    const rawVerdicts = Array.isArray(parsed.optionVerdicts) ? parsed.optionVerdicts : [];
    const optionVerdicts = rawVerdicts.map((value) => {
      const record = recordFrom(value);
      const optionId = cleanText(record?.optionId);
      const verdict = cleanText(record?.verdict);
      const reason = cleanText(record?.reason);
      if (!allowedOptionIds.has(optionId) || !['true', 'false', 'unknown'].includes(verdict) || !reason) return null;
      return { optionId, verdict: verdict as 'true' | 'false' | 'unknown', reason };
    }).filter((value): value is BlindAnswerReviewEvidence['optionVerdicts'][number] => Boolean(value));
    const verdictIds = optionVerdicts.map((item) => item.optionId);
    if (optionVerdicts.length !== optionIds.length || new Set(verdictIds).size !== optionIds.length) return null;
    if (optionIds.some((id) => !verdictIds.includes(id))) return null;
    const trueOptionIds = optionVerdicts.filter((item) => item.verdict === 'true').map((item) => item.optionId);
    const selectedOptionId = cleanText(parsed.selectedOptionId) || null;
    if (selectedOptionId && !allowedOptionIds.has(selectedOptionId)) return null;
    const solution = cleanText(parsed.solution) || null;
    const confidenceValue = Number(parsed.confidence);
    const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : null;
    const abstainReason = cleanText(parsed.abstainReason) || null;
    const uniqueAnswer = trueOptionIds.length === 1 && selectedOptionId === trueOptionIds[0];
    return { selectedOptionId, trueOptionIds, optionVerdicts, solution, confidence, abstainReason, uniqueAnswer };
  } catch {
    return null;
  }
}

export function blindAnswerReviewMessages(candidate: GeneratedQuestionCandidate, context: ReviewContext = {}): AiGatewayMessage[] {
  const blindCandidate = {
    subject: candidate.subject,
    topicId: candidate.topicId,
    designedDifficulty: candidate.designedDifficulty,
    questionType: candidate.questionType,
    prompt: candidate.prompt,
    options: candidate.options.map((option) => ({ id: option.id, text: option.text })),
    knowledgeTags: candidate.knowledgeTags,
    syllabusVersion: candidate.syllabusVersion
  };
  const scope = {
    subject: context.subject,
    topicTitle: context.topicTitle,
    examScope: context.examScope ?? null,
    excludedScope: context.excludedScope ?? null
  };
  return [
    {
      role: 'system' as const,
      content: [
        'Solve this CSCA multiple-choice question independently.',
        'The generator answer and explanation are intentionally unavailable.',
        'Evaluate every option and do not infer an intended answer from option position.',
        'If the question is ambiguous, underdetermined, has zero true options, or has multiple true options, do not force an answer.',
        'Return JSON only with selectedOptionId, optionVerdicts, solution, confidence, and abstainReason.',
        'optionVerdicts must contain every supplied option exactly once with verdict true, false, or unknown and a concise reason.',
        'confidence is a number from 0 to 1.',
        'Schema: {"selectedOptionId":"A|null","optionVerdicts":[{"optionId":"A","verdict":"true|false|unknown","reason":"string"}],"solution":"string","confidence":0,"abstainReason":"string|null"}.'
      ].join(' ')
    },
    {
      role: 'user' as const,
      content: JSON.stringify({ candidate: blindCandidate, syllabusScope: scope })
    }
  ];
}

function blindEvidenceBase(context: ReviewContext): Pick<BlindAnswerReviewEvidence, 'policyVersion' | 'inputBoundary' | 'generator'> {
  const generator = context.generatorAgent;
  return {
    policyVersion: BLIND_ANSWER_REVIEW_POLICY_VERSION,
    inputBoundary: 'prompt_options_only_answer_and_explanation_redacted',
    generator: generator ? {
      provider: cleanText(generator.provider) || null,
      model: cleanText(generator.model) || null,
      promptVersion: cleanText(generator.promptVersion) || null
    } : null
  };
}

function emptyBlindEvidence(context: ReviewContext, status: BlindAnswerReviewEvidence['status']): BlindAnswerReviewEvidence {
  return {
    ...blindEvidenceBase(context),
    status,
    selectedOptionId: null,
    trueOptionIds: [],
    optionVerdicts: [],
    solution: null,
    confidence: null,
    abstainReason: status,
    uniqueAnswer: false,
    agreesWithGenerator: null,
    independentProviderAndModel: null,
    reviewer: null,
    providerImpact: 'none_no_provider_call'
  };
}

function reviewMessages(candidate: GeneratedQuestionCandidate, context: ReviewContext = {}): AiGatewayMessage[] {
  const syllabusScope = {
    subject: context.subject,
    topicId: context.topicId,
    topicTitle: context.topicTitle,
    syllabusVersion: context.syllabusVersion,
    examScope: context.examScope ?? null,
    allowedQuestionTypes: context.allowedQuestionTypes ?? null,
    difficultyRange: context.difficultyRange ?? null,
    excludedScope: context.excludedScope ?? null,
    sourceLabel: context.sourceLabel ?? null,
    sourceUrl: context.sourceUrl ?? null
  };
  const styleProfile = context.styleProfile ?? null;
  const targetProfile = context.targetProfile ?? null;
  return [
    {
      role: 'system' as const,
      content: [
        'You are a strict CSCA question reviewer.',
        'You are independent from the question generator. Do not assume the provided answer is correct.',
        'Return JSON only. No markdown.',
        'Check syllabus alignment, unique correct answer, option mutual exclusion, explanation support, difficulty match, prompt leakage, duplicate risk, distractor quality, and domain sanity for math/physics/chemistry.',
        'Treat syllabusScope as the authoritative content boundary.',
        'Fail syllabus_alignment when the candidate tests content outside examScope or inside excludedScope.',
        'Fail or warn difficulty_match when designedDifficulty is outside difficultyRange.',
        'Fail syllabus_alignment when questionType is outside allowedQuestionTypes.',
        'The explanation must support the answer using the same syllabusScope, not a broader topic.',
        'Both subject-practice and online mock exam AI candidates require complete localizations.zh and localizations.en with prompt/options/explanation before approval.',
        'If either localization is missing, incomplete, has missing A-D options, or does not preserve the same option IDs and correctAnswer, add issue code missing_bilingual_localization or localization_mismatch and use decision revise.',
        'Warn languageQuality when localization content is missing, mixed-language, incomplete, or semantically different from the main Chinese question.',
        'If styleProfile is provided, use it only as an abstract past-paper style profile. Check whether the candidate matches its common forms, cognitive skills, difficulty signals, stem patterns, option patterns, and distractor types.',
        'If targetProfile is provided, specifically check questionForm, cognitiveSkill, readingLoad, calculationLoad, estimatedTimeSeconds, distractorTypes, and commonMisconceptions against the candidate.',
        'If styleProfile is absent or low confidence, do not fail solely because of missing style evidence; use decision quality_attention for needs-quality-attention uncertainty. Legacy human_review is accepted only for backward compatibility. This is not a production human-review workflow.',
        'Score with rubric fields from 0 to 100: syllabusAlignment, answerCorrectness, optionQuality, explanationQuality, difficultyMatch, languageQuality, styleAlignment, examLikeDifficulty, pastPaperSimilarityRisk. pastPaperSimilarityRisk means higher score is more risky/similar.',
        'decision must be approve, revise, regenerate, or quality_attention. Do not use human_review for new output; it is a legacy needs_quality_attention alias, not a required manual review step.',
        'Schema: {"decision":"approve|revise|regenerate|quality_attention","score":0,"rubric":{"syllabusAlignment":0,"answerCorrectness":0,"optionQuality":0,"explanationQuality":0,"difficultyMatch":0,"languageQuality":0,"styleAlignment":0,"examLikeDifficulty":0,"pastPaperSimilarityRisk":0},"issues":[{"code":"string","severity":"error|warning","message":"string"}],"dimensions":[{"key":"syllabus_alignment|single_correct_answer|option_mutual_exclusion|explanation_supports_answer|difficulty_match|prompt_leakage|duplicate_risk|distractor_quality|domain_sanity","status":"passed|warning|failed|not_checked","note":"string"}]}.',
        'Use error only when the candidate must not be approved.'
      ].join(' ')
    },
    {
      role: 'user' as const,
      content: JSON.stringify({ candidate, syllabusScope, styleProfile, targetProfile, duplicateRisk: { duplicatePromptCount: context.duplicatePromptCount ?? 0 } })
    }
  ];
}

@Injectable()
export class QuestionReviewerProviderService {
  private readonly gateway: AiGatewayService;

  constructor(gateway: AiGatewayService) {
    this.gateway = gateway;
  }

  agentIdentity(provider?: { provider: string; model: string }) {
    return {
      role: 'reviewer' as const,
      name: REVIEWER_AGENT_NAME,
      provider: provider?.provider ?? providerName(),
      model: provider?.model ?? (externalReady(this.gateway.hasConfiguredKey('question_review', modelName())) ? modelName() : RULE_MODEL),
      promptVersion: REVIEWER_PROMPT_VERSION
    };
  }

  configStatus() {
    const provider = providerName();
    const ready = externalReady(this.gateway.hasConfiguredKey('question_review', modelName()));
    const blindModel = blindReviewModelName();
    const blindReady = blindReviewEnabled() && externalReady(this.gateway.hasConfiguredKey('question_review', blindModel));
    return {
      enabled: enabled(process.env.CSCA_AI_QUESTION_REVIEW_ENABLED),
      externalReady: ready,
      provider,
      model: ready ? modelName() : RULE_MODEL,
      supported: provider === 'rule-fallback' || SUPPORTED_PROVIDERS.has(provider),
      apiKeyConfigured: this.gateway.hasConfiguredKey('question_review', modelName()),
      blindAnswerReview: {
        enabled: blindReviewEnabled(),
        externalReady: blindReady,
        model: blindReady ? blindModel : RULE_MODEL,
        promptVersion: BLIND_ANSWER_REVIEW_PROMPT_VERSION,
        productionGateImpact: 'none_shadow_only'
      }
    };
  }

  async reviewBlindAnswer(candidate: GeneratedQuestionCandidate, context: ReviewContext = {}): Promise<BlindAnswerReviewEvidence> {
    if (!blindReviewEnabled()) return emptyBlindEvidence(context, 'disabled');
    const generatorProvider = cleanText(context.generatorAgent?.provider);
    const generatorModel = cleanText(context.generatorAgent?.model);
    if (!generatorProvider || !generatorModel) return emptyBlindEvidence(context, 'generator_identity_missing');
    const selectedModel = blindReviewModelName();
    if (!externalReady(this.gateway.hasConfiguredKey('question_review', selectedModel))) {
      return emptyBlindEvidence(context, 'disabled');
    }
    const response = await this.gateway.complete({
      taskType: 'question_review',
      sourceModule: 'question_blind_answer_reviewer',
      messages: blindAnswerReviewMessages(candidate, context),
      modelHint: selectedModel,
      responseFormat: 'json',
      temperature: temperature(),
      timeoutMs: timeoutMs(),
      metadata: {
        subject: context.subject,
        topicId: context.topicId,
        questionType: candidate.questionType,
        blindAnswerReview: true,
        inputBoundary: 'prompt_options_only_answer_and_explanation_redacted'
      }
    });
    if (response.status !== 'success') {
      return {
        ...emptyBlindEvidence(context, 'provider_failed'),
        abstainReason: response.errorCode ?? response.status,
        reviewer: {
          provider: response.providerId,
          model: response.model,
          promptVersion: BLIND_ANSWER_REVIEW_PROMPT_VERSION
        },
        providerImpact: 'one_shadow_blind_review_call'
      };
    }
    const parsed = parseBlindAnswerReview(response.content.trim(), candidate.options.map((option) => option.id));
    if (!parsed) {
      return {
        ...emptyBlindEvidence(context, 'schema_invalid'),
        reviewer: {
          provider: response.providerId,
          model: response.model,
          promptVersion: BLIND_ANSWER_REVIEW_PROMPT_VERSION
        },
        providerImpact: 'one_shadow_blind_review_call'
      };
    }
    const independentProviderAndModel = response.providerId.toLowerCase() !== generatorProvider.toLowerCase()
      && response.model.toLowerCase() !== generatorModel.toLowerCase();
    return {
      ...blindEvidenceBase(context),
      status: 'completed',
      ...parsed,
      agreesWithGenerator: parsed.uniqueAnswer && parsed.selectedOptionId === candidate.correctAnswer,
      independentProviderAndModel,
      reviewer: {
        provider: response.providerId,
        model: response.model,
        promptVersion: BLIND_ANSWER_REVIEW_PROMPT_VERSION
      },
      providerImpact: 'one_shadow_blind_review_call'
    };
  }

  async review(candidate: GeneratedQuestionCandidate, context: ReviewContext = {}): Promise<ProviderReview> {
    const selectedModel = modelNameForContext(context);
    if (!externalReady(this.gateway.hasConfiguredKey('question_review', selectedModel))) {
      return {
        issues: [],
        dimensions: [],
        provider: { provider: 'rule-fallback', model: RULE_MODEL, status: 'reviewer_disabled' }
      };
    }

    const response = await this.gateway.complete({
      taskType: 'question_review',
      sourceModule: 'question_reviewer',
      messages: reviewMessages(candidate, context),
      modelHint: selectedModel || undefined,
      responseFormat: 'json',
      temperature: temperature(),
      timeoutMs: timeoutMs(),
      metadata: {
        subject: context.subject,
        topicId: context.topicId,
        questionType: candidate.questionType
      }
    });
    if (response.status !== 'success') {
      const status = response.errorCode ?? response.status;
      return {
        issues: [{ code: `llm_reviewer_${status}`, severity: 'warning', message: 'LLM reviewer failed; deterministic review still applies.' }],
        dimensions: [],
        provider: { provider: response.providerId, model: response.model, status }
      };
    }
    const parsed = parseProviderReview(response.content.trim());
    if (!parsed) {
      return {
        issues: [{ code: 'llm_reviewer_schema_invalid', severity: 'warning', message: 'LLM reviewer returned invalid review JSON.' }],
        dimensions: [],
        provider: { provider: response.providerId, model: response.model, status: 'provider_schema_invalid' }
      };
    }
    return {
      ...parsed,
      provider: { provider: response.providerId, model: response.model, status: 'success' }
    };
  }
}
