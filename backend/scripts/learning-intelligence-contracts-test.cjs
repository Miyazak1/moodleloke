const assert = require('node:assert/strict');

const contracts = require('../dist/backend/src/learning-intelligence/contracts/learning-intelligence.contracts.js');
const { LearningIntelligenceFeatureFlagsService } = require('../dist/backend/src/learning-intelligence/learning-intelligence-feature-flags.service.js');
const fixtures = require('../dist/backend/src/learning-intelligence/testing/fixtures.js');

contracts.LearningEvidenceEventV1Schema.parse(fixtures.fixedLearningEvidenceEvent);
contracts.UpdateScoreGoalInputV1Schema.parse(fixtures.fixedScoreGoalInput);
contracts.UpdateStudyAvailabilityInputV1Schema.parse(fixtures.fixedAvailabilityInput);
contracts.LearningPrescriptionV1Schema.parse(fixtures.fixedLearningPrescription);
contracts.ScoreReadinessForecastV1Schema.parse({
  schemaVersion: '1', forecastId: 'forecast-1', goalId: 'goal-1', userId: 1001,
  subjectCode: 'chemistry', targetScore: 85, readinessState: 'insufficient',
  versions: fixtures.fixedDecisionVersions, expectedScoreBand: null, targetAttainmentProbability: null,
  confidence: 'insufficient', reasonCodes: ['FORECAST_MODEL_NOT_CALIBRATED'],
  nextValidationAction: 'diagnostic', evidenceCutoffAt: '2026-09-12T08:00:00.000Z', createdAt: '2026-09-12T08:00:02.000Z'
});

assert.throws(() => contracts.ScoreReadinessForecastV1Schema.parse({
  schemaVersion: '1', forecastId: 'forecast-invalid', goalId: 'goal-1', userId: 1001,
  subjectCode: 'chemistry', targetScore: 85, readinessState: 'insufficient',
  versions: fixtures.fixedDecisionVersions, expectedScoreBand: { low: 70, central: 80, high: 90 },
  targetAttainmentProbability: 0.8, confidence: 'insufficient', reasonCodes: ['EVIDENCE_INSUFFICIENT'],
  evidenceCutoffAt: '2026-09-12T08:00:00.000Z', createdAt: '2026-09-12T08:00:02.000Z'
}), /cannot produce a score band/);

assert.throws(() => contracts.UpdateScoreGoalInputV1Schema.parse({
  ...fixtures.fixedScoreGoalInput,
  subjectGoals: [
    ...fixtures.fixedScoreGoalInput.subjectGoals,
    ...fixtures.fixedScoreGoalInput.subjectGoals
  ]
}), /Duplicate subject goal/);

assert.throws(() => contracts.LearningEvidenceEventV1Schema.parse({
  ...fixtures.fixedLearningEvidenceEvent,
  subjectCode: 'biology'
}));

const defaults = new LearningIntelligenceFeatureFlagsService({});
assert.deepEqual(defaults.snapshot(), {
  foundation: false,
  evidenceWrite: false,
  shadowProjection: false,
  targetGap: false,
  prescription: false,
  interventionShadow: false,
  interventionDelivery: false,
  interventionVerification: false,
  scoreReadiness: false
});

const gated = new LearningIntelligenceFeatureFlagsService({
  CSCA_LEARNING_EVIDENCE_WRITE_ENABLED: 'true'
});
assert.equal(gated.isEnabled('evidenceWrite'), false, 'child flags require the foundation flag');

const enabled = new LearningIntelligenceFeatureFlagsService({
  CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_EVIDENCE_WRITE_ENABLED: 'true'
});
assert.equal(enabled.isEnabled('evidenceWrite'), true);
assert.equal(enabled.isEnabled('scoreReadiness'), false);
assert.equal(enabled.isEnabled('interventionShadow'), false, 'Intervention Shadow requires projection and its own flag');

const interventionEnabled = new LearningIntelligenceFeatureFlagsService({
  CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED: 'true'
});
assert.equal(interventionEnabled.isEnabled('interventionShadow'), true);
assert.equal(interventionEnabled.isEnabled('interventionDelivery'), false, 'Delivery requires its own flag');

const deliveryEnabled = new LearningIntelligenceFeatureFlagsService({
  CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED: 'true'
});
assert.equal(deliveryEnabled.isEnabled('interventionDelivery'), true);
assert.equal(deliveryEnabled.isEnabled('interventionVerification'), false, 'Verification requires its own flag');

const verificationEnabled = new LearningIntelligenceFeatureFlagsService({
  CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED: 'true',
  CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED: 'true'
});
assert.equal(verificationEnabled.isEnabled('interventionVerification'), true);

const incompleteDecisionFlags = new LearningIntelligenceFeatureFlagsService({
  CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_TARGET_GAP_ENABLED: 'true',
  CSCA_LEARNING_PRESCRIPTION_ENABLED: 'true'
});
assert.equal(incompleteDecisionFlags.isEnabled('targetGap'), false, 'Target Gap requires Shadow Projection');
assert.equal(incompleteDecisionFlags.isEnabled('prescription'), false, 'Prescription requires Target Gap');

const incompleteReadinessFlags = new LearningIntelligenceFeatureFlagsService({
  CSCA_AGENT_FOUNDATION_ENABLED: 'true',
  CSCA_LEARNING_SHADOW_PROJECTION_ENABLED: 'true',
  CSCA_TARGET_GAP_ENABLED: 'true',
  CSCA_SCORE_READINESS_ENABLED: 'true'
});
assert.equal(incompleteReadinessFlags.isEnabled('scoreReadiness'), false, 'Score Readiness requires Learning Prescription');

console.log('LEARNING_INTELLIGENCE_CONTRACTS_OK');
