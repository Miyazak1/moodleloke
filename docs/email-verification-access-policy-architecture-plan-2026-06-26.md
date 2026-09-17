# 邮箱验证访问策略架构方案

日期：2026-06-26

## 结论

当前系统已经有邮箱验证能力，但它还不是服务准入规则。

现状更准确地说是：

```text
注册后发送验证邮件
用户未验证邮箱也可以获得登录 token
大部分登录后服务只检查 token 有效和账号未停用
账户页提示邮箱未验证，但不阻断核心服务
```

如果产品原则是“必须验证邮箱后才能使用核心服务”，不建议用零散的接口判断修补。推荐把“是否登录”和“是否可使用服务”拆成统一访问策略层。

目标架构：

```text
公开访问
可选登录访问
已登录访问
已验证邮箱访问
管理员访问
机构管理员访问
```

邮箱验证应该是访问策略的一部分，而不是散落在业务服务里的 if 判断。

## 当前代码依据

### 用户模型已经具备字段

`backend/prisma/schema.prisma` 的 `User` 已有：

```text
email
emailVerifiedAt
emailVerificationSentAt
status
role
```

因此这次不需要新增数据库字段。

### 邮箱验证流程已经存在

`backend/src/auth/auth.service.ts` 已有：

- `sendEmailVerification()`
- `resendEmailVerificationForUser()`
- `verifyEmailToken()`
- `serializeUser()` 返回 `emailVerifiedAt`

`backend/src/auth/auth.controller.ts` 已有：

- `POST /api/v1/auth/email/verification/resend`
- `GET /api/v1/auth/email/verify`

说明基础流程可复用。

### 当前访问控制没有强制邮箱验证

`backend/src/auth/auth.guards.ts` 目前主要是：

```text
RequiredUserGuard
RequiredAdminGuard
OptionalUserGuard
```

其中 `RequiredUserGuard` 调用的是 `AuthService.getRequiredUser()`，底层只要求：

```text
token 有效
用户存在
User.status != disabled
```

它没有检查：

```text
emailVerifiedAt != null
```

所以未验证邮箱的用户现在理论上可以访问大多数登录后接口。

### 前端只是提醒，不阻断

`frontend/src/pages/PublicMePage.tsx` 会在账户页显示邮箱未验证提示和重发按钮，但不会阻止用户进入训练、购买、邀请接受等核心流程。

## 设计原则

### 1. 邮箱未验证不是账号状态

不要把 `User.status` 改成 pending 或 unverified。

推荐继续保持：

```text
User.status = active / disabled
User.emailVerifiedAt = 是否完成邮箱验证
```

原因：

- disabled 表示账号被停用或封禁。
- 未验证邮箱表示账号能力未解锁。
- 两者含义不同，混在一起会让后台管理、登录、风控、审计变复杂。

### 2. 注册后可以登录，但不能用核心服务

推荐保留注册后自动登录。

允许未验证用户做这些事：

- 查看账户页。
- 重发验证邮件。
- 退出登录。
- 修改显示名等基础资料。
- 修改或补充个人联系资料。

不允许未验证用户做这些事：

- 消耗 AI 额度。
- 开始或提交正式训练。
- 开始或提交 mock exam。
- 接受机构邀请。
- 加入学校或机构。
- 创建订单或购买额度。
- 访问管理员后台。
- 使用机构管理员能力。

这样用户不会被困在登录页，但核心资源和安全边界是锁住的。

### 3. 权限声明应该集中、可读

不建议继续扩散：

```ts
@UseGuards(RequiredUserGuard)
@UseGuards(RequiredAdminGuard)
```

推荐改成统一访问声明：

```ts
@Access('user')
@Access('verifiedUser')
@Access('admin')
@Access('organizationAdmin')
```

这样每个接口的准入规则可以直接从 controller 上读出来。

### 4. 一个策略 Guard 负责判断

推荐新增统一 guard，例如：

```text
AccessPolicyGuard
```

它读取 `@Access()` 元数据，然后集中判断：

- 是否允许匿名访问。
- 是否需要登录。
- 用户是否存在。
- 用户是否 disabled。
- 是否需要邮箱验证。
- 是否需要 admin。
- 是否需要机构管理权限。

这比新增多个散落的 guard 更干净。

### 5. 错误码必须稳定

邮箱未验证不要只返回中文 message。应该返回稳定 code：

```json
{
  "code": "email_unverified",
  "message": "请先验证邮箱后继续使用。"
}
```

前端统一识别 `email_unverified`，展示验证引导。

## 推荐访问等级

### public

不需要登录。

适用：

- 首页。
- 学校浏览。
- 公开资料。
- 登录。
- 注册。
- 邮箱验证链接。
- 找回密码。

### optionalUser

登录可增强体验，但不是必需。

适用：

- 公开题库或公开练习入口。
- 某些可匿名预览的资源。
- 可以根据登录状态返回个性化摘要的接口。

注意：如果 optionalUser 接口内部要创建用户私有记录，需要再检查是否已验证。

### user

需要登录，但不要求邮箱已验证。

适用：

- `/api/v1/auth/me`
- `/api/v1/auth/email/verification/resend`
- `/api/v1/auth/me/profile`
- `/api/v1/auth/me/password`
- `/api/v1/me/student-profile`
- 退出登录。
- 注销或安全设置入口。

### verifiedUser

需要登录，并且 `emailVerifiedAt` 非空。

适用：

- AI 训练创建、提交、报告。
- AI hint、explanation、summary。
- 个人 AI 额度查询和使用。
- mock exam 开始、提交、保存。
- saved schools、compare 是否要拦可按产品决定，建议保存类操作拦。
- 接受机构邀请。
- 创建订单、支付、购买额度。

### admin

需要登录，邮箱已验证，并且 `role = admin`。

适用：

- 平台管理后台。
- 用户管理。
- 内容管理。
- 学校资料管理。
- AI 题库管理。
- 平台级机构管理。

管理员账号不应该绕过邮箱验证。

### organizationAdmin

需要登录，邮箱已验证，并且在目标机构有管理能力。

适用：

- 机构成员管理。
- 机构邀请管理。
- 机构额度池设置。
- 机构模型配置。
- 机构导入成员。

这层可以继续复用现有 organization permission 判断，但入口先通过统一访问策略。

## 后端架构建议

### 1. 新增访问等级定义

建议新增：

```text
backend/src/auth/access-policy.ts
```

包含：

```ts
export type AccessLevel =
  | 'public'
  | 'optionalUser'
  | 'user'
  | 'verifiedUser'
  | 'admin'
  | 'organizationAdmin';
```

以及：

```ts
export const ACCESS_POLICY_KEY = 'access_policy';
```

### 2. 新增 `@Access()` 装饰器

建议新增：

```text
backend/src/auth/access.decorator.ts
```

示例：

```ts
export function Access(level: AccessLevel) {
  return SetMetadata(ACCESS_POLICY_KEY, level);
}
```

后续 controller 使用：

```ts
@Access('verifiedUser')
@Post('api/v1/.../ai/hint')
```

### 3. 新增统一 `AccessPolicyGuard`

建议新增：

```text
backend/src/auth/access-policy.guard.ts
```

核心逻辑：

```text
public:
  直接通过

optionalUser:
  有 token 就解析用户，没有 token 也通过

user:
  必须有有效 token
  用户不能 disabled

verifiedUser:
  先满足 user
  再要求 emailVerifiedAt 非空

admin:
  先满足 verifiedUser
  再要求 role = admin

organizationAdmin:
  先满足 verifiedUser
  再由业务层或 guard extension 检查机构权限
```

### 4. AuthService 暴露清晰方法

当前已有：

```text
getRequiredUser()
getRequiredAdmin()
getOptionalUser()
```

建议补充或重命名成更明确的内部能力：

```text
resolveOptionalUser()
requireActiveUser()
requireVerifiedUser()
requireAdminUser()
```

其中 `requireVerifiedUser()` 的判断应该集中在 AuthService 或 AccessPolicyGuard 里，不要写进每个业务 service。

### 5. 统一异常

建议新增统一异常 helper：

```text
throwEmailUnverified()
```

返回 HTTP 403，并带稳定 code：

```json
{
  "code": "email_unverified",
  "message": "请先验证邮箱后继续使用。"
}
```

当前项目如果已有全局异常格式，应接入现有格式；没有的话，至少保证 response body 有 `code`。

### 6. 保留旧 Guard 作为迁移壳

为了降低一次性改动风险，可以短期保留：

```text
RequiredUserGuard
RequiredAdminGuard
OptionalUserGuard
```

但它们内部可以逐步改为调用统一策略，或者仅作为兼容层。

最终目标是 controller 不再直接使用这些旧 guard，而是统一使用：

```ts
@UseGuards(AccessPolicyGuard)
@Access(...)
```

如果全局注册 `AccessPolicyGuard`，则 controller 只需要声明 `@Access(...)`。

## 需要调整的接口范围

### 保持 user 的接口

这些接口允许未验证邮箱用户访问：

```text
GET  /api/v1/auth/me
POST /api/v1/auth/email/verification/resend
PATCH /api/v1/auth/me/profile
PATCH /api/v1/auth/me/password
GET  /api/v1/me/student-profile
POST /api/v1/me/student-profile
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
```

说明：

- `/me` 必须可访问，否则用户无法看到验证提醒。
- 重发验证邮件必须可访问。
- 没有密码的 OAuth 账号设置密码仍可要求邮箱验证，这是账号安全规则，不冲突。

### 改为 verifiedUser 的接口

建议首批改这些：

```text
POST /api/v1/organizations/invites/accept
POST /api/v1/organizations/invites/accept-code
GET  /api/v1/me/ai-credits
```

自适应训练：

```text
POST /api/v1/csca-special-practice/adaptive/sessions
GET  /api/v1/csca-special-practice/adaptive/sessions/:id
POST /api/v1/csca-special-practice/adaptive/sessions/:id/rounds
GET  /api/v1/csca-special-practice/adaptive/sessions/:id/rounds/:roundId
PATCH /api/v1/csca-special-practice/adaptive/sessions/:id/rounds/:roundId
POST /api/v1/csca-special-practice/adaptive/sessions/:id/rounds/:roundId/check-answer
POST /api/v1/csca-special-practice/adaptive/sessions/:id/rounds/:roundId/submit
GET  /api/v1/csca-special-practice/adaptive/sessions/:id/rounds/:roundId/report
POST /api/v1/csca-special-practice/adaptive/ai/hint
POST /api/v1/csca-special-practice/adaptive/ai/explanation
POST /api/v1/csca-special-practice/adaptive/ai/round-summary
```

专项练习私有记录：

```text
GET /api/v1/csca-special-practice/my/sessions
GET /api/v1/csca-special-practice/my/wrong-questions
```

mock exam：

```text
POST /api/v1/csca-mock-exam/attempts
PATCH /api/v1/csca-mock-exam/attempts/:id
```

支付和订单：

```text
commerce controller 下的登录后购物车/订单接口
payments controller 下的创建支付/兑换接口
```

个人保存类能力：

```text
POST /api/v1/me/saved-schools
DELETE /api/v1/me/saved-schools/:schoolId
POST /api/v1/me/compare
DELETE /api/v1/me/compare/:schoolId
```

### 改为 admin 的接口

当前所有 `RequiredAdminGuard` 保护的后台接口都建议进入 `admin` 策略。

包括：

- 用户管理。
- 内容管理。
- 学校管理。
- past papers 管理。
- mock exam 管理。
- AI 题库管理。
- 平台级机构管理。
- 审计日志。

### 改为 organizationAdmin 的接口

当前机构侧接口主要在：

```text
/api/v1/organization/me/...
```

建议策略：

```text
先 verifiedUser
再检查用户是否是当前机构 owner/admin/teacher 等有管理 capability 的成员
```

现有 organization permission 可以继续复用。

## 前端架构建议

### 1. 统一 API 错误识别

在前端请求层统一识别：

```text
email_unverified
```

不要每个页面自己判断 message。

建议在 `frontend/src/lib/api.ts` 或当前统一 request helper 中，把错误保留为结构化对象：

```ts
{
  code: 'email_unverified',
  message: '请先验证邮箱后继续使用。'
}
```

### 2. 建立统一验证引导组件

建议新增组件：

```text
EmailVerificationRequiredPanel
```

内容：

- 当前邮箱。
- “请先验证邮箱后继续使用。”
- “重发验证邮件”按钮。
- “去账户页”按钮。

使用场景：

- 训练入口。
- 邀请接受页。
- 购买页。
- 机构管理入口。

### 3. 前端不作为唯一安全边界

前端可以提前隐藏或提示，但真正阻断必须在后端完成。

前端规则：

```text
currentUser.emailVerifiedAt 为空时，核心入口显示验证提示
如果仍然请求接口，后端返回 email_unverified
前端统一展示引导
```

### 4. 账户页保留未验证状态提示

`PublicMePage` 当前已有提示和重发按钮，可以保留，并把文案加强为：

```text
验证邮箱后即可使用训练、购买、学校邀请等服务。
```

## 迁移计划

### Phase 1：策略层落地

- 新增 `AccessLevel`。
- 新增 `@Access()`。
- 新增 `AccessPolicyGuard`。
- 新增 `requireVerifiedUser()` 或等价逻辑。
- 新增稳定错误码 `email_unverified`。
- 先不大规模替换业务接口。

验收：

- 未验证用户访问 `verifiedUser` 测试接口时返回 403 和 `email_unverified`。
- 未验证用户仍可访问 `/api/v1/auth/me` 和重发验证邮件。

### Phase 2：核心服务切换

- 训练和 AI 消耗接口切到 `verifiedUser`。
- 机构邀请接受接口切到 `verifiedUser`。
- 支付和订单接口切到 `verifiedUser`。
- 管理后台接口切到 `admin`，并隐含邮箱已验证。

验收：

- 未验证用户不能消耗 AI 额度。
- 未验证用户不能接受机构邀请。
- 未验证用户不能购买。
- 未验证管理员不能进入后台。

### Phase 3：前端统一引导

- API 层识别 `email_unverified`。
- 增加统一验证引导组件。
- 在训练、邀请、购买、机构管理入口接入。
- 账户页文案说明验证后可使用核心服务。

验收：

- 用户不会看到生硬的 403。
- 可以一键重发验证邮件。
- 验证后刷新登录态，入口恢复可用。

### Phase 4：旧 Guard 收敛

- 逐步减少 controller 中直接使用 `RequiredUserGuard`、`RequiredAdminGuard`、`OptionalUserGuard`。
- 统一改为 `@Access(...)`。
- 保留旧 Guard 仅作兼容，或最终移除。

验收：

- 新增接口必须声明访问等级。
- 搜索 `UseGuards(RequiredUserGuard)` 数量明显下降或归零。
- 管理员和机构管理员规则都从同一策略层进入。

## 测试建议

### 后端测试

至少覆盖：

- 未验证用户可以登录。
- 未验证用户可以访问 `/api/v1/auth/me`。
- 未验证用户可以重发验证邮件。
- 未验证用户访问 `verifiedUser` 接口返回 `email_unverified`。
- 已验证用户可以访问 `verifiedUser` 接口。
- disabled 用户无论是否验证都不能访问。
- 未验证 admin 不能访问后台。
- 已验证 admin 可以访问后台。
- Google verified email 登录用户可以正常访问核心服务。

### 前端测试

至少覆盖：

- 未验证用户进入账户页看到验证提示。
- 未验证用户点击训练入口看到验证引导。
- 未验证用户打开邀请页时不能接受邀请，并看到验证引导。
- 重发验证邮件按钮可用。
- 邮箱验证成功后，用户重新加载状态，核心入口可用。

## 产品边界

### 不阻断公开浏览

公开学校浏览、公开介绍页、登录注册页不应要求邮箱验证。

### 不阻断账号安全操作

邮箱未验证用户必须能完成验证本身，因此账户页、重发邮件、退出登录不能被阻断。

### 不把资料完整度混入邮箱验证

电话、住址、个人信息属于资料完整度。它可以作为机构入学或购买后的资料要求，但不应该和邮箱验证混成同一个 access level。

后续如果需要，可以增加独立策略：

```text
profileCompleteUser
```

但第一阶段不要引入，避免把访问策略做复杂。

## 与机构绑定方案的关系

机构邀请接受必须要求邮箱已验证。

原因：

- email 定向邀请依赖邮箱身份。
- 通用邀请码也会建立组织关系。
- 组织关系会影响机构额度使用。
- 未验证邮箱接受邀请会增加冒用和脏数据风险。

推荐规则：

```text
学生可以注册并登录
学生必须验证邮箱
学生接受机构邀请
学生补充个人联系资料
学生使用机构或个人 AI 额度
```

其中个人联系资料不要求在注册时填写。

## 推荐最终形态

```text
AuthService
  负责解析 token、查用户、判断 active、判断 emailVerifiedAt

AccessPolicyGuard
  负责统一执行访问策略

@Access(...)
  负责声明 controller 入口需要的访问等级

业务 service
  不再关心邮箱验证，只处理业务规则

前端 request 层
  统一识别 email_unverified

前端页面
  使用统一验证引导组件
```

这套方案比单独新增 `RequiredVerifiedUserGuard` 更干净。它把邮箱验证从“某些接口的临时检查”提升为“服务准入策略”，后续接入机构权限、资料完整度、付费权限、风控限制时也有稳定位置。

