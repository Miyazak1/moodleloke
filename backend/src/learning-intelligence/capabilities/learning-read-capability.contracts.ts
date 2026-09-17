import { z } from 'zod';
import {
  CscaSubjectCodeSchema,
  LearningPrescriptionV1Schema,
  ScoreReadinessForecastV1Schema,
  TargetGapSnapshotV1Schema
} from '../contracts/learning-intelligence.contracts';

export const LEARNING_READ_CAPABILITY_VERSION = '1.0' as const;
export const LEARNING_READ_SCOPE = 'learning.read' as const;

export const LearningCapabilityChannelSchema = z.enum([
  'web_agent',
  'codex_plugin',
  'chatgpt_plugin',
  'internal'
]);

export const LearningCapabilityContextSchema = z.strictObject({
  requestId: z.string().min(1).max(120),
  traceId: z.string().min(1).max(120),
  actorUserId: z.number().int().positive(),
  channel: LearningCapabilityChannelSchema,
  locale: z.enum(['zh-CN', 'en']),
  timezone: z.string().min(1).max(80).optional(),
  grantedScopes: z.array(z.string().min(1)).max(50)
});

const EmptyInputSchema = z.strictObject({});
const SubjectFilterSchema = z.strictObject({
  subject: CscaSubjectCodeSchema.optional(),
  limit: z.number().int().min(1).max(50).optional()
});

export const LearningReadCapabilityInputSchemas = {
  get_learning_profile: EmptyInputSchema,
  get_score_goal: EmptyInputSchema,
  get_study_availability: EmptyInputSchema,
  get_subject_mastery: SubjectFilterSchema,
  get_review_queue: z.strictObject({
    subject: CscaSubjectCodeSchema.optional(),
    language: z.enum(['zh', 'en']).optional(),
    limit: z.number().int().min(1).max(50).optional()
  }),
  list_mock_exam_attempts: z.strictObject({
    status: z.enum(['in_progress', 'submitted', 'all']).optional(),
    subject: CscaSubjectCodeSchema.optional(),
    limit: z.number().int().min(1).max(20).optional()
  }),
  search_past_papers: z.strictObject({
    subject: CscaSubjectCodeSchema.optional(),
    category: z.enum(['past-paper', 'mock-paper']).optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    locale: z.enum(['zh', 'en']).optional(),
    limit: z.number().int().min(1).max(20).optional()
  }),
  get_question_supply_status: z.strictObject({
    subject: CscaSubjectCodeSchema,
    topicIds: z.array(z.number().int().positive()).max(50).optional(),
    difficulty: z.string().trim().min(1).max(40).optional(),
    questionType: z.string().trim().min(1).max(100).optional(),
    requestedCount: z.number().int().min(1).max(100).optional()
  }),
  get_intervention_stability: z.strictObject({
    verificationId: z.string().trim().min(1).max(120)
  }),
  get_target_gap: EmptyInputSchema,
  get_learning_prescription: EmptyInputSchema,
  get_score_readiness: EmptyInputSchema
} as const;

const StudyAvailabilityDataSchema = z.strictObject({
  availabilityVersion: z.string().min(1),
  timezone: z.string().min(1),
  weeklyMinutesGoal: z.number().int().positive().nullable(),
  preferredStudyDays: z.array(z.number().int().min(1).max(7)),
  defaultSessionMinutes: z.number().int().positive().nullable(),
  source: z.enum(['user', 'account_default', 'unset']),
  effectiveAt: z.iso.datetime().nullable()
});

export const LearningReadCapabilityOutputSchemas = {
  get_learning_profile: z.strictObject({
    educationStageCode: z.string().nullable(),
    gradeCode: z.string().nullable(),
    genderCode: z.string().nullable(),
    countryCode: z.string().nullable(),
    graduationYear: z.number().int().nullable(),
    targetSubjectCodes: z.array(CscaSubjectCodeSchema),
    preferredQuestionLanguageCode: z.enum(['zh', 'en', 'bilingual']).nullable(),
    targetExamDate: z.iso.date().nullable(),
    examAttemptType: z.string().nullable(),
    weeklyGoalDays: z.number().int().nullable(),
    studyAvailability: StudyAvailabilityDataSchema,
    targetMajorCategoryCode: z.string().nullable()
  }),
  get_score_goal: z.union([
    z.strictObject({ status: z.literal('unset'), goal: z.null() }),
    z.strictObject({
      status: z.literal('configured'),
      goal: z.strictObject({
        goalId: z.string().min(1),
        examSystemCode: z.string().min(1),
        examBatchCode: z.string().min(1),
        examDate: z.iso.date(),
        goalVersion: z.string().min(1),
        totalTargetScore: z.number().nullable(),
        scoringPolicyVersion: z.string().min(1),
        source: z.string().min(1),
        effectiveAt: z.iso.datetime(),
        subjects: z.array(z.strictObject({
          subject: CscaSubjectCodeSchema,
          targetScore: z.number(),
          priority: z.number().int().positive()
        }))
      })
    })
  ]),
  get_study_availability: StudyAvailabilityDataSchema,
  get_subject_mastery: z.strictObject({
    stateSource: z.literal('user_csca_topic_mastery_v1'),
    subjects: z.array(z.strictObject({
      subject: CscaSubjectCodeSchema,
      score: z.number().min(0).max(1).optional(),
      evidenceCount: z.number().int().nonnegative(),
      topics: z.array(z.strictObject({
        topicId: z.number().int().positive(),
        code: z.string().min(1),
        title: z.string().min(1),
        score: z.number().min(0).max(1),
        confidence: z.number().min(0).max(1),
        status: z.enum(['insufficient_evidence', 'strong', 'developing', 'needs_attention']),
        attemptCount: z.number().int().nonnegative(),
        correctCount: z.number().int().nonnegative(),
        lastPracticedAt: z.iso.datetime().nullable(),
        updatedAt: z.iso.datetime()
      }))
    }))
  }),
  get_review_queue: z.strictObject({
    items: z.array(z.strictObject({
      reviewItemId: z.number().int().positive(),
      patternType: z.string().min(1),
      topicId: z.number().int().positive().optional(),
      subject: CscaSubjectCodeSchema,
      title: z.string().min(1),
      dueAt: z.iso.datetime().nullable(),
      priority: z.number().int().min(1).max(3),
      recurrenceCount: z.number().int().positive(),
      status: z.string().min(1),
      href: z.string().min(1)
    }))
  }),
  list_mock_exam_attempts: z.strictObject({
    items: z.array(z.strictObject({
      attemptId: z.string().min(1),
      paperSlug: z.string().min(1),
      title: z.string().min(1),
      subject: CscaSubjectCodeSchema,
      status: z.enum(['in_progress', 'submitted']),
      answeredCount: z.number().int().nonnegative(),
      questionCount: z.number().int().nonnegative(),
      score: z.number().int().nullable(),
      updatedAt: z.iso.datetime(),
      attemptPath: z.string().min(1),
      reportPath: z.string().nullable()
    }))
  }),
  search_past_papers: z.strictObject({
    items: z.array(z.strictObject({
      id: z.number().int().positive(),
      slug: z.string().min(1),
      title: z.string().min(1),
      category: z.enum(['past-paper', 'mock-paper']),
      subject: CscaSubjectCodeSchema,
      examYear: z.number().int().optional(),
      examMonth: z.string().optional(),
      language: z.string().min(1),
      questionCount: z.number().int().nonnegative().optional(),
      pageCount: z.number().int().nonnegative().optional(),
      hasAnswers: z.boolean(),
      hasSolutions: z.boolean(),
      isFree: z.boolean(),
      fileCount: z.number().int().nonnegative(),
      href: z.string().min(1)
    })).max(20)
  }),
  get_question_supply_status: z.strictObject({
    subject: CscaSubjectCodeSchema,
    requestedCount: z.number().int().positive(),
    availableCount: z.number().int().nonnegative(),
    status: z.enum(['sufficient', 'limited', 'empty']),
    canCreatePractice: z.boolean(),
    sourceBreakdown: z.strictObject({
      cscaPublished: z.number().int().nonnegative(),
      specialPracticePublished: z.number().int().nonnegative()
    }),
    filters: z.strictObject({
      topicIds: z.array(z.number().int().positive()),
      difficulty: z.string().nullable(),
      questionType: z.string().nullable()
    }),
    generatedAt: z.iso.datetime()
  }),
  get_intervention_stability: z.strictObject({
    verificationId: z.string().min(1),
    deliveryId: z.string().min(1),
    subjectCode: CscaSubjectCodeSchema,
    currentPhase: z.enum(['immediate', 'retention', 'transfer']),
    currentPhaseStatus: z.string().min(1),
    currentPhaseResult: z.enum(['passed', 'failed', 'inconclusive']).nullable(),
    stabilityStatus: z.enum(['pending', 'completed']),
    stabilityResult: z.enum(['stable', 'not_stable', 'inconclusive']).nullable(),
    policyVersion: z.string().min(1),
    evaluatedAt: z.iso.datetime().nullable(),
    nextDueAt: z.iso.datetime().nullable(),
    phases: z.array(z.strictObject({
      phase: z.enum(['immediate', 'retention', 'transfer']),
      status: z.string().min(1),
      result: z.enum(['passed', 'failed', 'inconclusive']).nullable(),
      accuracy: z.number().min(0).max(1).nullable(),
      dueAt: z.iso.datetime(),
      evaluatedAt: z.iso.datetime().nullable()
    })).max(3)
  }),
  get_target_gap: z.union([
    z.strictObject({ status: z.literal('goal_unset'), snapshot: z.null() }),
    z.strictObject({ status: z.literal('updating'), snapshot: z.null() }),
    z.strictObject({ status: z.literal('ready'), snapshot: TargetGapSnapshotV1Schema })
  ]),
  get_learning_prescription: z.union([
    z.strictObject({ status: z.literal('goal_unset'), prescription: z.null() }),
    z.strictObject({ status: z.literal('updating'), prescription: z.null() }),
    z.strictObject({
      status: z.literal('ready'),
      goalId: z.string().min(1),
      prescription: LearningPrescriptionV1Schema
    })
  ]),
  get_score_readiness: z.union([
    z.strictObject({ status: z.literal('goal_unset'), forecasts: z.array(z.never()).max(0) }),
    z.strictObject({ status: z.literal('updating'), forecasts: z.array(z.never()).max(0) }),
    z.strictObject({
      status: z.literal('ready'),
      visibility: z.literal('shadow'),
      forecasts: z.array(ScoreReadinessForecastV1Schema).min(1).max(3)
    })
  ])
} as const;

export type LearningReadCapabilityName = keyof typeof LearningReadCapabilityInputSchemas;
export type LearningCapabilityContext = z.infer<typeof LearningCapabilityContextSchema>;

export type LearningCapabilityUsage = {
  creditsCharged: 0;
  meteringSource: 'none';
};

export type LearningCapabilitySuccess<T = unknown> = {
  ok: true;
  tool: LearningReadCapabilityName;
  toolVersion: typeof LEARNING_READ_CAPABILITY_VERSION;
  requestId: string;
  data: T;
  usage: LearningCapabilityUsage;
  warnings?: Array<{ code: string; message: string }>;
  confirmation: null;
};

export const LEARNING_CAPABILITY_ERROR_CODES = [
  'AUTHENTICATION_REQUIRED',
  'AUTHORIZATION_DENIED',
  'VALIDATION_ERROR',
  'RESOURCE_NOT_FOUND',
  'TOOL_UNAVAILABLE',
  'INTERNAL_ERROR'
] as const;

export type LearningCapabilityErrorCode = typeof LEARNING_CAPABILITY_ERROR_CODES[number];

export type LearningCapabilityFailure = {
  ok: false;
  tool: string;
  toolVersion: typeof LEARNING_READ_CAPABILITY_VERSION;
  requestId: string;
  error: {
    code: LearningCapabilityErrorCode;
    message: string;
    retryable: boolean;
    fieldErrors?: Array<{ field: string; code: string; message: string }>;
  };
  usage: LearningCapabilityUsage;
  confirmation: null;
};

export type LearningCapabilityResponse<T = unknown> = LearningCapabilitySuccess<T> | LearningCapabilityFailure;

export type LearningReadCapabilityDefinition = {
  name: LearningReadCapabilityName;
  version: typeof LEARNING_READ_CAPABILITY_VERSION;
  scope: typeof LEARNING_READ_SCOPE;
  riskLevel: 0;
  aiCredits: 0;
  channels: readonly ['web_agent', 'codex_plugin', 'chatgpt_plugin', 'internal'];
  description: string;
};
