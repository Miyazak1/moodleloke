# Agent 真实练习与错题修复闭环实现（PR6A / PR6B）

> 迁移说明（2026-09-15）：本文记录的跨页面深链是 PR11G 的过渡实现。学生端目标架构已由 [70-AGENT-NATIVE-LEARNING-WORKSPACE-ADR.md](./70-AGENT-NATIVE-LEARNING-WORKSPACE-ADR.md) 替代：领域 API 和幂等结算保持不变，答题与报告改在 Agent Shell 内呈现。

## 1. 本阶段结果

网页 Agent 的 `learning_plan` 不再只是指向学科页。用户点击“开始这项任务”时，前端调用受保护的写接口，由后端复用现有 `CscaAdaptiveService` 创建真实 Session 与 Round：

```text
Today Plan Artifact
  -> POST /api/v1/agent/artifacts/:artifactId/start-practice
  -> 校验用户、Artifact、当前 Prescription、有效期与题源许可
  -> create_adaptive_practice@1.0
  -> 现有 Adaptive Session / Round
  -> 答题与提交
  -> Learning Evidence Outbox
  -> LS-V1 Projection
  -> Target Gap / Prescription
  -> 返回原 Agent 对话并生成新方案
```

Agent 没有复制题目选择、判题、Mastery 或错题规则。写能力只负责编排，所有练习业务继续由现有自适应训练域负责。

## 2. 写能力约束

`create_adaptive_practice@1.0` 仅接受系统已经生成并持久化的 `learning_plan` Artifact。它不接受用户任意指定题量、难度或未审核题源。

执行前必须满足：

- 当前登录用户拥有该 Artifact；
- Artifact 类型为 `learning_plan`；
- 首选任务属于 `diagnostic`、`review` 或 `targeted_practice`；
- 科目属于 math、physics、chemistry；
- 方案生成时的题源检查允许开始；
- Artifact 指向的 Prescription 仍是该用户当前发布版本且未过期；
- 网页 Agent 和练习写能力两个 Feature Flag 均开启。

相同用户和 `clientRequestId` 使用 `AgentToolCall` 唯一约束实现幂等。已完成请求直接返回原 Session/Round；中途失败可重试，底层自适应服务会复用未提交 Round，避免重复创建。

成功后同时记录：

- `AgentToolCall.output`：Session、Round、模式、题量、语言与路由；
- `AgentArtifact.status=started` 与 launch 快照；
- `LearningPrescriptionOutcome(decision=accepted)`；
- `practice.started` Agent Outbox 事件。

当前练习创建不扣 AI 额度。AI Coach 的提示、解析和总结继续沿用其自身额度规则。

## 3. 完成后的回流

Agent 创建的 Round 路由携带原 `conversationId` 和 `artifactId`。答题页跳转报告时保留该上下文。报告页显示“返回 Agent 更新下一步”：

1. 向原对话提交一条带 `adaptive_round` entityRef 的消息；
2. Agent Runner 先处理待投影 Evidence，减少读到旧状态的窗口；
3. 再按既有顺序读取 Profile、Goal、Gap、Prescription 与题源；
4. 新 Artifact 使用最新真实作答证据生成。

若投影或决策仍在更新，Agent 不伪造结果，继续返回“学习证据正在更新”的明确状态。

## 4. Feature Flag

```text
AGENT_WEB_ENABLED=true
VITE_AGENT_WEB_ENABLED=true
CSCA_AGENT_PRACTICE_WRITE_ENABLED=true
```

本地 `start-cscalite-dev.bat` 已开启这些开关。生产环境默认应关闭写能力，完成数据库备份、题源检查和灰度验证后单独开启。

## 5. 实现位置

- 写能力：`backend/src/agent/agent-practice-action.service.ts`
- API：`backend/src/agent/agent.controller.ts`
- 投影同步：`backend/src/agent/agent-runner.service.ts`
- 练习域复用：`backend/src/csca-special-practice/csca-special-practice.module.ts`
- Agent 卡片：`frontend/src/pages/AgentPage.tsx`
- 答题/报告回流：`frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`
- 回归：`backend/scripts/agent-runtime-today-plan-test.cjs`、`frontend/e2e/agent-runtime.spec.ts`

## 6. 验证命令

```bash
npm --prefix backend run test:agent-runtime
npm --prefix frontend run build
npm --prefix frontend run test:e2e:agent
```

覆盖范围包括后端构建、过期方案拒绝、写能力幂等、同一 Round 复用、Agent 页面桌面/移动端布局、真实创建请求以及带上下文的 Round 路由。

## 7. PR6B：错题修复绑定

当 Prescription 的首选任务是 `review` 或 `concept_learning` 时，Agent Runner 额外调用只读能力 `get_review_queue`，按科目和任务 topic 绑定一个真实的 `CscaWrongPattern`：

```text
Prescription review / concept_learning
  -> get_review_queue
  -> Artifact.snapshot.review(reviewItemId, topicId, patternType, recurrenceCount)
  -> start_review_practice@1.0
  -> 后端再次校验错题归属与 active/improving 状态
  -> Adaptive verification Round（目标主题至少 80% 为通过）
  -> 未通过：现有 remediationPlan 推送概念卡、同类变式或针对性训练
  -> 通过：CscaWrongPattern 置为 resolved
```

Agent 只保存错题引用，不复制错题判定、概念卡选择或验证规则。错题在用户启动任务前若已经解决或发生变化，Artifact 会结算为 `superseded` 并要求重新生成方案。

## 8. 任务状态与结算

`LearningPrescriptionOutcome` 使用以下决策状态：

- `accepted`：用户启动了系统推荐任务；
- `completed`：普通训练已提交，或错题验证达到目标主题 80%；
- `failed`：错题验证未达到目标，进入知识讲解/变式补救；
- `abandoned`：用户从未提交的 Agent Round 确认退出；
- `superseded`：Prescription 过期、已非当前版本，或绑定错题已变化。

报告页会自动调用 `POST /api/v1/agent/practice-rounds/:roundId/settle`，返回 Agent 前再确认一次。结算通过 `settle_learning_task@1.0` 的 `AgentToolCall` 唯一键保持幂等，刷新报告不会重复写 Outcome。答题页退出 Agent 任务时调用 `POST /api/v1/agent/artifacts/:artifactId/abandon`。

结算之后，用户返回原对话；Runner 先消费待投影 Evidence，再读取最新 Projection、Target Gap 与 Prescription，生成下一项任务。结算状态描述任务是否完成，不直接写 Mastery。

## 9. 后续边界

PR6A 只完成系统推荐练习闭环。下一阶段优先补充：

1. 题源不足时的运营告警与安全补题请求，不允许 Agent 直接发布题；
2. 附件上传、OCR、手写答案分析的异步 Worker；
3. API 大模型的解释与意图识别层；
4. 将错题补救链条中的概念卡与变式完成度升级为独立 Artifact，支持跨设备恢复。
