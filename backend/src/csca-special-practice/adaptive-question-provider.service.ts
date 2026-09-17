import { Injectable } from '@nestjs/common';
import {
  subjectPracticeCurrentPolicyBlockReasons
} from '../ai-questioning/subject-practice-task-family-policy';
import { isStudentConsumableAiVersionStatus } from '../ai-questioning/question-version-governance';
import { PrismaService } from '../prisma/prisma.service';
import { ADAPTIVE_EXPOSURE_SOURCE, AdaptivePlannedQuestion, AdaptivePlannedTopic, IndependentVerificationQuestion } from './csca-adaptive.types';

type CandidateQuestion = {
  id: number;
  source: 'special_practice' | 'csca_question';
  difficulty: string;
  exposurePenalty: number;
  profilePriority: number;
  topicId: number;
  topicCode: string;
  topicTitle: string;
};

function difficultyScore(difficulty: string, targetDifficulty: string) {
  const rank = (value: string) => {
    if (value.includes('挑战')) return 4;
    if (value.includes('较难') || value.includes('提高')) return 3;
    if (value.includes('中')) return 2;
    return 1;
  };
  return Math.abs(rank(difficulty) - rank(targetDifficulty));
}

function difficultyRank(difficulty: string) {
  if (difficulty.includes('挑战')) return 4;
  if (difficulty.includes('较难') || difficulty.includes('提高')) return 3;
  if (difficulty.includes('中')) return 2;
  return 1;
}

function difficultyOverTarget(difficulty: string, targetDifficulty: string) {
  return Math.max(0, difficultyRank(difficulty) - difficultyRank(targetDifficulty));
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

export function trustedQuestionTransferSignature(question: {
  questionType?: string | null;
  knowledgeTags?: unknown;
  generationMetadata?: unknown;
  reviewMetadata?: unknown;
  blueprint?: { skill?: string | null } | null;
}) {
  const generation = recordFrom(question.generationMetadata);
  const questionPlan = recordFrom(generation.questionPlan);
  const review = recordFrom(question.reviewMetadata);
  const reviewPlan = recordFrom(review.questionPlan);
  const taskFamily = String(questionPlan.taskFamily ?? generation.taskFamily ?? reviewPlan.taskFamily ?? '').trim();
  if (taskFamily) return `task_family:${taskFamily}`;
  const blueprintSkill = String(question.blueprint?.skill ?? '').trim();
  if (blueprintSkill) return `blueprint_skill:${blueprintSkill}`;
  const tags = [...new Set(cleanStringArray(question.knowledgeTags))].sort();
  if (tags.length) return `taxonomy:${String(question.questionType ?? 'unknown')}|${tags.join('+')}`;
  return null;
}

function exposurePenaltyFromGovernance(reviewMetadata: unknown) {
  const qualityGovernance = recordFrom(recordFrom(reviewMetadata).qualityGovernance);
  return qualityGovernance.disposition === 'reduce_exposure' ? 1000 : 0;
}

function profilePriorityFromGenerationMetadata(value: unknown) {
  const metadata = recordFrom(value);
  const sourceKind = String(metadata.sourceKind ?? metadata.generationSource ?? '');
  return sourceKind === 'syllabus_and_past_paper_profile' ? -50 : 0;
}

function isOnlineMockExamApproval(value: unknown) {
  const review = recordFrom(value);
  const approval = recordFrom(review.mockExamApproval);
  return ['approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft'].includes(String(approval.status ?? ''));
}

function isOnlineMockExamQuestion(generationMetadata: unknown, reviewMetadata?: unknown) {
  const metadata = recordFrom(generationMetadata);
  const scope = recordFrom(metadata.scope);
  const mockExamSlot = recordFrom(metadata.mockExamSlot);
  const generationMode = String(metadata.generationMode ?? '');
  return (
    scope.targetUseCase === 'online_mock_exam' ||
    metadata.targetUseCase === 'online_mock_exam' ||
    generationMode === 'online_mock_exam_candidate' ||
    generationMode.startsWith('online_mock_candidate_') ||
    Boolean(mockExamSlot.slotId || mockExamSlot.blueprintId || mockExamSlot.sourcePaperId) ||
    isOnlineMockExamApproval(reviewMetadata)
  );
}

function isPublishedSubjectPracticeAiQuestion(reviewMetadata: unknown) {
  const review = recordFrom(reviewMetadata);
  const approval = recordFrom(review.subjectPracticeAutoApproval);
  return approval.status === 'published_to_subject_practice'
    && approval.targetUseCase === 'subject_practice'
    && approval.targetQuestionBank === 'special_practice_questions';
}

function isFallbackOrSmokeQuestion(generationMetadata: unknown) {
  const metadata = recordFrom(generationMetadata);
  const sourceKind = String(metadata.sourceKind ?? '').toLowerCase();
  const generationSource = String(metadata.generationSource ?? '').toLowerCase();
  const generationMode = String(metadata.generationMode ?? '').toLowerCase();
  return (
    metadata.fallbackUsed === true ||
    metadata.generator === 'rule-fallback' ||
    metadata.status === 'generator_disabled' ||
    sourceKind.includes('smoke') ||
    generationSource.includes('smoke') ||
    generationMode.includes('smoke')
  );
}

function isUsableQuestionVersion(generationMetadata: unknown) {
  const metadata = recordFrom(generationMetadata);
  const governance = recordFrom(metadata.versionGovernance);
  const status = String(governance.status ?? '');
  return isStudentConsumableAiVersionStatus(status);
}

function isFormalSubjectPracticeAiRow(row: {
  subject: string;
  status: string;
  topicId: number;
  syllabusVersion: string;
  designedDifficulty: string;
  prompt: string;
  options: unknown;
  explanation: string;
  generationMetadata: unknown;
  reviewMetadata: unknown;
}, topicId: number, syllabusVersion: string) {
  return (
    row.status === 'approved' &&
    row.topicId === topicId &&
    row.syllabusVersion === syllabusVersion &&
    isPublishedSubjectPracticeAiQuestion(row.reviewMetadata) &&
    !isOnlineMockExamQuestion(row.generationMetadata, row.reviewMetadata) &&
    !isFallbackOrSmokeQuestion(row.generationMetadata) &&
    isUsableQuestionVersion(row.generationMetadata) &&
    subjectPracticeCurrentPolicyBlockReasons(row).length === 0
  );
}

@Injectable()
export class AdaptiveQuestionProviderService {
  constructor(private readonly prisma: PrismaService) {}

  async pickIndependentVerificationQuestions(
    userId: number,
    topicId: number,
    limit: number,
    excludedRefs: string[] = [],
    constraints: { requireDifferentTransferSignature?: boolean; excludedTransferSignatures?: string[] } = {}
  ): Promise<IndependentVerificationQuestion[]> {
    const candidates = await this.prisma.cscaQuestion.findMany({
      where: {
        topicId, status: 'approved', sourceType: { not: 'ai' }, sourceQuestionId: null,
        topic: { status: 'published' }
      },
      select: {
        id: true, version: true, designedDifficulty: true, empiricalDifficulty: true,
        difficultyConfidence: true, qualityMetric: { select: { needsReview: true } },
        questionType: true, knowledgeTags: true, generationMetadata: true, reviewMetadata: true,
        blueprint: { select: { skill: true } },
        topic: { select: { id: true, code: true, title: true } }
      },
      orderBy: [{ version: 'desc' }, { id: 'asc' }],
      take: Math.max(limit * 8, 24)
    });
    const excludedSignatures = new Set(constraints.excludedTransferSignatures ?? []);
    const allowed = candidates.filter((item) => {
      if (item.qualityMetric?.needsReview || excludedRefs.includes(`csca_question:${item.id}:v${item.version}`)) return false;
      const signature = trustedQuestionTransferSignature(item);
      return !constraints.requireDifferentTransferSignature || Boolean(signature && !excludedSignatures.has(signature));
    });
    if (!allowed.length) return [];
    const ids = allowed.map((item) => item.id);
    const questionIds = ids.map((id) => `csca_question:${id}`);
    const [adaptiveExposures, measurementExposures, evidenceRows] = await Promise.all([
      this.prisma.cscaQuestionExposure.findMany({ where: { userId, questionId: { in: ids } }, select: { questionId: true } }),
      this.prisma.assessmentItemExposure.findMany({ where: { userId, itemType: 'csca_question', itemId: { in: ids.map(String) } }, select: { itemId: true } }),
      this.prisma.learningEvidenceEvent.findMany({ where: { userId, questionId: { in: questionIds } }, select: { questionId: true } })
    ]);
    const exposed = new Set<string>([
      ...adaptiveExposures.map((item) => String(item.questionId)),
      ...measurementExposures.map((item) => item.itemId),
      ...evidenceRows.map((item) => item.questionId.replace(/^csca_question:/, ''))
    ]);
    return allowed
      .filter((item) => !exposed.has(String(item.id)))
      .slice(0, limit)
      .map((item) => ({
        questionId: item.id, questionSource: 'csca_question' as const, questionVersion: item.version,
        topicId: item.topic.id, topicCode: item.topic.code, topicTitle: item.topic.title,
        transferSignature: trustedQuestionTransferSignature(item),
        questionDifficulty: item.empiricalDifficulty && (item.difficultyConfidence ?? 0) >= .35
          ? item.empiricalDifficulty : item.designedDifficulty
      }));
  }

  async pickQuestions(userId: number, plannedTopics: AdaptivePlannedTopic[], limit: number): Promise<AdaptivePlannedQuestion[]> {
    const topicIds = plannedTopics.map((topic) => topic.topicId);
    const directQuestions = await this.prisma.cscaQuestion.findMany({
      where: {
        topicId: { in: topicIds },
        status: 'approved',
        sourceType: { not: 'ai' },
        sourceQuestionId: null,
        topic: { status: 'published' }
      },
      select: {
        id: true,
        topicId: true,
        designedDifficulty: true,
        empiricalDifficulty: true,
        difficultyConfidence: true,
        generationMetadata: true,
        reviewMetadata: true,
        syllabusVersion: true,
        topic: { select: { code: true, title: true, syllabusVersion: true } }
      }
    });
    const mappings = await this.prisma.cscaTopicMapping.findMany({
      where: { sourceType: 'special_practice_question', topicId: { in: topicIds }, topic: { status: 'published' } },
      include: { topic: true }
    });
    const questionIds = Array.from(new Set(mappings.map((mapping) => mapping.sourceId)));
    const aiBackedQuestions = await this.prisma.cscaQuestion.findMany({
      where: { sourceType: 'ai', sourceQuestionId: { in: questionIds } },
      select: {
        sourceQuestionId: true,
        subject: true,
        status: true,
        syllabusVersion: true,
        topicId: true,
        designedDifficulty: true,
        prompt: true,
        options: true,
        explanation: true,
        generationMetadata: true,
        reviewMetadata: true
      }
    });
    const aiRowsBySourceQuestionId = new Map<number, typeof aiBackedQuestions>();
    for (const row of aiBackedQuestions) {
      if (!row.sourceQuestionId) continue;
      const rows = aiRowsBySourceQuestionId.get(row.sourceQuestionId) ?? [];
      rows.push(row);
      aiRowsBySourceQuestionId.set(row.sourceQuestionId, rows);
    }
    const questions = await this.prisma.specialPracticeQuestion.findMany({
      where: { id: { in: questionIds }, status: 'published' },
      select: { id: true, difficulty: true }
    });
    const directCurrentQuestions = directQuestions.filter((question) => (
      question.syllabusVersion === question.topic.syllabusVersion &&
      !isOnlineMockExamQuestion(question.generationMetadata, question.reviewMetadata)
    ));
    const exposureIds = Array.from(new Set([...questionIds, ...directCurrentQuestions.map((question) => question.id)]));
    const exposureRows = exposureIds.length ? await this.prisma.cscaQuestionExposure.findMany({
      where: {
        userId,
        questionId: { in: exposureIds },
        source: { in: [`${ADAPTIVE_EXPOSURE_SOURCE}:special_practice`, `${ADAPTIVE_EXPOSURE_SOURCE}:csca_question`, ADAPTIVE_EXPOSURE_SOURCE] }
      }
    }) : [];
    const exposureMap = new Map(exposureRows.map((row) => [`${row.source ?? ADAPTIVE_EXPOSURE_SOURCE}:${row.questionId}`, row]));
    const questionMap = new Map(questions.map((question) => [question.id, question]));
    const candidatesByTopic = new Map<number, CandidateQuestion[]>();

    for (const question of directCurrentQuestions) {
      const items = candidatesByTopic.get(question.topicId) ?? [];
      items.push({
        id: question.id,
        source: 'csca_question',
        difficulty: question.empiricalDifficulty && (question.difficultyConfidence ?? 0) >= 0.35 ? question.empiricalDifficulty : question.designedDifficulty,
        exposurePenalty: exposurePenaltyFromGovernance(question.reviewMetadata),
        profilePriority: profilePriorityFromGenerationMetadata(question.generationMetadata),
        topicId: question.topicId,
        topicCode: question.topic.code,
        topicTitle: question.topic.title
      });
      candidatesByTopic.set(question.topicId, items);
    }

    for (const mapping of mappings) {
      const question = questionMap.get(mapping.sourceId);
      if (!question) continue;
      const aiRows = aiRowsBySourceQuestionId.get(mapping.sourceId) ?? [];
      const subjectPracticeAiRows = aiRows.filter((row) => !isOnlineMockExamQuestion(row.generationMetadata, row.reviewMetadata) && !isFallbackOrSmokeQuestion(row.generationMetadata) && isUsableQuestionVersion(row.generationMetadata));
      if (aiRows.length && !subjectPracticeAiRows.some((row) => isFormalSubjectPracticeAiRow(row, mapping.topicId, mapping.topic.syllabusVersion))) {
        continue;
      }
      const activeAiRow = subjectPracticeAiRows.find((row) => isFormalSubjectPracticeAiRow(row, mapping.topicId, mapping.topic.syllabusVersion));
      const items = candidatesByTopic.get(mapping.topicId) ?? [];
      items.push({
        id: question.id,
        source: 'special_practice',
        difficulty: question.difficulty,
        exposurePenalty: exposurePenaltyFromGovernance(activeAiRow?.reviewMetadata),
        profilePriority: profilePriorityFromGenerationMetadata(activeAiRow?.generationMetadata),
        topicId: mapping.topicId,
        topicCode: mapping.topic.code,
        topicTitle: mapping.topic.title
      });
      candidatesByTopic.set(mapping.topicId, items);
    }

    const selected: AdaptivePlannedQuestion[] = [];
    const selectedIds = new Set<string>();
    for (const plannedTopic of plannedTopics) {
      const preferredQuestionIds = new Set(plannedTopic.preferredQuestionIds ?? []);
      const candidates = (candidatesByTopic.get(plannedTopic.topicId) ?? [])
        .filter((candidate) => !selectedIds.has(`${candidate.source}:${candidate.id}`))
        .sort((a, b) => {
          const aPreferred = a.source === 'csca_question' && preferredQuestionIds.has(a.id) ? 0 : 1;
          const bPreferred = b.source === 'csca_question' && preferredQuestionIds.has(b.id) ? 0 : 1;
          const aExposure = exposureMap.get(`${ADAPTIVE_EXPOSURE_SOURCE}:${a.source}:${a.id}`)?.seenCount
            ?? (a.source === 'special_practice' ? exposureMap.get(`${ADAPTIVE_EXPOSURE_SOURCE}:${a.id}`)?.seenCount : undefined)
            ?? 0;
          const bExposure = exposureMap.get(`${ADAPTIVE_EXPOSURE_SOURCE}:${b.source}:${b.id}`)?.seenCount
            ?? (b.source === 'special_practice' ? exposureMap.get(`${ADAPTIVE_EXPOSURE_SOURCE}:${b.id}`)?.seenCount : undefined)
            ?? 0;
          return (
            a.exposurePenalty - b.exposurePenalty ||
            a.profilePriority - b.profilePriority ||
            aPreferred - bPreferred ||
            difficultyScore(a.difficulty, plannedTopic.targetDifficulty) - difficultyScore(b.difficulty, plannedTopic.targetDifficulty) ||
            difficultyOverTarget(a.difficulty, plannedTopic.targetDifficulty) - difficultyOverTarget(b.difficulty, plannedTopic.targetDifficulty) ||
            aExposure - bExposure ||
            (a.source === b.source ? 0 : a.source === 'csca_question' ? -1 : 1) ||
            a.id - b.id
          );
        });
      const next = candidates[0];
      if (!next) continue;
      selectedIds.add(`${next.source}:${next.id}`);
      selected.push({
        ...plannedTopic,
        questionId: next.id,
        questionSource: next.source,
        questionDifficulty: next.difficulty
      });
      if (selected.length >= limit) return selected;
    }

    if (selected.length >= limit) return selected;

    const fallbackCandidates = Array.from(candidatesByTopic.values()).flat()
      .filter((candidate) => !selectedIds.has(`${candidate.source}:${candidate.id}`))
      .sort((a, b) => {
        const aTopic = plannedTopics.find((topic) => topic.topicId === a.topicId);
        const bTopic = plannedTopics.find((topic) => topic.topicId === b.topicId);
        const aExposure = exposureMap.get(`${ADAPTIVE_EXPOSURE_SOURCE}:${a.source}:${a.id}`)?.seenCount
          ?? (a.source === 'special_practice' ? exposureMap.get(`${ADAPTIVE_EXPOSURE_SOURCE}:${a.id}`)?.seenCount : undefined)
          ?? 0;
        const bExposure = exposureMap.get(`${ADAPTIVE_EXPOSURE_SOURCE}:${b.source}:${b.id}`)?.seenCount
          ?? (b.source === 'special_practice' ? exposureMap.get(`${ADAPTIVE_EXPOSURE_SOURCE}:${b.id}`)?.seenCount : undefined)
          ?? 0;
        const aTarget = aTopic?.targetDifficulty ?? a.difficulty;
        const bTarget = bTopic?.targetDifficulty ?? b.difficulty;
        return (
          a.exposurePenalty - b.exposurePenalty ||
          a.profilePriority - b.profilePriority ||
          difficultyScore(a.difficulty, aTarget) - difficultyScore(b.difficulty, bTarget) ||
          difficultyOverTarget(a.difficulty, aTarget) - difficultyOverTarget(b.difficulty, bTarget) ||
          aExposure - bExposure ||
          (a.source === b.source ? 0 : a.source === 'csca_question' ? -1 : 1) ||
          a.id - b.id
        );
      });
    for (const candidate of fallbackCandidates) {
      const plannedTopic = plannedTopics.find((topic) => topic.topicId === candidate.topicId);
      if (!plannedTopic) continue;
      selectedIds.add(`${candidate.source}:${candidate.id}`);
      selected.push({
        ...plannedTopic,
        questionId: candidate.id,
        questionSource: candidate.source,
        questionDifficulty: candidate.difficulty
      });
      if (selected.length >= limit) break;
    }
    return selected;
  }
}
