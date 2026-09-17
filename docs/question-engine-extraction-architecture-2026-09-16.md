# CSCALite 自动出题引擎独立化

## 目标边界

CSCALite 保留用户、权限、管理审核和学生端发布。独立 Question Engine 负责版本化的
QuestionPlan、生成器、Solver、独立 Oracle、解释验证、质量门与证据报告。未来 Agent
通过 MCP 插件访问引擎，但发布权不进入插件。

## Phase 1：只读边界

Phase 1 使用稳定只读适配层包裹现有、已经取得证据的实现。没有移动或复制生成算法，
因此数学基础导数 100/100 production-shadow 绑定的 Generator、Solver、Oracle、Review
Gate 和语料快照版本不变。

独立包位于 `question-engine/`，插件位于 `plugins/cscalite-question-engine/`。插件当前只暴露：

- exact-plan 能力目录；
- 三科发布就绪报告；
- 零 Provider、只读的 qualification batch preview。

明确不暴露批次执行、Provider 调用、候选题写入和学生端发布。

## 后续迁移

1. 将纯策略与纯生成模块逐组移动到 `question-engine`，CSCALite 通过兼容导出引用它们。
2. 每移动一组，运行原完整规则测试和固定证据回放，保持版本字符串与行为一致。
3. 增加独立存储端口，但 CSCALite 继续拥有审核和发布事务。
4. 只有在单独设计作用域授权后，才考虑向插件增加候选写入；学生端发布工具永久不提供。

## Phase 2：数学基础导数纯验证链

首组 canonical 代码已迁入 `question-engine/core`：

- `subject-practice-math-derivative-tool-verifier.ts`
- `subject-practice-math-derivative-solver.ts`
- `subject-practice-math-derivative-independent-oracle.ts`
- `subject-practice-math-derivative-explanation-verifier.ts`

原 `backend/src/ai-questioning` 文件只做兼容 re-export。版本字符串、函数对象和运行行为均
来自独立核心，不存在两份可漂移实现。Generator 暂不迁移，因为它仍依赖 CSCALite 的大型
QuestionPlan 与 Blueprint 类型；先拆这些共享契约，再移动 Generator，避免一次性扩大风险面。

迁移证据记录在 `question-engine/migration-manifest.json`。冻结后随机性质协议没有改写旧 v2
清单，而是新增 v3 清单：数学导数 Solver 的算法身份绑定
`question-engine/core/subject-practice-math-derivative-solver.ts`，backend facade 只验证 re-export
目标。错误 facade 目标的负向控制必须被拒绝，因此 facade 的注释或格式变化不会伪装为算法
变化，而转发到错误实现会失败关闭。

Phase 2 回归结果：冻结后随机性质 1,920/1,920，通过数学导数 Generator 512/512、mutation
320/320、B-canary、独立包契约、完整 AI questioning rules、插件自测与 backend 编译。就绪度
升级为 `three-subject-release-readiness-v175-question-engine-core-identity`；数学导数仍保持
100/100 production shadow，portfolio SHA-256 仍为
`b9f3e33530a5509bd10c59746ab292073f17356432a979b0bcc74d3b1cb6f406`。迁移没有增加发布资格；
正式 release 仍只被三项来源证据阻断，自动发布和学生端发布继续为 0。

## Phase 3：数学导数 Generator 与 Agent 离线预览

数学基础导数 Generator 算法已迁入 `question-engine/core`。它不复制 CSCALite 的大型
QuestionPlan 策略，而是要求宿主显式注入 `validate` 与 `adherenceFor` 两个端口；backend
兼容文件只负责绑定现有策略。端口拒绝时 Generator 在构题前失败关闭。固定 seed 的核心绑定
与 backend 兼容入口输出逐字段一致，原 Generator 版本字符串保持不变。

冻结协议新增 v4 清单，同时绑定 canonical Generator SHA-256、backend facade 目标和错误目标
负向控制。行为回归保持 512/512 triple-verified、1,024 次双语核验通过，冻结后随机性质仍为
1,920/1,920。控制面升级为 `three-subject-release-readiness-v176-question-engine-generator-ports`。

Agent 插件新增 `generate_math_derivative_preview`：只接受整数 seed，在内存中构造一题并返回
Solver、Oracle、解释验证和 QuestionPlan adherence 证据。它不调用 Provider、不连接或写入
数据库、不创建观察任务，也没有学生端发布能力。批次执行、候选持久化和发布工具仍不存在。

## Phase 4：物理与化学核心链

物理运动学和化学强酸强碱的 Generator、Solver、Independent Oracle、Explanation Verifier
均已迁入 `question-engine/core`。两类 Generator 与数学导数一样使用 QuestionPlan 的
`validate` / `adherenceFor` 端口，并额外使用 provisional scenario contract 验证端口；场景
构思、物化和存储仍由 CSCALite 拥有。

物理回归为 Generator 512/512、Solver gold 128/128、mutation 512/512；化学回归为 Generator
768/768、Solver gold 128/128、mutation 512/512。v5 冻结清单同时绑定三条已迁移链的 Solver、
Generator 核心 SHA-256、backend facade 目标和负向控制，冻结后随机性质总计 1,920/1,920。

插件新增 `generate_physics_kinematics_preview` 与 `generate_chemistry_acid_base_preview`，与数学
工具共同组成三科纯内存预览。控制面版本为
`three-subject-release-readiness-v177-physics-chemistry-engine-core`；所有写入和发布权限仍留在
CSCALite，插件只持有发现、就绪度、只读批次预览和离线生成能力。

## Phase 5：五个注册 family 全部入核

剩余数学基础函数与直线关系的 Generator、Solver、Independent Oracle、Explanation Verifier
已迁入 `question-engine/core`。基础函数 Generator 通过单一 plan-validation 端口绑定；直线关系
通过 validation/adherence 双端口绑定。至此 production-shadow registry 的五个 family 都以
Question Engine 为 canonical 算法所有者，CSCALite backend 只保留兼容入口与宿主策略。

基础函数回归为 Generator 512/512、Solver gold 59/59、mutation 236/236；直线关系 Generator
2,048/2,048、独立性质 1,024/1,024、通用 mutation 2,048/2,048、领域 mutation 288/288。
v6 冻结证据为 1,920/1,920，控制面升级为
`three-subject-release-readiness-v178-five-family-engine-core`。

## Phase 6：五-family Agent 接口

插件新增 `generate_math_elementary_preview` 和 `generate_math_line_relation_preview`。目前五个
注册 family 均有纯内存预览入口：数学导数和直线关系返回 triple-verified，基础函数、物理与
化学返回 self-verified，并附带各自验证证据。插件共 8 个工具：能力目录、就绪度、只读批次
预览和 5 个离线生成预览；写入类工具数量为 0。

算法核心已完成独立。下一项工程边界是把当前由 CSCALite 提供的 QuestionPlan builder、
validation、adherence 与 scenario-validation 组合为可版本化宿主适配器；在完成前，插件需要
指向一个 CSCALite checkout，但核心算法不再位于 backend。

## Phase 7：版本化宿主适配器

新增 `question-engine/adapters/cscalite-host.cjs`，版本
`cscalite-question-engine-host-adapter-v1`。Question Engine runtime 不再分别加载多个 backend
策略模块，而只消费适配器的 `buildQuestionPlan`、`validate`、`adherenceFor`、`validateScenario`
四个端口。能力目录和每个离线预览均返回适配器版本，便于未来替换宿主时审计绑定。

适配器声明并由契约测试验证 `databaseAccess=false`、`providerAccess=false`、
`publicationAccess=false`。当前仍使用 CSCALite 实现这四个策略端口，因此运行插件仍需 checkout；
但替换其他 Agent 宿主时只需实现同一适配器协议，不需要修改五条算法链。

## Phase 8：portable adapter 基础

新增 `cscalite-question-engine-portable-host-adapter-v1-offline-only`。它以严格 family 白名单
构造五类 exact plan 所需的最小离线契约，并提供 plan validation 与候选结构 adherence；未知
family 或错误模板失败关闭。导数对照测试已在 portable 端口下取得 triple-verified。

portable adapter 明确声明 `productionQualification=false`、`scenarioMaterialization=false`，且
数据库、Provider、发布访问均为 false。它目前解决的是策略端口可移植性；完整脱离 checkout
还需要把 TypeScript 核心编译为随包 JavaScript，并把 runtime 的 catalog/readiness 能力拆成
可选 CSCALite 扩展。

## Phase 9：独立编译与可分发 runtime

`question-engine/tsconfig.json` 将全部核心编译为 ES2022 CommonJS、声明文件和 source map，输出
到 `dist/core`。默认包入口改为 backend-free `portable-index.cjs`，并新增
`cscalite-question-engine <json-input>` CLI；原 catalog/readiness/qualification 通过可选
`./cscalite` export 保留。

portable runtime 已对五个 family 各运行一次真实编译产物生成，状态全部达到对应的
self-verified 或 triple-verified，且 Provider、数据库读写、观察任务、发布和生产资格均为 0。
`npm pack --dry-run` 得到 75 个文件、约 86 KB 压缩包，只包含编译核心、声明、portable
adapter、CLI/runtime 和 README，没有 backend 或 CSCALite 脚本。

## Phase 10：可脱离仓库安装的 Agent 插件

portable package 已 vendor 到 `plugins/cscalite-question-engine/vendor/question-engine`。MCP server
改为自适应：在 CSCALite checkout 内注册完整 8 工具；找不到完整 runtime 时只注册 5 个
`generate_*_preview` 工具，不注册 catalog、readiness 或 qualification preview。

完整模式和使用不存在 `CSCALITE_ROOT` 的 detached 模式均通过真实 self-test。detached 模式
五类题全部生成成功，write-like 工具为 0，且未加载 backend、Provider、数据库或发布模块。
