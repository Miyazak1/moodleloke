# PR12E：教学资产后台发布工作流

## 目标

把教学资产从本地 Seed 数据升级为可运营内容：管理员可以在现有后台中创建、校验、预览、送审、批准、发布、创建新版本和下架交互微课，学生侧继续只解析已发布版本。

## 后台入口

- 页面：`/admin/content/teaching-assets`
- API：`/api/v1/admin/teaching-assets`
- 权限：所有接口使用 `RequiredAdminGuard`；普通学生访问返回 403。

后台页面沿用现有 Admin Console 导航、卡片、表单和反馈样式。编辑区提供学科、稳定键、知识点、语言、预计时长、难度、严格 JSON payload、文字降级内容、事实来源和真实组件预览。

## 生命周期

```text
draft -> review -> approved -> published -> retired
           |
           +-> draft（退回修改）
```

- 只有 `draft` 可以修改；
- 进入审核前必须绑定同学科、已发布知识点和至少一个事实来源；
- `approve` 记录审核管理员与审核时间；
- 只有 `approved` 可以发布；
- 已发布版本不可原地修改；
- 新版本从最新版本复制为草稿，线上旧版本保持可用；
- 新版本发布时，同语言旧发布版本在同一事务中下架；
- 最后一个发布版本下架后，资产整体状态变为 `retired`。

## 安全与一致性

- 当前只接受 `micro_lesson + interactive_component`；
- 组件必须来自数学函数平移、物理牛顿第二定律、化学酸碱中和白名单；
- payload 使用与学生交付完全相同的严格 Zod Schema；未知字段、越界参数、组件/学科不匹配均拒绝；
- fallback 必须同时包含标题和正文；
- 稳定键创建后不可更改；
- 已有线上版本后，知识点绑定锁定，避免编辑 v2 草稿时改变 v1 的解析范围；
- 管理预览使用本地模拟事件，不写 Exposure、掌握度或训练事件；
- 学生 API 永远不返回 `correctAnswer` 或反馈键；
- 创建、更新、送审、批准、发布和下架均写 `AdminAuditLog`。

## API

- `GET /api/v1/admin/teaching-assets`：目录、发布知识点和组件白名单；
- `GET /api/v1/admin/teaching-assets/:id`：资产及全版本详情；
- `POST /api/v1/admin/teaching-assets`：创建 v1 草稿；
- `POST /api/v1/admin/teaching-assets/:id/versions`：复制最新版本为新草稿；
- `PATCH /api/v1/admin/teaching-assets/versions/:versionId`：修改草稿；
- `POST /api/v1/admin/teaching-assets/versions/:versionId/submit`：送审；
- `POST .../approve`、`.../return`、`.../publish`、`.../retire`：生命周期操作。

## 验收

`node scripts/agent-teaching-assets-admin-live.cjs --apply` 仅允许连接本地数据库。脚本使用临时管理员和学生，验证：

1. 学生访问后台 API 被拒绝；
2. 组件/学科不匹配被服务端拒绝；
3. v1 完整经历草稿、审核、批准、发布；
4. 学生端能读取 v1 且没有答案泄露；
5. v2 草稿期间 v1 继续服务；
6. v2 发布时 v1 原子下架，Resolver 切换到 v2；
7. v2 下架后学生端不可再解析；
8. 关键状态变化均有后台审计。

测试结束自动删除临时资产、账号和审计事件。

## 暂不包含

- 视频文件上传、转码与播放器；
- 多人强制四眼审核；
- 批量导入与批量发布；
- 教学资产效果分析面板；
- 允许管理员上传或执行自定义 JavaScript。
