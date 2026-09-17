# CSCAPilot Agent 本地投资人演示施工路线

状态：Accepted v1.0  
日期：2026-09-12  
发布 ID：`DEMO-V1`  
当前目标：在现有本地电脑上完整跑通产品逻辑，通过现有 AI Gateway 调用大模型 API，形成稳定、可重复、无需自管 GPU 的投资人演示。阶段边界见 [19-ARCHITECTURE-CLOSURE-ADR.md](./19-ARCHITECTURE-CLOSURE-ADR.md)。

## 1. 成功定义

本阶段不是生产发布。成功标准是投资人能够看到一个真实工作的 CSCAPilot Agent，而不是只能点击的静态原型：

1. Agent 能读取本地演示账号的真实学习数据；
2. 用户可以上传 PDF 或图片并看到真实状态流转；
3. 本地 OCR 能提取内容；
4. 本地 OCR 能建立页面事实，托管视觉 API 能基于图片给出结果；
5. 回答能引用附件和页码；
6. Agent 能调用学习工具，并在 Agent 原生工作区内完成练习与结果回流；
7. 三条黄金路径可连续重复演示；
8. 不依赖生产数据库和生产 OAuth/SMTP secrets；大模型只通过后端 AI Gateway 调用 API。

模型质量允许低于未来生产版，但不得伪造已经完成的工具执行、上传状态、页码引用或业务数据。

## 2. 本地运行基线

已确认开发机：

- Intel Core i7-12700，20 个逻辑线程；
- 24 GB RAM；
- NVIDIA RTX 3060 Ti，8 GB VRAM；
- E/F 盘空间充足，C 盘空间不足。

本地配置：

```text
Windows + Docker Desktop
  -> existing frontend/backend
  -> PostgreSQL + Redis
  -> Agent Runtime + Capability Layer
  -> private attachment storage
  -> local attachment worker
  -> Docling + PaddleOCR-VL-1.6 or PP-OCRv6
  -> existing AI Gateway
       -> deepseek-v4-flash API
       -> deepseek-v4-flash-vision-exp API
```

Docker 数据、附件、OCR资源和缓存统一放到 E 盘，不写入空间紧张的 C 盘。大模型不在本机下载或运行；演示版远程 AI 任务并发固定为 1–2，并设置严格超时、额度和缓存。

## 3. 固定范围

### 必须实现

- 正式 Agent 页面外壳，继承 CSCAPilot 设计系统；
- 固定演示账号与可重置的本地数据集；
- 学习档案、AI 余额、薄弱点、错题、模考和真题读取工具；
- 流式回答、停止、重试、复制和错误恢复；
- PDF、PNG、JPEG 上传；
- 上传、扫描、解析、就绪、失败、取消状态；
- PDF 原生提取、OCR、图片分析和页码引用；
- Agent 内完成普通练习和报告；尚未迁移的错题、模考、真题和设置暂用受控回退入口；
- 中英文基本可用；
- 演示数据一键恢复；
- 固定结果缓存与录屏兜底。

### 允许简化

- 文本和视觉大模型复用现有 DeepSeek API，不部署本地权重；
- 单次最多 2 个附件、单文件 20 MB、最多 50 页；
- 单用户、单模型任务并发；
- ClamAV 可先使用实现相同接口的 `demo-pass` 扫描适配器，但 UI 和状态不得声称已进行真实恶意软件检测；
- AI 额度使用本地演示账本，不连接支付；
- Redis 队列只服务本地演示，不承诺重启恢复；
- 固定样本可以命中缓存，但界面要区分缓存结果与本轮新分析。

### 明确暂缓

- 生产服务器部署和自动扩缩容；
- 任何自托管大模型或 GPU 推理服务；
- 多租户高并发；
- 正式支付和真实扣费；
- 完整 180 页模型评测；
- S3 对象存储；
- Remote MCP/Codex 插件；
- 主动通知、长期记忆和后台长任务；
- 模考最终提交及高影响写操作。

## 4. 三条黄金演示路径

### G1：从目标到学习结果闭环

```text
进入 Agent
-> 读取目标、学习档案、薄弱点、错题和近期模考
-> 输出一个带证据、预计时长和理由的首选任务
-> 用户在 Agent 内打开练习工作区并完成一组题
-> 答题事实更新学习状态和目标差距
-> 同一 Agent 会话内查看本轮变化与下一步
```

首条切片的真实/演示数据边界、接口和 PR 顺序以 [18-FIRST-VERTICAL-SLICE.md](./18-FIRST-VERTICAL-SLICE.md) 为准。首版不向学生展示未经校准的精确分数或达标概率。

### G2：上传真题 PDF

```text
上传固定真题 PDF
-> 展示上传、扫描、解析状态
-> 生成页面/chunk
-> 用户询问指定题目
-> 回答引用附件名和页码
-> 打开私有预览定位该页
```

### G3：分析题图或手写步骤

```text
上传题目截图或手写答案
-> OCR 提取可见文字
-> AI Gateway 将相关 crop 发送给视觉 API
-> 区分识别结果与模型推断
-> 给出错误提示和下一步学习建议
```

## 5. 施工阶段

### D0：本地运行骨架

工作：

- 增加独立 `demo` 配置，默认不读取生产 secrets；
- 固定 E 盘模型、Docker、附件和缓存目录；
- 建立一键启动、健康检查、停止和重置脚本；
- 建立 Agent、读取工具、附件和远程 AI feature flags；
- 冻结首批 DTO、错误码和任务状态。

退出条件：本地整套服务可重复启动；关闭 Agent flag 后现有网站行为不变。

### D1：数据与只读 Capability Layer

工作：

- 添加 `AgentRun`、`ToolExecution` 和必要消息表；
- 建立七个只读 capability adapter；
- 准备固定演示账号、学习档案、错题、模考和真题数据；
- 完成对象级授权和稳定 DTO；
- 支持一键恢复演示数据。

退出条件：无需模型即可通过接口完成 G1 的全部事实查询，数字与现有页面一致。

### D2：Agent Runtime 与正式页面

工作：

- 将 Labs UI 迁入正式 frontend 路由；
- 接入现有头像、语言、导航和 design tokens；
- 实现 run 生命周期、意图路由、工具编排和上下文构建；
- 实现流式 Message、Tool Status、Composer、侧栏和深链；
- 优先使用确定性路由，模型只负责表达和复杂理解。

退出条件：G1 可以在中英文桌面页面完整运行，刷新和重试不重复执行工具。

### D3：附件基础链路

工作：

- 增加附件、页面、chunk、分析和消息关联表；
- 实现私有上传、类型/大小校验、状态查询、取消和删除；
- 实现演示扫描适配器和解析 worker；
- 实现 PDF 原生文本、页码、缩略图、预览和引用；
- Composer 接入真实附件队列。

退出条件：G2 在不调用 VLM 的情况下完成上传、解析、引用和预览；用户不能读取其他账号附件。

### D4：本地文档处理与多模态 API

工作：

- 先接 PP-OCRv6 或 PaddleOCR-VL-1.6，二者通过统一 parser contract 切换；
- 扩展现有 AI Gateway，接入 `deepseek-v4-flash-vision-exp`；
- AI Gateway 增加受控 `assetId` multimodal content part；
- 限制像素、上下文、输出、超时和并发；
- 保存模型版本、输入 hash、引用和推断类型；
- 对固定演示素材生成可校验缓存。

退出条件：G2/G3 通过配置化 API 跑通；供应商失败有明确降级；不会因为模型失败伪造成功状态或重复扣费。

### D5：演示硬化与冻结

工作：

- 对三条黄金路径各连续演示 5 次；
- 测试冷启动、模型首次加载、断网、刷新和错误重试；
- 清理明显溢出、遮挡、语言混排和加载反馈问题；
- 准备 10–20 页本地冒烟集；
- 准备一键重置、固定缓存和完整录屏；
- 记录已知限制和生产版差异。

退出条件：15 次黄金路径运行无阻断错误；API 正常时可真实调用，API 断开时可用明确标记的固定缓存完成兜底演示；负责人完成最终彩排。

## 6. 首期 PR 顺序

1. Demo config、feature flags、启动/健康检查骨架；
2. Agent contracts、错误分类与数据库增量迁移；
3. 只读 capability adapters 与演示 seed/reset；
4. Agent runtime、run lifecycle 与只读 orchestrator；
5. 正式 frontend shell、Message、Tool Status 与 Composer；
6. Attachment 数据模型、上传、状态与私有预览；
7. PDF 原生解析、chunk 和 citation；
8. 本地 OCR provider；
9. DeepSeek Vision provider 与 multimodal Gateway；
10. 三条黄金路径 E2E、缓存、重置和演示脚本；
11. UI/错误恢复/中英文打磨与 Demo release gate。

每个 PR 单独可回滚，不把数据库迁移、功能启用和模型下载合并成一个不可逆步骤。

## 7. 测试策略

开发过程中测试，不等全部做完：

- 每个 DTO 做契约测试；
- 每个 capability 做授权与数据一致性测试；
- 附件做格式、大小、越权、取消和删除测试；
- parser/VLM 使用固定小样本做 smoke test；
- 三条黄金路径做浏览器 E2E；
- Google 登录、邮箱、Cookie、设置、真题和现有学习流程做回归；
- 演示冻结前只做 10–20 页冒烟集，180 页正式评测留到生产化阶段。

## 8. 演示后的生产化路线

本地演示通过后，按以下顺序继续：

```text
真实 ClamAV 与可靠持久队列
-> 完整对象存储、保留和删除策略
-> 生产级 AI Gateway、供应商容灾与预算控制
-> 180 页质量评测、压力与安全测试
-> 正式 AI 额度预留/结算/退款
-> 内部账号与小流量线上试点
-> Remote MCP/Codex 插件私测
-> 公开发布
```

本地与生产复用相同 capability、attachment、run、citation 和 provider contracts；生产化只替换实现与容量，不重写产品逻辑。

## 9. 立即开工点

第一批施工只做 D0 和 D1：

1. 建立 demo 配置边界；
2. 冻结 Agent/Tool/Attachment 最小 DTO；
3. 添加向前兼容数据表；
4. 接入第一个 `get_learning_dashboard` adapter；
5. 建立演示账号 seed/reset；
6. 用契约测试证明本地能力层可工作。

完成后再进入正式页面接线，避免 UI 与后端各自猜测数据结构。
