import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

type WaveCopy = {
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  formulas: string;
  waveParameters: string;
  speed: string;
  waveNumber: string;
  angularFrequency: string;
  controls: string;
  amplitude: string;
  wavelength: string;
  frequency: string;
  traveling: string;
  standing: string;
  showParticles: string;
  pause: string;
  play: string;
  reset: string;
  currentModel: string;
  travelingModelBody: string;
  standingModelBody: string;
  readingTip: string;
  readingTipBody: string;
  coreFormula: string;
  relatedPractice: string;
  wavesAndShm: string;
  formulaReference: string;
  viewFormulas: string;
};

const WAVE_COPY: LocalizedMap<WaveCopy> = {
  'zh-CN': {
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 波动可视化交互模拟',
    title: '波动可视化交互模拟',
    body: '调节振幅、波长和频率，观察行波传播、驻波波节波腹以及 v=fλ 的联动。',
    minuteUnit: '分钟',
    level: '中级',
    practice: '物理练习',
    formulas: '公式',
    waveParameters: '波动参数',
    speed: '波速 v',
    waveNumber: '波数 k',
    angularFrequency: '角频率 ω',
    controls: '控制面板',
    amplitude: '振幅 A',
    wavelength: '波长 λ',
    frequency: '频率 f',
    traveling: '行波',
    standing: '驻波',
    showParticles: '显示质点',
    pause: '暂停',
    play: '播放',
    reset: '重置',
    currentModel: '当前模型',
    travelingModelBody: '相位随时间变化，波形沿传播方向移动，波速由 v=fλ 给出。',
    standingModelBody: '驻波不整体传播：波节位置固定，波腹振动最明显。',
    readingTip: '读图提示',
    readingTipBody: '振幅看平衡位置到波峰的竖直距离；波长看相邻波峰之间的水平距离。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    wavesAndShm: '简谐振动与机械波',
    formulaReference: '查看公式',
    viewFormulas: '查看公式',
  },
  en: {
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Wave Visualization',
    title: 'Wave Visualization',
    body: 'Adjust amplitude, wavelength, and frequency to compare traveling and standing waves.',
    minuteUnit: 'min',
    level: 'Intermediate',
    practice: 'Physics Practice',
    formulas: 'Formulas',
    waveParameters: 'Wave Parameters',
    speed: 'Speed v',
    waveNumber: 'Wave number k',
    angularFrequency: 'Angular frequency ω',
    controls: 'Controls',
    amplitude: 'Amplitude A',
    wavelength: 'Wavelength λ',
    frequency: 'Frequency f',
    traveling: 'Traveling',
    standing: 'Standing',
    showParticles: 'Show particles',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    currentModel: 'Current Model',
    travelingModelBody: 'The phase changes with time, so the waveform translates through space.',
    standingModelBody: 'A standing wave oscillates in place: nodes stay fixed while antinodes move most.',
    readingTip: 'Reading Tip',
    readingTipBody: 'Amplitude is vertical displacement from equilibrium; wavelength is horizontal distance between adjacent crests.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    wavesAndShm: 'Waves and SHM',
    formulaReference: 'Formula Reference',
    viewFormulas: 'View Formulas',
  },
};

WAVE_COPY.vi = {
  ...WAVE_COPY.en!,
  back: '← Quay lại công thức Vật lý',
  kicker: 'Trang chủ / Vật lý / Công thức / Mô phỏng sóng',
  title: 'Mô phỏng sóng',
  body: 'Điều chỉnh biên độ, bước sóng và tần số để so sánh sóng truyền và sóng dừng.',
  minuteUnit: 'phút',
  level: 'Trung cấp',
  practice: 'Luyện Vật lý',
  formulas: 'Công thức',
  waveParameters: 'Tham số sóng',
  speed: 'Vận tốc v',
  waveNumber: 'Số sóng k',
  angularFrequency: 'Tần số góc ω',
  controls: 'Điều khiển',
  amplitude: 'Biên độ A',
  wavelength: 'Bước sóng λ',
  frequency: 'Tần số f',
  traveling: 'Sóng truyền',
  standing: 'Sóng dừng',
  showParticles: 'Hiển thị phần tử',
  pause: 'Tạm dừng',
  play: 'Phát',
  reset: 'Đặt lại',
  currentModel: 'Mô hình hiện tại',
  travelingModelBody: 'Pha thay đổi theo thời gian, nên dạng sóng dịch chuyển trong không gian.',
  standingModelBody: 'Sóng dừng dao động tại chỗ: nút sóng cố định, bụng sóng dao động mạnh nhất.',
  readingTip: 'Mẹo đọc hình',
  readingTipBody: 'Biên độ là độ lệch dọc so với vị trí cân bằng; bước sóng là khoảng cách ngang giữa hai đỉnh liên tiếp.',
  coreFormula: 'Công thức cốt lõi',
  relatedPractice: 'Luyện tập liên quan',
  wavesAndShm: 'Sóng và dao động điều hòa',
  formulaReference: 'Bảng công thức',
  viewFormulas: 'Xem công thức',
};

function subjectPath(subject: string) {
  return routes.cscaSubjects + '/' + subject;
}

function subjectFormulaPath(subject: string) {
  return routes.cscaSubjects + '/' + subject + '/formulas';
}

type WaveMode = 'traveling' | 'standing';

function buildPhysicsWavePath({ amplitude, wavelength, frequency, phase, mode }: { amplitude: number; wavelength: number; frequency: number; phase: number; mode: WaveMode }) {
  const width = 760;
  const baseline = 190;
  const left = 48;
  const right = 710;
  const step = 6;
  const omega = Math.PI * 2 * frequency;
  const points: Array<{ x: number; y: number }> = [];
  for (let x = left; x <= right; x += step) {
    const localX = x - left;
    const angle = (Math.PI * 2 * localX) / wavelength;
    const value = mode === 'traveling'
      ? Math.sin(angle - phase)
      : Math.sin(angle) * Math.cos(phase);
    points.push({ x, y: baseline - amplitude * value });
  }
  return {
    path: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),
    points: points.filter((_, index) => index % 3 === 0),
    speed: frequency * wavelength,
    waveNumber: (Math.PI * 2) / wavelength,
    angularFrequency: omega
  };
}

function WaveDiagramSvg({ amplitude, wavelength, frequency, mode, phase, showParticles }: { amplitude: number; wavelength: number; frequency: number; mode: WaveMode; phase: number; showParticles: boolean }) {
  const width = 760;
  const height = 360;
  const baseline = 190;
  const left = 48;
  const right = 710;
  const data = buildPhysicsWavePath({ amplitude, wavelength, frequency, phase, mode });
  const scaleEnd = Math.min(left + wavelength, right - 20);
  const nodes = Array.from({ length: 7 }, (_, index) => left + (index * wavelength) / 2).filter((x) => x <= right - 12);
  const antinodes = Array.from({ length: 7 }, (_, index) => left + wavelength / 4 + (index * wavelength) / 2).filter((x) => x <= right - 12);

  return (
    <svg className="wave-diagram-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="横波可视化图">
      <defs>
        <pattern id="wave-grid" width="42" height="32" patternUnits="userSpaceOnUse">
          <path d="M 42 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,.12)" strokeWidth="1" />
        </pattern>
        <marker id="wave-arrow-blue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#315dff" /></marker>
        <marker id="wave-arrow-red" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" /></marker>
      </defs>
      <rect width={width} height={height} rx="14" fill="url(#wave-grid)" />
      <text x="16" y="24" className="stage-title">波动</text>
      <line x1={left} x2={right} y1={baseline} y2={baseline} className="equilibrium" />
      <line x1={left} x2={left} y1="66" y2="294" className="y-axis" />
      <text x={left - 14} y="70" className="axis-label">y</text>
      <path d={data.path} className={mode === 'traveling' ? 'wave-path traveling' : 'wave-path standing'} />
      {showParticles && data.points.map((point, index) => (
        <g key={index} className="wave-particle">
          <line x1={point.x} x2={point.x} y1={baseline} y2={point.y} />
          <circle cx={point.x} cy={point.y} r="4" />
        </g>
      ))}
      {mode === 'standing' && (
        <g className="standing-markers">
          {nodes.map((x) => <g key={`node-${x}`}><line x1={x} x2={x} y1={baseline - amplitude - 18} y2={baseline + amplitude + 18} /><text x={x} y={baseline + amplitude + 34}>节</text></g>)}
          {antinodes.map((x) => <circle key={`anti-${x}`} cx={x} cy={baseline} r="4" />)}
          <text x={right - 118} y="42">驻波：波节固定，波腹振动</text>
        </g>
      )}
      {mode === 'traveling' && (
        <g className="speed-arrow">
          <line x1="270" y1="48" x2="405" y2="48" markerEnd="url(#wave-arrow-blue)" />
          <text x="414" y="53">v</text>
        </g>
      )}
      <g className="wavelength-scale">
        <line x1={left} y1="276" x2={scaleEnd} y2="276" />
        <line x1={left} y1="270" x2={left} y2="282" />
        <line x1={scaleEnd} y1="270" x2={scaleEnd} y2="282" />
        <text x={(left + scaleEnd) / 2} y="296">λ = {wavelength.toFixed(0)} px</text>
      </g>
      <g className="amplitude-scale">
        <line x1={right + 14} y1={baseline} x2={right + 14} y2={baseline - amplitude} markerEnd="url(#wave-arrow-red)" />
        <line x1={right + 10} y1={baseline} x2={right + 18} y2={baseline} />
        <text x={right + 24} y={baseline - amplitude / 2 + 4}>A</text>
      </g>
    </svg>
  );
}

function WaveMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="wave-metric"><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}

export function PhysicsWaveSpeedVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(WAVE_COPY, locale);
  const [amplitude, setAmplitude] = useState(50);
  const [wavelength, setWavelength] = useState(150);
  const [frequency, setFrequency] = useState(1);
  const [mode, setMode] = useState<WaveMode>('traveling');
  const [showParticles, setShowParticles] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [phase, setPhase] = useState(0);
  const wave = buildPhysicsWavePath({ amplitude, wavelength, frequency, phase, mode });

  useEffect(() => {
    if (!isPlaying) return undefined;
    const startedAt = performance.now() - (phase / (Math.PI * 2 * frequency)) * 1000;
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setPhase((elapsed * Math.PI * 2 * frequency) % (Math.PI * 2));
    }, 32);
    return () => window.clearInterval(id);
  }, [isPlaying, frequency]);

  const reset = () => {
    setPhase(0);
    setIsPlaying(false);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page wave-page">
      <section className="special-visualizer-hero wave-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:bar-chart-3" />{copy.level}</span><span><b>{wave.speed.toFixed(1)}</b> px/s</span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="wave-card" data-testid="wave-panel">
        <aside className="wave-side">
          <article className="wave-formula-card">
            <h2>{copy.formulas}</h2>
            <MathContent text="$y=A\\sin(kx-\\omega t)$" />
            <MathContent text="$v=f\\lambda$" />
            <MathContent text="$k=\\frac{2\\pi}{\\lambda},\\ \\omega=2\\pi f$" />
          </article>
          <article className="wave-data-card">
            <h2>{copy.waveParameters}</h2>
            <WaveMetric color="#3b82f6" label={copy.speed} value={`${wave.speed.toFixed(1)} px/s`} />
            <WaveMetric color="#b7ef43" label={copy.waveNumber} value={wave.waveNumber.toFixed(3)} />
            <WaveMetric color="#22c55e" label={copy.angularFrequency} value={wave.angularFrequency.toFixed(2)} />
          </article>
          <article className="wave-control-card">
            <h2>{copy.controls}</h2>
            <div className="wave-slider-stack">
              <label><span>{copy.amplitude}</span><input type="range" min="20" max="80" step="1" value={amplitude} onChange={(event) => setAmplitude(Number(event.target.value))} /><strong>{amplitude.toFixed(0)} px</strong></label>
              <label><span>{copy.wavelength}</span><input type="range" min="90" max="240" step="5" value={wavelength} onChange={(event) => setWavelength(Number(event.target.value))} /><strong>{wavelength.toFixed(0)} px</strong></label>
              <label><span>{copy.frequency}</span><input type="range" min="0.2" max="3" step="0.1" value={frequency} onChange={(event) => setFrequency(Number(event.target.value))} /><strong>{frequency.toFixed(1)} Hz</strong></label>
            </div>
            <div className="wave-segments">
              <button type="button" className={mode === 'traveling' ? 'active' : ''} onClick={() => setMode('traveling')}>{copy.traveling}</button>
              <button type="button" className={mode === 'standing' ? 'active' : ''} onClick={() => setMode('standing')}>{copy.standing}</button>
            </div>
            <label className="wave-toggle"><span>{copy.showParticles}</span><input type="checkbox" checked={showParticles} onChange={(event) => setShowParticles(event.target.checked)} /></label>
            <div className="newton-action-row"><button type="button" className="primary" onClick={() => setIsPlaying((value) => !value)}><Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{isPlaying ? copy.pause : copy.play}</button><button type="button" onClick={reset}><Icon name="lucide:rotate-ccw" />{copy.reset}</button></div>
          </article>
        </aside>
        <div className="wave-main">
          <div className="wave-stage"><WaveDiagramSvg amplitude={amplitude} wavelength={wavelength} frequency={frequency} mode={mode} phase={phase} showParticles={showParticles} /></div>
          <div className="wave-explain-card">
            <article><h2>{copy.currentModel}</h2><p>{mode === 'traveling' ? copy.travelingModelBody : copy.standingModelBody}</p></article>
            <article><h2>{copy.readingTip}</h2><p>{copy.readingTipBody}</p></article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$y=A\\sin(kx-\\omega t)$  $v=f\\lambda$  $k=\\frac{2\\pi}{\\lambda}$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.wavesAndShm}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('physics'))}><Icon name="lucide:book-open" />{copy.viewFormulas}</GhostButton></article>
      </section>
    </div>
  );
}
