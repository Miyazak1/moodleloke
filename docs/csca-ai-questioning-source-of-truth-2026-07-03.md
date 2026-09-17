# CSCA AI 出题与在线模考 Source of Truth

> 日期：2026-07-03  
> 状态：当前执行准则  
> 适用范围：上传真题解析、科目训练 AI 出题、在线模考 AI 组卷  
> 主方案来源：`docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md`

## 1. 当前结论

当前阶段要解决两件事：

1. 升级上传真题/样本的解析画像能力。
2. 让在线模考后续具备后台 AI 出题和整卷组卷能力。

这两件事不是并列孤岛。真题解析画像是底座；科目训练和在线模考都消费这套画像。

```text
上传真题 / 样本
-> 单题解析画像
-> topic / subject 风格与出题画像
-> 科目训练 AI 出题
-> 在线模考整卷蓝图与题位蓝图
-> 在线模考 AI 候选题
-> 审核发布
```

## 2. 当前主文档

主文档：

- `docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md`

上游支撑文档：

- `docs/csca-source-reference-auto-profile-architecture-2026-07-01.md`

相关边界文档：

- `docs/adaptive-training-implementation-blueprint.md`
- `docs/adaptive-ai-questioning-plan.md`
- `docs/mock-exam-past-paper-resource-plan.md`
- `docs/session-work-summary-2026-07-03.md`

## 3. 决策

### 3.1 架构策略

采用干净新架构，不长期兼容旧业务模型。

上线安全通过迁移、默认值、灰度和 fallback 保证，不把旧字段判断散落到主业务逻辑里。

主业务代码只消费 normalized 后的新画像结构。

### 3.2 真题解析定位

上传真题/样本解析不只是把题目入库，而是生成考试画像。

必须沉淀：

- 知识点。
- 题型。
- 认知技能。
- 难度证据。
- 阅读量。
- 计算量。
- 估时。
- 题干结构。
- 选项结构。
- 干扰项类型。
- 常见错因。
- 相似风险信号。

### 3.3 科目训练定位

科目训练已经有 AI 出题能力。

升级后，科目训练不改用户侧主流程，但必须适配新画像：

- AI prompt 读取画像。
- Reviewer 检查画像对齐。
- 生成 metadata 记录画像来源。
- 取题/缺题逻辑逐步从 topic+difficulty 升级到 profile-aware。

### 3.4 在线模考定位

在线模考 AI 出题只发生在后台，不在用户侧实时生成。

学生侧只做已审核发布的在线模考卷。

后台目标流程：

```text
模考题库
-> 选择科目和考纲版本
-> 创建或加载整卷蓝图
-> 确认题位蓝图
-> AI 按题位生成候选题
-> 单题审核
-> 草稿卷组装
-> 整卷审核
-> 人工发布
```

### 3.5 Past Papers 边界

`mock-exam-past-paper-resource-plan.md` 只处理 PDF/resource 管理。

Past Paper 资源不是在线模考 AI 出题主链路，不能和 `MockExamPaper` / `MockExamQuestion` 混用。

## 4. 已过时或需收束的口径

### 4.1 人工逐题确认入画像

旧流程中“逐题确认用于画像”的表述不再作为主路径。

当前主路径是：

```text
导入样本
-> 自动解析
-> auto-profile gate
-> auto_approved 样本进入画像
-> 低置信度或失败样本进入复核/排除/重试
```

人工复核仍存在，但不是每题进入画像前的必经步骤。

### 4.2 一键生成整张模考卷

不采用“一次 prompt 生成整张卷”的方案。

在线模考生成必须按题位 slot 生成候选题，并经过整卷审核。

### 4.3 动态用户侧模考

短期不做用户侧实时动态模考。

当前在线模考用户侧仍是固定套卷、推荐下一套、作答、保存、提交、报告。

## 5. 本轮执行范围

### 5.1 必做

1. 真题解析画像 schema 升级。
2. SourceQuestion analysis normalizer。
3. StyleProfile / TopicProfile 汇总维度升级。
4. 科目训练 AI prompt 读取新画像。
5. 科目训练 reviewer 读取新画像。
6. 生成题 metadata 标准化。
7. 训练侧识别 `syllabus_and_past_paper_profile` 来源标签。

### 5.2 暂缓

1. 在线模考完整 AI 组卷。
2. `MockExamBlueprint` / `MockExamBlueprintSlot` 数据模型。
3. 整卷 reviewer。
4. 用户侧动态生成模考。

### 5.3 可提前预留

1. 题目画像字段要能被未来 `MockExamBlueprintSlot` 复用。
2. 生成 metadata 要能记录 intended use：`subject_practice` 或 `mock_candidate`。
3. Similarity risk 信号要可用于未来整卷发布门禁。

## 6. 实施顺序

1. 写入新规格文档。
2. 升级真题解析画像 schema 与 normalizer。
3. 升级 style profile 汇总。
4. 适配科目训练 AI 出题 prompt 和 reviewer。
5. 适配训练侧来源标签和 metadata。
6. 增加后台画像展示与抽检能力。
7. 用现有题库回填新画像。
8. 验证科目训练出题质量。
9. 再写在线模考 AI 组卷实施规格。

## 7. 工程原则

### 7.1 新主链路只读 normalized profile

允许旧数据存在，但业务逻辑不直接读多套旧字段。

集中提供：

```ts
normalizeSourceQuestionAnalysis(input): NormalizedQuestionProfile
normalizeStyleProfile(input): NormalizedTopicQuestioningProfile
normalizeQuestionGenerationMetadata(input): NormalizedGenerationMetadata
```

### 7.2 缺省不崩溃

线上已有数据可能缺失新字段。

所有画像字段必须有安全默认值或 `unknown` 状态，不能让 API 或前台白屏。

### 7.3 低置信度降权

低置信度画像可以辅助 prompt，但不能作为硬性发布依据。

Reviewer 对低置信度画像应输出 `human_review` 或 warning，而不是直接 fail。

### 7.4 画像不复制真题

prompt 只使用抽象画像。

不得把授权真题原文、原选项、原数值组合直接交给生成模型做改写。

## 8. 验收口径

本轮完成后应满足：

1. 新导入真题样本能生成 normalized question profile。
2. active style profile 能包含新增画像维度。
3. AI 生成题 prompt metadata 能显示是否使用真题画像。
4. 训练题生成后的 metadata 能记录 `syllabus_and_past_paper_profile`。
5. 科目训练侧能正确展示“AI生成题 · 大纲+真题画像”。
6. 没有真题画像的 topic 仍可按 syllabus + blueprint 出题。
7. 旧线上题目缺少新画像字段时，前后台不报错。
