# Agent 产品独立状态

## 已完成：Phase 1 可运行隔离

- 新仓库根目录与独立 package identity；
- 独立前后端启动端口；
- 独立 PostgreSQL、Redis 容器名称、端口和数据卷；
- 默认前端入口切换到 Agent；
- 后端根模块只装配 Agent 所需的认证、个人设置、训练、模考、真题、学习智能和健康检查；
- 保留完整 Prisma 迁移历史，避免切断现有 Agent 数据契约；
- 排除密钥、本地数据、上传、依赖和构建产物。

## 已完成：Phase 2A Agent 专用前端壳

- `StandaloneAgentApp` 取代通用站点 `App` 成为前端入口；
- 只保留 Agent、登录注册、首次学习档案和个人/学习设置四类路由；
- 未识别路径统一回到 Agent，不再进入公开站或旧训练页面；
- 四类工作区按路由懒加载；
- 旧公开站和后台页面不再进入生产构建图，但源码暂时保留以便审计后删除。
- 个人设置已替换为轻量账号页，只保留显示名、邮箱验证、密码重置、机构、额度和退出；学习目标与学习方式继续留在 Agent 学习设置。

## 已完成：Phase 2B 前端生产边界清理

- 从 `src/main.tsx` 追踪静态导入、动态导入、再导出和 CSS 引用，并输出可审计报告；
- 初始报告为 290 个源文件、76 个生产可达、214 个不可达；
- 已从独立项目物理删除 71 个明确属于旧公共站、商城、咨询、旧账户中心和旧训练入口的文件；
- 清理后为 219 个源文件、76 个生产可达、143 个保留但不可达；
- 后台内容生产工作台和教学/模拟动画源码暂时保留，作为题目运营控制面与未来教学能力候选，不混入学生生产构建；
- `test:minimal` 已改为独立产品边界测试，不再校验 CSCALite 旧首页。

## 仍然保留的兼容代码

剩余不可达文件主要是后台内容生产工作台和教学可视化资产。它们未进入学生端生产构建，但直接删除会提前丢失未来题库运营、教学动画和模拟教学能力，因此应在后续拆成独立 admin/authoring 入口或 teaching-asset 包后再决定去留。

## Phase 2C 建议

1. 为内容生产建立独立 admin/authoring 入口，避免与学生 Agent 入口混合；
2. 将教学动画收敛为 teaching-asset registry，并从聊天区按事件打开；
3. 将训练、题库、学习证据和教学资产重命名为通用领域模块；
4. 按 Prisma 模型实际引用拆出 Agent schema 基线；
5. 建立从 CSCALite 到 Moodlelike 的一次性数据迁移和回滚脚本；
6. 为独立仓库建立 Agent 黄金路径 CI。

## 已完成：Phase 2C 第一轮领域边界

- 前端已分为 76 个学生 Agent 文件、91 个 admin/authoring 文件和 52 个 teaching-assets 文件；
- 后端从 `AppModule` 出发共 207 个运行可达文件；
- 已删除完全不可达且不属于产品未来方向的商城、支付、咨询、留学内容、搜索和旧公开内容模块，共 24 个后端文件；
- `ops` 与 `score-calibration` 暂时保留，等待控制面与学习评估边界确认；
- Prisma 共 147 个模型，静态审计筛出 34 个复核候选；未自动删除任何模型或迁移；
- 详细职责写入 `PRODUCT_BOUNDARIES.md`，机器可读证据写入 `artifacts/product-boundary-audit.json`。

## 已完成：Phase 2D Teaching Asset Registry

- 三种已审核交互模拟统一注册为带版本的 capability；
- Agent 页面不再直接依赖具体微课组件，统一通过 `TeachingAssetRenderer` 分发；
- 后端下发 `capability`，明确资产类型、展示面、主任务保持和掌握度规则；
- 主任务存在时教学内容留在聊天辅助面，做题区与进度不被替换；
- 未知资产使用可恢复 fallback，不会导致 Agent 页面崩溃；
- 新增跨前后端 registry 契约测试与 `TEACHING_ASSET_REGISTRY.md`。

## 已完成：Phase 2E 独立 Authoring 入口

- 新增独立 `authoring.html` 与 `AuthoringApp`，由 Vite 作为第二个 HTML 入口构建；
- 第一阶段只提供题目生产/审核/发布和教学资产管理两个工作区；
- Authoring 工作区按需加载，学生 `main.tsx` 不导入 Authoring；
- 未登录用户在 Authoring 内登录，非管理员显示拒绝页；
- 题目和教学资产 API 均继续由服务端 `RequiredAdminGuard` 保护；
- 控制面使用精简导航，不恢复 CSCALite 旧后台的其他业务入口；
- 详细边界见 `AUTHORING_BOUNDARY.md`。

## 已完成：Phase 2F CI 与黄金路径

- 新增独立项目 GitHub Actions；
- contracts 门禁覆盖构建、Agent runtime、学生入口、教学资产、Authoring 和产品边界审计；
- 浏览器黄金路径覆盖推荐任务做题、做题中打开教学、Authoring 发布教学资产；
- 浏览器测试使用确定性 fixture，不依赖真实模型、用户数据或 CSCALite 数据库；
- 失败时上传 Playwright trace、截图与边界审计报告；
- 详细说明见 `CI_GOLDEN_PATHS.md`。

## 已完成：Phase 3A 数据迁移安全基线

- 生成 Prisma 模型保留矩阵，初次迁移坚持 `copy-all-first-prune-later`，不根据静态引用直接删表；
- 提供独立的迁移 plan/apply 与 rollback plan/apply 命令，默认只输出计划，不连接或修改数据库；
- apply 要求源、目标数据库显式配置，并要求确认值与目标数据库名完全一致；
- 默认只允许本机目标；远程目标必须额外显式开启，且回滚执行同样的限制；
- 迁移前先备份目标，再导出源库、恢复至目标，并写入可审计 manifest；
- 回滚只能使用同一迁移目录内、目标身份完全匹配的备份；
- 命令参数不经 shell 展开，日志中的连接密码会被遮蔽；
- CI 只运行策略自测和模型矩阵生成，不执行真实迁移。

本阶段没有读取、写入或删除任何真实业务数据。操作步骤与演练门禁见 `DATA_MIGRATION_RUNBOOK.md`。

## 已完成：Phase 3B 隔离迁移与精确回滚演练

- 使用专用临时 PostgreSQL 16 容器和两个纯测试数据库完成演练，不复用开发数据库、容器或数据卷；
- 在源测试库完整部署 97 条 Prisma 迁移，得到 149 张 public 表（含 Prisma 记录表和测试探针）；
- 迁移后源/目标表数量一致，源探针 2 行完整复制，目标迁移前哨兵表被清除；
- 回滚后目标哨兵恢复为 1 行，迁移源探针表完全消失，证明回滚是精确替换而非叠加恢复；
- 发现并修复 Prisma `schema=public` URL 参数与 `pg_dump` 不兼容的问题；
- 迁移和回滚在恢复前显式重建目标 `public` schema，避免 `pg_restore --clean` 遗留额外对象；
- 临时容器已删除；匿名容器文件系统不可恢复，测试 dump、manifest 与脱敏证据保留在独立项目的 `.local`/`artifacts` 中；
- 可重复命令为 `npm run data:rehearsal:plan` 和 `npm run data:rehearsal:apply`。

演练证据见 `artifacts/phase3b-data-rehearsal.json`。本阶段仍未连接或复制真实 CSCALite 业务数据。

## 已完成：Phase 3C 数据质量体检与切换门禁

- 新增只读 `npm run data:preflight`，在 `BEGIN READ ONLY` 中检查 PostgreSQL 版本、关键表、Prisma 失败迁移、未验证约束、序列落后和表规模快照；
- 报告只包含数据库身份、结构与聚合数字，不导出用户行或业务内容，连接凭据会被遮蔽；
- PostgreSQL 低于 16、关键表缺失、失败迁移、意外的未验证约束或序列落后均会阻断切换；
- 两条历史 forecast `NOT VALID` 约束按精确名称登记为已知遗留警告，其他新增未验证约束仍阻断；
- 隔离演练已证明健康基线通过、人为加入的未验证约束被阻断、移除异常后重新通过；
- 切换条件、冻结窗口、失败处置与回退决策见 `DATA_CUTOVER_CHECKLIST.md`；业务不变量见 `DATA_INVARIANTS.md`。

本阶段仍未连接真实业务数据库；执行真实 preflight 需要用户显式提供只读连接。

## 已完成：Phase 3D 独立发布基线

- 根、后端、前端和 question-engine 统一为 Moodlelike package identity 与 `0.1.0-alpha.1`；
- 锁文件中的 CSCALite workspace 元数据同步收口，Node.js 基线固定为 22；
- 新增 `VERSION`、私有源码许可提示、Security Policy、环境契约、Release Baseline 和 Git 属性；
- 来源声明不再暴露本机绝对路径，并明确独立仓库采用新的 Git 历史；
- 环境审计只扫描当前可达运行时，生成不含变量值的清单，并阻止示例文件出现疑似真实 secret；
- 发布门禁拒绝真实 `.env`、dump、私钥、缺失关键文档和包身份漂移；
- 旧 `CSCA_*`/`CSCALITE_*` 名称作为兼容契约保留，后续采用 alias/deprecation 迁移，不做破坏性批量重命名。

## 已完成：Phase 4A 干净检出可复现性验证

- 从首个独立提交 `b362288` 创建无硬链接干净克隆，不复用独立项目目录中的依赖或构建产物；
- 在干净克隆中分别执行根、后端和前端三段 `npm ci`，锁文件安装全部成功；
- 在干净克隆中执行完整 `npm run ci:contracts`，前后端构建、Prisma 生成、Agent runtime、壳层、教学资产、迁移策略、边界审计、环境审计和发布检查全部通过；
- `v0.1.0-alpha.1` 标签指向实际接受该验证的提交；
- 安装期 npm audit 观察到后端 10 项、前端 8 项上游依赖风险，未执行可能造成破坏性升级的自动修复，转入独立供应链治理阶段。

详细证据和复现命令见 `CLEAN_CHECKOUT_VERIFICATION.md`。

## 已完成：Phase 4B 非破坏性供应链修复

- 后端 Nest 保持 11.x、Express 保持 4.x，前端 Vite 保持 7.x，不采用强制主版本升级；
- 直接依赖升级到 Nest 11.2.5、Express 4.22.3、Vite 7.3.6，并刷新锁文件允许范围内的传递依赖；
- Multer、body-parser、qs、fast-uri、js-yaml、brace-expansion、Babel、PostCSS、esbuild、nanoid 等风险链均更新到修复版本；
- 后端和前端 `npm audit` 均由非零风险降至 0；
- 新增 `npm run security:audit-dependencies`，GitHub CI 在构建与浏览器测试前阻断新增 high/critical 风险；
- 动态注册表审计不并入本地离线 `ci:contracts`，以保持核心契约可离线复现。

详细矩阵见 `SUPPLY_CHAIN_STATUS.md`。

## 已完成：Phase 4C alpha.2 发布验收

- 从候选提交 `973ff57` 创建无硬链接干净克隆并执行根、后端、前端三段 `npm ci`；
- 三段安装与独立安全门禁均报告 0 个已知漏洞；
- 干净克隆完整 `ci:contracts` 通过；
- 学生任务创建、做题不中断的教学辅助、独立 Authoring 发布三条浏览器黄金路径全部通过；
- 已创建不可变标签 `v0.1.0-alpha.2`，指向 `973ff57`；
- 未配置远程仓库、未推送，也未连接真实业务数据库。

## 已完成：Phase 5A 独立本地交付入口

- 新增统一 Node 编排器，Windows 批处理、PowerShell 与 npm 均委托同一实现；
- `local:doctor` 检查 Node.js 22、npm、Docker Compose 和依赖安装状态；
- `local:setup` 只操作 Moodlelike 的数据库、缓存、迁移和幂等演示数据；
- `local:start` 启动前后端、等待健康、验证产品身份和专用演示账号，并保持进程附着便于 Ctrl+C 停止；
- `local:verify` 覆盖健康、Agent 壳、登录、当前用户和会话 API；
- `local:acceptance` 串联真实运行验证、安全审计、核心契约和三条浏览器黄金路径；
- 后端健康身份改为 `moodlelike-backend`，演示账号与演示资产不再使用 CSCALite/CSCAPilot 品牌；
- 本地交付静态契约纳入 `ci:contracts`。

## 已完成验证

- 根、后端和前端依赖均在本目录独立安装；
- `npm run agent:build` 通过；
- `npm --prefix backend run test:agent-runtime` 通过；
- `npm --prefix frontend run test:minimal` 通过；
- `npm --prefix frontend run test:standalone-shell` 通过；
- `npm --prefix frontend run audit:standalone-reachability` 已生成审计报告；
- `npm run audit:product-boundaries` 已生成前端、后端与 Prisma 边界报告；
- `npm run test:teaching-assets` 通过；
- `npm run test:authoring-boundary` 通过；
- `npm run test:ci-contract` 通过；
- `npm run test:data-migration-policy` 通过；
- `npm run audit:prisma-retention` 已生成模型保留矩阵；
- `npm run data:rehearsal:apply` 已完成隔离迁移与回滚闭环；
- `npm run test:data-preflight-policy` 与隔离环境中的 clean/blocked 双探针通过；
- `npm run audit:environment-contract` 和 `npm run release:check` 通过；
- 构建链已固定跨包题目引擎产物位置，生产入口为 `backend/dist/backend/src/main.js`。

依赖安装报告仍包含上游 npm audit 风险，尚未执行可能引入破坏性升级的自动修复；应在 Phase 2 单独评估和升级。
