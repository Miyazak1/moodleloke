import {
  AdminActionBar,
  AdminButton,
  AdminPanel,
  AdminPanelHeader,
  AdminStatsStrip
} from '../AdminWorkbench';
import type {
  AdminMockExamBlueprintDetail,
  AdminMockExamBlueprintSlot,
  AdminMockExamGenerationJob,
  AdminMockExamPaper,
  MockExamSubjectId
} from '../../../lib/api-types';

const SUBJECT_LABELS: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学'
};

function subjectLabel(subject: string) {
  return SUBJECT_LABELS[subject] ?? subject;
}

function isHistoricalSyllabusFailure(issue: unknown) {
  return String(issue ?? '').includes('当前学科还没有已应用的大纲');
}

function hasReadyMappedSlots(slots: AdminMockExamBlueprintSlot[]) {
  return slots.some((slot) => slot.status === 'ready' && Array.isArray(slot.topicIds) && slot.topicIds.length > 0);
}

function recordFrom(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function blueprintSourceStyleProfile(blueprint: AdminMockExamBlueprintDetail['blueprint'] | null) {
  const profile = recordFrom(blueprint?.profile);
  return recordFrom(profile?.sourceStyleProfile);
}

function blueprintHasSourceStyleProfile(blueprint: AdminMockExamBlueprintDetail['blueprint'] | null) {
  const explicitIds = blueprint?.sourceProfileIds ?? [];
  return explicitIds.length > 0 || Boolean(blueprintSourceStyleProfile(blueprint)?.id);
}

function visibleJobSlotResults(job: AdminMockExamGenerationJob, slots: AdminMockExamBlueprintSlot[]) {
  const shouldHideHistoricalFailures = ['running', 'failed'].includes(job.status) && hasReadyMappedSlots(slots);
  return job.slotResults.map((slot) => {
    const issues = Array.isArray(slot.issues) ? slot.issues : [];
    if (shouldHideHistoricalFailures && slot.status === 'failed' && issues.some(isHistoricalSyllabusFailure)) {
      return { ...slot, status: 'queued', issues: [] };
    }
    return slot;
  });
}

function jobCandidates(job: AdminMockExamGenerationJob, slots: AdminMockExamBlueprintSlot[] = []) {
  return visibleJobSlotResults(job, slots).filter((slot) => Boolean(slot.candidateQuestionId)).length;
}

function jobApprovedCandidates(job: AdminMockExamGenerationJob, slots: AdminMockExamBlueprintSlot[] = []) {
  return visibleJobSlotResults(job, slots).filter((slot) => (
    Boolean(slot.candidateQuestionId) && ['approved', 'assembled'].includes(String(slot.status ?? ''))
  )).length;
}

function jobRequiredCount(job: AdminMockExamGenerationJob, blueprint: AdminMockExamBlueprintDetail['blueprint'] | null) {
  return job.requestedSlotNumbers.length || blueprint?.questionCount || job.slotResults.length;
}

function jobCompletionText(job: AdminMockExamGenerationJob, slots: AdminMockExamBlueprintSlot[], blueprint: AdminMockExamBlueprintDetail['blueprint'] | null) {
  const required = jobRequiredCount(job, blueprint);
  const approved = jobApprovedCandidates(job, slots);
  const missing = Math.max(0, required - approved);
  const diagnostic = jobDiagnosticText(job);
  if (!required) return '整卷门槛：未创建题位';
  if (missing === 0 && job.targetPaperId) return `整卷完成：${approved}/${required} 已通过门禁，已自动装配并发布为套卷 #${job.targetPaperId}`;
  if (missing === 0) return `整卷完成：${approved}/${required} 已通过门禁；系统会自动装配并发布，历史任务可手动补救装配`;
  if (['queued', 'running'].includes(job.status)) {
    return `自动补齐中：${approved}/${required} 已入库，还差 ${missing} 题；${diagnostic || `系统会继续生成、优化并复审，直到 ${required}/${required}`}`;
  }
  if (job.status === 'needs_attention') return `自动补齐已暂停：${approved}/${required} 已入库，还差 ${missing} 题；请查看题位原因后重新生成或清理重建。`;
  if (job.status === 'assembly_blocked') return `整卷装配/发布失败：${approved}/${required} 已入库；请查看错误后重新触发处理或清理重建。`;
  return `整卷门槛：${approved}/${required} 已入库，还差 ${missing} 题；未满 ${required} 题不能算成套`;
}

function waitReasonLabel(reason: string | null | undefined) {
  if (reason === 'waiting_for_capacity') return '等待 key 池容量';
  if (reason === 'waiting_for_replan') return '等待结构重规划';
  if (reason === 'waiting_for_provider_retry') return '等待 provider 重试';
  if (reason === 'waiting_for_content_retry') return '等待内容重生/修复';
  if (reason === 'waiting_for_retry_window') return '等待下一轮补齐';
  if (reason === 'active_runner') return '已有生成器运行中';
  if (reason === 'waiting_for_attention') return '需要质量关注';
  if (reason === 'content_failed') return '内容失败终态';
  return '';
}

function jobDiagnosticText(job: AdminMockExamGenerationJob) {
  const diagnostics = job.diagnostics;
  const primary = waitReasonLabel(diagnostics?.primaryWaitReason);
  const providerWaitCount = Number(diagnostics?.providerWaitCount ?? 0);
  const waitParts = Object.entries(diagnostics?.waitReasons ?? {})
    .filter(([, count]) => Number(count) > 0)
    .map(([reason, count]) => `${waitReasonLabel(reason) || reason} ${count}`)
    .filter(Boolean);
  if (primary || waitParts.length || providerWaitCount > 0) {
    return `当前主要状态：${primary || waitParts[0]}${providerWaitCount > 0 ? `；key 等待 ${providerWaitCount} 次` : ''}${waitParts.length > 1 ? `；${waitParts.slice(0, 3).join('，')}` : ''}`;
  }
  return '';
}

function jobSlotStatusSummary(job: AdminMockExamGenerationJob, slots: AdminMockExamBlueprintSlot[] = []) {
  const counts = visibleJobSlotResults(job, slots).reduce<Record<string, number>>((acc, slot) => {
    const status = slot.status || 'queued';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const queued = counts.queued ?? 0;
  const running = counts.running ?? 0;
  const candidateReady = counts.candidate_ready ?? 0;
  const approved = counts.approved ?? 0;
  const failed = counts.failed ?? 0;
  const needsAttention = counts.needs_attention ?? 0;
  const assembled = counts.assembled ?? 0;
  const failedLabel = ['queued', 'running'].includes(job.status) ? `待优化/重生 ${failed}` : `失败 ${failed}`;
  const primaryWait = waitReasonLabel(job.diagnostics?.primaryWaitReason);
  return `排队 ${queued} · 生成中 ${running} · 候选 ${candidateReady} · 已入库 ${approved} · ${failedLabel}${needsAttention ? ` · 需关注 ${needsAttention}` : ''}${assembled ? ` · 已装配 ${assembled}` : ''}${primaryWait ? ` · ${primaryWait}` : ''}`;
}

function jobRecentIssues(job: AdminMockExamGenerationJob, slots: AdminMockExamBlueprintSlot[]) {
  const issues = job.slotResults
    .flatMap((slot) => (Array.isArray(slot.issues) ? slot.issues : []))
    .map((issue) => String(issue))
    .filter(Boolean);
  if (!issues.length) return job.error || '-';
  const hasSyllabusMissingIssue = issues.some((issue) => issue.includes('当前学科还没有已应用的大纲'));
  if (['running', 'failed'].includes(job.status) && hasSyllabusMissingIssue && hasReadyMappedSlots(slots)) {
    return '历史失败：该任务是在大纲/题位映射更新前失败的。当前蓝图已有 ready 题位，请继续处理失败任务或重新生成候选题。';
  }
  return issues.slice(0, 2).join('；') + (issues.length > 2 ? `；另 ${issues.length - 2} 条` : '');
}

export type MockExamProductionPanelProps = {
  subject: string;
  papers: AdminMockExamPaper[];
  selectedPaperId: number | null;
  blueprintDetail: AdminMockExamBlueprintDetail | null;
  isLoading: boolean;
  busyAction: string | null;
  actionFeedback?: string | null;
  actionError?: string | null;
  onSelectPaper: (paperId: number | null) => void;
  onReload: () => void;
  onCreateBlueprint: () => void;
  onLoadBlueprint: () => void;
  onConfirmBlueprint: () => void;
  onCreateGenerationJob: () => void;
  onProcessGenerationJob: () => void;
  onAssembleDraft: () => void;
  onCleanupGenerationJob: (jobId: number) => void;
  onCleanupAllGenerationJobs: () => void;
};

export function MockExamProductionPanel({
  subject,
  papers,
  selectedPaperId,
  blueprintDetail,
  isLoading,
  busyAction,
  actionFeedback,
  actionError,
  onSelectPaper,
  onReload,
  onCreateBlueprint,
  onLoadBlueprint,
  onConfirmBlueprint,
  onCreateGenerationJob,
  onProcessGenerationJob,
  onAssembleDraft,
  onCleanupGenerationJob,
  onCleanupAllGenerationJobs
}: MockExamProductionPanelProps) {
  const scopedPapers = subject
    ? papers.filter((paper) => paper.subject === subject)
    : papers;
  const selectedPaper = scopedPapers.find((paper) => paper.id === selectedPaperId) ?? null;
  const blueprint = blueprintDetail?.blueprint ?? null;
  const slots = blueprintDetail?.slots ?? [];
  const generationJobs = blueprintDetail?.generationJobs ?? [];
  const latestJob = generationJobs[0] ?? null;
  const readySlots = slots.filter((slot) => slot.status === 'ready').length;
  const blockedSlots = slots.filter((slot) => slot.status === 'blocked').length;
  const processableJob = generationJobs.find((job) => ['queued', 'failed'].includes(job.status)) ?? null;
  const completedJob = generationJobs.find((job) => job.status === 'completed' && !job.targetPaperId) ?? null;
  const activeAutoFillJob = generationJobs.find((job) => ['queued', 'running'].includes(job.status)) ?? null;
  const isPaperComplete = Boolean(latestJob && jobRequiredCount(latestJob, blueprint) > 0 && jobApprovedCandidates(latestJob, slots) >= jobRequiredCount(latestJob, blueprint));
  const hasSourceStyleProfile = blueprintHasSourceStyleProfile(blueprint);
  const missingSourceStyleProfile = Boolean(blueprint && !hasSourceStyleProfile);
  const busy = Boolean(busyAction);
  const isBusy = (action: string) => busyAction === action;

  return (
    <AdminPanel>
      <AdminPanelHeader kicker="在线模考 AI 出题" title="从真题画像生成整卷候选">
        <p>这条线会自动循环生成、优化和复审，直到每个题位都有 1 道门禁通过题；满 48/48 后自动进入在线模考题库，可装配为模考草稿卷。</p>
      </AdminPanelHeader>

      <AdminStatsStrip
        ariaLabel="在线模考出题状态"
        items={[
          { key: 'papers', label: '可用套卷', value: scopedPapers.length, detail: subject ? subjectLabel(subject) : '全部学科' },
          { key: 'blueprint', label: '整卷蓝图', value: blueprint ? `#${blueprint.id}` : '-', detail: blueprint?.status ?? '未加载' },
          { key: 'slots', label: '题位', value: slots.length, detail: `${readySlots} ready · ${blockedSlots} blocked` },
          { key: 'jobs', label: '生成任务', value: generationJobs.length, detail: latestJob ? `#${latestJob.id} ${latestJob.status}` : '暂无' }
        ]}
      />

      <div className="admin-form-grid">
        <label>
          模考来源卷
          <select
            value={selectedPaperId ?? ''}
            onChange={(event) => onSelectPaper(event.target.value ? Number(event.target.value) : null)}
            disabled={busy}
          >
            <option value="">请选择一套已有模考卷</option>
            {scopedPapers.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {subjectLabel(String(paper.subject as MockExamSubjectId))} · {paper.title} · {paper.questionCount} 题 · {paper.status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <AdminActionBar>
        <AdminButton onClick={onReload} disabled={busy} className={isBusy('mock-reload') ? 'admin-action-loading' : undefined}>
          {isLoading || isBusy('mock-reload') ? '刷新中' : '刷新模考数据'}
        </AdminButton>
        <AdminButton onClick={onCreateBlueprint} disabled={busy || !selectedPaper} className={isBusy('mock-create-blueprint') ? 'admin-action-loading' : undefined}>
          {isBusy('mock-create-blueprint') ? '准备蓝图中' : '生成/加载整卷蓝图'}
        </AdminButton>
        <AdminButton onClick={onLoadBlueprint} disabled={busy || !blueprint} className={isBusy('mock-load-blueprint') ? 'admin-action-loading' : undefined}>
          {isBusy('mock-load-blueprint') ? '加载题位中' : '加载题位'}
        </AdminButton>
        <AdminButton onClick={onConfirmBlueprint} disabled={busy || !blueprint || blueprint.status === 'active'} className={isBusy('mock-confirm-blueprint') ? 'admin-action-loading' : undefined}>
          {isBusy('mock-confirm-blueprint') ? '确认中' : '确认蓝图'}
        </AdminButton>
        <AdminButton onClick={onCreateGenerationJob} disabled={busy || !blueprint || blueprint.status !== 'active' || missingSourceStyleProfile || isPaperComplete || Boolean(activeAutoFillJob)} className={isBusy('mock-create-job') ? 'admin-action-loading' : undefined}>
          {isBusy('mock-create-job') ? '启动中' : isPaperComplete ? '整套已完成' : activeAutoFillJob ? '自动补齐中' : '启动自动补齐'}
        </AdminButton>
        <AdminButton onClick={onProcessGenerationJob} disabled={busy || Boolean(activeAutoFillJob) || !processableJob || missingSourceStyleProfile || isPaperComplete} className={isBusy('mock-process-job') ? 'admin-action-loading' : undefined}>
          {isBusy('mock-process-job') ? '唤醒中' : processableJob?.status === 'queued' ? '自动补齐中' : '唤醒自动补齐'}
        </AdminButton>
        <AdminButton onClick={onAssembleDraft} disabled={busy || !completedJob} className={isBusy('mock-assemble-draft') ? 'admin-action-loading' : undefined}>
          {isBusy('mock-assemble-draft') ? '装配中' : '补救装配历史任务'}
        </AdminButton>
        <AdminButton onClick={onCleanupAllGenerationJobs} disabled={busy || !blueprint || generationJobs.length === 0} className={isBusy('mock-cleanup-all-jobs') ? 'admin-action-loading' : undefined}>
          {isBusy('mock-cleanup-all-jobs') ? '清理中' : '清理全部生成结果'}
        </AdminButton>
      </AdminActionBar>

      {selectedPaper && (
        <div className="admin-topic-action-feedback">
          {actionFeedback && <p>{actionFeedback}</p>}
          {actionError && <p>{actionError}</p>}
          <p>
            当前来源：{selectedPaper.title} · {selectedPaper.questionCount} 题 · {selectedPaper.status}
          </p>
          <p>
            {blueprint
              ? `蓝图 #${blueprint.id} · ${blueprint.status} · ${blueprint.questionCount} 题 · 题位 ${slots.length}`
              : '还没有加载整卷蓝图。先生成/加载蓝图，再确认并生成候选题。'}
          </p>
          {missingSourceStyleProfile && (
            <p>
              缺真题画像：当前蓝图还没有绑定该学科的 active 真题画像。请先导入并自动画像 {subjectLabel(String(blueprint?.subject ?? subject))} 真题 JSON，再生成在线模考候选题。
            </p>
          )}
          {blueprint && hasSourceStyleProfile && (
            <p>
              真题画像：已绑定，在线模考候选会按该画像和大纲题位生成。
            </p>
          )}
          {latestJob && (
            <p>
              最近任务 #{latestJob.id} · {latestJob.status} · {jobRequiredCount(latestJob, blueprint)} 个题位 · {jobCandidates(latestJob, slots)} 个候选
              {` · ${jobApprovedCandidates(latestJob, slots)} 个已入库`}
              {latestJob.error ? ` · ${latestJob.error}` : ''}
            </p>
          )}
          {latestJob && (
            <p>
              {jobCompletionText(latestJob, slots, blueprint)}
            </p>
          )}
          {latestJob && (
            <p>
              题位进度：{jobSlotStatusSummary(latestJob, slots)}
            </p>
          )}
        </div>
      )}

      {generationJobs.length > 0 && (
        <div className="admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>任务</th>
                <th>状态</th>
                <th>题位</th>
                <th>题位进度</th>
                <th>候选</th>
                <th>草稿卷</th>
                <th>最近问题</th>
                <th>清理</th>
              </tr>
            </thead>
            <tbody>
              {generationJobs.slice(0, 8).map((job) => (
                <tr key={job.id}>
                  <td>#{job.id}</td>
                  <td>{job.status}</td>
                  <td>{jobRequiredCount(job, blueprint)}</td>
                  <td>{jobSlotStatusSummary(job, slots)}</td>
                  <td>{jobCandidates(job, slots)}</td>
                  <td>{job.targetPaperId ? `#${job.targetPaperId}` : '-'}</td>
                  <td>{jobRecentIssues(job, slots)}</td>
                  <td>
                    <button
                      type="button"
                      className={isBusy(`mock-cleanup-job-${job.id}`) ? 'ghost-button admin-action-loading' : 'ghost-button'}
                      onClick={() => onCleanupGenerationJob(job.id)}
                      disabled={busy}
                      title="删除该任务关联的 AI 候选、AI job、AI 蓝图和未发布草稿卷。已发布或已有作答的草稿卷不会被删除。"
                    >
                      {isBusy(`mock-cleanup-job-${job.id}`) ? '清理中' : '清理本任务'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPanel>
  );
}
