import { AiGatewayConcurrencyService } from '../ai-gateway/ai-gateway-concurrency.service';
import { AiGatewayConfigService } from '../ai-gateway/ai-gateway-config.service';
import { AiGatewayCostService } from '../ai-gateway/ai-gateway-cost.service';
import { AiGatewayKeyPoolService } from '../ai-gateway/ai-gateway-key-pool.service';
import { AiGatewayLedgerService } from '../ai-gateway/ai-gateway-ledger.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { DeepSeekProvider } from '../ai-gateway/providers/deepseek.provider';
import { QuestionGeneratorProviderService } from '../ai-questioning/question-generator-provider.service';
import { QuestionPromptBuilderService } from '../ai-questioning/question-prompt-builder.service';
import { QuestionReviewerProviderService } from '../ai-questioning/question-reviewer-provider.service';
import { QuestionTopicMapperProviderService } from '../ai-questioning/question-topic-mapper-provider.service';
import type { QuestionEngineCapability } from '../question-engine-plugin/question-engine-plugin.types';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function questionEngineWorkerCapabilities(env: NodeJS.ProcessEnv = process.env): QuestionEngineCapability[] {
  const allowed = new Set<QuestionEngineCapability>(['question.generate', 'question.review', 'question.topic-map']);
  return [...new Set(String(env.QUESTION_ENGINE_WORKER_CAPABILITIES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is QuestionEngineCapability => allowed.has(value as QuestionEngineCapability)))];
}

export function createQuestionEngineWorkerCapabilityHandler(overrides: {
  generator?: Pick<QuestionGeneratorProviderService, 'generate'>;
  reviewer?: Pick<QuestionReviewerProviderService, 'review' | 'reviewBlindAnswer'>;
  topicMapper?: Pick<QuestionTopicMapperProviderService, 'suggest'>;
} = {}) {
  const config = new AiGatewayConfigService();
  const gateway = new AiGatewayService(
    config,
    new AiGatewayConcurrencyService(config),
    new AiGatewayKeyPoolService(),
    new AiGatewayLedgerService(undefined, config),
    new AiGatewayCostService(),
    new DeepSeekProvider()
  );
  const generator = overrides.generator ?? new QuestionGeneratorProviderService(new QuestionPromptBuilderService(), gateway);
  const reviewer = overrides.reviewer ?? new QuestionReviewerProviderService(gateway);
  const topicMapper = overrides.topicMapper ?? new QuestionTopicMapperProviderService(gateway);

  return async (input: { capability: QuestionEngineCapability; payload: unknown }) => {
    const payload = record(input.payload);
    const operation = String(payload?.operation ?? '');
    if (input.capability === 'question.generate' && operation === 'generate') {
      if (!payload?.blueprint || !payload.fallback) throw new Error('worker_payload_invalid');
      const result = await generator.generate(
        payload.blueprint as Parameters<QuestionGeneratorProviderService['generate']>[0],
        payload.fallback as Parameters<QuestionGeneratorProviderService['generate']>[1],
        (payload.options ?? {}) as Parameters<QuestionGeneratorProviderService['generate']>[2]
      );
      return { status: 'succeeded' as const, result };
    }
    if (input.capability === 'question.review' && operation === 'review') {
      if (!payload?.candidate) throw new Error('worker_payload_invalid');
      const result = await reviewer.review(
        payload.candidate as Parameters<QuestionReviewerProviderService['review']>[0],
        (payload.context ?? {}) as Parameters<QuestionReviewerProviderService['review']>[1]
      );
      return { status: 'succeeded' as const, result };
    }
    if (input.capability === 'question.review' && operation === 'reviewBlindAnswer') {
      if (!payload?.candidate) throw new Error('worker_payload_invalid');
      const result = await reviewer.reviewBlindAnswer(
        payload.candidate as Parameters<QuestionReviewerProviderService['reviewBlindAnswer']>[0],
        (payload.context ?? {}) as Parameters<QuestionReviewerProviderService['reviewBlindAnswer']>[1]
      );
      return { status: 'succeeded' as const, result };
    }
    if (input.capability === 'question.topic-map' && operation === 'suggest') {
      if (!payload?.question || !Array.isArray(payload.topics)) throw new Error('worker_payload_invalid');
      const result = await topicMapper.suggest(
        payload.question as Parameters<QuestionTopicMapperProviderService['suggest']>[0],
        payload.topics as Parameters<QuestionTopicMapperProviderService['suggest']>[1]
      );
      return { status: 'succeeded' as const, result };
    }
    return { status: 'failed' as const, result: null, errorCode: 'capability_operation_not_supported' };
  };
}
