import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

type CollisionMode = 'elastic' | 'inelastic';
type MomentumPresetId = 'reference' | 'equal' | 'stick' | 'heavy-wall';
type CollisionPhase = 'before' | 'impact' | 'after';

type MomentumCopy = {
  presets: Record<MomentumPresetId, string>;
  mode: Record<CollisionMode, string>;
  phase: Record<CollisionPhase, string>;
  insight: Record<CollisionMode, string>;
  svgAria: string;
  trackTitle: string;
  impact: string;
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  coreFormulas: string;
  numbers: string;
  beforeCollision: string;
  afterCollision: string;
  totalMomentum: string;
  totalKineticEnergy: string;
  energyLoss: string;
  controls: string;
  type: string;
  pause: string;
  play: string;
  reset: string;
  momentumAndEnergy: string;
  before: string;
  after: string;
  momentum: string;
  kineticEnergy: string;
  object1: string;
  object2: string;
  total: string;
  conservationCheck: string;
  momentumDifference: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  momentumPractice: string;
  formulaReference: string;
  formulaReferenceBody: string;
  openFormulas: string;
};

const MOMENTUM_COPY: LocalizedMap<MomentumCopy> = {
  'zh-CN': {
    presets: {
      reference: '参考页默认',
      equal: '等质量交换',
      stick: '完全非弹性',
      'heavy-wall': '轻撞重',
    },
    mode: {
      elastic: '弹性碰撞',
      inelastic: '完全非弹性碰撞',
    },
    phase: {
      before: '碰撞前',
      impact: '碰撞中',
      after: '碰撞后',
    },
    insight: {
      elastic: '弹性碰撞中，总动量守恒，总动能也保持不变。',
      inelastic: '完全非弹性碰撞中，总动量守恒，但部分动能转化为形变和热。',
    },
    svgAria: '动量碰撞轨道',
    trackTitle: '碰撞轨道',
    impact: '碰撞',
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 动量与碰撞交互模拟',
    title: '动量与碰撞交互模拟',
    body: '设置两个物体的质量和速度，比较弹性碰撞与完全非弹性碰撞中的动量、速度和动能变化。',
    minuteUnit: '分钟',
    level: '基础',
    practice: '物理练习',
    coreFormulas: '公式',
    numbers: '数值',
    beforeCollision: '碰撞前',
    afterCollision: '碰撞后',
    totalMomentum: '总动量',
    totalKineticEnergy: '总动能',
    energyLoss: '能量损失',
    controls: '控制面板',
    type: '碰撞类型',
    pause: '暂停',
    play: '播放',
    reset: '重置',
    momentumAndEnergy: '动量与能量',
    before: '碰前',
    after: '碰后',
    momentum: '动量',
    kineticEnergy: '动能',
    object1: '物体1',
    object2: '物体2',
    total: '总计',
    conservationCheck: '守恒判断',
    momentumDifference: '总动量差',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '先判断系统动量是否守恒，再判断动能是否守恒。',
    momentumPractice: '动量与冲量',
    formulaReference: '查看公式',
    formulaReferenceBody: '回到公式表，把动量、冲量、动能和力学公式一起复盘。',
    openFormulas: '查看公式',
  },
  en: {
    presets: {
      reference: 'Reference default',
      equal: 'Equal masses',
      stick: 'Stick together',
      'heavy-wall': 'Light into heavy',
    },
    mode: {
      elastic: 'Elastic collision',
      inelastic: 'Perfectly inelastic collision',
    },
    phase: {
      before: 'Before collision',
      impact: 'Impact',
      after: 'After collision',
    },
    insight: {
      elastic: 'Elastic collision keeps total momentum and total kinetic energy unchanged.',
      inelastic: 'Perfectly inelastic collision keeps momentum but loses kinetic energy into deformation and heat.',
    },
    svgAria: 'Momentum collision track',
    trackTitle: 'Collision Track',
    impact: 'Impact',
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Momentum and Collision',
    title: 'Momentum and Collision Simulation',
    body: 'Compare elastic and perfectly inelastic collisions through momentum, velocity, and kinetic-energy changes.',
    minuteUnit: 'min',
    level: 'Foundation',
    practice: 'Physics Practice',
    coreFormulas: 'Core Formulas',
    numbers: 'Numbers',
    beforeCollision: 'Before collision',
    afterCollision: 'After collision',
    totalMomentum: 'Total p',
    totalKineticEnergy: 'Total Ek',
    energyLoss: 'Energy loss',
    controls: 'Controls',
    type: 'Type',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    momentumAndEnergy: 'Momentum and Energy',
    before: 'Before',
    after: 'After',
    momentum: 'Momentum',
    kineticEnergy: 'Kinetic Energy',
    object1: 'Object 1',
    object2: 'Object 2',
    total: 'Total',
    conservationCheck: 'Conservation Check',
    momentumDifference: 'Momentum difference',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Practice deciding whether kinetic energy is conserved after momentum is conserved.',
    momentumPractice: 'Momentum Practice',
    formulaReference: 'Formula Reference',
    formulaReferenceBody: 'Review momentum, impulse, kinetic energy, and mechanics formulas together.',
    openFormulas: 'Open Formulas',
  },
};
(MOMENTUM_COPY as any).vi = {
  ...MOMENTUM_COPY.en!,
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


const MOMENTUM_PRESETS = [
  { id: 'reference', m1: 3, v1: 5, m2: 2, v2: -3, mode: 'elastic' as CollisionMode },
  { id: 'equal', m1: 2, v1: 4, m2: 2, v2: 0, mode: 'elastic' as CollisionMode },
  { id: 'stick', m1: 3, v1: 5, m2: 2, v2: -3, mode: 'inelastic' as CollisionMode },
  { id: 'heavy-wall', m1: 1, v1: 6, m2: 5, v2: -0.5, mode: 'elastic' as CollisionMode }
] as const;

function subjectPath(subject: string) {
  return `${routes.cscaSubjects}/${subject}`;
}

function subjectFormulaPath(subject: string) {
  return `${routes.cscaSubjects}/${subject}/formulas`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function momentumState(m1: number, v1: number, m2: number, v2: number, mode: CollisionMode) {
  const totalMass = m1 + m2;
  const p1Before = m1 * v1;
  const p2Before = m2 * v2;
  const pTotalBefore = p1Before + p2Before;
  const k1Before = 0.5 * m1 * v1 * v1;
  const k2Before = 0.5 * m2 * v2 * v2;
  const kTotalBefore = k1Before + k2Before;
  const vCommon = pTotalBefore / totalMass;
  const v1After = mode === 'elastic' ? ((m1 - m2) / totalMass) * v1 + ((2 * m2) / totalMass) * v2 : vCommon;
  const v2After = mode === 'elastic' ? ((2 * m1) / totalMass) * v1 + ((m2 - m1) / totalMass) * v2 : vCommon;
  const p1After = m1 * v1After;
  const p2After = m2 * v2After;
  const pTotalAfter = p1After + p2After;
  const k1After = 0.5 * m1 * v1After * v1After;
  const k2After = 0.5 * m2 * v2After * v2After;
  const kTotalAfter = k1After + k2After;
  const energyLoss = Math.max(0, kTotalBefore - kTotalAfter);
  const lossPercent = kTotalBefore > 0 ? (energyLoss / kTotalBefore) * 100 : 0;
  return { v1After, v2After, p1Before, p2Before, pTotalBefore, p1After, p2After, pTotalAfter, k1Before, k2Before, kTotalBefore, k1After, k2After, kTotalAfter, energyLoss, lossPercent };
}

function collisionPositions(progress: number, mode: CollisionMode, state: ReturnType<typeof momentumState>) {
  const start1 = 150;
  const start2 = 610;
  const preEnd1 = 340;
  const preEnd2 = 420;
  const collisionX = 380;
  if (progress < 0.48) {
    const t = progress / 0.48;
    return { phase: 'before' as const, x1: start1 + (preEnd1 - start1) * t, x2: start2 + (preEnd2 - start2) * t };
  }
  if (progress < 0.58) return { phase: 'impact' as const, x1: preEnd1 + 16, x2: preEnd2 - 16 };
  const t = (progress - 0.58) / 0.42;
  if (mode === 'inelastic') {
    const direction = state.v1After >= 0 ? 1 : -1;
    const center = collisionX + direction * 120 * t;
    return { phase: 'after' as const, x1: center - 24, x2: center + 24 };
  }
  const x1 = collisionX + clampNumber(state.v1After * 28 * t, -210, 210);
  const x2 = collisionX + clampNumber(state.v2After * 28 * t, -210, 210);
  return { phase: 'after' as const, x1: x1 - 28, x2: x2 + 28 };
}

function MomentumArrow({ x, y, velocity, tone, label }: { x: number; y: number; velocity: number; tone: 'purple' | 'orange'; label: string }) {
  const direction = velocity >= 0 ? 1 : -1;
  const length = clampNumber(Math.abs(velocity) * 12, 24, 88);
  return (
    <g className={`momentum-velocity ${tone}`}>
      <line x1={x} y1={y} x2={x + direction * length} y2={y} markerEnd={`url(#momentum-arrow-${tone})`} />
      <text x={x + direction * (length + 8)} y={y - 7} textAnchor={direction > 0 ? 'start' : 'end'}>{label}</text>
    </g>
  );
}

function MomentumCollisionSvg({ m1, v1, m2, v2, mode, progress, state, copy }: { m1: number; v1: number; m2: number; v2: number; mode: CollisionMode; progress: number; state: ReturnType<typeof momentumState>; copy: MomentumCopy }) {
  const width = 760;
  const height = 330;
  const y = 220;
  const positions = collisionPositions(progress, mode, state);
  const after = positions.phase === 'after';
  const displayV1 = after ? state.v1After : v1;
  const displayV2 = after ? state.v2After : v2;
  const block1Width = 40 + m1 * 7;
  const block2Width = 40 + m2 * 7;

  return (
    <svg className="momentum-collision-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <defs>
        <marker id="momentum-arrow-purple" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#315dff" /></marker>
        <marker id="momentum-arrow-orange" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b7ef43" /></marker>
        <linearGradient id="momentum-bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#f1f5ff" /><stop offset="100%" stopColor="#f8fafc" /></linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} rx="14" fill="url(#momentum-bg)" />
      <text x="18" y="24" className="stage-title">{copy.trackTitle}</text>
      <text x="642" y="24" className="collision-mode-label">{copy.mode[mode]}</text>
      <line x1="60" y1={y + 38} x2="700" y2={y + 38} className="track" />
      {Array.from({ length: 11 }, (_, index) => <line key={index} x1={80 + index * 60} x2={80 + index * 60} y1={y + 38} y2={y + 48} className="tick" />)}
      <line x1="380" y1="74" x2="380" y2={y + 46} className="impact-guide" />
      <text x="380" y="68" className="impact-label">{copy.phase[positions.phase]}</text>
      <MomentumArrow x={positions.x1 + block1Width / 2 + 8} y={y - 10} velocity={displayV1} tone="purple" label={`${displayV1.toFixed(1)} m/s`} />
      <MomentumArrow x={positions.x2 - block2Width / 2 - 8} y={y - 10} velocity={displayV2} tone="orange" label={`${displayV2.toFixed(1)} m/s`} />
      <g transform={`translate(${positions.x1} ${y})`}><text x="0" y="-30" className="m1-label">m1</text><rect x={-block1Width / 2} y={-30} width={block1Width} height="50" rx="7" className="block-one" /><text x="0" y="0" className="block-text">{m1.toFixed(1)}kg</text></g>
      <g transform={`translate(${positions.x2} ${y})`}><text x="0" y="-30" className="m2-label">m2</text><rect x={-block2Width / 2} y={-30} width={block2Width} height="50" rx="7" className="block-two" /><text x="0" y="0" className="block-text">{m2.toFixed(1)}kg</text></g>
      {positions.phase === 'impact' && <g className="impact-flash"><path d="M365 168 l12 -20 l8 18 l16 -24 l-8 34 l12 4 l-22 10 l2 -20 z" /><text x="380" y="142">{copy.impact}</text></g>}
    </svg>
  );
}

function MomentumReadout({ color, label, value, unit }: { color: string; label: string; value: string; unit: string }) {
  return <div className="momentum-readout"><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong><em>{unit}</em></div>;
}

function MomentumBar({ label, before, after, max, color }: { label: string; before: number; after: number; max: number; color: string }) {
  const scale = Math.max(max, 1);
  return (
    <div className="momentum-bar-row">
      <span>{label}</span>
      <div className="momentum-bar-track">
        <i className="before" style={{ width: `${(Math.abs(before) / scale) * 100}%`, background: color }}><b>{before.toFixed(1)}</b></i>
        <i className="after" style={{ width: `${(Math.abs(after) / scale) * 100}%`, background: color }}><b>{after.toFixed(1)}</b></i>
      </div>
    </div>
  );
}

export function PhysicsMomentumCollisionVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(MOMENTUM_COPY, locale);
  const [m1, setM1] = useState(3);
  const [v1, setV1] = useState(5);
  const [m2, setM2] = useState(2);
  const [v2, setV2] = useState(-3);
  const [mode, setMode] = useState<CollisionMode>('elastic');
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const state = momentumState(m1, v1, m2, v2, mode);
  const maxMomentum = Math.max(Math.abs(state.p1Before), Math.abs(state.p2Before), Math.abs(state.p1After), Math.abs(state.p2After), Math.abs(state.pTotalBefore), 1);
  const maxEnergy = Math.max(state.k1Before, state.k2Before, state.k1After, state.k2After, state.kTotalBefore, 1);
  const insight = copy.insight[mode];

  useEffect(() => {
    if (!isPlaying) return undefined;
    const startedAt = performance.now() - progress * 3200;
    const id = window.setInterval(() => {
      const next = (performance.now() - startedAt) / 3200;
      if (next >= 1) {
        setProgress(1);
        setIsPlaying(false);
      } else {
        setProgress(next);
      }
    }, 32);
    return () => window.clearInterval(id);
  }, [isPlaying, progress]);

  const reset = () => { setProgress(0); setIsPlaying(false); };
  const stopForInput = () => { setProgress(0); setIsPlaying(false); };
  const applyPreset = (preset: typeof MOMENTUM_PRESETS[number]) => {
    setM1(preset.m1); setV1(preset.v1); setM2(preset.m2); setV2(preset.v2); setMode(preset.mode); stopForInput();
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page momentum-page">
      <section className="special-visualizer-hero momentum-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:activity" />{copy.level}</span><span><b>{state.pTotalAfter.toFixed(1)}</b> kg·m/s</span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="momentum-card" data-testid="momentum-panel">
        <aside className="momentum-side">
          <article className="momentum-formula-card"><h2>{copy.coreFormulas}</h2><MathContent text="$p=mv$" /><MathContent text="$m_1v_1+m_2v_2=m_1v_1^{\\prime}+m_2v_2^{\\prime}$" /><MathContent text="$E_k=\\frac{1}{2}mv^2$" /></article>
          <article className="momentum-data-card">
            <h2>{copy.numbers}</h2>
            <p>{copy.beforeCollision}</p>
            <MomentumReadout color="#315dff" label="p1" value={state.p1Before.toFixed(1)} unit="kg·m/s" /><MomentumReadout color="#b7ef43" label="p2" value={state.p2Before.toFixed(1)} unit="kg·m/s" /><MomentumReadout color="#13c7a3" label={copy.totalMomentum} value={state.pTotalBefore.toFixed(1)} unit="kg·m/s" /><MomentumReadout color="#087c66" label={copy.totalKineticEnergy} value={state.kTotalBefore.toFixed(1)} unit="J" />
            <p>{copy.afterCollision}</p>
            <MomentumReadout color="#818cf8" label="p1′" value={state.p1After.toFixed(1)} unit="kg·m/s" /><MomentumReadout color="#fbbf24" label="p2′" value={state.p2After.toFixed(1)} unit="kg·m/s" /><MomentumReadout color="#3b82f6" label={copy.totalMomentum} value={state.pTotalAfter.toFixed(1)} unit="kg·m/s" /><MomentumReadout color="#22c55e" label={copy.totalKineticEnergy} value={state.kTotalAfter.toFixed(1)} unit="J" /><MomentumReadout color="#ef4444" label={copy.energyLoss} value={state.lossPercent.toFixed(1)} unit="%" />
          </article>
          <article className="momentum-control-card">
            <h2>{copy.controls}</h2>
            <div className="momentum-slider-stack">
              <label><span>m1</span><input type="range" min="0.5" max="6" step="0.1" value={m1} onChange={(event) => { stopForInput(); setM1(Number(event.target.value)); }} /><strong>{m1.toFixed(1)} kg</strong></label>
              <label><span>v1</span><input type="range" min="-8" max="8" step="0.1" value={v1} onChange={(event) => { stopForInput(); setV1(Number(event.target.value)); }} /><strong>{v1.toFixed(1)} m/s</strong></label>
              <label><span>m2</span><input type="range" min="0.5" max="6" step="0.1" value={m2} onChange={(event) => { stopForInput(); setM2(Number(event.target.value)); }} /><strong>{m2.toFixed(1)} kg</strong></label>
              <label><span>v2</span><input type="range" min="-8" max="8" step="0.1" value={v2} onChange={(event) => { stopForInput(); setV2(Number(event.target.value)); }} /><strong>{v2.toFixed(1)} m/s</strong></label>
              <label><span>{copy.type}</span><select value={mode} onChange={(event) => { stopForInput(); setMode(event.target.value as CollisionMode); }}><option value="elastic">{copy.mode.elastic}</option><option value="inelastic">{copy.mode.inelastic}</option></select></label>
            </div>
            <div className="kinematics-preset-row">{MOMENTUM_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>{copy.presets[preset.id]}</button>)}</div>
            <div className="newton-action-row"><button type="button" className="primary" onClick={() => setIsPlaying((value) => !value)}><Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{isPlaying ? copy.pause : copy.play}</button><button type="button" onClick={reset}><Icon name="lucide:rotate-ccw" />{copy.reset}</button></div>
          </article>
        </aside>
        <div className="momentum-main">
          <div className="momentum-stage"><MomentumCollisionSvg m1={m1} v1={v1} m2={m2} v2={v2} mode={mode} progress={progress} state={state} copy={copy} /></div>
          <div className="momentum-chart-card">
            <div className="momentum-chart-head"><h2>{copy.momentumAndEnergy}</h2><span><i className="before" />{copy.before}</span><span><i className="after" />{copy.after}</span></div>
            <h3>{copy.momentum}</h3><MomentumBar label={copy.object1} before={state.p1Before} after={state.p1After} max={maxMomentum} color="#315dff" /><MomentumBar label={copy.object2} before={state.p2Before} after={state.p2After} max={maxMomentum} color="#b7ef43" /><MomentumBar label={copy.total} before={state.pTotalBefore} after={state.pTotalAfter} max={maxMomentum} color="#13c7a3" />
            <h3>{copy.kineticEnergy}</h3><MomentumBar label={copy.object1} before={state.k1Before} after={state.k1After} max={maxEnergy} color="#818cf8" /><MomentumBar label={copy.object2} before={state.k2Before} after={state.k2After} max={maxEnergy} color="#fbbf24" /><MomentumBar label={copy.total} before={state.kTotalBefore} after={state.kTotalAfter} max={maxEnergy} color="#22c55e" />
          </div>
          <div className="momentum-insight-card"><h2>{copy.conservationCheck}</h2><p>{insight}</p><strong>{copy.momentumDifference} {(state.pTotalAfter - state.pTotalBefore).toExponential(2)} kg·m/s</strong></div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$p=mv$  $m_1v_1+m_2v_2=m_1v_1^{\\prime}+m_2v_2^{\\prime}$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><p>{copy.relatedPracticeBody}</p><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.momentumPractice}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><p>{copy.formulaReferenceBody}</p><GhostButton onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.openFormulas}</GhostButton></article>
      </section>
    </div>
  );
}
