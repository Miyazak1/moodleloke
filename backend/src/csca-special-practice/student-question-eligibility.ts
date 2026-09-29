export type StudentChoiceQuestion = {
  questionType?: string | null;
  options?: unknown;
  correctAnswer?: string | null;
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
  if (question.questionType !== 'single-choice') return false;
  const options = choiceOptions(question.options);
  if (options.length !== 4) return false;
  if (new Set(options.map((option) => option.id)).size !== 4) return false;
  const correctAnswer = String(question.correctAnswer ?? '').trim();
  return Boolean(correctAnswer && options.some((option) => option.id === correctAnswer));
}
