import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../../components/Icon';
import { GhostButton } from '../../components/UiPrimitives';
import { MathContent } from '../../components/MathContent';
import { LocalizedMap, pickLocalized } from '../../i18n/locale-utils';
import { useI18n } from '../../i18n/useI18n';
import { routes } from '../../lib/routes';

type ElectricPresetId = 'dipole' | 'repel' | 'attract' | 'triple';

type ElectricFieldCopy = {
  svgAria: string;
  svgTitle: string;
  back: string;
  kicker: string;
  title: string;
  body: string;
  metricsAria: string;
  minuteUnit: string;
  level: string;
  chargesUnit: string;
  practice: string;
  coreFormulas: string;
  charges: string;
  positive: string;
  negative: string;
  emptyCharges: string;
  showFieldVectors: string;
  showEquipotentialPoints: string;
  presets: Record<ElectricPresetId, string>;
  clearAll: string;
  forceReadout: string;
  coulombForce: string;
  repulsive: string;
  attractive: string;
  netForce: string;
  selectCharge: string;
  positiveLegend: string;
  negativeLegend: string;
  fieldLegend: string;
  forceLegend: string;
  coreFormula: string;
  relatedPractice: string;
  relatedPracticeBody: string;
  electricFieldPractice: string;
  formulaReference: string;
  formulaReferenceBody: string;
  openFormulas: string;
};

const ELECTRIC_FIELD_COPY: LocalizedMap<ElectricFieldCopy> = {
  'zh-CN': {
    svgAria: '静电场与库仑定律可视化',
    svgTitle: '电场',
    back: '← 返回物理公式',
    kicker: '首页 / 物理 / 公式 / 电场与库仑力演示',
    title: '电场与库仑力演示',
    body: '放置并拖动点电荷，观察电场矢量叠加、等势分布和库仑力方向。',
    metricsAria: '电场模拟信息',
    minuteUnit: '分钟',
    level: '基础',
    chargesUnit: '个电荷',
    practice: '物理练习',
    coreFormulas: '核心公式',
    charges: '电荷',
    positive: '正电荷',
    negative: '负电荷',
    emptyCharges: '添加电荷后开始观察。',
    showFieldVectors: '显示电场矢量',
    showEquipotentialPoints: '显示等势点',
    presets: {
      dipole: '电偶极子',
      repel: '同号排斥',
      attract: '异号吸引',
      triple: '三电荷叠加',
    },
    clearAll: '清除所有',
    forceReadout: '力学读数',
    coulombForce: '库仑力',
    repulsive: '排斥',
    attractive: '吸引',
    netForce: '选中电荷合力',
    selectCharge: '选中一个电荷后查看它受到的合力。',
    positiveLegend: '正电荷：电场向外',
    negativeLegend: '负电荷：电场向内',
    fieldLegend: '蓝色箭头：电场方向',
    forceLegend: '黄色箭头：选中电荷合力',
    coreFormula: '核心公式',
    relatedPractice: '相关练习',
    relatedPracticeBody: '先判断电场和受力方向，再用库仑定律计算大小。',
    electricFieldPractice: '静电场',
    formulaReference: '查看公式',
    formulaReferenceBody: '回到公式表复盘库仑力、电场强度、电势差和电容。',
    openFormulas: '查看公式',
  },
  en: {
    svgAria: 'Static electric field and Coulomb law visualization',
    svgTitle: 'Electric field',
    back: '← Back to Physics Formulas',
    kicker: 'Home / Physics / Formulas / Electric Field',
    title: 'Electric Field and Coulomb Force',
    body: 'Place point charges and observe field vectors, potential contours, and Coulomb force directions.',
    metricsAria: 'Electric field simulation details',
    minuteUnit: 'min',
    level: 'Foundation',
    chargesUnit: 'charges',
    practice: 'Physics Practice',
    coreFormulas: 'Core Formulas',
    charges: 'Charges',
    positive: 'Positive',
    negative: 'Negative',
    emptyCharges: 'Add a charge to begin.',
    showFieldVectors: 'Show field vectors',
    showEquipotentialPoints: 'Show equipotential points',
    presets: {
      dipole: 'Electric dipole',
      repel: 'Like charges repel',
      attract: 'Opposite charges attract',
      triple: 'Three-charge superposition',
    },
    clearAll: 'Clear All',
    forceReadout: 'Force Readout',
    coulombForce: 'Coulomb force',
    repulsive: 'repulsive',
    attractive: 'attractive',
    netForce: 'Net force on selected charge',
    selectCharge: 'Select a charge to inspect net force.',
    positiveLegend: 'Positive charge: field points outward',
    negativeLegend: 'Negative charge: field points inward',
    fieldLegend: 'Blue arrows: electric field',
    forceLegend: 'Amber arrow: net force',
    coreFormula: 'Core Formula',
    relatedPractice: 'Related Practice',
    relatedPracticeBody: 'Use field direction first, then calculate magnitude with Coulomb law.',
    electricFieldPractice: 'Electric Field Practice',
    formulaReference: 'Formula Reference',
    formulaReferenceBody: 'Review Coulomb force, electric field strength, potential difference, and capacitance.',
    openFormulas: 'Open Formulas',
  },
};
(ELECTRIC_FIELD_COPY as any).vi = {
  ...ELECTRIC_FIELD_COPY.en!,
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
type ElectricCharge = { id: number; q: number; x: number; y: number };

const ELECTRIC_FIELD_PRESETS = [
  { id: 'dipole', charges: [{ id: 1, q: 1, x: 290, y: 230 }, { id: 2, q: -1, x: 510, y: 230 }] },
  { id: 'repel', charges: [{ id: 1, q: 1, x: 300, y: 230 }, { id: 2, q: 1, x: 500, y: 230 }] },
  { id: 'attract', charges: [{ id: 1, q: 2, x: 310, y: 220 }, { id: 2, q: -1, x: 500, y: 260 }] },
  { id: 'triple', charges: [{ id: 1, q: 1, x: 250, y: 210 }, { id: 2, q: -1, x: 520, y: 210 }, { id: 3, q: 1, x: 390, y: 310 }] }
] as const;

const FIELD_WIDTH = 760;
const FIELD_HEIGHT = 420;
const FIELD_SCALE_PX_PER_M = 130;

function electricFieldAt(charges: ElectricCharge[], x: number, y: number, ignoreId?: number) {
  return charges.reduce((sum, charge) => {
    if (charge.id === ignoreId) return sum;
    const dx = x - charge.x;
    const dy = y - charge.y;
    const r2 = Math.max(dx * dx + dy * dy, 420);
    const r = Math.sqrt(r2);
    const strength = charge.q / r2;
    return {
      x: sum.x + strength * (dx / r),
      y: sum.y + strength * (dy / r)
    };
  }, { x: 0, y: 0 });
}

function electricPotentialAt(charges: ElectricCharge[], x: number, y: number) {
  return charges.reduce((sum, charge) => {
    const distance = Math.max(Math.hypot(x - charge.x, y - charge.y), 18);
    return sum + charge.q / distance;
  }, 0);
}

function coulombForceBetween(a: ElectricCharge, b: ElectricCharge) {
  const k = 8.99e9;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rPx = Math.max(Math.hypot(dx, dy), 12);
  const rMeters = rPx / FIELD_SCALE_PX_PER_M;
  const force = (k * Math.abs(a.q * 1e-6 * b.q * 1e-6)) / (rMeters * rMeters);
  const sign = a.q * b.q > 0 ? 'repel' : 'attract';
  return { force, distance: rMeters, sign };
}

function netForceOnCharge(charges: ElectricCharge[], selectedId: number) {
  const selected = charges.find((charge) => charge.id === selectedId);
  if (!selected) return { x: 0, y: 0, magnitude: 0 };
  const field = electricFieldAt(charges, selected.x, selected.y, selected.id);
  const scale = 8.99e9 * Math.abs(selected.q * 1e-6) * 1e-6 / ((1 / FIELD_SCALE_PX_PER_M) ** 2);
  const fx = field.x * scale;
  const fy = field.y * scale;
  return { x: fx, y: fy, magnitude: Math.hypot(fx, fy) };
}

function ElectricFieldSvg({
  charges,
  selectedId,
  showField,
  showPotential,
  copy,
  onSelect,
  onMove
}: {
  charges: ElectricCharge[];
  selectedId: number | null;
  showField: boolean;
  showPotential: boolean;
  copy: Pick<ElectricFieldCopy, 'svgAria' | 'svgTitle'>;
  onSelect: (id: number | null) => void;
  onMove: (id: number, x: number, y: number) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const netForce = selectedId === null ? null : netForceOnCharge(charges, selectedId);
  const selected = selectedId === null ? null : charges.find((charge) => charge.id === selectedId) ?? null;
  const fieldPoints = useMemo(() => {
    const points: Array<{ x: number; y: number; ex: number; ey: number; magnitude: number }> = [];
    for (let y = 62; y <= FIELD_HEIGHT - 56; y += 42) {
      for (let x = 58; x <= FIELD_WIDTH - 58; x += 46) {
        if (charges.some((charge) => Math.hypot(charge.x - x, charge.y - y) < 34)) continue;
        const field = electricFieldAt(charges, x, y);
        points.push({ x, y, ex: field.x, ey: field.y, magnitude: Math.hypot(field.x, field.y) });
      }
    }
    return points;
  }, [charges]);
  const potentialPoints = useMemo(() => {
    const levels = [-0.0045, -0.0025, -0.0011, 0.0011, 0.0025, 0.0045];
    const points: Array<{ x: number; y: number; level: number }> = [];
    for (let y = 44; y <= FIELD_HEIGHT - 40; y += 12) {
      for (let x = 42; x <= FIELD_WIDTH - 42; x += 12) {
        const potential = electricPotentialAt(charges, x, y);
        const level = levels.find((item) => Math.abs(potential - item) < 0.00018);
        if (level !== undefined) points.push({ x, y, level });
      }
    }
    return points;
  }, [charges]);

  const moveCharge = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragId === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * FIELD_HEIGHT;
    onMove(dragId, clampNumber(x, 30, FIELD_WIDTH - 30), clampNumber(y, 30, FIELD_HEIGHT - 30));
  };

  return (
    <svg
      className="electric-field-svg"
      viewBox={`0 0 ${FIELD_WIDTH} ${FIELD_HEIGHT}`}
      role="img"
      aria-label={copy.svgAria}
      onPointerMove={moveCharge}
      onPointerUp={() => setDragId(null)}
      onPointerLeave={() => setDragId(null)}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelect(null);
      }}
    >
      <defs>
        <pattern id="electric-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M 36 0 L 0 0 0 36" />
        </pattern>
        <marker id="electric-arrow-blue" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#315dff" />
        </marker>
        <marker id="electric-arrow-amber" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#b7ef43" />
        </marker>
      </defs>
      <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} className="field-bg" />
      <text x="14" y="22" className="field-title">{copy.svgTitle}</text>
      {showPotential && potentialPoints.map((point, index) => (
        <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="2" className={point.level > 0 ? 'equipotential positive' : 'equipotential negative'} />
      ))}
      {showField && fieldPoints.map((point) => {
        const length = clampNumber(Math.sqrt(point.magnitude) * 2100, 9, 22);
        const angle = Math.atan2(point.ey, point.ex);
        const x2 = point.x + Math.cos(angle) * length;
        const y2 = point.y + Math.sin(angle) * length;
        return <line key={`${point.x}-${point.y}`} x1={point.x} y1={point.y} x2={x2} y2={y2} className="field-vector" markerEnd="url(#electric-arrow-blue)" />;
      })}
      {selected && netForce && netForce.magnitude > 0 && (
        <line
          x1={selected.x}
          y1={selected.y}
          x2={selected.x + (netForce.x / netForce.magnitude) * 62}
          y2={selected.y + (netForce.y / netForce.magnitude) * 62}
          className="force-vector"
          markerEnd="url(#electric-arrow-amber)"
        />
      )}
      {charges.map((charge) => (
        <g
          key={charge.id}
          className={selectedId === charge.id ? 'charge selected' : 'charge'}
          transform={`translate(${charge.x} ${charge.y})`}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragId(charge.id);
            onSelect(charge.id);
          }}
        >
          <circle r="18" className={charge.q > 0 ? 'positive' : 'negative'} />
          <text y="6" className="charge-symbol">{charge.q > 0 ? '+' : '-'}</text>
          <text y="40" className="charge-label">q{charge.id}</text>
        </g>
      ))}
    </svg>
  );
}

export function PhysicsElectricFieldVisualizerView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { locale } = useI18n();
  const copy = pickLocalized(ELECTRIC_FIELD_COPY, locale);
  const [charges, setCharges] = useState<ElectricCharge[]>(() => ELECTRIC_FIELD_PRESETS[0].charges.map((charge) => ({ ...charge })));
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [showField, setShowField] = useState(true);
  const [showPotential, setShowPotential] = useState(false);
  const selected = selectedId === null ? null : charges.find((charge) => charge.id === selectedId) ?? null;
  const pairForce = charges.length === 2 ? coulombForceBetween(charges[0], charges[1]) : null;
  const netForce = selected ? netForceOnCharge(charges, selected.id) : null;
  const nextId = Math.max(0, ...charges.map((charge) => charge.id)) + 1;

  const addCharge = (q: number) => {
    const charge = { id: nextId, q, x: 260 + (nextId % 4) * 70, y: 160 + (nextId % 3) * 54 };
    setCharges((current) => [...current, charge]);
    setSelectedId(charge.id);
  };
  const applyPreset = (preset: typeof ELECTRIC_FIELD_PRESETS[number]) => {
    setCharges(preset.charges.map((charge) => ({ ...charge })));
    setSelectedId(preset.charges[0]?.id ?? null);
  };
  const moveCharge = (id: number, x: number, y: number) => {
    setCharges((current) => current.map((charge) => charge.id === id ? { ...charge, x, y } : charge));
  };
  const removeCharge = (id: number) => {
    setCharges((current) => current.filter((charge) => charge.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const clearCharges = () => {
    setCharges([]);
    setSelectedId(null);
  };

  return (
    <div className="page-stack brand-page special-practice-page special-visualizer-page electric-page">
      <section className="special-visualizer-hero electric-hero">
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
            <span><b>{charges.length}</b> {copy.chargesUnit}</span>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate(subjectPath('physics'))}>{copy.practice}</button>
      </section>

      <section className="electric-card" data-testid="electric-panel">
        <aside className="electric-side">
          <article className="electric-formula-card">
            <h2>{copy.coreFormulas}</h2>
            <MathContent text="$F=k\\frac{q_1q_2}{r^2}$" />
            <MathContent text="$E=\\frac{F}{q}=k\\frac{Q}{r^2}$" />
          </article>
          <article className="electric-control-card">
            <h2>{copy.charges}</h2>
            <div className="electric-add-row">
              <button type="button" className="positive" onClick={() => addCharge(1)}>+ {copy.positive}</button>
              <button type="button" className="negative" onClick={() => addCharge(-1)}>- {copy.negative}</button>
            </div>
            <div className="electric-charge-list">
              {charges.map((charge) => (
                <button key={charge.id} type="button" className={selectedId === charge.id ? 'active' : ''} onClick={() => setSelectedId(charge.id)}>
                  <i className={charge.q > 0 ? 'positive' : 'negative'}>{charge.q > 0 ? '+' : '-'}</i>
                  <span>q{charge.id} = {charge.q > 0 ? '+' : '-'}{Math.abs(charge.q)} μC</span>
                  <em>({charge.x.toFixed(0)}, {charge.y.toFixed(0)})</em>
                  <b onClick={(event) => { event.stopPropagation(); removeCharge(charge.id); }}>×</b>
                </button>
              ))}
              {!charges.length && <p>{copy.emptyCharges}</p>}
            </div>
            <label className="electric-check"><input type="checkbox" checked={showField} onChange={(event) => setShowField(event.target.checked)} />{copy.showFieldVectors}</label>
            <label className="electric-check"><input type="checkbox" checked={showPotential} onChange={(event) => setShowPotential(event.target.checked)} />{copy.showEquipotentialPoints}</label>
            <div className="kinematics-preset-row">
              {ELECTRIC_FIELD_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>{copy.presets[preset.id]}</button>)}
            </div>
            <button type="button" className="electric-clear" onClick={clearCharges}>{copy.clearAll}</button>
          </article>
          <article className="electric-readout-card">
            <h2>{copy.forceReadout}</h2>
            {pairForce && <p>{copy.coulombForce} F₁₂ = <b>{pairForce.force.toExponential(2)}</b> N · {pairForce.sign === 'repel' ? copy.repulsive : copy.attractive}</p>}
            {selected && netForce && <p>{copy.netForce} F = <b>{netForce.magnitude.toExponential(2)}</b> N</p>}
            {!selected && <p>{copy.selectCharge}</p>}
          </article>
        </aside>
        <div className="electric-main">
          <ElectricFieldSvg charges={charges} selectedId={selectedId} showField={showField} showPotential={showPotential} copy={copy} onSelect={setSelectedId} onMove={moveCharge} />
          <div className="electric-legend">
            <span><i className="positive" />{copy.positiveLegend}</span>
            <span><i className="negative" />{copy.negativeLegend}</span>
            <span><i className="field" />{copy.fieldLegend}</span>
            <span><i className="force" />{copy.forceLegend}</span>
          </div>
        </div>
      </section>

      <section className="special-visualizer-support newton-support">
        <article>
          <h2>{copy.coreFormula}</h2>
          <p><MathContent text="$F=k\\frac{q_1q_2}{r^2}$  $E=k\\frac{Q}{r^2}$" /></p>
        </article>
        <article>
          <h2>{copy.relatedPractice}</h2>
          <p>{copy.relatedPracticeBody}</p>
          <GhostButton onClick={() => onNavigate(subjectPath('physics'))}>{copy.electricFieldPractice}</GhostButton>
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


