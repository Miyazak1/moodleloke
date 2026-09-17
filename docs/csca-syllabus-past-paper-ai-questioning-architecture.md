# CSCA 考纲、授权真题与 AI 生题架构决策

> 日期：2026-06-10  
> 状态：架构决策文档  
> 范围：CSCA 数学、物理、化学题库扩充；AI 原创题生成；授权真题和官方考纲的使用边界。

## 1. 结论

CSCA 题库建设应以 **官方考纲** 作为最高约束，以 **授权真题** 作为风格、难度和分布校准材料，以 **AI** 作为原创候选题生成与审题辅助工具。

优先级固定为：

```text
官方考纲 > 题库蓝图 > 授权真题统计特征 > 学生作答反馈 > 模型自由发挥
```

这意味着：

- 考纲决定能考什么、不能考什么、题型、语言、时长、题量和知识边界。
- 真题不定义考试范围，只帮助理解官方范围通常如何落题。
- AI 生成题必须是原创仿真题，不能复制、近似改写或换数字复刻授权真题。
- 学生作答数据用于校准题目质量、真实难度、干扰项有效性和补题优先级，不直接训练外部大模型。

## 2. 资源分层

### 2.1 官方考纲

官方考纲是题库系统的顶层来源。每个考纲版本应结构化为：

```text
subject
module
topic
subtopic
skill
allowedQuestionTypes
difficultyRange
syllabusVersion
sourceUrl
sourceLabel
lastVerifiedAt
verifiedBy
status
```

题目、蓝图、真题映射和 AI 生成任务都必须绑定 `syllabusVersion`。当考纲更新时，旧版本题目进入复核或过期检查流程。

### 2.2 授权真题

授权真题是高价值参考材料，但不是顶层范围来源。它应进入单独的来源治理层，记录：

```text
sourceDocument
licenseScope
usagePolicy
examYear
examSession
subject
fileHash
questionNumber
pageNumber
topicMapping
reviewStatus
```

授权真题可以用于：

- 校准 topic 高频程度。
- 校准模块配比。
- 校准题干长度、选项风格和计算量。
- 校准 L1-L4 难度分布。
- 分析干扰项类型和常见错因。
- 校验 AI 生成题是否符合真实考试风格。

授权真题不应用于：

- 让 AI 直接改写原题。
- 换数字生成近似题。
- 在未满足授权范围时展示、下载或商业分发。
- 覆盖考纲边界。
- 作为训练外部大模型的原始数据。

### 2.3 AI 原创题

AI 生成题应被视为候选内容，而不是自动发布内容。生成流程必须是：

```text
SyllabusTopic
-> CscaQuestionBlueprint
-> AI Generator
-> Similarity Guard
-> Question Validator
-> AI Reviewer
-> Human Review
-> CscaQuestion approved
```

所有 AI 题必须保留：

- `sourceType = ai_generated`
- `blueprintId`
- `syllabusVersion`
- `designedDifficulty`
- `generationMetadata`
- `reviewMetadata`
- `status = pending_review / approved / rejected`

## 3. 真题作为参考时的处理方式

不要把真题原文直接放进生成 prompt。更稳妥的方式是先把真题转成抽象风格画像：

```text
QuestionStyleProfile
- topicWeight
- averageStemLength
- optionPattern
- commonDistractorTypes
- calculationComplexity
- reasoningStepRange
- languageStyle
- difficultyDistribution
```

AI 生成 prompt 应读取考纲蓝图和风格画像，而不是读取某一道真题全文。

错误方式：

```text
参考这道真题，改一下数字再出一道。
```

推荐方式：

```text
根据 2025 版 CSCA 数学考纲，围绕“函数定义域与单调性”生成一道 L2 单项选择题。
风格约束来自授权真题统计画像：题干 1-2 句，4 个选项，干扰项包含定义域误判、单调性误判和符号计算错误。
不得复用任何授权真题题干、数值组合或选项结构。
```

## 4. 相似度与版权风险控制

系统应增加 Similarity Guard，至少检查：

- 题干文本相似度。
- 数值结构相似度。
- 选项结构相似度。
- 解题路径相似度。
- 与同一授权真题的 topic、参数和答案模式是否高度重合。

命中高风险时：

```text
similarityStatus = high_risk
status = pending_review 或 rejected
reviewReason = similar_to_authorized_source
```

人工审核通过前，高相似候选题不得进入正式题库或学生训练。

## 5. 学生作答反馈的边界

学生作答反馈应先用于系统自我改进，而不是模型自我训练。

可以用于：

- 更新 `empiricalDifficulty`。
- 更新 `difficultyConfidence`。
- 识别低质量题。
- 识别过强或过弱干扰项。
- 标记多答案、歧义题或超纲风险。
- 调整补题优先级。
- 调整下一批 blueprint 的 topic 和 difficulty 配比。

不应默认用于：

- fine-tune 外部 LLM。
- 自动改写并发布题目。
- 自动解除人工审核。
- 向模型发送可识别学生身份的数据。

推荐闭环：

```text
学生作答
-> QuestionQualityMetric
-> empiricalDifficulty / optionQuality / needsReview
-> Blueprint 补题优先级
-> AI 生成下一批候选题
```

## 6. 对当前架构的影响

当前项目已经具备一部分承接能力：

- `CscaExamTopic` 可承接考纲 topic 和 `syllabusVersion`。
- `CscaQuestionBlueprint` 可承接出题蓝图。
- `CscaQuestion` 可承接 AI 候选题和正式题。
- `CscaAiGenerationJob` 可记录生成任务。
- `CscaQuestionQualityMetric` 可承接作答反馈和真实难度校准。
- `backend/src/ai-questioning` 已有 generator、validator、reviewer、quality service 的基础模块。

还需要补强：

- 授权来源文档表，例如 `CscaSourceDocument`。
- 授权真题题级表，例如 `CscaSourceQuestion`。
- 授权范围字段：`licenseScope`、`usagePolicy`。
- 真题风格画像：`QuestionStyleProfile` 或生成任务 metadata。
- Similarity Guard。
- 后台来源管理和授权状态管理。
- 后台真题解析、topic 映射和题级审核流程。

## 7. 产品表达

在没有明确展示授权时，AI 生成题对外应表达为：

- 基于官方考纲的原创仿真题。
- CSCA 风格专项练习。
- 基于授权样本校准的模拟练习。

不要表达为：

- 官方题。
- 真题改编。
- 官方题库。
- 与某次真题等价。

如授权真题可以公开展示，应与 AI 原创题分开标注：

```text
授权真题：来源清楚、授权范围清楚、可追溯。
原创仿真题：基于考纲和授权样本统计特征生成，经过审核。
```

## 8. 推荐执行顺序

### Phase 1：考纲结构化

- 导入官方考纲 PDF。
- 拆成 subject / module / topic / subtopic / skill。
- 设置 `syllabusVersion = 2025`。
- 建立每个 topic 的 allowed question type 和 difficulty range。

### Phase 2：授权真题治理

- 建立来源文档表。
- 记录授权范围。
- 拆题并绑定页码、题号、hash。
- 做 topic 映射和难度初标。

### Phase 3：风格画像

- 统计真题 topic 分布、难度分布、题干长度、干扰项类型。
- 为每科生成 `QuestionStyleProfile`。
- 只把画像传给 AI，不把真题原文作为默认 prompt 输入。

### Phase 4：AI 候选题生成

- 每个 topic 先生成小批量候选题。
- 经过 Validator、AI Reviewer、Similarity Guard。
- 人工审核后再发布。

### Phase 5：反馈校准

- 上线后用作答数据更新真实难度和题目质量。
- 高偏差题进入复核。
- 根据缺口和高需求 topic 自动生成下一批 blueprint。
