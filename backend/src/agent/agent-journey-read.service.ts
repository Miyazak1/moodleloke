import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeFeatureFlagsService } from './agent-runtime-feature-flags.service';

const TERMINAL_ARTIFACT_STATUSES = new Set(['completed', 'failed', 'abandoned', 'cancelled', 'expired']);
const ASSISTANCE_TOOLS = ['request_learning_assistance', 'request_past_paper_assistance'];
const PLACEHOLDER_CONTENT_PATTERN = /(?:local\s+demo\s+data|golden\s+path|placeholder|fixture|seed(?:ed)?\s+data|test\s+data)/i;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasUnavailableTeachingContent(delivery: { contentSnapshot: unknown; contentSourceId: string | null }) {
  const content = objectValue(delivery.contentSnapshot);
  return PLACEHOLDER_CONTENT_PATTERN.test([
    content.title, content.body, content.topicTitle, delivery.contentSourceId
  ].map((value) => String(value ?? '')).join(' '));
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function accuracy(correct: number, total: number) {
  return total > 0 ? Math.round((correct / total) * 100) : null;
}

type ResumeWorkspace =
  | { kind: 'adaptive_round'; conversationId: string; artifactId?: string; verificationId?: string; roundId: number; phase: 'practice' | 'report'; taskType: string; subject: string | null }
  | { kind: 'mock_exam'; conversationId: string; artifactId: string; attemptId: number; phase: 'taking' | 'report'; subject: string | null; paperTitle: string | null }
  | { kind: 'past_paper'; conversationId: string; slug: string; questionId: number }
  | { kind: 'teaching'; conversationId: string; deliveryId: string };

function isActiveLearningWorkspace(workspace: ResumeWorkspace | null): workspace is ResumeWorkspace {
  if (!workspace) return false;
  if (workspace.kind === 'adaptive_round') return workspace.phase === 'practice';
  if (workspace.kind === 'mock_exam') return workspace.phase === 'taking';
  return true;
}

type JourneyStage = {
  id: string;
  kind: 'practice' | 'free_practice' | 'mock_exam' | 'past_paper' | 'teaching';
  conversationId: string;
  journeyId: string;
  title: string;
  subject: string | null;
  taskType: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  metrics: {
    batchCount: number;
    completedBatchCount: number;
    allocatedQuestionCount: number;
    answeredQuestionCount: number;
    correctCount: number;
    accuracy: number | null;
    assistanceCount: number;
    teachingCount: number;
  };
  resume: ResumeWorkspace | null;
  provenance: {
    source: 'agent_artifacts' | 'agent_past_paper_attempts' | 'learning_intervention_deliveries';
    artifactIds: string[];
    domainEntityRefs: Array<{ type: string; id: string }>;
  };
};

@Injectable()
export class AgentJourneyReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: AgentRuntimeFeatureFlagsService
  ) {}

  async read(userId: number) {
    if (!this.flags.isWebEnabled()) throw new ServiceUnavailableException('学习 Agent 暂未开放。');

    const [artifacts, pastPaperAttempts, deliveries] = await Promise.all([
      this.prisma.agentArtifact.findMany({
        where: { userId, type: { in: ['learning_plan', 'learning_task'] }, conversation: { deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        take: 250,
        include: { conversation: { select: { title: true } } }
      }),
      this.prisma.agentPastPaperAttempt.findMany({
        where: { userId, conversation: { deletedAt: null } },
        orderBy: { updatedAt: 'desc' },
        take: 250,
        include: { pastPaper: { select: { slug: true, title: true, subject: true, questionCount: true } } }
      }),
      this.prisma.learningInterventionDelivery.findMany({
        where: { userId, channel: 'agent_web' },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          intervention: { select: { subjectCode: true, action: true, topicId: true, reasonSummary: true } },
          steps: { select: { id: true } },
          verifications: {
            select: {
              id: true, status: true, phase: true, conversationId: true, startedAt: true,
              completedAt: true, updatedAt: true, roundId: true,
              round: {
                select: {
                  id: true, startedAt: true, submittedAt: true, updatedAt: true,
                  items: { select: { selectedAnswer: true, isCorrect: true } }
                }
              }
            }
          },
          outcomes: { select: { correctCount: true, totalCount: true } }
        }
      })
    ]);

    const artifactFacts = artifacts.map((artifact) => {
      const snapshot = objectValue(artifact.snapshot);
      const launch = objectValue(snapshot.launch);
      const task = objectValue(snapshot.task);
      const roundId = positiveInteger(launch.roundId ?? snapshot.roundId ?? (artifact.domainEntityType === 'csca_adaptive_round' ? artifact.domainEntityId : null));
      const attemptId = positiveInteger(launch.attemptId ?? (artifact.domainEntityType === 'mock_exam_attempt' ? artifact.domainEntityId : null));
      return { artifact, snapshot, launch, task, roundId, attemptId };
    });
    const roundIds = [...new Set(artifactFacts.flatMap((item) => item.roundId ? [item.roundId] : []))];
    const mockAttemptIds = [...new Set(artifactFacts.flatMap((item) => item.attemptId ? [item.attemptId] : []))];
    const runIds = [...new Set(artifacts.map((item) => item.runId))];
    const conversationIds = [...new Set([
      ...artifacts.map((item) => item.conversationId),
      ...pastPaperAttempts.map((item) => item.conversationId)
    ])];
    const [rounds, mockAttempts, assistanceCalls] = await Promise.all([
      roundIds.length ? this.prisma.cscaAdaptiveRound.findMany({
        where: { id: { in: roundIds }, session: { userId } },
        include: { session: { select: { subject: true } }, items: { select: { selectedAnswer: true, isCorrect: true } } }
      }) : [],
      mockAttemptIds.length ? this.prisma.mockExamAttempt.findMany({
        where: { id: { in: mockAttemptIds }, userId },
        include: { paper: { select: { title: true, subject: true } } }
      }) : [],
      runIds.length || conversationIds.length ? this.prisma.agentToolCall.findMany({
        where: {
          userId,
          status: 'completed',
          toolName: { in: ASSISTANCE_TOOLS },
          OR: [
            ...(runIds.length ? [{ runId: { in: runIds } }] : []),
            ...(conversationIds.length ? [{ run: { conversationId: { in: conversationIds } } }] : [])
          ]
        },
        select: { runId: true, toolName: true, input: true, run: { select: { conversationId: true } } }
      }) : []
    ]);
    const roundById = new Map(rounds.map((item) => [item.id, item]));
    const mockById = new Map(mockAttempts.map((item) => [item.id, item]));
    const assistanceByRun = new Map<string, number>();
    const pastPaperAssistance = new Map<string, number>();
    for (const call of assistanceCalls) {
      assistanceByRun.set(call.runId, (assistanceByRun.get(call.runId) ?? 0) + 1);
      if (call.toolName === 'request_past_paper_assistance') {
        const input = objectValue(call.input);
        const slug = String(input.slug ?? '');
        const key = `${call.run.conversationId}:${slug}`;
        if (slug) pastPaperAssistance.set(key, (pastPaperAssistance.get(key) ?? 0) + 1);
      }
    }
    const teachingByConversation = new Map<string, number>();
    for (const delivery of deliveries) {
      const conversationId = String(objectValue(delivery.contextSnapshot).conversationId ?? '');
      if (conversationId) teachingByConversation.set(conversationId, (teachingByConversation.get(conversationId) ?? 0) + 1);
    }

    const stages: JourneyStage[] = [];
    const freeGroups = new Map<string, typeof artifactFacts>();
    for (const fact of artifactFacts) {
      const journeyId = typeof fact.snapshot.freePracticeJourneyId === 'string' ? fact.snapshot.freePracticeJourneyId : null;
      if (journeyId) {
        const group = freeGroups.get(journeyId) ?? [];
        group.push(fact);
        freeGroups.set(journeyId, group);
        continue;
      }
      const taskType = String(fact.launch.taskType ?? fact.task.type ?? '');
      if (fact.attemptId && taskType === 'mock_exam') {
        const attempt = mockById.get(fact.attemptId);
        if (!attempt) continue;
        const isTerminal = TERMINAL_ARTIFACT_STATUSES.has(fact.artifact.status);
        const phase = attempt.submittedAt ? 'report' as const : 'taking' as const;
        const resume: ResumeWorkspace | null = isTerminal ? null : {
          kind: 'mock_exam', conversationId: fact.artifact.conversationId, artifactId: fact.artifact.id,
          attemptId: attempt.id, phase, subject: attempt.paper.subject, paperTitle: attempt.paper.title
        };
        const total = attempt.correctCount == null ? 0 : (attempt.correctCount ?? 0) + (attempt.wrongCount ?? 0) + (attempt.unansweredCount ?? 0);
        stages.push({
          id: `mock:${fact.artifact.id}`, kind: 'mock_exam', conversationId: fact.artifact.conversationId,
          journeyId: fact.artifact.id, title: attempt.paper.title || fact.artifact.title, subject: attempt.paper.subject,
          taskType: 'mock_exam', status: resume ? (phase === 'report' ? 'report_ready' : 'active') : fact.artifact.status,
          startedAt: attempt.startedAt.toISOString(), updatedAt: attempt.updatedAt.toISOString(), completedAt: iso(attempt.submittedAt),
          metrics: {
            batchCount: 1, completedBatchCount: attempt.submittedAt ? 1 : 0, allocatedQuestionCount: total,
            answeredQuestionCount: total - (attempt.unansweredCount ?? 0), correctCount: attempt.correctCount ?? 0,
            accuracy: accuracy(attempt.correctCount ?? 0, Math.max(0, total - (attempt.unansweredCount ?? 0))),
            assistanceCount: assistanceByRun.get(fact.artifact.runId) ?? 0,
            teachingCount: teachingByConversation.get(fact.artifact.conversationId) ?? 0
          },
          resume,
          provenance: { source: 'agent_artifacts', artifactIds: [fact.artifact.id], domainEntityRefs: [{ type: 'mock_exam_attempt', id: String(attempt.id) }] }
        });
        continue;
      }
      if (!fact.roundId || !taskType) continue;
      const round = roundById.get(fact.roundId);
      if (!round) continue;
      const isTerminal = TERMINAL_ARTIFACT_STATUSES.has(fact.artifact.status);
      const phase = round.submittedAt ? 'report' as const : 'practice' as const;
      const resume: ResumeWorkspace | null = isTerminal ? null : {
        kind: 'adaptive_round', conversationId: fact.artifact.conversationId, artifactId: fact.artifact.id,
        roundId: round.id, phase, taskType, subject: round.session.subject
      };
      const answered = round.items.filter((item) => item.selectedAnswer !== null).length;
      const correct = round.items.filter((item) => item.isCorrect === true).length;
      stages.push({
        id: `practice:${fact.artifact.id}`, kind: 'practice', conversationId: fact.artifact.conversationId,
        journeyId: fact.artifact.id, title: fact.artifact.title, subject: round.session.subject, taskType,
        status: resume ? (phase === 'report' ? 'report_ready' : 'active') : fact.artifact.status,
        startedAt: round.startedAt.toISOString(), updatedAt: round.updatedAt.toISOString(), completedAt: iso(round.submittedAt),
        metrics: {
          batchCount: 1, completedBatchCount: round.submittedAt ? 1 : 0, allocatedQuestionCount: round.items.length,
          answeredQuestionCount: answered, correctCount: correct, accuracy: accuracy(correct, answered),
          assistanceCount: assistanceByRun.get(fact.artifact.runId) ?? 0,
          teachingCount: teachingByConversation.get(fact.artifact.conversationId) ?? 0
        },
        resume,
        provenance: { source: 'agent_artifacts', artifactIds: [fact.artifact.id], domainEntityRefs: [{ type: 'csca_adaptive_round', id: String(round.id) }] }
      });
    }

    for (const [journeyId, group] of freeGroups) {
      const ordered = [...group].sort((left, right) => (positiveInteger(left.snapshot.batchIndex) ?? 1) - (positiveInteger(right.snapshot.batchIndex) ?? 1));
      const latest = ordered[ordered.length - 1];
      const endedAt = dateValue(latest.snapshot.endedAt);
      const ended = latest.snapshot.journeyStatus === 'ended' || Boolean(endedAt);
      let completedBatchCount = 0;
      let allocatedQuestionCount = 0;
      let answeredQuestionCount = 0;
      let correctCount = 0;
      let assistanceCount = 0;
      let latestRound: (typeof rounds)[number] | undefined;
      for (const item of ordered) {
        const settlement = objectValue(item.snapshot.settlement);
        const questionCount = positiveInteger(item.task.questionCount) ?? 0;
        allocatedQuestionCount += questionCount;
        if (Object.keys(settlement).length) {
          completedBatchCount += 1;
          answeredQuestionCount += positiveInteger(settlement.targetTotal) ?? 0;
          correctCount += Number(settlement.targetCorrectCount ?? 0) || 0;
        }
        assistanceCount += assistanceByRun.get(item.artifact.runId) ?? 0;
        if (item.roundId && item.artifact.id === latest.artifact.id) latestRound = roundById.get(item.roundId);
      }
      const resume: ResumeWorkspace | null = !ended && latest.roundId && latestRound ? {
        kind: 'adaptive_round', conversationId: latest.artifact.conversationId, artifactId: latest.artifact.id,
        roundId: latestRound.id, phase: latestRound.submittedAt ? 'report' : 'practice', taskType: 'free_practice', subject: latestRound.session.subject
      } : null;
      const updatedAt = endedAt ?? latestRound?.updatedAt ?? latest.artifact.createdAt;
      stages.push({
        id: `free:${journeyId}`, kind: 'free_practice', conversationId: latest.artifact.conversationId,
        journeyId, title: '自由练习', subject: latestRound?.session.subject ?? (String(latest.task.subject ?? '') || null),
        taskType: 'free_practice', status: ended ? 'ended' : resume?.phase === 'report' ? 'report_ready' : 'active',
        startedAt: ordered[0].artifact.createdAt.toISOString(), updatedAt: updatedAt.toISOString(), completedAt: iso(endedAt),
        metrics: {
          batchCount: ordered.length, completedBatchCount, allocatedQuestionCount, answeredQuestionCount, correctCount,
          accuracy: accuracy(correctCount, answeredQuestionCount), assistanceCount,
          teachingCount: teachingByConversation.get(latest.artifact.conversationId) ?? 0
        },
        resume,
        provenance: {
          source: 'agent_artifacts', artifactIds: ordered.map((item) => item.artifact.id),
          domainEntityRefs: ordered.flatMap((item) => item.roundId ? [{ type: 'csca_adaptive_round', id: String(item.roundId) }] : [])
        }
      });
    }

    const pastPaperGroups = new Map<string, typeof pastPaperAttempts>();
    for (const attempt of pastPaperAttempts) {
      const key = `${attempt.conversationId}:${attempt.pastPaperId}`;
      const group = pastPaperGroups.get(key) ?? [];
      group.push(attempt);
      pastPaperGroups.set(key, group);
    }
    for (const [key, group] of pastPaperGroups) {
      const latest = [...group].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
      const activeAttempt = group.find((item) => item.status === 'in_progress' || item.status === 'submitting');
      const submitted = group.filter((item) => item.status === 'submitted');
      const correct = submitted.filter((item) => item.outcome === 'correct').length;
      const resume: ResumeWorkspace | null = activeAttempt ? {
        kind: 'past_paper', conversationId: latest.conversationId, slug: latest.pastPaper.slug, questionId: activeAttempt.sourceQuestionId
      } : null;
      stages.push({
        id: `paper:${key}`, kind: 'past_paper', conversationId: latest.conversationId, journeyId: key,
        title: latest.pastPaper.title, subject: latest.pastPaper.subject, taskType: 'past_paper',
        status: resume ? 'active' : 'completed', startedAt: group[group.length - 1].startedAt.toISOString(),
        updatedAt: latest.updatedAt.toISOString(), completedAt: resume ? null : iso(latest.submittedAt),
        metrics: {
          batchCount: 1, completedBatchCount: resume ? 0 : 1,
          allocatedQuestionCount: latest.pastPaper.questionCount ?? group.length,
          answeredQuestionCount: submitted.length, correctCount: correct, accuracy: accuracy(correct, submitted.length),
          assistanceCount: pastPaperAssistance.get(`${latest.conversationId}:${latest.pastPaper.slug}`) ?? 0,
          teachingCount: teachingByConversation.get(latest.conversationId) ?? 0
        },
        resume,
        provenance: {
          source: 'agent_past_paper_attempts', artifactIds: [],
          domainEntityRefs: group.map((item) => ({ type: 'agent_past_paper_attempt', id: item.id }))
        }
      });
    }

    for (const delivery of deliveries) {
      const context = objectValue(delivery.contextSnapshot);
      const conversationId = String(context.conversationId ?? '');
      if (!conversationId) continue;
      const unavailableContent = hasUnavailableTeachingContent(delivery);
      const resume: ResumeWorkspace | null = delivery.status === 'in_progress' && !unavailableContent
        ? { kind: 'teaching', conversationId, deliveryId: delivery.id }
        : null;
      const outcomeCorrect = delivery.outcomes.reduce((sum, item) => sum + item.correctCount, 0);
      const outcomeTotal = delivery.outcomes.reduce((sum, item) => sum + item.totalCount, 0);
      stages.push({
        id: `teaching:${delivery.id}`, kind: 'teaching', conversationId, journeyId: delivery.id,
        title: unavailableContent ? '历史讲解（内容已失效）' : String(objectValue(delivery.contentSnapshot).title ?? delivery.intervention.reasonSummary ?? '知识点讲解'),
        subject: delivery.intervention.subjectCode, taskType: 'concept_learning', status: unavailableContent ? 'content_unavailable' : delivery.status,
        startedAt: (delivery.startedAt ?? delivery.offeredAt ?? delivery.createdAt).toISOString(),
        updatedAt: delivery.updatedAt.toISOString(), completedAt: iso(delivery.completedAt),
        metrics: {
          batchCount: 1, completedBatchCount: delivery.status === 'completed' ? 1 : 0,
          allocatedQuestionCount: outcomeTotal, answeredQuestionCount: outcomeTotal, correctCount: outcomeCorrect,
          accuracy: accuracy(outcomeCorrect, outcomeTotal), assistanceCount: 0, teachingCount: 1
        },
        resume,
        provenance: { source: 'learning_intervention_deliveries', artifactIds: [], domainEntityRefs: [{ type: 'learning_intervention_delivery', id: delivery.id }] }
      });

      for (const verification of delivery.verifications) {
        if (!verification.round) continue;
        const verificationConversationId = verification.conversationId || conversationId;
        if (!verificationConversationId) continue;
        const answered = verification.round.items.filter((item) => item.selectedAnswer !== null).length;
        const correct = verification.round.items.filter((item) => item.isCorrect === true).length;
        const phase = verification.round.submittedAt ? 'report' as const : 'practice' as const;
        const resume: ResumeWorkspace | null = verification.status === 'started' ? {
          kind: 'adaptive_round', conversationId: verificationConversationId, verificationId: verification.id,
          roundId: verification.round.id, phase, taskType: 'intervention_verification', subject: delivery.intervention.subjectCode
        } : null;
        stages.push({
          id: `verification:${verification.id}`, kind: 'practice', conversationId: verificationConversationId,
          journeyId: delivery.id, title: `${String(objectValue(delivery.contentSnapshot).title ?? '知识点讲解')} · 独立验证`,
          subject: delivery.intervention.subjectCode, taskType: 'intervention_verification',
          status: resume ? (phase === 'report' ? 'report_ready' : 'active') : verification.status,
          startedAt: (verification.startedAt ?? verification.round.startedAt).toISOString(),
          updatedAt: verification.updatedAt.toISOString(), completedAt: iso(verification.completedAt),
          metrics: {
            batchCount: 1, completedBatchCount: verification.status === 'completed' ? 1 : 0,
            allocatedQuestionCount: verification.round.items.length, answeredQuestionCount: answered,
            correctCount: correct, accuracy: accuracy(correct, answered), assistanceCount: 0, teachingCount: 0
          },
          resume,
          provenance: {
            source: 'learning_intervention_deliveries', artifactIds: [],
            domainEntityRefs: [
              { type: 'learning_intervention_verification', id: verification.id },
              { type: 'csca_adaptive_round', id: String(verification.round.id) }
            ]
          }
        });
      }
    }

    stages.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const plans = artifactFacts
      .filter((item) => item.artifact.type === 'learning_plan')
      .map(({ artifact }) => ({
        id: artifact.id,
        type: artifact.type,
        status: artifact.status,
        title: artifact.title,
        summary: artifact.summary,
        route: artifact.route,
        snapshot: artifact.snapshot,
        createdAt: artifact.createdAt.toISOString()
      }));
    // A submitted round may still expose a report route, but it is no longer an
    // interrupted task. Only workspaces with a genuinely active learning action
    // should drive the global "continue learning" entry.
    const activeWorkspace = stages.map((item) => item.resume).find(isActiveLearningWorkspace) ?? null;
    return {
      schemaVersion: '1' as const,
      generatedAt: new Date().toISOString(),
      activeWorkspace,
      plans,
      stages: stages.slice(0, 100)
    };
  }
}
