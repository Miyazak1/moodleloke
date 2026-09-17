import type { AdminAIQuestioningTopicHealth } from '../../../lib/api-types';
import type { TopicBulkProgress } from './CoverageWorkPanel';
import type { QuestionBankState } from './types';

export type PaginationView = {
  pageStart: number;
  pageEnd: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

export function buildPaginationView(total: number, page: number, pageSize: number, currentCount: number): PaginationView {
  const pageStart = total === 0 ? 0 : page * pageSize + 1;
  const pageEnd = Math.min(total, page * pageSize + currentCount);
  return {
    pageStart,
    pageEnd,
    canGoPrevious: page > 0,
    canGoNext: pageEnd < total
  };
}

export type TopicHealthWorkView = {
  visibleTopicHealthItems: AdminAIQuestioningTopicHealth['items'];
  bulkBlueprintTopics: AdminAIQuestioningTopicHealth['items'];
  bulkCandidateTopics: AdminAIQuestioningTopicHealth['items'];
  bulkExpansionTopics: AdminAIQuestioningTopicHealth['items'];
};

export function buildTopicHealthWorkView(
  items: AdminAIQuestioningTopicHealth['items'],
  visibleLimit: number
): TopicHealthWorkView {
  const visibleTopicHealthItems = items.slice(0, visibleLimit);
  return {
    visibleTopicHealthItems,
    bulkBlueprintTopics: items.filter((topic) => topic.action === 'ensure_blueprint'),
    bulkCandidateTopics: items.filter((topic) => topic.action === 'generate_candidates'),
    bulkExpansionTopics: items.filter((topic) => topic.activeBlueprintCount > 0)
  };
}

export type GenerationQueueView = {
  generationQueueActiveCount: number;
  generationQueueHasIssues: boolean;
  isTopicBulkRunning: boolean;
};

export function buildGenerationQueueView(
  data: QuestionBankState,
  topicBulkProgress: TopicBulkProgress | null
): GenerationQueueView {
  const summary = data.generationQueue.summary;
  return {
    generationQueueActiveCount: summary.queued + summary.running,
    generationQueueHasIssues: summary.blocked > 0 || summary.staleRunning > 0,
    isTopicBulkRunning: Boolean(topicBulkProgress?.currentTitle || topicBulkProgress?.awaitingQueue)
  };
}

export type BusyControlView = {
  isBusy: boolean;
  candidateControlsBusy: boolean;
  sourceReferenceControlsBusy: boolean;
  qualityControlsBusy: boolean;
  remediationControlsBusy: boolean;
};

export function buildBusyControlView(busyActions: Set<string>): BusyControlView {
  const matchesPrefix = (...prefixes: string[]) => (
    Array.from(busyActions).some((actionId) => prefixes.some((prefix) => actionId === prefix || actionId.startsWith(prefix)))
  );
  return {
    isBusy: busyActions.size > 0,
    candidateControlsBusy: matchesPrefix('candidate-bulk', 'candidate-bulk-all'),
    sourceReferenceControlsBusy: matchesPrefix('source-reference', 'source-question', 'style-profile'),
    qualityControlsBusy: matchesPrefix('quality'),
    remediationControlsBusy: matchesPrefix('misconception', 'concept-card')
  };
}

export type SourceReferenceWorkflowView = {
  canGenerateStyleProfile: boolean;
  styleProfileBlockedReason: string;
  sourceReferenceWorkflowTone: 'working' | 'success' | 'warning' | 'neutral';
};

export function buildSourceReferenceWorkflowView(
  subject: string,
  data: QuestionBankState,
  isStyleProfileBusy: boolean
): SourceReferenceWorkflowView {
  const canGenerateStyleProfile = Boolean(subject) && data.sourceReferenceSummary.canGenerateProfile;
  const styleProfileBlockedReason = !subject
    ? '请先选择具体学科'
    : data.sourceReferenceSummary.recommendedAction === 'retry_auto_profile'
      ? '还有临时失败样本，系统会自动安排重试'
      : data.sourceReferenceSummary.recommendedAction === 'auto_profile_source_questions'
        ? '已导入样本后请等待自动画像流水线完成'
        : '请先导入真题样本，系统会自动画像';
  const sourceReferenceWorkflowTone = isStyleProfileBusy
    ? 'working'
    : canGenerateStyleProfile
      ? 'success'
      : data.sourceReferenceSummary.recommendedAction === 'import_source_questions'
        ? 'warning'
        : 'neutral';
  return {
    canGenerateStyleProfile,
    styleProfileBlockedReason,
    sourceReferenceWorkflowTone
  };
}
