export type MockExamSubject = 'math' | 'physics' | 'chemistry';

export type MockExamOption = {
  id: string;
  text: string;
};

export type MockExamPaperSummary = {
  id: number;
  subject: MockExamSubject;
  slug: string;
  title: string;
  description?: string;
  language: string;
  questionCount: number;
  durationMinutes: number;
  priceLabel?: string;
  isFree: boolean;
  isLocked: boolean;
};

export type MockExamAttemptPatchPayload = {
  answers?: Record<string, string>;
  markedQuestions?: number[];
  timeSpent?: Record<string, number>;
  currentQuestion?: number;
  expectedVersion?: number;
};

export type MockExamAttemptCreatePayload = {
  language?: string;
};
