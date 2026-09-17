# PR12A：统一学习辅助面板与跨端契约

状态：已实现并通过本地真实 API 黄金路径（2026-09-14）

> [!NOTE]
> 本文的服务端策略、跨端契约与答案泄露边界继续有效。Web Agent 的后续主交互不再以题目内大型辅助面板为中心，而由上下文 Composer 发起、在持续对话中反馈，并在任务面板执行手写检查或教学资产；见 [80-AGENT-LEARNING-JOURNEY-AND-CONVERSATIONAL-TEACHING-ADR.md](./80-AGENT-LEARNING-JOURNEY-AND-CONVERSATIONAL-TEACHING-ADR.md)。

## 1. 目标

把 PR11G 的 A1/A2/A6 从三个散落动作收敛成同一个“学习辅助”入口，并让网页 Agent、未来 Codex 插件和其他受信客户端遵循相同的服务端策略。客户端只负责展示和发起请求，不能自行判断何时可以看答案、直接访问题库或绕过额度与曝光记录。

本阶段不创建正式 `TeachingAsset`，也不实时生成可执行动画。概念卡与交互 Micro Lesson 属于 PR12B。

## 2. 服务端是唯一策略源

客户端先读取：

```http
GET /api/v1/agent/practice-rounds/:roundId/questions/:questionId/assistance
```

响应 v1 固定包含：

- `roundId/questionId`：服务端校验过的上下文；
- `policyVersion/contextVersion`：策略与题目状态版本；
- `availableActions[]`：每项动作的层级、是否开放、禁用原因、是否由 AI 生成、是否需确认；
- `recommendedAction/maxAllowedLevel`：当前推荐与最大可曝光层级；
- `exposures`：本题已经发生的提示和解析曝光；
- `history[]`：本题已完成辅助的恢复记录；
- `billing`：额度是否启用、是否不限量、当前余额及 AI 动作可能消耗额度的语义。

网页刷新、切换题目或请求成功后都重新读取 GET。历史记录只恢复已完成结果，不重新调用模型，也不重复扣费。

## 3. 受控动作

```http
POST /api/v1/agent/practice-rounds/:roundId/questions/:questionId/assistance
```

请求使用 `clientRequestId` 幂等，并携带 `action`：

| 动作 | 层级 | 生成方式 | 开放条件 |
| --- | --- | --- | --- |
| `recall_concept` | A1 | 规则/已知知识点 | 未提交、非独立验证 |
| `next_step_hint` | A2 | AI Coach，可降级 | 未作答、未提交、非独立验证 |
| `show_full_solution` | A6 | 已审核标准解析 | 服务端已记录答案、非独立验证 |

相同用户、工具版本与 `clientRequestId` 的重放返回原结果；若把同一 id 用到另一题、另一动作或另一上下文，则返回冲突。所有成功曝光继续写入训练事件和题目曝光字段，供 Evidence/Projection 降权。

## 4. 内容问题反馈

```http
POST /api/v1/agent/practice-rounds/:roundId/questions/:questionId/assistance/report
```

支持 `incorrect / unclear / answer_leak / rendering / other`。反馈绑定用户、Agent 方案、轮次和题目，使用 `clientRequestId` 幂等，写入 `AgentToolCall` 与 `CscaTrainingEvent(eventType=learning_content_issue_reported)`。前端当前提供一键“内容有问题”，默认原因是 `unclear`；后续后台审核台可继续消费同一事件，不需要改客户端契约。

## 5. 网页交互

- 未作答时显示一个统一面板，不再把 A1/A2 做成互不相关的按钮；
- 明确展示系统推荐、可用动作和“完整解析在作答后开放”；
- 区分免费规则内容与可能消耗额度的 AI 生成；
- 刷新后恢复知识点提醒和最近一次提示；
- 历史提示不伪装成新的 AI 交互，因此不会对不存在的 interaction id 提交评分；
- Agent 服务不可用时不阻塞普通选择、保存和提交答题流程。

## 6. 插件与其他客户端

插件只能：

1. 读取 GET 返回的可用动作和原因；
2. 在用户已选择的有效上下文中请求 POST；
3. 展示返回内容与费用提示；
4. 通过 report 端点提交问题反馈。

插件不得直连数据库、Provider 或自动出题内部服务，不得缓存并覆盖 `availableActions`，不得在 A6 被禁用时自行拼接答案。未来若开放插件写能力，仍复用本契约与服务端身份验证。

## 7. 验收门

- Backend Nest build 与 Frontend production build 通过；
- 真实 API 黄金路径覆盖 A1、A2、A6；
- GET 能恢复 A1/A2 历史；
- GET 明确返回 `billing` 字段；
- 内容反馈重放返回同一 `reportId`；
- 提示与解析 Exposure 持久化；
- 练习提交、结算与 Agent 再规划仍完成；
- 独立验证、跨用户访问、未作答 A6 与已作答 A2 仍由服务端拒绝。

## 8. 下一阶段

PR12B 创建版本化 `TeachingAsset` 目录与 Resolver，先以数学单知识点实现一个受审核的交互 Micro Lesson，绑定 active prompt、独立验证题和效果回流。

本地验证结果：连续两次通过，最近一次 roundId `73`，6 题；A1/A2 历史恢复 `2` 条；内容反馈幂等重放返回同一 `reportId`；未作答 A6 与已作答 A2 均被服务端拒绝；A1 → A2 → A6、提交、结算和 Agent 再规划全部通过。运行 ID 仅属于本地演示数据库。
