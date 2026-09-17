import { Injectable } from '@nestjs/common';

type AIUsageInput = {
  type: string;
  provider: string;
  model: string;
  promptVersion: string;
  input: unknown;
  output: string;
  startedAt: number;
  status?: string;
};

const DEFAULT_UNIT_TOKEN_BUDGET = 2000;
const DEFAULT_CURRENCY = 'USD';

function readNonNegativeNumber(name: string, fallback = 0) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function roundMoney(value: number) {
  return Number(value.toFixed(6));
}

function estimateTokens(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? {});
  return Math.max(1, Math.ceil(text.length / 4));
}

@Injectable()
export class AIUsageMeterService {
  configStatus() {
    const inputCostPer1KTokens = readNonNegativeNumber('CSCA_AI_INPUT_COST_PER_1K_TOKENS');
    const outputCostPer1KTokens = readNonNegativeNumber('CSCA_AI_OUTPUT_COST_PER_1K_TOKENS');
    const unitTokenBudget = readPositiveInt('CSCA_AI_UNIT_TOKEN_BUDGET', DEFAULT_UNIT_TOKEN_BUDGET);
    return {
      pricingConfigured: inputCostPer1KTokens > 0 || outputCostPer1KTokens > 0,
      currency: process.env.CSCA_AI_COST_CURRENCY || DEFAULT_CURRENCY,
      inputCostPer1KTokens,
      outputCostPer1KTokens,
      unitTokenBudget,
      meteringMode: 'estimate'
    };
  }

  measure(input: AIUsageInput) {
    const inputTokensEstimate = estimateTokens(input.input);
    const outputTokensEstimate = estimateTokens(input.output);
    const totalTokensEstimate = inputTokensEstimate + outputTokensEstimate;
    const isBillable = input.provider !== 'rule-fallback' && (input.status ?? 'success') === 'success';
    const inputCostPer1KTokens = readNonNegativeNumber('CSCA_AI_INPUT_COST_PER_1K_TOKENS');
    const outputCostPer1KTokens = readNonNegativeNumber('CSCA_AI_OUTPUT_COST_PER_1K_TOKENS');
    const pricingConfigured = inputCostPer1KTokens > 0 || outputCostPer1KTokens > 0;
    const unitTokenBudget = readPositiveInt('CSCA_AI_UNIT_TOKEN_BUDGET', DEFAULT_UNIT_TOKEN_BUDGET);
    const unitEstimate = isBillable ? Math.max(1, Math.ceil(totalTokensEstimate / unitTokenBudget)) : 0;
    const costEstimate = isBillable
      ? roundMoney((inputTokensEstimate / 1000) * inputCostPer1KTokens + (outputTokensEstimate / 1000) * outputCostPer1KTokens)
      : 0;
    return {
      tokenUsage: {
        abilityType: input.type,
        provider: input.provider,
        model: input.model,
        promptVersion: input.promptVersion,
        status: input.status ?? 'success',
        inputTokensEstimate,
        outputTokensEstimate,
        totalTokensEstimate,
        latencyMs: Math.max(0, Date.now() - input.startedAt),
        billable: isBillable,
        meteringMode: 'estimate',
        pricingConfigured,
        currency: process.env.CSCA_AI_COST_CURRENCY || DEFAULT_CURRENCY,
        inputCostPer1KTokens,
        outputCostPer1KTokens,
        unitTokenBudget,
        unitEstimate
      },
      costEstimate,
      status: input.status ?? 'success'
    };
  }
}
