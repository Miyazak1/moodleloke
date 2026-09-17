import { useEffect, useMemo, useState } from 'react';
import { AdminPageShell } from '../components/AdminPageShell';
import {
  AdminActionBar,
  AdminPanel,
  AdminPanelHeader,
  AdminStatsStrip,
  AdminSubnav,
  AdminTableScroll
} from '../components/admin/AdminWorkbench';
import type { User } from '../lib/api';
import {
  bulkAdminAIQuestioningGenerationJobs,
  enqueueAdminAIQuestioningGenerationJobs,
  ensureAdminAIQuestioningBlueprintCoverage,
  getAdminAdaptiveAIObservability,
  getAdminAdaptiveAIProviderConfig,
  getAdminAdaptiveTrainingEventObservability,
  getAdminAIGatewayByKey,
  getAdminAIGatewayByTask,
  getAdminAIGatewayErrors,
  getAdminAIGatewayHealth,
  getAdminAIGatewaySummary,
  getAdminAIQuestioningGenerationQueueHealth,
  getAdminAIQuestioningOperationalReadiness,
  getAdminReadinessEvidenceFile,
  getAdminReadinessEvidenceFiles,
  processAdminAIQuestioningGenerationJobs,
  recordAdminAIQuestioningOperationalReadinessEvent,
  refreshAdminReadinessActionCalibrationSnapshots,
  retryAdminAIQuestioningGenerationJob,
  runAdminAIQuestioningPregeneration
} from '../lib/api-admin';
import type {
  AdminAIObservability,
  AdminAIGatewayErrorList,
  AdminAIGatewayGroupedResult,
  AdminAIGatewayHealth,
  AdminAIGatewayKeyMetric,
  AdminAIGatewaySummary,
  AdminAIGatewayTaskMetric,
  AdminAIProviderConfig,
  AdminAIQuestioningGenerationQueueHealth,
  AdminAIQuestioningOperationalReadiness,
  AdminReadinessEvidenceFile,
  AdminTrainingEventObservability
} from '../lib/api-types';
import { ApiError } from '../lib/request';
import { useI18n } from '../i18n/useI18n';
import { EMPTY_GENERATION_QUEUE } from '../components/admin/ai-question-bank/questionBankDefaults';
import { QuestionSupplyFulfillmentPanel } from '../components/admin/QuestionSupplyFulfillmentPanel';

type AdminAIOperationsPageProps = {
  currentUser: User | null;
  onGoToAuth: () => void;
  onBackAudit: () => void;
  onGoToQuestionBank?: () => void;
  onGoToOrganizations?: () => void;
  onGoToUsers?: () => void;
};

type AIOperationsTab = 'overview' | 'generation' | 'readiness' | 'observability' | 'provider';
const AI_QUESTIONING_READINESS_USE_CASE = 'subject_practice' as const;

const AI_OPERATIONS_COPY = {
  zh: {
    kicker: '后台 / AI 运维',
    title: 'AI 运维工作区',
    body: '把自适应训练观测、Provider 状态、AI 出题 readiness 和生成队列从总览里拆出来，集中做运维判断。',
    loading: '正在加载 AI 运维摘要。',
    errorTitle: 'AI 运维摘要暂时无法加载',
    retry: '重试',
    actions: '运维操作',
    refresh: '刷新摘要',
    ensureCoverage: '补齐蓝图覆盖',
    enqueueJobs: '入队生成任务',
    processQueue: '处理队列',
    retryFailed: '重试失败',
    archiveFailed: '归档失败任务',
    runPregeneration: '运行预生成',
    operationDone: '{label} 已完成。',
    operationFailed: '{label} 失败。',
    observability: 'Adaptive AI Observability',
    gatewayMonitor: 'AI Gateway 监控',
    gatewayCalls: '网关调用',
    gatewayKeys: '密钥池',
    recentGatewayErrors: '最近网关错误',
    noGatewayErrors: '暂无网关错误',
    successRate: '成功率',
    totalTokens: '总 token',
    displayCost: '折算成本',
    averageLatency: '平均延迟',
    taskType: '任务类型',
    sourceModule: '来源模块',
    keyId: 'Key ID',
    health: '健康状态',
    provider: 'Provider 状态',
    readiness: 'AI 出题 readiness',
    queue: '生成队列',
    interactions: '交互',
    feedback: '反馈',
    llmUsage: 'LLM 使用量',
    externalCalls: '外部 LLM 调用',
    estimatedTokens: '估算 token',
    estimatedCost: '估算成本',
    billableCalls: '计费交互',
    averageRating: '平均评分',
    byProvider: '按 Provider',
    byType: '按类型',
    rolloutHealth: 'LLM 放量健康',
    lowFeedback: '低评分反馈',
    pricing: '计费配置',
    dateRange: '统计范围',
    errors: '错误率',
    fallback: 'Fallback',
    providerReady: '可用',
    providerFallback: '规则兜底',
    blockers: '阻断项',
    noBlockers: '暂无阻断项',
    model: '模型',
    rollout: 'Rollout',
    score: '评分',
    nextAction: '下一步',
    queued: '排队',
    failed: '失败',
    running: '运行中',
    stale: '卡住',
    recommendedAction: '建议动作',
    recentFailures: '最近失败',
    noRecentFailures: '暂无失败记录',
    latestAudit: '最近审计事件',
    noLatestAudit: '暂无审计事件',
    recentJobs: '最近任务',
    retryJob: '重试任务',
    failureBreakdown: '失败分类',
    providerFailureBreakdown: 'Provider 失败分类',
    blockedJobs: '阻断任务',
    staleJobs: '卡住任务',
    readinessActions: '准备度建议',
    readinessEvidence: '准备度判断依据',
    readinessCalibration: '建议效果健康',
    readinessThresholds: '中高难练习门槛',
    readinessRollout: '准备度门槛发布检查',
    readinessEvidenceFiles: '准备度发布记录',
    dailyGovernance: '每日治理顺序',
    syllabusGovernance: '大纲治理',
    blueprintCoverage: '蓝图覆盖',
    topicBank: '知识点题库',
    qualityGovernance: '质量治理',
    refreshCalibration: '刷新建议效果',
    downloadReadinessCsv: '导出 readiness CSV',
    downloadReadinessJson: '导出 readiness JSON',
    downloadEvidence: '下载 JSON',
    calibrationDone: '建议效果已刷新：{actions} 类建议 · {clicked} 次点击 · {lifted} 次有效改进。',
    evidenceDownloaded: '发布记录已准备下载：{name}',
    noEvidenceFiles: '暂无准备度发布记录',
    sample: '样本',
    lowEvidence: '依据不足',
    impacted: '影响',
    overviewTab: '总览',
    generationTab: '生成队列',
    readinessTab: '准备度',
    observabilityTab: '观测',
    providerTab: 'Provider',
    syllabus: 'CSCA 大纲',
    syllabusBody: '维护 AI 出题使用的学科范围、主题版本、导入校验和发布状态。',
    questionBank: 'AI 生成题库',
    questionBankBody: '查看 AI 生成题从候选、审核、发布到练习使用的完整台账。',
    organizations: '机构 AI',
    organizationsBody: '机构额度、BYOK provider、成员与治理日志放在机构上下文中操作。',
    openWorkspace: '打开'
  },
  en: {
    kicker: 'Admin / AI Operations',
    title: 'AI Operations Workspace',
    body: 'Adaptive observability, provider status, AI questioning readiness, and generation queue health now have a dedicated operations surface.',
    loading: 'Loading AI operations summary.',
    errorTitle: 'AI operations summary could not load',
    retry: 'Retry',
    actions: 'Operations',
    refresh: 'Refresh summary',
    ensureCoverage: 'Ensure blueprint coverage',
    enqueueJobs: 'Enqueue generation jobs',
    processQueue: 'Process queue',
    retryFailed: 'Retry failed',
    archiveFailed: 'Archive failed jobs',
    runPregeneration: 'Run pregeneration',
    operationDone: '{label} finished.',
    operationFailed: '{label} failed.',
    observability: 'Adaptive AI Observability',
    gatewayMonitor: 'AI Gateway Monitor',
    gatewayCalls: 'Gateway calls',
    gatewayKeys: 'Key pool',
    recentGatewayErrors: 'Recent gateway errors',
    noGatewayErrors: 'No gateway errors',
    successRate: 'Success rate',
    totalTokens: 'Total tokens',
    displayCost: 'Display cost',
    averageLatency: 'Average latency',
    taskType: 'Task type',
    sourceModule: 'Source module',
    keyId: 'Key ID',
    health: 'Health',
    provider: 'Provider Status',
    readiness: 'AI Questioning Readiness',
    queue: 'Generation Queue',
    interactions: 'Interactions',
    feedback: 'Feedback',
    llmUsage: 'LLM usage',
    externalCalls: 'External LLM calls',
    estimatedTokens: 'Estimated tokens',
    estimatedCost: 'Estimated cost',
    billableCalls: 'Billable interactions',
    averageRating: 'Average rating',
    byProvider: 'By provider',
    byType: 'By type',
    rolloutHealth: 'LLM rollout health',
    lowFeedback: 'Low-feedback',
    pricing: 'Metering config',
    dateRange: 'Date range',
    errors: 'Error rate',
    fallback: 'Fallback',
    providerReady: 'Ready',
    providerFallback: 'Rule fallback',
    blockers: 'Blockers',
    noBlockers: 'No blockers',
    model: 'Model',
    rollout: 'Rollout',
    score: 'Score',
    nextAction: 'Next action',
    queued: 'Queued',
    failed: 'Failed',
    running: 'Running',
    stale: 'Stale',
    recommendedAction: 'Recommended action',
    recentFailures: 'Recent failures',
    noRecentFailures: 'No recent failures',
    latestAudit: 'Latest audit event',
    noLatestAudit: 'No audit events',
    recentJobs: 'Recent jobs',
    retryJob: 'Retry job',
    failureBreakdown: 'Failure breakdown',
    providerFailureBreakdown: 'Provider failure breakdown',
    blockedJobs: 'Blocked jobs',
    staleJobs: 'Stale jobs',
    readinessActions: 'Readiness suggestions',
    readinessEvidence: 'Readiness evidence',
    readinessCalibration: 'Suggestion result health',
    readinessThresholds: 'Hard-practice gate',
    readinessRollout: 'Readiness gate launch check',
    readinessEvidenceFiles: 'Readiness launch records',
    dailyGovernance: 'Daily governance order',
    syllabusGovernance: 'Syllabus governance',
    blueprintCoverage: 'Blueprint coverage',
    topicBank: 'Topic bank',
    qualityGovernance: 'Quality governance',
    refreshCalibration: 'Refresh suggestion results',
    downloadReadinessCsv: 'Export readiness CSV',
    downloadReadinessJson: 'Export readiness JSON',
    downloadEvidence: 'Download JSON',
    calibrationDone: 'Suggestion results refreshed: {actions} action types · {clicked} clicks · {lifted} helpful improvements.',
    evidenceDownloaded: 'Launch record is ready: {name}',
    noEvidenceFiles: 'No readiness launch records yet',
    sample: 'Sample',
    lowEvidence: 'Weak evidence',
    impacted: 'Impact',
    overviewTab: 'Overview',
    generationTab: 'Generation Queue',
    readinessTab: 'Readiness',
    observabilityTab: 'Observability',
    providerTab: 'Provider',
    syllabus: 'CSCA Syllabus',
    syllabusBody: 'Maintain the subject scope, topic versions, import validation, and publication state used by AI question generation.',
    questionBank: 'AI Question Bank',
    questionBankBody: 'Review generated questions from candidate through approval, publication, and practice usage.',
    organizations: 'Organization AI',
    organizationsBody: 'Manage org credits, BYOK providers, members, and governance logs from organization context.',
    openWorkspace: 'Open'
  }
} as const;

type AIOperationsState = {
  observability: AdminAIObservability;
  gateway: {
    summary: AdminAIGatewaySummary;
    byTask: AdminAIGatewayGroupedResult<AdminAIGatewayTaskMetric>;
    byKey: AdminAIGatewayGroupedResult<AdminAIGatewayKeyMetric>;
    errors: AdminAIGatewayErrorList;
    health: AdminAIGatewayHealth;
  };
  provider: AdminAIProviderConfig;
  readiness: AdminAIQuestioningOperationalReadiness;
  queue: AdminAIQuestioningGenerationQueueHealth;
  training: AdminTrainingEventObservability;
  evidenceFiles: AdminReadinessEvidenceFile[];
};

function emptyAIOperationsState(): AIOperationsState {
  const now = new Date().toISOString();
  return {
    observability: ({
      range: { from: now, to: now },
      filters: { provider: null, status: null, type: null, subject: null },
      summary: {
        interactions: 0,
        externalCalls: 0,
        fallbackCount: 0,
        rejectedCount: 0,
        errorCount: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedCost: 0,
        feedbackCount: 0,
        positiveFeedback: 0,
        negativeFeedback: 0,
        fallbackRate: 0,
        rejectionRate: 0,
        errorRate: 0,
        feedbackRate: 0
      },
      rolloutHealth: {
        status: 'unknown',
        provider: null,
        model: null,
        externalReady: false,
        rolloutPercent: 0,
        errorRate: 0,
        fallbackRate: 0,
        rejectionRate: 0,
        blockers: []
      },
      byDay: [],
      byProvider: [],
      byType: [],
      byStatus: [],
      reasonBreakdown: [],
      recentFailures: []
    } as unknown) as AdminAIObservability,
    gateway: {
      summary: {
        range: { from: now, to: now, days: 7 },
        summary: {
          calls: 0,
          successCalls: 0,
          failedCalls: 0,
          successRate: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          averageLatencyMs: 0,
          estimatedCostUsd: 0,
          estimatedCostDisplay: 0,
          costCurrency: 'USD',
          displayCurrency: 'CNY',
          usdToDisplayRate: 7.25,
          pricing: {
            deepseekChat: { inputPer1MTokens: 0, outputPer1MTokens: 0 },
            deepseekReasoner: { inputPer1MTokens: 0, outputPer1MTokens: 0 }
          }
        }
      },
      byTask: { range: { from: now, to: now, days: 7 }, items: [], cost: { costCurrency: 'USD', displayCurrency: 'CNY', usdToDisplayRate: 7.25, pricing: { deepseekChat: { inputPer1MTokens: 0, outputPer1MTokens: 0 }, deepseekReasoner: { inputPer1MTokens: 0, outputPer1MTokens: 0 } } } },
      byKey: { range: { from: now, to: now, days: 7 }, items: [], cost: { costCurrency: 'USD', displayCurrency: 'CNY', usdToDisplayRate: 7.25, pricing: { deepseekChat: { inputPer1MTokens: 0, outputPer1MTokens: 0 }, deepseekReasoner: { inputPer1MTokens: 0, outputPer1MTokens: 0 } } } },
      errors: { range: { from: now, to: now, days: 7 }, items: [] },
      health: { status: 'unknown', providers: [], queues: null }
    },
    provider: {
      provider: {
        mode: 'rule-fallback',
        externalReady: false,
        externalToggleEnabled: false,
        provider: 'unknown',
        supported: false,
        model: '',
        promptVersion: '',
        requestedPromptVersion: '',
        activePromptVersion: '',
        promptVersionSupported: false,
        supportedPromptVersions: [],
        promptTemplateCheck: { version: '', valid: false, issues: [] },
        apiKeyConfigured: false,
        baseUrlHost: '',
        timeoutMs: 0,
        temperature: 0,
        maxOutputChars: 0,
        rollout: { percent: 0, strategy: 'disabled' },
        fallbackModel: '',
        fallbackPromptVersion: '',
        blockers: ['provider_status_unavailable']
      },
      usageMeter: {
        pricingConfigured: false,
        currency: 'USD',
        inputCostPer1KTokens: 0,
        outputCostPer1KTokens: 0,
        unitTokenBudget: 0,
        meteringMode: 'unknown'
      }
    },
    readiness: ({
      subject: null,
      useCase: AI_QUESTIONING_READINESS_USE_CASE,
      status: 'needs_attention',
      score: 0,
      nextAction: '等待 readiness 模块恢复',
      blockers: [],
      warnings: [],
      dimensions: {
        blueprintCoverage: {
          publishedTopicCount: 0,
          coveredTopicCount: 0,
          missingTopicCount: 0,
          activeBlueprintCount: 0,
          pausedBlueprintCount: 0,
          archivedBlueprintCount: 0,
          status: 'unknown'
        },
        topicBank: {
          total: 0,
          missingBlueprintCount: 0,
          needsCandidateCount: 0,
          needsPublishCount: 0,
          needsQualityReviewCount: 0,
          healthyCount: 0,
          status: 'unknown'
        },
        generationQueue: {
          ...EMPTY_GENERATION_QUEUE.summary,
          status: EMPTY_GENERATION_QUEUE.status,
          recommendedAction: EMPTY_GENERATION_QUEUE.recommendedAction
        },
        syllabusGovernance: {
          total: 0,
          currentCount: 0,
          staleCount: 0,
          unpublishedTopicCount: 0,
          pendingReviewCount: 0,
          status: 'unknown'
        },
        qualityGovernance: {
          status: 'unknown',
          needsReviewCount: 0,
          highSeverityCount: 0,
          escalationCount: 0,
          dueSoonCount: 0
        }
      },
      latestAuditEvent: null,
      generatedAt: now
    } as unknown) as AdminAIQuestioningOperationalReadiness,
    queue: EMPTY_GENERATION_QUEUE,
    training: ({
      range: { from: now, to: now },
      filters: { eventType: null, subject: null },
      summary: {
        totalEvents: 0,
        uniqueUsers: 0,
        diagnosticStarted: 0,
        diagnosticCompleted: 0,
        diagnosticCompletionRate: 0,
        practiceStarted: 0,
        practiceCompleted: 0,
        practiceCompletionRate: 0,
        aiEvents: 0
      },
      byDay: [],
      byEventType: [],
      bySubject: [],
      readinessActions: {
        clickedCount: 0,
        followedCount: 0,
        followThroughRate: 0,
        averageExpectedGain: null,
        status: 'no_data',
        byActionType: []
      }
    } as unknown) as AdminTrainingEventObservability,
    evidenceFiles: []
  };
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat().format(value);
}

function formatCost(value: number | null | undefined, currency: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${currency} ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value)}`;
}

function compactError(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.code ? `/${error.code}` : '';
    return `HTTP ${error.status}${code}：${error.message}`;
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatGenerationQueueResult(label: string, result: unknown) {
  const record = recordFrom(result);
  const requested = typeof record.requested === 'number' ? record.requested : null;
  const succeeded = typeof record.succeeded === 'number' ? record.succeeded : null;
  const failed = typeof record.failed === 'number' ? record.failed : null;
  const enqueued = typeof record.enqueued === 'number' ? record.enqueued : null;
  const skipped = typeof record.skipped === 'number' ? record.skipped : null;
  const errors = Array.isArray(record.errors)
    ? record.errors.flatMap((item) => {
      const error = recordFrom(item);
      const id = typeof error.id === 'number' || typeof error.id === 'string' ? `#${error.id}` : '#-';
      const message = typeof error.message === 'string' ? error.message : '';
      return message ? [`${id}: ${message}`] : [];
    })
    : [];
  const metrics = [
    requested !== null ? `请求 ${requested}` : null,
    enqueued !== null ? `入队 ${enqueued}` : null,
    skipped !== null ? `跳过 ${skipped}` : null,
    succeeded !== null ? `成功 ${succeeded}` : null,
    failed !== null ? `失败 ${failed}` : null
  ].filter(Boolean).join('，');
  if (!metrics && errors.length === 0) return label;
  return `${label}：${metrics || '已完成'}${errors.length ? `；错误：${errors.slice(0, 4).join('；')}${errors.length > 4 ? '；……' : ''}` : ''}`;
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

function fillTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((current, [key, value]) => current.split(`{${key}}`).join(String(value)), template);
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

function readinessCsv(readiness: AdminAIQuestioningOperationalReadiness) {
  const rows = [
    ['section', 'key', 'value', 'status', 'action'],
    ['summary', 'subject', readiness.subject ?? '', readiness.status, readiness.nextAction],
    ['summary', 'useCase', readiness.useCase ?? '', readiness.status, readiness.nextAction],
    ['summary', 'score', readiness.score, readiness.status, readiness.nextAction],
    ['summary', 'generatedAt', readiness.generatedAt, readiness.status, readiness.nextAction],
    ...Object.entries(readiness.dimensions).map(([key, value]) => (
      ['dimension', key, JSON.stringify(value), typeof value.status === 'string' ? value.status : '', '']
    )),
    ...readiness.blockers.map((item) => ['blocker', item.key, item.count, readiness.status, item.action]),
    ...readiness.warnings.map((item) => ['warning', item.key, item.count, readiness.status, item.action])
  ];
  return rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function AdminAIOperationsPage({
  currentUser,
  onGoToAuth,
  onBackAudit,
  onGoToQuestionBank,
  onGoToOrganizations,
  onGoToUsers
}: AdminAIOperationsPageProps) {
  const { locale } = useI18n();
  const copy = locale === 'en' ? AI_OPERATIONS_COPY.en : AI_OPERATIONS_COPY.zh;
  const isAdmin = currentUser?.role === 'admin';
  const [data, setData] = useState<AIOperationsState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyActions, setBusyActions] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activeTab, setActiveTab] = useState<AIOperationsTab>('overview');

  useEffect(() => {
    if (!isAdmin) return;
    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    const requestLabels = ['AI 观测', 'AI Gateway 监控', 'Provider 配置', '出题 readiness', '生成队列', '训练事件观测', '发布证据'];
    const requests = [
      getAdminAdaptiveAIObservability({ days: 7 }),
      Promise.all([
        getAdminAIGatewaySummary({ days: 7 }),
        getAdminAIGatewayByTask({ days: 7 }),
        getAdminAIGatewayByKey({ days: 7 }),
        getAdminAIGatewayErrors({ days: 7, limit: 20 }),
        getAdminAIGatewayHealth()
      ]).then(([summary, byTask, byKey, errors, health]) => ({ summary, byTask, byKey, errors, health })),
      getAdminAdaptiveAIProviderConfig(),
      getAdminAIQuestioningOperationalReadiness({ useCase: AI_QUESTIONING_READINESS_USE_CASE }),
      getAdminAIQuestioningGenerationQueueHealth({ limit: 8 }),
      getAdminAdaptiveTrainingEventObservability({ days: 14 }),
      getAdminReadinessEvidenceFiles()
    ] as const;
    void Promise.allSettled(requests)
      .then((results) => {
        if (!isCurrent) return;
        const [observabilityResult, gatewayResult, providerResult, readinessResult, queueResult, trainingResult, evidenceResponseResult] = results;
        const failedItems = results.flatMap((result, index) => {
          if (result.status !== 'rejected') return [];
          const label = requestLabels[index] ?? `模块 ${index + 1}`;
          return [`${label}：${compactError(result.reason)}`];
        });
        setData((current) => {
          if (!current && failedItems.length === results.length) return current;
          const base = current ?? emptyAIOperationsState();
          return {
            observability: isFulfilled(observabilityResult) ? observabilityResult.value : base.observability,
            gateway: isFulfilled(gatewayResult) ? gatewayResult.value : base.gateway,
            provider: isFulfilled(providerResult) ? providerResult.value : base.provider,
            readiness: isFulfilled(readinessResult) ? readinessResult.value : base.readiness,
            queue: isFulfilled(queueResult) ? queueResult.value : base.queue,
            training: isFulfilled(trainingResult) ? trainingResult.value : base.training,
            evidenceFiles: isFulfilled(evidenceResponseResult) ? evidenceResponseResult.value.items : base.evidenceFiles
          };
        });
        setError(failedItems.length ? `部分 AI 运维模块暂时无法加载：${failedItems.join('；')}。` : null);
      })
      .catch((nextError) => {
        if (!isCurrent) return;
        setError(compactError(nextError));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [isAdmin, refreshNonce]);

  const providerBlockers = useMemo(() => data?.provider.provider.blockers ?? [], [data]);
  const aiTabs = useMemo<Array<{ key: AIOperationsTab; label: string; detail: string }>>(() => {
    if (!data) {
      return [
        { key: 'overview', label: copy.overviewTab, detail: '-' },
        { key: 'generation', label: copy.generationTab, detail: '-' },
        { key: 'readiness', label: copy.readinessTab, detail: '-' },
        { key: 'observability', label: copy.observabilityTab, detail: '-' },
        { key: 'provider', label: copy.providerTab, detail: '-' }
      ];
    }
    return [
      { key: 'overview', label: copy.overviewTab, detail: `${data.observability.summary.interactions} ${copy.interactions}` },
      { key: 'generation', label: copy.generationTab, detail: `${data.queue.summary.queued} ${copy.queued} · ${data.queue.summary.failed} ${copy.failed}` },
      { key: 'readiness', label: copy.readinessTab, detail: `${data.readiness.status} · ${copy.score}: ${data.readiness.score}` },
      { key: 'observability', label: copy.observabilityTab, detail: `${copy.gatewayCalls}: ${formatNumber(data.gateway.summary.summary.calls)} · ${copy.errors}: ${formatPercent(data.observability.summary.errorRate)}` },
      { key: 'provider', label: copy.providerTab, detail: data.provider.provider.externalReady ? copy.providerReady : copy.providerFallback }
    ];
  }, [copy, data]);

  const isActionBusy = (actionId: string) => busyActions.has(actionId);
  const generationActionsBusy = Array.from(busyActions).some((actionId) => (
    ['ensure-coverage', 'enqueue-jobs', 'process-queue', 'retry-failed', 'archive-failed', 'pregeneration'].includes(actionId)
    || actionId.startsWith('retry-job-')
  ));

  async function runOperation(
    actionId: string,
    label: string,
    operation: () => Promise<unknown>,
    options?: { refresh?: boolean }
  ) {
    setBusyActions((current) => new Set(current).add(actionId));
    setFeedback(null);
    setError(null);
    try {
      const result = await operation();
      setFeedback(typeof result === 'string' ? result : fillTemplate(copy.operationDone, { label }));
      if (options?.refresh !== false) {
        setRefreshNonce((value) => value + 1);
      }
    } catch (nextError) {
      setError(`${fillTemplate(copy.operationFailed, { label })} ${compactError(nextError)}`);
    } finally {
      setBusyActions((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      });
    }
  }

  async function refreshCalibration() {
    await runOperation('refresh-calibration', copy.refreshCalibration, async () => {
      const result = await refreshAdminReadinessActionCalibrationSnapshots();
      return fillTemplate(copy.calibrationDone, {
        actions: result.actionTypes,
        clicked: result.clickedCount,
        lifted: result.abilityLiftCount
      });
    });
  }

  async function downloadEvidenceFile(name: string) {
    await runOperation(`evidence-${name}`, copy.downloadEvidence, async () => {
      const result = await getAdminReadinessEvidenceFile(name);
      downloadTextFile(result.file.name, `${JSON.stringify(result.content, null, 2)}\n`, 'application/json;charset=utf-8');
      return fillTemplate(copy.evidenceDownloaded, { name: result.file.name });
    }, { refresh: false });
  }

  async function downloadReadinessSnapshot(format: 'csv' | 'json') {
    if (!data) return;
    await runOperation(`readiness-${format}`, format === 'csv' ? copy.downloadReadinessCsv : copy.downloadReadinessJson, async () => {
      recordAdminAIQuestioningOperationalReadinessEvent({
        event: format === 'csv' ? 'download_csv' : 'download_json',
        subject: data.readiness.subject,
        useCase: data.readiness.useCase === 'online_mock_exam' ? 'online_mock_exam' : AI_QUESTIONING_READINESS_USE_CASE,
        targetId: 'ai-operations-readiness',
        format
      }).catch(() => undefined);
      const subjectPart = data.readiness.subject ?? 'all';
      const useCasePart = data.readiness.useCase ?? AI_QUESTIONING_READINESS_USE_CASE;
      const filename = `ai-questioning-readiness-${useCasePart}-${subjectPart}-${data.readiness.generatedAt.slice(0, 10)}.${format}`;
      if (format === 'csv') {
        downloadTextFile(filename, `${readinessCsv(data.readiness)}\n`, 'text/csv;charset=utf-8');
      } else {
        downloadTextFile(filename, `${JSON.stringify(data.readiness, null, 2)}\n`, 'application/json;charset=utf-8');
      }
    }, { refresh: false });
  }

  return (
    <AdminPageShell
      current="aiOperations"
      currentUser={currentUser}
      kicker={copy.kicker}
      title={copy.title}
      body={copy.body}
      onGoToAuth={onGoToAuth}
      onGoToAudit={onBackAudit}
      onGoToOrganizations={onGoToOrganizations}
      onGoToUsers={onGoToUsers}
    >
      {isAdmin && isLoading && (
        <section className="admin-feedback">
          <strong>{copy.loading}</strong>
        </section>
      )}

      {isAdmin && error && (
        <section className="admin-feedback warning">
          <strong>{copy.errorTitle}</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setRefreshNonce((value) => value + 1)}>{copy.retry}</button>
        </section>
      )}

      {isAdmin && feedback && (
        <section className="admin-feedback success">
          <strong>{feedback}</strong>
        </section>
      )}

      {isAdmin && data && (
        <>
          <AdminSubnav
            items={aiTabs}
            activeKey={activeTab}
            ariaLabel={copy.title}
            className="admin-ai-operations-subnav"
            onChange={setActiveTab}
          />

          {activeTab === 'generation' && (
          <QuestionSupplyFulfillmentPanel locale={locale} />
          )}

          {activeTab === 'generation' && (
          <AdminPanel className="admin-ai-operations-actions">
            <AdminPanelHeader
              kicker={copy.actions}
              title={copy.queue}
              actions={(
                <AdminActionBar>
                <button
                  type="button"
                  className={isLoading ? 'ghost-button admin-action-loading' : 'ghost-button'}
                  onClick={() => setRefreshNonce((value) => value + 1)}
                  disabled={isLoading}
                >
                  {copy.refresh}
                </button>
                <button
                  type="button"
                  className={isActionBusy('ensure-coverage') ? 'admin-action-loading' : undefined}
                  onClick={() => void runOperation('ensure-coverage', copy.ensureCoverage, () => ensureAdminAIQuestioningBlueprintCoverage({ limit: 30 }))}
                  disabled={generationActionsBusy}
                >
                  {copy.ensureCoverage}
                </button>
                <button
                  type="button"
                  className={isActionBusy('enqueue-jobs') ? 'admin-action-loading' : undefined}
                  onClick={() => void runOperation('enqueue-jobs', copy.enqueueJobs, () => enqueueAdminAIQuestioningGenerationJobs({ limit: 20 }))}
                  disabled={generationActionsBusy}
                >
                  {copy.enqueueJobs}
                </button>
                <button
                  type="button"
                  className={isActionBusy('process-queue') ? 'admin-action-loading' : undefined}
                  onClick={() => void runOperation('process-queue', copy.processQueue, async () => formatGenerationQueueResult(copy.processQueue, await processAdminAIQuestioningGenerationJobs({ limit: 20, retryFailed: false })))}
                  disabled={generationActionsBusy || data.queue.summary.queued === 0}
                >
                  {copy.processQueue}
                </button>
                <button
                  type="button"
                  className={isActionBusy('retry-failed') ? 'admin-action-loading' : undefined}
                  onClick={() => void runOperation('retry-failed', copy.retryFailed, async () => formatGenerationQueueResult(copy.retryFailed, await bulkAdminAIQuestioningGenerationJobs({ action: 'retry_failed', limit: 20 })))}
                  disabled={generationActionsBusy || data.queue.summary.failed === 0}
                >
                  {copy.retryFailed}
                </button>
                <button
                  type="button"
                  className={isActionBusy('archive-failed') ? 'ghost-button admin-action-loading' : 'ghost-button'}
                  onClick={() => void runOperation('archive-failed', copy.archiveFailed, async () => formatGenerationQueueResult(copy.archiveFailed, await bulkAdminAIQuestioningGenerationJobs({ action: 'archive_failed', limit: 20 })))}
                  disabled={generationActionsBusy || data.queue.summary.failed === 0}
                >
                  {copy.archiveFailed}
                </button>
                <button
                  type="button"
                  className={isActionBusy('pregeneration') ? 'admin-action-loading' : undefined}
                  onClick={() => void runOperation('pregeneration', copy.runPregeneration, () => runAdminAIQuestioningPregeneration({ limit: 10, perTopic: 1, retryFailed: true }))}
                  disabled={generationActionsBusy}
                >
                  {copy.runPregeneration}
                </button>
                </AdminActionBar>
              )}
            />
          </AdminPanel>
          )}

          {activeTab === 'overview' && (
          <AdminPanel>
            <AdminPanelHeader kicker={copy.readiness} title={copy.dailyGovernance}>
              <p>{copy.nextAction}: {data.readiness.nextAction}</p>
            </AdminPanelHeader>
            <div className="admin-list compact">
              <div>
                <strong>1. {copy.syllabusGovernance}</strong>
                <span>{data.readiness.dimensions.syllabusGovernance.status} · stale {data.readiness.dimensions.syllabusGovernance.staleCount} · unpublished {data.readiness.dimensions.syllabusGovernance.unpublishedTopicCount}</span>
              </div>
              <div>
                <strong>2. {copy.blueprintCoverage}</strong>
                <span>{data.readiness.dimensions.blueprintCoverage.status} · covered {data.readiness.dimensions.blueprintCoverage.coveredTopicCount}/{data.readiness.dimensions.blueprintCoverage.publishedTopicCount} · missing {data.readiness.dimensions.blueprintCoverage.missingTopicCount}</span>
              </div>
              <div>
                <strong>3. {copy.topicBank}</strong>
                <span>{data.readiness.dimensions.topicBank.status} · missing blueprints {data.readiness.dimensions.topicBank.missingBlueprintCount} · needs candidates {data.readiness.dimensions.topicBank.needsCandidateCount} · needs publish {data.readiness.dimensions.topicBank.needsPublishCount}</span>
              </div>
              <div>
                <strong>4. {copy.queue}</strong>
                <span>{data.readiness.dimensions.generationQueue.status} · queued {data.readiness.dimensions.generationQueue.queued} · failed {data.readiness.dimensions.generationQueue.failed} · {copy.recommendedAction}: {data.readiness.dimensions.generationQueue.recommendedAction}</span>
              </div>
              <div>
                <strong>5. {copy.qualityGovernance}</strong>
                <span>{data.readiness.dimensions.qualityGovernance.status} · review {data.readiness.dimensions.qualityGovernance.needsReviewCount} · high {data.readiness.dimensions.qualityGovernance.highSeverityCount} · escalation {data.readiness.dimensions.qualityGovernance.escalationCount}</span>
              </div>
            </div>
          </AdminPanel>
          )}

          {activeTab === 'overview' && (
          <AdminStatsStrip
            ariaLabel={copy.observability}
            className="admin-ai-operations-kpis"
            items={[
              { key: 'interactions', label: copy.interactions, value: data.observability.summary.interactions, detail: `${copy.feedback}: ${data.observability.summary.feedbackCount}` },
              { key: 'llm-usage', label: copy.llmUsage, value: formatNumber(data.observability.summary.externalInteractions), detail: `${copy.estimatedTokens}: ${formatNumber(data.observability.summary.estimatedTokens)}` },
              { key: 'errors', label: copy.errors, value: formatPercent(data.observability.summary.errorRate), detail: `${copy.fallback}: ${formatPercent(data.observability.summary.fallbackRate)}` },
              { key: 'provider', label: copy.provider, value: data.provider.provider.externalReady ? copy.providerReady : copy.providerFallback, detail: `${data.provider.provider.provider} · ${data.provider.provider.baseUrlHost || '-'}` },
              { key: 'readiness', label: copy.readiness, value: data.readiness.status, detail: `${copy.score}: ${data.readiness.score}` }
            ]}
          />
          )}

          {activeTab === 'overview' && (
          <section className="admin-work-grid three admin-ai-operations-grid">
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.questionBank} title={copy.questionBank} />
              <p className="form-hint">{copy.questionBankBody}</p>
              {onGoToQuestionBank && (
                <button type="button" className="ghost-button" onClick={onGoToQuestionBank}>
                  {copy.openWorkspace}
                </button>
              )}
            </AdminPanel>
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.syllabus} title={copy.syllabus} />
              <p className="form-hint">{copy.syllabusBody}</p>
              {onGoToQuestionBank && (
                <button type="button" className="ghost-button" onClick={onGoToQuestionBank}>
                  {copy.openWorkspace}
                </button>
              )}
            </AdminPanel>
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.organizations} title={copy.organizations} />
              <p className="form-hint">{copy.organizationsBody}</p>
              {onGoToOrganizations && (
                <button type="button" className="ghost-button" onClick={onGoToOrganizations}>
                  {copy.openWorkspace}
                </button>
              )}
            </AdminPanel>
          </section>
          )}

          {(activeTab === 'overview' || activeTab === 'provider' || activeTab === 'generation') && (
          <section className="admin-work-grid two admin-ai-operations-grid">
            {(activeTab === 'overview' || activeTab === 'provider') && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.provider} title={data.provider.provider.model || copy.providerFallback} />
              <div className="metric-grid three">
                <div><span>{copy.model}</span><strong>{data.provider.provider.activePromptVersion}</strong></div>
                <div><span>{copy.rollout}</span><strong>{data.provider.provider.rollout.percent}%</strong></div>
                <div><span>{copy.blockers}</span><strong>{providerBlockers.length}</strong></div>
              </div>
              <p className="form-hint">{providerBlockers.length ? providerBlockers.join(' · ') : copy.noBlockers}</p>
            </AdminPanel>
            )}

            {(activeTab === 'overview' || activeTab === 'generation') && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.queue} title={data.queue.status} />
              <div className="metric-grid four">
                <div><span>{copy.queued}</span><strong>{data.queue.summary.queued}</strong></div>
                <div><span>{copy.running}</span><strong>{data.queue.summary.running}</strong></div>
                <div><span>{copy.failed}</span><strong>{data.queue.summary.failed}</strong></div>
                <div><span>{copy.stale}</span><strong>{data.queue.summary.staleRunning}</strong></div>
              </div>
              <p className="form-hint">{copy.recommendedAction}: {data.queue.recommendedAction}</p>
              {activeTab === 'generation' && (
                <div className="admin-list compact">
                  <div>
                    <strong>{copy.blockedJobs}</strong>
                    <span>{data.queue.blockedJobs.slice(0, 8).map((id) => `#${id}`).join(', ') || '-'}</span>
                  </div>
                  <div>
                    <strong>{copy.staleJobs}</strong>
                    <span>{data.queue.staleRunningJobs.slice(0, 8).map((id) => `#${id}`).join(', ') || '-'}</span>
                  </div>
                </div>
              )}
            </AdminPanel>
            )}
          </section>
          )}

          {(activeTab === 'readiness' || activeTab === 'observability') && (
          <section className="admin-work-grid two admin-ai-operations-grid">
            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.gatewayMonitor} title={copy.gatewayCalls}>
                <p>{data.gateway.summary.range.from || '-'} {'->'} {data.gateway.summary.range.to || '-'}</p>
              </AdminPanelHeader>
              <div className="metric-grid three">
                <div><span>{copy.gatewayCalls}</span><strong>{formatNumber(data.gateway.summary.summary.calls)}</strong></div>
                <div><span>{copy.successRate}</span><strong>{formatPercent(data.gateway.summary.summary.successRate)}</strong></div>
                <div><span>{copy.totalTokens}</span><strong>{formatNumber(data.gateway.summary.summary.totalTokens)}</strong></div>
                <div><span>{copy.estimatedCost}</span><strong>{formatCost(data.gateway.summary.summary.estimatedCostUsd, data.gateway.summary.summary.costCurrency)}</strong></div>
                <div><span>{copy.displayCost}</span><strong>{formatCost(data.gateway.summary.summary.estimatedCostDisplay, data.gateway.summary.summary.displayCurrency)}</strong></div>
                <div><span>{copy.averageLatency}</span><strong>{formatNumber(data.gateway.summary.summary.averageLatencyMs)} ms</strong></div>
              </div>
              <p className="form-hint">
                {copy.health}: {data.gateway.health.status}
                {' · '}
                USD/CNY {data.gateway.summary.summary.usdToDisplayRate}
              </p>
            </AdminPanel>
            )}

            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.gatewayMonitor} title={copy.gatewayKeys} />
              <div className="admin-list compact">
                {data.gateway.byKey.items.slice(0, 8).map((item) => (
                  <div key={`${item.providerId || '-'}-${item.keyId || '-'}`}>
                    <strong>{item.providerId || '-'} · {item.keyId || '-'}</strong>
                    <span>
                      {copy.gatewayCalls}: {formatNumber(item.calls)}
                      {' · '}
                      {copy.successRate}: {formatPercent(item.successRate)}
                      {' · '}
                      {copy.totalTokens}: {formatNumber(item.totalTokens)}
                      {' · '}
                      {copy.displayCost}: {formatCost(item.estimatedCostDisplay, data.gateway.byKey.cost.displayCurrency)}
                    </span>
                    {item.latestErrorCode && <span>{copy.errors}: {item.latestErrorCode}</span>}
                  </div>
                ))}
                {data.gateway.byKey.items.length === 0 && <p className="form-hint">-</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.gatewayMonitor} title={copy.byType} />
              <div className="admin-list compact">
                {data.gateway.byTask.items.slice(0, 8).map((item) => (
                  <div key={`${item.taskType || '-'}-${item.sourceModule || '-'}-${item.model || '-'}`}>
                    <strong>{item.taskType || '-'}</strong>
                    <span>
                      {copy.sourceModule}: {item.sourceModule || '-'}
                      {' · '}
                      {copy.model}: {item.model || '-'}
                    </span>
                    <span>
                      {copy.gatewayCalls}: {formatNumber(item.calls)}
                      {' · '}
                      {copy.successRate}: {formatPercent(item.successRate)}
                      {' · '}
                      {copy.displayCost}: {formatCost(item.estimatedCostDisplay, data.gateway.byTask.cost.displayCurrency)}
                    </span>
                  </div>
                ))}
                {data.gateway.byTask.items.length === 0 && <p className="form-hint">-</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.gatewayMonitor} title={data.gateway.errors.items.length || copy.noGatewayErrors} />
              <div className="admin-list compact">
                {data.gateway.errors.items.slice(0, 8).map((item) => (
                  <div key={item.id}>
                    <strong>{item.taskType || '-'} · {item.errorCode || item.status || '-'}</strong>
                    <span>
                      {item.providerId || '-'} · {item.keyId || '-'}
                      {' · '}
                      {item.createdAt ? new Date(item.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN') : '-'}
                    </span>
                    {item.errorMessage && <span>{item.errorMessage}</span>}
                  </div>
                ))}
                {data.gateway.errors.items.length === 0 && <p className="form-hint">{copy.noGatewayErrors}</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.llmUsage} title={copy.dateRange}>
                <p>{data.observability.range.from || '-'} {'->'} {data.observability.range.to || '-'}</p>
              </AdminPanelHeader>
              <div className="metric-grid three">
                <div><span>{copy.externalCalls}</span><strong>{formatNumber(data.observability.summary.externalInteractions)}</strong></div>
                <div><span>{copy.billableCalls}</span><strong>{formatNumber(data.observability.summary.billableInteractions)}</strong></div>
                <div><span>{copy.estimatedTokens}</span><strong>{formatNumber(data.observability.summary.estimatedTokens)}</strong></div>
                <div><span>{copy.estimatedCost}</span><strong>{formatCost(data.observability.summary.estimatedCost, data.provider.usageMeter.currency)}</strong></div>
                <div><span>{copy.feedback}</span><strong>{formatNumber(data.observability.summary.feedbackCount)}</strong></div>
                <div><span>{copy.averageRating}</span><strong>{data.observability.summary.averageRating ?? '-'}</strong></div>
              </div>
              <p className="form-hint">
                {copy.pricing}: {data.provider.usageMeter.pricingConfigured ? data.provider.usageMeter.meteringMode : copy.providerFallback}
                {' · '}
                {data.provider.usageMeter.currency}
                {' · input '}
                {data.provider.usageMeter.inputCostPer1KTokens}/1K
                {' · output '}
                {data.provider.usageMeter.outputCostPer1KTokens}/1K
              </p>
            </AdminPanel>
            )}

            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.rolloutHealth} title={data.observability.rolloutHealth.status} />
              <div className="metric-grid three">
                <div><span>{copy.interactions}</span><strong>{formatNumber(data.observability.rolloutHealth.sampleSize)}</strong></div>
                <div><span>{copy.feedback}</span><strong>{formatNumber(data.observability.rolloutHealth.feedbackSampleSize)}</strong></div>
                <div><span>{copy.lowFeedback}</span><strong>{formatPercent(data.observability.rolloutHealth.lowFeedbackRate)}</strong></div>
              </div>
              <p className="form-hint">{copy.recommendedAction}: {data.observability.rolloutHealth.recommendation}</p>
              <div className="admin-list compact">
                {data.observability.rolloutHealth.checks.slice(0, 6).map((check) => (
                  <div key={check.key}>
                    <strong>{check.label}</strong>
                    <span>{check.status} · {check.value ?? '-'} / {check.threshold}</span>
                  </div>
                ))}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'readiness' && (
            <AdminPanel as="article">
              <AdminPanelHeader
                kicker={copy.readiness}
                title={data.readiness.nextAction || copy.nextAction}
                actions={(
                  <AdminActionBar>
                    <button
                      type="button"
                      className={isActionBusy('readiness-csv') ? 'ghost-button admin-action-loading' : 'ghost-button'}
                      onClick={() => void downloadReadinessSnapshot('csv')}
                      disabled={isActionBusy('readiness-csv')}
                    >
                      {copy.downloadReadinessCsv}
                    </button>
                    <button
                      type="button"
                      className={isActionBusy('readiness-json') ? 'ghost-button admin-action-loading' : 'ghost-button'}
                      onClick={() => void downloadReadinessSnapshot('json')}
                      disabled={isActionBusy('readiness-json')}
                    >
                      {copy.downloadReadinessJson}
                    </button>
                  </AdminActionBar>
                )}
              />
              <p className="form-hint">{copy.nextAction}: {data.readiness.nextAction}</p>
              <div className="admin-list compact">
                {[...data.readiness.blockers, ...data.readiness.warnings].slice(0, 6).map((item) => (
                  <div key={`${item.key}-${item.action}`}>
                    <strong>{item.key}</strong>
                    <span>{item.count} · {item.action}</span>
                  </div>
                ))}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'readiness' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.readinessActions} title={data.training.readinessActions.status} />
              <div className="metric-grid three">
                <div><span>{copy.interactions}</span><strong>{formatNumber(data.training.readinessActions.clickedCount)}</strong></div>
                <div><span>{copy.feedback}</span><strong>{formatPercent(data.training.readinessActions.followThroughRate)}</strong></div>
                <div><span>{copy.score}</span><strong>{data.training.readinessActions.averageExpectedGain ?? '-'}</strong></div>
              </div>
              <div className="admin-list compact">
                {data.training.readinessActions.byActionType.slice(0, 6).map((item) => (
                  <div key={item.key}>
                    <strong>{item.key}</strong>
                    <span>
                      {copy.interactions}: {formatNumber(item.clickedCount)}
                      {' · '}
                      follow-through: {formatPercent(item.followThroughRate)}
                      {' · '}
                      {item.status}
                    </span>
                  </div>
                ))}
                {data.training.readinessActions.byActionType.length === 0 && <p className="form-hint">-</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'readiness' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.readinessEvidence} title={data.training.readinessEvidence.status} />
              <div className="metric-grid three">
                <div><span>{copy.sample}</span><strong>{formatNumber(data.training.readinessEvidence.sampleSize)}</strong></div>
                <div><span>{copy.lowEvidence}</span><strong>{formatPercent(data.training.readinessEvidence.lowRate)}</strong></div>
                <div><span>{copy.score}</span><strong>{data.training.readinessEvidence.averageScore ?? '-'}</strong></div>
              </div>
              <div className="admin-list compact">
                {data.training.readinessEvidence.topGaps.slice(0, 6).map((item) => (
                  <div key={item.key}>
                    <strong>{item.key}</strong>
                    <span>{formatNumber(item.count)}</span>
                  </div>
                ))}
                {data.training.readinessEvidence.topGaps.length === 0 && <p className="form-hint">-</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'readiness' && (
            <AdminPanel as="article">
              <AdminPanelHeader
                kicker={copy.readinessCalibration}
                title={data.training.readinessCalibrationHealth.status}
                actions={(
                  <button
                    type="button"
                    className={isActionBusy('refresh-calibration') ? 'ghost-button admin-action-loading' : 'ghost-button'}
                    onClick={() => void refreshCalibration()}
                    disabled={isActionBusy('refresh-calibration')}
                  >
                    {copy.refreshCalibration}
                  </button>
                )}
              />
              <div className="metric-grid three">
                <div><span>{copy.sample}</span><strong>{formatNumber(data.training.readinessCalibrationHealth.snapshotCount)}</strong></div>
                <div><span>{copy.latestAudit}</span><strong>{data.training.readinessCalibrationHealth.latestSnapshotDate || '-'}</strong></div>
                <div><span>{copy.blockers}</span><strong>{data.training.readinessCalibrationHealth.alerts.length}</strong></div>
              </div>
              <div className="admin-list compact">
                {data.training.readinessCalibrationHealth.alerts.slice(0, 6).map((item) => (
                  <div key={`${item.code}-${item.actionType ?? ''}-${item.subject ?? ''}`}>
                    <strong>{item.code}</strong>
                    <span>{item.severity} · {item.message}</span>
                  </div>
                ))}
                {data.training.readinessCalibrationHealth.alerts.length === 0 && <p className="form-hint">{copy.noBlockers}</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'readiness' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.readinessThresholds} title={data.training.readinessDifficultyThresholds.mode} />
              <p className="form-hint">
                {copy.sample}: {formatNumber(data.training.readinessDifficultyThresholds.minSampleSize)}
              </p>
              <div className="admin-list compact">
                {data.training.readinessDifficultyThresholds.bySubject.map((item) => (
                  <div key={item.subject}>
                    <strong>{item.subject}</strong>
                    <span>
                      required {item.requiredCount}
                      {' · '}
                      recommended {item.recommendedCount}
                      {' · '}
                      {copy.impacted}: {formatNumber(item.impactedUserSubjectCount)}
                      {' · '}
                      {item.source}
                    </span>
                  </div>
                ))}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'readiness' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.readinessRollout} title={data.training.readinessSampledThresholdRollout.status} />
              <div className="metric-grid three">
                <div><span>{copy.sample}</span><strong>{data.training.readinessSampledThresholdRollout.metrics.sampledReadySubjects}/{data.training.readinessSampledThresholdRollout.metrics.totalSubjects}</strong></div>
                <div><span>{copy.impacted}</span><strong>{formatNumber(data.training.readinessSampledThresholdRollout.metrics.impactedUserSubjectCount)}</strong></div>
                <div><span>{copy.blockers}</span><strong>{data.training.readinessSampledThresholdRollout.metrics.blockingCalibrationAlertCount}</strong></div>
              </div>
              <div className="admin-list compact">
                {data.training.readinessSampledThresholdRollout.checklist.map((item) => (
                  <div key={item.key}>
                    <strong>{item.key}</strong>
                    <span>{item.status} · {item.detail}</span>
                  </div>
                ))}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'readiness' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.readinessEvidenceFiles} title={data.evidenceFiles.length || copy.noEvidenceFiles} />
              <div className="admin-list compact">
                {data.evidenceFiles.slice(0, 8).map((file) => (
                  <div key={file.name}>
                    <strong>{file.name}</strong>
                    <span>
                      {file.kind} · {file.status || '-'} · {file.phase || '-'} · {file.generatedAt || file.modifiedAt}
                    </span>
                    <button
                      type="button"
                      className={isActionBusy(`evidence-${file.name}`) ? 'ghost-button admin-action-loading' : 'ghost-button'}
                      onClick={() => void downloadEvidenceFile(file.name)}
                      disabled={isActionBusy(`evidence-${file.name}`)}
                    >
                      {copy.downloadEvidence}
                    </button>
                  </div>
                ))}
                {data.evidenceFiles.length === 0 && <p className="form-hint">{copy.noEvidenceFiles}</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.byProvider} title={copy.llmUsage} />
              <div className="admin-list compact">
                {data.observability.byProvider.slice(0, 8).map((item) => (
                  <div key={item.key}>
                    <strong>{item.key || '-'}</strong>
                    <span>
                      {copy.interactions}: {formatNumber(item.interactions)}
                      {' · '}
                      {copy.externalCalls}: {formatNumber(item.externalInteractions)}
                      {' · '}
                      {copy.estimatedTokens}: {formatNumber(item.estimatedTokens)}
                      {' · '}
                      {copy.estimatedCost}: {formatCost(item.estimatedCost, data.provider.usageMeter.currency)}
                    </span>
                  </div>
                ))}
                {data.observability.byProvider.length === 0 && <p className="form-hint">-</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.byType} title={copy.interactions} />
              <div className="admin-list compact">
                {data.observability.byType.slice(0, 8).map((item) => (
                  <div key={item.key}>
                    <strong>{item.key || '-'}</strong>
                    <span>
                      {copy.interactions}: {formatNumber(item.interactions)}
                      {' · '}
                      {copy.fallback}: {formatNumber(item.fallbackInteractions)}
                      {' · '}
                      {copy.errors}: {formatNumber(item.errorInteractions)}
                    </span>
                  </div>
                ))}
                {data.observability.byType.length === 0 && <p className="form-hint">-</p>}
              </div>
            </AdminPanel>
            )}

            {activeTab === 'observability' && (
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.recentFailures} title={data.observability.recentFailures.length || copy.noRecentFailures} />
              <div className="admin-list compact">
                {data.observability.recentFailures.slice(0, 5).map((item) => (
                  <div key={item.id}>
                    <strong>{item.type} · {item.status}</strong>
                    <span>{item.provider || '-'} · {new Date(item.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')}</span>
                  </div>
                ))}
                {data.observability.recentFailures.length === 0 && <p className="form-hint">{copy.noRecentFailures}</p>}
              </div>
            </AdminPanel>
            )}
          </section>
          )}

          {activeTab === 'generation' && (
          <section className="admin-work-grid two admin-ai-operations-grid">
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.queue} title={copy.failureBreakdown} />
              <div className="admin-list compact">
                {data.queue.byFailureCategory.slice(0, 8).map((item) => (
                  <div key={item.key || 'unknown'}>
                    <strong>{item.key || '-'}</strong>
                    <span>{formatNumber(item.count)}</span>
                  </div>
                ))}
                {data.queue.byFailureCategory.length === 0 && <p className="form-hint">-</p>}
              </div>
            </AdminPanel>
            <AdminPanel as="article">
              <AdminPanelHeader kicker={copy.queue} title={copy.providerFailureBreakdown} />
              <div className="admin-list compact">
                {data.queue.byProviderFailureCategory.slice(0, 8).map((item) => (
                  <div key={item.key || 'unknown'}>
                    <strong>{item.key || '-'}</strong>
                    <span>{formatNumber(item.count)}</span>
                  </div>
                ))}
                {data.queue.byProviderFailureCategory.length === 0 && <p className="form-hint">-</p>}
              </div>
            </AdminPanel>
          </section>
          )}

          {activeTab === 'generation' && (
          <AdminPanel>
            <AdminPanelHeader kicker={copy.queue} title={copy.recentJobs} />
            <AdminTableScroll>
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Subject</th>
                    <th>Topic</th>
                    <th>Blueprint</th>
                    <th>Failure</th>
                    <th>Updated</th>
                    <th>{copy.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.queue.recent.map((job) => (
                    <tr key={job.id}>
                      <td>#{job.id}</td>
                      <td>{job.status}</td>
                      <td>{job.subject}</td>
                      <td>
                        {job.topicTitle || `#${job.topicId}`}
                        <p>#{job.topicId}</p>
                      </td>
                      <td>{job.blueprintId}</td>
                      <td>
                        {job.governance.failureCategory || '-'}
                        <p>{job.governance.providerFailureCategory || '-'}</p>
                        <p>{job.error || '-'}</p>
                        <p>{job.governance.attemptCount}/{job.governance.maxAttempts} attempts{job.governance.lastFailedAt ? ` · ${new Date(job.governance.lastFailedAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')}` : ''}</p>
                      </td>
                      <td>{new Date(job.updatedAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')}</td>
                      <td>
                        <button
                          type="button"
                          className={isActionBusy(`retry-job-${job.id}`) ? 'ghost-button admin-action-loading' : 'ghost-button'}
                          onClick={() => void runOperation(`retry-job-${job.id}`, `${copy.retryJob} #${job.id}`, () => retryAdminAIQuestioningGenerationJob(job.id))}
                          disabled={generationActionsBusy || job.status === 'running'}
                        >
                          {copy.retryJob}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.queue.recent.length === 0 && (
                    <tr>
                      <td colSpan={8}>{copy.noRecentFailures}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </AdminTableScroll>
          </AdminPanel>
          )}
        </>
      )}
    </AdminPageShell>
  );
}
