# CI 与黄金路径

## 分层门禁

### Contracts

`npm run ci:contracts`

执行完整构建、后端 Agent runtime、学生入口边界、Teaching Asset Registry、Authoring 权限边界、CI 自检以及产品边界审计。该层不依赖外部模型、真实用户数据或生产数据库。

### Browser golden paths

`npm run ci:golden`

使用 Chromium 和拦截式确定性 fixture 验证：

1. 推荐任务在 Agent 内创建并打开做题区；
2. 做题区保持挂载时，教学资产在聊天区打开；
3. 管理员从独立 Authoring 入口发布已审核教学资产。

## GitHub Actions

`.github/workflows/standalone-ci.yml` 在 push 和 pull request 时安装三层依赖、安装 Chromium、运行 contracts 与三条浏览器黄金路径。失败时上传 Playwright trace、截图和边界审计报告。

## 非目标

- CI 不调用付费模型 Provider；
- CI 不连接 CSCALite 数据库或数据卷；
- CI 不使用本地 demo 凭据；
- 真数据库迁移演练和模型 Provider 评测属于后续 release gate。
