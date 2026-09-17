# 科目训练题库生产矩阵闭环执行方案

> 日期：2026-07-09  
> 范围：AI 题库后台、科目训练 AI 出题、专项/科目训练正式题库、补题队列、门禁、前端状态展示  
> 定位：这是“预测补题/全自动补题”之前必须先落地的基础机制。先把手动一次追加做成可收敛、可验证的生产计划，再让系统自动触发同一套计划。

## 1. 背景与问题

当前科目训练 AI 出题已经具备这些能力：

- 能按大纲知识点生成蓝图。
- 能根据真题画像推导 topic gap。
- 能调用 AI 生成候选题。
- 候选题通过门禁后可自动进入 `special_practice_questions` 正式题库。
- 后台能展示候选、已入库、异常候选、生成队列。

但当前“补齐合格题 / 追加合格题”的机制仍然偏向“提交一批生成任务”，而不是“完成一个明确的科目题库生产目标”。

已观察到的问题：

1. 一次追加不会等所有知识点完成才结束。
2. 一次追加不会保证每个知识点内部的 basic / medium / hard 难度配额都完成。
3. 生成调度偏向 `primaryGap`，当前排序中 medium 优先，导致合格题大多集中在 medium。
4. 前端“已提交 / 入队 / 成功”的语义容易被误解为“题库目标已完成”。
5. 候选题数量会增长，但不能说明正式题库已经达标。
6. 全自动补题如果建立在当前机制上，会放大上述问题。

因此需要先把科目训练补题升级为：

```text
一次手动追加 = 创建一个科目训练生产计划
生产计划 = subject/topic/difficulty/targetProfile 的目标矩阵
完成标准 = 所有矩阵格子的门禁通过并正式入库数量达到目标
```

## 2. 目标

### 2.1 产品目标

管理员在 AI 题库后台选择学科后，点击“一次补齐/追加科目训练题”，系统应自动完成：

1. 计算该学科所有可出题知识点的目标题量。
2. 按预设比例拆分不同难度目标。
3. 对每个知识点、每个难度生成足量候选。
4. 门禁通过后自动入正式科目训练题库。
5. 未达标的矩阵格子继续生成或修复。
6. 全部达标后计划状态变为 completed。
7. 如果连续多轮没有新增合格题，进入 blocked，并显示卡住的知识点、难度和原因。

### 2.2 工程目标

- 不再把“入队成功”当成“补题完成”。
- 不再只取 `gapSnapshot.gaps[0]` 作为唯一生成目标。
- 不再让 medium 固定优先。
- 不再让候选池膨胀成为成功指标。
- 科目训练和在线模考继续保持数据与流程隔离。
- 手动生产计划和未来自动预测补题复用同一套核心服务。

## 3. 非目标

本阶段不做：

- 定时全自动预测补题。
- 学生训练实时触发补题。
- 多 Provider / 多 Key 池调度。
- 新模型选择策略。
- 在线模考整卷生产改造。

这些能力都应在生产矩阵闭环稳定后再接入。

## 4. 核心概念

### 4.1 生产计划

生产计划是一次手动或自动触发的题库生产任务。

建议命名：

```text
subject_practice_production_runs
```

每个 run 代表一次“把某个学科补到目标库存”的任务。

关键字段：

```ts
type SubjectPracticeProductionRun = {
  id: number;
  subject: string;
  status: 'planned' | 'running' | 'blocked' | 'completed' | 'cancelled';
  triggerType: 'manual' | 'predictive' | 'scheduled' | 'recovery';
  syllabusVersion: string;
  styleProfileVersion: string | null;
  targetPolicyVersion: string;
  targetTotal: number;
  publishedTotal: number;
  openTotal: number;
  candidateTotal: number;
  failedTotal: number;
  blockedReasonCode: string | null;
  blockedMessage: string | null;
  noProgressRounds: number;
  maxNoProgressRounds: number;
  createdByUserId: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};
```

### 4.2 生产矩阵格子

生产矩阵的最小目标单元。

建议命名：

```text
subject_practice_production_cells
```

一个 cell 表示：

```text
某学科 + 某知识点 + 某难度 + 某题型/认知技能/阅读负载/计算负载 的目标库存
```

关键字段：

```ts
type SubjectPracticeProductionCell = {
  id: number;
  runId: number;
  subject: string;
  topicId: number;
  topicCode: string | null;
  topicTitle: string;
  difficultyBand: 'basic' | 'medium' | 'hard';
  questionForm: string;
  cognitiveSkill: string;
  readingLoad: string;
  calculationLoad: string;
  gapKey: string;
  targetCount: number;
  publishedCount: number;
  pendingCandidateCount: number;
  runningJobCount: number;
  failedCount: number;
  status: 'open' | 'running' | 'blocked' | 'fulfilled' | 'cancelled';
  priority: number;
  lastAttemptAt: string | null;
  lastPublishedAt: string | null;
  lastFailureCode: string | null;
  lastFailureMessage: string | null;
  createdAt: string;
  updatedAt: string;
};
```

### 4.3 正式入库计数

只有满足以下条件的题才能计入 `publishedCount`：

- `csca_questions.status = approved`
- `source_type = ai`
- `source_question_id IS NOT NULL`
- 对应 `special_practice_questions.status = published`
- `review_metadata.subjectPracticeAutoApproval.status = published_to_subject_practice`
- `targetUseCase = subject_practice`
- `targetQuestionBank = special_practice_questions`
- 非 smoke / fallback / online_mock_exam 题
- difficulty 与 cell 的 `difficultyBand` 匹配
- topic 与 cell 的 `topicId` 匹配

候选题、待审核题、复审失败题、建议重生题、超出难度配额题都不能计入完成。

## 5. 目标矩阵生成规则

### 5.1 知识点范围

一次学科生产计划默认覆盖：

- 当前学科已应用大纲中的 published topic。
- topic 必须有可用大纲范围。
- topic 必须有可用真题画像或 subject-level fallback profile。
- topic 必须不是 archived / excluded。

如果 topic 缺少大纲或画像，不进入生成，而是创建 blocked cell 或 run blocker。

### 5.2 每个知识点目标题量

第一阶段沿用现有默认值，但要持久化到 cell：

```ts
targetPracticeCount = max(expectedBlueprintCount * 3, 6)
```

后续可升级为按权重：

```text
targetPracticeCount =
  baseTopicTarget
  * syllabusWeight
  * pastPaperFrequencyWeight
  * studentDemandWeight
```

### 5.3 难度比例

难度目标必须显式入矩阵，不允许靠生成过程自然分布。

优先级：

1. topic-level 真题画像 `difficultyDistribution`
2. subject-level 真题画像 `difficultyDistribution`
3. 大纲 difficultyRange
4. 系统默认比例

建议默认比例：

```ts
basic: 0.35
medium: 0.45
hard: 0.20
```

如果某 topic 的 difficultyRange 不包含 hard，则按允许难度重新归一化。

示例：

```text
目标 6 题，允许 basic/medium/hard
basic 2
medium 3
hard 1

目标 6 题，只允许 basic/medium
basic 3
medium 3
```

### 5.4 题型和画像维度

每个难度 cell 需要带完整 targetProfile：

```ts
targetProfile = {
  topicId,
  gapKey,
  questionForm,
  cognitiveSkill,
  difficultyBand,
  readingLoad,
  calculationLoad,
  distractorTypes,
  commonMisconceptions,
  estimatedTimeSeconds,
  source: 'subject_practice_production_cell'
}
```

如果 `cognitiveSkill / readingLoad / calculationLoad` 是 unknown：

- 不应直接用 unknown 生成。
- 需要先尝试从真题画像、source profile normalizer、subject profile fallback 推断。
- 仍无法推断时，cell 标记为 blocked：`target_profile_incomplete`。

## 6. 调度策略

### 6.1 当前问题

现有机制类似：

```ts
primaryGap = gapSnapshot.gaps[0]
enqueueGenerationJobs(targetProfile: primaryGap)
```

而 gap 排序中 medium 优先，导致大量合格题集中在 medium。

### 6.2 新策略：矩阵轮询

生产计划必须按 cell 轮询，不再按单个 primary gap。

每一轮调度：

1. 查询 run 下所有 `status in ('open', 'running')` 的 cell。
2. 重新计算每个 cell 的 `publishedCount`。
3. 过滤已达标 cell。
4. 对未达标 cell 计算优先级。
5. 为多个 cell 入队生成任务。

优先级建议：

```ts
priority =
  shortageRatio * 100
  + topicWeight * 20
  + difficultyBalanceBoost
  + staleBoost
  - pendingPenalty
```

其中：

- `shortageRatio = (targetCount - publishedCount) / targetCount`
- `difficultyBalanceBoost` 用于避免 medium 持续优先。
- `pendingPenalty` 避免同一 cell 已经有大量候选或 running job 时继续膨胀。

### 6.3 难度公平性

每轮必须做到：

- 如果 basic / medium / hard 都有缺口，同一轮至少覆盖多个难度。
- 不允许连续 N 轮只生成同一个难度，除非其他难度已达标或 blocked。
- 每个难度有独立 open count 和 fulfilled count。

建议第一阶段实现简单规则：

```ts
for difficulty of ['basic', 'medium', 'hard']:
  pick top K cells where difficultyBand = difficulty and openCount > 0
```

这样比当前全局排序更稳。

### 6.4 单轮入队限制

避免一次性生成过多：

```ts
maxJobsPerRound = 12
maxJobsPerDifficultyPerRound = 4
maxJobsPerTopicPerRound = 2
maxPendingCandidatesPerCell = 3
```

如果某 cell 已有 3 道未治理候选，不再继续生成该 cell，先走修复/治理。

## 7. 生成、门禁与入库

### 7.1 生成任务 metadata

每个生成任务必须写入：

```json
{
  "targetUseCase": "subject_practice",
  "generationMode": "subject_practice_production_matrix",
  "productionRunId": 123,
  "productionCellId": 456,
  "gapKey": "topic_1:medium:calculation_application:standard_application:low:medium",
  "targetProfile": {
    "topicId": 1,
    "difficultyBand": "medium",
    "questionForm": "calculation_application",
    "cognitiveSkill": "standard_application",
    "readingLoad": "low",
    "calculationLoad": "medium"
  }
}
```

### 7.2 门禁通过条件

自动进入正式科目训练题库必须全部满足：

- 审题门禁通过。
- 题目结构完整。
- 答案唯一且解析正确。
- 双语版本完整。
- 数学渲染可用。
- topic 匹配 cell。
- difficulty 匹配 cell。
- targetProfile 维度匹配。
- 非 fallback / smoke。
- 没有 mock exam scope。

### 7.3 生成错难度处理

如果候选题通过通用门禁，但难度不匹配当前 cell：

1. 不计入该 cell。
2. 如果另一个 cell 需要这个难度，允许转入那个 cell。
3. 如果没有任何 cell 需要，标记为 `surplus_difficulty_candidate`。
4. surplus 不自动入库，除非生产计划允许安全库存。

### 7.4 软失败修复

以下问题优先修复原题：

- 选项太接近。
- 选项格式不一致。
- 解析不够清晰。
- 正确答案标记错误但题干可用。
- 多个正确答案但可通过改选项修复。
- 中英文版本缺失或翻译不完整。
- 数学 latex 包裹格式错误。

### 7.5 硬失败替代

以下问题直接废弃候选并重新生成：

- topic 不匹配。
- 难度严重不匹配且不能转入其他 cell。
- 题干不可用。
- 与真题或已有题高度相似。
- 超出大纲范围。
- 题目泄露答案。
- provider 返回结构不可恢复。

## 8. 状态机

### 8.1 Run 状态

```text
planned
  -> running
  -> completed
  -> blocked
  -> cancelled
```

含义：

| 状态 | 含义 |
| --- | --- |
| planned | 已创建目标矩阵，尚未开始 |
| running | 正在生成、修复、入库或等待队列 |
| completed | 所有 cell 都达到 targetCount |
| blocked | 连续多轮无新增入库，或关键配置缺失 |
| cancelled | 管理员取消 |

### 8.2 Cell 状态

```text
open
  -> running
  -> fulfilled
  -> blocked
  -> cancelled
```

### 8.3 完成判定

Run completed 必须满足：

```ts
all cells:
  publishedCount >= targetCount
```

不能用以下指标判断 completed：

- generation jobs completed。
- candidates created。
- candidates gate passed 但未入库。
- pending review 数量。
- 已提交任务数量。

### 8.4 Blocked 判定

进入 blocked 的条件：

- 连续 3 轮 `publishedTotal` 没有增长。
- Provider 连续失败超过阈值。
- 某 cell 缺少完整 targetProfile。
- 某 topic 没有 active blueprint 且无法自动生成。
- 候选池达到上限但没有可自动修复项。
- 生成任务全部失败且失败原因不可恢复。

Blocked 文案必须指出：

```text
卡在哪个知识点
哪个难度
缺多少题
最近失败原因
建议处理动作
```

## 9. API 设计

### 9.1 创建/继续生产计划

```http
POST /api/v1/admin/ai-questioning/subject-practice-production-runs
```

请求：

```json
{
  "subject": "math",
  "mode": "fill_to_target",
  "triggerType": "manual",
  "policyVersion": "subject-practice-production-v1",
  "forceRebuildMatrix": false
}
```

响应：

```json
{
  "runId": 123,
  "status": "running",
  "subject": "math",
  "targetTotal": 180,
  "publishedTotal": 126,
  "openTotal": 54,
  "cells": {
    "total": 39,
    "open": 12,
    "fulfilled": 27,
    "blocked": 0
  }
}
```

### 9.2 获取生产计划详情

```http
GET /api/v1/admin/ai-questioning/subject-practice-production-runs/:id
```

返回：

```json
{
  "id": 123,
  "status": "running",
  "subject": "math",
  "progress": {
    "targetTotal": 180,
    "publishedTotal": 126,
    "openTotal": 54,
    "percent": 70
  },
  "difficultyProgress": [
    { "difficultyBand": "basic", "target": 60, "published": 52, "open": 8 },
    { "difficultyBand": "medium", "target": 84, "published": 60, "open": 24 },
    { "difficultyBand": "hard", "target": 36, "published": 14, "open": 22 }
  ],
  "topicProgress": [],
  "recentEvents": []
}
```

### 9.3 处理一轮生产计划

```http
POST /api/v1/admin/ai-questioning/subject-practice-production-runs/:id/process
```

请求：

```json
{
  "maxJobs": 12,
  "processNow": true
}
```

### 9.4 取消生产计划

```http
POST /api/v1/admin/ai-questioning/subject-practice-production-runs/:id/cancel
```

### 9.5 清理旧生产结果

```http
POST /api/v1/admin/ai-questioning/subject-practice-production-runs/cleanup
```

请求：

```json
{
  "subject": "math",
  "scope": "current_policy_ai_only",
  "dryRun": true
}
```

第一阶段清理范围：

- 本机制之前生成的 subject practice AI 候选。
- 不符合当前 targetProfile/schema 的 AI 候选。
- 非门禁通过的候选。
- 可选：已入库但缺少必要 metadata 的旧 AI 题。

不得清理：

- 手工题。
- 在线模考题。
- 其他学科题。
- 当前有效生产 run 关联的题。

## 10. 前端改造

### 10.1 科目训练主卡

当前“补齐合格训练题”区域升级为“科目训练生产计划”。

展示：

```text
科目训练生产计划
目标题量 180
已入库 126
待补 54
完成度 70%
basic 52/60
medium 60/84
hard 14/36
状态 running
```

按钮：

- 启动/继续补齐到目标
- 暂停/取消
- 刷新状态
- 查看 blocked cell
- 清理旧 AI 结果

### 10.2 知识点卡片

每个知识点展示：

```text
目标合格题 6
已入库 4
还差 2
basic 2/2
medium 1/3 缺2
hard 1/1
```

按钮：

- 补齐本知识点到目标
- 清理本知识点 AI 结果
- 查看候选治理

### 10.3 候选治理列表

候选治理只展示未入库异常候选。

说明文案：

```text
这里不是成功题库。这里展示无法自动入库的异常候选，用于查看失败原因、修复、拒绝或归档。
门禁通过并完成入库的题会出现在“已入库 AI 题”中。
```

### 10.4 已入库列表

已入库列表要放在候选治理上方。

显示：

- 题目。
- topic。
- difficulty。
- productionRunId。
- productionCellId。
- targetProfile。
- 生成时间。
- 入库时间。
- 双语状态。
- 数学渲染状态。

## 11. 数据迁移

### 11.1 新表

建议新增：

```prisma
model SubjectPracticeProductionRun {
  id                  Int      @id @default(autoincrement())
  subject             String
  status              String
  triggerType         String
  syllabusVersion     String
  styleProfileVersion String?
  targetPolicyVersion String
  targetTotal         Int      @default(0)
  publishedTotal      Int      @default(0)
  openTotal           Int      @default(0)
  candidateTotal      Int      @default(0)
  failedTotal         Int      @default(0)
  blockedReasonCode   String?
  blockedMessage      String?
  noProgressRounds    Int      @default(0)
  maxNoProgressRounds Int      @default(3)
  createdByUserId     Int?
  startedAt           DateTime?
  completedAt         DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([subject, status, createdAt])
  @@map("subject_practice_production_runs")
}

model SubjectPracticeProductionCell {
  id                    Int      @id @default(autoincrement())
  runId                 Int
  subject               String
  topicId               Int
  topicCode             String?
  topicTitle            String
  difficultyBand        String
  questionForm          String
  cognitiveSkill        String
  readingLoad           String
  calculationLoad       String
  gapKey                String
  targetCount           Int
  publishedCount        Int      @default(0)
  pendingCandidateCount Int      @default(0)
  runningJobCount       Int      @default(0)
  failedCount           Int      @default(0)
  status                String
  priority              Float    @default(0)
  lastAttemptAt         DateTime?
  lastPublishedAt       DateTime?
  lastFailureCode       String?
  lastFailureMessage    String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([runId, status, priority])
  @@index([subject, topicId, difficultyBand])
  @@unique([runId, gapKey])
  @@map("subject_practice_production_cells")
}
```

### 11.2 旧数据兼容

开发阶段不需要长期兼容旧机制，但为了线上不崩：

1. 生产 run 的候选、生成任务和异常治理必须按 `productionRunId / productionCellId` 隔离。
2. 生产 run 的完成数统计的是当前正式科目训练库存：必须是 `published_to_subject_practice`、已发布到 `special_practice_questions`、非 mock/fallback/smoke，并匹配 topic 与 difficulty。
3. 符合当前正式库存口径的旧 AI 题可以计入库存；不符合当前口径的开发期旧题应由清理工具下架或归档。
4. 旧 AI 题可展示为 legacy。
5. 管理员提供清理按钮，清理旧候选或旧 AI 入库题。
6. 用户侧正式题库查询不能因为旧题 metadata 缺失报错。

## 12. 后端服务拆分

建议新增：

```text
SubjectPracticeProductionPlannerService
SubjectPracticeProductionRunnerService
SubjectPracticeProductionInventoryService
SubjectPracticeProductionCleanupService
```

### 12.1 Planner

职责：

- 读取大纲 topic。
- 读取真题画像。
- 生成生产矩阵。
- 计算目标题量和难度配额。
- 创建 run 和 cells。

### 12.2 Inventory

职责：

- 统计正式入库题。
- 按 cell 统计 publishedCount。
- 排除 mock exam / smoke / fallback。
- 刷新 run progress。

### 12.3 Runner

职责：

- 按 cell 调度生成。
- 控制并发和候选池上限。
- 处理修复优先。
- 处理硬伤替代。
- 处理 no-progress blocked。

### 12.4 Cleanup

职责：

- 清理旧机制 AI 结果。
- 清理单学科、单知识点、单 run。
- 支持 dry-run。
- 保证不影响手工题和在线模考题。

## 13. 与现有代码的关系

### 13.1 可复用

可以复用：

- `topicQuestionBankHealth`
- `deriveTopicQuestionGap` 的部分逻辑
- `enqueueGenerationJobs`
- `processGenerationJobs`
- `processSubjectPracticeRepairBacklog`
- `publishCandidateToSubjectPractice`
- 现有 question reviewer / validator
- 现有数学渲染组件

### 13.2 必须调整

需要调整：

1. `deriveTopicQuestionGap` 不能只返回运行时临时 gap，应服务于持久化 cell。
2. `runTopicAction(generate_candidates)` 不能只取 `primaryGap`。
3. `difficultyGenerationPriority` 不应固定 medium 优先。
4. `bulkTopicAction` 不应代表完整生产计划。
5. `kickGenerationQueueProcessor` 的自动补齐循环要迁移到 run runner。

### 13.3 保留局部能力

保留现有按单知识点补题能力，但它应该创建一个 scope 较小的 production run：

```json
{
  "subject": "math",
  "topicIds": [123],
  "mode": "topic_only"
}
```

## 14. 验收标准

### 14.1 后端验收

1. 创建数学科目生产计划后，生成 cells。
2. cells 覆盖所有可出题 topic。
3. 每个 topic 至少包含允许难度的目标 cell。
4. run progress 只统计正式入库题。
5. 生成任务带 `productionRunId` 和 `productionCellId`。
6. 同一轮能同时入队 basic / medium / hard 缺口。
7. medium 不再长期独占合格题产出。
8. 已达标 cell 不再继续生成。
9. 连续无新增入库后 run 进入 blocked。
10. blocked 显示 topic、difficulty、gap、failure reason。

### 14.2 前端验收

1. 科目训练生产计划展示在候选治理上方。
2. 已入库 AI 题展示在候选治理上方。
3. 候选治理明确说明“这里是异常候选，不是成功题库”。
4. 进度显示总量和 difficulty progress。
5. 点击刷新不跳回流程总览。
6. 切换学科后不展示上一学科数据。
7. 清理功能支持单题、单知识点、单学科、单 run。

### 14.3 数据验收 SQL

示例：

```sql
SELECT difficulty_band, SUM(target_count), SUM(published_count)
FROM subject_practice_production_cells
WHERE run_id = :runId
GROUP BY difficulty_band;
```

必须看到 basic / medium / hard 都按目标推进。

```sql
SELECT status, COUNT(*)
FROM subject_practice_production_cells
WHERE run_id = :runId
GROUP BY status;
```

run completed 时所有 cell 应为 fulfilled。

## 15. 实施顺序

### Phase 1：矩阵和只读进度

目标：先算清楚目标，不生成。

任务：

1. 新增 run/cell 表。
2. 实现 planner。
3. 实现 inventory refresh。
4. 前端展示生产矩阵和难度进度。

完成标准：

- 能创建 run。
- 能看到每个知识点和难度的目标。
- 能看到当前已入库计数。

### Phase 2：手动生产计划执行

目标：点击一次，按矩阵生成到完成或 blocked。

任务：

1. Runner 按 cell 入队。
2. 生成任务带 run/cell metadata。
3. 门禁通过后自动入库并刷新 cell。
4. 已达标 cell 停止生成。
5. no-progress blocked。

完成标准：

- 不同难度都会被生成。
- 一次计划能持续补到所有 cell 达标。
- 成功标准只看正式入库。

### Phase 3：候选治理和清理

目标：让异常候选可控，不膨胀。

任务：

1. 候选池上限。
2. 软失败原题修复。
3. 硬失败替代。
4. 清理旧题。
5. 前端候选治理重排。

完成标准：

- 异常候选不会无限增长。
- 清理后可重新生成测试。

### Phase 4：接入预测补题

目标：全自动只负责触发生产计划。

任务：

1. 低库存预警创建 run。
2. 定时巡检创建 run。
3. 热点知识点优先级调整。
4. 成本和并发限制。

完成标准：

- 自动触发和手动触发复用同一套 run/cell/runner。

## 16. 风险与处理

| 风险 | 处理 |
| --- | --- |
| provider 不稳定 | run blocked，不无限重试 |
| 某难度持续失败 | cell blocked，显示原因 |
| 候选池膨胀 | 每 cell pending 上限 |
| 旧题污染统计 | current policy metadata + cleanup |
| medium 继续偏置 | 按 difficulty 分桶轮询 |
| 学生侧抽不到题 | 验收必须覆盖 special practice 查询 |
| 数学渲染异常 | 门禁和前端统一渲染检查 |

## 17. 与全自动补题的关系

全自动补题不应重新实现生成逻辑。

正确关系：

```text
预测补题 / 定时巡检 / 学生消耗预警
  -> 创建 subject_practice_production_run
  -> 复用 production matrix runner
  -> 门禁通过自动入库
  -> completed / blocked
```

因此本方案是全自动补题的前置条件。

在本方案完成之前，不建议上线全自动预测补题。

## 18. 当前代码重点改造点

已确认当前代码中需要重点调整的行为：

1. `difficultyGenerationPriority` 当前 medium 优先，会导致调度偏置。
2. `runTopicAction(generate_candidates)` 当前主要使用 `gapSnapshot.gaps[0]`。
3. `bulkTopicAction` 当前只是按前端传入 topicIds 逐个入队，不是生产计划。
4. `kickGenerationQueueProcessor` 当前自动补齐最多 8 轮，不是持久化 run。
5. 前端 `补齐合格题 / 追加合格题` 当前语义是“提交任务”，不是“完成目标”。

这些行为应被生产矩阵机制替代或降级为局部工具。

## 19. 最终完成定义

本机制完成后，应满足：

1. 管理员点击一次“补齐科目训练题到目标”。
2. 系统创建一个生产计划。
3. 前端显示总目标、已入库、待补、basic/medium/hard 进度。
4. 系统按矩阵持续生成，不同难度都有产出机会。
5. 题目只有门禁通过并正式入库才计入完成。
6. 所有 cell 达标后 run completed。
7. 若无法完成，run blocked，并指出明确阻断原因。
8. 该机制可被未来预测补题、定时补题、低库存补题复用。

## 20. 第一版落地切片

第一版不追求一次性完成所有自动化，而是先把“手动一次追加”改造成可追踪、可收敛的生产计划。

### 20.1 数据库

新增迁移：

```text
backend/prisma/migrations/0062_subject_practice_production_matrix/migration.sql
```

新增表：

```text
csca_subject_practice_production_runs
csca_subject_practice_production_cells
```

第一版字段重点：

- run 保存 subject、status、targetTotal、publishedTotal、openTotal、candidateTotal、failedTotal、plan/result。
- cell 保存 runId、topicId、difficultyBand、targetCount、publishedCount、candidateCount、runningJobCount、failedCount、targetProfile、status、failureCode。
- 生成任务通过 `prompt_metadata.productionRunId` 和 `prompt_metadata.productionCellId` 回链到 cell。
- 生产计划入队时 `prompt_metadata.source` 必须是 `subject_practice_production_matrix`，`generationMode` 必须是 `subject_practice_production_matrix` 或 `subject_practice_production_matrix_regenerate`；不能复用旧的 `admin_question_expansion / expand_candidates` 语义。
- 生成题通过 `generation_metadata.productionRunId` 和 `generation_metadata.productionCellId` 保留来源追踪。

### 20.2 后端 API

新增后台 API：

```text
GET  /api/v1/admin/ai-questioning/subject-practice-production-runs?subject=math
GET  /api/v1/admin/ai-questioning/subject-practice-production-runs/:id
POST /api/v1/admin/ai-questioning/subject-practice-production-runs
POST /api/v1/admin/ai-questioning/subject-practice-production-runs/:id/process
POST /api/v1/admin/ai-questioning/subject-practice-production-runs/:id/cancel
```

第一版行为：

- 创建 run 时读取 `topicQuestionBankHealth` 的 `difficultyPlan`。
- 每个 topic/difficulty 生成一个 cell。
- 处理 run 时按 basic / medium / hard 分桶取 cell，避免 medium 独占。
- 每轮处理后刷新正式入库计数。
- `completed` 只由正式入库数量决定，不由候选数量决定。
- `untilComplete=true` 时连续处理多轮，直到 completed、blocked 或达到 `maxRounds`。
- 每轮调度先按 `productionCellId` 治理已有候选：可发布的先入库，可修复的先修复，硬失败才替代生成；只有候选 backlog 处理后仍有缺口，才继续生成新候选。
- 生产矩阵的难度配额由 `subject-practice-matrix-v1` policy 控制，默认权重为 `basic:1 / medium:4 / hard:4`；真题画像继续提供题型、认知技能、阅读负载和计算负载，但不再单独决定是否创建某个难度 cell。
- 连续多轮没有新增正式入库题时，run 进入 `blocked/no_progress`，避免无限堆候选。
- 生产 runner 显式排除 `mock_exam_blueprint_slot` 和 online mock scope，只使用科目训练蓝图。
- 每个 cell 有 `candidateLimit`，当前执行口径为 `min(120, max(12, neededCount * 6, targetCount * 2))`；未入库异常候选达到上限时，cell 进入 `blocked/candidate_limit_reached`。
- 服务启动和定时巡检会恢复已有 `running` run；巡检只推进少量任务，不创建新 run。

### 20.3 与在线模考生产的借鉴边界

在线模考生产能借鉴的是“闭环思想”，不是数据模型本身。

可复用的机制：

- 先有明确目标，再调度生成。
- 生成题必须带回链 metadata，能追到 run、slot/cell 和 target profile。
- 门禁通过才算完成，候选题、失败题、人工确认题不计完成。
- 任务可以自动恢复、自动重试，并在无进展时阻塞。
- 已完成目标不能继续生成残留题。

不能照搬的机制：

- 在线模考是固定整卷题位：`paper -> 48 slots -> 48 publishable candidates -> draft paper`。
- 科目训练是库存矩阵：`subject -> topic -> difficulty/profile cell -> target stock`。
- 在线模考完成的是“一套卷”；科目训练完成的是“每个知识点/难度库存达标”。
- 在线模考候选进入模考候选池；科目训练候选通过后进入 `special_practice_questions`，并供专项题库和自适应训练抽取。
- 在线模考题位不应参与科目训练库存统计；科目训练 production cell 也不应被旧 `subjectTopicGapSnapshot` 提前归档。

因此科目训练生产 job 必须优先按 `productionCellId` 判断是否继续，而不是按旧的 topic gap 快照判断是否还有缺口。旧的 topic gap 只能作为创建 production run 时的输入之一，不能作为 run 执行阶段的完成标准。

### 20.4 前端入口

新增后台面板：

```text
SubjectPracticeProductionPanel
```

展示内容：

- 当前 run 状态。
- 目标合格题数量。
- 已正式入库数量。
- 剩余缺口。
- 候选/失败数量。
- basic / medium / hard 各自目标、已入库、缺口、阻塞 cell。
- “处理一轮”和“继续直到完成”两个动作。
- 阻塞 cell 会显示候选积压与上限，便于先修复、拒绝或清理异常候选。

入口位置：

```text
AI 题库后台 -> 科目训练线 -> 优先处理队列上方
```

这样管理员先看到“生产计划是否完成”，再处理候选与异常题。

## 21. 验收步骤

### 21.1 数据库迁移

本地：

```bash
npm run db:migrate
```

线上：

```bash
cd /www/wwwroot/cscalite
git fetch origin
git checkout codex/deepseek-ai-gateway
git pull --ff-only origin codex/deepseek-ai-gateway
npm run db:migrate
npm --prefix backend run build
npm --prefix frontend run build
```

### 21.2 后台功能验收

1. 进入 `AI 题库后台 -> 科目训练线`。
2. 选择学科。
3. 点击“创建生产计划”。
4. 确认出现 run 编号、总目标、已入库、缺口和三个难度进度。
5. 点击“处理一轮”。
6. 观察候选、正式入库和缺口变化。
7. 如果某难度已达标，后续处理不应继续为该 cell 生成。
8. 如果所有 cell 达标，run 必须进入 `completed`。
9. 如果连续多轮没有新增正式入库题，run 必须进入 `blocked/no_progress`，而不是继续无限生成候选。
10. 如果某个 cell 的异常候选达到上限，cell 必须进入 `blocked/candidate_limit_reached`，而不是继续生成。

### 21.3 数据验收 SQL

检查 run：

```sql
SELECT id, subject, status, target_total, published_total, open_total, candidate_total, failed_total
FROM csca_subject_practice_production_runs
ORDER BY id DESC
LIMIT 5;
```

检查难度分布：

```sql
SELECT difficulty_band, SUM(target_count) AS target, SUM(published_count) AS published, SUM(target_count - published_count) AS open
FROM csca_subject_practice_production_cells
WHERE run_id = :run_id
GROUP BY difficulty_band
ORDER BY difficulty_band;
```

检查生成任务回链：

```sql
SELECT id, status, prompt_metadata->>'productionRunId' AS run_id, prompt_metadata->>'productionCellId' AS cell_id
FROM csca_ai_generation_jobs
WHERE prompt_metadata->>'productionRunId' = :run_id::text
ORDER BY id DESC
LIMIT 20;
```

### 21.4 必须通过的判断

- 创建 run 后，每个有目标的难度都能看到 cell。
- `publishedTotal` 不会因为候选题增加而增加。
- `openTotal = targetTotal - cappedPublishedTotal`。
- basic / medium / hard 都有调度机会。
- 切换学科不会显示另一个学科的 run。
- 正式入库题仍进入科目训练题库，学生端可以抽到。
- 科目训练生产任务不会复用在线模考蓝图。
- hard regenerate 生成的新任务必须保留原 `productionRunId / productionCellId`。
- 重启后已有 running run 会被巡检器继续推进，直到 completed、blocked 或等待下一轮。

## 22. 后续增强清单

第一版之后继续做：

1. 软失败修复治理台：把可修复失败分类、修复次数和最新修复结果集中展示。
2. 硬失败替代治理台：画像不符、难度不符、真题过近、题干不可用则丢弃并替代生成。
3. 巡检器运维面板：展示最近一次巡检、处理 run 数、失败原因和下一次 tick。
4. 预测补题：低库存预警只负责创建 run，不重新实现生成逻辑。
