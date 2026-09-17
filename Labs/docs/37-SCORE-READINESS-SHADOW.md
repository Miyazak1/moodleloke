# PR9A：Score Readiness Shadow Gate

## 1. 目标

PR9A 建立目标分数备考度的可落地底座，但不在量尺尚未校准时输出伪精确成绩。Web Agent 与未来插件可以回答“目前是否具备预测条件、缺少什么证据、下一步应验证什么”，不能声称学生预计能考多少分。

## 2. 已落地边界

- 输入来自当前活动目标、同版本 Target Gap、Learning State、Evidence、Syllabus、Scoring Policy 标签、题目校准标签、决策上下文与 Forecast 模型版本；
- 每个活动目标科目生成一条不可变 `ScoreReadinessForecast`；
- 相同用户、目标、科目和 `versionHash` 幂等复用；新事实产生新决策版本和新 Forecast，不覆盖历史记录；
- 发布前在事务内验证当前决策指针，持久化后再次重算确认，避免并发事实变化后返回旧版本；
- 当前只返回 `insufficient | measuring`，`confidence` 固定为 `insufficient`；
- `expectedScoreBand` 与 `targetAttainmentProbability` 固定为 `null`；
- 返回结构化 `reasonCodes` 与 `nextValidationAction`；
- 不调用 LLM，不调用自动出题，不改变训练、掌握度或错题数据。

## 3. 状态语义

| 状态 | 当前含义 | 下一动作 |
| --- | --- | --- |
| `insufficient` | 大纲覆盖或独立证据不足，连测量前提都不完整 | `diagnostic` |
| `measuring` | 基础覆盖已具备，但评分量尺未校准，或仍需正式模考 | `mock_exam` 或 `continue_learning` |
| `on_track` | 保留给正式校准后的达标判断 | PR9A 禁止输出 |
| `at_risk` | 保留给正式校准后的风险判断 | PR9A 禁止输出 |

PR9B 起门禁原因由实际治理记录确定，不再硬编码。缺失或未合格的评分政策、题目校准和 Forecast 校准分别返回结构化原因；其余原因从 Gap 派生，包括大纲覆盖不足、独立证据不足、缺少近期模考和阶段验证到期。无论治理是否通过，当前都会返回 `NUMERIC_FORECAST_RELEASE_DISABLED`。

## 4. 能力调用

`get_score_readiness` 是 `learning.read`、L0、AI 成本 0 的只读能力。Feature Flag 依赖链为：

```text
foundation -> evidenceWrite -> shadowProjection -> targetGap -> prescription -> scoreReadiness
```

状态返回：

- `goal_unset`：没有活动目标；
- `updating`：Evidence 已领先于 Shadow Projection 或决策正在重算；
- `ready`：返回 `visibility: shadow` 和每个目标科目一条 Forecast。

Agent 只允许解释结构化结果。当前必须明确告诉学生“尚未输出未经校准的预计分数或达标概率”，不能由模型补写数字。

## 5. 数据一致性与安全

- 所有目标读取都绑定 `userId`，禁止跨用户读取；
- PostgreSQL advisory lock 串行化同一用户 Forecast 发布；
- `LearningDecisionCurrent` 与 `versionHash` 在写入事务中复核；
- 写入后再次调用确定性决策重算并比较版本，输入变化时最多重试一次；
- Forecast 只追加不覆盖，保留审计与回放能力；
- 自动出题仍是隔离的 Question Supply 能力，当前 Readiness 不会触发即时生成。

## 6. 正式数值预测的开放门槛

PR9B 不能仅把 `null` 换成数字。至少需要：

1. 可审计的 `ExamScoringPolicy` 生命周期、官方来源和 active 版本；
2. 题目难度、区分度与量尺校准，且正式模考与真实考试尺度可比；
3. 按科目、语言、卷型和关键学生分层做保留集回测；
4. 区间覆盖率、概率校准误差、漂移与最小样本门槛；
5. Shadow 对照、人工审核、灰度开关和一键回退；
6. 对学生展示不确定性、证据截止时间与“非成绩保证”说明。

门槛未全部满足时，`on_track`、`at_risk`、分数区间和达标概率继续保持关闭。

PR9B 已建立 `ExamScoringPolicy`、`ItemCalibrationSnapshot`、`ForecastCalibrationSnapshot` 与确定性的 Shadow Gate。它只证明治理链是否具备进入下一阶段的资格，不代表数值预测已发布；实现细节见 [39-SCORE-CALIBRATION-GOVERNANCE.md](./39-SCORE-CALIBRATION-GOVERNANCE.md)。
