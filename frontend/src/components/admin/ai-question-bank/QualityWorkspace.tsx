import {
  AdminActionBar,
  AdminPanel,
  AdminPanelHeader,
  AdminTableScroll
} from '../AdminWorkbench';
import type {
  AdminAIQuestioningQualityGovernance,
  AdminAIQuestioningQualityMetric,
  AdminAIQuestioningQualityTrend,
  AdminAIQuestioningQuestion
} from '../../../lib/api-types';
import { statusLabel } from './candidateReviewHelpers';
import type { AdminRunAction } from './types';

export type QualityBulkAction = 'send_to_review' | 'resolve' | 'archive' | 'manual_fix' | 'reduce_exposure' | 'regenerate';

export type QualityCalibrationSummary = {
  total: number;
  difficultyDrift: AdminAIQuestioningQualityMetric[];
  distractorIssues: AdminAIQuestioningQualityMetric[];
  regenerate: AdminAIQuestioningQualityMetric[];
  lowConfidence: AdminAIQuestioningQualityMetric[];
  highRisk: AdminAIQuestioningQualityMetric[];
};

export type QualityReplacementSummary = {
  needsCandidate: AdminAIQuestioningQualityMetric[];
  draftedUnpublished: AdminAIQuestioningQualityMetric[];
  staleCandidate: AdminAIQuestioningQualityMetric[];
  published: AdminAIQuestioningQualityMetric[];
};

export type QualityMetricDisposition = 'archive' | 'manual_fix' | 'reduce_exposure' | 'regenerate';

type QualitySummaryPanelsProps = {
  governance: AdminAIQuestioningQualityGovernance;
  trend: AdminAIQuestioningQualityTrend;
  metricsCount: number;
  calibration: QualityCalibrationSummary;
  replacementSummary: QualityReplacementSummary;
  questionById: Map<number, AdminAIQuestioningQuestion>;
  controlsBusy: boolean;
  isActionBusy: (actionId: string) => boolean;
  runAction: AdminRunAction;
  onRefreshQuality: () => Promise<unknown>;
  onBulkQuality: (action: QualityBulkAction, label: string) => Promise<void>;
  onExportQualityMetrics: (extension: 'csv' | 'json') => void;
};

type QualityMetricsTableProps = {
  metrics: AdminAIQuestioningQualityMetric[];
  isActionBusy: (actionId: string) => boolean;
  runAction: AdminRunAction;
  onSendToReview: (questionId: number) => Promise<unknown>;
  onResolve: (questionId: number) => Promise<unknown>;
  onApplyDisposition: (questionId: number, disposition: QualityMetricDisposition, label: string) => Promise<void>;
};

export type QualityWorkspaceProps =
  QualitySummaryPanelsProps &
  QualityMetricsTableProps;

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

function QualitySummaryPanels({
  governance,
  trend,
  metricsCount,
  calibration,
  replacementSummary,
  questionById,
  isActionBusy,
  runAction,
  onRefreshQuality,
  onBulkQuality,
  onExportQualityMetrics
}: QualitySummaryPanelsProps) {
  const refreshBusy = isActionBusy('quality-refresh');
  const sendToReviewBusy = isActionBusy('quality-bulk-send_to_review');
  const regenerateBusy = isActionBusy('quality-bulk-regenerate');
  const sendToReviewDisabled = sendToReviewBusy || governance.summary.needsReviewCount === 0;
  const regenerateDisabled = regenerateBusy || governance.summary.recommendedActionCount === 0;
  const sendToReviewTitle = governance.summary.needsReviewCount === 0 ? '当前筛选下没有可送审的质量信号。' : undefined;
  const regenerateTitle = governance.summary.recommendedActionCount === 0 ? '当前筛选下没有建议重生成的质量信号。' : undefined;

  return (
    <>
      <section className="admin-work-grid two">
        <AdminPanel>
          <AdminPanelHeader
            kicker="质量治理分组"
            title={`${governance.summary.total} 条信号`}
            actions={(
              <AdminActionBar>
                <button type="button" className={refreshBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction('quality-refresh', '刷新质量信号', onRefreshQuality)} disabled={refreshBusy}>
                  {refreshBusy ? '刷新中' : '刷新质量'}
                </button>
                <button type="button" className={sendToReviewBusy ? 'admin-action-loading' : undefined} onClick={() => void onBulkQuality('send_to_review', '批量送审')} disabled={sendToReviewDisabled} title={sendToReviewTitle}>
                  {sendToReviewBusy ? '送审中' : '批量送审'}
                </button>
                <button type="button" className={regenerateBusy ? 'admin-action-loading' : undefined} onClick={() => void onBulkQuality('regenerate', '批量重生成')} disabled={regenerateDisabled} title={regenerateTitle}>
                  {regenerateBusy ? '重生成中' : '批量重生成'}
                </button>
                <button type="button" className="ghost-button" onClick={() => onExportQualityMetrics('csv')} disabled={metricsCount === 0}>
                  导出 CSV
                </button>
                <button type="button" className="ghost-button" onClick={() => onExportQualityMetrics('json')} disabled={metricsCount === 0}>
                  导出 JSON
                </button>
              </AdminActionBar>
            )}
          />
          <div className="metric-grid four">
            <div><span>待复核</span><strong>{governance.summary.needsReviewCount}</strong></div>
            <div><span>高风险</span><strong>{governance.summary.highSeverityCount}</strong></div>
            <div><span>变式题</span><strong>{governance.summary.variantCount}</strong></div>
            <div><span>SLA 提醒</span><strong>{governance.summary.sla.dueSoonCount + governance.summary.sla.escalationCount}</strong></div>
          </div>
          <div className="admin-list compact">
            {governance.byReason.slice(0, 8).map((item) => (
              <div key={item.reason}>
                <strong>{item.reason}</strong>
                <span>{item.count} 条 · 待复核 {item.needsReviewCount} · 高风险 {item.highSeverityCount} · 样本 {item.sampleQuestionIds.slice(0, 5).join(', ') || '-'}</span>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel>
          <AdminPanelHeader kicker="质量趋势" title={`近 ${trend.days} 天`} />
          <div className="metric-grid three">
            <div><span>作答</span><strong>{trend.summary.attemptCount}</strong></div>
            <div><span>唯一题</span><strong>{trend.summary.uniqueQuestionCount}</strong></div>
            <div><span>需重生成</span><strong>{trend.summary.regenerationRequiredCount}</strong></div>
          </div>
          <div className="admin-list compact">
            {trend.bySubject.slice(0, 6).map((item) => (
              <div key={item.subject}>
                <strong>{item.subject}</strong>
                <span>作答 {item.attemptCount} · 正确率 {formatPercent(item.correctRate)} · 未答 {formatPercent(item.unansweredRate)} · 高风险 {item.highSeverityCount}</span>
              </div>
            ))}
            {trend.bySubject.length === 0 && <p className="form-hint">暂无质量趋势数据。</p>}
          </div>
        </AdminPanel>
      </section>

      <section className="admin-work-grid two">
        <AdminPanel>
          <AdminPanelHeader kicker="质量校准摘要" title={`${calibration.total} 题`} />
          <div className="metric-grid five">
            <div><span>难度漂移</span><strong>{calibration.difficultyDrift.length}</strong></div>
            <div><span>干扰项异常</span><strong>{calibration.distractorIssues.length}</strong></div>
            <div><span>建议重生成</span><strong>{calibration.regenerate.length}</strong></div>
            <div><span>低置信</span><strong>{calibration.lowConfidence.length}</strong></div>
            <div><span>高风险</span><strong>{calibration.highRisk.length}</strong></div>
          </div>
          <p className="form-hint">
            判断质量信号是否来自样本不足、难度偏移或干扰项问题；导出会包含这些校准字段。
          </p>
        </AdminPanel>

        <AdminPanel>
          <AdminPanelHeader kicker="替代候选跟进" title={`${replacementSummary.needsCandidate.length + replacementSummary.draftedUnpublished.length + replacementSummary.staleCandidate.length} 待跟进`} />
          <div className="metric-grid four">
            <div><span>需要候选</span><strong>{replacementSummary.needsCandidate.length}</strong></div>
            <div><span>可审核发布</span><strong>{replacementSummary.draftedUnpublished.length}</strong></div>
            <div><span>候选已失效</span><strong>{replacementSummary.staleCandidate.length}</strong></div>
            <div><span>已发布替换</span><strong>{replacementSummary.published.length}</strong></div>
          </div>
          <div className="admin-list compact">
            {[...replacementSummary.draftedUnpublished, ...replacementSummary.staleCandidate].slice(0, 6).map((metric) => (
              <div key={`replacement-${metric.questionId}`}>
                <strong>Q{metric.questionId} {'->'} #{metric.qualityGovernance?.replacementQuestionId ?? '-'}</strong>
                <span>
                  {metric.qualityGovernance?.replacementPublishedQuestionId ? `已发布 #${metric.qualityGovernance.replacementPublishedQuestionId}` : '未发布'}
                  {' · '}
                  候选状态 {metric.replacementCandidateStatus || questionById.get(metric.qualityGovernance?.replacementQuestionId ?? -1)?.status || '-'}
                  {' · '}
                  {metric.reviewReason || metric.qualitySummary?.recommendedAction || '-'}
                </span>
              </div>
            ))}
            {replacementSummary.draftedUnpublished.length + replacementSummary.staleCandidate.length === 0 && <p className="form-hint">当前没有需要质量跟进的替代候选。</p>}
          </div>
        </AdminPanel>
      </section>
    </>
  );
}

function QualityMetricsTable({
  metrics,
  isActionBusy,
  runAction,
  onSendToReview,
  onResolve,
  onApplyDisposition
}: QualityMetricsTableProps) {
  return (
    <AdminPanel>
      <AdminPanelHeader kicker="质量处理队列" title={`${metrics.length} 条明细`}>
        <p>这里承接原 Audit 的质量治理动作；按系统建议分流，但发布替换仍需要候选审核。</p>
      </AdminPanelHeader>
      <AdminTableScroll>
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>题目</th>
              <th>风险</th>
              <th>证据</th>
              <th>建议</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => {
              const reviewBusy = isActionBusy(`quality-review-${metric.questionId}`);
              const resolveBusy = isActionBusy(`quality-resolve-${metric.questionId}`);
              const reduceExposureBusy = isActionBusy(`quality-reduce_exposure-${metric.questionId}`);
              const manualFixBusy = isActionBusy(`quality-manual_fix-${metric.questionId}`);
              const regenerateBusy = isActionBusy(`quality-regenerate-${metric.questionId}`);
              const archiveBusy = isActionBusy(`quality-archive-${metric.questionId}`);
              return (
                <tr key={metric.questionId}>
                  <td>
                    <strong>Q{metric.questionId}</strong>
                    <p>{metric.subject} · topic #{metric.topicId} · {statusLabel(metric.questionStatus)}</p>
                    <small>source #{metric.sourceQuestionId ?? '-'} · variant #{metric.generatedVariantOf ?? '-'}</small>
                  </td>
                  <td>
                    {metric.qualitySummary?.severity ?? '-'}
                    <p>{metric.reviewReason || metric.qualityGovernance?.reason || '-'}</p>
                  </td>
                  <td>
                    作答 {metric.attemptCount} · 正确率 {formatPercent(metric.correctRate)} · 未答 {formatPercent(metric.unansweredRate)}
                    <p>难度 {metric.designedDifficulty} / {metric.empiricalDifficulty || '-'} · 置信 {formatPercent(metric.difficultyConfidence)}</p>
                  </td>
                  <td>
                    {metric.qualitySummary?.recommendedAction ?? metric.qualityGovernance?.disposition ?? 'monitor'}
                    <p>{metric.qualitySummary?.reasons.slice(0, 3).join(' · ') || '-'}</p>
                  </td>
                  <td>
                    <div className="admin-inline-actions">
                      <button type="button" className={reviewBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction(`quality-review-${metric.questionId}`, `送审 Q${metric.questionId}`, () => onSendToReview(metric.questionId))} disabled={reviewBusy}>
                        {reviewBusy ? '送审中' : '送审'}
                      </button>
                      <button type="button" className={resolveBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction(`quality-resolve-${metric.questionId}`, `标记已处理 Q${metric.questionId}`, () => onResolve(metric.questionId))} disabled={resolveBusy}>
                        {resolveBusy ? '处理中' : '已处理'}
                      </button>
                      <button type="button" className={reduceExposureBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void onApplyDisposition(metric.questionId, 'reduce_exposure', `降低曝光 Q${metric.questionId}`)} disabled={reduceExposureBusy}>
                        {reduceExposureBusy ? '处理中' : '降曝光'}
                      </button>
                      <button type="button" className={manualFixBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void onApplyDisposition(metric.questionId, 'manual_fix', `转质量修题 Q${metric.questionId}`)} disabled={manualFixBusy}>
                        {manualFixBusy ? '处理中' : '质量修题'}
                      </button>
                      <button type="button" className={regenerateBusy ? 'admin-action-loading' : undefined} onClick={() => void onApplyDisposition(metric.questionId, 'regenerate', `重生成 Q${metric.questionId}`)} disabled={regenerateBusy}>
                        {regenerateBusy ? '生成中' : '重生成'}
                      </button>
                      <button type="button" className={archiveBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void onApplyDisposition(metric.questionId, 'archive', `归档 Q${metric.questionId}`)} disabled={archiveBusy}>
                        {archiveBusy ? '归档中' : '归档'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {metrics.length === 0 && (
              <tr>
                <td colSpan={5}>暂无质量处理明细。</td>
              </tr>
            )}
          </tbody>
        </table>
      </AdminTableScroll>
    </AdminPanel>
  );
}

export function QualityWorkspace(props: QualityWorkspaceProps) {
  return (
    <>
      <QualitySummaryPanels {...props} />
      <QualityMetricsTable {...props} />
    </>
  );
}
