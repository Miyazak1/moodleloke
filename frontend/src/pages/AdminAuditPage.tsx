import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AdminPageShell } from '../components/AdminPageShell';
import { MathContent } from '../components/MathContent';
import { MetricCard } from '../components/UiPrimitives';
import { AdminAuditWorkspaceLinks } from '../components/admin/AdminAuditWorkspaceLinks';
import { useI18n } from '../i18n/useI18n';
import { adminText, selectAdminCopy, usesLatinAdminCopy } from '../lib/admin-locale';
import {
  createAdminAdaptiveAIReviewDecision,
  getAdminAdaptiveAIObservability,
  getAdminAdaptiveAIOrganizations,
  getAdminAdaptiveAIProviderConfig,
  getAdminAdaptiveAIReviewQueue,
  getAdminAIQuestioningOperationalReadiness,
  getAdminAdaptiveTrainingEventObservability,
  getAdminAuditEvents,
  getAdminAuditItems,
  getAdminPracticeSummary,
  recordAdminAIQuestioningOperationalReadinessEvent
} from '../lib/api-admin';
import {
  ADMIN_AUDIT_FILTER_TEMPLATES,
  ADMIN_AUDIT_RESOURCE_TYPES,
  applyAdminAuditFilterTemplate,
  buildAdminAuditEventParams,
  buildAdminAuditFilterSearch,
  DEFAULT_ADMIN_AUDIT_FILTERS,
  parseAdminAuditFiltersFromSearch
} from '../lib/admin-audit-filters';
import {
  adminAuditEventsCsv,
  adminAuditEventsFilename
} from '../lib/admin-audit-exports';
import {
  aiQuestioningReadinessActionTarget,
  aiQuestioningReadinessCsv,
  aiQuestioningReadinessFilename,
  aiQuestioningReadinessJson
} from '../lib/ai-questioning-readiness-exports';
import { summarizeAdminAuditEvent } from '../lib/admin-audit-summaries';
import { ApiError } from '../lib/request';
import type {
  AdminAIObservability,
  AdminAIOrganization,
  AdminAIProviderConfig,
  AdminAIQuestioningOperationalReadiness,
  AdminAIReviewQueue,
  AdminAuditEvent,
  AdminAuditSummary,
  AdminTrainingEventObservability,
  AuditItem,
  User
} from '../lib/api-types';

const AI_QUESTIONING_READINESS_USE_CASE = 'subject_practice' as const;

function formatAdminDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function formatAuditPayload(value: Record<string, unknown> | undefined) {
  if (!value || Object.keys(value).length === 0) return '-';
  return JSON.stringify(value, null, 2);
}

const ADMIN_AUDIT_COPY = {
  zh: {
    kicker: '后台审核',
    adminTitle: '用真实数据看后台状态和最近操作。',
    guestTitle: '后台审核',
    adminBody: '这里作为后台总览，重点看 CSCA 训练、AI 题库、内容发布、机构额度和最近后台改动。旧院校/奖学金数据只作为待迁移记录，不再是主工作流。',
    guestBody: '请先登录管理员账号后继续。',
    loadFailed: '后台统计暂时无法加载。',
    kpiLabel: '后台关键统计',
    sectionNavLabel: '后台工作区导航',
    sectionObservability: '训练观察',
    sectionOrganizations: '机构 AI',
    sectionQuestioning: 'AI 题库',
    sectionReadiness: '准备度',
    sectionTrends: '趋势',
    sectionReviews: '复核',
    aiOperationsCta: '进入 AI 运维',
    aiQuestionBankCta: '进入 AI 题库工作台',
    aiQuestionBankEntryTitle: 'AI 题库工作台',
    aiQuestionBankEntryBody: 'AI 出题、蓝图、候选审核、真题画像和题库台账已经迁移到独立工作台；总览页只保留入口，避免重复加载治理接口。',
    aiQuestionBankEntryHint: '从这里进入后再处理蓝图、候选题、真题画像和已发布题库。',
    partialLoadFailed: '部分管理模块暂时无法加载：{modules}。可先处理已加载内容，或稍后刷新。',
    partialLoadForbidden: '部分管理模块没有读取权限或登录态未刷新：{modules}。请确认当前账号已验证且具备管理员权限；重新登录后通常会恢复。',
    organizationsCta: '进入机构团队',
    legacyData: '旧数据待迁移',
    legacyDataBody: '{count} 条院校相关记录仍在后端保留，后续应迁移或归档。',
    contentChanges: '内容变更',
    noContentUpdates: '暂无内容更新',
    auditEvents: '审计事件',
    noAdminActions: '暂无后台操作',
    practice: '模考与专项',
    practiceBody: '{mockAttempts} 次模考 · {specialSessions} 次专项',
    adaptiveTitle: '自适应训练观察',
    adaptiveKicker: '最近 14 天',
    adaptiveRange: '观察范围',
    adaptiveRefresh: '刷新',
    adaptiveReset: '重置筛选',
    readinessCalibrationRefresh: '刷新建议效果',
    readinessCalibrationRefreshing: '正在刷新建议效果',
    readinessCalibrationRefreshed: '建议效果已刷新：{actions} 类建议 · {clicked} 次点击 · {lifted} 次有效改进。',
    subjectFilter: '学科',
    providerFilter: 'Provider',
    statusFilter: '状态',
    typeFilter: '类型',
    reviewReasonFilter: '复核原因',
    allSubjects: '全部学科',
    allProviders: '全部 provider',
    allStatuses: '全部状态',
    allTypes: '全部类型',
    allReviewReasons: '全部原因',
    reviewLowFeedback: '低评分',
    reviewProviderRejected: '安全拒绝',
    reviewProviderError: 'Provider 错误',
    reviewQuotaExhausted: '额度耗尽',
    reviewFallbackFailure: '规则降级异常',
    days7: '7 天',
    days14: '14 天',
    days30: '30 天',
    days90: '90 天',
    diagnosticCompletion: '诊断完成率',
    practiceCompletion: '训练完成率',
    aiCalls: 'AI Coach 调用',
    aiCallsBody: '{feedbackCount} 条反馈 · {tokenCount} 估算 token',
    aiQuality: 'AI 质量',
    aiQualityBody: 'fallback {fallbackRate} · 拒绝 {rejectionRate} · 错误 {errorRate}',
    aiRolloutHealth: 'LLM 放量健康',
    aiRolloutHealthBody: '{sampleSize} 次调用 · 反馈 {feedbackSampleSize} · 低评分 {lowFeedbackRate}',
    readinessActions: '准备度建议',
    readinessActionsBody: '{clicked} 次点击 · {followed} 次按建议完成 · 平均帮助 {gain}',
    readinessActionBreakdown: '准备度建议类型',
    readinessCalibrationHealth: '建议效果健康',
    readinessCalibrationHealthBody: '{snapshots} 份记录 · 最近 {latest} · 待处理 {alerts}',
    readinessCalibrationAlerts: '建议效果提醒',
    readinessNoAlerts: '暂无阻断提醒。',
    readinessEvidence: '准备度判断依据',
    readinessEvidenceBody: '{sample} 份记录 · 依据不足 {lowRate} · 影响用户 {lowCount}',
    readinessEvidenceBreakdown: '判断依据缺口',
    readinessDifficultyThresholds: '中高难练习门槛',
    readinessDifficultyThresholdsBody: '当前模式 {mode} · 最小样本 {sample}',
    readinessDifficultyThresholdMeta: '建议门槛 {recommended} · 当前门槛 {required} · 样本 {sample} · 影响 {impact}',
    readinessSampledThresholdRollout: '准备度门槛发布检查',
    readinessSampledThresholdRolloutBody: '{ready}/{total} 科可发布 · 影响 {impact}/{limit} · 待处理 {alerts}',
    readinessSampledThresholdChecklist: '准备度门槛发布清单',
    plannerAssistant: 'Planner Assistant',
    plannerAssistantBody: '采纳 {accepted}/{total} · Guard 调整 {adjusted} · 采纳率 {rate}',
    readinessSampledThresholdStatus: {
      ready: '可以发布',
      watching: '待开启采样模式',
      blocked: '暂不发布'
    },
    readinessSampledThresholdChecklistLabels: {
      sample_size: '三科样本量达标',
      calibration_health: '建议效果无阻断',
      impact_limit: '影响人数在上限内',
      sampled_mode: '采样模式已开启'
    },
    readinessSampledThresholdChecklistStatus: {
      passed: '通过',
      pending: '待处理',
      blocked: '阻断'
    },
    readinessDifficultyThresholdSource: {
      default: '默认',
      env_override: '环境覆盖',
      sampled_distribution: '分布采样'
    },
    readinessCalibrationHealthStatus: {
      healthy: '健康',
      watching: '观察中',
      needs_attention: '需要处理',
      blocked: '阻断'
    },
    readinessCalibrationAlertLabels: {
      calibration_snapshot_missing: '缺少校准快照',
      calibration_snapshot_stale: '校准快照已过期',
      calibration_snapshot_empty: '校准快照为空',
      action_type_needs_calibration: '部分建议类型效果不稳',
      sampled_distribution_insufficient: '真实样本还不够'
    },
    readinessEvidenceStatus: {
      no_data: '暂无数据',
      watching: '观察中',
      healthy: '依据充足',
      needs_attention: '需要关注'
    },
    readinessDimensionLabels: {
      coverage: '知识覆盖',
      mastery: '知识掌握',
      mock: '模考表现',
      review: '错因复盘',
      rhythm: '学习节奏',
      evidence: '判断依据'
    },
    readinessActionStatus: {
      no_data: '暂无数据',
      watching: '观察中',
      positive: '建议有效',
      needs_calibration: '需要观察'
    },
    aiHealthInsufficient: '样本不足',
    aiHealthHealthy: '可以继续',
    aiHealthWatch: '观察',
    aiHealthPause: '暂停放量',
    trainingEvents: '训练事件',
    aiStatus: 'AI 状态',
    aiProviderConfig: 'AI Provider 灰度配置',
    aiProviderReady: '外部 LLM 已就绪',
    aiProviderFallback: '当前使用规则降级',
    aiProviderMeta: '{provider} · {model} · prompt {requestedPromptVersion} -> {activePromptVersion} · rollout {rolloutPercent}%',
    aiProviderCost: '成本估算',
    aiProviderCostReady: '{currency} · 输入 {inputCost}/1K · 输出 {outputCost}/1K · {unitBudget} token/额度',
    aiProviderCostMissing: '未配置单价，仍会记录 token 和额度估算。',
    aiProviderBlockers: '未就绪原因',
    aiProviderNoBlockers: '配置完整，可以进入真实 LLM 灰度验收。',
    aiTrend: 'AI 调用趋势',
    eventTrend: '训练事件趋势',
    aiByProvider: 'Provider 分布',
    aiByType: 'AI 类型分布',
    aiFeedbackReasons: 'AI 反馈原因',
    aiQuestioningTitle: 'AI 题库生产治理',
    aiQuestioningBody: '蓝图生成候选题，候选题通过审核后才会进入训练题池。',
    aiQuestioningOperationalReadiness: '题库运转状态',
    aiQuestioningOperationalReadinessBody: '状态 {status} · 下一步 {action} · 阻断 {blockers} · 提醒 {warnings}',
    aiQuestioningOperationalReadinessScore: '就绪分',
    aiQuestioningOperationalReadinessLatestAudit: '最近留痕：{action} · {actor} · {time}',
    aiQuestioningOperationalReadinessNoAudit: '最近留痕：暂无记录',
    aiQuestioningOperationalReadinessGoToAction: '查看下一步',
    aiQuestioningOperationalReadinessAuditTrail: '查看留痕',
    aiQuestioningOperationalReadinessDownloadCsv: '下载 CSV',
    aiQuestioningOperationalReadinessDownloadJson: '下载 JSON',
    aiQuestioningOperationalReadinessStatus: {
      ready: '可以运转',
      needs_attention: '需要处理',
      blocked: '暂不适合放量'
    },
    aiQuestioningOperationalReadinessActions: {
      view_next_action: '查看下一步',
      download_csv: '下载 CSV 报告',
      download_json: '下载 JSON 报告',
      monitor: '继续观察',
      retry_or_clear_generation_queue: '先处理生成队列阻断',
      refresh_syllabus_governance: '先刷新考纲复核',
      assign_or_resolve_quality_reviews: '先分配或处理质量复核',
      ensure_blueprint_coverage: '补齐缺失蓝图',
      run_pregeneration: '补生成候选题',
      review_candidate_questions: '审核待发布候选题',
      review_quality_governance: '处理质量治理队列',
      review_syllabus_pending_questions: '复核考纲待审题',
      retry_failed: '重试失败生成任务',
      inspect_generation_queue: '检查生成队列'
    },
    aiQuestioningOperationalReadinessIssues: {
      generation_queue_blocked: '生成队列有阻断任务',
      syllabus_outdated_questions: '存在考纲不一致题目',
      quality_sla_overdue: '质量复核已超时',
      missing_blueprints: '有知识点缺少出题蓝图',
      topics_without_candidates: '有知识点缺少候选题',
      candidates_waiting_review: '有候选题等待审核发布',
      quality_review_backlog: '质量治理队列待处理',
      syllabus_pending_review: '考纲待复核题还未处理',
      generation_queue_attention: '生成队列有失败任务'
    },
    aiQuestioningBlueprints: '出题蓝图',
    aiQuestioningBlueprintCoverage: '蓝图覆盖',
    aiQuestioningBlueprintCoverageBody: '已覆盖 {covered}/{total} 个已发布知识点 · 缺口 {missing} · 暂停 {paused}',
    aiQuestioningBlueprintGovernance: '蓝图考纲治理',
    aiQuestioningBlueprintGovernanceBody: '{status} · 版本 {version} · 知识点 {topicStatus} · 排除范围 {excluded}',
    aiQuestioningBlueprintGovernanceSynced: '已同步当前考纲',
    aiQuestioningBlueprintGovernanceNeedsReview: '需要复核蓝图',
    aiQuestioningBlueprintGovernanceUnknown: '未记录同步状态',
    aiQuestioningBlueprintBlockedByTopic: '知识点未发布，不能生成',
    aiQuestioningConfirmBlueprintSyllabus: '确认考纲',
    aiQuestioningEditBlueprint: '编辑蓝图',
    aiQuestioningSaveBlueprint: '保存蓝图',
    aiQuestioningBlueprintInstruction: '出题要求',
    aiQuestioningBlueprintSkill: '目标技能',
    aiQuestioningBlueprintTargetSkills: '技能标签',
    aiQuestioningBlueprintExcludedScope: '排除范围',
    aiQuestioningBlueprintNote: '复核备注',
    aiQuestioningBlueprintEditBoundary: '保存后会更新生成约束并留下审计记录；已生成候选题不会自动发布或回滚。',
    aiQuestioningEnsureBlueprintCoverage: '补齐蓝图缺口',
    aiQuestioningMissingBlueprints: '缺蓝图：{topics}',
    aiQuestioningTopicHealth: '知识点题库健康',
    aiQuestioningTopicHealthBody: '缺蓝图 {missing} · 缺候选 {candidates} · 待发布 {publish} · 质量复核 {quality}',
    aiQuestioningNoTopicHealth: '暂无知识点题库健康数据',
    aiQuestioningRunTopicAction: '处理',
    aiQuestioningTopicActionEnsureBlueprint: '补蓝图',
    aiQuestioningTopicActionGenerateCandidates: '生成候选',
    aiQuestioningTopicActionReviewCandidates: '审核候选',
    aiQuestioningTopicActionReviewQuality: '看质量',
    aiQuestioningTopicActionQueuedInline: '已为这个知识点入队 {enqueued} 个生成任务。任务状态会显示在这里；生成完成后，到候选审核队列审核，通过后才会进入练习。',
    aiQuestioningTopicActionCandidatesInline: '已为这个知识点生成 {count} 道候选题。下一步：去候选审核队列审核，通过后才会进入练习。',
    aiQuestioningTopicActionReviewedInline: '已处理这个知识点的候选审核动作：请求 {requested} · 成功 {succeeded} · 失败 {failed}。',
    aiQuestioningTopicActionQualityInline: '已处理这个知识点的质量复核动作：请求 {requested} · 成功 {succeeded} · 失败 {failed}。',
    aiQuestioningTopicInlineJobsTitle: '本知识点生成状态',
    aiQuestioningTopicInlineJobsEmpty: '这个知识点暂时没有可显示的生成任务。',
    aiQuestioningTopicInlineJobMeta: '任务 #{id} · 蓝图 B#{blueprintId} · {status} · 尝试 {attempts}/{maxAttempts} · 候选 Q#{questionId}',
    aiQuestioningTopicInlineJobProvider: '生成来源：{provider} · {model}',
    aiQuestioningTopicInlineProviderFallback: '注意：这次没有调用远程 AI，使用的是本地规则兜底。请配置题目生成 Provider、Model、API Key 并开启生成后再生成。',
    aiQuestioningTopicInlineProviderCache: '注意：这次命中缓存，没有重新调用 AI。需要重新生成时请用强制重试。',
    aiQuestioningTopicInlineNextQueued: '状态：等待生成。任务已排队，但还没有开始调用 AI；处理队列后，这里会更新为正在生成或出现候选题编号。',
    aiQuestioningTopicInlineNextRunning: '状态：正在生成。AI 正在按蓝图生成候选题，完成后这里会出现候选题编号。',
    aiQuestioningTopicInlineNextCandidates: '下一步：去候选审核，确认题目质量后发布到练习。',
    aiQuestioningTopicInlineNextFailed: '这个任务失败了，可以先重试；如果连续失败，再看全局任务队列里的错误原因。',
    aiQuestioningTopicInlineGoQueue: '去任务队列',
    aiQuestioningTopicInlineGoCandidates: '去候选审核',
    aiQuestioningTopicDetail: '详情',
    aiQuestioningTopicDetailTitle: '知识点详情',
    aiQuestioningTopicDetailBody: '蓝图 {blueprints} · 候选题 {questions} · 质量记录 {quality} · 补救材料 {remediation}',
    aiQuestioningTopicStatus: {
      missing_blueprint: '缺蓝图',
      needs_candidates: '缺候选题',
      needs_publish: '待审核发布',
      needs_quality_review: '质量待复核',
      healthy: '健康'
    },
    aiQuestioningCandidates: '候选题队列',
    aiQuestioningGenerationJobs: '生成任务队列（排障/批量处理）',
    aiQuestioningGenerationJobsBody: '排队 {queued} · 运行 {running} · 成功 {succeeded} · 失败 {failed}',
    aiQuestioningGenerationJobsHelp: '这是后台排障视图；单个知识点的生成状态会直接显示在下方蓝图覆盖行里。排队中不等于正在生成，需要处理队列或后台 worker 执行后才会调用 AI。',
    aiQuestioningGenerationHealth: '生成队列健康',
    aiQuestioningGenerationHealthBody: '{status} · 卡住 {blocked} · 超时运行 {stale} · 建议 {action}',
    aiQuestioningBulkGenerationRetry: '批量重试',
    aiQuestioningBulkGenerationArchive: '归档失败任务',
    aiQuestioningRunPregeneration: '自动补仓',
    aiQuestioningPregenerationSaved: '补仓完成：选中 {topics} 个知识点 · 新建蓝图 {blueprints} · 入队 {enqueued} · 生成候选题 {candidates} · 失败 {failed}。',
    aiQuestioningGenerationCandidateFollowUp: ' · 下一步：已切到待审核候选队列。',
    aiQuestioningGenerationCandidatesReady: '已生成 {count} 道候选题，已切到待审核候选队列。',
    aiQuestioningGenerationJobsQueued: '已入队 {enqueued} 个生成任务，下一步处理生成队列。',
    aiQuestioningGenerationJobsProcessed: '生成队列已处理：请求 {requested} · 成功 {succeeded} · 失败 {failed} · 产出候选 {candidates}。',
    aiQuestioningTopicBlueprintReady: '知识点蓝图已处理：新建 {created} · 跳过 {skipped}。下一步按健康状态生成候选题。',
    aiQuestioningEnqueueJobs: '蓝图入队',
    aiQuestioningProcessJobs: '处理队列',
    aiQuestioningRetryJob: '重试任务',
    aiQuestioningNoGenerationJobs: '暂无生成任务',
    aiQuestioningQuality: '题目质量回流',
    aiQuestioningQualityGovernance: '质量治理分组',
    aiQuestioningQualityGovernanceBody: '高风险 {high} · 待复核 {review} · 变式题 {variants}',
    aiQuestioningQualitySlaBody: '超时 {overdue} · 即将超时 {soon} · 样本 {samples}',
    aiQuestioningQualityOwnership: '复核工作量归属',
    aiQuestioningQualityOwnershipBody: '待复核 {review} · 高风险 {high} · 超时 {overdue} · 即将超时 {soon}',
    aiQuestioningQualityTrend: '质量趋势',
    aiQuestioningQualityTrendBody: '近 {days} 天 · {attempts} 次 AI 题作答 · 待复核 {review} · 高风险 {high}',
    aiQuestioningQualityCalibration: '质量校准摘要',
    aiQuestioningQualityCalibrationBody: '当前列表 {total} 题 · 难度漂移 {drift} · 干扰项异常 {distractors} · 建议重生成 {regenerate} · 低置信 {lowConfidence}',
    aiQuestioningQualityFilterHigh: '看高风险',
    aiQuestioningQualityFilterRegenerate: '看需重生成',
    aiQuestioningQualityFilterDrift: '看难度漂移样本',
    aiQuestioningQualityExportCsv: '导出质量 CSV',
    aiQuestioningQualityExportJson: '导出质量 JSON',
    aiQuestioningQualityActiveFilters: '当前质量筛选',
    aiQuestioningQualityClearFilters: '清空筛选',
    aiQuestioningQualityActionGroups: '处理分组',
    aiQuestioningQualityActionGroupsBody: '按系统建议先分流，再决定批量处理或质量复核。',
    aiQuestioningQualityActionDirect: '可直接处理',
    aiQuestioningQualityActionManual: '质量修题',
    aiQuestioningQualityActionRegenerate: '重生成候选',
    aiQuestioningQualityActionArchive: '归档清理',
    aiQuestioningQualityActionMonitor: '继续观察',
    aiQuestioningQualityActionDirectBody: '可批量降低曝光或标记处理。',
    aiQuestioningQualityActionManualBody: '进入待复核，需要质量修题后再处理。',
    aiQuestioningQualityActionRegenerateBody: '生成替代候选，审核发布前不替换正式题。',
    aiQuestioningQualityActionArchiveBody: '适合低质且不再保留的题。',
    aiQuestioningQualityActionMonitorBody: '暂不处理，继续积累作答证据。',
    aiQuestioningQualityManualFollowUp: '后续：质量修题队列 · 原题已转待复核，修完后再标记已处理。',
    aiQuestioningQualityRegenerateFollowUp: '后续：替代候选题 #{candidate} · 发布状态 {published} · 审核发布前不会替换正式题。',
    aiQuestioningQualityRegenerateStaleFollowUp: '后续：替代候选题 #{candidate} 已失效（{status}），需要重新生成；它不会替换正式题。',
    aiQuestioningQualityReplacementUnpublished: '未发布',
    aiQuestioningQualityReplacementSummary: '替代候选跟进',
    aiQuestioningQualityReplacementSummaryBody: '需要候选 {needed} · 可审核发布 {drafted} · 候选已失效 {stale} · 已发布替换 {published}',
    aiQuestioningQualityReplacementDrafts: '看已生成未发布',
    aiQuestioningQualityReplacementStale: '看需重生成',
    aiQuestioningQualityReplacementPublished: '看已发布替换',
    aiQuestioningReplacementCandidate: '替代候选 · 替换低质题 #{source}',
    aiQuestioningReplacementCandidateBody: '来源：质量治理重生成；必须审核通过后才会替换正式题。',
    aiQuestioningCandidateQueue: '候选审核队列',
    aiQuestioningCandidateQueueBody: '候选题是由出题蓝图生成出来的待审核题目。先看题目质量，确认通过后才会发布到练习；蓝图只是上游约束和重新生成入口。',
    aiQuestioningCandidateBlueprintLink: '来自蓝图 B#{blueprintId} · 题目候选 Q#{questionId}',
    aiQuestioningQuestionLedger: 'AI生成题库',
    aiQuestioningQuestionLedgerBody: '这里追踪所有 AI 生成题：是否已发布到练习、是否被学生做过、使用了多少次。候选审核只负责发布前质量。',
    aiQuestioningQuestionLedgerEmpty: '还没有 AI 生成题。',
    aiQuestioningLedgerPracticeReady: '已进练习',
    aiQuestioningLedgerNotReady: '未进练习',
    aiQuestioningLedgerUsed: '已被使用',
    aiQuestioningLedgerUnused: '未使用',
    aiQuestioningLedgerPracticeQuestion: '练习题 #{id}',
    aiQuestioningLedgerNoPracticeQuestion: '未发布到练习',
    aiQuestioningLedgerUsageSummary: '曝光 {exposure} · 作答 {attempt} · 正确率 {accuracy}',
    aiQuestioningLedgerLastUsed: '最近使用 {date}',
    aiQuestioningLedgerNeverUsed: '还没有练习记录',
    aiQuestioningBlueprintSourcePanel: '出题蓝图 / 高级配置',
    aiQuestioningBlueprintSourcePanelBody: '蓝图决定这个知识点怎么出题，比如题型、难度、技能标签和排除范围。一般先审核候选题；只有题目方向不对时，再打开这里调整蓝图并重新生成。',
    aiQuestioningCandidateFilterAll: '全部候选',
    aiQuestioningCandidateFilterReplacement: '替代候选',
    aiQuestioningCandidateFilterPending: '待审核',
    aiQuestioningCandidateFilterFailed: '复审失败',
    aiQuestioningCandidateFilterManualFix: '质量修题',
    aiQuestioningCandidateFilterApproved: '已发布候选',
    aiQuestioningCandidateFilterDraft: '草稿',
    aiQuestioningCandidateRecommendationAll: '全部建议',
    aiQuestioningCandidateRecommendationManualFix: '需修题',
    aiQuestioningCandidateRecommendationBlueprint: '需改蓝图',
    aiQuestioningCandidateRecommendationSyllabus: '先处理考纲',
    aiQuestioningCandidateRecommendationRegenerate: '建议重生成',
    aiQuestioningCandidateRecommendationReview: '质量关注',
    aiQuestioningCandidateRecommendationPublish: '可发布',
    aiQuestioningCandidateRecommendationMonitor: '看质量',
    aiQuestioningCandidateActiveFilters: '当前候选筛选',
    aiQuestioningCandidateClearFilters: '清空候选筛选',
    aiQuestioningCandidateEmptyByFilters: '当前筛选下没有候选题。清空筛选后可以查看全部候选。',
    aiQuestioningCandidateShowing: '当前显示 {shown}/{total}',
    aiQuestioningCandidateSelected: '已选 {selected}/{visible}',
    aiQuestioningCandidateSelectVisible: '选择当前候选',
    aiQuestioningCandidateClearSelection: '清空选择',
    aiQuestioningCandidateBulkReview: '批量复审',
    aiQuestioningCandidateBulkApprove: '批量通过',
    aiQuestioningCandidateBulkReject: '批量拒绝',
    aiQuestioningCandidateBulkArchive: '批量归档',
    aiQuestioningCandidateExportCsv: '导出候选 CSV',
    aiQuestioningCandidateExportJson: '导出候选 JSON',
    aiQuestioningNoQualityTrend: '暂无 AI 题质量趋势数据',
    aiQuestioningWorkflowReady: '暂无紧急治理项',
    aiQuestioningWorkflowCount: '{count} 项需要处理',
    aiQuestioningNoQualityGovernance: '暂无质量治理分组',
    aiQuestioningBulkQualityReview: '批量送审',
    aiQuestioningBulkQualityApply: '按建议处理',
    aiQuestioningSyllabus: '考纲版本治理',
    aiQuestioningSyllabusBody: '当前 {current}/{total} · 过期 {stale} · 知识点未发布 {unpublished} · 待复核 {pending}',
    aiQuestioningSyllabusTopicUpdate: '考纲变更预览',
    aiQuestioningSyllabusTopicId: '知识点 ID',
    aiQuestioningSyllabusTopicIds: '批量知识点 ID',
    aiQuestioningSyllabusTopicIdsHint: '用逗号或换行分隔；填了批量 ID 时会走批量预览/应用。',
    aiQuestioningSyllabusVersion: '新考纲版本',
    aiQuestioningSyllabusSourceUrl: '来源链接',
    aiQuestioningSyllabusSourceLabel: '来源名称',
    aiQuestioningSyllabusVerifiedAt: '核验日期',
    aiQuestioningSyllabusStatus: '知识点状态',
    aiQuestioningPreviewSyllabus: '预览影响',
    aiQuestioningApplySyllabus: '应用变更',
    aiQuestioningSyllabusImpact: '将影响 {stale} 道题 · 当前通过题 {approved} · 已待复核 {pending}',
    aiQuestioningSyllabusBulkImpact: '批量 {topics} 个知识点 · 将影响 {stale} 道题 · 当前通过题 {approved} · 已待复核 {pending}',
    aiQuestioningSyllabusJsonImport: '上传大纲 JSON',
    aiQuestioningSyllabusJsonImportBody: '粘贴 csca-syllabus-v1 JSON，先预览影响，再保存草稿并应用。',
    aiQuestioningSyllabusJsonInput: '大纲 JSON',
    aiQuestioningSyllabusPreviewJson: '预览 JSON',
    aiQuestioningSyllabusSaveImport: '保存草稿',
    aiQuestioningSyllabusApplyImport: '应用草稿',
    aiQuestioningSyllabusArchiveImport: '归档草稿',
    aiQuestioningSyllabusJsonImpact: '文件 {topics} 个知识点 · 新增 {created} · 更新 {updated} · 未覆盖 {missing} · 影响题目 {affected} · 通过题转复核 {approved}',
    aiQuestioningSyllabusRecentImports: '最近导入',
    aiQuestioningSyllabusNoImports: '暂无大纲导入记录',
    aiQuestioningSyllabusMissingTopicAction: '未覆盖知识点',
    aiQuestioningSyllabusMissingKeep: '保持不变',
    aiQuestioningSyllabusMissingDraft: '改为草稿',
    aiQuestioningSyllabusMissingArchive: '归档',
    aiQuestioningRemediation: '错因补救材料',
    aiQuestioningRemediationBody: '概念卡草稿 {cards} · 变式蓝图 {blueprints} · 待审核变式题 {pending}',
    aiQuestioningMisconceptions: '错因标签字典',
    aiQuestioningMisconceptionsBody: '活跃 {active} · 待复核 {needsReview} · 已停用 {archived}',
    aiQuestioningMisconceptionGovernance: '错因治理提醒',
    aiQuestioningMisconceptionGovernanceBody: '重复 {duplicates} · 缺概念卡 {cards} · 孤儿 {orphans}',
    aiQuestioningMisconceptionIssue: {
      possible_duplicate: '疑似重复',
      missing_concept_card: '缺概念卡',
      orphan_tag: '无引用'
    },
    aiQuestioningNoMisconceptionGovernance: '暂无需要处理的错因标签提醒',
    aiQuestioningEditMisconception: '编辑错因',
    aiQuestioningSaveMisconception: '保存错因',
    aiQuestioningCancelMisconception: '取消编辑',
    aiQuestioningArchiveMisconception: '停用错因',
    aiQuestioningRestoreMisconception: '恢复错因',
    aiQuestioningMergeMisconception: '合并错因',
    aiQuestioningMergeTarget: '合并到',
    aiQuestioningMergePlaceholder: '选择目标错因',
    aiQuestioningReviewMisconception: '标记复核',
    aiQuestioningCreateConceptFromMisconception: '创建概念卡',
    aiQuestioningCreateVariantFromMisconception: '补变式题',
    aiQuestioningMisconceptionLabel: '错因名称',
    aiQuestioningMisconceptionDescription: '错因说明',
    aiQuestioningNoMisconceptions: '暂无错因标签',
    aiQuestioningConceptEffect: '概念卡效果',
    aiQuestioningConceptEffectBody: '完成 {completed} 次 · 命中变式 {attempts} 题 · 正确率 {accuracy}',
    aiQuestioningConceptEffectRecent: '最近概念卡效果',
    aiQuestioningNoConceptEffect: '暂无概念卡后的变式题效果数据',
    aiQuestioningVariantEffect: '变式题效果',
    aiQuestioningVariantEffectBody: '已练 {attempts} 次 · 覆盖源题 {sources} 道 · 正确率 {accuracy} · 待复核 {weak}',
    aiQuestioningVariantEffectRecent: '最近变式题效果',
    aiQuestioningNoVariantEffect: '暂无变式题作答效果数据',
    aiQuestioningRefreshSyllabus: '刷新考纲复核',
    aiQuestioningRefreshQuality: '刷新质量指标',
    aiQuestioningGenerateBatch: '批量预生成',
    aiQuestioningGenerate: '生成候选题',
    aiQuestioningForceGenerate: '强制重试',
    aiQuestioningPauseBlueprint: '暂停蓝图',
    aiQuestioningResumeBlueprint: '恢复蓝图',
    aiQuestioningBulkReview: '批量复审',
    aiQuestioningBulkApprove: '批量通过',
    aiQuestioningBulkArchive: '批量归档',
    aiQuestioningReview: '复审',
    aiQuestioningReviewReady: '审题通过',
    aiQuestioningReviewNeedsHuman: '需质量复核',
    aiQuestioningReviewBlocked: '阻断发布',
    aiQuestioningReviewPending: '未审题',
    aiQuestioningReviewIssues: '问题 {errors} 个错误 · {warnings} 个提醒',
    aiQuestioningReviewDimensions: '风险维度：{dimensions}',
    aiQuestioningReviewCodes: '主要问题：{codes}',
    aiQuestioningReviewOptions: '干扰项 metadata：{count} 个 · 错因标签 {tags}',
    aiQuestioningEvidence: '审核证据',
    aiQuestioningEvidenceGeneration: '生成来源',
    aiQuestioningEvidenceSyllabusScope: '考纲范围',
    aiQuestioningEvidenceBlueprintConstraints: '蓝图约束',
    aiQuestioningEvidenceRequestHash: '请求指纹',
    aiQuestioningEvidenceOptions: '选项',
    aiQuestioningEvidenceAnswer: '正确答案',
    aiQuestioningEvidenceExplanation: '解析',
    aiQuestioningEvidenceIssues: '审题问题',
    aiQuestioningEvidenceDimensions: '审题维度',
    aiQuestioningEvidenceOptionMetadata: '选项错因 metadata',
    aiQuestioningNoEvidence: '暂无结构化证据',
    aiQuestioningEditQuestion: '修正候选题',
    aiQuestioningEditBoundary: '保存后会自动复审；复审通过后仍需单独点击“通过并发布”。',
    aiQuestioningEditPrompt: '题干',
    aiQuestioningEditOptionsJson: '选项 JSON',
    aiQuestioningEditAnswer: '正确答案',
    aiQuestioningEditExplanation: '解析',
    aiQuestioningEditTags: '知识标签',
    aiQuestioningEditOptionMetadataJson: '选项错因 JSON',
    aiQuestioningEditNote: '修正备注',
    aiQuestioningEditReset: '重置表单',
    aiQuestioningSaveAndReview: '保存并复审',
    aiQuestioningApprove: '通过并发布',
    aiQuestioningReject: '否决',
    aiQuestioningArchive: '归档',
    aiQuestioningResolveQuality: '标记已处理',
    aiQuestioningSendQualityReview: '送回复核',
    aiQuestioningAssignQualityReview: '认领复核',
    aiQuestioningQualityArchive: '归档低质题',
    aiQuestioningQualityManualFix: '质量修题',
    aiQuestioningQualityReduceExposure: '降低曝光',
    aiQuestioningQualityRegenerate: '重生成',
    aiQuestioningQualitySelectVisible: '选择当前质量项',
    aiQuestioningQualityClearSelection: '清空选择',
    aiQuestioningQualitySelected: '已选 {count} 项',
    aiQuestioningQualityBulkBoundary: '批量动作只处理当前列表中已选题目；重生成会创建替代候选题，仍需自动质量门通过后才能发布。',
    aiQuestioningQualityBulkResolve: '批量标记已处理',
    aiQuestioningQualityBulkSendReview: '批量送回复核',
    aiQuestioningQualityBulkReduceExposure: '批量降低曝光',
    aiQuestioningQualityBulkArchive: '批量归档低质题',
    aiQuestioningQualityBulkRegenerate: '批量重生成',
    aiQuestioningEditConcept: '编辑概念卡',
    aiQuestioningSaveConcept: '保存概念卡',
    aiQuestioningCancelConcept: '取消编辑',
    aiQuestioningConceptTitle: '概念卡标题',
    aiQuestioningConceptBody: '概念卡正文',
    aiQuestioningPublishConcept: '发布概念卡',
    aiQuestioningArchiveConcept: '归档概念卡',
    aiQuestioningNoRemediation: '暂无错因补救材料',
    aiQuestioningPublished: '已发布到训练题 #{id}',
    aiQuestioningCandidatePublished: '候选题已发布到训练题 #{id}，已进入训练题池。',
    aiQuestioningReplacementPublished: '替代候选已发布到训练题 #{id}，原低质题 #{source} 已归档，质量复核已解除。',
    aiQuestioningCandidateRejected: '候选题 #{id} 已否决，不会进入训练题池。',
    aiQuestioningCandidateArchived: '候选题 #{id} 已归档，不会进入训练题池。',
    aiQuestioningCandidateReviewed: '候选题 #{id} 已复审：{status}。',
    aiQuestioningNoBlueprints: '暂无出题蓝图',
    aiQuestioningNoQuestions: '暂无候选题',
    aiQuestioningNoQuality: '暂无题目质量数据',
    aiQuestioningActionSaved: '题库治理操作已完成。',
    aiQuestioningBulkQualitySaved: '批量处理完成：请求 {requested} · 成功 {succeeded} · 失败 {failed}。',
    aiQuestioningQualityResolvedFeedback: '质量项 #{id} 已标记处理，已退出待复核队列。',
    aiQuestioningQualitySentReviewFeedback: '质量项 #{id} 已送回复核；若原题已发布，会先转为待复核，避免继续稳定出题。',
    aiQuestioningQualityAssignedFeedback: '质量项 #{id} 已认领复核，负责人 #{assignee}。',
    aiQuestioningQualityArchivedFeedback: '低质题 #{id} 已归档，不再进入训练题池。',
    aiQuestioningQualityReducedExposureFeedback: '质量项 #{id} 已降低曝光，系统会减少抽到这道题的机会。',
    aiQuestioningQualityManualFixFeedback: '质量项 #{id} 已进入质量修题队列；修完并复审通过后，仍需单独发布。',
    aiQuestioningQualityRegeneratedFeedback: '质量项 #{id} 已生成替代候选 #{candidate}；下一步审核候选题，发布后才会替换原题。',
    aiQuestioningQualityGenericFeedback: '质量项 #{id} 已处理：{status}。',
    aiQuestioningBulkQualityImpact: ' · 已处理 {resolved} · 送审 {review} · 质量修题 {manualFix} · 替代候选 {regenerated} · 降低曝光 {reduced} · 归档 {archived}',
    aiQuestioningBulkQualityErrors: ' · 失败原因：{errors}',
    aiQuestioningBulkCandidateSaved: '候选批量处理完成：请求 {requested} · 成功 {succeeded} · 失败 {failed}{errors}',
    aiQuestioningBulkCandidateImpact: ' · 已发布 {published} 道，其中替代发布 {replacements} 道 · 已否决 {rejected} · 已归档 {archived}',
    aiQuestioningBulkCandidateErrors: ' · 失败原因：{errors}',
    aiQuestioningMergeSaved: '错因已合并：概念卡 {cards} · 题目 {questions} · 选项标签 {options}。',
    aiQuestioningConceptCreated: '概念卡草稿已{status}：{title}',
    aiQuestioningVariantCreated: '变式题候选已{status}：#{id}',
    eventBySubject: '学科事件分布',
    trendLatest: '最新',
    trendPeak: '峰值',
    trendTotal: '合计',
    recentTrainingEvents: '最近训练事件',
    recentFailures: '最近 AI 失败',
    reviewQueue: 'AI 复核队列',
    reviewQueueBody: '{count} 个样本 · 低评分 {low} · 拒绝 {rejected} · 错误 {errors}',
    reviewAction: '建议动作',
    reviewAccepted: '可接受',
    reviewPromptUpdate: '改 Prompt',
    reviewQuestionFix: '修题',
    reviewPauseTemplate: '暂停模板',
    reviewResolved: '已处理',
    reviewLatestDecision: '最新结论',
    reviewSaved: '复核结论已记录。',
    noReviewItems: '暂无需要复核的 AI 样本',
    noAdaptiveData: '暂无自适应训练观察数据',
    noFailures: '暂无 AI 失败记录',
    noEvents: '暂无训练事件',
    loadingTitle: '正在读取后台统计',
    loadingBody: '正在从后端读取重建进度。',
    errorTitle: '读取失败',
    todoKicker: '待处理事项',
    todoTitle: '后台运营检查点',
    itemCount: '{count} 项',
    recentKicker: '最近操作',
    recentTitle: '审计事件',
    eventCount: '{count} 条',
    unknownActor: '系统/未知用户',
    dateLocale: 'zh-CN'
  },
  en: {
    kicker: 'Admin Audit',
    adminTitle: 'Review backend status and recent operations with live data.',
    guestTitle: 'Admin Audit',
    adminBody: 'This overview highlights CSCA training, AI question operations, content publishing, organization credits, and recent admin changes. Legacy school and scholarship data is treated as migration backlog, not the main workflow.',
    guestBody: 'Log in with an admin account to continue.',
    loadFailed: 'Admin statistics could not be loaded right now.',
    kpiLabel: 'Admin key metrics',
    sectionNavLabel: 'Admin workspace navigation',
    sectionObservability: 'Observability',
    sectionOrganizations: 'Enterprise AI',
    sectionQuestioning: 'AI Questioning',
    sectionReadiness: 'Readiness',
    sectionTrends: 'Trends',
    sectionReviews: 'Reviews',
    aiOperationsCta: 'Open AI Operations',
    aiQuestionBankCta: 'Open Question Bank Workspace',
    aiQuestionBankEntryTitle: 'AI Question Bank Workspace',
    aiQuestionBankEntryBody: 'AI generation, blueprints, candidate review, past-paper profiles, and the question ledger now live in the dedicated workspace. This overview keeps only the entry point to avoid duplicate governance requests.',
    aiQuestionBankEntryHint: 'Open it to manage blueprints, candidates, past-paper profiles, and the published question ledger.',
    partialLoadFailed: 'Some admin modules could not be loaded: {modules}. You can continue with loaded sections or refresh later.',
    partialLoadForbidden: 'Some admin modules are not readable with the current session or role: {modules}. Confirm the account is verified and has admin access, then sign in again if needed.',
    organizationsCta: 'Open Organizations',
    legacyData: 'Legacy data backlog',
    legacyDataBody: '{count} school-related records are still retained in the backend and should be migrated or archived later.',
    contentChanges: 'Content changes',
    noContentUpdates: 'No content updates yet',
    auditEvents: 'Audit events',
    noAdminActions: 'No admin actions yet',
    practice: 'Mock & Targeted Practice',
    practiceBody: '{mockAttempts} mock attempts · {specialSessions} targeted sessions',
    adaptiveTitle: 'Adaptive Training Observability',
    adaptiveKicker: 'Last 14 days',
    adaptiveRange: 'Observation range',
    adaptiveRefresh: 'Refresh',
    adaptiveReset: 'Reset filters',
    readinessCalibrationRefresh: 'Refresh suggestion results',
    readinessCalibrationRefreshing: 'Refreshing suggestion results',
    readinessCalibrationRefreshed: 'Suggestion results refreshed: {actions} action types · {clicked} clicks · {lifted} helpful improvements.',
    subjectFilter: 'Subject',
    providerFilter: 'Provider',
    statusFilter: 'Status',
    typeFilter: 'Type',
    reviewReasonFilter: 'Review reason',
    allSubjects: 'All subjects',
    allProviders: 'All providers',
    allStatuses: 'All statuses',
    allTypes: 'All types',
    allReviewReasons: 'All reasons',
    reviewLowFeedback: 'Low feedback',
    reviewProviderRejected: 'Safety rejection',
    reviewProviderError: 'Provider error',
    reviewQuotaExhausted: 'Quota exhausted',
    reviewFallbackFailure: 'Fallback issue',
    days7: '7 days',
    days14: '14 days',
    days30: '30 days',
    days90: '90 days',
    diagnosticCompletion: 'Diagnostic completion',
    practiceCompletion: 'Practice completion',
    aiCalls: 'AI Coach calls',
    aiCallsBody: '{feedbackCount} feedback · {tokenCount} estimated tokens',
    aiQuality: 'AI quality',
    aiQualityBody: 'fallback {fallbackRate} · rejected {rejectionRate} · error {errorRate}',
    aiRolloutHealth: 'LLM rollout health',
    aiRolloutHealthBody: '{sampleSize} calls · {feedbackSampleSize} feedback · low {lowFeedbackRate}',
    readinessActions: 'Readiness suggestions',
    readinessActionsBody: '{clicked} clicks · {followed} completed as suggested · avg help {gain}',
    readinessActionBreakdown: 'Readiness suggestion types',
    readinessCalibrationHealth: 'Suggestion result health',
    readinessCalibrationHealthBody: '{snapshots} records · latest {latest} · actions needed {alerts}',
    readinessCalibrationAlerts: 'Suggestion result alerts',
    readinessNoAlerts: 'No blocking alerts.',
    readinessEvidence: 'Readiness judgment basis',
    readinessEvidenceBody: '{sample} records · weak basis {lowRate} · affected users {lowCount}',
    readinessEvidenceBreakdown: 'Judgment basis gaps',
    readinessDifficultyThresholds: 'Hard-practice gate',
    readinessDifficultyThresholdsBody: 'current mode {mode} · min sample {sample}',
    readinessDifficultyThresholdMeta: 'suggested gate {recommended} · current gate {required} · sample {sample} · impact {impact}',
    readinessSampledThresholdRollout: 'Readiness gate launch check',
    readinessSampledThresholdRolloutBody: '{ready}/{total} subjects launch-ready · impact {impact}/{limit} · actions needed {alerts}',
    readinessSampledThresholdChecklist: 'Readiness gate launch checklist',
    plannerAssistant: 'Planner Assistant',
    plannerAssistantBody: 'accepted {accepted}/{total} · guard adjusted {adjusted} · acceptance {rate}',
    readinessSampledThresholdStatus: {
      ready: 'Ready to launch',
      watching: 'Enable sampled mode',
      blocked: 'Do not launch'
    },
    readinessSampledThresholdChecklistLabels: {
      sample_size: 'All subjects have enough samples',
      calibration_health: 'Suggestion results have no blockers',
      impact_limit: 'Impact is within limit',
      sampled_mode: 'Sampled mode enabled'
    },
    readinessSampledThresholdChecklistStatus: {
      passed: 'Passed',
      pending: 'Pending',
      blocked: 'Blocked'
    },
    readinessDifficultyThresholdSource: {
      default: 'Default',
      env_override: 'Env override',
      sampled_distribution: 'Sampled'
    },
    readinessCalibrationHealthStatus: {
      healthy: 'Healthy',
      watching: 'Watching',
      needs_attention: 'Needs action',
      blocked: 'Blocked'
    },
    readinessCalibrationAlertLabels: {
      calibration_snapshot_missing: 'Missing calibration snapshots',
      calibration_snapshot_stale: 'Calibration snapshot is stale',
      calibration_snapshot_empty: 'Calibration snapshot is empty',
      action_type_needs_calibration: 'Some suggestion types are unstable',
      sampled_distribution_insufficient: 'Not enough real samples yet'
    },
    readinessEvidenceStatus: {
      no_data: 'No data',
      watching: 'Watching',
      healthy: 'Basis is strong',
      needs_attention: 'Needs attention'
    },
    readinessDimensionLabels: {
      coverage: 'Knowledge coverage',
      mastery: 'Knowledge mastery',
      mock: 'Mock performance',
      review: 'Mistake review',
      rhythm: 'Learning rhythm',
      evidence: 'Judgment basis'
    },
    readinessActionStatus: {
      no_data: 'No data',
      watching: 'Watching',
      positive: 'Working',
      needs_calibration: 'Needs watching'
    },
    aiHealthInsufficient: 'Insufficient',
    aiHealthHealthy: 'Continue',
    aiHealthWatch: 'Watch',
    aiHealthPause: 'Pause rollout',
    trainingEvents: 'Training events',
    aiStatus: 'AI status',
    aiProviderConfig: 'AI provider rollout config',
    aiProviderReady: 'External LLM ready',
    aiProviderFallback: 'Using rule fallback',
    aiProviderMeta: '{provider} · {model} · prompt {requestedPromptVersion} -> {activePromptVersion} · rollout {rolloutPercent}%',
    aiProviderCost: 'Cost estimate',
    aiProviderCostReady: '{currency} · input {inputCost}/1K · output {outputCost}/1K · {unitBudget} tokens/credit',
    aiProviderCostMissing: 'Pricing is not configured; token and credit estimates are still recorded.',
    aiProviderBlockers: 'Readiness blockers',
    aiProviderNoBlockers: 'Configuration is complete for external LLM rollout validation.',
    aiTrend: 'AI call trend',
    eventTrend: 'Training event trend',
    aiByProvider: 'Provider mix',
    aiByType: 'AI type mix',
    aiFeedbackReasons: 'AI feedback reasons',
    aiQuestioningTitle: 'AI Question Production',
    aiQuestioningBody: 'Blueprints generate candidates. Only approved candidates are published into the practice pool.',
    aiQuestioningOperationalReadiness: 'Bank readiness',
    aiQuestioningOperationalReadinessBody: 'status {status} · next {action} · blockers {blockers} · warnings {warnings}',
    aiQuestioningOperationalReadinessScore: 'readiness',
    aiQuestioningOperationalReadinessLatestAudit: 'latest audit: {action} · {actor} · {time}',
    aiQuestioningOperationalReadinessNoAudit: 'latest audit: no record yet',
    aiQuestioningOperationalReadinessGoToAction: 'Go to next step',
    aiQuestioningOperationalReadinessAuditTrail: 'View audit trail',
    aiQuestioningOperationalReadinessDownloadCsv: 'Download CSV',
    aiQuestioningOperationalReadinessDownloadJson: 'Download JSON',
    aiQuestioningOperationalReadinessStatus: {
      ready: 'Ready',
      needs_attention: 'Needs attention',
      blocked: 'Not ready to scale'
    },
    aiQuestioningOperationalReadinessActions: {
      view_next_action: 'View next step',
      download_csv: 'Download CSV report',
      download_json: 'Download JSON report',
      monitor: 'Monitor',
      retry_or_clear_generation_queue: 'Clear generation blockers first',
      refresh_syllabus_governance: 'Refresh syllabus review first',
      assign_or_resolve_quality_reviews: 'Assign or resolve quality reviews first',
      ensure_blueprint_coverage: 'Fill missing blueprints',
      run_pregeneration: 'Generate missing candidates',
      review_candidate_questions: 'Review candidate questions',
      review_quality_governance: 'Handle quality governance',
      review_syllabus_pending_questions: 'Review syllabus-pending questions',
      retry_failed: 'Retry failed generation jobs',
      inspect_generation_queue: 'Inspect generation queue'
    },
    aiQuestioningOperationalReadinessIssues: {
      generation_queue_blocked: 'Generation queue has blockers',
      syllabus_outdated_questions: 'Some questions are out of syllabus sync',
      quality_sla_overdue: 'Quality reviews are overdue',
      missing_blueprints: 'Some topics are missing blueprints',
      topics_without_candidates: 'Some topics have no candidates',
      candidates_waiting_review: 'Candidate questions are waiting for review',
      quality_review_backlog: 'Quality governance backlog needs work',
      syllabus_pending_review: 'Syllabus-pending questions need review',
      generation_queue_attention: 'Generation queue has failed jobs'
    },
    aiQuestioningBlueprints: 'Question blueprints',
    aiQuestioningBlueprintCoverage: 'Blueprint coverage',
    aiQuestioningBlueprintCoverageBody: '{covered}/{total} published topics covered · missing {missing} · paused {paused}',
    aiQuestioningBlueprintGovernance: 'Blueprint syllabus governance',
    aiQuestioningBlueprintGovernanceBody: '{status} · version {version} · topic {topicStatus} · exclusions {excluded}',
    aiQuestioningBlueprintGovernanceSynced: 'Synced to current syllabus',
    aiQuestioningBlueprintGovernanceNeedsReview: 'Blueprint needs review',
    aiQuestioningBlueprintGovernanceUnknown: 'No sync record',
    aiQuestioningBlueprintBlockedByTopic: 'Topic unpublished; generation blocked',
    aiQuestioningConfirmBlueprintSyllabus: 'Confirm syllabus',
    aiQuestioningEditBlueprint: 'Edit blueprint',
    aiQuestioningSaveBlueprint: 'Save blueprint',
    aiQuestioningBlueprintInstruction: 'Generation instruction',
    aiQuestioningBlueprintSkill: 'Target skill',
    aiQuestioningBlueprintTargetSkills: 'Skill tags',
    aiQuestioningBlueprintExcludedScope: 'Excluded scope',
    aiQuestioningBlueprintNote: 'Review note',
    aiQuestioningBlueprintEditBoundary: 'Saving updates generation constraints and writes an audit event; existing candidates are not auto-published or rolled back.',
    aiQuestioningEnsureBlueprintCoverage: 'Fill blueprint gaps',
    aiQuestioningMissingBlueprints: 'Missing: {topics}',
    aiQuestioningTopicHealth: 'Topic bank health',
    aiQuestioningTopicHealthBody: 'missing blueprints {missing} · no candidates {candidates} · unpublished {publish} · quality review {quality}',
    aiQuestioningNoTopicHealth: 'No topic bank health data yet',
    aiQuestioningRunTopicAction: 'Run action',
    aiQuestioningTopicActionEnsureBlueprint: 'Create blueprint',
    aiQuestioningTopicActionGenerateCandidates: 'Generate candidates',
    aiQuestioningTopicActionReviewCandidates: 'Review candidates',
    aiQuestioningTopicActionReviewQuality: 'Review quality',
    aiQuestioningTopicActionQueuedInline: '{enqueued} generation job(s) queued for this topic. The job status is shown here. When generation finishes, review candidates before practice use.',
    aiQuestioningTopicActionCandidatesInline: '{count} candidate(s) generated for this topic. Next: review them in the candidate queue before practice use.',
    aiQuestioningTopicActionReviewedInline: 'Candidate review action handled for this topic: requested {requested} · succeeded {succeeded} · failed {failed}.',
    aiQuestioningTopicActionQualityInline: 'Quality review action handled for this topic: requested {requested} · succeeded {succeeded} · failed {failed}.',
    aiQuestioningTopicInlineJobsTitle: 'Generation status for this topic',
    aiQuestioningTopicInlineJobsEmpty: 'No generation jobs are visible for this topic yet.',
    aiQuestioningTopicInlineJobMeta: 'Job #{id} · blueprint B#{blueprintId} · {status} · attempt {attempts}/{maxAttempts} · candidate Q#{questionId}',
    aiQuestioningTopicInlineJobProvider: 'Generation source: {provider} · {model}',
    aiQuestioningTopicInlineProviderFallback: 'Heads up: this did not call remote AI. It used the local rule fallback. Configure the generation Provider, Model, API Key, and enable generation before trying again.',
    aiQuestioningTopicInlineProviderCache: 'Heads up: this hit cache and did not call AI again. Use force retry when you need a fresh generation.',
    aiQuestioningTopicInlineNextQueued: 'Status: waiting to generate. The job is queued but has not started calling AI yet. After queue processing, this will change to running or show a candidate id.',
    aiQuestioningTopicInlineNextRunning: 'Status: generating. AI is creating a candidate from this blueprint; the candidate id will appear here when it finishes.',
    aiQuestioningTopicInlineNextCandidates: 'Next: review candidates, then publish approved questions to practice.',
    aiQuestioningTopicInlineNextFailed: 'This job failed. Retry it first; if it keeps failing, inspect the global queue error.',
    aiQuestioningTopicInlineGoQueue: 'Go to job queue',
    aiQuestioningTopicInlineGoCandidates: 'Go to candidate review',
    aiQuestioningTopicDetail: 'Detail',
    aiQuestioningTopicDetailTitle: 'Topic detail',
    aiQuestioningTopicDetailBody: 'blueprints {blueprints} · candidates {questions} · quality records {quality} · remediation {remediation}',
    aiQuestioningTopicStatus: {
      missing_blueprint: 'Missing blueprint',
      needs_candidates: 'Needs candidates',
      needs_publish: 'Needs publish',
      needs_quality_review: 'Quality review',
      healthy: 'Healthy'
    },
    aiQuestioningCandidates: 'Candidate queue',
    aiQuestioningGenerationJobs: 'Generation jobs (ops / bulk handling)',
    aiQuestioningGenerationJobsBody: 'queued {queued} · running {running} · succeeded {succeeded} · failed {failed}',
    aiQuestioningGenerationJobsHelp: 'This is an operational queue view. Per-topic generation status is shown directly in the blueprint coverage row below. Queued means waiting, not generating, until the queue is processed by an operator or worker.',
    aiQuestioningGenerationHealth: 'Generation queue health',
    aiQuestioningGenerationHealthBody: '{status} · blocked {blocked} · stale running {stale} · action {action}',
    aiQuestioningBulkGenerationRetry: 'Retry batch',
    aiQuestioningBulkGenerationArchive: 'Archive failed',
    aiQuestioningRunPregeneration: 'Auto backfill',
    aiQuestioningPregenerationSaved: 'Backfill complete: {topics} topics · {blueprints} blueprints · {enqueued} enqueued · {candidates} candidates · {failed} failed.',
    aiQuestioningGenerationCandidateFollowUp: ' · Next: opened the pending candidate queue.',
    aiQuestioningGenerationCandidatesReady: '{count} candidate(s) generated. Opened the pending candidate queue.',
    aiQuestioningGenerationJobsQueued: '{enqueued} generation job(s) enqueued. Next: process the generation queue.',
    aiQuestioningGenerationJobsProcessed: 'Generation queue processed: requested {requested} · succeeded {succeeded} · failed {failed} · candidates {candidates}.',
    aiQuestioningTopicBlueprintReady: 'Topic blueprint handled: created {created} · skipped {skipped}. Next: generate candidates based on topic health.',
    aiQuestioningEnqueueJobs: 'Enqueue blueprints',
    aiQuestioningProcessJobs: 'Process queue',
    aiQuestioningRetryJob: 'Retry job',
    aiQuestioningNoGenerationJobs: 'No generation jobs yet',
    aiQuestioningQuality: 'Question quality feedback',
    aiQuestioningQualityGovernance: 'Quality governance groups',
    aiQuestioningQualityGovernanceBody: 'high {high} · review {review} · variants {variants}',
    aiQuestioningQualitySlaBody: 'overdue {overdue} · due soon {soon} · samples {samples}',
    aiQuestioningQualityOwnership: 'Review ownership',
    aiQuestioningQualityOwnershipBody: 'review {review} · high {high} · overdue {overdue} · due soon {soon}',
    aiQuestioningQualityTrend: 'Quality trend',
    aiQuestioningQualityTrendBody: 'last {days} days · {attempts} AI-question attempts · review {review} · high risk {high}',
    aiQuestioningQualityCalibration: 'Quality calibration summary',
    aiQuestioningQualityCalibrationBody: 'current list {total} questions · difficulty drift {drift} · distractor issues {distractors} · regenerate {regenerate} · low confidence {lowConfidence}',
    aiQuestioningQualityFilterHigh: 'View high risk',
    aiQuestioningQualityFilterRegenerate: 'View regenerate',
    aiQuestioningQualityFilterDrift: 'View drift samples',
    aiQuestioningQualityExportCsv: 'Export quality CSV',
    aiQuestioningQualityExportJson: 'Export quality JSON',
    aiQuestioningQualityActiveFilters: 'Active quality filters',
    aiQuestioningQualityClearFilters: 'Clear filters',
    aiQuestioningQualityActionGroups: 'Action groups',
    aiQuestioningQualityActionGroupsBody: 'Triage by system recommendation before bulk handling or quality review.',
    aiQuestioningQualityActionDirect: 'Direct handling',
    aiQuestioningQualityActionManual: 'Manual fix',
    aiQuestioningQualityActionRegenerate: 'Regenerate candidates',
    aiQuestioningQualityActionArchive: 'Archive cleanup',
    aiQuestioningQualityActionMonitor: 'Keep monitoring',
    aiQuestioningQualityActionDirectBody: 'Can reduce exposure or mark resolved in bulk.',
    aiQuestioningQualityActionManualBody: 'Moves into review; fix the question before resolving.',
    aiQuestioningQualityActionRegenerateBody: 'Creates replacement candidates; publishing still needs review.',
    aiQuestioningQualityActionArchiveBody: 'For low-quality questions that should not remain active.',
    aiQuestioningQualityActionMonitorBody: 'Keep collecting attempt evidence before acting.',
    aiQuestioningQualityManualFollowUp: 'Next: manual-fix queue · original question is pending review; resolve after editing.',
    aiQuestioningQualityRegenerateFollowUp: 'Next: replacement candidate #{candidate} · publish status {published} · it will not replace the live question before approval.',
    aiQuestioningQualityRegenerateStaleFollowUp: 'Next: replacement candidate #{candidate} is stale ({status}); regenerate it before it can replace the live question.',
    aiQuestioningQualityReplacementUnpublished: 'unpublished',
    aiQuestioningQualityReplacementSummary: 'Replacement follow-up',
    aiQuestioningQualityReplacementSummaryBody: 'needs candidate {needed} · reviewable {drafted} · stale candidates {stale} · published replacements {published}',
    aiQuestioningQualityReplacementDrafts: 'View drafted unpublished',
    aiQuestioningQualityReplacementStale: 'View needs regenerate',
    aiQuestioningQualityReplacementPublished: 'View published replacements',
    aiQuestioningReplacementCandidate: 'Replacement candidate · replaces low-quality question #{source}',
    aiQuestioningReplacementCandidateBody: 'Source: quality-governance regeneration; it must pass review before replacing the live question.',
    aiQuestioningCandidateQueue: 'Candidate review queue',
    aiQuestioningCandidateQueueBody: 'Candidates are draft questions generated from blueprints. Review question quality first, then publish approved items to practice. Blueprints are upstream constraints and regeneration controls.',
    aiQuestioningCandidateBlueprintLink: 'From blueprint B#{blueprintId} · candidate Q#{questionId}',
    aiQuestioningQuestionLedger: 'AI-generated question bank',
    aiQuestioningQuestionLedgerBody: 'Tracks every AI-generated question: whether it reached practice, whether learners used it, and how often. Candidate review is only the pre-publish gate.',
    aiQuestioningQuestionLedgerEmpty: 'No AI-generated questions yet.',
    aiQuestioningLedgerPracticeReady: 'In practice',
    aiQuestioningLedgerNotReady: 'Not in practice',
    aiQuestioningLedgerUsed: 'Used',
    aiQuestioningLedgerUnused: 'Unused',
    aiQuestioningLedgerPracticeQuestion: 'Practice question #{id}',
    aiQuestioningLedgerNoPracticeQuestion: 'Not published to practice',
    aiQuestioningLedgerUsageSummary: 'Exposure {exposure} · attempts {attempt} · accuracy {accuracy}',
    aiQuestioningLedgerLastUsed: 'Last used {date}',
    aiQuestioningLedgerNeverUsed: 'No practice record yet',
    aiQuestioningBlueprintSourcePanel: 'Question blueprints / advanced settings',
    aiQuestioningBlueprintSourcePanelBody: 'Blueprints decide how this topic should generate questions: type, difficulty, skill tags, and excluded scope. Usually review candidates first; open this only when the question direction is wrong and the blueprint needs adjustment.',
    aiQuestioningCandidateFilterAll: 'All candidates',
    aiQuestioningCandidateFilterReplacement: 'Replacement candidates',
    aiQuestioningCandidateFilterPending: 'Pending review',
    aiQuestioningCandidateFilterFailed: 'Review failed',
    aiQuestioningCandidateFilterManualFix: 'Manual fixes',
    aiQuestioningCandidateFilterApproved: 'Published candidates',
    aiQuestioningCandidateFilterDraft: 'Drafts',
    aiQuestioningCandidateRecommendationAll: 'All recommendations',
    aiQuestioningCandidateRecommendationManualFix: 'Needs fix',
    aiQuestioningCandidateRecommendationBlueprint: 'Fix blueprint',
    aiQuestioningCandidateRecommendationSyllabus: 'Syllabus first',
    aiQuestioningCandidateRecommendationRegenerate: 'Regenerate',
    aiQuestioningCandidateRecommendationReview: 'Human review',
    aiQuestioningCandidateRecommendationPublish: 'Ready',
    aiQuestioningCandidateRecommendationMonitor: 'Monitor',
    aiQuestioningCandidateActiveFilters: 'Active candidate filters',
    aiQuestioningCandidateClearFilters: 'Clear candidate filters',
    aiQuestioningCandidateEmptyByFilters: 'No candidates match the current filters. Clear filters to review the full queue.',
    aiQuestioningCandidateShowing: 'Showing {shown}/{total}',
    aiQuestioningCandidateSelected: 'Selected {selected}/{visible}',
    aiQuestioningCandidateSelectVisible: 'Select visible',
    aiQuestioningCandidateClearSelection: 'Clear selection',
    aiQuestioningCandidateBulkReview: 'Review selected',
    aiQuestioningCandidateBulkApprove: 'Approve selected',
    aiQuestioningCandidateBulkReject: 'Reject selected',
    aiQuestioningCandidateBulkArchive: 'Archive selected',
    aiQuestioningCandidateExportCsv: 'Export candidates CSV',
    aiQuestioningCandidateExportJson: 'Export candidates JSON',
    aiQuestioningNoQualityTrend: 'No AI question quality trend yet',
    aiQuestioningWorkflowReady: 'No urgent governance items',
    aiQuestioningWorkflowCount: '{count} item(s) need action',
    aiQuestioningNoQualityGovernance: 'No quality governance groups yet',
    aiQuestioningBulkQualityReview: 'Send group to review',
    aiQuestioningBulkQualityApply: 'Apply recommendation',
    aiQuestioningSyllabus: 'Syllabus governance',
    aiQuestioningSyllabusBody: 'current {current}/{total} · stale {stale} · unpublished topics {unpublished} · pending review {pending}',
    aiQuestioningSyllabusTopicUpdate: 'Syllabus change preview',
    aiQuestioningSyllabusTopicId: 'Topic ID',
    aiQuestioningSyllabusTopicIds: 'Bulk topic IDs',
    aiQuestioningSyllabusTopicIdsHint: 'Separate by comma or newline. When provided, preview/apply uses the bulk workflow.',
    aiQuestioningSyllabusVersion: 'New syllabus version',
    aiQuestioningSyllabusSourceUrl: 'Source URL',
    aiQuestioningSyllabusSourceLabel: 'Source label',
    aiQuestioningSyllabusVerifiedAt: 'Verified date',
    aiQuestioningSyllabusStatus: 'Topic status',
    aiQuestioningPreviewSyllabus: 'Preview impact',
    aiQuestioningApplySyllabus: 'Apply change',
    aiQuestioningSyllabusImpact: 'will affect {stale} questions · approved now {approved} · already pending {pending}',
    aiQuestioningSyllabusBulkImpact: 'bulk {topics} topics · will affect {stale} questions · approved now {approved} · already pending {pending}',
    aiQuestioningSyllabusJsonImport: 'Upload syllabus JSON',
    aiQuestioningSyllabusJsonImportBody: 'Paste csca-syllabus-v1 JSON, preview impact, then save and apply the draft.',
    aiQuestioningSyllabusJsonInput: 'Syllabus JSON',
    aiQuestioningSyllabusPreviewJson: 'Preview JSON',
    aiQuestioningSyllabusSaveImport: 'Save draft',
    aiQuestioningSyllabusApplyImport: 'Apply draft',
    aiQuestioningSyllabusArchiveImport: 'Archive draft',
    aiQuestioningSyllabusJsonImpact: 'file {topics} topics · new {created} · updated {updated} · missing {missing} · affected questions {affected} · approved to review {approved}',
    aiQuestioningSyllabusRecentImports: 'Recent imports',
    aiQuestioningSyllabusNoImports: 'No syllabus imports yet',
    aiQuestioningSyllabusMissingTopicAction: 'Missing topics',
    aiQuestioningSyllabusMissingKeep: 'Keep unchanged',
    aiQuestioningSyllabusMissingDraft: 'Move to draft',
    aiQuestioningSyllabusMissingArchive: 'Archive',
    aiQuestioningRemediation: 'Misconception remediation',
    aiQuestioningRemediationBody: 'concept card drafts {cards} · variant blueprints {blueprints} · pending variants {pending}',
    aiQuestioningMisconceptions: 'Misconception dictionary',
    aiQuestioningMisconceptionsBody: 'active {active} · needs review {needsReview} · archived {archived}',
    aiQuestioningMisconceptionGovernance: 'Misconception governance',
    aiQuestioningMisconceptionGovernanceBody: 'duplicates {duplicates} · missing cards {cards} · orphan {orphans}',
    aiQuestioningMisconceptionIssue: {
      possible_duplicate: 'Possible duplicate',
      missing_concept_card: 'Missing card',
      orphan_tag: 'Orphan tag'
    },
    aiQuestioningNoMisconceptionGovernance: 'No misconception-tag alerts',
    aiQuestioningEditMisconception: 'Edit tag',
    aiQuestioningSaveMisconception: 'Save tag',
    aiQuestioningCancelMisconception: 'Cancel edit',
    aiQuestioningArchiveMisconception: 'Archive tag',
    aiQuestioningRestoreMisconception: 'Restore tag',
    aiQuestioningMergeMisconception: 'Merge tag',
    aiQuestioningMergeTarget: 'Merge into',
    aiQuestioningMergePlaceholder: 'Choose target tag',
    aiQuestioningReviewMisconception: 'Mark review',
    aiQuestioningCreateConceptFromMisconception: 'Create card',
    aiQuestioningCreateVariantFromMisconception: 'Add variant',
    aiQuestioningMisconceptionLabel: 'Tag label',
    aiQuestioningMisconceptionDescription: 'Tag description',
    aiQuestioningNoMisconceptions: 'No misconception tags yet',
    aiQuestioningConceptEffect: 'Concept-card effect',
    aiQuestioningConceptEffectBody: '{completed} completed · {attempts} variant attempts · accuracy {accuracy}',
    aiQuestioningConceptEffectRecent: 'Recent concept-card outcomes',
    aiQuestioningNoConceptEffect: 'No post-card variant outcome data yet',
    aiQuestioningVariantEffect: 'Variant effect',
    aiQuestioningVariantEffectBody: '{attempts} attempts · {sources} source questions · accuracy {accuracy} · review {weak}',
    aiQuestioningVariantEffectRecent: 'Recent variant outcomes',
    aiQuestioningNoVariantEffect: 'No variant outcome data yet',
    aiQuestioningRefreshSyllabus: 'Refresh syllabus review',
    aiQuestioningRefreshQuality: 'Refresh quality metrics',
    aiQuestioningGenerateBatch: 'Batch pre-generate',
    aiQuestioningGenerate: 'Generate candidate',
    aiQuestioningForceGenerate: 'Force retry',
    aiQuestioningPauseBlueprint: 'Pause blueprint',
    aiQuestioningResumeBlueprint: 'Resume blueprint',
    aiQuestioningBulkReview: 'Batch review',
    aiQuestioningBulkApprove: 'Batch approve',
    aiQuestioningBulkArchive: 'Batch archive',
    aiQuestioningReview: 'Review',
    aiQuestioningReviewReady: 'Review passed',
    aiQuestioningReviewNeedsHuman: 'Needs quality review',
    aiQuestioningReviewBlocked: 'Blocked from publishing',
    aiQuestioningReviewPending: 'Not reviewed',
    aiQuestioningReviewIssues: 'Issues: {errors} error(s) · {warnings} warning(s)',
    aiQuestioningReviewDimensions: 'Risk dimensions: {dimensions}',
    aiQuestioningReviewCodes: 'Main issues: {codes}',
    aiQuestioningReviewOptions: 'Distractor metadata: {count} item(s) · misconception tags {tags}',
    aiQuestioningEvidence: 'Review evidence',
    aiQuestioningEvidenceGeneration: 'Generation source',
    aiQuestioningEvidenceSyllabusScope: 'Syllabus scope',
    aiQuestioningEvidenceBlueprintConstraints: 'Blueprint constraints',
    aiQuestioningEvidenceRequestHash: 'Request hash',
    aiQuestioningEvidenceOptions: 'Options',
    aiQuestioningEvidenceAnswer: 'Correct answer',
    aiQuestioningEvidenceExplanation: 'Explanation',
    aiQuestioningEvidenceIssues: 'Review issues',
    aiQuestioningEvidenceDimensions: 'Review dimensions',
    aiQuestioningEvidenceOptionMetadata: 'Option misconception metadata',
    aiQuestioningNoEvidence: 'No structured evidence yet',
    aiQuestioningEditQuestion: 'Fix candidate',
    aiQuestioningEditBoundary: 'Saving runs review again; publishing still requires a separate approve-and-publish action.',
    aiQuestioningEditPrompt: 'Prompt',
    aiQuestioningEditOptionsJson: 'Options JSON',
    aiQuestioningEditAnswer: 'Correct answer',
    aiQuestioningEditExplanation: 'Explanation',
    aiQuestioningEditTags: 'Knowledge tags',
    aiQuestioningEditOptionMetadataJson: 'Option metadata JSON',
    aiQuestioningEditNote: 'Fix note',
    aiQuestioningEditReset: 'Reset form',
    aiQuestioningSaveAndReview: 'Save and review',
    aiQuestioningApprove: 'Approve and publish',
    aiQuestioningReject: 'Reject',
    aiQuestioningArchive: 'Archive',
    aiQuestioningResolveQuality: 'Mark resolved',
    aiQuestioningSendQualityReview: 'Send to review',
    aiQuestioningAssignQualityReview: 'Claim review',
    aiQuestioningQualityArchive: 'Archive low-quality',
    aiQuestioningQualityManualFix: 'Manual fix',
    aiQuestioningQualityReduceExposure: 'Reduce exposure',
    aiQuestioningQualityRegenerate: 'Regenerate',
    aiQuestioningQualitySelectVisible: 'Select visible quality items',
    aiQuestioningQualityClearSelection: 'Clear selection',
    aiQuestioningQualitySelected: '{count} selected',
    aiQuestioningQualityBulkBoundary: 'Bulk actions only process selected items in the current list. Regenerate creates replacement candidates that still require human approval before publishing.',
    aiQuestioningQualityBulkResolve: 'Bulk resolve',
    aiQuestioningQualityBulkSendReview: 'Bulk send to review',
    aiQuestioningQualityBulkReduceExposure: 'Bulk reduce exposure',
    aiQuestioningQualityBulkArchive: 'Bulk archive low-quality',
    aiQuestioningQualityBulkRegenerate: 'Bulk regenerate',
    aiQuestioningEditConcept: 'Edit card',
    aiQuestioningSaveConcept: 'Save card',
    aiQuestioningCancelConcept: 'Cancel edit',
    aiQuestioningConceptTitle: 'Card title',
    aiQuestioningConceptBody: 'Card body',
    aiQuestioningPublishConcept: 'Publish card',
    aiQuestioningArchiveConcept: 'Archive card',
    aiQuestioningNoRemediation: 'No remediation materials yet',
    aiQuestioningPublished: 'Published as practice question #{id}',
    aiQuestioningCandidatePublished: 'Candidate published as practice question #{id} and is now in the practice pool.',
    aiQuestioningReplacementPublished: 'Replacement candidate published as practice question #{id}; source low-quality question #{source} was archived and quality review was resolved.',
    aiQuestioningCandidateRejected: 'Candidate #{id} rejected and will not enter the practice pool.',
    aiQuestioningCandidateArchived: 'Candidate #{id} archived and will not enter the practice pool.',
    aiQuestioningCandidateReviewed: 'Candidate #{id} reviewed: {status}.',
    aiQuestioningNoBlueprints: 'No blueprints yet',
    aiQuestioningNoQuestions: 'No candidates yet',
    aiQuestioningNoQuality: 'No quality metrics yet',
    aiQuestioningActionSaved: 'Question governance action completed.',
    aiQuestioningBulkQualitySaved: 'Bulk action complete: requested {requested} · succeeded {succeeded} · failed {failed}.',
    aiQuestioningQualityResolvedFeedback: 'Quality item #{id} marked resolved and removed from the review queue.',
    aiQuestioningQualitySentReviewFeedback: 'Quality item #{id} sent back to review; if it was published, it moves to pending review before normal use.',
    aiQuestioningQualityAssignedFeedback: 'Quality item #{id} claimed by reviewer #{assignee}.',
    aiQuestioningQualityArchivedFeedback: 'Low-quality question #{id} archived and removed from the practice pool.',
    aiQuestioningQualityReducedExposureFeedback: 'Quality item #{id} exposure reduced, so the system will draw it less often.',
    aiQuestioningQualityManualFixFeedback: 'Quality item #{id} moved to the manual-fix queue; editing and review are still required before publishing.',
    aiQuestioningQualityRegeneratedFeedback: 'Quality item #{id} generated replacement candidate #{candidate}; review that candidate before it can replace the source question.',
    aiQuestioningQualityGenericFeedback: 'Quality item #{id} handled: {status}.',
    aiQuestioningBulkQualityImpact: ' · resolved {resolved} · review {review} · manual fixes {manualFix} · replacement candidates {regenerated} · reduced exposure {reduced} · archived {archived}',
    aiQuestioningBulkQualityErrors: ' · errors: {errors}',
    aiQuestioningBulkCandidateSaved: 'Candidate bulk action complete: requested {requested} · succeeded {succeeded} · failed {failed}{errors}',
    aiQuestioningBulkCandidateImpact: ' · published {published}, replacement publishes {replacements} · rejected {rejected} · archived {archived}',
    aiQuestioningBulkCandidateErrors: ' · errors: {errors}',
    aiQuestioningMergeSaved: 'Misconception merged: {cards} cards · {questions} questions · {options} option tags.',
    aiQuestioningConceptCreated: 'Concept-card draft {status}: {title}',
    aiQuestioningVariantCreated: 'Variant candidate {status}: #{id}',
    eventBySubject: 'Subject event mix',
    trendLatest: 'Latest',
    trendPeak: 'Peak',
    trendTotal: 'Total',
    recentTrainingEvents: 'Recent training events',
    recentFailures: 'Recent AI failures',
    reviewQueue: 'AI review queue',
    reviewQueueBody: '{count} samples · low {low} · rejected {rejected} · errors {errors}',
    reviewAction: 'Suggested action',
    reviewAccepted: 'Accept',
    reviewPromptUpdate: 'Tune prompt',
    reviewQuestionFix: 'Fix question',
    reviewPauseTemplate: 'Pause template',
    reviewResolved: 'Resolved',
    reviewLatestDecision: 'Latest decision',
    reviewSaved: 'Review decision saved.',
    noReviewItems: 'No AI samples need review',
    noAdaptiveData: 'No adaptive observability data yet',
    noFailures: 'No AI failures yet',
    noEvents: 'No training events yet',
    loadingTitle: 'Loading admin statistics',
    loadingBody: 'Reading rebuild progress from the backend.',
    errorTitle: 'Could not load data',
    todoKicker: 'To-Do',
    todoTitle: 'Admin operation checkpoints',
    itemCount: '{count} items',
    recentKicker: 'Recent Operations',
    recentTitle: 'Audit Events',
    eventCount: '{count} events',
    unknownActor: 'System / unknown user',
    dateLocale: 'en-US'
  }
} as const;

function fillTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function formatAdminAuditError(nextError: unknown, fallback: string, locale: string) {
  if (nextError instanceof ApiError) {
    const code = nextError.code ? `/${nextError.code}` : '';
    const detail = `HTTP ${nextError.status}${code}: ${nextError.message}`;
    return usesLatinAdminCopy(locale) ? `${fallback} (${detail})` : detail;
  }
  const message = (nextError as Error).message || fallback;
  return usesLatinAdminCopy(locale) ? fallback : message;
}

function isAdminAuditForbiddenError(nextError: unknown) {
  if (nextError instanceof ApiError) {
    return nextError.status === 401 || nextError.status === 403 || nextError.code === 'email_unverified';
  }
  const message = String((nextError as Error)?.message ?? nextError ?? '').toLowerCase();
  return message.includes('403') || message.includes('forbidden') || message.includes('unauthorized');
}

function formatAdminAuditModuleFailure(label: string, reason: unknown, locale: string) {
  return `${label}（${formatAdminAuditError(reason, adminText(locale, { zh: '失败', en: 'failed', vi: 'thất bại' }), locale)}）`;
}

function auditPayload(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

const EMPTY_SUMMARY: AdminAuditSummary = {
  schoolsTotal: 0,
  schoolsVerified: 0,
  schoolsPending: 0,
  adminAuditEventCount: 0,
  latestAdminAuditEventAt: null,
  schoolChangeCount: 0,
  latestSchoolChangeAt: null,
  mockExamAttemptCount: 0,
  specialPracticeSessionCount: 0
};

const EMPTY_AI_OBSERVABILITY: AdminAIObservability = {
  range: { from: '', to: '' },
  filters: { provider: null, status: null, type: null, subject: null },
  summary: {
    key: 'all',
    interactions: 0,
    fallbackInteractions: 0,
    externalInteractions: 0,
    successfulInteractions: 0,
    rejectedInteractions: 0,
    errorInteractions: 0,
    billableInteractions: 0,
    estimatedTokens: 0,
    estimatedCost: 0,
    feedbackCount: 0,
    lowFeedbackCount: 0,
    averageRating: null,
    fallbackRate: 0,
    rejectionRate: 0,
    errorRate: 0,
    feedbackRate: 0
  },
  rolloutHealth: {
    status: 'insufficient_data',
    recommendation: 'collect_more_samples',
    sampleSize: 0,
    feedbackSampleSize: 0,
    lowFeedbackRate: 0,
    thresholds: {
      minInteractions: 20,
      minFeedback: 5,
      maxErrorRate: 0.05,
      maxRejectionRate: 0.02,
      maxLowFeedbackRate: 0.2,
      minAverageRating: 3.5
    },
    checks: []
  },
  byDay: [],
  byProvider: [],
  byType: [],
  byStatus: [],
  reasonBreakdown: [],
  recentFailures: []
};

const EMPTY_AI_REVIEW_QUEUE: AdminAIReviewQueue = {
  range: { from: '', to: '' },
  filters: { provider: null, status: null, type: null, subject: null, reason: null },
  summary: {
    candidates: 0,
    lowFeedback: 0,
    providerRejected: 0,
    providerErrors: 0,
    quotaExhausted: 0
  },
  byReason: [],
  items: []
};

const EMPTY_AI_QUESTIONING_OPERATIONAL_READINESS: AdminAIQuestioningOperationalReadiness = {
  subject: null,
  useCase: AI_QUESTIONING_READINESS_USE_CASE,
  status: 'needs_attention',
  score: 0,
  nextAction: 'monitor',
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
      total: 0,
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      blocked: 0,
      staleRunning: 0,
      status: 'unknown',
      recommendedAction: 'monitor'
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
  generatedAt: ''
};

const EMPTY_AI_PROVIDER_CONFIG: AdminAIProviderConfig = {
  provider: {
    mode: 'rule-fallback',
    externalReady: false,
    externalToggleEnabled: false,
    provider: 'rule-fallback',
    supported: true,
    model: 'local-rule-v1',
    promptVersion: 'coach-rule-v1',
    requestedPromptVersion: 'coach-v2-safety',
    activePromptVersion: 'coach-v2-safety',
    promptVersionSupported: true,
    supportedPromptVersions: ['coach-v1-basic', 'coach-v2-safety'],
    promptTemplateCheck: {
      version: 'coach-v2-safety',
      valid: true,
      issues: []
    },
    apiKeyConfigured: false,
    baseUrlHost: 'api.openai.com',
    timeoutMs: 8000,
    temperature: 0.2,
    maxOutputChars: 1200,
    rollout: {
      percent: 100,
      strategy: 'all_users'
    },
    fallbackModel: 'local-rule-v1',
    fallbackPromptVersion: 'coach-rule-v1',
    blockers: []
  },
  usageMeter: {
    pricingConfigured: false,
    currency: 'USD',
    inputCostPer1KTokens: 0,
    outputCostPer1KTokens: 0,
    unitTokenBudget: 2000,
    meteringMode: 'estimate'
  }
};

const EMPTY_TRAINING_OBSERVABILITY: AdminTrainingEventObservability = {
  range: { from: '', to: '' },
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
    byActionType: [],
    recentClicks: []
  },
  readinessEvidence: {
    sampleSize: 0,
    averageScore: null,
    lowCount: 0,
    lowRate: 0,
    status: 'no_data',
    byStatus: [],
    topGaps: [],
    recent: []
  },
  readinessDifficultyThresholds: {
    mode: 'static',
    minSampleSize: 8,
    bySubject: []
  },
  readinessCalibrationHealth: {
    status: 'healthy',
    snapshotCount: 0,
    latestSnapshotDate: null,
    staleDays: null,
    alerts: []
  },
  readinessSampledThresholdRollout: {
    status: 'blocked',
    checklist: [],
    metrics: {
      mode: 'static',
      sampledReadySubjects: 0,
      totalSubjects: 0,
      insufficientSubjects: [],
      impactedUserSubjectCount: 0,
      maxImpactUserSubjectCount: 5,
      maxRecommendedCount: 0,
      minSampleSize: 8,
      blockingCalibrationAlertCount: 0
    }
  },
  plannerAssistant: {
    total: 0,
    accepted: 0,
    adjustedByGuard: 0,
    acceptanceRate: 0,
    byStatus: [],
    rejectedReasons: [],
    recent: []
  },
  conceptCardEffect: {
    summary: {
      completedCards: 0,
      cardsWithVariantAttempts: 0,
      variantAttemptCount: 0,
      variantCorrectCount: 0,
      variantAccuracy: null
    },
    recent: []
  },
  variantEffect: {
    summary: {
      variantQuestionCount: 0,
      sourceQuestionCount: 0,
      variantAttemptCount: 0,
      variantCorrectCount: 0,
      variantAccuracy: null,
      misconceptionTrackedCount: 0,
      weakVariantCount: 0
    },
    recent: []
  },
  recentEvents: []
};

function normalizeTrainingObservability(
  value: Partial<AdminTrainingEventObservability> | null | undefined
): AdminTrainingEventObservability {
  const readinessActions = value?.readinessActions;
  const readinessEvidence = value?.readinessEvidence;
  const readinessDifficultyThresholds = value?.readinessDifficultyThresholds;
  const readinessCalibrationHealth = value?.readinessCalibrationHealth;
  const readinessSampledThresholdRollout = value?.readinessSampledThresholdRollout;
  const plannerAssistant = value?.plannerAssistant;
  const conceptCardEffect = value?.conceptCardEffect;
  const variantEffect = value?.variantEffect;

  return {
    ...EMPTY_TRAINING_OBSERVABILITY,
    ...value,
    range: { ...EMPTY_TRAINING_OBSERVABILITY.range, ...value?.range },
    filters: { ...EMPTY_TRAINING_OBSERVABILITY.filters, ...value?.filters },
    summary: { ...EMPTY_TRAINING_OBSERVABILITY.summary, ...value?.summary },
    byDay: value?.byDay ?? [],
    byEventType: value?.byEventType ?? [],
    bySubject: value?.bySubject ?? [],
    readinessActions: {
      ...EMPTY_TRAINING_OBSERVABILITY.readinessActions,
      ...readinessActions,
      byActionType: readinessActions?.byActionType ?? [],
      recentClicks: readinessActions?.recentClicks ?? []
    },
    readinessEvidence: {
      ...EMPTY_TRAINING_OBSERVABILITY.readinessEvidence,
      ...readinessEvidence,
      byStatus: readinessEvidence?.byStatus ?? [],
      topGaps: readinessEvidence?.topGaps ?? [],
      recent: readinessEvidence?.recent ?? []
    },
    readinessDifficultyThresholds: {
      ...EMPTY_TRAINING_OBSERVABILITY.readinessDifficultyThresholds,
      ...readinessDifficultyThresholds,
      bySubject: readinessDifficultyThresholds?.bySubject ?? []
    },
    readinessCalibrationHealth: {
      ...EMPTY_TRAINING_OBSERVABILITY.readinessCalibrationHealth,
      ...readinessCalibrationHealth,
      alerts: readinessCalibrationHealth?.alerts ?? []
    },
    readinessSampledThresholdRollout: {
      ...EMPTY_TRAINING_OBSERVABILITY.readinessSampledThresholdRollout,
      ...readinessSampledThresholdRollout,
      checklist: readinessSampledThresholdRollout?.checklist ?? [],
      metrics: {
        ...EMPTY_TRAINING_OBSERVABILITY.readinessSampledThresholdRollout.metrics,
        ...readinessSampledThresholdRollout?.metrics
      }
    },
    plannerAssistant: {
      ...EMPTY_TRAINING_OBSERVABILITY.plannerAssistant,
      ...plannerAssistant,
      byStatus: plannerAssistant?.byStatus ?? [],
      rejectedReasons: plannerAssistant?.rejectedReasons ?? [],
      recent: plannerAssistant?.recent ?? []
    },
    conceptCardEffect: {
      ...EMPTY_TRAINING_OBSERVABILITY.conceptCardEffect,
      ...conceptCardEffect,
      summary: {
        ...EMPTY_TRAINING_OBSERVABILITY.conceptCardEffect.summary,
        ...conceptCardEffect?.summary
      },
      recent: conceptCardEffect?.recent ?? []
    },
    variantEffect: {
      ...EMPTY_TRAINING_OBSERVABILITY.variantEffect,
      ...variantEffect,
      summary: {
        ...EMPTY_TRAINING_OBSERVABILITY.variantEffect.summary,
        ...variantEffect?.summary
      },
      recent: variantEffect?.recent ?? []
    },
    recentEvents: value?.recentEvents ?? []
  };
}

const DEFAULT_OBSERVABILITY_FILTERS = {
  days: '14',
  subject: 'math',
  provider: '',
  status: '',
  type: '',
  reason: ''
};

const DAY_OPTIONS = [
  { value: '7', labelKey: 'days7' },
  { value: '14', labelKey: 'days14' },
  { value: '30', labelKey: 'days30' },
  { value: '90', labelKey: 'days90' }
] as const;

const SUBJECT_OPTIONS = [
  { value: 'math', label: 'Math' },
  { value: 'physics', label: 'Physics' },
  { value: 'chemistry', label: 'Chemistry' }
] as const;

const PROVIDER_OPTIONS = [
  { value: '', labelKey: 'allProviders' },
  { value: 'rule-fallback', label: 'rule-fallback' },
  { value: 'openai', label: 'openai' },
  { value: 'openai-compatible', label: 'openai-compatible' }
] as const;

const STATUS_OPTIONS = [
  { value: '', labelKey: 'allStatuses' },
  { value: 'success', label: 'success' },
  { value: 'provider_error', label: 'provider_error' },
  { value: 'provider_output_rejected', label: 'provider_output_rejected' },
  { value: 'provider_hint_revealed_answer', label: 'provider_hint_revealed_answer' },
  { value: 'quota_exhausted', label: 'quota_exhausted' }
] as const;

const TYPE_OPTIONS = [
  { value: '', labelKey: 'allTypes' },
  { value: 'hint', label: 'hint' },
  { value: 'explain_wrong_answer', label: 'explain_wrong_answer' },
  { value: 'round_summary', label: 'round_summary' }
] as const;

const REVIEW_REASON_OPTIONS = [
  { value: '', labelKey: 'allReviewReasons' },
  { value: 'low_feedback', labelKey: 'reviewLowFeedback' },
  { value: 'language_quality_issue', label: 'language_quality_issue' },
  { value: 'factual_quality_issue', label: 'factual_quality_issue' },
  { value: 'explanation_alignment_issue', label: 'explanation_alignment_issue' },
  { value: 'summary_grounding_issue', label: 'summary_grounding_issue' },
  { value: 'response_length_issue', label: 'response_length_issue' },
  { value: 'explanation_readability_issue', label: 'explanation_readability_issue' },
  { value: 'provider_rejected', labelKey: 'reviewProviderRejected' },
  { value: 'provider_error', labelKey: 'reviewProviderError' },
  { value: 'quota_exhausted', labelKey: 'reviewQuotaExhausted' },
  { value: 'fallback_failure', labelKey: 'reviewFallbackFailure' }
] as const;

const REVIEW_DECISION_ACTIONS = [
  { decision: 'accepted', labelKey: 'reviewAccepted' },
  { decision: 'needs_prompt_update', labelKey: 'reviewPromptUpdate' },
  { decision: 'needs_question_fix', labelKey: 'reviewQuestionFix' },
  { decision: 'pause_prompt_template', labelKey: 'reviewPauseTemplate' },
  { decision: 'resolved', labelKey: 'reviewResolved' }
] as const;

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}

function rolloutHealthLabel(status: AdminAIObservability['rolloutHealth']['status'], copy: typeof ADMIN_AUDIT_COPY.zh) {
  if (status === 'healthy') return copy.aiHealthHealthy;
  if (status === 'watch') return copy.aiHealthWatch;
  if (status === 'pause_rollout') return copy.aiHealthPause;
  return copy.aiHealthInsufficient;
}

function readinessCalibrationAlertLabel(
  code: string,
  copy: typeof ADMIN_AUDIT_COPY.zh | typeof ADMIN_AUDIT_COPY.en
) {
  return copy.readinessCalibrationAlertLabels[code as keyof typeof copy.readinessCalibrationAlertLabels] ?? code;
}

function compactNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

function optionLabel(copy: typeof ADMIN_AUDIT_COPY.zh | typeof ADMIN_AUDIT_COPY.en, option: { label?: string; labelKey?: string }) {
  if (option.label) return option.label;
  if (!option.labelKey) return '';
  const value = copy[option.labelKey as keyof typeof copy];
  return typeof value === 'string' ? value : '';
}

function trendWidth(value: number, max: number) {
  if (max <= 0) return '0%';
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function buildTrendPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
}

function compactDateLabel(value: string) {
  const parts = value.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return value;
}

function AdminEmptyState({
  children,
  tone = 'neutral'
}: {
  children: string;
  tone?: 'neutral' | 'ok' | 'warning';
}) {
  return (
    <p className={`admin-empty-state admin-empty-state-${tone}`}>
      <Icon name={tone === 'ok' ? 'lucide:check-circle-2' : tone === 'warning' ? 'lucide:alert-triangle' : 'lucide:inbox'} />
      <span>{children}</span>
    </p>
  );
}

function AdminTrendChart({
  copy,
  emptyText,
  gradientId,
  items
}: {
  copy: typeof ADMIN_AUDIT_COPY.zh | typeof ADMIN_AUDIT_COPY.en;
  emptyText: string;
  gradientId: string;
  items: Array<{ key: string; value: number }>;
}) {
  if (items.length === 0) return <AdminEmptyState>{emptyText}</AdminEmptyState>;

  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const latest = items[items.length - 1];
  const peak = items.reduce((best, item) => item.value > best.value ? item : best, items[0]);
  const points = items.map((item, index) => {
    const x = items.length === 1 ? 50 : 6 + (index / (items.length - 1)) * 88;
    const y = 56 - (item.value / max) * 40;
    return { x, y };
  });
  const linePath = buildTrendPath(points);
  const areaPath = points.length > 0
    ? `M ${points[0].x.toFixed(2)} 62 ${points.map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} L ${points[points.length - 1].x.toFixed(2)} 62 Z`
    : '';
  const recentItems = items.slice(-7);

  return (
    <div className="admin-trend-chart-body">
      <div className="admin-trend-visual" aria-hidden="true">
        <svg viewBox="0 0 100 68" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`${gradientId}-line`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#315dff" />
              <stop offset="100%" stopColor="#0f8c78" />
            </linearGradient>
            <linearGradient id={`${gradientId}-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0f8c78" stopOpacity=".24" />
              <stop offset="100%" stopColor="#0f8c78" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="6" x2="94" y1="16" y2="16" />
          <line x1="6" x2="94" y1="36" y2="36" />
          <line x1="6" x2="94" y1="56" y2="56" />
          <path className="admin-trend-area" d={areaPath} fill={`url(#${gradientId}-area)`} />
          <path className="admin-trend-line" d={linePath} stroke={`url(#${gradientId}-line)`} />
          {points.map((point, index) => (
            <circle key={`${items[index].key}-${index}`} cx={point.x} cy={point.y} r="1.8" />
          ))}
        </svg>
        <div className="admin-trend-axis">
          <span>{compactDateLabel(items[0].key)}</span>
          <span>{compactDateLabel(peak.key)}</span>
          <span>{compactDateLabel(latest.key)}</span>
        </div>
      </div>
      <div className="admin-trend-summary">
        <div>
          <span>{copy.trendLatest}</span>
          <strong>{compactNumber(latest.value)}</strong>
          <p>{compactDateLabel(latest.key)}</p>
        </div>
        <div>
          <span>{copy.trendPeak}</span>
          <strong>{compactNumber(peak.value)}</strong>
          <p>{compactDateLabel(peak.key)}</p>
        </div>
        <div>
          <span>{copy.trendTotal}</span>
          <strong>{compactNumber(total)}</strong>
          <p>{items.length}d</p>
        </div>
      </div>
      <div className="admin-trend-compact-list">
        {recentItems.map((item) => (
          <div key={item.key} className="admin-trend-compact-item">
            <span>{compactDateLabel(item.key)}</span>
            <div className="admin-trend-track"><i style={{ width: trendWidth(item.value, max) }} /></div>
            <b>{compactNumber(item.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAuditPage({
  onGoToAiOperations,
  onGoToQuestionBank,
  onGoToContent,
  onGoToCityGuides,
  onGoToTimelineWindows,
  onGoToSchools,
  onGoToScholarships,
  onGoToMockExams,
  onGoToSpecialPractice,
  onGoToOrganizations,
  onGoToUsers,
  onGoToAuth,
  currentUser
}: {
  onGoToAiOperations?: () => void;
  onGoToQuestionBank?: () => void;
  onGoToContent: () => void;
  onGoToCityGuides?: () => void;
  onGoToTimelineWindows?: () => void;
  onGoToSchools: () => void;
  onGoToScholarships?: () => void;
  onGoToMockExams?: () => void;
  onGoToSpecialPractice?: () => void;
  onGoToOrganizations?: () => void;
  onGoToUsers: () => void;
  onGoToAuth: () => void;
  currentUser?: User | null;
}) {
  const { locale } = useI18n();
  const copy = selectAdminCopy(locale, ADMIN_AUDIT_COPY) as typeof ADMIN_AUDIT_COPY.zh;
  const auditFilterCopy = usesLatinAdminCopy(locale)
    ? {
      organization: 'Organization',
      allOrganizations: 'All organizations',
      organizationEvents: 'Organization events',
      allEvents: 'All events',
      eventType: 'Event type',
      allEventTypes: 'All types',
      syllabusImports: 'Syllabus imports',
      organizationMembers: 'Organization members',
      organizationInvites: 'Organization invites',
      operationalReadiness: 'Bank readiness',
      resourceTypeLabels: {
        'syllabus-import': 'Syllabus imports',
        organization_member: 'Organization members',
        organization_invite: 'Organization invites',
        'operational-readiness': 'Bank readiness',
        'blueprint-coverage': 'Blueprint coverage',
        blueprint: 'Blueprint generation',
        'generation-job': 'Generation jobs',
        pregeneration: 'Backfill runs',
        topic: 'Topic actions',
        question: 'Candidate review',
        'quality-metric': 'Quality governance'
      },
      templates: 'Templates',
      templatesBody: 'Quick views for common operation checks.',
      templateLabels: {
        syllabus_imports: 'Syllabus changes',
        organization_invites: 'Invite flow',
        organization_members: 'Member changes',
        operational_readiness: 'Bank readiness',
        question_production: 'Question production',
        candidate_review: 'Candidate review',
        quality_governance: 'Quality governance'
      },
      limit: 'Limit',
      downloadCsv: 'Download CSV',
      clear: 'Clear filters',
      actor: 'Actor',
      target: 'Target',
      user: 'User',
      details: 'Change details',
      before: 'Before',
      after: 'After'
    }
    : {
      organization: '机构',
      allOrganizations: '全部机构',
      organizationEvents: '机构相关事件',
      allEvents: '全部事件',
      eventType: '事件类型',
      allEventTypes: '全部类型',
      syllabusImports: '大纲导入',
      organizationMembers: '机构成员',
      organizationInvites: '机构邀请',
      operationalReadiness: '题库运转状态',
      resourceTypeLabels: {
        'syllabus-import': '大纲导入',
        organization_member: '机构成员',
        organization_invite: '机构邀请',
        'operational-readiness': '题库运转状态',
        'blueprint-coverage': '蓝图覆盖',
        blueprint: '蓝图生成',
        'generation-job': '生成任务',
        pregeneration: '自动补仓',
        topic: '知识点动作',
        question: '候选审核',
        'quality-metric': '质量治理'
      },
      templates: '常用模板',
      templatesBody: '一键切到运营最常查的审计视图。',
      templateLabels: {
        syllabus_imports: '大纲变更',
        organization_invites: '邀请流转',
        organization_members: '成员变更',
        operational_readiness: '题库运转',
        question_production: '题库生产',
        candidate_review: '候选审核',
        quality_governance: '质量治理'
      },
      limit: '数量',
      downloadCsv: '下载 CSV',
      clear: '清空筛选',
      actor: '操作人',
      target: '对象',
      user: '用户',
      details: '查看变更详情',
      before: '变更前',
      after: '变更后'
    };
  const [items, setItems] = useState<AuditItem[]>([]);
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [auditFilters, setAuditFilters] = useState(() => (
    typeof window === 'undefined' ? DEFAULT_ADMIN_AUDIT_FILTERS : parseAdminAuditFiltersFromSearch(window.location.search)
  ));
  const [summary, setSummary] = useState<AdminAuditSummary>(EMPTY_SUMMARY);
  const [aiObservability, setAiObservability] = useState<AdminAIObservability>(EMPTY_AI_OBSERVABILITY);
  const [aiReviewQueue, setAiReviewQueue] = useState<AdminAIReviewQueue>(EMPTY_AI_REVIEW_QUEUE);
  const [aiQuestioningOperationalReadiness, setAiQuestioningOperationalReadiness] = useState<AdminAIQuestioningOperationalReadiness>(EMPTY_AI_QUESTIONING_OPERATIONAL_READINESS);
  const [aiProviderConfig, setAiProviderConfig] = useState<AdminAIProviderConfig>(EMPTY_AI_PROVIDER_CONFIG);
  const [aiOrganizations, setAiOrganizations] = useState<AdminAIOrganization[]>([]);
  const [trainingObservability, setTrainingObservability] = useState<AdminTrainingEventObservability>(EMPTY_TRAINING_OBSERVABILITY);
  const [observabilityFilters, setObservabilityFilters] = useState(DEFAULT_OBSERVABILITY_FILTERS);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [reviewSubmittingId, setReviewSubmittingId] = useState<number | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function downloadAuditEventsCsv() {
    const csvText = `${adminAuditEventsCsv(events, locale, summarizeAdminAuditEvent)}\n`;
    const url = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = adminAuditEventsFilename(auditFilters);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function trackAIQuestioningReadinessEvent(
    event: 'view_next_action' | 'download_csv' | 'download_json',
    extra: { targetId?: string; format?: 'csv' | 'json' } = {}
  ) {
    const result = await recordAdminAIQuestioningOperationalReadinessEvent({
      event,
      subject: aiQuestioningOperationalReadiness.subject,
      useCase: aiQuestioningOperationalReadiness.useCase === 'online_mock_exam' ? 'online_mock_exam' : AI_QUESTIONING_READINESS_USE_CASE,
      ...extra
    });
    if (result.latestAuditEvent) {
      const nextEvent: AdminAuditEvent = {
        ...result.latestAuditEvent,
        before: undefined,
        after: auditPayload(result.latestAuditEvent.after),
        actorEmail: result.latestAuditEvent.actorEmail
      };
      setEvents((current) => [nextEvent, ...current.filter((item) => item.id !== nextEvent.id)]);
      setAiQuestioningOperationalReadiness((current) => ({
        ...current,
        latestAuditEvent: result.latestAuditEvent
      }));
    }
    return result.latestAuditEvent;
  }

  async function downloadAIQuestioningReadinessReport(format: 'csv' | 'json') {
    try {
      const latestAuditEvent = await trackAIQuestioningReadinessEvent(format === 'csv' ? 'download_csv' : 'download_json', { format });
      const readinessForExport = latestAuditEvent
        ? { ...aiQuestioningOperationalReadiness, latestAuditEvent }
        : aiQuestioningOperationalReadiness;
      const text = format === 'csv'
        ? `${aiQuestioningReadinessCsv(readinessForExport)}\n`
        : aiQuestioningReadinessJson(readinessForExport);
      const url = URL.createObjectURL(new Blob([text], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = aiQuestioningReadinessFilename(readinessForExport, format);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (nextError) {
      setError(formatAdminAuditError(nextError, copy.loadFailed, locale));
    }
  }

  async function goToAIQuestioningReadinessAction() {
    const targetId = aiQuestioningReadinessActionTarget(aiQuestioningOperationalReadiness.nextAction);
    try {
      await trackAIQuestioningReadinessEvent('view_next_action', { targetId });
    } catch (nextError) {
      setError(formatAdminAuditError(nextError, copy.loadFailed, locale));
    }
    const target = document.getElementById(targetId);
    if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else if (onGoToQuestionBank) onGoToQuestionBank();
  }

  useEffect(() => {
    const onPopState = () => {
      setAuditFilters(parseAdminAuditFiltersFromSearch(window.location.search));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const nextSearch = buildAdminAuditFilterSearch(window.location.search, auditFilters);
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, [auditFilters]);

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setIsLoading(false);
      setError(null);
      setItems([]);
      setEvents([]);
      setSummary(EMPTY_SUMMARY);
      setAiObservability(EMPTY_AI_OBSERVABILITY);
      setAiReviewQueue(EMPTY_AI_REVIEW_QUEUE);
      setAiQuestioningOperationalReadiness(EMPTY_AI_QUESTIONING_OPERATIONAL_READINESS);
      setAiProviderConfig(EMPTY_AI_PROVIDER_CONFIG);
      setAiOrganizations([]);
      setTrainingObservability(EMPTY_TRAINING_OBSERVABILITY);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    const days = Number(observabilityFilters.days);
    const aiParams = {
      days,
      provider: observabilityFilters.provider || undefined,
      status: observabilityFilters.status || undefined,
      type: observabilityFilters.type || undefined,
      subject: observabilityFilters.subject || undefined
    };
    const reviewParams = {
      ...aiParams,
      reason: observabilityFilters.reason || undefined,
      limit: 30
    };
    const eventParams = {
      days,
      subject: observabilityFilters.subject || undefined
    };

    const requestLabels = [
      '审计项目',
      '练习汇总',
      '审计事件',
      'AI 观测',
      'AI 复核队列',
      '题库运转',
      'Provider 配置',
      '组织配置',
      '训练观测'
    ] as const;
    const requests = [
      getAdminAuditItems(),
      getAdminPracticeSummary(),
      getAdminAuditEvents(buildAdminAuditEventParams(auditFilters)),
      getAdminAdaptiveAIObservability(aiParams),
      getAdminAdaptiveAIReviewQueue(reviewParams),
      getAdminAIQuestioningOperationalReadiness({ subject: observabilityFilters.subject || undefined, useCase: AI_QUESTIONING_READINESS_USE_CASE }),
      getAdminAdaptiveAIProviderConfig(),
      getAdminAdaptiveAIOrganizations(),
      getAdminAdaptiveTrainingEventObservability(eventParams)
    ] as const;

    void Promise.allSettled(requests)
      .then(([auditResponse, summaryResponse, eventResponse, aiResponse, reviewResponse, readinessResponse, providerConfigResponse, organizationResponse, trainingResponse]) => {
        if (!isCurrent) return;
        const results = [
          auditResponse,
          summaryResponse,
          eventResponse,
          aiResponse,
          reviewResponse,
          readinessResponse,
          providerConfigResponse,
          organizationResponse,
          trainingResponse
        ] as const;
        const failedItems = results
          .map((result, index) => result.status === 'rejected' ? { label: requestLabels[index], reason: result.reason } : null)
          .filter((item): item is { label: (typeof requestLabels)[number]; reason: unknown } => item !== null);
        const failedLabels = failedItems.map((item) => item.label);
        const failedDetails = failedItems.map((item) => formatAdminAuditModuleFailure(item.label, item.reason, locale));
        const hasForbiddenFailure = failedItems.some((item) => isAdminAuditForbiddenError(item.reason));

        if (isFulfilled(auditResponse)) setItems(auditResponse.value.items);
        if (isFulfilled(summaryResponse)) setSummary(summaryResponse.value);
        if (isFulfilled(eventResponse)) setEvents(eventResponse.value.items);
        if (isFulfilled(aiResponse)) setAiObservability(aiResponse.value);
        if (isFulfilled(reviewResponse)) setAiReviewQueue(reviewResponse.value);
        if (isFulfilled(readinessResponse)) setAiQuestioningOperationalReadiness(readinessResponse.value);
        if (isFulfilled(providerConfigResponse)) setAiProviderConfig(providerConfigResponse.value);
        if (isFulfilled(organizationResponse)) setAiOrganizations(organizationResponse.value.items);
        if (isFulfilled(trainingResponse)) setTrainingObservability(normalizeTrainingObservability(trainingResponse.value));
        setError(failedLabels.length
          ? fillTemplate(hasForbiddenFailure ? copy.partialLoadForbidden : copy.partialLoadFailed, { modules: failedDetails.join('、') })
          : null);
      })
      .catch((nextError) => {
        if (!isCurrent) return;
        setError(formatAdminAuditError(nextError, copy.loadFailed, locale));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [currentUser?.role, observabilityFilters, auditFilters, refreshNonce]);

  const selectedRange = DAY_OPTIONS.find((item) => item.value === observabilityFilters.days);
  const adaptiveKicker = selectedRange ? optionLabel(copy, selectedRange) : copy.adaptiveKicker;

  async function recordReviewDecision(interactionId: number, decision: string) {
    setReviewSubmittingId(interactionId);
    setReviewFeedback(null);
    try {
      await createAdminAdaptiveAIReviewDecision(interactionId, { decision });
      setReviewFeedback(copy.reviewSaved);
      setRefreshNonce((value) => value + 1);
    } catch (nextError) {
      setError(formatAdminAuditError(nextError, copy.loadFailed, locale));
    } finally {
      setReviewSubmittingId(null);
    }
  }

  const adminWorkspaceActions = [
    { key: 'ai-operations', label: copy.aiOperationsCta, onClick: onGoToAiOperations },
    { key: 'ai-question-bank', label: copy.aiQuestionBankCta, onClick: onGoToQuestionBank },
    { key: 'organizations', label: copy.organizationsCta, onClick: onGoToOrganizations }
  ];
  const adminAuditAnchors = [
    { key: 'ai-question-bank-entry', label: copy.aiQuestionBankEntryTitle, href: '#admin-ai-question-bank-entry' },
    { key: 'admin-audit-observability', label: copy.sectionObservability, href: '#admin-audit-observability' },
    { key: 'audit-events', label: copy.recentKicker, href: '#admin-audit-events' }
  ];

  return (
    <AdminPageShell
      current="audit"
      currentUser={currentUser}
      kicker={copy.kicker}
      title={currentUser?.role === 'admin' ? copy.adminTitle : copy.guestTitle}
      body={currentUser?.role === 'admin' ? copy.adminBody : copy.guestBody}
      heroAside={currentUser?.role === 'admin' && (
        <AdminAuditWorkspaceLinks actions={adminWorkspaceActions} anchors={adminAuditAnchors} variant="hero" />
      )}
      onGoToAuth={onGoToAuth}
      onGoToAiOperations={onGoToAiOperations}
      onGoToContent={onGoToContent}
      onGoToCityGuides={onGoToCityGuides}
      onGoToTimelineWindows={onGoToTimelineWindows}
      onGoToSchools={onGoToSchools}
      onGoToScholarships={onGoToScholarships}
      onGoToMockExams={onGoToMockExams}
      onGoToSpecialPractice={onGoToSpecialPractice}
      onGoToOrganizations={onGoToOrganizations}
      onGoToUsers={onGoToUsers}
    >
      {currentUser?.role === 'admin' && <section className="admin-kpi-grid admin-audit-overview-kpis" aria-label={copy.kpiLabel}>
        <MetricCard label={copy.auditEvents} value={summary.adminAuditEventCount}>
          <p>{summary.latestAdminAuditEventAt ? new Date(summary.latestAdminAuditEventAt).toLocaleString(copy.dateLocale) : copy.noAdminActions}</p>
        </MetricCard>
        <MetricCard label={copy.practice} value={summary.mockExamAttemptCount + summary.specialPracticeSessionCount}>
          <p>{fillTemplate(copy.practiceBody, { mockAttempts: summary.mockExamAttemptCount, specialSessions: summary.specialPracticeSessionCount })}</p>
        </MetricCard>
        <MetricCard label={copy.contentChanges} value={summary.schoolChangeCount}>
          <p>{summary.latestSchoolChangeAt ? new Date(summary.latestSchoolChangeAt).toLocaleString(copy.dateLocale) : copy.noContentUpdates}</p>
        </MetricCard>
        <MetricCard label={copy.legacyData} value={summary.schoolsTotal}>
          <p>{fillTemplate(copy.legacyDataBody, { count: summary.schoolsPending })}</p>
        </MetricCard>
      </section>}

      {currentUser?.role === 'admin' && isLoading && <section className="school-empty-state"><strong>{copy.loadingTitle}</strong><p>{copy.loadingBody}</p></section>}
      {currentUser?.role === 'admin' && error && <section className="school-empty-state"><strong>{copy.errorTitle}</strong><p>{error}</p></section>}

      {currentUser?.role === 'admin' && !isLoading && (
        <>
          <AdminAuditWorkspaceLinks
            actions={adminWorkspaceActions}
            anchors={adminAuditAnchors}
            ariaLabel={copy.sectionNavLabel}
          />

          <section className="process-list admin-observability-controls">
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">{copy.adaptiveRange}</p>
                <h2>{copy.adaptiveTitle}</h2>
              </div>
              <span>{adaptiveKicker}</span>
            </div>
            <div className="admin-filter-grid">
              <label>
                <span>{copy.adaptiveRange}</span>
                <select value={observabilityFilters.days} onChange={(event) => setObservabilityFilters((current) => ({ ...current, days: event.target.value }))}>
                  {DAY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{optionLabel(copy, option)}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.subjectFilter}</span>
                <select value={observabilityFilters.subject} onChange={(event) => setObservabilityFilters((current) => ({ ...current, subject: event.target.value }))}>
                  {SUBJECT_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{optionLabel(copy, option)}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.providerFilter}</span>
                <select value={observabilityFilters.provider} onChange={(event) => setObservabilityFilters((current) => ({ ...current, provider: event.target.value }))}>
                  {PROVIDER_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{optionLabel(copy, option)}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.statusFilter}</span>
                <select value={observabilityFilters.status} onChange={(event) => setObservabilityFilters((current) => ({ ...current, status: event.target.value }))}>
                  {STATUS_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{optionLabel(copy, option)}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.typeFilter}</span>
                <select value={observabilityFilters.type} onChange={(event) => setObservabilityFilters((current) => ({ ...current, type: event.target.value }))}>
                  {TYPE_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{optionLabel(copy, option)}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.reviewReasonFilter}</span>
                <select value={observabilityFilters.reason} onChange={(event) => setObservabilityFilters((current) => ({ ...current, reason: event.target.value }))}>
                  {REVIEW_REASON_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{optionLabel(copy, option)}</option>)}
                </select>
              </label>
              <div className="admin-filter-actions">
                <button type="button" onClick={() => setRefreshNonce((value) => value + 1)} title={copy.adaptiveRefresh}>
                  <Icon name="lucide:rotate-ccw" />
                  <span>{copy.adaptiveRefresh}</span>
                </button>
                <button type="button" onClick={() => setObservabilityFilters(DEFAULT_OBSERVABILITY_FILTERS)} title={copy.adaptiveReset}>
                  <Icon name="lucide:filter" />
                  <span>{copy.adaptiveReset}</span>
                </button>
              </div>
            </div>
          </section>

          <section id="admin-audit-observability" className="admin-kpi-grid admin-audit-overview-kpis" aria-label={copy.sectionObservability}>
            <MetricCard label={copy.aiProviderCost} value={aiProviderConfig.usageMeter.pricingConfigured ? aiProviderConfig.usageMeter.currency : 'estimate'}>
              <p>{aiProviderConfig.usageMeter.pricingConfigured
                ? fillTemplate(copy.aiProviderCostReady, {
                  currency: aiProviderConfig.usageMeter.currency,
                  inputCost: aiProviderConfig.usageMeter.inputCostPer1KTokens,
                  outputCost: aiProviderConfig.usageMeter.outputCostPer1KTokens,
                  unitBudget: aiProviderConfig.usageMeter.unitTokenBudget
                })
                : copy.aiProviderCostMissing}</p>
            </MetricCard>
            <MetricCard label={copy.diagnosticCompletion} value={formatPercent(trainingObservability.summary.diagnosticCompletionRate)}>
              <p>{trainingObservability.summary.diagnosticCompleted} / {trainingObservability.summary.diagnosticStarted}</p>
            </MetricCard>
            <MetricCard label={copy.practiceCompletion} value={formatPercent(trainingObservability.summary.practiceCompletionRate)}>
              <p>{trainingObservability.summary.practiceCompleted} / {trainingObservability.summary.practiceStarted}</p>
            </MetricCard>
            <MetricCard label={copy.aiCalls} value={aiObservability.summary.interactions.toLocaleString()}>
              <p>{fillTemplate(copy.aiCallsBody, {
                feedbackCount: aiObservability.summary.feedbackCount.toLocaleString(),
                tokenCount: aiObservability.summary.estimatedTokens.toLocaleString()
              })}</p>
            </MetricCard>
            <MetricCard label="LLM 使用量" value={aiObservability.summary.externalInteractions.toLocaleString()}>
              <p>
                billable {aiObservability.summary.billableInteractions.toLocaleString()}
                {' · '}
                tokens {aiObservability.summary.estimatedTokens.toLocaleString()}
                {' · '}
                cost {aiProviderConfig.usageMeter.currency} {aiObservability.summary.estimatedCost.toLocaleString()}
              </p>
            </MetricCard>
            <MetricCard label={copy.aiQuality} value={formatPercent(aiObservability.summary.feedbackRate)}>
              <p>{fillTemplate(copy.aiQualityBody, {
                fallbackRate: formatPercent(aiObservability.summary.fallbackRate),
                rejectionRate: formatPercent(aiObservability.summary.rejectionRate),
                errorRate: formatPercent(aiObservability.summary.errorRate)
              })}</p>
            </MetricCard>
            <MetricCard label={copy.aiRolloutHealth} value={rolloutHealthLabel(aiObservability.rolloutHealth.status, copy)}>
              <p>{fillTemplate(copy.aiRolloutHealthBody, {
                sampleSize: aiObservability.rolloutHealth.sampleSize,
                feedbackSampleSize: aiObservability.rolloutHealth.feedbackSampleSize,
                lowFeedbackRate: formatPercent(aiObservability.rolloutHealth.lowFeedbackRate)
              })}</p>
            </MetricCard>
            <MetricCard label={copy.reviewQueue} value={aiReviewQueue.summary.candidates}>
              <p>{fillTemplate(copy.reviewQueueBody, {
                count: aiReviewQueue.summary.candidates,
                low: aiReviewQueue.summary.lowFeedback,
                rejected: aiReviewQueue.summary.providerRejected,
                errors: aiReviewQueue.summary.providerErrors
              })}</p>
            </MetricCard>
            <MetricCard label={copy.aiProviderConfig} value={aiProviderConfig.provider.externalReady ? copy.aiProviderReady : copy.aiProviderFallback}>
              <p>{fillTemplate(copy.aiProviderMeta, {
                provider: aiProviderConfig.provider.provider,
                model: aiProviderConfig.provider.model,
                requestedPromptVersion: aiProviderConfig.provider.requestedPromptVersion,
                activePromptVersion: aiProviderConfig.provider.activePromptVersion,
                rolloutPercent: aiProviderConfig.provider.rollout.percent
              })}</p>
            </MetricCard>
          </section>

          <section className="admin-work-grid two">
            <section className="process-list admin-compact-section">
              <div className="admin-section-head">
                <div>
                  <p className="page-kicker">{adaptiveKicker}</p>
                  <h2>{copy.aiByType}</h2>
                </div>
                <span>{aiObservability.byType.length}</span>
              </div>
              {aiObservability.byType.length === 0 && <AdminEmptyState>{copy.noAdaptiveData}</AdminEmptyState>}
              {aiObservability.byType.slice(0, 8).map((item, index) => (
                <article key={item.key} className="process-row admin-data-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{item.key}</strong>
                    <p>{item.successfulInteractions} success · {item.errorInteractions} error · {item.rejectedInteractions} rejected</p>
                  </div>
                  <b>{compactNumber(item.interactions)}</b>
                </article>
              ))}
            </section>

            <section className="process-list admin-compact-section">
              <div className="admin-section-head">
                <div>
                  <p className="page-kicker">{adaptiveKicker}</p>
                  <h2>{copy.eventBySubject}</h2>
                </div>
                <span>{trainingObservability.bySubject.length}</span>
              </div>
              {trainingObservability.bySubject.length === 0 && <AdminEmptyState>{copy.noEvents}</AdminEmptyState>}
              {trainingObservability.bySubject.slice(0, 8).map((item, index) => (
                <article key={item.key} className="process-row admin-data-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{item.key}</strong>
                    <p>{copy.trainingEvents}</p>
                  </div>
                  <b>{compactNumber(item.count)}</b>
                </article>
              ))}
            </section>
          </section>

          <section className="admin-work-grid two">
            <section className="process-list admin-compact-section">
              <div className="admin-section-head">
                <div>
                  <p className="page-kicker">{adaptiveKicker}</p>
                  <h2>{copy.trainingEvents}</h2>
                </div>
                <span>{trainingObservability.byEventType.length}</span>
              </div>
              {trainingObservability.byEventType.length === 0 && <AdminEmptyState>{copy.noEvents}</AdminEmptyState>}
              {trainingObservability.byEventType.slice(0, 8).map((item, index) => (
                <article key={item.key} className="process-row admin-data-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{item.key}</strong>
                    <p>{copy.trainingEvents}</p>
                  </div>
                  <b>{compactNumber(item.count)}</b>
                </article>
              ))}
            </section>

            <section className="process-list admin-compact-section">
              <div className="admin-section-head">
                <div>
                  <p className="page-kicker">{adaptiveKicker}</p>
                  <h2>{copy.recentTrainingEvents}</h2>
                </div>
                <span>{trainingObservability.recentEvents.length}</span>
              </div>
              {trainingObservability.recentEvents.length === 0 && <AdminEmptyState>{copy.noEvents}</AdminEmptyState>}
              {trainingObservability.recentEvents.slice(0, 8).map((event, index) => (
                <article key={event.id} className="process-row admin-data-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{event.eventType}</strong>
                    <p>{[event.subject, event.source, event.userId ? `user ${event.userId}` : null, event.roundId ? `round ${event.roundId}` : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  <b>{new Date(event.createdAt).toLocaleString(copy.dateLocale)}</b>
                </article>
              ))}
            </section>
          </section>

          <section className="process-list admin-compact-section">
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">{adaptiveKicker}</p>
                <h2>{copy.reviewQueue}</h2>
              </div>
              <span>{aiReviewQueue.summary.candidates}</span>
            </div>
            <div className="admin-kpi-grid">
              <MetricCard label={copy.reviewQueue} value={aiReviewQueue.summary.candidates}>
                <p>{fillTemplate(copy.reviewQueueBody, {
                  count: aiReviewQueue.summary.candidates,
                  low: aiReviewQueue.summary.lowFeedback,
                  rejected: aiReviewQueue.summary.providerRejected,
                  errors: aiReviewQueue.summary.providerErrors
                })}</p>
              </MetricCard>
              {aiReviewQueue.byReason.slice(0, 3).map((item) => (
                <MetricCard key={item.key} label={item.key} value={item.count}>
                  <p>{copy.reviewAction}</p>
                </MetricCard>
              ))}
            </div>
            {reviewFeedback && <p className="admin-inline-success">{reviewFeedback}</p>}
            {aiReviewQueue.items.length === 0 && <AdminEmptyState>{copy.noReviewItems}</AdminEmptyState>}
            {aiReviewQueue.items.slice(0, 10).map((item, index) => (
              <article key={item.id} className="process-row admin-ai-review-row">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{item.status}</strong>
                  <p>{[item.type, item.provider, item.model, item.subject, item.averageRating ? `rating ${item.averageRating}` : null].filter(Boolean).join(' · ')}</p>
                  <p>{item.reasons.join(' · ')} · {copy.reviewAction}: {item.suggestedAction}</p>
                  {item.latestDecision && <p>{copy.reviewLatestDecision}: {item.latestDecision.decision} · {item.latestDecision.status}</p>}
                  {item.outputPreview && <p>{item.outputPreview}</p>}
                  {item.latestFeedbackReason && <p>{item.latestFeedbackReason}</p>}
                  <div className="admin-ai-review-actions">
                    {REVIEW_DECISION_ACTIONS.map((action) => (
                      <button
                        key={action.decision}
                        type="button"
                        disabled={reviewSubmittingId === item.id}
                        onClick={() => void recordReviewDecision(item.id, action.decision)}
                      >
                        {optionLabel(copy, action)}
                      </button>
                    ))}
                  </div>
                </div>
                <b>{new Date(item.createdAt).toLocaleString(copy.dateLocale)}</b>
              </article>
            ))}
          </section>

          <section className="process-list admin-compact-section">
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">{adaptiveKicker}</p>
                <h2>{copy.recentFailures}</h2>
              </div>
              <span>{aiObservability.recentFailures.length}</span>
            </div>
            {aiObservability.recentFailures.length === 0 && <AdminEmptyState>{copy.noFailures}</AdminEmptyState>}
            {aiObservability.recentFailures.slice(0, 6).map((event, index) => (
              <article key={event.id} className="process-row admin-data-row">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{event.status}</strong>
                  <p>{[event.type, event.provider, event.model, event.subject].filter(Boolean).join(' · ')}</p>
                </div>
                <b>{new Date(event.createdAt).toLocaleString(copy.dateLocale)}</b>
              </article>
            ))}
          </section>

          <section className="process-list admin-compact-section">
            <div className="process-row">
              <span>{aiProviderConfig.provider.externalReady ? 'OK' : 'AI'}</span>
              <div>
                <strong>{copy.aiProviderBlockers}</strong>
                <p>{aiProviderConfig.provider.blockers.length ? aiProviderConfig.provider.blockers.join(' · ') : copy.aiProviderNoBlockers}</p>
              </div>
              <b>{aiProviderConfig.provider.baseUrlHost}</b>
            </div>
          </section>

          <section className="admin-work-grid two">
            <section className="process-list admin-compact-section admin-trend-chart-section">
              <div className="admin-section-head">
                <div>
                  <p className="page-kicker">{adaptiveKicker}</p>
                  <h2>{copy.aiTrend}</h2>
                </div>
                <span>{aiObservability.byDay.length}</span>
              </div>
              <AdminTrendChart
                copy={copy}
                emptyText={copy.noAdaptiveData}
                gradientId="admin-ai-trend"
                items={aiObservability.byDay.map((item) => ({ key: item.key, value: item.interactions }))}
              />
            </section>

            <section className="process-list admin-compact-section admin-trend-chart-section">
              <div className="admin-section-head">
                <div>
                  <p className="page-kicker">{adaptiveKicker}</p>
                  <h2>{copy.eventTrend}</h2>
                </div>
                <span>{trainingObservability.byDay.length}</span>
              </div>
              <AdminTrendChart
                copy={copy}
                emptyText={copy.noEvents}
                gradientId="admin-training-event-trend"
                items={trainingObservability.byDay.map((item) => ({ key: item.key, value: item.count }))}
              />
            </section>
          </section>

          <section className="admin-work-grid two">
            <section className="process-list admin-compact-section">
              <div className="admin-section-head">
                <div>
                  <p className="page-kicker">{adaptiveKicker}</p>
                  <h2>{copy.aiByProvider}</h2>
                </div>
                <span>{aiObservability.byProvider.length}</span>
              </div>
              {aiObservability.byProvider.length === 0 && <AdminEmptyState>{copy.noAdaptiveData}</AdminEmptyState>}
              {aiObservability.byProvider.slice(0, 8).map((item, index) => (
                <article key={item.key} className="process-row admin-data-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{item.key}</strong>
                    <p>{item.billableInteractions} billable · {compactNumber(item.estimatedTokens)} tokens · {item.feedbackCount} feedback</p>
                    <div className="admin-trend-track">
                      <i style={{ width: trendWidth(item.interactions, Math.max(1, ...aiObservability.byProvider.map((provider) => provider.interactions))) }} />
                    </div>
                  </div>
                  <b>{compactNumber(item.interactions)}</b>
                </article>
              ))}
            </section>

            <section className="process-list admin-compact-section">
              <div className="admin-section-head">
                <div>
                  <p className="page-kicker">{adaptiveKicker}</p>
                  <h2>{copy.aiStatus}</h2>
                </div>
                <span>{aiObservability.byStatus.length}</span>
              </div>
              {aiObservability.byStatus.length === 0 && <AdminEmptyState>{copy.noAdaptiveData}</AdminEmptyState>}
              {aiObservability.byStatus.slice(0, 8).map((item, index) => (
                <article key={item.key} className="process-row admin-data-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{item.key}</strong>
                    <p>{item.billableInteractions} billable · {compactNumber(item.estimatedTokens)} tokens · {item.feedbackCount} feedback</p>
                    <div className="admin-trend-track">
                      <i style={{ width: trendWidth(item.interactions, Math.max(1, ...aiObservability.byStatus.map((status) => status.interactions))) }} />
                    </div>
                  </div>
                  <b>{compactNumber(item.interactions)}</b>
                </article>
              ))}
            </section>
          </section>

          <section className="process-list admin-compact-section">
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">{copy.todoKicker}</p>
                <h2>{copy.todoTitle}</h2>
              </div>
              <span>{fillTemplate(copy.itemCount, { count: items.length })}</span>
            </div>
            {items.map((item, index) => (
              <article key={item.id} className="process-row admin-data-row">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <b>{item.status}</b>
              </article>
            ))}
          </section>
          <section id="admin-ai-question-bank-entry" className="process-list admin-compact-section" tabIndex={-1}>
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">{copy.sectionQuestioning}</p>
                <h2>{copy.aiQuestionBankEntryTitle}</h2>
                <p>{copy.aiQuestionBankEntryBody}</p>
              </div>
              {onGoToQuestionBank
                ? <button type="button" onClick={onGoToQuestionBank}>{copy.aiQuestionBankCta}</button>
                : <span>{copy.aiQuestionBankEntryTitle}</span>}
            </div>
            <AdminEmptyState>{copy.aiQuestionBankEntryBody}</AdminEmptyState>
            <p className="admin-entry-hint">{copy.aiQuestionBankEntryHint}</p>
          </section>

          <section id="admin-audit-questioning" className="process-list admin-compact-section" tabIndex={-1}>
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">{copy.sectionQuestioning}</p>
                <h2>{copy.aiQuestioningOperationalReadiness}</h2>
                <p>{fillTemplate(copy.aiQuestioningOperationalReadinessBody, {
                  status: copy.aiQuestioningOperationalReadinessStatus[aiQuestioningOperationalReadiness.status as keyof typeof copy.aiQuestioningOperationalReadinessStatus] ?? aiQuestioningOperationalReadiness.status,
                  action: copy.aiQuestioningOperationalReadinessActions[aiQuestioningOperationalReadiness.nextAction as keyof typeof copy.aiQuestioningOperationalReadinessActions] ?? aiQuestioningOperationalReadiness.nextAction,
                  blockers: aiQuestioningOperationalReadiness.blockers.length,
                  warnings: aiQuestioningOperationalReadiness.warnings.length
                })}</p>
              </div>
              <span>{aiQuestioningOperationalReadiness.score}/100 {copy.aiQuestioningOperationalReadinessScore}</span>
            </div>
            <div className="admin-filter-actions">
              <button type="button" onClick={() => void goToAIQuestioningReadinessAction()}>
                {copy.aiQuestioningOperationalReadinessGoToAction}
              </button>
              <button type="button" onClick={() => setAuditFilters((current) => ({ ...current, organizationOnly: false, resourceType: 'operational-readiness' }))}>
                {copy.aiQuestioningOperationalReadinessAuditTrail}
              </button>
              <button type="button" onClick={() => void downloadAIQuestioningReadinessReport('csv')}>
                {copy.aiQuestioningOperationalReadinessDownloadCsv}
              </button>
              <button type="button" onClick={() => void downloadAIQuestioningReadinessReport('json')}>
                {copy.aiQuestioningOperationalReadinessDownloadJson}
              </button>
            </div>
            <p className="admin-entry-hint">
              {aiQuestioningOperationalReadiness.latestAuditEvent
                ? fillTemplate(copy.aiQuestioningOperationalReadinessLatestAudit, {
                  action: copy.aiQuestioningOperationalReadinessActions[aiQuestioningOperationalReadiness.latestAuditEvent.action as keyof typeof copy.aiQuestioningOperationalReadinessActions] ?? aiQuestioningOperationalReadiness.latestAuditEvent.action,
                  actor: aiQuestioningOperationalReadiness.latestAuditEvent.actorEmail || copy.unknownActor,
                  time: new Date(aiQuestioningOperationalReadiness.latestAuditEvent.createdAt).toLocaleString(copy.dateLocale)
                })
                : copy.aiQuestioningOperationalReadinessNoAudit}
            </p>
            {(aiQuestioningOperationalReadiness.blockers.length > 0 || aiQuestioningOperationalReadiness.warnings.length > 0) && (
              <div className="admin-filter-actions admin-quality-filter-chips">
                {[...aiQuestioningOperationalReadiness.blockers, ...aiQuestioningOperationalReadiness.warnings].slice(0, 8).map((item) => (
                  <span key={`${item.key}-${item.action}`} className="admin-filter-chip">
                    {copy.aiQuestioningOperationalReadinessIssues[item.key as keyof typeof copy.aiQuestioningOperationalReadinessIssues] ?? item.key} · {item.count}
                  </span>
                ))}
              </div>
            )}
          </section>
          <section id="admin-audit-events" className="process-list admin-compact-section" tabIndex={-1}>
            <div className="admin-section-head">
              <div>
                <p className="page-kicker">{copy.recentKicker}</p>
                <h2>{copy.recentTitle}</h2>
              </div>
              <span>{fillTemplate(copy.eventCount, { count: events.length })}</span>
            </div>
            <div className="admin-filter-grid">
              <label>
                {auditFilterCopy.organization}
                <select
                  value={auditFilters.organizationId}
                  onChange={(event) => setAuditFilters((current) => ({ ...current, organizationId: event.target.value }))}
                >
                  <option value="">{auditFilterCopy.allOrganizations}</option>
                  {aiOrganizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name} · {organization.slug}</option>
                  ))}
                </select>
              </label>
              <label>
                {auditFilterCopy.organizationEvents}
                <select
                  value={auditFilters.organizationOnly ? 'organization' : 'all'}
                  onChange={(event) => setAuditFilters((current) => ({ ...current, organizationOnly: event.target.value === 'organization' }))}
                >
                  <option value="all">{auditFilterCopy.allEvents}</option>
                  <option value="organization">{auditFilterCopy.organizationEvents}</option>
                </select>
              </label>
              <label>
                {auditFilterCopy.limit}
                <select
                  value={auditFilters.limit}
                  onChange={(event) => setAuditFilters((current) => ({ ...current, limit: event.target.value }))}
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </label>
              <label>
                {auditFilterCopy.eventType}
                <select
                  value={auditFilters.resourceType}
                  onChange={(event) => setAuditFilters((current) => ({ ...current, resourceType: event.target.value }))}
                >
                  <option value="">{auditFilterCopy.allEventTypes}</option>
                  {ADMIN_AUDIT_RESOURCE_TYPES.map((resourceType) => (
                    <option key={resourceType} value={resourceType}>
                      {auditFilterCopy.resourceTypeLabels[resourceType] ?? resourceType}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAuditFilters((current) => ({ ...current, organizationOnly: false, resourceType: 'syllabus-import' }))}
              >
                {auditFilterCopy.syllabusImports}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAuditFilters((current) => ({ ...current, organizationOnly: false, resourceType: 'operational-readiness' }))}
              >
                {auditFilterCopy.operationalReadiness}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={downloadAuditEventsCsv}
                disabled={events.length === 0}
              >
                {auditFilterCopy.downloadCsv}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAuditFilters(DEFAULT_ADMIN_AUDIT_FILTERS)}
              >
                {auditFilterCopy.clear}
              </button>
            </div>
            <div className="admin-filter-actions admin-audit-template-actions" aria-label={auditFilterCopy.templates}>
              <span className="admin-audit-template-label">{auditFilterCopy.templatesBody}</span>
              {ADMIN_AUDIT_FILTER_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="ghost-button"
                  onClick={() => setAuditFilters((current) => applyAdminAuditFilterTemplate(current, template.id))}
                >
                  {auditFilterCopy.templateLabels[template.id]}
                </button>
              ))}
            </div>
            {events.length === 0 && <AdminEmptyState>{copy.noEvents}</AdminEmptyState>}
            {events.map((event, index) => {
              const auditSummary = summarizeAdminAuditEvent(event, locale);
              const organizationLabel = event.organizationName
                ? `${event.organizationName}${event.organizationSlug ? ` · ${event.organizationSlug}` : ''}`
                : undefined;
              const businessContext = [
                organizationLabel,
                event.targetEmail ? `${auditFilterCopy.target}: ${event.targetEmail}` : undefined,
                event.relatedUserEmail ? `${auditFilterCopy.user}: ${event.relatedUserEmail}` : undefined,
                `${auditFilterCopy.actor}: ${event.actorEmail || copy.unknownActor}`
              ].filter(Boolean);
              const technicalContext = [event.module, event.resourceType, event.resourceId].filter(Boolean);
              return (
                <article key={event.id} className="process-row admin-data-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{auditSummary?.title ?? event.action}</strong>
                    {auditSummary && <p className={`admin-audit-business-summary ${auditSummary.tone}`}>{auditSummary.detail}</p>}
                    {auditSummary?.rows.map((row) => (
                      <p key={`${event.id}-${row}`} className="admin-audit-business-row">{row}</p>
                    ))}
                    <p>{businessContext.join(' · ')}</p>
                    <p>{technicalContext.join(' · ')}</p>
                    <details className="admin-audit-event-details">
                      <summary>{auditFilterCopy.details}</summary>
                      <div className="admin-audit-event-diff">
                        <section>
                          <h4>{auditFilterCopy.before}</h4>
                          <pre>{formatAuditPayload(event.before)}</pre>
                        </section>
                        <section>
                          <h4>{auditFilterCopy.after}</h4>
                          <pre>{formatAuditPayload(event.after)}</pre>
                        </section>
                      </div>
                    </details>
                  </div>
                  <b>{new Date(event.createdAt).toLocaleString(copy.dateLocale)}</b>
                </article>
              );
            })}
          </section>
        </>
      )}
    </AdminPageShell>
  );
}


