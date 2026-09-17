# DeepSeek First AI Gateway Phase 1 开发工单

日期：2026-07-09

配套文档：

- `docs/deepseek-first-ai-gateway-executable-plan-2026-07-09.md`
- `docs/deepseek-first-ai-gateway-callsite-audit-2026-07-09.md`
- `docs/deepseek-first-ai-gateway-interface-and-data-spec-2026-07-09.md`

## 1. Phase 1 目标

Phase 1 只做一件事：

```text
把现有 AI 调用统一迁移到 AI Gateway，但实际 Provider 仍只接 DeepSeek。
```

不在 Phase 1 做：

- OpenAI/Gemini/Claude 多 Provider。
- 完整机构 BYOK 重构。
- 复杂成本账单。
- Redis 分布式队列。
- 全量后台运维大屏。

## 2. 完成定义

Phase 1 完成时必须满足：

- AI Coach 调用 Gateway。
- AI 题目生成调用 Gateway。
- AI 审题调用 Gateway。
- 单 DeepSeek key 可运行。
- 支持 `DEEPSEEK_API_KEYS` 数组配置。
- 支持 key 级并发限制。
- 支持 realtime/background 并发隔离。
- Gateway 统一记录调用日志。
- 旧 env 仍兼容。
- 业务服务不再直接 fetch `/chat/completions`。

## 3. 工单列表

### GW-01 新建 AiGatewayModule

涉及文件：

```text
backend/src/ai-gateway/ai-gateway.module.ts
backend/src/ai-gateway/ai-gateway.service.ts
backend/src/ai-gateway/ai-gateway.types.ts
backend/src/ai-gateway/ai-gateway-config.service.ts
backend/src/ai-gateway/ai-gateway-key-pool.service.ts
backend/src/ai-gateway/ai-gateway-concurrency.service.ts
backend/src/ai-gateway/ai-gateway-ledger.service.ts
backend/src/ai-gateway/providers/deepseek.provider.ts
backend/src/ai-gateway/providers/openai-compatible-http.ts
```

要求：

- `AiGatewayModule` export `AiGatewayService`。
- `AiGatewayService.complete()` 是唯一业务入口。
- `DeepSeekProvider` 实现通用 provider interface。

验收：

- 后端 build 通过。
- `AiGatewayModule` 可被其他 module import。

### GW-02 定义 Gateway 类型

涉及文件：

```text
backend/src/ai-gateway/ai-gateway.types.ts
```

要求：

- 定义 `AiTaskType`。
- 定义 `AiGatewayRequest`。
- 定义 `AiGatewayResponse`。
- 定义 `AiProvider`。
- 定义 `AiProviderKey`。
- 定义 `AiGatewayErrorCode`。

验收：

- 类型和接口与规格文档一致。
- 不把 DeepSeek 特有字段暴露给业务 request。

### GW-03 配置解析与旧 env 兼容

涉及文件：

```text
backend/src/ai-gateway/ai-gateway-config.service.ts
.env.example
.env.production.example
```

要求：

- 支持 `DEEPSEEK_API_KEYS`。
- 支持 `DEEPSEEK_BASE_URL`。
- 支持 `DEEPSEEK_DEFAULT_MODEL`。
- 支持 `DEEPSEEK_KEY_CONCURRENCY`。
- 兼容旧的 `CSCA_AI_*`、`CSCA_AI_QUESTION_GENERATION_*`、`CSCA_AI_QUESTION_REVIEW_*`。
- DeepSeek only 阶段不要求用户配置其他 Provider。

验收：

- 只配置旧 env 时仍能跑。
- 只配置新 env 时也能跑。
- `.env.example` 和 `.env.production.example` 有注释。

### GW-04 实现 DeepSeek Provider

涉及文件：

```text
backend/src/ai-gateway/providers/deepseek.provider.ts
backend/src/ai-gateway/providers/openai-compatible-http.ts
```

要求：

- 使用 `/chat/completions`。
- 支持 `response_format: { type: 'json_object' }`。
- 支持 timeout。
- 提取 usage。
- 统一 HTTP 错误映射。
- 不在 provider 内做业务 JSON 校验。

验收：

- DeepSeek 成功响应可返回 content。
- HTTP 401/403/429/5xx 映射正确。
- timeout 映射为 `provider_timeout`。

### GW-05 Key Pool

涉及文件：

```text
backend/src/ai-gateway/ai-gateway-key-pool.service.ts
```

要求：

- 支持多个 DeepSeek key。
- keyId 不暴露明文 key。
- key 当前并发计数。
- key cooldown 状态。
- key 选择优先健康 key。

验收：

- 配置一个 key 时可用。
- 配置多个 key 时轮询或按健康选择。
- 单 key 并发不超过 `DEEPSEEK_KEY_CONCURRENCY`。

### GW-06 并发隔离

涉及文件：

```text
backend/src/ai-gateway/ai-gateway-concurrency.service.ts
```

要求：

- 支持 realtime pool。
- 支持 background pool。
- 支持 global pool。
- realtime 任务不被 background 任务完全挤占。

验收：

- AI Coach taskType 使用 realtime。
- 题目生成使用 background。
- 后台大量生成时，AI Coach 仍能拿到保留并发。

### GW-07 Ledger

涉及文件：

```text
backend/src/ai-gateway/ai-gateway-ledger.service.ts
backend/prisma/schema.prisma
backend/prisma/migrations/*
```

建议新增表：

```text
AiGatewayCallLog
```

要求：

- 记录 requestId、taskType、providerId、model、keyId。
- 记录 status、errorCode、latencyMs。
- 记录 token usage。
- 不记录明文 API Key。

验收：

- 每次 Gateway 调用都有日志。
- Provider 失败也有日志。
- 日志可按 taskType/providerId 查询。

### GW-08 迁移 QuestionGeneratorProviderService

涉及文件：

```text
backend/src/ai-questioning/question-generator-provider.service.ts
backend/src/ai-questioning/ai-questioning.module.ts
```

要求：

- 注入 `AiGatewayService`。
- 删除直接 fetch。
- 删除直接读取 API Key。
- 保留 prompt build 和 normalize。
- `taskType = question_generation`。
- `sourceModule = question_generator`。
- `responseFormat = json`。

验收：

- 生成题仍能成功。
- schema invalid 仍由业务层返回 `provider_schema_invalid`。
- provider timeout 由 Gateway 返回统一 errorCode。

### GW-09 迁移 QuestionReviewerProviderService

涉及文件：

```text
backend/src/ai-questioning/question-reviewer-provider.service.ts
backend/src/ai-questioning/ai-questioning.module.ts
```

要求：

- 注入 `AiGatewayService`。
- 删除直接 fetch。
- 保留 reviewer prompt 和 parse。
- `taskType = question_review`。
- provider 失败仍只产生 warning。

验收：

- 审题成功时可解析 reviewer JSON。
- Gateway 失败时 deterministic review 继续。

### GW-10 迁移 AICoachProviderService

涉及文件：

```text
backend/src/csca-special-practice/ai-coach-provider.service.ts
backend/src/csca-special-practice/csca-special-practice.module.ts
```

要求：

- 注入 `AiGatewayService`。
- 删除直接 fetch。
- 保留 rollout、prompt safety、outputStatus、fallback。
- 机构 BYOK runtimeConfig 作为 `providerConfigOverride` 传给 Gateway。
- hint 使用 `ai_coach_hint`。
- explanation 使用 `ai_coach_explanation` 或 `wrong_question_explanation`。

验收：

- AI Coach 没开时仍 fallback。
- AI Coach 开启时走 Gateway。
- 输出泄露答案仍被拦截。
- 机构 BYOK 仍可用。

### GW-11 迁移 Topic Mapper

涉及文件：

```text
backend/src/ai-questioning/question-topic-mapper-provider.service.ts
```

要求：

- Phase 1 可以排在生成/审题/Coach 后。
- `taskType = topic_mapping`。
- 保留 suggestions 清洗逻辑。

验收：

- mapping provider 成功时返回 suggestions。
- 失败时仍返回空 suggestions，不中断导入流程。

### GW-12 后台健康接口

涉及文件：

```text
backend/src/csca-special-practice/csca-special-practice.controller.ts
backend/src/ai-gateway/ai-gateway.service.ts
frontend/src/pages/AdminAuditPage.tsx 或 AdminAIOperationsPage.tsx
```

Phase 1 最低要求：

- 后端提供 Gateway health snapshot。
- 前端可暂时只展示 provider/key 基础状态。

验收：

- 管理员能看到 DeepSeek key 是否 cooldown。
- 能看到 realtime/background running 数。

## 4. 测试任务

### GW-T01 单元测试

覆盖：

- env 解析。
- key pool 选择。
- error mapping。
- retry/cooldown。
- task policy。

### GW-T02 集成测试

覆盖：

- mock DeepSeek success。
- mock DeepSeek 429。
- mock DeepSeek timeout。
- generator 走 Gateway。
- reviewer 走 Gateway。
- AI Coach 走 Gateway。

### GW-T03 回归脚本

至少运行：

```bash
npm run backend:build
npm run frontend:build
npm run csca-ai-questioning:rules
npm run csca-ai-questioning:smoke
npm run csca-ai-questioning:subject-closure-smoke
npm run csca-mock-exam-ai-generation:smoke
```

如果本地没有真实 Provider，smoke 应允许 mock/fallback 模式。

## 5. 开发顺序

推荐顺序：

1. GW-01 / GW-02 建骨架和类型。
2. GW-03 配置兼容。
3. GW-04 DeepSeek Provider。
4. GW-05 Key Pool。
5. GW-06 并发隔离。
6. GW-07 Ledger。
7. GW-08 迁移生成。
8. GW-09 迁移审题。
9. GW-10 迁移 AI Coach。
10. GW-11 迁移 Topic Mapper。
11. GW-12 后台健康。
12. GW-T01 到 GW-T03。

## 6. 风险控制

### 6.1 建议加开关

```env
AI_GATEWAY_ENABLED=false
```

Phase 1 上线时可先保留旧调用路径：

```text
AI_GATEWAY_ENABLED=false -> 旧 Provider 调用
AI_GATEWAY_ENABLED=true  -> Gateway 调用
```

等稳定后再删除旧路径。

### 6.2 不要一次删除旧 env

旧 env 至少保留一个发布周期。

### 6.3 BYOK 不做大重构

AI Coach 的机构 BYOK 先通过 override 接入，避免 Phase 1 范围膨胀。

## 7. Phase 1 完成审核

完成前必须回答：

- 是否还有业务服务直接 fetch `/chat/completions`？
- 是否所有 AI 调用都有 taskType？
- 是否所有 AI 调用都有 ledger？
- 单 DeepSeek key 被限流后是否 cooldown？
- 后台批量出题是否会挤占学生实时 AI？
- 旧配置是否仍能运行？
- 宝塔/生产环境变量是否有更新文档？

只有全部满足，Phase 1 才算完成。
