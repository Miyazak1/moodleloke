export type SpecialPracticeSubject = 'math' | 'physics' | 'chemistry';

export type SpecialPracticeOption = {
  id: string;
  text: string;
};

export type SpecialPracticeSessionPatchPayload = {
  answers?: Record<string, string>;
  timeSpent?: Record<string, number>;
  currentQuestion?: number;
  expectedVersion?: number;
};
