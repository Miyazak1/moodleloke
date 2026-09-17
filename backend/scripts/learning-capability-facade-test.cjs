const assert = require('node:assert/strict');
const { LearningCapabilityRegistryService } = require('../dist/backend/src/learning-intelligence/capabilities/learning-capability-registry.service');
const { LearningReadCapabilityService } = require('../dist/backend/src/learning-intelligence/capabilities/learning-read-capability.service');
const { LearningIntelligenceFeatureFlagsService } = require('../dist/backend/src/learning-intelligence/learning-intelligence-feature-flags.service');

const now = new Date('2026-09-12T08:00:00.000Z');
const seen = [];
const track = (name, result) => async (args) => {
  seen.push({ name, args });
  return typeof result === 'function' ? result(args) : result;
};

const prisma = {
  studentProfile: {
    findUnique: track('studentProfile.findUnique', {
      educationStageCode: 'high_school', gradeCode: 'SCHOOL_G11', genderCode: null, countryCode: 'CN',
      graduationYear: 2027, targetSubjectCodes: ['math', 'physics'], preferredQuestionLanguageCode: 'bilingual',
      targetExamDate: new Date('2027-03-01T00:00:00.000Z'), examAttemptType: 'first', weeklyGoalDays: 5,
      targetMajorCategoryCode: 'engineering'
    })
  },
  studyAvailabilityPreference: {
    findFirst: track('studyAvailabilityPreference.findFirst', {
      version: 3, timezone: 'Asia/Shanghai', weeklyMinutesGoal: 420, preferredStudyDays: [1, 3, 5],
      defaultSessionMinutes: 45, source: 'user', effectiveAt: now, createdAt: now
    })
  },
  studentScoreGoal: {
    findFirst: track('studentScoreGoal.findFirst', {
      id: 'goal-1', examSystemCode: 'csca', examBatchCode: '2027-spring', examDate: new Date('2027-03-01T00:00:00.000Z'),
      version: 2, totalTargetScore: 270, scoringPolicyVersion: 'csca-2027-v1', source: 'user', effectiveAt: now,
      subjects: [
        { subjectCode: 'math', targetScore: 95, priority: 1 },
        { subjectCode: 'physics', targetScore: 90, priority: 2 },
        { subjectCode: 'unsupported', targetScore: 100, priority: 3 }
      ]
    })
  },
  userCscaTopicMastery: {
    findMany: track('userCscaTopicMastery.findMany', [
      { userId: 42, subject: 'math', topicId: 7, mastery: 0.72, confidence: 0.8, attemptCount: 10, correctCount: 7, lastPracticedAt: now, updatedAt: now }
    ])
  },
  cscaExamTopic: {
    findMany: track('cscaExamTopic.findMany', [{ id: 7, code: 'M-FN', title: 'Functions' }]),
    count: track('cscaExamTopic.count', 1)
  },
  cscaWrongPattern: {
    findMany: track('cscaWrongPattern.findMany', [
      { id: 9, userId: 42, subject: 'math', topicId: 7, patternType: 'sign_error', recurrenceCount: 4,
        status: 'active', nextReviewAt: new Date('2026-09-11T00:00:00.000Z'), lastWrongAt: now, topic: { title: 'Functions' } }
    ])
  },
  mockExamAttempt: {
    findMany: track('mockExamAttempt.findMany', [
      { id: 11, userId: 42, answers: { 1: 'A', 2: '' }, score: null, submittedAt: null, updatedAt: now,
        paper: { slug: 'math-1', title: 'Math Mock 1', subject: 'math', questionCount: 20 } }
    ])
  },
  cscaQuestion: { count: track('cscaQuestion.count', 4) },
  specialPracticeQuestion: { count: track('specialPracticeQuestion.count', 3) },
  learningInterventionVerification: {
    findFirst: track('learningInterventionVerification.findFirst', (args) => args.where.userId === 42 && args.where.id === 'verification-1' ? ({
      id: 'verification-1', deliveryId: 'delivery-1', phase: 'retention', status: 'completed', dueAt: now,
      outcome: { result: 'passed', accuracy: 1, evaluatedAt: now },
      sourceDelivery: {
        stabilityAssessment: {
          status: 'pending', result: null, policyVersion: 'intervention-stability-immediate-retention-transfer-v1', evaluatedAt: null
        },
        verifications: [
          { phase: 'immediate', status: 'completed', dueAt: now, outcome: { result: 'passed', accuracy: 1, evaluatedAt: now } },
          { phase: 'retention', status: 'completed', dueAt: now, outcome: { result: 'passed', accuracy: 1, evaluatedAt: now } },
          { phase: 'transfer', status: 'scheduled', dueAt: new Date('2099-09-13T08:01:00.000Z'), outcome: null }
        ]
      }
    }) : null)
  }
};

const pastPapers = {
  async listPublic(params) {
    assert.equal(params.subject, 'chemistry');
    return { items: [
      { id: 1, slug: 'chemistry-2026', title: 'Chemistry 2026', category: 'past-paper', subject: 'chemistry', examYear: 2026, language: 'en', questionCount: 48, hasAnswers: true, hasSolutions: false, isFree: true, fileCount: 2 },
      { id: 2, slug: 'chemistry-2025', title: 'Chemistry 2025', category: 'past-paper', subject: 'chemistry', examYear: 2025, language: 'en', hasAnswers: false, hasSolutions: false, isFree: true, fileCount: 1 }
    ] };
  }
};
const service = new LearningReadCapabilityService(prisma, undefined, undefined, pastPapers);
const enabledFlags = new LearningIntelligenceFeatureFlagsService({ CSCA_AGENT_FOUNDATION_ENABLED: 'true' });
const registry = new LearningCapabilityRegistryService(service, enabledFlags);
const context = {
  requestId: 'req-1', traceId: 'trace-1', actorUserId: 42, channel: 'web_agent', locale: 'en',
  grantedScopes: ['learning.read']
};

async function invoke(name, input = {}) {
  const response = await registry.invoke(name, context, input);
  assert.equal(response.ok, true, `${name}: ${JSON.stringify(response)}`);
  assert.equal(response.tool, name);
  assert.equal(response.toolVersion, '1.0');
  assert.deepEqual(response.usage, { creditsCharged: 0, meteringSource: 'none' });
  assert.equal(response.confirmation, null);
  return response.data;
}

async function main() {
  assert.deepEqual(registry.list().map((item) => item.name), [
    'get_learning_profile', 'get_score_goal', 'get_study_availability', 'get_subject_mastery',
    'get_review_queue', 'list_mock_exam_attempts', 'search_past_papers', 'get_question_supply_status', 'get_intervention_stability',
    'get_target_gap', 'get_learning_prescription', 'get_score_readiness'
  ]);
  assert.ok(registry.list().every((item) => item.scope === 'learning.read' && item.riskLevel === 0 && item.aiCredits === 0));
  assert.equal(registry.getInputSchema('get_subject_mastery').safeParse({ subject: 'math' }).success, true);
  assert.equal(registry.getOutputSchema('get_study_availability').safeParse({
    availabilityVersion: 'unset', timezone: 'UTC', weeklyMinutesGoal: null, preferredStudyDays: [],
    defaultSessionMinutes: null, source: 'unset', effectiveAt: null
  }).success, true);

  const profile = await invoke('get_learning_profile');
  assert.deepEqual(profile.targetSubjectCodes, ['math', 'physics']);
  assert.equal(profile.preferredQuestionLanguageCode, 'bilingual');
  assert.equal(profile.studyAvailability.availabilityVersion, '3');

  const goal = await invoke('get_score_goal');
  assert.equal(goal.status, 'configured');
  assert.equal(goal.goal.subjects.length, 2, 'unsupported subjects must not cross the v1 contract');

  const availability = await invoke('get_study_availability');
  assert.equal(availability.timezone, 'Asia/Shanghai');

  const mastery = await invoke('get_subject_mastery', { subject: 'math', limit: 10 });
  assert.equal(mastery.subjects[0].topics[0].status, 'developing');

  const queue = await invoke('get_review_queue', { subject: 'math', language: 'en', limit: 10 });
  assert.equal(queue.items[0].reviewItemId, 9);
  assert.equal(queue.items[0].priority, 3);

  const attempts = await invoke('list_mock_exam_attempts', { status: 'in_progress', subject: 'math' });
  assert.equal(attempts.items[0].answeredCount, 1);
  assert.equal(attempts.items[0].status, 'in_progress');

  const papers = await invoke('search_past_papers', { subject: 'chemistry', year: 2026, locale: 'en', limit: 5 });
  assert.equal(papers.items.length, 1);
  assert.equal(papers.items[0].href, '/en/past-papers/download/chemistry-2026');

  const supply = await invoke('get_question_supply_status', { subject: 'math', requestedCount: 5 });
  assert.equal(supply.availableCount, 7);
  assert.equal(supply.status, 'sufficient');

  const stability = await invoke('get_intervention_stability', { verificationId: 'verification-1' });
  assert.equal(stability.currentPhase, 'retention');
  assert.equal(stability.stabilityStatus, 'pending');
  assert.equal(stability.phases[2].phase, 'transfer');
  assert.equal(stability.nextDueAt, '2099-09-13T08:01:00.000Z');

  const userQueries = seen.filter((entry) => [
    'studentProfile.findUnique', 'studyAvailabilityPreference.findFirst', 'studentScoreGoal.findFirst',
    'userCscaTopicMastery.findMany', 'cscaWrongPattern.findMany', 'mockExamAttempt.findMany',
    'learningInterventionVerification.findFirst'
  ].includes(entry.name));
  assert.ok(userQueries.length >= 7);
  assert.ok(userQueries.every((entry) => entry.args.where.userId === 42), 'all user-owned reads must constrain actorUserId in the database query');

  const foreignStability = await registry.invoke('get_intervention_stability', { ...context, actorUserId: 99 }, { verificationId: 'verification-1' });
  assert.equal(foreignStability.ok, false);
  assert.equal(foreignStability.error.code, 'RESOURCE_NOT_FOUND');

  const denied = await registry.invoke('get_learning_profile', { ...context, grantedScopes: [] }, {});
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'AUTHORIZATION_DENIED');

  const invalid = await registry.invoke('get_subject_mastery', context, { subject: 'biology', userId: 99 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'VALIDATION_ERROR');

  const unknown = await registry.invoke('raw_database_query', context, {});
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.code, 'RESOURCE_NOT_FOUND');

  const shadowDisabled = await registry.invoke('get_target_gap', context, {});
  assert.equal(shadowDisabled.ok, false);
  assert.equal(shadowDisabled.error.code, 'TOOL_UNAVAILABLE');

  const readinessDisabled = await registry.invoke('get_score_readiness', context, {});
  assert.equal(readinessDisabled.ok, false);
  assert.equal(readinessDisabled.error.code, 'TOOL_UNAVAILABLE');

  const readinessCapability = new LearningReadCapabilityService(prisma, undefined, {
    async getScoreReadiness(userId) {
      assert.equal(userId, 42);
      return {
        status: 'ready', visibility: 'shadow', forecasts: [{
          schemaVersion: '1', forecastId: 'forecast-1', goalId: 'goal-1', userId: 42,
          subjectCode: 'math', targetScore: 95, readinessState: 'insufficient',
          versions: {
            goalVersion: 'goal:g1:v2', availabilityVersion: 'availability:v3', evidenceVersion: 'evidence:e1',
            learningStateVersion: 'state:s1', learningModelVersion: 'ls-v1-shadow-model-1',
            syllabusVersion: 'syllabus:v1', scoringPolicyVersion: 'csca-2027-v1',
            itemCalibrationVersion: 'not-enabled', decisionPolicyVersion: 'ls-v1-prescription-rules-2',
            decisionContextVersion: 'context:c1', forecastModelVersion: 'score-readiness-shadow-gate-v1'
          },
          expectedScoreBand: null, targetAttainmentProbability: null, confidence: 'insufficient',
          reasonCodes: ['FORECAST_MODEL_NOT_CALIBRATED'], nextValidationAction: 'diagnostic',
          evidenceCutoffAt: now.toISOString(), createdAt: now.toISOString()
        }]
      };
    }
  });
  const readinessRegistry = new LearningCapabilityRegistryService(readinessCapability, new LearningIntelligenceFeatureFlagsService({
    CSCA_AGENT_FOUNDATION_ENABLED: 'true', CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
    CSCA_TARGET_GAP_ENABLED: 'true', CSCA_LEARNING_PRESCRIPTION_ENABLED: 'true', CSCA_SCORE_READINESS_ENABLED: 'true'
  }));
  const readiness = await readinessRegistry.invoke('get_score_readiness', context, {});
  assert.equal(readiness.ok, true);
  assert.equal(readiness.data.forecasts[0].expectedScoreBand, null);
  assert.equal(readiness.data.forecasts[0].targetAttainmentProbability, null);

  const disabledRegistry = new LearningCapabilityRegistryService(
    service,
    new LearningIntelligenceFeatureFlagsService({ CSCA_AGENT_FOUNDATION_ENABLED: 'false' })
  );
  const disabled = await disabledRegistry.invoke('get_learning_profile', context, {});
  assert.equal(disabled.ok, false);
  assert.equal(disabled.error.code, 'TOOL_UNAVAILABLE');

  console.log('LEARNING_CAPABILITY_FACADE_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
