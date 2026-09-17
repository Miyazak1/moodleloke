import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryEngineService } from '../csca-special-practice/mastery-engine.service';
import { SpecialPracticeSubject } from '../csca-special-practice/csca-special-practice.types';

type MockExamMasteryQuestion = {
  id: number;
  correctAnswer: string;
  knowledgeTags?: string[] | Prisma.JsonValue;
};

type MockExamMasteryAttempt = {
  userId: number | null;
  paper: { subject: string };
  answers: Prisma.JsonValue;
};

function tagsFromValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function recordStringMap(value: Prisma.JsonValue): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, next]) => [key, String(next ?? '')]));
}

function normalized(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function subjectOrNull(value: string): SpecialPracticeSubject | null {
  return value === 'math' || value === 'physics' || value === 'chemistry' ? value : null;
}

@Injectable()
export class MockExamMasteryBridgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masteryEngine: MasteryEngineService
  ) {}

  async updateFromSubmittedAttempt(attempt: MockExamMasteryAttempt, questions: MockExamMasteryQuestion[] | undefined) {
    if (!attempt.userId || !questions?.length) return [];
    const subject = subjectOrNull(attempt.paper.subject);
    if (!subject) return [];

    const [topics, storedQuestions, explicitMappings] = await Promise.all([
      this.prisma.cscaExamTopic.findMany({
        where: { subject, status: 'published' },
        orderBy: [{ weight: 'desc' }, { id: 'asc' }]
      }),
      this.prisma.mockExamQuestion.findMany({
        where: { id: { in: questions.map((question) => question.id) } },
        select: { id: true, knowledgeTags: true }
      }),
      this.prisma.cscaTopicMapping.findMany({
        where: { sourceType: 'mock_exam_question', sourceId: { in: questions.map((question) => question.id) }, topic: { subject, status: 'published' } },
        include: { topic: true },
        orderBy: [{ confidence: 'desc' }, { id: 'asc' }]
      })
    ]);
    if (!topics.length) return [];

    const storedTagMap = new Map(storedQuestions.map((question) => [question.id, tagsFromValue(question.knowledgeTags)]));
    const explicitMap = new Map<number, number>();
    explicitMappings.forEach((mapping) => {
      if (!explicitMap.has(mapping.sourceId)) explicitMap.set(mapping.sourceId, mapping.topicId);
    });
    const answers = recordStringMap(attempt.answers);
    const evidence = questions.flatMap((question) => {
      const topicId = explicitMap.get(question.id) ?? this.topicIdFromTags([
        ...tagsFromValue(question.knowledgeTags),
        ...(storedTagMap.get(question.id) ?? [])
      ], topics);
      if (!topicId) return [];
      const selected = answers[String(question.id)] ?? '';
      return [{
        userId: attempt.userId!,
        subject,
        topicId,
        isCorrect: Boolean(selected && selected === question.correctAnswer),
        difficulty: '模考'
      }];
    });
    return this.masteryEngine.updateFromRound(evidence);
  }

  private topicIdFromTags(tags: string[], topics: Array<{ id: number; code: string; title: string; module: string | null }>) {
    const normalizedTags = Array.from(new Set(tags.map(normalized).filter(Boolean)));
    if (!normalizedTags.length) return null;
    const exact = topics.find((topic) => {
      const title = normalized(topic.title);
      const module = normalized(topic.module);
      const code = normalized(topic.code);
      return normalizedTags.some((tag) => tag === title || tag === module || tag === code);
    });
    if (exact) return exact.id;
    const fuzzy = topics.find((topic) => {
      const candidates = [topic.title, topic.module, topic.code].map(normalized).filter(Boolean);
      return normalizedTags.some((tag) => {
        if (tag.length < 2) return false;
        return candidates.some((candidate) => candidate.includes(tag) || tag.includes(candidate));
      });
    });
    return fuzzy?.id ?? null;
  }
}
