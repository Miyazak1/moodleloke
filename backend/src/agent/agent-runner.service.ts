import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LearningCapabilityResponse } from '../learning-intelligence/capabilities/learning-read-capability.contracts';
import { PrismaService } from '../prisma/prisma.service';
import { LearningStateProjectorService } from '../learning-intelligence/projection/learning-state-projector.service';
import { AgentEventService } from './agent-event.service';
import { AgentToolExecutorService, AgentToolContext } from './agent-tool-executor.service';
import { QuestionSupplyRequestService } from './question-supply-request.service';
import { AgentIntentRouterService, AgentRoutingDecision } from './agent-intent-router.service';
import { AgentIntent, AgentResolvedIntent } from './agent.types';
import { AgentGroundedFact, AgentGroundedResponseService } from './agent-grounded-response.service';
import { AgentPastPaperQuestionService } from './agent-past-paper-question.service';
import { AgentSubjectQaService } from './agent-subject-qa.service';

type InputSnapshot = {
  schemaVersion: '1';
  intent: AgentIntent;
  text: string;
  locale: 'zh-CN' | 'en';
  clientRequestId: string;
  surface?: 'learning_workspace' | 'subject_qa';
  attachmentIds?: string[];
  pageContext?: unknown;
};

type PlanArtifact = {
  title: string;
  summary: string;
  route: string | null;
  domainEntityId: string;
  snapshot: Record<string, unknown>;
};

type PastPaperResource = {
  id: number;
  slug: string;
  title: string;
  subject: string;
  examYear?: number;
  examMonth?: string;
  language: string;
  questionCount?: number;
  pageCount?: number;
  hasAnswers: boolean;
  hasSolutions: boolean;
  isFree: boolean;
  fileCount: number;
};

function successData(response: LearningCapabilityResponse): unknown {
  if (!response.ok) {
    const error = new Error(response.error.code);
    (error as Error & { retryable?: boolean }).retryable = response.error.retryable;
    throw error;
  }
  return response.data;
}

@Injectable()
export class AgentRunnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tools: AgentToolExecutorService,
    private readonly events: AgentEventService,
    @Optional() private readonly projector?: LearningStateProjectorService,
    @Optional() private readonly supplyRequests?: QuestionSupplyRequestService,
    @Optional() private readonly intentRouter?: AgentIntentRouterService,
    @Optional() private readonly groundedResponses?: AgentGroundedResponseService,
    @Optional() private readonly pastPaperQuestions?: AgentPastPaperQuestionService,
    @Optional() private readonly subjectQa?: AgentSubjectQaService
  ) {}

  dispatch(runId: string, userId: number): void {
    setImmediate(() => void this.run(runId, userId));
  }

  async run(runId: string, userId: number): Promise<void> {
    const claimed = await this.prisma.agentRun.updateMany({
      where: { id: runId, userId, status: 'queued' },
      data: {
        status: 'running',
        startedAt: new Date(),
        leaseUntil: new Date(Date.now() + 300_000),
        attemptCount: { increment: 1 },
        errorCode: null,
        errorRetryable: null
      }
    });
    if (claimed.count !== 1) return;

    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, userId },
      select: { id: true, userId: true, conversationId: true, traceId: true, inputSnapshot: true }
    });
    if (!run) return;
    const input = run.inputSnapshot as unknown as InputSnapshot;
    const toolContext: AgentToolContext = {
      runId: run.id,
      conversationId: run.conversationId,
      userId: run.userId,
      traceId: run.traceId,
      locale: input.locale
    };

    try {
      await this.prisma.$transaction((tx) => this.events.append(tx, {
        runId, conversationId: run.conversationId, eventKey: 'run:started', eventType: 'run.started', data: {}
      }));
      if (input.surface === 'subject_qa') {
        const questionContext = input.pageContext && typeof input.pageContext === 'object'
          ? (input.pageContext as { questionContext?: Parameters<AgentSubjectQaService['answer']>[0]['questionContext'] }).questionContext
          : undefined;
        const historyRows = await this.prisma.agentMessage.findMany({
          where: { conversationId: run.conversationId },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { role: true, content: true, runId: true }
        });
        const expectedBinding = questionContext ? `${questionContext.roundId}:${questionContext.questionId}` : null;
        const matchingRunIds = new Set(historyRows.flatMap((message) => {
          if (message.role !== 'user' || !message.runId) return [];
          const content = message.content as Record<string, unknown> | null;
          const pageContext = content?.pageContext && typeof content.pageContext === 'object'
            ? content.pageContext as { questionContext?: { roundId?: unknown; questionId?: unknown } }
            : null;
          const binding = pageContext?.questionContext
            ? `${Number(pageContext.questionContext.roundId)}:${Number(pageContext.questionContext.questionId)}`
            : null;
          return content?.surface === 'subject_qa' && binding === expectedBinding ? [message.runId] : [];
        }));
        const history = historyRows.reverse().flatMap((message) => {
          if (message.role !== 'user' && message.role !== 'assistant') return [];
          if (message.role === 'user' && message.runId === run.id) return [];
          const content = message.content as Record<string, unknown> | null;
          if (content?.surface !== 'subject_qa' || typeof content.text !== 'string') return [];
          if (!message.runId || !matchingRunIds.has(message.runId)) return [];
          return [{ role: message.role as 'user' | 'assistant', text: content.text }];
        });
        let pendingAnswerDelta = '';
        let answerDeltaIndex = 0;
        const flushAnswerDelta = async () => {
          const delta = pendingAnswerDelta;
          if (!delta) return;
          pendingAnswerDelta = '';
          answerDeltaIndex += 1;
          await this.prisma.$transaction((tx) => this.events.append(tx, {
            runId,
            conversationId: run.conversationId,
            eventKey: `answer:delta:${answerDeltaIndex}`,
            eventType: 'answer.delta',
            data: { delta }
          }));
        };
        const response = this.subjectQa
          ? await this.subjectQa.answer({
            runId: run.id,
            userId: run.userId,
            locale: input.locale,
            question: input.text,
            history,
            questionContext,
            onDelta: async (delta) => {
              pendingAnswerDelta += delta;
              if (pendingAnswerDelta.length >= 24 || /[。！？.!?\n]$/.test(pendingAnswerDelta)) await flushAnswerDelta();
            }
          })
          : { text: input.locale === 'zh-CN' ? '学科问答暂时无法连接。你仍可以返回学习工作台继续做题。' : 'Subject Q&A is temporarily unavailable. You can still return to the learning workspace and continue practicing.', decision: 'unavailable' as const, subject: null, generatedByAI: false };
        await flushAnswerDelta();
        await this.prisma.$transaction((tx) => this.events.append(tx, {
          runId, conversationId: run.conversationId, eventKey: 'plan:created', eventType: 'plan.created',
          data: {
            intent: 'subject_qa', source: response.generatedByAI ? 'llm' : 'rule', confidence: 1,
            reasonCode: response.decision, routerVersion: 'agent-subject-qa-v2',
            context: questionContext
              ? { type: 'adaptive_question', roundId: questionContext.roundId, questionId: questionContext.questionId }
              : { type: 'independent_subject_qa' }
          }
        }));
        await this.complete(run, response.text, null, { surface: 'subject_qa', subjectQa: { decision: response.decision, subject: response.subject, generatedByAI: response.generatedByAI, masteryChanged: false } });
        return;
      }
      if (input.attachmentIds?.length) {
        await this.prisma.$transaction((tx) => this.events.append(tx, {
          runId, conversationId: run.conversationId, eventKey: 'plan:created', eventType: 'plan.created',
          data: { intent: 'attachment_analysis', source: 'rule', confidence: 1, reasonCode: 'attachment_handoff', routerVersion: 'agent-intent-router-v1' }
        }));
        await this.complete(run, null, null);
        return;
      }
      const pageContext = input.pageContext && typeof input.pageContext === 'object'
        ? input.pageContext as { entityRef?: { type?: string; id?: string }; selectedQuestionId?: number }
        : null;
      if (pageContext?.entityRef?.type === 'past_paper' && pageContext.entityRef.id && pageContext.selectedQuestionId) {
        await this.prisma.$transaction((tx) => this.events.append(tx, {
          runId, conversationId: run.conversationId, eventKey: 'plan:created', eventType: 'plan.created',
          data: { intent: 'past_paper_question', source: 'context', confidence: 1, reasonCode: 'verified_page_context', routerVersion: 'agent-intent-router-v1' }
        }));
        const response = await this.pastPaperQuestionResponse(pageContext.entityRef.id, pageContext.selectedQuestionId, input.locale);
        await this.complete(run, response.text, null, {
          pastPaperQuestion: response.question,
          pastPaperCitations: [response.citation]
        });
        return;
      }
      const routing = await this.resolveRouting(run, input);
      await this.prisma.$transaction((tx) => this.events.append(tx, {
        runId, conversationId: run.conversationId, eventKey: 'plan:created', eventType: 'plan.created',
        data: { intent: routing.intent, source: routing.source, confidence: routing.confidence, reasonCode: routing.reasonCode, routerVersion: routing.routerVersion }
      }));

      if (routing.intent === 'learning_status') {
        await this.complete(run, await this.learningStatusResponse(toolContext), null);
        return;
      }
      if (routing.intent === 'review_queue') {
        await this.complete(run, await this.reviewQueueResponse(toolContext), null);
        return;
      }
      if (routing.intent === 'mock_exams') {
        await this.complete(run, await this.mockExamResponse(toolContext), null);
        return;
      }
      if (routing.intent === 'past_papers') {
        const response = await this.pastPaperResponse(toolContext, input.text);
        await this.complete(run, response.text, null, { pastPaperResources: response.resources });
        return;
      }
      if (routing.intent !== 'today_plan') {
        await this.complete(run, this.nonPlanResponse(input.locale, routing.intent), null);
        return;
      }

      const entityRef = input.pageContext && typeof input.pageContext === 'object'
        ? (input.pageContext as { entityRef?: { type?: string; id?: string } }).entityRef
        : undefined;
      if (entityRef?.type === 'mock_attempt') {
        const attemptId = Number(entityRef.id);
        const ownedAttempt = Number.isInteger(attemptId) && attemptId > 0
          ? await this.prisma.mockExamAttempt.findFirst({ where: { id: attemptId, userId: run.userId, submittedAt: { not: null } }, select: { id: true } })
          : null;
        if (!ownedAttempt) throw new Error('AGENT_MOCK_CONTEXT_INVALID');
      }
      let interventionStability: Record<string, unknown> | null = null;
      if (entityRef?.type === 'intervention_verification' && entityRef.id) {
        const response = await this.tools.execute(toolContext, 'get_intervention_stability', { verificationId: entityRef.id });
        if (response.ok) {
          interventionStability = response.data as Record<string, unknown>;
          const subjectCode = interventionStability.subjectCode;
          if (subjectCode === 'math' || subjectCode === 'physics' || subjectCode === 'chemistry') {
            await this.projector?.replayUserSubject(run.userId, subjectCode);
          }
        }
      } else if (entityRef?.type === 'adaptive_round' || entityRef?.type === 'mock_attempt') {
        await this.projector?.processPending(200);
      }

      const profile = successData(await this.tools.execute(toolContext, 'get_learning_profile')) as Record<string, unknown>;
      const goal = successData(await this.tools.execute(toolContext, 'get_score_goal')) as { status: string; goal: Record<string, unknown> | null };
      if (goal.status === 'unset' || !goal.goal) {
        await this.complete(run, input.locale === 'zh-CN'
          ? '还缺少目标分数和考试日期。请先在个人设置中补充目标，我才能给出可信的今日方案。'
          : 'Your target score and exam date are not configured yet. Add them in profile settings so I can create a reliable plan.', null);
        return;
      }

      const gap = successData(await this.tools.execute(toolContext, 'get_target_gap')) as { status: string; snapshot: Record<string, unknown> | null };
      const prescriptionResult = successData(await this.tools.execute(toolContext, 'get_learning_prescription')) as {
        status: string;
        goalId?: string;
        prescription: Record<string, unknown> | null;
      };
      if (gap.status !== 'ready' || prescriptionResult.status !== 'ready' || !prescriptionResult.prescription) {
        await this.complete(run, input.locale === 'zh-CN'
          ? '你的学习证据正在更新，暂时不输出可能过期的方案。完成后再问一次即可。'
          : 'Your learning evidence is still updating, so I will not show a potentially stale plan. Please try again shortly.', null);
        return;
      }

      const readinessResponse = await this.tools.execute(toolContext, 'get_score_readiness');
      const readiness = readinessResponse.ok ? readinessResponse.data as Record<string, unknown> : null;

      const artifact = await this.buildArtifact(
        toolContext, profile, goal.goal, gap.snapshot, prescriptionResult.prescription, interventionStability, readiness
      );
      const verificationSummary = this.interventionStabilitySummary(input.locale, interventionStability);
      const readinessSummary = this.readinessSummary(input.locale, readiness);
      const awaitsVerification = (artifact.snapshot.task as { type?: unknown } | null)?.type === 'intervention_verification';
      const message = input.locale === 'zh-CN'
        ? `${verificationSummary}${readinessSummary}${artifact.title}。${artifact.summary}${artifact.route ? ' 已为你准备好练习入口。' : awaitsVerification ? ' 到期验证卡会显示在方案下方。' : ' 当前合格题量不足，暂不创建练习。'}`
        : `${verificationSummary}${readinessSummary}${artifact.title}. ${artifact.summary}${artifact.route ? ' Your practice entry is ready.' : awaitsVerification ? ' The due verification card appears below the plan.' : ' Qualified question supply is currently insufficient, so no practice was created.'}`;
      await this.complete(run, message, artifact);
    } catch (error) {
      await this.fail(run, error);
    }
  }

  private async resolveRouting(
    run: { id: string; userId: number; conversationId: string },
    input: InputSnapshot
  ): Promise<AgentRoutingDecision> {
    if (!this.intentRouter) {
      return { intent: input.intent, source: 'rule', confidence: 1, reasonCode: 'legacy_rule', routerVersion: 'agent-intent-router-v1' };
    }
    const existing = await this.prisma.agentOutbox.findFirst({
      where: { runId: run.id, eventKey: 'plan:created' },
      select: { payload: true }
    });
    const saved = existing?.payload as Record<string, unknown> | null;
    if (saved && [
      'today_plan', 'learning_status', 'review_queue', 'mock_exams', 'past_papers',
      'capability_help', 'clarify', 'unsupported'
    ].includes(String(saved.intent))) {
      return {
        intent: String(saved.intent) as AgentResolvedIntent,
        source: saved.source === 'llm' ? 'llm' : 'rule',
        confidence: Number(saved.confidence ?? 1),
        reasonCode: String(saved.reasonCode ?? 'recovered'),
        routerVersion: String(saved.routerVersion ?? 'agent-intent-router-v1')
      };
    }
    const messages = await this.prisma.agentMessage.findMany({
      where: { conversationId: run.conversationId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { role: true, content: true }
    });
    const history = messages.reverse().flatMap((message) => {
      if (message.role !== 'user' && message.role !== 'assistant') return [];
      const content = message.content as Record<string, unknown> | null;
      return typeof content?.text === 'string'
        ? [{ role: message.role as 'user' | 'assistant', text: content.text }]
        : [];
    });
    return this.intentRouter.route({ text: input.text, locale: input.locale, userId: run.userId, runId: run.id, history });
  }

  private nonPlanResponse(locale: 'zh-CN' | 'en', intent: AgentResolvedIntent): string {
    if (intent === 'capability_help') {
      return locale === 'zh-CN'
        ? '我可以读取你的目标和学习证据，安排今天的任务，创建受控练习，并分析你上传的题目、PDF 或手写答案。成绩数值预测和即时自动出题目前仍保持关闭。'
        : 'I can read your goals and learning evidence, plan today\'s task, create controlled practice, and analyze uploaded questions, PDFs, or handwritten work. Numeric score prediction and instant question generation remain disabled.';
    }
    if (intent === 'clarify') {
      return locale === 'zh-CN'
        ? '你希望我根据当前学习情况安排今天的任务，还是分析一份题目或手写答案？'
        : 'Would you like me to plan today\'s task from your learning evidence, or analyze a question or handwritten answer?';
    }
    return locale === 'zh-CN'
      ? '这个请求暂时不在学习 Agent 的受控能力范围内。你可以问我今天学什么，或者上传题目、PDF 和手写答案进行分析。'
      : 'That request is outside the learning Agent\'s controlled capabilities for now. Ask what to study today, or upload a question, PDF, or handwritten answer for analysis.';
  }

  private async learningStatusResponse(context: AgentToolContext): Promise<string> {
    const mastery = successData(await this.tools.execute(context, 'get_subject_mastery', { limit: 50 })) as {
      subjects?: Array<{ subject: string; evidenceCount: number; topics: Array<Record<string, unknown>> }>;
    };
    const subjects = mastery.subjects ?? [];
    const facts: AgentGroundedFact[] = [];
    const evidenceCount = subjects.reduce((sum, subject) => sum + Number(subject.evidenceCount ?? 0), 0);
    if (!evidenceCount) {
      return context.locale === 'zh-CN'
        ? '目前还没有足够的已作答证据来判断知识点掌握情况。先完成一组系统推荐练习，我会在提交后更新分析。'
        : 'There is not enough completed-work evidence to assess topic mastery yet. Finish one recommended practice set and I will update the analysis after submission.';
    }
    facts.push({
      key: 'evidence',
      text: context.locale === 'zh-CN' ? `当前分析基于 ${evidenceCount} 次知识点作答证据。` : `The current analysis uses ${evidenceCount} topic-level answer observations.`
    });
    const weakTopics = subjects.flatMap((subject) => (subject.topics ?? []).map((topic) => ({
      ...(topic as Record<string, unknown>), subject: subject.subject
    } as Record<string, unknown>)))
      .filter((topic) => topic.status === 'needs_attention' || topic.status === 'developing')
      .sort((left, right) => Number(left.score ?? 1) - Number(right.score ?? 1))
      .slice(0, 4);
    weakTopics.forEach((topic, index) => facts.push({
      key: `topic-${index + 1}`,
      text: context.locale === 'zh-CN'
        ? `${this.subjectLabel(String(topic.subject), context.locale)}：${String(topic.title)}目前${topic.status === 'needs_attention' ? '需要重点巩固' : '正在发展中'}（${Number(topic.attemptCount ?? 0)} 次作答）。`
        : `${this.subjectLabel(String(topic.subject), context.locale)}: ${String(topic.title)} ${topic.status === 'needs_attention' ? 'needs focused consolidation' : 'is developing'} (${Number(topic.attemptCount ?? 0)} attempts).`
    }));
    if (!weakTopics.length) facts.push({
      key: 'no-weak-topic',
      text: context.locale === 'zh-CN' ? '现有证据中暂未发现明确的薄弱知识点。' : 'No clearly weak topic appears in the current evidence.'
    });
    return this.renderGrounded(context, 'learning_status', facts);
  }

  private async reviewQueueResponse(context: AgentToolContext): Promise<string> {
    const queue = successData(await this.tools.execute(context, 'get_review_queue', {
      language: context.locale === 'zh-CN' ? 'zh' : 'en', limit: 8
    })) as { items?: Array<Record<string, unknown>> };
    const items = queue.items ?? [];
    if (!items.length) return context.locale === 'zh-CN'
      ? '当前没有待处理的错题复习项。系统会在新的错误证据形成后自动加入复习队列。'
      : 'There are no pending mistake-review items. New items will be added when fresh error evidence is recorded.';
    const facts = items.map((item, index) => ({
      key: `review-${index + 1}`,
      text: context.locale === 'zh-CN'
        ? `${index + 1}. ${this.subjectLabel(String(item.subject), context.locale)} · ${String(item.title)}，错误重复 ${Number(item.recurrenceCount ?? 1)} 次，入口：${String(item.href)}。`
        : `${index + 1}. ${this.subjectLabel(String(item.subject), context.locale)} · ${String(item.title)}, repeated ${Number(item.recurrenceCount ?? 1)} times. Open: ${String(item.href)}.`
    }));
    return this.renderGrounded(context, 'review_queue', facts);
  }

  private async mockExamResponse(context: AgentToolContext): Promise<string> {
    const result = successData(await this.tools.execute(context, 'list_mock_exam_attempts', { status: 'all', limit: 6 })) as {
      items?: Array<Record<string, unknown>>;
    };
    const items = result.items ?? [];
    if (!items.length) return context.locale === 'zh-CN'
      ? '当前还没有模考记录。完成一次在线模考后，我可以在这里汇总进度、提交状态和报告入口。'
      : 'There are no mock-exam attempts yet. After an online mock, I can summarize its progress, submission status, and report entry here.';
    const facts = items.map((item, index) => {
      const submitted = item.status === 'submitted';
      const route = submitted && item.reportPath ? item.reportPath : item.attemptPath;
      return {
        key: `mock-${index + 1}`,
        text: context.locale === 'zh-CN'
          ? `${index + 1}. ${String(item.title)}：${submitted ? `已提交${item.score === null ? '' : `，得分 ${Number(item.score)}`}` : `进行中，已答 ${Number(item.answeredCount ?? 0)}/${Number(item.questionCount ?? 0)} 题`}；入口：${String(route)}。`
          : `${index + 1}. ${String(item.title)}: ${submitted ? `submitted${item.score === null ? '' : `, score ${Number(item.score)}`}` : `in progress, ${Number(item.answeredCount ?? 0)}/${Number(item.questionCount ?? 0)} answered`}. Open: ${String(route)}.`
      };
    });
    return this.renderGrounded(context, 'mock_exams', facts);
  }

  private async pastPaperResponse(context: AgentToolContext, text: string): Promise<{ text: string; resources: PastPaperResource[] }> {
    const subject = /化学|chemistry/i.test(text) ? 'chemistry'
      : /物理|physics/i.test(text) ? 'physics'
        : /数学|math/i.test(text) ? 'math' : undefined;
    const yearMatch = text.match(/(?:19|20)\d{2}/);
    const result = successData(await this.tools.execute(context, 'search_past_papers', {
      ...(subject ? { subject } : {}),
      ...(yearMatch ? { year: Number(yearMatch[0]) } : {}),
      locale: context.locale === 'zh-CN' ? 'zh' : 'en',
      category: 'past-paper',
      limit: 6
    })) as { items?: Array<Record<string, unknown>> };
    const items = result.items ?? [];
    if (!items.length) return { text: context.locale === 'zh-CN'
      ? '没有找到符合当前科目或年份条件的已发布真题。你可以换一个科目或年份再试。'
      : 'No published past paper matches the current subject or year filters. Try another subject or year.', resources: [] };
    const facts = items.map((item, index) => ({
      key: `paper-${index + 1}`,
      text: context.locale === 'zh-CN'
        ? `${index + 1}. ${String(item.title)}${item.questionCount ? `，${Number(item.questionCount)} 题` : ''}${item.hasAnswers || item.hasSolutions ? '，含答案或解析' : ''}；查看：${String(item.href)}。`
        : `${index + 1}. ${String(item.title)}${item.questionCount ? `, ${Number(item.questionCount)} questions` : ''}${item.hasAnswers || item.hasSolutions ? ', answers or solutions included' : ''}. Open: ${String(item.href)}.`
    }));
    const resources = items.map((item) => ({
      id: Number(item.id), slug: String(item.slug), title: String(item.title), subject: String(item.subject),
      ...(typeof item.examYear === 'number' ? { examYear: item.examYear } : {}),
      ...(typeof item.examMonth === 'string' ? { examMonth: item.examMonth } : {}),
      language: String(item.language),
      ...(typeof item.questionCount === 'number' ? { questionCount: item.questionCount } : {}),
      ...(typeof item.pageCount === 'number' ? { pageCount: item.pageCount } : {}),
      hasAnswers: Boolean(item.hasAnswers), hasSolutions: Boolean(item.hasSolutions),
      isFree: Boolean(item.isFree), fileCount: Number(item.fileCount ?? 0)
    }));
    return { text: await this.renderGrounded(context, 'past_papers', facts), resources };
  }

  private async pastPaperQuestionResponse(slug: string, questionId: number, locale: 'zh-CN' | 'en') {
    if (!this.pastPaperQuestions) throw new Error('PAST_PAPER_QUESTION_SERVICE_UNAVAILABLE');
    const result = await this.pastPaperQuestions.question(slug, questionId);
    const question = result.question;
    const optionText = question.options.map((option) => `${option.key}. ${option.text}`).join('\n');
    const text = locale === 'zh-CN'
      ? [
          `${result.paper.title} · 第 ${question.questionNumber} 题${question.pageNumber ? ` · 第 ${question.pageNumber} 页` : ''}`,
          question.prompt,
          optionText,
          question.correctAnswer ? `参考答案：${question.correctAnswer}` : '这道题目前没有可公开的已核验答案。',
          question.explanation ? `已核验解析：${question.explanation}` : '当前来源没有可复用的已核验解析，我不会补写未经来源支持的解法。',
          `来源：${result.source.label}`
        ].filter(Boolean).join('\n\n')
      : [
          `${result.paper.title} · Question ${question.questionNumber}${question.pageNumber ? ` · page ${question.pageNumber}` : ''}`,
          question.prompt,
          optionText,
          question.correctAnswer ? `Verified answer: ${question.correctAnswer}` : 'No verified answer is currently approved for display.',
          question.explanation ? `Verified explanation: ${question.explanation}` : 'No reusable verified explanation is available, so I will not invent one.',
          `Source: ${result.source.label}`
        ].filter(Boolean).join('\n\n');
    return { text, question: { ...question, paper: result.paper }, citation: result.citation };
  }

  private async renderGrounded(context: AgentToolContext, intent: string, facts: AgentGroundedFact[]): Promise<string> {
    const plan = this.groundedResponses
      ? await this.groundedResponses.plan({ runId: context.runId, userId: context.userId, locale: context.locale, intent, facts })
      : { leadStyle: 'overview' as const, factKeys: facts.map((fact) => fact.key), source: 'rule' as const };
    const byKey = new Map(facts.map((fact) => [fact.key, fact.text]));
    const ordered = plan.factKeys.flatMap((key) => byKey.has(key) ? [byKey.get(key)!] : []);
    const lead = context.locale === 'zh-CN'
      ? plan.leadStyle === 'action' ? '下面是当前最值得处理的信息：' : plan.leadStyle === 'evidence' ? '根据系统已经记录的学习证据：' : '这是当前可核验的信息：'
      : plan.leadStyle === 'action' ? 'These are the most useful items to act on now:' : plan.leadStyle === 'evidence' ? 'Based on recorded learning evidence:' : 'Here is the currently verified information:';
    return `${lead}\n${ordered.join('\n')}`;
  }

  private subjectLabel(subject: string, locale: 'zh-CN' | 'en'): string {
    const labels: Record<string, [string, string]> = {
      math: ['数学', 'Math'], physics: ['物理', 'Physics'], chemistry: ['化学', 'Chemistry']
    };
    return labels[subject]?.[locale === 'zh-CN' ? 0 : 1] ?? subject;
  }

  private async buildArtifact(
    context: AgentToolContext,
    profile: Record<string, unknown>,
    goal: Record<string, unknown>,
    gap: Record<string, unknown> | null,
    prescription: Record<string, unknown>,
    interventionStability: Record<string, unknown> | null,
    scoreReadiness: Record<string, unknown> | null
  ): Promise<PlanArtifact> {
    const tasks = Array.isArray(prescription.tasks) ? prescription.tasks as Array<Record<string, unknown>> : [];
    const task = tasks.slice().sort((left, right) => Number(left.priority ?? 99) - Number(right.priority ?? 99))[0];
    if (!task) throw new Error('AGENT_PRESCRIPTION_EMPTY');
    const subject = String(task.subject);
    const type = String(task.type);
    const questionCount = typeof task.questionCount === 'number' ? task.questionCount : 5;
    let review: Record<string, unknown> | null = null;
    if (type === 'review' || type === 'concept_learning') {
      const queue = successData(await this.tools.execute(context, 'get_review_queue', {
        subject,
        language: context.locale === 'zh-CN' ? 'zh' : 'en',
        limit: 10
      })) as { items?: Array<Record<string, unknown>> };
      const topicIds = Array.isArray(task.topicIds) ? task.topicIds.map(Number) : [];
      review = (queue.items ?? []).find((item) => topicIds.includes(Number(item.topicId)))
        ?? (queue.items ?? [])[0]
        ?? null;
    }
    let supply: Record<string, unknown> | null = null;
    let canStart = type === 'mock_exam' || type === 'intervention_verification';
    if (type === 'diagnostic' || type === 'review' || type === 'targeted_practice' || (type === 'concept_learning' && review)) {
      const reviewTopicId = Number(review?.topicId);
      const requestedTopicIds = Number.isInteger(reviewTopicId) && reviewTopicId > 0
        ? [reviewTopicId]
        : Array.isArray(task.topicIds) ? task.topicIds : [];
      supply = successData(await this.tools.execute(context, 'get_question_supply_status', {
        subject,
        topicIds: requestedTopicIds,
        ...(typeof task.difficulty === 'string' ? { difficulty: task.difficulty } : {}),
        requestedCount: questionCount
      })) as Record<string, unknown>;
      canStart = supply.canCreatePractice === true;
      if (!canStart) {
        await this.supplyRequests?.recordBestEffort({
          source: 'agent_today_plan',
          subjectCode: subject,
          topicIds: requestedTopicIds,
          ...(typeof task.difficulty === 'string' ? { difficulty: task.difficulty } : {}),
          taskType: type,
          requestedCount: questionCount,
          availableCount: Number(supply.availableCount ?? 0),
          sourceEntityType: 'learning_prescription',
          sourceEntityId: String(prescription.prescriptionId),
          constraints: { sourcePolicy: 'reviewed_published_only' }
        });
      } else {
        await this.supplyRequests?.recordRecoveryBestEffort?.({
          source: 'agent_today_plan',
          subjectCode: subject,
          topicIds: requestedTopicIds,
          ...(typeof task.difficulty === 'string' ? { difficulty: task.difficulty } : {}),
          taskType: type,
          requestedCount: questionCount,
          availableCount: Number(supply.availableCount ?? questionCount),
          confirmationKind: 'domain_preflight_passed',
          constraints: { sourcePolicy: 'reviewed_published_only' }
        });
      }
    }
    const route = canStart && type !== 'intervention_verification' ? '/agent' : null;
    const minutes = Number(prescription.estimatedMinutes ?? 15);
    const title = type === 'intervention_verification'
      ? context.locale === 'zh-CN' ? `${subject} 阶段验证已到期` : `The ${subject} staged check is due`
      : context.locale === 'zh-CN' ? `今日先完成 ${subject} 学习任务` : `Start with today's ${subject} task`;
    const summary = type === 'intervention_verification'
      ? context.locale === 'zh-CN' ? '先完成这项独立验证，再根据保持或迁移证据调整后续学习。' : 'Complete this independent check first, then update the plan from retention or transfer evidence.'
      : context.locale === 'zh-CN'
        ? `建议用约 ${minutes} 分钟处理当前最高优先级学习差距。`
        : `Spend about ${minutes} minutes on your highest-priority learning gap.`;
    return {
      title,
      summary,
      route,
      domainEntityId: String(prescription.prescriptionId),
      snapshot: {
        schemaVersion: '1',
        planKind: 'today_plan',
        generatedFrom: 'learning_prescription',
        prescriptionId: prescription.prescriptionId,
        goalId: goal.goalId,
        versions: prescription.versions,
        objective: prescription.objective,
        reasonCodes: prescription.reasonCodes,
        confidence: prescription.confidence,
        estimatedMinutes: minutes,
        task,
        review,
        supply,
        canStart,
        route,
        profileContext: {
          educationStageCode: profile.educationStageCode ?? null,
          gradeCode: profile.gradeCode ?? null,
          targetSubjectCodes: profile.targetSubjectCodes ?? []
        },
        gapSnapshotId: gap?.gapSnapshotId ?? null,
        interventionStability,
        decisionImpact: this.interventionDecisionImpact(interventionStability),
        scoreReadiness,
        validUntil: prescription.validUntil
      }
    };
  }

  private interventionDecisionImpact(context: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!context) return null;
    const stabilityResult = context.stabilityResult;
    const currentPhase = context.currentPhase === 'retention' || context.currentPhase === 'transfer'
      ? context.currentPhase : 'immediate';
    const phases = Array.isArray(context.phases) ? context.phases as Array<Record<string, unknown>> : [];
    const completed = phases.filter((item) => item.status === 'completed');
    const status = stabilityResult === 'stable'
      ? 'stable_mastery_confirmed'
      : stabilityResult === 'not_stable'
        ? 'consolidation_required'
        : stabilityResult === 'inconclusive'
          ? 'evidence_inconclusive'
          : context.nextDueAt
            ? 'verification_scheduled'
            : 'phase_recorded';
    return {
      schemaVersion: '1',
      source: 'intervention_verification',
      status,
      verificationId: context.verificationId ?? null,
      subjectCode: context.subjectCode ?? null,
      currentPhase,
      currentPhaseResult: context.currentPhaseResult ?? null,
      stabilityResult: stabilityResult ?? null,
      completedPhaseCount: completed.length,
      passedPhaseCount: completed.filter((item) => item.result === 'passed').length,
      evaluatedAt: context.evaluatedAt ?? null,
      nextDueAt: context.nextDueAt ?? null
    };
  }

  private readinessSummary(locale: 'zh-CN' | 'en', readiness: Record<string, unknown> | null): string {
    if (readiness?.status !== 'ready' || !Array.isArray(readiness.forecasts)) return '';
    const forecasts = readiness.forecasts as Array<Record<string, unknown>>;
    if (!forecasts.length) return '';
    const needsDiagnostic = forecasts.some((item) => item.nextValidationAction === 'diagnostic');
    return locale === 'zh-CN'
      ? `当前备考度仍处于影子测量阶段，尚不展示未经校准的分数或达标概率。${needsDiagnostic ? '需要先补充独立诊断证据。' : '系统会继续积累独立验证证据。'}`
      : `Readiness is still in shadow measurement, so no uncalibrated score or attainment probability is shown. ${needsDiagnostic ? 'Independent diagnostic evidence is needed first. ' : 'The system will keep collecting independent validation evidence. '}`;
  }

  private interventionStabilitySummary(locale: 'zh-CN' | 'en', context: Record<string, unknown> | null): string {
    if (!context) return '';
    const currentPhase = context.currentPhase === 'retention' || context.currentPhase === 'transfer'
      ? context.currentPhase : 'immediate';
    const phaseLabel = locale === 'zh-CN'
      ? currentPhase === 'retention' ? '保持验证' : currentPhase === 'transfer' ? '迁移验证' : '即时独立验证'
      : currentPhase === 'retention' ? 'retention check' : currentPhase === 'transfer' ? 'transfer check' : 'immediate independent check';
    const phases = Array.isArray(context.phases) ? context.phases as Array<Record<string, unknown>> : [];
    const current = phases.find((item) => item.phase === currentPhase);
    const accuracy = typeof current?.accuracy === 'number' ? current.accuracy : null;
    const questionCount = 3;
    const correctCount = accuracy === null ? null : Math.max(0, Math.min(questionCount, Math.round(accuracy * questionCount)));
    const currentResult = context.currentPhaseResult;
    const phaseResult = currentResult === 'passed'
      ? locale === 'zh-CN'
        ? `${phaseLabel}${correctCount === null ? '' : ` ${correctCount}/${questionCount} 题`}通过；这只确认当前能够独立作答，尚不等于稳定掌握。`
        : `The ${phaseLabel}${correctCount === null ? ' passed' : ` passed with ${correctCount}/${questionCount} correct`}; this confirms independent performance now, not stable mastery yet. `
      : currentResult === 'failed'
        ? locale === 'zh-CN'
          ? `${phaseLabel}${correctCount === null ? '' : `仅答对 ${correctCount}/${questionCount} 题`}，尚未通过；系统不会据此提高掌握判断。`
          : `The ${phaseLabel}${correctCount === null ? '' : ` had ${correctCount}/${questionCount} correct`} did not pass; the system will not raise the mastery judgment from it. `
        : currentResult === 'inconclusive'
          ? locale === 'zh-CN'
            ? `${phaseLabel}证据不完整或不满足独立作答要求，结果不纳入掌握提升。`
            : `The ${phaseLabel} was incomplete or not independent, so it will not raise mastery. `
          : '';
    const stabilityResult = context.stabilityResult;
    if (stabilityResult === 'stable') return `${phaseResult}${locale === 'zh-CN' ? '三阶段验证已确认稳定掌握。' : 'The three-stage check confirms stable mastery. '}`;
    if (stabilityResult === 'not_stable') return `${phaseResult}${locale === 'zh-CN' ? '阶段验证显示掌握尚不稳定，我会继续优先巩固。' : 'The staged check shows mastery is not yet stable, so consolidation remains a priority. '}`;
    if (stabilityResult === 'inconclusive') return `${phaseResult}${locale === 'zh-CN' ? '本轮稳定掌握证据不足，我不会据此高估掌握度。' : 'This check is inconclusive, so I will not overstate mastery. '}`;
    if (context.nextDueAt) {
      const nextPhase = currentPhase === 'retention' ? 'transfer' : 'retention';
      const nextPhaseLabel = locale === 'zh-CN'
        ? nextPhase === 'transfer' ? '迁移验证' : '保持验证'
        : nextPhase === 'transfer' ? 'transfer check' : 'retention check';
      return `${phaseResult}${locale === 'zh-CN' ? `后续${nextPhaseLabel}将在到期后提供。` : `The ${nextPhaseLabel} will become available when due. `}`;
    }
    return `${phaseResult}${locale === 'zh-CN' ? '当前阶段验证结果已纳入学习决策。' : 'This stage result is now included in the learning decision. '}`;
  }

  private async complete(
    run: { id: string; userId: number; conversationId: string },
    text: string | null,
    artifact: PlanArtifact | null,
    contentExtras: Record<string, unknown> = {}
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      let storedArtifact: { id: string } | null = null;
      if (artifact) {
        storedArtifact = await tx.agentArtifact.upsert({
          where: { runId_type_version: { runId: run.id, type: 'learning_plan', version: 1 } },
          create: {
            conversationId: run.conversationId,
            runId: run.id,
            userId: run.userId,
            type: 'learning_plan',
            version: 1,
            title: artifact.title,
            summary: artifact.summary,
            domainEntityType: 'learning_prescription',
            domainEntityId: artifact.domainEntityId,
            route: artifact.route,
            snapshot: artifact.snapshot as Prisma.InputJsonValue
          },
          update: {}
        });
      }
      if (text) {
        await tx.agentMessage.upsert({
          where: { conversationId_clientMessageId: { conversationId: run.conversationId, clientMessageId: `assistant:${run.id}` } },
          create: {
            conversationId: run.conversationId,
            role: 'assistant',
            clientMessageId: `assistant:${run.id}`,
            runId: run.id,
            content: { schemaVersion: '1', text, ...contentExtras, ...(storedArtifact ? { artifactIds: [storedArtifact.id] } : {}) }
          },
          update: {}
        });
      }
      const completed = await tx.agentRun.updateMany({
        where: { id: run.id, userId: run.userId, status: 'running' },
        data: { status: 'completed', completedAt: new Date(), leaseUntil: null, errorCode: null, errorRetryable: null }
      });
      if (completed.count !== 1) throw new Error('AGENT_RUN_LEASE_LOST');
      await tx.agentConversation.updateMany({
        where: { id: run.conversationId, userId: run.userId, deletedAt: null },
        data: { lastMessageAt: new Date() }
      });
      if (storedArtifact) {
        await this.events.append(tx, {
          runId: run.id,
          conversationId: run.conversationId,
          eventKey: 'artifact:learning_plan:created',
          eventType: 'artifact.created',
          data: { artifactId: storedArtifact.id, type: 'learning_plan' }
        });
      }
      await this.events.append(tx, {
        runId: run.id,
        conversationId: run.conversationId,
        eventKey: 'run:completed',
        eventType: 'run.completed',
        data: { hasArtifact: Boolean(storedArtifact) }
      });
    });
  }

  private async fail(run: { id: string; userId: number; conversationId: string }, error: unknown): Promise<void> {
    const retryable = Boolean((error as { retryable?: boolean } | null)?.retryable);
    await this.prisma.$transaction(async (tx) => {
      const failed = await tx.agentRun.updateMany({
        where: { id: run.id, userId: run.userId, status: 'running' },
        data: { status: 'failed', completedAt: new Date(), leaseUntil: null, errorCode: 'AGENT_RUN_FAILED', errorRetryable: retryable }
      });
      if (failed.count !== 1) return;
      await this.events.append(tx, {
        runId: run.id,
        conversationId: run.conversationId,
        eventKey: 'run:failed',
        eventType: 'run.failed',
        data: { errorCode: 'AGENT_RUN_FAILED', retryable }
      });
    });
  }
}
