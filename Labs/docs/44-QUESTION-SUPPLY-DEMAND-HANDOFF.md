# PR10A：可信题源缺口与异步补库交接

## 1. 目标

当 Learning Decision 已经选出学生最需要完成的任务，但现有审核题库不足时，学生请求不能同步调用仍在演进的自动出题系统，也不能伪造一个可执行入口。PR10A 把这个断点改造成受控的异步交接：

```text
Agent 今日方案 / 教学干预验证
            ↓ 只读检查可信库存
       库存不足，安全降级
            ↓ best-effort
QuestionSupplyRequest（聚合需求）
            ↓ 稳定 Shadow 交接
内容生产 / 审核 / 发布（独立系统，尚未真实连接）
            ↓
管理员确认已补齐并关闭需求
```

该链路不生成题、不扣 AI 额度、不把候选题发布到公共题库，也不阻断学生获得降级后的学习方案。

## 2. 缺口来源

首版只接受两个由后端产生的可信来源：

1. `agent_today_plan`：系统推荐的诊断、复习、专项练习或有错题绑定的知识学习任务无法满足题量；
2. `intervention_verification`：讲解后的 `immediate`、`retention` 或 `transfer` 独立验证缺少已审核、未曝光且满足结构约束的题。

客户端和模型不能直接提交补库需求，也不能提供 `userId`。需求只保存库存维度与最后一次领域实体引用，不保存学生身份。

## 3. 去重与状态

`requestKey` 对以下规范化维度做 SHA-256：

- 来源、学科、排序去重后的知识点；
- 难度、任务类型、验证阶段；
- 固定的 `reviewed_published_only` 题源政策；
- 迁移验证等结构约束。

相同缺口重复出现时只更新 `observationCount`、最近题量和最近上下文，不制造大量重复工单。已 `resolved` 或 `dismissed` 的需求再次出现时自动回到 `open`，并追加 `reopened_by_observation` 审计事件。

```text
open -> acknowledged -> resolved
  |          |
  +----------+-> dismissed

resolved / dismissed -> open
```

管理员状态操作使用当前状态 CAS，避免两个操作者覆盖彼此。`QuestionSupplyRequestEvent` 由数据库触发器保护为只追加审计记录。

## 4. 接口

接口只对管理员开放：

- `GET /api/v1/admin/question-supply-requests`
  - 可按 `status`、`subjectCode` 筛选；
  - `limit` 为 1–200；
  - 返回需求及最近十条状态事件。
- `POST /api/v1/admin/question-supply-requests/:id/actions`
  - `action`: `acknowledge | resolve | dismiss | reopen`；
  - `reason`: 必填的操作说明；
  - 操作人来自登录态，不接受客户端传入用户 ID。

当前没有“开始生成”接口。内容生产系统仍通过自己的 Blueprint、Validator、Reviewer、质量门和发布治理工作；后续只允许增加面向内容侧的稳定消费适配器。

## 5. 隔离与失败语义

- 记录开关：`CSCA_QUESTION_SUPPLY_REQUEST_ENABLED`，默认关闭，本地一键启动开启；
- 所有学生链路使用 `recordBestEffort`，需求表不可用或迁移尚未执行时只记录服务端告警，不让 Agent Run 或干预验证失败；
- 每个上下文快照固定写入 `automaticQuestionGenerationInvoked=false` 与 `aiInvoked=false`；
- Agent、LLM 和插件均不能读取管理队列或变更状态；
- 需求关闭不代表题已合格，真正创建练习时仍必须重新检查当前审核库存、曝光和测量约束。

## 6. 迁移与验证

- 迁移：`0089_question_supply_requests`；
- 专项命令：`npm --prefix backend run test:question-supply-request`；
- Agent Runtime 回归验证普通库存不足会创建一次需求且仍返回不可执行 Artifact；
- Intervention Verification 回归验证即时验证缺题会创建高优先级需求；
- 测试覆盖关闭开关、输入门禁、去重聚合、管理员状态机、自动重开以及 AI/生成器未调用标记。

## 7. 后续实现

PR10B 已增加内容生产侧稳定契约、Shadow No-op 适配器和“审核库存确已恢复”的精确对账。它只能读取聚合需求并创建内部计划，仍不能让 Agent 控制 Prompt、模型、审核或发布。设计、状态机和真实适配器门槛见 [45-QUESTION-SUPPLY-FULFILLMENT-SHADOW.md](./45-QUESTION-SUPPLY-FULFILLMENT-SHADOW.md)。学生端仍只看到清晰的题源不足降级说明。
