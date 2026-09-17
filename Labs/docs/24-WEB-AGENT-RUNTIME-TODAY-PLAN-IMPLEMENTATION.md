# Web Agent Runtime：Today Plan 最小垂直链路实施记录

> 状态：PR 5 runtime implemented, feature off by default
>
> 更新时间：2026-09-13
>
> 依赖：[Agent Runtime](./03-AGENT-RUNTIME.md) · [首条垂直切片](./18-FIRST-VERTICAL-SLICE.md) · [Gap 与 Prescription](./23-LS-V1-GAP-PRESCRIPTION-IMPLEMENTATION.md)

## 1. 本次落地范围

本阶段把已经存在的学习智能能力接成第一条可运行的 Web Agent 后端链路：

```text
verified user message
  -> conversation-scoped idempotent AgentRun
  -> deterministic today_plan router
  -> explicit read-only capability allowlist
  -> Goal + Gap + Prescription + Question Supply
  -> persisted assistant message + Learning Plan Artifact
  -> replayable ordered SSE milestones
  -> existing practice deep link
```

此实现不调用大模型。第一条链路优先验证事实、权限、恢复和产品闭环；后续接入 API 大模型时，只允许它解释结构化结果和做受约束的意图识别，不允许覆盖 Prescription、题量、理由代码或库存判断。

本阶段也不调用自动出题。题源不足时返回明确降级结果，不创建练习、不伪造可用库存。自动出题继续作为隔离的 Question Supply 系统，未来只能通过受控异步补库能力接入。

## 2. HTTP 契约

所有接口均要求已验证用户，所有对象读取均同时约束当前 `userId`：

| Method | Path | 作用 |
| --- | --- | --- |
| `POST` | `/api/v1/agent/conversations` | 创建当前用户会话 |
| `GET` | `/api/v1/agent/conversations` | 列出当前用户会话 |
| `GET` | `/api/v1/agent/conversations/:id` | 读取会话、消息和 Artifact |
| `POST` | `/api/v1/agent/conversations/:id/messages` | 幂等提交用户消息并创建 Run |
| `GET` | `/api/v1/agent/runs/:id` | 查询 Run、工具里程碑和 Artifact |
| `GET` | `/api/v1/agent/runs/:id/events` | SSE 事件流；支持 `Last-Event-ID` 或 `?after=` 恢复 |

消息请求冻结字段：

```json
{
  "clientRequestId": "client-generated-stable-id",
  "text": "我今天该学什么？",
  "locale": "zh-CN",
  "pageContext": {
    "route": "/csca-subjects/math/practice"
  }
}
```

同一会话内重复 `clientRequestId` 且正文相同，返回原 `messageId` 和 `runId`；正文不同返回冲突。数据库的单活 Run 唯一约束处理并发竞争，不依赖应用层先查后写。

## 3. 运行状态与恢复

PR5 最小只启用：

```text
queued -> running -> completed
                  -> failed
```

`waiting_confirmation`、`cancelled` 和写能力确认保留在总架构中，但本阶段没有对外入口。运行器使用数据库 lease 和 `attemptCount`；进程启动及每 30 秒扫描：

- 过期的 `running` Run 重置为 `queued`；
- 最多领取 20 个排队 Run；
- `queued -> running` 使用条件更新，只允许一个执行者领取；
- 工具调用、助手消息、Artifact 和事件都有稳定幂等键，恢复不会重复业务结果。

当前链路只有少量只读数据库能力，单次 lease 足够覆盖其有界执行时间。长耗时 OCR、附件解析、模型流式输出和写能力在后续阶段使用独立 Worker 与 lease heartbeat。

## 4. 工具边界

Web Agent 的显式 allowlist 只有：

- `get_learning_profile`
- `get_score_goal`
- `get_target_gap`
- `get_learning_prescription`
- `get_question_supply_status`

运行器只通过 `LearningCapabilityRegistryService` 调用，不访问业务 Controller，也不直接查询学习业务表。Capability Context 固定为当前用户、`web_agent` 渠道和 `learning.read` scope。

以下能力明确不在 allowlist：

- 自动出题及题目发布；
- 直接写 Mastery、Gap、Prescription 或 Forecast；
- 创建练习、扣费、修改目标；
- 管理员能力和任意 URL/代码执行。

工具失败只持久化稳定错误码与可重试属性，不向学生暴露内部异常、SQL 或供应商信息。

## 5. Today Plan 决策

运行器依次执行：

1. 读取学习档案；
2. 读取当前成绩目标；
3. 读取同一版本的 Target Gap；
4. 读取 Learning Prescription；
5. 对需要题目的任务检查已发布合格题库存；
6. 持久化结构化方案卡和现有页面深链。

关键降级规则：

- 未设置目标：提示去设置目标，不输出 Artifact；
- Gap 或 Prescription 为 `updating`：拒绝输出过期方案；
- 处方无任务：Run 失败并记录稳定错误；
- 题源不足：Artifact 保留可信建议，但 `route = null`、`canStart = false`；
- 非 today-plan 问题：给出当前能力范围，不假装已完成任务。

练习深链复用现有站点路由：

- 诊断、复习、针对性练习、知识讲解：`/csca-subjects/:subject/practice`
- 模考：`/csca-mock-exam?subject=:subject`

## 6. Artifact 与事件

`learning_plan` Artifact 保存：Prescription ID、Goal ID、决策版本向量、理由代码、置信度、预计时间、首选任务、题源快照、是否可开始、深链和有效期。它不复制完整用户档案，也不允许自然语言反向覆盖结构化字段。

当前 SSE 持久化里程碑包括：

- `run.started`
- `plan.created`
- `tool.started`
- `tool.completed` / `tool.failed`
- `artifact.created`
- `run.completed` / `run.failed`

每个 Run 的 `sequence` 单调递增，`eventKey` 防止恢复时重复。最终消息和 Artifact 必须先提交，之后才能写入 `run.completed`，因此客户端看到完成事件时可以立即查询最终状态。

## 7. Feature Flag

唯一入口开关：

```text
AGENT_WEB_ENABLED=true
```

默认缺省为关闭。关闭时不接受新会话/消息，不启动恢复扫描；现有登录、训练、错题、模考、真题和自动出题流程不受影响。上线时还必须同时按既有依赖顺序打开 Learning Intelligence Foundation、Shadow Projection、Target Gap 和 Prescription。

## 8. 验证

```bash
cd backend
npm run test:agent-runtime
```

测试覆盖：

- today-plan 路由和默认关闭；
- 确定性只读工具顺序；
- 结构化 Artifact 与 Agent 原生练习工作区；旧练习深链仅作迁移回退；
- Artifact/消息先于完成事件落库；
- 决策正在更新时不输出过期 Artifact；
- 重复消息返回原 Run，且查询约束当前用户；
- 自动出题等非 allowlist 工具被拒绝。

## 9. 后续边界

本次是 PR5 的 Runtime 后端部分，不宣称完整 Agent 产品已完成。下一阶段依次完成：

1. Web Agent 会话 UI、方案卡、SSE 重连和响应式细节；
2. 练习创建写能力、L1 幂等与用户确认策略；
3. 练习完成后的 Evidence -> Projection -> 新 Prescription 回流；
4. 重复错误触发知识讲解与验证题；
5. Composer 附件上传、OCR/文档解析和异步 Worker；
6. API 大模型接入、供应商降级、token/费用治理和评测；
7. Redis/队列、多实例 worker、取消、超时、heartbeat 和运营观测。
