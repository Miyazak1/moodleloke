# Agent 原生在线模考工作区契约

状态：第一阶段已实现（2026-09-15）

依赖：

- `20-AGENT-CAPABILITY-CATALOG.md`
- `23-LS-V1-GAP-PRESCRIPTION-IMPLEMENTATION.md`
- `70-AGENT-NATIVE-LEARNING-WORKSPACE-ADR.md`
- `76-AGENT-NATIVE-PRESCRIPTION-WORKSPACE-CONTRACT.md`

## 1. 决策

Prescription 推荐的 `mock_exam` 不再把独立模考页作为 Agent 主入口。Agent 负责选卷或恢复、打开考试工作区、接收交卷后的报告，并在服务端确认提交事实后结算学习任务。

现有模考引擎继续负责题目快照、倒计时、自动保存、标记复查、评分、知识点映射、学习证据和错题记录。Agent 只增加编排层，不复制判分规则或考试状态。

## 2. 启动流程

`POST /api/v1/agent/artifacts/:artifactId/start-mock-exam`

当 Artifact 的任务类型为 `mock_exam` 时：

1. 校验 Artifact 归属、状态和当前 Prescription；
2. 调用现有模考推荐器；
3. 有未提交 Attempt 时恢复原进度，否则按推荐创建 Attempt；
4. 写入一次 `accepted` Prescription outcome；
5. 返回 Agent 原生深链和结构化工作区描述。

```json
{
  "toolName": "start_mock_exam",
  "taskType": "mock_exam",
  "attemptId": 901,
  "paperSlug": "math-mock-1",
  "mode": "initial_diagnostic",
  "route": "/agent?...&agentMockExamAttemptId=901&agentView=mock-exam",
  "legacyRoute": "/csca-mock-exam/attempts/901",
  "workspace": {
    "kind": "mock_exam",
    "phase": "taking",
    "subject": "math"
  }
}
```

`legacyRoute` 仅用于过渡排障；网页和插件应读取 `workspace`，不得解析旧 URL 推断语义。

## 3. 原生界面状态

Agent URL 保存：

- `agentConversationId`
- `agentArtifactId`
- `agentMockExamAttemptId`
- `agentView=mock-exam|mock-report`
- `agentTaskType=mock_exam`
- `agentSubject`

刷新后可直接恢复同一 Attempt。考试工作区不显示主站导航；退出只返回 Agent 对话，不跳转到旧模拟题页面。考试中保持严格专注模式，不提供提示、讲解或答案辅助。

## 4. 交卷与结算

模考引擎先执行正式提交和评分。进入报告时，前端调用：

`POST /api/v1/agent/mock-exam-attempts/:attemptId/settle`

服务端必须验证：

- Attempt 属于当前用户；
- Attempt 来自该用户接受的 Agent Prescription；
- `submittedAt` 已存在。

验证后才把 Artifact 和 Prescription outcome 标记为 `completed`，并记录分数、正确数、错误数、未答数与试卷信息。接口按 Attempt 幂等，刷新报告不会重复结算。

## 5. 安全边界

- 客户端不能指定任意试卷或 Attempt 冒充推荐任务；
- 服务端推荐器优先恢复未交卷 Attempt，避免创建重复考试；
- 判分和证据写入仍由模考领域服务完成；
- 未交卷不能结算；
- 无已发布可用试卷时失败关闭，不临时生成未经审核的题目；
- 旧公开模考页面继续存在，但不属于 Agent 主流程。

## 6. 当前覆盖

- 新建推荐模考与重复请求幂等；
- 原 Attempt 恢复语义；
- Agent 深链与刷新恢复；
- 计时作答和自动保存原生嵌入；
- 提交事实校验与幂等结算；
- 报告在 Agent 内展示；
- 后端契约测试、前端生产构建和 Playwright 原生启动路径。

## 7. 后续工作

下一阶段应把模考报告转为 Agent 的结构化复盘输入：展示本次新增证据、目标分差变化、优先薄弱知识点，以及由实时决策服务生成的下一项任务。报告本身不应硬编码“每天练什么”。
