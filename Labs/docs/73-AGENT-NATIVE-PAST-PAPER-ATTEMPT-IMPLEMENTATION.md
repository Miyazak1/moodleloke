# Agent 原生真题作答实现说明

状态：已实现首个可运行纵切（2026-09-15）

依赖：

- `71-AGENT-PAST-PAPER-CITATION-IMPLEMENTATION.md`
- `72-AGENT-PAST-PAPER-TUTORING-IMPLEMENTATION.md`
- 学习证据 v1 写入器与异步投影管线

## 1. 决策

真题不再只是下载资料。学生可以在 Agent 真题工作区内完成选题、阅读原卷、作答、提交、查看正误和按需获取分层讲解，不跳转到旧科目训练或模拟题页面。

本阶段采用“一道题、一个对话、一次冻结提交”的最小模型。切换题目会开始或恢复该题 Attempt；刷新不会重置计时或已提交答案。

## 2. Attempt 生命周期

`in_progress -> submitting -> submitted`

- `start` 由服务端创建开始时间，并以用户、对话、真题和源题唯一约束防止重复 Attempt；
- `submit` 对首次提交进行原子认领，答案提交后不可修改；
- 客户端请求 ID 在开始和提交阶段分别唯一，重试同一提交会返回原结果；
- 用服务端 `submittedAt - startedAt` 计算耗时，上限为 6 小时，不信任浏览器自行上报的秒数。

## 3. 判分范围

首期只对存在可信答案键的题目开放作答。选择题必须提交题目已有选项键；非选择题采用规范化后的严格答案键比较。系统不让大模型决定正误。

规范化仅处理 Unicode、大小写和常见分隔符，不做语义猜测。主观题、证明题、多步骤部分分暂不写掌握证据，后续需要独立评分 Rubric。

## 4. 证据门控

作答结果始终保存，但同时满足以下条件才写入 `LearningEvidenceEvent`：

1. 提交前没有使用任何 A0–A6 辅助；
2. 源题 `reviewStatus` 为 `approved` 或 `auto_approved`；
3. 源题已经绑定已发布的 CSCA 知识点；
4. 科目是 `math`、`physics` 或 `chemistry`；
5. 学习证据写入开关已开启。

不满足时 Attempt 使用 `evidenceStatus=not_eligible` 并保存明确原因，例如：

- `ASSISTANCE_USED`
- `SOURCE_QUESTION_NOT_REVIEWED`
- `TOPIC_NOT_MAPPED`
- `SUBJECT_UNSUPPORTED`
- `EVIDENCE_WRITE_DISABLED`

因此“答对”与“可用于掌握度推断”是两个不同结论。

## 5. 证据契约

新增证据来源 `past_paper`。合格提交通过现有 `LearningEvidenceWriter.appendInTransaction` 写入，并继续使用 outbox 和学习状态投影器，不直接修改掌握度表。

关键来源字段：

- `sourceId = agent:{conversationId}:{pastPaperId}`
- `questionId = source-question:{sourceQuestionId}`
- `answerKeyVersion` 由题目 prompt hash 与规范化答案哈希生成
- `topicMappingVersion` 引用源题 syllabus version
- `questionQualityConfidence` 仅在审核题范围内使用，并限制为 0.75–0.95

自动出题系统不会被真题作答调用；Attempt 元数据明确记录此隔离边界。

## 6. API

开始或恢复：

`POST /api/v1/agent/past-papers/:slug/questions/:questionId/attempts/start`

```json
{
  "clientRequestId": "uuid",
  "conversationId": "conversation-id"
}
```

冻结提交：

`POST /api/v1/agent/past-paper-attempts/:attemptId/submit`

```json
{
  "clientRequestId": "uuid",
  "selectedAnswer": "A"
}
```

响应返回 Attempt 状态、无答案泄漏的题目正文和选项、正误、计时、辅助使用情况、证据状态和真题引用。

## 7. UI 行为

- 分层讲题面板顶部新增原生作答卡；
- 选项直接在 Agent 内选择，提交后冻结；
- 提交前完整解析不可用；
- 提交后显示正误与证据状态，再开放 A6 完整解析的二次确认；
- 使用过辅助后仍可提交，但明确说明“不计入独立掌握证据”。

## 8. 后续

下一纵切应建设多题连续作答编排：题间导航、整卷/题组进度、暂停恢复、完成摘要，并把系统推荐的下一题与教学介入接到同一 Agent 工作流。主观题评分必须另行冻结 Rubric 与人工/模型复核方案，不能沿用当前严格答案键比较。
