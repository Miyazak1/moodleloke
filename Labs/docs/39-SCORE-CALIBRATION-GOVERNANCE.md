# PR9B：评分策略与预测校准治理底座

## 1. 目标与边界

PR9B 把“什么时候才有资格输出分数预测”从文档约定变成数据库约束和确定性服务。它不实现数值预测，不开放学生端 `on_track / at_risk`，也不调用大模型或自动出题系统。

当前唯一对外结论仍是 Shadow：即使所有校准记录合格，也必须返回 `NUMERIC_FORECAST_RELEASE_DISABLED`，`expectedScoreBand` 与 `targetAttainmentProbability` 继续为 `null`。

## 2. 三类治理记录

### `ExamScoringPolicy`

保存考试体系的版本化评分事实，包括官方来源 URL、来源快照哈希、分数量尺、评分规则、有效期、审核人与激活时间。生命周期为：

```text
draft -> reviewed -> active -> superseded | withdrawn
```

数据库只允许同一考试体系存在一个 `active` 版本。`active` 必须来自 `official` 来源，并具有来源 URL、审核人与激活审计信息。暂无法核实的规则只能保存为 `provisional`，不能激活。

### `ItemCalibrationSnapshot`

保存按考试体系、科目和题库版本生成的不可变题目校准工件。快照包含样本量、题目数、保留集样本量、指标、发布阈值、逐项阈值结果、数据窗口和工件哈希。

只有全部阈值通过且完成人工审核的快照可标记为 `qualified`。日常训练题、已泄露题或仅有生成器自检结果不能自动取得该状态。

### `ForecastCalibrationSnapshot`

保存预测模型在确定的评分策略与题目校准版本上的保留集回测结果。它按考试体系和科目建立作用域，并可进一步限定语言和卷型；指标与分层指标以版本化 JSON 工件保存，核心审计字段保留为独立列。

`qualified` 要求全部阈值通过、工件哈希存在、人工审核完成，并且外键绑定真实存在的评分策略和题目校准快照。

## 3. Shadow Gate

`ScoreCalibrationGovernanceService` 对每个科目使用完整版本向量做精确匹配：

1. `scoringPolicyVersion` 必须对应同考试体系的 active 官方政策；
2. `itemCalibrationVersion` 必须对应同考试体系、同科目的 qualified 快照；
3. Forecast 校准必须同时匹配科目、预测模型、评分政策和题目校准版本；
4. 三者都通过时状态仅为 `shadow_qualified`，否则为 `blocked`；
5. 两种状态都带 `NUMERIC_FORECAST_RELEASE_DISABLED`。

服务返回三类记录 ID、结构化原因和 `gateVersionHash`。哈希由治理输入与实际命中的审计记录确定性生成，不包含查询时间。

`ScoreReadinessService` 将 `decision.versionHash` 与 `gateVersionHash` 组合为 Forecast 的存储版本。这样，政策激活、校准退役或回测换版会生成新的不可变 Forecast，而不会覆盖旧结论；返回前会再次校验决策和治理哈希，任一输入变化都重试或失败关闭。

## 4. 数据约束与发布安全

- 状态值、非负样本量、保留集不大于总样本量和数据窗口顺序由数据库约束；
- active 政策和 qualified 校准的审核字段由数据库约束，不能只靠管理界面；
- Forecast 校准通过外键锁定政策和题目校准版本，已被引用的量尺不能被级联删除；
- 已被治理记录引用的审核账号禁止物理删除；账号可停用，但审核身份与历史工件必须保留；
- 所有校准记录带 artifact hash，原始回测工件应保存在受控对象存储并做内容寻址；
- 学生请求和 Agent 工具没有写入这些治理表的能力。

## 5. 与自动出题的隔离

自动出题可以生产训练供给和候选校准数据，但不能直接写 `qualified`：

```text
Question Supply
  -> 独立质量审核
  -> 保留集/曝光隔离
  -> 离线校准工件
  -> 人工审核
  -> qualified snapshot
  -> Shadow Gate
```

生成器版本、题库版本和校准工件之间通过版本字符串及哈希关联，不让 Agent 运行时直接依赖生成器内部表或同步等待出题。

## 6. PR9C 落地状态

PR9C 已建立确定性校准引擎、管理员专用治理接口、创建者与审核者隔离、事务化状态迁移和追加式治理事件。输入隔离规则、固定 V1 门槛、接口与测试边界见 [40-SCORE-CALIBRATION-PIPELINE.md](./40-SCORE-CALIBRATION-PIPELINE.md)。

## 7. 数值预测后续开工门槛

后续进入数值预测实现前必须先冻结：

- 各科量尺及官方评分规则的真实来源快照；
- 题目难度、区分度、曝光与保留集方案；
- 各科最小样本量、区间覆盖、概率校准误差、漂移和分层公平阈值；
- 校准工件生成、双人审核、撤回和重放流程；
- 独立的后台发布开关、灰度范围、监控告警和一键回退；
- 学生端不确定性、证据截止时间及“非成绩保证”的固定文案。

在真实政策与合格数据进入治理表之前，当前 `csca-score-unverified-v1` 和 `not-enabled` 会自然命中 `blocked`，这是正确状态，不应通过 seed 伪造为合格。

PR9D-A 已把建模前置门与完整发布门分离：前者只验证官方政策和题目校准，后者继续要求 Forecast 校准并关闭学生数值发布。首个化学 Shadow 模型、证据门槛与当前本地数据审计见 [41-CHEMISTRY-SCORE-PREDICTION-SHADOW.md](./41-CHEMISTRY-SCORE-PREDICTION-SHADOW.md)。
