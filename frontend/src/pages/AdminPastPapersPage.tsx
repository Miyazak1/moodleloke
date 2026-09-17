import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/past-papers.css';
import { AdminPageShell } from '../components/AdminPageShell';
import { AdminWorkflowSteps } from '../components/admin/AdminWorkbench';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminFormField, GhostButton } from '../components/UiPrimitives';
import {
  archiveAdminPastPaper,
  archiveAdminResourceBundle,
  createAdminPastPaper,
  createAdminPastPaperFile,
  createAdminResourceBundle,
  createAdminResourceBundleItem,
  deleteAdminResourceBundleItem,
  getAdminPastPaper,
  getAdminPastPapers,
  getAdminPastPaperSourceDocuments,
  getAdminResourceBundle,
  getAdminResourceBundles,
  publishAdminPastPaper,
  publishAdminResourceBundle,
  updateAdminPastPaper,
  updateAdminResourceBundle,
  uploadAdminPastPaperFile,
  type AdminPastPaper,
  type AdminResourceBundle,
  type MockExamSubjectId,
  type PastPaperDetail,
  type PastPaperSourceDocument,
  type ResourceBundleDetail,
  type User
} from '../lib/api';

type FormState = {
  slug: string;
  title: string;
  category: 'past-paper' | 'mock-paper';
  subject: MockExamSubjectId;
  examYear: string;
  examMonth: string;
  sessionLabel: string;
  description: string;
  questionCount: string;
  pageCount: string;
  coverUrl: string;
  sortOrder: string;
  sourceDocumentId: string;
  isFeatured: boolean;
  isPublished: boolean;
  hasAnswers: boolean;
  hasSolutions: boolean;
  fileKind: string;
  fileLabel: string;
  fileUrl: string;
};

type PastPaperBusyAction = 'save' | 'publish' | 'archive' | 'upload-pdf' | 'add-file';
type AdminPastPaperTab = 'papers' | 'bundles';
type BundleBusyAction = 'bundle-save' | 'bundle-publish' | 'bundle-archive' | 'bundle-add-item' | 'bundle-remove-item';

type BundleFormState = {
  slug: string;
  title: string;
  category: 'past-paper' | 'mock-paper';
  subjectScope: MockExamSubjectId | 'mixed';
  description: string;
  coverUrl: string;
  highlights: string;
  tags: string;
  sortOrder: string;
  isFeatured: boolean;
  isPublished: boolean;
  itemPastPaperId: string;
  itemLabel: string;
  itemSortOrder: string;
};

const EMPTY_FORM: FormState = {
  slug: '',
  title: '',
  category: 'past-paper',
  subject: 'math',
  examYear: '2026',
  examMonth: '',
  sessionLabel: '',
  description: '',
  questionCount: '48',
  pageCount: '',
  coverUrl: '',
  sortOrder: '0',
  sourceDocumentId: '',
  isFeatured: false,
  isPublished: false,
  hasAnswers: false,
  hasSolutions: false,
  fileKind: 'paper',
  fileLabel: '原卷 PDF',
  fileUrl: ''
};

const EMPTY_BUNDLE_FORM: BundleFormState = {
  slug: '',
  title: '',
  category: 'past-paper',
  subjectScope: 'math',
  description: '',
  coverUrl: '',
  highlights: '免费下载\n含答案解析',
  tags: '',
  sortOrder: '0',
  isFeatured: false,
  isPublished: false,
  itemPastPaperId: '',
  itemLabel: '',
  itemSortOrder: '0'
};

const CATEGORY_LABELS = {
  'past-paper': '真题',
  'mock-paper': '模拟卷'
} as const;

const CATEGORY_BODY = {
  'past-paper': '管理真实考试资料、答案、解析和评分标准。',
  'mock-paper': '管理自制模拟卷、答案解析和可下载 PDF。'
} as const;

function appendPastPaperMessage(current: string, next: string) {
  return [current, next].filter(Boolean).join('；');
}

function formFromPaper(paper: AdminPastPaper): FormState {
  return {
    ...EMPTY_FORM,
    slug: paper.slug,
    title: paper.title,
    category: paper.category === 'mock-paper' ? 'mock-paper' : 'past-paper',
    subject: paper.subject,
    examYear: String(paper.examYear ?? ''),
    examMonth: paper.examMonth ?? '',
    sessionLabel: paper.sessionLabel ?? '',
    description: paper.description ?? '',
    questionCount: String(paper.questionCount ?? ''),
    pageCount: String(paper.pageCount ?? ''),
    coverUrl: paper.coverUrl ?? '',
    sortOrder: String(paper.sortOrder),
    sourceDocumentId: String(paper.sourceDocumentId ?? ''),
    isFeatured: paper.isFeatured,
    isPublished: paper.isPublished,
    hasAnswers: paper.hasAnswers,
    hasSolutions: paper.hasSolutions
  };
}

function formFromBundle(bundle: AdminResourceBundle): BundleFormState {
  const subjectScope = bundle.subjectScope === 'mixed' || bundle.subjectScope === 'math' || bundle.subjectScope === 'physics' || bundle.subjectScope === 'chemistry'
    ? bundle.subjectScope
    : 'mixed';
  return {
    ...EMPTY_BUNDLE_FORM,
    slug: bundle.slug,
    title: bundle.title,
    category: bundle.category === 'mock-paper' ? 'mock-paper' : 'past-paper',
    subjectScope,
    description: bundle.description ?? '',
    coverUrl: bundle.coverUrl ?? '',
    highlights: (bundle.highlights ?? []).join('\n'),
    tags: (bundle.tags ?? []).join('\n'),
    sortOrder: String(bundle.sortOrder),
    isFeatured: bundle.isFeatured,
    isPublished: bundle.isPublished
  };
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function payloadFromForm(form: FormState) {
  return {
    slug: form.slug,
    title: form.title,
    category: form.category,
    subject: form.subject,
    examYear: optionalNumber(form.examYear),
    examMonth: form.examMonth || undefined,
    sessionLabel: form.sessionLabel || undefined,
    description: form.description || undefined,
    questionCount: optionalNumber(form.questionCount),
    pageCount: optionalNumber(form.pageCount),
    coverUrl: form.coverUrl || undefined,
    sortOrder: optionalNumber(form.sortOrder) ?? 0,
    sourceDocumentId: optionalNumber(form.sourceDocumentId) ?? null,
    isFeatured: form.isFeatured,
    isPublished: form.isPublished,
    hasAnswers: form.hasAnswers,
    hasSolutions: form.hasSolutions
  };
}

function linesFromText(value: string) {
  return value.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean);
}

function payloadFromBundleForm(form: BundleFormState) {
  return {
    slug: form.slug,
    title: form.title,
    category: form.category,
    subjectScope: form.subjectScope,
    description: form.description || undefined,
    coverUrl: form.coverUrl || undefined,
    highlights: linesFromText(form.highlights),
    tags: linesFromText(form.tags),
    sortOrder: optionalNumber(form.sortOrder) ?? 0,
    isFeatured: form.isFeatured,
    isPublished: form.isPublished
  };
}

export function AdminPastPapersPage({
  currentUser,
  onBackAudit,
  onGoToContent,
  onGoToSchools,
  onGoToScholarships,
  onGoToMockExams,
  onGoToSpecialPractice,
  onGoToUsers,
  onGoToAuth
}: {
  currentUser: User | null;
  onBackAudit: () => void;
  onGoToContent: () => void;
  onGoToSchools: () => void;
  onGoToScholarships: () => void;
  onGoToMockExams: () => void;
  onGoToSpecialPractice: () => void;
  onGoToUsers: () => void;
  onGoToAuth: () => void;
}) {
  const [items, setItems] = useState<AdminPastPaper[]>([]);
  const [bundles, setBundles] = useState<AdminResourceBundle[]>([]);
  const [sourceDocuments, setSourceDocuments] = useState<PastPaperSourceDocument[]>([]);
  const [selected, setSelected] = useState<PastPaperDetail | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<ResourceBundleDetail | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [bundleForm, setBundleForm] = useState<BundleFormState>(EMPTY_BUNDLE_FORM);
  const [activeTab, setActiveTab] = useState<AdminPastPaperTab>('papers');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'past-paper' | 'mock-paper'>('all');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState<PastPaperBusyAction | BundleBusyAction | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<'paper-publish' | 'paper-archive' | 'bundle-publish' | 'bundle-archive' | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const selectionRequestRef = useRef(0);
  const hasBusyAction = busyAction !== null;
  const isActionBusy = (action: PastPaperBusyAction | BundleBusyAction) => busyAction === action;
  const summary = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.isPublished).length,
    files: items.reduce((sum, item) => sum + item.fileCount, 0),
    mockPapers: items.filter((item) => item.category === 'mock-paper').length,
    bundles: bundles.length
  }), [items, bundles]);
  const visibleItems = useMemo(
    () => categoryFilter === 'all' ? items : items.filter((item) => item.category === categoryFilter),
    [categoryFilter, items]
  );
  const visibleBundles = useMemo(
    () => categoryFilter === 'all' ? bundles : bundles.filter((item) => item.category === categoryFilter),
    [categoryFilter, bundles]
  );

  async function refresh() {
    const result = await getAdminPastPapers();
    setItems(result.items);
  }

  async function refreshBundles() {
    const result = await getAdminResourceBundles();
    setBundles(result.items);
  }

  async function refreshAll() {
    const [, , sourceResult] = await Promise.all([refresh(), refreshBundles(), getAdminPastPaperSourceDocuments()]);
    setSourceDocuments(sourceResult.items);
  }

  useEffect(() => {
    void refreshAll().catch((error) => setMessage((error as Error).message || '真题资料后台暂时无法加载。'));
  }, []);

  async function selectPaper(id: number, options: { preserveMessage?: boolean } = {}) {
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setDetailLoadingId(id);
    if (!options.preserveMessage) setMessage('正在读取资料详情...');
    try {
      const detail = await getAdminPastPaper(id);
      if (selectionRequestRef.current !== requestId) return;
      setSelected(detail);
      setForm(formFromPaper(detail.paper));
      if (!options.preserveMessage) setMessage('');
    } catch (error) {
      if (selectionRequestRef.current !== requestId) return;
      const detailMessage = (error as Error).message || '资料详情暂时无法加载。';
      setMessage((current) => options.preserveMessage
        ? appendPastPaperMessage(current, `详情暂时无法刷新：${detailMessage}`)
        : detailMessage);
    } finally {
      if (selectionRequestRef.current === requestId) setDetailLoadingId(null);
    }
  }

  async function selectBundle(id: number, options: { preserveMessage?: boolean } = {}) {
    if (!options.preserveMessage) setMessage('正在读取套装详情...');
    try {
      const detail = await getAdminResourceBundle(id);
      setSelectedBundle(detail);
      setBundleForm(formFromBundle(detail.bundle));
      setActiveTab('bundles');
      if (!options.preserveMessage) setMessage('');
    } catch (error) {
      const detailMessage = (error as Error).message || '套装详情暂时无法加载。';
      setMessage((current) => options.preserveMessage
        ? appendPastPaperMessage(current, `套装详情暂时无法刷新：${detailMessage}`)
        : detailMessage);
    }
  }

  async function saveBundle() {
    setBusyAction('bundle-save');
    setMessage('');
    let savedId: number | null = null;
    try {
      const payload = payloadFromBundleForm(bundleForm);
      const saved = selectedBundle
        ? await updateAdminResourceBundle(selectedBundle.bundle.id, { ...payload, expectedVersion: selectedBundle.bundle.version })
        : await createAdminResourceBundle(payload);
      savedId = saved.id;
      setMessage('已保存资料套装。');
    } catch (error) {
      setMessage((error as Error).message || '保存套装失败。');
      setBusyAction(null);
      return;
    }
    try {
      await refreshBundles();
      if (savedId !== null) await selectBundle(savedId, { preserveMessage: true });
    } finally {
      setBusyAction(null);
    }
  }

  async function publishBundle() {
    if (!selectedBundle) return;
    setBusyAction('bundle-publish');
    try {
      const saved = await publishAdminResourceBundle(selectedBundle.bundle.id, selectedBundle.bundle.version);
      setMessage('套装已发布。');
      await refreshBundles();
      await selectBundle(saved.id, { preserveMessage: true });
    } catch (error) {
      setMessage((error as Error).message || '发布套装失败。');
    } finally {
      setBusyAction(null);
    }
  }

  async function archiveBundle() {
    if (!selectedBundle) return;
    setBusyAction('bundle-archive');
    try {
      const saved = await archiveAdminResourceBundle(selectedBundle.bundle.id, selectedBundle.bundle.version);
      setMessage('套装已下架。');
      await refreshBundles();
      await selectBundle(saved.id, { preserveMessage: true });
    } catch (error) {
      setMessage((error as Error).message || '下架套装失败。');
    } finally {
      setBusyAction(null);
    }
  }

  async function addBundleItem() {
    if (!selectedBundle) {
      setMessage('请先保存并选择一个套装。');
      return;
    }
    const pastPaperId = Number(bundleForm.itemPastPaperId);
    if (!Number.isInteger(pastPaperId) || pastPaperId < 1) {
      setMessage('请选择要加入套装的资料。');
      return;
    }
    setBusyAction('bundle-add-item');
    try {
      const detail = await createAdminResourceBundleItem(selectedBundle.bundle.id, {
        pastPaperId,
        label: bundleForm.itemLabel || undefined,
        sortOrder: optionalNumber(bundleForm.itemSortOrder) ?? 0
      });
      setSelectedBundle(detail);
      setBundleForm({ ...formFromBundle(detail.bundle), itemPastPaperId: '', itemLabel: '', itemSortOrder: '0' });
      setMessage('已加入套装。');
      await refreshBundles();
    } catch (error) {
      setMessage((error as Error).message || '加入套装失败。');
    } finally {
      setBusyAction(null);
    }
  }

  async function removeBundleItem(itemId: number) {
    if (!selectedBundle) return;
    setBusyAction('bundle-remove-item');
    try {
      const detail = await deleteAdminResourceBundleItem(selectedBundle.bundle.id, itemId);
      setSelectedBundle(detail);
      setBundleForm(formFromBundle(detail.bundle));
      setMessage('已从套装移出，不会删除原资料。');
      await refreshBundles();
    } catch (error) {
      setMessage((error as Error).message || '移出套装失败。');
    } finally {
      setBusyAction(null);
    }
  }

  async function savePaper() {
    setBusyAction('save');
    setMessage('');
    let savedId: number | null = null;
    let savedCategory = form.category;
    try {
      const payload = payloadFromForm(form);
      const saved = selected
        ? await updateAdminPastPaper(selected.paper.id, { ...payload, expectedVersion: selected.paper.version })
        : await createAdminPastPaper(payload);
      savedId = saved.id;
      savedCategory = payload.category;
      setMessage(`已保存${CATEGORY_LABELS[payload.category as keyof typeof CATEGORY_LABELS] ?? '资料'}。`);
    } catch (error) {
      setMessage((error as Error).message || '保存失败。');
      setBusyAction(null);
      return;
    }

    try {
      await refresh();
      if (savedId !== null) await selectPaper(savedId, { preserveMessage: true });
    } catch (error) {
      setMessage(`已保存${CATEGORY_LABELS[savedCategory as keyof typeof CATEGORY_LABELS] ?? '资料'}，但刷新列表失败：${(error as Error).message || '请稍后手动刷新。'}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function publish() {
    if (!selected) return;
    setBusyAction('publish');
    let savedId: number | null = null;
    try {
      const saved = await publishAdminPastPaper(selected.paper.id, selected.paper.version);
      savedId = saved.id;
      setMessage('已发布。');
    } catch (error) {
      setMessage((error as Error).message || '发布失败。');
      setBusyAction(null);
      return;
    }

    try {
      await refresh();
      if (savedId !== null) await selectPaper(savedId, { preserveMessage: true });
    } catch (error) {
      setMessage(`已发布，但刷新列表失败：${(error as Error).message || '请稍后手动刷新。'}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function archive() {
    if (!selected) return;
    setBusyAction('archive');
    try {
      await archiveAdminPastPaper(selected.paper.id, selected.paper.version);
      setSelected(null);
      setForm(EMPTY_FORM);
      setMessage('已归档。');
    } catch (error) {
      setMessage((error as Error).message || '归档失败。');
      setBusyAction(null);
      return;
    }

    try {
      await refresh();
    } catch (error) {
      setMessage(`已归档，但刷新列表失败：${(error as Error).message || '请稍后手动刷新。'}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function addFile() {
    if (!selected) {
      setMessage('请先保存资料，再添加文件。');
      return;
    }
    setBusyAction('add-file');
    try {
      await createAdminPastPaperFile(selected.paper.id, { kind: form.fileKind, label: form.fileLabel, fileUrl: form.fileUrl });
      setMessage('已添加文件。');
    } catch (error) {
      setMessage((error as Error).message || '添加文件失败。');
      setBusyAction(null);
      return;
    }

    try {
      await selectPaper(selected.paper.id, { preserveMessage: true });
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadPdf() {
    if (!selected) {
      setMessage('请先保存资料，再上传文件。');
      return;
    }
    if (!uploadFile) {
      setMessage('请选择要上传的 PDF 文件。');
      return;
    }
    setBusyAction('upload-pdf');
    try {
      await uploadAdminPastPaperFile(selected.paper.id, { kind: form.fileKind, label: form.fileLabel, file: uploadFile });
      setUploadFile(null);
      setMessage('PDF 已上传并加入该资料。');
    } catch (error) {
      setMessage((error as Error).message || '上传失败。');
      setBusyAction(null);
      return;
    }

    try {
      await selectPaper(selected.paper.id, { preserveMessage: true });
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmPendingAction() {
    const action = pendingConfirmation;
    if (!action) return;
    if (action === 'paper-publish') await publish();
    if (action === 'paper-archive') await archive();
    if (action === 'bundle-publish') await publishBundle();
    if (action === 'bundle-archive') await archiveBundle();
    setPendingConfirmation(null);
  }

  return (
    <AdminPageShell
      current="pastPapers"
      currentUser={currentUser}
      className="admin-past-paper-page"
      heroClassName="past-paper-admin-hero"
      kicker="后台 / PDF 资料"
      title="PDF 资料与下载资源管理"
      body="真题和模拟卷共用这一套上传管理。用分类区分资料类型，上传后由服务器自托管下载。"
      heroAside={(
        <dl className="admin-past-paper-stats">
          <div><dt>资料</dt><dd>{summary.total}</dd></div>
          <div><dt>套装</dt><dd>{summary.bundles}</dd></div>
          <div><dt>模拟卷</dt><dd>{summary.mockPapers}</dd></div>
          <div><dt>已发布</dt><dd>{summary.published}</dd></div>
          <div><dt>文件</dt><dd>{summary.files}</dd></div>
        </dl>
      )}
      onGoToAuth={onGoToAuth}
      onGoToAudit={onBackAudit}
      onGoToContent={onGoToContent}
      onGoToSchools={onGoToSchools}
      onGoToScholarships={onGoToScholarships}
      onGoToMockExams={onGoToMockExams}
      onGoToSpecialPractice={onGoToSpecialPractice}
      onGoToUsers={onGoToUsers}
    >
      {message && <p className="admin-inline-message">{message}</p>}
      <div className="admin-filter-pills" aria-label="资料管理模式">
        <button type="button" className={activeTab === 'papers' ? 'active' : ''} onClick={() => setActiveTab('papers')}>单份资料</button>
        <button type="button" className={activeTab === 'bundles' ? 'active' : ''} onClick={() => setActiveTab('bundles')}>资料套装</button>
      </div>
      <p className="admin-helper-text admin-upload-path-note">
        {activeTab === 'papers'
          ? '上传路径：先保存单份资料，再在文件区选择原卷、答案或解析 PDF 上传。'
          : '套装不直接上传文件。请先到“单份资料”创建资料并上传 PDF，再回到这里把资料加入套装。'}
      </p>
      <AdminWorkflowSteps
        ariaLabel={activeTab === 'papers' ? '单份资料发布流程' : '资料套装发布流程'}
        items={activeTab === 'papers' ? [
          { key: 'select', label: '选择或新建资料', detail: '确定资料类型与学科', state: selected || form.title ? 'complete' : 'active' },
          { key: 'save', label: '保存资料', detail: '生成资料记录', state: selected ? 'complete' : form.title ? 'active' : 'upcoming' },
          { key: 'file', label: '添加 PDF', detail: selected?.files.length ? `${selected.files.length} 个文件` : '原卷、答案或解析', state: selected?.files.length ? 'complete' : selected ? 'active' : 'upcoming' },
          { key: 'publish', label: '发布上线', detail: '进入前台资料区', state: selected?.paper.isPublished ? 'complete' : selected?.files.length ? 'active' : 'upcoming' }
        ] : [
          { key: 'select', label: '选择或新建套装', detail: '设置名称与适用范围', state: selectedBundle || bundleForm.title ? 'complete' : 'active' },
          { key: 'save', label: '保存套装', detail: '生成套装记录', state: selectedBundle ? 'complete' : bundleForm.title ? 'active' : 'upcoming' },
          { key: 'items', label: '加入资料', detail: selectedBundle?.items.length ? `${selectedBundle.items.length} 份资料` : '选择已有 PDF 资料', state: selectedBundle?.items.length ? 'complete' : selectedBundle ? 'active' : 'upcoming' },
          { key: 'publish', label: '发布套装', detail: '前台整体展示', state: selectedBundle?.bundle.isPublished ? 'complete' : selectedBundle?.items.length ? 'active' : 'upcoming' }
        ]}
      />
      {activeTab === 'papers' ? (
      <div className="admin-shell">
        <section className="admin-list-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="page-kicker">Past Papers</p>
              <h2>资料列表</h2>
            </div>
            <button type="button" onClick={() => { setSelected(null); setForm({ ...EMPTY_FORM, category: categoryFilter === 'all' ? 'past-paper' : categoryFilter }); }}>新增</button>
          </div>
          <div className="admin-filter-pills" aria-label="资料分类筛选">
            {(['all', 'past-paper', 'mock-paper'] as const).map((category) => (
              <button
                key={category}
                type="button"
                className={categoryFilter === category ? 'active' : ''}
                onClick={() => setCategoryFilter(category)}
              >
                {category === 'all' ? '全部' : CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
          <div className="admin-list-stack">
            {visibleItems.map((item) => (
              <button key={item.id} type="button" className={selected?.paper.id === item.id ? 'admin-list-item active' : 'admin-list-item'} onClick={() => void selectPaper(item.id)}>
                <strong>{item.title}</strong>
                <span>{CATEGORY_LABELS[item.category === 'mock-paper' ? 'mock-paper' : 'past-paper']} · {item.subject} · {item.fileCount} 文件 · {item.isPublished ? '已发布' : '草稿'}{detailLoadingId === item.id ? ' · 读取中' : ''}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="admin-editor-panel">
          <div className="admin-form-head">
            <div>
              <span>{selected ? `版本 ${selected.paper.version}` : 'New'}</span>
              <h2>{selected ? '编辑 PDF 资料' : '新增 PDF 资料'}</h2>
            </div>
          </div>
          <div className="admin-form-grid">
            <AdminFormField label="分类"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as FormState['category'] })}><option value="past-paper">真题</option><option value="mock-paper">模拟卷</option></select></AdminFormField>
            <AdminFormField label="Slug"><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></AdminFormField>
            <AdminFormField label="标题"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></AdminFormField>
            <AdminFormField label="科目"><select value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value as MockExamSubjectId })}><option value="math">数学</option><option value="physics">物理</option><option value="chemistry">化学</option></select></AdminFormField>
            <AdminFormField label="可信题目索引" className="full">
              <select value={form.sourceDocumentId} onChange={(event) => setForm({ ...form, sourceDocumentId: event.target.value })}>
                <option value="">暂不绑定（Agent 只能阅读 PDF）</option>
                {sourceDocuments.filter((item) => item.subject === form.subject).map((item) => (
                  <option key={item.id} value={item.id} disabled={!item.displayAllowed}>
                    #{item.id} · {item.title} · {item.questionCount} 题{item.examSession ? ` · ${item.examSession}` : ''}{item.displayAllowed ? '' : ' · 禁止展示'}
                  </option>
                ))}
              </select>
            </AdminFormField>
            <AdminFormField label="年份"><input value={form.examYear} onChange={(event) => setForm({ ...form, examYear: event.target.value })} /></AdminFormField>
            <AdminFormField label="月份/批次"><input value={form.examMonth} onChange={(event) => setForm({ ...form, examMonth: event.target.value })} /></AdminFormField>
            <AdminFormField label="标签"><input value={form.sessionLabel} onChange={(event) => setForm({ ...form, sessionLabel: event.target.value })} /></AdminFormField>
            <AdminFormField label="题数"><input value={form.questionCount} onChange={(event) => setForm({ ...form, questionCount: event.target.value })} /></AdminFormField>
            <AdminFormField label="页数"><input value={form.pageCount} onChange={(event) => setForm({ ...form, pageCount: event.target.value })} /></AdminFormField>
            <AdminFormField label="描述" className="full"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></AdminFormField>
            <AdminFormField label="封面 URL" className="full"><input value={form.coverUrl} onChange={(event) => setForm({ ...form, coverUrl: event.target.value })} /></AdminFormField>
          </div>
          <div className="admin-checkbox-grid admin-past-paper-flags">
            <label><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} /><span>推荐展示</span></label>
            <label><input type="checkbox" checked={form.isPublished} disabled /><span>当前已发布（请使用下方发布/下架按钮变更）</span></label>
            <label><input type="checkbox" checked={form.hasAnswers} onChange={(event) => setForm({ ...form, hasAnswers: event.target.checked })} /><span>含答案</span></label>
            <label><input type="checkbox" checked={form.hasSolutions} onChange={(event) => setForm({ ...form, hasSolutions: event.target.checked })} /><span>含解析</span></label>
          </div>
          <p className="admin-helper-text">{CATEGORY_BODY[form.category]} 绑定同科目的可信题目索引后，Agent 才能按题号和页码引用分析；未绑定时不会进行猜测。</p>
          <div className="admin-actions">
            <button
              type="button"
              className={isActionBusy('save') ? 'admin-action-loading' : undefined}
              disabled={hasBusyAction}
              onClick={() => void savePaper()}
            >
              {isActionBusy('save') ? '保存中' : '保存资料'}
            </button>
            {selected && (
              <GhostButton
                className={isActionBusy('publish') ? 'admin-action-loading' : undefined}
                disabled={hasBusyAction}
                onClick={() => setPendingConfirmation('paper-publish')}
              >
                {isActionBusy('publish') ? '发布中' : '发布'}
              </GhostButton>
            )}
            {selected && (
              <GhostButton
                className={isActionBusy('archive') ? 'danger admin-action-loading' : 'danger'}
                disabled={hasBusyAction}
                onClick={() => setPendingConfirmation('paper-archive')}
              >
                {isActionBusy('archive') ? '归档中' : '归档'}
              </GhostButton>
            )}
          </div>
          <div className="admin-section-heading">
            <p className="page-kicker">Files</p>
            <h3>文件</h3>
          </div>
          <div className="admin-file-list">
            {selected?.files.map((file) => <p key={file.id}><strong>{file.label}</strong><span>{file.kind} · {file.fileUrl}</span></p>)}
            {selected && selected.files.length === 0 && <p><strong>暂无文件</strong><span>上传 PDF 或添加外部文件 URL 后会显示在这里。</span></p>}
            {!selected && <p><strong>请先保存资料</strong><span>资料创建后才能上传 PDF 或绑定文件 URL。</span></p>}
          </div>
          <div className="admin-form-grid">
            <AdminFormField label="文件类型"><select value={form.fileKind} onChange={(event) => setForm({ ...form, fileKind: event.target.value })}><option value="paper">原卷</option><option value="answers">答案</option><option value="solutions">解析</option><option value="mark-scheme">评分标准</option></select></AdminFormField>
            <AdminFormField label="文件名"><input value={form.fileLabel} onChange={(event) => setForm({ ...form, fileLabel: event.target.value })} /></AdminFormField>
            <AdminFormField label="上传 PDF" className="full"><input type="file" accept="application/pdf,.pdf" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} /></AdminFormField>
            <AdminFormField label="文件 URL" className="full"><input value={form.fileUrl} onChange={(event) => setForm({ ...form, fileUrl: event.target.value })} /></AdminFormField>
          </div>
          <div className="admin-actions compact">
            <button
              type="button"
              className={isActionBusy('upload-pdf') ? 'admin-action-loading' : undefined}
              disabled={hasBusyAction}
              onClick={() => void uploadPdf()}
            >
              {isActionBusy('upload-pdf') ? '上传中' : '上传 PDF'}
            </button>
            <GhostButton
              className={isActionBusy('add-file') ? 'admin-action-loading' : undefined}
              disabled={hasBusyAction}
              onClick={() => void addFile()}
            >
              {isActionBusy('add-file') ? '添加中' : '添加文件 URL'}
            </GhostButton>
          </div>
        </section>
      </div>
      ) : (
        <div className="admin-shell">
          <section className="admin-list-panel">
            <div className="admin-panel-heading">
              <div>
                <p className="page-kicker">Bundles</p>
                <h2>资料套装</h2>
              </div>
              <button type="button" onClick={() => { setSelectedBundle(null); setBundleForm({ ...EMPTY_BUNDLE_FORM, category: categoryFilter === 'all' ? 'past-paper' : categoryFilter }); }}>新增套装</button>
            </div>
            <div className="admin-filter-pills" aria-label="套装分类筛选">
              {(['all', 'past-paper', 'mock-paper'] as const).map((category) => (
                <button key={category} type="button" className={categoryFilter === category ? 'active' : ''} onClick={() => setCategoryFilter(category)}>
                  {category === 'all' ? '全部' : CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
            <div className="admin-list-stack">
              {visibleBundles.map((item) => (
                <button key={item.id} type="button" className={selectedBundle?.bundle.id === item.id ? 'admin-list-item active' : 'admin-list-item'} onClick={() => void selectBundle(item.id)}>
                  <strong>{item.title}</strong>
                  <span>{CATEGORY_LABELS[item.category === 'mock-paper' ? 'mock-paper' : 'past-paper']} · {item.subjectScope} · {item.itemCount} 份资料 · {item.fileCount} 文件 · {item.isPublished ? '已发布' : '草稿'}</span>
                </button>
              ))}
              {visibleBundles.length === 0 && <p className="admin-helper-text">当前筛选下还没有资料套装。</p>}
            </div>
          </section>
          <section className="admin-editor-panel">
            <div className="admin-form-head">
              <div>
                <span>{selectedBundle ? `版本 ${selectedBundle.bundle.version}` : 'New'}</span>
                <h2>{selectedBundle ? '编辑资料套装' : '新增资料套装'}</h2>
              </div>
            </div>
            <div className="admin-form-grid">
              <AdminFormField label="分类"><select value={bundleForm.category} onChange={(event) => setBundleForm({ ...bundleForm, category: event.target.value as BundleFormState['category'] })}><option value="past-paper">真题</option><option value="mock-paper">模拟卷</option></select></AdminFormField>
              <AdminFormField label="科目范围"><select value={bundleForm.subjectScope} onChange={(event) => setBundleForm({ ...bundleForm, subjectScope: event.target.value as BundleFormState['subjectScope'] })}><option value="math">数学</option><option value="physics">物理</option><option value="chemistry">化学</option><option value="mixed">跨科</option></select></AdminFormField>
              <AdminFormField label="Slug"><input value={bundleForm.slug} onChange={(event) => setBundleForm({ ...bundleForm, slug: event.target.value })} /></AdminFormField>
              <AdminFormField label="标题"><input value={bundleForm.title} onChange={(event) => setBundleForm({ ...bundleForm, title: event.target.value })} /></AdminFormField>
              <AdminFormField label="排序"><input value={bundleForm.sortOrder} onChange={(event) => setBundleForm({ ...bundleForm, sortOrder: event.target.value })} /></AdminFormField>
              <AdminFormField label="封面 URL"><input value={bundleForm.coverUrl} onChange={(event) => setBundleForm({ ...bundleForm, coverUrl: event.target.value })} /></AdminFormField>
              <AdminFormField label="描述" className="full"><textarea value={bundleForm.description} onChange={(event) => setBundleForm({ ...bundleForm, description: event.target.value })} /></AdminFormField>
              <AdminFormField label="亮点（每行一个）"><textarea value={bundleForm.highlights} onChange={(event) => setBundleForm({ ...bundleForm, highlights: event.target.value })} /></AdminFormField>
              <AdminFormField label="标签（每行一个）"><textarea value={bundleForm.tags} onChange={(event) => setBundleForm({ ...bundleForm, tags: event.target.value })} /></AdminFormField>
            </div>
            <div className="admin-checkbox-grid admin-past-paper-flags">
              <label><input type="checkbox" checked={bundleForm.isFeatured} onChange={(event) => setBundleForm({ ...bundleForm, isFeatured: event.target.checked })} /><span>推荐展示</span></label>
              <label><input type="checkbox" checked={bundleForm.isPublished} disabled /><span>当前已发布（请使用下方发布/下架按钮变更）</span></label>
            </div>
            <p className="admin-helper-text">套装只负责组织资料；PDF 文件在“单份资料”里上传和维护，移出套装不会删除单份资料或 PDF 文件。</p>
            <div className="admin-actions">
              <button type="button" className={isActionBusy('bundle-save') ? 'admin-action-loading' : undefined} disabled={hasBusyAction} onClick={() => void saveBundle()}>
                {isActionBusy('bundle-save') ? '保存中' : '保存套装'}
              </button>
              {selectedBundle && (
                <GhostButton className={isActionBusy('bundle-publish') ? 'admin-action-loading' : undefined} disabled={hasBusyAction} onClick={() => setPendingConfirmation('bundle-publish')}>
                  {isActionBusy('bundle-publish') ? '发布中' : '发布套装'}
                </GhostButton>
              )}
              {selectedBundle && (
                <GhostButton className={isActionBusy('bundle-archive') ? 'danger admin-action-loading' : 'danger'} disabled={hasBusyAction} onClick={() => setPendingConfirmation('bundle-archive')}>
                  {isActionBusy('bundle-archive') ? '下架中' : '下架套装'}
                </GhostButton>
              )}
            </div>
            <div className="admin-section-heading">
              <p className="page-kicker">Items</p>
              <h3>套装内资料</h3>
            </div>
            <div className="admin-file-list">
              {selectedBundle?.items.map((item) => (
                <p key={item.id}>
                  <strong>{item.label}</strong>
                  <span>{item.paper.title} · {item.paper.subject} · {item.files.length} 文件 · {item.paper.isPublished ? '已发布' : '草稿'}</span>
                  <button type="button" disabled={hasBusyAction} onClick={() => void removeBundleItem(item.id)}>移出</button>
                </p>
              ))}
              {selectedBundle && selectedBundle.items.length === 0 && <p><strong>暂无资料</strong><span>从已上传资料中选择并加入套装。</span></p>}
              {!selectedBundle && <p><strong>请先保存套装</strong><span>套装创建后才能添加资料。</span></p>}
            </div>
            <div className="admin-form-grid">
              <AdminFormField label="选择资料" className="full">
                <select value={bundleForm.itemPastPaperId} onChange={(event) => setBundleForm({ ...bundleForm, itemPastPaperId: event.target.value })}>
                  <option value="">请选择已上传资料</option>
                  {items
                    .filter((item) => item.category === bundleForm.category)
                    .map((item) => <option key={item.id} value={item.id}>{item.title} · {item.subject} · {item.isPublished ? '已发布' : '草稿'}</option>)}
                </select>
              </AdminFormField>
              <AdminFormField label="套装内名称"><input value={bundleForm.itemLabel} onChange={(event) => setBundleForm({ ...bundleForm, itemLabel: event.target.value })} /></AdminFormField>
              <AdminFormField label="排序"><input value={bundleForm.itemSortOrder} onChange={(event) => setBundleForm({ ...bundleForm, itemSortOrder: event.target.value })} /></AdminFormField>
            </div>
            <div className="admin-actions compact">
              <button type="button" className={isActionBusy('bundle-add-item') ? 'admin-action-loading' : undefined} disabled={hasBusyAction} onClick={() => void addBundleItem()}>
                {isActionBusy('bundle-add-item') ? '加入中' : '加入套装'}
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingConfirmation && (
        <ConfirmDialog
          title={pendingConfirmation.endsWith('publish') ? '确认发布到前台？' : '确认下架？'}
          body={pendingConfirmation.startsWith('bundle')
            ? '该操作会变更整套资料在前台的可见状态，套装内的原始资料不会被删除。'
            : '该操作会变更这份资料在前台的可见状态，已经上传的 PDF 文件不会被删除。'}
          confirmLabel={pendingConfirmation.endsWith('publish') ? '确认发布' : '确认下架'}
          tone={pendingConfirmation.endsWith('archive') ? 'danger' : 'neutral'}
          isBusy={hasBusyAction}
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={() => void confirmPendingAction()}
        />
      )}
    </AdminPageShell>
  );
}
