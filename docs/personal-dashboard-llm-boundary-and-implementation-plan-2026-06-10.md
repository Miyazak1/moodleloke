# 个人面板 LLM 边界与规则优先实施方案

日期：2026-06-10  
范围：个人页学习驾驶舱、备考准备度、学习总结、AI 额度、做题训练相关 AI  
状态：产品架构定稿文档；第一轮实施已落地

## 1. 背景

个人页现在承担了两个很不同的目标：

1. 告诉用户自己离“准备成熟”还差多远。
2. 给用户一个下一步可执行动作，例如复盘错题、继续训练、补诊断或做模考。

此前方案里出现了“AI 周报”“AI 学习总结”“自动生成洞察”等表达。用户进一步提出了几个关键问题：

- 这个页面真的需要 LLM 吗？
- 做题相关的 AI 和信息聚合分析的 AI 是否应该分开？
- AI 周报是否应该用户手动点击？
- 聚合分析是否应该免费，而做题相关 AI 才消耗额度？

本文件给出新的结论：个人面板核心不依赖 LLM。个人页需要的是可信、稳定、可解释的数据聚合与规则判断；LLM 只适合作为可选的文案增强层，不能负责计算事实、决定分数或控制训练路径。

## 2. 核心结论

### 2.1 个人面板不应该把 LLM 作为核心依赖

个人面板最重要的问题不是“写一段漂亮总结”，而是把以下事实算准：

- 做了多少题。
- 覆盖了多少知识点。
- 哪些知识点长期没碰。
- 哪些题是在基础、中等、较难或挑战难度下完成的。
- 是否做过完整模考。
- 错题是否只是看过，还是通过同类题验证修复。
- 最近是否保持训练节奏。
- 下一步先做哪个动作最有收益。

这些都更适合由规则引擎、统计聚合和可测试的评分模型完成。让 LLM 参与核心判断会带来三个问题：

- 不稳定：同样的数据可能被写成不同结论。
- 不可审计：用户问“为什么是 30/100”时，不能只回答“AI 觉得”。
- 成本不可控：个人页高频访问，如果每次或经常调用 LLM，会产生没有必要的成本。

因此，个人面板第一原则是：事实、分数、排序和下一步动作都由规则系统生成。

### 2.2 LLM 只能做“表达增强”，不能做“判断来源”

LLM 可以做的事情：

- 把规则已经算出的结论改写成更自然的学习建议。
- 根据固定结构的 dashboard payload 生成每周一段总结。
- 给运营或客服侧生成更易读的解释草稿。

LLM 不能做的事情：

- 直接决定准备度分数。
- 直接决定是否 exam ready。
- 直接写入 mastery、coverage、wrong pattern 等事实数据。
- 直接扣用户额度生成后台总结。
- 在没有规则证据时给确定性结论。

换句话说，LLM 只能“讲述系统已经知道的事”，不能“替系统判断事实”。

### 2.3 做题 AI 和洞察分析必须分账、分域、分权限

需要明确拆成两类能力：

| 类别 | 用户感知 | 是否消耗用户额度 | 是否需要 LLM | 典型功能 |
| --- | --- | --- | --- | --- |
| Practice AI | 做题时向 AI 求助 | 是 | 可以需要 | 提示、错因解析、本轮总结、个性化讲解 |
| Insight System | 系统自动整理学习状态 | 否 | 默认不需要 | 准备度、学习总结、错因聚合、下一步建议 |
| Insight LLM Polish | 系统免费提供的表达增强 | 否 | 可选 | 每周自然语言总结、长期建议润色 |

用户购买的 AI 额度，应只用于用户主动发起的做题辅助能力。个人页的学习分析是产品基础能力，应该免费提供。

## 3. 产品语义调整

### 3.1 不再把个人页主模块叫“AI 周报”

建议替换：

- `AI 周报` -> `本周学习总结`
- `AI 学习总结` -> `学习总结`
- `生成本周 AI 周报` -> `更新学习总结`
- `AI 正在分析` -> `正在整理学习记录`

原因：

- “AI 周报”会让用户以为这是一个可点击生成的 AI 工具。
- 用户更关心“我现在怎么样、下一步做什么”，不是“这是不是 AI 写的”。
- 如果文案强调 AI，后续免费/计费边界会被混淆。

### 3.2 个人页不需要用户点“生成”

个人页应在用户打开时直接展示当前可用的学习总结。这个总结可以是规则实时聚合，也可以是后端缓存的规则快照。

用户不应该为了看到自己的学习情况而点一个“生成报告”按钮。更合理的交互是：

- 默认展示最新总结。
- 如果数据刚变化，显示“完成训练后会自动更新”。
- 如确实需要刷新，按钮叫“刷新学习数据”，并且不涉及 AI 额度。

### 3.3 自动生成也不等于自动调用 LLM

“自动生成学习总结”应理解为：

```text
训练/模考/复盘完成 -> 更新学习快照 -> 规则引擎生成总结结构 -> 个人页读取并展示
```

不应理解为：

```text
训练/模考/复盘完成 -> 自动请求 LLM -> 缓存 AI 周报
```

后者只有在未来明确启用 `Insight LLM Polish` 时才考虑，而且不能消耗用户额度。

## 4. 目标架构

### 4.1 总体分层

```text
学习行为
  -> Learning Events
  -> Daily Snapshot / Streak / Wrong Pattern / Mastery
  -> Evidence Engine
  -> Readiness Engine
  -> Insight Rule Composer
  -> Personal Dashboard
```

可选增强：

```text
Insight Rule Composer
  -> Insight LLM Polish Worker
  -> Polished Learning Summary Cache
```

关键点：

- dashboard 永远可以在没有 LLM 的情况下完整展示。
- LLM polish 失败时，页面仍展示规则总结。
- LLM polish 不写入事实字段，只写入 `summaryText` 和 `actionCopy` 这类表达字段。

### 4.2 Practice AI

Practice AI 是做题过程中的用户主动求助能力。

能力范围：

- `hint`：提示，不直接泄露答案。
- `explain_wrong_answer`：错因解析。
- `round_summary`：本轮训练总结。
- 未来可扩展 `generated_followup_question`，但需要更严格审核。

计费规则：

- 用户主动点击才可扣额度。
- 页面必须在关键入口明确表达“使用 AI 额度”或等价提示。
- provider 失败、schema 不合格、fallback 结果不扣用户额度。
- 自动后台动作不使用 Practice AI 额度。

数据记录：

```ts
type PracticeAIInteraction = {
  type: 'hint' | 'explain_wrong_answer' | 'round_summary';
  billingClass: 'practice_ai';
  trigger: 'user_initiated';
  chargedToUser: boolean;
  entitlementLedgerId: number | null;
  provider: string;
  model: string | null;
  status: 'success' | 'fallback' | 'failed' | 'rejected';
};
```

### 4.3 Insight System

Insight System 是个人页和学习驾驶舱的基础能力。

能力范围：

- 学习热力图。
- 学习统计。
- 准备度分数。
- 知识覆盖。
- 难度掌握。
- 模考稳定。
- 错因复盘状态。
- 下一步建议。
- 本周学习总结。

计费规则：

- 不扣用户 AI 额度。
- 不显示为付费 AI 能力。
- 不依赖外部 LLM。

数据记录：

```ts
type LearningInsightSnapshot = {
  userId: number;
  periodType: 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  source: 'rule_engine';
  summary: string;
  actions: string[];
  evidence: {
    answeredCount: number;
    activeDays: number;
    weakestSubject: string | null;
    dueReviewCount: number;
    latestMockScore: number | null;
  };
  generatedAt: Date;
};
```

### 4.4 Insight LLM Polish

这是未来可选能力，不是当前个人页上线前置条件。

能力范围：

- 把规则总结润色成更自然的语言。
- 保持固定结构，不新增事实。
- 可用于每周缓存，不用于每次打开页面。

计费规则：

- 平台成本，不扣用户额度。
- 需要服务端预算、频控和开关。
- 默认关闭，只有 `CSCA_INSIGHT_LLM_ENABLED=true` 时启用。

输入要求：

LLM 只能收到规则系统产出的结构化 facts，例如：

```json
{
  "summaryFacts": {
    "answeredThisWeek": 25,
    "accuracy": 64,
    "activeDays": 3,
    "weakestSubject": "math",
    "dueReviewCount": 4
  },
  "allowedClaims": [
    "本周完成 25 题",
    "数学是当前优先处理科目",
    "有 4 个错因需要复盘"
  ],
  "recommendedActions": [
    "先复盘到期错因",
    "完成一轮数学训练"
  ]
}
```

输出要求：

```ts
type PolishedInsightOutput = {
  summary: string;
  actions: string[];
};
```

校验规则：

- 不得出现输入 facts 之外的新数字。
- 不得承诺考试结果。
- 不得把准备度说成模考分。
- 不得出现“AI 判断你一定/肯定”等确定性表达。
- 输出不合格时丢弃，继续展示规则总结。

## 5. 个人页学习总结如何工作

### 5.1 页面打开时

前端调用：

```text
GET /api/v1/me/learning-dashboard
```

后端返回：

- summary
- readiness
- heatmap
- trend
- subjects
- wrongPatterns
- mockTrend
- learningSummary

其中 `learningSummary` 默认由规则生成：

```ts
type LearningSummary = {
  source: 'rule_engine' | 'llm_polished';
  status: 'ready' | 'insufficient_data';
  title: string;
  body: string;
  actions: Array<{
    label: string;
    href: string;
    reason: string;
  }>;
  generatedAt: string;
};
```

如果没有足够学习记录，返回温和空状态：

```text
完成一次诊断或一轮训练后，这里会自动整理你的学习情况。
```

### 5.2 完成训练后

流程：

```text
提交 adaptive round
  -> 写 round / round items
  -> 更新 mastery
  -> 更新 wrong patterns
  -> 更新 learning daily snapshot
  -> 更新 streak
  -> 下次 dashboard 请求时规则总结自然变化
```

不需要自动调用 LLM。

### 5.3 完成模考后

流程：

```text
提交 mock exam
  -> 写 mock attempt
  -> 更新 learning snapshot
  -> 更新 mock trend
  -> readiness mock 维度变化
  -> next action 可能指向薄弱科目训练
```

不需要自动调用 LLM。

### 5.4 完成错题复盘后

流程：

```text
用户点击“已看懂，去验证”
  -> 标记 reviewed / improving
  -> 跳转同 topic 验证训练
  -> 验证训练正确后推进 verified / resolved
  -> readiness review 维度变化
```

不需要自动调用 LLM。

## 6. 技术实施方案

### Phase 1：文案与产品语义收口

目标：先消除“个人页依赖 AI”或“会扣额度”的误解。

任务：

1. 前端个人页把 `AI 周报 / AI 学习总结` 改为 `学习总结 / 本周学习总结`。
2. 按钮从 `生成本周 AI 周报` 改为 `更新学习总结` 或移除。
3. 准备度说明继续强调：这不是模考分，是基于题量、覆盖、难度、模考、复盘和节奏的估算。
4. AI 服务页文案明确：额度用于做题时的 AI 提示、解析和训练总结，不用于个人页学习分析。
5. docs 中旧的“AI 周报自动生成”全部标注为历史方案，新的方向为规则总结。

验收：

- 个人页学生侧不出现“生成 AI 周报”主按钮。
- 用户不会以为查看学习总结会消耗 AI 额度。
- `AI 额度` 页面不把个人面板分析列为收费项。

### Phase 2：后端 API 字段去 AI 化

目标：保持兼容，但新增更准确的字段。

建议做法：

1. 保留现有 `aiInsight` 字段短期兼容前端。
2. 新增 `learningSummary` 字段，内容与规则总结一致。
3. 前端改读 `learningSummary`，`aiInsight` 进入 deprecated 状态。
4. `POST /learning-dashboard/insights/weekly` 暂时保留，但改名或降级为内部兼容，不再作为学生主入口。
5. `prepareWeeklyInsightAfterActivity` 保持不调用 LLM。

目标返回：

```ts
type LearningDashboardResponse = {
  learningSummary: LearningSummary;
  aiInsight?: DeprecatedAiInsight;
};
```

验收：

- 打开个人页不会创建 `CscaAIInteraction`。
- 完成训练后不会自动扣用户 AI 额度。
- 规则测试覆盖：dashboard 有规则总结；provider 开启时个人页打开也不调用 provider。

### Phase 3：Insight Rule Composer

目标：把学习总结从零散 copy 收口成可测试规则。

新增或整理服务：

```ts
LearningSummaryComposer
  compose(input: LearningDashboardFacts, language): LearningSummary
  pickMainProblem(facts): SummaryProblem
  pickPrimaryAction(facts): SummaryAction
  buildPlainLanguageSummary(problem, evidence): string
```

输入 facts 来自 dashboard 已有聚合：

- readiness stage / score / blockers
- totalAnswered
- activeDaysLast30
- weakTopics
- wrongPatterns due count
- mockTrend
- subject mastery

优先级建议：

1. 到期复盘或待验证错因。
2. 缺诊断或缺覆盖。
3. 中高难独立样本不足。
4. 模考缺失或模考节奏风险。
5. 某一学科明显薄弱。
6. 节奏不足。
7. 进入保持训练。

验收：

- 每种主要状态都有稳定 summary 和 action。
- 输出不出现内部词：`LLM`、`AI 周报`、`evidence sufficiency`、`calibration`、`topic signal`。
- 多语言 copy 走同一规则，不在页面组件里堆判断。

### Phase 4：Practice AI 计费边界加固

目标：确保只有做题辅助 AI 消耗额度。

任务：

1. 给 AI interaction 增加或在 metadata 中明确：
   - `billingClass: practice_ai | insight_system | insight_llm_polish`
   - `trigger: user_initiated | system_scheduled | admin_triggered`
   - `chargedToUser: boolean`
2. `AIEntitlementService.reserve` 只允许 `practice_ai` 且 `user_initiated` 的能力扣用户额度。
3. `weekly_learning_summary` 如果保留，必须归入 `insight_llm_polish`，默认不扣用户额度。
4. 后台 observability 按 billingClass 分组展示成本。

验收：

- hint / explanation / round_summary 用户点击时可扣额度。
- dashboard / readiness / learning summary 不扣额度。
- 自动任务不扣用户额度。
- provider fallback 不扣额度。

### Phase 5：可选 LLM Polish

目标：在规则总结稳定后，再决定是否接入免费 LLM 润色。

启用条件：

- `CSCA_INSIGHT_LLM_ENABLED=true`
- 已有规则总结。
- 用户本周有足够学习事实。
- 本周没有成功缓存过 polish。
- 平台预算未超限。

执行方式：

- 定时任务或关键行为后 best-effort 触发。
- 写入 `CscaLearningInsight`，source 标记为 `llm_polished`。
- 失败不影响 dashboard。
- 不扣用户额度。

验收：

- 关闭开关时，个人页 100% 可用。
- 开启开关时，LLM 输出只能润色，不改变 action href、score 或事实数字。
- 输出校验失败时丢弃，不展示坏总结。

## 7. 数据与表结构建议

### 7.1 短期不必新增表

当前已有：

- `CscaLearningDailySnapshot`
- `CscaLearningStreak`
- `CscaLearningInsight`
- `CscaWrongPattern`
- `CscaAIInteraction`
- `CscaAIUsageLedger`

短期可以通过 metadata 和 source 字段区分规则总结与 LLM polish，不急于新增表。

### 7.2 建议字段语义

`CscaLearningInsight` 建议使用：

```text
provider = null
model = null
status = success
metadata.source = rule_engine
metadata.billingClass = insight_system
metadata.chargedToUser = false
```

如果未来 LLM polish：

```text
provider = openai
model = ...
status = success
metadata.source = llm_polished
metadata.billingClass = insight_llm_polish
metadata.chargedToUser = false
metadata.baseRuleSummaryHash = ...
```

### 7.3 AI 用量账本

用户额度账本只记录用户付费/赠送额度的收支。

平台免费的 insight polish 成本可以记录在 `CscaAIInteraction` 或运营成本表，但不进入用户 `CscaAIUsageLedger` 的扣减。

如果需要观察平台成本，可在 interaction metadata 记录：

```json
{
  "billingClass": "insight_llm_polish",
  "chargedToUser": false,
  "costOwner": "platform",
  "meteringMode": "provider_usage"
}
```

## 8. 前端交互方案

### 8.1 个人页首屏

建议首屏主叙事：

```text
需要集中补弱
当前最大问题不是继续刷题数量，而是先处理到期复盘和高频错因。
```

右侧分数卡：

```text
30/100
这不是模考分。系统会综合做题、知识覆盖、难度、模考和复盘，估算你离稳定上考场还有多远。
```

主按钮根据 primary action：

- `去复盘`
- `开始诊断`
- `补知识点`
- `开始一轮训练`
- `去模考`

不固定叫 `继续训练`。

### 8.2 学习总结卡

标题：

```text
本周学习总结
```

状态：

- 有数据：展示规则总结。
- 数据不足：引导完成诊断或一轮训练。
- 加载失败：学习数据暂时无法加载。

不展示：

- `AI 生成中`
- `消耗 1 次 AI`
- `生成 AI 周报`

### 8.3 AI 服务页

说明：

```text
AI 额度用于做题时的提示、错因解析和训练总结。个人页的学习统计、准备度和学习总结不会消耗额度。
```

这样用户能理解：

- 做题时主动叫 AI，是付费/额度能力。
- 看自己的学习状态，是产品基础能力。

## 9. 测试计划

### 9.1 后端规则测试

新增或更新：

- `dashboard_summary_is_rule_generated_without_provider`
- `dashboard_open_does_not_create_ai_interaction`
- `learning_activity_does_not_charge_ai_credits`
- `practice_hint_user_click_charges_credit`
- `provider_failure_refunds_practice_credit`
- `insight_polish_when_enabled_does_not_charge_user`

### 9.2 前端测试

覆盖：

- 个人页无 AI provider 时仍显示学习总结。
- 学习总结卡不出现 `AI 周报` 旧文案。
- AI 额度页说明个人页分析不扣额度。
- primary action 文案与 href 一致，例如 `去复盘` 必须跳到错题复盘筛选。

### 9.3 浏览器验证

视口：

- 390x844
- 768x1024
- 1440x900

路径：

- 无学习记录用户。
- 有训练但无模考用户。
- 有到期复盘用户。
- 完成模考后用户。
- AI 额度不足用户。

验收：

- 个人页没有让用户以为必须点击 AI 生成。
- 主按钮可点击且落到正确任务。
- 文案不溢出，不出现内部术语。

## 10. 与现有代码的落点

### 10.1 后端

主要涉及：

- `backend/src/csca-learning/csca-learning.service.ts`
- `backend/src/csca-learning/csca-learning.types.ts`
- `backend/src/me/me.controller.ts`
- `backend/src/me/me.service.ts`
- `backend/src/csca-special-practice/ai-entitlement.service.ts`
- `backend/src/csca-special-practice/ai-coach.service.ts`

优先改动：

1. `generateWeeklyInsight` 不作为个人页主路径。
2. `aiInsightFor` 或等价逻辑改名/迁移为 `learningSummaryFor`。
3. `weeklyFallbackOutput` 改成正式规则总结，不再叫 fallback。
4. 额度服务只对 practice AI 扣用户额度。

### 10.2 前端

主要涉及：

- `frontend/src/pages/PublicMePage.tsx`
- `frontend/src/lib/api-me.ts`
- `frontend/src/lib/api-types.ts`
- `frontend/src/pages/AIServicePage.tsx`

优先改动：

1. 个人页学习总结去 AI 化。
2. 主按钮按 readiness primary action 渲染，不固定“继续训练”。
3. AI 服务页补充额度边界说明。
4. 移除或弱化“生成 AI 周报”入口。

### 10.3 文档

需要同步：

- `docs/ai-branch-architecture-review-2026-06-10.md`
- `docs/student-learning-dashboard-design.md`
- `docs/readiness-copy-guidelines.md`

建议在旧文档中追加变更说明，不删除历史记录。

## 11. 直接执行清单

### PR A：个人页文案与字段兼容

范围：

- 前端个人页 copy。
- API type 新增 `learningSummary`。
- 后端 dashboard 返回规则总结。

验收命令：

```text
npm --prefix frontend run build
npm exec tsc -- -p tsconfig.json --pretty false --noEmit
npm run csca-learning:rules
```

### PR B：规则总结 composer

范围：

- 新增 `LearningSummaryComposer` 或在 learning service 内先抽私有方法。
- 覆盖主要 readiness 状态。
- 测试 dashboard summary。

验收命令：

```text
npm run csca-learning:rules
npm exec tsc -- -p tsconfig.json --pretty false --noEmit
```

### PR C：AI 额度边界

范围：

- AI interaction metadata 加 billingClass。
- entitlement reserve 限制为 practice AI。
- weekly/learning insight 不扣用户额度。
- AI 服务页说明更新。

验收命令：

```text
npm run csca-adaptive:rules
npm run csca-learning:rules
npm --prefix frontend run build
```

### PR D：旧 AI 周报入口收口

范围：

- 移除学生侧“生成 AI 周报”主入口，或改为“刷新学习数据”。
- `POST /learning-dashboard/insights/weekly` 标记 deprecated 或转为内部兼容。
- docs 追加历史方案说明。

验收：

- 浏览器确认个人页没有 AI 周报按钮。
- 打开个人页不会触发 provider。
- 完成训练后不会自动触发 provider。

### PR E：可选 LLM Polish

范围：

- 仅在需要时实施。
- feature flag 默认关闭。
- 平台成本，不扣用户额度。
- 严格 schema 和 fact 校验。

验收：

- 关闭 flag 时所有测试通过。
- 开启 flag 时失败可降级。
- polish 不改变分数、href、事实数字。

## 12. 最终判断

个人页真的不需要 LLM 才能成立。它需要的是一个可信的数据产品：

- 事实由学习记录产生。
- 分数由证据引擎计算。
- 下一步由规则和历史效果排序。
- 文案用人能理解的语言表达。

LLM 的合理位置是“锦上添花的表达层”，而不是“驱动个人面板的大脑”。当前最成熟、成本最低、用户最容易信任的路线，是先把个人面板完全做成规则优先、免费可用、可解释可测试的学习驾驶舱；等规则稳定后，再考虑是否用平台免费的 LLM polish 提升文字质感。

## 13. 2026-06-10 第一轮执行记录

已完成：

1. 后端 dashboard 新增 `learningSummary` 字段，个人页可直接读取规则学习总结。
2. 保留旧 `aiInsight` 字段作为兼容层，避免旧调用立即断裂。
3. `POST /api/v1/me/learning-dashboard/insights/weekly` 降级为兼容端点：只返回当前 dashboard 规则总结，不再调用外部 provider，不再 reserve/commit 用户 AI 额度。
4. `CscaLearningModule` 不再 provider AI entitlement、provider、usage meter；学习驾驶舱不再从架构上依赖做题 AI 服务。
5. 个人页学习总结文案从“本周 AI 学习总结 / 生成本周 AI 周报”改为“本周学习总结 / 系统整理”，并移除学生侧生成按钮。
6. 个人页和 AI 服务页文案明确：额度只用于做题时主动使用的 AI Coach 提示、错因解析和本轮总结；个人页学习分析不扣额度。
7. 规则测试新增 `learningSummary` 断言，并验证兼容端点不调用 provider、不扣用户额度。

验证：

```text
npm run csca-learning:rules
npm exec tsc -- -p tsconfig.json --pretty false --noEmit
npm --prefix frontend run build
npm run csca-adaptive:rules
```

后续建议：

1. 第二轮把 `LearningAIInsight` 组件和 CSS class 重命名为 `LearningSummary`，清理内部命名债。
2. 将 `aiInsight` 标记为 deprecated，并在前端完全稳定读取 `learningSummary` 后再移除旧字段。
3. 如未来启用 LLM polish，必须走平台免费开关和输出校验，不进入用户 AI 额度账本。
