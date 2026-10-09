export type StudentChoiceQuestion = {
  questionType?: string | null;
  options?: unknown;
  correctAnswer?: string | null;
};

export type IndependentVerificationQuestionCandidate = StudentChoiceQuestion & {
  sourceType?: string | null;
  reviewMetadata?: unknown;
};

type ChoiceOption = { id: string; text: string };

function choiceOptions(value: unknown): ChoiceOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      const text = String(record.text ?? '').trim();
      return id && text ? { id, text } : null;
    })
    .filter((item): item is ChoiceOption => Boolean(item));
}

/** Student-facing CSCA practice currently supports standard four-option single-choice questions only. */
export function isStandardStudentChoiceQuestion(question: StudentChoiceQuestion) {
  const questionType = String(question.questionType ?? '').trim().replaceAll('_', '-');
  if (questionType !== 'single-choice') return false;
  const options = choiceOptions(question.options);
  if (options.length !== 4) return false;
  if (new Set(options.map((option) => option.id)).size !== 4) return false;
  const correctAnswer = String(question.correctAnswer ?? '').trim();
  return Boolean(correctAnswer && options.some((option) => option.id === correctAnswer));
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Public OER may be suitable for ordinary practice after structural checks,
 * while still being too weak for post-intervention measurement. Independent
 * verification requires an explicit human-content and answer recomputation
 * review instead of inferring trust from `approved` alone.
 */
export function isIndependentVerificationQuestion(question: IndependentVerificationQuestionCandidate) {
  if (!isStandardStudentChoiceQuestion(question)) return false;
  if (question.sourceType !== 'external_oer') return true;
  const externalReview = recordFrom(recordFrom(question.reviewMetadata).externalImport);
  const publicationScope = String(externalReview.publicationScope ?? '').trim();
  return externalReview.contentReviewed === true
    && externalReview.answerRecomputed === true
    && ['independent_verification', 'intervention_verification', 'measurement'].includes(publicationScope);
}
