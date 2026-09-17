# PR8E：稳定掌握驱动的学习决策闭环

## 1. 目标

PR8D 已能可靠回答一次教学干预在即时、保持和迁移三个阶段是否成立。PR8E 将这些事实接入 Learning Decision，而不是只在 Agent 文案里展示：

```text
Learning Evidence + V2 Topic State
              +
Intervention Stability Assessment + staged verification clock
              ↓
deterministic TargetGapSnapshot
              ↓
deterministic LearningPrescription
              ↓
Web Agent / Plugin 读取同一份结构化结果并解释
```

决策策略版本升级为 `ls-v1-prescription-rules-2`。大模型不参与排序、阈值、任务选择或验证判定。

## 2. 决策语义

| 可信输入 | 决策行为 | 不允许的行为 |
| --- | --- | --- |
| `stable` | 抑制同知识点重复 mastery、retention、transfer 任务，允许进入难度、熟练度或其他知识点 | 直接篡改掌握度或宣称永久掌握 |
| `not_stable / immediate` | 优先再讲解和错因纠正 | 继续无差别堆题 |
| `not_stable / retention` | 优先复习巩固 | 把即时做对当长期保持 |
| `not_stable / transfer` | 优先跨结构针对练习 | 用单纯提难替代迁移 |
| `inconclusive` | 非题源原因安排补充诊断；题源缺口保留为审计事实并继续正常学习 | 估高掌握或同步调用自动出题补齐 |
| future verification | 只进入版本上下文，不阻塞今天正常学习 | 提前曝光验证题 |
| due verification | 提升为首选 `intervention_verification` | 走普通练习库存检查或通用练习链接 |
| expired verification | 不再生成可执行任务，但时间状态进入版本上下文 | 继续展示已失效入口 |

`stable` 只抑制它已经证明的 mastery、retention 和 transfer 维度。若独立性、难度上限或熟练度仍不足，系统可以继续推荐相应任务，避免把“这次干预稳定”扩大解释为“该知识点所有能力均已达标”。

## 3. 新旧证据与冲突规则

每个知识点只采用 `effectiveAt` 最新的最终稳定性结论；时间相同时按 assessment ID 稳定排序。新旧证据不比较数据库写入时间，而比较状态的 Evidence sequence 水位与 assessment 所引用证据的最大 sequence；若 Topic State 已包含更晚证据，旧结论不再抑制新状态产生的 Gap。这避免“验证先结算、证据稍后投影”时把刚完成的结论误判为过期。若被结论引用的证据不存在、越权不可见或已撤回，该结论及其后续到期验证均不进入决策。

同一知识点若因历史链路存在多个已到期验证，只选择 `dueAt` 最早的一项，避免学生同时收到重复验证。跨知识点排序依次考虑：

1. 验证是否已到期；
2. 逾期时长；
3. 目标中的科目优先级；
4. 知识点 ID 与验证 ID。

因此同一冻结时间和同一数据库事实可确定性重放。新 Evidence 尚未投影完成时，沿用原有 `status: updating` 防线，不发布混合新旧状态的方案。

## 4. 版本与快照

`decisionContextVersion` 冻结：

- assessment ID、delivery ID、状态、结果、策略版本、更新时间和阶段结果；
- assessment 引用证据的 sequence 与撤回状态；
- 每项 staged verification 的阶段、状态、到期和失效时间；
- 相对于本次 `generatedAt` 的 `future / due / expired` 状态。

这使验证时钟跨过到期点时，即使数据库行没有写入，仍会产生新的 `versionHash`、Target Gap 和 Prescription。Prescription task 可携带：

```ts
{
  type: 'intervention_verification';
  interventionVerificationId: string;
  interventionVerificationPhase: 'retention' | 'transfer';
}
```

Gap、Prescription 和 `LearningDecisionCurrent` 仍通过相同版本向量、不可变快照和 CAS 指针成对发布。

## 5. Agent 与执行边界

网页 Agent、Codex 插件和未来 ChatGPT 插件只读取同一个 `get_learning_prescription`。到期验证由既有验证服务物化并在 Agent 方案下显示专用卡片，因此主方案 Artifact：

- `canStart = true`，表示该决策可执行；
- 不调用 `get_question_supply_status`；
- 不生成普通学科练习 route；
- 文案明确说明先完成独立的保持或迁移验证，再更新方案。

验证选题、曝光预留、正式模考互斥、幂等启动和结果结算继续由 PR8C/PR8D 的服务负责，Agent 不复制业务规则。

## 6. 自动出题和模型隔离

本阶段没有任何自动出题或大模型调用。到期验证只使用已审核、未曝光且满足阶段约束的库存；题源不足产生 `inconclusive` 和题源缺口事实，供后台内容生产系统异步处理。Decision Engine 不直接请求生成器，LLM 只可翻译或解释已冻结的 reason codes。

## 7. 验收

- stable、not_stable、inconclusive 三类结论进入确定性规则；
- 旧结论不会覆盖更新的 Topic State；
- 已撤回或缺失的引用证据不会继续支撑稳定结论和后续验证；
- future 不阻塞、due 提升、expired 不执行，跨时间点版本改变；
- 多链同知识点去重并稳定选择最早到期验证；
- Verification ID 和 phase 从 Gap 传递至 Prescription；
- 所有 assessment 查询按 `userId` 和目标科目约束；
- 相同输入幂等重放，输入变化推进 CAS revision；
- Agent 不把验证误路由到普通练习，也不查询普通题库供给；
- 既有 Learning Decision、Agent Runtime、干预稳定性和安全测试回归；
- 前后端生产构建通过。
