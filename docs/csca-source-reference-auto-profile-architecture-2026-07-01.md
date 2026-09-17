# CSCA 真题样本自动画像架构方案

> 日期：2026-07-01  
> 状态：架构决策与实施方案  
> 范围：AI 题库工作台、真题样本导入、AI 自动解析、AI 自动映射、风格画像生成、科目出题和模拟卷画像输入  
> 核心决策：真题样本画像链路不再依赖人工逐题确认。系统只接受 AI 自动判断通过且规则门禁通过的样本；低可信、冲突、无法匹配或不允许使用的样本直接排除，临时失败样本有限次数自动重试。

## 1. 核心结论

当前“AI 映射 -> 保存映射 -> 确认可用于画像”的流程过重。它适合高风险人工审稿，但不适合 CSCAlite 当前的运营目标：快速把大量真题样本转成可用画像材料，再服务科目出题、专项练习和模拟卷蓝图。

新的主流程应改为：

```text
导入真题样本
-> 自动创建画像流水线任务
-> AI 自动解析与知识点映射
-> 规则门禁
-> auto_approved：进入画像样本池
-> retry_pending：临时失败，有限次数重试
-> excluded：低可信、冲突或不合规，直接排除
-> 自动刷新学科画像，画像生成只读取 auto_approved 样本
```

原则固定：

```text
不做人工逐题确认。
不确定就不用。
能重试的自动有限重试。
语义失败不重试。
画像只使用自动通过样本。
样本量不足时降低画像置信度，而不是要求人工补确认。
```

上传或粘贴真题 JSON 后，系统必须自动进入这条流水线。后台页面可以保留“重新运行自动画像”“立即重试失败样本”“手动刷新画像”作为维护入口，但这些入口不是主流程，也不应作为导入后的下一步提示。

这意味着当前页面里的这些动作应从主路径移除或降级为历史/调试能力：

- `采纳为画像样本`
- `保存映射`
- `确认可用于画像`
- `确认本页`
- `mapped -> approved` 的人工晋级流程

## 2. 为什么不走人工确认

### 2.1 人工确认成本过高

真题画像是统计层能力。每道题都让管理员确认，会把画像建设变成逐题审稿，运营成本不可控。尤其后续如果每科有数百道样本、多个年份、多个版本，人工确认会成为瓶颈。

### 2.2 画像宁可少用，不要错用

画像生成不要求所有样本都参与。对于低可信样本，最合理策略不是人工兜底，而是直接排除。只要 `auto_approved` 样本达到足够数量，画像就可以生成；样本不足则标记低置信度。

### 2.3 人工确认会制造假确定性

人工逐题确认并不一定更准确，尤其当管理员不是学科审题专家时。系统应把确定性建立在：

- AI 输出结构化证据。
- 置信度与 top1/top2 差距。
- 大纲一致性。
- usage policy。
- 题目结构完整性。
- 可解释的排除原因。

而不是建立在“有人点了确认”。

## 3. 目标产品流程

### 3.1 管理员主路径

管理员只需要做三件事：

```text
1. 导入真题 JSON。
2. 查看自动画像流水线状态。
3. 需要时使用维护入口重跑或立即重试。
```

页面展示结果：

```text
样本总数 48
自动纳入 42
已排除 4
待重试 0
重试耗尽 2
画像状态：已自动刷新 / 样本不足 / 等待重试
画像置信度：high / medium / low
```

### 3.2 管理员辅助能力

后台可以保留查看能力，但不提供逐题人工晋级：

- 查看某题为什么被纳入。
- 查看某题为什么被排除。
- 查看 AI 映射证据。
- 查看重试次数和最后失败原因。
- 重新跑整批或失败样本。

但不提供“人工确认可用于画像”作为主流程。

## 4. 状态机

### 4.1 样本状态

新增独立字段 `autoProfileStatus`，不要继续复用 `reviewStatus = mapped / approved` 表达画像资格。

```ts
type AutoProfileStatus =
  | 'pending'
  | 'processing'
  | 'retry_pending'
  | 'auto_approved'
  | 'excluded'
  | 'excluded_retry_exhausted';
```

状态含义：

| 状态 | 含义 | 是否进入画像 |
| --- | --- | --- |
| `pending` | 已导入，等待自动解析 | 否 |
| `processing` | 正在由后台任务处理 | 否 |
| `retry_pending` | 临时失败，等待有限重试 | 否 |
| `auto_approved` | AI 与规则门禁通过 | 是 |
| `excluded` | 语义不通过或策略不允许 | 否 |
| `excluded_retry_exhausted` | 可重试错误已耗尽次数 | 否 |

### 4.2 状态流转

```text
pending
  -> processing
  -> auto_approved

pending
  -> processing
  -> excluded

pending
  -> processing
  -> retry_pending
  -> processing
  -> auto_approved

retry_pending
  -> processing
  -> excluded_retry_exhausted
```

禁止状态流转：

```text
excluded -> auto_approved
excluded_retry_exhausted -> auto_approved
auto_approved -> excluded
```

如果确实需要重新跑，必须创建新的自动处理任务，并记录 `rerunReason`。这不是人工确认，而是重新执行自动判定。

## 5. 自动通过规则

### 5.1 前置硬条件

不满足以下条件直接 `excluded`，不进入 LLM：

```text
文档 status = active
usagePolicy.allowStyleExtraction !== false
subject 属于 math / physics / chemistry
syllabusVersion 存在
题目结构足够完整
存在当前学科和考纲版本的大纲知识点
```

题目结构完整的最低要求：

```text
有 promptText 或可用的结构化 analysis
能识别题号
能识别题型或至少可归入 single_choice
如果 usagePolicy.allowPromptRawText = false，则必须有足够的 analysis metadata
```

### 5.2 LLM 输出要求

AI 自动解析必须输出结构化结果：

```ts
type AutoProfileDecisionOutput = {
  topicCode: string | null;
  topicTitle?: string;
  confidence: number;
  secondBestTopicCode?: string | null;
  secondBestConfidence?: number;
  evidence: string[];
  questionForm:
    | 'definition'
    | 'formula_calculation'
    | 'graph_interpretation'
    | 'concept_comparison'
    | 'experiment_operation'
    | 'scenario_application'
    | 'error_identification';
  cognitiveSkill:
    | 'recall'
    | 'concept_identification'
    | 'calculation'
    | 'reasoning'
    | 'application'
    | 'multi_step';
  difficulty: 'basic' | 'medium' | 'hard';
  readingLoad: 'low' | 'medium' | 'high';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  reasoningSteps: number;
  distractorTypes: string[];
  commonMisconceptions: string[];
  fatalIssues: string[];
  retryableIssues: string[];
};
```

### 5.3 自动纳入条件

满足以下条件才进入 `auto_approved`：

```text
confidence >= 0.90
confidence - secondBestConfidence >= 0.15
topicCode 匹配当前 subject + syllabusVersion 的 published topic
fatalIssues 为空
questionForm / cognitiveSkill / difficulty / load 字段完整
usagePolicy.allowStyleExtraction !== false
题目未被判断为超纲
题目未与已有样本形成明显重复
```

阈值可以配置，但第一版建议保守：

```ts
type AutoProfileGateConfig = {
  minConfidence: 0.90;
  minConfidenceGap: 0.15;
  maxRetryAttempts: 3;
  minApprovedSamplesForMediumConfidence: 8;
  minApprovedSamplesForHighConfidence: 20;
};
```

## 6. 排除与重试规则

### 6.1 直接排除

以下情况直接 `excluded`，不重试：

```text
usage_policy_blocked
missing_required_structure
out_of_syllabus
topic_not_found
low_confidence
ambiguous_topic
conflicting_analysis
unsupported_question_type
duplicate_or_near_duplicate
source_document_inactive
```

这些属于语义失败或策略失败，重试不会提高确定性。

### 6.2 可重试

以下情况进入 `retry_pending`：

```text
provider_timeout
provider_5xx
rate_limited
invalid_json
schema_invalid
temporary_network_error
provider_empty_output
```

这些属于执行失败，允许自动重试。

### 6.3 重试限制

必须限制重试次数，避免无限消耗额度。

建议默认：

```text
maxRetryAttempts = 3
```

重试策略：

```text
第 1 次失败：5 分钟后重试
第 2 次失败：30 分钟后重试
第 3 次失败：标记 excluded_retry_exhausted
```

可以加轻量抖动：

```text
retryAt = baseDelay + random(0, 60 seconds)
```

重试仍然失败时保存最后原因，不再继续进入队列。

## 7. 数据模型建议

### 7.1 SourceQuestion 扩展

建议在 `csca_source_questions` 增加自动画像字段：

```ts
type CscaSourceQuestionAutoProfileFields = {
  autoProfileStatus:
    | 'pending'
    | 'processing'
    | 'retry_pending'
    | 'auto_approved'
    | 'excluded'
    | 'excluded_retry_exhausted';
  autoProfileAttempts: number;
  autoProfileMaxAttempts: number;
  autoProfileNextRetryAt?: string | null;
  autoProfileLastTriedAt?: string | null;
  autoProfileDecidedAt?: string | null;
  autoProfileFailureType?: string | null;
  autoProfileFailureReason?: string | null;
  autoProfileDecision?: AutoProfileDecisionOutput | null;
  autoProfileGateResult?: AutoProfileGateResult | null;
  autoProfileTaskId?: string | null;
};
```

### 7.2 Gate Result

门禁结果需要可解释：

```ts
type AutoProfileGateResult = {
  passed: boolean;
  status: AutoProfileStatus;
  reasonCode:
    | 'passed'
    | 'usage_policy_blocked'
    | 'missing_required_structure'
    | 'out_of_syllabus'
    | 'topic_not_found'
    | 'low_confidence'
    | 'ambiguous_topic'
    | 'conflicting_analysis'
    | 'unsupported_question_type'
    | 'duplicate_or_near_duplicate'
    | 'provider_timeout'
    | 'provider_5xx'
    | 'rate_limited'
    | 'invalid_json'
    | 'schema_invalid'
    | 'retry_exhausted';
  confidence?: number;
  confidenceGap?: number;
  topicCode?: string | null;
  evidence: string[];
  retryable: boolean;
};
```

### 7.3 Task 表复用

已有 `csca_ai_questioning_tasks` 可以承接自动画像任务。

新增任务类型：

```text
source_question_auto_profile
source_question_auto_profile_retry
style_profile_generate
```

任务 action：

```text
auto_profile_filtered
retry_failed_samples
generate_subject_profile
```

任务快照保存：

```ts
type AutoProfileTaskSnapshot = {
  subject: string;
  syllabusVersion: string;
  documentId?: number;
  statusFilter?: AutoProfileStatus[];
  limit: number;
  gateConfig: AutoProfileGateConfig;
};
```

任务结果保存：

```ts
type AutoProfileTaskResult = {
  requested: number;
  autoApproved: number;
  excluded: number;
  retryPending: number;
  retryExhausted: number;
  failed: number;
  reasonBreakdown: Record<string, number>;
};
```

## 8. 后端服务分层

建议拆分为五个服务角色。

### 8.1 SourceQuestionAutoProfileService

职责：

- 读取待处理样本。
- 执行前置检查。
- 调用 AI 解析与映射。
- 执行门禁。
- 写回 `autoProfileStatus`。
- 记录任务结果。

### 8.2 SourceQuestionProfileGate

职责：

- 实现所有通过、排除、重试规则。
- 不调用数据库。
- 输入 `AutoProfileDecisionOutput`，输出 `AutoProfileGateResult`。

这层必须是纯规则，方便单元测试。

### 8.3 SourceQuestionRetryScheduler

职责：

- 找出 `retry_pending` 且 `nextRetryAt <= now()` 的样本。
- 避免超过 `maxRetryAttempts`。
- 创建或续跑后台任务。

### 8.4 StyleProfileBuilder

职责：

- 只读取 `autoProfileStatus = auto_approved` 的样本。
- 按 subject / syllabusVersion / scope 聚合画像。
- 样本量不足时降低 confidence，而不是要求人工确认。

### 8.5 SourceUsagePolicyGuard

职责：

- 执行 `usagePolicy`。
- `allowStyleExtraction = false`：样本不可入画像。
- `allowPromptRawText = false`：LLM 不可接收原题原文，只能接收 analysis metadata、hash、已确认结构化字段。
- `allowQuestionDisplay = false`：前端不可展示题干、选项、答案和解析原文。

## 9. API 设计

### 9.1 创建自动画像任务

```http
POST /api/v1/admin/ai-questioning/source-questions/auto-profile-tasks
```

请求：

```json
{
  "subject": "math",
  "syllabusVersion": "2025",
  "documentId": 1,
  "limit": 500,
  "mode": "pending_only"
}
```

返回：

```json
{
  "task": {
    "id": "uuid",
    "taskType": "source_question_auto_profile",
    "status": "queued"
  }
}
```

### 9.2 查询任务列表

```http
GET /api/v1/admin/ai-questioning/source-questions/auto-profile-tasks?subject=math
```

### 9.3 查询样本自动画像状态

```http
GET /api/v1/admin/ai-questioning/source-questions?subject=math&autoProfileStatus=excluded
```

### 9.4 重试失败样本

```http
POST /api/v1/admin/ai-questioning/source-questions/auto-profile-tasks
```

```json
{
  "subject": "math",
  "syllabusVersion": "2025",
  "mode": "retry_pending"
}
```

### 9.5 生成画像

```http
POST /api/v1/admin/ai-questioning/style-profiles/generate
```

生成逻辑必须改为只读取：

```text
autoProfileStatus = auto_approved
usagePolicy.allowStyleExtraction !== false
```

## 10. 前端工作台改造

### 10.1 移除主路径中的逐题动作

从主界面移除或降级：

- `采纳为画像样本`
- `保存映射`
- `确认可用于画像`
- `确认本页`

如果保留，应放入“调试/历史操作”折叠区，不作为主流程按钮。

### 10.2 主入口与维护按钮

主入口是导入 JSON。上传或粘贴导入成功后，后端立即创建自动画像任务；自动画像任务完成后刷新学科画像；临时失败样本按次数限制自动排队重试。

页面只保留维护按钮：

```text
重新运行自动画像
立即重试失败样本
手动刷新学科画像
```

### 10.3 状态看板

展示：

```text
样本总数
待处理
处理中
自动纳入
已排除
待重试
重试耗尽
可生成画像
```

### 10.4 样本卡片

样本卡片只展示状态和原因：

```text
已自动纳入画像 · M-PROB-001 · 置信度 96% · gap 22%
已排除 · 低可信 · top 72%
已排除 · 知识点冲突 · top1/top2 gap 4%
待重试 · provider timeout · 第 2/3 次
重试耗尽 · invalid_json
```

不再让用户逐题点确认。

## 11. 画像生成规则

画像只读取自动通过样本：

```sql
WHERE auto_profile_status = 'auto_approved'
```

画像置信度由样本量决定：

```text
sampleSize >= 20 -> high
sampleSize >= 8  -> medium
sampleSize < 8   -> low
```

如果样本量为 0：

```text
不能生成画像。
提示：当前学科没有自动通过样本，请先运行自动解析，或导入更多样本。
```

如果样本量不足：

```text
允许生成 low confidence 画像。
生成题时必须附加“画像样本量低，候选题需更严格审题”的 Reviewer 提示。
```

## 12. 与现有状态的迁移

当前已有 `reviewStatus = approved` 的样本可以迁移，但不能无脑视作新规则通过。

推荐迁移策略：

```text
历史 approved 样本
-> autoProfileStatus = pending
-> 重新跑自动门禁
```

如果为了短期兼容，可以临时允许：

```text
reviewStatus = approved
AND topicId IS NOT NULL
AND usagePolicy.allowStyleExtraction !== false
```

作为画像输入，但这只是过渡策略，最终应统一到 `autoProfileStatus = auto_approved`。

## 13. 观测与成本控制

必须记录：

- 每批任务请求数。
- 自动纳入数。
- 排除数。
- 待重试数。
- 重试耗尽数。
- 平均 token / 成本。
- 按 failureType 聚合。
- 每个 subject 的 auto approval rate。
- 每个 provider / model 的 schema failure rate。

成本保护：

```text
单批默认最多 500 题。
单题最多 3 次自动尝试。
rate limit 错误走延迟重试。
同一文档的重复任务需要幂等保护。
已 auto_approved 的题默认不重复处理，除非 forceRerun = true。
```

## 14. 实施阶段

### 阶段 1：状态和门禁落库

- 增加 `autoProfileStatus` 等字段。
- 实现 `SourceQuestionProfileGate`。
- 画像生成改为读取 `auto_approved`，或先支持兼容读取。
- 前端展示自动画像状态统计。

### 阶段 2：自动画像任务

- 新增自动画像任务 API。
- 后端任务处理 pending 样本。
- 支持 retry_pending 有限重试。
- 导入真题 JSON 后自动创建画像任务。
- 前端保留“重新运行自动画像”和“立即重试失败样本”作为维护入口。

### 阶段 3：移除人工主路径

- 主界面移除逐题确认按钮。
- 单题卡只展示原因和状态。
- 批量按钮改为自动任务化。
- 旧 `mapped / approved` 人工流程降级为兼容字段。

### 阶段 4：画像与出题联动

- 自动画像任务完成后刷新学科画像。
- TopicQuestioningProfile 读取 auto_approved 样本。
- 科目出题 prompt 引用自动画像。
- 模拟卷蓝图读取自动画像。
- 学生作答数据反向校准画像置信度。

## 15. 最终目标

最终管理面板不应让管理员成为逐题审核员，而应让管理员成为自动化流程的观察者：

```text
导入材料
启动自动画像
查看结果
生成画像
用画像提升出题质量
```

系统用规则保证质量：

```text
高可信自动纳入。
低可信自动排除。
临时失败有限重试。
画像只读通过样本。
不靠人工确认制造确定性。
```
