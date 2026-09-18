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

真实 Windows 彩排已完成：Docker 环境检查通过；97 条迁移成功部署且重复执行无待处理项；演示数据幂等生成；稳定后端与 Vite 前端成功启动；启动器内验证和独立 `local:verify` 均返回 pass；停止后 3100/5190 无监听残留。彩排过程中修复了带空格 Node 路径被 shell 截断、旧 backend watcher 自重启导致健康超时两项问题。

## 已完成：Phase 5B alpha.3 发布验收

- 从候选提交 `6f5904f` 创建无硬链接干净克隆，不复用现有依赖、构建产物或工作区状态；
- 根、后端和前端三段 `npm ci` 全部成功，安装与独立安全审计均报告 0 个已知漏洞；
- 本地交付静态契约、完整 `ci:contracts` 和发布身份检查全部通过；
- 学生训练、做题不中断的教学联动、独立 Authoring 发布三条浏览器黄金路径全部通过；
- 已创建不可变标签 `v0.1.0-alpha.3`，指向 `6f5904f`；
- 标签纳入一键 Windows 本地交付、隔离基础设施、幂等演示数据与运行验证能力；未配置远程仓库、未推送，也未连接真实业务数据库。

## 已完成：Phase 6A 独立仓库主权切换

- Moodlelike 仓库被定义为后续产品开发的唯一 authoritative source，不再把 CSCALite 视为代码上游；
- 目标仓库不再包含历史提取程序，包描述从“提取产物”改为独立 AI 教学与训练平台；
- 新增 `REPOSITORY_OWNERSHIP.md`，明确变更方向、历史材料边界和兼容债务处理原则；
- 新增 `test:repository-ownership` 并纳入 `ci:contracts`，阻止提取器、旧工作区绝对路径或提取身份重新进入活动运行面；
- 历史设计记录可继续提及 CSCALite，现有 `CSCA_*` 环境名与数据库类型作为显式兼容债务保留，不在本阶段破坏性重命名。

## 已完成：Phase 6B 独立黄金路径入口收口

- Demo Gate、Agent Live、附件 Live、教学 Live 与手写引导 Live 的默认地址统一到前端 `5190`、后端 `3100`；
- 四份仍用于复现的 Agent 操作文档不再要求进入旧 CSCALite 目录或运行旧启动器；
- 新增 `LIVE_GOLDEN_PATH.md` 作为独立仓库当前真实接口验收入口，明确真实 Provider 成本与确定性 `ci:golden` 的边界；
- 新增 `test:live-golden-path-contract` 并纳入 `ci:contracts`，阻止旧端口、旧绝对路径和旧启动命令重新进入活动验收面；
- 历史架构记录中的旧路径继续作为事实证据保留，不被当作当前操作说明。

## 已完成：Phase 6C 根命令面治理

- 331 个根命令全部进入机器可读分类：产品核心 41、题目生产 202、平台契约 41、兼容运维 47，未分类为 0；
- 新增 `audit:command-surface` 与确定性 `artifacts/command-surface.json`，检查根命令调用关系、脚本文件存在性、重复命令和总量预算；
- 删除与 `agent:build` 完全重复的旧 `build` 别名，`verify:quality` 不再重复构建前后端；
- 删除无法形成完整插件的 `question-engine:plugin-bundle`、指向不存在服务器的 `question-engine:plugin-self-test` 及孤立 bundle 脚本；
- 修复 `question-engine:portable-test` 的隐式构建依赖，并将 question-engine 构建入口改为跨平台 npm 命令；
- 题目生产命令不因数量多而被误删；兼容运维命令进入后续逐项退役清单，不得直接用于真实生产或学生数据。

## 已完成：Phase 6D 兼容运维隔离

- 46 个兼容运维入口进一步分为：旧发布链阻断 14、受控数据写入 7、本地/一次性数据安全 4、旧运行时 3、保留验证 18，未分类为 0；
- 旧 CSCALite Docker、Staging、Release、旧端口和占位 dump 链不再执行真实实现，命令名仅作为安全哨兵保留；
- 安全哨兵无环境变量绕过，误执行会明确失败并指向 `local:acceptance`、`ci:contracts`、`ci:golden` 和数据切换清单；
- 删除已由当前后端构建完全覆盖的 `backend:build:with-prisma` 根入口；
- 新增 `COMPATIBILITY_OPERATIONS.md`、确定性风险清单和 CI 审计，真实数据写入仍需独立授权。

## 已完成：Phase 6E 旧运维实现退役

- 对旧 Release、Staging、Docker、备份与 smoke 链进行反向引用审计，确认其实现只被已阻断链路或历史文档引用；
- 删除 10 个不可达的 CSCALite 运维实现，避免旧端口、旧 Compose 身份和旧占位数据路径继续构成潜在执行面；
- 保留 14 个旧命令名作为不可绕过的安全哨兵，使历史说明被误执行时仍明确失败并引导到当前入口；
- 新增 `docs/ARCHIVED_CSCA_OPERATIONS.md`，并为通用命名的旧运维、备份文档增加醒目归档声明；
- 兼容运维审计现在同时阻止旧实现复活、哨兵被改回可执行命令以及归档警告被移除。

## 已完成：Phase 6F 平台运行环境命名迁移

- `MOODLELIKE_ENV` 成为本地启动、生产模板、Compose 与后端镜像的规范平台环境变量；
- 后端生产判断集中到共享 helper，并保留 `CSC_ENV` 与 `NODE_ENV` 安全信号，任一标记为 production 都不会绕过保护；
- 演示数据、教学彩排和 BYOK 检查同步识别 `MOODLELIKE_ENV`，避免新命名削弱写入保护；
- 开发与生产环境模板不再主动写入 `CSC_ENV`，旧变量只作为迁移期回退读取；删除无代码消费者的 `CSC_REDIS_PORT` 示例项；
- 新增静态环境迁移契约并接入 `test:local-delivery`，阻止部署模板或安全检查退回旧平台命名。

## 已完成：Phase 6G 部署与会话身份收口

- 生产 Compose 模板的镜像、数据库默认值、卷和 HTTP 端口覆盖名统一为 Moodlelike；
- 后端、前端、容器构建与环境模板的 Refresh、CSRF、OAuth State Cookie 默认名保持一致；
- 认证回退域名、邮件主题与正文改为 Moodlelike，当前生产示例不再指向 CSCAPilot 域名；
- 新增 `DEPLOYMENT_IDENTITY.md`，明确新卷不会自动迁移旧数据、Cookie 改名会开启新会话命名空间，真实切换仍需单独授权；
- 新增部署身份契约并接入现有本地交付门禁，旧发布命令仍保持阻断，不因模板净化而恢复。

## 已完成：Phase 6H 浏览器身份与可见品牌迁移

- 学生端、账户页、管理端、认证邮件、附件分析提示词和 Demo 报告统一使用 Moodlelike 品牌；
- 登录令牌、用户缓存、语言偏好、Agent 布局、学习模式、自由练习偏好、题目语言和手写会话键切换为 Moodlelike 命名空间；
- 旧 `cscalite.*`/`cscalite:*` 浏览器值采用首次读取复制、写新删旧的单向迁移，退出登录同时清理两代认证键；
- 新增共享存储迁移 helper、`BROWSER_IDENTITY_MIGRATION.md` 和静态契约，旧键只允许出现在显式迁移文件中；
- 数据库标识、CSCA API 路径和 Prometheus metric 名保持兼容，不在浏览器身份阶段破坏性改名。

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

当前后端与前端锁文件安全审计均为 0 个已知漏洞；动态注册表门禁仍需在每个候选版本重新运行。
