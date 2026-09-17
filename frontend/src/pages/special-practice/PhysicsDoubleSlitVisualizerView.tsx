import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

type DoubleSlitCopy = {
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  formulas: string;
  results: string;
  fringeSpacing: string;
  centralBright: string;
  firstBright: string;
  wavelength: string;
  controls: string;
  wavelengthControl: string;
  slitDistance: string;
  screenDistance: string;
  orders: string;
  currentPattern: string;
  currentPatternBody: string;
  modelNote: string;
  modelNoteBody: string;
  coreFormula: string;
  relatedPractice: string;
  physicalOptics: string;
  formulaReference: string;
  viewFormulas: string;
};

const DOUBLE_SLIT_COPY: LocalizedMap<DoubleSlitCopy> = {
  'zh-CN': {
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 波动光学双缝干涉模拟',
    title: '波动光学双缝干涉模拟',
    body: '调节波长、缝间距和屏距，观察杨氏双缝干涉条纹和光强分布变化。',
    minuteUnit: '分钟',
    level: '中级',
    practice: '物理练习',
    formulas: '公式',
    results: '结果',
    fringeSpacing: '条纹间距',
    centralBright: '中央明纹 (n=0)',
    firstBright: '一级明纹 (n=1)',
    wavelength: '波长',
    controls: '控制面板',
    wavelengthControl: '波长 λ',
    slitDistance: '缝间距 d',
    screenDistance: '屏距 L',
    orders: '显示级次',
    currentPattern: '当前条纹',
    currentPatternBody: '波长或屏距增大时条纹变宽；缝间距增大时条纹变窄。',
    modelNote: '模型说明',
    modelNoteBody: '这里采用理想等强双缝模型，暂不叠加单缝衍射包络。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    physicalOptics: '物理光学',
    formulaReference: '查看公式',
    viewFormulas: '查看公式',
  },
  en: {
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Double Slit',
    title: 'Double-Slit Interference Simulation',
    body: 'Adjust wavelength, slit separation, and screen distance to observe interference fringes.',
    minuteUnit: 'min',
    level: 'Intermediate',
    practice: 'Physics Practice',
    formulas: 'Formulas',
    results: 'Results',
    fringeSpacing: 'Fringe spacing',
    centralBright: 'Central bright',
    firstBright: 'First bright',
    wavelength: 'Wavelength',
    controls: 'Controls',
    wavelengthControl: 'Wavelength λ',
    slitDistance: 'Slit distance d',
    screenDistance: 'Screen distance L',
    orders: 'Orders',
    currentPattern: 'Current Pattern',
    currentPatternBody: 'Increasing wavelength or screen distance widens the fringes; increasing slit separation narrows them.',
    modelNote: 'Model Note',
    modelNoteBody: 'This is an ideal equal-intensity double-slit model without the single-slit diffraction envelope.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    physicalOptics: 'Physical Optics',
    formulaReference: 'Formula Reference',
    viewFormulas: 'View Formulas',
  },
};
(DOUBLE_SLIT_COPY as any).vi = {
  ...DOUBLE_SLIT_COPY.en!,
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

function wavelengthToColor(wavelengthNm: number) {
  if (wavelengthNm < 450) return '#7c3aed';
  if (wavelengthNm < 495) return '#315dff';
  if (wavelengthNm < 570) return '#84cc16';
  if (wavelengthNm < 590) return '#facc15';
  if (wavelengthNm < 620) return '#f97316';
  return '#ef4444';
}

function doubleSlitState(wavelengthNm: number, slitDistanceMm: number, screenDistanceM: number) {
  const spacingMm = (wavelengthNm * 1e-9 * screenDistanceM / (slitDistanceMm * 1e-3)) * 1000;
  return { spacingMm, color: wavelengthToColor(wavelengthNm) };
}

function DoubleSlitSvg({ wavelengthNm, slitDistanceMm, screenDistanceM, orderCount, state }: { wavelengthNm: number; slitDistanceMm: number; screenDistanceM: number; orderCount: number; state: ReturnType<typeof doubleSlitState> }) {
  const width = 780;
  const height = 390;
  const source = { x: 72, y: 198 };
  const barrierX = 300;
  const screenX = 500;
  const chartX = 560;
  const centerY = 198;
  const slitGapPx = clampNumber(slitDistanceMm * 78, 24, 84);
  const fringeScale = clampNumber(state.spacingMm * 42, 18, 78);
  const orders = Array.from({ length: orderCount * 2 + 1 }, (_, index) => index - orderCount);
  const waveColor = state.color;
  const intensityPath = Array.from({ length: 140 }, (_, index) => {
    const y = 42 + index * (306 / 139);
    const displacementMm = (y - centerY) / 42;
    const phase = Math.PI * displacementMm / Math.max(state.spacingMm, 0.001);
    const intensity = Math.cos(phase) ** 2;
    const x = chartX + 16 + intensity * 122;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="double-slit-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="杨氏双缝干涉实验">
      <defs>
        <filter id="double-slit-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={width} height={height} rx="14" className="experiment-bg" />
      <text x="16" y="24" className="stage-title">双缝干涉实验</text>
      <g className="light-source" filter="url(#double-slit-glow)">
        <circle cx={source.x} cy={source.y} r="8" fill={waveColor} />
        <text x={source.x - 12} y={source.y + 28}>光源</text>
      </g>
      <g className="double-slit-barrier">
        <rect x={barrierX - 4} y="52" width="8" height="286" rx="2" />
        <rect x={barrierX - 8} y={centerY - slitGapPx / 2 - 8} width="16" height="16" rx="2" />
        <rect x={barrierX - 8} y={centerY + slitGapPx / 2 - 8} width="16" height="16" rx="2" />
        <text x={barrierX - 12} y="352">挡板</text>
        <line x1={barrierX + 20} x2={barrierX + 20} y1={centerY - slitGapPx / 2} y2={centerY + slitGapPx / 2} />
        <text x={barrierX + 28} y={centerY + 4}>d</text>
      </g>
      <g className="slit-rays">
        {[centerY - slitGapPx / 2, centerY + slitGapPx / 2].map((slitY, slitIndex) => (
          <g key={slitIndex}>
            <line x1={source.x} y1={source.y} x2={barrierX} y2={slitY} className="incoming" />
            {orders.map((order) => {
              const targetY = centerY + order * fringeScale;
              if (targetY < 44 || targetY > 346) return null;
              return <line key={order} x1={barrierX} y1={slitY} x2={screenX} y2={targetY} className={order === 0 ? 'central' : 'diffracted'} />;
            })}
          </g>
        ))}
      </g>
      <line x1={barrierX} y1="352" x2={screenX} y2="352" className="distance-line" />
      <text x={(barrierX + screenX) / 2} y="345" className="distance-label">L</text>
      <g className="screen">
        <rect x={screenX - 9} y="44" width="18" height="304" rx="2" />
        {orders.map((order) => {
          const y = centerY + order * fringeScale;
          if (y < 46 || y > 346) return null;
          const bright = order === 0 ? 1 : Math.max(0.25, 1 - Math.abs(order) * 0.08);
          return (
            <g key={order}>
              <rect x={screenX - 9} y={y - 8} width="18" height="16" fill={waveColor} opacity={bright} />
              <text x={screenX + 24} y={y + 4}>n={order === 0 ? '0' : order > 0 ? `+${order}` : order}</text>
            </g>
          );
        })}
        <text x={screenX - 10} y="366">屏幕</text>
      </g>
      <g className="fringe-spacing">
        <line x1={screenX + 56} x2={screenX + 56} y1={centerY} y2={centerY - fringeScale} />
        <line x1={screenX + 48} x2={screenX + 64} y1={centerY} y2={centerY} />
        <line x1={screenX + 48} x2={screenX + 64} y1={centerY - fringeScale} y2={centerY - fringeScale} />
        <text x={screenX + 66} y={centerY - fringeScale / 2 + 4}>Δx</text>
      </g>
      <g className="intensity-chart">
        <text x={chartX + 64} y="34">光强分布</text>
        <path d={intensityPath} />
      </g>
    </svg>
  );
}

function DoubleSlitMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="double-slit-metric"><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}

export function PhysicsDoubleSlitVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(DOUBLE_SLIT_COPY, locale);
  const [wavelengthNm, setWavelengthNm] = useState(550);
  const [slitDistanceMm, setSlitDistanceMm] = useState(0.5);
  const [screenDistanceM, setScreenDistanceM] = useState(1.5);
  const [orderCount, setOrderCount] = useState(5);
  const state = doubleSlitState(wavelengthNm, slitDistanceMm, screenDistanceM);

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page double-slit-page">
      <section className="special-visualizer-hero double-slit-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:bar-chart-3" />{copy.level}</span><span><b>{state.spacingMm.toFixed(3)}</b> mm</span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="double-slit-card" data-testid="double-slit-panel">
        <aside className="double-slit-side">
          <article className="double-slit-formula-card">
            <h2>{copy.formulas}</h2>
            <MathContent text="$d\\sin\\theta=n\\lambda$" />
            <MathContent text="$\\Delta x=\\frac{\\lambda L}{d}$" />
            <MathContent text="$I=I_0\\cos^2\\left(\\frac{\\pi d\\sin\\theta}{\\lambda}\\right)$" />
          </article>
          <article className="double-slit-data-card">
            <h2>{copy.results}</h2>
            <DoubleSlitMetric color="#3b82f6" label={copy.fringeSpacing} value={`${state.spacingMm.toFixed(3)} mm`} />
            <DoubleSlitMetric color="#22c55e" label={copy.centralBright} value="y = 0 mm" />
            <DoubleSlitMetric color="#b7ef43" label={copy.firstBright} value={`${state.spacingMm.toFixed(3)} mm`} />
            <DoubleSlitMetric color={state.color} label={copy.wavelength} value={`${wavelengthNm.toFixed(0)} nm`} />
          </article>
          <article className="double-slit-control-card">
            <h2>{copy.controls}</h2>
            <div className="double-slit-slider-stack">
              <label><span>{copy.wavelengthControl}</span><input type="range" min="400" max="700" step="5" value={wavelengthNm} onChange={(event) => setWavelengthNm(Number(event.target.value))} /><strong>{wavelengthNm.toFixed(0)} nm <i style={{ background: state.color }} /></strong></label>
              <label><span>{copy.slitDistance}</span><input type="range" min="0.2" max="1" step="0.01" value={slitDistanceMm} onChange={(event) => setSlitDistanceMm(Number(event.target.value))} /><strong>{slitDistanceMm.toFixed(2)} mm</strong></label>
              <label><span>{copy.screenDistance}</span><input type="range" min="0.5" max="3" step="0.1" value={screenDistanceM} onChange={(event) => setScreenDistanceM(Number(event.target.value))} /><strong>{screenDistanceM.toFixed(1)} m</strong></label>
              <label><span>{copy.orders}</span><input type="range" min="3" max="8" step="1" value={orderCount} onChange={(event) => setOrderCount(Number(event.target.value))} /><strong>{orderCount}</strong></label>
            </div>
          </article>
        </aside>
        <div className="double-slit-main">
          <div className="double-slit-stage"><DoubleSlitSvg wavelengthNm={wavelengthNm} slitDistanceMm={slitDistanceMm} screenDistanceM={screenDistanceM} orderCount={orderCount} state={state} /></div>
          <div className="double-slit-explain-card">
            <article><h2>{copy.currentPattern}</h2><p>{copy.currentPatternBody}</p></article>
            <article><h2>{copy.modelNote}</h2><p>{copy.modelNoteBody}</p></article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$d\\sin\\theta=n\\lambda$  $\\Delta x=\\frac{\\lambda L}{d}$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.physicalOptics}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('physics'))}><Icon name="lucide:book-open" />{copy.viewFormulas}</GhostButton></article>
      </section>
    </div>
  );
}
