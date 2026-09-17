export type QuestionOption = {
  id: string;
  text: string;
};

export type GeneratedQuestionCandidate = {
  subject: string;
  topicId: number;
  blueprintId: number;
  sourceType: 'ai';
  designedDifficulty: string;
  questionType: string;
  prompt: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  knowledgeTags: string[];
  optionMetadata: Array<{
    optionId: string;
    distractorIntent?: string;
    misconceptionTags?: string[];
  }>;
  localizations?: {
    zh?: {
      prompt?: string;
      options?: QuestionOption[];
      explanation?: string;
      knowledgeTags?: string[];
    };
    en?: {
      prompt?: string;
      options?: QuestionOption[];
      explanation?: string;
      knowledgeTags?: string[];
    };
  };
  syllabusVersion: string;
};

export type ValidationIssue = {
  code: string;
  severity: 'error' | 'warning';
  message: string;
};

export type ReviewDimensionKey =
  | 'syllabus_alignment'
  | 'single_correct_answer'
  | 'option_mutual_exclusion'
  | 'explanation_supports_answer'
  | 'difficulty_match'
  | 'prompt_leakage'
  | 'duplicate_risk'
  | 'distractor_quality'
  | 'domain_sanity';

export type ReviewDimension = {
  key: ReviewDimensionKey;
  status: 'passed' | 'warning' | 'failed' | 'not_checked';
  note: string;
};

export type ReviewContext = {
  subject?: string;
  intendedUse?: string;
  topicId?: number;
  topicTitle?: string;
  syllabusVersion?: string;
  examScope?: string | null;
  excludedScope?: unknown;
  topicStatus?: string;
  allowedQuestionTypes?: unknown;
  difficultyRange?: unknown;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  styleProfile?: unknown;
  targetProfile?: unknown;
  questionPlan?: unknown;
  reviewProviderMode?: 'default' | 'deterministic_only';
  generatorAgent?: {
    provider?: string | null;
    model?: string | null;
    promptVersion?: string | null;
  } | null;
  duplicatePromptCount?: number;
  duplicatePrompts?: string[];
};

export type BlindAnswerReviewEvidence = {
  policyVersion: 'subject-practice-blind-answer-review-v1';
  status: 'disabled' | 'generator_identity_missing' | 'provider_failed' | 'schema_invalid' | 'completed';
  inputBoundary: 'prompt_options_only_answer_and_explanation_redacted';
  selectedOptionId: string | null;
  trueOptionIds: string[];
  optionVerdicts: Array<{
    optionId: string;
    verdict: 'true' | 'false' | 'unknown';
    reason: string;
  }>;
  solution: string | null;
  confidence: number | null;
  abstainReason: string | null;
  uniqueAnswer: boolean;
  agreesWithGenerator: boolean | null;
  independentProviderAndModel: boolean | null;
  generator: {
    provider: string | null;
    model: string | null;
    promptVersion: string | null;
  } | null;
  reviewer: {
    provider: string;
    model: string;
    promptVersion: string;
  } | null;
  providerImpact: 'none_no_provider_call' | 'one_shadow_blind_review_call';
};

export type ReviewProfileAlignment = {
  status: 'passed' | 'warning' | 'failed' | 'not_checked';
  score: number | null;
  reasons: string[];
  targetProfile: unknown;
  evidence: {
    styleProfileUsed: boolean;
    styleProfileConfidence?: string | null;
    inferredQuestionForm?: string | null;
    inferredCognitiveSkill?: string | null;
    inferredDifficultyBand?: string | null;
    difficultyEvidencePolicyVersion?: string | null;
    difficultyEvidencePatchVersion?: string | null;
    designedDifficultyBand?: string | null;
    actualDifficultyReasons?: string[];
    inferredReadingLoad?: string | null;
    inferredCalculationLoad?: string | null;
    actualDistractorTypes: string[];
  };
};

export type ReviewResult = {
  status: 'passed' | 'needs_review' | 'failed';
  issues: ValidationIssue[];
  dimensions: ReviewDimension[];
  sources: Array<'deterministic' | 'llm'>;
  agent?: {
    role: 'reviewer';
    name: string;
    provider: string;
    model: string;
    promptVersion: string;
  };
  decision?: 'approve' | 'revise' | 'regenerate' | 'human_review' | 'quality_attention';
  score?: number;
  rubric?: {
    syllabusAlignment: number;
    answerCorrectness: number;
    optionQuality: number;
    explanationQuality: number;
    difficultyMatch: number;
    languageQuality: number;
    styleAlignment?: number;
    examLikeDifficulty?: number;
    pastPaperSimilarityRisk?: number;
  };
  profileAlignment?: ReviewProfileAlignment;
  provider?: {
    provider: string;
    model: string;
    status: string;
  };
  blindAnswerReview?: BlindAnswerReviewEvidence;
  deterministicAnswerVerification?: unknown;
  formalVerificationBundle?: unknown;
  checkedAt: string;
};

export function jsonInput(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}
