# CSCA 真题风格参考层实施方案

> 日期：2026-06-16  
> 状态：可执行方案  
> 适用范围：数学、物理、化学 AI 出题、AI 审题、题库治理后台  
> 目标：在不直接改写真题的前提下，把授权真题解析成可复用的风格、倾向、难度和干扰项标准，让 AI 生成题和 Reviewer 都能参考。

## 1. 核心结论

当前链路已经可以做到：

```text
考纲 -> 知识点 -> 蓝图 -> AI 生成候选题 -> LLM 审题 -> 程序化门禁 -> 人工发布
```

这能解决“不要明显错、不要明显超纲、不要 fallback 题进题库”的问题，但还不能保证“像 CSCA 真题”。  

下一层必须补：

```text
授权真题 -> 标准化解析 -> 风格画像 -> 蓝图增强 -> 生成约束 -> 审题校验 -> 门禁/人工复核
```

原则固定：

```text
考纲决定能考什么。
真题画像决定怎么考。
AI 只生成原创仿真题。
Reviewer 同时审正确性、考纲贴合度和真题风格贴合度。
门禁只拦硬风险，不替代最终人工责任。
```

## 2. 当前架构缺口

现有系统已有 AI 出题、AI Reviewer、候选题队列、门禁、蓝图、考纲导入能力。缺口主要在真题参考层：

- 没有真题来源治理表，无法记录授权范围、来源文件、题号、页码、hash。
- 没有真题题级解析 JSON，无法沉淀“题目风格、考察能力、干扰项、难度”。
- 蓝图目前主要来自大纲，不够表达“这个知识点通常怎么考”。
- Generator prompt 还不能稳定引用真题风格画像。
- Reviewer 还没有单独评分 `styleAlignment`、`examLikeDifficulty`、`pastPaperSimilarityRisk`。
- 门禁还没有“和真题过近”“风格严重偏离”“难度偏离”的发布策略。
- 后台还没有真题导入、解析审核、风格画像刷新、相似风险查看入口。

## 3. 数据模型

### 3.1 SourceDocument

用于记录一份真题或样卷来源。

```ts
type CscaSourceDocument = {
  id: number;
  subject: 'math' | 'physics' | 'chemistry';
  sourceType: 'past_paper' | 'official_sample' | 'authorized_sample' | 'internal_reference';
  title: string;
  examYear?: number;
  examSession?: string;
  language: 'zh' | 'en' | 'mixed';
  fileHash: string;
  storageKey?: string;
  sourceLabel: string;
  sourceUrl?: string;
  licenseScope: 'internal_analysis' | 'display_allowed' | 'commercial_allowed' | 'unknown';
  usagePolicy: {
    allowStyleExtraction: boolean;
    allowQuestionDisplay: boolean;
    allowPromptRawText: boolean;
    allowSimilarityCheck: boolean;
    notes?: string;
  };
  status: 'draft' | 'active' | 'archived' | 'blocked';
  uploadedBy: number;
  createdAt: string;
  updatedAt: string;
};
```

默认策略：

- `allowStyleExtraction = true` 才能生成风格画像。
- `allowPromptRawText = false` 是默认值。生成题时不直接把真题原文塞进 prompt。
- `allowQuestionDisplay = false` 时后台只展示摘要、hash、解析结果，不展示完整真题原文。

### 3.2 SourceQuestion

用于记录真题中的每一道题及其结构化解析。

```ts
type CscaSourceQuestion = {
  id: number;
  documentId: number;
  subject: 'math' | 'physics' | 'chemistry';
  questionNumber: string;
  pageNumber?: number;
  language: 'zh' | 'en';
  promptHash: string;
  promptText?: string; // 仅在授权允许展示或内部分析时保存
  options?: Array<{ id: string; text: string }>;
  correctAnswer?: string;
  explanation?: string;
  syllabusVersion: string;
  topicIds: number[];
  blueprintLikeTags: string[];
  analysis: PastPaperQuestionAnalysis;
  reviewStatus: 'unparsed' | 'parsed' | 'mapped' | 'needs_review' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
};
```

### 3.3 PastPaperQuestionAnalysis

这是最关键的标准化 JSON。

```ts
type PastPaperQuestionAnalysis = {
  cognitiveSkill: 'recall' | 'concept_identification' | 'calculation' | 'reasoning' | 'application' | 'multi_step';
  difficulty: 'basic' | 'medium' | 'hard';
  difficultyEvidence: string;
  questionForm:
    | 'definition'
    | 'formula_calculation'
    | 'graph_interpretation'
    | 'concept_comparison'
    | 'experiment_operation'
    | 'scenario_application'
    | 'error_identification';
  stemPattern: {
    length: 'short' | 'medium' | 'long';
    hasScenario: boolean;
    hasFormula: boolean;
    hasDiagram: boolean;
    hasTable: boolean;
    hasUnitConversion: boolean;
  };
  reasoningSteps: number;
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  optionPattern: {
    optionCount: number;
    optionStyle: 'numeric' | 'expression' | 'concept_text' | 'mixed';
    distractorTypes: string[];
    commonMisconceptions: string[];
  };
  styleNotes: string[];
  doNotCopySignals: string[];
};
```

### 3.4 QuestionStyleProfile

按科目、考纲版本、知识点或模块聚合真题画像。

```ts
type CscaQuestionStyleProfile = {
  id: number;
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  scopeType: 'subject' | 'module' | 'topic';
  scopeId?: number;
  sourceQuestionIds: number[];
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  profile: {
    difficultyDistribution: Record<'basic' | 'medium' | 'hard', number>;
    commonQuestionForms: Array<{ form: string; weight: number }>;
    commonCognitiveSkills: Array<{ skill: string; weight: number }>;
    stemPatterns: {
      typicalLength: 'short' | 'medium' | 'long';
      scenarioRate: number;
      formulaRate: number;
      diagramRate: number;
      tableRate: number;
    };
    optionPatterns: {
      typicalOptionCount: number;
      commonOptionStyles: string[];
      commonDistractorTypes: string[];
    };
    generationGuidelines: string[];
    reviewerGuidelines: string[];
    similarityRiskSignals: string[];
  };
  generatedAt: string;
  generatedBy: 'rule' | 'llm' | 'human';
  status: 'draft' | 'active' | 'archived';
};
```

## 4. 后台操作流程

### 4.1 真题导入

入口：后台 `AI 题库治理 -> 真题参考库`

操作：

1. 上传 PDF / 图片 / 手工 JSON。
2. 选择科目、年份、语言、来源类型。
3. 填写授权范围：
   - 仅内部解析
   - 可展示原题
   - 可商业使用
   - 未确认授权
4. 系统计算 `fileHash`。
5. 创建 `CscaSourceDocument`。

拦截规则：

- 授权范围为 `unknown` 时，不允许进入 AI 生成 prompt，只能做后台记录。
- 未启用 `allowStyleExtraction` 时，不生成风格画像。

### 4.2 真题拆题与解析

第一版可以允许人工 JSON 导入，不必马上做 OCR。

推荐导入 JSON：

```json
{
  "subject": "math",
  "syllabusVersion": "2025",
  "document": {
    "title": "CSCA Math Authorized Sample 2025",
    "examYear": 2025,
    "language": "zh",
    "licenseScope": "internal_analysis"
  },
  "questions": [
    {
      "questionNumber": "1",
      "pageNumber": 1,
      "prompt": "函数 f(x)=1/(x-2) 的定义域是？",
      "options": [
        { "id": "A", "text": "全体实数" },
        { "id": "B", "text": "x ≠ 2" },
        { "id": "C", "text": "x > 2" },
        { "id": "D", "text": "x < 2" }
      ],
      "correctAnswer": "B",
      "topicCodes": ["M-FUNC-001"],
      "analysis": {
        "cognitiveSkill": "concept_identification",
        "difficulty": "basic",
        "questionForm": "definition",
        "reasoningSteps": 1,
        "calculationLoad": "none",
        "distractorTypes": ["domain_condition_missing", "inequality_overrestriction"]
      }
    }
  ]
}
```

LLM 可辅助生成 `analysis`，但必须经过人工或规则校验后才设为 `approved`。

### 4.3 Topic 映射审核

每道真题必须绑定到：

- `subject`
- `syllabusVersion`
- `CscaExamTopic`
- 可选 `CscaQuestionBlueprint` 风格标签

低置信映射进入 `needs_review`。

## 5. 蓝图增强

现有蓝图需要增加真题风格字段：

```ts
type BlueprintStylePatch = {
  styleProfileId?: number;
  targetQuestionForm?: string;
  targetCognitiveSkill?: string;
  targetReasoningSteps?: number;
  targetCalculationLoad?: string;
  targetDistractorTypes?: string[];
  targetStemPattern?: {
    length?: 'short' | 'medium' | 'long';
    hasScenario?: boolean;
    hasFormula?: boolean;
    hasDiagram?: boolean;
  };
  pastPaperReferenceMode: 'none' | 'profile_only' | 'human_verified_profile';
};
```

蓝图生成逻辑：

```text
考纲知识点
-> 找 active style profile
-> 读取常见 questionForm / cognitiveSkill / distractorTypes
-> 生成 basic / medium / hard 蓝图
-> 标记 confidence
```

没有真题画像时：

- 允许基于考纲生成蓝图。
- 但 UI 显示“未使用真题画像，仅基于考纲”。
- Reviewer 的 style alignment 只能给低置信结果。

## 6. Generator Prompt 接入

Generator 输入必须分层：

```ts
type QuestionGenerationContext = {
  syllabus: {
    subject: string;
    syllabusVersion: string;
    module: string;
    topicTitle: string;
    examScope: string[];
    excludedScope: string[];
  };
  blueprint: {
    title: string;
    difficulty: string;
    questionType: string;
    requirements: string;
    distractorIntent: string[];
  };
  styleProfile?: {
    confidence: string;
    commonQuestionForms: string[];
    commonDistractorTypes: string[];
    stemGuidelines: string[];
    optionGuidelines: string[];
    doNotCopySignals: string[];
  };
  outputLanguage: 'zh' | 'en' | 'bilingual';
};
```

Prompt 规则：

```text
你必须基于考纲和蓝图生成原创 CSCA 仿真题。
真题画像只用于风格、难度、干扰项参考。
不得复用、改写、平移、换数字、近似重构任何真题。
生成题需提供中文和英文两个版本，本质为同一道题。
```

如果 `styleProfile.confidence = low`：

- Prompt 必须标记“风格画像样本不足”。
- 生成结果进入 `human_review` 或 `needs_review`，不能自动视为高置信。

## 7. Reviewer Prompt 接入

Reviewer 增加 3 个维度：

```ts
type StyleReviewRubric = {
  styleAlignment: number; // 是否像 CSCA 题风
  examLikeDifficulty: number; // 难度是否符合目标
  pastPaperSimilarityRisk: number; // 是否太像某类真题
};
```

Reviewer 必须回答：

- 这题是否符合当前考纲范围？
- 是否符合蓝图要求？
- 是否符合真题风格画像？
- 是否过像某个真题模式？
- 难度是否偏离目标？
- 干扰项是否有教学价值？
- 是否建议发布、人工确认、修改或重生？

输出 JSON：

```json
{
  "decision": "approve",
  "score": 92,
  "rubric": {
    "syllabusAlignment": 95,
    "answerCorrectness": 95,
    "optionQuality": 90,
    "explanationQuality": 90,
    "difficultyMatch": 88,
    "languageQuality": 95,
    "styleAlignment": 86,
    "examLikeDifficulty": 88,
    "pastPaperSimilarityRisk": 12
  },
  "issues": [
    {
      "code": "style_alignment_low",
      "severity": "warning",
      "message": "题干比真题画像更长，建议人工确认。"
    }
  ]
}
```

## 8. Similarity Guard

Similarity Guard 不做“是否侵权”的法律判断，只做技术风险提示。

第一版规则：

- 题干文本相似度。
- 选项集合相似度。
- 数字/符号结构相似度。
- 知识点 + 题型 + 答案模式组合相似度。

输出：

```ts
type SimilarityGuardResult = {
  risk: 'low' | 'medium' | 'high';
  matchedSourceQuestionIds: number[];
  signals: string[];
  recommendation: 'allow' | 'human_review' | 'regenerate';
};
```

门禁策略：

- `risk = high`：禁止发布，建议重生。
- `risk = medium`：需人工确认。
- `risk = low`：可继续走普通 Reviewer 门禁。

## 9. 门禁规则升级

现有门禁保留，并新增：

| 问题 | Issue code | 门禁结果 |
| --- | --- | --- |
| 风格严重不像 CSCA | `style_alignment_failed` | `needs_edit` 或 `regenerate` |
| 难度明显偏离 | `exam_difficulty_mismatch` | `human_review`；严重时 `regenerate` |
| 真题相似高风险 | `past_paper_similarity_high` | `regenerate` |
| 真题相似中风险 | `past_paper_similarity_medium` | `human_review` |
| 风格画像样本不足 | `style_profile_low_confidence` | `human_review` |
| 未绑定真题画像 | `missing_style_profile` | warning，不强拦 |

发布策略建议：

```text
基础题 + 门禁通过 + similarity low -> 可进入开发题库。
中等/困难题 -> 至少人工抽检。
similarity medium/high -> 不允许批量自动发布。
style profile low confidence -> 只能人工确认发布。
```

## 10. 前端后台改造

### 10.1 真题参考库页

新增后台页：

```text
AI 题库治理
-> 真题参考库
```

功能：

- 上传/导入 source document。
- 查看授权范围。
- 查看题级解析状态。
- 批量映射 topic。
- 批量生成/刷新风格画像。
- 查看每个画像覆盖了多少真题。

### 10.2 蓝图页显示

蓝图卡片增加：

```text
来源：CSCA 数学大纲 2025
风格：参考真题画像 #12 / 样本 18 题 / 置信 medium
生成策略：profile_only
```

没有画像时显示：

```text
仅基于考纲生成；未使用真题风格画像。
```

### 10.3 候选审核页显示

候选题增加：

```text
风格：贴合 86 分
相似风险：低
难度：中等，符合目标
```

如果失败，显示人话：

```text
建议重生：和真题画像中的题型结构过近，建议换题干场景或干扰项策略。
```

## 11. API 设计

### 11.1 导入真题 JSON

```http
POST /api/v1/admin/ai-questioning/source-documents/import
```

Body：

```json
{
  "document": {},
  "questions": []
}
```

返回：

```json
{
  "documentId": 1,
  "createdQuestions": 48,
  "needsReview": 6
}
```

### 11.2 生成风格画像

```http
POST /api/v1/admin/ai-questioning/style-profiles/generate
```

Body：

```json
{
  "subject": "math",
  "syllabusVersion": "2025",
  "scopeType": "topic",
  "scopeIds": [101, 102],
  "sourceDocumentIds": [1, 2]
}
```

### 11.3 蓝图绑定画像

```http
POST /api/v1/admin/ai-questioning/blueprints/:blueprintId/style-profile
```

### 11.4 生成候选题时引用画像

现有生成接口增加：

```json
{
  "styleProfileMode": "auto",
  "referencePolicy": "profile_only"
}
```

## 12. 实施顺序

### Phase 1：数据与导入

- 新增 `CscaSourceDocument`。
- 新增 `CscaSourceQuestion`。
- 新增 JSON 导入接口。
- 后台能看到来源、授权范围、题级解析状态。

验收：

- 可以导入一份数学/物理/化学真题 JSON。
- 每道题能绑定 topic。
- 未授权原文不会进入生成 prompt。

### Phase 2：风格画像

- 新增 `CscaQuestionStyleProfile`。
- 支持按 subject/module/topic 生成画像。
- 蓝图页能展示是否使用画像。

验收：

- 一个 topic 至少能生成一份 active profile。
- 蓝图能读取 profile。
- 没有 profile 时 UI 明确提示。

### Phase 3：Generator 接入

- 生成候选题时自动带入 active style profile。
- Prompt 禁止复用真题。
- `generationMetadata` 记录 `styleProfileId`、`referencePolicy`、`styleConfidence`。

验收：

- 新生成候选题能看到引用了哪个 style profile。
- 题目不会出现“参考某真题改写”的表述。

### Phase 4：Reviewer 与门禁

- Reviewer 输出 `styleAlignment`、`examLikeDifficulty`、`pastPaperSimilarityRisk`。
- Similarity Guard 第一版上线。
- 门禁增加相似风险和风格偏离策略。

验收：

- 候选题能显示风格评分和相似风险。
- 高相似风险不能发布。
- 中等相似风险必须人工确认。

### Phase 5：运营闭环

- 发布后用作答数据校准真实难度。
- 异常题回流到质量复核。
- 低质量题触发替代候选生成。

验收：

- 后台能看到 AI 题曝光、正确率、跳出、投诉、复审状态。
- 可按知识点批量补题或扩题。

## 13. 风险边界

### 13.1 不做的事

- 不把真题原文默认传给生成模型。
- 不做“换数字改写真题”。
- 不把外部真题作为可公开题库，除非授权明确允许。
- 不让 AI 审题替代所有人工责任。

### 13.2 必须保留的人工环节

- 真题来源授权确认。
- 真题 topic 映射低置信审核。
- 中高难题抽检。
- 相似风险中高题复核。
- 新学科/新题型早期抽检。

## 14. 最小可落地版本

如果要最快上线一个可运行版本，范围可以收缩为：

1. 只支持手工 JSON 导入真题解析。
2. 只做 topic 级 style profile。
3. Generator 只读取 profile 摘要，不读取真题原文。
4. Reviewer 增加 3 个风格字段。
5. Similarity Guard 先做文本和选项结构相似度。
6. 后台只展示“使用了哪个画像、风格分、相似风险、为什么拦截”。

这版就能让系统从“基于大纲出题”升级到“基于大纲 + 授权样本风格画像出原创仿真题”。

## 15. 成熟度补强

本节用于把方案从“可运行 V1”补强到“可长期治理的题库生产体系”。这些不是抽象愿景，而是后续实施时必须落到数据、后台和门禁里的约束。

### 15.1 真题解析也必须被审核

真题解析本身不能默认可信。AI 可能把知识点、难度、题型、错因或考察能力解析错，因此 `SourceQuestion` 需要增加解析审核字段：

```ts
type SourceQuestionAnalysisGovernance = {
  analysisStatus: 'unparsed' | 'ai_parsed' | 'needs_review' | 'human_confirmed' | 'rejected';
  analysisConfidence: number; // 0-100
  analysisReviewer?: {
    type: 'llm' | 'human';
    reviewerId?: number;
    agentName?: string;
    model?: string;
  };
  analysisIssues: Array<{
    code: string;
    severity: 'warning' | 'error';
    message: string;
  }>;
  analysisReviewedAt?: string;
};
```

规则：

- `analysisStatus !== human_confirmed` 的真题可以用于低置信统计，但不能用于高置信 topic 画像。
- AI 解析出的 topic 映射低置信时，必须进入人工确认。
- 如果真题解析被修改，相关 style profile 需要标记为 `needs_refresh`。

### 15.2 风格画像必须版本化

风格画像会随着导入真题数量变化而变化。生成题时必须记录当时引用的是哪一版画像，否则后续无法追溯。

`CscaQuestionStyleProfile` 增加：

```ts
type StyleProfileVersioning = {
  profileVersion: number;
  sourceQuestionSnapshotHash: string;
  supersededByProfileId?: number;
  supersededAt?: string;
  refreshReason?: 'new_source_questions' | 'analysis_changed' | 'manual_adjustment' | 'syllabus_updated';
};
```

AI 生成题的 `generationMetadata` 必须记录：

```json
{
  "styleProfileId": 12,
  "styleProfileVersion": 3,
  "styleProfileConfidence": "medium",
  "styleProfileSnapshotHash": "..."
}
```

规则：

- 新画像不会自动改变旧题结论，但旧题可被标记为 `style_profile_outdated`。
- 如果画像大幅变化，相关题目进入抽检队列。

### 15.3 Similarity Guard 要比较多个对象

相似度检查不能只和授权真题比较，还要覆盖题库内部重复风险。

比较范围：

```text
1. 授权真题 SourceQuestion
2. 已发布正式题 CscaQuestion
3. 待审核候选题
4. 同一蓝图历史生成题
5. 同一批次生成题
6. 被归档/拒绝但相似原因明确的历史题
```

输出需要按来源分组：

```ts
type SimilarityGuardResult = {
  overallRisk: 'low' | 'medium' | 'high';
  pastPaperRisk: 'low' | 'medium' | 'high';
  internalDuplicateRisk: 'low' | 'medium' | 'high';
  batchDuplicateRisk: 'low' | 'medium' | 'high';
  matches: Array<{
    targetType: 'source_question' | 'published_question' | 'candidate_question' | 'same_batch';
    targetId: number | string;
    score: number;
    signals: string[];
  }>;
  recommendation: 'allow' | 'human_review' | 'regenerate';
};
```

门禁：

- `pastPaperRisk = high`：必须重生。
- `internalDuplicateRisk = high`：禁止发布，除非人工确认为必要变式题。
- `batchDuplicateRisk = high`：同批只保留质量最高的一题，其余建议重生或归档。

### 15.4 难度要拆成三层

题目难度不能只用一个字段。至少要区分：

```ts
type DifficultyGovernance = {
  designedDifficulty: 'basic' | 'medium' | 'hard'; // 生成目标
  reviewedDifficulty: 'basic' | 'medium' | 'hard'; // Reviewer 判断
  empiricalDifficulty?: number; // 学生数据校准，0-1 或 0-100
  difficultyConfidence: 'low' | 'medium' | 'high';
  difficultyDrift?: 'easier_than_designed' | 'matched' | 'harder_than_designed';
};
```

规则：

- `designedDifficulty !== reviewedDifficulty` 时，候选题至少进入人工确认。
- 发布后累计足够作答数据，计算 `empiricalDifficulty`。
- `empiricalDifficulty` 和 `designedDifficulty` 长期偏离时，进入质量复核。
- 扩题时不只补数量，还要补难度分布缺口。

### 15.5 人工审核策略要显式化

人工不是每题永远全审，但必须有清晰策略。

默认策略：

```text
新科目前 100 道 AI 候选题：全部人工确认。
新知识点前 10 道 AI 候选题：全部人工确认。
中等/困难题：默认人工确认或抽检。
styleProfileConfidence = low：人工确认。
similarityRisk = medium/high：人工确认或重生。
Reviewer score < 90：人工确认。
Reviewer 与程序化 Validator 冲突：人工确认。
```

后台需要显示：

- 为什么需要人工确认。
- 是否可人工放行。
- 人工放行人和时间。
- 放行理由。

### 15.6 题目生命周期状态机

正式题库生产必须有明确状态机。

```text
generated
-> pending_review
-> gate_passed
-> human_confirmed
-> published
-> monitored
-> needs_recheck
-> revised / archived / retired
```

建议状态字段：

```ts
type QuestionLifecycle = {
  status:
    | 'draft'
    | 'pending_review'
    | 'review_failed'
    | 'gate_passed'
    | 'human_confirmed'
    | 'published'
    | 'needs_recheck'
    | 'archived'
    | 'retired';
  lifecycleReason?: string;
  lifecycleUpdatedBy?: number | 'system';
  lifecycleUpdatedAt: string;
};
```

规则：

- `gate_passed` 不等于正式发布，只表示机器门禁通过。
- `human_confirmed` 表示人工已承担发布确认。
- `published` 才会进入训练题库。
- `needs_recheck` 暂停高曝光，进入质量队列。

### 15.7 中英同题必须有 canonical 约束

中英题不是两道题，而是同一道题的两个语言版本。

需要增加：

```ts
type QuestionLocalizationGovernance = {
  canonicalQuestionId: number;
  localizations: {
    zh?: QuestionLocalization;
    en?: QuestionLocalization;
  };
  localizationStatus: 'complete' | 'missing_zh' | 'missing_en' | 'semantic_mismatch';
  localizationReviewedAt?: string;
};
```

规则：

- 中文和英文版本必须共用同一个答案、选项结构、知识点、难度和错因 metadata。
- Reviewer 要检查中英文语义一致性。
- 如果英文版本缺失或语义不一致，题目不能作为双语题发布。
- 学生页面按页面语言展示对应版本，缺失时应明确 fallback，而不是随机混语。

### 15.8 批量任务与成本治理

真题解析、画像生成、出题、审题、相似度检查都是长任务，不能依赖前端页面保持打开。

需要统一后台任务：

```ts
type AdminBulkJob = {
  id: number;
  type:
    | 'source_question_parse'
    | 'style_profile_generate'
    | 'blueprint_generate'
    | 'candidate_generate'
    | 'candidate_review'
    | 'similarity_check'
    | 'candidate_publish';
  status: 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'cancelled';
  subject?: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  currentItemLabel?: string;
  costMetadata?: {
    provider?: string;
    model?: string;
    estimatedTokens?: number;
    actualTokens?: number;
    billable: boolean;
  };
  createdBy: number;
  createdAt: string;
  updatedAt: string;
};
```

规则：

- 批量任务必须服务端持续运行，前端切页不应中断。
- 后台需要“任务中心”显示进度、失败原因、重试入口。
- 题库生产 AI 调用计入平台生产成本，不计入用户做题额度。
- 学生做题相关 AI Coach 才计入用户额度。

### 15.9 发布后质量回流

AI 题发布后仍然要被监控。

监控指标：

- 曝光次数
- 作答次数
- 正确率
- 平均耗时
- 放弃率
- 选项选择分布
- 被点赞/踩/举报次数
- 解析展开率
- 同知识点后续表现

自动回流规则：

```text
曝光足够但正确率异常高/低 -> needs_recheck
某个错误选项选择率异常高 -> 检查是否歧义或多答案
用户举报超过阈值 -> needs_recheck
耗时远高于同难度题 -> 难度复核
AI 题表现和 Reviewer 难度长期不一致 -> 调整 empiricalDifficulty
```

回流后动作：

- 人工复核。
- 修题。
- 下架/归档。
- 生成替代候选。
- 更新蓝图和风格画像权重。

## 16. 成熟版落地路线

在第 14 节最小可落地版本之后，成熟版按以下顺序推进：

1. **解析审核**：真题解析 JSON 导入后，增加 AI/人工审核状态。
2. **画像版本化**：style profile 记录版本和 source snapshot。
3. **生成引用快照**：候选题 generation metadata 记录画像版本。
4. **Reviewer 扩维**：增加 style alignment、exam-like difficulty、similarity risk。
5. **Similarity Guard 扩围**：同时比较真题、正式题、候选题和同批题。
6. **生命周期状态机**：区分 gate passed、human confirmed、published。
7. **双语 canonical**：统一中英同题结构和语义一致性校验。
8. **后台任务中心**：批量任务服务端持久化，支持查看和重试。
9. **发布后质量回流**：用真实作答数据校准难度和题目质量。

完成后，系统定位可以升级为：

```text
基于官方考纲、授权真题风格画像、AI 生成/审题、程序化门禁、人工确认和作答反馈的题库生产系统。
```
