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

type MagneticFieldDirection = 'into' | 'out';

type MagneticCopy = {
  svgAria: string;
  stageTitle: string;
  fieldDirection: Record<MagneticFieldDirection, string>;
  motionDirection: Record<'clockwise' | 'counterclockwise', string>;
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  formulas: string;
  physicalQuantities: string;
  lorentzForce: string;
  radius: string;
  period: string;
  controls: string;
  chargeMagnitude: string;
  positive: string;
  negative: string;
  mass: string;
  speed: string;
  field: string;
  fieldDirectionLabel: string;
  intoPage: string;
  outOfPage: string;
  pause: string;
  play: string;
  reset: string;
  directionRule: string;
  directionRuleBody: string;
  currentMotion: string;
  clockwiseMotionBody: string;
  counterclockwiseMotionBody: string;
  coreFormula: string;
  relatedPractice: string;
  magneticFields: string;
  formulaReference: string;
  viewFormulas: string;
};

const MAGNETIC_COPY: LocalizedMap<MagneticCopy> = {
  'zh-CN': {
    svgAria: '磁场中带电粒子圆周运动',
    stageTitle: '磁场',
    fieldDirection: {
      into: '向纸面内',
      out: '向纸面外',
    },
    motionDirection: {
      clockwise: '顺时针',
      counterclockwise: '逆时针',
    },
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 磁场中带电粒子运动模拟',
    title: '磁场中带电粒子运动模拟',
    body: '调节电荷、质量、速度和磁场，观察洛伦兹力如何提供向心力并形成圆周运动。',
    minuteUnit: '分钟',
    level: '中级',
    practice: '物理练习',
    formulas: '公式',
    physicalQuantities: '物理量',
    lorentzForce: '洛伦兹力 F',
    radius: '半径 r',
    period: '周期 T',
    controls: '控制面板',
    chargeMagnitude: '电荷量 |q|',
    positive: '正电荷',
    negative: '负电荷',
    mass: '质量 m',
    speed: '速度 v',
    field: '磁感应强度 B',
    fieldDirectionLabel: '磁场方向',
    intoPage: '向纸面内',
    outOfPage: '向纸面外',
    pause: '暂停',
    play: '播放',
    reset: '重置',
    directionRule: '方向判断',
    directionRuleBody: '正电荷按右手定则判断洛伦兹力方向；负电荷受力方向与右手定则结果相反。',
    currentMotion: '当前运动',
    clockwiseMotionBody: '粒子做顺时针圆周运动，洛伦兹力始终指向圆心。',
    counterclockwiseMotionBody: '粒子做逆时针圆周运动，洛伦兹力始终指向圆心。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    magneticFields: '磁场',
    formulaReference: '查看公式',
    viewFormulas: '查看公式',
  },
  en: {
    svgAria: 'Charged particle circular motion in a magnetic field',
    stageTitle: 'Magnetic field',
    fieldDirection: {
      into: 'into page',
      out: 'out of page',
    },
    motionDirection: {
      clockwise: 'clockwise',
      counterclockwise: 'counterclockwise',
    },
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Magnetic Force',
    title: 'Charged Particle in a Magnetic Field',
    body: 'Adjust charge, mass, speed, and magnetic field to observe Lorentz force and circular motion.',
    minuteUnit: 'min',
    level: 'Intermediate',
    practice: 'Physics Practice',
    formulas: 'Formulas',
    physicalQuantities: 'Physical Quantities',
    lorentzForce: 'Lorentz force F',
    radius: 'Radius r',
    period: 'Period T',
    controls: 'Controls',
    chargeMagnitude: '|q|',
    positive: 'positive',
    negative: 'negative',
    mass: 'Mass m',
    speed: 'Speed v',
    field: 'Field B',
    fieldDirectionLabel: 'Magnetic field direction',
    intoPage: 'into page',
    outOfPage: 'out of page',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    directionRule: 'Direction Rule',
    directionRuleBody: 'For positive charge, use the right-hand rule. Negative charge reverses the Lorentz-force direction.',
    currentMotion: 'Current Motion',
    clockwiseMotionBody: 'The particle moves clockwise because the force always points toward the center.',
    counterclockwiseMotionBody: 'The particle moves counterclockwise because the force always points toward the center.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    magneticFields: 'Magnetic Fields',
    formulaReference: 'Formula Reference',
    viewFormulas: 'View Formulas',
  },
};
(MAGNETIC_COPY as any).vi = {
  ...MAGNETIC_COPY.en!,
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


function magneticForceState(qMicro: number, chargeSign: 1 | -1, massMicro: number, velocity: number, magneticField: number, fieldDirection: MagneticFieldDirection) {
  const qAbs = qMicro * 1e-6;
  const mass = massMicro * 1e-6;
  const b = Math.max(magneticField, 0.05);
  const force = qAbs * velocity * b;
  const radius = mass * velocity / Math.max(qAbs * b, 1e-12);
  const period = (2 * Math.PI * mass) / Math.max(qAbs * b, 1e-12);
  const fieldSign = fieldDirection === 'into' ? -1 : 1;
  const clockwise = chargeSign * fieldSign < 0;
  return { qAbs, mass, force, radius, period, clockwise };
}

function MagneticForceSvg({ qMicro, chargeSign, massMicro, velocity, magneticField, fieldDirection, phase, state, copy }: { qMicro: number; chargeSign: 1 | -1; massMicro: number; velocity: number; magneticField: number; fieldDirection: MagneticFieldDirection; phase: number; state: ReturnType<typeof magneticForceState>; copy: MagneticCopy }) {
  const width = 760;
  const height = 430;
  const cx = 385;
  const cy = 222;
  const visualRadius = clampNumber(state.radius * 26, 58, 150);
  const direction = state.clockwise ? 1 : -1;
  const angle = direction * phase;
  const px = cx + visualRadius * Math.cos(angle);
  const py = cy + visualRadius * Math.sin(angle);
  const tangent = angle + direction * Math.PI / 2;
  const vLength = clampNumber(velocity * 15, 34, 92);
  const vx = Math.cos(tangent) * vLength;
  const vy = Math.sin(tangent) * vLength;
  const fx = (cx - px);
  const fy = (cy - py);
  const fNorm = Math.max(Math.hypot(fx, fy), 1);
  const fLength = 58;
  const fEndX = px + (fx / fNorm) * fLength;
  const fEndY = py + (fy / fNorm) * fLength;
  const chargeColor = chargeSign > 0 ? '#ff715e' : '#315dff';
  const fieldSymbols = Array.from({ length: 96 }, (_, index) => {
    const col = index % 16;
    const row = Math.floor(index / 16);
    return { x: 52 + col * 43, y: 58 + row * 47 };
  });

  return (
    <svg className="magnetic-field-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.svgAria}>
      <defs>
        <marker id="magnetic-arrow-red" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" /></marker>
        <marker id="magnetic-arrow-green" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" /></marker>
      </defs>
      <rect width={width} height={height} rx="14" className="magnetic-bg" />
      <text x="16" y="24" className="stage-title">{copy.stageTitle}</text>
      <g className="field-symbols">
        {fieldSymbols.map((point, index) => fieldDirection === 'into' ? (
          <g key={index} transform={`translate(${point.x} ${point.y})`}><circle r="6" /><path d="M-3 -3 L3 3 M3 -3 L-3 3" /></g>
        ) : (
          <g key={index} transform={`translate(${point.x} ${point.y})`}><circle r="6" /><circle r="2" /></g>
        ))}
      </g>
      <circle cx={cx} cy={cy} r={visualRadius} className="magnetic-orbit" />
      <line x1={cx} y1={cy} x2={px} y2={py} className="magnetic-radius-line" />
      <text x={cx + (px - cx) * 0.38} y={cy + (py - cy) * 0.38 - 14} className="radius-label">r = {state.radius.toFixed(3)} m</text>
      <circle cx={cx} cy={cy} r="3.5" className="magnetic-center" />
      <text x={cx - 14} y={cy + 18} className="center-label">O</text>
      <line x1={px} y1={py} x2={px + vx} y2={py + vy} className="velocity-vector" markerEnd="url(#magnetic-arrow-green)" />
      <text x={px + vx + 8} y={py + vy + 4} className="vector-label green">v</text>
      <line x1={px} y1={py} x2={fEndX} y2={fEndY} className="lorentz-vector" markerEnd="url(#magnetic-arrow-red)" />
      <text x={fEndX + 8} y={fEndY + 4} className="vector-label red">F</text>
      <g className="charge-particle" transform={`translate(${px} ${py})`}>
        <circle r="13" fill={chargeColor} />
        <text y="5">{chargeSign > 0 ? '+' : '-'}</text>
      </g>
      <text x="652" y="28" className="field-readout">B = {magneticField.toFixed(1)} T</text>
      <text x="652" y="46" className="field-readout small">{copy.fieldDirection[fieldDirection]} · {copy.motionDirection[state.clockwise ? 'clockwise' : 'counterclockwise']}</text>
    </svg>
  );
}

function MagneticMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="magnetic-metric"><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}

export function PhysicsMagneticForceVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(MAGNETIC_COPY, locale);
  const [qMicro, setQMicro] = useState(5);
  const [chargeSign, setChargeSign] = useState<1 | -1>(1);
  const [massMicro, setMassMicro] = useState(5);
  const [velocity, setVelocity] = useState(5);
  const [magneticField, setMagneticField] = useState(1);
  const [fieldDirection, setFieldDirection] = useState<MagneticFieldDirection>('into');
  const [phase, setPhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const state = magneticForceState(qMicro, chargeSign, massMicro, velocity, magneticField, fieldDirection);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const startedAt = performance.now() - (phase / (Math.PI * 2)) * state.period * 1000;
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setPhase(((elapsed / state.period) * Math.PI * 2) % (Math.PI * 2));
    }, 32);
    return () => window.clearInterval(id);
  }, [isPlaying, state.period]);

  const reset = () => {
    setPhase(0);
    setIsPlaying(false);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page magnetic-page">
      <section className="special-visualizer-hero magnetic-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:bar-chart-3" />{copy.level}</span><span><b>{state.radius.toFixed(3)}</b> m</span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="magnetic-card" data-testid="magnetic-panel">
        <aside className="magnetic-side">
          <article className="magnetic-formula-card">
            <h2>{copy.formulas}</h2>
            <MathContent text="$F=qvB$" />
            <MathContent text="$r=\\frac{mv}{qB}$" />
            <MathContent text="$T=\\frac{2\\pi m}{qB}$" />
          </article>
          <article className="magnetic-data-card">
            <h2>{copy.physicalQuantities}</h2>
            <MagneticMetric color="#ef4444" label={copy.lorentzForce} value={`${(state.force * 1e6).toFixed(1)} μN`} />
            <MagneticMetric color="#3b82f6" label={copy.radius} value={`${state.radius.toFixed(3)} m`} />
            <MagneticMetric color="#b7ef43" label={copy.period} value={`${state.period.toFixed(4)} s`} />
          </article>
          <article className="magnetic-control-card">
            <h2>{copy.controls}</h2>
            <div className="magnetic-slider-stack">
              <label><span>{copy.chargeMagnitude}</span><input type="range" min="1" max="10" step="0.5" value={qMicro} onChange={(event) => setQMicro(Number(event.target.value))} /><strong>{qMicro.toFixed(1)} μC</strong></label>
              <div className="magnetic-segments"><button type="button" className={chargeSign > 0 ? 'active' : ''} onClick={() => setChargeSign(1)}>+ {copy.positive}</button><button type="button" className={chargeSign < 0 ? 'active' : ''} onClick={() => setChargeSign(-1)}>- {copy.negative}</button></div>
              <label><span>{copy.mass}</span><input type="range" min="1" max="10" step="0.5" value={massMicro} onChange={(event) => setMassMicro(Number(event.target.value))} /><strong>{massMicro.toFixed(1)}×10⁻⁶ kg</strong></label>
              <label><span>{copy.speed}</span><input type="range" min="1" max="10" step="0.5" value={velocity} onChange={(event) => setVelocity(Number(event.target.value))} /><strong>{velocity.toFixed(1)} m/s</strong></label>
              <label><span>{copy.field}</span><input type="range" min="0.2" max="2" step="0.1" value={magneticField} onChange={(event) => setMagneticField(Number(event.target.value))} /><strong>{magneticField.toFixed(1)} T</strong></label>
              <span>{copy.fieldDirectionLabel}</span>
              <div className="magnetic-segments"><button type="button" className={fieldDirection === 'into' ? 'active' : ''} onClick={() => setFieldDirection('into')}>⊗ {copy.intoPage}</button><button type="button" className={fieldDirection === 'out' ? 'active' : ''} onClick={() => setFieldDirection('out')}>⊙ {copy.outOfPage}</button></div>
            </div>
            <div className="newton-action-row"><button type="button" className="primary" onClick={() => setIsPlaying((value) => !value)}><Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{isPlaying ? copy.pause : copy.play}</button><button type="button" onClick={reset}><Icon name="lucide:rotate-ccw" />{copy.reset}</button></div>
          </article>
        </aside>
        <div className="magnetic-main">
          <div className="magnetic-stage"><MagneticForceSvg qMicro={qMicro} chargeSign={chargeSign} massMicro={massMicro} velocity={velocity} magneticField={magneticField} fieldDirection={fieldDirection} phase={phase} state={state} copy={copy} /></div>
          <div className="magnetic-explain-card">
            <article><h2>{copy.directionRule}</h2><p>{copy.directionRuleBody}</p></article>
            <article><h2>{copy.currentMotion}</h2><p>{state.clockwise ? copy.clockwiseMotionBody : copy.counterclockwiseMotionBody}</p></article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$F=qvB$  $r=\\frac{mv}{qB}$  $T=\\frac{2\\pi m}{qB}$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.magneticFields}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('physics'))}><Icon name="lucide:book-open" />{copy.viewFormulas}</GhostButton></article>
      </section>
    </div>
  );
}
