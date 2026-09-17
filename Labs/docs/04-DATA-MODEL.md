# CSCAPilot Learning Agent 数据模型

> 状态：Accepted logical model v1.0  
> 更新时间：2026-09-12  
> 依赖文档：[总体架构](../ARCHITECTURE.md) · [工具契约](./02-TOOL-CONTRACTS.md) · [Runtime](./03-AGENT-RUNTIME.md)

## 1. 文档目的

本文档定义网页 Agent `WA-F0` 至 `WA-P1` 所需的新数据实体、关系、约束、索引、保留策略和与现有 CSCAPilot 数据的连接方式。

本文档是逻辑设计和 Prisma 草案，不代表已经创建迁移。

## 2. 建模原则

### 2.1 不复制领域事实

以下数据继续由现有表管理：

- 学生档案：`StudentProfile`；
- 自适应练习：`CscaAdaptiveSession`、`CscaAdaptiveRound`；
- 掌握度：`UserCscaTopicMastery`；
- 错题模式：`CscaWrongPattern`；
- 模考：`MockExamAttempt`；
- 真题：`PastPaper`、`ResourceBundle`；
- AI 交互和额度：`CscaAIInteraction`、`CscaAIUsageLedger`；
- 模型调用：`AiGatewayCallLog`；
- 周度洞察：`CscaLearningInsight`。

Agent 表只保存对话、运行控制、工具审计、确认以及对领域对象的引用。

### 2.2 数据库是运行事实来源

Run 状态、确认状态、最终消息和 Artifact 必须写 PostgreSQL。Redis 仅用于实时事件、锁和短期缓存。

### 2.3 对外使用不透明 ID

Agent 新表建议使用 CUID/UUID 字符串作为主键，避免通过连续整数暴露规模或方便枚举。现有领域表仍保持现有整数主键。

### 2.4 JSON 只保存可演进结构

高频查询、所有权、状态、时间、外键和幂等字段使用正式列。模型结果、展示快照和低频扩展字段可以使用 JSON。

## 3. 实体关系

```text
User
 └── AgentConversation
      ├── AgentMessage
      ├── AgentRun
      │    ├── AgentRunStep
      │    ├── AgentToolCall
      │    ├── AgentConfirmation
      │    └── AgentEvent
      └── AgentArtifact

AgentMessage ── AgentMessageFeedback
AgentRun ── retryOfRun
AgentToolCall ── optional AgentArtifact
AgentToolCall ── logical reference to domain entity
AgentToolCall ── requestId reference to AiGatewayCallLog
AgentConversation ── AgentAttachment ── AgentAttachmentPage/Chunk
AgentMessage ── AgentMessageAttachment ── AgentAttachment
AgentAttachment ── AgentAttachmentAnalysis
AgentRun/Attachment state ── AgentOutbox ── event dispatcher
Answer/Result ── LearningEvidenceEvent + LearningEvidenceOutbox ── learning projection worker
```

## 4. 新增实体

### 4.1 AgentConversation

表示 CSCAPilot 网页端的一段 Agent 会话。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | CUID/UUID 主键 |
| `userId` | Int | 所属用户 |
| `title` | String? | 自动或用户设置的标题 |
| `status` | String | `active/archived/deleted` |
| `locale` | String | 默认回复语言 |
| `summary` | String? | 历史压缩摘要 |
| `summaryThroughMessageId` | String? | 摘要覆盖到的消息 |
| `lastMessageAt` | DateTime? | 排序使用 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |
| `deletedAt` | DateTime? | 软删除时间 |

约束与索引：

- 索引 `(userId, status, lastMessageAt)`；
- 所有查询都包含 `userId`；
- 删除会话默认软删除，异步执行内容清理；
- `summary` 不是长期用户档案，只属于本会话。

### 4.2 AgentMessage

保存用户与 Agent 的稳定消息。工具调用细节不作为普通聊天消息重复保存。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | 主键 |
| `conversationId` | String | 所属会话 |
| `runId` | String? | 产生该消息的 Run |
| `role` | String | `user/assistant/system_notice` |
| `status` | String | `pending/completed/failed/redacted` |
| `content` | String | 最终可见内容 |
| `contentFormat` | String | 默认 `markdown` |
| `clientRequestId` | String? | 用户提交幂等标识 |
| `parentMessageId` | String? | 可选回复关系 |
| `metadata` | Json? | 语言、展示和来源摘要 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

约束与索引：

- 用户消息 `(conversationId, clientRequestId)` 唯一；
- 索引 `(conversationId, createdAt)`；
- `content` 不保存内部 System Prompt 或模型隐藏推理；
- 流式 delta 不逐块更新该字段，完成后一次写入最终消息。

### 4.3 AgentRun

表示一个用户消息触发的一次完整执行。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | 主键 |
| `conversationId` | String | 所属会话 |
| `userMessageId` | String | 触发消息 |
| `assistantMessageId` | String? | 最终回复 |
| `userId` | Int | 冗余所有权字段，便于授权查询 |
| `status` | String | Runtime 状态 |
| `channel` | String | 首期 `web_agent` |
| `traceId` | String | 全链路追踪 |
| `promptVersion` | String | Prompt 版本 |
| `toolsetVersion` | String | 工具集版本 |
| `contextSchemaVersion` | String | 上下文 Schema 版本 |
| `modelTurnCount` | Int | 模型回合数 |
| `toolCallCount` | Int | 工具调用数 |
| `retryOfRunId` | String? | 被重试的 Run |
| `cancelRequestedAt` | DateTime? | 用户请求取消 |
| `startedAt` | DateTime? | 实际启动 |
| `completedAt` | DateTime? | 进入终态 |
| `expiresAt` | DateTime? | 等待确认或运行过期 |
| `leaseOwner` | String? | Runner 租约持有者 |
| `leaseExpiresAt` | DateTime? | 租约到期 |
| `errorCode` | String? | 稳定错误码 |
| `errorMessage` | String? | 面向运维的脱敏摘要 |
| `metadata` | Json? | 页面上下文快照等 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

约束与索引：

- `traceId` 唯一；
- `userMessageId` 唯一，一个用户消息只创建一个初始 Run；
- 索引 `(userId, status, createdAt)`；
- 索引 `(conversationId, createdAt)`；
- 索引 `(status, leaseExpiresAt)` 供恢复扫描；
- `retryOfRunId` 形成单向链，不允许循环；
- 终态 Run 不再修改工具和模型计数。

### 4.4 AgentRunStep

保存用户可见计划和执行步骤，不保存模型隐藏推理。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | 主键 |
| `runId` | String | 所属 Run |
| `sequence` | Int | Run 内顺序 |
| `type` | String | `plan/tool/respond/confirmation` |
| `status` | String | `pending/running/completed/failed/skipped` |
| `title` | String | 可向用户展示的短标题 |
| `summary` | String? | 脱敏结果摘要 |
| `startedAt` | DateTime? | 开始时间 |
| `completedAt` | DateTime? | 完成时间 |
| `metadata` | Json? | 非敏感展示字段 |

约束：`(runId, sequence)` 唯一。

### 4.5 AgentToolCall

保存每次 Agent-facing 工具调用的审计与幂等结果。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | 主键 |
| `runId` | String | 所属 Run |
| `stepId` | String? | 对应步骤 |
| `userId` | Int | 所属用户 |
| `clientCallId` | String | 模型回合内调用 ID |
| `toolName` | String | 稳定工具名 |
| `toolVersion` | String | 工具版本 |
| `riskLevel` | Int | 0–3 |
| `status` | String | `pending/running/succeeded/failed/cancelled` |
| `inputHash` | String | 规范化输入哈希 |
| `inputSummary` | Json? | 白名单化输入摘要 |
| `outputSummary` | Json? | 白名单化输出摘要 |
| `idempotencyKeyHash` | String? | 幂等键哈希 |
| `domainEntityType` | String? | 领域对象类型 |
| `domainEntityId` | String? | 领域对象 ID |
| `aiGatewayRequestId` | String? | 关联模型调用日志 |
| `creditsCharged` | Int | 默认 0 |
| `errorCode` | String? | 工具错误码 |
| `durationMs` | Int? | 执行耗时 |
| `startedAt` | DateTime? | 开始时间 |
| `completedAt` | DateTime? | 完成时间 |
| `createdAt` | DateTime | 创建时间 |

约束与索引：

- `(runId, clientCallId)` 唯一；
- 需要幂等的调用对 `(userId, toolName, idempotencyKeyHash)` 建条件唯一索引；
- 索引 `(toolName, status, createdAt)`；
- 索引 `(userId, createdAt)`；
- 索引 `(domainEntityType, domainEntityId)`；
- 不保存完整 Prompt、题目、正确答案或访问令牌。

PostgreSQL 条件唯一索引需要在 Prisma migration SQL 中手工添加：

```sql
CREATE UNIQUE INDEX "uq_agent_tool_calls_user_tool_idempotency"
ON "agent_tool_calls" ("user_id", "tool_name", "idempotency_key_hash")
WHERE "idempotency_key_hash" IS NOT NULL;
```

### 4.6 AgentArtifact

保存 Agent 产生或推荐的可继续学习对象。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | 主键 |
| `conversationId` | String | 所属会话 |
| `runId` | String | 产生它的 Run |
| `toolCallId` | String? | 来源工具调用 |
| `userId` | Int | 所属用户 |
| `type` | String | Artifact 类型 |
| `version` | Int | Artifact 展示 Schema 版本 |
| `status` | String | `ready/in_progress/completed/failed/expired` |
| `title` | String | 标题 |
| `summary` | String? | 简介 |
| `subject` | String? | 学科 |
| `domainEntityType` | String? | 领域对象类型 |
| `domainEntityId` | String? | 领域对象 ID |
| `route` | String? | CSCAPilot 站内路径 |
| `snapshot` | Json? | 最小展示快照 |
| `expiresAt` | DateTime? | 临时对象过期时间 |
| `createdAt` | DateTime | 创建时间 |
| `updatedAt` | DateTime | 更新时间 |

约束与索引：

- 索引 `(userId, type, createdAt)`；
- 索引 `(conversationId, createdAt)`；
- 索引 `(domainEntityType, domainEntityId)`；
- 同一工具重放时应复用已有 Artifact；
- `route` 只能是站内相对路径或由可信 URL Builder 生成。

### 4.7 AgentConfirmation

保存高风险操作确认请求。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | `actionId` |
| `runId` | String | 所属 Run |
| `toolCallId` | String | 待执行工具 |
| `userId` | Int | 确认用户 |
| `level` | Int | 2 或 3 |
| `status` | String | `pending/confirmed/rejected/expired/consumed` |
| `toolName` | String | 工具名 |
| `toolVersion` | String | 工具版本 |
| `inputHash` | String | 参数哈希 |
| `summary` | String | 用户可读摘要 |
| `changes` | Json? | 字段变更摘要 |
| `estimatedCredits` | Int? | 预计消耗 |
| `expiresAt` | DateTime | 过期时间 |
| `decidedAt` | DateTime? | 决策时间 |
| `consumedAt` | DateTime? | 执行消费时间 |
| `createdAt` | DateTime | 创建时间 |

约束与索引：

- 一个 ToolCall 最多一个有效 Confirmation；
- 索引 `(userId, status, expiresAt)`；
- 状态修改使用原子条件更新；
- `confirmed` 不是完成，工具开始执行时改为 `consumed`；
- 参数哈希变化后原确认失效。

### 4.8 AgentEvent

保存需要断线补发的关键事件。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | 事件 ID |
| `runId` | String | 所属 Run |
| `conversationId` | String | 所属会话 |
| `sequence` | Int | Run 内严格递增 |
| `type` | String | 事件类型 |
| `payload` | Json | 脱敏事件数据 |
| `createdAt` | DateTime | 创建时间 |

约束：

- `(runId, sequence)` 唯一；
- 索引 `(conversationId, createdAt)`；
- 不持久化每个 `message.delta`；
- 事件只用于恢复 UI，不替代 Message、Run、ToolCall 或 Artifact 表。

### 4.9 AgentMessageFeedback

保存对 Agent 消息或任务结果的评价。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | 主键 |
| `messageId` | String | 被评价消息 |
| `runId` | String? | 对应 Run |
| `userId` | Int | 当前用户 |
| `rating` | Int | `-1` 或 `1` |
| `reasonCode` | String? | 固定原因 |
| `comment` | String? | 用户补充，限制长度 |
| `createdAt` | DateTime | 创建时间 |

约束：`(messageId, userId)` 唯一。若反馈对应某次题目 AI 交互，可以同时通过现有 `CscaAIInteractionFeedback` 记录能力级反馈，但两者用途不同。

### 4.10 AgentOutbox

`AgentOutbox` 保存 Agent Run、Attachment 与 UI/SSE 状态在同一数据库事务中产生、等待发布的事件。它避免“数据库已成功但 Redis/SSE 未广播”造成界面永久缺事件，不承担学习领域投影。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String | CUID 主键 |
| `aggregateType` | String | `agent_run/attachment` |
| `aggregateId` | String | Run 或 Attachment ID |
| `eventType` | String | 稳定事件类型 |
| `payload` | Json | 版本化、脱敏 payload |
| `status` | String | `pending/published/dead_letter` |
| `attempts` | Int | 发布次数 |
| `availableAt` | DateTime | 下次可发布时间 |
| `publishedAt` | DateTime? | 成功时间 |
| `createdAt` | DateTime | 创建时间 |

索引 `(status, availableAt)`；Dispatcher 使用短租约批量领取，发布成功再标记。消费方仍按 `eventId` 幂等，Outbox 不保存模型 token delta。

## 5. Prisma 模型草案

以下代码用于评审字段和关系，不应直接复制为迁移而跳过命名、索引和所有权复核：

```prisma
model AgentConversation {
  id                      String    @id @default(cuid())
  userId                  Int       @map("user_id")
  title                   String?   @db.VarChar(160)
  status                  String    @default("active") @db.VarChar(32)
  locale                  String    @default("zh-CN") @db.VarChar(20)
  summary                 String?   @db.Text
  summaryThroughMessageId String?   @map("summary_through_message_id")
  lastMessageAt           DateTime? @map("last_message_at")
  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")
  deletedAt               DateTime? @map("deleted_at")

  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  AgentMessage[]
  runs      AgentRun[]
  artifacts AgentArtifact[]
  events    AgentEvent[]

  @@index([userId, status, lastMessageAt], map: "idx_agent_conversations_user_status_last")
  @@map("agent_conversations")
}

model AgentMessage {
  id              String   @id @default(cuid())
  conversationId  String   @map("conversation_id")
  role            String   @db.VarChar(32)
  status          String   @default("completed") @db.VarChar(32)
  content         String   @db.Text
  contentFormat   String   @default("markdown") @map("content_format") @db.VarChar(32)
  clientRequestId String?  @map("client_request_id") @db.VarChar(120)
  parentMessageId String?  @map("parent_message_id")
  metadata        Json?
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  conversation  AgentConversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  triggeredRun  AgentRun?              @relation("AgentRunUserMessage")
  completedRun  AgentRun?              @relation("AgentRunAssistantMessage")
  feedback      AgentMessageFeedback[]

  @@unique([conversationId, clientRequestId], map: "uq_agent_messages_conversation_client_request")
  @@index([conversationId, createdAt], map: "idx_agent_messages_conversation_created")
  @@map("agent_messages")
}

model AgentRun {
  id                   String    @id @default(cuid())
  conversationId       String    @map("conversation_id")
  userMessageId        String    @unique @map("user_message_id")
  assistantMessageId   String?   @unique @map("assistant_message_id")
  userId               Int       @map("user_id")
  status               String    @default("queued") @db.VarChar(40)
  channel              String    @default("web_agent") @db.VarChar(40)
  traceId              String    @unique @map("trace_id") @db.VarChar(80)
  promptVersion        String    @map("prompt_version") @db.VarChar(60)
  toolsetVersion       String    @map("toolset_version") @db.VarChar(60)
  contextSchemaVersion String    @map("context_schema_version") @db.VarChar(60)
  modelTurnCount       Int       @default(0) @map("model_turn_count")
  toolCallCount        Int       @default(0) @map("tool_call_count")
  retryOfRunId         String?   @map("retry_of_run_id")
  cancelRequestedAt    DateTime? @map("cancel_requested_at")
  startedAt            DateTime? @map("started_at")
  completedAt          DateTime? @map("completed_at")
  expiresAt            DateTime? @map("expires_at")
  leaseOwner           String?   @map("lease_owner") @db.VarChar(120)
  leaseExpiresAt       DateTime? @map("lease_expires_at")
  errorCode            String?   @map("error_code") @db.VarChar(80)
  errorMessage         String?   @map("error_message") @db.Text
  metadata             Json?
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  conversation     AgentConversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userMessage      AgentMessage       @relation("AgentRunUserMessage", fields: [userMessageId], references: [id], onDelete: Restrict)
  assistantMessage AgentMessage?      @relation("AgentRunAssistantMessage", fields: [assistantMessageId], references: [id], onDelete: SetNull)
  retryOfRun       AgentRun?           @relation("AgentRunRetry", fields: [retryOfRunId], references: [id], onDelete: SetNull)
  retries          AgentRun[]          @relation("AgentRunRetry")
  steps            AgentRunStep[]
  toolCalls        AgentToolCall[]
  artifacts        AgentArtifact[]
  confirmations    AgentConfirmation[]
  events           AgentEvent[]

  @@index([userId, status, createdAt], map: "idx_agent_runs_user_status_created")
  @@index([conversationId, createdAt], map: "idx_agent_runs_conversation_created")
  @@index([status, leaseExpiresAt], map: "idx_agent_runs_status_lease")
  @@map("agent_runs")
}
```

上面只展示会话、消息和 Run 的核心关系；引用到的 Step、ToolCall、Artifact、Confirmation、Event 和 Feedback 模型需按第 4 节继续定义后才能组成完整 Schema。正式实现前必须执行 `prisma validate`，本草案不替代该步骤。

其余实体建议按第 4 节字段落表；为了保持文档可审阅性，不在此重复完整 Prisma 代码。

## 6. 与现有表的关联

### 6.1 User

正式 Schema 需要给 `User` 增加：

```prisma
agentConversations AgentConversation[]
```

其他 Agent 表通过 Conversation 或显式 `userId` 完成所有权查询。是否为所有审计表建立 Prisma `User` Relation，应考虑用户删除策略后决定。

### 6.2 练习与模考

Artifact 和 ToolCall 使用：

```text
domainEntityType = adaptive_session | adaptive_round | mock_exam_attempt
domainEntityId   = 现有 Int ID 的字符串形式
```

不为多态引用建立数据库外键。读取 Artifact 时由对应 Resolver 查询领域服务并重新验证用户所有权。

### 6.3 AI 调用与额度

- `AgentRun.traceId` 写入 AI Gateway metadata；
- `AgentToolCall.aiGatewayRequestId` 对应 `AiGatewayCallLog.requestId`；
- AI 工具返回的 interaction ID 保存在 `outputSummary` 或 Artifact snapshot；
- 实际额度变动以 `CscaAIUsageLedger` 为准；
- `creditsCharged` 是便于查询的快照，不是账本事实来源。

### 6.4 真题与资料

公开资料 Artifact 只保存 `PastPaper.id` 或 `ResourceBundle.id` 引用和展示快照。若资料下架，Artifact 保留历史标题但主操作变为不可用。

## 7. 事务边界

### 7.1 接收用户消息

同一事务：

1. 插入用户 Message；
2. 插入 queued Run；
3. 更新 Conversation.lastMessageAt；
4. 插入 `run.started` 前置事件或 outbox 记录。

唯一约束处理重复 `clientRequestId`，冲突后查询并返回原结果。

### 7.2 工具成功

同一事务或可靠 outbox 流程：

1. 领域服务完成写入；
2. ToolCall 标记成功；
3. 必要时创建 Artifact；
4. 更新 Run 计数；
5. 写入 `tool.completed` 和 `artifact.created` 事件。

如果领域写入与 Agent 表无法处于同一事务，领域服务必须支持幂等查询，恢复任务据此补齐 ToolCall 和 Artifact。

### 7.3 完成 Run

同一事务：

1. 插入最终 Assistant Message；
2. Run 关联 Assistant Message 并进入 `completed`；
3. Conversation 更新时间；
4. 写入 `run.completed` 事件。

客户端不应在消息提交前收到完成事件。

### 7.4 AI 额度

额度扣减继续由现有 entitlement/usage ledger 的原子事务管理。Agent ToolCall 不直接修改余额。

## 8. 租约与恢复

Runner 获取租约时使用条件更新：

```sql
UPDATE agent_runs
SET lease_owner = :worker,
    lease_expires_at = NOW() + INTERVAL '30 seconds'
WHERE id = :run_id
  AND status IN ('queued', 'planning', 'executing', 'responding')
  AND (lease_expires_at IS NULL OR lease_expires_at < NOW());
```

只有更新一行的 Worker 可以执行。运行过程中定期续租；进程崩溃后其他 Worker 等租约过期再恢复。

租约不能替代 ToolCall 幂等约束。

## 9. 数据保留与删除

建议初始策略，最终需经隐私和业务确认：

| 数据 | 建议保留 |
| --- | --- |
| 活跃 Conversation/Message | 用户保留期间 |
| 用户删除的消息正文 | 30 天内物理清理 |
| Run 和 ToolCall 审计 | 180 天 |
| AgentEvent | 7–30 天 |
| Pending Confirmation | 过期后 30 天 |
| Artifact 引用 | 会话存在期间或用户主动删除 |
| 普通应用日志 | 7–30 天 |
| AI/额度账本 | 按现有财务与审计策略 |

用户删除会话时：

- Conversation 立即从用户列表隐藏；
- Message 正文和会话摘要进入清理队列；
- 练习、模考和学习记录不随对话删除；
- ToolCall 审计保留脱敏最小字段；
- Artifact 展示快照清理，但领域对象保持原规则。

## 10. 隐私与敏感字段

禁止存入 Agent 通用表：

- 密码、OAuth Token、Refresh Token；
- SMTP、模型或第三方 API Key；
- 完整 System Prompt；
- 模型隐藏推理；
- 不必要的邮箱、IP、家庭地址或身份材料；
- 未脱敏的 Provider 原始错误；
- ToolCall 中的完整题目或正确答案副本。

Message 正文可能包含用户主动输入的个人信息，应支持删除、访问控制和保留期限。

## 11. 数据完整性规则

- Message、Run、Artifact、Confirmation 的用户必须与 Conversation.userId 一致；
- ToolCall.userId 必须与 Run.userId 一致；
- Assistant Message 的 `runId` 只能属于同一 Conversation；
- 每个 Run 最多一个最终 Assistant Message；
- `completedAt` 仅在终态设置；
- `creditsCharged` 不得为负，退款单独记录；
- Confirmation 只能从 pending 原子转换一次；
- Artifact 的领域引用每次读取都重新做所有权和可见性校验；
- 软删除 Conversation 后不能创建新 Run。

应用层校验之外，能够通过外键、唯一约束、CHECK 或条件索引表达的规则应尽量下沉数据库。

## 12. 查询模式与索引验证

上线前使用真实或近似数据量验证以下查询：

- 用户最近 20 个活跃会话；
- 会话按时间分页读取消息；
- 查询一个 Run 的步骤、工具和 Artifact；
- SSE 按 sequence 补发事件；
- 查找租约过期的活动 Run；
- 用户最近同类 Artifact；
- 按幂等键读取工具结果；
- 统计工具成功率、P95 延迟和错误码；
- 按 traceId 串联 Agent 与 AI Gateway 日志。

避免在大表 JSON 字段上直接做无索引报表查询。需要运营分析时通过结构化列、物化视图或数据管道处理。

## 13. 迁移计划

### Migration A：会话基础

- AgentConversation；
- AgentMessage；
- AgentRun；
- User 关系；
- 基础索引和状态约束。

### Migration B：执行与恢复

- AgentRunStep；
- AgentToolCall；
- AgentEvent；
- 租约和幂等索引。

### Migration C：交互结果

- AgentArtifact；
- AgentConfirmation；
- AgentMessageFeedback；
- 保留和清理任务所需索引。

### Migration D：私有附件

- AgentAttachment 与 AgentMessageAttachment；
- AgentAttachmentPage 与 AgentAttachmentChunk；
- AgentAttachmentAnalysis；
- 所有权、状态、内容 hash、保留期和清理索引；
- 原始文件与派生文件仅保存 private storage key，不把字节写入数据库。

附件表只服务私有对话内容，不复用 `PastPaper` 的发布状态。详细字段与生命周期见 [10-ATTACHMENT-INGESTION.md](./10-ATTACHMENT-INGESTION.md)。

每次迁移流程：

1. 更新 Prisma Schema；
2. 生成迁移；
3. 人工审查 SQL、锁表风险和索引；
4. 执行 `prisma validate`；
5. 在生产规模副本测试迁移时间；
6. 先部署兼容旧 Schema 的代码；
7. 执行迁移；
8. 开启灰度功能开关。

## 14. 不建议的设计

- 把所有消息、步骤、工具和 Artifact 放进 Conversation 的一个 JSON；
- 把完整领域对象复制到 Agent 数据库；
- 只在 Redis 保存运行状态；
- 用聊天文本判断工具是否已成功；
- 通过删除审计记录实现用户删除聊天；
- 将外部 Codex 完整对话默认同步进 AgentMessage；
- 用模型供应商 ID 作为业务主键或工具契约的一部分；
- 缺少幂等唯一约束，仅在内存中防重复。

## 15. 已冻结决策与实施复核

按 [13-TECHNICAL-FOUNDATION-ADR.md](./13-TECHNICAL-FOUNDATION-ADR.md)，新表主键使用 CUID、PostgreSQL 为事实来源、关键事件持久化、迁移只做 additive change 并通过 `prisma migrate deploy` 上线。

实施规则同时冻结为：

1. 第一版依赖数据库/磁盘静态加密和 TLS，不单独做 Message 字段级加密；日志禁止记录正文；
2. 第一批迁移加入 `AgentOutbox`，保证事务状态与事件发布可以重放；
3. `AgentEvent` 默认保留 7 天，单事件 payload 上限 64 KiB；
4. Agent Artifact 随 Conversation 生命周期保留；其引用的练习、模考等领域对象仍遵循原有生命周期；
5. 用户注销后按现有合规策略删除正文与私有附件，必要审计只保留不可反查的 hash 和计量字段；
6. 对话标题可后台生成但不单独向用户扣费，摘要计入 Agent 运行成本；
7. 迁移加入 PostgreSQL 条件唯一索引，活动状态下强制每个会话最多一个 Run；上线前先检查历史冲突。

## 16. 实时学习状态扩展

现有 `UserCscaTopicMastery` 保持 v1 兼容。实时多维学习分析通过新增 `LearningEvidenceEvent`、`LearningEvidenceOutbox`、`UserCscaTopicStateV2`、`UserCscaTopicStateSnapshot`、`LearningPrescription`、`LearningPrescriptionOutcome`、`LearningDecisionCurrent` 和 `LearningStateProjectionCheckpoint` 实现；`LearningDecisionCurrent` 只保存通过 CAS 发布的当前 Gap/Prescription 引用，不复制学习事实。Agent 表不复制学习事实，也不由模型直接修改掌握度。

答案、Evidence 与 `LearningEvidenceOutbox` 在同一事务写入，V2 State 由 Worker 按用户/学科事件序列异步幂等投影。`AgentOutbox` 只服务 Agent/附件事件；二者可复用 Dispatcher 库但不共享领域所有权。题目纠错通过补偿事件与状态重放修正。正式字段、实时语义、算法阶段和灰度规则见 [15-REALTIME-LEARNING-INTELLIGENCE-ADR.md](./15-REALTIME-LEARNING-INTELLIGENCE-ADR.md)。

## 17. 教学干预扩展

知识讲解和错因纠正通过 `LearningIntervention`、`LearningInterventionDelivery`、`LearningInterventionStep` 和 `LearningInterventionOutcome` 记录决策、展示、完成和后续验证。教学活动完成不等于知识点掌握，不得直接提高 `UserCscaTopicStateV2`；只有验证题或正式练习的可靠 Evidence 才能更新状态。详细设计见 [16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md](./16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md)。

主动求助与主动干预共用版本化 `TeachingAsset/TeachingAssetVersion`；`LearningAssistanceRequest` 保存辅助策略与执行，`AssistanceExposure` 保存学生实际看到的概念、提示、示例、讲解或答案，`TeachingInteractionEvent` 保存交互动画步骤与 active prompt。后续 Evidence 必须引用曝光快照，并由确定性规则计算独立性权重，模型不得直接写权重。详见 [55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md](./55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md)。

## 18. 目标分数与结果扩展

现有 `StudentProfile` 已保存考试日期、目标科目和 `weeklyGoalDays`，但目标分数、评分规则、预测和按分钟的时间容量不应进入 `metadata`。新增父表 `StudentScoreGoal`、子表 `StudentScoreGoalSubject`、`StudyAvailabilityPreference`、`PlanCapacitySnapshot`、`ExamScoringPolicy`、`ItemCalibrationSnapshot`、`AssessmentItemExposure`、`ScoreReadinessForecast`、`TargetGapSnapshot`、`LearningTrajectorySnapshot` 和 `ForecastCalibrationSnapshot`；一个活动父目标对应一个考试体系和批次，子表按 `(goalId, subjectCode)` 唯一保存各科目标分与优先级。请求级 `SessionConstraint` 默认只保存在 Run/Prescription 输入快照；可选真实考试结果使用独立同意和删除策略的 `StudentExamOutcome`。

Goal、Forecast、Gap、Capacity 和 Trajectory 都采用不可变版本或快照；修改目标或长期可用时间不改写历史。预测必须绑定完整 `LearningDecisionVersionVector` 与证据截止时间，并通过 compare-and-set 更新当前指针。Agent Conversation 与 Artifact 只保存引用，不复制为事实来源。完整设计见 [17-TARGET-SCORE-OUTCOME-ADR.md](./17-TARGET-SCORE-OUTCOME-ADR.md) 和 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md)。

评分治理的落地结构、数据库约束和 Shadow Gate 见 [39-SCORE-CALIBRATION-GOVERNANCE.md](./39-SCORE-CALIBRATION-GOVERNANCE.md)。治理记录通过并不等于学生端数值预测开放。

PR9C 为评分政策和两类校准快照增加 `createdByUserId`，以强制创建者与审核者分离；`ScoreCalibrationGovernanceEvent` 追加式保存状态迁移、执行人、理由和工件引用。校准数据库只保存聚合指标与哈希，不保存逐学生观察行。完整流水线见 [40-SCORE-CALIBRATION-PIPELINE.md](./40-SCORE-CALIBRATION-PIPELINE.md)。

PR9D-A 新增不可变 `ScorePredictionShadowRun`：保存化学候选模型的特征快照、基线、候选结果、原因码、证据截止时间和版本哈希。它只属于内部校准数据链，不属于 Agent Conversation/Artifact，也不建立学生端当前预测指针。详见 [41-CHEMISTRY-SCORE-PREDICTION-SHADOW.md](./41-CHEMISTRY-SCORE-PREDICTION-SHADOW.md)。

PR9D-B1 为 `ForecastCalibrationSnapshot` 增加 `outcomeSource`。旧快照为 `legacy_unknown`，限时模考代理为 `timed_mock_proxy`，未来经独立核验的真实考试结果为 `verified_csca_exam`；只有最后一种可能进入 qualified。预测—代理结果明细只在受控导出中使用，不新增含用户 ID 的校准明细表。见 [42-SCORE-PREDICTION-CALIBRATION-DATASET.md](./42-SCORE-PREDICTION-CALIBRATION-DATASET.md)。

PR9D-B2 已实现可撤回的 `StudentExamOutcome`、私有 `StudentExamOutcomeEvidence`、只追加 `StudentExamOutcomeEvent`，以及把经双人核验结果与预测运行绑定的 `ForecastCalibrationDatasetManifest/Row`。真实成绩更正采用新记录替代旧记录；撤回、更正或管理员撤销核验会使关联清单失效并自动退役关联 Forecast 快照。详见 [43-VERIFIED-CSCA-EXAM-OUTCOME-CLOSED-LOOP.md](./43-VERIFIED-CSCA-EXAM-OUTCOME-CLOSED-LOOP.md)。

题目、评分、讲解、OCR 或学习判断的举报使用 `ContentIssueReport` 记录对象版本、严重度、隔离状态、审核决定、受影响用户查询、补偿/重放任务和通知状态。人工修正学习状态必须写正式 override/compensation 事件，不能直接覆盖状态列。
