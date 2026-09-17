import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../Icon';
import { MathContent } from '../../MathContent';
import { MetricCard } from '../../UiPrimitives';
import { useI18n } from '../../../i18n/useI18n';
import {
  archiveAdminAIQuestioningSyllabusJsonImport,
  approveAdminAIQuestioningQuestion,
  applyAdminAIQuestioningSyllabusJsonImport,
  archiveAdminAIQuestioningQuestion,
  bulkAdminAIQuestioningQuestions,
  createAdminAIQuestioningSyllabusJsonImportRecoveryDraft,
  createAdminAIQuestioningSyllabusJsonImportReversePlan,
  createAdminAIQuestioningSyllabusJsonImport,
  getAdminAIQuestioningSyllabusJsonTemplate,
  getAdminAIQuestioningSyllabusGovernance,
  getAdminAIQuestioningQuestions,
  listAdminAIQuestioningSyllabusJsonImports,
  previewAdminAIQuestioningSyllabusJsonImport,
  rejectAdminAIQuestioningQuestion,
  refreshAdminAIQuestioningSyllabusGovernance
} from '../../../lib/api-admin';
import type {
  AdminAIQuestioningSyllabusGovernance,
  AdminAIQuestioningSyllabusJsonImport,
  AdminAIQuestioningSyllabusJsonImportPreview,
  AdminAIQuestioningSyllabusReversePlan,
  AdminAIQuestioningQuestion,
  User
} from '../../../lib/api-types';
import { syllabusImportAppliedMigrationRows, syllabusImportMigrationRows, syllabusImportPreviewCsv, syllabusImportPreviewFilename, syllabusImportPreviewReport, syllabusImportRecoverySummary } from '../../../lib/syllabus-imports';

const EMPTY_GOVERNANCE: AdminAIQuestioningSyllabusGovernance = {
  summary: {
    total: 0,
    currentCount: 0,
    staleCount: 0,
    unpublishedTopicCount: 0,
    pendingReviewCount: 0
  },
  items: []
};

const COPY = {
  zh: {
    kicker: 'AI 出题 · CSCA 大纲',
    title: '管理 AI 出题使用的 CSCA 大纲。',
    body: '这不是独立内容页，而是 AI 出题链路的上游范围控制。先预览影响，再应用；应用后，系统会标记受影响的存量题用于诊断，后续生成会使用新的大纲范围。开发阶段旧 AI 题由清理/重生处理，不需要逐题离线复核。',
    loadFailed: '大纲治理数据暂时无法加载。',
    subject: '科目',
    allSubjects: '全部科目',
    math: '数学',
    physics: '物理',
    chemistry: '化学',
    refresh: '刷新',
    currentTopics: '当前大纲知识点',
    staleTopics: '过期知识点',
    unpublishedTopics: '未发布知识点',
    pendingReview: '影响题',
    jsonImport: '上传大纲 JSON',
    jsonBody: '粘贴 csca-syllabus-v1 JSON。系统会先预览新增、更新、未覆盖知识点和受影响题目。',
    jsonLabel: '大纲 JSON',
    chooseFile: '选择 JSON 文件',
    downloadTemplate: '下载模板',
    downloadPreviewCsv: '下载 CSV 报告',
    downloadPreviewJson: '下载 JSON 报告',
    missingAction: '未覆盖知识点',
    keep: '保持不变',
    draft: '改为草稿',
    archive: '归档',
    preview: '预览影响',
    save: '保存草稿',
    apply: '应用草稿',
    archiveDraft: '归档草稿',
    recoveryDraft: '重建草稿',
    reversePlan: '生成回滚预案',
    reversePlanTitle: '回滚预案',
    reversePlanBody: '这是只读 dry-run，不会修改题库。先看可自动规划项、阻断项和需要质量复核的题目。',
    reversePlanReady: '已生成回滚预案。',
    reversePlanSummary: '操作 {operations} 项 · 可自动规划 {auto} · 阻断 {blockers} · 需质量复核 {manual} · 涉及题目 {questions}',
    reversePlanGuidance: '建议优先使用重建草稿重新预览；不要自动把待复核题改回通过。',
    selectedDraft: '已选草稿',
    noSelectedDraft: '先选择或保存一个草稿',
    previewTitle: '预览结果',
    impact: '文件 {topics} 个知识点 · 新增 {created} · 更新 {updated} · 未覆盖 {missing} · 影响题目 {affected} · 已入库题受影响 {approved}',
    migrationTitle: 'Code 迁移确认',
    migrationEmpty: '没有检测到 code 迁移。',
    migrationRow: '{from} → {to} · #{id} · 影响题目 {affected} · 已入库题受影响 {approved}',
    migrationConfirm: '这份大纲会迁移 {count} 个 topic code。确认应用后，旧 code 会改为新 code，相关题目仍挂在原知识点下。确定继续吗？',
    appliedMigrationSummary: '已应用 code 迁移 {count} 条',
    previewEmpty: '预览后会显示影响范围。',
    recentImports: '最近导入',
    noImports: '暂无导入记录',
    selectedImportDetail: '导入记录详情',
    selectedImportBody: '这里展示所选导入的完整影响摘要、code 迁移、变更样例和缺失知识点，用于应用后排查；开发阶段旧 AI 题建议清理后重新生成。',
    recoverySource: '恢复来源',
    recoverySourceRow: '从导入 #{id}（{status}）重建',
    recoveryReviewHint: '这是恢复草稿，应用前请重新检查当前影响。',
    importSummary: '影响摘要',
    incomingChanges: '导入变更',
    missingTopics: '缺失知识点',
    governanceQueue: '当前治理风险',
    noGovernanceItems: '当前没有需要处理的大纲风险。',
    reviewQueue: '存量题影响诊断',
    reviewQueueBody: '这里不是日常审题入口，只用于查看大纲/画像更新后哪些存量题可能不再符合当前基线。开发阶段旧 AI 题优先清理并重新生成，正式上线后再按数据风险决定是否逐题治理。',
    reviewFilters: '诊断筛选',
    reviewTopicId: '知识点 ID',
    reviewSyllabusStatus: '大纲范围',
    allSyllabusStatuses: '全部影响',
    staleSyllabusStatus: '过期/未发布',
    currentSyllabusStatus: '当前大纲',
    reviewSourceType: '题目来源',
    allSources: '全部来源',
    aiSource: 'AI 生成',
    bankSource: '正式题库',
    importedSource: '导入题',
    mockExamSource: '模拟卷',
    specialPracticeSource: '专项题',
    noReviewQuestions: '暂无受影响题。',
    correctAnswer: '正确答案',
    explanation: '解析',
    approve: '确认仍可用',
    reject: '拒绝',
    archiveQuestion: '归档',
    selectPage: '选择当前可见题',
    clearSelection: '清空选择',
    selectedQuestions: '已选 {count} 题',
    bulkReview: '批量确认仍可用',
    bulkReject: '批量拒绝',
    bulkArchive: '批量归档',
    bulkBoundary: '当前最多显示前 20 题；批量操作只处理当前可见且已选题目。这是兜底治理工具，批量操作只用于审题、拒绝或归档；发布仍需逐题通过。开发阶段旧 AI 题优先清理后重新生成。',
    bulkConfirm: '{action} {count} 题？',
    bulkComplete: '批量处理完成：成功 {succeeded}，失败 {failed}。',
    view: '查看',
    status: '状态',
    createdAt: '创建时间',
    source: '来源',
    dateLocale: 'zh-CN',
    saved: '已保存草稿。',
    applied: '已应用大纲，同学科旧应用版本已退役；受影响存量题已标记为诊断项，开发阶段旧 AI 题请按清理/重生流程处理。',
    archived: '已归档草稿。',
    recoveryDraftCreated: '已基于历史导入重建草稿，请重新查看影响后再应用。',
    refreshed: '已刷新大纲治理状态。',
    invalidJson: 'JSON 格式不正确。'
  },
  en: {
    kicker: 'AI Questioning · CSCA Syllabus',
    title: 'Manage the CSCA syllabus used by AI question generation.',
    body: 'This is upstream scope control for AI questioning, not a standalone content page. Preview impact before applying; affected legacy questions are marked for diagnostics and new generations use the updated syllabus scope. During development, obsolete AI questions should be cleaned and regenerated instead of reviewed one by one.',
    loadFailed: 'Syllabus governance data is unavailable.',
    subject: 'Subject',
    allSubjects: 'All subjects',
    math: 'Math',
    physics: 'Physics',
    chemistry: 'Chemistry',
    refresh: 'Refresh',
    currentTopics: 'Current topics',
    staleTopics: 'Stale topics',
    unpublishedTopics: 'Unpublished topics',
    pendingReview: 'Impacted questions',
    jsonImport: 'Upload syllabus JSON',
    jsonBody: 'Paste csca-syllabus-v1 JSON. The system previews new, updated, missing topics and affected questions first.',
    jsonLabel: 'Syllabus JSON',
    chooseFile: 'Choose JSON file',
    downloadTemplate: 'Download template',
    downloadPreviewCsv: 'Download CSV report',
    downloadPreviewJson: 'Download JSON report',
    missingAction: 'Missing topics',
    keep: 'Keep unchanged',
    draft: 'Move to draft',
    archive: 'Archive',
    preview: 'Preview impact',
    save: 'Save draft',
    apply: 'Apply draft',
    archiveDraft: 'Archive draft',
    recoveryDraft: 'Rebuild draft',
    reversePlan: 'Reverse plan',
    reversePlanTitle: 'Reverse plan',
    reversePlanBody: 'This is a read-only dry-run. It does not mutate the bank. Review auto-plan items, blockers, and quality follow-up load first.',
    reversePlanReady: 'Reverse plan generated.',
    reversePlanSummary: '{operations} operations · {auto} auto-plannable · {blockers} blockers · {manual} quality follow-up · {questions} questions',
    reversePlanGuidance: 'Prefer rebuilding a draft and re-previewing; do not automatically approve questions that were moved to review.',
    selectedDraft: 'Selected draft',
    noSelectedDraft: 'Select or save a draft first',
    previewTitle: 'Preview result',
    impact: 'file {topics} topics · new {created} · updated {updated} · missing {missing} · affected questions {affected} · approved impacted {approved}',
    migrationTitle: 'Code migration confirmation',
    migrationEmpty: 'No code migrations detected.',
    migrationRow: '{from} → {to} · #{id} · affected questions {affected} · approved impacted {approved}',
    migrationConfirm: 'This syllabus will migrate {count} topic code(s). After applying, old codes become new codes while related questions remain attached to the original topics. Continue?',
    appliedMigrationSummary: '{count} code migration(s) applied',
    previewEmpty: 'Preview impact will appear here.',
    recentImports: 'Recent imports',
    noImports: 'No imports yet',
    selectedImportDetail: 'Import record detail',
    selectedImportBody: 'Review the selected import impact summary, code migrations, changed samples, and missing topics for diagnostics; during development, obsolete AI questions should be cleaned and regenerated.',
    recoverySource: 'Recovery source',
    recoverySourceRow: 'rebuilt from import #{id} ({status})',
    recoveryReviewHint: 'This is a recovery draft. Review the current impact before applying.',
    importSummary: 'Impact summary',
    incomingChanges: 'Incoming changes',
    missingTopics: 'Missing topics',
    governanceQueue: 'Current governance risks',
    noGovernanceItems: 'No syllabus governance risks right now.',
    reviewQueue: 'Legacy impact diagnostics',
    reviewQueueBody: 'This is not a daily review queue. It shows legacy questions that may no longer match the current baseline after syllabus/profile updates. During development, obsolete AI questions should usually be cleaned and regenerated.',
    reviewFilters: 'Diagnostic filters',
    reviewTopicId: 'Topic ID',
    reviewSyllabusStatus: 'Syllabus scope',
    allSyllabusStatuses: 'All impacted',
    staleSyllabusStatus: 'Stale/unpublished',
    currentSyllabusStatus: 'Current syllabus',
    reviewSourceType: 'Question source',
    allSources: 'All sources',
    aiSource: 'AI generated',
    bankSource: 'Question bank',
    importedSource: 'Imported',
    mockExamSource: 'Mock exam',
    specialPracticeSource: 'Special practice',
    noReviewQuestions: 'No impacted questions.',
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    approve: 'Confirm still valid',
    reject: 'Reject',
    archiveQuestion: 'Archive',
    selectPage: 'Select visible',
    clearSelection: 'Clear',
    selectedQuestions: '{count} selected',
    bulkReview: 'Bulk confirm valid',
    bulkReject: 'Bulk reject',
    bulkArchive: 'Bulk archive',
    bulkBoundary: 'Only the first 20 visible questions are shown. Bulk actions affect selected visible questions only. This is a fallback governance tool for review, reject, or archive only; publishing still requires per-question approval. During development, obsolete AI questions should usually be cleaned and regenerated.',
    bulkConfirm: '{action} {count} questions?',
    bulkComplete: 'Bulk action complete: {succeeded} succeeded, {failed} failed.',
    view: 'View',
    status: 'Status',
    createdAt: 'Created',
    source: 'Source',
    dateLocale: 'en-US',
    saved: 'Draft saved.',
    applied: 'Syllabus applied, previous applied versions for this subject retired, and affected legacy questions marked for diagnostics; during development, clean and regenerate obsolete AI questions.',
    archived: 'Draft archived.',
    recoveryDraftCreated: 'Recovery draft created. Review the refreshed impact before applying.',
    refreshed: 'Syllabus governance refreshed.',
    invalidJson: 'Invalid JSON.'
  }
} as const;

type Props = {
  currentUser?: User | null;
  subject?: string;
  onSubjectChange?: (subject: string) => void;
  onDataChanged?: () => void;
};

function fillTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.split(`{${key}}`).join(String(value)), template);
}

function formatError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function isPreview(value: unknown): value is AdminAIQuestioningSyllabusJsonImportPreview {
  return Boolean(value && typeof value === 'object' && 'summary' in value);
}

function questionOptions(value: unknown): Array<{ id: string; text: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
    return {
      id: String(record.id ?? String.fromCharCode(65 + index)),
      text: String(record.text ?? '')
    };
  }).filter((item) => item.text);
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="admin-empty-state">
      <Icon name="lucide:inbox" />
      <span>{children}</span>
    </div>
  );
}

export function CscaSyllabusWorkspace({
  currentUser,
  subject: controlledSubject,
  onSubjectChange,
  onDataChanged
}: Props) {
  const { locale } = useI18n();
  const copy = locale === 'en' ? COPY.en : COPY.zh;
  const [localSubject, setLocalSubject] = useState('');
  const subject = controlledSubject ?? localSubject;
  const [governance, setGovernance] = useState<AdminAIQuestioningSyllabusGovernance>(EMPTY_GOVERNANCE);
  const [imports, setImports] = useState<AdminAIQuestioningSyllabusJsonImport[]>([]);
  const [reviewQuestions, setReviewQuestions] = useState<AdminAIQuestioningQuestion[]>([]);
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<AdminAIQuestioningSyllabusJsonImportPreview | null>(null);
  const [missingTopicAction, setMissingTopicAction] = useState<'keep' | 'draft' | 'archive'>('keep');
  const [reviewTopicId, setReviewTopicId] = useState('');
  const [reviewSyllabusStatus, setReviewSyllabusStatus] = useState('');
  const [reviewSourceType, setReviewSourceType] = useState('');
  const [selectedReviewQuestionIds, setSelectedReviewQuestionIds] = useState<number[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);
  const [reversePlan, setReversePlan] = useState<AdminAIQuestioningSyllabusReversePlan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateSubject(nextSubject: string) {
    if (controlledSubject === undefined) setLocalSubject(nextSubject);
    onSubjectChange?.(nextSubject);
  }

  const selectedImport = useMemo(() => imports.find((item) => item.id === selectedImportId) ?? null, [imports, selectedImportId]);
  const selectedImportPreview = useMemo(() => (
    selectedImport && isPreview(selectedImport.previewSummary) ? selectedImport.previewSummary : null
  ), [selectedImport]);
  const selectedImportAppliedMigrations = useMemo(() => (
    selectedImport ? syllabusImportAppliedMigrationRows(selectedImport.previewSummary) : []
  ), [selectedImport]);
  const selectedImportRecovery = useMemo(() => (
    selectedImport ? syllabusImportRecoverySummary(selectedImport.previewSummary) : null
  ), [selectedImport]);
  const selectedReversePlan = reversePlan?.importId === selectedImportId ? reversePlan : null;
  const migrationRows = useMemo(() => preview ? syllabusImportMigrationRows(preview) : [], [preview]);
  const filteredReviewQuestions = useMemo(() => (
    reviewSourceType ? reviewQuestions.filter((question) => question.sourceType === reviewSourceType) : reviewQuestions
  ), [reviewQuestions, reviewSourceType]);
  const visibleReviewQuestions = useMemo(() => filteredReviewQuestions.slice(0, 20), [filteredReviewQuestions]);
  const selectedVisibleReviewQuestionIds = useMemo(() => (
    visibleReviewQuestions
      .map((question) => question.id)
      .filter((id) => selectedReviewQuestionIds.includes(id))
  ), [selectedReviewQuestionIds, visibleReviewQuestions]);

  async function loadData(nextSubject = subject) {
    const params = { subject: nextSubject || undefined };
    const topicId = /^\d+$/.test(reviewTopicId.trim()) ? Number(reviewTopicId.trim()) : undefined;
    const syllabusStatus = reviewSyllabusStatus || undefined;
    const requestLabels = ['大纲治理', '大纲导入记录', '待复核题目'] as const;
    const requests = [
      getAdminAIQuestioningSyllabusGovernance(params),
      listAdminAIQuestioningSyllabusJsonImports({ ...params, limit: 20 }),
      getAdminAIQuestioningQuestions({ ...params, status: 'pending_review', topicId, syllabusStatus, view: 'list' })
    ] as const;
    const [governanceResult, importsResult, questionsResult] = await Promise.allSettled(requests);
    const failedLabels = [governanceResult, importsResult, questionsResult]
      .map((result, index) => result.status === 'rejected' ? requestLabels[index] : null)
      .filter((label): label is (typeof requestLabels)[number] => label !== null);

    if (isFulfilled(governanceResult)) setGovernance(governanceResult.value);
    if (isFulfilled(importsResult)) {
      setImports(importsResult.value.items);
      if (selectedImportId && !importsResult.value.items.some((item) => item.id === selectedImportId)) setSelectedImportId(null);
    }
    if (isFulfilled(questionsResult)) {
      setReviewQuestions(questionsResult.value.items);
      setSelectedReviewQuestionIds((ids) => ids.filter((id) => questionsResult.value.items.some((question) => question.id === id)));
    }
    setError(failedLabels.length ? `部分大纲模块暂时无法加载：${failedLabels.join('、')}。可先处理已加载内容，或稍后刷新。` : null);
  }

  async function reloadDataAndNotify() {
    await loadData();
    onDataChanged?.();
  }

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    let isCurrent = true;
    setBusyId('load');
    setError(null);
    void loadData()
      .catch((nextError) => {
        if (isCurrent) setError(formatError(nextError, copy.loadFailed));
      })
      .finally(() => {
        if (isCurrent) setBusyId(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [currentUser?.role, subject, reviewTopicId, reviewSyllabusStatus]);

  useEffect(() => {
    setSelectedReviewQuestionIds([]);
  }, [subject, reviewTopicId, reviewSyllabusStatus, reviewSourceType]);

  function parseJson() {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(copy.invalidJson);
      return parsed;
    } catch (nextError) {
      setError(formatError(nextError, copy.invalidJson));
      return null;
    }
  }

  async function run(actionId: string, action: () => Promise<void>, success?: string) {
    setBusyId(actionId);
    setError(null);
    setFeedback(null);
    try {
      await action();
      if (success) setFeedback(success);
    } catch (nextError) {
      setError(formatError(nextError, copy.loadFailed));
    } finally {
      setBusyId(null);
    }
  }

  async function previewJson() {
    const payload = parseJson();
    if (!payload) return;
    await run('preview', async () => {
      setPreview(await previewAdminAIQuestioningSyllabusJsonImport(payload));
    });
  }

  async function saveImport() {
    const payload = parseJson();
    if (!payload) return;
    await run('save', async () => {
      const result = await createAdminAIQuestioningSyllabusJsonImport(payload);
      setPreview(result.preview);
      setSelectedImportId(result.import.id);
      await reloadDataAndNotify();
    }, copy.saved);
  }

  async function applyImport(importId = selectedImportId) {
    if (!importId) return;
    const previewForImport = importId === selectedImportId && preview
      ? preview
      : imports.find((item) => item.id === importId && isPreview(item.previewSummary))?.previewSummary as AdminAIQuestioningSyllabusJsonImportPreview | undefined;
    const migrationsForImport = previewForImport ? syllabusImportMigrationRows(previewForImport) : [];
    if (migrationsForImport.length && !window.confirm(fillTemplate(copy.migrationConfirm, { count: migrationsForImport.length }))) return;
    await run(`apply-${importId}`, async () => {
      const result = await applyAdminAIQuestioningSyllabusJsonImport(importId, { missingTopicAction });
      setPreview(result.preview);
      setSelectedImportId(result.import.id);
      await reloadDataAndNotify();
    }, copy.applied);
  }

  async function archiveImport(importId: number) {
    await run(`archive-${importId}`, async () => {
      await archiveAdminAIQuestioningSyllabusJsonImport(importId);
      if (selectedImportId === importId) setSelectedImportId(null);
      await reloadDataAndNotify();
    }, copy.archived);
  }

  async function createRecoveryDraft(importId: number) {
    await run(`recovery-draft-${importId}`, async () => {
      const result = await createAdminAIQuestioningSyllabusJsonImportRecoveryDraft(importId);
      setPreview(result.preview);
      setSelectedImportId(result.import.id);
      if (typeof result.import.rawJson === 'object' && result.import.rawJson) setJsonText(JSON.stringify(result.import.rawJson, null, 2));
      await reloadDataAndNotify();
    }, copy.recoveryDraftCreated);
  }

  async function createReversePlan(importId: number) {
    await run(`reverse-plan-${importId}`, async () => {
      const result = await createAdminAIQuestioningSyllabusJsonImportReversePlan(importId);
      setReversePlan(result.reversePlan);
      setSelectedImportId(result.import.id);
      if (isPreview(result.preview)) setPreview(result.preview);
      await reloadDataAndNotify();
    }, copy.reversePlanReady);
  }

  async function refreshGovernance() {
    await run('refresh', async () => {
      await refreshAdminAIQuestioningSyllabusGovernance({ subject: subject || undefined });
      const nextGovernance = await getAdminAIQuestioningSyllabusGovernance({ subject: subject || undefined });
      setGovernance(nextGovernance);
      const nextImports = await listAdminAIQuestioningSyllabusJsonImports({ subject: subject || undefined, limit: 20 });
      setImports(nextImports.items);
      const topicId = /^\d+$/.test(reviewTopicId.trim()) ? Number(reviewTopicId.trim()) : undefined;
      const syllabusStatus = reviewSyllabusStatus || undefined;
      const nextQuestions = await getAdminAIQuestioningQuestions({ subject: subject || undefined, status: 'pending_review', topicId, syllabusStatus, view: 'list' });
      setReviewQuestions(nextQuestions.items);
      onDataChanged?.();
    }, copy.refreshed);
  }

  async function reviewQuestion(questionId: number, action: 'approve' | 'reject' | 'archive') {
    await run(`${action}-question-${questionId}`, async () => {
      if (action === 'approve') await approveAdminAIQuestioningQuestion(questionId);
      if (action === 'reject') await rejectAdminAIQuestioningQuestion(questionId, { reason: 'syllabus_governance_review' });
      if (action === 'archive') await archiveAdminAIQuestioningQuestion(questionId);
      await reloadDataAndNotify();
    });
  }

  function toggleReviewQuestion(questionId: number) {
    setSelectedReviewQuestionIds((ids) => (
      ids.includes(questionId) ? ids.filter((id) => id !== questionId) : [...ids, questionId]
    ));
  }

  function selectVisibleReviewQuestions() {
    const visibleIds = visibleReviewQuestions.map((question) => question.id);
    setSelectedReviewQuestionIds((ids) => Array.from(new Set([...ids, ...visibleIds])));
  }

  async function bulkReviewQuestions(action: 'review' | 'reject' | 'archive') {
    if (selectedVisibleReviewQuestionIds.length === 0) return;
    const label = action === 'review' ? copy.bulkReview : action === 'reject' ? copy.bulkReject : copy.bulkArchive;
    if (!window.confirm(fillTemplate(copy.bulkConfirm, { action: label, count: selectedVisibleReviewQuestionIds.length }))) return;
    await run(`bulk-question-${action}`, async () => {
      const result = await bulkAdminAIQuestioningQuestions({
        action,
        questionIds: selectedVisibleReviewQuestionIds,
        reason: action === 'reject' ? 'syllabus_governance_bulk_review' : undefined,
        limit: selectedVisibleReviewQuestionIds.length
      });
      setFeedback(fillTemplate(copy.bulkComplete, { succeeded: result.succeeded, failed: result.failed }));
      setSelectedReviewQuestionIds([]);
      await reloadDataAndNotify();
    });
  }

  function selectImport(item: AdminAIQuestioningSyllabusJsonImport) {
    setSelectedImportId(item.id);
    if (reversePlan?.importId !== item.id) setReversePlan(null);
    if (typeof item.rawJson === 'object' && item.rawJson) setJsonText(JSON.stringify(item.rawJson, null, 2));
    if (isPreview(item.previewSummary)) setPreview(item.previewSummary);
  }

  async function readJsonFile(file: File | null) {
    if (!file) return;
    setError(null);
    setFeedback(null);
    try {
      const text = await file.text();
      JSON.parse(text);
      setJsonText(text);
      setPreview(null);
      setSelectedImportId(null);
    } catch (nextError) {
      setError(formatError(nextError, copy.invalidJson));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function downloadTemplate() {
    await run('download-template', async () => {
      const template = await getAdminAIQuestioningSyllabusJsonTemplate({ subject: subject || 'math' });
      const templateSubject = typeof template.subject === 'string' ? template.subject : subject || 'math';
      const blob = new Blob([`${JSON.stringify(template, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `csca-syllabus-${templateSubject}-template.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  function downloadTextFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadPreviewReport(format: 'csv' | 'json') {
    if (!preview) return;
    if (format === 'csv') {
      downloadTextFile(
        syllabusImportPreviewFilename(preview, 'csv'),
        `${syllabusImportPreviewCsv(preview)}\n`,
        'text/csv;charset=utf-8'
      );
      return;
    }
    downloadTextFile(
      syllabusImportPreviewFilename(preview, 'json'),
      `${JSON.stringify(syllabusImportPreviewReport(preview), null, 2)}\n`,
      'application/json;charset=utf-8'
    );
  }

  const syllabusControls = (
    <div className="admin-work-hero-actions admin-syllabus-controls">
      <label className="admin-inline-field admin-syllabus-subject-field">
        <span>{copy.subject}</span>
        <select value={subject} onChange={(event) => updateSubject(event.target.value)}>
          <option value="">{copy.allSubjects}</option>
          <option value="math">{copy.math}</option>
          <option value="physics">{copy.physics}</option>
          <option value="chemistry">{copy.chemistry}</option>
        </select>
      </label>
      <button type="button" onClick={() => void refreshGovernance()} disabled={busyId === 'refresh'}>
        <Icon name="lucide:refresh-cw" />
        <span>{copy.refresh}</span>
      </button>
    </div>
  );

  return (
    <>
      <section className="admin-work-panel">
        <div className="admin-ai-subsection-head">
          <div>
            <p className="page-kicker">1 大纲基线</p>
            <h2>{copy.title}</h2>
            <p>{copy.body}</p>
          </div>
          {syllabusControls}
        </div>
      </section>
      {error && <div className="admin-feedback admin-feedback-error">{error}</div>}
      {feedback && <div className="admin-feedback admin-feedback-ok">{feedback}</div>}
      <section className="metric-grid admin-ai-kpi-grid" aria-busy={busyId === 'load'}>
        <MetricCard label={copy.currentTopics} value={`${governance.summary.currentCount}/${governance.summary.total}`} />
        <MetricCard label={copy.staleTopics} value={governance.summary.staleCount} />
        <MetricCard label={copy.unpublishedTopics} value={governance.summary.unpublishedTopicCount} />
        <MetricCard label={copy.pendingReview} value={governance.summary.pendingReviewCount} />
      </section>

      <section className="admin-work-panel admin-syllabus-page-grid">
        <div className="admin-work-card admin-syllabus-editor-card">
          <div className="admin-ai-subsection-head">
            <div>
              <p className="page-kicker">JSON</p>
              <h2>{copy.jsonImport}</h2>
              <p>{copy.jsonBody}</p>
            </div>
            <span>{selectedImport ? `#${selectedImport.id}` : '-'}</span>
          </div>
          <div className="admin-ai-review-actions admin-syllabus-file-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={(event) => void readJsonFile(event.target.files?.[0] ?? null)}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <Icon name="lucide:file-up" />
              <span>{copy.chooseFile}</span>
            </button>
            <button type="button" onClick={() => void downloadTemplate()} disabled={busyId === 'download-template'}>
              <Icon name="lucide:download" />
              <span>{copy.downloadTemplate}</span>
            </button>
          </div>
          <div className="admin-concept-card-editor">
            <label>
              <span>{copy.jsonLabel}</span>
              <textarea className="admin-json-editor" value={jsonText} rows={14} spellCheck={false} onChange={(event) => setJsonText(event.target.value)} />
            </label>
            <label>
              <span>{copy.missingAction}</span>
              <select value={missingTopicAction} onChange={(event) => setMissingTopicAction(event.target.value as 'keep' | 'draft' | 'archive')}>
                <option value="keep">{copy.keep}</option>
                <option value="draft">{copy.draft}</option>
                <option value="archive">{copy.archive}</option>
              </select>
            </label>
          </div>
          <div className="admin-ai-review-actions admin-syllabus-action-bar">
            <button type="button" onClick={() => void previewJson()} disabled={busyId === 'preview' || !jsonText.trim()}>
              <Icon name="lucide:search-check" />
              <span>{copy.preview}</span>
            </button>
            <button type="button" onClick={() => void saveImport()} disabled={busyId === 'save' || !preview}>
              <Icon name="lucide:save" />
              <span>{copy.save}</span>
            </button>
            <button type="button" onClick={() => void applyImport()} disabled={!selectedImportId || selectedImport?.status !== 'draft' || busyId === `apply-${selectedImportId ?? '-'}`}>
              <Icon name="lucide:shield-check" />
              <span>{copy.apply}</span>
            </button>
          </div>
        </div>

        <div className="admin-work-card admin-syllabus-preview-card">
          <div className="admin-ai-subsection-head">
            <div>
              <p className="page-kicker">{copy.selectedDraft}</p>
              <h2>{copy.previewTitle}</h2>
            </div>
            <span>{selectedImport ? selectedImport.status : copy.noSelectedDraft}</span>
          </div>
          {!preview && <EmptyState>{copy.previewEmpty}</EmptyState>}
          {preview && (
            <div className="admin-syllabus-preview-panel">
              <div className="admin-ai-review-actions admin-syllabus-preview-actions">
                <button type="button" onClick={() => downloadPreviewReport('csv')}>
                  <Icon name="lucide:download" />
                  <span>{copy.downloadPreviewCsv}</span>
                </button>
                <button type="button" onClick={() => downloadPreviewReport('json')}>
                  <Icon name="lucide:file-json" />
                  <span>{copy.downloadPreviewJson}</span>
                </button>
              </div>
              <p>{fillTemplate(copy.impact, {
                topics: preview.summary.topicsInFile,
                created: preview.summary.newTopics,
                updated: preview.summary.updatedTopics,
                missing: preview.summary.missingFromFile,
                affected: preview.summary.questionsAffected,
                approved: preview.summary.approvedQuestionsBecomingPendingReview
              })}</p>
              <section className="admin-syllabus-migration-panel" aria-label={copy.migrationTitle}>
                <div className="admin-syllabus-migration-head">
                  <strong>{copy.migrationTitle}</strong>
                  <span>{migrationRows.length}</span>
                </div>
                {migrationRows.length === 0 && <p>{copy.migrationEmpty}</p>}
                {migrationRows.slice(0, 8).map((row) => (
                  <p key={`${row.previousCode}-${row.nextCode}`}>
                    {fillTemplate(copy.migrationRow, {
                      from: row.previousCode,
                      to: row.nextCode,
                      id: row.existingTopicId ?? '-',
                      affected: row.affectedQuestionCount,
                      approved: row.approvedQuestionsBecomingPendingReview
                    })}
                    {row.titleBefore || row.titleAfter ? ` · ${row.titleBefore || '-'} / ${row.titleAfter || '-'}` : ''}
                  </p>
                ))}
              </section>
              {preview.items.slice(0, 8).map((item) => (
                <p key={`preview-${item.code}`}>{item.action} · {item.code} · {String(item.after.title ?? '-')} · {item.affectedQuestionCount}</p>
              ))}
              {preview.missingFromFile.slice(0, 5).map((item) => (
                <p key={`missing-${item.id}`}>missing · {item.code} · {item.title} · approved {item.approvedQuestionCount}</p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="admin-work-panel">
        <div className="admin-ai-subsection-head">
          <div>
            <p className="page-kicker">{copy.pendingReview}</p>
            <h2>{copy.reviewQueue}</h2>
            <p>{copy.reviewQueueBody}</p>
          </div>
          <span>{filteredReviewQuestions.length}/{reviewQuestions.length}</span>
        </div>
        <div className="admin-filter-grid admin-syllabus-review-filters" aria-label={copy.reviewFilters}>
          <label>
            {copy.reviewTopicId}
            <input
              value={reviewTopicId}
              inputMode="numeric"
              placeholder="topic id"
              onChange={(event) => setReviewTopicId(event.target.value.replace(/[^\d]/g, ''))}
            />
          </label>
          <label>
            {copy.reviewSyllabusStatus}
            <select value={reviewSyllabusStatus} onChange={(event) => setReviewSyllabusStatus(event.target.value)}>
              <option value="">{copy.allSyllabusStatuses}</option>
              <option value="stale">{copy.staleSyllabusStatus}</option>
              <option value="current">{copy.currentSyllabusStatus}</option>
            </select>
          </label>
          <label>
            {copy.reviewSourceType}
            <select value={reviewSourceType} onChange={(event) => setReviewSourceType(event.target.value)}>
              <option value="">{copy.allSources}</option>
              <option value="ai">{copy.aiSource}</option>
              <option value="bank">{copy.bankSource}</option>
              <option value="imported">{copy.importedSource}</option>
              <option value="mock_exam">{copy.mockExamSource}</option>
              <option value="special_practice">{copy.specialPracticeSource}</option>
            </select>
          </label>
        </div>
        {filteredReviewQuestions.length > 0 && (
          <div className="admin-callout admin-syllabus-review-bulk">
            <strong>{fillTemplate(copy.selectedQuestions, { count: selectedVisibleReviewQuestionIds.length })}</strong>
            <span>{copy.bulkBoundary}</span>
            <div className="admin-inline-actions">
              <button type="button" className="ghost-button" onClick={selectVisibleReviewQuestions}>
                {copy.selectPage}
              </button>
              <button type="button" className="ghost-button" onClick={() => setSelectedReviewQuestionIds([])} disabled={selectedReviewQuestionIds.length === 0}>
                {copy.clearSelection}
              </button>
              <button type="button" className="ghost-button" onClick={() => void bulkReviewQuestions('review')} disabled={selectedVisibleReviewQuestionIds.length === 0 || busyId === 'bulk-question-review'}>
                {copy.bulkReview}
              </button>
              <button type="button" className="ghost-button" onClick={() => void bulkReviewQuestions('reject')} disabled={selectedVisibleReviewQuestionIds.length === 0 || busyId === 'bulk-question-reject'}>
                {copy.bulkReject}
              </button>
              <button type="button" className="ghost-button" onClick={() => void bulkReviewQuestions('archive')} disabled={selectedVisibleReviewQuestionIds.length === 0 || busyId === 'bulk-question-archive'}>
                {copy.bulkArchive}
              </button>
            </div>
          </div>
        )}
        {filteredReviewQuestions.length === 0 && <EmptyState>{copy.noReviewQuestions}</EmptyState>}
        {visibleReviewQuestions.map((question) => {
          const options = questionOptions(question.options);
          return (
            <article key={question.id} className="process-row admin-governance-row admin-syllabus-review-row">
              <label className="admin-row-selector">
                <input
                  type="checkbox"
                  checked={selectedReviewQuestionIds.includes(question.id)}
                  onChange={() => toggleReviewQuestion(question.id)}
                  aria-label={`#${question.id}`}
                />
                <span>{question.id}</span>
              </label>
              <div>
                <strong><MathContent text={question.prompt} /></strong>
                <p>{question.subject} · {question.designedDifficulty} · {question.questionType} · {question.syllabusVersion}</p>
                <details className="admin-question-evidence-panel">
                  <summary>{copy.view}</summary>
                  <div className="admin-question-option-list">
                    {options.map((option) => (
                      <span key={`${question.id}-${option.id}`}>
                        <b>{option.id}</b>
                        <MathContent text={option.text} />
                      </span>
                    ))}
                  </div>
                  <p>{copy.correctAnswer}: {question.correctAnswer}</p>
                  <p>{copy.explanation}: <MathContent text={question.explanation || '-'} /></p>
                </details>
              </div>
              <div className="admin-ai-review-actions">
                <button type="button" onClick={() => void reviewQuestion(question.id, 'approve')} disabled={busyId === `approve-question-${question.id}`}>
                  <Icon name="lucide:check" />
                  <span>{copy.approve}</span>
                </button>
                <button type="button" onClick={() => void reviewQuestion(question.id, 'reject')} disabled={busyId === `reject-question-${question.id}`}>
                  <Icon name="lucide:x" />
                  <span>{copy.reject}</span>
                </button>
                <button type="button" onClick={() => void reviewQuestion(question.id, 'archive')} disabled={busyId === `archive-question-${question.id}`}>
                  <Icon name="lucide:archive" />
                  <span>{copy.archiveQuestion}</span>
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="admin-work-panel">
        <div className="admin-ai-subsection-head">
          <div>
            <p className="page-kicker">{copy.status}</p>
            <h2>{copy.recentImports}</h2>
          </div>
          <span>{imports.length}</span>
        </div>
        {imports.length === 0 && <EmptyState>{copy.noImports}</EmptyState>}
        {imports.map((item) => {
          const appliedMigrations = syllabusImportAppliedMigrationRows(item.previewSummary);
          return (
            <article key={item.id} className="process-row admin-governance-row admin-syllabus-import-row">
              <span>{item.status === 'applied' ? 'OK' : item.status === 'archived' ? 'ARC' : 'NEW'}</span>
              <div>
                <strong>#{item.id} · {item.subject} · {item.syllabusVersion}</strong>
                <p>{copy.status}: {item.status} · {copy.source}: {item.sourceLabel ?? '-'} · {copy.createdAt}: {formatDate(item.createdAt, copy.dateLocale)}</p>
                {isPreview(item.previewSummary) && (
                  <p>{fillTemplate(copy.impact, {
                    topics: item.previewSummary.summary.topicsInFile,
                    created: item.previewSummary.summary.newTopics,
                    updated: item.previewSummary.summary.updatedTopics,
                    missing: item.previewSummary.summary.missingFromFile,
                    affected: item.previewSummary.summary.questionsAffected,
                    approved: item.previewSummary.summary.approvedQuestionsBecomingPendingReview
                  })}</p>
                )}
                {appliedMigrations.length > 0 && (
                  <details className="admin-syllabus-applied-migrations">
                    <summary>{fillTemplate(copy.appliedMigrationSummary, { count: appliedMigrations.length })}</summary>
                    {appliedMigrations.slice(0, 8).map((row) => (
                      <p key={`${item.id}-${row.previousCode}-${row.nextCode}`}>
                        {fillTemplate(copy.migrationRow, {
                          from: row.previousCode,
                          to: row.nextCode,
                          id: row.existingTopicId ?? '-',
                          affected: row.affectedQuestionCount,
                          approved: row.approvedQuestionsBecomingPendingReview
                        })}
                      </p>
                    ))}
                  </details>
                )}
              </div>
              <div className="admin-ai-review-actions">
                <button type="button" onClick={() => selectImport(item)}>
                  <Icon name="lucide:eye" />
                  <span>{copy.view}</span>
                </button>
                <button type="button" onClick={() => void applyImport(item.id)} disabled={item.status !== 'draft' || busyId === `apply-${item.id}`}>
                  <Icon name="lucide:shield-check" />
                  <span>{copy.apply}</span>
                </button>
                <button type="button" onClick={() => void archiveImport(item.id)} disabled={item.status !== 'draft' || busyId === `archive-${item.id}`}>
                  <Icon name="lucide:archive" />
                  <span>{copy.archiveDraft}</span>
                </button>
                <button type="button" onClick={() => void createRecoveryDraft(item.id)} disabled={busyId === `recovery-draft-${item.id}`}>
                  <Icon name="lucide:copy-plus" />
                  <span>{copy.recoveryDraft}</span>
                </button>
                <button type="button" onClick={() => void createReversePlan(item.id)} disabled={item.status !== 'applied' || busyId === `reverse-plan-${item.id}`}>
                  <Icon name="lucide:file-search" />
                  <span>{copy.reversePlan}</span>
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {selectedImport && selectedImportPreview && (
        <section className="admin-work-panel admin-syllabus-selected-import">
          <div className="admin-ai-subsection-head">
            <div>
              <p className="page-kicker">#{selectedImport.id} · {selectedImport.status}</p>
              <h2>{copy.selectedImportDetail}</h2>
              <p>{copy.selectedImportBody}</p>
            </div>
            <span>{selectedImport.subject} · {selectedImport.syllabusVersion}</span>
          </div>
          <div className="admin-stats-grid admin-syllabus-import-summary-grid">
            {selectedImportRecovery && (
              <div>
                <span>{copy.recoverySource}</span>
                <strong>#{selectedImportRecovery.sourceImportId}</strong>
                <small>
                  {fillTemplate(copy.recoverySourceRow, {
                    id: selectedImportRecovery.sourceImportId,
                    status: selectedImportRecovery.sourceImportStatus || '-'
                  })}
                  {' · '}
                  {copy.recoveryReviewHint}
                </small>
              </div>
            )}
            <div>
              <span>{copy.importSummary}</span>
              <strong>{selectedImportPreview.summary.questionsAffected}</strong>
              <small>{fillTemplate(copy.impact, {
                topics: selectedImportPreview.summary.topicsInFile,
                created: selectedImportPreview.summary.newTopics,
                updated: selectedImportPreview.summary.updatedTopics,
                missing: selectedImportPreview.summary.missingFromFile,
                affected: selectedImportPreview.summary.questionsAffected,
                approved: selectedImportPreview.summary.approvedQuestionsBecomingPendingReview
              })}</small>
            </div>
            <div>
              <span>{copy.migrationTitle}</span>
              <strong>{selectedImportAppliedMigrations.length}</strong>
              <small>{fillTemplate(copy.appliedMigrationSummary, { count: selectedImportAppliedMigrations.length })}</small>
            </div>
            <div>
              <span>{copy.pendingReview}</span>
              <strong>{selectedImportPreview.summary.approvedQuestionsBecomingPendingReview}</strong>
              <small>{copy.reviewQueue}</small>
            </div>
            {selectedReversePlan && (
              <div>
                <span>{copy.reversePlanTitle}</span>
                <strong>{selectedReversePlan.summary.blockerCount}</strong>
                <small>{fillTemplate(copy.reversePlanSummary, {
                  operations: selectedReversePlan.summary.topicOperations + selectedReversePlan.summary.missingTopicOperations,
                  auto: selectedReversePlan.summary.canAutoPlanOperations,
                  blockers: selectedReversePlan.summary.blockerCount,
                  manual: selectedReversePlan.summary.manualReviewRequired,
                  questions: selectedReversePlan.summary.questionReviewCount
                })}</small>
              </div>
            )}
          </div>
          {selectedReversePlan && (
            <details className="admin-question-evidence-panel" open>
              <summary>{copy.reversePlanTitle}</summary>
              <p>{copy.reversePlanBody}</p>
              <p>{copy.reversePlanGuidance}</p>
              {selectedReversePlan.blockers.length > 0 && (
                <p>{selectedReversePlan.blockers.join(', ')}</p>
              )}
              {selectedReversePlan.operations.slice(0, 12).map((item) => (
                <p key={`${selectedImport.id}-reverse-${item.code}`}>
                  {item.operation} · {item.previousCode ? `${item.previousCode} -> ${item.code}` : item.code} · {item.canAutoPlan ? 'auto-plan' : item.blockers.join(', ')}
                </p>
              ))}
            </details>
          )}
          {selectedImportAppliedMigrations.length > 0 && (
            <details className="admin-question-evidence-panel" open>
              <summary>{copy.migrationTitle}</summary>
              {selectedImportAppliedMigrations.slice(0, 20).map((row) => (
                <p key={`${selectedImport.id}-detail-${row.previousCode}-${row.nextCode}`}>
                  {fillTemplate(copy.migrationRow, {
                    from: row.previousCode,
                    to: row.nextCode,
                    id: row.existingTopicId ?? '-',
                    affected: row.affectedQuestionCount,
                    approved: row.approvedQuestionsBecomingPendingReview
                  })}
                  {row.titleBefore || row.titleAfter ? ` · ${row.titleBefore || '-'} / ${row.titleAfter || '-'}` : ''}
                </p>
              ))}
            </details>
          )}
          <details className="admin-question-evidence-panel" open>
            <summary>{copy.incomingChanges}</summary>
            {selectedImportPreview.items.slice(0, 20).map((item) => (
              <p key={`${selectedImport.id}-detail-${item.code}`}>
                {item.action} · {item.code} · {String(item.after.title ?? '-')} · {item.affectedQuestionCount}
              </p>
            ))}
          </details>
          <details className="admin-question-evidence-panel">
            <summary>{copy.missingTopics}</summary>
            {selectedImportPreview.missingFromFile.slice(0, 20).map((item) => (
              <p key={`${selectedImport.id}-missing-${item.id}`}>
                {item.code} · {item.title} · {item.status} · approved {item.approvedQuestionCount}
              </p>
            ))}
            {selectedImportPreview.missingFromFile.length === 0 && <p>{copy.noGovernanceItems}</p>}
          </details>
        </section>
      )}

      <section className="admin-work-panel">
        <div className="admin-ai-subsection-head">
          <div>
            <p className="page-kicker">{copy.pendingReview}</p>
            <h2>{copy.governanceQueue}</h2>
          </div>
          <span>{governance.items.length}</span>
        </div>
        {governance.items.length === 0 && <EmptyState>{copy.noGovernanceItems}</EmptyState>}
        {governance.items.slice(0, 20).map((item) => (
          <article key={item.topicId} className="process-row admin-governance-row admin-syllabus-risk-row">
            <span>{item.topicStatus === 'published' ? 'PUB' : 'HOLD'}</span>
            <div>
              <strong>{item.topicTitle}</strong>
              <p>{item.subject} · {item.questionSyllabusVersion} → {item.topicSyllabusVersion} · {item.topicStatus} · {item.status}</p>
              {item.sourceUrl && <p>{copy.source}: {item.sourceLabel ?? item.sourceUrl}</p>}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
