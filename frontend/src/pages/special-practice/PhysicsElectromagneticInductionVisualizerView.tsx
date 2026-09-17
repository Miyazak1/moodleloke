import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

type InductionDirection = 'none' | 'counterclockwise' | 'clockwise';
type InductionPhaseStatus = 'zeroFlux' | 'stableFlux' | 'changingFlux' | 'angle';

type InductionCopy = {
  direction: Record<InductionDirection, string>;
  phaseStatus: Record<Exclude<InductionPhaseStatus, 'angle'>, string>;
  experimentAria: string;
  graphAria: string;
  translateStage: string;
  rotateStage: string;
  fieldIntoPage: string;
  graphTitle: string;
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  coreFormulas: string;
  readout: string;
  flux: string;
  emf: string;
  current: string;
  directionLabel: string;
  controls: string;
  mode: string;
  movingLoop: string;
  rotatingLoop: string;
  turns: string;
  width: string;
  height: string;
  pause: string;
  play: string;
  reset: string;
  lenzLaw: string;
  lenzLawBody: string;
  currentModel: string;
  translateModelBody: string;
  rotateModelBody: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  electromagnetism: string;
  formulaReference: string;
  formulaReferenceBody: string;
  openFormulas: string;
};

const INDUCTION_COPY: LocalizedMap<InductionCopy> = {
  'zh-CN': {
    direction: {
      none: '无感应电流',
      counterclockwise: '逆时针',
      clockwise: '顺时针',
    },
    phaseStatus: {
      zeroFlux: '磁通量为 0',
      stableFlux: '磁通量稳定',
      changingFlux: '磁通量变化中',
    },
    experimentAria: '电磁感应模拟图',
    graphAria: '磁通量和感应电动势曲线',
    translateStage: '平移线圈',
    rotateStage: '旋转线圈',
    fieldIntoPage: '向纸面内',
    graphTitle: '磁通量与感应电动势',
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 电磁感应交互模拟',
    title: '电磁感应交互模拟',
    body: '改变穿过线圈的磁通量，观察法拉第定律如何把磁通量、感应电动势和感应电流联系起来。',
    minuteUnit: '分钟',
    level: '中级',
    practice: '物理练习',
    coreFormulas: '公式',
    readout: '读数',
    flux: '磁通量',
    emf: '感应电动势',
    current: '感应电流',
    directionLabel: '方向判断',
    controls: '控制面板',
    mode: '模式',
    movingLoop: '平移线圈',
    rotatingLoop: '旋转线圈',
    turns: '匝数 N',
    width: '线圈宽度',
    height: '线圈高度',
    pause: '暂停',
    play: '播放',
    reset: '重置',
    lenzLaw: '楞次定律',
    lenzLawBody: '感应电流的方向总是阻碍磁通量的变化，而不是简单“反抗磁场本身”。',
    currentModel: '当前模型',
    translateModelBody: '平移线圈只有在进入或离开磁场、磁通量发生变化时才产生感应电动势。',
    rotateModelBody: '旋转线圈使磁通量持续按余弦变化，因此感应电动势呈正弦变化。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '练习区分磁通量、感应电动势、感应电流和方向判断。',
    electromagnetism: '电磁学',
    formulaReference: '查看公式',
    formulaReferenceBody: '回到公式表复盘法拉第定律和磁通量公式。',
    openFormulas: '查看公式',
  },
  en: {
    direction: {
      none: 'No induced current',
      counterclockwise: 'Counterclockwise',
      clockwise: 'Clockwise',
    },
    phaseStatus: {
      zeroFlux: 'Flux is 0',
      stableFlux: 'Flux is stable',
      changingFlux: 'Flux is changing',
    },
    experimentAria: 'Electromagnetic induction simulation diagram',
    graphAria: 'Magnetic flux and induced emf graph',
    translateStage: 'Moving loop',
    rotateStage: 'Rotating loop',
    fieldIntoPage: 'into the page',
    graphTitle: 'Magnetic Flux and Induced EMF',
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Electromagnetic Induction',
    title: 'Electromagnetic Induction Simulation',
    body: 'Change the magnetic flux through a coil and watch Faraday law connect flux, emf, and current.',
    minuteUnit: 'min',
    level: 'Intermediate',
    practice: 'Physics Practice',
    coreFormulas: 'Core Formulas',
    readout: 'Readout',
    flux: 'Flux',
    emf: 'EMF',
    current: 'Current',
    directionLabel: 'Direction',
    controls: 'Controls',
    mode: 'Mode',
    movingLoop: 'Moving loop',
    rotatingLoop: 'Rotating loop',
    turns: 'Turns N',
    width: 'Width',
    height: 'Height',
    pause: 'Pause',
    play: 'Play',
    reset: 'Reset',
    lenzLaw: 'Lenz Law',
    lenzLawBody: 'The induced current opposes the change in magnetic flux, not the magnetic field itself.',
    currentModel: 'Current Model',
    translateModelBody: 'Induced emf appears only while the magnetic flux through the loop is changing.',
    rotateModelBody: 'A rotating loop changes flux continuously, producing sinusoidal emf.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Practice separating flux, emf, current, and direction.',
    electromagnetism: 'Electromagnetism',
    formulaReference: 'Formula Reference',
    formulaReferenceBody: 'Review Faraday law and magnetic flux in the formula table.',
    openFormulas: 'Open Formulas',
  },
};
(INDUCTION_COPY as any).vi = {
  ...INDUCTION_COPY.en!,
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

type InductionMode = 'translate' | 'rotate';

function translateCoilX(phase: number) {
  return -120 + phase * 900;
}

function translateFluxAtPhase(phase: number, magneticField: number, coilWidth: number, coilHeight: number, turns: number) {
  const fieldLeft = 280;
  const fieldRight = 620;
  const coilLeft = translateCoilX(phase);
  const coilRight = coilLeft + coilWidth;
  const overlap = clampNumber(Math.min(coilRight, fieldRight) - Math.max(coilLeft, fieldLeft), 0, coilWidth);
  const overlapArea = (overlap / 100) * (coilHeight / 100);
  return turns * magneticField * overlapArea;
}

function inductionState(mode: InductionMode, magneticField: number, coilWidth: number, coilHeight: number, speed: number, turns: number, resistance: number, phase: number) {
  const area = (coilWidth / 100) * (coilHeight / 100);
  const safeR = Math.max(resistance, 0.1);
  if (mode === 'rotate') {
    const theta = phase * Math.PI * 2;
    const omega = speed;
    const flux = turns * magneticField * area * Math.cos(theta);
    const emf = turns * magneticField * area * omega * Math.sin(theta);
    return {
      area,
      flux,
      emf,
      current: emf / safeR,
      coilX: 410,
      overlapRatio: 1,
      direction: emf >= 0 ? 'counterclockwise' as const : 'clockwise' as const,
      phaseStatus: 'angle' as const,
      phaseDegrees: Math.round((theta * 180) / Math.PI) % 360
    };
  }

  const coilX = translateCoilX(phase);
  const flux = translateFluxAtPhase(phase, magneticField, coilWidth, coilHeight, turns);
  const previousFlux = translateFluxAtPhase((phase - 0.004 + 1) % 1, magneticField, coilWidth, coilHeight, turns);
  const nextFlux = translateFluxAtPhase((phase + 0.004) % 1, magneticField, coilWidth, coilHeight, turns);
  const dPhiByPhase = (nextFlux - previousFlux) / 0.008;
  const cycleSeconds = 9 / Math.max(speed, 0.2);
  const emf = -dPhiByPhase / cycleSeconds;
  const coilRight = coilX + coilWidth;
  const overlap = clampNumber(Math.min(coilRight, 620) - Math.max(coilX, 280), 0, coilWidth);
  return {
    area,
    flux,
    emf,
    current: emf / safeR,
    coilX,
    overlapRatio: overlap / coilWidth,
    direction: Math.abs(emf) < 0.01 ? 'none' as const : (emf > 0 ? 'counterclockwise' as const : 'clockwise' as const),
    phaseStatus: overlap === 0 ? 'zeroFlux' as const : overlap === coilWidth ? 'stableFlux' as const : 'changingFlux' as const,
    phaseDegrees: null
  };
}

function InductionMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return <div className="induction-metric"><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>;
}

function inductionPhaseLabel(state: ReturnType<typeof inductionState>, copy: InductionCopy) {
  return state.phaseStatus === 'angle' ? `θ=${state.phaseDegrees}°` : copy.phaseStatus[state.phaseStatus];
}

function InductionExperimentSvg({ mode, magneticField, coilWidth, coilHeight, speed, turns, phase, state, copy }: { mode: InductionMode; magneticField: number; coilWidth: number; coilHeight: number; speed: number; turns: number; phase: number; state: ReturnType<typeof inductionState>; copy: InductionCopy }) {
  const width = 760;
  const height = 320;
  const field = { x: 280, y: 54, w: 340, h: 214 };
  const coilY = 160 - coilHeight / 2;
  const rotateTheta = phase * Math.PI * 2;
  const rotateScale = mode === 'rotate' ? Math.max(0.22, Math.abs(Math.cos(rotateTheta))) : 1;
  const coilX = mode === 'rotate' ? 432 - (coilWidth * rotateScale) / 2 : state.coilX;
  const visualWidth = mode === 'rotate' ? coilWidth * rotateScale : coilWidth;
  const currentActive = Math.abs(state.emf) > 0.04;
  const meterNeedle = clampNumber(state.emf / Math.max(turns * magneticField * state.area * Math.max(speed, 0.5), 0.1), -1, 1);
  const xs = Array.from({ length: 11 }, (_, index) => field.x + 20 + index * 30);
  const ys = Array.from({ length: 7 }, (_, index) => field.y + 24 + index * 28);

  return (
    <svg className="induction-experiment-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.experimentAria}>
      <defs>
        <marker id="induction-arrow-green" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" /></marker>
        <marker id="induction-arrow-red" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" /></marker>
      </defs>
      <rect width={width} height={height} rx="14" className="induction-bg" />
      <text x="18" y="24" className="stage-title">{mode === 'rotate' ? copy.rotateStage : copy.translateStage}</text>
      <rect x={field.x} y={field.y} width={field.w} height={field.h} className="field-region" />
      <text x={field.x + field.w / 2} y={field.y + 24} className="field-label">B={magneticField.toFixed(1)} T {copy.fieldIntoPage}</text>
      <g className="field-crosses">
        {ys.flatMap((y) => xs.map((x) => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}><line x1="-6" y1="-6" x2="6" y2="6" /><line x1="6" y1="-6" x2="-6" y2="6" /></g>))}
      </g>
      {mode === 'translate' ? (
        <>
          <line x1={Math.max(38, coilX + visualWidth / 2 - 48)} y1={coilY - 24} x2={Math.max(84, coilX + visualWidth / 2 + 26)} y2={coilY - 24} className="velocity-arrow" markerEnd="url(#induction-arrow-green)" />
          <text x={Math.max(44, coilX + visualWidth / 2 - 36)} y={coilY - 34} className="velocity-label">v</text>
        </>
      ) : (
        <path d={`M ${coilX + visualWidth + 42} ${coilY + 12} A 34 34 0 1 1 ${coilX + visualWidth + 42} ${coilY + 78}`} className="rotation-arrow" markerEnd="url(#induction-arrow-green)" />
      )}
      <g transform={`translate(${coilX} ${coilY})`} className={currentActive ? 'coil active' : 'coil'}>
        <rect width={visualWidth} height={coilHeight} rx="4" />
        <circle cx="0" cy="0" r="4" />
        <circle cx={visualWidth} cy="0" r="4" />
        <circle cx="0" cy={coilHeight} r="4" />
        <circle cx={visualWidth} cy={coilHeight} r="4" />
        {currentActive && <path d={`M ${visualWidth / 2 - 26} ${coilHeight + 22} q 26 16 52 0`} className={state.emf >= 0 ? 'current-flow positive' : 'current-flow negative'} markerEnd="url(#induction-arrow-red)" />}
      </g>
      <g className="induction-meter" transform="translate(640 208)">
        <rect x="-52" y="-36" width="104" height="72" rx="12" />
        <line x1="0" y1="14" x2={meterNeedle * 34} y2="-12" className="meter-needle" />
        <text x="0" y="-12">ε</text>
        <text x="0" y="28">{state.emf.toFixed(2)} V</text>
      </g>
      <text x="24" y="292" className="stage-note">Φ={state.flux.toFixed(3)} Wb  ε={state.emf.toFixed(2)} V  I={(state.current * 1000).toFixed(1)} mA</text>
    </svg>
  );
}

function InductionGraphSvg({ mode, magneticField, coilWidth, coilHeight, speed, turns, resistance, phase, copy }: { mode: InductionMode; magneticField: number; coilWidth: number; coilHeight: number; speed: number; turns: number; resistance: number; phase: number; copy: InductionCopy }) {
  const width = 760;
  const height = 250;
  const chart = { x: 54, y: 34, w: 650, h: 164 };
  const samples = Array.from({ length: 120 }, (_, index) => {
    const p = index / 119;
    return inductionState(mode, magneticField, coilWidth, coilHeight, speed, turns, resistance, p);
  });
  const maxFlux = Math.max(...samples.map((item) => Math.abs(item.flux)), 0.1);
  const maxEmf = Math.max(...samples.map((item) => Math.abs(item.emf)), 0.1);
  const mapX = (p: number) => chart.x + p * chart.w;
  const mapYFlux = (value: number) => chart.y + chart.h / 2 - (value / maxFlux) * (chart.h * 0.42);
  const mapYEmf = (value: number) => chart.y + chart.h / 2 - (value / maxEmf) * (chart.h * 0.42);
  const fluxPath = samples.map((item, index) => `${index === 0 ? 'M' : 'L'} ${mapX(index / 119).toFixed(1)} ${mapYFlux(item.flux).toFixed(1)}`).join(' ');
  const emfPath = samples.map((item, index) => `${index === 0 ? 'M' : 'L'} ${mapX(index / 119).toFixed(1)} ${mapYEmf(item.emf).toFixed(1)}`).join(' ');
  const currentX = mapX(phase);
  const current = inductionState(mode, magneticField, coilWidth, coilHeight, speed, turns, resistance, phase);

  return (
    <svg className="induction-graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.graphAria}>
      <rect width={width} height={height} rx="14" className="graph-bg" />
      <text x="18" y="24" className="stage-title">{copy.graphTitle}</text>
      {[0, 1, 2, 3, 4].map((tick) => {
        const x = chart.x + (tick * chart.w) / 4;
        return <line key={`gx-${tick}`} x1={x} y1={chart.y} x2={x} y2={chart.y + chart.h} className="grid-line" />;
      })}
      {[-1, 0, 1].map((tick) => {
        const y = chart.y + chart.h / 2 - tick * chart.h * 0.34;
        return <line key={`gy-${tick}`} x1={chart.x} y1={y} x2={chart.x + chart.w} y2={y} className={tick === 0 ? 'axis-line' : 'grid-line'} />;
      })}
      <path d={fluxPath} className="flux-line" />
      <path d={emfPath} className="emf-line" />
      <line x1={currentX} y1={chart.y} x2={currentX} y2={chart.y + chart.h} className="cursor-line" />
      <circle cx={currentX} cy={mapYFlux(current.flux)} r="5" className="flux-dot" />
      <circle cx={currentX} cy={mapYEmf(current.emf)} r="5" className="emf-dot" />
      <g className="graph-legend" transform="translate(572 32)">
        <rect x="0" y="0" width="12" height="12" rx="3" className="flux-dot" /><text x="18" y="10">Φ</text>
        <rect x="72" y="0" width="12" height="12" rx="3" className="emf-dot" /><text x="90" y="10">ε</text>
      </g>
      <text x={chart.x} y={chart.y + chart.h + 30}>t</text>
      <text x={chart.x + chart.w - 118} y={chart.y + chart.h + 30}>{inductionPhaseLabel(current, copy)}</text>
    </svg>
  );
}

export function PhysicsElectromagneticInductionVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(INDUCTION_COPY, locale);
  const [mode, setMode] = useState<InductionMode>('translate');
  const [magneticField, setMagneticField] = useState(1);
  const [coilWidth, setCoilWidth] = useState(80);
  const [coilHeight, setCoilHeight] = useState(60);
  const [speed, setSpeed] = useState(2);
  const [turns, setTurns] = useState(12);
  const [resistance, setResistance] = useState(20);
  const [isPlaying, setIsPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const state = inductionState(mode, magneticField, coilWidth, coilHeight, speed, turns, resistance, phase);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const id = window.setInterval(() => {
      setPhase((value) => (value + 0.006 * Math.max(speed, 0.2)) % 1);
    }, 32);
    return () => window.clearInterval(id);
  }, [isPlaying, speed]);

  const reset = () => {
    setPhase(0);
    setIsPlaying(false);
  };

  const modeTip = mode === 'translate' ? copy.translateModelBody : copy.rotateModelBody;

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page induction-page">
      <section className="special-visualizer-hero induction-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:activity" />{copy.level}</span><span><b>{state.emf.toFixed(2)}</b> V</span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="induction-card" data-testid="induction-panel">
        <aside className="induction-side">
          <article className="induction-formula-card">
            <h2>{copy.coreFormulas}</h2>
            <MathContent text="$\\varepsilon=-\\frac{d\\Phi}{dt}$" />
            <MathContent text="$\\Phi=BA\\cos\\theta$" />
            <MathContent text="$\\varepsilon=NBA\\omega\\sin(\\omega t)$" />
          </article>
          <article className="induction-data-card">
            <h2>{copy.readout}</h2>
            <InductionMetric color="#3b82f6" label={copy.flux} value={`${state.flux.toFixed(4)} Wb`} />
            <InductionMetric color="#ef4444" label={copy.emf} value={`${state.emf.toFixed(3)} V`} />
            <InductionMetric color="#22c55e" label="B" value={`${magneticField.toFixed(1)} T`} />
            <InductionMetric color="#b7ef43" label={copy.current} value={`${(state.current * 1000).toFixed(1)} mA`} />
            <div className="induction-direction"><span>{copy.directionLabel}</span><strong>{copy.direction[state.direction]}</strong></div>
          </article>
          <article className="induction-control-card">
            <h2>{copy.controls}</h2>
            <label className="induction-select"><span>{copy.mode}</span><select value={mode} onChange={(event) => { setMode(event.target.value as InductionMode); setPhase(0); }}><option value="translate">{copy.movingLoop}</option><option value="rotate">{copy.rotatingLoop}</option></select></label>
            <div className="induction-slider-stack">
              <label><span>B</span><input type="range" min="0.2" max="2.5" step="0.1" value={magneticField} onChange={(event) => setMagneticField(Number(event.target.value))} /><strong>{magneticField.toFixed(1)} T</strong></label>
              <label><span>{copy.turns}</span><input type="range" min="1" max="40" step="1" value={turns} onChange={(event) => setTurns(Number(event.target.value))} /><strong>{turns}</strong></label>
              <label><span>{copy.width}</span><input type="range" min="40" max="150" step="5" value={coilWidth} onChange={(event) => setCoilWidth(Number(event.target.value))} /><strong>{coilWidth} px</strong></label>
              <label><span>{copy.height}</span><input type="range" min="40" max="130" step="5" value={coilHeight} onChange={(event) => setCoilHeight(Number(event.target.value))} /><strong>{coilHeight} px</strong></label>
              <label><span>{mode === 'rotate' ? 'ω' : 'v'}</span><input type="range" min="0.5" max="5" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /><strong>{mode === 'rotate' ? `${speed.toFixed(1)} rad/s` : `${speed.toFixed(1)} m/s`}</strong></label>
              <label><span>R</span><input type="range" min="5" max="80" step="1" value={resistance} onChange={(event) => setResistance(Number(event.target.value))} /><strong>{resistance.toFixed(0)} Ω</strong></label>
            </div>
            <div className="induction-actions"><button type="button" onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? copy.pause : copy.play}</button><button type="button" onClick={reset}>{copy.reset}</button></div>
          </article>
        </aside>

        <div className="induction-main">
          <div className="induction-stage"><InductionExperimentSvg mode={mode} magneticField={magneticField} coilWidth={coilWidth} coilHeight={coilHeight} speed={speed} turns={turns} phase={phase} state={state} copy={copy} /></div>
          <div className="induction-stage"><InductionGraphSvg mode={mode} magneticField={magneticField} coilWidth={coilWidth} coilHeight={coilHeight} speed={speed} turns={turns} resistance={resistance} phase={phase} copy={copy} /></div>
          <div className="induction-explain-card">
            <article><h2>{copy.lenzLaw}</h2><p>{copy.lenzLawBody}</p></article>
            <article><h2>{copy.currentModel}</h2><p>{modeTip}</p></article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$\\varepsilon=-\\frac{d\\Phi}{dt}$  $\\Phi=BA\\cos\\theta$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><p>{copy.relatedPracticeBody}</p><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.electromagnetism}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><p>{copy.formulaReferenceBody}</p><GhostButton onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.openFormulas}</GhostButton></article>
      </section>
    </div>
  );
}
