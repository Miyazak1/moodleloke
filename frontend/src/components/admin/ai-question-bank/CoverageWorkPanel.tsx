import {
  AdminActionBar,
  AdminOperationStatus,
  AdminPanel,
  AdminPanelHeader
} from '../AdminWorkbench';
import type {
  AdminAIQuestioningBlueprintCoverage,
  AdminAIQuestioningGenerationQueueHealth,
  AdminAIQuestioningTopicHealth
} from '../../../lib/api-types';
import { statusLabel } from './candidateReviewHelpers';
import { subjectDisplayName } from './questionFormatting';

export type TopicBulkProgress = {
  action: 'ensure_blueprint' | 'generate_candidates' | 'expand_candidates';
  total: number;
  completed: number;
  topicSucceeded: number;
  failed: number;
  generated: number;
  enqueued: number;
  skipped: number;
  repairFirstHandled: number;
  repairFirstApproved: number;
  repairFirstRepaired: number;
  repairFirstRegenerated: number;
  repairFirstSkipped: number;
  repairFirstWaiting: number;
  currentTitle: string | null;
  awaitingQueue: boolean;
};

type TopicAction = AdminAIQuestioningTopicHealth['items'][number]['action'];

export function topicActionLabel(action: TopicAction) {
  const labels: Record<TopicAction, string> = {
    ensure_blueprint: '按大纲生成蓝图',
    generate_candidates: '局部补题',
    expand_candidates: '局部追加',
    review_candidates: '审核候选',
    review_quality: '处理质量',
    monitor: '观察'
  };
  return labels[action] ?? action;
}

function topicActionBusyLabel(action: TopicAction) {
  const labels: Partial<Record<TopicAction, string>> = {
    ensure_blueprint: '生成蓝图中',
    generate_candidates: '局部补题中',
    expand_candidates: '局部追加中'
  };
  return labels[action] ?? topicActionLabel(action);
}

function topicHealthStatusLabel(status: string) {
  const labels: Record<string, string> = {
    missing_blueprint: '缺出题蓝图',
    needs_profile_rebuild: '画像维度不完整',
    needs_candidates: '缺合格训练题',
    needs_quality_review: '正式题待复核',
    healthy: '正式题达标'
  };
  return labels[status] ?? statusLabel(status);
}

function difficultyLabel(value: string) {
  const labels: Record<string, string> = {
    basic: '基础',
    medium: '中等',
    hard: '较难'
  };
  return labels[value] ?? value;
}

export function isServerTopicAction(
  action: TopicAction
): action is 'ensure_blueprint' | 'generate_candidates' | 'expand_candidates' {
  return action === 'ensure_blueprint' || action === 'generate_candidates' || action === 'expand_candidates';
}

function topicActionHint(topic: AdminAIQuestioningTopicHealth['items'][number]) {
  if (topic.action === 'ensure_blueprint') return '这个知识点来自已应用大纲，但还没有可用出题蓝图。先按大纲生成蓝图。';
  if (topic.status === 'needs_profile_rebuild') return '这个知识点的真题画像维度不完整。请先重新解析真题画像或重建缺口计划，再启动 AI 出题。';
  if (topic.action === 'generate_candidates') return '这个知识点已有出题蓝图，但正式训练题还没达标。建议优先使用上方生产计划；此处只用于单知识点排障。';
  if (topic.action === 'expand_candidates') return '这个知识点已有出题蓝图。建议优先使用上方生产计划；此处只用于单知识点局部排障。';
  if (topic.action === 'review_candidates') return '已有候选题未入库。门禁通过题会自动进入训练题库，其余题需要复审、修复、拒绝或归档。';
  if (topic.action === 'review_quality') return '已有题目进入训练，但质量信号提示需要复核。';
  return '当前知识点题库状态正常，暂时不需要处理。';
}

function topicBulkActionLabel(action: TopicBulkProgress['action']) {
  if (action === 'ensure_blueprint') return '批量生成蓝图';
  if (action === 'expand_candidates') return '局部批量追加';
  return '局部批量补题';
}

function generationQueueStatusLabel(status: string) {
  const labels: Record<string, string> = {
    idle: '空闲',
    healthy: '正常',
    queued: '待处理',
    retrying: '待重试',
    busy: '生成中',
    working: '生成中',
    needs_attention: '需要关注',
    blocked: '阻塞'
  };
  return labels[status] ?? status;
}

function generationQueueActionLabel(action: string) {
  const labels: Record<string, string> = {
    none: '无需操作',
    wait: '等待生成完成',
    process_queue: '处理生成队列',
    retry_failed: '重试失败任务',
    auto_retry_failed: '等待自动重试',
    review_failed: '检查失败任务',
    retry_stale: '重试卡住任务',
    inspect_provider: '检查 Provider',
    apply_syllabus: '先应用大纲',
    build_source_profile: '先生成真题画像',
    rebuild_target_profile: '重建出题画像',
    configure_provider: '配置 AI Provider'
  };
  return labels[action] ?? action;
}

type GenerationQueueJob = AdminAIQuestioningGenerationQueueHealth['recent'][number];

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compactHash(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > 10 ? `${text.slice(0, 10)}...` : text;
}

function generationJobObservabilityDetail(job: GenerationQueueJob) {
  const metadata = recordFrom(job.promptMetadata);
  const generationProfile = recordFrom(metadata.generationProfile);
  const targetProfile = recordFrom(metadata.targetProfile);
  const scope = recordFrom(metadata.scope);
  const lineage = [
    metadata.generationProfileId || generationProfile.id ? `画像 #${metadata.generationProfileId ?? generationProfile.id}` : '',
    metadata.seriesProfileId || generationProfile.seriesProfileId ? `趋势 #${metadata.seriesProfileId ?? generationProfile.seriesProfileId}` : '',
    metadata.profilePolicyVersion || generationProfile.profilePolicyVersion ? `策略 ${metadata.profilePolicyVersion ?? generationProfile.profilePolicyVersion}` : '',
    metadata.sourceSnapshotHash || generationProfile.sourceSnapshotHash ? `源 ${compactHash(metadata.sourceSnapshotHash ?? generationProfile.sourceSnapshotHash)}` : '',
    metadata.syllabusSnapshotHash || generationProfile.syllabusSnapshotHash ? `大纲 ${compactHash(metadata.syllabusSnapshotHash ?? generationProfile.syllabusSnapshotHash)}` : '',
    metadata.productionRunId ? `生产 #${metadata.productionRunId}` : '',
    metadata.productionCellId ? `cell #${metadata.productionCellId}` : '',
    metadata.targetUseCase || scope.targetUseCase ? `用途 ${metadata.targetUseCase ?? scope.targetUseCase}` : '',
    targetProfile.difficultyBand ? `难度 ${targetProfile.difficultyBand}` : '',
    `停止 ${job.governance.attemptCount}/${job.governance.maxAttempts}`
  ].filter(Boolean);
  return lineage.length ? lineage.join(' · ') : '画像版本未记录';
}

function generationJobFailureDetail(job: GenerationQueueJob) {
  const detail = [
    job.governance.failureCategory,
    job.governance.providerFailureCategory,
    job.error,
    `尝试 ${job.governance.attemptCount}/${job.governance.maxAttempts}`
  ].filter(Boolean);
  return detail.join(' · ');
}

function generationJobHasFailure(job: GenerationQueueJob) {
  return job.status === 'failed' || Boolean(job.error || job.governance.failureCategory || job.governance.providerFailureCategory);
}

function isRetryableGenerationFailureCategory(category: string | null | undefined) {
  return ![
    'blueprint_inactive',
    'syllabus_mismatch',
    'source_profile_missing',
    'source_profile_stale',
    'target_profile_incomplete',
    'subject_practice_no_progress'
  ].includes(String(category ?? ''));
}

function generationJobIsBlocked(job: GenerationQueueJob) {
  return job.status === 'failed' && (job.governance.attemptCount >= job.governance.maxAttempts || !isRetryableGenerationFailureCategory(job.governance.failureCategory));
}

function generationJobProgressLabel(job: GenerationQueueJob) {
  if (job.governance.failureCategory === 'stale_running_recovered') return '重启中断遗留任务：新版本会自动重新排队，若仍显示请重启后继续';
  if (job.governance.failureCategory === 'syllabus_mismatch') return '前置条件阻塞：需先应用该学科大纲';
  if (job.governance.failureCategory === 'source_profile_missing') return '前置条件阻塞：需先导入并生成该学科真题画像';
  if (job.governance.failureCategory === 'source_profile_stale') return '前置条件阻塞：真题画像已过期，需重新解析画像';
  if (job.governance.failureCategory === 'target_profile_incomplete') return '前置条件阻塞：出题画像不完整，需重建题位或缺口计划';
  if (job.governance.failureCategory === 'subject_practice_no_progress') return '自动补齐已暂停：连续多轮没有新增合格入库题，请先处理待治理候选或检查 Provider';
  if (generationJobIsBlocked(job)) return '已阻断';
  return `系统会自动重试 ${job.governance.attemptCount}/${job.governance.maxAttempts}`;
}

function generationQueueStatusText(
  status: string,
  summary: AdminAIQuestioningGenerationQueueHealth['summary']
) {
  const blocked = summary.blocked + summary.staleRunning;
  const retrying = Math.max(0, summary.failed - summary.blocked);
  if (blocked > 0) return '需要检查';
  if (summary.running > 0) return generationQueueStatusLabel(status);
  if (summary.queued > 0) return '待处理';
  if (retrying > 0) return '待自动重试';
  return generationQueueStatusLabel(status);
}

function generationQueueRecentJobs(jobs: GenerationQueueJob[]) {
  const failed = jobs.filter(generationJobHasFailure);
  const rest = jobs.filter((job) => !failed.some((failedJob) => failedJob.id === job.id));
  return [...failed, ...rest].slice(0, 5);
}

export type CoverageWorkPanelProps = {
  topicHealthItems: AdminAIQuestioningTopicHealth['items'];
  missingTopics: AdminAIQuestioningBlueprintCoverage['missingTopics'];
  bulkBlueprintTopics: AdminAIQuestioningTopicHealth['items'];
  bulkCandidateTopics: AdminAIQuestioningTopicHealth['items'];
  bulkExpansionTopics: AdminAIQuestioningTopicHealth['items'];
  generationQueue: AdminAIQuestioningGenerationQueueHealth;
  topicBulkProgress: TopicBulkProgress | null;
  subjectSelected: boolean;
  expandPerBlueprint: number;
  generationQueueActiveCount: number;
  generationQueueHasIssues: boolean;
  isActionBusy: (actionId: string) => boolean;
  onExpandPerBlueprintChange: (value: number) => void;
  onRunTopicBulk: (action: TopicBulkProgress['action'], topics: AdminAIQuestioningTopicHealth['items'], label: string) => void;
  onHandleTopicAction: (topic: AdminAIQuestioningTopicHealth['items'][number]) => void;
  onCleanupSubjectPracticeScope?: (topic?: AdminAIQuestioningTopicHealth['items'][number], includeApprovedAssets?: boolean) => void;
  legacyCandidateBulkDisabled?: boolean;
};

export function CoverageWorkPanel({
  topicHealthItems,
  missingTopics,
  bulkBlueprintTopics,
  bulkCandidateTopics,
  bulkExpansionTopics,
  generationQueue,
  topicBulkProgress,
  subjectSelected,
  expandPerBlueprint,
  generationQueueActiveCount,
  generationQueueHasIssues,
  isActionBusy,
  onExpandPerBlueprintChange,
  onRunTopicBulk,
  onHandleTopicAction,
  onCleanupSubjectPracticeScope,
  legacyCandidateBulkDisabled = true
}: CoverageWorkPanelProps) {
  const generationQueueSummary = generationQueue.summary;
  const generationQueueRetryingCount = Math.max(0, generationQueueSummary.failed - generationQueueSummary.blocked);
  const generationQueueBlockedCount = generationQueueSummary.blocked + generationQueueSummary.staleRunning;
  const generationQueueHasActiveWork = generationQueueSummary.queued + generationQueueSummary.running > 0;
  const visibleGenerationJobs = generationQueueRecentJobs(generationQueue.recent);

  return (
    <section className="admin-work-grid two admin-question-bank-coverage-section">
      <AdminPanel>
        <AdminPanelHeader kicker="知识点题库健康" title="局部排障队列">
          <p>主流程请使用上方生产计划；这里保留蓝图补齐、清理和单知识点排障工具，不再作为一次追加的完成标准。</p>
        </AdminPanelHeader>
        <div className="admin-topic-bulk-toolbar">
          <div className="admin-topic-bulk-summary">
            <strong>局部工具（非生产计划）</strong>
            <span>{subjectSelected ? `缺蓝图 ${bulkBlueprintTopics.length} 个 · 未达标知识点 ${bulkCandidateTopics.length} 个 · 可排障 ${bulkExpansionTopics.length} 个` : '请先选择学科；一次追加请使用上方科目训练生产计划'}</span>
          </div>
          <AdminActionBar className="admin-topic-bulk-actions">
            <button
              type="button"
              className={`ghost-button admin-topic-bulk-button${isActionBusy('topic-bulk-ensure_blueprint') ? ' is-loading' : ''}`}
              onClick={() => onRunTopicBulk('ensure_blueprint', bulkBlueprintTopics, '批量按大纲生成蓝图')}
              disabled={bulkBlueprintTopics.length === 0 || isActionBusy('topic-bulk-ensure_blueprint')}
              title={bulkBlueprintTopics.length === 0 ? '当前队列里没有缺出题蓝图的知识点' : '按当前加载队列补齐出题蓝图'}
            >
              {isActionBusy('topic-bulk-ensure_blueprint') ? '补齐蓝图中' : '补齐蓝图'}
            </button>
            <button
              type="button"
              className={`ghost-button admin-topic-bulk-button${isActionBusy('topic-bulk-generate_candidates') ? ' is-loading' : ''}`}
              onClick={() => onRunTopicBulk('generate_candidates', bulkCandidateTopics, '局部排障补题')}
              disabled={legacyCandidateBulkDisabled || !subjectSelected || bulkCandidateTopics.length === 0 || isActionBusy('topic-bulk-generate_candidates')}
              title={legacyCandidateBulkDisabled ? '一次追加已切换为上方生产计划；批量候选补题仅保留为底层排障能力' : !subjectSelected ? '请先在顶部选择学科' : bulkCandidateTopics.length === 0 ? '当前队列里没有合格题缺口' : '按当前加载队列补齐门禁通过的训练题'}
            >
              {isActionBusy('topic-bulk-generate_candidates') ? '局部补题中' : '局部补题'}
            </button>
            <label className="admin-topic-expand-control">
              <span>每个蓝图追加</span>
              <input
                type="number"
                min={1}
                max={10}
                value={expandPerBlueprint}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  onExpandPerBlueprintChange(Number.isInteger(value) ? Math.max(1, Math.min(10, value)) : 1);
                }}
              />
              <span>道</span>
            </label>
            <button
              type="button"
              className={`ghost-button admin-topic-bulk-button${isActionBusy('topic-bulk-expand_candidates') ? ' is-loading' : ''}`}
              onClick={() => onRunTopicBulk('expand_candidates', bulkExpansionTopics, '局部排障追加')}
              disabled={legacyCandidateBulkDisabled || !subjectSelected || bulkExpansionTopics.length === 0 || isActionBusy('topic-bulk-expand_candidates')}
              title={legacyCandidateBulkDisabled ? '一次追加已切换为上方生产计划；批量追加仅保留为底层排障能力' : !subjectSelected ? '请先在顶部选择学科' : bulkExpansionTopics.length === 0 ? '当前队列里没有可继续补齐的知识点' : '按当前加载队列继续补齐合格训练题'}
            >
              {isActionBusy('topic-bulk-expand_candidates') ? '局部追加中' : '局部追加'}
            </button>
            <button
              type="button"
              className={`ghost-button admin-topic-bulk-button${isActionBusy('subject-practice-cleanup') ? ' is-loading' : ''}`}
              onClick={() => onCleanupSubjectPracticeScope?.()}
              disabled={!subjectSelected || !onCleanupSubjectPracticeScope || isActionBusy('subject-practice-cleanup')}
              title={!subjectSelected ? '请先在顶部选择学科' : '清理当前学科未入库异常 AI 候选和生成任务，保留已入库训练题、已拒绝和已归档记录'}
            >
              {isActionBusy('subject-practice-cleanup') ? '清理中' : '清理当前学科未入库 AI 结果'}
            </button>
            <button
              type="button"
              className={`ghost-button admin-topic-bulk-button${isActionBusy('subject-practice-cleanup-all') ? ' is-loading' : ''}`}
              onClick={() => onCleanupSubjectPracticeScope?.(undefined, true)}
              disabled={!subjectSelected || !onCleanupSubjectPracticeScope || isActionBusy('subject-practice-cleanup-all')}
              title={!subjectSelected ? '请先在顶部选择学科' : '清理当前学科 AI 候选、生成任务和已入库 AI 训练题；需要输入确认文本'}
            >
              {isActionBusy('subject-practice-cleanup-all') ? '清理中' : '清理当前学科全部 AI 结果'}
            </button>
          </AdminActionBar>
          {topicBulkProgress && (
            <p className="admin-topic-bulk-progress">
              {topicBulkActionLabel(topicBulkProgress.action)}：
              知识点 {topicBulkProgress.completed}/{topicBulkProgress.total}
              {' · '}知识点成功 {topicBulkProgress.topicSucceeded}
              {' · '}失败 {topicBulkProgress.failed}
              {topicBulkProgress.action === 'generate_candidates' || topicBulkProgress.action === 'expand_candidates'
                ? ` · 优先修复 ${topicBulkProgress.repairFirstHandled} 道 · 原题修复 ${topicBulkProgress.repairFirstRepaired} 道 · 硬伤替代 ${topicBulkProgress.repairFirstRegenerated} 道 · 替代生成中 ${topicBulkProgress.repairFirstWaiting} 道 · 待治理旧候选 ${topicBulkProgress.repairFirstSkipped} 道 · 候选产出 ${topicBulkProgress.generated} · 已入队生成任务 ${topicBulkProgress.enqueued} · 跳过 ${topicBulkProgress.skipped} · 正式入库以知识点“已入库”数为准`
                : ` · 已生成蓝图 ${topicBulkProgress.topicSucceeded}`}
              {topicBulkProgress.currentTitle
                ? ` · 正在处理：${topicBulkProgress.currentTitle}`
                : topicBulkProgress.awaitingQueue
                  ? ' · 已入队，不代表已入库；请看服务器生成队列、正式入库数和异常候选治理'
                  : topicBulkProgress.failed > 0
                    ? ' · 已完成，存在失败项'
                    : ' · 已完成'}
            </p>
          )}
          <AdminOperationStatus
            title="服务器生成队列"
            status={generationQueueStatusText(generationQueue.status, generationQueueSummary)}
            action={generationQueueActionLabel(generationQueue.recommendedAction)}
            tone={generationQueueHasIssues ? 'warning' : generationQueueActiveCount > 0 ? 'working' : 'neutral'}
            metrics={[
              { key: 'queued', label: '排队', value: generationQueueSummary.queued },
              { key: 'running', label: '运行', value: generationQueueSummary.running },
              { key: 'succeeded', label: '已生成', value: generationQueueSummary.succeeded, tone: 'success' },
              { key: 'retrying', label: generationQueueHasActiveWork ? '自动重试' : '待重试', value: generationQueueRetryingCount, hidden: generationQueueRetryingCount <= 0, tone: generationQueueHasActiveWork ? 'working' : 'warning' },
              { key: 'failed', label: '失败', value: generationQueueSummary.failed, hidden: generationQueueRetryingCount > 0 && generationQueueBlockedCount === 0, tone: generationQueueSummary.failed > 0 ? 'warning' : 'neutral' },
              { key: 'blocked', label: '阻塞', value: generationQueueSummary.blocked, hidden: generationQueueSummary.blocked <= 0, tone: 'danger' },
              { key: 'stale', label: '卡住', value: generationQueueSummary.staleRunning, hidden: generationQueueSummary.staleRunning <= 0, tone: 'danger' }
            ]}
            recent={visibleGenerationJobs.map((job) => ({
              key: job.id,
              label: (
                <>
                  #{job.id} {job.topicTitle}
                </>
              ),
              detail: generationJobHasFailure(job)
                ? `${statusLabel(job.status)} · ${generationJobFailureDetail(job)} · ${generationJobProgressLabel(job)} · ${generationJobObservabilityDetail(job)}`
                : `${statusLabel(job.status)}${job.questionId ? ` · Q${job.questionId}` : ''} · ${generationJobObservabilityDetail(job)}`
            }))}
            recentLabel={generationQueueHasIssues ? '阻断原因' : generationQueueSummary.failed > 0 ? '待重试记录' : '最近任务'}
          />
        </div>
        <div className="admin-list compact admin-topic-health-list">
          {topicHealthItems.map((topic) => {
            const topicActionId = `topic-${topic.topicId}-${topic.action}`;
            const topicActionBusy = isActionBusy(topicActionId);
            const legacyCandidateAction = topic.action === 'generate_candidates' || topic.action === 'expand_candidates';
            const canClickTopicAction = topic.action !== 'monitor' && !(legacyCandidateBulkDisabled && legacyCandidateAction);
            const targetPracticeCount = topic.targetPracticeCount ?? topic.questionGap?.targetCount ?? topic.bridgeQuestionCount;
            const approvedPracticeCount = topic.approvedPracticeCount ?? topic.bridgeQuestionCount;
            const openGapCount = topic.openGapCount ?? Math.max(0, targetPracticeCount - approvedPracticeCount);
            const difficultyPlan = topic.questionGap?.difficultyPlan ?? [];
            const profileStatusLabel = topic.profileStatus === 'available'
              ? '真题画像可用'
              : topic.profileStatus === 'incomplete_profile'
                ? '画像维度不完整'
                : '缺真题画像';
            const fulfillmentBlocked = topic.subjectPracticeFulfillment?.status === 'blocked';
            return (
              <div key={topic.topicId} className="process-row admin-data-row">
                <span>{topicHealthStatusLabel(topic.status)}</span>
                <div>
                  <strong>{topic.title}</strong>
                  <p>来源：CSCA {subjectDisplayName(topic.subject)}大纲 {topic.syllabusVersion} · {topic.code} · {topic.module || '未分模块'}</p>
                  <p>{topicActionHint(topic)}</p>
                  {fulfillmentBlocked && (
                    <p className="admin-topic-warning">
                      自动补齐已暂停：{topic.subjectPracticeFulfillment?.message || '连续多轮没有新增合格入库题，请先处理待治理候选或检查 Provider。'}
                    </p>
                  )}
                  <p>
                    出题蓝图 {topic.activeBlueprintCount}/{topic.blueprintCount} · 目标合格题 {targetPracticeCount} · 已入库 {approvedPracticeCount} · 还差 {openGapCount} · 待治理 {topic.pendingReviewCount} · 候选题 {topic.candidateCount} · {profileStatusLabel} · 作答 {topic.attemptCount}
                  </p>
                  {difficultyPlan.length > 0 && (
                    <p>
                      难度配额：{difficultyPlan.map((item) => (
                        `${difficultyLabel(item.difficultyBand)} ${item.currentCount}/${item.targetCount}${item.neededCount > 0 ? ` 缺${item.neededCount}` : ''}`
                      )).join(' · ')}
                    </p>
                  )}
                  {topic.questionGap && topic.questionGap.gaps.length > 0 && (
                    <p>
                      缺题画像：{topic.questionGap.gaps.slice(0, 2).map((gap) => (
                        `${gap.neededCount}题 ${difficultyLabel(gap.difficultyBand)}/${gap.questionForm}/${gap.cognitiveSkill}/阅读${gap.readingLoad}/计算${gap.calculationLoad} · ${gap.gapKey}`
                      )).join('；')}
                    </p>
                  )}
                  {topic.profileIssueReasons && topic.profileIssueReasons.length > 0 && (
                    <p className="admin-topic-warning">
                      画像缺失维度：{topic.profileIssueReasons.slice(0, 5).join('、')}
                    </p>
                  )}
                </div>
                {canClickTopicAction ? (
                  <div className="admin-inline-actions">
                    <button
                      type="button"
                      className={`ghost-button${topicActionBusy ? ' admin-action-loading' : ''}`}
                      onClick={() => onHandleTopicAction(topic)}
                      disabled={topicActionBusy}
                    >
                      {topicActionBusy && <span className="admin-button-spinner" aria-hidden="true" />}
                      {topicActionBusy ? topicActionBusyLabel(topic.action) : topicActionLabel(topic.action)}
                    </button>
                    {onCleanupSubjectPracticeScope && (
                      <>
                        <button
                          type="button"
                          className={`ghost-button${isActionBusy(`subject-practice-cleanup-${topic.topicId}`) ? ' admin-action-loading' : ''}`}
                          onClick={() => onCleanupSubjectPracticeScope(topic)}
                          disabled={isActionBusy(`subject-practice-cleanup-${topic.topicId}`)}
                          title="只清理这个知识点未入库异常 AI 候选和生成任务，保留已入库训练题、已拒绝和已归档记录"
                        >
                          {isActionBusy(`subject-practice-cleanup-${topic.topicId}`) ? '清理中' : '清理本知识点'}
                        </button>
                        <button
                          type="button"
                          className={`ghost-button${isActionBusy(`subject-practice-cleanup-all-${topic.topicId}`) ? ' admin-action-loading' : ''}`}
                          onClick={() => onCleanupSubjectPracticeScope(topic, true)}
                          disabled={isActionBusy(`subject-practice-cleanup-all-${topic.topicId}`)}
                          title="清理这个知识点 AI 候选、生成任务和已入库 AI 训练题；需要输入确认文本"
                        >
                          {isActionBusy(`subject-practice-cleanup-all-${topic.topicId}`) ? '清理中' : '清理含已入库'}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="admin-inline-actions">
                    <span className="admin-inline-status">
                      {legacyCandidateBulkDisabled && legacyCandidateAction ? '请用上方生产计划' : '无需处理'}
                    </span>
                    {onCleanupSubjectPracticeScope && (
                      <>
                        <button
                          type="button"
                          className={`ghost-button${isActionBusy(`subject-practice-cleanup-${topic.topicId}`) ? ' admin-action-loading' : ''}`}
                          onClick={() => onCleanupSubjectPracticeScope(topic)}
                          disabled={isActionBusy(`subject-practice-cleanup-${topic.topicId}`)}
                          title="只清理这个知识点未入库异常 AI 候选和生成任务，保留已入库训练题、已拒绝和已归档记录"
                        >
                          {isActionBusy(`subject-practice-cleanup-${topic.topicId}`) ? '清理中' : '清理本知识点'}
                        </button>
                        <button
                          type="button"
                          className={`ghost-button${isActionBusy(`subject-practice-cleanup-all-${topic.topicId}`) ? ' admin-action-loading' : ''}`}
                          onClick={() => onCleanupSubjectPracticeScope(topic, true)}
                          disabled={isActionBusy(`subject-practice-cleanup-all-${topic.topicId}`)}
                          title="清理这个知识点 AI 候选、生成任务和已入库 AI 训练题；需要输入确认文本"
                        >
                          {isActionBusy(`subject-practice-cleanup-all-${topic.topicId}`) ? '清理中' : '清理含已入库'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {topicHealthItems.length === 0 && (
            <p className="form-hint">当前没有可处理的知识点。AI 出题必须先上传并应用该学科大纲；未应用大纲的学科不会进入蓝图和候选生成流程。</p>
          )}
        </div>
      </AdminPanel>

      <AdminPanel>
        <AdminPanelHeader kicker="蓝图缺口" title={`${missingTopics.length} 个知识点`} />
        <div className="admin-list compact">
          {missingTopics.slice(0, 10).map((topic) => (
            <div key={topic.id}>
              <strong>{topic.title}</strong>
              <span>{topic.subject} · {topic.code} · {topic.module || '-'} · {topic.syllabusVersion}</span>
            </div>
          ))}
          {missingTopics.length === 0 && (
            <p className="form-hint">当前没有可补蓝图的知识点。若你还没上传该学科大纲，请先在 1 大纲基线里上传并应用，大纲生效后才会出现蓝图缺口。</p>
          )}
        </div>
      </AdminPanel>
    </section>
  );
}
