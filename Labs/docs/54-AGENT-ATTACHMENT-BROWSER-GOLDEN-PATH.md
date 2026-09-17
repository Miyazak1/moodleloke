# PR11F：Agent 附件分析浏览器黄金路径

## 1. 目标与结论

PR11F 在 PR11E 真实浏览器基础上，冻结“上传学生作答 → 识别与分析 → 页码引用 → 可信题源匹配 → 学生确认/撤销”路径。大模型继续调用托管 API，不在本地或业务服务器部署。

2026-09-14 最终验收：

- Live Chromium：`1/1` 通过，约 `21.3s`；
- PNG 手写作答通过 `deepseek-v4-flash-vision-exp` 识别，视觉调用约 `10.45s`；
- PDF 先经本地确定性文本提取，再由 `deepseek-v4-flash` 分析，模型调用约 `4.98s`；
- 两个附件均生成第 1 页引用，匹配同一道本地可信题源，分数分别为 `1.00` 和 `0.98`；
- 手写作答经学生确认后写入低权重学习证据，随后撤销并从投影重放中排除；
- 最终两次模型调用估算成本合计约 `$0.00122248`；
- 附件消息不再额外生成“请求不在能力范围”的误导回复。

## 2. 隔离演示 fixture

`node scripts\agent-demo-seed.cjs --apply` 现在会在 `.local\agent-demo-fixtures` 生成：

- `handwritten-function-answer.png`：一张包含题干、选项、手写过程和答案 C 的本地图片；
- `function-answer.pdf`：内容等价的单页原生文本 PDF；
- 一道仅存在本地数据库、标记为 `agent_local_demo` 的 approved 可信题源。

所有 fixture 均明确标注 `LOCAL_DEMO_ONLY`，不含真实学生数据。Seed 仍只允许连接 localhost 数据库，并且必须显式传入 `--apply`。

## 3. 复现命令

```powershell
cd E:\CODE\CSCALITE
node scripts\agent-demo-seed.cjs --apply
start-cscalite-dev.bat

cd frontend
$env:AGENT_ATTACHMENT_LIVE_CAPTURE_PATH='..\.local\agent-attachment-live.png'
npm run test:e2e:agent:attachment:live
```

真实测试使用 `http://localhost:5187` 和 `http://localhost:3000`，会调用真实 Provider 并产生少量费用。彩排时不要修改后端源码；Nest 热重启会中断当时的进程内 Worker，任务需等租约恢复。

## 4. 实测修正

- 附件分析的默认输出预算从 2200 提高为独立可配置的 4800 tokens，限制范围为 1200–8000；
- Provider 枚举别名在 Schema 验证前受控归一，未知学科/类型/评估降级为 `unknown/not_assessable`，不会猜测写入 Evidence；
- `questionNumber` 和短答案允许安全字符串化，引用 quote 允许为空，其他关键结构仍严格验证；
- 题干被完整包含于“题干+选项”时按强包含匹配处理，仍保留最小题干长度、阈值和候选差距门；
- 恢复的分析成功后清理 `LEASE_RECOVERED` 错误标记；
- 附件 Run 仅承担上传分析交接，不再进入普通聊天路由产生重复答复。

## 5. 边界与下一步

本阶段是演示黄金路径，不代表 OCR/视觉生产评测已结束。生产上线前仍需完成多学科、多页、低清拍照、公式/图表、Prompt Injection、成本 P95 和 Provider 故障评测。

下一阶段 PR11G 建立“今日方案 → 开始练习 → 提交作答 → Evidence/Projection → 返回 Agent 读取新状态”的真实浏览器闭环。
