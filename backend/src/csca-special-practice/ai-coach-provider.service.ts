import { Injectable, Optional } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { AiGatewayMessage, AiGatewayResponseFormat, AiTaskType } from '../ai-gateway/ai-gateway.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_COACH_PROMPT_VERSION,
  RULE_PROMPT_VERSION,
  buildCoachMessages,
  isSupportedCoachPromptVersion,
  resolveCoachPromptVersion,
  supportedCoachPromptVersions,
  validateCoachPromptTemplate
} from './ai-coach-prompt-templates';
import { decryptApiSecretFromStorage } from './ai-secret-store';
import { organizationRoleAllows } from './organization-permissions';

export type AICoachProviderRequest = {
  type: string;
  input: unknown;
  fallbackOutput: string;
  forceFallbackReason?: string;
  userId?: number;
  providerConfig?: AICoachRuntimeProviderConfig | null;
};

export type AICoachRuntimeProviderConfig = {
  source: 'platform' | 'organization';
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl: string;
  organizationId?: number;
  providerConfigId?: number;
};

type ProviderCompletion = {
  output: string;
  provider: string;
  model: string;
  promptVersion: string;
  input: unknown;
  status: string;
};

const SUPPORTED_PROVIDERS = new Set(['deepseek', 'openai', 'openai-compatible']);
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_OUTPUT_CHARS = 1800;
const RULE_MODEL = 'local-rule-v1';

function enabled(value: string | undefined) {
  return value === 'true' || value === '1';
}

function providerName() {
  return process.env.AI_DEFAULT_PROVIDER || process.env.CSCA_AI_PROVIDER || 'rule-fallback';
}

function modelName() {
  return process.env.CSCA_AI_MODEL || process.env.DEEPSEEK_PERSONAL_DEFAULT_MODEL || process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-flash';
}

function promptVersion() {
  return resolveCoachPromptVersion(process.env.CSCA_AI_PROMPT_VERSION || DEFAULT_COACH_PROMPT_VERSION);
}

function temperature() {
  const value = Number(process.env.CSCA_AI_TEMPERATURE ?? DEFAULT_TEMPERATURE);
  return Number.isFinite(value) && value >= 0 && value <= 2 ? value : DEFAULT_TEMPERATURE;
}

function timeoutMs() {
  const value = Number(process.env.CSCA_AI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function maxOutputChars() {
  const value = Number(process.env.CSCA_AI_MAX_OUTPUT_CHARS ?? DEFAULT_MAX_OUTPUT_CHARS);
  return Number.isInteger(value) && value >= 200 ? value : DEFAULT_MAX_OUTPUT_CHARS;
}

function rolloutPercent() {
  const value = Number(process.env.CSCA_AI_ROLLOUT_PERCENT ?? 100);
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.floor(value)));
}

function rolloutBucket(userId: number) {
  let hash = 0;
  for (const char of String(userId)) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return hash % 100;
}

function rolloutAllowsUser(userId: number | undefined) {
  const percent = rolloutPercent();
  if (percent >= 100) return true;
  if (percent <= 0 || !userId) return false;
  return rolloutBucket(userId) < percent;
}

function baseUrl() {
  return (process.env.CSCA_AI_BASE_URL || process.env.DEEPSEEK_PERSONAL_BASE_URL || process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function normalizeBaseUrl(value: string | null | undefined) {
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function safeBaseUrlHost() {
  try {
    return new URL(baseUrl()).host;
  } catch {
    return 'invalid-url';
  }
}

function outputStatus(request: AICoachProviderRequest, output: string) {
  if (!output) return 'provider_empty_output';
  if (output.length > maxOutputChars()) return 'provider_output_too_long';
  if (/api\s*key|bearer\s+[a-z0-9._-]+|system prompt|developer message|系统提示|开发者提示|内部配置/i.test(output)) {
    return 'provider_output_rejected';
  }
  const language = requestLanguage(request);
  if (request.type === 'hint' && /正确答案|答案是|应选|选择\s*[A-D]|选项\s*[A-D]|correct answer|answer is|choose\s*[A-D]|đáp án đúng|chọn\s*[A-D]/i.test(output)) {
    return 'provider_hint_revealed_answer';
  }
  if (language !== 'zh' && hasHan(output)) return 'provider_output_language_mismatch';
  if (request.type === 'round_summary' && !(
    (/【本轮判断】/.test(output) && /【下一步重点】/.test(output) && /【一个动作】/.test(output))
    || (/\[This round\]/.test(output) && /\[Next focus\]/.test(output) && /\[One action\]/.test(output))
    || (/\[Nhận định vòng này\]/.test(output) && /\[Trọng tâm tiếp theo\]/.test(output) && /\[Một hành động\]/.test(output))
  )) {
    return 'provider_round_summary_invalid';
  }
  if (request.type === 'explain_wrong_answer') {
    try {
      const parsed = JSON.parse(output);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'provider_explanation_schema_invalid';
      const record = parsed as Record<string, unknown>;
      const keys = ['whyWrong', 'correctApproach', 'quickMethod', 'avoidNextTime'];
      if (!keys.every((key) => typeof record[key] === 'string' && String(record[key]).trim().length >= 4)) {
        return 'provider_explanation_schema_invalid';
      }
      if (language !== 'zh' && keys.some((key) => hasHan(String(record[key] ?? '')))) {
        return 'provider_output_language_mismatch';
      }
    } catch {
      return 'provider_explanation_schema_invalid';
    }
  }
  if (request.type === 'planner_assistant') {
    try {
      const parsed = JSON.parse(output);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'provider_planner_schema_invalid';
      const record = parsed as Record<string, unknown>;
      if (typeof record.summary !== 'string' || record.summary.trim().length < 4) return 'provider_planner_schema_invalid';
      if (!Array.isArray(record.actions) || record.actions.some((item) => typeof item !== 'string' || !item.trim())) return 'provider_planner_schema_invalid';
      if (!Array.isArray(record.plannedTopics) || !record.plannedTopics.length) return 'provider_planner_schema_invalid';
      const topics = record.plannedTopics as Array<Record<string, unknown>>;
      if (topics.some((topic) => !Number.isInteger(Number(topic.topicId)) || typeof topic.targetDifficulty !== 'string' || typeof topic.reason !== 'string')) {
        return 'provider_planner_schema_invalid';
      }
      if (language !== 'zh' && hasHan(record.summary)) return 'provider_output_language_mismatch';
      if (language !== 'zh' && record.actions.some((item) => hasHan(String(item)))) return 'provider_output_language_mismatch';
    } catch {
      return 'provider_planner_schema_invalid';
    }
  }
  return 'success';
}

function requestLanguage(request: AICoachProviderRequest) {
  if (!request.input || typeof request.input !== 'object' || Array.isArray(request.input)) return 'zh';
  const language = String((request.input as { language?: unknown }).language ?? 'zh').trim().toLowerCase();
  if (language === 'vi' || language.startsWith('vi-')) return 'vi';
  if (language === 'en' || language.startsWith('en-')) return 'en';
  return 'zh';
}

function hasHan(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function promptTemplateReady() {
  const requestedPromptVersion = process.env.CSCA_AI_PROMPT_VERSION || DEFAULT_COACH_PROMPT_VERSION;
  const activePromptVersion = resolveCoachPromptVersion(requestedPromptVersion);
  const check = validateCoachPromptTemplate(activePromptVersion);
  return isSupportedCoachPromptVersion(requestedPromptVersion) && check.valid;
}

@Injectable()
export class AICoachProviderService {
  private readonly gateway: AiGatewayService;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    gateway?: AiGatewayService
  ) {
    if (!gateway) throw new Error('AiGatewayService is required for AICoachProviderService.');
    this.gateway = gateway;
  }

  private externalConfigReady() {
    const provider = providerName();
    return enabled(process.env.CSCA_AI_COACH_ENABLED)
      && provider !== 'rule-fallback'
      && SUPPORTED_PROVIDERS.has(provider)
      && Boolean(modelName())
      && this.gateway.hasConfiguredKey('ai_coach_hint', modelName())
      && promptTemplateReady();
  }

  isExternalEnabled(context?: { userId?: number }) {
    return this.externalConfigReady() && rolloutAllowsUser(context?.userId);
  }

  async runtimeConfig(context?: { userId?: number }): Promise<AICoachRuntimeProviderConfig | null> {
    const organizationConfig = context?.userId ? await this.organizationRuntimeConfig(context.userId) : null;
    if (organizationConfig) return organizationConfig;
    if (!this.isExternalEnabled(context)) return null;
    return {
      source: 'platform',
      provider: providerName(),
      model: modelName(),
      baseUrl: baseUrl()
    };
  }

  configStatus() {
    const provider = providerName();
    const model = modelName();
    const externalToggleEnabled = enabled(process.env.CSCA_AI_COACH_ENABLED);
    const supported = provider === 'rule-fallback' || SUPPORTED_PROVIDERS.has(provider);
    const requestedPromptVersion = process.env.CSCA_AI_PROMPT_VERSION || DEFAULT_COACH_PROMPT_VERSION;
    const promptVersionSupported = isSupportedCoachPromptVersion(requestedPromptVersion);
    const activePromptVersion = promptVersion();
    const promptTemplateCheck = validateCoachPromptTemplate(activePromptVersion);
    const percent = rolloutPercent();
    const apiKeyConfigured = this.gateway.hasConfiguredKey('ai_coach_hint', model);
    const externalReady = externalToggleEnabled && provider !== 'rule-fallback' && supported && apiKeyConfigured && Boolean(model) && promptVersionSupported && promptTemplateCheck.valid && percent > 0;
    const blockers = [
      externalToggleEnabled ? null : 'CSCA_AI_COACH_ENABLED is off',
      provider === 'rule-fallback' ? 'CSCA_AI_PROVIDER is rule-fallback' : null,
      supported ? null : 'CSCA_AI_PROVIDER is unsupported',
      apiKeyConfigured ? null : 'AI Gateway provider key is missing',
      model ? null : 'CSCA_AI_MODEL is missing',
      promptVersionSupported ? null : 'CSCA_AI_PROMPT_VERSION is unsupported',
      promptTemplateCheck.valid ? null : `Prompt template safety check failed: ${promptTemplateCheck.issues.join(', ')}`,
      percent > 0 ? null : 'CSCA_AI_ROLLOUT_PERCENT is 0'
    ].filter(Boolean) as string[];

    return {
      mode: externalReady ? 'external' : 'rule-fallback',
      externalReady,
      externalToggleEnabled,
      provider,
      supported,
      model: externalReady ? model : (model || RULE_MODEL),
      promptVersion: externalReady ? activePromptVersion : RULE_PROMPT_VERSION,
      requestedPromptVersion,
      activePromptVersion,
      promptVersionSupported,
      supportedPromptVersions: supportedCoachPromptVersions(),
      promptTemplateCheck,
      apiKeyConfigured,
      baseUrlHost: safeBaseUrlHost(),
      timeoutMs: timeoutMs(),
      temperature: temperature(),
      maxOutputChars: maxOutputChars(),
      rollout: {
        percent,
        strategy: percent >= 100 ? 'all_users' : percent <= 0 ? 'fallback_only' : 'stable_user_percent'
      },
      fallbackModel: RULE_MODEL,
      fallbackPromptVersion: RULE_PROMPT_VERSION,
      blockers
    };
  }

  configuredProvider(context?: { userId?: number }) {
    return this.isExternalEnabled(context) ? providerName() : 'rule-fallback';
  }

  configuredModel(context?: { userId?: number }) {
    return this.isExternalEnabled(context) ? modelName() : RULE_MODEL;
  }

  fallback(request: AICoachProviderRequest, status = 'success'): ProviderCompletion {
    return {
      output: request.fallbackOutput,
      provider: 'rule-fallback',
      model: RULE_MODEL,
      promptVersion: RULE_PROMPT_VERSION,
      input: request.input,
      status
    };
  }

  async generate(request: AICoachProviderRequest): Promise<ProviderCompletion> {
    if (request.forceFallbackReason) return this.fallback(request, request.forceFallbackReason);
    const runtime = request.providerConfig ?? await this.runtimeConfig({ userId: request.userId });
    if (!runtime) return this.fallback(request);
    if (!SUPPORTED_PROVIDERS.has(runtime.provider)) return this.fallback(request, 'provider_not_supported');

    const messages = buildCoachMessages(request, process.env.CSCA_AI_PROMPT_VERSION).messages as AiGatewayMessage[];
    const response = await this.gateway.complete({
      taskType: coachTaskType(request.type),
      sourceModule: 'ai_coach',
      messages,
      modelHint: runtime.model,
      responseFormat: coachResponseFormat(request.type),
      temperature: temperature(),
      timeoutMs: timeoutMs(),
      userId: request.userId,
      organizationId: runtime.organizationId,
      providerConfigOverride: runtime.source === 'organization' && runtime.apiKey ? {
        source: 'organization',
        provider: runtime.provider,
        model: runtime.model,
        apiKey: runtime.apiKey,
        baseUrl: runtime.baseUrl,
        organizationId: runtime.organizationId,
        providerConfigId: runtime.providerConfigId
      } : undefined,
      metadata: {
        coachType: request.type,
        promptVersion: promptVersion(),
        providerSource: runtime.source,
        organizationProviderConfigId: runtime.providerConfigId ?? null
      }
    });
    if (response.status !== 'success') return this.fallback(request, response.errorCode ?? response.status);
    const output = response.content.trim();
    const status = outputStatus(request, output);
    if (status !== 'success') return this.fallback(request, status);
    return {
      output: output || request.fallbackOutput,
      provider: response.providerId,
      model: response.model,
      promptVersion: promptVersion(),
      input: request.input,
      status: 'success'
    };
  }

  private async organizationRuntimeConfig(userId: number): Promise<AICoachRuntimeProviderConfig | null> {
    if (!this.prisma) return null;
    const memberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'active',
        organization: {
          status: 'active',
          aiCreditPool: {
            status: 'active',
            availableCredits: { gt: 0 },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          llmProviderConfigs: { some: { status: 'active' } }
        }
      },
      include: {
        organization: {
          include: {
            llmProviderConfigs: {
              where: { status: 'active' },
              orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
              take: 1
            }
          }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 10
    });
    const eligibleMembership = memberships.find((membership) => organizationRoleAllows(membership.role, 'use_ai_pool')) ?? null;
    const config = eligibleMembership?.organization.llmProviderConfigs[0];
    if (!eligibleMembership || !config || !SUPPORTED_PROVIDERS.has(config.provider) || !config.model) return null;
    const apiKey = decryptApiSecretFromStorage(config.encryptedApiKey);
    if (!apiKey) return null;
    return {
      source: 'organization',
      provider: config.provider,
      model: config.model,
      apiKey,
      baseUrl: normalizeBaseUrl(config.baseUrl),
      organizationId: eligibleMembership.organization.id,
      providerConfigId: config.id
    };
  }
}

function coachTaskType(type: string): AiTaskType {
  if (type === 'hint') return 'ai_coach_hint';
  if (type === 'explain_wrong_answer') return 'wrong_question_explanation';
  return 'ai_coach_explanation';
}

function coachResponseFormat(type: string): AiGatewayResponseFormat {
  return type === 'explain_wrong_answer' || type === 'planner_assistant' ? 'json' : 'text';
}
