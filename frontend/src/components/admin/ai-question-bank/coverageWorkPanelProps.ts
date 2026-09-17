import type {
  AdminAIQuestioningBlueprintCoverage,
  AdminAIQuestioningGenerationQueueHealth,
  AdminAIQuestioningTopicHealth
} from '../../../lib/api-types';
import type { CoverageWorkPanelProps, TopicBulkProgress } from './CoverageWorkPanel';

type TopicHealthItems = AdminAIQuestioningTopicHealth['items'];
type TopicHealthItem = AdminAIQuestioningTopicHealth['items'][number];

type TopicHealthWorkView = {
  visibleTopicHealthItems: TopicHealthItems;
  bulkBlueprintTopics: TopicHealthItems;
  bulkCandidateTopics: TopicHealthItems;
  bulkExpansionTopics: TopicHealthItems;
};

type GenerationQueueView = {
  generationQueueActiveCount: number;
  generationQueueHasIssues: boolean;
};

type BuildCoverageWorkPanelPropsParams = {
  topicHealthWorkView: TopicHealthWorkView;
  missingTopics: AdminAIQuestioningBlueprintCoverage['missingTopics'];
  generationQueue: AdminAIQuestioningGenerationQueueHealth;
  generationQueueView: GenerationQueueView;
  topicBulkProgress: TopicBulkProgress | null;
  subjectSelected: boolean;
  expandPerBlueprint: number;
  isActionBusy: (actionId: string) => boolean;
  setExpandPerBlueprint: (value: number) => void;
  runTopicBulk: (action: TopicBulkProgress['action'], topics: TopicHealthItems, label: string) => Promise<unknown> | undefined;
  handleTopicHealthAction: (topic: TopicHealthItem) => void;
  cleanupSubjectPracticeScope?: (topic?: TopicHealthItem, includeApprovedAssets?: boolean) => void;
  legacyCandidateBulkDisabled?: boolean;
};

export function buildCoverageWorkPanelProps({
  topicHealthWorkView,
  missingTopics,
  generationQueue,
  generationQueueView,
  topicBulkProgress,
  subjectSelected,
  expandPerBlueprint,
  isActionBusy,
  setExpandPerBlueprint,
  runTopicBulk,
  handleTopicHealthAction,
  cleanupSubjectPracticeScope,
  legacyCandidateBulkDisabled = true
}: BuildCoverageWorkPanelPropsParams): CoverageWorkPanelProps {
  return {
    topicHealthItems: topicHealthWorkView.visibleTopicHealthItems,
    missingTopics,
    bulkBlueprintTopics: topicHealthWorkView.bulkBlueprintTopics,
    bulkCandidateTopics: topicHealthWorkView.bulkCandidateTopics,
    bulkExpansionTopics: topicHealthWorkView.bulkExpansionTopics,
    generationQueue,
    topicBulkProgress,
    subjectSelected,
    expandPerBlueprint,
    generationQueueActiveCount: generationQueueView.generationQueueActiveCount,
    generationQueueHasIssues: generationQueueView.generationQueueHasIssues,
    isActionBusy,
    onExpandPerBlueprintChange: setExpandPerBlueprint,
    onRunTopicBulk: (action, topics, label) => void runTopicBulk(action, topics, label),
    onHandleTopicAction: handleTopicHealthAction,
    onCleanupSubjectPracticeScope: cleanupSubjectPracticeScope,
    legacyCandidateBulkDisabled
  };
}
