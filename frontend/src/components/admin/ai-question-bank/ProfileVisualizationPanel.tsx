import type {
  AdminAIQuestioningProfileDistributionItem,
  AdminAIQuestioningSourceDocumentProfileVisualization
} from '../../../lib/api-types';

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function ProfileDistributionChart({
  title,
  items,
  emptyText = '暂无数据'
}: {
  title: string;
  items: AdminAIQuestioningProfileDistributionItem[];
  emptyText?: string;
}) {
  const visibleItems = items.slice(0, 10);
  return (
    <div className="admin-profile-chart">
      <strong>{title}</strong>
      {visibleItems.length === 0 ? (
        <span className="form-hint">{emptyText}</span>
      ) : visibleItems.map((item) => (
        <div key={`${title}-${item.key}`} className="admin-profile-chart-row">
          <span title={item.label}>{item.label}</span>
          <div aria-hidden="true"><i style={{ width: percent(Math.max(0.03, item.ratio)) }} /></div>
          <em>{item.count} · {percent(item.ratio)}</em>
        </div>
      ))}
    </div>
  );
}

export function ProfileVisualizationPanel({
  visualization
}: {
  visualization: AdminAIQuestioningSourceDocumentProfileVisualization;
}) {
  const { document, summary, distributions, diagnostics, sampleQuestions } = visualization;
  const completeness = document.sourceCompleteness;
  const completenessLabel = completeness
    ? `${completeness.actualQuestionCount}/${completeness.expectedQuestionCount ?? completeness.actualQuestionCount}`
    : null;
  return (
    <section className="admin-profile-visualization-panel">
      <div className="metric-grid four">
        <div><span>健康分</span><strong>{summary.healthScore}</strong></div>
        <div><span>总题数</span><strong>{summary.questionCount}</strong></div>
        <div><span>已处理</span><strong>{summary.processedCount ?? summary.mappedCount}/{summary.questionCount}</strong></div>
        <div><span>自动纳入</span><strong>{summary.autoApprovedCount}</strong></div>
        <div><span>已说明排除</span><strong>{summary.excludedCount ?? 0}</strong></div>
        {completenessLabel && <div><span>源卷完整性</span><strong>{completenessLabel}</strong></div>}
        <div><span>待处理</span><strong>{summary.pendingCount}</strong></div>
        <div><span>低置信度</span><strong>{summary.lowConfidenceCount}</strong></div>
        <div><span>画像缺口</span><strong>{summary.unknownDimensionCount}</strong></div>
      </div>
      {completeness && completeness.completenessStatus !== 'complete' && (
        <div className="admin-profile-diagnostics">
          <p className="admin-profile-diagnostic info">
            <strong>提示</strong>
            <span>
              {completeness.note}
              {completeness.excludedQuestions.length > 0 ? ` 已说明缺题：${completeness.excludedQuestions.map((item) => `Q${item.questionNumber}`).join('、')}。` : ''}
              {completeness.missingQuestionNumbers.length > 0 ? ` 未说明缺题：${completeness.missingQuestionNumbers.map((item) => `Q${item}`).join('、')}。` : ''}
            </span>
          </p>
        </div>
      )}
      {diagnostics.length > 0 && (
        <div className="admin-profile-diagnostics">
          {diagnostics.map((item) => (
            <p key={item.code} className={`admin-profile-diagnostic ${item.severity}`}>
              <strong>{item.severity === 'danger' ? '高风险' : item.severity === 'warning' ? '需关注' : '提示'}</strong>
              <span>{item.message}</span>
            </p>
          ))}
        </div>
      )}
      <div className="admin-profile-chart-grid">
        <ProfileDistributionChart title="知识点覆盖（卷内占比）" items={distributions.topics} />
        <ProfileDistributionChart title="难度分布（卷内占比）" items={distributions.difficulty} />
        <ProfileDistributionChart title="题型分布（卷内占比）" items={distributions.questionForm} />
        <ProfileDistributionChart title="认知技能（卷内占比）" items={distributions.cognitiveSkill} />
        <ProfileDistributionChart title="阅读负荷（卷内占比）" items={distributions.readingLoad} />
        <ProfileDistributionChart title="计算负荷（卷内占比）" items={distributions.calculationLoad} />
        <ProfileDistributionChart title="答案分布（卷内占比）" items={distributions.answers} />
        <ProfileDistributionChart title="预计用时（卷内占比）" items={distributions.estimatedTime} />
      </div>
      {sampleQuestions.length > 0 && (
        <details className="admin-profile-samples">
          <summary>查看样本题画像</summary>
          <div>
            {sampleQuestions.map((question) => (
              <span key={question.id}>
                Q{question.questionNumber} · {question.topicCode ?? '未映射'} · {question.difficulty} · {question.questionForm} · {question.cognitiveSkill}
              </span>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
