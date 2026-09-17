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
type CircuitMode = 'series' | 'parallel';
type CircuitPresetId = 'balanced' | 'split' | 'small-r1' | 'high-v';

type CircuitCopy = {
  svgAria: string;
  modeTitle: Record<CircuitMode, string>;
  presets: Record<CircuitPresetId, string>;
  modeTip: Record<CircuitMode, string>;
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  coreFormulas: string;
  circuitType: string;
  series: string;
  parallel: string;
  voltage: string;
  results: string;
  equivalentR: string;
  totalI: string;
  readingTip: string;
  voltageCurrentSplit: string;
  power: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  circuitPractice: string;
  formulaReference: string;
  formulaReferenceBody: string;
  openFormulas: string;
};

const CIRCUIT_COPY: LocalizedMap<CircuitCopy> = {
  'zh-CN': {
    svgAria: '直流电路串并联示意图',
    modeTitle: {
      series: '串联电路',
      parallel: '并联电路',
    },
    presets: {
      balanced: '等阻电路',
      split: '电流分流',
      'small-r1': 'R1 更小',
      'high-v': '高电压',
    },
    modeTip: {
      series: '串联电路：各处电流相同，电源电压按电阻大小分配。',
      parallel: '并联电路：各支路电压相同，电流按电阻大小分流。',
    },
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 直流电路分析模拟',
    title: '直流电路分析模拟',
    body: '切换串联与并联，比较等效电阻、电流、电压分配和电功率。',
    minuteUnit: '分钟',
    level: '基础',
    practice: '物理练习',
    coreFormulas: '核心公式',
    circuitType: '电路类型',
    series: '串联',
    parallel: '并联',
    voltage: '电源电压 V',
    results: '计算结果',
    equivalentR: '等效电阻',
    totalI: '总电流 I',
    readingTip: '读图要点',
    voltageCurrentSplit: '电压与电流分配',
    power: '电功率',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '先判断串联还是并联，再计算等效电阻和分压分流。',
    circuitPractice: '直流电路',
    formulaReference: '查看公式',
    formulaReferenceBody: '回到公式表复盘欧姆定律、串并联电阻和电功率。',
    openFormulas: '查看公式',
  },
  en: {
    svgAria: 'DC series and parallel circuit diagram',
    modeTitle: {
      series: 'Series Circuit',
      parallel: 'Parallel Circuit',
    },
    presets: {
      balanced: 'Equal resistors',
      split: 'Current split',
      'small-r1': 'Smaller R1',
      'high-v': 'Higher voltage',
    },
    modeTip: {
      series: 'Series circuit: current is the same everywhere; source voltage is divided across resistors.',
      parallel: 'Parallel circuit: each branch has the same voltage; current splits by resistance.',
    },
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / DC Circuits',
    title: 'DC Circuit Analysis',
    body: 'Switch between series and parallel circuits to compare equivalent resistance, current, voltage, and power.',
    minuteUnit: 'min',
    level: 'Foundation',
    practice: 'Physics Practice',
    coreFormulas: 'Core Formulas',
    circuitType: 'Circuit Type',
    series: 'Series',
    parallel: 'Parallel',
    voltage: 'Voltage V',
    results: 'Results',
    equivalentR: 'Equivalent R',
    totalI: 'Total I',
    readingTip: 'Reading Tip',
    voltageCurrentSplit: 'Voltage and Current Split',
    power: 'Power',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Practice recognizing whether a circuit is series or parallel before calculating.',
    circuitPractice: 'Circuit Practice',
    formulaReference: 'Formula Reference',
    formulaReferenceBody: 'Review Ohm law, resistance rules, and electric power together.',
    openFormulas: 'Open Formulas',
  },
};
(CIRCUIT_COPY as any).vi = {
  ...CIRCUIT_COPY.en!,
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


const CIRCUIT_PRESETS = [
  { id: 'balanced', voltage: 12, r1: 100, r2: 100, mode: 'series' as CircuitMode },
  { id: 'split', voltage: 12, r1: 100, r2: 200, mode: 'parallel' as CircuitMode },
  { id: 'small-r1', voltage: 9, r1: 50, r2: 250, mode: 'parallel' as CircuitMode },
  { id: 'high-v', voltage: 18, r1: 120, r2: 180, mode: 'series' as CircuitMode }
] as const;

function circuitState(mode: CircuitMode, voltage: number, r1: number, r2: number) {
  const req = mode === 'series' ? r1 + r2 : (r1 * r2) / (r1 + r2);
  const totalCurrent = voltage / req;
  const i1 = mode === 'series' ? totalCurrent : voltage / r1;
  const i2 = mode === 'series' ? totalCurrent : voltage / r2;
  const v1 = mode === 'series' ? i1 * r1 : voltage;
  const v2 = mode === 'series' ? i2 * r2 : voltage;
  const p1 = v1 * i1;
  const p2 = v2 * i2;
  return {
    req,
    totalCurrent,
    i1,
    i2,
    v1,
    v2,
    p1,
    p2,
    totalPower: voltage * totalCurrent
  };
}

function ResistorSymbol({ x, y, label, value }: { x: number; y: number; label: string; value: number }) {
  return (
    <g className="circuit-resistor" transform={`translate(${x} ${y})`}>
      <line x1="-70" y1="0" x2="-34" y2="0" />
      <polyline points="-34,0 -24,-11 -12,11 0,-11 12,11 24,-11 34,0" />
      <line x1="34" y1="0" x2="70" y2="0" />
      <text x="0" y="-22">{label} = {value.toFixed(0)}Ω</text>
    </g>
  );
}

function CircuitSvg({ mode, voltage, r1, r2, state, copy }: { mode: CircuitMode; voltage: number; r1: number; r2: number; state: ReturnType<typeof circuitState>; copy: CircuitCopy }) {
  const maxI = Math.max(state.totalCurrent, state.i1, state.i2, 0.001);
  const dotCount = mode === 'series' ? 7 : 10;
  const dots = Array.from({ length: dotCount }, (_, index) => index);

  return (
    <svg className="circuit-svg" viewBox="0 0 760 360" role="img" aria-label={copy.svgAria}>
      <defs>
        <marker id="circuit-current-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
      </defs>
      <rect width="760" height="360" className="circuit-bg" />
      <text x="16" y="26" className="circuit-title">{copy.modeTitle[mode]}</text>
      <g className="battery" transform="translate(118 180)">
        <line x1="-16" y1="-48" x2="-16" y2="48" />
        <line x1="12" y1="-32" x2="12" y2="32" />
        <text x="-44" y="-58">+</text>
        <text x="28" y="-58">−</text>
        <text x="-34" y="70">{voltage.toFixed(1)}V</text>
      </g>

      {mode === 'series' ? (
        <>
          <path className="wire" d="M 130 132 L 190 132 L 190 92 L 570 92 L 570 268 L 130 268 L 130 228" />
          <ResistorSymbol x={300} y={92} label="R1" value={r1} />
          <ResistorSymbol x={470} y={92} label="R2" value={r2} />
          <line x1="188" y1="268" x2="230" y2="268" className="current-arrow" markerEnd="url(#circuit-current-arrow)" />
          <text x="344" y="305" className="current-label">I = {(state.totalCurrent * 1000).toFixed(1)} mA</text>
          <text x="272" y="62" className="voltage-label">V1={state.v1.toFixed(2)}V</text>
          <text x="442" y="62" className="voltage-label">V2={state.v2.toFixed(2)}V</text>
          {dots.map((dot) => <circle key={dot} cx={190 + ((dot * 71) % 360)} cy={dot % 2 ? 268 : 92} r="4" className="current-dot" />)}
        </>
      ) : (
        <>
          <path className="wire" d="M 130 132 L 220 132 L 220 82 L 570 82 L 570 278 L 220 278 L 220 228 L 130 228" />
          <path className="wire" d="M 220 180 L 570 180" />
          <ResistorSymbol x={395} y={82} label="R1" value={r1} />
          <ResistorSymbol x={395} y={180} label="R2" value={r2} />
          <line x1="238" y1="82" x2="282" y2="82" className="current-arrow" markerEnd="url(#circuit-current-arrow)" />
          <line x1="238" y1="180" x2="282" y2="180" className="current-arrow branch" markerEnd="url(#circuit-current-arrow)" />
          <text x="335" y="122" className="current-label">I1={(state.i1 * 1000).toFixed(1)} mA</text>
          <text x="335" y="220" className="current-label branch">I2={(state.i2 * 1000).toFixed(1)} mA</text>
          <text x="595" y="138" className="voltage-label">V1=V</text>
          <text x="595" y="202" className="voltage-label">V2=V</text>
          {dots.map((dot) => <circle key={dot} cx={220 + ((dot * 47) % 330)} cy={dot % 3 === 0 ? 82 : dot % 3 === 1 ? 180 : 278} r={3 + Math.min(3, (maxI * 1000) / 80)} className="current-dot" />)}
        </>
      )}
      <text x="626" y="322" className="circuit-summary">Req={state.req.toFixed(1)}Ω</text>
    </svg>
  );
}

function CircuitMetricBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const percent = clampNumber((value / Math.max(max, 0.001)) * 100, 0, 100);
  return (
    <div className="circuit-bar-row">
      <span>{label}</span>
      <div><i style={{ width: `${percent}%`, background: color }} /></div>
      <strong>{value.toFixed(unit === 'mA' ? 1 : 2)} {unit}</strong>
    </div>
  );
}

export function PhysicsCircuitSeriesParallelVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(CIRCUIT_COPY, locale);
  const [mode, setMode] = useState<CircuitMode>('series');
  const [voltage, setVoltage] = useState(12);
  const [r1, setR1] = useState(100);
  const [r2, setR2] = useState(200);
  const state = circuitState(mode, voltage, r1, r2);
  const maxVoltage = Math.max(voltage, state.v1, state.v2, 1);
  const maxCurrentMa = Math.max(state.totalCurrent, state.i1, state.i2, 0.001) * 1000;
  const modeTip = copy.modeTip[mode];

  const applyPreset = (preset: typeof CIRCUIT_PRESETS[number]) => {
    setMode(preset.mode);
    setVoltage(preset.voltage);
    setR1(preset.r1);
    setR2(preset.r2);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page circuit-page">
      <section className="special-visualizer-hero circuit-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>
          {copy.back}
        </GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics">
            <span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span>
            <span><Icon name="lucide:activity" />{copy.level}</span>
            <span><b>{(state.totalCurrent * 1000).toFixed(1)}</b> mA</span>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="circuit-card" data-testid="circuit-panel">
        <aside className="circuit-side">
          <article className="circuit-formula-card">
            <h2>{copy.coreFormulas}</h2>
            <MathContent text="$V=IR$" />
            <MathContent text="$R_s=R_1+R_2$" />
            <MathContent text="$\\frac{1}{R_p}=\\frac{1}{R_1}+\\frac{1}{R_2}$" />
          </article>
          <article className="circuit-control-card">
            <h2>{copy.circuitType}</h2>
            <div className="circuit-mode-tabs">
              <button type="button" className={mode === 'series' ? 'active' : ''} onClick={() => setMode('series')}>{copy.series}</button>
              <button type="button" className={mode === 'parallel' ? 'active' : ''} onClick={() => setMode('parallel')}>{copy.parallel}</button>
            </div>
            <div className="circuit-slider-stack">
              <label><span>{copy.voltage}</span><input type="range" min="3" max="24" step="0.5" value={voltage} onChange={(event) => setVoltage(Number(event.target.value))} /><strong>{voltage.toFixed(1)} V</strong></label>
              <label><span>R1</span><input type="range" min="20" max="500" step="10" value={r1} onChange={(event) => setR1(Number(event.target.value))} /><strong>{r1.toFixed(0)} Ω</strong></label>
              <label><span>R2</span><input type="range" min="20" max="500" step="10" value={r2} onChange={(event) => setR2(Number(event.target.value))} /><strong>{r2.toFixed(0)} Ω</strong></label>
            </div>
            <div className="kinematics-preset-row">
              {CIRCUIT_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>{copy.presets[preset.id]}</button>)}
            </div>
          </article>
          <article className="circuit-results-card">
            <h2>{copy.results}</h2>
            <div><span>{copy.equivalentR}</span><strong>{state.req.toFixed(1)} Ω</strong></div>
            <div><span>{copy.totalI}</span><strong>{(state.totalCurrent * 1000).toFixed(1)} mA</strong></div>
            <div><span>V1</span><strong>{state.v1.toFixed(2)} V</strong></div>
            <div><span>V2</span><strong>{state.v2.toFixed(2)} V</strong></div>
            <div><span>I1</span><strong>{(state.i1 * 1000).toFixed(1)} mA</strong></div>
            <div><span>I2</span><strong>{(state.i2 * 1000).toFixed(1)} mA</strong></div>
            <div><span>P</span><strong>{(state.totalPower * 1000).toFixed(1)} mW</strong></div>
          </article>
        </aside>

        <div className="circuit-main">
          <div className="circuit-stage">
            <CircuitSvg mode={mode} voltage={voltage} r1={r1} r2={r2} state={state} copy={copy} />
          </div>
          <div className="circuit-analysis">
            <article>
              <h2>{copy.readingTip}</h2>
              <p>{modeTip}</p>
            </article>
            <article>
              <h2>{copy.voltageCurrentSplit}</h2>
              <CircuitMetricBar label="V1" value={state.v1} max={maxVoltage} unit="V" color="#315dff" />
              <CircuitMetricBar label="V2" value={state.v2} max={maxVoltage} unit="V" color="#818cf8" />
              <CircuitMetricBar label="I1" value={state.i1 * 1000} max={maxCurrentMa} unit="mA" color="#ef4444" />
              <CircuitMetricBar label="I2" value={state.i2 * 1000} max={maxCurrentMa} unit="mA" color="#f97316" />
            </article>
            <article>
              <h2>{copy.power}</h2>
              <CircuitMetricBar label="P1" value={state.p1 * 1000} max={Math.max(state.p1, state.p2, 0.001) * 1000} unit="mW" color="#22c55e" />
              <CircuitMetricBar label="P2" value={state.p2 * 1000} max={Math.max(state.p1, state.p2, 0.001) * 1000} unit="mW" color="#16a34a" />
            </article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article>
          <h2>{copy.coreFormula}</h2>
          <p><MathContent text="$V=IR$  $P=VI$" /></p>
        </article>
        <article>
          <h2>{copy.relatedPractice}</h2>
          <p>{copy.relatedPracticeBody}</p>
          <GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.circuitPractice}</GhostButton>
        </article>
        <article>
          <h2>{copy.formulaReference}</h2>
          <p>{copy.formulaReferenceBody}</p>
          <GhostButton onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.openFormulas}</GhostButton>
        </article>
      </section>
    </div>
  );
}


