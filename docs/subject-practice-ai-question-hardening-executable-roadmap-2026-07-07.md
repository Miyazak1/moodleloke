# 科目训练 AI 出题优化落地执行路线图

> 日期：2026-07-07  
> 状态：可执行方案  
> 范围：科目训练 AI 出题、真题画像适配、targetProfile、候选修复、正式入库、数学渲染、双语版本、清理重测、上线发布  
> 关联文档：
> - `docs/ai-questioning-dual-line-final-execution-plan-2026-07-07.md`
> - `docs/ai-questioning-dual-line-implementation-work-orders-2026-07-07.md`
> - `docs/ai-questioning-subject-optimization-and-math-rendering-execution-plan-2026-07-07.md`
> - `docs/subject-practice-ai-question-quality-hardening-plan-2026-07-07.md`
> - `docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`
> - `docs/subject-training-profile-adaptation-implementation-spec-2026-07-03.md`

## 1. 背景判断

在线模考线已经接近正确形态：

```text
真题画像 -> 整卷蓝图 -> 题位 -> 自动生成/修复/复审
-> 每个题位 1 道门禁通过题
-> 48/48 后进入在线模考题库
-> 装配草稿卷
```

科目训练线现在的问题不是“缺一个生成按钮”，而是闭环还没有按正式题库口径收紧：

```text
候选题越来越多
但正式可训练题没有稳定增加
```

因此，科目训练下一步的目标不是继续堆候选，而是把它升级成和在线模考同等级的自动闭环：

```text
大纲基线 + 真题画像
-> 计算 topic/gap 缺口
-> 生成或修复候选题
-> 门禁通过
-> 自动进入科目训练/专项训练正式题库
-> 达标后停止
-> 异常题进入候选治理
```

核心原则：

1. 候选数量不是成功指标，正式入库题数量才是成功指标。
2. 不降低门禁来提高通过率。
3. 可修复题先原题修复，硬伤题才重生。
4. 通过门禁的题自动入库，不需要人工再确认。
5. 缺英文、数学不可渲染、需要人工确认、建议重生的题不能自动入库。
6. 科目训练和在线模考从 AI 出题开始分线，题库、候选、任务、统计都不能混用。

## 2. 目标完成态

### 2.1 科目训练完成态

每个 topic/gap 有明确目标数量：

```ts
type SubjectPracticeGapReadiness = {
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicId: number;
  topicCode: string;
  gapKey: string;
  targetProfile: SubjectTargetProfile;
  targetApprovedCount: number;
  approvedPracticeCount: number;
  repairableCandidateCount: number;
  abnormalCandidateCount: number;
  noProgressCount: number;
  status:
    | 'missing_syllabus'
    | 'missing_profile'
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

不能用候选题数量、生成任务数量、审核通过但未入库数量替代。

### 2.2 正式科目训练题口径

正式可训练题必须同时满足：

```text
csca_questions.status = approved
+ generationMetadata.scope.targetUseCase = subject_practice
+ generationMetadata.scope.topicId = 当前 topic
+ generationMetadata.scope.gapKey = 当前 gap
+ special practice / subject practice 映射存在
+ 映射状态 = active 或 published
+ localizations.zh 完整
+ localizations.en 完整
+ mathTextGate = passed
+ 不带 online_mock_exam approval / assembly 状态
```

### 2.3 候选治理口径

候选治理不是成功题库列表，只展示未入库异常题：

```text
pending_review
review_failed
needs_edit
human_review
repairable
repair_exhausted
regenerate
math_text_invalid
missing_bilingual_localization
profile_alignment_warning
blocked
```

不展示：

```text
已进入科目训练正式题库的题
已进入在线模考候选池的题
已装配进在线模考草稿卷的题
已拒绝/已归档且不再处理的题
当前 scope 外的题
legacy 旧数据，除非用户切换历史筛选
```

## 3. 数据边界

### 3.1 共用准备层

大纲和真题画像共用：

```text
大纲基线：
  subject / syllabusVersion / topicId / topicCode / topicTitle

真题画像：
  questionForm
  cognitiveSkill
  difficultyBand
  readingLoad
  calculationLoad
  estimatedTimeSeconds
  distractorTypes
  commonMisconceptions
  answerDistribution
```

共用准备层只回答两件事：

```text
1. 能考什么。
2. 真题通常怎么考。
```

它不决定题进入科目训练还是在线模考。

### 3.2 分叉治理层

AI 出题开始后必须分叉：

```text
科目训练线：
  topic/gap -> subject_practice candidate -> gate
  -> subject practice bank / special practice bank

在线模考线：
  source paper -> blueprint -> slot
  -> online_mock_exam candidate -> gate
  -> mock candidate pool -> draft paper
```

每道新 AI 题必须写入：

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

短期写入 `generationMetadata.scope`，稳定后再迁移为物理字段。

## 4. 真题画像与 targetProfile 适配

### 4.1 必填 targetProfile

科目训练每个 gap 必须生成明确 targetProfile：

```ts
type SubjectTargetProfile = {
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicId: number;
  topicCode: string;
  gapKey: string;
  difficultyBand: 'basic' | 'medium' | 'hard';
  questionForm: string;
  cognitiveSkill: string;
  readingLoad: 'low' | 'medium' | 'high';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  estimatedTimeSeconds?: number;
  distractorTypes?: string[];
  commonMisconceptions?: string[];
  sourceProfileStatus: 'active' | 'inferred' | 'syllabus_only' | 'missing';
};
```

### 4.2 `unknown` 处理规则

`cognitiveSkill = unknown` 不能作为高置信自动生成目标长期存在。

处理顺序：

1. 优先读取真题画像字段。
2. 如果画像字段缺失，从题干、答案、解析、题型、计算量推断。
3. 如果上传 JSON 只有原题格式，没有画像维度，则由解析层补维度。
4. 如果仍无法推断，标记 `sourceProfileStatus = missing` 或 `profile_incomplete`。
5. `profile_incomplete` 的 gap 不能进入高置信自动入库，只能进入阻塞或人工补画像。

推断参考：

```text
含方程、函数、概率、几何计算 -> calculation / standard_application
要求判断命题、比较性质 -> concept_discrimination
要求解释原因或证明步骤 -> reasoning / multi_step_reasoning
只考定义识别 -> recall / concept_identification
带图表、图形、坐标系 -> diagram_interpretation / visual_reasoning
```

### 4.3 数学、化学、物理差异

数学：

```text
已有真题画像时，必须使用画像维度。
如果仍出现大量 cognitiveSkill = unknown，说明画像解析或映射没有接上。
```

化学/物理：

```text
如果没有上传真题画像，可以使用大纲做 syllabus_only 生成，
但页面和任务原因必须明确显示“缺真题画像”，不能误报“缺大纲”。
```

## 5. 生成与修复策略

### 5.1 主循环

```ts
while (approvedPracticeCount < targetApprovedCount) {
  const repairable = await findRepairableCandidate(scope);

  if (repairable) {
    const repaired = await repairCandidateInPlace(repairable);
    const reviewed = await reviewAndGate(repaired);

    if (reviewed.gateDecision === 'passed') {
      await publishToSubjectPracticeBank(repaired.id);
      continue;
    }

    await recordRepairResult(repaired.id, reviewed);
    continue;
  }

  const draft = await generateCandidateForGap(scope, targetProfile);
  const reviewed = await reviewAndGate(draft);

  if (reviewed.gateDecision === 'passed') {
    await publishToSubjectPracticeBank(draft.id);
    continue;
  }

  if (reviewed.repairability === 'repair_in_place') {
    await enqueueRepair(draft.id);
    continue;
  }

  await markAsRegenerateSeedOrBlocked(draft.id, reviewed);
}
```

### 5.2 可原题修复

以下问题优先原题修复：

```text
missing_bilingual_localization
math_text_invalid
latex_escape_invalid
wrong_correct_answer
multiple_correct_answers
option_too_close
weak_distractor
explanation_incomplete
explanation_answer_mismatch
minor_reading_load_mismatch
minor_calculation_load_mismatch
profile_alignment_warning
```

修复要求：

1. 保留题目核心知识点。
2. 保留 `scope`。
3. 保留 `targetProfile`。
4. 递增 `repairAttempt`。
5. 修复后重新跑 reviewer、数学门禁、双语门禁、相似度门禁。
6. 单题最多自动修复 3 次。

### 5.3 必须重生

以下问题不应原题修复：

```text
topic_mismatch
syllabus_mismatch
cognitive_skill_mismatch_hard
question_form_mismatch_hard
difficulty_mismatch_hard
source_similarity_too_high
existing_question_similarity_too_high
prompt_leak
invalid_question_stem
insufficient_conditions
unsupported_image_dependency
scope_mismatch
repair_exhausted
```

重生要求：

1. 原候选标记为 `regenerate_replaced` 或 `archived`。
2. 新候选继承原 scope 和 targetProfile。
3. prompt 必须带上上一题失败原因。
4. 重生不增加目标数量，只继续填补同一个 gap。

### 5.4 防无限循环

```ts
const MAX_REPAIR_ATTEMPTS_PER_CANDIDATE = 3;
const MAX_GENERATION_ATTEMPTS_PER_GAP = 30;
const NO_PROGRESS_BLOCK_THRESHOLD = 10;
const PROVIDER_FAILURE_BLOCK_THRESHOLD = 8;
```

进入 `blocked` 的条件：

```text
连续 10 次没有新增正式入库题
同一 candidate 修复 3 次仍失败
同一 gap 生成 30 次仍无合格题
provider 连续失败 8 次
缺大纲或缺必要画像
```

blocked 后：

```text
停止生成
前端显示最新阻塞原因
保留异常候选供排查
不污染正式题库
```

## 6. 门禁标准

### 6.1 自动入库硬门禁

自动进入科目训练题库必须全部满足：

1. `targetUseCase = subject_practice`。
2. subject/topic/gap 与当前 scope 一致。
3. reviewer 达到通过阈值。
4. `gateDecision = passed`。
5. 没有 `human_review`、`needs_edit`、`review_failed`、`fallback`。
6. 正确答案唯一。
7. 选项数量和格式正确。
8. 解析与答案一致。
9. 不超纲。
10. 与真题相似度低于阈值。
11. 与已入库题相似度低于阈值。
12. `localizations.zh` 完整。
13. `localizations.en` 完整。
14. 数学文本可被统一数学组件渲染。
15. 不是在线模考候选。

### 6.2 不能自动入库

以下状态不能入库：

```text
pending_review
review_failed
needs_edit
human_review
repairable
fallback
regenerate
rejected
archived
math_text_invalid
missing_bilingual_localization
profile_incomplete
blocked
```

### 6.3 人工确认定位

人工确认不是默认生产路径，只用于：

```text
边界题放行
规则校准
reviewer 样本回收
线上问题排查
```

默认闭环不能依赖人工确认才能完成。

## 7. 数学符号与渲染

### 7.1 后端规范化

生成、修复、手工编辑、导入后都要跑数学文本规范化：

```ts
normalizeMathText(question.prompt)
normalizeMathText(option.text)
normalizeMathText(question.explanation)
normalizeMathText(localizations.zh.prompt)
normalizeMathText(localizations.zh.explanation)
normalizeMathText(localizations.en.prompt)
normalizeMathText(localizations.en.explanation)
```

规则：

```text
裸 \frac / \dfrac / \sqrt / \leq / \geq 自动包入数学定界符
双反斜杠降噪
检查 {} 成对
检查 $ 成对
检查 \left / \right 成对
禁止把整段中文自然语言包进公式
行内公式使用 inline math
长推导使用 block math 或文本分段
```

### 7.2 门禁检查

数学门禁需要输出：

```ts
type MathTextGateResult = {
  status: 'passed' | 'failed';
  issueCodes: string[];
  normalizedFields: string[];
  renderSmokePassed: boolean;
};
```

失败时：

```text
math_text_invalid -> repair_in_place
```

修复 3 次仍失败：

```text
repair_exhausted -> regenerate
```

### 7.3 前端统一入口

后台、科目训练、在线模考都必须使用统一组件：

```text
MathText
QuestionStem
QuestionOption
QuestionExplanation
```

前端布局要求：

1. 不允许 KaTeX 输出撑破选项容器。
2. 选项和解析使用 `overflow-wrap: anywhere`。
3. 长公式使用横向滚动或 block math，不压缩成重叠 DOM。
4. 解析区按段落渲染，不把一整段混进一个公式节点。
5. 公式渲染失败时展示原文和错误标记，不破坏页面布局。

## 8. 前端后台改造

### 8.1 科目训练生成面板

展示口径从“候选多少”改为：

```text
当前 topic/gap
目标正式题数
已入库正式题数
还差几道
正在修复几道
正在生成几道
异常候选几道
阻塞原因
```

按钮状态：

```text
未达标：补齐 / 继续处理
处理中：暂停 / 刷新
达标：已完成，不允许继续生成
blocked：查看原因 / 清理重测 / 重新计算画像
```

### 8.2 候选治理面板

标题改为：

```text
科目训练 AI 候选治理与兜底
```

说明改为：

```text
这里只展示未入库的异常候选。门禁通过题会自动进入科目训练题库，不再出现在这里。
```

筛选：

```text
学科
topic
gap
失败原因
repairable / regenerate / blocked
生成批次
创建时间
```

排序：

```text
最新失败优先
repairable 优先
blocked 单独分组
```

### 8.3 已入库资产面板

新增或强化：

```text
科目训练已入库 AI 题
```

展示：

```text
题号
topic/gap
targetProfile
生成时间
入库时间
版本
双语状态
数学门禁状态
来源任务
删除/下架
```

### 8.4 清理删除

需要支持：

```text
删除单题候选
批量删除当前筛选候选
清理当前 topic/gap 的异常候选
清理当前 topic/gap 的 AI 已入库题
清理当前任务生成结果
清理当前 mock 卷生成结果
```

所有清理必须按 scope 执行，不允许跨学科、跨 topic、跨 mock 卷误删。

## 9. 后端执行工单

### BE-01 补齐 targetProfile 画像映射

涉及文件：

```text
backend/src/ai-questioning/source-question-profile-normalizer.ts
backend/src/ai-questioning/ai-questioning.service.ts
```

任务：

1. 从真题画像读取 `questionForm/cognitiveSkill/readingLoad/calculationLoad`。
2. 旧 JSON 缺字段时从题干、选项、答案、解析推断。
3. `unknown` 不作为高置信默认值。
4. 缺画像和缺大纲分别报错。

验收：

```text
数学已有真题画像时，targetProfile.cognitiveSkill 不应大量为 unknown。
化学/物理无画像时，页面提示 missing_profile 或 syllabus_only，不提示 missing_syllabus。
```

### BE-02 科目缺口按正式题统计

涉及文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/csca-special-practice/csca-adaptive.service.ts
backend/src/csca-special-practice/adaptive-question-provider.service.ts
```

任务：

1. `approvedPracticeCount` 只统计正式入库题。
2. 排除 online mock scope。
3. 排除 legacy。
4. topic/gap 达标只看正式入库数量。

验收：

```text
候选 100 道但入库 0，topic 仍不 ready。
入库 1 道，gap approvedCount +1。
在线模考题不会出现在科目训练池。
```

### BE-03 修复优先队列

涉及文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/ai-questioning/question-generator.service.ts
backend/src/ai-questioning/question-reviewer.service.ts
```

任务：

1. 把 reviewer issue 映射成 `repairability`。
2. repairable 优先修复。
3. hard issue 才重生。
4. 修复后重新门禁。
5. 记录修复次数和原因。

验收：

```text
缺英文题先补英文，不直接重生。
选项过近题先修选项，不直接重生。
topic mismatch 直接重生。
source similarity too high 直接重生。
```

### BE-04 自动入库函数收敛

涉及文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/csca-special-practice/csca-special-practice.service.ts
```

任务：

1. 抽出 `publishToSubjectPracticeBank(questionId, context)`。
2. publish 前统一跑硬门禁。
3. 幂等检查，重复调用不重复入库。
4. publish 成功后候选治理不再展示该题。

验收：

```text
门禁通过题自动进入正式题库。
缺英文题 publish 被拒绝并进入修复。
重复 publish 不产生重复映射。
```

### BE-05 数学文本门禁

涉及文件：

```text
backend/src/ai-questioning/*
frontend/src/components/*
frontend/src/pages/*
```

任务：

1. 后端新增数学文本规范化和 gate。
2. 生成/修复/手工编辑后都跑 gate。
3. 前端统一使用数学渲染组件。
4. 布局防止公式重叠。

验收：

```text
\frac、\sqrt、上下标、集合、区间能正常显示。
解析区不重叠。
选项容器不被公式撑坏。
后台、科目训练、在线模考显示一致。
```

### BE-06 清理重测接口

任务：

1. 支持按 scope 删除候选。
2. 支持按 scope 删除已入库 AI 题及映射。
3. 支持单题删除。
4. 支持批量删除当前筛选。
5. 所有删除记录审计日志。

验收：

```text
清理数学卷 1 不影响数学卷 2。
清理科目训练 topic 不影响在线模考。
清理已入库 AI 题后正式题计数下降。
```

## 10. 前端执行工单

### FE-01 科目生成状态改口径

任务：

1. 状态卡展示 `已入库/目标`。
2. 候选数改为异常治理指标。
3. 达标后禁用继续生成。
4. blocked 展示阻塞原因和清理重测入口。

验收：

```text
用户能一眼看出还差几道正式题。
达标后不再继续生成。
```

### FE-02 候选治理只显示异常候选

任务：

1. 过滤已入库题。
2. 过滤 mock 题。
3. 增加 failure reason 筛选。
4. 最新异常排前面。

验收：

```text
门禁通过并入库后从候选列表消失。
失败题保留并显示明确原因。
```

### FE-03 已入库资产可删除

任务：

1. 单题下架/删除。
2. 当前 topic/gap 批量清理。
3. 操作前确认。
4. 操作后局部刷新。

验收：

```text
删除后计数和列表同步更新。
不会刷新整页跳回流程总览。
```

### FE-04 数学渲染统一

任务：

1. 所有题干/选项/解析走统一组件。
2. block math 与 inline math 分开处理。
3. 长公式容器横向滚动。
4. 渲染失败不破坏布局。

验收：

```text
后台候选治理、已入库资产、科目训练、在线模考均正常显示数学符号。
```

## 11. 执行顺序

### 第一阶段：先止血

目标：不再继续制造混乱数据。

1. 强制 scope 隔离。
2. 科目候选列表排除 online mock。
3. online mock 候选列表按 mockBlueprintId 隔离。
4. 候选治理隐藏已入库题。
5. 清理当前测试数据。

验收后再继续。

### 第二阶段：画像和缺口

目标：让科目训练知道自己要生成什么。

1. 补齐 `targetProfile` 映射。
2. 修正 `unknown cognitiveSkill`。
3. 缺画像和缺大纲分开报错。
4. topic/gap 缺口按正式入库题统计。

验收后再继续。

### 第三阶段：修复优先闭环

目标：避免候选无限增长。

1. issue code 分类。
2. repairable 原题修复。
3. hard issue 重生。
4. no-progress 自动 blocked。
5. 达标后停止。

验收后再继续。

### 第四阶段：数学和双语硬门禁

目标：通过门禁的题可直接进入用户侧。

1. 后端数学规范化。
2. 双语必填。
3. 前端统一数学渲染。
4. 科目训练和在线模考页面回归。

验收后再继续。

### 第五阶段：上线清理与迁移

目标：干净架构上线，线上不被旧数据拖垮。

1. 新链路默认隐藏 legacy。
2. 旧候选标记 `legacy` 或归档。
3. 当前测试 scope 清理。
4. 保留回滚脚本。
5. 发布后监控 provider、blocked、入库率。

## 12. 验收清单

### 12.1 数据验收

```text
新科目题都有 scope.targetUseCase = subject_practice。
新模考题都有 scope.targetUseCase = online_mock_exam。
数学卷 1 和卷 2 候选互不显示。
online mock 题不会进入科目训练正式池。
subject practice 题不会进入 online mock 候选池。
```

### 12.2 画像验收

```text
数学已有真题画像时，targetProfile 有 questionForm/cognitiveSkill/readingLoad/calculationLoad。
cognitiveSkill 不应大面积 unknown。
化学/物理没画像时提示 missing_profile，不提示缺大纲。
```

### 12.3 闭环验收

```text
候选增加但未入库时，topic/gap 不显示 ready。
门禁通过题自动入库。
入库达标后停止生成。
异常题保留在候选治理。
连续无进展后进入 blocked，不无限烧 token。
```

### 12.4 质量验收

```text
缺英文题不能入库。
数学不可渲染题不能入库。
需要人工确认题不能入库。
建议重生题不能入库。
选项过近题优先修复。
topic mismatch 题直接重生。
```

### 12.5 前端验收

```text
后台状态显示“已入库/目标”，不是只显示候选数。
候选治理只显示异常候选。
候选和已入库列表支持局部刷新。
数学符号在后台、科目训练、在线模考都正常显示。
删除/清理后当前面板同步刷新，不跳回流程总览。
```

## 13. 发布策略

开发阶段采用干净架构，不兼容旧逻辑作为默认路径。

上线时保留安全处理：

1. 部署前备份数据库。
2. 对旧 AI 题补 `legacy` scope。
3. 新查询默认排除 legacy。
4. 对已知测试批次提供清理脚本。
5. 发布后先只开放 admin 后台。
6. 确认科目训练题池和在线模考题池隔离后，再开放用户侧。

回滚标准：

```text
正式题库映射异常
scope 误删或误过滤
用户侧题目无法展示
数学渲染导致页面大面积异常
provider 任务无法停止
```

## 14. 最小开发任务切片

建议按以下 PR 或提交粒度执行：

1. `scope-isolation`
   - scope 写入、查询过滤、legacy 隐藏。

2. `subject-profile-gap`
   - targetProfile 映射、unknown 修复、正式入库题统计。

3. `subject-repair-loop`
   - issue 分类、repair-first、blocked 防无限循环。

4. `subject-auto-publish`
   - 硬门禁、自动入库、幂等 publish。

5. `math-bilingual-gate`
   - 数学规范化、双语硬门禁、前端统一渲染。

6. `admin-cleanup-and-refresh`
   - 候选治理过滤、局部刷新、单题/批量清理。

7. `release-migration`
   - legacy 标记、测试数据清理、上线检查脚本。

每个切片都必须有规则测试或类型检查，不能只靠页面手测。
