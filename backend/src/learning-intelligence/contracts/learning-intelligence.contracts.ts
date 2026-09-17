import { z } from 'zod';

export const LEARNING_INTELLIGENCE_SCHEMA_VERSION = '1' as const;

export const CscaSubjectCodeSchema = z.enum(['math', 'physics', 'chemistry']);
export const EvidenceSourceTypeSchema = z.enum([
  'adaptive',
  'review',
  'mock_exam',
  'diagnostic',
  'past_paper',
  'verified_handwriting'
]);
export const EvidenceOutcomeSchema = z.enum(['correct', 'incorrect', 'partial', 'skipped']);
export const EvidenceExposureStateSchema = z.enum([
  'unexposed',
  'prompt_seen',
  'hint_seen',
  'answer_seen',
  'explanation_seen'
]);

export const LearningDecisionVersionVectorV1Schema = z.strictObject({
  goalVersion: z.string().min(1),
  availabilityVersion: z.string().min(1),
  evidenceVersion: z.string().min(1),
  learningStateVersion: z.string().min(1),
  learningModelVersion: z.string().min(1),
  syllabusVersion: z.string().min(1),
  scoringPolicyVersion: z.string().min(1),
  itemCalibrationVersion: z.string().min(1),
  decisionPolicyVersion: z.string().min(1),
  decisionContextVersion: z.string().min(1),
  forecastModelVersion: z.string().min(1)
});

export const ScoreReadinessForecastV1Schema = z.strictObject({
  schemaVersion: z.literal('1'),
  forecastId: z.string().min(1).max(120),
  goalId: z.string().min(1).max(120),
  userId: z.number().int().positive(),
  subjectCode: CscaSubjectCodeSchema,
  targetScore: z.number(),
  readinessState: z.enum(['insufficient', 'measuring', 'on_track', 'at_risk']),
  versions: LearningDecisionVersionVectorV1Schema,
  expectedScoreBand: z.strictObject({
    low: z.number(),
    central: z.number(),
    high: z.number()
  }).nullable(),
  targetAttainmentProbability: z.number().min(0).max(1).nullable(),
  confidence: z.enum(['insufficient', 'low', 'medium', 'high']),
  reasonCodes: z.array(z.string().min(1).max(80)).min(1).max(20),
  nextValidationAction: z.enum(['diagnostic', 'mock_exam', 'continue_learning']).optional(),
  evidenceCutoffAt: z.iso.datetime(),
  createdAt: z.iso.datetime()
}).superRefine((value, context) => {
  if (value.confidence === 'insufficient' && (value.expectedScoreBand !== null || value.targetAttainmentProbability !== null)) {
    context.addIssue({
      code: 'custom',
      path: ['expectedScoreBand'],
      message: 'Insufficient readiness evidence cannot produce a score band or attainment probability.'
    });
  }
  if (value.expectedScoreBand && !(value.expectedScoreBand.low <= value.expectedScoreBand.central
    && value.expectedScoreBand.central <= value.expectedScoreBand.high)) {
    context.addIssue({ code: 'custom', path: ['expectedScoreBand'], message: 'Score band must be ordered low <= central <= high.' });
  }
});

export const ScoreCalibrationGateV1Schema = z.strictObject({
  schemaVersion: z.literal('1'),
  examSystemCode: z.string().min(1).max(40),
  subjectCode: CscaSubjectCodeSchema,
  scoringPolicyVersion: z.string().min(1).max(80),
  itemCalibrationVersion: z.string().min(1).max(100),
  forecastModelVersion: z.string().min(1).max(100),
  gateVersionHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['blocked', 'shadow_qualified']),
  numericForecastRelease: z.literal('disabled'),
  scoringPolicyId: z.string().min(1).max(120).nullable(),
  itemCalibrationSnapshotId: z.string().min(1).max(120).nullable(),
  forecastCalibrationSnapshotId: z.string().min(1).max(120).nullable(),
  reasonCodes: z.array(z.string().min(1).max(80)).min(1).max(20),
  evaluatedAt: z.iso.datetime()
});

export const ScoreModelingPrerequisiteV1Schema = z.strictObject({
  schemaVersion: z.literal('1'),
  examSystemCode: z.string().min(1).max(40),
  subjectCode: CscaSubjectCodeSchema,
  scoringPolicyVersion: z.string().min(1).max(80),
  itemCalibrationVersion: z.string().min(1).max(100),
  prerequisiteVersionHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['blocked', 'qualified']),
  scoringPolicyId: z.string().min(1).max(120).nullable(),
  itemCalibrationSnapshotId: z.string().min(1).max(120).nullable(),
  reasonCodes: z.array(z.string().min(1).max(80)).max(20),
  evaluatedAt: z.iso.datetime()
}).superRefine((value, context) => {
  if (value.status === 'qualified' && value.reasonCodes.length > 0) {
    context.addIssue({ code: 'custom', path: ['reasonCodes'], message: 'Qualified prerequisites cannot have blockers.' });
  }
  if (value.status === 'blocked' && value.reasonCodes.length === 0) {
    context.addIssue({ code: 'custom', path: ['reasonCodes'], message: 'Blocked prerequisites require a reason.' });
  }
});

export const TopicEvidenceV1Schema = z.strictObject({
  topicId: z.number().int().positive(),
  role: z.enum(['primary', 'secondary']),
  weight: z.number().positive().max(1)
});

export const LearningEvidenceEventV1Schema = z.strictObject({
  schemaVersion: z.literal(LEARNING_INTELLIGENCE_SCHEMA_VERSION),
  eventId: z.string().min(1).max(80),
  eventSequence: z.string().regex(/^\d+$/),
  userId: z.number().int().positive(),
  subjectCode: CscaSubjectCodeSchema,
  occurredAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  sourceType: EvidenceSourceTypeSchema,
  sourceId: z.string().min(1).max(120),
  attemptSequence: z.number().int().positive(),
  sessionId: z.string().min(1).max(120).optional(),
  questionId: z.string().min(1).max(120),
  questionVersion: z.number().int().positive(),
  answerKeyVersion: z.string().min(1).max(80),
  topicMappingVersion: z.string().min(1).max(80),
  scoringRubricVersion: z.string().min(1).max(80).optional(),
  exposureState: EvidenceExposureStateSchema,
  topicEvidence: z.array(TopicEvidenceV1Schema).min(1).superRefine((items, context) => {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(total - 1) > 0.000001) {
      context.addIssue({ code: 'custom', message: 'Topic evidence weights must sum to 1' });
    }
    if (new Set(items.map((item) => item.topicId)).size !== items.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate topic evidence' });
    }
  }),
  outcome: EvidenceOutcomeSchema,
  firstAttempt: z.boolean(),
  usedHint: z.boolean(),
  usedExplanation: z.boolean(),
  timeSpentSeconds: z.number().int().nonnegative().optional(),
  difficulty: z.string().min(1).max(40).optional(),
  questionQualityConfidence: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const LearningEvidenceWriteInputV1Schema = LearningEvidenceEventV1Schema.omit({
  eventSequence: true,
  recordedAt: true,
  firstAttempt: true
});

export const UpdateScoreGoalInputV1Schema = z.strictObject({
  schemaVersion: z.literal(LEARNING_INTELLIGENCE_SCHEMA_VERSION),
  examSystemCode: z.literal('csca'),
  examBatchCode: z.string().min(1).max(80),
  examDate: z.iso.date(),
  subjectGoals: z.array(z.strictObject({
    subject: CscaSubjectCodeSchema,
    targetScore: z.number().finite(),
    priority: z.number().int().positive().optional()
  })).min(1).superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.subject)) {
        context.addIssue({ code: 'custom', path: [index, 'subject'], message: 'Duplicate subject goal' });
      }
      seen.add(item.subject);
    });
  }),
  expectedGoalVersion: z.string().min(1).optional(),
  expectedScoringPolicyVersion: z.string().min(1)
});

export const UpdateStudyAvailabilityInputV1Schema = z.strictObject({
  schemaVersion: z.literal(LEARNING_INTELLIGENCE_SCHEMA_VERSION),
  timezone: z.string().min(1).max(80),
  weeklyMinutesGoal: z.number().int().positive().max(10080).nullable(),
  preferredStudyDays: z.array(z.number().int().min(1).max(7)).max(7)
    .superRefine((days, context) => {
      if (new Set(days).size !== days.length) {
        context.addIssue({ code: 'custom', message: 'Duplicate preferred study day' });
      }
    }),
  defaultSessionMinutes: z.number().int().positive().max(480).nullable(),
  expectedAvailabilityVersion: z.string().min(1).optional()
});

export const LearningPrescriptionV1Schema = z.strictObject({
  schemaVersion: z.literal(LEARNING_INTELLIGENCE_SCHEMA_VERSION),
  prescriptionId: z.string().min(1),
  userId: z.number().int().positive(),
  versions: LearningDecisionVersionVectorV1Schema,
  objective: z.string().min(1),
  reasonCodes: z.array(z.string().min(1)),
  reasonSummary: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
  estimatedMinutes: z.number().int().positive(),
  tasks: z.array(z.strictObject({
    type: z.enum(['diagnostic', 'review', 'targeted_practice', 'mock_exam', 'concept_learning', 'intervention_verification']),
    subject: CscaSubjectCodeSchema,
    topicIds: z.array(z.number().int().positive()),
    difficulty: z.string().min(1).optional(),
    questionCount: z.number().int().positive().optional(),
    interventionVerificationId: z.string().min(1).max(120).optional(),
    interventionVerificationPhase: z.enum(['retention', 'transfer']).optional(),
    priority: z.number().int().positive()
  })).min(1),
  alternatives: z.array(z.strictObject({
    label: z.string().min(1),
    adjustment: z.enum(['shorter', 'different_subject', 'easier', 'harder', 'skip'])
  })),
  validUntil: z.iso.datetime(),
  createdAt: z.iso.datetime()
});

export const TargetGapTypeV1Schema = z.enum([
  'coverage',
  'mastery',
  'difficulty',
  'retention',
  'fluency',
  'transfer',
  'exam_execution',
  'evidence'
]);

export const TargetGapItemV1Schema = z.strictObject({
  gapId: z.string().min(1).max(120),
  type: TargetGapTypeV1Schema,
  subject: CscaSubjectCodeSchema,
  topicIds: z.array(z.number().int().positive()).max(50),
  severity: z.number().min(0).max(1),
  confidence: z.enum(['low', 'medium', 'high']),
  estimatedScoreImpact: z.null(),
  evidenceRefs: z.array(z.string().min(1).max(160)).max(50),
  reasonCodes: z.array(z.string().min(1).max(80)).min(1).max(20),
  recommendedAction: z.enum(['diagnostic', 'review', 'targeted_practice', 'mock_exam', 'concept_learning', 'intervention_verification']),
  interventionVerificationId: z.string().min(1).max(120).optional(),
  interventionVerificationPhase: z.enum(['retention', 'transfer']).optional()
});

export const TargetGapSnapshotV1Schema = z.strictObject({
  schemaVersion: z.literal(LEARNING_INTELLIGENCE_SCHEMA_VERSION),
  gapSnapshotId: z.string().min(1),
  goalId: z.string().min(1),
  userId: z.number().int().positive(),
  versions: LearningDecisionVersionVectorV1Schema,
  gaps: z.array(TargetGapItemV1Schema).max(100),
  evidenceCutoffAt: z.iso.datetime(),
  createdAt: z.iso.datetime()
});

export type CscaSubjectCode = z.infer<typeof CscaSubjectCodeSchema>;
export type LearningDecisionVersionVectorV1 = z.infer<typeof LearningDecisionVersionVectorV1Schema>;
export type ScoreReadinessForecastV1 = z.infer<typeof ScoreReadinessForecastV1Schema>;
export type ScoreCalibrationGateV1 = z.infer<typeof ScoreCalibrationGateV1Schema>;
export type ScoreModelingPrerequisiteV1 = z.infer<typeof ScoreModelingPrerequisiteV1Schema>;
export type LearningEvidenceEventV1 = z.infer<typeof LearningEvidenceEventV1Schema>;
export type LearningEvidenceWriteInputV1 = z.infer<typeof LearningEvidenceWriteInputV1Schema>;
export type UpdateScoreGoalInputV1 = z.infer<typeof UpdateScoreGoalInputV1Schema>;
export type UpdateStudyAvailabilityInputV1 = z.infer<typeof UpdateStudyAvailabilityInputV1Schema>;
export type LearningPrescriptionV1 = z.infer<typeof LearningPrescriptionV1Schema>;
export type TargetGapItemV1 = z.infer<typeof TargetGapItemV1Schema>;
export type TargetGapSnapshotV1 = z.infer<typeof TargetGapSnapshotV1Schema>;
