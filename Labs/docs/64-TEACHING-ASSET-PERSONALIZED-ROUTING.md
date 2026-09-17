# TeachingAsset 个性化路由（PR12H）

## 1. 目标

同一知识点可以存在多个已审核、已发布的教学资产。PR12H 不再按更新时间机械选择第一条，而是根据当前学生的真实学习历史、干预计划和资源的独立验证效果，确定性地选择更合适的内容。

该路由解决四个问题：

1. 学生已经对某个讲解失败或表现为不稳定时，优先换一种讲法；
2. `brief / guided / full` 教学深度与资源预计时长匹配；
3. 有充分样本的有效资源作为稳定默认项；
4. 新资源只在受控窗口内探索，不能无上限抢占成熟资源。

## 2. 冻结边界

- 路由由服务端规则策略执行，大模型不选择教学资产；
- 只读取最近 90 天的曝光、完成、跳过、独立验证和稳定性证据；
- 学生完成微课不直接改变掌握度，仍须经过新题的独立验证；
- 只选择状态为 `published`、知识点为 `published`、语言匹配且通过安全 Payload Schema 的版本；
- 选择结果不暴露正确答案，只保留稳定键、版本、分数和原因码；
- 自动出题没有被调用，题源生产系统继续与 Agent 隔离。

## 3. 路由流程

```text
教学需求（topic / subject / language / depth）
  -> 发布状态、语言、知识点、渲染安全门
  -> 汇总当前学生历史与全局效果先验
  -> 标记已失败、不稳定或跳过的候选
  -> 若存在替代项，排除上述重复内容
  -> 确定性评分与稳定排序
  -> TeachingAsset；若无安全候选则回退 ConceptCard / 审核题目讲解
```

## 4. 评分和原因码

策略版本：`teaching-asset-selection-v1`；解析器版本：`teaching-asset-resolver-v2`。

正向信号包括：

- `unseen_by_student`：学生未看过；
- `depth_match`：时长符合当前内容深度；
- `global_healthy`：样本充足且完成率、独立验证通过率达标；
- `bounded_exploration`：命中当日确定性 20% 探索窗口；
- `alternate_after_ineffective_asset`：存在已证明无效的旧讲解，本次改用替代项。

降权或排除信号包括：

- `recent_exposure`、`previously_completed`、`previously_skipped`；
- `prior_independent_failed`、`prior_not_stable`；
- `prior_independent_passed`、`prior_stable`，用于避免重复教授已经会的内容；
- `global_weak`；
- `insufficient_global_sample`，未命中探索窗口时不能优先于成熟有效资源。

全局成熟样本门槛与 PR12F 一致：至少 10 个曝光上下文、5 名学生和 3 个独立验证结论。成熟资源的独立验证通过率至少 0.67 且完成率至少 0.5 才获得健康加权。

## 5. 失败避重与安全回退

对当前学生出现以下任一证据的候选标记为 `avoidRepeat`：

- 独立验证失败；
- 稳定性结果为 `not_stable`；
- 学生明确跳过。

只要还有其他安全候选，`avoidRepeat` 候选不会被选择。如果全部候选均为 `avoidRepeat`，解析器返回空，由既有 Delivery 链路回退到已发布 ConceptCard 或已审核标准讲解；不会继续重复已证明无效的交互资产。

## 6. 审计与可解释性

选择决策随 TeachingAsset 快照写入：

- policy/resolver version；
- 选中版本与分数；
- 原因码；
- 候选数和可用候选数；
- 是否属于受控探索；
- 每个候选的安全摘要。

主动干预同时把决策写入 `LearningInterventionDelivery.contextSnapshot` 和 `LearningInterventionStep.metadata`。因此后续效果分析可以按“当时为什么选择它”复现，不依赖当前资源状态。

## 7. 验证

运行：

```powershell
npm.cmd --prefix backend run test:teaching-asset-selection
```

固定策略测试覆盖：

- 已失败资源存在替代项时选择新讲法；
- 所有候选都已证明无效时返回安全回退；
- 探索窗口选择新资源；
- 普通窗口选择样本充分的成熟资源。

## 8. 后续边界

PR12H 完成的是在线选择底座，不自动下架资源，也不把全局群体效果当成个体掌握证据。后续可在真实样本充足后增加难度带、误区类型、无障碍偏好和媒介偏好的分层效果，但必须继续版本化策略并保留回放能力。
