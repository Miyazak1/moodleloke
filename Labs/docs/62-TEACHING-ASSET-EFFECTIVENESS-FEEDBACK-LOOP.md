# PR12F：教学资产效果反馈闭环

## 目标

让教学资产运营不只看到“发布成功”和“播放完成”，而是能回答：学生是否参与、是否完成、即时检查是否理解，以及完成后能否在不使用提示和解析的独立新题中通过验证。

## 指标分层

后台入口仍为 `/admin/content/teaching-assets`，选择资产后显示近 7、30 或 90 天效果。

1. **互动上下文**：有受治理 TeachingAsset Exposure 的题目或主动干预上下文数；
2. **完成率**：完成即时检查并完成微课的上下文占比；
3. **即时检查首次正确率**：每个学生、版本和上下文的第一次 active prompt 作答；
4. **独立新题通过率**：`LearningInterventionOutcome.independent=true` 且结果为 passed/failed 的验证结果；
5. **阶段验证**：分别报告 immediate、retention、transfer；
6. **稳定性**：读取现有 `LearningInterventionStabilityAssessment` 的 stable、not_stable、inconclusive 和 pending。

完成率和即时检查是参与及理解信号，不是掌握证据。真正的学习效果以独立新题及跨时间稳定性为主。

## API 合同

`GET /api/v1/admin/teaching-assets/:id/analytics?days=30`

- 只允许管理员访问；
- 支持 1—365 天窗口及可选 `versionId`；
- 返回资产聚合和逐版本指标；
- 只返回聚合数值，不返回学生身份、作答内容或答案；
- 使用已有 Exposure、Interaction、Delivery、Outcome 与 Stability 数据，不复制学习事实表。

## 运营信号

策略版本：`teaching-asset-effectiveness-v1`。

- 少于 10 个互动上下文、少于 5 名独立学生或少于 3 个独立验证：`insufficient_data`；
- 独立验证通过率低于 50%，或即时检查首次正确率低于 40%：`review`；
- 完成率低于 50%，或独立验证通过率低于 67%：`watch`；
- 其余达到最低样本的情况：`healthy`。

运营信号只用于人工判断，`automaticAction=false`。它不得自动发布、下架、改变掌握度或改变学生处方。

## 版本归因

- Exposure 和 Interaction 按 `assetVersionId` 归因；
- 主动教学后的独立验证按 Delivery 的 `contentSourceVersion` 归因；
- v1 与 v2 数据分开展示，资产级指标才聚合全部所选版本；
- 验证结果可晚于教学发生，窗口以对应教学 Delivery 的创建时间归因，避免延迟验证被错误丢失。

## 当前边界

- 当前“互动上下文”从首次受治理交互开始记录，不等同于页面纯曝光 PV；
- 尚未做随机对照或因果提升估计，不能把通过率解释为资产带来的净提升；
- 低流量资产明确显示样本不足；
- 后续可增加同知识点基线比较、置信区间、质量告警队列和版本 A/B 实验。

## 验收

`node scripts/agent-teaching-assets-admin-live.cjs --apply` 在本地数据库中创建临时资产、互动上下文和三阶段独立验证，验证完成率、首次正确率、独立验证通过率、稳定性与运营信号，并在结束后清理全部临时数据。
