import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CscaExamTopic, CscaQuestion, Prisma, SpecialPracticeQuestion, SpecialPracticeSession, SpecialPracticeTopic } from '@prisma/client';
import { recordAdminAudit } from '../admin-audit/admin-audit-log';
import {
  subjectPracticeCurrentPolicyBlockReasons
} from '../ai-questioning/subject-practice-task-family-policy';
import { isStudentConsumableAiVersionStatus } from '../ai-questioning/question-version-governance';
import { assertPositiveInteger, assertRecord } from '../common/validation';
import { mapTrustedQuestionEvidence } from '../learning-intelligence/evidence/learning-evidence-mapper';
import { LearningIntelligenceFeatureFlagsService } from '../learning-intelligence/learning-intelligence-feature-flags.service';
import { LEARNING_EVIDENCE_WRITER, LearningEvidenceWriter, LearningEvidenceWriteResult, learningEvidenceReceipt } from '../learning-intelligence/learning-evidence-writer.port';
import { PrismaService } from '../prisma/prisma.service';
import { SpecialPracticeOption, SpecialPracticeSessionPatchPayload, SpecialPracticeSubject } from './csca-special-practice.types';

const SUBJECTS: Array<{ id: SpecialPracticeSubject; title: string; description: string; tags: string[] }> = [
  { id: 'math', title: '数学', description: '集合、函数、几何与概率统计的知识点训练。', tags: ['集合与不等式', '函数', '几何与代数', '概率与统计'] },
  { id: 'physics', title: '物理', description: '力学、电磁学、热学光学和近代物理专项练习。', tags: ['力学', '电磁学', '热学', '光学'] },
  { id: 'chemistry', title: '化学', description: '物质结构、反应原理、溶液和有机化学训练。', tags: ['物质结构', '反应原理', '溶液', '有机化学'] }
];
const SPECIAL_SESSION_LOCK_NAMESPACE = 2_147_001_102;

const FALLBACK_TOPICS = SUBJECTS.flatMap((subject, subjectIndex) => subject.tags.map((tag, tagIndex) => ({
  id: subjectIndex * 10 + tagIndex + 1,
  subject: subject.id,
  module: tag,
  slug: `${subject.id}-fallback-${tagIndex + 1}`,
  title: tag,
  description: `${subject.title}${tag}原创专项练习，用于本地 fallback 预览。`,
  overview: null,
  focusItems: null,
  studyAdvice: null,
  difficultyLabel: null,
  frequencyLabel: null,
  relatedResources: null,
  relatedVisualizerSlug: null,
  localizations: null,
  estimatedMinutes: 20,
  questionCount: 10,
  publishedQuestionCount: 10,
  sessionCount: 0
})));

const OPTION_IDS = ['A', 'B', 'C', 'D'];
const QUESTION_TYPES = ['single-choice'];
const STATUSES = ['draft', 'published', 'archived'];
const PRACTICE_LANGUAGES = ['zh', 'en'];
const MOCK_EXAM_RULE = { durationMinutes: 60, questionCount: 48, totalScore: 100, questionTypeLabel: '单项选择' };
const HOME_MINI_MOCK_PER_SUBJECT = 4;
const HOME_MINI_MOCK_TOTAL = HOME_MINI_MOCK_PER_SUBJECT * SUBJECTS.length;

type DbTopic = SpecialPracticeTopic;
type DbQuestion = SpecialPracticeQuestion;
type DbQualifiedQuestionWithTopic = CscaQuestion & { topic: CscaExamTopic };
type DbSession = SpecialPracticeSession;
type AdminImportQuestion = Partial<DbQuestion> & { options?: SpecialPracticeOption[]; knowledgeTags?: string[] };
type AdminImportTopic = Partial<DbTopic> & { questions?: AdminImportQuestion[] };
type RelatedResource = { label: string; path: string };
type PracticeAvailabilityStatus = 'available' | 'replenishing' | 'exhausted' | 'unavailable';
type PracticeAvailability = {
  status: PracticeAvailabilityStatus;
  isAvailable: boolean;
  requiredQuestionCount: number;
  publishedQuestionCount: number;
  message: string;
  code: string;
};
type TopicSummarySource = DbTopic & {
  _count?: { questions: number; sessions: number };
  availabilityOverride?: PracticeAvailabilityStatus;
};
type TopicLocalization = {
  module?: string;
  title?: string;
  description?: string;
  overview?: string;
  focusItems?: string[];
  studyAdvice?: string;
  difficultyLabel?: string;
  frequencyLabel?: string;
  relatedResources?: RelatedResource[];
};
type QuestionLocalization = {
  difficulty?: string;
  prompt?: string;
  options?: SpecialPracticeOption[];
  explanation?: string;
  knowledgeTags?: string[];
};
type SnapshotQuestion = {
  id: number;
  version: number;
  orderNumber: number;
  difficulty: string;
  questionType: string;
  prompt: string;
  options: SpecialPracticeOption[];
  correctAnswer: string;
  explanation: string;
  knowledgeTags: string[];
  status: string;
};

function studentSessionsEnabled() {
  return process.env.CSCALITE_SPECIAL_PRACTICE_STUDENT_SESSIONS_ENABLED !== 'false';
}

function topicAvailability(topic: Pick<DbTopic, 'questionCount'> & { _count?: { questions: number } }, override?: PracticeAvailabilityStatus): PracticeAvailability {
  const requiredQuestionCount = Math.max(0, Number(topic.questionCount) || 0);
  const publishedQuestionCount = Math.max(0, Number(topic._count?.questions) || 0);
  const status: PracticeAvailabilityStatus = override
    ?? (!studentSessionsEnabled()
      ? 'unavailable'
      : publishedQuestionCount >= requiredQuestionCount && requiredQuestionCount > 0
        ? 'available'
        : publishedQuestionCount > 0
          ? 'replenishing'
          : 'exhausted');
  const messages: Record<PracticeAvailabilityStatus, string> = {
    available: '这个专项已经可以练习。',
    replenishing: '这个专项题库正在补齐，暂时不开放给学生练习。',
    exhausted: '这个专项暂无可用题目，题库补齐后再开放。',
    unavailable: '专项练习正在上线隔离中，暂时不开放给学生练习。'
  };
  const codes: Record<PracticeAvailabilityStatus, string> = {
    available: 'SPECIAL_PRACTICE_AVAILABLE',
    replenishing: 'SPECIAL_PRACTICE_POOL_REPLENISHING',
    exhausted: 'SPECIAL_PRACTICE_POOL_EXHAUSTED',
    unavailable: 'SPECIAL_PRACTICE_UNAVAILABLE'
  };
  return {
    status,
    isAvailable: status === 'available',
    requiredQuestionCount,
    publishedQuestionCount,
    message: messages[status],
    code: codes[status]
  };
}

function assertSubject(subject: string): SpecialPracticeSubject {
  if (!SUBJECTS.some((item) => item.id === subject)) throw new NotFoundException('专项练习科目不存在。');
  return subject as SpecialPracticeSubject;
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
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

function cleanString(value: unknown, fallback = '') {
  const text = typeof value === 'string' ? value : value === null || value === undefined ? fallback : String(value);
  return text.trim();
}

function cleanPositive(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function cleanStatus(value: unknown, fallback = 'draft') {
  const status = cleanString(value, fallback);
  return STATUSES.includes(status) ? status : fallback;
}

function cleanPracticeLanguage(value: unknown, fallback = 'zh') {
  const language = cleanString(value, fallback).toLowerCase();
  if (['zh', 'cn', 'chinese'].includes(language)) return 'zh';
  if (['en', 'gb', 'english'].includes(language)) return 'en';
  return fallback;
}

function optionsFromJson(value: Prisma.JsonValue | unknown): SpecialPracticeOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const option = item as Record<string, unknown>;
      return { id: String(option.id ?? '').trim(), text: String(option.text ?? '').trim() };
    })
    .filter((item): item is SpecialPracticeOption => Boolean(item?.id && item.text));
}

function tagsFromJson(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function stringsFromJson(value: Prisma.JsonValue | unknown): string[] {
  return Array.isArray(value) ? value.map((item) => cleanString(item)).filter(Boolean) : [];
}

function resourcesFromJson(value: Prisma.JsonValue | unknown): RelatedResource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const resource = item as Record<string, unknown>;
      const label = cleanString(resource.label);
      const path = cleanString(resource.path);
      return label && path ? { label, path } : null;
    })
    .filter((item): item is RelatedResource => Boolean(item));
}

function jsonObjectOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Prisma.InputJsonValue : Prisma.JsonNull;
}

function localizedRecord<T extends Record<string, unknown>>(value: Prisma.JsonValue | unknown, language = 'zh'): T | null {
  if (language === 'zh' || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const localized = record[language];
  return localized && typeof localized === 'object' && !Array.isArray(localized) ? localized as T : null;
}

function topicLocalization(topic: DbTopic, language = 'zh') {
  return localizedRecord<TopicLocalization>((topic as DbTopic & { localizations?: Prisma.JsonValue | null }).localizations, language);
}

function questionLocalization(question: DbQuestion | SnapshotQuestion, language = 'zh') {
  return localizedRecord<QuestionLocalization>((question as (DbQuestion | SnapshotQuestion) & { localizations?: Prisma.JsonValue | null }).localizations, language);
}

function questionSnapshot(question: DbQuestion, language = 'zh'): SnapshotQuestion {
  const localized = questionLocalization(question, language);
  const localizedOptions = optionsFromJson(localized?.options);
  const localizedTags = stringsFromJson(localized?.knowledgeTags);
  return {
    id: question.id,
    version: question.version,
    orderNumber: question.orderNumber,
    difficulty: cleanString(localized?.difficulty, question.difficulty),
    questionType: question.questionType,
    prompt: cleanString(localized?.prompt, question.prompt),
    options: localizedOptions.length ? localizedOptions : optionsFromJson(question.options),
    correctAnswer: question.correctAnswer,
    explanation: cleanString(localized?.explanation, question.explanation),
    knowledgeTags: localizedTags.length ? localizedTags : tagsFromJson(question.knowledgeTags),
    status: question.status
  };
}

function questionsFromSnapshot(value: unknown): SnapshotQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const id = Number(record.id);
      const orderNumber = Number(record.orderNumber);
      if (!Number.isInteger(id) || !Number.isInteger(orderNumber)) return null;
      return {
        id,
        version: Number.isInteger(Number(record.version)) && Number(record.version) > 0 ? Number(record.version) : 1,
        orderNumber,
        difficulty: cleanString(record.difficulty, '基础'),
        questionType: cleanString(record.questionType, 'single-choice'),
        prompt: cleanString(record.prompt),
        options: optionsFromJson(record.options),
        correctAnswer: cleanString(record.correctAnswer),
        explanation: cleanString(record.explanation),
        knowledgeTags: tagsFromJson(record.knowledgeTags),
        status: cleanStatus(record.status, 'published')
      };
    })
    .filter((item): item is SnapshotQuestion => Boolean(item));
}

function topicSummary(topic: TopicSummarySource, language = 'zh') {
  const localized = topicLocalization(topic, language);
  const localizedFocusItems = stringsFromJson(localized?.focusItems);
  const localizedResources = resourcesFromJson(localized?.relatedResources);
  const availability = topicAvailability(topic, topic.availabilityOverride);
  return {
    id: topic.id,
    subject: topic.subject as SpecialPracticeSubject,
    module: cleanString(localized?.module, topic.module),
    slug: topic.slug,
    title: cleanString(localized?.title, topic.title),
    description: cleanString(localized?.description, topic.description),
    estimatedMinutes: topic.estimatedMinutes,
    questionCount: topic.questionCount,
    publishedQuestionCount: availability.publishedQuestionCount,
    sessionCount: topic._count?.sessions ?? 0,
    availability,
    overview: cleanString(localized?.overview, topic.overview ?? '') || undefined,
    focusItems: localizedFocusItems.length ? localizedFocusItems : stringsFromJson(topic.focusItems),
    studyAdvice: cleanString(localized?.studyAdvice, topic.studyAdvice ?? '') || undefined,
    difficultyLabel: cleanString(localized?.difficultyLabel, topic.difficultyLabel ?? '') || undefined,
    frequencyLabel: cleanString(localized?.frequencyLabel, topic.frequencyLabel ?? '') || undefined,
    relatedResources: localizedResources.length ? localizedResources : resourcesFromJson(topic.relatedResources),
    relatedVisualizerSlug: topic.relatedVisualizerSlug ?? undefined
  };
}

function adminTopicSummary(topic: TopicSummarySource) {
  return {
    ...topicSummary(topic),
    sortOrder: topic.sortOrder,
    status: topic.status,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    questionTotal: topic._count?.questions ?? 0,
    sessionTotal: topic._count?.sessions ?? 0,
    version: topic.version
  };
}

function adminQuestionSummary(question: DbQuestion) {
  return {
    id: question.id,
    topicId: question.topicId,
    orderNumber: question.orderNumber,
    difficulty: question.difficulty,
    questionType: question.questionType,
    prompt: question.prompt,
    options: optionsFromJson(question.options),
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    knowledgeTags: tagsFromJson(question.knowledgeTags),
    localizations: (question as DbQuestion & { localizations?: Prisma.JsonValue | null }).localizations ?? undefined,
    status: question.status,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
    version: question.version
  };
}

function publicQuestion(question: DbQuestion | SnapshotQuestion) {
  return {
    id: question.id,
    orderNumber: question.orderNumber,
    difficulty: question.difficulty,
    questionType: question.questionType,
    prompt: question.prompt,
    options: Array.isArray(question.options) ? question.options : optionsFromJson(question.options)
  };
}

function seededRank(seed: string, id: number) {
  let hash = 2166136261;
  const input = `${seed}:${id}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function homeMiniMockQuestion(question: DbQualifiedQuestionWithTopic, orderNumber: number) {
  const subject = assertSubject(question.subject);
  const subjectMeta = SUBJECTS.find((item) => item.id === subject);
  return {
    id: question.id,
    orderNumber,
    difficulty: cleanString(question.empiricalDifficulty, question.designedDifficulty) || '基础',
    questionType: question.questionType,
    prompt: question.prompt,
    options: optionsFromJson(question.options),
    subject,
    subjectTitle: subjectMeta?.title ?? subject,
    topic: {
      id: question.topic.id,
      slug: question.topic.code,
      title: question.topic.title,
      module: cleanString(question.topic.module, question.topic.title)
    },
    knowledgeTags: tagsFromJson(question.knowledgeTags)
  };
}

function parseMiniMockQuestionIds(value: unknown) {
  if (!Array.isArray(value)) throw new BadRequestException('请提交本轮 12 道题的题号。');
  const ids = value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) throw new BadRequestException('请提交本轮 12 道题的题号。');
  if (uniqueIds.length > HOME_MINI_MOCK_TOTAL) throw new BadRequestException(`首页小测最多提交 ${HOME_MINI_MOCK_TOTAL} 道题。`);
  return uniqueIds;
}

function recordStringMap(value: unknown) {
  const record = assertRecord(value ?? {}, '专项练习答案格式不正确。');
  return Object.fromEntries(Object.entries(record).map(([key, next]) => [String(key), String(next ?? '')]).filter(([, next]) => next));
}

function numberMap(value: unknown) {
  const record = assertRecord(value ?? {}, '专项练习耗时格式不正确。');
  return Object.fromEntries(Object.entries(record).map(([key, next]) => [String(key), Math.max(0, Number(next) || 0)]));
}

function expectedVersionFrom(input: unknown) {
  if (!input || typeof input !== 'object' || !('expectedVersion' in input)) return undefined;
  const value = Number((input as { expectedVersion?: unknown }).expectedVersion);
  if (!Number.isInteger(value) || value < 1) throw new BadRequestException('版本号不正确，请刷新后再试。');
  return value;
}

function assertVersion(currentVersion: number, expectedVersion: number | undefined, label: string) {
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    throw new ConflictException({ message: `${label} 已被其他管理员更新，请刷新后再继续。`, code: 'VERSION_CONFLICT', currentVersion });
  }
}

function versionConflict(label: string, currentVersion: number) {
  return new ConflictException({ message: `${label} 已被其他管理员更新，请刷新后再继续。`, code: 'VERSION_CONFLICT', currentVersion });
}

function sessionSummary(session: DbSession, topic: DbTopic) {
  return {
    id: session.id,
    topic: topicSummary(topic, session.language),
    language: session.language,
    availableLanguages: PRACTICE_LANGUAGES,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    answers: session.answers,
    timeSpent: session.timeSpent,
    currentQuestion: session.currentQuestion,
    correctCount: session.correctCount,
    wrongCount: session.wrongCount,
    unansweredCount: session.unansweredCount,
    version: session.version
  };
}

function topicHistorySummary(topic: DbTopic) {
  return {
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    subject: topic.subject as SpecialPracticeSubject,
    module: topic.module
  };
}

function sessionHistorySummary(session: DbSession & { topic: DbTopic }) {
  const total = Math.max(0, session.correctCount + session.wrongCount + session.unansweredCount);
  return {
    id: session.id,
    topic: topicHistorySummary(session.topic),
    subject: session.topic.subject as SpecialPracticeSubject,
    module: session.topic.module,
    accuracy: total ? Math.round((session.correctCount / total) * 100) : 0,
    correctCount: session.correctCount,
    wrongCount: session.wrongCount,
    unansweredCount: session.unansweredCount,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    reportPath: session.completedAt ? `/csca-special-practice/sessions/${session.id}/report` : `/csca-special-practice/sessions/${session.id}`
  };
}

function groupTopics(topics: Array<ReturnType<typeof topicSummary>>) {
  const map = new Map<string, Array<ReturnType<typeof topicSummary>>>();
  topics.forEach((topic) => {
    const items = map.get(topic.module) ?? [];
    items.push(topic);
    map.set(topic.module, items);
  });
  return Array.from(map.entries()).map(([module, items]) => ({ module, topics: items }));
}

function fallbackSubject(subject: SpecialPracticeSubject) {
  const subjectMeta = SUBJECTS.find((item) => item.id === subject)!;
  const topics = FALLBACK_TOPICS.filter((topic) => topic.subject === subject);
  const summaries = topics.map((topic) => topicSummary({
    ...topic,
    status: 'published',
    sortOrder: topic.id,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    localizations: null,
    availabilityOverride: 'unavailable',
    _count: { questions: 0, sessions: 0 }
  }));
  return {
    subject: subjectMeta,
    stats: {
      topicCount: summaries.length,
      availableTopicCount: 0,
      questionCount: 0,
      estimatedMinutes: summaries.reduce((sum, topic) => sum + topic.estimatedMinutes, 0),
      availability: topicAvailability({ questionCount: topics.reduce((sum, topic) => sum + topic.questionCount, 0), _count: { questions: 0 } }, 'unavailable')
    },
    mockExamRule: MOCK_EXAM_RULE,
    modules: groupTopics(summaries)
  };
}

function validateQuestionPayload(rawQuestion: AdminImportQuestion, index = 0, errors: string[] = []) {
  const prefix = `第 ${index + 1} 题`;
  const orderNumber = cleanPositive(rawQuestion.orderNumber, index + 1);
  const difficulty = cleanString(rawQuestion.difficulty, '基础') || '基础';
  const questionType = cleanString(rawQuestion.questionType, 'single-choice') || 'single-choice';
  if (!QUESTION_TYPES.includes(questionType)) errors.push(`${prefix} 题型目前只支持 single-choice。`);
  const prompt = cleanString(rawQuestion.prompt);
  if (!prompt) errors.push(`${prefix} 题干不能为空。`);
  const options = optionsFromJson(rawQuestion.options);
  if (options.length !== 4 || OPTION_IDS.some((id) => !options.some((option) => option.id === id && option.text.trim()))) {
    errors.push(`${prefix} 必须包含 A-D 四个非空选项。`);
  }
  const correctAnswer = cleanString(rawQuestion.correctAnswer);
  if (!OPTION_IDS.includes(correctAnswer)) errors.push(`${prefix} 正确答案必须是 A-D。`);
  const explanation = cleanString(rawQuestion.explanation);
  if (!explanation) errors.push(`${prefix} 解析不能为空。`);
  const knowledgeTags = tagsFromJson(rawQuestion.knowledgeTags);
  if (!knowledgeTags.length) errors.push(`${prefix} 知识点标签不能为空。`);
  return {
    orderNumber,
    difficulty,
    questionType,
    prompt,
    options: OPTION_IDS.map((id) => options.find((option) => option.id === id) ?? { id, text: '' }),
    correctAnswer,
    explanation,
    knowledgeTags,
    localizations: jsonObjectOrNull((rawQuestion as AdminImportQuestion & { localizations?: unknown }).localizations),
    status: cleanStatus(rawQuestion.status, 'draft')
  };
}

function validatePublishable(questionCount: number, questions: Array<{ orderNumber: number; status: string }>, errors: string[], label = '专项') {
  const published = questions.filter((question) => question.status === 'published');
  if (published.length !== questionCount) errors.push(`${label} 发布需要 ${questionCount} 道 published 题，当前 ${published.length} 道。`);
  const orders = new Set<number>();
  for (const question of published) {
    if (orders.has(question.orderNumber)) errors.push(`${label} 题号 ${question.orderNumber} 重复。`);
    orders.add(question.orderNumber);
  }
  for (let order = 1; order <= questionCount; order += 1) {
    if (!orders.has(order)) errors.push(`${label} 缺少 published 第 ${order} 题。`);
  }
}

function validateTopicPayload(rawTopic: AdminImportTopic, index = 0) {
  const errors: string[] = [];
  const subject = cleanString(rawTopic.subject);
  if (!SUBJECTS.some((item) => item.id === subject)) errors.push(`第 ${index + 1} 个 topic subject 必须是 math / physics / chemistry。`);
  const module = cleanString(rawTopic.module);
  if (!module) errors.push(`第 ${index + 1} 个 topic module 不能为空。`);
  const slug = cleanString(rawTopic.slug);
  if (!/^[a-z0-9-]{3,140}$/.test(slug)) errors.push(`第 ${index + 1} 个 topic slug 只能使用小写字母、数字和短横线。`);
  const title = cleanString(rawTopic.title);
  if (!title) errors.push(`第 ${index + 1} 个 topic title 不能为空。`);
  const description = cleanString(rawTopic.description);
  if (!description) errors.push(`第 ${index + 1} 个 topic description 不能为空。`);
  const questionCount = cleanPositive(rawTopic.questionCount, 10);
  const status = cleanStatus(rawTopic.status, 'draft');
  const overview = cleanString(rawTopic.overview);
  const focusItems = stringsFromJson(rawTopic.focusItems);
  const studyAdvice = cleanString(rawTopic.studyAdvice);
  const difficultyLabel = cleanString(rawTopic.difficultyLabel);
  const frequencyLabel = cleanString(rawTopic.frequencyLabel);
  const relatedResources = resourcesFromJson(rawTopic.relatedResources);
  const relatedVisualizerSlug = cleanString(rawTopic.relatedVisualizerSlug);
  const questions = Array.isArray(rawTopic.questions) ? rawTopic.questions : [];
  const normalizedQuestions = questions.map((question, questionIndex) => validateQuestionPayload(question, questionIndex, errors));
  if (status === 'published') validatePublishable(questionCount, normalizedQuestions, errors, `第 ${index + 1} 个 topic`);
  return {
    topic: {
      subject,
      module,
      slug,
      title,
      description,
      overview: overview || null,
      focusItems: focusItems.length ? focusItems : Prisma.JsonNull,
      studyAdvice: studyAdvice || null,
      difficultyLabel: difficultyLabel || null,
      frequencyLabel: frequencyLabel || null,
      relatedResources: relatedResources.length ? relatedResources : Prisma.JsonNull,
      relatedVisualizerSlug: relatedVisualizerSlug || null,
      localizations: jsonObjectOrNull((rawTopic as AdminImportTopic & { localizations?: unknown }).localizations),
      estimatedMinutes: cleanPositive(rawTopic.estimatedMinutes, 20),
      questionCount,
      sortOrder: Number.isInteger(Number(rawTopic.sortOrder)) ? Number(rawTopic.sortOrder) : 0,
      status
    },
    questions: normalizedQuestions,
    errors
  };
}

@Injectable()
export class CscaSpecialPracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningFeatureFlags: LearningIntelligenceFeatureFlagsService,
    @Inject(LEARNING_EVIDENCE_WRITER) private readonly learningEvidenceWriter: LearningEvidenceWriter
  ) {}

  async getOverview() {
    let topics: TopicSummarySource[];
    let databaseAvailable = true;
    try {
      topics = await this.prisma.specialPracticeTopic.findMany({
        where: { status: 'published' },
        include: { _count: { select: { questions: { where: { status: 'published' } }, sessions: true } } },
        orderBy: [{ subject: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
      });
    } catch {
      databaseAvailable = false;
      topics = FALLBACK_TOPICS.map((topic) => ({
        ...topic,
        status: 'published',
        sortOrder: topic.id,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        localizations: null,
        availabilityOverride: 'unavailable',
        _count: { questions: 0, sessions: 0 }
      }));
    }
    if (databaseAvailable) {
      try {
        const visibleQuestionCounts = await this.visiblePracticeQuestionCountsForTopics(topics.map((topic) => topic.id));
        topics = topics.map((topic) => ({
          ...topic,
          _count: {
            questions: visibleQuestionCounts.get(topic.id) ?? topic._count?.questions ?? 0,
            sessions: topic._count?.sessions ?? 0
          }
        }));
      } catch {
        topics = topics.map((topic) => ({
          ...topic,
          availabilityOverride: 'unavailable',
          _count: { questions: 0, sessions: topic._count?.sessions ?? 0 }
        }));
      }
    }
    const cards = SUBJECTS.map((subject) => {
      const subjectTopics = topics.filter((topic) => topic.subject === subject.id);
      const availableTopics = subjectTopics.filter((topic) => topicAvailability(topic, topic.availabilityOverride).isAvailable);
      const questionCount = subjectTopics.reduce((sum, topic) => sum + (topic._count?.questions ?? 0), 0);
      return {
        ...subject,
        topicCount: subjectTopics.length,
        availableTopicCount: availableTopics.length,
        questionCount,
        availability: topicAvailability({ questionCount: subjectTopics.reduce((sum, topic) => sum + topic.questionCount, 0), _count: { questions: questionCount } }),
        freeTopicSlug: availableTopics[0]?.slug ?? null
      };
    });
    return {
      subjects: cards,
      totals: {
        subjectCount: SUBJECTS.length,
        topicCount: topics.length,
        questionCount: topics.reduce((sum, topic) => sum + (topic._count?.questions ?? 0), 0)
      },
      features: ['中文原创专项练习', '即时判分与解析', '按知识点保存进度'],
      mockExamPath: '/csca-mock-exam',
      mockExamRule: MOCK_EXAM_RULE
    };
  }

  async getHomeMiniMock(query: Record<string, string | undefined> = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const seed = cleanString(query.seed, today).slice(0, 80) || today;
    const selectedBySubject = new Map<SpecialPracticeSubject, DbQualifiedQuestionWithTopic[]>();

    for (const subject of SUBJECTS) {
      const candidates = await this.prisma.cscaQuestion.findMany({
        where: {
          subject: subject.id,
          status: 'approved',
          topic: { status: 'published' }
        },
        include: { topic: true },
        orderBy: [{ topicId: 'asc' }, { id: 'asc' }]
      });
      const picked = [...candidates]
        .sort((left, right) => seededRank(`${seed}:${subject.id}`, left.id) - seededRank(`${seed}:${subject.id}`, right.id))
        .slice(0, HOME_MINI_MOCK_PER_SUBJECT);
      selectedBySubject.set(subject.id, picked);
    }

    const questions: DbQualifiedQuestionWithTopic[] = [];
    for (let index = 0; index < HOME_MINI_MOCK_PER_SUBJECT; index += 1) {
      for (const subject of SUBJECTS) {
        const question = selectedBySubject.get(subject.id)?.[index];
        if (question) questions.push(question);
      }
    }

    return {
      seed,
      targetQuestionCount: HOME_MINI_MOCK_TOTAL,
      questionCount: questions.length,
      perSubjectTarget: HOME_MINI_MOCK_PER_SUBJECT,
      subjects: SUBJECTS.map((subject) => ({
        id: subject.id,
        title: subject.title,
        target: HOME_MINI_MOCK_PER_SUBJECT,
        questionCount: selectedBySubject.get(subject.id)?.length ?? 0
      })),
      questions: questions.map((question, index) => homeMiniMockQuestion(question, index + 1))
    };
  }

  async scoreHomeMiniMock(body: Record<string, unknown>) {
    const questionIds = parseMiniMockQuestionIds(body.questionIds);
    const answers = recordStringMap(body.answers);
    const rows = await this.prisma.cscaQuestion.findMany({
      where: {
        id: { in: questionIds },
        status: 'approved',
        topic: { status: 'published' }
      },
      include: { topic: true },
      orderBy: [{ id: 'asc' }]
    });
    const byId = new Map(rows.map((question) => [question.id, question]));
    const ordered = questionIds.map((id) => byId.get(id)).filter((question): question is DbQualifiedQuestionWithTopic => Boolean(question));
    if (!ordered.length) throw new BadRequestException('本轮题目已不可用，请重新抽题。');

    const items = ordered.map((question, index) => {
      const selected = cleanString(answers[String(question.id)]);
      const isUnanswered = !selected;
      const isCorrect = selected === question.correctAnswer;
      return {
        ...homeMiniMockQuestion(question, index + 1),
        selected,
        correctAnswer: question.correctAnswer,
        isCorrect,
        isUnanswered,
        explanation: question.explanation,
        knowledgeTags: tagsFromJson(question.knowledgeTags)
      };
    });

    const correctCount = items.filter((item) => item.isCorrect).length;
    const answeredCount = items.filter((item) => !item.isUnanswered).length;
    const wrongCount = items.filter((item) => !item.isCorrect && !item.isUnanswered).length;
    const unansweredCount = items.filter((item) => item.isUnanswered).length;
    const subjectBreakdown = SUBJECTS.map((subject) => {
      const subjectItems = items.filter((item) => item.subject === subject.id);
      const subjectCorrect = subjectItems.filter((item) => item.isCorrect).length;
      const subjectWrong = subjectItems.filter((item) => !item.isCorrect && !item.isUnanswered).length;
      const subjectUnanswered = subjectItems.filter((item) => item.isUnanswered).length;
      return {
        id: subject.id,
        title: subject.title,
        total: subjectItems.length,
        correctCount: subjectCorrect,
        wrongCount: subjectWrong,
        unansweredCount: subjectUnanswered,
        accuracy: subjectItems.length ? Math.round((subjectCorrect / subjectItems.length) * 100) : 0
      };
    });
    const weakTags = new Map<string, { total: number; wrong: number; subjects: Set<string> }>();
    items.forEach((item) => {
      item.knowledgeTags.forEach((tag) => {
        const stat = weakTags.get(tag) ?? { total: 0, wrong: 0, subjects: new Set<string>() };
        stat.total += 1;
        if (!item.isCorrect) stat.wrong += 1;
        stat.subjects.add(item.subjectTitle);
        weakTags.set(tag, stat);
      });
    });

    return {
      summary: {
        correctCount,
        wrongCount,
        unansweredCount,
        answeredCount,
        total: items.length,
        accuracy: items.length ? Math.round((correctCount / items.length) * 100) : 0
      },
      subjectBreakdown,
      weakTags: Array.from(weakTags.entries())
        .map(([tag, stat]) => ({ tag, total: stat.total, wrong: stat.wrong, subjects: Array.from(stat.subjects) }))
        .filter((item) => item.wrong > 0)
        .sort((left, right) => right.wrong - left.wrong || right.total - left.total)
        .slice(0, 8),
      items
    };
  }

  async getSubject(subjectValue: string) {
    const subject = assertSubject(subjectValue);
    const subjectMeta = SUBJECTS.find((item) => item.id === subject)!;
    let topics: TopicSummarySource[];
    try {
      topics = await this.prisma.specialPracticeTopic.findMany({
        where: { subject, status: 'published' },
        include: { _count: { select: { questions: { where: { status: 'published' } }, sessions: true } } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
      });
    } catch {
      return fallbackSubject(subject);
    }
    try {
      const visibleQuestionCounts = await this.visiblePracticeQuestionCountsForTopics(topics.map((topic) => topic.id));
      topics = topics.map((topic) => ({
        ...topic,
        _count: {
          questions: visibleQuestionCounts.get(topic.id) ?? topic._count?.questions ?? 0,
          sessions: topic._count?.sessions ?? 0
        }
      }));
    } catch {
      topics = topics.map((topic) => ({
        ...topic,
        availabilityOverride: 'unavailable',
        _count: { questions: 0, sessions: topic._count?.sessions ?? 0 }
      }));
    }
    const summaries = topics.map((topic) => topicSummary(topic));
    return {
      subject: subjectMeta,
      stats: {
        topicCount: summaries.length,
        availableTopicCount: summaries.filter((topic) => topic.availability.isAvailable).length,
        questionCount: summaries.reduce((sum, topic) => sum + topic.publishedQuestionCount, 0),
        estimatedMinutes: summaries.reduce((sum, topic) => sum + topic.estimatedMinutes, 0),
        availability: topicAvailability(
          { questionCount: summaries.reduce((sum, topic) => sum + topic.questionCount, 0), _count: { questions: summaries.reduce((sum, topic) => sum + topic.publishedQuestionCount, 0) } }
        )
      },
      mockExamRule: MOCK_EXAM_RULE,
      modules: groupTopics(summaries)
    };
  }

  async getTopicStart(slug: string) {
    let topic: (DbTopic & { questions: DbQuestion[] }) | null;
    try {
      topic = await this.prisma.specialPracticeTopic.findFirst({
        where: { slug, status: 'published' },
        include: { questions: { where: { status: 'published' }, orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }] } }
      });
    } catch {
      const fallback = FALLBACK_TOPICS.find((item) => item.slug === slug);
      if (!fallback) throw new NotFoundException('专项知识点不存在。');
      const summary = topicSummary({
        ...fallback,
        status: 'published',
        sortOrder: fallback.id,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        localizations: null,
        availabilityOverride: 'unavailable',
        _count: { questions: 0, sessions: 0 }
      });
      return {
        topic: summary,
        focus: [fallback.module, fallback.title],
        advice: summary.availability.message,
        questionPreviewCount: 0,
        availability: summary.availability,
        availableLanguages: PRACTICE_LANGUAGES,
        currentLanguage: 'zh'
      };
    }
    if (!topic) throw new NotFoundException('专项知识点不存在。');
    const questions = await this.publicPracticeQuestionsForGovernance(topic.questions);
    const tags = Array.from(new Set(questions.flatMap((question) => tagsFromJson(question.knowledgeTags))));
    const focusItems = stringsFromJson(topic.focusItems);
    const advice = cleanString(topic.studyAdvice);
    const summary = topicSummary({
      ...topic,
      _count: { questions: questions.length, sessions: 0 }
    });
    return {
      topic: summary,
      focus: focusItems.length ? focusItems : tags.slice(0, 5),
      advice: summary.availability.isAvailable ? (advice || `先完成 ${topic.questionCount} 道题，查看即时反馈，再回看错题解析。`) : summary.availability.message,
      questionPreviewCount: questions.length,
      availability: summary.availability,
      availableLanguages: PRACTICE_LANGUAGES,
      currentLanguage: 'zh'
    };
  }

  async createSession(slug: string, userId?: number, input: Record<string, unknown> = {}) {
    const language = cleanPracticeLanguage(input.language);
    const topic = await this.prisma.specialPracticeTopic.findFirst({
      where: { slug, status: 'published' },
      include: { questions: { where: { status: 'published' }, orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }] } }
    });
    if (!topic) throw new NotFoundException('专项知识点不存在。');
    const questions = await this.publicPracticeQuestionsForGovernance(topic.questions);
    const availability = topicAvailability({ questionCount: topic.questionCount, _count: { questions: questions.length } });
    if (!availability.isAvailable) {
      throw new ConflictException({
        message: availability.message,
        code: availability.code,
        availability
      });
    }
    const session = await this.prisma.specialPracticeSession.create({
      data: {
        topicId: topic.id,
        userId,
        language,
        questionSnapshot: questions.map((question) => questionSnapshot(question, language)) as Prisma.InputJsonValue
      } as Prisma.SpecialPracticeSessionUncheckedCreateInput
    });
    return sessionSummary(session, topic);
  }

  async listMySessions(userId: number) {
    const sessions = await this.prisma.specialPracticeSession.findMany({
      where: { userId },
      include: { topic: true },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 50
    });
    return { items: sessions.map(sessionHistorySummary) };
  }

  async listMyWrongQuestions(userId: number, filters: Record<string, string | undefined> = {}) {
    const sessions = await this.prisma.specialPracticeSession.findMany({
      where: {
        userId,
        completedAt: { not: null }
      },
      include: { topic: true },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: 100
    });
    const subject = cleanString(filters.subject);
    const module = cleanString(filters.module);
    const topicSlug = cleanString(filters.topicSlug);
    const knowledgeTag = cleanString(filters.knowledgeTag);
    const items = [];
    for (const session of sessions) {
      if (subject && session.topic.subject !== subject) continue;
      if (module && session.topic.module !== module) continue;
      if (topicSlug && session.topic.slug !== topicSlug) continue;
      const answers = recordStringMap(session.answers);
      const timeSpent = numberMap(session.timeSpent);
      const questions = await this.publicPracticeQuestionsForGovernance(await this.sessionQuestions(session));
      for (const question of questions) {
        const selected = answers[String(question.id)] ?? '';
        if (!selected || selected === question.correctAnswer) continue;
        const knowledgeTags = Array.isArray(question.knowledgeTags) ? tagsFromJson(question.knowledgeTags) : [];
        if (knowledgeTag && !knowledgeTags.includes(knowledgeTag)) continue;
        items.push({
          sessionId: session.id,
          questionId: question.id,
          topic: topicHistorySummary(session.topic),
          prompt: question.prompt,
          options: Array.isArray(question.options) ? question.options : optionsFromJson(question.options),
          selected,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          knowledgeTags,
          timeSpentSeconds: timeSpent[String(question.id)] ?? 0,
          completedAt: session.completedAt?.toISOString() ?? null
        });
      }
    }
    return { items };
  }

  async getSession(idValue: string, actorUserId?: number) {
    const session = await this.findSession(idValue, actorUserId);
    const questions = await this.sessionQuestions(session);
    return {
      session: sessionSummary(session, session.topic),
      questions: questions.map(publicQuestion)
    };
  }

  async patchSession(idValue: string, actorUserId: number | undefined, payload: SpecialPracticeSessionPatchPayload) {
    const id = this.parseSessionId(idValue);
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SPECIAL_SESSION_LOCK_NAMESPACE}::int, ${id}::int)`;
      const existing = await tx.specialPracticeSession.findFirst({ where: this.sessionOwnerWhere(id, actorUserId), include: { topic: true } });
      if (!existing) throw new NotFoundException('专项练习记录不存在。');
      if (existing.completedAt) throw new BadRequestException('本轮练习已完成，不能继续修改。');
      if (payload.expectedVersion !== undefined && payload.expectedVersion !== existing.version) {
        throw new ConflictException({ message: '专项练习记录已被其他操作更新，请刷新后再继续。', code: 'VERSION_CONFLICT', currentVersion: existing.version });
      }
      const data: Prisma.SpecialPracticeSessionUpdateInput = { version: { increment: 1 } };
      if (payload.answers !== undefined) data.answers = recordStringMap(payload.answers) as never;
      if (payload.timeSpent !== undefined) data.timeSpent = numberMap(payload.timeSpent) as never;
      if (payload.currentQuestion !== undefined) data.currentQuestion = Math.max(1, Number(payload.currentQuestion) || 1);
      return tx.specialPracticeSession.update({
        where: { id: existing.id },
        data,
        include: { topic: true }
      });
    });
    return sessionSummary(session, session.topic);
  }

  async checkAnswer(idValue: string, actorUserId: number | undefined, body: Record<string, unknown>) {
    const session = await this.findSession(idValue, actorUserId);
    const questionId = assertPositiveInteger(Number(body.questionId), '题目不存在。');
    const selected = String(body.selected ?? '').trim();
    if (!selected) throw new BadRequestException('请选择答案。');
    const question = (await this.sessionQuestions(session)).find((item) => item.id === questionId);
    if (!question) throw new NotFoundException('题目不存在。');
    return {
      questionId: question.id,
      selected,
      correctAnswer: question.correctAnswer,
      isCorrect: selected === question.correctAnswer,
      explanation: question.explanation,
      knowledgeTags: Array.isArray(question.knowledgeTags) ? tagsFromJson(question.knowledgeTags) : []
    };
  }

  async submitSession(idValue: string, actorUserId?: number) {
    const id = this.parseSessionId(idValue);
    const evidenceWrites = await this.prisma.$transaction(async (tx) => {
      const writes: LearningEvidenceWriteResult[] = [];
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SPECIAL_SESSION_LOCK_NAMESPACE}::int, ${id}::int)`;
      const session = await tx.specialPracticeSession.findFirst({ where: this.sessionOwnerWhere(id, actorUserId), include: { topic: true } });
      if (!session) throw new NotFoundException('专项练习记录不存在。');
      if (session.completedAt) return writes;
      const snapshot = questionsFromSnapshot(session.questionSnapshot);
      let questions: Array<SnapshotQuestion | DbQuestion> = snapshot;
      if (!questions.length) {
        const fallbackQuestions = await tx.specialPracticeQuestion.findMany({
          where: { topicId: session.topicId, status: 'published' },
          orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
        });
        questions = await this.publicPracticeQuestionsForGovernance(fallbackQuestions, tx);
      }
      const answers = recordStringMap(session.answers);
      const correctCount = questions.filter((question) => answers[String(question.id)] === question.correctAnswer).length;
      const answeredCount = Object.keys(answers).length;
      const unansweredCount = Math.max(0, questions.length - answeredCount);
      const wrongCount = Math.max(0, answeredCount - correctCount);
      const completedAt = new Date();
      if (session.userId && this.learningFeatureFlags.isEnabled('evidenceWrite')) {
        const subject = assertSubject(session.topic.subject);
        const mappings = await tx.cscaTopicMapping.findMany({
          where: {
            sourceType: 'special_practice_question',
            sourceId: { in: questions.map((question) => question.id) },
            topic: { subject, status: 'published' }
          },
          orderBy: [{ confidence: 'desc' }, { id: 'asc' }]
        });
        const primaryMapping = new Map<number, typeof mappings[number]>();
        for (const mapping of mappings) {
          if (!primaryMapping.has(mapping.sourceId)) primaryMapping.set(mapping.sourceId, mapping);
        }
        const timeSpent = numberMap(session.timeSpent);
        for (const question of questions) {
          const mapping = primaryMapping.get(question.id);
          if (!mapping) continue;
          const selected = answers[String(question.id)] ?? '';
          writes.push(await this.learningEvidenceWriter.appendInTransaction(tx, mapTrustedQuestionEvidence({
            sourceType: 'adaptive',
            sourceId: `special:${session.id}`,
            sessionId: String(session.id),
            userId: session.userId,
            subjectCode: subject,
            questionId: `special_practice_question:${question.id}`,
            questionVersion: question.version,
            answerKeyVersion: `special_practice_question:${question.id}:v${question.version}`,
            topicId: mapping.topicId,
            topicMappingVersion: `csca-topic-mapping:${mapping.id}:${mapping.updatedAt.toISOString()}`,
            outcome: !selected ? 'skipped' : selected === question.correctAnswer ? 'correct' : 'incorrect',
            timeSpentSeconds: timeSpent[String(question.id)] ?? 0,
            difficulty: question.difficulty,
            questionQualityConfidence: Math.min(1, Math.max(0, mapping.confidence)),
            occurredAt: completedAt,
            metadata: { entryPoint: 'special_practice_session', specialTopicId: session.topicId }
          })));
        }
      }
      await tx.specialPracticeSession.update({
        where: { id: session.id },
        data: { correctCount, wrongCount, unansweredCount, completedAt, version: { increment: 1 } }
      });
      return writes;
    });
    const report = await this.getReport(String(id), actorUserId);
    const learningEvidence = learningEvidenceReceipt(evidenceWrites);
    return learningEvidence ? { ...report, learningEvidence } : report;
  }

  async getReport(idValue: string, actorUserId?: number) {
    const session = await this.findSession(idValue, actorUserId);
    const questions = await this.sessionQuestions(session);
    const answers = recordStringMap(session.answers);
    const timeSpent = numberMap(session.timeSpent);
    const items = questions.map((question) => {
      const selected = answers[String(question.id)] ?? '';
      const isUnanswered = !selected;
      const isCorrect = selected === question.correctAnswer;
      return {
        ...publicQuestion(question),
        selected,
        correctAnswer: question.correctAnswer,
        isCorrect,
        isUnanswered,
        explanation: question.explanation,
        knowledgeTags: Array.isArray(question.knowledgeTags) ? tagsFromJson(question.knowledgeTags) : [],
        secondsSpent: timeSpent[String(question.id)] ?? 0
      };
    });
    const correctCount = items.filter((item) => item.isCorrect).length;
    const wrongCount = items.filter((item) => !item.isCorrect && !item.isUnanswered).length;
    const unansweredCount = items.filter((item) => item.isUnanswered).length;
    const totalSeconds = Object.values(timeSpent).reduce((sum, value) => sum + value, 0);
    const weakTags = new Map<string, { total: number; wrong: number }>();
    items.forEach((item) => {
      item.knowledgeTags.forEach((tag) => {
        const stat = weakTags.get(tag) ?? { total: 0, wrong: 0 };
        stat.total += 1;
        if (!item.isCorrect) stat.wrong += 1;
        weakTags.set(tag, stat);
      });
    });
    return {
      session: sessionSummary(session, session.topic),
      summary: {
        correctCount,
        wrongCount,
        unansweredCount,
        total: items.length,
        accuracy: items.length ? Math.round((correctCount / items.length) * 100) : 0,
        totalSeconds,
        averageSeconds: items.length ? Math.round(totalSeconds / items.length) : 0
      },
      weakTags: Array.from(weakTags.entries()).map(([tag, stat]) => ({ tag, ...stat })).sort((a, b) => b.wrong - a.wrong || b.total - a.total),
      items
    };
  }

  async listAdminTopics() {
    let topics = await this.prisma.specialPracticeTopic.findMany({
      include: { _count: { select: { questions: true, sessions: true } } },
      orderBy: [{ subject: 'asc' }, { module: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
    });
    const visibleQuestionCounts = await this.visiblePracticeQuestionCountsForTopics(topics.map((topic) => topic.id));
    topics = topics.map((topic) => ({
      ...topic,
      _count: {
        questions: visibleQuestionCounts.get(topic.id) ?? 0,
        sessions: topic._count.sessions
      }
    }));
    return {
      items: topics.map(adminTopicSummary),
      summary: {
        total: topics.length,
        published: topics.filter((topic) => topic.status === 'published').length,
        draft: topics.filter((topic) => topic.status === 'draft').length
      }
    };
  }

  async getAdminTopic(idInput: string) {
    const topic = await this.findAdminTopic(idInput);
    const questions = await this.prisma.specialPracticeQuestion.findMany({
      where: { topicId: topic.id },
      orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
    });
    const visibleQuestionCounts = await this.visiblePracticeQuestionCountsForTopics([topic.id]);
    const topicWithAvailability = {
      ...topic,
      _count: {
        questions: visibleQuestionCounts.get(topic.id) ?? 0,
        sessions: topic._count?.sessions ?? 0
      }
    };
    return { topic: adminTopicSummary(topicWithAvailability), questions: questions.map(adminQuestionSummary), issues: this.publishIssues(topic, questions) };
  }

  async createAdminTopic(input: AdminImportTopic, actorId: number) {
    const normalized = validateTopicPayload({ ...input, status: input.status ?? 'draft' });
    if (normalized.errors.length) throw new BadRequestException({ message: '专项信息不完整。', errors: normalized.errors });
    const topic = await this.prisma.specialPracticeTopic.create({ data: normalized.topic });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'topic', resourceId: topic.id, action: 'create', after: adminTopicSummary(topic) });
    return adminTopicSummary(topic);
  }

  async updateAdminTopic(idInput: string, input: AdminImportTopic, actorId: number) {
    const expectedVersion = expectedVersionFrom(input);
    const { existing, next } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.specialPracticeTopic.findFirst({ where: { id: this.parseAdminId(idInput, '专项 topic 不存在。') }, include: { _count: { select: { questions: true, sessions: true } } } });
      if (!existing) throw new NotFoundException('专项 topic 不存在。');
      assertVersion(existing.version, expectedVersion, '专项 topic');
      this.assertEditableTopic(existing, input);
      const normalized = validateTopicPayload({ ...existing, ...input, questions: undefined });
      if (normalized.errors.length) throw new BadRequestException({ message: '专项信息不完整。', errors: normalized.errors });
      if (normalized.topic.status === 'published') {
        const questions = await tx.specialPracticeQuestion.findMany({ where: { topicId: existing.id }, orderBy: [{ orderNumber: 'asc' }] });
        const publishTopic = {
          ...existing,
          ...normalized.topic,
          focusItems: stringsFromJson(normalized.topic.focusItems).length ? stringsFromJson(normalized.topic.focusItems) : null,
          relatedResources: resourcesFromJson(normalized.topic.relatedResources).length ? resourcesFromJson(normalized.topic.relatedResources) : null
        };
        const issues = this.publishIssues(publishTopic as DbTopic, questions);
        if (issues.length) throw new BadRequestException({ message: '发布检查未通过。', errors: issues });
      }
      const updated = await tx.specialPracticeTopic.updateMany({ where: { id: existing.id, version: existing.version }, data: { ...normalized.topic, version: { increment: 1 } } });
      if (updated.count !== 1) throw versionConflict('专项 topic', existing.version);
      const next = await tx.specialPracticeTopic.findFirstOrThrow({ where: { id: existing.id }, include: { _count: { select: { questions: true, sessions: true } } } });
      return { existing, next };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'topic', resourceId: next.id, action: 'update', before: adminTopicSummary(existing), after: adminTopicSummary(next) });
    return adminTopicSummary(next);
  }

  async publishAdminTopic(idInput: string, actorId: number, input: Record<string, unknown> = {}) {
    const expectedVersion = expectedVersionFrom(input);
    const next = await this.prisma.$transaction(async (tx) => {
      const topic = await tx.specialPracticeTopic.findFirst({ where: { id: this.parseAdminId(idInput, '专项 topic 不存在。') }, include: { _count: { select: { questions: true, sessions: true } } } });
      if (!topic) throw new NotFoundException('专项 topic 不存在。');
      assertVersion(topic.version, expectedVersion, '专项 topic');
      const questions = await tx.specialPracticeQuestion.findMany({ where: { topicId: topic.id }, orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }] });
      const issues = this.publishIssues(topic, questions);
      if (issues.length) throw new BadRequestException({ message: '发布检查未通过。', errors: issues });
      const updated = await tx.specialPracticeTopic.updateMany({ where: { id: topic.id, version: topic.version }, data: { status: 'published', version: { increment: 1 } } });
      if (updated.count !== 1) throw versionConflict('专项 topic', topic.version);
      return tx.specialPracticeTopic.findFirstOrThrow({ where: { id: topic.id }, include: { _count: { select: { questions: true, sessions: true } } } });
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'topic', resourceId: next.id, action: 'publish', after: adminTopicSummary(next) });
    return adminTopicSummary(next);
  }

  async archiveAdminTopic(idInput: string, actorId: number, input: Record<string, unknown> = {}) {
    const expectedVersion = expectedVersionFrom(input);
    const { existing, next } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.specialPracticeTopic.findFirst({ where: { id: this.parseAdminId(idInput, '专项 topic 不存在。') }, include: { _count: { select: { questions: true, sessions: true } } } });
      if (!existing) throw new NotFoundException('专项 topic 不存在。');
      assertVersion(existing.version, expectedVersion, '专项 topic');
      const updated = await tx.specialPracticeTopic.updateMany({ where: { id: existing.id, version: existing.version }, data: { status: 'archived', version: { increment: 1 } } });
      if (updated.count !== 1) throw versionConflict('专项 topic', existing.version);
      const next = await tx.specialPracticeTopic.findFirstOrThrow({ where: { id: existing.id }, include: { _count: { select: { questions: true, sessions: true } } } });
      return { existing, next };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'topic', resourceId: next.id, action: 'archive', before: adminTopicSummary(existing), after: adminTopicSummary(next) });
    return adminTopicSummary(next);
  }

  async duplicateAdminTopic(idInput: string, actorId: number) {
    const existing = await this.findAdminTopic(idInput);
    const questions = await this.prisma.specialPracticeQuestion.findMany({ where: { topicId: existing.id }, orderBy: [{ orderNumber: 'asc' }] });
    const next = await this.prisma.specialPracticeTopic.create({
      data: {
        subject: existing.subject,
        module: existing.module,
        slug: `${existing.slug}-copy-${Date.now()}`,
        title: `${existing.title} 副本`,
        description: existing.description,
        overview: existing.overview,
        focusItems: existing.focusItems === null ? Prisma.JsonNull : existing.focusItems,
        studyAdvice: existing.studyAdvice,
        difficultyLabel: existing.difficultyLabel,
        frequencyLabel: existing.frequencyLabel,
        relatedResources: existing.relatedResources === null ? Prisma.JsonNull : existing.relatedResources,
        relatedVisualizerSlug: existing.relatedVisualizerSlug,
        estimatedMinutes: existing.estimatedMinutes,
        questionCount: existing.questionCount,
        sortOrder: existing.sortOrder + 1,
        status: 'draft',
        questions: {
          create: questions.map((question) => ({
            orderNumber: question.orderNumber,
            difficulty: question.difficulty,
            questionType: question.questionType,
            prompt: question.prompt,
            options: question.options as Prisma.InputJsonValue,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
            localizations: (question as DbQuestion & { localizations?: Prisma.InputJsonValue | null }).localizations ?? Prisma.JsonNull,
            status: 'draft'
          }))
        }
      }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'topic', resourceId: next.id, action: 'duplicate', after: { sourceId: existing.id, targetId: next.id } });
    return adminTopicSummary(next);
  }

  async createAdminQuestion(topicIdInput: string, input: AdminImportQuestion, actorId: number) {
    const topic = await this.findAdminTopic(topicIdInput);
    const errors: string[] = [];
    const question = validateQuestionPayload(input, (input.orderNumber ?? 0) - 1, errors);
    if (errors.length) throw new BadRequestException({ message: '题目信息不完整。', errors });
    const next = await this.prisma.specialPracticeQuestion.create({
      data: {
        topicId: topic.id,
        orderNumber: question.orderNumber,
        difficulty: question.difficulty,
        questionType: question.questionType,
        prompt: question.prompt,
        options: question.options as Prisma.InputJsonValue,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
        localizations: question.localizations as Prisma.InputJsonValue,
        status: question.status
      }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'question', resourceId: next.id, action: 'create', after: adminQuestionSummary(next) });
    return adminQuestionSummary(next);
  }

  async updateAdminQuestion(idInput: string, input: AdminImportQuestion, actorId: number) {
    const expectedVersion = expectedVersionFrom(input);
    const { existing, next } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.specialPracticeQuestion.findFirst({ where: { id: this.parseAdminId(idInput, '专项题目不存在。') }, include: { topic: true } });
      if (!existing) throw new NotFoundException('专项题目不存在。');
      assertVersion(existing.version, expectedVersion, '专项题目');
      await this.assertEditableQuestion(existing, input);
      const errors: string[] = [];
      const question = validateQuestionPayload({
        orderNumber: existing.orderNumber,
        difficulty: existing.difficulty,
        questionType: existing.questionType,
        prompt: existing.prompt,
        options: optionsFromJson(existing.options),
        correctAnswer: existing.correctAnswer,
        explanation: existing.explanation,
        knowledgeTags: tagsFromJson(existing.knowledgeTags),
        status: existing.status,
        ...input
      }, (input.orderNumber ?? existing.orderNumber) - 1, errors);
      if (errors.length) throw new BadRequestException({ message: '题目信息不完整。', errors });
      const updated = await tx.specialPracticeQuestion.updateMany({
        where: { id: existing.id, version: existing.version },
        data: {
          orderNumber: question.orderNumber,
          difficulty: question.difficulty,
          questionType: question.questionType,
          prompt: question.prompt,
          options: question.options as Prisma.InputJsonValue,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
          localizations: question.localizations as Prisma.InputJsonValue,
          status: question.status,
          version: { increment: 1 }
        }
      });
      if (updated.count !== 1) throw versionConflict('专项题目', existing.version);
      const next = await tx.specialPracticeQuestion.findFirstOrThrow({ where: { id: existing.id }, include: { topic: true } });
      return { existing, next };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'question', resourceId: next.id, action: 'update', before: adminQuestionSummary(existing), after: adminQuestionSummary(next) });
    return adminQuestionSummary(next);
  }

  async archiveAdminQuestion(idInput: string, actorId: number, input: Record<string, unknown> = {}) {
    const expectedVersion = expectedVersionFrom(input);
    const { existing, next } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.specialPracticeQuestion.findFirst({ where: { id: this.parseAdminId(idInput, '专项题目不存在。') }, include: { topic: true } });
      if (!existing) throw new NotFoundException('专项题目不存在。');
      assertVersion(existing.version, expectedVersion, '专项题目');
      const updated = await tx.specialPracticeQuestion.updateMany({ where: { id: existing.id, version: existing.version }, data: { status: 'archived', version: { increment: 1 } } });
      if (updated.count !== 1) throw versionConflict('专项题目', existing.version);
      const next = await tx.specialPracticeQuestion.findFirstOrThrow({ where: { id: existing.id }, include: { topic: true } });
      return { existing, next };
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'question', resourceId: next.id, action: 'archive', before: adminQuestionSummary(existing), after: adminQuestionSummary(next) });
    return adminQuestionSummary(next);
  }

  async validateAdminImport(input: unknown) {
    const payload = assertRecord(input, 'JSON 顶层必须是对象。');
    if (!Array.isArray(payload.topics)) throw new BadRequestException('JSON 顶层必须包含 topics 数组。');
    const previews = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    for (const [index, rawTopic] of payload.topics.entries()) {
      const normalized = validateTopicPayload(rawTopic as AdminImportTopic, index);
      errors.push(...normalized.errors);
      if (!normalized.topic.overview) warnings.push(`${normalized.topic.slug || `第 ${index + 1} 个 topic`} 缺少知识点概述。`);
      if (!stringsFromJson(normalized.topic.focusItems).length) warnings.push(`${normalized.topic.slug || `第 ${index + 1} 个 topic`} 缺少重点内容。`);
      if (!normalized.topic.studyAdvice) warnings.push(`${normalized.topic.slug || `第 ${index + 1} 个 topic`} 缺少学习建议。`);
      const existing = normalized.topic.slug ? await this.prisma.specialPracticeTopic.findUnique({ where: { slug: normalized.topic.slug }, include: { _count: { select: { questions: true, sessions: true } } } }) : null;
      if (existing?.status === 'published' && existing._count.sessions > 0 && normalized.questions.length) {
        errors.push(`专项 ${existing.slug} 已发布且已有练习记录，请复制为新 topic 后再大改题目。`);
      }
      previews.push({
        slug: normalized.topic.slug,
        title: normalized.topic.title,
        subject: normalized.topic.subject,
        module: normalized.topic.module,
        status: normalized.topic.status,
        questionCount: normalized.questions.length,
        action: existing ? 'update-draft' : 'create-draft',
        existingStatus: existing?.status ?? null,
        existingSessions: existing?._count.sessions ?? 0
      });
    }
    return { ok: errors.length === 0, errors, warnings: Array.from(new Set(warnings)), previews };
  }

  async importAdminTopics(input: unknown, actorId: number) {
    const validation = await this.validateAdminImport(input);
    if (!validation.ok) throw new BadRequestException({ message: '导入校验未通过。', errors: validation.errors });
    const payload = assertRecord(input, 'JSON 顶层必须是对象。');
    const topics = payload.topics as AdminImportTopic[];
    let created = 0;
    let updated = 0;
    let questionsUpserted = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const rawTopic of topics) {
        const normalized = validateTopicPayload({ ...rawTopic, status: rawTopic.status ?? 'draft' });
        const existing = await tx.specialPracticeTopic.findUnique({ where: { slug: normalized.topic.slug } });
        const topic = existing
          ? await tx.specialPracticeTopic.update({ where: { id: existing.id }, data: { ...normalized.topic, status: existing.status === 'published' ? 'draft' : normalized.topic.status } })
          : await tx.specialPracticeTopic.create({ data: { ...normalized.topic, status: 'draft' } });
        existing ? updated += 1 : created += 1;
        for (const question of normalized.questions) {
          await tx.specialPracticeQuestion.upsert({
            where: { topicId_orderNumber: { topicId: topic.id, orderNumber: question.orderNumber } },
            create: {
              topicId: topic.id,
              orderNumber: question.orderNumber,
              difficulty: question.difficulty,
              questionType: question.questionType,
              prompt: question.prompt,
              options: question.options as Prisma.InputJsonValue,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
              localizations: question.localizations as Prisma.InputJsonValue,
              status: question.status
            },
            update: {
              difficulty: question.difficulty,
              questionType: question.questionType,
              prompt: question.prompt,
              options: question.options as Prisma.InputJsonValue,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              knowledgeTags: question.knowledgeTags as Prisma.InputJsonValue,
              localizations: question.localizations as Prisma.InputJsonValue,
              status: question.status
            }
          });
          questionsUpserted += 1;
        }
      }
    });
    await recordAdminAudit(this.prisma, { actorId, module: 'special-practice', resourceType: 'import', action: 'import', after: { created, updated, questionsUpserted } });
    return { created, updated, questionsUpserted, previews: validation.previews };
  }

  private publishIssues(topic: Pick<DbTopic, 'questionCount' | 'title'>, questions: DbQuestion[]) {
    const errors: string[] = [];
    validatePublishable(topic.questionCount, questions.map((question) => ({
      orderNumber: question.orderNumber,
      difficulty: question.difficulty,
      questionType: question.questionType,
      prompt: question.prompt,
      options: optionsFromJson(question.options),
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      knowledgeTags: tagsFromJson(question.knowledgeTags),
      status: question.status
    })), errors, topic.title);
    return Array.from(new Set(errors));
  }

  private async findSession(idValue: string, actorUserId?: number) {
    const id = this.parseSessionId(idValue);
    const session = await this.prisma.specialPracticeSession.findFirst({ where: this.sessionOwnerWhere(id, actorUserId), include: { topic: true } });
    if (!session) throw new NotFoundException('专项练习记录不存在。');
    return session;
  }

  private sessionOwnerWhere(id: number, actorUserId?: number): Prisma.SpecialPracticeSessionWhereInput {
    return actorUserId
      ? { id, OR: [{ userId: actorUserId }, { userId: null }] }
      : { id, userId: null };
  }

  private parseSessionId(idValue: string) {
    return assertPositiveInteger(Number(idValue), '专项练习记录不存在。');
  }

  private async sessionQuestions(session: DbSession) {
    const snapshot = questionsFromSnapshot((session as DbSession & { questionSnapshot?: unknown }).questionSnapshot);
    if (snapshot.length) return snapshot;
    const questions = await this.prisma.specialPracticeQuestion.findMany({
      where: { topicId: session.topicId, status: 'published' },
      orderBy: [{ orderNumber: 'asc' }, { id: 'asc' }]
    });
    const visibleQuestions = await this.publicPracticeQuestionsForGovernance(questions);
    return visibleQuestions.map((question) => questionSnapshot(question, session.language));
  }

  private async publicPracticeQuestionsForGovernance<T extends { id: number }>(
    questions: T[],
    client: Pick<PrismaService, 'cscaQuestion'> = this.prisma
  ) {
    const ids = questions.map((question) => question.id);
    if (!ids.length) return questions;
    let aiRows: Array<{
      sourceQuestionId: number | null;
      subject: string;
      status: string;
      designedDifficulty: string;
      prompt: string;
      options: Prisma.JsonValue;
      explanation: string;
      syllabusVersion: string;
      topicId: number | null;
      generationMetadata: Prisma.JsonValue | null;
      reviewMetadata: Prisma.JsonValue | null;
      topic: { syllabusVersion: string; status: string } | null;
    }>;
    try {
      aiRows = await client.cscaQuestion.findMany({
        where: { sourceType: 'ai', sourceQuestionId: { in: ids } },
        select: {
          sourceQuestionId: true,
          subject: true,
          status: true,
          designedDifficulty: true,
          prompt: true,
          options: true,
          explanation: true,
          syllabusVersion: true,
          topicId: true,
          generationMetadata: true,
          reviewMetadata: true,
          topic: { select: { syllabusVersion: true, status: true } }
        }
      });
    } catch (error) {
      if (!process.env.DATABASE_URL) return questions;
      throw error;
    }
    const aiRowsBySourceQuestionId = new Map<number, typeof aiRows>();
    for (const row of aiRows) {
      if (!row.sourceQuestionId) continue;
      const rows = aiRowsBySourceQuestionId.get(row.sourceQuestionId) ?? [];
      rows.push(row);
      aiRowsBySourceQuestionId.set(row.sourceQuestionId, rows);
    }
    return questions.filter((question) => {
      const rows = aiRowsBySourceQuestionId.get(question.id) ?? [];
      if (!rows.length) return true;
      return rows.some((row) => (
        row.status === 'approved' &&
        isPublishedSubjectPracticeAiQuestion(row.reviewMetadata) &&
        !isOnlineMockExamQuestion(row.generationMetadata, row.reviewMetadata) &&
        !isFallbackOrSmokeQuestion(row.generationMetadata) &&
        isUsableQuestionVersion(row.generationMetadata) &&
        row.topic?.status === 'published' &&
        row.syllabusVersion === row.topic.syllabusVersion &&
        subjectPracticeCurrentPolicyBlockReasons(row).length === 0
      ));
    });
  }

  private async visiblePracticeQuestionCountsForTopics(topicIds: number[]) {
    const ids = Array.from(new Set(topicIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!ids.length) return new Map<number, number>();
    let questions: Array<{ id: number; topicId: number }>;
    try {
      questions = await this.prisma.specialPracticeQuestion.findMany({
        where: { topicId: { in: ids }, status: 'published' },
        orderBy: [{ topicId: 'asc' }, { orderNumber: 'asc' }, { id: 'asc' }]
      });
    } catch (error) {
      if (!process.env.DATABASE_URL) return new Map<number, number>();
      throw error;
    }
    const visibleQuestions = await this.publicPracticeQuestionsForGovernance(questions);
    const counts = new Map<number, number>();
    for (const question of visibleQuestions) {
      counts.set(question.topicId, (counts.get(question.topicId) ?? 0) + 1);
    }
    for (const id of ids) counts.set(id, counts.get(id) ?? 0);
    return counts;
  }

  private async findAdminTopic(idInput: string | number) {
    const id = this.parseAdminId(idInput, '专项 topic 不存在。');
    const topic = await this.prisma.specialPracticeTopic.findFirst({ where: { id }, include: { _count: { select: { questions: true, sessions: true } } } });
    if (!topic) throw new NotFoundException('专项 topic 不存在。');
    return topic;
  }

  private async findAdminQuestion(idInput: string | number) {
    const id = this.parseAdminId(idInput, '专项题目不存在。');
    const question = await this.prisma.specialPracticeQuestion.findFirst({ where: { id }, include: { topic: true } });
    if (!question) throw new NotFoundException('专项题目不存在。');
    return question;
  }

  private parseAdminId(idInput: string | number, message: string) {
    const id = Number(idInput);
    if (!Number.isInteger(id) || id < 1) throw new NotFoundException(message);
    return id;
  }

  private assertEditableTopic(existing: DbTopic & { _count?: { sessions: number } }, input: AdminImportTopic) {
    if (existing.status !== 'published' || (existing._count?.sessions ?? 0) === 0) return;
    const changingCore =
      (input.subject !== undefined && input.subject !== existing.subject) ||
      (input.slug !== undefined && input.slug !== existing.slug) ||
      (input.questionCount !== undefined && Number(input.questionCount) !== existing.questionCount);
    if (changingCore) throw new BadRequestException('这个专项已有练习记录；科目、slug 或题量需要复制为新 topic 后再修改。');
  }

  private async assertEditableQuestion(existing: DbQuestion & { topic: DbTopic }, input: AdminImportQuestion) {
    const sessions = await this.prisma.specialPracticeSession.count({ where: { topicId: existing.topicId } });
    if (existing.topic.status !== 'published' || sessions === 0) return;
    const changingCore =
      (input.orderNumber !== undefined && input.orderNumber !== existing.orderNumber) ||
      (input.prompt !== undefined && input.prompt !== existing.prompt) ||
      (input.correctAnswer !== undefined && input.correctAnswer !== existing.correctAnswer) ||
      (input.options !== undefined && JSON.stringify(input.options) !== JSON.stringify(optionsFromJson(existing.options)));
    if (changingCore) throw new BadRequestException('这道题所属专项已有练习记录；题干、选项、答案或题号需要复制为新 topic 后再修改。');
  }
}
