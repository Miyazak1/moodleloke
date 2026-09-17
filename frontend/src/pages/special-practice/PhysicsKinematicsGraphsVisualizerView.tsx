import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

type KinematicsPresetId = 'speed-up' | 'constant' | 'brake' | 'reverse' | 'fall';
type AccelerationRelation = 'constant' | 'positive' | 'negative';

type KinematicsCopy = {
  presets: Record<KinematicsPresetId, string>;
  relation: Record<AccelerationRelation, string>;
  back: string;
  kicker: string;
  title: string;
  body: string;
  metricsAria: string;
  minuteUnit: string;
  level: string;
  practice: string;
  coreFormulas: string;
  liveData: string;
  readingTip: string;
  tips: string[];
  trackAria: string;
  motion: string;
  initialVelocityAria: string;
  accelerationAria: string;
  duration: string;
  durationAria: string;
  time: string;
  currentTimeAria: string;
  pause: string;
  play: string;
  reset: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  kinematicsPractice: string;
  formulaReference: string;
  formulaReferenceBody: string;
  openFormulas: string;
};

const KINEMATICS_COPY: LocalizedMap<KinematicsCopy> = {
  'zh-CN': {
    presets: {
      'speed-up': '加速运动',
      constant: '匀速运动',
      brake: '减速停止',
      reverse: '先停后反向',
      fall: '自由落体类比',
    },
    relation: {
      constant: '加速度为 0：速度保持不变，S-T 图像是一条直线。',
      positive: '加速度为正：V-T 图像斜率为正，位移增长越来越快。',
      negative: '加速度为负：速度逐渐减小，可能先停下再反向运动。',
    },
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 匀变速运动图像交互',
    title: '匀变速运动图像交互',
    body: '用同一条时间轴联动运动轨迹、实时数据和 S-T / V-T / A-T 图像，理解斜率、面积与位移的关系。',
    metricsAria: '运动学模拟信息',
    minuteUnit: '分钟',
    level: '基础',
    practice: '物理练习',
    coreFormulas: '核心公式',
    liveData: '实时数据',
    readingTip: '读图要点',
    tips: [
      'V-T 图像斜率就是加速度 a。',
      'V-T 图像与时间轴围成的有向面积等于位移。',
      'S-T 图像某点切线斜率等于瞬时速度。',
    ],
    trackAria: '运动轨迹',
    motion: '运动',
    initialVelocityAria: '初速度',
    accelerationAria: '加速度',
    duration: '总时长',
    durationAria: '总时长',
    time: '当前 t',
    currentTimeAria: '当前时间',
    pause: '暂停',
    play: '播放',
    reset: '重置',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '先用图像判断已知量和未知量，再选择最省步骤的运动学公式。',
    kinematicsPractice: '运动学',
    formulaReference: '查看公式',
    formulaReferenceBody: '回到物理公式表，把运动学和力学公式一起复盘。',
    openFormulas: '查看公式',
  },
  en: {
    presets: {
      'speed-up': 'Speeding up',
      constant: 'Constant velocity',
      brake: 'Braking to stop',
      reverse: 'Stop then reverse',
      fall: 'Free-fall analogy',
    },
    relation: {
      constant: 'Velocity is constant; the S-T graph is a straight line.',
      positive: 'Positive acceleration: the V-T slope is positive and displacement grows faster.',
      negative: 'Negative acceleration: velocity decreases and may reverse direction.',
    },
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Kinematics',
    title: 'Kinematics Graphs',
    body: 'Link position, velocity, and acceleration graphs through one motion timeline.',
    metricsAria: 'Kinematics simulation details',
    minuteUnit: 'min',
    level: 'Foundation',
    practice: 'Physics Practice',
    coreFormulas: 'Core Formulas',
    liveData: 'Live Data',
    readingTip: 'Reading Tip',
    tips: [
      'Slope of V-T equals acceleration.',
      'Area under V-T equals displacement.',
      'Slope of S-T at a point equals instantaneous velocity.',
    ],
    trackAria: 'Motion track',
    motion: 'Motion',
    initialVelocityAria: 'Initial velocity',
    accelerationAria: 'Acceleration',
    duration: 'Duration',
    durationAria: 'Duration',
    time: 'Time',
    currentTimeAria: 'Current time',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Use the graphs to decide which formula is fastest for a question.',
    kinematicsPractice: 'Kinematics Practice',
    formulaReference: 'Formula Reference',
    formulaReferenceBody: 'Review motion, force, energy, and momentum formulas together.',
    openFormulas: 'Open Formulas',
  },
};

KINEMATICS_COPY.vi = {
  ...KINEMATICS_COPY.en!,
  presets: {
    'speed-up': 'Nhanh dần',
    constant: 'Vận tốc không đổi',
    brake: 'Hãm đến dừng',
    reverse: 'Dừng rồi đổi chiều',
    fall: 'Tương tự rơi tự do',
  },
  relation: {
    constant: 'Vận tốc không đổi; đồ thị S-T là một đường thẳng.',
    positive: 'Gia tốc dương: độ dốc V-T dương và độ dời tăng nhanh hơn.',
    negative: 'Gia tốc âm: vận tốc giảm và có thể đổi chiều.',
  },
  back: '← Quay lại công thức Vật lý',
  kicker: 'Trang chủ / Vật lý / Công thức / Động học',
  title: 'Đồ thị động học',
  body: 'Liên kết đồ thị vị trí, vận tốc và gia tốc trên cùng một dòng thời gian chuyển động.',
  metricsAria: 'Chi tiết mô phỏng động học',
  minuteUnit: 'phút',
  level: 'Cơ bản',
  practice: 'Luyện Vật lý',
  coreFormulas: 'Công thức cốt lõi',
  liveData: 'Dữ liệu trực tiếp',
  readingTip: 'Mẹo đọc đồ thị',
  tips: [
    'Độ dốc của đồ thị V-T bằng gia tốc.',
    'Diện tích dưới đồ thị V-T bằng độ dời.',
    'Độ dốc của S-T tại một điểm bằng vận tốc tức thời.',
  ],
  trackAria: 'Quỹ đạo chuyển động',
  motion: 'Chuyển động',
  initialVelocityAria: 'Vận tốc ban đầu',
  accelerationAria: 'Gia tốc',
  duration: 'Thời lượng',
  durationAria: 'Thời lượng',
  time: 'Thời gian',
  currentTimeAria: 'Thời gian hiện tại',
  pause: 'Tạm dừng',
  play: 'Phát',
  reset: 'Đặt lại',
  coreFormula: 'Công thức cốt lõi',
  relatedPractice: 'Luyện tập liên quan',
  relatedPracticeBody: 'Dùng đồ thị để quyết định công thức nào nhanh nhất cho câu hỏi.',
  kinematicsPractice: 'Luyện động học',
  formulaReference: 'Bảng công thức',
  formulaReferenceBody: 'Ôn công thức chuyển động, lực, năng lượng và động lượng cùng nhau.',
  openFormulas: 'Mở công thức',
};

const KINEMATICS_PRESETS = [
  { id: 'speed-up', v0: 2, acceleration: 1, duration: 5 },
  { id: 'constant', v0: 3, acceleration: 0, duration: 5 },
  { id: 'brake', v0: 6, acceleration: -1.5, duration: 5 },
  { id: 'reverse', v0: 3, acceleration: -1.2, duration: 6 },
  { id: 'fall', v0: 0, acceleration: 9.8, duration: 3 }
] as const;

function subjectPath(subject: string) {
  return `${routes.cscaSubjects}/${subject}`;
}

function subjectFormulaPath(subject: string) {
  return `${routes.cscaSubjects}/${subject}/formulas`;
}

function formatNumber(value: number) {
  if (Math.abs(value) < 0.001) return '0';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function kinematicsAt(v0: number, acceleration: number, time: number) {
  return {
    displacement: v0 * time + 0.5 * acceleration * time ** 2,
    velocity: v0 + acceleration * time,
    acceleration
  };
}

function kinematicsSamples(v0: number, acceleration: number, duration: number) {
  return Array.from({ length: 81 }, (_, index) => {
    const time = (index / 80) * duration;
    return { time, ...kinematicsAt(v0, acceleration, time) };
  });
}

function KinematicsGraph({
  title,
  yLabel,
  color,
  samples,
  currentTime,
  duration,
  valueKey,
  area
}: {
  title: string;
  yLabel: string;
  color: string;
  samples: ReturnType<typeof kinematicsSamples>;
  currentTime: number;
  duration: number;
  valueKey: 'displacement' | 'velocity' | 'acceleration';
  area?: boolean;
}) {
  const width = 340;
  const height = 238;
  const left = 46;
  const right = 318;
  const top = 26;
  const bottom = 198;
  const values = samples.map((sample) => sample[valueKey]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const padding = Math.max((maxValue - minValue) * 0.12, 1);
  const yMin = minValue - padding;
  const yMax = maxValue + padding;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const xForTime = (time: number) => left + (time / duration) * plotWidth;
  const yForValue = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * plotHeight;
  const zeroY = yForValue(0);
  const path = samples.map((sample, index) => {
    const x = xForTime(sample.time);
    const y = yForValue(sample[valueKey]);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const current = kinematicsAt(samples[0]?.velocity ?? 0, samples[0]?.acceleration ?? 0, currentTime);
  const currentValue = current[valueKey];
  const currentX = xForTime(currentTime);
  const currentY = yForValue(currentValue);
  const areaPath = area
    ? `M ${left} ${zeroY.toFixed(2)} ${samples.filter((sample) => sample.time <= currentTime).map((sample) => `L ${xForTime(sample.time).toFixed(2)} ${yForValue(sample.velocity).toFixed(2)}`).join(' ')} L ${currentX.toFixed(2)} ${zeroY.toFixed(2)} Z`
    : '';

  return (
    <svg className="kinematics-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      <defs><pattern id={`kinematics-grid-${valueKey}`} width="45" height="34" patternUnits="userSpaceOnUse"><path d="M 45 0 L 0 0 0 34" /></pattern></defs>
      <rect x={left} y={top} width={plotWidth} height={plotHeight} className="grid-bg" />
      <line x1={left} y1={bottom} x2={right} y2={bottom} className="axis" />
      <line x1={left} y1={top} x2={left} y2={bottom} className="axis" />
      <line x1={left} y1={zeroY} x2={right} y2={zeroY} className="zero-line" />
      {area && <path d={areaPath} className="area-fill" />}
      <path d={path} className="curve" style={{ stroke: color }} />
      <line x1={currentX} y1={top} x2={currentX} y2={bottom} className="time-line" />
      <circle cx={currentX} cy={currentY} r="5.5" className="current-dot" style={{ fill: color }} />
      <text x={left} y={16} className="chart-title">{title}</text>
      <text x={left - 34} y={(top + bottom) / 2} className="axis-label rotate">{yLabel}</text>
      <text x={right - 20} y={bottom + 24} className="axis-label">t/s</text>
      <text x={left - 16} y={bottom + 4} className="axis-label">0</text>
      <text x={right - 12} y={bottom + 4} className="axis-label">{duration.toFixed(1)}</text>
      <text x={left - 38} y={top + 5} className="axis-label">{formatNumber(yMax)}</text>
      <text x={left - 38} y={bottom - 2} className="axis-label">{formatNumber(yMin)}</text>
    </svg>
  );
}

export function PhysicsKinematicsGraphsVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(KINEMATICS_COPY, locale);
  const [v0, setV0] = useState(2);
  const [acceleration, setAcceleration] = useState(1);
  const [duration, setDuration] = useState(5);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const samples = useMemo(() => kinematicsSamples(v0, acceleration, duration), [v0, acceleration, duration]);
  const state = kinematicsAt(v0, acceleration, time);
  const displacements = samples.map((sample) => sample.displacement);
  const minS = Math.min(0, ...displacements);
  const maxS = Math.max(0, ...displacements);
  const spanS = Math.max(maxS - minS, 1);
  const positionPercent = ((state.displacement - minS) / spanS) * 100;
  const zeroPercent = ((0 - minS) / spanS) * 100;
  const velocityDirection = state.velocity >= 0 ? 1 : -1;
  const arrowWidth = Math.min(96, 28 + Math.abs(state.velocity) * 9);
  const relation = Math.abs(acceleration) < 0.001
    ? copy.relation.constant
    : acceleration > 0
      ? copy.relation.positive
      : copy.relation.negative;

  useEffect(() => {
    if (!isPlaying) return undefined;
    const startedAt = performance.now() - time * 1000;
    const id = window.setInterval(() => {
      const next = (performance.now() - startedAt) / 1000;
      if (next >= duration) {
        setTime(duration);
        setIsPlaying(false);
      } else {
        setTime(next);
      }
    }, 32);
    return () => window.clearInterval(id);
  }, [duration, isPlaying, time]);

  const applyPreset = (preset: typeof KINEMATICS_PRESETS[number]) => {
    setV0(preset.v0);
    setAcceleration(preset.acceleration);
    setDuration(preset.duration);
    setTime(0);
    setIsPlaying(false);
  };

  const reset = () => {
    setTime(0);
    setIsPlaying(false);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page kinematics-page">
      <section className="special-visualizer-hero kinematics-hero">
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
            <span><b>{formatNumber(state.velocity)}</b> m/s</span>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="kinematics-card" data-testid="kinematics-panel">
        <aside className="kinematics-side">
          <article className="kinematics-formula-card">
            <h2>{copy.coreFormulas}</h2>
            <MathContent text="$s=v_0t+\\frac{1}{2}at^2$" />
            <MathContent text="$v=v_0+at$" />
            <MathContent text="$v^2=v_0^2+2as$" />
          </article>
          <article className="kinematics-data-card">
            <h2>{copy.liveData}</h2>
            <div><span>t</span><strong>{time.toFixed(2)} s</strong></div>
            <div><span>s</span><strong>{state.displacement.toFixed(2)} m</strong></div>
            <div><span>v</span><strong>{state.velocity.toFixed(2)} m/s</strong></div>
            <div><span>a</span><strong>{state.acceleration.toFixed(2)} m/s²</strong></div>
          </article>
          <article className="kinematics-insight">
            <h2>{copy.readingTip}</h2>
            <p>{relation}</p>
            <ul>
              {copy.tips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </article>
        </aside>

        <div className="kinematics-main">
          <div className="kinematics-track-panel" aria-label={copy.trackAria}>
            <div className="kinematics-track-labels">
              <span>{formatNumber(minS)} m</span>
              <strong>{copy.motion}</strong>
              <span>{formatNumber(maxS)} m</span>
            </div>
            <div className="kinematics-track">
              <i className="zero" style={{ left: `${zeroPercent}%` }} />
              <b className="runner" style={{ left: `${positionPercent}%` }} />
              <em
                className={velocityDirection >= 0 ? 'velocity-arrow forward' : 'velocity-arrow backward'}
                style={{
                  left: `${positionPercent}%`,
                  width: `${arrowWidth}px`,
                  transform: velocityDirection >= 0 ? 'translate(12px, -50%)' : `translate(calc(-100% - 12px), -50%)`
                } as CSSProperties}
              >
                v={state.velocity.toFixed(1)}
              </em>
            </div>
          </div>

          <div className="kinematics-graphs">
            <KinematicsGraph title="S-T" yLabel="s/m" color="#315dff" samples={samples} currentTime={time} duration={duration} valueKey="displacement" />
            <KinematicsGraph title="V-T" yLabel="v/(m/s)" color="#ef4444" samples={samples} currentTime={time} duration={duration} valueKey="velocity" area />
            <KinematicsGraph title="A-T" yLabel="a/(m/s²)" color="#16a34a" samples={samples} currentTime={time} duration={duration} valueKey="acceleration" />
          </div>

          <div className="kinematics-controls">
            <div className="kinematics-preset-row">
              {KINEMATICS_PRESETS.map((preset) => (
                <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>{copy.presets[preset.id]}</button>
              ))}
            </div>
            <div className="kinematics-slider-grid">
              <label><span>v₀</span><input aria-label={copy.initialVelocityAria} type="range" min="-6" max="8" step="0.2" value={v0} onChange={(event) => { setV0(Number(event.target.value)); setTime(0); setIsPlaying(false); }} /><strong>{v0.toFixed(1)} m/s</strong></label>
              <label><span>a</span><input aria-label={copy.accelerationAria} type="range" min="-4" max="10" step="0.1" value={acceleration} onChange={(event) => { setAcceleration(Number(event.target.value)); setTime(0); setIsPlaying(false); }} /><strong>{acceleration.toFixed(1)} m/s²</strong></label>
              <label><span>{copy.duration}</span><input aria-label={copy.durationAria} type="range" min="2" max="8" step="0.5" value={duration} onChange={(event) => { const next = Number(event.target.value); setDuration(next); setTime((current) => Math.min(current, next)); setIsPlaying(false); }} /><strong>{duration.toFixed(1)} s</strong></label>
              <label><span>{copy.time}</span><input aria-label={copy.currentTimeAria} type="range" min="0" max={duration} step="0.02" value={time} onChange={(event) => { setTime(Number(event.target.value)); setIsPlaying(false); }} /><strong>{time.toFixed(2)} s</strong></label>
            </div>
            <div className="newton-action-row">
              <button type="button" className="primary" onClick={() => setIsPlaying((value) => !value)}>
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
          <p><MathContent text="$s=v_0t+\\frac{1}{2}at^2$  $v=v_0+at$" /></p>
        </article>
        <article>
          <h2>{copy.relatedPractice}</h2>
          <p>{copy.relatedPracticeBody}</p>
          <GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.kinematicsPractice}</GhostButton>
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
