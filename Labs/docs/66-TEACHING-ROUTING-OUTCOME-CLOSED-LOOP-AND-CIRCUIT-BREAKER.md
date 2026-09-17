# TeachingAsset 路由效果闭环与自动熔断（PR12J）

## 1. 目标与边界

PR12J 把 PR12I 的路由决策与真实教学交付、独立新题验证、延迟保持和迁移验证串成同一条证据链，用于回答“Active 个性化路由是否比旧路由表现更好”。

这里报告的是受控灰度组间关联结果，不宣称因果提升。只有稳定哈希分组、相同学科/时间窗口、足够样本和无选择污染时，才具备进一步做因果判断的基础。互动完成或即时提示正确不等于掌握；主要指标仍是独立新题和稳定性结果。

## 2. 证据链

不新增事实表，复用已有数据：

1. `teaching_asset_routing_decision` 提供模式、上下文和实际展示版本；
2. `LearningInterventionDelivery` 通过 `intervention:{id}` 与路由上下文关联；
3. `LearningInterventionOutcome` 提供 immediate、retention、transfer 独立验证结果；
4. `LearningInterventionStabilityAssessment` 提供 stable、not_stable 与 inconclusive；
5. `teaching_asset_routing_circuit_state` 仅保存聚合熔断状态和原因码，不保存答案或身份资料。

`shadow` 实际展示旧路由，因此归入 baseline；`active` 归入实验组。没有教学交付、非 TeachingAsset 内容或无法解析的上下文不进入效果样本。

## 3. 指标与样本条件

按最近 1—90 天统计：

- 教学交付数、完成率；
- 独立验证数、有效 passed/failed 数和通过率；
- 稳定性评估数、stable/not_stable 数和稳定率；
- Active 相对 baseline 的验证通过率、稳定率和完成率变化；
- Active 最近连续即时独立验证失败次数。

baseline 与 Active 各至少 20 个交付、各至少 10 个有效独立验证时，标记 `evidenceQualified=true`。样本未达标时只显示 monitoring，不阻止小流量验证。

## 4. 自动熔断

策略版本 `teaching-asset-routing-outcome-v1`。任一条件成立即把对应学科持久化为 `tripped`：

- Active 有至少 8 个有效独立验证且通过率低于 35%；
- 两组各至少 20 个有效验证，Active 落后 baseline 至少 15 个百分点；
- Active 有至少 8 个稳定性评估且稳定率低于 50%；
- 两组各至少 12 个稳定性评估，Active 稳定率落后至少 20 个百分点；
- Active 连续 5 次即时独立验证失败。

熔断后，已命中 Active 灰度的学生也会自动按 Shadow 执行：继续计算新策略，但只展示旧策略内容。熔断检查失败同样 fail-closed 到 Shadow。熔断不会修改掌握度、下架内容、扩大流量或自动恢复。

管理员完成原因排查后可调用：

`POST /api/v1/admin/teaching-assets/routing-circuit/:subject/reset`

请求体为 `{ "reason": "..." }`。重置会写管理员审计并恢复 monitoring；后续自动判断从重置时间开始积累新样本，旧失败样本仍可在后台历史窗口查看，但不会立即造成重复熔断。部署环境变量仍是最终总开关，紧急情况可直接切回 `legacy`。

## 5. 触发时机和运营界面

每次干预验证结算后，系统以 best-effort 方式重新评估该学科。评估或状态写入失败不得影响学生提交验证题。

`GET /api/v1/admin/teaching-assets/routing-diagnostics` 在 PR12I 技术指标基础上增加：

- baseline / Active 教学效果；
- 相对变化；
- 当前效果证据是否具备比较条件；
- 当前窗口判断与三学科持久化熔断状态。

路由时读取持久化状态，因此多实例部署共享同一熔断结果，不依赖单机内存。

## 6. 验收

```powershell
npm.cmd --prefix backend run test:teaching-asset-selection
node backend/scripts/learning-intervention-verification-test.cjs
node backend/scripts/learning-intervention-stability-test.cjs
```

测试覆盖健康对照、明显退化、低样本连续失败、持久化熔断、人工重置，以及 Active 被熔断后实际降级为旧路由。
