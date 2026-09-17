# CSCALite → Moodlelike 数据迁移运行手册

## 当前策略

第一次迁移完整复制现有 Prisma schema 中的全部模型和数据。模型保留矩阵只提供审计结论，不授权删表；裁剪必须在独立项目稳定运行、关系/原始 SQL/历史迁移复核以及回滚演练全部通过之后单独进行。

## 安全保证

- 所有命令默认是 plan-only；只有带 `--apply` 的 npm 脚本才执行数据库工具；
- 源库和目标库必须不同，目标数据库名需要二次精确确认；
- 默认拒绝远程目标，确需远程执行时必须显式设置 `ALLOW_REMOTE_MOODLELIKE_TARGET=1`；
- apply 顺序固定为：备份目标、导出源库、重建目标 `public` schema、恢复到目标、完成 manifest；
- 回滚只能选择 `.local/data-migrations/<run>/manifest.json`，并校验目标身份和同目录备份；
- 回滚同样先重建目标 `public` schema，确保删除迁移后新增而旧备份中不存在的对象；
- 连接字符串不会写入 manifest，控制台输出会遮蔽用户名和密码；
- `.local` 被 Git 忽略，dump 和 manifest 不进入版本库。

## 前置条件

1. 本机安装与数据库版本兼容的 `pg_dump` 和 `pg_restore`；
2. 目标数据库已经创建，目标账号拥有建表、删表和恢复所需权限；
3. 先运行 `npm run ci:contracts`；
4. 在一次性或隔离环境完成首次演练，不直接把首次 apply 指向生产库。

## 生成审计材料

`npm run audit:product-boundaries`

`npm run audit:prisma-retention`

结果位于 `artifacts/prisma-model-retention.json` 和 `artifacts/prisma-model-retention.md`。

## 迁移计划（不接触数据库）

在当前 PowerShell 会话设置变量：

`$env:CSCALITE_SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@localhost:55432/cscalite'`

`$env:MOODLELIKE_TARGET_DATABASE_URL='postgresql://USER:PASSWORD@localhost:56432/moodlelike'`

`$env:CONFIRM_MOODLELIKE_TARGET_DATABASE='moodlelike'`

然后运行：

`npm run data:migrate:plan`

计划输出必须显示正确的源/目标身份和四个步骤，且密码应被遮蔽。

## 迁移执行（会修改目标库）

确认目标是可覆盖的独立 Moodlelike 数据库后运行：

`npm run data:migrate:apply`

成功后保存输出的 manifest 路径。每次执行产生独立目录，不覆盖其他演练记录。

## 回滚计划与执行

先预览：

`npm run data:rollback:plan -- --manifest=.local/data-migrations/<run-id>/manifest.json`

确认目标身份和备份文件正确后执行：

`npm run data:rollback:apply -- --manifest=.local/data-migrations/<run-id>/manifest.json`

回滚使用迁移前目标备份，会覆盖目标库当前对象；它不会修改 CSCALite 源库。

## Phase 3B 演练验收

- 在一次性数据库完成 apply、应用启动、关键表行数/外键抽查和三条 Agent 黄金路径；
- 使用同一 manifest 完成 rollback；
- 回滚后重新核对目标快照与应用可启动性；
- 演练证据中不得包含连接密码、用户隐私或数据库 dump；
- 未通过以上门禁前，不执行真实生产切换，也不裁剪 Prisma schema。

可重复的本机隔离演练：

`npm run data:rehearsal:plan`

`npm run data:rehearsal:apply`

apply 会创建唯一命名的临时 PostgreSQL 16 容器和两个测试数据库，部署全部迁移、验证精确复制、执行回滚、验证目标原状，并在结束时删除该临时容器。它不使用 `moodlelike-postgres` 或现有数据卷。
