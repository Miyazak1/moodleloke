# LS-V1 Target Gap 与 Learning Prescription 实施记录

> 状态：PR 4 implemented, shadow only
>
> 更新时间：2026-09-13
>
> 依赖：[实时学习智能 ADR](./15-REALTIME-LEARNING-INTELLIGENCE-ADR.md) · [目标分数与学习结果 ADR](./17-TARGET-SCORE-OUTCOME-ADR.md) · [首条垂直切片](./18-FIRST-VERTICAL-SLICE.md)

## 1. 本次落地范围

PR4 在 V2 Shadow State 之上增加确定性的 Learning Decision 层：

```text
active StudentScoreGoal
+ active StudyAvailabilityPreference
+ V2 topic states / projection checkpoints
+ applied syllabus topics
+ due review queue
+ recent submitted mock exams
        ↓
versioned decision input
        ↓
TargetGapSnapshot (immutable)
        ↓
LearningPrescription (immutable)
        ↓
LearningDecisionCurrent (CAS publication pointer)
```

读取 `get_target_gap` 或 `get_learning_prescription` 时按当前数据库事实重算；相同完整版本向量复用同一快照，不重复创建。该层不调用 LLM、不调用自动出题，也不改变现有推荐、训练或学生页面。

## 2. 版本和一致性

冻结版本：

- 学习状态模型：`ls-v1-shadow-model-1`
- 决策策略：`ls-v1-prescription-rules-2`
- 题目校准：`not-enabled`
- 分数预测：`score-readiness-shadow-gate-v1`

Gap 与 Prescription 使用同一 `LearningDecisionVersionVectorV1` 和同一 SHA-256 `versionHash`。除 Goal、Availability、Evidence、State、Syllabus、Scoring、Calibration、Policy 和 Forecast 版本外，本次补充 `decisionContextVersion`，用于冻结：

- 当前计划日期；
- 已到期复习项；
- 最近 30 天正式模考；
- 干预稳定性结论以及保持/迁移验证的 future、due、expired 时间状态。

这是必要的架构补洞：上述输入会随时间变化，但原版本向量没有表达它们；缺少该版本会导致同一幂等键对应不同方案。

生成快照后，服务在同一事务中再次读取版本输入。若期间学习状态或上下文发生变化，事务回滚并重试。`LearningDecisionCurrent` 通过 revision compare-and-set 发布成对的 Gap 与 Prescription，迟到任务不能覆盖新版本；重复读取同一版本不会推进 revision。

大纲版本不仅保存标签，还包含当前已发布知识点 ID 与更新时间的指纹，防止同名大纲内容变化复用旧快照。若最新 Evidence sequence 已超过 Shadow Projection checkpoint，读取能力返回 `status: updating`，不会基于落后的 State 发布新方案。

## 3. Shadow Gap 规则

首版输出以下差距：

| Gap | 首版判定 | 默认动作 |
| --- | --- | --- |
| `coverage` | 当前大纲知识点缺少证据 | `diagnostic` |
| `evidence` | 样本少于 3 或置信度低 | `diagnostic` |
| `mastery` | 可解释基线下表现不足 | `targeted_practice` |
| `difficulty` | 独立性不足或难度上限未知 | `targeted_practice` |
| `retention` | 已到复习时间或保持度不足 | `review` |
| `fluency` | 有效时间内熟练度不足 | `targeted_practice` |
| `transfer` | 换情境表现证据不足 | `targeted_practice` |
| `exam_execution` | 临近考试且缺少近期正式模考 | `mock_exam` |

同一知识点重复错误时，首选动作从继续堆题切换为 `concept_learning`。排序同时考虑严重度、证据置信度、科目优先级、复习到期和重复 misconception。

当前没有经过正式校准的成绩映射，因此每项 Gap 的 `estimatedScoreImpact` 明确为 `null`。`score-readiness-shadow-gate-v1` 只记录按科目的测量状态、缺失证据、下一验证动作和完整版本向量；预计分数区间与达标概率仍固定为 `null`。系统不会把规则阈值伪装成预计分数或达标概率。

## 4. Prescription 规则

- 每次只生成一个首选任务；
- 默认使用长期可用时间，限制在 10–30 分钟；
- 诊断、复习、针对性练习、模考和知识讲解均来自结构化 Gap；
- 提供“更短”和“换学科”两个替代方向；
- 24 小时有效，下一计划日期形成新的 context version；
- LLM 后续只能本地化和解释，不得改变任务参数或 reason code。

题目库存仍由现有 `get_question_supply_status` 和练习创建服务在执行前重新验证。库存不足不得在请求链路静默调用自动出题；后台补库编排仍属于后续 Question Supply PR。

PR8E 把受治理的干预稳定性纳入同一确定性决策层：`stable` 抑制同一知识点的重复 mastery、retention 和 transfer 任务；`not_stable` 按失败阶段切换到再讲解、复习或迁移巩固；非题源原因的 `inconclusive` 安排补充诊断；题源不足的不确定结论保留在审计事实中，但不触发徒劳的即时补题。保持或迁移验证只有到期后才提升为首选 `intervention_verification`，未来任务不阻塞当天学习。

同一知识点存在多条干预链时只选择最早到期的一项，已逾期时长、科目优先级、知识点和验证 ID 构成稳定排序。最终稳定性结论以引用证据的最大 Event sequence 和 Topic State 的 sequence 水位判断新旧；若状态已包含更晚证据则结论失效，避免旧结论覆盖新证据。引用证据缺失或已撤回时，结论及后续验证均不进入决策。

## 5. Capability 与权限

新增可调用读取能力：

- `get_target_gap`
- `get_learning_prescription`

两者沿用 `learning.read`、L0、零 AI 费用和统一 Web/Plugin 契约。所有 Goal、Availability、State、Evidence、Review 和 Mock 查询都在数据库条件中限制 `actorUserId`。Agent 不能写 Gap、Prescription 或当前发布指针。

依赖开关：

```text
foundation
  -> shadowProjection
       -> targetGap
            -> prescription
```

所有开关默认关闭。只打开子开关不会绕过父级依赖。

## 6. 验证

```bash
cd backend
npm run test:learning-decision-shadow
```

测试覆盖：

- 冷启动证据不足时优先诊断；
- 重复 misconception 时切换知识讲解；
- 到期复习优先；
- 不输出未经校准的分数影响；
- 同输入确定性重放和快照幂等；
- 新 Evidence/State 版本生成新快照；
- CAS 指针只在版本变化时前进；
- 当前用户数据库隔离；
- 两个 Capability 的契约输出。

## 7. 后续边界

PR5 才接 Agent Runtime、today-plan 编排、SSE、方案 Artifact 和练习深链。创建练习前必须重新验证 Prescription 版本、用户权限、题目库存和测量角色。PR4 不实现 Score Readiness、Session Constraint 模拟、自动补库任务、教学干预执行或学生可见页面。
