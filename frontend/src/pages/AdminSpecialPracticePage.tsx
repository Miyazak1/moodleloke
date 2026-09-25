import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminStatsStrip, AdminWorkflowSteps } from '../components/admin/AdminWorkbench';
import { MathContent } from '../components/MathContent';
import { AdminFormField, GhostButton, InlineActions, StatusPill } from '../components/UiPrimitives';
import { useI18n } from '../i18n/useI18n';
import { adminText, selectAdminCopy, usesLatinAdminCopy } from '../lib/admin-locale';
import {
  archiveAdminSpecialPracticeQuestion,
  archiveAdminSpecialPracticeTopic,
  createAdminSpecialPracticeQuestion,
  createAdminSpecialPracticeTopic,
  duplicateAdminSpecialPracticeTopic,
  getAdminSpecialPracticeTopic,
  getAdminSpecialPracticeTopics,
  importAdminSpecialPracticeTopics,
  publishAdminSpecialPracticeTopic,
  updateAdminSpecialPracticeQuestion,
  updateAdminSpecialPracticeTopic,
  validateAdminSpecialPracticeImport
} from '../lib/api-admin';
import type { AdminSpecialPracticeImportValidation, AdminSpecialPracticeQuestion, AdminSpecialPracticeTopic, AdminSpecialPracticeTopicDetail, SpecialPracticeAvailability, User } from '../lib/api-types';

type AdminSpecialPracticePageProps = {
  currentUser: User | null;
  onBackAudit: () => void;
  onGoToContent: () => void;
  onGoToSchools: () => void;
  onGoToScholarships?: () => void;
  onGoToMockExams: () => void;
  onGoToUsers: () => void;
  onGoToAuth: () => void;
};

type QuestionDraft = Omit<AdminSpecialPracticeQuestion, 'id' | 'topicId' | 'createdAt' | 'updatedAt' | 'version'> & { id?: number; topicId?: number; version?: number };

type SpecialPracticeBusyAction =
  | 'create-topic'
  | 'save-topic'
  | 'publish-topic'
  | 'duplicate-topic'
  | 'archive-topic'
  | 'save-question'
  | 'archive-question'
  | 'validate-import'
  | 'import-json';

const ADMIN_SPECIAL_COPY = {
  zh: {
    subjects: { math: '数学', physics: '物理', chemistry: '化学' },
    statuses: { draft: '草稿', published: '已发布', archived: '已归档' },
    topicDifficultyOptions: ['基础', '中等', '提高', '考频低', '考频中', '考频高', '易错'],
    questionDifficultyOptions: ['较易', '中等', '较难', '基础', '提高'],
    fallbackError: '操作失败，请稍后再试。',
    invalidJson: 'JSON 格式不正确，请检查逗号、引号和括号。',
    createdTopic: '专项草稿已创建。',
    savedTopic: '专项信息已保存。',
    publishedTopic: '专项已发布到前台。',
    archivedTopic: '专项已归档。',
    duplicatedTopic: '已复制为新的草稿专项。',
    savedQuestion: '题目已保存。',
    createdQuestion: '题目已创建。',
    archivedQuestion: '题目已下架。',
    importValid: 'JSON 校验通过，可以导入为草稿。',
    importInvalid: 'JSON 校验完成，请先修正错误。',
    importDone: '导入完成：创建 {created} 个，更新 {updated} 个，同步 {questions} 题。',
    kicker: '后台专项题库',
    adminTitle: '批量导入知识点，也能逐题精修。',
    guestTitle: '专项题库管理',
    body: '管理数学、物理、化学原创专项练习；JSON 用于批量生产，后台表单用于日常维护和发布检查。',
    successTitle: '操作完成',
    warningTitle: '需要处理',
    statsLabel: '专项题库统计',
    topicStat: '专项',
    publishedStat: '已发布',
    studentReadyStat: '学生可练',
    draftStat: '草稿',
    questionStat: '题目',
    directoryKicker: '专项目录',
    topicCount: '{count} 个',
    new: '新建',
    topicMeta: '{questions}/{total} 题 · {sessions} 次练习',
    topicStudentAvailability: '学生端：{label}',
    availabilityLabels: { available: '可练习', replenishing: '题库补齐中', exhausted: '暂无可用题', unavailable: '暂未开放' },
    availabilityBody: {
      available: '学生可以正常进入这一专项练习。',
      replenishing: '题库数量或治理状态还没达到上线要求，学生暂时不能开始。',
      exhausted: '当前没有学生可用题目，先补齐题库再开放。',
      unavailable: '学生专项练习被上线开关隔离，前台只展示说明，不允许开练。'
    },
    newTopicKicker: '新建专项',
    topicKicker: '专项 #{id}',
    untitledTopic: '未命名专项',
    subject: '科目',
    module: '模块',
    slug: 'Slug',
    title: '标题',
    status: '状态',
    questionCount: '题量',
    estimatedMinutes: '预计分钟',
    sort: '排序',
    frequency: '考频',
    frequencyPlaceholder: '高频 / 中频 / 易错',
    difficulty: '难度',
    unset: '未设置',
    visualizerSlug: '交互模拟 Slug',
    visualizerPlaceholder: 'math-function-basic 可填 elementary-functions',
    description: '描述',
    overview: '知识点概述',
    focusItems: '重点内容（一行一条）',
    studyAdvice: '学习建议',
    relatedResources: '关联资源（每行：名称 | 路径）',
    issueBad: '发布检查未通过',
    issueOk: '发布检查正常',
    issueOkBody: '题量、题号和题目字段满足当前检查。',
    existingSessionsWarning: '这个专项已有练习记录。科目、slug、题量或核心题目内容需要复制为新 topic 后修改。',
    createDraft: '创建草稿',
    saveTopic: '保存专项',
    publish: '发布',
    duplicate: '复制为新 topic',
    archive: '归档',
    questionManage: '题目管理',
    questionCountTitle: '{count} 道题',
    addQuestion: '新增题目',
    questionNumber: '题号',
    correctAnswer: '正确答案',
    prompt: '题干',
    option: '选项 {id}',
    explanation: '解析',
    tags: '知识点标签',
    saveQuestion: '保存题目',
    createQuestion: '创建题目',
    archiveQuestion: '下架题目',
    importKicker: 'JSON 批量导入',
    importTitle: '校验后导入草稿',
    validateJson: '校验 JSON',
    import: '导入',
    jsonContent: 'JSON 内容',
    validationPassed: '校验通过',
    validationFailed: '校验未通过',
    warningPrefix: '警告：{message}',
    previewCreate: '创建 topic 草稿',
    previewUpdate: '更新 topic 草稿',
    previewLine: '{slug}：{action}，同步 {questions} 题',
    previewStatus: '，当前状态 {status}',
    previewSessions: '，已有 {sessions} 次练习记录',
    preview: {
      publishedMismatch: '已发布题量 {published}/{total}',
      existingSessions: '已有练习记录，核心内容大改请复制为新 topic',
      answerConcentrated: '答案分布偏集中，建议复查正确答案规律',
      tagCoverageLow: '知识点标签覆盖偏少，建议补充细分标签',
      missingOverview: '缺少知识点概述',
      missingFocus: '缺少重点内容',
      missingAdvice: '缺少学习建议',
      missingPrompt: '#{order} 题干',
      missingExplanation: '#{order} 解析',
      missingTags: '#{order} 标签',
      missingOptions: '#{order} 选项',
      questionStatus: '题目状态',
      draftArchived: '草稿 {draft} · 归档 {archived}',
      answerDistribution: '答案分布',
      answerDistributionBody: '用于发布前发现答案规律过强的问题。',
      tagDistribution: '标签分布',
      noTags: '暂无标签',
      tagDistributionBody: '优先保持知识点覆盖均衡。',
      missingItems: '缺失项',
      noMissing: '无明显缺失',
      missingBody: '请先补齐后再发布。',
      noMissingBody: '题干、选项、解析和标签齐全。',
      releaseErrors: '发布错误',
      noErrors: '无阻塞错误',
      errorBody: '这些问题会阻止稳定发布。',
      noErrorBody: '可继续检查内容质量警告。',
      contentWarnings: '内容警告',
      noWarnings: '无明显警告',
      warningBody: '建议发布前复查，但不一定阻塞草稿维护。',
      noWarningBody: '答案和标签分布看起来比较稳。'
    }
  },
  en: {
    subjects: { math: 'Math', physics: 'Physics', chemistry: 'Chemistry' },
    statuses: { draft: 'Draft', published: 'Published', archived: 'Archived' },
    topicDifficultyOptions: ['Core', 'Medium', 'Advanced', 'Low frequency', 'Medium frequency', 'High frequency', 'Common mistake'],
    questionDifficultyOptions: ['Easy', 'Medium', 'Hard', 'Core', 'Advanced'],
    fallbackError: 'Action failed. Please try again later.',
    invalidJson: 'Invalid JSON. Check commas, quotes, and brackets.',
    createdTopic: 'Topic draft created.',
    savedTopic: 'Topic information saved.',
    publishedTopic: 'Topic published to the public site.',
    archivedTopic: 'Topic archived.',
    duplicatedTopic: 'Copied as a new draft topic.',
    savedQuestion: 'Question saved.',
    createdQuestion: 'Question created.',
    archivedQuestion: 'Question archived.',
    importValid: 'JSON validation passed. You can import it as a draft.',
    importInvalid: 'JSON validation completed. Fix the errors before import.',
    importDone: 'Import completed: {created} created, {updated} updated, {questions} questions synced.',
    kicker: 'Admin Targeted Practice Bank',
    adminTitle: 'Import topics in bulk, then refine questions one by one.',
    guestTitle: 'Targeted Practice Management',
    body: 'Manage original targeted practice for Math, Physics, and Chemistry. JSON supports bulk production; admin forms support daily maintenance and release checks.',
    successTitle: 'Done',
    warningTitle: 'Needs attention',
    statsLabel: 'Targeted practice bank statistics',
    topicStat: 'Topics',
    publishedStat: 'Published',
    studentReadyStat: 'Student Ready',
    draftStat: 'Drafts',
    questionStat: 'Questions',
    directoryKicker: 'Topic Directory',
    topicCount: '{count} topics',
    new: 'New',
    topicMeta: '{questions}/{total} questions · {sessions} sessions',
    topicStudentAvailability: 'Student side: {label}',
    availabilityLabels: { available: 'Ready', replenishing: 'Replenishing', exhausted: 'No usable bank', unavailable: 'Temporarily closed' },
    availabilityBody: {
      available: 'Students can start this special practice topic.',
      replenishing: 'The pool count or governance state is not release-ready, so students cannot start yet.',
      exhausted: 'No student-usable questions are available. Replenish the pool before opening it.',
      unavailable: 'Student practice is isolated by the launch switch. The public site can explain it but cannot start sessions.'
    },
    newTopicKicker: 'New Topic',
    topicKicker: 'Topic #{id}',
    untitledTopic: 'Untitled topic',
    subject: 'Subject',
    module: 'Module',
    slug: 'Slug',
    title: 'Title',
    status: 'Status',
    questionCount: 'Question count',
    estimatedMinutes: 'Estimated minutes',
    sort: 'Sort',
    frequency: 'Frequency',
    frequencyPlaceholder: 'High frequency / Medium frequency / Common mistake',
    difficulty: 'Difficulty',
    unset: 'Not set',
    visualizerSlug: 'Interactive simulation slug',
    visualizerPlaceholder: 'For math-function-basic, use elementary-functions',
    description: 'Description',
    overview: 'Concept overview',
    focusItems: 'Focus items (one per line)',
    studyAdvice: 'Study advice',
    relatedResources: 'Related resources (one per line: name | path)',
    issueBad: 'Release check failed',
    issueOk: 'Release check passed',
    issueOkBody: 'Question count, order numbers, and required question fields pass current checks.',
    existingSessionsWarning: 'This topic already has practice records. Copy it as a new topic before changing subject, slug, question count, or core question content.',
    createDraft: 'Create draft',
    saveTopic: 'Save topic',
    publish: 'Publish',
    duplicate: 'Copy as new topic',
    archive: 'Archive',
    questionManage: 'Question Management',
    questionCountTitle: '{count} questions',
    addQuestion: 'Add question',
    questionNumber: 'Question no.',
    correctAnswer: 'Correct answer',
    prompt: 'Prompt',
    option: 'Option {id}',
    explanation: 'Explanation',
    tags: 'Knowledge tags',
    saveQuestion: 'Save question',
    createQuestion: 'Create question',
    archiveQuestion: 'Archive question',
    importKicker: 'Bulk JSON Import',
    importTitle: 'Validate before importing drafts',
    validateJson: 'Validate JSON',
    import: 'Import',
    jsonContent: 'JSON content',
    validationPassed: 'Validation passed',
    validationFailed: 'Validation failed',
    warningPrefix: 'Warning: {message}',
    previewCreate: 'Create topic draft',
    previewUpdate: 'Update topic draft',
    previewLine: '{slug}: {action}, sync {questions} questions',
    previewStatus: ', current status {status}',
    previewSessions: ', {sessions} existing practice sessions',
    preview: {
      publishedMismatch: 'Published questions {published}/{total}',
      existingSessions: 'Existing practice records. Copy as a new topic before major content changes.',
      answerConcentrated: 'Answer distribution is concentrated. Review correct-answer patterns.',
      tagCoverageLow: 'Knowledge tag coverage is low. Add more specific tags.',
      missingOverview: 'Missing concept overview',
      missingFocus: 'Missing focus items',
      missingAdvice: 'Missing study advice',
      missingPrompt: '#{order} prompt',
      missingExplanation: '#{order} explanation',
      missingTags: '#{order} tags',
      missingOptions: '#{order} options',
      questionStatus: 'Question Status',
      draftArchived: 'Drafts {draft} · Archived {archived}',
      answerDistribution: 'Answer Distribution',
      answerDistributionBody: 'Use this to catch overly obvious answer patterns before release.',
      tagDistribution: 'Tag Distribution',
      noTags: 'No tags yet',
      tagDistributionBody: 'Keep concept coverage balanced where possible.',
      missingItems: 'Missing Items',
      noMissing: 'No obvious gaps',
      missingBody: 'Fill these before publishing.',
      noMissingBody: 'Prompts, options, explanations, and tags are complete.',
      releaseErrors: 'Release Errors',
      noErrors: 'No blocking errors',
      errorBody: 'These issues block a stable release.',
      noErrorBody: 'Continue checking content-quality warnings.',
      contentWarnings: 'Content Warnings',
      noWarnings: 'No obvious warnings',
      warningBody: 'Review before publishing, though these may not block draft work.',
      noWarningBody: 'Answer and tag distribution look stable.'
    }
  }
} as const;

type AdminSpecialCopy = (typeof ADMIN_SPECIAL_COPY)[keyof typeof ADMIN_SPECIAL_COPY];

function fillSpecialTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function getSubjectLabel(subject: string, copy: AdminSpecialCopy) {
  return copy.subjects[subject as keyof typeof copy.subjects] || subject;
}

function getStatusLabel(status: string, copy: AdminSpecialCopy) {
  return copy.statuses[status as keyof typeof copy.statuses] || status;
}

function getAvailabilityStatus(availability?: SpecialPracticeAvailability | null) {
  return availability?.status ?? (availability?.isAvailable === false ? 'unavailable' : 'available');
}

function getAvailabilityLabel(availability: SpecialPracticeAvailability | undefined | null, copy: AdminSpecialCopy) {
  const status = getAvailabilityStatus(availability);
  return copy.availabilityLabels[status as keyof typeof copy.availabilityLabels] || status;
}

function getAvailabilityBody(availability: SpecialPracticeAvailability | undefined | null, copy: AdminSpecialCopy) {
  const status = getAvailabilityStatus(availability);
  return availability?.message || copy.availabilityBody[status as keyof typeof copy.availabilityBody] || '';
}

function getAvailabilityTone(availability: SpecialPracticeAvailability | undefined | null): 'success' | 'warning' | 'danger' | 'muted' {
  const status = getAvailabilityStatus(availability);
  if (status === 'available') return 'success';
  if (status === 'replenishing') return 'warning';
  if (status === 'exhausted') return 'danger';
  return 'muted';
}

function optionsWithCurrent(options: readonly string[], current: string | null | undefined) {
  const value = String(current ?? '').trim();
  if (!value || options.includes(value)) return options;
  return [value, ...options];
}

function createSampleImport(locale: string) {
  const isEnglish = usesLatinAdminCopy(locale);
  return {
    topics: [
      {
        subject: 'math',
        module: isEnglish ? 'Sets and Inequalities' : '集合与不等式',
        slug: 'math-set-draft',
        title: isEnglish ? 'Sets Practice Draft' : '集合专项草稿',
        description: isEnglish ? 'Original targeted practice for set notation, union, intersection, and complement.' : '集合表示、并集、交集、补集等原创专项练习。',
        overview: isEnglish ? 'Sets are a foundation of mathematical language. Start with elements, subsets, intersections, unions, and complements.' : '集合是数学语言的基础，适合先掌握元素、子集、交集、并集和补集的判断。',
        focusItems: isEnglish ? ['Set notation', 'Intersection, union, and complement', 'Subset and element relationships'] : ['集合表示方法', '交集、并集、补集', '子集与元素关系'],
        studyAdvice: isEnglish ? 'Draw simple Venn diagrams first, then practice symbolic set operations.' : '先画简单韦恩图，再练符号表达和集合运算。',
        frequencyLabel: isEnglish ? 'High frequency' : '高频',
        difficultyLabel: isEnglish ? 'Core' : '基础',
        relatedResources: [
          { label: isEnglish ? 'Math study guide' : '数学学习指南', path: '/csca-subjects/math' },
          { label: isEnglish ? 'Math vocabulary' : '数学术语表', path: '/csca-subjects/math/vocabulary' }
        ],
        estimatedMinutes: 20,
        questionCount: 10,
        sortOrder: 10,
        status: 'draft',
        questions: [
          {
            orderNumber: 1,
            difficulty: isEnglish ? 'Core' : '基础',
            questionType: 'single-choice',
            prompt: isEnglish ? 'If A={1,2,3} and B={2,3,4}, what is A intersect B?' : '设 A={1,2,3}，B={2,3,4}，则 A∩B=（ ）',
            options: [
              { id: 'A', text: '{2,3}' },
              { id: 'B', text: '{1,4}' },
              { id: 'C', text: '{1,2,3,4}' },
              { id: 'D', text: '{4}' }
            ],
            correctAnswer: 'A',
            explanation: isEnglish ? 'The intersection contains elements shared by both sets, so the answer is 2 and 3.' : '交集表示两个集合共有的元素，A 与 B 共有 2 和 3。',
            knowledgeTags: isEnglish ? ['Sets', 'Intersection'] : ['集合', '交集'],
            status: 'draft'
          }
        ]
      }
    ]
  };
}

function emptyQuestion(orderNumber: number, difficulty = '基础'): QuestionDraft {
  return {
    orderNumber,
    difficulty,
    questionType: 'single-choice',
    prompt: '',
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' }
    ],
    correctAnswer: 'A',
    explanation: '',
    knowledgeTags: [],
    status: 'draft'
  };
}

function compactError(error: unknown, fallback: string, locale: string) {
  if (error instanceof Error) {
    const message = error.message;
    if (usesLatinAdminCopy(locale) && /[\u3400-\u9fff]/.test(message)) return fallback;
    return message;
  }
  return fallback;
}

type PostWriteRefreshOptions = {
  afterWriteAction?: string;
  refreshTarget?: string;
};

function trimActionMessage(message: string) {
  return message.replace(/[。.]$/, '');
}

function appendRefreshWarning(current: string, action: string, target: string, detail: string, locale: string) {
  const warning = adminText(locale, {
    zh: `${action}已完成，但${target}暂时无法刷新：${detail}`,
    en: `${action} succeeded, but ${target} could not refresh: ${detail}`,
    vi: `${action} đã hoàn tất nhưng không thể làm mới ${target}: ${detail}`
  });
  return current ? `${current}；${warning}` : warning;
}

function tagsToText(tags: string[]) {
  return tags.join('，');
}

function textToTags(value: string) {
  return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
}

function resourcesToText(resources: Array<{ label: string; path: string }> = []) {
  return resources.map((item) => `${item.label} | ${item.path}`).join('\n');
}

function textToResources(value: string) {
  return value
    .split(/\n/)
    .map((line) => {
      const [label, ...pathParts] = line.split('|');
      const path = pathParts.join('|').trim();
      return { label: label.trim(), path };
    })
    .filter((item) => item.label && item.path);
}

function parseJsonText(value: string, copy: AdminSpecialCopy) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(copy.invalidJson);
  }
}

function buildTopicPreview(detail: AdminSpecialPracticeTopicDetail | null, copy: AdminSpecialCopy) {
  if (!detail) return null;
  const published = detail.questions.filter((question) => question.status === 'published');
  const answerCounts = { A: 0, B: 0, C: 0, D: 0 };
  const tagCounts = new Map<string, number>();
  const missing: string[] = [];
  detail.questions.forEach((question) => {
    if (question.status === 'published' && question.correctAnswer in answerCounts) {
      answerCounts[question.correctAnswer as keyof typeof answerCounts] += 1;
    }
    question.knowledgeTags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
    if (!question.prompt.trim()) missing.push(fillSpecialTemplate(copy.preview.missingPrompt, { order: question.orderNumber }));
    if (!question.explanation.trim()) missing.push(fillSpecialTemplate(copy.preview.missingExplanation, { order: question.orderNumber }));
    if (!question.knowledgeTags.length) missing.push(fillSpecialTemplate(copy.preview.missingTags, { order: question.orderNumber }));
    if (question.options.length !== 4 || question.options.some((option) => !option.text.trim())) missing.push(fillSpecialTemplate(copy.preview.missingOptions, { order: question.orderNumber }));
  });
  const errors = [
    ...(published.length !== detail.topic.questionCount ? [fillSpecialTemplate(copy.preview.publishedMismatch, { published: published.length, total: detail.topic.questionCount })] : []),
    ...Array.from(new Set(missing)).slice(0, 6)
  ];
  const maxAnswerCount = Math.max(...Object.values(answerCounts));
  const warnings = [
    ...(detail.topic.status === 'published' && detail.topic.sessionTotal > 0 ? [copy.preview.existingSessions] : []),
    ...(published.length && maxAnswerCount / published.length > 0.45 ? [copy.preview.answerConcentrated] : []),
    ...(tagCounts.size < Math.min(3, published.length) ? [copy.preview.tagCoverageLow] : []),
    ...(!detail.topic.overview ? [copy.preview.missingOverview] : []),
    ...(!detail.topic.focusItems?.length ? [copy.preview.missingFocus] : []),
    ...(!detail.topic.studyAdvice ? [copy.preview.missingAdvice] : [])
  ];
  return {
    publishedCount: published.length,
    draftCount: detail.questions.filter((question) => question.status === 'draft').length,
    archivedCount: detail.questions.filter((question) => question.status === 'archived').length,
    answerCounts,
    topTags: Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
    missing: Array.from(new Set(missing)).slice(0, 8),
    errors,
    warnings
  };
}

export function AdminSpecialPracticePage({
  currentUser,
  onBackAudit,
  onGoToContent,
  onGoToSchools,
  onGoToScholarships,
  onGoToMockExams,
  onGoToUsers,
  onGoToAuth
}: AdminSpecialPracticePageProps) {
  const { locale } = useI18n();
  const copy = selectAdminCopy(locale, ADMIN_SPECIAL_COPY);
  const interactionCopy = {
    topicList: adminText(locale, { zh: '专项目录', en: 'the special practice list', vi: 'danh sách luyện tập chuyên đề' }),
    topicDetail: adminText(locale, { zh: '专项详情', en: 'the special practice detail', vi: 'chi tiết chuyên đề' }),
    loadingDetails: adminText(locale, { zh: '正在读取详情', en: 'Loading details', vi: 'Đang tải chi tiết' }),
    loadingDetailsBody: adminText(locale, { zh: '正在读取当前专项练习，完成后会更新右侧编辑区。', en: 'The selected special practice topic is loading.', vi: 'Đang tải chuyên đề đã chọn; khu vực chỉnh sửa sẽ sớm được cập nhật.' }),
    workflowLabel: adminText(locale, { zh: '专项练习发布流程', en: 'Special practice publishing workflow', vi: 'Quy trình xuất bản luyện tập chuyên đề' }),
    selectTopic: adminText(locale, { zh: '选择专项', en: 'Select topic', vi: 'Chọn chuyên đề' }),
    selectTopicDetail: adminText(locale, { zh: '已有专项或新草稿', en: 'Existing or new draft', vi: 'Chuyên đề hiện có hoặc bản nháp mới' }),
    editContent: adminText(locale, { zh: '编辑内容', en: 'Edit content', vi: 'Chỉnh sửa nội dung' }),
    editContentDetail: adminText(locale, { zh: '专项信息与题目', en: 'Topic and questions', vi: 'Thông tin chuyên đề và câu hỏi' }),
    readiness: adminText(locale, { zh: '学生可用性检查', en: 'Student readiness', vi: 'Kiểm tra khả dụng cho học sinh' }),
    readinessDetail: adminText(locale, { zh: '题量与质量门槛', en: 'Inventory and quality', vi: 'Số lượng và chất lượng câu hỏi' }),
    publish: adminText(locale, { zh: '发布上线', en: 'Publish', vi: 'Xuất bản' }),
    publishDetail: adminText(locale, { zh: '进入学生练习池', en: 'Available to students', vi: 'Đưa vào kho luyện tập của học sinh' }),
    publishTitle: adminText(locale, { zh: '确认发布这个专项练习？', en: 'Publish this special practice topic?', vi: 'Xuất bản chuyên đề luyện tập này?' }),
    archiveTopicTitle: adminText(locale, { zh: '确认归档这个专项练习？', en: 'Archive this special practice topic?', vi: 'Lưu trữ chuyên đề luyện tập này?' }),
    archiveQuestionTitle: adminText(locale, { zh: '确认下架这道题？', en: 'Archive this question?', vi: 'Lưu trữ câu hỏi này?' }),
    publishDescription: adminText(locale, { zh: '必须先通过学生可用性检查；发布后该专项将进入学生练习池。', en: 'Student-readiness checks must pass. After publishing, the topic enters the student practice pool.', vi: 'Chuyên đề phải vượt qua kiểm tra khả dụng. Sau khi xuất bản, chuyên đề sẽ vào kho luyện tập của học sinh.' }),
    archiveDescription: adminText(locale, { zh: '该操作会将内容移出学生练习流程，已有练习记录仍会保留。', en: 'This action removes the content from the student practice flow. Existing session records are preserved.', vi: 'Thao tác này gỡ nội dung khỏi luồng luyện tập nhưng vẫn giữ các phiên hiện có.' }),
    confirmPublish: adminText(locale, { zh: '确认发布', en: 'Publish', vi: 'Xuất bản' }),
    confirmArchive: adminText(locale, { zh: '确认归档', en: 'Archive', vi: 'Lưu trữ' })
  };
  const [items, setItems] = useState<AdminSpecialPracticeTopic[]>([]);
  const [detail, setDetail] = useState<AdminSpecialPracticeTopicDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [topicDraft, setTopicDraft] = useState<Partial<AdminSpecialPracticeTopic>>({});
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestion(1, copy.questionDifficultyOptions[0]));
  const [jsonText, setJsonText] = useState(JSON.stringify(createSampleImport(locale), null, 2));
  const [importPreview, setImportPreview] = useState<AdminSpecialPracticeImportValidation | null>(null);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState<SpecialPracticeBusyAction | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<'publish-topic' | 'archive-topic' | 'archive-question' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const detailRequestRef = useRef(0);
  const isBusy = busyAction !== null;
  const isActionBusy = (action: SpecialPracticeBusyAction) => busyAction === action;
  const busyLabel = (action: SpecialPracticeBusyAction, label: string) => {
    if (!isActionBusy(action)) return label;
    return adminText(locale, { zh: `${label}中`, en: `${label}...`, vi: `${label}...` });
  };
  const busyClass = (action: SpecialPracticeBusyAction) => isActionBusy(action) ? 'admin-action-loading' : undefined;

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    void loadTopics();
  }, [currentUser?.role]);

  useEffect(() => {
    if (!selectedId || currentUser?.role !== 'admin') return;
    void loadDetail(selectedId);
  }, [selectedId, currentUser?.role]);

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.status === 'published').length,
    draft: items.filter((item) => item.status === 'draft').length,
    questions: items.reduce((sum, item) => sum + item.questionTotal, 0)
  }), [items]);
  const topicPreview = useMemo(() => buildTopicPreview(detail, copy), [detail, copy]);

  async function loadTopics(nextSelectedId?: number, options: PostWriteRefreshOptions = {}) {
    if (!options.afterWriteAction) setError('');
    try {
      const response = await getAdminSpecialPracticeTopics();
      setItems(response.items);
      setSelectedId(nextSelectedId ?? selectedId ?? response.items[0]?.id ?? null);
    } catch (nextError) {
      const message = compactError(nextError, copy.fallbackError, locale);
      if (options.afterWriteAction && options.refreshTarget) {
        setError((current) => appendRefreshWarning(current, options.afterWriteAction!, options.refreshTarget!, message, locale));
      } else {
        setError(message);
      }
    }
  }

  async function loadDetail(id: number, options: PostWriteRefreshOptions = {}) {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setIsLoadingDetail(true);
    setDetail(null);
    if (!options.afterWriteAction) setError('');
    try {
      const response = await getAdminSpecialPracticeTopic(id);
      if (detailRequestRef.current !== requestId) return;
      setDetail(response);
      setTopicDraft(response.topic);
      setQuestionDraft(response.questions[0] ?? emptyQuestion(response.questions.length + 1, copy.questionDifficultyOptions[0]));
    } catch (nextError) {
      if (detailRequestRef.current !== requestId) return;
      const message = compactError(nextError, copy.fallbackError, locale);
      if (options.afterWriteAction && options.refreshTarget) {
        setError((current) => appendRefreshWarning(current, options.afterWriteAction!, options.refreshTarget!, message, locale));
      } else {
        setError(message);
      }
    } finally {
      if (detailRequestRef.current === requestId) setIsLoadingDetail(false);
    }
  }

  function updateTopic<K extends keyof AdminSpecialPracticeTopic>(key: K, value: AdminSpecialPracticeTopic[K]) {
    setTopicDraft((current) => ({ ...current, [key]: value }));
  }

  function updateQuestion<K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) {
    setQuestionDraft((current) => ({ ...current, [key]: value }));
  }

  function updateOption(id: string, text: string) {
    setQuestionDraft((current) => ({
      ...current,
      options: current.options.map((option) => option.id === id ? { ...option, text } : option)
    }));
  }

  async function createTopic() {
    setBusyAction('create-topic');
    setError('');
    try {
      const created = await createAdminSpecialPracticeTopic({
        subject: (topicDraft.subject ?? 'math') as AdminSpecialPracticeTopic['subject'],
        module: String(topicDraft.module ?? '').trim(),
        slug: String(topicDraft.slug ?? '').trim(),
        title: String(topicDraft.title ?? '').trim(),
        description: String(topicDraft.description ?? '').trim(),
        overview: String(topicDraft.overview ?? '').trim(),
        focusItems: topicDraft.focusItems ?? [],
        studyAdvice: String(topicDraft.studyAdvice ?? '').trim(),
        difficultyLabel: String(topicDraft.difficultyLabel ?? '').trim(),
        frequencyLabel: String(topicDraft.frequencyLabel ?? '').trim(),
        relatedResources: topicDraft.relatedResources ?? [],
        relatedVisualizerSlug: String(topicDraft.relatedVisualizerSlug ?? '').trim(),
        estimatedMinutes: Number(topicDraft.estimatedMinutes ?? 20),
        questionCount: Number(topicDraft.questionCount ?? 10),
        sortOrder: Number(topicDraft.sortOrder ?? 0),
        status: 'draft'
      });
      setFeedback(copy.createdTopic);
      setIsCreatingTopic(false);
      await loadTopics(created.id, {
        afterWriteAction: trimActionMessage(copy.createdTopic),
        refreshTarget: interactionCopy.topicList
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function saveTopic() {
    if (!detail) return;
    setBusyAction('save-topic');
    setError('');
    const topicId = detail.topic.id;
    try {
      await updateAdminSpecialPracticeTopic(topicId, { ...topicDraft, expectedVersion: detail.topic.version });
      setFeedback(copy.savedTopic);
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
      setBusyAction(null);
      return;
    }

    try {
      const action = trimActionMessage(copy.savedTopic);
      await loadTopics(topicId, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicList
      });
      await loadDetail(topicId, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicDetail
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function publishTopic() {
    if (!detail) return;
    setBusyAction('publish-topic');
    setError('');
    const topicId = detail.topic.id;
    try {
      await publishAdminSpecialPracticeTopic(topicId, detail.topic.version);
      setFeedback(copy.publishedTopic);
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
      setBusyAction(null);
      return;
    }

    try {
      const action = trimActionMessage(copy.publishedTopic);
      await loadTopics(topicId, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicList
      });
      await loadDetail(topicId, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicDetail
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function archiveTopic() {
    if (!detail) return;
    setBusyAction('archive-topic');
    setError('');
    try {
      await archiveAdminSpecialPracticeTopic(detail.topic.id, detail.topic.version);
      setFeedback(copy.archivedTopic);
      const action = trimActionMessage(copy.archivedTopic);
      await loadTopics(detail.topic.id, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicList
      });
      await loadDetail(detail.topic.id, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicDetail
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function duplicateTopic() {
    if (!detail) return;
    setBusyAction('duplicate-topic');
    setError('');
    try {
      const copied = await duplicateAdminSpecialPracticeTopic(detail.topic.id);
      setFeedback(copy.duplicatedTopic);
      await loadTopics(copied.id, {
        afterWriteAction: trimActionMessage(copy.duplicatedTopic),
        refreshTarget: interactionCopy.topicList
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function saveQuestion() {
    if (!detail) return;
    setBusyAction('save-question');
    setError('');
    try {
      if (questionDraft.id) {
        await updateAdminSpecialPracticeQuestion(questionDraft.id, { ...questionDraft, expectedVersion: questionDraft.version });
        setFeedback(copy.savedQuestion);
      } else {
        await createAdminSpecialPracticeQuestion(detail.topic.id, questionDraft);
        setFeedback(copy.createdQuestion);
      }
      const action = trimActionMessage(questionDraft.id ? copy.savedQuestion : copy.createdQuestion);
      await loadDetail(detail.topic.id, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicDetail
      });
      await loadTopics(detail.topic.id, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicList
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function archiveQuestion() {
    if (!detail || !questionDraft.id) return;
    setBusyAction('archive-question');
    setError('');
    try {
      await archiveAdminSpecialPracticeQuestion(questionDraft.id, questionDraft.version);
      setFeedback(copy.archivedQuestion);
      const action = trimActionMessage(copy.archivedQuestion);
      await loadDetail(detail.topic.id, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicDetail
      });
      await loadTopics(detail.topic.id, {
        afterWriteAction: action,
        refreshTarget: interactionCopy.topicList
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmPendingAction() {
    const action = pendingConfirmation;
    if (!action) return;
    if (action === 'publish-topic') await publishTopic();
    if (action === 'archive-topic') await archiveTopic();
    if (action === 'archive-question') await archiveQuestion();
    setPendingConfirmation(null);
  }

  async function validateImport() {
    setBusyAction('validate-import');
    setError('');
    try {
      const payload = parseJsonText(jsonText, copy);
      const response = await validateAdminSpecialPracticeImport(payload);
      setImportPreview(response);
      setFeedback(response.ok ? copy.importValid : copy.importInvalid);
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function importJson() {
    setBusyAction('import-json');
    setError('');
    let importedSlug: string | undefined;
    let importFeedback = '';
    try {
      const payload = parseJsonText(jsonText, copy);
      const response = await importAdminSpecialPracticeTopics(payload);
      importFeedback = fillSpecialTemplate(copy.importDone, { created: response.created, updated: response.updated, questions: response.questionsUpserted });
      setFeedback(importFeedback);
      importedSlug = response.previews[0]?.slug;
      setImportPreview(null);
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
      setBusyAction(null);
      return;
    }

    try {
      const topicsResponse = await getAdminSpecialPracticeTopics();
      setItems(topicsResponse.items);
      const imported = topicsResponse.items.find((item) => item.slug === importedSlug);
      setSelectedId(imported?.id ?? selectedId ?? topicsResponse.items[0]?.id ?? null);
    } catch (nextError) {
      setError(appendRefreshWarning(
        '',
        trimActionMessage(importFeedback || copy.importDone),
        interactionCopy.topicList,
        compactError(nextError, copy.fallbackError, locale),
        locale
      ));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AdminPageShell
      current="specialPractice"
      currentUser={currentUser}
      kicker={copy.kicker}
      title={currentUser?.role === 'admin' ? copy.adminTitle : copy.guestTitle}
      body={copy.body}
      onGoToAuth={onGoToAuth}
      onGoToAudit={onBackAudit}
      onGoToContent={onGoToContent}
      onGoToSchools={onGoToSchools}
      onGoToScholarships={onGoToScholarships}
      onGoToMockExams={onGoToMockExams}
      onGoToUsers={onGoToUsers}
    >
      {currentUser?.role === 'admin' && feedback && <section className="admin-feedback success"><strong>{copy.successTitle}</strong><p>{feedback}</p></section>}
      {currentUser?.role === 'admin' && error && <section className="admin-feedback warning"><strong>{copy.warningTitle}</strong><p>{error}</p></section>}
      {currentUser?.role === 'admin' && isLoadingDetail && <section className="admin-feedback"><strong>{interactionCopy.loadingDetails}</strong><p>{interactionCopy.loadingDetailsBody}</p></section>}

      {currentUser?.role === 'admin' && (
        <section className="mock-admin-workbench">
          <AdminStatsStrip
            ariaLabel={copy.statsLabel}
            className="admin-workbench-stats"
            items={[
              { key: 'topics', label: copy.topicStat, value: stats.total },
              { key: 'published', label: copy.publishedStat, value: stats.published },
              { key: 'student-ready', label: copy.studentReadyStat, value: items.filter((item) => item.availability?.isAvailable).length },
              { key: 'drafts', label: copy.draftStat, value: stats.draft },
              { key: 'questions', label: copy.questionStat, value: stats.questions }
            ]}
          />

          <AdminWorkflowSteps
            ariaLabel={interactionCopy.workflowLabel}
            className="admin-workbench-flow"
            items={[
              { key: 'select', label: interactionCopy.selectTopic, detail: interactionCopy.selectTopicDetail, state: detail || isCreatingTopic ? 'complete' : 'active' },
              { key: 'edit', label: interactionCopy.editContent, detail: interactionCopy.editContentDetail, state: isCreatingTopic ? 'active' : detail ? 'complete' : 'upcoming' },
              { key: 'check', label: interactionCopy.readiness, detail: detail?.issues.length ? adminText(locale, { zh: `${detail.issues.length} 项待处理`, en: `${detail.issues.length} issue(s)`, vi: `${detail.issues.length} vấn đề` }) : interactionCopy.readinessDetail, state: detail?.issues.length ? 'warning' : detail?.topic.status === 'published' ? 'complete' : detail ? 'active' : 'upcoming' },
              { key: 'publish', label: interactionCopy.publish, detail: interactionCopy.publishDetail, state: detail?.topic.status === 'published' ? 'complete' : 'upcoming' }
            ]}
          />

          <aside className="mock-admin-sidebar">
            <div className="school-directory-head">
              <div>
                <p className="page-kicker">{copy.directoryKicker}</p>
                <h2>{fillSpecialTemplate(copy.topicCount, { count: items.length })}</h2>
              </div>
              <button type="button" onClick={() => {
                setIsCreatingTopic(true);
                setDetail(null);
                setTopicDraft({ subject: 'math', module: '', slug: '', title: '', description: '', estimatedMinutes: 20, questionCount: 10, sortOrder: items.length + 1, status: 'draft' });
              }}>{copy.new}</button>
            </div>
            <div className="mock-admin-paper-list">
              {items.map((item) => (
                <button key={item.id} type="button" className={selectedId === item.id ? 'active' : ''} onClick={() => {
                  setIsCreatingTopic(false);
                  setSelectedId(item.id);
                }}>
                  <span>{getSubjectLabel(item.subject, copy)} · {item.module} · {getStatusLabel(item.status, copy)}</span>
                  <strong>{item.title}</strong>
                  <small>{fillSpecialTemplate(copy.topicMeta, { questions: item.questionTotal, total: item.questionCount, sessions: item.sessionTotal })}</small>
                  <em className={`mock-admin-availability ${getAvailabilityStatus(item.availability)}`}>
                    {fillSpecialTemplate(copy.topicStudentAvailability, { label: getAvailabilityLabel(item.availability, copy) })}
                  </em>
                </button>
              ))}
            </div>
          </aside>

          <main className="mock-admin-main">
            {(detail || isCreatingTopic) && (
              <article className="school-editor-card">
                <div className="school-editor-head">
                  <div>
                    <p className="page-kicker">{isCreatingTopic ? copy.newTopicKicker : fillSpecialTemplate(copy.topicKicker, { id: detail?.topic.id ?? '' })}</p>
                    <h2>{topicDraft.title || copy.untitledTopic}</h2>
                  </div>
                  <div className="mock-admin-status-stack">
                    <StatusPill tone={topicDraft.status === 'published' ? 'success' : topicDraft.status === 'archived' ? 'muted' : 'warning'}>{getStatusLabel(String(topicDraft.status ?? 'draft'), copy)}</StatusPill>
                    {detail?.topic.availability && <StatusPill tone={getAvailabilityTone(detail.topic.availability)}>{getAvailabilityLabel(detail.topic.availability, copy)}</StatusPill>}
                  </div>
                </div>
                <div className="admin-form-grid">
                  <AdminFormField label={copy.subject}><select value={String(topicDraft.subject ?? 'math')} onChange={(event) => updateTopic('subject', event.target.value as AdminSpecialPracticeTopic['subject'])}><option value="math">{copy.subjects.math}</option><option value="physics">{copy.subjects.physics}</option><option value="chemistry">{copy.subjects.chemistry}</option></select></AdminFormField>
                  <AdminFormField label={copy.module}><input value={String(topicDraft.module ?? '')} onChange={(event) => updateTopic('module', event.target.value)} /></AdminFormField>
                  <AdminFormField label={copy.slug}><input value={String(topicDraft.slug ?? '')} onChange={(event) => updateTopic('slug', event.target.value)} /></AdminFormField>
                  <AdminFormField label={copy.title}><input value={String(topicDraft.title ?? '')} onChange={(event) => updateTopic('title', event.target.value)} /></AdminFormField>
                  <AdminFormField label={copy.status}><select value={String(topicDraft.status ?? 'draft')} onChange={(event) => updateTopic('status', event.target.value as AdminSpecialPracticeTopic['status'])}><option value="draft">{copy.statuses.draft}</option><option value="published">{copy.statuses.published}</option><option value="archived">{copy.statuses.archived}</option></select></AdminFormField>
                  <AdminFormField label={copy.questionCount}><input type="number" value={Number(topicDraft.questionCount ?? 10)} onChange={(event) => updateTopic('questionCount', Number(event.target.value))} /></AdminFormField>
                  <AdminFormField label={copy.estimatedMinutes}><input type="number" value={Number(topicDraft.estimatedMinutes ?? 20)} onChange={(event) => updateTopic('estimatedMinutes', Number(event.target.value))} /></AdminFormField>
                  <AdminFormField label={copy.sort}><input type="number" value={Number(topicDraft.sortOrder ?? 0)} onChange={(event) => updateTopic('sortOrder', Number(event.target.value))} /></AdminFormField>
                  <AdminFormField label={copy.frequency}><input value={String(topicDraft.frequencyLabel ?? '')} onChange={(event) => updateTopic('frequencyLabel', event.target.value)} placeholder={copy.frequencyPlaceholder} /></AdminFormField>
                  <AdminFormField label={copy.difficulty}><select value={String(topicDraft.difficultyLabel ?? '')} onChange={(event) => updateTopic('difficultyLabel', event.target.value)}><option value="">{copy.unset}</option>{optionsWithCurrent(copy.topicDifficultyOptions, topicDraft.difficultyLabel).map((option) => <option key={option} value={option}>{option}</option>)}</select></AdminFormField>
                  <AdminFormField label={copy.visualizerSlug}><input value={String(topicDraft.relatedVisualizerSlug ?? '')} onChange={(event) => updateTopic('relatedVisualizerSlug', event.target.value)} placeholder={copy.visualizerPlaceholder} /></AdminFormField>
                </div>
                <AdminFormField label={copy.description}><textarea value={String(topicDraft.description ?? '')} onChange={(event) => updateTopic('description', event.target.value)} /></AdminFormField>
                <AdminFormField label={copy.overview}><textarea value={String(topicDraft.overview ?? '')} onChange={(event) => updateTopic('overview', event.target.value)} /></AdminFormField>
                <AdminFormField label={copy.focusItems}><textarea value={tagsToText(topicDraft.focusItems ?? [])} onChange={(event) => updateTopic('focusItems', textToTags(event.target.value))} /></AdminFormField>
                <AdminFormField label={copy.studyAdvice}><textarea value={String(topicDraft.studyAdvice ?? '')} onChange={(event) => updateTopic('studyAdvice', event.target.value)} /></AdminFormField>
                <AdminFormField label={copy.relatedResources}><textarea value={resourcesToText(topicDraft.relatedResources)} onChange={(event) => updateTopic('relatedResources', textToResources(event.target.value))} /></AdminFormField>
                <div className="school-editor-actions admin-sticky-action-bar">
                  <div>
                    <strong>{detail?.issues.length ? copy.issueBad : copy.issueOk}</strong>
                    <span>{detail?.issues.length ? detail.issues.join('；') : copy.issueOkBody}</span>
                    {detail?.topic.availability && (
                      <span className={`mock-admin-availability-note ${getAvailabilityStatus(detail.topic.availability)}`}>
                        {getAvailabilityBody(detail.topic.availability, copy)}
                      </span>
                    )}
                    {detail?.topic.status === 'published' && detail.topic.sessionTotal > 0 && (
                      <span className="mock-admin-danger-note">{copy.existingSessionsWarning}</span>
                    )}
                  </div>
                  <InlineActions>
                    <button
                      type="button"
                      className={busyClass(isCreatingTopic ? 'create-topic' : 'save-topic')}
                      onClick={() => isCreatingTopic ? void createTopic() : void saveTopic()}
                      disabled={isBusy}
                    >
                      {isCreatingTopic ? busyLabel('create-topic', copy.createDraft) : busyLabel('save-topic', copy.saveTopic)}
                    </button>
                    {!isCreatingTopic && (
                      <GhostButton className={busyClass('publish-topic')} onClick={() => setPendingConfirmation('publish-topic')} disabled={isBusy || Boolean(detail?.issues.length)}>
                        {busyLabel('publish-topic', copy.publish)}
                      </GhostButton>
                    )}
                    {!isCreatingTopic && (
                      <GhostButton className={busyClass('duplicate-topic')} onClick={() => void duplicateTopic()} disabled={isBusy}>
                        {busyLabel('duplicate-topic', copy.duplicate)}
                      </GhostButton>
                    )}
                    {!isCreatingTopic && (
                      <GhostButton className={busyClass('archive-topic')} onClick={() => setPendingConfirmation('archive-topic')} disabled={isBusy}>
                        {busyLabel('archive-topic', copy.archive)}
                      </GhostButton>
                    )}
                  </InlineActions>
                </div>
                {topicPreview && (
                  <div className="mock-admin-preview-panel">
                    <div>
                      <span>{copy.preview.questionStatus}</span>
                      <strong>{topicPreview.publishedCount}/{Number(topicDraft.questionCount ?? detail?.topic.questionCount ?? 0)} published</strong>
                      <p>{fillSpecialTemplate(copy.preview.draftArchived, { draft: topicPreview.draftCount, archived: topicPreview.archivedCount })}</p>
                    </div>
                    <div>
                      <span>{copy.preview.answerDistribution}</span>
                      <strong>A {topicPreview.answerCounts.A} · B {topicPreview.answerCounts.B} · C {topicPreview.answerCounts.C} · D {topicPreview.answerCounts.D}</strong>
                      <p>{copy.preview.answerDistributionBody}</p>
                    </div>
                    <div>
                      <span>{copy.preview.tagDistribution}</span>
                      <strong>{topicPreview.topTags.length ? topicPreview.topTags.map(([tag, count]) => `${tag} ${count}`).join(' · ') : copy.preview.noTags}</strong>
                      <p>{copy.preview.tagDistributionBody}</p>
                    </div>
                    <div>
                      <span>{copy.preview.missingItems}</span>
                      <strong>{topicPreview.missing.length ? topicPreview.missing.join('，') : copy.preview.noMissing}</strong>
                      <p>{topicPreview.missing.length ? copy.preview.missingBody : copy.preview.noMissingBody}</p>
                    </div>
                    <div className={topicPreview.errors.length ? 'warning' : 'success'}>
                      <span>{copy.preview.releaseErrors}</span>
                      <strong>{topicPreview.errors.length ? topicPreview.errors.join('，') : copy.preview.noErrors}</strong>
                      <p>{topicPreview.errors.length ? copy.preview.errorBody : copy.preview.noErrorBody}</p>
                    </div>
                    <div className={topicPreview.warnings.length ? 'warning' : 'success'}>
                      <span>{copy.preview.contentWarnings}</span>
                      <strong>{topicPreview.warnings.length ? topicPreview.warnings.join('，') : copy.preview.noWarnings}</strong>
                      <p>{topicPreview.warnings.length ? copy.preview.warningBody : copy.preview.noWarningBody}</p>
                    </div>
                  </div>
                )}
              </article>
            )}

            {detail && (
              <article className="school-editor-card">
                <div className="school-editor-head">
                  <div><p className="page-kicker">{copy.questionManage}</p><h2>{fillSpecialTemplate(copy.questionCountTitle, { count: detail.questions.length })}</h2></div>
                  <button type="button" className="mock-admin-head-action" onClick={() => setQuestionDraft(emptyQuestion(detail.questions.length + 1, copy.questionDifficultyOptions[0]))}>{copy.addQuestion}</button>
                </div>
                <div className="mock-admin-question-grid">
                  <div className="mock-admin-question-list">
                    {detail.questions.map((question) => (
                      <button key={question.id} type="button" className={questionDraft.id === question.id ? 'active' : ''} onClick={() => setQuestionDraft(question)}>
                        <span>{question.orderNumber}</span>
                        <strong><MathContent text={question.prompt} /></strong>
                        <small>{question.correctAnswer} · {question.difficulty} · {getStatusLabel(question.status, copy)} · {question.knowledgeTags.join(' / ')}</small>
                      </button>
                    ))}
                  </div>
                  <div className="mock-admin-question-editor">
                    <div className="admin-form-grid">
                      <AdminFormField label={copy.questionNumber}><input type="number" value={questionDraft.orderNumber} onChange={(event) => updateQuestion('orderNumber', Number(event.target.value))} /></AdminFormField>
                      <AdminFormField label={copy.difficulty}><select value={questionDraft.difficulty} onChange={(event) => updateQuestion('difficulty', event.target.value)}>{optionsWithCurrent(copy.questionDifficultyOptions, questionDraft.difficulty).map((option) => <option key={option} value={option}>{option}</option>)}</select></AdminFormField>
                      <AdminFormField label={copy.correctAnswer}><select value={questionDraft.correctAnswer} onChange={(event) => updateQuestion('correctAnswer', event.target.value)}><option>A</option><option>B</option><option>C</option><option>D</option></select></AdminFormField>
                    </div>
                    <AdminFormField label={copy.prompt}><textarea value={questionDraft.prompt} onChange={(event) => updateQuestion('prompt', event.target.value)} /></AdminFormField>
                    <div className="admin-form-grid">
                      {questionDraft.options.map((option) => (
                        <AdminFormField key={option.id} label={fillSpecialTemplate(copy.option, { id: option.id })}><input value={option.text} onChange={(event) => updateOption(option.id, event.target.value)} /></AdminFormField>
                      ))}
                    </div>
                    <AdminFormField label={copy.explanation}><textarea value={questionDraft.explanation} onChange={(event) => updateQuestion('explanation', event.target.value)} /></AdminFormField>
                    <div className="admin-form-grid">
                      <AdminFormField label={copy.tags}><input value={tagsToText(questionDraft.knowledgeTags)} onChange={(event) => updateQuestion('knowledgeTags', textToTags(event.target.value))} /></AdminFormField>
                      <AdminFormField label={copy.status}><select value={questionDraft.status} onChange={(event) => updateQuestion('status', event.target.value as QuestionDraft['status'])}><option value="draft">{copy.statuses.draft}</option><option value="published">{copy.statuses.published}</option><option value="archived">{copy.statuses.archived}</option></select></AdminFormField>
                    </div>
                    <InlineActions>
                      <button type="button" className={busyClass('save-question')} onClick={() => void saveQuestion()} disabled={isBusy}>
                        {busyLabel('save-question', questionDraft.id ? copy.saveQuestion : copy.createQuestion)}
                      </button>
                      {questionDraft.id && (
                        <GhostButton className={busyClass('archive-question')} onClick={() => setPendingConfirmation('archive-question')} disabled={isBusy}>
                          {busyLabel('archive-question', copy.archiveQuestion)}
                        </GhostButton>
                      )}
                    </InlineActions>
                  </div>
                </div>
              </article>
            )}

            <details className="admin-advanced-section">
              <summary><strong>{copy.importTitle}</strong><span>{copy.importKicker}</span></summary>
              <article className="school-editor-card">
              <div className="school-editor-head">
                <div><p className="page-kicker">{copy.importKicker}</p><h2>{copy.importTitle}</h2></div>
                <InlineActions>
                  <GhostButton className={busyClass('validate-import')} onClick={() => void validateImport()} disabled={isBusy}>
                    {busyLabel('validate-import', copy.validateJson)}
                  </GhostButton>
                  <button type="button" className={busyClass('import-json')} onClick={() => void importJson()} disabled={isBusy || importPreview?.ok !== true}>
                    {busyLabel('import-json', copy.import)}
                  </button>
                </InlineActions>
              </div>
              <AdminFormField label={copy.jsonContent}><textarea className="mock-admin-json" value={jsonText} onChange={(event) => setJsonText(event.target.value)} /></AdminFormField>
              {importPreview && (
                <div className={`admin-feedback ${importPreview.ok ? 'success' : 'warning'}`}>
                  <strong>{importPreview.ok ? copy.validationPassed : copy.validationFailed}</strong>
                  {importPreview.errors.map((item) => <p key={item}>{item}</p>)}
                  {importPreview.warnings.map((item) => <p key={item}>{fillSpecialTemplate(copy.warningPrefix, { message: item })}</p>)}
                  {!importPreview.errors.length && importPreview.previews.map((item) => (
                    <p key={item.slug}>
                      {fillSpecialTemplate(copy.previewLine, { slug: item.slug, action: item.action === 'create-draft' ? copy.previewCreate : copy.previewUpdate, questions: item.questionCount })}
                      {item.existingStatus ? fillSpecialTemplate(copy.previewStatus, { status: getStatusLabel(item.existingStatus, copy) }) : ''}
                      {item.existingSessions ? fillSpecialTemplate(copy.previewSessions, { sessions: item.existingSessions }) : ''}
                    </p>
                  ))}
                </div>
              )}
              </article>
            </details>
          </main>
        </section>
      )}
      {pendingConfirmation && (
        <ConfirmDialog
          title={pendingConfirmation === 'publish-topic'
            ? interactionCopy.publishTitle
            : pendingConfirmation === 'archive-topic'
              ? interactionCopy.archiveTopicTitle
              : interactionCopy.archiveQuestionTitle}
          body={pendingConfirmation === 'publish-topic'
            ? interactionCopy.publishDescription
            : interactionCopy.archiveDescription}
          confirmLabel={pendingConfirmation === 'publish-topic' ? interactionCopy.confirmPublish : interactionCopy.confirmArchive}
          tone={pendingConfirmation === 'publish-topic' ? 'neutral' : 'danger'}
          isBusy={isBusy}
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => void confirmPendingAction()}
        />
      )}
    </AdminPageShell>
  );
}
