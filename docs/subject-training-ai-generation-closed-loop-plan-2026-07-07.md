# 科目训练 AI 出题闭环升级实施方案

> 日期：2026-07-07  
> 状态：可执行实施方案  
> 范围：AI 题库治理后台、科目训练题库、专项题库、AI 出题/审题/修复队列、真题画像消费链路  
> 关联文档：
> - `docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`
> - `docs/subject-training-profile-adaptation-implementation-spec-2026-07-03.md`
> - `docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md`
> - `docs/csca-ai-questioning-source-of-truth-2026-07-03.md`

## 1. 核心结论

在线模考 AI 出题已经逐步形成了“真题画像 -> 整卷蓝图 -> 题位 -> 自动生成/修复/复审 -> 满 48 个合格题 -> 入在线模考题库 -> 装配草稿卷”的闭环。

科目训练 AI 出题现在需要进入同等级的闭环，但它的目标不能照搬在线模考的 48 题整卷逻辑。科目训练的目标应是：

```text
每个知识点 / 每个缺题画像
达到足够数量的门禁通过题
进入专项/科目训练正式题库
并能被训练、错题复练、自适应推荐稳定消费
```

因此下一阶段要做的不是继续扩大候选数量，而是把科目训练线升级为：

```text
共用大纲基线
-> 共用真题画像源
-> 科目训练缺题画像
-> 科目训练目标画像
-> 自动生成候选
-> 自动审题门禁
-> 可修复问题原题优化
-> 不可修复问题重新生成
-> 达到合格题数量门槛
-> 自动进入科目/专项题库
-> 用户训练可用
```

设计原则：

1. 大纲基线和真题画像源是共用上游。
2. 分叉后，科目训练线和在线模考线必须独立治理。
3. 科目训练题库和在线模考题库的正式资产必须分开。
4. AI 候选可以共用底层生成能力，但必须用 `targetUseCase` / `intendedUse` 强隔离。
5. 科目训练线不以“候选题数量”为完成标准，只以“门禁通过并入科目训练题库的合格题数量”为完成标准。
6. `human_review`、`needs_edit`、`review_failed`、`fallback` 都不能自动算作合格题。
7. 对可修复问题优先原题优化；对硬伤才重新生成。

## 2. 当前现状

### 2.1 已具备能力

当前代码已经有这些基础：

- 大纲上传、应用、知识点基线。
- 真题 JSON 导入、自动画像、样本纳入画像。
- `styleProfile` 和 `targetProfile` 进入生成/审题链路。
- AI 题生成队列和自动重试。
- 候选题复审、门禁、批量处理。
- 在线模考线已经有整卷蓝图、题位、自动补齐 48 题、装配草稿卷。
- 管理后台已经按“共用准备 / 科目训练线 / 在线模考线”做了初步分叉展示。

相关代码位置：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/question-reviewer.service.ts`
- `backend/src/ai-questioning/question-validator.service.ts`
- `backend/src/csca-special-practice`
- `backend/src/csca-mock-exam/csca-mock-exam.service.ts`
- `frontend/src/components/admin/ai-question-bank/CoverageWorkPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/CandidateReviewPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/PublishedQuestionPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/QuestionBankTaskStatus.tsx`

### 2.2 科目训练线主要问题

当前科目训练 AI 出题仍然有这些缺口：

1. 完成标准不清晰  
   现在更多是“补候选 / 追加候选”，不是“补到合格题达标”。

2. 候选数量会膨胀  
   如果生成题持续不通过门禁，系统会继续产生候选，但正式可用题不增长。

3. 可修复问题没有充分原题优化  
   例如选项过近、答案标注冲突、解析不完整、双语缺失、轻微 load mismatch，本来可以在原题基础上修复，不应每次重新生成。

4. 科目题与模考题仍存在概念混淆风险  
   两条线虽然前端初步分叉，但候选、已审核、台账、批量动作仍需要严格按 `subject_practice` 和 `online_mock_exam` 隔离。

5. 真题画像适配还不够闭环  
   科目训练出题应使用升级后的画像维度：`questionForm`、`cognitiveSkill`、`readingLoad`、`calculationLoad`、`distractorTypes`、`commonMisconceptions`、`estimatedTimeSeconds`。

6. 前端任务状态不够贴合科目训练语义  
   管理员需要看到“这个知识点还差几道合格题”，而不是只看到生成队列和候选队列。

## 3. 目标架构

### 3.1 共用上游

```text
CSCA 大纲
  -> CscaExamTopic
  -> topic / module / syllabusVersion

真题 JSON
  -> CscaSourceQuestion
  -> normalized source question profile
  -> style profile / topic questioning profile
```

共用上游只回答：

- 能考什么。
- 真题通常怎么考。
- 某个 topic 的常见题型、认知技能、负载、干扰项是什么。

### 3.2 科目训练线

```text
Topic health
-> TopicQuestionGap
-> SubjectTrainingTargetProfile
-> Subject generation job
-> Candidate
-> Validator / Reviewer / Gate
-> Auto repair or regenerate
-> Approved subject practice asset
-> Special practice / subject training provider
```

科目训练线回答：

- 这个知识点缺几道训练题。
- 缺什么类型的训练题。
- 生成出来的题是否适合训练。
- 多少题已经正式可训练。

### 3.3 在线模考线

```text
Mock source paper
-> Mock exam blueprint
-> Blueprint slots
-> Online mock candidate generation job
-> Slot gate
-> 48/48 approved
-> Mock exam question pool
-> Draft paper assembly
```

在线模考线回答：

- 一套卷的 48 个题位是否都已填满。
- 每个题位是否有合格题。
- 是否能装配成在线模考草稿卷。

### 3.4 强隔离规则

所有查询、任务、候选、已审核资产必须按业务线隔离：

```ts
type QuestionBankUseCase = 'subject_practice' | 'online_mock_exam';
type IntendedUse = 'subject_practice' | 'mock_candidate' | 'diagnostic' | 'wrong_question_review';
```

隔离要求：

- 科目训练补题只创建 `intendedUse = subject_practice` 的候选。
- 在线模考生成只创建 `intendedUse = mock_candidate` / `targetUseCase = online_mock_exam` 的候选。
- 科目训练已审核资产列表不展示在线模考候选。
- 在线模考候选池不展示科目训练题。
- 批量通过、归档、删除、CSV/JSON 导出都必须带 useCase。
- 前端切换学科或卷时，候选和任务状态必须重新按 scope 加载。

## 4. 科目训练完成标准

科目训练不能用“生成任务完成”作为完成标准。必须用“合格题数量达标”作为完成标准。

### 4.1 Topic 级完成标准

每个 topic 至少维护：

```ts
type SubjectTopicReadiness = {
  subject: 'math' | 'physics' | 'chemistry';
  topicId: number;
  syllabusVersion: string;
  targetApprovedCount: number;
  approvedPracticeCount: number;
  pendingCandidateCount: number;
  repairableCandidateCount: number;
  blockedCandidateCount: number;
  status:
    | 'missing_blueprint'
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

### 4.2 Gap 级完成标准

如果 topic 已经拆成画像缺口，则每个 gap 独立达标：

```ts
type SubjectQuestionGapProgress = {
  gapKey: string;
  targetProfile: {
    difficultyBand: string;
    questionForm: string;
    cognitiveSkill: string;
    readingLoad: string;
    calculationLoad: string;
  };
  neededCount: number;
  approvedCount: number;
  generatingCount: number;
  repairableCount: number;
  rejectedCount: number;
  status: 'open' | 'running' | 'fulfilled' | 'blocked';
};
```

`fulfilled` 的唯一条件：

```text
approvedCount >= neededCount
```

## 5. 门禁定义

### 5.1 自动合格

只有满足以下条件的题可以自动进入科目训练题库：

1. `status = approved`。
2. `reviewMetadata.gate.decision` 是 `publishable` 或等价自动通过状态。
3. 没有硬伤 issue。
4. `intendedUse = subject_practice`。
5. `generationMetadata.sourceKind` 优先为 `syllabus_and_past_paper_profile`。
6. 双语版本存在；如果当前题库要求中英双语，缺英文不能入库。
7. `profileAlignment.status != failed`。
8. 不带 `fallback` 标记。

### 5.2 不能自动合格

以下状态不能算作合格题：

- `pending_review`
- `review_failed`
- `needs_edit`
- `human_review`
- `fallback`
- `rejected`
- `archived`

这些题只能进入“待治理候选”，不能进入“已审核资产”。

### 5.3 人工确认

开发阶段可以保留人工确认入口，但它不是默认闭环。人工确认只用于：

- 管理员接受 reviewer 的软警告。
- 管理员手工编辑后复审。
- 少量边界样本校准门禁。

批量自动补题不能依赖人工确认才能达标。

## 6. 修复与重生策略

科目训练线要引入和在线模考相同级别的“失败分流”：

```text
失败候选
-> 判断失败原因
-> 可修复：原题优化
-> 不可修复：重新生成
-> 再审题
-> 通过则入库，不通过继续循环
```

### 6.1 可原题修复的问题

这些问题优先走 `repair_in_place`：

- 正确答案标注错误，但题干、选项、解析可修。
- 多个正确答案，但可以通过调整选项消歧。
- 选项过近、过弱或干扰项无效。
- 解析缺步骤、解析和答案不一致。
- 英文版本缺失或双语 metadata 缺失。
- LaTeX / 数学符号格式错误。
- `readingLoad` 或 `calculationLoad` 轻微不匹配。
- 题型基本正确，但问法需要更贴合目标画像。
- `human_review` 的原因是软警告。

### 6.2 必须重生的问题

这些问题走 `hard_regenerate`：

- 超纲。
- topic 不匹配。
- 与真题或既有题高度相似。
- 题干不可用或逻辑不成立。
- 题型和目标完全不符。
- 难度偏离严重，修复会改变题目核心。
- 目标画像来自过期大纲或过期真题画像。
- provider 返回结构损坏，无法可靠恢复。

### 6.3 修复次数

建议配置：

```ts
const SUBJECT_REPAIR_MAX_ATTEMPTS_PER_CANDIDATE = 2;
const SUBJECT_REGENERATE_MAX_ATTEMPTS_PER_GAP = 20;
const SUBJECT_NO_PROGRESS_BLOCK_THRESHOLD = 10;
```

含义：

- 单道候选最多原题修复 2 次。
- 一个 gap 可以继续生成，直到合格题达标。
- 如果连续 10 次没有新增合格题，标记为 `blocked`，前端提示需要检查 prompt / 画像 / provider，而不是无限烧 token。

开发阶段可以把阈值调高，但必须可见、可配置、可追踪。

## 7. 数据结构改造

### 7.1 候选生成 metadata

所有科目训练 AI 候选必须写入：

```ts
type SubjectPracticeGenerationMetadata = {
  intendedUse: 'subject_practice';
  targetUseCase: 'subject_practice';
  sourceKind: 'syllabus' | 'syllabus_and_past_paper_profile';
  generationMode:
    | 'subject_gap_fulfillment'
    | 'subject_candidate_repair'
    | 'subject_candidate_regenerate'
    | 'subject_expansion';
  topicId: number;
  topicCode?: string;
  syllabusVersion: string;
  styleProfile?: {
    id: number;
    profileVersion: number;
    confidence: string;
    sampleSize: number;
    scopeType: string;
    referencePolicy: 'profile_only';
  } | null;
  targetProfile: {
    difficultyBand: 'basic' | 'medium' | 'hard';
    questionForm: string;
    cognitiveSkill: string;
    readingLoad: 'low' | 'medium' | 'high';
    calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
    distractorTypes: string[];
    commonMisconceptions: string[];
    estimatedTimeSeconds?: number | null;
  };
  gapKey: string;
  sourceJobId?: number;
  repairOfQuestionId?: number;
  repairAttempt?: number;
  createdAt: string;
};
```

### 7.2 审题 metadata

Reviewer 输出必须稳定包含：

```ts
type SubjectPracticeReviewMetadata = {
  gate: {
    decision:
      | 'publishable'
      | 'human_review'
      | 'needs_edit'
      | 'regenerate'
      | 'blocked';
    publishable: boolean;
    reasons: string[];
    checkedAt: string;
  };
  profileAlignment: {
    status: 'passed' | 'warning' | 'failed' | 'not_checked';
    score: number;
    reasons: string[];
    targetProfile: SubjectPracticeGenerationMetadata['targetProfile'];
  };
  repairStrategy?: {
    strategy: 'repair_in_place' | 'hard_regenerate' | 'manual_review';
    reasonCodes: string[];
    nextAttempt?: number;
  };
  localization: {
    hasZh: boolean;
    hasEn: boolean;
  };
};
```

### 7.3 正式题库映射

正式题库必须和业务线分开。

短期可接受：

- `CscaQuestion` 继续作为 AI 题目资产底表。
- 科目训练通过专门映射进入专项/科目题库。
- 在线模考通过 mock approval / draft paper assembly 进入在线模考题库。

必须保证：

```text
CscaQuestion.id
  -> SubjectPracticeQuestionMapping / SpecialPractice mapping
  -> 科目训练可用

CscaQuestion.id
  -> MockExamCandidatePool / MockExamDraftQuestion mapping
  -> 在线模考可用
```

不要仅靠 `CscaQuestion.status = approved` 判断一题是否正式可训练或可模考。

## 8. 后端实施任务

### 8.1 Topic gap 计算升级

位置：

- `backend/src/ai-questioning/ai-questioning.service.ts`

重点函数：

- `deriveTopicQuestionGap`
- `targetProfileFromStyleProfile`
- topic health / coverage query

改造要求：

1. `deriveTopicQuestionGap` 不只返回缺多少题，还要返回缺哪类题。
2. gap 应优先读取 active style profile 的分布。
3. 如果画像缺 `cognitiveSkill`，用 normalizer 推断，不再长期返回 `unknown`。
4. `unknown` 只能作为低置信 fallback，不能成为主生成目标。
5. topic health 要返回 `approvedPracticeCount`，不是只返回 candidateCount。

验收：

- 数学有真题画像时，gap 中不应大量出现 `cognitiveSkill = unknown`。
- 没有真题画像的学科可以生成 syllabus-only 题，但前端要明确提示“未使用真题画像，自动入库门槛更高或需要管理员确认策略”。

### 8.2 科目训练闭环任务

新增或改造现有 generation job：

```ts
type SubjectPracticeGenerationJob = {
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

可以先复用现有 `ai_generation_jobs`，但 `prompt_metadata` 必须能表达这些字段。

新增服务入口：

```ts
fulfillSubjectTopicGap(topicId, options)
fulfillSubjectGap(jobId)
processSubjectPracticeGenerationJob(jobId)
repairSubjectPracticeCandidate(questionId, repairFeedback)
publishSubjectPracticeCandidate(questionId)
```

闭环伪代码：

```ts
while (approvedCount < targetApprovedCount) {
  const candidate = await generateOrRepairNextCandidate();
  const review = await review(candidate);

  if (review.gate.publishable) {
    await publishToSubjectPracticeBank(candidate);
    approvedCount += 1;
    noProgressCount = 0;
    continue;
  }

  const strategy = decideRepairStrategy(review);

  if (strategy === 'repair_in_place' && candidate.repairAttempt < maxRepairAttempts) {
    await enqueueRepair(candidate);
    continue;
  }

  if (strategy === 'hard_regenerate') {
    await enqueueRegenerateSameGap();
    noProgressCount += 1;
    continue;
  }

  noProgressCount += 1;
  if (noProgressCount >= noProgressThreshold) {
    markBlocked();
    break;
  }
}
```

### 8.3 自动入科目题库

新增或收敛一个发布函数：

```ts
publishToSubjectPracticeBank(questionId, context)
```

要求：

1. 校验 `intendedUse = subject_practice`。
2. 校验 gate publishable。
3. 校验双语 metadata。
4. 写入专项/科目题库映射。
5. 写入审计日志。
6. 幂等：重复调用不会重复入库。

### 8.4 队列健康

现有生成队列健康要拆出 subject practice 维度：

```ts
type SubjectPracticeQueueHealth = {
  queued: number;
  running: number;
  repairing: number;
  approved: number;
  blocked: number;
  noProgress: number;
  activeJobs: Array<{
    id: number;
    topicTitle: string;
    gapKey: string;
    approvedCount: number;
    targetApprovedCount: number;
    latestIssue?: string;
  }>;
};
```

前端不应只显示“生成中 / 失败”，而要显示“还差几道合格题”。

## 9. Reviewer / Validator 实施任务

### 9.1 科目训练门禁

在 `question-reviewer.service.ts` / `question-validator.service.ts` 中明确科目训练 gate：

硬拦截：

- 答案错误。
- 多答案。
- 超纲。
- topic mismatch。
- 与真题或已发布题高度相似。
- 缺题干、缺选项、缺解析。
- 数学符号结构不可渲染。
- 双语缺失。

软警告：

- 画像轻微偏差。
- 选项区分度偏弱但可修。
- 解析可读性不足。
- 难度证据不够。

软警告默认不自动入库，进入修复或人工确认；自动闭环优先尝试修复。

### 9.2 修复反馈

Reviewer 要输出机器可用的 `repairFeedback`：

```ts
type RepairFeedback = {
  repairable: boolean;
  reasonCodes: string[];
  fieldsToRepair: Array<'stem' | 'options' | 'correctAnswer' | 'explanation' | 'localization' | 'metadata'>;
  instructions: string[];
};
```

示例：

```json
{
  "repairable": true,
  "reasonCodes": ["multiple_correct_options", "weak_distractors"],
  "fieldsToRepair": ["options", "explanation"],
  "instructions": [
    "Keep the stem and target topic.",
    "Change distractor B and D so only A is correct.",
    "Explain why the new distractors are wrong."
  ]
}
```

## 10. 前端实施任务

### 10.1 信息架构

AI Question Bank 页面应保持三段：

```text
1 共用准备
  - 大纲基线
  - 真题画像源

2 科目训练线
  - 知识点题库健康
  - 缺题画像
  - 自动补齐合格题
  - 科目候选治理
  - 已审核科目资产
  - 科目质量治理

3 在线模考线
  - 整卷蓝图
  - 题位
  - 自动补齐 48/48
  - 在线模考候选治理
  - 已审核模考资产
  - 装配草稿卷
```

### 10.2 科目训练主面板

`CoverageWorkPanel.tsx` 应从“补蓝图/补候选/追加候选”升级为：

```text
知识点题库健康
  当前学科：数学
  topic：不等式的基本性质与解法
  目标：6 道合格训练题
  已合格：4
  待修复：2
  阻塞：0
  状态：自动补齐中

操作：
  补齐合格题
  暂停/恢复
  查看失败原因
  查看已入库题
```

按钮文案应避免“生成候选”作为主动作，改成：

- `补齐合格训练题`
- `按缺题画像补齐`
- `处理可修复候选`
- `查看待治理候选`

### 10.3 候选治理面板

候选治理只展示未入库或异常题：

- `review_failed`
- `needs_edit`
- `human_review`
- `fallback`
- `rejected`

已通过门禁并自动入库的题，不应继续混在候选治理列表里。

候选列表说明文案：

```text
这里展示未入库的异常候选，用于查看失败原因、复审、编辑、拒绝或归档；门禁通过题会自动进入已审核科目资产。
```

### 10.4 已审核资产面板

已审核资产面板展示正式可用题：

- 科目训练题。
- 在线模考题。

但必须按当前业务线过滤。

科目训练线展示：

```text
已审核科目训练题 34/目标 60
已进入专项/科目训练题库，可被用户训练抽题。
```

在线模考线展示：

```text
已审核在线模考题 48/48
已进入在线模考候选池，可装配草稿卷。
```

### 10.5 自动刷新

科目训练线也需要像在线模考线一样：

- 生成队列有 running / queued / repairing 时自动刷新。
- 新生成或新修复失败的异常候选排在前面。
- 面板内提供 `刷新候选`，不要求刷新整页。
- 刷新不改变当前 tab / useCase / subject / status / pagination。

## 11. API 设计

建议新增或收敛以下接口：

```text
GET  /api/v1/admin/ai-questioning/subject-practice/health
POST /api/v1/admin/ai-questioning/subject-practice/topics/:topicId/fulfill
POST /api/v1/admin/ai-questioning/subject-practice/jobs/:jobId/process
POST /api/v1/admin/ai-questioning/subject-practice/candidates/:questionId/repair
POST /api/v1/admin/ai-questioning/subject-practice/candidates/:questionId/publish
POST /api/v1/admin/ai-questioning/subject-practice/candidates/clear
GET  /api/v1/admin/ai-questioning/candidates?useCase=subject_practice
GET  /api/v1/admin/ai-questioning/published?useCase=subject_practice
```

如果暂时不新增路由，也必须保证现有接口都带：

```text
useCase=subject_practice
```

并在后端强制过滤。

## 12. 清理与重测能力

开发阶段需要内置清理功能，避免旧候选污染判断。

### 12.1 后台清理按钮

科目训练线提供：

- 删除当前学科所有未入库候选。
- 删除当前 topic 所有未入库候选。
- 删除当前学科 AI 生成任务。
- 删除当前 topic AI 生成任务。
- 删除当前学科已入库 AI 题。
- 删除当前 topic 已入库 AI 题。

危险操作必须二次确认，并展示影响范围。

### 12.2 后端清理要求

清理必须按 scope：

```ts
{
  useCase: 'subject_practice',
  subject?: string,
  topicId?: number,
  includeApproved?: boolean,
  includeJobs?: boolean
}
```

不能误删在线模考题。

## 13. 实施顺序

### 阶段 A：先修数据隔离与可见性

1. 全部 candidate / published / ledger / quality 查询加 `useCase` 强过滤。
2. 前端切换 useCase / subject / mock paper 时清空旧列表并重新加载。
3. 已审核资产按业务线分开展示。
4. 候选治理只展示未入库异常题。
5. 增加科目训练清理功能。

验收：

- 切到数学卷 2，不再看到数学卷 1 的在线模考候选。
- 切到科目训练，不再看到在线模考候选。
- 清理科目训练候选不影响在线模考题。

### 阶段 B：升级科目训练 gap 和 targetProfile

1. `deriveTopicQuestionGap` 输出维度化 gap。
2. `targetProfileFromStyleProfile` 不再长期返回 `unknown`。
3. gap 使用真题画像的题型/技能/负载分布。
4. 没有画像时显示 syllabus-only 状态。

验收：

- 数学有画像时，targetProfile 包含明确 `questionForm/cognitiveSkill/readingLoad/calculationLoad`。
- 化学/物理如果没有真题画像，失败原因应是缺画像或按 syllabus-only 策略处理，而不是误报缺大纲。

### 阶段 C：实现科目训练自动闭环

1. 新增 `fulfillSubjectTopicGap`。
2. 生成任务从“产候选”改为“补合格题”。
3. 审题通过后自动入科目训练题库。
4. 不通过时自动判断修复/重生。
5. 连续无进展时阻塞并展示原因。

验收：

- 点击“补齐合格训练题”后，系统持续运行，直到目标合格题数量达标或进入 blocked。
- 候选数量增加不代表成功；正式合格题数量会同步增长。
- 通过门禁题自动进入已审核科目资产。

### 阶段 D：修复优先策略

1. Reviewer 输出 `repairFeedback`。
2. 可修复题走 `autoRepairQuestionDraft` 或等价服务。
3. 修复后复审。
4. 修复失败超过阈值才重生。

验收：

- 选项过近、多答案、答案标注错误、解析不完整类问题会优先原题修复。
- topic mismatch、超纲、相似度高会直接重生。

### 阶段 E：前端任务体验收口

1. 任务卡展示 `目标 / 已合格 / 待修复 / 阻塞`。
2. 自动刷新候选和已审核资产。
3. 新题按更新时间倒序。
4. 面板内刷新不跳 tab。
5. 操作文案改成“补齐合格训练题”。

验收：

- 管理员能一眼看出某 topic 是否已经可训练。
- 不需要刷新整页就能看到新入库题。

## 14. 测试计划

### 14.1 单元测试

新增测试：

- `deriveTopicQuestionGap` 能从 style profile 派生维度化缺口。
- `targetProfileFromStyleProfile` 不返回无意义 unknown 主目标。
- `decideSubjectRepairStrategy` 正确区分可修复/不可修复。
- `publishToSubjectPracticeBank` 幂等。
- candidate 查询按 useCase 隔离。

### 14.2 服务测试

新增测试：

- 有 active 真题画像时，生成 metadata 包含 `syllabus_and_past_paper_profile`。
- 没有画像时，系统按 syllabus-only 策略或明确阻塞，不误报缺大纲。
- 科目训练闭环能从 0 合格题补到目标数量。
- `human_review` 不会自动入库。
- 双语缺失不会自动入库，会进入修复。

### 14.3 前端测试

新增测试：

- 切换 useCase 后候选列表隔离。
- 切换 subject 后候选列表刷新。
- 科目训练任务卡展示合格题进度。
- 候选治理列表不展示已自动入库题。
- 面板刷新不改变 tab。

### 14.4 手工验收脚本

推荐本地验收：

```text
1. 清理数学科目训练 AI 候选和生成任务。
2. 确认数学有 active 真题画像。
3. 选择一个数学 topic，点击补齐合格训练题。
4. 观察任务状态：已合格数量应增长。
5. 查看候选治理：只显示未通过/需修复候选。
6. 查看已审核资产：通过门禁题自动进入。
7. 进入用户侧科目训练，确认能抽到新题。
8. 切换在线模考线，确认不会看到科目训练候选。
```

## 15. 发布与线上处理

因为当前仍是开发阶段，但已有线上部署，建议采用“干净架构 + 一次性迁移 + 可回滚备份”的方式。

### 15.1 上线前

1. 备份数据库。
2. 停止后台生成 worker。
3. 跑 migration。
4. 跑 metadata backfill。
5. 跑 useCase 隔离校验脚本。
6. 跑 build 和核心测试。
7. 启动后端。
8. 在后台先只对一个学科打开自动补齐。

### 15.2 兼容策略

开发阶段不需要长期兼容旧架构，但上线时不能让旧数据导致页面崩溃。

最低兼容：

- 缺 `generationMetadata` 的旧题不参与自动闭环。
- 缺 `targetProfile` 的旧题不自动算作画像增强题。
- 缺 `useCase` 的候选默认不进入任一新线，放到 legacy/待归档。
- 旧已发布科目题继续可训练，但不计入“画像增强合格题”指标。

### 15.3 回滚策略

如果上线后科目训练自动补题异常：

1. 关闭 subject practice auto fulfillment feature flag。
2. 保留手工专项题库和旧训练题。
3. 在线模考线不受影响。
4. 新生成的科目候选可批量归档，不删除正式题库旧题。

## 16. 验收标准

本方案完成后，应满足：

1. 科目训练和在线模考在前端流程上完全分叉。
2. 科目训练和在线模考正式题库资产分开。
3. 科目训练补题以“合格题达标”为目标，不以“候选数量”为目标。
4. 门禁通过题自动进入科目训练题库。
5. 未通过题只进入待治理候选。
6. 可修复问题优先原题优化。
7. 不可修复问题自动重生。
8. 连续无进展会显示 blocked 和原因，不无限生成垃圾候选。
9. 数学已有真题画像时，科目训练 targetProfile 不应大量 unknown。
10. 没有真题画像的学科不会误报缺大纲。
11. 管理员能清理当前学科/topic 的测试数据。
12. 用户侧科目训练能消费新入库题，且数学符号正常渲染。

## 17. 推荐第一轮开发切片

为了降低风险，第一轮只做数学科目训练闭环：

1. 锁定 `subject = math`。
2. 选择 1-2 个 topic。
3. 清理旧候选。
4. 实现 useCase 隔离和科目清理。
5. 实现 gap -> targetProfile。
6. 实现“补齐 3 道合格训练题”的小闭环。
7. 验证自动修复、自动入库、用户侧可训练。
8. 再扩到全数学。
9. 最后扩到物理/化学。

这样可以避免一次性改全学科、全 topic、全 UI，导致问题难以定位。
