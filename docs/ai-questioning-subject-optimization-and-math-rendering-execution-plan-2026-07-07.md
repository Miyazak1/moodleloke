# AI 出题科目训练优化与数学渲染可执行方案

> 日期：2026-07-07  
> 状态：落地执行级方案  
> 范围：AI 题库后台、科目训练 AI 出题、在线模考 AI 出题、候选治理、正式题库入库、数学符号渲染  
> 关联文档：
> - `docs/ai-question-bank-dual-line-executable-plan-2026-07-07.md`
> - `docs/subject-practice-ai-question-optimization-executable-plan-2026-07-07.md`
> - `docs/subject-training-ai-generation-closed-loop-plan-2026-07-07.md`
> - `docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`
> - `docs/subject-training-profile-adaptation-implementation-spec-2026-07-03.md`

## 1. 结论

在线模考线已经验证出一套正确方向：

```text
真题画像 -> 整卷蓝图 -> 题位 -> 自动生成/修复/复审
-> 每个题位 1 道门禁通过题
-> 满 48/48 后进入在线模考题库
-> 装配草稿卷
```

科目训练线需要升级到同等级闭环，但完成标准不能是“候选题数量”，必须是：

```text
每个 topic / gap 有足够数量的门禁通过题
并且这些题已经进入科目训练/专项训练正式题库
```

同时，最近暴露出的数学符号问题说明：生成链路不能只判断题目内容，还必须把数学文本规范化、双语完整性、前端渲染一致性纳入入库门禁。

本方案的执行目标是：

```text
1. 科目训练和在线模考彻底按 useCase / scope 隔离。
2. 科目训练按正式入库题补齐，不按候选数补齐。
3. 可修复问题先原题修复，硬伤才重生。
4. 门禁通过题自动入对应正式题库，并从候选治理消失。
5. 候选治理只展示未入库异常题。
6. 当前 scope 可安全清理重测。
7. 数学公式在后台、科目训练、在线模考全链路正常显示。
```

## 2. 当前问题拆解

### 2.1 科目训练线

当前主要问题：

- 候选题可能不断增加，但合格入库题不增加。
- 部分 `needs_edit` / `human_review` / `review_failed` 问题本可修复，却被当成重生处理。
- topic/gap 的进度容易看成“候选进度”，而不是“正式训练题进度”。
- 已自动入库题仍可能出现在候选治理中，造成“既通过又待处理”的冲突。
- 清理能力不足时，旧候选会污染重测结果。

### 2.2 在线模考线

当前主要问题：

- 必须保证每套卷、每个 blueprint 的候选、任务、已审核资产独立。
- 已装配后状态要从“待装配”同步为“已装配/草稿卷关联”。
- 清理必须能按当前卷/当前 blueprint 执行，不能影响其他卷。

### 2.3 数学符号与双语

当前主要问题：

- 后台候选、已审核资产、科目训练、在线模考中数学内容渲染不一致。
- 裸 LaTeX、双转义、行内/块级混排会造成符号重叠、选项布局变形。
- 已通过门禁的题仍可能缺英文版本或缺双语 metadata。

## 3. 架构边界

### 3.1 共用上游

大纲和真题画像是共用准备层：

```text
大纲基线
  -> subject / topic / syllabusVersion / excludedScope

真题画像
  -> questionForm / cognitiveSkill / difficultyBand
  -> readingLoad / calculationLoad
  -> distractorTypes / commonMisconceptions
  -> estimatedTimeSeconds
```

共用上游只负责“能考什么、真题怎么考”，不直接决定题目进入哪条业务线。

### 3.2 分叉后独立治理

从 AI 出题开始分成两条线：

```text
科目训练线：
  topic / gap -> subject_practice candidate -> gate
  -> subject practice bank / special practice bank

在线模考线：
  source paper -> mock blueprint -> slot
  -> online_mock_exam candidate -> gate
  -> mock exam candidate pool -> draft paper
```

硬规则：

- 科目训练候选不显示到在线模考。
- 在线模考候选不显示到科目训练。
- mock 卷 1 的候选不显示到 mock 卷 2。
- 已入库/已装配题不再显示在“待治理候选”。
- 缺 scope 的 legacy 题不参与新闭环统计。

## 4. 数据口径

### 4.1 每道 AI 题必须有 scope

短期优先写入 `generationMetadata.scope`，后续稳定后再迁移成物理字段。

```ts
type AIQuestionScope = {
  targetUseCase: 'subject_practice' | 'online_mock_exam' | 'legacy';
  intendedUse: 'subject_practice' | 'mock_candidate' | 'legacy';
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion?: string;

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
    | 'online_mock_slot_fulfillment'
    | 'online_mock_candidate_repair'
    | 'online_mock_candidate_regenerate'
    | 'legacy';
};
```

### 4.2 正式可用不能只看 `approved`

`csca_questions.status = approved` 只能说明 AI 题资产通过了某种审核，不等于已经进入正式业务题库。

正式可用口径：

```text
科目训练正式题：
  csca_questions.approved
  + targetUseCase = subject_practice
  + source_question_id / special_practice mapping 存在
  + mapping status = published

在线模考正式候选：
  csca_questions.approved
  + targetUseCase = online_mock_exam
  + mockExamApproval.status = approved_for_mock_exam_assembly
  + 当前 mockBlueprintId / slot 匹配
```

## 5. 完成标准

### 5.1 科目训练 topic

```ts
type SubjectTopicReadiness = {
  subject: 'math' | 'physics' | 'chemistry';
  topicId: number;
  topicTitle: string;
  targetApprovedCount: number;
  approvedPracticeCount: number;
  openGapCount: number;
  repairableCandidateCount: number;
  abnormalCandidateCount: number;
  blockedCandidateCount: number;
  status:
    | 'missing_syllabus'
    | 'missing_profile'
    | 'syllabus_only'
    | 'needs_generation'
    | 'generating'
    | 'repairing'
    | 'ready'
    | 'blocked';
};
```

`ready` 的唯一条件：

```text
approvedPracticeCount >= targetApprovedCount
```

### 5.2 科目训练 gap

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
  noProgressCount: number;
  status: 'open' | 'running' | 'repairing' | 'fulfilled' | 'blocked';
};
```

`fulfilled` 的唯一条件：

```text
approvedCount >= neededCount
```

### 5.3 在线模考整卷

```ts
type OnlineMockBlueprintReadiness = {
  mockSourcePaperId: number;
  mockBlueprintId: number;
  totalSlots: 48;
  readySlots: number;
  approvedCandidateCount: number;
  assembledDraftPaperId?: number;
  status: 'not_loaded' | 'generating' | 'ready' | 'assembled' | 'blocked';
};
```

`ready` 的唯一条件：

```text
readySlots = 48
```

`assembled` 的条件：

```text
readySlots = 48
+ draft paper 已创建
+ 48 道题都记录 draftPaperId / assembly mapping
```

## 6. 门禁

### 6.1 自动入库条件

题目必须同时满足：

1. `targetUseCase` 和当前业务线匹配。
2. `status = approved` 或等价自动通过状态。
3. `reviewMetadata.gate.publishable = true`。
4. 不是 fallback / smoke / test 数据。
5. topic / slot / syllabus 匹配。
6. 题干、选项、答案、解析完整。
7. 答案唯一，解析与答案一致。
8. 不超纲。
9. 与真题和已入库题不高度相似。
10. 双语完整：中文和英文题干、选项、解析都有。
11. 数学文本可渲染。
12. 入库函数幂等校验通过。

### 6.2 不能自动入库

以下题不能计入合格题，也不能自动入正式题库：

- `pending_review`
- `human_review`
- `needs_edit`
- `review_failed`
- `fallback`
- `regenerate`
- `rejected`
- `archived`
- `blocked`
- 缺英文版本
- LaTeX 不可渲染
- 当前 scope 外的题

## 7. 修复优先策略

### 7.1 可原题修复

优先修复原题的问题：

- 正确答案标注错误。
- 多个正确答案，但可通过改选项消歧。
- 选项过近、重复、过弱。
- 干扰项缺错因。
- 解析缺步骤。
- 解析与答案不一致。
- 英文版本缺失。
- 双语 metadata 缺失。
- 轻微 LaTeX 格式错误。
- difficulty / readingLoad / calculationLoad 轻微偏差。
- `human_review` 原因是画像证据弱或软警告。

修复要求：

- 保留题目核心能力点、topic、targetProfile。
- 修复后重新跑 validator + reviewer。
- 修复通过后自动入库。
- 单题最多自动修复 2 次。

### 7.2 必须重生

直接重生的问题：

- 超纲。
- topic mismatch。
- mock slot mismatch。
- 与真题高度相似。
- 与已入库题高度相似。
- 题干逻辑不成立。
- 题型与目标画像完全不符。
- 难度严重偏离。
- provider 返回结构损坏。
- 数学表达不可恢复。

### 7.3 阈值

```ts
const REPAIR_MAX_ATTEMPTS_PER_QUESTION = 2;
const REGENERATE_MAX_ATTEMPTS_PER_GAP = 20;
const NO_PROGRESS_BLOCK_THRESHOLD = 10;
```

含义：

- 单题最多修复 2 次。
- 一个 gap 最多连续重生 20 次。
- 连续 10 次没有新增正式入库题，进入 `blocked`，停止继续烧 token。

## 8. 后端执行工单

### 工单 A：统一 scope normalizer

目标：

```text
所有候选、任务、已审核资产、台账、清理操作都从同一个 scope builder 得到查询条件。
```

涉及文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/ai-questioning.controller.ts`
- `backend/src/ai-questioning/ai-questioning.types.ts`
- `backend/src/csca-mock-exam/csca-mock-exam.service.ts`

最小实现：

```ts
normalizeQuestionUseCase(question): 'subject_practice' | 'online_mock_exam' | 'legacy'
buildAiQuestionScopeWhere(scope): Prisma.Sql | Prisma.CscaQuestionWhereInput
isSubjectPracticeAsset(question): boolean
isOnlineMockAsset(question): boolean
```

验收：

```text
1. 科目训练候选不包含 mock_candidate。
2. 在线模考候选不包含 subject_practice。
3. mock 卷 2 不显示 mock 卷 1 数据。
4. legacy 不参与 ready / fulfilled / 48 满额统计。
```

### 工单 B：候选治理只展示异常候选

目标：

```text
候选治理不是候选题总表，只展示未入库异常题。
```

后端过滤：

```text
include:
- draft
- pending_review
- review_failed
- needs_edit
- human_review
- fallback
- blocked

exclude:
- approved 并且已入科目训练正式题库
- approved 并且已进入在线模考候选池或草稿卷
- rejected
- archived
- 当前 scope 外的题
```

涉及文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `frontend/src/components/admin/ai-question-bank/candidateQueueFilters.ts`
- `frontend/src/components/admin/ai-question-bank/CandidateReviewPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/useCandidateDataRefresh.ts`

验收：

```text
1. 门禁通过并入库后，该题从候选治理消失。
2. 复审失败、缺英文、LaTeX 失败题出现在候选治理。
3. 候选治理标题说明“仅展示未入库异常候选”。
```

### 工单 C：科目训练缺口按正式入库题计算

目标：

```text
topic/gap 是否完成，只看正式入库题，不看候选数量。
```

涉及函数：

- `deriveTopicQuestionGap`
- `topicQuestionBankHealth`
- `targetProfileFromStyleProfile`
- `source-question-profile-normalizer.ts`

实现要求：

1. `approvedPracticeCount` 从正式科目题映射统计。
2. gap 维度包含 `difficultyBand/questionForm/cognitiveSkill/readingLoad/calculationLoad`。
3. 数学已有画像时，`cognitiveSkill = unknown` 不能大量作为主目标。
4. 化学/物理无画像时，错误应是 `missing_profile` 或 `syllabus_only`，不能误报缺大纲。

验收：

```text
1. 生成 10 个候选但都未入库，openGapCount 不减少。
2. 入库 1 道合格题后，对应 gap 的 approvedCount +1。
3. 数学 targetProfile 有明确 cognitiveSkill。
```

### 工单 D：科目训练自动补齐闭环

目标：

```text
点击补齐后，系统持续生成/修复/重生，直到正式入库题达标或进入 blocked。
```

任务 metadata：

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

核心循环：

```ts
while (currentApprovedCount < targetApprovedCount) {
  const repairable = await findRepairableCandidate(scope);
  const candidate = repairable
    ? await repairCandidate(repairable)
    : await generateCandidateForGap(scope);

  const review = await reviewCandidate(candidate);

  if (review.gate.publishable) {
    await publishToSubjectPracticeBank(candidate.id);
    currentApprovedCount += 1;
    noProgressCount = 0;
    continue;
  }

  const strategy = decideRepairStrategy(review);

  if (strategy === 'repair_in_place') {
    await enqueueRepair(candidate.id, review.repairFeedback);
    continue;
  }

  noProgressCount += 1;

  if (noProgressCount >= maxNoProgressCount) {
    await markGapBlocked(scope, review.reasons);
    break;
  }
}
```

验收：

```text
1. 未达标时持续处理。
2. 达标后任务 completed，并停止继续生成。
3. 连续无进展后 blocked，展示最新原因。
4. 刷新页面后状态不丢失。
```

### 工单 E：自动入库函数收敛

目标：

```text
门禁通过题自动进入对应正式题库，重复调用不重复入库。
```

函数：

```ts
publishToSubjectPracticeBank(questionId, context)
publishToOnlineMockCandidatePool(questionId, context)
```

校验：

- useCase 匹配。
- gate 通过。
- topic / slot 匹配。
- 双语完整。
- 数学文本可渲染。
- 非 fallback。
- 非 smoke/test。
- 不存在重复正式映射。

验收：

```text
1. 同一道题重复 publish 不重复插入。
2. 缺英文题 publish 被拒绝并进入修复。
3. publish 后候选治理不再显示该题。
4. 已审核资产显示该题，并标记已入库/可装配。
```

### 工单 F：清理与重测能力

目标：

```text
开发阶段可按当前 scope 清理，不误删另一条业务线。
```

统一接口：

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

默认行为：

- 只清未入库异常候选。
- 只清当前 scope 的任务。
- 保留正式题库。
- 保留已拒绝/已归档历史，除非明确选择。

危险行为：

- 清已入库资产必须输入确认文本。
- 清在线模考草稿卷必须输入确认文本。
- 所有清理写 audit log。

验收：

```text
1. 清数学 topic A 不影响 topic B。
2. 清数学卷 1 不影响数学卷 2。
3. 清科目训练不影响在线模考。
4. 清理后可以重新生成测试。
```

### 工单 G：双语门禁

目标：

```text
正式题库中不再出现缺英文或缺双语 metadata 的 AI 题。
```

后端要求：

```ts
type LocalizationGate = {
  hasZhPrompt: boolean;
  hasZhOptions: boolean;
  hasZhExplanation: boolean;
  hasEnPrompt: boolean;
  hasEnOptions: boolean;
  hasEnExplanation: boolean;
  status: 'passed' | 'repair_required' | 'failed';
};
```

规则：

- 缺英文：`repair_in_place`。
- 缺中文：`repair_in_place`。
- 双语结构严重缺失：`hard_regenerate` 或 `blocked`。
- 缺双语题不能 publish。

验收：

```text
1. 已审核资产不再显示“没有双语版本 metadata”。
2. 缺英文候选自动进入修复。
3. 修复后英文版本可展开查看。
```

### 工单 H：数学文本规范化与前端统一渲染

目标：

```text
后台、科目训练、在线模考题干/选项/解析全部用统一数学渲染，不裸露、不重叠、不撑破。
```

后端工具：

```ts
normalizeMathText(input: string): string
validateMathText(input: string): MathValidationResult
```

处理范围：

- prompt。
- options。
- explanation。
- zh/en localization。

必须处理：

- 裸 `\frac`、`\sqrt`、`\leq`、`\geq` 自动包裹。
- 双反斜杠污染。
- 多余 `$`。
- 行内公式和块级公式混排。
- 不可修复表达写入 gate issue。

前端涉及文件：

- `frontend/src/components/MathContent.tsx`
- `frontend/src/styles/math-content.css`
- `frontend/src/components/admin/ai-question-bank/CandidateReviewPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/PublishedQuestionPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/LedgerPanel.tsx`
- `frontend/src/pages/CscaMockExamPage.tsx`
- `frontend/src/pages/CscaSpecialPracticePage.tsx`
- `frontend/src/pages/special-practice/adaptive/AdaptivePracticeViews.tsx`

前端要求：

- 所有题目文本走同一个 `MathContent` / `RichMathContent`。
- 行内公式不渲染成大块卡片。
- 选项内公式不出现多层边框。
- 解析区使用正常文本流。
- 长公式可换行。
- KaTeX line-height 不造成根号、上下标、数字重叠。

验收：

```text
1. \frac、\sqrt、上下标、区间在题干/选项/解析中正常显示。
2. 管理后台候选、已审核资产、用户侧科目训练、在线模考四处显示一致。
3. 解析中的根号和数字不重叠。
4. 选项布局不再出现巨大空白或嵌套卡片。
```

## 9. 前端执行工单

### 工单 I：页面结构和文案

AI 题库后台保持三段：

```text
1 共用准备
  - 大纲基线
  - 真题画像

2 科目训练线
  - 知识点题库健康
  - 缺题画像
  - 自动补齐合格训练题
  - 待治理异常候选
  - 已入库科目资产

3 在线模考线
  - 来源卷
  - 整卷蓝图
  - 题位
  - 自动补齐 48/48
  - 待治理异常候选
  - 已审核模考资产
  - 草稿卷装配
```

按钮文案：

```text
科目训练：
- 补齐合格训练题
- 处理可修复候选
- 清理当前知识点 AI 结果

在线模考：
- 生成/加载整卷蓝图
- 加载题位
- 启动自动补齐 48/48
- 装配已完成草稿卷
- 清理当前卷 AI 结果
```

避免使用：

- `追加候选`
- `生成候选`
- `通过所选候选入库`

这些可以保留为低优先级调试动作，但不能是主流程动作。

### 工单 J：任务状态和局部刷新

目标：

```text
管理员不用刷新整页就能看到当前 scope 的生成、修复、入库进度。
```

状态展示：

```text
科目训练：
目标 6 · 已入库 4 · 还差 2 · 生成中 1 · 可修复 1 · 连续无进展 3/10

在线模考：
48 题位 · ready 42 · 生成中 2 · 待修复 4 · 已装配 0
```

刷新规则：

- running / queued / repairing 时自动刷新。
- 候选面板有 `刷新候选`。
- 已审核资产有 `刷新资产`。
- 刷新不改变 tab / subject / mock paper / blueprint / page / status。
- 新生成、新失败、新修复的题按 `updatedAt desc` 排前面。

验收：

```text
1. 后台运行时候选数和已入库数自动更新。
2. 点击局部刷新不跳回流程总览。
3. 切换卷后旧卷数据立即清空。
```

## 10. 推荐实施顺序

### P0：先保证看见的是对的数据

1. 工单 A：统一 scope normalizer。
2. 工单 B：候选治理只展示异常候选。
3. 工单 C：科目训练缺口按正式入库题计算。
4. 工单 F：清理与重测能力。

完成后解决：

- 科目和模考混在一起。
- 卷 2 显示卷 1 的题。
- 候选数量被误认为成功。
- 无法干净重测。

### P1：再让科目训练真的闭环

1. 工单 D：科目训练自动补齐闭环。
2. 工单 E：自动入库函数收敛。
3. 工单 G：双语门禁。
4. 工单 J：任务状态和局部刷新。

完成后解决：

- 候选一直增加但合格题没有。
- 合格题仍停在候选区。
- 缺英文题混入已审核资产。

### P2：最后统一展示质量

1. 工单 H：数学文本规范化与前端统一渲染。
2. 工单 I：页面结构和文案。

完成后解决：

- 裸 LaTeX。
- 符号数字重叠。
- 选项布局乱。
- 管理后台和用户侧显示不一致。

## 11. 最小可交付切片

第一轮只做一个小闭环，避免全量改动难定位：

```text
subject = math
useCase = subject_practice
topic = 选择 1 个数学 topic
targetApprovedCount = 3
```

必须完成：

1. 清理当前 topic 的未入库候选和任务。
2. topic health 显示目标、已入库、还差。
3. 点击 `补齐合格训练题`。
4. 系统自动生成/修复/重生。
5. 3 道门禁通过题自动进入科目训练正式题库。
6. 候选治理只显示未入库异常题。
7. 已入库资产显示 3 道题。
8. 用户侧科目训练能抽到新题。
9. 数学符号在后台和用户侧显示正常。

这个切片通过后再扩展：

```text
数学全 topic -> 在线模考多卷隔离 -> 物理/化学 -> 全量自动补齐
```

## 12. 测试计划

### 12.1 规则测试

更新 `scripts/csca-ai-questioning-rules-test.cjs`，至少断言：

```text
1. subject_practice 查询排除 online_mock_exam。
2. online_mock_exam 查询排除 subject_practice。
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

### 12.2 后端测试

必须覆盖：

- `normalizeQuestionUseCase`
- `buildAiQuestionScopeWhere`
- `deriveTopicQuestionGap`
- `decideRepairStrategy`
- `publishToSubjectPracticeBank`
- `publishToOnlineMockCandidatePool`
- `cleanupAiQuestioningScope`
- `normalizeMathText`
- `validateMathText`

### 12.3 前端测试

必须覆盖：

- 切换 subject 清空旧候选。
- 切换 mock paper / blueprint 清空旧候选。
- 候选治理不显示已入库题。
- 已审核资产只显示当前业务线正式资产。
- 局部刷新不跳 tab。
- MathContent 在题干、选项、解析中正常渲染。

### 12.4 手工验收

科目训练：

```text
1. 清理数学某 topic。
2. 确认数学有 active 真题画像。
3. 点击补齐合格训练题。
4. 观察已入库数从 0 到 3。
5. 查看候选治理，只剩异常未入库题。
6. 查看已入库资产，出现 3 道题。
7. 用户侧科目训练抽题，能抽到新题。
```

在线模考：

```text
1. 清理数学模拟卷 1。
2. 生成/加载整卷蓝图。
3. 加载题位。
4. 启动自动补齐。
5. 达到 48/48 后停止。
6. 装配草稿卷。
7. 切换卷 2，确认不显示卷 1 数据。
```

数学符号：

```text
1. 打开含 \frac、\sqrt、区间、上下标的题。
2. 后台候选、已审核资产各检查一次。
3. 用户侧科目训练检查一次。
4. 在线模考检查一次。
5. 确认不裸露、不重叠、不撑破。
```

## 13. 上线步骤

当前仍是开发阶段，但已有线上部署。推荐“干净架构 + 可回滚上线”：

1. 备份数据库。
2. 停止 AI 生成 worker。
3. 部署代码。
4. 跑 metadata backfill。
5. 跑 useCase 隔离校验。
6. 先只开启数学单 topic。
7. 验证小闭环。
8. 开启数学全 topic。
9. 验证在线模考多卷隔离。
10. 再扩展物理/化学。

回滚：

1. 关闭自动补齐 feature flag。
2. 保留手工专项题库和手工在线模考题库。
3. 新生成异常候选批量归档。
4. 不删除旧正式题库。

## 14. 完成定义

本方案完成时，必须满足：

1. 科目训练和在线模考前端流程清晰分叉。
2. 两条线的候选、任务、资产、台账、清理按 scope 隔离。
3. 科目训练以正式入库题达标。
4. 在线模考以 48/48 ready slot 达标。
5. 门禁通过题自动入对应正式题库。
6. 未通过题只进入待治理异常候选。
7. 可修复问题优先原题修复。
8. 硬伤问题直接重生。
9. 连续无进展会 blocked，不无限生成候选。
10. 缺英文和数学不可渲染题不能入库。
11. 后台和用户侧数学符号显示一致。
12. 当前 scope 可安全清理并重新测试。

