import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { MathContent } from '../MathContent';
import { useI18n } from '../../i18n/useI18n';

type ToolId = 'calculator' | 'scratchpad' | 'converter' | 'reference' | 'graph';
type ToolPermission = { enabled: boolean; reason?: string };
type LearningToolPolicy = Record<ToolId, ToolPermission>;
type CalculatorHistoryItem = { expression: string; result: string };
type CalculatorState = { expression: string; result: string; angleMode: 'deg' | 'rad'; history: CalculatorHistoryItem[] };
type ConverterState = { category: string; value: string; from: string; to: string };
type GraphState = { expression: string; range: number };
type Unit = { id: string; label: string; factor?: number; toBase?: (value: number) => number; fromBase?: (value: number) => number };
type UnitGroup = { id: string; label: string; units: Unit[] };
type FormulaItem = { title: string; formula: string; note: string; keywords: string };

const DEFAULT_CALCULATOR: CalculatorState = { expression: '', result: '', angleMode: 'deg', history: [] };
const DEFAULT_CONVERTER: ConverterState = { category: 'length', value: '1000', from: 'm', to: 'km' };
const DEFAULT_GRAPH: GraphState = { expression: 'x^2', range: 5 };
const UNIT_GROUPS: UnitGroup[] = [
  { id: 'length', label: '长度', units: [{ id: 'mm', label: '毫米 mm', factor: .001 }, { id: 'cm', label: '厘米 cm', factor: .01 }, { id: 'm', label: '米 m', factor: 1 }, { id: 'km', label: '千米 km', factor: 1000 }] },
  { id: 'mass', label: '质量', units: [{ id: 'mg', label: '毫克 mg', factor: .000001 }, { id: 'g', label: '克 g', factor: .001 }, { id: 'kg', label: '千克 kg', factor: 1 }, { id: 't', label: '吨 t', factor: 1000 }] },
  { id: 'time', label: '时间', units: [{ id: 'ms', label: '毫秒 ms', factor: .001 }, { id: 's', label: '秒 s', factor: 1 }, { id: 'min', label: '分钟 min', factor: 60 }, { id: 'h', label: '小时 h', factor: 3600 }] },
  { id: 'speed', label: '速度', units: [{ id: 'm/s', label: '米/秒 m/s', factor: 1 }, { id: 'km/h', label: '千米/时 km/h', factor: 1 / 3.6 }, { id: 'cm/s', label: '厘米/秒 cm/s', factor: .01 }] },
  { id: 'energy', label: '能量', units: [{ id: 'J', label: '焦耳 J', factor: 1 }, { id: 'kJ', label: '千焦 kJ', factor: 1000 }, { id: 'cal', label: '卡 cal', factor: 4.184 }, { id: 'kWh', label: '千瓦时 kWh', factor: 3_600_000 }] },
  { id: 'pressure', label: '压强', units: [{ id: 'Pa', label: '帕 Pa', factor: 1 }, { id: 'kPa', label: '千帕 kPa', factor: 1000 }, { id: 'MPa', label: '兆帕 MPa', factor: 1_000_000 }, { id: 'atm', label: '标准大气压 atm', factor: 101325 }] },
  { id: 'temperature', label: '温度', units: [
    { id: 'C', label: '摄氏度 °C', toBase: (value) => value + 273.15, fromBase: (value) => value - 273.15 },
    { id: 'K', label: '开尔文 K', toBase: (value) => value, fromBase: (value) => value },
    { id: 'F', label: '华氏度 °F', toBase: (value) => (value - 32) * 5 / 9 + 273.15, fromBase: (value) => (value - 273.15) * 9 / 5 + 32 }
  ] }
];

const FORMULAS: Record<string, FormulaItem[]> = {
  math: [
    { title: '一元二次方程', formula: '$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$', note: '适用于 ax²+bx+c=0，先判断判别式。', keywords: '二次 方程 根 判别式' },
    { title: '两点距离', formula: '$d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}$', note: '平面直角坐标系中两点间距离。', keywords: '坐标 距离' },
    { title: '直线斜率', formula: '$k=\\frac{y_2-y_1}{x_2-x_1}$', note: 'x₂≠x₁；竖直直线的斜率不存在。', keywords: '直线 斜率' },
    { title: '圆', formula: '$C=2\\pi r,\\quad S=\\pi r^2$', note: '周长与面积，r 为半径。', keywords: '圆 周长 面积' },
    { title: '等差数列', formula: '$a_n=a_1+(n-1)d$', note: 'd 为公差。', keywords: '数列 等差' },
    { title: '三角恒等式', formula: '$\\sin^2\\theta+\\cos^2\\theta=1$', note: '常用于同角三角函数化简。', keywords: '三角函数 正弦 余弦' }
  ],
  physics: [
    { title: '牛顿第二定律', formula: '$F=ma$', note: 'F 是合力，方向与加速度方向一致。', keywords: '力 牛顿 加速度' },
    { title: '匀变速直线运动', formula: '$v=v_0+at,\\quad s=v_0t+\\frac12at^2$', note: '先选定正方向，再给各物理量带符号。', keywords: '运动 速度 位移 加速度' },
    { title: '动能与重力势能', formula: '$E_k=\\frac12mv^2,\\quad E_p=mgh$', note: '机械能问题需先判断是否存在耗散。', keywords: '能量 动能 势能' },
    { title: '动量', formula: '$p=mv,\\quad I=Ft=\\Delta p$', note: '动量和冲量都是矢量。', keywords: '动量 冲量' },
    { title: '欧姆定律与电功率', formula: '$U=IR,\\quad P=UI$', note: '纯电阻电路还可用 P=I²R=U²/R。', keywords: '电路 电压 电流 电阻 功率' },
    { title: '波速', formula: '$v=\\lambda f$', note: 'λ 为波长，f 为频率。', keywords: '波 波长 频率' }
  ],
  chemistry: [
    { title: '物质的量', formula: '$n=\\frac{m}{M}$', note: 'm 与摩尔质量 M 的单位要对应。', keywords: '物质的量 摩尔 质量' },
    { title: '物质的量浓度', formula: '$c=\\frac{n}{V}$', note: 'V 通常取溶液体积，单位为 L。', keywords: '浓度 溶液 体积' },
    { title: '理想气体状态方程', formula: '$pV=nRT$', note: '各物理量必须采用与 R 匹配的单位。', keywords: '气体 压强 体积 温度' },
    { title: '质量分数', formula: '$w=\\frac{m_{\\text{solute}}}{m_{\\text{solution}}}\\times100\\%$', note: '分母是溶液总质量。', keywords: '质量分数 溶质 溶液' },
    { title: '酸碱度', formula: '$\\mathrm{pH}=-\\log[H^+]$', note: '常温稀溶液中使用，浓度单位为 mol/L。', keywords: '酸碱 pH 浓度' }
  ]
};
const CONSTANTS: Record<string, { symbol: string; value: string; name: string }[]> = {
  math: [{ symbol: '$\\pi$', value: '3.14159265…', name: '圆周率' }, { symbol: '$e$', value: '2.71828182…', name: '自然常数' }],
  physics: [{ symbol: '$g$', value: '9.8 m/s²（题设优先）', name: '重力加速度' }, { symbol: '$c$', value: '2.998×10⁸ m/s', name: '真空光速' }, { symbol: '$e$', value: '1.602×10⁻¹⁹ C', name: '元电荷' }],
  chemistry: [{ symbol: '$N_A$', value: '6.022×10²³ mol⁻¹', name: '阿伏伽德罗常数' }, { symbol: '$R$', value: '8.314 J/(mol·K)', name: '气体常数' }, { symbol: '$V_m$', value: '22.4 L/mol（标准状况）', name: '气体摩尔体积' }]
};

class ExpressionParser {
  private index = 0;
  constructor(private readonly source: string, private readonly angleMode: 'deg' | 'rad', private readonly variables: Record<string, number> = {}) {}
  parse() { const value = this.parseExpression(); this.skipSpaces(); if (this.index !== this.source.length || !Number.isFinite(value)) throw new Error('invalid expression'); return value; }
  private parseExpression(): number { let value = this.parseTerm(); while (true) { if (this.consume('+')) value += this.parseTerm(); else if (this.consume('-')) value -= this.parseTerm(); else return value; } }
  private parseTerm(): number { let value = this.parsePower(); while (true) { if (this.consume('*')) value *= this.parsePower(); else if (this.consume('/')) value /= this.parsePower(); else return value; } }
  private parsePower(): number { const value = this.parseUnary(); return this.consume('^') ? value ** this.parsePower() : value; }
  private parseUnary(): number { if (this.consume('+')) return this.parseUnary(); if (this.consume('-')) return -this.parseUnary(); let value = this.parsePrimary(); while (this.consume('%')) value /= 100; return value; }
  private parsePrimary(): number {
    this.skipSpaces();
    if (this.consume('(')) { const value = this.parseExpression(); if (!this.consume(')')) throw new Error('missing parenthesis'); return value; }
    const number = this.readNumber(); if (number !== null) return number;
    const name = this.readName(); if (!name) throw new Error('expected value');
    if (name === 'pi') return Math.PI; if (name === 'e') return Math.E;
    if (Object.prototype.hasOwnProperty.call(this.variables, name)) return this.variables[name];
    if (!this.consume('(')) throw new Error('expected function argument');
    const value = this.parseExpression(); if (!this.consume(')')) throw new Error('missing function parenthesis');
    const angle = this.angleMode === 'deg' ? value * Math.PI / 180 : value;
    if (name === 'sin') return Math.sin(angle); if (name === 'cos') return Math.cos(angle); if (name === 'tan') return Math.tan(angle);
    if (name === 'sqrt') return Math.sqrt(value); if (name === 'log') return Math.log10(value); if (name === 'ln') return Math.log(value); if (name === 'abs') return Math.abs(value);
    throw new Error('unknown function');
  }
  private readNumber() { this.skipSpaces(); const match = this.source.slice(this.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i); if (!match) return null; this.index += match[0].length; return Number(match[0]); }
  private readName() { this.skipSpaces(); const match = this.source.slice(this.index).match(/^[a-z]+/i); if (!match) return ''; this.index += match[0].length; return match[0].toLowerCase(); }
  private consume(token: string) { this.skipSpaces(); if (!this.source.startsWith(token, this.index)) return false; this.index += token.length; return true; }
  private skipSpaces() { while (/\s/.test(this.source[this.index] ?? '')) this.index += 1; }
}

function normalizeExpression(expression: string) { return expression.trim().replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi'); }
function evaluate(expression: string, angleMode: 'deg' | 'rad', variables: Record<string, number> = {}) { const normalized = normalizeExpression(expression); if (!normalized || normalized.length > 240) throw new Error('invalid expression'); return new ExpressionParser(normalized, angleMode, variables).parse(); }
function formatNumber(value: number) { if (!Number.isFinite(value)) return '—'; if (Math.abs(value) < 1e-14) return '0'; return Number(value.toPrecision(12)).toString(); }
function calculate(expression: string, angleMode: 'deg' | 'rad') { return formatNumber(evaluate(expression, angleMode)); }
function loadStored<T>(key: string, fallback: T): T { try { const value = window.localStorage.getItem(key); return value ? { ...fallback, ...JSON.parse(value) } : fallback; } catch { return fallback; } }
function convertValue(state: ConverterState) { const group = UNIT_GROUPS.find((item) => item.id === state.category); const from = group?.units.find((item) => item.id === state.from); const to = group?.units.find((item) => item.id === state.to); const value = Number(state.value); if (!from || !to || !Number.isFinite(value)) return '—'; const base = from.toBase ? from.toBase(value) : value * (from.factor ?? 1); return formatNumber(to.fromBase ? to.fromBase(base) : base / (to.factor ?? 1)); }
function buildGraphPath(expression: string, range: number) {
  const width = 640; const height = 360; const points: string[] = []; let drawing = false;
  for (let index = 0; index <= 320; index += 1) {
    const x = -range + index / 320 * range * 2;
    try { const y = evaluate(expression, 'rad', { x }); if (!Number.isFinite(y) || Math.abs(y) > range * 4) { drawing = false; continue; } const px = index / 320 * width; const py = height / 2 - y / range * height / 2; if (py < -height || py > height * 2) { drawing = false; continue; } points.push(`${drawing ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`); drawing = true; } catch { drawing = false; }
  }
  return points.join(' ');
}

export function AgentLearningTools({ storageScope, policy, subject = 'math' }: { storageScope: string; policy: LearningToolPolicy; subject?: string }) {
  const { t } = useI18n();
  const normalizedSubject = subject === 'physics' || subject === 'chemistry' ? subject : 'math';
  const calculatorKey = `moodlelike.agent.tools.calculator.${storageScope}`; const scratchpadKey = `moodlelike.agent.tools.scratchpad.${storageScope}`; const converterKey = `moodlelike.agent.tools.converter.${storageScope}`; const graphKey = `moodlelike.agent.tools.graph.${storageScope}`;
  const tools = useMemo(() => [
    { id: 'calculator' as const, label: '科学计算器', icon: 'lucide:calculator' }, { id: 'scratchpad' as const, label: '草稿纸', icon: 'lucide:notebook-pen' },
    { id: 'converter' as const, label: '单位换算', icon: 'lucide:arrow-left-right' }, { id: 'reference' as const, label: '公式与常量', icon: 'lucide:book-open-check' },
    ...(normalizedSubject === 'chemistry' ? [] : [{ id: 'graph' as const, label: '函数绘图', icon: 'lucide:function-square' }])
  ], [normalizedSubject]);
  const [activeTool, setActiveTool] = useState<ToolId>('calculator');
  const [calculator, setCalculator] = useState<CalculatorState>(() => loadStored(calculatorKey, DEFAULT_CALCULATOR));
  const [scratchpad, setScratchpad] = useState(() => window.localStorage.getItem(scratchpadKey) ?? '');
  const [converter, setConverter] = useState<ConverterState>(() => loadStored(converterKey, DEFAULT_CONVERTER));
  const [graph, setGraph] = useState<GraphState>(() => loadStored(graphKey, DEFAULT_GRAPH));
  const [calculatorError, setCalculatorError] = useState(''); const [referenceQuery, setReferenceQuery] = useState('');
  useEffect(() => { setCalculator(loadStored(calculatorKey, DEFAULT_CALCULATOR)); setScratchpad(window.localStorage.getItem(scratchpadKey) ?? ''); setConverter(loadStored(converterKey, DEFAULT_CONVERTER)); setGraph(loadStored(graphKey, DEFAULT_GRAPH)); setCalculatorError(''); }, [calculatorKey, scratchpadKey, converterKey, graphKey]);
  useEffect(() => { if (!tools.some((tool) => tool.id === activeTool) || !policy[activeTool].enabled) { const available = tools.find((tool) => policy[tool.id].enabled); if (available) setActiveTool(available.id); } }, [activeTool, policy, tools]);
  useEffect(() => { window.localStorage.setItem(calculatorKey, JSON.stringify(calculator)); }, [calculator, calculatorKey]);
  useEffect(() => { window.localStorage.setItem(converterKey, JSON.stringify(converter)); }, [converter, converterKey]);
  useEffect(() => { window.localStorage.setItem(graphKey, JSON.stringify(graph)); }, [graph, graphKey]);
  const keys = useMemo(() => [['AC', 'clear'], ['(', '('], [')', ')'], ['⌫', 'backspace'], ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['÷', '÷'], ['√', 'sqrt('], ['7', '7'], ['8', '8'], ['9', '9'], ['log', 'log('], ['4', '4'], ['5', '5'], ['6', '6'], ['ln', 'ln('], ['1', '1'], ['2', '2'], ['3', '3'], ['π', 'π'], ['0', '0'], ['.', '.'], ['×', '×'], ['%', '%'], ['−', '−'], ['+', '+'], ['=', 'equals']] as const, []);
  const activePolicy = policy[activeTool]; const unitGroup = UNIT_GROUPS.find((item) => item.id === converter.category) ?? UNIT_GROUPS[0]; const converterResult = convertValue(converter); const graphPath = useMemo(() => buildGraphPath(graph.expression, graph.range), [graph]);
  const formulas = FORMULAS[normalizedSubject].filter((item) => `${item.title} ${item.note} ${item.keywords}`.toLowerCase().includes(referenceQuery.trim().toLowerCase()));
  function updateCalculator(updater: (current: CalculatorState) => CalculatorState) { setCalculator((current) => updater(current)); setCalculatorError(''); }
  function pressCalculatorKey(action: string) { if (action === 'clear') return updateCalculator((current) => ({ ...current, expression: '', result: '' })); if (action === 'backspace') return updateCalculator((current) => ({ ...current, expression: current.expression.slice(0, -1), result: '' })); if (action === 'equals') { try { const result = calculate(calculator.expression, calculator.angleMode); setCalculator((current) => ({ ...current, result, history: [{ expression: current.expression, result }, ...current.history.filter((item) => item.expression !== current.expression)].slice(0, 6) })); setCalculatorError(''); } catch { setCalculatorError(t('agent.tools.calculatorError', '表达式无法计算，请检查括号和运算符。')); } return; } updateCalculator((current) => ({ ...current, expression: `${current.expression}${action}`, result: '' })); }
  function changeScratchpad(value: string) { setScratchpad(value); window.localStorage.setItem(scratchpadKey, value); }
  function changeUnitCategory(category: string) { const next = UNIT_GROUPS.find((item) => item.id === category) ?? UNIT_GROUPS[0]; setConverter((current) => ({ ...current, category, from: next.units[0].id, to: next.units[Math.min(1, next.units.length - 1)].id })); }

  return <section className="agent-learning-tools" aria-label={t('agent.tools.aria', '学习工具')}>
    <header className="agent-learning-tools-intro"><span><Icon name="lucide:wrench" /></span><div><strong>{t('agent.tools.title', '学习工具')}</strong><small>{t('agent.tools.body', '工具仅辅助当前任务，不会生成问答消息或替你提交答案。')}</small></div></header>
    <nav className="agent-learning-tool-tabs" aria-label={t('agent.tools.choose', '选择学习工具')}>{tools.map((tool) => <button key={tool.id} type="button" className={activeTool === tool.id ? 'active' : ''} onClick={() => setActiveTool(tool.id)}><Icon name={tool.icon} />{tool.label}</button>)}</nav>
    {!activePolicy.enabled ? <div className="agent-learning-tool-locked" role="status"><Icon name="lucide:shield-alert" /><strong>{t('agent.tools.restricted', '当前模式不可使用此工具')}</strong><p>{activePolicy.reason}</p></div>
    : activeTool === 'calculator' ? <div className="agent-calculator" aria-label={t('agent.tools.calculator', '科学计算器')}>
      <div className="agent-calculator-display"><div className="agent-calculator-mode"><button type="button" className={calculator.angleMode === 'deg' ? 'active' : ''} onClick={() => updateCalculator((current) => ({ ...current, angleMode: 'deg' }))}>DEG</button><button type="button" className={calculator.angleMode === 'rad' ? 'active' : ''} onClick={() => updateCalculator((current) => ({ ...current, angleMode: 'rad' }))}>RAD</button></div><input aria-label={t('agent.tools.expression', '计算表达式')} value={calculator.expression} maxLength={240} placeholder="例如：2×(3+4)" onChange={(event) => updateCalculator((current) => ({ ...current, expression: event.target.value, result: '' }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); pressCalculatorKey('equals'); } }} /><output aria-live="polite">{calculator.result || '—'}</output>{calculatorError && <small role="alert">{calculatorError}</small>}</div>
      <div className="agent-calculator-keypad">{keys.map(([label, action]) => <button key={`${label}-${action}`} type="button" data-action={action} onClick={() => pressCalculatorKey(action)}>{label}</button>)}</div>
      {calculator.history.length > 0 && <section className="agent-calculator-history"><header><strong>{t('agent.tools.recentCalculations', '最近计算')}</strong><button type="button" onClick={() => updateCalculator((current) => ({ ...current, history: [] }))}>{t('agent.tools.clearHistory', '清空')}</button></header>{calculator.history.map((item) => <button key={`${item.expression}=${item.result}`} type="button" onClick={() => updateCalculator((current) => ({ ...current, expression: item.expression, result: item.result }))}><span>{item.expression}</span><b>= {item.result}</b></button>)}</section>}
    </div>
    : activeTool === 'scratchpad' ? <div className="agent-scratchpad" aria-label={t('agent.tools.scratchpad', '草稿纸')}><header><div><strong>{t('agent.tools.scratchpadTitle', '当前题草稿')}</strong><small>{t('agent.tools.scratchpadSaved', '自动保存在本设备，切换页面后仍可继续。')}</small></div><button type="button" disabled={!scratchpad} onClick={() => changeScratchpad('')}><Icon name="lucide:eraser" />{t('agent.tools.clear', '清空')}</button></header><textarea value={scratchpad} maxLength={12000} placeholder={t('agent.tools.scratchpadPlaceholder', '记录计算步骤、公式或解题思路……')} onChange={(event) => changeScratchpad(event.target.value)} /><footer><span>{scratchpad.length}/12000</span><span><Icon name="lucide:hard-drive" />{t('agent.tools.localOnly', '仅保存在本设备')}</span></footer></div>
    : activeTool === 'converter' ? <div className="agent-unit-converter"><header><strong>单位换算</strong><small>结果会随输入即时更新，不改变答题内容。</small></header><label>换算类型<select aria-label="换算类型" value={converter.category} onChange={(event) => changeUnitCategory(event.target.value)}>{UNIT_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label><div className="agent-unit-converter-row"><label>数值<input aria-label="待换算数值" inputMode="decimal" value={converter.value} onChange={(event) => setConverter((current) => ({ ...current, value: event.target.value }))} /></label><label>从<select aria-label="原单位" value={converter.from} onChange={(event) => setConverter((current) => ({ ...current, from: event.target.value }))}>{unitGroup.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><button type="button" aria-label="交换单位" onClick={() => setConverter((current) => ({ ...current, from: current.to, to: current.from }))}><Icon name="lucide:arrow-left-right" /></button><label>到<select aria-label="目标单位" value={converter.to} onChange={(event) => setConverter((current) => ({ ...current, to: event.target.value }))}>{unitGroup.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label></div><output aria-live="polite"><small>换算结果</small><strong>{converterResult}</strong><span>{unitGroup.units.find((unit) => unit.id === converter.to)?.label}</span></output></div>
    : activeTool === 'reference' ? <div className="agent-formula-reference"><header><div><strong>{normalizedSubject === 'physics' ? '物理' : normalizedSubject === 'chemistry' ? '化学' : '数学'}公式与常量</strong><small>快速查找，不代替对题目条件的判断。</small></div><label><Icon name="lucide:search" /><input aria-label="搜索公式" value={referenceQuery} placeholder="搜索名称或用途" onChange={(event) => setReferenceQuery(event.target.value)} /></label></header><section className="agent-constant-strip">{CONSTANTS[normalizedSubject].map((item) => <article key={item.name}><MathContent text={item.symbol} /><strong>{item.value}</strong><small>{item.name}</small></article>)}</section><div className="agent-formula-grid">{formulas.map((item) => <article key={item.title}><strong>{item.title}</strong><MathContent text={item.formula} className="agent-formula-expression" /><p>{item.note}</p></article>)}{formulas.length === 0 && <p className="agent-tool-empty">没有匹配的公式，试试更短的关键词。</p>}</div></div>
    : <div className="agent-function-plotter"><header><div><strong>函数绘图</strong><small>输入关于 x 的函数，观察图像趋势与零点。</small></div><label>视窗<select aria-label="绘图范围" value={graph.range} onChange={(event) => setGraph((current) => ({ ...current, range: Number(event.target.value) }))}><option value={5}>±5</option><option value={10}>±10</option><option value={20}>±20</option></select></label></header><label className="agent-function-input"><span>y =</span><input aria-label="函数表达式" value={graph.expression} maxLength={120} placeholder="例如：sin(x) 或 x^2-4" onChange={(event) => setGraph((current) => ({ ...current, expression: event.target.value }))} /></label><div className="agent-graph-canvas">{graphPath ? <svg viewBox="0 0 640 360" role="img" aria-label={`函数 ${graph.expression} 的图像`} preserveAspectRatio="none"><g className="grid">{[64,128,192,256,320,384,448,512,576].map((x) => <line key={`x-${x}`} x1={x} y1="0" x2={x} y2="360" />)}{[36,72,108,144,180,216,252,288,324].map((y) => <line key={`y-${y}`} x1="0" y1={y} x2="640" y2={y} />)}</g><g className="axes"><line x1="0" y1="180" x2="640" y2="180" /><line x1="320" y1="0" x2="320" y2="360" /></g><path d={graphPath} /></svg> : <div role="alert"><Icon name="lucide:circle-alert" /><strong>暂时无法绘制</strong><span>请检查表达式，只使用 x、数字、括号和支持的函数。</span></div>}</div><footer><span>支持：+ − × ÷ ^</span><span>sin(x) · cos(x) · sqrt(x) · log(x) · ln(x) · abs(x)</span></footer></div>}
  </section>;
}
