# 数据迁移不变量

## 自动阻断项

`npm run data:preflight` 使用只读事务检查：

- PostgreSQL 主版本不得低于 16；
- public schema 必须存在且不能为空；
- Prisma 迁移不得存在 `finished_at IS NULL AND rolled_back_at IS NULL` 的失败记录；
- 用户、学生档案、Agent 会话/消息/产物、学习证据、题目、自适应轮次、教学资产与真题关键表必须全部存在；
- 不得出现未登记的 `NOT VALID` 约束；
- 任何受表字段拥有的序列不得落后于当前字段最大值。

## 已知遗留约束

以下约束为 forecast 历史数据兼容而保持 `NOT VALID`，但仍约束所有新写入；体检将其报告为 warning：

- `forecast_calibration_snapshots_qualified_source_check`；
- `ck_forecast_verified_manifest_required`。

不得按模式、表名或数量宽泛放行新的未验证约束；新增例外必须说明历史原因、验证计划和移除条件，并更新策略测试。

## 聚合快照

体检保存数据库大小、public 表数和 `pg_stat_user_tables` 近似行数，用于迁移前后差异审查。报告不读取或保存用户明细、题目内容、附件内容、token、密码哈希或 Provider 密钥。

核心表为空默认是 warning：新环境可能为空，但真实 CSCALite 迁移出现空的 users、csca_questions 或 agent_conversations 时必须由负责人确认。
