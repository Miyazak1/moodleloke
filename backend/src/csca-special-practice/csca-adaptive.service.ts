import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  subjectPracticeCurrentPolicyBlockReasons
} from '../ai-questioning/subject-practice-task-family-policy';
import { isStudentConsumableAiVersionStatus } from '../ai-questioning/question-version-governance';
import { QuestionQualityService } from '../ai-questioning/question-quality.service';
import { CscaLearningService } from '../csca-learning/csca-learning.service';
import { mapTrustedQuestionEvidence } from '../learning-intelligence/evidence/learning-evidence-mapper';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence/learning-intelligence-feature-flags.service';
import { LEARNING_EVIDENCE_WRITER, LearningEvidenceWriter, LearningEvidenceWriteResult, learningEvidenceReceipt } from '../learning-intelligence/learning-evidence-writer.port';
import { PrismaService } from '../prisma/prisma.service';
import { AdaptivePlannerService } from './adaptive-planner.service';
import { AdaptiveQuestionProviderService, trustedQuestionTransferSignature } from './adaptive-question-provider.service';
import {
  ADAPTIVE_EXPOSURE_SOURCE,
  ADAPTIVE_DIAGNOSTIC_ROUND_SIZE,
  ADAPTIVE_ROUND_SIZE,
  AdaptiveVerificationRequest,
  AdaptiveRoundCreatePayload,
  AdaptiveRoundPatchPayload,
  InterventionVerificationRoundInput,
  assertAdaptiveSubject,
  cleanAdaptiveMode,
  cleanAdaptiveQuestionLanguage,
  expectedVersionFrom,
  numberMap,
  optionsFromJson,
  recordStringMap,
  tagsFromJson
} from './csca-adaptive.types';
import { SpecialPracticeSubject } from './csca-special-practice.types';
import { MasteryEngineService } from './mastery-engine.service';
import { PlannerAssistantService } from './planner-assistant.service';
import { TrainingEventService } from './training-event.service';

const ADAPTIVE_ROUND_LOCK_NAMESPACE = 2_147_001_103;
const DIAGNOSTIC_CONFIDENCE_READY_THRESHOLD = 0.45;
const ADAPTIVE_PRACTICE_POOL_EXHAUSTED = 'ADAPTIVE_PRACTICE_POOL_EXHAUSTED';

function parseId(value: string, message: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundException(message);
  return id;
}

function subjectLabel(subject: SpecialPracticeSubject) {
  return subject === 'math' ? '数学' : subject === 'physics' ? '物理' : '化学';
}

function roundQuestionKey(source: string | null | undefined, id: number) {
  return `${source || 'special_practice'}:${id}`;
}

function difficultyRank(value?: string | null) {
  const text = String(value ?? '').trim();
  if (text.includes('挑战')) return 4;
  if (text.includes('较难') || text.includes('提高')) return 3;
  if (text.includes('中')) return 2;
  return 1;
}

function difficultyLabel(score: number | null) {
  if (score === null) return null;
  if (score >= 3.5) return '挑战';
  if (score >= 2.5) return '较难';
  if (score >= 1.5) return '中等';
  return '基础';
}

function difficultyDirection(delta: number | null) {
  if (delta === null) return 'insufficient';
  if (delta >= 0.5) return 'increased';
  if (delta <= -0.5) return 'decreased';
  return 'steady';
}

function cleanString(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function adaptiveLanguage(value?: string | null) {
  const language = String(value ?? 'zh').trim().toLowerCase();
  if (language === 'vi' || language.startsWith('vi-')) return 'vi';
  if (language === 'en' || language.startsWith('en-')) return 'en';
  return 'zh';
}

function localizedRecord<T extends Record<string, unknown>>(value: Prisma.JsonValue | unknown, language = 'zh'): T | null {
  if (language === 'zh' || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const localized = record[language] ?? (language === 'vi' ? record.en : undefined);
  return localized && typeof localized === 'object' && !Array.isArray(localized) ? localized as T : null;
}

function recordFrom(value: Prisma.JsonValue | unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringsFromJson(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function hasHan(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function fallbackDifficulty(value: string, language: string) {
  if (language === 'zh') return value;
  if (language === 'vi') {
    if (value.includes('挑战')) return 'Thử thách';
    if (value.includes('较难') || value.includes('提高')) return 'Khó hơn';
    if (value.includes('中')) return 'Trung bình';
    return 'Cơ bản';
  }
  if (value.includes('挑战')) return 'Challenge';
  if (value.includes('较难') || value.includes('提高')) return 'Advanced';
  if (value.includes('中')) return 'Medium';
  return 'Core';
}

const OPTION_TEXT_FALLBACKS: Record<string, { en: string; vi: string }> = {
  电子转移: { en: 'Electron transfer', vi: 'Chuyển electron' },
  生成沉淀: { en: 'Formation of a precipitate', vi: 'Tạo kết tủa' },
  吸收热量: { en: 'Absorption of heat', vi: 'Hấp thụ nhiệt' },
  溶液变色: { en: 'Color change in solution', vi: 'Dung dịch đổi màu' },
  降低反应速率: { en: 'Lower the reaction rate', vi: 'Giảm tốc độ phản ứng' },
  减少目标产物: { en: 'Reduce the target product', vi: 'Giảm sản phẩm mục tiêu' },
  提高原料利用率: { en: 'Improve raw material utilization', vi: 'Tăng hiệu suất sử dụng nguyên liệu' },
  使反应停止: { en: 'Stop the reaction', vi: 'Làm phản ứng dừng lại' },
  固体和液体: { en: 'Solid and liquid', vi: 'Chất rắn và chất lỏng' },
  安全与成本: { en: 'Safety and cost', vi: 'An toàn và chi phí' },
  用手轻轻扇闻: { en: 'Gently waft the gas by hand', vi: 'Dùng tay phẩy nhẹ để ngửi' },
  把鼻子直接凑近: { en: 'Put the nose directly close', vi: 'Đưa mũi lại gần trực tiếp' },
  大口吸入: { en: 'Inhale deeply', vi: 'Hít mạnh' },
  点燃后再闻: { en: 'Ignite it before smelling', vi: 'Đốt rồi mới ngửi' }
};

function fallbackOptionText(text: string, id: string, language: string) {
  if (language === 'zh' || !hasHan(text)) return text;
  const mapped = OPTION_TEXT_FALLBACKS[text.trim()];
  if (mapped) return language === 'vi' ? mapped.vi : mapped.en;
  return language === 'vi' ? `Phương án ${id}` : `Option ${id}`;
}

function fallbackPromptText(prompt: string, topicTitle: string, orderNumber: number, language: string) {
  if (language === 'zh' || !hasHan(prompt)) return prompt;
  const source = prompt.replace(/^【[^】]+】\s*/, '').trim();
  if (/氧化还原反应的本质是/.test(source)) {
    return language === 'vi'
      ? 'Bản chất của phản ứng oxi hóa khử là gì?'
      : 'What is the essence of a redox reaction?';
  }
  if (/工业流程中循环利用未反应物，主要目的是/.test(source)) {
    return language === 'vi'
      ? 'In an industrial process, what is the main purpose of recycling unreacted materials?'
      : 'In an industrial process, what is the main purpose of recycling unreacted materials?';
  }
  return language === 'vi'
    ? `${topicTitle}: Câu ${orderNumber}. Chọn phương án phù hợp nhất với chủ đề này.`
    : `${topicTitle}: Question ${orderNumber}. Choose the option that best matches this topic.`;
}

function fallbackExplanationText(explanation: string, correctAnswer: string | undefined, topicTitle: string, language: string) {
  if (language === 'zh' || !hasHan(explanation)) return explanation;
  const answer = correctAnswer || 'the correct option';
  return language === 'vi'
    ? `Giải thích tiêu chuẩn cho câu hỏi cũ này chưa có bản dịch đầy đủ. Đáp án đúng là ${answer}. Hãy đối chiếu yêu cầu trong đề với từng lựa chọn và ôn lại chủ đề "${topicTitle}" trước khi làm tiếp.`
    : `The full standard explanation for this legacy question is not translated yet. The correct answer is ${answer}. Compare the question target with each option and review "${topicTitle}" before moving on.`;
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function verificationFromPlannerSnapshot(value: unknown) {
  const snapshot = recordFromUnknown(value);
  if (snapshot.mode === 'intervention_verification') {
    const focus = recordFromUnknown(snapshot.focus);
    const topicId = Number(focus.topicId);
    return {
      patternId: null,
      topicId: Number.isInteger(topicId) && topicId > 0 ? topicId : null,
      patternType: 'learning_intervention',
      interventionVerificationId: String(focus.verificationId ?? '') || null
    };
  }
  if (snapshot.mode !== 'verification') return null;
  const focus = recordFromUnknown(snapshot.focus);
  const reviewItemId = Number(focus.reviewItemId);
  if (!Number.isInteger(reviewItemId) || reviewItemId <= 0) return null;
  const topicId = Number(focus.topicId);
  return {
    patternId: reviewItemId,
    topicId: Number.isInteger(topicId) && topicId > 0 ? topicId : null,
    patternType: typeof focus.patternType === 'string' ? focus.patternType : null,
    interventionVerificationId: null
  };
}

function isInterventionVerification(value: unknown) {
  return recordFromUnknown(value).mode === 'intervention_verification';
}

function generatedQuestionSourceLabel(value: unknown) {
  const record = recordFromUnknown(value);
  const sourceKind = cleanString(record.sourceKind ?? record.generationSource, 'syllabus');
  if (sourceKind === 'syllabus_and_past_paper_profile') return 'AI生成题 · 大纲+真题画像';
  if (sourceKind === 'syllabus_and_past_paper') return 'AI生成题 · 大纲+真题';
  if (sourceKind === 'past_paper') return 'AI生成题 · 真题参考';
  if (record.fallbackUsed === true || record.generator === 'rule-fallback') return 'AI生成题 · fallback测试';
  return 'AI生成题 · 大纲生成';
}

function isFallbackOrSmokeGeneratedQuestion(value: unknown) {
  const record = recordFromUnknown(value);
  const sourceKind = cleanString(record.sourceKind).toLowerCase();
  const generationSource = cleanString(record.generationSource).toLowerCase();
  const generationMode = cleanString(record.generationMode).toLowerCase();
  return (
    record.fallbackUsed === true ||
    record.generator === 'rule-fallback' ||
    record.status === 'generator_disabled' ||
    sourceKind.includes('smoke') ||
    generationSource.includes('smoke') ||
    generationMode.includes('smoke')
  );
}

function isOnlineMockExamApproval(value: unknown) {
  const review = recordFromUnknown(value);
  const approval = recordFromUnknown(review.mockExamApproval);
  return ['approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft'].includes(cleanString(approval.status));
}

function isOnlineMockExamGeneratedQuestion(generationMetadata: unknown, reviewMetadata?: unknown) {
  const metadata = recordFromUnknown(generationMetadata);
  const scope = recordFromUnknown(metadata.scope);
  const mockExamSlot = recordFromUnknown(metadata.mockExamSlot);
  const generationMode = cleanString(metadata.generationMode);
  return (
    scope.targetUseCase === 'online_mock_exam' ||
    metadata.targetUseCase === 'online_mock_exam' ||
    metadata.sourceKind === 'mock_exam_blueprint_slot' ||
    metadata.generationSource === 'mock_exam_blueprint_slot' ||
    generationMode === 'online_mock_exam_candidate' ||
    generationMode.startsWith('online_mock_candidate_') ||
    Boolean(mockExamSlot.slotId || mockExamSlot.blueprintId || mockExamSlot.sourcePaperId) ||
    isOnlineMockExamApproval(reviewMetadata)
  );
}

function isPublishedSubjectPracticeAiQuestion(reviewMetadata: unknown) {
  const review = recordFromUnknown(reviewMetadata);
  const approval = recordFromUnknown(review.subjectPracticeAutoApproval);
  return approval.status === 'published_to_subject_practice'
    && approval.targetUseCase === 'subject_practice'
    && approval.targetQuestionBank === 'special_practice_questions';
}

function isUsableQuestionVersion(generationMetadata: unknown) {
  const metadata = recordFromUnknown(generationMetadata);
  const governance = recordFromUnknown(metadata.versionGovernance);
  const status = cleanString(governance.status);
  return isStudentConsumableAiVersionStatus(status);
}

function generatedQuestionInfo(question: {
  id: number;
  sourceType?: string | null;
  sourceQuestionId?: number | null;
  blueprintId?: number | null;
  generationMetadata?: Prisma.JsonValue | unknown;
}) {
  if (question.sourceType !== 'ai') return null;
  const metadata = recordFromUnknown(question.generationMetadata);
  return {
    questionId: question.id,
    sourceQuestionId: question.sourceQuestionId ?? null,
    blueprintId: question.blueprintId ?? null,
    sourceKind: cleanString(metadata.sourceKind ?? metadata.generationSource, 'syllabus'),
    provider: cleanString(metadata.generator, '') || null,
    model: cleanString(metadata.model, '') || null,
    badgeLabel: generatedQuestionSourceLabel(question.generationMetadata)
  };
}

function publicQuestion(question: {
  id: number;
  orderNumber: number;
  difficulty: string;
  questionType: string;
  prompt: string;
  options: Prisma.JsonValue;
  correctAnswer?: string;
  explanation?: string;
  knowledgeTags?: Prisma.JsonValue;
  localizations?: Prisma.JsonValue | null;
  topic?: { title: string; localizations?: Prisma.JsonValue | null } | null;
  questionSource?: string;
  sourceType?: string | null;
  sourceQuestionId?: number | null;
  blueprintId?: number | null;
  generationMetadata?: Prisma.JsonValue | unknown;
}, topic: { id: number; code: string; title: string }, language = 'zh') {
  const localizedQuestion = localizedRecord<{
    difficulty?: unknown;
    prompt?: unknown;
    options?: unknown;
    explanation?: unknown;
    knowledgeTags?: unknown;
  }>(question.localizations, language);
  const localizedTopic = localizedRecord<{ title?: unknown }>(question.topic?.localizations, language);
  const localizedOptions = optionsFromJson(localizedQuestion?.options);
  const localizedTags = stringsFromJson(localizedQuestion?.knowledgeTags);
  const topicTitle = cleanString(localizedTopic?.title, question.topic?.title || topic.title);
  const difficulty = cleanString(localizedQuestion?.difficulty, question.difficulty);
  const prompt = cleanString(localizedQuestion?.prompt, question.prompt);
  const baseOptions = localizedOptions.length ? localizedOptions : optionsFromJson(question.options);
  return {
    id: question.id,
    orderNumber: question.orderNumber,
    difficulty: fallbackDifficulty(difficulty, language),
    questionType: question.questionType,
    prompt: fallbackPromptText(prompt, topicTitle, question.orderNumber, language),
    options: baseOptions.map((option) => ({ ...option, text: fallbackOptionText(option.text, option.id, language) })),
    topicId: topic.id,
    topicCode: topic.code,
    topicTitle,
    questionSource: question.questionSource || 'special_practice',
    generatedQuestion: generatedQuestionInfo(question),
    ...(question.explanation !== undefined ? { explanation: fallbackExplanationText(cleanString(localizedQuestion?.explanation, question.explanation), question.correctAnswer, topicTitle, language) } : {}),
    ...(question.knowledgeTags !== undefined ? { knowledgeTags: localizedTags.length ? localizedTags : tagsFromJson(question.knowledgeTags) } : {})
  };
}

@Injectable()
export class CscaAdaptiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: AdaptivePlannerService,
    private readonly questionProvider: AdaptiveQuestionProviderService,
    private readonly masteryEngine: MasteryEngineService,
    private readonly trainingEvents: TrainingEventService,
    private readonly cscaLearningService: CscaLearningService,
    private readonly questionQualityService: QuestionQualityService,
    private readonly plannerAssistant: PlannerAssistantService,
    private readonly learningFeatureFlags: LearningIntelligenceFeatureFlagsService,
    @Inject(LEARNING_EVIDENCE_WRITER) private readonly learningEvidenceWriter: LearningEvidenceWriter
  ) {}

  async getOverview(userId?: number) {
    const subjects: SpecialPracticeSubject[] = ['math', 'physics', 'chemistry'];
    const cards = [];
    for (const subject of subjects) {
      const topics = await this.prisma.cscaExamTopic.findMany({
        where: { subject, status: 'published' },
        orderBy: [{ weight: 'desc' }, { id: 'asc' }]
      });
      const questionCount = await this.visibleAdaptiveQuestionCount(subject);
      const masteryRows = userId ? await this.prisma.userCscaTopicMastery.findMany({ where: { userId, subject } }) : [];
      const averageMastery = masteryRows.length ? Math.round((masteryRows.reduce((sum, row) => sum + row.mastery, 0) / masteryRows.length) * 100) : null;
      const completedDiagnostic = userId ? await this.hasCompletedDiagnostic(userId, subject) : false;
      const activeSession = userId ? await this.prisma.cscaAdaptiveSession.findFirst({
        where: { userId, subject, status: 'active', mode: completedDiagnostic ? 'practice' : 'diagnostic' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      }) : null;
      cards.push({
        id: subject,
        title: subjectLabel(subject),
        topicCount: topics.length,
        questionCount,
        averageMastery,
        activeSessionId: activeSession?.id ?? null,
        questionLanguage: activeSession ? this.sessionQuestionLanguage(activeSession) : null,
        nextAction: completedDiagnostic ? 'continue_training' : 'start_diagnostic'
      });
    }
    return {
      subjects: cards,
      roundSize: ADAPTIVE_ROUND_SIZE,
      diagnosticRoundSize: ADAPTIVE_DIAGNOSTIC_ROUND_SIZE,
      requiresLogin: true
    };
  }

  private async visibleAdaptiveQuestionCount(subject: SpecialPracticeSubject) {
    const [row] = await this.prisma.$queryRaw<Array<{ questionCount: number }>>(Prisma.sql`
      WITH topic_rows AS (
        SELECT "id", "syllabus_version" AS "syllabusVersion"
        FROM "csca_exam_topics"
        WHERE "subject" = ${subject}
          AND "status" = 'published'
      ),
      special_visible AS (
        SELECT COUNT(DISTINCT mapping."source_id")::int AS "questionCount"
        FROM "csca_topic_mappings" mapping
        JOIN topic_rows topic ON topic."id" = mapping."topic_id"
        JOIN "special_practice_questions" spq ON spq."id" = mapping."source_id"
        WHERE mapping."source_type" = 'special_practice_question'
          AND spq."status" = 'published'
          AND (
            NOT EXISTS (
              SELECT 1
              FROM "csca_questions" ai
              WHERE ai."source_type" = 'ai'
                AND ai."source_question_id" = mapping."source_id"
            )
            OR EXISTS (
              SELECT 1
              FROM "csca_questions" ai
              WHERE ai."source_type" = 'ai'
                AND ai."source_question_id" = mapping."source_id"
                AND ai."status" = 'approved'
                AND ai."topic_id" = mapping."topic_id"
                AND ai."syllabus_version" = topic."syllabusVersion"
                AND ai."review_metadata"->'subjectPracticeAutoApproval'->>'status' = 'published_to_subject_practice'
                AND ai."review_metadata"->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
                AND ai."review_metadata"->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
                AND COALESCE(ai."generation_metadata"->'scope'->>'targetUseCase', '') <> 'online_mock_exam'
                AND COALESCE(ai."generation_metadata"->>'targetUseCase', '') <> 'online_mock_exam'
                AND COALESCE(ai."generation_metadata"->>'sourceKind', '') <> 'mock_exam_blueprint_slot'
                AND COALESCE(ai."generation_metadata"->>'generationSource', '') <> 'mock_exam_blueprint_slot'
                AND COALESCE(ai."generation_metadata"->>'generationMode', '') NOT LIKE 'online_mock%'
                AND ai."generation_metadata"->'mockExamSlot'->>'slotId' IS NULL
                AND COALESCE(ai."review_metadata"->'mockExamApproval'->>'status', '') NOT IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
                AND COALESCE(ai."generation_metadata"->>'fallbackUsed', '') <> 'true'
                AND COALESCE(ai."generation_metadata"->>'generator', '') <> 'rule-fallback'
                AND COALESCE(ai."generation_metadata"->>'status', '') <> 'generator_disabled'
                AND COALESCE(ai."generation_metadata"->>'sourceKind', '') NOT ILIKE '%smoke%'
                AND COALESCE(ai."generation_metadata"->>'generationSource', '') NOT ILIKE '%smoke%'
                AND COALESCE(ai."generation_metadata"->>'generationMode', '') NOT ILIKE '%smoke%'
                AND COALESCE(ai."generation_metadata"->'versionGovernance'->>'status', '') IN ('current', 'legacy_usable', 'manual_published')
            )
          )
      ),
      direct_visible AS (
        SELECT COUNT(DISTINCT q."id")::int AS "questionCount"
        FROM "csca_questions" q
        JOIN topic_rows topic ON topic."id" = q."topic_id"
        WHERE q."status" = 'approved'
          AND q."source_type" <> 'ai'
          AND q."source_question_id" IS NULL
          AND q."syllabus_version" = topic."syllabusVersion"
          AND COALESCE(q."generation_metadata"->'scope'->>'targetUseCase', '') <> 'online_mock_exam'
          AND COALESCE(q."generation_metadata"->>'targetUseCase', '') <> 'online_mock_exam'
          AND COALESCE(q."generation_metadata"->>'sourceKind', '') <> 'mock_exam_blueprint_slot'
          AND COALESCE(q."generation_metadata"->>'generationSource', '') <> 'mock_exam_blueprint_slot'
          AND COALESCE(q."generation_metadata"->>'generationMode', '') NOT LIKE 'online_mock%'
          AND q."generation_metadata"->'mockExamSlot'->>'slotId' IS NULL
          AND COALESCE(q."review_metadata"->'mockExamApproval'->>'status', '') NOT IN ('approved_for_mock_exam_assembly', 'assembled_in_mock_exam_draft')
      )
      SELECT (
        COALESCE((SELECT "questionCount" FROM special_visible), 0)
        + COALESCE((SELECT "questionCount" FROM direct_visible), 0)
      )::int AS "questionCount"
    `);
    return Number(row?.questionCount ?? 0);
  }

  async createSession(userId: number, input: Record<string, unknown> = {}) {
    const subject = assertAdaptiveSubject(input.subject);
    const hasDiagnostic = await this.hasCompletedDiagnostic(userId, subject);
    const requestedMode = cleanAdaptiveMode(input.mode);
    const mode = hasDiagnostic ? (requestedMode === 'diagnostic' ? 'practice' : requestedMode) : 'diagnostic';
    const questionLanguage = cleanAdaptiveQuestionLanguage(input.questionLanguage ?? input.language);
    const activeSession = await this.prisma.cscaAdaptiveSession.findFirst({
      where: { userId, subject, mode, status: 'active' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    if (activeSession && this.sessionQuestionLanguage(activeSession) === questionLanguage) return this.sessionSummary(activeSession);

    const session = await this.prisma.cscaAdaptiveSession.create({
      data: { userId, subject, mode, questionLanguage } as Prisma.CscaAdaptiveSessionUncheckedCreateInput
    });
    await this.trainingEvents.record({
      userId,
      subject,
      sessionId: session.id,
      eventType: mode === 'diagnostic' ? 'diagnostic_session_started' : 'practice_session_started',
      metadata: {
        requestedMode,
        hasCompletedDiagnostic: hasDiagnostic,
        questionLanguage,
        replacedActiveSessionId: activeSession?.id ?? null
      }
    });
    return this.sessionSummary(session);
  }

  async getSession(userId: number, idValue: string) {
    const id = parseId(idValue, '自适应训练 session 不存在。');
    const session = await this.prisma.cscaAdaptiveSession.findFirst({
      where: { id, userId },
      include: { rounds: { orderBy: [{ roundIndex: 'asc' }, { id: 'asc' }] } }
    });
    if (!session) throw new NotFoundException('自适应训练 session 不存在。');
    return {
      session: this.sessionSummary(session),
      rounds: session.rounds.map((round) => this.roundSummary(round))
    };
  }

  async createRound(userId: number, sessionIdValue: string, input: AdaptiveRoundCreatePayload = {}) {
    const sessionId = parseId(sessionIdValue, '自适应训练 session 不存在。');
    const session = await this.prisma.cscaAdaptiveSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('自适应训练 session 不存在。');
    if (session.status !== 'active') throw new BadRequestException('该训练 session 已结束。');

    const existingRound = await this.prisma.cscaAdaptiveRound.findFirst({
      where: { sessionId: session.id, submittedAt: null },
      orderBy: [{ roundIndex: 'desc' }, { id: 'desc' }]
    });
    if (existingRound) return this.getRound(userId, String(existingRound.id));

    const isDiagnostic = session.mode === 'diagnostic';
    const defaultRoundSize = isDiagnostic ? ADAPTIVE_DIAGNOSTIC_ROUND_SIZE : ADAPTIVE_ROUND_SIZE;
    const requestedRoundSize = Number(input.questionCount);
    const roundSize = Number.isInteger(requestedRoundSize) && requestedRoundSize > 0
      ? Math.min(requestedRoundSize, ADAPTIVE_DIAGNOSTIC_ROUND_SIZE)
      : defaultRoundSize;
    const verification = isDiagnostic ? undefined : this.cleanVerificationInput(input.verification);
    const focusTopicId = isDiagnostic ? undefined : this.cleanFocusTopicId(input.focusTopicId ?? verification?.topicId);
    if (!isDiagnostic && focusTopicId) {
      const focusTopic = await this.prisma.cscaExamTopic.findFirst({
        where: { id: focusTopicId, subject: session.subject, status: 'published' }
      });
      if (!focusTopic) throw new BadRequestException('该主题不属于当前自适应训练科目。');
    }

    const basePlan = isDiagnostic
      ? await this.planner.planDiagnosticRound(session.subject as SpecialPracticeSubject, roundSize)
      : verification
        ? await this.planner.planVerificationRound(userId, session.subject as SpecialPracticeSubject, roundSize, { ...verification, topicId: focusTopicId })
        : await this.planner.planRound(userId, session.subject as SpecialPracticeSubject, roundSize, focusTopicId);
    const plan = isDiagnostic
      ? basePlan
      : await this.plannerAssistant.assist({
        userId,
        subject: session.subject as SpecialPracticeSubject,
        basePlan,
        language: this.sessionQuestionLanguage(session)
      });
    const plannedQuestions = await this.questionProvider.pickQuestions(userId, plan.plannedTopics, roundSize);
    if (plannedQuestions.length < roundSize) {
      await this.recordAdaptiveInventoryShortageEvents({
        userId,
        subject: session.subject,
        plannedTopics: plan.plannedTopics,
        selectedQuestions: plannedQuestions,
        roundSize,
        sessionId: session.id,
        reason: 'adaptive_round_not_enough_questions'
      });
      throw new BadRequestException({
        code: ADAPTIVE_PRACTICE_POOL_EXHAUSTED,
        message: '这组练习你已经刷完啦。我们正在补充新的适配题，稍后再来会有更多题目。',
        shortage: {
          subject: session.subject,
          requested: roundSize,
          available: plannedQuestions.length,
          missing: Math.max(0, roundSize - plannedQuestions.length)
        }
      });
    }

    const roundCount = await this.prisma.cscaAdaptiveRound.count({ where: { sessionId: session.id } });
    const round = await this.prisma.cscaAdaptiveRound.create({
      data: {
        sessionId: session.id,
        roundIndex: roundCount + 1,
        plannerSnapshot: plan as unknown as Prisma.InputJsonValue,
        items: {
          create: plannedQuestions.map((question, index) => ({
            questionId: question.questionId,
            questionSource: question.questionSource,
            topicId: question.topicId,
            plannedDifficulty: question.targetDifficulty,
            position: index + 1
          }))
        }
      }
    });

    for (const question of plannedQuestions) {
      await this.prisma.cscaQuestionExposure.upsert({
        where: { userId_questionId_source: { userId, questionId: question.questionId, source: `${ADAPTIVE_EXPOSURE_SOURCE}:${question.questionSource}` } },
        create: { userId, questionId: question.questionId, source: `${ADAPTIVE_EXPOSURE_SOURCE}:${question.questionSource}` },
        update: { seenCount: { increment: 1 }, lastSeenAt: new Date() }
      });
    }

    await this.trainingEvents.record({
      userId,
      subject: session.subject,
      sessionId: session.id,
      roundId: round.id,
      eventType: isDiagnostic ? 'diagnostic_round_started' : 'practice_round_started',
      metadata: {
        roundIndex: round.roundIndex,
        roundSize,
        focusTopicId: focusTopicId ?? null,
        plannerStrategy: plan.strategy,
        roundMode: 'mode' in plan ? plan.mode : isDiagnostic ? 'diagnostic' : 'regular',
        verification: verification ?? null,
        plannerAssistant: 'plannerAssistant' in plan ? plan.plannerAssistant : null
      }
    });

    return this.getRound(userId, String(round.id));
  }

  async createInterventionVerificationRound(userId: number, input: InterventionVerificationRoundInput) {
    const subject = assertAdaptiveSubject(input.subject);
    const topic = await this.prisma.cscaExamTopic.findFirst({
      where: { id: input.topicId, subject, status: 'published' },
      select: { id: true, code: true, title: true }
    });
    if (!topic) throw new BadRequestException('干预验证知识点无效。');
    if (input.questions.length !== 3 || input.questions.some((item) => item.questionSource !== 'csca_question' || item.topicId !== topic.id)) {
      throw new BadRequestException({ code: 'INTERVENTION_VERIFICATION_SUPPLY_UNAVAILABLE', message: '独立验证题库存不足。' });
    }
    const ids = input.questions.map((item) => item.questionId);
    const trustedRows = await this.prisma.cscaQuestion.findMany({
      where: { id: { in: ids }, topicId: topic.id, status: 'approved', sourceType: { not: 'ai' }, sourceQuestionId: null, topic: { status: 'published' } },
      select: {
        id: true, version: true, questionType: true, knowledgeTags: true, generationMetadata: true, reviewMetadata: true,
        blueprint: { select: { skill: true } }, qualityMetric: { select: { needsReview: true } }
      }
    });
    const trustedMap = new Map(trustedRows.map((item) => [item.id, item]));
    if (input.questions.some((item) => trustedMap.get(item.questionId)?.version !== item.questionVersion || trustedMap.get(item.questionId)?.qualityMetric?.needsReview)) {
      throw new ConflictException({ code: 'INTERVENTION_VERIFICATION_SUPPLY_CHANGED', message: '验证题状态已变化，请重新获取方案。' });
    }
    const excludedTransferSignatures = new Set(input.excludedTransferSignatures ?? []);
    if (input.phase === 'transfer' && input.questions.some((item) => {
      const row = trustedMap.get(item.questionId);
      const signature = row ? trustedQuestionTransferSignature(row) : null;
      return !signature || excludedTransferSignatures.has(signature) || signature !== item.transferSignature;
    })) {
      throw new ConflictException({ code: 'INTERVENTION_TRANSFER_SIGNATURE_CHANGED', message: '迁移验证题的任务结构标签已变化，请重新获取方案。' });
    }
    const activeMock = await this.prisma.mockExamAttempt.findFirst({
      where: { userId, submittedAt: null, updatedAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } }, select: { id: true }
    });
    if (activeMock) throw new ConflictException({ code: 'FORMAL_MOCK_ACTIVE', message: '正式模考期间不会启动干预验证。' });

    const roundId = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADAPTIVE_ROUND_LOCK_NAMESPACE}::int, ${userId}::int)`;
      const [priorAdaptive, priorMeasurement, priorEvidence] = await Promise.all([
        tx.cscaQuestionExposure.count({ where: { userId, questionId: { in: ids } } }),
        tx.assessmentItemExposure.count({ where: { userId, itemType: 'csca_question', itemId: { in: ids.map(String) } } }),
        tx.learningEvidenceEvent.count({ where: { userId, questionId: { in: ids.map((id) => `csca_question:${id}`) } } })
      ]);
      if (priorAdaptive || priorMeasurement || priorEvidence) {
        throw new ConflictException({ code: 'INTERVENTION_VERIFICATION_EXPOSURE_CHANGED', message: '验证题已产生曝光，请重新获取方案。' });
      }
      const reservations = await tx.assessmentItemExposure.createMany({
        data: input.questions.map((item) => ({
          userId, itemType: 'csca_question', itemId: String(item.questionId), itemVersion: String(item.questionVersion),
          subjectCode: subject, exposureState: 'prompt_seen', metadata: { role: 'intervention_verification', verificationId: input.verificationId }
        })),
        skipDuplicates: true
      });
      if (reservations.count !== input.questions.length) {
        throw new ConflictException({ code: 'INTERVENTION_VERIFICATION_RESERVATION_CONFLICT', message: '验证题已被其他任务占用，请重新获取方案。' });
      }
      const session = await tx.cscaAdaptiveSession.create({
        data: { userId, subject, mode: 'practice', questionLanguage: cleanAdaptiveQuestionLanguage(input.questionLanguage) }
      });
      const round = await tx.cscaAdaptiveRound.create({
        data: {
          sessionId: session.id, roundIndex: 1,
          plannerSnapshot: {
            schemaVersion: '1', strategy: 'independent_intervention_verification', mode: 'intervention_verification', roundSize: input.questions.length,
            focus: { source: 'learning_intervention', verificationId: input.verificationId, phase: input.phase ?? 'immediate', topicId: topic.id, topicCode: topic.code, topicTitle: topic.title },
            measurement: {
              assistanceAllowed: false, answersVisibleBeforeSubmit: false,
              selectedQuestionVersions: input.questions.map((item) => item.questionVersion),
              transferSignatures: input.questions.map((item) => item.transferSignature)
            }
          },
          items: { create: input.questions.map((item, index) => ({
            questionId: item.questionId, questionSource: 'csca_question', topicId: topic.id,
            plannedDifficulty: item.questionDifficulty, position: index + 1
          })) }
        }
      });
      for (const item of input.questions) {
        await tx.cscaQuestionExposure.upsert({
          where: { userId_questionId_source: { userId, questionId: item.questionId, source: `${ADAPTIVE_EXPOSURE_SOURCE}:csca_question` } },
          create: { userId, questionId: item.questionId, source: `${ADAPTIVE_EXPOSURE_SOURCE}:csca_question` },
          update: { seenCount: { increment: 1 }, lastSeenAt: new Date() }
        });
      }
      return round.id;
    });
    await this.trainingEvents.record({
      userId, subject, roundId, eventType: 'intervention_verification_started',
      metadata: { verificationId: input.verificationId, phase: input.phase ?? 'immediate', topicId: topic.id, questionCount: input.questions.length, independent: true }
    });
    return this.getRound(userId, String(roundId));
  }

  private async recordAdaptiveInventoryShortageEvents(input: {
    userId: number;
    subject: string;
    plannedTopics: Array<{ topicId: number; targetDifficulty?: string | null; questionType?: string | null }>;
    selectedQuestions: Array<{ topicId: number; questionId: number; questionSource: string }>;
    roundSize: number;
    sessionId: number;
    reason: string;
  }) {
    const selectedByTopic = new Map<number, number>();
    for (const question of input.selectedQuestions) {
      selectedByTopic.set(question.topicId, (selectedByTopic.get(question.topicId) ?? 0) + 1);
    }
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId: input.userId, status: 'active' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { organizationId: true, cohortId: true }
    });
    const teamKey = member?.organizationId
      ? `organization:${member.organizationId}:cohort:${member.cohortId ?? 'all'}`
      : null;
    const records = input.plannedTopics.filter((topic) => (selectedByTopic.get(topic.topicId) ?? 0) === 0);
    if (!records.length) return;
    for (const topic of records) {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "csca_adaptive_inventory_events" (
          "user_id", "cohort_id", "organization_id", "organization_cohort_id", "team_key",
          "subject", "topic_id", "difficulty_band", "question_type", "event_type", "metadata"
        )
        VALUES (
          ${input.userId},
          NULL,
          ${member?.organizationId ?? null},
          ${member?.cohortId ?? null},
          ${teamKey},
          ${input.subject},
          ${topic.topicId},
          ${topic.targetDifficulty ?? 'medium'},
          ${topic.questionType ?? 'single-choice'},
          'no_question_available',
          ${JSON.stringify({
            source: 'adaptive_round_create',
            reason: input.reason,
            sessionId: input.sessionId,
            roundSize: input.roundSize,
            selectedCount: input.selectedQuestions.length
          })}::jsonb
        )
      `);
    }
  }

  async getRound(userId: number, idValue: string, languageValue?: string) {
    const id = parseId(idValue, '自适应训练轮次不存在。');
    const round = await this.findRound(userId, id);
    const language = adaptiveLanguage(this.sessionQuestionLanguage(round.session) || languageValue);
    const questionMap = await this.roundQuestionMap(round.items);
    const topicMap = await this.topicMap(round.items.map((item) => item.topicId));
    return {
      session: this.sessionSummary(round.session),
      round: this.roundSummary(round),
      questions: round.items.map((item) => {
        const question = questionMap.get(roundQuestionKey(item.questionSource, item.questionId));
        const topic = topicMap.get(item.topicId);
        if (!question || !topic) throw new NotFoundException('自适应训练题目不存在。');
        return {
          ...publicQuestion(question, topic, language),
          position: item.position,
          selectedAnswer: item.selectedAnswer,
          isCorrect: item.isCorrect,
          usedHint: item.usedHint,
          usedExplanation: item.usedExplanation,
          timeSpentSeconds: item.timeSpentSeconds
        };
      })
    };
  }

  async patchRound(userId: number, idValue: string, payload: AdaptiveRoundPatchPayload) {
    const id = parseId(idValue, '自适应训练轮次不存在。');
    const expectedVersion = expectedVersionFrom(payload);
    const round = await this.findRound(userId, id);
    if (round.submittedAt) throw new BadRequestException('本轮训练已提交，不能继续修改。');
    if (expectedVersion !== undefined && expectedVersion !== round.version) {
      throw new ConflictException({ message: '自适应训练轮次已被其他操作更新，请刷新后再继续。', code: 'VERSION_CONFLICT', currentVersion: round.version });
    }
    const answers = payload.answers !== undefined ? recordStringMap(payload.answers) : recordStringMap(round.answers);
    const timeSpent = payload.timeSpent !== undefined ? numberMap(payload.timeSpent) : numberMap(round.timeSpent);
    const currentQuestion = payload.currentQuestion !== undefined ? Math.max(1, Number(payload.currentQuestion) || 1) : round.currentQuestion;

    const updated = await this.prisma.cscaAdaptiveRound.update({
      where: { id: round.id },
      data: {
        answers: answers as Prisma.InputJsonValue,
        timeSpent: timeSpent as Prisma.InputJsonValue,
        currentQuestion,
        version: { increment: 1 }
      }
    });

    for (const item of round.items) {
      await this.prisma.cscaAdaptiveRoundItem.update({
        where: { id: item.id },
        data: {
          selectedAnswer: answers[String(item.questionId)] || null,
          timeSpentSeconds: timeSpent[String(item.questionId)] ?? 0
        }
      });
    }
    return this.roundSummary(updated);
  }

  async checkAnswer(userId: number, idValue: string, body: Record<string, unknown>) {
    const id = parseId(idValue, '自适应训练轮次不存在。');
    const round = await this.findRound(userId, id);
    if (isInterventionVerification(round.plannerSnapshot)) {
      throw new ConflictException({ code: 'INDEPENDENT_VERIFICATION_NO_LIVE_CHECK', message: '独立验证将在整组提交后统一判定。' });
    }
    const explanationLanguage = adaptiveLanguage(String(body.language ?? body.questionLanguage ?? 'zh'));
    const questionId = parseId(String(body.questionId ?? ''), '题目不存在。');
    const selected = String(body.selected ?? '').trim();
    if (!selected) throw new BadRequestException('请选择答案。');
    const item = round.items.find((next) => next.questionId === questionId);
    if (!item) throw new NotFoundException('题目不存在。');
    const questionMap = await this.roundQuestionMap([item]);
    const question = questionMap.get(roundQuestionKey(item.questionSource, item.questionId));
    if (!question) throw new NotFoundException('题目不存在。');
    const topic = await this.prisma.cscaExamTopic.findFirst({ where: { id: item.topicId } });
    if (!topic) throw new NotFoundException('题目不存在。');
    const localizedQuestion = publicQuestion(question, topic, explanationLanguage);
    const isCorrect = selected === question.correctAnswer;
    await this.prisma.cscaAdaptiveRoundItem.update({
      where: { id: item.id },
      data: { selectedAnswer: selected, isCorrect }
    });
    return {
      questionId,
      selected,
      correctAnswer: question.correctAnswer,
      isCorrect,
      explanation: localizedQuestion.explanation ?? '',
      knowledgeTags: localizedQuestion.knowledgeTags ?? []
    };
  }

  async submitRound(userId: number, idValue: string, languageValue?: string) {
    const id = parseId(idValue, '自适应训练轮次不存在。');
    const round = await this.findRound(userId, id);
    if (round.submittedAt) return this.getReport(userId, String(round.id), languageValue);

    const answers = recordStringMap(round.answers);
    const questionMap = await this.roundQuestionMap(round.items);
    const timeSpent = numberMap(round.timeSpent);
    const results = round.items.map((item) => {
      const question = questionMap.get(roundQuestionKey(item.questionSource, item.questionId));
      if (!question) throw new NotFoundException('题目不存在。');
      const selected = answers[String(item.questionId)] ?? '';
      const isUnanswered = !selected;
      const isCorrect = !isUnanswered && selected === question.correctAnswer;
      return { item, question, selected, isUnanswered, isCorrect };
    });
    const correctCount = results.filter((result) => result.isCorrect).length;
    const unansweredCount = results.filter((result) => result.isUnanswered).length;
    const wrongCount = results.length - correctCount - unansweredCount;
    const submittedAt = new Date();
    const verification = verificationFromPlannerSnapshot(round.plannerSnapshot);
    const evidenceSourceType = round.session.mode === 'diagnostic' ? 'diagnostic' : verification ? 'review' : 'adaptive';

    const evidenceWrites = await this.prisma.$transaction(async (tx) => {
      const writes: LearningEvidenceWriteResult[] = [];
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADAPTIVE_ROUND_LOCK_NAMESPACE}::int, ${round.id}::int)`;
      const latest = await tx.cscaAdaptiveRound.findFirst({ where: { id: round.id } });
      if (!latest) throw new NotFoundException('自适应训练轮次不存在。');
      if (latest.submittedAt) return writes;
      for (const result of results) {
        await tx.cscaAdaptiveRoundItem.update({
          where: { id: result.item.id },
          data: {
            selectedAnswer: result.selected || null,
            isCorrect: result.isUnanswered ? null : result.isCorrect,
            timeSpentSeconds: timeSpent[String(result.item.questionId)] ?? 0
          }
        });
        await tx.cscaQuestionExposure.upsert({
          where: { userId_questionId_source: { userId, questionId: result.item.questionId, source: `${ADAPTIVE_EXPOSURE_SOURCE}:${result.item.questionSource || 'special_practice'}` } },
          create: {
            userId,
            questionId: result.item.questionId,
            source: `${ADAPTIVE_EXPOSURE_SOURCE}:${result.item.questionSource || 'special_practice'}`,
            lastResult: result.isUnanswered ? 'unanswered' : result.isCorrect ? 'correct' : 'wrong'
          },
          update: {
            lastResult: result.isUnanswered ? 'unanswered' : result.isCorrect ? 'correct' : 'wrong',
            lastSeenAt: new Date()
          }
        });
        if (this.learningFeatureFlags.isEnabled('evidenceWrite')) {
          writes.push(await this.learningEvidenceWriter.appendInTransaction(tx, mapTrustedQuestionEvidence({
            sourceType: evidenceSourceType,
            sourceId: String(round.id),
            sessionId: String(round.sessionId),
            userId,
            subjectCode: round.session.subject as SpecialPracticeSubject,
            questionId: `${result.item.questionSource || 'special_practice'}:${result.item.questionId}`,
            questionVersion: result.question.version,
            answerKeyVersion: `${result.item.questionSource || 'special_practice'}:${result.item.questionId}:v${result.question.version}`,
            topicId: result.item.topicId,
            topicMappingVersion: `adaptive-round-item:${result.item.id}`,
            outcome: result.isUnanswered ? 'skipped' : result.isCorrect ? 'correct' : 'incorrect',
            usedHint: result.item.usedHint,
            usedExplanation: result.item.usedExplanation,
            timeSpentSeconds: timeSpent[String(result.item.questionId)] ?? 0,
            difficulty: result.question.difficulty,
            questionQualityConfidence: result.question.sourceType === 'ai' ? 0.7 : 0.95,
            occurredAt: submittedAt,
            metadata: {
              roundMode: isInterventionVerification(round.plannerSnapshot) ? 'intervention_verification' : round.session.mode,
              questionSource: result.item.questionSource || 'special_practice',
              postIntervention: isInterventionVerification(round.plannerSnapshot),
              interventionVerificationId: verification?.interventionVerificationId ?? null
            }
          })));
        }
      }
      await tx.cscaAdaptiveRound.update({
        where: { id: round.id },
        data: {
          status: 'submitted',
          correctCount,
          wrongCount,
          unansweredCount,
          submittedAt,
          version: { increment: 1 }
        }
      });
      await tx.cscaAdaptiveSession.update({
        where: { id: round.sessionId },
        data: {
          status: 'completed',
          completedAt: submittedAt
        }
      });
      return writes;
    });

    await this.masteryEngine.updateFromRound(results.map((result) => ({
      userId,
      subject: round.session.subject as SpecialPracticeSubject,
      topicId: result.item.topicId,
      isCorrect: result.isCorrect,
      difficulty: result.question.difficulty,
      usedHint: result.item.usedHint,
      usedExplanation: result.item.usedExplanation
    })));

    await this.trainingEvents.record({
      userId,
      subject: round.session.subject,
      sessionId: round.sessionId,
      roundId: round.id,
      eventType: round.session.mode === 'diagnostic' ? 'diagnostic_round_completed' : 'practice_round_completed',
      metadata: {
        roundIndex: round.roundIndex,
        total: results.length,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy: results.length ? Number((correctCount / results.length).toFixed(4)) : 0,
        items: results.map((result) => ({
          questionId: result.item.questionId,
          questionSource: result.item.questionSource || 'special_practice',
          topicId: result.item.topicId,
          plannedDifficulty: result.item.plannedDifficulty,
          isCorrect: result.isCorrect,
          isUnanswered: result.isUnanswered,
          usedHint: result.item.usedHint,
          usedExplanation: result.item.usedExplanation
        }))
      }
    });

    await this.cscaLearningService.recordLearningActivity({
      userId,
      subject: round.session.subject,
      source: round.session.mode === 'diagnostic' ? 'adaptive_diagnostic' : 'adaptive_practice',
      answeredCount: correctCount + wrongCount,
      correctCount,
      wrongCount,
      unansweredCount,
      practiceSeconds: Object.values(timeSpent).reduce((sum, value) => sum + value, 0)
    });
    await this.cscaLearningService.recordWrongPatterns({
      userId,
      subject: round.session.subject,
      source: round.session.mode === 'diagnostic' ? 'adaptive_diagnostic' : 'adaptive_practice',
      items: results
        .filter((result) => result.isUnanswered || !result.isCorrect)
        .map((result) => ({
          questionId: result.item.questionId,
          questionSource: result.item.questionSource || 'special_practice',
          topicId: result.item.topicId,
          selectedAnswer: result.selected || null,
          correctAnswer: result.question.correctAnswer,
          isUnanswered: result.isUnanswered,
          knowledgeTags: tagsFromJson(result.question.knowledgeTags),
          secondsSpent: timeSpent[String(result.item.questionId)] ?? 0
        }))
    });
    await this.cscaLearningService.recordWrongPatternCorrectEvidence({
      userId,
      subject: round.session.subject,
      items: results
        .filter((result) => result.isCorrect)
        .map((result) => ({
          questionId: result.item.questionId,
          questionSource: result.item.questionSource || 'special_practice',
          topicId: result.item.topicId,
          knowledgeTags: tagsFromJson(result.question.knowledgeTags),
          secondsSpent: timeSpent[String(result.item.questionId)] ?? 0
        }))
    });

    await this.questionQualityService.refreshForSpecialPracticeQuestionIds(results
      .filter((result) => (result.item.questionSource || 'special_practice') === 'special_practice')
      .map((result) => result.item.questionId));
    await this.questionQualityService.refreshForCscaQuestionIds(results
      .filter((result) => result.item.questionSource === 'csca_question')
      .map((result) => result.item.questionId));

    if (verification?.patternId) {
      const targetResults = verification.topicId
        ? results.filter((result) => result.item.topicId === verification.topicId)
        : results;
      const targetCorrectCount = targetResults.filter((result) => result.isCorrect).length;
      const targetTotal = targetResults.length;
      const passed = targetTotal > 0 && targetCorrectCount / targetTotal >= 0.8;
      await this.cscaLearningService.recordWrongPatternVerification({
        userId,
        subject: round.session.subject,
        patternId: verification.patternId,
        roundId: round.id,
        topicId: verification.topicId,
        patternType: verification.patternType,
        passed,
        targetCorrectCount,
        targetTotal,
        overallCorrectCount: correctCount,
        overallTotal: results.length
      });
    }

    const report = await this.getReport(userId, String(round.id), languageValue);
    const learningEvidence = learningEvidenceReceipt(evidenceWrites);
    return learningEvidence ? { ...report, learningEvidence } : report;
  }

  async getReport(userId: number, idValue: string, languageValue?: string) {
    const id = parseId(idValue, '自适应训练轮次不存在。');
    const round = await this.findRound(userId, id);
    const sessionLanguage = this.sessionQuestionLanguage(round.session);
    const questionLanguage = cleanAdaptiveQuestionLanguage(sessionLanguage || languageValue);
    const explanationLanguage = adaptiveLanguage(languageValue || sessionLanguage || questionLanguage);
    const questionMap = await this.roundQuestionMap(round.items);
    const topicMap = await this.topicMap(round.items.map((item) => item.topicId));
    const masteryRows = await this.prisma.userCscaTopicMastery.findMany({
      where: { userId, topicId: { in: round.items.map((item) => item.topicId) } }
    });
    const masteryMap = new Map(masteryRows.map((row) => [row.topicId, row]));
    const items = round.items.map((item) => {
      const question = questionMap.get(roundQuestionKey(item.questionSource, item.questionId));
      const topic = topicMap.get(item.topicId);
      if (!question || !topic) throw new NotFoundException('题目不存在。');
      const isUnanswered = !item.selectedAnswer;
      const localizedQuestion = publicQuestion(question, topic, questionLanguage);
      const localizedExplanation = publicQuestion(question, topic, explanationLanguage);
      return {
        ...localizedQuestion,
        explanation: localizedExplanation.explanation ?? localizedQuestion.explanation,
        knowledgeTags: localizedExplanation.knowledgeTags ?? localizedQuestion.knowledgeTags,
        position: item.position,
        selectedAnswer: item.selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: item.isCorrect,
        isUnanswered,
        timeSpentSeconds: item.timeSpentSeconds,
        mastery: masteryMap.get(item.topicId)?.mastery ?? null
      };
    });
    const weakTopics = items
      .filter((item) => item.isUnanswered || item.isCorrect === false)
      .map((item) => ({ topicId: item.topicId, code: item.topicCode, title: item.topicTitle }));
    const remediationPlan = await this.remediationPlan(userId, round.session.subject as SpecialPracticeSubject, round.items.map((item, index) => ({
      questionId: item.questionId,
      questionSource: item.questionSource || 'special_practice',
      topicId: item.topicId,
      isWrong: items[index]?.isUnanswered || items[index]?.isCorrect === false,
      knowledgeTags: items[index]?.knowledgeTags ?? []
    })), round.id);
    return {
      session: this.sessionSummary(round.session),
      round: this.roundSummary(round),
      summary: {
        correctCount: round.correctCount,
        wrongCount: round.wrongCount,
        unansweredCount: round.unansweredCount,
        total: items.length,
        accuracy: items.length ? Math.round((round.correctCount / items.length) * 100) : 0,
        totalSeconds: items.reduce((sum, item) => sum + item.timeSpentSeconds, 0)
      },
      weakTopics,
      diagnosticCoverage: round.session.mode === 'diagnostic'
        ? await this.diagnosticCoverage(userId, round.session.subject as SpecialPracticeSubject, items)
        : null,
      nextRecommendation: weakTopics.length ? 'continue_weak_topics' : 'try_challenge_round',
      remediationPlan,
      trend: await this.reportTrend(userId, round.session.subject as SpecialPracticeSubject, round.id),
      items
    };
  }

  async completeConceptCard(userId: number, roundIdValue: string, cardIdValue: string) {
    const roundId = parseId(roundIdValue, '自适应训练轮次不存在。');
    const cardId = parseId(cardIdValue, '概念卡不存在。');
    const round = await this.findRound(userId, roundId);
    if (!round.submittedAt) throw new BadRequestException('请先提交本轮训练，再完成概念卡。');
    const questionMap = await this.roundQuestionMap(round.items);
    const topicMap = await this.topicMap(round.items.map((item) => item.topicId));
    const plan = await this.remediationPlan(userId, round.session.subject as SpecialPracticeSubject, round.items.map((item) => {
      const question = questionMap.get(roundQuestionKey(item.questionSource, item.questionId));
      const topic = topicMap.get(item.topicId);
      if (!question || !topic) return null;
      const isWrong = item.isCorrect === false || item.isCorrect === null;
      const localized = publicQuestion(question, topic);
      return {
        questionId: item.questionId,
        questionSource: item.questionSource || 'special_practice',
        topicId: item.topicId,
        isWrong,
        knowledgeTags: localized.knowledgeTags ?? []
      };
    }).filter((item): item is {
      questionId: number;
      questionSource: string;
      topicId: number;
      isWrong: boolean;
      knowledgeTags: string[];
    } => Boolean(item)), round.id);
    const card = plan.conceptCards.find((item) => item.id === cardId);
    if (!card) throw new BadRequestException('该概念卡不属于当前训练轮的补救安排。');
    const cardRecord = await this.prisma.cscaConceptCard.findFirst({
      where: { id: card.id },
      select: { exampleJson: true }
    });
    const cardExample = recordFromUnknown(cardRecord?.exampleJson);
    const sourceQuestionId = Number(cardExample.sourceQuestionId);
    await this.trainingEvents.record({
      userId,
      subject: round.session.subject,
      sessionId: round.sessionId,
      roundId: round.id,
      eventType: 'concept_card_completed',
      source: 'adaptive',
      metadata: {
        conceptCardId: card.id,
        topicId: card.topicId,
        title: card.title,
        sourceQuestionId: Number.isInteger(sourceQuestionId) && sourceQuestionId > 0 ? sourceQuestionId : null,
        misconceptionLabel: card.misconceptionLabel,
        remediationNextAction: plan.nextAction
      }
    });
    return {
      status: 'completed',
      conceptCardId: card.id,
      roundId: round.id,
      completedAt: new Date().toISOString()
    };
  }

  private async remediationPlan(userId: number, subject: SpecialPracticeSubject, roundItems: Array<{
    questionId: number;
    questionSource: string;
    topicId: number;
    isWrong: boolean;
    knowledgeTags: string[];
  }>, roundId?: number) {
    const emptyPlan = {
      triggered: false,
      trigger: null,
      conceptCards: [],
      variantPractice: { availableCount: 0, questionIds: [] as number[] },
      nextAction: 'continue_training'
    };
    const wrongItems = roundItems.filter((item) => item.isWrong);
    if (!wrongItems.length) return emptyPlan;
    const prismaRecord = this.prisma as unknown as Record<string, { findMany?: unknown } | undefined>;
    if (typeof prismaRecord.cscaWrongPattern?.findMany !== 'function'
      || typeof prismaRecord.cscaQuestionMisconception?.findMany !== 'function'
      || typeof prismaRecord.cscaConceptCard?.findMany !== 'function'
      || typeof prismaRecord.cscaQuestion?.findMany !== 'function') return emptyPlan;
    const wrongTopicIds = Array.from(new Set(wrongItems.map((item) => item.topicId)));
    const tagCounts = new Map<string, number>();
    for (const item of wrongItems) {
      for (const tag of item.knowledgeTags.map((next) => String(next).trim()).filter(Boolean)) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const repeatedTags = Array.from(tagCounts.entries()).filter(([, count]) => count >= 2).map(([tag]) => tag);
    const patterns = await this.prisma.cscaWrongPattern.findMany({
      where: {
        userId,
        subject,
        status: { in: ['active', 'pending_verification'] },
        topicId: { in: wrongTopicIds }
      },
      orderBy: [{ recurrenceCount: 'desc' }, { updatedAt: 'desc' }],
      take: 10
    });
    const repeatedPatterns = patterns.filter((pattern) => pattern.recurrenceCount >= 2);
    const triggerTags = Array.from(new Set([
      ...repeatedTags,
      ...repeatedPatterns.map((pattern) => pattern.patternType)
    ].filter(Boolean)));
    const triggered = triggerTags.length > 0 || repeatedPatterns.length > 0;
    const misconceptions = triggered ? await this.prisma.cscaQuestionMisconception.findMany({
      where: {
        subject,
        status: 'active',
        topicId: { in: wrongTopicIds },
        OR: triggerTags.length ? [
          { label: { in: triggerTags } },
          { slug: { in: triggerTags.map((tag) => tag.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '')) } }
        ] : undefined
      },
      select: { id: true, topicId: true, label: true, slug: true }
    }) : [];
    const conceptCards = misconceptions.length ? await this.prisma.cscaConceptCard.findMany({
      where: {
        status: 'published',
        topicId: { in: wrongTopicIds },
        misconceptionId: { in: misconceptions.map((item) => item.id) }
      },
      include: { misconception: { select: { label: true, slug: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 3
    }) : [];
    const completedConceptCards = new Map<number, string>();
    if (conceptCards.length && roundId && typeof prismaRecord.cscaTrainingEvent?.findMany === 'function') {
      const events = await this.prisma.cscaTrainingEvent.findMany({
        where: { userId, roundId, eventType: 'concept_card_completed' },
        select: { metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      });
      for (const event of events) {
        const metadata = recordFromUnknown(event.metadata);
        const conceptCardId = Number(metadata.conceptCardId);
        if (Number.isInteger(conceptCardId) && conceptCardId > 0 && !completedConceptCards.has(conceptCardId)) {
          completedConceptCards.set(conceptCardId, event.createdAt.toISOString());
        }
      }
    }
    const cscaQuestionIds = await this.cscaQuestionIdsForRoundItems(wrongItems);
    const variantQuestions = cscaQuestionIds.length ? await this.prisma.cscaQuestion.findMany({
      where: {
        generatedVariantOf: { in: cscaQuestionIds },
        status: 'approved',
        topic: { status: 'published' }
      },
      select: { id: true, topicId: true, designedDifficulty: true, syllabusVersion: true, topic: { select: { syllabusVersion: true } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 5
    }) : [];
    const currentVariantQuestions = variantQuestions.filter((question) => question.syllabusVersion === question.topic.syllabusVersion);
    return {
      triggered,
      trigger: triggered ? {
        repeatedTags,
        repeatedPatterns: repeatedPatterns.map((pattern) => ({
          id: pattern.id,
          topicId: pattern.topicId,
          patternType: pattern.patternType,
          recurrenceCount: pattern.recurrenceCount,
          status: pattern.status
        }))
      } : null,
      conceptCards: conceptCards.map((card) => ({
        id: card.id,
        topicId: card.topicId,
        title: card.title,
        body: card.body,
        misconceptionLabel: card.misconception?.label ?? null,
        completedAt: completedConceptCards.get(card.id) ?? null
      })),
      variantPractice: {
        availableCount: currentVariantQuestions.length,
        questionIds: currentVariantQuestions.map((question) => question.id),
        topicIds: Array.from(new Set(currentVariantQuestions.map((question) => question.topicId)))
      },
      nextAction: conceptCards.length
        ? 'review_concept_card'
        : currentVariantQuestions.length
          ? 'start_variant_practice'
          : triggered
            ? 'continue_targeted_training'
            : 'continue_training'
    };
  }

  private async cscaQuestionIdsForRoundItems(items: Array<{ questionId: number; questionSource: string }>) {
    const directIds = items
      .filter((item) => item.questionSource === 'csca_question')
      .map((item) => item.questionId);
    const specialIds = items
      .filter((item) => item.questionSource !== 'csca_question')
      .map((item) => item.questionId);
    if (!specialIds.length) return Array.from(new Set(directIds));
    const aiRows = await this.prisma.cscaQuestion.findMany({
      where: { sourceType: 'ai', sourceQuestionId: { in: specialIds } },
      select: {
        id: true,
        subject: true,
        status: true,
        designedDifficulty: true,
        prompt: true,
        options: true,
        explanation: true,
        generationMetadata: true,
        reviewMetadata: true
      }
    });
    const formalAiIds = aiRows
      .filter((row) => row.status === 'approved'
        && isPublishedSubjectPracticeAiQuestion(row.reviewMetadata)
        && !isOnlineMockExamGeneratedQuestion(row.generationMetadata, row.reviewMetadata)
        && !isFallbackOrSmokeGeneratedQuestion(row.generationMetadata)
        && isUsableQuestionVersion(row.generationMetadata)
        && subjectPracticeCurrentPolicyBlockReasons(row).length === 0)
      .map((row) => row.id);
    return Array.from(new Set([...directIds, ...formalAiIds]));
  }

  async getMastery(userId: number, query: Record<string, string | undefined> = {}) {
    const subject = query.subject ? assertAdaptiveSubject(query.subject) : undefined;
    const topics = await this.prisma.cscaExamTopic.findMany({
      where: { status: 'published', ...(subject ? { subject } : {}) },
      orderBy: [{ subject: 'asc' }, { weight: 'desc' }, { id: 'asc' }]
    });
    const rows = await this.prisma.userCscaTopicMastery.findMany({
      where: { userId, topicId: { in: topics.map((topic) => topic.id) } }
    });
    const map = new Map(rows.map((row) => [row.topicId, row]));
    return {
      items: topics.map((topic) => {
        const mastery = map.get(topic.id);
        return {
          topicId: topic.id,
          subject: topic.subject,
          code: topic.code,
          title: topic.title,
          module: topic.module,
          mastery: mastery?.mastery ?? 0.5,
          confidence: mastery?.confidence ?? 0.2,
          attemptCount: mastery?.attemptCount ?? 0,
          correctCount: mastery?.correctCount ?? 0,
          lastPracticedAt: mastery?.lastPracticedAt?.toISOString() ?? null
        };
      })
    };
  }

  private async findRound(userId: number, id: number) {
    const round = await this.prisma.cscaAdaptiveRound.findFirst({
      where: { id, session: { userId } },
      include: {
        session: true,
        items: { orderBy: [{ position: 'asc' }, { id: 'asc' }] }
      }
    });
    if (!round) throw new NotFoundException('自适应训练轮次不存在。');
    return round;
  }

  private async roundQuestionMap(items: Array<{ questionId: number; questionSource?: string | null }>) {
    const specialIds = Array.from(new Set(items
      .filter((item) => (item.questionSource || 'special_practice') === 'special_practice')
      .map((item) => item.questionId)));
    const cscaQuestionIds = Array.from(new Set(items
      .filter((item) => item.questionSource === 'csca_question')
      .map((item) => item.questionId)));
    const [specialQuestions, cscaQuestions, specialSourceQuestions] = await Promise.all([
      specialIds.length ? this.prisma.specialPracticeQuestion.findMany({
        where: { id: { in: specialIds } },
        include: { topic: { select: { title: true, localizations: true } } },
        orderBy: [{ id: 'asc' }]
      }) : [],
      cscaQuestionIds.length ? this.prisma.cscaQuestion.findMany({
        where: {
          id: { in: cscaQuestionIds },
          status: 'approved',
          OR: [
            { sourceType: { not: 'ai' }, sourceQuestionId: null },
            { sourceType: 'ai', sourceQuestionId: { not: null } }
          ]
        },
        include: { topic: { select: { title: true } } },
        orderBy: [{ id: 'asc' }]
      }) : [],
      specialIds.length ? this.prisma.cscaQuestion.findMany({
        where: { sourceType: 'ai', sourceQuestionId: { in: specialIds } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
      }) : []
    ]);
    const aiSourceByPublishedId = new Map<number, typeof specialSourceQuestions[number]>();
    for (const question of specialSourceQuestions) {
      if (question.status !== 'approved') continue;
      if (!isPublishedSubjectPracticeAiQuestion(question.reviewMetadata)) continue;
      if (isOnlineMockExamGeneratedQuestion(question.generationMetadata, question.reviewMetadata)) continue;
      if (isFallbackOrSmokeGeneratedQuestion(question.generationMetadata)) continue;
      if (!isUsableQuestionVersion(question.generationMetadata)) continue;
      if (subjectPracticeCurrentPolicyBlockReasons(question).length > 0) continue;
      if (question.sourceQuestionId && !aiSourceByPublishedId.has(question.sourceQuestionId)) {
        aiSourceByPublishedId.set(question.sourceQuestionId, question);
      }
    }
    const map = new Map<string, {
      id: number;
      version: number;
      orderNumber: number;
      difficulty: string;
      questionType: string;
      prompt: string;
      options: Prisma.JsonValue;
      correctAnswer?: string;
      explanation?: string;
      knowledgeTags?: Prisma.JsonValue;
      localizations?: Prisma.JsonValue | null;
      topic?: { title: string; localizations?: Prisma.JsonValue | null } | null;
      questionSource?: string;
      sourceType?: string | null;
      sourceQuestionId?: number | null;
      blueprintId?: number | null;
      generationMetadata?: Prisma.JsonValue | null;
    }>();
    for (const question of specialQuestions) {
      const sourceQuestion = aiSourceByPublishedId.get(question.id);
      map.set(roundQuestionKey('special_practice', question.id), {
        ...question,
        questionSource: 'special_practice',
        sourceType: sourceQuestion?.sourceType ?? null,
        sourceQuestionId: sourceQuestion?.sourceQuestionId ?? null,
        blueprintId: sourceQuestion?.blueprintId ?? null,
        generationMetadata: sourceQuestion?.generationMetadata ?? null
      });
    }
    for (const question of cscaQuestions) {
      if (question.sourceType === 'ai' && (
        isOnlineMockExamGeneratedQuestion(question.generationMetadata, question.reviewMetadata)
        || isFallbackOrSmokeGeneratedQuestion(question.generationMetadata)
        || !isUsableQuestionVersion(question.generationMetadata)
        || subjectPracticeCurrentPolicyBlockReasons(question).length > 0
      )) {
        continue;
      }
      const generationMetadata = recordFrom(question.generationMetadata);
      const questionLocalizations = recordFrom(generationMetadata.localizations) as Prisma.JsonValue;
      map.set(roundQuestionKey('csca_question', question.id), {
        id: question.id,
        version: question.version,
        orderNumber: question.id,
        difficulty: question.empiricalDifficulty && (question.difficultyConfidence ?? 0) >= 0.35 ? question.empiricalDifficulty : question.designedDifficulty,
        questionType: question.questionType,
        prompt: question.prompt,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        knowledgeTags: question.knowledgeTags,
        localizations: questionLocalizations,
        topic: question.topic ? { title: question.topic.title } : null,
        questionSource: 'csca_question',
        sourceType: question.sourceType,
        sourceQuestionId: question.sourceQuestionId,
        blueprintId: question.blueprintId,
        generationMetadata: question.generationMetadata
      });
    }
    return map;
  }

  private async topicMap(topicIds: number[]) {
    const topics = await this.prisma.cscaExamTopic.findMany({ where: { id: { in: topicIds } } });
    return new Map(topics.map((topic) => [topic.id, topic]));
  }

  private async diagnosticCoverage(userId: number, subject: SpecialPracticeSubject, roundItems: Array<{
    topicId: number;
    topicCode: string;
    topicTitle: string;
    isCorrect: boolean | null;
    isUnanswered: boolean;
  }>) {
    const topics = await this.prisma.cscaExamTopic.findMany({
      where: { subject, status: 'published' },
      orderBy: [{ weight: 'desc' }, { id: 'asc' }]
    });
    if (!topics.length) {
      return {
        subject,
        coveredCount: 0,
        totalCount: 0,
        coverageRate: 0,
        confidenceReadyCount: 0,
        lowConfidenceCount: 0,
        coveredDimensions: [],
        insufficientDimensions: []
      };
    }

    const masteryRows = await this.prisma.userCscaTopicMastery.findMany({
      where: { userId, topicId: { in: topics.map((topic) => topic.id) } }
    });
    const masteryMap = new Map(masteryRows.map((row) => [row.topicId, row]));
    const roundTopicMap = new Map<number, { attemptCount: number; correctCount: number; code: string; title: string }>();
    for (const item of roundItems) {
      const existing = roundTopicMap.get(item.topicId) ?? {
        attemptCount: 0,
        correctCount: 0,
        code: item.topicCode,
        title: item.topicTitle
      };
      existing.attemptCount += 1;
      existing.correctCount += item.isCorrect ? 1 : 0;
      roundTopicMap.set(item.topicId, existing);
    }

    const dimensions = topics.map((topic) => {
      const mastery = masteryMap.get(topic.id);
      const roundTopic = roundTopicMap.get(topic.id);
      const confidence = mastery?.confidence ?? 0.2;
      return {
        topicId: topic.id,
        code: roundTopic?.code ?? topic.code,
        title: roundTopic?.title ?? topic.title,
        attemptCount: roundTopic?.attemptCount ?? 0,
        correctCount: roundTopic?.correctCount ?? 0,
        mastery: mastery?.mastery ?? 0.5,
        confidence,
        isCovered: Boolean(roundTopic)
      };
    });
    const coveredDimensions = dimensions.filter((dimension) => dimension.isCovered);
    const insufficientDimensions = dimensions
      .filter((dimension) => !dimension.isCovered || dimension.confidence < DIAGNOSTIC_CONFIDENCE_READY_THRESHOLD)
      .map((dimension) => ({
        topicId: dimension.topicId,
        code: dimension.code,
        title: dimension.title,
        reason: dimension.isCovered ? 'low_confidence' : 'not_covered',
        mastery: dimension.mastery,
        confidence: dimension.confidence
      }));
    const coveredCount = coveredDimensions.length;
    const confidenceReadyCount = dimensions.filter((dimension) => dimension.confidence >= DIAGNOSTIC_CONFIDENCE_READY_THRESHOLD).length;

    return {
      subject,
      coveredCount,
      totalCount: topics.length,
      coverageRate: Math.round((coveredCount / topics.length) * 100),
      confidenceReadyCount,
      lowConfidenceCount: topics.length - confidenceReadyCount,
      coveredDimensions: coveredDimensions.map((dimension) => ({
        topicId: dimension.topicId,
        code: dimension.code,
        title: dimension.title,
        attemptCount: dimension.attemptCount,
        correctCount: dimension.correctCount,
        mastery: dimension.mastery,
        confidence: dimension.confidence
      })),
      insufficientDimensions
    };
  }

  private async hasCompletedDiagnostic(userId: number, subject: SpecialPracticeSubject) {
    const session = await this.prisma.cscaAdaptiveSession.findFirst({
      where: { userId, subject, mode: 'diagnostic', status: 'completed', completedAt: { not: null } },
      select: { id: true }
    });
    return Boolean(session);
  }

  private async reportTrend(userId: number, subject: SpecialPracticeSubject, currentRoundId: number) {
    const recentRounds = await this.prisma.cscaAdaptiveRound.findMany({
      where: {
        submittedAt: { not: null },
        session: { userId, subject }
      },
      include: {
        session: { select: { mode: true } },
        items: { select: { topicId: true, plannedDifficulty: true, isCorrect: true, timeSpentSeconds: true } }
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: 5
    });
    const chronological = [...recentRounds].reverse();
    const summaries = chronological.map((round) => {
      const total = round.items.length || round.correctCount + round.wrongCount + round.unansweredCount;
      const totalSeconds = round.items.reduce((sum, item) => sum + item.timeSpentSeconds, 0);
      const averageDifficulty = round.items.length
        ? Number((round.items.reduce((sum, item) => sum + difficultyRank(item.plannedDifficulty), 0) / round.items.length).toFixed(2))
        : null;
      return {
        roundId: round.id,
        roundIndex: round.roundIndex,
        mode: round.session.mode,
        accuracy: total ? Math.round((round.correctCount / total) * 100) : 0,
        correctCount: round.correctCount,
        wrongCount: round.wrongCount,
        unansweredCount: round.unansweredCount,
        total,
        totalSeconds,
        averageSeconds: total ? Math.round(totalSeconds / total) : 0,
        averageDifficulty,
        difficultyLabel: difficultyLabel(averageDifficulty),
        submittedAt: round.submittedAt?.toISOString() ?? null
      };
    });
    const currentIndex = summaries.findIndex((round) => round.roundId === currentRoundId);
    const current = currentIndex >= 0 ? summaries[currentIndex] : summaries.at(-1);
    const previous = currentIndex > 0 ? summaries[currentIndex - 1] : undefined;
    const accuracies = summaries.map((round) => round.accuracy);
    const averageAccuracy = accuracies.length ? Math.round(accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length) : null;
    const totalQuestionCount = summaries.reduce((sum, round) => sum + round.total, 0);
    const averageSeconds = totalQuestionCount
      ? Math.round(summaries.reduce((sum, round) => sum + round.totalSeconds, 0) / totalQuestionCount)
      : null;
    const weakTopicCounts = new Map<number, number>();
    for (const round of chronological) {
      for (const item of round.items) {
        if (item.isCorrect === false || item.isCorrect === null) {
          weakTopicCounts.set(item.topicId, (weakTopicCounts.get(item.topicId) ?? 0) + 1);
        }
      }
    }
    const topicIds = [...weakTopicCounts.keys()];
    const topics = topicIds.length ? await this.prisma.cscaExamTopic.findMany({ where: { id: { in: topicIds } } }) : [];
    const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
    const repeatedWeakTopics = [...weakTopicCounts.entries()]
      .map(([topicId, count]) => {
        const topic = topicMap.get(topicId);
        return topic ? { topicId, code: topic.code, title: topic.title, count } : null;
      })
      .filter((item): item is { topicId: number; code: string; title: string; count: number } => Boolean(item))
      .sort((a, b) => b.count - a.count || a.topicId - b.topicId)
      .slice(0, 3);
    const accuracyDelta = current && previous ? current.accuracy - previous.accuracy : null;
    const difficultyDelta = current?.averageDifficulty !== null && current?.averageDifficulty !== undefined && previous?.averageDifficulty !== null && previous?.averageDifficulty !== undefined
      ? Number((current.averageDifficulty - previous.averageDifficulty).toFixed(2))
      : null;
    const direction = accuracyDelta === null
      ? 'insufficient'
      : accuracyDelta >= 15
        ? 'improving'
        : accuracyDelta <= -15
          ? 'declining'
          : 'steady';
    return {
      sampleSize: summaries.length,
      recentRounds: summaries,
      averageAccuracy,
      averageSeconds,
      previousAccuracy: previous?.accuracy ?? null,
      accuracyDelta,
      direction,
      currentDifficulty: current?.averageDifficulty ?? null,
      currentDifficultyLabel: current?.difficultyLabel ?? null,
      previousDifficulty: previous?.averageDifficulty ?? null,
      difficultyDelta,
      difficultyDirection: difficultyDirection(difficultyDelta),
      repeatedWeakTopics
    };
  }

  private cleanFocusTopicId(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('自适应训练主题参数不正确。');
    return id;
  }

  private cleanVerificationInput(value: unknown): AdaptiveVerificationRequest | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    const reviewItemId = record.reviewItemId === undefined || record.reviewItemId === null || record.reviewItemId === ''
      ? undefined
      : Number(record.reviewItemId);
    const topicId = record.topicId === undefined || record.topicId === null || record.topicId === ''
      ? undefined
      : Number(record.topicId);
    if (reviewItemId !== undefined && (!Number.isInteger(reviewItemId) || reviewItemId <= 0)) throw new BadRequestException('错题复盘参数不正确。');
    if (topicId !== undefined && (!Number.isInteger(topicId) || topicId <= 0)) throw new BadRequestException('错题验证主题参数不正确。');
    const patternType = String(record.patternType ?? '').trim().slice(0, 80) || undefined;
    if (reviewItemId === undefined && topicId === undefined && !patternType) return undefined;
    return { reviewItemId, topicId, patternType };
  }

  private sessionQuestionLanguage(session: unknown) {
    return cleanAdaptiveQuestionLanguage((session as { questionLanguage?: unknown })?.questionLanguage);
  }

  private sessionSummary(session: { id: number; userId: number; subject: string; mode: string; status: string; startedAt: Date; completedAt: Date | null; createdAt: Date; updatedAt: Date; questionLanguage?: string | null }) {
    return {
      id: session.id,
      userId: session.userId,
      subject: session.subject,
      mode: session.mode,
      status: session.status,
      questionLanguage: this.sessionQuestionLanguage(session),
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }

  private roundSummary(round: { id: number; sessionId: number; roundIndex: number; status: string; plannerSnapshot: Prisma.JsonValue | null; answers: Prisma.JsonValue; timeSpent: Prisma.JsonValue; currentQuestion: number; correctCount: number; wrongCount: number; unansweredCount: number; startedAt: Date; submittedAt: Date | null; version: number }) {
    return {
      id: round.id,
      sessionId: round.sessionId,
      roundIndex: round.roundIndex,
      status: round.status,
      plannerSnapshot: round.plannerSnapshot,
      answers: round.answers,
      timeSpent: round.timeSpent,
      currentQuestion: round.currentQuestion,
      correctCount: round.correctCount,
      wrongCount: round.wrongCount,
      unansweredCount: round.unansweredCount,
      startedAt: round.startedAt.toISOString(),
      submittedAt: round.submittedAt?.toISOString() ?? null,
      version: round.version
    };
  }
}
