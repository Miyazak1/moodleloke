# ADR-006：目标分数、备考度与学习结果框架

> 状态：Accepted v1.0  
> 更新时间：2026-09-12  
> 依赖：[实时学习智能](./15-REALTIME-LEARNING-INTELLIGENCE-ADR.md)、[自适应教学干预](./16-ADAPTIVE-LEARNING-INTERVENTION-ADR.md)、[自动出题集成](./14-QUESTION-GENERATION-INTEGRATION-ADR.md)

## 1. 决策摘要

CSCAPilot Agent 的北极星不是对话量、刷题量或内部掌握度分数，而是：

> 帮助学生在目标考试日期前，建立达到其 CSCA 理想分数所需且可验证的能力。

系统围绕学生目标分数持续完成四件事：

1. 估计当前能力与目标之间的差距；
2. 选择单位学习时间内最可能缩小关键差距的下一步；
3. 通过练习、讲解、复习和模考形成新证据；
4. 用独立证据重新校准达标概率和学习方案。

系统提供的是有证据、有置信区间的备考判断，不承诺学生必然取得某个分数。大模型负责解释、交互和受控生成，不负责凭感觉计算成绩预测。

## 2. 为什么不能只看掌握度

知识点掌握是达标能力的重要组成，但不能直接等同于考试成绩。目标分数判断还必须考虑：

- 大纲覆盖是否完整；
- 学生能独立完成的最高难度；
- 速度、稳定性、迁移能力和长期保持；
- 正式计时条件下的表现；
- 不同题型和知识点在考试中的权重；
- 距离考试的时间和可投入学习时间；
- 当前证据数量、质量与新鲜度。

因此 `UserCscaTopicStateV2` 是能力状态，不是分数预测；分数预测由独立的 Score Readiness & Gap Engine 生成。

## 3. 端到端闭环

```text
StudentScoreGoal + ExamScoringPolicy
                 +
UserCscaTopicStateV2 + syllabus coverage
                 +
calibrated items + held-out mock performance
                 +
exam date + available study time
                 |
                 v
        Score Readiness & Gap Engine
                 |
                 v
          TargetGapSnapshot
       /         |          \
diagnostic   practice    intervention/mock
       \         |          /
                 v
        LearningEvidenceEvent
                 |
                 v
       state and forecast recalibration
```

实时更新学习事实，但不让界面上的达标概率每答一题就抖动。题级证据立即入账；Round 结束、模考提交、显著状态变化或计划重算时发布新的可见预测。

## 4. 目标定义

新增版本化 `StudentScoreGoal` 父记录与 `StudentScoreGoalSubject` 子记录，不把目标分数塞进 `StudentProfile.metadata`。每个父目标至少包含：

- 学生、考试体系、稳定的考试批次代码和考试日期；
- 一个或多个 `StudentScoreGoalSubject`，每条保存科目目标分数和优先级；
- 可选总体目标；总体目标必须能由有效评分规则确定性拆解；
- 科目优先级和对当前 `StudyAvailabilityPreference` 版本的引用；
- 生效时间、替代关系和修改来源；
- 创建时采用的 `ExamScoringPolicy` 版本。

目标分数属于学生意图，不是能力事实。修改目标不会改写历史状态或预测；它会关闭旧目标、创建新版本并重新计算差距。

同一用户、考试体系和考试批次最多一个活动父目标，通过条件唯一索引保证；同一父目标内每个科目最多一条子记录，通过 `(goalId, subjectCode)` 唯一约束保证。总体目标与科目目标冲突时以创建该版本时确认的 `ExamScoringPolicy` 拆解；无法拆解时要求学生选择，不静默覆盖。

如果官方考试没有可验证的总分合成规则，产品只展示科目目标，不自行发明综合分。评分范围、科目权重、及格定义和规则来源全部由版本化 `ExamScoringPolicy` 配置，禁止硬编码在前端或 Prompt 中。评分规则按 `draft -> reviewed -> active -> superseded/withdrawn` 治理，记录官方来源快照、有效期、审核人和变更原因；只有 `active` 版本可以生成学生可见 Forecast。

## 5. 输出模型

### 5.1 ScoreReadinessForecast

```ts
type ScoreReadinessForecastV1 = {
  schemaVersion: '1';
  forecastId: string;
  goalId: string;
  userId: number;
  subjectCode: string;
  targetScore: number;
  readinessState: 'insufficient' | 'measuring' | 'on_track' | 'at_risk';
  versions: LearningDecisionVersionVectorV1;
  expectedScoreBand: { low: number; central: number; high: number } | null;
  targetAttainmentProbability: number | null;
  confidence: 'insufficient' | 'low' | 'medium' | 'high';
  evidenceCutoffAt: string;
  reasonCodes: string[];
  nextValidationAction?: 'diagnostic' | 'mock_exam' | 'continue_learning';
  createdAt: string;
};
```

证据不足、评分规则无效或量尺尚未校准时，`expectedScoreBand` 和 `targetAttainmentProbability` 必须为 `null`，系统改为展示“尚需诊断”，不能输出伪精确数字。

PR9A 仅上线 `score-readiness-shadow-gate-v1`：它按科目持久化不可变 Forecast，验证决策版本、证据覆盖、近期模考与待验证干预，但尚未启用正式量尺。因而当前只允许 `readinessState: insufficient | measuring`、`confidence: insufficient`，数值区间和概率必须为 `null`。`on_track`、`at_risk` 以及任何数值预测必须等正式 `ExamScoringPolicy`、题目校准和回测门槛通过后再开放。

PR9B 已将评分政策、题目校准和 Forecast 校准做成独立、可审计且受数据库约束的治理记录，并将其精确版本匹配接入 Readiness 的不可变版本哈希。通过治理仅得到 `shadow_qualified`，学生数值预测仍由独立发布门禁强制关闭。详见 [39-SCORE-CALIBRATION-GOVERNANCE.md](./39-SCORE-CALIBRATION-GOVERNANCE.md)。

PR9C 已增加确定性离线校准引擎与管理员治理闭环：测量证据必须通过曝光和保留集隔离，指标按固定版本策略计算，创建者不能审核自己的工件，所有状态迁移保留追加式审计事件。详见 [40-SCORE-CALIBRATION-PIPELINE.md](./40-SCORE-CALIBRATION-PIPELINE.md)。

### 5.2 TargetGapSnapshot

差距快照按“影响目标的瓶颈”组织，而不是简单列最低掌握度：

- `coverageGap`：尚未获得可靠证据的大纲范围；
- `masteryGap`：关键知识点正确性不足；
- `difficultyGap`：目标难度下尚不能稳定独立作答；
- `retentionGap`：短期会做但长期保持不足；
- `fluencyGap`：正确但速度不足；
- `transferGap`：换表述或综合题表现下降；
- `examExecutionGap`：计时、节奏和整卷稳定性不足；
- `evidenceGap`：样本不足，无法可靠判断。

每项 Gap 保存严重度、置信度、预计分数影响范围、证据引用和建议验证动作。

### 5.3 LearningTrajectory

学习轨迹记录目标日期前的里程碑：覆盖率、能力区间、模考区间、周学习容量和是否偏离计划。它用于回答：

- 目前更可能处于达标、临界还是高风险状态；
- 按当前节奏是否来得及；
- 哪个能力瓶颈最值得优先处理；
- 每天增加或减少学习时间会怎样影响计划。

轨迹是决策支持，不是结果保证。

## 6. 预测与校准技术路线

### Phase 1：规则化、可解释的 Readiness

- 使用大纲覆盖、V2 状态、题目难度、提示依赖、速度和计时模考构成可解释评分；
- 用已审核题和保留诊断集作为锚点；
- 输出宽区间和低/中/高置信度，不追求漂亮的单点分数；
- 缺少有效模考时只报告能力差距，不报告达标概率。

### Phase 2：统计校准

- 使用题目参数校准、同量尺模考和分层历史结果拟合预测；
- 比较逻辑回归、IRT/能力量尺和校准曲线，选择可解释且稳定的方案；
- 按学科、语言、考试版本和证据规模验证偏差；
- 预测模型版本和评分策略版本必须随每个 Forecast 保存。

### Phase 3：结果优化

- 学习决策从“提升掌握度”升级为“在约束下最大化预计达标能力增益”；
- 优化信号使用独立验证和延迟保持，而不是即时正确率；
- 通过离线策略评估和受控实验验证方案，不允许在线模型无门槛自我强化。

LLM 不参与底层数值计算。它只能把结构化 Forecast、Gap 和 Prescription 转成学生能理解的说明。

## 7. 与自动出题和真题的关系

自动出题系统是训练供给的主要来源，但不能成为唯一的测量标尺：

- 训练题可大量来自已验证的自动出题库存；
- 分数预测必须锚定版本化大纲、官方来源、已审核真题画像和保留评测集；
- 生成题必须带来源 lineage、质量分和校准状态；
- 未校准或低质量生成题只提供低权重学习证据；
- 用于日常训练的题不得同时作为无偏验证题；
- 保留诊断题和模考题不得被个性化推荐提前泄露。

这避免“大纲画像生成题—学生做生成题—生成题证明画像正确”的自证闭环。

测量隔离必须由数据和权限强制，而不只依赖推荐 Prompt：题目版本设置 `TRAINING/DIAGNOSTIC/CALIBRATION/MOCK/RETIRED` 唯一角色，并保存用户级 `AssessmentItemExposure`。看过答案、解析或讲解的题不再作为该用户的独立验证题；生成题默认只能进入训练池，进入测量池需独立教研审批和校准。保留池不能被 Agent 或普通推荐枚举，泄露或错误题转为 `RETIRED` 并触发状态重放。

## 8. Learning Decision Engine 的优化目标

Decision Engine 对候选任务计算：

```text
utility = expected_target_gap_reduction
        * evidence_confidence
        * completion_probability
        / estimated_minutes
        - fatigue_cost
        - interruption_cost
        - coverage_risk
```

实际实现从可解释规则开始，不要求首版直接训练强化学习模型。硬约束包括：

- 不因某个高收益薄弱点长期忽略大纲覆盖；
- 不连续堆叠高疲劳任务；
- 临近考试增加计时和整卷验证，但不临时反复改变策略；
- 低置信度先安排诊断；
- 同一错误反复出现时可从继续刷题切换为教学干预；
- 学生可调整时间和节奏，但系统明确说明对轨迹的影响。

## 9. Agent 与产品体验

Agent 默认把复杂分析转成一个清晰行动，而不是要求学生自己设计训练：

> “为了你的化学目标，今天先完成这组 12 分钟练习。它处理当前最影响成绩的两个薄弱点；做完后我会更新下一步。”

界面至少展示：

- 当前目标和考试日期；
- 预测区间或“证据不足”；
- 达标状态与置信度；
- 最大的 1–3 个差距；
- 今天的首选任务、预计时间和推荐理由；
- 最近一次重要变化及其证据；
- “如果每天多学 15 分钟”等只读计划模拟。

禁止使用“保证上岸”“一定达到”等措辞。概率下降时说明证据和可行动下一步，避免制造焦虑。学生可以修改或暂停目标，并查看系统使用了哪些数据。

## 10. Capability 契约

首版提供：

- `get_score_goal`：读取当前目标；
- `update_score_goal`：修改目标，属于 L2 确认操作；
- `get_score_readiness`：读取预测区间、概率、置信度与证据截止时间；
- `get_target_gap`：读取关键能力差距；
- `get_learning_prescription`：读取当前首选方案及替代项；
- `simulate_plan_adjustment`：只读模拟时间、日期或节奏变化，不修改正式计划。

所有返回必须包含 schema、状态、策略和模型版本。`update_score_goal` 在确认前展示旧值、新值以及对当前计划的影响。

## 11. 数据模型

新增领域实体：

- `StudentScoreGoal`：考试体系、批次、日期、总体目标、版本和活动状态；
- `StudentScoreGoalSubject`：父目标下每科目标分与优先级；
- `StudyAvailabilityPreference`：时区、每周分钟目标、偏好学习日和默认单次时长；
- `PlanCapacitySnapshot`：目标日期前的可用学习容量；
- `ExamScoringPolicy`：评分范围、科目映射、来源和有效期；
- `AssessmentItemExposure`：用户是否接触过题干、答案、解析或讲解；
- `ScoreReadinessForecast`：不可变预测快照；
- `TargetGapSnapshot`：不可变差距快照；
- `LearningTrajectorySnapshot`：阶段里程碑和进度；
- `ForecastCalibrationSnapshot`：模型校准质量；
- `StudentExamOutcome`：学生自愿提供的真实结果，单独同意、可撤回、不得作为功能前提。

不要把以上对象放进 Agent Conversation 或 Artifact 作为唯一事实；Agent 只引用领域对象。

## 12. 一致性与刷新

- 题级 Evidence 与学习状态按实时学习 ADR 的事务/Outbox 规则更新；
- 普通练习在 Round 结束后重算可见 Forecast；
- 模考提交、目标修改、评分规则更新和题目召回触发强制重算；
- Forecast、Gap 和 Prescription 快照以 `userId + goalId + hash(LearningDecisionVersionVectorV1)` 幂等，任何组成版本变化都不能与旧快照冲突；
- 新 Forecast 发布后再生成对应 Gap 和 Prescription；
- 发布当前快照使用 compare-and-set；旧版本任务迟到完成时不能覆盖新状态；
- 如果重算失败，继续展示上一次快照，但必须标出更新时间和 stale 状态；
- 题目纠错或证据撤销后从可信 checkpoint 重放。

## 13. 成功指标

北极星结果指标：

- 独立保留题与计时模考的能力提升；
- 目标能力差距随时间缩小；
- 预测区间覆盖率与达标概率校准度；
- 有真实成绩且自愿回传用户的目标达成率；
- 延迟复测中的长期保持。

过程指标只用于诊断，不作为最终成功：练习量、对话量、连续登录、讲解打开率、即时正确率和学习时长。

必须监控：

- 分数区间 MAE/覆盖率和概率校准误差；
- 高置信错误预测率；
- 不同学科、语言、地区、年级和组织之间的系统性偏差；
- 推荐方案相对基线的独立测验增益；
- 目标修改、放弃和过度学习信号。

## 14. 冷启动与异常场景

- 新用户：先读取目标与时间约束，再安排短诊断，不展示伪预测；
- 目标过高或时间不足：展示风险、差距和不同投入方案，不替学生擅自降低目标；
- 多科目标冲突：按考试规则、当前差距和可用时间给出组合计划；
- 长期未练习：提高 retention 不确定性，先做短复测；
- 只做熟悉题：限制信心增长并补充迁移/综合题；
- 数据突然异常：冻结高影响推荐，回退到安全学习计划并告警。

## 15. 上线门槛

在对学生展示目标分数预测前，必须满足：

1. 存在有效且可追溯的 `ExamScoringPolicy`；
2. 有独立于日常训练的校准/验证题；
3. 证据不足时能稳定返回 `insufficient`；
4. Forecast、Gap 和 Prescription 可重放并完整带版本；
5. 题目召回、评分规则更新和目标修改可正确重算；
6. 高置信预测通过离线校准门槛和分群偏差审查；
7. 文案不承诺成绩，学生能理解预测区间与置信度；
8. Feature Flag、按学科灰度和一键回退已验证；
9. LLM 不可直接写入分数、概率、掌握度或考试结果；
10. 真实考试结果采集具有独立同意、删除和用途限制。

## 16. 已冻结决策

- “达到理想分数所需的能力”是产品北极星；
- 目标、能力状态、分数预测和学习方案是四类不同对象；
- 预测输出区间、概率和置信度，不作成绩保证；
- 大纲与受治理的考试证据是测量锚点，自动生成题是主要训练供给；
- 学生默认执行系统推荐任务，不需要自己设计练习；
- 学习效果必须由独立作答、计时表现和长期保持验证；
- 大模型只解释和交互，底层状态、预测和决策由确定性服务产生。
