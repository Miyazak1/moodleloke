# 邮箱验证访问策略执行影响检查

日期：2026-06-26

## 背景

本次执行 `email-verification-access-policy-architecture-plan-2026-06-26.md`，目标是把“邮箱验证”从账户页提示升级为核心服务准入规则。

执行后，系统语义变为：

```text
未登录：只能访问公开内容
已登录但邮箱未验证：只能访问账户、安全和资料补充能力
已登录且邮箱已验证：可以使用核心服务
管理员：必须邮箱已验证后才能进入后台
机构管理员：必须邮箱已验证后才能管理机构
```

## 已实现的架构改动

### 后端

新增统一访问策略基础：

- `backend/src/auth/access-policy.ts`
- `backend/src/auth/access.decorator.ts`
- `backend/src/auth/access-policy.guard.ts`

新增访问等级：

```text
public
optionalUser
user
verifiedUser
admin
organizationAdmin
```

`AuthService` 新增：

```text
getRequiredVerifiedUser()
```

邮箱未验证时返回稳定错误码：

```json
{
  "code": "email_unverified",
  "message": "请先验证邮箱后继续使用。"
}
```

`getRequiredAdmin()` 现在会先要求邮箱已验证，因此所有继续使用 `RequiredAdminGuard` 的后台接口也会受到邮箱验证保护。

### 前端

`frontend/src/lib/request.ts` 新增：

- `ApiError`
- `EMAIL_UNVERIFIED_EVENT`
- `isEmailUnverifiedError()`

当前端请求收到 `email_unverified` 时，会触发统一事件。

`frontend/src/App.tsx` 已监听该事件，并在页面顶部显示统一提示。

## 受影响功能

### 1. 管理后台

影响：

```text
未验证邮箱的 admin 不能访问后台接口。
```

原因：

`RequiredAdminGuard` 现在通过 `getRequiredAdmin()`，而 `getRequiredAdmin()` 已经要求 `emailVerifiedAt` 非空。

涉及范围：

- 用户管理。
- 内容管理。
- 学校管理。
- past papers 管理。
- mock exam 管理。
- AI 题库管理。
- 平台级机构管理。
- 审计日志。

上线注意：

如果现有管理员账号没有 `emailVerifiedAt`，上线后会被后台接口拒绝。需要在上线前执行一次管理员邮箱验证状态检查，或为可信历史管理员补一次验证状态。

已缓解：

新建管理员时会发送邮箱验证邮件。

### 2. 机构管理

影响：

```text
未验证邮箱的机构管理员不能管理机构。
```

涉及范围：

- 查看可管理机构。
- 成员管理。
- 邀请管理。
- 批量导入成员。
- 机构额度池。
- 机构模型配置。

原因：

`CscaSpecialPracticeController` 类级默认访问策略已设置为 `verifiedUser`，机构侧 `/api/v1/organization/me/...` 接口继承该策略。

### 3. 机构邀请接受

影响：

```text
学生必须验证邮箱后才能接受机构邀请或短邀请码。
```

涉及接口：

```text
POST /api/v1/organizations/invites/accept
POST /api/v1/organizations/invites/accept-code
```

原因：

接受邀请会建立组织关系，并可能影响机构额度使用。未验证邮箱接受邀请容易产生冒用和脏数据。

### 4. AI 自适应训练和 AI Coach

影响：

```text
未验证邮箱用户不能创建训练、提交训练、使用 AI hint/explanation/summary 或查询 AI entitlement。
```

涉及范围：

- adaptive session 创建。
- adaptive round 创建、保存、提交、报告。
- concept card 完成状态。
- mastery 查询。
- AI hint。
- AI explanation。
- AI round summary。
- AI entitlement。
- AI feedback。

公开保留：

```text
专项练习 overview、subject、topic start 等介绍/预览入口仍可公开访问。
```

### 5. 普通专项练习记录

影响：

```text
创建练习记录、查看我的练习记录、查看我的错题需要邮箱已验证。
```

说明：

公开浏览知识点和起始信息不受影响。

### 6. Mock Exam

影响：

```text
创建模考 attempt、读取 attempt、保存作答、交卷、查看报告、查看我的 attempts 都要求邮箱已验证。
```

这是一个明确行为变化。

此前：

```text
部分 mock exam attempt 能以匿名或可选登录方式创建和继续。
```

现在：

```text
公开浏览科目、试卷列表、试卷 start 信息仍可访问；
真正开始模考和提交模考需要邮箱已验证。
```

上线注意：

如果产品仍希望保留“匿名试做”，需要单独设计 guest attempt，而不能复用正式 mock exam attempt。

### 7. 个人中心服务

影响：

`/api/v1/me` 下大多数学习、保存、对比、AI 额度相关接口现在要求邮箱已验证。

不受影响：

```text
GET  /api/v1/me/student-profile
POST /api/v1/me/student-profile
```

这两个接口保留为已登录即可访问，方便未验证用户先补个人联系资料。

### 8. 购物车、订单和支付

影响：

```text
未验证邮箱用户不能访问购物车、添加商品、结账、创建支付。
```

原因：

购买和订单属于核心服务及交易能力，必须建立在可联系、可追踪的邮箱身份上。

### 9. 邮箱验证和账户安全流程

不受影响：

- 登录。
- 注册。
- `/api/v1/auth/me`
- 重发验证邮件。
- 修改显示名。
- 修改密码。
- 退出登录。
- 找回密码。

说明：

未验证用户仍然可以完成邮箱验证本身，不会被锁死在系统外。

## 未纳入本次强制验证的功能

### 公开浏览

继续公开：

- 首页。
- 学校浏览。
- 公开学校详情。
- 公开 past paper 列表和详情。
- mock exam 科目和试卷 start 信息。
- 专项练习介绍页。

### Optional user 预览

部分接口仍允许 optional user，例如：

- adaptive overview。
- mock exam subject paper list。
- past paper download 记录。

这些接口用于公开浏览或统计增强，不直接消耗核心额度。

## 风险和后续建议

### 风险 1：历史管理员被挡

如果历史 admin 没有 `emailVerifiedAt`，上线后无法访问后台。

建议：

上线前查询：

```sql
SELECT id, email, role, email_verified_at
FROM users
WHERE role = 'admin' AND status = 'active';
```

对可信管理员：

- 让其走验证邮件。
- 或由运维一次性补 `email_verified_at`，但需要保留操作记录。

### 风险 2：匿名 mock exam 行为变化

如果当前有用户习惯不登录直接开始模考，本次会改变体验。

建议：

- 如果要保留匿名体验，单独设计 `guestAttempt`。
- 如果正式模考应计入学习记录，则保持当前强制验证策略。

### 风险 3：旧 Guard 仍在部分 controller 中作为兼容层

本次已经新增 `AccessPolicyGuard` 和 `@Access()`，并在核心 controller 接入。

但为了降低一次性改动风险，部分后台 controller 仍继续使用 `RequiredAdminGuard`。由于 `RequiredAdminGuard` 已经通过 `getRequiredAdmin()` 继承邮箱验证要求，安全结果是正确的。

后续可继续把旧写法逐步收敛为：

```ts
@Access('admin')
@UseGuards(AccessPolicyGuard)
```

### 风险 4：错误提示目前是全局提示为主

前端请求层已经识别 `email_unverified` 并触发全局提示。页面自己的错误区域也会显示后端 message。

后续可以进一步做独立组件：

```text
EmailVerificationRequiredPanel
```

用于训练入口、邀请页和支付页的更强引导。

## 已执行检查

已通过：

```text
npm.cmd run prisma:validate
npm.cmd run backend:build
npm.cmd run frontend:build
npm.cmd run organization-permissions:rules
npm.cmd --prefix frontend run test:organization-invites
```

检查结论：

- Prisma schema 有效。
- 后端编译通过。
- 前端编译通过。
- 机构权限矩阵检查通过。
- 机构邀请导出检查通过。
- Nest `ForbiddenException` 会保留 `code: email_unverified`，前端请求层可以稳定识别。

## 总结

本次改动会影响核心服务入口，但影响方向符合产品原则：

```text
未验证邮箱可以登录和完善账号
未验证邮箱不能消耗核心服务或建立机构/交易关系
验证邮箱后服务恢复正常
```

需要在上线前重点处理历史 admin 的邮箱验证状态，以及确认是否接受 mock exam 从匿名试做改为验证后使用。
