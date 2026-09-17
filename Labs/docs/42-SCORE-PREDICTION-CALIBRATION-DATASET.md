# PR9D-B1：预测—结果配对与时间隔离校准数据集

## 1. 目标与结论

PR9D-B1 将 PR9D-A 的化学 Shadow 预测与预测发生后的独立限时模考结果配对，形成可重复生成的 Forecast Calibration 输入。该数据只用于模型开发与离线比较，不向学生展示，也不由 Agent 调用。

限时模考只是真实学习行为产生的“代理结果”，不是经核验的 CSCA 正式成绩。因此即使代理数据达到样本量并取得优秀指标，也不能使 Forecast Calibration 取得发布资格。

## 2. 数据流

```text
computed ScorePredictionShadowRun
          +
预测至少 7 天后的独立限时模考
          |
          v
时间窗口 + 学习者隔离 + 量尺一致性
          |
          v
候选模型 rows + 最近模考 baseline metrics
          |
          v
ForecastCalibrationInput（仅 ready 时导出）
          |
          v
管理员显式 build -> review -> qualify
```

数据集服务不会自动创建、审核或晋级 `ForecastCalibrationSnapshot`。管理员必须显式提交导出工件；创建者与审核者隔离沿用 PR9C。

## 3. 配对规则

- 预测必须为 `chemistry-interpretable-scorecard-shadow-v1` 的 `computed` 记录；
- 评分政策和题目校准版本必须精确匹配；
- 特征快照必须记录建模前置门为 `qualified`；
- 结果必须来自化学、已完成、有有效题数且用时不超过卷面时长 125% 的模考；
- 结果必须发生在预测边界至少 7 天、至多 90 天之后；预测边界取评估日末与证据截止时间中较晚者；
- 每名学习者只选择最早的合格后续结果，并使用它之前最近的一次预测；
- 截止日前结果进入 calibration 候选，截止日后结果进入 holdout 候选；
- 同一学习者若同时能进入两个时间分割，则整名学习者排除并记录 `CROSS_SPLIT_LEARNERS_EXCLUDED`；
- holdout 量尺必须完全一致。

V1 至少要求 100 名 calibration 学习者和 300 名 holdout 学习者。任何门槛未通过时 `status=blocked` 且 `forecastCalibrationInput=null`。

## 4. 隐私与可重复性

数据集不输出用户 ID、邮箱或显示名。`learnerKeyHash` 使用环境专属密钥做 HMAC-SHA256，不能使用无盐哈希：

- `CSCA_FORECAST_CALIBRATION_LEARNER_SALT`：至少 32 字符；
- `CSCA_FORECAST_CALIBRATION_LEARNER_SALT_VERSION`：非秘密版本标识。

密钥或版本缺失时导出失败关闭。密钥不写入数据库、日志、响应、文档或工件；版本标识进入数据集作用域。输入顺序不影响 `sourceDatasetHash`，相同版本化预测和结果可确定性重放。

## 5. 基线与候选比较

同一 holdout 学习者同时产生：

- 候选模型：PR9D-A 可解释加权模型的区间、中心值和目标达成概率；
- 基线：该次预测生成时的最近限时模考区间、中心值和概率；
- 实际代理结果：后续限时模考正确率映射到同一官方量尺。

数据集层计算基线 normalized MAE 和 ECE；PR9C 引擎计算候选 normalized MAE、区间覆盖、Brier、ECE、分层指标以及相对基线漂移。

## 6. 结果来源硬门

`ForecastCalibrationInput.outcomeSource` 是强制契约：

- `timed_mock_proxy`：允许创建开发工件，但 `verifiedOutcomeSource=false`，`allCriteriaPassed` 必为 false；
- `verified_csca_exam`：只有该来源才可能通过全部门槛。

数据库迁移 `0087_forecast_outcome_provenance` 为 Forecast 快照保存来源。应用审核、资格确认、完整治理 Gate 和数据库约束均再次阻止代理来源晋级。旧记录标记为 `legacy_unknown`，不会被追认为真实成绩。

## 7. 管理端接口

`POST /api/v1/admin/score-calibration/shadow-predictions/calibration-dataset`

请求字段：`scoringPolicyVersion`、`itemCalibrationVersion`、`temporalCutoffDate`、`dataWindowStart`、`dataWindowEnd`。接口受 `RequiredAdminGuard` 保护。

## 8. 当前状态与下一步

2026-09-14 本地开发库没有可配对的 Shadow 预测或化学模考结果，预期返回 `blocked`。这是数据真实性保护，不是功能异常。

PR9D-B2 已实现独立同意、可撤回/更正、双人核验的 `StudentExamOutcome` 接入，以及不可变数据清单和撤回传播；只有有效真实 CSCA 结果才能生成 `verified_csca_exam` 输入。详见 [43-VERIFIED-CSCA-EXAM-OUTCOME-CLOSED-LOOP.md](./43-VERIFIED-CSCA-EXAM-OUTCOME-CLOSED-LOOP.md)。下一步是在受控试点中积累真实样本并运行正式时间外推、分层公平与漂移评估。
