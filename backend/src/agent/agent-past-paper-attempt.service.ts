import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence/learning-intelligence-feature-flags.service';
import { LearningDecisionService } from '../learning-intelligence/decision/learning-decision.service';
import { LEARNING_EVIDENCE_WRITER, LearningEvidenceWriter } from '../learning-intelligence/learning-evidence-writer.port';
import { LearningStateProjectorService } from '../learning-intelligence/projection/learning-state-projector.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentPastPaperQuestionService } from './agent-past-paper-question.service';
import { StartPastPaperAttemptInputSchema, SubmitPastPaperAttemptInputSchema } from './agent.types';

const ANSWER_POLICY_VERSION = 'past-paper-answer-v1';
const ASSISTANCE_TOOL = 'request_past_paper_assistance';
const REVIEWED_STATUSES = new Set(['approved', 'auto_approved']);
const SUPPORTED_SUBJECTS = new Set(['math', 'physics', 'chemistry']);
const LEVEL_ORDER = ['A0', 'A1', 'A2', 'A3', 'A6'];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionRows(value: unknown): Array<{ key: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (typeof item === 'string') return [{ key: String.fromCharCode(65 + index), text: item }];
    const row = objectValue(item);
    const text = String(row.text ?? row.label ?? row.value ?? '').trim();
    return text ? [{ key: String(row.key ?? row.id ?? String.fromCharCode(65 + index)).trim(), text }] : [];
  });
}

function normalizedAnswer(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[\s,，;；/]+/g, '|').replace(/^\||\|$/g, '');
}

function isCorrectAnswer(selected: string, correctAnswer: string, options: Array<{ key: string; text: string }>) {
  const selectedValue = normalizedAnswer(selected);
  const correctValue = normalizedAnswer(correctAnswer);
  if (!options.length) return selectedValue === correctValue;
  const exact = options.find((option) => normalizedAnswer(option.key) === correctValue || normalizedAnswer(option.text) === correctValue);
  if (exact) return selectedValue === normalizedAnswer(exact.key);
  const leadingKey = correctAnswer.trim().match(/^([A-Za-z0-9]+)\s*[.、:：)）-]/)?.[1];
  return Boolean(leadingKey && selectedValue === normalizedAnswer(leadingKey) && options.some((option) => normalizedAnswer(option.key) === normalizedAnswer(leadingKey)));
}

function answerKeyVersion(promptHash: string, answer: string) {
  return `past-paper:${createHash('sha256').update(`${promptHash}:${normalizedAnswer(answer)}`).digest('hex').slice(0, 20)}`;
}

@Injectable()
export class AgentPastPaperAttemptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: AgentPastPaperQuestionService,
    private readonly flags: LearningIntelligenceFeatureFlagsService,
    @Inject(LEARNING_EVIDENCE_WRITER) private readonly evidenceWriter: LearningEvidenceWriter,
    private readonly projector: LearningStateProjectorService,
    private readonly decisions: LearningDecisionService
  ) {}

  async progress(userId: number, slug: string, conversationId: string) {
    if (!conversationId) throw new NotFoundException('Agent 对话不存在。');
    const [conversation, paper, index] = await Promise.all([
      this.prisma.agentConversation.findFirst({ where: { id: conversationId, userId, deletedAt: null }, select: { id: true } }),
      this.prisma.pastPaper.findFirst({ where: { slug, isPublished: true, deletedAt: null }, select: { id: true, slug: true, title: true, subject: true } }),
      this.questions.index(slug)
    ]);
    if (!conversation) throw new NotFoundException('Agent 对话不存在。');
    if (!paper) throw new NotFoundException('真题资料不存在或尚未发布。');
    const attempts = await this.prisma.agentPastPaperAttempt.findMany({
      where: { userId, conversationId, pastPaperId: paper.id },
      orderBy: { updatedAt: 'desc' }
    });
    const byQuestion = new Map(attempts.map((attempt) => [attempt.sourceQuestionId, attempt]));
    const answerable = index.questions.filter((question) => question.canAnswer);
    const items = index.questions.map((question) => {
      const attempt = byQuestion.get(question.id);
      return {
        questionId: question.id,
        questionNumber: question.questionNumber,
        canAnswer: question.canAnswer,
        attemptId: attempt?.id ?? null,
        status: attempt?.status ?? 'not_started',
        outcome: attempt?.outcome ?? null,
        usedAssistance: attempt?.usedAssistance ?? false,
        evidenceStatus: attempt?.evidenceStatus ?? null
      };
    });
    const answerableIds = new Set(answerable.map((question) => question.id));
    const relevantAttempts = attempts.filter((attempt) => answerableIds.has(attempt.sourceQuestionId));
    const submitted = relevantAttempts.filter((attempt) => attempt.status === 'submitted');
    const inProgress = relevantAttempts.find((attempt) => attempt.status === 'in_progress' || attempt.status === 'submitting');
    const nextQuestion = inProgress
      ? answerable.find((question) => question.id === inProgress.sourceQuestionId)
      : answerable.find((question) => byQuestion.get(question.id)?.status !== 'submitted');
    const total = answerable.length;
    return {
      schemaVersion: '1' as const,
      policyVersion: ANSWER_POLICY_VERSION,
      paper,
      status: total > 0 && submitted.length >= total ? 'completed' as const : relevantAttempts.length ? 'in_progress' as const : 'not_started' as const,
      totalQuestions: index.questions.length,
      answerableQuestions: total,
      startedCount: relevantAttempts.length,
      submittedCount: submitted.length,
      correctCount: submitted.filter((attempt) => attempt.outcome === 'correct').length,
      incorrectCount: submitted.filter((attempt) => attempt.outcome === 'incorrect').length,
      assistedCount: submitted.filter((attempt) => attempt.usedAssistance).length,
      evidenceCount: submitted.filter((attempt) => attempt.evidenceStatus === 'recorded').length,
      timeSpentSeconds: submitted.reduce((sum, attempt) => sum + Number(attempt.timeSpentSeconds ?? 0), 0),
      completionRate: total ? Math.min(1, submitted.length / total) : 0,
      nextQuestionId: nextQuestion?.id ?? null,
      items
    };
  }

  async review(userId: number, slug: string, conversationId: string) {
    const progress = await this.progress(userId, slug, conversationId);
    if (progress.status !== 'completed') {
      throw new ConflictException({ code: 'PAST_PAPER_NOT_COMPLETED', message: '完成全部可作答题后才能生成整卷复盘。' });
    }
    await this.projector.processPending(200).catch(() => undefined);
    const attempts = await this.prisma.agentPastPaperAttempt.findMany({
      where: { userId, conversationId, pastPaperId: progress.paper.id, status: 'submitted' },
      include: { sourceQuestion: { select: { topicId: true, topic: { select: { id: true, code: true, title: true } } } } }
    });
    const topicMap = new Map<number, { topicId: number; code: string; title: string; attemptedCount: number; incorrectCount: number; assistedCount: number }>();
    for (const attempt of attempts) {
      const topic = attempt.sourceQuestion.topic;
      if (!topic) continue;
      const item = topicMap.get(topic.id) ?? { topicId: topic.id, code: topic.code, title: topic.title, attemptedCount: 0, incorrectCount: 0, assistedCount: 0 };
      item.attemptedCount += 1;
      if (attempt.outcome === 'incorrect') item.incorrectCount += 1;
      if (attempt.usedAssistance) item.assistedCount += 1;
      topicMap.set(topic.id, item);
    }
    const focusTopics = [...topicMap.values()]
      .filter((item) => item.incorrectCount > 0 || item.assistedCount > 0)
      .sort((left, right) => right.incorrectCount - left.incorrectCount || right.assistedCount - left.assistedCount || left.topicId - right.topicId)
      .slice(0, 5);
    const prescriptionResult = await this.decisions.getLearningPrescription(userId);
    const prescription = prescriptionResult.status === 'ready' ? prescriptionResult.prescription : null;
    const tasks = prescription?.tasks ?? [];
    const primaryTask = tasks.slice().sort((left, right) => left.priority - right.priority)[0] ?? null;
    return {
      schemaVersion: '1' as const,
      policyVersion: 'past-paper-review-v1',
      paper: progress.paper,
      summary: {
        submittedCount: progress.submittedCount,
        correctCount: progress.correctCount,
        incorrectCount: progress.incorrectCount,
        accuracy: progress.submittedCount ? Math.round((progress.correctCount / progress.submittedCount) * 100) : 0,
        assistedCount: progress.assistedCount,
        independentCount: Math.max(0, progress.submittedCount - progress.assistedCount),
        evidenceCount: progress.evidenceCount,
        timeSpentSeconds: progress.timeSpentSeconds
      },
      focusTopics,
      decision: {
        status: prescriptionResult.status,
        prescriptionId: prescription?.prescriptionId ?? null,
        reasonSummary: prescription?.reasonSummary ?? null,
        confidence: prescription?.confidence ?? null,
        estimatedMinutes: prescription?.estimatedMinutes ?? null,
        primaryTask
      },
      provenance: {
        resultSource: 'agent_past_paper_attempts',
        nextTaskSource: prescription ? 'learning_prescription' : null,
        automaticQuestionGenerationInvoked: false
      }
    };
  }

  async start(userId: number, slug: string, questionIdValue: string, body: unknown) {
    const input = StartPastPaperAttemptInputSchema.parse(body);
    const context = await this.context(userId, slug, questionIdValue, input.conversationId);
    let attempt = await this.prisma.agentPastPaperAttempt.findUnique({
      where: { userId_conversationId_pastPaperId_sourceQuestionId: { userId, conversationId: input.conversationId, pastPaperId: context.paper.id, sourceQuestionId: context.question.id } }
    });
    if (!attempt) {
      const reusedRequest = await this.prisma.agentPastPaperAttempt.findFirst({ where: { userId, clientStartRequestId: input.clientRequestId } });
      if (reusedRequest) throw new ConflictException('clientRequestId was already used for another past-paper attempt.');
      try {
        attempt = await this.prisma.agentPastPaperAttempt.create({ data: {
          userId,
          conversationId: input.conversationId,
          pastPaperId: context.paper.id,
          sourceQuestionId: context.question.id,
          clientStartRequestId: input.clientRequestId
        } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        attempt = await this.prisma.agentPastPaperAttempt.findUnique({
          where: { userId_conversationId_pastPaperId_sourceQuestionId: { userId, conversationId: input.conversationId, pastPaperId: context.paper.id, sourceQuestionId: context.question.id } }
        });
      }
    }
    if (!attempt) throw new ConflictException('Unable to start past-paper attempt.');
    return this.payload(attempt, context);
  }

  async submit(userId: number, attemptId: string, body: unknown) {
    const input = SubmitPastPaperAttemptInputSchema.parse(body);
    const existing = await this.ownedAttempt(userId, attemptId);
    if (existing.status === 'submitted') {
      if (existing.clientSubmitRequestId === input.clientRequestId && normalizedAnswer(existing.selectedAnswer ?? '') === normalizedAnswer(input.selectedAnswer)) {
        return this.payload(existing, { paper: existing.pastPaper, source: existing.sourceQuestion.document, question: existing.sourceQuestion });
      }
      throw new ConflictException({ code: 'PAST_PAPER_ATTEMPT_ALREADY_SUBMITTED', message: '本次作答已经提交，不能修改答案。' });
    }
    const reusedSubmit = await this.prisma.agentPastPaperAttempt.findFirst({ where: { userId, clientSubmitRequestId: input.clientRequestId } });
    if (reusedSubmit && reusedSubmit.id !== attemptId) throw new ConflictException('clientRequestId was already used for another past-paper submission.');
    const options = optionRows(existing.sourceQuestion.options);
    if (options.length && !options.some((option) => normalizedAnswer(option.key) === normalizedAnswer(input.selectedAnswer))) {
      throw new BadRequestException('请选择题目提供的有效选项。');
    }
    const now = new Date();
    const outcome = isCorrectAnswer(input.selectedAnswer, existing.sourceQuestion.correctAnswer ?? '', options) ? 'correct' : 'incorrect';
    let written: Awaited<ReturnType<LearningEvidenceWriter['appendInTransaction']>> | null = null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.agentPastPaperAttempt.updateMany({
        where: { id: attemptId, userId, status: 'in_progress' },
        data: { status: 'submitting', clientSubmitRequestId: input.clientRequestId }
      });
      if (claimed.count !== 1) throw new ConflictException('Past-paper attempt changed; reload and retry.');
      const calls = await tx.agentToolCall.findMany({
        where: { userId, toolName: ASSISTANCE_TOOL, status: 'completed', run: { conversationId: existing.conversationId }, completedAt: { lte: now } },
        select: { input: true, output: true }
      });
      const exposures = calls.flatMap((call) => {
        const callInput = objectValue(call.input);
        const output = objectValue(call.output);
        return String(callInput.slug) === existing.pastPaper.slug && Number(callInput.questionId) === existing.sourceQuestionId
          ? [{ level: String(output.level ?? ''), action: String(output.action ?? '') }]
          : [];
      });
      const maxAssistanceLevel = exposures.sort((left, right) => LEVEL_ORDER.indexOf(right.level) - LEVEL_ORDER.indexOf(left.level))[0]?.level ?? null;
      const usedAssistance = exposures.length > 0;
      let evidenceStatus = 'not_eligible';
      let evidenceReasonCode = usedAssistance ? 'ASSISTANCE_USED' : !REVIEWED_STATUSES.has(existing.sourceQuestion.reviewStatus)
        ? 'SOURCE_QUESTION_NOT_REVIEWED' : !existing.sourceQuestion.topicId ? 'TOPIC_NOT_MAPPED'
          : !SUPPORTED_SUBJECTS.has(existing.pastPaper.subject.toLowerCase()) ? 'SUBJECT_UNSUPPORTED'
            : !this.flags.isEnabled('evidenceWrite') ? 'EVIDENCE_WRITE_DISABLED' : null;
      if (!evidenceReasonCode && existing.sourceQuestion.topicId) {
        written = await this.evidenceWriter.appendInTransaction(tx, {
          schemaVersion: '1',
          eventId: `agent-pp-${existing.id}`,
          userId,
          subjectCode: existing.pastPaper.subject.toLowerCase() as 'math' | 'physics' | 'chemistry',
          occurredAt: now.toISOString(),
          sourceType: 'past_paper',
          sourceId: `agent:${existing.conversationId}:${existing.pastPaperId}`,
          attemptSequence: 1,
          sessionId: existing.conversationId,
          questionId: `source-question:${existing.sourceQuestionId}`,
          questionVersion: existing.pastPaper.version,
          answerKeyVersion: answerKeyVersion(existing.sourceQuestion.promptHash, existing.sourceQuestion.correctAnswer ?? ''),
          topicMappingVersion: `source-question-${existing.sourceQuestion.syllabusVersion}`,
          exposureState: 'prompt_seen',
          topicEvidence: [{ topicId: existing.sourceQuestion.topicId, role: 'primary', weight: 1 }],
          outcome,
          usedHint: false,
          usedExplanation: false,
          timeSpentSeconds: Math.max(0, Math.min(21_600, Math.floor((now.getTime() - existing.startedAt.getTime()) / 1000))),
          questionQualityConfidence: Math.min(0.95, Math.max(0.75, existing.sourceQuestion.analysisConfidence ?? 0.8)),
          metadata: {
            policyVersion: ANSWER_POLICY_VERSION,
            paper: { id: existing.pastPaperId, slug: existing.pastPaper.slug, version: existing.pastPaper.version },
            sourceQuestion: { id: existing.sourceQuestionId, reviewStatus: existing.sourceQuestion.reviewStatus },
            grading: 'deterministic_exact_answer_key',
            isolation: { automaticQuestionGenerationInvoked: false }
          }
        });
        evidenceStatus = 'recorded';
      }
      return tx.agentPastPaperAttempt.update({ where: { id: existing.id }, data: {
        status: 'submitted',
        selectedAnswer: input.selectedAnswer,
        outcome,
        usedAssistance,
        maxAssistanceLevel,
        timeSpentSeconds: Math.max(0, Math.min(21_600, Math.floor((now.getTime() - existing.startedAt.getTime()) / 1000))),
        evidenceStatus,
        evidenceReasonCode,
        evidenceId: written?.evidenceId ?? null,
        submittedAt: now
      } });
    });
    if (written) await this.projector.processPending(100).catch(() => undefined);
    return this.payload(updated, { paper: existing.pastPaper, source: existing.sourceQuestion.document, question: existing.sourceQuestion }, written);
  }

  private async context(userId: number, slug: string, questionIdValue: string, conversationId: string) {
    const questionId = Number(questionIdValue);
    if (!Number.isInteger(questionId) || questionId <= 0) throw new NotFoundException('题目不存在。');
    const conversation = await this.prisma.agentConversation.findFirst({ where: { id: conversationId, userId, deletedAt: null }, select: { id: true } });
    if (!conversation) throw new NotFoundException('Agent 对话不存在。');
    return this.questions.gradableQuestion(slug, questionId);
  }

  private async ownedAttempt(userId: number, attemptId: string) {
    const attempt = await this.prisma.agentPastPaperAttempt.findFirst({
      where: { id: attemptId, userId },
      include: { pastPaper: true, sourceQuestion: { include: { document: true } } }
    });
    if (!attempt) throw new NotFoundException('真题作答记录不存在。');
    return attempt;
  }

  private payload(attempt: any, context: any, written: any = null) {
    return {
      schemaVersion: '1' as const,
      policyVersion: ANSWER_POLICY_VERSION,
      attempt: {
        id: attempt.id,
        status: attempt.status,
        selectedAnswer: attempt.selectedAnswer,
        outcome: attempt.outcome,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        timeSpentSeconds: attempt.timeSpentSeconds,
        usedAssistance: attempt.usedAssistance,
        maxAssistanceLevel: attempt.maxAssistanceLevel,
        evidenceStatus: attempt.evidenceStatus,
        evidenceReasonCode: attempt.evidenceReasonCode,
        adaptationPending: written?.adaptationPending ?? false
      },
      question: {
        id: context.question.id,
        questionNumber: context.question.questionNumber,
        pageNumber: context.question.pageNumber,
        prompt: context.question.promptText,
        options: optionRows(context.question.options)
      },
      citation: {
        paperSlug: context.paper.slug,
        paperTitle: context.paper.title,
        sourceLabel: context.source.sourceLabel,
        sourceQuestionId: context.question.id,
        questionNumber: context.question.questionNumber,
        pageNumber: context.question.pageNumber
      }
    };
  }
}
