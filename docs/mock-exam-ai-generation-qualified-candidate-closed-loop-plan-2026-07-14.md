# 在线模考 AI 合格候选闭环优化执行方案

> 日期：2026-07-14  
> 状态：待实施的执行级方案  
> 范围：在线模考 AI 出题、整卷蓝图、题位候选、自动门禁、合格候选提升、草稿卷装配、后台状态展示  
> 背景：线上出现“候选题持续增长，但正式合格题长期停在少数几个”的问题。目标不是限制候选增长，而是修复闭环，让系统持续产出并认领合格候选，直到一套卷的全部题位完成。

## 1. 核心结论

在线模考生成的目标必须定义为：

```text
一套卷的每个 ready 题位都有 1 道通过门禁、双语完整、绑定当前蓝图题位、可装配的正式合格题
```

不能把以下指标当成成功：

- 生成任务数量。
- 候选题数量。
- AI job 成功数量。
- `gate=human_review` 或 `review_failed` 的候选数量。
- 未绑定当前题位的通用 AI 题。

当前机制的主要问题不是“不会循环”，而是循环中有两个断点：

1. **合格候选未被认领**：已有候选可能已经 `gate=publishable`，但仍停留在 `pending_review`，没有被提升为 `mockExamApproval.approved_for_mock_exam_assembly`。
2. **失败原因没有有效纠偏**：大量候选卡在 `profile_alignment_warning`、`reading_load_mismatch`、`calculation_load_band_mismatch`、`cognitive_skill_mismatch`、`question_form_mismatch`，系统继续生成新候选，但没有稳定调整题位目标或生成策略。

因此本方案采用：

```text
先认领已有合格候选
-> 再修复可修复候选
-> 再生成缺口候选
-> 每轮只用正式合格题位数量判断进度
-> 按失败原因纠偏题位策略
-> 直到 48/48 或明确 blocked
```

## 2. 当前观察到的问题

### 2.1 线上现象

管理员在线上生成在线模考题时，候选数量可以增长到数百个，但正式合格题数长期停在 3 个左右。

这说明：

- Provider 不是完全不可用，因为初期能产生少量合格题。
- 任务不是完全没跑，因为候选数量持续增加。
- 问题集中在“候选 -> 合格题位”的转化链路。

### 2.2 本地同类迹象

本地只读检查最近在线模考候选时观察到：

- 大量候选为 `pending_review + gate=human_review`。
- 大量候选卡在画像对齐原因：
  - `reading_load_mismatch`
  - `calculation_load_band_mismatch`
  - `cognitive_skill_mismatch`
  - `question_form_mismatch`
  - `calculation_load_mismatch`
- 存在真正在线模考来源的候选已经 `gate=publishable`，topic 也是 `published`，但仍缺少 `mockExamApproval`，没有进入正式可装配资产。

这证明需要同时解决：

1. 自动提升已合格候选。
2. 生成失败后的策略纠偏。

## 3. 正确业务语义

### 3.1 在线模考题位

一个题位是整卷蓝图的固定位置。它至少包含：

- `mockBlueprintId`
- `mockBlueprintSlotId`
- `slotNumber`
- `subject`
- `topicIds`
- `difficultyBand`
- `questionForm`
- `cognitiveSkill`
- `readingLoad`
- `calculationLoad`
- `generationStrategy`

题位完成标准：

```text
该题位绑定了一道正式合格题
```

### 3.2 在线模考候选

候选题只是题位生产过程中的中间产物。

候选可以处于：

- 可提升：`gate=publishable`，双语完整，topic published，slot 绑定正确。
- 可修复：选项、答案、解析、双语、轻度画像偏差等问题。
- 应重生：知识点不匹配、学科不匹配、相似度过高、题干不可用、图像缺失、难度完全不符等硬伤。
- 应归档：超过修复次数、超过候选预算或来自旧机制且无法归属。

### 3.3 正式合格题

正式合格题必须满足：

```text
csca_questions.status = approved
review_metadata.approvalGate.status = passed
review_metadata.approvalGate.source = mock_exam_auto_gate
review_metadata.mockExamApproval.status in (
  approved_for_mock_exam_assembly,
  assembled_in_mock_exam_draft
)
generation_metadata.sourceKind/generationSource/generationMode 标明 online mock
generation_metadata.mockExamSlot.blueprintId = 当前蓝图 id
generation_metadata.mockExamSlot.slotId = 当前题位 id
generation_metadata.mockExamSlot.slotNumber = 当前题位编号
中英文 prompt/options/explanation 完整
topic.status = published
```

只有正式合格题计入：

```text
approvedSlotCount
completedSlotCount
整卷完成度
```

## 4. 目标状态

### 4.1 单个题位闭环

```text
题位开始
-> 查找当前题位已有合格候选
-> 有则提升为正式合格题
-> 没有则查找可修复候选
-> 可修复则原题修复并复审
-> 仍没有则生成新候选
-> 新候选过门禁则提升
-> 新候选不过门禁则按失败原因修复或重生
-> 题位完成或进入明确 blocked
```

### 4.2 整卷闭环

```text
加载 48 个 ready 题位
-> 统计每个题位正式合格题
-> 对未完成题位并发执行单题位闭环
-> 每轮结束重新统计正式合格题位
-> 若正式合格数增长，继续下一轮
-> 若无增长，根据阻塞原因纠偏后继续
-> 达到 48/48 后 completed
-> 可装配草稿卷
```

### 4.3 成功标准

一套 48 题在线模考的完成条件：

```text
readySlotCount = 48
approvedSlotCount = 48
每个 slotNumber 只有 1 道当前生效合格题
所有合格题中英文完整
所有合格题可被装配成 mock exam draft
候选治理列表不展示已自动入库合格题
```

## 5. 需要改造的服务职责

### 5.1 MockExamCandidatePromotionService

新增或抽取一个候选提升服务，负责把已合格候选转成正式可装配题。

职责：

1. 按蓝图和题位查询已有候选。
2. 判断候选是否可提升。
3. 写入 `approvalGate`。
4. 写入 `mockExamApproval`。
5. 更新 `csca_questions.status = approved`。
6. 回写题位结果。
7. 防止同一题位重复提升多道题。

核心方法建议：

```ts
promotePublishableCandidateForSlot(input: {
  blueprintId: number;
  slotId: number;
  slotNumber: number;
  actorId: number;
}): Promise<{
  promoted: boolean;
  questionId?: number;
  reason?: string;
}>
```

查询条件：

```sql
generation_metadata->'mockExamSlot'->>'blueprintId' = 当前蓝图 id
generation_metadata->'mockExamSlot'->>'slotId' = 当前题位 id
review_metadata->'gate'->>'decision' = 'publishable'
status in ('pending_review', 'review_failed', 'draft', 'approved')
```

补充兼容：

- 若旧候选只有 `slotNumber`，但缺 `slotId`，允许在同一 blueprint 下按 `slotNumber` 匹配一次，并在提升时补齐 `slotId`。
- 若缺 `mockExamSlot`，即使 `generationMode=online_mock_exam_candidate`，也不能自动提升，应进入待归属候选。

### 5.2 MockExamSlotFulfillmentRunner

将当前题位生成逻辑整理成明确顺序：

```text
1. promote existing publishable candidate
2. repair existing repairable candidate
3. generate replacement candidate
4. repair generated candidate if repairable
5. replan target profile if structural mismatch repeats
6. mark slot blocked only after retry policy is exhausted
```

关键要求：

- 每次生成新候选前，必须先执行一次 `promotePublishableCandidateForSlot`。
- 每次修复候选后，必须复审并再次尝试提升。
- 每轮整卷处理开始前，先全量扫描并提升已有合格候选。
- 不允许跳过已合格候选直接继续生成。

### 5.3 MockExamTargetProfileReplanner

当前重规划不能只换题干模式，还要针对失败字段调整题位策略。

输入：

```ts
type ReplanInput = {
  targetProfile: MockExamTargetProfile;
  gateReasons: string[];
  profileReasons: string[];
  reviewIssueCodes: string[];
  failedCandidateSamples: number[];
  noProgressRounds: number;
}
```

输出：

```ts
type ReplanOutput = {
  targetProfile: MockExamTargetProfile;
  changedFields: string[];
  strategyInstructions: string[];
  bannedPatterns: string[];
  requiredPattern: string;
}
```

纠偏规则：

| 失败原因 | 优先处理 |
| --- | --- |
| `reading_load_mismatch` | 明确题干条件数量、文字长度、情境密度 |
| `calculation_load_mismatch` | 明确计算步数和公式变换数量 |
| `calculation_load_band_mismatch` | 调整数值复杂度、公式数量、选项结构 |
| `cognitive_skill_mismatch` | 锁定能力模板，如判断、条件推断、错误诊断、多步应用 |
| `question_form_mismatch` | 锁定题干形式，不允许生成普通求解题 |
| `missing_bilingual_localization` | 原题补双语，不重新生成 |
| `weak_syllabus_signal` | 原题补充 topic 关键词和考纲证据 |
| `past_paper_similarity_high` | 硬重生，禁止复用题干骨架 |

### 5.4 MockExamGenerationProgressService

整卷进度必须以正式题位增长为核心。

每轮记录：

```ts
type MockExamGenerationRoundProgress = {
  jobId: number;
  blueprintId: number;
  round: number;
  approvedBefore: number;
  approvedAfter: number;
  promotedExistingCount: number;
  repairedAndPromotedCount: number;
  generatedAndPromotedCount: number;
  generatedCandidateCount: number;
  rejectedCandidateCount: number;
  noProgressRounds: number;
  topGateReasons: Array<{ reason: string; count: number }>;
  topProfileReasons: Array<{ reason: string; count: number }>;
}
```

状态语义：

| 状态 | 含义 |
| --- | --- |
| `running` | 本轮正在处理题位 |
| `queued` | 还有未完成题位，等待下一轮 |
| `completed` | 当前卷全部题位合格 |
| `blocked_no_progress` | 多轮没有新增正式合格题，但仍有可诊断原因 |
| `blocked_candidate_limit` | 候选预算耗尽 |
| `blocked_provider` | Provider 连续失败 |
| `blocked_profile_conflict` | 题位画像和门禁判定长期冲突 |

注意：`blocked` 不是降低目标，而是停止盲目生成，要求系统给出明确原因和下一步动作。

## 6. 循环策略

### 6.1 候选不是目标

每个题位允许存在候选预算，但候选预算只是成本控制，不是完成标准。

建议默认：

```text
每个 slot 的候选预算 = 12
每个 slot 的原题修复预算 = 4
每个 slot 的结构重规划预算 = 3
整卷并发 slot 数 = 3
```

如果某题位候选预算耗尽仍没有合格题：

1. 不继续无限生成。
2. 汇总失败原因。
3. 执行题位策略重规划。
4. 如果重规划预算仍耗尽，进入 `blocked_profile_conflict`。

### 6.2 每轮顺序

每轮整卷处理必须按以下顺序：

```text
Round start
1. refresh blueprint and ready slots
2. promote existing publishable candidates for all open slots
3. recompute approvedSlotCount
4. if completed -> completed
5. repair repairable candidates for open slots
6. promote again
7. generate new candidates only for still open slots
8. repair generated candidates if repairable
9. promote again
10. compute progress delta
11. if approvedSlotCount increased -> next round
12. if no progress -> replan blocked slots or stop with actionable blocked reason
```

### 6.3 合格候选提升优先级

一个题位可能存在多个 `publishable` 候选。选择顺序：

1. `gate.score` 或 reviewer score 更高。
2. profile alignment `passed` 优先于 `warning`。
3. source similarity 更低。
4. 生成时间更新。
5. question id 更大。

提升后同题位其他候选：

- 保留为历史候选，但不计入当前题位。
- 前端默认不展示，除非切换到历史/重复候选视图。

## 7. 门禁与修复策略

### 7.1 可直接提升

候选可以直接提升为正式合格题的条件：

```text
gate.decision = publishable
status in pending_review/review_failed/draft/approved
topic.status = published
mockExamSlot.blueprintId = 当前蓝图
mockExamSlot.slotId 或 slotNumber 匹配当前题位
中英文 prompt/options/explanation 完整
不是 fallback
不是 smoke
不是旧 legacy 候选
数学文本可渲染
```

### 7.2 可原题修复

以下问题优先原题修复：

- 缺英文或英文不完整。
- 选项过近、选项重复、多个正确答案。
- 正确答案标记错误但题干可用。
- 解析没有支撑答案。
- LaTeX 不规范。
- reading load 轻度不符。
- calculation load 轻度不符。
- weak syllabus signal。
- profile alignment warning 但没有 topic/subject 硬错。

### 7.3 应重生

以下问题直接废弃当前候选并重新生成：

- 学科不匹配。
- topic 不匹配。
- 考纲版本不匹配。
- 与真题或已有题高度相似。
- 题干泄露真题来源。
- 图像依赖但没有图像。
- 题目不可解或不可读。
- 难度完全不在目标范围。
- 题干形式和题位目标长期冲突，且原题修复已经失败。

## 8. 数据与查询改造

### 8.1 强化 mock scope

新生成在线模考候选必须写完整：

```json
{
  "sourceKind": "mock_exam_blueprint_slot",
  "generationSource": "mock_exam_blueprint_slot",
  "generationMode": "online_mock_exam_candidate",
  "intendedUse": "online_mock_exam",
  "targetUseCase": "online_mock_exam",
  "mockExamSlot": {
    "blueprintId": 17,
    "slotId": 123,
    "slotNumber": 1,
    "sourcePaperId": 45
  }
}
```

查询时不能只判断 `generation_metadata->'mockExamSlot' IS NOT NULL`，因为 JSON null 也会被误判。必须使用：

```sql
jsonb_typeof(generation_metadata->'mockExamSlot') = 'object'
```

### 8.2 待归属候选

如果候选满足 `online_mock_exam_candidate`，但缺少 `mockExamSlot` 对象：

- 不自动提升。
- 列入 `unscoped_mock_candidate`。
- 后台可显示“缺题位绑定”。
- 开发阶段可批量清理。

### 8.3 正式题位唯一性

同一个 `blueprintId + slotId` 只能有一个当前生效合格题。

建议通过逻辑约束实现：

- 提升时先查该 slot 是否已有 `approved_for_mock_exam_assembly` 或 `assembled_in_mock_exam_draft`。
- 已存在则不再提升第二道。
- 若需要替换，必须走显式 `replace` 动作，并把旧题标记 `superseded_for_mock_exam_slot`。

## 9. 前端展示改造

### 9.1 任务卡

在线模考生成区域展示：

```text
整卷目标：48 题
正式合格：3/48
本轮新增：0
已提升已有候选：0
已修复入库：0
新生成入库：0
候选新增：37
未完成题位：45
主要阻塞：reading_load_mismatch 18、calculation_load_band_mismatch 12
```

### 9.2 候选治理区

候选治理只展示未入库异常候选：

- `human_review`
- `regenerate`
- `review_failed`
- `missing_bilingual_localization`
- `profile_alignment_warning`
- `unscoped_mock_candidate`

不展示：

- 已提升为正式合格题。
- 已装配进草稿卷。
- 被替代的历史合格题，除非查看历史。

### 9.3 已合格题区

候选治理上方必须展示：

```text
在线模考已合格题位 3/48
```

列表字段：

- slotNumber
- questionId
- topic
- difficulty
- questionForm
- cognitiveSkill
- gate score
- 生成时间
- 装配状态

### 9.4 异常原因面板

当正式合格数不增长时，前端不要只显示“生成中”，而要显示：

```text
当前循环没有新增正式合格题。
主要原因：
1. reading_load_mismatch：18 道
2. calculation_load_band_mismatch：12 道
3. cognitive_skill_mismatch：9 道

系统下一步：
- 先尝试提升已有 publishable 候选
- 再对可修复候选进行原题优化
- 再重规划失败题位生成策略
```

## 10. 实施步骤

### Phase 1：修复合格候选提升断点

目标：已 `publishable` 的在线模考候选能自动转为正式可装配题。

任务：

1. 新增 `promotePublishableCandidateForSlot`。
2. 在每轮生成前全量扫描未完成题位。
3. 在每个题位生成前先尝试提升已有候选。
4. 在修复后和生成后再次尝试提升。
5. 修正查询条件，避免 JSON null 被当作 mock slot。
6. 增加单元测试覆盖：
   - `pending_review + gate=publishable` 可以提升。
   - 缺 `mockExamSlot` 不能提升。
   - slot 已有合格题时不重复提升。

验收：

```text
准备一个已有 publishable 候选的题位
运行在线模考处理
该题位正式合格数 +1
候选治理列表不再展示该题
```

### Phase 2：按失败原因纠偏生成

目标：不是盲目生成更多候选，而是让后续候选更可能通过门禁。

任务：

1. 汇总每个 slot 最近 N 个失败候选的 gate/profile 原因。
2. 将原因输入 `MockExamTargetProfileReplanner`。
3. 对 `readingLoad/calculationLoad/cognitiveSkill/questionForm` 生成明确约束。
4. 对可修复问题优先原题修复。
5. 对硬伤才重生。
6. 重规划后记录 `changedFields` 和 `strategyInstructions`。

验收：

```text
当 slot 连续出现 calculation_load_band_mismatch
下一轮 prompt 中出现明确 calculationLoad 纠偏要求
候选不再只重复同一题干模式
```

### Phase 3：进度和阻塞语义改造

目标：管理员能看懂为什么正式题不增长。

任务：

1. 增加 round progress 记录。
2. 前端展示正式合格题位增长、候选新增、失败原因。
3. `completed` 只由正式合格题位决定。
4. `blocked` 只在纠偏后仍无新增时出现，并给出可执行原因。

验收：

```text
候选新增但正式合格不新增时
前端明确显示 no progress 和 top reasons
不会误显示“成功生成”
```

### Phase 4：整卷装配联动

目标：48/48 后可以稳定装配草稿卷。

任务：

1. `approvedSlotCount = 48` 后允许装配。
2. 装配成功后回写每道题：
   - `mockExamApproval.status = assembled_in_mock_exam_draft`
   - `mockExamApproval.draftPaperId`
   - `mockExamApproval.assembledAt`
3. 前端已合格题区显示“待装配/已装配”。

验收：

```text
48/48 合格后点击装配
草稿卷题数为 48
每个 slotNumber 对应唯一题目
候选治理不展示已装配题
```

## 11. 测试清单

### 11.1 后端单元测试

- `publishable pending_review candidate promotes to approved mock asset`
- `candidate without mockExamSlot object is not promoted`
- `json null mockExamSlot is not treated as scoped candidate`
- `slot with existing approved asset does not promote duplicate`
- `missing bilingual candidate goes repair path`
- `profile mismatch candidate goes replan path`
- `hard similarity candidate goes regenerate path`

### 11.2 集成测试

场景 1：已有合格候选未提升

```text
Given slot 1 has pending_review candidate with gate=publishable
When process mock generation job
Then slot 1 becomes approved
And question review_metadata.mockExamApproval.status=approved_for_mock_exam_assembly
```

场景 2：候选很多但正式题不涨

```text
Given slot has 10 failed candidates
When run next round
Then service summarizes top failure reasons
And replans target strategy before generating new candidates
```

场景 3：整卷完成

```text
Given 48 slots each has one publishable candidate
When run generation process
Then job completed
And approvedSlotCount=48
```

### 11.3 前端测试

- 已合格题区在候选治理上方。
- 切换卷后只显示当前卷的题位和候选。
- `刷新候选` 不刷新整页。
- no progress 时显示主要阻塞原因。
- 已入库/已装配题不出现在异常候选列表。

## 12. 上线与清理

### 12.1 开发环境清理

开发阶段允许清理旧候选以避免污染判断。

可提供后台按钮：

- 清理当前卷未入库异常候选。
- 清理当前卷全部 AI 生成结果。
- 清理缺 scope 的 legacy mock 候选。

### 12.2 线上部署后处理

上线后先不要直接删线上旧题，建议：

1. 运行只读诊断脚本：
   - 当前每套卷 approvedSlotCount。
   - publishable 但未提升候选数。
   - unscoped mock candidate 数。
   - top gate/profile reasons。
2. 对 publishable 未提升候选执行提升脚本。
3. 对 unscoped/legacy 候选标记归档。
4. 再启动新的闭环生成。

## 13. 验收标准

本方案完成后，应满足：

1. 在线模考生成不再以候选数量作为成功指标。
2. 已经 `gate=publishable` 的当前题位候选会被自动提升。
3. 正式合格题数会随着循环推进持续增长。
4. 当正式合格题不增长时，系统会给出失败原因并调整生成策略。
5. 48 题卷必须 48 个题位都有合格题才 completed。
6. 候选治理只展示异常候选。
7. 已合格题展示在候选治理上方。
8. 切换不同模考卷不会串数据。
9. 缺 scope 或旧机制候选不会污染当前卷。
10. 生成失败时能区分 Provider 问题、画像问题、门禁问题和装配问题。

## 14. 当前采用方案摘要

采用“合格题位闭环”方案：

```text
不是候选数量闭环
不是 AI job 成功闭环
不是人工审核闭环

而是：
当前卷题位 -> 合格候选 -> 自动提升 -> 正式可装配题 -> 48/48 完成
```

关键优先级：

1. 先提升已有合格候选。
2. 再修复可修复候选。
3. 再生成新候选。
4. 每轮只看正式合格题位是否增长。
5. 增长停滞时，按失败原因纠偏题位策略，而不是无脑堆候选。

