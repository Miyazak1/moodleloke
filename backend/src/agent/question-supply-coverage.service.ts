import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { trustedQuestionTransferSignature } from '../csca-special-practice/adaptive-question-provider.service';
import { isIndependentVerificationQuestion } from '../csca-special-practice/student-question-eligibility';

const SUBJECTS = ['math', 'physics', 'chemistry'] as const;
const PRACTICE_BATCH_SIZE = 5;
const VERIFICATION_BATCH_SIZE = 3;

type CoverageTopic = {
  id: number;
  subject: string;
  module: string | null;
  code: string;
  title: string;
};

type CoverageQuestion = {
  id: number;
  topicId: number;
  status: string;
  sourceType: string;
  sourceQuestionId: number | null;
  version: number;
  designedDifficulty: string;
  empiricalDifficulty: string | null;
  difficultyConfidence: number | null;
  questionType: string;
  explanation: string;
  options: unknown;
  correctAnswer: string;
  knowledgeTags: unknown;
  generationMetadata: unknown;
  reviewMetadata: unknown;
  qualityMetric: { needsReview: boolean } | null;
  blueprint: { skill: string | null } | null;
};

function increment(target: Record<string, number>, key: string) {
  target[key || 'unknown'] = (target[key || 'unknown'] ?? 0) + 1;
}

export function buildQuestionSupplyCoverage(input: {
  topics: CoverageTopic[];
  questions: CoverageQuestion[];
  conceptCardTopicIds: number[];
  teachingAssetTopicIds: number[];
  generatedAt?: Date;
}) {
  const conceptCards = new Set(input.conceptCardTopicIds);
  const teachingAssets = new Set(input.teachingAssetTopicIds);
  const questionsByTopic = new Map<number, CoverageQuestion[]>();
  for (const question of input.questions) {
    const rows = questionsByTopic.get(question.topicId) ?? [];
    rows.push(question);
    questionsByTopic.set(question.topicId, rows);
  }
  const topics = input.topics.map((topic) => {
    const questions = questionsByTopic.get(topic.id) ?? [];
    const clean = questions.filter((question) => !question.qualityMetric?.needsReview);
    const verification = clean.filter((question) => question.status === 'approved'
      && question.sourceType !== 'ai'
      && question.sourceQuestionId === null
      && isIndependentVerificationQuestion(question));
    const transferFamilies = new Set(verification.map(trustedQuestionTransferSignature).filter(Boolean));
    const difficulty: Record<string, number> = {};
    const questionTypes: Record<string, number> = {};
    for (const question of clean) {
      increment(difficulty, question.empiricalDifficulty && (question.difficultyConfidence ?? 0) >= 0.35
        ? question.empiricalDifficulty
        : question.designedDifficulty);
      increment(questionTypes, question.questionType);
    }
    const explainedCount = clean.filter((question) => question.explanation.trim().length > 0).length;
    const gaps = [
      ...(clean.length < PRACTICE_BATCH_SIZE ? ['PRACTICE_BATCH_INSUFFICIENT'] : []),
      ...(verification.length < VERIFICATION_BATCH_SIZE ? ['VERIFICATION_BATCH_INSUFFICIENT'] : []),
      ...(explainedCount < PRACTICE_BATCH_SIZE ? ['EXPLANATION_COVERAGE_INSUFFICIENT'] : []),
      ...(!conceptCards.has(topic.id) && !teachingAssets.has(topic.id) ? ['TEACHING_CONTENT_MISSING'] : [])
    ];
    return {
      topicId: topic.id,
      subject: topic.subject,
      module: topic.module,
      code: topic.code,
      title: topic.title,
      practice: {
        availableCount: clean.length,
        requiredCount: PRACTICE_BATCH_SIZE,
        ready: clean.length >= PRACTICE_BATCH_SIZE
      },
      verification: {
        availableCount: verification.length,
        requiredCount: VERIFICATION_BATCH_SIZE,
        transferFamilyCount: transferFamilies.size,
        ready: verification.length >= VERIFICATION_BATCH_SIZE
      },
      content: {
        explainedQuestionCount: explainedCount,
        hasConceptCard: conceptCards.has(topic.id),
        hasTeachingAsset: teachingAssets.has(topic.id)
      },
      distribution: { difficulty, questionTypes },
      gaps
    };
  });
  const subjects = SUBJECTS.map((subject) => {
    const rows = topics.filter((topic) => topic.subject === subject);
    return {
      subject,
      topicCount: rows.length,
      practiceReadyTopicCount: rows.filter((topic) => topic.practice.ready).length,
      verificationReadyTopicCount: rows.filter((topic) => topic.verification.ready).length,
      fullyReadyTopicCount: rows.filter((topic) => topic.gaps.length === 0).length,
      blockedTopicCount: rows.filter((topic) => topic.gaps.length > 0).length
    };
  });
  return {
    schemaVersion: '1' as const,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    thresholds: { practiceBatchSize: PRACTICE_BATCH_SIZE, verificationBatchSize: VERIFICATION_BATCH_SIZE },
    summary: {
      topicCount: topics.length,
      practiceReadyTopicCount: topics.filter((topic) => topic.practice.ready).length,
      verificationReadyTopicCount: topics.filter((topic) => topic.verification.ready).length,
      fullyReadyTopicCount: topics.filter((topic) => topic.gaps.length === 0).length,
      blockedTopicCount: topics.filter((topic) => topic.gaps.length > 0).length
    },
    subjects,
    topics
  };
}

@Injectable()
export class QuestionSupplyCoverageService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoverage(subjectValue?: string) {
    const subject = SUBJECTS.includes(subjectValue as typeof SUBJECTS[number]) ? subjectValue : undefined;
    const topics = await this.prisma.cscaExamTopic.findMany({
      where: { status: 'published', ...(subject ? { subject } : { subject: { in: [...SUBJECTS] } }) },
      select: { id: true, subject: true, module: true, code: true, title: true },
      orderBy: [{ subject: 'asc' }, { module: 'asc' }, { code: 'asc' }]
    });
    const topicIds = topics.map((topic) => topic.id);
    if (!topicIds.length) return buildQuestionSupplyCoverage({ topics: [], questions: [], conceptCardTopicIds: [], teachingAssetTopicIds: [] });
    const [questions, conceptCards, teachingAssets] = await Promise.all([
      this.prisma.cscaQuestion.findMany({
        where: { topicId: { in: topicIds }, status: { in: ['approved', 'published'] } },
        select: {
          id: true, topicId: true, status: true, sourceType: true, sourceQuestionId: true, version: true,
          designedDifficulty: true, empiricalDifficulty: true, difficultyConfidence: true,
          questionType: true, explanation: true, options: true, correctAnswer: true, knowledgeTags: true,
          generationMetadata: true, reviewMetadata: true,
          qualityMetric: { select: { needsReview: true } },
          blueprint: { select: { skill: true } }
        }
      }),
      this.prisma.cscaConceptCard.findMany({
        where: { topicId: { in: topicIds }, status: 'published' },
        distinct: ['topicId'], select: { topicId: true }
      }),
      this.prisma.teachingAssetTopic.findMany({
        where: {
          topicId: { in: topicIds }, relationship: 'primary',
          asset: { status: 'published', versions: { some: { status: 'published' } } }
        },
        distinct: ['topicId'], select: { topicId: true }
      })
    ]);
    return buildQuestionSupplyCoverage({
      topics,
      questions,
      conceptCardTopicIds: conceptCards.map((item) => item.topicId),
      teachingAssetTopicIds: teachingAssets.map((item) => item.topicId)
    });
  }
}
