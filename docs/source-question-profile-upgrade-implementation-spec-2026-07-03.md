# 上传真题解析画像升级实施规格

> 日期：2026-07-03  
> 状态：可执行规格  
> 适用模块：`backend/src/ai-questioning`、管理后台 AI Question Bank、上传真题/样本解析  
> 依赖准则：`docs/csca-ai-questioning-source-of-truth-2026-07-03.md`

## 1. 目标

把上传真题/样本解析从“题目结构化入库”升级为“考试画像生成”。

本规格不要求立刻改数据库列。第一阶段可以继续把画像放在 `CscaSourceQuestion.analysis` JSON 中，但必须通过 normalizer 对外提供稳定结构。

## 2. 非目标

本阶段不做：

- 在线模考 AI 整卷生成。
- 用户侧实时 AI 出题。
- 删除旧字段。
- 把真题原文传入生成 prompt 做改写。

## 3. 新标准结构

新增 normalized 结构：

```ts
type NormalizedQuestionProfile = {
  schemaVersion: 'source-question-profile-v2';
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  sourceQuestionId?: number;
  topicIds: number[];
  primaryTopicId?: number | null;
  topicConfidence: 'none' | 'low' | 'medium' | 'high';
  questionForm:
    | 'definition'
    | 'concept_identification'
    | 'formula_calculation'
    | 'graph_interpretation'
    | 'table_interpretation'
    | 'experiment_operation'
    | 'scenario_application'
    | 'error_identification'
    | 'multi_step_reasoning'
    | 'unknown';
  cognitiveSkill:
    | 'recall'
    | 'concept_identification'
    | 'calculation'
    | 'reasoning'
    | 'application'
    | 'multi_step'
    | 'unknown';
  difficultyBand: 'basic' | 'medium' | 'hard' | 'unknown';
  readingLoad: 'low' | 'medium' | 'high' | 'unknown';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy' | 'unknown';
  estimatedTimeSeconds: number | null;
  reasoningStepCount: number | null;
  stemPattern: StemPatternProfile;
  optionPattern: OptionPatternProfile;
  loadEvidence: LoadEvidenceProfile;
  styleNotes: string[];
  similarityRiskSignals: string[];
  profileConfidence: 'low' | 'medium' | 'high';
  profileIssues: string[];
};
```

Supporting structures:

```ts
type StemPatternProfile = {
  textLengthBand: 'short' | 'medium' | 'long' | 'unknown';
  conditionCount: number | null;
  hasScenario: boolean;
  hasFormula: boolean;
  hasDiagram: boolean;
  hasTable: boolean;
  hasUnitConversion: boolean;
  hasIrrelevantCondition: boolean;
};

type OptionPatternProfile = {
  optionStyle: 'numeric' | 'expression' | 'concept_text' | 'mixed' | 'unknown';
  distractorTypes: string[];
  commonMisconceptions: string[];
};

type LoadEvidenceProfile = {
  stemCharCount: number | null;
  optionCharCount: number | null;
  formulaCount: number | null;
  operationCount: number | null;
  requiresAlgebraTransform: boolean;
  requiresGraphReading: boolean;
  requiresTableReading: boolean;
  crossTopicCount: number | null;
};
```

## 4. 字段规则

### 4.1 questionForm

必须从题目实际考查方式判断，不从 topic 名称直接推断。

允许多个候选时取主形式，并把次要形式写入 `styleNotes`。

### 4.2 cognitiveSkill

认知技能用于 prompt 和 reviewer，不直接等同难度。

例如简单公式代入可以是 `calculation + basic`，复杂图表推理可以是 `reasoning + hard`。

### 4.3 readingLoad

优先由规则初判，再允许 LLM/解析器补充理由。

初判规则：

- `low`：短题干，1-2 个条件，不依赖图表。
- `medium`：中等题干，3-4 个条件，可能含单位、场景、简单图表。
- `high`：长题干，5 个以上条件，依赖图表/实验/多对象比较，信息筛选明显。

### 4.4 calculationLoad

初判规则：

- `none`：不需要数值计算。
- `light`：1 个公式或 1-2 步简单代入。
- `medium`：2-3 步，含单位转换、图表取数、公式变形或多条件代入。
- `heavy`：多公式、多步骤、联立、跨 topic 或复杂数值。

### 4.5 profileConfidence

建议规则：

- `high`：题干、选项、答案、解析、topic、主要画像字段都完整，且无明显冲突。
- `medium`：核心字段完整，但部分证据弱或缺解析。
- `low`：缺题干/选项/答案/解析之一，或 topic/难度/负载判断冲突。

## 5. Normalizer

新增集中 normalizer，不让业务代码直接兼容旧 shape。

建议文件：

- `backend/src/ai-questioning/source-question-profile-normalizer.ts`

导出：

```ts
export function normalizeSourceQuestionAnalysis(input: {
  analysis: unknown;
  sourceQuestion?: {
    id?: number;
    subject?: string;
    syllabusVersion?: string;
    topicId?: number | null;
    topicCodes?: unknown;
    promptText?: string | null;
    options?: unknown;
  };
}): NormalizedQuestionProfile;
```

要求：

1. 能读取旧 `analysis`。
2. 能读取新 `analysis.profile`。
3. 缺字段时返回 `unknown` 或安全默认值。
4. 不抛出普通数据异常。
5. 严重异常写入 `profileIssues`。

## 6. 写入格式

新解析结果建议写成：

```json
{
  "schemaVersion": "source-question-analysis-v2",
  "profile": {
    "schemaVersion": "source-question-profile-v2"
  },
  "parser": {
    "provider": "rule|llm|hybrid",
    "model": null,
    "parsedAt": "2026-07-03T00:00:00.000Z"
  },
  "gate": {
    "status": "auto_approved|needs_review|excluded|retry_pending",
    "reasonCode": "string",
    "evidence": []
  }
}
```

旧字段可以暂时保留，但新代码只读 `normalizeSourceQuestionAnalysis()` 返回值。

## 7. Auto Profile Gate

`auto_approved` 的最低条件：

1. 题干存在。
2. 选项存在且能识别 A-D。
3. 答案存在且唯一。
4. subject 和 syllabusVersion 有效。
5. 至少有一个 topic 映射或可用 topic confidence。
6. `profileConfidence` 不是 `low`，或低置信度原因不影响画像汇总。
7. 没有明显版权/相似度高风险标记。

失败分类：

- `parse_incomplete`
- `answer_invalid`
- `topic_uncertain`
- `profile_low_confidence`
- `similarity_risk`
- `provider_transient`
- `unsupported_format`

只有 `provider_transient` 默认允许自动重试。

## 8. Style / Topic Profile 汇总

当前 `generateStyleProfile()` 已汇总：

- difficulty。
- question forms。
- cognitive skills。
- calculation loads。
- stem patterns。
- option patterns。
- distractors。

升级后必须改为从 normalizer 读取。

新增或强化汇总字段：

```ts
type TopicQuestioningProfileV2 = {
  schemaVersion: 'topic-questioning-profile-v2';
  subject: string;
  syllabusVersion: string;
  scopeType: 'subject' | 'module' | 'topic';
  scopeId: number | null;
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  difficultyDistribution: Record<string, number>;
  questionFormDistribution: Record<string, number>;
  cognitiveSkillDistribution: Record<string, number>;
  readingLoadDistribution: Record<string, number>;
  calculationLoadDistribution: Record<string, number>;
  estimatedTimeSeconds: {
    p50: number | null;
    p75: number | null;
    p90: number | null;
  };
  stemPatterns: {
    scenarioRate: number;
    formulaRate: number;
    diagramRate: number;
    tableRate: number;
    unitConversionRate: number;
    averageConditionCount: number | null;
    averageReasoningSteps: number | null;
  };
  optionPatterns: {
    commonOptionStyles: Array<{ key: string; weight: number }>;
    commonDistractorTypes: Array<{ key: string; weight: number }>;
    commonMisconceptions: Array<{ key: string; weight: number }>;
  };
  generationGuidelines: string[];
  reviewerGuidelines: string[];
  similarityRiskSignals: string[];
};
```

## 9. 后台 UI

Source Reference Library 每道样本题应展示：

- auto profile status。
- topic confidence。
- question form。
- cognitive skill。
- difficulty band。
- reading load。
- calculation load。
- estimated time。
- distractor types。
- profile confidence。
- profile issues。

Style Profile 页面应展示：

- 样本量。
- 置信度。
- 题型分布。
- 认知技能分布。
- 阅读量/计算量分布。
- 常见干扰项/错因。
- 画像 freshness。

## 10. Backfill

开发阶段可以不长期兼容旧数据，但线上已有数据不能崩。

建议命令：

```text
npm run csca:source-question-profile:backfill
```

行为：

1. 扫描 `csca_source_questions`。
2. 对缺少 v2 profile 的记录调用 normalizer。
3. 写入 v2 shape。
4. 不覆盖人工修正字段，除非传 `--force`。
5. 输出统计：processed / upgraded / skipped / lowConfidence / failed。

## 11. 验收标准

1. 新导入样本题有 `analysis.schemaVersion = source-question-analysis-v2`。
2. 所有 source question 都能被 normalizer 转成 `NormalizedQuestionProfile`。
3. 旧数据缺字段时 API 不报错。
4. active style profile 能包含 readingLoad 和 calculationLoad 分布。
5. 低置信度样本不会自动进入高权重画像。
6. prompt 构建层不直接读取真题原文。
7. 后台能定位一条样本为什么没有进入画像。

## 12. 测试建议

单元测试：

- normalizer 读取 v2 shape。
- normalizer 读取旧 shape。
- 缺选项/缺答案/缺 topic 不抛异常。
- readingLoad / calculationLoad 默认值正确。

服务测试：

- auto profile gate 对低置信度样本返回 needs_review。
- generateStyleProfile 只汇总 auto_approved 样本。
- style profile freshness 能识别样本变化。

回归测试：

- AI Question Bank 页面能加载旧数据。
- 导入样本后能运行 auto profile。
- 低置信度样本不会进入 active profile。
