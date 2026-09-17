import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminStatsStrip, AdminWorkflowSteps } from '../components/admin/AdminWorkbench';
import { MathContent } from '../components/MathContent';
import { AdminFormField, GhostButton, InlineActions, StatusPill } from '../components/UiPrimitives';
import { useI18n } from '../i18n/useI18n';
import {
  archiveAdminMockExamPaper,
  archiveAdminMockExamQuestion,
  createAdminMockExamPaper,
  createAdminMockExamQuestion,
  duplicateAdminMockExamPaper,
  getAdminMockExamPaper,
  getAdminMockExamPapers,
  importAdminMockExamPapers,
  publishAdminMockExamPaper,
  updateAdminMockExamPaper,
  updateAdminMockExamQuestion,
  validateAdminMockExamImport
} from '../lib/api-admin';
import type { AdminMockExamImportValidation, AdminMockExamPaper, AdminMockExamPaperDetail, AdminMockExamQuestion, User } from '../lib/api-types';

type AdminMockExamPageProps = {
  currentUser: User | null;
  onBackAudit: () => void;
  onGoToContent: () => void;
  onGoToSchools: () => void;
  onGoToScholarships?: () => void;
  onGoToSpecialPractice?: () => void;
  onGoToUsers: () => void;
  onGoToAuth: () => void;
};

type QuestionDraft = Omit<AdminMockExamQuestion, 'id' | 'paperId' | 'createdAt' | 'updatedAt' | 'version'> & { id?: number; paperId?: number; version?: number };

type MockExamBusyAction =
  | 'create-paper'
  | 'save-paper'
  | 'publish-paper'
  | 'duplicate-paper'
  | 'archive-paper'
  | 'save-question'
  | 'archive-question'
  | 'validate-import'
  | 'import-json';

const ADMIN_MOCK_COPY = {
  zh: {
    subjects: { math: '数学', physics: '物理', chemistry: '化学' },
    statuses: { draft: '草稿', published: '已发布', archived: '已归档' },
    fallbackError: '操作失败，请稍后再试。',
    invalidJson: 'JSON 格式不正确，请检查逗号、引号和括号。',
    createdPaper: '套卷草稿已创建。',
    savedPaper: '套卷信息已保存。',
    publishedPaper: '套卷已发布到前台。',
    archivedPaper: '套卷已归档。',
    duplicatedPaper: '已复制为新的草稿套卷。',
    savedQuestion: '题目已保存。',
    createdQuestion: '题目已创建。',
    archivedQuestion: '题目已下架。',
    importValid: 'JSON 校验通过，可以导入为草稿。',
    importInvalid: 'JSON 校验完成，请先修正错误。',
    importDone: '导入完成：创建 {created} 套，更新 {updated} 套，同步 {questions} 题。',
    kicker: '后台模考题库',
    adminTitle: '批量导入试卷，也能逐题精修。',
    guestTitle: '模考题库管理',
    body: '管理数学、物理、化学原创仿真模拟卷；JSON 用于批量生产，后台表单用于日常维护和发布检查。',
    successTitle: '操作完成',
    warningTitle: '需要处理',
    statLabel: '模考题库统计',
    paperStat: '套卷',
    publishedStat: '已发布',
    draftStat: '草稿',
    questionStat: '题目',
    directoryKicker: '套卷目录',
    paperCount: '{count} 套',
    newPaper: '新建',
    paperMeta: '{questions}/{total} 题 · {attempts} 次作答',
    newPaperKicker: '新建套卷',
    paperKicker: '套卷 #{id}',
    unnamedPaper: '未命名套卷',
    subject: '科目',
    slug: 'Slug',
    title: '标题',
    status: '状态',
    questionCount: '题量',
    duration: '时长分钟',
    priceLabel: '价格展示',
    sort: '排序',
    description: '描述',
    free: '免费开放',
    locked: '锁定占位',
    issueBad: '发布检查未通过',
    issueOk: '发布检查正常',
    issueOkBody: '题量、题号和题目字段满足当前检查。',
    existingAttemptsWarning: '这套卷已有作答记录。题干、选项、答案或题号需要复制为新卷后修改。',
    createDraft: '创建草稿',
    savePaper: '保存套卷',
    publish: '发布',
    duplicate: '复制为新卷',
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
    previewCreate: '创建草稿',
    previewUpdate: '更新草稿',
    previewLine: '{slug}：{action}，{questions} 题'
  },
  en: {
    subjects: { math: 'Math', physics: 'Physics', chemistry: 'Chemistry' },
    statuses: { draft: 'Draft', published: 'Published', archived: 'Archived' },
    fallbackError: 'Action failed. Please try again later.',
    invalidJson: 'Invalid JSON. Check commas, quotes, and brackets.',
    createdPaper: 'Paper draft created.',
    savedPaper: 'Paper information saved.',
    publishedPaper: 'Paper published to the public site.',
    archivedPaper: 'Paper archived.',
    duplicatedPaper: 'Copied as a new draft paper.',
    savedQuestion: 'Question saved.',
    createdQuestion: 'Question created.',
    archivedQuestion: 'Question archived.',
    importValid: 'JSON validation passed. You can import it as a draft.',
    importInvalid: 'JSON validation completed. Fix the errors before import.',
    importDone: 'Import completed: {created} created, {updated} updated, {questions} questions synced.',
    kicker: 'Admin Mock Exam Bank',
    adminTitle: 'Import papers in bulk, then refine questions one by one.',
    guestTitle: 'Mock Exam Management',
    body: 'Manage original simulated papers for Math, Physics, and Chemistry. JSON supports bulk production; admin forms support daily maintenance and release checks.',
    successTitle: 'Done',
    warningTitle: 'Needs attention',
    statLabel: 'Mock exam bank statistics',
    paperStat: 'Papers',
    publishedStat: 'Published',
    draftStat: 'Drafts',
    questionStat: 'Questions',
    directoryKicker: 'Paper Directory',
    paperCount: '{count} papers',
    newPaper: 'New',
    paperMeta: '{questions}/{total} questions · {attempts} attempts',
    newPaperKicker: 'New Paper',
    paperKicker: 'Paper #{id}',
    unnamedPaper: 'Untitled paper',
    subject: 'Subject',
    slug: 'Slug',
    title: 'Title',
    status: 'Status',
    questionCount: 'Question count',
    duration: 'Duration minutes',
    priceLabel: 'Price label',
    sort: 'Sort',
    description: 'Description',
    free: 'Free access',
    locked: 'Locked placeholder',
    issueBad: 'Release check failed',
    issueOk: 'Release check passed',
    issueOkBody: 'Question count, order numbers, and required question fields pass current checks.',
    existingAttemptsWarning: 'This paper already has attempts. Copy it as a new paper before changing prompts, options, answers, or order numbers.',
    createDraft: 'Create draft',
    savePaper: 'Save paper',
    publish: 'Publish',
    duplicate: 'Copy as new paper',
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
    previewCreate: 'Create draft',
    previewUpdate: 'Update draft',
    previewLine: '{slug}: {action}, {questions} questions'
  }
} as const;

type AdminMockCopy = (typeof ADMIN_MOCK_COPY)[keyof typeof ADMIN_MOCK_COPY];

function createSampleImport(locale: string) {
  const isEnglish = locale === 'en';
  return {
  papers: [
    {
      subject: 'math',
      slug: 'math-mock-draft',
        title: isEnglish ? 'Math Mock Paper Draft' : '数学模拟卷 草稿',
        description: isEnglish ? 'Original simulated math paper, 48 questions / 60 minutes.' : '数学原创仿真模拟卷，48 题 / 60 分钟。',
        language: isEnglish ? 'en' : 'zh',
      durationMinutes: 60,
      questionCount: 48,
      isFree: true,
      isLocked: false,
      sortOrder: 10,
      status: 'draft',
      questions: [
        {
          orderNumber: 1,
          questionType: 'single-choice',
            prompt: isEnglish ? 'Solve the inequality x + 3 > 8.' : '不等式 x + 3 > 8 的解集为（ ）',
          options: [
            { id: 'A', text: 'x > 5' },
            { id: 'B', text: 'x < 5' },
            { id: 'C', text: 'x >= 5' },
            { id: 'D', text: 'x <= 5' }
          ],
          correctAnswer: 'A',
            explanation: isEnglish ? 'Subtract 3 from both sides to get x > 5.' : '两边同时减去 3，得到 x > 5。',
            knowledgeTags: [isEnglish ? 'Sets and inequalities' : '集合与不等式'],
          status: 'draft'
        }
      ]
    }
  ]
  };
}

function fillMockTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function getSubjectLabel(subject: string, copy: AdminMockCopy) {
  return copy.subjects[subject as keyof typeof copy.subjects] || subject;
}

function getStatusLabel(status: string, copy: AdminMockCopy) {
  return copy.statuses[status as keyof typeof copy.statuses] || status;
}

function emptyQuestion(orderNumber: number): QuestionDraft {
  return {
    orderNumber,
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
    if (locale === 'en' && /[\u3400-\u9fff]/.test(message)) return fallback;
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
  const warning = locale === 'en'
    ? `${action} succeeded, but ${target} could not refresh: ${detail}`
    : `${action}已完成，但${target}暂时无法刷新：${detail}`;
  return current ? `${current}；${warning}` : warning;
}

function tagsToText(tags: string[]) {
  return tags.join('，');
}

function textToTags(value: string) {
  return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
}

function parseJsonText(value: string, copy: AdminMockCopy) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(copy.invalidJson);
  }
}

export function AdminMockExamPage({
  currentUser,
  onBackAudit,
  onGoToContent,
  onGoToSchools,
  onGoToScholarships,
  onGoToSpecialPractice,
  onGoToUsers,
  onGoToAuth
}: AdminMockExamPageProps) {
  const { locale } = useI18n();
  const copy = locale === 'en' ? ADMIN_MOCK_COPY.en : ADMIN_MOCK_COPY.zh;
  const [items, setItems] = useState<AdminMockExamPaper[]>([]);
  const [detail, setDetail] = useState<AdminMockExamPaperDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [paperDraft, setPaperDraft] = useState<Partial<AdminMockExamPaper>>({});
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestion(1));
  const [jsonText, setJsonText] = useState(JSON.stringify(createSampleImport(locale), null, 2));
  const [importPreview, setImportPreview] = useState<AdminMockExamImportValidation | null>(null);
  const [isCreatingPaper, setIsCreatingPaper] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState<MockExamBusyAction | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<'publish-paper' | 'archive-paper' | 'archive-question' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const detailRequestRef = useRef(0);
  const isBusy = busyAction !== null;
  const isActionBusy = (action: MockExamBusyAction) => busyAction === action;
  const busyLabel = (action: MockExamBusyAction, label: string) => {
    if (!isActionBusy(action)) return label;
    return locale === 'en' ? `${label}...` : `${label}中`;
  };
  const busyClass = (action: MockExamBusyAction) => isActionBusy(action) ? 'admin-action-loading' : undefined;

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    void loadPapers();
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

  async function loadPapers(nextSelectedId?: number, options: PostWriteRefreshOptions = {}) {
    if (!options.afterWriteAction) setError('');
    try {
      const response = await getAdminMockExamPapers();
      setItems(response.items);
      const preferred = nextSelectedId ?? selectedId ?? response.items[0]?.id ?? null;
      setSelectedId(preferred);
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
      const response = await getAdminMockExamPaper(id);
      if (detailRequestRef.current !== requestId) return;
      setDetail(response);
      setPaperDraft(response.paper);
      setQuestionDraft(response.questions[0] ?? emptyQuestion(response.questions.length + 1));
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

  function updatePaper<K extends keyof AdminMockExamPaper>(key: K, value: AdminMockExamPaper[K]) {
    setPaperDraft((current) => ({ ...current, [key]: value }));
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

  async function createPaper() {
    setBusyAction('create-paper');
    setError('');
    try {
      const created = await createAdminMockExamPaper({
        subject: (paperDraft.subject ?? 'math') as AdminMockExamPaper['subject'],
        slug: String(paperDraft.slug ?? '').trim(),
        title: String(paperDraft.title ?? '').trim(),
        description: paperDraft.description ?? '',
        language: paperDraft.language ?? 'zh',
        questionCount: Number(paperDraft.questionCount ?? 48),
        durationMinutes: Number(paperDraft.durationMinutes ?? 60),
        priceLabel: paperDraft.priceLabel ?? '',
        isFree: Boolean(paperDraft.isFree),
        isLocked: Boolean(paperDraft.isLocked),
        sortOrder: Number(paperDraft.sortOrder ?? 0),
        status: 'draft'
      });
      setFeedback(copy.createdPaper);
      setIsCreatingPaper(false);
      await loadPapers(created.id, {
        afterWriteAction: trimActionMessage(copy.createdPaper),
        refreshTarget: locale === 'en' ? 'the mock paper list' : '套卷列表'
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function savePaper() {
    if (!detail) return;
    setBusyAction('save-paper');
    setError('');
    const paperId = detail.paper.id;
    try {
      await updateAdminMockExamPaper(paperId, { ...paperDraft, expectedVersion: detail.paper.version });
      setFeedback(copy.savedPaper);
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
      setBusyAction(null);
      return;
    }

    try {
      const action = trimActionMessage(copy.savedPaper);
      await loadPapers(paperId, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper list' : '套卷列表'
      });
      await loadDetail(paperId, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper detail' : '套卷详情'
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function publishPaper() {
    if (!detail) return;
    setBusyAction('publish-paper');
    setError('');
    const paperId = detail.paper.id;
    try {
      await publishAdminMockExamPaper(paperId, detail.paper.version);
      setFeedback(copy.publishedPaper);
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
      setBusyAction(null);
      return;
    }

    try {
      const action = trimActionMessage(copy.publishedPaper);
      await loadPapers(paperId, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper list' : '套卷列表'
      });
      await loadDetail(paperId, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper detail' : '套卷详情'
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function archivePaper() {
    if (!detail) return;
    setBusyAction('archive-paper');
    setError('');
    try {
      await archiveAdminMockExamPaper(detail.paper.id, detail.paper.version);
      setFeedback(copy.archivedPaper);
      const action = trimActionMessage(copy.archivedPaper);
      await loadPapers(detail.paper.id, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper list' : '套卷列表'
      });
      await loadDetail(detail.paper.id, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper detail' : '套卷详情'
      });
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
    } finally {
      setBusyAction(null);
    }
  }

  async function duplicatePaper() {
    if (!detail) return;
    setBusyAction('duplicate-paper');
    setError('');
    try {
      const copied = await duplicateAdminMockExamPaper(detail.paper.id);
      setFeedback(copy.duplicatedPaper);
      await loadPapers(copied.id, {
        afterWriteAction: trimActionMessage(copy.duplicatedPaper),
        refreshTarget: locale === 'en' ? 'the mock paper list' : '套卷列表'
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
        await updateAdminMockExamQuestion(questionDraft.id, { ...questionDraft, expectedVersion: questionDraft.version });
        setFeedback(copy.savedQuestion);
      } else {
        await createAdminMockExamQuestion(detail.paper.id, questionDraft);
        setFeedback(copy.createdQuestion);
      }
      const action = trimActionMessage(questionDraft.id ? copy.savedQuestion : copy.createdQuestion);
      await loadDetail(detail.paper.id, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper detail' : '套卷详情'
      });
      await loadPapers(detail.paper.id, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper list' : '套卷列表'
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
      await archiveAdminMockExamQuestion(questionDraft.id, questionDraft.version);
      setFeedback(copy.archivedQuestion);
      const action = trimActionMessage(copy.archivedQuestion);
      await loadDetail(detail.paper.id, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper detail' : '套卷详情'
      });
      await loadPapers(detail.paper.id, {
        afterWriteAction: action,
        refreshTarget: locale === 'en' ? 'the mock paper list' : '套卷列表'
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
    if (action === 'publish-paper') await publishPaper();
    if (action === 'archive-paper') await archivePaper();
    if (action === 'archive-question') await archiveQuestion();
    setPendingConfirmation(null);
  }

  async function validateImport() {
    setBusyAction('validate-import');
    setError('');
    try {
      const payload = parseJsonText(jsonText, copy);
      const response = await validateAdminMockExamImport(payload);
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
      const response = await importAdminMockExamPapers(payload);
      importFeedback = fillMockTemplate(copy.importDone, { created: response.created, updated: response.updated, questions: response.questionsUpserted });
      setFeedback(importFeedback);
      importedSlug = response.previews[0]?.slug;
      setImportPreview(null);
    } catch (nextError) {
      setError(compactError(nextError, copy.fallbackError, locale));
      setBusyAction(null);
      return;
    }

    try {
      const papersResponse = await getAdminMockExamPapers();
      setItems(papersResponse.items);
      const imported = papersResponse.items.find((item) => item.slug === importedSlug);
      setSelectedId(imported?.id ?? selectedId ?? papersResponse.items[0]?.id ?? null);
    } catch (nextError) {
      setError(appendRefreshWarning(
        '',
        trimActionMessage(importFeedback || copy.importDone),
        locale === 'en' ? 'the mock paper list' : '套卷列表',
        compactError(nextError, copy.fallbackError, locale),
        locale
      ));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AdminPageShell
      current="mockExams"
      currentUser={currentUser}
      kicker={copy.kicker}
      title={currentUser?.role === 'admin' ? copy.adminTitle : copy.guestTitle}
      body={copy.body}
      onGoToAuth={onGoToAuth}
      onGoToAudit={onBackAudit}
      onGoToContent={onGoToContent}
      onGoToSchools={onGoToSchools}
      onGoToScholarships={onGoToScholarships}
      onGoToSpecialPractice={onGoToSpecialPractice}
      onGoToUsers={onGoToUsers}
    >
      {currentUser?.role === 'admin' && feedback && <section className="admin-feedback success"><strong>{copy.successTitle}</strong><p>{feedback}</p></section>}
      {currentUser?.role === 'admin' && error && <section className="admin-feedback warning"><strong>{copy.warningTitle}</strong><p>{error}</p></section>}
      {currentUser?.role === 'admin' && isLoadingDetail && <section className="admin-feedback"><strong>{locale === 'en' ? 'Loading details' : '正在读取详情'}</strong><p>{locale === 'en' ? 'The selected mock paper is loading.' : '正在读取当前模拟卷，完成后会更新右侧编辑区。'}</p></section>}

      {currentUser?.role === 'admin' && (
        <section className="mock-admin-workbench">
          <AdminStatsStrip
            ariaLabel={copy.statLabel}
            className="admin-workbench-stats"
            items={[
              { key: 'papers', label: copy.paperStat, value: stats.total },
              { key: 'published', label: copy.publishedStat, value: stats.published },
              { key: 'drafts', label: copy.draftStat, value: stats.draft },
              { key: 'questions', label: copy.questionStat, value: stats.questions }
            ]}
          />

          <AdminWorkflowSteps
            ariaLabel={locale === 'en' ? 'Mock paper publishing workflow' : '模拟卷发布流程'}
            className="admin-workbench-flow"
            items={[
              { key: 'select', label: locale === 'en' ? 'Select paper' : '选择套卷', detail: locale === 'en' ? 'Existing or new draft' : '已有套卷或新草稿', state: detail || isCreatingPaper ? 'complete' : 'active' },
              { key: 'edit', label: locale === 'en' ? 'Edit content' : '编辑内容', detail: locale === 'en' ? 'Paper and questions' : '套卷信息与题目', state: isCreatingPaper ? 'active' : detail ? 'complete' : 'upcoming' },
              { key: 'check', label: locale === 'en' ? 'Release check' : '发布检查', detail: detail?.issues.length ? (locale === 'en' ? `${detail.issues.length} issue(s)` : `${detail.issues.length} 项待处理`) : (locale === 'en' ? 'Check completeness' : '检查完整性'), state: detail?.issues.length ? 'warning' : detail?.paper.status === 'published' ? 'complete' : detail ? 'active' : 'upcoming' },
              { key: 'publish', label: locale === 'en' ? 'Publish' : '发布上线', detail: locale === 'en' ? 'Visible to students' : '前台对学生可见', state: detail?.paper.status === 'published' ? 'complete' : 'upcoming' }
            ]}
          />

          <aside className="mock-admin-sidebar">
            <div className="school-directory-head">
              <div>
                <p className="page-kicker">{copy.directoryKicker}</p>
                <h2>{fillMockTemplate(copy.paperCount, { count: items.length })}</h2>
              </div>
              <button type="button" onClick={() => {
                setIsCreatingPaper(true);
                setDetail(null);
                setPaperDraft({ subject: 'math', slug: '', title: '', language: 'zh', questionCount: 48, durationMinutes: 60, isFree: false, isLocked: true, sortOrder: items.length + 1, status: 'draft' });
              }}>{copy.newPaper}</button>
            </div>
            <div className="mock-admin-paper-list">
              {items.map((item) => (
                <button key={item.id} type="button" className={selectedId === item.id ? 'active' : ''} onClick={() => {
                  setIsCreatingPaper(false);
                  setSelectedId(item.id);
                }}>
                  <span>{getSubjectLabel(item.subject, copy)} · {getStatusLabel(item.status, copy)}</span>
                  <strong>{item.title}</strong>
                  <small>{fillMockTemplate(copy.paperMeta, { questions: item.questionTotal, total: item.questionCount, attempts: item.attemptTotal })}</small>
                </button>
              ))}
            </div>
          </aside>

          <main className="mock-admin-main">
            {(detail || isCreatingPaper) && (
              <article className="school-editor-card">
                <div className="school-editor-head">
                  <div>
                    <p className="page-kicker">{isCreatingPaper ? copy.newPaperKicker : fillMockTemplate(copy.paperKicker, { id: detail?.paper.id ?? '' })}</p>
                    <h2>{paperDraft.title || copy.unnamedPaper}</h2>
                  </div>
                  <StatusPill tone={paperDraft.status === 'published' ? 'success' : paperDraft.status === 'archived' ? 'muted' : 'warning'}>{getStatusLabel(String(paperDraft.status ?? 'draft'), copy)}</StatusPill>
                </div>
                <div className="admin-form-grid">
                  <AdminFormField label={copy.subject}><select value={String(paperDraft.subject ?? 'math')} onChange={(event) => updatePaper('subject', event.target.value as AdminMockExamPaper['subject'])}><option value="math">{copy.subjects.math}</option><option value="physics">{copy.subjects.physics}</option><option value="chemistry">{copy.subjects.chemistry}</option></select></AdminFormField>
                  <AdminFormField label={copy.slug}><input value={String(paperDraft.slug ?? '')} onChange={(event) => updatePaper('slug', event.target.value)} /></AdminFormField>
                  <AdminFormField label={copy.title}><input value={String(paperDraft.title ?? '')} onChange={(event) => updatePaper('title', event.target.value)} /></AdminFormField>
                  <AdminFormField label={copy.status}><select value={String(paperDraft.status ?? 'draft')} onChange={(event) => updatePaper('status', event.target.value as AdminMockExamPaper['status'])}><option value="draft">{copy.statuses.draft}</option><option value="published">{copy.statuses.published}</option><option value="archived">{copy.statuses.archived}</option></select></AdminFormField>
                  <AdminFormField label={copy.questionCount}><input type="number" value={Number(paperDraft.questionCount ?? 48)} onChange={(event) => updatePaper('questionCount', Number(event.target.value))} /></AdminFormField>
                  <AdminFormField label={copy.duration}><input type="number" value={Number(paperDraft.durationMinutes ?? 60)} onChange={(event) => updatePaper('durationMinutes', Number(event.target.value))} /></AdminFormField>
                  <AdminFormField label={copy.priceLabel}><input value={String(paperDraft.priceLabel ?? '')} onChange={(event) => updatePaper('priceLabel', event.target.value)} /></AdminFormField>
                  <AdminFormField label={copy.sort}><input type="number" value={Number(paperDraft.sortOrder ?? 0)} onChange={(event) => updatePaper('sortOrder', Number(event.target.value))} /></AdminFormField>
                </div>
                <AdminFormField label={copy.description}><textarea value={String(paperDraft.description ?? '')} onChange={(event) => updatePaper('description', event.target.value)} /></AdminFormField>
                <InlineActions>
                  <label className="admin-checkbox"><input type="checkbox" checked={Boolean(paperDraft.isFree)} onChange={(event) => updatePaper('isFree', event.target.checked)} /> {copy.free}</label>
                  <label className="admin-checkbox"><input type="checkbox" checked={Boolean(paperDraft.isLocked)} onChange={(event) => updatePaper('isLocked', event.target.checked)} /> {copy.locked}</label>
                </InlineActions>
                <div className="school-editor-actions admin-sticky-action-bar">
                  <div>
                    <strong>{detail?.issues.length ? copy.issueBad : copy.issueOk}</strong>
                    <span>{detail?.issues.length ? detail.issues.join('；') : copy.issueOkBody}</span>
                    {detail?.paper.status === 'published' && detail.paper.attemptTotal > 0 && (
                      <span className="mock-admin-danger-note">{copy.existingAttemptsWarning}</span>
                    )}
                  </div>
                  <InlineActions>
                    <button
                      type="button"
                      className={busyClass(isCreatingPaper ? 'create-paper' : 'save-paper')}
                      onClick={() => isCreatingPaper ? void createPaper() : void savePaper()}
                      disabled={isBusy}
                    >
                      {isCreatingPaper ? busyLabel('create-paper', copy.createDraft) : busyLabel('save-paper', copy.savePaper)}
                    </button>
                    {!isCreatingPaper && (
                      <GhostButton
                        className={busyClass('publish-paper')}
                        onClick={() => setPendingConfirmation('publish-paper')}
                        disabled={isBusy || Boolean(detail?.issues.length)}
                      >
                        {busyLabel('publish-paper', copy.publish)}
                      </GhostButton>
                    )}
                    {!isCreatingPaper && (
                      <GhostButton
                        className={busyClass('duplicate-paper')}
                        onClick={() => void duplicatePaper()}
                        disabled={isBusy}
                      >
                        {busyLabel('duplicate-paper', copy.duplicate)}
                      </GhostButton>
                    )}
                    {!isCreatingPaper && (
                      <GhostButton
                        className={busyClass('archive-paper')}
                        onClick={() => setPendingConfirmation('archive-paper')}
                        disabled={isBusy}
                      >
                        {busyLabel('archive-paper', copy.archive)}
                      </GhostButton>
                    )}
                  </InlineActions>
                </div>
              </article>
            )}

            {detail && (
              <article className="school-editor-card">
                <div className="school-editor-head">
                  <div><p className="page-kicker">{copy.questionManage}</p><h2>{fillMockTemplate(copy.questionCountTitle, { count: detail.questions.length })}</h2></div>
            <button
              type="button"
              className="mock-admin-head-action"
              onClick={() => setQuestionDraft(emptyQuestion(detail.questions.length + 1))}
            >
              {copy.addQuestion}
            </button>
                </div>
                <div className="mock-admin-question-grid">
                  <div className="mock-admin-question-list">
                    {detail.questions.map((question) => (
                      <button key={question.id} type="button" className={questionDraft.id === question.id ? 'active' : ''} onClick={() => setQuestionDraft(question)}>
                        <span>{question.orderNumber}</span>
                        <strong><MathContent text={question.prompt} /></strong>
                        <small>{question.correctAnswer} · {getStatusLabel(question.status, copy)} · {question.knowledgeTags.join(' / ')}</small>
                      </button>
                    ))}
                  </div>
                  <div className="mock-admin-question-editor">
                    <div className="admin-form-grid">
                      <AdminFormField label={copy.questionNumber}><input type="number" value={questionDraft.orderNumber} onChange={(event) => updateQuestion('orderNumber', Number(event.target.value))} /></AdminFormField>
                      <AdminFormField label={copy.correctAnswer}><select value={questionDraft.correctAnswer} onChange={(event) => updateQuestion('correctAnswer', event.target.value)}><option>A</option><option>B</option><option>C</option><option>D</option></select></AdminFormField>
                    </div>
                    <AdminFormField label={copy.prompt}><textarea value={questionDraft.prompt} onChange={(event) => updateQuestion('prompt', event.target.value)} /></AdminFormField>
                    <div className="admin-form-grid">
                      {questionDraft.options.map((option) => (
                        <AdminFormField key={option.id} label={fillMockTemplate(copy.option, { id: option.id })}><input value={option.text} onChange={(event) => updateOption(option.id, event.target.value)} /></AdminFormField>
                      ))}
                    </div>
                    <AdminFormField label={copy.explanation}><textarea value={questionDraft.explanation} onChange={(event) => updateQuestion('explanation', event.target.value)} /></AdminFormField>
                    <div className="admin-form-grid">
                      <AdminFormField label={copy.tags}><input value={tagsToText(questionDraft.knowledgeTags)} onChange={(event) => updateQuestion('knowledgeTags', textToTags(event.target.value))} /></AdminFormField>
                      <AdminFormField label={copy.status}><select value={questionDraft.status} onChange={(event) => updateQuestion('status', event.target.value as QuestionDraft['status'])}><option value="draft">{copy.statuses.draft}</option><option value="published">{copy.statuses.published}</option><option value="archived">{copy.statuses.archived}</option></select></AdminFormField>
                    </div>
                    <InlineActions>
                      <button
                        type="button"
                        className={busyClass('save-question')}
                        onClick={() => void saveQuestion()}
                        disabled={isBusy}
                      >
                        {busyLabel('save-question', questionDraft.id ? copy.saveQuestion : copy.createQuestion)}
                      </button>
                      {questionDraft.id && (
                        <GhostButton
                          className={busyClass('archive-question')}
                          onClick={() => setPendingConfirmation('archive-question')}
                          disabled={isBusy}
                        >
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
                  <GhostButton
                    className={busyClass('validate-import')}
                    onClick={() => void validateImport()}
                    disabled={isBusy}
                  >
                    {busyLabel('validate-import', copy.validateJson)}
                  </GhostButton>
                  <button
                    type="button"
                    className={busyClass('import-json')}
                    onClick={() => void importJson()}
                    disabled={isBusy || importPreview?.ok !== true}
                  >
                    {busyLabel('import-json', copy.import)}
                  </button>
                </InlineActions>
              </div>
              <AdminFormField label={copy.jsonContent}><textarea className="mock-admin-json" value={jsonText} onChange={(event) => setJsonText(event.target.value)} /></AdminFormField>
              {importPreview && (
                <div className={`admin-feedback ${importPreview.ok ? 'success' : 'warning'}`}>
                  <strong>{importPreview.ok ? copy.validationPassed : copy.validationFailed}</strong>
                  {importPreview.errors.map((item) => <p key={item}>{item}</p>)}
                  {!importPreview.errors.length && importPreview.previews.map((item) => (
                    <p key={item.slug}>
                      {fillMockTemplate(copy.previewLine, {
                        slug: item.slug,
                        action: item.action === 'create-draft' ? copy.previewCreate : copy.previewUpdate,
                        questions: item.questionCount
                      })}
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
          title={pendingConfirmation === 'publish-paper'
            ? (locale === 'en' ? 'Publish this mock paper?' : '确认发布这套模拟卷？')
            : pendingConfirmation === 'archive-paper'
              ? (locale === 'en' ? 'Archive this mock paper?' : '确认归档这套模拟卷？')
              : (locale === 'en' ? 'Archive this question?' : '确认下架这道题？')}
          body={pendingConfirmation === 'publish-paper'
            ? (locale === 'en' ? 'The release check must pass. After publishing, the paper becomes available to students.' : '必须先通过发布检查；发布后学生端将可以看到并开始作答。')
            : (locale === 'en' ? 'This action removes the content from the student-facing flow. Existing attempt records are preserved.' : '该操作会将内容移出学生端流程，已有作答记录仍会保留。')}
          confirmLabel={pendingConfirmation === 'publish-paper' ? (locale === 'en' ? 'Publish' : '确认发布') : (locale === 'en' ? 'Archive' : '确认归档')}
          tone={pendingConfirmation === 'publish-paper' ? 'neutral' : 'danger'}
          isBusy={isBusy}
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => void confirmPendingAction()}
        />
      )}
    </AdminPageShell>
  );
}
