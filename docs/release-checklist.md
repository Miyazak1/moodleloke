# CSCAPilot Fixed-Question-Bank Release Checklist

本清单适用于当前 CSCA 学习优先、固定题库上线版本。院校、奖学金、公开搜索、购物车和结算属于历史兼容后端，不是本次前端发布门禁。

## 1. 范围与隔离

- 确认学生端公开路由只覆盖首页、CSCA 准备、考试时间、三科训练、在线模考、真题、咨询、AI 服务说明、账号和机构邀请。
- 确认 `CSCALITE_SPECIAL_PRACTICE_STUDENT_SESSIONS_ENABLED=true`。
- 确认 AI 出题、审核、调度、任务恢复、生命周期整理、生产、预测补题和观察任务全部保持关闭。
- 运行 `npm run verify:fixed-bank`，不得以“AI 子系统尚未完成”为由跳过固定题库门禁失败。
- AI 自动出题只能在独立观察环境和明确授权下验证，不得复用公开应用进程临时开启。

## 2. 构建与静态门禁

- 运行 `npm run verify:ci`。
- 确认 CI 调用固定题库 Playwright 门禁；完整 `npm run verify:e2e` 仍保留给包含 AI 后台的独立研发检查，不作为本次公开发布阻塞项。
- 运行 `npm run verify:ops`。
- 运行 `npm run verify:supply-chain`。
- 运行 `npm run verify:cookie-only`。
- 确认前端 minimal 和 Playwright 路由表不再要求退役的院校、奖学金、购物车或结算页面。
- 确认生产环境 smoke 对固定题库隔离变量有精确值断言。

## 3. 数据库与固定题库

- 运行 `npm run db:migrate:status`，确认包括 `0071_student_onboarding_profile` 在内的全部迁移均已应用。
- 发布前备份数据库，并在测试库执行恢复演练。
- 运行 `npm run mock-exams:seed` 和 `npm run special-practice:seed`。
- 运行 `npm run mock-exams:validate` 和 `npm run special-practice:validate`。
- 确认数学、物理、化学每个公开 topic 的可见发布题数不低于声明的 `questionCount`。
- 确认治理过滤后题量不足的 topic 返回 `SPECIAL_PRACTICE_POOL_REPLENISHING`，不会创建半套学生会话。
- 确认模考和专项练习会把题目写入答题快照，题库后续调整不会改变历史报告。

## 4. 学生端验收

- 验证 `/`、`/csca-prep`、`/csca-exam-time`。
- 验证 `/csca-subjects/math`、`/csca-subjects/physics`、`/csca-subjects/chemistry`。
- 每科至少验证一个固定题库 topic：进入、开始、保存、续做、提交、解析、历史记录和错题复练。
- 验证 `/csca-mock-exam` 的公开卷开始、作答、提交和报告。
- 验证 `/past-papers` 列表、详情和下载。
- 验证登录、注册、邮箱验证、刷新 cookie、CSRF 和退出登录。
- 验证新用户注册引导的两步资料设置、稍后设置、安全回跳，以及账号设置页复用同一份学习档案。
- 验证 390px、430px、平板和桌面布局无横向溢出，公式、SVG 和 Canvas 正常显示。
- 确认题池耗尽只显示补充状态并记录库存缺口，不在学生请求链路调用 AI。

## 5. 后台验收

- 验证 `/admin/audit`、`/admin/content`、`/admin/mock-exams`、`/admin/past-papers`、`/admin/special-practice`、`/admin/organizations`、`/admin/users`。
- 验证固定模考和专项题库的 JSON 校验、导入、发布、归档和历史快照保护。
- 验证普通用户无法进入后台；两个管理员不能互相停用并留下零个 active admin。
- AI 运营与 AI 题库页面可以保留给管理员查看，但公开部署不得启动自动生产或自动发布。

## 6. 部署与上线后观察

- 确认生产 `DATABASE_URL`、长随机 `AUTH_SECRET`、正式 `CORS_ORIGINS`、`PUBLIC_APP_ORIGIN` 和 Redis 限流配置。
- HTTPS 环境使用 `AUTH_COOKIE_SECURE=true`，并保持 legacy refresh fallback 关闭。
- 运行 Docker 状态、staging 和 release-window 门禁。
- 部署后验证 `/api/v1/health`、`/api/v1/ops/ready` 和安全响应头。
- 观察 requestId、错误率、401 循环、题池不足、会话创建冲突和 CSP report-only 日志。
- 归档发布 evidence 和发布前备份，待下一次成功发布窗口后再轮换。

## 7. 非本次发布范围

- 全自动 AI 出题和预测补题
- AI 自动审核、自动发布和大范围题型质量承诺
- AI Coach 正式付费
- 公开院校、奖学金、搜索、购物车、结算和商业支付
- 富文本/图片题编辑、完整多审发布、版本回滚
