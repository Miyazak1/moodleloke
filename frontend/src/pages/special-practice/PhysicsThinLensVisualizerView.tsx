import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { pickLocalized, type LocalizedMap } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

function subjectPath(subject: string) {
  return routes.cscaSubjects + '/' + subject;
}

function subjectFormulaPath(subject: string) {
  return routes.cscaSubjects + '/' + subject + '/formulas';
}

type LensType = 'convex' | 'concave';

const THIN_LENS_COPY: LocalizedMap<{
  back: string;
  kicker: string;
  title: string;
  body: string;
  minuteUnit: string;
  level: string;
  practice: string;
  formulas: string;
  results: string;
  objectDistance: string;
  imageDistance: string;
  magnification: string;
  imageNature: string;
  controls: string;
  lensType: string;
  convex: string;
  concave: string;
  focalLength: string;
  objectHeight: string;
  howToReadTitle: string;
  howToReadBody: string;
  currentRuleTitle: string;
  focusAtInfinity: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeLabel: string;
  formulaReference: string;
  viewFormulas: string;
  realImage: string;
  virtualImage: string;
  upright: string;
  inverted: string;
  enlarged: string;
  reduced: string;
  sameSize: string;
}> = {
  'zh-CN': {
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 几何光学薄透镜交互模拟',
    title: '几何光学薄透镜交互模拟',
    body: '调节透镜类型、焦距、物距和物高，观察实像、虚像、正倒和放大缩小的变化。',
    minuteUnit: '分钟',
    level: '基础',
    practice: '物理练习',
    formulas: '公式',
    results: '计算结果',
    objectDistance: '物距 u',
    imageDistance: '像距 v',
    magnification: '放大率 |M|',
    imageNature: '像的性质',
    controls: '控制面板',
    lensType: '透镜类型',
    convex: '凸透镜',
    concave: '凹透镜',
    focalLength: '焦距 f',
    objectHeight: '物高',
    howToReadTitle: '观察重点',
    howToReadBody: '实像在透镜另一侧由实际光线会聚形成；虚像用反向延长线定位，不能用光屏承接。',
    currentRuleTitle: '当前规律',
    focusAtInfinity: '物体位于凸透镜焦点处时，出射光近似平行，像在无穷远。',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeLabel: '几何光学',
    formulaReference: '查看公式',
    viewFormulas: '查看公式',
    realImage: '实像',
    virtualImage: '虚像',
    upright: '正立',
    inverted: '倒立',
    enlarged: '放大',
    reduced: '缩小',
    sameSize: '等大'
  },
  en: {
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Thin Lens',
    title: 'Thin Lens Ray Diagram',
    body: 'Adjust lens type, focal length, object distance, and height to compare real and virtual images.',
    minuteUnit: 'min',
    level: 'Foundation',
    practice: 'Physics Practice',
    formulas: 'Formulas',
    results: 'Results',
    objectDistance: 'Object distance u',
    imageDistance: 'Image distance v',
    magnification: 'Magnification |M|',
    imageNature: 'Image nature',
    controls: 'Controls',
    lensType: 'Lens type',
    convex: 'Convex',
    concave: 'Concave',
    focalLength: 'Focal length f',
    objectHeight: 'Object height',
    howToReadTitle: 'How to Read It',
    howToReadBody: 'A real image forms on the far side of the lens. A virtual image is located by dashed backward extensions.',
    currentRuleTitle: 'Current Rule',
    focusAtInfinity: 'When the object is at the focal point of a convex lens, outgoing rays are nearly parallel and the image is at infinity.',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeLabel: 'Geometric Optics',
    formulaReference: 'Formula Reference',
    viewFormulas: 'View Formulas',
    realImage: 'real image',
    virtualImage: 'virtual image',
    upright: 'upright',
    inverted: 'inverted',
    enlarged: 'enlarged',
    reduced: 'reduced',
    sameSize: 'same size'
  }
};
(THIN_LENS_COPY as any).vi = {
  ...THIN_LENS_COPY.en!,
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


function lensState(lensType: LensType, focalLength: number, objectDistance: number, objectHeight: number) {
  const signedFocal = lensType === 'convex' ? focalLength : -focalLength;
  const denominator = (1 / signedFocal) - (1 / objectDistance);
  const finite = Math.abs(denominator) > 0.0008;
  const imageDistance = finite ? 1 / denominator : Infinity;
  const magnification = finite ? -imageDistance / objectDistance : Infinity;
  const absMagnification = Number.isFinite(magnification) ? Math.abs(magnification) : Infinity;
  const imageHeight = finite ? magnification * objectHeight : Infinity;
  const real = finite && imageDistance > 0;
  const upright = finite && magnification > 0;
  const size = !finite ? '无穷远' : absMagnification > 1.05 ? '放大' : absMagnification < 0.95 ? '缩小' : '等大';
  const nature = !finite
    ? '不成有限像，出射光近似平行'
    : `${real ? '实像' : '虚像'}，${upright ? '正立' : '倒立'}，${size}`;
  return { signedFocal, finite, imageDistance, magnification, absMagnification, imageHeight, real, upright, size, nature };
}

function localizedLensNature(state: ReturnType<typeof lensState>, copy: typeof THIN_LENS_COPY['zh-CN']) {
  if (!state.finite) return copy.focusAtInfinity;
  const size = state.absMagnification > 1.05 ? copy.enlarged : state.absMagnification < 0.95 ? copy.reduced : copy.sameSize;
  return `${state.real ? copy.realImage : copy.virtualImage}，${state.upright ? copy.upright : copy.inverted}，${size}`;
}

function ThinLensDiagramSvg({ lensType, focalLength, objectDistance, objectHeight, state }: { lensType: LensType; focalLength: number; objectDistance: number; objectHeight: number; state: ReturnType<typeof lensState> }) {
  const width = 760;
  const height = 380;
  const axisY = 196;
  const lensX = 380;
  const maxCm = Math.max(34, objectDistance, state.finite ? Math.abs(state.imageDistance) : focalLength * 3, focalLength * 2.4);
  const scale = 310 / maxCm;
  const objectX = lensX - objectDistance * scale;
  const objectTopY = axisY - objectHeight * 20;
  const imageX = state.finite ? lensX + state.imageDistance * scale : lensX + 300;
  const imageTopY = state.finite ? axisY - state.imageHeight * 20 : axisY - objectHeight * 20;
  const leftF = lensX - focalLength * scale;
  const rightF = lensX + focalLength * scale;
  const left2F = lensX - 2 * focalLength * scale;
  const right2F = lensX + 2 * focalLength * scale;
  const rayEndX = state.real ? Math.min(width - 40, imageX) : width - 44;
  const directEndX = state.finite ? imageX : width - 42;
  const divergeY = lensType === 'concave' || !state.real ? axisY + Math.max(46, Math.abs(objectTopY - axisY) * 0.55) : imageTopY;

  return (
    <svg className="lens-diagram-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="薄透镜几何光路图">
      <defs>
        <pattern id="lens-grid" width="42" height="34" patternUnits="userSpaceOnUse">
          <path d="M 42 0 L 0 0 0 34" fill="none" stroke="rgba(148,163,184,.12)" strokeWidth="1" />
        </pattern>
        <marker id="lens-arrow-blue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" /></marker>
        <marker id="lens-arrow-red" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" /></marker>
      </defs>
      <rect width={width} height={height} rx="14" fill="url(#lens-grid)" />
      <text x="16" y="24" className="stage-title">光路图</text>
      <line x1="38" x2="722" y1={axisY} y2={axisY} className="principal-axis" />
      {[left2F, leftF, rightF, right2F].map((x, index) => (
        <g key={index}>
          <circle cx={x} cy={axisY} r="4" className={index === 1 || index === 2 ? 'focus-dot main' : 'focus-dot'} />
          <text x={x} y={axisY + 22} className="focus-label">{index === 0 ? '2F' : index === 1 ? 'F' : index === 2 ? "F'" : "2F'"}</text>
        </g>
      ))}
      <g className={`lens-shape ${lensType}`}>
        <path d={lensType === 'convex' ? 'M372 70 C397 118 397 270 372 322' : 'M372 70 C354 126 354 266 372 322'} />
        <path d={lensType === 'convex' ? 'M388 70 C363 118 363 270 388 322' : 'M388 70 C406 126 406 266 388 322'} />
        <text x={lensX} y="62">{lensType === 'convex' ? '凸透镜' : '凹透镜'}</text>
      </g>
      <line x1={objectX} y1={axisY} x2={objectX} y2={objectTopY} className="object-arrow" markerEnd="url(#lens-arrow-blue)" />
      <text x={objectX - 12} y={objectTopY - 12} className="object-label">物</text>
      {state.finite && (
        <g className={state.real ? 'real-image' : 'virtual-image'}>
          <line x1={imageX} y1={axisY} x2={imageX} y2={imageTopY} markerEnd="url(#lens-arrow-red)" />
          <text x={imageX + 8} y={state.upright ? imageTopY - 10 : imageTopY + 20} className="image-label">像</text>
        </g>
      )}
      {!state.finite && <text x={lensX + 102} y={axisY - 34} className="infinite-label">出射光平行，像在无穷远</text>}
      <g className="lens-rays">
        <path className="ray parallel" d={`M ${objectX} ${objectTopY} L ${lensX} ${objectTopY} L ${rayEndX} ${state.real ? imageTopY : divergeY}`} />
        {!state.real && state.finite && <path className="ray extension" d={`M ${lensX} ${objectTopY} L ${imageX} ${imageTopY}`} />}
        <path className="ray center" d={`M ${objectX} ${objectTopY} L ${directEndX} ${state.finite ? imageTopY : objectTopY}`} />
        <path className="ray focal" d={lensType === 'convex'
          ? `M ${objectX} ${objectTopY} L ${lensX} ${axisY - ((axisY - objectTopY) * focalLength) / objectDistance} L ${state.finite ? imageX : width - 42} ${state.finite ? imageTopY : objectTopY}`
          : `M ${objectX} ${objectTopY} L ${lensX} ${axisY - ((axisY - objectTopY) * focalLength) / Math.max(objectDistance, 1)} L ${width - 42} ${axisY - ((axisY - objectTopY) * focalLength) / Math.max(objectDistance, 1)}`} />
      </g>
      <line x1="48" x2="126" y1="342" y2="342" className="legend-ray parallel" />
      <text x="58" y="346" className="legend-label">平行光线</text>
      <line x1="166" x2="244" y1="342" y2="342" className="legend-ray center" />
      <text x="178" y="346" className="legend-label">过光心</text>
      <line x1="282" x2="360" y1="342" y2="342" className="legend-ray focal" />
      <text x="294" y="346" className="legend-label">过焦点</text>
    </svg>
  );
}

function LensResultRow({ label, value }: { label: string; value: string }) {
  return <div className="lens-result-row"><span>{label}</span><strong>{value}</strong></div>;
}

export function PhysicsThinLensVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(THIN_LENS_COPY, locale);
  const [lensType, setLensType] = useState<LensType>('convex');
  const [focalLength, setFocalLength] = useState(12);
  const [objectDistance, setObjectDistance] = useState(25);
  const [objectHeight, setObjectHeight] = useState(4);
  const state = lensState(lensType, focalLength, objectDistance, objectHeight);
  const imageDistanceText = state.finite ? `${Math.abs(state.imageDistance).toFixed(1)} cm` : '∞';
  const magnificationText = Number.isFinite(state.absMagnification) ? `${state.absMagnification.toFixed(2)}×` : '∞';
  const imageNatureText = localizedLensNature(state, copy);

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page lens-page">
      <section className="special-visualizer-hero lens-hero">
        <GhostButton className="special-back-link" onClick={() => onNavigate(subjectFormulaPath('physics'))}>{copy.back}</GhostButton>
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="page-body">{copy.body}</p>
          <div className="special-visualizer-metrics"><span><Icon name="lucide:clock" />5 {copy.minuteUnit}</span><span><Icon name="lucide:activity" />{copy.level}</span><span><b>{state.finite ? imageNatureText.split('，')[0] : '∞'}</b></span></div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="lens-card" data-testid="thin-lens-panel">
        <aside className="lens-side">
          <article className="lens-formula-card">
            <h2>{copy.formulas}</h2>
            <MathContent text="$\\frac{1}{f}=\\frac{1}{u}+\\frac{1}{v}$" />
            <MathContent text="$M=\\frac{h_i}{h_o}=-\\frac{v}{u}$" />
          </article>
          <article className="lens-result-card">
            <h2>{copy.results}</h2>
            <LensResultRow label={copy.objectDistance} value={`${objectDistance.toFixed(1)} cm`} />
            <LensResultRow label={copy.imageDistance} value={imageDistanceText} />
            <LensResultRow label={copy.magnification} value={magnificationText} />
            <LensResultRow label={copy.imageNature} value={imageNatureText} />
          </article>
          <article className="lens-control-card">
            <h2>{copy.controls}</h2>
            <span>{copy.lensType}</span>
            <div className="lens-segments">
              <button type="button" className={lensType === 'convex' ? 'active' : ''} onClick={() => setLensType('convex')}>{copy.convex}</button>
              <button type="button" className={lensType === 'concave' ? 'active' : ''} onClick={() => setLensType('concave')}>{copy.concave}</button>
            </div>
            <div className="lens-slider-stack">
              <label><span>{copy.focalLength}</span><input type="range" min="6" max="24" step="0.5" value={focalLength} onChange={(event) => setFocalLength(Number(event.target.value))} /><strong>{focalLength.toFixed(1)} cm</strong></label>
              <label><span>{copy.objectDistance}</span><input type="range" min="5" max="48" step="0.5" value={objectDistance} onChange={(event) => setObjectDistance(Number(event.target.value))} /><strong>{objectDistance.toFixed(1)} cm</strong></label>
              <label><span>{copy.objectHeight}</span><input type="range" min="1.5" max="7" step="0.1" value={objectHeight} onChange={(event) => setObjectHeight(Number(event.target.value))} /><strong>{objectHeight.toFixed(1)} cm</strong></label>
            </div>
          </article>
        </aside>
        <div className="lens-main">
          <div className="lens-stage"><ThinLensDiagramSvg lensType={lensType} focalLength={focalLength} objectDistance={objectDistance} objectHeight={objectHeight} state={state} /></div>
          <div className="lens-rule-panel">
            <article><h2>{copy.howToReadTitle}</h2><p>{copy.howToReadBody}</p></article>
            <article><h2>{copy.currentRuleTitle}</h2><p>{imageNatureText}</p></article>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article><h2>{copy.coreFormula}</h2><p><MathContent text="$\\frac{1}{f}=\\frac{1}{u}+\\frac{1}{v}$  $M=-\\frac{v}{u}$" /></p></article>
        <article><h2>{copy.relatedPractice}</h2><GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.relatedPracticeLabel}</GhostButton></article>
        <article><h2>{copy.formulaReference}</h2><GhostButton className="block" onClick={() => onNavigate(subjectFormulaPath('physics'))}><Icon name="lucide:book-open" />{copy.viewFormulas}</GhostButton></article>
      </section>
    </div>
  );
}
