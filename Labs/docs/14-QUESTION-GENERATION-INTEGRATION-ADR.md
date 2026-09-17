# ADR-003：自动出题与 Learning Agent 集成边界

> 状态：Accepted v1.0  
> 决策日期：2026-09-12  
> 适用范围：现有自动出题系统、Web Agent、未来 MCP 插件  
> 依赖文档：[总体架构](../ARCHITECTURE.md) · [工具契约](./02-TOOL-CONTRACTS.md) · [Runtime](./03-AGENT-RUNTIME.md) · [技术基线](./13-TECHNICAL-FOUNDATION-ADR.md)

## 1. 决策摘要

自动出题被定义为独立的 `Question Generation Engine`，不是 Agent Runtime 内部的普通工具实现。Agent 负责理解用户目标、收集结构化参数、确认成本并展示结果；自动出题系统负责 Blueprint、Generation Profile、Prompt、生成、验证、复审、质量门槛和版本治理。

```text
User
  -> Learning Agent / future MCP
  -> PracticeCapability
       -> PublishedQuestionStrategy
       -> QuestionGenerationCapabilityV1
            -> existing AI Questioning subsystem
            -> private generated questions
            -> PracticeSession assembler
  -> practice_session Artifact
```

隔离原则：

- Agent 不直接注入或调用完整 `AIQuestioningService`；
- Agent 不调用 Controller URL，也不直接读取自动出题表；
- Agent 不控制生成 Prompt、Reviewer、Validator 或发布流程；
- 自动出题内部可以持续重构，只对稳定的 Capability v1 负责；
- 用户请求生成的题默认私有，绝不自动发布到公共题库；
- 自动出题尚未就绪不阻塞 `WA-F0/LS-V1`，默认使用已发布题库。

## 2. 为什么必须隔离

现有自动出题已经包含 Blueprint、Generation Profile、Generator、Validator、Reviewer、Quality Gate、Generation Job、版本治理与发布等完整子系统，而且仍在快速迭代。如果 Agent 直接依赖内部方法或数据库状态，将产生以下问题：

- 内部状态或参数变化会频繁破坏 Agent；
- Agent 容易绕过题目质量门槛；
- 用户即时请求可能污染公共题库；
- 自动出题的长任务会占住 Agent Run；
- 生成失败、部分成功和扣费难以恢复；
- 未来拆成独立服务时需要重写 Agent 工具。

因此使用 Anti-Corruption Layer：稳定的 Capability 将 Agent 的业务意图翻译成当前自动出题内部需要的任务和配置，并把内部复杂状态归一化。

## 3. Capability 接口

自动出题模块新增并只导出面向调用方的应用接口：

```ts
interface QuestionGenerationCapabilityV1 {
  requestPracticeGeneration(
    actor: CapabilityActor,
    input: RequestPracticeGenerationV1,
  ): Promise<GenerationRequestV1>;

  getGenerationStatus(
    actor: CapabilityActor,
    requestId: string,
  ): Promise<GenerationRequestV1>;

  cancelGeneration(
    actor: CapabilityActor,
    requestId: string,
  ): Promise<GenerationRequestV1>;

  resolveGenerationResult(
    actor: CapabilityActor,
    requestId: string,
  ): Promise<GeneratedPracticeResultV1>;
}
```

Facade 负责：

- 身份、套餐、学科和范围授权；
- 输入 Schema 和业务规则校验；
- 幂等请求与重复输入识别；
- 额度预估、预留、结算和释放；
- 内部任务创建和状态映射；
- 质量门槛和可消费版本校验；
- 私有练习组装与 Artifact 创建；
- 稳定错误码和审计。

Facade 不复制 Generator、Reviewer 或领域算法。

## 4. Agent 工具形态

### 4.1 `create_practice_session`

普通练习的默认入口，优先使用已发布、已验证题库：

```json
{
  "subject": "chemistry",
  "topicIds": ["oxidation-reduction"],
  "difficulty": "adaptive",
  "questionCount": 10,
  "sourcePolicy": "published_only",
  "idempotencyKey": "idem_123"
}
```

该工具不得因为库存不足就静默产生 AI 费用。若没有足够题目，返回结构化库存不足结果，并由 Agent 提议生成或调整范围。

### 4.2 `request_generated_practice`

仅在以下条件使用：

- 用户明确要求新题或定制题；
- 已发布题库不足，并且用户接受生成成本和等待；
- 诊断或个性化策略明确要求生成；
- 对应学科、题型和用户已进入开放范围。

首版输入：

```ts
type RequestPracticeGenerationV1 = {
  schemaVersion: '1';
  subject: 'math' | 'physics' | 'chemistry';
  topicIds: string[];
  difficulty: 'basic' | 'medium' | 'hard' | 'adaptive';
  questionCount: number;
  language: 'zh-CN' | 'en';
  purpose: 'practice';
  attachmentIds?: string[];
  sourcePolicy: 'generated_private';
  idempotencyKey: string;
};
```

约束：

- Agent 不能传入自由形式的系统 Prompt；
- `topicIds` 必须来自当前 syllabus 的有效 topic；
- 附件必须已完成处理并重新校验所有权；
- 数量、难度和附件页数受服务端策略限制；
- 模型、Prompt 和 Reviewer 版本由自动出题策略决定，而不是用户或 Agent 指定。

### 4.3 状态和取消不是模型轮询工具

`getGenerationStatus` 与 `cancelGeneration` 首先作为 UI/API 能力使用。Agent 模型不应反复调用状态工具消耗回合；Composer/Artifact 卡片通过状态 API 轮询，未来再切换到会话级事件流。

## 5. 异步生命周期

稳定的外部状态：

```text
requested
  -> queued
  -> generating
  -> validating
  -> reviewing
  -> assembling
  -> ready

requested/queued/generating/... -> cancelled
generating/validating/reviewing/assembling -> partial_ready / failed
```

内部更细的任务状态由 Facade 映射，不暴露给 Agent。

Agent 调用生成工具后立即创建 `generation_request` Artifact，并完成当前 Agent Run。生成任务不得为了等待题目而无限延长聊天 Run。

首期灰度状态更新：

- `GET /api/v1/agent/artifacts/:artifactId` 每 2–3 秒查询并指数退避；
- Artifact 进入终态后停止轮询；
- 页面刷新后从数据库恢复；
- 后续增加会话级 `artifact.updated` SSE 和站内通知，不改变 Capability 契约。

生成成功后，`generation_request` 解析为 `practice_session` Artifact，而不是在对话中直接输出整套原始题目 JSON。

## 6. 生成结果隔离

用户触发生成的题默认使用：

```text
visibility = private
purpose = user_practice
publicationStatus = not_publishable
ownerUserId = current user
```

这些题只允许进入该用户被授权的专属练习。即使自动审核通过，也不得自动变成公共题库内容。

生成题默认测量角色只能是 `TRAINING`。进入 `DIAGNOSTIC`、`CALIBRATION` 或 `MOCK` 池必须经过独立教研审批、统计校准和曝光隔离，Agent 与普通训练接口不能枚举保留测量池；完整规则见 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md)。

进入公共题库必须经过独立治理流程：

```text
candidate
  -> deterministic validation
  -> model review
  -> duplicate / similarity checks
  -> production quality gate
  -> admin or approved production policy
  -> published
```

Agent 没有 `approve_question`、`publish_question` 或类似权限。未来管理员 Agent 也必须使用单独工具集、管理员身份和明确确认。

## 7. 完成语义

生成请求结果：

| 状态 | 对用户的处理 |
| --- | --- |
| `ready` | 创建完整 PracticeSession，显示“开始练习” |
| `partial_ready` | 明确显示实际通过题数，用户选择开始或继续补题 |
| `failed` | 释放未使用额度，提供已发布题库练习或重试 |
| `cancelled` | 停止尚未执行步骤，结算已经产生且有效的调用 |

不得把未通过质量门槛的题凑数交付。默认要求完整数量达到门槛才进入 `ready`；部分通过必须使用 `partial_ready`，不能伪装成完整成功。

## 8. 版本与可追溯性

每个请求和每道生成题记录：

```text
capabilityVersion
generationProfileId / generationProfileVersion
syllabusVersion
promptVersion
validatorVersion
reviewerVersion
provider / model
sourceSnapshotHash
attachmentContentVersion
```

Agent 只依赖 `capabilityVersion = 1` 和稳定状态/错误码。内部版本变化不得改变 v1 字段语义。破坏性变化新增 v2，不原地改变 v1。

## 9. 额度与滥用控制

流程：

```text
estimate
  -> explicit confirmation when required
  -> reserve
  -> generate/review
  -> settle successful work
  -> release unused reservation
```

控制项：

- 单次最大题数；
- 每用户和每组织并发数；
- 每日额度和货币成本上限；
- 学科、题型、用途和用户组开关；
- 相同结构化请求和来源 hash 的幂等去重；
- 全局 kill switch；
- 供应商异常熔断；
- 账本 reconciliation；
- 附件输入的 token、页数和图片预算。

普通 `published_only` 练习不得扣自动出题额度。失败请求只结算已经产生且符合现有账本规则的有效调用。

## 10. 错误和降级

稳定错误码至少包括：

```text
GENERATION_NOT_READY
GENERATION_DISABLED
GENERATION_DISABLED_FOR_SUBJECT
GENERATION_SCOPE_UNSUPPORTED
GENERATION_CAPACITY_EXCEEDED
GENERATION_BUDGET_EXCEEDED
GENERATION_QUALITY_GATE_NOT_MET
GENERATION_SOURCE_INVALID
GENERATION_PROVIDER_UNAVAILABLE
GENERATION_CANCELLED
```

降级顺序：

1. 缩小生成范围或题数；
2. 使用同学科、同难度的已发布题库；
3. 创建不含 AI 新题的普通练习；
4. 保存请求并允许稍后重试。

Agent 必须说明发生了降级，不能把题库旧题描述为刚刚生成的新题。

## 11. Feature Flags

至少设置：

```text
AGENT_GENERATED_PRACTICE_ENABLED
AGENT_GENERATED_PRACTICE_MATH_ENABLED
AGENT_GENERATED_PRACTICE_PHYSICS_ENABLED
AGENT_GENERATED_PRACTICE_CHEMISTRY_ENABLED
AGENT_ATTACHMENT_BASED_GENERATION_ENABLED
AGENT_GENERATION_PARTIAL_RESULT_ENABLED
```

默认全部关闭。`AGENT_ATTACHMENT_BASED_GENERATION_ENABLED` 仅为未来可选实验开关；附件默认进入分析、指导或手写审阅链路，不进入自动出题。每个学科必须独立通过固定评测、成本和恢复门槛后开放。关闭生成能力不得影响普通 Agent、附件分析、已发布题库练习或现有后台自动出题流程。

PR10A 已将 Agent 今日方案与教学干预验证中的可信题源缺口写入独立、去重且可审计的 `QuestionSupplyRequest` 队列。该队列不是生成任务，不调用本 ADR 的 `QuestionGenerationCapabilityV1`，也不授予 Agent 任何审核或发布权限。实现、管理接口和失败隔离见 [44-QUESTION-SUPPLY-DEMAND-HANDOFF.md](./44-QUESTION-SUPPLY-DEMAND-HANDOFF.md)。

PR10B 已把上述队列映射为 `QuestionSupplyDemandV1` 和可恢复的 Shadow 计划。当前绑定的是 No-op 适配器，运行只做精确库存复核和契约演练；它不调用 `ai-questioning`。未来真实适配器必须通过独立 ADR 与 PR10C 运营门槛，不能把当前 Shadow 开关解释为生成授权。详见 [45-QUESTION-SUPPLY-FULFILLMENT-SHADOW.md](./45-QUESTION-SUPPLY-FULFILLMENT-SHADOW.md)。

PR10C 已实现独立评估层，区分“库存复核满足”“领域入口恢复可执行”和“任务真实启动”。评估结果即使为 `shadow_evidence_ready` 也固定 `realAdapterAuthorized=false`，不能自动改变本 ADR 的默认关闭策略。指标口径、样本门槛与偏差见 [46-QUESTION-SUPPLY-SHADOW-EVALUATION.md](./46-QUESTION-SUPPLY-SHADOW-EVALUATION.md)。

PR10D 只把上述精确复核放入可关闭、带数据库互斥租约的后台调度，并提供脱敏导出与三学科独立验收报告。调度器绑定的仍是 No-op Adapter；定时运行、报告达标或导出证据都不构成真实生成授权。详见 [47-QUESTION-SUPPLY-SHADOW-OPERATIONS.md](./47-QUESTION-SUPPLY-SHADOW-OPERATIONS.md)。

PR10E 增加的运行历史、租约失效识别和运营健康诊断仍属于观察控制面，不是 Question Generation Capability。`healthy` 只表示 Shadow 管道按预期运行；它与证据 Gate、内容质量批准和真实适配器授权相互独立。详见 [48-QUESTION-SUPPLY-SHADOW-PILOT-OPERATIONS.md](./48-QUESTION-SUPPLY-SHADOW-PILOT-OPERATIONS.md)。

## 12. 实施路线

### 阶段 A：Agent 与自动出题完全隔离

- Agent 只使用已发布题库；
- 定义 Zod Capability v1 与 Mock Adapter；
- 建立 `generation_request` Artifact UI；
- 不等待自动出题完成。

### 阶段 B：影子接入

- Facade 在内部调用真实自动出题系统；
- 结果只进入测试用户私有空间；
- 不展示给普通用户，不发布公共题库；
- 比较成功率、质量、延迟、费用和恢复能力。

### 阶段 C：单学科灰度

- 只开放一个已通过门槛的学科和有限题型；
- 必须明确确认预计额度；
- 支持取消、失败退款、题库降级和一键关闭；
- 监控生成后练习完成率与题目反馈。

### 阶段 D：扩大能力

- 逐学科、难度、题型开放；
- 根据真实需求评估可选的附件出题；附件默认仍用于分析、指导和手写作答审阅；
- 增加会话事件和完成通知；
- 根据容量需求把 Generation Engine 独立部署。

## 13. 拆服务兼容性

第一阶段 Facade 与自动出题系统仍在现有 NestJS 代码库中，但调用边界已经稳定。未来拆分时：

```text
in-process Facade call
          ↓ replace implementation only
queue command + internal service API
```

Agent Tool、MCP Schema、Artifact 和前端 UI 均不改变。自动出题数据库可以继续由原系统持有，Agent 只保存 `generationRequestId`、状态快照、费用和最终 PracticeSession/Artifact 引用。

## 14. 验收门槛

- 自动出题关闭时 Agent 其他功能完全可用；
- Agent 无法调用内部生成、审核或发布方法；
- 同一幂等请求不重复生成、不重复扣费；
- 任务重启、Worker 崩溃和 SSE 断线后状态可恢复；
- 私有生成题无法被其他用户读取；
- 私有生成题不会自动进入公共题库；
- 未通过质量门槛的题不会进入 `ready` PracticeSession；
- 失败和取消后的额度账本可对账；
- 自动出题内部版本升级不破坏 Capability v1 契约；
- Agent 对题库降级、部分成功和失败做真实说明。
