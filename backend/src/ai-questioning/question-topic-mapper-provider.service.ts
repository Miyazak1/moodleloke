import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { AiGatewayMessage } from '../ai-gateway/ai-gateway.types';

export type TopicMapperQuestion = {
  id: number;
  subject: string;
  questionNumber: string;
  promptText: string | null;
  options: unknown;
  correctAnswer: string | null;
  explanation: string | null;
  analysis: unknown;
};

export type TopicMapperTopic = {
  id: number;
  code: string;
  title: string;
  module: string | null;
  examScope: string | null;
  description: string | null;
  skills: string[];
  aliases: string[];
  excludedScope: string[];
};

export type TopicMapperSuggestion = {
  topicCode: string;
  confidence: number;
  reason: string;
};

type TopicMapperResult = {
  suggestions: TopicMapperSuggestion[];
  rawOutput: unknown;
  provider: string;
  model: string;
  status: string;
  error?: string;
  agent: {
    role: 'topic_mapper';
    name: string;
    provider: string;
    model: string;
    promptVersion: string;
  };
};

const TOPIC_MAPPER_AGENT_NAME = process.env.CSCA_AI_TOPIC_MAPPING_AGENT || 'source-topic-mapper-v1';
const TOPIC_MAPPER_PROMPT_VERSION = process.env.CSCA_AI_TOPIC_MAPPING_PROMPT_VERSION || 'source-topic-mapping-v1';
const SUPPORTED_PROVIDERS = new Set(['deepseek', 'openai', 'openai-compatible']);
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_TEMPERATURE = 0.1;
const RULE_MODEL = 'local-topic-mapper-disabled';

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function providerName() {
  return process.env.AI_DEFAULT_PROVIDER
    || process.env.CSCA_AI_TOPIC_MAPPING_PROVIDER
    || process.env.CSCA_AI_QUESTION_REVIEW_PROVIDER
    || process.env.CSCA_AI_PROVIDER
    || 'rule-fallback';
}

function modelName() {
  return process.env.CSCA_AI_TOPIC_MAPPING_MODEL
    || process.env.CSCA_AI_QUESTION_REVIEW_MODEL
    || process.env.DEEPSEEK_BACKGROUND_DEFAULT_MODEL
    || process.env.DEEPSEEK_DEFAULT_MODEL
    || process.env.CSCA_AI_MODEL
    || 'deepseek-v4-flash';
}

function timeoutMs() {
  const value = Number(process.env.CSCA_AI_TOPIC_MAPPING_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function temperature() {
  const value = Number(process.env.CSCA_AI_TOPIC_MAPPING_TEMPERATURE ?? DEFAULT_TEMPERATURE);
  return Number.isFinite(value) && value >= 0 && value <= 2 ? value : DEFAULT_TEMPERATURE;
}

function mappingEnabled() {
  if (process.env.CSCA_AI_TOPIC_MAPPING_ENABLED !== undefined) return enabled(process.env.CSCA_AI_TOPIC_MAPPING_ENABLED);
  return enabled(process.env.CSCA_AI_QUESTION_REVIEW_ENABLED) || enabled(process.env.CSCA_AI_QUESTION_GENERATION_ENABLED);
}

function externalReady(hasConfiguredKey = true) {
  const provider = providerName();
  return mappingEnabled()
    && provider !== 'rule-fallback'
    && SUPPORTED_PROVIDERS.has(provider)
    && hasConfiguredKey;
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanConfidence(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}

function parseJsonObject(output: string) {
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    const match = output.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function cleanSuggestions(value: unknown, allowedCodes: Set<string>) {
  if (!Array.isArray(value)) return [];
  const suggestions: TopicMapperSuggestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const topicCode = cleanText(record.topicCode ?? record.code);
    if (!allowedCodes.has(topicCode) || suggestions.some((suggestion) => suggestion.topicCode === topicCode)) continue;
    suggestions.push({
      topicCode,
      confidence: cleanConfidence(record.confidence),
      reason: cleanText(record.reason) || 'LLM matched this question to the closest syllabus topic.'
    });
  }
  return suggestions.sort((left, right) => right.confidence - left.confidence).slice(0, 3);
}

function agent(provider: string, model: string) {
  return {
    role: 'topic_mapper' as const,
    name: TOPIC_MAPPER_AGENT_NAME,
    provider,
    model,
    promptVersion: TOPIC_MAPPER_PROMPT_VERSION
  };
}

function mappingMessages(question: TopicMapperQuestion, topics: TopicMapperTopic[]): AiGatewayMessage[] {
  return [
    {
      role: 'system' as const,
      content: [
        'You map CSCA past-paper questions to syllabus topic codes.',
        'Return JSON only. No markdown.',
        'Choose only from candidateTopics. Never invent topic codes.',
        'Use the question stem, options, answer, explanation, key concepts, and syllabus topic scope.',
        'candidateTopics.excludedScope is out-of-scope material; do not treat it as a positive match.',
        'Prefer the most specific topic. If uncertain, provide lower confidence.',
        'Confidence is 0 to 1.',
        'Schema: {"suggestions":[{"topicCode":"string","confidence":0.0,"reason":"short reason"}]}.',
        'Return at most 3 suggestions, sorted by confidence.'
      ].join(' ')
    },
    {
      role: 'user' as const,
      content: JSON.stringify({ question, candidateTopics: topics })
    }
  ];
}

@Injectable()
export class QuestionTopicMapperProviderService {
  private readonly gateway: AiGatewayService;

  constructor(gateway: AiGatewayService) {
    this.gateway = gateway;
  }

  configStatus() {
    const provider = providerName();
    const keyConfigured = this.gateway.hasConfiguredKey('topic_mapping', modelName());
    const ready = externalReady(keyConfigured);
    return {
      enabled: mappingEnabled(),
      externalReady: ready,
      provider,
      model: ready ? modelName() : RULE_MODEL,
      supported: provider === 'rule-fallback' || SUPPORTED_PROVIDERS.has(provider),
      apiKeyConfigured: keyConfigured
    };
  }

  async suggest(question: TopicMapperQuestion, topics: TopicMapperTopic[]): Promise<TopicMapperResult> {
    const allowedCodes = new Set(topics.map((topic) => topic.code));
    if (!externalReady(this.gateway.hasConfiguredKey('topic_mapping', modelName()))) {
      return {
        suggestions: [],
        rawOutput: null,
        provider: 'rule-fallback',
        model: RULE_MODEL,
        status: 'topic_mapper_disabled',
        agent: agent('rule-fallback', RULE_MODEL)
      };
    }

    const response = await this.gateway.complete({
      taskType: 'topic_mapping',
      sourceModule: 'question_topic_mapper',
      messages: mappingMessages(question, topics),
      modelHint: modelName() || undefined,
      responseFormat: 'json',
      temperature: temperature(),
      timeoutMs: timeoutMs(),
      metadata: {
        questionId: question.id,
        subject: question.subject,
        candidateTopicCount: topics.length
      }
    });
    if (response.status !== 'success') {
      const status = response.errorCode ?? response.status;
      return {
        suggestions: [],
        rawOutput: null,
        provider: response.providerId,
        model: response.model,
        status,
        error: response.errorMessage ?? 'Topic mapper provider failed.',
        agent: agent(response.providerId, response.model)
      };
    }
    const output = response.content.trim();
    const parsed = parseJsonObject(output);
    const suggestions = cleanSuggestions(parsed?.suggestions, allowedCodes);
    return {
      suggestions,
      rawOutput: parsed ?? output,
      provider: response.providerId,
      model: response.model,
      status: suggestions.length ? 'success' : 'provider_schema_invalid',
      error: suggestions.length ? undefined : 'Topic mapper provider returned no valid topic suggestions.',
      agent: agent(response.providerId, response.model)
    };
  }
}
