# Moodlelike 产品代码边界

## 1. 学生 Agent 运行面

- 唯一前端生产入口：`frontend/src/main.tsx -> StandaloneAgentApp`；
- 学生可进入 Agent、认证、首次档案和个人设置；
- 做题、学习计划、学习历程、错题薄弱点、真题与学习设置均属于 Agent 工作区；
- 当前生产依赖由 `frontend/artifacts/standalone-reachability.json` 给出。

## 2. Admin / Authoring 控制面

- 题目生成、审核、发布、教学资产管理和运营审计属于控制面；
- 代码可以暂时保留，但不得从学生入口加载；
- 后续应建立独立入口、独立权限门和独立构建，而不是恢复 CSCALite 通用站点路由器。

## 3. Teaching assets 教学资产面

- 动画、交互模拟、微课和视频是可被 Agent 调度的教学资产；
- 教学资产不能取代或打断做题区，应由聊天区触发并在独立辅助面板展示；
- 下一步需建立统一 registry、能力元数据、知识点映射和打开事件契约。

## 4. 后端运行边界

- 后端只从 `AppModule` 装配认证、个人设置、训练、模考、真题、学习智能、Agent 与健康检查；
- 商城、支付、咨询、留学内容、搜索和旧公开内容模块已从独立项目物理移除；
- `ops` 与 `score-calibration` 暂时保留，分别等待控制面和学习评估边界确认。

## 5. 数据边界

- Prisma schema 暂时保持迁移兼容，不根据静态扫描自动删表；
- `artifacts/product-boundary-audit.json` 记录模型引用证据和复核候选；
- 模型删除必须同时满足：运行不可达、无关系依赖、无原始 SQL、无迁移/回滚需求、迁移演练通过。

## 6. 可重复审计

`npm --prefix frontend run audit:standalone-reachability`

`npm run audit:product-boundaries`
