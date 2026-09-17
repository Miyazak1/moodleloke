import {
  AdminActionBar,
  AdminButton,
  AdminOperationStatus,
  AdminPanel,
  AdminPanelHeader,
  AdminStatsStrip
} from '../AdminWorkbench';
import type {
  AdminAdaptiveReplenishmentInventory,
  AdminAdaptiveReplenishmentRunResult,
  AdminSubjectPracticeAutoProductionSetting,
  AdminSubjectPracticeProductionRun
} from '../../../lib/api-types';
import { subjectDisplayName } from './questionFormatting';

type SubjectPracticeProductionPanelProps = {
  subject: string;
  autoProductionSetting: AdminSubjectPracticeAutoProductionSetting | null;
  run: AdminSubjectPracticeProductionRun | null;
  inventory: AdminAdaptiveReplenishmentInventory | null;
  predictiveResult: AdminAdaptiveReplenishmentRunResult | null;
  isBusy?: boolean;
  isInventoryLoading?: boolean;
  isAutoProductionSettingLoading?: boolean;
  onToggleAutoProduction: (enabled: boolean) => void;
  onCreateRun: () => void;
  onProcessRun: () => void;
  onProcessUntilComplete: () => void;
  onRefresh: () => void;
  onRefreshInventory: () => void;
  onRunPredictiveReplenishment: () => void;
};

function productionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    planned: '已计划',
    running: '生产中',
    completed: '本批已完成',
    blocked: '已阻塞',
    cancelled: '已取消'
  };
  return labels[status] ?? status;
}

function difficultyLabel(value: string) {
  const labels: Record<string, string> = {
    basic: '基础',
    medium: '中等',
    hard: '较难'
  };
  return labels[value] ?? value;
}

function predictiveActionLabel(action: string) {
  const labels: Record<string, string> = {
    created_run: '已创建生产计划',
    resume_existing_run: '已续跑现有计划',
    skip_existing_run: '已有计划排队',
    skip: '已跳过'
  };
  return labels[action] ?? action;
}

function predictiveReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    actionable_gap_detected: '发现真实缺口',
    running_production_run_exists: '已有运行中的生产计划',
    no_recent_usage_pressure: '最近没有使用压力',
    no_inventory_gap_under_cap: '库存未低于补题目标',
    no_actionable_gap: '缺口暂无可执行项'
  };
  return labels[reason] ?? reason;
}

export function SubjectPracticeProductionPanel({
  subject,
  autoProductionSetting,
  run,
  inventory,
  predictiveResult,
  isBusy = false,
  isInventoryLoading = false,
  isAutoProductionSettingLoading = false,
  onToggleAutoProduction,
  onCreateRun,
  onProcessRun,
  onProcessUntilComplete,
  onRefresh,
  onRefreshInventory,
  onRunPredictiveReplenishment
}: SubjectPracticeProductionPanelProps) {
  const canProcess = Boolean(run && run.status !== 'completed' && run.status !== 'cancelled' && run.openTotal > 0);
  const blockedCells = run?.cells.filter((cell) => cell.status === 'blocked').slice(0, 6) ?? [];
  const shouldShowOpenCells = Boolean(run && run.status !== 'completed' && run.status !== 'cancelled' && run.openTotal > 0);
  const openCells = shouldShowOpenCells ? run?.cells
    .filter((cell) => cell.openCount > 0 && (cell.status === 'open' || cell.status === 'running' || cell.status === 'blocked'))
    .sort((left, right) => (
      (right.openCount - left.openCount)
      || (right.runningJobCount - left.runningJobCount)
      || (left.topicTitle.localeCompare(right.topicTitle))
    ))
    .slice(0, 8) ?? [] : [];
  const inventorySummary = inventory?.summary ?? null;
  const predictiveUsage = predictiveResult?.usage ?? null;
  const predictiveItems = predictiveResult?.items ?? [];
  const autoProductionBatchTarget = autoProductionSetting?.batchTarget ?? 50;
  const autoProductionEnabled = Boolean(autoProductionSetting?.enabled);
  const autoProductionGlobalEnabled = autoProductionSetting?.globalEnabled ?? false;
  const autoProductionEffectiveEnabled = Boolean(autoProductionSetting?.effectiveEnabled);
  const requiredPublishedCount = inventorySummary?.requiredPublishedCount ?? 0;
  const rawPublishedTotal = run?.rawPublishedTotal ?? run?.publishedTotal ?? 0;
  const overflowTotal = run?.overflowTotal ?? Math.max(0, rawPublishedTotal - (run?.publishedTotal ?? 0));
  const activeRunningJobTotal = run?.activeRunningJobTotal ?? run?.cells.reduce((sum, cell) => sum + cell.runningJobCount, 0) ?? 0;
  const runStatusDetail = run
    ? run.status === 'completed' && requiredPublishedCount > 0
      ? `#${run.id} · 本批已完成，长期缺口仍有 ${requiredPublishedCount} 道${autoProductionEffectiveEnabled ? '，自动开关会继续续批' : '，自动开关未生效'}`
      : `#${run.id} · ${subjectDisplayName(run.subject)}`
    : '';
  const riskItems = inventory?.items
    .filter((item) => item.requiredPublishedCount > 0 || item.riskLevel === 'critical' || item.riskLevel === 'warning')
    .sort((left, right) => (
      (right.requiredPublishedCount - left.requiredPublishedCount)
      || (right.noQuestionErrorCount - left.noQuestionErrorCount)
      || (right.fallbackDrawCount - left.fallbackDrawCount)
    ))
    .slice(0, 6) ?? [];

  return (
    <AdminPanel>
      <AdminPanelHeader
        kicker="科目训练 AI 生产"
        title="按知识点与难度闭环补齐训练题"
        actions={(
          <AdminActionBar>
            <AdminButton variant="secondary" onClick={onRefreshInventory} disabled={isBusy || !subject}>刷新预测</AdminButton>
            <AdminButton variant="secondary" onClick={onRefresh} disabled={isBusy}>刷新计划</AdminButton>
            <AdminButton variant="primary" onClick={onRunPredictiveReplenishment} disabled={isBusy || !subject}>按使用预测补题</AdminButton>
            <AdminButton variant="primary" onClick={onCreateRun} disabled={isBusy || !subject}>创建并自动补齐</AdminButton>
            <AdminButton variant="secondary" onClick={onProcessRun} disabled={isBusy || !canProcess}>排障处理一轮</AdminButton>
            <AdminButton variant="primary" onClick={onProcessUntilComplete} disabled={isBusy || !canProcess}>继续自动补齐</AdminButton>
          </AdminActionBar>
        )}
      >
        <p>一次计划会按当前学科的大纲与真题画像拆成知识点/难度目标；每批以 50 道合格入库题为停止目标，只有门禁通过并进入科目训练题库的题才计入完成。</p>
      </AdminPanelHeader>

      <AdminOperationStatus
        title="本学科自动生成确认"
        status={isAutoProductionSettingLoading ? '读取中' : autoProductionEffectiveEnabled ? '已开启' : autoProductionEnabled ? '等待后台总闸' : '待确认'}
        action={`每批 ${autoProductionBatchTarget} 道合格题`}
        tone={autoProductionEffectiveEnabled ? 'success' : autoProductionEnabled ? 'warning' : 'neutral'}
        metrics={[
          { key: 'subjectEnabled', label: '学科确认', value: autoProductionEnabled ? '已允许' : '未允许', tone: autoProductionEnabled ? 'success' : 'neutral' },
          { key: 'globalEnabled', label: '后台总闸', value: autoProductionGlobalEnabled ? '已开启' : '未开启', tone: autoProductionGlobalEnabled ? 'success' : 'warning' },
          { key: 'batchTarget', label: '批次目标', value: autoProductionBatchTarget }
        ]}
        recentLabel="策略"
        recent={[
          {
            key: 'auto-production-toggle',
            label: (
              <label>
                <input
                  type="checkbox"
                  checked={autoProductionEnabled}
                  disabled={isBusy || isAutoProductionSettingLoading || !subject}
                  onChange={(event) => onToggleAutoProduction(event.currentTarget.checked)}
                />
                {' '}允许画像就绪后自动生成本学科科目题
              </label>
            ),
            detail: autoProductionEffectiveEnabled ? '开启后会按批次自动续跑' : '关闭时画像只更新，不自动开新生产批次'
          }
        ]}
      />

      <AdminOperationStatus
        title="题库长期库存缺口"
        status={isInventoryLoading ? '刷新中' : inventory ? `${requiredPublishedCount} 道长期待补` : subject ? '未加载' : '请选择学科'}
        action={inventory ? `${inventorySummary?.criticalCells ?? 0} 严重 · ${inventorySummary?.warningCells ?? 0} 预警` : '按学科统计 topic × 难度'}
        tone={isInventoryLoading ? 'working' : inventorySummary && inventorySummary.criticalCells > 0 ? 'warning' : 'neutral'}
        metrics={[
          { key: 'cells', label: '矩阵', value: inventorySummary?.totalCells ?? 0 },
          { key: 'effective', label: '全库有效库存', value: inventorySummary?.globalEffectiveStock ?? 0, tone: 'success' },
          { key: 'ai-formal', label: 'AI库存', value: inventorySummary?.aiFormalStock ?? 0, tone: 'success' },
          { key: 'manual', label: '非AI库存', value: inventorySummary?.manualStock ?? 0 },
          { key: 'required', label: '长期缺口', value: requiredPublishedCount, tone: requiredPublishedCount ? 'warning' : 'success' }
        ]}
        recentLabel="优先补题"
        recent={riskItems.map((item) => ({
          key: `${item.topicId}-${item.difficultyBand}-${item.questionType}`,
          label: `${item.topicTitle} · ${difficultyLabel(item.difficultyBand)}`,
          detail: `缺 ${item.requiredPublishedCount} · 库存 ${item.globalEffectiveStock}/${item.cycleTargetStock} · ${item.riskReasons.join('/') || item.riskLevel}`
        }))}
      />

      {predictiveResult ? (
        <AdminOperationStatus
          title="最近一次预测补题"
          status={`${predictiveResult.processedSubjects} 个学科`}
          action={predictiveResult.requestedSubject ? subjectDisplayName(predictiveResult.requestedSubject) : '全部学科'}
          tone={predictiveItems.some((item) => item.action === 'created_run' || item.action === 'resume_existing_run') ? 'working' : 'neutral'}
          metrics={[
            { key: 'usage', label: '聚合记录', value: predictiveUsage?.inserted ?? 0 },
            { key: 'global', label: '全局', value: predictiveUsage?.scopes?.global ?? 0 },
            { key: 'team', label: '团队', value: predictiveUsage?.scopes?.team ?? 0 },
            { key: 'user', label: '个人', value: predictiveUsage?.scopes?.user ?? 0 },
            { key: 'events', label: '缺题事件', value: predictiveUsage?.scopes?.events ?? 0 },
            { key: 'cycles', label: '学生周期', value: predictiveUsage?.touchedCycles ?? 0 },
            { key: 'cohorts', label: '团队周期', value: predictiveUsage?.touchedCohorts ?? 0 },
            { key: 'expiredCohorts', label: '过期团队', value: predictiveUsage?.expiredCohorts ?? 0, tone: predictiveUsage?.expiredCohorts ? 'warning' : 'neutral' }
          ]}
          recentLabel="处理结果"
          recent={predictiveItems.map((item, index) => ({
            key: `${item.subject}-${item.action}-${index}`,
            label: `${subjectDisplayName(item.subject)} · ${predictiveActionLabel(item.action)}`,
            detail: predictiveReasonLabel(item.reason)
          }))}
        />
      ) : null}

      {run ? (
        <>
          <AdminStatsStrip
            ariaLabel="科目训练生产计划统计"
            items={[
              { key: 'status', label: '状态', value: productionStatusLabel(run.status), detail: runStatusDetail },
              { key: 'target', label: '本轮目标合格题', value: run.targetTotal, detail: '本次生产计划的停止目标' },
              { key: 'published', label: '有效入库进度', value: `${run.publishedTotal}/${run.targetTotal}`, detail: `按 cell 目标封顶，剩余 ${run.openTotal} 道` },
              { key: 'rawPublished', label: '正式入库总数', value: rawPublishedTotal, detail: overflowTotal > 0 ? `含 ${overflowTotal} 道超额题，不抵扣其他难度缺口` : '已进入科目训练正式题库' },
              { key: 'running', label: '活跃生成中', value: activeRunningJobTotal, detail: '不含已过期的 stale running 任务' },
              { key: 'candidate', label: '本轮候选/失败', value: `${run.candidateTotal}/${run.failedTotal}`, detail: '候选不计完成；继续处理会先治理候选再生成' }
            ]}
          />

          <div className="admin-production-matrix">
            {run.difficultyProgress.map((item) => {
              const overflow = Math.max(0, Number(item.overflow ?? 0) || 0);
              return (
                <AdminOperationStatus
                  key={item.difficultyBand}
                  title={`${difficultyLabel(item.difficultyBand)}难度`}
                  status={`${item.published}/${item.target} 有效入库`}
                  tone={item.open > 0 ? 'working' : 'success'}
                  metrics={[
                    { key: 'open', label: '本轮剩余', value: item.open, tone: item.open > 0 ? 'warning' : 'success' },
                    ...(overflow > 0 ? [{ key: 'overflow', label: '超额不抵扣', value: overflow, tone: 'neutral' as const }] : []),
                    { key: 'cellsOpen', label: '待处理 cell', value: item.cellsOpen },
                    { key: 'blocked', label: '阻塞', value: item.cellsBlocked, tone: item.cellsBlocked > 0 ? 'danger' : 'neutral' }
                  ]}
                />
              );
            })}
          </div>

          {openCells.length ? (
            <AdminOperationStatus
              title="待补目标"
              status={`本轮剩余 ${run.openTotal} 道`}
              action="按知识点/难度推进"
              tone="working"
              metrics={[
                { key: 'openCells', label: '待补 cell', value: openCells.length, tone: 'warning' },
                { key: 'running', label: '生成中', value: openCells.reduce((sum, cell) => sum + cell.runningJobCount, 0), tone: 'working' },
                { key: 'candidates', label: '候选', value: openCells.reduce((sum, cell) => sum + cell.candidateCount, 0) }
              ]}
              recent={openCells.map((cell) => ({
                key: cell.id,
                label: `${cell.topicTitle} · ${difficultyLabel(cell.difficultyBand)}`,
                detail: `本轮已入库 ${cell.publishedCount}/${cell.targetCount} · 剩余 ${cell.openCount} · 候选 ${cell.candidateCount}/${cell.candidateLimit} · 生成中 ${cell.runningJobCount}`
              }))}
            />
          ) : null}

          {run.blockedMessage || blockedCells.length ? (
            <AdminOperationStatus
              title="阻塞说明"
              status={run.blockedReasonCode ?? '部分目标阻塞'}
              tone="warning"
              metrics={[
                { key: 'blocked', label: '阻塞 cell', value: blockedCells.length, tone: blockedCells.length ? 'warning' : 'neutral' }
              ]}
              recent={blockedCells.map((cell) => ({
                key: cell.id,
                label: `${cell.topicTitle} · ${difficultyLabel(cell.difficultyBand)}`,
                detail: cell.failureMessage ?? `${cell.candidateCount}/${cell.candidateLimit} 候选 · ${cell.failureCode ?? 'blocked'}`
              }))}
            />
          ) : null}
        </>
      ) : (
        <AdminOperationStatus
          title="尚未创建生产计划"
          status={subject ? subjectDisplayName(subject) : '请选择学科'}
          action="创建后会生成知识点/难度矩阵"
          tone="neutral"
        />
      )}
    </AdminPanel>
  );
}
