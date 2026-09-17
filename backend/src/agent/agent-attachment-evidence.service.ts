import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { LearningDecisionService } from '../learning-intelligence/decision/learning-decision.service';
import { LearningEvidenceWriterService } from '../learning-intelligence/evidence/learning-evidence-writer.service';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence/learning-intelligence-feature-flags.service';
import { LearningStateProjectorService } from '../learning-intelligence/projection/learning-state-projector.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';
import { AgentTrustedQuestionMatcherService } from './agent-trusted-question-matcher.service';

const CANDIDATE_VERSION = 'attachment-evidence-candidate-v2';
const TOPIC_MAPPING_VERSION = 'student-confirmed-topic-v1';
const ANSWER_ASSESSMENT_VERSION = 'student-confirmed-ai-assessment-v1';

const ConfirmSchema = z.strictObject({
  clientRequestId: z.string().trim().min(8).max(120),
  topicId: z.number().int().positive(),
  confirmRecognition: z.literal(true),
  confirmAssessment: z.literal(true)
});
const DecisionSchema = z.strictObject({
  clientRequestId: z.string().trim().min(8).max(120),
  reason: z.string().trim().max(500).optional()
});

function analysisResult(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function mappedOutcome(value: unknown): 'correct' | 'incorrect' | 'partial' | null {
  if (value === 'correct' || value === 'incorrect') return value;
  return value === 'partially_correct' ? 'partial' : null;
}

function payload(row: any) {
  return {
    id: row.id,
    analysisId: row.analysisId,
    analysisItemId: row.analysisItemId ?? null,
    attachmentId: row.attachmentId,
    conversationId: row.conversationId,
    status: row.status,
    subjectCode: row.subjectCode,
    suggestedTopicId: row.suggestedTopicId,
    confirmedTopicId: row.confirmedTopicId,
    outcome: row.outcome,
    confidence: row.confidence,
    gateReasons: row.gateReasons,
    sourceSnapshot: row.sourceSnapshot,
    evidenceId: row.evidenceId,
    decisionBefore: row.decisionBefore,
    decisionAfter: row.decisionAfter,
    confirmedAt: row.confirmedAt,
    rejectedAt: row.rejectedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

@Injectable()
export class AgentAttachmentEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentFlags: AgentRuntimeFeatureFlagsService,
    private readonly learningFlags: LearningIntelligenceFeatureFlagsService,
    private readonly writer: LearningEvidenceWriterService,
    private readonly projector: LearningStateProjectorService,
    private readonly decisions: LearningDecisionService,
    private readonly matcher: AgentTrustedQuestionMatcherService
  ) {}

  private get db(): any { return this.prisma as any; }

  async ensureForAnalysis(userId: number, analysisId: string) {
    this.assertEnabled();
    const analysis = await this.db.agentAttachmentAnalysis.findFirst({
      where: { id: analysisId, userId, status: 'completed' },
      include: { attachment: true, items: { orderBy: { ordinal: 'asc' } } }
    });
    if (!analysis) throw new NotFoundException('Completed attachment analysis not found.');
    const inputSnapshot = analysisResult(analysis.inputSnapshot);
    if (inputSnapshot.evidenceCandidateAllowed === false) return [];
    const units = analysis.items?.length ? analysis.items : [null];
    const candidates = [];
    for (const item of units) candidates.push(await this.ensureOne(userId, analysis, item));
    await this.attachCandidatesToMessage(analysis.conversationId, analysis.id, candidates);
    return candidates.map(payload);
  }

  private async ensureOne(userId: number, analysis: any, item: any | null) {
    const lookup = item
      ? { analysisItemId: item.id, userId }
      : { analysisId: analysis.id, analysisItemId: null, userId };
    const existing = await this.db.agentAttachmentEvidenceCandidate.findFirst({ where: lookup });
    if (existing) return existing;
    const parentResult = analysisResult(analysis.result);
    const result = item ? {
      contentType: item.studentAnswer ? 'question_and_answer' : 'question',
      subject: item.subjectCode || 'unknown', questionText: item.questionText,
      studentAnswer: item.studentAnswer || '', assessment: item.assessment,
      errors: item.errors, guidance: item.guidance, citations: item.citations,
      uncertainty: item.uncertainty || '', extractedContent: item.questionText,
      questionNumber: item.questionNumber || ''
    } : parentResult;
    const trustedMatch = this.agentFlags.isTrustedQuestionMatchEnabled()
      ? await this.matcher.ensure(userId, analysis, item || undefined)
      : { status: 'disabled', sourceType: null, sourceId: null, sourceVersion: null, sourceTitle: null, subjectCode: null, topicId: null, promptScore: 0, runnerUpScore: 0, extractedAnswer: null, verifiedOutcome: null, matcherVersion: null, matchSnapshot: {} };
    const trusted = trustedMatch.status === 'verified_answer';
    const outcome = trusted ? trustedMatch.verifiedOutcome : mappedOutcome(result.assessment);
    const subjectCode = trusted ? trustedMatch.subjectCode : ['math', 'physics', 'chemistry'].includes(result.subject) ? result.subject : null;
    const citations = Array.isArray(result.citations) ? result.citations : [];
    const confidence = trusted ? Math.min(0.95, trustedMatch.promptScore) : String(result.uncertainty || '').trim() ? 0.5 : 0.6;
    const gateReasons: string[] = [];
    if (!['student_answer', 'question_and_answer'].includes(result.contentType)) gateReasons.push('STUDENT_ANSWER_NOT_DETECTED');
    if (!subjectCode) gateReasons.push('SUBJECT_UNKNOWN');
    if (!outcome) gateReasons.push('ASSESSMENT_NOT_AVAILABLE');
    if (!citations.length) gateReasons.push('SOURCE_CITATION_MISSING');

    const topics = subjectCode ? await this.db.cscaExamTopic.findMany({
      where: { subject: { equals: subjectCode, mode: 'insensitive' }, status: 'published' },
      select: { id: true, code: true, title: true, module: true },
      orderBy: { id: 'asc' }
    }) : [];
    const sourceText = `${result.extractedContent || ''} ${result.summary || ''}`.toLowerCase();
    const suggested = topics
      .map((topic: any) => ({ topic, score: [topic.code, topic.title, topic.module].filter(Boolean).reduce((sum: number, token: string) => sum + (sourceText.includes(String(token).toLowerCase()) ? 1 : 0), 0) }))
      .sort((left: any, right: any) => right.score - left.score)[0];
    const suggestedTopicId = trusted ? trustedMatch.topicId : suggested?.score > 0 ? suggested.topic.id : null;
    if (!topics.length) gateReasons.push('PUBLISHED_TOPIC_UNAVAILABLE');

    const row = await this.db.agentAttachmentEvidenceCandidate.create({ data: {
      userId,
      conversationId: analysis.conversationId,
      analysisId: analysis.id,
      analysisItemId: item?.id || null,
      attachmentId: analysis.attachmentId,
      status: gateReasons.length ? 'blocked' : 'pending_confirmation',
      subjectCode,
      suggestedTopicId,
      outcome,
      confidence,
      gateReasons,
      sourceSnapshot: {
        schemaVersion: CANDIDATE_VERSION,
        attachment: { id: analysis.attachmentId, name: analysis.attachment.originalName, sha256: analysis.attachment.sha256, pageCount: analysis.attachment.pageCount },
        analysis: { id: analysis.id, itemId: item?.id || null, ordinal: item?.ordinal || null, questionNumber: result.questionNumber || null, questionText: result.questionText || null, studentAnswer: result.studentAnswer || null, pageNumber: item?.pageNumber || citations[0]?.pageNumber || null, region: item?.region || null, model: analysis.model, promptVersion: analysis.promptVersion, completedAt: analysis.completedAt, citations, assessment: result.assessment, uncertainty: result.uncertainty || null },
        trustedMatch,
        availableTopics: topics
      }
    } });
    return row;
  }

  async getForAnalysis(userId: number, analysisId: string) {
    const candidates = await this.ensureForAnalysis(userId, analysisId);
    return candidates[0] ?? null;
  }

  async list(userId: number, conversationId: string) {
    this.assertEnabled();
    const owned = await this.db.agentConversation.findFirst({ where: { id: conversationId, userId, deletedAt: null }, select: { id: true } });
    if (!owned) throw new NotFoundException('Agent conversation not found.');
    const rows = await this.db.agentAttachmentEvidenceCandidate.findMany({ where: { userId, conversationId }, orderBy: { createdAt: 'asc' } });
    return rows.map(payload);
  }

  async confirm(userId: number, candidateId: string, raw: unknown) {
    this.assertEnabled();
    if (!this.learningFlags.isEnabled('evidenceWrite')) throw new ServiceUnavailableException('Learning evidence writes are disabled.');
    const body = ConfirmSchema.parse(raw);
    const candidate = await this.owned(userId, candidateId);
    if (candidate.status === 'confirmed') return payload(candidate);
    if (candidate.status !== 'pending_confirmation') throw new ConflictException(`Evidence candidate is ${candidate.status}.`);
    const trustedMatch = await this.db.agentAttachmentQuestionMatch.findFirst({ where: candidate.analysisItemId
      ? { analysisItemId: candidate.analysisItemId, userId, status: 'verified_answer' }
      : { analysisId: candidate.analysisId, analysisItemId: null, userId, status: 'verified_answer' }
    });
    if (trustedMatch?.topicId && body.topicId !== trustedMatch.topicId) throw new BadRequestException('The confirmed topic must match the trusted question source.');
    const topic = await this.db.cscaExamTopic.findFirst({
      where: { id: body.topicId, subject: { equals: candidate.subjectCode, mode: 'insensitive' }, status: 'published' },
      select: { id: true, code: true, title: true, syllabusVersion: true }
    });
    if (!topic) throw new BadRequestException('Choose a published topic from the detected subject.');
    const before = await this.currentDecision(userId);
    const snapshot = analysisResult(candidate.sourceSnapshot);
    const trusted = Boolean(trustedMatch?.sourceType && trustedMatch?.sourceId && trustedMatch?.correctAnswerHash && trustedMatch?.verifiedOutcome);
    const questionId = trusted ? `${trustedMatch.sourceType}:${trustedMatch.sourceId}` : candidate.analysisItemId ? `attachment-analysis-item:${candidate.analysisItemId}` : `attachment-analysis:${candidate.analysisId}`;
    const questionVersion = trusted ? trustedMatch.sourceVersion : 1;
    const answerKeyVersion = trusted
      ? `trusted:${trustedMatch.sourceType}:${trustedMatch.sourceId}:v${trustedMatch.sourceVersion}:${String(trustedMatch.correctAnswerHash).slice(0, 16)}`
      : ANSWER_ASSESSMENT_VERSION;
    const sourceTrustTier = trusted ? trustedMatch.matchSnapshot?.selectedTrustTier : null;
    const result = await this.prisma.$transaction(async (tx: any) => {
      const claimed = await tx.agentAttachmentEvidenceCandidate.updateMany({
        where: { id: candidate.id, userId, status: 'pending_confirmation' },
        data: { confirmedTopicId: topic.id }
      });
      if (claimed.count !== 1) throw new ConflictException('Evidence candidate changed; reload and retry.');
      const written = await this.writer.appendInTransaction(tx, {
        schemaVersion: '1',
        eventId: `agent-hw-${candidate.id}`,
        userId,
        subjectCode: candidate.subjectCode,
        occurredAt: new Date(snapshot.analysis?.completedAt || candidate.createdAt).toISOString(),
        sourceType: 'verified_handwriting',
        sourceId: candidate.id,
        attemptSequence: 1,
        sessionId: candidate.conversationId,
        questionId,
        questionVersion,
        answerKeyVersion,
        topicMappingVersion: trusted ? 'trusted-source-topic-v1' : TOPIC_MAPPING_VERSION,
        scoringRubricVersion: candidate.sourceSnapshot?.analysis?.promptVersion || CANDIDATE_VERSION,
        exposureState: 'prompt_seen',
        topicEvidence: [{ topicId: topic.id, role: 'primary', weight: 1 }],
        outcome: trusted ? trustedMatch.verifiedOutcome : candidate.outcome,
        usedHint: false,
        usedExplanation: false,
        questionQualityConfidence: trusted
          ? Math.min(sourceTrustTier === 'governed_auto_approved' ? 0.88 : 0.95, Math.max(0.75, trustedMatch.promptScore))
          : Math.min(0.6, Math.max(0.25, candidate.confidence)),
        metadata: {
          provenance: snapshot,
          topic: { id: topic.id, code: topic.code, title: topic.title, syllabusVersion: topic.syllabusVersion },
          verification: trusted
            ? { tier: 'trusted_answer_key', sourceGovernance: sourceTrustTier, recognition: 'student_confirmed', assessment: 'deterministic_answer_key_comparison', sourceType: trustedMatch.sourceType, sourceId: trustedMatch.sourceId, sourceVersion: trustedMatch.sourceVersion, matcherVersion: trustedMatch.matcherVersion, promptScore: trustedMatch.promptScore, clientRequestId: body.clientRequestId }
            : { tier: 'student_confirmed_ai_assessment', recognition: 'student_confirmed', assessment: 'student_confirmed_ai_assessment', clientRequestId: body.clientRequestId },
          limitations: trusted ? [] : ['not_an_official_answer_key', 'low_weight_user_confirmed_evidence'],
          isolation: { automaticQuestionGenerationInvoked: false }
        }
      });
      const updated = await tx.agentAttachmentEvidenceCandidate.update({ where: { id: candidate.id }, data: {
        status: 'confirmed', evidenceId: written.evidenceId, decisionBefore: before, confirmedAt: new Date()
      } });
      return { updated, written };
    });
    await this.projector.processPending(100);
    const recomputed = await this.safeRecompute(userId);
    const after = recomputed ? { versionHash: recomputed.versionHash, reasonSummary: recomputed.prescription?.reasonSummary || null } : await this.currentDecision(userId);
    const updated = await this.db.agentAttachmentEvidenceCandidate.update({ where: { id: candidate.id }, data: { decisionAfter: after } });
    await this.refreshCandidatesOnMessage(updated.conversationId, updated.analysisId);
    await this.explainDecision(updated, before, after, 'confirmed');
    return { ...payload(updated), adaptationPending: result.written.adaptationPending && !recomputed, decisionChanged: before?.versionHash !== after?.versionHash };
  }

  async reject(userId: number, candidateId: string, raw: unknown) {
    this.assertEnabled();
    const body = DecisionSchema.parse(raw);
    const candidate = await this.owned(userId, candidateId);
    if (candidate.status === 'rejected') return payload(candidate);
    if (candidate.status !== 'pending_confirmation') throw new ConflictException(`Evidence candidate is ${candidate.status}.`);
    const updated = await this.db.agentAttachmentEvidenceCandidate.update({ where: { id: candidate.id }, data: {
      status: 'rejected', rejectedAt: new Date(), gateReasons: [...(Array.isArray(candidate.gateReasons) ? candidate.gateReasons : []), `STUDENT_REJECTED:${body.reason || 'unspecified'}`]
    } });
    await this.refreshCandidatesOnMessage(updated.conversationId, updated.analysisId);
    await this.explainDecision(updated, null, null, 'rejected');
    return payload(updated);
  }

  async revoke(userId: number, candidateId: string, raw: unknown) {
    this.assertEnabled();
    const body = DecisionSchema.parse(raw);
    const candidate = await this.owned(userId, candidateId);
    if (candidate.status === 'revoked') return payload(candidate);
    if (candidate.status !== 'confirmed' || !candidate.evidenceId) throw new ConflictException('Only confirmed evidence can be revoked.');
    const before = await this.currentDecision(userId);
    await this.prisma.$transaction(async (tx: any) => {
      await tx.learningEvidenceRetraction.upsert({
        where: { evidenceId: candidate.evidenceId },
        create: { evidenceId: candidate.evidenceId, userId, reasonCode: 'STUDENT_REVOKED_ATTACHMENT_EVIDENCE', reason: body.reason, clientRequestId: body.clientRequestId, metadata: { candidateId } },
        update: {}
      });
      await tx.agentAttachmentEvidenceCandidate.update({ where: { id: candidate.id }, data: { status: 'revoked', revokedAt: new Date(), decisionBefore: before } });
    });
    await this.projector.replayUserSubject(userId, candidate.subjectCode);
    const recomputed = await this.safeRecompute(userId);
    const after = recomputed ? { versionHash: recomputed.versionHash, reasonSummary: recomputed.prescription?.reasonSummary || null } : await this.currentDecision(userId);
    const updated = await this.db.agentAttachmentEvidenceCandidate.update({ where: { id: candidate.id }, data: { decisionAfter: after } });
    await this.refreshCandidatesOnMessage(updated.conversationId, updated.analysisId);
    await this.explainDecision(updated, before, after, 'revoked');
    return { ...payload(updated), decisionChanged: before?.versionHash !== after?.versionHash };
  }

  private async owned(userId: number, id: string) {
    const row = await this.db.agentAttachmentEvidenceCandidate.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Attachment evidence candidate not found.');
    return row;
  }

  private async currentDecision(userId: number) {
    const row = await this.db.learningDecisionCurrent.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' }, include: { prescription: true } });
    return row ? { versionHash: row.versionHash, reasonSummary: row.prescription?.reasonSummary || null } : null;
  }

  private async safeRecompute(userId: number) {
    try { return await this.decisions.recompute(userId); } catch (error) {
      if (error instanceof Error && error.message === 'LEARNING_DECISION_STATE_UPDATING') return null;
      throw error;
    }
  }

  private async refreshCandidatesOnMessage(conversationId: string, analysisId: string) {
    const candidates = await this.db.agentAttachmentEvidenceCandidate.findMany({ where: { conversationId, analysisId }, orderBy: { createdAt: 'asc' } });
    await this.attachCandidatesToMessage(conversationId, analysisId, candidates);
  }

  private async attachCandidatesToMessage(conversationId: string, analysisId: string, candidates: any[]) {
    const message = await this.db.agentMessage.findFirst({ where: { conversationId, clientMessageId: `attachment-analysis:${analysisId}` } });
    if (!message) return;
    const content = analysisResult(message.content);
    const rows = candidates.map(payload);
    const { evidenceCandidate: _legacyCandidate, ...rest } = content;
    await this.db.agentMessage.update({ where: { id: message.id }, data: { content: { ...rest, evidenceCandidates: rows, ...(rows.length === 1 ? { evidenceCandidate: rows[0] } : {}) } } });
  }

  private async explainDecision(candidate: any, before: any, after: any, action: 'confirmed' | 'rejected' | 'revoked') {
    const changed = before?.versionHash !== after?.versionHash;
    const text = action === 'confirmed'
      ? changed ? '这份手写答案已作为低权重、可撤销的学习证据记录，系统已据此更新后续学习方案。' : '这份手写答案已作为低权重、可撤销的学习证据记录；当前首选学习方案无需调整。'
      : action === 'revoked'
        ? changed ? '这份学习证据已撤销并从学习状态重放中排除，后续学习方案已重新计算。' : '这份学习证据已撤销；当前首选学习方案无需调整。'
        : '已忽略这条学习证据候选，它不会影响你的掌握度或学习方案。';
    await this.db.agentMessage.upsert({
      where: { conversationId_clientMessageId: { conversationId: candidate.conversationId, clientMessageId: `attachment-evidence:${candidate.id}:${action}` } },
      create: { conversationId: candidate.conversationId, role: 'assistant', clientMessageId: `attachment-evidence:${candidate.id}:${action}`, content: { schemaVersion: '1', text, evidenceCandidateAction: action, evidenceCandidateId: candidate.id, decisionChanged: changed } },
      update: { content: { schemaVersion: '1', text, evidenceCandidateAction: action, evidenceCandidateId: candidate.id, decisionChanged: changed } }
    });
    await this.db.agentConversation.update({ where: { id: candidate.conversationId }, data: { lastMessageAt: new Date() } });
  }

  private assertEnabled() {
    if (!this.agentFlags.isWebEnabled() || !this.agentFlags.isAttachmentEvidenceEnabled()) {
      throw new ServiceUnavailableException({ code: 'AGENT_ATTACHMENT_EVIDENCE_DISABLED', message: '附件学习证据功能暂未开放。' });
    }
  }
}
