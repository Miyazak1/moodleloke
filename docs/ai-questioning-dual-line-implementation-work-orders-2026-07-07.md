# AI 出题双线闭环工单级执行方案

> 日期：2026-07-07  
> 状态：落地执行级方案  
> 范围：AI 题库后台、科目训练 AI 出题、在线模考 AI 出题、真题画像、大纲基线、候选治理、正式入库、数学渲染、清理重测、上线部署  
> 主方案：`docs/ai-questioning-dual-line-final-execution-plan-2026-07-07.md`  
> 关联方案：
> - `docs/subject-training-ai-generation-closed-loop-plan-2026-07-07.md`
> - `docs/ai-questioning-subject-optimization-and-math-rendering-execution-plan-2026-07-07.md`
> - `docs/subject-practice-ai-question-optimization-executable-plan-2026-07-07.md`
> - `docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`
> - `docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md`

## 1. 执行目标

把当前 AI 出题从“生成很多候选题”收束为两条可验收的闭环：

```text
共用准备：
  大纲基线 + 真题画像

科目训练线：
  topic/gap -> 生成或修复 -> 门禁通过 -> 科目/专项训练正式题库 -> 达标停止

在线模考线：
  来源卷 -> 整卷蓝图 -> 48 题位 -> 生成或修复 -> 48/48 合格 -> 在线模考题库 -> 草稿卷装配
```

本次执行不降低门禁。优化方向是：

1. 数据隔离更清楚。
2. 可修复题先原题修复。
3. 不可修硬伤才重生。
4. 合格题自动进入对应正式题库。
5. 候选治理只展示未入库异常题。
6. 前端状态按“还差几道正式题”表达。
7. 数学和双语作为硬门禁。
8. 当前 topic / 当前卷可清理重测。

## 2. 必须统一的判断口径

### 2.1 候选不是成功

```text
candidateCount 只能说明系统产出过候选。
approved + mapped/published 才说明题目已经正式可用。
```

科目训练成功口径：

```text
csca_questions.status = approved
+ generationMetadata.scope.targetUseCase = subject_practice
+ 科目/专项训练 mapping 存在
+ mapping.status in active/published
```

在线模考成功口径：

```text
csca_questions.status = approved
+ generationMetadata.scope.targetUseCase = online_mock_exam
+ mockBlueprintId = 当前蓝图
+ mockBlueprintSlotId = 当前题位
+ mockExamApproval.status = approved_for_mock_exam_assembly
```

### 2.2 业务线必须强隔离

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

短期写入 `generationMetadata.scope`。后续稳定后再迁移成物理字段。

所有查询、统计、导出、批量动作、清理动作必须带 scope。

## 3. 修复与重生策略

### 3.1 可原题修复的问题

这些问题优先走 repair-in-place：

```text
missing_bilingual_localization
math_text_invalid
latex_escape_invalid
option_too_close
wrong_correct_answer
multiple_correct_answers
explanation_incomplete
weak_explanation
minor_reading_load_mismatch
minor_calculation_load_mismatch
profile_alignment_warning
```

执行规则：

1. 在原题基础上修。
2. 保留原 `scope`。
3. 递增 `generationMetadata.repairAttempt`。
4. 修完必须重新 Reviewer + gate。
5. 最多修复 3 次。
6. 修复 3 次仍未通过，标记 `repair_exhausted`，再重生替代题。

### 3.2 必须重生的问题

这些属于硬伤，不在原题上继续修：

```text
topic_mismatch
syllabus_mismatch
source_similarity_too_high
prompt_leak
unsafe_content
unparseable_question
unsupported_question_type
image_required_but_missing
repair_exhausted
```

执行规则：

1. 原候选标记为 `regenerate_replaced` 或 `archived`.
2. 新候选继承同一个 topic/gap 或 mock slot scope。
3. 重生 prompt 必须带上失败原因，避免重复犯同一类错。
4. 重生不增加目标数量，只替换未达标缺口。

## 4. 后端工单

### BE-01 统一 scope 写入

目标：

```text
所有新生成、修复、重生的 AI 题都有 generationMetadata.scope。
```

涉及位置：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/ai-questioning/question-generator.service.ts
backend/src/ai-questioning/question-prompt-builder.service.ts
```

实现要求：

1. 新增 `aiQuestionScopeForBlueprint(...)`。
2. 生成题写入 `targetUseCase`、`intendedUse`、`subject`、`topicId`。
3. 在线模考题额外写入 `mockSourcePaperId`、`mockBlueprintId`、`mockBlueprintSlotId`、`mockSlotNumber`。
4. 修复题优先继承旧 scope，缺失时按 blueprint 回填。
5. 重生题继承被替换候选的 scope。

验收：

```text
1. 新科目题 scope.targetUseCase = subject_practice。
2. 新模考题 scope.targetUseCase = online_mock_exam。
3. 卷 1 和卷 2 的 mockBlueprintId 不同。
4. 修复后 scope 不丢。
```

### BE-02 查询和统计按 scope 隔离

目标：

```text
科目训练、在线模考、不同卷、不同 topic 的数据互不污染。
```

涉及接口：

```text
候选列表
已审核资产列表
任务状态
topic health
mock blueprint progress
CSV/JSON 导出
清理接口
```

实现要求：

1. 新增 `buildAiQuestionScopeWhere(params)`。
2. 科目训练查询必须带 `targetUseCase = subject_practice`。
3. 在线模考查询必须带 `targetUseCase = online_mock_exam` 和当前 `mockBlueprintId`。
4. mock slot 级统计必须带 `mockBlueprintSlotId`。
5. 默认隐藏 `legacy`。
6. 用户选择历史模式时才展示 `legacy`。

验收：

```text
1. 切换数学模拟卷 1/2，候选互不显示。
2. 在线模考生成不影响科目训练候选统计。
3. 科目训练补题不影响在线模考 readySlotCount。
```

### BE-03 科目训练正式题口径

目标：

```text
topic/gap 是否完成只看正式入库训练题，不看候选题。
```

实现要求：

1. `approvedPracticeCount` 只统计已入科目/专项训练题库的题。
2. `candidateCount` 仅作为异常治理参考。
3. topic ready 条件固定为 `approvedPracticeCount >= targetPracticeCount`。
4. gap fulfilled 条件固定为 `approvedCount >= neededCount`。

验收：

```text
候选 100 道但入库 0，道具状态仍是 needs_generation 或 blocked。
入库达标后，即使还有异常候选，topic 也可以 ready。
```

### BE-04 科目训练自动补齐闭环

目标：

```text
系统自动循环到 topic/gap 合格题数量达标，然后停止。
```

循环逻辑：

```text
读取缺口
-> 优先修复 repairable 候选
-> 不足则生成新候选
-> Reviewer + gate
-> 通过则自动入库
-> 未通过则按原因修复或重生
-> 达标停止
-> 连续无进展进入 blocked
```

停止条件：

```text
approvedPracticeCount >= targetPracticeCount
```

阻断条件：

```text
连续 N 轮没有新增合格入库题
或 provider 连续失败
或 缺大纲 / 缺画像 / scope 异常
```

验收：

```text
1. 单 topic target=3，系统最终入库 3 道。
2. 达标后不再继续新增候选。
3. 异常候选保留在治理区，不影响 ready。
```

### BE-05 在线模考 48/48 闭环

目标：

```text
每套卷只为当前 48 个题位补题，48/48 后停止，并可装配草稿卷。
```

实现要求：

1. 每个 slot 只认当前 `mockBlueprintSlotId` 下的合格题。
2. 每个 slot 达标后不继续生成。
3. 整卷 `readySlotCount = 48` 后停止所有本卷 queued job。
4. 装配后回写 `assembledDraftPaperId`、`assembledAt`、`assembledStatus`。
5. 装配后候选状态从“待装配”变成“已装配”。

验收：

```text
1. 数学卷 1 满 48/48 后停止。
2. 卷 2 不显示卷 1 的候选。
3. 装配草稿卷后，48 道题都有装配状态。
```

### BE-06 数学和双语硬门禁

目标：

```text
数学不可渲染、缺英文版本、缺双语 metadata 的题不能自动入库。
```

实现要求：

1. 入库前校验题干、选项、答案、解析。
2. 规范化双转义 LaTeX。
3. 拒绝明显裸露或不可解析数学文本。
4. subject practice 和 online mock 都必须有双语版本。
5. 失败原因写入 gate/review metadata。

验收：

```text
1. 缺英文题不入库。
2. 数学公式重叠风险题不入库。
3. 修复后重新通过门禁才能入库。
```

### BE-07 清理和重测能力

目标：

```text
开发阶段可以安全清理当前 scope 的 AI 结果，重新跑测试。
```

清理范围必须显式选择：

```text
当前 subject + topic/gap
当前 mock source paper + blueprint
当前 mock blueprint slot
```

清理动作：

```text
删除/归档未入库候选
删除/归档关联 generation job
可选删除已入库 AI 资产
可选删除草稿卷装配
```

安全要求：

1. 默认不删除手工题。
2. 默认不删除旧正式题库。
3. 删除已入库 AI 资产必须二次确认。
4. 操作结果写 audit log。

验收：

```text
清理数学卷 1 不影响数学卷 2。
清理科目训练 topic 不影响在线模考。
```

## 5. 前端工单

### FE-01 页面按流程分区

页面结构固定为：

```text
共用准备
  1 大纲基线
  2 真题画像

科目训练线
  缺口
  自动补齐
  异常候选治理
  正式训练题资产

在线模考线
  来源卷
  整卷蓝图
  题位
  自动补齐 48/48
  异常候选治理
  已入库模考资产
  草稿卷装配
```

验收：

```text
管理员能一眼分清共用上游、科目训练线、在线模考线。
```

### FE-02 状态文案改成正式进度

科目训练显示：

```text
目标 6 · 已入库 4 · 还差 2 · 生成中 1 · 可修复 1 · 异常 3
```

在线模考显示：

```text
48 题位 · 已合格 42 · 还差 6 · 生成中 2 · 可修复 3 · 已装配 0
```

避免主流程文案：

```text
追加候选
候选生成成功
通过候选
```

主按钮文案：

```text
补齐合格训练题
自动补齐 48/48
处理可修复题
刷新候选
清理当前 scope
```

### FE-03 候选治理只展示异常

候选治理区只展示：

```text
review_failed
needs_edit
human_review
regenerate
fallback
math_text_invalid
missing_bilingual_localization
repair_exhausted
manual_returned
```

不展示：

```text
已自动入科目训练题库
已进入在线模考候选池并可装配
已装配草稿卷
已归档
已拒绝且不再处理
```

验收：

```text
合格题通过门禁后自动从异常候选治理区消失。
```

### FE-04 板块内刷新和倒序

要求：

1. 候选治理区有 `刷新候选`。
2. 正式资产区有 `刷新资产`。
3. 刷新不跳 tab。
4. 刷新不重置 subject / topic / mock paper / blueprint。
5. 新生成、新修复、新失败按 `updatedAt desc` 排前面。
6. running / queued 时自动轮询当前 scope。

验收：

```text
生成过程中不用整页刷新也能看到新增结果。
```

### FE-05 数学渲染统一入口

要求：

1. 后台候选题、已审核资产、科目训练、在线模考都使用同一 MathContent。
2. 题干、选项、解析、英文版本都走同一规范化渲染。
3. 禁止 KaTeX 内部元素被 CSS 强行换行导致重叠。
4. 超长公式允许横向滚动，不撑破卡片。

验收：

```text
\frac、\sqrt、上下标、区间、集合符号不裸露、不重叠、不撑破布局。
```

## 6. 数据迁移和上线策略

### 6.1 开发阶段

当前可以采用干净架构：

1. 新生成数据必须带 scope。
2. legacy 默认隐藏。
3. 当前测试数据可清理重跑。
4. 不为了旧候选牺牲新结构。

### 6.2 线上部署

上线前步骤：

```text
1. 停止 AI worker。
2. 备份数据库。
3. 部署后端。
4. 运行迁移。
5. 跑 legacy scope backfill。
6. 部署前端。
7. 只开放数学单 topic / 单 mock 卷验证。
8. 再开放数学全量。
9. 最后开放物理和化学。
```

回滚：

```text
1. 关闭自动补齐 feature flag。
2. 暂停 AI worker。
3. 前端保留手工题库和手工模考题库入口。
4. 新生成异常候选批量归档。
5. 必要时恢复数据库备份。
```

## 7. 推荐实施顺序

### Phase 0：数据口径收口

1. BE-01 统一 scope 写入。
2. BE-02 查询和统计按 scope 隔离。
3. BE-07 清理和重测能力。
4. FE-01 页面按流程分区。

完成后应解决：

```text
科目和模考混用
卷 2 显示卷 1 数据
无法干净重测
```

### Phase 1：科目训练闭环

1. BE-03 科目训练正式题口径。
2. BE-04 科目训练自动补齐闭环。
3. FE-02 状态文案改成正式进度。
4. FE-03 候选治理只展示异常。
5. FE-04 板块内刷新和倒序。

完成后应解决：

```text
候选一直增加但合格题不增加
合格题还留在候选区
topic/gap 不知道还差几道
```

### Phase 2：在线模考收口

1. BE-05 在线模考 48/48 闭环。
2. 装配状态回写。
3. mock 卷级清理。
4. 前端按卷展示异常候选和正式资产。

完成后应解决：

```text
48/48 后仍继续生成
装配后仍显示待装配
不同卷数据互串
```

### Phase 3：质量硬门禁和渲染

1. BE-06 数学和双语硬门禁。
2. FE-05 数学渲染统一入口。
3. 补规则测试。
4. 后台和用户侧手工验收。

完成后应解决：

```text
缺英文入库
LaTeX 裸露
公式重叠
后台和用户侧显示不一致
```

## 8. 最小验收切片

第一轮不要全量跑，先做最小闭环：

```text
subject = math
useCase = subject_practice
topic = 1 个数学 topic
targetPracticeCount = 3
```

验收步骤：

1. 清理当前 topic AI 结果。
2. 确认 topic 有大纲，有真题画像可用。
3. 点击 `补齐合格训练题`。
4. 观察系统自动生成、修复、重生。
5. 最终 `approvedPracticeCount = 3`。
6. 三道题进入科目训练正式题库。
7. 异常候选治理只剩未入库异常题。
8. 用户侧科目训练能抽到新题。
9. 数学公式显示正常。

第二轮：

```text
subject = math
useCase = online_mock_exam
mock paper = 数学模拟卷 1
targetSlotCount = 48
```

验收步骤：

1. 清理当前卷 AI 结果。
2. 加载或生成整卷蓝图。
3. 加载 48 个题位。
4. 启动自动补齐 48/48。
5. 达到 48 个合格题后停止。
6. 装配草稿卷。
7. 用户侧能打开完整 48 题。
8. 切换卷 2，不显示卷 1 数据。

## 9. 自动化测试要求

规则测试至少覆盖：

```text
1. subject_practice 查询排除 online_mock_exam。
2. online_mock_exam 查询排除 subject_practice。
3. mockBlueprintId 不同，候选互不显示。
4. 已入库题不出现在异常候选治理。
5. candidateCount 不影响 ready。
6. approvedPracticeCount 达标才 ready。
7. 缺英文不能自动入库。
8. 数学不可渲染不能自动入库。
9. repairable 问题走原题修复。
10. hard failure 走重生。
11. repair_exhausted 后重生。
12. 清理接口必须带 scope。
13. 新生成题必须写 generationMetadata.scope。
14. 修复题不丢 scope。
15. 前端文案不再把候选数量表达成成功。
```

建议命令：

```powershell
npm.cmd run csca-ai-questioning:rules
npm.cmd --prefix backend exec -- tsc -p backend/tsconfig.json --noEmit --incremental false --pretty false
npm.cmd --prefix frontend run build
```

## 10. 完成定义

以下全部满足，才算本轮真正完成：

1. 每道新 AI 题都有可追踪 scope。
2. 科目训练和在线模考候选、任务、资产、清理互不污染。
3. 科目训练以正式入库题达标。
4. 在线模考以 48/48 合格题达标。
5. 合格题自动入库，并从异常候选治理消失。
6. 可修复问题优先原题修复。
7. 不可修硬伤才重生。
8. 连续无进展进入 blocked，不无限堆候选。
9. 缺英文和数学不可渲染题不能入库。
10. 后台、科目训练、在线模考的数学渲染一致。
11. 当前 topic / 当前 mock 卷可安全清理重测。
12. 线上部署有备份、feature flag 和回滚路径。

