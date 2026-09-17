# 国际化技术债审计与成熟化方案

更新时间：2026-05-19

## 结论

当前国际化已经具备可用的基础层：`I18nProvider`、语言选择器、`messages` 字典、英文 smoke 测试和部分接口 `locale` 参数都已经存在。但实现方式仍混合了三种形态：

- 成熟形态：一套组件，通过 `t()` 和 locale-aware 数据渲染不同语言。
- 可接受过渡形态：组件内选择 `COPY.zh` / `COPY.en`，但 JSX 结构仍然只有一套。
- 高风险技术债：按语言拆出整页组件，或在组件内大量 `locale === 'en' ? ... : ...` 分支，导致后续每新增一种语言都要复制页面逻辑。

这次物理公式页中英文界面不一致，根因就是第三类：`CscaSubjectPage.tsx` 里公式页和学科页存在 `English...Page` / `...PageZh` 双轨组件。它能快速上线英文，但不是可扩展方案。

## 审计范围

本次扫描覆盖：

- `frontend/src/pages`
- `frontend/src/components`
- `frontend/src/i18n`
- `frontend/e2e/i18n-smoke.spec.ts`
- 既有文档 `docs/full-i18n-implementation-plan.md`

关键扫描结果：

| 指标 | 数量 | 说明 |
| --- | ---: | --- |
| `locale === 'en'` | 837 | 直接英文分支数量，集中度很高。 |
| `locale !== 'en'` | 13 | 反向分支，主要用于 fallback 或展示第二语言名。 |
| `EnglishCsca*` | 4 | 明确的英文专用组件命名。 |
| `PageZh` | 4 | 明确的中文专用组件命名。 |
| `ENGLISH_*` | 12 | 英文专用结构化数据，集中在学科页。 |
| `EN_*` | 70 | 英文专用映射，集中在专项练习。 |

按文件看，债务最集中的是：

| 文件 | `locale === 'en'` 数量 | 风险 |
| --- | ---: | --- |
| `frontend/src/pages/CscaSpecialPracticePage.tsx` | 799 | 极高，单文件内混合大量交互、可视化、题目、标签和英文映射。 |
| `frontend/src/pages/StudyChinaPages.tsx` | 7 | 中，主要是数据字段选择和 fallback。 |
| `frontend/src/pages/CscaPrepPage.tsx` | 4 | 中，主要是日期、学校字段和 fallback。 |
| `frontend/src/pages/SchoolDetailPage.tsx` | 4 | 中，主要是学校/项目双语字段展示。 |
| `frontend/src/pages/CscaSubjectPage.tsx` | 2 | 高，数量少但存在整页双轨组件。 |

中文硬编码仍大量存在，但不能简单等同为前台债务。后台管理页目前以中文为主，是否国际化应由产品范围决定。前台核心路径里出现中文硬编码才是发布风险。

## 技术债分类

### P0：整页双轨

表现：

```tsx
if (locale === 'en') return <EnglishCscaSubjectPage {...props} />;
return <CscaSubjectPageZh {...props} />;
```

已发现位置：

- `CscaSubjectPage.tsx`
  - `EnglishCscaSubjectFormulaPage`
  - `CscaSubjectFormulaPageZh`
  - `EnglishCscaSubjectPage`
  - `CscaSubjectPageZh`

风险：

- 中文和英文页面结构会自然漂移。
- 样式修复、交互修复、加载态修复需要改两遍。
- 增加第三语言时无法承受，会变成 `ThaiPage`、`VietnamesePage` 等复制链。

治理原则：

- 禁止新增语言专用页面组件。
- 现有双轨页面必须合并为一套组件。
- 语言差异只能存在于 message、结构化内容或格式化函数中。

### P1：组件内高密度 locale 三元表达式

表现：

```tsx
{locale === 'en' ? 'Start Practice' : '开始练习'}
```

主要位置：

- `CscaSpecialPracticePage.tsx`

风险：

- 每个小文案都藏在 JSX 中，无法统一抽取、审校、复用。
- 新语言无法通过数据文件扩展，只能继续堆分支。
- 视觉与交互代码被翻译细节淹没，后续改 UI 容易误伤文案。

治理原则：

- UI 文案进 `messages`。
- 可视化工具、题目、标签、模块说明等结构化内容进入 locale-aware 内容文件。
- JSX 中允许的 locale 判断只保留格式化类逻辑，例如日期、数字、单位顺序、双语字段展示。

### P1：结构化内容散落在页面组件

表现：

- `ENGLISH_FORMULA_COPY`
- `ENGLISH_PHYSICS_FORMULA_SECTIONS`
- `ENGLISH_SUBJECT_COPY`
- `EN_SIMULATION_COPY`
- `EN_SET_OPERATION_COPY`
- `ATOMIC_TREND_EN_META`
- `FUNCTIONAL_ORGANIC_EN_COPY`

风险：

- 内容不是组件逻辑，却和组件耦合在一个超大文件里。
- 中文和英文结构不一定一致，物理公式页的问题就是例子。
- 结构完整性无法自动检查，例如中文 5 个章节、英文 3 个章节不会被类型系统发现。

治理原则：

- 结构化内容独立到 `frontend/src/content/localized/...`。
- 每类内容有稳定 schema 和 `id`，不同语言只替换字段值，不替换结构。
- 同一内容类型必须做 locale parity 测试。

### P2：页面内 `COPY.zh` / `COPY.en`

表现：

```tsx
const copy = locale === 'en' ? CART_COPY.en : CART_COPY.zh;
```

主要位置：

- `CartPage.tsx`
- `CheckoutPage.tsx`
- `OrdersPage.tsx`
- `SearchPage.tsx`
- `ConsultingPage.tsx`
- `CscaPracticePage.tsx`
- `CscaExamTimePage.tsx`
- `ComparePage.tsx`
- `PublicAuthPage.tsx`
- `CscaSubjectVocabularyPage.tsx`

风险：

- 目前可控，因为 JSX 多数仍是一套。
- 但继续扩展语言会让每个页面都变成局部翻译孤岛。

治理原则：

- 短期可保留，但新增语言前必须迁移到 `messages` 或局部 content module。
- 禁止在这些页面继续新增语言分支。

### P2：数据库或接口内容 fallback 不透明

表现：

- 英文页面遇到中文内容时用 fallback 文案替换。
- 学校、城市、奖学金、项目字段有 `nameZh` / `nameEn` 双字段选择。

风险：

- 用户看到的是可用英文，但团队不知道真实内容缺口。
- fallback 可以让 smoke 测试通过，却掩盖内容翻译未完成。

治理原则：

- fallback 行为保留给生产安全，但必须产出缺失清单。
- CMS 内容需要翻译状态：`missing`、`draft`、`ready`、`published`。
- 关键页面发布前不允许关键字段 fallback。

## 成熟目标架构

目标不是“把中文替换成英文”，而是建立可增加第三、第四种语言的内容系统。

```text
Route
  -> Shared Page Component
      -> UI messages: t('namespace.key')
      -> Localized structured content: getLocalizedContent(type, id, locale)
      -> Locale formatters: date, number, currency, unit, plural
      -> Same JSX, same CSS, same interaction
```

### 组件层规则

允许：

- `t('common.save')`
- `formatDate(value, locale)`
- `getLocalizedName(record, locale)`
- `content.title`

不允许：

- `EnglishXxxPage`
- `XxxPageZh`
- 大段 JSX 里密集 `locale === 'en' ? ... : ...`
- 每个语言复制一份相同布局组件

### 内容层规则

普通 UI 文案放：

```text
frontend/src/i18n/messages/zh-CN.ts
frontend/src/i18n/messages/en.ts
```

结构化内容放：

```text
frontend/src/content/localized/csca-subjects.ts
frontend/src/content/localized/csca-formulas.ts
frontend/src/content/localized/special-practice.ts
frontend/src/content/localized/visualizers.ts
```

推荐结构：

```ts
type LocalizedRecord<T> = Record<Locale, T>;

type FormulaSection = {
  id: string;
  title: string;
  note: string;
  items: Array<{
    id: string;
    name: string;
    formula: string;
    unit?: string;
    tip: string;
  }>;
};
```

每个语言必须共享相同 `id`：

```ts
physicsFormulaSections = {
  'zh-CN': [
    { id: 'mechanics', items: [{ id: 'velocity', ... }] }
  ],
  en: [
    { id: 'mechanics', items: [{ id: 'velocity', ... }] }
  ]
}
```

### Fallback 策略

成熟 fallback 应分层：

| 场景 | 生产行为 | 测试/后台行为 |
| --- | --- | --- |
| UI key 缺失 | 显示 fallback 或 key | CI 失败 |
| 结构化内容缺语言 | 回退默认语言或隐藏非关键块 | 生成缺失报告，关键内容 CI 失败 |
| 学校/项目长文本缺翻译 | 显示安全英文 fallback | CMS 标记缺失 |
| 用户生成或来源摘录 | 不自动翻译 | 明确显示来源语言或人工翻译状态 |

### 测试门禁

现有 `i18n-smoke` 已经覆盖：

- 英文路由不出现 raw key。
- 英文路由不出现中文文本。
- 页面没有横向溢出。
- 中英文导航下拉可打开。

需要新增：

- 双轨组件禁用扫描：CI 检查 `English.*Page`、`PageZh`、`locale === 'en' ? <`。
- 结构化内容 parity 测试：同一内容类型的章节、条目、题目、可视化工具 `id` 必须一致。
- 新增语言 readiness 测试：只有 coverage 达到阈值的 locale 才能 `enabled: true`。
- fallback 报告测试：英文页面可以安全 fallback，但要输出缺失项列表。

## 分阶段执行方案

### Phase 0：冻结规则与债务看板

目标：防止债务继续变大。

任务：

- 在文档中确认：不再新增语言专用页面组件。
- 增加静态扫描脚本，统计：
  - `English[A-Z].*Page`
  - `PageZh`
  - `locale === 'en'`
  - `ENGLISH_`
  - `EN_`
- 将当前统计作为 baseline，后续 PR 不能让 P0/P1 指标增加。

验收：

- 有 `npm --prefix frontend run test:i18n-debt` 或同等脚本。
- CI 输出债务统计。
- 新增双轨页面会失败。

### Phase 1：合并 CSCA 学科页双轨

目标：修掉最典型、最容易造成界面漂移的双轨页面。

范围：

- `CscaSubjectPage`
- `CscaSubjectFormulaPage`
- 学科首页 copy
- 公式页结构化内容

任务：

- 抽出 `frontend/src/content/localized/csca-subjects.ts`。
- 抽出 `frontend/src/content/localized/csca-formulas.ts`。
- 合并 `EnglishCscaSubjectPage` 和 `CscaSubjectPageZh`。
- 合并 `EnglishCscaSubjectFormulaPage` 和 `CscaSubjectFormulaPageZh`。
- 给公式内容增加 `id`，做 zh/en parity 测试。

验收：

- `CscaSubjectPage.tsx` 不再出现 `EnglishCscaSubjectPage`、`CscaSubjectPageZh`、`EnglishCscaSubjectFormulaPage`、`CscaSubjectFormulaPageZh`。
- 中英文物理、数学、化学公式页章节数量一致。
- 构建通过，`i18n-smoke` 通过。

### Phase 2：拆分专项练习国际化内容

目标：处理最大债务源 `CscaSpecialPracticePage.tsx`。

范围：

- 专项练习首页
- 学科专项列表
- Topic start/session/report
- 数学可视化工具
- 化学可视化工具

任务：

- 把视觉模拟器元数据抽到 `visualizers.ts`。
- 把 topic、module、tag、badge、status 文案抽到 `special-practice.ts`。
- 把纯 UI 文案迁移到 `messages.specialPractice`。
- 对同一工具的 `slug`、控件、标签建立 locale parity 测试。
- 大文件按功能拆组件，避免继续在一个文件里维护 7000 行以上逻辑。

验收：

- `CscaSpecialPracticePage.tsx` 的 `locale === 'en'` 数量降低 70% 以上。
- 所有可视化工具仍通过英文 smoke。
- 控件 aria-label 无中文残留。

### Phase 3：收敛页面级 COPY

目标：把可控的 `COPY.zh/en` 页面迁到统一消息或内容模块。

优先顺序：

1. `CartPage.tsx`、`CheckoutPage.tsx`、`OrdersPage.tsx`
2. `SearchPage.tsx`、`PublicAuthPage.tsx`
3. `CscaPracticePage.tsx`、`CscaExamTimePage.tsx`
4. `ConsultingPage.tsx`、`ComparePage.tsx`

任务：

- UI 文案迁入 `messages`。
- 页面业务枚举用 `getLocalizedLabel(type, locale)`。
- 删除页面内 `COPY.zh/en` 常量。

验收：

- 页面 JSX 只调用 `t()`、formatter 或 localized helper。
- 不新增中文硬编码。

### Phase 4：CMS 与数据库内容透明化

目标：让内容缺口可管理，而不是靠 fallback 蒙过去。

任务：

- 为 CMS 内容建立 locale 维度和翻译状态。
- 学校、城市、奖学金、项目内容输出 locale coverage 报告。
- Admin 端显示缺翻译字段，关键内容发布前阻止发布。
- API 响应可附带 `translationMeta`，例如 missing fields。

验收：

- 英文页面 fallback 有后台清单。
- 关键页面的关键字段未翻译时不能标记 ready。
- 内容发布和前台 smoke 使用同一套 locale 配置。

### Phase 5：多语言扩展准备

目标：新增第三语言时不再改页面组件。

任务：

- 将 `SUPPORTED_LOCALES` 的 enabled 状态绑定 coverage。
- 为 `th`、`vi` 等 future locale 建立内容包模板。
- 建立翻译导入/导出流程。
- 对 RTL 语言预留样式策略，虽然当前列表暂无 RTL。

验收：

- 新增一个 locale 的主要工作是添加 message/content 文件。
- 不需要新增语言专用 React 页面。
- 未达 coverage 的 locale 不能在选择器中启用。

## 优先级建议

先做：

1. Phase 0：冻结规则和债务扫描。
2. Phase 1：合并 CSCA 学科页双轨。
3. Phase 2 的第一刀：把专项练习的元数据和 UI 文案分离。

暂缓：

- 全量后台国际化。后台硬编码中文很多，但如果后台用户就是中文运营，优先级低于前台。
- SEO locale route。当前更大的风险是内容架构漂移，不是 URL 结构。
- 第三语言上线。现在直接加第三语言会放大技术债。

## 成熟度评估

| 维度 | 当前成熟度 | 目标成熟度 | 说明 |
| --- | --- | --- | --- |
| Locale 基础设施 | 中高 | 高 | Provider、selector、messages 已有，但缺类型化 key 和 coverage 报告。 |
| 公共导航/壳层 | 高 | 高 | 当前已接近成熟形态。 |
| 页面组件复用 | 中 | 高 | 多数页面还可控，但学科页存在双轨。 |
| 结构化内容国际化 | 中低 | 高 | 公式、专项、可视化内容仍散在组件。 |
| 测试门禁 | 中 | 高 | smoke 很有价值，但缺 parity 和债务增长检查。 |
| 多语言扩展能力 | 低 | 高 | 现在支持 zh/en，新增更多语言成本仍高。 |

## 下一步执行建议

建议马上执行 Phase 0 和 Phase 1。

Phase 0 小、收益高，可以先把规则立起来，避免继续产生新的双轨页面。Phase 1 则把这次暴露问题的 CSCA 学科页完整收敛，形成一个样板：一套组件、locale 内容、结构 parity 测试。样板稳定后，再处理更大的 `CscaSpecialPracticePage.tsx`。

