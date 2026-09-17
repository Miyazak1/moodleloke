# 科目训练一次追加生产闭环执行方案

日期：2026-07-09

关联文档：

- `docs/subject-practice-production-matrix-executable-plan-2026-07-09.md`
- `docs/adaptive-training-predictive-replenishment-executable-plan-2026-07-09.md`

## 1. 结论

科目训练题的“一次追加”不能再理解为“提交一批生成任务”。

新的定义是：

```text
一次追加 = 创建并执行一个科目训练生产计划
生产计划 = 覆盖当前学科所有目标知识点和难度配额的生产矩阵
完成标准 = 每个知识点、每个难度的合格入库题数都达到目标
```

也就是说，管理员点击一次追加后，系统要持续生成、审核、修复、替代生成和入库，直到：

1. 所有目标 cell 达标，run 进入 `completed`。
2. 或者出现明确阻塞，run 进入 `blocked`，并说明哪个知识点、哪个难度、什么原因卡住。

候选题数量、生成任务数量、AI 调用成功数量，都不能代表这次追加完成。

## 2. 为什么必须先做这个机制，再做全自动补题

全自动补题本质上只是“自动触发一次生产计划”。

如果现在的手动追加还不能做到：

- 覆盖所有知识点；
- 覆盖 basic / medium / hard；
- 按目标比例完成；
- 候选异常可治理；
- 能判断 completed / blocked；

那么全自动补题只会把问题放大：

- 某些知识点一直缺题；
- 某些难度一直缺题；
- 候选题越堆越多；
- 前端显示“成功”，但正式题库没有达标；
- 学生端仍然可能抽不到合适题。

因此顺序必须是：

```text
手动一次追加生产闭环
-> 验证稳定
-> 预测补题/定时补题复用同一套 run
-> 学生端只消费正式题库，不等待生成
```

## 3. 当前问题

### 3.1 一次追加没有目标闭环

当前“追加合格题”更接近批量提交生成任务。任务结束时，系统没有保证所有目标知识点都达标，也没有保证每个难度配额达标。

### 3.2 难度分布会偏斜

观察到已入库题容易集中在 `medium`。原因通常包括：

- 调度只优先处理排序靠前的 gap；
- 生成目标没有按 difficulty cell 拆分；
- 难度配额没有成为完成条件；
- reviewer 通过后没有回填到对应 difficulty target；
- 未达标难度没有被持续重试。

### 3.3 候选膨胀但合格题不增长

如果候选一直增加，但门禁通过题不增加，系统应该进入“候选治理优先”：

- 可修复问题先修复；
- 不可修复问题归档/拒绝；
- 达到候选上限后停止继续堆候选；
- 仍然没有进展时 run 阻塞。

不能继续无限生成新候选。

### 3.4 前端语义容易误导

“入队成功”“成功 29”“自动重试中”不能等同于“正式题库已达标”。

前端必须把三个层级分开：

1. 生产计划状态：planned / running / blocked / completed。
2. 正式资产状态：已入库、可装配、可抽题。
3. 候选治理状态：待修复、复审失败、建议重生、已归档。

## 4. 目标行为

### 4.1 管理员操作

后台选择学科后，管理员点击：

```text
创建/继续科目训练生产计划
```

系统自动完成：

1. 读取当前学科已启用大纲。
2. 读取当前学科可用真题画像。
3. 生成生产矩阵。
4. 对每个知识点拆分难度配额。
5. 按 cell 调度生成候选。
6. 门禁通过后自动入正式科目训练题库。
7. 可修复失败自动修复。
8. 不可修复失败归档并替代生成。
9. 直到所有 cell 达标或明确 blocked。

### 4.2 完成标准

run 只能在下面条件全部满足时进入 `completed`：

```text
for every cell:
  publishedCount >= targetCount
```

其中 `publishedCount` 必须只统计正式入库题：

- AI 题；
- 科目训练用途；
- 当前生产 run/cell；
- 门禁通过；
- 已写入 `special_practice_questions`；
- 状态为可被学生端抽取。

不能计入：

- 候选题；
- 待审核题；
- 建议重生题；
- 复审失败题；
- 人工确认题；
- 在线模考候选；
- smoke/fallback 测试题；
- 难度不匹配的题；
- 没有双语版本但要求双语的题。

## 5. 生产矩阵

### 5.1 cell 定义

最小生产单位是 cell：

```text
subject + topic + difficulty + questionForm + targetProfile
```

建议字段：

```ts
type SubjectPracticeProductionCell = {
  id: number;
  runId: number;
  subject: string;
  topicId: number;
  topicCode: string | null;
  topicTitle: string;
  difficultyBand: 'basic' | 'medium' | 'hard';
  questionForm: 'single_choice';
  targetProfile: {
    cognitiveSkill: string;
    readingLoad: 'low' | 'medium' | 'high';
    calculationLoad: 'light' | 'medium' | 'heavy';
    imageRequirement?: 'none' | 'optional' | 'required';
  };
  targetCount: number;
  publishedCount: number;
  candidateCount: number;
  failedCount: number;
  openCount: number;
  candidateLimit: number;
  status: 'open' | 'running' | 'blocked' | 'completed';
  failureCode: string | null;
  failureMessage: string | null;
};
```

### 5.2 难度配额

难度配额必须显式进入 cell，而不是由生成 prompt 自由发挥。

第一版采用配置化策略：

```ts
type DifficultyQuotaPolicy = {
  policyVersion: string;
  perTopicTarget: number;
  ratios: {
    basic: number;
    medium: number;
    hard: number;
  };
  minPerDifficulty: {
    basic: number;
    medium: number;
    hard: number;
  };
};
```

当前落地版本使用：

```text
targetPolicyVersion = subject-practice-matrix-v1
```

如果当前知识点大纲允许 basic / medium / hard 三个难度，且每个知识点目标 9 道，则配额为：

```text
basic 1
medium 4
hard 4
```

这个比例不能写死在前端，已放在后端 policy 中，并写入 run：

```text
targetPolicyVersion = subject-practice-matrix-v1
```

真题画像继续提供题型、认知技能、阅读负载和计算负载；但是否创建 basic / medium / hard cell，由该 production policy 和大纲允许难度共同决定，避免画像样本偏斜导致某个难度长期不生产。

以后可以按学科单独调整，例如：

- 数学：hard 比例更高。
- 化学：medium/basic 比例更高。
- 物理：计算型 hard 题需要单独控制候选上限。

### 5.3 cell 创建规则

创建 run 时一次性生成所有 cell。

输入：

- 学科；
- 当前应用中的大纲；
- 当前可用真题画像；
- 已发布科目训练 AI 题；
- 已发布手工专项题；
- 目标配额 policy。

输出：

- 每个需要生产的 topic/difficulty cell；
- 每个 cell 的 `targetCount`；
- 当前已入库数量；
- 当前缺口数量；
- 候选上限。

如果某个 topic 当前已经满足所有难度配额，可以不创建 open cell，或者创建 completed cell 用于审计。第一版建议创建 completed cell，便于前端展示完整矩阵。

## 6. 调度策略

### 6.1 不再只按知识点顺序生成

调度必须按 cell 维度进行，而不是只按 topic 维度。

每轮调度输入：

```text
open cells = publishedCount < targetCount
```

排序建议：

1. openCount 大的优先。
2. 当前 running job 少的优先。
3. candidateCount 低于 candidateLimit 的优先。
4. long-starved cell 优先。
5. basic / medium / hard 做轮转，避免 medium 吃满队列。

### 6.2 每轮有限并发

不能一次性把所有 cell 全部发给 AI。

建议第一版：

```text
maxJobsPerRound = 6
maxJobsPerDifficulty = 2
maxConcurrentRunningJobs = 3
```

这样一轮最多：

```text
basic 2 + medium 2 + hard 2
```

如果某个难度已经达标，则它的额度让给其他未达标难度。

### 6.3 untilComplete 循环

“继续直到完成”不是一次发很多任务，而是循环执行：

```text
while run not completed and not blocked:
  refresh run
  repair candidate backlog
  refresh run
  dispatch generation jobs for open cells
  wait for job progress or next tick
  refresh run
  detect progress
  if no progress too many rounds:
    block run
```

服务端必须允许这个循环被中断和恢复。重启后，running run 应由 startup/scheduled runner 继续推进。

## 7. 候选治理优先级

### 7.1 先治理，再生成

对于一个 cell，如果已经有未入库候选：

```text
candidateCount > 0
```

系统应该先处理候选 backlog，而不是继续生成新候选。

顺序：

1. 门禁已通过但未入库：自动入库。
2. 软失败：自动修复。
3. 修复后再审。
4. 硬失败：归档/拒绝。
5. 归档后按缺口生成替代题。

### 7.2 软失败

软失败可以在原题基础上优化：

- 选项过于接近；
- 选项表达不清；
- 解析缺少关键步骤；
- 正确答案标记错误但题干可用；
- 多个正确答案但可通过改选项修复；
- 英文版本缺失；
- LaTeX 包裹不规范；
- 数学渲染可修复。

软失败不应直接丢弃重生。

### 7.3 硬失败

硬失败应直接归档并替代生成：

- 知识点不匹配；
- 难度明显不匹配；
- 和真题/已有题过度相似；
- 题干泄露答案；
- 条件不完整；
- 无法唯一求解；
- 题型不符合；
- 目标画像缺失导致无法判断；
- prompt/schema 产物不可解析。

硬失败不计入候选上限中的“可修复候选”，但需要计入失败审计。

### 7.4 候选上限

每个 cell 必须有候选上限：

```text
candidateLimit = min(120, max(12, neededCount * 6, targetCount * 2))
```

如果达到上限且没有可修复候选：

```text
cell.status = blocked
cell.failureCode = candidate_limit_reached
```

run 不应继续为该 cell 生成。

## 8. 入库规则

### 8.1 自动入库

科目训练题通过门禁后，应自动进入正式科目训练题库。

入库时必须写入：

- `sourceType = ai`
- `targetUseCase = subject_practice`
- `targetQuestionBank = special_practice_questions`
- `productionRunId`
- `productionCellId`
- `topicId`
- `difficultyBand`
- `gateVersion`
- `generatorPromptVersion`
- `reviewerPromptVersion`
- `schemaVersion`
- `createdAt`
- `updatedAt`

### 8.2 入库后回填 cell

入库成功后立即刷新 cell：

```text
publishedCount += 1
openCount = max(targetCount - publishedCount, 0)
```

如果 cell 达标：

```text
cell.status = completed
```

如果所有 cell 达标：

```text
run.status = completed
```

### 8.3 不允许跨 run 污染

已入库题必须能追溯到具体 run/cell。

切换学科、切换知识点、切换 run 时，前端不能展示另一个 run 的候选或入库题。

## 9. 前端改造

### 9.1 入口调整

旧入口：

```text
补齐合格题
追加合格题
```

应降级为局部工具或改成：

```text
创建生产计划
继续生产计划
```

当前落地约束：

- 页面主入口是“科目训练生产计划”。
- 旧的批量“补齐/追加合格题”按钮只能作为局部排障工具，不再作为一次追加入口。
- 默认前端应禁用旧批量候选补题/追加入口，避免绕过 production run。
- 单知识点操作可以保留为调试和排障，但文案必须明确“不代表生产计划完成”。

文案必须明确：

```text
本操作会持续补齐所有知识点和难度配额，直到正式入库题达标或出现阻塞。
```

### 9.2 展示顺序

科目训练线建议顺序：

1. 生产计划总览。
2. 已入库/可抽题 AI 题。
3. 未入库异常候选。
4. 质量治理。
5. 历史任务。

原因：

- 管理员首先关心正式题库是否达标。
- 候选治理只是异常处理，不是成功题库。
- 已入库题要展示在候选题上面。

### 9.3 生产计划总览字段

必须展示：

- run id；
- subject；
- status；
- target total；
- published total；
- open total；
- candidate total；
- failed total；
- basic/medium/hard 目标与完成；
- 阻塞 cell；
- 最新生成/修复/入库时间；
- 最近一次失败原因；
- 是否正在自动恢复。

### 9.4 cell 列表

每个 cell 展示：

```text
知识点
难度
目标
已入库
缺口
候选
失败
状态
最近原因
操作
```

操作包括：

- 查看入库题；
- 查看异常候选；
- 手动处理一轮；
- 清理本 cell 异常候选；
- 取消/归档本 cell。

### 9.5 状态文案

禁止使用模糊文案：

- “成功 29”
- “处理中”
- “已提交”

应改成明确文案：

```text
已入库 29 / 目标 117
缺口 88
候选 14
失败 3
运行中：正在处理 hard / topic_62
阻塞：medium / topic_637 候选达到上限
```

## 10. API 设计

### 10.1 创建 run

```http
POST /api/v1/admin/ai-questioning/subject-practice-production-runs
```

请求：

```json
{
  "subject": "math",
  "targetPolicyVersion": "subject-practice-production-v1",
  "triggerType": "manual"
}
```

响应：

```json
{
  "run": {
    "id": 101,
    "subject": "math",
    "status": "planned",
    "targetTotal": 117,
    "publishedTotal": 0,
    "openTotal": 117
  }
}
```

### 10.2 继续处理

```http
POST /api/v1/admin/ai-questioning/subject-practice-production-runs/:id/process
```

请求：

```json
{
  "untilComplete": true,
  "maxRounds": 20,
  "maxJobsPerRound": 6,
  "maxJobsPerDifficulty": 2
}
```

响应：

```json
{
  "run": {
    "id": 101,
    "status": "running",
    "targetTotal": 117,
    "publishedTotal": 32,
    "openTotal": 85,
    "candidateTotal": 11,
    "failedTotal": 2
  },
  "processed": 4,
  "repaired": 2,
  "enqueued": 6,
  "rounds": 3
}
```

### 10.3 查询 run

```http
GET /api/v1/admin/ai-questioning/subject-practice-production-runs?subject=math
GET /api/v1/admin/ai-questioning/subject-practice-production-runs/:id
```

必须返回 cells。

### 10.4 清理候选

```http
POST /api/v1/admin/ai-questioning/subject-practice-production-runs/:id/cleanup-candidates
```

支持：

- 清理整个 run；
- 清理某个 cell；
- 只清理 hard failed；
- 只清理当前机制版本之前的旧候选。

## 11. 数据一致性

### 11.1 正式题统计 SQL 约束

统计正式入库题时必须同时满足：

```sql
q.source_type = 'ai'
AND q.status = 'approved'
AND spq.status = 'published'
AND q.generation_metadata->>'targetUseCase' = 'subject_practice'
AND q.generation_metadata->>'targetQuestionBank' = 'special_practice_questions'
AND q.generation_metadata->>'productionRunId' = :runId
AND q.generation_metadata->>'productionCellId' = :cellId
```

### 11.2 候选统计 SQL 约束

候选只统计：

```sql
q.status IN ('draft', 'pending_review', 'review_failed')
AND q.generation_metadata->>'productionRunId' = :runId
AND q.generation_metadata->>'productionCellId' = :cellId
```

### 11.3 不统计旧题

旧机制生成的题，如果没有 `productionRunId / productionCellId`，不能计入新生产矩阵完成度。

开发阶段如果更新了生成机制，旧题不满足新规则，应由开发侧清理，不要求用户逐题处理。

## 12. 后端执行流程

### 12.1 createRun

```text
validate subject
load active syllabus
load active style profile
load target policy
build cells by topic + difficulty
count existing published AI questions
insert run + cells
return run
```

### 12.2 processRun

```text
refresh run
if completed or blocked: return

for round in maxRounds:
  repairCandidateBacklog()
  refresh run
  if completed or blocked: return

  dispatchGenerationJobs()
  refresh run
  detectProgress()

  if no progress:
    noProgressRounds += 1
  else:
    noProgressRounds = 0

  if noProgressRounds >= maxNoProgressRounds:
    block run with no_progress
```

### 12.3 repairCandidateBacklog

```text
for each open cell with candidates:
  passable candidates -> publish
  soft failures -> repair and re-review
  hard failures -> archive
  if archived and cell still open -> generate replacement later
```

### 12.4 dispatchGenerationJobs

```text
select open cells
exclude completed cells
exclude blocked cells
exclude cells over candidateLimit
round-robin by difficulty
limit by maxJobsPerRound
limit by maxJobsPerDifficulty
enqueue jobs with productionRunId and productionCellId
```

## 13. 与在线模考的边界

科目训练生产 run 只能生成：

```text
targetUseCase = subject_practice
targetQuestionBank = special_practice_questions
```

不能使用：

- `mock_exam_blueprint_slot`
- `online_mock_exam_candidate`
- 在线模考整卷蓝图
- 在线模考草稿卷装配逻辑

在线模考整卷生产应保留自己的 run/cell/slot 体系。

两个流程共用：

- 大纲基线；
- 真题画像；
- AI provider；
- 生成器；
- reviewer；
- 通用质量门禁；
- 数学渲染处理。

两个流程分开：

- 生产矩阵；
- 完成标准；
- 候选池；
- 正式题库；
- 装配逻辑；
- 前端治理面板。

## 14. 验收标准

### 14.1 手动一次追加

1. 选择数学，创建 run。
2. run 生成所有 topic/difficulty cell。
3. 点击继续直到完成。
4. basic / medium / hard 都出现生成和入库。
5. 某个难度未达标时，run 不得 completed。
6. 候选增加但入库不增加时，系统先治理候选。
7. 候选达到上限时 cell blocked。
8. 所有 cell 达标时 run completed。

### 14.2 前端展示

1. 已入库 AI 题展示在候选治理上方。
2. 候选治理只展示未入库异常候选。
3. 生产计划总览显示总目标、已入库、缺口。
4. 难度维度显示 basic / medium / hard 进度。
5. 状态文案不再把“入队成功”表述为“补题完成”。

### 14.3 学生端

1. 学生端只抽正式入库题。
2. 新入库科目训练 AI 题可被专项练习抽取。
3. 如果库存不足，学生端不等待 AI 生成，而是走降级抽题或提示库存不足。

### 14.4 重启恢复

1. 后端重启后，running run 仍能恢复。
2. stale running job 会被标记并进入恢复策略。
3. 自动恢复不能无限重试同一个不可恢复失败。

## 15. 实施顺序

### Phase 1：补齐生产矩阵语义

1. 确认 `subject_practice_production_runs` 和 `subject_practice_production_cells` 字段。
2. 增加难度配额 policy。
3. 创建 run 时生成完整 topic/difficulty cells。
4. 完成度只统计正式入库题。

### Phase 2：调度改造

1. 调度从 topic 改为 cell。
2. 增加 difficulty round-robin。
3. 增加 `maxJobsPerDifficulty`。
4. 增加 `candidateLimit`。
5. 阻塞 cell 不再继续生成。

### Phase 3：候选治理优先

1. processRun 先治理候选。
2. 软失败自动修复。
3. 硬失败归档。
4. 归档后替代生成。
5. no-progress 阻塞。

### Phase 4：前端语义重排

1. 生产计划面板放在科目训练线顶部。
2. 已入库题放在候选治理上方。
3. 候选治理改名为“异常候选治理”。
4. 删除或降级旧的“追加合格题”按钮。
5. 状态展示改成目标/入库/缺口。

### Phase 5：全自动补题接入

1. 库存巡检只创建 production run。
2. 学生端缺题只打补题信号，不同步生成。
3. 预测补题和手动补题复用同一套 processRun。

## 16. 风险与处理

| 风险 | 处理 |
| --- | --- |
| AI 连续生成不合格题 | 候选治理优先、软修复、硬归档、no-progress 阻塞 |
| hard 难度通过率低 | 单独统计 hard cell，通过 prompt 和 targetProfile 优化，不降低门禁 |
| 候选池膨胀 | candidateLimit + blocked |
| 前端误解状态 | 入库/候选/任务三层拆开展示 |
| 重启导致任务丢失 | startup/scheduled runner 恢复 running run |
| 旧题污染统计 | 只统计带 productionRunId/cellId 的新题 |
| 在线模考混入科目训练 | targetUseCase 和 targetQuestionBank 双重约束 |

## 17. 给后续开发任务的简短指令

后续实现时，任务目标可以写成：

```text
请按 docs/subject-practice-one-click-production-completion-loop-2026-07-09.md 执行：
把科目训练“追加合格题”升级为 production run 闭环。
一次追加必须覆盖当前学科所有目标知识点和 basic/medium/hard 配额。
只有正式入库题达到每个 cell 的 targetCount 才算 completed。
候选题不能计入完成；候选积压时先自动修复/归档，再继续生成。
全自动补题暂不做，只预留复用同一 production run 的接口。
```
