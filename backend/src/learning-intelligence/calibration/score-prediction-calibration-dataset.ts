import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ForecastCalibrationInputSchema } from './score-calibration-engine';
import { CHEMISTRY_SCORE_SHADOW_MODEL_VERSION } from '../readiness/score-prediction-shadow.model';

export const SCORE_PREDICTION_DATASET_POLICY_VERSION = 'score-prediction-calibration-dataset-v1';
export const SCORE_PREDICTION_DATASET_REQUIREMENTS = Object.freeze({
  minimumCalibrationLearners: 100,
  minimumHoldoutLearners: 300,
  minimumOutcomeHorizonDays: 7,
  maximumOutcomeHorizonDays: 90
});

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const BandSchema = z.strictObject({ low: z.number(), central: z.number(), high: z.number() });
const PredictionSchema = z.strictObject({
  runId: z.string().min(1).max(120), learnerKeyHash: Sha256Schema,
  predictionAt: z.iso.datetime(), evidenceCutoffAt: z.iso.datetime(),
  targetScore: z.number(), scoreMinimum: z.number(), scoreMaximum: z.number(),
  baseline: z.strictObject({ scoreBand: BandSchema, targetAttainmentProbability: z.number().min(0).max(1) }),
  candidate: z.strictObject({ scoreBand: BandSchema, targetAttainmentProbability: z.number().min(0).max(1) })
});
const OutcomeSchema = z.strictObject({
  outcomeId: z.string().min(1).max(120), learnerKeyHash: Sha256Schema,
  outcomeAt: z.iso.datetime(), normalizedScore: z.number().min(0).max(1),
  stratum: z.string().min(1).max(80)
});
export const ScorePredictionCalibrationDatasetInputSchema = z.strictObject({
  examSystemCode: z.literal('csca'), subjectCode: z.literal('chemistry'),
  outcomeSource: z.enum(['verified_csca_exam', 'timed_mock_proxy']).default('timed_mock_proxy'),
  scoringPolicyVersion: z.string().min(1).max(80),
  itemCalibrationVersion: z.string().min(1).max(100),
  learnerKeyVersion: z.string().min(1).max(80),
  temporalCutoffDate: z.iso.date(),
  predictions: z.array(PredictionSchema).max(100_000),
  outcomes: z.array(OutcomeSchema).max(100_000)
}).superRefine((value, context) => {
  if (new Set(value.predictions.map((item) => item.runId)).size !== value.predictions.length) {
    context.addIssue({ code: 'custom', path: ['predictions'], message: 'Prediction run IDs must be unique.' });
  }
  if (new Set(value.outcomes.map((item) => item.outcomeId)).size !== value.outcomes.length) {
    context.addIssue({ code: 'custom', path: ['outcomes'], message: 'Outcome IDs must be unique.' });
  }
  value.predictions.forEach((prediction, index) => {
    const bands = [prediction.baseline.scoreBand, prediction.candidate.scoreBand];
    if (prediction.scoreMaximum <= prediction.scoreMinimum || prediction.targetScore < prediction.scoreMinimum
      || prediction.targetScore > prediction.scoreMaximum || bands.some((band) => !(band.low <= band.central && band.central <= band.high)
        || band.low < prediction.scoreMinimum || band.high > prediction.scoreMaximum)) {
      context.addIssue({ code: 'custom', path: ['predictions', index], message: 'Prediction scale, target, or interval is invalid.' });
    }
  });
});

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function hash(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
function days(later: string, earlier: string): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / 86_400_000;
}
function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function ece(rows: Array<{ probability: number; attained: boolean }>): number {
  return Array.from({ length: 10 }, (_, index) => {
    const lower = index / 10; const upper = (index + 1) / 10;
    const members = rows.filter((row) => row.probability >= lower
      && (index === 9 ? row.probability <= upper : row.probability < upper));
    return members.length / Math.max(1, rows.length)
      * Math.abs(mean(members.map((row) => row.probability)) - mean(members.map((row) => row.attained ? 1 : 0)));
  }).reduce((sum, value) => sum + value, 0);
}

export function buildScorePredictionCalibrationDataset(
  rawInput: unknown,
  requirements = SCORE_PREDICTION_DATASET_REQUIREMENTS
) {
  const input = ScorePredictionCalibrationDatasetInputSchema.parse(rawInput);
  const cutoffAt = `${input.temporalCutoffDate}T23:59:59.999Z`;
  const outcomesByLearner = new Map<string, typeof input.outcomes>();
  input.outcomes.forEach((outcome) => {
    if (!outcomesByLearner.has(outcome.learnerKeyHash)) outcomesByLearner.set(outcome.learnerKeyHash, []);
    outcomesByLearner.get(outcome.learnerKeyHash)!.push(outcome);
  });
  const predictionsByLearner = new Map<string, typeof input.predictions>();
  input.predictions.forEach((prediction) => {
    if (!predictionsByLearner.has(prediction.learnerKeyHash)) predictionsByLearner.set(prediction.learnerKeyHash, []);
    predictionsByLearner.get(prediction.learnerKeyHash)!.push(prediction);
  });

  const selected: Array<{ split: 'calibration' | 'holdout'; prediction: typeof input.predictions[number]; outcome: typeof input.outcomes[number] }> = [];
  let excludedCrossSplitLearnerCount = 0;
  for (const [learnerKeyHash, predictions] of [...predictionsByLearner.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const outcomes = outcomesByLearner.get(learnerKeyHash) ?? [];
    const pairs = outcomes.flatMap((outcome) => predictions.flatMap((prediction) => {
      const predictionBoundary = new Date(Math.max(new Date(prediction.predictionAt).getTime(),
        new Date(prediction.evidenceCutoffAt).getTime())).toISOString();
      const horizonDays = days(outcome.outcomeAt, predictionBoundary);
      return horizonDays >= requirements.minimumOutcomeHorizonDays && horizonDays <= requirements.maximumOutcomeHorizonDays
        && prediction.scoreMaximum > prediction.scoreMinimum
        ? [{ split: outcome.outcomeAt <= cutoffAt ? 'calibration' as const : 'holdout' as const, prediction, outcome }]
        : [];
    }));
    const splits = new Set(pairs.map((pair) => pair.split));
    if (splits.size > 1) { excludedCrossSplitLearnerCount += 1; continue; }
    if (!pairs.length) continue;
    const firstOutcomeAt = [...pairs].sort((a, b) => a.outcome.outcomeAt.localeCompare(b.outcome.outcomeAt))[0].outcome.outcomeAt;
    const chosen = pairs.filter((pair) => pair.outcome.outcomeAt === firstOutcomeAt)
      .sort((a, b) => b.prediction.predictionAt.localeCompare(a.prediction.predictionAt)
        || a.prediction.runId.localeCompare(b.prediction.runId))[0];
    selected.push(chosen);
  }
  selected.sort((a, b) => a.outcome.outcomeAt.localeCompare(b.outcome.outcomeAt)
    || a.prediction.learnerKeyHash.localeCompare(b.prediction.learnerKeyHash));
  const calibration = selected.filter((pair) => pair.split === 'calibration');
  const holdout = selected.filter((pair) => pair.split === 'holdout');
  const paired = selected.map(({ split, prediction, outcome }) => {
    const actualScore = prediction.scoreMinimum + outcome.normalizedScore * (prediction.scoreMaximum - prediction.scoreMinimum);
    return { split, runId: prediction.runId, outcomeId: outcome.outcomeId,
      learnerKeyHash: prediction.learnerKeyHash, outcomeAt: outcome.outcomeAt,
      actualScore, targetScore: prediction.targetScore, stratum: outcome.stratum,
      scoreMinimum: prediction.scoreMinimum, scoreMaximum: prediction.scoreMaximum,
      baseline: prediction.baseline, candidate: prediction.candidate };
  });
  const inputSourceHash = hash({
    predictions: [...input.predictions].sort((a, b) => a.runId.localeCompare(b.runId)),
    outcomes: [...input.outcomes].sort((a, b) => a.outcomeId.localeCompare(b.outcomeId))
  });
  const sourceDatasetHash = hash({ policyVersion: SCORE_PREDICTION_DATASET_POLICY_VERSION, requirements, inputSourceHash,
    scope: { examSystemCode: input.examSystemCode, subjectCode: input.subjectCode, outcomeSource: input.outcomeSource,
      scoringPolicyVersion: input.scoringPolicyVersion, itemCalibrationVersion: input.itemCalibrationVersion,
      learnerKeyVersion: input.learnerKeyVersion, temporalCutoffDate: input.temporalCutoffDate }, pairs: paired });
  const scalePairs = holdout.filter((pair) => pair.prediction.scoreMinimum === holdout[0]?.prediction.scoreMinimum
    && pair.prediction.scoreMaximum === holdout[0]?.prediction.scoreMaximum);
  const scaleConsistent = scalePairs.length === holdout.length;
  const baselineRows = scalePairs.map(({ prediction, outcome }) => {
    const actual = prediction.scoreMinimum + outcome.normalizedScore * (prediction.scoreMaximum - prediction.scoreMinimum);
    return { actual, predicted: prediction.baseline.scoreBand.central,
      probability: prediction.baseline.targetAttainmentProbability, attained: actual >= prediction.targetScore };
  });
  const scale = holdout[0] ? holdout[0].prediction.scoreMaximum - holdout[0].prediction.scoreMinimum : 0;
  const ready = calibration.length >= requirements.minimumCalibrationLearners
    && holdout.length >= requirements.minimumHoldoutLearners && scaleConsistent && scale > 0;
  const reasonCodes = [
    ...(calibration.length < requirements.minimumCalibrationLearners ? ['CALIBRATION_LEARNERS_INSUFFICIENT'] : []),
    ...(holdout.length < requirements.minimumHoldoutLearners ? ['HOLDOUT_LEARNERS_INSUFFICIENT'] : []),
    ...(!scaleConsistent ? ['SCORING_SCALE_INCONSISTENT'] : []),
    ...(excludedCrossSplitLearnerCount ? ['CROSS_SPLIT_LEARNERS_EXCLUDED'] : []),
    ...(input.outcomeSource === 'timed_mock_proxy' ? ['TIMED_MOCK_PROXY_OUTCOME_ONLY'] : []),
    'STUDENT_NUMERIC_RELEASE_DISABLED'
  ];
  const forecastCalibrationInput = ready ? ForecastCalibrationInputSchema.parse({
    calibrationVersion: `chem-forecast-${sourceDatasetHash.slice(0, 24)}`,
    examSystemCode: input.examSystemCode, subjectCode: input.subjectCode,
    languageCode: null, examFormCode: null,
    forecastModelVersion: CHEMISTRY_SCORE_SHADOW_MODEL_VERSION,
    scoringPolicyVersion: input.scoringPolicyVersion,
    itemCalibrationVersion: input.itemCalibrationVersion,
    outcomeSource: input.outcomeSource,
    scoreMinimum: holdout[0].prediction.scoreMinimum, scoreMaximum: holdout[0].prediction.scoreMaximum,
    dataWindowStart: holdout[0].outcome.outcomeAt,
    dataWindowEnd: holdout[holdout.length - 1].outcome.outcomeAt,
    sourceDatasetHash,
    baselineMetrics: { normalizedMae: mean(baselineRows.map((row) => Math.abs(row.actual - row.predicted))) / scale,
      expectedCalibrationError: ece(baselineRows) },
    rows: scalePairs.map(({ prediction, outcome }) => {
      const actualScore = prediction.scoreMinimum + outcome.normalizedScore * (prediction.scoreMaximum - prediction.scoreMinimum);
      return { rowId: hash({ runId: prediction.runId, outcomeId: outcome.outcomeId }),
        learnerKeyHash: prediction.learnerKeyHash, split: 'holdout' as const, actualScore,
        predictedLow: prediction.candidate.scoreBand.low, predictedCentral: prediction.candidate.scoreBand.central,
        predictedHigh: prediction.candidate.scoreBand.high, targetScore: prediction.targetScore,
        predictedAttainmentProbability: prediction.candidate.targetAttainmentProbability,
        targetAttained: actualScore >= prediction.targetScore, stratum: outcome.stratum };
    })
  }) : null;
  return { schemaVersion: '1' as const, policyVersion: SCORE_PREDICTION_DATASET_POLICY_VERSION,
    status: ready ? 'ready_for_snapshot_build' as const : 'blocked' as const,
    sourceDatasetHash, temporalCutoffDate: input.temporalCutoffDate,
    learnerKeyVersion: input.learnerKeyVersion,
    requirements, inputSourceHash, outcomeSource: input.outcomeSource,
    counts: { predictionCount: input.predictions.length, outcomeCount: input.outcomes.length,
      calibrationLearnerCount: calibration.length, holdoutLearnerCount: holdout.length,
      excludedCrossSplitLearnerCount }, reasonCodes, forecastCalibrationInput,
    manifestRows: paired.map((pair) => ({ outcomeId: pair.outcomeId, shadowRunId: pair.runId,
      learnerKeyHash: pair.learnerKeyHash, split: pair.split,
      rowHash: hash({ sourceDatasetHash, outcomeId: pair.outcomeId, shadowRunId: pair.runId,
        learnerKeyHash: pair.learnerKeyHash, split: pair.split }) })) };
}
