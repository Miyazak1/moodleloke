# 本会话工作总结与交接

日期：2026-07-03  
分支：`codex/adaptive-ai-questioning`  
仓库：`Miyazak1/CSCAlite`

## 1. 总览

本会话从 `docs/reference-feature-handoff.md` 开始，围绕个人学习页、错题复盘、准备成熟度、AI 自适应训练、AI 出题/审题、题库治理、真题画像、机构管理和后台管理面板做了连续设计、落地和验证。

核心方向从最初的“个人页用户看不懂分数、复盘完成、继续训练”逐步扩展为：

- 学习侧：让用户理解自己为什么要复盘、为什么要训练、离准备成熟还差什么。
- 训练侧：把错题复盘和普通训练拆清楚，避免“错题”和“训练”混成一个入口。
- AI 侧：区分做题相关 AI、聚合分析 AI、AI 出题、AI 审题、真题风格参考。
- 管理侧：让大纲、蓝图、候选题、已发布题、真题画像、机构成员管理可以真正运转，而不是只停留在理论架构。

## 2. 个人页与学习准备度

完成过的设计和实现方向：

- 深度评估了个人页的信息架构、前端交互和用户理解问题。
- 明确“复盘完成”不能只是改变排序，应当有明确后果：减少今日复盘压力、更新错题状态、影响下一轮训练推荐。
- 明确“继续训练”与“错题复盘”是两个不同任务：
  - 复盘错题：优先进入错题复盘。
  - 科目训练：进入普通训练，按推荐策略抽题。
- 设计并推进“准备成熟度”功能：
  - 不只是分数。
  - 应考虑题量、知识覆盖、题目难度、模考表现、错题复盘、稳定性等证据。
  - 用户看到的是“离准备成熟还差什么”，而不是一个孤立数字。
- 将相关方案整理为 docs 文档，包括个人页评估、准备成熟度、错题复盘/训练流转等。

相关文档：

- `docs/personal-page-product-review-and-readiness-plan.md`
- `docs/readiness-final-handoff.md`
- `docs/wrong-question-review-verification-training-flow-plan.md`
- `docs/personal-page-clean-design-and-interaction-plan-2026-06-15.md`

## 3. AI 聚合分析与额度边界

讨论并确定了 AI 能力边界：

- 做题相关 AI：例如 AI Coach、做题解析、练习建议，可计入额度。
- 个人面板聚合分析：更适合作为免费基础能力，不应让用户手动点击生成，也不一定需要 LLM。
- AI 周报：不应由用户手动点，而应由系统按规则自动生成或刷新。
- 个人页很多分析可先规则化完成，LLM 只在需要自然语言总结时补充，不应为了“看起来智能”滥用 LLM。

相关文档：

- `docs/personal-dashboard-llm-boundary-and-implementation-plan-2026-06-10.md`

## 4. 自适应训练、错题和反馈

围绕自适应训练做了多轮检查和修正：

- 修正“继续训练”按钮语义，避免用户点后不知道为什么进入数学题。
- 明确错题复盘和普通训练拆分。
- 检查题目语言选择流程：
  - 模拟卷已有语言过渡。
  - 科目训练也应允许选择题目语言，默认记住上次选择。
- 检查并优化 AI 解析语言不稳定问题：
  - 发现 LLM 会被题目原文语言影响。
  - 设计并实施：生成解析时先将上下文转换/约束到页面语言，再交给 LLM，保证输出语言稳定跟随页面语言。
- 评估点赞/踩反馈：
  - 明确当前反馈应进入质量反馈和改进数据，而不是让用户误以为即时个性化学习已经发生。
  - 后续可用于解析质量、题目质量、错因标签、推荐策略校准。

相关文档：

- `docs/ai-coach-feedback-product-and-implementation-plan-2026-06-10.md`

## 5. 大纲、蓝图与 AI 出题

完成并推进了 CSCA 大纲到题库生产的主链路：

### 5.1 大纲 JSON

根据用户提供的截图，将大纲转为 JSON：

- 数学大纲：`docs/csca-math-syllabus-2025.json`
- 化学大纲：`docs/csca-chemistry-syllabus-2025.json`
- 物理大纲：`docs/csca-physics-syllabus-2025.json`

明确了一个重要规则：

- 大纲是题库生产的基础。
- 没有对应科目的大纲，不应允许后续蓝图和候选题生成。
- 蓝图必须能让管理员看懂“来自哪份大纲、哪个知识点、为什么要补”。

### 5.2 蓝图与候选题流程

梳理并推进流程：

```text
大纲 -> 知识点 -> 出题蓝图 -> 候选题 -> AI 审题 -> 人工审核/发布 -> 正式题库
```

修正过的关键交互：

- “补蓝图”要明确基于大纲。
- “生成候选”应在蓝图/知识点附近展示生成状态，而不是跳到一个用户不理解的队列。
- 批量生成蓝图、批量生成候选、追加生成候选要区分：
  - 补齐蓝图：保证知识点有出题方向。
  - 补齐候选：补缺口。
  - 追加候选/扩题：同一蓝图持续生成更多题。
- 同一个知识点可以有多个蓝图。
- 同一个蓝图可以反复生成多道候选题。
- 每道题应支持中英双版本，本质上是同一道题的两个语言版本。

相关文档：

- `docs/csca-syllabus-past-paper-ai-questioning-architecture.md`
- `docs/adaptive-ai-questioning-plan.md`
- `docs/organization-syllabus-governance-implementation-plan-2026-06-11.md`
- `docs/mock-exam-blueprint-and-ai-generation-plan-2026-06-30.md`

## 6. AI 生成题与 AI 审题

完成并完善了 AI 出题/审题架构：

- 区分 Generator Agent 和 Reviewer Agent。
- 统一走配置的大模型 provider，但使用不同 agent prompt、输入结构和审题标准。
- 明确独立 agent 不代表完全没有共享偏差，因为模型知识仍来自同一个模型，但可以减少任务上下文互相污染。
- 加入审题证据展示：
  - 生成模型
  - 审题模型
  - 审题分数
  - 门禁状态
  - rubrics
  - issues
  - run records
- 明确 AI Reviewer 的职责：
  - 做硬伤拦截。
  - 检查答案唯一性、选项互斥、解析支撑、语言、难度、大纲一致性等。
  - 不能完全替代人工审题。
- 明确发布策略：
  - 门禁通过的题可以批量发布。
  - 建议重生、复审失败、需要人工确认的题不能混在“自动发布”里。
  - 管理员可筛选只发布“门禁通过”。

相关文档：

- `docs/ai-questioning-multi-agent-review-architecture-2026-06-15.md`
- `docs/ai-generated-question-tracking-runbook.md`

## 7. 候选题审核与已发布题库

围绕后台候选题审核做了大量交互修正：

- 候选题列表展示题干、选项、正确答案、解析。
- 编辑候选题时不只编辑题干和正确答案，也能编辑所有选项。
- 候选题状态更清楚地区分：
  - 待审核
  - 门禁通过
  - 需要人工确认
  - 建议重生
  - 复审失败
  - 已发布
- 批量操作从“当前页”歧义调整为更清晰的分页/全量发布能力。
- 修正“全选只选当前页但用户以为全选全部”的误导。
- 增加已发布题库页/区域，用于查看已经进入训练题库的题。
- 已发布题也能查看中英文版本、生成来源、审题结果、难度、曝光/作答统计等信息。
- 开发阶段开启 AI 出题标识，便于在练习中识别 AI 题；上线时可关闭或降级展示。

## 8. 真题画像与风格参考

讨论并推进“真题作为生成和校验参考”的能力：

- 用户希望通过截图/PDF提供真题，由系统转成 JSON。
- 真题不是直接复制出题，而是用于沉淀风格、倾向、难度、知识点覆盖、题型结构。
- 多份真题应保留单份画像，同时聚合成 subject-level/style-profile 标准：
  - 单份画像：保留来源差异和历史证据。
  - 聚合画像：作为生成题和审题时的默认参考。
- 转换了数学预测卷 JSON：
  - `docs/csca-math-prediction-april-3-en-source.json`
- 建立真题 JSON 模板和工作流文档：
  - `docs/csca-past-paper-source-json-template.json`
  - `docs/csca-past-paper-source-json-workflow.md`
- 设计真题画像与知识点映射：
  - 原本需要人工填大纲 code。
  - 后续改为 AI 自动映射，管理员只确认低置信度项。
  - 用户要求“全自动，不要手动”，后续方向是自动映射、自动保存、自动用于画像。

相关文档：

- `docs/csca-past-paper-style-reference-implementation-plan-2026-06-16.md`
- `docs/csca-source-reference-auto-profile-architecture-2026-07-01.md`

## 9. 管理后台重组与治理

对管理后台做了持续重组和优化：

- 将 AI 题库治理从杂乱堆叠逐步拆为：
  - 蓝图与知识点
  - 候选审核
  - 已发布题库
  - 真题画像
  - 质量治理
  - 错因补救
  - 题库台账
- 优化过的管理后台交互问题包括：
  - 按钮点击无反馈。
  - 生成任务状态看不懂。
  - 队列与蓝图关系不清楚。
  - 候选题列表分页和批量操作不友好。
  - 已发布题缺少查看入口。
  - 编辑弹层信息不足。
  - 状态说明过长、页面拥挤。
- 对管理后台架构做了评估，形成文档：
  - `docs/admin-console-reorganization-plan-2026-06-14.md`
  - `docs/admin-console-feature-parity-and-style-audit-2026-06-15.md`
  - `docs/admin-management-panel-architecture-review-2026-06-17.md`

## 10. 机构、成员与运营治理

围绕“团队/机构”做了产品和实现推进：

- 讨论了手动添加成员太麻烦，设计更成熟方式：
  - 邀请链接
  - 短码
  - 批量导入
  - 机构管理员
  - 分组/cohort
- 明确机构治理也属于运营能力，但和平台用户运营不同：
  - 平台管理员：管理全站。
  - 机构管理员：只管理自己所属机构。
- 实现/推进机构邀请和验证策略：
  - 邮箱验证影响访问权限。
  - 学生通过邀请码加入机构。
  - 管理员可设置机构管理员。
- 处理过账号权限问题：
  - 将 `495469022@qq.com` 设为管理员，但不修改密码。
  - 明确未验证账号仍需验证。
- 机构控制台访问控制收尾：
  - 普通新账号不应看到机构控制台入口。
  - 直接访问 `/organization` 也要拦截。
  - 只有机构 owner/admin 可以进入机构管理面板。

相关文档：

- `docs/organization-admin-mvp-permission-plan-2026-06-17.md`
- `docs/organization-admin-email-assignment-plan-2026-06-17.md`
- `docs/student-organization-invite-binding-plan-2026-06-25.md`
- `docs/email-verification-access-policy-architecture-plan-2026-06-26.md`
- `docs/email-verification-access-policy-impact-check-2026-06-26.md`

## 11. 机构管理面板国际化

最后一轮明确了边界：

- 平台管理员总后台不在这次国际化范围内。
- 需要国际化的是机构管理面板。

已完成：

- 机构控制台壳层国际化。
- 机构工作区标题、导航、标签、空状态、按钮国际化。
- 成员、分组、邀请、AI 设置、治理日志相关文案国际化。
- 操作状态反馈国际化，包括：
  - 创建机构
  - 保存分组
  - 生成/复制/归档/重发邀请
  - 设置机构管理员
  - 保存额度池
  - 保存 provider
  - CSV 预检/导入
  - 批量成员操作
  - 治理日志刷新
- 补齐中/英/越三套文案。
- 检查机构页使用的 `orgStatus` key，三套语言都已存在。

涉及文件：

- `frontend/src/App.tsx`
- `frontend/src/components/AppRouteRenderer.tsx`
- `frontend/src/components/SiteHeader.tsx`
- `frontend/src/components/admin/AdminConsoleShell.tsx`
- `frontend/src/pages/AdminOrganizationsPage.tsx`
- `frontend/src/i18n/messages/zh-CN.ts`
- `frontend/src/i18n/messages/en.ts`
- `frontend/src/i18n/messages/vi.ts`

验证：

```bash
npm --prefix frontend run build
```

结果：通过。

## 12. 当前代码状态提醒

截至编写本文档时，本地分支为：

```bash
codex/adaptive-ai-questioning
```

最近提交记录显示该分支已经包含多轮重要提交，例如：

- `feat: polish admin organization UX`
- `Finalize admin governance workflows`
- `route audit question bank actions to workspace`
- `refactor admin ai question bank workspace`
- `Implement organization invites and verified access policy`
- `Implement adaptive AI questioning platform`

当前工作区仍有未提交改动，命令 `git status -sb` 显示包括：

- `frontend/src/i18n/messages/en.ts`
- `frontend/src/i18n/messages/vi.ts`
- `frontend/src/i18n/messages/zh-CN.ts`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/styles/home.part-01.css`
- `frontend/src/styles/home.part-02.css`

注意：这些未提交文件中包含首页相关文件，可能来自另一轮修改；提交前应再次确认是否全部属于本次发布范围。

## 13. 已知剩余风险与建议

1. AI 审题不是人工审题替代品。
   - 当前架构已经能做硬伤拦截和门禁判断。
   - 高风险题、建议重生题、低置信度题仍应人工确认。

2. 真题画像链路仍需要继续完善自动化。
   - 用户目标是上传 JSON 后自动解析、自动映射知识点、自动保存、自动进入画像。
   - 当前方向已经明确，但仍需检查 UI 中是否还有手动确认残留。

3. 机构管理面板应继续按“机构管理员”视角打磨。
   - 不应混入平台总后台功能。
   - 后续每次加功能都要检查 direct-link 权限，而不仅是菜单隐藏。

4. 批量任务应尽量后台化。
   - 用户切换页面不应中断补齐候选、批量画像、批量映射等长任务。
   - 前端只展示状态和结果，任务生命周期应由后端持久化。

5. 发布前建议执行：

```bash
npm --prefix frontend run build
```

如涉及后端或 Prisma：

```bash
npm --prefix backend run build
npx prisma generate
```

## 14. 给后续开发的工作顺序建议

建议下一步按这个顺序收尾，而不是继续无限扩张：

1. 先确认当前未提交改动范围，排除与本次发布无关的首页修改。
2. 推送当前稳定分支。
3. 在服务器拉取并验证启动。
4. 回到真题画像全自动链路：
   - JSON 上传
   - AI 自动映射知识点
   - 自动保存映射
   - 自动进入画像
   - 低置信度才人工复核
5. 最后再扩展更多 AI 出题质量治理能力。

