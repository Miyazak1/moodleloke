# Agent 真题分层引导式讲题实现说明

状态：已实现首个可运行纵切（2026-09-15）
依赖：`71-AGENT-PAST-PAPER-CITATION-IMPLEMENTATION.md`、`55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md`

## 1. 本阶段目标

学生在 Agent 内阅读已发布真题时，不再跳转到旧科目训练页。题目选择、原卷阅读、逐级求助、步骤检查和完整解析都在同一个真题工作区完成。

本阶段只处理已经绑定可信 `CscaSourceDocument`、允许展示且能定位到具体 `CscaSourceQuestion` 的题目。Agent 不从 PDF 视觉位置猜题，也不把模型生成内容当作真题事实。

## 2. 辅助阶梯

| 等级 | 动作 | 行为 | 答案暴露 |
| --- | --- | --- | --- |
| A0 | `clarify_question` | 拆分已知条件和目标 | 禁止 |
| A1 | `recall_concept` | 提醒知识点、定义和适用条件 | 禁止 |
| A2 | `next_step_hint` | 只给一个下一步 | 禁止 |
| A3 | `check_step` | 检查学生提交的当前思路 | 禁止主动给最终答案 |
| A6 | `show_full_solution` | 展示可信答案和解析 | 明确二次确认后允许 |

A0、A2、A3 可以调用 AI Gateway；网关不可用时返回保守的规则降级内容。A1 使用可信题目标记生成确定性概念提醒。A6 只复用可信源题已保存的答案和解析，不让模型改写或补造答案。

## 3. 事实、权限与治理边界

- 每次请求重新验证：对话属于当前用户、真题已发布、可信源处于 active、展示政策允许、题目属于所绑定源卷。
- A2 不向模型发送答案或解析；A0/A2 输出增加答案泄漏检测，命中后退回安全规则提示。
- A3 可以把可信解析作为内部判定参考，但系统提示禁止在步骤检查中主动暴露最终答案。
- A6 必须传入 `confirmed: true`；没有可信答案和解析时禁用。
- 所有请求使用 `AgentRun + AgentToolCall`，以用户和 `clientRequestId` 保证幂等。
- 输出记录动作、A0–A6 等级、时间与真题引用，并明确 `masteryChanged: false`。
- 辅助曝光不是独立作答证据，不直接更新知识点掌握度或学习处方。

## 4. API 契约

读取可用动作和当前对话内历史：

`GET /api/v1/agent/past-papers/:slug/questions/:questionId/assistance?conversationId=...`

执行动作：

`POST /api/v1/agent/past-papers/:slug/questions/:questionId/assistance`

请求正文：

```json
{
  "clientRequestId": "uuid",
  "conversationId": "conversation-id",
  "action": "check_step",
  "studentWork": "我先把……代入……",
  "confirmed": false,
  "language": "zh"
}
```

响应包含 `action`、`level`、`content`、`generatedByAI`、`citation` 与 `exposure`。读取接口按对话和题目恢复已完成的历史，因此刷新页面不会丢失已看过的帮助。

## 5. 前端交互

真题工作区采用三段结构：

1. 左侧：文件和可信题目索引；
2. 中间：原卷 PDF，并随所选题目定位页码；
3. 右侧：A0/A1/A2 快捷动作、学生步骤输入、A3 检查、辅助历史和 A6 二次确认。

移动或窄屏时，讲题面板下移到 PDF 后方，避免压缩阅读器到不可用宽度。

## 6. 与原生作答的衔接

- 原生真题作答与证据门控已经在 `73-AGENT-NATIVE-PAST-PAPER-ATTEMPT-IMPLEMENTATION.md` 落地。
- A3 的模型输出仍需加入更强的结构化判定和质量评测集；当前已有提示约束与安全降级。
- 完整解析在提交前锁定；提交后的独立结果只有通过可信源题、知识点和功能开关门控才能进入证据管线。
- 后续可把教学资产推荐接到 A3/A6 之后，但教学资产观看本身仍不得直接改变掌握度。

## 7. 验证

- 后端生产构建；
- 前端生产构建；
- `agent-past-paper-assistance-test.cjs` 覆盖动作阶梯、安全降级、完整解析和答案泄漏检测；
- 浏览器纵切应覆盖：选题、A0/A1/A2、填写步骤并 A3、A6 二次确认、刷新恢复历史。
