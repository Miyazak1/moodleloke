# CSCAPilot Learning Agent 基础架构方案

> 状态：Accepted baseline v0.2  
> 更新时间：2026-09-12  
> 适用范围：CSCAPilot 在线网页 Agent、Codex/ChatGPT 等外部 Agent 插件

## 1. 文档目的

本文档定义 CSCAPilot Learning Agent 的第一版总体架构、系统边界、核心组件、能力契约和实施顺序。

目标不是把现有网站包装成一个聊天框，而是把 CSCAPilot 已有的学习能力整理成可复用、可授权、可观测的工具层，并同时服务于：

- CSCAPilot 在线网页 Agent；
- Codex、ChatGPT 等支持插件或 MCP 的外部 Agent；
- 后续可能接入的学校平台、移动端或其他渠道。

## 2. 产品定位

CSCAPilot Learning Agent 是面向 CSCA 学习场景的任务型 Agent。用户用自然语言表达目标，Agent 调用 CSCAPilot 的真实业务能力完成学习任务，并返回可以继续操作的学习成果。

发布阶段统一使用 `PROTO-S`、`DEMO-V1`、`WA-F0`、`LS-V1`、`WA-P1`、`PROD-V1` 和 `PLUGIN-P1`，不再用未限定的“MVP”指代不同范围。文档事实优先级、Canonical API 和收口决策见 [19-ARCHITECTURE-CLOSURE-ADR.md](./docs/19-ARCHITECTURE-CLOSURE-ADR.md)。

第一版重点解决以下任务：

- 查看学习进度、备考状态和薄弱知识点；
- 根据当前水平创建练习或诊断；
- 进入错题复习；
- 继续未完成的模拟考试；
- 搜索和打开真题资料；
- 请求提示、解析和练习总结；
- 查看或调整学习计划。

## 3. 核心设计原则

### 3.1 一套能力内核，多个使用入口

网页 Agent 和插件不得分别实现题库、练习、错题、模考或额度逻辑。所有入口都通过统一的 Capability Layer 调用现有领域服务。

### 3.2 网页与插件使用不同的编排方式

- 在线网页：由 CSCAPilot Agent Gateway 调用模型并编排工具。
- Codex 等外部 Agent：由宿主 Agent 理解用户意图和安排步骤，CSCAPilot 插件只提供 Skill、MCP 工具及必要的可选 UI。

外部插件不应在每次调用中再启动一套完整 CSCAPilot Agent，否则会产生双重推理、上下文冲突、额外延迟和不透明计费。

### 3.3 工具优先，聊天只是交互方式

聊天回答不是最终资产。练习轮次、诊断报告、真题套装、错题复习包和学习计划都必须成为可持久化、可继续操作的 Artifact。

### 3.4 有限自主执行

第一版 Agent 每次运行最多执行 3 至 5 个步骤。不得使用无法预测终止条件的自主循环。涉及提交考试、修改资料、消耗明显额度等操作时必须遵守确认策略。

### 3.5 可解释、可恢复、可审计

每次运行需要记录调用了什么能力、使用了哪些数据、产生了什么结果、消耗了多少额度，以及失败后能否安全重试。

## 4. 总体架构

```text
┌────────────────────── 使用入口 ──────────────────────┐
│                                                      │
│  CSCAPilot Web                    External Agents    │
│  对话、流式输出、学习卡片          Codex / ChatGPT     │
│         │                              │             │
└─────────┼──────────────────────────────┼─────────────┘
          │                              │
          ▼                              ▼
┌──────────────────┐          ┌────────────────────────┐
│ Web Agent Gateway│          │ CSCAPilot Plugin       │
│ 会话、附件、运行管理│         │ Skills + MCP + 可选 UI │
│ 模型与工具编排    │          │ 不重复实现 Agent 编排  │
└─────────┬────────┘          └────────────┬───────────┘
          │                                │
          └──────────────┬─────────────────┘
                         ▼
┌──────────────── Capability / Tool Layer ──────────────┐
│ 工具定义 │ Schema 校验 │ 权限 │ 确认 │ 额度 │ 幂等 │ 审计 │
└────────────────────────┬──────────────────────────────┘
                         ▼
┌────────────────── CSCAPilot Domain ───────────────────┐
│ 用户与学习档案 │ 题库与练习 │ 错题 │ 模考 │ 真题 │ AI服务 │
└────────────────────────┬──────────────────────────────┘
                         ▼
┌──────────────────── Data Layer ───────────────────────┐
│ PostgreSQL │ Redis/队列 │ 私有文件存储 │ 日志与指标      │
└───────────────────────────────────────────────────────┘
```

## 5. 核心组件

### 5.1 Web Agent UI

职责：

- 创建、查看和继续对话；
- 显示模型流式回复和任务执行状态；
- 渲染练习、真题、诊断、错题和计划等 Artifact；
- 承载确认、取消、重试和反馈交互；
- 展示 AI 额度变化和数据来源。
- 在 Composer 中上传、预览、取消和重试私有文档/图片，并渲染页码或区域引用。

当前 `Labs/dist` 原型用于验证该层的产品形态，不直接承担领域业务逻辑。

### 5.2 Agent Gateway

仅服务 CSCAPilot 自有网页入口，职责包括：

- 会话、消息和运行状态管理；
- 构建当前任务需要的最小上下文；
- 调用模型并执行受控工具循环；
- 通过 SSE 推送运行事件；
- 生成和关联 Artifact；
- 执行超时、取消、重试和降级；
- 记录用量、反馈、错误和追踪信息。

### 5.3 Orchestrator

Orchestrator 是 Agent Gateway 内部的有限状态执行器，不是无限自主循环。

建议状态：

```text
received -> planning -> awaiting_confirmation -> executing
         -> responding -> completed
         -> failed / cancelled
```

第一版约束：

- 单次运行最多 5 次工具调用；
- 单个工具配置独立超时；
- 写操作使用幂等键；
- 工具失败时只对安全、可重复操作自动重试；
- 需要确认的工具不得由模型绕过确认状态直接执行。

### 5.4 Capability / Tool Layer

这是整个架构的核心复用层。网页编排器和远程 MCP Server 都调用同一套应用服务，而不是互相调用。

每个工具至少包含：

- 稳定的工具名称与版本；
- 清晰的用途说明；
- 结构化输入、输出 Schema；
- 所需权限范围；
- 风险和确认等级；
- 是否消耗 CSCAPilot AI 额度；
- 幂等、超时和重试策略；
- 审计字段和错误代码。

### 5.5 CSCAPilot Plugin

插件建议采用 `Skills + MCP Server` 的组合：

- Skills：描述典型学习工作流、工具选择规则和成功标准；
- MCP Server：安全暴露实时数据和操作能力；
- Optional UI：仅在需要比较、编辑、确认或导航结构化结果时使用。

插件必须保持 headless 可用：即使客户端不支持自定义 UI，模型也应能依据结构化结果完成任务。

### 5.6 Learning Intelligence 与 Decision Engine

实时学习分析是 Agent 的结构化决策基础，不由大模型临时猜测。系统在每次有效答题事件后更新多维知识点状态，包括掌握度、置信度、独立性、难度上限、记忆稳定、熟练度、迁移、覆盖和错误模式；Decision Engine 基于该状态、考试目标、复习队列和题目供给生成版本化 `LearningPrescription`。

Agent 负责解释和执行方案，Question Supply Engine 负责从已发布题库选题或请求自动出题系统补充供给。现有掌握度 v1 继续运行，V2 先以 Shadow Mode 验证并按学科灰度。完整设计见 [15-REALTIME-LEARNING-INTELLIGENCE-ADR.md](./docs/15-REALTIME-LEARNING-INTELLIGENCE-ADR.md)。

### 5.7 Learning Intervention Engine

做题是掌握知识点的手段。系统依据实时状态、重复错误、提示依赖、记忆风险和练习节奏，在题后、mini-set 间隔、Round 结束或未来复习时机安排提示、错因纠正、Concept Card、Worked Example、Micro Lesson 和验证题。

干预由版本化策略触发，大模型只负责受控的个性化表达。查看讲解不等于掌握，必须通过后续独立验证形成学习证据；学生可以跳过、推迟或关闭主动干预。完整决策见 [16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md](./docs/16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md)。

### 5.8 Score Readiness & Gap Engine

产品北极星是帮助学生建立达到其 CSCA 目标分数所需的可验证能力，而不是最大化对话量或刷题量。该引擎将版本化目标分数、考试日期、评分规则、多维学习状态、大纲覆盖、题目量尺和计时模考表现合成为 `ScoreReadinessForecast` 与 `TargetGapSnapshot`，再为 Decision Engine 提供目标约束。

预测必须输出区间、达标概率和置信度；证据不足时安排诊断，不输出伪精确分数。自动生成题可以作为主要训练供给，但预测必须由独立校准题、模考和受治理的考试事实锚定。大模型只解释结果，不计算或修改分数预测。完整决策见 [17-TARGET-SCORE-OUTCOME-ADR.md](./docs/17-TARGET-SCORE-OUTCOME-ADR.md)。

## 6. 第一版工具目录

本节仅作能力概览；正式工具名、版本、DTO、风险等级和错误码以 [02-TOOL-CONTRACTS.md](./docs/02-TOOL-CONTRACTS.md) 为唯一事实来源，CI 从 Tool Registry 校验文档漂移。

网页、插件、内部能力、发布阶段和 Feature Flag 的统一索引见 [20-AGENT-CAPABILITY-CATALOG.md](./docs/20-AGENT-CAPABILITY-CATALOG.md)。

### 6.1 读取类工具

| 工具 | 作用 | 权限 | AI 额度 |
| --- | --- | --- | --- |
| `get_learning_profile` | 获取学习档案与备考目标 | `learning.read` | 不消耗 |
| `get_learning_dashboard` | 获取今日任务、进度和概览 | `learning.read` | 不消耗 |
| `get_ai_credit_balance` | 获取 AI 权益和余额 | `learning.read` | 不消耗 |
| `get_score_readiness` | 获取目标分数区间、达标概率、置信度和证据版本 | `learning.read` | 不消耗 |
| `get_target_gap` | 获取最影响目标的能力差距 | `learning.read` | 不消耗 |
| `get_learning_prescription` | 获取当前首选任务和替代方案 | `learning.read` | 不消耗 |
| `get_question_supply_status` | 获取合格已发布题目库存状态 | `learning.read` | 不消耗 |
| `get_study_availability` | 获取长期学习时间偏好 | `learning.read` | 不消耗 |
| `simulate_plan_adjustment` | 模拟时间或节奏变化，不保存 | `learning.read` | 不消耗 |
| `get_subject_mastery` | 获取学科/知识点掌握度 | `learning.read` | 不消耗 |
| `get_review_queue` | 获取待复习错题队列 | `learning.read` | 不消耗 |
| `list_mock_exam_attempts` | 获取可继续的模考和历史 | `learning.read` | 不消耗 |
| `search_past_papers` | 搜索公开真题与资料套装 | `resources.read` | 不消耗 |

### 6.2 可撤销写操作

| 工具 | 作用 | 权限 | 默认确认 |
| --- | --- | --- | --- |
| `create_adaptive_practice` | 创建自适应练习 | `practice.write` | 不需要 |
| `create_diagnostic` | 创建诊断练习 | `practice.write` | 不需要 |
| `start_review_practice` | 从错题队列创建复习 | `practice.write` | 不需要 |
| `start_mock_exam` | 创建模考 Attempt | `mock_exam.write` | 不需要 |

自动出题作为独立的大型能力，通过版本化、异步的 `QuestionGenerationCapabilityV1` 接入，不作为 Runtime 内部生成函数。普通练习默认只使用已发布题库；用户明确要求定制新题且功能已灰度开放时，才使用 `request_generated_practice`。生成请求返回可恢复的 `generation_request` Artifact，后台完成后解析为 `practice_session`。用户生成题默认私有且不可发布；完整边界见 [14-QUESTION-GENERATION-INTEGRATION-ADR.md](./docs/14-QUESTION-GENERATION-INTEGRATION-ADR.md)。

### 6.3 AI 生成工具

| 工具 | 作用 | 权限 | AI 额度 |
| --- | --- | --- | --- |
| `generate_question_hint` | 针对当前题目提供提示 | `ai.generate` | 消耗 |
| `generate_question_explanation` | 生成题目解析 | `ai.generate` | 消耗 |
| `generate_round_summary` | 生成练习轮次总结 | `ai.generate` | 消耗 |
| `generate_weekly_learning_report` | 生成周度学习报告 | `ai.generate` | 消耗 |
| `request_generated_practice` | 异步请求私有定制题并组装练习 | `ai.generate` + `practice.write` | 预留后按结果结算 |

### 6.4 敏感写操作

| 工具 | 作用 | 权限 | 默认确认 |
| --- | --- | --- | --- |
| `update_learning_profile` | 修改学习档案 | `profile.write` | 需要展示变更摘要 |
| `update_score_goal` | 修改目标分数 | `profile.write` | 需要展示变更摘要 |
| `update_study_availability` | 修改长期学习时间偏好 | `profile.write` | 需要展示变更摘要 |
| `submit_mock_exam` | 正式提交模考 | `mock_exam.submit` | 必须明确确认 |

## 7. 工具契约示例

工具返回值采用统一信封，便于网页和外部 Agent 处理：

```json
{
  "ok": true,
  "tool": "create_diagnostic",
  "toolVersion": "1.0",
  "requestId": "req_123",
  "data": {
    "sessionId": "practice_456",
    "questionCount": 20
  },
  "artifact": {
    "id": "artifact_789",
    "type": "practice_session",
    "title": "化学氧化还原诊断",
    "url": "/zh/practice/sessions/practice_456"
  },
  "usage": {
    "creditsCharged": 0,
    "creditsRemaining": 43
  },
  "confirmation": null
}
```

失败结果不得只返回自由文本：

```json
{
  "ok": false,
  "requestId": "req_123",
  "error": {
    "code": "INSUFFICIENT_AI_CREDITS",
    "message": "AI credits are insufficient for this explanation.",
    "retryable": false,
    "userAction": "manage_credits"
  }
}
```

## 8. Artifact 模型

Artifact 是 Agent 产出的可操作学习对象。第一版支持：

- `practice_session`：普通练习或诊断；
- `mock_exam`：可继续或已提交的模考；
- `review_session`：错题复习包；
- `past_paper_bundle`：真题或答案解析套装；
- `study_plan`：备考计划；
- `readiness_report`：备考度报告；
- `weekly_report`：周度学习总结；
- `concept_card`：知识点讲解卡。

建议的通用字段：

```text
id, type, version, ownerUserId, title, summary,
status, sourceTool, entityType, entityId, url,
payload, createdAt, updatedAt, expiresAt
```

领域对象仍由原业务表管理；Artifact 只保存展示和恢复任务所需的引用及快照，避免复制完整业务数据。

## 9. 会话与运行数据

建议新增以下逻辑实体，最终表名可随现有 Prisma 规范调整：

| 实体 | 用途 |
| --- | --- |
| `agent_conversations` | 网页端会话元数据 |
| `agent_messages` | 用户、Agent 和系统消息 |
| `agent_runs` | 一次用户请求对应的运行 |
| `agent_run_steps` | 计划和执行步骤 |
| `agent_tool_calls` | 工具调用、耗时和结果摘要 |
| `agent_artifacts` | 会话产生的学习对象引用 |
| `agent_feedback` | 点赞、点踩和问题分类 |

外部插件的完整聊天记录默认由宿主维护。CSCAPilot 只保存必要的工具调用审计和业务结果，不复制 Codex 的完整对话；只有用户主动选择同步时才考虑跨渠道会话关联。

## 10. Web Agent API 草案

```text
POST   /api/v1/agent/conversations
GET    /api/v1/agent/conversations
GET    /api/v1/agent/conversations/:conversationId
POST   /api/v1/agent/conversations/:conversationId/messages
GET    /api/v1/agent/runs/:runId/events
POST   /api/v1/agent/runs/:runId/cancel
POST   /api/v1/agent/runs/:runId/confirm
POST   /api/v1/agent/messages/:messageId/feedback
```

第一版流式通道使用 SSE。建议事件类型：

```text
run.started
message.delta
plan.created
tool.started
tool.completed
artifact.created
confirmation.required
usage.updated
run.completed
run.failed
```

客户端必须依据事件 ID 支持断线重连和去重，不能假设网络连接始终保持。

## 11. 身份、权限和确认

### 11.1 网页端

复用现有 CSCAPilot 登录会话、用户身份和授权体系。Agent Gateway 不建立第二套账户系统。

### 11.2 外部插件

通过 CSCAPilot OAuth 授权，并按最小权限拆分 Scope：

```text
learning.read
resources.read
practice.write
mock_exam.write
mock_exam.submit
profile.write
ai.generate
```

### 11.3 操作等级

- Level 0：只读查询，可直接执行；
- Level 1：低风险、可撤销写操作，可直接执行并告知结果；
- Level 2：修改档案、计划或产生明显 AI 费用，先展示摘要；
- Level 3：提交考试或其他不可轻易撤销操作，必须明确确认。

后端必须独立执行权限和确认校验，不能仅依赖模型提示词或前端按钮。

## 12. AI 额度与成本归属

计费以实际执行能力为准，而不是以“是否在聊天”为准：

- 读取档案、搜索资料、创建已有题库练习：不消耗 CSCAPilot AI 额度；
- 外部宿主模型自行理解和总结工具结果：不消耗 CSCAPilot AI 额度；
- 调用 CSCAPilot 托管的提示、附件分析、训练内容生成或总结模型：消耗 CSCAPilot AI 额度；
- 工具结果必须返回本次扣费及剩余额度；
- 可能扣费的操作应支持在执行前查询预计费用。

模型供应商与业务能力解耦。内部使用 `ModelProvider` 接口和场景配置，不在业务代码或工具名中绑定 DeepSeek 等具体模型名称。当前文本、视觉和需要模型推理的文档 OCR 均通过受控 Provider API 调用，不在生产业务服务器自建 GPU/模型推理服务；文本默认 `deepseek-v4-flash`，视觉默认 `deepseek-v4-flash-vision-exp`，二者使用独立 task policy。Docling 等确定性解析器可以作为 CPU 服务运行，但不得隐式下载或启动生产模型。

## 13. 上下文与记忆

### 13.1 任务上下文

每次运行只加载完成当前任务需要的数据。例如“给我复习化学错题”需要学习档案、化学掌握度和复习队列，但通常不需要加载全部模考历史和所有真题内容。

### 13.2 长期记忆

第一版不建立自由文本的无限长期记忆。长期个性化优先来自结构化数据：

- 学习档案与目标；
- 学科和知识点掌握度；
- 错题与复习状态；
- 模考记录；
- 用户明确保存的偏好。

任何从对话中提取并长期保存的偏好，后续应提供查看、修改和删除入口。

## 14. 安全与隐私

- 所有工具参数都必须通过 Schema 和业务规则校验；
- MCP 和网页入口使用相同的数据权限边界；
- 工具结果只返回完成任务所需的最小数据；
- 日志不得记录访问令牌、邮箱密码、模型密钥或完整敏感请求体；
- AI 提示中注入的题目、资料和用户内容需要标记来源并防止被当作系统指令；
- 用户附件经过隔离、类型校验、恶意软件扫描和受限解析，原文件与派生内容默认私有；
- 文件下载使用短期授权地址或受控下载端点；
- 写操作需要幂等键，避免网络重试造成重复练习、重复扣费或重复提交；
- 用户可以删除网页 Agent 会话，但业务学习记录按现有数据规则处理。

## 15. 可观测性与质量评估

每次 Agent Run 生成统一 `traceId`，至少记录：

- 意图分类和选用工作流；
- 模型、延迟、Token 和供应商错误；
- 工具名称、版本、耗时、成功率和错误码；
- 确认、取消、重试和降级情况；
- Artifact 创建和最终用户操作；
- CSCAPilot AI 额度变化；
- 用户反馈。

第一版核心指标：

- 任务完成率；
- 工具选择准确率；
- 首次完成率；
- P50/P95 响应时间；
- 工具失败率；
- 取消和重复执行率；
- 单次已完成任务的模型成本；
- Artifact 打开率和后续学习完成率。

上线前应为核心工作流建立固定评测集，至少覆盖正常请求、歧义请求、权限不足、额度不足、工具超时和恶意指令注入。

## 16. 部署拓扑建议

第一阶段可以作为现有后端中的独立模块部署，避免过早拆分微服务：

```text
Existing Backend
├── Domain APIs
├── Agent Gateway module
├── Capability / Tool module
├── AI Gateway -> text/vision provider APIs
└── future MCP adapter

Async Attachment Worker
├── file validation / scan
├── Docling / OCR
└── chunks / citations
```

以下条件出现后再考虑独立服务：

- Agent 流量和普通 API 流量需要分别扩缩容；
- 长时间运行或异步任务明显增加；
- MCP 与网页端需要不同的发布节奏或安全边界；
- 模型调用、队列和观测需要独立资源治理。

Redis 可用于短期运行状态、限流和队列；PostgreSQL 保存会话索引、运行审计和 Artifact 引用；公共真题与私有对话附件使用隔离的文件 namespace 和授权规则。

## 17. 分阶段实施

### Phase 0：契约与基础设施

- 确认第一版工具目录；
- 定义 Tool Envelope、错误码和 Artifact Schema；
- 建立权限、确认、幂等和计费规则；
- 为现有领域 API 增加统一的应用服务入口。

### Phase 1：Web Agent Pilot（WA-P1）

- 会话和消息持久化；
- Agent Run 状态机；
- SSE 流式事件；
- 接入读取、练习、错题、模考和真题核心工具；
- Artifact 卡片、确认、取消、重试和反馈；
- 额度显示与基础可观测性。
- 文档/图片上传、解析、OCR/视觉理解与证据引用。

### Phase 2：Plugin Pilot（PLUGIN-P1）

- 部署稳定 HTTPS MCP Server；
- OAuth 与 Scope；
- 输出与网页一致的 Tool Schema；
- 编写核心 Skills；
- 在 Codex 中测试无 UI 工作流；
- 根据实际需要增加少量 MCP UI。

### Phase 3：增强能力

- 多步骤学习计划；
- 周报和复习调度；
- 更细的长期偏好；
- 后台任务和通知；
- 跨渠道 Artifact 继续操作；
- 教师和组织场景。

## 18. 第一版不做的事项

- 不构建无限自主运行的通用 Agent；
- 不让外部插件复制网页端完整编排器；
- 不自动执行正式模考提交等高风险操作；
- 不把整套用户历史无筛选地放入模型上下文；
- 不在第一版同步外部 Agent 的完整聊天记录；
- 不为了 Agent 重写现有题库、练习和模考系统；
- 不在业务代码中固定单一模型供应商。

## 19. 已冻结的工程基线与剩余产品决策

数据库迁移、统一 Schema、SSE 重连、异步队列、附件 Worker、模型 API 路由和部署边界已经在 [13-TECHNICAL-FOUNDATION-ADR.md](./docs/13-TECHNICAL-FOUNDATION-ADR.md) 中冻结。实现阶段以该 Accepted ADR 为准，不再把这些问题作为开放技术选型。

以下仍是产品/运营决策，不阻塞基础施工：

1. 第一版是否只支持中文和英文，语言由会话自动识别还是跟随账号设置；
2. AI 工具的具体扣费单位、用户显示价格及执行前预估方式；
3. 组织套餐是否共享 Agent 额度；
4. 插件是否允许免费用户连接，以及各 Scope 的套餐限制；
5. Artifact 的保留期限和跨渠道打开策略；
6. 插件首发时间和套餐范围。

## 20. 参考资料

- [OpenAI Plugin architecture](https://developers.openai.com/plugins/concepts/plugins)
- [OpenAI MCP server](https://developers.openai.com/plugins/concepts/mcp-server)
