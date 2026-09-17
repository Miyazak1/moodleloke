import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CscaSubjectCode,
  CscaSubjectCodeSchema,
  LearningDecisionVersionVectorV1,
  LearningPrescriptionV1Schema,
  TargetGapSnapshotV1Schema
} from '../contracts/learning-intelligence.contracts';
import { LEARNING_STATE_MODEL_VERSION, LEARNING_STATE_PROJECTOR_VERSION } from '../evidence/learning-evidence-writer.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence-feature-flags.service';
import {
  buildLearningPrescription,
  buildTargetGapSnapshot,
  DecisionTopicInput,
  LEARNING_DECISION_POLICY_VERSION,
  LEARNING_FORECAST_MODEL_VERSION,
  LEARNING_ITEM_CALIBRATION_VERSION,
  InterventionDecisionSignal,
  LearningDecisionInput
} from './learning-decision.model';

const DECISION_LOCK_NAMESPACE = 2_147_001_213;

function canonical(value: unknown): string {
  if (value === undefined) return '"__undefined__"';
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

function misconceptionCount(value: Prisma.JsonValue | null): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const count = Number((value as Record<string, unknown>).incorrectCount ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function jsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stabilityPhase(value: Prisma.JsonValue | null | undefined, target: 'failed' | 'inconclusive'): 'immediate' | 'retention' | 'transfer' | null {
  for (const phase of ['transfer', 'retention', 'immediate'] as const) {
    if (jsonRecord(jsonRecord(value)[phase] as Prisma.JsonValue).result === target) return phase;
  }
  return null;
}

function hasSupplyGap(value: Prisma.JsonValue | null | undefined): boolean {
  return Object.values(jsonRecord(value)).some((item) => jsonRecord(item as Prisma.JsonValue).result === 'supply_unavailable');
}

function stateEventSequence(value: string | null | undefined): bigint | null {
  const match = value?.match(/:(\d+)(?::r\d+)?$/);
  return match ? BigInt(match[1]) : null;
}

function evidenceReferenceIds(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = jsonRecord(item as Prisma.JsonValue).evidenceId;
    return typeof id === 'string' && id ? [id] : [];
  });
}

type LoadedDecision = { input: LearningDecisionInput; versionHash: string };

@Injectable()
export class LearningDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: LearningIntelligenceFeatureFlagsService
  ) {}

  async getTargetGap(userId: number) {
    if (!this.featureFlags.isEnabled('targetGap')) return { status: 'disabled' as const, snapshot: null };
    try {
      const result = await this.recompute(userId);
      return result ? { status: 'ready' as const, snapshot: result.gap } : { status: 'goal_unset' as const, snapshot: null };
    } catch (error) {
      if (error instanceof Error && error.message === 'LEARNING_DECISION_STATE_UPDATING') {
        return { status: 'updating' as const, snapshot: null };
      }
      throw error;
    }
  }

  async getLearningPrescription(userId: number) {
    if (!this.featureFlags.isEnabled('prescription')) return { status: 'disabled' as const, prescription: null };
    try {
      const result = await this.recompute(userId);
      return result?.prescription
        ? { status: 'ready' as const, goalId: result.gap.goalId, prescription: result.prescription }
        : { status: 'goal_unset' as const, prescription: null };
    } catch (error) {
      if (error instanceof Error && error.message === 'LEARNING_DECISION_STATE_UPDATING') {
        return { status: 'updating' as const, prescription: null };
      }
      throw error;
    }
  }

  async recompute(userId: number) {
    if (!this.featureFlags.isEnabled('targetGap')) return null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DECISION_LOCK_NAMESPACE}::int, ${userId}::int)`;
          const now = new Date();
          const loaded = await this.loadDecisionInput(tx, userId, now);
          if (!loaded) return null;
          if (loaded.adaptationPending) throw new Error('LEARNING_DECISION_STATE_UPDATING');
          const gapValue = buildTargetGapSnapshot(loaded.input);
          const prescriptionValue = buildLearningPrescription(loaded.input, gapValue.gaps);
          const gap = await tx.targetGapSnapshot.upsert({
            where: { userId_goalId_versionHash: { userId, goalId: loaded.input.goalId, versionHash: loaded.versionHash } },
            create: {
              id: gapValue.gapSnapshotId,
              userId,
              goalId: loaded.input.goalId,
              versionHash: loaded.versionHash,
              versions: gapValue.versions as unknown as Prisma.InputJsonValue,
              gaps: gapValue.gaps as unknown as Prisma.InputJsonValue,
              evidenceCutoffAt: loaded.input.evidenceCutoffAt,
              createdAt: loaded.input.generatedAt
            },
            update: {}
          });

          let prescription: Awaited<ReturnType<typeof tx.learningPrescription.upsert>> | null = null;
          if (this.featureFlags.isEnabled('prescription')) {
            prescription = await tx.learningPrescription.upsert({
              where: { userId_goalId_versionHash: { userId, goalId: loaded.input.goalId, versionHash: loaded.versionHash } },
              create: {
                id: prescriptionValue.prescriptionId,
                userId,
                goalId: loaded.input.goalId,
                versionHash: loaded.versionHash,
                versions: prescriptionValue.versions as unknown as Prisma.InputJsonValue,
                objective: prescriptionValue.objective,
                reasonCodes: prescriptionValue.reasonCodes as unknown as Prisma.InputJsonValue,
                reasonSummary: prescriptionValue.reasonSummary,
                confidence: prescriptionValue.confidence,
                estimatedMinutes: prescriptionValue.estimatedMinutes,
                tasks: prescriptionValue.tasks as unknown as Prisma.InputJsonValue,
                alternatives: prescriptionValue.alternatives as unknown as Prisma.InputJsonValue,
                validUntil: new Date(prescriptionValue.validUntil),
                createdAt: loaded.input.generatedAt
              },
              update: {}
            });
            const current = await this.loadDecisionInput(tx, userId, now);
            if (!current || current.versionHash !== loaded.versionHash) throw new Error('LEARNING_DECISION_INPUT_CHANGED');
            const published = await tx.learningDecisionCurrent.findFirst({ where: { goalId: loaded.input.goalId, userId } });
            if (!published) {
              await tx.learningDecisionCurrent.create({ data: {
                userId,
                goalId: loaded.input.goalId,
                versionHash: loaded.versionHash,
                gapSnapshotId: gap.id,
                prescriptionId: prescription.id
              } });
            } else if (published.versionHash !== loaded.versionHash) {
              const swapped = await tx.learningDecisionCurrent.updateMany({
                where: { goalId: loaded.input.goalId, userId, revision: published.revision },
                data: {
                versionHash: loaded.versionHash,
                gapSnapshotId: gap.id,
                prescriptionId: prescription.id,
                revision: { increment: 1 }
                }
              });
              if (swapped.count !== 1) throw new Error('LEARNING_DECISION_PUBLICATION_CONFLICT');
            }
          }

          return {
            gap: TargetGapSnapshotV1Schema.parse({
              schemaVersion: '1', gapSnapshotId: gap.id, goalId: gap.goalId, userId: gap.userId,
              versions: gap.versions, gaps: gap.gaps, evidenceCutoffAt: gap.evidenceCutoffAt.toISOString(),
              createdAt: gap.createdAt.toISOString()
            }),
            prescription: prescription ? LearningPrescriptionV1Schema.parse({
              schemaVersion: '1', prescriptionId: prescription.id, userId: prescription.userId,
              versions: prescription.versions, objective: prescription.objective, reasonCodes: prescription.reasonCodes,
              reasonSummary: prescription.reasonSummary, confidence: prescription.confidence,
              estimatedMinutes: prescription.estimatedMinutes, tasks: prescription.tasks,
              alternatives: prescription.alternatives, validUntil: prescription.validUntil.toISOString(),
              createdAt: prescription.createdAt.toISOString()
            }) : null,
            versionHash: loaded.versionHash
          };
        });
      } catch (error) {
        if (error instanceof Error && ['LEARNING_DECISION_INPUT_CHANGED', 'LEARNING_DECISION_PUBLICATION_CONFLICT'].includes(error.message) && attempt === 0) continue;
        throw error;
      }
    }
    throw new Error('LEARNING_DECISION_INPUT_CHANGED');
  }

  private async loadDecisionInput(tx: Prisma.TransactionClient, userId: number, now: Date): Promise<(LoadedDecision & { adaptationPending: boolean }) | null> {
    const goal = await tx.studentScoreGoal.findFirst({
      where: { userId, status: 'active' },
      include: { subjects: { orderBy: [{ priority: 'asc' }, { subjectCode: 'asc' }] } },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
    });
    if (!goal) return null;
    const subjectPriorities = goal.subjects.flatMap((item) => {
      const subject = CscaSubjectCodeSchema.safeParse(item.subjectCode);
      return subject.success ? [{ subject: subject.data, priority: item.priority }] : [];
    });
    if (!subjectPriorities.length) return null;
    const subjects = subjectPriorities.map((item) => item.subject);
    const [availability, imports, allTopics, checkpoints, states, dueReviews, recentMocks, interventionAssessments] = await Promise.all([
      tx.studyAvailabilityPreference.findFirst({
        where: { userId, status: 'active' }, orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
      }),
      tx.cscaSyllabusImport.findMany({
        where: { subject: { in: subjects }, status: 'applied' },
        select: { subject: true, syllabusVersion: true, appliedAt: true, id: true },
        orderBy: [{ appliedAt: 'desc' }, { id: 'desc' }]
      }),
      tx.cscaExamTopic.findMany({
        where: { subject: { in: subjects }, status: 'published' },
        select: { id: true, subject: true, syllabusVersion: true, updatedAt: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }]
      }),
      tx.learningStateProjectionCheckpoint.findMany({
        where: { userId, subjectCode: { in: subjects }, projectorVersion: LEARNING_STATE_PROJECTOR_VERSION }
      }),
      tx.userCscaTopicStateV2.findMany({
        where: { userId, subjectCode: { in: subjects }, modelVersion: LEARNING_STATE_MODEL_VERSION }
      }),
      tx.cscaWrongPattern.findMany({
        where: { userId, subject: { in: subjects }, status: { in: ['active', 'improving'] }, nextReviewAt: { lte: now } },
        select: { id: true, subject: true, topicId: true, recurrenceCount: true, nextReviewAt: true, status: true },
        orderBy: [{ nextReviewAt: 'asc' }, { id: 'asc' }]
      }),
      tx.mockExamAttempt.findMany({
        where: { userId, submittedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) }, paper: { subject: { in: subjects } } },
        select: { id: true, submittedAt: true, score: true, paper: { select: { subject: true } } },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }]
      }),
      tx.learningInterventionStabilityAssessment.findMany({
        where: { userId, intervention: { subjectCode: { in: subjects } } },
        select: {
          id: true, deliveryId: true, status: true, result: true, policyVersion: true,
          phaseResults: true, evidenceRefs: true, evaluatedAt: true, updatedAt: true,
          intervention: { select: { subjectCode: true, topicId: true } },
          delivery: { select: { verifications: {
            select: { id: true, phase: true, status: true, dueAt: true, expiresAt: true, updatedAt: true },
            orderBy: [{ dueAt: 'asc' }, { id: 'asc' }]
          } } }
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 200
      })
    ]);

    const syllabusBySubject = new Map<CscaSubjectCode, string>();
    for (const item of imports) {
      const subject = CscaSubjectCodeSchema.safeParse(item.subject);
      if (subject.success && !syllabusBySubject.has(subject.data)) syllabusBySubject.set(subject.data, item.syllabusVersion);
    }
    for (const topic of allTopics) {
      const subject = CscaSubjectCodeSchema.safeParse(topic.subject);
      if (subject.success && !syllabusBySubject.has(subject.data)) syllabusBySubject.set(subject.data, topic.syllabusVersion);
    }
    const topics = allTopics.filter((topic) => syllabusBySubject.get(topic.subject as CscaSubjectCode) === topic.syllabusVersion);
    const stateByTopic = new Map(states.map((state) => [state.topicId, state]));
    const decisionTopics: DecisionTopicInput[] = topics.flatMap((topic) => {
      const subject = CscaSubjectCodeSchema.safeParse(topic.subject);
      if (!subject.success) return [];
      const state = stateByTopic.get(topic.id);
      return [{
        topicId: topic.id,
        subject: subject.data,
        mastery: state?.mastery ?? null,
        confidence: state?.confidence ?? 0,
        independence: state?.independence ?? null,
        difficultyCeiling: state?.difficultyCeiling ?? null,
        retention: state?.retention ?? null,
        fluency: state?.fluency ?? null,
        transfer: state?.transfer ?? null,
        evidenceCount: state?.evidenceCount ?? 0,
        incorrectCount: misconceptionCount(state?.misconceptionState ?? null),
        stateVersion: state?.stateVersion ?? null,
        stateEventSequence: stateEventSequence(state?.stateVersion)
      }];
    });
    const assessmentEvidenceIds = [...new Set(interventionAssessments.flatMap((item) => evidenceReferenceIds(item.evidenceRefs)))];
    const assessmentEvidence = assessmentEvidenceIds.length ? await tx.learningEvidenceEvent.findMany({
      where: { userId, id: { in: assessmentEvidenceIds } },
      select: { id: true, eventSequence: true, retraction: { select: { id: true } } }
    }) : [];
    const evidenceSequenceById = new Map(assessmentEvidence.map((item) => [item.id, item.eventSequence]));
    const currentEvidenceIds = new Set(assessmentEvidence.filter((item) => !item.retraction).map((item) => item.id));
    const assessmentSequence = (value: Prisma.JsonValue | null | undefined) => evidenceReferenceIds(value)
      .flatMap((id) => evidenceSequenceById.has(id) ? [evidenceSequenceById.get(id)!] : [])
      .reduce<bigint | null>((latest, sequence) => latest === null || sequence > latest ? sequence : latest, null);
    const interventionSignals: InterventionDecisionSignal[] = interventionAssessments.flatMap((assessment) => {
      const subject = CscaSubjectCodeSchema.safeParse(assessment.intervention.subjectCode);
      if (!subject.success) return [];
      const signals: InterventionDecisionSignal[] = [];
      const referencedEvidenceIds = evidenceReferenceIds(assessment.evidenceRefs);
      const supplyGap = hasSupplyGap(assessment.phaseResults);
      const evidenceTrusted = supplyGap || (referencedEvidenceIds.length > 0
        && referencedEvidenceIds.every((id) => currentEvidenceIds.has(id)));
      if (assessment.status === 'completed' && ['stable', 'not_stable', 'inconclusive'].includes(assessment.result ?? '')) {
        const kind = assessment.result as 'stable' | 'not_stable' | 'inconclusive';
        signals.push({
          assessmentId: assessment.id, deliveryId: assessment.deliveryId, subject: subject.data,
          topicId: assessment.intervention.topicId, kind,
          phase: kind === 'not_stable' ? stabilityPhase(assessment.phaseResults, 'failed')
            : kind === 'inconclusive' ? stabilityPhase(assessment.phaseResults, 'inconclusive') : 'transfer',
          verificationId: null, dueAt: null, effectiveAt: assessment.evaluatedAt ?? assessment.updatedAt,
          evidenceSequence: assessmentSequence(assessment.evidenceRefs),
          evidenceTrusted, supplyGap
        });
      }
      const active = assessment.delivery.verifications
        .filter((verification) => (verification.phase === 'retention' || verification.phase === 'transfer')
          && ['scheduled', 'recommended', 'started'].includes(verification.status)
          && verification.expiresAt.getTime() > now.getTime())
        .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime() || left.id.localeCompare(right.id))[0];
      if (active) {
        signals.push({
          assessmentId: assessment.id, deliveryId: assessment.deliveryId, subject: subject.data,
          topicId: assessment.intervention.topicId,
          kind: active.dueAt.getTime() <= now.getTime() ? 'verification_due' : 'verification_scheduled',
          phase: active.phase as 'retention' | 'transfer', verificationId: active.id, dueAt: active.dueAt,
          effectiveAt: active.updatedAt, evidenceSequence: null, evidenceTrusted, supplyGap: false
        });
      }
      return signals;
    });
    const latestEvidence = await Promise.all(subjects.map((subject) => tx.learningEvidenceEvent.findFirst({
      where: { userId, subjectCode: subject }, select: { eventSequence: true, occurredAt: true },
      orderBy: { eventSequence: 'desc' }
    })));
    const checkpointBySubject = new Map(checkpoints.map((item) => [item.subjectCode, item]));
    const evidenceVector = subjects.map((subject, index) => `${subject}:${latestEvidence[index]?.eventSequence ?? 0}`).sort();
    const stateVector = subjects.map((subject) => `${subject}:${checkpointBySubject.get(subject)?.lastEvidenceVersion ?? 'unprojected'}`).sort();
    const syllabusVector = subjects.map((subject) => {
      const version = syllabusBySubject.get(subject) ?? 'unavailable';
      const fingerprint = allTopics
        .filter((topic) => topic.subject === subject && topic.syllabusVersion === version)
        .map((topic) => [topic.id, topic.updatedAt.toISOString()]);
      return `${subject}:${version}:${hash(fingerprint).slice(0, 16)}`;
    }).sort();
    const contextVersion = hash({
      planningDate: now.toISOString().slice(0, 10),
      dueReviews: dueReviews.map((item) => [item.id, item.topicId, item.recurrenceCount, item.nextReviewAt?.toISOString(), item.status]),
      recentMocks: recentMocks.map((item) => [item.id, item.paper.subject, item.score, item.submittedAt?.toISOString()]),
      interventionAssessments: interventionAssessments.map((item) => [
        item.id, item.deliveryId, item.status, item.result, item.policyVersion, item.updatedAt.toISOString(),
        item.evaluatedAt?.toISOString(), item.phaseResults, item.evidenceRefs,
        item.delivery.verifications.map((verification) => [
          verification.id, verification.phase, verification.status, verification.dueAt.toISOString(),
          verification.expiresAt.toISOString(), verification.dueAt.getTime() > now.getTime() ? 'future'
            : verification.expiresAt.getTime() <= now.getTime() ? 'expired' : 'due'
        ])
      ]),
      assessmentEvidence: assessmentEvidence.map((item) => [item.id, item.eventSequence.toString(), Boolean(item.retraction)])
    });
    const versions: LearningDecisionVersionVectorV1 = {
      goalVersion: `goal:${goal.id}:v${goal.version}`,
      availabilityVersion: availability ? `availability:v${availability.version}` : goal.availabilityVersion || 'unset',
      evidenceVersion: `evidence:${hash(evidenceVector).slice(0, 24)}`,
      learningStateVersion: `state:${hash(stateVector).slice(0, 24)}`,
      learningModelVersion: LEARNING_STATE_MODEL_VERSION,
      syllabusVersion: `syllabus:${hash(syllabusVector).slice(0, 24)}`,
      scoringPolicyVersion: goal.scoringPolicyVersion,
      itemCalibrationVersion: LEARNING_ITEM_CALIBRATION_VERSION,
      decisionPolicyVersion: LEARNING_DECISION_POLICY_VERSION,
      decisionContextVersion: `context:${contextVersion.slice(0, 24)}`,
      forecastModelVersion: LEARNING_FORECAST_MODEL_VERSION
    };
    const versionHash = hash(versions);
    const evidenceDates = latestEvidence.flatMap((item) => item?.occurredAt ? [item.occurredAt] : []);
    const evidenceCutoffAt = evidenceDates.length
      ? new Date(Math.max(...evidenceDates.map((date) => date.getTime())))
      : now;
    return {
      versionHash,
      adaptationPending: subjects.some((subject, index) =>
        (checkpointBySubject.get(subject)?.lastEventSequence ?? 0n) < (latestEvidence[index]?.eventSequence ?? 0n)),
      input: {
        userId,
        goalId: goal.id,
        examDate: goal.examDate,
        subjectPriorities,
        topics: decisionTopics,
        dueReviewTopicIds: dueReviews.flatMap((item) => item.topicId ? [item.topicId] : []),
        recentMockSubjects: recentMocks.flatMap((item) => {
          const subject = CscaSubjectCodeSchema.safeParse(item.paper.subject);
          return subject.success ? [subject.data] : [];
        }),
        interventionSignals,
        defaultSessionMinutes: availability?.defaultSessionMinutes ?? null,
        versions,
        evidenceCutoffAt,
        generatedAt: now,
        versionHash
      }
    };
  }
}
