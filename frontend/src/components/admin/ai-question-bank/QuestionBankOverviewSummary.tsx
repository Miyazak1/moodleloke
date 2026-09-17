import { AdminPanel, AdminPanelHeader } from '../AdminWorkbench';
import type {
  AdminAIQuestioningBlueprintCoverage,
  AdminAIQuestioningQualityTrend,
  AdminAIQuestioningQuestion
} from '../../../lib/api-types';
import type { QuestionBankTab } from './types';

export type QuestionBankOverviewSummaryProps = {
  coverageSummary: AdminAIQuestioningBlueprintCoverage['summary'];
  candidateTotal: number;
  candidateQueue: {
    visible: AdminAIQuestioningQuestion[];
    pending: number;
    failed: number;
    approved: number;
    fallback: number;
  };
  qualityTrendSummary: AdminAIQuestioningQualityTrend['summary'];
  onOpenTab: (tab: QuestionBankTab) => void;
};

export function QuestionBankOverviewSummary({
  coverageSummary,
  qualityTrendSummary,
  onOpenTab
}: QuestionBankOverviewSummaryProps) {
  return (
    <section className="admin-work-grid three admin-question-bank-overview-summary">
      <AdminPanel as="article">
        <AdminPanelHeader kicker="1 共用准备" title={`${coverageSummary.publishedTopicCount} 个知识点`} />
        <p className="form-hint">
          先应用大纲基线，再导入真题 JSON 生成画像。两条 AI 出题线都从这里取范围和真题风格信号。
        </p>
        <button type="button" onClick={() => onOpenTab('shared-prep')}>进入共用准备</button>
      </AdminPanel>
      <AdminPanel as="article">
        <AdminPanelHeader kicker="2 科目训练线" title="按库存缺口自动入库" />
        <p className="form-hint">
          缺蓝图 {coverageSummary.missingTopicCount} · 活跃蓝图 {coverageSummary.activeBlueprintCount} · 候选池由后台治理，不在主页面展开。
        </p>
        <button type="button" onClick={() => onOpenTab('subject-practice')}>进入科目训练线</button>
      </AdminPanel>
      <AdminPanel as="article">
        <AdminPanelHeader kicker="3 在线模考线" title="整卷蓝图" />
        <p className="form-hint">
          按真题画像生成模考题位候选，审核后进入模考候选池，再装配为草稿卷；质量回流待复核 {qualityTrendSummary.needsReviewCount}。
        </p>
        <button type="button" onClick={() => onOpenTab('online-mock')}>进入在线模考线</button>
      </AdminPanel>
    </section>
  );
}
