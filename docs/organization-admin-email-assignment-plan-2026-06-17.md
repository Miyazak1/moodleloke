# 机构管理员按邮箱授权方案

日期：2026-06-17

## 核心结论

机构管理员不是全局账号类型，而是某个用户在某个机构下的一条管理权限。

因此，必须先存在机构，才能创建或授权这个机构的管理员。

正确模型是：

```text
users.role = student
organization_members.organization_id = A
organization_members.user_id = U
organization_members.role = admin
```

含义是：用户 U 是机构 A 的管理员。这个权限只对机构 A 生效，不能管理其他机构。

## 角色边界

### 平台管理员

平台管理员来自全局用户角色：

```text
users.role = admin
```

能力：

- 创建、编辑、归档机构。
- 按邮箱给某个机构设置机构管理员。
- 查看和管理所有机构。
- 处理异常邀请、成员误绑定、额度和 provider 配置。

平台管理员是内部角色，不发给学校使用。

### 注册用户

普通注册和 Google 首次登录默认都是：

```text
users.role = student
```

这个用户可以是学生，也可以被平台授权为某个机构的管理员。是否能管理机构，不看 `users.role`，而看 `organization_members`。

### 机构管理员

机构管理员来自机构成员关系：

```text
organization_members.role = admin
organization_members.status = active
```

能力只限当前 `organization_id`：

- 管理本机构成员。
- 创建和管理本机构分组。
- 生成本机构邀请。
- 批量导入本机构学生。
- 配置本机构 AI 额度池。
- 配置本机构 provider/BYOK。

不能：

- 创建机构。
- 查看未授权机构。
- 修改其他机构成员、邀请、额度或 provider。
- 进入平台后台。
- 创建平台管理员。

## 创建机构管理员的前置条件

必须先有机构。

平台不能创建一个“游离的机构管理员账号”，因为该账号没有机构上下文，也没有明确的数据作用域。

正确顺序：

1. 平台 admin 创建机构 A。
2. 平台 admin 在机构 A 下输入负责人邮箱。
3. 系统根据邮箱授权用户为机构 A 管理员。

## 平台后台操作流程

在 `/admin/organizations` 的机构详情中新增“机构管理员”区域。

表单字段：

- 邮箱
- 角色：MVP 固定为 `admin`
- 状态：默认 `active`

按钮：

- 设为机构管理员

### 情况 1：邮箱已注册

系统查找：

```text
users.email = 输入邮箱
```

如果存在用户：

```text
upsert organization_members
where organization_id = 当前机构
and user_id = 该用户

set role = admin
set status = active
```

结果：

- 该用户登录后可以进入 `/organization`。
- 只能看到和管理当前机构。
- 不改变 `users.role`。

### 情况 2：邮箱未注册

系统创建一条机构管理员邀请。

邀请必须绑定：

```text
organization_id = 当前机构
email = 输入邮箱
role = admin
max_uses = 1
status = pending
```

对方后续用该邮箱注册或 Google 登录后，通过邀请加入机构，成为该机构管理员。

MVP 可以先复用现有邀请系统，但需要在 UI 上明确这是“管理员邀请”，不是学生邀请。

### 情况 3：邮箱已经是本机构学生

如果存在：

```text
organization_members.organization_id = 当前机构
organization_members.user_id = 该用户
organization_members.role = student
```

平台后台应提示：

```text
该邮箱已是本机构学生，确认升级为机构管理员？
```

确认后更新：

```text
role = admin
status = active
```

### 情况 4：邮箱已经是其他机构管理员

不要自动复制权限。

同一个用户可以管理多个机构，但必须由平台 admin 对每个机构分别授权。

如果邮箱已管理其他机构，平台后台可以提示：

```text
该邮箱已管理其他机构，本次只会新增当前机构权限。
```

MVP 建议允许一个账号管理多个机构，但每个机构都必须有独立 membership。

## 后端接口建议

### 平台设置机构管理员

新增：

```text
POST /api/v1/admin/csca-special-practice/adaptive/ai/organizations/:organizationId/admins
```

请求：

```json
{
  "email": "owner@example.com"
}
```

行为：

- 校验当前用户是平台 admin。
- 校验 `organizationId` 存在。
- 根据邮箱查用户。
- 已注册则 upsert `organization_members` 为 `admin`。
- 未注册则生成绑定该邮箱和机构的 admin 邀请。
- 写审计日志。
- 返回最新机构详情。

返回建议：

```json
{
  "organization": {},
  "assignment": {
    "email": "owner@example.com",
    "status": "assigned",
    "userId": 123,
    "inviteId": null
  }
}
```

未注册时：

```json
{
  "organization": {},
  "assignment": {
    "email": "owner@example.com",
    "status": "invited",
    "userId": null,
    "inviteId": 456
  }
}
```

### 机构控制台访问

学校端继续使用 scoped API：

```text
GET /api/v1/organization/me/organizations
POST /api/v1/organization/me/cohorts
POST /api/v1/organization/me/invites
POST /api/v1/organization/me/members
POST /api/v1/organization/me/credit-pool
POST /api/v1/organization/me/provider-configs
```

这些接口不能信任前端传入的任意机构 ID。后端必须根据当前登录用户查 membership：

```text
organization_members.user_id = currentUser.id
organization_members.role = admin
organization_members.status = active
organization.status = active
```

没有匹配记录则返回 403。

## 多机构管理策略

MVP 推荐：

- 一个用户可以管理多个机构。
- 一个机构可以有多个机构管理员。
- 一个用户管理多个机构时，`/organization` 只展示他被授权的机构。
- 后续若机构数量大于 1，前端再提供机构切换。
- 所有具体操作仍必须校验当前用户对目标机构有 admin membership。

如果后续希望更严格，也可以限制一个用户只能管理一个机构，但这会影响代理机构、集团校和内部测试账号。

## 数据安全规则

必须满足：

- 机构管理员不能通过修改前端请求访问其他机构。
- 平台 admin 设置机构管理员时，只能绑定到当前选中的机构。
- 未注册邮箱生成邀请时，邀请必须绑定邮箱、机构和角色。
- 指定邮箱管理员邀请默认 `max_uses = 1`。
- 邀请接受时必须校验登录邮箱和邀请邮箱一致。
- API Key 不回显。
- 额度、provider、成员、管理员授权都要写审计日志。

## UI 建议

在平台机构页新增一个面板：

标题：

```text
机构管理员
```

说明：

```text
按注册邮箱授权机构管理员。该账号仍是普通用户，只能管理当前机构。
```

输入区：

- 邮箱输入框
- “设为机构管理员”按钮

列表展示：

- 邮箱
- 用户 ID
- 角色
- 状态
- 加入时间
- 操作：停用、恢复、移除

对于未注册邮箱：

- 展示 pending admin invite。
- 提供复制邀请链接。
- 提供重新生成邀请。
- 提供归档邀请。

## 审计日志

需要记录：

- `organization.admin.assign`
- `organization.admin.invite`
- `organization.admin.promote_from_student`
- `organization.admin.disable`
- `organization.admin.archive`
- `organization.admin.restore`

审计内容：

```json
{
  "organizationId": 1,
  "email": "owner@example.com",
  "userId": 123,
  "role": "admin",
  "status": "active",
  "actorId": 9
}
```

## 验收标准

- 注册默认角色是 `student`。
- Google 首次登录默认角色是 `student`。
- 平台 admin 必须先创建机构，才能按邮箱设置该机构管理员。
- 已注册邮箱可直接被设置为当前机构管理员。
- 未注册邮箱会生成绑定当前机构的管理员邀请。
- 机构管理员登录后只能看到自己被授权的机构。
- 机构管理员不能创建机构。
- 机构管理员不能进入 `/admin/organizations`。
- 手动篡改请求中的机构 ID 也不能访问其他机构。
- 平台 admin 可以停用或移除某个机构管理员。
- 所有机构管理员授权和变更都有审计记录。

## 后续扩展

当学校端角色需求变复杂时，再拆：

- `owner`：机构最终负责人，可管理管理员、额度和 BYOK。
- `admin`：日常教务管理员，可管理成员、分组和邀请。
- `teacher`：只能管理自己分组。
- `viewer`：只读查看报告。
- `student`：学习使用。

MVP 阶段不要过早暴露这些角色。对外先保持：

- 平台管理员
- 机构管理员
- 学生
