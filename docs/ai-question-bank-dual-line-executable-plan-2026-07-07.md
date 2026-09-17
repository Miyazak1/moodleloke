# AI 题库双线闭环可执行方案

> 日期：2026-07-07  
> 状态：执行级方案  
> 范围：AI 题库后台、科目训练 AI 出题、在线模考 AI 出题、真题画像、大纲基线、候选治理、正式题库入库、数学符号渲染  
> 目标：把当前 AI 出题从“候选题不断生成”收束为“科目训练线和在线模考线各自补齐合格题，并自动进入对应正式题库”的稳定闭环。

## 1. 结论

当前在线模考 AI 出题的闭环已经接近可用：按真题画像生成整卷蓝图，按 48 个题位持续生成、优化、复审，满 48 道门禁通过题后可装配草稿卷。

下一步重点应转向科目训练线，并同步收口两条线的隔离问题：

```text
共用上游：
  1. 大纲基线
  2. 真题画像源

分叉后：
  A. 科目训练线
     topic / gap -> AI 生成或修复 -> 门禁通过 -> 专项/科目训练正式题库

  B. 在线模考线
     source paper -> 整卷蓝图 -> 48 题位 -> AI 生成或修复 -> 门禁通过 -> 在线模考题库 -> 草稿卷
```

核心规则：

1. 大纲基线共用。
2. 真题画像源共用，但消费方式分叉。
3. 分叉后的候选、任务、正式资产、质量治理、台账必须分开。
4. 科目训练不能以“候选数量”作为成功标准，只能以“正式训练题入库数量”作为成功标准。
5. 在线模考不能以“候选数量”作为成功标准，只能以“当前卷 48/48 题位均有合格题”作为成功标准。
6. `human_review`、`needs_edit`、`review_failed`、`fallback`、`regenerate` 都不能自动进入正式题库。
7. 可修复问题优先原题优化；硬伤才重生。
8. 旧数据可以保留，但新主链路不再以旧兼容逻辑为核心。

## 2. 现状判断

### 2.1 已完成或接近完成

- 大纲基线已经存在，数学、物理、化学都可以有大纲。
- 真题 JSON 导入和画像链路已经存在，数学已有可用画像。
- 在线模考已经具备：
  - 来源卷选择。
  - 整卷蓝图。
  - 题位加载。
  - 自动补齐 48 道合格题。
  - 合格题进入在线模考候选池。
  - 草稿卷装配入口。
- AI 题 metadata 已经开始记录：
  - 生成时间。
  - 更新版本。
  - schema。
  - prompt。
  - provider / model。
  - 画像来源。
  - intended use。
- 前端已经初步按“共用准备 / 科目训练线 / 在线模考线”拆分。

### 2.2 仍然存在的问题

1. 科目训练线还没有形成完整闭环  
   现在容易出现“候选越来越多，合格训练题没有增加”。

2. 科目训练线与在线模考线存在残余混用  
   例如切换卷后仍显示前一卷候选；模考生成可能影响科目题生成队列；候选列表未严格按业务线过滤。

3. 科目训练失败策略不够精细  
   当前更偏“失败后重新生成”，但很多失败其实可以原题修复，例如选项过近、多答案、答案标注错误、解析不完整、英文版本缺失。

4. 候选治理面板职责不清  
   如果合格题会自动入库，候选治理面板就不应展示所有候选，而应展示“未入库异常候选”。

5. 清理能力不足  
   开发阶段需要按学科、topic、卷、任务范围清理 AI 生成数据，否则旧题污染测试。

6. 数学符号渲染仍有质量问题  
   管理后台、科目题、在线模考题都需要统一渲染策略。当前存在 LaTeX 未解析、符号重叠、长解析布局被撑乱等问题。

## 3. 目标状态

### 3.1 科目训练线目标

科目训练线的目标不是生成候选，而是补齐正式训练题。

```text
Topic / Gap
-> 目标合格题数
-> 当前正式训练题数
-> 差额
-> 自动生成 / 原题修复 / 重生
-> 门禁通过
-> 自动入专项/科目训练题库
-> 达标后停止
```

Topic 达标条件：

```text
approvedPracticeCount >= targetPracticeCount
```

Gap 达标条件：

```text
approvedPracticeCount for this targetProfile >= neededCount
```

### 3.2 在线模考线目标

在线模考线的目标是一套卷完整可装配。

```text
Mock paper source
-> 整卷蓝图
-> 48 个题位
-> 每个题位 1 道门禁通过题
-> 自动进入在线模考题库
-> 48/48 后可装配草稿卷
```

整卷达标条件：

```text
readySlotCount = 48
approvedMockCandidateCount = 48
```

### 3.3 候选治理目标

候选治理不再是“发布前必经人工审核队列”，而是“异常候选治理区”。

展示范围：

- `review_failed`
- `needs_edit`
- `human_review`
- `regenerate`
- `fallback`
- `blocked`
- 管理员手工退回的题

不展示范围：

- 已自动入科目训练题库的题。
- 已进入在线模考候选池并可装配的题。

## 4. 数据边界

### 4.1 业务线字段

所有 AI 生成题必须能明确归属。

```ts
type AIQuestionUseCase =
  | 'subject_practice'
  | 'online_mock_exam';

type AIQuestionIntendedUse =
  | 'subject_practice'
  | 'mock_candidate'
  | 'diagnostic'
  | 'wrong_question_review';
```

建议统一写入 `generation_metadata`：

```ts
type GenerationScopeMetadata = {
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

  sourceKind:
    | 'syllabus_only'
    | 'syllabus_and_past_paper_profile'
    | 'mock_exam_blueprint_slot';
};
```

硬规则：

- 科目训练题必须有 `targetUseCase = subject_practice`。
- 在线模考题必须有 `targetUseCase = online_mock_exam`。
- 旧数据缺 `targetUseCase` 时，默认进入 `legacy`，不参与新闭环自动统计。

### 4.2 正式题库分开

`csca_questions` 可以继续作为 AI 生成题资产底表，但正式可消费题库必须分开判断。

```text
科目训练：
  csca_questions
  -> subject / special practice mapping
  -> 用户侧科目训练可抽题

在线模考：
  csca_questions
  -> mock exam candidate pool / draft paper question mapping
  -> 用户侧在线模考可组卷
```

不要只用 `csca_questions.status = approved` 判断是否正式可用。

### 4.3 候选查询强过滤

所有后台查询必须带 scope：

```ts
{
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject?: string;
  topicId?: number;
  mockSourcePaperId?: number;
  mockBlueprintId?: number;
  mockSlotNumber?: number;
}
```

前端切换以下任一条件时，必须清空旧列表并重新加载：

- useCase。
- subject。
- status。
- mock source paper。
- mock blueprint。
- topic。

## 5. 状态机

### 5.1 科目训练 topic 状态

```ts
type SubjectTopicStatus =
  | 'missing_syllabus'
  | 'missing_blueprint'
  | 'needs_generation'
  | 'generating'
  | 'repairing'
  | 'ready'
  | 'blocked';
```

状态含义：

- `missing_syllabus`：该学科没有已应用大纲。
- `missing_blueprint`：topic 没有可用出题蓝图。
- `needs_generation`：正式训练题未达标，需要补齐。
- `generating`：正在生成新候选。
- `repairing`：正在修复可修候选。
- `ready`：正式训练题达标。
- `blocked`：连续无进展或缺必要画像/Provider。

### 5.2 科目训练 job 状态

```ts
type SubjectPracticeJobStatus =
  | 'queued'
  | 'running'
  | 'repairing'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'cancelled';
```

`completed` 的唯一含义：

```text
当前 job 覆盖的 topic/gap 已达到目标正式训练题数量。
```

### 5.3 在线模考 job 状态

```ts
type OnlineMockJobStatus =
  | 'queued'
  | 'running'
  | 'repairing'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'cancelled';
```

`completed` 的唯一含义：

```text
当前 mock blueprint 的所有题位都有 1 道门禁通过并已进入在线模考题库的候选。
```

## 6. 门禁标准

### 6.1 自动入库条件

题目必须同时满足：

1. 业务线匹配。
2. 不是 fallback。
3. 不是 smoke/test 数据。
4. 题干、选项、答案、解析完整。
5. 答案唯一且解析一致。
6. 未超纲。
7. topic / slot 匹配。
8. 与真题和已入库题不高度相似。
9. 通过 reviewer 门禁。
10. 如系统要求双语，则中英文版本完整。
11. 数学符号可渲染，不存在明显 LaTeX 结构损坏。

### 6.2 不能自动入库的状态

以下状态不能进入正式题库：

- `pending_review`
- `human_review`
- `needs_edit`
- `review_failed`
- `fallback`
- `regenerate`
- `rejected`
- `archived`
- `blocked`

### 6.3 软警告处理

软警告不应直接降低门禁，但可以驱动自动修复。

软警告示例：

- 选项区分度不足。
- 干扰项过弱。
- 英文版本缺失。
- 解析步骤不足。
- 轻微阅读量/计算量偏差。
- 画像贴合证据不足但题目本身可用。

## 7. 修复与重生分流

### 7.1 可原题修复

优先原题修复的问题：

- 正确答案标注错误。
- 多个正确答案，但题干核心可保留。
- 选项过近、过弱、重复。
- 干扰项不能体现错因。
- 解析和答案不一致。
- 解析缺关键步骤。
- 英文版本缺失或双语 metadata 缺失。
- LaTeX 表达轻微格式错误。
- 难度、阅读量、计算量轻微偏差。
- reviewer 给出 `human_review` 的原因是软警告。

修复后必须重新 validator + reviewer，不能直接入库。

### 7.2 必须重生

直接重生的问题：

- 超纲。
- topic mismatch。
- mock slot mismatch。
- 与真题高度相似。
- 与已入库题高度相似。
- 题干逻辑不成立。
- 题目核心与目标画像完全不符。
- provider 返回结构损坏，无法可靠修复。
- 数学表达不可恢复。

### 7.3 阈值

建议配置：

```ts
const REPAIR_MAX_ATTEMPTS_PER_QUESTION = 2;
const REGENERATE_MAX_ATTEMPTS_PER_GAP = 20;
const NO_PROGRESS_BLOCK_THRESHOLD = 10;
```

解释：

- 一道题最多原题修复 2 次。
- 一个 gap 可以重生多次，但要有无进展保护。
- 连续 10 次没有新增合格题，则进入 `blocked`，提示检查 prompt、画像、provider 或门禁原因。

## 8. 后端改造任务

### 8.1 Scope 标准化

位置：

- `backend/src/ai-questioning/ai-questioning.service.ts`
- `backend/src/csca-mock-exam/csca-mock-exam.service.ts`
- AI question admin controller / DTO

任务：

1. 新增或统一 `normalizeQuestionUseCase(metadata)`。
2. 新增或统一 `isSubjectPracticeQuestion(metadata)`。
3. 新增或统一 `isOnlineMockQuestion(metadata)`。
4. 所有候选、已审核资产、台账、质量治理查询都必须用 useCase 过滤。
5. 旧题缺 useCase 时不参与新闭环统计。

验收：

- 切换数学卷 1 / 卷 2，不串候选。
- 科目训练线不显示在线模考题。
- 在线模考线不显示科目训练题。

### 8.2 科目训练 gap 计算

位置：

- `deriveTopicQuestionGap`
- topic health query
- style profile normalizer

任务：

1. `approvedPracticeCount` 从正式专项/科目训练映射统计，不从候选数统计。
2. gap 维度包含：
   - difficultyBand。
   - questionForm。
   - cognitiveSkill。
   - readingLoad。
   - calculationLoad。
3. 数学有画像时，不应大量输出 `unknown`。
4. 没有画像时，使用 syllabus-only 策略，前端明确标记。

验收：

- 数学 topic 能看到“目标几道、已合格几道、还差几道”。
- `unknown` 不再成为主生成目标。

### 8.3 科目训练自动补齐闭环

新增或收敛服务：

```ts
fulfillSubjectPracticeGap(scope)
processSubjectPracticeJob(jobId)
generateSubjectPracticeCandidate(job)
repairSubjectPracticeCandidate(questionId)
publishSubjectPracticeCandidate(questionId)
```

伪代码：

```ts
while (approvedCount < targetCount) {
  const candidate = await nextCandidateOrGenerate();
  const review = await reviewCandidate(candidate);

  if (review.gate.publishable) {
    await publishToSubjectPracticeBank(candidate);
    approvedCount += 1;
    noProgressCount = 0;
    continue;
  }

  const strategy = decideRepairStrategy(review);

  if (strategy === 'repair_in_place' && repairAttempts < maxRepairAttempts) {
    await repairCandidate(candidate);
    continue;
  }

  if (strategy === 'hard_regenerate') {
    await generateReplacementForSameGap();
    noProgressCount += 1;
    continue;
  }

  noProgressCount += 1;

  if (noProgressCount >= threshold) {
    markBlocked(review.reasons);
    break;
  }
}
```

验收：

- 点击“补齐合格训练题”后，系统目标是补正式题，不是补候选。
- 合格题自动入专项/科目训练题库。
- 达标后停止生成。
- 无进展时 blocked，不无限增加候选。

### 8.4 在线模考闭环收口

位置：

- `backend/src/csca-mock-exam/csca-mock-exam.service.ts`
- mock exam generation endpoints

任务：

1. job 与 `mockBlueprintId` 强绑定。
2. candidate 与 `mockBlueprintSlotId` 强绑定。
3. 每个 slot 达标后不继续生成。
4. 整卷 48/48 达标后，job completed。
5. 装配草稿卷只读取当前 blueprint 的 48 道已合格题。

验收：

- 卷 2 不显示卷 1 候选。
- 48/48 后不能继续为同一卷无意义生成。
- 装配后状态从“待装配”切为“已装配/草稿卷 ID”。

### 8.5 清理能力

新增后台清理 API：

```text
POST /admin/ai-questioning/cleanup
```

请求：

```ts
type CleanupRequest = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject?: string;
  topicId?: number;
  mockBlueprintId?: number;
  mockSourcePaperId?: number;
  includeCandidates?: boolean;
  includeJobs?: boolean;
  includeApprovedAssets?: boolean;
  includeDraftPapers?: boolean;
};
```

要求：

- 默认只清未入库候选和任务。
- 删除已入库资产必须二次确认。
- 不能跨 useCase 删除。
- 写审计日志。

验收：

- 可以清数学科目训练测试题。
- 可以清数学模考卷 1 的 AI 结果。
- 不影响其他学科和其他卷。

### 8.6 数学符号规范化

新增或收敛工具：

```ts
normalizeMathText(input: string): string
validateMathText(input: string): MathValidationResult
```

后端入库前处理：

1. 修复常见转义错误，例如 `\\(`、`\\frac`、多余 `$`。
2. 保留标准 LaTeX。
3. 标记不可渲染表达。
4. reviewer 对不可渲染表达输出 `needs_edit` 或 `regenerate`。

前端渲染要求：

- 题干、选项、解析、英文版本统一走同一个 `MathText` / `RichText` 组件。
- 行内数学和块级数学分开处理。
- 长公式允许换行，不撑破容器。
- 解析区不能因为 KaTeX inline 元素导致数字和符号重叠。

验收：

- 科目训练题、在线模考题、候选治理、已审核资产都能正常显示数学符号。
- 长解析不重叠、不撑破卡片。

## 9. 前端改造任务

### 9.1 页面结构

AI Question Bank 页面固定为：

```text
1 共用准备
  - 大纲基线
  - 真题画像源

2 科目训练线
  - 知识点题库健康
  - 缺题画像
  - 自动补齐合格训练题
  - 异常候选治理
  - 已审核科目资产
  - 科目质量治理

3 在线模考线
  - 来源卷
  - 整卷蓝图
  - 题位
  - 自动补齐 48/48
  - 异常候选治理
  - 已审核模考资产
  - 草稿卷装配
```

### 9.2 科目训练线文案

主按钮：

- `补齐合格训练题`
- `按缺题画像补齐`
- `处理可修复候选`
- `清理当前范围测试数据`

避免把主动作写成：

- `追加候选`
- `生成候选`

候选可以作为过程指标，但不是目标。

### 9.3 在线模考线文案

主按钮：

- `生成/加载整卷蓝图`
- `加载题位`
- `启动自动补齐 48/48`
- `唤醒自动补齐`
- `装配已完成草稿卷`
- `清理当前卷 AI 结果`

状态文案：

```text
整卷完成：48/48 已通过门禁并进入在线模考题库，可装配草稿卷。
```

### 9.4 候选治理面板

候选治理标题：

```text
待治理候选
```

说明：

```text
这里展示未入库的异常候选，用于查看失败原因、复审、编辑、拒绝或归档；门禁通过题会自动进入对应正式题库。
```

列表默认排序：

1. 最近失败 / 最近生成在前。
2. 当前 scope 在前。
3. 可修复优先。
4. blocked 最后。

### 9.5 局部刷新

必须支持：

- 刷新当前候选面板。
- 刷新当前任务状态。
- 刷新当前已审核资产。
- 自动刷新 running / repairing / queued 任务。

刷新不能：

- 跳回总览。
- 丢失当前 tab。
- 丢失当前 subject。
- 丢失当前 mock paper。
- 丢失当前分页。

## 10. 数据迁移与线上处理

### 10.1 新字段策略

优先使用 JSON metadata 扩展，稳定后再拆强类型列。

需要补齐：

- `generation_metadata.targetUseCase`
- `generation_metadata.intendedUse`
- `generation_metadata.sourceKind`
- `generation_metadata.subject`
- `generation_metadata.topicId`
- `generation_metadata.mockBlueprintId`
- `generation_metadata.mockBlueprintSlotId`
- `review_metadata.gate`
- `review_metadata.repairStrategy`
- `review_metadata.localization`

### 10.2 Backfill

新增脚本：

```text
npm run ai-questioning:backfill-use-case
```

推断规则：

- 有 `mockExamSlot` / `mockBlueprintSlotId` / `generationMode = online_mock_exam_candidate` -> `online_mock_exam`。
- 有 `intendedUse = subject_practice` 或 topic blueprint -> `subject_practice`。
- 无法判断 -> `legacy`。

`legacy` 不自动进入新闭环。

### 10.3 上线步骤

1. 停止后台 worker。
2. 备份数据库。
3. 部署代码。
4. 跑 backfill。
5. 跑 useCase 隔离校验。
6. 启动后端。
7. 只开启数学单 topic 测试。
8. 验证科目训练闭环。
9. 再开启数学全量。
10. 最后扩展物理、化学。

### 10.4 回滚

如果自动闭环异常：

1. 关闭自动补齐 feature flag。
2. 保留手工题库功能。
3. 新生成候选批量归档。
4. 在线模考线和科目训练线互不影响。

## 11. 测试计划

### 11.1 后端单元测试

必须覆盖：

- `normalizeQuestionUseCase`
- `deriveTopicQuestionGap`
- `decideRepairStrategy`
- `publishSubjectPracticeCandidate`
- `publishOnlineMockCandidate`
- `cleanupAiQuestioningScope`
- `normalizeMathText`

### 11.2 后端服务测试

必须覆盖：

1. 数学有画像时，科目训练生成 metadata 包含画像来源。
2. 没有画像时，不误报缺大纲。
3. 科目训练合格题自动进入专项/科目训练题库。
4. 科目训练不合格题进入待治理候选。
5. 在线模考卷 1 和卷 2 候选隔离。
6. 在线模考 48/48 后停止继续生成。
7. 清理当前 scope 不影响其他 scope。

### 11.3 前端测试

必须覆盖：

- 切换 subject 后候选列表刷新。
- 切换 mock paper 后候选列表刷新。
- 候选治理不展示已入库题。
- 局部刷新不跳 tab。
- 数学符号组件在题干、选项、解析中正常渲染。

### 11.4 手工验收

#### 科目训练

```text
1. 清理数学某 topic 的 AI 科目训练数据。
2. 确认数学有 active 真题画像。
3. 点击补齐合格训练题。
4. 观察正式训练题数量增长。
5. 观察异常候选只保留未入库题。
6. 达标后任务 completed。
7. 用户侧科目训练能抽到新题。
```

#### 在线模考

```text
1. 清理数学模拟卷 1 的 AI 生成结果。
2. 生成/加载整卷蓝图。
3. 加载题位。
4. 启动自动补齐。
5. 等待 48/48 合格。
6. 确认候选进入在线模考题库。
7. 装配草稿卷。
8. 切换卷 2，确认不显示卷 1 的题。
```

#### 数学符号

```text
1. 打开候选治理。
2. 打开已审核资产。
3. 打开用户侧科目训练题。
4. 打开在线模考草稿题。
5. 检查题干、选项、解析、英文版本。
6. 确认无 LaTeX 原文泄露、无符号重叠、无布局撑破。
```

## 12. 推荐实施顺序

### 阶段 1：先补清晰边界

1. useCase normalizer。
2. 查询强过滤。
3. 前端切换 scope 清空旧列表。
4. 候选治理只显示异常候选。
5. 当前 scope 清理 API。

完成后解决“卷 2 显示卷 1 题”“科目和模考混在一起”的问题。

### 阶段 2：科目训练闭环

1. topic/gap 目标正式题数量。
2. 科目训练自动生成/修复/重生。
3. 合格题自动入科目训练题库。
4. 达标停止。
5. 无进展 blocked。

完成后解决“候选一直增加但合格题没有”的问题。

### 阶段 3：修复优先

1. reviewer 输出 repair feedback。
2. 可修问题原题修复。
3. 不可修问题重生。
4. 修复后复审。

完成后提高通过率，减少无效候选膨胀。

### 阶段 4：在线模考收口

1. mock blueprint / slot 强绑定。
2. 48/48 后停止生成。
3. 装配后状态同步。
4. 当前卷清理。

完成后在线模考线可以稳定测试多套卷。

### 阶段 5：数学符号统一渲染

1. 后端规范化。
2. 前端统一 MathText 组件。
3. 候选、已审核、用户侧共用。
4. 长公式和解析布局回归。

完成后解决数学题展示质量问题。

## 13. 第一轮最小可交付切片

建议第一轮只做数学，范围尽量小：

```text
subject = math
useCase = subject_practice
topic = 选择 1 个数学 topic
targetApprovedCount = 3
```

必须交付：

1. 清理当前 topic 测试数据。
2. 点击补齐合格训练题。
3. 系统自动生成/修复/重生。
4. 3 道门禁通过题自动入科目训练题库。
5. 候选治理只显示异常题。
6. 用户侧能抽到新题。
7. 数学符号显示正常。

这个切片通过后，再扩大到：

```text
数学全 topic -> 在线模考多卷隔离 -> 物理/化学
```

## 14. 完成定义

本方案真正完成时，应满足：

1. 大纲和画像作为共用上游清晰展示。
2. 科目训练线和在线模考线前端完全分叉。
3. 两条线的候选、任务、资产、质量治理、台账按 scope 隔离。
4. 科目训练按正式训练题数量达标。
5. 在线模考按 48/48 题位达标。
6. 合格题自动进入对应正式题库。
7. 不合格题进入待治理候选。
8. 可修复问题优先原题修复。
9. 硬伤问题自动重生。
10. 连续无进展会 blocked，不无限生成候选。
11. 清理功能可按当前 scope 安全重测。
12. 数学符号在后台和用户侧稳定渲染。

## 15. 执行任务拆解

本节把上面的方案拆成可以直接开工的工程任务。开发时建议按编号推进，不要同时打开所有面。

### 15.1 P0：数据边界与查询隔离

目标：先解决“科目题、模考题、不同卷候选互相串”的根问题。

后端改造点：

- `backend/src/ai-questioning/ai-questioning.service.ts`
  - 增加统一 scope normalizer：`targetUseCase`、`intendedUse`、`subject`、`topicId`、`mockSourcePaperId`、`mockBlueprintId`、`mockBlueprintSlotId`。
  - 所有候选查询、已审核资产查询、台账查询、批量动作查询都必须走同一个 scope builder。
  - 缺 `targetUseCase` 的旧数据标记为 `legacy`，默认不参与新闭环统计。
- `backend/src/csca-mock-exam/csca-mock-exam.service.ts`
  - mock 生成、装配、候选池读取必须强绑定 `mockBlueprintId`。
  - 装配草稿卷只能读取当前 blueprint 的 48 道合格题。
- `backend/src/ai-questioning/ai-questioning.controller.ts`
  - 管理接口参数统一接受 `useCase`、`subject`、`topicId`、`mockSourcePaperId`、`mockBlueprintId`。
  - 如果 `useCase = online_mock_exam` 但没有 `mockBlueprintId` 或 `mockSourcePaperId`，候选列表返回空并提示先选卷，不允许回退到全局候选。

前端改造点：

- `frontend/src/pages/AdminAIQuestionBankPage.tsx`
  - 切换 `useCase`、`subject`、`mockSourcePaperId`、`mockBlueprintId` 时，立即清空候选、已审核资产、任务列表，再重新请求。
- `frontend/src/components/admin/ai-question-bank/useCandidateDataRefresh.ts`
  - 请求候选、任务、台账时必须携带当前 scope。
- `frontend/src/components/admin/ai-question-bank/useQuestionBankInitialData.ts`
  - 首次加载也必须按 scope 取数，不能用上一次页面状态兜底。

验收：

1. 选择数学模拟卷 1，只显示卷 1 的候选和任务。
2. 切到数学模拟卷 2，卷 1 的题立即消失。
3. 科目训练线不显示 `mock_candidate`。
4. 在线模考线不显示 `subject_practice`。
5. 旧 legacy 题不参与“已合格 / 已入库 / 48 满额”统计。

### 15.2 P0：清理与重测能力

目标：开发阶段可以安全清理当前范围数据，避免旧候选污染判断。

后端接口：

```text
POST /api/v1/admin/ai-questioning/cleanup
```

请求结构：

```ts
type AiQuestioningCleanupRequest = {
  targetUseCase: 'subject_practice' | 'online_mock_exam';
  subject?: 'math' | 'physics' | 'chemistry';
  topicId?: number;
  mockSourcePaperId?: number;
  mockBlueprintId?: number;
  includeCandidates?: boolean;
  includeJobs?: boolean;
  includeApprovedAssets?: boolean;
  includeDraftPapers?: boolean;
  confirmText?: string;
};
```

规则：

- 默认只清理未入库候选和任务。
- 清理已入库资产必须要求 `confirmText` 精确匹配后端返回的确认文本。
- 清理在线模考时必须带 `mockBlueprintId`，避免误删整科。
- 清理科目训练时至少带 `subject`，建议带 `topicId`。
- 所有清理动作写审计日志，记录 scope、数量、操作者、时间。

前端入口：

- 科目训练线：
  - `清理当前 topic 候选`
  - `清理当前 topic 任务`
  - `清理当前 topic 已入库 AI 题`
- 在线模考线：
  - `清理当前卷候选`
  - `清理当前卷任务`
  - `清理当前卷已入库 AI 题`
  - `清理当前卷草稿卷`

验收：

1. 清理数学卷 1 不影响数学卷 2。
2. 清理数学科目训练 topic 不影响在线模考。
3. 清理未入库候选后，已审核资产不减少。
4. 清理已入库资产必须二次确认。

### 15.3 P1：科目训练合格题闭环

目标：科目训练从“生成候选”改成“补齐正式可训练题”。

核心状态：

```ts
type SubjectPracticeGapFulfillment = {
  subject: string;
  topicId: number;
  gapKey: string;
  targetApprovedCount: number;
  approvedPracticeCount: number;
  queuedCount: number;
  runningCount: number;
  repairableCount: number;
  abnormalCandidateCount: number;
  noProgressCount: number;
  status: 'ready' | 'needs_generation' | 'generating' | 'repairing' | 'blocked';
};
```

后端任务：

- `deriveTopicQuestionGap()` 返回 gap 级目标，不只返回 topic 是否缺题。
- `topicQuestionBankHealth()` 统计正式入库题数量，不能用候选数当合格数。
- `runTopicAction(generate_candidates)` 改名或语义升级为 `fulfill_subject_practice_gap`。
- 生成循环以 `approvedPracticeCount >= targetApprovedCount` 为完成条件。
- 合格题通过门禁后自动发布到科目训练正式题库。
- 达标后禁止继续为同一 topic/gap 自动生成。
- 连续无新增合格题达到阈值后标记 `blocked`，停止烧 token。

闭环伪代码：

```ts
while (approvedPracticeCount < targetApprovedCount) {
  const candidate = await generateOrRepairCandidate(scope);
  const review = await reviewCandidate(candidate);

  if (review.gate.publishable) {
    await publishToSubjectPracticeBank(candidate.id);
    approvedPracticeCount += 1;
    noProgressCount = 0;
    continue;
  }

  const strategy = decideRepairStrategy(review);

  if (strategy === 'repair_in_place') {
    await repairCandidate(candidate.id, review.repairFeedback);
    continue;
  }

  await generateReplacement(scope);
  noProgressCount += 1;

  if (noProgressCount >= noProgressThreshold) {
    await markGapBlocked(scope, review.reasons);
    break;
  }
}
```

前端任务：

- `CoverageWorkPanel.tsx` 主文案改为 `补齐合格训练题`。
- topic 卡片展示：
  - 目标合格题。
  - 已入库合格题。
  - 还差几题。
  - 正在生成几题。
  - 待修复几题。
  - 阻塞原因。
- 候选治理只展示异常候选，不展示已自动入库题。

验收：

1. 清理数学某 topic 后，点击 `补齐合格训练题`。
2. 合格题数量增长，候选数量不是成功口径。
3. 达标后任务 completed，按钮显示已完成或不可重复生成。
4. 用户侧科目训练能抽到新入库题。
5. 未通过题进入待治理候选。

### 15.4 P1：在线模考 48 题闭环

目标：在线模考按“当前卷 48/48 合格题位”完成，不再以候选数量或任务完成作为成功。

后端任务：

- mock blueprint 每个 slot 只能统计当前 `mockBlueprintId` 的合格题。
- `readySlotCount = 48` 后：
  - job 标记 `completed`。
  - 停止继续为该 blueprint 生成。
  - 前端按钮显示 `整套已完成`。
- 装配草稿卷后：
  - 写入 draft paper id。
  - 48 道题状态从 `待装配` 切为 `已装配` 或记录 `draftPaperId`。

前端任务：

- `MockExamProductionPanel.tsx` 展示：
  - 当前卷。
  - 当前蓝图。
  - 题位总数。
  - ready slot。
  - 已入在线模考题库数。
  - 已装配草稿卷 id。
- 候选列表标题必须包含当前卷名，避免误解。
- 候选列表默认按当前 blueprint 过滤。

验收：

1. 当前卷达到 48/48 后不能再继续自动生成。
2. 选择卷 2 时，看不到卷 1 的已通过题。
3. 装配后，已通过的 48 题不再显示 `待装配`。
4. 草稿卷能在在线模考后台继续编辑/发布。

### 15.5 P1：修复优先策略

目标：减少“候选一直增加但合格题没有”的情况。

修复优先的问题：

- 正确答案标注错误。
- 多个正确答案但可通过改选项消歧。
- 选项过近、重复、过弱。
- 解析缺步骤或和答案不一致。
- 英文版本缺失。
- LaTeX 轻微错误。
- 轻微难度、阅读量、计算量偏差。
- `human_review` 原因是画像证据弱，但题目核心可用。

必须重生的问题：

- 超纲。
- topic mismatch。
- mock slot mismatch。
- 与真题或已入库题高度相似。
- 题干不可用。
- 核心逻辑错误。
- provider schema 严重损坏。
- 数学表达不可恢复。

后端任务：

- reviewer 输出标准化 `repairFeedback`。
- `decideRepairStrategy()` 只根据 reason code 和 gate decision 决策，不用中文错误文案做字符串匹配。
- 单题最多修复 2 次。
- 修复后必须重新 validator + reviewer。
- 修复通过后自动进入对应正式题库。

验收：

1. 多答案题会优先修复选项，不直接重生。
2. 缺英文题会优先补英文，不直接重生。
3. topic mismatch 会直接重生，不修原题。
4. 修复尝试次数和历史能在后台证据中看到。

### 15.6 P1：双语版本门禁

目标：避免已通过门禁的题缺英文版本。

规则：

- 若系统要求中英双语，自动入库必须同时满足：
  - 中文题干、选项、解析存在。
  - 英文题干、选项、解析存在。
  - bilingual metadata 标记完整。
- 缺英文不应算 `publishable`，应进入 `repair_in_place`。
- 后台已审核资产中显示“双语完整 / 缺英文 / 缺中文”。

后端任务：

- validator 增加 localization gate。
- reviewer 输出 `localization.hasZh`、`localization.hasEn`。
- repair prompt 支持只补英文版本，不改中文题目核心。

前端任务：

- Candidate / Published 卡片显示双语状态。
- `查看英文版本` 不应只作为折叠块存在，还要有明确缺失提示。

验收：

1. 缺英文题不会自动入库。
2. 补英文后可复审并自动入库。
3. 已审核资产列表不再大量显示“没有双语版本 metadata”。

### 15.7 P1：数学符号与富文本统一

目标：后台、科目训练、在线模考题都使用同一套数学文本规范化和渲染，避免 LaTeX 原文泄露和布局重叠。

后端任务：

- 增加 `normalizeMathText()`：
  - 修复裸 `\\frac`、`\\sqrt`、`\\leq` 等没有包裹 `$...$` 的情况。
  - 处理双反斜杠污染。
  - 识别无法恢复的表达并写入 gate issue。
- 增加 `validateMathText()`：
  - 题干、选项、解析、英文版本都检查。
  - 检查失败时进入 `needs_edit` 或 `repair_in_place`。

前端任务：

- 收敛到统一 `MathContent` / `RichMathContent` 组件。
- 不在普通 `<p>` 中直接混排长公式。
- 行内公式设置合理 line-height。
- 长公式允许换行。
- 解析区使用正常文本流，不把每段公式拆成窄 inline 盒子。

涉及页面：

- `frontend/src/components/admin/ai-question-bank/CandidateReviewPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/PublishedQuestionPanel.tsx`
- `frontend/src/components/admin/ai-question-bank/LedgerPanel.tsx`
- `frontend/src/pages/CscaSpecialPracticePage.tsx`
- `frontend/src/pages/CscaMockExamPage.tsx`
- `frontend/src/components/MathContent.tsx`
- `frontend/src/styles/math-content.css`

验收：

1. 题干中的 `\frac`、`\sqrt` 不裸露。
2. 选项中的区间、根号、分式不变成重复边框或嵌套卡片。
3. 解析中的根号和数字不重叠。
4. 长解析不撑破卡片。
5. 管理后台和用户侧显示一致。

### 15.8 P2：前端自动刷新与状态表达

目标：管理员不用刷新整页，也能看见生成、修复、入库进度。

任务：

- 生成队列有 `queued`、`running`、`repairing`、`auto_retry` 时，当前面板自动刷新。
- 候选列表新增局部 `刷新候选`。
- 新候选按 `updatedAt desc` 排序，新失败/新修复结果优先显示。
- 刷新不改变当前 tab、卷、学科、分页和筛选。
- 任务状态显示“还差几道合格题”，不只显示“生成中”。

验收：

1. 后台生成时，候选和已审核资产自动更新。
2. 手动点 `刷新候选` 不跳回流程总览。
3. 任务 completed 后，顶部和面板状态一致。

## 16. 开发验收矩阵

| 场景 | 前置条件 | 操作 | 必须结果 |
| --- | --- | --- | --- |
| 科目训练单 topic 补齐 | 数学有大纲、有画像，清理当前 topic AI 数据 | 点击补齐合格训练题 | 正式训练题增长到目标数，异常候选只保留未入库题 |
| 科目训练无画像 | 化学有大纲、无真题画像 | 点击补齐 | 不报“缺大纲”，提示 syllabus-only 或画像缺失策略 |
| 科目训练无进展 | Provider 连续生成不合格题 | 等待自动循环 | 达到阈值后 blocked，不无限生成候选 |
| 在线模考卷 1 | 数学卷 1 有蓝图 | 补齐整卷 | 48/48 后停止生成，可装配草稿卷 |
| 在线模考卷切换 | 卷 1 已有候选，选择卷 2 | 切换下拉框 | 卷 1 候选不显示，卷 2 独立加载 |
| 已装配状态 | 48 题已装配草稿卷 | 查看已审核资产 | 题目不再显示待装配，显示草稿卷关联 |
| 双语门禁 | 生成题缺英文版本 | 自动审题 | 不入库，进入修复或待治理 |
| 数学符号 | 分式、根号、区间、长解析 | 后台和用户侧查看 | 不裸露、不重叠、不撑破 |
| 清理当前 scope | 当前卷已有候选和任务 | 清理当前卷 | 只删除当前卷数据，不影响其他卷和科目线 |

## 17. 推荐分支与提交粒度

建议按以下提交粒度推进，便于回滚：

1. `scope-isolation`：useCase / blueprint / topic 查询隔离。
2. `cleanup-tools`：清理 API 和前端按钮。
3. `subject-gap-fulfillment`：科目训练合格题闭环。
4. `repair-strategy`：修复优先和 repair feedback。
5. `mock-blueprint-assembly-state`：在线模考 48/48 和装配状态收口。
6. `bilingual-gate`：双语门禁。
7. `math-rendering-unification`：数学符号后端规范化和前端统一渲染。

每个提交都必须至少跑：

```text
npm --prefix backend exec -- tsc -p backend/tsconfig.json --noEmit --incremental false --pretty false
npm --prefix frontend run build
```

涉及后端闭环逻辑时，再补：

```text
node scripts/csca-ai-questioning-rules-test.cjs
node scripts/csca-mock-exam-ai-generation-smoke.cjs
```

## 18. 当前优先级结论

短期最优先不是继续调 prompt，而是先保证闭环口径正确：

```text
1. scope 隔离
2. 清理重测
3. 科目训练按合格题达标
4. 修复优先
5. 双语与数学符号门禁
```

只有这五项稳定后，继续优化 prompt 才有意义。否则系统会继续表现为“候选越来越多，但正式可用题没有增长”，管理员也无法判断到底是 provider、画像、门禁还是前端显示的问题。
