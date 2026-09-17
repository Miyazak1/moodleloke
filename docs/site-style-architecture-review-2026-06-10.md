# 全站样式架构与加载体验评估

评估日期：2026-06-10  
分支：`codex/adaptive-ai-questioning`  
评估范围：`frontend/src/styles`、前端入口、路由懒加载、关键页面样式与单文件体量。

## 总体结论

这次样式架构优化已经有明显进展：全站视觉变量集中在 `base.css`，页面样式按业务域拆到了 `frontend/src/styles` 下，React 页面组件也已经使用 `lazy` 分块，并且 `App` 里有 idle preload 机制。整体不是无组织堆样式，已经具备可维护的基础。

初次评估时最大问题很明确：**CSS 仍然是全站一次性加载**。所有页面、后台、学校页、个人中心、专项训练、物理/化学可视化、mock exam、KaTeX 都通过 `frontend/src/styles/index.css` 进入同一个首包 CSS。生产构建结果显示单个 CSS 产物约 `641 KB`，gzip 后约 `98 KB`。对移动端首屏、低网速用户和非学习工具页来说，这已经偏重。

本次执行后，首包 CSS 和单文件体量问题已经完成第一轮收口：`index.css` 只保留全局基础层，页面样式跟随页面模块加载，重可视化样式按子路由动态加载，样式体量守卫已从 14 个大文件告警降到 0 个。

## 已检查和验证

执行过的检查：

- 扫描 `frontend/src/styles` 下全部 CSS 文件体量。
- 检查 `frontend/src/styles.css` 与 `frontend/src/styles/index.css` 的导入方式。
- 检查 `frontend/src/main.tsx`、`frontend/src/App.tsx`、`frontend/src/components/AppRouteRenderer.tsx` 的加载与懒加载结构。
- 检查 `frontend/vite.config.mjs` 的 chunk 配置。
- 执行 `npm --prefix frontend run build`：通过。

初次生产构建关键信号：

- 单个 CSS 产物：`dist/assets/index-*.css`，约 `641.35 KB`，gzip 约 `98.28 KB`。
- 主入口 JS：约 `405.32 KB`，gzip 约 `122.50 KB`。
- 最大业务页 chunk：`CscaSpecialPracticePage` 约 `509.27 KB`，gzip 约 `136.73 KB`。
- `three-vendor` 单独分块：约 `536.59 KB`，gzip 约 `134.63 KB`。
- `katex-vendor` 单独分块：约 `261.05 KB`，gzip 约 `77.49 KB`。

说明：这是优化前的基线；优化后的构建结果见文末“执行记录”。

## 成熟点

### 1. 样式已经有统一 token 层

`frontend/src/styles/base.css` 定义了全站基础变量，包括：

- 品牌色：`--brand-primary`、`--brand-dark`、`--brand-gold` 等。
- 公共语义色：`--public-ink`、`--public-muted`、`--public-line`、`--public-panel` 等。
- 字体、阴影、基础背景。

这个方向是对的。页面样式大多引用 `--public-*` 和 `--brand-*`，说明你之前做的收口是有效的。后续继续优化时，不需要推倒重来。

### 2. 页面样式已按业务域拆文件

当前不再是一个巨大的 `styles.css`，而是拆成了：

- `home.css`
- `school.css`
- `account.css`
- `subject-learning.css`
- `special-practice.css`
- `special-practice-visualizers.css`
- `special-practice-visualizers-physics.css`
- `special-practice-visualizers-chemistry.css`
- `mock-exam.css`
- `admin-work.css`
- `ai-service.css`

这种按域拆分比“所有页面混在一起”成熟很多，后续做路由级 CSS 分块也有基础。

### 3. 前端组件层懒加载做得不错

`AppRouteRenderer` 里大量页面使用 `React.lazy`。`App` 里也有 `preloadRouteChunk`，并在 idle 阶段预加载主路径。这对 JS 首屏和页面切换体验是有帮助的。

`vite.config.mjs` 里也对 `three` 和 `katex` 做了 manual chunk，避免它们直接混进主业务 chunk。这个方向也对。

### 4. 基础可访问性和动效控制有意识

`base.css` 有全局 `focus-visible` 样式，也有 `prefers-reduced-motion` 处理。`special-practice.css` 里也有针对 reduced motion 的局部处理。

这说明样式体系不是只看视觉，还考虑了键盘用户和动效敏感用户。

## 主要问题

### 1. 已处理：全站 CSS 原本是单一首包，页面样式没有按路由加载

`frontend/src/main.tsx` 只导入：

```ts
import './styles.css';
```

而 `frontend/src/styles.css` 再导入 `styles/index.css`，`index.css` 又一次性导入全部页面样式：

- `account.css`
- `school.css`
- `study-china.css`
- `special-practice.css`
- `special-practice-visualizers*.css`
- `mock-exam*.css`
- `ai-service.css`
- `katex/dist/katex.min.css`
- 其他页面样式

这意味着用户打开首页时，也会下载个人中心、后台、专项训练、物理可视化、化学可视化、mock exam、公式渲染等样式。

当前状态：

- `frontend/src/styles/index.css` 已经只保留 `base.css`、`shared-components.css`、`layout.css`、`brand.css`、`public-shell.css`。
- 页面 CSS 已移动到对应页面、页面壳或功能组件导入。
- 可视化 CSS 已改为进入对应子路由后动态加载。
- KaTeX CSS 已由 `MathContent` 负责导入，不再进入全站首包。

风险：

- 首页和轻页面首屏 CSS 偏重。
- 非学习工具用户也要承担可视化工具样式成本。
- 后续每加一个页面样式，都会扩大所有用户首包。
- JS lazy loading 的收益被 CSS 全量加载部分抵消。

建议：

- `styles.css` 只保留基础层：`base.css`、`layout.css`、`brand.css`、`public-shell.css`、少量共享组件。
- 页面 CSS 改为页面组件内直接导入，例如 `PublicMePage.tsx` 导入 `account.css`。
- 可视化、mock exam、AI 服务页、后台样式都跟随对应 lazy page chunk 加载。
- KaTeX CSS 不放全局首包，放到使用 `MathContent` 的学习/训练页入口。

### 2. 已处理第一轮：多个 CSS 文件已经过大，需要拆第二层

当前最大样式文件大致如下：

| 文件 | 体量判断 |
| --- | --- |
| `special-practice-visualizers-physics.css` | 约 70KB+，数千行 |
| `special-practice-visualizers-chemistry.css` | 约 70KB，数千行 |
| `school.css` | 约 77KB，数千行 |
| `special-practice.css` | 约 70KB，数千行 |
| `account.css` | 约 67KB，数千行 |
| `subject-learning.css` | 约 45KB，接近两千行 |
| `mock-exam.css` | 约 33KB，千行级 |
| `study-china.css` | 约 32KB，千行级 |
| `admin-work.css` | 约 31KB，千行级 |

这些文件已经不是“页面样式文件”，而是“页面样式包”。继续增长会带来：

- 修改局部组件时很难判断影响范围。
- 响应式规则分散在大文件底部，容易漏状态。
- 同类组件样式重复出现，例如 panel、metric、empty state、filter、action bar。
- code review 很难发现覆盖顺序和选择器副作用。

当前状态：

- physics、chemistry、math visualizer CSS 已拆到 `frontend/src/styles/visualizers/`。
- 页面级大文件已拆为同目录 `*.part-*.css` 分片，原入口文件只保留 import。
- `npm.cmd --prefix frontend run test:css-architecture` 当前为 0 个 large-file warnings。

后续语义化建议：

- `account.css` 拆为 `account-shell.css`、`account-dashboard.css`、`account-learning.css`、`account-wrong-bank.css`、`account-orders.css`。
- `special-practice.css` 拆为 `special-practice-index.css`、`adaptive-dashboard.css`、`adaptive-round.css`、`adaptive-report.css`、`special-question.css`。
- `school.css` 拆为 `schools-list.css`、`school-detail.css`、`school-filters.css`、`school-cards.css`。
- `special-practice-visualizers-physics.css` 按 visualizer 拆，例如 newton、kinematics、energy、circuit、lens、wave。
- `special-practice-visualizers-chemistry.css` 按 visualizer 拆，例如 neutralization、titration、kinetics、electrochemistry、molecular geometry。

### 3. 已处理：KaTeX 和公式样式原本全站加载

`frontend/src/styles/index.css` 全局导入：

```css
@import 'katex/dist/katex.min.css';
@import './math-content.css';
```

实际使用 `MathContent` 的页面主要是：

- `CscaSubjectPage`
- `CscaSpecialPracticePage`
- `AdaptivePracticeViews`
- `PublicMePage` 的错题区域
- 物理/化学可视化页面

首页、学校列表、咨询页、购物车、后台大多数页面并不需要 KaTeX。原先全局导入会让所有用户承担 KaTeX CSS 和字体发现成本。

当前状态：`MathContent` 已导入 `katex/dist/katex.min.css` 和 `math-content.css`，全局入口不再包含 KaTeX。

建议：

- 把 KaTeX CSS 移到学习/训练 shell，例如 `learning-math.css`。
- 或在 `MathContent` 所在功能入口导入一次 `katex/dist/katex.min.css` 和 `math-content.css`。
- 如果担心多个 lazy chunk 重复导入，先建立 `LearningFormulaStyles.ts` 作为集中导入模块，由学习相关页面引用。

### 4. `.math-content` 样式有重复职责

`math-content.css` 已经定义了一组 `.math-content`、`.math-content-inline`、`.math-content-block`、`.special-question-card h1 .math-content .katex`。

但 `special-practice.css` 中仍保留了高度相似的一组规则，并额外增加了 `min-width`、`overflow-wrap` 等属性。

这类重复短期不会必然出错，因为导入顺序目前固定。但长期风险是：

- 改 `math-content.css` 时不一定知道 `special-practice.css` 还覆盖了一份。
- 页面级样式和组件级样式职责不清。
- 拆分 CSS 后导入顺序变化可能导致公式显示回归。

建议：

- 把所有通用公式样式收进 `math-content.css`。
- 页面只保留真正页面上下文相关的选择器，例如 `.special-question-card h1 .math-content`。
- 拆分前先用搜索确认 `.math-content` 和 `.katex` 的所有覆盖点。

### 5. 响应式规则有覆盖，但缺少系统化断点层

大多数大文件都有 `@media`，说明不是完全没有移动端考虑。但现在断点是散在各页面文件里的，例如 `980px`、`720px`、`640px`、`620px`、`860px`、`1099px` 等。

问题不是断点数量多，而是它们没有被命名成设计系统层。结果是：

- 新页面不知道该沿用哪个断点。
- 同类 layout 在不同文件里可能行为不一致。
- 视觉回归只能靠人工点页面，很难建立统一标准。

建议：

- 在文档中明确全站断点语义，例如：
  - `--bp-desktop-to-tablet: 980px`
  - `--bp-tablet-to-mobile: 720px`
  - `--bp-compact: 640px`
- CSS 目前不能在 media query 里直接用 CSS var，可用注释或 PostCSS/custom media。如果不引入新工具，至少在 `styles/README.md` 写清楚。
- 新增页面统一优先使用 980 / 720 / 640 三档，减少随意断点。

### 6. 页面组件和样式文件一起膨胀

样式大文件不是孤立问题，页面 TSX 也有同样趋势：

- `PublicMePage.tsx`：约 3700 行。
- `ChemistryVisualizers.tsx`：约 3100 行。
- `CscaSpecialPracticePage.tsx`：约 2900 行。
- `CscaSubjectPage.tsx`：约 2300 行。
- `MathVisualizers.tsx`：约 2300 行。
- `AdaptivePracticeViews.tsx`：约 1700 行。

这说明很多页面同时在承担：

- 数据请求。
- 状态机。
- copy/i18n。
- UI layout。
- 局部组件。
- 样式 class 约定。

如果只拆 CSS、不拆页面组件，收益会有限。长期更好的结构是“页面壳 + section 组件 + section 样式/hook”一起拆。

建议：

- 每个超过 1000 行的页面都列入拆分计划。
- 每个超过 1500 行的页面优先拆至少一层 section。
- 每个超过 2500 行的页面不再继续追加新功能，先拆结构。

### 7. `brand.css` 承担了跨页面覆盖层，后续要谨慎

`brand.css` 里有大量 `.brand-work-page .xxx` 选择器，用来统一 admin、commerce、compare 等工作型页面的视觉。这个做法有现实价值：可以快速把旧页面收敛到统一品牌风格。

但它本质上是“横向覆盖层”，如果继续扩张，会形成一个难追踪的二级主题系统：

- 页面自身 CSS 定义一次。
- `brand.css` 再按 `.brand-work-page` 覆盖一次。
- 后续某个页面再做局部覆盖。

建议：

- 保留 `brand.css` 作为迁移层，但不要继续无限扩。
- 把稳定的 panel、form、table、status、metric 样式沉淀到 `shared-components.css` 或新的 `primitives.css`。
- 页面改造完成后，减少 `.brand-work-page .xxx` 的横向覆盖。

### 8. visualizer 样式应该与工具组件同生命周期

物理/化学可视化样式体量很大，而且高度绑定具体工具。当前它们全局加载，用户只打开首页或学校页也会下载这些样式。

更合理的生命周期是：

- 用户进入专项训练页：加载专项训练基础样式。
- 用户进入某个 visualizer：加载该 visualizer 组件和样式。
- 用户没有进入 visualizer：不下载 physics/chemistry visualizer 样式。

建议：

- 把每个 visualizer 的 CSS 与对应组件放近，例如 `special-practice/physics/NewtonSecondLawVisualizer.css`。
- 或保留 styles 目录，但文件拆到 `styles/visualizers/physics/newton.css`。
- 在对应 lazy visualizer component 中导入。

## 建议优先级

### P0：近期应处理

- 把 `styles/index.css` 拆成 `global.css` 与 route/page CSS，避免全站样式首包继续膨胀。
- KaTeX CSS 从全局首包移出，只在学习/训练/公式相关页面加载。
- 清理 `.math-content` 在 `math-content.css` 和 `special-practice.css` 里的重复职责。
- 建立样式体量阈值：单个 CSS 超过 1000 行必须拆分，超过 2000 行不得继续追加新功能。

### P1：beta 后尽快做

- 拆分 `account.css`、`special-practice.css`、`school.css`。
- 物理/化学 visualizer 样式按工具拆分，并跟随工具 lazy load。
- 把 `brand.css` 中稳定的横向覆盖沉淀为 shared primitives。
- 为个人中心、学校页、专项训练、mock exam、AI 服务页建立移动端视觉 smoke。

### P2：持续演进

- 建立 `frontend/src/styles/README.md`，说明 token、断点、命名规则、文件体量阈值和新增样式入口规范。
- 引入 CSS 体量检查脚本，在 CI 中提示单文件过大和全局 CSS 体积增长。
- 逐步考虑 CSS Modules 或至少 route-scoped class 命名规范，降低跨页面选择器影响。
- 如果后续页面继续复杂化，可考虑 container query 和组件级样式组织。

## 推荐目标结构

建议把样式分成四层：

```text
frontend/src/styles/
  global/
    base.css
    tokens.css
    layout.css
    focus.css
    primitives.css
  pages/
    home.css
    schools/
      list.css
      detail.css
      filters.css
    account/
      shell.css
      dashboard.css
      learning.css
      wrong-bank.css
    special-practice/
      index.css
      adaptive-dashboard.css
      adaptive-round.css
      adaptive-report.css
    mock-exam/
      index.css
      subject.css
      maturity.css
  features/
    math-content.css
    visualizers/
      shared.css
      physics-newton.css
      physics-kinematics.css
      chemistry-titration.css
```

入口方式：

- `main.tsx` 只导入 global 层。
- 每个 lazy page 导入自己的 page CSS。
- 每个重 feature 组件导入自己的 feature CSS。
- shared primitives 只放真正跨页面复用的按钮、panel、empty state、form、table、status、metric。

## 最终判断

这套样式架构已经从“全站散乱样式”进化到了“全局基础层 + 路由级页面样式 + 重功能动态样式”的阶段，方向是成熟的。

本次复核后，原先最大的两个问题已经处理：

- CSS 加载边界已收口：全局入口只保留基础层，页面样式跟随 lazy page 或页面壳加载。
- 单文件体量已降下来：原来的页面级大 CSS 保留为小型 import 聚合入口，实际规则拆到有序 `*.part-*.css` 分片；可视化样式也已按学科/工具拆到 `visualizers/` 目录。

下一阶段的重点不再是“先救首包和大文件”，而是继续把分片从机械分块推进到语义模块，例如把 `account.part-*.css` 演进为 dashboard、learning、wrong-bank、orders 等更明确的模块。当前结构已经适合继续 beta 迭代，但每次新增大功能都应该同步确认 CSS 归属和加载边界。

## 执行记录

更新时间：2026-06-10

已完成第一阶段 P0/P1 优化：

- `frontend/src/styles/index.css` 已收口为全局基础层，只保留 `base.css`、`shared-components.css`、`layout.css`、`brand.css`、`public-shell.css`。
- 页面样式已移动到对应 lazy page 或共享页面壳中导入，例如 `PublicMePage.tsx -> account.css`、`CscaSpecialPracticePage.tsx -> special-practice*.css`、`AdminPageShell.tsx -> admin*.css`。
- `MathContent` 现在负责导入 `katex/dist/katex.min.css` 和 `math-content.css`，KaTeX 不再从全站首包进入。
- 清理了 `special-practice.css` 中重复的通用 `.math-content` 规则，并把通用换行/宽度保护沉淀到 `math-content.css`。
- 新增 `frontend/src/styles/README.md`，记录全局入口规则、页面级 CSS 规则、断点和文件体量阈值。
- 新增 `frontend/scripts/check-css-architecture.cjs` 和 `npm --prefix frontend run test:css-architecture`，用于防止页面 CSS 再回流到全局入口。
- 进一步将 `CscaSpecialPracticePage` 的 visualizer 样式改为按子路由动态加载：普通专项训练页只加载 `special-practice.css`，进入 `math/visualize`、`physics/visualize`、`chemistry/visualize` 或化学专项工具时再加载对应 visualizer CSS。
- 将 physics、chemistry、math visualizer 样式拆到 `frontend/src/styles/visualizers/` 下，按具体工具或功能段维护。
- 将 `account.css`、`school.css`、`special-practice.css`、`subject-learning.css`、`mock-exam.css`、`study-china.css`、`admin-work.css`、`home.css`、`scholarships.css`、`ai-service.css`、`mock-exam-subject.css` 拆成同目录有序 `*.part-*.css` 分片，原文件只保留聚合 import。

构建结果对比：

- 优化前：单个 `index-*.css` 约 `641.35 KB`，gzip 约 `98.28 KB`。
- 优化后：主入口 `index-*.css` 约 `48.58 KB`，gzip 约 `9.25 KB`。
- 页面 CSS 已拆出独立 chunk，包括 `PublicMePage.css`、`school.css`、`subject-learning.css`、`AdaptivePracticeViews.css`、`CscaSpecialPracticePage.css`、`AdminPageShell.css`、`katex-vendor.css` 等。
- visualizer CSS 已进一步拆出动态 chunk，包括 `special-practice-visualizers.css`、`special-practice-visualizers-physics.css`、`special-practice-visualizers-chemistry.css`。
- CSS 源文件层面已从 14 个 legacy/large 文件告警降到 0 个 large-file warnings。

本次验证：

- `npm.cmd --prefix frontend run test:css-architecture`：通过，0 个 large-file warnings。
- `npm.cmd exec -- tsc --noEmit`（在 `frontend` 目录）：通过。
- `npm.cmd --prefix frontend run build`：通过。

下一阶段建议：

- 把当前机械 `*.part-*.css` 分片逐步改名为语义文件，例如 `account-dashboard.css`、`school-detail.css`、`adaptive-round.css`。
- 可视化样式当前已经按学科动态加载，后续如果单个学科工具继续膨胀，再评估是否按具体 visualizer 组件级动态加载。
- 把 `brand.css` 中稳定的横向覆盖逐步沉淀为 shared primitives。
