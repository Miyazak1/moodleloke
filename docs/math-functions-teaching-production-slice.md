# 数学函数教学闭环生产纵切

## 目标

把现有“真实作答证据 → 学习决策 → 教学资产 → 即时/保持/迁移验证 → 下一步”链路，从本地演示推进到可灰度的生产能力。第一纵切只覆盖一个正式知识点：

- `M-FUNC-001` 函数的概念与性质。

真实题库复核显示，`M-FUNC-002` 和 `M-INEQ-001` 当前分别只有 5 道和 4 道符合学生端四选一契约的普通练习题，因此保留为下一批扩展，不进入首批投放门禁。

## 资产

| 知识点 | 首发资产 |
| --- | --- |
| `M-FUNC-001` | `visualizer.math.function-transform` |

教学资产完成只表示发生过教学互动，不直接提高掌握度。稳定掌握仍要求即时、保持和迁移三个阶段使用未曝光题独立验证。

## 生产阶段

### 1. Shadow

- `CSCA_LEARNING_INTERVENTION_SHADOW_ENABLED=true`
- `CSCA_LEARNING_INTERVENTION_DELIVERY_ENABLED=false`
- `CSCA_LEARNING_INTERVENTION_VERIFICATION_ENABLED=false`
- `CSCA_LEARNING_INTERVENTION_ROLLOUT_MODE=shadow`
- Intervention Active 科目、知识点和比例均为空或 0
- `CSCA_AGENT_TEACHING_ASSET_ROUTING_MODE=shadow`
- Active 科目为空、比例为 0

此阶段只生成干预建议，不向学生展示。重点复核知识点判断、内容匹配、题源容量和触发时机。

### 2. 内部投放

只有只读门禁通过且 Shadow 人工复核合格后，才启用 Delivery 与 Verification。内部阶段必须设置：

- `CSCA_LEARNING_INTERVENTION_ROLLOUT_MODE=internal`
- `CSCA_LEARNING_INTERVENTION_INTERNAL_USER_IDS=<内部用户数字 ID，逗号分隔>`
- `CSCA_LEARNING_INTERVENTION_ACTIVE_SUBJECTS=math`
- `CSCA_LEARNING_INTERVENTION_ACTIVE_TOPIC_CODES=M-FUNC-001`
- `CSCA_LEARNING_INTERVENTION_ACTIVE_PERCENT=0`
- TeachingAsset 路由继续保持 `shadow`，公开激活科目为空、比例为 0

非白名单账号不会创建讲解 Delivery，也不会从旧的已完成记录创建验证任务。已经开始的任务允许安全完成，避免开关切换破坏学习记录。
Internal 门禁还会只读检查白名单中的用户 ID 是否全部存在且状态为 `active`；输出只报告数量，不打印具体账号。

每次存在可投放建议时都会幂等记录 `learning_intervention_rollout_decision` 训练事件，包含阶段、知识点、稳定分桶、是否入组和原因码；已入组的同一份信息还会写入 Delivery 的 `contextSnapshot.interventionRollout`，便于核验白名单隔离和 Canary 边界。

### 3. 数学小流量

干预与教学资产路由切换为 `canary/active` 时必须同时设置：

- `CSCA_LEARNING_INTERVENTION_ROLLOUT_MODE=canary`
- `CSCA_LEARNING_INTERVENTION_ACTIVE_SUBJECTS=math`
- `CSCA_LEARNING_INTERVENTION_ACTIVE_TOPIC_CODES=M-FUNC-001`
- `CSCA_LEARNING_INTERVENTION_ACTIVE_PERCENT=1`（首次只开 1%）
- `CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_SUBJECTS=math`
- `CSCA_AGENT_TEACHING_ASSET_ROUTING_ACTIVE_PERCENT=1`

扩大比例必须基于效果与安全数据人工决定，系统不得自动扩量。

## 发布门

Shadow 配置验收：

`node scripts/agent-teaching-production-readiness.cjs --strict --expect-stage shadow`

内部账号配置验收：

`node scripts/agent-teaching-production-readiness.cjs --strict --expect-stage internal`

切换 1%–5% 数学灰度配置后再次验收：

`node scripts/agent-teaching-production-readiness.cjs --strict --expect-stage canary`

正常生产部署会在数据库迁移、模考和专项题确保完成后，幂等执行 TeachingAsset 发布。若需单独重放资产发布：

`docker compose -p moodlelike-next --env-file .env -f deploy/docker-compose.prod.yml run --rm migrate node backend/scripts/seed-teaching-assets.cjs`

12 道验证题的精确内容哈希、重算答案、讲解和任务结构记录在 `docs/csca-math-function-verification-curation-v1.json`。部署会幂等应用；单独预检或重放使用：

`docker compose -p moodlelike-next --env-file .env -f deploy/docker-compose.prod.yml run --rm migrate node scripts/apply-math-function-verification-curation.cjs`

`docker compose -p moodlelike-next --env-file .env -f deploy/docker-compose.prod.yml run --rm migrate node scripts/apply-math-function-verification-curation.cjs --apply`

生产服务器应直接在 backend 容器内执行，以复用容器中的数据库连接和实际开关：

`docker compose -p moodlelike-next --env-file .env -f deploy/docker-compose.prod.yml exec backend node scripts/agent-teaching-production-readiness.cjs --strict --expect-stage shadow`

每个知识点必须同时满足：

- 正式大纲知识点存在且为 `published`；
- 对应 TeachingAsset 和中文版本已发布；
- 至少 12 道符合学生端正式选题策略的普通练习候选题；
- 至少 12 道经内容复核和答案重算、允许用于独立测量的验证候选题；
- 即时、保持和迁移阶段各能选出 3 道题；
- 迁移阶段存在不同于前两阶段的任务签名；
- 基础学习证据、投影、Gap、Prescription、Intervention Shadow 和 TeachingAsset 开关已启用；
- TeachingAsset 路由处于 `shadow` 或受控 `active`，不能停留在 `legacy`。
- Shadow 阶段必须关闭 Delivery 与 Verification，且激活科目为空、比例为 0；
- Internal 阶段必须有非空用户白名单，且范围精确限制为 `math + M-FUNC-001`；
- 首次 Canary 必须只激活 `math`，开启 Delivery 与 Verification，比例限制为 1%–5%。

门禁是只读检查，不生成题目、不发布资产、不改变掌握度。

## 回退

出现内容错配、供应不足或异常干预时：

1. 关闭 Delivery 与 Verification；
2. Intervention Rollout 与 TeachingAsset 路由退回 `shadow`，清空激活范围并把比例设为 0；
3. 保留已产生的正式作答和学习证据；
4. 不回滚学生答案、成绩或已完成任务。
