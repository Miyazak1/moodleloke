# Moodlelike × CSCALITE 产品收口与主仓决策 ADR

> 状态：已决策，阶段 1 已完成；阶段 2 已交付运营总览与内容运营闭环
> 日期：2026-09-25
> 最终主仓：`Moodlelike`
> 历史能力来源：`CSCALITE`
> 产品焦点：CSCA 做题训练、学习 Agent、自动出题与内容运营后台

## 1. 决策摘要

Moodlelike 作为后续产品开发、部署、数据库迁移和发布的唯一主仓。CSCALITE 不再作为长期并行产品或代码上游，仅作为旧首页、完整管理员后台和自动出题增量的迁移来源。

最终产品不是一个只包含 Agent 的极简演示，也不是原 CSCALITE 综合信息站的完整复制，而是以下能力的统一产品：

1. 直接继承 CSCALITE 旧首页的视觉、结构和内容运营能力；
2. `/agent` 作为学生唯一的 CSCA 学习与做题入口；
3. 保留内容运营、自动出题、AI 运维、题库、模考、真题、团队、用户和审计等管理员后台；
4. 保留完整数据库结构和迁移历史，首轮收口不删表、不改主键、不进行破坏性重命名；
5. 不再建设学校、留学、咨询、商城等独立产品线；
6. 停止 Moodlelike 与 CSCALITE 对 Agent、训练、题库和自动出题核心的双主开发。

本 ADR 取代 `docs/cscalite-agent-consolidation-plan-2026-09-23.md` 中“以 CSCALITE 为最终宿主”的结论。旧文档中关于会话隔离、学习证据、Practice Engine、自动出题门禁、灰度和回滚的原则仍然有效。

## 2. 决策依据

两个仓库已经是同源系统的分叉版本，而不是两个可以长期独立演进的产品。

| 范围 | Moodlelike | CSCALITE | 同路径文件 | 同路径但已分叉 |
| --- | ---: | ---: | ---: | ---: |
| 前端源码 | 243 | 293 | 221 | 35 |
| 后端源码 | 254 | 279 | 245 | 57 |
| Prisma 迁移 | 100 | 98 | 98 | 0 |
| 根脚本 | 378 | 393 | 350 | 47 |

其他关键事实：

- Moodlelike 已建立独立部署、CI、黄金路径、数据迁移演练和生产环境保护；
- Moodlelike 已增加 `0097_agent_conversation_scopes` 和 `0098_agent_conversation_lifecycle`；
- Moodlelike 已继续演进 Agent UI、学习计划、错题复习、教学资产和会话生命周期；
- CSCALITE 保留旧首页、完整通用后台和部分更新的自动出题能力；
- CSCALITE 当前存在大量尚未形成稳定基线的自动出题改动，不能通过整目录复制或覆盖方式合并；
- `question-production` 两仓库现有文件一致，但 Question Engine 与 AI Questioning 核心已出现增量和分叉，需要逐文件审查。

因此，风险最低的路径是以 Moodlelike 的已部署主干为基础，选择性吸收 CSCALITE 中仍属于目标产品的能力。

## 3. 产品边界

### 3.1 保留的产品能力

- CSCALITE 旧首页；
- 登录、注册、邮箱验证和个人账号；
- 用户主动选择的界面语言；
- 学习 Agent；
- 推荐训练、自由练习、错题复习、独立验证；
- 真题、模考和学习资源；
- 每题独立问答与独立学科问答；
- 学习计划、学习设置、薄弱点和学习证据；
- 自动出题、确定性校验、候选题治理和正式发布；
- 内容运营、题库、模考、真题、教学资产和 AI 运维后台；
- 团队、机构、成员、邀请、用户、角色和权限；
- 审计、日志、限流、备份、迁移和运行监控。

### 3.2 不再建设的产品能力

- 学校列表和学校详情产品；
- 留学国家、城市、申请流程和奖学金产品；
- 咨询服务产品；
- 商城、购物车、订单和支付产品，除非未来另行立项；
- 通用站内搜索；
- 独立的科目学习站；
- 独立的专项练习、自适应练习、模考做题和真题做题产品入口；
- 与 Agent 重复的 AI Coach 页面。

### 3.3 “不需要科目页面”的含义

数学、物理、化学仍然是题库、训练计划、生成策略、学习证据和用户偏好的核心数据维度，但不再各自拥有一套平行产品页面和状态机。

科目选择发生在首页入口、Agent 设置或具体训练任务中。所有学习行为最终进入 `/agent`。

## 4. 目标运行面

产品保留三个相互隔离但共用后端与数据库的前端运行面。

```text
Moodlelike
├─ Public Web
│  └─ CSCALITE 旧首页、登录入口和产品介绍
├─ Student Agent
│  └─ CSCA 训练、真题、模考、复习、问答和学习计划
└─ Admin Console
   └─ 内容、题库、自动出题、AI、团队、用户和审计
```

### 4.1 Public Web

旧首页的视觉结构、品牌表达、主要展示组件和 CMS 内容能力直接继承。首页不得重新引入学校、留学、咨询和商城的产品导航。

首页中的学习入口统一转译为 Agent 意图：

| 首页意图 | 目标 |
| --- | --- |
| 开始学习 | `/agent` |
| 数学训练 | `/agent?mode=free&subject=math` |
| 物理训练 | `/agent?mode=free&subject=physics` |
| 化学训练 | `/agent?mode=free&subject=chemistry` |
| 模考 | `/agent?task=mock-exam` |
| 真题 | `/agent?agentSection=resources` |
| 错题复习 | `/agent?agentSection=weakness` |

这些查询参数必须由统一的 Agent 路由契约解析，不能只依赖页面自行猜测。

### 4.2 Student Agent

学生端正式路径：

- `/agent`
- `/auth`
- `/login`
- `/register`
- `/onboarding`
- `/me`

`/agent` 是唯一的学习与做题入口。练习、报告、模考、真题和教学内容使用 Agent 内部的类型化工作区状态，不再创建第二套学生页面路由器。

### 4.3 Admin Console

管理员后台继续使用清晰、可直达、可刷新的正式路由：

| 路由 | 工作区 |
| --- | --- |
| `/admin/audit` | 运营总览、审计和系统状态 |
| `/admin/ai` | AI Provider、调用、费用、异常和任务监控 |
| `/admin/ai-question-bank` | 自动出题、候选题、审核、发布和质量治理 |
| `/admin/content` | 首页及公共内容运营 |
| `/admin/content/teaching-assets` | 教学资产管理 |
| `/admin/mock-exams` | 模考试卷、蓝图、组卷和生成任务 |
| `/admin/past-papers` | 真题、文件和题目管理 |
| `/admin/special-practice` | 训练题库和兼容运营能力 |
| `/admin/organizations` | 团队与机构管理 |
| `/admin/users` | 用户、角色和权限管理 |
| `/organization` | 有权限团队的组织工作区 |

兼容路由 `/admin/learning/*`、`/admin/accounts/*` 和 `/admin/audit-logs` 只作为显式重定向存在，后台内部导航统一使用规范路径。

Admin Console 应使用独立入口和构建图，例如 `admin.html -> AdminApp`，生产 Nginx 将 `/admin/*` 深链接回退到该入口。学生入口不得静态导入后台页面。

现有 `authoring.html` 的题目生产与教学资产能力并入 Admin Console；迁移完成后再决定保留兼容入口还是重定向到对应 `/admin/*` 工作区。

## 5. 首页继承原则

首页采用“视觉与内容直接继承、业务入口重新绑定”的策略。

需要继承：

- `HomePage` 的视觉结构和互动表达；
- `SiteHeader`、`SiteFooter` 和响应式布局；
- 首页多语言文案；
- `PublicContentBlock` 驱动的可运营内容；
- 首页中与做题体验相关的演示、迷你测验或训练预览。

需要改造：

- 删除学校、留学、咨询、商城和搜索导航；
- 科目卡片不进入旧科目页，改为 Agent 训练意图；
- 模考、真题和错题入口不再进入独立学生应用；
- 管理入口不出现在普通用户主导航；
- `/agent` 不使用语言前缀，语言来自用户设置、账号偏好或本地存储。

首页继承不等于恢复 CSCALITE 旧 `App` 和全部 `AppRouteRenderer`。

## 6. 后端模块边界

### 6.1 当前 Moodlelike 已保留的核心

- `agent`
- `ai-gateway`
- `ai-questioning`
- `auth`
- `csca-learning`
- `csca-mock-exam`
- `csca-special-practice`
- `learning-intelligence`
- `me`
- `past-papers`
- `schools` 中仍被账号和组织能力使用的部分
- `score-calibration`
- `admin-audit`
- `ops`

### 6.2 需要恢复或显式挂载

- `ContentModule`，支撑首页内容和 `/admin/content`；
- `AdminAuditModule`；
- `OpsModule`；
- `ScoreCalibrationModule`；
- 完整管理员用户与团队接口；
- Admin Console 实际使用但尚未从当前 `AppModule` 可达的控制器和服务。

### 6.3 不恢复的业务模块

- `ConsultingModule`
- `StudyChinaModule`
- `CommerceModule`
- `PaymentsModule`，除非未来另行批准收费能力；
- `SearchModule`

模块不挂载不等于立即删除数据库模型。运行面收口和数据模型退役必须分阶段完成。

## 7. 自动出题与题库

自动出题是目标产品核心，不属于可选后台附件。

目标链路：

```text
大纲 / 题型画像 / 真题证据
  -> QuestionPlan
  -> Provider 或本地确定性 Generator
  -> Solver / Oracle / Validator
  -> 去重与质量门禁
  -> 候选题
  -> 自动或人工治理
  -> 正式题库
  -> Practice Engine
  -> Agent 学生训练
  -> 作答与质量反馈
  -> 质量治理与补题
```

合并原则：

1. 先冻结 CSCALITE 当前自动出题工作，形成可追踪快照；
2. `question-production` 以当前共同内容为基线；
3. Question Engine 的独有文件和分叉文件逐一审查；
4. AI Questioning、AI Gateway、特殊练习与模考中的分叉禁止整目录覆盖；
5. 保留费用上限、精确授权、失败关闭、禁止未审核题进入学生池等安全边界；
6. 学生请求下一题时不得同步调用模型临时生成正式题；
7. Provider、自动生产和学生消费必须可独立关闭。

### 7.1 自动出题插件化决策

自动出题能力采用可插拔架构。这里的“热插拔”定义为：插件可以独立安装、注册、健康检查、灰度启用、并行运行、停止接单、切换版本和快速回滚，而不要求在正在运行的 Node.js 主进程中卸载和替换 JavaScript 模块。

生产推荐采用进程外插件：

```text
Moodlelike Host
├─ Question Supply Orchestrator
├─ Plugin Registry
├─ Candidate Repository
├─ Host-owned Quality Gate
├─ Review / Publish Workflow
└─ Audit / Metrics / Cost Control
        │
        ├─ HTTP / Queue / RPC
        ▼
Question Generation Plugin
├─ manifest
├─ capability discovery
├─ generate candidate
├─ optional solver / oracle / verifier evidence
├─ health / readiness
└─ no direct publication authority
```

插件作为独立进程、容器或 Worker 运行，宿主通过版本化协议调用。这样更新插件不要求重启学生应用或主后端，也不会因为插件崩溃拖垮登录、做题、判题和已发布题库读取。

### 7.2 宿主必须拥有的职责

以下能力不得下放给第三方或可替换插件：

- 生产计划与任务调度；
- 费用预算、限流和执行授权；
- 用户、团队和权限；
- 正式数据库身份和事务；
- 候选题持久化；
- 当前正式质量门禁；
- 重复度和题库冲突检查；
- 审核、批准、发布、隔离和撤回；
- 学生可见性；
- 审计日志、运行指标和告警；
- 幂等键、重试策略和任务状态机。

插件不得直接连接生产数据库，不得自行把题目标记为已发布，也不得绕过当前宿主门禁写入学生题池。

### 7.3 插件可以拥有的职责

- 声明支持的学科、考点、题型、语言和生成模式；
- 根据版本化 QuestionPlan 生成候选题；
- 返回 Solver、Independent Oracle、Explanation Verifier 等证明材料；
- 返回模型、提示策略、生成器和规则版本；
- 报告 token、费用估算、耗时和 Provider 请求标识；
- 提供离线或零 Provider 确定性生成；
- 提供只读能力目录和就绪状态；
- 对宿主发出的取消请求停止未完成任务。

插件输出始终被视为不可信候选输入。宿主必须重新验证结构、契约版本、答案、解析、重复度、学科约束和发布资格。

### 7.4 最小插件协议

每个插件必须提供 manifest，至少包含：

```ts
type QuestionPluginManifest = {
  pluginId: string;
  pluginVersion: string;
  protocolVersion: string;
  questionPlanVersions: string[];
  outputSchemaVersions: string[];
  capabilities: Array<{
    subject: 'math' | 'physics' | 'chemistry';
    topicIds?: number[];
    taskFamilies: string[];
    languages: string[];
    modes: Array<'deterministic' | 'provider'>;
  }>;
  supportsCancellation: boolean;
  supportsIdempotency: boolean;
};
```

协议至少提供：

- `GET manifest`：能力和版本发现；
- `GET health`：进程存活；
- `GET readiness`：是否可以接收新任务；
- `POST generate`：根据密封任务生成候选题；
- `GET job/:id` 或结果事件：读取异步结果；
- `POST cancel/:id`：取消未完成任务；
- 标准错误码、重试建议和费用回执。

真实实现可以采用 HTTP、消息队列或 RPC，但领域载荷和版本规则必须保持一致。

### 7.5 安全切换流程

插件更新不覆盖正在运行的旧版本，而是并行部署：

1. 安装新版本但保持禁用；
2. 校验签名、manifest、协议版本和依赖；
3. 执行离线 Contract Test Kit；
4. 运行零 Provider 或测试 Provider 的影子任务；
5. 按题型或小比例流量灰度；
6. 新任务逐步切到新版本；
7. 已开始任务继续绑定原 `pluginId + pluginVersion`；
8. 旧版本停止接收新任务并排空运行任务；
9. 保留一键路由回切能力；
10. 观察期结束后再卸载旧版本。

数据库中的每个生产任务、候选题和正式题都必须记录插件 ID、插件版本、协议版本、QuestionPlan 版本和关键策略版本，保证回溯与回滚时不会混淆来源。

### 7.6 兼容性规则

- 协议采用语义化或等价的显式版本策略；
- 宿主至少同时兼容当前版本和一个前一版本；
- 破坏性协议升级必须使用新主版本，禁止静默改变字段语义；
- 未识别的主版本、题目 schema 或 QuestionPlan 必须失败关闭；
- manifest 声明不等于生产资格，仍需宿主侧能力认证；
- 插件自己的数据库迁移不得进入 Moodlelike 主库；
- 插件不可要求学生请求等待生成完成；
- 插件不可持有 Moodlelike 用户 token、管理员 Cookie 或数据库凭据；
- Provider Key 优先由宿主的受控凭据代理提供，避免长期下发给任意插件。

### 7.7 当前基础与缺口

当前项目已经具备以下基础：

- `question-engine` 已有便携运行时、显式 host ports 和只读能力边界；
- `QUESTION_SUPPLY_PRODUCTION_ADAPTER` 已提供依赖注入点；
- `QuestionSupplyDemandV1` 已包含版本、幂等 demand key、来源、科目、考点和缺口；
- 当前 Shadow Adapter 可以在不调用生成系统时记录供应需求；
- 自动出题系统已有候选、审核、发布、质量门禁和审计数据。

尚需补齐：

- 将只允许 `shadow_recorded` 的返回契约扩展为异步 accepted、completed、failed、cancelled 状态；
- 独立 Plugin Registry 与 capability routing；
- 插件 manifest 和 Contract Test Kit；
- 插件调用的隔离凭据、网络和资源限制；
- 插件版本绑定、任务排空、灰度和快速回切；
- 对插件返回结果执行宿主侧二次校验；
- Admin Console 中的插件安装状态、版本、健康、流量、费用和回滚控制。

### 7.8 插件化完成标准

- 在不修改 Agent、Practice Engine 和学生接口的前提下替换生成实现；
- 两个插件版本可以并行运行且任务来源可追溯；
- 新版本失败后可以在分钟级把新任务切回旧版本；
- 旧版本任务不会被新版本错误接管或重复执行；
- 插件离线、超时或不可用时，学生仍可消费已发布题库；
- 禁用插件不会删除候选题、正式题或学习证据；
- 未通过宿主质量门禁的插件输出无法进入正式题库；
- 插件更新不要求迁移 Moodlelike 主数据库；
- 插件的权限、网络、费用和 Provider 调用都有独立审计。

## 8. 团队、用户与权限

团队能力属于保留范围，包括：

- Organization；
- OrganizationMember；
- Cohort；
- Invite 与 InviteAttempt；
- 团队 AI 额度；
- 团队 Provider 配置；
- 用户、角色和管理员权限；
- BYOK 或共享 Provider 的安全边界；
- 跨团队数据隔离和审计。

长期应把组织能力从 `schools` 等历史模块中拆到独立 Organization 领域；首轮合并不要求立即重构，只要求路由、权限和运行依赖明确。

## 9. 数据库策略

### 9.1 基线

Moodlelike Prisma schema 与迁移历史作为新主线。`0097` 和 `0098` 继续保留，不回退到 CSCALITE 的较早迁移集合。

### 9.2 首轮保留策略

采用 `copy-all-first-prune-later`：

- 保留完整 Prisma schema；
- 保留全部迁移历史；
- 不删除学校、留学、支付等历史表；
- 不重命名现有 CSCA、SpecialPractice、MockExam 等模型；
- 不改变主键和外键；
- 不把 Moodlelike 本地演示数据当作 CSCALITE 生产数据迁入；
- 真实数据切换必须走独立备份、预检、迁移和回滚流程。

### 9.3 必须保留的数据域

认证代码保留 Moodlelike 的后续实现，生产数据与首次切换身份策略按
[`cscalite-auth-consolidation-decision-2026-09-28.md`](./cscalite-auth-consolidation-decision-2026-09-28.md)
执行。首次切换暂时保持原 `cscalite_*` Cookie 名以延续旧浏览器会话；Cookie 品牌改名必须在
后续独立发布中进行，不能和生产接管同时发生。

- 用户、认证和权限；
- 团队、成员和邀请；
- 内容块；
- 题库、题目来源和质量数据；
- 自动出题配置、任务、候选、生产批次和审计；
- 真题、模考试卷和文件；
- 训练轮次、作答、报告、错题、掌握度和学习事件；
- AI 调用、额度和用量；
- Agent 会话、消息、附件、运行、工具调用和产物；
- 教学资产及交互记录；
- 管理审计和运营记录。

聊天生命周期清理不得删除作答事实、错题、掌握度、训练报告、学习事件或题目质量数据。

## 10. 路由实现原则

1. 建立唯一机器可读路由清单，Public、Student、Admin 分域维护；
2. 直接访问、内部导航、登录回跳和 Onboarding 回跳必须使用同一合法性判断；
3. 未知路由不得在直接访问时显示 404、内部导航时却静默进入 `/agent`；
4. 旧学生学习路由采用可观测重定向，不恢复旧页面状态机；
5. 后端浏览器可调用接口统一使用 `/api/v1/*`；
6. 清理仅在 Nginx 下不可达的无前缀后端兼容别名；
7. Public、Student、Admin 的深链接刷新都必须有生产代理测试；
8. `/zh/agent`、`/en/agent` 等不是合法 Agent 地址。

### 10.1 当前独立运行面的路由基线（2026-09-28）

当前浏览器入口仍由 `StandaloneAgentApp` 统一承载；继承后的 Public Web 首页已经挂载，Admin Console 尚未迁入。因此，本阶段真正可达的浏览器路由是：

| 输入路径 | 当前结果 | 说明 |
| --- | --- | --- |
| `/` | Public Web 首页 | 继承 CSCALITE 首页视觉与内容能力，学习入口统一进入 Agent |
| `/agent` | Agent | 学生正式入口 |
| `/auth` | 登录、注册、找回或重置密码 | 模式由受控 `mode` 参数决定 |
| `/login` | 规范化为 `/auth` | 兼容别名 |
| `/register` | 规范化为 `/auth?mode=register` | 兼容别名，必须保留注册模式 |
| `/onboarding` | 新用户资料设置 | `returnTo` 仅允许回到 Agent 或个人中心 |
| `/me` | 个人账号 | 登录回跳白名单成员 |
| `/admin/content` | 独立 Admin 内容工作区 | 仅管理员可读取、编辑、发布和归档；非管理员不请求后台数据 |
| 其他路径 | 明确的 404 状态 | 不得静默进入 Agent |

`frontend/src/lib/standalone-route-policy.ts` 是当前独立运行面的唯一机器可读判定源。直接访问、内部导航、登录回跳和 Onboarding 回跳共同使用该策略；重复斜杠与尾斜杠会规范化，跨域、反斜杠、控制字符、旧学生路由和 `/admin/*` 回跳会被拒绝。

这一基线不代表取消未来路由。`/admin/*` 只有在阶段 2 的独立 `AdminApp`、权限守卫、后端可达性和 Nginx 深链接回退同时完成后才允许挂载。现存旧全站 E2E 文件记录历史能力，不能被当成当前独立生产入口已经支持这些页面的证据。

默认 `test:e2e`、`verify:e2e` 和 `test:e2e:fixed-bank` 只验证当前 Standalone Agent/Authoring 黄金路径。旧全站路由套件保留为显式的 `test:e2e:legacy-cscalite`，仅供首页与后台迁移时提取验收案例；它不是当前发布门禁。

## 11. 分阶段实施计划

### 阶段 0：冻结双仓基线

- 固定 Moodlelike 当前可部署提交；
- 将 CSCALITE 未提交自动出题工作保存为可恢复快照；
- 标记脏文件的归属、完成度和测试证据；
- 生成前端、后端、Question Engine、脚本和迁移差异清单；
- 从此禁止两个仓库同时开发同一领域。

退出条件：任一待迁移改动都有明确来源和恢复点，不依赖未记录的本机工作区状态。

### 阶段 1：首页与内容模块

截至 2026-09-28，Public Web 首页、规范 `/api/v1/content/home`、`ContentModule`、三语言内容读取边界、首页到 Agent 的意图映射以及桌面/移动端黄金路径已经迁入。`/admin/content` 的可视化编辑界面随阶段 2 的独立 Admin Console 一并挂载，当前不提前暴露不完整的管理员路由。

- 将旧首页所需组件、样式、内容和多语言资源并入 Moodlelike；
- 恢复 `ContentModule`；
- 恢复 `/admin/content`；
- 删除或重绑定与学校、留学、咨询、商城相关的首页入口；
- 首页所有学习 CTA 进入 Agent。

退出条件：首页桌面、移动端、多语言和 CMS 内容更新通过；不存在进入旧学生站的链接。

### 阶段 2：完整 Admin Console

截至 2026-09-28，生产入口会按 `/admin/*` 动态加载独立 `AdminApp`，首个可达模块为 `/admin/content`。该切片已打通管理员登录回跳、前端拒绝、后端 `RequiredAdminGuard`、内容保存/发布、审计记录和首页读取；未完成迁移的后台模块保持关闭，不因历史源码仍在仓库中而出现在导航。

- 建立独立 `AdminApp` 与 `/admin/*` 路由；
- 接回十类管理员页面；
- 恢复审计、Ops、内容和评分校准模块；
- 校验团队、用户和权限；
- 将现有 Authoring 工作区纳入统一后台导航。

退出条件：管理员深链接、刷新、登录回跳、无权限拒绝和服务端 Guard 全部通过。

### 阶段 3：自动出题增量合并

- 合并 CSCALITE 独有 Question Engine 能力；
- 审查所有同路径分叉；
- 回归数学、物理、化学生成与验证；
- 校验候选题、发布、质量反馈、隔离和补题闭环；
- 保持真实 Provider 调用的显式授权与费用上限。

退出条件：离线契约、确定性验证、后台流程和学生消费闭环均通过，且没有未经授权的 Provider 调用或学生发布。

### 阶段 4：路由与旧入口收口

- 建立正式路由 manifest；
- 修复登录与 Onboarding 回跳；
- 将旧科目、专项、模考和真题学生路径重定向到 Agent；
- 更新 README、部署文档和 E2E；
- 移除旧版路由测试与生产契约冲突。

退出条件：路由矩阵在开发服务器和生产 Nginx 下结果一致。

### 阶段 5：数据与生产切换

生产执行命令、宝塔反向代理切流、实际容器/端口/卷盘点和回滚分支统一以
[`cscalite-to-moodlelike-production-cutover-runbook-2026-09-28.md`](./cscalite-to-moodlelike-production-cutover-runbook-2026-09-28.md)
为准。该 Runbook 要求先以 `moodlelike-next:18081` 建立独立候选栈，不覆盖当前
`moodlelike-demo:18080`，也不允许新旧后端同时写生产数据。

- 对真实目标数据库运行只读 preflight；
- 完成备份与恢复演练；
- 应用新增迁移；
- 验证内容、用户、团队、题库、训练和 Agent 数据不变量；
- 完成灰度、监控和回滚演练。

退出条件：数据不变量、权限隔离、关键路径和回滚能力得到证据确认。

### 阶段 6：停止 CSCALITE 双主开发

- CSCALITE 标记为历史来源和迁移证据；
- 新功能只进入 Moodlelike；
- 移除跨仓库复制、提取和回写命令；
- 对不再使用的源码和数据库模型另立退役计划。

## 12. 验收矩阵

### 12.1 学生端

- 旧首页可以进入登录和 Agent；
- 首页科目、模考、真题和错题入口进入正确 Agent 工作区；
- 登录、注册、刷新和重新登录不丢失合法回跳意图；
- 自由练习、推荐学习、错题复习、模考和真题可完整闭环；
- 每题问答只读取当前题上下文；
- 学科问答不读取做题会话；
- AI 不可用时基础做题、判题和报告仍可用。

### 12.2 管理端

- 所有规范 `/admin/*` 路由可直接访问和刷新；
- 非管理员同时被前端和后端拒绝；
- 内容修改可以影响首页；
- 自动出题任务可观察、可失败关闭、可审计；
- 候选题可以审核、发布、隔离和回补；
- 真题、模考和教学资产可以管理；
- 团队、成员、邀请和用户权限隔离正确；
- AI Provider、费用、调用和异常可观测。

### 12.3 数据与运行

- 迁移可重复执行；
- 生产启动不接受占位 secret；
- 数据库、Redis 和上传目录使用 Moodlelike 部署身份；首次切换可通过显式环境覆盖保留 CSCALITE Cookie 名；
- 聊天清理不影响学习证据；
- 自动出题关闭不影响已发布题库训练；
- 后台关闭或不可用不影响学生读取已发布内容；
- 备份、恢复和回滚演练通过。

## 13. 明确禁止事项

- 禁止把 CSCALITE 整个目录覆盖到 Moodlelike；
- 禁止把 Moodlelike 整体合回 CSCALITE；
- 禁止在未冻结 CSCALITE 脏工作区前执行批量迁移；
- 禁止恢复学校、留学、咨询和商城产品路由；
- 禁止恢复第二套学生做题状态机；
- 禁止让学生端直接调用 Provider 生成下一道正式题；
- 禁止根据静态扫描直接删除 Prisma 模型或历史迁移；
- 禁止把前端管理员角色判断作为唯一权限边界；
- 禁止长期维护两套 Agent、训练或自动出题核心。

## 14. 下一执行目标

阶段 2 已建立独立 `AdminApp` 和管理员路由守卫。`/admin/content` 完成了内容编辑、发布、首页读取和审计闭环；`/admin/audit` 进一步提供仅面向 CSCA 的运营概览，统计内容变更、模考作答、训练会话和未删除的 Agent 会话，并展示最近管理员审计事件。两条路由共用后端 `RequiredAdminGuard`，未迁移后台路由继续 fail closed。

阶段 2 的首批交付物：

1. 已完成：管理员路由 manifest、独立入口和生产深链接回退；
2. 已完成：前端角色拒绝与后端 `RequiredAdminGuard` 双重边界；
3. 已完成：`/admin/content` 的读取、编辑、发布与归档闭环；
4. 已完成：首页内容变更的桌面、移动端和多语言回归；
5. 已完成：`/admin/audit` 的 CSCA-only 指标与最近审计事件；
6. 待完成：自动出题与 AI 运营、题库/真题/模考、团队与用户的逐模块权限和数据闭环；
7. 持续要求：验证不修改真实生产数据、不调用真实 AI Provider。

自动出题插件边界已进入阶段 1：新增受管理员保护的只读插件注册表和状态页，默认关闭生成写入，故障时固定回退到已核验题库。具体契约、启用门禁和回滚方式见 `docs/question-engine-plugin-architecture-2026-09-28.md`。在生成、审核和主题映射调用全部收口到适配器前，不开放生产写操作。

v1.1 已将正式生成、审核和主题映射 Provider 调用分别收口到 `question.generate`、`question.review`、`question.topic-map` 宿主门禁；三个能力分别判断开关、模型和密钥。插件关闭时不会调用 Provider，并沿用 `generator_disabled`、`reviewer_disabled`、`topic_mapper_disabled` 兼容状态。零 Provider 的内存预览与受控本地影子验证保留，但不获得发布授权。

后续顺序保持为：**Admin Console → 自动出题增量 → 路由收口 → 数据与生产切换**。
