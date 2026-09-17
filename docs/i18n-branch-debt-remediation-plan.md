# 国际化中英分支债务治理方案

更新时间：2026-06-03

## 背景

CSCAlite 已经有一套可用的国际化基础设施：

- `frontend/src/i18n/locales.ts` 已声明 `zh-CN`、`en`、`th`、`vi`、`ko`、`id`、`fr`、`de`、`ru`。
- `I18nProvider`、`useI18n()`、语言选择器和 `messages` 字典已经上线。
- 前台中英文 smoke 测试已经覆盖主要公共路径。
- 后端 CMS 内容块已经支持 `locale`、`requestedLocale`、`isFallback`。

但当前大量代码仍按“中文 / 英文”二选一来写。典型形式是：

```tsx
locale === 'en' ? 'Start Practice' : '开始练习'
```

这种实现可以支撑中英双语，但不适合继续扩展越南语、泰语、印尼语、韩语、法语等更多语言。新增第三语言时，页面逻辑会被迫继续堆分支，最终变成翻译、组件结构、业务逻辑混在一起的高风险状态。

本方案目标是先治理中英分支债务，把系统改造成“新增语言主要添加内容文件，而不是改页面逻辑”的形态。

## 当前问题判断

### 1. 前端仍以 `en` 为特殊分支

最新扫描中，`frontend/src` 内约有 1200+ 处 `locale === 'en'` 判断。它们大致分成四类：

- UI 文案：按钮、标题、空状态、错误提示。
- 结构化学习内容：公式、章节、专项练习说明、可视化工具说明。
- 数据字段选择：`nameEn` / `nameZh`、英文标签 fallback。
- 格式化差异：日期、数字、单位、考试语言展示。

前两类应该治理掉；第三类需要抽 helper；第四类允许保留，但应收敛到 formatter。

### 2. 英文专用内容散落在页面组件中

已有大量 `EN_*` / `ENGLISH_*` 常量，例如：

- `frontend/src/pages/CscaSubjectPage.tsx`
- `frontend/src/pages/CscaSpecialPracticePage.tsx`
- `frontend/src/pages/special-practice/MathVisualizers.tsx`
- `frontend/src/pages/special-practice/ChemistryVisualizers.tsx`

这些内容不是页面交互逻辑，却放在页面组件里。新增越南语时，如果继续添加 `VI_*`，页面会迅速失控。

### 3. 后端多处“非英文即中文”

部分后端服务目前仍是：

```ts
return locale?.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
```

典型模块包括：

- schools
- scholarships
- csca mock exam
- past papers
- special practice language handling

这会导致 `locale=vi` 被当成中文处理，前端无法准确知道内容到底是越南语缺失、中文 fallback，还是接口不支持该语言。

### 4. 已有测试偏向中英文上线，不足以保护多语言扩展

`i18n-smoke` 对英文质量很有价值，但多语言扩展还需要：

- 禁止新增语言专用页面组件。
- 禁止新增高密度 `locale === 'en'` 分支。
- 结构化内容 locale parity 检查。
- 新语言启用前的 coverage gate。
- fallback 报告，而不是只靠页面不报错。

## 治理目标

### 产品目标

支持后续按顺序增加越南语、泰语、印尼语等语言，并让每次新增语言的主要工作变成：

- 新增 message 文件。
- 新增结构化内容 locale 包。
- 补 CMS 或数据库翻译。
- 跑 coverage 和 smoke。

而不是：

- 修改大量 TSX。
- 给每个页面加 `locale === 'vi'`。
- 复制英文页面组件。
- 在后端继续扩展二选一分支。

### 技术目标

最终希望前台页面符合这个形态：

```text
Shared React component
  -> t('namespace.key')
  -> getLocalizedContent(content, locale)
  -> formatDate(value, locale)
  -> getLocalizedField(record, locale)
```

不再出现：

```text
EnglishXxxPage
XxxPageZh
locale === 'en' ? <EnglishLayout /> : <ChineseLayout />
locale === 'en' ? EN_COPY : ZH_COPY
```

## 设计原则

### 1. 一套组件，多套内容

语言差异只能体现在：

- message 字典。
- 结构化内容包。
- CMS / 数据库翻译字段。
- locale formatter。

不能体现在：

- 分语言页面组件。
- 分语言 JSX 结构。
- 页面组件里堆每种语言的文案常量。

### 2. 中文是默认 fallback，但 fallback 必须可见

生产环境可以 fallback 到中文，避免页面空白；但测试和后台必须知道哪些内容 fallback 了。

推荐响应或报告包含：

```ts
type TranslationMeta = {
  requestedLocale: string;
  resolvedLocale: string;
  isFallback: boolean;
  missingFields?: string[];
};
```

### 3. UI 文案和学习内容分层

UI 文案进：

```text
frontend/src/i18n/messages/{locale}.ts
```

结构化学习内容进：

```text
frontend/src/content/localized/...
```

数据库内容使用：

- 现有双字段。
- locale JSON。
- 模块专属 translation table。

不能把所有内容都塞进 `messages`，也不能把所有翻译都留在 TSX。

### 4. 新语言启用必须有门禁

`SUPPORTED_LOCALES.enabled` 不能只靠手工改 true。启用前至少需要：

- messages coverage 达标。
- 核心公共路径 smoke 通过。
- CMS 核心内容有对应 locale 或明确 fallback。
- 不出现 raw key。
- 不出现意外中文 UI 文案。
- 页面无明显横向溢出。

## 推荐架构改造

### 1. 前端 locale 工具层

新增或整理一个统一 helper 层：

```text
frontend/src/i18n/locale-utils.ts
frontend/src/i18n/formatters.ts
frontend/src/i18n/localized-content.ts
```

建议能力：

```ts
export type LocalizedMap<T> = Partial<Record<Locale, T>> & { 'zh-CN': T };

export function pickLocalized<T>(
  value: LocalizedMap<T>,
  locale: Locale,
  fallbackLocale: Locale = 'zh-CN'
): T;

export function pickLocalizedString(
  value: Partial<Record<Locale, string>>,
  locale: Locale,
  fallback = ''
): string;

export function isContentReadyForLocale<T>(
  value: Partial<Record<Locale, T>>,
  locale: Locale
): boolean;
```

页面使用：

```ts
const copy = pickLocalized(SUBJECT_COPY, locale);
```

而不是：

```ts
const copy = locale === 'en' ? ENGLISH_SUBJECT_COPY[subject] : SUBJECT_COPY[subject];
```

### 2. message 注册改成可扩展结构

当前 `messages/index.ts` 只注册 `zh-CN` 和 `en`。应改成新增语言时只需要引入语言文件：

```ts
import { zhCNMessages } from './zh-CN';
import { enMessages } from './en';
import { viMessages } from './vi';

export const messages = {
  'zh-CN': zhCNMessages,
  en: enMessages,
  vi: viMessages
} as const;
```

并增加 message parity 检查，确保 `vi` 和 `zh-CN` 的 key 结构一致。

### 3. 结构化内容包

建议按模块拆：

```text
frontend/src/content/localized/csca-subjects.ts
frontend/src/content/localized/csca-formulas.ts
frontend/src/content/localized/special-practice.ts
frontend/src/content/localized/math-visualizers.ts
frontend/src/content/localized/chemistry-visualizers.ts
frontend/src/content/localized/mock-exam.ts
```

结构示例：

```ts
export const subjectCopy = {
  math: {
    'zh-CN': {
      title: '数学',
      body: '函数、几何、概率统计'
    },
    en: {
      title: 'Math',
      body: 'Functions, geometry, probability'
    },
    vi: {
      title: 'Toán',
      body: 'Hàm số, hình học, xác suất thống kê'
    }
  }
} satisfies Record<string, LocalizedMap<SubjectCopy>>;
```

结构化数组必须使用稳定 `id`：

```ts
type FormulaSection = {
  id: string;
  title: string;
  items: Array<{
    id: string;
    name: string;
    formula: string;
    tip: string;
  }>;
};
```

各语言必须共享同一组 `id`，只替换文案字段。

### 4. 后端 locale 标准化

新增统一公共 locale 定义，避免每个 service 自己写 `normalizeLocale`：

```text
backend/src/common/locales.ts
```

建议：

```ts
export const DEFAULT_PUBLIC_LOCALE = 'zh-CN';

export const SUPPORTED_PUBLIC_LOCALES = [
  'zh-CN',
  'en',
  'vi',
  'th',
  'id',
  'ko',
  'fr',
  'de',
  'ru'
] as const;

export type PublicLocale = (typeof SUPPORTED_PUBLIC_LOCALES)[number];

export function normalizePublicLocale(value: unknown): PublicLocale {
  // zh, zh-CN, zh-Hans -> zh-CN
  // en, en-US -> en
  // vi, vi-VN -> vi
  // unsupported -> zh-CN
}
```

对于暂未翻译的模块，仍应保留 requested locale：

```ts
const requestedLocale = normalizePublicLocale(input);
const resolvedLocale = hasVietnameseContent ? requestedLocale : DEFAULT_PUBLIC_LOCALE;
```

这样才能生成准确缺口报告。

### 5. coverage 和 fallback 报告

建议增加脚本：

```text
frontend/scripts/check-i18n-message-parity.cjs
frontend/scripts/check-localized-content-parity.cjs
frontend/scripts/report-i18n-coverage.cjs
scripts/content-locale-coverage.cjs
```

报告维度：

- message key coverage。
- 结构化内容 id parity。
- 关键页面是否支持目标 locale。
- CMS 内容块缺失 key。
- 后端接口是否保留 requested locale。

示例输出：

```text
i18n coverage for vi
- messages: 94.2%
- public shell: ready
- home CMS blocks: 8/10 translated, 2 fallback
- csca formulas: missing 3 item tips
- special practice: not ready
- schools domain data: fallback only

Locale vi cannot be enabled yet.
```

## 分阶段执行计划

### Phase 0：冻结新增债务

目标：先让债务不再增长。

任务：

- 升级 `frontend/scripts/check-i18n-debt.cjs`。
- 禁止新增 `English[A-Z].*Page`。
- 禁止新增 `PageZh`。
- 禁止新增 `locale === 'en' ? <Component />` 形式的 JSX 分支。
- 为高债务文件保留 baseline，但 PR 不能让数量上升。
- 在 `frontend/package.json` 中把门禁接入 `test:i18n-debt`。

验收：

- `npm --prefix frontend run test:i18n-debt` 通过。
- 新增语言专用页面会失败。
- 新增大段中英三元 JSX 会失败。

优先级：最高。

预计工作量：0.5-1 天。

### Phase 1：建立多语言 helper 和 message parity

目标：给后续重构提供统一工具。

任务：

- 新增 `LocalizedMap<T>`、`pickLocalized()`、`pickLocalizedString()`。
- 新增 locale formatter：日期、数字、列表、简单插值。
- 给 `messages` 增加 key parity 检查。
- 准备 `vi.ts` 模板，但不启用 `vi`。
- 保持 `SUPPORTED_LOCALES.vi.enabled = false`。

验收：

- `zh-CN` / `en` messages key 完全一致。
- `vi.ts` 可以作为模板存在，但 coverage 不达标时不能启用。
- 页面可逐步从 `locale === 'en'` 迁移到 helper。

预计工作量：1-2 天。

### Phase 2：用 `CscaSubjectPage` 做样板

目标：把一个中等复杂度页面改成可扩展多语言模式。

为什么选它：

- 它有公式、学科入口、模拟工具说明等结构化内容。
- 债务集中但范围可控。
- 做完后能给专项练习提供模板。

任务：

- 抽出 `csca-subjects.ts`。
- 抽出 `csca-formulas.ts`。
- 将 `ENGLISH_FORMULA_COPY`、`ENGLISH_SUBJECT_COPY` 等迁移到 localized content。
- 公式章节和条目增加稳定 `id`。
- 新增 formula/content parity 测试。
- 页面只使用一套 JSX。

验收：

- `CscaSubjectPage.tsx` 不再出现英文专用页面组件。
- 公式内容各语言结构一致。
- 中英文 smoke 通过。
- 可以新增 `vi` 公式文案而不改页面 JSX。

预计工作量：2-4 天。

### Phase 3：治理专项练习主页面

目标：处理最大债务源。

范围：

- `CscaSpecialPracticePage.tsx`
- 专项首页。
- 科目列表。
- topic start/session/report。
- 练习结果、答案状态、资源链接。

任务：

- 把 `SPECIAL_PRACTICE_COPY.zh/en` 改成 locale map。
- 把 `EN_SUBJECT_LABELS`、`EN_SUBJECT_DESCRIPTIONS`、`EN_MODULE_LABELS` 等抽出。
- 把 topic/module/tag/status 文案放进 localized content 或 messages。
- 保留题目内容语言和 UI locale 的边界：题目语言不是 UI 语言。
- 建立 topic/module id parity 检查。

验收：

- `CscaSpecialPracticePage.tsx` 的 `locale === 'en'` 数量下降 70% 以上。
- 新增 `vi` subject/module/topic 文案不需要改 JSX。
- 练习开始、答题、报告路径中英文 smoke 通过。

预计工作量：4-7 天。

### Phase 4：治理可视化工具

目标：把数学、化学、物理可视化工具里的控件文案和说明文案抽离。

范围：

- `frontend/src/pages/special-practice/MathVisualizers.tsx`
- `frontend/src/pages/special-practice/ChemistryVisualizers.tsx`
- `frontend/src/pages/special-practice/Physics*VisualizerView.tsx`

任务：

- 抽 `math-visualizers.ts`。
- 抽 `chemistry-visualizers.ts`。
- 抽 `physics-visualizers.ts`。
- 把控件 label、legend、warning、support copy 全部 locale map 化。
- 数学符号、公式、变量名保留原样，不翻译。
- 给 aria-label 加 coverage。

验收：

- 可视化工具新增语言不需要改组件结构。
- 控件文案、说明文案、aria-label 无中文意外残留。
- Playwright smoke 路径通过。

预计工作量：5-10 天。

### Phase 5：后端 locale 统一化

目标：让 `vi` 等未来语言在后端不再被误判为中文。

任务：

- 新增 `backend/src/common/locales.ts`。
- 替换以下模块本地 `PublicLocale` 和 `normalizeLocale`：
  - schools
  - scholarships
  - content
  - csca mock exam
  - csca special practice
  - past papers
  - study china
  - search
- 对无翻译内容返回明确 fallback meta。
- CMS `ENABLED_CONTENT_LOCALES` 改成共享配置或至少包含未来支持 locale。

验收：

- `locale=vi` 不再被静默当成 `zh-CN`。
- 接口响应能区分 `requestedLocale=vi` 和 `resolvedLocale=zh-CN`。
- 英文现有行为不回退。

预计工作量：3-6 天。

### Phase 6：页面级 COPY 收敛

目标：把剩余低风险页面从局部 `COPY.zh/en` 迁入统一 messages 或 content。

优先顺序：

1. `CartPage.tsx`
2. `CheckoutPage.tsx`
3. `OrdersPage.tsx`
4. `SearchPage.tsx`
5. `PublicAuthPage.tsx`
6. `ConsultingPage.tsx`
7. `ComparePage.tsx`
8. `CscaExamTimePage.tsx`

任务：

- UI 文案迁入 `messages`。
- 页面专属结构化内容迁入 `frontend/src/content/localized`。
- 业务枚举标签走 `getLocalizedLabel()`。

验收：

- 页面中不再新增 `COPY.zh/en`。
- 新语言只补 message/content。
- 现有中英文 smoke 通过。

预计工作量：3-6 天。

### Phase 7：新语言 readiness gate

目标：让启用越南语有明确标准。

任务：

- 为 `vi` 增加 coverage 报告。
- 新增 `test:i18n-readiness -- --locale vi` 或等价脚本。
- 定义核心路径：
  - `/`
  - `/csca-prep`
  - `/csca-mock-exam`
  - `/schools`
  - `/schools/:id`
  - `/services/consulting`
  - `/auth`
- 对核心路径做越南语 smoke。
- 输出“能否 enabled”的结论。

验收：

- `vi.enabled = true` 前必须通过 readiness gate。
- 未达标时脚本列出具体缺失模块。

预计工作量：2-4 天。

## 建议执行顺序

推荐按下面顺序推进：

1. Phase 0：冻结新增债务。
2. Phase 1：helper + parity 基础。
3. Phase 2：`CscaSubjectPage` 样板。
4. Phase 5：后端 locale 统一化。
5. Phase 3：专项练习主页面。
6. Phase 4：可视化工具。
7. Phase 6：低风险页面 COPY 收敛。
8. Phase 7：越南语 readiness gate。

如果目标是尽快启动越南语，可以把 Phase 5 提前到 Phase 2 后立即做，避免前端已经能切 `vi`，后端却把 `vi` 当中文。

## 越南语上线前最小可行范围

如果先做越南语第一版，不建议追求全站一次完成。建议最小范围：

- Header / Footer / Home。
- Auth / account 基础入口。
- CSCA Prep。
- Mock Exam overview 和 subject list。
- Schools list 和 school detail 的 UI 壳层。
- CMS home blocks 支持 `vi`。
- 后端保留 `requestedLocale=vi`，数据内容允许 fallback，但必须报告。

暂缓：

- 专项练习完整题目翻译。
- 模考题目翻译。
- 全量学校、项目、奖学金长文本翻译。
- SEO locale routes。
- 后台管理全量越南语。

## 测试与发布门禁

### 每次债务治理 PR

必须跑：

```bash
npm --prefix frontend run build
npm --prefix frontend run test:minimal
npm --prefix frontend run test:i18n-debt
```

涉及 i18n 内容结构时增加：

```bash
npm --prefix frontend run test:i18n-content
```

涉及后端 locale 时增加：

```bash
npm run backend:build
```

### 新语言启用 PR

必须跑：

```bash
npm --prefix frontend run build
npm --prefix frontend run test:i18n
npm run verify:i18n
```

并补充：

- locale readiness report。
- 核心路径截图或 Playwright 结果。
- fallback 缺失清单。
- 明确哪些模块仍未翻译。

## 风险与应对

### 风险：一次性重构太大

应对：按模块拆 PR。先样板，再复制模式。

### 风险：翻译内容和组件结构同时变化，难 review

应对：先抽结构，保留原中英文文本；再单独补新语言。

### 风险：fallback 让测试误判为通过

应对：页面 smoke 检查“不报错”，coverage gate 检查“是否真的翻译”。

### 风险：考试题目被当作 UI 文案翻译

应对：明确区分 UI locale 和 content language。考试题目必须是人工审核后的内容语言，不做请求时机器翻译。

### 风险：后台中文硬编码影响进度

应对：后台不作为越南语第一版范围，除非运营角色需要多语言后台。

## 交付物清单

第一批建议交付：

- `frontend/src/i18n/locale-utils.ts`
- `frontend/src/i18n/formatters.ts`
- `frontend/scripts/check-i18n-message-parity.cjs`
- 升级后的 `frontend/scripts/check-i18n-debt.cjs`
- `frontend/src/content/localized/csca-subjects.ts`
- `frontend/src/content/localized/csca-formulas.ts`
- `backend/src/common/locales.ts`
- `docs/i18n-branch-debt-remediation-plan.md`

第二批建议交付：

- `frontend/src/content/localized/special-practice.ts`
- `frontend/src/content/localized/math-visualizers.ts`
- `frontend/src/content/localized/chemistry-visualizers.ts`
- `frontend/src/content/localized/physics-visualizers.ts`
- locale coverage report script。
- `vi.ts` message 文件和 readiness gate。

## 决策建议

建议现在先立项做“中英分支债务治理”，不要直接进入越南语翻译。

推荐第一轮范围：

1. 冻结新增债务。
2. 建 helper 和 parity 检查。
3. 以 `CscaSubjectPage` 做样板。
4. 统一后端 locale normalize。

完成这轮后，再新增越南语会更稳定，后续泰语、印尼语等语言也能复用同一套流程。
