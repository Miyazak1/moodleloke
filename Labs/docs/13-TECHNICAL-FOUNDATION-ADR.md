# CSCAPilot Learning Agent 技术基线决策

> 状态：Accepted v1.0  
> 决策日期：2026-09-12  
> 适用范围：本地投资人演示、后续线上 Web Agent、未来 Codex/ChatGPT 插件  
> 依赖文档：[总体架构](../ARCHITECTURE.md) · [Runtime](./03-AGENT-RUNTIME.md) · [数据模型](./04-DATA-MODEL.md) · [附件处理](./10-ATTACHMENT-INGESTION.md) · [OCR/多模态 ADR](./11-OCR-MULTIMODAL-ADR.md)

阶段名称统一使用 `DEMO-V1/WA-F0/LS-V1/WA-P1/PLUGIN-P1/PROD-V1`；本文出现的历史“MVP”表述按相邻上下文解释，不产生新的发布范围。统一定义见 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md)。

## 1. 最终结论

本项目采用以下可直接施工的基线：

```text
React Web / future MCP client
              │
              ▼
Existing NestJS backend
├── Agent API + SSE
├── bounded Agent Runtime
├── Capability / Tool layer
├── Zod contracts
├── existing domain services
└── existing AI Gateway ──► hosted DeepSeek APIs
              │
       ┌──────┴─────────┐
       ▼                ▼
 PostgreSQL         dedicated Agent Queue Redis
                         │
                         ▼
                  Node agent worker
                  run + attachment queues
                         │ private HTTP
                         ▼
                  Python parser container
                  Docling + PaddleOCR
```

关键边界：

- 线上和本地演示的大语言模型都调用托管 API，不部署本地大模型，也不要求 GPU；
- 文档解析/OCR 是确定性处理服务，不承担开放式推理；复杂图片理解由视觉 API 完成；
- 现有 NestJS 后端保持模块化单体，暂不拆成微服务；
- 附件异步处理独立为 Worker，Python 依赖隔离在 Parser 容器；
- PostgreSQL 是业务与运行事实来源，Redis 只负责排队和实时分发；
- 未来 Web、MCP、插件共用 Capability Layer，不复制业务逻辑。

## 2. 为什么这样定

这是当前产品阶段风险最低的组合：

- 复用 React、NestJS、Prisma、PostgreSQL、现有 AI Gateway、权限与额度体系；
- 不引入 Kubernetes、Kafka、向量数据库或自建模型等当前没有必要的基础设施；
- 将最容易拖慢 API 的 PDF/OCR 从 Web 进程移走；
- 通过稳定契约、幂等任务和数据库状态，使本地演示代码可沿用到生产，而不是一次性 Demo；
- 单独的队列 Redis 不改变现有 Redis 的缓存/限流行为，也不影响当前线上业务。

## 3. 组件与实现责任

### 3.0 现有架构兼容性评估

现有网站架构可以承载 `WA-F0/WA-P1`，并且身份、学习数据、题库、练习、模考、真题、AI Gateway 和额度账本能显著缩短首期开发。但是，Agent 不得直接把现有大型领域 Service 当作工具层：部分 Service 已承载大量流程，模块导出边界也不完全一致，直接注入会让 Agent 与内部实现互相拖累。

因此增加一层薄的 Capability Facade：

```text
Agent Tool / future MCP
          │ stable v1 contract
          ▼
Capability Facade
├── LearningCapability
├── PracticeCapability
├── ReviewCapability
├── MockExamCapability
├── PastPaperCapability
└── AiCapability
          │
          ▼
existing domain services / Prisma
```

规则：

- Agent Tool 只能调用 Capability Facade，不能直接操作 Prisma，也不能调用内部 Controller；
- Facade 负责权限、事务、幂等、DTO 映射和稳定错误码，不复制领域算法；
- 只为首批工具抽取所需用例，不做全站“先重构再开发”；
- 大型旧 Service 逐用例迁移到 application service，新旧 Controller 都调用同一个入口；
- Facade 契约按 v1 兼容演进，旧模块内部可以继续重构；
- CI 增加依赖边界检查，禁止 `agent/tools` 导入 Prisma 或未经批准的领域内部文件。

这样当前模块化单体是 Agent 的宿主，而不是 Agent 的永久耦合边界。只有达到第 10 节的拆分触发条件，才把逻辑组件部署成独立服务。

### 3.1 前端

继续使用现有 React + Vite。前端只负责：

- 会话、消息、Composer、附件状态和 Artifact UI；
- 通过同源 API 上传文件和提交消息；
- 消费 SSE，并按 `runId + sequence` 去重；
- SSE 断开时查询 Run 快照恢复；
- 绝不保存或调用模型供应商密钥。

### 3.2 NestJS Agent 模块

建议目录：

```text
backend/src/agent/
├── api/
├── application/
├── contracts/
├── runtime/
├── tools/
├── events/
├── attachments/
└── persistence/
```

Controller 只处理协议、身份和输入；Application Service 负责事务；Runtime 负责有限状态机；Tool Adapter 调用现有领域服务。不得由 Tool 反向请求本项目 Controller URL。

### 3.3 Node Agent Worker

Worker 与后端使用同一仓库、同一 Node 基础镜像和同一数据契约，但独立进程启动。它消费 `agent-runs-v1` 与 `agent-attachments-v1` 两条独立队列，分别配置并发。它负责：

- 执行已持久化的 Agent Run，不让长模型调用占住 API 进程；
- 从队列取得附件阶段任务；
- 以原子条件更新数据库状态和租约；
- 调用安全扫描与 Python Parser；
- 写入页、块、引用和派生文件元数据；
- 发出持久化里程碑事件；
- 执行可控重试和超时恢复。

Worker 不运行网页服务器，不直接调用模型供应商。

### 3.4 Python Parser

独立内部容器，首期使用 FastAPI 提供小型私有 HTTP 接口：

```text
POST /v1/parse
GET  /health
```

输入是受控文件路径或内部对象引用，输出是版本化 JSON。Parser 不访问业务数据库、不持有用户 Token、不开放公网、不直接调用大模型 API。

首期技术栈：

- PDF/Office/HTML 结构抽取：Docling；
- 扫描件、公式和版面 OCR：生产通过 `DocumentParserProvider` 调用托管 API；PaddleOCR-VL / PP-OCR 仅作 `DEMO-V1` 本地评估基线；
- 图片语义理解与困难页兜底：现有 AI Gateway 调用 `deepseek-v4-flash-vision-exp`；
- 文本总结、问答和工具编排：现有 AI Gateway 调用 `deepseek-v4-flash`。

## 4. 统一契约方案

### 决策

使用 Zod 4 作为 Agent 对内、对外契约的唯一源头：

- `backend/src/agent/contracts/v1` 保存请求、响应、工具、事件、Artifact 和错误 Schema；
- TypeScript 类型由 `z.infer` 得到；
- OpenAPI/JSON Schema 由 Zod Schema 生成；
- 前端从已发布的 OpenAPI 生成 API 类型，不复制手写 DTO；
- MCP 工具复用同一 JSON Schema 和错误信封。

项目目前不是 workspace，因此首期不创建跨前后端源码 package，以免同时改造 Vite、Nest 和发布链。MCP 独立部署成为现实后，再把 `contracts/v1` 发布为内部版本化 package。

规则：

- 所有对象默认严格校验，未知字段拒绝；
- 网络日期使用 ISO 8601 字符串；
- 金额和额度使用整数；
- ID 使用字符串；
- 契约必须包含显式 `schemaVersion: "1"`；
- 依赖写入 lockfile，禁止运行时使用浮动 `latest`。

## 5. Prisma 表结构与迁移

### 决策

- 本功能继续使用当前 Prisma 5.22，不在同一批改造 Prisma 大版本；
- 新表采用 `cuid()` 字符串主键；
- 使用正式 Prisma relation 表达固定关系；Artifact 对现有多种领域对象继续采用类型 + ID 的受控引用；
- 只做 additive migration，不重命名或删除现有字段；
- 正式 Prisma 字段以 [04-DATA-MODEL.md](./04-DATA-MODEL.md) 为准。

第一批迁移必须完整包含：

```text
AgentConversation
AgentMessage
AgentRun
AgentRunStep
AgentToolCall
AgentConfirmation
AgentEvent
AgentArtifact
AgentMessageFeedback
AgentAttachment
AgentMessageAttachment
AgentAttachmentPage
AgentAttachmentChunk
AgentAttachmentAnalysis
AgentOutbox
```

迁移流程固定为：

1. 本地修改 `prisma/schema.prisma`；
2. 使用 `prisma migrate dev` 生成迁移；
3. 人工审查 SQL、外键、条件索引和锁表风险；
4. 执行 `prisma validate`、生成 Client 和集成测试；
5. 提交 Schema 与 migration SQL；
6. 测试/生产只执行 `prisma migrate deploy`；
7. 迁移成功后再打开 Agent feature flag。

禁止在生产使用 `db push`，也不在应用启动时偷偷改表。

## 6. SSE 断线重连协议

### 决策

使用 NestJS `@Sse()` + RxJS Observable。客户端先提交命令创建 Run，再连接事件流：

```text
POST /api/v1/agent/conversations/:conversationId/messages
GET  /api/v1/agent/runs/:runId/events
GET  /api/v1/agent/runs/:runId
```

通用事件：

```json
{
  "schemaVersion": "1",
  "eventId": "run_123:17",
  "runId": "run_123",
  "conversationId": "conv_123",
  "sequence": 17,
  "type": "tool.completed",
  "occurredAt": "2026-09-12T10:00:00.000Z",
  "data": {}
}
```

恢复策略：

- `run.started`、计划、工具结果、确认、用量、最终状态等里程碑写入 `AgentEvent`；
- 同一数据库事务将 Agent Run/Attachment 状态变更与待发布事件写入 `AgentOutbox`，Dispatcher 成功广播后标记完成；学习 Evidence 使用独立 `LearningEvidenceOutbox`；
- `message.delta` 仅实时发送，不逐 token 写数据库；
- SSE 的 `id` 使用 `runId:sequence`；客户端携带 `Last-Event-ID` 重连；
- 服务端先补发该 sequence 之后的持久化事件，再订阅实时事件；
- delta 丢失时，以 `GET /runs/:id` 返回的最终消息快照为准；
- 每 15 秒发送注释心跳，不写数据库；
- Nginx 对该路由关闭响应缓冲，并配置长连接超时；
- Redis Pub/Sub 只做多实例广播，Redis 丢失不影响最终恢复。
- `AgentEvent` 默认保留 7 天；最终 Message、Run 和 Artifact 随会话保留策略保存。

## 7. 队列、幂等与 Redis

### 决策

采用 BullMQ 承载 Agent Run 和附件阶段任务，但单独配置 `agent-queue-redis`：

- 不复用当前 `--save "" --appendonly no` 的 Redis 作为可靠队列；
- 队列 Redis 开启 AOF `everysec`，内存淘汰策略为 `noeviction`；
- Demo 可以单机运行，生产可独立扩容；
- PostgreSQL 中的附件/Run 状态仍是事实来源。

BullMQ 属于至少一次投递语义，因此每个任务必须幂等：

```text
jobId = attachment:{attachmentId}:{stage}:{inputVersion}
```

Worker 用数据库条件更新取得阶段租约，例如只允许：

```text
queued -> processing
processing + expired lease -> processing by new worker
processing -> ready / failed
```

重试规则：

- 网络瞬断、429、5xx、Worker 崩溃：指数退避加抖动，默认最多 3 次；
- 病毒、类型不支持、超限、无权限、内容损坏：不重试；
- 状态不明确的写操作：先按幂等键查询结果，再决定是否重放；
- 每分钟运行轻量 reconciliation，扫描数据库中超时租约和长时间 queued 的记录并补队列。

BullMQ 的具体次版本在实施 PR 中通过兼容性 Smoke 后精确锁定；不把队列库大版本升级与 Agent 功能迭代混在一起。

## 8. 附件安全与处理协议

流程固定为：

```text
create upload -> stream to quarantine -> SHA-256 + magic-byte validation
-> scan -> persist -> enqueue parse -> parse/OCR -> chunks/citations
-> optional vision analysis -> ready
```

初始限制：

- 本地 Demo：单文件 20 MiB、PDF 最多 50 页；
- 生产首发：单文件 50 MiB、PDF 最多 200 页；
- 图片接收 JPEG、PNG、WebP；`DEMO-V1` 先跑通 PDF 和图片，`WA-F0` 再开放经过同样隔离解析的 DOCX；
- 限制是 Agent 私有附件限制，与现有真题后台的 100 MiB 上传限制分开管理；
- 原文件和派生文件使用 private namespace；下载/预览必须重新校验所有权；
- Demo 若未启用真实 ClamAV，界面和日志必须写明 `scanner_unavailable_demo`，不得伪报扫描通过；
- 生产开放上传前必须启用 ClamAV 或等价恶意文件扫描。

送往视觉 API 的不是原始无限大文档，而是服务端生成、压缩并设定页数/像素预算的页面图。业务请求只传 `attachmentId/page/region`，由 AI Gateway 解析成受控 base64 内容；`WA-F0/WA-P1` 不使用公网临时 URL，也不使用供应商 Files API。

## 9. 模型 API 与 AI Gateway

### 决策

所有模型流量必须经过现有 `AiGatewayService`：

| 任务 | 默认模型 | 初始超时 | 自动重试 |
| --- | --- | ---: | ---: |
| Agent 编排、文本问答 | `deepseek-v4-flash` | 30 秒 | 1 次 |
| 图片/困难页面理解 | `deepseek-v4-flash-vision-exp` | 90 秒 | 1 次 |
| 后台摘要 | `deepseek-v4-flash` | 60 秒 | 2 次 |

这些是 task policy 默认值，不写死在 Tool 或前端，压测后可调。

强制规则：

- 视觉内容只能发送给支持图片的模型，且图片 content part 只能属于用户消息；
- 业务层传可信 attachment 引用，不传供应商 URL 或 Key；
- 结构化结果必须通过 Zod 校验，格式错误最多进行一次修复；
- 只对明确的瞬时错误重试；
- 每次调用记录 `traceId/runId/taskType/provider/model/latency/token/cost/errorCode`，正文不进普通日志；
- 消耗额度的工具遵循预留、结算、释放三阶段，数据库账本是最终依据；
- API 不可用时降级为已有题库、标准解析或稍后重试，不伪造分析结果。

## 10. 部署方式

### 本地演示

使用 Docker Compose profile 增加以下隔离服务：

```text
agent-queue-redis
agent-worker
document-parser
optional clamav
```

React、NestJS、PostgreSQL 和现有 Redis 继续沿用项目现有启动方式。只新增 `.env.agent-demo.example`，不得覆盖 `.env`、生产模型 Key、OAuth、SMTP 或现有功能开关。

### 生产首发

- 仍使用 Docker Compose + Nginx 的现有部署路径；
- 后端、Agent Worker、Parser 分别构建为独立 target/container；Agent Run 与附件使用不同队列和并发池；
- Agent 与附件功能开关默认关闭，按内部账号、灰度用户逐步开放；
- 队列 Redis 使用独立持久卷并备份配置；附件使用独立私有 volume/对象存储 namespace；
- 不需要 GPU；模型费用按 API 实际调用结算；
- 达到独立扩缩容、故障域或发布节奏需求后才拆 Agent Gateway 服务。

## 11. 日志、指标和告警

第一阶段不为 Demo 强行引入完整 OpenTelemetry 平台，先使用现有日志/指标体系并统一字段：

```text
requestId, traceId, userIdHash, conversationId, runId,
jobId, attachmentId, toolName, providerCallId, durationMs,
status, errorCode
```

必须有的指标：Run 完成率与 P95、工具错误率、SSE 重连率、队列等待时间、各阶段处理时间、解析失败率、模型错误率/成本、重复任务抑制次数、额度预留未结算数。

必须告警：队列积压、Worker 无心跳、租约长期过期、Parser 连续失败、模型 401/429/5xx 激增、额度账本不平、附件磁盘容量过低。

## 12. 未来插件边界

未来插件实现为 Skills + Remote MCP Server，可选 UI 只负责结构化展示。MCP Adapter：

- 调用同一 Capability Application Service；
- 从 `contracts/v1` 生成输入/输出 JSON Schema；
- 使用独立 OAuth Scope 和审计通道；
- 不启动第二套 CSCAPilot Agent Runtime；
- 不复制宿主 Codex/ChatGPT 的完整聊天记录。

因此 Web Agent 与插件共享能力和规则，但由各自宿主完成交互编排。

## 13. 施工顺序与验收门槛

### Foundation A：契约与数据

1. 建 `contracts/v1` 和错误码；
2. 完成 additive Prisma migration；
3. 会话、消息、Run、事件 CRUD 与所有权测试；
4. 验收：迁移可回滚代码、旧站全量构建和关键 Smoke 不受影响。

### Foundation B：运行与流式

1. 单模型回合和一个只读工具；
2. SSE、断线重连、最终快照；
3. 有限工具循环、取消和确认；
4. 验收：重复提交、断网、重启、多实例竞争均不重复执行写工具。

### Foundation C：附件

1. 私有上传和状态机；
2. 独立队列 Redis、Worker、Parser；
3. PDF/图片、OCR、引用；
4. 视觉 API 困难页兜底；
5. 验收：可上传一份扫描 PDF 和一张题目图片，得到可核对页码/区域的回答。

### Foundation D：能力与演示

1. 接入学习档案、备考度、错题、练习、模考、真题；
2. Artifact、额度、反馈和降级；
3. 固定投资人 Demo 数据和演示脚本；
4. 验收：断开模型 API 时站点仍可用，模型恢复后任务可重试，不产生重复扣费。

### Production Gate

只有同时满足以下条件才开放真实用户：

- 安全扫描真实启用；
- 权限、幂等、账本、删除和保留策略通过集成测试；
- SSE 重连、Worker 重启、Redis 重启和数据库迁移完成演练；
- 固定 Agent 评测集达到门槛；
- 费用上限、速率限制、告警和一键关闭开关有效。

## 14. 明确不选的方案

- 不自建或本地部署 DeepSeek/Qwen 等大语言模型；
- 不把 LangChain/LangGraph 作为第一版核心依赖，有限状态机由现有 NestJS 明确实现；
- 不让 Redis 成为 Run、消息或附件状态唯一来源；
- 不把当前无持久化 Redis 直接当可靠任务队列；
- 不在第一版引入 Kafka、Kubernetes、独立向量数据库；
- 不让前端、Parser 或 MCP 客户端直接访问模型供应商；
- 不在 Agent 项目中顺带升级 Prisma、React、NestJS 等核心大版本。

## 15. 冻结项与可调参数

已经冻结：组件边界、API 模型路线、契约来源、数据库事实来源、SSE 恢复语义、独立队列 Redis、Worker/Parser 隔离、幂等策略、生产迁移方式和安全底线。

允许通过测试调整但不改变架构：模型超时、重试次数、文件/页数上限、Run 工具预算、事件保留天数、Worker 并发、OCR 置信度和视觉兜底阈值。

## 16. 技术依据

- [Zod JSON Schema](https://zod.dev/json-schema)：Zod 4 原生生成 JSON Schema，并支持 OpenAPI 目标。
- [NestJS Server-Sent Events](https://docs.nestjs.com/techniques/server-sent-events)：`@Sse()` 与 RxJS Observable 是 NestJS 官方 SSE 路径。
- [BullMQ production guide](https://docs.bullmq.io/guide/going-to-production)：生产队列建议 Redis AOF 与 `noeviction`。
- [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)：队列是至少一次语义，任务必须原子且幂等。
- [Prisma migrate deploy](https://docs.prisma.io/docs/cli/migrate/deploy)：测试/生产只应用已提交迁移，不生成迁移、不执行 reset。
- [DeepSeek vision guide](https://api-docs.deepseek.com/guides/vision/)：图片输入应路由到视觉模型，并遵守图片角色、格式和大小限制。
