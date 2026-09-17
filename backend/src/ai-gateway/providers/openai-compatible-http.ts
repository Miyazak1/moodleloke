import { AiGatewayErrorCode, AiProviderRequest, AiProviderResponse } from '../ai-gateway.types';

function errorCodeFromProviderMessage(message: string): AiGatewayErrorCode | null {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('insufficient balance')
    || normalized.includes('insufficient credit')
    || normalized.includes('quota exceeded')
    || normalized.includes('out of quota')
    || normalized.includes('billing')
  ) return 'provider_quota_exceeded';
  return null;
}

function errorCodeFromHttp(status: number, message = ''): AiGatewayErrorCode {
  const messageCode = errorCodeFromProviderMessage(message);
  if (messageCode) return messageCode;
  if (status === 401 || status === 403) return 'provider_auth_error';
  if (status === 408) return 'provider_timeout';
  if (status === 429) return 'provider_rate_limited';
  if (status >= 500) return 'provider_unavailable';
  if (status >= 400) return 'provider_bad_request';
  return 'gateway_unknown_error';
}

function errorCodeFromException(error: unknown): AiGatewayErrorCode {
  const record = error && typeof error === 'object' ? error as { name?: unknown; code?: unknown; message?: unknown } : {};
  const cause = error && typeof error === 'object' ? (error as { cause?: unknown }).cause : null;
  const causeRecord = cause && typeof cause === 'object' ? cause as { code?: unknown; message?: unknown; name?: unknown } : {};
  const text = `${String(record.name ?? '')} ${String(record.code ?? '')} ${String(record.message ?? '')} ${String(causeRecord.name ?? '')} ${String(causeRecord.code ?? '')} ${String(causeRecord.message ?? '')}`.toLowerCase();
  if (text.includes('abort') || text.includes('timeout')) return 'provider_timeout';
  if (text.includes('enotfound') || text.includes('econn') || text.includes('network') || text.includes('fetch')) return 'provider_network_error';
  return 'gateway_unknown_error';
}

function compactExceptionDiagnostic(error: unknown) {
  const record = error && typeof error === 'object'
    ? error as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown }
    : { message: error };
  const cause = record.cause && typeof record.cause === 'object'
    ? record.cause as { name?: unknown; code?: unknown; message?: unknown }
    : null;
  const clean = (value: unknown) => String(value ?? '')
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[a-z0-9._-]+/gi, '[redacted-key]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const parts = [
    clean(record.name),
    clean(record.code),
    clean(record.message),
    cause ? `cause=${[clean(cause.name), clean(cause.code), clean(cause.message)].filter(Boolean).join('/')}` : ''
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : 'unknown_exception';
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return { text, json: null };
  try {
    return { text, json: JSON.parse(text) as unknown };
  } catch {
    return { text, json: null };
  }
}

function providerErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fallback;
  const error = (body as { error?: unknown }).error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return fallback;
}

function messageContentText(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (!Array.isArray(value)) return '';
  return value
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object' || Array.isArray(part)) return '';
      const record = part as { text?: unknown; content?: unknown };
      return typeof record.text === 'string'
        ? record.text
        : typeof record.content === 'string'
          ? record.content
          : '';
    })
    .join('')
    .trim();
}

function messagesWithJsonFinalDeliveryGuard(request: AiProviderRequest) {
  if (request.responseFormat !== 'json') return request.messages;
  const guard = 'Final delivery contract: put the complete valid JSON object in message.content. Do not leave content empty. Do not return reasoning_content without a final JSON object. If hidden reasoning is used, still finish with the JSON object in message.content and no prose before or after it.';
  const messages = request.messages.map((message) => ({ ...message }));
  const systemIndex = messages.findIndex((message) => message.role === 'system');
  if (systemIndex >= 0) {
    messages[systemIndex] = {
      ...messages[systemIndex],
      content: `${messages[systemIndex].content} ${guard}`
    };
    return messages;
  }
  return [{ role: 'system' as const, content: guard }, ...messages];
}

export async function openAiCompatibleChatCompletion(request: AiProviderRequest): Promise<AiProviderResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(`${request.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${request.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature,
        thinking: request.thinking ? { type: request.thinking } : undefined,
        reasoning_effort: request.reasoningEffort,
        max_tokens: request.maxTokens,
        response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
        messages: messagesWithJsonFinalDeliveryGuard(request)
      })
    });
    const body = await readBody(response);
    if (!response.ok) {
      const errorMessage = providerErrorMessage(body.json, `Provider returned HTTP ${response.status}.`);
      const errorCode = errorCodeFromHttp(response.status, errorMessage);
      return {
        status: 'failed',
        content: '',
        raw: body.json ?? body.text,
        providerStatusCode: response.status,
        errorCode,
        errorMessage
      };
    }
    const json = body.json as {
      choices?: Array<{
        finish_reason?: unknown;
        message?: { content?: unknown; reasoning_content?: unknown };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    } | null;
    const choice = json?.choices?.[0];
    const content = messageContentText(choice?.message?.content);
    const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason.trim() : '';
    if (request.responseFormat === 'json' && finishReason === 'length') {
      return {
        status: 'failed',
        content: '',
        raw: body.json ?? body.text,
        usage: json?.usage ? {
          promptTokens: json.usage.prompt_tokens,
          completionTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens
        } : undefined,
        providerStatusCode: response.status,
        errorCode: 'provider_schema_invalid',
        errorMessage: `Provider returned truncated JSON output (finishReason=length; contentLength=${content.length}).`
      };
    }
    if (!content) {
      const reasoningContent = typeof choice?.message?.reasoning_content === 'string'
        ? choice.message.reasoning_content.trim()
        : '';
      const diagnostics = [
        finishReason ? `finishReason=${finishReason}` : '',
        reasoningContent ? `reasoningContentWithoutFinal=${reasoningContent.length}` : '',
        Array.isArray(choice?.message?.content) ? 'contentShape=array_without_text' : ''
      ].filter(Boolean).join('; ');
      return {
        status: 'failed',
        content: '',
        raw: body.json ?? body.text,
        providerStatusCode: response.status,
        errorCode: 'provider_empty_output',
        errorMessage: diagnostics
          ? `Provider returned empty final output (${diagnostics}).`
          : 'Provider returned empty final output.'
      };
    }
    return {
      status: 'success',
      content,
      raw: body.json ?? body.text,
      usage: json?.usage ? {
        promptTokens: json.usage.prompt_tokens,
        completionTokens: json.usage.completion_tokens,
        totalTokens: json.usage.total_tokens
      } : undefined,
      providerStatusCode: response.status
    };
  } catch (error) {
    const errorCode = errorCodeFromException(error);
    const diagnostics = compactExceptionDiagnostic(error);
    return {
      status: 'failed',
      content: '',
      errorCode,
      errorMessage: errorCode === 'provider_timeout'
        ? `Provider request timed out (${diagnostics}).`
        : `Provider request failed (${diagnostics}).`
    };
  } finally {
    clearTimeout(timeout);
  }
}
