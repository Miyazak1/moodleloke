import { Injectable } from '@nestjs/common';
import { AdaptivePlannedTopic } from './csca-adaptive.types';
import { AICoachProviderService } from './ai-coach-provider.service';
import { SpecialPracticeSubject } from './csca-special-practice.types';

type AdaptivePlan = {
  subject: SpecialPracticeSubject;
  plannedTopics: AdaptivePlannedTopic[];
  strategy: string;
  mode?: string;
  focus?: unknown;
  adjustment?: unknown;
  roundSize: number;
};

type AssistantSuggestion = {
  summary: string;
  actions: string[];
  plannedTopics: AdaptivePlannedTopic[];
  provider: {
    provider: string;
    model: string;
    status: string;
  };
};

type PlannerAssistantDifference =
  | {
    type: 'added';
    topicId: number;
    finalDifficulty: string;
  }
  | {
    type: 'changed';
    index: number;
    baseTopicId: number;
    finalTopicId: number;
    baseDifficulty: string;
    finalDifficulty: string;
    baseReason: string;
    finalReason: string;
  };

const DIFFICULTY_LABELS = ['基础', '中等', '较难', '挑战'];

function difficultyRank(value?: string | null) {
  const text = String(value ?? '').trim();
  if (text.includes('挑战')) return 4;
  if (text.includes('较难') || text.includes('提高')) return 3;
  if (text.includes('中')) return 2;
  return 1;
}

function difficultyFromRank(rank: number) {
  return DIFFICULTY_LABELS[Math.max(0, Math.min(DIFFICULTY_LABELS.length - 1, rank - 1))] ?? '基础';
}

function clonePlanTopics(topics: AdaptivePlannedTopic[]) {
  return topics.map((topic) => ({ ...topic }));
}

function samePlan(first: AdaptivePlannedTopic[], second: AdaptivePlannedTopic[]) {
  if (first.length !== second.length) return false;
  return first.every((topic, index) => {
    const next = second[index];
    return next
      && topic.topicId === next.topicId
      && topic.targetDifficulty === next.targetDifficulty
      && topic.reason === next.reason;
  });
}

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function plannerAssistantAIEnabled() {
  return enabled(process.env.CSCA_PLANNER_ASSISTANT_AI_ENABLED);
}

function jsonRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parsePlannerSuggestion(output: string, fallback: AssistantSuggestion): AssistantSuggestion | null {
  try {
    const record = jsonRecord(JSON.parse(output));
    if (!record) return null;
    const summary = String(record.summary ?? '').trim();
    const actions = Array.isArray(record.actions)
      ? record.actions.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 3)
      : [];
    const plannedTopics = Array.isArray(record.plannedTopics)
      ? record.plannedTopics.flatMap((item): AdaptivePlannedTopic[] => {
        const topic = jsonRecord(item);
        const topicId = Number(topic?.topicId);
        if (!Number.isInteger(topicId)) return [];
        const base = fallback.plannedTopics.find((candidate) => candidate.topicId === topicId);
        if (!base) {
          return [{
            topicId,
            code: '',
            title: '',
            module: null,
            targetDifficulty: String(topic?.targetDifficulty ?? '基础').trim() || '基础',
            reason: String(topic?.reason ?? 'assistant_suggestion').trim() || 'assistant_suggestion',
            targetDifficultyReason: String(topic?.targetDifficultyReason ?? 'planner_assistant_llm').trim() || 'planner_assistant_llm'
          }];
        }
        return [{
          ...base,
          targetDifficulty: String(topic?.targetDifficulty ?? base.targetDifficulty).trim() || base.targetDifficulty,
          reason: String(topic?.reason ?? base.reason).trim() || base.reason,
          targetDifficultyReason: String(topic?.targetDifficultyReason ?? 'planner_assistant_llm').trim() || 'planner_assistant_llm'
        }];
      })
      : [];
    if (!summary || !actions.length || !plannedTopics.length) return null;
    return {
      summary,
      actions,
      plannedTopics,
      provider: fallback.provider
    };
  } catch {
    return null;
  }
}

@Injectable()
export class PlannerAssistantService {
  constructor(private readonly provider?: AICoachProviderService) {}

  async assist(input: {
    userId: number;
    subject: SpecialPracticeSubject;
    basePlan: AdaptivePlan;
    language?: string;
  }) {
    const localSuggestion = this.localSuggestion(input.basePlan);
    const suggestion = await this.providerSuggestion(input, localSuggestion);
    const guarded = this.guardSuggestion(input.basePlan, suggestion);
    return {
      ...input.basePlan,
      plannedTopics: guarded.plannedTopics,
      strategy: input.basePlan.strategy,
      plannerAssistant: {
        provider: suggestion.provider,
        status: guarded.status,
        summary: suggestion.summary,
        actions: suggestion.actions,
        differences: guarded.differences,
        rejectedReasons: guarded.rejectedReasons,
        suggestedTopics: suggestion.plannedTopics.map((topic) => ({
          topicId: topic.topicId,
          targetDifficulty: topic.targetDifficulty,
          reason: topic.reason
        })),
        finalTopics: guarded.plannedTopics.map((topic) => ({
          topicId: topic.topicId,
          targetDifficulty: topic.targetDifficulty,
          reason: topic.reason
        }))
      }
    };
  }

  private async providerSuggestion(input: {
    userId: number;
    subject: SpecialPracticeSubject;
    basePlan: AdaptivePlan;
    language?: string;
  }, fallback: AssistantSuggestion): Promise<AssistantSuggestion> {
    if (!plannerAssistantAIEnabled() || !this.provider) return fallback;
    const fallbackOutput = JSON.stringify({
      summary: fallback.summary,
      actions: fallback.actions,
      plannedTopics: fallback.plannedTopics.map((topic) => ({
        topicId: topic.topicId,
        targetDifficulty: topic.targetDifficulty,
        reason: topic.reason,
        targetDifficultyReason: topic.targetDifficultyReason
      }))
    });
    const completion = await this.provider.generate({
      type: 'planner_assistant',
      userId: input.userId,
      fallbackOutput,
      input: {
        language: input.language ?? 'zh',
        subject: input.subject,
        strategy: input.basePlan.strategy,
        roundSize: input.basePlan.roundSize,
        rulePlan: input.basePlan.plannedTopics.map((topic) => ({
          topicId: topic.topicId,
          code: topic.code,
          title: topic.title,
          module: topic.module,
          targetDifficulty: topic.targetDifficulty,
          reason: topic.reason,
          targetDifficultyReason: topic.targetDifficultyReason
        })),
        constraints: {
          allowedTopicIds: input.basePlan.plannedTopics.map((topic) => topic.topicId),
          maxDifficultyShift: 1,
          finalAuthority: 'rule_guard'
        }
      }
    });
    const parsed = parsePlannerSuggestion(completion.output, fallback);
    if (!parsed) {
      return {
        ...fallback,
        provider: {
          provider: completion.provider,
          model: completion.model,
          status: 'provider_planner_parse_failed'
        }
      };
    }
    return {
      ...parsed,
      provider: {
        provider: completion.provider,
        model: completion.model,
        status: completion.status
      }
    };
  }

  private localSuggestion(plan: AdaptivePlan): AssistantSuggestion {
    const topics = clonePlanTopics(plan.plannedTopics);
    const weakCount = topics.filter((topic) => topic.reason.includes('weak') || topic.reason.includes('wrong')).length;
    const summary = weakCount
      ? '下一轮优先巩固薄弱点和最近错题，难度按规则计划保持。'
      : '下一轮按规则计划覆盖薄弱、复习和挑战题，先继续收集表现证据。';
    const actions = [
      weakCount ? '先做薄弱/错题相关知识点。' : '先保持当前训练节奏。',
      '完成本轮后再根据正确率和未答情况调整难度。'
    ];
    return {
      summary,
      actions,
      plannedTopics: topics.map((topic) => ({
        ...topic,
        targetDifficulty: topic.targetDifficulty,
        targetDifficultyReason: topic.targetDifficultyReason ?? 'planner_assistant_kept_rule_difficulty'
      })),
      provider: {
        provider: 'rule-fallback',
        model: 'local-planner-assistant-v1',
        status: 'assistant_disabled'
      }
    };
  }

  private guardSuggestion(basePlan: AdaptivePlan, suggestion: AssistantSuggestion) {
    const baseByTopic = new Map(basePlan.plannedTopics.map((topic) => [topic.topicId, topic]));
    const rejectedReasons: string[] = [];
    const guardedTopics: AdaptivePlannedTopic[] = [];
    for (const suggested of suggestion.plannedTopics.slice(0, basePlan.roundSize)) {
      const base = baseByTopic.get(suggested.topicId);
      if (!base) {
        rejectedReasons.push(`topic_not_in_rule_plan:${suggested.topicId}`);
        continue;
      }
      const baseRank = difficultyRank(base.targetDifficulty);
      const suggestedRank = difficultyRank(suggested.targetDifficulty);
      const safeRank = Math.abs(suggestedRank - baseRank) <= 1 ? suggestedRank : baseRank;
      if (safeRank !== suggestedRank) {
        rejectedReasons.push(`difficulty_out_of_guard:${suggested.topicId}`);
      }
      guardedTopics.push({
        ...base,
        targetDifficulty: difficultyFromRank(safeRank),
        reason: suggested.reason || base.reason,
        targetDifficultyReason: suggested.targetDifficultyReason || base.targetDifficultyReason
      });
    }
    for (const base of basePlan.plannedTopics) {
      if (guardedTopics.length >= basePlan.roundSize) break;
      if (!guardedTopics.some((topic) => topic.topicId === base.topicId)) guardedTopics.push(base);
    }
    const finalTopics = guardedTopics.slice(0, basePlan.roundSize);
    const differences: PlannerAssistantDifference[] = finalTopics.flatMap((topic, index): PlannerAssistantDifference[] => {
      const base = basePlan.plannedTopics[index];
      if (!base) return [{ type: 'added', topicId: topic.topicId, finalDifficulty: topic.targetDifficulty }];
      if (base.topicId === topic.topicId && base.targetDifficulty === topic.targetDifficulty && base.reason === topic.reason) return [];
      return [{
        type: 'changed',
        index,
        baseTopicId: base.topicId,
        finalTopicId: topic.topicId,
        baseDifficulty: base.targetDifficulty,
        finalDifficulty: topic.targetDifficulty,
        baseReason: base.reason,
        finalReason: topic.reason
      }];
    });
    const status = samePlan(basePlan.plannedTopics, finalTopics)
      ? 'accepted_no_change'
      : rejectedReasons.length
        ? 'adjusted_by_rule_guard'
        : 'accepted_with_changes';
    return { plannedTopics: finalTopics, differences, rejectedReasons, status };
  }
}
