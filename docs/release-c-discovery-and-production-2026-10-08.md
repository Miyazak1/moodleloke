# Release C：公开站点可发现性与上线闭环

日期：2026-10-08

## 已实施

- 为 `/`、`/csca-prep`、`/about` 提供 sitemap 与明确的搜索索引边界。
- `robots.txt` 阻止 Agent、登录、个人设置、后台、API 与创作页被搜索引擎索引。
- 首页、CSCA 备考页和 About 页都具备独立 canonical、OG、Twitter 大图和 JSON-LD。
- 结构化数据覆盖 `WebSite`、`Organization`、`EducationalApplication`、`AboutPage`、`WebPage` 与可见 FAQ。
- 使用 CSCAPilot 品牌生成独立社交分享图 `og-cscapilot.png`。
- favicon 从旧绿色叶片更新为 CSCAPilot 书本与星形标识。
- 增加 Web App Manifest。
- Nginx 对 `/about` 与 `/csca-prep` 直接返回预渲染 HTML，并把尾斜杠地址永久重定向到 canonical 地址。
- CSCA 备考页显示信息最近核验日期，继续以官方来源为最终依据。

## 上线后验证

在服务器项目目录执行：

```bash
PUBLIC_SITE_BASE_URL=https://www.cscapilot.com npm run public-site:verify
```

该命令检查三个公开页面、robots、sitemap、分享图、canonical、结构化数据和 HTTP 状态。

还应人工完成：

1. 在 Google Search Console 提交 `https://www.cscapilot.com/sitemap.xml`。
2. 使用社交平台链接调试器刷新首页、CSCA 备考页和 About 页缓存。
3. 新注册一个账号，确认验证邮件链接、Google OAuth 回调和登录 Cookie 均使用正式域名。
4. 在手机网络环境检查首屏、导航、About 页与 CSCA 信息来源区域。

## 配置边界

- `PUBLIC_APP_ORIGIN=https://www.cscapilot.com`
- `PUBLIC_API_ORIGIN=https://www.cscapilot.com`
- `CORS_ORIGINS=https://www.cscapilot.com`
- `AUTH_COOKIE_SECURE=true`
- `GOOGLE_OAUTH_REDIRECT_URI=https://www.cscapilot.com/api/v1/auth/google/callback`

生产域名配置不写死到 Compose 默认值，仍由服务器 `.env` 管理。
