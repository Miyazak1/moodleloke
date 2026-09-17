# 数据切换与回退清单

## A. 切换前

- [ ] 明确源库、目标库、负责人、执行人、观察人和回退决策人；
- [ ] 使用只读账号对源库执行 `npm run data:preflight`，结果为 passed；
- [ ] 记录源库 preflight artifact、Prisma migration 数量、public 表数和数据库大小；
- [ ] 在同版本 PostgreSQL 上完成最新一次 `npm run data:rehearsal:apply`；
- [ ] 确认目标库允许覆盖，目标数据库名二次确认无误；
- [ ] 确认 `pg_dump`/`pg_restore` 与服务端版本兼容；
- [ ] 冻结会产生新学习证据、答题、会话、附件和内容发布的写操作；
- [ ] 等待后台任务、outbox、生成任务和正在进行的训练轮次达到约定静止状态；
- [ ] 保留旧应用与旧数据库，不删除源库或原数据卷。

## B. 执行窗口

1. 冻结后再次运行源库 preflight；
2. 运行 `npm run data:migrate:plan` 并由第二人核对脱敏后的源/目标身份；
3. 运行 `npm run data:migrate:apply`，保存 manifest 路径；
4. 对目标运行 `npm run data:preflight`；
5. 对比源/目标：迁移记录、public 表数、数据库大小和核心表近似行数；
6. 使用目标数据库启动 Moodlelike 后端；
7. 验证登录、今日任务、开始/恢复做题、提交答案、学习历程、错题薄弱点、教学资产和 Authoring 读取；
8. 写入一个切换后测试用户/会话并验证新学习证据只进入目标库；
9. 观察错误率、请求延迟、数据库连接、后台任务和 outbox；
10. 达到观察窗口后再解除写冻结。

## C. 必须回退

出现以下任一情况立即停止放量并回退：目标 preflight blocked、关键表或迁移记录不一致、认证失败、当前学习无法恢复、答案/证据不能持久化、错误率持续超过约定阈值、出现源目标双写或数据继续写入旧库。

回退顺序：停止新应用写入 → 记录故障时间与最后成功写入 → 使用对应 manifest 运行 rollback plan → 双人确认目标身份 → 运行 rollback apply → 恢复旧应用指向旧库 → 验证旧路径 → 保存日志与脱敏证据。

## D. 不可在同一窗口执行

- 不裁剪 Prisma schema 或历史迁移；
- 不删除 CSCALite 源库、volume、备份或上传文件；
- 不升级 PostgreSQL、Prisma 或认证协议；
- 不同时上线新的 Agent 学习逻辑；
- 不使用生产凭据填充 Issue、聊天记录或版本库文件。
