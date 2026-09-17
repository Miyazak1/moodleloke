# CSCAPilot Learning Agent 工具契约

> 状态：Draft v0.1  
> 更新时间：2026-09-12  
> 依赖文档：[总体架构](../ARCHITECTURE.md) · [产品规格](./01-PRODUCT-SPEC.md)

## 1. 文档目的

本文档定义网页 Agent 与 CSCAPilot Plugin 共用的第一版工具边界。这里的工具是稳定的 Agent-facing Contract，不等同于当前 HTTP Controller。

现有后端接口是能力来源；计划新增的 Capability Layer 负责统一参数、权限、确认、幂等、计费、错误和 Artifact 输出。

## 2. 当前能力基线

已核对的真实后端能力包括：

| 领域 | 当前能力来源 |
| --- | --- |
| 学习看板 | `GET /api/v1/me/learning-dashboard` |
| 周度洞察 | `POST /api/v1/me/learning-dashboard/insights/weekly` |
| 错题复习队列 | `GET /api/v1/me/csca/review-queue` |
| AI 额度 | `GET /api/v1/me/ai-credits` |
| 学生档案 | `GET/POST /api/v1/me/student-profile` |
| 自适应概览与掌握度 | `/api/v1/csca-special-practice/adaptive/*` |
| 练习/诊断 Session 和 Round | `/api/v1/csca-special-practice/adaptive/sessions*` |
| AI 提示、解析和轮次总结 | `/api/v1/csca-special-practice/adaptive/ai/*` |
| 模考试卷与 Attempt | `/api/v1/csca-mock-exam/*` |
| 真题与资料套装 | `/api/v1/past-papers`、`/api/v1/resource-bundles` |

下文工具均为计划新增的包装契约，除非明确标记，否则不是已经存在的同名 HTTP Endpoint。

## 3. 命名与版本规则

- 工具名使用 `snake_case`，采用“动词 + 领域对象”；
- 查询使用 `get`、`list`、`search`；创建使用 `create` 或 `start`；
- 工具名不包含供应商、模型名或界面名称；
- 工具的破坏性语义变化必须升主版本；
- 新增可选字段可以升次版本；
- 每次响应返回实际 `toolVersion`；
- MCP、网页 Agent 和内部 Tool Registry 使用相同的逻辑名称及 Schema。

第一版版本统一为 `1.0`。

## 4. 通用调用上下文

以下字段由 Gateway 或 MCP Server 根据已认证身份注入，模型不得自行提供：

```ts
type ToolContext = {
  requestId: string;
  traceId: string;
  actorUserId: number;
  channel: 'web_agent' | 'codex_plugin' | 'chatgpt_plugin' | 'internal';
  locale: 'zh-CN' | 'en';
  timezone?: string;
  grantedScopes: string[];
  idempotencyKey?: string;
  confirmedActionId?: string;
};
```

安全要求：

- `actorUserId` 只来自认证会话或 OAuth Token；
- 工具不得接受任意 `userId` 查询其他学生；
- 写工具必须记录 `channel`、`requestId` 和 `traceId`；
- 所有资源访问重新校验所有权，不能只相信模型提供的 ID。

## 5. 通用响应信封

### 5.1 成功响应

```ts
type ToolSuccess<T> = {
  ok: true;
  tool: string;
  toolVersion: string;
  requestId: string;
  data: T;
  artifact?: AgentArtifactSummary | null;
  usage: ToolUsage;
  warnings?: ToolWarning[];
  confirmation?: null;
};
```

### 5.2 需要确认

```ts
type ToolConfirmationRequired = {
  ok: false;
  tool: string;
  toolVersion: string;
  requestId: string;
  confirmation: {
    actionId: string;
    level: 2 | 3;
    title: string;
    summary: string;
    changes?: Array<{ field: string; before: unknown; after: unknown }>;
    estimatedCredits?: number;
    expiresAt: string;
  };
  error: null;
};
```

确认后由 Gateway 使用同一业务参数和 `confirmedActionId` 重放调用。后端必须验证确认内容未被修改且尚未过期。

### 5.3 失败响应

```ts
type ToolFailure = {
  ok: false;
  tool: string;
  toolVersion: string;
  requestId: string;
  error: {
    code: ToolErrorCode;
    message: string;
    retryable: boolean;
    retryAfterMs?: number;
    userAction?: string;
    fieldErrors?: Array<{ field: string; code: string; message: string }>;
  };
  usage?: ToolUsage;
  confirmation?: null;
};
```

### 5.4 用量结构

```ts
type ToolUsage = {
  creditsCharged: number;
  creditsRefunded?: number;
  creditsRemaining?: number | null;
  meteringSource?: 'none' | 'personal' | 'organization' | 'allowlist';
};
```

无 AI 调用的工具也返回 `creditsCharged: 0`，让所有入口采用相同处理方式。

## 6. Artifact 摘要

```ts
type AgentArtifactSummary = {
  id: string;
  type:
    | 'practice_session'
    | 'review_session'
    | 'mock_exam'
    | 'past_paper'
    | 'past_paper_bundle'
    | 'readiness_report'
    | 'weekly_report'
    | 'study_plan'
    | 'concept_card';
  version: number;
  title: string;
  summary?: string;
  status: 'ready' | 'in_progress' | 'completed' | 'failed' | 'expired';
  subject?: 'math' | 'physics' | 'chemistry' | 'mixed';
  primaryAction: {
    type: 'navigate' | 'confirm' | 'retry';
    label: string;
    href?: string;
    actionId?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
};
```

插件客户端不应依赖 `href` 才能完成任务。`data` 和 `artifact.metadata` 必须包含足够的结构化结果；`href` 用于在 CSCAPilot 网页中继续操作。

## 7. 权限和执行等级

| 等级 | 说明 | 默认行为 |
| --- | --- | --- |
| L0 | 只读，无额外费用 | 可直接执行 |
| L1 | 低风险、可恢复写操作 | 可直接执行，返回结果 |
| L2 | 修改个人设置或产生明显费用 | 先返回确认摘要 |
| L3 | 不可轻易撤销的提交 | 必须明确确认 |

## 8. P0 工具定义

### 8.1 `get_learning_dashboard`

用途：获取当前学生的学习摘要、推荐动作、备考度、本周进度和相关状态。

```ts
type GetLearningDashboardInput = {
  language?: 'zh' | 'en';
};

type GetLearningDashboardData = {
  generatedAt: string;
  readiness?: { score: number; label?: string; factors?: unknown[] };
  weeklyProgress?: Record<string, unknown>;
  subjectSummaries?: unknown[];
  recommendedActions: Array<{
    type: string;
    title: string;
    reason?: string;
    href?: string;
    subject?: string;
  }>;
};
```

- 来源：现有 learning dashboard；
- Scope：`learning.read`；
- 等级：L0；
- AI 额度：0；
- 缓存：用户级短缓存，建议不超过 60 秒；
- 注意：不得根据缺失字段虚构 readiness 或推荐。

### 8.2 `get_learning_profile`

用途：读取执行学习任务所需的学生档案和备考偏好。

```ts
type GetLearningProfileInput = {};

type GetLearningProfileData = {
  educationStageCode: string | null;
  gradeCode: string | null;
  genderCode: string | null;
  countryCode: string | null;
  graduationYear: number | null;
  targetSubjectCodes: Array<'math' | 'physics' | 'chemistry'>;
  preferredQuestionLanguageCode: 'zh' | 'en' | 'bilingual' | null;
  targetExamDate: string | null;
  examAttemptType: string | null;
  weeklyGoalDays: number | null;
  studyAvailability: {
    availabilityVersion: string;
    timezone: string;
    weeklyMinutesGoal: number | null;
    preferredStudyDays: number[];
    defaultSessionMinutes: number | null;
    source: 'user' | 'account_default' | 'unset';
  };
  targetMajorCategoryCode: string | null;
};
```

- 来源：现有 StudentProfile 与版本化 StudyAvailabilityPreference；
- Scope：`learning.read`；
- 等级：L0；
- AI 额度：0；
- 隐私：只返回学习个性化所需字段，不返回邮箱、密码或 OAuth 信息。

### 8.3 `get_ai_credit_balance`

用途：返回当前用户可用于 CSCAPilot AI 服务的权益和余额。

```ts
type GetAICreditBalanceInput = {};

type GetAICreditBalanceData = {
  available: boolean;
  unlimited: boolean;
  creditsRemaining: number | null;
  source: 'personal' | 'organization' | 'allowlist' | 'none';
  reason?: string;
};
```

- 来源：现有 AI credits/entitlement；
- Scope：`learning.read`；
- 等级：L0；
- AI 额度：0；
- 注意：白名单或组织无限权益使用 `unlimited: true`，不得伪造一个很大的数字余额。

### 8.4 `get_subject_mastery`

用途：查询学科和知识点掌握度，用于解释推荐或选择练习重点。

```ts
type GetSubjectMasteryInput = {
  subject?: 'math' | 'physics' | 'chemistry';
  limit?: number;
};

type GetSubjectMasteryData = {
  subjects: Array<{
    subject: 'math' | 'physics' | 'chemistry';
    score?: number;
    topics: Array<{
      topicId: number;
      code: string;
      title: string;
      score?: number;
      confidence?: number;
      status?: string;
    }>;
  }>;
};
```

- 来源：现有 adaptive mastery；
- Scope：`learning.read`；
- 等级：L0；
- AI 额度：0；
- 校验：`limit` 建议限制在 1–50。

### 8.5 `get_review_queue`

用途：读取当前用户的到期或优先错题模式。

```ts
type GetReviewQueueInput = {
  subject?: 'math' | 'physics' | 'chemistry';
  language?: 'zh' | 'en';
  limit?: number;
};

type GetReviewQueueData = {
  items: Array<{
    reviewItemId: number;
    patternType?: string;
    topicId?: number;
    subject: string;
    title: string;
    dueAt?: string | null;
    priority?: number;
    href?: string;
  }>;
};
```

- 来源：现有 review queue；
- Scope：`learning.read`；
- 等级：L0；
- AI 额度：0；
- 默认 `limit: 10`，最大 50。

### 8.6 `create_adaptive_practice`

用途：创建自适应练习 Session 和首个 5 题 Round，并返回可进入的 Artifact。

```ts
type CreateAdaptivePracticeInput = {
  subject: 'math' | 'physics' | 'chemistry';
  questionLanguage?: 'zh' | 'en';
  focusTopicId?: number;
  verification?: {
    reviewItemId?: number;
    patternType?: string;
    topicId?: number;
  };
};

type CreateAdaptivePracticeData = {
  sessionId: string;
  roundId: string;
  mode: 'practice';
  questionCount: 5;
  subject: string;
  questionLanguage: 'zh' | 'en';
};
```

- 来源：现有 create adaptive session + create round；
- Scope：`practice.write`；
- 等级：L1；
- AI 额度：通常为 0，若底层未来生成新题必须明确计费；
- 幂等：必须，同一用户与幂等键返回同一 session/round；
- 超时：组合调用建议 15 秒；
- Artifact：`practice_session`；
- 回滚：Session 创建成功但 Round 失败时标记初始化失败，重试继续初始化而非另建 Session。

### 8.7 `create_diagnostic`

用途：创建 20 题诊断任务。

```ts
type CreateDiagnosticInput = {
  subject: 'math' | 'physics' | 'chemistry';
  questionLanguage?: 'zh' | 'en';
};

type CreateDiagnosticData = {
  sessionId: string;
  roundId: string;
  mode: 'diagnostic';
  questionCount: 20;
  subject: string;
  questionLanguage: 'zh' | 'en';
};
```

- 来源：现有 adaptive session/round 的创建与答题流程，但选题必须经过专用 Diagnostic Supply Service，只读取角色为 `DIAGNOSTIC` 且对当前用户未发生禁止性曝光的题目版本；
- Scope：`practice.write`；
- 等级：L1；
- 幂等、失败恢复和 Artifact 要求与普通练习一致；
- Agent 在调用前应向用户说明这是 20 题诊断，但不要求二次确认。
- 生产门槛：独立测量题池、`AssessmentItemExposure` 和题目角色校验未启用时返回 `CAPABILITY_UNAVAILABLE`，不得退回普通训练题或临时生成题。

### 8.8 `start_review_practice`

用途：根据 review queue 中的一个项目创建验证练习。

```ts
type StartReviewPracticeInput = {
  reviewItemId: number;
  subject: 'math' | 'physics' | 'chemistry';
  questionLanguage?: 'zh' | 'en';
};

type StartReviewPracticeData = {
  sessionId: string;
  roundId: string;
  reviewItemId: number;
  questionCount: 5;
};
```

- 来源：review queue + adaptive round verification；
- Scope：`practice.write`；
- 等级：L1；
- AI 额度：0；
- 幂等：必须；
- 所有权：后端验证 reviewItem 属于当前用户；
- Artifact：`review_session`。

### 8.9 `list_mock_exam_attempts`

用途：查询用户未完成和已完成的模考，用于继续模考或打开报告。

```ts
type ListMockExamAttemptsInput = {
  status?: 'in_progress' | 'submitted' | 'all';
  subject?: 'math' | 'physics' | 'chemistry';
  limit?: number;
};

type ListMockExamAttemptsData = {
  items: Array<{
    attemptId: string;
    paperSlug: string;
    title: string;
    subject: string;
    status: 'in_progress' | 'submitted';
    answeredCount?: number;
    questionCount?: number;
    updatedAt?: string;
    attemptPath?: string;
    reportPath?: string | null;
  }>;
};
```

- 来源：现有 my attempts；
- Scope：`learning.read`；
- 等级：L0；
- AI 额度：0；
- 默认只返回最近 10 条，外部插件不得遍历全部历史。

### 8.10 `start_mock_exam`

用途：为指定公开试卷创建模考 Attempt。

```ts
type StartMockExamInput = {
  paperSlug: string;
  language?: 'zh' | 'en';
};

type StartMockExamData = {
  attemptId: string;
  paperSlug: string;
  status: 'in_progress';
  attemptPath: string;
};
```

- 来源：现有 mock paper attempt create；
- Scope：`mock_exam.write`；
- 等级：L1；
- AI 额度：0；
- 幂等：必须；
- 后端校验试卷已发布且用户有访问权限；
- Artifact：`mock_exam`。

继续已有模考不需要单独写工具：先通过 `list_mock_exam_attempts` 获得所有权已验证的入口即可。

### 8.11 `search_past_papers`

用途：搜索已发布的真题、模拟卷和资料套装。

```ts
type SearchPastPapersInput = {
  query?: string;
  subject?: 'math' | 'physics' | 'chemistry';
  category?: 'past-paper' | 'mock-paper';
  year?: number;
  language?: 'zh' | 'en';
  limit?: number;
};

type SearchPastPapersData = {
  papers: Array<{
    slug: string;
    title: string;
    subject: string;
    category: string;
    examYear?: number | null;
    language?: string | null;
    questionCount?: number | null;
    hasAnswers?: boolean;
    hasSolutions?: boolean;
    isFree?: boolean;
    href: string;
  }>;
  bundles: Array<{
    slug: string;
    title: string;
    subjectScope: string;
    itemCount: number;
    href: string;
  }>;
};
```

- 来源：现有 public past papers 和 resource bundles；
- Scope：`resources.read`；
- 等级：L0；
- AI 额度：0；
- 只返回已发布资源；
- `query` 在没有全文搜索前可由 Capability Layer 对结构化字段做安全匹配；
- Artifact：单条可为 `past_paper`，套装为 `past_paper_bundle`。
- 网页 Agent 将命中结果同时保存为 `pastPaperResources` 结构化消息内容；字段只能来自本工具返回值，前端不得从模型文本解析 slug、文件或发布状态；
- 打开文件时继续调用 Past Paper 公共详情与下载接口；Agent 不复制公共真题文件，也不绕过发布状态、访问控制和下载审计。
- 题目级提问必须携带 `pageContext.entityRef={type:'past_paper',id:slug}` 与 `selectedQuestionId`；二者只是非可信定位参数，Runtime 必须重新验证公开资料、`sourceDocumentId` 绑定、来源状态、使用策略和题目归属；
- 题目回答保存为 `pastPaperQuestion` 与 `pastPaperCitations`。引用至少包含 paper slug/title、source question ID、题号、页码和来源标签；没有已核验解析时返回 unavailable，不允许模型补写成来源事实。

### 8.12 `generate_question_hint`

用途：为当前自适应练习题生成渐进式提示。

```ts
type GenerateQuestionHintInput = {
  roundId: string;
  questionId: number;
  responseLanguage?: 'zh' | 'en';
};

type GenerateQuestionHintData = {
  interactionId: string;
  hint: string;
  generatedByAI: true;
};
```

- 来源：现有 adaptive AI hint；
- Scope：`ai.generate`；
- 等级：L2（是否每次弹出确认由价格策略决定）；
- AI 额度：消耗，响应返回实际扣费；
- 幂等：必须，同一题、提示阶段和幂等键不能重复扣费；
- 所有权：后端验证 round 和 question 属于当前用户；
- 内容：不得直接泄露答案，除非现有提示策略明确允许相应阶段。

### 8.13 `generate_question_explanation`

用途：结合题目和用户作答生成解析。

```ts
type GenerateQuestionExplanationInput = {
  roundId: string;
  questionId: number;
  selectedAnswer?: string;
  responseLanguage?: 'zh' | 'en';
};

type GenerateQuestionExplanationData = {
  interactionId: string;
  explanation: string;
  generatedByAI: true;
  correctness?: boolean;
};
```

- 来源：现有 adaptive AI explain；
- Scope：`ai.generate`；
- 等级：L2；
- AI 额度、幂等和所有权规则同提示工具；
- `selectedAnswer` 必须与 round 中可验证的作答一致，不能替换其他用户答案。

### 8.14 `generate_round_summary`

用途：在 Round 完成后生成学习总结。

```ts
type GenerateRoundSummaryInput = {
  roundId: string;
  responseLanguage?: 'zh' | 'en';
};

type GenerateRoundSummaryData = {
  interactionId: string;
  summary: string;
  strengths?: string[];
  weaknesses?: string[];
  nextActions?: Array<{ type: string; title: string; href?: string }>;
  generatedByAI: true;
};
```

- 来源：现有 adaptive AI round summary；
- Scope：`ai.generate`；
- 等级：L2；
- 前置条件：Round 已提交或具备现有服务允许的完成状态；
- AI 额度：消耗；
- Artifact：可以生成 `readiness_report` 或 `concept_card` 引用，但不复制完整 Round 数据。

## 9. P1 工具定义

### 9.0 统一学习辅助契约

新 UI 不直接把 `generate_question_hint` 和 `generate_question_explanation` 暴露为两个孤立入口，而通过以下稳定能力获得当前上下文允许的辅助阶梯：

- `get_available_assistance`：读取当前题目/作答阶段允许与推荐的辅助动作，Scope `learning.read`，L0；
- `request_learning_assistance`：请求题意澄清、概念提醒、下一步提示、步骤检查、换一种讲法、相关例题、完整解析或前置知识，Scope 视执行内容为 `learning.read` 或 `ai.generate`，最高 L2；
- `get_teaching_asset`：读取当前用户可访问的已发布、版本化教学资产，Scope `learning.read`，L0；
- `report_learning_content_issue`：举报题目、讲解、交互内容或 AI 判断，Scope `learning.feedback`，L1。

所有请求必须绑定服务端可验证的 `roundId/questionId`、附件分析或已发布教学资产；返回 `policyVersion/contextVersion`、实际曝光层级、来源和费用。完整解析在未提交题上要求明确确认并使本题失去独立测量资格。精确 DTO 在 PR11G 冻结，语义边界见 [55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md](./55-LEARNING-ASSISTANCE-AND-TEACHING-ASSET-ADR.md)。现有 hint/explanation 工具保留为 Orchestrator 的兼容适配器。

### 9.1 `generate_weekly_learning_report`

封装现有 weekly insight，返回结构化周报 Artifact。该工具在接入前需要确认现有服务的计费和重复生成策略。

- Scope：`ai.generate`；
- 等级：L2；
- Artifact：`weekly_report`；
- 幂等建议：同一用户、自然周、语言和版本只生成一次有效结果。

### 9.2 `update_learning_profile`

更新现有学生档案中的白名单字段。

```ts
type UpdateLearningProfileInput = {
  educationStageCode?: string | null;
  gradeCode?: string | null;
  genderCode?: string | null;
  countryCode?: string | null;
  graduationYear?: number | null;
  targetSubjectCodes?: Array<'math' | 'physics' | 'chemistry'>;
  preferredQuestionLanguageCode?: 'zh' | 'en' | 'bilingual' | null;
  targetExamDate?: string | null;
  examAttemptType?: string | null;
  weeklyGoalDays?: number | null;
  targetMajorCategoryCode?: string | null;
  expectedVersion?: number;
};
```

- Scope：`profile.write`；
- 等级：L2；
- 必须先返回字段级变更摘要；
- 只接受后端允许的枚举值；
- Artifact：`study_plan`；
- 并发：使用 `expectedVersion` 或等价乐观锁。

### 9.3 `submit_mock_exam`

提交已有模考 Attempt。

```ts
type SubmitMockExamInput = {
  attemptId: string;
  expectedVersion?: number;
};
```

- 来源：现有 submit attempt；
- Scope：`mock_exam.submit`；
- 等级：L3；
- 必须明确确认；
- 幂等：重复提交返回同一提交结果；
- 所有权：必须补强或确认现有 service 对当前用户所有权的校验；
- Artifact：状态变更后的 `mock_exam`。

### 9.4 `request_generated_practice`

通过稳定的 `QuestionGenerationCapabilityV1` 异步请求私有定制练习。该工具不暴露 Generator、Prompt、Reviewer、Validator 或发布接口。

```ts
type RequestGeneratedPracticeInput = {
  schemaVersion: '1';
  subject: 'math' | 'physics' | 'chemistry';
  topicIds: string[];
  difficulty: 'basic' | 'medium' | 'hard' | 'adaptive';
  questionCount: number;
  language: 'zh-CN' | 'en';
  purpose: 'practice';
  sourcePolicy: 'generated_private';
  idempotencyKey: string;
};
```

- Scope：`ai.generate` + `practice.write`；
- 等级：L2，执行前展示题数、范围、预计等待和额度；
- 返回：`generation_request` Artifact，后台完成后解析为 `practice_session`；
- 幂等：结构化请求、用户和来源内容版本相同只创建一次有效任务；
- 所有权：生成题默认仅当前用户可见；
- 发布：用户生成题不得通过该工具进入公共题库；
- 降级：未开放、质量失败或供应商不可用时，明确返回错误并建议已发布题库；
- 测量边界：生成题默认只能进入 `TRAINING`；不得通过该工具进入 `DIAGNOSTIC/CALIBRATION/MOCK`；
- 完整状态和版本规则见 [14-QUESTION-GENERATION-INTEGRATION-ADR.md](./14-QUESTION-GENERATION-INTEGRATION-ADR.md)。

## 10. 不应暴露为 Agent 工具的接口

- 所有 `/api/v1/admin/*` 接口；
- 组织成员、邀请、额度池和模型供应商管理；
- 自动出题的底层生成、审核和发布接口；只允许使用受控的高级私有练习请求；
- 真题文件上传、删除和后台编辑；
- 任意用户 ID 查询；
- 直接设置 AI 额度或白名单；
- 原始数据库查询或通用 HTTP 代理；
- 绕过现有业务规则的低层写接口。

如果未来开发管理员 Agent，应使用独立插件、独立 Scope 和独立审核流程，不能扩展学生插件的默认权限。

## 11. 错误码

第一版统一错误码建议：

| 错误码 | 含义 | 可重试 |
| --- | --- | --- |
| `AUTHENTICATION_REQUIRED` | 未登录或 Token 无效 | 否，需登录 |
| `AUTHORIZATION_DENIED` | 缺少 Scope 或资源权限 | 否 |
| `VERIFIED_USER_REQUIRED` | 账号尚未满足验证要求 | 否 |
| `VALIDATION_ERROR` | 参数不符合 Schema | 否 |
| `RESOURCE_NOT_FOUND` | 资源不存在或对用户不可见 | 否 |
| `RESOURCE_CONFLICT` | 版本冲突或状态已变化 | 需刷新后重试 |
| `CONFIRMATION_REQUIRED` | 操作需要确认 | 否，需确认 |
| `CONFIRMATION_EXPIRED` | 确认已过期或内容改变 | 否，重新确认 |
| `INSUFFICIENT_AI_CREDITS` | AI 权益或额度不足 | 否 |
| `RATE_LIMITED` | 调用频率受限 | 是 |
| `TOOL_TIMEOUT` | 下游服务超时 | 是 |
| `TOOL_UNAVAILABLE` | 下游服务暂不可用 | 是 |
| `IDEMPOTENCY_CONFLICT` | 同一幂等键对应不同参数 | 否 |
| `INTERNAL_ERROR` | 未分类服务错误 | 视情况 |

面向模型的错误消息应简洁、稳定，不包含堆栈、SQL、内部路径或密钥。

## 12. 幂等与重试

### 12.1 必须使用幂等键

- 创建练习或诊断；
- 创建模考 Attempt；
- 调用计费 AI 能力；
- 修改档案；
- 提交模考。

### 12.2 自动重试规则

- L0 查询：网络错误或 5xx 可指数退避重试一次；
- L1/L2/L3 写操作：只有在能够按幂等键查询结果时才重试；
- 参数错误、权限错误、额度不足和业务冲突不自动重试；
- 模型不得通过修改一个无意义字段绕过幂等或频率限制。

## 13. MCP 输出要求

MCP 工具应同时返回：

1. 结构化 `data`，供宿主模型继续调用；
2. 简洁的 model-readable text，说明结果和下一步；
3. 可选 UI resource，仅在需要比较、编辑、确认或导航时提供。

文本不得声称“已完成”尚未成功的写操作。UI 不可用时，工具仍必须返回完整结构化结果。

## 14. 审计字段

每次调用至少记录：

```text
requestId, traceId, toolName, toolVersion, actorUserId,
channel, scopes, riskLevel, confirmationActionId,
idempotencyKeyHash, startedAt, completedAt, durationMs,
resultCode, artifactId, creditsCharged, providerRequestId
```

不得在普通审计日志保存访问令牌、完整提示词、完整题目内容或用户敏感资料。需要质量分析的内容使用独立、受限且有保留期限的数据策略。

## 15. 契约测试要求

每个 P0 工具至少覆盖：

- 正常成功；
- 未认证和缺少 Scope；
- 非法参数；
- 不属于当前用户的资源；
- 空结果；
- 下游超时；
- 幂等重放；
- 幂等冲突；
- 额度不足（AI 工具）；
- 确认缺失或过期（L2/L3）；
- 中文和英文输出；
- MCP 结构化结果与网页 Tool Registry 结果一致。

## 16. 实施顺序

1. 建立通用信封、错误码、Tool Registry 和审计中间件；
2. 先接入五个 L0 查询工具；
3. 接入练习、诊断、复习和模考创建工具；
4. 接入 AI 提示、解析和总结，并打通计费幂等；
5. 用同一 Registry 暴露 Web Agent Adapter；
6. 用同一应用服务暴露 MCP Adapter；
7. 最后加入档案修改和模考提交等高风险工具。

## 17. 尚待技术确认

1. 当前自适应 Session 创建与 Round 创建是否能放入同一事务或恢复流程；
2. 现有模考 Attempt 的读取、修改和提交是否全部执行用户所有权校验；
3. weekly insight 的实际计费和缓存规则；
4. AI hint 是否支持多阶段提示及其幂等维度；
5. 现有额度服务在个人、组织和白名单同时命中时的优先级；
6. Artifact 表、受控领域对象引用和所有权 Resolver 的契约测试是否全部覆盖；
7. MCP OAuth 的 Token 生命周期、刷新和撤销方式；
8. Capability Layer 的 NestJS 模块依赖边界检查和未来拆分触发指标是否落入 CI/监控。

## 18. Composer 附件契约

文件字节通过专用私有上传协议传输，不作为模型 tool 参数或消息 JSON 内的 base64。首批应用能力包括：

- `create_attachment_upload_session`：校验策略并创建短时上传目标；
- `complete_attachment_upload`：验证实际对象、hash、大小与所有权并启动处理；
- `get_attachment_status`：返回扫描、解析、OCR、进度和错误；
- `analyze_attachments`：基于一个或多个 ready 附件执行问答、总结、题目/作答分析或比较；
- `delete_attachment`：撤销访问并启动原文件、派生内容和索引清理。

消息只携带 `attachmentIds[]`。服务端必须重新校验当前用户所有权、状态、内容版本和保留状态。分析结果返回 `AttachmentCitation[]`，至少包含附件 ID/名称、页码或区域、提取方法和可选置信度。完整状态和限制见 [10-ATTACHMENT-INGESTION.md](./10-ATTACHMENT-INGESTION.md)。

`analyze_attachments` 使用版本化输入：

```ts
type AnalyzeAttachmentsInputV1 = {
  schemaVersion: '1';
  attachmentIds: string[];
  mode: 'document_qa' | 'document_summary' | 'image_question_analysis'
    | 'handwritten_solution_review' | 'question_extraction'
    | 'document_compare' | 'knowledge_mapping';
  questionId?: string;
  questionAttachmentIds?: string[];
  userInstruction?: string;
  responseDepth?: 'hint' | 'guided' | 'full';
};
```

手写审阅必须具有可信原题上下文；只有答案而无法识别原题时返回 `QUESTION_CONTEXT_REQUIRED`。结果区分识别文本、直接观察、模型推断、不确定项和教学反馈。独立分析不得自动提交答案或修改成绩、错题和掌握度。

## 19. 目标分数与备考度契约

首版结果能力使用独立契约，不把现有 dashboard 的汇总 `readiness.score` 当作目标分数预测：

- `get_score_goal`：L0，返回当前版本化目标、考试日期和评分策略版本；
- `get_study_availability`：L0，返回长期时间偏好、时区和来源；
- `update_study_availability`：L2，版本化修改长期偏好；“今天只有十分钟”等短期约束不得调用此工具；
- `update_score_goal`：L2，确认摘要包含旧目标、新目标和计划影响；
- `get_score_readiness`：L0，返回分数区间、达标概率、置信度、证据截止时间和版本；
- `get_target_gap`：L0，返回关键差距、严重度、置信度和证据引用；
- `get_learning_prescription`：L0，返回当前首选任务、替代方案和理由；
- `get_question_supply_status`：L0，返回指定学习需求是否有合格已发布库存，不返回未发布题目；
- `simulate_plan_adjustment`：L0，只读模拟学习时间、节奏或日期变化。

共同版本向量：

```ts
type LearningDecisionVersionVectorV1 = {
  goalVersion: string;
  availabilityVersion: string;
  evidenceVersion: string;
  learningStateVersion: string;
  learningModelVersion: string;
  syllabusVersion: string;
  scoringPolicyVersion: string;
  itemCalibrationVersion: string;
  decisionPolicyVersion: string;
  decisionContextVersion: string;
  forecastModelVersion: string;
};
```

目标和时间写入契约：

```ts
type UpdateScoreGoalInputV1 = {
  schemaVersion: '1';
  examSystemCode: 'csca';
  examBatchCode: string;
  examDate: string;
  subjectGoals: Array<{
    subject: 'math' | 'physics' | 'chemistry';
    targetScore: number;
    priority?: number;
  }>;
  expectedGoalVersion?: string;
  expectedScoringPolicyVersion: string;
};

type UpdateStudyAvailabilityInputV1 = {
  schemaVersion: '1';
  timezone: string;
  weeklyMinutesGoal: number | null;
  preferredStudyDays: number[];
  defaultSessionMinutes: number | null;
  expectedAvailabilityVersion?: string;
};

type SessionConstraintV1 = {
  availableMinutes?: number;
  subject?: 'math' | 'physics' | 'chemistry';
  intensity?: 'light' | 'normal';
};
```

`targetScore` 必须由 `expectedScoringPolicyVersion` 指向且仍为 active 的 `ExamScoringPolicy` 校验范围；版本已替换时返回版本冲突并重新生成确认摘要，避免确认后规则变化。`preferredStudyDays` 使用 ISO weekday `1..7` 且不重复；`timezone` 必须是 IANA timezone。`SessionConstraintV1` 只影响本次方案，不保存为长期偏好。

备考度读取至少返回：

```ts
type GetScoreReadinessDataV1 = {
  forecastId: string;
  goalId: string;
  userId: number;
  subjectCode: 'math' | 'physics' | 'chemistry';
  targetScore: number;
  readinessState: 'insufficient' | 'measuring' | 'on_track' | 'at_risk';
  expectedScoreBand: { low: number; central: number; high: number } | null;
  targetAttainmentProbability: number | null;
  confidence: 'insufficient' | 'low' | 'medium' | 'high';
  reasonCodes: string[];
  evidenceCutoffAt: string;
  nextValidationAction?: 'diagnostic' | 'mock_exam' | 'continue_learning';
  versions: LearningDecisionVersionVectorV1;
  createdAt: string;
};
```

Goal、Availability 写入均使用服务端确认摘要和乐观锁。`get_target_gap`、`get_learning_prescription` 与 `simulate_plan_adjustment` 必须返回相同版本向量；创建练习前重新验证 Prescription 和题目库存版本。

`get_score_readiness` 在证据不足或评分策略无效时必须返回 `confidence: 'insufficient'`，且分数区间与概率为 `null`。所有决策响应绑定 `goalVersion`、`availabilityVersion`、`evidenceVersion`、`learningStateVersion`、`learningModelVersion`、`syllabusVersion`、`scoringPolicyVersion`、`itemCalibrationVersion`、`decisionPolicyVersion`、`decisionContextVersion` 和 `forecastModelVersion`；其中 `decisionContextVersion` 冻结到期复习、近期模考与计划日期等会随时间变化但不属于学习状态的决策输入。LLM 不得生成或覆盖这些数值。详细契约边界见 [17-TARGET-SCORE-OUTCOME-ADR.md](./17-TARGET-SCORE-OUTCOME-ADR.md) 和 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md)。

当前 `score-readiness-shadow-gate-v1` 的响应外层为 `goal_unset | updating | ready`；`ready` 时固定包含 `visibility: 'shadow'` 和每个目标科目一条 Forecast。Shadow Gate 仅允许 `insufficient | measuring`，且 `confidence` 固定为 `insufficient`、两个数值字段固定为 `null`。该能力可供 Web 与插件解释“还缺什么证据”，但不得包装成成绩预测。
