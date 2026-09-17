# AI 出题双线闭环最终执行方案

> 日期：2026-07-07  
> 状态：落地执行级方案  
> 范围：AI 题库后台、科目训练 AI 出题、在线模考 AI 出题、真题画像、大纲基线、候选治理、正式入库、数学渲染、清理重测、上线发布  
> 关联文档：
> - `docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md`
> - `docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`
> - `docs/subject-training-profile-adaptation-implementation-spec-2026-07-03.md`
> - `docs/subject-practice-ai-question-optimization-executable-plan-2026-07-07.md`
> - `docs/ai-question-bank-dual-line-executable-plan-2026-07-07.md`
> - `docs/ai-questioning-subject-optimization-and-math-rendering-execution-plan-2026-07-07.md`
> - `docs/ai-questioning-dual-line-implementation-work-orders-2026-07-07.md`
> - `docs/ai-questioning-executable-delivery-plan-2026-07-07.md`

## 1. 最终结论

当前 AI 出题要收束成两条清晰主线：

```text
共用准备层：
  1. 大纲基线
  2. 真题画像

分叉治理层：
  A. 科目训练线
     topic / gap -> AI 生成或修复 -> 门禁通过 -> 科目训练正式题库

  B. 在线模考线
     真题画像 -> 整卷蓝图 -> 48 个题位 -> AI 生成或修复
     -> 每个题位 1 道合格题 -> 在线模考题库 -> 草稿卷/正式卷
```

核心原则：

1. 大纲基线共用，决定能考什么。
2. 真题画像共用，决定真实考试通常怎么考。
3. AI 出题开始后必须分叉，科目训练和在线模考不能混用候选、任务、统计和正式资产。
4. 候选题不是成功结果，正式入库题才是成功结果。
5. 在线模考一套卷必须满 48 道合格题才算完成。
6. 科目训练必须按 topic/gap 的正式题覆盖达标才算完成。
7. 需要人工确认、建议重生、复审失败、fallback、数学渲染异常、缺双语版本的题不能自动入正式题库。
8. 可修复问题先原题修复，硬伤才重新生成。
9. 候选治理面板只治理异常候选，不作为正常成功题的必经流程。
10. 开发阶段不追求旧链路兼容，但线上部署需要一次性迁移、清理和回滚方案。

## 2. 当前主要问题

### 2.1 业务线混用

现象：

- 在线模考生成后，科目训练队列也可能显示运行。
- 切换模考卷后，候选列表可能仍显示上一卷数据。
- 前端总览统计、候选统计、任务统计口径不一致。

根因：

- `generationMetadata` / `reviewMetadata` 中的业务线归属不够强。
- 查询没有全部带上 `targetUseCase`、`mockBlueprintId`、`mockBlueprintSlotId`、`topicId` 等 scope 条件。
- 前端刷新和候选列表没有完全按当前工作区隔离。

### 2.2 科目训练没有闭环

现象：

- 候选题越来越多，但合格题为 0 或增长很慢。
- 一些题明明可以修，比如选项过近、答案标注错误、缺英文、LaTeX 不规范，却直接被重生替代。
- topic 看起来“处理过”，但正式训练题没有增加。

根因：

- 成功标准仍容易被候选数污染。
- 可修复问题没有分级。
- 自动入库门禁与正式题库映射之间没有完全收紧。

### 2.3 在线模考装配状态不清

现象：

- 已经提示 48/48，但候选仍显示“待装配”。
- 装配完成后，题目状态、草稿卷关联和候选列表状态不同步。

根因：

- “进入在线模考候选池”和“已装配进草稿卷”是两个状态，但前端没有分层展示。
- 装配动作没有统一回写 candidate-level metadata。

### 2.4 数学符号渲染不稳定

现象：

- `\dfrac`、`\sqrt`、上下标、区间、集合符号显示为原始文本。
- 某些题的公式被解析成重叠的 DOM，选项和解析布局被撑乱。
- 管理后台、科目训练、在线模考渲染效果不一致。

根因：

- 生成结果中存在不规范 LaTeX、双转义、缺定界符。
- 前端数学渲染组件没有作为唯一入口覆盖所有题目展示面。
- 入库门禁没有把“可渲染数学文本”作为硬条件。

## 3. 目标状态

### 3.1 科目训练线目标

```text
选择学科
-> 读取大纲 topic
-> 读取真题画像和历史正式题覆盖
-> 计算 gap
-> 自动生成或修复候选
-> Reviewer 门禁
-> 数学/双语/画像一致性门禁
-> 通过后自动进入科目训练正式题库
-> 当前 topic/gap 达标后停止
-> 异常候选进入治理面板
```

成功标准：

```text
approvedPracticeCount >= targetPracticeCount
并且这些题已经映射到科目训练/专项训练正式题库
```

### 3.2 在线模考线目标

```text
选择来源卷
-> 加载/生成整卷蓝图
-> 加载 48 个题位
-> 每个题位自动生成或修复候选
-> Reviewer 门禁
-> 数学/双语/画像一致性/相似度门禁
-> 每个题位保留 1 道合格题
-> 48/48 后自动进入在线模考题库
-> 可装配草稿卷
-> 装配后回写已装配状态
```

成功标准：

```text
readySlotCount = 48
approvedMockCandidateCount = 48
assembledDraftPaperQuestionCount = 48
```

### 3.3 候选治理面板目标

候选治理面板不是正常成功题库，而是异常处理台。

展示：

- `review_failed`
- `needs_edit`
- `human_review`
- `regenerate`
- `fallback`
- `math_text_invalid`
- `missing_bilingual_localization`
- `profile_alignment_warning`
- 管理员退回的题

不展示：

- 已进入科目训练正式题库的题。
- 已进入在线模考题库并可装配的题。
- 已装配进草稿卷的题。
- 已归档或已拒绝且不再处理的题，除非用户切换到历史筛选。

## 4. 数据设计

### 4.1 AI 题 scope

短期继续写入 `generationMetadata.scope`，后续稳定后再迁移为物理字段。

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

落地要求：

- 新生成题必须写完整 scope。
- 后台查询默认排除 `legacy`，除非用户选择历史数据。
- 所有统计、候选列表、清理、装配都必须按 scope 过滤。

### 4.2 正式题库口径

不要只用 `csca_questions.status = approved` 判断正式可用。

科目训练正式题：

```text
csca_questions.status = approved
+ generationMetadata.scope.targetUseCase = subject_practice
+ source_question_id / special practice mapping 存在
+ mapping status = published 或 active
```

在线模考正式候选：

```text
csca_questions.status = approved
+ generationMetadata.scope.targetUseCase = online_mock_exam
+ mockBlueprintId = 当前蓝图
+ mockBlueprintSlotId = 当前题位
+ mockExamApproval.status = approved_for_mock_exam_assembly
```

在线模考已装配题：

```text
在线模考正式候选
+ draftPaperId 存在
+ assembledAt 存在
+ assembledSlotNumber 存在
```

### 4.3 任务队列 scope

生成任务也必须带 scope：

```ts
type AIGenerationJobScope = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject: string;
  topicId?: number;
  gapKey?: string;
  mockBlueprintId?: number;
  mockBlueprintSlotId?: number;
  targetCount: number;
  stopWhenFulfilled: boolean;
  maxAttemptsPerItem: number;
};
```

队列调度规则：

- 科目训练任务只能补科目训练 gap。
- 在线模考任务只能补当前蓝图/题位。
- 已达标的 gap 或题位不能继续生成。
- 任务开始前和每次生成后都要重新检查达标状态。
- 如果达标，剩余 queued job 自动归档为 `fulfillment_already_complete`。

## 5. 门禁设计

### 5.1 通用硬门禁

所有自动入库都必须满足：

```text
not fallback
not smoke/test seed
not legacy
status 可进入审核
review score 达标
answer 正确且唯一
options 可用且互斥
explanation 可解释
profile alignment 达标
math text 可渲染
bilingual localization 完整
scope 完整
```

### 5.2 科目训练入库门禁

额外要求：

```text
targetUseCase = subject_practice
intendedUse = subject_practice
topicId 存在
gapKey 存在
不绑定 mockBlueprintId / mockBlueprintSlotId
通过 subject practice gate
写入科目训练/专项训练 mapping
```

入库后：

```text
question.status = approved
mapping.status = published/active
candidate 从异常候选治理中消失
topic/gap approvedCount 增加
达标后停止生成
```

### 5.3 在线模考入库门禁

额外要求：

```text
targetUseCase = online_mock_exam
intendedUse = mock_candidate
mockBlueprintId 存在
mockBlueprintSlotId 存在
mockSlotNumber 存在
与题位 targetProfile 匹配
与真题画像相似度不过高
同一题位只保留 1 道 active approved candidate
```

入库后：

```text
question.status = approved
mockExamApproval.status = approved_for_mock_exam_assembly
slot.readyQuestionId = question.id
readySlotCount 增加
48/48 后整卷状态 = ready_for_assembly
```

装配后：

```text
mockDraftPaperQuestion 创建 48 条
candidate.mockExamApproval.status = assembled
candidate.mockExamApproval.draftPaperId = draftPaper.id
candidate.mockExamApproval.assembledAt = now
```

## 6. 修复优先策略

### 6.1 可原题修复的问题

这些问题优先修复原题，不要直接重生：

- 选项过近。
- 选项格式不统一。
- 正确答案标注错误，但题干和解法可保留。
- 多个正确答案，但可通过改选项修复。
- 解析缺步骤。
- 英文版本缺失或翻译不完整。
- LaTeX 不规范。
- 题干表达不清但知识点匹配。
- 难度略偏但可通过改数字、改计算量修正。

修复任务输入：

```ts
type RepairJobInput = {
  originalQuestionId: number;
  repairReasons: string[];
  lockedFields: {
    subject: true;
    topicId: true;
    targetProfile: true;
    correctConcept: true;
  };
  editableFields: Array<
    | 'prompt'
    | 'options'
    | 'correctAnswer'
    | 'explanation'
    | 'localizations'
    | 'mathText'
    | 'difficultyTuning'
  >;
};
```

修复后必须重新走完整 Reviewer 和门禁。

### 6.2 必须重生的问题

这些问题不修，直接重生：

- 题目和目标 topic 不匹配。
- cognitiveSkill / questionForm 完全错位。
- 与真题或已有题相似度过高。
- 题干泄露答案。
- 题目本身不可成立。
- 需要图像但无图像，且无法转成纯文本题。
- provider 返回结构损坏严重，无法恢复。
- 连续修复超过上限仍失败。

### 6.3 循环停止条件

科目训练：

```text
while approvedPracticeCount < targetPracticeCount:
  先处理 repairable candidates
  再生成新 candidates
  每次成功入库后重算 gap
  达标立即停止
```

在线模考：

```text
while readySlotCount < 48:
  对缺题位先处理 repairable candidates
  再生成新 candidates
  每次成功入库后重算 slot readiness
  48/48 立即停止
```

防无限循环：

```text
同一 gap / slot 连续 N 次无入库 -> blocked
blocked 后显示主因，不再后台无限生成
管理员可选择：
  1. 调整画像
  2. 降低 target profile 的错误字段
  3. 手工编辑
  4. 重新生成
```

## 7. 前端设计

### 7.1 页面结构

AI 题库后台按流程展示：

```text
1 共用准备
  - 大纲基线
  - 真题画像

2 科目训练线
  - topic/gap 覆盖
  - 生成/修复队列
  - 正式训练题
  - 异常候选治理

3 在线模考线
  - 来源卷
  - 整卷蓝图
  - 题位
  - 48/48 进度
  - 在线模考候选池
  - 草稿卷装配
  - 异常候选治理
```

### 7.2 候选列表

科目训练候选列表：

```text
默认只展示当前学科、当前 topic/gap 的异常候选
新生成异常候选排在前面
支持板块内刷新
支持删除当前筛选候选
支持删除当前 topic/gap 生成结果
```

在线模考候选列表：

```text
默认只展示当前 mockBlueprintId 的异常候选
可按 slotNumber 筛选
卷 1 与卷 2 完全隔离
已装配题不在待治理列表中展示
```

### 7.3 状态文案

避免模糊文案。

禁止：

```text
运行中
失败
候选待处理
已通过
```

建议：

```text
正在生成：当前有 N 个 AI 请求处理中
正在修复：当前有 N 道候选题在二次优化
已达标：正式入库 N/N，已停止生成
等待装配：48/48 已入在线模考题库，尚未生成草稿卷
已装配：48/48 已写入草稿卷 #id
已阻塞：连续 N 次无合格题，主因是 xxx
```

## 8. 数学渲染方案

### 8.1 后端入库前规范化

生成后进入 Reviewer 前做一次数学文本规范化：

```text
统一 \( ... \)、\[ ... \]、$ ... $
修正 \\dfrac / \\frac 双转义
检查 \\frac{a}{b}
检查 \\sqrt{...}
检查上下标
检查 \\left / \\right 配对
检查集合、区间、无穷符号
```

不能自动修复的，标记：

```text
math_text_invalid
```

该状态不能自动入库。

### 8.2 前端统一渲染入口

所有题目文本必须通过同一个组件：

```text
MathContent
```

覆盖范围：

- AI 题库后台候选。
- 已审核 AI 资产。
- 科目训练题。
- 在线模考题。
- 解析、选项、英文版本、审题证据。

布局要求：

- 题干和解析使用文本流布局。
- 选项使用固定网格，不因公式高度导致错位。
- 长公式允许换行，不允许撑破卡片。
- 块级公式独占一行。
- 行内公式不能与中文数字重叠。

### 8.3 渲染验收

至少覆盖这些样例：

```text
\frac{x^2-1}{x-2} \geq 0
\sqrt{k^2+1}
(-\sqrt{3}, \sqrt{3})
(-\infty, -\sqrt{3}) \cup (\sqrt{3}, \infty)
x^2 + y^2 = 1
y = kx + 2
```

验收页面：

- AI 题库候选列表。
- AI 已审核资产。
- 科目训练练习页。
- 在线模考作答页。

## 9. 清理与重测

### 9.1 清理入口

开发阶段必须提供可控清理：

科目训练：

```text
清理当前学科异常候选
清理当前 topic/gap 异常候选
清理当前 topic/gap 全部 AI 生成结果
清理当前学科全部 AI 生成结果
```

在线模考：

```text
清理当前卷异常候选
清理当前卷全部 AI 生成结果
清理当前 slot 异常候选
清理当前 slot 全部 AI 生成结果
清理当前草稿卷装配结果
```

### 9.2 默认安全策略

默认清理只删除：

```text
未入库异常候选
生成任务
任务日志
临时修复结果
```

不删除：

```text
已正式入科目训练题库的题
已正式进入在线模考题库的题
已装配草稿卷
手工录入题
原始真题画像
大纲
```

危险清理必须二次确认，并在按钮文案明确影响范围。

## 10. 接口清单

### 10.1 科目训练

```text
GET  /admin/ai-questioning/subject-readiness
POST /admin/ai-questioning/subject-gaps/:gapKey/generate
POST /admin/ai-questioning/subject-candidates/:id/repair
POST /admin/ai-questioning/subject-candidates/:id/regenerate
POST /admin/ai-questioning/subject-candidates/:id/approve-to-practice-bank
POST /admin/ai-questioning/subject-cleanup
```

### 10.2 在线模考

```text
GET  /admin/ai-questioning/mock-sources
POST /admin/ai-questioning/mock-blueprints/generate-or-load
POST /admin/ai-questioning/mock-blueprints/:id/load-slots
POST /admin/ai-questioning/mock-blueprints/:id/generate-candidates
POST /admin/ai-questioning/mock-candidates/:id/repair
POST /admin/ai-questioning/mock-candidates/:id/regenerate
POST /admin/ai-questioning/mock-blueprints/:id/assemble-draft
POST /admin/ai-questioning/mock-cleanup
```

### 10.3 通用候选治理

```text
GET  /admin/ai-questioning/candidates?targetUseCase=...
POST /admin/ai-questioning/candidates/bulk-reject
POST /admin/ai-questioning/candidates/bulk-archive
POST /admin/ai-questioning/candidates/bulk-delete
POST /admin/ai-questioning/candidates/bulk-repair
```

## 11. 执行顺序

### Phase 0：冻结口径

目标：先统一成功标准，避免继续修错方向。

任务：

1. 明确 `targetUseCase`、`intendedUse`、`generationMode`。
2. 所有新生成题写完整 scope。
3. 所有统计改为正式入库口径。
4. 候选治理只显示异常候选。

验收：

- 科目训练和在线模考统计不互相影响。
- 切换卷不会显示其他卷候选。
- 已入库题不在异常候选列表中出现。

### Phase 1：在线模考闭环收口

目标：保证 48/48 真正代表一套卷完成。

任务：

1. 每个题位只认当前蓝图的合格候选。
2. 48/48 后停止生成。
3. 装配草稿卷后回写候选状态。
4. 当前卷支持清理和重测。

验收：

- 卷 1、卷 2 数据完全隔离。
- 48 道题满后不能继续生成，按钮显示“整套已完成”。
- 装配后 48 道题显示“已装配”，不再显示“待装配”。

### Phase 2：科目训练闭环

目标：科目训练从生成候选升级为补齐正式训练题。

任务：

1. topic/gap 以正式题 mapping 数为进度。
2. 生成前先检查 gap 是否已满足。
3. 可修候选优先修复。
4. 门禁通过后自动进入科目训练正式题库。
5. 达标后停止生成并归档剩余任务。

验收：

- 候选增加但正式题不增加时，系统会进入修复或阻塞，而不是无限生成。
- 达标 topic 不再继续生成。
- 清理后可稳定重新生成测试。

### Phase 3：数学和双语门禁

目标：不让渲染异常或缺英文的题进入正式题库。

任务：

1. 后端增加数学文本规范化和校验。
2. `missing_bilingual_localization` 阻止自动入库。
3. `math_text_invalid` 阻止自动入库。
4. 前端全部题面统一走 `MathContent`。
5. 复审证据展示具体原因。

验收：

- 新入库题都有中英文 metadata。
- 新入库题不出现裸 `\dfrac`、公式重叠、选项撑破。
- 管理后台、科目训练、在线模考渲染一致。

### Phase 4：Provider 稳定性和并发

目标：有限并发、可恢复、不卡死。

任务：

1. 支持小并发，例如 2 到 3 个 running job。
2. queued job 不被卡死 running 阻塞。
3. provider timeout / schema invalid 分类记录。
4. 自动重试有上限。
5. 无进展后进入 blocked，不无限后台循环。

验收：

- 前端能看到 running / queued / retry / blocked 的真实数量。
- 重启后不会重复处理已完成任务。
- provider 失败不会污染候选池。

### Phase 5：上线准备

目标：线上不因旧数据出错。

任务：

1. 备份线上数据库。
2. 跑 scope backfill，把旧 AI 题标成 `legacy` 或推断业务线。
3. 默认前端隐藏 legacy，保留历史筛选。
4. 部署前先在 staging 跑一次清理和生成闭环。
5. 部署后观察队列、provider 错误率、入库率。

验收：

- 线上首页和后台能正常打开。
- 旧手工题库仍可用。
- 新 AI 出题只处理新 scope 数据。
- 出错可回滚到部署前备份。

## 12. 测试计划

### 12.1 后端规则测试

必须覆盖：

```text
scope 完整性
subject_practice 与 online_mock_exam 强隔离
候选治理只查异常候选
正式入库口径不使用候选数
达标停止生成
可修复问题进入 repair
硬伤进入 regenerate
math_text_invalid 阻止入库
missing_bilingual_localization 阻止入库
mock 48/48 后可装配
mock 装配后状态回写
```

### 12.2 前端构建和规则测试

必须覆盖：

```text
AI 题库页面可构建
科目训练线筛选正确
在线模考线按卷筛选正确
候选板块内刷新
新候选按更新时间倒序
清理按钮文案明确范围
数学公式渲染不撑破布局
```

### 12.3 手工验收场景

场景 1：数学在线模考卷 1

```text
清理卷 1 生成结果
生成蓝图
加载 48 题位
生成候选
自动补齐 48 道门禁通过题
装配草稿卷
确认用户侧能打开完整 48 题
```

场景 2：数学在线模考卷 2

```text
切换卷 2
确认看不到卷 1 候选
重复生成和装配
确认卷 1 数据不变
```

场景 3：数学科目训练 topic

```text
选择一个缺题 topic
清理当前 topic AI 异常候选
启动补题
确认正式训练题数增加
确认达标后停止
确认异常候选只保留未入库失败题
```

场景 4：数学渲染

```text
检查含分式、根号、区间、集合、上下标的题
后台候选、已审核资产、科目训练、在线模考都正常显示
```

## 13. 部署方案

### 13.1 部署前

1. 停止后台生成任务。
2. 备份数据库。
3. 构建前端和后端。
4. 运行规则测试。
5. 跑旧数据 scope backfill。
6. 检查 `legacy` 数量。

### 13.2 部署中

1. 部署后端。
2. 跑数据库迁移。
3. 部署前端。
4. 重启队列 worker。
5. 打开后台确认页面无错误。

### 13.3 部署后

观察：

```text
provider_error_rate
schema_invalid_rate
math_text_invalid_count
missing_bilingual_count
subject_practice_auto_publish_count
mock_candidate_ready_count
mock_assembled_count
blocked_job_count
```

如果异常：

```text
停止 worker
保留前端后台只读
回滚服务或恢复数据库备份
```

## 14. 任务拆分清单

### 后端

- [ ] 统一 `AIQuestionScope` 写入。
- [ ] 所有候选查询增加 scope 过滤。
- [ ] 科目训练正式题统计改成 mapping 口径。
- [ ] 在线模考候选统计按 `mockBlueprintId` 和 `slotId` 过滤。
- [ ] 自动入库前增加数学和双语硬门禁。
- [ ] repair-first loop。
- [ ] 达标后归档剩余 queued job。
- [ ] 装配草稿卷后回写候选状态。
- [ ] 清理接口按 scope 删除。

### 前端

- [ ] 页面按“共用准备 / 科目训练线 / 在线模考线”布局。
- [ ] 科目训练候选只显示当前 scope 异常候选。
- [ ] 在线模考候选只显示当前卷异常候选。
- [ ] 候选板块内刷新。
- [ ] 新候选倒序。
- [ ] 清理按钮和确认文案。
- [ ] 所有题面统一 `MathContent`。
- [ ] 状态文案改成真实进度。

### 数据和运维

- [ ] 旧 AI 题 scope backfill。
- [ ] legacy 默认隐藏。
- [ ] 线上备份和回滚脚本。
- [ ] provider 错误监控。
- [ ] blocked job 运维视图。

## 15. 优先级

P0：

- scope 隔离。
- 正式入库口径。
- 候选治理只显示异常。
- 达标停止生成。
- 数学/双语硬门禁。

P1：

- repair-first loop。
- 装配状态回写。
- 清理和重测能力。
- 前端板块内刷新。
- 新候选倒序。

P2：

- 有限并发。
- provider 监控面板。
- legacy 历史筛选。
- 更细的画像质量报表。

## 16. 验收定义

这套方案完成后，必须能回答以下问题：

1. 当前这道题是科目训练题还是在线模考题？
2. 当前这道模考题属于哪一套卷、哪一个蓝图、哪一个题位？
3. 当前 topic 还差几道正式训练题？
4. 当前模考卷是否已经满 48 道合格题？
5. 为什么这道候选题没有入库？
6. 这道题是需要修复，还是必须重生？
7. 装配后题是否已经进入正式草稿卷？
8. 数学公式能否在后台、科目训练、在线模考都正确显示？
9. 清理当前测试数据会影响哪些资产？
10. 线上部署失败如何回滚？

只有这些问题都能在页面、接口和日志中明确回答，才算真正落地完成。
