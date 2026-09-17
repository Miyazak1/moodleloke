# PR9D-A：化学可解释分数预测 Shadow 底座

## 1. 本阶段结论

PR9D-A 实现首个只在内部运行的化学分数预测候选模型。它把已版本化的学习状态、独立作答证据、限时模考、官方评分政策和题目校准快照适配为确定性特征，同时保存“最近一次限时模考”基线与可解释加权候选结果。

该结果不进入学生页面、不注册为 Agent capability、不驱动处方，也不代表成绩承诺。所有结果固定携带 `NUMERIC_FORECAST_RELEASE_DISABLED`；模型尚未通过真实 holdout 校准时还携带 `MODEL_UNCALIBRATED`。

## 2. 两道门与循环依赖修正

建模和发布是两件事：

```text
官方计分政策 + qualified 题目校准
                 |
                 v
        Modeling Prerequisite Gate
                 |
                 v
       内部 Shadow 预测与结果配对
                 |
                 v
       Forecast Calibration Snapshot
                 |
                 v
       完整 Release/Shadow Gate
```

第一道门只证明输入量尺和题目尺度可用，允许内部模型积累预测。第二道门还要求该模型在独立 holdout 上通过 Forecast 校准。若让第一道门也要求 Forecast 校准，就会形成“没有预测无法校准、没有校准又不能预测”的循环依赖。

即使完整 Gate 为 `shadow_qualified`，V1 的学生数值发布仍固定关闭；解除必须另开发布阶段和审批。

## 3. 数据与适用范围

V1 仅支持：

- `examSystemCode=csca`；
- `subjectCode=chemistry`；
- 评分政策 `scoreScale` 明确包含 `subjects.chemistry.minimum/maximum`；
- 活动目标中存在化学目标分；
- 学习状态模型精确匹配 `ls-v1-shadow-model-1`；
- 独立证据仅计首次、未提示、未看解析、已见题干、题质置信度至少 0.8 的诊断或模考记录；
- 模考必须完成、具备有效题数，且用时不超过试卷时长的 125%。

缺少目标、未知量尺、治理未通过或证据不足均失败关闭。服务不会把普通聊天、附件分析结论或自动出题自检当成独立作答证据。

## 4. V1 候选模型

候选模型是可解释加权 scorecard，不使用 LLM：

| 特征 | 权重 |
| --- | ---: |
| 掌握度 | 20% |
| 覆盖度 | 14% |
| 独立性 | 14% |
| 保持度 | 10% |
| 熟练度 | 10% |
| 迁移能力 | 10% |
| 一致性 | 8% |
| 最近限时模考 | 14% |

基线是最近一次合格限时模考的客观题正确率映射到官方量尺，不假定现有 `MockExamAttempt.score` 与官方量尺天然相同。候选输出保存区间、目标达成概率和各组件贡献，但这些概率在 Forecast Calibration 通过前只能用于离线比较。

V1 最低计算门槛：至少 5 个知识点状态、30 条独立证据、平均状态置信度 0.5、状态不超过 30 天、至少一场 45 天内限时模考。门槛不满足仍保存 `blocked` Shadow 记录及结构化原因，但不保存候选数值。

## 5. 版本、重放与存储

`ScorePredictionShadowRun` 绑定用户、目标、科目、评分政策版本、题目校准版本、模型版本、证据截止时间、评估日期、完整特征快照和来源哈希。相同版本化输入生成相同 `versionHash`，数据库唯一约束保证重试不重复。

迁移为 additive：`0086_score_prediction_shadow`。应用回滚时保留 Shadow 记录；关闭功能使用 `CSCA_SCORE_PREDICTION_SHADOW_ENABLED=false`，不删除历史数据。

## 6. 管理端运行

仅 `RequiredAdminGuard` 后可访问：

- `POST /api/v1/admin/score-calibration/shadow-predictions/run`
- `GET /api/v1/admin/score-calibration/shadow-predictions/:userId`

运行请求包含 `userId`、`scoringPolicyVersion`、`itemCalibrationVersion`，可选 `evaluationDate`。生产运行前必须同时开启从 Foundation 到 Score Readiness 的依赖开关以及 `CSCA_SCORE_PREDICTION_SHADOW_ENABLED=true`。

## 7. 当前真实数据审计

2026-09-14 对本地开发数据库做只读审计：完成模考 0、化学独立 Evidence 0、化学 V2 State 0、活动目标 1。因此当前本地账号应返回 `blocked`，不能声称模型已取得有效准确率。本结论只描述该时点的本地开发库，不代表生产数据。

## 8. 下一阶段 PR9D-B

1. 冻结一份可核验的 CSCA 化学官方量尺与题目校准版本；
2. 积累按时间切分、按学生隔离的预测—真实结果配对；
3. 比较候选模型与最近模考基线，校准区间和概率；
4. 生成 Forecast Calibration 工件并走独立审核；
5. 检查总体与分层误差、漂移和覆盖率。

真实样本不足或候选不优于基线时继续保持 Shadow，不能降低 PR9C 门槛或用 fixture 取得 qualified。

PR9D-B1 已实现后续限时模考代理结果的时间隔离数据集与基线比较，并以强制来源门阻止代理结果取得发布资格，见 [42-SCORE-PREDICTION-CALIBRATION-DATASET.md](./42-SCORE-PREDICTION-CALIBRATION-DATASET.md)。
