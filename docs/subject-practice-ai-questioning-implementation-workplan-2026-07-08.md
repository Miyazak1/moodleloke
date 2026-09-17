# 科目训练 AI 出题优化可执行落地方案

> 日期：2026-07-08  
> 状态：执行工单版  
> 适用范围：科目训练 AI 出题、专项题库入库、候选治理、原题修复、数学渲染、双语版本、运维监控、清理重测  
> 上游方案：`docs/subject-practice-ai-questioning-final-execution-plan-2026-07-08.md`  
> 关联方案：`docs/ai-questioning-dual-line-final-execution-plan-2026-07-07.md`、`docs/ai-questioning-subject-optimization-and-math-rendering-execution-plan-2026-07-07.md`、`docs/subject-practice-ai-question-hardening-execution-spec-2026-07-08.md`

## 1. 目标定义

这次优化的目标不是“让候选题变多”，而是把科目训练 AI 出题做成一个能自动收敛的正式题库补题系统。

最终用户视角：

```text
选择学科
-> 系统根据大纲和真题画像发现专项题缺口
-> 自动修复可修候选或生成新题
-> 门禁通过后自动进入科目训练正式题库
-> 达到目标数量后停止
-> 管理员只处理异常候选和清理重测
```

工程完成标准：

```text
topic/gap 的正式入库题数量达标
+ 候选治理只展示未入库异常题
+ 已入库题能被学生侧科目训练抽取
+ 在线模考线完全不受影响
```

## 2. 不变原则

1. 大纲基线和真题画像是科目训练与在线模考的共用准备层。
2. 从 AI 出题开始必须按 `targetUseCase` 分叉。
3. 科目训练成功只看 `special_practice_questions` 正式映射，不看候选数量。
4. 在线模考成功只看当前卷当前蓝图 48 个题位是否全部有合格题。
5. `human_review`、`needs_edit`、`review_failed`、`regenerate`、`fallback`、`smoke`、缺英文、数学渲染失败、画像硬不匹配的题不能自动入库。
6. 可修复问题先原题修复，硬伤才重新生成。
7. 不降低门禁换通过率。优化方向是补齐画像、修复提示词、修复数学规范、修复判定和原题修复链路。

## 3. 当前判断

### 3.1 在线模考线

在线模考线已经接近正确闭环：

```text
真题画像 -> 整卷蓝图 -> 48 题位 -> 自动生成/修复/复审
-> 每个题位 1 道门禁通过题 -> 48/48 完成 -> 可装配草稿卷
```

仍需保留的后续事项：

- 每个 mock 卷的候选、任务、已审核资产独立。
- 装配后 candidate 和 draft paper 状态一致。
- 清理功能按当前卷、当前 blueprint 执行。

### 3.2 科目训练线

科目训练线仍是主要待优化对象：

- 容易把“生成了候选”误当成“补题成功”。
- 候选异常过多时，系统可能继续生成新题，而不是优先修复已有可修题。
- 需要人工确认、建议重生、复审失败的题不应进入正式题库。
- 通过门禁的题必须自动入库，并从异常候选治理台消失。
- 生成任务、候选列表、已入库列表、运维 readiness 必须全部带 `targetUseCase = subject_practice`。

### 3.3 数学和双语

数学公式和双语版本要进入硬门禁：

- 后端入库前必须检查数学文本规范。
- 前端后台、学生侧科目训练、在线模考必须使用统一数学渲染入口。
- 公式不能以裸 `\frac`、`\sqrt`、`\dfrac` 形式直接展示给用户。
- 已入库题必须有 `localizations.zh` 和 `localizations.en`。

## 4. 数据边界

### 4.1 科目训练 AI scope

每道科目训练 AI 题必须写入：

```ts
type SubjectPracticeScope = {
  targetUseCase: 'subject_practice';
  intendedUse: 'subject_practice';
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicId: number;
  topicCode?: string;
  gapKey: string;
  generationMode:
    | 'subject_gap_fulfillment'
    | 'subject_candidate_repair'
    | 'subject_candidate_regenerate';
};
```

缺任意关键字段时：

- 不允许自动入库。
- 不计入 topic/gap 完成。
- 展示为 `source_scope_missing` 或 `legacy_scope_missing`。

### 4.2 在线模考 AI scope

在线模考题必须写入：

```ts
type OnlineMockExamScope = {
  targetUseCase: 'online_mock_exam';
  intendedUse: 'mock_candidate';
  subject: 'math' | 'physics' | 'chemistry';
  mockSourcePaperId: number;
  mockBlueprintId: number;
  mockBlueprintSlotId: number;
  mockSlotNumber: number;
  generationMode:
    | 'online_mock_slot_fulfillment'
    | 'online_mock_candidate_repair'
    | 'online_mock_candidate_regenerate';
};
```

在线模考 scope 不允许被科目训练查询统计命中。

### 4.3 正式题库口径

科目训练正式可用题：

```text
csca_questions.status = approved
+ generationMetadata.scope.targetUseCase = subject_practice
+ generationMetadata.scope.intendedUse = subject_practice
+ special_practice_questions.source_question_id = csca_questions.id
+ special_practice_questions.status in active / published
```

只有 `csca_questions.status = approved` 不算正式入库。

## 5. 目标画像

科目训练 targetProfile 最少需要：

```ts
type SubjectPracticeTargetProfile = {
  difficultyBand: 'basic' | 'medium' | 'hard';
  questionForm: string;
  cognitiveSkill: string;
  readingLoad: 'low' | 'medium' | 'high';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  answerDistributionHint?: string;
  commonMisconceptions?: string[];
  estimatedTimeSeconds?: number;
};
```

`cognitiveSkill = unknown` 的规则：

1. 历史题可以显示 unknown。
2. 新生成任务不允许使用 unknown 作为目标画像。
3. 生成前必须通过画像 normalizer 或 fallback inference 推断。
4. 推断失败时阻塞任务，提示“真题画像维度缺失”，而不是继续生成低质量候选。

## 6. Worker 主流程

科目训练自动补题 worker 按这个顺序执行：

```text
1. 读取当前 subject/topic/gap 的正式入库数。
2. 如果正式入库数达标，归档多余 queued/running job，返回 fulfilled。
3. 校验 active 大纲。
4. 校验 active 真题画像。
5. 构造 targetProfile，禁止 unknown 维度。
6. 查找当前 scope 下可修复候选。
7. 有可修复候选：原题修复 -> 复审 -> 门禁 -> 入库或异常归档。
8. 没有可修复候选：生成新题 -> 复审 -> 门禁 -> 入库或异常归档。
9. 每轮后重新读取正式入库数。
10. 达标后停止。
11. 连续多轮没有正式入库增长时，进入 blocked，不再无效消耗 provider。
```

伪代码：

```ts
async function fulfillSubjectPracticeGap(scope) {
  while (true) {
    const publishedCount = await countPublishedSubjectPracticeQuestions(scope);
    if (publishedCount >= scope.targetCount) {
      await archiveRedundantJobs(scope);
      return { status: 'fulfilled', publishedCount };
    }

    const readiness = await assertSubjectPracticeReadiness(scope);
    if (!readiness.ok) {
      return blockGap(scope, readiness.reason);
    }

    const candidate = await findRepairableCandidate(scope);
    const result = candidate
      ? await repairCandidateInPlace(candidate, readiness.targetProfile)
      : await generateNewCandidate(scope, readiness.targetProfile);

    const reviewed = await runSubjectPracticeGates(result.question);

    if (reviewed.passed) {
      await publishToSpecialPractice(reviewed.question, scope);
    } else {
      await persistAbnormalCandidate(reviewed.question, reviewed.reason);
    }

    if (await noFormalProgressExceeded(scope)) {
      return blockGap(scope, 'subject_practice_no_progress');
    }
  }
}
```

## 7. 门禁到动作映射

| 结果 | 例子 | 动作 | 是否入库 |
| --- | --- | --- | --- |
| `passed` | 答案、解析、数学、双语、画像都通过 | 自动入库 | 是 |
| `repairable.answer_mismatch` | 正确答案标错 | 原题修复答案/解析 | 否 |
| `repairable.multi_correct` | 多个正确选项 | 原题修复选项 | 否 |
| `repairable.option_too_close` | 干扰项过近或等价 | 原题修复干扰项 | 否 |
| `repairable.missing_english` | 缺英文版本 | 补英文并重跑门禁 | 否 |
| `repairable.math_syntax` | LaTeX 裸露或双转义 | 规范化数学文本 | 否 |
| `regenerate.topic_mismatch` | 题目考点错误 | 归档并重生 | 否 |
| `regenerate.difficulty_mismatch` | 难度明显不符 | 归档并重生 | 否 |
| `regenerate.high_similarity` | 与真题或已入库题过近 | 归档并重生 | 否 |
| `regenerate.unsolvable` | 无解、条件缺失、题干不可用 | 归档并重生 | 否 |
| `blocked.missing_profile` | 当前学科没有 active 真题画像 | 停止，提示导入画像 | 否 |
| `blocked.no_progress` | 多轮无正式入库增长 | 停止，提示治理异常候选/优化规则 | 否 |

## 8. 前端页面调整

AI 题库后台按流程展示：

```text
共用准备层
  1 大纲基线
  2 真题画像

科目训练线
  A 缺口概览
  B 自动补题任务
  C 异常候选治理
  D 已入库正式题

在线模考线
  A 来源卷选择
  B 整卷蓝图
  C 48 题位补齐任务
  D 异常候选治理
  E 草稿卷装配
```

### 8.1 科目训练线文案

自动补题任务区：

```text
系统会优先修复当前 scope 下可修复候选；无可修候选时才生成新题。
只有门禁通过并进入科目训练正式题库的题，才计入完成数量。
```

异常候选治理区：

```text
这里仅展示未入库的异常候选，用于查看失败原因、复审、编辑、拒绝或归档。
门禁通过题会自动进入科目训练正式题库，不需要在这里手工确认。
```

已入库正式题区：

```text
这里展示已经进入科目训练正式题库的 AI 题。学生侧训练会从这里抽取。
```

### 8.2 刷新与排序

1. 补题任务运行时，当前工作区自动刷新状态。
2. 候选列表支持板块内刷新，不触发整页回到总览。
3. 异常候选按 `createdAt desc` 排序，新生成的异常题排前面。
4. 已入库题按 `publishedAt desc` 排序，新入库题排前面。
5. 页面切换 subject/topic 后，必须清空旧 scope 的列表再加载新 scope。

## 9. 清理能力

清理必须分 scope，不能误删手工题。

### 9.1 当前学科未入库 AI 结果

输入：

```ts
{
  targetUseCase: 'subject_practice',
  subject: string,
  topicId?: number,
  gapKey?: string,
  includePublishedAiQuestions: false,
  dryRun: boolean
}
```

清理：

- 当前 scope 未入库 AI 候选。
- 当前 scope 生成任务。
- 当前 scope 复审/曝光/交互记录。

不清理：

- 手工专项题。
- 已入库 AI 正式题。
- 大纲。
- 真题画像。
- 在线模考题。

### 9.2 当前学科全部 AI 结果

输入：

```ts
{
  targetUseCase: 'subject_practice',
  subject: string,
  topicId?: number,
  gapKey?: string,
  includePublishedAiQuestions: true,
  dryRun: boolean
}
```

额外清理：

- `special_practice_questions` 中当前 scope 的 AI 映射。
- 映射对应的 AI `csca_questions`。

仍然不清理手工专项题。

## 10. 数学渲染落地要求

### 10.1 后端入库前规范化

入库前统一做：

1. 检测裸 LaTeX 命令。
2. 检测双反斜杠和错误转义。
3. 检测中文混进公式环境。
4. 检测无法渲染的表达式。
5. 将可修复问题交给 repair worker。
6. 不可修复则留在异常候选，不入库。

### 10.2 前端统一渲染入口

以下页面必须使用同一数学文本组件：

- AI 题库候选治理。
- AI 题库已入库正式题。
- 专项/科目训练学生侧。
- 在线模考学生侧。
- 模考草稿卷预览。

组件要求：

- 行内公式不撑高选项。
- 块级公式自动换行。
- 公式出错时展示原文和错误标记，不把布局撑乱。
- 选项容器有固定最小高度和溢出策略。

## 11. 工单拆解

### P0-1 科目 scope 硬隔离

后端：

- 所有生成、修复、复审、入库写完整 `generationMetadata.scope`。
- 所有科目训练查询带 `targetUseCase = subject_practice`。
- 所有在线模考查询带 `targetUseCase = online_mock_exam` 和 mock scope。

前端：

- 科目训练线、在线模考线分开展示。
- 切换卷或学科时清空旧列表。

验收：

- 生成在线模考题时，科目训练队列不新增任务。
- 切换 mock 卷 1 到卷 2 后，候选列表不会显示卷 1 的题。

### P0-2 正式入库数作为唯一完成口径

后端：

- `approvedPracticeCount` 只从正式映射统计。
- gap 达标后归档多余任务。
- 已入库题从异常候选列表排除。

前端：

- 进度显示“正式入库 x / target”。
- 候选数改名为“异常候选”，不作为成功数。

验收：

- 生成 30 个候选但 0 个入库时，topic 仍显示未完成。
- 3 个题入库后，正式题数显示 3。

### P0-3 原题修复优先

后端：

- 建立可修复问题分类。
- `answer_mismatch`、`multi_correct`、`option_too_close`、`missing_english`、`math_syntax` 先 repair。
- `topic_mismatch`、`high_similarity`、`unsolvable` 归档后 regenerate。

前端：

- 候选卡片展示“可修复 / 硬伤 / 已修复次数”。

验收：

- 选项过近的题不会直接重生，而是生成 repair attempt。
- 修复通过后自动入库。

### P0-4 双语和数学硬门禁

后端：

- 缺 `localizations.en` 不允许入库。
- 数学 gate fail 不允许入库。
- 可修复数学问题进入 repair。

前端：

- 所有题目展示面使用统一数学渲染组件。

验收：

- 缺英文题不能出现在已入库正式题。
- 裸 `\frac` 不会出现在学生侧。
- KaTeX 错误不会导致选项布局重叠。

### P0-5 清理重测

后端：

- 支持当前学科未入库 AI 清理。
- 支持当前学科全部 AI 清理。
- dryRun 返回影响数量。

前端：

- 提供单题删除、当前 topic 清理、当前学科清理。
- 危险操作需要二次确认。

验收：

- 清理当前数学 topic 不影响在线模考。
- 清理 AI 结果不删除手工专项题。

### P1-1 运维 readiness 按业务线过滤

后端：

- readiness 接口支持 `useCase = subject_practice | online_mock_exam`。
- provider 状态、失败任务、blocked 任务按 useCase 汇总。

前端：

- 运维页显示当前 useCase。
- 导出文件名包含 useCase。

验收：

- 科目训练的失败任务不会污染在线模考 readiness。

### P1-2 no-progress 保护

后端：

- 连续多轮没有正式入库增长时，把 gap 标记为 `blocked`。
- `blocked` 不自动重试，除非管理员手动清理或调整配置。

前端：

- blocked 展示原因、影响范围、下一步动作。

验收：

- Provider 一直产出失败题时，系统停止无效消耗。
- 页面不再显示“运行中”但实际没有进展。

### P2-1 画像维度回填

后端：

- 对 active 真题画像做维度检查。
- `unknown` 维度能推断则回填，不能推断则阻塞。

前端：

- 真题画像页展示维度缺失清单和重新解析入口。

验收：

- 新生成任务不再出现 `targetProfile.cognitiveSkill = unknown`。

## 12. 测试矩阵

### 12.1 后端规则测试

必须覆盖：

- subject practice 查询不返回 online mock 题。
- online mock 查询不返回 subject practice 题。
- `approved` 但无 `special_practice_questions` 映射不算入库。
- 缺英文不允许入库。
- 数学 gate fail 不允许入库。
- fallback/smoke/legacy 不允许入库。
- 可修复问题优先 repair。
- 硬伤问题 regenerate。
- no-progress 会 blocked。

### 12.2 前端类型和组件测试

必须覆盖：

- 科目训练线切换学科后清空旧数据。
- 候选列表只展示异常候选。
- 已入库题独立展示。
- 数学公式在候选、已入库、学生侧科目训练、在线模考都正常展示。

### 12.3 手工联调

最小闭环：

1. 清理数学某个 topic 的 AI 结果。
2. 确认数学 active 大纲存在。
3. 确认数学 active 真题画像存在，且 targetProfile 无 unknown。
4. 启动科目补题。
5. 系统优先修复已有可修候选。
6. 门禁通过题自动进入 `special_practice_questions`。
7. 学生侧科目训练能抽到这些题。
8. 异常候选治理台不显示已入库题。
9. 清理当前 scope 后，正式题、候选、任务、统计归零。
10. 在线模考卷 1 的候选、任务、草稿卷不受影响。

## 13. 上线顺序

### 阶段 1：数据口径收紧

1. scope 写入和查询过滤。
2. 正式入库计数替换候选计数。
3. 候选治理只显示异常候选。

风险：低。主要是统计变化。

### 阶段 2：门禁和自动入库

1. 双语硬门禁。
2. 数学硬门禁。
3. 自动入 `special_practice_questions`。
4. 达标后归档任务。

风险：中。会暴露更多历史脏数据，需要配合清理。

### 阶段 3：原题修复优先

1. repairable/hard-failed 分类。
2. repair worker。
3. no-progress blocked。

风险：中。需要观察 provider 成功率和修复质量。

### 阶段 4：前端治理体验

1. 板块内刷新。
2. 新异常排前。
3. 已入库正式题独立面板。
4. 清理重测按钮。

风险：低。主要是体验和状态一致性。

### 阶段 5：历史数据清理

1. 线上部署前 dryRun。
2. 备份影响数据。
3. 清理 legacy/smoke/fallback 测试题。
4. 保留手工题。

风险：中高。必须先 dryRun 并记录影响数量。

## 14. 验收门槛

这套方案真正完成，需要同时满足：

1. 数学科目某 topic 能自动补齐至少 3 道正式入库题。
2. 缺英文、数学异常、画像硬不匹配题不会入库。
3. 异常候选不断增加时，系统优先修复可修题，而不是无限生成。
4. 多轮无进展时进入 blocked，并给出原因。
5. 清理当前 scope 不影响在线模考和手工题。
6. 后台、科目训练、在线模考数学公式显示一致。
7. 运维 readiness 能按 subject practice / online mock 分线查看。
8. 所有新增规则测试和前端类型检查通过。

未满足以上任意一项，都不能认为科目训练 AI 出题优化完成。
