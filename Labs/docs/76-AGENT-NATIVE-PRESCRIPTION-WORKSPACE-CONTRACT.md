# Agent 原生 Prescription 工作区契约

状态：已实现第一阶段收口（2026-09-15）

依赖：

- `24-WEB-AGENT-RUNTIME-TODAY-PLAN-IMPLEMENTATION.md`
- `57-AGENT-ASSISTANCE-PANEL-AND-CROSS-CLIENT-CONTRACT.md`
- `70-AGENT-NATIVE-LEARNING-WORKSPACE-ADR.md`
- `75-AGENT-PAST-PAPER-REVIEW-AND-NEXT-DECISION.md`

## 1. 问题

此前网页已经能把 Adaptive Round 嵌入 Agent，但服务端 Artifact 和启动结果仍把 `/csca-subjects/:subject/practice` 当作主 `route`。这会让网页、Codex 插件和未来客户端误以为旧科目训练页是 Agent 任务的正式执行界面，并形成两套产品入口。

## 2. 决策

由 Prescription 生成的 `diagnostic`、`review`、`targeted_practice` 和 `concept_learning` 统一以 Agent 原生工作区作为主入口。

- 方案 Artifact 在可启动时返回 `route=/agent`；
- 启动成功后返回带 Conversation、Artifact、Round、任务类型与科目的 Agent 深链；
- 前端不读取旧 route 决定跳转，而是用结构化 `workspace` 描述打开原生工作区；
- 旧科目 Round 地址仅保留在 `legacyRoute`，用于过渡期兼容和故障排查，不得作为新客户端主入口。

在线模考与阶段验证暂时维持各自受控流程；阶段验证已经能嵌入 Agent，在线模考的完全原生化另行实施。

## 3. 启动响应

`POST /api/v1/agent/artifacts/:artifactId/start-practice`

新增或冻结字段：

```json
{
  "route": "/agent?conversation=...&agentRoundId=81&agentView=practice",
  "legacyRoute": "/csca-subjects/math/practice/rounds/81?...",
  "taskType": "targeted_practice",
  "workspace": {
    "kind": "adaptive_round",
    "phase": "practice",
    "taskType": "targeted_practice",
    "subject": "math",
    "reasonCodes": [],
    "objective": "targeted_practice:math:10"
  }
}
```

`workspace` 是跨网页和插件的结构化执行描述；客户端不得通过解析 `legacyRoute` 推断任务语义。

## 4. 原生工作区能力

四类 Prescription 任务复用同一个受治理的 Round 核心，同时保留任务语义：

| 任务类型 | 工作区行为 |
| --- | --- |
| `diagnostic` | 独立作答，形成初始知识点证据 |
| `review` | 绑定当前真实错题模式，完成订正验证 |
| `targeted_practice` | 根据 Gap 指定知识点和难度题组 |
| `concept_learning` | 绑定概念缺口；题中可调用分层辅助，错误后可插入已发布教学案例 |

工作区继续提供自动保存、暂停恢复、逐题判定、分层辅助、手写过程上传分析、教学案例、整组提交、报告和返回 Agent 更新方案。

## 5. 界面上下文

Agent 原生工作区 URL 保存：

- `agentConversationId`
- `agentArtifactId`
- `agentRoundId`
- `agentView`
- `agentTaskType`
- `agentSubject`

因此刷新不会丢失执行上下文。顶部显示任务类型、科目和方案摘要，让学生知道“为什么做这组”，而不是看到一个脱离推荐依据的通用练习页。

## 6. 安全与一致性

- 启动前继续验证 Artifact 归属、当前 Prescription、有效期、题源和错题状态；
- 服务端生成任务类型和原生深链，不信任客户端自行声明；
- 任务结算仍写 `LearningPrescriptionOutcome`，并在返回 Agent 后重新计算下一决策；
- 自动出题生产不在启动链路内，题源不足时仍失败关闭；
- `legacyRoute` 不改变所有权、判分、证据或结算逻辑。

## 7. 验证

- Today-plan 与 Practice Action 专项测试覆盖原生 route、结构化 workspace、旧路由兼容和 `concept_learning`；
- 前端生产构建通过；
- Playwright 覆盖从推荐卡启动并停留在 `/agent`、展示任务类型与推荐摘要。

## 8. 下一阶段

下一阶段应原生化在线模考：在 Agent 内完成选卷、考试计时、答题、交卷和报告，并把模考结果接入同一复盘与 Prescription 更新闭环。旧模拟题页面保留为过渡入口，但不再作为 Agent 主流程。
