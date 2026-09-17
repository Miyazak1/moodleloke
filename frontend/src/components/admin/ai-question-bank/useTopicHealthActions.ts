import type { Dispatch, SetStateAction } from 'react';
import {
  runAdminAIQuestioningTopicAction,
  runAdminAIQuestioningTopicBulkAction
} from '../../../lib/api-admin';
import type { AdminAIQuestioningTopicHealth } from '../../../lib/api-types';
import {
  isServerTopicAction,
  topicActionLabel,
  type TopicBulkProgress
} from './CoverageWorkPanel';
import type { AdminRunAction, QuestionBankTab } from './types';

type TopicHealthItem = AdminAIQuestioningTopicHealth['items'][number];
type RepairFirstSummary = {
  handled?: number;
  approved?: number;
  repaired?: number;
  regenerated?: number;
  skipped?: number;
  waiting?: number;
};

type UseTopicHealthActionsOptions = {
  subject: string;
  expandPerBlueprint: number;
  runAction: AdminRunAction;
  setTopicBulkProgress: Dispatch<SetStateAction<TopicBulkProgress | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setActiveTab: Dispatch<SetStateAction<QuestionBankTab>>;
  setFeedback: Dispatch<SetStateAction<string | null>>;
};

export function useTopicHealthActions({
  subject,
  expandPerBlueprint,
  runAction,
  setTopicBulkProgress,
  setStatus,
  setActiveTab,
  setFeedback
}: UseTopicHealthActionsOptions) {
  function repairFirstText(summary?: RepairFirstSummary | null) {
    const handled = Number(summary?.handled ?? 0) || 0;
    if (handled <= 0) return '没有可优先修复的旧候选';
    const parts = [
      `优先处理旧候选 ${handled} 道`,
      `直接入库 ${Number(summary?.approved ?? 0) || 0} 道`,
      `原题修复 ${Number(summary?.repaired ?? 0) || 0} 道`,
      `硬伤替代 ${Number(summary?.regenerated ?? 0) || 0} 道`
    ];
    const skipped = Number(summary?.skipped ?? 0) || 0;
    const waiting = Number(summary?.waiting ?? 0) || 0;
    if (waiting > 0) parts.push(`替代生成中 ${waiting} 道`);
    if (skipped > 0) parts.push(`暂未处理 ${skipped} 道`);
    return parts.join('，');
  }

  function runTopicBulk(
    action: TopicBulkProgress['action'],
    topics: AdminAIQuestioningTopicHealth['items'],
    label: string
  ) {
    const selectedTopics = topics;
    if (selectedTopics.length === 0) return;
    const safeTopics = selectedTopics.slice(0, 100);
    return runAction(`topic-bulk-${action}`, `${label}（${safeTopics.length}个知识点）`, async () => {
      setTopicBulkProgress({
        action,
        total: safeTopics.length,
        completed: 0,
        topicSucceeded: 0,
        failed: 0,
        generated: 0,
        enqueued: 0,
        skipped: 0,
        repairFirstHandled: 0,
        repairFirstApproved: 0,
        repairFirstRepaired: 0,
        repairFirstRegenerated: 0,
        repairFirstSkipped: 0,
        repairFirstWaiting: 0,
        currentTitle: safeTopics[0]?.title ?? null,
        awaitingQueue: false
      });
      const result = await runAdminAIQuestioningTopicBulkAction({
        action,
        topicIds: safeTopics.map((topic) => topic.topicId),
        subject: subject || undefined,
        limit: action === 'expand_candidates'
          ? Math.max(1, Math.min(12, Math.max(...safeTopics.map((topic) => topic.activeBlueprintCount || 1))))
          : 5,
        processInBackground: false,
        perBlueprint: action === 'expand_candidates' ? expandPerBlueprint : undefined,
        force: action === 'expand_candidates' ? true : undefined
      });
      setTopicBulkProgress({
        action,
        total: selectedTopics.length,
        completed: result.succeeded + result.failed,
        topicSucceeded: result.succeeded,
        failed: result.failed,
        generated: 0,
        enqueued: result.enqueued,
        skipped: result.skipped,
        repairFirstHandled: Number(result.repairFirst?.handled ?? 0) || 0,
        repairFirstApproved: Number(result.repairFirst?.approved ?? 0) || 0,
        repairFirstRepaired: Number(result.repairFirst?.repaired ?? 0) || 0,
        repairFirstRegenerated: Number(result.repairFirst?.regenerated ?? 0) || 0,
        repairFirstSkipped: Number(result.repairFirst?.skipped ?? 0) || 0,
        repairFirstWaiting: Number(result.repairFirst?.waiting ?? 0) || 0,
        currentTitle: null,
        awaitingQueue: (action === 'generate_candidates' || action === 'expand_candidates') && (result.enqueued > 0 || (Number(result.repairFirst?.handled ?? 0) || 0) > 0)
      });
      if (result.failed > 0 && result.succeeded === 0) {
        throw new Error(result.errors.map((item) => `${item.topicId}: ${item.message}`).join('；'));
      }
      if (action === 'generate_candidates' || action === 'expand_candidates') {
        const base = `${label}已提交：处理 ${result.succeeded} 个知识点，${repairFirstText(result.repairFirst)}；入队 ${result.enqueued} 个生成任务，跳过 ${result.skipped} 个。`;
        return result.message
          ? `${base}${result.message}`
          : `${base}局部排障任务已入队，正式补齐请使用上方生产计划。`;
      }
      return `${label}已完成：处理 ${result.succeeded} 个知识点，失败 ${result.failed} 个。`;
    });
  }

  function handleTopicHealthAction(topic: TopicHealthItem) {
    if (topic.action === 'review_candidates') {
      setStatus('pending_review');
      setActiveTab('subject-practice');
      setFeedback(`已切到科目训练线待治理候选。请检查「${topic.title}」相关异常题；门禁通过题会自动进入科目训练题库。`);
      return;
    }
    if (topic.action === 'review_quality') {
      setActiveTab('subject-practice');
      setFeedback(`已切到科目训练线质量治理。请查看「${topic.title}」相关题目的质量风险。`);
      return;
    }
    if (!isServerTopicAction(topic.action)) return;
    const action = topic.action;
    const topicActionId = `topic-${topic.topicId}-${action}`;
    void runAction(topicActionId, `${topic.title} ${topicActionLabel(action)}`, async () => {
      const result = await runAdminAIQuestioningTopicAction(topic.topicId, {
        action,
        limit: 5,
        processNow: action === 'generate_candidates'
      });
      if (action === 'generate_candidates') {
        if (result.blocked && result.message) {
          return `${topic.title} ${result.message} ${repairFirstText(result.repairFirst)}。`;
        }
        if (Number(result.repairFirst?.waiting ?? 0) > 0 && result.message) {
          return `${topic.title} ${result.message} ${repairFirstText(result.repairFirst)}。`;
        }
        if (result.repairFirst && result.repairFirst.handled > 0) {
          return result.message
            ? `${result.message} ${repairFirstText(result.repairFirst)}。`
            : `${topic.title} 已先处理可修复候选：${repairFirstText(result.repairFirst)}。`;
        }
        return `${topic.title} 局部补题已提交：入队 ${result.enqueued ?? 0} 个生成任务，跳过 ${result.skipped ?? 0} 个。一次追加完成度请以上方生产计划为准。`;
      }
      if (action === 'expand_candidates') {
        return `${topic.title} 局部追加已提交：入队 ${result.enqueued ?? 0} 个生成任务，跳过 ${result.skipped ?? 0} 个。一次追加完成度请以上方生产计划为准。`;
      }
      return result.message ?? `${topic.title} ${topicActionLabel(action)} 已完成。`;
    });
  }

  return {
    runTopicBulk,
    handleTopicHealthAction
  };
}
