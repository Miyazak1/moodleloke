import { Injectable } from '@nestjs/common';
import { AiProvider, AiProviderHealth, AiProviderRequest, AiProviderResponse } from '../ai-gateway.types';
import { openAiCompatibleChatCompletion, openAiCompatibleChatCompletionStream } from './openai-compatible-http';

@Injectable()
export class DeepSeekProvider implements AiProvider {
  readonly providerId = 'deepseek';
  readonly displayName = 'DeepSeek';
  readonly protocol = 'openai-compatible' as const;

  complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    return request.onTextDelta
      ? openAiCompatibleChatCompletionStream(request)
      : openAiCompatibleChatCompletion(request);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    return { providerId: this.providerId, status: 'healthy' };
  }
}
