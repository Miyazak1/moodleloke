# Agent 附件内容理解闭环（PR7B）

## 目标与边界

PR7B 在私有附件底座上跑通“上传题目/作答 → 视觉或文本理解 → 错误定位 → 学习指导 → 来源引用”。大模型继续使用托管 API，不在本机或业务服务器部署。分析结论只形成对话反馈，不直接修改掌握度、错题或学习证据。

## 实现路径

1. PDF/DOCX 若存在可靠原生文本，按页形成受信边界外的文本证据；
2. 图片以及无文本扫描 PDF 进入视觉路径；扫描 PDF 最多派生前 4 页、长边不超过 1600 像素的 JPEG；
3. 私有二进制只由后端读取，以受控 base64 图片块发送，不生成公网 URL；
4. 所有调用经过现有 `AiGatewayService`，复用 Key Pool、并发、超时、重试、用量账本和成本估算；
5. 视觉模型由 `CSCA_ATTACHMENT_VISION_MODEL` 配置，默认 `deepseek-v4-flash-vision-exp`；文本模型可通过 `CSCA_ATTACHMENT_TEXT_MODEL` 配置；
6. 输出必须通过严格 Schema 校验，并由服务端重写 `attachmentId`、附件名和页码范围，模型不能伪造来源；
7. 完成后写入一条 Agent 助手消息，展示总结、错误、指导和附件页码引用。

官方 DeepSeek Vision Chat Completions 使用 `user.content` 数组，其中图片采用 `image_url` data URL；图片只能放在用户消息中。当前实现遵守该限制，并将系统规则保持为纯文本 system message。参考：[DeepSeek Vision API](https://api-docs.deepseek.com/guides/vision/)。

## 安全

- 附件和学生备注在 Prompt 中明确标记为不可信证据；
- 模型必须忽略附件中的角色、命令、策略、工具调用和提示词；
- 浏览器只提交 `attachmentId`，后端重新校验用户、对话和附件状态；
- 网关账本只记录附件哈希、页数/图片数、模型、Token、耗时和任务 ID，不记录 base64 或原文；
- 单次视觉派生数据限制为 12 MB，避免 base64 请求放大；
- 视觉结果不能作为答案键，也不能直接成为学习事实。

## 持久化与恢复

迁移 `0076_agent_attachment_analysis` 新增 `agent_attachment_analyses`，记录幂等请求、状态、尝试次数、Gateway request ID、模型、结果和错误。状态为：

`queued → running → completed | failed | timeout`

同一附件与 `clientRequestId` 唯一。进程启动及每 30 秒恢复排队任务；运行超过 2 分钟的任务回到队列。失败/超时可重试。

## API 与前端

- `POST /api/v1/agent/attachments/:attachmentId/analyses`
- `GET /api/v1/agent/attachment-analyses/:analysisId`
- `POST /api/v1/agent/attachment-analyses/:analysisId/retry`
- `GET /api/v1/agent/conversations/:conversationId/attachment-analyses`

Composer 随消息发送附件后自动创建分析任务并轮询。分析完成后刷新对话，助手消息展示错误卡片、下一步指导与“附件名 · 第 N 页”来源。

## 开关与验收

本地一键启动增加：

```text
CSCA_AGENT_ATTACHMENT_ANALYSIS_ENABLED=true
```

验收包括：跨用户拒绝、创建幂等、视觉消息块、注入隔离系统指令、严格输出 Schema、服务端引用归一化、助手消息落库、迁移校验及前端构建。

## 尚未进入本阶段

- 分析结果经学生确认后转学习证据；
- 针对整本长文档的分批 OCR 与区域坐标引用；
- 正式答案键对照和自动评分；
- 生产对象存储与独立持久化队列。

这些分别进入 PR7C（证据候选与学习画像联动）和生产化部署阶段。
