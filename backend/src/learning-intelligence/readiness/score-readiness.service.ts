import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CscaSubjectCodeSchema,
  ScoreReadinessForecastV1,
  ScoreReadinessForecastV1Schema,
  TargetGapItemV1
} from '../contracts/learning-intelligence.contracts';
import { LearningDecisionService } from '../decision/learning-decision.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';
import {
  ScoreCalibrationGateInput,
  ScoreCalibrationGovernanceService
} from './score-calibration-governance.service';

const READINESS_LOCK_NAMESPACE = 2_147_001_214;

function forecastId(userId: number, goalId: string, subject: string, versionHash: string): string {
  const digest = createHash('sha256').update(`${userId}:${goalId}:${subject}:${versionHash}`).digest('hex').slice(0, 32);
  return `srf_${digest}`;
}

function readinessForSubject(
  userId: number,
  goalId: string,
  subject: 'math' | 'physics' | 'chemistry',
  targetScore: number,
  versionHash: string,
  versions: ScoreReadinessForecastV1['versions'],
  evidenceCutoffAt: string,
  createdAt: string,
  gaps: TargetGapItemV1[],
  gateStatus: 'blocked' | 'shadow_qualified',
  gateReasonCodes: string[]
): ScoreReadinessForecastV1 {
  const subjectGaps = gaps.filter((gap) => gap.subject === subject);
  const types = new Set(subjectGaps.map((gap) => gap.type));
  const dueVerification = subjectGaps.some((gap) => gap.recommendedAction === 'intervention_verification');
  const lacksIndependentEvidence = types.has('coverage') || types.has('evidence');
  const reasonCodes = [
    ...gateReasonCodes,
    ...(types.has('coverage') ? ['SYLLABUS_COVERAGE_INCOMPLETE'] : []),
    ...(types.has('evidence') ? ['INDEPENDENT_EVIDENCE_INSUFFICIENT'] : []),
    ...(types.has('exam_execution') ? ['RECENT_MOCK_MISSING'] : []),
    ...(dueVerification ? ['STAGED_VERIFICATION_DUE'] : [])
  ];
  const nextValidationAction = lacksIndependentEvidence
    ? 'diagnostic' as const
    : types.has('exam_execution')
      ? 'mock_exam' as const
      : 'continue_learning' as const;
  return ScoreReadinessForecastV1Schema.parse({
    schemaVersion: '1',
    forecastId: forecastId(userId, goalId, subject, versionHash),
    goalId,
    userId,
    subjectCode: subject,
    targetScore,
    readinessState: lacksIndependentEvidence || gateStatus === 'blocked' ? 'insufficient' : 'measuring',
    versions,
    expectedScoreBand: null,
    targetAttainmentProbability: null,
    confidence: 'insufficient',
    reasonCodes: [...new Set(reasonCodes)],
    nextValidationAction,
    evidenceCutoffAt,
    createdAt
  });
}

@Injectable()
export class ScoreReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: LearningIntelligenceFeatureFlagsService,
    private readonly learningDecision: LearningDecisionService,
    private readonly calibrationGovernance: ScoreCalibrationGovernanceService
  ) {}

  async getScoreReadiness(userId: number) {
    if (!this.featureFlags.isEnabled('scoreReadiness')) return { status: 'disabled' as const, forecasts: [] };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const decision = await this.learningDecision.recompute(userId);
        if (!decision) return { status: 'goal_unset' as const, forecasts: [] };
        const forecasts = await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${READINESS_LOCK_NAMESPACE}::int, ${userId}::int)`;
          const goal = await tx.studentScoreGoal.findFirst({
            where: { id: decision.gap.goalId, userId, status: 'active' },
            include: { subjects: { orderBy: [{ priority: 'asc' }, { subjectCode: 'asc' }] } }
          });
          const current = await tx.learningDecisionCurrent.findFirst({
            where: { userId, goalId: decision.gap.goalId, versionHash: decision.versionHash }
          });
          if (!goal || !current) throw new Error('SCORE_READINESS_INPUT_CHANGED');
          const supportedSubjects = goal.subjects.flatMap((item) => {
            const subject = CscaSubjectCodeSchema.safeParse(item.subjectCode);
            return subject.success ? [{ item, subject: subject.data }] : [];
          });
          const gates = await Promise.all(supportedSubjects.map(({ subject }) => {
            const input: ScoreCalibrationGateInput = {
              examSystemCode: goal.examSystemCode,
              subjectCode: subject,
              scoringPolicyVersion: decision.gap.versions.scoringPolicyVersion,
              itemCalibrationVersion: decision.gap.versions.itemCalibrationVersion,
              forecastModelVersion: decision.gap.versions.forecastModelVersion
            };
            return this.calibrationGovernance.evaluate(input, tx);
          }));
          const values = supportedSubjects.map(({ item, subject }, index) => {
            const gate = gates[index];
            const readinessVersionHash = createHash('sha256')
              .update(`${decision.versionHash}:${gate.gateVersionHash}`)
              .digest('hex');
            return readinessForSubject(
              userId,
              goal.id,
              subject,
              item.targetScore,
              readinessVersionHash,
              decision.gap.versions,
              decision.gap.evidenceCutoffAt,
              decision.gap.createdAt,
              decision.gap.gaps,
              gate.status,
              gate.reasonCodes
            );
          });
          await Promise.all(values.map((value) => tx.scoreReadinessForecast.upsert({
            where: {
              userId_goalId_subjectCode_versionHash: {
                userId,
                goalId: goal.id,
                subjectCode: value.subjectCode,
                versionHash: decision.versionHash
              }
            },
            create: {
              id: value.forecastId,
              userId,
              goalId: goal.id,
              subjectCode: value.subjectCode,
              versionHash: decision.versionHash,
              versions: value.versions as unknown as Prisma.InputJsonValue,
              expectedScoreBand: Prisma.JsonNull,
              targetAttainmentProbability: null,
              confidence: value.confidence,
              reasonCodes: value.reasonCodes as unknown as Prisma.InputJsonValue,
              nextValidationAction: value.nextValidationAction,
              evidenceCutoffAt: new Date(value.evidenceCutoffAt),
              createdAt: new Date(value.createdAt)
            },
            update: {}
          })));
          return {
            values,
            gateInputs: supportedSubjects.map(({ subject }) => ({
              examSystemCode: goal.examSystemCode,
              subjectCode: subject,
              scoringPolicyVersion: decision.gap.versions.scoringPolicyVersion,
              itemCalibrationVersion: decision.gap.versions.itemCalibrationVersion,
              forecastModelVersion: decision.gap.versions.forecastModelVersion
            })),
            gateHashes: gates.map((gate) => gate.gateVersionHash)
          };
        });
        const confirmedDecision = await this.learningDecision.recompute(userId);
        if (!confirmedDecision || confirmedDecision.versionHash !== decision.versionHash) {
          throw new Error('SCORE_READINESS_INPUT_CHANGED');
        }
        const confirmedGates = await Promise.all(forecasts.gateInputs.map((input) =>
          this.calibrationGovernance.evaluate(input)));
        if (confirmedGates.some((gate, index) => gate.gateVersionHash !== forecasts.gateHashes[index])) {
          throw new Error('SCORE_READINESS_INPUT_CHANGED');
        }
        return { status: 'ready' as const, visibility: 'shadow' as const, forecasts: forecasts.values };
      } catch (error) {
        if (error instanceof Error && error.message === 'LEARNING_DECISION_STATE_UPDATING') {
          return { status: 'updating' as const, forecasts: [] };
        }
        if (error instanceof Error && error.message === 'SCORE_READINESS_INPUT_CHANGED' && attempt === 0) continue;
        throw error;
      }
    }
    throw new Error('SCORE_READINESS_INPUT_CHANGED');
  }
}
