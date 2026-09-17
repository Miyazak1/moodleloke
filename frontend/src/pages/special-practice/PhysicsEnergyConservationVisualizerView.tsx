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

type EnergyPresetId = 'conserved' | 'friction' | 'steep' | 'gentle';
type EnergyInsight = 'stuck' | 'dissipative' | 'conserved';

type EnergyCopy = {
  presets: Record<EnergyPresetId, string>;
  insight: Record<EnergyInsight, string>;
  svgAria: string;
  stageTitle: string;
  totalEnergyShort: string;
  back: string;
  kicker: string;
  title: string;
  body: string;
  metricsAria: string;
  minuteUnit: string;
  level: string;
  practice: string;
  coreFormulas: string;
  energy: string;
  kinetic: string;
  potential: string;
  mechanical: string;
  heat: string;
  dissipatedHeat: string;
  conservationCheck: string;
  totalEnergy: string;
  energyDistribution: string;
  total: string;
  mass: string;
  massAria: string;
  height: string;
  heightAria: string;
  angle: string;
  angleAria: string;
  friction: string;
  frictionAria: string;
  position: string;
  positionAria: string;
  pause: string;
  play: string;
  reset: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  energyPractice: string;
  formulaReference: string;
  formulaReferenceBody: string;
  openFormulas: string;
};

const ENERGY_COPY: LocalizedMap<EnergyCopy> = {
  'zh-CN': {
    presets: {
      conserved: '无摩擦守恒',
      friction: '有摩擦耗散',
      steep: '陡坡快滑',
      gentle: '缓坡慢滑',
    },
    insight: {
      stuck: '摩擦足够大时，物块从静止不会自行下滑；拖动位置进度可以观察能量耗散。',
      dissipative: '存在摩擦时，机械能 Ek+Ep 会减少，但把热/耗散能算进去后总能量仍守恒。',
      conserved: '无摩擦时，重力势能转化为动能，机械能 Ek+Ep 保持不变。',
    },
    svgAria: '斜面功与能量示意图',
    stageTitle: '斜面能量转换',
    totalEnergyShort: 'E总',
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 功与能量交互模拟',
    title: '功与能量交互模拟',
    body: '让物块沿斜面下滑，比较动能、重力势能、机械能与摩擦耗散能的变化。',
    metricsAria: '功与能量模拟信息',
    minuteUnit: '分钟',
    level: '基础',
    practice: '物理练习',
    coreFormulas: '核心公式',
    energy: '能量',
    kinetic: '动能',
    potential: '势能',
    mechanical: '机械能',
    heat: '热',
    dissipatedHeat: '耗散热',
    conservationCheck: '守恒判断',
    totalEnergy: '总能量',
    energyDistribution: '能量分布',
    total: '总能量',
    mass: '质量 m',
    massAria: '质量',
    height: '高度 h',
    heightAria: '高度',
    angle: '倾角 θ',
    angleAria: '倾角',
    friction: '摩擦 μ',
    frictionAria: '摩擦系数',
    position: '位置进度',
    positionAria: '位置进度',
    pause: '暂停',
    play: '播放',
    reset: '重置',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '做功、机械能和摩擦题前，先用这个模型区分守恒与耗散。',
    energyPractice: '功与能量',
    formulaReference: '查看公式',
    formulaReferenceBody: '回到公式表，把功、动能、势能和功率一起复盘。',
    openFormulas: '查看公式',
  },
  en: {
    presets: {
      conserved: 'Frictionless conservation',
      friction: 'Friction dissipates energy',
      steep: 'Steep fast slide',
      gentle: 'Gentle slow slide',
    },
    insight: {
      stuck: 'Friction is large enough that the block will not start sliding from rest. Scrub position to inspect energy loss.',
      dissipative: 'With friction, mechanical energy decreases, but total energy including heat stays constant.',
      conserved: 'Without friction, potential energy converts into kinetic energy and mechanical energy stays constant.',
    },
    svgAria: 'Incline work and energy diagram',
    stageTitle: 'Incline Energy Transfer',
    totalEnergyShort: 'E total',
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Work and Energy',
    title: 'Work and Energy Simulation',
    body: 'Move a block down an incline and compare kinetic, potential, mechanical, and dissipated energy.',
    metricsAria: 'Energy simulation details',
    minuteUnit: 'min',
    level: 'Foundation',
    practice: 'Physics Practice',
    coreFormulas: 'Core Formulas',
    energy: 'Energy',
    kinetic: 'Kinetic',
    potential: 'Potential',
    mechanical: 'Mechanical',
    heat: 'Heat',
    dissipatedHeat: 'Heat',
    conservationCheck: 'Conservation Check',
    totalEnergy: 'Total energy',
    energyDistribution: 'Energy Distribution',
    total: 'Total',
    mass: 'Mass m',
    massAria: 'Mass',
    height: 'Height h',
    heightAria: 'Height',
    angle: 'Angle θ',
    angleAria: 'Incline angle',
    friction: 'Friction μ',
    frictionAria: 'Friction coefficient',
    position: 'Position',
    positionAria: 'Position progress',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Use this model before questions about work, mechanical energy, and friction.',
    energyPractice: 'Energy Practice',
    formulaReference: 'Formula Reference',
    formulaReferenceBody: 'Review work, kinetic energy, potential energy, and power together.',
    openFormulas: 'Open Formulas',
  },
};
(ENERGY_COPY as any).vi = {
  ...ENERGY_COPY.en!,
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


const ENERGY_PRESETS = [
  { id: 'conserved', mass: 2, height: 5, angle: 30, friction: 0 },
  { id: 'friction', mass: 2, height: 5, angle: 30, friction: 0.18 },
  { id: 'steep', mass: 2.5, height: 6, angle: 48, friction: 0.08 },
  { id: 'gentle', mass: 1.5, height: 4, angle: 18, friction: 0.12 }
] as const;

function energyState(mass: number, height: number, angle: number, friction: number, progress: number) {
  const g = 9.8;
  const safeSin = Math.max(Math.sin((angle * Math.PI) / 180), 0.08);
  const rampLength = height / safeSin;
  const distance = rampLength * progress;
  const currentHeight = height * (1 - progress);
  const initialPotential = mass * g * height;
  const potential = mass * g * currentHeight;
  const frictionWork = friction * mass * g * Math.cos((angle * Math.PI) / 180) * distance;
  const availableDrop = Math.max(initialPotential - potential, 0);
  const thermal = Math.min(frictionWork, availableDrop);
  const kinetic = Math.max(initialPotential - potential - thermal, 0);
  const mechanical = kinetic + potential;
  const total = kinetic + potential + thermal;
  const velocity = Math.sqrt((2 * kinetic) / Math.max(mass, 0.1));
  const acceleration = g * (Math.sin((angle * Math.PI) / 180) - friction * Math.cos((angle * Math.PI) / 180));

  return {
    g,
    rampLength,
    distance,
    currentHeight,
    initialPotential,
    potential,
    thermal,
    kinetic,
    mechanical,
    total,
    velocity,
    acceleration
  };
}

function EnergyInclineSvg({
  mass,
  height,
  angle,
  friction,
  progress,
  state,
  copy
}: {
  mass: number;
  height: number;
  angle: number;
  friction: number;
  progress: number;
  state: ReturnType<typeof energyState>;
  copy: EnergyCopy;
}) {
  const width = 760;
  const heightSvg = 330;
  const baseY = 278;
  const leftX = 110;
  const rampLength = 520;
  const vertical = Math.min(210, 70 + height * 22);
  const topX = leftX + Math.cos((angle * Math.PI) / 180) * rampLength;
  const topY = baseY - vertical;
  const blockX = topX + (leftX - topX) * progress;
  const blockY = topY + (baseY - topY) * progress;
  const blockAngle = -angle;
  const labelX = Math.min(width - 120, Math.max(95, blockX + 18));
  const labelY = Math.max(42, blockY - 28);
  const frictionVisible = friction > 0.01 && progress > 0.02;

  return (
    <svg className="energy-incline-svg" viewBox={`0 0 ${width} ${heightSvg}`} role="img" aria-label={copy.svgAria}>
      <defs>
        <linearGradient id="energy-stage-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#e9efff" />
          <stop offset="100%" stopColor="#ecfdf5" />
        </linearGradient>
        <marker id="energy-arrow-red" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
        <marker id="energy-arrow-green" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#16a34a" />
        </marker>
        <marker id="energy-arrow-blue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#315dff" />
        </marker>
      </defs>
      <rect x="0" y="0" width={width} height={heightSvg} rx="16" fill="url(#energy-stage-bg)" />
      <line x1="70" y1={baseY} x2="700" y2={baseY} className="ground" />
      <path d={`M ${leftX} ${baseY} L ${topX} ${topY} L ${leftX} ${baseY} Z`} className="incline-fill" />
      <line x1={leftX} y1={baseY} x2={topX} y2={topY} className="incline-line" />
      <line x1={topX} y1={topY} x2={topX} y2={baseY} className="height-guide" />
      <text x={topX + 10} y={(topY + baseY) / 2} className="height-label">h={state.currentHeight.toFixed(1)}m</text>
      <path d={`M ${leftX + 18} ${baseY} A 44 44 0 0 1 ${leftX + 18 + 44 * Math.cos((angle * Math.PI) / 180)} ${baseY - 44 * Math.sin((angle * Math.PI) / 180)}`} className="angle-arc" />
      <text x={leftX + 55} y={baseY - 12} className="angle-label">θ={angle.toFixed(0)}°</text>
      <g transform={`translate(${blockX} ${blockY}) rotate(${blockAngle})`}>
        <rect x="-22" y="-18" width="44" height="36" rx="8" className="block" />
        <text x="0" y="5" className="block-label">{mass.toFixed(1)}kg</text>
      </g>
      <line x1={blockX} y1={blockY - 10} x2={blockX} y2={blockY + 62} className="gravity-arrow" markerEnd="url(#energy-arrow-green)" />
      <text x={blockX + 8} y={blockY + 54} className="force-label green">mg</text>
      <line x1={blockX - 8} y1={blockY - 16} x2={blockX - 8 + 60 * Math.cos((angle * Math.PI) / 180)} y2={blockY - 16 + 60 * Math.sin((angle * Math.PI) / 180)} className="velocity-arrow-svg" markerEnd="url(#energy-arrow-blue)" />
      <text x={labelX} y={labelY} className="force-label blue">v={state.velocity.toFixed(1)}m/s</text>
      {frictionVisible && (
        <>
          <line x1={blockX - 14} y1={blockY + 18} x2={blockX - 14 - 54 * Math.cos((angle * Math.PI) / 180)} y2={blockY + 18 - 54 * Math.sin((angle * Math.PI) / 180)} className="friction-arrow" markerEnd="url(#energy-arrow-red)" />
          <text x={blockX - 78} y={blockY + 6} className="force-label red">f</text>
        </>
      )}
      <text x="18" y="28" className="stage-title">{copy.stageTitle}</text>
      <text x="18" y="52" className="stage-note">s={state.distance.toFixed(1)}m  {copy.totalEnergyShort}={state.total.toFixed(1)}J</text>
    </svg>
  );
}

function EnergyBar({ label, value, max, color, fixed = false }: { label: string; value: number; max: number; color: string; fixed?: boolean }) {
  const percent = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div className="energy-bar-row">
      <span>{label}</span>
      <div className="energy-bar-track">
        <i style={{ width: `${percent}%`, background: color }} />
      </div>
      <strong className={fixed ? 'fixed' : ''}>{value.toFixed(1)} J</strong>
    </div>
  );
}

export function PhysicsEnergyConservationVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(ENERGY_COPY, locale);
  const [mass, setMass] = useState(2);
  const [height, setHeight] = useState(5);
  const [angle, setAngle] = useState(30);
  const [friction, setFriction] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const state = energyState(mass, height, angle, friction, progress);
  const isDissipative = friction > 0.01;
  const canSlide = state.acceleration > 0.01;
  const insight = !canSlide
    ? copy.insight.stuck
    : isDissipative
    ? copy.insight.dissipative
    : copy.insight.conserved;

  useEffect(() => {
    if (!isPlaying || !canSlide) return undefined;
    const startedAt = performance.now() - progress * 3600;
    const id = window.setInterval(() => {
      const next = (performance.now() - startedAt) / 3600;
      if (next >= 1) {
        setProgress(1);
        setIsPlaying(false);
      } else {
        setProgress(next);
      }
    }, 32);
    return () => window.clearInterval(id);
  }, [canSlide, isPlaying, progress]);

  const applyPreset = (preset: typeof ENERGY_PRESETS[number]) => {
    setMass(preset.mass);
    setHeight(preset.height);
    setAngle(preset.angle);
    setFriction(preset.friction);
    setProgress(0);
    setIsPlaying(false);
  };

  const reset = () => {
    setProgress(0);
    setIsPlaying(false);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page energy-page">
      <section className="special-visualizer-hero energy-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>
          {copy.back}
        </GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics" aria-label={copy.metricsAria}>
            <span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span>
            <span><Icon name="lucide:activity" />{copy.level}</span>
            <span><b>{state.mechanical.toFixed(1)}</b> J</span>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="energy-card" data-testid="energy-panel">
        <aside className="energy-side">
          <article className="energy-formula-card">
            <h2>{copy.coreFormulas}</h2>
            <MathContent text="$W=Fs\\cos\\theta$" />
            <MathContent text="$E_k=\\frac{1}{2}mv^2$" />
            <MathContent text="$E_p=mgh$" />
          </article>
          <article className="energy-data-card">
            <h2>{copy.energy}</h2>
            <EnergyBar label={copy.kinetic} value={state.kinetic} max={state.initialPotential} color="#3b82f6" />
            <EnergyBar label={copy.potential} value={state.potential} max={state.initialPotential} color="#22c55e" />
            <EnergyBar label={copy.mechanical} value={state.mechanical} max={state.initialPotential} color="#b7ef43" />
            <EnergyBar label={copy.dissipatedHeat} value={state.thermal} max={state.initialPotential} color="#ef4444" />
          </article>
          <article className="energy-insight">
            <h2>{copy.conservationCheck}</h2>
            <p>{insight}</p>
            <div className="energy-total-box">
              <span>{copy.totalEnergy}</span>
              <strong>{state.total.toFixed(1)} J</strong>
            </div>
          </article>
        </aside>

        <div className="energy-main">
          <div className="energy-stage">
            <EnergyInclineSvg mass={mass} height={height} angle={angle} friction={friction} progress={progress} state={state} copy={copy} />
          </div>
          <div className="energy-distribution">
            <h2>{copy.energyDistribution}</h2>
            <EnergyBar label="Ek" value={state.kinetic} max={state.initialPotential} color="#3b82f6" fixed />
            <EnergyBar label="Ep" value={state.potential} max={state.initialPotential} color="#22c55e" fixed />
            <EnergyBar label={copy.heat} value={state.thermal} max={state.initialPotential} color="#ef4444" fixed />
            <EnergyBar label={copy.total} value={state.total} max={state.initialPotential} color="#b7ef43" fixed />
          </div>
          <div className="energy-controls">
            <div className="kinematics-preset-row">
              {ENERGY_PRESETS.map((preset) => (
                <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>{copy.presets[preset.id]}</button>
              ))}
            </div>
            <div className="energy-slider-grid">
              <label><span>{copy.mass}</span><input aria-label={copy.massAria} type="range" min="0.5" max="5" step="0.1" value={mass} onChange={(event) => { setMass(Number(event.target.value)); setProgress(0); setIsPlaying(false); }} /><strong>{mass.toFixed(1)} kg</strong></label>
              <label><span>{copy.height}</span><input aria-label={copy.heightAria} type="range" min="1" max="8" step="0.2" value={height} onChange={(event) => { setHeight(Number(event.target.value)); setProgress(0); setIsPlaying(false); }} /><strong>{height.toFixed(1)} m</strong></label>
              <label><span>{copy.angle}</span><input aria-label={copy.angleAria} type="range" min="12" max="55" step="1" value={angle} onChange={(event) => { setAngle(Number(event.target.value)); setProgress(0); setIsPlaying(false); }} /><strong>{angle.toFixed(0)}°</strong></label>
              <label><span>{copy.friction}</span><input aria-label={copy.frictionAria} type="range" min="0" max="0.45" step="0.01" value={friction} onChange={(event) => { setFriction(Number(event.target.value)); setProgress(0); setIsPlaying(false); }} /><strong>{friction.toFixed(2)}</strong></label>
              <label className="wide"><span>{copy.position}</span><input aria-label={copy.positionAria} type="range" min="0" max="1" step="0.01" value={progress} onChange={(event) => { setProgress(Number(event.target.value)); setIsPlaying(false); }} /><strong>{(progress * 100).toFixed(0)}%</strong></label>
            </div>
            <div className="newton-action-row">
              <button type="button" className="primary" disabled={!canSlide} onClick={() => setIsPlaying((value) => !value)}>
                <Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{isPlaying ? copy.pause : copy.play}
              </button>
              <button type="button" onClick={reset}><Icon name="lucide:rotate-ccw" />{copy.reset}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article>
          <h2>{copy.coreFormula}</h2>
          <p><MathContent text="$E_k+E_p+E_{thermal}=constant$" /></p>
        </article>
        <article>
          <h2>{copy.relatedPractice}</h2>
          <p>{copy.relatedPracticeBody}</p>
          <GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.energyPractice}</GhostButton>
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

