import { useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import { AdminStatsStrip } from '../components/admin/AdminWorkbench';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminFormField, GhostButton, InlineActions, SurfaceCard } from '../components/UiPrimitives';
import { CSCA_EXAM_BLOCK_KEY, mergeCscaExamScheduleFromBlocks, type CscaExamFee, type CscaExamSession, type CscaExamSubject } from '../content/csca-exam';
import { HOME_COPY } from '../content/public-site';
import { useI18n } from '../i18n/useI18n';
import {
  archiveAdminContentBlock,
  createAdminContentBlock,
  getAdminContentBlocks,
  publishAdminContentBlock,
  updateAdminContentBlock,
  type AdminContentBlock,
  type User
} from '../lib/api';
import { ApiError } from '../lib/request';
import { subjectVocabularyConfig, vocabularyDefinitionText, type SubjectVocabularyItem, type VocabularySubject } from '../lib/subject-vocabulary';

type PendingContentConfirm =
  | { type: 'publish'; item: AdminContentBlock }
  | { type: 'archive'; item: AdminContentBlock }
  | { type: 'switch'; nextKey: string }
  | null;

type ContentStatusFilter = 'all' | 'published' | 'draft' | 'archived' | 'dirty';
type ContentGroupKey = 'home' | 'subject' | 'system';
type ContentLocale = 'zh-CN' | 'en';
type VocabularyEditableField = 'term' | 'translation' | 'definition' | 'pinyin' | 'module' | 'tags' | 'level' | 'frequency' | 'relatedPath';

const SUBJECT_VOCABULARY_KEY_PREFIX = 'csca.subject-vocabulary.';
const VOCABULARY_SUBJECTS: VocabularySubject[] = ['math', 'physics', 'chemistry'];

const ADMIN_CONTENT_COPY = {
  zh: {
    locales: {
      'zh-CN': { label: 'CN 中文', note: '默认内容' },
      en: { label: 'GB English', note: '英文翻译' }
    },
    statuses: { published: '已发布', draft: '草稿', archived: '已归档', dirty: '未保存', all: '全部' },
    loadFailed: '内容块暂时无法加载。',
    saveFailed: '保存失败。',
    createFailed: '创建失败。',
    copyFailed: '复制失败。',
    publishFailed: '发布失败。',
    archiveFailed: '归档失败。',
    saved: '已保存 {key}。',
    created: '已创建 {key}。',
    copied: '已从中文复制 {count} 个内容块为草稿。',
    noCopyNeeded: '当前语言没有缺少可复制的中文内容块。',
    published: '已发布 {key}。',
    archived: '已归档 {key}。',
    kicker: '后台内容',
    adminTitle: '管理 CSCA 首页、考试信息和科目内容。',
    guestTitle: '内容管理',
    adminBody: '这里维护公开首页、考试安排和科目词汇。内容范围已收敛到 CSCA 模考、科目训练、真题、错题复盘、AI 反馈和机构额度。',
    scopeTitle: 'CSCA 内容范围',
    scopeItems: ['首页与备考路径', '考试时间与费用', '科目词汇与训练说明', '不再运营院校申请、奖学金和城市指南'],
    guestBody: '请先登录管理员账号后继续。',
    languageTitle: '内容语言',
    languageBody: '当前只编辑所选语言的内容块；缺少英文块时，前台会回退显示中文。发布前请确认文案不再出现院校申请、奖学金和城市指南。',
    switchBlocked: '请先保存或放弃当前改动后再切换语言。',
    copying: '复制中...',
    copyMissing: '从中文复制缺失 block',
    successTitle: '操作成功',
    dirtyTitle: '有未保存改动',
    dirtyBody: '{count} 个内容块还没有保存，切换前会提示确认。',
    subjectVocabularyTitle: '科目词汇管理',
    subjectVocabularyBody: '数学、物理、化学词汇在这里编辑；保存并发布后，前台对应科目词汇页会优先读取后台内容。',
    subjectVocabularyHint: '选择科目开始编辑',
    subjectNames: { math: '数学词汇', physics: '物理词汇', chemistry: '化学词汇' },
    loadingTitle: '正在读取内容块',
    loadingBody: '后台正在连接数据库内容块。',
    errorTitle: '内容块读取或保存失败',
    login: '去登录',
    statsLabel: '内容统计',
    blocksKicker: '内容块',
    chooseBlock: '选择一个 block 编辑',
    currentLocale: '当前语言：{label}',
    collapse: '收起',
    new: '新建',
    title: '标题',
    subtitle: '副标题 / Kicker',
    sort: '排序',
    creating: '创建中...',
    createDraft: '创建草稿',
    search: '搜索',
    searchPlaceholder: '搜索 key、标题、状态',
    homeGroup: '公开页面内容',
    homeGroupBody: '首页、考试安排和公开说明 block',
    subjectGroup: '科目学习内容',
    subjectGroupBody: '数学、物理、化学词汇等科目页内容',
    systemGroup: '系统 / 测试内容',
    systemGroupBody: '导入、smoke 或调试内容，默认折叠',
    noMatches: '没有匹配的内容块。',
    untitled: '未命名内容块',
    updatedAt: '最近更新：{date}',
    sortValue: '排序 {value}',
    dirtyNote: '当前内容块有本地改动，保存后才会写入后台。',
    nextExamDate: '下一次考试日期',
    verifiedAt: '最近核验日期',
    registrationStart: '报名开始（北京时间）',
    registrationEnd: '报名结束（北京时间）',
    regularSchedule: '常规安排',
    scoreRelease: '成绩公布',
    examMode: '考试形式',
    examLocation: '考点 / 方式',
    examDelivery: '作答安排',
    scoreRange: '分数范围',
    fees: '考试费用',
    label: '标签',
    amount: '金额 / 说明',
    sessions: '北京时间科目时间表',
    subject: '科目',
    starts: '开始',
    ends: '结束',
    examSubjects: '考试科目',
    language: '考试语言',
    duration: '时长（分钟）',
    questions: '题数',
    score: '分数',
    syllabus: '大纲要点（每行一条）',
    sourceLabel: '来源名称',
    sourceUrl: '来源链接',
    body: '正文',
    proofPills: '辅助短句（每行一条）',
    guidance: '使用说明',
    vocabularyItems: '词汇条目',
    addVocabularyItem: '新增词条',
    removeVocabularyItem: '删除',
    vocabularyTerm: '英文术语',
    vocabularyTranslation: '中文',
    vocabularyDefinition: '示例 / 解释',
    vocabularyPinyin: '拼音',
    vocabularyModule: '模块',
    vocabularyTags: '标签（每行一条）',
    vocabularyLevel: '难度',
    vocabularyFrequency: '频率',
    vocabularyRelatedPath: '关联路径',
    status: '状态',
    saving: '保存中...',
    save: '保存',
    publish: '发布',
    archive: '归档',
    previewKicker: '轻量预览',
    previewTitle: '公开页面近似效果',
    viewHome: '查看首页',
    emptyBody: '正文为空。',
    noEditableTitle: '没有可编辑的内容块',
    noEditableBody: '可以新建草稿 block，或调整搜索和筛选条件。',
    confirmSwitchTitle: '切换内容块前确认',
    confirmPublishTitle: '发布 {key}',
    confirmArchiveTitle: '归档 {key}',
    confirmSwitchBody: '当前内容块有未保存改动。切换后会放弃这些本地改动。',
    confirmPublishBody: '发布后，公开页面会优先读取这个内容块。请确认标题、正文、排序和 CSCA-only 范围都已经检查过。',
    confirmArchiveBody: '归档后，这个内容块不会出现在公开首页；历史内容仍保留在后台。',
    applyCscaDefault: '应用新版 CSCA 内容',
    confirmSwitch: '放弃改动并切换',
    confirmPublish: '确认发布',
    confirmArchive: '确认归档'
  },
  en: {
    locales: {
      'zh-CN': { label: 'CN Chinese', note: 'Default content' },
      en: { label: 'GB English', note: 'English translation' }
    },
    statuses: { published: 'Published', draft: 'Draft', archived: 'Archived', dirty: 'Unsaved', all: 'All' },
    loadFailed: 'Content blocks could not be loaded.',
    saveFailed: 'Save failed.',
    createFailed: 'Create failed.',
    copyFailed: 'Copy failed.',
    publishFailed: 'Publish failed.',
    archiveFailed: 'Archive failed.',
    saved: 'Saved {key}.',
    created: 'Created {key}.',
    copied: 'Copied {count} Chinese content blocks as drafts.',
    noCopyNeeded: 'This language has no missing Chinese content blocks to copy.',
    published: 'Published {key}.',
    archived: 'Archived {key}.',
    kicker: 'Admin Content',
    adminTitle: 'Manage CSCA homepage, exam, and subject content.',
    guestTitle: 'Content Management',
    adminBody: 'This workspace maintains the public homepage, exam schedule, and subject vocabulary. Content now focuses on CSCA mock exams, subject practice, past papers, mistake review, AI feedback, and organization credits.',
    scopeTitle: 'CSCA content scope',
    scopeItems: ['Homepage and prep path', 'Exam schedule and fees', 'Subject vocabulary and practice copy', 'No admissions, scholarships, or city guides'],
    guestBody: 'Sign in with an admin account to continue.',
    languageTitle: 'Content Language',
    languageBody: 'You are editing only the selected language. Missing English blocks can still fall back to Chinese. Before publishing, check that admissions, scholarships, and city-guide copy are not present.',
    switchBlocked: 'Save or discard current changes before switching languages.',
    copying: 'Copying...',
    copyMissing: 'Copy missing blocks from Chinese',
    successTitle: 'Success',
    dirtyTitle: 'Unsaved Changes',
    dirtyBody: '{count} content blocks have unsaved changes. You will be asked to confirm before switching.',
    subjectVocabularyTitle: 'Subject Vocabulary Management',
    subjectVocabularyBody: 'Edit math, physics, and chemistry vocabulary here. After saving and publishing, public subject vocabulary pages read the admin content first.',
    subjectVocabularyHint: 'Choose a subject to edit',
    subjectNames: { math: 'Math Vocabulary', physics: 'Physics Vocabulary', chemistry: 'Chemistry Vocabulary' },
    loadingTitle: 'Loading Content Blocks',
    loadingBody: 'Connecting to database-backed content blocks.',
    errorTitle: 'Content block operation failed',
    login: 'Sign in',
    statsLabel: 'Content statistics',
    blocksKicker: 'Content Blocks',
    chooseBlock: 'Choose a block to edit',
    currentLocale: 'Current language: {label}',
    collapse: 'Collapse',
    new: 'New',
    title: 'Title',
    subtitle: 'Subtitle / Kicker',
    sort: 'Sort',
    creating: 'Creating...',
    createDraft: 'Create draft',
    search: 'Search',
    searchPlaceholder: 'Search key, title, or status',
    homeGroup: 'Public Page Content',
    homeGroupBody: 'Homepage, exam schedule, and public copy blocks',
    subjectGroup: 'Subject Learning Content',
    subjectGroupBody: 'Subject pages such as math, physics, and chemistry vocabulary',
    systemGroup: 'System / Test Content',
    systemGroupBody: 'Import, smoke, or debug content, collapsed by default',
    noMatches: 'No matching content blocks.',
    untitled: 'Untitled content block',
    updatedAt: 'Last updated: {date}',
    sortValue: 'Sort {value}',
    dirtyNote: 'This block has local changes. Save before they are written to the backend.',
    nextExamDate: 'Next exam date',
    verifiedAt: 'Last verified date',
    registrationStart: 'Registration starts (Beijing time)',
    registrationEnd: 'Registration ends (Beijing time)',
    regularSchedule: 'Regular schedule',
    scoreRelease: 'Score release',
    examMode: 'Exam mode',
    examLocation: 'Test location / method',
    examDelivery: 'Answer delivery',
    scoreRange: 'Score range',
    fees: 'Exam Fees',
    label: 'Label',
    amount: 'Amount / description',
    sessions: 'Subject Schedule in Beijing Time',
    subject: 'Subject',
    starts: 'Starts',
    ends: 'Ends',
    examSubjects: 'Exam Subjects',
    language: 'Exam language',
    duration: 'Duration (minutes)',
    questions: 'Questions',
    score: 'Score',
    syllabus: 'Syllabus points (one per line)',
    sourceLabel: 'Source name',
    sourceUrl: 'Source URL',
    body: 'Body',
    proofPills: 'Supporting lines (one per line)',
    guidance: 'Usage guidance',
    vocabularyItems: 'Vocabulary Items',
    addVocabularyItem: 'Add term',
    removeVocabularyItem: 'Remove',
    vocabularyTerm: 'English term',
    vocabularyTranslation: 'Chinese',
    vocabularyDefinition: 'Example / explanation',
    vocabularyPinyin: 'Pinyin',
    vocabularyModule: 'Module',
    vocabularyTags: 'Tags (one per line)',
    vocabularyLevel: 'Level',
    vocabularyFrequency: 'Frequency',
    vocabularyRelatedPath: 'Related path',
    status: 'Status',
    saving: 'Saving...',
    save: 'Save',
    publish: 'Publish',
    archive: 'Archive',
    previewKicker: 'Light Preview',
    previewTitle: 'Approximate public page',
    viewHome: 'View homepage',
    emptyBody: 'Body is empty.',
    noEditableTitle: 'No editable content blocks',
    noEditableBody: 'Create a draft block or adjust search and filters.',
    confirmSwitchTitle: 'Confirm before switching blocks',
    confirmPublishTitle: 'Publish {key}',
    confirmArchiveTitle: 'Archive {key}',
    confirmSwitchBody: 'This content block has unsaved changes. Switching will discard local edits.',
    confirmPublishBody: 'After publishing, the public page will read this block first. Confirm title, body, sort order, and CSCA-only scope have been checked.',
    confirmArchiveBody: 'After archiving, this block will not appear on the public homepage. Historical content stays available in admin.',
    applyCscaDefault: 'Apply CSCA default copy',
    confirmSwitch: 'Discard changes and switch',
    confirmPublish: 'Confirm publish',
    confirmArchive: 'Confirm archive'
  }
} as const;

type AdminContentCopy = (typeof ADMIN_CONTENT_COPY)[keyof typeof ADMIN_CONTENT_COPY];

const CONTENT_LOCALE_VALUES: ContentLocale[] = ['zh-CN', 'en'];

const CSCA_HOME_BLOCK_PRESETS: Record<string, { title: string; subtitle: string; body: Record<string, unknown> }> = {
  'home.hero': {
    title: HOME_COPY.hero.title,
    subtitle: HOME_COPY.hero.kicker,
    body: {
      body: HOME_COPY.hero.body,
      proofPills: HOME_COPY.proofPills
    }
  },
  'home.requirements': {
    title: HOME_COPY.intro.title,
    subtitle: '训练路径',
    body: { body: HOME_COPY.intro.body }
  },
  'home.subjects': {
    title: HOME_COPY.subjects.title,
    subtitle: '科目学习',
    body: { body: HOME_COPY.subjects.body }
  },
  'home.prep': {
    title: HOME_COPY.prep.title,
    subtitle: '如何准备 CSCA',
    body: { body: HOME_COPY.prep.body }
  },
  'home.practice': {
    title: HOME_COPY.practice.title,
    subtitle: '练习路径',
    body: { body: HOME_COPY.practice.body }
  },
  'home.library': {
    title: HOME_COPY.library.title,
    subtitle: '学习记录',
    body: { body: HOME_COPY.library.body }
  },
  'home.closing': {
    title: HOME_COPY.closing,
    subtitle: '现在就可以开始',
    body: { body: HOME_COPY.closing }
  }
};

const LEGACY_HOME_CONTENT_MARKERS: Record<string, string[]> = {
  'home.hero': ['学校怎么要求', '真实学校案例', '按学校和专业看科目'],
  'home.requirements': ['大学不是统一一句', '校方招生页面'],
  'home.subjects': ['按项目逐项确认', '同一所学校'],
  'home.prep': ['从学校要求倒推', '目标项目'],
  'home.practice': ['目标学校、专业', '官方科目要求'],
  'home.library': ['真实学校案例', '院校库'],
  'home.closing': ['先看学校案例', '目标学校']
};

function toText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function toPills(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).join('\n') : '';
}

function fromPills(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function toLocalInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  }).format(date);
  return parts.replace(' ', 'T');
}

function fromBeijingInputValue(value: string) {
  return value ? `${value}:00+08:00` : '';
}

function createScheduleFromItem(item: AdminContentBlock) {
  return mergeCscaExamScheduleFromBlocks([{ key: item.key, title: item.title, subtitle: item.subtitle, body: item.body, updatedAt: item.updatedAt }]);
}

function isSystemBlock(item: AdminContentBlock) {
  const key = item.key.toLowerCase();
  const title = item.title.toLowerCase();
  return key.includes('smoke') || title.includes('smoke') || key.startsWith('test.') || key.startsWith('debug.');
}

function vocabularyContentKey(subject: VocabularySubject) {
  return `${SUBJECT_VOCABULARY_KEY_PREFIX}${subject}`;
}

function vocabularySubjectFromKey(key: string): VocabularySubject | null {
  const subject = key.replace(SUBJECT_VOCABULARY_KEY_PREFIX, '');
  return VOCABULARY_SUBJECTS.includes(subject as VocabularySubject) ? subject as VocabularySubject : null;
}

function isSubjectVocabularyBlock(item: AdminContentBlock) {
  return vocabularySubjectFromKey(item.key) !== null;
}

function vocabularyBodyFromConfig(subject: VocabularySubject) {
  const config = subjectVocabularyConfig[subject];
  return {
    title: config.title,
    subtitle: config.subtitle,
    guidance: config.guidance,
    items: config.items.map((item) => ({ ...item }))
  };
}

function vocabularySubjectLabel(subject: VocabularySubject, locale: ContentLocale) {
  if (locale !== 'en') return subjectVocabularyConfig[subject].title;
  if (subject === 'math') return 'Math Vocabulary';
  if (subject === 'physics') return 'Physics Vocabulary';
  return 'Chemistry Vocabulary';
}

function localizedVocabularyBodyFromConfig(subject: VocabularySubject, locale: ContentLocale) {
  if (locale !== 'en') return vocabularyBodyFromConfig(subject);
  const label = vocabularySubjectLabel(subject, locale);
  return {
    title: label,
    subtitle: `Review key CSCA ${subject} terms before practice.`,
    guidance: 'Search by English term, then use module and level filters to choose what to review next.',
    items: subjectVocabularyConfig[subject].items.map((item) => ({
      ...item,
      translation: '',
      definition: vocabularyDefinitionText(item, subject, 'en'),
      pinyin: item.pinyin,
      module: item.module.replace(/[\u3400-\u9fff]+/g, '').trim() || 'Core module',
      tags: []
    }))
  };
}

function createVirtualVocabularyBlock(subject: VocabularySubject, locale: ContentLocale): AdminContentBlock {
  const body = localizedVocabularyBodyFromConfig(subject, locale);
  return {
    id: `virtual-${vocabularyContentKey(subject)}-${locale}`,
    key: vocabularyContentKey(subject),
    locale,
    title: String(body.title),
    subtitle: String(body.subtitle),
    body,
    status: 'draft',
    sortOrder: 70 + VOCABULARY_SUBJECTS.indexOf(subject),
    updatedAt: new Date(0).toISOString(),
    version: 1
  };
}

function isVirtualContentBlock(item: AdminContentBlock) {
  return item.id.startsWith('virtual-');
}

function isLegacyHomeContentBlock(item: AdminContentBlock) {
  const markers = LEGACY_HOME_CONTENT_MARKERS[item.key];
  if (!markers) return false;
  const searchable = [item.title, item.subtitle ?? '', JSON.stringify(item.body ?? {})].join('\n');
  return markers.some((marker) => searchable.includes(marker));
}

function normalizeVocabularyItems(value: unknown): SubjectVocabularyItem[] {
  return Array.isArray(value)
    ? value.map((entry) => {
      const record = typeof entry === 'object' && entry !== null ? entry as Record<string, unknown> : {};
      return {
        term: typeof record.term === 'string' ? record.term : '',
        translation: typeof record.translation === 'string' ? record.translation : '',
        definition: typeof record.definition === 'string' ? record.definition : '',
        pinyin: typeof record.pinyin === 'string' ? record.pinyin : '',
        module: typeof record.module === 'string' ? record.module : '',
        tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
        level: ['基础', '高频', '易混', '中等'].includes(String(record.level)) ? String(record.level) as SubjectVocabularyItem['level'] : '基础',
        frequency: ['高频', '中频', '低频'].includes(String(record.frequency)) ? String(record.frequency) as SubjectVocabularyItem['frequency'] : '中频',
        relatedPath: typeof record.relatedPath === 'string' ? record.relatedPath : ''
      };
    })
    : [];
}

function vocabularyItemsFromBlock(item: AdminContentBlock) {
  return normalizeVocabularyItems(item.body.items);
}

function fillContentTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function getStatusLabel(status: string, copy: AdminContentCopy) {
  return copy.statuses[status as keyof typeof copy.statuses] ?? status;
}

function getVocabularyLevelLabel(value: string, locale: string) {
  if (locale !== 'en') return value;
  return { 基础: 'Basic', 高频: 'High-frequency', 易混: 'Easy to confuse', 中等: 'Intermediate' }[value as '基础' | '高频' | '易混' | '中等'] ?? value;
}

function getVocabularyFrequencyLabel(value: string, locale: string) {
  if (locale !== 'en') return value;
  return { 高频: 'High', 中频: 'Medium', 低频: 'Low' }[value as '高频' | '中频' | '低频'] ?? value;
}

function formatContentKey(key: string) {
  return key.replace(/\./g, ' / ');
}

function compactContentError(error: unknown, fallback: string, locale: string) {
  if (error instanceof ApiError) {
    const code = error.code ? `/${error.code}` : '';
    const message = `HTTP ${error.status}${code}: ${error.message || fallback}`;
    if (locale === 'en' && /[\u3400-\u9fff]/.test(message)) return `HTTP ${error.status}${code}: ${fallback}`;
    return message;
  }
  if (error instanceof Error) {
    const message = error.message;
    if (locale === 'en' && /[\u3400-\u9fff]/.test(message)) return fallback;
    return message;
  }
  return fallback;
}

function sortContentBlocks(a: AdminContentBlock, b: AdminContentBlock) {
  return a.sortOrder - b.sortOrder || a.key.localeCompare(b.key);
}

export function AdminContentPage({
  onBackAudit,
  onBackHome,
  onGoToCityGuides,
  onGoToTimelineWindows,
  onGoToSchools,
  onGoToScholarships,
  onGoToMockExams,
  onGoToSpecialPractice,
  onGoToUsers,
  onGoToAuth,
  currentUser
}: {
  onBackAudit: () => void;
  onBackHome: () => void;
  onGoToCityGuides?: () => void;
  onGoToTimelineWindows?: () => void;
  onGoToSchools: () => void;
  onGoToScholarships?: () => void;
  onGoToMockExams?: () => void;
  onGoToSpecialPractice?: () => void;
  onGoToUsers: () => void;
  onGoToAuth: () => void;
  currentUser?: User | null;
}) {
  const { locale } = useI18n();
  const copy = locale === 'en' ? ADMIN_CONTENT_COPY.en : ADMIN_CONTENT_COPY.zh;
  const [items, setItems] = useState<AdminContentBlock[]>([]);
  const [savedItems, setSavedItems] = useState<AdminContentBlock[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedLocale, setSelectedLocale] = useState<ContentLocale>(locale === 'en' ? 'en' : 'zh-CN');
  const [statusFilter, setStatusFilter] = useState<ContentStatusFilter>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<ContentGroupKey, boolean>>({ home: false, subject: false, system: true });
  const [dirtyByKey, setDirtyByKey] = useState<Record<string, boolean>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingContentConfirm>(null);
  const [newBlock, setNewBlock] = useState({
    key: '',
    title: '',
    subtitle: '',
    sortOrder: 100
  });

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setIsLoading(false);
      setError(null);
      setItems([]);
      setSavedItems([]);
      setSelectedKey(null);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    setError(null);

    void getAdminContentBlocks({ locale: selectedLocale })
      .then((response) => {
        if (!isCurrent) return;
        const existingKeys = new Set(response.items.map((item) => item.key));
        const virtualVocabularyBlocks = VOCABULARY_SUBJECTS
          .filter((subject) => !existingKeys.has(vocabularyContentKey(subject)))
          .map((subject) => createVirtualVocabularyBlock(subject, selectedLocale));
        const sorted = [...response.items, ...virtualVocabularyBlocks].sort(sortContentBlocks);
        setItems(sorted);
        setSavedItems(sorted.filter((item) => !isVirtualContentBlock(item)));
        setDirtyByKey({});
        setSelectedKey((current) => current && sorted.some((item) => item.key === current) ? current : sorted.find(isSubjectVocabularyBlock)?.key ?? sorted.find((item) => !isSystemBlock(item))?.key ?? sorted[0]?.key ?? null);
      })
      .catch((nextError) => {
        if (!isCurrent) return;
        setError(compactContentError(nextError, copy.loadFailed, locale));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [copy.loadFailed, currentUser?.role, locale, selectedLocale]);

  const dirtyKeys = useMemo(() => Object.keys(dirtyByKey).filter((key) => dirtyByKey[key]), [dirtyByKey]);
  const selectedItem = items.find((item) => item.key === selectedKey) ?? null;
  const selectedSavedItem = savedItems.find((item) => item.key === selectedKey) ?? null;
  const selectedIsDirty = !!(selectedKey && dirtyByKey[selectedKey]);
  const selectedSchedule = selectedItem?.key === CSCA_EXAM_BLOCK_KEY ? createScheduleFromItem(selectedItem) : null;
  const selectedVocabularySubject = selectedItem ? vocabularySubjectFromKey(selectedItem.key) : null;
  const selectedVocabularyItems = selectedItem && selectedVocabularySubject ? vocabularyItemsFromBlock(selectedItem) : [];

  const stats = useMemo(() => ({
    all: items.length,
    published: items.filter((item) => item.status === 'published').length,
    draft: items.filter((item) => item.status === 'draft').length,
    archived: items.filter((item) => item.status === 'archived').length,
    dirty: dirtyKeys.length
  }), [dirtyKeys.length, items]);

  const groupedItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matches = (item: AdminContentBlock) => {
      const text = [item.key, item.title, item.subtitle, item.status].filter(Boolean).join(' ').toLowerCase();
      const matchesQuery = !keyword || text.includes(keyword);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'dirty' ? dirtyByKey[item.key] : item.status === statusFilter);
      return matchesQuery && matchesStatus;
    };
    const filtered = items.filter(matches);
    return {
      home: filtered.filter((item) => !isSystemBlock(item) && !isSubjectVocabularyBlock(item)).sort(sortContentBlocks),
      subject: filtered.filter(isSubjectVocabularyBlock).sort(sortContentBlocks),
      system: filtered.filter(isSystemBlock).sort(sortContentBlocks)
    };
  }, [dirtyByKey, items, query, statusFilter]);

  useEffect(() => {
    if (!dirtyKeys.length) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyKeys.length]);

  function updateItem(key: string, updater: (item: AdminContentBlock) => AdminContentBlock) {
    setItems((current) => current.map((item) => (item.key === key ? updater(item) : item)));
    setDirtyByKey((current) => ({ ...current, [key]: true }));
    setFeedback(null);
  }

  function restoreItem(key: string) {
    const saved = savedItems.find((item) => item.key === key);
    if (!saved) return;
    setItems((current) => current.map((item) => (item.key === key ? saved : item)));
    setDirtyByKey((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function selectItem(nextKey: string) {
    if (nextKey === selectedKey) return;
    if (selectedKey && dirtyByKey[selectedKey]) {
      setPendingConfirm({ type: 'switch', nextKey });
      return;
    }
    setSelectedKey(nextKey);
  }

  function selectSubjectVocabulary(subject: VocabularySubject) {
    setQuery('');
    setStatusFilter('all');
    setCollapsedGroups((current) => ({ ...current, subject: false }));
    selectItem(vocabularyContentKey(subject));
  }

  function updateScheduleBody(updater: (schedule: ReturnType<typeof createScheduleFromItem>) => ReturnType<typeof createScheduleFromItem>) {
    if (!selectedItem || selectedItem.key !== CSCA_EXAM_BLOCK_KEY) return;
    updateItem(selectedItem.key, (current) => {
      const next = updater(createScheduleFromItem(current));
      return {
        ...current,
        title: next.title,
        subtitle: next.subtitle,
        body: {
          nextExamDate: next.nextExamDate,
          registrationWindow: next.registrationWindow,
          regularScheduleText: next.regularScheduleText,
          scoreReleaseText: next.scoreReleaseText,
          examFormat: next.examFormat,
          fees: next.fees,
          subjects: next.subjects,
          sessions: next.sessions,
          sourceUrl: next.sourceUrl,
          sourceLabel: next.sourceLabel,
          lastVerifiedAt: next.lastVerifiedAt
        }
      };
    });
  }

  function updateScheduleFee(index: number, patch: Partial<CscaExamFee>) {
    updateScheduleBody((schedule) => ({
      ...schedule,
      fees: schedule.fees.map((fee, feeIndex) => feeIndex === index ? { ...fee, ...patch } : fee)
    }));
  }

  function updateScheduleSubject(index: number, patch: Partial<CscaExamSubject>) {
    updateScheduleBody((schedule) => ({
      ...schedule,
      subjects: schedule.subjects.map((subject, subjectIndex) => subjectIndex === index ? { ...subject, ...patch } : subject)
    }));
  }

  function updateScheduleSession(index: number, patch: Partial<CscaExamSession>) {
    updateScheduleBody((schedule) => ({
      ...schedule,
      sessions: schedule.sessions.map((session, sessionIndex) => sessionIndex === index ? { ...session, ...patch } : session)
    }));
  }

  function updateVocabularyBody(key: string, updater: (items: SubjectVocabularyItem[]) => SubjectVocabularyItem[]) {
    updateItem(key, (current) => ({
      ...current,
      body: {
        ...current.body,
        items: updater(vocabularyItemsFromBlock(current))
      }
    }));
  }

  function updateVocabularyItem(key: string, index: number, field: VocabularyEditableField, value: string) {
    updateVocabularyBody(key, (items) => items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === 'tags') return { ...item, tags: fromPills(value) };
      return { ...item, [field]: value };
    }));
  }

  function addVocabularyItem(key: string) {
    updateVocabularyBody(key, (items) => [
      ...items,
      {
        term: '',
        translation: '',
        definition: '',
        pinyin: '',
        module: '',
        tags: [],
        level: '基础',
        frequency: '中频',
        relatedPath: ''
      }
    ]);
  }

  function removeVocabularyItem(key: string, index: number) {
    updateVocabularyBody(key, (items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  function confirmSwitch(nextKey: string) {
    if (selectedKey) restoreItem(selectedKey);
    setPendingConfirm(null);
    setSelectedKey(nextKey);
  }

  async function saveItem(item: AdminContentBlock) {
    setSavingKey(item.key);
    setError(null);
    setFeedback(null);
    try {
      const next = isVirtualContentBlock(item)
        ? await createAdminContentBlock({
          key: item.key,
          locale: selectedLocale,
          title: item.title,
          subtitle: item.subtitle,
          body: item.body,
          status: item.status,
          sortOrder: item.sortOrder
        })
        : await updateAdminContentBlock(item.key, {
          title: item.title,
          subtitle: item.subtitle,
          body: item.body,
          status: item.status,
          sortOrder: item.sortOrder,
          expectedVersion: item.version
        }, { locale: selectedLocale });
      setItems((current) => current.map((entry) => (entry.key === item.key ? next : entry)).sort(sortContentBlocks));
      setSavedItems((current) => {
        const withoutCurrent = current.filter((entry) => entry.key !== item.key);
        return [...withoutCurrent, next].sort(sortContentBlocks);
      });
      setDirtyByKey((current) => {
        const updated = { ...current };
        delete updated[item.key];
        return updated;
      });
      setFeedback(fillContentTemplate(copy.saved, { key: item.key }));
    } catch (nextError) {
      setError(compactContentError(nextError, copy.saveFailed, locale));
    } finally {
      setSavingKey(null);
    }
  }

  async function createBlock() {
    setSavingKey('new');
    setError(null);
    setFeedback(null);
    try {
      const created = await createAdminContentBlock({
        key: newBlock.key,
        locale: selectedLocale,
        title: newBlock.title,
        subtitle: newBlock.subtitle,
        body: { body: '' },
        status: 'draft',
        sortOrder: newBlock.sortOrder
      });
      setItems((current) => [...current, created].sort(sortContentBlocks));
      setSavedItems((current) => [...current, created].sort(sortContentBlocks));
      setSelectedKey(created.key);
      setNewBlock({ key: '', title: '', subtitle: '', sortOrder: 100 });
      setIsCreateOpen(false);
      setFeedback(fillContentTemplate(copy.created, { key: created.key }));
    } catch (nextError) {
      setError(compactContentError(nextError, copy.createFailed, locale));
    } finally {
      setSavingKey(null);
    }
  }

  async function copyChineseBlocksToLocale() {
    if (selectedLocale === 'zh-CN') return;
    setSavingKey('copy-locale');
    setError(null);
    setFeedback(null);
    try {
      const source = await getAdminContentBlocks({ locale: 'zh-CN' });
      const existingKeys = new Set(items.map((item) => item.key));
      const candidates = source.items.filter((item) => !existingKeys.has(item.key) && !isSystemBlock(item));
      const results = await Promise.allSettled(candidates.map((item) => createAdminContentBlock({
        key: item.key,
        locale: selectedLocale,
        title: item.title,
        subtitle: item.subtitle,
        body: item.body,
        status: 'draft',
        sortOrder: item.sortOrder
      })));
      const created = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      const failures = results.flatMap((result, index) => result.status === 'rejected'
        ? [`${candidates[index]?.key ?? index + 1}: ${compactContentError(result.reason, copy.copyFailed, locale)}`]
        : []);
      const nextItems = [...items, ...created].sort(sortContentBlocks);
      setItems(nextItems);
      setSavedItems(nextItems);
      setSelectedKey((current) => current ?? created[0]?.key ?? null);
      if (failures.length) {
        setError(locale === 'en'
          ? `Copied ${created.length} block(s), ${failures.length} failed: ${failures.slice(0, 3).join('; ')}`
          : `已复制 ${created.length} 个内容块，${failures.length} 个失败：${failures.slice(0, 3).join('；')}`);
        if (created.length) setFeedback(fillContentTemplate(copy.copied, { count: created.length }));
      } else {
        setFeedback(created.length ? fillContentTemplate(copy.copied, { count: created.length }) : copy.noCopyNeeded);
      }
    } catch (nextError) {
      setError(compactContentError(nextError, copy.copyFailed, locale));
    } finally {
      setSavingKey(null);
    }
  }

  async function publishBlock(item: AdminContentBlock) {
    setPendingConfirm(null);
    setSavingKey(item.key);
    setError(null);
    setFeedback(null);
    try {
      const next = await publishAdminContentBlock(item.key, item.version, { locale: selectedLocale });
      setItems((current) => current.map((entry) => (entry.key === item.key ? next : entry)));
      setSavedItems((current) => current.map((entry) => (entry.key === item.key ? next : entry)));
      setDirtyByKey((current) => {
        const updated = { ...current };
        delete updated[item.key];
        return updated;
      });
      setFeedback(fillContentTemplate(copy.published, { key: item.key }));
    } catch (nextError) {
      setError(compactContentError(nextError, copy.publishFailed, locale));
    } finally {
      setSavingKey(null);
    }
  }

  async function archiveBlock(item: AdminContentBlock) {
    setPendingConfirm(null);
    setSavingKey(item.key);
    setError(null);
    setFeedback(null);
    try {
      const next = await archiveAdminContentBlock(item.key, item.version, { locale: selectedLocale });
      setItems((current) => current.map((entry) => (entry.key === item.key ? next : entry)));
      setSavedItems((current) => current.map((entry) => (entry.key === item.key ? next : entry)));
      setDirtyByKey((current) => {
        const updated = { ...current };
        delete updated[item.key];
        return updated;
      });
      setFeedback(fillContentTemplate(copy.archived, { key: item.key }));
    } catch (nextError) {
      setError(compactContentError(nextError, copy.archiveFailed, locale));
    } finally {
      setSavingKey(null);
    }
  }

  function renderContentList(groupKey: ContentGroupKey, title: string, description: string, groupItems: AdminContentBlock[]) {
    const isCollapsed = collapsedGroups[groupKey];
    return (
      <section className="cms-block-group">
        <button
          type="button"
          className="cms-group-toggle"
          onClick={() => setCollapsedGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }))}
          aria-expanded={!isCollapsed}
        >
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <b>{groupItems.length}</b>
        </button>
        {!isCollapsed && (
          <div className="cms-block-list">
            {groupItems.map((item) => (
              <button
                type="button"
                key={item.key}
                className={[
                  'cms-block-list-item',
                  selectedKey === item.key ? 'active' : '',
                  dirtyByKey[item.key] ? 'dirty' : ''
                ].filter(Boolean).join(' ')}
                onClick={() => selectItem(item.key)}
              >
                <span>
                  <strong>{item.title || item.key}</strong>
                  <small>{formatContentKey(item.key)}</small>
                </span>
                <em>{dirtyByKey[item.key] ? copy.statuses.dirty : getStatusLabel(item.status, copy)}</em>
              </button>
            ))}
            {!groupItems.length && <p className="cms-empty-list">{copy.noMatches}</p>}
          </div>
        )}
      </section>
    );
  }

  const hasBlockingError = Boolean(error && !isLoading && items.length === 0);
  const hasInlineError = Boolean(error && !hasBlockingError);

  return (
    <AdminPageShell
      current="content"
      currentUser={currentUser}
      kicker={copy.kicker}
      title={currentUser?.role === 'admin' ? copy.adminTitle : copy.guestTitle}
      body={currentUser?.role === 'admin' ? copy.adminBody : copy.guestBody}
      heroAside={currentUser?.role === 'admin' && (
        <aside className="cms-scope-panel" aria-label={copy.scopeTitle}>
          <strong>{copy.scopeTitle}</strong>
          <ul>
            {copy.scopeItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </aside>
      )}
      onGoToAuth={onGoToAuth}
      onGoToAudit={onBackAudit}
      onGoToCityGuides={onGoToCityGuides}
      onGoToTimelineWindows={onGoToTimelineWindows}
      onGoToSchools={onGoToSchools}
      onGoToScholarships={onGoToScholarships}
      onGoToMockExams={onGoToMockExams}
      onGoToSpecialPractice={onGoToSpecialPractice}
      onGoToUsers={onGoToUsers}
    >
      {currentUser?.role === 'admin' && (
        <section className="admin-feedback">
          <strong>{copy.languageTitle}</strong>
          <p>{copy.languageBody}</p>
          <InlineActions>
            {CONTENT_LOCALE_VALUES.map((contentLocale) => (
              <button
                key={contentLocale}
                type="button"
                className={selectedLocale === contentLocale ? 'active' : ''}
                onClick={() => setSelectedLocale(contentLocale)}
                disabled={selectedLocale === contentLocale || dirtyKeys.length > 0}
                title={dirtyKeys.length > 0 ? copy.switchBlocked : copy.locales[contentLocale].note}
              >
                {copy.locales[contentLocale].label}
              </button>
            ))}
            {selectedLocale !== 'zh-CN' && (
              <button
                type="button"
                onClick={() => void copyChineseBlocksToLocale()}
                disabled={savingKey === 'copy-locale' || dirtyKeys.length > 0}
                title={dirtyKeys.length > 0 ? copy.switchBlocked : copy.copyMissing}
              >
                {savingKey === 'copy-locale' ? copy.copying : copy.copyMissing}
              </button>
            )}
          </InlineActions>
        </section>
      )}

      {currentUser?.role === 'admin' && !isLoading && !hasBlockingError && (
        <section className="admin-feedback cms-subject-vocabulary-entry">
          <div>
            <strong>{copy.subjectVocabularyTitle}</strong>
            <p>{copy.subjectVocabularyBody}</p>
          </div>
          <InlineActions aria-label={copy.subjectVocabularyHint}>
            {VOCABULARY_SUBJECTS.map((subject) => (
              <button
                key={subject}
                type="button"
                className={selectedKey === vocabularyContentKey(subject) ? 'active' : ''}
                onClick={() => selectSubjectVocabulary(subject)}
              >
                {copy.subjectNames[subject]}
              </button>
            ))}
          </InlineActions>
        </section>
      )}

      {currentUser?.role === 'admin' && feedback && <section className="admin-feedback success"><strong>{copy.successTitle}</strong><p>{feedback}</p></section>}
      {currentUser?.role === 'admin' && dirtyKeys.length > 0 && !feedback && <section className="admin-feedback"><strong>{copy.dirtyTitle}</strong><p>{fillContentTemplate(copy.dirtyBody, { count: dirtyKeys.length })}</p></section>}
      {currentUser?.role === 'admin' && isLoading && <section className="school-empty-state"><strong>{copy.loadingTitle}</strong><p>{copy.loadingBody}</p></section>}
      {currentUser?.role === 'admin' && hasInlineError && (
        <section className="admin-feedback">
          <strong>{copy.errorTitle}</strong>
          <p>{error}</p>
        </section>
      )}
      {currentUser?.role === 'admin' && hasBlockingError && (
        <section className="school-empty-state">
          <strong>{copy.errorTitle}</strong>
          <p>{error}</p>
          <InlineActions>
            <button type="button" onClick={onGoToAuth}>{copy.login}</button>
          </InlineActions>
        </section>
      )}

      {currentUser?.role === 'admin' && !isLoading && !hasBlockingError && (
        <section className="cms-workbench">
          <AdminStatsStrip<ContentStatusFilter>
            ariaLabel={copy.statsLabel}
            activeKey={statusFilter}
            className="admin-workbench-stats"
            items={[
              { key: 'all', label: copy.statuses.all, value: stats.all },
              { key: 'published', label: copy.statuses.published, value: stats.published },
              { key: 'draft', label: copy.statuses.draft, value: stats.draft },
              { key: 'archived', label: copy.statuses.archived, value: stats.archived },
              { key: 'dirty', label: copy.statuses.dirty, value: stats.dirty }
            ]}
            onSelect={setStatusFilter}
          />

          <aside className="cms-sidebar">
            <div className="cms-sidebar-head">
              <div>
                <p className="page-kicker">{copy.blocksKicker}</p>
                <h2>{copy.chooseBlock}</h2>
                <small>{fillContentTemplate(copy.currentLocale, { label: copy.locales[selectedLocale].label })}</small>
              </div>
              <button type="button" onClick={() => setIsCreateOpen((value) => !value)}>
                {isCreateOpen ? copy.collapse : copy.new}
              </button>
            </div>

            {isCreateOpen && (
              <section className="cms-create-panel">
                <AdminFormField label="Key">
                  <input value={newBlock.key} onChange={(event) => setNewBlock((current) => ({ ...current, key: event.target.value }))} />
                </AdminFormField>
                <AdminFormField label={copy.title}>
                  <input value={newBlock.title} onChange={(event) => setNewBlock((current) => ({ ...current, title: event.target.value }))} />
                </AdminFormField>
                <div className="admin-form-grid">
                  <AdminFormField label={copy.subtitle}>
                    <input value={newBlock.subtitle} onChange={(event) => setNewBlock((current) => ({ ...current, subtitle: event.target.value }))} />
                  </AdminFormField>
                  <AdminFormField label={copy.sort}>
                    <input type="number" value={newBlock.sortOrder} onChange={(event) => setNewBlock((current) => ({ ...current, sortOrder: Number(event.target.value) || 100 }))} />
                  </AdminFormField>
                </div>
                <button type="button" onClick={() => void createBlock()} disabled={savingKey === 'new' || !newBlock.key.trim() || !newBlock.title.trim()}>
                  {savingKey === 'new' ? copy.creating : copy.createDraft}
                </button>
              </section>
            )}

            <div className="cms-filter-panel">
              <AdminFormField label={copy.search}>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
              </AdminFormField>
            </div>

            {renderContentList('home', copy.homeGroup, copy.homeGroupBody, groupedItems.home)}
            {renderContentList('subject', copy.subjectGroup, copy.subjectGroupBody, groupedItems.subject)}
            {renderContentList('system', copy.systemGroup, copy.systemGroupBody, groupedItems.system)}
          </aside>

          <main className="cms-editor-panel">
            {selectedItem ? (
              <>
                <SurfaceCard as="section" className="cms-editor-card">
                  <div className="cms-editor-head">
                    <div>
                      <p className="page-kicker">{formatContentKey(selectedItem.key)}</p>
                      <h2>{selectedItem.title || copy.untitled}</h2>
                      <p>{fillContentTemplate(copy.updatedAt, { date: new Date(selectedSavedItem?.updatedAt ?? selectedItem.updatedAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN') })}</p>
                    </div>
                    <div className="cms-editor-status">
                      <span className={selectedIsDirty ? 'dirty' : ''}>{selectedIsDirty ? copy.statuses.dirty : getStatusLabel(selectedItem.status, copy)}</span>
                      <span>{fillContentTemplate(copy.sortValue, { value: selectedItem.sortOrder })}</span>
                    </div>
                  </div>

                  {selectedIsDirty && <p className="cms-dirty-note">{copy.dirtyNote}</p>}

                  {selectedSchedule ? (
                    <section className="cms-schedule-editor">
                      <div className="admin-form-grid">
                        <AdminFormField label={copy.title}>
                          <input value={selectedSchedule.title} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, title: event.target.value }))} />
                        </AdminFormField>
                        <AdminFormField label={copy.subtitle}>
                          <input value={selectedSchedule.subtitle} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, subtitle: event.target.value }))} />
                        </AdminFormField>
                      </div>

                      <div className="admin-form-grid">
                        <AdminFormField label={copy.nextExamDate}>
                          <input type="date" value={selectedSchedule.nextExamDate} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, nextExamDate: event.target.value }))} />
                        </AdminFormField>
                        <AdminFormField label={copy.verifiedAt}>
                          <input type="date" value={selectedSchedule.lastVerifiedAt} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, lastVerifiedAt: event.target.value }))} />
                        </AdminFormField>
                      </div>

                      <div className="admin-form-grid">
                        <AdminFormField label={copy.registrationStart}>
                          <input type="datetime-local" value={toLocalInputValue(selectedSchedule.registrationWindow.start)} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, registrationWindow: { ...schedule.registrationWindow, start: fromBeijingInputValue(event.target.value) } }))} />
                        </AdminFormField>
                        <AdminFormField label={copy.registrationEnd}>
                          <input type="datetime-local" value={toLocalInputValue(selectedSchedule.registrationWindow.end)} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, registrationWindow: { ...schedule.registrationWindow, end: fromBeijingInputValue(event.target.value) } }))} />
                        </AdminFormField>
                      </div>

                      <div className="admin-form-grid">
                        <AdminFormField label={copy.regularSchedule}>
                          <input value={selectedSchedule.regularScheduleText} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, regularScheduleText: event.target.value }))} />
                        </AdminFormField>
                        <AdminFormField label={copy.scoreRelease}>
                          <input value={selectedSchedule.scoreReleaseText} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, scoreReleaseText: event.target.value }))} />
                        </AdminFormField>
                      </div>

                      <div className="admin-form-grid">
                        {(['mode', 'location', 'delivery', 'scoreRange'] as const).map((field) => (
                          <AdminFormField key={field} label={field === 'mode' ? copy.examMode : field === 'location' ? copy.examLocation : field === 'delivery' ? copy.examDelivery : copy.scoreRange}>
                            <input value={selectedSchedule.examFormat[field]} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, examFormat: { ...schedule.examFormat, [field]: event.target.value } }))} />
                          </AdminFormField>
                        ))}
                      </div>

                      <section className="cms-array-editor">
                        <h3>{copy.fees}</h3>
                        {selectedSchedule.fees.map((fee, index) => (
                          <div key={`${fee.label}-${index}`} className="admin-form-grid">
                            <AdminFormField label={copy.label}>
                              <input value={fee.label} onChange={(event) => updateScheduleFee(index, { label: event.target.value })} />
                            </AdminFormField>
                            <AdminFormField label={copy.amount}>
                              <input value={fee.value} onChange={(event) => updateScheduleFee(index, { value: event.target.value })} />
                            </AdminFormField>
                          </div>
                        ))}
                      </section>

                      <section className="cms-array-editor">
                        <h3>{copy.sessions}</h3>
                        {selectedSchedule.sessions.map((session, index) => (
                          <div key={`${session.subject}-${index}`} className="admin-form-grid">
                            <AdminFormField label={copy.subject}>
                              <input value={session.subject} onChange={(event) => updateScheduleSession(index, { subject: event.target.value })} />
                            </AdminFormField>
                            <AdminFormField label={copy.starts}>
                              <input type="datetime-local" value={toLocalInputValue(session.startsAtBeijing)} onChange={(event) => updateScheduleSession(index, { startsAtBeijing: fromBeijingInputValue(event.target.value) })} />
                            </AdminFormField>
                            <AdminFormField label={copy.ends}>
                              <input type="datetime-local" value={toLocalInputValue(session.endsAtBeijing)} onChange={(event) => updateScheduleSession(index, { endsAtBeijing: fromBeijingInputValue(event.target.value) })} />
                            </AdminFormField>
                          </div>
                        ))}
                      </section>

                      <section className="cms-array-editor">
                        <h3>{copy.examSubjects}</h3>
                        {selectedSchedule.subjects.map((subject, index) => (
                          <div key={`${subject.name}-${index}`} className="cms-subject-editor">
                            <div className="admin-form-grid">
                              <AdminFormField label={copy.subject}>
                                <input value={subject.name} onChange={(event) => updateScheduleSubject(index, { name: event.target.value })} />
                              </AdminFormField>
                              <AdminFormField label={copy.language}>
                                <input value={subject.language} onChange={(event) => updateScheduleSubject(index, { language: event.target.value })} />
                              </AdminFormField>
                            </div>
                            <div className="admin-form-grid">
                              <AdminFormField label={copy.duration}>
                                <input type="number" value={subject.durationMinutes} onChange={(event) => updateScheduleSubject(index, { durationMinutes: Number(event.target.value) || 60 })} />
                              </AdminFormField>
                              <AdminFormField label={copy.questions}>
                                <input value={subject.questions} onChange={(event) => updateScheduleSubject(index, { questions: event.target.value })} />
                              </AdminFormField>
                              <AdminFormField label={copy.score}>
                                <input value={subject.scoreRange} onChange={(event) => updateScheduleSubject(index, { scoreRange: event.target.value })} />
                              </AdminFormField>
                            </div>
                            <AdminFormField label={copy.syllabus}>
                              <textarea value={subject.syllabusItems.join('\n')} onChange={(event) => updateScheduleSubject(index, { syllabusItems: fromPills(event.target.value) })} />
                            </AdminFormField>
                          </div>
                        ))}
                      </section>

                      <div className="admin-form-grid">
                        <AdminFormField label={copy.sourceLabel}>
                          <input value={selectedSchedule.sourceLabel} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, sourceLabel: event.target.value }))} />
                        </AdminFormField>
                        <AdminFormField label={copy.sourceUrl}>
                          <input value={selectedSchedule.sourceUrl} onChange={(event) => updateScheduleBody((schedule) => ({ ...schedule, sourceUrl: event.target.value }))} />
                        </AdminFormField>
                      </div>
                    </section>
                  ) : selectedVocabularySubject ? (
                    <section className="cms-schedule-editor">
                      <div className="admin-form-grid">
                        <AdminFormField label={copy.title}>
                          <input value={selectedItem.title} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, title: event.target.value, body: { ...current.body, title: event.target.value } }))} />
                        </AdminFormField>
                        <AdminFormField label={copy.subtitle}>
                          <input value={selectedItem.subtitle || ''} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, subtitle: event.target.value, body: { ...current.body, subtitle: event.target.value } }))} />
                        </AdminFormField>
                      </div>
                      <AdminFormField label={copy.guidance}>
                        <textarea value={toText(selectedItem.body.guidance)} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, body: { ...current.body, guidance: event.target.value } }))} />
                      </AdminFormField>

                      <section className="cms-array-editor">
                        <div className="cms-array-head">
                          <h3>{copy.vocabularyItems} · {selectedVocabularyItems.length}</h3>
                          <button type="button" onClick={() => addVocabularyItem(selectedItem.key)}>{copy.addVocabularyItem}</button>
                        </div>
                        {selectedVocabularyItems.map((item, index) => (
                          <div key={`${item.term}-${index}`} className="cms-subject-editor">
                            <div className="admin-form-grid">
                              <AdminFormField label={copy.vocabularyTerm}>
                                <input value={item.term} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'term', event.target.value)} />
                              </AdminFormField>
                              <AdminFormField label={copy.vocabularyTranslation}>
                                <input value={item.translation} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'translation', event.target.value)} />
                              </AdminFormField>
                              <AdminFormField label={copy.vocabularyPinyin}>
                                <input value={item.pinyin || ''} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'pinyin', event.target.value)} />
                              </AdminFormField>
                            </div>
                            <AdminFormField label={copy.vocabularyDefinition}>
                              <textarea value={item.definition} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'definition', event.target.value)} />
                            </AdminFormField>
                            <div className="admin-form-grid">
                              <AdminFormField label={copy.vocabularyModule}>
                                <input value={item.module} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'module', event.target.value)} />
                              </AdminFormField>
                              <AdminFormField label={copy.vocabularyLevel}>
                                <select value={item.level} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'level', event.target.value)}>
                                  {['基础', '高频', '易混', '中等'].map((value) => (
                                    <option key={value} value={value}>{getVocabularyLevelLabel(value, locale)}</option>
                                  ))}
                                </select>
                              </AdminFormField>
                              <AdminFormField label={copy.vocabularyFrequency}>
                                <select value={item.frequency} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'frequency', event.target.value)}>
                                  {['高频', '中频', '低频'].map((value) => (
                                    <option key={value} value={value}>{getVocabularyFrequencyLabel(value, locale)}</option>
                                  ))}
                                </select>
                              </AdminFormField>
                            </div>
                            <AdminFormField label={copy.vocabularyTags}>
                              <textarea value={item.tags.join('\n')} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'tags', event.target.value)} />
                            </AdminFormField>
                            <div className="admin-form-grid">
                              <AdminFormField label={copy.vocabularyRelatedPath}>
                                <input value={item.relatedPath} onChange={(event) => updateVocabularyItem(selectedItem.key, index, 'relatedPath', event.target.value)} />
                              </AdminFormField>
                              <div className="cms-row-actions">
                                <GhostButton onClick={() => removeVocabularyItem(selectedItem.key, index)}>{copy.removeVocabularyItem}</GhostButton>
                              </div>
                            </div>
                          </div>
                        ))}
                      </section>
                    </section>
                  ) : (
                    <>
                      <div className="admin-form-grid">
                        <AdminFormField label={copy.title}>
                          <input value={selectedItem.title} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, title: event.target.value }))} />
                        </AdminFormField>
                        <AdminFormField label={copy.subtitle}>
                          <input value={selectedItem.subtitle || ''} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, subtitle: event.target.value }))} />
                        </AdminFormField>
                      </div>

                      <AdminFormField label={copy.body}>
                        <textarea value={toText(selectedItem.body.body)} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, body: { ...current.body, body: event.target.value } }))} />
                      </AdminFormField>

                      {selectedItem.key === 'home.hero' && (
                        <AdminFormField label={copy.proofPills}>
                          <textarea value={toPills(selectedItem.body.proofPills)} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, body: { ...current.body, proofPills: fromPills(event.target.value) } }))} />
                        </AdminFormField>
                      )}
                    </>
                  )}

                  <div className="admin-form-grid">
                    <AdminFormField label={copy.status}>
                      <select value={selectedItem.status} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, status: event.target.value }))}>
                        <option value="published">published</option>
                        <option value="draft">draft</option>
                        <option value="archived">archived</option>
                      </select>
                    </AdminFormField>
                    <AdminFormField label={copy.sort}>
                      <input type="number" value={selectedItem.sortOrder} onChange={(event) => updateItem(selectedItem.key, (current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} />
                    </AdminFormField>
                  </div>

                  <div className="cms-editor-actions">
                    <button type="button" onClick={() => void saveItem(selectedItem)} disabled={savingKey === selectedItem.key || !selectedIsDirty}>
                      {savingKey === selectedItem.key ? copy.saving : copy.save}
                    </button>
                    {selectedLocale === 'zh-CN' && isLegacyHomeContentBlock(selectedItem) && <GhostButton onClick={() => applyCscaHomePreset(selectedItem.key)}>{copy.applyCscaDefault}</GhostButton>}
                    <GhostButton onClick={() => setPendingConfirm({ type: 'publish', item: selectedItem })} disabled={savingKey === selectedItem.key || selectedItem.status === 'published' || isVirtualContentBlock(selectedItem)}>
                      {copy.publish}
                    </GhostButton>
                    <GhostButton onClick={() => setPendingConfirm({ type: 'archive', item: selectedItem })} disabled={savingKey === selectedItem.key || selectedItem.status === 'archived' || isVirtualContentBlock(selectedItem)}>
                      {copy.archive}
                    </GhostButton>
                  </div>
                </SurfaceCard>

                <SurfaceCard as="section" className="cms-preview-card">
                  <div className="cms-preview-head">
                    <div>
                      <p className="page-kicker">{copy.previewKicker}</p>
                      <h2>{copy.previewTitle}</h2>
                    </div>
                    <GhostButton onClick={onBackHome}>{copy.viewHome}</GhostButton>
                  </div>
                  <div className="cms-preview-surface">
                    {selectedItem.subtitle && <p className="page-kicker">{selectedItem.subtitle}</p>}
                    <h3>{selectedItem.title || copy.untitled}</h3>
                    <p>{toText(selectedItem.body.body) || copy.emptyBody}</p>
                    {selectedItem.key === 'home.hero' && fromPills(toPills(selectedItem.body.proofPills)).length > 0 && (
                      <div className="cms-preview-pills">
                        {fromPills(toPills(selectedItem.body.proofPills)).map((pill) => <span key={pill}>{pill}</span>)}
                      </div>
                    )}
                  </div>
                </SurfaceCard>
              </>
            ) : (
              <section className="school-empty-state">
                <strong>{copy.noEditableTitle}</strong>
                <p>{copy.noEditableBody}</p>
              </section>
            )}
          </main>
        </section>
      )}

      {pendingConfirm && (
        <ConfirmDialog
          title={
            pendingConfirm.type === 'switch'
              ? copy.confirmSwitchTitle
              : pendingConfirm.type === 'publish'
                ? fillContentTemplate(copy.confirmPublishTitle, { key: pendingConfirm.item.key })
                : fillContentTemplate(copy.confirmArchiveTitle, { key: pendingConfirm.item.key })
          }
          body={
            pendingConfirm.type === 'switch'
              ? copy.confirmSwitchBody
              : pendingConfirm.type === 'publish'
                ? copy.confirmPublishBody
                : copy.confirmArchiveBody
          }
          confirmLabel={pendingConfirm.type === 'switch' ? copy.confirmSwitch : pendingConfirm.type === 'publish' ? copy.confirmPublish : copy.confirmArchive}
          tone={pendingConfirm.type === 'archive' || pendingConfirm.type === 'switch' ? 'danger' : 'neutral'}
          isBusy={pendingConfirm.type !== 'switch' && savingKey === pendingConfirm.item.key}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => {
            if (pendingConfirm.type === 'switch') {
              confirmSwitch(pendingConfirm.nextKey);
              return;
            }
            void (pendingConfirm.type === 'publish' ? publishBlock(pendingConfirm.item) : archiveBlock(pendingConfirm.item));
          }}
        />
      )}
    </AdminPageShell>
  );
}


