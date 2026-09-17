# 学生组织绑定、个人资料与邀请码方案

日期：2026-06-25

## 结论

当前分支已经具备落地“学校/机构绑定 + 班级/分组可选 + 个人 AI 额度兜底”的核心基础。推荐保留现有数据模型和邀请链路，不在注册表单中要求学生手填国家、学校、班级、年级。

推荐策略：

- 注册阶段只创建账号：邮箱、密码、默认学生角色。
- 学校/机构不让学生自由手填，优先由邀请码、邀请链接或管理员后台分配确定。
- 班级/分组不作为注册字段，使用 `OrganizationInvite.cohortId` 或管理员后台转组确定。
- 国家、年级等信息属于学生画像或申请背景，应该在相关业务场景中逐步补充。
- AI 额度采用“机构优先，个人兜底”：有可用机构额度池时扣机构额度；没有机构额度或机构额度不可用时，可以继续使用个人额度。
- 个人 AI 额度和机构绑定不冲突。个人额度用于个人充值和默认体验额度，机构额度用于学校统一采购和管理。

这套方案比注册时强制填写国家、学校、班级、年级更稳：注册阻力低，学校/班级数据更干净，也更符合当前代码结构。

## 字段采集阶段

| 字段 | 建议采集阶段 | 主要决定方 | 说明 |
| --- | --- | --- | --- |
| 邮箱、密码 | 注册时 | 学生 | 只完成账号创建，降低注册流失。 |
| 国家/国籍 | 进入择校、奖学金、申请规划、个人资料完善时 | 学生 | 属于个人背景，不一定和机构绑定相关。 |
| 学校/机构 | 打开邀请链接、输入邀请码、管理员后台分配时 | 学校/老师/管理员 | 避免学生手填错学校、重名学校、冒充加入。 |
| 班级/分组 | 邀请码携带 `cohortId`，或老师后台分配 | 学校/老师/管理员 | 班级是管理维度，不适合学生自由填写。 |
| 年级 | 学习画像、申请背景、或机构分组 metadata | 视业务场景而定 | 如果用于教学管理，由机构侧维护；如果用于学习推荐，可由学生补充。 |

核心原则：

```text
账号注册 = 身份创建
机构绑定 = 授权与管理关系
班级分组 = 教学运营关系
国家/年级 = 学生画像或申请背景
```

## 当前代码依据

### 账号注册

`backend/src/auth/auth.service.ts` 中 `AuthService.register()` 当前只要求邮箱和密码，并创建默认学生账号：

```text
role = student
```

这符合“注册只创建账号”的策略，不建议把学校、班级、年级塞进注册流程。

### 组织与分组模型

`backend/prisma/schema.prisma` 中已有：

- `Organization`：学校/机构，包含 `slug`、`name`、`type`、`status`。
- `OrganizationMember`：用户和机构的关系，包含 `organizationId`、`userId`、`cohortId`、`role`、`status`、`expiresAt`。
- `OrganizationCohort`：机构内分组，可承载班级、年级、校区、项目批次等。
- `OrganizationInvite`：机构邀请入口，包含 `organizationId`、`cohortId`、`email`、`role`、`tokenHash`、`status`、`maxUses`、`usedCount`、`expiresAt`。
- `OrganizationAiCreditPool`：机构 AI 额度池，包含 `availableCredits`、`reservedCredits`、`perUserDailyLimit`、`expiresAt`、`status`。

其中最关键的是：

```text
OrganizationMember.cohortId  可空
OrganizationInvite.cohortId  可空
```

因此无需新增两套邀请码表，也无需立即新增独立 `Class` 表。

### 邀请链路

`backend/src/csca-special-practice/ai-entitlement.service.ts` 已有：

- `createOrganizationInvite()`：创建机构邀请。
- `acceptOrganizationInvite()`：学生登录后接受邀请。
- `listOrganizationInvites()`：查看邀请历史。
- `archiveOrganizationInvite()`：归档邀请。
- `reissueOrganizationInvite()` / `reissueOrganizationInvites()`：重新生成邀请。
- `applyOrganizationMemberImport()`：批量导入成员或创建邀请。

当前 token 方式是长随机 token：

```text
randomBytes(24).toString('base64url')
```

数据库只保存 SHA-256 后的 `tokenHash`。这适合作为默认邀请链接，不建议一开始用短码替代。

### 前端入口

前端已有：

- `frontend/src/pages/OrganizationInvitePage.tsx`
- `/organizations/invite?token=...`
- 未登录时跳转登录/注册，登录后再接受邀请。
- `frontend/src/lib/api-me.ts` 中已有 `acceptOrganizationInvite(token)`。

因此学校/班级加入流程可以复用现有邀请链接，不需要改注册表单。

## 推荐产品流程

### 个人学生路径

适合没有学校邀请码、先自主学习或使用个人充值额度的学生。

```text
学生注册账号
-> 直接进入学习产品
-> 可使用默认个人 AI 额度
-> 可购买个人 AI 额度
-> 后续在择校/奖学金/学习画像场景补充国家、年级等信息
-> 如果之后获得学校邀请码，再加入机构
```

此路径下：

```text
User.role = student
OrganizationMember 暂无记录
CscaAIEntitlementAccount 使用个人额度
```

### 学校级邀请路径

适合学校统一管理学生，但不细分班级。

```text
学生注册或登录
-> 打开学校邀请链接
-> 接受邀请
-> 创建 OrganizationMember，cohortId = null
-> 如果机构 AI 额度池可用，优先使用机构额度
-> 如果机构额度不可用，继续回退个人额度
```

数据结果：

```text
OrganizationInvite.organizationId = 学校 ID
OrganizationInvite.cohortId = null
OrganizationInvite.role = student

OrganizationMember.organizationId = 学校 ID
OrganizationMember.cohortId = null
OrganizationMember.role = student
OrganizationMember.status = active
```

### 班级级邀请路径

适合老师按班级、年级、项目批次管理学生。

```text
学生注册或登录
-> 打开班级邀请链接
-> 接受邀请
-> 创建 OrganizationMember，cohortId = 对应班级/分组 ID
-> 老师可以按 cohort 管理学生
-> AI 额度仍然遵循机构优先、个人兜底
```

数据结果：

```text
OrganizationInvite.organizationId = 学校 ID
OrganizationInvite.cohortId = 班级/分组 ID
OrganizationInvite.role = student

OrganizationMember.organizationId = 学校 ID
OrganizationMember.cohortId = 班级/分组 ID
OrganizationMember.role = student
OrganizationMember.status = active
```

## AI 额度策略

当前产品规则应采用：

```text
机构额度可用 -> 优先扣机构额度
机构额度不可用 -> 回退个人额度
个人额度不足 -> 降级或提示购买个人额度
```

不建议把“绑定机构”作为所有学生使用 AI 的硬门槛，因为个人额度本身就是个人充值和默认体验额度。学生没有机构关系时，仍然可以使用个人额度。

因此不建议引入下面这种强制开关作为默认策略：

```text
CSCA_AI_REQUIRE_ORGANIZATION_FOR_STUDENTS=true
```

如果未来某些学校采购场景需要强管控，可以做成特定机构、特定课程、特定 AI 能力的策略，而不是全局阻断个人用户。

当前 `AIEntitlementService.reserve()` 的主方向是正确的：

1. rule fallback 不扣额度。
2. 优先查找 active 机构成员关系和 active 机构额度池。
3. 机构额度池可用时扣 `OrganizationAiCreditPool`。
4. 否则回退个人 AI 额度账户。

建议前端展示时区分两类余额：

```text
机构额度：由学校/机构提供，加入机构后可用。
个人额度：由个人默认赠送或充值获得，始终属于个人账户。
```

这样学生不会误解“加入学校后个人额度消失”或“没有学校就不能用 AI”。

## 学校、班级、国家、年级的具体处理

### 学校

不建议学生注册时手填学校。

原因：

- 学校名称容易重名或写错。
- 手填会产生无法对账的数据。
- 学校绑定影响额度、权限、账单和管理，应由邀请或管理员确认。

推荐方式：

```text
邀请链接确定 organizationId
管理员后台直接添加成员
批量导入成员
```

### 班级

不建议学生注册时手填班级。

班级是机构内部管理维度，推荐由：

```text
OrganizationInvite.cohortId
OrganizationMember.cohortId
老师后台转组
批量导入时的 cohortSlug / class 字段
```

来决定。

### 年级

年级有两种语义，需要区分：

- 教学管理年级：由学校或老师维护，可以放在 `OrganizationCohort.metadata`。班级容量使用 `OrganizationCohort.metadata.seatLimit`，用于限制班级邀请和接受邀请时的剩余席位。
- 学生学习阶段：由学生在学习画像或个人资料里补充。

MVP 不建议新增独立 `Grade` 或 `Class` 表。可以先使用：

```json
{
  "grade": "G11",
  "className": "2026 Spring A",
  "campus": "main"
}
```

放在 `OrganizationCohort.metadata` 或后续学生画像 metadata 中。

### 国家/国籍

国家不属于机构绑定必填项。

建议在这些场景中询问：

- 第一次进入择校推荐。
- 第一次查看奖学金匹配。
- 创建申请规划。
- 完善个人资料。

如果国家信息只用于内容推荐或申请资格判断，就不应该阻塞注册和基础学习。

## 邀请创建策略

### 学校级邀请

```text
cohortId = null
email = null 或指定学生邮箱
role = student
maxUses = 购买席位或管理员显式填写
expiresAt = 默认 30 天，或由管理员显式设置
```

### 班级级邀请

```text
cohortId = 具体分组 ID
email = null 或指定学生邮箱
role = student
maxUses = 班级容量或管理员显式填写
expiresAt = 默认 30 天
```

### 单学生邀请

```text
email != null
maxUses = 1
role = student / teacher / admin 等按权限规则限制
expiresAt = 默认 7 天
```

## 已落地和仍需关注的产品细节

### 1. 管理后台创建邀请时应显式选择类型

当前 `frontend/src/pages/AdminOrganizationsPage.tsx` 创建学生邀请时默认使用：

```text
cohortId = selected.cohorts[0]?.id ?? null
```

这会导致只要机构存在分组，默认邀请就变成第一个分组的班级邀请。建议改为：

```text
默认 cohortId = null
管理员显式选择分组后，才创建班级级邀请
```

前端文案：

```text
不选分组：学校级邀请
选择分组：班级/分组级邀请
```

### 2. 创建邀请时应显式填写 maxUses

当前无 email 的通用邀请默认 `maxUses = 50`。这可以作为兜底，但学校场景更适合让管理员明确填写人数，或根据购买席位/班级容量自动建议。

建议：

```text
通用邀请必须显式确认 maxUses
默认显示建议值，但提交时让管理员知道这个邀请最多可被多少人使用
```

### 3. 邀请默认应有过期时间

当前 `expiresAt` 可空，历史兼容可以保留，但新建通用邀请建议默认 30 天。

建议：

```text
通用学校/班级邀请：默认 30 天
单学生 email 邀请：默认 7 天
长期有效：只允许平台 admin 或有明确权限的机构管理员选择
```

### 4. 公开邀请只允许 student

如果 `email = null`，即通用邀请，建议强制：

```text
role = student
```

teacher/admin/owner 邀请应该是：

```text
email != null
maxUses = 1
```

### 5. 接受邀请时避免角色提权

当前 `acceptOrganizationInvite()` 使用 upsert，若已有 membership，会更新 `cohortId`、`role`、`status`。这对转组很方便，但要防止学生通过公开邀请把自己提升为 teacher/admin。

建议规则：

```text
公开邀请只能授予 student
如果 invite.role 高于当前 membership.role，必须是 email 定向邀请或管理员后台操作
同一学校内可通过邀请切换 cohort
跨学校加入是否允许，需要产品规则明确
```

## 是否允许一个学生加入多个机构

MVP 建议先采用简单规则：

```text
学生可以拥有个人 AI 额度。
学生可以加入机构以获得学校管理和机构额度。
同一学生是否可同时加入多个 active 机构，由产品策略决定。
```

如果允许多机构，需要进一步明确：

- AI 调用时是否需要指定当前 organization。
- 多个机构额度都可用时，优先扣哪个。
- 个人页和学习报告展示哪个机构上下文。

当前实现采用轻量选择规则：学生资料中保存 `currentOrganizationId`。学生未选择时，沿用自动选择可用机构额度；学生选择后，AI 优先尝试当前机构额度，当前机构额度不可用时回退个人额度，而不是静默切到另一个机构。

如果暂时不做多机构切换，建议：

```text
同一学生默认只维护一个主要 active 学校关系。
同一学校内可以切换 cohort。
转校或跨机构变更由管理员处理。
```

## 短码能力

短码适合线下课堂手输，但不应替代默认长链接。当前实现采用“长 token 链接 + 学生短邀请码”的组合。

默认入口仍然保留：

```text
/organizations/invite?token=<long-random-token>
```

学生邀请额外生成短邀请码，线下场景可以手动输入。短码接受使用独立接口：

```text
POST /api/v1/organizations/invites/accept-code
body: { code: string }
```

短码规则：

- 当前生成 10 位，接受 8-12 位。
- 避免 `0/O`、`1/I/L` 等混淆字符。
- 统一转大写。
- 只存 hash。
- 默认有效期 7 或 30 天。
- 只允许 student role。
- 已增加同账号短码错误次数限制和尝试记录；可归属到具体机构邀请的接受、失败、限流记录会显示在机构管理端的“邀请安全”区域。后续可继续补同 IP、同设备维度。

不要把短码和长 token 混在一个字段里猜测，以免审计和错误处理混乱。

## 前端改造建议

### 注册后

注册成功后不强制学生填写学校、班级、年级。

可以显示轻量引导：

```text
有老师或学校的邀请码？
加入学校/班级后，可使用学校提供的额度和班级学习安排。
```

按钮：

```text
输入邀请码
稍后再说
```

### 个人资料/学习画像

在个人资料或学习画像中逐步补充：

```text
国家/国籍
当前年级/学习阶段
目标考试
目标申请年份
```

这些字段不阻塞基础学习。

### AI 额度展示

建议展示两层信息：

```text
个人额度：50 次 / 已购买额度 / 剩余额度
机构额度：学校提供 / 当前机构 / 是否可用
```

当机构额度不可用但个人额度可用时，不应提示“无法使用 AI”，而应提示：

```text
当前将使用你的个人 AI 额度。
```

当个人额度也不足时，再引导购买。

### 机构邀请页

邀请页应明确显示：

```text
即将加入：学校/机构名称
分组/班级：如有
角色：学生
```

当前接受接口已返回 organization、membership 和 cohortName，邀请页可以直接展示“加入哪个学校/班级”。

## 后端改造建议

### 1. 保留机构优先、个人兜底

不需要增加全局“学生必须绑定机构才能使用 AI”的硬门槛。

`AIEntitlementService.reserve()` 当前方向可保留：

```text
active organization entitlement 可用 -> 机构扣费
否则 -> 个人账户扣费
```

### 2. 补充额度来源给前端

`getSummary()` 已经能返回 organization 信息。建议前端类型和展示补齐：

```text
organization: null | {
  id
  slug
  name
  balanceUnits
  reservedCredits
  perUserDailyLimit
  expiresAt
  providerConfigured
}
```

这样前端可以展示“个人额度”和“机构额度”的来源区别。

### 3. 邀请创建默认值收紧

建议调整：

```text
email = null 时，role 必须为 student
通用邀请默认 expiresAt
maxUses 需要管理员显式确认
```

### 4. 接受邀请时增加角色安全检查

建议增加规则：

```text
已有 membership 时，不允许通过公开邀请提升角色
公开邀请只能创建或更新 student membership
高权限角色邀请必须 email 定向
```

### 5. 成员状态约定

当前 status 是字符串，可继续沿用：

```text
pending
active
disabled
archived
```

AI 机构额度只认 active membership。pending 已用于邀请审核模式：邀请可配置 `requiresApproval`，学生接受后先进入 pending，老师在成员列表启用后才成为 active。

## 数据迁移建议

MVP 不需要新增独立 `Class`、`Grade` 表。学校和班级仍复用现有组织模型，国家/年级等学生画像字段使用轻量的独立资料表承载。

保持：

```text
User
Organization
OrganizationMember
OrganizationCohort
OrganizationInvite
OrganizationAiCreditPool
CscaAIEntitlementAccount
```

新增：

```text
StudentProfile
OrganizationInvite.shortCodeHash
```

其中 `StudentProfile` 用于保存学生逐步补充的 `nationality`、`country`、`grade` 和 `currentOrganizationId`，不参与注册必填；`OrganizationInvite.shortCodeHash` 只保存短邀请码 hash，不保存明文短码。

后续如果班级管理复杂化，再考虑：

```text
Class
ClassMembership
Grade
TeacherClassAssignment
```

但现在过早拆表会增加实现成本，也会把“班级/分组/年级/项目批次”这些还没稳定的概念固化得太早。

## 推荐实施顺序

### Phase 1：产品规则和文案落地

- 注册不增加学校、班级、年级字段。
- 注册后增加轻量“输入邀请码”入口。
- 明确个人额度和机构额度并存。
- 个人学生可继续使用个人 AI 额度。

### Phase 2：邀请码创建体验修正

- 管理后台创建邀请时显式选择分组。
- 默认不选分组，即学校级邀请。
- 选择分组后，才是班级级邀请。
- 通用邀请要求管理员确认最大使用次数。
- 新邀请默认到期时间。

### Phase 3：邀请安全增强

- 公开邀请只允许 student。
- teacher/admin/owner 邀请必须 email 定向且 `maxUses = 1`。
- 接受邀请时防止角色提权。
- 邀请历史突出 used/max、到期时间、最近接受者。

### Phase 4：学生画像补充

- 在择校、奖学金、申请规划等场景询问国家/国籍。
- 在学习画像中询问年级/学习阶段。
- 如果年级用于机构教学管理，优先放入 cohort metadata。

### Phase 5：运营增强

- pending 审核模式。（已用邀请 `requiresApproval` + 成员 `pending` 状态落地）
- 邀请异常使用提醒。（已落地短码尝试记录、账号级限频，以及机构管理端近期短码使用记录）
- 班级容量和席位数联动。（已用 `OrganizationCohort.metadata.seatLimit` 落地，创建邀请和接受邀请都会检查剩余席位）
- 多机构学生场景下增加当前 organization 选择。（已用 `StudentProfile.currentOrganizationId` 落地）
- 如有线下课堂需要，再增加短码。

## 最终建议

采用：

```text
注册只建账号
学校通过邀请绑定
班级通过 cohort 绑定
国家/年级按业务场景逐步补充
AI 额度机构优先、个人兜底
```

底层继续复用当前模型：

```text
User
-> OrganizationMember, optional
-> OrganizationCohort, optional
-> CscaAIEntitlementAccount, personal credits
-> OrganizationAiCreditPool, organization credits
```

邀请继续使用现有 `OrganizationInvite`：

```text
cohortId = null      学校级邀请
cohortId != null     班级/分组级邀请
```

这套方案既支持个人学生直接学习和充值，也支持学校统一采购、班级管理和机构额度；同时不污染注册流程，最大限度复用当前代码，改造成本较低。
