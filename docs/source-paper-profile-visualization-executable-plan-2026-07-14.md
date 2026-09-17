# 源卷画像可视化看板可执行方案

> 日期：2026-07-14  
> 范围：后台 AI 题库、源卷上传、单卷画像、连续趋势画像、当前出题画像  
> 目标：管理员上传真题/模考/预测卷 JSON 后，可以在后台用图表直观看到系统如何理解这份源卷，并能继续查看多源卷趋势画像与当前出题画像的结构依据。

## 1. 结论

可以做，而且应该做。

当前系统已经保存了足够的画像数据：

- `csca_source_documents`：源卷记录。
- `csca_source_questions`：源题、知识点、自动画像、审核状态。
- `csca_question_style_profiles`：单卷/样本画像。
- `csca_exam_series_profiles`：连续源卷趋势画像。
- `csca_generation_profiles`：科目训练/在线模考当前出题画像。

当前缺的是“图表化聚合接口”和“后台可视化组件”。不需要改变上传 JSON 格式，也不需要改变 AI 出题、门禁和正式题库逻辑。

推荐做成读侧增强：

```text
上传源卷 JSON
-> source document / source questions
-> 自动画像 / 映射 / 自动纳入
-> 后台画像图表看板
-> 生成单卷画像 / 连续趋势画像 / 当前出题画像
-> 科目训练 / 在线模考 AI 出题
```

## 2. 需要解决的问题

现在后台能看到文本摘要，但管理员很难快速判断：

1. 上传的这份真题是否解析完整。
2. 知识点覆盖是否正常。
3. 难度分布是否合理。
4. 题型、认知技能、阅读量、计算量是否有明显偏差。
5. 答案 A/B/C/D 是否偏斜。
6. 有多少题是 `unknown`、低置信度、待人工处理。
7. 当前单卷画像和连续趋势画像之间有什么差异。
8. AI 出题为什么会使用某个当前出题画像。

因此需要把画像从“文字列表”升级为“可诊断图表”。

## 3. 设计原则

1. 不改源数据结构  
   当前 JSON 上传和 source question 存储继续使用现有字段。

2. 后端负责全量聚合  
   前端不能用当前分页列表直接画图，否则只会展示当前页，不是真实全卷画像。

3. 图表先轻量实现  
   第一版不用引入 ECharts/Recharts。使用 CSS/SVG/HTML 条形图即可，减少依赖和打包体积。

4. 读侧能力，不影响出题  
   看板只读，不参与生成、审核、门禁决策。后续可以把诊断结果作为提示，但第一版不改变 AI 生成闭环。

5. 单卷、趋势、当前出题画像分层展示  
   不把三层混在一起。上传后首先看单卷画像，多源卷时再看趋势画像，AI 出题前再看当前出题画像。

## 4. 看板分层

### 4.1 单卷画像看板

对象：一份 `csca_source_documents`。

入口：

```text
后台 -> AI 题库 -> 大纲与源卷画像 -> 源卷库 -> 选择某份源卷 -> 画像图表
```

展示内容：

- 基础信息：
  - 源卷标题。
  - 学科。
  - 大纲版本。
  - 来源类型：真题 / 模考 / 预测 / 参考。
  - 年份 / 月份 / session。
  - 总题数。
  - 已映射题数。
  - 自动纳入题数。
  - 待处理题数。
  - 低置信度题数。

- 分布图：
  - 知识点覆盖。
  - 难度分布。
  - 题型分布。
  - 认知技能分布。
  - 阅读负荷。
  - 计算负荷。
  - 答案分布。
  - 预计用时分布。

- 风险诊断：
  - `unknown` 占比过高。
  - 未映射知识点过多。
  - 答案分布偏斜。
  - 难度过窄。
  - 题型过单一。
  - 自动画像失败或待重试较多。
  - 样本数量不足，不建议生成趋势画像。

### 4.2 连续趋势画像看板

对象：一个 `csca_exam_series_profiles`。

入口：

```text
后台 -> AI 题库 -> 画像状态 -> 连续趋势画像 #id -> 图表
```

展示内容：

- 源卷窗口：
  - 纳入了几份源卷。
  - 每份源卷题数。
  - 来源类型构成。
  - 样本总量。
  - 置信度。

- 趋势图：
  - 不同源卷的知识点覆盖对比。
  - 不同源卷的难度分布对比。
  - 稳定高频知识点。
  - 高频轮换知识点。
  - 近期增强知识点。
  - 近期下降知识点。

- 结构诊断：
  - 当前趋势画像是否足够稳定。
  - 是否只有一份源卷，置信度偏低。
  - 是否 sourceType 过于单一。
  - 是否某些关键知识点缺失。

### 4.3 当前出题画像看板

对象：一个 `csca_generation_profiles`。

入口：

```text
后台 -> AI 题库 -> 画像状态 -> 科目训练/在线模考当前出题画像 #id -> 图表
```

展示内容：

- 用途：
  - `subject_practice`
  - `online_mock_exam`

- 来源链路：
  - generationProfileId。
  - seriesProfileId。
  - sourceStyleProfileId。
  - sourceDocumentIds。
  - profileWindow。
  - policyVersion。

- 出题目标：
  - 目标知识点覆盖。
  - 目标难度结构。
  - 目标题型结构。
  - 目标认知技能。
  - 阅读/计算负荷要求。
  - 在线模考 48 题结构。
  - 科目训练补题矩阵。

## 5. 后端接口设计

### 5.1 单卷画像图表接口

新增：

```http
GET /api/v1/admin/ai-questioning/source-documents/:id/profile-visualization
```

返回：

```json
{
  "document": {
    "id": 48,
    "title": "CSCA Mathematics Past Paper - April 2026",
    "subject": "math",
    "syllabusVersion": "2025",
    "sourceType": "past_paper",
    "examYear": 2026,
    "examSession": "april"
  },
  "summary": {
    "questionCount": 48,
    "mappedCount": 48,
    "autoApprovedCount": 48,
    "pendingCount": 0,
    "lowConfidenceCount": 2,
    "unknownDimensionCount": 1
  },
  "distributions": {
    "topics": [
      { "key": "M-GEO-001", "label": "平面解析几何", "count": 8, "ratio": 0.1667 }
    ],
    "difficulty": [
      { "key": "basic", "label": "基础", "count": 16, "ratio": 0.3333 }
    ],
    "questionForm": [],
    "cognitiveSkill": [],
    "readingLoad": [],
    "calculationLoad": [],
    "answers": [],
    "estimatedTime": []
  },
  "diagnostics": [
    {
      "severity": "warning",
      "code": "low_confidence_samples",
      "message": "2 道题画像置信度较低，建议抽查。"
    }
  ],
  "sampleQuestions": [
    {
      "id": 5319,
      "questionNumber": "1",
      "topicCode": "M-GEO-001",
      "difficulty": "medium",
      "questionForm": "calculation_application",
      "cognitiveSkill": "standard_application",
      "analysisConfidence": 0.88,
      "reviewStatus": "approved"
    }
  ]
}
```

### 5.2 学科源卷画像概览接口

可选新增：

```http
GET /api/v1/admin/ai-questioning/profile-visualization/source-documents?subject=math&syllabusVersion=2025
```

用途：

- 后台页面顶部展示当前学科所有源卷的画像健康度。
- 对比多份源卷。
- 快速发现某份源卷未画像、未映射或异常。

第一版可以不新增该接口。当前后台已经有源卷列表和单卷画像图表接口，概览可先由列表摘要承载；等源卷数量明显增加、页面需要跨源卷排序/筛选健康度时，再补这个聚合接口。

返回：

```json
{
  "items": [
    {
      "documentId": 48,
      "title": "CSCA Mathematics Past Paper - April 2026",
      "sourceType": "past_paper",
      "questionCount": 48,
      "autoApprovedCount": 48,
      "mappedCount": 48,
      "confidence": "medium",
      "healthScore": 92,
      "topTopics": ["M-GEO-001", "M-STAT-001"],
      "diagnosticCodes": []
    }
  ]
}
```

### 5.3 趋势画像图表接口

优先复用现有列表接口：

```http
GET /api/v1/admin/ai-questioning/exam-series-profiles?subject=math
```

该接口已经返回 `trendProfile`、`sessionSummary`、`sourceDocumentIds`、`sampleSize`、`confidence`，足够第一版在前端直接渲染轻量图表，不需要为每个展开项额外请求。

未来如果趋势画像体积增大，或需要按源卷重新聚合，再新增：

```http
GET /api/v1/admin/ai-questioning/exam-series-profiles/:id/visualization
```

读取：

- `csca_exam_series_profiles.trend_profile`
- `session_summary`
- `source_document_ids`
- 关联源卷的单卷统计。

### 5.4 当前出题画像图表接口

优先复用现有列表接口：

```http
GET /api/v1/admin/ai-questioning/generation-profiles?subject=math
```

该接口已经返回 `profile`、`targetPolicy`、`seriesProfileId`、`sourceStyleProfileId`、`sampleSize`、`confidence`，足够第一版展示“服务科目训练还是在线模考、使用哪个趋势画像、目标难度/题型/认知技能/阅读负荷/计算负荷”。

未来如果当前出题画像需要与运行时队列、候选成功率做联动诊断，再新增：

```http
GET /api/v1/admin/ai-questioning/generation-profiles/:id/visualization
```

读取：

- `csca_generation_profiles.profile`
- `target_policy`
- `series_profile_id`
- `source_style_profile_id`

## 6. 后端聚合规则

### 6.1 维度来源

优先从标准化后的 `sourceAnalysisFromQuestion(q.analysis, q)` 得到：

- `difficulty`
- `questionForm`
- `cognitiveSkill`
- `readingLoad`
- `calculationLoad`
- `estimatedTimeSeconds`
- `reasoningSteps`
- `optionPattern`

知识点来源：

1. `q.topic_id` 关联 `csca_exam_topics.code/title`。
2. `q.topic_codes`。
3. `q.blueprint_like_tags`。

答案来源：

- `q.correct_answer`

状态来源：

- `q.review_status`
- `q.auto_profile_status`
- `q.analysis_status`
- `q.analysis_confidence`
- `q.analysis_issues`

### 6.2 ratio 计算

每个分布项返回：

```text
count = 当前维度值数量
ratio = count / 有效样本总数
```

注意：

- `unknown` 不要隐藏，要单独展示。
- 分母要清楚：题目总数 or 该维度有效题数。
- 前端图表需要同时显示 count 和 ratio，避免误读。

### 6.3 健康分

第一版健康分可规则化：

```text
100
- 未映射比例 * 30
- unknown 维度比例 * 20
- 低置信度比例 * 20
- 待处理比例 * 20
- 答案分布偏斜扣 5-10
- 样本太少扣 10
```

健康分只作为后台诊断，不参与 AI 出题门禁。

## 7. 前端 UI 设计

### 7.1 页面位置

推荐放在现有：

```text
AdminAIQuestionBankPage
-> SourceReferenceWorkspace
-> SourceReferenceLibraryPanel / StyleProfilePanel
```

新增组件：

```text
frontend/src/components/admin/ai-question-bank/ProfileVisualizationPanel.tsx
frontend/src/components/admin/ai-question-bank/ProfileDistributionChart.tsx
frontend/src/components/admin/ai-question-bank/ProfileDiagnosticsPanel.tsx
```

### 7.2 源卷库交互

在源卷列表每条记录增加：

```text
查看画像图表
```

点击后在同页展开，不跳转新页面。

原因：

- 用户正在按流程处理源卷，不应跳离流程。
- 和之前“真题画像做到本页面，不单独页面”的设计保持一致。

### 7.3 图表类型

第一版用以下轻量图表：

- 水平条形图：知识点、题型、认知技能。
- 分段条：难度、阅读负荷、计算负荷。
- 小型柱状图：答案分布。
- 指标卡：题数、映射数、自动纳入数、健康分。
- 诊断列表：warning/error/info。

不建议第一版上复杂饼图：

- 标签容易挤。
- 知识点多时可读性差。
- 条形图更适合后台诊断。

### 7.4 UI 文案

建议统一术语：

- “源卷画像”替代“真题画像”。
- “单卷画像”表示一份上传源卷。
- “连续趋势画像”表示多份源卷聚合。
- “当前出题画像”表示 AI 出题实际使用版本。

## 8. 对现有功能的影响

| 功能 | 影响 | 处理 |
| --- | --- | --- |
| 上传 JSON | 不改格式 | 上传后新增图表查看入口 |
| 自动画像 | 不改逻辑 | 图表读取自动画像结果 |
| 知识点映射 | 不改逻辑 | 图表显示未映射比例 |
| 生成单卷画像 | 不改逻辑 | 图表展示 profile JSON 的分布 |
| 连续趋势画像 | 不改生成逻辑 | 新增趋势可视化 |
| 当前出题画像 | 不改生成逻辑 | 新增出题目标可视化 |
| 科目训练 AI 出题 | 不影响 | 可在候选题证据中显示画像来源 |
| 在线模考 AI 出题 | 不影响 | 可在蓝图/题位旁展示画像来源 |
| 前台学生练习 | 不影响 | 后台管理能力 |

## 9. 性能与缓存

### 9.1 聚合压力

单卷通常 48 题，聚合压力很小。

学科级多源卷可能几百到几千题，仍然可以实时聚合。但为了后台加载速度，建议：

- 单卷详情实时聚合。
- 学科概览接口 limit 默认 50 份源卷。
- 趋势画像优先读取已保存的 `trend_profile`，不重复扫描全部源题。
- 当前出题画像优先读取 `profile` 和 `target_policy`。

### 9.2 缓存策略

第一版不需要 Redis。

可选优化：

- 在接口层设置短缓存，例如 30 秒内相同 query 复用。
- 或在源题自动画像完成后写一份 `profile_visualization_snapshot`，后续再考虑。

开发阶段不建议过早加缓存，先保证数据准确。

## 10. 权限与安全

接口只允许 admin。

返回数据注意：

- 可以返回题干摘要和画像字段。
- 不需要返回完整答案解析全文，除非用户展开样本题。
- 不返回 provider prompt、key、内部失败堆栈。
- 不改变源卷 license/usage policy。

## 11. 异常状态处理

| 状态 | 展示 |
| --- | --- |
| 没有源卷 | 请先上传真实 `past_paper` 真题 JSON；模考卷、预测卷、练习卷只能作为资源/套装/手工题资产，不能导入画像源 |
| 有源卷但没有题 | 源卷未解析出题目 |
| 有题但没有画像 | 等待自动画像或点击重新画像 |
| 有画像但 unknown 很多 | 画像维度不足，建议重跑自动画像或抽查 JSON 字段 |
| 有题但未映射 | 先做知识点映射 |
| 只有一份源卷 | 可看单卷画像，但趋势画像置信度低 |
| 当前出题画像缺失 | 先生成连续趋势画像和当前出题画像 |

## 12. 实施步骤

### 阶段 1：后端聚合接口

1. 新增 visualization DTO 类型。
2. 新增 source document 单卷可视化 service 方法。
3. 新增学科源卷画像概览 service 方法。
4. 新增趋势画像可视化 service 方法。
5. 新增当前出题画像可视化 service 方法。
6. Controller 挂载 admin API。
7. 加 rules test，检查接口和关键字段。

### 阶段 2：前端 API 与类型

1. `api-types.ts` 增加可视化返回类型。
2. `api-admin.ts` 增加请求函数。
3. `useSourceReferenceDataRefresh` 可选择加载当前选中源卷图表。
4. 保持懒加载，避免后台首页打开时一次请求太多。

### 阶段 3：后台组件

1. 新增 `ProfileVisualizationPanel`。
2. 新增 `ProfileDistributionChart`。
3. 新增 `ProfileDiagnosticsPanel`。
4. 源卷卡片加入“查看画像图表”。
5. StyleProfilePanel 加入趋势画像和出题画像图表入口。

### 阶段 4：验证

1. 上传数学 JSON 后能看到单卷画像图表。
2. 自动画像前后图表状态变化正确。
3. 知识点映射后覆盖图更新。
4. 生成连续趋势画像后可看趋势图。
5. 生成当前出题画像后可看科目训练/在线模考目标图。
6. 前端 build 通过。
7. 后端 tsc 通过。

## 13. 测试建议

新增脚本：

```text
scripts/csca-source-profile-visualization-rules-test.cjs
```

检查：

- Controller 包含 visualization endpoints。
- Service 返回 `summary`、`distributions`、`diagnostics`。
- 前端 API 包含 visualization functions。
- 前端组件包含知识点、难度、题型、认知技能、答案分布展示。

可选 smoke：

```text
scripts/csca-source-profile-visualization-smoke.cjs
```

用隔离 subject 创建：

- source document。
- source questions。
- analysis。
- topic mapping。
- style profile。

然后请求 visualization service，断言：

- questionCount 正确。
- difficulty 分布正确。
- answers 分布正确。
- diagnostics 可生成。

## 14. 验收标准

最低完成标准：

1. 管理员上传源卷 JSON 后，可以在同一个后台页面查看该源卷画像图表。
2. 图表至少包含：知识点、难度、题型、认知技能、阅读负荷、计算负荷、答案分布。
3. 看板显示自动画像健康状态：总题数、已映射、自动纳入、待处理、低置信度。
4. `unknown` 不被隐藏，能直观看出画像缺口。
5. 连续趋势画像能显示来源源卷数量、样本数量、稳定/轮换趋势摘要。
6. 当前出题画像能显示它服务科目训练还是在线模考，以及使用的趋势画像 ID。
7. 不影响现有 AI 出题、门禁、候选入库、在线模考装配。
8. 前端生产构建通过。
9. 后端类型检查通过。

## 15. 推荐最终形态

后台大纲/源卷画像页面最终应变成：

```text
共用准备
1 大纲基线
2 源卷库
3 单卷画像图表
4 连续趋势画像图表
5 当前出题画像图表

科目训练线
6 科目训练候选
7 科目训练正式资产

在线模考线
6 在线模考蓝图
7 在线模考候选
8 草稿卷/正式卷
```

这样用户上传完源卷后，不需要猜系统是否理解正确；图表会直接告诉他：

- 这份卷覆盖了什么。
- 哪些维度缺失。
- 是否足够生成趋势画像。
- 当前 AI 出题依据是什么。
