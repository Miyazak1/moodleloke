import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

const NewtonSecondLawCanvas = lazy(() => import('../../components/NewtonSecondLawCanvas'));

class NewtonCanvasBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidUpdate(previousProps: { children: ReactNode }) {
    if (previousProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const NEWTON_COPY: LocalizedMap<Record<string, string>> = {
  'zh-CN': {
    backToPhysicsFormulas: '← 返回物理公式',
    physicsPractice: '物理练习',
    foundation: '基础',
    scene3dFailed: '3D 场景暂时无法加载',
    loading3dScene: '正在加载 3D 场景...',
    minUnit: '分钟',
    play: '播放',
    pause: '暂停',
    reset: '重置',
    random: '随机',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    formulaReference: '查看公式',
    openFormulas: '进入公式速查',
    newtonKicker: '首页 / 物理 / 公式 / 牛顿第二定律 F=ma 交互模拟',
    newtonTitle: '牛顿第二定律 F=ma 交互模拟',
    newtonBody: '调节力和质量，观察物块在 3D 场景中的加速度、速度和位移变化，直观理解 F=ma。',
    newtonMetricsAria: '牛顿第二定律模拟信息',
    newtonLiveValuesAria: '牛顿第二定律实时数值',
    forceF: '力 F',
    massM: '质量 m',
    newtonRelatedBody: '理解加速度后，再进入匀变速直线运动题，会更容易读懂速度和位移变化。',
    newtonRelatedCta: '牛顿运动定律',
    newtonReferenceBody: '回到公式表，把力、质量、加速度和运动学公式一起复盘。'
  },
  en: {
    backToPhysicsFormulas: '← Back to Physics Formulas',
    physicsPractice: 'Physics Practice',
    foundation: 'Foundation',
    scene3dFailed: '3D scene failed to load.',
    loading3dScene: 'Loading 3D scene...',
    minUnit: 'min',
    play: 'Play',
    pause: 'Pause',
    reset: 'Reset',
    random: 'Random',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    formulaReference: 'Formula Reference',
    openFormulas: 'Open Formulas',
    newtonKicker: 'Home / Physics / Formulas / Newton Second Law',
    newtonTitle: "Newton's Second Law F=ma",
    newtonBody: 'Change force and mass, then watch acceleration, velocity, and displacement respond in a 3D scene.',
    newtonMetricsAria: 'Newton simulation details',
    newtonLiveValuesAria: 'Newton simulation live values',
    forceF: 'Force F',
    massM: 'Mass m',
    newtonRelatedBody: 'Use this model before kinematics questions: acceleration determines how velocity changes.',
    newtonRelatedCta: 'Physics Practice',
    newtonReferenceBody: 'Review force, mass, acceleration, work, energy, and momentum together.'
  },
  vi: {
    backToPhysicsFormulas: '← Quay lại công thức Vật lý',
    physicsPractice: 'Luyện Vật lý',
    foundation: 'Cơ bản',
    scene3dFailed: 'Cảnh 3D hiện không tải được.',
    loading3dScene: 'Đang tải cảnh 3D...',
    minUnit: 'phút',
    play: 'Phát',
    pause: 'Tạm dừng',
    reset: 'Đặt lại',
    random: 'Ngẫu nhiên',
    coreFormula: 'Công thức cốt lõi',
    relatedPractice: 'Luyện tập liên quan',
    formulaReference: 'Bảng công thức',
    openFormulas: 'Mở công thức',
    newtonKicker: 'Trang chủ / Vật lý / Công thức / Định luật II Newton',
    newtonTitle: 'Định luật II Newton F=ma',
    newtonBody: 'Thay đổi lực và khối lượng, rồi quan sát gia tốc, vận tốc và độ dời phản hồi trong cảnh 3D.',
    newtonMetricsAria: 'Chi tiết mô phỏng Newton',
    newtonLiveValuesAria: 'Giá trị trực tiếp của mô phỏng Newton',
    forceF: 'Lực F',
    massM: 'Khối lượng m',
    newtonRelatedBody: 'Dùng mô hình này trước các câu động học: gia tốc quyết định vận tốc thay đổi như thế nào.',
    newtonRelatedCta: 'Luyện Vật lý',
    newtonReferenceBody: 'Ôn lực, khối lượng, gia tốc, công, năng lượng và động lượng cùng nhau.'
  }
};

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

export function PhysicsNewtonSecondLawVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(NEWTON_COPY, locale);
  const [force, setForce] = useState(10);
  const [mass, setMass] = useState(2);
  const [isPlaying, setIsPlaying] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const [telemetry, setTelemetry] = useState({ position: -3.2, velocity: 0 });
  const acceleration = force / mass;

  const reset = () => {
    setTelemetry({ position: -3.2, velocity: 0 });
    setResetSignal((value) => value + 1);
  };

  const randomize = () => {
    setForce(Number((4 + Math.random() * 16).toFixed(1)));
    setMass(Number((1 + Math.random() * 5).toFixed(1)));
    setIsPlaying(true);
    setResetSignal((value) => value + 1);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page newton-simulator-page">
      <section className="special-visualizer-hero newton-simulator-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>
          {copy.backToPhysicsFormulas}
        </GhostButton>
        <div>
          <p className="page-kicker">{copy.newtonKicker}</p>
          <h1>{copy.newtonTitle}</h1>
          <p className="page-body">{copy.newtonBody}</p>
          <div className="special-visualizer-metrics" aria-label={copy.newtonMetricsAria}>
            <span><Icon name="lucide:clock" />5 {copy.minUnit}</span>
            <span><Icon name="lucide:activity" />{copy.foundation}</span>
            <span><b>{formatNumber(acceleration)}</b> m/s²</span>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.physicsPractice}</button>
      </section>

      <section className="special-visualizer-card newton-simulator-card">
        <NewtonCanvasBoundary
          fallback={
            <div className="newton-canvas-wrap" data-testid="newton-three-panel">
              <div className="special-solid-canvas-fallback">{copy.scene3dFailed}</div>
            </div>
          }
        >
          <Suspense fallback={<div className="newton-canvas-wrap" data-testid="newton-three-panel"><div className="special-solid-canvas-fallback">{copy.loading3dScene}</div></div>}>
            <NewtonSecondLawCanvas
              force={force}
              mass={mass}
              isPlaying={isPlaying}
              resetSignal={resetSignal}
              onSample={setTelemetry}
            />
          </Suspense>
        </NewtonCanvasBoundary>

        <div className="newton-status-strip" aria-label={copy.newtonLiveValuesAria}>
          <span><i className="force" />F = {formatNumber(force)} N</span>
          <span><i className="mass" />m = {formatNumber(mass)} kg</span>
          <span><i className="acceleration" />a = {formatNumber(acceleration)} m/s²</span>
          <span><i className="velocity" />v = {formatNumber(telemetry.velocity)} m/s</span>
        </div>

        <div className="newton-control-panel">
          <div className="newton-slider-stack">
            <label>
              <span>{copy.forceF}</span>
              <input
                aria-label={copy.forceF}
                className="force"
                type="range"
                min="2"
                max="20"
                step="0.5"
                value={force}
                onChange={(event) => setForce(Number(event.target.value))}
              />
              <strong>{force.toFixed(1)} N</strong>
            </label>
            <label>
              <span>{copy.massM}</span>
              <input
                aria-label={copy.massM}
                className="mass"
                type="range"
                min="1"
                max="6"
                step="0.1"
                value={mass}
                onChange={(event) => setMass(Number(event.target.value))}
              />
              <strong>{mass.toFixed(1)} kg</strong>
            </label>
          </div>
          <div className="newton-action-row">
            <button type="button" className="primary" onClick={() => setIsPlaying((value) => !value)}>
              <Icon name={isPlaying ? 'lucide:pause' : 'lucide:play'} />{isPlaying ? copy.pause : copy.play}
            </button>
            <button type="button" onClick={reset}><Icon name="lucide:rotate-ccw" />{copy.reset}</button>
            <button type="button" onClick={randomize}><Icon name="lucide:shuffle" />{copy.random}</button>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article>
          <h2>{copy.coreFormula}</h2>
          <p><MathContent text="$F=ma$  $a=\\frac{F}{m}$" /></p>
        </article>
        <article>
          <h2>{copy.relatedPractice}</h2>
          <p>{copy.newtonRelatedBody}</p>
          <GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.newtonRelatedCta}</GhostButton>
        </article>
        <article>
          <h2>{copy.formulaReference}</h2>
          <p>{copy.newtonReferenceBody}</p>
          <GhostButton onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.openFormulas}</GhostButton>
        </article>
      </section>
    </div>
  );
}
