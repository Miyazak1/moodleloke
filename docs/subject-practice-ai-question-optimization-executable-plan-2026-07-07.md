# 科目训练 AI 出题优化可执行方案

> 日期：2026-07-07  
> 状态：执行级方案  
> 适用范围：AI 题库后台、科目训练/专项题库、AI 生成/审题/修复队列、真题画像消费、数学符号渲染  
> 前置文档：
> - `docs/ai-question-bank-dual-line-executable-plan-2026-07-07.md`
> - `docs/subject-training-ai-generation-closed-loop-plan-2026-07-07.md`
> - `docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`
> - `docs/subject-training-profile-adaptation-implementation-spec-2026-07-03.md`

## 1. 一句话目标

在线模考线已经基本进入“按 48 个题位补齐合格题”的闭环；下一阶段科目训练线也要从“生成候选题”升级为“按知识点缺口自动补齐合格训练题”。

最终状态：

```text
大纲基线 + 真题画像
-> 科目训练缺题画像
-> 自动生成/原题修复/重生
-> 门禁通过
-> 自动进入专项/科目训练正式题库
-> 达标后停止
-> 不合格题进入待治理候选
```

核心判断口径：

```text
候选题数量不是成功。
门禁通过并进入科目训练正式题库的题数，才是成功。
```

## 2. 当前判断

### 2.1 在线模考线

在线模考线已经形成了较清晰的路径：

```text
真题画像
-> 整卷蓝图
-> 48 个题位
-> 自动生成 / 修复 / 重生
-> 每个题位 1 道门禁通过题
-> 48/48 后进入在线模考题库
-> 装配草稿卷
```

仍需继续收口的问题：

- 当前卷、当前蓝图、当前题位必须严格过滤。
- 装配后题目状态必须从“待装配”变为“已装配/草稿卷关联”。
- 清理功能必须能按卷清理。

### 2.2 科目训练线

科目训练线现在的问题更关键：

- 容易出现候选题不断增加，但合格题为 0。
- 对 `needs_edit`、`human_review`、`review_failed` 的处理更偏重新生成，而不是先修复可修问题。
- 有些题明明是选项、答案、解析、英文版本、LaTeX 的局部问题，却被当成整题失败。
- topic/gap 的完成标准不够清楚，前端也不容易看出还差几道正式可训练题。
- 科目题与模考题虽然已经开始分叉，但候选、已审核资产、清理、统计仍要继续强隔离。

因此本方案重点不是降低门禁，而是提升闭环能力：

```text
更准确的目标画像
更强的原题修复
更严格的自动入库条件
更清楚的前端状态
更可控的清理和重测
```

## 3. 不变的架构原则

### 3.1 共用上游

大纲和真题画像是共用准备层：

```text
1 大纲基线
  - 学科 topic
  - syllabusVersion
  - 出题边界

2 真题画像
  - questionForm
  - cognitiveSkill
  - difficultyBand
  - readingLoad
  - calculationLoad
  - distractorTypes
  - commonMisconceptions
  - estimatedTimeSeconds
```

### 3.2 分叉后独立治理

从 AI 出题开始，科目训练和在线模考必须分开：

```text
科目训练线：
  topic / gap -> candidate -> gate -> subject practice bank

在线模考线：
  mock blueprint / slot -> candidate -> gate -> mock exam pool -> draft paper
```

禁止：

- 科目训练候选被在线模考统计。
- 在线模考候选被科目训练统计。
- 卷 1 候选显示到卷 2。
- 已入库题继续混在“待治理候选”里。

## 4. 科目训练完成标准

### 4.1 Topic 级

一个 topic 的完成条件：

```text
approvedPracticeCount >= targetPracticeCount
```

建议结构：

```ts
type SubjectTopicReadiness = {
  subject: 'math' | 'physics' | 'chemistry';
  topicId: number;
  topicCode?: string;
  topicTitle: string;
  syllabusVersion: string;
  targetPracticeCount: number;
  approvedPracticeCount: number;
  openGapCount: number;
  pendingCandidateCount: number;
  repairableCandidateCount: number;
  blockedCandidateCount: number;
  status:
    | 'missing_syllabus'
    | 'missing_blueprint'
    | 'needs_generation'
    | 'generating'
    | 'repairing'
    | 'ready'
    | 'blocked';
};
```

### 4.2 Gap 级

topic 内部要按缺题画像补齐，而不是只凑数量。

```ts
type SubjectPracticeGap = {
  gapKey: string;
  topicId: number;
  targetProfile: {
    difficultyBand: 'basic' | 'medium' | 'hard';
    questionForm: string;
    cognitiveSkill: string;
    readingLoad: 'low' | 'medium' | 'high';
    calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  };
  neededCount: number;
  approvedCount: number;
  queuedCount: number;
  runningCount: number;
  repairableCount: number;
  abnormalCandidateCount: number;
  status: 'open' | 'running' | 'fulfilled' | 'blocked';
};
```

一个 gap 的完成条件：

```text
approvedCount >= neededCount
```

### 4.3 不能算完成的题

以下题不计入 `approvedPracticeCount`：

- 未入库候选。
- `pending_review`。
- `review_failed`。
- `needs_edit`。
- `human_review`。
- `fallback`。
- `rejected`。
- `archived`。
- 在线模考候选。
- 旧 legacy 数据中无法判定 useCase 的题。

## 5. 数据边界

### 5.1 每道 AI 题必须有业务线归属

```ts
type AIQuestionUseCase =
  | 'subject_practice'
  | 'online_mock_exam'
  | 'legacy';
```

建议统一存入 `generationMetadata`：

```ts
type AIQuestionScopeMetadata = {
  targetUseCase: 'subject_practice' | 'online_mock_exam' | 'legacy';
  intendedUse: 'subject_practice' | 'mock_candidate';
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;

  topicId?: number;
  topicCode?: string;
  gapKey?: string;

  mockSourcePaperId?: number;
  mockBlueprintId?: number;
  mockBlueprintSlotId?: number;
  mockSlotNumber?: number;

  generationMode:
    | 'subject_gap_fulfillment'
    | 'subject_candidate_repair'
    | 'subject_candidate_regenerate'
    | 'subject_expansion'
    | 'online_mock_slot_fulfillment'
    | 'online_mock_candidate_repair'
    | 'online_mock_candidate_regenerate';
};
```

### 5.2 查询必须强过滤

所有后台查询必须带 scope：

```ts
type AIQuestionQueryScope = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject?: string;
  topicId?: number;
  mockSourcePaperId?: number;
  mockBlueprintId?: number;
  mockBlueprintSlotId?: number;
};
```

规则：

- 科目训练线没有 `subject` 时，只能显示汇总，不能加载全局候选。
- 在线模考线没有 `mockBlueprintId` 时，候选列表返回空并提示先选择卷/蓝图。
- 切换学科、卷、蓝图、topic 时，前端必须清空旧列表再加载。

### 5.3 旧数据处理

开发阶段不需要长期兼容旧架构，但线上不能崩。

最低策略：

- 缺 `targetUseCase` 的题标为 `legacy`。
- `legacy` 不参与自动补齐统计。
- 旧已发布题继续能被用户训练使用。
- 旧题不自动算作“画像增强合格题”。
- 后台提供清理/归档 legacy 的入口。

## 6. 门禁标准

### 6.1 自动入科目训练题库条件

一题必须同时满足：

1. `targetUseCase = subject_practice`。
2. `intendedUse = subject_practice`。
3. `status = approved` 或复审结果等价通过。
4. `reviewMetadata.gate.publishable = true`。
5. 不是 fallback。
6. 不是 smoke/test 数据。
7. topic 与 syllabus 匹配。
8. questionForm / cognitiveSkill / readingLoad / calculationLoad 不与目标画像明显冲突。
9. 题干、选项、唯一答案、解析完整。
10. 选项没有多个正确答案。
11. 解析和答案一致。
12. 不超纲。
13. 与真题和已入库题不高度相似。
14. 如果系统要求双语，中文和英文题干、选项、解析都完整。
15. 数学符号可渲染。

### 6.2 自动进入待治理候选条件

以下题进入待治理候选，不入库：

- `review_failed`
- `needs_edit`
- `human_review`
- `regenerate`
- `fallback`
- `blocked`
- 缺英文版本
- LaTeX 结构不可渲染
- topic mismatch
- similarity risk

### 6.3 不降低门禁

本方案不建议用“放宽门禁”解决通过率问题。

正确方向是：

```text
门禁保持严格
-> 可修复问题自动修复
-> 硬伤重生
-> 连续无进展阻塞并展示原因
```

## 7. 失败分流：修复优先，不盲目重生

### 7.1 可原题修复

这些问题优先修复原题：

- 正确答案标注错误。
- 多个正确答案，但可以通过调整选项消歧。
- 选项过近、重复、过弱。
- 干扰项没有对应错因。
- 解析缺关键步骤。
- 解析与答案不一致。
- 英文版本缺失。
- 双语 metadata 缺失。
- LaTeX 轻微格式错误。
- 难度轻微偏差。
- readingLoad / calculationLoad 轻微偏差。
- reviewer 给出 `human_review`，但原因是软警告。

修复要求：

- 保留 topic、targetProfile、题目核心能力点。
- 修复后必须重新 validator + reviewer。
- 修复通过后自动入库。
- 单题最多自动修复 2 次。

### 7.2 必须重生

这些问题不修原题，直接重生：

- 超纲。
- topic mismatch。
- mock slot mismatch。
- 与真题高度相似。
- 与已入库题高度相似。
- 题干逻辑不成立。
- 题型与目标画像完全不符。
- 难度严重偏离，修复会改变题目核心。
- provider 返回结构损坏。
- 数学表达不可恢复。

### 7.3 阈值

建议配置：

```ts
const SUBJECT_REPAIR_MAX_ATTEMPTS_PER_CANDIDATE = 2;
const SUBJECT_REGENERATE_MAX_ATTEMPTS_PER_GAP = 20;
const SUBJECT_NO_PROGRESS_BLOCK_THRESHOLD = 10;
```

含义：

- 单题最多修复 2 次。
- 单个 gap 最多连续重生 20 次。
- 连续 10 次没有新增合格题后，停止自动生成并进入 `blocked`。

## 8. 后端改造任务

### 8.1 Scope normalizer

目标：所有业务线判断集中到一个地方。

建议位置：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- 后续可抽到 `backend/src/ai-questioning/question-scope.ts`

需要导出：

```ts
normalizeQuestionUseCase(question): AIQuestionUseCase
isSubjectPracticeQuestion(question): boolean
isOnlineMockExamQuestion(question): boolean
buildQuestionScopeWhere(scope): Prisma.CscaQuestionWhereInput
```

验收：

- 科目训练候选列表不显示模考题。
- 在线模考候选列表不显示科目题。
- 卷 2 不显示卷 1 的候选。
- 缺 scope 的旧题不参与新闭环统计。

### 8.2 Topic gap 计算

目标：从“缺候选”变成“缺合格训练题”。

涉及：

- `deriveTopicQuestionGap`
- `topicQuestionBankHealth`
- `targetProfileFromStyleProfile`
- `source-question-profile-normalizer.ts`

要求：

1. `approvedPracticeCount` 从正式科目/专项题库映射统计。
2. `candidateCount` 只作为过程指标。
3. gap 维度包含 `difficultyBand/questionForm/cognitiveSkill/readingLoad/calculationLoad`。
4. 有真题画像时，`cognitiveSkill = unknown` 不能大量成为目标。
5. 没有画像时，前端显示 `syllabus-only` 或 `缺真题画像`，不能误报缺大纲。

验收：

- 数学有画像时，gap 中有明确 cognitiveSkill。
- 化学/物理若无真题画像，错误原因不写“缺大纲”。

### 8.3 科目训练补齐 job

建议结构：

```ts
type SubjectPracticeFulfillmentJob = {
  id: number;
  subject: string;
  topicId: number;
  gapKey: string;
  targetApprovedCount: number;
  approvedCount: number;
  generatedCount: number;
  repairedCount: number;
  regeneratedCount: number;
  failedCount: number;
  noProgressCount: number;
  status: 'queued' | 'running' | 'repairing' | 'completed' | 'blocked' | 'failed';
};
```

可以先复用现有生成任务表，但 metadata 必须表达这些字段。

核心循环：

```ts
while (approvedCount < targetApprovedCount) {
  const candidate = await generateOrRepairNextCandidate(scope);
  const review = await reviewCandidate(candidate);

  if (review.gate.publishable) {
    await publishToSubjectPracticeBank(candidate.id);
    approvedCount += 1;
    noProgressCount = 0;
    continue;
  }

  const strategy = decideSubjectPracticeRepairStrategy(review);

  if (strategy === 'repair_in_place' && repairAttempt < maxRepairAttempts) {
    await enqueueSubjectPracticeRepair(candidate.id, review.repairFeedback);
    continue;
  }

  await enqueueSubjectPracticeRegenerate(scope);
  noProgressCount += 1;

  if (noProgressCount >= noProgressThreshold) {
    await markSubjectPracticeGapBlocked(scope, review.reasons);
    break;
  }
}
```

完成条件：

```text
approvedCount >= targetApprovedCount
```

不是：

```text
generatedCount >= targetCount
```

### 8.4 自动入科目训练题库

新增或收敛：

```ts
publishToSubjectPracticeBank(questionId, context)
```

要求：

- 幂等。
- 校验 useCase。
- 校验 gate。
- 校验双语。
- 校验数学符号。
- 写专项/科目训练映射。
- 写审计日志。
- 更新 topic/gap 进度。

验收：

- 同一道题重复 publish 不会重复入库。
- 门禁通过题自动进入“已审核科目资产”。
- 用户侧科目训练能抽到新题。

### 8.5 修复服务

新增或收敛：

```ts
decideSubjectPracticeRepairStrategy(review): 'repair_in_place' | 'hard_regenerate' | 'manual_review'
repairSubjectPracticeCandidate(questionId, repairFeedback)
```

Reviewer 需要输出：

```ts
type RepairFeedback = {
  repairable: boolean;
  reasonCodes: string[];
  fieldsToRepair: Array<
    | 'prompt'
    | 'options'
    | 'correctAnswer'
    | 'explanation'
    | 'localization'
    | 'metadata'
    | 'mathText'
  >;
  instructions: string[];
};
```

验收：

- 多答案优先修复选项。
- 缺英文优先补英文。
- LaTeX 轻微错误优先修复表达。
- topic mismatch 直接重生。

### 8.6 双语门禁

自动入库前必须检查：

```ts
generationMetadata.localizations.zh
generationMetadata.localizations.en
```

或当前项目实际存储中的等价字段。

规则：

- 缺英文：`repair_in_place`。
- 缺中文：`repair_in_place`。
- 双语都缺：`hard_regenerate` 或 `blocked`。

验收：

- 已审核科目资产不再出现“没有双语 metadata”的题。
- 候选治理能看到“缺英文，已进入自动修复”。

### 8.7 数学符号规范化

后端新增：

```ts
normalizeMathText(input: string): string
validateMathText(input: string): MathValidationResult
```

处理范围：

- prompt。
- options。
- explanation。
- zh/en localization。

典型修复：

- 裸 `\frac` 自动包裹。
- 裸 `\sqrt` 自动包裹。
- `\\(`、`\\frac` 这类双转义污染。
- Markdown 和 LaTeX 混排造成的不可渲染。
- 长公式拆行。

不可修复时进入：

```text
needs_edit -> repair_in_place
```

或：

```text
regenerate
```

验收：

- 后台候选、已审核资产、用户侧科目训练、在线模考都不显示裸 LaTeX。
- 解析区根号、数字、上下标不重叠。

### 8.8 清理 API

统一清理入口：

```text
POST /api/v1/admin/ai-questioning/cleanup
```

请求：

```ts
type CleanupRequest = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject?: string;
  topicId?: number;
  mockSourcePaperId?: number;
  mockBlueprintId?: number;
  includeCandidates?: boolean;
  includeJobs?: boolean;
  includeApprovedAssets?: boolean;
  includeDraftPapers?: boolean;
  confirmText?: string;
};
```

安全规则：

- 默认只清未入库候选和任务。
- 清已入库资产必须二次确认。
- 在线模考清理必须带 `mockBlueprintId`。
- 科目训练清理至少带 `subject`，建议带 `topicId`。
- 所有清理写审计日志。

验收：

- 清数学某 topic 不影响在线模考。
- 清数学卷 1 不影响数学卷 2。
- 清理后可以重新生成测试。

## 9. 前端改造任务

### 9.1 信息架构

AI 题库后台保持三段：

```text
1 共用准备
  - 大纲基线
  - 真题画像

2 科目训练线
  - 知识点题库健康
  - 缺题画像
  - 自动补齐合格训练题
  - 待治理候选
  - 已审核科目资产
  - 质量治理

3 在线模考线
  - 来源卷
  - 整卷蓝图
  - 题位
  - 自动补齐 48/48
  - 待治理候选
  - 已审核模考资产
  - 草稿卷装配
```

### 9.2 科目训练主面板

涉及：

- `frontend/src/components/admin/ai-question-bank/CoverageWorkPanel.tsx`
- `frontend/src/pages/AdminAIQuestionBankPage.tsx`

主按钮文案：

- `补齐合格训练题`
- `按缺题画像补齐`
- `处理可修复候选`
- `清理当前知识点 AI 结果`

避免把主动作写成：

- `追加候选`
- `生成候选`

topic 行必须显示：

```text
目标合格题：6
已入库：4
还差：2
待修复：1
阻塞：0
最近问题：缺英文版本 / 选项多答案 / topic mismatch
```

### 9.3 候选治理面板

涉及：

- `CandidateReviewPanel.tsx`
- `candidateReviewHelpers.ts`

标题：

```text
科目训练 AI 候选治理与兜底
```

说明：

```text
这里仅展示未入库的异常候选，用于查看失败原因、复审、编辑、拒绝或归档；门禁通过题会自动进入已审核科目资产。
```

列表默认展示：

- `review_failed`
- `needs_edit`
- `human_review`
- `fallback`
- `blocked`

不展示：

- 已自动入库题。
- 已装配模考题。
- 当前 scope 外的题。

### 9.4 已审核资产面板

涉及：

- `PublishedQuestionPanel.tsx`
- `LedgerPanel.tsx`

科目训练展示：

```text
已审核科目训练题 34
已进入专项/科目训练题库，可被用户训练抽题。
```

在线模考展示：

```text
已审核在线模考题 48/48
已进入在线模考候选池，可装配草稿卷。
```

每道题显示：

- useCase。
- 入库状态。
- 双语完整性。
- targetProfile。
- styleProfile。
- gate decision。
- 生成时间。
- prompt/reviewer/schema 版本。

### 9.5 局部刷新

必须支持：

- 刷新当前任务状态。
- 刷新当前候选。
- 刷新当前已审核资产。
- 刷新当前 topic health。

刷新不能：

- 跳回流程总览。
- 丢失当前 tab。
- 丢失当前 subject。
- 丢失当前 mock paper。
- 丢失当前分页。

### 9.6 数学符号渲染

涉及：

- `frontend/src/components/MathContent.tsx`
- `CandidateReviewPanel.tsx`
- `PublishedQuestionPanel.tsx`
- `LedgerPanel.tsx`
- `CscaMockExamPage.tsx`
- `special-practice/adaptive/AdaptivePracticeViews.tsx`
- 相关 CSS

要求：

- 所有题干、选项、解析、英文版本走同一套 MathContent。
- 行内公式不能被渲染成嵌套卡片。
- 长公式允许换行。
- 解析区使用正常文本流。
- 不在选项内渲染出重复边框或异常大块空白。

验收：

- `\frac`、`\sqrt`、区间、上下标正确渲染。
- 根号和数字不重叠。
- 解析不撑破卡片。

## 10. 推荐实施顺序

### P0：边界和清理

先做：

1. useCase normalizer。
2. 查询强过滤。
3. 前端切换 scope 清空旧列表。
4. 当前 scope 清理 API。
5. 候选治理只展示异常候选。

完成后解决：

- 科目和模考混在一起。
- 卷 2 显示卷 1 题。
- 旧测试题污染判断。

### P1：科目训练 gap 闭环

再做：

1. topic/gap 按正式入库题统计。
2. targetProfile 从真题画像派生。
3. `unknown` 只作为低置信 fallback。
4. 补齐目标改为 `approvedCount >= targetCount`。
5. 合格题自动入科目训练题库。

完成后解决：

- 候选增加但合格题不增加。
- 管理员看不清还差几题。

### P2：修复优先

继续做：

1. reviewer 输出 repairFeedback。
2. 可修复问题原题修复。
3. 修复后复审。
4. 硬伤直接重生。
5. 连续无进展 blocked。

完成后解决：

- 选项/答案/解析/英文版本小问题导致无限重生。

### P3：双语与数学符号门禁

然后做：

1. 双语完整性进入 gate。
2. 缺英文自动修复。
3. 后端数学文本规范化。
4. 前端统一 MathContent。
5. 管理后台和用户侧回归。

完成后解决：

- 通过门禁题缺英文。
- LaTeX 裸露、重叠、布局乱。

### P4：在线模考剩余收口

最后同步收口：

1. 当前卷/蓝图强过滤。
2. 48/48 后停止生成。
3. 装配状态同步。
4. 当前卷清理。

## 11. 第一轮最小可交付切片

建议第一轮只做数学、一个 topic、小目标：

```text
subject = math
topic = 任选一个已有大纲和画像覆盖的 topic
targetApprovedCount = 3
```

必须交付：

1. 清理当前 topic AI 结果。
2. 点击 `补齐合格训练题`。
3. 系统自动生成。
4. 可修复题自动修复。
5. 3 道门禁通过题自动入科目训练题库。
6. 待治理候选只显示异常题。
7. 用户侧能抽到这 3 道题。
8. 数学符号显示正常。

这个切片通过后，再扩：

```text
数学多 topic -> 数学全量 -> 物理/化学 -> 在线模考多卷稳定性
```

## 12. 测试计划

### 12.1 后端单元测试

新增或补齐：

- `normalizeQuestionUseCase`
- `buildQuestionScopeWhere`
- `deriveTopicQuestionGap`
- `targetProfileFromStyleProfile`
- `decideSubjectPracticeRepairStrategy`
- `publishToSubjectPracticeBank`
- `normalizeMathText`
- `validateMathText`

### 12.2 后端服务测试

覆盖：

1. 数学有画像时，gap 不大量出现 `unknown`。
2. 无画像学科不误报缺大纲。
3. 科目训练合格题自动入库。
4. `human_review` 不自动入库。
5. 缺英文进入修复，不入库。
6. topic mismatch 直接重生。
7. 清理当前 topic 不影响在线模考。
8. 在线模考卷 1 / 卷 2 候选隔离。

### 12.3 前端测试

覆盖：

- 切换 useCase 后列表清空并重载。
- 切换 subject 后候选隔离。
- 切换 mock paper 后候选隔离。
- 候选治理不展示已入库题。
- 已审核资产显示双语状态。
- 面板局部刷新不跳 tab。
- 数学符号不重叠。

### 12.4 手工验收

科目训练：

```text
1. 清理数学某 topic AI 数据。
2. 确认数学有 active 真题画像。
3. 点击补齐合格训练题。
4. 观察已入库题数量增长。
5. 观察异常候选只保留未入库题。
6. 达标后任务 completed。
7. 用户侧科目训练能抽到新题。
```

在线模考：

```text
1. 选择数学卷 1。
2. 确认只显示卷 1 候选。
3. 切换数学卷 2。
4. 卷 1 候选消失。
5. 卷 2 独立生成。
```

数学符号：

```text
1. 打开候选治理。
2. 打开已审核资产。
3. 打开用户侧科目训练。
4. 打开在线模考。
5. 检查题干、选项、解析、英文版本。
```

## 13. 上线步骤

因为已经有线上部署，但仍处开发阶段，建议“干净架构 + 可回滚”：

1. 停止后台生成 worker。
2. 备份数据库。
3. 部署代码。
4. 跑 useCase backfill。
5. 跑 scope 隔离校验。
6. 启动后端。
7. 只开启数学单 topic 自动补齐。
8. 验证合格题自动入库。
9. 验证用户侧训练抽题。
10. 再扩数学全量。
11. 最后扩物理、化学。

回滚：

1. 关闭科目训练自动补齐 feature flag。
2. 保留手工专项题库。
3. 新生成候选批量归档。
4. 旧正式训练题继续可用。
5. 在线模考线不受影响。

## 14. 完成定义

本方案完成时，应同时满足：

1. 科目训练和在线模考前端流程分开。
2. 科目训练和在线模考候选分开。
3. 科目训练和在线模考已审核资产分开。
4. 科目训练补题以合格题入库为目标。
5. topic/gap 达标后停止生成。
6. 可修复问题优先原题修复。
7. 硬伤问题自动重生。
8. 连续无进展进入 blocked，不无限生成候选。
9. 双语缺失不自动入库。
10. 数学符号在后台和用户侧稳定渲染。
11. 清理功能可以按当前 scope 重测。
12. 用户侧科目训练能消费新入库题。

## 15. 推荐提交粒度

建议按以下提交拆分：

1. `scope-isolation-and-cleanup`
2. `subject-gap-readiness`
3. `subject-fulfillment-loop`
4. `subject-repair-strategy`
5. `subject-auto-publish`
6. `bilingual-gate`
7. `math-rendering-unification`
8. `mock-exam-scope-polish`

每个提交至少运行：

```text
npm --prefix backend exec -- tsc -p backend/tsconfig.json --noEmit --incremental false --pretty false
npm --prefix frontend run build
npm run csca-ai-questioning:rules
```

涉及在线模考时再运行：

```text
node scripts/csca-mock-exam-ai-generation-smoke.cjs
```

## 16. 近期最优先结论

不要先继续扩大生成量，也不要先降低门禁。

当前最该做的是：

```text
1. 强隔离 scope
2. 清理重测能力
3. 科目训练按合格题达标
4. 修复优先
5. 双语和数学符号进入门禁
```

这五项完成后，科目训练线才会从“候选堆积”变成“可用题稳定增长”。

## 17. 可直接开工的任务拆解

### 17.1 PR-1：Scope 隔离与旧数据兜底

目标：

```text
让所有查询、统计、清理、候选展示都知道自己属于科目训练还是在线模考。
```

后端任务：

- 增加 `normalizeQuestionUseCase(question)`。
- 增加 `buildQuestionScopeWhere(scope)`。
- 所有候选查询增加 `targetUseCase` 过滤。
- 所有已审核资产查询增加 `targetUseCase` 过滤。
- 所有任务/队列查询增加 `targetUseCase` 过滤。
- 缺 scope 的旧数据统一识别为 `legacy`。
- `legacy` 不进入新闭环统计。

前端任务：

- 切换 `subject`、`topic`、`mockSourcePaperId`、`mockBlueprintId` 时清空旧列表。
- 科目训练候选面板只显示 `subject_practice`。
- 在线模考候选面板只显示 `online_mock_exam`。
- 卷 1 / 卷 2 切换后候选列表必须重新加载。

验收：

```text
数学卷 1 的候选不会出现在数学卷 2。
在线模考候选不会出现在科目训练候选。
科目训练候选不会出现在在线模考候选。
legacy 题不会计入缺口达标。
```

### 17.2 PR-2：清理和重测能力

目标：

```text
管理员可以按当前 scope 清理生成结果，便于重新测试，不需要手工查数据库。
```

后端任务：

- 新增 `POST /api/v1/admin/ai-questioning/cleanup`。
- 默认只清未入库候选、生成任务、修复任务。
- 清已入库资产必须要求 `confirmText`。
- 在线模考清理必须带 `mockBlueprintId`。
- 科目训练清理必须至少带 `subject`，建议带 `topicId`。
- 清理操作写 audit log。

前端任务：

- 科目训练线增加 `清理当前知识点 AI 结果`。
- 在线模考线增加 `清理当前卷 AI 结果`。
- 危险清理弹确认框，展示影响范围。

验收：

```text
清理数学 topic A 不影响数学 topic B。
清理数学卷 1 不影响数学卷 2。
清理在线模考不影响科目训练。
清理后页面统计归零或回到真实旧资产状态。
```

### 17.3 PR-3：科目训练缺口统计

目标：

```text
科目训练不再以候选数为成功标准，只以正式入库题为成功标准。
```

后端任务：

- `topicQuestionBankHealth` 增加：
  - `targetPracticeCount`
  - `approvedPracticeCount`
  - `openGapCount`
  - `pendingCandidateCount`
  - `repairableCandidateCount`
  - `blockedCandidateCount`
- `deriveTopicQuestionGap` 只根据正式入库题计算缺口。
- 候选数只作为过程指标。
- 无真题画像时返回 `missing_profile` 或 `syllabus_only`，不能误报缺大纲。

前端任务：

- topic 行展示：

```text
目标 6 / 已入库 4 / 还差 2 / 待修复 1 / 阻塞 0
```

- 按钮文案改为 `补齐合格训练题`。

验收：

```text
候选题增加不会让 topic 变 healthy。
正式入库题达到目标后 topic 才变 ready。
无画像学科提示缺画像或仅大纲模式，不提示缺大纲。
```

### 17.4 PR-4：科目训练自动补齐循环

目标：

```text
点击补齐后，系统持续生成/修复/重生，直到 approvedPracticeCount 达标或进入 blocked。
```

后端任务：

- 增加 `SubjectPracticeFulfillmentJob` metadata。
- job 每轮重新读取真实 `approvedPracticeCount`。
- 每新增 1 道正式入库题，重置 `noProgressCount`。
- 连续无新增达到阈值后进入 `blocked`。
- 达标后停止排队和生成。

前端任务：

- 任务卡显示：

```text
目标合格题：6
已入库：4
还差：2
生成中：1
可修复：1
连续无进展：3/10
```

验收：

```text
未达标时会继续处理。
达标后不会继续生成。
连续无进展会停止并展示原因。
刷新页面后状态不丢失。
```

### 17.5 PR-5：修复优先策略

目标：

```text
软问题修原题，硬问题才重生。
```

后端任务：

- reviewer 输出 `repairFeedback`。
- 增加 `decideSubjectPracticeRepairStrategy(review)`。
- 增加 `repairSubjectPracticeCandidate(questionId, repairFeedback)`。
- 修复后重新跑 validator + reviewer。
- 单题修复次数超过阈值后转重生或 blocked。

软问题：

- 缺英文。
- 答案标注错误。
- 多个正确答案但可通过改选项消歧。
- 解析和答案不一致。
- 选项过近或过弱。
- 轻微 LaTeX 问题。

硬问题：

- 超纲。
- topic mismatch。
- 与真题高度相似。
- 题干逻辑不成立。
- provider 返回结构损坏。

验收：

```text
缺英文题进入修复，不直接废弃。
答案/选项小问题优先修复。
topic mismatch 不修，直接重生。
修复通过后自动入库。
```

### 17.6 PR-6：自动入库与已审核资产

目标：

```text
门禁通过题自动进入科目训练正式题库，并从待治理候选中消失。
```

后端任务：

- 收敛 `publishToSubjectPracticeBank(questionId, context)`。
- publish 必须幂等。
- publish 前强校验：
  - useCase。
  - gate。
  - topic/syllabus。
  - 双语。
  - 数学符号。
  - 非 fallback。
  - 非 smoke/test。
- publish 后写正式题库映射和 ledger。

前端任务：

- 待治理候选只展示未入库异常题。
- 已审核资产展示正式入库题。
- 每道已审核题显示 `已入库`、`双语完整`、`gate 通过`。

验收：

```text
门禁通过题自动从候选治理消失。
已审核资产数量增加。
用户侧科目训练能抽到新题。
重复 publish 不产生重复正式题。
```

### 17.7 PR-7：双语与数学符号门禁

目标：

```text
正式题库不再进入缺英文、裸 LaTeX 或渲染异常题。
```

后端任务：

- publish 前检查中英文题干、选项、解析。
- 缺英文走修复。
- 增加 `normalizeMathText`。
- 增加 `validateMathText`。
- 数学文本规范化覆盖 prompt/options/explanation/localizations。

前端任务：

- 后台候选、已审核资产、用户侧科目训练、在线模考统一使用 `MathContent`。
- CSS 保证行内公式不变成大块卡片。
- 长公式可换行。

验收：

```text
\frac、\sqrt、上下标、区间正常渲染。
解析区公式不重叠。
选项布局不乱。
缺英文题不会自动入库。
```

## 18. API 契约建议

### 18.1 查询科目训练健康

```text
GET /api/v1/admin/ai-questioning/topic-health?subject=math&useCase=subject_practice
```

返回关键字段：

```ts
type TopicHealthResponse = {
  summary: {
    total: number;
    readyCount: number;
    needsGenerationCount: number;
    blockedCount: number;
  };
  items: Array<{
    subject: string;
    topicId: number;
    topicTitle: string;
    targetPracticeCount: number;
    approvedPracticeCount: number;
    openGapCount: number;
    pendingCandidateCount: number;
    repairableCandidateCount: number;
    blockedCandidateCount: number;
    status: string;
    action: string;
    latestProblem?: string;
  }>;
};
```

### 18.2 启动科目训练补齐

```text
POST /api/v1/admin/ai-questioning/subject-practice/fulfill
```

请求：

```ts
type FulfillSubjectPracticeRequest = {
  subject: string;
  topicId?: number;
  targetApprovedCount?: number;
  mode: 'fill_gaps' | 'repair_only' | 'expand';
};
```

响应：

```ts
type FulfillSubjectPracticeResponse = {
  jobId: number;
  status: 'queued' | 'running';
  targetApprovedCount: number;
  currentApprovedCount: number;
  openGapCount: number;
};
```

### 18.3 查询补齐任务

```text
GET /api/v1/admin/ai-questioning/subject-practice/jobs?subject=math&topicId=123
```

返回：

```ts
type SubjectPracticeJobResponse = {
  jobs: Array<{
    id: number;
    subject: string;
    topicId: number;
    status: 'queued' | 'running' | 'repairing' | 'completed' | 'blocked' | 'failed';
    targetApprovedCount: number;
    approvedCount: number;
    generatedCount: number;
    repairedCount: number;
    regeneratedCount: number;
    noProgressCount: number;
    latestProblem?: string;
  }>;
};
```

### 18.4 清理当前 scope

```text
POST /api/v1/admin/ai-questioning/cleanup
```

请求：

```ts
type CleanupRequest = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject?: string;
  topicId?: number;
  mockSourcePaperId?: number;
  mockBlueprintId?: number;
  includeCandidates?: boolean;
  includeJobs?: boolean;
  includeApprovedAssets?: boolean;
  includeDraftPapers?: boolean;
  confirmText?: string;
};
```

## 19. 数据迁移和回填策略

### 19.1 新字段优先写 metadata

如果当前阶段不想立刻加数据库字段，可先统一写入 `generationMetadata`：

```ts
generationMetadata.scope = {
  targetUseCase,
  intendedUse,
  subject,
  topicId,
  mockSourcePaperId,
  mockBlueprintId,
  mockBlueprintSlotId,
  gapKey,
  generationMode
}
```

好处：

- 改动小。
- 可快速验证流程。
- 后续稳定后再迁移为物理字段或索引字段。

风险：

- JSON 查询较慢。
- 过滤条件容易写散。

缓解：

- 所有查询必须走 `buildQuestionScopeWhere(scope)`。
- 不允许页面直接拼 JSON 条件。

### 19.2 后续物理字段

稳定后建议加字段：

```text
target_use_case
intended_use
subject
topic_id
mock_source_paper_id
mock_blueprint_id
mock_blueprint_slot_id
gap_key
generation_mode
```

索引：

```text
(target_use_case, subject, topic_id, status)
(target_use_case, mock_blueprint_id, status)
(target_use_case, mock_blueprint_slot_id, status)
```

### 19.3 旧数据回填口径

回填规则：

- `intendedUse = mock_candidate` 或带 mock blueprint/slot 的题 -> `online_mock_exam`。
- 带 topic 且已进入专项/科目训练映射的题 -> `subject_practice`。
- 无法判断 -> `legacy`。

回填后校验：

```text
legacy 不参与新补齐。
subject_practice 不进入在线模考。
online_mock_exam 不进入科目训练。
```

## 20. 每轮开发验收清单

每个 PR 合并前必须回答：

```text
1. 这次改动有没有明确 useCase？
2. 有没有影响在线模考和科目训练的隔离？
3. 候选数量是否仍然不会被当成成功？
4. 达标条件是否仍然是正式入库题？
5. 缺英文/LaTeX 问题是否会被拦住？
6. 可修复问题是否优先修复？
7. 硬伤问题是否不会无限修复？
8. 当前 scope 能不能清理重测？
9. 页面局部刷新是否保留当前上下文？
10. 用户侧是否能消费新入库题？
```

最低命令：

```text
npm --prefix backend exec -- tsc -p backend/tsconfig.json --noEmit --incremental false --pretty false
npm --prefix frontend run build
npm run csca-ai-questioning:rules
```

若改了数据库查询或清理：

```text
手工验证：清当前数学 topic、清当前数学卷 1、切换卷 2、切换科目训练线。
```

## 21. 执行工单矩阵

本节把前面的原则落成可直接开发的工单。实现时按顺序推进，除非当前线上阻塞必须先修。

### 21.1 工单 A：统一业务线 scope

目标：

```text
每一道 AI 题、每一个生成任务、每一个候选列表、每一个已审核资产列表，都能明确知道自己属于科目训练还是在线模考。
```

后端涉及文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/ai-questioning.types.ts`
- `backend/prisma/schema.prisma`，如决定增加物理字段。

前端涉及文件：

- `frontend/src/pages/AdminAIQuestionBankPage.tsx`
- `frontend/src/components/admin/ai-question-bank/questionBankViewModel.ts`
- `frontend/src/components/admin/ai-question-bank/useCandidateDataRefresh.ts`
- `frontend/src/components/admin/ai-question-bank/CandidateReviewPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/PublishedQuestionPanel.tsx`

最小实现：

1. 增加 `targetUseCase` 归一化函数。
2. 所有候选查询都走同一个 scope where builder。
3. 科目训练候选只查 `subject_practice`。
4. 在线模考候选只查 `online_mock_exam`，并且必须带当前 `mockBlueprintId`。
5. 前端切换 subject、topic、mock paper、mock blueprint 时先清空旧列表，再加载新列表。

验收动作：

```text
1. 选择数学模考卷 1，生成候选。
2. 切到数学模考卷 2，确认不显示卷 1 候选。
3. 切到科目训练线，确认不显示模考候选。
4. 切回在线模考线，确认不显示科目训练候选。
```

失败时先回滚：

- 只回滚 scope 查询改动。
- 不删除数据。
- 保留旧页面可读，但禁用自动生成按钮。

### 21.2 工单 B：候选治理只展示异常候选

目标：

```text
候选治理不是题库列表，只显示未入库、未装配、需要处理的问题题。
```

后端查询口径：

```text
include:
- draft
- pending_review
- review_failed
- needs_edit
- human_review
- blocked
- fallback

exclude:
- approved 并且已经进入专项/科目训练正式题库
- approved 并且已经进入在线模考候选池或草稿卷
- rejected
- archived
- 当前 scope 外的题
```

前端展示口径：

- 标题使用 `科目训练 AI 候选治理与兜底` 或 `在线模考 AI 候选治理与兜底`。
- 说明必须写清楚“这里仅展示未入库的异常候选”。
- 不再把候选数作为成功指标。

验收动作：

```text
1. 让一题门禁通过并自动入库。
2. 刷新候选治理。
3. 该题不再出现。
4. 打开已审核资产。
5. 该题出现在已审核资产中，并显示已入库、双语、gate 信息。
```

### 21.3 工单 C：科目训练缺口按正式入库题计算

目标：

```text
科目训练 topic 是否完成，只看正式入库题是否达到目标，不看候选堆积数量。
```

后端实现点：

1. `topicQuestionBankHealth` 返回：
   - `targetPracticeCount`
   - `approvedPracticeCount`
   - `openGapCount`
   - `pendingCandidateCount`
   - `repairableCandidateCount`
   - `blockedCandidateCount`
   - `profileStatus`
2. `deriveTopicQuestionGap` 必须从正式科目题库映射统计已完成数。
3. `cognitiveSkill = unknown` 只能是缺画像或低置信 fallback，不能在有画像的数学 topic 中大量出现。
4. 化学、物理没有真题画像时，错误必须是 `missing_profile`，不能误写成缺大纲。

前端实现点：

- topic 行显示：

```text
目标合格题 6 · 已入库 4 · 还差 2 · 待修复 1 · 阻塞 0 · 真题画像 available
```

验收动作：

```text
1. 清理某数学 topic 的 AI 候选，但保留正式入库题。
2. 刷新健康面板。
3. 已入库数量不归零。
4. 继续生成若干候选但不入库。
5. openGapCount 不减少。
6. 门禁通过并入库后，openGapCount 减少。
```

### 21.4 工单 D：自动补齐循环

目标：

```text
点击补齐后，系统持续处理直到正式入库题达标；达标后停止；无进展后阻塞。
```

任务 metadata 至少包含：

```ts
type SubjectPracticeFulfillmentMetadata = {
  targetUseCase: 'subject_practice';
  subject: string;
  topicId: number;
  gapKey?: string;
  targetApprovedCount: number;
  approvedCountAtStart: number;
  currentApprovedCount: number;
  generatedCount: number;
  repairedCount: number;
  regeneratedCount: number;
  noProgressCount: number;
  maxNoProgressCount: number;
  statusReason?: string;
};
```

循环规则：

1. 每轮开始重新读正式入库数。
2. 已达标则任务 `completed`，不再生成。
3. 未达标先处理可修候选。
4. 没有可修候选再生成新候选。
5. 生成后立即 reviewer + gate。
6. 通过则自动入库。
7. 可修则进入修复。
8. 硬伤则重生替代。
9. 连续多轮没有新增入库题则 `blocked`，并展示原因。

前端状态文案：

```text
目标 6 · 已入库 4 · 还差 2 · 生成中 1 · 可修复 1 · 连续无进展 3/10
```

验收动作：

```text
1. 设置目标为 3。
2. 清理当前 topic 的候选。
3. 点击补齐。
4. 观察已入库从 0 到 3。
5. 达到 3 后任务 completed。
6. 再点击补齐，应提示已达标，不继续生成。
```

### 21.5 工单 E：修复优先策略

目标：

```text
软问题修原题；硬问题才重生。不要因为选项或英文小问题无限生成新候选。
```

可修复问题：

- 选项过近。
- 选项重复。
- 多个正确答案但可通过改选项消歧。
- 正确答案标记错误。
- 解析与答案不一致。
- 解析缺步骤。
- 缺英文版本。
- 双语 metadata 不完整。
- 轻微 LaTeX 格式问题。
- 难度、readingLoad、calculationLoad 轻微偏差。

硬伤问题：

- topic mismatch。
- 超纲。
- 与真题高度相似。
- 与已入库题高度相似。
- 题干逻辑不成立。
- 题型完全不符合目标画像。
- provider 返回结构损坏到无法修复。

后端实现点：

```ts
decideSubjectPracticeRepairStrategy(review)
subjectPracticeRepairFeedback(question, review)
subjectPracticeRegenerationFeedback(question, review)
maybeAutoRepairSubjectPracticeQuestion(question)
maybeAutoRegenerateSubjectPracticeQuestion(question)
```

验收动作：

```text
1. 人为制造缺英文候选，确认进入修复而不是重生。
2. 人为制造答案标记错误，确认修复 correctAnswer 和 explanation。
3. 人为制造 topic mismatch，确认直接重生。
4. 修复后重新跑 validator + reviewer。
5. 修复通过后自动入库。
```

### 21.6 工单 F：双语和数学符号入库门禁

目标：

```text
正式题库中不能出现缺英文、裸 LaTeX、符号重叠、选项布局乱的题。
```

后端门禁：

1. 中文题干、A-D 选项、答案、解析完整。
2. 英文题干、A-D 选项、答案、解析完整。
3. prompt/options/explanation/localizations 都经过数学文本规范化。
4. `\frac`、`\sqrt`、上下标、区间表达可被前端渲染。
5. 不可修的数学文本不能入库。

前端统一渲染范围：

- AI 题库候选治理。
- AI 题库已审核资产。
- 科目训练用户侧。
- 在线模考用户侧。
- 草稿卷/模考题库后台。

必须避免：

- 行内公式被渲染成嵌套大卡片。
- 选项内出现多层边框。
- 解析里根号和数字重叠。
- 过长公式撑破容器。

验收动作：

```text
1. 打开含 \frac、\sqrt、区间、上下标的题。
2. 检查题干、选项、答案、解析。
3. 打开英文版本。
4. 在候选、已审核资产、用户侧科目训练、在线模考四处各检查一次。
```

### 21.7 工单 G：清理和重测

目标：

```text
开发阶段可以安全重测，不需要手工删数据库，也不会误删另一条业务线。
```

清理范围：

```ts
type CleanupScope = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject?: string;
  topicId?: number;
  mockSourcePaperId?: number;
  mockBlueprintId?: number;
  includeCandidates: boolean;
  includeJobs: boolean;
  includeApprovedAssets: boolean;
  includeDraftPapers: boolean;
};
```

默认安全行为：

- 只清未入库候选。
- 只清当前 scope 的任务。
- 不清正式题库。
- 不清草稿卷。

危险清理：

- 清正式科目题库需要输入确认文案。
- 清在线模考已装配草稿卷需要输入确认文案。
- 操作必须写 audit log。

验收动作：

```text
1. 清数学卷 1，不影响数学卷 2。
2. 清数学 topic A，不影响 topic B。
3. 清科目训练，不影响在线模考。
4. 清理后重新生成，统计从干净状态开始。
```

## 22. 当前实现状态与缺口

截至 2026-07-07，本方案按“开发中”口径记录，不作为最终发布说明。

已基本落地：

- 在线模考 48 题位补齐闭环。
- 科目/模考开始分线。
- 自动修复和硬伤重生的基础逻辑。
- 双语完整性门禁的基础检查。
- 后台数学符号渲染的第一轮修复。
- 局部刷新和候选排序的基础能力。

仍需重点完善：

- 科目训练 topic/gap 的正式入库统计口径。
- 已入库题从候选治理中彻底消失。
- 科目训练候选与在线模考候选的强 scope 隔离。
- 每个 mock paper / mock blueprint 的候选、任务、已审核资产隔离。
- 清理 API 的安全确认和审计。
- 数学符号在用户侧科目训练、在线模考、后台全链路一致渲染。
- `cognitiveSkill` 从真题画像到 targetProfile 的稳定映射和低置信提示。

## 23. 下一步执行顺序

建议接下来不要再扩大生成量，先按下面顺序收口：

```text
1. 工单 A：统一 scope。
2. 工单 B：候选治理只展示异常候选。
3. 工单 C：科目训练缺口按正式入库题计算。
4. 工单 G：清理和重测。
5. 工单 D：自动补齐循环。
6. 工单 E：修复优先。
7. 工单 F：双语和数学符号门禁。
```

这样做的原因：

- 先解决“看错数据”的问题。
- 再解决“成功标准错”的问题。
- 再解决“无法干净重测”的问题。
- 最后再提高生成和修复效率。

如果先继续优化 prompt 或扩大并发，容易继续制造候选堆积，但无法判断这些候选到底属于哪条线、哪个卷、哪个 topic，也无法判断是否真的进入了正式题库。

## 24. 最小验收脚本清单

规则测试至少覆盖这些断言：

```text
1. subject_practice 候选查询排除 online_mock_exam。
2. online_mock_exam 候选查询排除 subject_practice。
3. mockBlueprintId 不同，候选互不显示。
4. approved + 已入库题不出现在待治理候选。
5. candidateCount 不影响 topic ready。
6. approvedPracticeCount 达标才 ready。
7. 缺英文不能 publish。
8. 裸 LaTeX 不能 publish。
9. repairable 问题走 repair_in_place。
10. hard failure 走 hard_regenerate。
11. noProgress 达阈值进入 blocked。
12. cleanup 必须带 scope。
```

推荐命令：

```text
npm run csca-ai-questioning:rules
npm --prefix backend exec -- tsc -p backend/tsconfig.json --noEmit --incremental false --pretty false
npm --prefix frontend run build
```

手工 smoke：

```text
1. 数学单 topic：清理 -> 补齐 3 道 -> 自动入库 -> 用户侧抽题。
2. 数学模考卷 1：清理 -> 补齐 48/48 -> 装配草稿卷。
3. 数学模考卷 2：确认不显示卷 1 数据。
4. 化学无画像时：提示缺真题画像，不提示缺大纲。
5. 数学符号题：后台候选、已审核资产、科目训练、在线模考四处检查。
```
