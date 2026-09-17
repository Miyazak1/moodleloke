# Agent 模考学习复盘契约

状态：已实现（本地 MVP）
适用范围：Agent 原生在线模考工作区

## 1. 目标

学生交卷后不能只看到一张静态成绩单。系统应把本次作答作为可信学习证据，更新知识状态，并基于学生当前目标重新计算下一项学习任务。

本契约只展示可追溯事实和确定性学习决策，不把模型推测包装成“真实能力分”或“预测成绩”。

## 2. 数据链路

1. 在线模考服务评分并冻结提交结果。
2. 已映射到正式大纲知识点的题目写入 `LearningEvidenceEvent`，来源为 `mock_exam`，`sourceId` 为模考 attempt ID。
3. Agent 结算接口验证 attempt 所有权、Prescription 接受记录和提交状态。
4. 学习状态投影器消费待处理证据。
5. `LearningDecisionService` 使用最新目标、学习状态、错题、模考和可用时间重新计算 Target Gap 与 Prescription。
6. Agent 报告页同时展示本次卷面事实、知识点聚合、目标差距摘要和系统判定的下一项任务。

## 3. 接口

`POST /api/v1/agent/mock-exam-attempts/:attemptId/settle`

结算结果新增 `learningReview`：

- `status`：`ready`、`goal_unset`、`updating` 或 `unavailable`；
- `evidence`：本 attempt 实际接受的、未撤销的可信证据数量；
- `result`：本次已提交模考的卷面分数和答题统计；
- `focusTopics`：由报告中的真实知识点标签和正误统计聚合；
- `targetGap`：当前目标差距快照摘要及本学科高优先差距；
- `nextDecision`：当前 Prescription 的原因、置信度、预计时长和最高优先级任务；
- `provenance`：明确卷面结果与下一步分别来自哪里，并声明结算不会直接触发自动出题。

## 4. 失败与降级

- 模考未提交：拒绝结算，不生成复盘。
- 证据仍在投影：返回 `updating`，保留可信卷面结果，不虚构下一步。
- 未设置目标：返回 `goal_unset`，保留证据与知识点复盘，不伪造目标差距。
- 报告聚合暂不可用：卷面结果仍有效，知识点列表可为空。
- 决策服务暂不可用：模考任务仍可完成，`nextDecision` 为空并明确状态。

## 5. UI 约束

- Agent 模式不显示“返回套卷列表”“继续练其它科目”等旧站点导航。
- Agent 模式不显示模考页内硬编码的“专属备考方案”；下一步只能来自实时 Prescription。
- 页面必须明确提示：卷面分数是本次提交结果，不是能力分预测。
- 逐题解析仍由原报告组件提供，学习复盘卡位于报告顶部。

## 6. 后续边界

本阶段只发布下一步决策，不自动创建新的 Artifact，也不调用自动出题系统。下一阶段应由 Agent 将最新 Prescription 物化成新的可执行学习卡片，使学生能从报告无缝继续下一项原生任务。
