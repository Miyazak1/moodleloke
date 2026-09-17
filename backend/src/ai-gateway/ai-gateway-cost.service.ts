import { Injectable } from '@nestjs/common';

type AiGatewayCostEstimateInput = {
  model?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

export type AiGatewayCostEstimate = {
  estimatedCostUsd: number;
  estimatedCostDisplay: number;
  costCurrency: string;
  displayCurrency: string;
  usdToDisplayRate: number;
  pricing: {
    inputPer1MTokens: number;
    outputPer1MTokens: number;
  };
};

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

@Injectable()
export class AiGatewayCostService {
  private readonly costCurrency = process.env.AI_GATEWAY_COST_CURRENCY || 'USD';
  private readonly displayCurrency = process.env.AI_GATEWAY_DISPLAY_CURRENCY || 'CNY';
  private readonly usdToDisplayRate = readNumberEnv('AI_GATEWAY_USD_CNY_RATE', 7.25);

  estimate(input: AiGatewayCostEstimateInput): AiGatewayCostEstimate | null {
    if (input.promptTokens == null || input.completionTokens == null) return null;

    const promptTokens = Number(input.promptTokens);
    const completionTokens = Number(input.completionTokens);
    if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
    if (promptTokens <= 0 && completionTokens <= 0) return null;

    const pricing = this.pricingForModel(input.model);
    const estimatedCostUsd = (Math.max(0, promptTokens) / 1_000_000) * pricing.inputPer1MTokens
      + (Math.max(0, completionTokens) / 1_000_000) * pricing.outputPer1MTokens;

    return {
      estimatedCostUsd: round(estimatedCostUsd, 8),
      estimatedCostDisplay: this.convertUsdToDisplay(estimatedCostUsd),
      costCurrency: this.costCurrency,
      displayCurrency: this.displayCurrency,
      usdToDisplayRate: this.usdToDisplayRate,
      pricing
    };
  }

  convertUsdToDisplay(value: number) {
    return round(Math.max(0, Number(value) || 0) * this.usdToDisplayRate, 4);
  }

  metadata() {
    return {
      costCurrency: this.costCurrency,
      displayCurrency: this.displayCurrency,
      usdToDisplayRate: this.usdToDisplayRate,
      pricing: {
        deepseekV4Flash: this.v4FlashPricing(),
        deepseekV4Pro: this.v4ProPricing(),
        deepseekChat: this.chatPricing(),
        deepseekReasoner: this.reasonerPricing()
      }
    };
  }

  private pricingForModel(model?: string) {
    if (/deepseek-v4-pro/i.test(model || '')) return this.v4ProPricing();
    if (/deepseek-(?:v4-)?flash/i.test(model || '')) return this.v4FlashPricing();
    return /reasoner/i.test(model || '') ? this.reasonerPricing() : this.chatPricing();
  }

  private v4FlashPricing() {
    return {
      inputPer1MTokens: readNumberEnv('DEEPSEEK_V4_FLASH_INPUT_COST_PER_1M_TOKENS', 0.44),
      outputPer1MTokens: readNumberEnv('DEEPSEEK_V4_FLASH_OUTPUT_COST_PER_1M_TOKENS', 1.32)
    };
  }

  private v4ProPricing() {
    return {
      inputPer1MTokens: readNumberEnv('DEEPSEEK_V4_PRO_INPUT_COST_PER_1M_TOKENS', 1.32),
      outputPer1MTokens: readNumberEnv('DEEPSEEK_V4_PRO_OUTPUT_COST_PER_1M_TOKENS', 3.96)
    };
  }

  private chatPricing() {
    return {
      inputPer1MTokens: readNumberEnv('DEEPSEEK_CHAT_INPUT_COST_PER_1M_TOKENS', 0.27),
      outputPer1MTokens: readNumberEnv('DEEPSEEK_CHAT_OUTPUT_COST_PER_1M_TOKENS', 1.1)
    };
  }

  private reasonerPricing() {
    return {
      inputPer1MTokens: readNumberEnv('DEEPSEEK_REASONER_INPUT_COST_PER_1M_TOKENS', 0.55),
      outputPer1MTokens: readNumberEnv('DEEPSEEK_REASONER_OUTPUT_COST_PER_1M_TOKENS', 2.19)
    };
  }
}
