import type { QuestionBankState, QuestionBankSummary, QuestionBankTabItem } from './types';
import { isMockExamCandidate } from './questionEvidence';

export type CandidateQueueSummary = {
  pending: number;
  failed: number;
};

export function buildQuestionBankSummary(
  data: QuestionBankState,
  candidateQueue: CandidateQueueSummary
): QuestionBankSummary {
  return {
    total: data.ledgerTotal,
    published: data.publishedTotal,
    practiceReady: data.ledgerItems.filter((item) => item.isPracticeReady).length,
    used: data.ledgerItems.filter((item) => item.exposureCount > 0 || item.attemptCount > 0).length,
    pending: data.ledgerItems.filter((item) => !item.isPracticeReady && !isMockExamCandidate(item)).length,
    candidateWork: data.candidatesTotal,
    topicWork: data.topicHealth.summary.missingBlueprintCount +
      data.topicHealth.summary.needsCandidateCount +
      data.topicHealth.summary.needsPublishCount,
    qualityWork: data.qualityGovernance.summary.needsReviewCount + data.qualityGovernance.summary.highSeverityCount,
    remediationWork: data.misconceptions.governance.summary.totalActionable + data.remediation.summary.pendingVariantCandidates
  };
}

export function buildQuestionBankTabs(
  data: QuestionBankState,
  summary: QuestionBankSummary
): QuestionBankTabItem[] {
  return [
    { key: 'overview', label: '流程总览', detail: `${summary.total} 题` },
    { key: 'shared-prep', label: '共用准备', detail: `${data.coverage.summary.publishedTopicCount} 知识点 · ${data.styleProfiles.length} 画像` },
    { key: 'subject-practice', label: '科目训练线', detail: `${data.coverage.summary.missingTopicCount} 缺口 · 自动入库` },
    { key: 'online-mock', label: '在线模考线', detail: '整卷蓝图 · 自动装配' }
  ];
}
