import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

type CircularPresetId = 'reference' | 'slow-wide' | 'fast-tight' | 'heavy';

type CircularCopy = {
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  coreFormulas: string;
  quantities: string;
  centripetalForce: string;
  centripetalAcceleration: string;
  angularVelocity: string;
  period: string;
  controls: string;
  mass: string;
  massAria: string;
  radius: string;
  radiusAria: string;
  linearSpeed: string;
  linearSpeedAria: string;
  presets: Record<CircularPresetId, string>;
  pause: string;
  play: string;
  reset: string;
  directionRule: string;
  directionRuleBody: string;
  whatChanges: string;
  whatChangesBody: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  circularMotionPractice: string;
  formulaReference: string;
  formulaReferenceBody: string;
  openFormulas: string;
};

const CIRCULAR_COPY: LocalizedMap<CircularCopy> = {
  'zh-CN': {
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 圆周运动交互模拟',
    title: '圆周运动交互模拟',
    body: '调节质量、半径和线速度，观察向心力、向心加速度、角速度与周期如何同步变化。',
    minuteUnit: '分钟',
    level: '基础',
    practice: '物理练习',
    coreFormulas: '公式',
    quantities: '物理量',
    centripetalForce: '向心力 Fc',
    centripetalAcceleration: '向心加速度 ac',
    angularVelocity: '角速度 ω',
    period: '周期 T',
    controls: '控制面板',
    mass: '质量 m',
    massAria: '质量',
    radius: '半径 r',
    radiusAria: '半径',
    linearSpeed: '线速度 v',
    linearSpeedAria: '线速度',
    presets: {
      reference: '参考页默认',
      'slow-wide': '大半径慢转',
      'fast-tight': '小半径快转',
      heavy: '质量增大',
    },
    pause: '暂停',
    play: '播放',
    reset: '重置',
    directionRule: '方向判断',
    directionRuleBody: '速度方向沿轨迹切线；向心加速度和向心力始终指向圆心。',
    whatChanges: '变量关系',
    whatChangesBody: '半径不变时，速度加倍会让向心力变为 4 倍；速度不变时，半径越大向心加速度越小。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '做圆周运动与万有引力题前，先用这个模型确认方向和变量关系。',
    circularMotionPractice: '圆周运动与万有引力',
    formulaReference: '查看公式',
    formulaReferenceBody: '回到公式表，把向心加速度、向心力和力学公式一起复盘。',
    openFormulas: '查看公式',
  },
  en: {
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Circular Motion',
    title: 'Circular Motion Interactive Simulation',
    body: 'Adjust mass, radius, and speed to connect centripetal force, acceleration, angular velocity, and period.',
    minuteUnit: 'min',
    level: 'Foundation',
    practice: 'Physics Practice',
    coreFormulas: 'Core Formulas',
    quantities: 'Quantities',
    centripetalForce: 'Centripetal force',
    centripetalAcceleration: 'Centripetal acceleration',
    angularVelocity: 'Angular velocity',
    period: 'Period',
    controls: 'Controls',
    mass: 'Mass m',
    massAria: 'Mass',
    radius: 'Radius r',
    radiusAria: 'Radius',
    linearSpeed: 'Linear speed v',
    linearSpeedAria: 'Linear speed',
    presets: {
      reference: 'Reference default',
      'slow-wide': 'Wide slow orbit',
      'fast-tight': 'Tight fast orbit',
      heavy: 'Heavier mass',
    },
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    directionRule: 'Direction Rule',
    directionRuleBody: 'Velocity is tangent to the circle. Centripetal acceleration and centripetal force always point toward the center.',
    whatChanges: 'What Changes',
    whatChangesBody: 'At fixed radius, doubling speed makes centripetal force four times larger. At fixed speed, a larger radius reduces acceleration.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Use this model before gravitation or circular-motion force-analysis problems.',
    circularMotionPractice: 'Circular Motion Practice',
    formulaReference: 'Formula Reference',
    formulaReferenceBody: 'Review centripetal acceleration, centripetal force, and mechanics formulas together.',
    openFormulas: 'Open Formulas',
  },
};
(CIRCULAR_COPY as any).vi = {
  ...CIRCULAR_COPY.en!,
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


function subjectPath(subject: string) {
  return routes.cscaSubjects + '/' + subject;
}

function subjectFormulaPath(subject: string) {
  return routes.cscaSubjects + '/' + subject + '/formulas';
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
const CIRCULAR_PRESETS = [
  { id: 'reference', mass: 2, radius: 1, speed: 5 },
  { id: 'slow-wide', mass: 1.5, radius: 1.8, speed: 3.2 },
  { id: 'fast-tight', mass: 1, radius: 0.65, speed: 5.8 },
  { id: 'heavy', mass: 4, radius: 1.2, speed: 4.5 }
] as const;

function circularState(mass: number, radius: number, speed: number) {
  const safeRadius = Math.max(radius, 0.1);
  const omega = speed / safeRadius;
  const acceleration = (speed * speed) / safeRadius;
  const force = mass * acceleration;
  const period = (2 * Math.PI) / Math.max(omega, 0.001);
  return { omega, acceleration, force, period };
}

function CircularMotionSvg({
  mass,
  radius,
  speed,
  angle,
  state
}: {
  mass: number;
  radius: number;
  speed: number;
  angle: number;
  state: ReturnType<typeof circularState>;
}) {
  const width = 760;
  const height = 420;
  const cx = 380;
  const cy = 216;
  const orbitRadius = radius * 100;
  const x = cx + orbitRadius * Math.cos(angle);
  const y = cy + orbitRadius * Math.sin(angle);
  const tx = -Math.sin(angle);
  const ty = Math.cos(angle);
  const rx = Math.cos(angle);
  const ry = Math.sin(angle);
  const velocityLength = clampNumber(34 + Math.abs(speed) * 8, 42, 100);
  const inwardLength = clampNumber(34 + state.acceleration * 1.7, 42, 105);
  const forceLength = clampNumber(34 + state.force * 1.05, 42, 110);
  const massRadius = clampNumber(18 + mass * 2.2, 20, 32);

  return (
    <svg className="circular-motion-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="圆周运动示意图">
      <defs>
        <marker id="circular-arrow-green" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
        </marker>
        <marker id="circular-arrow-red" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
        </marker>
        <marker id="circular-arrow-blue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
        </marker>
        <radialGradient id="circular-mass-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#315dff" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} rx="14" className="circular-bg" />
      <text x="18" y="24" className="stage-title">圆周运动</text>
      <g className="circular-legend">
        <rect x="640" y="32" width="10" height="10" className="legend-v" />
        <text x="658" y="41">v（速度）</text>
        <rect x="640" y="56" width="10" height="10" className="legend-a" />
        <text x="658" y="65">aᶜ（加速度）</text>
        <rect x="640" y="80" width="10" height="10" className="legend-f" />
        <text x="658" y="89">Fᶜ（向心力）</text>
      </g>
      <circle cx={cx} cy={cy} r={orbitRadius} className="orbit" />
      <line x1={cx} y1={cy} x2={x} y2={y} className="radius-line" />
      <circle cx={cx} cy={cy} r="4" className="center-dot" />
      <text x={cx - 9} y={cy + 22} className="center-label">O</text>
      <text x={(cx + x) / 2 + 8 * ry} y={(cy + y) / 2 - 8 * rx} className="radius-label">r</text>
      <line x1={x} y1={y} x2={x + tx * velocityLength} y2={y + ty * velocityLength} className="velocity-vector" markerEnd="url(#circular-arrow-green)" />
      <line x1={x} y1={y} x2={x - rx * inwardLength} y2={y - ry * inwardLength} className="acceleration-vector" markerEnd="url(#circular-arrow-red)" />
      <line x1={x} y1={y} x2={x - rx * forceLength} y2={y - ry * forceLength} className="force-vector" markerEnd="url(#circular-arrow-blue)" />
      <text x={x + tx * (velocityLength + 12)} y={y + ty * (velocityLength + 12)} className="vector-label green">v</text>
      <text x={x - rx * (inwardLength + 16)} y={y - ry * (inwardLength + 16)} className="vector-label red">aᶜ</text>
      <text x={x - rx * (forceLength + 18)} y={y - ry * (forceLength + 18) + 16} className="vector-label blue">Fᶜ</text>
      <circle cx={x} cy={y} r={massRadius} className="moving-mass" />
      <text x={x} y={y + 5} className="mass-label">{mass.toFixed(1)}kg</text>
      <text x="18" y="388" className="scale-note">比例: 100 px = 1.00 m</text>
    </svg>
  );
}

function CircularMetric({ color, label, value, unit }: { color: string; label: string; value: string; unit: string }) {
  return (
    <div className="circular-metric">
      <i style={{ background: color }} />
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{unit}</em>
    </div>
  );
}

export function PhysicsCircularMotionVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(CIRCULAR_COPY, locale);
  const [mass, setMass] = useState(2);
  const [radius, setRadius] = useState(1);
  const [speed, setSpeed] = useState(5);
  const [angle, setAngle] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const state = circularState(mass, radius, speed);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let previous = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = (now - previous) / 1000;
      previous = now;
      setAngle((current) => (current + state.omega * delta) % (Math.PI * 2));
    }, 32);
    return () => window.clearInterval(id);
  }, [isPlaying, state.omega]);

  const applyPreset = (preset: typeof CIRCULAR_PRESETS[number]) => {
    setMass(preset.mass);
    setRadius(preset.radius);
    setSpeed(preset.speed);
    setAngle(0);
    setIsPlaying(false);
  };

  const reset = () => {
    setAngle(0);
    setIsPlaying(false);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page circular-page">
      <section className="special-visualizer-hero circular-hero">
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
            <span><b>{state.force.toFixed(1)}</b> N</span>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="circular-card" data-testid="circular-panel">
        <aside className="circular-side">
          <article className="circular-formula-card">
            <h2>{copy.coreFormulas}</h2>
            <MathContent text="$F_c=\\frac{mv^2}{r}$" />
            <MathContent text="$a_c=\\frac{v^2}{r}=\\omega^2r$" />
            <MathContent text="$v=\\omega r,\\quad T=\\frac{2\\pi}{\\omega}$" />
          </article>
          <article className="circular-data-card">
            <h2>{copy.quantities}</h2>
            <CircularMetric color="#3b82f6" label={copy.centripetalForce} value={state.force.toFixed(1)} unit="N" />
            <CircularMetric color="#ef4444" label={copy.centripetalAcceleration} value={state.acceleration.toFixed(1)} unit="m/s²" />
            <CircularMetric color="#22c55e" label={copy.angularVelocity} value={state.omega.toFixed(2)} unit="rad/s" />
            <CircularMetric color="#b7ef43" label={copy.period} value={state.period.toFixed(3)} unit="s" />
          </article>
          <article className="circular-control-card">
            <h2>{copy.controls}</h2>
            <div className="circular-slider-stack">
              <label><span>{copy.mass}</span><input aria-label={copy.massAria} type="range" min="0.5" max="5" step="0.1" value={mass} onChange={(event) => setMass(Number(event.target.value))} /><strong>{mass.toFixed(1)} kg</strong></label>
              <label><span>{copy.radius}</span><input aria-label={copy.radiusAria} type="range" min="0.5" max="2" step="0.05" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /><strong>{Math.round(radius * 100)} px（{radius.toFixed(2)} m）</strong></label>
              <label><span>{copy.linearSpeed}</span><input aria-label={copy.linearSpeedAria} type="range" min="1" max="8" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><strong>{speed.toFixed(1)} m/s</strong></label>
            </div>
            <div className="kinematics-preset-row">
              {CIRCULAR_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>{copy.presets[preset.id]}</button>)}
            </div>
            <div className="newton-action-row">
              <button type="button" className="primary" onClick={() => setIsPlaying((value) => !value)}>
                <Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{isPlaying ? copy.pause : copy.play}
              </button>
              <button type="button" onClick={reset}><Icon name="lucide:rotate-ccw" />{copy.reset}</button>
            </div>
          </article>
        </aside>

        <div className="circular-main">
          <div className="circular-stage">
            <CircularMotionSvg mass={mass} radius={radius} speed={speed} angle={angle} state={state} />
          </div>
          <div className="circular-explain-card">
            <article>
              <h2>{copy.directionRule}</h2>
              <p>{copy.directionRuleBody}</p>
            </article>
            <article>
              <h2>{copy.whatChanges}</h2>
              <p>{copy.whatChangesBody}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article>
          <h2>{copy.coreFormula}</h2>
          <p><MathContent text="$F_c=\\frac{mv^2}{r}$  $a_c=\\omega^2r$  $v=\\omega r$" /></p>
        </article>
        <article>
          <h2>{copy.relatedPractice}</h2>
          <p>{copy.relatedPracticeBody}</p>
          <GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.circularMotionPractice}</GhostButton>
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


