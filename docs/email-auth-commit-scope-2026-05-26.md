# 邮箱账号完善提交范围

日期：2026-05-26

## 目标提交

建议提交名：

```bash
feat(auth): add email verification and password reset
```

这个提交只包含邮箱注册/登录完善，不包含 Google 登录、不包含 Gumroad/payment、不包含 Past Papers、不包含学校导入。

## 可以整文件 stage

这些文件的当前改动属于邮箱账号完善，可以整文件加入本提交：

```bash
git add backend/prisma/migrations/0025_auth_email_tokens/migration.sql
git add backend/src/auth/auth-email.sender.ts
git add backend/src/auth/auth.controller.ts
git add backend/src/auth/auth.service.ts
git add backend/src/auth/auth.types.ts
git add backend/scripts/security-tests.cjs
git add frontend/src/lib/auth.ts
git add frontend/src/pages/PublicAuthPage.tsx
git add frontend/src/pages/PublicMePage.tsx
git add frontend/src/styles/account.css
```

## 需要 partial stage

这些文件当前混有其他任务改动，不能整文件 `git add`。

### `.env.example`

只 stage 邮箱账号相关配置：

```env
PUBLIC_API_ORIGIN="http://localhost:3000"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM=""
SMTP_SECURE="false"
```

不要把 Gumroad 配置放进这个提交。

### `.env.production.example`

只 stage 邮箱账号相关配置：

```env
PUBLIC_API_ORIGIN="https://www.example.com"
SMTP_HOST=""
SMTP_PORT="465"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM=""
SMTP_SECURE="true"
```

不要把 Gumroad 配置放进这个提交。

### `backend/prisma/schema.prisma`

只 stage 邮箱账号相关字段和模型：

- `User.emailVerifiedAt`
- `User.emailVerificationSentAt`
- `User.authEmailTokens`
- `AuthEmailToken` model

不要把 `PastPaper` / `PastPaperFile` / `PastPaperDownload` 相关 schema 放进这个提交。

### `frontend/src/lib/api.ts`

只 stage `User` 类型上的：

- `emailVerifiedAt?: string`
- `emailVerificationSentAt?: string`

不要 stage Past Papers、Payment、AdminContentBlock 等其他类型变化。

### `frontend/src/lib/api-types.ts`

只 stage `User` 类型上的：

- `emailVerifiedAt?: string`
- `emailVerificationSentAt?: string`

不要 stage Past Papers、Payment、Scholarship 等其他类型变化。

### `frontend/e2e/public-routes.spec.ts`

只 stage 账号相关测试：

- `auth email register and reset forms validate before submit`
- `forgot password returns a generic success message`
- `/me shows unverified email warning and resend action`
- 旧账号测试中为适配确认密码而改的选择器和确认密码填写

不要 stage Past Papers、route wildcard、subject-learning、vocabulary 等其他回归调整。

## 推荐 stage 命令

先整文件加入明确属于本轮的文件：

```bash
git add backend/prisma/migrations/0025_auth_email_tokens/migration.sql
git add backend/src/auth/auth-email.sender.ts
git add backend/src/auth/auth.controller.ts
git add backend/src/auth/auth.service.ts
git add backend/src/auth/auth.types.ts
git add backend/scripts/security-tests.cjs
git add frontend/src/lib/auth.ts
git add frontend/src/pages/PublicAuthPage.tsx
git add frontend/src/pages/PublicMePage.tsx
git add frontend/src/styles/account.css
```

再对混合文件逐块挑选：

```bash
git add -p .env.example
git add -p .env.production.example
git add -p backend/prisma/schema.prisma
git add -p frontend/src/lib/api.ts
git add -p frontend/src/lib/api-types.ts
git add -p frontend/e2e/public-routes.spec.ts
```

检查 staged 范围：

```bash
git diff --cached --stat
git diff --cached --name-only
```

## 已验证

本轮已通过：

```bash
npm run verify:backend
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
npm run verify:release
```

`verify:release` 在本地会输出 SMTP 未配置的 warning，这是预期行为。生产环境需要配置 `SMTP_*` 和 `PUBLIC_API_ORIGIN`。

## 不属于本提交

当前工作区还有大量其他改动，建议另拆提交：

- Past Papers 真题资源与后台管理
- Gumroad/payment
- frontend style architecture / responsive CSS 清理
- i18n debt and smoke 调整
- school seed/import 脚本
- launch/runbook 文档
