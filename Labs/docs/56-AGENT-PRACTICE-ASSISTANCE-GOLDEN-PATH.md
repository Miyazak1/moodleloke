# PR11G：Agent 练习与学习辅助真实闭环

状态：已实现并通过本地真实 API 黄金路径（2026-09-14）

## 目标

链路为：Agent 根据目标和学习状态生成今日方案 → 学生启动规定题量的练习 → 按策略调用辅助 → 辅助暴露进入证据 → 提交并结算 → 投影最新状态 → Agent 生成下一步。

## 已落地能力

- `A1 recall_concept`：知识点回忆，不调用模型，不透露答案。
- `A2 next_step_hint`：下一步提示，复用 AI Coach，可降级为规则提示。
- `A6 show_full_solution`：作答后开放，返回审核过的标准解析，不临时生成答案。

统一接口：

- `GET /api/v1/agent/practice-rounds/:roundId/questions/:questionId/assistance`
- `POST /api/v1/agent/practice-rounds/:roundId/questions/:questionId/assistance`

POST 使用 `clientRequestId` 幂等，并验证轮次确实来自当前用户的 Agent 学习方案。

## 策略门禁

- 未作答：允许 A1、A2，禁止 A6。
- 已作答：允许 A6，禁止继续请求 A2。
- 已提交：保留 A6 复盘能力，禁止新的 A1、A2。
- 独立干预验证：全部实时辅助关闭，避免污染测量。
- A6 前必须先把答案写入服务端，不能只相信浏览器本地状态。

## 证据与审计

本阶段复用现有稳定数据结构：

- `CscaAdaptiveRoundItem.usedHint / usedExplanation`
- `LearningEvidenceEvent.exposureState`
- `CscaAIInteraction`
- `CscaTrainingEvent(eventType=learning_assistance_exposed)`
- `AgentToolCall(toolName=request_learning_assistance)`

掌握度引擎继续按既有规则对辅助作答降权。通用 `AssistanceExposure` 和正式 `TeachingAsset` 表留到 PR12。

## 同时修复的架构冲突

1. Agent 题源预检过去只统计 `published`，自适应练习实际消费 `approved` 审核题；现在预检接受两个有效治理状态。
2. Agent 方案规定 6 题，但诊断 session 固定创建 20 题；现在 Agent 把方案题量传给自适应轮次，并限制不超过诊断轮次上限。

## 本地黄金路径

启动 `start-cscalite-dev.bat` 后执行：

```powershell
node scripts/agent-demo-seed.cjs --apply
node scripts/agent-practice-assistance-live.cjs
```

脚本真实执行登录、今日方案、6 题练习、A1、A2、答案保存、A6、提交、结算以及 Agent 再规划，并断言暴露已经持久化。

2026-09-14 本地结果：`pass`；roundId `70`；6 题；`A1 → A2 → A6`；`usedHint=true`；`usedExplanation=true`；结算 `completed`；后续方案已生成。运行 ID 只属于本地演示数据库。

## 下一阶段

- PR12A：统一辅助面板与跨端契约，包括恢复、计费语义和内容问题反馈。
- PR12B：正式 `TeachingAsset` 目录、版本和知识点绑定，先支持概念卡与交互动画。
- PR12C 以后：扩展到完整 A0–A7，并建立主动干预、通用暴露事件和效果评估。
