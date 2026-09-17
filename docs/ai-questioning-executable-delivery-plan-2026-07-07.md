# AI 出题双线闭环落地执行方案

> 日期：2026-07-07  
> 状态：执行主文档  
> 适用范围：AI 题库后台、科目训练 AI 出题、在线模考 AI 出题、真题画像、大纲基线、正式题库、候选治理、数学渲染、上线清理  
> 背景文档：
> - `docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md`
> - `docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`
> - `docs/subject-training-profile-adaptation-implementation-spec-2026-07-03.md`
> - `docs/subject-training-ai-generation-closed-loop-plan-2026-07-07.md`
> - `docs/subject-practice-ai-question-optimization-executable-plan-2026-07-07.md`
> - `docs/ai-questioning-dual-line-implementation-work-orders-2026-07-07.md`

## 1. 执行结论

当前方案要收束为一个清晰的后台生产系统：

```text
共用准备层：
  大纲基线
  真题画像

分叉生产层：
  科目训练线
    topic/gap -> 生成/修复/重生 -> 门禁 -> 科目训练正式题库

  在线模考线
    来源卷 -> 整卷蓝图 -> 48 题位 -> 生成/修复/重生 -> 在线模考题库 -> 草稿卷
```

最重要的口径：

1. 候选题不是成功。
2. 门禁通过也不是最终成功。
3. 进入对应正式题库，且能被用户侧消费，才是成功。
4. 科目训练和在线模考从 AI 出题开始必须分叉，候选、任务、统计、清理、正式资产都不能混。
5. 可修复题优先原题优化；硬伤才重生。
6. 数学渲染、双语版本、scope 归属是硬门禁，不应靠人工后补。
7. 开发阶段走干净架构；线上部署通过迁移和清理兜底，不继续兼容混乱旧口径。

## 2. 非目标

本轮不做以下事情：

1. 不做 PDF OCR。用户上传的是结构化 JSON 或代码。
2. 不降低门禁来换通过率。
3. 不把科目训练题和在线模考题混成一个正式题库。
4. 不把候选治理面板作为正常成功题的必经流程。
5. 不让旧任务无限自动重试。
6. 不继续保留独立的大纲页面作为主流程；大纲基线应并入 AI 题库流程页。

## 3. 数据边界

### 3.1 共用上游

共用上游只提供“能考什么”和“真题怎么考”：

```text
csca syllabus json
-> CscaExamTopic / syllabus baseline

source question json
-> CscaSourceQuestion
-> source profile
-> topic/question style profile
```

共用上游可以被科目训练和在线模考同时读取，但不能把下游生产结果混在一起。

### 3.2 必填 scope

所有 AI 生成、修复、重生的题都必须写入：

```ts
type AIQuestionScope = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
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
    | 'online_mock_slot_fulfillment'
    | 'online_mock_candidate_repair'
    | 'online_mock_candidate_regenerate';
};
```

短期存放：

```text
csca_questions.generation_metadata.scope
```

后续稳定后可迁移为物理字段：

```text
csca_questions.target_use_case
csca_questions.intended_use
csca_questions.mock_blueprint_id
csca_questions.mock_blueprint_slot_id
csca_questions.gap_key
```

### 3.3 正式资产判定

科目训练正式题：

```text
csca_questions.status = approved
+ generation_metadata.scope.targetUseCase = subject_practice
+ special_practice_questions 里存在 active/published 映射
+ 用户侧 subject practice provider 能抽到
```

在线模考正式题：

```text
csca_questions.status = approved
+ generation_metadata.scope.targetUseCase = online_mock_exam
+ mockBlueprintId = 当前蓝图
+ mockBlueprintSlotId = 当前题位
+ mock approval / mock pool 映射存在
```

装配进草稿卷：

```text
在线模考正式题
+ draft paper item 映射存在
+ candidate metadata 标记 assembledDraftPaperId / assembledAt
```

## 4. 科目训练线执行设计

### 4.1 目标状态

```text
选择学科
-> 读取大纲 topic
-> 读取该学科 active 真题画像
-> 计算 topic/gap 缺口
-> 自动生成候选
-> Reviewer + Validator + Gate
-> 可修复问题原题修复
-> 硬伤重生替代
-> 门禁通过后自动入专项/科目训练正式题库
-> 达标停止
```

### 4.2 完成标准

topic 完成：

```text
approvedPracticeCount >= targetPracticeCount
```

gap 完成：

```text
approvedCount >= neededCount
```

不计入完成：

```text
pending_review
needs_edit
human_review
review_failed
fallback
archived
rejected
online_mock_exam candidate
legacy unknown-scope question
math_render_failed
missing_bilingual_localization
```

### 4.3 targetProfile 生成规则

优先级：

```text
active 真题画像
-> topic style profile
-> syllabus topic fallback
```

如果有 active 真题画像：

```text
targetProfile 必须包含：
  questionForm
  cognitiveSkill
  difficultyBand
  readingLoad
  calculationLoad
  distractorTypes
  commonMisconceptions
  estimatedTimeSeconds
```

如果没有 active 真题画像：

```text
可以进入 syllabus-only 模式，但前端必须明确显示：
  未使用真题画像
  自动入库门槛更高
  题目不计入画像增强覆盖
```

不能把“没有真题画像”误报成“没有大纲”。

### 4.4 cognitiveSkill 的处理

`cognitiveSkill` 是题目考查的认知动作，例如：

```text
recall
understand
apply
analyze
interpret
model
calculate
reason
evaluate
```

出现 `unknown` 的来源可能有三类：

1. 用户上传的原始真题 JSON 没给。
2. 真题画像解析时没有推断。
3. gap 映射时没有从题型、解析、答案、负载里回填。

执行要求：

1. 不要求用户上传 JSON 手写 `cognitiveSkill`。
2. 真题画像解析阶段必须推断。
3. gap 生成阶段必须二次 normalize。
4. `unknown` 可以作为极少数兜底值，但不能大面积进入生成任务。
5. 如果某学科 active 画像仍大量 `unknown`，应提示“画像需要重建”，而不是继续生成。

## 5. 在线模考线执行设计

### 5.1 目标状态

```text
选择来源卷
-> 生成/加载整卷蓝图
-> 生成 48 个题位
-> 每个题位自动生成/修复/重生
-> 每个题位 1 道门禁通过题
-> 48/48 后自动进入在线模考题库
-> 可装配草稿卷
```

### 5.2 完成标准

一套在线模考完成：

```text
48 个题位都有 1 道 gate_passed 题
+ 48 道题全部进入在线模考题库
```

草稿卷装配完成：

```text
48 道在线模考正式题
+ draft paper item 48 条
+ draft paper 状态为 ready/reviewable
+ 题目 candidate 状态显示已装配
```

不允许：

1. 48 题未满继续装配。
2. 已完成 48/48 后继续生成同一套卷。
3. 卷 1 候选显示到卷 2。
4. 已装配题仍显示“待装配”。

## 6. 修复与重生策略

### 6.1 原题修复

这些问题优先原题修复：

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

1. 保留题目 scope。
2. 保留 topic/gap 或 mock slot。
3. 记录 `repairAttempt`。
4. 修复后重新审题和门禁。
5. 最多修 3 次。
6. 修复失败后进入重生替代。

### 6.2 重生替代

这些问题直接重生：

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

1. 原题标记 archived / regenerate_replaced。
2. 新题继承同一个 topic/gap 或 mock slot。
3. prompt 带上失败原因，避免重复失败。
4. 重生不增加目标数量，只补当前缺口。

### 6.3 停止条件

科目训练：

```text
gap/topic 达标 -> 停止
连续 N 次没有新增正式题 -> blocked，需要人工检查画像/prompt/provider
```

在线模考：

```text
48/48 入库 -> 停止
某题位连续 N 次无法产出合格题 -> slot blocked
```

建议初始阈值：

```text
repair max = 3
regenerate max per gap/slot = 12
no-progress max = 10
```

## 7. 后端工单

### BE-01 scope 标准化

文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/ai-questioning/question-generator.service.ts
backend/src/ai-questioning/question-prompt-builder.service.ts
```

任务：

1. 新建 `aiQuestionScopeForBlueprint(...)`。
2. 新生成题写入完整 scope。
3. 修复题继承 scope。
4. 重生题继承被替换题的 scope。
5. 查询层新增统一 scope where builder。

验收：

```text
新科目题 targetUseCase = subject_practice
新模考题 targetUseCase = online_mock_exam
切换卷时 mockBlueprintId 不混
修复/重生后 scope 不丢
```

### BE-02 真题画像和 gap 映射

文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/ai-questioning/source-profile-normalizer.ts
backend/src/ai-questioning/question-profile-mapper.ts
```

任务：

1. active 真题画像按 subject 读取。
2. topic gap 生成使用画像维度。
3. 缺 `cognitiveSkill` 时自动推断。
4. 无画像时进入 syllabus-only 状态。
5. 错误原因区分 `missing_profile` 和 `missing_syllabus`。

验收：

```text
数学有画像时 targetProfile 不大量 unknown
化学/物理无画像时不误报缺大纲
重新解析数学 JSON 后 gap 维度更新
```

### BE-03 科目训练闭环

文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/ai-questioning/question-reviewer.service.ts
backend/src/ai-questioning/question-validator.service.ts
backend/src/csca-special-practice
```

任务：

1. topic/gap 缺口按正式入库题计算。
2. 生成任务循环直到 gap 达标或 blocked。
3. 门禁通过后自动 publish 到 `special_practice_questions`。
4. 用户侧科目训练 provider 能抽到新题。
5. 未通过候选留在治理面板。

验收：

```text
候选数量增长但正式题不增长时，系统会修复/重生，不会误报完成
达标后停止继续生成
科目训练页面能抽到 AI 入库题
```

### BE-04 在线模考闭环

文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/csca-mock-exam/csca-mock-exam.service.ts
```

任务：

1. 每套卷按 `mockBlueprintId` 独立。
2. 每个题位按 `mockBlueprintSlotId` 独立。
3. 48/48 后禁止继续补同一套。
4. 装配草稿卷后回写装配状态。
5. 已装配题不再显示“待装配”。

验收：

```text
卷 1/2 候选互不污染
48/48 之后按钮显示已完成
装配后 48 道题显示已装配
```

### BE-05 清理和删除

文件：

```text
backend/src/ai-questioning/ai-questioning.controller.ts
backend/src/ai-questioning/ai-questioning.service.ts
```

接口建议：

```text
DELETE /api/v1/admin/ai-questioning/candidates/:questionId
POST   /api/v1/admin/ai-questioning/candidates/bulk-delete
POST   /api/v1/admin/ai-questioning/scope/clear
POST   /api/v1/admin/ai-questioning/tasks/clear
```

清理参数：

```ts
type ClearScope = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject?: string;
  topicId?: number;
  mockBlueprintId?: number;
  includeCandidates?: boolean;
  includeApprovedUnassembled?: boolean;
  includeTasks?: boolean;
};
```

安全要求：

1. 默认不删正式线上用户已使用题。
2. 清理当前卷不影响其他卷。
3. 清理科目训练不影响在线模考。
4. 清理前返回 dry-run count。

### BE-06 provider 和队列

文件：

```text
backend/src/ai-questioning/question-generator.service.ts
backend/src/ai-questioning/ai-questioning.service.ts
```

任务：

1. 支持有限并发。
2. running 超时自动释放。
3. queued 不被 stale running 永久阻塞。
4. provider timeout / schema invalid / network error 分类记录。
5. 自动重试只对可重试错误生效。

验收：

```text
生成中数量和任务表一致
无 running 时 queued 会继续处理
provider 失败原因能在前端看到
```

### BE-07 数学和双语门禁

文件：

```text
backend/src/ai-questioning/question-validator.service.ts
backend/src/ai-questioning/question-reviewer.service.ts
```

任务：

1. 生成后 normalize LaTeX。
2. 检查 prompt、选项、解析、英文版本都可渲染。
3. 缺英文版本不允许自动入库。
4. 数学渲染失败优先 repair。
5. 修复后重新审题。

验收：

```text
通过门禁题都有中英文 metadata
通过门禁题无明显 LaTeX 原文泄露
通过门禁题在后台、科目训练、在线模考都不重叠
```

## 8. 前端工单

### FE-01 流程页重排

文件：

```text
frontend/src/components/admin/ai-question-bank/CoverageWorkPanel.tsx
frontend/src/pages/AdminAIQuestionBankPage.tsx
```

布局：

```text
共用准备
  1 大纲基线
  2 真题画像

科目训练线
  缺题画像
  候选治理
  已审核科目资产
  正式题库覆盖

在线模考线
  整卷蓝图
  题位
  候选治理
  在线模考题库
  草稿卷装配
```

要求：

1. 分叉后两条线不要混在一个候选池里。
2. 当前 tab、学科、卷、分页写入 URL query 或本地状态。
3. 页面局部刷新不跳回流程总览。

### FE-02 科目训练状态表达

文案口径：

```text
已入正式题库：X/Y
待修复候选：N
硬伤候选：N
当前状态：补题中 / 修复中 / 达标 / 阻塞
```

不要用：

```text
候选成功 N
任务完成 N
```

这些会误导管理员以为题已经可用。

### FE-03 在线模考状态表达

文案口径：

```text
题位进度：40/48
已入在线模考题库：40
已装配草稿卷：0/48
还差：8 题
```

完成后：

```text
整套已完成
48/48 已入库
可装配草稿卷
```

装配后：

```text
草稿卷 #ID 已装配
48/48 已装配
```

### FE-04 候选治理面板

候选治理面板只展示未入正式库的异常候选：

```text
needs_edit
human_review
review_failed
repair_exhausted
rejected
archived
```

不展示：

```text
已自动入库题
已装配题
已进入科目训练正式题库题
```

操作：

```text
单题删除
批量删除
复审
编辑
拒绝
归档
```

### FE-05 数学渲染统一入口

文件：

```text
frontend/src/components/MathContent.tsx
frontend/src/styles/math-content.css
```

要求：

1. 后台候选、已审核资产、科目训练答题、在线模考答题都使用同一个数学渲染组件。
2. 不允许每个页面自己处理 LaTeX。
3. 公式渲染失败时降级为可读文本，不撑乱布局。
4. inline math 不应变成巨大块级嵌套 DOM。
5. 长公式允许横向滚动，不重叠到选项或解析。

## 9. 迁移和上线处理

### 9.1 开发环境

开发阶段可以清理旧生成结果：

```text
1. 清空当前 scope 的 candidate。
2. 清空当前 scope 的 generation tasks。
3. 保留用户手工题和已发布正式题。
4. 重新解析/应用数学真题画像。
5. 重新生成测试。
```

### 9.2 线上部署

上线前步骤：

1. 备份数据库。
2. 部署 migration。
3. 为新生成链路启用 scope 必填。
4. 暂停旧 queued/running 任务。
5. 把旧任务标记为 legacy_archived 或 cancelled。
6. 清理开发阶段测试候选。
7. 重新应用 active 大纲和 active 真题画像。
8. 只开放新链路按钮。

不建议线上继续兼容旧混合任务。旧正式题可以继续被用户训练，但不计入新链路的“画像增强题覆盖”。

### 9.3 回滚

如果上线后生成异常：

1. 关闭 AI 自动补题入口。
2. 保留手工题库和已发布正式题。
3. 暂停自动修复/重生队列。
4. 不影响用户侧已有科目训练和在线模考。
5. 新候选可以按 scope 批量归档。

## 10. 验收清单

### 10.1 数据隔离

- [ ] 科目训练候选不出现在在线模考候选池。
- [ ] 在线模考候选不出现在科目训练候选池。
- [ ] 数学卷 1 候选不出现在数学卷 2。
- [ ] 清理当前卷不影响其他卷。
- [ ] 清理科目训练不影响在线模考。

### 10.2 科目训练闭环

- [ ] 数学 active 真题画像存在时，targetProfile 不大量 unknown。
- [ ] 生成题 scope 为 subject_practice。
- [ ] 门禁通过题自动进入 special practice 正式题库。
- [ ] 用户侧科目训练能抽到新题。
- [ ] topic/gap 达标后停止继续生成。
- [ ] 异常候选留在治理面板。

### 10.3 在线模考闭环

- [ ] 一套卷必须 48/48 才算完成。
- [ ] 48/48 后同卷不能继续生成。
- [ ] 装配草稿卷后 48 道题状态变为已装配。
- [ ] 已装配题不显示待装配。

### 10.4 修复与重生

- [ ] 选项过近走原题修复。
- [ ] 答案标注错误走原题修复。
- [ ] 缺英文版本走原题修复。
- [ ] topic mismatch 走重生。
- [ ] source similarity too high 走重生。
- [ ] 修复 3 次失败后转重生。

### 10.5 数学和双语

- [ ] 通过门禁题都有中英文版本 metadata。
- [ ] 后台候选列表数学符号正常显示。
- [ ] 已审核资产数学符号正常显示。
- [ ] 科目训练答题页数学符号正常显示。
- [ ] 在线模考答题页数学符号正常显示。
- [ ] 公式不会撑乱选项和解析布局。

## 11. 自动化验证

建议保留以下命令作为每轮改动后的最低验证：

```powershell
npm.cmd run csca-ai-questioning:rules
npm.cmd --prefix backend exec -- tsc -p backend/tsconfig.json --noEmit --incremental false --pretty false
npm.cmd --prefix frontend run build
```

规则测试至少覆盖：

1. scope 必填。
2. candidate/published/bulk 查询按 scope 过滤。
3. repair 保留 scope。
4. regenerate 保留 scope。
5. 科目训练 formal count 不被候选污染。
6. 在线模考 48/48 才完成。
7. 通过门禁题必须有双语。
8. 通过门禁题必须数学可渲染。
9. 用户侧科目训练 provider 能消费 AI 入库题。

## 12. 手工验收脚本

### 12.1 数学科目训练

```text
1. 清理 math + subject_practice 当前测试候选和任务。
2. 确认数学大纲 active。
3. 确认数学真题画像 active。
4. 选择一个缺题 topic。
5. 点击按缺口补题。
6. 观察任务：生成、修复、重生。
7. 等待正式入库数增长。
8. 达标后确认停止生成。
9. 到用户侧科目训练抽题。
10. 检查数学渲染和中英文版本。
```

### 12.2 数学在线模考卷

```text
1. 清理 math + mockBlueprintId 当前卷测试候选和任务。
2. 加载来源卷。
3. 生成/加载整卷蓝图。
4. 加载 48 题位。
5. 生成候选题。
6. 等待 48/48 入在线模考题库。
7. 确认同卷停止继续生成。
8. 装配草稿卷。
9. 检查 48 道题状态为已装配。
10. 切换卷 2，确认不显示卷 1 数据。
```

### 12.3 无真题画像学科

```text
1. 选择没有 active 真题画像的学科。
2. 确认前端提示 syllabus-only 或 missing_profile。
3. 不允许误报 missing_syllabus。
4. 如果启用 syllabus-only，生成题不计入画像增强覆盖。
```

## 13. 实施顺序

推荐顺序：

```text
阶段 1：scope 和查询隔离
阶段 2：清理和删除能力
阶段 3：数学/双语硬门禁
阶段 4：科目训练 gap 和 formal count
阶段 5：科目训练 repair-first 闭环
阶段 6：用户侧科目训练消费验证
阶段 7：在线模考 48/48 装配状态收口
阶段 8：前端流程页重排和局部刷新
阶段 9：上线迁移和旧任务清理
```

不能跳过阶段 1。scope 不稳，后面的候选、正式题、清理和前端状态都会继续混乱。

## 14. 当前优先级

从目前观察到的问题看，优先级应为：

1. 科目训练线正式题消费链路确认。
2. 科目训练候选治理和已入库题分离。
3. 可修复题 repair-first。
4. 数学和双语硬门禁。
5. 当前 topic / 当前卷清理删除。
6. 前端局部刷新和新题置顶。
7. 在线模考装配状态回写。

在线模考主体闭环已经接近可用；科目训练线现在是更大的风险点。

## 15. 最终验收口径

这次升级完成的定义：

```text
1. 管理员能看清共用准备、科目训练线、在线模考线。
2. 每条线的候选、任务、正式题、清理互不污染。
3. 数学科目训练能从缺口自动补到正式题达标。
4. 数学在线模考能自动补齐 48 道合格题并装配草稿卷。
5. 不合格题进入治理面板，不会被误算成功。
6. 通过门禁题数学渲染正常，且有中英文版本。
7. 用户侧科目训练和在线模考能消费对应正式题。
8. 开发测试数据可以按 scope 清理，线上旧任务可以安全下线。
```
