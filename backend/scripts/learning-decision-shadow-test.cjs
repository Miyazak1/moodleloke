const assert = require('node:assert/strict');
const {
  buildLearningPrescription,
  buildTargetGapSnapshot,
  computeTargetGaps
} = require('../dist/backend/src/learning-intelligence/decision/learning-decision.model');
const { LearningDecisionService } = require('../dist/backend/src/learning-intelligence/decision/learning-decision.service');
const { LearningIntelligenceFeatureFlagsService } = require('../dist/backend/src/learning-intelligence/learning-intelligence-feature-flags.service');
const { LearningReadCapabilityService } = require('../dist/backend/src/learning-intelligence/capabilities/learning-read-capability.service');
const { LearningCapabilityRegistryService } = require('../dist/backend/src/learning-intelligence/capabilities/learning-capability-registry.service');

const now = new Date('2026-09-13T08:00:00.000Z');
const versions = {
  goalVersion: 'goal:g1:v1', availabilityVersion: 'availability:v1', evidenceVersion: 'evidence:e1',
  learningStateVersion: 'state:s1', learningModelVersion: 'ls-v1-shadow-model-1',
  syllabusVersion: 'syllabus:chem-v1', scoringPolicyVersion: 'score-provisional-v1',
  itemCalibrationVersion: 'not-enabled', decisionPolicyVersion: 'ls-v1-prescription-rules-2',
  decisionContextVersion: 'context:c1', forecastModelVersion: 'score-readiness-shadow-gate-v1'
};

function pureInput(overrides = {}) {
  return {
    userId: 42,
    goalId: 'goal-1',
    examDate: new Date('2027-03-01T00:00:00.000Z'),
    subjectPriorities: [{ subject: 'chemistry', priority: 1 }],
    topics: [{
      topicId: 11, subject: 'chemistry', mastery: 0.25, confidence: 0.8, independence: 0.45,
      difficultyCeiling: 'foundation', retention: 0.7, fluency: 0.65, transfer: 0.6,
      evidenceCount: 6, incorrectCount: 3, stateVersion: 'state-6',
      stateEventSequence: 6n
    }],
    dueReviewTopicIds: [],
    recentMockSubjects: [],
    interventionSignals: [],
    defaultSessionMinutes: 15,
    versions,
    evidenceCutoffAt: new Date('2026-09-13T07:55:00.000Z'),
    generatedAt: now,
    versionHash: 'a'.repeat(64),
    ...overrides
  };
}

function testPureRules() {
  const input = pureInput();
  const gaps = computeTargetGaps(input);
  assert.equal(gaps[0].type, 'mastery');
  assert.equal(gaps[0].recommendedAction, 'concept_learning', 'repeated misconception must switch from more questions to teaching');
  assert.equal(gaps[0].estimatedScoreImpact, null, 'uncalibrated shadow rules must not invent score impact');
  const prescription = buildLearningPrescription(input, gaps);
  assert.equal(prescription.tasks[0].type, 'concept_learning');
  assert.equal(prescription.versions.forecastModelVersion, 'score-readiness-shadow-gate-v1');
  assert.deepEqual(buildTargetGapSnapshot(input), buildTargetGapSnapshot(input), 'same frozen input must replay deterministically');

  const cold = computeTargetGaps(pureInput({
    topics: [{ ...input.topics[0], mastery: null, confidence: 0, evidenceCount: 0, incorrectCount: 0 }]
  }));
  assert.equal(cold[0].recommendedAction, 'diagnostic');
  assert.ok(cold[0].reasonCodes.includes('EVIDENCE_INSUFFICIENT'));

  const review = computeTargetGaps(pureInput({
    dueReviewTopicIds: [11],
    topics: [{ ...input.topics[0], mastery: 0.8, incorrectCount: 0, retention: 0.45 }]
  }));
  assert.equal(review[0].recommendedAction, 'review');

  const dueInput = pureInput({
    interventionSignals: [{
      assessmentId: 'assessment-due', deliveryId: 'delivery-due', subject: 'chemistry', topicId: 11,
      kind: 'verification_due', phase: 'retention', verificationId: 'verification-retention',
      dueAt: new Date('2026-09-13T07:00:00.000Z'), effectiveAt: new Date('2026-09-13T07:00:00.000Z'), evidenceSequence: null, evidenceTrusted: true, supplyGap: false
    }]
  });
  const dueGaps = computeTargetGaps(dueInput);
  assert.equal(dueGaps[0].recommendedAction, 'intervention_verification');
  assert.equal(dueGaps[0].interventionVerificationId, 'verification-retention');
  assert.equal(buildLearningPrescription(dueInput, dueGaps).tasks[0].interventionVerificationPhase, 'retention');

  const stable = computeTargetGaps(pureInput({
    topics: [{ ...input.topics[0], mastery: 0.3, retention: 0.2, transfer: 0.2, incorrectCount: 4 }],
    interventionSignals: [{
      assessmentId: 'assessment-stable', deliveryId: 'delivery-stable', subject: 'chemistry', topicId: 11,
      kind: 'stable', phase: 'transfer', verificationId: null, dueAt: null,
      effectiveAt: new Date('2026-09-13T07:59:00.000Z'), evidenceSequence: 6n, evidenceTrusted: true, supplyGap: false
    }]
  }));
  assert.equal(stable.some((item) => item.topicIds.includes(11) && ['mastery', 'retention', 'transfer'].includes(item.type)), false,
    'current stable evidence must suppress repetitive mastery/retention/transfer gaps');

  const staleStable = computeTargetGaps(pureInput({
    topics: [{ ...input.topics[0], stateEventSequence: 7n }],
    interventionSignals: [{
      assessmentId: 'assessment-old', deliveryId: 'delivery-old', subject: 'chemistry', topicId: 11,
      kind: 'stable', phase: 'transfer', verificationId: null, dueAt: null,
      effectiveAt: new Date('2026-09-13T07:59:00.000Z'), evidenceSequence: 6n, evidenceTrusted: true, supplyGap: false
    }]
  }));
  assert.equal(staleStable[0].type, 'mastery', 'newer topic evidence must supersede an older stable assessment');

  const notStable = computeTargetGaps(pureInput({ interventionSignals: [{
    assessmentId: 'assessment-failed', deliveryId: 'delivery-failed', subject: 'chemistry', topicId: 11,
    kind: 'not_stable', phase: 'retention', verificationId: null, dueAt: null,
    effectiveAt: new Date('2026-09-13T07:59:00.000Z'), evidenceSequence: 6n, evidenceTrusted: true, supplyGap: false
  }] }));
  assert.equal(notStable[0].recommendedAction, 'review');
  assert.ok(notStable[0].reasonCodes.includes('INTERVENTION_NOT_STABLE'));

  const inconclusive = computeTargetGaps(pureInput({ interventionSignals: [{
    assessmentId: 'assessment-unclear', deliveryId: 'delivery-unclear', subject: 'chemistry', topicId: 11,
    kind: 'inconclusive', phase: 'immediate', verificationId: null, dueAt: null,
    effectiveAt: new Date('2026-09-13T07:59:00.000Z'), evidenceSequence: 6n, evidenceTrusted: true, supplyGap: false
  }] }));
  assert.equal(inconclusive[0].recommendedAction, 'diagnostic');
  assert.ok(inconclusive[0].reasonCodes.includes('INTERVENTION_EVIDENCE_INCONCLUSIVE'));

  const supplyGap = computeTargetGaps(pureInput({ interventionSignals: [{
    assessmentId: 'assessment-supply-gap', deliveryId: 'delivery-supply-gap', subject: 'chemistry', topicId: 11,
    kind: 'inconclusive', phase: 'transfer', verificationId: null, dueAt: null,
    effectiveAt: new Date('2026-09-13T07:59:00.000Z'), evidenceSequence: 6n, evidenceTrusted: true, supplyGap: true
  }] }));
  assert.equal(supplyGap.some((item) => item.reasonCodes.includes('INTERVENTION_EVIDENCE_INCONCLUSIVE')), false,
    'a recorded supply gap must not create a futile immediate diagnostic task');
  assert.equal(supplyGap[0].recommendedAction, 'concept_learning');

  const newestConclusionWins = computeTargetGaps(pureInput({ interventionSignals: [
    {
      assessmentId: 'assessment-old-failure', deliveryId: 'delivery-old-failure', subject: 'chemistry', topicId: 11,
      kind: 'not_stable', phase: 'immediate', verificationId: null, dueAt: null,
      effectiveAt: new Date('2026-09-13T07:55:00.000Z'), evidenceSequence: 6n, evidenceTrusted: true, supplyGap: false
    },
    {
      assessmentId: 'assessment-new-stable', deliveryId: 'delivery-new-stable', subject: 'chemistry', topicId: 11,
      kind: 'stable', phase: 'transfer', verificationId: null, dueAt: null,
      effectiveAt: new Date('2026-09-13T07:59:00.000Z'), evidenceSequence: 6n, evidenceTrusted: true, supplyGap: false
    }
  ] }));
  assert.equal(newestConclusionWins.some((item) => item.reasonCodes.includes('INTERVENTION_NOT_STABLE')), false,
    'the newest final assessment must supersede an older intervention chain conclusion');

  const future = computeTargetGaps(pureInput({ interventionSignals: [{
    assessmentId: 'assessment-future', deliveryId: 'delivery-future', subject: 'chemistry', topicId: 11,
    kind: 'verification_scheduled', phase: 'retention', verificationId: 'verification-future',
    dueAt: new Date('2026-09-14T08:00:00.000Z'), effectiveAt: now, evidenceSequence: null, evidenceTrusted: true, supplyGap: false
  }] }));
  assert.equal(future.some((item) => item.recommendedAction === 'intervention_verification'), false,
    'future verification must not block today\'s normal learning task');

  const untrustedDue = computeTargetGaps(pureInput({ interventionSignals: [{
    assessmentId: 'assessment-retracted', deliveryId: 'delivery-retracted', subject: 'chemistry', topicId: 11,
    kind: 'verification_due', phase: 'retention', verificationId: 'verification-retracted',
    dueAt: new Date('2026-09-13T07:00:00.000Z'), effectiveAt: now,
    evidenceSequence: null, evidenceTrusted: false, supplyGap: false
  }] }));
  assert.equal(untrustedDue.some((item) => item.interventionVerificationId === 'verification-retracted'), false,
    'a due verification backed by retracted evidence must not be scheduled');

  const competingDue = computeTargetGaps(pureInput({
    interventionSignals: [
      {
        assessmentId: 'assessment-newer-chain', deliveryId: 'delivery-newer-chain', subject: 'chemistry', topicId: 11,
        kind: 'verification_due', phase: 'transfer', verificationId: 'verification-newer-chain',
        dueAt: new Date('2026-09-13T07:30:00.000Z'), effectiveAt: new Date('2026-09-13T07:30:00.000Z'), evidenceSequence: null, evidenceTrusted: true, supplyGap: false
      },
      {
        assessmentId: 'assessment-older-chain', deliveryId: 'delivery-older-chain', subject: 'chemistry', topicId: 11,
        kind: 'verification_due', phase: 'retention', verificationId: 'verification-older-chain',
        dueAt: new Date('2026-09-13T06:30:00.000Z'), effectiveAt: new Date('2026-09-13T06:30:00.000Z'), evidenceSequence: null, evidenceTrusted: true, supplyGap: false
      }
    ]
  }));
  assert.equal(competingDue.filter((item) => item.recommendedAction === 'intervention_verification').length, 1,
    'multiple intervention chains must not create duplicate due tasks for one topic');
  assert.equal(competingDue[0].interventionVerificationId, 'verification-older-chain',
    'the earliest overdue verification must win deterministically');
}

function fakeStore() {
  const calls = [];
  const gaps = new Map();
  const prescriptions = new Map();
  let current = null;
  let eventSequence = 6n;
  let checkpointSequence = 6n;
  let checkpointVersion = 'ls-v1-shadow-model-1:42:chemistry:6';
  let interventionAssessments = [];
  let assessmentEvidenceEvents = [];
  const rowKey = (data) => `${data.userId}:${data.goalId}:${data.versionHash}`;
  const tx = {
    $executeRaw: async () => 1,
    studentScoreGoal: { findFirst: async (args) => {
      calls.push(['studentScoreGoal', args]);
      return {
        id: 'goal-1', userId: 42, version: 1, status: 'active', examDate: new Date('2027-03-01T00:00:00.000Z'),
        availabilityVersion: 'availability:v1', scoringPolicyVersion: 'score-provisional-v1', createdAt: now,
        subjects: [{ subjectCode: 'chemistry', targetScore: 85, priority: 1 }]
      };
    } },
    studyAvailabilityPreference: { findFirst: async (args) => {
      calls.push(['availability', args]);
      return { userId: 42, version: 1, status: 'active', defaultSessionMinutes: 15 };
    } },
    cscaSyllabusImport: { findMany: async () => [{ id: 2, subject: 'chemistry', syllabusVersion: 'chem-v1', appliedAt: now }] },
    cscaExamTopic: { findMany: async () => [
      { id: 11, subject: 'chemistry', syllabusVersion: 'chem-v1', updatedAt: now },
      { id: 12, subject: 'chemistry', syllabusVersion: 'chem-v1', updatedAt: now }
    ] },
    learningStateProjectionCheckpoint: { findMany: async (args) => {
      calls.push(['checkpoint', args]);
      return [{ userId: 42, subjectCode: 'chemistry', lastEventSequence: checkpointSequence, lastEvidenceVersion: checkpointVersion }];
    } },
    userCscaTopicStateV2: { findMany: async (args) => {
      calls.push(['state', args]);
      return [{
        topicId: 11, subjectCode: 'chemistry', stateVersion: checkpointVersion, mastery: 0.2, confidence: 0.8,
        independence: 0.4, difficultyCeiling: 'foundation', retention: 0.7, fluency: 0.65, transfer: 0.6,
        evidenceCount: 6, misconceptionState: { incorrectCount: 3 }
      }];
    } },
    cscaWrongPattern: { findMany: async (args) => { calls.push(['review', args]); return []; } },
    mockExamAttempt: { findMany: async (args) => { calls.push(['mock', args]); return []; } },
    learningInterventionStabilityAssessment: { findMany: async (args) => { calls.push(['intervention', args]); return interventionAssessments; } },
    learningEvidenceEvent: {
      findFirst: async (args) => {
        calls.push(['evidence', args]);
        return { eventSequence, occurredAt: new Date('2026-09-13T07:55:00.000Z') };
      },
      findMany: async (args) => {
        calls.push(['assessmentEvidence', args]);
        return assessmentEvidenceEvents.filter((item) => args.where.id.in.includes(item.id));
      }
    },
    targetGapSnapshot: { upsert: async ({ create }) => {
      const key = rowKey(create);
      if (!gaps.has(key)) gaps.set(key, { ...create });
      return gaps.get(key);
    } },
    learningPrescription: { upsert: async ({ create }) => {
      const key = rowKey(create);
      if (!prescriptions.has(key)) prescriptions.set(key, { ...create });
      return prescriptions.get(key);
    } },
    learningDecisionCurrent: {
      findFirst: async (args) => {
        calls.push(['current', args]);
        return current && current.goalId === args.where.goalId && current.userId === args.where.userId ? current : null;
      },
      create: async ({ data }) => { current = { id: 'current-1', revision: 1, ...data }; return current; },
      updateMany: async ({ where, data }) => {
        if (!current || current.goalId !== where.goalId || current.revision !== where.revision) return { count: 0 };
        current = { ...current, ...data, revision: current.revision + data.revision.increment };
        return { count: 1 };
      }
    }
  };
  return {
    prisma: { ...tx, $transaction: async (work) => work(tx) }, calls, gaps, prescriptions,
    current: () => current,
    advance: () => {
      eventSequence = 7n;
      checkpointSequence = 7n;
      checkpointVersion = 'ls-v1-shadow-model-1:42:chemistry:7';
    },
    lagProjection: () => { eventSequence = 8n; },
    setInterventionAssessment: (input) => {
      const updatedAt = new Date();
      assessmentEvidenceEvents = input.evidenceSequence === null ? [] : [{
        id: 'assessment-evidence', eventSequence: BigInt(input.evidenceSequence ?? checkpointSequence),
        retraction: input.retracted ? { id: 'retraction-1' } : null
      }];
      interventionAssessments = [{
        id: input.id ?? 'assessment-1', deliveryId: input.deliveryId ?? 'delivery-1',
        status: input.status ?? 'pending', result: input.result ?? null,
        policyVersion: 'intervention-stability-immediate-retention-transfer-v1',
        phaseResults: input.phaseResults ?? {}, evidenceRefs: assessmentEvidenceEvents.length ? [{ evidenceId: 'assessment-evidence' }] : [],
        evaluatedAt: input.evaluatedAt ?? null, updatedAt,
        intervention: { subjectCode: 'chemistry', topicId: 11 },
        delivery: { verifications: input.verification ? [{
          id: input.verification.id, phase: input.verification.phase, status: input.verification.status,
          dueAt: input.verification.dueAt, expiresAt: input.verification.expiresAt, updatedAt
        }] : [] }
      }];
    }
  };
}

async function testPersistenceIdempotencyAndOwnership() {
  const store = fakeStore();
  const flags = new LearningIntelligenceFeatureFlagsService({
    CSCA_AGENT_FOUNDATION_ENABLED: 'true',
    CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
    CSCA_TARGET_GAP_ENABLED: 'true',
    CSCA_LEARNING_PRESCRIPTION_ENABLED: 'true'
  });
  const service = new LearningDecisionService(store.prisma, flags);
  const first = await service.recompute(42);
  const repeated = await service.recompute(42);
  assert.equal(first.versionHash, repeated.versionHash);
  assert.equal(store.gaps.size, 1);
  assert.equal(store.prescriptions.size, 1);
  assert.equal(store.current().revision, 1, 'identical input must not republish or advance CAS revision');
  assert.equal(first.prescription.tasks[0].type, 'concept_learning');
  assert.ok(first.gap.gaps.some((item) => item.type === 'coverage'), 'missing syllabus evidence must remain visible');

  store.advance();
  const advanced = await service.recompute(42);
  assert.notEqual(advanced.versionHash, first.versionHash);
  assert.equal(store.current().revision, 2);
  assert.equal(store.gaps.size, 2);

  const ownedCalls = store.calls.filter(([name]) => ['studentScoreGoal', 'availability', 'checkpoint', 'state', 'review', 'mock', 'intervention', 'evidence', 'assessmentEvidence', 'current'].includes(name));
  assert.ok(ownedCalls.every(([, args]) => args.where.userId === 42), 'every user-owned decision read must constrain userId in SQL');
  assert.equal(advanced.gap.versions.decisionContextVersion.startsWith('context:'), true);

  store.setInterventionAssessment({ verification: {
    id: 'verification-clock', phase: 'retention', status: 'scheduled',
    dueAt: new Date('2026-09-14T08:00:00.000Z'), expiresAt: new Date('2026-09-15T08:00:00.000Z')
  } });
  const beforeDue = await service.loadDecisionInput(store.prisma, 42, new Date('2026-09-14T07:59:00.000Z'));
  const afterDue = await service.loadDecisionInput(store.prisma, 42, new Date('2026-09-14T08:01:00.000Z'));
  assert.notEqual(beforeDue.input.versions.decisionContextVersion, afterDue.input.versions.decisionContextVersion,
    'crossing a verification due time must change the frozen decision context without a database write');
  assert.equal(beforeDue.input.interventionSignals[0].kind, 'verification_scheduled');
  assert.equal(afterDue.input.interventionSignals[0].kind, 'verification_due');

  store.setInterventionAssessment({
    status: 'completed', result: 'stable', evaluatedAt: new Date(),
    phaseResults: { immediate: { result: 'passed' }, retention: { result: 'passed' }, transfer: { result: 'passed' } }
  });
  const stableDecision = await service.recompute(42);
  assert.notEqual(stableDecision.versionHash, advanced.versionHash, 'new stability assessment must advance the decision version');
  assert.notEqual(stableDecision.prescription.tasks[0].type, 'concept_learning', 'current stable evidence must allow progression');

  store.setInterventionAssessment({
    status: 'completed', result: 'stable', evaluatedAt: new Date(), retracted: true,
    phaseResults: { immediate: { result: 'passed' }, retention: { result: 'passed' }, transfer: { result: 'passed' } }
  });
  const retractedDecision = await service.recompute(42);
  assert.notEqual(retractedDecision.versionHash, stableDecision.versionHash,
    'retracting assessment evidence must advance the frozen decision context');
  assert.equal(retractedDecision.prescription.tasks[0].type, 'concept_learning',
    'a stability conclusion backed by retracted evidence must not suppress the current learning gap');

  store.setInterventionAssessment({ verification: {
    id: 'verification-due', phase: 'retention', status: 'scheduled',
    dueAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 86_400_000)
  } });
  const dueDecision = await service.recompute(42);
  assert.equal(dueDecision.prescription.tasks[0].type, 'intervention_verification');
  assert.equal(dueDecision.prescription.tasks[0].interventionVerificationId, 'verification-due');

  const registry = new LearningCapabilityRegistryService(new LearningReadCapabilityService(store.prisma, service), flags);
  const context = {
    requestId: 'decision-request-1', traceId: 'decision-trace-1', actorUserId: 42,
    channel: 'web_agent', locale: 'en', grantedScopes: ['learning.read']
  };
  const gapCapability = await registry.invoke('get_target_gap', context, {});
  assert.equal(gapCapability.ok, true);
  assert.equal(gapCapability.data.snapshot.userId, 42);
  const prescriptionCapability = await registry.invoke('get_learning_prescription', context, {});
  assert.equal(prescriptionCapability.ok, true);
  assert.equal(prescriptionCapability.data.goalId, 'goal-1');

  store.lagProjection();
  const updating = await registry.invoke('get_target_gap', context, {});
  assert.equal(updating.ok, true);
  assert.equal(updating.data.status, 'updating', 'stale state must not publish a new decision');
}

async function main() {
  testPureRules();
  await testPersistenceIdempotencyAndOwnership();
  console.log('LEARNING_DECISION_SHADOW_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
