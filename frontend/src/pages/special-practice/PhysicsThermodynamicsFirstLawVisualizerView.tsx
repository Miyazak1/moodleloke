import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

function subjectPath(subject: string) {
  return routes.cscaSubjects + '/' + subject;
}

function subjectFormulaPath(subject: string) {
  return routes.cscaSubjects + '/' + subject + '/formulas';
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
const GAS_R = 8.314;

type ThermoProcess = 'isothermal' | 'isobaric' | 'isochoric' | 'adiabatic';

type ThermoCopy = {
  processes: Record<ThermoProcess, string>;
  notes: Record<ThermoProcess, string>;
  svgAria: string;
  energyFlow: string;
  heatSource: string;
  system: string;
  workOutput: string;
  pvChart: string;
  state1: string;
  state2: string;
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  formulas: string;
  controls: string;
  process: string;
  workInput: string;
  heatInput: string;
  initialTemperature: string;
  amount: string;
  energyBalance: string;
  heat: string;
  work: string;
  internalEnergy: string;
  stateChange: string;
  signConvention: string;
  signConventionBody: string;
  pvArea: string;
  pvAreaBody: string;
  coreFormula: string;
  relatedPractice: string;
  thermodynamics: string;
  formulaReference: string;
  viewFormulas: string;
};

const THERMO_COPY: LocalizedMap<ThermoCopy> = {
  'zh-CN': {
    processes: {
      isothermal: '等温',
      isobaric: '等压',
      isochoric: '等容',
      adiabatic: '绝热',
    },
    notes: {
      isothermal: '等温过程：理想气体内能只与温度有关，所以 ΔU=0，吸收的热量全部转化为对外做功。',
      isobaric: '等压过程：压强保持不变，气体膨胀做功 W=PΔV，同时温度变化带来内能变化。',
      isochoric: '等容过程：体积不变，没有边界做功，所以 Q 全部变为内能变化。',
      adiabatic: '绝热过程：没有热量交换，系统对外做功会使内能降低，温度下降。',
    },
    svgAria: '热力学第一定律能量流与 PV 图',
    energyFlow: '能量流动图',
    heatSource: '热源',
    system: '系统',
    workOutput: '做功输出',
    pvChart: 'PV 图',
    state1: '状态1',
    state2: '状态2',
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 热力学第一定律交互模拟',
    title: '热力学第一定律交互模拟',
    body: '切换等温、等压、等容与绝热过程，观察热量 Q、做功 W 和内能变化 ΔU 如何守恒。',
    minuteUnit: '分钟',
    level: '中级',
    practice: '物理练习',
    formulas: '公式',
    controls: '控制面板',
    process: '过程类型',
    workInput: '做功 W',
    heatInput: '热量输入 Q',
    initialTemperature: '初始温度 T1',
    amount: '摩尔数 n',
    energyBalance: '能量平衡',
    heat: '热量 Q',
    work: '做功 W',
    internalEnergy: '内能变化 ΔU',
    stateChange: '状态变量',
    signConvention: '符号约定',
    signConventionBody: 'Q>0 表示系统吸热；W>0 表示系统对外做功，因此内能变化为 ΔU=Q-W。',
    pvArea: 'PV 面积',
    pvAreaBody: 'PV 图中过程线下方的阴影面积表示边界做功；这里 kPa·L 与 J 数值相同。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    thermodynamics: '热力学第一定律',
    formulaReference: '查看公式',
    viewFormulas: '查看公式',
  },
  en: {
    processes: {
      isothermal: 'Isothermal',
      isobaric: 'Isobaric',
      isochoric: 'Isochoric',
      adiabatic: 'Adiabatic',
    },
    notes: {
      isothermal: 'For an ideal gas in an isothermal process, internal energy stays constant, so Q equals W.',
      isobaric: 'In an isobaric process, pressure is constant and work is W=PΔV.',
      isochoric: 'In an isochoric process, volume is fixed, so W=0 and Q changes internal energy.',
      adiabatic: 'In an adiabatic process, Q=0; work done by the gas reduces internal energy.',
    },
    svgAria: 'First law of thermodynamics energy flow and PV chart',
    energyFlow: 'Energy Flow',
    heatSource: 'Heat source',
    system: 'System',
    workOutput: 'Work output',
    pvChart: 'PV Chart',
    state1: 'State 1',
    state2: 'State 2',
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / First Law',
    title: 'First Law of Thermodynamics',
    body: 'Connect heat, work, internal energy, and PV diagrams under different gas processes.',
    minuteUnit: 'min',
    level: 'Intermediate',
    practice: 'Physics Practice',
    formulas: 'Formulas',
    controls: 'Controls',
    process: 'Process',
    workInput: 'Work W',
    heatInput: 'Heat Q',
    initialTemperature: 'Initial T1',
    amount: 'Amount n',
    energyBalance: 'Energy Balance',
    heat: 'Heat Q',
    work: 'Work W',
    internalEnergy: 'Internal energy',
    stateChange: 'State Change',
    signConvention: 'Sign Convention',
    signConventionBody: 'Q is positive when heat enters the system. W is positive when the system does work on the outside.',
    pvArea: 'PV Area',
    pvAreaBody: 'The shaded area under the process curve represents boundary work in kPa·L, numerically equal to joules.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    thermodynamics: 'Thermodynamics',
    formulaReference: 'Formula Reference',
    viewFormulas: 'View Formulas',
  },
};
(THERMO_COPY as any).vi = {
  ...THERMO_COPY.en!,
  back: '← Quay lại công thức Vật lý',
  minuteUnit: 'phút',
  level: 'Cơ bản',
  practice: 'Luyện Vật lý',
  formulas: 'Công thức',
  controls: 'Điều khiển',
  pause: 'Tạm dừng',
  play: 'Phát',
  reset: 'Đặt lại',
  coreFormula: 'Công thức cốt lõi',
  relatedPractice: 'Luyện tập liên quan',
  formulaReference: 'Bảng công thức',
  viewFormulas: 'Xem công thức',
  openFormulas: 'Mở công thức',
};


function thermoState(process: ThermoProcess, energyInput: number, n: number, initialTemperature: number) {
  const cv = 1.5 * GAS_R;
  const cp = 2.5 * GAS_R;
  const gamma = cp / cv;
  const p1 = 100;
  const t1 = initialTemperature;
  const v1 = (n * GAS_R * t1) / p1;
  let q = energyInput;
  let w = 0;
  let deltaU = 0;
  let t2 = t1;
  let v2 = v1;
  let p2 = p1;

  if (process === 'isothermal') {
    w = q;
    deltaU = 0;
    v2 = v1 * Math.exp(w / Math.max(n * GAS_R * t1, 1));
    p2 = (n * GAS_R * t2) / v2;
  } else if (process === 'isobaric') {
    const deltaT = q / Math.max(n * cp, 1);
    t2 = clampNumber(t1 + deltaT, 80, 900);
    deltaU = n * cv * (t2 - t1);
    w = n * GAS_R * (t2 - t1);
    q = deltaU + w;
    v2 = (n * GAS_R * t2) / p1;
    p2 = p1;
  } else if (process === 'isochoric') {
    const deltaT = q / Math.max(n * cv, 1);
    t2 = clampNumber(t1 + deltaT, 80, 900);
    deltaU = n * cv * (t2 - t1);
    q = deltaU;
    w = 0;
    v2 = v1;
    p2 = (n * GAS_R * t2) / v2;
  } else {
    q = 0;
    w = energyInput;
    t2 = clampNumber(t1 - w / Math.max(n * cv, 1), 80, 900);
    deltaU = n * cv * (t2 - t1);
    w = -deltaU;
    v2 = v1 * (t1 / t2) ** (1 / (gamma - 1));
    p2 = (n * GAS_R * t2) / v2;
  }

  return {
    process,
    n,
    q,
    w,
    deltaU,
    p1,
    p2,
    v1,
    v2,
    t1,
    t2,
    cv,
    cp,
    gamma
  };
}

function ThermoMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="thermo-metric"><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}

function ThermoSvg({ state, copy }: { state: ReturnType<typeof thermoState>; copy: ThermoCopy }) {
  const width = 780;
  const height = 520;
  const chart = { x: 74, y: 292, w: 620, h: 170 };
  const vValues = [state.v1, state.v2, 8, 48];
  const pValues = [state.p1, state.p2, 40, 220];
  const vMin = Math.max(4, Math.min(...vValues) - 4);
  const vMax = Math.max(...vValues) + 6;
  const pMin = Math.max(20, Math.min(...pValues) - 20);
  const pMax = Math.max(...pValues) + 30;
  const mapX = (v: number) => chart.x + ((v - vMin) / (vMax - vMin)) * chart.w;
  const mapY = (p: number) => chart.y + chart.h - ((p - pMin) / (pMax - pMin)) * chart.h;
  const x1 = mapX(state.v1);
  const y1 = mapY(state.p1);
  const x2 = mapX(state.v2);
  const y2 = mapY(state.p2);
  const curve = Array.from({ length: 80 }, (_, index) => {
    const t = index / 79;
    const v = state.v1 + (state.v2 - state.v1) * t;
    let p = state.p1 + (state.p2 - state.p1) * t;
    if (state.process === 'isothermal') p = (state.p1 * state.v1) / Math.max(v, 1);
    if (state.process === 'adiabatic') p = state.p1 * (state.v1 / Math.max(v, 1)) ** state.gamma;
    return `${index === 0 ? 'M' : 'L'} ${mapX(v).toFixed(1)} ${mapY(p).toFixed(1)}`;
  }).join(' ');
  const area = `M ${x1} ${chart.y + chart.h} L ${x1} ${y1} ${curve.replace(/^M [^L]+/, '')} L ${x2} ${chart.y + chart.h} Z`;
  const heatReverse = state.q < 0;
  const workReverse = state.w < 0;
  const heatWidth = clampNumber(12 + Math.abs(state.q) / 35, 12, 30);
  const workWidth = clampNumber(12 + Math.abs(state.w) / 35, 12, 30);
  const systemFill = state.deltaU > 8 ? '#ffe9e4' : state.deltaU < -8 ? '#e9efff' : '#eef8f7';

  return (
    <svg className="thermo-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <defs>
        <marker id="thermo-arrow-red" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#ef4444" />
        </marker>
        <marker id="thermo-arrow-blue" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
          <path d="M 0 0 L 12 6 L 0 12 z" fill="#3b82f6" />
        </marker>
      </defs>
      <rect width={width} height={height} rx="14" className="thermo-bg" />
      <text x="18" y="25" className="stage-title">{copy.energyFlow}</text>
      <g className="thermo-flow">
        <rect x="40" y="82" width="104" height="64" rx="9" className="heat-source" />
        <text x="92" y="119">{copy.heatSource}</text>
        <rect x="330" y="68" width="126" height="92" rx="12" fill={systemFill} className="system-box" />
        <text x="393" y="104">{copy.system}</text>
        <text x="393" y="132">ΔU={state.deltaU.toFixed(1)}J</text>
        <rect x="628" y="82" width="104" height="64" rx="9" className="work-sink" />
        <text x="680" y="119">{copy.workOutput}</text>
        <line x1={heatReverse ? 330 : 144} y1="114" x2={heatReverse ? 156 : 318} y2="114" className="heat-arrow" strokeWidth={heatWidth} markerEnd="url(#thermo-arrow-red)" />
        <line x1={workReverse ? 628 : 456} y1="114" x2={workReverse ? 468 : 616} y2="114" className="work-arrow" strokeWidth={workWidth} markerEnd="url(#thermo-arrow-blue)" />
        <text x="232" y="96" className="heat-label">Q={state.q.toFixed(0)}J</text>
        <text x="542" y="96" className="work-label">W={state.w.toFixed(0)}J</text>
        <text x="392" y="202" className="balance-label">ΔU = Q - W = {state.q.toFixed(1)} - {state.w.toFixed(1)} = {state.deltaU.toFixed(1)} J</text>
      </g>

      <g className="thermo-pv-chart">
        <text x={chart.x} y={chart.y - 18}>{copy.pvChart}</text>
        <line x1={chart.x} y1={chart.y + chart.h} x2={chart.x + chart.w} y2={chart.y + chart.h} />
        <line x1={chart.x} y1={chart.y} x2={chart.x} y2={chart.y + chart.h} />
        {[0, 1, 2, 3, 4].map((tick) => {
          const x = chart.x + tick * (chart.w / 4);
          const v = vMin + tick * ((vMax - vMin) / 4);
          return <g key={tick}><line x1={x} y1={chart.y + chart.h} x2={x} y2={chart.y + chart.h + 5} /><text x={x} y={chart.y + chart.h + 22}>{v.toFixed(0)}</text></g>;
        })}
        {[0, 1, 2, 3].map((tick) => {
          const y = chart.y + chart.h - tick * (chart.h / 3);
          const p = pMin + tick * ((pMax - pMin) / 3);
          return <g key={tick}><line x1={chart.x - 5} y1={y} x2={chart.x} y2={y} /><text x={chart.x - 12} y={y + 4}>{p.toFixed(0)}</text></g>;
        })}
        <path d={area} className="work-area" />
        <path d={curve} className="process-path" />
        <circle cx={x1} cy={y1} r="7" className="state-one" />
        <circle cx={x2} cy={y2} r="7" className="state-two" />
        <text x={x1 - 20} y={y1 - 12}>{copy.state1}</text>
        <text x={x2 + 24} y={y2 + 5}>{copy.state2}</text>
        <text x={(x1 + x2) / 2} y={Math.max(y1, y2) + 58}>W={state.w.toFixed(1)}J</text>
        <text x={chart.x + chart.w - 10} y={chart.y + chart.h + 42}>V / L</text>
        <text x={chart.x - 48} y={chart.y + 8}>P / kPa</text>
      </g>
    </svg>
  );
}

export function PhysicsThermodynamicsFirstLawVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(THERMO_COPY, locale);
  const [process, setProcess] = useState<ThermoProcess>('isothermal');
  const [energyInput, setEnergyInput] = useState(200);
  const [initialTemperature, setInitialTemperature] = useState(300);
  const [n, setN] = useState(1);
  const state = thermoState(process, energyInput, n, initialTemperature);

  const resetForProcess = (next: ThermoProcess) => {
    setProcess(next);
    setEnergyInput(200);
    setInitialTemperature(300);
    setN(1);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page thermo-page">
      <section className="special-visualizer-hero thermo-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:bar-chart-3" />{copy.level}</span><span><b>{state.deltaU.toFixed(0)}</b> J</span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="thermo-card" data-testid="thermo-panel">
        <aside className="thermo-side">
          <article className="thermo-formula-card">
            <h2>{copy.formulas}</h2>
            <MathContent text="$\\Delta U=Q-W$" />
            <MathContent text="$W=\\int P\\,dV$" />
            <MathContent text="$W=P\\Delta V$" />
            <MathContent text="$PV^\\gamma=\\mathrm{const}$" />
          </article>
          <article className="thermo-control-card">
            <h2>{copy.controls}</h2>
            <label className="thermo-select"><span>{copy.process}</span><select value={process} onChange={(event) => resetForProcess(event.target.value as ThermoProcess)}><option value="isothermal">{copy.processes.isothermal}</option><option value="isobaric">{copy.processes.isobaric}</option><option value="isochoric">{copy.processes.isochoric}</option><option value="adiabatic">{copy.processes.adiabatic}</option></select></label>
            <div className="thermo-slider-stack">
              <label><span>{process === 'adiabatic' ? copy.workInput : copy.heatInput}</span><input type="range" min="-500" max="800" step="10" value={energyInput} onChange={(event) => setEnergyInput(Number(event.target.value))} /><strong>{energyInput.toFixed(0)} J</strong></label>
              <label><span>{copy.initialTemperature}</span><input type="range" min="220" max="500" step="10" value={initialTemperature} onChange={(event) => setInitialTemperature(Number(event.target.value))} /><strong>{initialTemperature.toFixed(0)} K</strong></label>
              <label><span>{copy.amount}</span><input type="range" min="0.5" max="2" step="0.05" value={n} onChange={(event) => setN(Number(event.target.value))} /><strong>{n.toFixed(2)}</strong></label>
            </div>
          </article>
          <article className="thermo-data-card">
            <h2>{copy.energyBalance}</h2>
            <ThermoMetric color="#ef4444" label={copy.heat} value={`${state.q.toFixed(1)} J`} />
            <ThermoMetric color="#3b82f6" label={copy.work} value={`${state.w.toFixed(1)} J`} />
            <ThermoMetric color="#22c55e" label={copy.internalEnergy} value={`${state.deltaU.toFixed(1)} J`} />
          </article>
          <article className="thermo-state-card">
            <h2>{copy.stateChange}</h2>
            <table><tbody>
              <tr><th /> <th>{copy.state1}</th><th>{copy.state2}</th></tr>
              <tr><td>P</td><td>{state.p1.toFixed(1)} kPa</td><td>{state.p2.toFixed(1)} kPa</td></tr>
              <tr><td>V</td><td>{state.v1.toFixed(2)} L</td><td>{state.v2.toFixed(2)} L</td></tr>
              <tr><td>T</td><td>{state.t1.toFixed(0)} K</td><td>{state.t2.toFixed(0)} K</td></tr>
            </tbody></table>
            <p>{copy.notes[process]}</p>
          </article>
        </aside>
        <div className="thermo-main">
          <div className="thermo-stage"><ThermoSvg state={state} copy={copy} /></div>
          <div className="thermo-explain-card">
            <article><h2>{copy.signConvention}</h2><p>{copy.signConventionBody}</p></article>
            <article><h2>{copy.pvArea}</h2><p>{copy.pvAreaBody}</p></article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$\\Delta U=Q-W$  $W=\\int P\\,dV$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.thermodynamics}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('physics'))}><Icon name="lucide:book-open" />{copy.viewFormulas}</GhostButton></article>
      </section>
    </div>
  );
}


