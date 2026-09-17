import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';

export const EXAM_OUTCOME_CONSENT_VERSION = 'csca-exam-outcome-consent-v1';
export const EXAM_OUTCOME_CONSENT_PURPOSE = 'score_calibration_and_product_improvement';
const EXAM_EVIDENCE_RETENTION_MS = 730 * 24 * 60 * 60 * 1000;

const SubjectSchema = z.enum(['math', 'physics', 'chemistry']);
const ReasonSchema = z.string().trim().min(8).max(500);
const StudentReasonSchema = z.string().trim().min(1).max(500).optional();
const SubmissionSchema = z.strictObject({
  subjectCode: SubjectSchema,
  examDate: z.iso.date(),
  examFormCode: z.string().trim().min(1).max(80).nullable().optional(),
  score: z.number().finite(),
  scoringPolicyVersion: z.string().trim().min(1).max(80),
  attachmentIds: z.array(z.string().min(1).max(120)).min(1).max(5),
  consent: z.literal(true),
  consentVersion: z.literal(EXAM_OUTCOME_CONSENT_VERSION)
}).superRefine((value, context) => {
  if (new Set(value.attachmentIds).size !== value.attachmentIds.length) {
    context.addIssue({ code: 'custom', path: ['attachmentIds'], message: 'Evidence attachment IDs must be unique.' });
  }
  if (new Date(`${value.examDate}T00:00:00.000Z`).getTime() > Date.now() + 86_400_000) {
    context.addIssue({ code: 'custom', path: ['examDate'], message: 'Exam date cannot be in the future.' });
  }
});

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new BadRequestException({ code: 'VALIDATION_FAILED', issues: result.error.issues });
  return result.data;
}

function scoreRange(scoreScale: unknown, subjectCode: string) {
  const scale = scoreScale as { subjects?: Record<string, { minimum?: unknown; maximum?: unknown }> };
  const subject = scale?.subjects?.[subjectCode];
  const minimum = Number(subject?.minimum);
  const maximum = Number(subject?.maximum);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) {
    throw new ConflictException('The referenced scoring policy has no valid subject score scale.');
  }
  return { minimum, maximum };
}

function outcomeEvent(input: {
  outcomeId: string; actorUserId: number; actorRole: 'student' | 'admin'; action: string;
  fromStatus?: string | null; toStatus: string; reason: string; payload?: Record<string, unknown>;
}) {
  return { ...input, fromStatus: input.fromStatus ?? null,
    payload: (input.payload ?? {}) as Prisma.InputJsonValue };
}

const publicInclude = {
  evidence: { select: { id: true, label: true, attachment: { select: {
    id: true, originalName: true, detectedMime: true, sizeBytes: true, status: true, createdAt: true
  } } } },
  events: { select: { action: true, fromStatus: true, toStatus: true, actorRole: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const } }
};

@Injectable()
export class StudentExamOutcomeService {
  constructor(private readonly prisma: PrismaService) {}

  listForStudent(userId: number) {
    return this.prisma.studentExamOutcome.findMany({
      where: { userId }, include: publicInclude, orderBy: [{ examDate: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async submit(userId: number, raw: unknown) {
    const input = parse(SubmissionSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const checked = await this.validateSubmission(tx, userId, input);
      await this.lockEvidence(tx, userId, input.attachmentIds);
      const duplicate = await tx.studentExamOutcome.findFirst({ where: {
        userId, subjectCode: input.subjectCode, examDate: checked.examDate,
        examFormCode: input.examFormCode ?? null, status: { in: ['submitted', 'reviewed', 'verified'] }
      }, select: { id: true } });
      if (duplicate) throw new ConflictException('An open result already exists for this exam. Submit a correction instead.');
      const outcome = await tx.studentExamOutcome.create({ data: {
        userId, subjectCode: input.subjectCode, examDate: checked.examDate,
        examFormCode: input.examFormCode ?? null, score: input.score,
        scoringPolicyVersion: input.scoringPolicyVersion,
        consentPurpose: EXAM_OUTCOME_CONSENT_PURPOSE, consentVersion: input.consentVersion,
        consentedAt: new Date(), evidence: { create: input.attachmentIds.map((attachmentId) => ({ attachmentId })) }
      } });
      await tx.studentExamOutcomeEvent.create({ data: outcomeEvent({
        outcomeId: outcome.id, actorUserId: userId, actorRole: 'student', action: 'submitted',
        toStatus: 'submitted', reason: 'Student voluntarily submitted an examination result with explicit consent.',
        payload: { consentVersion: input.consentVersion, evidenceCount: input.attachmentIds.length }
      }) });
      return tx.studentExamOutcome.findUnique({ where: { id: outcome.id }, include: publicInclude });
    });
  }

  async correct(userId: number, outcomeId: string, raw: unknown) {
    const input = parse(SubmissionSchema, raw);
    return this.prisma.$transaction(async (tx) => {
      const checked = await this.validateSubmission(tx, userId, input);
      await this.lockEvidence(tx, userId, input.attachmentIds);
      const current = await tx.studentExamOutcome.findFirst({ where: { id: outcomeId, userId } });
      if (!current) throw new NotFoundException('Exam outcome not found.');
      if (['withdrawn', 'superseded'].includes(current.status)) throw new ConflictException('Closed outcomes cannot be corrected again.');
      const duplicate = await tx.studentExamOutcome.findFirst({ where: {
        id: { not: current.id }, userId, subjectCode: input.subjectCode, examDate: checked.examDate,
        examFormCode: input.examFormCode ?? null, status: { in: ['submitted', 'reviewed', 'verified'] }
      }, select: { id: true } });
      if (duplicate) throw new ConflictException('Another open result already exists for the corrected exam identity.');
      const now = new Date();
      const changed = await tx.studentExamOutcome.updateMany({ where: { id: outcomeId, userId, status: current.status },
        data: { status: 'superseded', consentWithdrawnAt: now } });
      if (changed.count !== 1) throw new ConflictException('Exam outcome changed during correction.');
      const replacement = await tx.studentExamOutcome.create({ data: {
        userId, subjectCode: input.subjectCode, examDate: checked.examDate,
        examFormCode: input.examFormCode ?? null, score: input.score,
        scoringPolicyVersion: input.scoringPolicyVersion,
        consentPurpose: EXAM_OUTCOME_CONSENT_PURPOSE, consentVersion: input.consentVersion,
        consentedAt: now, replacesOutcomeId: current.id,
        evidence: { create: input.attachmentIds.map((attachmentId) => ({ attachmentId })) }
      } });
      await tx.studentExamOutcomeEvent.createMany({ data: [
        outcomeEvent({ outcomeId: current.id, actorUserId: userId, actorRole: 'student', action: 'superseded_by_correction',
          fromStatus: current.status, toStatus: 'superseded', reason: 'Student replaced the result with a corrected submission.',
          payload: { replacementOutcomeId: replacement.id } }),
        outcomeEvent({ outcomeId: replacement.id, actorUserId: userId, actorRole: 'student', action: 'correction_submitted',
          toStatus: 'submitted', reason: 'Student voluntarily submitted a corrected result with fresh consent.',
          payload: { replacesOutcomeId: current.id, consentVersion: input.consentVersion } })
      ] });
      await this.invalidateCalibrationUse(tx, current.id, userId, 'Student corrected a previously submitted examination result.');
      return tx.studentExamOutcome.findUnique({ where: { id: replacement.id }, include: publicInclude });
    });
  }

  async withdraw(userId: number, outcomeId: string, rawReason: unknown) {
    const reason = parse(StudentReasonSchema, rawReason) || 'Student withdrew consent for examination result use.';
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.studentExamOutcome.findFirst({ where: { id: outcomeId, userId } });
      if (!current) throw new NotFoundException('Exam outcome not found.');
      if (['withdrawn', 'superseded'].includes(current.status)) throw new ConflictException('Exam outcome is already closed.');
      const changed = await tx.studentExamOutcome.updateMany({ where: { id: outcomeId, userId, status: current.status },
        data: { status: 'withdrawn', consentWithdrawnAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException('Exam outcome changed during withdrawal.');
      await tx.studentExamOutcomeEvent.create({ data: outcomeEvent({ outcomeId, actorUserId: userId,
        actorRole: 'student', action: 'consent_withdrawn', fromStatus: current.status, toStatus: 'withdrawn', reason }) });
      await this.invalidateCalibrationUse(tx, outcomeId, userId, reason);
      return tx.studentExamOutcome.findUnique({ where: { id: outcomeId }, include: publicInclude });
    });
  }

  listForAdmin(status?: unknown) {
    const safeStatus = status === undefined ? undefined : parse(z.enum(['submitted', 'reviewed', 'verified', 'rejected', 'withdrawn', 'superseded']), status);
    return this.prisma.studentExamOutcome.findMany({ where: safeStatus ? { status: safeStatus } : {},
      include: { evidence: { include: { attachment: { select: { id: true, userId: true, originalName: true,
        detectedMime: true, sizeBytes: true, status: true, sha256: true, createdAt: true } } } }, events: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ createdAt: 'asc' }], take: 500 });
  }

  async review(outcomeId: string, actorUserId: number, rawReason: unknown) {
    const reason = parse(ReasonSchema, rawReason);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.studentExamOutcome.findUnique({ where: { id: outcomeId }, include: { evidence: { include: { attachment: true } } } });
      if (!current) throw new NotFoundException('Exam outcome not found.');
      if (current.status !== 'submitted' || current.consentWithdrawnAt) throw new ConflictException('Only active submitted outcomes can be reviewed.');
      if (!current.evidence.length || current.evidence.some((item) => item.attachment.userId !== current.userId
        || item.attachment.status !== 'ready' || item.attachment.deletedAt)) {
        throw new ConflictException('All evidence must be private, owned by the student, and ready before review.');
      }
      const changed = await tx.studentExamOutcome.updateMany({ where: { id: outcomeId, status: 'submitted', consentWithdrawnAt: null },
        data: { status: 'reviewed', reviewedByUserId: actorUserId, reviewedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException('Exam outcome changed during review.');
      await tx.studentExamOutcomeEvent.create({ data: outcomeEvent({ outcomeId, actorUserId, actorRole: 'admin',
        action: 'reviewed', fromStatus: 'submitted', toStatus: 'reviewed', reason,
        payload: { evidenceSha256: current.evidence.map((item) => item.attachment.sha256) } }) });
      return tx.studentExamOutcome.findUnique({ where: { id: outcomeId } });
    });
  }

  async verify(outcomeId: string, actorUserId: number, rawReason: unknown) {
    const reason = parse(ReasonSchema, rawReason);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.studentExamOutcome.findUnique({ where: { id: outcomeId } });
      if (!current) throw new NotFoundException('Exam outcome not found.');
      if (current.status !== 'reviewed' || !current.reviewedByUserId || current.consentWithdrawnAt) {
        throw new ConflictException('Only active, independently reviewed outcomes can be verified.');
      }
      if (current.reviewedByUserId === actorUserId) throw new ConflictException('Reviewer and verifier must be different administrators.');
      const changed = await tx.studentExamOutcome.updateMany({ where: { id: outcomeId, status: 'reviewed',
        reviewedByUserId: current.reviewedByUserId, consentWithdrawnAt: null }, data: {
        status: 'verified', verifiedByUserId: actorUserId, verifiedAt: new Date()
      } });
      if (changed.count !== 1) throw new ConflictException('Exam outcome changed during verification.');
      await tx.studentExamOutcomeEvent.create({ data: outcomeEvent({ outcomeId, actorUserId, actorRole: 'admin',
        action: 'verified', fromStatus: 'reviewed', toStatus: 'verified', reason,
        payload: { reviewedByUserId: current.reviewedByUserId } }) });
      return tx.studentExamOutcome.findUnique({ where: { id: outcomeId } });
    });
  }

  async reject(outcomeId: string, actorUserId: number, rawReason: unknown) {
    const reason = parse(ReasonSchema, rawReason);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.studentExamOutcome.findUnique({ where: { id: outcomeId } });
      if (!current) throw new NotFoundException('Exam outcome not found.');
      if (!['submitted', 'reviewed'].includes(current.status)) throw new ConflictException('Only pending outcomes can be rejected.');
      const changed = await tx.studentExamOutcome.updateMany({ where: { id: outcomeId, status: current.status }, data: { status: 'rejected' } });
      if (changed.count !== 1) throw new ConflictException('Exam outcome changed during rejection.');
      await tx.studentExamOutcomeEvent.create({ data: outcomeEvent({ outcomeId, actorUserId, actorRole: 'admin',
        action: 'rejected', fromStatus: current.status, toStatus: 'rejected', reason }) });
      return tx.studentExamOutcome.findUnique({ where: { id: outcomeId } });
    });
  }

  async invalidate(outcomeId: string, actorUserId: number, rawReason: unknown) {
    const reason = parse(ReasonSchema, rawReason);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.studentExamOutcome.findUnique({ where: { id: outcomeId } });
      if (!current) throw new NotFoundException('Exam outcome not found.');
      if (current.status !== 'verified') throw new ConflictException('Only verified outcomes can have verification revoked.');
      const changed = await tx.studentExamOutcome.updateMany({ where: { id: outcomeId, status: 'verified' },
        data: { status: 'rejected' } });
      if (changed.count !== 1) throw new ConflictException('Exam outcome changed during invalidation.');
      await tx.studentExamOutcomeEvent.create({ data: outcomeEvent({ outcomeId, actorUserId, actorRole: 'admin',
        action: 'verification_revoked', fromStatus: 'verified', toStatus: 'rejected', reason }) });
      await this.invalidateCalibrationUse(tx, outcomeId, actorUserId, reason);
      return tx.studentExamOutcome.findUnique({ where: { id: outcomeId } });
    });
  }

  private async validateSubmission(db: Prisma.TransactionClient, userId: number, input: z.infer<typeof SubmissionSchema>) {
    const [policy, attachments] = await Promise.all([
      db.examScoringPolicy.findUnique({ where: { policyVersion: input.scoringPolicyVersion } }),
      db.agentAttachment.findMany({ where: { id: { in: input.attachmentIds }, userId, deletedAt: null, status: 'ready' },
        select: { id: true } })
    ]);
    if (!policy || policy.examSystemCode !== 'csca' || policy.sourceType !== 'official'
      || !['active', 'superseded'].includes(policy.status)) {
      throw new BadRequestException('A registered official CSCA scoring policy is required.');
    }
    const examDate = new Date(`${input.examDate}T00:00:00.000Z`);
    if ((policy.effectiveFrom && examDate < policy.effectiveFrom) || (policy.effectiveTo && examDate > policy.effectiveTo)) {
      throw new BadRequestException('Exam date is outside the scoring policy effective period.');
    }
    const range = scoreRange(policy.scoreScale, input.subjectCode);
    if (input.score < range.minimum || input.score > range.maximum) {
      throw new BadRequestException(`Score must be between ${range.minimum} and ${range.maximum}.`);
    }
    if (attachments.length !== input.attachmentIds.length) {
      throw new BadRequestException('Every evidence attachment must be ready, private, and owned by the submitting student.');
    }
    return { examDate };
  }

  private async lockEvidence(tx: Prisma.TransactionClient, userId: number, attachmentIds: string[]) {
    const retainedUntil = new Date(Date.now() + EXAM_EVIDENCE_RETENTION_MS);
    const locked = await tx.agentAttachment.updateMany({ where: {
      id: { in: attachmentIds }, userId, status: 'ready', deletedAt: null
    }, data: { retainedUntil } });
    if (locked.count !== attachmentIds.length) {
      throw new ConflictException('Evidence changed while the exam outcome was being submitted.');
    }
  }

  private async invalidateCalibrationUse(tx: Prisma.TransactionClient, outcomeId: string, actorUserId: number, reason: string) {
    const manifests = await tx.forecastCalibrationDatasetManifest.findMany({
      where: { status: 'active', rows: { some: { outcomeId } } }, include: { snapshots: true }
    });
    for (const manifest of manifests) {
      await tx.forecastCalibrationDatasetManifest.updateMany({ where: { id: manifest.id, status: 'active' },
        data: { status: 'invalidated', invalidatedAt: new Date(), invalidationReason: reason.slice(0, 500) } });
      for (const snapshot of manifest.snapshots.filter((item) => !['retired', 'rejected'].includes(item.status))) {
        await tx.forecastCalibrationSnapshot.updateMany({ where: { id: snapshot.id, status: snapshot.status }, data: { status: 'retired' } });
        await tx.scoreCalibrationGovernanceEvent.create({ data: {
          resourceType: 'forecast_calibration', resourceId: snapshot.id, action: 'retired_source_invalidated',
          fromStatus: snapshot.status, toStatus: 'retired', actorUserId, reason: reason.slice(0, 500),
          payload: { datasetManifestId: manifest.id, invalidatedOutcomeId: outcomeId } as Prisma.InputJsonValue
        } });
      }
    }
  }
}
