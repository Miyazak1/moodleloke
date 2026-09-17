# PR11E：Agent 浏览器级黄金路径

## 1. 目标与结论

PR11E 把 PR11D 已通过的 API 黄金路径推进到真实浏览器：页面使用本地隔离演示账号登录，实际经过 React UI、Composer、HTTP/SSE、NestJS、PostgreSQL 和真实模型 Provider。

2026-09-14 验收结果：

- Live Chromium：`1/1` 通过，约 `18.8s`；
- 快速 UI 回归：desktop/mobile 共 `6` 项通过，`2` 项按项目设置跳过；
- 真实问答依次返回掌握度证据、错题重复次数、78 分模考和本地演示真题；
- 提示注入返回受控能力边界，没有在 UI 中暴露越权能力；
- 页面刷新后，五轮用户消息与 Agent 回答完整恢复；
- 页面无横向溢出，Composer 保持在可视区；
- 模拟消息接口 `503` 时展示可关闭的内联错误，Composer 不会假装成功。

## 2. 两类测试严格隔离

快速回归：

```powershell
npm --prefix frontend run test:e2e:agent
```

它自动启动 5197 临时 Vite 服务，所有账号、Agent API 与 SSE 均为 mock，不调用模型、不产生费用。配置显式绕过本地地址代理，Windows 使用 `npm.cmd`，其他平台使用 `npm`。

真实浏览器黄金路径：

```powershell
# 终端 1（仓库根目录）
npm run local:start

# 终端 2（仓库根目录）
npm --prefix frontend run test:e2e:agent:live
```

Live 测试默认访问 `http://localhost:5190` 和 `http://localhost:3100`，读取 Git 已忽略的 `.local/agent-demo-credentials.json`。它不会自动启动服务，也不会在缺少隔离账号时回退到真实用户。该命令会产生真实模型 API 调用和少量费用；可通过 `AGENT_LIVE_FRONTEND_URL` 与 `AGENT_LIVE_BACKEND_URL` 显式覆盖地址。

可选保存稳定态截图：

```powershell
$env:AGENT_LIVE_CAPTURE_PATH='..\.local\agent-live.png'
npm --prefix frontend run test:e2e:agent:live
```

## 3. Live 验收步骤

1. 使用隔离学生账号真实登录；
2. 确认 Agent 是独立工作区，没有主站 Header；
3. 确认账号卡、Composer 和附件入口可用；
4. 新建对话并连续提交学习状态、错题、模考、真题和注入请求；
5. 每个回答必须出现对应事实，而不仅是 Assistant 消息非空；
6. 刷新页面并验证历史恢复；
7. 验证桌面布局和 Composer 可见性；
8. 拦截一次消息提交为 `503`，验证错误可见且可关闭。

## 4. 本轮修正的回归债务

- 旧 UI 测试仍把附件入口当成“下一阶段禁用”，现已改为验证真实可用状态；
- 新增 intervention 请求此前未被 mock，会因测试 token 的 401 清空登录状态，现已用受控 fallback mock 隔离；
- conversations 列表带查询参数时旧 glob 不稳定，现改为带 URL 结尾约束的正则；
- 本机代理会把未监听的 localhost 探测返回 HTTP 400，造成 Playwright 错判“服务已存在”，配置现显式设置本地 `NO_PROXY`。
- PostgreSQL 对可空的 `lastMessageAt DESC` 默认会把空对话排在最前，导致刷新后选中错误会话；列表查询现明确使用 `nulls: 'last'`；
- 全局文件输入样式的特异度高于 Agent 隐藏规则，曾在 Composer 中露出原生文件输入，现用 Composer 范围内的明确选择器隐藏。

连续彩排期间如果正好修改后端源码，Nest 热重启会中断当时的内存执行器；租约到期后恢复服务会自动续跑，但投资人彩排期间应保持后端代码不变。演示 seed 会清空专用账号的旧对话，避免彩排残留干扰界面。

## 5. 尚未冻结

本阶段没有声称以下路径已经完成：

- 图片、PDF、DOCX 和手写答案的浏览器级真实上传与分析；
- OCR/视觉结果、题目匹配、引用与学生确认写入的完整展示；
- “今天学什么”从目标、gap、处方到练习启动和作答回流的浏览器闭环；
- 移动端真实 Provider 长链路（移动端布局目前由快速回归覆盖）。

附件分析黄金路径已在 PR11F 完成，详见 [54-AGENT-ATTACHMENT-BROWSER-GOLDEN-PATH.md](./54-AGENT-ATTACHMENT-BROWSER-GOLDEN-PATH.md)。下一阶段转入“今日方案 → 开始练习 → 提交 → 返回 Agent”的学习闭环。
