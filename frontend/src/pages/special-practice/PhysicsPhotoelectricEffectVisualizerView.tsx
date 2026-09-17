import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

type PhotoelectricCopy = {
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  formulas: string;
  calculatedValues: string;
  photonEnergy: string;
  workFunction: string;
  maxKineticEnergy: string;
  thresholdFrequency: string;
  wavelength: string;
  emissionOccurs: string;
  noEmission: string;
  controls: string;
  frequency: string;
  intensity: string;
  metal: string;
  pause: string;
  play: string;
  reset: string;
  thresholdRule: string;
  thresholdRuleBody: string;
  intensityNote: string;
  intensityNoteBody: string;
  coreFormula: string;
  relatedPractice: string;
  photoelectricEffect: string;
  formulaReference: string;
  viewFormulas: string;
};

const PHOTOELECTRIC_COPY: LocalizedMap<PhotoelectricCopy> = {
  'zh-CN': {
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 光电效应交互模拟',
    title: '光电效应交互模拟',
    body: '调节入射光频率、光强与金属材料，观察截止频率、逸出功和最大初动能的关系。',
    minuteUnit: '分钟',
    level: '中级',
    practice: '物理练习',
    formulas: '公式',
    calculatedValues: '计算值',
    photonEnergy: '光子能量',
    workFunction: '逸出功',
    maxKineticEnergy: '最大初动能',
    thresholdFrequency: '截止频率',
    wavelength: '波长',
    emissionOccurs: '有光电子发射',
    noEmission: '无光电子发射',
    controls: '控制面板',
    frequency: '频率 ν',
    intensity: '光强',
    metal: '金属材料',
    pause: '暂停',
    play: '播放',
    reset: '重置',
    thresholdRule: '截止条件',
    thresholdRuleBody: '只有当单个光子的能量 hν 大于金属逸出功 W₀ 时，才会有光电子逸出。',
    intensityNote: '光强作用',
    intensityNoteBody: '光强增大表示单位时间光子数更多，会增加发射电子数量，但不会提高单个电子的最大初动能。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    photoelectricEffect: '光电效应',
    formulaReference: '查看公式',
    viewFormulas: '查看公式',
  },
  en: {
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Photoelectric Effect',
    title: 'Photoelectric Effect Simulation',
    body: 'Change light frequency, intensity, and metal material to test the emission threshold.',
    minuteUnit: 'min',
    level: 'Intermediate',
    practice: 'Physics Practice',
    formulas: 'Formulas',
    calculatedValues: 'Calculated Values',
    photonEnergy: 'Photon energy',
    workFunction: 'Work function',
    maxKineticEnergy: 'Max kinetic energy',
    thresholdFrequency: 'Threshold frequency',
    wavelength: 'Wavelength',
    emissionOccurs: 'Emission occurs',
    noEmission: 'No emission',
    controls: 'Controls',
    frequency: 'Frequency ν',
    intensity: 'Intensity',
    metal: 'Metal',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    thresholdRule: 'Threshold Rule',
    thresholdRuleBody: 'Electrons are emitted only when the photon energy is greater than the work function.',
    intensityNote: 'Intensity Note',
    intensityNoteBody: 'Higher intensity increases the number of emitted electrons, not the maximum kinetic energy of each electron.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    photoelectricEffect: 'Photoelectric Effect',
    formulaReference: 'Formula Reference',
    viewFormulas: 'View Formulas',
  },
};
(PHOTOELECTRIC_COPY as any).vi = {
  ...PHOTOELECTRIC_COPY.en!,
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

type PhotoelectricMaterialId = 'cs' | 'na' | 'zn' | 'pt';

const PHOTOELECTRIC_MATERIALS: Record<PhotoelectricMaterialId, { label: string; workFunction: number; color: string }> = {
  cs: { label: '铯 (Cs)', workFunction: 2.1, color: '#cbd5e1' },
  na: { label: '钠 (Na)', workFunction: 2.3, color: '#d6e4f0' },
  zn: { label: '锌 (Zn)', workFunction: 3.6, color: '#c7d2fe' },
  pt: { label: '铂 (Pt)', workFunction: 6.4, color: '#e5e7eb' }
};

const PLANCK_EV_PER_1E14_HZ = 0.4135667696;

function photoelectricState(frequency: number, intensity: number, materialId: PhotoelectricMaterialId) {
  const material = PHOTOELECTRIC_MATERIALS[materialId];
  const photonEnergy = PLANCK_EV_PER_1E14_HZ * frequency;
  const thresholdFrequency = material.workFunction / PLANCK_EV_PER_1E14_HZ;
  const kineticEnergy = Math.max(0, photonEnergy - material.workFunction);
  const wavelength = 2997.92458 / frequency;
  const emitted = kineticEnergy > 0.001;
  const electronCount = emitted ? Math.max(2, Math.round(intensity * 1.6)) : 0;
  return { material, photonEnergy, thresholdFrequency, kineticEnergy, wavelength, emitted, electronCount };
}

function PhotoelectricMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="photoelectric-metric"><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}

function PhotoelectricExperimentSvg({ frequency, intensity, materialId, phase, state }: { frequency: number; intensity: number; materialId: PhotoelectricMaterialId; phase: number; state: ReturnType<typeof photoelectricState> }) {
  const width = 760;
  const height = 330;
  const plateX = 420;
  const plateY = 56;
  const plateH = 214;
  const beamOpacity = clampNumber(0.16 + intensity * 0.08, 0.18, 0.64);
  const electronSpeed = clampNumber(34 + state.kineticEnergy * 30, 34, 130);
  const electrons = Array.from({ length: state.electronCount }, (_, index) => {
    const progress = ((phase * 0.18 + index / Math.max(state.electronCount, 1)) % 1);
    const x = plateX + 70 + progress * electronSpeed;
    const y = 98 + (index % 5) * 34 + Math.sin(phase + index) * 8;
    return { x, y, opacity: 1 - progress * 0.55 };
  });

  return (
    <svg className="photoelectric-experiment-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="光电效应实验示意图">
      <defs>
        <linearGradient id="photoelectric-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="photoelectric-beam" x1="0" x2="1">
          <stop offset="0" stopColor="#7c3aed" stopOpacity=".2" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity=".78" />
        </linearGradient>
        <marker id="photoelectric-arrow-blue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" /></marker>
        <filter id="photoelectric-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={width} height={height} rx="14" fill="url(#photoelectric-bg)" />
      <text x="16" y="24" className="stage-title">光电效应</text>
      <path d={`M 28 92 L ${plateX - 10} 92 L ${plateX - 10} 270 L 28 270 Z`} fill="url(#photoelectric-beam)" opacity={beamOpacity} />
      {[0, 1, 2].map((row) => (
        <g key={row} className="photon-ray">
          <line x1="44" y1={98 + row * 58} x2={plateX - 20} y2={98 + row * 58} />
          <text x={170} y={93 + row * 58}>hν</text>
        </g>
      ))}
      <rect x={plateX} y={plateY} width="92" height={plateH} rx="2" fill={state.material.color} className="metal-plate" />
      <text x={plateX + 46} y={plateY + plateH + 20}>{state.material.label.split(' ')[0]}</text>
      <text x="44" y="306">λ={state.wavelength.toFixed(0)} nm</text>
      <rect x="104" y="294" width="14" height="14" rx="2" fill={frequency >= 7 ? '#7c3aed' : '#a855f7'} />
      <text x="612" y="68" className="electron-title">{state.emitted ? '光电子 e⁻' : '未达到截止频率'}</text>
      {state.emitted ? (
        <g className="emitted-electrons" filter="url(#photoelectric-glow)">
          {electrons.map((electron, index) => <circle key={index} cx={electron.x} cy={electron.y} r={3.5 + intensity * 0.25} opacity={electron.opacity} />)}
          <line x1={plateX + 104} y1="160" x2={plateX + 120 + electronSpeed} y2="160" markerEnd="url(#photoelectric-arrow-blue)" />
          <text x={plateX + 128 + electronSpeed} y="164">Ek={state.kineticEnergy.toFixed(2)} eV</text>
        </g>
      ) : (
        <g className="no-emission">
          <line x1={plateX + 104} y1="160" x2={plateX + 214} y2="160" />
          <text x={plateX + 122} y="150">E &lt; W₀，无电子逸出</text>
        </g>
      )}
    </svg>
  );
}

function PhotoelectricGraphSvg({ frequency, state }: { frequency: number; state: ReturnType<typeof photoelectricState> }) {
  const width = 760;
  const height = 230;
  const chart = { x: 62, y: 28, w: 646, h: 152 };
  const xMax = 14;
  const yMax = 4.8;
  const mapX = (value: number) => chart.x + (value / xMax) * chart.w;
  const mapY = (value: number) => chart.y + chart.h - (value / yMax) * chart.h;
  const thresholdX = mapX(state.thresholdFrequency);
  const currentX = mapX(frequency);
  const currentY = mapY(state.kineticEnergy);
  const lineStartX = mapX(state.thresholdFrequency);
  const lineEndX = mapX(xMax);
  const lineEndY = mapY(Math.max(0, PLANCK_EV_PER_1E14_HZ * xMax - state.material.workFunction));

  return (
    <svg className="photoelectric-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="最大初动能与频率关系图">
      <rect width={width} height={height} rx="14" fill="#f5f7ff" />
      <text x="18" y="24" className="stage-title">动能-频率图</text>
      <rect x={chart.x} y={chart.y} width={Math.max(0, thresholdX - chart.x)} height={chart.h} className="threshold-zone" />
      {[0, 1, 2, 3, 4].map((tick) => {
        const x = chart.x + (tick * chart.w) / 4;
        const value = (tick * xMax) / 4;
        return <g key={`x-${tick}`}><line x1={x} y1={chart.y} x2={x} y2={chart.y + chart.h} className="grid-line" /><text x={x} y={chart.y + chart.h + 22}>{value.toFixed(1)}</text></g>;
      })}
      {[0, 1, 2, 3, 4].map((tick) => {
        const y = chart.y + chart.h - (tick * chart.h) / 4;
        const value = (tick * yMax) / 4;
        return <g key={`y-${tick}`}><line x1={chart.x} y1={y} x2={chart.x + chart.w} y2={y} className="grid-line" /><text x={chart.x - 12} y={y + 4}>{value.toFixed(1)}</text></g>;
      })}
      <line x1={chart.x} y1={chart.y + chart.h} x2={chart.x + chart.w} y2={chart.y + chart.h} className="axis-line" />
      <line x1={chart.x} y1={chart.y} x2={chart.x} y2={chart.y + chart.h} className="axis-line" />
      <line x1={thresholdX} y1={chart.y} x2={thresholdX} y2={chart.y + chart.h} className="threshold-line" />
      <text x={thresholdX + 4} y={chart.y + 16} className="threshold-label">ν₀={state.thresholdFrequency.toFixed(1)}</text>
      <line x1={lineStartX} y1={chart.y + chart.h} x2={lineEndX} y2={lineEndY} className="energy-line" />
      <circle cx={currentX} cy={currentY} r="7" className="current-point" />
      <text x={currentX + 12} y={currentY - 8}>({frequency.toFixed(1)}, {state.kineticEnergy.toFixed(2)} eV)</text>
      <text x={chart.x - 44} y={chart.y + 10}>Ek / eV</text>
      <text x={chart.x + chart.w - 64} y={chart.y + chart.h + 40}>ν / ×10¹⁴ Hz</text>
      <text x={chart.x + 14} y={chart.y + chart.h - 8} className="work-label">-W₀={(-state.material.workFunction).toFixed(1)} eV</text>
    </svg>
  );
}

export function PhysicsPhotoelectricEffectVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(PHOTOELECTRIC_COPY, locale);
  const [frequency, setFrequency] = useState(7);
  const [intensity, setIntensity] = useState(5);
  const [materialId, setMaterialId] = useState<PhotoelectricMaterialId>('cs');
  const [phase, setPhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const state = photoelectricState(frequency, intensity, materialId);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const id = window.setInterval(() => setPhase((value) => (value + 0.12) % 1000), 32);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const reset = () => {
    setFrequency(7);
    setIntensity(5);
    setMaterialId('cs');
    setPhase(0);
    setIsPlaying(true);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page photoelectric-page">
      <section className="special-visualizer-hero photoelectric-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:bar-chart-3" />{copy.level}</span><span><b>{state.kineticEnergy.toFixed(2)}</b> eV</span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="photoelectric-card" data-testid="photoelectric-panel">
        <aside className="photoelectric-side">
          <article className="photoelectric-formula-card">
            <h2>{copy.formulas}</h2>
            <MathContent text="$E_k=h\\nu-W_0$" />
            <MathContent text="$\\nu_0=\\frac{W_0}{h}$" />
            <MathContent text="$E=h\\nu$" />
          </article>
          <article className="photoelectric-data-card">
            <h2>{copy.calculatedValues}</h2>
            <PhotoelectricMetric color="#b7ef43" label={copy.photonEnergy} value={`${state.photonEnergy.toFixed(2)} eV`} />
            <PhotoelectricMetric color="#ef4444" label={copy.workFunction} value={`${state.material.workFunction.toFixed(1)} eV`} />
            <PhotoelectricMetric color="#3b82f6" label={copy.maxKineticEnergy} value={`${state.kineticEnergy.toFixed(2)} eV`} />
            <PhotoelectricMetric color="#315dff" label={copy.thresholdFrequency} value={`${state.thresholdFrequency.toFixed(2)} ×10¹⁴ Hz`} />
            <PhotoelectricMetric color="#22c55e" label={copy.wavelength} value={`${state.wavelength.toFixed(0)} nm`} />
            <div className={`photoelectric-emission ${state.emitted ? 'active' : ''}`}>{state.emitted ? copy.emissionOccurs : copy.noEmission}</div>
          </article>
          <article className="photoelectric-control-card">
            <h2>{copy.controls}</h2>
            <div className="photoelectric-slider-stack">
              <label><span>{copy.frequency}</span><input type="range" min="2" max="14" step="0.1" value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} /><strong>{frequency.toFixed(1)} ×10¹⁴ Hz</strong></label>
              <label><span>{copy.intensity}</span><input type="range" min="1" max="10" step="1" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /><strong>{intensity}</strong></label>
            </div>
            <label className="photoelectric-select"><span>{copy.metal}</span><select value={materialId} onChange={(event) => setMaterialId(event.target.value as PhotoelectricMaterialId)}>{(Object.entries(PHOTOELECTRIC_MATERIALS) as Array<[PhotoelectricMaterialId, typeof PHOTOELECTRIC_MATERIALS[PhotoelectricMaterialId]]>).map(([id, material]) => <option key={id} value={id}>{material.label} - {material.workFunction.toFixed(1)} eV</option>)}</select></label>
            <div className="newton-action-row"><button type="button" className="primary" onClick={() => setIsPlaying((value) => !value)}><Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{isPlaying ? copy.pause : copy.play}</button><button type="button" onClick={reset}><Icon name="lucide:rotate-ccw" />{copy.reset}</button></div>
          </article>
        </aside>
        <div className="photoelectric-main">
          <div className="photoelectric-stage"><PhotoelectricExperimentSvg frequency={frequency} intensity={intensity} materialId={materialId} phase={phase} state={state} /></div>
          <div className="photoelectric-stage"><PhotoelectricGraphSvg frequency={frequency} state={state} /></div>
          <div className="photoelectric-explain-card">
            <article><h2>{copy.thresholdRule}</h2><p>{copy.thresholdRuleBody}</p></article>
            <article><h2>{copy.intensityNote}</h2><p>{copy.intensityNoteBody}</p></article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$E_k=h\\nu-W_0$  $\\nu_0=\\frac{W_0}{h}$  $E=h\\nu$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.photoelectricEffect}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('physics'))}><Icon name="lucide:book-open" />{copy.viewFormulas}</GhostButton></article>
      </section>
    </div>
  );
}


