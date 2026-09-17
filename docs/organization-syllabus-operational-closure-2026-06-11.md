# 机构治理与大纲驱动出题闭环实施记录

日期：2026-06-11

## 目标

把“机构/团队”“考试大纲”“AI 出题”从理论设计推进到可以运转的后台闭环：

- 机构成员不再只能一个个手动添加；
- 团队治理归入运营后台，但与普通用户运营区分；
- 考试大纲可由后台上传结构化 JSON，并真正进入 AI 出题、审题和题库治理链路。

## 产品判断

### 1. 团队成员添加不能只靠逐个录入

逐个添加适合小范围排障，不适合正式运营。更成熟的方案是三层并存：

- 单个成员添加：用于客服、补录、纠错。
- 批量 CSV 导入：用于学校、班级、代理批量开通。
- 邀请 token：用于未注册用户或无法提前知道用户 ID 的场景。

当前实现采用“预检后导入”：

- CSV 支持 `email,userId,role,cohortSlug,cohortName`。
- 已注册用户直接加入机构。
- 未注册邮箱生成邀请 token。
- 导入前先展示行级动作和错误，确认后才写库。

### 2. 机构治理属于运营，但不同于普通用户运营

普通用户运营关注个人账户、订单、额度、状态。机构治理关注组织对象：

- 机构资料；
- 分组/班级；
- 成员关系；
- 邀请与批量入组；
- 机构 AI 额度池；
- 机构 BYOK/provider 路由。

因此后台应有独立入口 `机构团队`，放在运营分组下，而不是藏在 AI 观测页。

### 3. 考试大纲应该后台上传 JSON

PDF/网页大纲不适合直接作为运行时依据。合理流程是：

1. 人或工具把官方大纲转成 `csca-syllabus-v1` JSON。
2. 后台上传 JSON。
3. 系统预览新增、更新、未覆盖知识点和受影响题目。
4. 管理员确认应用。
5. 旧题按影响进入 `pending_review`。
6. AI 出题和 AI Reviewer 只使用当前有效结构化大纲范围。

目前 AI 出题已不再只靠自由文本主题，而是读取 `CscaExamTopic` 里的结构化 scope：

- `syllabusVersion`
- `sourceLabel`
- `sourceUrl`
- `knowledgePoints`
- `skills`
- `allowedQuestionTypes`
- `difficultyBand`
- `excludedScope`

Generator、Reviewer、Validator 都已接入该 scope。

## 已落地代码

### 后端

新增迁移：

- `backend/prisma/migrations/0049_organization_governance/migration.sql`

新增/扩展模型：

- `OrganizationCohort`
- `OrganizationInvite`
- `OrganizationMember.cohortId`
- `OrganizationMember.invitedBy`
- `OrganizationMember.joinedAt`
- `OrganizationMember.expiresAt`
- `OrganizationMember.metadata`

新增管理 API：

- `POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/cohorts`
- `POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/invites`
- `POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/member-imports/preview`
- `POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/member-imports/apply`

实现位置：

- `backend/src/csca-special-practice/ai-entitlement.service.ts`
- `backend/src/csca-special-practice/csca-special-practice.controller.ts`

### 前端

新增后台页面：

- `frontend/src/pages/AdminOrganizationsPage.tsx`

新增路由：

- `/admin/organizations`

后台导航：

- 运营分组新增 `机构团队`。

页面能力：

- 创建/选择机构；
- 查看成员、分组、邀请数量；
- 创建分组；
- 生成指定邮箱邀请或通用邀请，并返回 `/organizations/invite?token=...`；
- 粘贴 CSV；
- 预检导入；
- 确认导入；
- 展示本次生成的邀请链接；
- 一键复制本次批量导入生成的邀请链接；
- 下载本次批量导入生成的邀请 CSV。
- 查看邀请历史，并按状态、分组、邮箱关键词筛选。
- 下载当前筛选结果的邀请历史 CSV，且不包含旧 token。
- 归档未使用或已过期邀请。
- 从历史邀请重新生成新的邀请链接。
- 对当前筛选结果批量重新生成新的邀请链接。
- 邀请历史展示创建人、接受人和接受时间，并在历史 CSV 中导出这些治理字段。
- 机构页可直接调整成员角色、分组和状态，支持启用、停用和归档成员关系。
- 机构页支持成员搜索、按状态/分组筛选、成员多选后的批量启用、批量停用、批量归档、批量转组、批量前确认、成员 CSV 导出和本次批量操作结果明细导出。
- 机构页支持对上一次批量成员操作中的失败项一键重试，并可单独下载失败项 CSV，避免运营从完整结果里人工筛选后再重复勾选。
- 机构页默认引导运营使用邮箱邀请/CSV 导入；数字 `userId` 绑定只在“高级字段”中说明，用于历史账号补录、迁移排障或精确绑定，不再作为常规成员添加方式展示。
- 审计页可按机构筛选机构相关后台操作。
- 审计事件会展示机构名、机构 slug、目标邮箱、相关用户和操作人，不需要只靠 organizationId 排查。
- 审计事件可展开 before/after 变更详情，便于运营排查机构、邀请、额度和 provider 配置争议。
- 机构页已嵌入“治理日志”，直接显示当前机构最近后台操作，并按成员、邀请、额度、Provider、其他聚合摘要；每行先展示运营可读摘要，仍可展开 before/after。
- 机构角色已收口为 `owner/admin/teacher/coach/viewer/student`，后端有可执行权限矩阵；历史 `manager` 输入会兼容映射为 `admin`，但前端不再创建新的 `manager` 成员。
- 做题相关 AI 额度 reserve 和机构 BYOK provider 路由已接入 `use_ai_pool` 权限：`student/teacher/coach/admin/owner` 可以使用已分配机构池和机构 provider，`viewer` 只能查看机构学习报告，不会消耗机构 AI 额度，也不会走机构 BYOK provider。
- 配置机构 AI 额度池；
- 配置机构 BYOK/provider。

新增用户侧兑换页：

- `frontend/src/pages/OrganizationInvitePage.tsx`
- 路由：`/organizations/invite?token=...`
- API：`POST /api/v1/organizations/invites/accept`

兑换规则：

- 必须登录；
- token 只存 hash，明文只在创建/导入结果中返回；
- 邮箱绑定邀请只能由对应邮箱账号兑换；
- 校验机构状态、邀请状态、过期时间和使用次数；
- 成功后 upsert `OrganizationMember`；
- 使用次数达到上限后邀请状态变为 `used`。

## 当前可运转流程

### 批量开班

1. 管理员进入 `/admin/organizations`。
2. 创建机构。
3. 创建分组，例如 `2026 春季班`。
4. 粘贴 CSV：

```csv
email,role,cohortSlug,cohortName
student@example.com,student,fall-2026,Fall 2026
```

5. 点击预检。
6. 如果无错误，点击确认导入。
7. 已注册用户成为机构成员。
8. 未注册邮箱生成邀请 token。
9. 管理员复制全部邀请链接，或下载邀请 CSV 发给对应学生。
10. 后续可在邀请历史里查看未使用、已使用、已过期记录。
11. 管理员可看到每条邀请的创建人、接受人和接受时间，用于团队治理追踪。
12. 如果邀请不应继续使用，管理员可归档。
13. 如果历史链接丢失，管理员可从旧邀请重新生成新的邀请链接。
14. 管理员也可以按当前筛选结果下载历史状态 CSV，或批量重新生成新链接。
15. 出现运营争议时，管理员可先在机构页查看该机构治理日志，按“成员变更、邀请变更、额度变更、Provider 变更”快速定位；需要更宽范围排查时，再进入审计页筛选。

注意：邀请 token 只保存 hash，历史记录不会重新显示旧邀请链接。这是安全边界，不是功能遗漏。如果运营丢失链接，处理方式是重新生成邀请。

### 学生兑换邀请

1. 运营把 `/organizations/invite?token=...` 发给学生。
2. 学生打开链接。
3. 未登录时先登录或注册。
4. 登录后点击加入团队。
5. 系统校验 token、邮箱、过期时间、使用次数。
6. 成功后学生成为机构成员。

### 机构 AI 配置

1. 管理员进入 `/admin/organizations`。
2. 选择机构。
3. 在“团队 AI 额度池”里配置机构可用额度、预留额度、单人每日上限。
4. 在“Provider 配置”里配置 provider、model、baseUrl 和 API Key。
5. API Key 只写入加密存储，不会回显。
6. 做题相关 AI 优先走机构额度池和机构 provider；学习面板聚合分析不从这里扣费。

### 大纲驱动出题

1. 管理员进入 `/admin/csca-syllabus`。
2. 上传或粘贴 `csca-syllabus-v1` JSON。
3. 预览影响。
4. 应用草稿。
5. 受影响题目进入待复核。
6. 后续 AI 生成题会带当前大纲 scope。
7. Reviewer/Validator 会拒绝超纲、题型不符或命中 excluded scope 的候选题。

## 尚未完成但已可直接执行的下一步

### P1：邀请操作审计增强

当前后台已经把导入生成的 token 显示成 `/organizations/invite?token=...`，支持本次导入结果的一键复制和 CSV 下载，也支持历史邀请筛选查询、历史状态 CSV 导出、归档、单条重新生成和批量重新生成。邀请历史已经展示创建人、接受人、接受时间，并导出到历史 CSV。机构页已经支持成员搜索、按状态/分组筛选、角色调整、分组调整、启用、停用、归档、批量状态调整、批量转组、批量前确认、成员 CSV 导出和本次批量结果明细导出。批量结果明细会显示成功、失败、失败原因和能匹配到的审计事件 ID。审计页已经支持按机构筛选机构相关操作，展示机构名、目标邮箱、相关用户和操作人，并可展开 before/after 变更详情。机构页也已嵌入当前机构治理日志，并把事件聚合成成员、邀请、额度、Provider 四类运营摘要。

这部分当前已经从“理论流程”推进到可运营版本。后续增强不再是阻断项，主要是把摘要能力扩展到全局审计页和更细的批量失败重试。

### P2：机构治理审计看板

基于已有 admin audit log，做机构维度筛选：

- 成员新增/移除；
- 分组变更；
- 邀请创建/使用；
- 额度池变更；
- BYOK 配置变更。

### P2：大纲 JSON 模板和导入校验增强

当前已经落地：

- 后端提供 `GET /api/v1/admin/ai-questioning/syllabus-imports/template?subject=math` 模板接口；
- `/admin/csca-syllabus` 页面支持按当前科目下载标准 JSON 模板；
- 导入 validator 会校验 `schemaVersion = csca-syllabus-v1`；
- topic code 会保留原值以兼容历史题库，并校验格式类似 `M-ALG-001`；
- 同一文件内 topic code 必须唯一，查重时大小写不敏感；
- JSON topic 支持 `previousCodes`，用于新版大纲 topic code 改名时把旧知识点迁移到新 code；
- `previousCodes` 会校验格式、禁止指向本文件新 code、禁止多个新 topic 抢同一个旧 code；
- `allowedQuestionTypes` 只允许当前白名单题型；
- `difficultyRange` 只允许当前题库与规划器可识别的难度标签：`基础`、`中等`、`较难`、`挑战`、`basic`、`medium`、`hard`、`advanced`、`L1`、`L2`、`L3`；
- `sourceUrl` 只允许 HTTP/HTTPS；
- `excludedScope` 不能和 title、examScope、skills、aliases 明显冲突；
- 模板本身进入规则测试，确保下载模板可以直接通过导入校验。
- 预览会把命中 `previousCodes` 的 topic 标记为 `matchedBy = previous_code`，应用时会先把旧 code 迁移为新 code，再更新 topic 字段；
- `/admin/csca-syllabus` 预览结果会单独展示“旧 code -> 新 code”的迁移确认区，应用前可以直接看出哪些知识点会被改名而不是新建；
- 当预览中存在 code 迁移时，管理员点击“应用草稿”前会出现二次确认，确认迁移数量后才会真正应用；
- 应用记录会在 `preview_summary.apply.migrations` 中保存每条迁移明细，包括旧 code、新 code、topic id、影响题量和通过题转复核数量；
- `/admin/csca-syllabus` 最近导入列表会对已应用记录展示可展开的迁移摘要，便于事后审计；
- 全局 `/admin/audit` 审计事件会识别 `syllabus-import.apply`，直接展示大纲导入应用摘要、code 迁移条数、受影响题量和前几条迁移对照；
- 全局 `/admin/audit` 审计事件也会识别 `syllabus-import.recovery_draft`，展示来源导入、新草稿、重新预览后的新增/更新/影响题量，并提醒运营应用前重新检查当前影响；
- 全局 `/admin/audit` 审计事件支持按事件类型筛选，运营可一键切到 `resourceType = syllabus-import`，只查看大纲导入和迁移相关事件；
- 全局 `/admin/audit` 当前筛选结果可导出为 CSV，包含业务摘要、操作者、机构、目标用户、资源类型、before/after，方便运营留档和跨管理员复核；
- 全局 `/admin/audit` 审计筛选条件会同步到 URL query，管理员可把某个机构、事件类型和数量范围的排查视图直接发给其他管理员复核；
- AI 题库治理后台新增“题库运转状态”聚合判断，后端 `/api/v1/admin/ai-questioning/operational-readiness` 会综合蓝图覆盖、知识点题库健康、生成队列、考纲治理和质量 SLA，给出 `ready / needs_attention / blocked`、就绪分、阻断项、提醒项和下一步动作；前端会把内部状态码映射成“可以运转、需要处理、先处理生成队列阻断”等运营可读文案，并支持把当前运转状态下载为 CSV/JSON 报表，便于上线前评审、运营交接和问题留档；运转状态卡片的“查看下一步”会把管理员定位到对应治理区，例如生成队列、考纲工具、待复核样本、质量治理、候选题审核或主操作区，避免只看到结论却不知道去哪里处理；
- AI 题库运转状态已接入后台审计留痕：管理员点击“查看下一步”或下载 CSV/JSON 时，前端会调用 `/api/v1/admin/ai-questioning/operational-readiness/events`，后端重新计算当前 readiness 后写入 `ai-questioning / operational-readiness` 审计事件，记录 `event`、`subject`、`status`、`score`、`nextAction`、目标治理区、报告格式、阻断项和提醒项；审计页支持筛选“题库运转状态”，并把这些内部事件展示成“已查看题库运转下一步 / 已下载题库运转报告”等可读摘要；
- 审计页的事件类型下拉和快捷按钮都支持“题库运转状态”，会设置 `auditType=operational-readiness`，方便运营或管理员快速回看 readiness 查看、导出和处理路径；
- 题库运转状态卡片新增“查看留痕”，会自动切换审计筛选到 `operational-readiness` 并滚动到最近操作区；最近操作区有稳定锚点 `admin-audit-events`，便于从治理卡片回看 readiness 处理历史；
- 题库运转状态 API 现在会返回当前学科对应的最近一条 `operational-readiness` 审计事件，后台卡片直接显示“最近留痕：动作 + 时间”；如果还没有记录，则显示“暂无记录”，避免运营只看到状态分却不知道是否有人处理过；
- 最近留痕现在同时返回并展示操作者邮箱；从卡片即时更新到审计列表即时插入都携带 `actorEmail`，让运营能直接看见是谁查看下一步或下载了题库运转报告；
- readiness CSV 报告新增 `audit/latest` 行，会导出最近留痕的动作、操作者、资源范围和时间；JSON 报告继续保留完整 `latestAuditEvent`，便于运营交接或离线评审时也能看到责任链；
- readiness 报告下载流程已改为先保存本次 `download_csv / download_json` 审计事件，再生成导出文件；因此管理员实际下载到的 CSV/JSON 会包含这一次下载动作本身，而不是只包含上一次留痕；
- readiness 操作事件接口会返回刚写入的审计行，前端在“查看下一步”或下载报告成功留痕后会即时更新卡片上的最近留痕，不需要管理员刷新页面才能确认这次操作已经被记录；
- 如果当前审计列表筛选允许显示 `operational-readiness`，前端会把刚保存的 readiness 审计行即时插入“最近操作”列表顶部，并同步后台操作总数和最近操作时间；如果管理员正在看其他事件类型或机构专属事件，则不会插入不相关记录；
- 全局 `/admin/audit` 审计页新增“常用模板”快捷视图，运营可一键切到“大纲变更、邀请流转、成员变更、题库运转”；模板会复用当前机构和数量设置，机构邀请/成员模板会自动进入机构相关事件范围，题库运转模板则回到全局运转留痕，减少重复选择筛选条件；
- readiness 审计 payload 由 `buildAIQuestioningOperationalReadinessAuditSnapshot` 统一构造，限制事件类型为 `view_next_action / download_csv / download_json`，限制导出格式为 `csv / json`，并只写入压缩后的阻断项和提醒项；`scripts/csca-ai-questioning-rules-test.cjs` 已覆盖正常下载事件、未知事件降级和字段清洗，避免前端任意字段直接进入审计日志；
- `scripts/csca-ai-questioning-smoke.cjs` 已覆盖 `AIQuestioningController.recordOperationalReadinessEvent` 的真实数据库闭环：调用事件入口、重新计算指定 subject 的 readiness、写入 `adminAuditLog`，并断言审计记录包含 `nextAction` 和提醒项快照，最后清理 smoke 审计行；
- `npm run verify:csca-ai-questioning` 现在同时运行后端构建、前端构建、后端规则测试、DB-backed smoke 和 `npm --prefix frontend run test:admin-audit-summaries`，把 readiness 审计摘要、筛选、导出、锚点、最近留痕和列表即时插入纳入统一 AI 题库治理 gate；
- `npm run governance-gates:rules` 会检查 `verify:governance`、`verify:security`、`verify:local` 和 runbook 是否仍然包含关键治理/安全子检查，避免后续修改脚本时把组织权限、审计模板、大纲导入或机构 smoke 悄悄移出统一 gate；
- `npm run verify:governance` 现在同时运行后端构建、前端构建、机构治理 DB smoke、机构维度审计筛选 smoke，以及机构邀请导出、机构治理摘要、审计摘要/常用模板和大纲导入导出的前端脚本检查；团队/机构治理、审计排查模板和大纲 JSON 导入不再依赖人工记忆逐条跑脚本；
- `npm run verify:governance` 也会运行 `organization-permissions:rules`，验证机构角色集、`manager -> admin` 兼容映射、owner/admin/teacher/coach/viewer/student 的能力边界、BYOK provider 路由权限，以及前端机构页不会再创建旧 `manager` 角色；机构治理 DB smoke 还会验证 `viewer` 不会从机构 AI 池 reserve，而 `student` 会在机构池有效时从机构池 reserve；
- `npm run verify:security` 也会运行 `organization-permissions:rules`，因此 release/security 检查会覆盖机构 AI 池和机构 BYOK 的角色边界，不会只依赖组织治理 smoke 间接发现问题；
- 页面预览差异结果可导出为 CSV/JSON 报告，供应用前复核和留档，报告会带出 `matchedBy` 与 `previousCode`。
- 大纲应用后的 JSON 报告会保留 `apply` 摘要和 persisted `migrations` 明细，运营离线留档时可以看到旧 code、新 code、影响题量和转复核题量，不会只剩预览差异。
- `/admin/csca-syllabus` 页面级能力已经纳入 `npm --prefix frontend run test:syllabus-imports`：脚本会检查 JSON 文件选择器、模板下载、预览、保存草稿、应用草稿、code 迁移二次确认、选中导入记录详情、待复核题加载，以及通过/拒绝/归档受影响题目的入口，避免大纲导入只剩 helper 可用但页面操作入口退化。
- 受影响题目复核队列新增 topic ID、大纲范围和题目来源筛选，运营可以先定位某个知识点，区分“当前大纲下的编辑复核”和“过期/未发布大纲导致的漂移复核”，再只看 AI 生成、正式题库、导入题、模拟卷、专项题来源的待复核题，最后进行通过/拒绝/归档；`test:syllabus-imports` 会检查这些筛选入口和问题列表 API 参数仍然存在。
- 已保存的大纲导入新增“重建草稿”恢复路径：后台接口会复制原始 JSON、基于当前题库重新预览影响，并在 `preview_summary.recovery` 里记录来源导入 ID 和状态；前端会选中新草稿并提示运营重新检查影响后再应用。这个能力用于安全重跑/重新应用，不把复杂的反向删除、code 迁回和题目状态回滚伪装成一键回滚。
- `/admin/csca-syllabus` 的导入详情会直接展示恢复草稿的来源导入和来源状态，JSON 报告也会保留 `recovery` 区块，避免运营把恢复草稿误认为普通新草稿。
- `scripts/csca-ai-questioning-smoke.cjs` 已覆盖恢复草稿真实数据库闭环：应用一份大纲 JSON 后，通过 controller 调用 `recovery-draft` 入口，断言新草稿、原始 JSON、`preview_summary.recovery`、重新预览结果和 `adminAuditLog` 的 `recovery_draft` 事件都写入成功，并在结束时清理临时导入记录。
- 已应用的大纲导入新增“回滚预案” dry-run：后台 `POST /api/v1/admin/ai-questioning/syllabus-imports/:id/reverse-plan` 只读生成反向操作计划，不修改知识点或题目；计划会列出新增 topic 的归档建议、更新 topic 的旧快照恢复建议、code 迁移恢复建议、未覆盖 topic 状态恢复建议、当前数据漂移阻断项，以及因本次导入进入复核的题目数量。
- 回滚预案明确把题目状态恢复归为人工复核，不会自动把 `pending_review` 题改回 `approved`；如果当前 topic 已被后续操作改动，计划会标出 `current_topic_drifted_after_apply` 等 blocker，避免误用旧快照覆盖新治理结果。
- `/admin/csca-syllabus` 最近导入列表对已应用记录提供“生成回滚预案”，选中记录详情会展示 dry-run 摘要、阻断项、可自动规划项和人工复核量。全局审计页会识别 `syllabus-import.reverse_plan`，展示导入 ID、学科、操作数、阻断数、人工复核量和 dry-run 提醒。
- `scripts/csca-ai-questioning-smoke.cjs` 已覆盖回滚预案真实数据库闭环：应用大纲 JSON 后通过 controller 调用 `reverse-plan`，断言 dry-run 模式、code 迁移操作、题目复核计数、人工复核建议和压缩后的 `adminAuditLog` 都正确写入。
- 新增 `npm run csca-syllabus:recovery-drill`：该命令在本地/临时验证库运行大纲恢复演练，并把结果写入 `RELEASE_EVIDENCE_DIR`（默认 `.tmp/release-evidence/`）。证据文件会记录演练状态、覆盖范围、dry-run 安全边界和命令输出尾部，便于上线前或事故复盘留档。
- `docs/ops-runbook.md` 已新增“CSCA Syllabus Recovery Drill”章节，明确何时运行演练、如何检查 evidence、reverse plan 的 dry-run 边界、恢复草稿的使用路径，以及不得自动把待复核题恢复为通过题。

后续增强：

- 如果运营需要自定义模板，再把当前固定模板升级为可保存的个人/团队模板。
- 如果未来确实需要一键执行反向操作，应在当前 dry-run 预案基础上新增二次确认、逐项选择、数据库事务、前后快照导出和事故演练；在这些条件满足前，不应提供破坏性“立即回滚”按钮。

## 验证要求

每次推进后至少执行：

```bash
npm run prisma:validate
npm run backend:build
npm --prefix frontend run build
```

涉及大纲/AI 出题时额外执行：

```bash
npm run verify:csca-ai-questioning
npm run csca-ai-questioning:rules
```

涉及机构治理时补充一条规则脚本，覆盖：

- CSV 预检；
- 已注册用户入组；
- 未注册邮箱生成邀请；
- 邀请 token 只明文返回一次；
- 审计日志记录关键操作。

首选直接执行统一治理门禁：

```bash
npm run verify:governance
```

当前已新增并通过：

```bash
npm run organization-permissions:rules
npm run organization-governance:smoke
npm run admin-audit:organization-filter-smoke
npm --prefix frontend run test:organization-invites
npm --prefix frontend run test:organization-governance
npm --prefix frontend run test:admin-audit-summaries
npm --prefix frontend run test:syllabus-imports
npm run csca-ai-questioning:smoke
npm run csca-syllabus:recovery-drill
```

该 smoke 使用真实数据库覆盖：

- 创建临时管理员和学生；
- 创建机构；
- 创建分组；
- CSV 预检；
- CSV 导入；
- 未注册邮箱生成邀请；
- 指定邮箱邀请生成 `/organizations/invite?token=...`；
- 邀请历史能查到未使用邀请；
- 邀请历史 CSV 不包含旧 token；
- 未使用邀请可以归档；
- 归档邀请默认从有效历史里隐藏；
- 登录用户兑换邀请；
- 单次邀请兑换后变为 `used`；
- 邀请历史能按邮箱查到已使用邀请；
- 已使用邀请可以重新生成新的可发链接；
- 多个历史邀请可以批量重新生成新的可发链接；
- 审计事件能按 organizationId 筛出机构操作；
- 审计事件能继续按 resourceType 缩小到邀请操作；
- 成员关系写入分组；
- 成员可被后台停用并移出分组；
- 成员状态/分组变更会写入 `organization.member.update` 审计；
- 审计 before/after 会记录 `organizationId`、`userId`、`cohortId` 和状态变化，便于追责；
- 配置机构 AI 额度池；
- 配置机构 BYOK provider；
- 清理 smoke 数据。

邀请导出规则脚本覆盖：

- token URL 编码；
- CSV header；
- 普通邀请链接导出；
- 邮箱单元格逗号和引号转义；
- 邀请历史导出创建人、接受人和接受时间；
- 成员 CSV 导出 `id/userId/email/role/status/cohortId/cohortName`；
- 批量成员操作结果导出成功/失败、失败原因和审计事件 ID；
- 批量成员失败项可单独导出，并且机构页提供失败项重试入口；
- 下载内容和页面展示共用同一个前端 helper，避免两套链接生成逻辑漂移。

机构治理摘要脚本覆盖：

- 成员、邀请、额度池、Provider 四类事件分类；
- 成员状态/分组变化文案；
- 邀请重新生成文案；
- 额度变化文案；
- Provider 模型和 API Key 配置文案；
- 最近事件摘要计数。

大纲导出脚本覆盖：

- 预览 CSV header；
- 新增/更新 topic 行；
- 未覆盖旧 topic 行；
- 逗号和引号转义；
- JSON 报告保留 summary、incoming topics、missing topics 和 generatedAt；
- 文件名按 subject/version 生成并规避空格。
- 应用后的 JSON 报告保留 `apply.migrationCount` 和每条 persisted migration 明细。
