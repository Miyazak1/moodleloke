import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CscaSubjectCodeSchema } from '../contracts/learning-intelligence.contracts';

export const ITEM_CALIBRATION_POLICY_VERSION = 'item-calibration-policy-v1';
export const FORECAST_CALIBRATION_POLICY_VERSION = 'forecast-calibration-policy-v1';

export const ITEM_CALIBRATION_THRESHOLDS = Object.freeze({
  minimumSampleCount: 500,
  minimumHoldoutSampleCount: 100,
  minimumItemCount: 10,
  minimumObservationsPerItem: 20,
  minimumMedianDiscrimination: 0.1,
  maximumLowDiscriminationShare: 0.2,
  maximumMeanDifficultyDrift: 0.15
});

export const FORECAST_CALIBRATION_THRESHOLDS = Object.freeze({
  minimumHoldoutSampleCount: 300,
  minimumSubgroupSampleCount: 30,
  nominalIntervalCoverage: 0.9,
  intervalCoverageTolerance: 0.05,
  maximumNormalizedMae: 0.12,
  maximumExpectedCalibrationError: 0.08,
  maximumSubgroupNormalizedMae: 0.16,
  maximumSubgroupCalibrationError: 0.12,
  maximumMaeDrift: 0.03,
  maximumCalibrationErrorDrift: 0.03
});

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

export const ItemCalibrationInputSchema = z.strictObject({
  calibrationVersion: z.string().min(1).max(100),
  examSystemCode: z.string().min(1).max(40),
  subjectCode: CscaSubjectCodeSchema,
  itemBankVersion: z.string().min(1).max(100),
  dataWindowStart: z.iso.datetime(),
  dataWindowEnd: z.iso.datetime(),
  sourceDatasetHash: Sha256Schema,
  observations: z.array(z.strictObject({
    observationId: z.string().min(1).max(120),
    learnerKeyHash: Sha256Schema,
    itemId: z.string().min(1).max(120),
    split: z.enum(['calibration', 'holdout']),
    outcome: z.enum(['correct', 'incorrect']),
    sourceType: z.enum(['diagnostic', 'mock_exam']),
    exposureState: z.literal('prompt_seen'),
    firstAttempt: z.literal(true),
    usedHint: z.literal(false),
    usedExplanation: z.literal(false),
    questionQualityConfidence: z.number().min(0.8).max(1)
  })).min(1).max(100_000)
}).superRefine((value, context) => {
  if (new Date(value.dataWindowEnd) < new Date(value.dataWindowStart)) {
    context.addIssue({ code: 'custom', path: ['dataWindowEnd'], message: 'Data window end must not precede start.' });
  }
  if (new Set(value.observations.map((item) => item.observationId)).size !== value.observations.length) {
    context.addIssue({ code: 'custom', path: ['observations'], message: 'Observation IDs must be unique.' });
  }
  const businessKeys = value.observations.map((item) => `${item.learnerKeyHash}:${item.itemId}:${item.split}`);
  if (new Set(businessKeys).size !== businessKeys.length) {
    context.addIssue({ code: 'custom', path: ['observations'], message: 'A learner-item pair may appear only once in each split.' });
  }
});

export const ForecastCalibrationInputSchema = z.strictObject({
  calibrationVersion: z.string().min(1).max(100),
  examSystemCode: z.string().min(1).max(40),
  subjectCode: CscaSubjectCodeSchema,
  languageCode: z.string().min(1).max(16).nullable().optional(),
  examFormCode: z.string().min(1).max(80).nullable().optional(),
  forecastModelVersion: z.string().min(1).max(100),
  scoringPolicyVersion: z.string().min(1).max(80),
  itemCalibrationVersion: z.string().min(1).max(100),
  outcomeSource: z.enum(['verified_csca_exam', 'timed_mock_proxy']),
  scoreMinimum: z.number(),
  scoreMaximum: z.number(),
  dataWindowStart: z.iso.datetime(),
  dataWindowEnd: z.iso.datetime(),
  sourceDatasetHash: Sha256Schema,
  baselineMetrics: z.strictObject({
    normalizedMae: z.number().min(0),
    expectedCalibrationError: z.number().min(0).max(1)
  }).nullable(),
  rows: z.array(z.strictObject({
    rowId: z.string().min(1).max(120),
    learnerKeyHash: Sha256Schema,
    split: z.literal('holdout'),
    actualScore: z.number(),
    predictedLow: z.number(),
    predictedCentral: z.number(),
    predictedHigh: z.number(),
    targetScore: z.number(),
    predictedAttainmentProbability: z.number().min(0).max(1),
    targetAttained: z.boolean(),
    stratum: z.string().min(1).max(80)
  })).min(1).max(100_000)
}).superRefine((value, context) => {
  if (value.scoreMaximum <= value.scoreMinimum) {
    context.addIssue({ code: 'custom', path: ['scoreMaximum'], message: 'Score maximum must exceed minimum.' });
  }
  if (new Date(value.dataWindowEnd) < new Date(value.dataWindowStart)) {
    context.addIssue({ code: 'custom', path: ['dataWindowEnd'], message: 'Data window end must not precede start.' });
  }
  if (new Set(value.rows.map((row) => row.rowId)).size !== value.rows.length) {
    context.addIssue({ code: 'custom', path: ['rows'], message: 'Row IDs must be unique.' });
  }
  if (new Set(value.rows.map((row) => row.learnerKeyHash)).size !== value.rows.length) {
    context.addIssue({ code: 'custom', path: ['rows'], message: 'Holdout rows must contain one result per learner.' });
  }
  value.rows.forEach((row, index) => {
    if (!(row.predictedLow <= row.predictedCentral && row.predictedCentral <= row.predictedHigh)) {
      context.addIssue({ code: 'custom', path: ['rows', index], message: 'Prediction interval must be ordered.' });
    }
    const scores = [row.actualScore, row.predictedLow, row.predictedCentral, row.predictedHigh, row.targetScore];
    if (scores.some((score) => score < value.scoreMinimum || score > value.scoreMaximum)) {
      context.addIssue({ code: 'custom', path: ['rows', index], message: 'Scores must be within the declared scoring scale.' });
    }
    if (row.targetAttained !== (row.actualScore >= row.targetScore)) {
      context.addIssue({ code: 'custom', path: ['rows', index, 'targetAttained'], message: 'Attainment label contradicts actual and target scores.' });
    }
  });
});

export type ItemCalibrationInput = z.infer<typeof ItemCalibrationInputSchema>;
export type ForecastCalibrationInput = z.infer<typeof ForecastCalibrationInputSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function correlation(xs: number[], ys: number[]): number {
  if (xs.length < 2 || xs.length !== ys.length) return 0;
  const xMean = mean(xs);
  const yMean = mean(ys);
  const numerator = xs.reduce((sum, value, index) => sum + (value - xMean) * (ys[index] - yMean), 0);
  const denominator = Math.sqrt(
    xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0)
    * ys.reduce((sum, value) => sum + (value - yMean) ** 2, 0)
  );
  return denominator ? numerator / denominator : 0;
}

export function buildItemCalibrationArtifact(
  rawInput: unknown,
  thresholds = ITEM_CALIBRATION_THRESHOLDS
) {
  const parsedInput = ItemCalibrationInputSchema.parse(rawInput);
  const input = { ...parsedInput, observations: [...parsedInput.observations]
    .sort((left, right) => left.observationId.localeCompare(right.observationId)) };
  const learnerSplits = new Map<string, Set<string>>();
  const learnerScores = new Map<string, Map<string, number>>();
  const byItem = new Map<string, ItemCalibrationInput['observations']>();
  for (const observation of input.observations) {
    if (!learnerSplits.has(observation.learnerKeyHash)) learnerSplits.set(observation.learnerKeyHash, new Set());
    learnerSplits.get(observation.learnerKeyHash)!.add(observation.split);
    if (!learnerScores.has(observation.learnerKeyHash)) learnerScores.set(observation.learnerKeyHash, new Map());
    learnerScores.get(observation.learnerKeyHash)!.set(observation.itemId, observation.outcome === 'correct' ? 1 : 0);
    if (!byItem.has(observation.itemId)) byItem.set(observation.itemId, []);
    byItem.get(observation.itemId)!.push(observation);
  }
  const splitLeakageLearnerCount = [...learnerSplits.values()].filter((splits) => splits.size > 1).length;
  const itemMetrics = [...byItem.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([itemId, rows]) => {
    const calibrationRows = rows.filter((row) => row.split === 'calibration');
    const holdoutRows = rows.filter((row) => row.split === 'holdout');
    const scores = calibrationRows.map((row) => row.outcome === 'correct' ? 1 : 0);
    const abilityProxy = calibrationRows.map((row) => {
      const learner = learnerScores.get(row.learnerKeyHash)!;
      const otherScores = [...learner.entries()].filter(([candidateId]) => candidateId !== itemId).map(([, score]) => score);
      return mean(otherScores);
    });
    const calibrationDifficulty = mean(calibrationRows.map((row) => row.outcome === 'correct' ? 1 : 0));
    const holdoutDifficulty = mean(holdoutRows.map((row) => row.outcome === 'correct' ? 1 : 0));
    return {
      itemId,
      observationCount: rows.length,
      calibrationCount: calibrationRows.length,
      holdoutCount: holdoutRows.length,
      difficulty: mean(rows.map((row) => row.outcome === 'correct' ? 1 : 0)),
      discrimination: correlation(scores, abilityProxy),
      difficultyDrift: calibrationRows.length && holdoutRows.length
        ? Math.abs(calibrationDifficulty - holdoutDifficulty)
        : 1
    };
  });
  const discriminations = itemMetrics.map((item) => item.discrimination);
  const criteriaResults = {
    sampleCount: input.observations.length >= thresholds.minimumSampleCount,
    holdoutSampleCount: input.observations.filter((item) => item.split === 'holdout').length >= thresholds.minimumHoldoutSampleCount,
    itemCount: itemMetrics.length >= thresholds.minimumItemCount,
    observationsPerItem: itemMetrics.every((item) => item.observationCount >= thresholds.minimumObservationsPerItem),
    learnerSplitIsolation: splitLeakageLearnerCount === 0,
    medianDiscrimination: median(discriminations) >= thresholds.minimumMedianDiscrimination,
    lowDiscriminationShare: itemMetrics.filter((item) => item.discrimination < thresholds.minimumMedianDiscrimination).length
      / Math.max(1, itemMetrics.length) <= thresholds.maximumLowDiscriminationShare,
    difficultyDrift: mean(itemMetrics.map((item) => item.difficultyDrift)) <= thresholds.maximumMeanDifficultyDrift
  };
  const payload = {
    policyVersion: ITEM_CALIBRATION_POLICY_VERSION,
    sourceDatasetHash: input.sourceDatasetHash,
    metrics: {
      sampleCount: input.observations.length,
      holdoutSampleCount: input.observations.filter((item) => item.split === 'holdout').length,
      itemCount: itemMetrics.length,
      splitLeakageLearnerCount,
      medianDiscrimination: median(discriminations),
      lowDiscriminationShare: itemMetrics.filter((item) => item.discrimination < thresholds.minimumMedianDiscrimination).length / Math.max(1, itemMetrics.length),
      meanDifficultyDrift: mean(itemMetrics.map((item) => item.difficultyDrift)),
      itemMetrics
    },
    releaseCriteria: thresholds,
    criteriaResults,
    allCriteriaPassed: Object.values(criteriaResults).every(Boolean)
  };
  return { ...input, observations: undefined, ...payload, artifactHash: sha256({ input, payload }) };
}

function forecastMetrics(rows: ForecastCalibrationInput['rows'], scale: number) {
  const normalizedMae = mean(rows.map((row) => Math.abs(row.actualScore - row.predictedCentral))) / scale;
  const intervalCoverage = mean(rows.map((row) => row.actualScore >= row.predictedLow && row.actualScore <= row.predictedHigh ? 1 : 0));
  const brierScore = mean(rows.map((row) => (row.predictedAttainmentProbability - (row.targetAttained ? 1 : 0)) ** 2));
  const bins = Array.from({ length: 10 }, (_, index) => {
    const lower = index / 10;
    const upper = (index + 1) / 10;
    const members = rows.filter((row) => row.predictedAttainmentProbability >= lower
      && (index === 9 ? row.predictedAttainmentProbability <= upper : row.predictedAttainmentProbability < upper));
    return {
      lower, upper, count: members.length,
      predicted: mean(members.map((row) => row.predictedAttainmentProbability)),
      observed: mean(members.map((row) => row.targetAttained ? 1 : 0))
    };
  });
  const expectedCalibrationError = bins.reduce((sum, bin) =>
    sum + (bin.count / Math.max(1, rows.length)) * Math.abs(bin.predicted - bin.observed), 0);
  return { normalizedMae, intervalCoverage, brierScore, expectedCalibrationError, bins };
}

export function buildForecastCalibrationArtifact(
  rawInput: unknown,
  thresholds = FORECAST_CALIBRATION_THRESHOLDS
) {
  const parsedInput = ForecastCalibrationInputSchema.parse(rawInput);
  const input = { ...parsedInput, rows: [...parsedInput.rows]
    .sort((left, right) => left.rowId.localeCompare(right.rowId)) };
  const scale = input.scoreMaximum - input.scoreMinimum;
  const overall = forecastMetrics(input.rows, scale);
  const grouped = new Map<string, ForecastCalibrationInput['rows']>();
  input.rows.forEach((row) => {
    if (!grouped.has(row.stratum)) grouped.set(row.stratum, []);
    grouped.get(row.stratum)!.push(row);
  });
  const subgroupMetrics = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([stratum, rows]) => ({ stratum, sampleCount: rows.length, ...forecastMetrics(rows, scale) }));
  const criteriaResults = {
    verifiedOutcomeSource: input.outcomeSource === 'verified_csca_exam',
    holdoutSampleCount: input.rows.length >= thresholds.minimumHoldoutSampleCount,
    subgroupSampleCount: subgroupMetrics.every((item) => item.sampleCount >= thresholds.minimumSubgroupSampleCount),
    intervalCoverage: Math.abs(overall.intervalCoverage - thresholds.nominalIntervalCoverage) <= thresholds.intervalCoverageTolerance,
    normalizedMae: overall.normalizedMae <= thresholds.maximumNormalizedMae,
    expectedCalibrationError: overall.expectedCalibrationError <= thresholds.maximumExpectedCalibrationError,
    subgroupNormalizedMae: subgroupMetrics.every((item) => item.normalizedMae <= thresholds.maximumSubgroupNormalizedMae),
    subgroupCalibrationError: subgroupMetrics.every((item) => item.expectedCalibrationError <= thresholds.maximumSubgroupCalibrationError),
    baselinePresent: input.baselineMetrics !== null,
    maeDrift: input.baselineMetrics !== null
      && overall.normalizedMae - input.baselineMetrics.normalizedMae <= thresholds.maximumMaeDrift,
    calibrationErrorDrift: input.baselineMetrics !== null
      && overall.expectedCalibrationError - input.baselineMetrics.expectedCalibrationError <= thresholds.maximumCalibrationErrorDrift
  };
  const payload = {
    policyVersion: FORECAST_CALIBRATION_POLICY_VERSION,
    sourceDatasetHash: input.sourceDatasetHash,
    metrics: overall,
    subgroupMetrics,
    releaseCriteria: thresholds,
    criteriaResults,
    allCriteriaPassed: Object.values(criteriaResults).every(Boolean)
  };
  return { ...input, rows: undefined, ...payload, artifactHash: sha256({ input, payload }) };
}
