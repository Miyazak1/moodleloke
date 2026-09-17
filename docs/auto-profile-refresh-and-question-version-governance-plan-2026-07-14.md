# 自动画像刷新与题目版本治理可执行方案

> 日期：2026-07-14  
> 范围：真题 JSON 上传、单卷画像、连续月份趋势画像、当前出题画像、科目训练自动出题、在线模考 AI 出题、旧题版本治理。  
> 目标：上传或更新每个月份真题后，系统自动完成画像聚合与当前出题画像更新；新生成题严格使用最新版画像；旧题不删除，改为版本化、可追溯、可降级使用。

## 1. 背景与问题

当前系统已经具备以下基础能力：

1. 真题 JSON 上传后，会创建 `csca_source_documents` 和 `csca_source_questions`。
2. 真题题目可以自动画像，结果写入 `csca_source_questions.auto_profile_*`。
3. 自动画像完成后，可刷新 `csca_question_style_profiles`。
4. 系统已有连续趋势画像表 `csca_exam_series_profiles`。
5. 系统已有当前出题画像表 `csca_generation_profiles`。
6. 科目训练生成题时，后端会优先读取 active `generation_profile`。
7. 在线模考生成题也已经具备读取 active generation profile 的基础链路。

但当前仍有关键缺口：

1. 单卷画像完成后，连续趋势画像不会自动聚合更新。
2. 连续趋势画像生成后，`subject_practice` 和 `online_mock_exam` 的当前出题画像不会自动更新。
3. 大纲更新后，旧趋势画像和旧出题画像没有统一 stale 判断。
4. 自动出题 readiness 目前只要求大纲、真题画像和风格画像，不足以保证使用的是“最新趋势画像”。
5. 旧题不能简单删除，但也不能无标记地继续混入新题统计。

因此需要建立一条事件驱动的画像刷新流水线，并补齐题目版本治理。

## 2. 核心原则

### 2.1 真题原文不因画像变化而改写

真题 JSON 是事实源。画像解析、映射和趋势聚合可以重跑，但不得因为大纲或画像更新而修改真题原始题干、选项、答案和解析。

允许补充或更新：

- document metadata。
- source question analysis。
- topic mapping。
- auto profile gate result。
- source profile lineage。

### 2.2 旧题保留，不一刀切删除

旧 AI 题是题库资产，不应因为画像更新直接删除。

旧题需要进入版本治理：

- 可以继续使用。
- 可以降级使用。
- 可以进入复核。
- 可以退休。

是否可用由题目自己的 generation lineage 和当前画像版本对比决定。

### 2.3 新生成题必须使用最新版当前出题画像

自动出题只能使用当前 active 且 fresh 的 `csca_generation_profiles`。

不允许自动出题静默 fallback 到旧 `csca_question_style_profiles`。

手工调试可以允许 fallback，但必须显式标记为 `manual_debug` 或 `legacy_fallback`，且不能进入正式自动闭环。

### 2.4 画像未完整时不启动自动出题

以下任意条件不满足，科目训练和在线模考 AI 自动生成都必须暂停：

1. 当前学科有已应用大纲。
2. 当前学科有 active past paper source documents。
3. 当前 active past paper source questions 全部完成自动画像或被明确排除。
4. 当前趋势画像覆盖所有 active past paper source documents。
5. 当前出题画像来自最新 active 趋势画像。
6. 当前出题画像 use case 匹配生成目标。

## 3. 目标链路

### 3.1 上传新月份真题后的目标流程

```text
上传某月份真题 JSON
-> 创建 active source document/questions
-> 启动 source question auto profile task
-> 单题画像全部完成
-> 自动刷新 subject style profile
-> 自动生成/更新 exam series trend profile
-> 自动生成 subject_practice generation profile
-> 自动生成 online_mock_exam generation profile
-> 标记旧 generation profile 为 superseded
-> 唤醒自动出题 readiness 检查
-> 科目训练/在线模考按最新版画像生成新题
```

### 3.2 大纲更新后的目标流程

```text
应用新版大纲
-> 旧 topic 映射进入 stale 检查
-> active source questions 重新映射或重新画像
-> 未完成前禁止自动出题
-> 完成后自动更新连续趋势画像
-> 自动更新两个 use case 的 generation profile
-> 新题使用最新版画像
-> 旧题按版本状态重新分类
```

### 3.3 趋势画像和出题画像关系

```text
单份真题画像 csca_source_questions.analysis
        ↓
样本/单层画像 csca_question_style_profiles
        ↓
连续月份趋势画像 csca_exam_series_profiles
        ↓
当前出题画像 csca_generation_profiles
        ↓
科目训练 / 在线模考 AI 出题
```

单份真题画像是基础事实层。  
连续月份趋势画像是聚合判断层。  
当前出题画像是生成执行层。

新题只应直接依赖当前出题画像，不应直接依赖某一份真题画像。

## 4. 数据版本模型

### 4.1 趋势画像版本字段

`csca_exam_series_profiles` 已有：

- `id`
- `subject`
- `syllabus_version`
- `source_document_ids`
- `source_style_profile_ids`
- `source_question_ids`
- `trend_profile`
- `sample_size`
- `confidence`
- `status`
- `generated_at`

建议在 `trend_profile` 中稳定记录：

```json
{
  "schemaVersion": "csca-exam-series-trend-profile-v1",
  "subject": "math",
  "syllabusVersion": "2025",
  "sourceKind": "continuous_exam_series",
  "sourceDocumentIds": [1, 2, 3],
  "sourceQuestionIds": [101, 102],
  "sourceStyleProfileIds": [11, 12],
  "sourceSnapshotHash": "sha256(...)",
  "syllabusSnapshotHash": "sha256(...)",
  "profileWindow": {
    "mode": "all_active_past_papers",
    "fromSession": "2025-12",
    "toSession": "2026-04"
  },
  "generatedAt": "2026-07-14T00:00:00.000Z"
}
```

### 4.2 当前出题画像版本字段

`csca_generation_profiles` 已有：

- `id`
- `subject`
- `syllabus_version`
- `use_case`
- `series_profile_id`
- `source_style_profile_id`
- `profile`
- `target_policy`
- `sample_size`
- `confidence`
- `status`

建议在 `profile` 和 `target_policy` 中稳定记录：

```json
{
  "schemaVersion": "csca-generation-profile-v1",
  "subject": "math",
  "syllabusVersion": "2025",
  "useCase": "subject_practice",
  "source": "exam_series_profile",
  "seriesProfileId": 15,
  "sourceSnapshotHash": "sha256(...)",
  "syllabusSnapshotHash": "sha256(...)",
  "profileWindow": {
    "mode": "all_active_past_papers",
    "fromSession": "2025-12",
    "toSession": "2026-04"
  }
}
```

### 4.3 题目版本 lineage

每一道 AI 生成题，无论候选还是已入库，都必须记录：

```json
{
  "generationProfileId": 21,
  "seriesProfileId": 15,
  "sourceStyleProfileId": 9,
  "sourceProfileIds": [9],
  "syllabusVersion": "2025",
  "sourceSnapshotHash": "sha256(...)",
  "syllabusSnapshotHash": "sha256(...)",
  "generationSchema": "csca-ai-question-generation-v2",
  "generatorPromptVersion": "generator-syllabus-v1",
  "reviewerPromptVersion": "reviewer-rubric-v1",
  "generatedAt": "2026-07-14T00:00:00.000Z",
  "targetUseCase": "subject_practice"
}
```

候选题写入 `csca_questions.generation_metadata`。  
入库题继续保留同样 metadata，不因入库丢失 lineage。

## 5. 旧题版本治理

### 5.1 旧题状态定义

新增逻辑状态，不一定第一阶段就新增 DB 字段，也可先由 metadata 派生：

| 状态 | 含义 | 学生端是否可抽取 | 后台默认展示 |
|---|---|---:|---:|
| `current` | 基于当前 active generation profile，且大纲仍匹配 | 是，优先 | 是 |
| `legacy_usable` | 旧画像生成，但大纲仍匹配，质量门禁仍有效 | 是，低优先级 | 是 |
| `stale_needs_review` | 大纲、趋势画像或题目目标发生变化，需要复核 | 否 | 是 |
| `retired` | 明确不适配当前大纲或质量规则 | 否 | 默认隐藏 |
| `unknown_legacy` | 缺少 lineage，无法判断来源 | 否，除非人工确认 | 历史筛选 |

### 5.2 不同变化对旧题的影响

| 变化 | 旧题处理 |
|---|---|
| 新增一个月份真题 | 旧题不删除；若大纲未变，旧题大多为 `legacy_usable` |
| 趋势画像权重变化 | 旧题不删除；新题使用新画像；旧题降低优先级 |
| 大纲 topic code 保持但描述扩展 | 旧题通常 `legacy_usable`，可抽样复核 |
| 大纲 topic 被归档或重命名 | 相关旧题进入 `stale_needs_review` |
| 题目生成 schema / 门禁规则升级 | 旧题进入版本差异队列，必要时抽样复核 |
| 数学渲染或双语规则升级 | 不合规则旧题进入 `stale_needs_review` 或 repair |

### 5.3 学生端抽题策略

默认抽题优先级：

```text
current
-> legacy_usable
-> 手工正式题
```

禁止抽取：

```text
stale_needs_review
retired
unknown_legacy
pending_review
review_failed
archived
```

如果当前题不足：

1. 优先触发自动补题。
2. 自动补题生成期间，可短期使用 `legacy_usable`。
3. 不为了凑数使用 stale 或 unknown 题。

### 5.4 后台展示

每道 AI 题显示：

- 当前使用状态：`current / legacy_usable / stale_needs_review / retired / unknown_legacy`。
- 生成时间。
- generation profile id。
- series profile id。
- 大纲版本。
- source snapshot。
- 是否当前 active profile。
- 是否来自旧画像。

筛选项：

- 当前题。
- 旧版可用。
- 待复核旧题。
- 已退休。
- lineage 缺失。

## 6. 自动画像刷新流水线

### 6.1 新增任务类型

建议复用 `csca_ai_questioning_tasks`，新增 task type：

```text
source_profile_pipeline
```

任务 action：

```text
source_document_imported
source_document_reprofiled
syllabus_applied
manual_rebuild
startup_reconcile
```

任务 filter snapshot：

```json
{
  "subject": "math",
  "syllabusVersion": "2025",
  "sourceDocumentId": 928,
  "trigger": "source_document_imported",
  "requestedUseCases": ["subject_practice", "online_mock_exam"]
}
```

### 6.2 去重策略

同一 `subject + syllabusVersion` 在短窗口内只保留一个 running/queued pipeline。

建议窗口：

- 开发阶段：10 秒。
- 线上阶段：30-60 秒。

如果短时间连续上传多个真题月份：

1. 第一份触发 pipeline。
2. 后续上传只更新 pending marker。
3. pipeline 结束前再检查一次是否有新 active document/source question。
4. 如有新变化，自动追加一轮 rebuild。

### 6.3 Pipeline 执行步骤

```text
Step 1: readiness scan
  - 检查大纲是否 applied。
  - 检查 active past paper source documents。
  - 检查 source questions 是否全部完成 auto profile。

Step 2: source auto profile
  - 若有 pending/retry_pending，启动或等待 source_question_auto_profile。
  - 未完成则 pipeline 保持 waiting，不进入下一步。

Step 3: refresh style profile
  - 对 subject scope 生成最新 csca_question_style_profiles。
  - 可选：对 topic scope 生成局部画像。

Step 4: generate exam series profile
  - 聚合所有 active past paper documents。
  - 写入 active csca_exam_series_profiles。
  - supersede 旧 active series profile。

Step 5: generate generation profiles
  - 生成 subject_practice generation profile。
  - 生成 online_mock_exam generation profile。
  - supersede 旧 active generation profiles。

Step 6: classify existing questions
  - 标记 current / legacy_usable / stale_needs_review / retired。
  - 旧题不删除。

Step 7: wake generation
  - 解除 readiness blocker。
  - 触发 subject practice predictive replenishment。
  - 触发 online mock exam coverage check。
```

### 6.4 失败处理

| 失败点 | 处理 |
|---|---|
| 缺大纲 | pipeline blocked，自动出题 blocked |
| 真题未解析完 | pipeline waiting，前端显示剩余题数 |
| 部分题 retry_pending | 自动重试；达到上限后要求人工治理 |
| 趋势画像生成失败 | generation profile 不更新，自动出题继续 blocked |
| generation profile 生成失败 | 自动出题 blocked |
| provider 并发失败 | task retry，不改变旧 active profile |

## 7. Readiness 升级

现有科目出题 readiness 应升级为：

```ts
type GenerationReadiness = {
  ready: boolean;
  subject: string;
  syllabusVersion: string;
  appliedSyllabus: boolean;
  sourceDocumentCount: number;
  sourceQuestionCount: number;
  approvedMappedQuestionCount: number;
  incompleteQuestionCount: number;
  activeSeriesProfileId: number | null;
  activeGenerationProfileId: number | null;
  useCase: 'subject_practice' | 'online_mock_exam';
  profileFreshness: 'fresh' | 'stale' | 'missing';
  blockingReason:
    | null
    | 'syllabus_missing'
    | 'source_profile_missing'
    | 'source_profile_incomplete'
    | 'series_profile_missing'
    | 'series_profile_stale'
    | 'generation_profile_missing'
    | 'generation_profile_stale';
};
```

### 7.1 Freshness 判断

`activeSeriesProfile` fresh 条件：

1. 覆盖当前所有 active past paper documents。
2. 覆盖当前所有 auto-approved source questions。
3. `syllabusSnapshotHash` 等于当前 applied syllabus hash。
4. `sourceSnapshotHash` 等于当前 source question snapshot。

`activeGenerationProfile` fresh 条件：

1. `seriesProfileId` 等于当前 active fresh series profile。
2. `useCase` 匹配。
3. `status = active`。
4. `sampleSize` 等于或小于 series profile sampleSize，但 source hash 一致。

### 7.2 自动出题阻断策略

科目训练：

```text
subject_practice generation readiness != ready
-> 不创建 production run
-> 不 enqueue generation jobs
-> 不 process queued jobs
-> 旧 running run 标记 blocked
```

在线模考：

```text
online_mock_exam generation readiness != ready
-> 不生成整卷蓝图
-> 不加载题位生成任务
-> 不装配草稿卷
```

## 8. 大纲更新影响

### 8.1 应用大纲后自动触发

`applySyllabusJsonImport` 成功后触发：

```text
enqueue source_profile_pipeline(action='syllabus_applied')
```

并立即执行：

1. supersede 当前 active generation profiles。
2. 标记相关旧 queued/running generation jobs 为 archived 或 failed non-retry。
3. 对旧题执行版本分类。
4. 自动出题 readiness 进入 blocked，直到 pipeline 完成。

### 8.2 不直接删除旧题

大纲更新后：

- 旧题如果 topic 仍存在，进入 `legacy_usable` 或 `stale_needs_review`。
- 旧题如果 topic 已归档，进入 `stale_needs_review`。
- 旧题如果人工确认仍适配，可回到 `legacy_usable`。
- 只有明确错误或不可维护时才 `retired`。

## 9. 真题新增月份影响

### 9.1 新增月份后是否一定重建画像

是。只要 active past paper source document 增加或重新解析，就必须重建：

1. style profile。
2. exam series profile。
3. generation profiles。

### 9.2 是否影响旧题

新增月份一般不使旧题无效。

旧题处理：

- 继续保留。
- lineage 显示旧 `seriesProfileId`。
- 若大纲不变，默认 `legacy_usable`。
- 新题使用新 `generationProfileId`。

### 9.3 是否触发补题

是，但不是盲目无限生成。

触发条件：

1. 新 generation profile 完成。
2. 科目题库当前 `current` 题不足。
3. 学生使用预测存在缺口。
4. 当前周期/团队周期仍处于 active。

## 10. 前端后台改造

### 10.1 画像状态区

增加“自动画像流水线”状态：

- 当前是否有 running pipeline。
- pipeline 当前阶段。
- 已解析题数。
- 未解析题数。
- 当前 active series profile。
- 当前 active generation profiles。
- 是否 stale。
- 阻塞自动出题的原因。

### 10.2 题库列表

候选题和已入库题展示：

- 版本状态。
- generation profile id。
- series profile id。
- 是否当前 active。
- 旧题是否可用。
- 若 stale，展示原因。

### 10.3 操作按钮

保留手动按钮，但语义调整：

- `重新构建画像流水线`
- `重新生成趋势画像`
- `重新生成当前出题画像`
- `复核旧题版本状态`

手动按钮用于故障恢复，不作为正常流程。

## 11. 实施步骤

### P0：后端 freshness 与版本标记

1. 增加 source snapshot hash 计算方法。
2. 增加 syllabus snapshot hash 计算方法。
3. generation profile 写入 snapshot 信息。
4. 生成题 metadata 写入完整 lineage。
5. 题目列表派生 `versionStatus`。

验收：

- 新题能看到 `generationProfileId` 和 `seriesProfileId`。
- 旧题能被识别为 `legacy_usable` 或 `unknown_legacy`。

### P1：自动画像流水线

1. 新增 `source_profile_pipeline` task。
2. 真题导入完成后自动 enqueue。
3. 自动画像任务完成后自动继续 pipeline。
4. 自动生成 series profile。
5. 自动生成两个 generation profiles。

验收：

- 上传新月份真题后，不点按钮也能产生新的 active series profile。
- 同时产生 `subject_practice` 和 `online_mock_exam` generation profiles。

### P2：自动出题 readiness 升级

1. 科目训练 readiness 要求 fresh generation profile。
2. 在线模考 readiness 要求 fresh online mock generation profile。
3. 缺失或 stale 时不 enqueue、不 process、不调用 provider。
4. 旧 running run 进入 blocked，并展示明确原因。

验收：

- 删除或 stale generation profile 后，自动出题不会启动。
- pipeline 完成后自动恢复。

### P3：旧题版本治理

1. 增加版本状态派生服务。
2. 学生端抽题默认优先 current。
3. current 不足时可使用 legacy_usable。
4. stale/retired/unknown 不进入学生侧。

验收：

- 后台可筛选 current 与 legacy_usable。
- 学生端不会抽到 stale_needs_review。

### P4：前端可视化

1. 画像流水线进度展示。
2. 趋势画像 freshness 展示。
3. 当前出题画像 freshness 展示。
4. 旧题版本状态展示。

验收：

- 管理员能看出“为什么自动出题还没启动”。
- 管理员能看出“新题使用的是哪个画像”。

## 12. 验收用例

### 用例 1：首次上传 2025-12 数学真题

预期：

1. source document active。
2. source questions 自动画像。
3. style profile 自动生成。
4. series profile 自动生成。
5. subject practice generation profile 自动生成。
6. online mock generation profile 自动生成。
7. 自动出题 readiness ready。

### 用例 2：新增 2026-01 数学真题

预期：

1. 旧 series profile superseded。
2. 新 series profile sourceDocumentIds 包含 2025-12 和 2026-01。
3. 新 generation profiles 引用新 series profile。
4. 旧题 versionStatus 变成 `legacy_usable`。
5. 新题 generationProfileId 为最新 active id。

### 用例 3：大纲更新

预期：

1. 自动出题立即 blocked。
2. source questions 重新映射。
3. 未完成前不会调用 provider。
4. 完成后生成新 series profile 和 generation profiles。
5. 自动出题恢复。

### 用例 4：画像中途失败

预期：

1. pipeline 显示 failed/waiting。
2. 自动出题 blocked。
3. 旧 active generation profile 不被误认为 fresh。
4. 管理员可点击重试 pipeline。

### 用例 5：旧题保留

预期：

1. 旧题没有被删除。
2. 后台能看到旧题 lineage。
3. 学生端仍可在题量不足时抽取 `legacy_usable`。
4. stale 旧题不会进入学生侧。

## 13. 强制工程约束与风险补丁

本章节是实施时必须满足的工程约束。若和前文流程描述存在优先级冲突，以本章节为准。

### 13.1 Snapshot 不得只停留在展示层

`sourceSnapshotHash` 和 `syllabusSnapshotHash` 是判断画像是否 fresh 的核心依据，不能只作为前端展示信息。

第一阶段可以写入 JSON：

- `csca_exam_series_profiles.trend_profile.sourceSnapshotHash`
- `csca_exam_series_profiles.trend_profile.syllabusSnapshotHash`
- `csca_generation_profiles.profile.sourceSnapshotHash`
- `csca_generation_profiles.profile.syllabusSnapshotHash`
- `csca_questions.generation_metadata.sourceSnapshotHash`
- `csca_questions.generation_metadata.syllabusSnapshotHash`

但服务端必须提供统一读取函数，禁止各处手写 JSON path。

建议后续迁移为独立字段：

- `source_snapshot_hash`
- `syllabus_snapshot_hash`
- `profile_fingerprint`

这样可以支持索引、唯一约束、快速 freshness 查询和后台排错。

### 13.2 Active 画像切换必须原子化

趋势画像和当前出题画像不得出现同一学科、同一大纲版本、同一 use case 下多个 active。

生成流程必须采用两阶段：

```text
生成 draft profile
-> 校验覆盖率、样本量、置信度、snapshot 一致性
-> 事务内 supersede 旧 active
-> 事务内激活新 active
```

禁止先把旧 active 置为 superseded，再生成新画像。否则画像生成失败时，自动出题会进入无画像状态。

事务边界：

1. 同一 `subject + syllabusVersion` 的 `csca_exam_series_profiles` 只能有一个 active。
2. 同一 `subject + syllabusVersion + useCase` 的 `csca_generation_profiles` 只能有一个 active。
3. 新 active 生效后才允许唤醒自动出题。

### 13.3 旧题状态必须影响学生端抽题

旧题版本状态不能只在后台列表派生展示，必须进入学生端抽题和模考装配过滤。

所有学生侧取题入口都必须遵守：

```text
允许：
- current
- legacy_usable
- manual_formal

禁止：
- stale_needs_review
- retired
- unknown_legacy
- pending_review
- review_failed
- archived
```

涉及入口至少包括：

- 科目训练普通抽题。
- 自适应训练抽题。
- AI Coach 推荐题。
- 在线模考草稿卷装配。
- 错题/复习推荐中引用 AI 题的入口。

如果第一阶段不新增 DB 字段，则必须提供统一的 `QuestionVersionGovernanceService` 派生状态，所有入口复用，不允许各处重复判断。

### 13.4 旧 queued/running 任务必须处理

大纲、真题画像、趋势画像或 generation profile 发生变化后，旧的 queued/running 生成任务不能继续静默执行。

处理规则：

| 任务状态 | 处理 |
|---|---|
| queued | 直接归档，原因 `profile_superseded` |
| retry_pending | 直接归档，原因 `profile_superseded` |
| running 但未调用 provider | 标记 blocked 或归档 |
| running 且已生成候选 | 允许完成审题，但候选标记 `legacy_generated_after_superseded`，不得自动入库 |
| completed | 按 lineage 重算版本状态 |

旧任务不得自动重绑到新 generation profile，除非任务还没有生成任何题，并且目标 topic/difficulty/cell 可以重新校验通过。

### 13.5 真题、模拟题、预测卷必须严格分源

趋势画像只能聚合真正的真题。

source document 画像流水线只接受：

- `past_paper`：真实考试真题。

模拟卷、预测卷、练习套题、资源套装不得写入 `csca_source_documents` 的画像流水线。它们可以留在各自资源模块或手工题库模块，但不能影响连续月份趋势画像和当前出题画像。

如果未来确实需要“风格参考”或“相似度参考”，必须另建隔离表，例如：

```json
{
  "includedAs": "reference_only",
  "notForTrendProfile": true
}
```

模拟卷可以作为相似度排重、题型参考或质量参考，但不得污染真实趋势画像。

### 13.6 同月重复卷、修订卷和双语卷需要 canonical grouping

同一考试月份可能存在：

- 英文卷。
- 中文卷。
- revised 修订版。
- errata 勘误版。
- 重复上传。

趋势画像聚合前必须先形成 canonical group：

```text
subject + examYear + examSession + paperCode
```

同组处理规则：

1. revised/errata 优先于原始版本。
2. 中文/英文若题目一致，只作为 localizations 或同源对照，不重复计入样本。
3. 重复上传不重复计入趋势样本。
4. 不能判定同源时，标记 `needs_source_group_review`，不进入趋势画像。

### 13.7 超纲和未映射不能导致死锁

真题可能出现大纲缺漏或超纲题。系统不能因为少量题无法映射而让整份真题画像永远无法完成。

source question 映射结果分为：

| 状态 | 含义 | 是否进入趋势画像 |
|---|---|---:|
| `mapped` | 已映射到 active syllabus topic | 是 |
| `out_of_syllabus_reference` | 真题疑似超纲，但可信 | 是，作为参考信号，不作为生成 topic |
| `mapping_low_confidence` | 低置信映射 | 可进入统计，但降低权重 |
| `unmapped_needs_review` | 无法判断 | 否 |
| `excluded_bad_source` | 原始题不可用 | 否 |

趋势画像可以记录超纲信号，但 generation profile 只能生成 active syllabus 中存在的 topic。

若超纲比例超过阈值，提示管理员检查大纲，而不是强行生成。

建议阈值：

- `out_of_syllabus_reference <= 10%`：允许继续。
- `10% - 25%`：允许继续，但后台强提醒。
- `> 25%`：阻断自动出题，要求检查大纲或真题来源。

### 13.8 画像流水线必须有阶段状态

前端不能只显示“已完成”。pipeline 必须暴露阶段级状态：

```text
source_imported
source_auto_profile_running
source_auto_profile_waiting_review
style_profile_building
series_profile_building
generation_profile_building
version_classification_running
ready
blocked
failed
```

每个阶段至少返回：

- 总数。
- 已完成数。
- 跳过数。
- 失败数。
- 阻塞原因。
- 最近错误。
- 是否还会自动继续。

这样可以避免“自动任务显示完成，但映射只完成 19/48”的前端错觉。

### 13.9 新画像质量门禁

新趋势画像不能生成后立刻替换旧画像，必须先通过质量门禁。

最低门禁：

1. active past paper 覆盖率达到 100%，或未覆盖项有明确排除原因。
2. mapped + out_of_syllabus_reference 覆盖率达到阈值。
3. 样本量不低于上一 active profile 的有效样本量，除非管理员强制重建。
4. generation profile target policy 不为空。
5. 两个 use case 的 generation profile 都能生成。

门禁失败时：

- 新画像保持 draft/failed。
- 旧 active 继续服务。
- 自动出题不切到新画像。
- 后台显示失败原因。

### 13.10 自动循环必须有限制

画像刷新和自动出题都不能无限循环。

画像流水线限制：

- 同一 `subject + syllabusVersion` 同一触发源最多连续重试 3 次。
- provider 失败不应反复重建画像。
- source 未完成时进入 waiting，不占用 provider。

自动出题限制：

- 每个 topic/difficulty/cell 有单独 attempt budget。
- 失败原因分软失败和硬失败。
- 硬失败不重复生成同类题。
- 软失败优先 revision，不是无限新建候选。

如果达到上限：

```text
run status = blocked
reason = no_progress_after_attempt_budget
```

必须停止自动增长候选题。

### 13.11 线上压力控制

画像流水线和出题任务必须分队列或至少分限流策略。

建议开发阶段：

- source profile pipeline 并发 1。
- generation profile build 并发 1。
- subject practice generation job 并发 1-2。
- online mock exam generation job 并发 1。

建议线上阶段：

- 按 provider key 池容量配置并发。
- 后台任务优先级低于学生交互请求。
- 自动补题只在低峰期扩大并发。

不能因为上传真题或自动补题拖慢学生答题、登录、练习提交接口。

### 13.12 回滚与恢复

必须支持以下恢复动作：

1. 回滚到上一 active trend profile。
2. 回滚到上一 active generation profile。
3. 重新执行 source profile pipeline。
4. 只重算旧题版本状态，不重新生成题。
5. 只归档旧 queued/running tasks。

回滚后：

- 新生成题不删除。
- 新生成题按 lineage 变成 `legacy_usable` 或 `stale_needs_review`。
- 自动出题重新读取当前 active generation profile。

### 13.13 必须补充的测试类型

除功能验收外，必须补以下测试：

1. 同一 use case 不会产生两个 active generation profile。
2. 新画像 draft 失败时旧 active 仍可用。
3. 大纲更新后旧 queued jobs 被归档，不继续调用 provider。
4. 学生端不会抽到 `stale_needs_review`。
5. 同月英文/中文卷不会重复计入趋势样本。
6. revised 卷优先于旧版卷。
7. 超纲比例低时不死锁，高时阻断自动出题。
8. 旧题 lineage 缺失时默认不进入学生端。
9. 在线模考题不会进入科目训练抽题。
10. 科目训练题不会进入在线模考装配。

## 14. 风险与控制

| 风险 | 控制 |
|---|---|
| 上传多份真题触发多次重建 | pipeline 去重和防抖 |
| 画像重建期间自动出题误启动 | readiness 强制检查 fresh generation profile |
| 旧题污染新统计 | versionStatus 区分 current 和 legacy |
| 旧题被误删 | 默认不删除，只退休 |
| provider 并发过高 | pipeline 与生成任务分队列、限流 |
| 大纲误更新导致全站无题 | legacy_usable 可作为缓冲，但 stale 不进入学生侧 |
| 多个 active 画像并存 | draft 校验后事务内切换 active |
| 模拟卷污染真题趋势画像 | sourceType 和 canonical group 强校验 |
| 未映射题导致流水线假完成 | 阶段状态展示 mapped/unmapped/out-of-syllabus |
| 自动循环无限增长候选 | attempt budget 和 no-progress blocker |

## 15. 开发完成定义

完成后必须满足：

1. 上传新月份真题后，不需要手动点击趋势画像按钮。
2. 新月份真题画像完成后，趋势画像自动更新。
3. 当前出题画像自动更新。
4. 新生成题使用最新 generation profile。
5. 大纲或真题画像未完整时，自动出题不启动。
6. 旧题不删除，并有版本状态。
7. 学生端不会抽到 stale 或 unknown legacy 题。
8. 后台可以看到画像流水线状态、出题画像版本、旧题版本状态。
9. 同一学科、同一大纲、同一 use case 不会出现多个 active generation profile。
10. 新画像失败不会破坏旧 active 画像。
11. 大纲或画像更新后，旧 queued/running 任务不会继续按旧画像入库。
12. 真题趋势画像不会混入 mock/prediction/practice source。
13. 未映射和超纲题有明确状态，不会让 pipeline 假完成或死锁。

## 16. 和现有文档关系

本方案补充并约束以下文档：

- `continuous-exam-series-generation-profile-executable-plan-2026-07-14.md`
- `source-paper-profile-visualization-executable-plan-2026-07-14.md`
- `ai-questioning-dual-line-executable-delivery-spec-2026-07-08.md`
- `subject-practice-one-click-production-completion-loop-2026-07-09.md`

若存在冲突，以本方案中的两条规则优先：

1. 新生成题必须使用最新 fresh generation profile。
2. 旧题保留但必须版本化治理，不得无标记混入新闭环。

## 17. 架构契合性审计与执行边界

本方案和现有架构是契合的，但必须按“复用现有表 + 增强 metadata + 补齐任务编排”的方式落地，不能把趋势画像、生成画像、题库治理重新做成另一套平行系统。

### 17.1 现有架构可直接复用的部分

| 能力 | 现有承载 | 本方案如何复用 |
|---|---|---|
| 真题文档 | `csca_source_documents` | 继续作为 source document 事实源 |
| 真题题目 | `csca_source_questions` | 继续承载单题画像、topic mapping、auto profile 状态 |
| 后台任务 | `csca_ai_questioning_tasks` | 新增 `source_profile_pipeline` task type，不新建独立任务表 |
| 单层画像 | `csca_question_style_profiles` | 作为单卷/局部画像参考层，不作为最终生成依据 |
| 连续趋势画像 | `csca_exam_series_profiles` | 作为多月份聚合后的趋势层 |
| 当前出题画像 | `csca_generation_profiles` | 作为科目训练和在线模考 AI 生成的唯一自动依据 |
| AI 题资产 | `csca_questions` | 继续承载候选、已入库、正式题，靠 metadata 区分用途和版本 |
| 科目训练题库 | 现有专项题库链路 | 只接收 `subject_practice` use case 的 current/legacy usable 题 |
| 在线模考题库 | 现有模考候选/装配链路 | 只接收 `online_mock_exam` use case 的 current/legacy usable 题 |

结论：不需要推翻现有架构。真正要补的是任务链路、freshness 判定、版本治理和前端可观测性。

### 17.2 必须新增或固化的逻辑边界

以下边界必须在代码层强制，而不能只靠前端提示：

1. `sourceType = past_paper` 才能进入 source document 画像流水线和连续真题趋势画像。
2. `mock_exam`、`prediction_paper`、`practice` 只能作为资源/套装/手工题资产存在，不能进入真实趋势样本；如需参考用途，必须另建隔离模块。
3. `subject_practice` 和 `online_mock_exam` 必须使用各自 use case 的 active generation profile。
4. 科目训练题和在线模考题不能共用同一个自动出题资产池。
5. 旧 queued/running 生成任务如果 lineage 不再 fresh，必须 blocked/archive，不能继续入库。
6. 学生端抽题必须过滤 `stale_needs_review`、`retired`、`unknown_legacy`。
7. 自动出题不得绕过 generation profile 直接读取单卷画像或 style profile。
8. 画像 pipeline 未 ready 时，自动补题只能等待，不能调用 provider 试生成。

### 17.3 目前方案仍需要重点防守的漏洞

| 漏洞 | 可能后果 | 必须补的控制 |
|---|---|---|
| 只更新 generation profile，但旧 running jobs 不停 | 旧画像题继续混入新题库 | task 启动和执行前都检查 freshness |
| 只看 active profile，不看 snapshot hash | active 画像可能实际已 stale | readiness 必须比较 source/syllabus snapshot |
| 同月中英文卷重复计样本 | 趋势画像权重被放大 | canonical group 去重 |
| revised/errata 和旧版同时 active | 画像重复或冲突 | 同组只选择 canonical winner |
| 未映射题被简单跳过 | 趋势画像偏差但后台误以为完成 | unmapped/out-of-syllabus 独立计数和阈值 |
| 旧题缺 lineage 仍进入学生端 | 学生抽到不可追溯题 | `unknown_legacy` 默认不进入学生端 |
| pipeline 显示 completed 但阶段未完成 | 管理员误判 | pipeline result 必须显示每阶段完成度 |
| provider 超时导致重复重建画像 | 浪费 key 和服务器资源 | provider 失败只 retry task，不切 active profile |
| 自动补题只按候选数量结束 | 候选无限增长，合格题不增 | 目标必须是 gate-passed/current 数量 |
| 前端整页刷新丢状态 | 管理员无法判断进度 | 板块级刷新和自动轮询 |

### 17.4 分阶段落地边界

为了减少一次改动过大，建议按以下顺序执行。每一阶段都必须可以独立构建通过。

#### Phase A：后端硬边界

目标：先保证不会用错画像、不会把错版本题发给学生。

必须完成：

1. generation profile 写入并读取 `sourceSnapshotHash`、`syllabusSnapshotHash`。
2. 科目训练和在线模考生成前检查 fresh generation profile。
3. 生成题写入 lineage 和 `versionGovernance.status`。
4. 学生端抽题过滤 stale/retired/unknown。
5. active profile 切换使用事务。

完成标准：

- 没有 fresh profile 时，不会调用 provider。
- 新题 metadata 能追溯到 generation profile 和 series profile。
- 学生端不能抽到 stale/unknown AI 题。

#### Phase B：自动画像流水线

目标：上传真题或重解析后自动形成最新趋势画像和两个出题画像。

必须完成：

1. 新增 `source_profile_pipeline` task。
2. 真题 JSON 导入成功后自动 enqueue。
3. 单题 auto profile 完成后自动推进 pipeline。
4. pipeline 自动生成/更新 series profile。
5. pipeline 自动生成 `subject_practice` 和 `online_mock_exam` generation profile。
6. pipeline result 暴露阶段级进度。

完成标准：

- 上传新月份真题后，不点手动按钮也会产生 active series profile。
- 两个 use case 的 active generation profile 都更新。
- 前端能看到卡在哪个阶段。

#### Phase C：旧题版本分类

目标：旧题保留，但使用边界清晰。

必须完成：

1. 按 lineage 派生 version status。
2. 大纲或真题画像更新后批量重算旧题版本状态。
3. 后台支持按版本状态筛选。
4. 旧 queued/running task 按 profile 变更归档或阻断。

完成标准：

- 新画像上线后，旧题不会无标记混入 current。
- 管理员能看到旧题为什么还能用或为什么被阻断。

#### Phase D：前端可观测和恢复工具

目标：让管理员看得懂、能恢复、能验证。

必须完成：

1. 画像流水线阶段状态。
2. active series/generation profile 展示。
3. source snapshot / syllabus snapshot 简化展示。
4. 重新执行 pipeline。
5. 回滚 active generation profile。
6. 归档旧任务。

完成标准：

- 管理员能判断“自动出题为什么没启动”。
- 管理员能判断“这道题基于哪个画像生成”。
- 出错后可恢复，不需要直接改数据库。

### 17.5 不建议做的事情

以下做法会破坏架构清晰度，应避免：

1. 不要为科目训练和在线模考再复制两套 source document 表。
2. 不要让前端手动按钮成为正常业务流程。
3. 不要用候选题数量作为自动生成完成条件。
4. 不要为了提高通过率降低门禁。
5. 不要把模拟卷当真题趋势样本。
6. 不要直接删除旧题来解决版本问题。
7. 不要让旧 task 在 profile 变更后继续执行。
8. 不要让 generation profile 失败时覆盖旧 active profile。

### 17.6 最小数据库改动建议

开发阶段可以先把多数信息写进 JSON metadata，但以下字段若后续查询变慢，应提升为正式列：

| 字段 | 建议表 | 原因 |
|---|---|---|
| `source_snapshot_hash` | `csca_exam_series_profiles`, `csca_generation_profiles` | 快速判断 freshness |
| `syllabus_snapshot_hash` | `csca_exam_series_profiles`, `csca_generation_profiles` | 大纲更新后快速阻断 |
| `version_status` | `csca_questions` | 学生端抽题过滤和索引 |
| `target_use_case` | `csca_questions` | 防止科目题和模考题混用 |
| `source_canonical_group_id` | `csca_source_documents` | 同月重复卷、修订卷、双语卷去重 |
| `pipeline_stage` | `csca_ai_questioning_tasks` 或 task result JSON | 前端展示阶段进度 |

第一阶段可不立刻迁移，但代码必须把这些值稳定写入 metadata，避免后续无法回填。

### 17.7 上线前必须通过的架构验收

上线前除了构建和单元测试，还必须做以下端到端验收：

1. 上传 1 份真实数学真题，能自动完成单题画像、趋势画像和两个 generation profile。
2. 再上传同科目新月份真题，旧 profile 被 supersede，新 profile 覆盖两个月份。
3. 上传模拟卷，不能进入 past paper 趋势画像。
4. 同月 revised 卷上传后，只计 revised，不重复计旧版。
5. generation profile stale 后，科目训练和在线模考都不会继续生成。
6. stale 题不会出现在学生端抽题结果。
7. current 题不足时，自动补题目标是合格入库数量，而不是候选数量。
8. provider 超时不会导致 active profile 被替换。
9. pipeline 中断重启后能恢复或进入可见 blocked 状态。
10. 管理员能从前端看到每个阶段的完成数、失败数、阻塞原因。

### 17.8 当前结论

方案整体方向是正确的，也和现有架构契合。最大风险不是数据模型不适配，而是“自动流水线”和“版本治理”如果只做一半，会出现以下问题：

1. 看起来有 active 画像，但实际不是 fresh。
2. 看起来有候选题，但没有合格 current 题。
3. 看起来 pipeline 完成，但仍有未映射题。
4. 看起来旧题还可用，但学生端无法判断版本风险。

因此执行时必须优先完成后端硬边界，再做自动化和前端展示。只要按 Phase A 到 Phase D 推进，这套方案可以落地，不需要推翻现有系统。

## 18. 架构漏洞关闭清单

本节用于把方案从“方向正确”补到“执行可控”。后续开发时，每一项都应能在代码、接口或验收脚本中找到对应落点。

### 18.1 必须由后端强制的规则

以下规则不能只靠前端文案或按钮禁用：

1. 自动生成任务启动前，必须读取 active generation profile，并校验：
   - `useCase` 与任务目标一致。
   - `status = active`。
   - `sourceSnapshotHash` 等于当前 active past paper source snapshot。
   - `syllabusSnapshotHash` 等于当前 applied syllabus snapshot。
2. 生成任务执行每一道题前，也要再次校验 freshness。原因是任务可能排队很久，排队期间大纲或真题画像可能已经变化。
3. 自动入库或装配前，必须检查题目 metadata 中的 `targetUseCase`：
   - `subject_practice` 只能进入科目训练正式资产池。
   - `online_mock_exam` 只能进入在线模考候选池/草稿卷装配。
4. 学生端抽题必须过滤：
   - `stale_needs_review`
   - `retired`
   - `unknown_legacy`
5. 若题目缺少 `generation_metadata.versionGovernance.status`，默认按 `unknown_legacy` 处理，不允许学生端直接抽取。
6. 画像流水线只能聚合 `sourceType = past_paper` 且 `status = active` 的 source document。
7. `mock_exam`、`prediction_paper`、`practice` 不得进入真实连续月份趋势画像。
8. active generation profile 切换必须在事务内完成：
   - 先生成 draft。
   - draft 校验通过。
   - supersede 旧 active。
   - 激活新 active。
   - 任何一步失败都保留旧 active。

### 18.2 自动流水线不能假完成

`source_profile_pipeline` 不能只用 task status 展示“完成”。它必须在 `result` 中持续写入阶段级完成度。

推荐阶段结构：

```json
{
  "stage": "series_profile_building",
  "subject": "math",
  "syllabusVersion": "2025",
  "source": {
    "documentCount": 4,
    "questionCount": 192,
    "autoApprovedCount": 188,
    "excludedCount": 4,
    "pendingCount": 0
  },
  "mapping": {
    "mappedCount": 188,
    "unmappedCount": 0,
    "outOfSyllabusCount": 0,
    "lowConfidenceCount": 0
  },
  "profiles": {
    "styleProfile": "succeeded",
    "seriesProfile": "running",
    "subjectPracticeGenerationProfile": "pending",
    "onlineMockExamGenerationProfile": "pending"
  }
}
```

状态语义：

| 状态 | 含义 | 是否可启动自动出题 |
|---|---|---:|
| `queued` | 等待执行 | 否 |
| `running` | 正在执行某阶段 | 否 |
| `waiting` | 等待单题画像或映射子任务完成 | 否 |
| `blocked` | 有可解释阻塞，需人工或上游修复 | 否 |
| `succeeded` | 所有必需阶段完成，generation profile fresh | 是 |
| `failed` | 非预期异常 | 否 |

特别规则：

1. 如果存在较新的 `succeeded` pipeline，旧的 `waiting` task 不能遮盖前端状态。
2. 如果 `waiting` 超过合理时间，前端要显示“等待已超时”，后端恢复扫描要么重新唤醒，要么标记 blocked。
3. “已完成”必须等价于两个 use case 的 active generation profile 都 fresh。

### 18.3 未映射与疑似超纲题的处理

真题题目映射不完整时，不能简单判定为系统失败，也不能假装画像完整。

建议分四类：

| 类型 | 识别条件 | 处理方式 | 是否阻塞趋势画像 |
|---|---|---|---:|
| `mapped` | 匹配 active syllabus topic，置信度达标 | 进入趋势画像 | 否 |
| `low_confidence_mapping` | 有候选 topic，但置信度不足 | 进入待复核；可按低权重暂不计入 | 视比例 |
| `out_of_syllabus_candidate` | 真题明显考到大纲未覆盖内容 | 标记疑似超纲/大纲缺口 | 视比例 |
| `unmapped_invalid` | 题干缺失、结构错误、无法分析 | 排除并计入异常 | 否，除非比例过高 |

阻塞阈值建议：

1. `mapped / total >= 90%`：允许生成趋势画像，但前端展示缺口。
2. `mapped / total < 90%`：阻塞 generation profile 自动激活，需要先处理映射缺口。
3. `out_of_syllabus_candidate > 0`：不自动写入大纲，但必须在后台形成“大纲缺口建议”。
4. 单份真题少量题无法映射，不应导致整条流水线永久死锁；应有明确 blocked reason 和人工处理入口。

### 18.4 旧题版本分类批处理

每次 active generation profile 切换后，必须触发一次旧题版本分类批处理。

分类输入：

1. 当前 active generation profile。
2. 当前 active series profile。
3. 当前 applied syllabus snapshot。
4. 题目 `generation_metadata` 中的 lineage。
5. 题目质量状态、门禁状态、用途 `targetUseCase`。

分类输出：

| 输出状态 | 判定规则 |
|---|---|
| `current` | generationProfileId、sourceSnapshotHash、syllabusSnapshotHash 均匹配当前 active |
| `legacy_usable` | lineage 完整，topic 仍在当前大纲，质量门禁仍通过，但画像不是当前版本 |
| `stale_needs_review` | topic 变化、画像变化较大、门禁规则升级或用途不明确 |
| `retired` | 题目被明确下架、topic 已归档且不可映射、质量硬伤 |
| `unknown_legacy` | 缺少 lineage 或 metadata 不足以判断 |

批处理完成后必须写回 `generation_metadata.versionGovernance`，而不是只在查询时临时推断。这样后台、学生端和后续脚本才能用同一套口径。

### 18.5 旧任务归档与中断恢复

大纲或真题画像更新后，旧 queued/running 生成任务存在最大污染风险。

处理规则：

1. 生成任务启动时记录 `generationProfileId`、`sourceSnapshotHash`、`syllabusSnapshotHash`。
2. 每次 worker 取任务时重新比较当前 active snapshot。
3. 如果 snapshot 不一致：
   - 未开始的任务标记 `archived_stale_profile`。
   - 运行中的任务在下一个题位前停止。
   - 已生成但未入库候选标记 `stale_needs_review`。
4. 服务重启后恢复扫描不能盲目继续 old running task，必须先做 freshness audit。
5. stale task 不进入自动重试队列，避免旧画像反复唤醒。

### 18.6 前端必须展示的最小信息

为了让管理员能判断“为什么不生成”“为什么生成结果不对”，前端至少展示：

1. 当前学科 active syllabus version。
2. active past paper document 数量和月份范围。
3. 单题画像进度：总数、已通过、待处理、低置信、排除。
4. 趋势画像状态：是否 fresh、覆盖几份真题、覆盖多少题。
5. 两个 generation profile 状态：
   - `subject_practice`
   - `online_mock_exam`
6. pipeline 当前阶段、更新时间、阻塞原因。
7. 自动出题 readiness：
   - ready / blocked。
   - blocked reason。
   - 需要的下一步。
8. 旧题版本分布：
   - current。
   - legacy_usable。
   - stale_needs_review。
   - retired。
   - unknown_legacy。

### 18.7 上线执行顺序

实际开发建议按以下顺序合并，避免半成品污染线上：

1. 先合并后端硬边界：freshness 校验、useCase 隔离、学生端过滤。
2. 再合并 pipeline 编排：上传/画像完成/大纲应用后自动触发。
3. 再合并前端观测：让状态可见，尤其是 blocked reason。
4. 再合并旧题批处理：让历史数据进入统一版本状态。
5. 最后开启全自动唤醒：让科目训练和在线模考自动按最新画像补题。

如果某阶段失败，必须能停在上一阶段的安全状态：

- 没有 fresh profile：不生成。
- pipeline 失败：旧 active profile 继续可用。
- 旧题分类失败：学生端只使用已有 current/legacy usable，不放开 unknown。

### 18.8 需要补充的测试

现有构建通过不等于方案完成。至少需要补以下测试：

1. 真题上传触发测试：上传 past paper JSON 后，自动创建 source profile pipeline，单题画像完成后 pipeline 继续推进。
2. 模拟卷隔离测试：真题画像上传入口收到 `sourceType = mock_exam` 时直接拒绝，不创建 source document，也不进入 continuous past paper trend profile。
3. freshness 阻断测试：修改大纲 snapshot 后，旧 generation profile 变 stale，科目训练和在线模考生成任务不调用 provider。
4. active profile 事务测试：新 profile 生成失败时，旧 active profile 仍保持 active。
5. 旧题过滤测试：`unknown_legacy`、`stale_needs_review` 不出现在学生抽题结果。
6. pipeline 状态测试：存在旧 waiting task 和新 succeeded task 时，前端摘要展示最新有效状态，不被旧 waiting 遮盖。
7. 未映射阈值测试：少量未映射可生成趋势画像并展示缺口，大量未映射阻塞 generation profile 激活。
8. 任务中断恢复测试：running task 遇到服务重启后，恢复时先审计 snapshot，stale task 不继续入库。

### 18.9 最终判断

补齐以上清单后，这套方案才算真正完备。它不会破坏现有架构，但会把现有“手动按钮 + 局部画像 + 生成任务各自判断”的模式，升级成“事实源驱动 + 画像版本驱动 + 题目版本治理”的模式。

当前最大漏洞不是缺表，而是缺少强一致的状态机。只要把 freshness、pipeline stage、versionGovernance 三个状态机做扎实，后续新增月份真题、更新大纲、扩展 provider 或清理旧题，都可以在同一架构里自然演进。

## 20. 现有实现审计后的补强要求

本节是对当前代码实现的落地审计结论，用来回答“方案是否契合架构、是否还有漏洞和风险”。结论是：整体契合现有架构，不需要重建题库或重做上传链路；但必须补齐以下硬边界，否则会继续出现“前端显示完成但画像未完整”“候选题增长但正式题不增长”“在线模考和科目训练混用画像”的问题。

### 20.1 已契合的部分

当前架构已经具备可承接本方案的基础：

1. `csca_source_documents` / `csca_source_questions` 已能承载真题 JSON 和单题画像。
2. `source_profile_pipeline` 已接入 `csca_ai_questioning_tasks`，不需要新增独立任务表。
3. pipeline 已能按学科生成：
   - subject style profile。
   - exam series profile。
   - `subject_practice` generation profile。
   - `online_mock_exam` generation profile。
4. `csca_generation_profiles.use_case` 已能区分科目训练和在线模考。
5. AI 题的 `generation_metadata` 已能写入 lineage 与 `versionGovernance`。
6. 题库查询已开始支持 `versionStatus` 过滤。
7. 在线模考装配链路已能识别 `targetUseCase = online_mock_exam`，具备隔离基础。

因此本方案不是推翻现有系统，而是把已有模块之间的“手动/松散衔接”升级为“事件驱动/强状态衔接”。

### 20.2 当前仍不完整的代码落点

以下缺口必须进入执行清单：

| 缺口 | 当前风险 | 必须修复 |
|---|---|---|
| pipeline action 不完整 | `source_document_reprofiled`、`syllabus_applied`、`startup_reconcile` 若只存在类型、不存在真实触发，会导致上传/重解析/重启后画像不推进 | action union、重解析入口、大纲应用入口、启动恢复扫描都必须有真实触发，并由规则测试防回归 |
| pipeline 去重漏掉 waiting | `waiting` 任务可能重复堆积，或旧 waiting 遮盖新 succeeded | 去重必须纳入 waiting，并按最新有效 task 展示 |
| pipeline succeeded 未强校验两个画像 fresh | 可能“生成过画像”就显示完成，但实际 generation profile 不 fresh | succeeded 前调用 readiness 校验两个 use case |
| pipeline result 未落版本治理摘要 | 前端不知道旧题治理是否执行成功 | result 写入 `versionGovernance.subjectPractice/onlineMockExam` |
| 科目训练 readiness 已有但只覆盖 `subject_practice` | 在线模考仍可能走旧 fallback | 抽象为通用 `generationReadinessForUseCase` |
| 在线模考仍可 fallback 到 style profile | 自动模考可能绕过最新趋势画像 | 自动生成/装配必须要求 `online_mock_exam` active generation profile fresh |
| freshness 只比对 series profile id | source/syllabus snapshot 变化可能未被识别 | active profile 必须比对 `sourceSnapshotHash` 和 `syllabusSnapshotHash` |
| 旧 queued/running 任务未统一归档 | 大纲/真题更新后旧任务可能继续入库 | worker 取任务前执行 snapshot audit |
| 学生端过滤不应只靠后台展示 | unknown/stale 题可能被抽到 | 抽题 SQL/服务层强制过滤 versionGovernance |

### 20.3 必须形成的后端状态机

后端必须把三条状态机分开，但互相引用：

```text
source_profile_pipeline
  -> 控制真题画像、趋势画像、当前出题画像是否完整

generation_readiness
  -> 控制某个 useCase 是否允许启动自动出题

question_version_governance
  -> 控制已生成题是否可被学生端消费
```

三者关系：

1. pipeline 不 ready，readiness 必须 blocked。
2. readiness 不 ready，worker 不得调用 provider。
3. generation profile 切换后，version governance 必须重算。
4. version governance 未落库时，学生端按 `unknown_legacy` 保守处理。

### 20.4 在线模考的特殊硬边界

在线模考不是“科目训练题的另一种展示”，它有独立完成条件：

1. 只能读取 `use_case = online_mock_exam` 的 active generation profile。
2. 每套卷必须以 48 个题位为目标。
3. 每个题位必须有 1 道 `current` 且门禁通过的题。
4. 48/48 未完成前，状态不能显示整套完成。
5. 已通过门禁但未装配的题必须自动装配，不能长期停在候选池。
6. 自动模考不得 fallback 到 `csca_question_style_profiles`，否则会绕过连续月份趋势画像。

允许保留手工模考题库，但它是另一条人工渠道；AI 自动模考链路必须从趋势画像和 `online_mock_exam` generation profile 出发。

### 20.5 科目训练的特殊硬边界

科目训练不是“生成若干候选题就结束”，它必须按库存矩阵完成：

```text
topic
  × difficulty
  × questionForm
  × cognitiveSkill
  × readingLoad
  × calculationLoad
```

一次自动补题的完成条件：

1. 目标知识点全部扫描。
2. 每个目标 cell 达到预设合格题数量。
3. 难度比例达到配置目标。
4. 已入库题和可用旧题计入库存，但 stale/unknown 不计入。
5. 如果某个 cell 连续失败达到阈值，标记 cell blocked，而不是无限生成。

这和在线模考的区别是：

| 项 | 科目训练 | 在线模考 |
|---|---|---|
| 目标单位 | 库存 cell | 48 个卷面题位 |
| 完成标准 | 每个 cell 达标 | 48/48 题位可装配 |
| 生成题用途 | `subject_practice` | `online_mock_exam` |
| 是否组卷 | 不组整卷 | 必须装配成草稿卷 |

### 20.6 真题月份趋势画像的触发要求

新增或更新任意 active past paper 后，不允许只更新单卷卡片。必须自动触发：

1. 单题画像/映射补齐。
2. trend series profile 重建。
3. 两个 use case generation profile 重建。
4. 旧题 versionGovernance 批处理。
5. readiness 重新计算。
6. 自动补题唤醒。

如果上传的是 `mock_exam`、`prediction_paper` 或其他非真题来源：

1. 真题画像上传入口必须拒绝。
2. 可以走资源库或模考资源展示的独立入口。
3. 不得进入连续月份真题趋势画像，也不得影响正式 generation profile freshness。

### 20.7 大纲与真题不一致时的规则

真题优先作为事实源，大纲作为生成边界。若两者不一致：

1. 不强行把真题题目映射到错误 topic。
2. 不直接扩写大纲。
3. 形成 `out_of_syllabus_candidate` 或 `syllabus_gap_suggestion`。
4. 低比例缺口允许趋势画像继续生成，但生成画像不得把缺口 topic 作为正式生成目标。
5. 高比例缺口阻塞 generation profile 激活，提示先修大纲或修映射。

这能避免两种极端：

- 把真题中真实存在的考点静默丢掉。
- 让 AI 自动生成系统随意生成大纲外题目。

### 20.8 对服务器压力的影响与保护

该方案会增加后台任务，但不应显著增加学生端压力。原因是：

1. 画像与治理都在后台异步执行。
2. 学生端只读 current/legacy usable 题，不等待画像生成。
3. pipeline 有幂等键和去重，不会因刷新页面重复跑。
4. provider 调用只发生在 readiness 通过后。

必须加入的保护：

| 风险 | 保护 |
|---|---|
| 上传多份真题导致任务风暴 | subject + syllabus + sourceSnapshot 幂等 |
| provider 并发爆掉 | provider/key 池 + 队列限流 |
| 映射不完整无限重试 | mapping coverage 阈值 + blocked reason |
| 某个 cell 永远生成不合格 | cell blocked + 失败样本分析 |
| 前端轮询压力 | 后台状态摘要接口 + 5-10 秒轮询 |
| 旧题治理批量更新压力 | 分批 limit + 游标 + 可恢复 task |

开发阶段可以阈值宽一些、轮询频繁一些；上线后再把并发、轮询和批处理窗口收紧。

### 20.9 执行优先级更新

为了让方案真正闭环，执行顺序调整为：

1. **强制 useCase 隔离与 freshness 校验**
   - 科目训练、在线模考都必须读取对应 use case 的 active fresh generation profile。
   - 禁止自动链路 fallback 到 style profile。

2. **修正 pipeline 完成语义**
   - waiting/blocked/succeeded 状态必须和映射覆盖、趋势画像、两个 generation profiles 一致。
   - 前端不能显示“完成但 19/48 映射”。

3. **补齐 versionGovernance 落库**
   - generation profile 激活后自动重算。
   - 学生端抽题强制过滤。

4. **归档 stale 任务**
   - 大纲或真题 snapshot 变化后，旧任务不能继续执行或入库。

5. **前端观测**
   - 显示 source/profile/generation/version 四层状态。
   - “刷新进度”和“触发生成”按钮分开。

6. **最后开启全自动补题**
   - 科目训练按库存矩阵补。
   - 在线模考按 48 题位补。

### 20.10 最小可验收标准

本方案执行完成后，至少满足以下验收：

1. 上传 2025-12 数学真题后，不点手工按钮也能自动推进到两个 active generation profiles。
2. 上传 2026-01 数学真题后，趋势画像版本变化，新题使用新 profile，旧题变 `legacy_usable` 或 `stale_needs_review`。
3. 上传模拟卷不会影响 past paper trend profile。
4. 数学真题若只有 19/48 映射，pipeline 不显示 completed。
5. 在线模考如果缺 `online_mock_exam` fresh profile，不能生成题位候选。
6. 科目训练如果缺 `subject_practice` fresh profile，不能启动自动补题。
7. 学生端抽题不会出现 `unknown_legacy` 或 `stale_needs_review`。
8. 旧 running task 在 snapshot 变化后被归档，不会继续把旧画像题入库。
9. 前端能看到 blocked reason 和下一步建议。
10. 后台构建、前端构建、规则脚本均通过。

### 20.11 本轮补强后的执行状态基线

方案与当前架构契合，但不能只做前端提示或按钮串联。真正需要落地的是后端强状态机：

```text
source profile pipeline 完整
-> generation readiness fresh
-> question version governance 落库
-> 学生端只消费安全状态
```

如果这四步少任意一步，都会重新出现之前的问题：候选无限增长、正式题不增长、画像看似完成但实际未映射、或者科目训练和在线模考混用题。后续实现应以本节作为硬验收清单。

#### 20.11.1 自动触发入口

以下事件必须进入同一条 `source_profile_pipeline`，不能各自生成画像：

| 事件 | pipeline action | 要求 |
|---|---|---|
| 导入 active past paper JSON | `source_document_imported` | 导入后立即启动单题画像，并创建 pipeline；pipeline 等待单题画像完成后继续 |
| 重新解析 active past paper | `source_document_reprofiled` | 重置单题映射后必须重新进入 pipeline，不能只更新当前文档卡片 |
| 删除 active past paper 源卷 | `source_document_deleted` | 归档旧单卷/趋势/出题画像后，若同学科同大纲仍有剩余 active 真题源卷，必须自动重建趋势画像和两个 use case 出题画像 |
| 应用整份大纲 JSON | `syllabus_applied` | 大纲 snapshot 更新后必须重建趋势画像和两个 use case 出题画像 |
| 更新单个/批量大纲 topic | `syllabus_applied` | 单点治理也必须触发 pipeline；批量更新依赖去重避免任务风暴 |
| 服务重启 | `startup_reconcile` | 扫描已有 active past paper + syllabusVersion，恢复未完成的画像流水线 |
| 单题自动画像完成 | `source_auto_profile_completed` | pipeline 从 waiting 恢复，继续构建趋势画像、出题画像和版本治理 |

#### 20.11.2 pipeline 完成条件

`source_profile_pipeline.status = succeeded` 只能表示“整条链路可用于出题”，不能只表示“任务跑完”。

必须同时满足：

1. 有 active past paper source document。
2. 有对应 subject + syllabusVersion 的已应用大纲。
3. 单题画像没有 pending/processing/retry_pending。
4. 自动通过样本数量大于 0。
5. 映射覆盖率达到阈值。
6. 已生成/激活 subject style profile。
7. 已生成/激活 exam series trend profile。
8. 已生成/激活 `subject_practice` generation profile。
9. 已生成/激活 `online_mock_exam` generation profile。
10. 两个 use case 的 readiness 都为 ready。
11. question version governance 已重算，并写入 pipeline result。

任何一项不满足，都必须进入 `blocked` 或 `waiting`，并写清楚 `reason`。

#### 20.11.3 与现有架构的契合结论

当前方案继续使用现有核心表：

- `csca_source_documents`
- `csca_source_questions`
- `csca_ai_questioning_tasks`
- `csca_exam_series_profiles`
- `csca_generation_profiles`
- `csca_questions`

不新增平行题库、不新增平行画像系统，也不改变手工题库入口。架构变化集中在编排层：

```text
source document / syllabus event
  -> source_profile_pipeline
  -> source question auto profile
  -> subject style profile
  -> exam series trend profile
  -> subject_practice generation profile
  -> online_mock_exam generation profile
  -> question version governance
  -> readiness gates
  -> subject practice / online mock generators
```

这说明方案与当前架构契合；主要风险不是表结构不适配，而是事件触发、状态展示和消费侧过滤漏接。

#### 20.11.4 仍需继续跟进的风险

即使后端自动触发已补齐，仍需继续跟进以下项：

1. 前端必须展示 pipeline 的阶段进度，不应只显示“已完成/未完成”。
2. 真题映射覆盖不足时，要区分“大纲缺口”和“映射算法置信度不足”。
3. 趋势画像图表必须能看出每个月份真题对总画像的贡献。
4. 学生端抽题必须持续过滤 `unknown_legacy` 和 `stale_needs_review`。
5. 自动补题必须有 cell blocked，避免长期 provider 循环。
6. provider/key 池上线前，后台自动补题并发必须保持保守。

#### 20.11.5 防回归测试要求

后续每次改画像、出题或题库消费链路，至少运行：

```bash
npm run backend:build
npm run csca-generation-profile:rules
```

规则测试必须覆盖：

1. `source_document_imported` 触发存在，active past paper JSON 导入后必须进入主 pipeline。
2. `source_document_reprofiled` 触发存在。
3. `source_auto_profile_completed` 触发存在，单题画像完成后必须能恢复 waiting pipeline。
4. `syllabus_applied` 触发存在。
5. `startup_reconcile` 触发存在。
6. pipeline 去重包含 `waiting`。
7. pipeline succeeded 前校验 `subject_practice` 和 `online_mock_exam` readiness。
8. 前端 source summary 和 pipeline 详情必须把未映射、低置信、疑似超纲分开展示，并显示 `mapping.gapReason` 对应的下一步动作。
9. 学生端只消费 `current` / `legacy_usable` AI 题。

## 19. 补强版落地蓝图

本节补齐“如何实际改代码、如何避免漏洞、如何验收”的执行细节。它不是新增一套平行架构，而是把现有 AI 题库、源卷画像、生成任务和学生端抽题串成一个稳定闭环。

### 19.1 与现有架构的契合边界

继续复用现有主链路：

| 能力 | 现有承载 | 本方案处理 |
|---|---|---|
| 真题事实源 | `csca_source_documents` / `csca_source_questions` | 保持原始 JSON 不变，只补画像、映射和 lineage |
| 单卷画像 | `csca_question_style_profiles` / source question analysis | 作为基础样本层，不再直接驱动正式自动出题 |
| 连续月份趋势画像 | `csca_exam_series_profiles` | 作为聚合层，自动由 active past paper 更新 |
| 当前出题画像 | `csca_generation_profiles` | 作为唯一正式生成入口，按 use case 分开 |
| 生成任务 | existing AI generation jobs / bulk tasks | 启动和执行前加入 freshness 审计 |
| AI 题资产 | `csca_questions.generation_metadata` | 写入 lineage 和 `versionGovernance` |
| 学生端抽题 | 科目训练 / 在线模考现有服务 | 只抽 current / legacy_usable / 手工正式题 |

不新增“另一套题库”。所有 AI 题仍进入现有题表，只通过 `targetUseCase`、`generationProfileId`、`versionGovernance.status` 区分来源和可用范围。

### 19.2 事件触发矩阵

所有自动刷新都必须由后端事件触发，前端按钮只能作为手动补救入口。

| 事件 | 触发动作 | 幂等键 | 失败后状态 |
|---|---|---|---|
| 导入 `past_paper` source document | 创建或唤醒 source profile pipeline | `source-profile:{subject}:{syllabus}:{sourceSnapshotHash}` | `blocked/import_invalid` |
| 单题画像任务完成 | 继续 pipeline scan；若全部完成则生成趋势画像 | `source-profile:{subject}:{syllabus}:{sourceSnapshotHash}` | `waiting` 或 `blocked` |
| 重新解析映射 | 重新计算 mapping coverage；必要时重建趋势画像 | `source-profile:{subject}:{syllabus}:{sourceSnapshotHash}` | `blocked/source_mapping_coverage_low` |
| 应用新版大纲 | 标记旧画像 stale；重跑映射；暂停自动出题 | `syllabus-refresh:{subject}:{syllabusSnapshotHash}` | `blocked/syllabus_mapping_required` |
| active source document 状态变化 | 重算 source snapshot；重建趋势画像和出题画像 | `source-profile:{subject}:{syllabus}:{sourceSnapshotHash}` | 保留上一 active profile |
| 新趋势画像通过门禁 | 生成两个 generation profiles | `generation-profile:{subject}:{syllabus}:{seriesProfileId}` | 保留上一 active profile |
| active generation profile 切换 | 旧题 versionGovernance 批处理；归档旧任务 | `version-governance:{subject}:{useCase}:{generationProfileId}` | 学生端不放开 unknown |

所有任务都要满足“同一 subject + syllabusVersion + snapshot 同时只能有一个 active/running pipeline”。重复触发只更新 `updatedAt` 或追加日志，不创建无限任务。

### 19.3 Pipeline 完成判定

`source_profile_pipeline` 的 `succeeded` 必须同时满足：

1. 参与聚合的 active past paper source documents 数量大于 0。
2. active source questions 均处于以下之一：
   - `mapped`
   - `low_confidence_mapping`
   - `out_of_syllabus_candidate`
   - `excluded`
3. `mapped / total >= 90%`。
4. `out_of_syllabus_candidate` 已写入大纲缺口建议，不被静默忽略。
5. 新 series profile 通过质量门禁。
6. `subject_practice` generation profile 生成成功并 fresh。
7. `online_mock_exam` generation profile 生成成功并 fresh。
8. 旧 active profile 已被事务性 supersede。

任何条件不满足，都不能返回“已完成”。应返回 `blocked` 或 `waiting`，并在 `result.reason` 中写明：

| reason | 含义 | 管理员下一步 |
|---|---|---|
| `source_profile_pending` | 还有单题画像未完成 | 等待或重试画像任务 |
| `source_mapping_coverage_low` | 映射覆盖不足，且主要不是低置信或疑似超纲 | 查看未映射题，修大纲或修映射 |
| `low_confidence_mapping_review_required` | 低置信映射是当前主要缺口 | 优先复核低置信映射，必要时调整映射提示或手工确认 |
| `out_of_syllabus_review_required` | 疑似超纲/大纲缺口是当前主要缺口 | 进入大纲缺口建议，确认是真题超纲、缺大纲 topic，还是 JSON 画像错误 |
| `series_profile_quality_gate_failed` | 趋势画像质量不足 | 增加真题月份或排除异常源卷 |
| `generation_profile_build_failed` | 当前出题画像生成失败 | 检查 provider 或画像输入 |
| `multiple_active_profiles` | active 画像冲突 | 后台治理 active 状态 |

### 19.4 真题超纲与大纲缺口处理

真题如果考到了大纲中没有的内容，不应强行映射，也不应阻塞成死循环。

处理策略：

1. 若题目能明确归入现有 topic，标记 `mapped`。
2. 若题目和现有 topic 接近但置信度不足，标记 `low_confidence_mapping`，进入人工复核。
3. 若题目明显是真题有效题，但大纲缺 topic，标记 `out_of_syllabus_candidate`，写入“大纲缺口建议”。
4. 若题目结构坏、答案缺失、无法分析，标记 `unmapped_invalid` 或 `excluded`。

`out_of_syllabus_candidate` 不进入 generation profile 的可生成 topic，但会进入趋势画像诊断，提示“真题可能覆盖了当前大纲缺失内容”。这样既尊重真题，又避免自动生成超出大纲、学生端无法归类的题。

### 19.5 自动出题消费规则

科目训练和在线模考都只能通过当前出题画像消费趋势结论，但消费方式不同：

| 场景 | 读取画像 | 目标形态 | 完成条件 |
|---|---|---|---|
| 科目训练 | `use_case = subject_practice` | topic × difficulty × skill 的库存矩阵 | 每个目标 cell 达到数量和难度比例 |
| 在线模考 | `use_case = online_mock_exam` | 一套卷的 48 个题位 | 48 个题位均有 current 合格题并完成装配 |

两条线不能共用候选池：

1. `subject_practice` 生成题不得自动进入在线模考题位。
2. `online_mock_exam` 生成题不得自动进入科目训练专项题库。
3. 允许人工复制或转用，但必须生成新的 metadata，记录 `convertedFromQuestionId` 和人工确认人。

### 19.6 旧题版本治理执行细则

旧题分类批处理不应该只扫“已入库题”，还要覆盖：

1. 已审核正式 AI 题。
2. 待治理候选。
3. 在线模考候选。
4. 已装配草稿卷中的 AI 题。
5. 队列里尚未完成的生成任务。

写回格式建议：

```json
{
  "versionGovernance": {
    "status": "legacy_usable",
    "reason": "generation_profile_superseded_but_topic_still_active",
    "classifiedAt": "2026-07-14T00:00:00.000Z",
    "classifiedBy": "system",
    "activeGenerationProfileId": 31,
    "questionGenerationProfileId": 21,
    "activeSeriesProfileId": 16,
    "questionSeriesProfileId": 12,
    "targetUseCase": "subject_practice",
    "sourceSnapshotMatch": false,
    "syllabusSnapshotMatch": true
  }
}
```

学生端读取规则必须保守：

```text
允许：current, legacy_usable, manual_published
拒绝：stale_needs_review, retired, unknown_legacy, missing versionGovernance
```

后台可以显示所有状态，但默认把 `retired` 和硬删除记录隐藏到历史筛选。

### 19.7 防死循环规则

自动系统最危险的不是失败，而是“失败后无限生成”。必须加入以下停止条件：

1. 同一 pipeline 若连续 3 次因为同一 `blocked reason` 失败，进入 `blocked`，不再自动重试。
2. 同一 generation profile 下，某个 topic/cell 若连续生成 `N` 道都未通过门禁，暂停该 cell，标记 `cell_generation_blocked`。
3. provider 级错误和画像级错误分开：
   - provider timeout / concurrency：可退避重试。
   - schema invalid：可重试有限次数。
   - missing generation profile / mapping coverage low：不调用 provider。
4. 自动重试必须有指数退避和最大尝试次数。
5. cleanup / rebuild 不能自动删除手工题和真题事实源。
6. stale queued/running 任务只归档，不自动重绑到新 profile。

建议默认阈值：

| 项 | 默认值 |
|---|---:|
| pipeline 同原因自动重试 | 3 次 |
| provider transient retry | 12 次 |
| schema invalid repair retry | 3 次 |
| 单 cell 连续失败暂停 | 20 道 |
| source mapping coverage 激活阈值 | 90% |
| 自动任务恢复扫描间隔 | 60 秒 |

### 19.8 前端观测与操作最小闭环

后台页面至少要让管理员看到四层状态：

1. **事实源层**：导入了哪些月份、sourceType、语言、题量、是否 active。
2. **单题画像层**：48/48 中多少已画像、多少已映射、多少低置信、多少疑似超纲；这些数量必须同时出现在 source summary 总览和 pipeline 详情里，不能只依赖某一个后台任务结果。“已映射”必须使用 pipeline 可用口径，即题目同时具备可用 `topic_id` 和 `topic_codes`，不能再用旧的审核状态口径，否则会出现总览 19/48、pipeline 2/48 这类互相矛盾的页面。
3. **趋势/出题画像层**：当前 active series profile、两个 generation profiles、freshness、snapshot hash 摘要。
4. **题库资产层**：current / legacy_usable / stale_needs_review / retired / unknown_legacy 数量。

按钮语义要收敛：

| 按钮 | 作用 |
|---|---|
| `刷新进度` | 只拉最新状态，不触发生成 |
| `重新解析映射` | 重跑 source question 映射，不生成题 |
| `重建趋势画像` | 从已完成 source profile 重建 series profile |
| `重建当前出题画像` | 为两个 use case 生成 generation profiles |
| `运行版本治理` | 重算旧题 versionGovernance |
| `唤醒自动补题` | 在 readiness 通过后启动自动出题 |

“已完成”必须只出现在 pipeline 真正 succeeded；如果只有 19/48 已映射，前端不得显示完成，只能显示 `blocked/source_mapping_coverage_low`、`blocked/low_confidence_mapping_review_required`、`blocked/out_of_syllabus_review_required` 或 `waiting`。后端 `error` 可以保留通用 `source_mapping_coverage_low` 兼容旧脚本，但 `result.reason`、`result.mapping.gapReason` 和 `result.mappingGapDiagnosis` 必须给出主因、数量拆分和下一步动作。

### 19.9 实施落点

后端优先修改：

1. `ai-questioning.service.ts`
   - source pipeline scan / run。
   - active generation profile selection。
   - generation job worker freshness audit。
   - old question version governance batch。
2. `ai-questioning.controller.ts`
   - pipeline status summary。
   - version governance refresh endpoint。
   - source mapping progress endpoint。
3. 科目训练服务
   - 抽题过滤 `versionGovernance`。
   - 自动出题 readiness 使用 fresh generation profile。
4. 在线模考服务
   - 48 题装配过滤 `targetUseCase = online_mock_exam`。
   - 已过门禁但未装配题自动补装配。

前端优先修改：

1. `SourceReferenceLibraryPanel`
   - 显示 pipeline 阶段和映射缺口。
2. `StyleProfilePanel`
   - 显示趋势画像和两个 generation profile freshness。
3. `PublishedQuestionPanel`
   - 已入库题在候选题上方展示。
   - 展示 versionGovernance badge。
4. `CandidateReviewPanel`
   - 只展示未入库异常候选；已通过门禁且已入库题不再混在候选失败池。
5. `CoverageWorkPanel`
   - 科目训练的“追加合格题”按目标 cell 完成，而不是只按候选数量完成。

### 19.10 验收用例

必须用以下场景验证：

1. 上传 2025-12 数学真题，自动画像完成后生成趋势画像和两个 generation profiles。
2. 上传 2026-01 数学真题，趋势画像自动更新，旧 generation profile 被 supersede。
3. 上传 mock_exam 到真题画像入口必须被拒绝，不能创建 source document，也不能进入 past_paper 趋势画像。
4. 制造 48 题中 20 题无法映射，pipeline 必须 blocked，不能显示 completed。
5. 修改大纲后，旧 queued/running 生成任务被归档，不继续入库。
6. 科目训练只抽 current / legacy_usable。
7. 在线模考只装配 `online_mock_exam` 题。
8. 旧题缺 lineage 时，默认 `unknown_legacy`，学生端不抽。
9. provider 失败时只重试 provider 错误，不因为画像缺失而无限调用 AI。
10. 前端刷新不触发生成，生成按钮不伪装刷新。

### 19.11 当前优先级结论

开发阶段可以不兼容所有旧数据，但必须做到“旧数据可识别、可隔离、可清理”。因此下一步优先级应是：

1. 后端 pipeline 完成语义和 mapping coverage 阈值。
2. generation profile freshness 强校验。
3. stale 生成任务归档。
4. 旧题 `versionGovernance` 批处理和学生端过滤。
5. 前端进度/阻塞原因展示。
6. 最后再打开全自动补题。

这套顺序能避免最危险的线上状态：后台看起来在跑，实际上使用旧画像或无画像无限生成候选题。

### 19.12 本次补强：画像流水线恢复入口

为补齐“自动链路出错后只能猜状态”的漏洞，后台必须提供一个显式恢复入口：

1. 后端新增 `POST /api/v1/admin/ai-questioning/source-profile-pipeline/rebuild`。
2. 请求参数：`subject` 必填，`syllabusVersion` 默认 `2025`，`forceNewTask` 可选。
3. 入口统一创建 `source_profile_pipeline` task，`action = manual_rebuild`，`trigger = manual_rebuild`。
4. 不新建独立任务表，继续复用 `csca_ai_questioning_tasks`。
5. 去重逻辑必须包含 `queued / running / waiting`，避免重复点击产生任务风暴。
6. 前端只在“画像维护入口”中展示“重跑画像流水线”，不得放到正常主流程按钮组里。
7. 点击后必须返回或展示任务 ID；如果因为已有任务被合并，也要明确提示，不允许表现为“没反应”。

这个入口不是日常流程，而是恢复工具。正常情况下，导入真题、重解析真题、应用大纲、服务重启恢复、单题画像完成，都会自动推进同一条 pipeline；只有当 pipeline 被中断、状态卡住、或需要排查旧数据时才手动重跑。

验收补充：

1. 规则测试必须检查 controller、service、前端 API、前端 action、前端按钮都存在。
2. 前端构建必须通过，确保新增 props 没有漏接。
3. 后端构建必须通过，确保恢复入口可被 Nest 正常注册。

### 19.13 架构完备性复核

本方案不是新增一套“画像系统”或“题库系统”，而是在现有架构上补齐事实源、画像、生成和题库资产之间的强约束。判断方案是否真正完备，不看按钮是否齐全，而看以下闭环是否成立：

| 闭环 | 必须成立的条件 | 不成立时的风险 |
|---|---|---|
| 真题事实源闭环 | 每份 active past paper source document 都能追踪到 source questions、单题画像、映射结果 | 前端显示已上传，但趋势画像实际缺样本 |
| 趋势画像闭环 | active trend profile 的 `sourceDocumentIds/sourceQuestionIds/sourceSnapshotHash` 覆盖当前 active 真题集合 | 新月份真题上传后，AI 仍按旧月份规律出题 |
| 当前出题画像闭环 | `subject_practice` 和 `online_mock_exam` 各有独立 active generation profile，且来自最新 trend profile | 科目训练和在线模考混用画像，或继续使用旧单卷画像 |
| 自动出题闭环 | 自动 worker 只能读取 fresh generation profile，不能 fallback 到 style profile | 画像未完成时仍持续调用 AI，候选无限增长 |
| 版本治理闭环 | 每道候选题和已入库题都有 generation lineage 和 versionGovernance | 旧题、新题、测试题无法区分，学生端误抽 |
| 前端观测闭环 | 页面能展示 pipeline 阶段、阻塞原因、映射覆盖率、当前画像版本和任务 ID | 管理员只能看到“完成/运行中”，无法判断真实状态 |

因此，任何新增能力都必须先回答四个问题：

1. 它读取的是事实源、趋势画像，还是当前出题画像？
2. 它是否会影响 `sourceSnapshotHash` 或 `syllabusSnapshotHash`？
3. 它生成的题会进入哪个 use case：`subject_practice` 还是 `online_mock_exam`？
4. 它失败后是 waiting、blocked、failed，还是 retrying，是否有明确停止条件？

如果这四个问题答不清楚，就不能接入自动出题主链路。

### 19.14 当前必须补强的代码硬边界

为避免方案只停留在文档层，代码必须具备以下硬边界：

1. `blueprintWithStyleProfile` 这类生成画像选择入口必须要求 active generation profile。
2. 自动科目训练和自动在线模考都不得静默 fallback 到 `activeStyleProfileForBlueprint` 或旧单卷 style profile。
3. 前端不得再提示“会 fallback 到旧单卷画像”；缺当前出题画像时，只能提示自动出题暂停。
4. 在线模考 48 题装配必须只消费 `targetUseCase = online_mock_exam` 且门禁通过的题。
5. 科目训练补题必须只消费 `targetUseCase = subject_practice`，并按知识点、难度和目标 cell 完成。
6. source profile pipeline 的 `completed` 必须代表映射覆盖率、自动纳入样本和画像生成都达到阈值；如果只有部分题映射，不得显示 completed。
7. 自动重试只允许用于 provider、schema、网络等暂时性错误；画像缺失、映射覆盖不足、大纲缺失必须直接 blocked。
8. 旧 queued/running task 如果 lineage 落后于当前 generation profile，不得继续执行，只能归档或由新 profile 创建新任务。

本轮已落实的关键边界：

- 自动生成入口不再把缺失 generation profile 的情况降级到旧单卷画像。
- 前端画像面板不再表达“fallback 到旧单卷画像”，改为提示自动出题暂停并要求重建当前出题画像。
- 规则测试增加了“禁止自动链路 fallback 到 legacy style profile”的断言。
- 在线模考候选题进入已通过题位、从既有候选提升、装配草稿卷三条后端路径都必须过滤 `versionGovernance.status in (current, legacy_usable)`，未知旧题和 stale 题不能被装配。
- 连续趋势画像生成查询在 `generateExamSeriesProfile` 内强制限制为同学科、`source_type = past_paper` 且 `status = active`，模拟卷、预测卷、跨学科源卷和归档源卷不能污染真实趋势画像；规则测试已锁定该函数段，避免被其他查询里的同名过滤误判。
- 端到端 `csca-generation-profile:smoke` 已加入污染样本：同一学科同时创建 `past_paper` 与 `prediction_paper`，但期望趋势画像只纳入 active past paper 的文档和题目；这样 smoke 不再按旧口径要求“所有源卷都入趋势画像”。
- 端到端 `csca-generation-profile:smoke` 已调用真实 `importSourceDocumentJson` 导入一份临时 math/2025 past paper JSON，并断言导入响应同时创建 `auto_profile_filtered` 单题画像任务和 `source_document_imported` source profile pipeline；这覆盖“导入后不需要手动按钮即可进入画像流水线”的关键入口。
- 自动出题 readiness 不再只看 active series/profile ID，还会比对当前 active 真题 source snapshot 与大纲 syllabus snapshot；快照不一致时直接判定 stale 并阻断自动出题。
- 后台 `readyOnly` 的已入库/可装配 AI 资产台账也强制过滤 `versionGovernance.status in (current, legacy_usable)`，未知旧题、stale、retired 不再被展示为当前可用资产；全量历史仍可在普通台账和版本状态筛选中查看。
- `generateGenerationProfile` 和 `activateGenerationProfile` 在 supersede 旧 active 前新增 freshness gate：必须绑定当前 active 连续趋势画像，且 `sourceSnapshotHash`、`syllabusSnapshotHash` 同时等于当前 active 真题/大纲快照；旧单卷 `legacy_style_profile` 只能作为历史调试来源，不能被激活为正式当前出题画像。
- `sourceReferenceSummary` 不再只转发历史 pipeline task 状态：若历史任务是 `succeeded`，但当前 active 真题集合按 pipeline 口径仍未全部完成知识点映射，摘要接口会降级展示为 `source_mapping_incomplete`，避免前端继续显示“已完成但 19/48 映射”。前端总览的“已映射”和流水线缺口提示也必须使用 `pipelineMappedQuestionCount`，不能回退到旧的 `mappedQuestionCount`。
- 在线模考生成父任务在 `slot_results` 内写入创建时的 generation lineage；处理任务前会比较当前 `online_mock_exam` generation profile，如发现画像 ID/source/syllabus snapshot 已变化，则以 `archived_stale_profile` 失败并要求重建任务，不再静默漂移到新画像继续生成。
- 新生成 AI 题在 `insertQuestion` 最终落库前会立即复用批量版本治理分类器写入 `generation_metadata.versionGovernance`；候选题、已入库题和在线模考候选不再依赖后续批处理才获得 `current/legacy_usable/stale_needs_review/retired/unknown_legacy` 状态。
- 科目训练发布和在线模考门禁通过只会在既有 `versionGovernance` 上追加 `approval` 审计信息，不再用浅层 `{ status: current }` 覆盖画像 ID、快照 hash、分类原因和匹配结果。
- source profile pipeline 只有在两个 use case 的 generation readiness 都通过后，才会记录 `autoReplenishmentWake` 并唤醒科目训练预测补题/生产任务继续处理；这样上传或重解析真题完成后不会停在画像 ready 状态等待下一轮人工动作。
- 前端 source reference 流水线详情会展示 `自动补题唤醒`，管理员能看到预测补题和生产任务是否已经被唤醒，而不是只能看到“画像流水线已就绪”。
- source profile pipeline 去重不再只复用 60 秒内的任务；同一 subject + syllabusVersion 下只要已有 `queued/running/waiting` 任务，就复用或恢复该任务，避免长时间画像/等待依赖时重复创建任务风暴。
- active `past_paper` 真题 JSON 导入成功后，后端会同时启动单题自动画像任务和 `source_document_imported` source profile pipeline；pipeline 会等待单题画像完成后继续推进趋势画像、两个 use case generation profile 和版本治理。
- 规则测试已经把 `source_document_imported`、`source_document_reprofiled`、`source_document_deleted`、`syllabus_applied`、`source_auto_profile_completed`、`startup_reconcile`、`manual_rebuild` 这些入口写成防回归约束，避免上传、重解析、删除源卷、大纲更新或重启恢复只更新局部卡片而不进入主 pipeline。
- 科目训练生产矩阵的完成语义已收紧为 `published/open` 口径：每个 topic + difficulty cell 必须达到正式入库且 `targetUseCase = subject_practice` 的合格题数量才算完成；候选题只作为异常治理池，系统会先提升已可发布候选、原题优化可修复候选、再对硬伤候选重生，候选积压或连续无新增正式题会进入 blocked，而不是无限增长候选。
- 学生端科目训练普通题目列表、错题回看、自适应错题入口已和自适应抽题/AI Coach 对齐：只允许 AI 题的 `versionGovernance.status` 为 `current` 或 `legacy_usable`；`unknown_legacy`、`stale_needs_review`、`retired` 即使仍挂在专项题库或错题记录里，也不会作为当前可消费题展示。
- 科目训练 queued/running 生成任务已写入并校验 generation lineage：入队 metadata 记录 `generationProfileId / seriesProfileId / sourceSnapshotHash / syllabusSnapshotHash / targetUseCase`，处理前会重新解析当前 active generation profile；旧任务缺 lineage 或 lineage 与当前画像不一致时归档为 `archived_stale_profile`，不能继续写入新题。

### 19.15 剩余漏洞与执行顺序

剩余工作按风险从高到低执行：

1. **端到端上传验收**：用真实 `past_paper` JSON 验证导入后无需手动按钮即可经历 source question auto profile、source profile pipeline、trend profile、两个 generation profile、version governance、自动补题唤醒。当前代码入口已接上，但必须用真实 48 题数学卷和至少一份化学/物理卷做回归。
2. **pipeline 阶段展示验收**：前端不能只显示“已完成”。当映射覆盖不足、低置信待处理、超纲候选或 generation profile stale 时，必须展示阶段、剩余数量、阻塞原因和下一步动作。
3. **生成任务 lineage 端到端验收**：在线模考父任务和科目训练 queued/running 任务都已有代码级 lineage 防护，并已由 smoke 覆盖 active generation profile 切换后旧 queued/running 任务归档为 `archived_stale_profile`、不会继续入库的场景。
4. **学生端消费过滤验收**：后端硬过滤已覆盖后台台账、科目训练、自适应训练、AI Coach、在线模考装配、错题回看和自适应错题入口；还要用真实旧题样本做端到端回归，确认 `unknown_legacy/stale_needs_review/retired` 不会在学生端出现。
5. **自动补题完成条件验收**：科目训练和在线模考都必须以“合格入库/可装配数量”作为完成条件，而不是候选数量；已过门禁题必须优先 promotion，缺口才调用 provider。
6. **全自动放开**：只有上述状态机稳定后，才允许科目训练和在线模考进入无人值守自动补题；开发阶段可以先小范围放开数学，再扩到化学和物理。

开发阶段可以清理旧脏数据，但不能让系统依赖“手动清理才能正确”。正确做法是：

- 旧数据可清理，是为了降低测试干扰。
- 新机制必须能识别旧数据、隔离旧数据、避免旧数据污染新生成。
- 自动链路必须以当前 active generation profile 为唯一入口。

### 19.16 上线部署风险判断

这套方案会增加后台任务，但不会天然压垮网站，前提是执行以下限制：

| 压力来源 | 控制方式 |
|---|---|
| 真题上传后批量画像 | 按 source document / subject 建 pipeline，串行或小并发运行 |
| 趋势画像重建 | 只在 sourceSnapshotHash 或 syllabusSnapshotHash 变化时触发 |
| 当前出题画像生成 | 每个 subject + syllabus + useCase 只保留一个 active，生成成功后原子切换 |
| 自动补题 | 由库存缺口和学习周期触发，不能按页面刷新触发 |
| provider 并发 | 走 provider/key 池、队列和退避；缺 key 不调用模型 |
| 前端轮询 | 读摘要接口，5-10 秒轮询，不拉全量题目 |

上线前的最小通过标准：

1. 上传一份新月份真题后，前端能看到 source question 映射进度，而不是只看到“已完成”。
2. 映射覆盖不足时，自动出题 blocked，且不调用 AI。
3. 映射完成后，trend profile 和两个 generation profiles 自动更新。
4. 新生成题 metadata 能追踪到 generation profile、series profile、source snapshot。
5. 科目训练和在线模考分别生成、分别入库、分别装配。
6. 回滚旧版本代码后，旧数据不会被硬删除；最多新画像链路暂停。

### 19.17 与现有架构的契合方式

结论：本方案与现有架构契合，原因是它复用现有四类核心资产，而不是新增平行系统。

| 现有资产 | 本方案中的角色 | 需要补强的边界 |
|---|---|---|
| `csca_source_documents` | 真题事实源，区分 past paper / mock / prediction / archived | 必须准确记录 `source_type/status/examYear/examSession/language`，趋势画像只读取 active past paper |
| `csca_source_questions` | 单题画像与知识点映射的事实层 | `auto_profile_status/topic mapping/confidence` 必须可观测；未映射不能被当作完成 |
| `csca_exam_series_profiles` | 连续月份趋势画像 | 必须记录 `sourceSnapshotHash/syllabusSnapshotHash/sourceDocumentIds/sourceQuestionIds` |
| `csca_generation_profiles` | 科目训练/在线模考当前出题画像 | 必须按 `use_case` 分开 active profile，且来自最新趋势画像 |
| `csca_questions` | AI 候选题、已入库题、正式题资产 | 必须保留 generation lineage 和 versionGovernance |
| `csca_ai_questioning_tasks` | 后台流水线与生成任务 | 必须区分 source profile pipeline、generation job、repair/retry，不允许同一个状态词混淆 |

现有服务边界也应保持清晰：

1. `ai-questioning.service.ts` 负责画像、生成画像、AI 题生成与版本治理，不直接决定学生端抽题体验。
2. `csca-special-practice` 负责科目训练抽题与自适应补题，只消费 `subject_practice` 画像和题库资产。
3. `csca-mock-exam` 负责在线模考题位、整卷装配，只消费 `online_mock_exam` 画像和题库资产。
4. `past-papers` 负责真题/模考卷/套装展示与资源组织，不参与 AI 出题闭环。
5. 前端 `SourceReferenceLibraryPanel` 负责事实源和画像流水线可观测；`StyleProfilePanel` 负责出题画像可观测；候选/已入库面板负责题库资产治理。

因此，后续实现必须避免三类架构漂移：

1. **不要把在线模考 AI 出题塞回手工模考题页面**：手工模考题库和 AI 模考题库是两条来源，最终都能进入模考资产池，但生成流程属于 AI 题库流程。
2. **不要把科目训练和在线模考候选混在同一治理池里**：两者可以共用大纲和真题趋势画像，但从 generation profile 开始必须按 use case 分开。
3. **不要把真题套装、模考卷套装和趋势画像混为一层**：套装是展示/资源组织能力；趋势画像是 AI 生成依据；二者可以引用同一真题事实源，但不能互相替代。

### 19.18 漏洞与防护矩阵

当前最容易导致线上异常的漏洞如下，必须逐项用代码和验收用例兜住：

| 漏洞 | 表现 | 防护规则 | 验收方式 |
|---|---|---|---|
| 部分映射却显示 completed | 页面显示已完成，但只有 19/48 映射 | pipeline completed 必须校验 coverage 阈值；不足则 blocked/waiting | 构造 48 题中 20 题未映射，前端不得显示完成 |
| mock/prediction 污染真题趋势 | 模拟卷/预测卷被误放进真题画像入口 | 真题画像入口只接受 `sourceType=past_paper`；trend profile 查询也只允许 `source_type = past_paper` 且 active | 上传 mock_exam/prediction_paper 到真题画像入口会被拒绝，不创建 source document，sourceSnapshotHash 不变 |
| 新真题上传后仍用旧画像 | AI 继续按旧月份出题 | readiness 比对 sourceSnapshotHash 和 syllabusSnapshotHash | 上传新月份真题后旧 generation profile stale |
| 科目训练和在线模考混用题 | 模考生成触发科目题，或科目题进入模考装配 | 所有生成、候选、入库、装配路径必须检查 `targetUseCase` | 同题库中分别筛选两个 use case，互不出现 |
| 候选无限增长但正式题不增加 | 300 候选只 3 个合格，循环不停止也不修复 | 以合格/可装配数量为目标；失败候选进入 repair/reject；cell 连续失败后 blocked | 模拟 provider/门禁失败，任务进入 blocked 而不是无限生成 |
| 通过门禁但未提升入库 | 候选列表里有可装配题，但正式题数不变 | promotion worker 以门禁通过题为第一优先，不足再生成 | 已有 48 个 gate_passed 时不得继续调用 provider |
| 旧 running 任务重启后继续污染 | 服务重启后老任务继续用旧 profile 写入 | startup reconcile 归档 stale lineage 任务 | 修改 profile 后重启，旧任务不再入库 |
| 学生端抽到旧脏题 | 缺 lineage 或 stale 题仍被抽出 | 学生端只允许 current / legacy_usable / manual_published | 用 unknown_legacy 题做抽题测试，应被排除 |
| 前端刷新误触发生成 | 管理员想看进度却创建新任务 | 刷新接口只 GET 摘要；生成/重建必须显式 POST | 连续点击刷新不增加任务数 |
| 低置信映射被强行当真 | 超纲或模糊题进入趋势画像 | 低置信进入待处理；可人工确认或明确排除 | 低于阈值题不计入 approved 样本 |

### 19.19 执行到位的最小分阶段标准

为了避免一次性改太多导致难排查，执行顺序按以下阶段推进：

**阶段 A：事实源和画像可信**

- 真题导入入口只接受 `past_paper`；`mock_exam/prediction/practice/archived` 必须被拒绝或走资源/套装模块，不能创建画像源卷。
- 单题画像进度可见，低置信、未映射、疑似超纲都有独立状态。
- pipeline 的 completed 语义修正，不再把部分映射显示为完成。

**阶段 B：趋势画像和当前出题画像可信**

- 每次 active past paper 集合变化后，自动重建 continuous trend profile。
- 每次 trend profile 更新后，自动重建 `subject_practice` 和 `online_mock_exam` 两个 generation profile。
- readiness 强校验 source/syllabus snapshot；不一致就 blocked。

**阶段 C：生成和入库可信**

- 科目训练按 topic + difficulty cell 达标才算一次追加成功。
- 在线模考按 48 个题位全部有 gate_passed / current 题才算整卷完成。
- 已有合格候选优先提升入库/装配，不足才调用 provider。
- 可修复候选先 repair，硬伤候选 reject，不让候选池无限膨胀。

**阶段 D：学生端和后台治理可信**

- 学生端抽题过滤 versionGovernance。
- 后台已入库资产展示在候选题上方。
- 候选池只承载异常、待修复、待人工确认或被拒绝题。
- 旧数据可清理，但系统正确性不依赖手动清理。

这四个阶段全部满足后，才算“自动画像刷新与题目版本治理”真正完成。开发阶段可以先清理旧脏数据降低干扰，但上线机制必须靠状态、版本和快照判断，而不是靠人工记忆。

### 19.20 本次补强后的可执行验收口径

为了避免“看起来创建了任务，但真实画像没有推进”的假完成，后续验收不能只检查按钮和任务记录，必须检查数据是否真正穿过完整链路。

#### 导入 JSON 必须显式初始化自动画像状态

真题 JSON 导入 `csca_source_questions` 时，必须显式写入：

- `auto_profile_status = pending`
- `auto_profile_attempts = 0`
- `auto_profile_max_attempts = AUTO_PROFILE_MAX_ATTEMPTS`
- `auto_profile_next_retry_at = null`
- `auto_profile_last_tried_at = null`

不能依赖数据库默认值。原因是不同环境的旧迁移状态可能不一致；如果导入题没有 pending，后台会创建 `source_question_auto_profile` 任务，但 runner 查询不到题，前端就会出现“任务已完成/已启动，但映射覆盖没有增长”的假象。

#### 导入 JSON 的结构化映射不能被规范化过程丢掉

用户上传的真题 JSON 如果已经包含结构化画像或映射结果，例如：

```json
{
  "analysis": {
    "difficulty": "medium",
    "questionForm": "calculation_application",
    "cognitiveSkill": "standard_application",
    "aiTopicMapping": {
      "status": "success",
      "suggestions": [
        {
          "topicCode": "M-GEO-001",
          "confidence": 0.96,
          "reason": "题干考查直线与圆的位置关系。"
        }
      ]
    }
  }
}
```

导入规范化可以补齐统一字段，但不得丢弃 `analysis.aiTopicMapping`。否则系统会把已经映射过的题当成未映射题，再次调用 provider 或规则兜底，导致低置信、未映射和重复任务增加。

#### smoke 不得只验证“任务被创建”

`csca-generation-profile:smoke` 的目标应升级为完整闭环：

1. 导入一份临时 `past_paper` JSON，并至少覆盖一份真实 48 题数学真题 fixture。
2. 断言导入响应同时创建：
   - `source_question_auto_profile`
   - `source_profile_pipeline`
3. 断言真实 48 题 fixture 的 48 道 source questions 全部落库，且导入后全部显式初始化为 `auto_profile_status = pending`。
4. 真实 48 题 fixture 使用独立 smoke subject 和独立 applied syllabus，避免和主 smoke 或真实 `math/2025` 画像互相污染。
5. 手动执行同一套 runner，不调用真实 provider。
6. 断言真实 48 题 fixture 的单题自动画像 48/48 全部 `auto_approved`。
7. 断言真实 48 题 fixture 的 source profile pipeline 最终达到 `ready`，且 `mapping.mappedCount = 48`。
8. 断言自动生成：
   - 连续月份趋势画像 `csca_exam_series_profiles`
   - `subject_practice` generation profile
   - `online_mock_exam` generation profile
9. 断言 pipeline 结果包含 `autoReplenishmentWake`。
10. 断言 `prediction_paper/mock_exam/practice` 不进入真实趋势画像。
11. 测试数据必须使用唯一 `syllabusVersion` 隔离，并在 finally 中清理 source documents、source questions、tasks、style profiles、series profiles、generation profiles 和 generation jobs。

本 smoke 应使用唯一 smoke 学科和唯一 smoke 大纲版本隔离测试数据，例如 `smoke_math_<timestamp>` + `smoke-series_<timestamp>`。业务代码中“生产只允许 math/physics/chemistry”的校验仍是正确边界；只有在 `CSCA_ALLOW_SMOKE_SUBJECTS=true` 的测试进程内，画像和生成画像入口才允许 smoke 学科穿过同一套链路。这样既能覆盖真实业务 runner，又不会临时切换或污染本地真实 `math/2025` 的 active 画像。

还需要注意：同一 subject 下可能同时存在多个 syllabusVersion 或多批次导入测试数据。`source_profile_pipeline` 的 active document count 和 readiness 的 `sourceDocumentCount` 不能只按 subject 统计 active past paper documents，必须要求该 source document 下存在当前 `subject + syllabusVersion` 的 source questions。否则同学科其他版本的 active 真题会让当前画像误判为“有源卷但无题/映射不足”，前端表现为无端 blocked 或错误进度。

#### pipeline completed 的最小条件

source profile pipeline 只有同时满足以下条件，前端才允许显示为“已完成/ready”：

1. active past paper source documents 已纳入当前 source snapshot。
2. active source questions 的自动画像已结束，不存在 pending / processing / retry_pending。
3. 映射覆盖率达到当前阈值；低置信、未映射、疑似超纲题有独立数量和处理建议。
4. 连续趋势画像生成成功，且 `sourceSnapshotHash`、`syllabusSnapshotHash` 与当前事实源一致。
5. `subject_practice` 和 `online_mock_exam` 两个 generation profiles 都生成成功并通过 freshness gate。
6. 自动补题唤醒结果已记录；失败也要明确显示为 wake failed，而不是隐藏。

如果只完成 1-2 项，状态应为 `waiting` 或 `blocked`，不能显示 `completed`。这条规则直接对应线上风险：上传了真题、前端显示已完成，但实际只有部分题被映射，后续自动出题仍然按旧画像或无画像运行。

#### 本地验收命令

每次修改真题导入、单题画像、趋势画像、generation profile、自动补题唤醒或学生端抽题过滤后，至少运行：

```bash
npm run csca-generation-profile:rules
npm run csca-generation-profile:smoke
npm run csca-source-profile-visualization:rules
npm run csca-mock-exam-ai-generation:closure-rules
npm run csca-mock-exam-ai-generation:smoke
npm run csca-ai-questioning:subject-closure-smoke
npm --prefix backend run build
```

其中 `csca-generation-profile:smoke` 需要本地数据库在线。如果数据库不可达，不能把 smoke 记为通过，只能记录为“环境阻塞”；规则测试和 build 通过只能说明静态边界没破，不能证明上传画像闭环已完成。

#### 当前实现验收记录

本地数据库在线并应用最新迁移后，以下命令已通过：

```bash
npm run csca-ai-questioning:rules
npm run csca-ai-questioning:smoke
npm run csca-ai-questioning:subject-closure-smoke
npm run csca-generation-profile:smoke
npm run csca-generation-profile:rules
npm run csca-source-profile-visualization:rules
npm run csca-mock-exam-ai-generation:closure-rules
npm run csca-mock-exam-ai-generation:smoke
npm run csca-adaptive:predictive-replenishment-rules
npm --prefix backend run build
npm --prefix frontend run build
```

其中 smoke 已覆盖：

1. active `past_paper` JSON 导入会创建并尝试启动单题自动画像任务和 source profile pipeline。
2. 真实 `docs/csca-math-past-paper-2025-12-en-source.json` fixture 导入后会创建 48 道 source questions。
3. 导入题显式进入 `pending` 自动画像状态。
4. 真实 48 题 fixture 的单题自动画像会 48/48 全部推进到 `auto_approved`。
5. 真实 48 题 fixture 的 source profile pipeline 会达到 `ready`，并证明 `mapping.mappedCount = 48`。
6. smoke 使用唯一 smoke subject 和唯一 smoke syllabusVersion，避免污染本地真实 `math/2025` 当前画像。
7. source profile pipeline 和 readiness 已按当前 `subject + syllabusVersion` 下实际存在 source questions 的 source documents 统计，不再被同学科其他大纲版本/测试导入文档污染。
8. 导入 JSON 中已有的 `analysis.aiTopicMapping` 会被保留并复用。
9. 单题自动画像 runner 能把导入样本推进到 `auto_approved`。
10. source profile pipeline 能生成连续趋势画像、`subject_practice` generation profile、`online_mock_exam` generation profile。
11. 新导入的 past paper 样本会进入趋势画像；同一测试里的 `prediction_paper/mock_exam` 样本在真题画像入口会被拒绝，不会创建 source document，也不会进入真实趋势画像。
12. pipeline 结果包含自动补题唤醒记录。
13. 如果历史 pipeline 曾经 succeeded，但当前 active 真题按 pipeline 口径已不完整，`sourceReferenceSummary` 会降级为 `source_mapping_incomplete`，并返回 `mapping`、`mappingGapDiagnosis.reason` 和 `mappingGapDiagnosis.nextAction`；前端流水线详情会展示映射数量、低置信/疑似超纲数量和下一步动作，而不是只显示“已完成”。
14. 如果当前 active 真题已经存在映射缺口，但历史环境中没有可展示的 source profile pipeline 任务记录，`sourceReferenceSummary` 会返回 `summary_diagnostic` 诊断态；前端会显示“当前事实源诊断”并继续轮询摘要，避免把旧数据/异常导入解释成“暂无流水线任务”。
15. `csca-generation-profile:smoke` 已构造“无 pipeline 任务记录但 active past paper 映射未完整”的旧数据场景，并断言摘要接口返回 `summary_diagnostic` + `source_mapping_incomplete`，证明该兜底不是只有静态规则覆盖。
16. `csca-generation-profile:smoke` 已覆盖旧 queued 科目生成任务的 lineage 归档：任务先绑定旧 active `subject_practice` generation profile，随后生成新的 active profile，再处理旧任务；旧任务必须在调用 provider 前归档为 `archived_stale_profile`。
17. `csca-generation-profile:smoke` 已覆盖“单题画像结束但知识点映射覆盖不足”的阻断：构造 10 道 active past paper 样本，其中 8 道已映射、2 道未映射，source profile pipeline 必须以 `blocked/source_mapping_coverage_low` 结束，并在 `result.mapping` 与 `result.mappingGapDiagnosis` 中保留映射缺口数量和覆盖率。这保证“已完成”不能只代表任务跑完，而必须代表映射覆盖达到阈值。
18. `csca-ai-questioning-smoke` 已覆盖学生端自适应取题的旧题隔离：构造一条已发布到 `special_practice_questions` 且有 topic mapping 的桥接题，但其 AI backing row 的 `generation_metadata.versionGovernance.status = stale_needs_review`。自适应取题必须继续选中 current/legacy usable 的正式 AI 题，并且不能选中这条 stale backing row 对应的已发布桥接题。
19. `csca-ai-questioning-smoke` 已按当前架构补齐科目训练生成前置条件：测试学科必须有 active past paper source question、连续趋势画像和 `subject_practice` generation profile，缺任一环节时不会进入 provider；大纲版本从 `2026-smoke` 切换到 `2026-json-import` 后，smoke 会重建对应版本的趋势画像和 generation profile，再验证新生成题携带最新 syllabus scope。
20. `csca-ai-questioning-smoke` 的正式专项题库 fixture 已显式写入 `generation_metadata.versionGovernance.status = current`；这确保学生侧可消费题和 stale/unknown/retired 题走同一套版本过滤口径，而不是靠测试绕过版本治理。
21. `csca-ai-questioning:subject-closure-smoke` 已改为使用唯一 `smoke_math_*` 学科和独立 applied syllabus、past-paper source question、连续趋势画像、`subject_practice` generation profile，不再被本地真实 `math/2025` 的未完成画像污染。该 smoke 已验证：科目训练候选能通过门禁自动发布到 `special_practice_questions`，学生端 adaptive provider 能消费这条正式专项题，production matrix 能按 basic/medium/hard 三个难度 cell 生成并发布正式题，且已有正式库存不会被当作本次 production run 的完成数。
22. `csca-mock-exam-ai-generation:smoke` 已从旧的“能创建任务”升级为当前画像链路验收：测试会创建 active `online_mock_exam` generation profile、连续趋势画像和 source style profile，生成任务必须在 `slotResults.generationLineage` 固定 `generationProfileId`、`seriesProfileId`、`sourceStyleProfileId`、`sourceSnapshotHash`、`syllabusSnapshotHash` 与 `profilePolicyVersion`；旧 queued 任务在 active generation profile 切换后必须在调用 provider 前失败并持久化 `archived_stale_profile`；候选题自动通过门禁后必须保留 `generation_metadata.targetUseCase = online_mock_exam` 和 `versionGovernance.status = current`；装配草稿卷时只能使用该已审核模考候选，并保持草稿不公开。
23. `csca-generation-profile:smoke` 已补强真实连续月份数学验收：先导入 `docs/csca-math-past-paper-2025-12-en-source.json` 并跑通 48/48 自动画像、pipeline、趋势画像和两个 generation profiles；再导入 `docs/csca-math-past-paper-2026-03-en-source.json`，同一 `subject + syllabusVersion` 的 active 趋势画像必须扩展到 2 份 active past paper、96 道 source questions，新的 `subject_practice` 和 `online_mock_exam` generation profiles 必须指向新趋势画像，第一轮 profiles 必须变为 `superseded`。
24. `csca-generation-profile:rules` 已补强“刷新进度只读”规则：`useSourceReferenceDataRefresh` 只能调用 source reference summary、documents、questions、tasks、style profiles、exam series profiles、generation profiles 和 topic options 的 GET/list 类接口；不得调用 import、reprocess、source profile rebuild、source auto profile、topic mapping、style/generation profile generation、version governance refresh 或任何 `runAction` mutation。前端文案也必须把“刷新进度”和“重新解析映射/重跑画像流水线”分开，避免局部刷新伪装成生成或重建动作。
25. `csca-ai-questioning:rules` 已补强科目训练 production matrix 完成语义：`refreshSubjectPracticeProductionRun` 必须以每个 cell 的正式入库数和 open 缺口计算 `publishedTotal/openTotal`，`publishedTotal` 必须按 cell target 封顶，`candidateTotal` 只能作为观测指标，不能驱动 completed；候选自动入库前必须重新读取当前 production run/cell，若 cell 已满、难度不匹配、run 被取消或 cell 缺失，必须阻断发布并记录原因。
26. `csca-source-profile-visualization:rules` 已补强 source profile pipeline 的 UI 可观测验收：后端必须输出 `mappingGapDiagnosis`、`requiredMappingCoverage`，并区分 `source_mapping_coverage_low`、`low_confidence_mapping_review_required`、`out_of_syllabus_review_required`；前端必须展示流水线阶段、task id、映射覆盖、低置信数量、疑似超纲数量、映射缺口原因和下一步动作，不能只显示“已完成/未完成”。
27. `csca-ai-questioning:rules` 已补强后台生成队列的 lineage 可观测验收：`CoverageWorkPanel` 和 `QuestionBankTaskStatus` 都必须从 `promptMetadata` 展示 `generationProfileId / seriesProfileId / sourceSnapshotHash / syllabusSnapshotHash / profilePolicyVersion / productionRunId / productionCellId / targetUseCase`，并显示 `governance.attemptCount / maxAttempts` 停止条件；缺失画像 lineage 时必须显示“画像版本未记录”，不能只显示“运行中/失败”。
28. `csca-generation-profile:smoke` 已补强 source profile pipeline 的真实运行时诊断样本：同一套 smoke 现在分别构造普通未映射覆盖不足、低置信映射不足、疑似超纲映射不足三类 active past paper 样本，并断言任务以 `source_mapping_coverage_low`、`low_confidence_mapping_review_required`、`out_of_syllabus_review_required` 三个具体 `error/result.reason/mappingGapDiagnosis.reason` 阻断。后端 pipeline 的 `error` 字段也改为持久化具体 `mappingGapReason`，不再把所有阻断都压成通用覆盖率低。
29. `frontend/scripts/check-admin-source-profile-pipeline-ui.mjs` 已补强 source profile pipeline 的前端 UI 契约：必须展示 `source_mapping_incomplete/summary_diagnostic`、task id、映射覆盖、低置信、疑似超纲、映射缺口、下一步动作和“刷新进度”局部刷新按钮；同时必须保持 `shouldPollSourceReference` 对 active task、映射未完整、pending/processing source question 的自动轮询。该脚本已挂入 `npm --prefix frontend run test:admin-source-profile-pipeline-ui`，并加入 `verify:csca-source-profile-rollout`。
30. 本轮复跑并通过了 `csca-ai-questioning:rules`、`csca-ai-questioning:smoke`、`csca-ai-questioning:subject-closure-smoke`、`csca-generation-profile:rules`、`csca-generation-profile:smoke`、`csca-source-profile-visualization:rules`、`npm --prefix frontend run test:admin-source-profile-pipeline-ui`、`csca-mock-exam-ai-generation:closure-rules`、`csca-mock-exam-ai-generation:smoke`、`csca-adaptive:predictive-replenishment-rules`、`backend:build` 和 `npm --prefix frontend run build`。这些验证覆盖后端硬边界、真实数据库 smoke、前端 source profile 可观测规则、前端 source profile pipeline UI 契约、在线模考 AI 闭环规则、在线模考当前画像 lineage、科目训练正式题闭环、生成队列 lineage 可观测、source profile 三类映射缺口运行时诊断、预测补题规则、Nest/TypeScript 构建以及前端打包。
31. `npm --prefix frontend run test:admin-source-profile-pipeline-browser` 已新增并通过真实 Playwright DOM 回归：使用独立默认端口 `5198` 且默认禁止复用旧 dev server，进入 `AI 生成题库 -> 共用准备`，验证 `source_mapping_incomplete` 场景下浏览器页面能看到 1 份文档/48 道样本、task id、`映射 19/48`、映射覆盖、低置信 7、疑似超纲 2、`source_mapping_coverage_low`、下一步动作和带“不刷新整页”提示的“刷新进度”按钮。该浏览器回归已加入 `verify:csca-source-profile-rollout`，防止以后再次出现“任务显示已完成但真实画像未完整，前端看不出来”的回归。
32. `csca-ai-questioning:rules` 已补强后台 AI 题库的资产展示顺序：`subject-practice` 和 `online-mock` 两条线都必须先渲染 `PublishedQuestionPanel`，再渲染 `CandidateReviewPanel`。这把“已入库/可装配 AI 题展示在候选治理区上方”的产品要求写成防回归规则，避免候选池继续承担正式资产展示职责。

当前可用的数学真题 JSON fixture 校验结果：

- `docs/csca-math-past-paper-2025-12-en-source.json`：48 题，可作为完整卷导入 smoke 标准。
- `docs/csca-math-past-paper-2026-01-en-source.json`：46 题，可作为趋势样本使用，但不能作为“48 题完整卷”验收。
- `docs/csca-math-past-paper-2026-03-en-source.json`：48 题。
- `docs/csca-math-past-paper-2026-04-en-source.json`：48 题。

当前仓库尚无可作为 `past_paper` 端到端验收的化学或物理 48 题 source JSON。`docs/csca-chemistry-prediction-paper-2-en-source.json` 是 prediction paper，不能用于证明真实 past paper 趋势画像；因此“至少一份化学/物理真实 past paper 回归”仍是数据 fixture 缺口，而不是代码已完成项。

### 19.21 架构契合与风险补强结论

本方案和当前架构是契合的，但契合点不是“页面上多几个按钮”，而是把现有数据链路收紧成一个强状态机：

1. `csca_source_documents` / `csca_source_questions` 继续作为真题事实源。
2. 单题画像和知识点映射继续挂在 source question 维度。
3. 连续月份趋势画像继续落在 `csca_exam_series_profiles`。
4. 科目训练和在线模考从 `csca_generation_profiles` 开始分叉。
5. 候选题、已入库题、正式专项题和模考候选都通过 `generation_metadata.versionGovernance` 被治理。
6. 自动任务继续复用 `csca_ai_questioning_tasks`，但必须补齐 action、trigger、lineage、snapshot 和 stop condition。

因此不需要重建题库，也不需要把上传真题、科目题库、在线模考题库拆成新的平行系统。真正需要补强的是以下“硬边界”。

| 边界 | 当前架构是否支持 | 必须补强的点 | 不补强的后果 |
|---|---|---|---|
| 多月份真题事实源 | 支持，source document 已能区分文档 | 必须严格写入 `sourceType/examYear/examSession/language/status`，趋势画像只读 active `past_paper` | 模拟卷、预测卷或旧导入污染真题趋势 |
| 单题画像完整性 | 支持，source question metadata 可承载 | 导入时显式初始化 `auto_profile_status`，保留上传 JSON 已有 `analysis.aiTopicMapping` | 前端显示有任务，runner 实际没有待处理题 |
| 映射覆盖判断 | 支持，但必须强制 | pipeline `completed/ready` 必须校验 mapped count、低置信、疑似超纲和 waiting/pending 数 | 19/48 映射也显示完成，后续生题使用残缺画像 |
| 趋势画像刷新 | 支持，series profile 已存在 | source snapshot 或 syllabus snapshot 变化时自动重建，旧 series profile supersede | 新月份真题上传后仍按旧月份规律出题 |
| 科目/模考分叉 | 支持，generation profile 有 use case | `subject_practice` 与 `online_mock_exam` 必须各自有 active profile，不能互相 fallback | 科目题和在线模考题混用画像、混用候选池 |
| 生成任务 lineage | 支持，metadata 可写入 | queued/running job 创建和执行前都校验 `generationProfileId/sourceSnapshotHash/syllabusSnapshotHash/targetUseCase` | 旧任务在新画像发布后继续写入新题库 |
| 候选提升为正式资产 | 支持，已有门禁和发布流程 | 已过门禁题必须优先 promotion；未过门禁题不能靠人工批量误入库 | 候选无限增长，正式题数量停滞 |
| 学生端消费过滤 | 支持，但必须全入口一致 | 所有学生端抽题、错题、AI Coach、模考装配只允许 `current/legacy_usable/manual_published` | 学生抽到旧脏题、测试题或 stale 题 |
| 前端观测 | 支持，但仍需细化 | 展示 task id、pipeline stage、mapped/total、blocked reason、next action、profile version | 管理员只能看到“已完成/运行中”，无法判断真实失败点 |

#### 必须关闭的漏洞

以下漏洞一旦存在，就会直接造成线上错误，不属于“体验优化”，必须作为阻断项处理：

1. **刷新按钮触发生题或重建画像**：刷新只能 GET 当前状态，不允许 POST 生成、重建或自动补题。
2. **pipeline 只看任务状态不看数据覆盖**：任务 succeeded 不等于画像 ready；必须二次校验当前 active facts。
3. **generation profile 缺失时 fallback 到旧 style profile**：自动出题必须直接 blocked，不允许降级生成。
4. **旧 queued/running 任务自动重绑到新画像**：只能归档或重新创建新任务，不能静默漂移。
5. **门禁通过和人工确认混为一类**：自动装配只允许门禁通过；人工确认题不能自动成为 48/48 合格数，除非显式改状态并记录原因。
6. **候选池承担正式资产职责**：候选池只用于异常治理、复审、修复和拒绝；已通过门禁并已入库题应进入正式资产区。
7. **趋势画像按 subject 统计所有 active 文档**：必须限定 `subject + syllabusVersion + sourceType=past_paper`，且文档下存在当前版本 source questions。
8. **超纲题直接丢弃**：真题超出当前大纲时不能污染可生成 topic，但必须进入诊断，提示“大纲可能缺失/真题可能超纲”。
9. **旧题无版本标记却继续可抽**：缺 `versionGovernance` 的 AI 题默认 `unknown_legacy`，学生端不抽。
10. **provider 失败和画像阻塞混用 retry**：provider/network/schema 可重试；mapping missing、profile stale、syllabus missing 必须 blocked，不调用 AI。

#### 自动链路的停止条件

自动链路必须有明确停止条件，避免候选无限增长：

| 自动链路 | 成功停止 | 阻塞停止 | 重试停止 |
|---|---|---|---|
| source question auto profile | 当前 source questions 全部 `auto_approved/auto_excluded` | 低置信、超纲、无法映射达到人工阈值 | provider/schema/network 达最大次数 |
| source profile pipeline | 映射覆盖达到阈值，趋势画像和两个 generation profiles fresh | 映射覆盖不足、大纲缺失、source snapshot 不可计算 | 临时 provider 或 DB 错误 |
| subject practice replenishment | 所有目标 cell 达到数量和难度比例 | 某 cell 连续失败达到阈值，标记 `cell_generation_blocked` | provider 可重试错误 |
| online mock generation | 当前卷 48 个题位都有门禁通过且已入库/可装配题 | 某题位连续硬伤或画像缺失，标记 `slot_generation_blocked` | provider 可重试错误 |
| version governance refresh | 当前范围题全部分类完成 | lineage 缺失且无法判断，标记 `unknown_legacy` | 临时 DB 错误 |

重点：自动补题的目标不是“生成足够多候选”，而是“正式可用资产达到目标”。候选数量只能作为过程指标，不能作为完成条件。

#### 上线/开发阶段的数据治理口径

开发阶段可以清理旧脏数据，但不能让系统正确性依赖手动清理。口径如下：

1. 旧模拟卷误标为真题：改 `sourceType/status` 或归档，不进入趋势画像。
2. 旧题缺 lineage：批量标记 `unknown_legacy`，学生端不抽；后台可查。
3. 旧候选未过新门禁：保留为异常候选或清理，不允许作为合格数。
4. 旧已入库题如果缺双语、缺数学渲染规范或缺版本信息：进入 `stale_needs_review` 或 `retired`。
5. 新上传真实 past paper 后：自动触发单题画像、趋势画像、两个 generation profiles、版本治理和自动补题唤醒。
6. 新大纲应用后：旧 topic 映射和旧 generation profiles 必须 stale，旧 queued/running 任务归档。

#### 新增代码时的检查清单

任何后续改动，只要碰到上传、画像、出题、入库或学生端抽题，都必须回答并落实以下检查：

1. 这个入口读取的是 source document、source question、series profile，还是 generation profile？
2. 是否限定了 `sourceType = past_paper`？
3. 是否限定了 `subject + syllabusVersion`？
4. 是否比较了当前 `sourceSnapshotHash` 和 `syllabusSnapshotHash`？
5. 是否明确了 `targetUseCase`？
6. 是否写入或保留了 `generationProfileId/seriesProfileId/sourceQuestionIds`？
7. 是否写入或保留了 `versionGovernance`？
8. 如果失败，是 blocked、waiting、retrying、failed 还是 archived？停止条件是什么？
9. 前端是否能看到 task id、阶段、数量、原因和下一步？
10. 是否有 rules 或 smoke 覆盖，防止后续回归？

#### 最终判断

这套方案是可执行的，且和现有架构契合；但它的完成标准必须是“状态机闭环完成”，不是“按钮能点、任务能建、候选能生成”。后续最需要继续补的不是新表，而是：

1. 更真实的化学/物理 `past_paper` fixture。
2. 线上自动任务观测面板的真实浏览器/线上验收：静态规则和前端构建已覆盖当前任务、阻塞原因、停止条件和最新画像版本字段，仍需用真实 queued/running/blocked 任务截图确认展示密度和刷新体验。
3. source profile pipeline 的浏览器 DOM 回归已补齐；后续只剩可选截图验收，用于确认不同屏宽下的视觉密度和颜色提示是否足够清晰，不再是功能阻断项。
4. 科目训练按 cell 目标自动补齐的长循环 runtime 回归：已有 smoke 覆盖 basic/medium/hard cell 闭环，仍建议在真实数学/化学/物理数据上各跑一次，确认 provider 波动下不会无限增长候选。

只要这些补齐，新增月份真题、更新大纲、扩展多 Provider、清理旧题、科目训练全自动补题和在线模考整卷生成，都可以继续沿用同一套架构，不需要再次推翻重做。

## 21. 最终补强：架构契合、漏洞关闭与执行门槛

本节作为后续执行的最终口径。前文已经证明方案和现有架构契合，但真正能否完成，取决于是否把“事实源、画像、出题画像、自动任务、题库资产、学生端消费”六层状态机全部接严。

### 21.1 目标为什么此前没有真正完成

此前目标没有完成，不是因为表结构无法支撑，而是因为链路中存在几个半连接点：

1. 真题 JSON 导入后，单题画像、趋势画像和两个 use case 的 generation profile 不是严格事件驱动，部分场景仍依赖手动按钮或历史任务状态。
2. pipeline 的“完成”曾经更接近“任务执行完”，而不是“当前 active 真题已经足够映射并形成 fresh 出题画像”。
3. 科目训练和在线模考虽然都能生成题，但完成条件不同：科目训练看库存 cell，在线模考看 48 个题位；这两个目标不能共用候选数量作为完成标准。
4. 候选题、已入库题、正式专项题和模考装配题如果缺少 `versionGovernance`，学生端和后台就无法稳定区分新旧、用途和画像版本。
5. 前端一度只能看到“运行中/已完成”，看不到映射缺口、低置信、疑似超纲、stale profile、旧任务归档等真实阻塞原因。

因此剩余工作的核心不是再加按钮，而是把状态机闭环补齐。

### 21.2 当前架构是否足够承载

结论：足够承载，不需要推翻。

| 架构层 | 当前承载 | 是否需要重建 | 必须补强 |
|---|---|---:|---|
| 真题事实源 | `csca_source_documents` / `csca_source_questions` | 否 | 只接受 `past_paper`，并写清月份、语言、状态；mock/prediction/practice 走资源隔离模块 |
| 单题画像 | source question analysis / mapping metadata | 否 | 映射覆盖、低置信、疑似超纲必须结构化写回 |
| 连续月份趋势画像 | `csca_exam_series_profiles` | 否 | 只聚合 active past paper，并使用 source/syllabus snapshot 判断 freshness |
| 当前出题画像 | `csca_generation_profiles` | 否 | `subject_practice` 和 `online_mock_exam` 必须分开 active、分开 fresh |
| 生成任务 | `csca_ai_questioning_tasks` / generation jobs | 否 | queued/running 任务必须记录并校验 generation lineage |
| AI 题资产 | `csca_questions` + metadata | 否 | 候选、已入库、装配、正式专项题都必须保留 `versionGovernance` |
| 学生端消费 | 现有科目训练/自适应/模考服务 | 否 | 只消费 `current` / `legacy_usable` / 手工正式题 |

真正的架构变化是“编排和约束”增强，不是“重建数据库和业务模块”。

### 21.3 必须关闭的最后漏洞

以下漏洞不关闭，就不能认为自动画像和自动出题闭环完成：

| 漏洞 | 必须关闭方式 | 验收方式 |
|---|---|---|
| pipeline succeeded 但映射未完整 | `succeeded` 前重新按当前 active source facts 计算 mapping coverage | 构造 19/48 映射场景，前端显示 `source_mapping_incomplete`，不能显示 completed |
| generation profile stale 仍生成 | worker 启动前和每题执行前校验 `generationProfileId/sourceSnapshotHash/syllabusSnapshotHash/useCase` | 切换 active profile 后，旧 queued/running task 归档为 `archived_stale_profile` |
| 科目题和模考题混用 | 题目 metadata、候选提升、入库、装配都校验 `targetUseCase` | `subject_practice` 题不能进入模考装配，`online_mock_exam` 题不能进入专项题库 |
| 候选无限增长 | 完成条件改为正式可用资产达标，不是候选数量达标 | 科目训练按 cell 达标；模考按 48/48 题位达标 |
| 未过门禁题被算合格 | 自动入库/装配只允许门禁通过且 versionGovernance 可用 | 待复审、建议重生、人工确认题不计入自动完成数 |
| unknown legacy 题进入学生端 | 缺 versionGovernance 默认 `unknown_legacy` 并被学生端过滤 | 科目训练、自适应、错题、AI Coach、模考入口均过滤 |
| 真题趋势混入模拟卷 | 真题画像入口拒绝非 `past_paper`，趋势画像查询也强制 `sourceType = past_paper` | 上传 prediction/mock 不会创建画像源，也不改变 past paper trend profile |
| 刷新按钮触发副作用 | 刷新只允许 GET/list，不允许 import/rebuild/generate | 前端 rules 测试锁定刷新行为 |

### 21.4 执行顺序必须按风险排序

后续实现不要从“页面体验”开始，而要按这个顺序：

1. **后端事实源与 pipeline 完成语义**
   - 导入、重解析、大纲应用、服务重启、单题画像完成都进入同一条 `source_profile_pipeline`。
   - `completed/succeeded` 必须代表映射覆盖、趋势画像、两个 generation profiles 和 version governance 都完成。

2. **fresh generation profile 强校验**
   - 科目训练和在线模考生成前都调用同一套 readiness。
   - 缺 fresh profile 时直接 blocked，不 fallback 到 style profile。

3. **use case 隔离**
   - 所有候选提升、自动入库、模考装配、专项题发布都校验 `targetUseCase`。
   - 两条线共享大纲和真题趋势源，但题库资产和完成条件分开治理。

4. **版本治理落库**
   - 新生成题落库时立刻写 `versionGovernance`。
   - active generation profile 切换后批量重算旧题。
   - 学生端以落库状态为准，不临时猜。

5. **前端观测和恢复**
   - 共用准备区展示 source/pipeline/profile/version 四层状态。
   - 科目训练线和在线模考线分别展示正式资产、异常候选、阻塞原因和下一步动作。
   - 恢复工具只能显式重跑 pipeline，不替代正常自动流程。

6. **最后开启全自动补题**
   - 科目训练按库存矩阵闭环。
   - 在线模考按 48 题位闭环。
   - provider/key 池和并发限制作为运行保护。

### 21.5 最终完成定义

以下全部满足，才算这次目标真正完成：

1. 上传真实 `past_paper` JSON 后，无需手动按钮，自动完成单题画像、趋势画像、两个 generation profiles、版本治理和自动补题唤醒。
2. 新增月份真题后，新趋势画像自动 supersede 旧画像；新题使用新 profile；旧题变成 `legacy_usable`、`stale_needs_review` 或 `unknown_legacy`。
3. 大纲更新后，旧映射和旧 generation profile 自动 stale；旧 queued/running 任务不会继续入库。
4. 科目训练一次补题的目标是所有目标 cell 的正式可用题达标，并覆盖预设难度比例。
5. 在线模考一次生成的目标是 48/48 题位都有门禁通过、版本可用、可装配题。
6. 候选池只显示未入库异常候选；已通过门禁并入库/装配的题进入正式资产区，并展示在候选区上方。
7. 学生端所有入口都不消费 `unknown_legacy`、`stale_needs_review`、`retired`。
8. 前端可以看到 pipeline 阶段、task id、映射覆盖、低置信、疑似超纲、blocked reason、next action、当前 profile 版本。
9. 规则测试、smoke、前端构建、后端构建和至少一个真实浏览器 DOM 回归通过。

### 21.6 对开发阶段数据清理的口径

开发阶段允许清理旧脏数据，但系统正确性不能依赖“每次都清库”。清理口径如下：

1. 误标为真题的模拟卷/预测卷：改 source type 或归档，不参与趋势画像。
2. 旧 AI 题缺 lineage：批量标记 `unknown_legacy`，学生端不抽。
3. 旧候选未过当前门禁：保留为异常候选或清理，不计入正式资产。
4. 旧已入库题缺双语、缺渲染规范、缺版本信息：进入 `stale_needs_review` 或 `retired`。
5. 新上传真实真题后，以新 pipeline 和新 generation profile 为准，不手动把旧任务迁移到新画像。

### 21.7 本方案的最终判断

方案现在已经达到可执行级别：数据表能承载，业务线能分叉，风险点有明确关闭方式，验收标准也可以落到 rules、smoke 和浏览器回归。

后续真正要做的是按本节执行实现和验证，而不是继续扩写方案。若执行中发现新的缺口，必须先判断它属于哪一层状态机，再补到对应规则和测试里，不能用前端按钮或人工说明绕过后端状态约束。
