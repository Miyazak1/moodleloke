import { SchoolRecord } from '../schools/schools.types';

export type SavedSchoolRecord = SchoolRecord & {
  savedAt: string;
};

export type CompareSchoolRecord = SchoolRecord & {
  comparedAt: string;
};

export type SchoolActionPayload = {
  schoolId: number;
};

export type StudentProfileRecord = {
  nationality: string | null;
  nationalityCode: string | null;
  country: string | null;
  countryCode: string | null;
  grade: string | null;
  gradeCode: string | null;
  genderCode: string | null;
  educationStageCode: string | null;
  graduationYear: number | null;
  targetExamDate: string | null;
  targetSubjectCodes: string[];
  preferredQuestionLanguageCode: string | null;
  examAttemptType: string | null;
  weeklyGoalDays: number | null;
  targetMajorCategoryCode: string | null;
  onboardingCompletedAt: string | null;
  onboardingSkippedAt: string | null;
  currentOrganizationId: number | null;
  updatedAt: string | null;
};

export type AgentScoreGoalRecord = {
  status: 'unset' | 'configured';
  goal: null | {
    goalId: string;
    examDate: string;
    examBatchCode: string;
    goalVersion: string;
    scoringPolicyVersion: string;
    subjects: Array<{ subject: 'math' | 'physics' | 'chemistry'; targetScore: number; priority: number }>;
  };
};

export type AgentStudyAvailabilityRecord = {
  availabilityVersion: string;
  timezone: string;
  weeklyMinutesGoal: number | null;
  preferredStudyDays: number[];
  defaultSessionMinutes: number | null;
  source: 'user' | 'account_default' | 'unset';
  effectiveAt: string | null;
};

export type AgentLearningPreferenceRecord = {
  preferenceVersion: string;
  defaultLearningMode: 'recommended' | 'free';
  defaultFreePracticeSubject: 'math' | 'physics' | 'chemistry';
  defaultFreePracticeCount: 3 | 5 | 10;
  source: 'user' | 'default';
  updatedAt: string | null;
};

export type AgentLearningSettingsRecord = {
  currentScoringPolicyVersion: string;
  scoreGoal: AgentScoreGoalRecord;
  studyAvailability: AgentStudyAvailabilityRecord;
  learningPreference: AgentLearningPreferenceRecord;
};

export type MyAIOrganizationOption = {
  id: number;
  slug: string;
  name: string;
  role: string;
  cohortId: number | null;
  cohortName: string | null;
  balanceUnits: number | null;
  reservedCredits: number | null;
  perUserDailyLimit: number | null;
  expiresAt: string | null;
  hasActivePool: boolean;
  current: boolean;
};

export type MyAICredits = {
  enabled: boolean;
  balanceUnits: number;
  lifetimeGranted: number;
  lifetimeUsed: number;
  initialFreeUnits: number;
  unlimited: boolean;
  organization: {
    id: number;
    slug: string;
    name: string;
    balanceUnits: number;
    reservedCredits: number;
    perUserDailyLimit: number | null;
    expiresAt: string | null;
    current: boolean;
  } | null;
  organizationOptions: MyAIOrganizationOption[];
  lowBalanceThreshold: number;
  recentUsage: Array<{
    id: number;
    abilityType: string;
    label: string;
    unitsDelta: number;
    status: string;
    reason: string;
    createdAt: string;
  }>;
};

export type CscaWrongQuestionSourceType = 'adaptive_round' | 'diagnostic' | 'mock_exam' | 'special_practice';

export type CscaWrongQuestionStatus = 'unreviewed' | 'viewed_explanation' | 'retried' | 'mastered';

export type CscaWrongQuestionStructuredExplanation = {
  whyWrong: string;
  correctApproach: string;
  quickMethod: string;
  avoidNextTime: string;
};

export type CscaWrongQuestionPattern = {
  patternType: string;
  label: string;
  confidence: number;
  source: 'wrong_pattern' | 'rule';
};

export type CscaWrongQuestionTopic = {
  id: number | null;
  slug: string;
  title: string;
  subject: string;
  module: string;
};

export type CscaWrongQuestionItem = {
  itemKey: string;
  sourceType: CscaWrongQuestionSourceType;
  sourceId: number;
  questionId: number;
  subject: string;
  topicId: number | null;
  topicTitle: string;
  topic: CscaWrongQuestionTopic;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  selected: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
  aiExplanationId: number | null;
  structuredExplanation: CscaWrongQuestionStructuredExplanation | null;
  mistakePattern: CscaWrongQuestionPattern;
  patternType: string;
  patternLabel: string;
  patternConfidence: number;
  status: CscaWrongQuestionStatus;
  knowledgeTags: string[];
  timeSpentSeconds: number;
  lastWrongAt: string | null;
  nextReviewAt: string | null;
  completedAt: string | null;
  reviewPath: string | null;
  practicePath: string;
  reviewPattern?: {
    id: number;
    status: string;
    patternType: string;
    nextReviewAt: string | null;
    lastReviewCompletedAt: string | null;
    verificationStatus: 'not_started' | 'pending_verification' | 'verified_repaired';
    verificationRequired: boolean;
    verificationHref: string;
  } | null;
};

export type CscaWrongQuestionReviewPack = {
  patternType: string;
  label: string;
  confidence: number;
  source: 'wrong_pattern' | 'rule';
  count: number;
  dueCount: number;
  subjects: string[];
  topicTitles: string[];
  latestWrongAt: string | null;
  practicePath: string;
};

export type CscaWrongQuestionResponse = {
  summary: {
    total: number;
    unreviewed: number;
    dueForReview: number;
    patternTypes: Array<{
      patternType: string;
      label: string;
      count: number;
    }>;
  };
  reviewPacks: CscaWrongQuestionReviewPack[];
  items: CscaWrongQuestionItem[];
};
