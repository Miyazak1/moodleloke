# 自适应训练预测补题 Phase 0-1 工单

日期：2026-07-09

状态：历史工单 / 仅供参考

本文件是旧版预测补题方案下的 Phase 0-1 工单，不再单独代表当前科目训练全自动预测补题的执行路径。

新的执行基准为：

- `docs/adaptive-training-cycle-aware-predictive-replenishment-architecture-2026-07-10.md`

使用说明：

- 本文件中的“库存口径、正式题统计、风险面板、补题计划”仍可作为实现素材。
- 但所有工单必须重新套用 2026-07-10 方案中的 cohort / rolling cohort 周期、单用户可用题与全局库存分层、周期结束停止补题、`maxStockCap` 防无限增长等规则。
- 本文件提到的“手动创建补题计划”只能作为后台兜底能力，不能替代全自动预测触发机制。

配套文档：

- `docs/adaptive-training-predictive-replenishment-executable-plan-2026-07-09.md`
- `docs/subject-practice-ai-questioning-final-execution-plan-2026-07-08.md`
- `docs/subject-training-ai-generation-closed-loop-plan-2026-07-07.md`
- `docs/deepseek-first-ai-gateway-executable-plan-2026-07-09.md`

## 1. 本文目的

本文只补齐第一轮可编码工单，不再重复宏观方案。

Phase 0-1 的目标是：

```text
先把科目训练正式库存算准、展示清楚，并允许管理员按风险手动创建补题计划。
```

不在 Phase 0-1 做：

- 自动定时预测补题。
- 学生抽题实时兜底改造。
- Redis / BullMQ。
- 多 Provider 路由。
- 自动无限循环补题。
- 完整成本预算系统。

## 2. 当前代码落点

后端主要落点：

```text
backend/src/ai-questioning/ai-questioning.service.ts
backend/src/ai-questioning/ai-questioning.controller.ts
backend/src/ai-questioning/ai-questioning.module.ts
backend/prisma/schema.prisma
backend/prisma/migrations/*
```

前端主要落点：

```text
frontend/src/lib/api-admin.ts
frontend/src/pages/AdminAIQuestionBankPage.tsx
frontend/src/components/admin/ai-question-bank/CoverageWorkPanel.tsx
frontend/src/components/admin/ai-question-bank/coverageWorkPanelProps.ts
frontend/src/components/admin/ai-question-bank/questionBankDefaults.ts
frontend/src/components/admin/ai-question-bank/types.ts
```

现有能力必须复用：

- `blueprintCoverageSummary`
- `topicQuestionBankHealth`
- `generationQueueHealth`
- `enqueueGenerationJobs`
- `bulkGenerationJobAction`
- `special_practice_questions` 正式题映射
- `csca_ai_generation_jobs` 后台生成队列
- AI Gateway 的 `question_generation` / `question_review` taskType

## 3. Phase 0 完成定义：库存口径和快照

Phase 0 完成后，后台应能回答：

```text
某 subject/topic/difficulty/questionType 当前有多少正式可训练题？
这些题是否低于安全库存？
候选题、失败题、模考题是否被排除在库存之外？
```

### 3.1 库存 key

第一版库存 key 固定为：

```text
subject + topicId + difficultyBand + questionType
```

字段来源：

- `subject`：`special_practice_questions.subject` 或其映射的 `csca_questions.subject`。
- `topicId`：正式题映射到的 topic。
- `difficultyBand`：优先取 `csca_questions.designed_difficulty`，必须归一化为 `basic | medium | hard | challenge`。
- `questionType`：优先取 `csca_questions.question_type`，默认 `single_choice`。

Phase 0 不把 `cognitiveSkill`、`language` 放进主 key，但响应里可以带只读诊断字段。

### 3.2 可用库存口径

`effectiveStock` 只统计正式题：

```sql
special_practice_questions.status IN ('active', 'published')
AND special_practice_questions.source_question_id IS NOT NULL
AND csca_questions.status IN ('published', 'approved', 'pending_review', 'draft')
AND csca_questions.source_question_id IS NULL
AND csca_questions.review_metadata->'subjectPracticeAutoApproval'->>'targetUseCase' = 'subject_practice'
AND csca_questions.review_metadata->'subjectPracticeAutoApproval'->>'targetQuestionBank' = 'special_practice_questions'
```

说明：

- 已通过门禁并自动入库的 AI 题计入库存。
- 手工正式题可以作为 `formalStock` 计入，但 Phase 0 必须在响应中区分 `aiFormalStock` 和 `manualFormalStock`。
- `csca_questions` 候选题本身不算库存。
- `online_mock_exam` 候选和 mock slot 题不算库存。
- `review_failed`、`needs_edit`、`human_review`、`rejected`、`archived` 不算库存。

### 3.3 安全库存默认值

Phase 0 使用静态安全线，不接预测模型：

| difficultyBand | safetyStock | targetStock |
| --- | ---: | ---: |
| basic | 30 | 45 |
| medium | 30 | 45 |
| hard | 15 | 24 |
| challenge | 8 | 12 |

库存状态：

```text
healthy: effectiveStock >= safetyStock
warning: effectiveStock < safetyStock 且 effectiveStock >= safetyStock * 0.7
shortage: effectiveStock < safetyStock * 0.7 且 effectiveStock > 0
critical: effectiveStock = 0
blocked: topic/blueprint/profile 配置阻断补题
```

### 3.4 新增数据表

建议新增 Prisma model：

```prisma
model AdaptiveQuestionInventorySnapshot {
  id                   Int      @id @default(autoincrement())
  subject              String   @db.VarChar(40)
  topicId              Int      @map("topic_id")
  topicCode            String?  @map("topic_code") @db.VarChar(80)
  topicTitle           String?  @map("topic_title") @db.VarChar(240)
  difficultyBand       String   @map("difficulty_band") @db.VarChar(40)
  questionType         String   @map("question_type") @db.VarChar(80)
  effectiveStock       Int      @map("effective_stock")
  formalStock          Int      @map("formal_stock")
  aiFormalStock        Int      @map("ai_formal_stock")
  manualFormalStock    Int      @map("manual_formal_stock")
  candidateCount       Int      @map("candidate_count")
  failedCandidateCount Int      @map("failed_candidate_count")
  queuedJobCount       Int      @map("queued_job_count")
  runningJobCount      Int      @map("running_job_count")
  safetyStock          Int      @map("safety_stock")
  targetStock          Int      @map("target_stock")
  gap                  Int
  status               String   @db.VarChar(40)
  blockerCode          String?  @map("blocker_code") @db.VarChar(80)
  blockerMessage       String?  @map("blocker_message") @db.Text
  metadata             Json?
  createdAt            DateTime @default(now()) @map("created_at")

  @@index([subject, topicId, difficultyBand, questionType, createdAt], map: "idx_adaptive_inventory_key_created")
  @@index([subject, status, createdAt], map: "idx_adaptive_inventory_status_created")
  @@map("adaptive_question_inventory_snapshots")
}
```

Phase 0 每次刷新都写一组 snapshot，不更新旧记录。查询默认读取每个库存 key 的最新 snapshot。

## 4. Phase 1 完成定义：预警和手动补题计划

Phase 1 完成后，管理员应能：

```text
看到哪些库存 key 缺题；
选择一个或多个 key 创建补题计划；
把补题计划转成现有 AI 生成队列任务；
任务仍走 Gateway、现有门禁和自动入库链路。
```

### 4.1 新增补题计划表

建议新增 Prisma model：

```prisma
model AdaptiveQuestionReplenishmentPlan {
  id                   Int      @id @default(autoincrement())
  subject              String   @db.VarChar(40)
  topicId              Int      @map("topic_id")
  topicCode            String?  @map("topic_code") @db.VarChar(80)
  difficultyBand       String   @map("difficulty_band") @db.VarChar(40)
  questionType         String   @map("question_type") @db.VarChar(80)
  effectiveStockBefore Int      @map("effective_stock_before")
  safetyStock          Int      @map("safety_stock")
  targetStock          Int      @map("target_stock")
  gap                  Int
  requestedCount       Int      @map("requested_count")
  enqueuedCount        Int      @default(0) @map("enqueued_count")
  priority             Int
  reason               String   @db.VarChar(80)
  status               String   @db.VarChar(40)
  createdById          Int?     @map("created_by_id")
  metadata             Json?
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  @@index([subject, status, priority, createdAt], map: "idx_adaptive_replenishment_status_priority")
  @@index([topicId, difficultyBand, questionType, status], map: "idx_adaptive_replenishment_key_status")
  @@map("adaptive_question_replenishment_plans")
}
```

状态：

```text
planned
queued
partially_queued
blocked
cancelled
completed
```

Phase 1 不要求自动把 plan 标为 completed。可以在库存刷新时，如果 `effectiveStock >= targetStock`，把同 key 的 open plan 标为 `completed`。

### 4.2 补题计划生成规则

输入：

```ts
{
  subject?: string;
  topicId?: number;
  difficultyBand?: string;
  questionType?: string;
  statuses?: Array<'warning' | 'shortage' | 'critical'>;
  maxPlans?: number;
  maxQuestionsPerPlan?: number;
  dryRun?: boolean;
}
```

规则：

1. 读取最新库存 snapshot。
2. 只对 `warning | shortage | critical` 创建计划。
3. `requestedCount = min(gap, maxQuestionsPerPlan)`。
4. 同一 key 已存在 `planned | queued | partially_queued` 计划时，不重复创建，除非 `force=true`。
5. 缺 active blueprint 时 `blocked`，不直接创建 generation job。
6. 缺 active topic/profile 的 blocker 必须写入 `blockerCode` 和 `metadata.blockers`。

### 4.3 转入现有生成队列

Phase 1 不新建 AI 队列表，复用：

```text
csca_ai_generation_jobs
```

计划 enqueue 时调用现有 `enqueueGenerationJobs`，并要求 job metadata 带：

```json
{
  "targetUseCase": "subject_practice",
  "generationMode": "adaptive_inventory_replenishment",
  "replenishmentPlanId": 123,
  "inventoryKey": {
    "subject": "math",
    "topicId": 1,
    "difficultyBand": "medium",
    "questionType": "single_choice"
  },
  "targetStock": 45,
  "effectiveStockBefore": 12
}
```

如果现有 `enqueueGenerationJobs` 暂时不能直接写这些 metadata，则 Phase 1 工单必须先扩展它的输入和 job prompt metadata，而不是另建旁路。

### 4.4 Gateway 约束

所有补题生成仍必须走：

```text
QuestionGeneratorProviderService -> AiGatewayService.complete()
taskType = question_generation
sourceModule = question_generator
```

不能在 replenishment service 中直接调用 DeepSeek 或 fetch `/chat/completions`。

## 5. API 工单

### AR-01 库存快照查询

新增：

```text
GET /api/v1/admin/ai-questioning/adaptive-inventory
```

Query：

```ts
{
  subject?: string;
  topicId?: number;
  status?: 'healthy' | 'warning' | 'shortage' | 'critical' | 'blocked';
  difficultyBand?: string;
  questionType?: string;
  limit?: number;
}
```

Response：

```ts
{
  summary: {
    totalKeys: number;
    healthy: number;
    warning: number;
    shortage: number;
    critical: number;
    blocked: number;
    totalEffectiveStock: number;
    totalGap: number;
  };
  items: Array<{
    subject: string;
    topicId: number;
    topicCode: string | null;
    topicTitle: string | null;
    difficultyBand: string;
    questionType: string;
    effectiveStock: number;
    formalStock: number;
    aiFormalStock: number;
    manualFormalStock: number;
    candidateCount: number;
    failedCandidateCount: number;
    queuedJobCount: number;
    runningJobCount: number;
    safetyStock: number;
    targetStock: number;
    gap: number;
    status: string;
    blockerCode?: string | null;
    blockerMessage?: string | null;
    createdAt: string;
  }>;
}
```

### AR-02 手动刷新库存

新增：

```text
POST /api/v1/admin/ai-questioning/adaptive-inventory/refresh
```

Body：

```ts
{
  subject?: string;
  topicId?: number;
  includeHealthy?: boolean;
}
```

要求：

- 写入 `adaptive_question_inventory_snapshots`。
- 返回本次写入的 summary 和 items。
- 记录 admin audit：`resourceType = adaptive-inventory`，`action = refresh`。

### AR-03 创建补题计划

新增：

```text
POST /api/v1/admin/ai-questioning/replenishment-plans
```

Body：

```ts
{
  subject?: string;
  topicId?: number;
  difficultyBand?: string;
  questionType?: string;
  statuses?: string[];
  maxPlans?: number;
  maxQuestionsPerPlan?: number;
  dryRun?: boolean;
  force?: boolean;
}
```

要求：

- `dryRun=true` 只返回将创建的计划，不写 DB。
- 默认只对 `shortage | critical` 创建。
- `warning` 需要显式传入。
- 记录 admin audit：`resourceType = replenishment-plan`，`action = create`。

### AR-04 计划列表

新增：

```text
GET /api/v1/admin/ai-questioning/replenishment-plans
```

Query：

```ts
{
  subject?: string;
  topicId?: number;
  status?: string;
  limit?: number;
}
```

### AR-05 计划入队

新增：

```text
POST /api/v1/admin/ai-questioning/replenishment-plans/:id/enqueue
```

Body：

```ts
{
  limit?: number;
  processNow?: boolean;
  force?: boolean;
}
```

要求：

- 找到对应 active blueprint。
- 入队数量不得超过 `requestedCount - enqueuedCount`。
- 入队 job 必须带 `generationMode = adaptive_inventory_replenishment`。
- 返回 `requested/enqueued/skipped/items`。
- 记录 admin audit：`resourceType = replenishment-plan`，`action = enqueue`。

## 6. 后端工单

### AR-BE-01 新增 Prisma 表和迁移

文件：

```text
backend/prisma/schema.prisma
backend/prisma/migrations/*
```

验收：

- `npm run prisma:validate` 通过。
- 迁移包含两个表和索引。

### AR-BE-02 增加库存计算服务函数

文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
```

建议方法：

```ts
refreshAdaptiveInventorySnapshots(query)
listAdaptiveInventorySnapshots(query)
```

验收：

- 正式题计数只来自 `special_practice_questions` 映射。
- 在线模考候选不进入库存。
- 候选题数量不改变 `effectiveStock`。
- 同 topic 的不同 difficulty 独立统计。

### AR-BE-03 增加安全库存策略函数

文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
```

建议先放本 service 内，后续再拆：

```ts
adaptiveSafetyStockFor(difficultyBand)
adaptiveInventoryStatus(input)
```

验收：

- `basic/medium/hard/challenge` 返回不同安全线。
- `critical` 只在 `effectiveStock = 0` 时出现。
- 缺 active blueprint/profile 时可覆盖为 `blocked`。

### AR-BE-04 增加补题计划函数

文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
```

建议方法：

```ts
createAdaptiveReplenishmentPlans(input, actorId)
listAdaptiveReplenishmentPlans(query)
enqueueAdaptiveReplenishmentPlan(id, input)
```

验收：

- 同 key 不重复创建 open plan。
- `dryRun` 不写 DB。
- blocked key 不创建 generation job。

### AR-BE-05 扩展 generation job metadata

文件：

```text
backend/src/ai-questioning/ai-questioning.service.ts
```

要求：

- `enqueueGenerationJobs` 支持传入 `replenishmentPlanId` 和 `inventoryKey`。
- `promptMetadata` 或 job metadata 中持久化 `generationMode = adaptive_inventory_replenishment`。
- queue health 可以按 `useCase=subject_practice` 正常看见这些任务。

验收：

- `rg "adaptive_inventory_replenishment" backend/src scripts` 能命中 service 和测试。
- 生成仍走 Gateway，不出现业务层直接 `/chat/completions`。

### AR-BE-06 Controller 和 audit

文件：

```text
backend/src/ai-questioning/ai-questioning.controller.ts
```

验收：

- 五个 API 都挂在 admin guard 下。
- refresh/create/enqueue 都写 admin audit。
- 响应不泄露 provider key。

## 7. 前端工单

### AR-FE-01 API client 类型

文件：

```text
frontend/src/lib/api-admin.ts
```

新增：

```ts
getAdminAdaptiveInventory
refreshAdminAdaptiveInventory
createAdminReplenishmentPlans
getAdminReplenishmentPlans
enqueueAdminReplenishmentPlan
```

### AR-FE-02 库存风险面板

文件：

```text
frontend/src/components/admin/ai-question-bank/CoverageWorkPanel.tsx
frontend/src/components/admin/ai-question-bank/coverageWorkPanelProps.ts
```

展示字段：

- 库存状态。
- 有效库存 / 安全库存 / 目标库存。
- 缺口。
- 正在生成任务数。
- blocker。

交互：

- 刷新库存。
- 为 shortage/critical 创建计划。
- 查看计划列表。
- 入队计划。

### AR-FE-03 信息层级

要求：

- 已入库库存展示在候选列表上方。
- 候选题仍是异常治理，不作为库存完成依据。
- 按 subject workspace 切换时重新加载库存和计划。
- 在线模考工作区不展示科目训练补题计划。

## 8. 测试工单

### AR-T01 规则脚本

新增：

```text
scripts/adaptive-replenishment-rules-test.cjs
```

覆盖：

- Prisma schema 包含两个新 model。
- 库存 SQL 引用 `special_practice_questions`。
- 库存 SQL 排除 `online_mock_exam` / `mock_exam_blueprint_slot`。
- safety stock 分 difficulty。
- create plan 支持 `dryRun`。
- enqueue plan 写 `adaptive_inventory_replenishment` metadata。
- Gateway 搜索边界仍成立。

新增 package script：

```json
"adaptive-replenishment:rules": "node scripts/adaptive-replenishment-rules-test.cjs"
```

### AR-T02 Smoke 扩展

扩展：

```text
scripts/csca-ai-questioning-smoke.cjs
```

最小场景：

1. 创建一个 subject_practice 蓝图。
2. 刷新库存，确认当前 key 为 `critical` 或 `shortage`。
3. dry-run 创建 plan，确认不写 DB。
4. 创建 plan。
5. enqueue plan。
6. mock/fallback 生成通过现有队列处理。
7. 自动入库后刷新库存，`effectiveStock` 增长。

### AR-T03 回归命令

Phase 0-1 完成前必须通过：

```bash
npm run prisma:validate
npm run adaptive-replenishment:rules
npm run csca-ai-questioning:rules
npm run csca-ai-questioning:smoke
npm run csca-ai-questioning:subject-closure-smoke
npm run csca-ai-gateway:rules
npm run backend:build
npm run frontend:build
rg "fetch\\(.*chat/completions" backend/src
```

## 9. 开发顺序

推荐顺序：

1. AR-BE-01 建表。
2. AR-BE-02 / AR-BE-03 库存快照和安全线。
3. AR-01 / AR-02 API。
4. AR-T01 规则脚本第一版。
5. AR-FE-01 / AR-FE-02 后台只读库存面板。
6. AR-BE-04 补题计划。
7. AR-03 / AR-04 / AR-05 API。
8. AR-BE-05 入队 metadata。
9. AR-FE-03 管理动作。
10. AR-T02 smoke 扩展。

## 10. Phase 0-1 完成审核

完成前必须逐项回答：

- 是否能按 subject/topic/difficulty/questionType 看到正式库存？
- 候选题数量是否不会改变 `effectiveStock`？
- 在线模考题是否被排除？
- shortage/critical 是否能稳定复现？
- dry-run plan 是否不写 DB？
- open plan 是否去重？
- enqueue plan 是否复用现有 generation queue？
- generation job 是否带 `adaptive_inventory_replenishment` metadata？
- 生成仍是否统一走 AI Gateway？
- 后台是否把库存显示在候选治理之前？
- 所有回归命令是否通过？

只有以上全部满足，Phase 0-1 才算完成。

## 11. Phase 2 交接边界

Phase 0-1 完成后，Phase 2 再做：

- 24h / 7d 预测需求。
- 定时创建补题计划。
- runtime shortage event。
- 学生抽题降级策略。
- plan 自动 completed / blocked 状态推进。
- 预算和多 worker 优化。

不要在 Phase 0-1 提前引入这些复杂度。
