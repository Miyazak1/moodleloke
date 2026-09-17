import type { AdminAIQuestioningQuestion } from '../../../lib/api-types';
import type { QuestionBankHeaderControlsProps } from './QuestionBankHeaderControls';
import type { QuestionBankOverviewSummaryProps } from './QuestionBankOverviewSummary';
import type { QuestionBankSummary, QuestionBankState, QuestionBankTab, QuestionBankTabItem } from './types';

type CandidateQueueView = {
  visible: AdminAIQuestioningQuestion[];
  pending: number;
  failed: number;
  approved: number;
  fallback: number;
};

type BuildQuestionBankHeaderControlsPropsParams = {
  data: QuestionBankState;
  summary: QuestionBankSummary;
  candidateQueue: CandidateQueueView;
  tabs: QuestionBankTabItem[];
  activeTab: QuestionBankTab;
  subject: string;
  status: string;
  refreshBusy: boolean;
  setActiveTab: (tab: QuestionBankTab) => void;
  setSubject: (subject: string) => void;
  setStatus: (status: string) => void;
  requestRefresh: () => void;
};

type BuildQuestionBankOverviewSummaryPropsParams = {
  data: QuestionBankState;
  candidateQueue: CandidateQueueView;
  setActiveTab: (tab: QuestionBankTab) => void;
};

export function buildQuestionBankHeaderControlsProps({
  data,
  summary,
  candidateQueue,
  tabs,
  activeTab,
  subject,
  status,
  refreshBusy,
  setActiveTab,
  setSubject,
  setStatus,
  requestRefresh
}: BuildQuestionBankHeaderControlsPropsParams): QuestionBankHeaderControlsProps {
  return {
    summary,
    candidateQueue,
    syllabusTopicCount: data.coverage.summary.publishedTopicCount,
    sourceQuestionCount: data.sourceQuestionsTotal,
    styleProfileCount: data.styleProfiles.length,
    missingTopicCount: data.coverage.summary.missingTopicCount,
    highSeverityQualityCount: data.qualityGovernance.summary.highSeverityCount,
    pendingVariantCandidateCount: data.remediation.summary.pendingVariantCandidates,
    tabs,
    activeTab,
    subject,
    status,
    refreshBusy,
    onTabChange: setActiveTab,
    onSubjectChange: setSubject,
    onStatusChange: setStatus,
    onRefresh: requestRefresh
  };
}

export function buildQuestionBankOverviewSummaryProps({
  data,
  candidateQueue,
  setActiveTab
}: BuildQuestionBankOverviewSummaryPropsParams): QuestionBankOverviewSummaryProps {
  return {
    coverageSummary: data.coverage.summary,
    candidateTotal: data.candidatesTotal,
    candidateQueue,
    qualityTrendSummary: data.qualityTrend.summary,
    onOpenTab: setActiveTab
  };
}
