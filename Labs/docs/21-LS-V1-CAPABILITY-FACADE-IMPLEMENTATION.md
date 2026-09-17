# LS-V1 Capability Facade 实施记录

> 状态：PR 2 implemented, feature disabled  
> 更新时间：2026-09-12  
> 依赖：[工具契约](./02-TOOL-CONTRACTS.md) · [首条垂直切片](./18-FIRST-VERTICAL-SLICE.md) · [能力目录](./20-AGENT-CAPABILITY-CATALOG.md)

## 1. 本次完成范围

后端已经建立 transport-neutral 的只读 Capability Facade。网页 Agent、未来 Remote MCP 和内部编排使用同一个 Registry、输入 Schema、输出 Schema、调用信封及错误码，不各自复制业务规则。

已实现的 v1.0 能力：

- `get_learning_profile`
- `get_score_goal`
- `get_study_availability`
- `get_subject_mastery`
- `get_review_queue`
- `list_mock_exam_attempts`
- `get_question_supply_status`

所有能力均为 `learning.read`、L0、AI 额度 0。Registry 仍受 `CSCA_AGENT_FOUNDATION_ENABLED` 总开关控制；默认关闭时不会执行数据库查询。

## 2. 稳定边界

```text
Web Agent Adapter ─┐
                   ├─ LearningCapabilityRegistryService
Remote MCP Adapter ┘     ├─ shared input/output Zod schemas
                         ├─ scope / channel / actor validation
                         ├─ stable success/failure envelope
                         └─ LearningReadCapabilityService
                                  └─ existing PostgreSQL domain data
```

Transport Adapter 不得直接调用 Prisma。后续 Web Tool Loop 和 MCP Server 只能注入可信 `ToolContext` 后调用 Registry；`actorUserId` 不进入模型可控的工具参数。

## 3. 数据来源与降级语义

| 能力 | 数据来源 | 无数据行为 |
| --- | --- | --- |
| 学习档案 | `StudentProfile` + active `StudyAvailabilityPreference` | 返回 nullable 字段与 `source: unset` |
| 分数目标 | active `StudentScoreGoal` + subjects | 返回 `status: unset`，不猜测目标 |
| 学习时间 | active `StudyAvailabilityPreference` | 返回显式 unset 结构 |
| 掌握度 | `UserCscaTopicMastery` + published syllabus topic | 无证据学科不返回虚构分数 |
| 复习队列 | 当前用户 active/improving `CscaWrongPattern` | 返回空数组 |
| 模考记录 | 当前用户 `MockExamAttempt` + paper | 返回空数组 |
| 题目供给 | published CSCA questions + published special-practice questions | 返回 sufficient / limited / empty；不触发生成 |

题目供给只统计发布内容；有质量指标且 `needsReview=true` 的 CSCA 题不进入可用库存。带知识点过滤时会先验证知识点属于指定学科且已发布。Facade 不读取草稿、审核队列、生成任务或内部 Prompt。

## 4. 权限与所有权

- Context 必须包含正整数 `actorUserId`、request/trace ID、受支持渠道和 `learning.read` scope；
- 输入 Schema 使用 strict object，拒绝模型夹带 `userId` 或未知字段；
- 档案、目标、时间偏好、掌握度、复习队列和模考均在 Prisma `where` 中直接绑定当前 `actorUserId`；
- 未知工具不进入动态调用或通用代理；
- 异常响应不包含 SQL、堆栈、内部文件路径或数据库错误详情。

## 5. 验证与启用条件

契约测试命令：

```bash
cd backend
npm run test:learning-capability-facade
```

测试覆盖七项能力、Registry allowlist、输入/输出契约、scope 拒绝、未知工具拒绝、总开关关闭，以及所有用户数据查询的数据库层 `actorUserId` 限制。

当前实现不新增 HTTP Controller、不新增 MCP Server、不接入 LLM、不写学习证据、不生成题目，也不改变现有页面。正式接入前仍需完成数据库迁移、PR 3 Evidence/Outbox、适配器级认证测试和灰度开关流程。

