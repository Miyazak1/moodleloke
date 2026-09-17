import { createHash } from 'node:crypto';
import { z } from 'zod';

export const CHEMISTRY_SCORE_SHADOW_MODEL_VERSION = 'chemistry-interpretable-scorecard-shadow-v1';
export const SCORE_PREDICTION_SHADOW_POLICY_VERSION = 'score-prediction-shadow-policy-v1';

export const SCORE_PREDICTION_SHADOW_REQUIREMENTS = Object.freeze({
  minimumTopicStateCount: 5,
  minimumIndependentEvidenceCount: 30,
  minimumAverageStateConfidence: 0.5,
  maximumStateAgeDays: 30,
  maximumTimedMockAgeDays: 45
});

const UnitSchema = z.number().min(0).max(1);

export const ChemistryScorePredictionFeatureSchema = z.strictObject({
  schemaVersion: z.literal('1'),
  userId: z.number().int().positive(),
  goalId: z.string().min(1).max(120),
  subjectCode: z.literal('chemistry'),
  targetScore: z.number(),
  scoreMinimum: z.number(),
  scoreMaximum: z.number(),
  evaluationDate: z.iso.date(),
  evidenceCutoffAt: z.iso.datetime(),
  scoringPolicyVersion: z.string().min(1).max(80),
  itemCalibrationVersion: z.string().min(1).max(100),
  modelingPrerequisiteStatus: z.enum(['blocked', 'qualified']),
  modelingPrerequisiteReasonCodes: z.array(z.string().min(1).max(80)).max(20),
  topicStateCount: z.number().int().nonnegative(),
  independentEvidenceCount: z.number().int().nonnegative(),
  averageStateConfidence: UnitSchema,
  maximumStateAgeDays: z.number().nonnegative(),
  timedMockCount: z.number().int().nonnegative(),
  latestTimedMockAgeDays: z.number().nonnegative().nullable(),
  latestTimedMockScoreNormalized: UnitSchema.nullable(),
  mastery: UnitSchema,
  coverage: UnitSchema,
  independence: UnitSchema,
  retention: UnitSchema,
  fluency: UnitSchema,
  transfer: UnitSchema,
  consistency: UnitSchema,
  sourceVersions: z.strictObject({
    learningModelVersion: z.string().min(1).max(100),
    learningStateVersionHash: z.string().regex(/^[a-f0-9]{64}$/),
    evidenceVersionHash: z.string().regex(/^[a-f0-9]{64}$/),
    mockVersionHash: z.string().regex(/^[a-f0-9]{64}$/),
    scoringPolicySourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    itemCalibrationArtifactHash: z.string().regex(/^[a-f0-9]{64}$/)
  })
}).superRefine((value, context) => {
  if (value.scoreMaximum <= value.scoreMinimum) {
    context.addIssue({ code: 'custom', path: ['scoreMaximum'], message: 'Score maximum must exceed minimum.' });
  }
  if (value.targetScore < value.scoreMinimum || value.targetScore > value.scoreMaximum) {
    context.addIssue({ code: 'custom', path: ['targetScore'], message: 'Target score must be within the scoring scale.' });
  }
  if ((value.latestTimedMockScoreNormalized === null) !== (value.latestTimedMockAgeDays === null)) {
    context.addIssue({ code: 'custom', path: ['latestTimedMockScoreNormalized'], message: 'Mock score and age must be present together.' });
  }
});

export type ChemistryScorePredictionFeature = z.infer<typeof ChemistryScorePredictionFeatureSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function scaled(normalized: number, input: ChemistryScorePredictionFeature): number {
  return input.scoreMinimum + clamp(normalized) * (input.scoreMaximum - input.scoreMinimum);
}

function interval(normalized: number, halfWidth: number, input: ChemistryScorePredictionFeature) {
  return {
    low: rounded(scaled(normalized - halfWidth, input), 2),
    central: rounded(scaled(normalized, input), 2),
    high: rounded(scaled(normalized + halfWidth, input), 2)
  };
}

function attainmentProbability(normalized: number, halfWidth: number, input: ChemistryScorePredictionFeature): number {
  const targetNormalized = (input.targetScore - input.scoreMinimum) / (input.scoreMaximum - input.scoreMinimum);
  const scale = Math.max(0.04, halfWidth / 1.645);
  return rounded(1 / (1 + Math.exp(-(normalized - targetNormalized) / scale)));
}

export function runChemistryScorePredictionShadow(rawInput: unknown) {
  const input = ChemistryScorePredictionFeatureSchema.parse(rawInput);
  const requirements = SCORE_PREDICTION_SHADOW_REQUIREMENTS;
  const blockers = [
    ...(input.modelingPrerequisiteStatus !== 'qualified'
      ? ['MODELING_PREREQUISITES_BLOCKED', ...input.modelingPrerequisiteReasonCodes] : []),
    ...(input.topicStateCount < requirements.minimumTopicStateCount ? ['TOPIC_STATE_COVERAGE_INSUFFICIENT'] : []),
    ...(input.independentEvidenceCount < requirements.minimumIndependentEvidenceCount ? ['INDEPENDENT_EVIDENCE_INSUFFICIENT'] : []),
    ...(input.averageStateConfidence < requirements.minimumAverageStateConfidence ? ['LEARNING_STATE_CONFIDENCE_INSUFFICIENT'] : []),
    ...(input.maximumStateAgeDays > requirements.maximumStateAgeDays ? ['LEARNING_STATE_STALE'] : []),
    ...(input.timedMockCount < 1 || input.latestTimedMockScoreNormalized === null ? ['TIMED_MOCK_MISSING'] : []),
    ...(input.latestTimedMockAgeDays !== null && input.latestTimedMockAgeDays > requirements.maximumTimedMockAgeDays
      ? ['TIMED_MOCK_STALE'] : [])
  ];
  const versionHash = hash({
    modelVersion: CHEMISTRY_SCORE_SHADOW_MODEL_VERSION,
    policyVersion: SCORE_PREDICTION_SHADOW_POLICY_VERSION,
    requirements,
    input
  });
  if (blockers.length) {
    return {
      schemaVersion: '1' as const,
      modelVersion: CHEMISTRY_SCORE_SHADOW_MODEL_VERSION,
      policyVersion: SCORE_PREDICTION_SHADOW_POLICY_VERSION,
      versionHash,
      status: 'blocked' as const,
      featureSnapshot: input,
      baselineOutput: null,
      candidateOutput: null,
      reasonCodes: [...new Set([...blockers, 'NUMERIC_FORECAST_RELEASE_DISABLED'])]
    };
  }

  const mock = input.latestTimedMockScoreNormalized!;
  const candidateNormalized =
    input.mastery * 0.20
    + input.coverage * 0.14
    + input.independence * 0.14
    + input.retention * 0.10
    + input.fluency * 0.10
    + input.transfer * 0.10
    + input.consistency * 0.08
    + mock * 0.14;
  const candidateHalfWidth = clamp(
    0.08 + (1 - input.averageStateConfidence) * 0.12
      + Math.min(input.latestTimedMockAgeDays! / requirements.maximumTimedMockAgeDays, 1) * 0.04,
    0.08,
    0.24
  );
  const baselineHalfWidth = 0.14;
  return {
    schemaVersion: '1' as const,
    modelVersion: CHEMISTRY_SCORE_SHADOW_MODEL_VERSION,
    policyVersion: SCORE_PREDICTION_SHADOW_POLICY_VERSION,
    versionHash,
    status: 'computed' as const,
    featureSnapshot: input,
    baselineOutput: {
      method: 'latest_timed_mock' as const,
      scoreBand: interval(mock, baselineHalfWidth, input),
      targetAttainmentProbability: attainmentProbability(mock, baselineHalfWidth, input)
    },
    candidateOutput: {
      method: 'interpretable_weighted_scorecard' as const,
      scoreBand: interval(candidateNormalized, candidateHalfWidth, input),
      targetAttainmentProbability: attainmentProbability(candidateNormalized, candidateHalfWidth, input),
      componentContributions: {
        mastery: rounded(input.mastery * 0.20),
        coverage: rounded(input.coverage * 0.14),
        independence: rounded(input.independence * 0.14),
        retention: rounded(input.retention * 0.10),
        fluency: rounded(input.fluency * 0.10),
        transfer: rounded(input.transfer * 0.10),
        consistency: rounded(input.consistency * 0.08),
        latestTimedMock: rounded(mock * 0.14)
      }
    },
    reasonCodes: ['SHADOW_ONLY', 'MODEL_UNCALIBRATED', 'NUMERIC_FORECAST_RELEASE_DISABLED']
  };
}
