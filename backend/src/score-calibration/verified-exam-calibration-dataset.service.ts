import { createHmac } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { buildScorePredictionCalibrationDataset } from '../learning-intelligence/calibration/score-prediction-calibration-dataset';
import { buildForecastCalibrationArtifact } from '../learning-intelligence/calibration/score-calibration-engine';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence/learning-intelligence-feature-flags.service';
import {
  CHEMISTRY_SCORE_SHADOW_MODEL_VERSION,
  ChemistryScorePredictionFeatureSchema
} from '../learning-intelligence/readiness/score-prediction-shadow.model';

const ExportSchema = z.strictObject({
  scoringPolicyVersion: z.string().trim().min(1).max(80),
  itemCalibrationVersion: z.string().trim().min(1).max(100),
  temporalCutoffDate: z.iso.date(), dataWindowStart: z.iso.date(), dataWindowEnd: z.iso.date()
}).superRefine((value, context) => {
  if (value.dataWindowEnd < value.dataWindowStart) context.addIssue({ code: 'custom', path: ['dataWindowEnd'], message: 'Window end precedes start.' });
  if (value.temporalCutoffDate < value.dataWindowStart || value.temporalCutoffDate > value.dataWindowEnd) {
    context.addIssue({ code: 'custom', path: ['temporalCutoffDate'], message: 'Temporal cutoff must be inside the data window.' });
  }
});
const PredictionOutputSchema = z.strictObject({
  method: z.string(), scoreBand: z.strictObject({ low: z.number(), central: z.number(), high: z.number() }),
  targetAttainmentProbability: z.number().min(0).max(1)
}).passthrough();

function learnerKey(salt: string, userId: number) {
  return createHmac('sha256', salt).update(`csca-forecast-calibration:user:${userId}`).digest('hex');
}

@Injectable()
export class VerifiedExamCalibrationDatasetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: LearningIntelligenceFeatureFlagsService,
    @Optional() private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  async export(raw: unknown, actorUserId: number) {
    const parsed = ExportSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    if (!this.flags.isEnabled('scorePredictionShadow')) return { status: 'disabled' as const };
    const salt = String(this.env.CSCA_FORECAST_CALIBRATION_LEARNER_SALT ?? '');
    const learnerKeyVersion = String(this.env.CSCA_FORECAST_CALIBRATION_LEARNER_SALT_VERSION ?? '').trim();
    if (salt.length < 32 || !learnerKeyVersion) return { status: 'preflight_blocked' as const,
      reasonCodes: [...(salt.length < 32 ? ['CALIBRATION_LEARNER_SALT_MISSING'] : []),
        ...(!learnerKeyVersion ? ['CALIBRATION_LEARNER_SALT_VERSION_MISSING'] : [])], forecastCalibrationInput: null };
    const input = parsed.data;
    const [runs, outcomes] = await Promise.all([
      this.prisma.scorePredictionShadowRun.findMany({ where: {
        subjectCode: 'chemistry', status: 'computed', modelVersion: CHEMISTRY_SCORE_SHADOW_MODEL_VERSION,
        scoringPolicyVersion: input.scoringPolicyVersion, itemCalibrationVersion: input.itemCalibrationVersion,
        evaluationDate: { gte: new Date(`${input.dataWindowStart}T00:00:00.000Z`),
          lte: new Date(`${input.dataWindowEnd}T23:59:59.999Z`) }
      }, orderBy: [{ evaluationDate: 'asc' }, { id: 'asc' }], take: 100_000 }),
      this.prisma.studentExamOutcome.findMany({ where: {
        examSystemCode: 'csca', subjectCode: 'chemistry', status: 'verified', consentWithdrawnAt: null,
        scoringPolicyVersion: input.scoringPolicyVersion, reviewedByUserId: { not: null }, verifiedByUserId: { not: null },
        examDate: { gte: new Date(`${input.dataWindowStart}T00:00:00.000Z`),
          lte: new Date(`${input.dataWindowEnd}T23:59:59.999Z`) }
      }, orderBy: [{ examDate: 'asc' }, { id: 'asc' }], take: 100_000 })
    ]);
    const predictions = runs.flatMap((run) => {
      const feature = ChemistryScorePredictionFeatureSchema.safeParse(run.featureSnapshot);
      const baseline = PredictionOutputSchema.safeParse(run.baselineOutput);
      const candidate = PredictionOutputSchema.safeParse(run.candidateOutput);
      if (!feature.success || !baseline.success || !candidate.success || feature.data.modelingPrerequisiteStatus !== 'qualified') return [];
      const boundary = new Date(`${feature.data.evaluationDate}T23:59:59.999Z`);
      return [{ runId: run.id, learnerKeyHash: learnerKey(salt, run.userId),
        predictionAt: new Date(Math.max(boundary.getTime(), new Date(feature.data.evidenceCutoffAt).getTime())).toISOString(),
        evidenceCutoffAt: feature.data.evidenceCutoffAt, targetScore: feature.data.targetScore,
        scoreMinimum: feature.data.scoreMinimum, scoreMaximum: feature.data.scoreMaximum,
        baseline: { scoreBand: baseline.data.scoreBand, targetAttainmentProbability: baseline.data.targetAttainmentProbability },
        candidate: { scoreBand: candidate.data.scoreBand, targetAttainmentProbability: candidate.data.targetAttainmentProbability } }];
    });
    const scale = predictions[0] ? { minimum: predictions[0].scoreMinimum, maximum: predictions[0].scoreMaximum } : null;
    const verifiedOutcomes = scale ? outcomes.flatMap((outcome) => {
      if (outcome.score < scale.minimum || outcome.score > scale.maximum
        || outcome.reviewedByUserId === outcome.verifiedByUserId || !outcome.verifiedAt) return [];
      return [{ outcomeId: outcome.id, learnerKeyHash: learnerKey(salt, outcome.userId),
        outcomeAt: outcome.examDate.toISOString(), normalizedScore: (outcome.score - scale.minimum) / (scale.maximum - scale.minimum),
        stratum: `form:${outcome.examFormCode || 'unknown'}` }];
    }) : [];
    const dataset = buildScorePredictionCalibrationDataset({ examSystemCode: 'csca', subjectCode: 'chemistry',
      outcomeSource: 'verified_csca_exam', scoringPolicyVersion: input.scoringPolicyVersion,
      itemCalibrationVersion: input.itemCalibrationVersion, learnerKeyVersion,
      temporalCutoffDate: input.temporalCutoffDate, predictions, outcomes: verifiedOutcomes });
    const { manifestRows, ...publicDataset } = dataset;
    if (dataset.status !== 'ready_for_snapshot_build' || !dataset.forecastCalibrationInput) {
      return { ...publicDataset, datasetManifestId: null };
    }
    const forecastArtifactHash = buildForecastCalibrationArtifact(dataset.forecastCalibrationInput).artifactHash;
    const manifest = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.studentExamOutcome.updateMany({ where: {
        id: { in: manifestRows.map((row) => row.outcomeId) }, status: 'verified', consentWithdrawnAt: null,
        reviewedByUserId: { not: null }, verifiedByUserId: { not: null }
      }, data: { status: 'verified' } });
      if (locked.count !== manifestRows.length) {
        throw new ConflictException('A verified outcome changed before the calibration manifest could be sealed.');
      }
      const sealed = await tx.forecastCalibrationDatasetManifest.upsert({
        where: { sourceDatasetHash: dataset.sourceDatasetHash }, update: {},
        create: { sourceDatasetHash: dataset.sourceDatasetHash, forecastArtifactHash,
          examSystemCode: 'csca', subjectCode: 'chemistry',
          scoringPolicyVersion: input.scoringPolicyVersion, itemCalibrationVersion: input.itemCalibrationVersion,
          learnerKeyVersion, temporalCutoffDate: new Date(`${input.temporalCutoffDate}T00:00:00.000Z`),
          dataWindowStart: new Date(`${input.dataWindowStart}T00:00:00.000Z`),
          dataWindowEnd: new Date(`${input.dataWindowEnd}T00:00:00.000Z`), createdByUserId: actorUserId,
          rows: { create: manifestRows.map((row) => ({ outcomeId: row.outcomeId, shadowRunId: row.shadowRunId,
            split: row.split, learnerKeyHash: row.learnerKeyHash, rowHash: row.rowHash })) } }
      });
      if (sealed.status !== 'active') throw new ConflictException('This exact verified dataset was invalidated and cannot be reused.');
      return sealed;
    });
    return { ...publicDataset, datasetManifestId: manifest.id,
      forecastCalibrationInput: { ...dataset.forecastCalibrationInput, datasetManifestId: manifest.id } };
  }
}
