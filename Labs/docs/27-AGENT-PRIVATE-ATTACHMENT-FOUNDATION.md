# Agent 私有附件基础链路（PR7A）

## 1. 本阶段结论

PR7A 交付网页 Agent 的私有附件底座，目标是让学生在 Composer 中上传题目、讲义或手写答案，并让后续 OCR、视觉理解和学习指导拥有可靠输入。附件能力与公开真题资料、自动出题系统及学习证据写入严格隔离。

本阶段支持：

- PDF、DOCX、PNG、JPEG、WebP；
- 文件选择、拖放和剪贴板粘贴；
- 上传进度、确定性处理状态、失败提示、重试、预览和发送前移除；
- PDF 原生文本与 DOCX 文本提取，按页保存并切分文本块；
- 图片安全保存与预览，但不在 PR7A 内调用 OCR 或多模态模型；
- 附件随消息绑定，绑定时保存不可变快照；
- 用户、对话双重归属校验，跨用户访问统一返回不存在；
- 文件扩展名与内容签名校验、单文件及单消息总量限制。

## 2. 限制

| 项目 | PR7A 默认值 |
| --- | ---: |
| 单文件 | 50 MB（`AGENT_ATTACHMENT_MAX_MB` 可调整，代码上限 100 MB） |
| 单条消息文件数 | 5 |
| 单条消息附件总量 | 100 MB |
| 单文档页数 | 200 |
| 私有文件保留标记 | 30 天 |

服务端是限制的唯一权威来源；浏览器限制只用于提前反馈，不能替代服务端校验。

## 3. 存储与数据模型

本地演示默认存放于仓库内 `.local/agent-attachments`。`start-cscalite-dev.bat` 显式把 `AGENT_PRIVATE_UPLOADS_DIR` 指向当前 E 盘仓库，因此不会写入 C 盘。生产环境必须将该变量指向私有对象存储适配层或受保护持久卷，不得放进公开静态目录。

迁移 `0075_agent_private_attachments` 新增：

- `agent_attachments`：归属、文件元数据、哈希、处理状态和私有存储键；
- `agent_attachment_pages`：页面级确定性提取结果；
- `agent_attachment_chunks`：后续检索和模型上下文使用的文本块；
- `agent_message_attachments`：消息和附件绑定及发送时快照。

该模型不复用公开真题上传表，避免公开下载权限、生命周期和学生隐私发生耦合。

## 4. API

- `GET /api/v1/agent/attachments/limits`
- `POST /api/v1/agent/conversations/:conversationId/attachments`
- `GET /api/v1/agent/conversations/:conversationId/attachments`
- `GET /api/v1/agent/attachments/:attachmentId`
- `GET /api/v1/agent/attachments/:attachmentId/content`
- `POST /api/v1/agent/attachments/:attachmentId/retry`
- `DELETE /api/v1/agent/attachments/:attachmentId`
- `POST /api/v1/agent/conversations/:conversationId/messages`，新增 `attachmentIds`

上传接口使用经过认证的原始请求流，边写入边计数和计算 SHA-256；不会先把整个大文件放入应用内存。内容预览也必须带用户认证，响应使用 `private, no-store` 和 `nosniff`。

## 5. 状态与失败语义

正常状态：`uploading -> uploaded -> extracting -> ready`。

内容签名不匹配、空文件或超限进入 `rejected`；解析失败进入 `failed`，只有保留了合法源文件的解析失败可以重试。只有 `ready` 且属于本人当前对话的附件才能绑定消息。已发送附件不能从对话中直接删除，避免历史消息失去审计依据。

## 6. 与 Agent 决策的边界

PR7A 只建立输入资产，不把提取内容自动写入掌握度、错题或学习证据，也不让附件绕过当前推荐系统直接触发自动出题。当前消息运行仍使用既有 Agent 意图和学习方案能力。

后续 PR7B 在此基础上增加异步 OCR/Vision 工作流：

1. 图片与扫描 PDF 进入 OCR/视觉队列；
2. 原图、OCR 文本、页码和区域坐标形成可引用来源；
3. 模型分析输出必须引用附件与页码，并标记不确定内容；
4. 学生确认或真实答题事件发生后，才可进入学习证据写入流程；
5. 模型 API 调用、失败重试、费用和限流由统一 AI Gateway 管理。

## 7. 开关与验收

- 网页入口：`AGENT_WEB_ENABLED=true`、`VITE_AGENT_WEB_ENABLED=true`；
- Agent 基础能力：`CSCA_AGENT_FOUNDATION_ENABLED=true`；
- 私有附件：`CSCA_AGENT_ATTACHMENTS_ENABLED=true`；
- 本地一键启动脚本已设置上述附件开关与 E 盘存储路径。

验证命令：

```powershell
cd E:\CODE\CSCALITE\backend
npx nest build
node scripts/agent-attachment-test.cjs
node scripts/agent-runtime-today-plan-test.cjs

cd E:\CODE\CSCALITE\frontend
npm run build
```

自动测试覆盖签名校验、私有归属、内容读取、拒绝状态、删除，以及既有 Agent 消息/运行幂等回归。
