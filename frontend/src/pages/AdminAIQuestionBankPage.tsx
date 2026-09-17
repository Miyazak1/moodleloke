import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import { CscaSyllabusWorkspace } from '../components/admin/ai-question-bank/CscaSyllabusWorkspace';
import {
  CoverageWorkPanel,
  LedgerPanel,
  MockExamProductionPanel,
  PublishedQuestionPanel,
  QualityWorkspace,
  QuestionBankHeaderControls,
  QuestionBankOverviewSummary,
  QuestionBankTaskStatus,
  RemediationWorkspace,
  SourceReferenceWorkspace,
  SubjectPracticeProductionPanel,
  CANDIDATE_BULK_ALL_LIMIT,
  CANDIDATE_BULK_CHUNK_SIZE,
  CANDIDATE_PAGE_SIZE,
  EMPTY_COVERAGE,
  EMPTY_GENERATION_QUEUE,
  EMPTY_MISCONCEPTIONS,
  EMPTY_QUALITY_GOVERNANCE,
  EMPTY_QUALITY_TREND,
  EMPTY_REMEDIATION,
  EMPTY_SOURCE_REFERENCE_SUMMARY,
  EMPTY_TOPIC_HEALTH,
  PAGE_SIZE,
  SOURCE_QUESTION_PAGE_SIZE,
  buildQualityCalibrationSummary,
  buildQualityReplacementSummary,
  buildBusyControlView,
  buildGenerationQueueView,
  buildPaginationView,
  buildQuestionById,
  buildQuestionBankSummary,
  buildQuestionBankTabs,
  buildCoverageWorkPanelProps,
  buildQuestionBankHeaderControlsProps,
  buildQuestionBankOverviewSummaryProps,
  buildLedgerPanelProps,
  subjectDisplayName,
  buildPublishedQuestionPanelProps,
  buildQualityWorkspaceProps,
  buildRemediationWorkspaceProps,
  buildSourceReferenceWorkspaceProps,
  buildSourceReferenceWorkflowView,
  buildTopicHealthWorkView,
  sourceReferenceTemplate,
  useCandidateDataRefresh,
  useCandidateReviewState,
  useGenerationQueuePolling,
  useGovernanceDataRefresh,
  useQualityGovernanceActions,
  useQuestionBankInitialData,
  useQuestionBankExports,
  useQuestionBankActionRunner,
  useRemediationActions,
  useSourceReferenceActions,
  useSourceReferenceDataRefresh,
  useSourceReferenceState,
  useTopicHealthActions,
  type TopicBulkProgress,
  type ConceptCardEditDraft,
  type MisconceptionEditDraft,
  type QuestionBankState,
  type QuestionBankTab,
  type SourceImportMessage
} from '../components/admin/ai-question-bank';
import {
  archiveAdminAIQuestioningMisconception,
  archiveAdminAIQuestioningQuestion,
  archiveAdminAIQuestioningConceptCard,
  bulkAdminAIQuestioningQuestions,
  cleanupAdminAIQuestioningSubjectPracticeScope,
  confirmAdminAIQuestioningSyllabusQuestion,
  createAdminAIQuestioningConceptCardForMisconception,
  createAdminAIQuestioningVariantForMisconception,
  deleteAdminAIQuestioningGeneratedQuestion,
  refreshAdminAIQuestioningQuality,
  reviewAdminAIQuestioningQuestion,
  reviewAdminAIQuestioningMisconception,
  publishAdminAIQuestioningConceptCard,
  refreshAdminAdaptiveUsageAggregates,
  resolveAdminAIQuestioningQuality,
  sendAdminAIQuestioningQualityToReview,
  startAdminAIQuestioningCandidateBulkTask,
  restoreAdminAIQuestioningMisconception,
  assembleAdminMockExamGenerationJobDraft,
  cleanupAdminMockExamBlueprintGenerationJobs,
  cleanupAdminMockExamGenerationJob,
  createAdminMockExamBlueprintFromPaper,
  createAdminMockExamGenerationJob,
  getAdminAdaptiveReplenishmentInventory,
  getAdminMockExamBlueprint,
  getAdminMockExamPaper,
  getAdminMockExamPapers,
  getAdminSubjectPracticeAutoProductionSetting,
  getAdminSubjectPracticeProductionRuns,
  processAdminSubjectPracticeProductionRun,
  processAdminMockExamGenerationJob,
  runAdminAdaptiveReplenishment,
  updateAdminSubjectPracticeAutoProductionSetting,
  updateAdminMockExamBlueprint
} from '../lib/api-admin';
import type {
  AdminAdaptiveReplenishmentInventory,
  AdminAdaptiveReplenishmentRunResult,
  AdminAIQuestioningTopicHealth,
  AdminMockExamBlueprintDetail,
  AdminMockExamPaper,
  AdminSubjectPracticeAutoProductionSetting,
  AdminSubjectPracticeProductionRun,
  User
} from '../lib/api-types';

type AdminAIQuestionBankPageProps = {
  currentUser?: User | null;
  onBackAudit: () => void;
  onGoToAiOperations: () => void;
  onGoToAuth: () => void;
};

type CandidateGovernanceScope = 'workflow' | 'subject' | 'all';

const CANDIDATE_STATUS_OPTIONS = [
  { value: '', label: '全部异常候选' },
  { value: 'pending_review', label: '待审核' },
  { value: 'review_failed', label: '复审失败' },
  { value: 'fallback', label: '需重生/fallback' }
];

export function AdminAIQuestionBankPage({
  currentUser,
  onBackAudit,
  onGoToAiOperations,
  onGoToAuth
}: AdminAIQuestionBankPageProps) {
  const [subject, setSubject] = useState('');
  const [sourceReferenceSubject, setSourceReferenceSubject] = useState('');
  const [status, setStatus] = useState('');
  const [candidateScope, setCandidateScope] = useState<CandidateGovernanceScope>('workflow');
  const [candidateStatus, setCandidateStatus] = useState('');
  const [page, setPage] = useState(0);
  const [publishedPage, setPublishedPage] = useState(0);
  const [activeTab, setActiveTab] = useState<QuestionBankTab>('overview');
  const [mockExamPapers, setMockExamPapers] = useState<AdminMockExamPaper[]>([]);
  const [selectedMockPaperId, setSelectedMockPaperId] = useState<number | null>(null);
  const [mockBlueprintDetail, setMockBlueprintDetail] = useState<AdminMockExamBlueprintDetail | null>(null);
  const [isMockExamProductionLoading, setIsMockExamProductionLoading] = useState(false);
  const [subjectAutoProductionSetting, setSubjectAutoProductionSetting] = useState<AdminSubjectPracticeAutoProductionSetting | null>(null);
  const [isSubjectAutoProductionSettingLoading, setIsSubjectAutoProductionSettingLoading] = useState(false);
  const [subjectProductionRun, setSubjectProductionRun] = useState<AdminSubjectPracticeProductionRun | null>(null);
  const [isSubjectProductionLoading, setIsSubjectProductionLoading] = useState(false);
  const [adaptiveInventory, setAdaptiveInventory] = useState<AdminAdaptiveReplenishmentInventory | null>(null);
  const [adaptivePredictiveResult, setAdaptivePredictiveResult] = useState<AdminAdaptiveReplenishmentRunResult | null>(null);
  const [isAdaptiveInventoryLoading, setIsAdaptiveInventoryLoading] = useState(false);
  const [misconceptionDrafts, setMisconceptionDrafts] = useState<Record<number, MisconceptionEditDraft>>({});
  const [misconceptionMergeTargets, setMisconceptionMergeTargets] = useState<Record<number, string>>({});
  const [conceptCardDrafts, setConceptCardDrafts] = useState<Record<number, ConceptCardEditDraft>>({});
  const [data, setData] = useState<QuestionBankState>({
    coverage: EMPTY_COVERAGE,
    topicHealth: EMPTY_TOPIC_HEALTH,
    generationQueue: EMPTY_GENERATION_QUEUE,
    candidates: [],
    candidatesTotal: 0,
    candidateBulkTasks: [],
    publishedItems: [],
    publishedTotal: 0,
    ledgerItems: [],
    ledgerTotal: 0,
    sourceDocuments: [],
    sourceDocumentProfileVisualizations: {},
    sourceQuestions: [],
    sourceQuestionsTotal: 0,
    sourceAutoProfileTasks: [],
    sourceTopicTasks: [],
    sourceReferenceSummary: EMPTY_SOURCE_REFERENCE_SUMMARY,
    styleProfiles: [],
    examSeriesProfiles: [],
    generationProfiles: [],
    topicOptions: [],
    qualityGovernance: EMPTY_QUALITY_GOVERNANCE,
    qualityMetrics: [],
    qualityTrend: EMPTY_QUALITY_TREND,
    remediation: EMPTY_REMEDIATION,
    misconceptions: EMPTY_MISCONCEPTIONS
  });
  const [isLoading, setIsLoading] = useState(true);
  const {
    busyActions,
    setBusyActions,
    error,
    setError,
    feedback,
    setFeedback,
    refreshNonce,
    requestRefresh,
    isActionBusy,
    runAction
  } = useQuestionBankActionRunner();
  const [topicBulkProgress, setTopicBulkProgress] = useState<TopicBulkProgress | null>(null);
  const candidateBulkProgress = null;
  const [generationQueuePollingError, setGenerationQueuePollingError] = useState<string | null>(null);
  const [expandPerBlueprint, setExpandPerBlueprint] = useState(1);
  const [sourceImportJson, setSourceImportJson] = useState('');
  const [sourceImportMessage, setSourceImportMessage] = useState<SourceImportMessage | null>(null);
  const sourceImportFileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceReference = useSourceReferenceState(data.sourceQuestions, data.sourceQuestionsTotal, SOURCE_QUESTION_PAGE_SIZE);
  const {
    page: sourceQuestionPage,
    setPage: setSourceQuestionPage,
    reviewStatus: sourceQuestionReviewStatus,
    setReviewStatus: setSourceQuestionReviewStatus,
    documentId: sourceQuestionDocumentId,
    setDocumentId: setSourceQuestionDocumentId
  } = sourceReference;
  const refreshSourceReferenceData = useSourceReferenceDataRefresh({
    isAdmin: currentUser?.role === 'admin',
    subject: sourceReferenceSubject,
    sourceQuestionDocumentId,
    sourceQuestionReviewStatus,
    sourceQuestionPage,
    setData,
    setError
  });
  const sourceReferenceActions = useSourceReferenceActions({
    subject: sourceReferenceSubject,
    sourceImportJson,
    sourceQuestionDocumentId,
    sourceQuestionReviewStatus,
    setSourceImportJson,
    setSourceImportMessage,
    setSourceQuestionDocumentId,
    setSourceQuestionPage,
    setSourceQuestionReviewStatus,
    setData,
    setBusyActions,
    setError,
    setFeedback,
    onRefresh: refreshSourceReferenceData,
    runAction
  });
  const sourceReferenceAutoGuardRef = useRef<string | null>(null);
  const candidateReview = useCandidateReviewState(data.candidates, data.candidatesTotal, candidateStatus, CANDIDATE_PAGE_SIZE);
  const candidateQueue = candidateReview.queue;
  const candidatePage = candidateReview.page;
  const activeUseCase = activeTab === 'online-mock' ? 'online_mock_exam' : 'subject_practice';
  const selectedMockPaperForFilter = selectedMockPaperId
    ? mockExamPapers.find((paper) => paper.id === selectedMockPaperId) ?? null
    : null;
  const candidateSubject = activeUseCase === 'online_mock_exam'
    ? String(selectedMockPaperForFilter?.subject ?? subject)
    : subject;
  const mockExamBlueprintScopeId = activeUseCase === 'online_mock_exam'
    ? mockBlueprintDetail?.blueprint.id
    : undefined;
  const mockExamSourcePaperScopeId = activeUseCase === 'online_mock_exam'
    ? selectedMockPaperId ?? undefined
    : undefined;
  const candidateGovernanceSubject = candidateScope === 'workflow' || candidateScope === 'subject'
    ? candidateSubject
    : '';
  const candidateGovernanceUseCase = candidateScope === 'all' ? undefined : activeUseCase;
  const candidateGovernanceMockExamBlueprintId = candidateScope === 'workflow' ? mockExamBlueprintScopeId : undefined;
  const candidateGovernanceMockExamSourcePaperId = candidateScope === 'workflow' ? mockExamSourcePaperScopeId : undefined;
  const refreshCandidateData = useCandidateDataRefresh({
    isAdmin: currentUser?.role === 'admin',
    subject: candidateSubject,
    status,
    useCase: activeUseCase,
    mockExamBlueprintId: mockExamBlueprintScopeId,
    mockExamSourcePaperId: mockExamSourcePaperScopeId,
    candidateSubject: candidateGovernanceSubject,
    candidateStatus,
    candidateUseCase: candidateGovernanceUseCase,
    candidateMockExamBlueprintId: candidateGovernanceMockExamBlueprintId,
    candidateMockExamSourcePaperId: candidateGovernanceMockExamSourcePaperId,
    candidateRequiresMockExamScope: candidateScope === 'workflow',
    candidatePage,
    publishedPage,
    ledgerPage: page,
    setData,
    setError,
    pruneSelectionToIds: candidateReview.pruneSelectionToIds
  });
  const refreshGovernanceData = useGovernanceDataRefresh({
    isAdmin: currentUser?.role === 'admin',
    subject: candidateSubject,
    useCase: activeUseCase,
    setData,
    setError
  });
  async function refreshAfterCandidateQueueMutation() {
    await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
    if (activeTab === 'subject-practice') {
      await Promise.allSettled([
        loadSubjectAutoProductionSetting(),
        loadSubjectProductionRun(),
        loadAdaptiveReplenishmentInventory()
      ]);
    }
    if (activeTab === 'online-mock' && selectedMockPaperId) {
      await loadMockExamProduction(selectedMockPaperId);
    }
  }
  const generationQueueView = buildGenerationQueueView(data, topicBulkProgress);

  useQuestionBankInitialData({
    isAdmin: currentUser?.role === 'admin',
    subject: candidateSubject,
    useCase: activeUseCase,
    refreshNonce,
    setData,
    setIsLoading,
    setError
  });

  useGenerationQueuePolling({
    isAdmin: currentUser?.role === 'admin',
    subject: candidateSubject,
    useCase: activeUseCase,
    queuedCount: data.generationQueue.summary.queued,
    runningCount: data.generationQueue.summary.running,
    isTopicBulkRunning: generationQueueView.isTopicBulkRunning,
    setData,
    setTopicBulkProgress,
    setPollingError: setGenerationQueuePollingError,
    onQueueSettled: requestRefresh
  });

  useEffect(() => {
    if (currentUser?.role !== 'admin' || isLoading) return;
    if (activeTab !== 'subject-practice' && activeTab !== 'online-mock') return;
    void refreshCandidateData({ includeCandidates: false, includeBulkTasks: false }).catch(() => undefined);
  }, [
    activeTab,
    currentUser?.role,
    isLoading,
    refreshCandidateData,
    refreshNonce
  ]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || isLoading) return;
    if (activeTab !== 'subject-practice' && activeTab !== 'online-mock') return;
    void refreshGovernanceData({ includeRemediation: activeTab === 'subject-practice' }).catch(() => undefined);
  }, [
    activeTab,
    currentUser?.role,
    isLoading,
    refreshGovernanceData,
    refreshNonce
  ]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || isLoading || activeTab !== 'shared-prep') return;
    refreshSourceReferenceData();
  }, [
    activeTab,
    currentUser?.role,
    isLoading,
    refreshNonce,
    refreshSourceReferenceData
  ]);

  useEffect(() => {
    if (activeTab !== 'subject-practice') return;
    void loadSubjectAutoProductionSetting();
    void loadSubjectProductionRun();
    void loadAdaptiveReplenishmentInventory();
  }, [activeTab, currentUser?.role, subject, refreshNonce]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || isLoading || activeTab !== 'subject-practice' || !subject) return undefined;
    const timer = window.setInterval(() => {
      void Promise.allSettled([
        loadSubjectProductionRun({ silent: true }),
        loadAdaptiveReplenishmentInventory({ silent: true })
      ]);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [
    activeTab,
    currentUser?.role,
    isLoading,
    subject,
    subjectProductionRun?.id,
    subjectProductionRun?.status,
    subjectProductionRun?.openTotal,
    adaptiveInventory?.summary.requiredPublishedCount
  ]);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return undefined;
    const hasActiveSourceTask = [...data.sourceAutoProfileTasks, ...data.sourceTopicTasks]
      .some((task) => task.status === 'queued' || task.status === 'running');
    if (!hasActiveSourceTask) return undefined;
    const timer = window.setInterval(() => {
      refreshSourceReferenceData();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [currentUser?.role, data.sourceAutoProfileTasks, data.sourceTopicTasks, refreshSourceReferenceData]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || activeTab !== 'shared-prep' || !sourceReferenceSubject || isLoading) return;
    const summary = data.sourceReferenceSummary;
    const hasActiveAutoProfileTask = data.sourceAutoProfileTasks
      .some((task) => task.status === 'queued' || task.status === 'running');
    const hasActiveTopicTask = data.sourceTopicTasks
      .some((task) => task.status === 'queued' || task.status === 'running');
    const isStyleProfileBusy = isActionBusy(`style-profile-${sourceReferenceSubject}`);
    const guardKey = [
      sourceReferenceSubject,
      sourceQuestionDocumentId ?? 'all',
      summary.recommendedAction,
      summary.autoPendingQuestionCount ?? 0,
      summary.autoRetryPendingQuestionCount ?? 0,
      summary.autoApprovedQuestionCount ?? 0,
      data.styleProfiles.length
    ].join(':');
    if (sourceReferenceAutoGuardRef.current === guardKey) return;

    if (
      summary.recommendedAction === 'auto_profile_source_questions' &&
      (summary.autoPendingQuestionCount ?? 0) > 0 &&
      !hasActiveAutoProfileTask
    ) {
      sourceReferenceAutoGuardRef.current = guardKey;
      void sourceReferenceActions.startAutoProfileSourceQuestions();
      return;
    }

    if (
      summary.recommendedAction === 'retry_auto_profile' &&
      (summary.autoRetryPendingQuestionCount ?? 0) > 0 &&
      !hasActiveAutoProfileTask
    ) {
      sourceReferenceAutoGuardRef.current = guardKey;
      void sourceReferenceActions.retryAutoProfileSourceQuestions();
      return;
    }

    if (
      summary.recommendedAction === 'generate_profile' &&
      (summary.autoApprovedQuestionCount ?? 0) > 0 &&
      data.styleProfiles.length === 0 &&
      !hasActiveAutoProfileTask &&
      !hasActiveTopicTask &&
      !isStyleProfileBusy
    ) {
      sourceReferenceAutoGuardRef.current = guardKey;
      void sourceReferenceActions.generateCurrentStyleProfile();
    }
  }, [
    currentUser?.role,
    activeTab,
    data.sourceAutoProfileTasks,
    data.sourceReferenceSummary,
    data.sourceTopicTasks,
    data.styleProfiles.length,
    isActionBusy,
    isLoading,
    sourceQuestionDocumentId,
    sourceReferenceActions,
    sourceReferenceSubject
  ]);

  useEffect(() => {
    if (currentUser?.role !== 'admin') return undefined;
    if (!data.candidateBulkTasks.some((task) => task.status === 'queued' || task.status === 'running')) return undefined;
    const timer = window.setInterval(() => {
      refreshCandidateData({ includeCandidates: false, includePublishedLedger: false, includeLedger: false });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [currentUser?.role, data.candidateBulkTasks, refreshCandidateData]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || activeUseCase !== 'subject_practice') return undefined;
    const hasActiveGeneration = data.generationQueue.summary.queued + data.generationQueue.summary.running > 0;
    if (!hasActiveGeneration && !generationQueueView.isTopicBulkRunning) return undefined;
    const timer = window.setInterval(() => {
      void refreshCandidateData({ includeCandidates: false, includePublishedLedger: false, includeLedger: false, includeBulkTasks: false }).catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [
    activeUseCase,
    currentUser?.role,
    data.generationQueue.summary.queued,
    data.generationQueue.summary.running,
    generationQueueView.isTopicBulkRunning,
    refreshCandidateData
  ]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || activeTab !== 'subject-practice' || !subject) return undefined;
    const hasActiveProductionRun = subjectProductionRun?.status === 'running' || subjectProductionRun?.status === 'planned';
    const hasOpenProductionGap = (subjectProductionRun?.openTotal ?? 0) > 0;
    const hasActiveGeneration = data.generationQueue.summary.queued + data.generationQueue.summary.running > 0;
    const shouldWatchAutoBatch = subjectAutoProductionSetting?.effectiveEnabled === true;
    if (!hasActiveProductionRun && !hasOpenProductionGap && !hasActiveGeneration && !shouldWatchAutoBatch) return undefined;
    let isCurrent = true;
    const refreshProductionProgress = () => {
      void Promise.allSettled([
        getAdminSubjectPracticeProductionRuns({ subject }),
        getAdminAdaptiveReplenishmentInventory({ subject, limit: 160 })
      ]).then(([runResult, inventoryResult]) => {
        if (!isCurrent) return;
        if (runResult.status === 'fulfilled') {
          const latestRun = runResult.value.latest;
          const latestRunIsActive = latestRun?.status === 'running' || latestRun?.status === 'planned';
          const latestRunAdvanced = Boolean(latestRun) && (
            !subjectProductionRun
            || latestRun.id !== subjectProductionRun.id
            || latestRun.publishedTotal !== subjectProductionRun.publishedTotal
            || latestRun.updatedAt !== subjectProductionRun.updatedAt
          );
          const formalAssetsAdvanced = runResult.value.publishedTotal > data.publishedTotal;
          setSubjectProductionRun(latestRun);
          if (latestRunIsActive || latestRunAdvanced || formalAssetsAdvanced || hasActiveGeneration) {
            void refreshCandidateData({ includeCandidates: false, includeBulkTasks: false, includePublishedLedger: true, includeLedger: false }).catch(() => undefined);
          }
        }
        if (inventoryResult.status === 'fulfilled') setAdaptiveInventory(inventoryResult.value);
      }).catch(() => undefined);
    };
    const timer = window.setInterval(refreshProductionProgress, 15000);
    refreshProductionProgress();
    return () => {
      isCurrent = false;
      window.clearInterval(timer);
    };
  }, [
    activeTab,
    currentUser?.role,
    data.generationQueue.summary.queued,
    data.generationQueue.summary.running,
    data.publishedTotal,
    refreshCandidateData,
    subject,
    subjectAutoProductionSetting?.effectiveEnabled,
    subjectProductionRun
  ]);

  function clearCandidateScopedData() {
    candidateReview.clearSelection();
    candidateReview.setPage(0);
    setPage(0);
    setPublishedPage(0);
    setData((current) => ({
      ...current,
      candidates: [],
      candidatesTotal: 0,
      candidateBulkTasks: [],
      publishedItems: [],
      publishedTotal: 0,
      ledgerItems: [],
      ledgerTotal: 0
    }));
  }

  async function loadMockExamProduction(paperId: number | null = selectedMockPaperId) {
    setIsMockExamProductionLoading(true);
    try {
      const response = await getAdminMockExamPapers();
      setMockExamPapers(response.items);
      const scoped = subject ? response.items.filter((paper) => paper.subject === subject) : response.items;
      const nextPaper = scoped.find((paper) => paper.id === paperId) ?? scoped[0] ?? null;
      if ((nextPaper?.id ?? null) !== selectedMockPaperId) {
        clearCandidateScopedData();
      }
      setSelectedMockPaperId(nextPaper?.id ?? null);
      if (!nextPaper) {
        setMockBlueprintDetail(null);
        return;
      }
      const detail = await getAdminMockExamPaper(nextPaper.id);
      const blueprint = detail.blueprints?.[0];
      setMockBlueprintDetail(blueprint ? await getAdminMockExamBlueprint(blueprint.id) : null);
    } finally {
      setIsMockExamProductionLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    if (activeTab !== 'online-mock') return;
    void loadMockExamProduction(selectedMockPaperId);
  }, [activeTab, currentUser?.role, subject]);

  function selectMockPaper(paperId: number | null) {
    setSelectedMockPaperId(paperId);
    clearCandidateScopedData();
    if (!paperId) {
      setMockBlueprintDetail(null);
      return;
    }
    void runAction('mock-load-paper', '加载在线模考来源卷', async () => {
      const detail = await getAdminMockExamPaper(paperId);
      const blueprint = detail.blueprints?.[0];
      setMockBlueprintDetail(blueprint ? await getAdminMockExamBlueprint(blueprint.id) : null);
      return '在线模考来源卷已加载。';
    }, { refresh: false });
  }

  const mockExamBusyAction = Array.from(busyActions).find((action) => action.startsWith('mock-')) ?? null;

  function refreshMockExamProduction() {
    void runAction('mock-reload', '刷新在线模考出题数据', async () => {
      await loadMockExamProduction(selectedMockPaperId);
      return '在线模考出题数据已刷新。';
    }, { refresh: false });
  }

  async function loadSubjectProductionRun(options: { silent?: boolean } = {}) {
    if (currentUser?.role !== 'admin' || !subject) {
      setSubjectProductionRun(null);
      return;
    }
    if (!options.silent) setIsSubjectProductionLoading(true);
    try {
      const result = await getAdminSubjectPracticeProductionRuns({ subject });
      setSubjectProductionRun(result.latest);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (!options.silent) setIsSubjectProductionLoading(false);
    }
  }

  async function loadSubjectAutoProductionSetting() {
    if (currentUser?.role !== 'admin' || !subject) {
      setSubjectAutoProductionSetting(null);
      return;
    }
    setIsSubjectAutoProductionSettingLoading(true);
    try {
      const result = await getAdminSubjectPracticeAutoProductionSetting(subject);
      setSubjectAutoProductionSetting(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsSubjectAutoProductionSettingLoading(false);
    }
  }

  async function loadAdaptiveReplenishmentInventory(options: { silent?: boolean } = {}) {
    if (currentUser?.role !== 'admin' || !subject) {
      setAdaptiveInventory(null);
      setAdaptivePredictiveResult(null);
      return;
    }
    if (!options.silent) setIsAdaptiveInventoryLoading(true);
    try {
      const result = await getAdminAdaptiveReplenishmentInventory({ subject, limit: 160 });
      setAdaptiveInventory(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (!options.silent) setIsAdaptiveInventoryLoading(false);
    }
  }

  function refreshSubjectProductionRun() {
    void runAction('subject-production-refresh', '刷新科目训练生产计划', async () => {
      await loadSubjectAutoProductionSetting();
      await loadSubjectProductionRun();
      await loadAdaptiveReplenishmentInventory();
      return '科目训练生产计划已刷新。';
    }, { refresh: false });
  }

  function refreshAdaptiveReplenishmentInventory() {
    void runAction('subject-predictive-refresh', '刷新长期库存缺口', async () => {
      const usage = await refreshAdminAdaptiveUsageAggregates({ subject, days: 30 });
      await loadAdaptiveReplenishmentInventory();
      setAdaptivePredictiveResult({
        generatedAt: usage.refreshedAt,
        requestedSubject: subject,
        usage,
        processedSubjects: 0,
        items: []
      });
      return '长期库存缺口已刷新。';
    }, { refresh: false });
  }

  function runSubjectPredictiveReplenishment() {
    if (!subject) return;
    void runAction('subject-predictive-run', '运行科目训练预测补题', async () => {
      const result = await runAdminAdaptiveReplenishment({
        subject,
        maxSubjects: 1,
        maxJobs: 30,
        maxRounds: 50,
        batchTarget: subjectAutoProductionSetting?.batchTarget ?? 50,
        includeColdStart: true,
        processImmediately: true
      });
      await loadSubjectProductionRun();
      await loadAdaptiveReplenishmentInventory();
      await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
      setAdaptivePredictiveResult(result);
      const item = result.items[0];
      return item
        ? `预测补题已执行：${subjectDisplayName(item.subject)} · ${item.action} · ${item.reason}`
        : '预测补题已执行。';
    }, { refresh: false });
  }

  function createSubjectProductionRun() {
    if (!subject) return;
    void runAction('subject-production-create', '创建并自动补齐科目训练生产计划', async () => {
      const predictive = await runAdminAdaptiveReplenishment({
        subject,
        maxSubjects: 1,
        maxJobs: 30,
        maxRounds: 50,
        batchTarget: subjectAutoProductionSetting?.batchTarget ?? 50,
        includeColdStart: true,
        processImmediately: true
      });
      setAdaptivePredictiveResult(predictive);
      await loadSubjectProductionRun();
      await loadAdaptiveReplenishmentInventory();
      await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
      const item = predictive.items[0];
      return item
        ? `科目训练生产计划已按库存缺口启动：${subjectDisplayName(item.subject)} · ${item.action} · ${item.reason}`
        : '科目训练生产计划已按库存缺口启动。';
    }, { refresh: false });
  }

  function toggleSubjectAutoProduction(enabled: boolean) {
    if (!subject) return;
    void runAction('subject-auto-production-setting', enabled ? '开启本学科自动生成' : '暂停本学科自动生成', async () => {
      const saved = await updateAdminSubjectPracticeAutoProductionSetting(subject, {
        enabled,
        batchTarget: subjectAutoProductionSetting?.batchTarget ?? 50
      });
      setSubjectAutoProductionSetting(saved);
      if (saved.effectiveEnabled) {
        await loadSubjectProductionRun();
        await loadAdaptiveReplenishmentInventory();
        await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
        return `已开启 ${subjectDisplayName(subject)} 自动生成；系统会按每批 ${saved.batchTarget} 道合格题推进。`;
      }
      await loadSubjectProductionRun();
      await loadAdaptiveReplenishmentInventory();
      return enabled
        ? `已保存 ${subjectDisplayName(subject)} 自动生成确认；后台总闸未开启时不会自动开批。`
        : `已暂停 ${subjectDisplayName(subject)} 自动生成。`;
    }, { refresh: false });
  }

  function processSubjectProductionRun() {
    if (!subjectProductionRun) return;
    void runAction('subject-production-process', '处理科目训练生产计划', async () => {
      const result = await processAdminSubjectPracticeProductionRun(subjectProductionRun.id, {
        maxJobs: 12,
        maxJobsPerDifficulty: 4
      });
      setSubjectProductionRun(result.run);
      await loadAdaptiveReplenishmentInventory();
      await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
      const backlog = result.backlog;
      return backlog
        ? `${result.message} 候选治理：处理 ${backlog.handled} 道，自动入库 ${backlog.approved} 道，修复 ${backlog.repaired} 道，替代生成 ${backlog.regenerated} 道。`
        : result.message;
    }, { refresh: false });
  }

  function processSubjectProductionRunUntilComplete() {
    if (!subjectProductionRun) return;
    void runAction('subject-production-process-until-complete', '继续处理科目训练生产计划直到完成', async () => {
      const result = await processAdminSubjectPracticeProductionRun(subjectProductionRun.id, {
        maxJobs: 30,
        maxJobsPerDifficulty: 10,
        untilComplete: true,
        maxRounds: 50
      });
      setSubjectProductionRun(result.run);
      await loadAdaptiveReplenishmentInventory();
      await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
      const backlog = result.backlog;
      return backlog
        ? `${result.message} 候选治理：处理 ${backlog.handled} 道，自动入库 ${backlog.approved} 道，修复 ${backlog.repaired} 道，替代生成 ${backlog.regenerated} 道。`
        : result.message;
    }, { refresh: false });
  }

  function cleanupSubjectPracticeScope(topic?: AdminAIQuestioningTopicHealth['items'][number], includeApprovedAssets = false) {
    if (!subject) return;
    const topicScope = topic ? `「${topic.title}」` : `${subject} 学科`;
    const actionId = includeApprovedAssets
      ? topic ? `subject-practice-cleanup-all-${topic.topicId}` : 'subject-practice-cleanup-all'
      : topic ? `subject-practice-cleanup-${topic.topicId}` : 'subject-practice-cleanup';
    const expectedConfirmText = `DELETE_SUBJECT_PRACTICE_AI_${subject}_${topic?.topicId ?? 'ALL'}`;
    void runAction(actionId, '清理科目训练 AI 结果', async () => {
      const cleanupPayload = {
        subject,
        ...(topic ? { topicId: topic.topicId } : {}),
        includeCandidates: true,
        includeJobs: true,
        includeApprovedAssets
      };
      const preview = await cleanupAdminAIQuestioningSubjectPracticeScope({
        ...cleanupPayload,
        dryRun: true
      });
      const previewText = `将影响：未入库异常候选 ${preview.deleted.candidateQuestions} 道、已入库 AI 题 ${preview.deleted.approvedAiQuestions} 道、正式训练题 ${preview.deleted.publishedPracticeQuestions} 道、生成任务 ${preview.deleted.aiGenerationJobs} 个、曝光记录 ${preview.deleted.questionExposures} 条。`;
      if (includeApprovedAssets) {
        const confirmText = window.prompt(`危险操作：将清理 ${topicScope} 的 AI 候选、生成任务和已入库 AI 训练题。\n${previewText}\n请输入确认文本：${expectedConfirmText}`);
        if (confirmText !== expectedConfirmText) return '已取消清理。';
      } else if (!window.confirm(`确定清理 ${topicScope} 科目训练线未入库异常 AI 候选和生成任务吗？\n${previewText}\n已入库训练题、已拒绝和已归档记录会保留。`)) {
        return '已取消清理。';
      }
      const result = await cleanupAdminAIQuestioningSubjectPracticeScope({
        ...cleanupPayload,
        ...(includeApprovedAssets ? { confirmText: expectedConfirmText } : {})
      });
      candidateReview.clearSelection();
      candidateReview.setPage(0);
      await refreshCandidateData({ candidatePage: 0, includeCandidates: false, includeBulkTasks: false });
      requestRefresh();
      return includeApprovedAssets
        ? `已清理 ${topicScope}：未入库异常候选 ${result.deleted.candidateQuestions} 道、已入库 AI 题 ${result.deleted.approvedAiQuestions} 道、正式训练题 ${result.deleted.publishedPracticeQuestions} 道、生成任务 ${result.deleted.aiGenerationJobs} 个。`
        : `已清理 ${topicScope}：未入库异常候选 ${result.deleted.candidateQuestions} 道、生成任务 ${result.deleted.aiGenerationJobs} 个、曝光记录 ${result.deleted.questionExposures} 条。已入库训练题、已拒绝和已归档记录未删除。`;
    }, { refresh: false });
  }

  function createMockExamBlueprint() {
    if (!selectedMockPaperId) return;
    void runAction('mock-create-blueprint', '生成在线模考整卷蓝图', async () => {
      const response = await createAdminMockExamBlueprintFromPaper(selectedMockPaperId);
      setMockBlueprintDetail(response);
      return response.created ? '在线模考整卷蓝图已生成。' : '已加载现有在线模考整卷蓝图。';
    }, { refresh: false });
  }

  function loadMockExamBlueprint() {
    const blueprintId = mockBlueprintDetail?.blueprint.id;
    if (!blueprintId) return;
    void runAction('mock-load-blueprint', '加载在线模考题位', async () => {
      setMockBlueprintDetail(await getAdminMockExamBlueprint(blueprintId));
      return '在线模考题位已加载。';
    }, { refresh: false });
  }

  function confirmMockExamBlueprint() {
    const blueprint = mockBlueprintDetail?.blueprint;
    if (!blueprint) return;
    void runAction('mock-confirm-blueprint', '确认在线模考蓝图', async () => {
      setMockBlueprintDetail(await updateAdminMockExamBlueprint(blueprint.id, { status: 'active', expectedVersion: blueprint.version }));
      return '在线模考蓝图已确认 active。';
    }, { refresh: false });
  }

  function createMockExamGenerationJob() {
    const blueprint = mockBlueprintDetail?.blueprint;
    if (!blueprint) return;
    void runAction('mock-create-job', '生成在线模考候选题', async () => {
      const job = await createAdminMockExamGenerationJob(blueprint.id, { autoProcess: true });
      setMockBlueprintDetail((current) => current
        ? { ...current, generationJobs: [{ ...job, status: 'running', startedAt: job.startedAt ?? new Date().toISOString(), error: null }, ...(current.generationJobs ?? []).filter((item) => item.id !== job.id)] }
        : current);
      void getAdminMockExamBlueprint(blueprint.id).then(setMockBlueprintDetail).catch(() => undefined);
      return '在线模考自动补齐已启动；系统会持续生成、优化并复审，直到 48/48 合格题入库。';
    }, { refresh: false });
  }

  function processMockExamGenerationJob() {
    const blueprintId = mockBlueprintDetail?.blueprint.id;
    const job = mockBlueprintDetail?.generationJobs?.find((item) => ['queued', 'failed'].includes(item.status));
    if (!blueprintId || !job) return;
    void runAction('mock-process-job', '处理在线模考生成任务', async () => {
      const previousDetail = mockBlueprintDetail;
      setMockBlueprintDetail((current) => current
        ? {
            ...current,
            generationJobs: (current.generationJobs ?? []).map((item) => item.id === job.id
              ? { ...item, status: 'running', startedAt: item.startedAt ?? new Date().toISOString(), error: null }
              : item)
          }
        : current);
      try {
        await processAdminMockExamGenerationJob(job.id, { force: job.status !== 'queued', background: true });
        setMockBlueprintDetail(await getAdminMockExamBlueprint(blueprintId));
      } catch (cause) {
        try {
          setMockBlueprintDetail(await getAdminMockExamBlueprint(blueprintId));
        } catch {
          setMockBlueprintDetail(previousDetail);
        }
        throw cause;
      }
      return '在线模考自动补齐已唤醒；系统会继续处理缺口题位直到整套完成。';
    }, { refresh: false });
  }

  function assembleMockExamDraft() {
    const blueprintId = mockBlueprintDetail?.blueprint.id;
    const job = mockBlueprintDetail?.generationJobs?.find((item) => item.status === 'completed' && !item.targetPaperId);
    if (!blueprintId || !job) return;
    void runAction('mock-assemble-draft', '装配在线模考草稿卷', async () => {
      const result = await assembleAdminMockExamGenerationJobDraft(job.id);
      setMockBlueprintDetail(await getAdminMockExamBlueprint(blueprintId));
      return `在线模考草稿卷已装配：${result.paper.title}`;
    }, { refresh: false });
  }

  function mockCleanupSummary(result: Awaited<ReturnType<typeof cleanupAdminMockExamGenerationJob>>) {
    return `已清理：生成任务 ${result.deleted.mockGenerationJobs} 个、草稿卷 ${result.deleted.draftPapers} 套、草稿题 ${result.deleted.draftQuestions} 道、AI 候选 ${result.deleted.candidateQuestions} 道、AI 生成任务 ${result.deleted.aiGenerationJobs} 个。`;
  }

  function cleanupMockExamGenerationJob(jobId: number) {
    const blueprintId = mockBlueprintDetail?.blueprint.id;
    if (!blueprintId) return;
    if (!window.confirm(`确定清理在线模考生成任务 #${jobId} 吗？会删除该任务关联的 AI 候选题、AI job、AI 蓝图和未发布草稿卷。`)) return;
    void runAction(`mock-cleanup-job-${jobId}`, `清理在线模考生成任务 #${jobId}`, async () => {
      const result = await cleanupAdminMockExamGenerationJob(jobId, { force: true });
      setMockBlueprintDetail(await getAdminMockExamBlueprint(blueprintId));
      await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
      return mockCleanupSummary(result);
    }, { refresh: false });
  }

  function cleanupAllMockExamGenerationJobs() {
    const blueprintId = mockBlueprintDetail?.blueprint.id;
    if (!blueprintId) return;
    if (!window.confirm('确定清理当前蓝图下全部在线模考 AI 生成结果吗？会删除所有关联 AI 候选题、AI job、AI 蓝图和未发布草稿卷，便于重新生成整套 48 题。')) return;
    void runAction('mock-cleanup-all-jobs', '清理当前蓝图全部在线模考生成结果', async () => {
      const result = await cleanupAdminMockExamBlueprintGenerationJobs(blueprintId, { force: true });
      setMockBlueprintDetail(await getAdminMockExamBlueprint(blueprintId));
      await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
      return mockCleanupSummary(result);
    }, { refresh: false });
  }

  useEffect(() => {
    if (activeUseCase !== 'online_mock_exam') return undefined;
    const blueprintId = mockBlueprintDetail?.blueprint.id;
    if (!blueprintId) return undefined;
    const hasActiveMockJob = (mockBlueprintDetail.generationJobs ?? []).some((job) => job.status === 'queued' || job.status === 'running');
    if (!hasActiveMockJob) return undefined;
    const timer = window.setInterval(() => {
      void getAdminMockExamBlueprint(blueprintId).then(setMockBlueprintDetail).catch(() => undefined);
      void refreshCandidateData({ includeCandidates: false, includePublishedLedger: false, includeLedger: false, includeBulkTasks: false }).catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [activeUseCase, mockBlueprintDetail?.blueprint.id, mockBlueprintDetail?.generationJobs, refreshCandidateData]);

  useEffect(() => {
    setPage(0);
    setPublishedPage(0);
    setSourceQuestionPage(0);
    setSourceQuestionDocumentId(null);
  }, [status, subject, candidateSubject, activeUseCase, mockExamBlueprintScopeId, mockExamSourcePaperScopeId]);

  useEffect(() => {
    candidateReview.resetForFilterChange();
  }, [
    candidateGovernanceMockExamBlueprintId,
    candidateGovernanceMockExamSourcePaperId,
    candidateGovernanceSubject,
    candidateGovernanceUseCase,
    candidateScope,
    candidateStatus
  ]);

  useEffect(() => {
    setSourceQuestionPage(0);
  }, [sourceQuestionDocumentId, sourceQuestionReviewStatus]);

  const summary = useMemo(() => buildQuestionBankSummary(data, candidateQueue), [candidateQueue, data]);

  const qualityCalibration = useMemo(() => buildQualityCalibrationSummary(data.qualityMetrics), [data.qualityMetrics]);
  const questionById = useMemo(() => buildQuestionById(data.candidates), [data.candidates]);
  const workflowLabel = activeUseCase === 'online_mock_exam' ? '在线模考 AI ' : '科目训练 AI ';
  const destinationLabel = activeUseCase === 'online_mock_exam' ? '在线模考候选池，并用于装配模考草稿卷' : '科目训练题库，并与专项题库手工题共存';
  const approveVerb = activeUseCase === 'online_mock_exam' ? '通过为模考候选' : '通过为训练题';
  const qualityReplacementSummary = useMemo(
    () => buildQualityReplacementSummary(data.qualityMetrics, questionById),
    [data.qualityMetrics, questionById]
  );

  const tabs = useMemo(() => buildQuestionBankTabs(data, summary), [data, summary]);

  const ledgerPagination = buildPaginationView(data.ledgerTotal, page, PAGE_SIZE, data.ledgerItems.length);
  const publishedPagination = buildPaginationView(data.publishedTotal, publishedPage, PAGE_SIZE, data.publishedItems.length);
  const refreshAfterPublishedQuestionAction = async <T,>(action: () => Promise<T>) => {
    const result = await action();
    await refreshCandidateData({ includeCandidates: false, includeBulkTasks: false });
    return result;
  };
  const publishedQuestionPanelProps = buildPublishedQuestionPanelProps({
    workflowLabel,
    destinationLabel,
    items: data.publishedItems,
    total: data.publishedTotal,
    pageSize: PAGE_SIZE,
    pagination: publishedPagination,
    isLoading,
    isActionBusy,
    runAction,
    setPage: setPublishedPage,
    reviewQuestion: (questionId) => refreshAfterPublishedQuestionAction(() => reviewAdminAIQuestioningQuestion(questionId)),
    confirmSyllabusQuestion: (questionId) => refreshAfterPublishedQuestionAction(() => confirmAdminAIQuestioningSyllabusQuestion(questionId, { note: 'admin_confirmed_current_syllabus_from_question_bank' })),
    archiveQuestion: (questionId) => refreshAfterPublishedQuestionAction(() => archiveAdminAIQuestioningQuestion(questionId)),
    deleteGeneratedQuestion: (questionId) => refreshAfterPublishedQuestionAction(() => deleteAdminAIQuestioningGeneratedQuestion(questionId))
  });
  const ledgerPanelProps = buildLedgerPanelProps({
    workflowLabel,
    items: data.ledgerItems,
    total: data.ledgerTotal,
    pageSize: PAGE_SIZE,
    pagination: ledgerPagination,
    isLoading,
    setPage
  });
  const busyControlView = buildBusyControlView(busyActions);
  const { exportCandidateQueue, exportQualityMetrics } = useQuestionBankExports({
    subject: candidateGovernanceSubject,
    status: candidateStatus,
    candidateQuestions: candidateQueue.visible,
    qualityMetrics: data.qualityMetrics,
    qualityQuestions: data.candidates
  });
  const questionBankHeaderControlsProps = buildQuestionBankHeaderControlsProps({
    data,
    summary,
    candidateQueue,
    tabs,
    activeTab,
    subject,
    status,
    refreshBusy: isLoading,
    setActiveTab,
    setSubject,
    setStatus,
    requestRefresh
  });
  const questionBankOverviewSummaryProps = buildQuestionBankOverviewSummaryProps({
    data,
    candidateQueue,
    setActiveTab
  });
  const topicHealthWorkView = buildTopicHealthWorkView(data.topicHealth.items, 12);
  function changeSourceReferenceSubject(nextSubject: string) {
    setSourceReferenceSubject(nextSubject);
    setSourceQuestionDocumentId(null);
    setSourceQuestionReviewStatus('');
    setSourceQuestionPage(0);
    setSourceImportMessage(null);
    setError(null);
  }

  const sourceReferenceWorkflowView = buildSourceReferenceWorkflowView(sourceReferenceSubject, data, isActionBusy(`style-profile-${sourceReferenceSubject}`));
  const sourceReferenceWorkspaceProps = buildSourceReferenceWorkspaceProps({
    subject: sourceReferenceSubject,
    onSubjectChange: changeSourceReferenceSubject,
    data,
    sourceImportJson,
    sourceImportMessage,
    sourceImportFileInputRef,
    workflowView: sourceReferenceWorkflowView,
    sourceReference,
    sourceReferenceControlsBusy: busyControlView.sourceReferenceControlsBusy,
    isImportBusy: isActionBusy('source-reference-import'),
    isStyleProfileBusy: isActionBusy(`style-profile-${sourceReferenceSubject}`),
    isActionBusy,
    onRefreshSourceReference: refreshSourceReferenceData,
    sourceQuestionPageSize: SOURCE_QUESTION_PAGE_SIZE,
    sourceReferenceTemplate,
    setSourceImportJson,
    setSourceImportMessage,
    setError,
    actions: sourceReferenceActions
  });
  const { runTopicBulk, handleTopicHealthAction } = useTopicHealthActions({
    subject,
    expandPerBlueprint,
    runAction,
    setTopicBulkProgress,
    setStatus,
    setActiveTab,
    setFeedback
  });
  const coverageWorkPanelProps = buildCoverageWorkPanelProps({
    topicHealthWorkView,
    missingTopics: data.coverage.missingTopics,
    generationQueue: data.generationQueue,
    generationQueueView,
    topicBulkProgress,
    subjectSelected: Boolean(subject),
    expandPerBlueprint,
    isActionBusy,
    setExpandPerBlueprint,
    runTopicBulk,
    handleTopicHealthAction,
    cleanupSubjectPracticeScope
  });

  const { runQualityBulk, runQualityDisposition } = useQualityGovernanceActions({
    subject,
    useCase: activeUseCase,
    runAction
  });
  const qualityWorkspaceProps = buildQualityWorkspaceProps({
    governance: data.qualityGovernance,
    trend: data.qualityTrend,
    metrics: data.qualityMetrics,
    calibration: qualityCalibration,
    replacementSummary: qualityReplacementSummary,
    questionById,
    controlsBusy: busyControlView.qualityControlsBusy,
    isActionBusy,
    runAction,
    refreshQuality: () => refreshAdminAIQuestioningQuality({ subject: subject || undefined, useCase: activeUseCase }),
    runQualityBulk,
    exportQualityMetrics,
    sendToReview: (questionId) => sendAdminAIQuestioningQualityToReview(questionId, { reason: 'admin_quality_review_from_question_bank' }),
    resolveQuality: (questionId) => resolveAdminAIQuestioningQuality(questionId, { note: 'admin_resolved_from_question_bank' }),
    runQualityDisposition
  });
  const {
    canManageConceptCard,
    updateMisconceptionDraft,
    ensureMisconceptionDraft,
    saveMisconception,
    mergeMisconception,
    updateConceptCardDraft,
    ensureConceptCardDraft,
    saveConceptCard
  } = useRemediationActions({
    runAction,
    setError,
    misconceptionDrafts,
    setMisconceptionDrafts,
    misconceptionMergeTargets,
    setMisconceptionMergeTargets,
    conceptCardDrafts,
    setConceptCardDrafts
  });
  const remediationWorkspaceProps = buildRemediationWorkspaceProps({
    misconceptions: data.misconceptions,
    remediation: data.remediation,
    isActionBusy,
    runAction,
    misconceptionDrafts,
    setMisconceptionDrafts,
    misconceptionMergeTargets,
    setMisconceptionMergeTargets,
    conceptCardDrafts,
    setConceptCardDrafts,
    actions: {
      reviewMisconception: reviewAdminAIQuestioningMisconception,
      createConceptCard: (misconceptionId) => createAdminAIQuestioningConceptCardForMisconception(misconceptionId, { note: 'admin_created_from_question_bank' }),
      createVariant: (misconceptionId) => createAdminAIQuestioningVariantForMisconception(misconceptionId, { note: 'admin_variant_from_question_bank' }),
      ensureMisconceptionDraft,
      updateMisconceptionDraft,
      saveMisconception,
      archiveMisconception: archiveAdminAIQuestioningMisconception,
      restoreMisconception: restoreAdminAIQuestioningMisconception,
      mergeMisconception,
      canManageConceptCard,
      ensureConceptCardDraft,
      updateConceptCardDraft,
      saveConceptCard,
      publishConceptCard: (itemId) => publishAdminAIQuestioningConceptCard(itemId, { note: 'admin_published_from_question_bank' }),
      archiveConceptCard: (itemId) => archiveAdminAIQuestioningConceptCard(itemId, { note: 'admin_archived_from_question_bank' })
    }
  });

  return (
    <AdminPageShell
      current="aiQuestionBank"
      currentUser={currentUser}
      kicker="AI 出题 / 题库治理"
      title="AI 生成题库"
      body="按流程处理：先应用 CSCA 大纲作为范围基线，再导入真题 JSON 生成画像，按知识点和画像补蓝图与候选，审核发布到训练或模考，最后用质量治理、错因补题和台账追踪闭环。"
      heroAside={(
        <div className="admin-work-hero-actions">
          <button type="button" onClick={onGoToAiOperations}>AI 运维</button>
          <button type="button" onClick={onBackAudit}>运营总览</button>
        </div>
      )}
      onGoToAuth={onGoToAuth}
      onGoToAudit={onBackAudit}
      onGoToAiOperations={onGoToAiOperations}
    >
      {currentUser?.role === 'admin' && isLoading && (
        <section className="admin-feedback">
          <strong>正在加载 AI 题库治理数据。</strong>
        </section>
      )}

      {currentUser?.role === 'admin' && error && (
        <section className="admin-feedback warning">
          <strong>AI 题库治理数据暂时无法加载</strong>
          <p>{error}</p>
          <button type="button" onClick={requestRefresh}>重试</button>
        </section>
      )}

      {currentUser?.role === 'admin' && feedback && (
        <section className="admin-feedback success">
          <strong>{feedback}</strong>
        </section>
      )}

      <QuestionBankTaskStatus
        isLoading={isLoading}
        busyActions={busyActions}
        generationQueue={data.generationQueue}
        topicBulkProgress={topicBulkProgress}
        candidateBulkProgress={candidateBulkProgress}
        candidateBulkTasks={data.candidateBulkTasks}
        generationQueuePollingError={generationQueuePollingError}
        suppressGenerationQueue={activeTab === 'online-mock'}
        queueSubject={candidateSubject}
        queueUseCase={activeUseCase}
      />

      <QuestionBankHeaderControls {...questionBankHeaderControlsProps} />

      {activeTab === 'overview' && (
        <QuestionBankOverviewSummary {...questionBankOverviewSummaryProps} />
      )}

      {activeTab === 'shared-prep' && (
        <CscaSyllabusWorkspace
          currentUser={currentUser}
          subject={subject}
          onSubjectChange={setSubject}
          onDataChanged={requestRefresh}
        />
      )}

      {activeTab === 'shared-prep' && (
        <SourceReferenceWorkspace {...sourceReferenceWorkspaceProps} />
      )}

      {activeTab === 'subject-practice' && (
        <SubjectPracticeProductionPanel
          subject={subject}
          autoProductionSetting={subjectAutoProductionSetting}
          run={subjectProductionRun}
          inventory={adaptiveInventory}
          predictiveResult={adaptivePredictiveResult}
          isInventoryLoading={isAdaptiveInventoryLoading}
          isAutoProductionSettingLoading={isSubjectAutoProductionSettingLoading}
          isBusy={isSubjectAutoProductionSettingLoading || isSubjectProductionLoading || isAdaptiveInventoryLoading || isActionBusy('subject-auto-production-setting') || isActionBusy('subject-production-create') || isActionBusy('subject-production-process') || isActionBusy('subject-production-process-until-complete') || isActionBusy('subject-production-refresh') || isActionBusy('subject-predictive-refresh') || isActionBusy('subject-predictive-run')}
          onToggleAutoProduction={toggleSubjectAutoProduction}
          onCreateRun={createSubjectProductionRun}
          onProcessRun={processSubjectProductionRun}
          onProcessUntilComplete={processSubjectProductionRunUntilComplete}
          onRefresh={refreshSubjectProductionRun}
          onRefreshInventory={refreshAdaptiveReplenishmentInventory}
          onRunPredictiveReplenishment={runSubjectPredictiveReplenishment}
        />
      )}

      {activeTab === 'subject-practice' && (
        <CoverageWorkPanel {...coverageWorkPanelProps} />
      )}

      {activeTab === 'subject-practice' && (
        <PublishedQuestionPanel {...publishedQuestionPanelProps} />
      )}

      {activeTab === 'subject-practice' && (
        <QualityWorkspace {...qualityWorkspaceProps} />
      )}

      {activeTab === 'subject-practice' && (
        <RemediationWorkspace {...remediationWorkspaceProps} />
      )}

      {activeTab === 'subject-practice' && (
        <LedgerPanel {...ledgerPanelProps} />
      )}

      {activeTab === 'online-mock' && (
        <MockExamProductionPanel
          subject={subject}
          papers={mockExamPapers}
          selectedPaperId={selectedMockPaperId}
          blueprintDetail={mockBlueprintDetail}
          isLoading={isMockExamProductionLoading}
          busyAction={mockExamBusyAction}
          actionFeedback={feedback}
          actionError={error}
          onSelectPaper={selectMockPaper}
          onReload={refreshMockExamProduction}
          onCreateBlueprint={createMockExamBlueprint}
          onLoadBlueprint={loadMockExamBlueprint}
          onConfirmBlueprint={confirmMockExamBlueprint}
          onCreateGenerationJob={createMockExamGenerationJob}
          onProcessGenerationJob={processMockExamGenerationJob}
          onAssembleDraft={assembleMockExamDraft}
          onCleanupGenerationJob={cleanupMockExamGenerationJob}
          onCleanupAllGenerationJobs={cleanupAllMockExamGenerationJobs}
        />
      )}

      {activeTab === 'online-mock' && (
        <PublishedQuestionPanel {...publishedQuestionPanelProps} />
      )}

      {activeTab === 'online-mock' && (
        <QualityWorkspace {...qualityWorkspaceProps} />
      )}

      {activeTab === 'online-mock' && (
        <LedgerPanel {...ledgerPanelProps} />
      )}
    </AdminPageShell>
  );
}
