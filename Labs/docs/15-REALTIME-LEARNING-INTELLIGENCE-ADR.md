# ADR-004：实时学习分析与决策引擎

> 状态：Accepted v1.0  
> 决策日期：2026-09-12  
> 适用范围：学生学习状态、知识点掌握分析、实时推荐、Agent 个性化、自动出题需求输入  
> 依赖文档：[总体架构](../ARCHITECTURE.md) · [自动出题集成](./14-QUESTION-GENERATION-INTEGRATION-ADR.md) · [数据模型](./04-DATA-MODEL.md) · [测试与评测](./08-TEST-EVALUATION-PLAN.md)

## 1. 决策摘要

CSCAPilot 建立独立的 `Learning Intelligence Engine` 和 `Learning Decision Engine`。它们是 Agent 的决策基础，不属于大模型 Prompt，也不由 Agent Runtime 临时推断。

```text
Learning Evidence
答题、提示、解析、用时、复习、模考、错题
        ↓
Learning Intelligence Engine
实时、多维、带置信度的知识点状态
        ↓
Learning Decision Engine
下一最佳学习行动与结构化学习方案
        ↓
Question Supply Engine
已发布题库选题 / 自动出题系统补充供给
        ↓
Practice Session + Agent Coach
        ↓
new evidence and outcome calibration
```

职责边界：

- Learning Intelligence 计算“学生现在处于什么状态”；
- Learning Decision 决定“接下来最值得做什么”；
- Question Supply 提供符合方案的题目；
- 自动出题系统负责受治理的题目生产；
- Agent 负责解释、交互、辅助和执行，不负责凭感觉计算掌握度；
- 大模型不得直接修改掌握度、成绩、错题或推荐策略状态。

## 2. 产品原则

学生不需要每次先想清楚“我要练什么”。系统默认提供可直接开始的方案，学生主要完成题目，并在需要时使用对话、提示、文档或手写分析。

Agent 首页和练习入口优先展示：

- 今天最重要的学习任务；
- 推荐原因和判断置信度；
- 预计时间和题量；
- 一个主要开始按钮；
- 换学科、调时长、调难度、跳过和询问原因等控制。

对话是调整方案和获得辅助的入口，不是唯一入口。系统推荐不等于强制，学生始终可以修改或拒绝建议。

## 3. 现有基础与演进方式

现有系统已经具备：

- `UserCscaTopicMastery`：掌握度、置信度、作答次数和最近练习时间；
- `CscaAdaptiveRoundItem`：正确性、提示、解析和用时；
- `CscaTrainingEvent`：训练行为事件；
- `CscaLearningDailySnapshot` 和备考度六维分析；
- `MasteryEngineService` 和推荐效果校准。

现有模型是有效的 v1 基线，但主要使用固定增减幅度，并在 Round 级聚合更新。它不应被直接删除或原地改造成复杂模型。

演进方案：

```text
current mastery v1 continues serving users
             +
Learning Intelligence v2 shadow projection
             ↓
compare accuracy / stability / recommendation lift
             ↓
enable by subject and cohort
             ↓
retain rollback to v1
```

## 4. 学习证据模型

### 4.1 可信学习事件

以下事件可以成为学习证据：

- 首次提交一道题；
- 修改答案后再次提交；
- 使用分阶段提示；
- 查看完整解析；
- 跳过或超时；
- 完成复习间隔后的再次测试；
- 完成一个练习 Round；
- 提交正式模考；
- 错题复习成功或再次失败；
- 用户确认过的结构化手写作答结果。

页面浏览、按钮悬停、聊天中的自我评价和未经确认的图片推断不能直接作为掌握度证据。

### 4.2 LearningEvidenceEvent

新增不可变的、版本化证据记录：

```ts
type LearningEvidenceEventV1 = {
  schemaVersion: '1';
  eventId: string;
  eventSequence: string;
  userId: number;
  subjectCode: 'math' | 'physics' | 'chemistry';
  occurredAt: string;
  recordedAt: string;
  sourceType: 'adaptive' | 'review' | 'mock_exam' | 'diagnostic' | 'verified_handwriting';
  sourceId: string;
  attemptSequence: number;
  sessionId?: string;
  questionId: string;
  questionVersion: number;
  answerKeyVersion: string;
  topicMappingVersion: string;
  scoringRubricVersion?: string;
  exposureState: 'unexposed' | 'prompt_seen' | 'hint_seen' | 'answer_seen' | 'explanation_seen';
  topicEvidence: Array<{
    topicId: number;
    role: 'primary' | 'secondary';
    weight: number;
  }>;
  outcome: 'correct' | 'incorrect' | 'partial' | 'skipped';
  firstAttempt: boolean;
  usedHint: boolean;
  usedExplanation: boolean;
  timeSpentSeconds?: number;
  difficulty?: string;
  questionQualityConfidence: number;
  metadata?: Record<string, unknown>;
};
```

约束：

- `(sourceType, sourceId, questionId, attemptSequence, schemaVersion)` 或等价业务键唯一；
- `eventSequence` 在 `userId + subjectCode` 范围内单调分配，`subjectCode` 从不可变题目版本或受信任的验证任务解析，客户端不得指定；`occurredAt` 使用服务端认可时间；
- 同一答案重试不得重复更新学习状态；
- 事件只追加，不原地覆盖；纠错使用补偿事件；
- 证据保存题目、答案键、知识点映射、评分 rubric、曝光状态和题目质量版本；
- 原始答案正文、手写图片和敏感内容不复制到普通事件 metadata。

## 5. 知识点多维状态

一个知识点不能只保存单一百分比。`UserCscaTopicStateV2` 至少维护：

| 维度 | 含义 |
| --- | --- |
| `mastery` | 当前理解与正确作答能力估计 |
| `confidence` | 系统对该估计的把握程度 |
| `independence` | 不使用提示或解析时的表现 |
| `difficultyCeiling` | 当前能稳定完成的难度层级 |
| `retention` | 间隔后仍能正确提取和应用的稳定度 |
| `fluency` | 在有效时间内完成的熟练程度 |
| `transfer` | 换题型、表述或情境后的迁移表现 |
| `consistency` | 最近多次表现的稳定程度 |
| `coverage` | 相关题型和能力维度的证据覆盖 |
| `misconceptionState` | 当前可能存在的结构化错误模式 |
| `evidenceCount` | 纳入计算的有效证据数 |
| `lastEvidenceAt` | 最近可靠证据时间 |
| `modelVersion` | 当前计算模型版本 |

对用户展示时同时提供数值、置信度和证据解释，例如：

```text
氧化还原掌握估计：62%
判断置信度：中等
基础题：稳定
中等题：仍不稳定
困难题：证据不足
独立作答：偏弱
主要错误：电子转移方向判断
建议：3 天内再次复习
```

掌握度是估计，不得以无置信度的绝对事实呈现。

## 6. 证据权重

每次答对或答错的影响必须考虑：

- 题目设计难度和经用户数据校准后的经验难度；
- 题目质量置信度；
- 知识点是主标签还是次标签；
- 是否首次作答；
- 是否使用提示或完整解析；
- 作答时间是否有效；
- 是否属于间隔复习；
- 是否更换题型或应用场景；
- 是否存在猜测概率；
- 证据距离当前时间的间隔；
- 是否存在题目召回或评分纠错。

自动生成题的质量置信度越低，对学生状态的影响越小。未通过正式质量门槛、被隔离或被确认有误的题目不得继续产生强证据。

证据防污染规则：

- 首次独立作答权重最高，同题重复尝试使用递减权重和单题贡献上限；
- 查看完整答案、解析或同构例题后的正确只表示“引导后表现”，不作为独立掌握证据；
- 独立验证使用未曝光题，或达到冻结冷却期的等价测量题；
- 用户确认手写 OCR 只确认识别文本，不能确认答案正确；
- 手写结果必须经过可信原题版本、评分 rubric 和关键符号置信度校验才能进入 Evidence；
- `topicEvidence.weight` 必须非负、版本化且总和为 1；
- 异常用时、批量猜测和客户端时间异常进入低置信或排除状态，并保留 reason code。

## 7. 实时语义与一致性

### 7.1 答题级实时

学生提交每一道题时：

```text
validate answer and ownership
  -> transaction: save answer/result
                + append LearningEvidenceEvent
                + append LearningEvidenceOutbox
  -> commit and return evidenceVersion/current projectedStateVersion
  -> projection worker updates UserCscaTopicStateV2 and checkpoint
```

答案、Evidence 和 `LearningEvidenceOutbox` 必须处于同一数据库事务；V2 State 是可重放异步投影，不与答案保存强耦合。答题成功响应携带新的 `evidenceVersion`、当前 `projectedStateVersion` 和 `adaptationPending`。下一题需要新状态时只做有上限等待；超时使用明确版本的旧状态并标记适应仍在更新，不能阻塞答案保存或伪称已应用新状态。

所有 adaptive、review、diagnostic、mock 和经验证的手写答题入口必须复用同一个 Evidence Writer。投影按用户/学科的单调事件序号处理；晚到事件触发从 checkpoint 重放，不能按 Worker 到达顺序覆盖新状态。`AgentOutbox` 只服务 Agent UI/运行事件，不承载学习领域投影。

目标：确定性计算通常在数百毫秒内完成，不调用大模型。

### 7.2 Round 级实时

Round 完成后重新计算：

- 错误模式聚合；
- 难度适应；
- 独立性、迁移和稳定性；
- 下一轮题量和题型；
- 本轮效果与短期复习任务。

目标：1–2 秒内生成新的 Learning Prescription。超时不阻塞成绩保存，前端显示正在更新方案并通过 Artifact 状态恢复。

### 7.3 全局实时

模考提交、考试目标变化、长时间未练习、每日跨日等事件触发：

- 备考度更新；
- 学科优先级变化；
- 遗忘风险；
- 今日计划重排；
- 题库供给预检查。

该投影可以通过可靠队列异步执行，但数据库保存最后成功版本和更新时间。用户进入首页时若状态过旧，先显示旧方案与“正在更新”，不得用空页面阻塞。

## 8. 算法路线

### Phase 1：可解释在线模型

首版使用可解释、可回放的模型：

- Beta/Bayesian 正确率估计；
- 难度和题目质量修正；
- 提示、解析与首次作答权重；
- 时间异常过滤；
- 复习间隔与 retention 模型；
- 置信区间和最小证据门槛；
- 结构化 misconception 规则。

禁止使用无法离线重放和解释的自由文本模型输出直接更新状态。

### Phase 2：题目参数校准

数据充足后，后台使用 IRT/Elo 类方法校准：

- 题目经验难度；
- 区分度；
- 猜测概率；
- 不同题型和知识点的表现差异。

复杂参数在后台批量更新，在线计算读取冻结版本，避免每次答题运行昂贵模型。

### Phase 3：推荐效果优化

根据真实结果评估不同策略：

```text
recommendation shown
  -> accepted / skipped / adjusted
  -> activity completed
  -> later mastery and retention change
```

优化目标是学习提升、完成率和长期保持，不是单纯提高点击率或练习时长。

## 9. Learning Decision Engine

Decision Engine 输入：

- 当前多维知识点状态和置信度；
- 大纲覆盖、版本化目标分数和目标考试日期；
- 当前 `TargetGapSnapshot`、备考轨迹与评分规则版本；
- 最近错题、复习队列和模考表现；
- 当前未完成任务；
- 用户可用时间、语言和明确偏好；
- 高质量题目库存与自动出题供给状态；
- 方案策略版本与安全约束。

输出版本化 `LearningPrescription`：

```ts
type LearningPrescriptionV1 = {
  schemaVersion: '1';
  prescriptionId: string;
  userId: number;
  versions: LearningDecisionVersionVectorV1;
  objective: string;
  reasonCodes: string[];
  reasonSummary: string;
  confidence: 'low' | 'medium' | 'high';
  estimatedMinutes: number;
  tasks: Array<{
    type: 'diagnostic' | 'review' | 'targeted_practice' | 'mock_exam' | 'concept_learning' | 'intervention_verification';
    subject: string;
    topicIds: number[];
    difficulty?: string;
    questionCount?: number;
    interventionVerificationId?: string;
    interventionVerificationPhase?: 'retention' | 'transfer';
    priority: number;
  }>;
  alternatives: Array<{
    label: string;
    adjustment: 'shorter' | 'different_subject' | 'easier' | 'harder' | 'skip';
  }>;
  validUntil: string;
  createdAt: string;
};
```

每项方案必须绑定完整 `LearningDecisionVersionVectorV1`，并可追溯到证据、学习状态、目标、可用时间、评分、校准、预测模型和决策策略版本。大模型可以将理由转成自然语言，但不能改变任务参数或伪造理由。

Decision Engine 不把掌握度提升本身作为最终目标。它在首版用可解释规则优先缩小目标能力差距，后续用独立验证的预计达标能力增益进行校准。分数预测、差距快照和目标版本的完整边界见 [17-TARGET-SCORE-OUTCOME-ADR.md](./17-TARGET-SCORE-OUTCOME-ADR.md)。

## 10. 与自动出题系统的关系

Decision Engine 产生训练需求，Question Supply Engine 决定如何供题：

```text
LearningPrescription task
  -> query published and approved inventory
       -> enough: assemble immediately
       -> insufficient: enqueue inventory generation
       -> explicit bespoke case: request private generation
```

自动出题可以是题目的主要生产来源，但不是学习事实来源。新题必须依赖当前大纲和经过治理的真题画像，并通过 Validator、Reviewer 和质量门槛后才能作为稳定题目供给。

避免自我漂移：

- 大纲、官方样题和已审核真题可以更新事实画像与真题画像；
- 自动生成题的作答数据可以校准题目难度和质量；
- 自动生成题不得反向成为真题风格画像的事实来源；
- 自动生成题不得改变大纲语义；
- 题目来源类型和 lineage 永久区分。

公共题库自动生成属于平台内容生产成本。个性化 AI 提示、手写分析和深度讲解按用户 AI 额度策略计量；实时私人出题未来单独预估和确认。

## 11. Agent 的职责

Agent 使用 Learning Intelligence 与 Prescription 完成：

- 展示今天最重要的任务；
- 解释“为什么推荐”；
- 响应“今天只有十分钟”“换一个学科”等调整；
- 一键创建并打开练习；
- 练习中提供提示、讲解和手写分析；
- 练习后说明变化和下一步；
- 在置信度不足时优先安排诊断，而不是假装了解学生。

Agent 不得：

- 根据聊天内容直接设置掌握度；
- 因用户说“我已经会了”就把掌握度改为 100%；
- 跳过 Practice/Mock 的正式提交链路；
- 把未确认的手写识别结果计入成绩；
- 用模型自由文本覆盖结构化推荐；
- 隐藏低置信度和证据不足。

Learning Intelligence 发现重复 misconception、提示依赖或继续刷题收益过低时，将状态交给独立的 Learning Intervention Engine。该引擎选择继续练习、题后反馈、组间 Micro Lesson 或延迟复习；查看讲解本身不更新掌握度，后续验证结果才形成证据。完整策略见 [16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md](./16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md)。

## 12. 手写答案的证据边界

默认流程：

```text
handwriting upload
  -> OCR / vision analysis
  -> tutoring feedback
  -> verified question in formal practice
  -> submitted answer becomes learning evidence
```

独立手写分析不自动更新掌握度。未来若支持手写作答直接计入状态，必须同时满足：

- 原题及版本可信；
- 学生确认系统识别出的作答内容；
- 评分 Schema 和规则确定；
- 关键符号置信度达到门槛；
- 保存评分和模型版本；
- 低置信度不计入或进入人工确认；
- 可通过补偿事件撤销错误证据。

## 13. 题目纠错与状态重放

题目被确认错误、答案修正或质量下架时：

1. 停止继续分发；
2. 找到受影响的 LearningEvidenceEvent；
3. 写入补偿事件，不能删除原证据；
4. 从最近可信快照重放受影响知识点状态；
5. 修正相关成绩、错题和推荐；
6. 记录变更原因与模型版本；
7. 对影响成绩、掌握度、Forecast 或已展示建议的修正查找受影响用户并发送站内更正说明；
8. 将举报、隔离、审核、补偿、重放和通知关联到同一 `ContentIssueReport` 审计链。

因此必须定期保存可重放的 `UserCscaTopicStateSnapshot`，并使投影计算具备确定性和版本化。

严重举报进入 `report -> triage -> quarantine -> review -> decision -> correction/restore -> replay -> notification` 工作流。人工不能直接修改学生掌握度数字；必须通过题目纠错、补偿 Evidence 或带权限和理由的正式 override 事件执行。

## 14. 数据模型

建议新增逻辑实体：

| 实体 | 用途 |
| --- | --- |
| `LearningEvidenceEvent` | 不可变、可幂等的学习证据 |
| `UserCscaTopicStateV2` | 用户/知识点的多维实时状态投影 |
| `UserCscaTopicStateSnapshot` | 重放起点与模型版本快照 |
| `LearningPrescription` | 某个状态版本下的推荐方案 |
| `LearningPrescriptionOutcome` | 展示、接受、调整、完成及后续提升 |
| `LearningStateProjectionCheckpoint` | 投影 Worker 的处理位置和健康状态 |
| `LearningEvidenceOutbox` | 与答案/Evidence 同事务的学习领域待投递事件 |

现有 `UserCscaTopicMastery` 保持 v1 兼容，不把全部维度塞入一个无结构 JSON。高频排序、过滤和决策使用正式列；扩展诊断和 misconception 向量可以使用版本化 JSON。

## 15. 并发、幂等与恢复

- Answer submission、Evidence append 和 LearningEvidenceOutbox 写入同一事务；状态由 Worker 异步幂等投影；
- `eventId` 和业务唯一键阻止重复点击或网络重试重复学习；
- 每个用户/学科维护单调 `evidenceVersion`，每个知识点状态包含 `version` 并使用乐观并发控制；
- 消费语义为 at-least-once，按事件序号和 checkpoint 幂等处理，不声称 exactly-once；
- 多知识点题目按照冻结的 topic weights 更新；
- 投影 Worker 必须可从 checkpoint 重放；
- 新算法使用新 `modelVersion` 重建 Shadow State，不原地篡改旧结果；
- Recommendation 绑定 `stateVersion`，执行时若状态已明显变化则重新验证；
- Redis 不是学习状态事实来源。

## 16. 质量评估

离线指标：

- 下一题正确率校准；
- Brier Score / calibration error；
- 置信区间覆盖；
- 遗忘预测准确度；
- misconception 识别精度与召回；
- 难度匹配误差；
- 状态重放一致性。

在线指标：

- 推荐接受率与调整率；
- 推荐任务完成率；
- 延迟测试中的保持率；
- 同知识点后续独立正确率；
- 推荐带来的 mastery/retention lift；
- 诊断减少不确定性的效率；
- 不同学科、语言、组织和基础水平的偏差。

上线不能只看点击率。新模型必须在固定回放集上不劣于 v1，并在受控群组中证明学习结果或置信度质量提升。

## 17. 用户透明度与控制

用户可以：

- 查看推荐原因和证据概览；
- 查看哪些维度证据不足；
- 调整时间、学科和难度；
- 跳过或关闭某类推荐；
- 举报错误题目或不合理判断；
- 查看、修改明确偏好；
- 删除可删除的学习数据和 Agent 会话。

界面不得使用虚假精确度。低样本时显示“正在了解你的水平”或区间，而不是确定的百分比。

## 18. 实施顺序

### L0：事件契约和基准

- 冻结 Evidence、State、Prescription Schema；
- 建立现有 v1 输出和历史回放基线；
- 定义证据质量、置信度和状态版本规则。

### L1：V2 Shadow State

- 写入不可变 Evidence；
- 同步计算 V2 状态但不影响用户；
- 建立重放、对账和模型版本工具；
- 比较 v1/v2 的校准、稳定性和延迟。

### L2：只读展示

- 内部账号展示 V2 多维状态与原因；
- Agent 可以读取但不能据此自动创建不同训练；
- 收集异常、低置信度和人工反馈。

### L3：推荐灰度

- 单学科、单群组启用 V2 Prescription；
- 保留 v1 回退；
- 测量完成率、后续独立正确率与 retention lift。

### L4：实时自适应

- 每题提交后使用新 state 选择下一题；
- Round 后立即更新下一方案；
- 接入预测性题库补充和自动出题供给；
- 逐学科扩大并持续校准。

## 19. 生产门槛

- 重复请求不会重复更新掌握度；
- 答案保存成功后不会永久缺少对应 Evidence；
- 同一 Evidence 在同一 modelVersion 下重放结果一致；
- 错误题目可以通过补偿事件撤销影响；
- 题目质量低时证据影响被正确降低；
- 下一题不会读取比答题响应声明更旧的 stateVersion；
- 低证据不会显示虚假精确度；
- Shadow Mode、按学科灰度和 v1 回滚均已演练；
- Agent、大模型和手写分析无法绕过正式学习证据链；
- 计算延迟、队列积压、投影延迟和模型版本分布可观测。
