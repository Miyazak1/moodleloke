# 科目训练 AI 出题闭环完善最终落地方案

> 日期：2026-07-07  
> 状态：最终落地执行版  
> 范围：AI 题库后台、科目训练 AI 出题、专项/科目训练正式题库、真题画像消费、候选治理、自动修复、数学渲染、清理重测、上线发布  
> 关联文档：
> - `docs/ai-questioning-dual-line-final-execution-plan-2026-07-07.md`
> - `docs/ai-questioning-subject-optimization-and-math-rendering-execution-plan-2026-07-07.md`
> - `docs/subject-practice-ai-question-optimization-executable-plan-2026-07-07.md`
> - `docs/ai-question-bank-dual-line-executable-plan-2026-07-07.md`

## 1. 最终目标

在线模考线已经基本收束到“按整卷 48 个题位补齐合格题”的闭环。下一步科目训练线也要从“生成候选题”升级为“按知识点缺口补齐正式可训练题”。

目标流程：

```text
大纲基线 + 真题画像
-> 科目 topic / gap 画像
-> 自动生成候选
-> 可修复问题优先原题修复
-> 硬伤问题重生替代
-> Reviewer + 门禁
-> 门禁通过后自动入科目训练/专项训练正式题库
-> topic/gap 达标后停止
-> 未入库异常题进入候选治理
```

核心口径：

```text
候选题数量不是成功。
门禁通过并进入科目训练正式题库的题，才算成功。
```

## 2. 当前问题

### 2.1 科目训练线的问题

- 候选题可能持续增加，但正式入库题没有增加。
- `needs_edit`、`human_review`、`review_failed` 中有大量可修复问题，却容易被重新生成替代。
- 有些题只是缺英文、答案标注错误、选项过近、LaTeX 不规范，不应该整题废弃。
- topic/gap 进度容易被候选数量污染。
- 已入库题仍可能出现在候选治理区，造成“既通过又待处理”的混乱。
- 清理旧测试数据不够精确，重测时容易被旧候选污染。

### 2.2 与在线模考线的关系

共用：

```text
大纲基线
真题画像
数学渲染组件
Provider / Reviewer 基础能力
```

必须分开：

```text
候选题
生成任务
正式资产
统计口径
清理范围
候选治理
已审核资产
```

科目训练不应消费在线模考候选；在线模考也不应消费科目训练候选。

## 3. 成功标准

### 3.1 Topic 级完成标准

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
  profileStatus: 'ready' | 'missing_profile' | 'syllabus_only' | 'low_confidence';
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

### 3.2 Gap 级完成标准

```ts
type SubjectPracticeGap = {
  gapKey: string;
  subject: string;
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
  noProgressCount: number;
  status: 'open' | 'running' | 'repairing' | 'fulfilled' | 'blocked';
};
```

`fulfilled` 的唯一条件：

```text
approvedCount >= neededCount
```

### 3.3 不计入完成的题

以下题不计入 `approvedPracticeCount`：

- 未入库候选。
- `pending_review`。
- `human_review`。
- `needs_edit`。
- `review_failed`。
- `fallback`。
- `regenerate`。
- `rejected`。
- `archived`。
- 在线模考候选。
- `legacy` 旧数据。
- `approved` 但没有正式科目训练 mapping 的 AI 题。

## 4. 数据边界

### 4.1 AI 题 scope

新生成的 AI 题必须写入明确 scope。短期可继续写入 `generationMetadata.scope`，稳定后再迁移为物理字段。

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
    | 'subject_expansion'
    | 'online_mock_slot_fulfillment'
    | 'online_mock_candidate_repair'
    | 'online_mock_candidate_regenerate'
    | 'legacy';
};
```

硬规则：

- 科目训练题：`targetUseCase = subject_practice`。
- 在线模考题：`targetUseCase = online_mock_exam`。
- 无法判定旧题：`targetUseCase = legacy`。
- `legacy` 默认不参与新闭环统计。

### 4.2 正式科目训练题口径

不能只看 `csca_questions.status = approved`。

正式可训练题必须满足：

```text
csca_questions.status = approved
+ targetUseCase = subject_practice
+ source_question_id / special practice mapping 存在
+ mapping status = published 或 active
+ 当前 subject/topic/gap 匹配
```

## 5. 入库门禁

### 5.1 自动入库条件

一题必须同时满足：

1. `targetUseCase = subject_practice`。
2. `intendedUse = subject_practice`。
3. 当前 topic / syllabus 匹配。
4. 当前 `targetProfile` 匹配。
5. Reviewer gate 通过。
6. 非 fallback。
7. 非 smoke/test seed。
8. 题干、选项、正确答案、解析完整。
9. 选项互斥，答案唯一。
10. 解析与答案一致。
11. 不超纲。
12. 与真题和已入库题不过度相似。
13. 中文和英文题干、选项、解析完整。
14. 数学文本可稳定渲染。
15. 正式入库函数幂等校验通过。

### 5.2 阻止自动入库的问题

以下问题必须阻止自动入库：

- `missing_bilingual_localization`
- `math_text_invalid`
- `topic_mismatch`
- `syllabus_mismatch`
- `answer_incorrect`
- `multiple_correct_answers`
- `source_similarity_high`
- `profile_alignment_failed`
- `provider_schema_invalid`
- `fallback_candidate`

其中可修复问题进入修复；硬伤问题进入重生或阻塞。

## 6. 修复优先策略

### 6.1 可原题修复

以下问题先修原题：

- 英文版本缺失。
- 双语 metadata 缺失。
- 正确答案标注错误，但题干和解法可保留。
- 多个正确答案，但可通过调整选项消歧。
- 选项过近、重复、过弱。
- 解析缺步骤。
- 解析和答案不一致。
- 轻微 LaTeX 格式问题。
- 轻微 difficulty / readingLoad / calculationLoad 偏差。
- `human_review` 原因只是画像证据弱或软警告。

修复要求：

```text
保留 subject/topic/targetProfile/核心能力点
只修改必要字段
修复后重新 reviewer + gate
通过后自动入库
单题最多自动修复 2 次
```

### 6.2 必须重生

以下问题直接重生：

- topic mismatch。
- 超纲。
- 与真题高度相似。
- 与已入库题高度相似。
- 题干逻辑不成立。
- 题型和目标画像完全不符。
- 难度严重偏离。
- provider 返回结构损坏。
- 数学表达不可恢复。
- 连续修复超过上限仍失败。

### 6.3 循环阈值

建议阈值：

```ts
const SUBJECT_REPAIR_MAX_ATTEMPTS_PER_CANDIDATE = 2;
const SUBJECT_REGENERATE_MAX_ATTEMPTS_PER_GAP = 20;
const SUBJECT_NO_PROGRESS_BLOCK_THRESHOLD = 10;
```

含义：

- 单题最多修复 2 次。
- 单个 gap 最多连续重生 20 次。
- 连续 10 次没有新增正式入库题，则进入 `blocked`，停止继续生成。

## 7. 后端工单

### 工单 A：统一 scope normalizer

目标：

```text
所有候选、任务、已审核资产、统计、清理都从同一套 scope 判断。
```

建议实现：

```ts
normalizeQuestionUseCase(question): 'subject_practice' | 'online_mock_exam' | 'legacy'
buildAiQuestionScopeWhere(scope): SqlWhere
isSubjectPracticeQuestion(question): boolean
isOnlineMockQuestion(question): boolean
```

涉及文件：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/ai-questioning/ai-questioning.controller.ts`
- 可新增 `backend/src/ai-questioning/ai-question-scope.ts`

验收：

- 科目训练候选不显示在线模考题。
- 在线模考候选不显示科目训练题。
- `legacy` 不参与 topic/gap 完成统计。

### 工单 B：topic/gap 按正式入库题统计

目标：

```text
topic/gap 是否完成，只看正式科目训练题，不看候选数。
```

实现要求：

- `approvedPracticeCount` 从正式题库 mapping 统计。
- `candidateCount` 只作为过程指标。
- gap 维度包含 `difficultyBand/questionForm/cognitiveSkill/readingLoad/calculationLoad`。
- 有真题画像时，`cognitiveSkill = unknown` 不能作为主目标大量出现。
- 无画像时提示 `missing_profile` 或 `syllabus_only`，不能误报缺大纲。

验收：

- 生成 10 道候选但都未入库，`openGapCount` 不减少。
- 入库 1 道合格题后，对应 gap 的 `approvedCount +1`。

### 工单 C：科目训练自动补齐 job

目标：

```text
点击补齐后，持续生成/修复/重生，直到正式入库题达标或 blocked。
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

```text
1. 每轮开始重新读取正式入库题数。
2. 已达标则 completed，并归档剩余 queued job。
3. 未达标时，优先找可修复候选。
4. 没有可修复候选，再生成新候选。
5. 新候选立即 reviewer + gate。
6. 通过则自动入库，并重置 noProgressCount。
7. 可修复则进入 repair。
8. 硬伤则 regenerate。
9. 连续无进展达到阈值则 blocked。
```

验收：

- 达标后不会继续生成。
- 刷新页面后任务状态不丢。
- blocked 状态展示最近失败原因。

### 工单 D：自动入库函数收敛

目标：

```text
门禁通过题自动进入科目训练正式题库，重复调用不重复入库。
```

建议函数：

```ts
publishToSubjectPracticeBank(questionId, context)
```

要求：

- 幂等。
- 校验 scope。
- 校验 gate。
- 校验双语。
- 校验数学文本。
- 写正式题库 mapping。
- 写 ledger / audit log。
- 更新 topic/gap 进度。

验收：

- 同一道题重复 publish 不产生重复正式题。
- 缺英文或数学不可渲染题 publish 被拒绝。
- publish 后题从异常候选治理中消失。

### 工单 E：修复服务

目标：

```text
软问题修原题，硬问题才重生。
```

建议函数：

```ts
decideSubjectPracticeRepairStrategy(review)
subjectPracticeRepairFeedback(question, review)
repairSubjectPracticeCandidate(questionId, feedback)
regenerateSubjectPracticeCandidate(scope, previousFailure)
```

验收：

- 缺英文进入修复。
- 答案标注错误进入修复。
- 多正确答案进入选项修复。
- topic mismatch 直接重生。
- 修复通过后自动入库。

### 工单 F：双语门禁

目标：

```text
正式题库中不再进入缺英文或缺双语 metadata 的题。
```

检查范围：

- `generationMetadata.localizations.zh.prompt`
- `generationMetadata.localizations.zh.options`
- `generationMetadata.localizations.zh.explanation`
- `generationMetadata.localizations.en.prompt`
- `generationMetadata.localizations.en.options`
- `generationMetadata.localizations.en.explanation`

规则：

- 缺英文：修复。
- 缺中文：修复。
- 双语结构严重缺失：重生或 blocked。
- 缺双语不能 publish。

### 工单 G：数学文本规范化和硬门禁

目标：

```text
候选、已审核资产、用户侧科目训练都不出现裸 LaTeX、符号重叠、布局撑破。
```

后端工具：

```ts
normalizeMathText(input: string): string
validateMathText(input: string): MathValidationResult
questionMathTextIssueReasons(question): string[]
```

处理范围：

- prompt。
- options。
- explanation。
- zh/en localization。

必须识别：

- 裸 `\frac`、`\dfrac`、`\sqrt`。
- 双反斜杠污染。
- `$`、`\(`、`\[` 定界符不配对。
- `\left` / `\right` 不配对。
- 长公式导致不可渲染。

验收：

- `math_text_invalid` 阻止自动入库。
- 可修复 LaTeX 进入原题修复。
- 不可修复 LaTeX 进入重生或 blocked。

### 工单 H：清理与重测 API

目标：

```text
开发阶段能干净重测，不误删另一条业务线或其他 topic。
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

默认安全行为：

- 只清未入库异常候选。
- 只清当前 scope 任务。
- 不清正式题库。
- 不清已拒绝/已归档历史。

危险操作：

- 清已入库资产必须二次确认。
- 清在线模考草稿卷必须二次确认。
- 所有清理写 audit log。

验收：

- 清数学 topic A 不影响 topic B。
- 清科目训练不影响在线模考。
- 清理后可以从干净状态重新生成测试。

## 8. 前端工单

### 工单 I：科目训练线页面表达

页面主流程：

```text
知识点题库健康
-> 缺题画像
-> 自动补齐合格训练题
-> 未入库异常候选治理
-> 已入库科目训练资产
```

主按钮文案：

- `补齐合格训练题`
- `处理可修复候选`
- `清理当前知识点 AI 结果`
- `刷新当前题库健康`

避免作为主按钮：

- `追加候选`
- `生成候选`
- `通过所选候选入库`

### 工单 J：候选治理只展示异常候选

标题：

```text
科目训练 AI 候选治理与兜底
```

说明：

```text
这里仅展示未入库的异常候选，用于查看失败原因、复审、编辑、拒绝或归档；门禁通过题会自动进入已入库科目资产。
```

默认展示：

- `review_failed`
- `needs_edit`
- `human_review`
- `fallback`
- `blocked`

不展示：

- 已入库题。
- 已拒绝题。
- 已归档题。
- 在线模考题。
- 当前 subject/topic 外的题。

### 工单 K：任务状态和局部刷新

状态文案：

```text
目标 6 · 已入库 4 · 还差 2 · 生成中 1 · 可修复 1 · 连续无进展 3/10
```

刷新要求：

- running / queued / repairing 时自动刷新。
- 候选面板有 `刷新候选`。
- 已入库资产有 `刷新资产`。
- 刷新不改变 tab / subject / topic / page / status。
- 新增、更新、失败、修复的题按 `updatedAt desc` 排前面。

### 工单 L：数学渲染统一

所有题面文本统一走同一套数学渲染组件。

覆盖范围：

- AI 候选治理。
- 已入库科目资产。
- 用户侧科目训练。
- 在线模考作答页。
- 解析、选项、英文版本、审题证据。

验收样例：

```text
\frac{x^2-1}{x-2} \geq 0
\sqrt{k^2+1}
(-\sqrt{3}, \sqrt{3})
(-\infty, -\sqrt{3}) \cup (\sqrt{3}, \infty)
x^2 + y^2 = 1
y = kx + 2
```

显示要求：

- 不裸露 LaTeX。
- 根号、数字、上下标不重叠。
- 选项不出现嵌套卡片。
- 解析区不撑破容器。
- 长公式可换行。

## 9. 推荐执行顺序

### P0：先解决数据边界和成功口径

1. 工单 A：统一 scope normalizer。
2. 工单 B：topic/gap 按正式入库题统计。
3. 工单 J：候选治理只展示异常候选。
4. 工单 H：清理与重测 API。

完成后应解决：

- 科目和模考混在一起。
- 候选数被误认为成功。
- 已入库题仍显示在候选治理。
- 旧数据污染重测。

### P1：补齐真正闭环

1. 工单 C：科目训练自动补齐 job。
2. 工单 D：自动入库函数收敛。
3. 工单 E：修复服务。
4. 工单 F：双语门禁。

完成后应解决：

- 候选一直增加但合格题没有。
- 可修复问题被盲目重生。
- 合格题不自动进入正式题库。
- 缺英文题进入已审核资产。

### P2：展示质量和体验

1. 工单 G：数学文本规范化和硬门禁。
2. 工单 K：任务状态和局部刷新。
3. 工单 L：数学渲染统一。
4. 工单 I：科目训练线页面表达。

完成后应解决：

- 数学符号裸露。
- 解析和选项布局混乱。
- 页面刷新跳回总览。
- 管理员看不清当前进度。

## 10. 最小可交付切片

第一轮不要全量铺开，先做数学单 topic。

范围：

```text
subject = math
targetUseCase = subject_practice
topic = 选择 1 个已有真题画像覆盖的数学 topic
targetApprovedCount = 3
```

必须完成：

1. 清理当前 topic 的未入库异常候选和任务。
2. topic health 显示目标、已入库、还差。
3. 点击 `补齐合格训练题`。
4. 系统自动生成、修复或重生。
5. 3 道门禁通过题自动进入科目训练正式题库。
6. 候选治理只显示未入库异常题。
7. 已入库资产显示 3 道题。
8. 用户侧科目训练能抽到新题。
9. 数学符号在后台和用户侧显示正常。

通过后再扩展：

```text
数学全 topic
-> 物理/化学
-> 在线模考多卷隔离回归
-> 全量自动补齐
```

## 11. 测试计划

### 11.1 规则测试

更新 `scripts/csca-ai-questioning-rules-test.cjs`，至少断言：

```text
1. subject_practice 查询排除 online_mock_exam。
2. online_mock_exam 查询排除 subject_practice。
3. approved + 已入库题不出现在待治理候选。
4. candidateCount 不影响 topic ready。
5. approvedPracticeCount 达标才 ready。
6. 达标后归档剩余 queued job。
7. 缺英文不能 publish。
8. 裸 LaTeX 不能 publish。
9. repairable 问题走 repair_in_place。
10. hard failure 走 hard_regenerate。
11. noProgress 达阈值进入 blocked。
12. cleanup 必须带 scope。
```

### 11.2 后端测试

覆盖：

- `normalizeQuestionUseCase`
- `buildAiQuestionScopeWhere`
- `deriveTopicQuestionGap`
- `decideSubjectPracticeRepairStrategy`
- `publishToSubjectPracticeBank`
- `cleanupAiQuestioningScope`
- `normalizeMathText`
- `validateMathText`

### 11.3 前端测试

覆盖：

- 切换 subject/topic 清空旧候选。
- 候选治理不显示已入库题。
- 已入库资产只显示正式科目训练资产。
- 局部刷新不跳 tab。
- 新候选按更新时间倒序。
- MathContent 在题干、选项、解析中正常渲染。

### 11.4 手工验收

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

数学渲染：

```text
1. 打开含 \frac、\sqrt、区间、上下标的题。
2. 后台候选、已入库资产各检查一次。
3. 用户侧科目训练检查一次。
4. 在线模考检查一次。
5. 确认不裸露、不重叠、不撑破。
```

## 12. 上线方案

当前是开发阶段，但已有线上部署。推荐使用“干净架构 + 可回滚上线”。

部署前：

1. 停止 AI 生成 worker。
2. 备份数据库。
3. 跑规则测试和构建。
4. 跑 scope backfill。
5. 检查 `legacy` 数量。
6. 先关闭全量自动补齐，只开放单 topic 测试。

部署中：

1. 部署后端。
2. 跑数据库迁移或 metadata backfill。
3. 部署前端。
4. 重启 worker。
5. 打开后台确认页面无错误。

部署后观察：

```text
subject_practice_auto_publish_count
missing_bilingual_count
math_text_invalid_count
repair_success_count
regenerate_count
blocked_gap_count
provider_error_rate
schema_invalid_rate
```

回滚：

1. 关闭自动补齐 feature flag。
2. 保留手工专项题库和手工在线模考题库。
3. 新生成异常候选批量归档。
4. 不删除旧正式题库。
5. 如数据污染严重，恢复部署前备份。

## 13. 完成定义

本方案完成时，必须能明确回答：

1. 当前这道 AI 题属于科目训练还是在线模考？
2. 当前 topic 还差几道正式训练题？
3. 为什么这道候选题没有入库？
4. 这道题应该修复还是重生？
5. 门禁通过后是否已经进入正式科目训练题库？
6. 已入库题为什么不再出现在候选治理？
7. 缺英文和数学不可渲染题是否被阻止入库？
8. 当前 scope 能否安全清理重测？
9. 用户侧科目训练是否能抽到新入库题？
10. 线上部署失败时如何回滚？

只有这些问题都能在页面、接口、日志和数据中明确回答，才算科目训练 AI 出题闭环真正落地完成。
