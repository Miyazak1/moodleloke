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

export type QuestionGenerationBlueprint = {
  id: number;
  subject: string;
  topicId: number;
  topicCode?: string | null;
  topicModule?: string | null;
  topicTitle: string;
  syllabusVersion: string;
  examScope?: string | null;
  allowedQuestionTypes?: unknown;
  difficultyRange?: unknown;
  excludedScope?: unknown;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  difficulty: string;
  questionType: string;
  skill: string | null;
  constraints: unknown;
};

export type SubjectPracticeQuestionPlanValidation = {
  valid: boolean;
  [key: string]: unknown;
};

export type SubjectPracticeQuestionPlanAdherence = {
  adheres: boolean;
  failureCodes: string[];
  [key: string]: unknown;
};

export type SubjectPracticeQuestionPlanPorts = {
  validate: (plan: unknown) => SubjectPracticeQuestionPlanValidation;
  adherenceFor: (plan: unknown, candidate: unknown) => SubjectPracticeQuestionPlanAdherence;
};

export type SubjectPracticeScenarioBlueprintShadowContext = {
  binding?: unknown;
  selectedBlueprint?: unknown;
  ideationCycle?: unknown;
  provisionalScenarioContract?: unknown;
};

export type SubjectPracticeScenarioValidation = {
  status?: string;
  provisionalScenarioContract?: unknown;
  blockers?: string[];
  [key: string]: unknown;
};
