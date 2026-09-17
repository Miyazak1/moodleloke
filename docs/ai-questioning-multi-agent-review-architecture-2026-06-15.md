# AI 出题多 Agent 审题架构实施方案

日期：2026-06-15  
适用范围：CSCA AI 题库生产、候选题审核、题目质量治理

## 1. 背景和结论

当前 AI 出题链路已经具备：

- 大纲导入与 `CscaExamTopic`。
- 出题蓝图 `CscaQuestionBlueprint`。
- 候选题生成 `CscaQuestion`。
- 程序化 validator。
- AI reviewer。
- 人工候选审核与发布。
- 质量回流、复审、归档、重生成。

但当前架构里，“生成”和“审题”虽然代码上已有服务分层，治理语义还不够清晰：

- 用户无法确认题目质量到底由谁判断。
- Reviewer 与 Generator 的边界不够产品化。
- 审题结果没有形成清晰的多 agent 证据链。
- 同一个 LLM 既生成又评价时，容易被误解为“自说自话”。
- 后续若接入不同模型仲裁，缺少统一 agent run / verdict 模型。

结论：需要把现有链路升级为 **多 Agent 题库生产流水线**。第一阶段仍可统一走当前配置的大模型，但必须拆出不同 agent 身份、独立上下文、独立 prompt、独立输出 schema 和独立日志。后续再支持跨模型 reviewer / arbiter。

## 2. 目标

### 2.1 产品目标

管理员在候选审核页应能看清：

- 这道题由哪个生成 agent 生成。
- 经过了哪些硬校验。
- 哪个 reviewer agent 审过。
- reviewer 给出的分数、问题、结论。
- 是否需要人工确认。
- 为什么不能发布，或者为什么可发布。

### 2.2 技术目标

将现有流程改为：

```text
已应用大纲
  -> 出题蓝图
  -> Generator Agent
  -> Deterministic Validator
  -> Reviewer Agent
  -> Gate Decision
  -> 人工审核 / 发布 / 重生成 / 归档
  -> 真实作答数据回流
```

### 2.3 非目标

第一阶段不要求：

- 必须使用不同模型。
- 完全自动发布。
- 100% 替代人工审题。
- 立即建立复杂 agent 编排平台。

第一阶段重点是让链路真实运转，并保留以后扩展空间。

## 3. Agent 角色定义

### 3.1 Generator Agent

职责：

- 根据大纲、蓝图、难度、题型生成候选题。
- 输出结构化 JSON。
- 不负责评价自己题目质量。

输入：

- subject
- syllabusScope
- blueprint
- designedDifficulty
- questionType
- excludedScope
- targetSkills
- language

输出：

- prompt
- options
- correctAnswer
- explanation
- knowledgeTags
- optionMetadata
- designedDifficulty
- generationMetadata

禁止：

- 不输出审题结论。
- 不输出“这道题很好”等质量判断。
- 不绕过大纲门禁。

### 3.2 Deterministic Validator

职责：

- 本地硬规则校验。
- 不调用 LLM。
- 给 Reviewer 提供硬错误和风险信号。

检查项：

- 是否有唯一正确答案。
- 正确答案是否存在于选项。
- 选项是否重复或等价。
- 题型是否符合蓝图。
- 设计难度是否在大纲允许范围。
- 是否命中 excludedScope。
- 题干、选项、解析是否有明显 prompt 泄漏。
- 数学、物理、化学可程序化规则。
- 与近期题目是否近似重复。

输出：

```json
{
  "status": "passed | warning | failed",
  "issues": [],
  "dimensions": []
}
```

### 3.3 Reviewer Agent

职责：

- 独立审题。
- 不看 Generator 的生成 prompt、重试历史、生成过程。
- 只看最终候选题、大纲、蓝图、硬校验结果和 rubric。

输入：

- syllabusScope
- blueprint
- candidateQuestion
- deterministicValidationResult
- rubric

输出：

```json
{
  "agent": "reviewer-v1",
  "decision": "approve | revise | regenerate | human_review",
  "score": 0,
  "rubric": {
    "syllabusAlignment": 0,
    "answerCorrectness": 0,
    "optionQuality": 0,
    "explanationQuality": 0,
    "difficultyMatch": 0,
    "languageQuality": 0
  },
  "issues": [
    {
      "code": "weak_explanation",
      "severity": "warning",
      "message": "解析能推出答案，但没有解释关键干扰项为什么错。"
    }
  ],
  "recommendedAction": "approve | edit | regenerate | manual_review"
}
```

### 3.4 Arbiter Agent

第一阶段可不默认启用，只在以下情况触发：

- Reviewer 与 Validator 冲突。
- Reviewer 给出 `human_review`。
- 题目即将批量发布但 score 低于阈值。
- 质量回流发现高风险题。
- 管理员点击“二次仲裁”。

职责：

- 汇总 generator output、validator result、reviewer result。
- 给最终建议。
- 不直接发布。

## 4. 同模型多 Agent 的边界

如果 Generator 和 Reviewer 都使用同一个 DeepSeek V4 或同一个 provider，仍然必须隔离：

- 不复用聊天上下文。
- 不传 Generator prompt。
- 不传 Generator 的 chain/reasoning。
- 不传“生成成功/失败历史”作为审题依据。
- Reviewer prompt 使用审题专用 rubric。
- Reviewer 输出必须 JSON schema 校验。

这解决的是“上下文污染”。

同源模型仍会存在“模型能力共享偏差”，例如同一知识盲区、同一难度判断偏差。因此后续要支持：

- 同模型 reviewer 多次抽检。
- 不同 provider reviewer。
- 人工抽检。
- 真实作答数据校准。

## 5. 当前代码落点

### 5.1 现有相关文件

- `backend/src/ai-questioning/question-generator-provider.service.ts`
- `backend/src/ai-questioning/question-generator.service.ts`
- `backend/src/ai-questioning/question-prompt-builder.service.ts`
- `backend/src/ai-questioning/question-validator.service.ts`
- `backend/src/ai-questioning/question-reviewer-provider.service.ts`
- `backend/src/ai-questioning/question-reviewer.service.ts`
- `backend/src/ai-questioning/ai-questioning.service.ts`
- `frontend/src/pages/AdminAIQuestionBankPage.tsx`
- `frontend/src/pages/AdminAuditPage.tsx`
- `backend/prisma/schema.prisma`

### 5.2 当前可复用能力

可直接复用：

- Generator provider。
- Reviewer provider。
- Validator service。
- `reviewMetadata`。
- `generationMetadata`。
- `csca_ai_generation_jobs`。
- 候选题状态：`pending_review`、`review_failed`、`approved`、`rejected`、`archived`。
- 后台候选审核页。

需要新增或强化：

- agent run 记录。
- reviewer 独立输入快照。
- rubric score。
- gate decision。
- 前端显示审题证据。

## 6. 数据结构方案

### 6.1 第一阶段最小可执行方案

不新增表，先扩展 JSON 字段：

`CscaQuestion.generationMetadata`：

```json
{
  "agent": {
    "role": "generator",
    "name": "question-generator-v1",
    "provider": "deepseek",
    "model": "deepseek-v4",
    "promptVersion": "generator-syllabus-v1"
  },
  "syllabusScope": {},
  "requestHash": "...",
  "fallbackUsed": false
}
```

`CscaQuestion.reviewMetadata`：

```json
{
  "validator": {
    "name": "deterministic-validator-v1",
    "status": "passed",
    "issues": [],
    "dimensions": []
  },
  "reviewer": {
    "role": "reviewer",
    "name": "question-reviewer-v1",
    "provider": "deepseek",
    "model": "deepseek-v4",
    "promptVersion": "reviewer-rubric-v1",
    "decision": "approve",
    "score": 86,
    "rubric": {
      "syllabusAlignment": 90,
      "answerCorrectness": 95,
      "optionQuality": 80,
      "explanationQuality": 82,
      "difficultyMatch": 85,
      "languageQuality": 84
    },
    "issues": []
  },
  "gate": {
    "decision": "publishable | needs_edit | regenerate | human_review",
    "reasons": [],
    "decidedAt": "2026-06-15T00:00:00.000Z"
  }
}
```

优点：

- 不需要立即迁移数据库。
- 能最快上线。
- 前端可直接展示。

缺点：

- 后续统计 agent 表现不如独立表方便。

### 6.2 第二阶段正式模型

新增表：`csca_ai_agent_runs`

字段建议：

```prisma
model CscaAiAgentRun {
  id            Int      @id @default(autoincrement())
  questionId    Int?     @map("question_id")
  blueprintId   Int?     @map("blueprint_id")
  jobId         Int?     @map("job_id")
  subject       String   @db.VarChar(60)
  topicId       Int?     @map("topic_id")
  role          String   @db.VarChar(40) // generator | reviewer | arbiter | validator
  agentName     String   @map("agent_name") @db.VarChar(120)
  provider      String?  @db.VarChar(80)
  model         String?  @db.VarChar(120)
  promptVersion String?  @map("prompt_version") @db.VarChar(120)
  inputJson     Json     @map("input_json")
  outputJson    Json?    @map("output_json")
  status        String   @default("completed") @db.VarChar(40)
  score         Int?
  decision      String?  @db.VarChar(60)
  error         String?  @db.Text
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@index([questionId, role], map: "idx_csca_ai_agent_runs_question_role")
  @@index([subject, role, createdAt], map: "idx_csca_ai_agent_runs_subject_role_created")
  @@map("csca_ai_agent_runs")
}
```

第二阶段可以把 JSON 快照继续保留，同时将 agent run 写入独立表。

## 7. Gate Decision 规则

发布前必须经过 gate。

### 7.1 自动拦截

以下情况不能发布：

- validator.status = failed。
- reviewer.decision = regenerate。
- reviewer.score < 70。
- 存在 severity = error 的 issue。
- fallbackUsed = true。
- 没有已应用大纲。
- 题目 status 不在 `draft | pending_review | review_failed`。

### 7.2 人工确认

以下情况需要人工确认：

- reviewer.decision = human_review。
- 70 <= score < 80。
- validator 有 warning。
- reviewer 与 validator 结论冲突。
- 难度为 `较难` 且解释质量低于 75。
- 选项质量低于 75。

### 7.3 可直接进入人工发布候选

满足：

- validator.status = passed。
- reviewer.decision = approve。
- reviewer.score >= 80。
- 无 error issue。
- 非 fallback。
- 大纲已应用。

注意：第一阶段仍建议保留管理员点击“通过并发布”，不做全自动发布。

## 8. 后端实施步骤

### Step 1：定义 agent 类型和输出 schema

文件：

- `backend/src/ai-questioning/ai-questioning.types.ts`

新增类型：

- `AiAgentRole`
- `AiAgentIdentity`
- `AgentRunSnapshot`
- `QuestionReviewRubricScore`
- `QuestionReviewAgentOutput`
- `QuestionGateDecision`

### Step 2：封装 agent identity

文件：

- `backend/src/ai-questioning/question-generator-provider.service.ts`
- `backend/src/ai-questioning/question-reviewer-provider.service.ts`

要求：

- Generator 输出 metadata 必须包含 agent identity。
- Reviewer 输出 metadata 必须包含 agent identity。
- agent name 与 prompt version 固定可追踪。

建议常量：

```ts
const GENERATOR_AGENT = {
  role: 'generator',
  name: 'question-generator-v1',
  promptVersion: 'generator-syllabus-v1'
};

const REVIEWER_AGENT = {
  role: 'reviewer',
  name: 'question-reviewer-v1',
  promptVersion: 'reviewer-rubric-v1'
};
```

### Step 3：Reviewer 输入隔离

文件：

- `backend/src/ai-questioning/question-reviewer-provider.service.ts`
- `backend/src/ai-questioning/question-reviewer.service.ts`

Reviewer 只能接收：

- `candidate`
- `reviewContext`
- `validatorResult`
- `rubric`

不得接收：

- generator prompt
- generation retry logs
- provider raw chain
- fallback generation internals

### Step 4：标准化 reviewer rubric

文件：

- `backend/src/ai-questioning/question-reviewer-provider.service.ts`

Reviewer prompt 增加固定评分：

- syllabusAlignment
- answerCorrectness
- optionQuality
- explanationQuality
- difficultyMatch
- languageQuality

要求输出 JSON。

如果 provider 输出不合法：

- 标记 reviewer status failed。
- 题目进入 `review_failed`。
- 不允许发布。

### Step 5：新增 gate decision

文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`

新增函数：

```ts
private questionGateDecision(input: {
  generationMetadata: unknown;
  validation: ReviewResult;
  reviewer: ReviewResult;
}): QuestionGateDecision
```

在以下流程调用：

- `generateForBlueprint`
- `processGenerationJob`
- `reviewQuestion`
- `approveQuestion`

`approveQuestion` 必须检查 gate：

- `publishable`：允许发布。
- `human_review`：允许管理员强制通过，但要记录 `manualOverride`。
- `needs_edit/regenerate`：默认拒绝发布。

第一阶段可以先不允许 override，避免质量风险。

### Step 6：审题证据写入 reviewMetadata

文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`

生成候选时写入：

```ts
reviewMetadata: {
  validator,
  reviewer,
  gate
}
```

复审时更新：

```ts
reviewMetadata.reviewAttempts.push(...)
reviewMetadata.latestReviewer = ...
reviewMetadata.gate = ...
```

### Step 7：候选审核页展示审题证据

文件：

- `frontend/src/pages/AdminAIQuestionBankPage.tsx`

候选题行显示：

- AI 生成 agent。
- 审题 agent。
- reviewer score。
- gate decision。
- issues 数量。
- “查看审题证据”展开区。

候选题编辑区显示：

- validator issues。
- reviewer issues。
- rubric 分数。
- 推荐处理：通过 / 修改 / 重生 / 人工确认。

### Step 8：批量发布遵守 gate

文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `frontend/src/pages/AdminAIQuestionBankPage.tsx`

批量发布时：

- 对每题执行 gate。
- 失败题返回具体 reason。
- 前端显示：
  - 成功几题。
  - 被 gate 拦截几题。
  - 前 5 个拦截原因。

### Step 9：质量回流接入 agent 结果

文件：

- `backend/src/ai-questioning/question-quality.service.ts`

当真实作答数据发现质量异常：

- 如果 reviewer 曾 approve 但真实表现差，记录 reviewer miss。
- 如果某 agent 多次生成低质量题，后台可统计。

第一阶段只写 metadata，第二阶段再做 agent performance dashboard。

## 9. 前端交互方案

### 9.1 候选题列表新增信息

每道候选题增加一行小标签：

```text
生成：question-generator-v1 / deepseek-v4
审题：question-reviewer-v1 / 86 分 / 可发布
门禁：通过
```

如果不通过：

```text
门禁：需修改
原因：解析薄弱；选项质量不足
```

### 9.2 审题证据展开

按钮：`查看审题证据`

展示：

- Validator 结果。
- Reviewer rubric。
- Reviewer issues。
- Gate decision。

### 9.3 发布按钮状态

- gate publishable：显示 `通过并发布`。
- gate human_review：显示 `人工确认发布`，需要二次确认。
- gate needs_edit：显示 `先编辑`，发布按钮禁用。
- gate regenerate：显示 `建议重生`，发布按钮禁用。

## 10. Prompt 设计要点

### 10.1 Generator prompt

核心要求：

- 严格按大纲。
- 不超 excludedScope。
- 难度匹配蓝图。
- 输出 JSON。
- 选项互斥。
- 单选题只有一个正确答案。
- 解析必须能推出正确答案。

### 10.2 Reviewer prompt

核心要求：

- 你不是出题者，你是严格审题员。
- 不评价生成过程，只评价题目本身。
- 如果答案、解析、选项存在不确定性，必须标记。
- 按 rubric 打分。
- 输出 JSON。

示例关键句：

```text
You are an independent exam question reviewer. You did not generate this question.
Do not assume the provided answer is correct. Verify it from the prompt and options.
Reject or flag the question if there is ambiguity, more than one valid answer,
weak explanation, syllabus mismatch, or difficulty mismatch.
```

## 11. 配置方案

环境变量建议：

```env
AI_QUESTIONING_GENERATOR_AGENT=question-generator-v1
AI_QUESTIONING_REVIEWER_AGENT=question-reviewer-v1
AI_QUESTIONING_ARBITER_AGENT=question-arbiter-v1

AI_QUESTIONING_REVIEW_MIN_SCORE=80
AI_QUESTIONING_REVIEW_HUMAN_SCORE=70
AI_QUESTIONING_ENABLE_ARBITER=false
AI_QUESTIONING_ALLOW_MANUAL_GATE_OVERRIDE=false
```

provider 仍走现有统一配置：

```env
AI_PROVIDER=deepseek
AI_MODEL=deepseek-v4
AI_API_KEY=...
```

第二阶段支持：

```env
AI_QUESTIONING_REVIEWER_PROVIDER=openai
AI_QUESTIONING_REVIEWER_MODEL=...
```

## 12. 验收标准

### 12.1 后端验收

- 没有已应用大纲时，不能创建蓝图。
- 没有已应用大纲时，不能生成候选。
- Generator metadata 包含 agent identity。
- Reviewer metadata 包含 agent identity。
- Reviewer 不接收 Generator prompt。
- 候选题 reviewMetadata 有 validator、reviewer、gate。
- gate failed 的题不能发布。
- 批量发布返回拦截原因。

### 12.2 前端验收

- 候选题能看到生成 agent。
- 候选题能看到审题 agent。
- 候选题能看到分数和 gate。
- 审题证据可以展开。
- 被 gate 拦截的题不能误点发布。
- 批量发布失败原因可读。

### 12.3 质量验收

抽取 20 道候选题：

- 至少 90% 有完整审题证据。
- 明显错误题不能被 gate 放行。
- fallback 题不能发布。
- 超纲题不能发布。
- 多答案题不能发布。

## 13. 推荐实施顺序

### PR 1：Agent metadata 与 Reviewer rubric

修改：

- `ai-questioning.types.ts`
- `question-generator-provider.service.ts`
- `question-reviewer-provider.service.ts`
- `question-reviewer.service.ts`

目标：

- 生成和审题 metadata 结构化。
- reviewer 输出 rubric score。

### PR 2：Gate decision

修改：

- `ai-questioning.service.ts`
- `question-validator.service.ts`

目标：

- 写入 gate。
- approve 前执行 gate。
- 批量发布返回 gate 拦截原因。

### PR 3：前端候选审核证据展示

修改：

- `AdminAIQuestionBankPage.tsx`
- admin CSS

目标：

- 显示 agent、score、issues、gate。
- 发布按钮按 gate 状态变化。

### PR 4：Agent run 独立表

修改：

- Prisma migration。
- `ai-questioning.service.ts`
- admin observability。

目标：

- 每次 generator/reviewer/arbiter 调用都有独立记录。
- 后台可统计 agent 表现。

### PR 5：Arbiter Agent

修改：

- 新增 `question-arbiter-provider.service.ts`
- `ai-questioning.module.ts`
- `ai-questioning.service.ts`

目标：

- 高风险题二次仲裁。
- 支持未来不同 provider。

## 14. 当前建议

现在最应该先做 PR 1-3。

理由：

- 不需要数据库迁移即可工作。
- 能立刻改善“题目质量是否可信”的可见性。
- 能让管理员知道 AI 审题依据。
- 能为后续多模型仲裁留下结构。

等流程稳定后，再做 `csca_ai_agent_runs` 独立表和 agent dashboard。

