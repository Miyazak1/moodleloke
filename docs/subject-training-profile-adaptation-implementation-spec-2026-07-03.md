# 科目训练画像适配实施规格

> 日期：2026-07-03  
> 状态：可执行规格  
> 适用模块：`backend/src/ai-questioning`、`backend/src/csca-special-practice`、`frontend/src/pages/CscaSubjectPage.tsx`  
> 依赖文档：`docs/source-question-profile-upgrade-implementation-spec-2026-07-03.md`

## 1. 目标

让现有科目训练 AI 出题真正消费升级后的真题画像。

当前代码已经支持把 `styleProfile` 注入 AI 生成 blueprint，但训练侧还没有完整按画像调度、展示和审核。

本阶段目标是完成“画像增强出题”的闭环：

```text
SourceQuestion profile
-> Style / Topic profile
-> CscaQuestionBlueprint constraints.styleProfile
-> AI generator prompt
-> Reviewer
-> CscaQuestion generationMetadata
-> Adaptive training provider / UI
```

## 2. 非目标

本阶段不做：

- 用户侧实时生成训练题。
- 在线模考整卷 AI 组卷。
- 复杂个性化按错因动态生成新题。
- 删除 special practice legacy 题库。

## 3. 当前代码状态

### 3.1 已有基础

`QuestionPromptBuilderService` 已读取：

```ts
blueprint.constraints.styleProfile
```

并传入：

- generationGuidelines。
- reviewerGuidelines。
- commonQuestionForms。
- commonCognitiveSkills。
- optionPatterns。
- stemPatterns。
- similarityRiskSignals。

`AIQuestioningService` 已在生成前调用：

```ts
blueprintWithStyleProfile(blueprint)
```

并把生成 metadata 标记为：

```ts
sourceKind: 'syllabus_and_past_paper_profile'
generationSource: 'syllabus_and_past_paper_profile'
```

### 3.2 当前缺口

训练取题 provider 主要按：

- topic。
- difficulty。
- exposure。
- quality governance。

尚未按以下字段规划或筛选：

- questionForm。
- cognitiveSkill。
- readingLoad。
- calculationLoad。
- estimatedTimeSeconds。
- distractorTypes。
- commonMisconceptions。

另外，训练侧展示 label 还没有识别 `syllabus_and_past_paper_profile`。

## 4. 数据约定

### 4.1 生成 metadata

AI 生成题写入 `CscaQuestion.generationMetadata` 时必须包含：

```ts
type SubjectTrainingGenerationMetadata = {
  sourceKind: 'syllabus' | 'syllabus_and_past_paper_profile';
  generationSource: 'syllabus' | 'syllabus_and_past_paper_profile';
  intendedUse: 'subject_practice' | 'mock_candidate' | 'diagnostic' | 'wrong_question_review';
  syllabusScope: unknown;
  styleProfile?: {
    id: number;
    profileVersion: number;
    confidence: 'low' | 'medium' | 'high';
    sampleSize: number;
    scopeType: 'subject' | 'module' | 'topic';
    scopeId: number | null;
    freshness?: unknown;
    referencePolicy: 'profile_only';
  } | null;
  targetProfile?: {
    questionForm?: string;
    cognitiveSkill?: string;
    readingLoad?: string;
    calculationLoad?: string;
    estimatedTimeSeconds?: number | null;
    distractorTypes?: string[];
    commonMisconceptions?: string[];
  };
};
```

第一阶段 `targetProfile` 可由 style profile 派生，不要求管理员手工指定。

### 4.2 CscaQuestion 画像存储

短期可以使用 JSON 字段：

- `generationMetadata.targetProfile`
- `reviewMetadata.profileAlignment`
- `optionMetadata`

如果后续筛题性能不足，再把核心字段拆列。

## 5. Prompt 适配

### 5.1 Prompt 输入

`QuestionPromptBuilderService` 的 `styleReference` 应升级为：

```ts
styleReference: {
  policy: 'profile_only';
  id: number | null;
  profileVersion: number | null;
  confidence: string | null;
  sampleSize: number | null;
  scopeType: string | null;
  generationGuidelines: string[];
  reviewerGuidelines: string[];
  commonQuestionForms: unknown[];
  commonCognitiveSkills: unknown[];
  readingLoadDistribution: Record<string, number>;
  calculationLoadDistribution: Record<string, number>;
  estimatedTimeSeconds: unknown;
  optionPatterns: unknown;
  stemPatterns: unknown;
  similarityRiskSignals: string[];
}
```

### 5.2 Prompt 行为

模型必须：

1. 以 syllabusScope 作为硬边界。
2. 只把 style profile 当抽象画像。
3. 优先贴合高权重 question form / cognitive skill / load pattern。
4. 为每个错误选项输出 distractor intent 和 misconception tags。
5. 不复制、翻译、数字替换或重构来源真题。

### 5.3 Fallback

如果没有 active style profile：

1. 继续按 syllabus + blueprint 生成。
2. metadata 写 `sourceKind = syllabus`。
3. reviewer 不因缺少 style profile fail。

如果 style profile confidence 为 `low`：

1. prompt 可以读取。
2. reviewer 应偏向 warning / human_review。
3. 自动批量发布不得依赖低置信度画像。

## 6. Reviewer 适配

`QuestionReviewerProviderService` 已能读取 styleProfile。

需要补充 reviewer rubric：

- `styleAlignment`：是否贴合 question form 和 cognitive skill。
- `loadAlignment`：readingLoad / calculationLoad 是否合理。
- `distractorAlignment`：干扰项是否覆盖画像中的错因类型。
- `examLikeDifficulty`：难度是否有证据支持。
- `pastPaperSimilarityRisk`：是否过近。

reviewMetadata 建议写入：

```ts
type ProfileAlignmentReview = {
  styleProfileId?: number | null;
  status: 'passed' | 'warning' | 'failed' | 'not_checked';
  matchedSignals: string[];
  missingSignals: string[];
  loadAssessment: {
    readingLoad: string;
    calculationLoad: string;
    estimatedTimeSeconds: number | null;
    confidence: 'low' | 'medium' | 'high';
  };
  distractorAssessment: {
    coveredTypes: string[];
    weakDistractors: string[];
  };
};
```

## 7. 训练取题适配

### 7.1 第一阶段

不大改 planner。

保留当前 provider 排序：

- topic。
- difficulty。
- exposure。
- quality governance。

新增轻量排序因子：

1. 优先 `CscaQuestion`。
2. 优先 generation metadata 中 `sourceKind = syllabus_and_past_paper_profile` 的题。
3. 对 `qualityGovernance.disposition = reduce_exposure` 继续降权。
4. 如果 planned topic 有 target profile，则优先匹配 profile。

### 7.2 第二阶段

Adaptive planner 输出可增加：

```ts
type AdaptivePlannedTopicProfileTarget = {
  questionForm?: string;
  cognitiveSkill?: string;
  readingLoad?: 'low' | 'medium' | 'high';
  calculationLoad?: 'none' | 'light' | 'medium' | 'heavy';
  misconceptionTags?: string[];
};
```

Provider 根据 target profile 选择题目。

### 7.3 不足题处理

如果没有匹配 profile 的题：

1. 放宽 profile 匹配。
2. 仍保持 topic 匹配。
3. 再放宽 difficulty。
4. 最后 fallback 到 legacy special practice。

不允许因为画像缺失导致训练轮次无法创建。

## 8. 缺题画像适配

后台 topic health 不应只显示缺题数量。

新增派生结构：

```ts
type TopicQuestionGapV1 = {
  topicId: number;
  currentCount: number;
  targetCount: number;
  gaps: Array<{
    questionForm: string;
    cognitiveSkill: string;
    difficultyBand: string;
    readingLoad: string;
    calculationLoad: string;
    neededCount: number;
    reason: 'coverage' | 'low_quality_existing' | 'student_weakness' | 'mock_candidate_pool';
  }>;
};
```

第一阶段可以只在后台展示，不直接驱动用户训练。

## 9. 前台展示适配

`generatedQuestionSourceLabel()` 必须识别：

```ts
sourceKind === 'syllabus_and_past_paper_profile'
```

显示：

```text
AI生成题 · 大纲+真题画像
```

不要向学生展示复杂画像字段。

学生侧只需要知道题目来源质量等级，不需要看到真题样本细节。

## 10. 后台展示适配

AI Question Bank 候选题列表/详情应展示：

- 是否使用真题画像。
- styleProfile id。
- styleProfile confidence。
- intendedUse。
- targetProfile。
- reviewer profile alignment。
- similarity risk。

Topic health 页面应展示：

- active style profile freshness。
- 当前 topic 缺题画像。
- 是否能按画像生成候选题。

## 11. 迁移与上线

上线顺序：

1. 先支持新 metadata 和 label。
2. 再升级 prompt/reviewer 输入。
3. 再回填已有 AI 题 generation metadata 的 normalized shape。
4. 再把 provider 排序纳入 profile-aware 因子。
5. 最后打开后台缺题画像。

线上保护：

- 缺 `generationMetadata` 不报错。
- 缺 `styleProfile` 不报错。
- 缺 `targetProfile` 不报错。
- 旧题继续可出现在训练中。

## 12. 验收标准

1. 有 active style profile 的 topic，生成任务 metadata 中出现 `syllabus_and_past_paper_profile`。
2. prompt metadata 中包含 `styleReference.readingLoadDistribution` 和 `calculationLoadDistribution`。
3. reviewer 输出 profile alignment 相关结果。
4. 科目训练题目来源 label 正确显示“AI生成题 · 大纲+真题画像”。
5. 没有 active style profile 的 topic 仍可生成题。
6. adaptive training provider 不因缺画像字段失败。
7. topic health 能显示至少一个维度化缺题结果。

## 13. 测试建议

单元测试：

- `generatedQuestionSourceLabel()` 识别 `syllabus_and_past_paper_profile`。
- metadata normalizer 兼容旧题。
- provider 排序优先画像增强题。

服务测试：

- `generateForBlueprint()` 注入 active style profile。
- reviewer 能收到 style profile。
- low confidence style profile 不直接导致 fail。

前端测试：

- 科目训练页能渲染画像增强题。
- 旧题缺 metadata 时页面不崩。
- source label 正确。
