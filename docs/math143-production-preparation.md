# 数学 1.43 生产镜像与发布准备验收

日期：2026-11-12。结果：本地准备完成，尚未上线。没有访问或改动 cscapilot.com、test.cscapilot.com，没有线上备份、镜像推送或部署。

## 当前最终组合：包含排版修正

后端使用下文配图候选 `e3b3f798…`，前端使用 `moodlelike-frontend:math143-layout-rc-local` / `sha256:b5a61970de59548dc2d9f29f67b8c4f60f4126c0c5529cb47ef25e6730de545e`，迁移镜像仍为 `c796b657…`。该组合已完整补跑生产入口、真实 Nginx 浏览器自由练习生成、320/390/1440 排版及放大、150 表备份恢复、迁移幂等、停用生成后三科作答和重新启用；Provider 0。证据在 `.local/math143-layout-release/`。

用户终端截图进一步确认正式目标为 `moodlelike-next`、18081、`/www/wwwroot/moodlelike-next`、`moodlelike` 数据库及既有 `moodlelike-next_moodlelike-postgres-data` 卷，线上当前到 0098。本地从对应模拟基线实际执行 0099/0100/0101，147 张原有业务表内容未变；只读迁移预检与发布配置渲染通过。这里没有读取或操作线上数据库，不能替代真实线上备份。

定向命令见 [正式项目发布步骤](math143-moodlelike-next-deployment.md)，待上传包位于 `.local/math143-layout-release/upload/`。旧候选、标签及证据保留。工作区仍非已审核的干净提交；发布范围核对要求不变。

后续按用户要求整理为 GitHub 发布分支，范围和固定提交构建流程见 [GitHub 发布步骤](math143-github-deployment.md)。旧品牌/命令分类静态约定已对齐实际 CSCAPilot 产品与唯一正式插件，相关契约通过；不改变旧镜像和原始验收记录。

## 最新候选：包含学生配图

同日追加的学生配图候选也完成生产镜像真实演练，以下为当前候选；下文原候选及证据保留作基线，不覆盖旧标签。

| 用途 | 本地标签 | 已验收不可变 ID |
| --- | --- | --- |
| backend | moodlelike-backend:math143-figures-rc-local | sha256:e3b3f798d301fc7ea9ec3d67b99a3f1886f8e434e313065da8861d92b03f0d7a |
| frontend | moodlelike-frontend:math143-figures-rc-local | sha256:5d36efdacdc58db24a59726d14c4997d93e8ae06c16878d80e7b82b009e310f3 |
| migrate | moodlelike-backend:math143-migrate-local | sha256:c796b657c4895b0480384f58d3c38d04d1d362eee998705841d478c60f722f8d |

新镜像通过生产入口、Nginx 学生浏览器、冻结文件校验、原生题配图绑定、双语判题提交、学习证据幂等、150 表备份恢复比对、迁移重复执行及停用插件后三科做题回归。Provider 调用为 0。读图试点仍默认关闭，不改变唯一正式插件身份。

最新证据目录为 `.local/math143-figures-release/`，其中 `production-rehearsal-evidence.json` 记录成功结果；dump 为 `moodlelike-math143-figures-rehearsal-1794474679506.dump`，724428 字节，SHA-256 `b962127e61ba1fbc76a10688c6555ea18fd14c6f5a4c9b7a5aafea6009db2480`。最新发布清单、增量升级和配置验收也写入该目录。依赖未新增，依赖审计沿用同日基线报告及其原始报告；不冒充重新联网审计。

正式发布仍需审核工作区差异、现场旧镜像兼容性及线上真实备份；本地演练不能替代它们。配图范围与实际外部材料限制见 [配图验收](question-figures-integration.md)。

## 本次交付

- 生产后端最终镜像包含数学 1.43 冻结包、1,152 个校验文件和锁定运行依赖，不需要宿主源码或 .local 目录挂载。
- 前端使用真实 Vite 生产构建与 Nginx；另备同源构建阶段的迁移镜像。
- 发布覆盖配置默认关闭生成；显式启用时仅选择 verified-math-1.43。迁移命令只运行 migrate deploy，不运行历史题库、内容或演示 seed。
- 修复数据库首次初始化阶段健康检查提前通过的问题，改用 TCP pg_isready 检查。
- 兼容范围内更新前后端依赖锁文件；没有强制升级主版本，没有改动数学 1.43 冻结内容。

## 已通过的验收

| 检查 | 结果 |
| --- | --- |
| 后端、前端、迁移镜像构建 | Linux/amd64，全部通过 |
| 生产入口与 Nginx readiness | 通过；后端和数据库仅连接本地 internal 网络 |
| 镜像内断网引擎测试 | 4/4，通过三档难度、精确圆锥答案、Oracle 和证据篡改拒绝 |
| 学生真实接口链路 | 生成、校验、发布、双语读题、判题、保存、提交与幂等学习证据均通过 |
| 学生生产浏览器链路 | 经真实 Nginx/API 准备 3 道较难题并进入既有练习工作区，非模拟接口 |
| 备份与恢复 | 真实 custom dump 恢复到新库，150 张 public 表的行数与内容摘要全部一致 |
| 增量升级 | 恢复副本模拟未应用 0100/0101，实际迁移后 148 张原有表内容不变 |
| 插件停用回滚 | 关闭插件后三科原有题库均可判题、提交，随后重新启用插件成功 |
| 发布配置渲染 | 默认关闭、显式数学启用、旧开关关闭、资源身份与其他环境保持一致 |
| 类型与契约 | 前端类型检查、宿主契约、生产环境契约、独立 CI 契约、本地预检及 diff 空白检查通过 |

生成与做题验收的 Provider 调用为 0；数据库 Provider 调用日志行数也为 0。聊天配置使用无效演练值，后端禁止外连，因此这不代表已验证聊天或邮件供应商。

## 固定候选镜像

| 用途 | 本地标签 | 已验收不可变 ID |
| --- | --- | --- |
| backend | moodlelike-backend:math143-rc-local | sha256:a7ebd47ec008c96df04aeaf4fc4b98e5c8f8924e376a08560204fed50d57c3ce |
| frontend | moodlelike-frontend:math143-rc-local | sha256:e94a54b34665b7292672e2472cd34a308f2d12571f29dc930b5ed89b0f1c0e9c |
| migrate | moodlelike-backend:math143-migrate-local | sha256:c796b657c4895b0480384f58d3c38d04d1d362eee998705841d478c60f722f8d |

镜像没有推送。实际镜像内编译产物清单与摘要保存在 release-manifest.json；工作区源码/发布工具审阅清单与镜像产物清单分开记录。

## 备份与证据

- 演练项目：moodlelike-math143-rehearsal-1794464545969。
- dump：.local\math143-release\moodlelike-math143-rehearsal-1794464545969.dump（722476 字节）。
- dump SHA-256：f0fde2447d8e42665339dfbb24df6ca4ccfcfbac6fb2349f069f0891a1441f66。
- 生产演练：.local/math143-release/production-rehearsal-evidence.json。
- 增量迁移：.local/math143-release/migration-upgrade-evidence.json。
- 发布配置：.local/math143-release/release-config-evidence.json。
- 依赖审计：.local/math143-release/dependency-audit-summary.json 及四份原始报告。
- 发布清单：.local/math143-release/release-manifest.json。
- 浏览器截图：.local/math143-release/production-student.png。

演练容器已停止，专用数据库卷与 dump 留存供核查。原有本地 moodlelike-postgres / moodlelike-redis 未受影响。以上材料均在忽略目录，包含测试账号的 dump 不进入仓库。

## 审计状态与正式发布边界

更新后所有审计范围的 high/critical 均为 0，项目高危阈值检查通过。主后端 runtime 依赖为 0 漏洞；后端构建依赖仍有 2 low / 3 moderate，前端与冻结引擎各有 1 low，完整报告保留，没有用跨主版本升级掩盖残留项。

不声称全仓 CI 全绿：上次验收记录中的品牌身份约定与命令分类检查仍待另行处理。工作区已有其他任务的改动；manifest 如实记录该差异，候选镜像不是一个已审核的干净提交，发布前必须核对范围。

线上 CPU 架构、正式项目/卷、旧镜像和 0098 迁移基线已由用户终端截图确认。真实备份、恢复、配置渲染及更完整的现场检查尚未在线上执行；本次未自行连接服务器。正式发布依照上述定向步骤及 [发布与回滚手册](math143-release-runbook.md)，test 站点不在目标范围内。
