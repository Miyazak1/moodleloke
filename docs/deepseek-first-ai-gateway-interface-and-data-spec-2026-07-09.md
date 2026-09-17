# DeepSeek First AI Gateway 接口与数据结构规格

日期：2026-07-09

配套主文档：

- `docs/deepseek-first-ai-gateway-executable-plan-2026-07-09.md`
- `docs/deepseek-first-ai-gateway-callsite-audit-2026-07-09.md`

## 1. 目的

本文档定义 Phase 1 可以直接实现的接口、类型、配置、错误码和数据结构。

核心要求：

- 当前只实现 DeepSeek。
- 业务代码只调用 `AiGatewayService`。
- Provider 和 Key Pool 可扩展。
- 第一阶段可以先用环境变量，不强制新增数据库表。
- 调用日志必须落库或至少进入现有 AI observability ledger；如果第一阶段不落库，必须保留接口边界，不能把日志散落在业务层。

## 2. 模块结构建议

建议新增目录：

```text
backend/src/ai-gateway/
  ai-gateway.module.ts
  ai-gateway.service.ts
  ai-gateway.types.ts
  ai-gateway-config.service.ts
  ai-gateway-ledger.service.ts
  ai-gateway-key-pool.service.ts
  ai-gateway-concurrency.service.ts
  providers/
    deepseek.provider.ts
    openai-compatible-http.ts
```

说明：

- `openai-compatible-http.ts` 封装兼容 `/chat/completions` 的 HTTP 细节。
- `deepseek.provider.ts` 使用 DeepSeek 配置调用兼容 HTTP。
- 未来 OpenAI、Gemini、Claude 各自新增 provider 文件。

## 3. Task Type

```ts
export type AiTaskType =
  | 'ai_coach_hint'
  | 'ai_coach_explanation'
  | 'wrong_question_explanation'
  | 'question_generation'
  | 'question_review'
  | 'question_repair'
  | 'topic_mapping'
  | 'translation'
  | 'admin_assistant'
  | 'batch_backfill';
```

任务配置：

```ts
export type AiTaskRuntimeClass = 'realtime' | 'background';

export interface AiTaskPolicy {
  taskType: AiTaskType;
  priority: number;
  runtimeClass: AiTaskRuntimeClass;
  defaultTimeoutMs: number;
  maxRetries: number;
  responseFormat: 'text' | 'json' | 'either';
}
```

默认策略：

| taskType | priority | runtimeClass | timeout | retries |
| --- | ---: | --- | ---: | ---: |
| ai_coach_hint | 100 | realtime | 15000 | 1 |
| ai_coach_explanation | 95 | realtime | 15000 | 1 |
| wrong_question_explanation | 90 | realtime | 15000 | 1 |
| question_review | 60 | background | 30000 | 2 |
| question_repair | 55 | background | 60000 | 2 |
| question_generation | 50 | background | 90000 | 2 |
| topic_mapping | 45 | background | 30000 | 1 |
| translation | 40 | background | 30000 | 2 |
| admin_assistant | 45 | background | 30000 | 1 |
| batch_backfill | 20 | background | 90000 | 3 |

## 4. Gateway Service 接口

### 4.1 主入口

```ts
export interface AiGatewayService {
  complete(request: AiGatewayRequest): Promise<AiGatewayResponse>;
  health(): Promise<AiGatewayHealthSnapshot>;
}
```

### 4.2 Request

```ts
export interface AiGatewayRequest {
  taskType: AiTaskType;
  sourceModule: string;
  messages: AiGatewayMessage[];
  modelHint?: string;
  providerHint?: string;
  responseFormat?: 'text' | 'json';
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  userId?: number;
  organizationId?: number;
  requestId?: string;
  idempotencyKey?: string;
  providerConfigOverride?: AiRuntimeProviderConfig;
  metadata?: Record<string, unknown>;
}
```

字段说明：

- `taskType`：必须传。
- `sourceModule`：例如 `ai_coach`、`question_generator`、`question_reviewer`。
- `providerHint`：未来多 Provider 时可提示，但不能绕过 Gateway 策略。
- `providerConfigOverride`：用于机构 BYOK Phase 1 兼容。
- `idempotencyKey`：用于缓存和重复请求识别。
- `metadata`：记录业务上下文，不允许放明文 API Key。

### 4.3 Message

```ts
export interface AiGatewayMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

Phase 1 只支持 OpenAI-compatible chat messages。

### 4.4 Response

```ts
export interface AiGatewayResponse {
  requestId: string;
  taskType: AiTaskType;
  providerId: string;
  model: string;
  keyId: string;
  status: AiGatewayStatus;
  content: string;
  json?: unknown;
  usage?: AiGatewayUsage;
  latencyMs: number;
  attempts: AiGatewayAttempt[];
  errorCode?: AiGatewayErrorCode;
  errorMessage?: string;
  raw?: unknown;
}
```

### 4.5 Status

```ts
export type AiGatewayStatus =
  | 'success'
  | 'failed'
  | 'fallback'
  | 'cancelled'
  | 'timeout'
  | 'rate_limited'
  | 'provider_unavailable';
```

Gateway 不负责判断“题目 JSON 是否合格”。只负责 Provider 调用是否完成。

## 5. Provider 接口

```ts
export interface AiProvider {
  readonly providerId: string;
  readonly displayName: string;
  readonly protocol: 'openai-compatible' | 'native';

  complete(request: AiProviderRequest): Promise<AiProviderResponse>;
  healthCheck(): Promise<AiProviderHealth>;
}
```

```ts
export interface AiProviderRequest {
  requestId: string;
  taskType: AiTaskType;
  messages: AiGatewayMessage[];
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  timeoutMs: number;
}
```

```ts
export interface AiProviderResponse {
  status: 'success' | 'failed';
  content: string;
  raw?: unknown;
  usage?: AiGatewayUsage;
  providerStatusCode?: number;
  errorCode?: AiGatewayErrorCode;
  errorMessage?: string;
}
```

## 6. Runtime Provider Config

```ts
export interface AiRuntimeProviderConfig {
  source: 'platform' | 'organization' | 'override';
  providerId: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  organizationId?: number;
  providerConfigId?: number;
}
```

使用场景：

- Phase 1 机构 BYOK 由 AI Coach 层解析后传入 override。
- Phase 2 以后改为 Gateway 自己按 organizationId 解析 key。

## 7. Key Pool 结构

```ts
export interface AiProviderKey {
  keyId: string;
  providerId: string;
  source: 'env' | 'database' | 'organization';
  apiKey: string;
  baseUrl: string;
  model?: string;
  organizationId?: number;
  enabled: boolean;
  maxConcurrency: number;
  requestsPerMinute?: number;
  requestsPerDay?: number;
}
```

运行时状态：

```ts
export interface AiProviderKeyRuntimeState {
  keyId: string;
  providerId: string;
  enabled: boolean;
  currentConcurrency: number;
  requestsInCurrentMinute: number;
  requestsInCurrentDay: number;
  failuresInWindow: number;
  timeoutCountInWindow: number;
  rateLimitCountInWindow: number;
  averageLatencyMs: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  cooldownUntil?: Date;
  cooldownReason?: AiGatewayErrorCode;
}
```

Key 选择返回：

```ts
export interface AiKeyReservation {
  key: AiProviderKey;
  release(result: AiGatewayAttemptResult): Promise<void> | void;
}
```

## 8. 并发控制接口

```ts
export interface AiConcurrencyReservation {
  runtimeClass: AiTaskRuntimeClass;
  release(): void;
}
```

```ts
export interface AiGatewayConcurrencyService {
  reserve(policy: AiTaskPolicy): Promise<AiConcurrencyReservation>;
}
```

Phase 1 可先用进程内 semaphore。

Phase 2 如果多实例部署，应迁移到 Redis 或数据库锁。

## 9. 错误码

```ts
export type AiGatewayErrorCode =
  | 'provider_auth_error'
  | 'provider_rate_limited'
  | 'provider_timeout'
  | 'provider_network_error'
  | 'provider_unavailable'
  | 'provider_bad_request'
  | 'provider_schema_invalid'
  | 'provider_empty_output'
  | 'provider_output_rejected'
  | 'provider_quota_exceeded'
  | 'gateway_no_provider'
  | 'gateway_no_key_available'
  | 'gateway_concurrency_timeout'
  | 'gateway_cancelled'
  | 'gateway_unknown_error';
```

HTTP 映射：

| HTTP | errorCode |
| ---: | --- |
| 401/403 | provider_auth_error |
| 408 | provider_timeout |
| 429 | provider_rate_limited |
| 500+ | provider_unavailable |
| 400-499 | provider_bad_request |

异常映射：

| 异常 | errorCode |
| --- | --- |
| AbortError / timeout | provider_timeout |
| ENOTFOUND / ECONNRESET / fetch failed | provider_network_error |
| 其他 | gateway_unknown_error |

## 10. Ledger

### 10.1 Phase 1 最小 ledger

即使不新增表，也必须在 Gateway 内集中记录：

```ts
export interface AiGatewayLedgerEntry {
  requestId: string;
  taskType: AiTaskType;
  sourceModule: string;
  providerId: string;
  model: string;
  keyId: string;
  userId?: number;
  organizationId?: number;
  status: AiGatewayStatus;
  errorCode?: AiGatewayErrorCode;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  createdAt: Date;
}
```

第一阶段可落到：

- 现有 AI usage / observability 表，或
- 新增 `ai_gateway_call_logs`，或
- 结构化日志。

推荐新增表，便于后台观测和成本分析。

### 10.2 建议 Prisma Model

```prisma
model AiGatewayCallLog {
  id               Int      @id @default(autoincrement())
  requestId        String   @unique
  taskType         String
  sourceModule     String
  providerId       String
  model            String
  keyId            String
  userId           Int?
  organizationId   Int?
  status           String
  errorCode        String?
  errorMessage     String?
  latencyMs        Int
  promptTokens     Int?
  completionTokens Int?
  totalTokens      Int?
  estimatedCost    Decimal?
  metadata         Json?
  createdAt        DateTime @default(now())

  @@index([taskType, createdAt])
  @@index([providerId, createdAt])
  @@index([keyId, createdAt])
  @@index([userId, createdAt])
  @@index([organizationId, createdAt])
}
```

## 11. 配置解析

### 11.1 新配置

```env
AI_GATEWAY_ENABLED=true
AI_DEFAULT_PROVIDER=deepseek
AI_GATEWAY_GLOBAL_CONCURRENCY=5
AI_GATEWAY_REALTIME_CONCURRENCY=3
AI_GATEWAY_BACKGROUND_CONCURRENCY=2
AI_GATEWAY_DEFAULT_TIMEOUT_MS=30000
AI_GATEWAY_LEDGER_ENABLED=true

DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEYS=sk-xxx
DEEPSEEK_DEFAULT_MODEL=deepseek-chat
DEEPSEEK_REASONER_MODEL=deepseek-reasoner
DEEPSEEK_KEY_CONCURRENCY=2
DEEPSEEK_REQUESTS_PER_MINUTE=60
DEEPSEEK_REQUESTS_PER_DAY=5000
```

### 11.2 旧配置兼容

如果 `DEEPSEEK_API_KEYS` 为空，允许从旧配置读取：

```text
CSCA_AI_QUESTION_GENERATION_API_KEY
CSCA_AI_QUESTION_REVIEW_API_KEY
CSCA_AI_API_KEY
```

如果 `DEEPSEEK_DEFAULT_MODEL` 为空，允许从旧配置读取：

```text
CSCA_AI_QUESTION_GENERATION_MODEL
CSCA_AI_QUESTION_REVIEW_MODEL
CSCA_AI_MODEL
```

如果 provider 是 `openai-compatible` 且 baseUrl 指向 DeepSeek，也归一化为：

```text
providerId = deepseek
protocol = openai-compatible
```

## 12. 缓存接口

Phase 1 可不实现缓存，但接口预留：

```ts
export interface AiGatewayCachePolicy {
  enabled: boolean;
  ttlSeconds: number;
  cacheKey?: string;
}
```

`AiGatewayRequest` 后续可增加：

```ts
cache?: AiGatewayCachePolicy;
```

## 13. 健康状态

```ts
export interface AiGatewayHealthSnapshot {
  status: 'healthy' | 'degraded' | 'unavailable';
  providers: AiProviderHealthSnapshot[];
  queues: {
    realtimeRunning: number;
    realtimeQueued: number;
    backgroundRunning: number;
    backgroundQueued: number;
  };
}
```

```ts
export interface AiProviderHealthSnapshot {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  keys: Array<{
    keyId: string;
    enabled: boolean;
    currentConcurrency: number;
    cooldownUntil?: string;
    lastSuccessAt?: string;
    lastFailureAt?: string;
    averageLatencyMs: number;
  }>;
}
```

## 14. 安全要求

- Ledger 不允许记录明文 API Key。
- `metadata` 不允许包含 prompt 中的密钥。
- Provider 错误返回给前端时必须脱敏。
- BYOK key 继续使用现有 secret store 加密。
- `keyId` 使用 hash 或 label，不使用 key 前缀明文。

## 15. Phase 1 验收

- `AiGatewayModule` 可被 `AIQuestioningModule` 和 `CscaSpecialPracticeModule` 引入。
- 单 DeepSeek key 配置可完成 AI Coach、生成、审题。
- 所有调用都有 ledger entry。
- key 并发上限生效。
- realtime/background 并发隔离生效。
- 旧 env 配置仍可运行。
- provider auth/rate limit/timeout/network 错误有统一 errorCode。
