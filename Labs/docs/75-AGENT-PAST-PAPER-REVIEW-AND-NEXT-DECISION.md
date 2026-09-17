# Agent 真题复盘与下一学习决策实现说明

状态：已实现首个可运行纵切（2026-09-15）

依赖：

- `23-LS-V1-GAP-PRESCRIPTION-IMPLEMENTATION.md`
- `55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md`
- `59-TEACHING-ASSET-PROACTIVE-INTERVENTION-CLOSED-LOOP.md`
- `74-AGENT-PAST-PAPER-CONTINUOUS-SESSION-IMPLEMENTATION.md`

## 1. 目标

学生完成一套真题后，不停留在“多少分、对几题”的结果页。系统应把可信作答结果送入既有学习证据与决策循环，在 Agent 内说明需要巩固的知识点，并提供一个由当前 Prescription 决定的下一学习动作。

## 2. 决策边界

本阶段没有新增推荐算法，也没有调用自动出题系统：

- 整卷统计来自持久化 `AgentPastPaperAttempt`；
- 薄弱方向只由错误题或使用过辅助的题目及其已审核知识点映射组成；
- 下一任务来自现有 `LearningDecisionService.getLearningPrescription`；
- 大模型只在用户回到对话后负责把已有理由表达得更自然，不能改写任务类型、科目、知识点或数量；
- 题源不足时仍由既有 Supply Gate 阻止练习创建。

## 3. 完成门槛

只有连续作答状态为 `completed` 才能读取整卷复盘。未完成时接口返回 `PAST_PAPER_NOT_COMPLETED`，避免学生在过程中反复查看聚合结果而干扰独立作答。

提交阶段已经触发学习证据投影；复盘前再进行一次有界的 pending 投影处理，然后读取最新 Prescription。投影尚未收敛时返回 `updating`，而不是展示旧方案。

## 4. API

`GET /api/v1/agent/past-papers/:slug/review?conversationId=:conversationId`

响应包含：

- `summary`：题数、正确/错误、正确率、独立作答数、辅助作答数、证据数和累计时间；
- `focusTopics`：由错误次数、辅助次数排序的最多 5 个知识点；
- `decision`：Prescription 状态、版本 ID、理由、置信度、预计时间和首选任务；
- `provenance`：结果与下一任务的事实来源，以及 `automaticQuestionGenerationInvoked=false`。

该接口校验用户、对话与真题归属，不能查询其他用户的复盘。

## 5. Agent UI 闭环

整卷完成后，真题工作区展示：

1. 整卷正确率；
2. 优先巩固知识点；
3. 最新 Prescription 的首选任务与预计时间；
4. “让 Agent 安排下一步”按钮。

按钮把带有真题页面上下文的明确“今天接下来学什么”请求送回原对话。Agent Runtime 随后走既有 `today_plan` 路由，重新读取目标、Gap、Prescription、题源和教学介入状态，再生成可执行方案 Artifact。

## 6. 降级行为

- 未设置目标：提示先补充目标分数和考试日期；
- 学习状态正在更新：明确提示稍后生成，不输出过期方案；
- 没有错误或辅助暴露：显示当前未识别出明确薄弱知识点；
- 复盘接口异常：真题结果仍保留，只在复盘区域显示局部错误，不破坏 PDF 与逐题记录。

## 7. 验证

- 后端专项测试覆盖未完成拒绝、完成统计、知识点与 Prescription 来源；
- 前端生产构建通过；
- Playwright 覆盖两题连续作答、整卷完成、复盘呈现和带事实上下文返回 Agent 对话。

## 8. 后续

下一阶段应让 Agent 的首选任务真正留在 Agent 原生工作区：针对 `review`、`targeted_practice` 和 `concept_learning`，统一展示任务缘由、题组或教学案例、按需辅助与结算结果；旧科目训练页只保留兼容入口，不再作为 Agent 的主流程。
