# Agent 产品独立拆分计划

> 状态：Phase 1 completed；Phase 2A/2B frontend boundary completed
>
> 日期：2026-09-17
>
> 目标目录：`E:\CODE\moodlelike`

## 1. 目标

将当前 CSCALite Learning Agent 独立为可以单独安装、迁移、构建和启动的产品代码库，同时保持现有 CSCALite 仓库可运行且不被新产品的开发过程修改。

独立不等于只复制 `frontend/src/pages/AgentPage.tsx` 和 `backend/src/agent/`。当前 Agent 的真实能力还依赖认证、个人学习设置、自适应训练、模考、真题、学习智能、AI Gateway、题目供应以及统一 Prisma 数据模型。这些依赖构成第一版 Agent 产品的训练内核。

## 2. 拆分策略

采用两阶段绞杀式拆分：

### Phase 1：可运行隔离

- 复制源码、迁移、必要脚本和文档，但不复制 `.env`、上传、数据库、依赖、构建产物和 Git 元数据；
- 使用独立包名、端口、Docker Compose 项目、数据库和数据卷；
- 前端默认进入 Agent；
- 后端根模块仅装配 Agent 当前真实依赖；
- 完成前后端构建验证。

### Phase 2：代码边界收口

- 建立 Agent 专用前端壳并删除旧站路由；
- 根据导入图删除不可达后端模块；
- 将带 `csca-*` 名称但已属于通用训练内核的模块逐步重命名；
- 收敛 Prisma schema，建立一次性数据迁移；
- 建立独立 CI、发布、备份和恢复流程。

## 3. Phase 1 保留模块

- `agent`
- `auth`
- `me`
- `prisma`
- `csca-special-practice`
- `csca-mock-exam`
- `past-papers`
- `learning-intelligence`
- `csca-learning`
- `ai-gateway`
- `ai-questioning`
- 上述模块的直接依赖与公共基础代码

这些模块保留不代表长期命名和边界已确定，只表示它们是当前 Agent 黄金路径的实际运行依赖。

## 4. 安全约束

- 不复制源仓库 `.env`；
- 不复制本地附件、上传文件和数据库备份；
- 不复制 `node_modules`、`dist` 和测试产物；
- 不复用 CSCALite Docker 数据卷；
- 不在拆分过程中删除或移动 CSCALite 源文件；
- 在新仓库构建通过前，不把其作为唯一开发入口。

## 5. Phase 1 验收

- `E:\CODE\moodlelike` 不依赖 CSCALite 的相对路径；
- 后端和前端可在新目录独立安装依赖并构建；
- 数据库、Redis 和服务端口不与 CSCALite 默认开发环境冲突；
- 根路径可以进入 Agent 产品；
- 登录、下一步、练习、真题、教学、学习历程与设置所需后端模块已装配；
- 源 CSCALite 工作区不因拆分而删除或移动任何现有文件。

## 6. 执行结果

2026-09-17 已在 `E:\CODE\moodlelike` 完成 Phase 1：

- 独立安装根、后端和前端依赖；
- 前端与后端完整构建通过；
- Agent runtime today-plan 契约测试通过；
- 前端 minimal 契约测试通过；
- 修正跨仓库 `question-engine` 导致的嵌套构建产物路径，构建前会清理旧 `dist`，生产入口固定为 `backend/dist/backend/src/main.js`；
- 新项目默认端口为前端 `5190`、后端 `3100`、PostgreSQL `56432`、Redis `57379`。

本阶段没有启动新数据库或迁移 CSCALite 现有用户数据；数据迁移属于后续独立任务。

## 7. Phase 2A：Agent 专用前端壳

2026-09-17 已完成独立前端入口：

- `frontend/src/main.tsx` 直接加载 `StandaloneAgentApp`，不再加载通用站点 `AppRouteRenderer`；
- 学生运行时只识别 Agent、认证、首次设置和个人/学习设置；
- 首页、未知路径和已下线旧学习路径统一收口到 Agent；
- Agent、认证、首次设置和账户设置使用动态导入；
- Vite 生产构建不再生成公开站、咨询和后台管理页面的独立 chunk；
- 旧 `PublicMePage` 不再进入运行时，头像入口使用轻量个人设置页；该页面只管理账号、邮箱验证、密码重置、机构、额度与退出，学习偏好继续由 Agent 内的学习设置管理；
- 新增 standalone shell 契约测试，防止入口重新依赖通用路由器或旧个人中心；
- 旧源码暂时保留，但不属于新产品运行时，待静态依赖清单确认后再物理删除。

## 8. Phase 2B：前端生产边界清理

2026-09-17 已完成第一轮物理收口：

- 新增从 `src/main.tsx` 出发的生产依赖审计，覆盖静态导入、动态导入、再导出与 CSS `@import`；
- 审计结果写入 `frontend/artifacts/standalone-reachability.json` 和 `standalone-unreachable.txt`；
- 初始统计：290 个源文件，76 个生产可达，214 个不可达；
- 通过显式白名单，从独立项目删除 71 个旧公共站、商城、咨询、旧账户中心与旧训练入口文件；
- 清理后统计：219 个源文件，76 个生产可达，143 个保留但不可达；
- 后台题目/内容生产工作台与教学、模拟动画源码暂时保留。它们不进入学生端构建，但对应未来运营控制面和教学能力，不能按“当前不可达”等同于“无价值”；
- `test:minimal` 已替换为独立产品边界契约，构建、minimal 与 standalone-shell 测试均通过。

下一步进入 Phase 2C：先把剩余 143 个文件分成 `admin/authoring`、`teaching-assets` 与真正废弃三组，再做后端模块可达性和 Prisma 数据边界审计。

## 9. Phase 2C：领域边界与后端审计

2026-09-17 已完成第一轮：

- 前端剩余代码归类为 76 个学生 Agent 文件、91 个 admin/authoring 文件、52 个 teaching-assets 文件，已不存在未归类的废弃候选；
- 从后端 `AppModule` 出发建立 TypeScript 可达性图：清理前 269 个文件中 207 个可达、62 个不可达；
- 从独立项目删除完全不可达且与未来训练/教学平台无关的商城、支付、咨询、留学内容、搜索和旧公开内容六个领域，共 24 个文件；
- `ops` 与 `score-calibration` 暂时保留，分别等待后台控制面和学习评估能力确认；
- Prisma 147 个模型中，静态引用审计给出 34 个复核候选。该结果只用于人工审查，不构成删表授权；关系字段、原始 SQL、历史迁移和回滚仍需逐项验证；
- 新增 `PRODUCT_BOUNDARIES.md`，明确学生运行面、内容生产控制面、教学资产面、后端和数据边界。

下一步应为 teaching assets 建立统一 registry 与 Agent 打开事件契约，然后再拆出独立 admin/authoring 入口；数据层则先制作模型保留矩阵与迁移演练，不直接裁剪 schema。

## 10. Phase 2D：Teaching Asset Registry

2026-09-17 已完成第一版统一教学资产注册表：

- 数学函数平移、物理牛顿第二定律、化学酸碱中和三种交互模拟使用稳定的 `component-key@version` 注册；
- 后端 presentation 响应增加 capability，明确 `surface=assistant`、`preservesPrimaryTask=true`、`completionChangesMastery=false`；
- Agent 页面不再直接引用 `FunctionShiftMicroLesson`，而是统一通过 `TeachingAssetRenderer` 分发具体渲染器；
- 当前有主任务时，教学资产留在聊天辅助面，做题面板、答案和进度不被替换；没有主任务时仍可在独立辅助工作区完成教学；
- 未知组件使用 fallback，提示客户端能力不足但不关闭当前任务；
- 新增跨前后端 registry 契约测试和 `TEACHING_ASSET_REGISTRY.md` 扩展规范。

下一步进入 Phase 2E：建立独立 admin/authoring 前端入口和权限边界，使题目与教学资产生产不再只是“保留但不可达”的代码。

## 11. Phase 2E：独立 Authoring 控制面

2026-09-17 已完成第一版：

- 新增 `authoring.html -> main-authoring.tsx -> AuthoringApp` 独立入口，并配置 Vite 多页面构建；
- 学生 Agent 入口不导入 Authoring 代码；
- 第一阶段只开放 AI 题目生产/审核/发布和教学资产管理两个工作区；
- Authoring 内完成管理员登录，非管理员账号只显示拒绝页；
- 服务端继续使用 `RequiredAdminGuard` 保护题目与教学资产接口，前端角色判断仅用于体验而非安全授权；
- 后台壳在 Authoring 模式下只显示两个生产工作区，不恢复旧商城、用户、机构、公开内容或旧训练管理导航；
- 新增 `AUTHORING_BOUNDARY.md` 和独立入口契约测试。

下一步进入 Phase 2F：建立独立项目的黄金路径 E2E 与 CI，包括学生训练路径、教学资产触发路径、Authoring 发布路径以及前后端边界审计。

## 12. Phase 2F：CI 与黄金路径

2026-09-17 已完成第一版自动门禁：

- 新增 `.github/workflows/standalone-ci.yml`，在 push 与 pull request 运行；
- contracts 层覆盖完整构建、Agent runtime、学生入口、Teaching Asset Registry、Authoring 权限边界、CI 自检和产品边界审计；
- 复用现有 Agent 浏览器测试验证推荐任务在 Agent 内打开做题区；
- 复用现有教学干预浏览器测试验证做题区保持挂载、教学内容在聊天区打开；
- 新增 Authoring 浏览器黄金路径，验证管理员通过独立入口发布已审核教学资产；
- 三条浏览器路径均使用确定性网络 fixture，不连接 CSCALite 数据库、不调用付费模型、不读取本地 demo 凭据；
- CI 失败时上传 Playwright trace、截图和审计报告。

下一步进入 Phase 3A：制作 Prisma 模型保留矩阵和一次性数据迁移/回滚演练，在不删源数据的前提下验证独立数据库启动。

## 13. Phase 3A：数据迁移安全基线

2026-09-17 已完成可审计、默认只读的迁移工具链：

- 从 Prisma schema 和产品边界审计生成模型保留矩阵，分类为运行时保留、未来平台保留、旧域归档候选和人工复核；
- 初次迁移采用 `copy-all-first-prune-later`，矩阵不自动修改 schema、迁移历史或数据库；
- 新增迁移 plan/apply 与 rollback plan/apply 命令，默认模式只打印脱敏计划，不执行 `pg_dump` 或 `pg_restore`；
- apply 要求显式提供源库、目标库，并用目标数据库名做精确二次确认；源目标相同、确认不匹配和未授权远程目标均会拒绝；
- 执行迁移前先备份目标，之后导出 CSCALite、恢复到 Moodlelike，并在 `.local/data-migrations` 写入不含凭据的 manifest；
- 回滚限定为同一迁移目录内的目标备份，并再次校验数据库身份和确认值；数据库命令不经 shell 展开；
- CI 增加迁移策略自测和模型矩阵生成，但不会连接真实数据库或自动执行迁移；
- 新增 `DATA_MIGRATION_RUNBOOK.md`，明确一次性环境演练、验证和回滚门禁。

本阶段没有迁移、修改或删除真实业务数据。下一步进入 Phase 3B：在一次性 PostgreSQL 实例完成完整 apply → 应用验证 → rollback 演练，并输出不含隐私数据的完整性证据。

## 14. Phase 3B：隔离数据库迁移与回滚闭环

2026-09-17 已完成可重复的双库演练：

- 创建唯一命名的临时 PostgreSQL 16 容器，在其中使用 `source_phase3b` 和 `target_phase3b` 两个纯测试数据库；
- 源测试库成功部署完整 97 条 Prisma 历史迁移；
- 源库最终包含 149 张 public 表（包括 `_prisma_migrations` 和测试探针），迁移后目标库表数量严格一致；
- 源探针 2 行数据完整进入目标，目标原有哨兵表被删除，证明迁移是精确替换而非叠加；
- 回滚后目标哨兵 1 行恢复，迁移产生的源探针表消失，证明回滚可恢复迁移前目标状态；
- 演练过程中发现 Prisma URL 的 `schema=public` 不是 `pg_dump` 支持的连接参数，现已在数据库工具参数层安全剥离；
- 同时修复了 `pg_restore --clean` 不能删除备份外额外对象的问题：迁移和回滚均在备份完成、身份确认之后重建目标 `public` schema，再执行恢复；
- 演练结束后专用临时容器已删除，没有遗留容器或数据卷；测试 dump/manifest 留在独立项目 `.local`，脱敏结果写入 `artifacts/phase3b-data-rehearsal.json`；
- 新增 `npm run data:rehearsal:plan` 与 `npm run data:rehearsal:apply`，后续可一键重复验证。

本阶段仍未连接真实 CSCALite 业务数据库。下一阶段应进入 Phase 3C：建立真实迁移前的数据质量体检、行数/外键/关键业务不变量核对，以及切换窗口和失败处置清单；只有用户明确提供并确认数据库连接后才执行真实迁移。

## 15. Phase 3C：数据质量体检与切换门禁

2026-09-17 已完成第一版真实迁移前门禁：

- 新增 `npm run data:preflight`，所有 SQL 在 `BEGIN READ ONLY` 中执行；
- 自动检查 PostgreSQL 16 基线、关键 Agent 表、失败 Prisma 迁移、未验证约束、序列值落后、数据库大小和 public 表规模；
- 报告仅保存结构与聚合数字，连接字符串脱敏，不读取或导出用户、题目、附件和密钥内容；
- 阻断条件包括低版本数据库、空 schema、关键表缺失、失败迁移、意外 `NOT VALID` 约束和序列落后；
- 审计发现历史迁移中有两条为兼容 legacy forecast 行而刻意保留的 `NOT VALID` 检查。现按精确约束名登记为 warning，不采用宽泛放行；
- 隔离演练中，完整 schema 基线通过；人为新增一条未验证约束后体检按预期 blocked；删除探针后重新 passed；
- 新增 `DATA_INVARIANTS.md` 和 `DATA_CUTOVER_CHECKLIST.md`，覆盖写冻结、二人核对、迁移后应用验证、观察窗口、强制回退条件和同窗口禁止事项；
- 策略自测已纳入 `ci:contracts`。

本阶段没有连接真实业务库。下一阶段是 Phase 3D：完成独立仓库初始化、许可证/来源声明、环境密钥收口和首次可发布版本基线；真实数据预检与迁移必须等待用户提供只读/迁移连接并明确授权。

## 16. Phase 3D：独立仓库与首个发布基线

2026-09-17 已完成 `0.1.0-alpha.1` 私有预发布基线：

- 根包、后端、前端和 question-engine 统一使用 Moodlelike 身份，清理 lockfile 中旧 CSCALite workspace 名称；
- 所有包保持 `private=true`，Node.js 基线固定为 22，根包记录 npm 10.9.8；
- 增加 `VERSION`、`.nvmrc`、`.node-version`、`.gitattributes`、Security Policy、私有源码许可提示和 Release Baseline；
- 来源声明改为产品级来源，不记录本机 CSCALite 绝对路径，明确不复制原 Git 历史；
- 新增可达运行时环境变量审计，生成不含值的 JSON/Markdown 清单，并校验开发/生产示例中的必填变量和 secret 占位符；
- 新增发布门禁，拒绝真实 `.env`、dump、私钥、身份漂移、缺失文档和不安全示例值；
- `.env` 示例中的产品域名、管理员示例、Docker 验证名称和备份示例改为 Moodlelike；
- `CSCA_*`、`CSCALITE_*` 和 `CSC_ENV` 暂按版本化兼容契约保留，避免一次性重命名破坏已有配置；
- `ci:contracts` 纳入环境审计和发布基线检查。

独立目标目录随后初始化新的 `main` Git 历史；初始提交不得包含 `node_modules`、构建产物、`.local` 演练 dump、真实环境文件或原仓库 Git 元数据。

## 17. Phase 4A：干净检出可复现性门禁

2026-09-17 已完成首个独立版本的 clean-checkout 验证：

- 新仓库 `main` 根提交为 `b362288`，标签为 `v0.1.0-alpha.1`；
- 使用 `git clone --no-hardlinks` 创建全新临时副本，避免复用工作目录依赖、构建产物或本地状态；
- 根、后端和前端三段 `npm ci` 均从提交中的 lockfile 成功安装；
- 干净副本中的 `npm run ci:contracts` 全量通过，证明核心构建和契约门禁不依赖原 CSCALite 工作区；
- npm audit 在安装时观察到后端 10 项、前端 8 项依赖风险。未使用自动修复，避免未经评估的破坏性升级；风险进入下一阶段供应链治理；
- 验证方法、范围和后续要求沉淀在 `CLEAN_CHECKOUT_VERIFICATION.md`。

下一阶段优先处理 Phase 4B：对生产可达依赖做漏洞可达性分类和非破坏性升级，然后在干净副本补跑浏览器黄金路径。真实数据迁移仍需另行授权。

## 18. Phase 4B：供应链风险收口

2026-09-17 已完成不跨主版本的依赖安全升级：

- 后端从 10 项风险降至 0，保持 Nest 11 和 Express 4；
- 前端从 8 项风险降至 0，保持 Vite 7；
- 直接依赖升级为 Nest 11.2.5、Express 4.22.3、Vite 7.3.6，并通过 lockfile-compatible 更新修复其余传递依赖；
- 未执行 `npm audit fix --force`，未引入 Nest 12、Express 5、Vite 8 或其他强制主版本迁移；
- 新增 `security:audit-dependencies`，GitHub CI 在核心契约和浏览器黄金路径前执行 high/critical 阻断；
- 本地 `ci:contracts` 保持不依赖外网，动态 advisory 检查作为联网安全门禁独立执行；
- 版本与处置原则记录在 `SUPPLY_CHAIN_STATUS.md`。

下一步是用更新后的锁文件重新做 clean checkout，并补跑三个浏览器黄金路径；通过后形成 `0.1.0-alpha.2` 候选基线。

## 19. Phase 4C：alpha.2 发布验收

2026-09-17 已完成：

- 从提交 `973ff57` 创建全新无硬链接克隆；
- 根、后端、前端 `npm ci` 全部成功且审计为 0；
- `security:audit-dependencies` 与完整 `ci:contracts` 通过；
- 学生任务创建、做题不中断的教学辅助、独立 Authoring 发布三条浏览器黄金路径全部通过；
- 创建 `v0.1.0-alpha.2` 标签并固定指向 `973ff57`；
- 临时验证目录已清理，独立仓库工作区保持干净；
- 本阶段没有配置远程仓库、没有推送、没有访问真实业务数据库。

下一阶段不再是“能否独立构建”，而是独立运行交付：建立 Moodlelike 自己的本地启动、健康检查、演示数据初始化和一键验收入口，并逐步移除仍保留的 CSCALite 兼容命名。

## 20. Phase 5A：独立本地运行交付

目标是让新开发者只面对 Moodlelike 命令，不需要理解 CSCALite 的旧启动拓扑：

- 统一 `local:doctor / local:setup / local:start / local:verify / local:acceptance`；
- `local:setup` 自动安装缺失的锁定依赖，启动独立 PostgreSQL/Redis，执行迁移并生成幂等演示数据；
- `local:start` 统一传递运行环境、等待服务健康、执行认证验证并保持前后端进程附着；
- Windows 批处理与 PowerShell 不再复制编排逻辑，只委托统一 Node runner；
- `local:verify` 验证 Moodlelike 后端身份、Agent 页面、专用演示账号登录与 Agent 会话访问；
- `local:acceptance` 串联运行验证、依赖审计、核心契约和浏览器黄金路径；
- 本地数据库、端口、Compose project、volume 和演示凭据继续与 CSCALite 隔离；
- 保留 `CSCA_*` 仅作为内部兼容特性开关，用户无需手工配置。

实现和操作边界记录在 `LOCAL_DELIVERY.md`。

Windows 真实彩排已经完成：doctor 通过；独立 PostgreSQL/Redis 健康；97 条迁移成功且二次执行无 pending；演示数据幂等生成；稳定构建后端与 Vite 前端成功启动；启动器内部验证及独立 `local:verify` 均通过；Ctrl+C 后应用端口无监听残留。过程中修复了 Node 安装路径含空格时被 shell 截断、旧 `node --watch` 自触发重启导致健康超时两项问题。

下一阶段是 Phase 5B：从提交创建 clean checkout 重跑本地交付静态门禁，并为 Phase 5A 形成新的预发布候选；之后再规划兼容环境变量的 alias/deprecation 迁移。
