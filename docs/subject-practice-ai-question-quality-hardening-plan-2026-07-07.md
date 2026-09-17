# 科目训练 AI 题质量优化落地执行方案

> 日期：2026-07-07  
> 状态：可执行方案  
> 范围：科目训练 AI 出题、专项题库入库、候选治理、自动修复、双语、数学符号渲染、清理重测  
> 关联文档：
> - `docs/ai-questioning-dual-line-final-execution-plan-2026-07-07.md`
> - `docs/ai-questioning-subject-optimization-and-math-rendering-execution-plan-2026-07-07.md`
> - `docs/subject-practice-ai-question-optimization-executable-plan-2026-07-07.md`

## 1. 目标结论

在线模考线已经基本跑通了“按题位补齐合格题”的方向。下一步科目训练线也要从“生成候选题”升级为“按 topic/gap 补齐正式可训练题”。

科目训练线的最终目标：

```text
大纲基线 + 真题画像
-> 计算科目训练缺口
-> AI 生成候选
-> 自动审题门禁
-> 可修复题原题修复
-> 硬伤题重生替换
-> 门禁通过题自动进入专项/科目训练正式题库
-> 达标后停止
-> 异常题进入候选治理台
```

核心原则：

1. 候选题数量不是成功指标，正式入库题数量才是成功指标。
2. 不降低门禁来换通过率。
3. 可修复问题先原题修复，硬伤问题才重新生成。
4. 通过门禁的题自动入库，不需要人工再点一次通过。
5. 未通过门禁的题只进入“待治理候选”，不进入正式训练题库。
6. 科目训练题和在线模考题从 AI 出题开始分线治理，正式题库也分开。
7. 数学符号和双语版本是入库硬条件。

## 2. 当前问题

### 2.1 候选增加但合格题不增加

现象：

- 候选题不断累积。
- 页面显示很多待治理题。
- 但正式训练题没有增长，或增长很慢。

原因：

- 系统仍容易把“候选产生”当成流程进度。
- 可修复题没有优先修复，而是继续生成新题。
- 生成新题如果提示词或画像不稳定，会持续制造新的异常候选。

### 2.2 失败原因分类不够工程化

现在的失败原因里混合了两类问题：

可修复问题：

- 选项太接近。
- 正确答案标错。
- 多个正确答案。
- 解析缺步骤或与答案不一致。
- 缺英文版本。
- LaTeX 定界符或命令格式不规范。
- 题干或选项表达不清。

硬伤问题：

- 知识点不匹配。
- 难度明显不符合目标。
- 与真题或已入库题高度相似。
- 题干泄露答案。
- 题目不可用或条件不足。
- 当前 topic 缺大纲，无法判断边界。
- 当前学科缺真题画像，但任务要求必须使用画像。
- provider 返回无效 schema，且没有可修复 draft。

两类问题必须分开处理。

### 2.3 数学符号影响入库质量

现象：

- 裸露 `\frac`、`\sqrt`、`\dfrac`。
- 双反斜杠或缺 `$...$` 导致无法渲染。
- KaTeX 输出后高度、换行和选项布局异常。
- 后台、科目训练、在线模考显示不一致。

结论：

数学可渲染性必须进入门禁，不能只靠前端兜底。

### 2.4 双语版本不完整

现象：

- 有些门禁通过题缺 `localizations.en`。
- 已入库题展示“没有双语 metadata”。

结论：

科目训练和在线模考都必须要求完整中英文版本。缺英文不能自动入库。

## 3. 范围和不做事项

本轮做：

- 科目训练 AI 出题闭环。
- 科目题可修复/硬伤分类。
- 原题修复优先策略。
- 正式题库入库口径收紧。
- 候选治理台只显示异常候选。
- 已入库 AI 题清理能力。
- 双语和数学符号硬门禁。
- 后台、科目训练、在线模考统一数学渲染方案。

本轮不做：

- PDF OCR。
- 放宽门禁。
- 把科目训练题和在线模考题混成一个题库。
- 用旧 legacy 数据继续驱动新闭环。
- 用人工审核替代自动闭环。

## 4. 术语定义

### 4.1 正式科目训练题

正式科目训练题不是单纯 `csca_questions.status = approved`。

必须同时满足：

```text
csca_questions.status = approved
+ generationMetadata.scope.targetUseCase = subject_practice
+ special_practice_questions/source_question_id 映射存在
+ 映射状态为 published/active
+ 不带 online_mock_exam mockApproval 状态
+ localizations.zh 和 localizations.en 完整
+ mathTextGate = passed
```

### 4.2 待治理候选

待治理候选只展示未入库异常题，包括：

```text
pending_review
review_failed
needs_edit
human_review
fallback
math_text_invalid
missing_bilingual_localization
profile_alignment_warning
repair_exhausted
blocked
```

不展示：

- 已进入科目训练正式题库的题。
- 已进入在线模考候选池的题。
- 已装配进在线模考草稿卷的题。
- 已拒绝/已归档题，除非用户选择历史筛选。

### 4.3 可修复题

可修复题是指保留原题核心意图后，调整局部内容即可重新进入门禁的题。

典型包括：

- 正确答案标记错误。
- 多个正确答案。
- 选项过近。
- 干扰项不合理。
- 解析不充分或解释和答案不一致。
- 缺英文版本。
- LaTeX 不规范。
- 题干表达不清但知识点、难度和题型正确。

### 4.4 硬伤题

硬伤题不应原题修复，应直接重生或阻塞当前 gap。

典型包括：

- 目标 topic 不匹配。
- cognitiveSkill / questionForm 与目标画像完全不一致。
- 难度显著偏离且无法局部调整。
- 与真题或已入库题高度相似。
- 题目条件不足或题干不可用。
- 题干直接泄露答案。
- 当前 topic 缺大纲。
- 当前任务强依赖真题画像，但画像不存在。

## 5. 数据设计

### 5.1 AI 题 scope

短期继续放在 `generationMetadata.scope`，后续稳定后再考虑物理字段。

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
};
```

落地规则：

- 新生成题必须写完整 scope。
- 查询默认排除 `legacy`。
- 科目训练查询必须 `targetUseCase = subject_practice`。
- 在线模考查询必须 `targetUseCase = online_mock_exam`，并带当前 `mockBlueprintId`。
- mock 卷 1 和卷 2 不能互相显示候选、任务、已审核资产。

### 5.2 Target Profile

每个科目训练 gap 必须有目标画像：

```ts
type SubjectTargetProfile = {
  subject: 'math' | 'physics' | 'chemistry';
  topicId: number;
  gapKey: string;
  difficultyBand: 'basic' | 'medium' | 'hard';
  questionForm: string;
  cognitiveSkill: string;
  readingLoad: 'low' | 'medium' | 'high';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  sourceProfileStatus: 'active' | 'missing' | 'syllabus_only';
};
```

说明：

- `cognitiveSkill = unknown` 不能长期作为正常目标画像。
- 如果是旧真题画像缺字段，要在画像回填时补全。
- 如果上传 JSON 本身没有这些维度，可以由解析层从题干、解法和题型推断。
- 如果无法推断，标记 `profile_incomplete`，该 gap 不能进入高置信自动入库。

### 5.3 Review Metadata

审题结果要沉淀成机器可执行结构：

```ts
type GateReviewMetadata = {
  gateDecision: 'passed' | 'repairable' | 'regenerate' | 'blocked';
  issueCodes: string[];
  repairability:
    | 'repair_in_place'
    | 'regenerate'
    | 'blocked';
  mathTextGate: 'passed' | 'failed';
  bilingualGate: 'passed' | 'failed';
  sourceSimilarityGate: 'passed' | 'failed';
  profileAlignmentGate: 'passed' | 'failed' | 'warning';
  lastRepairAttempt?: number;
  lastRepairMode?: string;
};
```

## 6. 科目训练闭环状态机

### 6.1 Topic 状态

```text
missing_syllabus
missing_profile
needs_generation
generating
repairing
ready
blocked
```

状态含义：

- `missing_syllabus`：没有可用大纲，不能出题。
- `missing_profile`：当前任务要求真题画像，但没有可用画像。
- `needs_generation`：正式题不足，需要生成。
- `generating`：正在生成新题。
- `repairing`：正在修复已有候选。
- `ready`：正式入库题已达标。
- `blocked`：连续无进展，停止无限循环，需要管理员处理。

### 6.2 Gap 状态

```text
open
queued
running
repairing
fulfilled
blocked
```

`fulfilled` 唯一条件：

```text
approvedPracticeCount >= targetApprovedCount
```

候选数量不能让 gap fulfilled。

## 7. 自动生成与修复循环

### 7.1 主循环

伪代码：

```ts
while (approvedPracticeCount < targetApprovedCount) {
  const repairable = findOldestRepairableCandidate(scope);

  if (repairable) {
    const repaired = await repairInPlace(repairable);
    const reviewed = await review(repaired);

    if (reviewed.gateDecision === 'passed') {
      await publishToSubjectPracticeBank(repaired);
      continue;
    }

    await recordRepairFailure(repaired, reviewed);
    continue;
  }

  const draft = await generateNewCandidate(scope);
  const reviewed = await review(draft);

  if (reviewed.gateDecision === 'passed') {
    await publishToSubjectPracticeBank(draft);
    continue;
  }

  if (reviewed.repairability === 'repair_in_place') {
    await enqueueRepair(draft);
    continue;
  }

  if (reviewed.repairability === 'regenerate') {
    await archiveAsRegenerateSeed(draft);
    continue;
  }

  await markBlockedIfNoProgress(scope);
}
```

### 7.2 原题修复优先

修复顺序：

1. 数学文本规范化。
2. 补全英文版本。
3. 修复答案和选项。
4. 修复解析。
5. 调整干扰项距离。
6. 重新审题。
7. 重新计算真题相似度。
8. 重新跑门禁。

修复后必须重新检查：

- 答案唯一性。
- 双语完整性。
- 数学可渲染。
- targetProfile 匹配。
- sourceSimilarity。
- 是否已存在相似已入库题。

### 7.3 硬伤重生

以下问题不修，直接重生：

```text
topic_mismatch
cognitive_skill_mismatch_hard
question_form_mismatch_hard
difficulty_mismatch_hard
source_similarity_too_high
prompt_leaks_answer
invalid_question_stem
insufficient_conditions
unsupported_image_dependency
scope_mismatch
missing_syllabus
missing_required_source_profile
```

### 7.4 停止条件

必须有防无限循环：

```ts
const NO_PROGRESS_BLOCK_THRESHOLD = 10;
const MAX_REPAIR_ATTEMPTS_PER_CANDIDATE = 3;
const MAX_GENERATION_ATTEMPTS_PER_GAP = 30;
```

进入 blocked 的条件：

- 连续 10 次没有新增正式入库题。
- 同一个 candidate 修复 3 次仍失败。
- 同一个 gap 生成 30 次仍无合格题。
- provider 连续失败超过阈值。

blocked 后：

- 停止继续生成。
- 前端展示阻塞原因。
- 保留异常候选供人工诊断。
- 不污染正式题库。

## 8. 门禁标准

### 8.1 自动入库硬门禁

自动进入科目训练题库必须全部满足：

1. `targetUseCase = subject_practice`。
2. subject/topic/gap 与当前 scope 一致。
3. reviewer 分数达到阈值。
4. gateDecision = `passed`。
5. 不存在 `human_review`、`needs_edit`、`review_failed`、`fallback`。
6. 正确答案唯一。
7. 选项数量和格式正确。
8. 解析与答案一致。
9. `localizations.zh` 完整。
10. `localizations.en` 完整。
11. 数学文本可被统一渲染组件正常渲染。
12. 与真题相似度低于阈值。
13. 与已入库题相似度低于阈值。
14. 不是在线模考候选。

### 8.2 不能自动入库

以下状态不能入库：

```text
pending_review
review_failed
needs_edit
human_review
fallback
repairable
regenerate
math_text_invalid
missing_bilingual_localization
profile_incomplete
blocked
```

### 8.3 人工确认的定位

人工确认不是正常路径，只用于：

- 门禁规则校准。
- 少量边界题人工放行。
- 线上问题排查。
- 训练 reviewer 的样本回收。

默认闭环不依赖人工确认。

## 9. 数学符号方案

### 9.1 后端规范化

生成、修复、手工编辑后都要跑：

```ts
normalizeMathText(question.prompt)
normalizeMathText(option.text)
normalizeMathText(question.explanation)
normalizeMathText(localizations.zh.*)
normalizeMathText(localizations.en.*)
```

规范化规则：

- 裸 `\frac`、`\dfrac`、`\sqrt` 自动包入 `$...$`。
- 双反斜杠降噪。
- 检查 `{}` 成对。
- 检查 `$` 成对。
- 检查 `\left` / `\right` 成对。
- 禁止把大段自然语言整段包进公式。

### 9.2 后端门禁

新增或强化 issue code：

```text
math_text_invalid
math_latex_unbalanced_delimiters
math_latex_invalid_fraction
math_latex_invalid_sqrt
math_latex_unpaired_left_right
math_render_overflow_risk
```

这些 issue 出现时：

- 先进入 repair。
- 修复后复审。
- 仍失败则进入待治理候选。
- 不能自动入库。

### 9.3 前端唯一入口

所有题干、选项、解析、双语版本必须走：

```ts
frontend/src/components/MathContent.tsx
```

覆盖页面：

- `CandidateReviewPanel.tsx`
- `PublishedQuestionPanel.tsx`
- `LedgerPanel.tsx`
- `CscaSyllabusWorkspace.tsx`
- `AdaptivePracticeViews.tsx`
- 在线模考做题页和结果页
- 科目训练做题页和解析页

前端 CSS 约束：

- 公式允许换行。
- 选项容器不能被公式撑破。
- KaTeX display 不得在选项内生成超高块。
- 长公式可横向滚动，但不能覆盖相邻内容。
- mobile 宽度下仍不重叠。

## 10. 前端交互方案

### 10.1 页面结构

AI 题库后台按三层布局：

```text
共用准备层
  - 大纲基线
  - 真题画像

科目训练线
  - topic/gap 缺口
  - 自动补齐正式训练题
  - 待治理异常候选
  - 已入库科目训练 AI 题

在线模考线
  - 来源卷
  - 整卷蓝图
  - 题位
  - 自动补齐 48 题
  - 待治理异常候选
  - 已审核/已装配模考题
```

### 10.2 候选治理台

标题：

```text
科目训练 AI 候选治理与兜底
```

说明：

```text
这里只展示未入库的异常候选，用于查看失败原因、复审、编辑、拒绝或归档。
门禁通过题会自动进入科目训练正式题库，不会留在本列表。
```

列表排序：

```text
updatedAt DESC
```

操作：

- 复审。
- 编辑后复审。
- 拒绝。
- 归档。
- 批量清理当前 scope 未入库异常候选。

不应作为主按钮出现：

- “通过所选入库”。

如果保留，必须标注为：

```text
人工兜底入库
```

并且仍要跑硬门禁。

### 10.3 已入库资产面板

标题：

```text
科目训练已入库 AI 题
```

说明：

```text
这里展示已经通过门禁并进入科目训练正式题库的 AI 题。
这些题会被用户侧科目训练抽取。
```

展示字段：

- 题号。
- topic。
- gap。
- 难度。
- 生成时间。
- 入库时间。
- 生成版本。
- reviewer 分数。
- 双语状态。
- 数学渲染状态。
- 最近使用记录。

操作：

- 下架/归档。
- 单题删除当前 scope 生成结果。
- 批量删除当前 scope 已入库 AI 题。

### 10.4 局部刷新

每个板块必须有自己的刷新：

- 刷新 topic/gap。
- 刷新候选治理台。
- 刷新已入库资产。
- 刷新任务状态。

不能要求用户整页刷新。整页刷新也不能跳回流程总览导致上下文丢失。

## 11. 后端实施工单

### PR-1：Scope 与正式入库口径收紧

涉及文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/ai-questioning.controller.ts`
- `frontend/src/components/admin/ai-question-bank/candidateQueueFilters.ts`
- `frontend/src/components/admin/ai-question-bank/questionEvidence.ts`
- `scripts/csca-ai-questioning-rules-test.cjs`

任务：

1. 新生成题强制写 `generationMetadata.scope`。
2. 科目训练查询排除在线模考题。
3. 在线模考查询按 `mockBlueprintId` 隔离。
4. 候选治理只查异常未入库候选。
5. 已入库资产只查正式 mapping。

验收：

- 切换卷 2 不显示卷 1 题。
- 科目训练不显示模考候选。
- 已入库题不再出现在待治理候选。
- 规则测试覆盖 scope 隔离。

### PR-2：科目训练缺口统计

涉及文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/source-question-profile-normalizer.ts`
- `frontend/src/components/admin/ai-question-bank/CoverageWorkPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/questionBankSummary.ts`

任务：

1. 以正式入库题统计 `approvedPracticeCount`。
2. 生成 topic/gap targetProfile。
3. 显示还差几道正式题。
4. 标记 `missing_syllabus`、`missing_profile`、`profile_incomplete`。

验收：

- 候选数增加不会让 topic ready。
- 正式入库题达标后 topic ready。
- `cognitiveSkill = unknown` 会展示画像不完整原因。

### PR-3：Repair-first 决策器

涉及文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/question-prompt-builder.service.ts`
- `backend/src/ai-questioning/question-reviewer.service.ts`
- `backend/src/ai-questioning/question-reviewer-provider.service.ts`

任务：

1. 实现 `classifyGateFailure(issueCodes)`。
2. 输出 `repair_in_place` / `regenerate` / `blocked`。
3. 修复题复用原 targetProfile。
4. 修复后重新审题、重新计算相似度、重新跑门禁。

验收：

- 选项过近走 repair。
- 答案错误走 repair。
- 缺英文走 repair。
- LaTeX 错误走 repair。
- topic mismatch 走 regenerate。
- 相似度过高走 regenerate。

### PR-4：科目训练自动补齐循环

涉及文件：

- `backend/src/ai-questioning/ai-questioning-scheduler.service.ts`
- `backend/src/ai-questioning/ai-questioning.service.ts`
- `frontend/src/components/admin/ai-question-bank/QuestionBankTaskStatus.tsx`

任务：

1. 每个 topic/gap 以正式入库题数量为目标。
2. 优先处理 repairable 候选。
3. 无 repairable 再生成新题。
4. 达标后停止 queued/running job。
5. 连续无进展进入 blocked。

验收：

- 目标 3 题时，入库 3 题后停止。
- 目标 48 题时，入库 48 题后停止。
- 候选异常增加但正式题不增长时，最终 blocked，不无限生成。

### PR-5：双语与数学硬门禁

涉及文件：

- `backend/src/ai-questioning/question-validator.service.ts`
- `backend/src/ai-questioning/question-prompt-builder.service.ts`
- `backend/src/ai-questioning/ai-questioning.service.ts`
- `frontend/src/components/MathContent.tsx`
- `frontend/src/styles/math-content.css`

任务：

1. 生成 prompt 强制输出 `localizations.zh` 和 `localizations.en`。
2. 修复 prompt 支持补全双语。
3. 后端检查数学文本。
4. 前端统一渲染。
5. 缺双语或数学不可渲染禁止入库。

验收：

- 已入库题没有“缺双语 metadata”。
- 裸 `\frac` 不进入正式题库。
- 后台和用户侧公式不重叠。

### PR-6：清理与重测

涉及文件：

- `backend/src/ai-questioning/ai-questioning.controller.ts`
- `backend/src/ai-questioning/ai-questioning.service.ts`
- `frontend/src/pages/AdminAIQuestionBankPage.tsx`
- `frontend/src/components/admin/ai-question-bank/CandidateReviewPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/PublishedQuestionPanel.tsx`

任务：

1. 清理当前 subject/topic 未入库异常候选。
2. 清理当前 subject/topic 已入库 AI 题。
3. 清理当前 mockBlueprint 生成结果。
4. 所有清理都必须 confirm 显示范围。
5. 清理后自动刷新当前板块。

验收：

- 可以删除单题。
- 可以批量删除当前 scope 已入库 AI 题。
- 不误删手工专项题。
- 不误删另一条业务线。

### PR-7：前端文案与状态收口

涉及文件：

- `frontend/src/pages/AdminAIQuestionBankPage.tsx`
- `frontend/src/components/admin/ai-question-bank/QuestionBankHeaderControls.tsx`
- `frontend/src/components/admin/ai-question-bank/QuestionBankTaskStatus.tsx`
- `frontend/src/components/admin/ai-question-bank/CandidateReviewPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/PublishedQuestionPanel.tsx`

任务：

1. 候选治理文案改成异常处理台。
2. 已入库资产文案改成正式题库资产。
3. 任务状态区显示“正式入库 x/目标 y”。
4. 新候选倒序。
5. 板块内刷新。
6. 混淆按钮改名或隐藏。

验收：

- 用户能看懂哪些题已经正式可用。
- 用户能看懂哪些题只是失败候选。
- 不再出现“已通过但待装配/待入库”的冲突表达。

## 12. 测试计划

### 12.1 规则测试

更新：

```text
scripts/csca-ai-questioning-rules-test.cjs
```

至少断言：

```text
subject_practice 查询排除 online_mock_exam
online_mock_exam 查询按 mockBlueprintId 过滤
候选治理只显示异常未入库题
正式入库题不进入候选治理
缺英文不能自动入库
数学不可渲染不能自动入库
repairable issue 走 repair_in_place
hard issue 走 regenerate
达标后停止生成
cleanup 必须带 scope
```

### 12.2 后端类型与构建

命令：

```powershell
npm.cmd --prefix backend exec -- tsc -p backend/tsconfig.json --noEmit --incremental false --pretty false
```

### 12.3 前端构建

命令：

```powershell
npm.cmd --prefix frontend run build
```

### 12.4 手工验收

最小闭环：

```text
subject = math
topic = 选择 1 个缺题 topic
targetApprovedCount = 3
```

步骤：

1. 清理该 topic 未入库异常候选。
2. 清理该 topic 已入库 AI 题。
3. 启动科目训练补题。
4. 观察任务状态。
5. 确认正式入库题从 0 到 3。
6. 确认候选治理只剩异常题。
7. 确认已入库资产有 3 题。
8. 用户侧科目训练能抽到新题。
9. 检查题干、选项、解析、英文版本数学符号正常。

扩展验收：

```text
数学全 topic
物理 1 个 topic
化学 1 个 topic
在线模考卷 1 / 卷 2 隔离
```

## 13. 上线步骤

已有线上部署，但仍在开发阶段。建议使用“干净架构 + 可回滚”：

1. 停止 AI worker。
2. 备份数据库。
3. 部署后端。
4. 部署前端。
5. 跑 scope backfill，将旧 AI 题标记为 `legacy` 或推断 useCase。
6. 默认前端隐藏 legacy。
7. 只开启数学单 topic。
8. 验证最小闭环。
9. 开启数学全 topic。
10. 再扩展物理/化学。

回滚：

1. 关闭自动补齐开关。
2. 停止 worker。
3. 保留手工专项题库和手工在线模考题库。
4. 新生成异常候选批量归档。
5. 如正式题污染，按 scope 删除 AI 入库题，不删除手工题。
6. 必要时恢复数据库备份。

## 14. 完成定义

本方案完成时，必须满足：

1. 科目训练和在线模考候选、任务、资产按 scope 隔离。
2. 科目训练以正式入库题达标，不以候选数达标。
3. 可修复题优先原题修复。
4. 硬伤题直接重生或 blocked。
5. 门禁通过题自动进入科目训练正式题库。
6. 未通过题只进入待治理候选。
7. 候选治理台不显示已入库题。
8. 已入库资产面板只显示正式可用题。
9. 缺英文题不能入库。
10. 数学不可渲染题不能入库。
11. 后台、科目训练、在线模考数学符号显示一致。
12. 当前 scope 可单题删除、批量清理、重新生成测试。

## 15. 推荐执行顺序

第一轮：

```text
PR-1 Scope 与正式入库口径
PR-2 科目训练缺口统计
PR-5 双语与数学硬门禁
```

第二轮：

```text
PR-3 Repair-first 决策器
PR-4 科目训练自动补齐循环
```

第三轮：

```text
PR-6 清理与重测
PR-7 前端文案与状态收口
```

第一轮完成后就可以用数学单 topic 做小闭环验证；第二轮完成后再验证“候选不增长空转、正式题稳定增长”；第三轮完成后再让后台体验进入可长期使用状态。
