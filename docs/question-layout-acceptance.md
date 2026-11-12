# 学生题目排版验收

2026-11-12，仅本地。未访问、部署或改动正式站和 test 站点。

修复题干与计时器等高造成的窄屏挤压：题干现在独占整行，计时器保持小尺寸。题干使用较轻字重、足够行高；手机任务区域使用全宽。英文状态栏与题目导航允许换行，选项的字母、正文、判题反馈分开排列，已判题选项保留正常对比度。

图示统一白底边框、间距、图注、放大按钮与本地图标，限制宽屏放大比例。放大后隔离页面滚动，支持 Esc 关闭、回到原按钮。复盘展开题目后使用页面正常滚动，避免图示被固定高度的内层滚动区截断。

题目中的显式 ASCII 分数和幂排成分数、上标，坐标保持完整。此功能只在明确开启的题干、选项及复盘内容生效，不修改存储题目、标准答案、图形内容或普通聊天文字。不推断或计算公式。修复选项后代 span 样式影响 KaTeX 内部排版的问题。

## 验证

- 真实 Nest/Prisma 专用验收库及实际 Agent 页面；非截图拼装页面或模拟接口。
- 数学原生题、真实历史外部题、单列合成原图、单列分段函数试点：中英文各 320/390/768/1024/1440，共 40 组。页面、导航、选项无横向溢出；图片加载成功，计时器高度 28px，无 KaTeX 错误。数值见 `artifacts/question-layout/layout-metrics.json`。
- 另外实际查看频数题英文 320px 的选择、正确反馈、提交和复盘；查看几何图手机放大、关闭操作。频数题复盘截图独立保存，不混入 40 组统计。
- 前端类型、生产构建、数学显示回归、128 个图标覆盖及 CSS 架构检查通过。数学显示回归同时检查日期、URL、小数与原 LaTeX 保持正确。
- 生成功能与三科旧题库实际接口回归通过，Provider 0；本轮没有改动生产业务后端或数据库 schema。

[截图集](../artifacts/question-layout/index.html)，点击任意截图查看原尺寸。截图中的试点主题标识和测试账号属于验收材料。

```powershell
node frontend/scripts/check-question-math-rendering.cjs
npm --prefix frontend run typecheck
npm --prefix frontend run test:icons
npm --prefix frontend run test:css-architecture
npm --prefix frontend run build
node scripts/question-layout-gallery.cjs
```

真实页面复查可用专用验收库执行 `node backend/scripts/math-engine-student-live-test.cjs --figures --review-ui`；服务仅监听 loopback，通过 `/__review` 进入，完成后停止该临时服务。使用本地历史材料和测试账号，不接入任何线上数据库。

## 生产镜像边界

本轮新前端镜像 `moodlelike-frontend:math143-layout-rc-local`，不可变 ID `sha256:b5a61970de59548dc2d9f29f67b8c4f60f4126c0c5529cb47ef25e6730de545e`。Linux 生产构建、镜像内 Nginx 配置与题目样式产物断网校验通过；未推送、未部署，之前的镜像和备份保留。

40 组真实页面检查使用本地开发服务。随后已对该新前端与配图后端补做完整生产组合验收：真实 Nginx 登录/自由练习生成三道题、320/390/1440 排版和放大/焦点操作、150 表备份恢复、停用插件后三科作答与重新启用通过。另按用户服务器截图确认的 0098 基线，在本地恢复副本上执行 0099/0100/0101，147 张原有业务表内容不变；随包的只读迁移预检也通过。最新证据目录 `.local/math143-layout-release/`。线上仍需真实备份恢复和环境核验。
