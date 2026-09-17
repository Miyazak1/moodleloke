# TeachingAsset 路由 Shadow 与发布门（PR12I）

## 1. 决策

PR12H 的个性化选择策略不能仅凭实现完成就直接扩大线上影响。PR12I 增加三态发布控制、双轨观测、运营诊断和人工发布门。

配置 `CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE`：

- `legacy`：只运行并展示 v1，不写双轨观测；这是生产默认值和紧急回退位；
- `shadow`：学生继续看到 v1，同时计算 v2 并写入脱敏决策事件；
- `active`：展示 v2，并继续记录选择证据。

未知值一律按 `legacy` 处理。模式只能通过部署配置人工变更，指标达标不会自动激活。

`active` 还必须同时配置 `CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS` 和 `CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT`。学科不在白名单或用户稳定哈希未命中百分比时，实际行为自动降为 `shadow`；百分比缺省为 0，避免误放量。本地一键启动明确配置三科和 100%，只用于演示。

## 2. 双轨事件

复用既有 `CscaTrainingEvent`，事件类型为 `teaching_asset_routing_decision`，不新增迁移和在线依赖。每个练习题或主动干预上下文只记录一次。

事件保存：

- context type/key、topic、subject；
- routing mode 和策略版本；
- v1、v2 与实际展示的版本 ID；
- 是否分歧、是否回退、是否探索；
- 候选数量、可用数量、原因码和耗时；
- 不包含教学答案、附件正文或学生身份资料。

诊断 API 将学生 ID 做不可逆短哈希后返回管理员，前端不接收原始 ID。观测写入失败只告警，不阻断学生获得已审核内容。

## 3. 发布门

后台教学资产工作台展示近 1–90 天的双轨指标：

- 决策数至少 50；
- 个性化候选覆盖率至少 80%；
- 个性化回退率不超过 20%；
- 新资源探索率不超过 20%；
- 路由 P95 不超过 250ms；
- 新旧路由分歧率与“替换已无效讲解”次数作为人工复核信号。

只有所有硬门同时满足时返回 `qualified=true`。这只是允许人工灰度的证据，不触发配置写入、自动放量或自动下架。

## 4. 回滚和灰度

任何异常均可把单一环境变量切回 `legacy`，不需要数据库回滚。建议顺序：

1. 本地与测试环境 `active` 验证功能；
2. 线上内部账号 `shadow`；
3. 按学科观察诊断指标和具体分歧样本；
4. 达门后另行批准小流量 `active`；
5. 回退率、延迟或学习结果恶化时立即回 `legacy`。

当前版本已提供全局三态、学科白名单和基于用户稳定哈希的百分比灰度。同一学生不会因请求重试随机跨组；线上首次启用仍应从内部账号和单学科小比例开始。

## 5. 验证

```powershell
npm.cmd --prefix backend run test:teaching-asset-selection
node scripts/agent-teaching-routing-shadow-live.cjs
```

自动测试覆盖模式默认安全、Shadow 不改变学生内容、Active 使用个性化结果、无效内容避重、指标门和学生标识脱敏。真实脚本要求本地数据库与隔离演示账号，并验证真实事件和管理员诊断 API。
