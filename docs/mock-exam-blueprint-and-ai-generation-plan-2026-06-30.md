# CSCA 真题画像、科目出题与模拟卷 AI 生成方案

> 日期：2026-06-30  
> 状态：产品与架构方案  
> 范围：数学、物理、化学科目出题、专项练习、模拟卷；真题画像；AI 原创仿真题；后台组题、组卷与审核流程  
> 目标：把“AI 出题”从只围绕知识点生成单题，升级为“基于真题解析维度生成科目练习题，并进一步按整卷画像生成完整模拟卷”。科目出题要更像真实 CSCA 的落题方式，模拟卷要在考纲范围、题型结构、难度曲线、知识点分布、阅读量、计算量和做题节奏上接近真实考试。

## 1. 核心结论

真题画像不只服务模拟卷，也应成为科目出题、专项练习、AI 讲解和错因复盘的共享底座。

科目出题的链路应当是：

```text
官方考纲
-> 授权真题 / 样卷单题画像
-> 知识点出题蓝图
-> AI 原创候选题
-> 单题质量审核
-> 科目题库 / 专项练习
```

模拟卷不是题库里随机抽一批题，也不是让 AI 一次性生成一套题。它应当是：

```text
官方考纲
-> 授权真题 / 样卷画像
-> 整卷蓝图
-> 题位蓝图
-> AI 原创候选题
-> 相似度与质量审核
-> 人工确认
-> 发布模拟卷
```

原则固定为：

```text
考纲决定能考什么。
真题画像决定通常怎么考。
科目蓝图决定某个知识点应该补什么题。
整卷蓝图决定一套卷怎么分布。
AI 只生成原创候选题。
人工审核决定是否进入正式模拟卷。
学生作答数据用于校准画像，不直接替代画像。
```

当前项目已有考纲、真题参考层、AI 题库治理、专项练习、模拟卷后台和作答记录，但这些能力还没有形成统一的“画像 -> 蓝图 -> 生成 -> 审核 -> 发布 -> 数据校准”链路。近期更推荐先升级科目出题，因为它更容易验证、风险更低，并能更快积累学生数据；随后再把同一套画像能力扩展到完整模拟卷。

## 2. 当前能力与缺口

### 2.1 已有能力

当前系统已经具备以下基础：

- 官方考纲 JSON 和考纲后台。
- AI 出题、候选题、Reviewer、题库治理后台。
- 真题样本导入、知识点映射和风格画像入口。
- 固定模拟卷后台：创建套卷、编辑题目、JSON 导入、发布、归档、复制。
- 用户侧完整模考：开始、作答、保存、提交、报告。
- 学生作答数据：正确率、耗时、错题、知识点统计。

### 2.2 科目出题缺口

当前科目出题的问题不是“没有题”，而是“生成题的约束还不够像真实 CSCA 的落题方式”：

- 知识点粒度够了，但缺少题型、认知技能、阅读量、计算量、干扰项类型等真题解析维度。
- AI 生成时容易只围绕 topic 出题，而不知道这个 topic 在真题里通常怎么考。
- 难度标签偏主观，缺少 `reasoningSteps`、`readingLoad`、`calculationLoad`、`estimatedTimeSeconds` 等可解释证据。
- 干扰项质量不稳定，常见错因没有结构化沉淀。
- 科目题库缺少“缺题画像”，只能知道某 topic 题量不足，不能知道缺哪类题。
- AI Coach 讲解可以解释答案，但还不能稳定基于题目画像解释“你为什么容易错这一类”。
- 学生作答数据尚未反向校准题目画像和下一批出题优先级。

### 2.3 模拟卷缺口

当前缺口不是“不会生成题”，而是“不会生成一套像真题的卷”：

- 画像粒度不够：现有画像偏单题，不足以表达整卷节奏。
- 没有题位蓝图：不知道第 1 题、第 10 题、第 35 题通常应该考什么、难到什么程度。
- 没有卷级约束：难度曲线、知识点覆盖、题型比例、未答风险、总阅读量和总计算量没有统一控制。
- 没有候选题组装器：AI 生成题还不能按 slot 自动进入一套 mock paper draft。
- 没有整卷 Reviewer：当前审题更偏单题质量，缺少“这套卷整体是否像 CSCA”的检查。
- 没有发布前仿真校验：整卷时长、难度、重复考点、相似度风险、选项分布没有系统化门禁。

## 3. 产品定义

### 3.1 模拟卷的语义

模拟卷是“仿真实考的一整套题”，目标不是单点补弱，而是检查：

- 知识覆盖是否完整。
- 题目切换速度是否稳定。
- 计算和阅读节奏是否能跟上。
- 容易错的题型是否反复出现。
- 在完整时间压力下能否保持正确率。

因此，模拟卷生成必须保留卷级结构：

```text
题量
时长
题型
题位顺序
知识点分布
难度分布
阅读负载
计算负载
图表/公式/单位转换比例
跨知识点组合比例
```

### 3.2 与专项练习的区别

专项练习可以围绕一个薄弱点生成小批次题。模拟卷不应这样做。

| 项目 | 专项练习 | 模拟卷 |
| --- | --- | --- |
| 目标 | 修复薄弱点 | 仿真实考 |
| 题目来源 | 可按 topic 动态组题 | 必须按整卷蓝图组题 |
| 难度 | 可自适应 | 必须贴近真实分布 |
| 顺序 | 可按学习效率调整 | 应保留考试节奏 |
| AI 角色 | 补题、讲解、变式 | 按题位生成候选、辅助整卷校验 |
| 发布门槛 | 可用于训练草稿 | 必须人工审核后发布 |

### 3.3 科目出题的语义

科目出题服务于“按知识点训练”和“补齐题库覆盖”，它的目标不是还原一整套卷，而是让每个 topic 下的题都更符合真实考试的出题方式。

科目出题应回答这些问题：

- 这个知识点在 CSCA 里通常以概念判断、公式计算、图表解读还是场景应用出现？
- 这类题通常需要多少阅读量和计算量？
- 它的常见错误路径是什么？
- 干扰项应该体现哪种误解，而不是随便编三个错误答案？
- 这个 topic 当前缺的是基础题、中档题，还是高计算量/高阅读量题？
- 这道题适合诊断、专项训练、错题复练，还是模拟卷候选？

因此，科目出题不需要题位画像和整卷画像，但必须升级单题画像和 topic 级出题蓝图。

```text
科目出题需要：单题画像 + Topic 出题蓝图 + 学生薄弱点
模拟卷生成需要：单题画像 + 题位画像 + 整卷画像
```

## 4. 画像体系

完整体系需要四层画像。其中科目出题优先使用单题画像和 topic 出题画像，模拟卷在此基础上增加题位画像和整卷画像。

### 4.1 单题画像

单题画像描述一道题本身：

```ts
type QuestionProfile = {
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicIds: number[];
  questionType: 'single_choice';
  cognitiveSkill:
    | 'recall'
    | 'concept_identification'
    | 'calculation'
    | 'reasoning'
    | 'application'
    | 'multi_step';
  difficultyBand: 'basic' | 'medium' | 'hard';
  estimatedTimeSeconds: number;
  readingLoad: 'low' | 'medium' | 'high';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  stemPattern: {
    textLengthBand: 'short' | 'medium' | 'long';
    hasScenario: boolean;
    hasFormula: boolean;
    hasDiagram: boolean;
    hasTable: boolean;
    hasUnitConversion: boolean;
  };
  optionPattern: {
    optionStyle: 'numeric' | 'expression' | 'concept_text' | 'mixed';
    distractorTypes: string[];
  };
  styleNotes: string[];
};
```

### 4.2 Topic 出题画像

Topic 出题画像描述“某个知识点在真实考试里通常怎么落题”，它是科目出题和专项练习最直接的收益点。

```ts
type TopicQuestioningProfile = {
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicId: number;
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  commonQuestionForms: Array<{
    form:
      | 'definition'
      | 'formula_calculation'
      | 'graph_interpretation'
      | 'concept_comparison'
      | 'experiment_operation'
      | 'scenario_application'
      | 'error_identification';
    weight: number;
  }>;
  cognitiveSkillDistribution: Record<string, number>;
  difficultyDistribution: Record<'basic' | 'medium' | 'hard', number>;
  readingLoadDistribution: Record<'low' | 'medium' | 'high', number>;
  calculationLoadDistribution: Record<'none' | 'light' | 'medium' | 'heavy', number>;
  commonDistractorTypes: string[];
  commonMisconceptions: string[];
  generationGuidelines: string[];
  reviewerChecklist: string[];
  avoidSignals: string[];
};
```

科目出题 prompt 应优先读取这个画像，而不是只读取 topic 名称。

### 4.3 题位画像

题位画像描述“一套卷里的第 N 题通常是什么样”：

```ts
type MockExamSlotProfile = {
  slotNumber: number;
  allowedTopicIds: number[];
  preferredModules: string[];
  difficultyBand: 'basic' | 'medium' | 'hard';
  targetQuestionType: 'single_choice';
  targetCognitiveSkill: string[];
  targetReadingLoad: 'low' | 'medium' | 'high';
  targetCalculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  estimatedTimeSeconds: number;
  requiredSignals: string[];
  avoidSignals: string[];
};
```

题位画像的价值在于：一套卷不是 48 道题的平铺列表。真实考试通常会有前中后段节奏差异，例如前段更偏基础识别，中段增加计算和图表，后段可能出现跨知识点或多步骤题。

### 4.4 整卷画像

整卷画像描述一整套卷应满足的总约束：

```ts
type MockExamPaperProfile = {
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  questionCount: number;
  durationMinutes: number;
  totalScore: number;
  difficultyDistribution: {
    basic: number;
    medium: number;
    hard: number;
  };
  moduleWeights: Array<{
    module: string;
    minQuestions: number;
    targetQuestions: number;
    maxQuestions: number;
  }>;
  readingLoadDistribution: Record<'low' | 'medium' | 'high', number>;
  calculationLoadDistribution: Record<'none' | 'light' | 'medium' | 'heavy', number>;
  estimatedTimeBudgetSeconds: number;
  slotProfiles: MockExamSlotProfile[];
  assemblyRules: {
    maxSameTopicInARow: number;
    maxSameAnswerInARow: number;
    minTopicCoverage: number;
    requireMixedCognitiveSkills: boolean;
    forbidNearDuplicateQuestions: boolean;
  };
};
```

## 5. 科目出题升级方案

科目出题应先升级，因为它更容易和当前 AI 题库治理、专项练习、AI Coach 直接结合。它不需要等完整模拟卷蓝图完成。

### 5.1 出题输入

一次科目出题任务的输入不应只是：

```text
subject = physics
topic = ideal gas law
difficulty = medium
```

而应升级为：

```ts
type SubjectQuestionGenerationInput = {
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicId: number;
  targetDifficulty: 'basic' | 'medium' | 'hard';
  targetQuestionForm?: string;
  targetCognitiveSkill?: string;
  targetReadingLoad?: 'low' | 'medium' | 'high';
  targetCalculationLoad?: 'none' | 'light' | 'medium' | 'heavy';
  intendedUse: 'diagnostic' | 'targeted_practice' | 'wrong_question_review' | 'mock_candidate';
  studentWeaknessTags?: string[];
  topicProfile: TopicQuestioningProfile;
};
```

### 5.2 缺题画像

后台不应只显示“某 topic 缺 20 道题”，而应显示缺题结构：

```ts
type TopicQuestionGap = {
  topicId: number;
  currentCount: number;
  targetCount: number;
  gaps: Array<{
    difficultyBand: 'basic' | 'medium' | 'hard';
    questionForm: string;
    cognitiveSkill: string;
    readingLoad: 'low' | 'medium' | 'high';
    calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
    neededCount: number;
    reason: 'coverage' | 'student_weakness' | 'low_quality_existing' | 'mock_candidate_pool';
  }>;
};
```

这样 AI 补题才会有方向。例如系统可以明确要求：

```text
物理 / 热学 / 理想气体状态方程
缺 6 道 medium 难度、medium calculation、scenario_application 的题；
干扰项需要覆盖“温度单位误用”和“公式变量套反”。
```

### 5.3 科目出题 Prompt

推荐 prompt 结构：

```text
科目：物理
考纲版本：2025
知识点：理想气体状态方程
目标用途：专项练习
目标难度：medium
阅读量：medium
计算量：medium
题型：单项选择题
真题画像摘要：
- 常见形式：场景应用 + 公式计算
- 常见干扰项：温度单位误用、变量套反、忽略体积变化
- 常见阅读特征：2-3 句题干，包含单位和状态变化
要求：
- 生成原创题，不得复用真题题干、数值组合或选项结构
- 输出 JSON，包含题干、选项、答案、解析、错因标签、readingLoad、calculationLoad、estimatedTimeSeconds
```

### 5.4 科目题质量审核

科目题 Reviewer 需要比现在更关注“是否符合该 topic 的真实落题方式”：

- 是否在考纲范围内。
- 是否符合 topic 出题画像。
- 难度是否有证据支撑。
- 阅读量和计算量是否匹配目标。
- 干扰项是否对应真实常见错因。
- 解析是否解释关键条件和错误路径。
- 是否适合目标用途：诊断、专项、错题复练或模拟卷候选。

### 5.5 AI Coach 收益

题目画像升级后，AI Coach 不只是讲“正确答案为什么对”，还可以更稳定地讲：

- 你错在概念边界、公式选择、单位换算、读图、条件遗漏还是计算步骤。
- 这类题下次先看什么关键词。
- 这道题属于低阅读高计算，还是高阅读低计算。
- 是否需要回到某个 topic 做一轮专项修复。

因此题目入库时建议保存：

```ts
type QuestionMistakeProfile = {
  likelyMistakeTypes: string[];
  keyConditions: string[];
  trapSignals: string[];
  remediationHints: string[];
};
```

## 6. 阅读量与计算量判断

阅读量和计算量不能只靠题干长度，也不能只靠 AI 自评。推荐用“规则初评 + AI 理由 + 人工抽检 + 学生数据校准”的组合。

### 6.1 阅读量 readingLoad

阅读量衡量学生理解题目条件所需的阅读和信息筛选成本。

建议指标：

- `stemCharCount`：题干字符数或词数。
- `conditionCount`：独立条件数量。
- `entityCount`：变量、对象、物质、图形、实验步骤等信息实体数量。
- `hasScenario`：是否有真实场景或长背景。
- `hasDiagram` / `hasTable`：是否需要读图、读表。
- `optionTextLength`：选项文本长度。
- `irrelevantConditionCount`：是否存在干扰条件。
- `languageComplexity`：句式是否复杂，是否包含否定、比较、例外条件。

初始规则：

```text
low:
  题干短，条件 1-2 个，不依赖图表，选项短。

medium:
  题干中等，条件 3-4 个，可能有单位、图表或场景，但信息筛选不重。

high:
  题干长，条件 5 个以上，依赖图表/实验背景/多对象比较，选项也需要逐一阅读判断。
```

### 6.2 计算量 calculationLoad

计算量衡量学生为得到答案需要进行的公式调用、代数变形、数值运算和步骤推理成本。

建议指标：

- `formulaCount`：需要调用的公式数量。
- `operationCount`：加减乘除、代入、方程求解、比例换算等操作数量。
- `reasoningStepCount`：解题步骤数。
- `numericComplexity`：是否有小数、分数、指数、单位换算、近似计算。
- `requiresAlgebraTransform`：是否需要变形或联立。
- `requiresGraphReading`：是否需要从图中取数再计算。
- `crossTopicCount`：是否跨知识点。

初始规则：

```text
none:
  不需要计算，只需概念判断、定义识别或事实回忆。

light:
  1 个公式或 1-2 步简单代入，数字友好。

medium:
  2-3 个步骤，可能有单位转换、图表取数、公式变形或多条件代入。

heavy:
  多公式、多步骤、跨知识点、联立或较复杂数值运算；错误路径较多。
```

### 6.3 校准方式

阅读量和计算量初期可以由规则 + LLM 生成，但必须保留证据字段：

```ts
type LoadAssessment = {
  readingLoad: 'low' | 'medium' | 'high';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  estimatedTimeSeconds: number;
  evidence: {
    stemCharCount: number;
    conditionCount: number;
    formulaCount: number;
    operationCount: number;
    reasoningStepCount: number;
    hasDiagram: boolean;
    hasTable: boolean;
    hasUnitConversion: boolean;
  };
  reviewerReason: string;
  confidence: 'low' | 'medium' | 'high';
};
```

上线后再用学生数据反向校准：

- 实际平均耗时明显高于预估：提高 readingLoad 或 calculationLoad。
- 正确率低但耗时短：可能是概念陷阱或干扰项强，不一定是计算量高。
- 未答率高：可能是题位太靠后、总卷时间不足或前面题目负载过重。
- 同一题在不同学生中耗时方差大：可能需要人工复核题干清晰度。

## 7. 数据模型建议

### 7.1 SharedQuestionProfile

先增加共享的单题画像字段，让 AI 题库、专项练习题和模拟卷题都能复用。

```ts
type SharedQuestionProfile = {
  syllabusVersion: string;
  topicIds: number[];
  questionForm: string;
  cognitiveSkill: string;
  designedDifficulty: 'basic' | 'medium' | 'hard';
  empiricalDifficulty?: 'basic' | 'medium' | 'hard';
  readingLoad: 'low' | 'medium' | 'high';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  estimatedTimeSeconds: number;
  reasoningStepCount: number;
  distractorTypes: string[];
  commonMisconceptions: string[];
  mistakeProfile?: QuestionMistakeProfile;
  profileConfidence: 'low' | 'medium' | 'high';
};
```

该结构可以先放在题目 metadata / profile JSON 中，等字段稳定后再拆成强类型列。

### 7.2 TopicQuestioningProfile

新增 topic 级出题画像表，用于科目出题和专项练习。

```ts
type TopicQuestioningProfileRecord = {
  id: number;
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicId: number;
  sourceProfileIds: number[];
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  profile: TopicQuestioningProfile;
  status: 'draft' | 'active' | 'archived';
  generatedAt: string;
  reviewedBy?: number;
};
```

### 7.3 TopicQuestionGap

新增或派生 topic 缺题画像，用于后台补题任务。

```ts
type TopicQuestionGapRecord = {
  id: number;
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicId: number;
  gap: TopicQuestionGap;
  status: 'open' | 'in_generation' | 'filled' | 'ignored';
  updatedAt: string;
};
```

### 7.4 MockExamBlueprint

新增整卷蓝图表，用于承接一套模拟卷的生成依据。

```ts
type MockExamBlueprint = {
  id: number;
  subject: 'math' | 'physics' | 'chemistry';
  title: string;
  syllabusVersion: string;
  sourceProfileIds: number[];
  questionCount: number;
  durationMinutes: number;
  totalScore: number;
  status: 'draft' | 'active' | 'archived';
  profile: MockExamPaperProfile;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
};
```

### 7.5 MockExamBlueprintSlot

新增题位蓝图表。

```ts
type MockExamBlueprintSlot = {
  id: number;
  blueprintId: number;
  slotNumber: number;
  topicIds: number[];
  module: string;
  difficultyBand: 'basic' | 'medium' | 'hard';
  cognitiveSkill: string;
  readingLoad: 'low' | 'medium' | 'high';
  calculationLoad: 'none' | 'light' | 'medium' | 'heavy';
  estimatedTimeSeconds: number;
  generationPromptHints: string[];
  reviewerChecklist: string[];
  status: 'draft' | 'ready' | 'blocked';
};
```

### 7.6 SubjectQuestionGenerationJob

新增科目题生成任务，和模拟卷生成任务区分开。

```ts
type SubjectQuestionGenerationJob = {
  id: number;
  subject: 'math' | 'physics' | 'chemistry';
  syllabusVersion: string;
  topicId: number;
  intendedUse: 'diagnostic' | 'targeted_practice' | 'wrong_question_review' | 'mock_candidate';
  input: SubjectQuestionGenerationInput;
  status: 'queued' | 'running' | 'needs_review' | 'completed' | 'failed';
  candidateQuestionIds: number[];
  reviewerIssues: string[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
};
```

### 7.7 MockExamGenerationJob

新增模拟卷生成任务。

```ts
type MockExamGenerationJob = {
  id: number;
  blueprintId: number;
  targetPaperId?: number;
  status: 'queued' | 'running' | 'needs_review' | 'completed' | 'failed';
  provider: string;
  model: string;
  slotResults: Array<{
    slotNumber: number;
    candidateQuestionId?: number;
    status: 'generated' | 'rejected' | 'needs_human_review';
    issues: string[];
  }>;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
};
```

### 7.8 MockExamPaperReview

新增整卷审核结果。

```ts
type MockExamPaperReview = {
  id: number;
  paperId: number;
  blueprintId: number;
  status: 'pass' | 'needs_changes' | 'blocked';
  checks: {
    syllabusCoverage: 'pass' | 'warn' | 'fail';
    difficultyDistribution: 'pass' | 'warn' | 'fail';
    topicDistribution: 'pass' | 'warn' | 'fail';
    loadDistribution: 'pass' | 'warn' | 'fail';
    answerDistribution: 'pass' | 'warn' | 'fail';
    similarityRisk: 'pass' | 'warn' | 'fail';
    estimatedTiming: 'pass' | 'warn' | 'fail';
  };
  issues: string[];
  reviewerNotes: string;
  createdAt: string;
};
```

## 8. 生成流程

### 8.1 科目出题流程

科目出题建议先落地，流程如下：

```text
1. 选择 subject + syllabusVersion + topic。
2. 读取 TopicQuestioningProfile。
3. 读取 TopicQuestionGap 或学生薄弱点。
4. 创建 SubjectQuestionGenerationInput。
5. AI 生成原创候选题。
6. Validator 检查格式、答案、解析、考纲范围。
7. Reviewer 检查题型、难度、阅读量、计算量、干扰项和错因标签。
8. Similarity Guard 检查与真题和既有题库的相似风险。
9. 候选题进入 pending_review。
10. 人工审核后进入科目题库、专项练习题库或 mock candidate pool。
```

科目出题生成的是“可复用题目资产”。一题可以先用于专项练习，后续如果质量和画像合适，也可以进入模拟卷候选池，但不能跳过模拟卷整卷审核。

### 8.2 模拟卷后台入口

建议在后台“模考题库”中增加一个“生成模拟卷”流程：

```text
模考题库
-> 选择科目
-> 选择蓝图
-> 生成 draft paper
-> 按题位查看候选题
-> 单题审核/替换/重新生成
-> 整卷审核
-> 发布
```

AI 题库治理页继续负责单题候选、真题样本和画像管理；模考题库页负责整卷组装和发布。两者通过蓝图和候选题关联，不混在一个页面里。

### 8.3 模拟卷生成步骤

推荐流程：

```text
1. 选择 subject + syllabusVersion。
2. 选择 active 的真题风格画像。
3. 系统生成或加载 MockExamBlueprint。
4. 管理员确认整卷约束和每个题位 slot。
5. 对每个 slot 创建 AI 生成任务。
6. AI 生成原创候选题，不读取真题原文。
7. 单题 Validator 检查答案、解析、考纲、格式。
8. Similarity Guard 检查与授权真题和既有题库的相似风险。
9. Reviewer 给出质量、难度、风格和负载判断。
10. 通过的候选题进入 draft mock paper。
11. 整卷 Reviewer 检查分布、节奏、重复、答案模式和总时长。
12. 管理员人工确认后发布。
```

### 8.4 失败处理

如果某个题位生成失败，不应让整套任务直接失败。应保留 slot 级状态：

- `generated`：候选题生成成功。
- `needs_human_review`：题目可能可用，但需要人工判断。
- `rejected`：自动门禁不通过。
- `regenerate_required`：建议重新生成。
- `manual_fill_required`：需要人工手动补题。

后台应允许只重生成某几个题位，而不是整卷重来。

## 9. Prompt 约束

生成 prompt 应读取“抽象画像”和“题位蓝图”，不要读取授权真题原文。

推荐 prompt 输入：

```text
科目：物理
考纲版本：2025
题位：第 18 题
知识点范围：热学 / 理想气体状态方程
难度：medium
阅读量：medium
计算量：medium
认知技能：formula_calculation + scenario_application
题型：单项选择题，A-D 四个选项
风格画像：题干通常 2-3 句，常含单位换算，干扰项包含公式误用和单位漏换
要求：原创题，不得复用任何真题题干、数值组合或选项结构
输出：JSON，包含 stem、options、answer、explanation、topicTags、loadAssessment
```

禁止 prompt：

```text
参考这道真题，换一下数字出一道类似题。
```

不应把授权真题完整题干、选项、答案直接塞进生成 prompt，除非授权策略明确允许且仍要做相似度控制。

## 10. 整卷审核规则

### 10.1 硬性门禁

以下情况不允许发布：

- 有题目答案不唯一或解析与答案冲突。
- 有题目超出当前考纲范围。
- 有题目与授权真题或既有题库高度相似。
- 题量、时长、总分不符合配置。
- 有题目缺失题干、选项、答案或解析。
- 同一知识点连续大量重复，破坏整卷覆盖。

### 10.2 软性警告

以下情况允许进入人工复核，但应提示：

- 难度分布偏离蓝图。
- 总估时明显超过考试时长。
- readingLoad high 的题目过于集中。
- calculationLoad heavy 的题目过于集中。
- 连续多个题答案相同。
- 某些模块覆盖不足。
- 某个题位候选题风格不像真实考试。

### 10.3 整卷评分

整卷 Reviewer 可以输出：

```ts
type MockExamWholePaperScore = {
  syllabusFit: number;      // 0-100
  examLikeness: number;     // 0-100
  difficultyFit: number;    // 0-100
  timingFit: number;        // 0-100
  topicCoverage: number;    // 0-100
  similaritySafety: number; // 0-100
  publishRecommendation: 'publish' | 'revise' | 'block';
};
```

## 11. 学生数据闭环

科目练习和模拟卷发布后，学生作答数据都应反向校准画像，而不是直接修改题目。

可沉淀指标：

- `empiricalDifficulty`：真实正确率校准后的难度。
- `averageTimeSeconds`：真实平均耗时。
- `p90TimeSeconds`：慢速学生耗时。
- `unansweredRate`：未答率。
- `optionSelectionDistribution`：选项选择分布。
- `distractorEffectiveness`：干扰项有效性。
- `topicMasteryImpact`：题目对掌握度判断的贡献。
- `positionFatigueSignal`：是否因题位靠后导致错误或未答。
- `mistakeTypeDistribution`：学生真实错因分布。
- `topicGapImpact`：该题是否有效修复某个 topic 缺口。

校准逻辑：

```text
如果同一题正确率远低于设计难度：
  先检查题目质量、歧义和超纲，再考虑提高 empiricalDifficulty。

如果题目正确率正常但耗时远高：
  检查 readingLoad / calculationLoad / estimatedTimeSeconds 是否低估。

如果后段大量未答：
  检查整卷总估时和前段负载，而不是只降低后段难度。

如果某个干扰项几乎无人选择：
  标记 distractor weak，进入改题或替换队列。
```

科目出题的额外闭环：

```text
如果某 topic 的某类题反复低正确率：
  优先生成同类低难度拆解题，而不是继续生成同难度题。

如果某 topic 题量够但错因覆盖不足：
  生成特定 distractorTypes / mistakeTypes 的题。

如果某类 AI 题通过率低：
  更新 TopicQuestioningProfile 的 reviewerChecklist 或 generationGuidelines。
```

## 12. 后台体验建议

### 12.1 科目出题后台

AI 题库治理或专项练习后台应增加：

- Topic 出题画像卡片。
- 当前题量与目标题量。
- 缺题画像：按难度、题型、认知技能、阅读量、计算量拆分。
- 一键按缺口生成候选题。
- 候选题 Reviewer 结果。
- 错因标签和干扰项类型预览。
- 题目用途标记：诊断、专项、错题复练、模拟卷候选。

### 12.2 科目题审核页

审核页应能看到：

- 该题绑定的 topic profile。
- AI 声称的 readingLoad / calculationLoad 与证据。
- 常见错因和干扰项类型。
- 与真题和既有题库的相似风险。
- 建议用途。
- 是否可以进入 mock candidate pool。

### 12.3 模拟卷蓝图页

后台应能看到：

- 科目、考纲版本、题量、时长、状态。
- 难度分布。
- 模块分布。
- 阅读量 / 计算量分布。
- 题位列表。
- 每个题位的 topic、难度、估时和负载。

### 12.4 模拟卷生成页

后台应能操作：

- 生成整套 draft。
- 只生成某几个 slot。
- 替换某个 slot 的候选题。
- 查看 AI 生成理由、Reviewer 结果、相似度风险。
- 手动编辑题目。
- 运行整卷审核。

### 12.5 模拟卷发布页

发布前展示：

- 硬性门禁是否通过。
- 软性警告列表。
- 总估时 vs 考试时长。
- 题位难度曲线。
- 知识点覆盖。
- 答案分布。
- 相似风险摘要。

## 13. 分阶段落地

### 阶段 1：共享单题画像先行

目标：先让科目题、专项题和模拟题都有统一画像，不急着自动生成整卷。

- 给现有 AI 题库、专项练习题和模拟题补充 `SharedQuestionProfile`。
- 给每道题补充 readingLoad、calculationLoad、estimatedTimeSeconds、questionForm、cognitiveSkill、distractorTypes。
- 生成 TopicQuestioningProfile 初版。
- 后台展示 topic 画像和题目画像。
- 对现有题目做人工抽检，校正明显错误的画像。

验收：

- 管理员能看到每个 topic 的真实落题方式。
- 管理员能看到题目难度、阅读量、计算量和错因标签。
- 科目出题 prompt 能读取 topic profile。

### 阶段 2：科目出题按缺口生成

目标：AI 不再泛泛按 topic 生题，而是按缺题画像生题。

- 增加 TopicQuestionGap。
- 后台支持按 topic gap 生成候选题。
- SubjectQuestionGenerationJob 记录生成任务。
- 候选题进入 pending_review，不直接发布。
- Reviewer 检查题型、难度、阅读量、计算量、干扰项和错因标签。
- 人工审核后进入科目题库 / 专项练习 / mock candidate pool。

验收：

- 管理员能看到某 topic 缺什么类型的题。
- AI 生成题能追踪到 topic profile 和 gap。
- 科目练习题质量更稳定，干扰项更真实。

### 阶段 3：模拟卷画像与蓝图

目标：先能描述一套卷，不急着自动生成。

- 增加 `MockExamBlueprint` 和 `MockExamBlueprintSlot` 概念。
- 支持后台手工创建/导入蓝图 JSON。
- 从现有 mock paper 或真题样本生成初版蓝图摘要。
- 后台展示整卷分布和偏离提示。

验收：

- 管理员能看到一套卷的知识点、难度、阅读量、计算量和估时分布。
- 能发现“这套卷过难、过长、某模块过少、某类负载过集中”等问题。

### 阶段 4：AI 按题位生成模拟卷候选题

目标：AI 不再泛泛生模拟题，而是按 slot 生题。

- 每个 slot 生成候选题。
- 候选题进入草稿，不直接发布。
- 接入单题 Validator、Reviewer、Similarity Guard。
- 支持 slot 级重生成。
- 支持从候选题一键填入 draft paper。

验收：

- 管理员能生成一套 draft 模拟卷。
- 每道题都能追踪到对应 slot 和蓝图。
- 不合格题不会自动进入发布态。

### 阶段 5：整卷审核与发布门禁

目标：从“题都能用”升级到“整套卷能用”。

- 增加整卷 Reviewer。
- 增加难度、topic、负载、答案分布、总估时检查。
- 增加整卷发布前检查页面。
- 发布必须通过硬性门禁。

验收：

- 发布前能看到整卷风险。
- 不符合蓝图的卷不能直接发布。
- 人工审核记录可追溯。

### 阶段 6：学生数据校准

目标：让画像越来越准。

- 汇总学生作答数据。
- 更新 empiricalDifficulty、averageTimeSeconds、unansweredRate。
- 识别低质量题和异常题。
- 校准 readingLoad / calculationLoad / estimatedTimeSeconds。
- 为下一版蓝图提供建议。

验收：

- 后台能看到题目设计难度和真实难度差异。
- 能发现耗时异常和未答异常。
- 下一批科目出题和下一版模拟卷蓝图可以基于真实数据调整。

## 14. 与现有模块的关系

建议模块边界：

- `backend/src/csca-mock-exam`：继续负责模拟卷、题目、attempt、report；新增蓝图、生成任务和整卷审核。
- `backend/src/csca-special-practice`：继续承接科目练习、专项练习和 adaptive 训练题；新增题目画像读取、topic gap 使用和作答数据回流。
- `backend/src/ai-questioning`：继续负责 AI 生成、单题审题、真题画像、相似度检查；为科目出题提供 topic generation 能力，为 mock exam 提供 slot generation 能力。
- `frontend/src/pages/AdminMockExamPage.tsx`：增加蓝图、生成、整卷审核入口。
- `frontend/src/pages/AdminAIQuestionBankPage.tsx`：继续管理真题样本、风格画像、topic 画像、候选题和题库治理。
- `frontend/src/pages/AdminSpecialPracticePage.tsx`：增加 topic 缺题画像、按缺口生成候选题和专项题用途标记。
- `frontend/src/pages/CscaMockExamPage.tsx`：用户侧仍只看到已发布模拟卷，不暴露 AI 生成过程。
- `frontend/src/pages/CscaSubjectPage.tsx`：用户侧继续作为科目学习入口，使用更高质量的题库和 AI Coach，但不暴露后台画像复杂度。

不要把模拟卷生成入口放到普通用户侧。学生应该做“已审核发布的模拟卷”，而不是实时让 AI 现场生成一套考试。

## 15. 风险与边界

### 15.1 版权风险

真题画像必须保持抽象化，不把授权真题原文直接用于生成 prompt。相似度检查必须覆盖题干、数值结构、选项结构和解题路径。

### 15.2 质量风险

AI 生成题可能出现答案错误、多答案、超纲、解析不严谨、难度自评失真。必须保留 Validator、Reviewer、人工审核和发布门禁。

### 15.3 产品风险

如果只追求“快速生成很多卷”，会损害用户信任。第一版宁可少生成，也要确保每套卷可解释、可审核、可追溯。

### 15.4 数据风险

学生作答数据受样本量、学生水平、题位疲劳和设备环境影响。不能用少量数据直接判定题目质量，应设置置信度和最小样本量。

## 16. 推荐近期决策

建议下一步不要马上做“一键 AI 生成模拟卷”，而是先做这五件事：

1. 给现有科目题、专项题和模拟卷题增加共享题级画像字段：难度、阅读量、计算量、估时、知识点、认知技能、干扰项和错因标签。
2. 先生成 TopicQuestioningProfile，让科目出题能从真题解析维度受益。
3. 在后台增加 TopicQuestionGap，让 AI 按缺口生成科目候选题。
4. 再为每套模拟卷生成整卷画像报告：难度曲线、模块覆盖、负载分布、总估时、答案分布。
5. 最后增加模拟卷蓝图 JSON 导入/预览能力，先让管理员能确认“理想的一套卷长什么样”。

等科目出题画像和审核流程稳定后，再接模拟卷 slot generation。这样 AI 先生成高质量、可复用的科目题，再进一步组装成有依据、有结构、有审核链路的真实模拟卷。
