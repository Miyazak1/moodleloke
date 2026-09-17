# Agent 真题连续作答编排实现说明

状态：已实现首个可运行纵切（2026-09-15）

依赖：

- `71-AGENT-PAST-PAPER-CITATION-IMPLEMENTATION.md`
- `72-AGENT-PAST-PAPER-TUTORING-IMPLEMENTATION.md`
- `73-AGENT-NATIVE-PAST-PAPER-ATTEMPT-IMPLEMENTATION.md`

## 1. 决策

连续作答不新增第二套“真题 Session”表。当前 Agent 对话就是学习过程的会话边界，`AgentPastPaperAttempt` 是每道题的持久状态；服务端根据“用户 + 对话 + 真题”实时聚合整卷进度。

这样避免 Session 与 Attempt 出现双重状态、双重完成判定和恢复冲突，也符合“一切在 Agent 内完成”的产品方向。

## 2. 连续作答状态

聚合状态为：

- `not_started`：没有可作答题目的 Attempt；
- `in_progress`：至少开始一道题，但尚未完成全部可作答题；
- `completed`：当前可信索引中所有可作答题均已提交。

服务端返回可作答题数、已开始/已提交数、正确/错误数、使用辅助数、进入学习证据数、累计服务端计时、完成率和下一道题。

统计口径只包含当前真题索引中具有可信答案的题。无答案题仍可定位到 PDF 阅读，但不会计入完成率，也不会启动 Attempt 或开放分层讲解。

## 3. 下一题与恢复规则

`nextQuestionId` 完全由服务端确定：

1. 若存在未提交的进行中 Attempt，优先恢复它；
2. 否则按可信题目索引顺序选择第一道未提交题；
3. 全部提交后返回 `null`。

进入工作区时，显式指定的题目优先；没有显式题目时恢复服务端返回的下一题。页面刷新、退出后重新进入或在设备间继续，都读取同一组持久 Attempt，不依赖浏览器本地状态。

## 4. API

读取连续作答进度：

`GET /api/v1/agent/past-papers/:slug/progress?conversationId=:conversationId`

响应核心字段：

```json
{
  "schemaVersion": "1",
  "policyVersion": "past-paper-answer-v1",
  "status": "in_progress",
  "answerableQuestions": 48,
  "submittedCount": 12,
  "correctCount": 9,
  "incorrectCount": 3,
  "assistedCount": 2,
  "evidenceCount": 10,
  "timeSpentSeconds": 1380,
  "completionRate": 0.25,
  "nextQuestionId": 7103,
  "items": []
}
```

接口先校验对话归属和真题发布状态，不允许用其他用户的对话查询进度。

## 5. UI 行为

- 左侧增加整卷进度卡，显示提交数、正确数、待巩固数和累计时间；
- 题目索引区分进行中、正确、错误、当前选中和不可作答状态；
- 提交后出现“继续下一题”，由服务端建议下一题；
- 全部完成后显示完成摘要，并明确结果已保存、可供 Agent 安排后续巩固；
- 无可信答案的题目仅允许阅读，不让模型猜答案或伪造讲解。

## 6. 一致性边界

- Attempt 的首次提交冻结、判分、证据门控仍由 `73` 文档定义；
- 连续进度是可重建的读模型，不反向修改 Attempt；
- 自动出题系统未被调用，真题连续作答与出题生产保持隔离；
- 旧科目训练页和模拟题页不是此流程的跳转目标。

## 7. 验证

- 后端 Nest 编译通过；
- 真题 Attempt 与分层辅助专项测试通过；
- 前端生产构建通过；
- Playwright 覆盖进入 Agent 真题工作区、使用辅助、提交、进度更新和下一题入口。

## 8. 下一纵切

下一阶段应把“整卷完成”接入 Agent 的学习决策循环：根据独立证据、错误知识点、辅助暴露和目标差距，在 Agent 内生成复盘摘要，并决定继续真题、安排针对性题组或插入知识点教学。首期只消费现有推荐/教学能力，不直接触发尚未冻结的自动出题生产链路。
