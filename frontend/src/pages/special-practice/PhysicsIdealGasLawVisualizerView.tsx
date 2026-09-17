import { useEffect, useState } from 'react';
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
type GasProcess = 'isothermal' | 'isobaric' | 'isochoric';

const GAS_R = 8.314;

type GasProcessCopy = {
  name: string;
  fixed: string;
  option: string;
  relation: string;
};

type IdealGasCopy = {
  processes: Record<GasProcess, GasProcessCopy>;
  svgAria: string;
  pistonTitle: string;
  speedDistribution: string;
  slow: string;
  fast: string;
  pvChart: string;
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  formulas: string;
  state: string;
  pressure: string;
  volume: string;
  temperature: string;
  amount: string;
  controls: string;
  process: string;
  amountControl: string;
  currentProcess: string;
  howToRead: string;
  howToReadBody: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  thermodynamicsPractice: string;
  formulaReference: string;
  viewFormulas: string;
};

const IDEAL_GAS_COPY: LocalizedMap<IdealGasCopy> = {
  'zh-CN': {
    processes: {
      isothermal: {
        name: '等温过程',
        fixed: '温度 T 不变',
        option: '等温过程（T 恒定）',
        relation: '温度不变时，体积增大压强降低，PV 图是一条双曲线。',
      },
      isobaric: {
        name: '等压过程',
        fixed: '压强 P 不变',
        option: '等压过程（P 恒定）',
        relation: '压强不变时，温度升高体积增大，V 与 T 成正比。',
      },
      isochoric: {
        name: '等容过程',
        fixed: '体积 V 不变',
        option: '等容过程（V 恒定）',
        relation: '体积不变时，温度升高压强增大，P 与 T 成正比。',
      },
    },
    svgAria: '理想气体活塞与 PV 图',
    pistonTitle: '活塞-气缸模型',
    speedDistribution: '速率分布',
    slow: '慢',
    fast: '快',
    pvChart: 'P-V 图',
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 理想气体状态方程交互模拟',
    title: '理想气体状态方程交互模拟',
    body: '用活塞-气缸模型和 PV 图，把压强、体积、温度和物质的量放在同一个状态方程里观察。',
    minuteUnit: '分钟',
    level: '基础',
    practice: '物理练习',
    formulas: '公式',
    state: '状态量',
    pressure: '压强 P',
    volume: '体积 V',
    temperature: '温度 T',
    amount: '物质的量 n',
    controls: '控制面板',
    process: '过程类型',
    amountControl: '粒子数 n',
    currentProcess: '当前过程',
    howToRead: '读图要点',
    howToReadBody: 'PV 图上的状态点、活塞位置和左侧数值都由同一个状态方程计算，避免参考页那种图像与数值脱节。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '做气体状态和热学过程题前，先用这个模型确认不变量和变量关系。',
    thermodynamicsPractice: '热学',
    formulaReference: '查看公式',
    viewFormulas: '查看公式',
  },
  en: {
    processes: {
      isothermal: {
        name: 'Isothermal',
        fixed: 'Temperature T fixed',
        option: 'Isothermal (T fixed)',
        relation: 'At constant temperature, increasing volume lowers pressure along a hyperbola.',
      },
      isobaric: {
        name: 'Isobaric',
        fixed: 'Pressure P fixed',
        option: 'Isobaric (P fixed)',
        relation: 'At constant pressure, volume grows in proportion to temperature.',
      },
      isochoric: {
        name: 'Isochoric',
        fixed: 'Volume V fixed',
        option: 'Isochoric (V fixed)',
        relation: 'At constant volume, pressure grows in proportion to temperature.',
      },
    },
    svgAria: 'Ideal gas piston and PV graph',
    pistonTitle: 'Piston-Cylinder Model',
    speedDistribution: 'Speed distribution',
    slow: 'Slow',
    fast: 'Fast',
    pvChart: 'P-V Graph',
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Ideal Gas Law',
    title: 'Ideal Gas Law Interactive Simulation',
    body: 'Use a piston model and PV graph to connect pressure, volume, temperature, and amount of gas.',
    minuteUnit: 'min',
    level: 'Foundation',
    practice: 'Physics Practice',
    formulas: 'Formulas',
    state: 'State',
    pressure: 'Pressure P',
    volume: 'Volume V',
    temperature: 'Temperature T',
    amount: 'Amount n',
    controls: 'Controls',
    process: 'Process',
    amountControl: 'Amount n',
    currentProcess: 'Current Process',
    howToRead: 'How to Read It',
    howToReadBody: 'The state point on the PV graph, the piston position, and the state numbers are calculated from the same equation.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Use this model before gas-law and thermodynamics questions.',
    thermodynamicsPractice: 'Thermodynamics Practice',
    formulaReference: 'Formula Reference',
    viewFormulas: 'View Formulas',
  },
};
(IDEAL_GAS_COPY as any).vi = {
  ...IDEAL_GAS_COPY.en!,
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


const GAS_PARTICLES = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  x: 8 + ((index * 31) % 86),
  y: 14 + ((index * 47) % 70),
  delay: -((index * 0.13) % 1.6)
}));

function gasState(process: GasProcess, n: number, temperature: number, pressure: number, volume: number) {
  if (process === 'isothermal') {
    const p = (n * GAS_R * temperature) / volume;
    return { n, temperature, pressure: p, volume, invariant: temperature };
  }
  if (process === 'isobaric') {
    const v = (n * GAS_R * temperature) / pressure;
    return { n, temperature, pressure, volume: v, invariant: pressure };
  }
  const p = (n * GAS_R * temperature) / volume;
  return { n, temperature, pressure: p, volume, invariant: volume };
}

function GasMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="gas-metric"><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}

function IdealGasSvg({ process, state, phase, copy }: { process: GasProcess; state: ReturnType<typeof gasState>; phase: number; copy: IdealGasCopy }) {
  const width = 780;
  const height = 500;
  const chamberX = 70;
  const chamberY = 76;
  const chamberHeight = 112;
  const chamberWidth = clampNumber(120 + state.volume * 5.1, 120, 430);
  const pistonX = chamberX + chamberWidth;
  const hot = clampNumber((state.temperature - 180) / 470, 0, 1);
  const pressureOpacity = clampNumber((state.pressure - 60) / 290, 0.08, 0.86);
  const particleDuration = clampNumber(1.7 - hot * 0.95, 0.58, 1.7);
  const vMin = 5;
  const vMax = 65;
  const pMin = 60;
  const pMax = 360;
  const chart = { x: 70, y: 270, w: 620, h: 170 };
  const mapX = (v: number) => chart.x + ((clampNumber(v, vMin, vMax) - vMin) / (vMax - vMin)) * chart.w;
  const mapY = (p: number) => chart.y + chart.h - ((clampNumber(p, pMin, pMax) - pMin) / (pMax - pMin)) * chart.h;
  const pointX = mapX(state.volume);
  const pointY = mapY(state.pressure);
  const path = process === 'isothermal'
    ? Array.from({ length: 90 }, (_, index) => {
        const v = vMin + (index / 89) * (vMax - vMin);
        const p = (state.n * GAS_R * state.temperature) / v;
        return `${index === 0 ? 'M' : 'L'} ${mapX(v).toFixed(1)} ${mapY(p).toFixed(1)}`;
      }).join(' ')
    : process === 'isobaric'
      ? `M ${mapX(vMin)} ${mapY(state.pressure)} L ${mapX(vMax)} ${mapY(state.pressure)}`
      : `M ${mapX(state.volume)} ${mapY(pMin)} L ${mapX(state.volume)} ${mapY(pMax)}`;
  const speedCurve = Array.from({ length: 80 }, (_, index) => {
    const x = 508 + index * 2.25;
    const y = 72 + 36 * Math.exp(-((index - 38 - hot * 18) ** 2) / 620) + 9 * Math.sin(index * 0.18 + phase);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="ideal-gas-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <defs>
        <linearGradient id="gas-chamber-fill" x1="0" x2="1">
          <stop offset="0%" stopColor="#ecfeff" />
          <stop offset="100%" stopColor={hot > 0.55 ? '#fee2e2' : '#dbeafe'} />
        </linearGradient>
        <marker id="gas-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
      </defs>
      <rect x="0" y="0" width={width} height={height} rx="14" className="gas-bg" />
      <text x="18" y="25" className="stage-title">{copy.pistonTitle}</text>
      <text x="676" y="25" className="gas-process-label">{copy.processes[process].name}</text>

      <g className="gas-cylinder">
        <rect x={chamberX} y={chamberY} width={chamberWidth} height={chamberHeight} rx="10" fill="url(#gas-chamber-fill)" />
        <path d={`M ${chamberX} ${chamberY} H ${chamberX + 430} M ${chamberX} ${chamberY + chamberHeight} H ${chamberX + 430}`} />
        <rect x={pistonX - 8} y={chamberY - 8} width="16" height={chamberHeight + 16} rx="3" className="piston" />
        <line x1={pistonX + 6} y1={chamberY + chamberHeight / 2} x2={pistonX + 64} y2={chamberY + chamberHeight / 2} className="piston-rod" />
        <text x={pistonX + 24} y={chamberY + chamberHeight + 30}>V={state.volume.toFixed(1)}L</text>
      </g>

      <g className="gas-particles">
        {GAS_PARTICLES.map((particle) => {
          const x = chamberX + 12 + (particle.x / 100) * Math.max(chamberWidth - 28, 20);
          const y = chamberY + (particle.y / 100) * chamberHeight;
          return <circle key={particle.id} cx={x} cy={y} r={2.5 + pressureOpacity * 1.4} style={{ animationDelay: `${particle.delay}s`, animationDuration: `${particleDuration}s` }} />;
        })}
      </g>
      <g className="gas-pressure-hits" opacity={pressureOpacity}>
        {Array.from({ length: 8 }, (_, index) => <line key={index} x1={pistonX - 25 - index * 13} y1={chamberY + 16 + (index % 4) * 23} x2={pistonX - 8} y2={chamberY + 18 + (index % 4) * 23} markerEnd="url(#gas-arrow)" />)}
      </g>

      <g className="gas-speed-plot">
        <text x="590" y="62">{copy.speedDistribution}</text>
        <path d={speedCurve} />
        <text x="510" y="146">{copy.slow}</text>
        <text x="680" y="146">{copy.fast}</text>
      </g>

      <g className="gas-pv-chart">
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
        <text x={chart.x + chart.w - 10} y={chart.y + chart.h + 42}>V / L</text>
        <text x={chart.x - 48} y={chart.y + 8}>P / kPa</text>
        <path d={path} className="gas-process-path" />
        <circle cx={pointX} cy={pointY} r="7" className="gas-state-point" />
        <text x={pointX + 12} y={pointY - 10}>({state.volume.toFixed(1)}, {state.pressure.toFixed(0)})</text>
      </g>
    </svg>
  );
}

export function PhysicsIdealGasLawVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(IDEAL_GAS_COPY, locale);
  const [process, setProcess] = useState<GasProcess>('isothermal');
  const [n, setN] = useState(1);
  const [temperature, setTemperature] = useState(300);
  const [pressure, setPressure] = useState(150);
  const [volume, setVolume] = useState(16.63);
  const [phase, setPhase] = useState(0);
  const state = gasState(process, n, temperature, pressure, volume);
  const processCopy = copy.processes[process];

  useEffect(() => {
    const id = window.setInterval(() => setPhase((value) => (value + 0.18) % (Math.PI * 2)), 80);
    return () => window.clearInterval(id);
  }, []);

  const handleProcessChange = (next: GasProcess) => {
    setProcess(next);
    setN(1);
    setTemperature(300);
    setPressure(150);
    setVolume(16.63);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page ideal-gas-page">
      <section className="special-visualizer-hero ideal-gas-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:activity" />{copy.level}</span><span><b>{state.volume.toFixed(1)}</b> L</span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="ideal-gas-card" data-testid="ideal-gas-panel">
        <aside className="ideal-gas-side">
          <article className="ideal-gas-formula-card">
            <h2>{copy.formulas}</h2>
            <MathContent text="$PV=nRT$" />
            <MathContent text="$\\frac{P_1V_1}{T_1}=\\frac{P_2V_2}{T_2}$" />
          </article>
          <article className="ideal-gas-data-card">
            <h2>{copy.state}</h2>
            <GasMetric color="#ef4444" label={copy.pressure} value={`${state.pressure.toFixed(1)} kPa`} />
            <GasMetric color="#3b82f6" label={copy.volume} value={`${state.volume.toFixed(2)} L`} />
            <GasMetric color="#b7ef43" label={copy.temperature} value={`${state.temperature.toFixed(0)} K`} />
            <GasMetric color="#22c55e" label={copy.amount} value={`${state.n.toFixed(2)} mol`} />
            <GasMetric color="#5f6f69" label="R" value="8.314 kPa·L/(mol·K)" />
          </article>
          <article className="ideal-gas-control-card">
            <h2>{copy.controls}</h2>
            <label className="ideal-gas-select"><span>{copy.process}</span><select value={process} onChange={(event) => handleProcessChange(event.target.value as GasProcess)}><option value="isothermal">{copy.processes.isothermal.option}</option><option value="isobaric">{copy.processes.isobaric.option}</option><option value="isochoric">{copy.processes.isochoric.option}</option></select></label>
            <div className="ideal-gas-slider-stack">
              <label><span>{copy.amountControl}</span><input type="range" min="0.5" max="2" step="0.05" value={n} onChange={(event) => setN(Number(event.target.value))} /><strong>{n.toFixed(2)} mol</strong></label>
              <label><span>{copy.temperature}</span><input type="range" min="180" max="650" step="10" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /><strong>{temperature.toFixed(0)} K</strong></label>
              <label><span>{copy.pressure}</span><input type="range" min="80" max="320" step="5" value={pressure} disabled={process !== 'isobaric'} onChange={(event) => setPressure(Number(event.target.value))} /><strong>{state.pressure.toFixed(0)} kPa</strong></label>
              <label><span>{copy.volume}</span><input type="range" min="8" max="60" step="0.2" value={volume} disabled={process === 'isobaric'} onChange={(event) => setVolume(Number(event.target.value))} /><strong>{state.volume.toFixed(1)} L</strong></label>
            </div>
            <p className="ideal-gas-lock">{processCopy.fixed}</p>
          </article>
        </aside>
        <div className="ideal-gas-main">
          <div className="ideal-gas-stage"><IdealGasSvg process={process} state={state} phase={phase} copy={copy} /></div>
          <div className="ideal-gas-explain-card">
            <article><h2>{copy.currentProcess}</h2><p><strong>{processCopy.name}</strong>{processCopy.relation}</p></article>
            <article><h2>{copy.howToRead}</h2><p>{copy.howToReadBody}</p></article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$PV=nRT$  $\\frac{P_1V_1}{T_1}=\\frac{P_2V_2}{T_2}$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><p>{copy.relatedPracticeBody}</p><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.thermodynamicsPractice}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('physics'))}><Icon name="lucide:book-open" />{copy.viewFormulas}</GhostButton></article>
      </section>
    </div>
  );
}


