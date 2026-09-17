# PR9C：离线校准流水线与后台治理闭环

## 1. 结果

PR9C 将 PR9B 的治理表接入可执行的“数据集校验—确定性指标—不可变工件—独立审核—资格确认—撤回”流程。该流程只面向管理员，不属于学生请求、Agent Tool 或自动出题运行时链路。

本阶段仍不训练分数预测模型，也不开放学生端数值预测。`ScoreCalibrationGovernanceService` 即使返回 `shadow_qualified`，仍固定返回 `numericForecastRelease: disabled`。

## 2. 组件边界

```text
诊断/模考证据（去标识）
          |
          v
Score Calibration Engine（确定性、无 LLM）
          |
          +-- ItemCalibrationSnapshot
          +-- ForecastCalibrationSnapshot
          |
          v
独立管理员 review -> qualify / reject -> retire
          |
          v
PR9B Shadow Gate
```

- `score-calibration-engine.ts`：纯函数计算指标和 SHA-256 工件哈希；
- `ScoreCalibrationAdminService`：事务化保存、状态迁移、双人审核边界和治理事件；
- `ScoreCalibrationController`：只暴露在 `RequiredAdminGuard` 后；
- `ScoreCalibrationGovernanceEvent`：追加式记录每次创建、审核、激活、拒绝、合格和退役动作；
- 自动出题只可离线导出候选题库版本，不能调用审核或 qualify 接口。

## 3. Item Calibration 输入与隔离

每条观察只接受：

- `sourceType: diagnostic | mock_exam`；
- `exposureState: prompt_seen`；
- 首次作答；
- 未使用提示、答案或解析；
- 题目质量置信度至少 `0.8`；
- 仅保存不可逆的 `learnerKeyHash`，不把用户 ID 写入校准工件。

系统按学习者切分 `calibration` 与 `holdout`。同一学习者出现在两个集合时，`learnerSplitIsolation` 必定失败。题目可以跨集合出现，以便比较难度漂移；同一观察 ID 不可重复。

V1 固定发布阈值：

| 指标 | 门槛 |
| --- | ---: |
| 总观察数 | ≥ 500 |
| 保留集观察数 | ≥ 100 |
| 题目数 | ≥ 10 |
| 每题观察数 | ≥ 20 |
| 中位区分度 | ≥ 0.10 |
| 低区分度题占比 | ≤ 20% |
| 平均难度漂移 | ≤ 0.15 |

所有指标同时通过才设置 `allCriteriaPassed=true`。引擎只生成 `shadow` 快照，不会自行标记为 qualified。

## 4. Forecast Calibration 输入与指标

Forecast 校准只接受独立 holdout 结果。每名学习者只能有一条结果，实际分、预测中心值、区间和目标分都必须位于声明的评分量尺内，`targetAttained` 必须与实际分确定性一致。

PR9D-B1 起，Forecast 输入必须声明 `outcomeSource`。只有 `verified_csca_exam` 能通过结果来源门槛；`timed_mock_proxy` 可用于开发比较，但 `allCriteriaPassed` 固定为 false，不能审核或晋级。详见 [42-SCORE-PREDICTION-CALIBRATION-DATASET.md](./42-SCORE-PREDICTION-CALIBRATION-DATASET.md)。

V1 计算：

- 归一化 MAE；
- 预测区间覆盖率；
- Brier Score；
- 10 桶 Expected Calibration Error；
- 每个 `stratum` 的相同指标；
- 相对已批准基线的 MAE 与校准误差漂移。

V1 固定门槛：保留集至少 300 人、每分层至少 30 人、90% 区间覆盖误差不超过 5 个百分点、归一化 MAE 不超过 0.12、ECE 不超过 0.08，并同时通过分层与基线漂移限制。没有基线时不能通过。

PR9C 只验证候选预测结果；PR9D-A 已加入首个化学内部 Shadow 候选模型及独立的 Modeling Prerequisite Gate，详见 [41-CHEMISTRY-SCORE-PREDICTION-SHADOW.md](./41-CHEMISTRY-SCORE-PREDICTION-SHADOW.md)。

## 5. 后台接口

基础路径：`/api/v1/admin/score-calibration`

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/` | 查看政策、快照和最近治理事件 |
| GET | `/gate` | 按完整版本向量预览 Shadow Gate |
| POST | `/scoring-policies` | 创建 draft 评分政策 |
| POST | `/scoring-policies/:id/review` | 独立审核政策 |
| POST | `/scoring-policies/:id/activate` | 激活政策并 supersede 旧 active 版本 |
| POST | `/scoring-policies/:id/withdraw` | 撤回政策 |
| POST | `/item-snapshots/build` | 从去标识观察构建题目校准快照 |
| POST | `/forecast-snapshots/build` | 从 holdout 结果构建 Forecast 校准快照 |
| POST | `/:kind-snapshots/:id/review` | approve 或 reject 快照 |
| POST | `/:kind-snapshots/:id/qualify` | 将 reviewed 快照标记为 qualified |
| POST | `/:kind-snapshots/:id/retire` | 退役快照并立即关闭后续 Gate 命中 |

所有状态变更要求至少 8 个字符的理由。创建者不能审核自己创建的政策或工件；不合格工件不能 approve；Forecast qualify 前再次确认评分政策仍为 active、题目校准仍为 qualified。

## 6. 工件可重复性与隐私

输入观察和预测行先按稳定 ID 排序，再进行统计和 canonical JSON 哈希。因此相同数据集即使文件顺序不同，也生成相同 `artifactHash`。数据库只保存聚合指标、阈值、结果、来源数据集哈希和工件哈希，不保存逐学生作答行。

原始去标识数据集应位于受控离线存储，访问日志和保留期限独立管理。`learnerKeyHash` 必须使用环境专属盐值在导出层产生，不能简单散列邮箱或用户 ID。该盐值不进入 Agent、Prompt、浏览器或校准工件。

## 7. 状态机

```text
policy:   draft -> reviewed -> active -> superseded | withdrawn
snapshot: shadow -> reviewed -> qualified -> retired
                    \-> rejected
```

工件指标和哈希没有更新接口；算法、阈值、数据窗口或输入变化必须生成新 `calibrationVersion`。状态迁移与领域数据在同一数据库事务完成，并使用旧状态条件执行 compare-and-set；并发审核只有一个请求能成功，避免生成分叉事件。

## 8. PR9D 的输入

PR9D 可以开始实现首个可解释预测模型，但仍只做内部 Shadow：

1. 冻结真实 CSCA 评分政策来源；
2. 选择一科和一个卷型作为首个建模范围；
3. 用训练集拟合、holdout 集生成本流程需要的预测行；
4. 生成 ForecastCalibrationSnapshot 并走独立审核；
5. 比较模型与简单基线，未通过门槛就保留 `blocked`。

学生端数值开放、灰度开关和产品文案不属于 PR9D 的默认授权范围。

建模运行不能预先依赖自身的 Forecast 校准，否则形成循环依赖。PR9D-A 因此只用 active 官方政策与 qualified 题目校准打开内部建模入口；完整 Gate 仍要求 Forecast 校准。
