import { createHash } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { LEARNING_STATE_MODEL_VERSION } from '../evidence/learning-evidence-writer.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';
import { ScoreCalibrationGovernanceService } from './score-calibration-governance.service';
import { runChemistryScorePredictionShadow } from './score-prediction-shadow.model';

const RunInputSchema = z.strictObject({
  userId: z.coerce.number().int().positive(),
  scoringPolicyVersion: z.string().trim().min(1).max(80),
  itemCalibrationVersion: z.string().trim().min(1).max(100),
  evaluationDate: z.iso.date().optional()
});
const ScoreScaleSchema = z.strictObject({
  subjects: z.strictObject({ chemistry: z.strictObject({ minimum: z.number(), maximum: z.number() }) })
});

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(typeof value === 'bigint' ? value.toString() : value);
}
function hash(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
function safeSourceHash(value: string): string { return /^[a-f0-9]{64}$/i.test(value) ? value : hash({ invalidSourceHash: value }); }
function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / 86_400_000);
}
function isoDate(value: Date): string { return value.toISOString().slice(0, 10); }

@Injectable()
export class ScorePredictionShadowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: LearningIntelligenceFeatureFlagsService,
    private readonly governance: ScoreCalibrationGovernanceService
  ) {}

  async run(raw: unknown) {
    const parsedInput = RunInputSchema.safeParse(raw);
    if (!parsedInput.success) throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: parsedInput.error.issues });
    const input = parsedInput.data;
    if (!this.flags.isEnabled('scorePredictionShadow')) return { status: 'disabled' as const, run: null };
    const evaluationAt = input.evaluationDate
      ? new Date(`${input.evaluationDate}T23:59:59.999Z`) : new Date();
    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.studentScoreGoal.findFirst({
        where: { userId: input.userId, examSystemCode: 'csca', status: 'active' },
        include: { subjects: true }, orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }]
      });
      const goalSubject = goal?.subjects.find((item) => item.subjectCode === 'chemistry');
      if (!goal || !goalSubject) return { status: 'goal_unset' as const, run: null };

      const [policy, itemCalibration, states, evidence, mockAttempts, prerequisite] = await Promise.all([
        tx.examScoringPolicy.findUnique({ where: { policyVersion: input.scoringPolicyVersion } }),
        tx.itemCalibrationSnapshot.findUnique({ where: { calibrationVersion: input.itemCalibrationVersion } }),
        tx.userCscaTopicStateV2.findMany({
          where: { userId: input.userId, subjectCode: 'chemistry', modelVersion: LEARNING_STATE_MODEL_VERSION },
          orderBy: { topicId: 'asc' }
        }),
        tx.learningEvidenceEvent.aggregate({
          where: { userId: input.userId, subjectCode: 'chemistry', sourceType: { in: ['diagnostic', 'mock_exam'] },
            firstAttempt: true, usedHint: false, usedExplanation: false, exposureState: 'prompt_seen',
            questionQualityConfidence: { gte: 0.8 }, retraction: null },
          _count: { _all: true }, _max: { eventSequence: true, recordedAt: true }
        }),
        tx.mockExamAttempt.findMany({
          where: { userId: input.userId, submittedAt: { not: null }, score: { not: null } },
          select: { id: true, score: true, correctCount: true, wrongCount: true, unansweredCount: true,
            startedAt: true, submittedAt: true, updatedAt: true,
            paper: { select: { subject: true, durationMinutes: true, version: true } } },
          orderBy: { submittedAt: 'desc' }, take: 20
        }),
        this.governance.evaluateModelingPrerequisites({ examSystemCode: 'csca', subjectCode: 'chemistry',
          scoringPolicyVersion: input.scoringPolicyVersion, itemCalibrationVersion: input.itemCalibrationVersion }, tx, evaluationAt)
      ]);
      const scale = ScoreScaleSchema.safeParse(policy?.scoreScale);
      if (!policy || !itemCalibration || !scale.success || scale.data.subjects.chemistry.maximum <= scale.data.subjects.chemistry.minimum) {
        return { status: 'preflight_blocked' as const,
          reasonCodes: [...new Set([...prerequisite.reasonCodes,
            ...(!scale.success || (scale.success && scale.data.subjects.chemistry.maximum <= scale.data.subjects.chemistry.minimum)
              ? ['SCORING_SCALE_UNSUPPORTED'] : [])])], run: null };
      }
      const { minimum: scoreMinimum, maximum: scoreMaximum } = scale.data.subjects.chemistry;
      const timedMocks = mockAttempts.filter((attempt) => attempt.paper.subject === 'chemistry'
        && attempt.submittedAt && attempt.score !== null
        && attempt.submittedAt.getTime() - attempt.startedAt.getTime() <= attempt.paper.durationMinutes * 60_000 * 1.25
        && (attempt.correctCount ?? 0) + (attempt.wrongCount ?? 0) + (attempt.unansweredCount ?? 0) > 0);
      const latestMock = timedMocks[0] ?? null;
      const average = (key: 'mastery' | 'confidence' | 'independence' | 'retention' | 'fluency' | 'transfer' | 'consistency' | 'coverage') =>
        states.length ? states.reduce((sum, state) => sum + state[key], 0) / states.length : 0;
      const stateDates = states.map((state) => state.lastEvidenceAt ?? state.updatedAt);
      const cutoffCandidates = [...stateDates, evidence._max.recordedAt, latestMock?.submittedAt].filter((v): v is Date => v instanceof Date);
      const evidenceCutoffAt = cutoffCandidates.length
        ? new Date(Math.max(...cutoffCandidates.map((date) => date.getTime()))) : evaluationAt;
      const feature = {
        schemaVersion: '1', userId: input.userId, goalId: goal.id, subjectCode: 'chemistry',
        targetScore: goalSubject.targetScore, scoreMinimum, scoreMaximum,
        evaluationDate: isoDate(evaluationAt), evidenceCutoffAt: evidenceCutoffAt.toISOString(),
        scoringPolicyVersion: input.scoringPolicyVersion, itemCalibrationVersion: input.itemCalibrationVersion,
        modelingPrerequisiteStatus: prerequisite.status,
        modelingPrerequisiteReasonCodes: prerequisite.reasonCodes,
        topicStateCount: states.length, independentEvidenceCount: evidence._count._all,
        averageStateConfidence: clamp(average('confidence')),
        maximumStateAgeDays: stateDates.length ? Math.max(...stateDates.map((date) => daysBetween(evaluationAt, date))) : 9999,
        timedMockCount: timedMocks.length,
        latestTimedMockAgeDays: latestMock?.submittedAt ? daysBetween(evaluationAt, latestMock.submittedAt) : null,
        latestTimedMockScoreNormalized: latestMock ? clamp((latestMock.correctCount ?? 0)
          / ((latestMock.correctCount ?? 0) + (latestMock.wrongCount ?? 0) + (latestMock.unansweredCount ?? 0))) : null,
        mastery: clamp(average('mastery')), coverage: clamp(average('coverage')),
        independence: clamp(average('independence')), retention: clamp(average('retention')),
        fluency: clamp(average('fluency')), transfer: clamp(average('transfer')),
        consistency: clamp(average('consistency')),
        sourceVersions: {
          learningModelVersion: LEARNING_STATE_MODEL_VERSION,
          learningStateVersionHash: hash(states.map((state) => ({ topicId: state.topicId, stateVersion: state.stateVersion,
            mastery: state.mastery, confidence: state.confidence, independence: state.independence,
            retention: state.retention, fluency: state.fluency, transfer: state.transfer,
            consistency: state.consistency, coverage: state.coverage, updatedAt: state.updatedAt }))),
          evidenceVersionHash: hash(evidence), mockVersionHash: hash(timedMocks),
          scoringPolicySourceHash: safeSourceHash(policy.sourceSnapshotHash),
          itemCalibrationArtifactHash: safeSourceHash(itemCalibration.artifactHash)
        }
      };
      const result = runChemistryScorePredictionShadow(feature);
      const persisted = await tx.scorePredictionShadowRun.upsert({
        where: { userId_goalId_subjectCode_versionHash: {
          userId: input.userId, goalId: goal.id, subjectCode: 'chemistry', versionHash: result.versionHash } },
        create: { id: `sps_${result.versionHash.slice(0, 32)}`, userId: input.userId, goalId: goal.id,
          subjectCode: 'chemistry', versionHash: result.versionHash, modelVersion: result.modelVersion,
          scoringPolicyVersion: input.scoringPolicyVersion, itemCalibrationVersion: input.itemCalibrationVersion,
          status: result.status, featureSnapshot: result.featureSnapshot as unknown as Prisma.InputJsonValue,
          baselineOutput: result.baselineOutput === null ? Prisma.DbNull : result.baselineOutput as unknown as Prisma.InputJsonValue,
          candidateOutput: result.candidateOutput === null ? Prisma.DbNull : result.candidateOutput as unknown as Prisma.InputJsonValue,
          reasonCodes: result.reasonCodes as unknown as Prisma.InputJsonValue,
          evidenceCutoffAt, evaluationDate: new Date(`${feature.evaluationDate}T00:00:00.000Z`) },
        update: {}
      });
      return { status: result.status, visibility: 'internal_shadow' as const,
        numericForecastRelease: 'disabled' as const, run: { ...persisted, result } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async list(userId: unknown) {
    const result = z.coerce.number().int().positive().safeParse(userId);
    if (!result.success) throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: result.error.issues });
    const parsedUserId = result.data;
    return this.prisma.scorePredictionShadowRun.findMany({
      where: { userId: parsedUserId }, orderBy: { createdAt: 'desc' }, take: 100
    });
  }
}
