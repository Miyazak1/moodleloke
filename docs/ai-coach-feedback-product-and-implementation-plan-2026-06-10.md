# AI Coach 反馈体系产品与实施方案

> 日期：2026-06-10  
> 范围：科目训练 / 自适应训练中的 AI 提示、错因解析、本轮总结反馈按钮。  
> 目标：把“点赞/点踩”从模糊的按钮，升级为用户可理解、后台可治理、未来可个性化扩展的反馈体系。

## 1. 结论

当前点赞/点踩已经有后端落点，但产品语义不够清楚。

现在它实际是 **AI 输出质量反馈**：

- 点赞提交 `rating = 5`。
- 点踩提交 `rating = 2`。
- 写入 `csca_ai_interaction_feedback`。
- 记录 `ai_feedback_submitted` 训练事件。
- 后台 `AIObservabilityService` 用它统计低反馈率、平均评分，并把低分 interaction 放入 AI review queue。

它当前 **不影响**：

- 学生掌握度。
- 下一轮出题。
- 错题复盘队列。
- 个人准备度。
- 学习路径推荐。

因此第一阶段必须明确表达：这是对 AI 解释质量的反馈，不是对学生学习状态的反馈。

## 2. 核心原则

### 2.1 用户语义

用户点按钮时应知道：

- 点赞：这条 AI 解释有帮助。
- 点踩：这条 AI 解释没有帮助，可以说明原因。
- 反馈会帮助我们检查和改进 AI 解析质量。
- 反馈不会立刻改变本轮出题或掌握度。

### 2.2 数据语义

反馈分为两类，不混用：

| 类型 | 来源 | 用途 | 是否进入个人学习算法 |
| --- | --- | --- | --- |
| AI 质量反馈 | 对 AI 输出点赞/点踩 | 质量监控、review queue、prompt/fallback 调优 | 否 |
| 学习困难反馈 | 用户主动表示“我没看懂/还不会” | 未来可用于解释偏好、补弱建议 | 不能直接改掌握度，只能作为弱证据 |

第一阶段只做 AI 质量反馈的完整闭环。

### 2.3 算法边界

点踩 AI 解释不等于学生不会。

错误示例：

```text
用户点踩 AI 解析 -> 系统降低该知识点掌握度
```

正确方向：

```text
用户点踩 AI 解析 -> 进入 AI 质量 review / 统计低反馈率
用户选择“没看懂” -> 可作为解释偏好或补充辅导需求，但不直接扣掌握度
```

## 3. 现状链路

### 3.1 前端

文件：

- `frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`

当前行为：

```ts
rateCoach(interaction, 5) // 点赞
rateCoach(interaction, 2) // 点踩
```

提交接口：

```ts
submitAdaptiveAIFeedback(interaction.id, { rating })
```

当前问题：

- 成功文案“后续会用于调优 AI 解析”偏技术化。
- 点踩没有追问原因，后台只能知道“低分”，不知道为什么低。
- 按钮附近没有说明“不会影响本轮训练”。
- 用户容易误解为它会立即个性化学习。

### 3.2 后端

文件：

- `backend/src/csca-special-practice/ai-coach.service.ts`
- `backend/prisma/schema.prisma`

当前行为：

```ts
await prisma.cscaAIInteractionFeedback.create({
  data: {
    interactionId,
    userId,
    rating,
    reason
  }
})
```

同时写训练事件：

```ts
eventType: 'ai_feedback_submitted'
metadata: {
  interactionId,
  rating,
  interactionType
}
```

当前表：

```prisma
model CscaAIInteractionFeedback {
  id            Int      @id @default(autoincrement())
  interactionId Int      @map("interaction_id")
  userId        Int?     @map("user_id")
  rating        Int
  reason        String?  @db.Text
  createdAt     DateTime @default(now()) @map("created_at")
}
```

当前问题：

- `reason` 是自由文本，但前端没有传结构化原因。
- 没有 `reasonCode`，后台无法稳定聚合“语言不对 / 太啰嗦 / 没讲到错误”。
- 没有幂等约束，同一用户理论上可以对同一 interaction 多次提交反馈。前端会禁用，但后端没有硬保证。

### 3.3 后台观测

文件：

- `backend/src/csca-special-practice/ai-observability.service.ts`
- `frontend/src/pages/AdminAuditPage.tsx`

当前能力：

- 聚合 `feedbackCount`。
- 聚合 `lowFeedbackCount`。
- 计算 `averageRating`。
- `averageRating <= 2` 时产生 `low_feedback` review reason。
- review queue 建议动作是 `sample_output_and_tune_prompt`。

当前问题：

- 管理员只知道低分，不知道低分原因。
- 缺少按原因、语言、interaction type 的问题聚合。
- prompt 调优无法直接定位是“语言不稳定”“解释太短”“公式不清楚”还是“没有讲用户选项为什么错”。

## 4. 目标体验

### 4.1 AI 错因解析卡

按钮保留两个：

- 有用
- 没用

点“有用”后：

```text
已收到反馈，我们会用它检查和改进 AI 解析质量。
```

点“没用”后，不立即只显示完成，而是展开轻量原因：

```text
哪里不对？
[没看懂] [太啰嗦] [语言不对] [没讲到我的错误]
```

用户选一个原因后：

```text
已收到反馈，我们会优先检查这类 AI 解析。
```

如果用户不选原因，也可以关闭或继续答题。点踩本身仍应提交 `rating = 2`，原因作为补充提交或二次更新。

### 4.2 AI 本轮总结卡

同样保留有用/没用，但原因选项不同：

```text
哪里不对？
[建议太泛] [没有对应本轮错误] [语言不对] [下一步不清楚]
```

### 4.3 可访问性

- 图标按钮必须保留 `aria-label` 和 `title`。
- 按钮禁用态要说明“已提交”。
- 键盘可聚焦原因按钮。
- 原因按钮选中后有明确 selected 状态。

## 5. 数据模型方案

### 5.1 最小改造

为了降低迁移风险，第一版可以复用现有 `reason` 字段，存结构化 JSON 字符串或短 code。

不推荐长期这样做，因为后台聚合会依赖字符串解析。

### 5.2 推荐改造

新增字段：

```prisma
model CscaAIInteractionFeedback {
  id            Int      @id @default(autoincrement())
  interactionId Int      @map("interaction_id")
  userId        Int?     @map("user_id")
  rating        Int
  reason        String?  @db.Text
  reasonCode    String?  @map("reason_code") @db.VarChar(80)
  createdAt     DateTime @default(now()) @map("created_at")

  interaction   CscaAIInteraction @relation(fields: [interactionId], references: [id], onDelete: Cascade)

  @@unique([interactionId, userId], map: "uq_csca_ai_feedback_interaction_user")
  @@index([interactionId], map: "idx_csca_ai_feedback_interaction")
  @@index([userId, createdAt], map: "idx_csca_ai_feedback_user_created")
  @@index([reasonCode, createdAt], map: "idx_csca_ai_feedback_reason_created")
  @@map("csca_ai_interaction_feedback")
}
```

注意：

- `userId` 当前是 nullable。PostgreSQL 的 unique 对 null 不去重。登录用户场景有 `userId`，可接受。
- 如果未来支持匿名反馈，应新增 `clientFeedbackKey` 或用 interaction scoped token 做幂等。

### 5.3 结构化原因枚举

错因解析：

```ts
type AiExplanationFeedbackReason =
  | 'unclear'
  | 'too_verbose'
  | 'wrong_language'
  | 'missed_my_mistake'
  | 'math_or_formula_unclear'
  | 'factually_wrong';
```

本轮总结：

```ts
type AiSummaryFeedbackReason =
  | 'too_generic'
  | 'not_grounded_in_round'
  | 'wrong_language'
  | 'next_step_unclear'
  | 'factually_wrong';
```

通用：

```ts
type AiFeedbackReasonCode =
  | AiExplanationFeedbackReason
  | AiSummaryFeedbackReason
  | 'other';
```

## 6. API 方案

### 6.1 请求

现有接口保持不变：

```http
POST /api/v1/csca-special-practice/adaptive/ai-interactions/:id/feedback
```

请求体扩展：

```ts
type SubmitAIFeedbackRequest = {
  rating: 1 | 2 | 3 | 4 | 5;
  reasonCode?: AiFeedbackReasonCode;
  reason?: string;
};
```

第一阶段前端只提交：

```ts
{ rating: 5 }
```

或：

```ts
{ rating: 2, reasonCode: 'wrong_language' }
```

### 6.2 后端校验

规则：

- `rating` 必须是 1 到 5 的整数。
- 点赞只允许 `rating >= 4`，当前按钮使用 5。
- 点踩只允许 `rating <= 2`，当前按钮使用 2。
- `reasonCode` 必须属于白名单。
- `reason` 最长 500 字符。
- 后端使用 upsert，保证同一用户对同一 interaction 只有一条最新反馈。

建议实现：

```ts
await prisma.cscaAIInteractionFeedback.upsert({
  where: {
    interactionId_userId: {
      interactionId,
      userId
    }
  },
  create: { interactionId, userId, rating, reasonCode, reason },
  update: { rating, reasonCode, reason }
});
```

如果 Prisma unique 名称不同，以实际生成类型为准。

### 6.3 响应

```ts
type SubmitAIFeedbackResponse = {
  id: number;
  interactionId: number;
  rating: number;
  reasonCode: string | null;
  createdAt: string;
  updated?: boolean;
};
```

## 7. 后台观测方案

### 7.1 Observability 聚合新增字段

在现有 summary 上增加：

```ts
reasonBreakdown: Array<{
  reasonCode: string;
  count: number;
  lowFeedbackCount: number;
}>;
```

支持维度：

- `type`：`hint` / `explain_wrong_answer` / `round_summary`
- `language`
- `provider`
- `model`
- `promptVersion`
- `reasonCode`

### 7.2 Review Queue 规则

现有：

```ts
averageRating <= 2 -> low_feedback
```

新增：

```ts
reasonCode === 'wrong_language' -> language_quality_issue
reasonCode === 'factually_wrong' -> factual_quality_issue
reasonCode === 'missed_my_mistake' -> explanation_alignment_issue
reasonCode === 'too_generic' -> summary_grounding_issue
```

建议动作：

| reason | suggestedAction |
| --- | --- |
| `wrong_language` | `inspect_language_context_and_prompt` |
| `factually_wrong` | `sample_output_and_compare_standard_answer` |
| `missed_my_mistake` | `tune_wrong_answer_prompt_schema` |
| `too_generic` | `improve_round_summary_grounding` |
| `too_verbose` | `tighten_response_length_guidance` |
| `unclear` | `review_explanation_readability` |

### 7.3 Admin UI

后台 review queue 每条增加：

- 平均评分。
- 最近 reasonCode。
- reasonCode 标签。
- interaction 类型。
- 页面语言 / AI 输出语言。
- 输出预览。

聚合区增加：

- Top 5 低分原因。
- 按语言统计低反馈率。
- 按 interaction type 统计低反馈率。

## 8. 是否影响个人学习

第一阶段：不影响。

原因：

- 用户可能是对 AI 表达不满意，不代表不会知识点。
- 如果把点踩直接接入掌握度，会污染学习数据。
- AI 质量反馈属于内容质量和模型治理，不属于学生能力证据。

第二阶段可以谨慎引入“解释偏好”，但不能直接扣分。

可允许的未来用途：

```text
用户多次选择 unclear -> 后续解释默认更分步骤
用户多次选择 too_verbose -> 后续解释默认更短
用户多次选择 wrong_language -> 提高该用户语言一致性校验优先级
```

不可允许：

```text
用户点踩 -> 降低 mastery
用户点踩 -> 强制增加错题复盘
用户点踩 -> 下一轮直接降低难度
```

## 9. 前端实施任务

### 9.1 类型

文件：

- `frontend/src/lib/api-types.ts`
- `frontend/src/lib/api-special-practice.ts`

新增：

```ts
export type AdaptiveAIFeedbackReasonCode =
  | 'unclear'
  | 'too_verbose'
  | 'wrong_language'
  | 'missed_my_mistake'
  | 'math_or_formula_unclear'
  | 'factually_wrong'
  | 'too_generic'
  | 'not_grounded_in_round'
  | 'next_step_unclear'
  | 'other';
```

扩展：

```ts
submitAdaptiveAIFeedback(interactionId, {
  rating,
  reasonCode,
  reason
})
```

### 9.2 状态

当前：

```ts
type CoachFeedbackState = {
  status: 'submitting' | 'submitted' | 'error';
  rating: number;
}
```

建议：

```ts
type CoachFeedbackState = {
  status: 'idle' | 'submitting' | 'awaiting_reason' | 'submitted' | 'error';
  rating?: number;
  reasonCode?: AdaptiveAIFeedbackReasonCode;
}
```

交互：

- 点赞：提交 `rating = 5`，成功后 `submitted`。
- 点踩：先提交 `rating = 2`，成功后 `awaiting_reason` 并展示原因。
- 选原因：再次提交 `rating = 2, reasonCode`，成功后 `submitted`。

可选更简单版本：

- 点踩不立即提交，先展开原因。
- 选原因后提交。
- 用户不选原因时没有反馈落库。

推荐使用“点踩先落库，再补原因”，因为它不丢失负反馈。

### 9.3 文案

中文：

```text
有用
没用
哪里不对？
没看懂
太啰嗦
语言不对
没讲到我的错误
公式/步骤不清楚
内容有错误
已收到反馈，我们会用它检查和改进 AI 解析质量。
已收到反馈，我们会优先检查这类 AI 解析。
```

英文：

```text
Useful
Not useful
What was wrong?
Unclear
Too verbose
Wrong language
Missed my mistake
Formula or steps unclear
Factually wrong
Feedback received. We use it to review and improve AI explanation quality.
Feedback received. We will prioritize reviewing this type of AI explanation.
```

越南语：

```text
Hữu ích
Chưa hữu ích
Vấn đề là gì?
Chưa rõ
Quá dài dòng
Sai ngôn ngữ
Chưa nói đúng lỗi của tôi
Công thức hoặc bước giải chưa rõ
Nội dung sai
Đã nhận phản hồi. Chúng tôi dùng phản hồi này để kiểm tra và cải thiện chất lượng giải thích AI.
Đã nhận phản hồi. Chúng tôi sẽ ưu tiên kiểm tra loại giải thích AI này.
```

### 9.4 UI

原因按钮建议放在同一卡片内，不开 modal。

结构：

```tsx
<div className="special-ai-feedback-block">
  <div className="special-ai-feedback">
    <GhostButton>thumbs-up</GhostButton>
    <GhostButton>thumbs-down</GhostButton>
  </div>
  {state.status === 'awaiting_reason' && (
    <div className="special-ai-feedback-reasons">
      ...
    </div>
  )}
  <p className="special-ai-feedback-note">...</p>
</div>
```

样式要求：

- 原因按钮使用小 pill。
- 移动端自动换行。
- 不要撑高导致卡片跳动过大；可使用 `gap` 和 `flex-wrap`。
- 不要使用长段解释。

## 10. 后端实施任务

### 10.1 Prisma migration

新增 migration：

```sql
ALTER TABLE csca_ai_interaction_feedback
  ADD COLUMN reason_code VARCHAR(80);

CREATE INDEX idx_csca_ai_feedback_reason_created
  ON csca_ai_interaction_feedback(reason_code, created_at);

CREATE UNIQUE INDEX uq_csca_ai_feedback_interaction_user
  ON csca_ai_interaction_feedback(interaction_id, user_id)
  WHERE user_id IS NOT NULL;
```

如果 Prisma schema 不能表达 partial unique index，用 SQL migration 保留 raw index，并在 schema 不声明该 partial unique。

### 10.2 Service

文件：

- `backend/src/csca-special-practice/ai-coach.service.ts`

新增：

```ts
const AI_FEEDBACK_REASON_CODES = new Set([...]);
```

校验：

```ts
function cleanFeedbackReasonCode(value: unknown) {
  const reasonCode = String(value ?? '').trim();
  return AI_FEEDBACK_REASON_CODES.has(reasonCode) ? reasonCode : null;
}
```

写入：

- 登录用户：按 `interactionId + userId` upsert。
- 保留 `reason` 自由文本，但限制长度。
- training event metadata 增加 `reasonCode`。

### 10.3 Observability

文件：

- `backend/src/csca-special-practice/ai-observability.service.ts`

任务：

- 查询 feedback 时 select `reasonCode`。
- summary 增加 reason breakdown。
- review reason 增加 reasonCode 规则。
- review queue item 返回 latestFeedbackReasonCode。

### 10.4 API 类型

文件：

- `frontend/src/lib/api-types.ts`

更新 `AdaptiveAIFeedback`：

```ts
export type AdaptiveAIFeedback = {
  id: number;
  interactionId: number;
  rating: number;
  reasonCode?: string | null;
  createdAt: string;
};
```

## 11. 测试方案

### 11.1 单元/规则脚本

更新：

- `scripts/csca-adaptive-rules-test.cjs`

覆盖：

1. 提交点赞保存 `rating = 5`。
2. 提交点踩保存 `rating = 2`。
3. 点踩原因保存 `reasonCode = wrong_language`。
4. 非法 reasonCode 被拒绝或清空。
5. 同一用户同一 interaction 重复提交不会生成多条 feedback。
6. `ai_feedback_submitted` event metadata 包含 `reasonCode`。
7. review queue 对 `wrong_language` 产生 `language_quality_issue`。
8. reason breakdown 聚合正确。

### 11.2 Smoke

更新：

- `scripts/csca-adaptive-smoke.cjs`
- `scripts/ai-provider-smoke.cjs`
- `scripts/csca-adaptive-release-smoke.cjs`

覆盖：

- 点赞链路。
- 点踩 + 原因链路。
- 后台 review queue 能看到 low feedback。
- 后台 review queue 能看到 reasonCode。
- admin audit 不受影响。

### 11.3 前端

如已有 e2e 可用，新增或扩展：

```text
subject practice AI feedback explains quality feedback purpose
subject practice thumbs down asks for a reason
subject practice feedback reason is submitted once
```

检查点：

- 点赞后按钮禁用。
- 点踩后出现原因。
- 选原因后出现完成文案。
- 文案不暗示影响下一题或掌握度。

## 12. 验收标准

### 12.1 用户侧

- 用户能明确知道反馈是用于改进 AI 解析质量。
- 点踩后能选择原因。
- 反馈成功后不会出现“影响下一轮训练”之类暗示。
- 中文、英文、越南语文案完整。

### 12.2 数据侧

- 每条 feedback 关联 interaction。
- 同一用户对同一 interaction 最多保留一条当前反馈。
- 低反馈原因可聚合。
- 训练事件记录 rating 和 reasonCode。

### 12.3 后台侧

- admin observability 可看到低反馈率、平均评分、原因分布。
- review queue 能按 `low_feedback` 和具体原因定位样本。
- `wrong_language` 这类问题能被单独识别。

### 12.4 学习算法侧

- 点赞/点踩不改变 mastery。
- 点赞/点踩不改变下一轮出题。
- 点赞/点踩不改变错题复盘状态。
- 只有 AI 质量治理使用该反馈。

## 13. 推荐 PR 拆分

### PR 1：文案和前端原因选择

范围：

- `AdaptivePracticeViews.tsx`
- `api-special-practice.ts`
- `api-types.ts`
- 相关 CSS

不改数据库。

实现：

- 成功文案降预期。
- 点踩后显示原因。
- 暂时把原因写入现有 `reason` 字段，值为 reasonCode。

验收：

- 前端构建通过。
- 手测三语言。

### PR 2：后端结构化 reasonCode

范围：

- Prisma migration。
- `schema.prisma`。
- `ai-coach.service.ts`。
- 规则脚本。

实现：

- 新增 `reasonCode`。
- 后端校验。
- upsert 幂等。
- event metadata 增加 reasonCode。

验收：

- `npm run backend:build`
- `npm run csca-adaptive:rules`
- `npm run csca-adaptive:smoke`

### PR 3：后台观测升级

范围：

- `ai-observability.service.ts`
- `AdminAuditPage.tsx`
- API types。
- release smoke。

实现：

- reason breakdown。
- review reasons 细分。
- admin UI 展示原因。

验收：

- `npm run backend:build`
- `npm run frontend:build`
- `npm run csca-adaptive:release-smoke`
- `npm run ai-provider:smoke`

### PR 4：可选个性化偏好实验

仅在前三个 PR 稳定后做。

范围：

- 不进入 mastery。
- 不进入出题调度。
- 只记录用户解释偏好。

可能字段：

```prisma
model CscaAIExplanationPreference {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  style     String   @db.VarChar(60)
  source    String   @db.VarChar(60)
  weight    Float    @default(1)
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([userId, style], map: "uq_csca_ai_preference_user_style")
}
```

默认不建议进入当前发布范围。

## 14. 执行清单

### 立即执行

- [ ] 改成功文案，避免暗示即时个性化。
- [ ] 点踩后展示原因。
- [ ] 原因先以 `reason` 或 `reasonCode` 传给后端。
- [ ] 更新三语言文案。
- [ ] 前端构建。

### 数据结构执行

- [ ] 新增 `reason_code` 字段。
- [ ] 新增 reason index。
- [ ] 增加用户 interaction 幂等约束。
- [ ] 后端 feedback upsert。
- [ ] 事件 metadata 记录 reasonCode。
- [ ] 后端构建和规则脚本。

### 后台执行

- [ ] Observability 查询 feedback reasonCode。
- [ ] Summary 增加 reason breakdown。
- [ ] Review queue 增加具体 reason。
- [ ] Admin UI 展示原因分布。
- [ ] Release smoke 增加断言。

## 15. 风险与处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| 用户以为点踩会影响训练 | 误解产品能力 | 文案明确“检查和改进 AI 解析质量” |
| 低分原因太多 | 用户不愿选 | 每个场景最多 4-6 个原因 |
| reasonCode 改表影响迁移 | 发布风险 | 先 PR 1 用 reason 字段过渡，再 PR 2 迁移 |
| 点踩被误用为学习能力信号 | 污染 mastery | 明确禁止进入 mastery/出题调度 |
| 后台只看到单条样本 | 难调优 | 增加 reason breakdown 和按语言/type 聚合 |

## 16. 最终目标状态

完成后，这套反馈体系应达到：

- 用户知道点了有什么用。
- 点踩能告诉系统“哪里不好”。
- 后台能按原因聚合 AI 质量问题。
- 低质量 AI 输出能进入 review queue。
- 产品不会把 AI 质量反馈误算成学生能力。
- 将来如果要做个性化解释风格，有干净的数据基础。
