import { createHmac } from 'node:crypto';
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';
import {
  CHEMISTRY_SCORE_SHADOW_MODEL_VERSION,
  ChemistryScorePredictionFeatureSchema
} from '../readiness/score-prediction-shadow.model';
import { buildScorePredictionCalibrationDataset } from './score-prediction-calibration-dataset';

const ExportInputSchema = z.strictObject({
  scoringPolicyVersion: z.string().trim().min(1).max(80),
  itemCalibrationVersion: z.string().trim().min(1).max(100),
  temporalCutoffDate: z.iso.date(),
  dataWindowStart: z.iso.date(),
  dataWindowEnd: z.iso.date()
}).superRefine((value, context) => {
  if (value.dataWindowEnd < value.dataWindowStart) context.addIssue({ code: 'custom', path: ['dataWindowEnd'], message: 'Window end precedes start.' });
  if (value.temporalCutoffDate < value.dataWindowStart || value.temporalCutoffDate > value.dataWindowEnd) {
    context.addIssue({ code: 'custom', path: ['temporalCutoffDate'], message: 'Temporal cutoff must be inside the data window.' });
  }
});
const PredictionOutputSchema = z.strictObject({
  method: z.string(),
  scoreBand: z.strictObject({ low: z.number(), central: z.number(), high: z.number() }),
  targetAttainmentProbability: z.number().min(0).max(1)
}).passthrough();

function learnerKey(salt: string, userId: number): string {
  return createHmac('sha256', salt).update(`csca-forecast-calibration:user:${userId}`).digest('hex');
}

@Injectable()
export class ScorePredictionCalibrationDatasetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: LearningIntelligenceFeatureFlagsService,
    @Optional() private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  async export(raw: unknown) {
    const parsed = ExportInputSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: parsed.error.issues });
    if (!this.flags.isEnabled('scorePredictionShadow')) return { status: 'disabled' as const };
    const salt = String(this.env.CSCA_FORECAST_CALIBRATION_LEARNER_SALT ?? '');
    const learnerKeyVersion = String(this.env.CSCA_FORECAST_CALIBRATION_LEARNER_SALT_VERSION ?? '').trim();
    if (salt.length < 32 || !learnerKeyVersion) return { status: 'preflight_blocked' as const,
      reasonCodes: [...(salt.length < 32 ? ['CALIBRATION_LEARNER_SALT_MISSING'] : []),
        ...(!learnerKeyVersion ? ['CALIBRATION_LEARNER_SALT_VERSION_MISSING'] : [])], forecastCalibrationInput: null };
    const input = parsed.data;
    const runs = await this.prisma.scorePredictionShadowRun.findMany({
      where: { subjectCode: 'chemistry', status: 'computed', modelVersion: CHEMISTRY_SCORE_SHADOW_MODEL_VERSION,
        scoringPolicyVersion: input.scoringPolicyVersion, itemCalibrationVersion: input.itemCalibrationVersion,
        evaluationDate: { gte: new Date(`${input.dataWindowStart}T00:00:00.000Z`),
          lte: new Date(`${input.dataWindowEnd}T23:59:59.999Z`) } },
      orderBy: [{ evaluationDate: 'asc' }, { id: 'asc' }], take: 100_000
    });
    const userIds = [...new Set(runs.map((run) => run.userId))];
    const attempts = userIds.length ? await this.prisma.mockExamAttempt.findMany({
      where: { userId: { in: userIds }, submittedAt: {
        gte: new Date(`${input.dataWindowStart}T00:00:00.000Z`),
        lte: new Date(`${input.dataWindowEnd}T23:59:59.999Z`) }, score: { not: null } },
      select: { id: true, userId: true, correctCount: true, wrongCount: true, unansweredCount: true,
        startedAt: true, submittedAt: true,
        paper: { select: { subject: true, language: true, durationMinutes: true } } },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }], take: 100_000
    }) : [];
    const predictions = runs.flatMap((run) => {
      const feature = ChemistryScorePredictionFeatureSchema.safeParse(run.featureSnapshot);
      const baseline = PredictionOutputSchema.safeParse(run.baselineOutput);
      const candidate = PredictionOutputSchema.safeParse(run.candidateOutput);
      if (!feature.success || !baseline.success || !candidate.success
        || feature.data.modelingPrerequisiteStatus !== 'qualified') return [];
      const evaluationBoundary = new Date(`${feature.data.evaluationDate}T23:59:59.999Z`);
      return [{ runId: run.id, learnerKeyHash: learnerKey(salt, run.userId),
        predictionAt: new Date(Math.max(evaluationBoundary.getTime(), new Date(feature.data.evidenceCutoffAt).getTime())).toISOString(),
        evidenceCutoffAt: feature.data.evidenceCutoffAt, targetScore: feature.data.targetScore,
        scoreMinimum: feature.data.scoreMinimum, scoreMaximum: feature.data.scoreMaximum,
        baseline: { scoreBand: baseline.data.scoreBand, targetAttainmentProbability: baseline.data.targetAttainmentProbability },
        candidate: { scoreBand: candidate.data.scoreBand, targetAttainmentProbability: candidate.data.targetAttainmentProbability } }];
    });
    const outcomes = attempts.flatMap((attempt) => {
      const total = (attempt.correctCount ?? 0) + (attempt.wrongCount ?? 0) + (attempt.unansweredCount ?? 0);
      const timed = attempt.submittedAt && attempt.submittedAt.getTime() - attempt.startedAt.getTime()
        <= attempt.paper.durationMinutes * 60_000 * 1.25;
      if (!attempt.userId || !attempt.submittedAt || attempt.paper.subject !== 'chemistry' || !timed || total <= 0) return [];
      return [{ outcomeId: `mock:${attempt.id}`, learnerKeyHash: learnerKey(salt, attempt.userId),
        outcomeAt: attempt.submittedAt.toISOString(), normalizedScore: (attempt.correctCount ?? 0) / total,
        stratum: `language:${attempt.paper.language.toLowerCase()}` }];
    });
    return buildScorePredictionCalibrationDataset({ examSystemCode: 'csca', subjectCode: 'chemistry', outcomeSource: 'timed_mock_proxy',
      scoringPolicyVersion: input.scoringPolicyVersion, itemCalibrationVersion: input.itemCalibrationVersion,
      learnerKeyVersion, temporalCutoffDate: input.temporalCutoffDate, predictions, outcomes });
  }
}
