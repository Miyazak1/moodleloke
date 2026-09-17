# 连续月份源卷趋势画像与出题画像方案

> 日期：2026-07-14  
> 范围：AI 题库后台、真题画像、科目训练 AI 出题、在线模考 AI 出题、模考卷/预测卷资源隔离  
> 目标：在保留现有单卷画像解析能力的基础上，新增“连续月份趋势画像”和“当前出题画像”，让 AI 出题不再过度依赖单份卷子，而是基于同一大纲下连续月份源卷的稳定规律、轮换规律和近期趋势。

## 1. 背景与结论

当前系统已经具备：

- 上传源卷 JSON。
- 拆成 `csca_source_documents` 和 `csca_source_questions`。
- 对源题做知识点映射、自动画像、确认入画像。
- 生成 `csca_question_style_profiles`，供科目训练和在线模考 AI 出题使用。

但现有机制更接近：

```text
一份源卷/一批源题
-> source questions
-> subject style profile
-> AI 出题
```

这在只有一份数学样本卷时可以跑通，但不适合长期生产。CSCA 真题通常按月份或 session 出现，同一大纲下会存在多份真实真题。为了提升出题的准确性和可预测性，AI 出题不应直接把某一份单卷画像当成最终出题画像，而应使用：

```text
多份连续月份源卷
-> 单卷画像
-> 连续月份趋势画像
-> 当前出题画像
-> 科目训练 / 在线模考 AI 出题
```

结论：

1. 单卷画像解析不用推翻，继续作为基础层。
2. 需要新增连续月份趋势画像。
3. 需要新增或升级“当前出题画像”，作为 AI 出题唯一推荐入口。
4. AI 画像源只能来自真实 `past_paper` 真题；模考卷、预测卷和练习卷只能作为资源/套装/手工题资产存在，不得进入真题画像、趋势画像或当前出题画像。

> 2026-07-16 边界修订：本方案早期曾讨论“模考卷资产转源卷画像”的开发辅助路径。该路径已退役。`csca_source_documents` 的 AI 画像流水线只接受 `sourceType = past_paper`，旧的 mock/prediction/reference 画像入口不得再恢复。

## 2. 术语调整

当前界面和代码里大量使用“真题画像”。后续建议改成更准确的分层术语：

| 旧称 | 新称 | 含义 |
| --- | --- | --- |
| 真题 JSON | 真题源卷 JSON | 只能是真实 `past_paper` 真题 |
| 真题画像 | 真题源卷画像 | 从真实真题和真题题目中抽取的题型、难度、认知技能、阅读量、计算量、答案分布等 |
| active 真题画像 | 当前出题画像 | AI 出题实际使用的稳定画像 |
| 模考卷 | 模考卷资产 | 面向学生练习/考试的卷子，不自动等于源卷画像 |

来源类型仍保留：

```text
csca_source_documents.source_type
```

允许值：

- `past_paper`：官方真题。

只有 `past_paper` 可以进入画像管线。模考卷、预测卷、练习卷和参考资料不得写入真题画像流水线；如需要展示或下载，放在资源/套装模块。

## 3. 当前机制与问题

### 3.1 当前单卷画像机制

当前链路是：

```text
csca_source_documents
-> csca_source_questions
-> csca_source_questions.auto_profile_*
-> csca_question_style_profiles
```

`csca_question_style_profiles` 当前被当作：

- 科目训练的 style profile。
- 在线模考蓝图生成和 AI 出题的前置条件。

### 3.2 当前问题

1. 单卷过拟合  
   单份卷子的知识点、难度、题型和答案分布可能只是当月波动，不应直接代表长期出题规律。

2. 来源概念混乱  
   早期数据里存在把模拟卷当作源卷画像样本的情况，导致用户容易误解“有模考资产就可以生成真题趋势画像”。新机制必须清理这类旧样本，画像只认真实 `past_paper`。

3. 大纲固定，真题不固定  
   大纲版本通常一段时间内稳定，但不同月份真题会轮换覆盖不同知识点和难度。系统需要识别稳定项、轮换项和近期增强趋势。

4. 科目训练和在线模考都直接依赖 active style profile  
   后续应该改为依赖“当前出题画像”，而不是直接依赖单卷或单批 source profile。

## 4. 新架构

### 4.1 总流程

```text
大纲版本
  |
  +-- 源卷 A（2026-01）
  |     -> 单卷画像 A
  |
  +-- 源卷 B（2026-02）
  |     -> 单卷画像 B
  |
  +-- 源卷 C（2026-03）
        -> 单卷画像 C

单卷画像 A/B/C
  -> 连续月份趋势画像
  -> 当前出题画像
  -> 科目训练 AI 生产矩阵
  -> 在线模考整卷蓝图
  -> 候选题生成、修复、门禁、入库
```

### 4.2 三层画像

#### 单卷画像

粒度：一份源卷。

输入：

- `csca_source_documents`
- `csca_source_questions`
- 题目映射。
- 单题自动画像。

输出：

- 该卷的题型分布。
- 知识点分布。
- 难度分布。
- 阅读量分布。
- 计算量分布。
- 认知技能分布。
- 答案分布。
- 图像/表格依赖。
- 高频题面模式。
- 干扰项模式。
- 异常提示，例如答案分布偏斜、题型覆盖偏窄。

现有 `csca_question_style_profiles` 可以继续承载这一层，但建议新增 `profile_kind` 或拆出单独表。

#### 连续月份趋势画像

粒度：同一学科、同一大纲版本、多个连续 session。

输入：

- 多个单卷画像。
- 每份源卷的年份、月份、session、source_type、可信权重。

输出：

- 稳定必考项。
- 高频轮换项。
- 低频覆盖项。
- 最近增强项。
- 最近下降项。
- 题型结构稳定性。
- 难度结构稳定性。
- 阅读量和计算量趋势。
- 认知技能趋势。
- 答案分布健康度。
- 源卷数量和置信度。

#### 当前出题画像

粒度：当前学科、大纲版本、用途。

用途可分：

- `subject_practice`
- `online_mock_exam`

输入：

- 连续月份趋势画像。
- 当前大纲。
- 生产策略，例如科目训练难度矩阵、在线模考 48 题结构。
- 管理员策略，例如更重视最近三个月，或均衡覆盖全年。

输出：

- 科目训练缺题目标。
- 在线模考整卷蓝图目标。
- Prompt 使用的 targetProfile。
- Reviewer 和门禁使用的 profile contract。

## 5. 数据模型建议

### 5.1 保守方案：扩展现有表

继续使用 `csca_question_style_profiles`，新增字段：

```text
profile_kind:
  source_paper
  exam_series_trend
  generation_profile

source_document_ids jsonb
source_profile_ids jsonb
source_window jsonb
target_use_case text
profile_status text
```

优点：

- 改动少。
- 现有读取 active style profile 的代码可以较快兼容。

缺点：

- 表语义会变重。
- 单卷画像、趋势画像和最终出题画像混在一张表里，长期维护成本高。

### 5.2 推荐方案：新增两张表

保留 `csca_question_style_profiles` 作为单卷/样本画像表，新增：

```text
csca_exam_series_profiles
```

字段建议：

```text
id
subject
syllabus_version
series_key
source_type_mix jsonb
source_document_ids jsonb
source_profile_ids jsonb
window_start_year
window_start_session
window_end_year
window_end_session
sample_paper_count
sample_question_count
confidence
trend_profile jsonb
status
created_by
generated_at
updated_at
```

新增：

```text
csca_generation_profiles
```

字段建议：

```text
id
subject
syllabus_version
use_case
series_profile_id
policy_version
source_profile_ids jsonb
generation_profile jsonb
confidence
status
activated_at
superseded_at
created_by
created_at
updated_at
```

唯一 active 约束：

```text
subject + syllabus_version + use_case + status = active
```

这样科目训练和在线模考都读取 `csca_generation_profiles`，不再直接读取单卷 style profile。

## 6. 趋势画像算法

### 6.1 源卷排序

每份源卷需要有可排序 session：

```text
exam_year
exam_session
session_order
```

建议标准化：

```text
January -> 1
February -> 2
March -> 3
April -> 4
...
```

如果 source document 只有自由文本 session，则在导入时解析成：

```json
{
  "year": 2026,
  "month": 4,
  "sessionLabel": "April 2026",
  "sequenceKey": "2026-04"
}
```

### 6.2 画像来源权重

画像来源只允许真实真题：

```text
past_paper: 1.0
```

模考卷、预测卷、练习卷和参考资料不参与画像权重计算；它们如果作为资源存在，必须走资源/套装/手工题渠道。

### 6.3 趋势指标

按 topic/module 统计：

```json
{
  "topicId": 123,
  "topicCode": "M-FUNC-001",
  "frequency": 0.83,
  "weightedFrequency": 0.78,
  "recentFrequency": 1.0,
  "trend": "stable_high",
  "role": "core",
  "recommendedWeight": 6
}
```

topic role：

- `core`：连续多月高频，必须覆盖。
- `rotating`：间隔出现，整卷应按比例轮换。
- `emerging`：最近月份明显增加。
- `declining`：最近月份下降，降低权重但不完全丢弃。
- `rare`：低频覆盖项。
- `insufficient_data`：样本不足，不能强判断。

### 6.4 知识点权重计算

建议公式：

```text
recommendedWeight =
  baseFrequencyWeight * 0.45
  + recentTrendWeight * 0.30
  + syllabusImportanceWeight * 0.20
  + sourceConfidenceWeight * 0.05
```

但必须限制：

- 不能完全违背大纲。
- 单一 topic 不能占比过高。
- 低频 topic 仍应在科目训练中保留基础覆盖。
- 在线模考应更接近真实整卷分布，科目训练应更重视学习覆盖。

### 6.5 难度和题型趋势

按以下维度聚合：

- `difficultyBand`
- `questionForm`
- `cognitiveSkill`
- `readingLoad`
- `calculationLoad`
- `estimatedTimeSeconds`
- `requiresImage`
- `answerDistribution`
- `distractorTypes`
- `commonMisconceptions`

这里分两层保存：

1. `profileLike.*Distribution` 保存单卷/连续月份样本的原始归一化占比，主要用于观察真实卷面规律。
2. `normalizedTargets.onlineMockExam` 保存在线模考 48 题的整数目标配额，作为整卷生成和装配的硬目标。

注意：前端画像图表里的百分比默认表示“该维度在当前样本内的占比”；出题引擎不能直接拿百分比循环，而要拿 `normalizedTargets.onlineMockExam.distributions` 里的整数配额。每个目标维度的计数合计必须等于 48。

输出示例：

```json
{
  "profileLike": {
    "difficultyDistribution": {
      "medium": 0.48,
      "hard": 0.27,
      "basic": 0.25
    },
    "questionFormDistribution": {
      "calculation_application": 0.79,
      "concept_check": 0.17,
      "concept_judgement": 0.04
    },
    "answerDistribution": {
      "B": 0.31,
      "A": 0.27,
      "D": 0.25,
      "C": 0.17
    }
  },
  "normalizedTargets": {
    "onlineMockExam": {
      "schemaVersion": "csca-normalized-paper-target-v1",
      "targetCount": 48,
      "source": "exam_series_profile",
      "rounding": "largest_remainder_with_minimum_one_for_observed_keys",
      "distributions": {
        "difficulty": {
          "medium": 23,
          "hard": 13,
          "basic": 12
        },
        "questionForm": {
          "calculation_application": 38,
          "concept_check": 8,
          "concept_judgement": 2
        },
        "answer": {
          "B": 15,
          "A": 13,
          "D": 12,
          "C": 8
        }
      }
    }
  }
}
```

归一化规则：

- 对每个维度独立按 48 题做最大余数法取整。
- 已观察到的类别在可容纳时至少保留 1 题，避免低频但真实出现的类别被四舍五入抹掉。
- 无法从样本得到有效分布时，该维度不写入硬配额，由当前出题画像的默认策略兜底。
- 答案分布也要纳入趋势画像，避免生成卷出现选项答案明显偏斜。

## 7. 对现有代码的影响

### 7.1 `backend/src/ai-questioning/ai-questioning.service.ts`

当前职责：

- 导入源卷。
- 生成 source questions。
- 自动映射。
- 自动画像。
- 生成 `csca_question_style_profiles`。
- 生成科目训练题。

影响：

1. 保留单卷画像生成。
2. 新增 `generateExamSeriesProfile(subject, syllabusVersion, sourceDocumentIds | window)`。
3. 新增 `generateGenerationProfile(subject, syllabusVersion, useCase, seriesProfileId)`。
4. 科目训练生产矩阵从读取 active style profile 改为优先读取 active generation profile。
5. 如果没有 generation profile，自动出题必须阻塞并提示缺当前出题画像；旧 active style profile 只能作为手工诊断/历史查看来源，不得进入自动生成、自动入库或整卷装配闭环。

需要重点检查函数：

- `activeStyleProfileForBlueprint`
- `blueprintWithStyleProfile`
- `sourceProfileMissing` 相关判断。
- `deriveTopicQuestionGap`
- `generationSourceForBlueprint`
- `reviewContextForCandidate`
- `processGenerationJobs`

### 7.2 `backend/src/csca-mock-exam/csca-mock-exam.service.ts`

当前在线模考蓝图生成要求：

```ts
requiredStyleProfileForMockExam(subject, syllabusVersion)
```

影响：

1. 改为 `requiredGenerationProfileForMockExam(subject, syllabusVersion, 'online_mock_exam')`。
2. 自动链路不得 fallback 到 active style profile；缺少 `online_mock_exam` 当前出题画像时必须阻塞，并提示先生成连续月份出题画像。手工诊断如需读取旧单卷画像，必须显式标记为 `manual_debug/legacy_fallback`，且不得入库或装配。
3. `buildMockExamBlueprintDraft` 应使用 generation profile 的整卷分布：
   - topic 权重。
   - 题位难度序列。
   - 题位题型序列。
   - reading/calculation load。
4. 在线模考 48 题闭环中的 `targetProfile` 应记录：

```json
{
  "generationProfileId": 12,
  "seriesProfileId": 5,
  "profileKind": "generation_profile",
  "sourceWindow": "2026-01..2026-04"
}
```

### 7.3 `question-prompt-builder.service.ts`

当前 prompt 主要消费：

- style profile。
- targetProfile。
- generationStrategy。

影响：

1. 增加 generation profile 摘要注入。
2. Prompt 不应列出原题文本。
3. Prompt 应说明：
   - 稳定必考项。
   - 近期趋势。
   - 题型和难度目标。
   - 禁止模仿具体源题。

### 7.4 Reviewer / 门禁

当前门禁检查：

- 答案唯一。
- 难度。
- 题型。
- 画像相似度。
- 双语。
- 数学渲染。
- 在线模考题位归属。

影响：

1. Reviewer 应从 generation profile 判断 profile alignment。
2. 不再只判断“是否像某单卷画像”，而是判断是否满足当前出题画像。
3. 相似度仍然要对所有源卷样本做检查，尤其连续月份真题。

### 7.5 前端后台

当前入口大致是：

- 大纲基线。
- 真题画像。
- 科目训练线。
- 在线模考线。

影响：

建议拆成：

```text
1 大纲基线
2 源卷库
3 单卷画像
4 连续月份趋势画像
5 当前出题画像
6 科目训练 AI 生产
7 在线模考 AI 生产
```

重点 UI：

- 源卷库显示来源类型：真题 / 预测卷 / 模考卷。
- 单卷画像显示每份卷是否已画像。
- 趋势画像显示纳入了哪些月份。
- 当前出题画像显示 active 版本。
- 科目训练和在线模考页面显示“使用的出题画像 ID / 版本 / 样本窗口”。

## 8. 迁移策略

### 阶段 0：命名和诊断

不改核心行为，先把后台文案从“真题画像”调整为“源卷画像/参考卷画像”。

新增诊断：

- 当前学科是否有源卷。
- 是否有 source questions。
- 是否有单卷画像。
- 是否有趋势画像。
- 是否有 active generation profile。

### 阶段 1：保留旧表，新增趋势画像表

新增 `csca_exam_series_profiles`。

功能：

- 从多个 `csca_question_style_profiles` 或 source documents 聚合。
- 输出趋势画像。
- 后台可选择源卷窗口。

### 阶段 2：新增当前出题画像

新增 `csca_generation_profiles`。

功能：

- 从 series profile 生成 subject_practice profile。
- 从 series profile 生成 online_mock_exam profile。
- 支持 active/superseded。

### 阶段 3：科目训练改读 generation profile

科目训练生成顺序：

```text
active generation profile
-> missing_profile / blocked
```

自动入库门槛：

- generation profile：允许高置信自动入库。
- legacy style profile：只允许手工诊断，不允许自动入库。
- syllabus-only：只允许手工调试，不允许自动入库。

### 阶段 4：在线模考改读 generation profile

在线模考必须优先用 `use_case = online_mock_exam` 的 active generation profile。

如果没有，则开发和生产的自动链路都必须阻塞，并提示生成 `online_mock_exam` 当前出题画像；开发阶段只允许手工诊断读取旧单卷画像，不能进入自动闭环。

### 阶段 5：清理旧概念

把“真题画像”命名统一为：

- 源卷画像。
- 连续月份趋势画像。
- 当前出题画像。

## 9. 与现有数据的关系

数学当前数据：

```text
csca_source_documents: math / past_paper / 多份
csca_source_questions: 48
csca_question_style_profiles: active subject profile
```

这可以作为单卷画像输入，但不够形成高置信连续月份趋势画像。

化学当前数据：

```text
mock_exam_papers: 可以有资源套装
csca_source_documents: 只有真实 chemistry past_paper 才能进入画像
csca_source_questions: 由真实 chemistry past_paper JSON 导入
csca_question_style_profiles: 由真实 source questions 派生
```

化学要进入新机制只能上传真实化学真题 JSON。已有 `mock_exam_papers` 可以继续作为模考资源或免费下载套装，但不得转换成 source documents，也不得影响趋势画像。

## 10. API 设计

### 10.1 趋势画像

```http
GET /api/v1/admin/ai-questioning/exam-series-profiles?subject=math
POST /api/v1/admin/ai-questioning/exam-series-profiles
GET /api/v1/admin/ai-questioning/exam-series-profiles/:id
POST /api/v1/admin/ai-questioning/exam-series-profiles/:id/activate
```

创建 payload：

```json
{
  "subject": "math",
  "syllabusVersion": "2025",
  "sourceDocumentIds": [1, 2, 3],
  "window": {
    "from": "2026-01",
    "to": "2026-04"
  },
  "sourceWeights": {
    "past_paper": 1
  },
  "excludedSourceTypes": ["mock_exam", "prediction_paper", "reference_paper", "practice_set"]
}
```

### 10.2 当前出题画像

```http
GET /api/v1/admin/ai-questioning/generation-profiles?subject=math&useCase=online_mock_exam
POST /api/v1/admin/ai-questioning/generation-profiles
POST /api/v1/admin/ai-questioning/generation-profiles/:id/activate
```

创建 payload：

```json
{
  "subject": "math",
  "syllabusVersion": "2025",
  "useCase": "online_mock_exam",
  "seriesProfileId": 5,
  "policyVersion": "generation-profile-v1",
  "strategy": {
    "recentWeight": 0.3,
    "stabilityWeight": 0.45,
    "syllabusWeight": 0.2,
    "sourceConfidenceWeight": 0.05
  }
}
```

## 11. 出题时的 profile selection

统一选择逻辑：

```ts
function resolveGenerationProfile(subject, syllabusVersion, useCase) {
  const generationProfile = findActiveGenerationProfile(subject, syllabusVersion, useCase);
  if (generationProfile) return { mode: 'generation_profile', profile: generationProfile };

  const legacyStyleProfile = findActiveSubjectStyleProfile(subject, syllabusVersion);
  if (legacyStyleProfile) return { mode: 'missing_profile', profile: null, legacyDiagnosticProfileId: legacyStyleProfile.id };

  return { mode: 'missing_profile', profile: null };
}
```

在线模考建议策略：

```text
production: missing_profile 直接阻塞
development: 自动链路同样阻塞；旧画像只可手工诊断，不进入自动入库/装配
```

科目训练建议策略：

```text
generation_profile: 自动闭环
legacy_style_profile: 仅手工诊断/只读查看，不进入自动闭环
missing_profile: 自动链路阻塞；提示生成当前出题画像
```

## 12. 门禁规则变化

新增门禁字段：

```json
{
  "generationProfileAlignment": {
    "profileId": 12,
    "seriesProfileId": 5,
    "status": "passed",
    "score": 92,
    "reasons": []
  }
}
```

候选题必须记录：

```json
{
  "generationMetadata": {
    "sourceKind": "syllabus_and_generation_profile",
    "generationProfileId": 12,
    "seriesProfileId": 5,
    "profileWindow": "2026-01..2026-04",
    "sourceProfileIds": [1, 2, 3]
  }
}
```

旧值兼容：

```text
syllabus_and_past_paper_profile
```

可以继续读，但新生成题应逐步改成：

```text
syllabus_and_generation_profile
```

## 13. 后台页面调整

### 13.1 源卷库

显示：

- 来源类型。
- 年份/月/session。
- 是否已拆题。
- 是否已映射。
- 是否已生成单卷画像。
- 是否已纳入趋势画像。

### 13.2 连续月份趋势画像

显示：

- 纳入源卷数量。
- 时间窗口。
- 来源类型混合。
- 样本题量。
- 趋势置信度。
- 高频/轮换/近期增强 topic。
- 题型、难度、答案等原始趋势占比。
- 在线模考 48 题归一化目标配额：难度、题型、认知技能、阅读负荷、计算负荷、答案。

### 13.3 当前出题画像

显示：

- 当前 active profile。
- 用途：科目训练 / 在线模考。
- 来源趋势画像。
- `normalizedTarget`：在线模考使用的 48 题整数配额；科目训练保留矩阵/预测补题目标。
- 版本。
- 最近启用时间。
- 被哪些生成任务使用。

### 13.4 科目训练和在线模考

顶部明确显示：

```text
当前使用：出题画像 #12 · 2026-01..2026-04 · 3 份源卷 · 高置信
```

如果是旧模式：

```text
当前使用：单卷画像 #2 · 样本 48 题 · 建议生成连续月份出题画像
```

## 14. 测试计划

### 14.1 单元测试

- source session 排序。
- source type 权重。
- topic role 分类。
- difficulty mix 聚合。
- generation profile 生成。
- active profile selection。

### 14.2 规则测试

新增脚本：

```text
scripts/csca-generation-profile-rules-test.cjs
```

断言：

- 科目训练优先读取 generation profile。
- 在线模考优先读取 generation profile。
- 自动链路不得 fallback 到 legacy style profile；手工诊断读取旧画像时必须标记 `legacy_fallback` 且隔离出自动入库/装配。
- 新生成题 metadata 记录 generationProfileId。

### 14.3 Smoke

新增：

```text
npm run csca-generation-profile:smoke
```

流程：

1. 创建 3 份临时源卷。
2. 每份 48 题。
3. 生成单卷画像。
4. 生成趋势画像。
5. 生成 subject_practice generation profile。
6. 生成 online_mock_exam generation profile。
7. 用 online profile 创建 48 题模考蓝图。
8. 验证候选题 metadata 记录 profile lineage。

## 15. 风险与控制

### 15.1 样本不足

如果只有 1 份源卷：

- 仍可生成 generation profile。
- 置信度应为 `low` 或 `medium`。
- UI 标记“单卷/少样本画像”。

### 15.2 模考卷污染真题趋势

模考卷不允许进入真题画像流水线，因此不再通过 source type 权重解决污染问题，而是在入口层直接拒绝。

控制：

- 真题画像导入入口只接受 `sourceType = past_paper`。
- 趋势画像 SQL 再次强制 `source_type = past_paper`。
- UI 明确提示模考卷、预测卷只能作为资源/套装/手工题资产。

### 15.3 近期趋势过度放大

控制：

- recentWeight 上限。
- topic max share。
- 大纲权重保底。

### 15.4 旧题兼容

开发阶段不必强兼容旧题，但不能让线上崩。

策略：

- 旧题可继续展示和练习。
- 新生成题必须写入新 metadata。
- 后台提供“清理不符合当前出题画像的 AI 题”动作。
- 不删除手工题、大纲、源卷和画像。

## 16. 落地顺序

推荐顺序：

1. 改文案：真题画像 -> 源卷画像 / 当前出题画像。
2. 增加诊断：区分缺大纲、缺源卷、缺单卷画像、缺趋势画像、缺出题画像。
3. 新增 `csca_exam_series_profiles`。
4. 新增趋势画像生成服务。
5. 新增 `csca_generation_profiles`。
6. 科目训练 profile selection 接入 generation profile。
7. 在线模考 profile selection 接入 generation profile。
8. Prompt / Reviewer / Gate 写入 generationProfile lineage。
9. 后台页面新增趋势画像和出题画像工作区。
10. 清理旧术语和旧数据。

## 17. 与当前 48 题在线模考闭环的关系

当前 48 题闭环解决的是：

```text
有蓝图和题位后，如何生成到 48 个合格题并装配
```

本方案解决的是：

```text
蓝图和题位的目标画像从哪里来，以及是否足够可靠
```

二者不冲突。后续在线模考流程应变成：

```text
当前出题画像
-> 整卷蓝图
-> 48 题位
-> AI 生成/修复/重生
-> 门禁
-> 48/48 合格
-> 装配草稿卷
```

## 18. 验收标准

1. 同一学科同一大纲下可以纳入多份源卷。
2. 系统能生成连续月份趋势画像。
3. 系统能生成 subject_practice 和 online_mock_exam 两类当前出题画像。
4. 科目训练新生成题 metadata 写入 generationProfileId。
5. 在线模考新生成题 metadata 写入 generationProfileId 和 seriesProfileId。
6. 后台能清楚显示当前使用的是单卷画像、趋势画像还是出题画像。
7. 化学这种“有模考卷资产但没有真题画像”的状态不再被误解，UI 必须提示：需要导入真实 `past_paper` 真题 JSON；模考资产不能作为画像源。
8. 没有当前出题画像时，系统提示缺出题画像，不误报缺大纲。
9. 旧 active style profile 不再作为自动 fallback；只能用于历史查看和手工诊断，新任务缺当前出题画像时必须阻塞。
10. 当前出题画像更新后，新生成任务自动使用新画像，旧 AI 题可按开发策略清理。
11. 连续趋势画像必须生成 `normalizedTargets.onlineMockExam`，各目标分布计数合计为 48。
12. 在线模考当前出题画像必须记录并展示 `normalizedTarget`，整卷生成以该配额为硬目标，而不是直接使用原始百分比。

## 19. 相邻代码与功能影响矩阵

这一方案不是单独增加两张画像表就结束。它会改变“源卷如何进入画像”“画像如何成为出题依据”“题目如何证明自己来自哪个画像”三条链路，因此需要同步检查附近模块。

| 模块 | 当前状态 | 需要改动 | 不改的风险 | 验收方式 |
| --- | --- | --- | --- | --- |
| 大纲基线 | 科目训练和在线模考共用 | 继续共用，不拆表；只在出题画像里记录 syllabusVersion | 误把缺画像提示成缺大纲 | 物理/化学/数学都有大纲时，不再提示“大纲缺失” |
| 源卷上传 | 主要从 JSON 导入 source documents | 保留；只接受 `sourceType=past_paper`，字段需支持 examMonth/session/language/sourceHash | 模考/预测卷污染真实趋势画像 | 上传真题 JSON 后能显示来源、月份、session，上传非真题会被拒绝 |
| 现有模考卷资产 | 在 mock exam papers 中 | 保留为资源/套装/手工模考渠道；不得转换到 source documents | 模考资产污染真实画像，导致出题画像失真 | 后台没有“模考卷导入源卷”入口，相关 API 不存在 |
| 单卷画像 | `csca_question_style_profiles` 承载 | 保留为基础层；新任务不直接把它当最终画像 | 单卷过拟合，连续月份趋势缺失 | 单卷画像仍可查看，但 UI 标记“基础样本层” |
| 趋势画像 | 暂无独立层 | 新增 `csca_exam_series_profiles` | 多份真题无法沉淀稳定/轮换/近期趋势 | 同一学科多份源卷可生成一个 active 趋势画像 |
| 当前出题画像 | 旧 active style profile 被直接使用 | 新增 `csca_generation_profiles`；科目训练/在线模考分别生成 | 科目题和模考题继续混用同一画像，治理不清楚 | 两个 useCase 各有 active profile |
| 科目训练 AI 生产 | 读取大纲和旧 style profile | 必须读取 `subject_practice` generation profile；缺失时阻塞自动任务，旧 style profile 仅诊断 | 生成题缺少连续源卷趋势依据 | 新生成科目题 metadata 有 generationProfileId |
| 在线模考 AI 生产 | 读取旧 style profile 或蓝图 | 优先读取 `online_mock_exam` generation profile，再生成整卷蓝图/题位 | 48 题目标仍可能基于单份卷子 | 新生成模考候选 metadata 有 generationProfileId/seriesProfileId |
| Reviewer/门禁 | 对齐旧 targetProfile | 增加 generation profile alignment；相似度仍查所有源卷样本 | 已过门禁但不符合当前出题画像 | 门禁证据展示 profileId、score、reasons |
| 候选题/正式题 metadata | 部分旧题缺版本和画像记录 | 新题必须写 generationProfile、seriesProfile、prompt/reviewer/schema version | 新旧题混杂，无法判断题目来源 | 后台列表能按画像版本追溯 |
| 前台练习 | 只关心正式题库 | 不需要展示复杂画像，但题目不可因旧 metadata 缺失报错 | 用户端出现“题目不存在”或练习中断 | 科目训练和在线模考都能抽到新题并正常作答 |

## 20. 可执行工作拆分

### 20.1 数据层

必须完成：

1. 新增 `csca_exam_series_profiles`。
2. 新增 `csca_generation_profiles`。
3. 为新 AI 题 metadata 统一写入：
   - `generationProfileId`
   - `seriesProfileId`
   - `sourceProfileIds`
   - `profileWindow`
   - `profilePolicyVersion`
   - `generatorPromptVersion`
   - `reviewerRubricVersion`
4. 不迁移旧题为新结构；开发阶段可提供清理动作。

必须落库的 active 唯一约束：

```text
csca_generation_profiles(subject, syllabus_version, use_case, status)
  active 同一 subject + syllabus_version + use_case 只能有一个

csca_exam_series_profiles(subject, syllabus_version, status)
  active 同一 subject + syllabus_version 可以只有一个默认 active
```

执行方式：

- `0066_exam_series_generation_profiles` 创建趋势画像和出题画像表。
- `0067_generation_profile_active_uniqueness` 增加 partial unique index，防止并发生成时出现两个 active 画像。
- 业务代码仍需在生成/激活前把同范围旧 active 标记为 `superseded`，数据库唯一索引作为最后防线。

### 20.2 源卷进入路径

必须支持一条画像入口：

1. 真题 JSON 上传入口  
   管理员上传已经整理好的真实 `past_paper` JSON，系统拆成 source document 和 source questions。

模考卷、预测卷、套装卷只能进入资源/模考/下载模块；如果以后需要做“风格参考”或“相似度参考”，必须另建隔离表和隔离权重，不能复用真题画像流水线。

### 20.3 画像生成顺序

每个学科推荐固定顺序：

```text
1 大纲已应用
2 导入多份源卷
3 源题自动画像
4 源题映射知识点
5 自动纳入合格样本
6 生成单卷画像
7 生成连续趋势画像
8 生成当前出题画像：subject_practice
9 生成当前出题画像：online_mock_exam
10 再启动科目训练/在线模考 AI 生产
```

如果缺某一步，错误提示必须落到对应层级：

| 缺失 | 正确提示 |
| --- | --- |
| 没大纲 | 当前学科没有已应用大纲 |
| 有大纲但无真题源卷 | 当前学科没有可用真题源卷，请导入真实 `past_paper` 真题 JSON |
| 有源卷但无合格样本 | 源题尚未完成画像/映射/纳入 |
| 有单卷画像但无趋势画像 | 请先生成连续月份趋势画像 |
| 有趋势画像但无当前出题画像 | 请先生成当前出题画像 |

### 20.4 科目训练接入

科目训练的读取顺序必须是：

```text
active csca_generation_profiles(use_case = subject_practice)
-> missing_profile / blocked
```

开发阶段如需查看 legacy style profile，只能通过手工诊断入口，后台必须显示：

```text
当前诊断：旧单卷画像；自动出题已阻塞，请生成当前出题画像。
```

正式生产任务应满足：

- gap/production cell 记录 generationProfileId。
- 生成候选记录 generationProfileId。
- 入库正式题保留 generationProfileId。
- 当前出题画像变化后，新 run 使用新画像；旧 run 可以继续完成或由管理员清理。

### 20.5 在线模考接入

在线模考的读取顺序必须是：

```text
active csca_generation_profiles(use_case = online_mock_exam)
-> missing_profile / blocked
```

48 题整卷闭环不改变目标：必须凑齐 48 道合格题才算完成。但题位目标来源要改为当前出题画像：

```text
online_mock_exam generation profile
-> 整卷蓝图
-> 48 题位
-> 候选生成/修复/重生
-> 门禁
-> 48/48 合格
-> 装配草稿卷
```

题位和候选都必须记录：

- `mockExamBlueprintId`
- `mockExamSourcePaperId`
- `generationProfileId`
- `seriesProfileId`
- `sourceWindow`

## 21. 后台 UI 调整清单

### 21.1 流程卡片

后台流程应从混合状态改成分层：

```text
共用准备
1 大纲基线
2 源卷库
3 单卷画像
4 连续趋势画像
5 当前出题画像

科目训练线
6 科目训练候选
7 科目训练正式资产
8 科目训练质量治理

在线模考线
6 在线模考蓝图
7 在线模考候选
8 在线模考草稿卷/正式卷
```

这样用户不会把“科目训练补题”和“在线模考补题”看成同一个题库。

### 21.2 源卷库页面

新增显示：

- 来源：真题 / 模考 / 预测 / 参考。
- 月份/session。
- 是否进入单卷画像。
- 是否进入趋势画像。
- 来源权重。
- 样本纳入率。

新增动作：

- 上传源卷 JSON。
- 重新画像当前源卷。
- 删除或排除某份源卷，不纳入趋势；如果仍有剩余 active 真题源卷，自动重建连续趋势画像和两个当前出题画像。

### 21.3 画像状态页面

新增显示：

- 连续趋势画像 active 版本。
- 当前出题画像 active 版本。
- subject_practice 和 online_mock_exam 分开显示。
- 最近生成任务使用的 profile lineage。

新增动作：

- 生成连续趋势画像。
- 生成当前出题画像。
- 激活某个历史画像。
- 清理不符合当前画像的新 AI 题。

## 22. 旧数据与开发阶段清理策略

开发阶段不追求旧题永久兼容，但要避免线上报错。

推荐策略：

1. 手工题、正式源卷、大纲永远不自动删除。
2. AI 生成题如果缺新 metadata，可以保留展示，但不参与新闭环统计。
3. 管理后台提供按范围清理：
   - 当前学科未入库 AI 候选。
   - 当前学科已入库 AI 题。
   - 当前画像版本之外的 AI 题。
   - 当前在线模考源卷下的候选和草稿卷。
4. 清理动作必须只影响 AI 生成资产，不影响手工题和学生历史作答。
5. 删除或批量清理源卷时，旧画像必须归档；若同学科同大纲仍有剩余 active past paper，系统自动触发 `source_document_deleted` 画像流水线重建，不能依赖管理员手动重建。

上线前建议执行：

```text
1 备份数据库
2 部署 migration
3 生成趋势画像和当前出题画像
4 清理旧 AI 候选
5 用新画像重新生成一批科目题和在线模考题
6 抽查前台训练和在线模考
```

## 23. 本方案完成后的判断标准

可以认为该方案落地完成的最低标准：

1. 数学、化学、物理任一学科都只能通过真实 `past_paper` JSON 进入源卷库。
2. 后台能看到单卷画像、连续趋势画像、当前出题画像三层状态。
3. 科目训练和在线模考各自读取自己的当前出题画像。
4. 新生成题 metadata 能追溯到当前出题画像和趋势画像。
5. 缺画像时提示准确，不再把缺源卷/缺出题画像误报成缺大纲。
6. 旧题不会导致前台练习页面崩溃。
7. 管理员可以在开发阶段清理旧 AI 题后重新生成。
