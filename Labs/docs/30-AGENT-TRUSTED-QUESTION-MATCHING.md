# Agent 可信题源与答案键验证（PR7D）

## 决策

PR7D 在 PR7C 的“附件分析 → 学生确认 → 学习证据”之间增加只读可信题源匹配层。目标不是让模型自行判断得更大胆，而是尽可能把上传内容定位到站内已经治理的题目，再使用版本化答案键做确定性比较。

优先级如下：

1. 已审核或通过现有自动门禁的 `CscaSourceQuestion`：来自 active 真题/参考题导入库，必须有题干、答案键和已发布知识点；人工 approved 为最高题源治理等级，auto_approved 为次级治理等级；
2. 状态为 `approved` 的 `CscaQuestion`：必须关联仍在发布的知识点；
3. 未达到可信匹配门槛：回退 PR7C 的学生确认 AI 判断，保持低权重；
4. 题干、答案或来源存在歧义：不使用答案键，绝不猜测。

匹配服务属于 Agent 域，只查询上述只读表。它不导入 `ai-questioning` 服务、不创建生成任务、不改变题目状态，也不发布题目。

## 分析输出协议

附件模型输出在原有字段外增加：

- `questionText`：只包含用于匹配的题干；
- `studentAnswer`：只包含学生最终答案，例如选项 ID、表达式或数值；
- `questionNumber`：若页面可见则提取，否则为空。

模型仍不提供可信答案键。答案键只允许从站内治理表读取。

## 匹配算法与门控

Matcher 版本：`agent-question-match-v1`。

1. 对题干做 Unicode NFKC、空白和标点归一化，但保留数学/物理/化学表达式符号；
2. 计算字符三元组 Dice 相似度与长文本包含率，取较高值；
3. 第一名分数必须 `>= 0.82`；
4. 第一名与第二名差值必须 `>= 0.06`；
5. 学生答案必须能确定性映射到答案键，支持选项 ID、选项文本和简短直接答案；
6. 题源必须满足审核、知识点和文档状态门控。

状态如下：

```text
insufficient_prompt | no_match | ambiguous | answer_missing | verified_answer
```

只有 `verified_answer` 能提升证据验证等级。其余状态全部回退，不会以最相似候选冒充命中。

为控制数据库负载，每个科目最多加载两类题源各 2500 条，并在进程内缓存 5 分钟。后续题库规模超过该范围时，应迁移到离线指纹索引或 PostgreSQL pg_trgm/向量召回加精排；门控协议保持不变。

## 审计与隐私

迁移 `0078_agent_trusted_question_matching` 新增 `agent_attachment_question_matches`，保存：

- 用户与分析任务；
- 状态、来源类型/ID/版本/标题；
- 科目和知识点；
- 第一名分数、第二名分数和门槛快照；
- 提取题干哈希、学生答案；
- 答案键哈希，不保存答案键明文副本；
- 验证结果和 matcher 版本；
- top-3 候选的无答案审计快照。

浏览器只看到匹配来源、置信度和验证结果，不获得内部候选答案键。

## 证据语义

匹配成功后仍要求学生确认识别内容。确认生成的 Evidence：

- `sourceType = verified_handwriting`：说明证据采集自学生上传；
- `questionId = csca_source_question:<id>` 或 `csca_question:<id>`；
- `questionVersion` 使用可信题源版本；
- `answerKeyVersion = trusted:<type>:<id>:v<version>:<answer-hash-prefix>`；
- `topicMappingVersion = trusted-source-topic-v1`；
- outcome 来自答案键确定性比较，不采信模型 assessment；
- `questionQualityConfidence` 为 `0.75–0.95`，由题干匹配分数与题源治理等级共同决定；auto_approved 上限为 0.88；
- verification tier 为 `trusted_answer_key`。

无法匹配时沿用 PR7C：`student_confirmed_ai_assessment`、置信度不超过 0.6，并明确 `not_an_official_answer_key`。

## 前端

证据确认卡会展示：

- “已匹配可信题源 · 答案键验证 · 可撤销”；
- 题源标题；
- 题干匹配置信度；
- 可信来源绑定的知识点（禁用手工改成其他知识点）；
- 确认、拒绝和确认后的撤销操作。

## 配置和验收

独立开关：

```text
CSCA_AGENT_TRUSTED_QUESTION_MATCH_ENABLED=true
```

本地 `start-cscalite-dev.bat` 已启用。关闭时不会创建匹配记录，PR7C 路径仍可独立工作。

验收覆盖：

- 精确题干与轻微 OCR 差异命中；
- 无关题目不命中；
- 第一、第二候选过近时判为 ambiguous；
- 缺失学生答案时不使用答案键；
- 选项 ID/文本确定性比较；
- 题源查询只读取 approved/published 数据；
- 匹配记录不复制答案键明文；
- 可信题源强制绑定知识点；
- Evidence 使用可信 question/answer/topic 版本；
- 未命中时保留 PR7C 的低权重路径；
- 自动出题调用标记始终为 false。

## 后续阶段

PR7E 建议聚焦“区域级 OCR 与多题拆分”：一张图片或一页 PDF 可能含多道题，应形成多个 question regions、各自题干/答案/页码/坐标和匹配状态，再允许学生逐条确认。该阶段仍只扩展附件理解和证据输入，不进入自动出题生产域。
