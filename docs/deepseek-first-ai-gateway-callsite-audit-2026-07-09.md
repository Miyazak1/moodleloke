# DeepSeek First AI Gateway 现有 AI 调用接入审计

日期：2026-07-09

配套主文档：

- `docs/deepseek-first-ai-gateway-executable-plan-2026-07-09.md`

## 1. 目的

本文档用于把当前代码中所有直接或间接调用 AI Provider 的位置列清楚，并定义迁移到 `AiGatewayService` 后的目标入口、任务类型、优先级和验收方式。

目标不是立即支持多个模型，而是先做到：

```text
所有 AI 调用 -> AI Gateway -> DeepSeek Provider -> DeepSeek Key Pool
```

当前实际 Provider 仍然可以只有 DeepSeek，但业务代码不再直接感知 DeepSeek/OpenAI-compatible 的请求细节。

## 2. 审计结论

当前 AI 调用分散在以下几类服务中：

| 模块 | 当前服务 | 当前职责 | 是否学生实时 | 迁移优先级 |
| --- | --- | --- | --- | --- |
| AI Coach | `AICoachProviderService` | 学生提示、解释、规划助手 | 是 | P0 |
| 科目/模考题生成 | `QuestionGeneratorProviderService` | 生成 AI 候选题 | 否 | P0 |
| AI 审题 | `QuestionReviewerProviderService` | LLM 审核候选题 | 否 | P0 |
| 真题题目映射 | `QuestionTopicMapperProviderService` | 真题题目映射到大纲 topic | 否 | P1 |
| 机构 BYOK | `AIEntitlementService` + `OrganizationLlmProviderConfig` | 机构配置自己的 provider key | 影响实时 | P1 |
| AI 运维观测 | `AIObservabilityService` / `AIUsageMeterService` | 统计 provider、成本、反馈 | 否 | P1 |

当前共同问题：

- Provider 调用逻辑分散。
- 每个服务各自读取 env。
- 每个服务各自实现 fetch、timeout、错误分类。
- 当前只支持 `openai` / `openai-compatible` 形态，DeepSeek 需要以兼容模式接入。
- 没有统一 Key Pool。
- 没有统一并发隔离。
- 没有统一 ledger。

## 3. 当前配置入口审计

### 3.1 平台 AI Coach

当前环境变量：

```env
CSCA_AI_COACH_ENABLED
CSCA_AI_PROVIDER
CSCA_AI_MODEL
CSCA_AI_API_KEY
CSCA_AI_BASE_URL
CSCA_AI_TIMEOUT_MS
CSCA_AI_TEMPERATURE
CSCA_AI_PROMPT_VERSION
CSCA_AI_MAX_OUTPUT_CHARS
CSCA_AI_ROLLOUT_PERCENT
```

当前行为：

- Provider 支持 `openai`、`openai-compatible`。
- 未启用或未命中灰度时使用规则 fallback。
- 支持机构 BYOK 优先于平台 key。
- 自己管理 timeout、输出安全检查、fallback。

迁移目标：

```text
AICoachProviderService
  -> AiGatewayService.complete(taskType = ai_coach_hint / ai_coach_explanation / wrong_question_explanation)
```

保留职责：

- 构造 AI Coach prompt。
- 校验输出是否泄露答案。
- 校验语言。
- 兜底文案。

迁移出去的职责：

- Provider 选择。
- API Key 获取。
- HTTP 调用。
- key 并发控制。
- Provider 错误分类。
- token/cost ledger。

### 3.2 AI 题目生成

当前服务：

```text
backend/src/ai-questioning/question-generator-provider.service.ts
```

当前环境变量：

```env
CSCA_AI_QUESTION_GENERATION_ENABLED
CSCA_AI_QUESTION_GENERATION_PROVIDER
CSCA_AI_QUESTION_GENERATION_MODEL
CSCA_AI_QUESTION_GENERATION_API_KEY
CSCA_AI_QUESTION_GENERATION_BASE_URL
CSCA_AI_QUESTION_GENERATION_TIMEOUT_MS
CSCA_AI_QUESTION_GENERATION_MAX_TOKENS
CSCA_AI_QUESTION_GENERATION_TEMPERATURE
CSCA_AI_PROVIDER
CSCA_AI_MODEL
CSCA_AI_API_KEY
CSCA_AI_BASE_URL
```

当前行为：

- 构造 prompt 后直接请求 `/chat/completions`。
- 要求 `response_format: { type: 'json_object' }`。
- JSON schema 不合法时返回 fallback candidate，并标记 `provider_schema_invalid`。
- HTTP/timeout/network 错误在本服务内分类。

迁移目标：

```text
QuestionGeneratorProviderService
  -> AiGatewayService.complete(taskType = question_generation, responseFormat = json)
```

保留职责：

- 构造题目生成 prompt。
- 归一化 provider 输出为 `GeneratedQuestionCandidate`。
- 处理业务 fallback candidate。
- 生成 agent metadata。

迁移出去的职责：

- DeepSeek/OpenAI-compatible HTTP 请求。
- API Key 读取。
- timeout。
- Provider HTTP 错误分类。
- Key Pool。
- 并发隔离。
- ledger。

### 3.3 AI 审题

当前服务：

```text
backend/src/ai-questioning/question-reviewer-provider.service.ts
```

当前环境变量：

```env
CSCA_AI_QUESTION_REVIEW_ENABLED
CSCA_AI_QUESTION_REVIEW_PROVIDER
CSCA_AI_QUESTION_REVIEW_MODEL
CSCA_AI_QUESTION_REVIEW_API_KEY
CSCA_AI_QUESTION_REVIEW_BASE_URL
CSCA_AI_QUESTION_REVIEW_TIMEOUT_MS
CSCA_AI_QUESTION_REVIEW_TEMPERATURE
CSCA_AI_PROVIDER
CSCA_AI_MODEL
CSCA_AI_API_KEY
CSCA_AI_BASE_URL
```

当前行为：

- 直接请求 `/chat/completions`。
- 要求 JSON 输出。
- provider 异常降级为 warning，不阻断 deterministic review。
- LLM 只作为审题增强，不是唯一门禁。

迁移目标：

```text
QuestionReviewerProviderService
  -> AiGatewayService.complete(taskType = question_review, responseFormat = json)
```

保留职责：

- 构造 reviewer prompt。
- 解析 reviewer JSON。
- 将 schema invalid 转换为业务 warning。
- 与 deterministic validator 合并结果。

迁移出去的职责：

- Provider 请求。
- API Key。
- timeout。
- key 选择。
- provider 错误分类。
- ledger。

### 3.4 真题 topic mapping

当前服务：

```text
backend/src/ai-questioning/question-topic-mapper-provider.service.ts
```

当前环境变量：

```env
CSCA_AI_TOPIC_MAPPING_ENABLED
CSCA_AI_TOPIC_MAPPING_PROVIDER
CSCA_AI_TOPIC_MAPPING_MODEL
CSCA_AI_TOPIC_MAPPING_API_KEY
CSCA_AI_TOPIC_MAPPING_BASE_URL
CSCA_AI_TOPIC_MAPPING_TIMEOUT_MS
CSCA_AI_TOPIC_MAPPING_TEMPERATURE
CSCA_AI_QUESTION_REVIEW_*
CSCA_AI_PROVIDER
```

当前行为：

- 直接请求 `/chat/completions`。
- 复用 review 或平台 Provider 配置。
- 失败时返回空 suggestions。

迁移目标：

```text
QuestionTopicMapperProviderService
  -> AiGatewayService.complete(taskType = topic_mapping, responseFormat = json)
```

备注：

- 主方案初始 taskType 表中未列 `topic_mapping`，Phase 1 应补充。
- topic mapping 属于后台任务，优先级低于学生实时和紧急补题。

### 3.5 机构 BYOK

当前相关位置：

```text
backend/src/csca-special-practice/ai-entitlement.service.ts
backend/src/csca-special-practice/ai-coach-provider.service.ts
frontend/src/pages/AdminOrganizationsPage.tsx
```

当前行为：

- 机构可以配置 `openai` / `openai-compatible`。
- `AICoachProviderService.runtimeConfig()` 会优先选择机构可用 Provider。
- API key 已有加密/解密路径。

迁移目标：

第一阶段：

- 不重做机构 BYOK 管理页面。
- `AiGatewayService` 支持 request 中带 `providerConfigOverride`。
- AI Coach 仍可解析机构配置，但调用 Gateway 时把运行时 provider config 作为 override 传入。

第二阶段：

- 机构 Provider Key 纳入 Gateway Key Pool。
- BYOK key 进入 `ai_provider_keys` 或复用现有 `OrganizationLlmProviderConfig` 后由 Gateway 统一读取。

## 4. 目标调用矩阵

| 当前调用点 | 目标 Gateway 方法 | taskType | responseFormat | 优先级 | 并发池 |
| --- | --- | --- | --- | ---: | --- |
| AI Coach hint | `complete` | `ai_coach_hint` | text | 100 | realtime |
| AI Coach explanation | `complete` | `ai_coach_explanation` | text/json | 95 | realtime |
| wrong question explanation | `complete` | `wrong_question_explanation` | json | 90 | realtime |
| question generation | `complete` | `question_generation` | json | 50 | background |
| mock exam generation | `complete` | `question_generation` | json | 50 | background |
| question review | `complete` | `question_review` | json | 60 | background |
| question repair | `complete` | `question_repair` | json | 55 | background |
| topic mapping | `complete` | `topic_mapping` | json | 45 | background |
| translation | `complete` | `translation` | json/text | 40 | background |

## 5. 迁移边界

### 5.1 Phase 1 必须迁移

- `QuestionGeneratorProviderService`
- `QuestionReviewerProviderService`
- `AICoachProviderService`

原因：

- 这是最直接影响学生体验和 AI 出题稳定性的 3 条主链路。
- 这 3 条链路都已有直接 Provider 请求。

### 5.2 Phase 1.5 迁移

- `QuestionTopicMapperProviderService`
- 题目修复中复用生成 provider 的调用。
- 翻译/双语版本生成调用，如果当前通过生成链路完成，则随生成迁移；如果后续独立服务，再接 Gateway。

### 5.3 Phase 2 迁移

- 机构 BYOK 全量纳入 Gateway Key Pool。
- AI 运维页面改为展示 Gateway ledger 和 key pool runtime。

## 6. 兼容策略

### 6.1 环境变量兼容

第一阶段必须兼容当前变量：

```env
CSCA_AI_PROVIDER
CSCA_AI_MODEL
CSCA_AI_API_KEY
CSCA_AI_BASE_URL
CSCA_AI_QUESTION_GENERATION_*
CSCA_AI_QUESTION_REVIEW_*
CSCA_AI_TOPIC_MAPPING_*
```

同时新增 Gateway 变量：

```env
AI_GATEWAY_ENABLED
AI_DEFAULT_PROVIDER
DEEPSEEK_API_KEYS
DEEPSEEK_BASE_URL
DEEPSEEK_DEFAULT_MODEL
```

推荐解析顺序：

1. Gateway 专用变量。
2. 任务专用旧变量。
3. 平台旧变量。
4. fallback。

### 6.2 Provider 名称兼容

当前 DeepSeek 可以先通过：

```env
CSCA_AI_PROVIDER=openai-compatible
CSCA_AI_BASE_URL=https://api.deepseek.com
```

迁移后推荐：

```env
AI_DEFAULT_PROVIDER=deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEYS=...
```

但第一阶段应同时接受旧配置。

## 7. 风险点

### 7.1 AI Coach fallback 不能丢

AI Coach 当前有较多安全校验和 fallback 逻辑，迁移时不能简单删除。

Gateway 只负责调用稳定性；业务安全仍由 AI Coach 层判断。

### 7.2 Reviewer provider 失败不能阻断 deterministic review

当前 reviewer provider 失败只产生 warning。迁移后仍应保持：

```text
Gateway failed -> reviewer warning -> deterministic review continues
```

### 7.3 Generator schema invalid 不等于 Gateway 失败

Provider 正常返回但业务 JSON 不合格，应归类为：

```text
provider call success
business parse/schema invalid
```

Gateway ledger 记录调用成功，业务层记录 `provider_schema_invalid`。

### 7.4 BYOK 不要在 Phase 1 大改

机构 BYOK 已有加密存储和权限逻辑。Phase 1 不应重构全部 BYOK 数据结构，只需让 AI Coach 的 BYOK 调用也能走 Gateway。

## 8. 验收清单

完成迁移后，逐项检查：

- `rg "fetch\\(.*chat/completions" backend/src` 不应再在业务 Provider 服务中出现直接调用，允许只出现在 Gateway Provider 实现中。
- `QuestionGeneratorProviderService` 不再读取 API Key。
- `QuestionReviewerProviderService` 不再读取 API Key。
- `AICoachProviderService` 不再直接 fetch Provider。
- DeepSeek key 配置为 1 个时所有 AI 功能仍可用。
- 后台生成任务会进入 background 并发池。
- AI Coach 会进入 realtime 并发池。
- Provider 错误在 Gateway ledger 可见。
- 旧 env 配置仍能运行。

## 9. 下一步文档

继续阅读：

- `docs/deepseek-first-ai-gateway-interface-and-data-spec-2026-07-09.md`
- `docs/deepseek-first-ai-gateway-phase-1-work-orders-2026-07-09.md`
- `docs/deepseek-first-ai-gateway-rollout-runbook-2026-07-09.md`
