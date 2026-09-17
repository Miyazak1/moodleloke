import {
  AdminOperationStatus,
  AdminPanel,
  AdminPanelHeader
} from '../AdminWorkbench';
import type { AdminAIQuestioningCandidateBulkTask, AdminAIQuestioningGenerationQueueHealth } from '../../../lib/api-types';
import type { CandidateBulkProgress } from './candidateBulkActions';
import type { TopicBulkProgress } from './CoverageWorkPanel';

type QuestionBankTaskStatusProps = {
  isLoading: boolean;
  busyActions: Set<string>;
  generationQueue: AdminAIQuestioningGenerationQueueHealth;
  topicBulkProgress: TopicBulkProgress | null;
  candidateBulkProgress: CandidateBulkProgress | null;
  candidateBulkTasks: AdminAIQuestioningCandidateBulkTask[];
  generationQueuePollingError?: string | null;
  suppressGenerationQueue?: boolean;
  queueSubject?: string;
  queueUseCase?: string;
};

function recordFrom(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function compactHash(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const hash = value.trim();
  return hash.length > 10 ? hash.slice(0, 10) : hash;
}

function generationJobObservabilityDetail(job: GenerationQueueJob) {
  const metadata = recordFrom(job.promptMetadata);
  const generationProfile = recordFrom(metadata.generationProfile);
  const targetProfile = recordFrom(metadata.targetProfile);
  const scope = recordFrom(metadata.scope);
  const sourceHash = compactHash(metadata.sourceSnapshotHash ?? generationProfile.sourceSnapshotHash);
  const syllabusHash = compactHash(metadata.syllabusSnapshotHash ?? generationProfile.syllabusSnapshotHash);
  const lineage = [
    metadata.generationProfileId || generationProfile.id ? `画像 #${metadata.generationProfileId ?? generationProfile.id}` : '',
    metadata.seriesProfileId || generationProfile.seriesProfileId ? `趋势 #${metadata.seriesProfileId ?? generationProfile.seriesProfileId}` : '',
    metadata.profilePolicyVersion || generationProfile.profilePolicyVersion ? `策略 ${metadata.profilePolicyVersion ?? generationProfile.profilePolicyVersion}` : '',
    sourceHash ? `源 ${sourceHash}` : '',
    syllabusHash ? `大纲 ${syllabusHash}` : '',
    metadata.productionRunId ? `生产 #${metadata.productionRunId}` : '',
    metadata.productionCellId ? `cell #${metadata.productionCellId}` : '',
    metadata.targetUseCase || scope.targetUseCase ? `用途 ${metadata.targetUseCase ?? scope.targetUseCase}` : '',
    targetProfile.difficultyBand ? `难度 ${targetProfile.difficultyBand}` : '',
    `停止 ${job.governance.attemptCount}/${job.governance.maxAttempts}`
  ].filter(Boolean);
  return lineage.length ? lineage.join(' · ') : '画像版本未记录';
}

function topicBulkActionLabel(action: TopicBulkProgress['action']) {
  if (action === 'ensure_blueprint') return '批量补蓝图';
  if (action === 'expand_candidates') return '局部排障追加';
  return '局部排障补题';
}

function candidateBulkActionLabel(action: CandidateBulkProgress['action']) {
  const labels: Record<CandidateBulkProgress['action'], string> = {
    review: '批量复审',
    approve: '批量通过',
    reject: '批量拒绝',
    archive: '批量归档'
  };
  return labels[action] ?? action;
}

function generationQueueActionLabel(action: string) {
  const labels: Record<string, string> = {
    monitor: '继续观察',
    process_queue: '处理生成队列',
    retry_failed: '重试失败任务',
    auto_retry_failed: '等待自动重试',
    inspect_provider: '检查 Provider',
    apply_syllabus: '先应用大纲',
    build_source_profile: '先生成真题画像',
    rebuild_target_profile: '重建出题画像',
    review_failed: '检查失败任务',
    retry_stale: '重试卡住任务',
    configure_provider: '配置 AI Provider',
    none: '无需操作',
    wait: '等待生成完成'
  };
  return labels[action] ?? action;
}

function subjectScopeLabel(subject?: string) {
  const value = String(subject ?? '').trim();
  const labels: Record<string, string> = {
    math: '数学',
    physics: '物理',
    chemistry: '化学'
  };
  return labels[value] ?? (value || '全部学科');
}

function useCaseScopeLabel(useCase?: string) {
  if (useCase === 'online_mock_exam') return '在线模考';
  return '科目训练';
}

function busyActionLabel(actionId: string) {
  if (actionId === 'refresh') return '刷新数据';
  if (actionId.startsWith('candidate-bulk-all-')) return '候选筛选批量';
  if (actionId.startsWith('candidate-bulk-')) return '候选已选批量';
  if (actionId.startsWith('topic-bulk-')) return '知识点批量';
  if (actionId.startsWith('quality-bulk-')) return '质量批量';
  if (actionId.startsWith('source-document-reprocess')) return '真题文档重跑';
  if (actionId.startsWith('source-question-auto-profile-retry')) return '真题自动画像重试';
  if (actionId.startsWith('source-question-auto-profile')) return '真题自动画像';
  if (actionId.startsWith('source-question-topic-suggest')) return '真题自动映射';
  if (actionId.startsWith('source-question-topic-auto-profile')) return '真题自动映射入画像';
  if (actionId.startsWith('source-question-topic-apply-high')) return '真题自动纳入画像';
  if (actionId.startsWith('source-question-map')) return '真题自动映射记录';
  if (actionId.startsWith('source-question-review')) return '真题自动样本确认';
  if (actionId.startsWith('source-reference')) return '真题导入';
  if (actionId.startsWith('style-profile')) return '真题画像';
  if (actionId.startsWith('misconception')) return '错因治理';
  if (actionId.startsWith('concept-card')) return '概念卡';
  return actionId;
}

function uniqueLabels(actionIds: string[]) {
  return Array.from(new Set(actionIds.map(busyActionLabel))).slice(0, 5);
}

function isTopicBulkActive(progress: TopicBulkProgress | null) {
  return Boolean(progress?.currentTitle || progress?.awaitingQueue);
}

function isTopicBulkVisible(progress: TopicBulkProgress | null) {
  return Boolean(progress && (isTopicBulkActive(progress) || progress.failed > 0));
}

function isCandidateBulkActive(progress: CandidateBulkProgress | null) {
  return Boolean(progress?.currentQuestionId);
}

function isCandidateBulkVisible(progress: CandidateBulkProgress | null) {
  return Boolean(progress && (isCandidateBulkActive(progress) || progress.failed > 0 || progress.skipped > 0 || (progress.failureMessages?.length ?? 0) > 0));
}

function taskStatusLabel(task: AdminAIQuestioningCandidateBulkTask) {
  if (task.status === 'queued') return '排队中';
  if (task.status === 'running') return '运行中';
  if (task.status === 'failed') return '失败';
  return task.failed > 0 ? '完成，有失败项' : '完成';
}

function taskTone(task: AdminAIQuestioningCandidateBulkTask) {
  if (task.status === 'failed' || task.failed > 0) return 'warning';
  if (task.status === 'queued' || task.status === 'running') return 'working';
  return 'success';
}

function isCandidateGenerationBulk(progress: TopicBulkProgress | null) {
  return progress?.action === 'generate_candidates' || progress?.action === 'expand_candidates';
}

function topicBulkStatus(
  progress: TopicBulkProgress,
  queue: AdminAIQuestioningGenerationQueueHealth['summary']
) {
  if (progress.currentTitle) return `正在处理：${progress.currentTitle}`;
  if (progress.action === 'ensure_blueprint') {
    if (progress.failed > 0) return '蓝图生成完成，有失败项';
    return '蓝图生成完成';
  }
  if (progress.failed > 0 && progress.enqueued === 0) return '提交失败，未入队';
  if (progress.awaitingQueue) {
    if (queue.failed > 0) return '已入队，生成中有失败项';
    if (queue.queued + queue.running > 0) return '已入队，服务器生成中';
    return '已入队，等待服务器生成';
  }
  if (progress.enqueued > 0) {
    if (queue.failed > 0 && queue.queued + queue.running > 0) return '部分生成失败，仍在生成';
    if (queue.failed > 0) return '生成队列有失败项';
    if (queue.queued + queue.running > 0) return '服务器生成中';
    return '生成队列已结束';
  }
  if (progress.failed > 0) return '已完成，存在失败项';
  return '已完成';
}

function topicBulkRecent(
  progress: TopicBulkProgress,
  queue: AdminAIQuestioningGenerationQueueHealth['summary']
) {
  if (!isCandidateGenerationBulk(progress)) return undefined;
  const items = [
    {
      key: 'submitted',
      label: `批量动作：${progress.topicSucceeded} 个知识点提交成功，${progress.enqueued} 个生成任务已排队，已生成候选题 ${progress.generated} 道`
    }
  ];
  if (progress.repairFirstHandled > 0) {
    items.push({
      key: 'repair-first',
      label: `修复优先：已先处理 ${progress.repairFirstHandled} 道旧候选，直接入库 ${progress.repairFirstApproved} 道，原题修复 ${progress.repairFirstRepaired} 道，硬伤替代 ${progress.repairFirstRegenerated} 道`
    });
  }
  if (progress.repairFirstWaiting > 0) {
    items.push({
      key: 'repair-first-waiting',
      label: `修复优先：${progress.repairFirstWaiting} 道硬伤候选的替代生成任务正在排队或运行`
    });
  } else if (progress.repairFirstSkipped > 0) {
    items.push({
      key: 'repair-first-attention',
      label: `修复优先：发现 ${progress.repairFirstSkipped} 道旧候选暂未能自动处理，已暂停继续追加新候选`
    });
  }
  if (progress.enqueued > 0) {
    if (queue.queued + queue.running > 0) {
      items.push({
        key: 'queue-active',
        label: `生成队列：${queue.running} 个生成中，${queue.queued} 个排队`
      });
    }
    if (queue.failed > 0) {
      items.push({
        key: 'queue-failed',
        label: `生成异常：${queue.failed} 个任务失败；系统会自动重试，若达到阻塞请检查 Provider`
      });
    }
    if (queue.queued + queue.running === 0 && queue.failed === 0) {
      items.push({
        key: 'queue-settled',
        label: '生成队列已结束；新题会进入候选审核队列'
      });
    }
    if (progress.generated === 0) {
      items.push({
        key: 'candidate-note',
        label: '新候选为 0 表示当前面板还没有看到新增候选；最终以合格题入库数量为准'
      });
    }
  }
  return items;
}

type GenerationQueueJob = AdminAIQuestioningGenerationQueueHealth['recent'][number];

function generationJobStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: '排队中',
    running: '生成中',
    succeeded: '已生成',
    failed: '失败',
    archived: '已归档'
  };
  return labels[status] ?? status;
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

function generationJobFailureDetail(job: GenerationQueueJob) {
  const suffix = job.governance.failureCategory === 'syllabus_mismatch'
    ? '前置条件阻塞：需先应用该学科大纲'
    : job.governance.failureCategory === 'stale_running_recovered'
      ? '重启中断遗留任务：新版本会自动重新排队，若仍显示请重启后继续'
      : job.governance.failureCategory === 'source_profile_missing'
        ? '前置条件阻塞：需先导入并生成该学科真题画像'
        : job.governance.failureCategory === 'source_profile_stale'
          ? '前置条件阻塞：真题画像已过期，需重新解析画像'
          : job.governance.failureCategory === 'target_profile_incomplete'
            ? '前置条件阻塞：出题画像不完整，需重建题位或缺口计划'
            : job.governance.failureCategory === 'subject_practice_no_progress'
              ? '自动补齐已暂停：连续多轮没有新增合格入库题，请先处理待治理候选或检查 Provider'
              : generationJobIsBlocked(job)
                ? '已阻断'
                : `自动重试 ${job.governance.attemptCount}/${job.governance.maxAttempts}`;
  const detail = [
    job.governance.failureCategory,
    job.governance.providerFailureCategory,
    job.error,
    suffix
  ].filter(Boolean);
  return detail.join(' · ');
}

function generationQueueRecentJobs(jobs: GenerationQueueJob[]) {
  const failed = jobs.filter(generationJobHasFailure);
  const rest = jobs.filter((job) => !failed.some((failedJob) => failedJob.id === job.id));
  return [...failed, ...rest].slice(0, 5);
}

export function QuestionBankTaskStatus({
  isLoading,
  busyActions,
  generationQueue,
  topicBulkProgress,
  candidateBulkProgress,
  candidateBulkTasks,
  generationQueuePollingError,
  suppressGenerationQueue = false,
  queueSubject,
  queueUseCase
}: QuestionBankTaskStatusProps) {
  const queue = generationQueue.summary;
  const queueActive = suppressGenerationQueue ? 0 : queue.queued + queue.running;
  const queueBlocked = suppressGenerationQueue ? 0 : queue.blocked + queue.staleRunning;
  const queueRetrying = suppressGenerationQueue ? 0 : Math.max(0, queue.failed - queue.blocked);
  const queueStatus = queue.running > 0
    ? '运行中'
    : queue.queued > 0
      ? '待处理'
      : queueBlocked > 0
        ? '需要检查'
        : queueRetrying > 0
          ? (queueActive > 0 ? '自动重试中' : '待自动重试')
          : '空闲';
  const queueRetryStatus = queueActive > 0 ? '自动重试中' : '待自动重试';
  const queueRetryMetricLabel = queueActive > 0 ? '自动重试' : '待重试';
  const queueIssues = suppressGenerationQueue ? 0 : queue.failed + queueBlocked;
  const busyActionIds = Array.from(busyActions);
  const hasTopicBulk = isTopicBulkVisible(topicBulkProgress);
  const hasCandidateBulk = isCandidateBulkVisible(candidateBulkProgress);
  const latestCandidateTask = candidateBulkTasks[0] ?? null;
  const hasCandidateTask = Boolean(latestCandidateTask);
  const hasWork = isLoading || busyActionIds.length > 0 || queueActive > 0 || queueIssues > 0 || hasTopicBulk || hasCandidateBulk || hasCandidateTask || Boolean(!suppressGenerationQueue && generationQueuePollingError);
  const topicBulkHasGenerationIssues = Boolean(topicBulkProgress && isCandidateGenerationBulk(topicBulkProgress) && topicBulkProgress.enqueued > 0 && queueBlocked > 0);
  const visibleGenerationJobs = suppressGenerationQueue ? [] : generationQueueRecentJobs(generationQueue.recent);
  const queueScopeText = `${subjectScopeLabel(queueSubject)} · ${useCaseScopeLabel(queueUseCase)}`;

  if (!hasWork) return null;

  const topicStatus = topicBulkProgress ? topicBulkStatus(topicBulkProgress, queue) : undefined;
  const candidateStatus = candidateBulkProgress
    ? candidateBulkProgress.currentQuestionId
      ? `正在处理 Q${candidateBulkProgress.currentQuestionId}`
      : candidateBulkProgress.failed > 0 || (candidateBulkProgress.failureMessages?.length ?? 0) > 0
        ? '已完成，存在失败项'
        : candidateBulkProgress.skipped > 0
          ? '已完成，部分题被跳过'
        : '已完成'
    : undefined;
  const tone = (!suppressGenerationQueue && generationQueuePollingError) || queueBlocked > 0 || (candidateBulkProgress?.failed ?? 0) > 0 || (topicBulkProgress?.failed ?? 0) > 0
    ? 'warning'
    : 'working';

  return (
    <AdminPanel className="admin-question-bank-task-status">
      <AdminPanelHeader kicker="任务状态" title="当前处理进度">
        <p>这里汇总正在运行的批量动作和后台队列。</p>
      </AdminPanelHeader>
      <div className="admin-question-bank-task-status__grid">
        {!suppressGenerationQueue && (
          <AdminOperationStatus
            title={`后台生成队列（${queueScopeText}）`}
            status={queueStatus}
            action={generationQueueActionLabel(generationQueue.recommendedAction)}
            tone={generationQueuePollingError || queueBlocked > 0 || (queueRetrying > 0 && queueActive <= 0) ? 'warning' : queueActive > 0 || queueRetrying > 0 ? 'working' : 'neutral'}
            metrics={[
              { key: 'queued', label: '排队', value: queue.queued },
              { key: 'running', label: '生成中', value: queue.running },
              { key: 'retrying', label: queueRetryMetricLabel, value: queueRetrying, hidden: queueRetrying <= 0, tone: queueActive > 0 ? 'working' : 'warning' },
              { key: 'failed', label: '失败', value: queue.failed, hidden: queueRetrying > 0 && queueBlocked === 0, tone: queue.failed > 0 ? 'warning' : 'neutral' },
              { key: 'blocked', label: '阻塞', value: queueBlocked, tone: queueBlocked > 0 ? 'warning' : 'neutral' }
            ]}
            recent={generationQueuePollingError
              ? [{ key: 'polling-error', label: generationQueuePollingError }]
              : visibleGenerationJobs.map((job) => ({
                key: job.id,
                label: (
                  <>
                    #{job.id} {job.topicTitle}
                  </>
                ),
                detail: generationJobHasFailure(job)
                  ? `${generationJobStatusLabel(job.status)} · ${generationJobFailureDetail(job)} · ${generationJobObservabilityDetail(job)}`
                  : `${generationJobStatusLabel(job.status)}${job.questionId ? ` · Q${job.questionId}` : ''} · ${generationJobObservabilityDetail(job)}`
              }))}
            recentLabel={generationQueuePollingError ? '状态刷新' : queueBlocked > 0 ? '阻断原因' : queueRetrying > 0 ? '待重试记录' : '最近任务'}
          />
        )}
        {hasTopicBulk && topicBulkProgress && (
          <AdminOperationStatus
            title={topicBulkActionLabel(topicBulkProgress.action)}
            status={topicStatus}
            tone={topicBulkProgress.failed > 0 || topicBulkHasGenerationIssues ? 'warning' : isTopicBulkActive(topicBulkProgress) ? tone : 'success'}
            metrics={[
              { key: 'topics', label: '知识点', value: `${topicBulkProgress.completed}/${topicBulkProgress.total}` },
              { key: 'success', label: '知识点成功', value: topicBulkProgress.topicSucceeded, tone: topicBulkProgress.topicSucceeded > 0 ? 'success' : 'neutral' },
              { key: 'repair-first', label: '优先修复', value: topicBulkProgress.repairFirstHandled, hidden: topicBulkProgress.action === 'ensure_blueprint' || topicBulkProgress.repairFirstHandled <= 0, tone: 'success' },
              { key: 'repair-regenerate', label: '硬伤替代', value: topicBulkProgress.repairFirstRegenerated, hidden: topicBulkProgress.action === 'ensure_blueprint' || topicBulkProgress.repairFirstRegenerated <= 0, tone: 'working' },
              { key: 'generated', label: '新候选', value: topicBulkProgress.generated, hidden: topicBulkProgress.action === 'ensure_blueprint' },
              { key: 'enqueued', label: '生成任务', value: topicBulkProgress.enqueued, hidden: topicBulkProgress.action === 'ensure_blueprint' },
              { key: 'failed', label: '失败', value: topicBulkProgress.failed, tone: topicBulkProgress.failed > 0 ? 'warning' : 'neutral' },
              { key: 'skipped', label: '跳过', value: topicBulkProgress.skipped }
            ]}
            recent={topicBulkRecent(topicBulkProgress, queue)}
            recentLabel="结果说明"
          />
        )}
        {hasCandidateBulk && candidateBulkProgress && (
          <AdminOperationStatus
            title={candidateBulkActionLabel(candidateBulkProgress.action)}
            status={candidateStatus}
            tone={(candidateBulkProgress.failed > 0 || candidateBulkProgress.failureMessages?.length) ? 'warning' : isCandidateBulkActive(candidateBulkProgress) ? 'working' : 'success'}
            metrics={[
              { key: 'questions', label: '题目', value: `${candidateBulkProgress.completed}/${candidateBulkProgress.total}` },
              { key: 'success', label: '处理成功', value: candidateBulkProgress.succeeded, tone: candidateBulkProgress.succeeded > 0 ? 'success' : 'neutral' },
              { key: 'failed', label: '失败', value: candidateBulkProgress.failed, tone: candidateBulkProgress.failed > 0 ? 'warning' : 'neutral' },
              { key: 'skipped', label: '跳过', value: candidateBulkProgress.skipped }
            ]}
            recent={candidateBulkProgress.failureMessages?.slice(0, 3).map((message, index) => ({
              key: `${index}-${message}`,
              label: message
            }))}
            recentLabel="失败原因"
          />
        )}
        {hasCandidateTask && latestCandidateTask && (
          <AdminOperationStatus
            title={`${candidateBulkActionLabel(latestCandidateTask.action as CandidateBulkProgress['action'])}后台任务`}
            status={taskStatusLabel(latestCandidateTask)}
            tone={taskTone(latestCandidateTask)}
            metrics={[
              { key: 'requested', label: '范围', value: latestCandidateTask.requested },
              { key: 'success', label: '处理成功', value: latestCandidateTask.succeeded, tone: latestCandidateTask.succeeded > 0 ? 'success' : 'neutral' },
              { key: 'failed', label: '失败', value: latestCandidateTask.failed, tone: latestCandidateTask.failed > 0 ? 'warning' : 'neutral' },
              { key: 'skipped', label: '跳过', value: latestCandidateTask.skipped }
            ]}
            recent={[
              { key: latestCandidateTask.id, label: `任务 ${latestCandidateTask.id.slice(0, 8)} · ${latestCandidateTask.queue || '当前筛选'}${latestCandidateTask.gateScope ? ` · ${latestCandidateTask.gateScope}` : ''}` },
              ...(latestCandidateTask.error ? [{ key: 'error', label: latestCandidateTask.error }] : [])
            ]}
            recentLabel="后台记录"
          />
        )}
        {(isLoading || busyActionIds.length > 0) && (
          <AdminOperationStatus
            title="页面操作"
            status={isLoading ? '刷新中' : '执行中'}
            tone="working"
            metrics={[
              { key: 'active', label: '动作', value: busyActionIds.length || 1 }
            ]}
            recent={uniqueLabels(busyActionIds).map((label) => ({ key: label, label }))}
            recentLabel="正在执行"
          />
        )}
      </div>
    </AdminPanel>
  );
}
