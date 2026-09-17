# Moodlelike Agent

Moodlelike Agent 是从 CSCALite 中独立出的 AI 原生训练与教学产品。当前以可信做题训练为核心，逐步接入学习辅助、教学资产、独立验证、教师与机构能力。

## 当前边界

- 学生只面对一条持续学习旅程；
- Agent 聊天始终存在，类型化工作区负责做题、真题、教学和验证；
- 真实作答、辅助曝光和教学验证进入统一学习证据；
- 当前保留 CSCALite 的训练、模考、真题、学习智能和题目供应内核；
- 原公开站、咨询、支付和通用内容路由不再由后端根模块加载；
- 前端使用 Agent 专用应用壳，只装配 Agent、登录注册、首次设置和个人/学习设置；
- 尚未物理删除的旧源码不再进入 Agent 前端构建图，后续按依赖审计分批清理。

## 本地启动

1. 将 `.env.example` 复制为 `.env`，设置认证密钥并检查数据库地址。
2. 安装依赖：

   ```powershell
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

3. 启动：

   ```powershell
   .\start-moodlelike-dev.bat
   ```

默认地址：前端 `http://localhost:5190/zh/agent`，后端 `http://localhost:3100`，PostgreSQL `localhost:56432`。

## 独立性

- 使用独立目录、依赖安装和构建产物；
- 使用独立 Docker Compose 项目、数据库、数据卷和端口；
- 不复制 CSCALite 的 `.env`、本地上传、构建产物或 `node_modules`；
- CSCALite 后续不会被新项目的开发命令修改。

详细边界见 [EXTRACTION_STATUS.md](./EXTRACTION_STATUS.md) 和 [长期演进 ADR](./Labs/docs/83-AI-NATIVE-TRAINING-TO-LEARNING-PLATFORM-ADR.md)。
