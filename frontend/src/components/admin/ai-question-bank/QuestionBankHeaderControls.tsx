import {
  AdminPanel,
  AdminPanelHeader,
  AdminStatsStrip,
  AdminSubnav
} from '../AdminWorkbench';
import type { QuestionBankSummary, QuestionBankTab, QuestionBankTabItem } from './types';

const SUBJECT_OPTIONS = [
  { value: '', label: '全部学科' },
  { value: 'math', label: '数学' },
  { value: 'physics', label: '物理' },
  { value: 'chemistry', label: '化学' }
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending_review', label: '待审核' },
  { value: 'review_failed', label: '复审失败' },
  { value: 'approved', label: '已审核' },
  { value: 'fallback', label: '需重生/fallback' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'archived', label: '已归档' }
];

export type QuestionBankHeaderControlsProps = {
  summary: QuestionBankSummary;
  candidateQueue: {
    pending: number;
    failed: number;
    fallback: number;
  };
  syllabusTopicCount: number;
  sourceQuestionCount: number;
  styleProfileCount: number;
  missingTopicCount: number;
  highSeverityQualityCount: number;
  pendingVariantCandidateCount: number;
  tabs: QuestionBankTabItem[];
  activeTab: QuestionBankTab;
  subject: string;
  status: string;
  refreshBusy: boolean;
  onTabChange: (tab: QuestionBankTab) => void;
  onSubjectChange: (subject: string) => void;
  onStatusChange: (status: string) => void;
  onRefresh: () => void;
};

export function QuestionBankHeaderControls({
  summary,
  candidateQueue,
  syllabusTopicCount,
  sourceQuestionCount,
  styleProfileCount,
  missingTopicCount,
  highSeverityQualityCount,
  pendingVariantCandidateCount,
  tabs,
  activeTab,
  subject,
  status,
  refreshBusy,
  onTabChange,
  onSubjectChange,
  onStatusChange,
  onRefresh
}: QuestionBankHeaderControlsProps) {
  return (
    <>
      <AdminStatsStrip
        ariaLabel="AI 题库治理统计"
        items={[
          { key: 'syllabus', label: '共用大纲基线', value: syllabusTopicCount, detail: '科目训练与在线模考共用' },
          { key: 'profile', label: '共用真题画像源', value: styleProfileCount, detail: `${sourceQuestionCount} 真题样本` },
          { key: 'practice', label: '科目训练线', value: summary.topicWork, detail: `${missingTopicCount} 缺蓝图 · 专项题库入库` },
          { key: 'mock', label: '在线模考线', value: summary.published, detail: '整卷蓝图 · 模考题库入库' },
          { key: 'quality', label: '当前线质量', value: summary.qualityWork, detail: `${highSeverityQualityCount} 高风险` },
          { key: 'remediation', label: '科目错因补题', value: summary.remediationWork, detail: `${pendingVariantCandidateCount} 变式待审` },
          { key: 'total', label: '当前线台账', value: summary.total, detail: '按业务线过滤后的台账' }
        ]}
      />

      <AdminSubnav
        items={tabs}
        activeKey={activeTab}
        ariaLabel="AI 题库工作区"
        onChange={onTabChange}
      />

      <AdminPanel>
        <AdminPanelHeader kicker="筛选" title="流程范围">
          <p>这里控制当前工作线、题库资产和台账；候选池不在主页面展示，避免治理队列影响日常加载。</p>
        </AdminPanelHeader>
        <div className="admin-inline-form">
          <label>
            学科
            <select value={subject} onChange={(event) => onSubjectChange(event.target.value)}>
              {SUBJECT_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            状态
            <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            className={refreshBusy ? 'ghost-button admin-action-loading' : 'ghost-button'}
            onClick={onRefresh}
            disabled={refreshBusy}
          >
            {refreshBusy ? '刷新中' : '刷新'}
          </button>
        </div>
      </AdminPanel>
    </>
  );
}
