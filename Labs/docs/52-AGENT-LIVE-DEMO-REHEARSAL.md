# PR11D：Agent 真实黄金路径与连续 Demo 彩排

## 1. 本阶段结论

2026-09-14，本地正式前后端和真实模型 Provider 下完成 API 级连续五轮彩排，结论为 `pass`。本结论覆盖学习状态、错题复习、模考记录、真题检索、能力帮助和提示注入边界，不等价于浏览器 UI、附件 OCR 或“今日方案”整条投资人演示均已冻结。

| 指标 | 结果 |
| --- | ---: |
| 连续彩排 | 5 轮 |
| Agent Run | 30 / 30 完成 |
| 只读工具调用 | 20 / 20 完成 |
| 模型网关调用 | 50 / 50 成功 |
| Intent Router | 30 次 |
| Grounded Response | 20 次 |
| Run 延迟 | P50 `1480ms` / P95 `2270ms` / Max `2482ms` |
| Provider 延迟 | P50 `824ms` / P95 `1350ms` / Max `1521ms` |
| Token | 输入 `21800` / 输出 `1302` / 合计 `23102` |
| 估算费用 | `$0.00341656` |

## 2. 可验证的数据路径

每轮固定执行：

1. “查看我的学习情况”只能调用 `get_subject_mastery`，回答必须出现已作答证据；
2. “查看我的错题”只能调用 `get_review_queue`，回答必须出现错误重复次数；
3. “查看我的模考记录”只能调用 `list_mock_exam_attempts`，回答必须出现 78 分记录；
4. “找 2026 年化学真题”只能调用 `search_past_papers`，回答必须出现本地演示真题；
5. “你能做什么”不得调用工具；
6. 提示注入请求不得调用任何工具，也不得接受虚构的 `raw_database_query`。

四类数据回答全部来自服务器已读取的事实。模型只能决定允许事实的呈现顺序与 lead style，不能添加事实 key；空数据回答不再满足 Gate。

## 3. 隔离演示数据

运行 `scripts/agent-demo-seed.cjs --apply` 会创建或重置专用本地账号 `agent-investor-demo@cscalite.local`。所有专用记录使用 `LOCAL_DEMO_ONLY` 标记或唯一 slug/pattern 前缀；密码随机生成并只保存在已忽略的 `.local/agent-demo-credentials.json`。

安全边界：

- 必须显式提供 `--apply`；
- `NODE_ENV`/`CSC_ENV` 为 production 时拒绝执行；
- `DATABASE_URL` 不是 `localhost`、`127.0.0.1` 或 `::1` 时拒绝执行；
- 只重置该专用演示账号的错题、模考尝试和全部 Agent 对话，便于每次彩排从干净状态开始；
- 不读取或覆盖真实学生密码，不调用自动出题，不写入真实学生掌握度。

## 4. 复现命令

先通过 `start-cscalite-dev.bat` 启动本地环境，然后在项目根目录执行：

```powershell
node scripts\agent-demo-seed.cjs --apply
node scripts\agent-demo-gate.cjs
node scripts\agent-demo-gate.cjs --live
node scripts\agent-demo-audit.cjs
```

正式彩排要求连续运行 `--live` 五次后再执行 audit。`--live` 会产生真实模型 API 调用和少量费用；普通 Gate 只检查服务健康及 Agent 页面入口。

## 5. 发现并修正的问题

第一次使用既有本地账号执行时，六条接口都成功，但掌握度、错题、模考和真题均为空。它证明了空状态行为正确，却不具备投资人演示价值。因此 PR11D 引入隔离演示账号，并把“回答非空”提升为“回答包含指定事实证据”，避免技术成功掩盖展示失败。

## 6. 未覆盖与下一阶段

本阶段尚未冻结：

- 浏览器内从 Composer 提问到答案展示的完整交互；
- 页面刷新后的会话恢复、重复提交和 Provider 故障提示；
- 图片/PDF/手写答案上传、解析、引用和学生确认写入；
- “今天学什么”所依赖的目标、gap、处方与练习入口的整链路；
- 投资人演示讲稿、窗口尺寸和断网降级预案。

下一阶段应建立浏览器级 E2E 和人工视觉验收，先覆盖查询与会话恢复，再覆盖附件分析和今日方案。API Gate 继续作为更快的前置阻断门。
