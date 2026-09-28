# CSCALITE → Moodlelike 认证收口决策与实施清单

> 日期：2026-09-28
> 决策状态：Accepted
> 范围：注册、密码登录、邮箱验证、密码重置、刷新会话、Google OAuth、管理员认证

## 1. 决策

Moodlelike 保留为唯一认证服务和唯一代码实现；生产切换时迁入 CSCALITE 的用户数据、OAuth 绑定、刷新会话和生产认证配置。

不把 CSCALITE AuthModule 覆盖到 Moodlelike，也不让 Moodlelike 长期反向代理旧 CSCALITE 认证接口。

```text
保留：Moodlelike 认证代码
继承：CSCALITE 生产用户数据与认证配置
兼容：CSCALITE Cookie 和浏览器存储身份
退役：CSCALITE 独立认证进程
```

## 2. 代码审计证据

### 2.1 后端认证能力已经同源

两个仓库的 `backend/src/auth` 只有三个文件存在差异：

- `auth-email.sender.ts`：默认 EHLO/message-id 域由 `cscalite.local` 改为 `moodlelike.local`；
- `auth.cookies.ts`：默认 Cookie 名改为 Moodlelike，同时改用统一的生产环境判断；
- `auth.service.ts`：本地开发 secret、内部占位邮箱和邮件品牌文案改为 Moodlelike。

认证控制器路由和业务流程一致，包括：

- `POST /api/v1/auth/register`；
- `POST /api/v1/auth/login`；
- `POST /api/v1/auth/refresh`；
- `GET /api/v1/auth/google/start`；
- `POST /api/v1/auth/google/link/start`；
- `GET /api/v1/auth/google/callback`；
- 邮箱验证、重发、忘记密码、重置密码；
- logout、logout-all、me、个人资料和密码修改。

结论：CSCALITE 没有一套 Moodlelike 缺失的认证后端。Moodlelike 是同一实现的后续版本。

### 2.2 数据库认证结构一致

以下 migrations 在两个仓库中完全一致：

- `0006_refresh_sessions`；
- `0022_google_oauth_accounts`；
- `0025_auth_email_tokens`。

`User`、`RefreshSession`、`OAuthAccount` 和 `AuthEmailToken` 模型一致。两个 schema 的现有差异只来自 Moodlelike 新增的 Agent 会话 scope/lifecycle 字段，与认证迁移不冲突。

因此，第一次完整数据复制会自然保留：

- 原用户 ID、邮箱、密码哈希和角色；
- 邮箱验证状态；
- Google provider subject 绑定；
- 未过期且未撤销的 Refresh Session；
- 尚有效的验证/重置 token 记录。

### 2.3 前端 Moodlelike 更适合作为最终实现

Moodlelike 前端认证客户端新增或保留了：

- `storeAccessToken` 统一写入路径；
- `AUTH_STORAGE_KEYS` 统一监听；
- `storage-compat` 对旧 `cscalite.*` localStorage key 的单向迁移；
- `moodlelike.currentUser` 与 `cscalite.currentUser` 的兼容迁移。

把 CSCALITE 前端认证文件覆盖回来会删除这些兼容能力，因此禁止覆盖。

## 3. 切换时必须继承的生产身份

下列值必须从当前 CSCALITE 生产配置安全转移到 Moodlelike 候选环境。不得在终端截图、Git、Issue 或聊天中展示真实值。

### 3.1 必须保持原值

- `AUTH_SECRET`；
- 若仍使用，则 `JWT_SECRET`；
- `GOOGLE_CLIENT_ID`；
- `GOOGLE_CLIENT_SECRET`；
- `GOOGLE_OAUTH_REDIRECT_URI`；
- SMTP 连接与发件人配置；
- `AUTH_REFRESH_COOKIE_ENABLED`；
- `AUTH_LEGACY_REFRESH_FALLBACK_ENABLED` 的当前策略；
- 管理员账号数据来自数据库，不重新 bootstrap 覆盖。

只迁移数据库但更换 `AUTH_SECRET`，会导致原 access/refresh token 签名不再被接受。只迁移 Google Client ID 而漏掉 secret 或回调地址，会使 Google callback 失败。

### 3.2 第一阶段保持 CSCALITE Cookie 名

为了让旧浏览器登录态尽可能延续，首次切换明确覆盖 Moodlelike 默认值：

```dotenv
AUTH_REFRESH_COOKIE_NAME=cscalite_refresh
AUTH_CSRF_COOKIE_NAME=cscalite_csrf
AUTH_CSRF_HEADER_NAME=x-csrf-token
AUTH_GOOGLE_STATE_COOKIE_NAME=cscalite_oauth_state
VITE_AUTH_CSRF_COOKIE_NAME=cscalite_csrf
VITE_AUTH_CSRF_HEADER_NAME=X-CSRF-Token
```

后端和前端构建参数必须一致。Cookie 名重命名为 `moodlelike_*` 是未来独立发布事项；它会创建新的浏览器会话命名空间，不能和生产接管同时进行。

### 3.3 Cookie 域与 HTTPS

- 正式 HTTPS 域名：`AUTH_COOKIE_SECURE=true`；
- 暂时使用 HTTP/IP：`AUTH_COOKIE_SECURE=false`；
- 只有需要跨子域共享登录且已经验证安全边界时才设置 `AUTH_COOKIE_DOMAIN`；
- 单域部署优先留空，使用 host-only Cookie；
- `PUBLIC_APP_ORIGIN` 与 `CORS_ORIGINS` 必须包含真实浏览器 origin。

## 4. Google OAuth 决策

### 4.1 回调保持稳定

正式回调路径保持：

```text
https://正式域名/api/v1/auth/google/callback
```

如果正式域名不变，Google Cloud Console 中原授权重定向 URI 可以继续使用。影子环境应使用独立 HTTPS 子域名并额外登记回调 URI；不建议依赖公网 IP + HTTP 验证真实 Google OAuth。

### 4.2 保持现有账号绑定语义

当前实现的规则是：

1. Google `id_token` 必须为 RS256，并验证 JWKS 签名、issuer、audience、过期时间和 subject；
2. Google 邮箱必须为 verified；
3. 已按 provider subject 绑定的账号直接登录；
4. 同邮箱的普通用户会自动绑定已验证 Google 身份；
5. 管理员账号禁止通过同邮箱自动绑定，必须先密码登录，再主动绑定 Google；
6. Google subject 或邮箱属于其他账号时拒绝绑定。

首次切换保持以上语义，不在同一发布中更改账号合并政策。若未来要求所有既有密码账号都必须显式确认绑定，应单独设计升级流程和用户提示。

## 5. 已有安全覆盖与缺口

现有 `backend/scripts/security-tests.cjs` 已覆盖：

- 注册和密码强度；
- 邮箱验证 token 哈希、过期和一次性使用；
- access/refresh token 类型隔离；
- Refresh Session 轮换、撤销和 logout-all；
- Cookie refresh 的 CSRF 双提交校验；
- 关闭 legacy bearer refresh；
- 忘记密码防账号枚举；
- 密码重置后撤销旧会话；
- 管理员权限与禁用用户；
- 登录限流；
- 生产环境健康接口不泄漏 secret。

本阶段已新增 `backend/scripts/auth-google-oauth-test.cjs`，使用本地生成的 RSA key 和模拟 Google token/JWKS
端点覆盖：缺少配置时 fail closed、PKCE/state、签名与 audience、新用户、同邮箱普通用户、管理员保护、
既有 provider subject、link 冲突以及 callback Cookie/redirect。测试不访问真实 Google，也不写真实数据库，
并已通过 `test:auth-google-oauth` 接入根 `ci:contracts`。

仍需在影子域名进行一次真实 Google Client/redirect URI 冒烟；自动化测试不能替代 Google Cloud Console 配置验收。

## 6. 实施顺序

### A1：冻结认证契约

- 固定上述 API 路由；
- 固定 User/RefreshSession/OAuthAccount/AuthEmailToken schema；
- 固定首次切换使用的 `cscalite_*` Cookie 名；
- 禁止同时重命名 Cookie、数据库表和 OAuth provider。

退出条件：仓库内存在可执行的认证切换契约检查。

### A2：补齐 Google OAuth 自动化测试

状态：代码与 CI 接入已完成；等待影子环境真实 Google OAuth 冒烟。

至少覆盖：

- 无配置时 fail closed；
- state/PKCE 校验；
- JWKS 签名和 audience 校验；
- 已绑定用户登录；
- 普通同邮箱用户绑定；
- 管理员同邮箱自动绑定被拒绝；
- provider subject 冲突；
- link 模式下邮箱属于另一个用户；
- callback 成功设置 refresh/CSRF Cookie；
- callback 失败清理 OAuth state Cookie。

退出条件：测试不访问真实 Google、不写真实数据库，并进入 CI。

### A3：生产副本演练

- 完整迁移用户、OAuth、session 和 token 表；
- 候选环境继承 CSCALITE auth secret 和 Cookie 名；
- 使用 staging Google OAuth client 或登记过的 staging redirect URI；
- 验证密码账号、Google 账号、管理员账号和旧浏览器刷新会话；
- 验证 logout-all 和密码重置能撤销迁移过来的会话。

退出条件：认证验收矩阵全部通过，日志无 secret。

### A4：生产切换

- 在停写窗口进行最终数据库同步；
- 保持正式域名与 Google callback；
- 切流前确认前后端 Cookie 名一致；
- 切流后先用验收账号验证，再开放普通用户；
- 旧认证服务停止写入但短期保留。

退出条件：旧账号和 Google 登录均由 Moodlelike 单独承接。

## 7. 生产验收矩阵

| 场景 | 预期结果 |
| --- | --- |
| 原密码账号登录 | 使用原密码成功，不新建重复用户 |
| 原 Google 账号登录 | 命中原 OAuthAccount 和 User ID |
| 原管理员密码登录 | 角色和权限保持 |
| 管理员首次 Google 登录 | 不自动绑定，提示先密码登录 |
| 管理员主动绑定 Google | 密码登录后可以绑定 |
| 旧 Refresh Cookie | 在未过期、未撤销且 secret/Cookie 名保持时可刷新 |
| 密码重置 | 原会话全部撤销 |
| logout-all | 所有迁移会话均失效 |
| 禁用账号 | 密码和 Google 均不能进入受保护页面 |
| Google callback | 只允许登记的 redirect URI 和可信 origin |
| 前端刷新 | 用户状态稳定，不周期性自动退出 |
| `/admin/*` | 学生被拒绝，管理员正常进入 |

## 8. 回滚边界

切换后尚未开放普通用户写入时，可以恢复宝塔 upstream 并重启旧认证服务。旧数据库未被候选应用写入，不需要数据库恢复。

开放写入后，不能直接切回旧数据库。新注册用户、OAuth 绑定、Refresh Session、密码重置和角色变更都属于必须保留的认证写入；必须先冻结新站并备份，再决定反向迁移或修复后继续运行。

详细命令以 [`cscalite-to-moodlelike-production-cutover-runbook-2026-09-28.md`](./cscalite-to-moodlelike-production-cutover-runbook-2026-09-28.md) 为准。

## 9. 下一执行目标

Google OAuth 自动化测试、CI 契约接入、`cscalite_*` Cookie 首次切换策略和生产 Runbook 已经落库。下一步不是复制 CSCALITE auth 源码，而是：

1. 在生产数据库副本执行认证表与会话数据预检；
2. 使用影子 HTTPS 域名完成真实 Google Client 和 callback 冒烟；
3. 验证旧密码账号、Google 账号、管理员账号和旧 Refresh Cookie；
4. 固化结果后再进入首页与 Admin Console 迁移，不把认证迁移和 UI 大改放在同一次生产切换中。
