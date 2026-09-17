# AI 出题双线闭环落地执行总控方案

> 日期：2026-07-07  
> 状态：可执行总方案  
> 范围：真题 JSON 解析、真题画像、大纲基线、科目训练 AI 出题、在线模考 AI 出题、候选治理、正式题库、数学渲染、双语版本、清理重测、线上部署  
> 目标读者：后端、前端、测试、产品验收  

## 1. 一句话结论

AI 出题后台必须收束成：

```text
共用准备层：
  1. 大纲基线
  2. 真题画像

分叉治理层：
  A. 科目训练线
     topic/gap -> 生成/修复 -> 门禁通过 -> 科目/专项训练正式题库

  B. 在线模考线
     来源真题卷 -> 整卷蓝图 -> 48 个题位
     -> 生成/修复 -> 每题位 1 道合格题
     -> 在线模考题库 -> 草稿卷/正式卷装配
```

关键原则：

1. 大纲和真题画像是共用源。
2. AI 出题开始后，科目训练和在线模考必须分线治理。
3. 候选题不是成功结果，正式入库题才是成功结果。
4. 在线模考一套卷必须满 48 道合格题才算完成。
5. 科目训练必须按 topic/gap 的正式题覆盖达标才算完成。
6. 可修复问题优先原题修复，硬伤才重新生成。
7. 不降低门禁来追求通过率。
8. 缺英文、数学不可渲染、fallback、需要人工确认、建议重生、复审失败的题不能自动进入正式题库。
9. 候选治理面板只处理异常候选，不作为正常成功题的必经流程。
10. 开发阶段采用干净架构；线上部署通过迁移、归档和回滚方案保护现有站点。

## 2. 当前问题清单

### 2.1 流程混在一起

现象：

- 在线模考生成时，科目训练队列也出现运行记录。
- 切换模考卷后，候选列表还显示上一卷的题。
- 后台总览、在线模考面板、候选治理面板统计口径不一致。

根因：

- 题目、任务、候选、审核、装配缺少强 scope。
- 查询没有全部带 `targetUseCase`、`topicId`、`mockBlueprintId`、`mockBlueprintSlotId` 等条件。
- 前端页面把共用准备层、科目训练线、在线模考线放在同一组流程卡里，容易误解。

### 2.2 科目训练闭环不完整

现象：

- 候选题越来越多，但正式可练习题没有稳定增加。
- 很多题只是选项、答案、双语、LaTeX 等可修问题，却直接重生。
- 生成结果分不清新旧，缺少时间、版本和 schema 记录。

根因：

- 成功标准被候选数污染。
- 修复优先策略不够强。
- 自动入库前的硬门禁没有完全收紧。

### 2.3 在线模考闭环不完整

现象：

- 48 道题位已经有候选，但未必有 48 道合格题。
- 装配后候选仍显示“待装配”。
- 已入库、待装配、已装配、草稿卷状态没有统一回写。

根因：

- “候选通过门禁”“进入在线模考题库”“装配进草稿卷”是不同状态，但前端展示混在一起。
- 候选列表没有按来源卷/蓝图隔离。

### 2.4 真题画像与大纲错误归因

现象：

- 明明数学、物理、化学都有大纲，却提示“没有大纲”。
- 某些科目没有真题画像，失败原因却落到 syllabus missing。
- `cognitiveSkill = unknown` 导致大量候选题无法匹配 targetProfile。

根因：

- 大纲缺失、画像缺失、画像维度缺失三类问题没有拆开。
- 上传的真题 JSON 只是原卷结构化输入，不应要求用户先填画像维度。
- 画像维度应由系统解析/映射/回填，而不是污染 targetProfile。

### 2.5 数学渲染不稳定

现象：

- `\dfrac`、`\sqrt`、集合、区间、上下标显示为原始文本。
- 有时整段解释被当成公式渲染，导致符号、数字、文字重叠。
- 后台、科目训练、在线模考展示不一致。

根因：

- 生成端 LaTeX 规范不稳定。
- 入库门禁没有把数学可渲染作为硬条件。
- 前端没有统一数学渲染入口和降级策略。

## 3. 术语和边界

### 3.1 真题 JSON

真题 JSON 是用户上传的原卷结构化输入。

它应该表达：

```text
document:
  subject
  title
  year
  language
  sourceType

questions:
  questionNumber
  promptText
  options
  correctAnswer
  explanation
  images
```

它不要求用户提前提供：

```text
questionForm
cognitiveSkill
difficultyBand
readingLoad
calculationLoad
optionStyle
distractorType
targetProfile
mock slot
```

这些维度由系统解析、映射、归一化、回填。

### 3.2 大纲基线

大纲基线回答：

```text
这个学科能考什么？
每个 topic / knowledge point 的稳定 ID 是什么？
```

大纲共用于科目训练和在线模考。

### 3.3 真题画像

真题画像回答：

```text
真实考试通常怎么考？
每道题是什么题型、技能、难度、阅读量、计算量、答案分布？
整卷如何分布？
```

真题画像共用于科目训练和在线模考，但使用方式不同：

```text
科目训练：
  用画像约束 topic/gap 的目标风格，避免专项题脱离真题风格。

在线模考：
  用画像生成整卷蓝图和 48 个题位，保证整卷结构接近真实考试。
```

### 3.4 蓝图

蓝图不是大纲，也不是画像。

蓝图是在线模考线的执行计划：

```text
某一套来源卷
-> 48 个题位
-> 每个题位应该考什么 topic、难度、题型、阅读量、计算量、答案分布
```

科目训练不使用整卷蓝图；科目训练使用 topic/gap 的 targetProfile。

## 4. 目标流程

### 4.1 共用准备流程

```text
上传真题 JSON
-> 校验原卷结构
-> 解析题目
-> 映射大纲 topic
-> 推断画像维度
-> 生成/更新真题画像
-> 标记画像状态 active
```

必须拆分三类状态：

```text
missing_syllabus:
  当前学科没有可用大纲。

missing_profile:
  当前学科没有可用真题画像。

incomplete_profile:
  有画像，但部分维度缺失，需要系统推断或人工补充。
```

错误提示必须准确：

```text
有大纲但无画像：
  当前学科已有大纲，但没有可用真题画像。请导入并自动画像真题 JSON。

有画像但维度缺失：
  当前真题画像缺少 cognitiveSkill/questionForm 等维度，系统将尝试从题干和答案结构推断。

无大纲：
  当前学科没有可用大纲，不能进入 AI 出题流程。
```

### 4.2 科目训练线

```text
选择学科
-> 读取大纲 topic
-> 读取 active 真题画像
-> 统计正式科目/专项训练题覆盖
-> 计算 topic/gap 缺口
-> 对每个缺口执行：
   1. 先查 repairable 候选
   2. 有可修候选则原题修复
   3. 无可修候选才生成新题
   4. Reviewer 审核
   5. 数学/双语/画像/相似度门禁
   6. 门禁通过后自动进入科目/专项训练正式题库
   7. 达标后停止
-> 异常候选进入治理面板
```

完成条件：

```text
approvedPracticeCount >= targetPracticeCount
```

这里的 `approvedPracticeCount` 必须来自正式题库映射，不允许用候选数量替代。

### 4.3 在线模考线

```text
选择来源真题卷
-> 加载/生成整卷蓝图
-> 加载 48 个题位
-> 对每个题位执行：
   1. 先查该题位 repairable 候选
   2. 有可修候选则原题修复
   3. 无可修候选才生成新题
   4. Reviewer 审核
   5. 数学/双语/画像/相似度门禁
   6. 通过后进入在线模考题库
   7. 该题位 ready
-> 48/48 ready 后整套完成
-> 自动或手动装配草稿卷
-> 装配后回写候选状态
```

完成条件：

```text
readySlotCount = 48
approvedMockCandidateCount = 48
draftPaperQuestionCount = 48
```

不能出现：

```text
候选 48 但合格题不足 48，却显示整套完成。
```

## 5. 数据模型落地

### 5.1 短期方案：metadata 强约束

短期不急着大迁表，先统一写入：

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

写入位置：

```text
csca_questions.generationMetadata.scope
```

所有新生成、修复、重生题必须写完整 scope。

### 5.2 稳定后迁移：物理字段

稳定后建议加物理字段，便于查询、索引、统计：

```sql
ALTER TABLE csca_questions ADD COLUMN ai_target_use_case text;
ALTER TABLE csca_questions ADD COLUMN ai_intended_use text;
ALTER TABLE csca_questions ADD COLUMN ai_subject text;
ALTER TABLE csca_questions ADD COLUMN ai_topic_id integer;
ALTER TABLE csca_questions ADD COLUMN ai_gap_key text;
ALTER TABLE csca_questions ADD COLUMN ai_mock_blueprint_id integer;
ALTER TABLE csca_questions ADD COLUMN ai_mock_blueprint_slot_id integer;
ALTER TABLE csca_questions ADD COLUMN ai_generation_mode text;
```

推荐索引：

```sql
CREATE INDEX idx_csca_questions_ai_subject_practice
ON csca_questions (ai_target_use_case, ai_subject, ai_topic_id, ai_gap_key, status);

CREATE INDEX idx_csca_questions_ai_mock
ON csca_questions (ai_target_use_case, ai_mock_blueprint_id, ai_mock_blueprint_slot_id, status);
```

### 5.3 正式科目训练题口径

科目训练正式题必须满足：

```text
csca_questions.status = approved
generationMetadata.scope.targetUseCase = subject_practice
generationMetadata.scope.intendedUse = subject_practice
special_practice_questions 映射存在
mapping.status in active/published
localizations.zh 完整
localizations.en 完整
mathTextGate = passed
review decision = publishable 或 manual_override_publishable
not fallback
not mock_candidate
not online_mock_exam
```

### 5.4 在线模考正式候选口径

在线模考题库候选必须满足：

```text
csca_questions.status = approved
generationMetadata.scope.targetUseCase = online_mock_exam
generationMetadata.scope.intendedUse = mock_candidate
mockBlueprintId = 当前蓝图
mockBlueprintSlotId = 当前题位
mockExamApproval.status = approved_for_mock_exam_assembly
localizations.zh 完整
localizations.en 完整
mathTextGate = passed
similarityGate = passed
not fallback
```

### 5.5 候选治理口径

候选治理面板只展示未入库异常候选：

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

默认不展示：

```text
已进入科目训练正式题库的题
已进入在线模考题库且 ready 的题
已装配进模考草稿卷的题
已拒绝/已归档的历史题
legacy 旧题
当前学科、topic、来源卷、蓝图之外的题
```

## 6. 门禁与修复策略

### 6.1 硬门禁

自动入库前必须全部通过：

```text
structure_gate:
  题干、选项、答案、解析结构完整。

bilingual_gate:
  中英双语完整，且 metadata 标记完整。

math_text_gate:
  LaTeX 可渲染，不能出现明显转义错误或 DOM 重叠风险。

syllabus_gate:
  topic / knowledge point 与大纲匹配。

profile_gate:
  questionForm、cognitiveSkill、difficulty、readingLoad、calculationLoad 与 targetProfile 可接受。

answer_gate:
  正确答案唯一，选项无多正确、无明显错误。

similarity_gate:
  不与真题或已入库 AI 题过度相似。

fallback_gate:
  fallback 题不能自动入库。
```

### 6.2 可原题修复的问题

这些问题优先 repair-in-place：

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
minor_difficulty_mismatch
profile_alignment_warning
```

修复规则：

```text
1. 保留原题 scope。
2. 保留原目标 topic/gap 或 mock slot。
3. 递增 repairAttempt。
4. 修复后重新 Reviewer + gate。
5. 最多修复 3 次。
6. 3 次后仍失败，标记 repair_exhausted，再走重生。
```

### 6.3 必须重生的问题

这些问题不适合原题修：

```text
topic_mismatch
syllabus_mismatch
source_similarity_too_high
prompt_leak
unsafe_content
unparseable_question
unsupported_question_type
image_required_but_missing
irreparable_profile_mismatch
repair_exhausted
```

重生规则：

```text
1. 原题标记 archived/regenerate_replaced。
2. 新题继承同一 scope。
3. prompt 带上失败原因，避免重复错误。
4. 重生不增加目标数量，只补同一个缺口。
5. 连续无进展达到阈值后标记 blocked，停止无限增长。
```

### 6.4 防止无限生成

每个 subject topic/gap 或 mock slot 维护：

```ts
type ProgressGuard = {
  targetCount: number;
  approvedCount: number;
  generatedCount: number;
  repairAttemptCount: number;
  regenerateCount: number;
  consecutiveNoProgressCount: number;
  lastApprovedAt?: string;
  status: 'active' | 'ready' | 'blocked';
};
```

建议阈值：

```text
单个缺口连续 12 次无合格题：blocked
单个候选修复 3 次仍失败：repair_exhausted
单个题位连续 20 次无合格题：blocked
provider 连续 5 次网络/timeout：provider_backoff
```

blocked 不是降低门禁，而是停止浪费任务，并向管理员说明具体卡点。

## 7. 后端执行工单

### BE-01 统一 scope 写入与查询

涉及：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/ai-questioning/question-generator.service.ts
backend/src/ai-questioning/question-prompt-builder.service.ts
```

任务：

1. 新增统一 scope builder。
2. 科目训练题写 `subject_practice` scope。
3. 在线模考题写 `online_mock_exam` scope。
4. 修复题继承原 scope。
5. 重生题继承被替换题 scope。
6. 所有候选、统计、清理、发布查询必须带 scope。

验收：

```text
生成在线模考题时，科目训练队列不新增任务。
生成科目训练题时，在线模考候选池不新增题。
切换来源卷后，不显示其他卷的候选。
```

### BE-02 真题画像解析归因

任务：

1. 上传 JSON 只校验原卷结构，不要求用户提供画像维度。
2. 系统解析并推断 `questionForm/cognitiveSkill/difficulty/readingLoad/calculationLoad`。
3. `unknown`、`n/a`、`未识别` 等 placeholder 不进入正式画像分布。
4. 错误归因拆为 `missing_syllabus`、`missing_profile`、`incomplete_profile`。

验收：

```text
有大纲无画像时，提示缺画像。
有画像但 cognitiveSkill unknown 时，走推断和补齐，不直接污染 targetProfile。
```

### BE-03 科目训练 repair-first 闭环

任务：

1. 计算 topic/gap 缺口时，只统计正式入库题。
2. 每个缺口生成前，先查 repairable 候选。
3. 可修候选优先修复。
4. 无可修候选才生成新题。
5. 门禁通过后自动发布到科目/专项训练正式题库。
6. 达标后停止生成。

验收：

```text
候选很多但正式题不足时，继续处理缺口。
已有可修候选时，不优先新增候选。
正式题达标后，不允许继续自动生成。
```

### BE-04 在线模考 48 题位闭环

任务：

1. 每套来源卷独立蓝图。
2. 每个蓝图 48 个题位独立状态。
3. 每个题位先修复，再生成。
4. 每题位 1 道门禁通过题后 ready。
5. 48/48 后整卷 completed。
6. 装配草稿卷后回写 candidate assembly metadata。

验收：

```text
48 个候选但未全部通过，不显示 completed。
48 个题位各有 1 道合格题后，显示整套完成。
卷 1 和卷 2 的候选、任务、草稿卷互不串。
```

### BE-05 自动入库最终防线

任务：

在正式发布函数前加入最终断言：

```text
assertSubjectPracticeFormalPublishable(question)
assertMockCandidateFormalPublishable(question)
```

必须拒绝：

```text
fallback
missing bilingual
math invalid
human_review
review_failed
regenerate
wrong scope
wrong targetUseCase
wrong intendedUse
```

验收：

```text
即使前端误点或其他调用绕过流程，后端也不能把不合格题入正式库。
```

### BE-06 清理重测接口

需要两类清理：

```text
安全清理：
  清理未入库候选、失败任务、临时生成记录。
  不删除正式题库资产。

危险清理：
  清理当前 scope 下所有 AI 生成结果，包括已入库 AI 题和映射。
  必须二次确认。
```

接口建议：

```http
POST /admin/ai-question-bank/cleanup
```

请求：

```json
{
  "targetUseCase": "subject_practice",
  "subject": "math",
  "topicId": 633,
  "mockBlueprintId": null,
  "includeApprovedAssets": false,
  "confirmText": null
}
```

危险清理确认：

```text
DELETE_SUBJECT_PRACTICE_AI_math_633
DELETE_ONLINE_MOCK_AI_BLUEPRINT_17
```

返回：

```json
{
  "deletedCandidates": 12,
  "deletedJobs": 4,
  "deletedApprovedQuestions": 0,
  "deletedPracticeMappings": 0,
  "deletedMockApprovals": 0,
  "deletedDraftLinks": 0
}
```

### BE-07 Provider 稳定性和并发

短期：

```text
同一 provider 有限并发：2-3
同一 topic/gap 或 mock slot 串行
网络/timeout 自动重试
schema invalid 进入修复或重生策略
provider 连续失败进入 backoff
```

长期：

```text
引入 Redis/BullMQ 队列
任务幂等 key
分布式锁
任务可恢复
```

验收：

```text
不会几十个任务同时打 provider。
不会因为一个卡住的 running 阻塞所有 queued。
前端展示 running/queued/backoff/blocked 的真实状态。
```

### BE-08 数学文本规范化

任务：

1. 生成前 prompt 明确 LaTeX 规范。
2. Reviewer 返回数学文本检查。
3. 入库前执行 mathTextGate。
4. 对可修数学问题走 repair-in-place。
5. 保存 normalized math text 和原始 text。

验收：

```text
\dfrac、\sqrt、上下标、集合、区间在后台、科目训练、在线模考都正常显示。
整段中文不会被当作公式渲染。
公式渲染失败的题不能自动入库。
```

## 8. 前端执行工单

### FE-01 首页/后台流程重新布局

页面应按流程分区：

```text
共用准备
  1 大纲基线
  2 真题画像

科目训练线
  3 科目训练补题
  4 科目候选治理
  5 科目正式题库

在线模考线
  3 整卷蓝图
  4 题位生成
  5 在线模考候选治理
  6 在线模考题库
  7 草稿卷装配
```

要求：

```text
分叉后视觉上分成两条线。
不要把科目训练候选和在线模考候选混成一个流程卡。
每张卡显示正式完成口径，而不是候选数量。
```

### FE-02 科目训练面板

展示：

```text
当前学科
topic/gap 缺口
正式题目标数
正式题已入库数
修复中数量
生成中数量
blocked 原因
最近任务
```

按钮：

```text
刷新当前板块
开始/继续自动补题
暂停
清理当前 topic 未入库候选
清理当前 topic 全部 AI 结果
```

隐藏或弱化：

```text
候选总数作为主成功指标
手动通过不合格题进入正式库
```

### FE-03 在线模考面板

展示：

```text
来源卷
蓝图状态
48 题位 ready 数
每个题位状态
整套完成状态
装配状态
```

按钮：

```text
刷新模考数据
生成/加载整卷蓝图
加载题位
继续自动补齐 48 题位
装配草稿卷
清理当前卷未入库候选
清理当前卷全部 AI 结果
```

要求：

```text
候选列表必须按当前来源卷/蓝图过滤。
切换卷后，不显示上一卷题。
48/48 完成后，继续生成按钮 disabled，并提示整套已完成。
```

### FE-04 候选治理面板

候选治理面板的文案必须改清楚：

```text
这里展示未入库的异常候选，用于查看失败原因、复审、编辑、拒绝或归档。
门禁通过的题会自动进入对应正式题库，不需要在这里手工确认。
```

筛选：

```text
业务线：科目训练 / 在线模考
学科
topic/gap
来源卷
蓝图
题位
状态
失败原因
生成版本
时间范围
```

排序：

```text
默认按 updatedAt desc
新生成/新失败的排前面
```

板块刷新：

```text
候选列表单独刷新
不刷新整页
不跳回流程总览
```

### FE-05 已审核资产面板

已审核资产面板展示已经门禁通过的题，但要区分：

```text
科目训练：
  已入正式科目/专项题库

在线模考：
  已进入模考候选池
  已装配进草稿卷
```

状态标签：

```text
科目题：已入库
模考题：候选可装配
模考题：已装配
```

### FE-06 数学渲染统一组件

所有题目展示面必须使用同一数学渲染组件：

```text
后台候选列表
后台已审核资产
科目训练学生端
在线模考学生端
错题/解析
导出预览
```

要求：

```text
普通中文按文本渲染。
只把明确的数学片段送给 KaTeX。
渲染失败时显示原文并标记 math_render_warning。
不能让 KaTeX DOM 把选项或解析撑乱。
```

## 9. 测试与验收

### 9.1 单元/规则测试

必须覆盖：

```text
scope 写入
scope 查询隔离
unknown placeholder 不进入画像分布
missing_syllabus / missing_profile / incomplete_profile 归因
repairable 问题优先修复
hard failure 进入重生
fallback 不能入库
缺英文不能入库
数学不可渲染不能入库
正式题数达标后停止生成
在线模考 48/48 才 completed
候选列表按当前卷过滤
清理接口安全模式不删正式资产
危险清理需要确认文本
```

### 9.2 手工验收脚本

#### 科目训练

```text
1. 清理数学某 topic 的 AI 结果。
2. 启动自动补题。
3. 观察可修候选先被修复。
4. 观察门禁通过题自动入科目/专项正式库。
5. 达标后停止生成。
6. 候选治理只剩异常候选。
7. 学生端科目训练能看到正式题。
```

#### 在线模考

```text
1. 选择数学模拟卷 1。
2. 生成/加载整卷蓝图。
3. 启动自动补齐。
4. 观察每个题位 ready。
5. 48/48 后整套 completed。
6. 装配草稿卷。
7. 切换数学模拟卷 2，确认不显示卷 1 候选。
8. 学生端在线模考能看到装配卷。
```

#### 数学渲染

```text
1. 检查包含 \dfrac、\sqrt、区间、集合、上下标的题。
2. 后台候选列表正常。
3. 已审核资产正常。
4. 科目训练学生端正常。
5. 在线模考学生端正常。
6. 无符号数字重叠、无整段文字被公式化。
```

## 10. 上线与清理方案

### 10.1 上线前

```text
1. 备份线上数据库。
2. 跑 dry-run 迁移脚本，统计 legacy AI 题数量。
3. 给旧题补 scope = legacy。
4. 给可识别旧题回填 targetUseCase。
5. 默认后台不展示 legacy，除非打开历史筛选。
6. 暂停旧生成任务。
7. 清理卡住 running/queued 任务。
```

### 10.2 上线时

```text
1. 部署后端。
2. 部署前端。
3. 启动 scheduler。
4. 验证 provider 配置。
5. 验证数学、化学、物理大纲状态。
6. 验证数学真题画像状态。
7. 先用数学一套卷跑在线模考闭环。
8. 再用数学一个 topic 跑科目训练闭环。
```

### 10.3 回滚

必须保留：

```text
1. 后端版本回滚命令。
2. 前端版本回滚命令。
3. scheduler 停止命令。
4. 新增任务暂停开关。
5. 新增 AI 结果按 scope 清理脚本。
```

## 11. 执行顺序

### 阶段 1：数据边界和错误归因

优先级最高。

完成：

```text
scope 写入
scope 查询隔离
missing_syllabus / missing_profile / incomplete_profile
unknown 画像维度过滤和推断
```

如果这一步没完成，后续所有统计都会继续混乱。

### 阶段 2：在线模考闭环收紧

完成：

```text
每卷独立
每蓝图独立
每题位独立
48/48 合格才 completed
装配回写状态
候选列表按卷过滤
```

在线模考当前流程接近目标，所以先收口比较快。

### 阶段 3：科目训练 repair-first 闭环

完成：

```text
topic/gap 缺口按正式题库统计
可修候选优先修复
硬伤重生
达标停止
自动入科目/专项正式库
候选治理只显示异常候选
```

这是质量提升的核心。

### 阶段 4：数学渲染和双语硬门禁

完成：

```text
生成端规范
Reviewer 检查
后端 mathTextGate
前端统一渲染
缺英文自动修复
```

这一步是正式入库前的质量护栏。

### 阶段 5：清理、重测、上线

完成：

```text
安全清理
危险清理
legacy 隔离
线上部署检查表
回滚脚本
```

## 12. 不做事项

本阶段不做：

```text
PDF OCR
用户手工填写画像维度
降低门禁换通过率
把科目训练题和在线模考题混成一个候选池
让候选数量作为成功指标
让不完整双语题自动入库
让数学渲染异常题自动入库
```

## 13. 最终验收口径

### 13.1 产品验收

```text
后台流程一眼能看出：
  共用准备
  科目训练线
  在线模考线

用户能明确知道：
  当前是否缺大纲
  当前是否缺真题画像
  当前是否在生成
  当前还差几道正式题
  当前失败原因是什么
  当前是否已经完成
```

### 13.2 工程验收

```text
所有新 AI 题都有 scope。
所有统计按 scope 查询。
所有正式入库都有最终断言。
所有自动任务可恢复、可停止、可清理。
所有候选可追踪生成时间、版本、prompt、provider、reviewer、schema。
```

### 13.3 质量验收

```text
科目训练：
  topic/gap 达标后停止。
  正式题可在学生端训练。

在线模考：
  48/48 合格后完成。
  草稿卷 48 题完整。

数学渲染：
  后台和学生端一致。
  无符号重叠。
  无大段文字被公式化。
```

## 14. 开发任务拆分建议

第一批 PR：

```text
BE-01 scope 写入与查询隔离
BE-02 错误归因和画像维度归一化
规则测试
```

第二批 PR：

```text
BE-03 科目训练 repair-first
BE-05 自动入库最终防线
FE-02 科目训练面板状态
```

第三批 PR：

```text
BE-04 在线模考 48 题位闭环
FE-03 在线模考面板隔离
FE-05 已审核资产状态
```

第四批 PR：

```text
BE-08 数学文本门禁
FE-06 数学渲染统一组件
双语自动修复
```

第五批 PR：

```text
BE-06 清理重测接口
FE 清理按钮和确认
上线迁移脚本
回滚脚本
```

## 15. 关联文档

背景和细节可继续参考：

```text
docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md
docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md
docs/subject-training-profile-adaptation-implementation-spec-2026-07-03.md
docs/ai-questioning-dual-line-final-execution-plan-2026-07-07.md
docs/ai-questioning-dual-line-implementation-work-orders-2026-07-07.md
docs/subject-practice-ai-question-hardening-executable-roadmap-2026-07-07.md
docs/ai-questioning-subject-optimization-and-math-rendering-execution-plan-2026-07-07.md
```

本文件作为后续开发总控方案；如果其他文档与本文件冲突，以本文件为准。
