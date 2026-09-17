import type {
  LearningDecisionVersionVectorV1,
  LearningEvidenceEventV1,
  LearningPrescriptionV1,
  UpdateScoreGoalInputV1,
  UpdateStudyAvailabilityInputV1
} from '../contracts/learning-intelligence.contracts';

export const fixedDecisionVersions: LearningDecisionVersionVectorV1 = {
  goalVersion: 'goal-v1',
  availabilityVersion: 'availability-v1',
  evidenceVersion: 'evidence-42',
  learningStateVersion: 'state-v2-42',
  learningModelVersion: 'learning-rules-v1',
  syllabusVersion: 'csca-2026-v1',
  scoringPolicyVersion: 'csca-score-2026-v1',
  itemCalibrationVersion: 'calibration-shadow-v1',
  decisionPolicyVersion: 'prescription-rules-v1',
  decisionContextVersion: 'context-v1',
  forecastModelVersion: 'score-readiness-shadow-gate-v1'
};

export const fixedLearningEvidenceEvent: LearningEvidenceEventV1 = {
  schemaVersion: '1',
  eventId: 'evidence-event-fixture-1',
  eventSequence: '42',
  userId: 1001,
  subjectCode: 'chemistry',
  occurredAt: '2026-09-12T08:00:00.000Z',
  recordedAt: '2026-09-12T08:00:01.000Z',
  sourceType: 'adaptive',
  sourceId: 'round-2001',
  attemptSequence: 1,
  sessionId: 'session-1001',
  questionId: 'question-3001',
  questionVersion: 1,
  answerKeyVersion: 'answer-key-v1',
  topicMappingVersion: 'topic-map-v3',
  exposureState: 'prompt_seen',
  topicEvidence: [{ topicId: 501, role: 'primary', weight: 1 }],
  outcome: 'incorrect',
  firstAttempt: true,
  usedHint: false,
  usedExplanation: false,
  timeSpentSeconds: 73,
  difficulty: 'medium',
  questionQualityConfidence: 0.96
};

export const fixedScoreGoalInput: UpdateScoreGoalInputV1 = {
  schemaVersion: '1',
  examSystemCode: 'csca',
  examBatchCode: '2027-01',
  examDate: '2027-01-15',
  subjectGoals: [{ subject: 'chemistry', targetScore: 85, priority: 1 }],
  expectedScoringPolicyVersion: 'csca-score-2026-v1'
};

export const fixedAvailabilityInput: UpdateStudyAvailabilityInputV1 = {
  schemaVersion: '1',
  timezone: 'Asia/Shanghai',
  weeklyMinutesGoal: 300,
  preferredStudyDays: [1, 3, 5, 7],
  defaultSessionMinutes: 30
};

export const fixedLearningPrescription: LearningPrescriptionV1 = {
  schemaVersion: '1',
  prescriptionId: 'prescription-fixture-1',
  userId: 1001,
  versions: fixedDecisionVersions,
  objective: 'Strengthen redox equation balancing with independent practice.',
  reasonCodes: ['MASTERY_GAP', 'INDEPENDENCE_GAP'],
  reasonSummary: 'Recent independent attempts show a repeated electron-balance error.',
  confidence: 'medium',
  estimatedMinutes: 20,
  tasks: [{
    type: 'targeted_practice',
    subject: 'chemistry',
    topicIds: [501],
    difficulty: 'medium',
    questionCount: 5,
    priority: 1
  }],
  alternatives: [
    { label: 'Short 10-minute version', adjustment: 'shorter' },
    { label: 'Switch subject', adjustment: 'different_subject' }
  ],
  validUntil: '2026-09-13T08:00:00.000Z',
  createdAt: '2026-09-12T08:00:02.000Z'
};
